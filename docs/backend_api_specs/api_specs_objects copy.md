# Objects Module API Specifications

## Overview

The Objects module manages business entities that are not hierarchical but interact with hierarchies. Workers belong to organizations and locations, and tickets are owned by workers within organizations.

### Module Structure

```
/objects/
├── /workers                - Worker (employee) management
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
    legal_first_name = Column(Text, nullable=False)
    legal_last_name = Column(Text, nullable=False)
    preferred_first_name = Column(Text, nullable=True)
    email = Column(Text, unique=True, nullable=True)
    gender = Column(Text, nullable=True)
    management_level = Column(Text, nullable=True)
    professional_level = Column(Text, nullable=True)
    org_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=False)
    location_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
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
    org_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=False)
    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=False)
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
    legal_first_name: str = Field(..., min_length=1, max_length=255)
    legal_last_name: str = Field(..., min_length=1, max_length=255)
    preferred_first_name: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    management_level: Optional[str] = None
    professional_level: Optional[str] = None
    org_oid: str  # Required
    location_oid: Optional[str] = None
    manager_oid: Optional[str] = None
    is_active: bool = True

class WorkerUpdate(BaseModel):
    worker_id: Optional[str] = None
    stable_id: Optional[str] = None
    legal_first_name: Optional[str] = None
    legal_last_name: Optional[str] = None
    preferred_first_name: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    management_level: Optional[str] = None
    professional_level: Optional[str] = None
    org_oid: Optional[str] = None
    location_oid: Optional[str] = None  # Empty string to clear
    manager_oid: Optional[str] = None  # Empty string to clear
    is_active: Optional[bool] = None

class WorkerResponse(BaseModel):
    oid: str
    worker_id: Optional[str] = None
    stable_id: str
    legal_first_name: str
    legal_last_name: str
    preferred_first_name: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    management_level: Optional[str] = None
    professional_level: Optional[str] = None
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
  "legal_first_name": "Alice",
  "legal_last_name": "Smith",
  "email": "alice@example.com",
  "org_oid": "01JFXYZORG123456789AB",
  "location_oid": "01JFXYZLOC123456789AB"
}
```

---

## API 2: Tickets (`/objects/tickets`)

Tickets implement ABAC (Attribute-Based Access Control) filtering.

### Schemas

```python
class TicketCreate(BaseModel):
    org_oid: str
    status: str = "open"
    title: str
    is_active: bool = True

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    is_active: Optional[bool] = None

class TicketResponse(BaseModel):
    oid: str
    org_oid: str
    worker_oid: str  # Automatically set to current user's linked worker
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

### ABAC Filtering

Results are filtered based on user's access scope:
- **Unconstrained**: Sees all tickets
- **Self-scoped**: Sees only own tickets (`worker_oid` = current worker)
- **Role-based**: Sees tickets within assigned hierarchy nodes

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

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Cascade Behavior

- Deleting a worker cascades to `account_worker` and `worker_hierarchy_role`
