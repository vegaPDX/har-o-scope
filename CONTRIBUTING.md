# Contributing to har-o-scope

## Development Setup

```bash
git clone https://github.com/vegaPDX/har-o-scope.git
cd har-o-scope
npm install
```

Requirements: Node.js >= 20, npm >= 10.

### Project Structure

```
src/
  lib/          # Core analysis library (no DOM deps)
  cli/          # CLI tool (Node.js only)
  components/   # React components (browser only)
  hooks/        # React hooks
  workers/      # Web Worker for browser pipeline
rules/
  generic/      # Built-in YAML detection rules
test/
  lib/          # Library tests
  cli/          # CLI tests
```

## Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run lint          # TypeScript type check
npm run check         # Type check + tests
```

203 tests across 14 files. Tests run in ~1.5s.

## Development Workflow

```bash
npm run dev      # Start Vite dev server (browser UI)
npm run build    # Full build: browser + CLI + library
npm run preview  # Preview production build
```

The `build` script runs `vite build` (browser bundle) then `tsc -p tsconfig.cli.json` (CLI + library JS with declarations).

## Writing Rules

har-o-scope uses YAML rules in `rules/generic/`. To add a new rule:

1. Add your rule to `rules/generic/issue-rules.yaml`
2. Use shared conditions from `rules/generic/shared/base-conditions.yaml` via `inherits`
3. Use noise filters from `rules/generic/shared/filters.yaml` via `exclude`
4. Run the validator: `npx har-o-scope validate rules/generic/issue-rules.yaml`
5. Write a test in `test/lib/rule-engine.test.ts`

### Rule structure

```yaml
rules:
  my-rule-id:
    category: server | network | client | optimization | security | errors | performance
    severity: info | warning | critical
    title: "{count} descriptive title{s}"
    description: "What this means."
    recommendation: "How to fix it."
    condition:
      match_all:
        - field: "timings.wait"
          gt: 1000
```

See [docs/rules/reference.md](docs/rules/reference.md) for all available fields and operators.

### Contributing a rule pack

If you have domain-specific rules (e.g., for a particular framework or platform), consider contributing them as a separate YAML file in `rules/`. Open an issue first to discuss scope.

## Pull Request Process

1. Fork the repo, create a feature branch
2. Make your changes
3. Run `npm run check` (type check + full test suite)
4. Commit with a descriptive message
5. Open a PR against `main`

### Commit messages

Use conventional-ish prefixes:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` test additions or fixes
- `chore:` build, CI, tooling changes

### PR requirements

- All tests pass on all platforms (CI runs ubuntu, windows, macos)
- No TypeScript errors
- New features should include tests
- New rules should include a test case showing they fire on expected input

## Code Style

- TypeScript strict mode
- ESM (`import`/`export`, `.js` extensions in imports)
- No classes for data, plain objects + functions
- Library code (`src/lib/`) must have zero DOM dependencies
- Prefer explicit types over inference for public API functions

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0-only license.
