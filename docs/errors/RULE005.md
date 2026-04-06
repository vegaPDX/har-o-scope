# RULE005: Contradictory conditions

**Category:** Rule Engine
**Description:** Contradictory conditions detected

## What happened

The rule's conditions can never match any entry because they contradict each other.

## When does this occur

- Numeric range conflict: `gt: 100` and `lt: 50` on the same field.
- Impossible enum: `in: [1, 2]` and `not_in: [1, 2]` on the same field.
- Inherited conditions conflict with the rule's own conditions.

## How to fix

- Review the condition tree and remove the contradiction.
- Check inherited conditions for conflicts with the rule's conditions.
- Use `match_any` instead of `match_all` if the conditions should be alternatives.

## See also

- [RULE006: Condition nesting too deep](RULE006.md)
