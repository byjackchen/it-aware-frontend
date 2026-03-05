# Insights Module API Specifications

## Overview
Insights domain stores LLM-derived analysis results from source objects (e.g., surveys).

- Analysis table: `insights.analysiss`

## Security Model
All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Analysis | `objects:analysiss:read` | `objects:analysiss:write` |

## Data Models

### Analysis (`insights.analysiss`)
- `oid` — BYTEA(16), primary key (ULID)
- `worker_oid` — BYTEA(16), FK to `objects.workers.oid`, NOT NULL
- `source_type` — Text, NOT NULL. Constraint: `IN ('survey')`
- `source_oid` — BYTEA(16), NOT NULL. Polymorphic reference to the source object
- `created_at` — DateTime(tz), server_default=now()
- `updated_at` — DateTime(tz), server_default=now()
- `keywords` — JSONB, nullable. List of keyword strings
- `semantic` — Text, nullable. Constraint: `IN ('positive', 'negative')` or NULL
- `intent` — Text, nullable. Constraint: `IN ('request', 'bug', 'complaint', 'praise', 'suggestion')` or NULL
- `service_catalog_oid` — BYTEA(16), FK to `hierarchies.nodes.oid`, nullable
- `configuration_item_oid` — BYTEA(16), FK to `hierarchies.nodes.oid`, nullable

Constraints:
- `UNIQUE(source_type, source_oid)` — prevents duplicate analysis per source

Indexes:
- `analysiss_worker_oid_idx` on `(worker_oid)`
- `analysiss_source_idx` on `(source_type, source_oid)`
- `analysiss_created_at_idx` on `(created_at DESC)`

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

Create a new analysis. Returns 409 if an analysis already exists for the same `source_type + source_oid`.

Request body:
```json
{
  "worker_oid": "<base64url OID>",
  "source_type": "survey",
  "source_oid": "<base64url OID>",
  "keywords": ["keyword1", "keyword2"],
  "semantic": "positive",
  "intent": "suggestion",
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
  "created_at": "2026-03-04T12:00:00Z",
  "updated_at": "2026-03-04T12:00:00Z",
  "keywords": ["keyword1", "keyword2"],
  "semantic": "positive",
  "intent": "suggestion",
  "service_catalog_oid": "<base64url OID or null>",
  "configuration_item_oid": "<base64url OID or null>"
}
```

Error (409): duplicate `source_type + source_oid`.

### GET `/objects/insights/analysiss`

List analysiss with pagination and optional filters.

Query parameters:
- `worker_oid` (optional) — filter by worker OID
- `source_type` (optional) — filter by source type (e.g., `survey`)
- `source_oid` (optional) — filter by source OID
- `semantic` (optional) — filter by semantic (`positive` or `negative`)
- `intent` (optional) — filter by intent (`request`, `bug`, `complaint`, `praise`, `suggestion`)
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

Update analysis fields. Only provided fields are updated.

Request body:
```json
{
  "keywords": ["updated_keyword"],
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

## Error Codes

| Code | Condition |
|------|-----------|
| 201 | Created successfully |
| 200 | Success (GET/PUT) |
| 204 | Deleted successfully |
| 404 | Analysis not found |
| 409 | Duplicate source_type + source_oid |
| 422 | Validation error (invalid OID, invalid field value) |
