Collaboration Graph - Transformation & Visualization SPEC

Goal
- Aggregate raw collaboration events (commits, reviews, pull_requests, issues) into a graph suitable for a force-directed layout.

Input event row (generic):
{
  actor: string,     // initiating user
  other: string,     // counterpart user (author->reviewer, assignee->reporter etc.)
  type: string,      // commit|review|pull_request|issue (or variants)
  timestamp: string, // ISO timestamp
  ...raw            // additional metadata such as pr_id, sha
}

Aggregation rules
- Nodes: each unique username/id in actor or other becomes a node { id }
- Links: aggregate by undirected pair key `a||b` (lexicographic ordering)
  - types: counts per bucket
    * commits: number
    * reviews: number
    * pullRequests: number
    * issues: number
  - first: earliest event timestamp (ms since epoch)
  - last: latest event timestamp (ms since epoch)
  - events: array of raw event rows (kept for details)
  - weight: composite numeric weight computed as sum(types[bucket] * weightConfig[bucket])

Default weightConfig (overridable from `formData.typeWeights`):
- commit: 1
- review: 2
- pull_request: 3
- issue: 0.5

Visualization mapping
- Node size: proportional to node activity = sum of all events touching node (commits+reviews+pullRequests+issues)
- Node color: by role if available (maintainer / contributor), otherwise default color
- Link thickness: proportional to `weight`
- Link color: encoded by dominant type (the type with highest count) using palette:
  - commit: blue
  - review: green
  - pull_request: orange
  - issue: grey

Interactivity
- clicking a node shows detailed panel with per-type counts and sample events (from `events`)
- filters: by type checkbox, time window, min-edge threshold (in controlPanel -> passed via `formData`)

Time handling
- `transformProps` will produce `first`/`last` per link; front-end can filter links by overlap with selected time segment or transformProps can itself pre-filter rows by formData time window.

Notes
- Aggregation is currently undirected. If directed edges are desired, change the keying strategy and preserve direction in link objects.
- For large datasets, perform server-side aggregation and return pre-aggregated `nodes`/`links` to the viz for performance.
