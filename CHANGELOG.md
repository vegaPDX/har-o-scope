# Changelog

All notable changes to har-o-scope are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - Unreleased

First release. Complete analysis library, browser UI, and CLI.

### Added

**Core Library (Phase 1)**
- YAML-based rule engine with condition composition, inheritance, and filters
- 17 built-in detection rules covering server, network, optimization, security, and error categories
- HAR normalizer: parses HAR JSON, normalizes timings, classifies resource types
- Health score (0-100) with per-category deductions, timing/volume penalties
- HAR diff engine: before/after comparison with timing deltas and finding diffing
- Sanitizer: aggressive and selective modes for stripping secrets, tokens, PII
- Validator: YAML syntax, schema conformance, semantic analysis (contradictions, circular inheritance, nesting depth)
- Structured error system: HarError class with error codes, help text, and docs URLs

**Browser UI (Phase 2)**
- File upload with drag-and-drop (supports multiple HAR files for comparison)
- Summary dashboard: health score donut, metric cards, root cause classification
- Request table with virtual scrolling (handles 10k+ entries)
- Request detail panel: timing breakdown, headers, raw JSON
- SVG waterfall chart with zoom and pan
- Categorized findings view with severity badges and fix recommendations
- Compare dashboard for before/after HAR diff
- Rule editor with condition builder, field picker, severity config, YAML preview, test runner
- Advanced filter bar with text search, status/type/severity selectors, grouping
- Export to JSON, CSV, and Markdown
- Dark mode with system preference detection
- Keyboard shortcuts (? for help)
- Web Worker pipeline (analysis never blocks the UI)

**CLI (Phase 3)**
- `analyze` command with text, JSON, Markdown, SARIF, and CI output formats
- `diff` command for before/after HAR comparison
- `sanitize` command to strip secrets from HAR files
- `validate` command for HAR structure and custom rule validation
- Built-in demo HAR for trying without a real capture
- SARIF 2.1.0 output for GitHub Security tab integration
- GitHub Actions annotation mode (`--ci`)
- Exit codes: 0 (clean), 1 (warnings), 2 (critical/below threshold)
- Custom rules via `--rules` flag (file or directory)
- Colored terminal output with automatic TTY detection

**Infrastructure (Phase 4)**
- GitHub Actions CI: lint, test (ubuntu/windows/macos), build, bundle size budget, pack integration test
- npm publish workflow with provenance on release tags
- GitHub Pages deployment of browser UI
