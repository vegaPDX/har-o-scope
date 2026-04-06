# RULE008: Invalid severity value

**Category:** Rule Engine
**Description:** Invalid severity value

## What happened

The rule's `severity` field is not a valid severity level.

## When does this occur

- Using a non-standard severity like `error`, `high`, `low`, `medium`.
- Typo in the severity name.

## How to fix

- Valid severity values: `info`, `warning`, `critical`.
- Note: there is no `error` severity. Use `critical` for the highest level.

## See also

- [RULE004: Invalid rule schema](RULE004.md)
