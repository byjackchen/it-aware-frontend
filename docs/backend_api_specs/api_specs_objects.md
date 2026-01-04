# Objects Module API Specifications

## Overview

The Objects module manages all business entities in the system. These entities are automatically registered in the Global Registry for unified lookup.

### Module Structure

```
/objects/
├── /organizations   - Organization hierarchy management
├── /locations       - Location hierarchy management
├── /workers         - Worker (employee) management
├── /tickets         - Ticket management with ABAC filtering
└── /worker-hierarchy-roles - Role assignments at hierarchy nodes
```

---

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Edit Permission |
|----------|----------------|-----------------|
| Organizations | `objects:organizations:read` | `objects:organizations:edit` |
| Locations | `objects:locations:read` | `objects:locations:edit` |
| Workers | `objects:workers:read` | `objects:workers:edit` |
| Tickets | `objects:tickets:read` | `objects:tickets:write` |
| Worker-Hierarchy-Roles | `objects:worker_hierarchy_roles:read` | `objects:worker_hierarchy_roles:edit` |

**Note:** Tickets use `write` action (not `edit`) for create/update/delete operations.

---

## Data Models

### Hierarchy (Shared Base)

All hierarchical entities share a common `objects.hierarchies` table for path management.

```python
class Hierarchy(Base):
    __tablename__ = "hierarchies"
    __table_args__ = {"schema": "objects"}

    oid = Column(BYTEA(16), primary_key=True)
    object_type = Column(Text, nullable=False)  # 'organization' | 'location'
    parent_oid = Column(BYTEA(16), ForeignKey("objects.hierarchies.oid"))
    path = Column(ARRAY(BYTEA(16)), nullable=False)  # [root, ..., self]
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
```

### Organization

```python
class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = {"schema": "hierarchies"}

    oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid", ondelete="CASCADE"), primary_key=True)
    name = Column(Text, nullable=False)
    stable_id = Column(Text, unique=True, nullable=True)  # External ID (e.g., Workday tencent_org_id)
    type = Column(Text, nullable=False)  # Top Level/Business Group/Line/Center/Department/Team
```

### Location

```python
class Location(Base):
    __tablename__ = "locations"
    __table_args__ = {"schema": "hierarchies"}

    oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid", ondelete="CASCADE"), primary_key=True)
    name = Column(Text, nullable=False)
    type = Column(Text, nullable=False)  # root/region/country/office_location/remote_location
    timezone = Column(Text, nullable=False)  # IANA Time Zone ID (e.g., "America/New_York")
    stable_id = Column(Text, unique=True, nullable=True)  # External identifier for stable referencing
```

### Worker

```python
class Worker(Base):
    __tablename__ = "workers"
    __table_args__ = {"schema": "objects"}

    oid = Column(BYTEA(16), primary_key=True)
    worker_id = Column(Text, unique=True, nullable=True)  # External employee ID
    full_name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=True)
    org_oid = Column(BYTEA(16), ForeignKey("objects.hierarchies.oid"), nullable=False)
    manager_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)
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
    org_oid = Column(BYTEA(16), ForeignKey("objects.hierarchies.oid"), nullable=False)
    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=False)
    status = Column(Text, default="open")
    title = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## API 1: Organizations (`/objects/organizations`)

### Schemas

```python
class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_oid: Optional[str] = None  # 22-char base64url
    stable_id: Optional[str] = None  # External stable identifier
    type: str  # Top Level/Business Group/Line/Center/Department/Team

class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_oid: Optional[str] = None  # null/empty to make root
    stable_id: Optional[str] = None
    type: Optional[str] = None

class OrganizationResponse(BaseModel):
    oid: str
    name: str
    stable_id: Optional[str] = None
    type: str
    parent_oid: Optional[str] = None
    path: List[str] = []  # Ancestry from root to self
    created_at: datetime
    updated_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/organizations` | Create organization | `objects:organizations:edit` |
| GET | `/objects/organizations` | List organizations | `objects:organizations:read` |
| GET | `/objects/organizations/{oid}` | Get organization | `objects:organizations:read` |
| PUT | `/objects/organizations/{oid}` | Update organization | `objects:organizations:edit` |
| DELETE | `/objects/organizations/{oid}` | Delete organization | `objects:organizations:edit` |

---

### 1.1 Create Organization

**`POST /objects/organizations`**

**Permission:** `objects:organizations:edit`

**Request Body:**

```json
{
  "name": "Engineering",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "stable_id": "1263",
  "type": "Department"
}
```

**Response (201 Created):**

```json
{
  "oid": "01JFXYZ987654321GHIJKL",
  "name": "Engineering",
  "stable_id": "1263",
  "type": "Department",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "path": ["01JFXYZ123456789ABCDEF", "01JFXYZ987654321GHIJKL"],
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Parent not found | `{"detail": "Parent organization not found"}` |

---

### 1.2 List Organizations

**`GET /objects/organizations`**

**Permission:** `objects:organizations:read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

---

### 1.3 Get Organization

**`GET /objects/organizations/{oid}`**

**Permission:** `objects:organizations:read`

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Not found | `{"detail": "Organization not found"}` |

---

### 1.4 Update Organization

**`PUT /objects/organizations/{oid}`**

**Permission:** `objects:organizations:edit`

When `parent_oid` is changed, paths are automatically recalculated via `objects.update_hierarchy_path()`.

**Request Body:**

```json
{
  "name": "Engineering Team",
  "parent_oid": "01JFXYZNEWPARENT123456"
}
```

---

### 1.5 Delete Organization

**`DELETE /objects/organizations/{oid}`**

**Permission:** `objects:organizations:edit`

**Response:** `204 No Content`

**Note:** Cascades to all child organizations.

---

## API 2: Locations (`/objects/locations`)

### Schemas

```python
class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_oid: Optional[str] = None
    type: str = Field(
        ...,
        description="Location type: root/region/country/office_location/remote_location (mandatory)"
    )
    timezone: str = Field(
        ...,
        description="IANA Time Zone ID (e.g., 'America/New_York'), use empty string if not applicable (mandatory)"
    )

class LocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_oid: Optional[str] = None
    type: Optional[str] = Field(
        None,
        description="Location type: root/region/country/office_location/remote_location"
    )
    timezone: Optional[str] = Field(
        None,
        description="IANA Time Zone ID (e.g., 'America/New_York')"
    )

class LocationResponse(BaseModel):
    oid: str
    name: str
    type: str
    timezone: str
    parent_oid: Optional[str] = None
    path: List[str] = []
    created_at: datetime
    updated_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/locations` | Create location | `objects:locations:edit` |
| GET | `/objects/locations` | List locations | `objects:locations:read` |
| GET | `/objects/locations/{oid}` | Get location | `objects:locations:read` |
| PUT | `/objects/locations/{oid}` | Update location | `objects:locations:edit` |
| DELETE | `/objects/locations/{oid}` | Delete location | `objects:locations:edit` |

---

### 2.1-2.5 Location CRUD

Same patterns as Organizations. Endpoints operate on `/objects/locations` with `objects:locations:*` permissions.

---

### Location Type Values

The `type` field indicates the hierarchy level of a location:

| Type | Description | Example | Parent Type |
|------|-------------|---------|-------------|
| `root` | Root hierarchy node | "Tencent Location Hierarchy" | None |
| `region` | Geographic region | "Americas", "Europe", "APAC 1" | root |
| `country` | Country | "USA", "China", "Japan" | region |
| `office_location` | Physical office location | "US-California-Palo Alto" | country |
| `remote_location` | Remote work location | "US-Idaho" | country |

**Notes**:
- Only leaf nodes can be `office_location` or `remote_location`
- Root, region, and country are hierarchy containers
- Type is automatically determined by the Workday load script based on hierarchy depth and source data
- Type is **mandatory** - all locations must have a type value
- Timezone is also **mandatory** - use empty string if timezone is not applicable

---

### Location Request/Response Examples

**Create Root Location**:
```json
{
  "name": "Tencent Location Hierarchy",
  "type": "root",
  "timezone": ""
}
```

**Create Country Location**:
```json
{
  "name": "USA",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "type": "country",
  "timezone": ""
}
```

**Create Office Location with Timezone**:
```json
{
  "name": "US-California-Palo Alto",
  "parent_oid": "01JFXYZ987654321GHIJKL",
  "type": "office_location",
  "timezone": "America/Los_Angeles"
}
```

**Create Remote Location**:
```json
{
  "name": "US-Idaho",
  "parent_oid": "01JFXYZ987654321GHIJKL",
  "type": "remote_location",
  "timezone": "America/Denver"
}
```

**Response Example**:
```json
{
  "oid": "01JFZYX987654321GHIJKL",
  "name": "US-California-Palo Alto",
  "type": "office_location",
  "timezone": "America/Los_Angeles",
  "parent_oid": "01JFXYZ987654321GHIJKL",
  "path": [
    "01JFXYZ123456789ABCDEF",
    "01JFXYZ987654321GHIJKL",
    "01JFZYX987654321GHIJKL"
  ],
  "created_at": "2026-01-04T00:00:00Z",
  "updated_at": "2026-01-04T00:00:00Z"
}
```

---

## API 3: Workers (`/objects/workers`)

### Schemas

```python
class WorkerCreate(BaseModel):
    worker_id: Optional[str] = Field(None, max_length=255)  # External ID
    full_name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    org_oid: str  # Required - organization OID
    manager_oid: Optional[str] = None
    is_active: bool = True

class WorkerUpdate(BaseModel):
    worker_id: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    org_oid: Optional[str] = None
    manager_oid: Optional[str] = None  # Empty string to clear
    is_active: Optional[bool] = None

class WorkerResponse(BaseModel):
    oid: str
    worker_id: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    org_oid: str
    manager_oid: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/workers` | Create worker | `objects:workers:edit` |
| GET | `/objects/workers` | List workers | `objects:workers:read` |
| GET | `/objects/workers/{oid}` | Get worker | `objects:workers:read` |
| PUT | `/objects/workers/{oid}` | Update worker | `objects:workers:edit` |
| DELETE | `/objects/workers/{oid}` | Delete worker | `objects:workers:edit` |

---

### 3.1 Create Worker

**`POST /objects/workers`**

**Permission:** `objects:workers:edit`

**Request Body:**

```json
{
  "worker_id": "EMP001",
  "full_name": "Alice Smith",
  "email": "alice@example.com",
  "org_oid": "01JFXYZORG123456789AB",
  "manager_oid": "01JFXYZWRK123456789AB",
  "is_active": true
}
```

**Response (201 Created):**

```json
{
  "oid": "01JFXYZWRK234567890AB",
  "worker_id": "EMP001",
  "full_name": "Alice Smith",
  "email": "alice@example.com",
  "org_oid": "01JFXYZORG123456789AB",
  "manager_oid": "01JFXYZWRK123456789AB",
  "is_active": true,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Organization not found | `{"detail": "Organization not found"}` |
| 404 | Manager not found | `{"detail": "Manager not found"}` |
| 409 | Worker ID exists | `{"detail": "Worker ID already exists"}` |
| 409 | Email exists | `{"detail": "Email already in use"}` |

---

### 3.2 List Workers

**`GET /objects/workers`**

**Permission:** `objects:workers:read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `org_oid` | string | null | Filter by organization |
| `is_active` | boolean | null | Filter by active status |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

---

### 3.3-3.5 Get/Update/Delete Worker

Standard CRUD operations. Delete cascades to `account_worker` and `worker_hierarchy_role`.

---

## API 4: Tickets (`/objects/tickets`)

Tickets implement ABAC (Attribute-Based Access Control) filtering based on the user's permissions and hierarchy assignments.

### Schemas

```python
class TicketCreate(BaseModel):
    org_oid: str  # Organization OID
    status: str = "open"
    title: str

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None

class TicketResponse(BaseModel):
    oid: str
    org_oid: str
    worker_oid: str  # Automatically set to current user's linked worker
    status: str
    title: str
    created_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/tickets` | Create ticket | `objects:tickets:write` |
| GET | `/objects/tickets` | List tickets (ABAC filtered) | `objects:tickets:read` |
| GET | `/objects/tickets/{oid}` | Get ticket (ABAC check) | `objects:tickets:read` |
| PUT | `/objects/tickets/{oid}` | Update ticket (ABAC check) | `objects:tickets:write` |
| DELETE | `/objects/tickets/{oid}` | Delete ticket (ABAC check) | `objects:tickets:write` |

---

### 4.1 Create Ticket

**`POST /objects/tickets`**

**Permission:** `objects:tickets:write`

Creates a ticket owned by the current user's linked worker. System accounts cannot create tickets.

**Request Body:**

```json
{
  "org_oid": "01JFXYZORG123456789AB",
  "status": "open",
  "title": "Server issue"
}
```

**Response (201 Created):**

```json
{
  "oid": "01JFXYZTKT234567890AB",
  "org_oid": "01JFXYZORG123456789AB",
  "worker_oid": "01JFXYZWRK234567890AB",
  "status": "open",
  "title": "Server issue",
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 403 | No linked worker | `{"detail": "Cannot create ticket: account has no linked worker"}` |
| 404 | Organization not found | `{"detail": "Organization not found"}` |

---

### 4.2 List Tickets (ABAC Filtered)

**`GET /objects/tickets`**

**Permission:** `objects:tickets:read`

Results are filtered based on ABAC rules:
- **Unconstrained scope**: Sees all tickets
- **Self-scoped**: Sees only tickets where `worker_oid` matches user's linked worker
- **Role-based**: Sees tickets within assigned hierarchy nodes

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | null | Filter by status |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

---

### 4.3 Get Ticket

**`GET /objects/tickets/{oid}`**

**Permission:** `objects:tickets:read`

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 403 | ABAC denied | `{"detail": "Access denied to this ticket"}` |
| 404 | Not found | `{"detail": "Ticket not found"}` |

---

### 4.4 Update Ticket

**`PUT /objects/tickets/{oid}`**

**Permission:** `objects:tickets:write`

**Request Body:**

```json
{
  "status": "in_progress",
  "title": "Updated title"
}
```

---

### 4.5 Delete Ticket

**`DELETE /objects/tickets/{oid}`**

**Permission:** `objects:tickets:write`

**Response:** `204 No Content`

---

## API 5: Worker-Hierarchy-Roles (`/objects/worker-hierarchy-roles`)

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

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/worker-hierarchy-roles` | Create assignment | `objects:worker_hierarchy_roles:edit` |
| GET | `/objects/worker-hierarchy-roles` | List assignments | `objects:worker_hierarchy_roles:read` |
| DELETE | `/objects/worker-hierarchy-roles/{worker}/{role}/{hierarchy}` | Remove assignment | `objects:worker_hierarchy_roles:edit` |

---

### 5.1 Create Worker-Hierarchy-Role

**`POST /objects/worker-hierarchy-roles`**

**Permission:** `objects:worker_hierarchy_roles:edit`

**Request Body:**

```json
{
  "worker_oid": "01JFXYZWRK234567890AB",
  "role_oid": "01JFXYZROLE23456789AB",
  "hierarchy_oid": "01JFXYZORG123456789AB"
}
```

**Response (201 Created):**

```json
{
  "worker_oid": "01JFXYZWRK234567890AB",
  "role_oid": "01JFXYZROLE23456789AB",
  "hierarchy_oid": "01JFXYZORG123456789AB",
  "assigned_at": "2025-01-01T00:00:00Z"
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Worker not found | `{"detail": "Worker not found"}` |
| 404 | Role not found | `{"detail": "Role not found"}` |
| 404 | Hierarchy not found | `{"detail": "Hierarchy node not found"}` |
| 409 | Already exists | `{"detail": "Assignment already exists"}` |

---

### 5.2 List Worker-Hierarchy-Roles

**`GET /objects/worker-hierarchy-roles`**

**Permission:** `objects:worker_hierarchy_roles:read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `worker_oid` | string | null | Filter by worker |
| `role_oid` | string | null | Filter by role |
| `hierarchy_oid` | string | null | Filter by hierarchy |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

---

### 5.3 Delete Worker-Hierarchy-Role

**`DELETE /objects/worker-hierarchy-roles/{worker_oid}/{role_oid}/{hierarchy_oid}`**

**Permission:** `objects:worker_hierarchy_roles:edit`

**Response:** `204 No Content`

---

## API Endpoint Summary

| # | Method | Path | Description | Permission |
|---|--------|------|-------------|------------|
| **Organizations** |||||
| 1 | POST | `/objects/organizations` | Create organization | `objects:organizations:edit` |
| 2 | GET | `/objects/organizations` | List organizations | `objects:organizations:read` |
| 3 | GET | `/objects/organizations/{oid}` | Get organization | `objects:organizations:read` |
| 4 | PUT | `/objects/organizations/{oid}` | Update organization | `objects:organizations:edit` |
| 5 | DELETE | `/objects/organizations/{oid}` | Delete organization | `objects:organizations:edit` |
| **Locations** |||||
| 6 | POST | `/objects/locations` | Create location | `objects:locations:edit` |
| 7 | GET | `/objects/locations` | List locations | `objects:locations:read` |
| 8 | GET | `/objects/locations/{oid}` | Get location | `objects:locations:read` |
| 9 | PUT | `/objects/locations/{oid}` | Update location | `objects:locations:edit` |
| 10 | DELETE | `/objects/locations/{oid}` | Delete location | `objects:locations:edit` |
| **Workers** |||||
| 11 | POST | `/objects/workers` | Create worker | `objects:workers:edit` |
| 12 | GET | `/objects/workers` | List workers | `objects:workers:read` |
| 13 | GET | `/objects/workers/{oid}` | Get worker | `objects:workers:read` |
| 14 | PUT | `/objects/workers/{oid}` | Update worker | `objects:workers:edit` |
| 15 | DELETE | `/objects/workers/{oid}` | Delete worker | `objects:workers:edit` |
| **Tickets** |||||
| 16 | POST | `/objects/tickets` | Create ticket | `objects:tickets:write` |
| 17 | GET | `/objects/tickets` | List tickets (ABAC) | `objects:tickets:read` |
| 18 | GET | `/objects/tickets/{oid}` | Get ticket (ABAC) | `objects:tickets:read` |
| 19 | PUT | `/objects/tickets/{oid}` | Update ticket (ABAC) | `objects:tickets:write` |
| 20 | DELETE | `/objects/tickets/{oid}` | Delete ticket (ABAC) | `objects:tickets:write` |
| **Worker-Hierarchy-Roles** |||||
| 21 | POST | `/objects/worker-hierarchy-roles` | Create assignment | `objects:worker_hierarchy_roles:edit` |
| 22 | GET | `/objects/worker-hierarchy-roles` | List assignments | `objects:worker_hierarchy_roles:read` |
| 23 | DELETE | `/objects/worker-hierarchy-roles/{w}/{r}/{h}` | Delete assignment | `objects:worker_hierarchy_roles:edit` |

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

### Organization Example

```bash
# Create root org
curl -X POST http://localhost:8000/objects/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'

# Create child org
curl -X POST http://localhost:8000/objects/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering", "parent_oid": "<parent_oid>"}'

# List all
curl http://localhost:8000/objects/organizations \
  -H "Authorization: Bearer $TOKEN"
```

### Worker Example

```bash
# Create worker
curl -X POST http://localhost:8000/objects/workers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "EMP001",
    "full_name": "Alice Smith",
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
  -d '{"org_oid": "<org_oid>", "title": "Server issue"}'

# List tickets (ABAC filtered)
curl http://localhost:8000/objects/tickets -b cookies.txt
```

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Path Semantics

- The `path` field contains ancestry from root to self
- Automatically maintained by `objects.update_hierarchy_path()` trigger

### Cascade Behavior

- Deleting a hierarchy node cascades to all children
- Deleting a worker cascades to `account_worker` and `worker_hierarchy_role`

### ABAC Filtering

Tickets implement row-level security based on:
- **unconstrained**: Full access to all tickets
- **self_scoped**: Access only to own tickets (`worker_oid` = current worker)
- **role_based**: Access to tickets within assigned hierarchy nodes
