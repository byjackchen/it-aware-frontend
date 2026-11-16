# Insights Module API Specifications

## Overview
Insights domain stores LLM-derived analysis results and ML-computed worker clustering.

- Analysis table: `insights.analysiss`
- Worker Clusters table: `insights.worker_clusters`

## Security Model
All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Analysis | `objects:analysiss:read` | `objects:analysiss:write` |
| Worker Clusters | `objects:worker_clusters:read` | `objects:worker_clusters:write` |

### ABAC Filtering

Both Analysis and Worker Cluster read endpoints use **ABAC row-level filtering** anchored on the worker's organization hierarchy:

- **Anchor**: `WORKER_ORG` — resolves `worker_oid` → `Worker.org_oid` → organization hierarchy node
- **Unconstrained** users see all records
- **Self-scoped** users see only records where `worker_oid` matches their linked worker
- **Role-based** users see records for workers within their assigned organization hierarchy

Write endpoints (POST create, POST bulk) do not apply ABAC filtering — permission checks only. GET/PUT/DELETE on individual records return `403` if the record exists but the requester lacks scope access.

## Data Models

### Analysis (`insights.analysiss`)
- `oid` — BYTEA(16), primary key (ULID)
- `worker_oid` — BYTEA(16), FK to `objects.workers.oid`, NOT NULL
- `source_type` — Text, NOT NULL. Constraint: `IN ('survey')`
- `source_oid` — BYTEA(16), NOT NULL. Polymorphic reference to the source object
- `source_batch_oid` — BYTEA(16), nullable. Reference to the source batch (e.g., survey batch OID)
- `topic` — Text, NOT NULL. Short noun phrase identifying the analysis topic
- `created_at` — DateTime(tz), server_default=now()
- `updated_at` — DateTime(tz), server_default=now()
- `effective_at` — DateTime(tz), server_default=now(). Business timestamp representing when the source event occurred (e.g., survey `updated_at`)
- `keywords` — JSONB, nullable. List of keyword strings
- `fact` — Text, nullable. Concise factual summary statement for the topic
- `semantic` — Text, nullable. Constraint: `IN ('positive', 'negative')` or NULL
- `intent` — Text, nullable. Constraint: `IN ('request', 'bug', 'complaint', 'praise', 'suggestion')` or NULL
- `service_catalog_oid` — BYTEA(16), FK to `hierarchies.nodes.oid`, nullable
- `configuration_item_oid` — BYTEA(16), FK to `hierarchies.nodes.oid`, nullable

Constraints:
- `UNIQUE(source_type, source_oid, topic)` — prevents duplicate analysis per source+topic

Indexes:
- `analysiss_worker_oid_idx` on `(worker_oid)`
- `analysiss_source_idx` on `(source_type, source_oid, topic)`
- `analysiss_source_batch_oid_idx` on `(source_batch_oid)`
- `analysiss_created_at_idx` on `(created_at DESC)`
- `analysiss_effective_at_idx` on `(effective_at DESC)`

## Object APIs

### Analysis APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/insights/analysiss` | Create analysis | `objects:analysiss:write` |
| GET | `/objects/insights/analysiss` | List analysiss with filters | `objects:analysiss:read` |
| GET | `/objects/insights/analysiss/{analysis_oid}` | Get analysis by OID | `objects:analysiss:read` |
| PUT | `/objects/insights/analysiss/{analysis_oid}` | Update analysis | `objects:analysiss:write` |
| DELETE | `/objects/insights/analysiss/{analysis_oid}` | Delete analysis | `objects:analysiss:write` |

### POST `/objects/insights/analysiss`

Create a new analysis. Returns 409 if an analysis already exists for the same `source_type + source_oid + topic`.

Request body:
```json
{
  "worker_oid": "<base64url OID>",
  "source_type": "survey",
  "source_oid": "<base64url OID>",
  "source_batch_oid": "<base64url OID or null>",
  "topic": "VPN",
  "effective_at": "2026-03-04T12:00:00Z",
  "keywords": ["VPN", "Connection"],
  "fact": "VPN connection drops frequently during peak hours",
  "semantic": "negative",
  "intent": "bug",
  "service_catalog_oid": "<base64url OID or null>",
  "configuration_item_oid": "<base64url OID or null>"
}
```

Response (201):
```json
{
  "oid": "<base64url OID>",
  "worker_oid": "<base64url OID>",
  "source_type": "survey",
  "source_oid": "<base64url OID>",
  "source_batch_oid": "<base64url OID or null>",
  "topic": "VPN",
  "created_at": "2026-03-04T12:00:00Z",
  "updated_at": "2026-03-04T12:00:00Z",
  "effective_at": "2026-03-04T12:00:00Z",
  "keywords": ["VPN", "Connection"],
  "fact": "VPN connection drops frequently during peak hours",
  "semantic": "negative",
  "intent": "bug",
  "service_catalog_oid": "<base64url OID or null>",
  "configuration_item_oid": "<base64url OID or null>"
}
```

Error (409): duplicate `source_type + source_oid + topic`.

### GET `/objects/insights/analysiss`

List analysiss with pagination and optional filters.

Query parameters:
- `worker_oid` (optional) — filter by worker OID
- `source_type` (optional) — filter by source type (e.g., `survey`)
- `source_oid` (optional) — filter by source OID
- `source_batch_oid` (optional) — filter by source batch OID
- `topic` (optional) — filter by topic
- `semantic` (optional) — filter by semantic (`positive` or `negative`)
- `intent` (optional) — filter by intent (`request`, `bug`, `complaint`, `praise`, `suggestion`)
- `effective_at_from` (optional) — lower bound for `effective_at`
- `effective_at_to` (optional) — upper bound for `effective_at`
- `skip` (default 0, min 0)
- `limit` (default 100, min 1, max 1000)

Response (200):
```json
{
  "items": [ ... ],
  "total": 42,
  "skip": 0,
  "limit": 100
}
```

Ordering: `created_at DESC, oid DESC`.

### GET `/objects/insights/analysiss/{analysis_oid}`

Response (200): single `AnalysisResponse`.
Error (404): analysis not found.

### PUT `/objects/insights/analysiss/{analysis_oid}`

Update analysis fields. Only provided fields are updated. `topic` is NOT updatable (part of composite key).

Request body:
```json
{
  "keywords": ["updated_keyword"],
  "fact": "Updated factual summary",
  "semantic": "negative",
  "intent": "complaint",
  "service_catalog_oid": "<base64url OID>",
  "configuration_item_oid": "<base64url OID>"
}
```

Response (200): updated `AnalysisResponse`.
Error (404): analysis not found.

### DELETE `/objects/insights/analysiss/{analysis_oid}`

Response (204): no content.
Error (404): analysis not found.

---

## Data Models (continued)

### Worker Cluster (`insights.worker_clusters`)

Retired 2026-11-16: the DAG `analyze-worker-clusters` and the Worker Cluster APIs (`/objects/insights/worker-clusters`) were removed. The table keeps its last run and is dropped one release later.

## Error Codes

| Code | Condition |
|------|-----------|
| 200 | Success (GET/PUT/POST bulk) |
| 201 | Created successfully (POST analysis) |
| 204 | Deleted successfully |
| 403 | ABAC access denied (record exists but outside requester's scope) |
| 404 | Resource not found |
| 409 | Duplicate source_type + source_oid + topic (analysis) |
| 422 | Validation error (invalid OID, invalid field value) |
