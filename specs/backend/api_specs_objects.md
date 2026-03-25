# Objects Module API Specifications

## Overview

The Objects module manages business entities that are not hierarchical but interact with hierarchies. Workers belong to organizations and locations. These entities are automatically registered in the Global Registry for unified lookup.

### Module Structure

```
/objects/
├── /workers                         - Worker (employee) management
│   ├── /profile?worker_oid=...      - AI-processed profile data
│   ├── /hardwares?worker_oid=...    - Hardware assigned to workers
│   └── /detail?oid=...              - Single worker operations
└── /worker-hierarchy-roles          - Role assignments at hierarchy nodes
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
| Worker-Hierarchy-Roles | `objects:worker_hierarchy_roles:read` | `objects:worker_hierarchy_roles:edit` |

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

### WorkerHardware

```python
class WorkerHardware(Base):
    __tablename__ = "worker_hardwares"
    __table_args__ = {"schema": "objects"}

    oid = Column(BYTEA(16), primary_key=True)
    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid", ondelete="CASCADE"), nullable=False)
    hardware_type = Column(Text, nullable=False)  # e.g., "Laptop", "Monitor"
    tracking_id = Column(Text, nullable=True, unique=True)  # ServiceNow display_name
    serial_number = Column(Text, nullable=True, unique=True)
    model = Column(Text, nullable=True)  # e.g., "MacBook Pro 16"
    assignment_date = Column(DateTime(timezone=True), nullable=False)
    renew_eligible_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
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

All detail/profile/hardware endpoints accept **either** `oid`/`worker_oid` **or** `stable_id` to identify the worker. Providing both or neither returns `422`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oid` | string | One of `oid` or `stable_id` | Worker OID (22-char base64url ULID) |
| `stable_id` | string | One of `oid` or `stable_id` | Worker stable_id (e.g. `byjackchen`) |

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
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

### Nested Resource: Worker Hardwares

Hardware assets (laptops, monitors, etc.) assigned to workers.

#### Schemas

```python
class WorkerHardwareCreate(BaseModel):
    hardware_type: str = Field(..., min_length=1, max_length=100)
    tracking_id: Optional[str] = Field(None, max_length=255)
    serial_number: Optional[str] = Field(None, max_length=255)
    model: Optional[str] = Field(None, max_length=255)
    assignment_date: datetime
    renew_eligible_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool = True

class WorkerHardwareUpdate(BaseModel):
    hardware_type: Optional[str] = None
    tracking_id: Optional[str] = None
    serial_number: Optional[str] = None
    model: Optional[str] = None
    assignment_date: Optional[datetime] = None
    renew_eligible_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class WorkerHardwareResponse(BaseModel):
    oid: str
    worker_oid: str
    hardware_type: str
    tracking_id: Optional[str] = None
    serial_number: Optional[str] = None
    model: Optional[str] = None
    assignment_date: datetime
    renew_eligible_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

> **Timestamp behavior**: `assignment_date` and `renew_eligible_date` should be timezone-aware ISO8601 (e.g., `2026-02-02T12:34:56Z`). Naive timestamps are assumed to be UTC and are normalized to UTC.

#### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/workers/hardwares?worker_oid={worker_oid}` | Create hardware | `objects:workers:edit` |
| GET | `/objects/workers/hardwares?worker_oid={worker_oid}` | List hardware | `objects:workers:read` |
| GET | `/objects/workers/hardwares/detail?worker_oid={worker_oid}&hardware_oid={hardware_oid}` | Get hardware | `objects:workers:read` |
| PUT | `/objects/workers/hardwares/detail?worker_oid={worker_oid}&hardware_oid={hardware_oid}` | Update hardware | `objects:workers:edit` |
| DELETE | `/objects/workers/hardwares/detail?worker_oid={worker_oid}&hardware_oid={hardware_oid}` | Delete hardware | `objects:workers:edit` |

#### Query Parameters (Hardwares)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `worker_oid` | string | One of `worker_oid` or `stable_id` | Worker OID (22-char base64url ULID) |
| `stable_id` | string | One of `worker_oid` or `stable_id` | Worker stable_id (e.g. `byjackchen`) |

#### Query Parameters (Hardware Detail)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `worker_oid` | string | One of `worker_oid` or `stable_id` | Worker OID (22-char base64url ULID) |
| `stable_id` | string | One of `worker_oid` or `stable_id` | Worker stable_id (e.g. `byjackchen`) |
| `hardware_oid` | string | Yes | Hardware OID (22-char base64url ULID) |

> [!NOTE]
> Deleting a worker cascades to all associated hardware records.

#### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Worker not found | `{"detail": "Worker not found"}` |
| 404 | Hardware not found | `{"detail": "Hardware not found"}` |
| 409 | Tracking ID exists | `{"detail": "Tracking ID already exists"}` |
| 409 | Serial number exists | `{"detail": "Serial number already exists"}` |

#### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `is_active` | boolean | null | Filter by active status |

#### Create Hardware Example

```json
{
  "hardware_type": "Laptop",
  "tracking_id": "MacBook-001",
  "serial_number": "C02XYZ123ABC",
  "model": "MacBook Pro 16",
  "assignment_date": "2024-01-15T00:00:00Z"
}
```

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
| **Worker Hardwares** |||||
| 11 | POST | `/objects/workers/hardwares?worker_oid={worker_oid}` | Create hardware | `objects:workers:edit` |
| 12 | GET | `/objects/workers/hardwares?worker_oid={worker_oid}` | List hardware | `objects:workers:read` |
| 13 | GET | `/objects/workers/hardwares/detail?worker_oid={worker_oid}&hardware_oid={hardware_oid}` | Get hardware | `objects:workers:read` |
| 14 | PUT | `/objects/workers/hardwares/detail?worker_oid={worker_oid}&hardware_oid={hardware_oid}` | Update hardware | `objects:workers:edit` |
| 15 | DELETE | `/objects/workers/hardwares/detail?worker_oid={worker_oid}&hardware_oid={hardware_oid}` | Delete hardware | `objects:workers:edit` |

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Cascade Behavior

- Deleting a hierarchy node cascades to all children.
- Deleting a worker cascades to `account_worker`, `worker_hierarchy_role`, `worker_profiles`, and worker hardware rows.
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

class ArticleResponse(BaseModel):
    oid: str
    stable_id: Optional[str]
    service_catalog_id: str
    effective_version_number: int
    is_active: bool
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
