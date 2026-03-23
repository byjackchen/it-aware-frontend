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
- `worker_oid` — BYTEA(16), primary key, FK to `objects.workers.oid` ON DELETE CASCADE
- `cluster_label` — Integer, NOT NULL. -1 = noise/outlier, 0+ = cluster assignment
- `cluster_probability` — Float, NOT NULL. HDBSCAN membership probability [0.0, 1.0]
- `outlier_score` — Float, NOT NULL. GLOSH outlier score (higher = more outlier-like)
- `cluster_name` — Text, nullable. LLM-generated cluster name (e.g. "VIP高管型")
- `cluster_profile` — JSONB, nullable. Structured profile: `{name, description, key_behaviors[], pain_points[], best_practices[], sla_recommendation}`
- `feature_vector` — JSONB, nullable. Raw 30-feature values as `{feature_name: float}`
- `pca_3d` — JSONB, nullable. 3D PCA coordinates as `[x, y, z]` for visualization
- `scaler_params` — JSONB, nullable. StandardScaler parameters per feature: `{feature_name: {mean: float, scale: float}}`. Used for real-time scoring: `z = (raw - mean) / scale`
- `run_id` — Text, NOT NULL. Pipeline run identifier (e.g. `cluster_20260323T021250Z`)
- `computed_at` — DateTime(tz), NOT NULL. When this clustering was computed
- `created_at` — DateTime(tz), server_default=now()
- `updated_at` — DateTime(tz), server_default=now()

Indexes:
- `worker_clusters_cluster_label_idx` on `(cluster_label)`
- `worker_clusters_run_id_idx` on `(run_id)`
- `worker_clusters_computed_at_idx` on `(computed_at DESC)`

Notes:
- Table is populated by the `analyze-worker-clusters` Airflow DAG (monthly schedule)
- Each run replaces all assignments via upsert (ON CONFLICT worker_oid DO UPDATE)
- No registry sync trigger (cluster data is analytics, not an entity)

## Worker Cluster APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/objects/insights/worker-clusters/summary` | Aggregate cluster summary | `objects:worker_clusters:read` |
| GET | `/objects/insights/worker-clusters` | List worker clusters (paginated) | `objects:worker_clusters:read` |
| GET | `/objects/insights/worker-clusters/{worker_oid}` | Get single worker's cluster | `objects:worker_clusters:read` |
| POST | `/objects/insights/worker-clusters/bulk` | Bulk upsert cluster assignments | `objects:worker_clusters:write` |

### GET `/objects/insights/worker-clusters/summary`

Aggregate cluster-level summary. No per-worker data returned.

Response (200):
```json
{
  "run_id": "cluster_20260323T021250Z",
  "computed_at": "2026-03-23T02:12:50Z",
  "total_workers": 2211,
  "n_clusters": 3,
  "noise_count": 143,
  "clusters": [
    {
      "cluster_label": 0,
      "cluster_name": "VIP高管型",
      "size": 32,
      "percentage": 1.4,
      "cluster_profile": {
        "name": "VIP高管型",
        "description": "高级管理层用户...",
        "key_behaviors": ["提单量低但优先级高", "..."],
        "pain_points": ["响应时间期望严格", "..."],
        "best_practices": ["专属快速通道", "..."],
        "sla_recommendation": "1小时内首次响应"
      }
    }
  ]
}
```

### GET `/objects/insights/worker-clusters`

List worker cluster assignments with pagination and optional filters.

Query parameters:
- `skip` (default 0, min 0)
- `limit` (default 100, min 1, max 1000)
- `cluster_label` (optional) — filter by cluster label (integer, -1 for noise)
- `run_id` (optional) — filter by pipeline run ID

Response (200):
```json
{
  "items": [
    {
      "worker_oid": "<base64url OID>",
      "cluster_label": 0,
      "cluster_probability": 0.95,
      "outlier_score": 0.02,
      "cluster_name": "VIP高管型",
      "cluster_profile": { ... },
      "feature_vector": {
        "tenure_months": 48.5,
        "is_vip": 1.0,
        "incident_count": 3.0,
        ...
      },
      "pca_3d": [1.23, -0.45, 0.78],
      "scaler_params": {
        "tenure_months": {"mean": 33.12, "scale": 25.44},
        "is_vip": {"mean": 0.018, "scale": 0.132},
        "incident_count": {"mean": 3.45, "scale": 6.21}
      },
      "run_id": "cluster_20260323T021250Z",
      "computed_at": "2026-03-23T02:12:50Z"
    }
  ],
  "total": 2211,
  "skip": 0,
  "limit": 100
}
```

Ordering: `cluster_label ASC, worker_oid ASC`.

### GET `/objects/insights/worker-clusters/{worker_oid}`

Get a single worker's cluster assignment.

Response (200): single `WorkerClusterResponse` object (same shape as list item).
Error (404): worker cluster not found.
Error (422): invalid worker_oid format.

### POST `/objects/insights/worker-clusters/bulk`

Bulk upsert cluster assignments. Used by the clustering Airflow DAG.

Request body:
```json
{
  "run_id": "cluster_20260323T021250Z",
  "computed_at": "2026-03-23T02:12:50Z",
  "scaler_params": {
    "tenure_months": {"mean": 33.12, "scale": 25.44},
    "is_vip": {"mean": 0.018, "scale": 0.132},
    "incident_count": {"mean": 3.45, "scale": 6.21}
  },
  "assignments": [
    {
      "worker_oid": "<base64url OID>",
      "cluster_label": 0,
      "cluster_probability": 0.95,
      "outlier_score": 0.02,
      "cluster_name": "VIP高管型",
      "cluster_profile": { ... },
      "feature_vector": { ... },
      "pca_3d": [1.23, -0.45, 0.78]
    }
  ]
}
```

Validation:
- `run_id`: required, min_length=1
- `computed_at`: required, ISO8601 datetime
- `scaler_params`: optional, `{feature_name: {mean: float, scale: float}}` — same value applied to all assignments in the batch
- `worker_oid`: required, valid base64url OID
- `cluster_probability`: 0.0 ≤ value ≤ 1.0
- `outlier_score`: ≥ 0.0
- Extra fields are forbidden

Response (200):
```json
{
  "upserted": 2211,
  "run_id": "cluster_20260323T021250Z"
}
```

Behavior: Uses `INSERT ... ON CONFLICT (worker_oid) DO UPDATE` for each assignment. Updates all fields including `updated_at`.

## Error Codes

| Code | Condition |
|------|-----------|
| 200 | Success (GET/PUT/POST bulk) |
| 201 | Created successfully (POST analysis) |
| 204 | Deleted successfully |
| 404 | Resource not found |
| 409 | Duplicate source_type + source_oid + topic (analysis) |
| 422 | Validation error (invalid OID, invalid field value) |
