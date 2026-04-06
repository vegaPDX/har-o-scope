# RULE006: Condition nesting too deep

**Category:** Rule Engine
**Description:** Condition nesting too deep (>5 levels)

## What happened

The condition tree exceeds 5 levels of nesting.

## When does this occur

- Deeply nested `match_all` / `match_any` groups.
- Complex inherited conditions that add nesting depth.

## How to fix

- Simplify the condition tree by flattening nested groups.
- Extract common conditions into shared conditions and use `inherits`.
- Break the rule into multiple simpler rules if the logic is too complex.

## See also

- [RULE003: Circular inheritance](RULE003.md)
- [RULE005: Contradictory conditions](RULE005.md)
