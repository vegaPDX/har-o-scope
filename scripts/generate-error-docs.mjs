#!/usr/bin/env node
/**
 * Generate docs/errors/<CODE>.md for each error code in src/lib/errors.ts.
 *
 * Reads the error constants from source, merges with rich metadata below,
 * and writes one markdown file per error code.
 *
 * Usage: node scripts/generate-error-docs.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ERRORS_SRC = resolve(ROOT, 'src/lib/errors.ts')
const DOCS_DIR = resolve(ROOT, 'docs/errors')

// ── Error metadata ────────────────────────────────────────────────
// Each entry: what, when, fix, seeAlso

const META = {
  HAR001: {
    title: 'Invalid JSON',
    what: 'The input could not be parsed as JSON.',
    when: [
      'The file is not valid JSON (syntax error, trailing comma, unquoted key).',
      'The file is HTML, XML, or another format mistakenly saved as `.har`.',
      'The file is truncated or corrupt (incomplete download, disk full during save).',
    ],
    fix: [
      'Open the file in a text editor and check for obvious syntax errors.',
      'Validate the JSON with `node -e "JSON.parse(require(\'fs\').readFileSync(\'file.har\',\'utf-8\'))"` to see the exact parse error.',
      'Re-export the HAR from Chrome DevTools: Network tab > right-click > Save all as HAR.',
    ],
    seeAlso: ['HAR002'],
  },
  HAR002: {
    title: 'Not a valid HAR file',
    what: 'The input is valid JSON but does not have the required HAR structure (`{ "log": { "entries": [...] } }`).',
    when: [
      'The JSON is a different format (package.json, API response, etc.) saved with a `.har` extension.',
      'The HAR was manually edited and the `log` or `entries` key was removed.',
      'A tool generated non-standard HAR output missing the `log` wrapper.',
    ],
    fix: [
      'Ensure the file has a top-level `"log"` property containing an `"entries"` array.',
      'Re-export from Chrome DevTools: Network tab > right-click > Save all as HAR with content.',
      'If using a HAR generation tool, check its documentation for correct output format.',
    ],
    seeAlso: ['HAR001', 'HAR003'],
  },
  HAR003: {
    title: 'HAR file has no entries',
    what: 'The HAR file has a valid structure but the `entries` array is empty.',
    when: [
      'The HAR was exported before any network requests were made.',
      'The browser Network tab had recording paused during the capture.',
      'Filters in DevTools excluded all entries from the export.',
    ],
    fix: [
      'Ensure the Network tab is recording (red dot) before navigating to the page.',
      'Clear filters in the Network tab before exporting.',
      'Reload the page with the Network tab open, then re-export.',
    ],
    seeAlso: ['HAR002'],
  },
  HAR004: {
    title: 'HAR file exceeds size limit',
    what: 'The HAR file is too large to process safely.',
    when: [
      'The HAR was captured over a long session with thousands of requests.',
      'Response bodies are included and some responses are very large.',
      'Browser extensions injected additional requests into the capture.',
    ],
    fix: [
      'Capture a shorter session focused on the specific workflow you are analyzing.',
      'Export without response bodies if you only need timing data.',
      'Use the CLI instead of the browser UI for very large files.',
      'Disable browser extensions before capturing to reduce noise.',
    ],
    seeAlso: [],
  },
  RULE001: {
    title: 'Invalid YAML syntax',
    what: 'The rule file could not be parsed as valid YAML.',
    when: [
      'Indentation is inconsistent (mixed tabs and spaces).',
      'A string value contains a colon or special character without quotes.',
      'A block scalar (`|` or `>`) is malformed.',
    ],
    fix: [
      'Use a YAML linter (e.g., `yamllint`) to find syntax errors.',
      'Ensure consistent indentation (2 spaces recommended).',
      'Quote string values that contain special characters: `: { } [ ] , & * # ? | - < > = ! % @ \\`',
    ],
    seeAlso: ['RULE004'],
  },
  RULE002: {
    title: 'Unknown field path',
    what: 'A condition references a field path that does not exist on NormalizedEntry.',
    when: [
      'Typo in the field name (e.g., `timing.wait` instead of `timings.wait`).',
      'Using a raw HAR field without the `entry.` prefix (e.g., `request.url` instead of `entry.request.url`).',
      'The field path does not match any known property.',
    ],
    fix: [
      'Check the field path against the [rule reference](../rules/reference.md#field-paths).',
      'Common paths: `timings.wait`, `timings.blocked`, `entry.request.url`, `entry.response.status`, `resourceType`.',
      'The validator may suggest the correct field name if it is close to a known path.',
    ],
    seeAlso: ['RULE007'],
  },
  RULE003: {
    title: 'Circular inheritance',
    what: 'The rule\'s `inherits` chain forms a cycle (A inherits B, B inherits A).',
    when: [
      'Two or more shared conditions reference each other in their inheritance.',
      'A rule inherits a condition that eventually inherits back to the rule.',
    ],
    fix: [
      'Remove the circular reference in the `inherits` chain.',
      'Flatten the conditions: inline the shared condition instead of inheriting it.',
    ],
    seeAlso: ['RULE006'],
  },
  RULE004: {
    title: 'Invalid rule schema',
    what: 'A rule is missing required fields or has invalid field types.',
    when: [
      'Missing one of: `category`, `severity`, `title`, `description`, `recommendation`.',
      'The rule value is not an object (e.g., a string or number).',
      'The file is missing the top-level `rules:` key.',
      'An unknown field name is used on the rule (typo in a field name).',
    ],
    fix: [
      'Ensure every rule has all 5 required fields: `category`, `severity`, `title`, `description`, `recommendation`.',
      'Run `har-o-scope validate` to see exactly which fields are missing.',
      'See the [rule reference](../rules/reference.md) for all valid fields.',
    ],
    seeAlso: ['RULE001', 'RULE008'],
  },
  RULE005: {
    title: 'Contradictory conditions',
    what: 'The rule\'s conditions can never match any entry because they contradict each other.',
    when: [
      'Numeric range conflict: `gt: 100` and `lt: 50` on the same field.',
      'Impossible enum: `in: [1, 2]` and `not_in: [1, 2]` on the same field.',
      'Inherited conditions conflict with the rule\'s own conditions.',
    ],
    fix: [
      'Review the condition tree and remove the contradiction.',
      'Check inherited conditions for conflicts with the rule\'s conditions.',
      'Use `match_any` instead of `match_all` if the conditions should be alternatives.',
    ],
    seeAlso: ['RULE006'],
  },
  RULE006: {
    title: 'Condition nesting too deep',
    what: 'The condition tree exceeds 5 levels of nesting.',
    when: [
      'Deeply nested `match_all` / `match_any` groups.',
      'Complex inherited conditions that add nesting depth.',
    ],
    fix: [
      'Simplify the condition tree by flattening nested groups.',
      'Extract common conditions into shared conditions and use `inherits`.',
      'Break the rule into multiple simpler rules if the logic is too complex.',
    ],
    seeAlso: ['RULE003', 'RULE005'],
  },
  RULE007: {
    title: 'Unknown operator',
    what: 'A field condition uses an operator that does not exist.',
    when: [
      'Typo in the operator name (e.g., `greater_than` instead of `gt`).',
      'Using an operator from a different tool or language.',
    ],
    fix: [
      'Valid operators: `equals`, `not_equals`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `matches`, `not_matches`.',
      'See the [rule reference](../rules/reference.md#operators) for details.',
    ],
    seeAlso: ['RULE002'],
  },
  RULE008: {
    title: 'Invalid severity value',
    what: 'The rule\'s `severity` field is not a valid severity level.',
    when: [
      'Using a non-standard severity like `error`, `high`, `low`, `medium`.',
      'Typo in the severity name.',
    ],
    fix: [
      'Valid severity values: `info`, `warning`, `critical`.',
      'Note: there is no `error` severity. Use `critical` for the highest level.',
    ],
    seeAlso: ['RULE004'],
  },
  CLI001: {
    title: 'File not found',
    what: 'The specified HAR file does not exist at the given path.',
    when: [
      'Typo in the file path.',
      'The file was moved or deleted.',
      'Relative path does not resolve from the current working directory.',
    ],
    fix: [
      'Check that the file path is correct.',
      'Use an absolute path to avoid ambiguity.',
      'Run `ls` or `dir` to verify the file exists.',
    ],
    seeAlso: [],
  },
  CLI002: {
    title: 'Invalid CLI arguments',
    what: 'The command-line arguments could not be parsed.',
    when: [
      'Unknown flag or option.',
      'Missing required argument (e.g., file path for `analyze`).',
      'Invalid value for an option (e.g., non-numeric threshold).',
    ],
    fix: [
      'Run `har-o-scope --help` or `har-o-scope <command> --help` to see valid options.',
      'Check for typos in flag names.',
    ],
    seeAlso: [],
  },
}

// ── Parse error codes from source ─────────────────────────────────

async function parseErrorCodes(src) {
  const content = await readFile(src, 'utf-8')
  const codes = []

  // Match: /** JSDoc comment */\n  CODE: 'CODE',
  const pattern = /\/\*\*\s*(.+?)\s*\*\/\s*\n\s*(\w+):\s*'(\w+)'/g
  let match
  while ((match = pattern.exec(content)) !== null) {
    const [, description, key, value] = match
    if (key !== value) continue // sanity check
    codes.push({ code: key, description: description.trim() })
  }

  return codes
}

// ── Generate markdown ─────────────────────────────────────────────

function generateDoc(code, description, meta) {
  const category = code.startsWith('HAR')
    ? 'HAR Parse/Validation'
    : code.startsWith('RULE')
      ? 'Rule Engine'
      : 'CLI'

  const seeAlso = meta.seeAlso.length > 0
    ? meta.seeAlso.map(c => `- [${c}: ${META[c]?.title ?? c}](${c}.md)`).join('\n')
    : 'None'

  return `# ${code}: ${meta.title}

**Category:** ${category}
**Description:** ${description}

## What happened

${meta.what}

## When does this occur

${meta.when.map(w => `- ${w}`).join('\n')}

## How to fix

${meta.fix.map(f => `- ${f}`).join('\n')}

## See also

${seeAlso}
`
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const codes = await parseErrorCodes(ERRORS_SRC)

  if (codes.length === 0) {
    console.error('No error codes found in', ERRORS_SRC)
    process.exit(1)
  }

  await mkdir(DOCS_DIR, { recursive: true })

  let generated = 0
  const missing = []

  for (const { code, description } of codes) {
    const meta = META[code]
    if (!meta) {
      missing.push(code)
      continue
    }
    const content = generateDoc(code, description, meta)
    await writeFile(resolve(DOCS_DIR, `${code}.md`), content, 'utf-8')
    generated++
  }

  console.log(`Generated ${generated} error docs in docs/errors/`)

  if (missing.length > 0) {
    console.warn(`Missing metadata for: ${missing.join(', ')}`)
    console.warn('Add entries to META in this script.')
    process.exit(1)
  }

  // Generate index
  const index = `# Error Reference\n\nhar-o-scope error codes and how to fix them.\n\n| Code | Title | Category |\n| ---- | ----- | -------- |\n${codes.map(({ code }) => {
    const meta = META[code]
    const cat = code.startsWith('HAR') ? 'HAR' : code.startsWith('RULE') ? 'Rule' : 'CLI'
    return `| [${code}](${code}.md) | ${meta?.title ?? '?'} | ${cat} |`
  }).join('\n')}\n`

  await writeFile(resolve(DOCS_DIR, 'README.md'), index, 'utf-8')
  console.log('Generated docs/errors/README.md index')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
