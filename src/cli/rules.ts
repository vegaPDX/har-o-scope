/**
 * YAML rule loading for CLI.
 * Reads rules from the package's rules/ directory at runtime.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { setBuiltinRules } from '../lib/analyze.js'
import type { IssueRulesFile, SharedConditionsFile, FiltersFile } from '../lib/schema.js'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

export async function loadBuiltinRules(): Promise<void> {
  const packageRoot = resolve(__dirname, '..', '..')
  const rulesDir = join(packageRoot, 'rules', 'generic')

  const rulesYaml = await readFile(join(rulesDir, 'issue-rules.yaml'), 'utf-8')
  const conditionsYaml = await readFile(join(rulesDir, 'shared', 'base-conditions.yaml'), 'utf-8')
  const filtersYaml = await readFile(join(rulesDir, 'shared', 'filters.yaml'), 'utf-8')

  const rules = yaml.load(rulesYaml) as IssueRulesFile
  const conditions = yaml.load(conditionsYaml) as SharedConditionsFile
  const filters = yaml.load(filtersYaml) as FiltersFile

  setBuiltinRules(rules, conditions, filters)
}

export async function loadCustomRules(path: string): Promise<unknown[]> {
  const info = await stat(path)
  if (info.isDirectory()) {
    const files = await readdir(path)
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    const results: unknown[] = []
    for (const file of yamlFiles) {
      const content = await readFile(join(path, file), 'utf-8')
      results.push(yaml.load(content))
    }
    return results
  }
  const content = await readFile(path, 'utf-8')
  return [yaml.load(content)]
}
