# RULE003: Circular inheritance

**Category:** Rule Engine
**Description:** Circular inheritance in rule composition

## What happened

The rule's `inherits` chain forms a cycle (A inherits B, B inherits A).

## When does this occur

- Two or more shared conditions reference each other in their inheritance.
- A rule inherits a condition that eventually inherits back to the rule.

## How to fix

- Remove the circular reference in the `inherits` chain.
- Flatten the conditions: inline the shared condition instead of inheriting it.

## See also

- [RULE006: Condition nesting too deep](RULE006.md)
