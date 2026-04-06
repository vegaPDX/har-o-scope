# Tutorial: Your First Rule

This guide walks you through writing a custom detection rule for har-o-scope.

## Prerequisites

- har-o-scope installed (`npm install har-o-scope` or use `npx`)
- A HAR file to test against (or use `--demo`)

## Step 1: Create a rule file

Create `my-rules.yaml`:

```yaml
rules:
  slow-api:
    category: server
    severity: warning
    title: "{count} slow API response{s}"
    description: "API requests to /api/ took over 2 seconds."
    recommendation: "Check server logs for slow queries or timeouts."
    condition:
      match_all:
        - field: "entry.request.url"
          matches: "/api/"
        - field: "timings.wait"
          gt: 2000
```

Every rule needs:
- **id** (the YAML key, e.g. `slow-api`)
- **category** and **severity**
- **title**, **description**, **recommendation** (user-facing text)
- **condition** (what to match)

## Step 2: Validate it

```bash
npx har-o-scope validate my-rules.yaml
```

The validator checks YAML syntax, required fields, valid operators, and field paths. If something is wrong, it tells you exactly what and how to fix it.

## Step 3: Test it

```bash
npx har-o-scope analyze recording.har --rules my-rules.yaml
```

Your custom rules run alongside the 17 built-in rules. If any entries match your condition, you'll see your finding in the output.

## Step 4: Add severity escalation

If 10+ entries match, escalate from warning to critical:

```yaml
rules:
  slow-api:
    category: server
    severity: warning
    severity_escalation:
      critical_threshold: 10
    title: "{count} slow API response{s}"
    description: "API requests to /api/ took over 2 seconds."
    recommendation: "Check server logs for slow queries or timeouts."
    condition:
      match_all:
        - field: "entry.request.url"
          matches: "/api/"
        - field: "timings.wait"
          gt: 2000
```

## Step 5: Add impact scoring

Tell the health score how much this matters:

```yaml
    impact:
      field: "timings.wait"
      baseline: 200
    root_cause_weight:
      server: 3
```

- `impact.field`: which timing to measure the damage by
- `impact.baseline`: the "normal" value in ms (excess above this counts as impact)
- `root_cause_weight`: how strongly this finding shifts the root cause classification

## Step 6: Reuse shared conditions

Instead of repeating "not a WebSocket, not a long-poll" in every rule, use `inherits`:

```yaml
rules:
  slow-api:
    inherits: ["is_not_streaming", "is_not_websocket"]
    category: server
    severity: warning
    # ... rest of the rule
```

The shared conditions `is_not_streaming` and `is_not_websocket` are defined in `rules/generic/shared/base-conditions.yaml`. You can define your own in a separate YAML file.

## Step 7: Exclude noise

Filter out analytics and tracking requests:

```yaml
rules:
  slow-api:
    exclude: ["analytics_tracking"]
    # ... rest of the rule
```

The `analytics_tracking` filter matches Google Analytics, Mixpanel, Facebook Pixel, etc. Defined in `rules/generic/shared/filters.yaml`.

## Next steps

- [Cookbook](cookbook.md) for common patterns (header checks, aggregate rules, response body matching)
- [Reference](reference.md) for all available fields, operators, and options
