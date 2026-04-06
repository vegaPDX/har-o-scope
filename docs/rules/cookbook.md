# Rule Cookbook

Common patterns for custom har-o-scope rules. Copy, paste, adjust.

## Check for a missing response header

```yaml
rules:
  missing-hsts:
    category: security
    severity: warning
    title: "{count} response{s} missing HSTS header"
    description: "Responses missing Strict-Transport-Security header."
    recommendation: "Add HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains"
    condition:
      match_all:
        - no_response_header:
            name: "strict-transport-security"
```

## Check for a response header with a specific value

```yaml
rules:
  weak-cache:
    category: optimization
    severity: info
    title: "{count} response{s} with short cache TTL"
    description: "Static resources have cache TTL under 1 hour."
    recommendation: "Use longer cache durations for static assets with content hashes."
    inherits: ["is_static_resource"]
    condition:
      match_all:
        - has_response_header:
            name: "cache-control"
            value_lt: 3600
```

## Match URLs by pattern

```yaml
rules:
  graphql-requests:
    category: informational
    severity: info
    title: "{count} GraphQL request{s}"
    description: "GraphQL requests detected."
    recommendation: "Review for N+1 patterns and query complexity."
    condition:
      match_all:
        - field: "entry.request.url"
          matches: "/graphql"
        - field: "entry.request.method"
          equals: "POST"
```

## Combine multiple conditions (AND)

`match_all` requires every condition to be true:

```yaml
    condition:
      match_all:
        - field: "timings.wait"
          gt: 1000
        - field: "entry.response.status"
          gte: 200
        - field: "entry.response.status"
          lt: 300
```

## Match any condition (OR)

`match_any` requires at least one condition to be true:

```yaml
    condition:
      match_any:
        - field: "entry.response.status"
          equals: 500
        - field: "entry.response.status"
          equals: 502
        - field: "entry.response.status"
          equals: 503
```

Or use `in` for the same thing:

```yaml
    condition:
      match_all:
        - field: "entry.response.status"
          in: [500, 502, 503]
```

## Aggregate rule (count-based)

Fire only when the total number of matching entries exceeds a threshold:

```yaml
rules:
  too-many-images:
    category: optimization
    severity: warning
    type: aggregate
    aggregate_condition:
      min_entries: 50
    title: "{count} images loaded"
    description: "Page loaded over 50 images."
    recommendation: "Lazy-load below-the-fold images. Use sprites or CSS for icons."
    condition:
      match_all:
        - field: "resourceType"
          equals: "image"
```

## Prerequisite (only fire if another condition exists)

Only check for slow APIs if the HAR actually contains API calls:

```yaml
rules:
  slow-api:
    category: server
    severity: warning
    prerequisite:
      any_entry_matches:
        field: "entry.request.url"
        matches: "/api/"
    title: "{count} slow API call{s}"
    description: "API calls exceeding 1 second."
    recommendation: "Investigate server-side latency."
    condition:
      match_all:
        - field: "entry.request.url"
          matches: "/api/"
        - field: "timings.wait"
          gt: 1000
```

## Exclude noise patterns

Skip analytics tracking and cancelled requests:

```yaml
rules:
  slow-requests:
    exclude: ["analytics_tracking", "status_0_or_cancelled"]
    category: performance
    severity: warning
    # ...
```

## Severity escalation with ratio

Escalate based on the percentage of affected entries:

```yaml
    severity_escalation:
      warning_ratio: 0.1    # 10% affected -> warning
      critical_ratio: 0.5   # 50% affected -> critical
```

Or by absolute count:

```yaml
    severity_escalation:
      warning_threshold: 5
      critical_threshold: 20
```

## Custom shared conditions

Create `my-conditions.yaml`:

```yaml
conditions:
  is_api_request:
    field: "entry.request.url"
    matches: "/api/v[0-9]+"

  is_large_response:
    field: "transferSizeResolved"
    gt: 500000
```

Then reference in rules:

```yaml
rules:
  slow-large-api:
    inherits: ["is_api_request", "is_large_response"]
    # ...
```

## Root cause weighting

Tell the classifier what this finding implies:

```yaml
    root_cause_weight:
      server: 3      # Strongly suggests server issue
      network: 0     # No network implication
      client: 0      # No client implication
```

Weights are relative. The classifier sums weights from all findings and picks the dominant category.
