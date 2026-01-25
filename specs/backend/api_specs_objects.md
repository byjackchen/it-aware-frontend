# Objects Module API Specifications

## Overview

The Objects module manages business entities that are not hierarchical but interact with hierarchies. Workers belong to organizations and locations, and tickets are owned by workers within organizations. These entities are automatically registered in the Global Registry for unified lookup.

### Module Structure

```
/objects/
├── /workers                - Worker (employee) management
│   └── /{worker_oid}/hardwares - Hardware assigned to workers
├── /tickets                - Ticket management with ABAC filtering
└── /worker-hierarchy-roles - Role assignments at hierarchy nodes
```

> [!NOTE]
> **Organizations and Locations** have been moved to [api_specs_hierarchies.md](./api_specs_hierarchies.md) as they are hierarchical entities.

---

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Edit Permission |
|----------|-----------------|-----------------|
| Workers | `objects:workers:read` | `objects:workers:edit` |
| Tickets | `objects:tickets:read` | `objects:tickets:write` |
| Worker-Hierarchy-Roles | `objects:worker_hierarchy_roles:read` | `objects:worker_hierarchy_roles:edit` |

**Note:** Tickets use `write` action (not `edit`) for create/update/delete operations.

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

### Ticket

```python
class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = {"schema": "objects"}

    oid = Column(BYTEA(16), primary_key=True)
    requester_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=False)
    status = Column(Text, default="open")
    title = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)  # Soft deletion flag
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## API 1: Workers (`/objects/workers`)

### Schemas

```python
class WorkerCreate(BaseModel):
    worker_id: Optional[str] = Field(None, max_length=255)
    stable_id: str = Field(..., max_length=255)
    fullname: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
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
    is_active: bool = True

class WorkerUpdate(BaseModel):
    worker_id: Optional[str] = None
    stable_id: Optional[str] = None
    fullname: Optional[str] = None
    email: Optional[EmailStr] = None
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
    is_active: Optional[bool] = None

class WorkerResponse(BaseModel):
    oid: str
    worker_id: Optional[str] = None
    stable_id: str
    fullname: str
    email: Optional[str] = None
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
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/workers` | Create worker | `objects:workers:edit` |
| GET | `/objects/workers` | List workers | `objects:workers:read` |
| GET | `/objects/workers/{oid}` | Get worker | `objects:workers:read` |
| PUT | `/objects/workers/{oid}` | Update worker | `objects:workers:edit` |
| DELETE | `/objects/workers/{oid}` | Delete worker | `objects:workers:edit` |

> [!NOTE]
> Deleting a worker cascades to `account_worker` and `worker_hierarchy_role`.

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Organization not found | `{"detail": "Organization not found"}` |
| 404 | Manager not found | `{"detail": "Manager not found"}` |
| 409 | Worker ID exists | `{"detail": "Worker ID already exists"}` |
| 409 | Email exists | `{"detail": "Email already in use"}` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `org_oid` | string | null | Filter by organization |
| `is_active` | boolean | null | Filter by active status |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

### Create Worker Example

```json
{
  "worker_id": "EMP001",
  "stable_id": "asmith",
  "fullname": "Alice Smith",
  "email": "alice@example.com",
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

#### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/workers/{worker_oid}/hardwares` | Create hardware | `objects:workers:edit` |
| GET | `/objects/workers/{worker_oid}/hardwares` | List hardware | `objects:workers:read` |
| GET | `/objects/workers/{worker_oid}/hardwares/{oid}` | Get hardware | `objects:workers:read` |
| PUT | `/objects/workers/{worker_oid}/hardwares/{oid}` | Update hardware | `objects:workers:edit` |
| DELETE | `/objects/workers/{worker_oid}/hardwares/{oid}` | Delete hardware | `objects:workers:edit` |

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

## API 2: Tickets (`/objects/tickets`)

Tickets implement ABAC (Attribute-Based Access Control) filtering.

### Schemas

```python
class TicketCreate(BaseModel):
    requester_oid: Optional[str] = None  # Optional owner (system accounts must provide this)
    status: str = "open"
    title: str
    is_active: bool = True

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    is_active: Optional[bool] = None

class TicketResponse(BaseModel):
    oid: str
    requester_oid: str  # Automatically set to current user's linked worker
    status: str
    title: str
    is_active: bool
    created_at: datetime
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/tickets` | Create ticket | `objects:tickets:write` |
| GET | `/objects/tickets` | List tickets (ABAC) | `objects:tickets:read` |
| GET | `/objects/tickets/{oid}` | Get ticket (ABAC) | `objects:tickets:read` |
| PUT | `/objects/tickets/{oid}` | Update ticket (ABAC) | `objects:tickets:write` |
| DELETE | `/objects/tickets/{oid}` | Delete ticket (ABAC) | `objects:tickets:write` |

### Query Parameters (List)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | null | Filter by ticket status |
| `is_active` | boolean | null | Filter by active status |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

> [!IMPORTANT]
> Ticket ownership defaults to the current user's linked worker. To create a ticket for a specific worker (required for **System Accounts** or **On-Behalf-Of** creation), provide a valid `requester_oid`.

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing owner | `{"detail": "Cannot create ticket: must provide requester_oid or have a linked worker profile"}` |
| 403 | ABAC denied | `{"detail": "Access denied to this ticket"}` |
| 404 | Not found | `{"detail": "Ticket not found"}` |

### ABAC Filtering

Results are filtered based on user's access scope:
- **Unconstrained**: Sees all tickets
- **Self-scoped**: Sees only own tickets (`requester_oid` = current worker)
- **Role-based**: Sees tickets where the requester is within assigned hierarchy nodes (derived from requester's organization)

---

## API 3: Worker-Hierarchy-Roles (`/objects/worker-hierarchy-roles`)

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
| 3 | GET | `/objects/workers/{oid}` | Get worker | `objects:workers:read` |
| 4 | PUT | `/objects/workers/{oid}` | Update worker | `objects:workers:edit` |
| 5 | DELETE | `/objects/workers/{oid}` | Delete worker | `objects:workers:edit` |
| **Tickets** |||||
| 6 | POST | `/objects/tickets` | Create ticket | `objects:tickets:write` |
| 7 | GET | `/objects/tickets` | List tickets (ABAC) | `objects:tickets:read` |
| 8 | GET | `/objects/tickets/{oid}` | Get ticket (ABAC) | `objects:tickets:read` |
| 9 | PUT | `/objects/tickets/{oid}` | Update ticket (ABAC) | `objects:tickets:write` |
| 10 | DELETE | `/objects/tickets/{oid}` | Delete ticket (ABAC) | `objects:tickets:write` |
| **Worker-Hierarchy-Roles** |||||
| 11 | POST | `/objects/worker-hierarchy-roles` | Create assignment | `objects:worker_hierarchy_roles:edit` |
| 12 | GET | `/objects/worker-hierarchy-roles` | List assignments | `objects:worker_hierarchy_roles:read` |
| 13 | DELETE | `/objects/worker-hierarchy-roles/{w}/{r}/{h}` | Delete assignment | `objects:worker_hierarchy_roles:edit` |
| **Worker Hardwares** |||||
| 14 | POST | `/objects/workers/{worker_oid}/hardwares` | Create hardware | `objects:workers:edit` |
| 15 | GET | `/objects/workers/{worker_oid}/hardwares` | List hardware | `objects:workers:read` |
| 16 | GET | `/objects/workers/{worker_oid}/hardwares/{oid}` | Get hardware | `objects:workers:read` |
| 17 | PUT | `/objects/workers/{worker_oid}/hardwares/{oid}` | Update hardware | `objects:workers:edit` |
| 18 | DELETE | `/objects/workers/{worker_oid}/hardwares/{oid}` | Delete hardware | `objects:workers:edit` |

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Cascade Behavior

- Deleting a hierarchy node cascades to all children.
- Deleting a worker cascades to `account_worker` and `worker_hierarchy_role`.
- Foreign key constraints ensure referential integrity.

---

## API 4: Articles (`/objects/articles`)

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

### Ticket Example (with ABAC)

```bash
# Login as regular user (not system account)
curl -X POST http://localhost:8000/auth/session/token \
  -d "username=alice" -c cookies.txt

# Create ticket
curl -X POST http://localhost:8000/objects/tickets \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title": "Server issue"}'

# List tickets (ABAC filtered)
curl http://localhost:8000/objects/tickets -b cookies.txt
```

