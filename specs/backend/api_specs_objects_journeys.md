# Journeys Module API Specifications

## Overview
Journeys domain groups associated activities into meaningful scenario types (e.g., onboarding, travel, offboarding).

- Scenario table: `journeys.scenarios`

## Security Model
All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Scenario | `objects:scenarios:read` | `objects:scenarios:write` |

### ABAC Filtering

Scenario read endpoints use **ABAC row-level filtering** anchored on the worker's organization hierarchy:

- **Anchor**: `WORKER_ORG` — resolves `worker_oid` → `Worker.org_oid` → organization hierarchy node
- **Unconstrained** users see all scenarios
- **Self-scoped** users see only scenarios for their own linked worker
- **Role-based** users see scenarios for workers within their assigned organization hierarchy

POST create does not apply ABAC filtering. GET/PUT/DELETE on individual records return `403` if the record exists but the requester lacks scope access.

## Data Models

### Scenario (`journeys.scenarios`)
- `oid` — BYTEA(16), primary key (ULID)
- `worker_oid` — BYTEA(16), FK to `objects.workers.oid`, NOT NULL
- `scenario_type` — Text, NOT NULL. Constraint: `IN ('onboarding')`
- `scenario_profile` — JSONB, nullable. Holds description, notes, key_topics
- `effective_at` — DateTime(tz), NOT NULL. Business timestamp (e.g., hire_date for onboarding)
- `created_at` — DateTime(tz), server_default=now()
- `updated_at` — DateTime(tz), server_default=now()

Constraints:
- `UNIQUE(worker_oid, scenario_type, effective_at)` — prevents duplicate scenario per worker+type+date

Indexes:
- `scenarios_worker_oid_idx` on `(worker_oid)`
- `scenarios_scenario_type_idx` on `(scenario_type)`
- `scenarios_effective_at_idx` on `(effective_at DESC)`
- `scenarios_created_at_idx` on `(created_at DESC)`

## Schemas

### ScenarioCreate
- `worker_oid` (str, required) — base64url OID of the worker
- `scenario_type` (Literal["onboarding"], required)
- `scenario_profile` (dict, optional) — JSONB profile data
- `effective_at` (datetime, required) — business timestamp

### ScenarioUpdate
- `scenario_type` (Literal["onboarding"], optional)
- `scenario_profile` (dict, optional)

### ScenarioResponse
All fields from the model with OID-to-string conversion.

### ScenarioListResponse
- `items` — list of ScenarioResponse
- `total` — total count matching filters
- `skip` — pagination offset
- `limit` — page size

## Object APIs

### Scenario APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/journeys/scenarios` | Create scenario | `objects:scenarios:write` |
| GET | `/objects/journeys/scenarios` | List scenarios with filters | `objects:scenarios:read` |
| GET | `/objects/journeys/scenarios/{scenario_oid}` | Get scenario by OID | `objects:scenarios:read` |
| PUT | `/objects/journeys/scenarios/{scenario_oid}` | Update scenario | `objects:scenarios:write` |
| DELETE | `/objects/journeys/scenarios/{scenario_oid}` | Delete scenario | `objects:scenarios:write` |

### POST `/objects/journeys/scenarios`

Create a new scenario. Returns 409 if a scenario already exists for the same `worker_oid + scenario_type + effective_at`.

Request body:
```json
{
  "worker_oid": "<base64url OID>",
  "scenario_type": "onboarding",
  "scenario_profile": {
    "description": "New hire onboarding journey",
    "notes": "Multiple VPN and access issues in first week",
    "key_topics": ["VPN", "Email Setup", "Badge Access"]
  },
  "effective_at": "2026-03-01T00:00:00Z"
}
```

Response (201):
```json
{
  "oid": "<base64url OID>",
  "worker_oid": "<base64url OID>",
  "scenario_type": "onboarding",
  "scenario_profile": { ... },
  "effective_at": "2026-03-01T00:00:00Z",
  "created_at": "2026-03-15T12:00:00Z",
  "updated_at": "2026-03-15T12:00:00Z"
}
```

Error (409): duplicate `worker_oid + scenario_type + effective_at`.

### GET `/objects/journeys/scenarios`

List scenarios with pagination and optional filters.

Query parameters:
- `worker_oid` (optional) — filter by worker OID
- `scenario_type` (optional) — filter by scenario type (e.g., `onboarding`)
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

### GET `/objects/journeys/scenarios/{scenario_oid}`

Response (200): single `ScenarioResponse`.
Error (404): scenario not found.

### PUT `/objects/journeys/scenarios/{scenario_oid}`

Update scenario fields. Only provided fields are updated.

Request body:
```json
{
  "scenario_profile": {
    "description": "Updated onboarding description",
    "notes": "Added laptop setup topic",
    "key_topics": ["VPN", "Email Setup", "Badge Access", "Laptop"]
  }
}
```

Response (200): updated `ScenarioResponse`.
Error (404): scenario not found.

### DELETE `/objects/journeys/scenarios/{scenario_oid}`

Response (204): no content.
Error (404): scenario not found.

## Error Codes

| Code | Condition |
|------|-----------|
| 200 | Success (GET/PUT) |
| 201 | Created successfully |
| 204 | Deleted successfully |
| 403 | ABAC access denied (record exists but outside requester's scope) |
| 404 | Scenario not found |
| 409 | Duplicate worker_oid + scenario_type + effective_at |
| 422 | Validation error (invalid OID, invalid field value) |
