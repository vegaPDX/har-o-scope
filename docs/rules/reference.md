# Rule Reference

Complete reference for har-o-scope YAML rule definitions.

## File structure

A rules file has a top-level `rules` key containing named rule definitions:

```yaml
rules:
  rule-id:
    # ... rule fields
  another-rule:
    # ... rule fields
```

## Rule fields

### Required

| Field | Type | Description |
| ----- | ---- | ----------- |
| `category` | string | `server`, `network`, `client`, `optimization`, `security`, `errors`, `performance`, or `informational` |
| `severity` | string | `info`, `warning`, or `critical` |
| `title` | string | Finding title. Supports `{count}` and `{s}` interpolation. |
| `description` | string | Detailed description of the finding. |
| `recommendation` | string | How to fix the issue. |

### Optional

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `condition` | object | — | Entry-level match condition (see [Conditions](#conditions)) |
| `type` | string | `per_entry` | `per_entry` (match individual entries) or `aggregate` (count matching entries) |
| `aggregate_condition` | object | — | For `type: aggregate`. See [Aggregate](#aggregate-condition). |
| `prerequisite` | object | — | Skip rule unless at least one entry matches. See [Prerequisite](#prerequisite). |
| `severity_escalation` | object | — | Promote severity based on count or ratio. See [Escalation](#severity-escalation). |
| `impact` | object | — | Configure health score impact. See [Impact](#impact). |
| `root_cause_weight` | object | — | Influence root cause classification. See [Root Cause Weight](#root-cause-weight). |
| `inherits` | string[] | `[]` | Names of shared conditions to merge into this rule's condition. |
| `exclude` | string[] | `[]` | Names of filters. Matching entries are skipped. |
| `min_count` | number | `1` | Minimum matching entries before firing. |

## Conditions

Conditions define what entries a rule matches. Two grouping operators:

### match_all (AND)

Every child condition must be true:

```yaml
condition:
  match_all:
    - field: "timings.wait"
      gt: 1000
    - field: "entry.response.status"
      gte: 200
```

### match_any (OR)

At least one child condition must be true:

```yaml
condition:
  match_any:
    - field: "entry.response.status"
      equals: 500
    - field: "entry.response.status"
      equals: 503
```

Groups can be nested:

```yaml
condition:
  match_all:
    - field: "timings.wait"
      gt: 500
    - match_any:
        - field: "entry.response.status"
          in: [500, 502, 503]
        - field: "entry.response.status"
          equals: 0
```

Maximum nesting depth: 5 levels.

## Field conditions

### Operators

| Operator | Type | Description |
| -------- | ---- | ----------- |
| `equals` | any | Exact equality |
| `not_equals` | any | Not equal |
| `in` | array | Value is in the list |
| `not_in` | array | Value is not in the list |
| `gt` | number | Greater than |
| `gte` | number | Greater than or equal |
| `lt` | number | Less than |
| `lte` | number | Less than or equal |
| `matches` | string | Regex match (case-insensitive) |
| `not_matches` | string | Regex does not match |

Multiple operators on the same field condition are AND-ed together.

### Field paths

Fields are dot-notation paths into the normalized entry. The root object is a `NormalizedEntry`.

**Timing fields** (in milliseconds, `-1` replaced with `0`):

| Path | Description |
| ---- | ----------- |
| `timings.blocked` | Time spent in browser queue |
| `timings.dns` | DNS lookup time |
| `timings.connect` | TCP connection time |
| `timings.ssl` | TLS handshake time |
| `timings.send` | Time to send the request |
| `timings.wait` | Time to First Byte (TTFB) |
| `timings.receive` | Time to download the response |
| `timings.total` | Sum of all phases |

**Entry metadata:**

| Path | Description |
| ---- | ----------- |
| `resourceType` | `document`, `script`, `stylesheet`, `image`, `font`, `media`, `xhr`, `fetch`, `websocket`, `other` |
| `httpVersion` | HTTP version string (e.g., `HTTP/2.0`, `HTTP/1.1`) |
| `isLongPoll` | `true` if detected as long-polling/SSE |
| `isWebSocket` | `true` if detected as WebSocket |
| `transferSizeResolved` | Transfer size in bytes (with fallback chain) |
| `contentSize` | Response content size in bytes |
| `startTimeMs` | Start time relative to first entry (ms) |
| `totalDuration` | Total request duration (ms) |

**Raw HAR entry fields** (via `entry.` prefix):

| Path | Description |
| ---- | ----------- |
| `entry.request.url` | Full request URL |
| `entry.request.method` | HTTP method (GET, POST, etc.) |
| `entry.response.status` | HTTP status code |
| `entry.response.content.mimeType` | Response MIME type |
| `entry.response.content.size` | Response body size |

### Field fallback

Use `field_fallback` when a field might not exist:

```yaml
- field: "entry.response._transferSize"
  field_fallback: "entry.response.content.size"
  gt: 1048576
```

## Response header conditions

### has_response_header

Check that a response header exists and optionally matches:

```yaml
- has_response_header:
    name: "cache-control"          # Header name (case-insensitive)
    value_matches: "max-age=\\d+"  # Optional: regex match on value
    value_gt: 3600                 # Optional: parse as number, check > N
    value_lt: 86400                # Optional: parse as number, check < N
```

### no_response_header

Check that a response header is absent:

```yaml
- no_response_header:
    name: "strict-transport-security"
    value_matches: "max-age"       # Optional: absent OR doesn't match
```

## Severity escalation

Promote severity based on how many entries match:

```yaml
severity_escalation:
  warning_threshold: 5     # >= 5 matches -> warning
  critical_threshold: 20   # >= 20 matches -> critical
  warning_ratio: 0.1       # >= 10% of entries -> warning
  critical_ratio: 0.5      # >= 50% of entries -> critical
```

Thresholds and ratios are both checked. The highest resulting severity wins.

## Impact

Controls how much this finding affects the health score:

```yaml
impact:
  field: "timings.wait"   # Which field to measure
  baseline: 200           # "Normal" value in ms
  value: 10               # Or a fixed impact value
```

If `field` is set, impact = sum of (actual - baseline) across affected entries.
If `value` is set, impact = value * count of affected entries.

## Root cause weight

Influence the root cause classifier:

```yaml
root_cause_weight:
  server: 3    # Strongly implies server issue
  network: 1   # Weakly implies network issue
  client: 0    # No client implication
```

Weights are summed across all findings. The category with the highest total is the root cause.

## Aggregate condition

For `type: aggregate` rules, fire based on total count:

```yaml
type: aggregate
aggregate_condition:
  min_entries: 200
```

The rule fires if >= 200 entries match the condition.

## Prerequisite

Skip the rule entirely unless the HAR contains at least one matching entry:

```yaml
prerequisite:
  any_entry_matches:
    field: "entry.request.url"
    matches: "/api/"
```

Useful to avoid false positives when a rule is irrelevant to the HAR content.

## Shared conditions

Define reusable condition fragments in a separate YAML file:

```yaml
# conditions.yaml
conditions:
  is_api_request:
    field: "entry.request.url"
    matches: "/api/v[0-9]+"

  is_json_response:
    field: "entry.response.content.mimeType"
    matches: "application/json"
```

Reference them with `inherits`:

```yaml
rules:
  slow-json-api:
    inherits: ["is_api_request", "is_json_response"]
    # ...
```

Inherited conditions are merged into the rule's `match_all` group.

## Filters

Define noise patterns to exclude:

```yaml
# filters.yaml
filters:
  analytics_tracking:
    field: "entry.request.url"
    matches: "google-analytics|mixpanel|segment\\.io"
```

Reference them with `exclude`:

```yaml
rules:
  slow-requests:
    exclude: ["analytics_tracking"]
    # ...
```

Entries matching any exclude filter are skipped before condition evaluation.

## Title interpolation

The `title`, `description`, and `recommendation` fields support these placeholders:

| Placeholder | Replaced with |
| ----------- | ------------- |
| `{count}` | Number of affected entries |
| `{s}` | Empty string if count is 1, `"s"` otherwise |

Example: `"{count} slow request{s}"` becomes `"3 slow requests"` or `"1 slow request"`.
