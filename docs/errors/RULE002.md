# RULE002: Unknown field path

**Category:** Rule Engine
**Description:** Unknown field path in rule condition

## What happened

A condition references a field path that does not exist on NormalizedEntry.

## When does this occur

- Typo in the field name (e.g., `timing.wait` instead of `timings.wait`).
- Using a raw HAR field without the `entry.` prefix (e.g., `request.url` instead of `entry.request.url`).
- The field path does not match any known property.

## How to fix

- Check the field path against the [rule reference](../rules/reference.md#field-paths).
- Common paths: `timings.wait`, `timings.blocked`, `entry.request.url`, `entry.response.status`, `resourceType`.
- The validator may suggest the correct field name if it is close to a known path.

## See also

- [RULE007: Unknown operator](RULE007.md)
