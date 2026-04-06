# RULE004: Invalid rule schema

**Category:** Rule Engine
**Description:** Invalid rule schema (missing required fields)

## What happened

A rule is missing required fields or has invalid field types.

## When does this occur

- Missing one of: `category`, `severity`, `title`, `description`, `recommendation`.
- The rule value is not an object (e.g., a string or number).
- The file is missing the top-level `rules:` key.
- An unknown field name is used on the rule (typo in a field name).

## How to fix

- Ensure every rule has all 5 required fields: `category`, `severity`, `title`, `description`, `recommendation`.
- Run `har-o-scope validate` to see exactly which fields are missing.
- See the [rule reference](../rules/reference.md) for all valid fields.

## See also

- [RULE001: Invalid YAML syntax](RULE001.md)
- [RULE008: Invalid severity value](RULE008.md)
