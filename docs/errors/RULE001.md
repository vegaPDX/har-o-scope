# RULE001: Invalid YAML syntax

**Category:** Rule Engine
**Description:** Invalid YAML syntax in rule file

## What happened

The rule file could not be parsed as valid YAML.

## When does this occur

- Indentation is inconsistent (mixed tabs and spaces).
- A string value contains a colon or special character without quotes.
- A block scalar (`|` or `>`) is malformed.

## How to fix

- Use a YAML linter (e.g., `yamllint`) to find syntax errors.
- Ensure consistent indentation (2 spaces recommended).
- Quote string values that contain special characters: `: { } [ ] , & * # ? | - < > = ! % @ \`

## See also

- [RULE004: Invalid rule schema](RULE004.md)
