# Objects Module API Specifications

## Overview

The Objects module manages business entities that are not hierarchical but interact with hierarchies. Workers belong to organizations and locations. These entities are automatically registered in the Global Registry for unified lookup.

### Module Structure

```
/objects/
├── /workers                         - Worker (employee) management
│   ├── /profile?worker_oid=...      - AI-processed profile data
│   └── /detail?oid=...              - Single worker operations
├── /worker-hierarchy-roles          - Role assignments at hierarchy nodes
└── /hardwares                       - Standalone IT asset management (ERP BPMS)
    ├── /detail?hardware_oid=...     - Single hardware operations
    ├── /bulk_upsert                 - Batch insert/update by serial_number
    ├── /prune                       - Hard-delete missing rows
    └── /reconcile_assignees         - Backfill worker_oid from username
```

> [!NOTE]
> **Organizations and Locations** have been moved to [api_specs_objects_hierarchies.md](./api_specs_objects_hierarchies.md) as they are hierarchical entities.

> [!NOTE]
> **Activities (Incidents/Inquiries)** are defined in [api_specs_objects_activities.md](./api_specs_objects_activities.md). They now accept explicit `created_at`, `updated_at`, and `effective_at` (timezone-aware ISO8601) to reflect external source timestamps.

> [!NOTE]
> **Campaign Notifications and Surveys** are defined in [api_specs_objects_campaigns.md](./api_specs_objects_campaigns.md).

---

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Edit Permission |
|----------|-----------------|-----------------|
| Workers | `objects:workers:read` | `objects:workers:edit` |
| Workers (sensitive fields) | `objects:workers:read_sensitive` | `objects:workers:edit_sensitive` |
| Worker-Hierarchy-Roles | `objects:worker_hierarchy_roles:read` | `objects:worker_hierarchy_roles:edit` |
| Hardwares | `objects:hardwares:read` | `objects:hardwares:write` |

### Worker Sensitive Field Permissions

Worker endpoints are **not** ABAC-filtered (all workers are visible to anyone with `objects:workers:read`). However, certain job-related fields are **sensitive** and require additional permissions:

| Permission | Controls |
|---|---|
| `objects:workers:read_sensitive` | View the 6 job fields below (without this, they return `null`) |
| `objects:workers:edit_sensitive` | Create/update the 6 job fields below (without this, attempts return `403`) |

**Sensitive fields:**

| Field | Type | Description |
|---|---|---|
| `job_category` | Text | 2-letter function code |
| `job_subcategory` | Text | Second segment after `/` |
| `job_professional_level` | Text | Numeric level 5-15 (OLD system) |
| `job_management_level` | Text | L-patterns (OLD system) |
| `job_band` | Text | Seniority band (NEW system) |
| `job_title` | Text | Role description |

**Behavior:**
- **Read:** If the requester lacks `read_sensitive`, all 6 fields are returned as `null` in `WorkerResponse`.
- **Create/Update:** If the requester lacks `edit_sensitive` and the request body includes any sensitive field, the endpoint returns `403` with detail listing the attempted fields.
- **Non-sensitive fields** (`gender`, `hire_date`, `is_vip`, `vip_type`, `email`, etc.) are always visible and editable with base `read`/`edit` permissions.

---

## Data Models

### Worker

```python
class Worker(Base):
    __tablename__ = "workers"
    __table_args__ = {"schema": "objects"}

    oid = Column(BYTEA(16), primary_key=True)
    worker_id = Column(Text, unique=True, nullable=True)  # External employee ID
    stable_id = Column(Text, unique=True, nullable=False)  # Stable sync identifier (wecom_id)
    fullname = Column(Text, nullable=False)  # Worker's full name
    email = Column(Text, unique=True, nullable=True)
    worker_type = Column(Text, nullable=True)  # Regular, Intern, Partner, etc.
    hire_date = Column(DateTime(timezone=True), nullable=True)  # UTC datetime from ERP onboardingdate
    gender = Column(Text, nullable=True)

    # Job fields (parsed from position_title)
    job_category = Column(Text, nullable=True)            # 2-letter code (TE, TG, etc.)
    job_subcategory = Column(Text, nullable=True)         # Second segment after /
    job_professional_level = Column(Text, nullable=True)  # Numeric 5-15 (OLD system)
    job_management_level = Column(Text, nullable=True)    # L-patterns (OLD system)
    job_band = Column(Text, nullable=True)                # Senior, Principal, etc. (NEW system)
    job_title = Column(Text, nullable=True)               # Role description

    org_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=False)
    location_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
    manager_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)
    is_vip = Column(Boolean, default=False, nullable=False)
    vip_type = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
```

#### Job Fields Reference

| Field | Description | Source System | Example Values |
|-------|-------------|---------------|----------------|
| `job_category` | 2-letter function code | OLD + NEW | `TE`, `TG`, `PM` |
| `job_subcategory` | Second segment after `/` | OLD + NEW | `TRD`, `Programming, Technology & IT` |
| `job_professional_level` | Numeric level 5-15 | OLD only | `12`, `10`, `8` |
| `job_management_level` | L-patterns | OLD only | `L3-1`, `L4`, `L5-2` |
| `job_band` | Seniority band | NEW only | `Senior`, `Principal`, `Staff` |
| `job_title` | Role description | OLD + Simple types | `Principal Backend Engineer`, `Intern` |

> [!NOTE]
> **Parsing Rules by Worker Type:**
> - **Regular (OLD system)**: Has `job_category`, `job_subcategory`, `job_professional_level`, `job_management_level`, `job_title`
> - **Regular (NEW system)**: Has `job_category`, `job_subcategory`, `job_band` (no `job_title`)
> - **Intern**: Has `job_category`, `job_subcategory`, `job_title` = "Intern"
> - **Partner/Contingent/Consultant**: Has `job_title` only (entire string)

### WorkerProfile

```python
class WorkerProfile(Base):
    __tablename__ = "worker_profiles"
    __table_args__ = {"schema": "objects"}

    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid", ondelete="CASCADE"), primary_key=True)
    summary = Column(Text, nullable=True)
    summary_updated_at = Column(DateTime(timezone=True), nullable=True)
    topics = Column(JSONB, nullable=True)  # JSON array of {topic, need, status, notes} dicts
    topics_updated_at = Column(DateTime(timezone=True), nullable=True)
    tags = Column(JSONB, nullable=True)  # JSON array of strings
    tags_updated_at = Column(DateTime(timezone=True), nullable=True)
```

## API 1: Workers (`/objects/workers`)

### Schemas

```python
class WorkerCreate(BaseModel):
    worker_id: Optional[str] = Field(None, max_length=255)
    stable_id: str = Field(..., max_length=255)
    fullname: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    hire_date: Optional[datetime] = None  # UTC datetime from ERP onboardingdate
    gender: Optional[str] = None

    # Job fields (parsed from position_title)
    job_category: Optional[str] = None           # 2-letter code (TE, TG, etc.)
    job_subcategory: Optional[str] = None        # Second segment after /
    job_professional_level: Optional[str] = None # Numeric 5-15 (OLD system)
    job_management_level: Optional[str] = None   # L-patterns (OLD system)
    job_band: Optional[str] = None               # Senior, Principal, etc. (NEW system)
    job_title: Optional[str] = None              # Role description

    org_oid: str  # Required
    location_oid: Optional[str] = None
    manager_oid: Optional[str] = None
    is_vip: bool = False
    vip_type: Optional[str] = None  # Set null to clear
    is_active: bool = True

class WorkerUpdate(BaseModel):
    worker_id: Optional[str] = None
    stable_id: Optional[str] = None
    fullname: Optional[str] = None
    email: Optional[EmailStr] = None
    hire_date: Optional[datetime] = None
    gender: Optional[str] = None

    # Job fields (parsed from position_title)
    job_category: Optional[str] = None
    job_subcategory: Optional[str] = None
    job_professional_level: Optional[str] = None
    job_management_level: Optional[str] = None
    job_band: Optional[str] = None
    job_title: Optional[str] = None

    org_oid: Optional[str] = None
    location_oid: Optional[str] = None  # Empty string to clear
    manager_oid: Optional[str] = None  # Empty string to clear
    is_vip: Optional[bool] = None
    vip_type: Optional[str] = None
    is_active: Optional[bool] = None

class WorkerResponse(BaseModel):
    oid: str
    worker_id: Optional[str] = None
    stable_id: str
    fullname: str
    email: Optional[str] = None
    hire_date: Optional[datetime] = None
    gender: Optional[str] = None

    # Job fields (parsed from position_title)
    job_category: Optional[str] = None
    job_subcategory: Optional[str] = None
    job_professional_level: Optional[str] = None
    job_management_level: Optional[str] = None
    job_band: Optional[str] = None
    job_title: Optional[str] = None

    org_oid: str
    location_oid: Optional[str] = None
    manager_oid: Optional[str] = None
    is_vip: bool
    vip_type: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

class WorkerListResponse(BaseModel):
    items: List[WorkerResponse]
    total: int
    skip: int
    limit: int
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/workers` | Create worker | `objects:workers:edit` |
| GET | `/objects/workers` | List workers | `objects:workers:read` |
| GET | `/objects/workers/detail?oid={oid}` | Get worker | `objects:workers:read` |
| PUT | `/objects/workers/detail?oid={oid}` | Update worker | `objects:workers:edit` |
| DELETE | `/objects/workers/detail?oid={oid}` | Delete worker | `objects:workers:edit` |

> [!NOTE]
> Deleting a worker cascades to `account_worker`, `worker_hierarchy_role`, and `worker_profiles`.

#### Query Parameters (Detail)

All detail/profile endpoints accept **either** `oid`/`worker_oid` **or** `stable_id` to identify the worker. Providing both or neither returns `422`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oid` | string | One of `oid` or `stable_id` | Worker OID (22-char base64url ULID) |
| `stable_id` | string | One of `oid` or `stable_id` | Worker stable_id (e.g. `byjackchen`) |

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 403 | Missing `edit_sensitive` when setting job fields | `{"detail": "Missing permission to edit sensitive fields: ['job_band', ...]"}` |
| 404 | Organization not found | `{"detail": "Organization not found"}` |
| 404 | Manager not found | `{"detail": "Manager not found"}` |
| 409 | Worker ID exists | `{"detail": "Worker ID already exists"}` |
| 409 | Email exists | `{"detail": "Email already in use"}` |
| 422 | Both oid and stable_id provided | `{"detail": "Provide either oid or stable_id, not both"}` |
| 422 | Neither oid nor stable_id provided | `{"detail": "Provide either oid or stable_id"}` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `stable_id` | string | null | Filter by stable_id (exact match) |
| `org_oid` | string | null | Filter by organization |
| `location_oid` | string | null | Filter by location |
| `manager_oid` | string | null | Filter by manager |
| `is_vip` | boolean | null | Filter by VIP status |
| `vip_type` | string | null | Filter by VIP type (exact match) |
| `is_active` | boolean | null | Filter by active status |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

### List Response Contract

`GET /objects/workers` returns a paginated object instead of a bare array:

```json
{
  "items": [
    {
      "oid": "01JFXYZWORKER1234567890",
      "stable_id": "asmith",
      "fullname": "Alice Smith"
    }
  ],
  "total": 2371,
  "skip": 0,
  "limit": 100
}
```

- `total` is the filtered full count (not the loaded page size).
- `items` are stably ordered by `oid` ascending for deterministic `skip/limit` pagination.

### Create Worker Example

```json
{
  "worker_id": "EMP001",
  "stable_id": "asmith",
  "fullname": "Alice Smith",
  "email": "alice@example.com",
  "is_vip": true,
  "vip_type": "executive",
  "org_oid": "01JFXYZORG123456789AB",
  "location_oid": "01JFXYZLOC123456789AB"
}
```

---

## API 3: Hardwares (`/objects/hardwares`)

Standalone IT asset records synced from ERP BPMS. Hardware is **not** a worker subtable — it has its own lifecycle and can exist without an assigned worker (stockroom items, APs, retired devices).

### Model — `objects.hardwares`

```python
class Hardware(Base):
    __tablename__ = "hardwares"
    __table_args__ = {"schema": "objects"}

    oid = Column(BYTEA(16), primary_key=True)
    serial_number = Column(Text, nullable=False, unique=True)  # Business key — immutable
    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid", ondelete="SET NULL"), nullable=True)

    # Identity
    asset_tag = Column(Text, nullable=True)
    asset_number = Column(Text, nullable=True)

    # Model
    model_category = Column(Text, nullable=True)       # "Laptop", "AP", "Monitor", etc.
    model_display_name = Column(Text, nullable=True)
    model_name = Column(Text, nullable=True)
    main_category = Column(Text, nullable=True)
    asset_function = Column(Text, nullable=True)
    asset_owner = Column(Text, nullable=True)

    # Assignment
    assigned_to_username = Column(Text, nullable=True)
    assigned_to_display_name = Column(Text, nullable=True)
    employment_type = Column(Text, nullable=True)
    employment_start_date = Column(DateTime(timezone=True), nullable=True)
    assigned_date = Column(DateTime(timezone=True), nullable=True)
    first_assigned_date = Column(DateTime(timezone=True), nullable=True)

    # Location / Org
    company = Column(Text, nullable=True)
    business_group = Column(Text, nullable=True)
    department = Column(Text, nullable=True)
    location = Column(Text, nullable=True)
    office_id = Column(Text, nullable=True)
    region_code = Column(Text, nullable=True)
    region = Column(Text, nullable=True)
    office_region = Column(Text, nullable=True)
    stock_room = Column(Text, nullable=True)

    # Cost
    cost = Column(Numeric, nullable=True)
    cost_center = Column(Text, nullable=True)
    procured_cost_center = Column(Text, nullable=True)
    residual_value = Column(Numeric, nullable=True)
    residual_date = Column(DateTime(timezone=True), nullable=True)
    budget_by_oit = Column(Boolean, nullable=True)
    cost_by_oit = Column(Boolean, nullable=True)

    # Status
    asset_status = Column(Text, nullable=True)         # "In use", "Retired", "Awaiting Approval"
    substatus = Column(Text, nullable=True)
    retired_date = Column(DateTime(timezone=True), nullable=True)
    scheduled_retirement = Column(DateTime(timezone=True), nullable=True)

    # Verification
    verification_status = Column(Text, nullable=True)
    verified_date = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Text, nullable=True)

    # Provenance
    erp_created_by = Column(Text, nullable=True)
    erp_created_date = Column(DateTime(timezone=True), nullable=True)
    erp_updated_date = Column(DateTime(timezone=True), nullable=True)
    owned_by = Column(Text, nullable=True)

    # Standard
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Data source**: ERP BPMS `POST /api/hWAsset/assetInfo`  
**Registry**: auto-synced via `trg_hardware_registry_sync` trigger  
**Total inventory**: ~9,000 assets; ~3,000 have no assigned worker

### Schemas

```python
class HardwareCreate(BaseModel):
    serial_number: str  # Required; immutable after creation

    # All remaining fields optional
    worker_oid: Optional[str] = None
    asset_tag: Optional[str] = None
    asset_number: Optional[str] = None
    model_category: Optional[str] = None
    model_display_name: Optional[str] = None
    model_name: Optional[str] = None
    main_category: Optional[str] = None
    asset_function: Optional[str] = None
    asset_owner: Optional[str] = None
    assigned_to_username: Optional[str] = None
    assigned_to_display_name: Optional[str] = None
    employment_type: Optional[str] = None
    employment_start_date: Optional[datetime] = None
    assigned_date: Optional[datetime] = None
    first_assigned_date: Optional[datetime] = None
    company: Optional[str] = None
    business_group: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    office_id: Optional[str] = None
    region_code: Optional[str] = None
    region: Optional[str] = None
    office_region: Optional[str] = None
    stock_room: Optional[str] = None
    cost: Optional[Decimal] = None
    cost_center: Optional[str] = None
    procured_cost_center: Optional[str] = None
    residual_value: Optional[Decimal] = None
    residual_date: Optional[datetime] = None
    budget_by_oit: Optional[bool] = None
    cost_by_oit: Optional[bool] = None
    asset_status: Optional[str] = None
    substatus: Optional[str] = None
    retired_date: Optional[datetime] = None
    scheduled_retirement: Optional[datetime] = None
    verification_status: Optional[str] = None
    verified_date: Optional[datetime] = None
    verified_by: Optional[str] = None
    erp_created_by: Optional[str] = None
    erp_created_date: Optional[datetime] = None
    erp_updated_date: Optional[datetime] = None
    owned_by: Optional[str] = None
    is_active: bool = True

class HardwareUpdate(BaseModel):
    # serial_number is NOT included — it is an immutable business key
    worker_oid: Optional[str] = None
    asset_tag: Optional[str] = None
    # ... all other fields from HardwareCreate except serial_number
    is_active: Optional[bool] = None

class HardwareResponse(BaseModel):
    oid: str
    serial_number: str
    worker_oid: Optional[str] = None  # null when unassigned
    asset_tag: Optional[str] = None
    asset_number: Optional[str] = None
    model_category: Optional[str] = None
    model_display_name: Optional[str] = None
    model_name: Optional[str] = None
    main_category: Optional[str] = None
    asset_function: Optional[str] = None
    asset_owner: Optional[str] = None
    assigned_to_username: Optional[str] = None
    assigned_to_display_name: Optional[str] = None
    employment_type: Optional[str] = None
    employment_start_date: Optional[datetime] = None
    assigned_date: Optional[datetime] = None
    first_assigned_date: Optional[datetime] = None
    company: Optional[str] = None
    business_group: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    office_id: Optional[str] = None
    region_code: Optional[str] = None
    region: Optional[str] = None
    office_region: Optional[str] = None
    stock_room: Optional[str] = None
    cost: Optional[str] = None           # Decimal serialized as string, e.g. "4135.83"
    cost_center: Optional[str] = None
    procured_cost_center: Optional[str] = None
    residual_value: Optional[str] = None  # Decimal serialized as string
    residual_date: Optional[datetime] = None
    budget_by_oit: Optional[bool] = None
    cost_by_oit: Optional[bool] = None
    asset_status: Optional[str] = None
    substatus: Optional[str] = None
    retired_date: Optional[datetime] = None
    scheduled_retirement: Optional[datetime] = None
    verification_status: Optional[str] = None
    verified_date: Optional[datetime] = None
    verified_by: Optional[str] = None
    erp_created_by: Optional[str] = None
    erp_created_date: Optional[datetime] = None
    erp_updated_date: Optional[datetime] = None
    owned_by: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

class HardwareListResponse(BaseModel):
    items: List[HardwareResponse]
    total: int
    skip: int
    limit: int

class HardwareBulkUpsertRequest(BaseModel):
    items: List[HardwareCreate]  # max 500 items; match/update on serial_number

class HardwareBulkUpsertResponse(BaseModel):
    created: int
    updated: int
    unchanged: int
    skipped_no_serial: int
    errors: List[str]

class HardwarePruneRequest(BaseModel):
    kept_serial_numbers: List[str]  # All hardware NOT in this list will be hard-deleted

class HardwarePruneResponse(BaseModel):
    deleted: int

class HardwareReconcileResponse(BaseModel):
    resolved: int       # Rows where worker_oid was successfully backfilled
    still_unresolved: int  # Rows with assigned_to_username but no matching worker
```

### Endpoints

| Verb | Path | Permission | Purpose |
|------|------|------------|---------|
| POST | `/objects/hardwares` | `objects:hardwares:write` | Create one |
| GET | `/objects/hardwares` | `objects:hardwares:read` | List with filters + pagination |
| GET | `/objects/hardwares/detail?hardware_oid=...` | `objects:hardwares:read` | Get one by OID |
| PUT | `/objects/hardwares/detail?hardware_oid=...` | `objects:hardwares:write` | Update one |
| DELETE | `/objects/hardwares/detail?hardware_oid=...` | `objects:hardwares:write` | Delete one |
| POST | `/objects/hardwares/bulk_upsert` | `objects:hardwares:write` | Batch insert/update by `serial_number` |
| POST | `/objects/hardwares/prune` | `objects:hardwares:write` | Hard-delete rows not in kept set |
| POST | `/objects/hardwares/reconcile_assignees` | `objects:hardwares:write` | Backfill `worker_oid` from `assigned_to_username` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 50 | Max records (1-1000) |
| `view` | `full` \| `slim` | `full` | `slim` is accepted for dashboard parity; hardware currently returns the same field shape but adds short cache/partial-response behavior |
| `worker_oid` | string | null | Filter by assigned worker OID |
| `assigned_to_username` | string | null | Filter by ERP username |
| `serial_number` | string | null | Filter by serial number (exact) |
| `asset_tag` | string | null | Filter by asset tag |
| `model_category` | string | null | Filter by model category (e.g. "Laptop") |
| `main_category` | string | null | Filter by main category |
| `asset_status` | string | null | Filter by status (e.g. "In use", "Retired") |
| `substatus` | string[] | null | Multi-value substatus filter; repeated query params match `substatus IN (...)` |
| `office_id` | string | null | Filter by office |
| `region` | string | null | Filter by region |
| `is_active` | boolean | null | Filter by active status |
| `unassigned` | boolean | null | If `true`, return only rows where `worker_oid IS NULL` |

### Key Fields by Cluster

| Cluster | Fields |
|---------|--------|
| **Identity** | `serial_number` (unique, immutable), `asset_tag`, `asset_number` |
| **Model** | `model_category`, `model_display_name`, `model_name`, `main_category`, `asset_function`, `asset_owner` |
| **Assignment** | `worker_oid` (optional FK), `assigned_to_username`, `assigned_to_display_name`, `employment_type`, `employment_start_date`, `assigned_date`, `first_assigned_date` |
| **Location/Org** | `company`, `business_group`, `department`, `location`, `office_id`, `region_code`, `region`, `office_region`, `stock_room` |
| **Cost** | `cost` (Decimal→string), `cost_center`, `procured_cost_center`, `residual_value` (Decimal→string), `residual_date`, `budget_by_oit`, `cost_by_oit` |
| **Status** | `asset_status`, `substatus`, `retired_date`, `scheduled_retirement` |
| **Verification** | `verification_status`, `verified_date`, `verified_by` |
| **Provenance** | `erp_created_by`, `erp_created_date`, `erp_updated_date`, `owned_by` |

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Hardware not found | `{"detail": "Hardware not found"}` |
| 409 | Serial number already exists | `{"detail": "Serial number already exists"}` |
| 422 | `serial_number` missing on create | FastAPI validation error |
| 422 | `bulk_upsert` items exceed 500 | FastAPI validation error |

---

### Nested Resource: Worker Profile

AI-processed per-worker profile outputs. This endpoint is separate from `WorkerResponse` and is lazily created on first PUT.

#### Schemas

```python
class WorkerProfileUpsert(BaseModel):
    summary: Optional[str] = None
    topics: Optional[List[dict[str, Any]]] = None  # [{topic, need, status, notes}]
    tags: Optional[List[str]] = None

class WorkerProfileResponse(BaseModel):
    worker_oid: str
    summary: Optional[str] = None
    summary_updated_at: Optional[datetime] = None
    topics: Optional[List[dict[str, Any]]] = None  # [{topic, need, status, notes}]
    topics_updated_at: Optional[datetime] = None
    tags: Optional[List[str]] = None
    tags_updated_at: Optional[datetime] = None
```

#### Validation Rules

- At least one of `summary`/`topics`/`tags` must be provided in PUT payload.
- `summary` may be `null` (clear); if string, must be non-empty after trimming.
- `topics` may be `null` (clear); each item must be a dict with `topic` (str), `need` (str), `status` ("resolved"|"unresolved"), optional `notes` (str|null); topic values must be unique.
- `tags` may be `null` (clear); list values must be non-empty trimmed strings and unique.
- Empty lists (`[]`) are rejected.

#### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/objects/workers/profile?worker_oid={worker_oid}` | Get worker profile | `objects:workers:read` |
| PUT | `/objects/workers/profile?worker_oid={worker_oid}` | Create/update worker profile | `objects:workers:edit` |

#### Query Parameters (Profile)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `worker_oid` | string | One of `worker_oid` or `stable_id` | Worker OID (22-char base64url ULID) |
| `stable_id` | string | One of `worker_oid` or `stable_id` | Worker stable_id (e.g. `byjackchen`) |

#### Behavior Notes

- `GET` returns `404` when worker exists but no profile row has been created yet.
- `PUT` performs partial update: only provided fields are changed.
- If `summary`/`topics`/`tags` is present in payload (including `null`), the corresponding `*_updated_at` is set to current UTC.
- If provided value equals existing value, timestamp still refreshes.

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Worker not found | `{"detail": "Worker not found"}` |
| 404 | Profile not found (GET only) | `{"detail": "Profile not found"}` |
| 422 | Invalid worker_oid | `{"detail": "Invalid worker_oid"}` |
| 422 | Validation error (empty/duplicate items, empty summary, etc.) | FastAPI validation error |

#### Example PUT Payload

```json
{
  "summary": "Senior platform engineer with strong incident triage performance.",
  "topics": [
    {"topic": "incident triage", "need": "Faster triage turnaround for P1 incidents", "status": "unresolved", "notes": "3 open P1s in last 30 days"},
    {"topic": "service reliability", "need": "Monitoring coverage for core services", "status": "resolved", "notes": null}
  ],
  "tags": ["ai-generated", "internal"]
}
```

#### Example Response

```json
{
  "worker_oid": "01JFXYZWORKER1234567890",
  "summary": "Senior platform engineer with strong incident triage performance.",
  "summary_updated_at": "2026-02-17T03:13:21.123456Z",
  "topics": [
    {"topic": "incident triage", "need": "Faster triage turnaround for P1 incidents", "status": "unresolved", "notes": "3 open P1s in last 30 days"},
    {"topic": "service reliability", "need": "Monitoring coverage for core services", "status": "resolved", "notes": null}
  ],
  "topics_updated_at": "2026-02-17T03:13:21.123456Z",
  "tags": ["ai-generated", "internal"],
  "tags_updated_at": "2026-02-17T03:13:21.123456Z"
}
```

---

## API 2: Worker-Hierarchy-Roles (`/objects/worker-hierarchy-roles`)

Assigns workers to roles at specific hierarchy nodes for role-based ABAC.

### Schemas

```python
class WorkerHierarchyRoleCreate(BaseModel):
    worker_oid: str
    role_oid: str
    hierarchy_oid: str

class WorkerHierarchyRoleResponse(BaseModel):
    worker_oid: str
    role_oid: str
    hierarchy_oid: str
    assigned_at: datetime
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/worker-hierarchy-roles` | Create assignment | `objects:worker_hierarchy_roles:edit` |
| GET | `/objects/worker-hierarchy-roles` | List assignments | `objects:worker_hierarchy_roles:read` |
| DELETE | `/objects/worker-hierarchy-roles/{w}/{r}/{h}` | Remove assignment | `objects:worker_hierarchy_roles:edit` |

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Worker not found | `{"detail": "Worker not found"}` |
| 404 | Role not found | `{"detail": "Role not found"}` |
| 404 | Hierarchy not found | `{"detail": "Hierarchy node not found"}` |
| 409 | Already exists | `{"detail": "Assignment already exists"}` |

---

## API Endpoint Summary

| # | Method | Path | Description | Permission |
|---|--------|------|-------------|------------|
| **Workers** |||||
| 1 | POST | `/objects/workers` | Create worker | `objects:workers:edit` |
| 2 | GET | `/objects/workers` | List workers | `objects:workers:read` |
| 3 | GET | `/objects/workers/detail?oid={oid}` | Get worker | `objects:workers:read` |
| 4 | PUT | `/objects/workers/detail?oid={oid}` | Update worker | `objects:workers:edit` |
| 5 | DELETE | `/objects/workers/detail?oid={oid}` | Delete worker | `objects:workers:edit` |
| **Worker Profiles** |||||
| 6 | GET | `/objects/workers/profile?worker_oid={worker_oid}` | Get worker profile | `objects:workers:read` |
| 7 | PUT | `/objects/workers/profile?worker_oid={worker_oid}` | Create/update worker profile | `objects:workers:edit` |
| **Worker-Hierarchy-Roles** |||||
| 8 | POST | `/objects/worker-hierarchy-roles` | Create assignment | `objects:worker_hierarchy_roles:edit` |
| 9 | GET | `/objects/worker-hierarchy-roles` | List assignments | `objects:worker_hierarchy_roles:read` |
| 10 | DELETE | `/objects/worker-hierarchy-roles/{w}/{r}/{h}` | Delete assignment | `objects:worker_hierarchy_roles:edit` |
| **Hardwares** |||||
| 11 | POST | `/objects/hardwares` | Create hardware | `objects:hardwares:write` |
| 12 | GET | `/objects/hardwares` | List hardwares | `objects:hardwares:read` |
| 13 | GET | `/objects/hardwares/detail?hardware_oid={oid}` | Get hardware | `objects:hardwares:read` |
| 14 | PUT | `/objects/hardwares/detail?hardware_oid={oid}` | Update hardware | `objects:hardwares:write` |
| 15 | DELETE | `/objects/hardwares/detail?hardware_oid={oid}` | Delete hardware | `objects:hardwares:write` |
| 16 | POST | `/objects/hardwares/bulk_upsert` | Batch upsert by serial_number | `objects:hardwares:write` |
| 17 | POST | `/objects/hardwares/prune` | Hard-delete missing rows | `objects:hardwares:write` |
| 18 | POST | `/objects/hardwares/reconcile_assignees` | Backfill worker_oid | `objects:hardwares:write` |

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Cascade Behavior

- Deleting a hierarchy node cascades to all children.
- Deleting a worker cascades to `account_worker`, `worker_hierarchy_role`, and `worker_profiles`. Hardware rows are NOT deleted — their `worker_oid` is set to `NULL` (ON DELETE SET NULL).
- Foreign key constraints ensure referential integrity.

---

## API 3: Articles (`/objects/articles`)

Version-controlled content secured by service_catalog hierarchy.

### Schemas

```python
class ArticleCreate(BaseModel):
    service_catalog_id: str
    stable_id: Optional[str] = None
    title: str
    summary: Optional[str] = None
    markdown: str
    source_system: Optional[str] = None
    source_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: bool = True

class ArticleUpdate(BaseModel):
    service_catalog_id: Optional[str] = None
    title: str
    summary: Optional[str] = None
    markdown: str
    source_system: Optional[str] = None
    source_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    embedding_ids: Optional[List[str]] = None
    embedded_at: Optional[datetime] = None

class ArticleResponse(BaseModel):
    oid: str
    stable_id: Optional[str]
    service_catalog_id: str
    effective_version_number: int
    is_active: bool
    embedding_ids: Optional[List[str]]
    embedded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    latest_version: ArticleVersionResponse

class ArticleVersionResponse(BaseModel):
    version_number: int
    title: str
    summary: Optional[str]
    markdown: str
    source_system: Optional[str]
    source_url: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime

class ArticleListResponse(BaseModel):
    items: List[ArticleResponse]
    total: int
    skip: int
    limit: int
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/articles` | Create article (v1) | `objects:articles:write` |
| GET | `/objects/articles` | List articles (ABAC) | `objects:articles:read` |
| GET | `/objects/articles/{oid}` | Get article | `objects:articles:read` |
| PUT | `/objects/articles/{oid}` | Update (new version) | `objects:articles:write` |
| DELETE | `/objects/articles/{oid}` | Delete | `objects:articles:write` |
| GET | `/objects/articles/{oid}/versions` | List versions | `objects:articles:read` |
| GET | `/objects/articles/{oid}/versions/{ver}` | Get specific version | `objects:articles:read` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `service_catalog_id` | string | null | Filter by service catalog (ULID) |
| `is_active` | boolean | null | Filter by active status |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

`GET /objects/articles` returns `ArticleListResponse` (`{ items, total, skip, limit }`), not a bare array.

### ABAC Filtering

Articles are filtered by `service_catalog_id` against the hierarchy.
- **Unconstrained**: Sees all articles.
- **Role-based**: Sees articles linked to service catalogs within the user's assigned hierarchy roles.
- **Self-scoped**: Not supported (no author-based access).

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

### Worker Example

```bash
# Create worker
curl -X POST http://localhost:8000/objects/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "EMP001",
    "stable_id": "asmith",
    "fullname": "Alice Smith",
    "email": "alice@example.com",
    "org_oid": "<org_oid>"
  }'
```
