# Staging Module API Specifications

## Overview

The Staging module provides a staging layer for external data ingestion before syncing to core tables. It supports batch tracking, idempotent reruns, and error handling for auditing and rollback purposes.

### Module Structure

```
/staging/
├── /batches              - Sync batch management
├── /organizations        - Organization staging records
├── /locations            - Location staging records
└── /workers              - Worker staging records
```

---

## Security Model

All endpoints require authentication. Permissions follow the `staging:{resource}:{action}` pattern.

| Resource | Read Permission | Edit Permission |
|----------|-----------------|-----------------|
| Batches | `staging:batch:read` | `staging:batch:edit` |
| Records | `staging:records:read` | `staging:records:edit` |

> [!NOTE]
> Super admin with `*:*:*` permission has full access to all staging endpoints.

---

## Data Models

### SyncBatch

```python
class SyncBatch(Base):
    __tablename__ = "sync_batches"
    __table_args__ = {"schema": "staging"}

    batch_id = Column(BigInteger, primary_key=True)  # unix_epoch_ms
    source_system = Column(Text, nullable=False)
    entity_type = Column(Text, nullable=False)  # organization/location/worker
    status = Column(Enum('stage_processing','staged','stage_failed','sync_processing','synced','synced_with_failure'))
    total_records = Column(Integer, default=0)
    synced_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    metadata = Column(JSONB, nullable=True)
```

### StagingMixin (Common Fields)

```python
class StagingMixin:
    staging_id = Column(BigInteger, primary_key=True, autoincrement=True)
    batch_id = Column(BigInteger, ForeignKey("staging.sync_batches.batch_id"))
    source_system = Column(Text, nullable=False)
    stable_id = Column(Text, nullable=False)
    # UNIQUE(batch_id, source_system, stable_id) - idempotency constraint
    
    status = Column(Enum('staged','synced','sync_failed','sync_skipped'))
    raw_payload = Column(JSONB, nullable=True)
    error_details = Column(JSONB, nullable=True)
    retry_count = Column(Integer, default=0)
    staged_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
```

### Entity-Specific Fields

| Entity | Additional Fields |
|--------|-------------------|
| StagingOrganization | name, orglevel, parent_stable_id, bg, line, department, center, team |
| StagingLocation | location_stable_id, location, country, region |
| StagingWorker | worker_id, fullname, email, gender, position_title, job_category, job_subcategory, job_professional_level, job_management_level, job_band, job_title, org_stable_id, location_stable_id, manager_stable_id |

---

## API 1: Batches (`/staging/batches`)

### Schemas

```python
class BatchCreate(BaseModel):
    batch_id: int  # unix_epoch_ms
    source_system: str
    entity_type: str  # organization|location|worker
    metadata: Optional[dict] = None

class BatchUpdate(BaseModel):
    status: Optional[str] = None  # stage_processing|staged|stage_failed|sync_processing|synced|synced_with_failure
    total_records: Optional[int] = None
    synced_count: Optional[int] = None
    failed_count: Optional[int] = None
    completed_at: Optional[datetime] = None
    metadata: Optional[dict] = None

class BatchResponse(BaseModel):
    batch_id: int
    source_system: str
    entity_type: str
    status: str
    total_records: int
    synced_count: int
    failed_count: int
    started_at: datetime
    completed_at: Optional[datetime]
    metadata: Optional[dict]
```

> **Timestamp behavior**: `completed_at` should be timezone-aware ISO8601 (e.g., `2026-02-02T12:34:56Z`). Naive timestamps are assumed to be UTC and are normalized to UTC.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/staging/batches` | Create batch | `staging:batch:edit` |
| GET | `/staging/batches` | List batches | `staging:batch:read` |
| GET | `/staging/batches/{batch_id}` | Get batch | `staging:batch:read` |
| PUT | `/staging/batches/{batch_id}` | Update batch | `staging:batch:edit` |

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 409 | Batch ID exists | `{"detail": "Batch ID already exists"}` |
| 404 | Batch not found | `{"detail": "Batch not found"}` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| source_system | string | null | Filter by source (exact match) |
| entity_type | string | null | Filter by entity type (organization\|location\|worker) |
| status | string | null | Filter by status (stage_processing\|staged\|stage_failed\|sync_processing\|synced\|synced_with_failure) |
| skip | int | 0 | Records to skip for pagination |
| limit | int | 100 | Max records per page (1-1000) |

#### Filtering Behavior

- **No filters**: Returns all batches, ordered by `batch_id` descending (newest first)
- **Multiple filters**: Combined with AND logic
- **Ordering**: Always sorted by `batch_id DESC`

#### Example Queries

```bash
# Get all failed batches from workday
GET /staging/batches?source_system=workday&status=failed

# Get worker batches only
GET /staging/batches?entity_type=worker

# Pagination: page 2 with 50 records per page
GET /staging/batches?skip=50&limit=50
```

### Create Batch Example

```json
{
  "batch_id": 1737488160000,
  "source_system": "workday",
  "entity_type": "worker",
  "metadata": {"job_id": "airflow-123"}
}
```

---

## API 2: Organizations (`/staging/organizations`)

### Schemas

```python
class StagingOrganizationCreate(BaseModel):
    batch_id: int
    source_system: str
    source_id: str
    raw_payload: Optional[dict] = None
    name: str
    orglevel: Optional[str] = None
    parent_stable_id: Optional[str] = None
    bg: Optional[str] = None
    line: Optional[str] = None
    department: Optional[str] = None
    center: Optional[str] = None
    team: Optional[str] = None

class StagingOrganizationResponse(BaseModel):
    staging_id: int
    batch_id: int
    source_system: str
    source_id: str
    status: str
    raw_payload: Optional[dict]
    error_details: Optional[dict]
    retry_count: int
    staged_at: datetime
    processed_at: Optional[datetime]
    name: str
    orglevel: Optional[str]
    parent_stable_id: Optional[str]
    bg: Optional[str]
    line: Optional[str]
    department: Optional[str]
    center: Optional[str]
    team: Optional[str]
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/staging/organizations` | Bulk insert | `staging:records:edit` |
| GET | `/staging/organizations` | List records | `staging:records:read` |
| GET | `/staging/organizations/{staging_id}` | Get record | `staging:records:read` |
| PUT | `/staging/organizations/{staging_id}` | Update status | `staging:records:edit` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| batch_id | int | null | Filter by batch (required for large datasets) |
| status | string | null | Filter by status (staged\|synced\|sync_failed\|sync_skipped) |
| skip | int | 0 | Records to skip for pagination |
| limit | int | 100 | Max records per page (1-1000) |

#### Filtering Behavior

- **No filters**: Returns all records (use with caution on large datasets)
- **batch_id filter**: Highly recommended - filters to specific batch
- **status filter**: Useful for finding failed/pending records to retry
- **Multiple filters**: Combined with AND logic
- **Ordering**: Records returned in insertion order (by `staging_id`)

#### Example Queries

```bash
# Get all pending records for a specific batch
GET /staging/organizations?batch_id=1737488160000&status=pending

# Get failed records only
GET /staging/organizations?status=failed

# Pagination through a batch
GET /staging/organizations?batch_id=1737488160000&skip=100&limit=100
```

### Bulk Insert Example

```bash
curl -X POST http://localhost:8000/staging/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "batch_id": 1737488160000,
      "source_system": "workday",
      "source_id": "ORG-001",
      "name": "Engineering",
      "orglevel": "2"
    }
  ]'
```

### Response

```json
{
  "inserted": 1,
  "errors": []
}
```

---

## API 3: Locations (`/staging/locations`)

### Schemas

```python
class StagingLocationCreate(BaseModel):
    batch_id: int
    source_system: str
    source_id: str
    raw_payload: Optional[dict] = None
    location_stable_id: Optional[str] = None
    location: str
    country: Optional[str] = None
    region: Optional[str] = None

class StagingLocationResponse(BaseModel):
    staging_id: int
    batch_id: int
    source_system: str
    stable_id: str
    status: str
    raw_payload: Optional[dict]
    error_details: Optional[dict]
    retry_count: int
    staged_at: datetime
    processed_at: Optional[datetime]
    location_stable_id: Optional[str]
    location: str
    country: Optional[str]
    region: Optional[str]
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/staging/locations` | Bulk insert | `staging:records:edit` |
| GET | `/staging/locations` | List records | `staging:records:read` |
| GET | `/staging/locations/{staging_id}` | Get record | `staging:records:read` |
| PUT | `/staging/locations/{staging_id}` | Update status | `staging:records:edit` |

> [!NOTE]
> Query parameters same as Organizations: `batch_id`, `status`, `skip`, `limit`

---

## API 4: Workers (`/staging/workers`)

### Schemas

```python
class StagingWorkerCreate(BaseModel):
    batch_id: int
    source_system: str
    source_id: str
    raw_payload: Optional[dict] = None
    worker_id: Optional[str] = None
    fullname: Optional[str] = None              # Combined full name from source
    email: Optional[str] = None
    gender: Optional[str] = None
    position_title: Optional[str] = None        # Raw position title from source

    # Job fields (parsed from position_title)
    job_category: Optional[str] = None          # 2-letter code (TE, TG, etc.)
    job_subcategory: Optional[str] = None       # Second segment after /
    job_professional_level: Optional[str] = None  # Numeric 5-15 (OLD system)
    job_management_level: Optional[str] = None  # L-patterns (OLD system)
    job_band: Optional[str] = None              # Senior, Principal, etc. (NEW system)
    job_title: Optional[str] = None             # Role description

    org_stable_id: Optional[str] = None
    location_stable_id: Optional[str] = None
    manager_stable_id: Optional[str] = None

class StagingWorkerResponse(BaseModel):
    staging_id: int
    batch_id: int
    source_system: str
    stable_id: str
    status: str
    raw_payload: Optional[dict]
    error_details: Optional[dict]
    retry_count: int
    staged_at: datetime
    processed_at: Optional[datetime]
    worker_id: Optional[str]
    fullname: Optional[str]
    email: Optional[str]
    gender: Optional[str]
    position_title: Optional[str]
    job_category: Optional[str]
    job_subcategory: Optional[str]
    job_professional_level: Optional[str]
    job_management_level: Optional[str]
    job_band: Optional[str]
    job_title: Optional[str]
    org_stable_id: Optional[str]
    location_stable_id: Optional[str]
    manager_stable_id: Optional[str]
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/staging/workers` | Bulk insert | `staging:records:edit` |
| GET | `/staging/workers` | List records | `staging:records:read` |
| GET | `/staging/workers/{staging_id}` | Get record | `staging:records:read` |
| PUT | `/staging/workers/{staging_id}` | Update status | `staging:records:edit` |

> [!NOTE]
> Query parameters same as Organizations: `batch_id`, `status`, `skip`, `limit`

---

## API 5: Status Update (All Entities)

Used by sync jobs to update record status after processing.

### Schema

```python
class StagingRecordUpdate(BaseModel):
    status: Optional[str] = None  # staged|synced|sync_failed|sync_skipped
    error_details: Optional[dict] = None
    retry_count: Optional[int] = None
    processed_at: Optional[datetime] = None
```

> **Timestamp behavior**: `processed_at` should be timezone-aware ISO8601 (e.g., `2026-02-02T12:34:56Z`). Naive timestamps are assumed to be UTC and are normalized to UTC.

### Example

```bash
# Mark record as synced
curl -X PUT http://localhost:8000/staging/workers/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "synced", "processed_at": "2026-01-21T15:00:00Z"}'
```

---

## API 6: Reset Staging (`/staging/reset`)

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| DELETE | `/staging/reset` | Wipe all staging data | `staging:batch:edit` |

> [!WARNING]
> This endpoint deletes **ALL** data from all staging tables (`staging.organizations`, `staging.locations`, `staging.workers`, `staging.sync_batches`). This action cannot be undone.

---


## API Endpoint Summary

| # | Method | Path | Description | Permission |
|---|--------|------|-------------|------------|
| **Batches** |||||
| 1 | POST | `/staging/batches` | Create batch | `staging:batch:edit` |
| 2 | GET | `/staging/batches` | List batches | `staging:batch:read` |
| 3 | GET | `/staging/batches/{batch_id}` | Get batch | `staging:batch:read` |
| 4 | PUT | `/staging/batches/{batch_id}` | Update batch | `staging:batch:edit` |
| **Organizations** |||||
| 5 | POST | `/staging/organizations` | Bulk insert | `staging:records:edit` |
| 6 | GET | `/staging/organizations` | List records | `staging:records:read` |
| 7 | GET | `/staging/organizations/{staging_id}` | Get record | `staging:records:read` |
| 8 | PUT | `/staging/organizations/{staging_id}` | Update status | `staging:records:edit` |
| **Locations** |||||
| 9 | POST | `/staging/locations` | Bulk insert | `staging:records:edit` |
| 10 | GET | `/staging/locations` | List records | `staging:records:read` |
| 11 | GET | `/staging/locations/{staging_id}` | Get record | `staging:records:read` |
| 12 | PUT | `/staging/locations/{staging_id}` | Update status | `staging:records:edit` |
| **Workers** |||||
| 13 | POST | `/staging/workers` | Bulk insert | `staging:records:edit` |
| 14 | GET | `/staging/workers` | List records | `staging:records:read` |
| 15 | GET | `/staging/workers/{staging_id}` | Get record | `staging:records:read` |
| 16 | PUT | `/staging/workers/{staging_id}` | Update status | `staging:records:edit` |
| **Reset** |||||
| 17 | DELETE | `/staging/reset` | Wipe all staging data | `staging:batch:edit` |


---

## Notes

### Batch ID Format

- `batch_id` is a BIGINT representing unix epoch milliseconds
- Example: `1737488160000` (2026-01-21 15:16:00 UTC)
- Generated by the caller (typically an Airflow job)

### Idempotency

Each staging table has a unique constraint on `(batch_id, source_system, source_id)`:
- Duplicate inserts in the same batch are rejected with 409
- Rerunning a batch with same records is safe (duplicates are skipped)

### Status Flow
- **Batch**: `stage_processing` → `staged` (ready for sync) → `sync_processing` → `synced` (or `synced_with_failure`)
- **Record**: `staged` → `synced` (or `sync_failed` / `sync_skipped`)


### Query Parameters (List Records)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| batch_id | int | null | Filter by batch |
| status | string | null | Filter by status |
| skip | int | 0 | Records to skip |
| limit | int | 100 | Max records (1-1000) |

---

## Testing with cURL

### Authentication

```bash
# Service account login
curl -X POST http://localhost:8000/auth/service/token \
  -d "service_name=admin&api_key=your-api-key"
export TOKEN="<access_token>"

# Or session login
curl -X POST http://localhost:8000/auth/session/token \
  -d "username=alice" -c cookies.txt
```

### Full Staging Workflow Example

```bash
# Step 1: Authenticate as service account
curl -X POST http://localhost:8000/auth/service/token \
  -d "service_name=staging_sync&api_key=your-staging-api-key"
export TOKEN="<access_token>"

# Step 2: Create a batch
BATCH_ID=$(date +%s%3N)  # Generate unix_epoch_ms
curl -X POST http://localhost:8000/staging/batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"source_system\": \"workday\",
    \"entity_type\": \"worker\",
    \"metadata\": {\"job_id\": \"airflow-daily-sync\"}
  }"

# Step 3: Bulk insert staging workers
curl -X POST http://localhost:8000/staging/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "[
    {
      \"batch_id\": $BATCH_ID,
      \"source_system\": \"workday\",
      \"source_id\": \"WD-001\",
      \"fullname\": \"Alice Smith\",
      \"email\": \"alice@example.com\",
      \"org_stable_id\": \"ORG-ENG\"
    },
    {
      \"batch_id\": $BATCH_ID,
      \"source_system\": \"workday\",
      \"source_id\": \"WD-002\",
      \"fullname\": \"Bob Jones\",
      \"email\": \"bob@example.com\",
      \"org_stable_id\": \"ORG-ENG\"
    }
  ]"

# Step 4: List staged workers (filter by batch)
curl "http://localhost:8000/staging/workers?batch_id=$BATCH_ID" \
  -H "Authorization: Bearer $TOKEN"

# Step 5: Check for failed records
curl "http://localhost:8000/staging/workers?batch_id=$BATCH_ID&status=failed" \
  -H "Authorization: Bearer $TOKEN"

# Step 6: Update batch status to completed
curl -X PUT "http://localhost:8000/staging/batches/$BATCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed", "total_records": 2, "synced_count": 2}'

# Step 7: Get batch summary
curl "http://localhost:8000/staging/batches/$BATCH_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Error Handling Example

```bash
# Duplicate insert (idempotency test)
curl -X POST http://localhost:8000/staging/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "[
    {
      \"batch_id\": $BATCH_ID,
      \"source_system\": \"workday\",
      \"source_id\": \"WD-001\",
      \"fullname\": \"Alice Smith\"
    }
  ]"
# Response: {"inserted": 0, "errors": [{"index": 0, "source_id": "WD-001", "error": "Duplicate record (idempotency constraint)"}]}
```
