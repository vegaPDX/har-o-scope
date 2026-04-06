# RULE007: Unknown operator

**Category:** Rule Engine
**Description:** Unknown operator in condition

## What happened

A field condition uses an operator that does not exist.

## When does this occur

- Typo in the operator name (e.g., `greater_than` instead of `gt`).
- Using an operator from a different tool or language.

## How to fix

- Valid operators: `equals`, `not_equals`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `matches`, `not_matches`.
- See the [rule reference](../rules/reference.md#operators) for details.

## See also

- [RULE002: Unknown field path](RULE002.md)
