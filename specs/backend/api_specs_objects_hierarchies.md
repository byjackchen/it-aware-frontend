# Hierarchies Module API Specifications

## Overview

The Hierarchies module manages all hierarchical entities in the system. These entities share a common `hierarchies.nodes` table for path management and can be nested to create tree structures.

### Module Structure

```
/hierarchies/
├── /organizations      - Organization hierarchy management
├── /locations          - Location hierarchy management
└── /service-catalogs   - IT Service Catalog management
```

---

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Edit Permission |
|----------|-----------------|-----------------|
| Organizations | `objects:organizations:read` | `objects:organizations:edit` |
| Locations | `objects:locations:read` | `objects:locations:edit` |
| Service Catalogs | `objects:service_catalogs:read` | `objects:service_catalogs:edit` |

---

## Data Models

### Hierarchy (Shared Base)

All hierarchical entities share a common `hierarchies.nodes` table for path management.

```python
class Hierarchy(Base):
    __tablename__ = "nodes"
    __table_args__ = {"schema": "hierarchies"}

    oid = Column(BYTEA(16), primary_key=True)
    object_type = Column(Text, nullable=False)  # 'organization' | 'location' | 'service_catalog'
    parent_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"))
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
    is_active = Column(Boolean, default=True)  # Soft deletion flag
    metadata = Column(JSONB, nullable=True)  # Denormalized context (bg, line, department, center, team)
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
    stable_id = Column(Text, unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
```

### Service Catalog

```python
class ServiceCatalog(Base):
    __tablename__ = "service_catalogs"
    __table_args__ = {"schema": "hierarchies"}

    oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid", ondelete="CASCADE"), primary_key=True)
    name = Column(Text, nullable=False)
    stable_id = Column(Text, unique=True, nullable=True)  # External identifier
    is_active = Column(Boolean, default=True)
```

---

## API 1: Organizations (`/objects/organizations`)

### Schemas

```python
class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_oid: Optional[str] = None
    stable_id: Optional[str] = None
    type: str  # Top Level/Business Group/Line/Center/Department/Team
    is_active: bool = True

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    parent_oid: Optional[str] = None
    stable_id: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None

class OrganizationResponse(BaseModel):
    oid: str
    name: str
    stable_id: Optional[str] = None
    type: str
    parent_oid: Optional[str] = None
    path: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

class OrganizationListResponse(BaseModel):
    items: List[OrganizationResponse]
    total: int
    skip: int
    limit: int
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/organizations` | Create organization | `objects:organizations:edit` |
| GET | `/objects/organizations` | List organizations | `objects:organizations:read` |
| GET | `/objects/organizations/{oid}` | Get organization | `objects:organizations:read` |
| PUT | `/objects/organizations/{oid}` | Update organization | `objects:organizations:edit` |
| DELETE | `/objects/organizations/{oid}` | Delete organization | `objects:organizations:edit` |

### Create Organization

**`POST /objects/organizations`**

```json
{
  "name": "Engineering",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "stable_id": "1263",
  "type": "Department"
}
```

**Response (201):**
```json
{
  "oid": "01JFXYZ987654321GHIJKL",
  "name": "Engineering",
  "stable_id": "1263",
  "type": "Department",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "path": ["01JFXYZ123456789ABCDEF", "01JFXYZ987654321GHIJKL"],
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

---

## API 2: Locations (`/objects/locations`)

### Schemas

```python
class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_oid: Optional[str] = None
    type: str  # root/region/country/office_location/remote_location (mandatory)
    timezone: str  # IANA Time Zone ID, use empty string if N/A (mandatory)
    stable_id: Optional[str] = None
    is_active: bool = True

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    parent_oid: Optional[str] = None
    type: Optional[str] = None
    timezone: Optional[str] = None
    stable_id: Optional[str] = None
    is_active: Optional[bool] = None

class LocationResponse(BaseModel):
    oid: str
    name: str
    type: str
    timezone: str
    stable_id: Optional[str] = None
    parent_oid: Optional[str] = None
    path: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

class LocationListResponse(BaseModel):
    items: List[LocationResponse]
    total: int
    skip: int
    limit: int
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/locations` | Create location | `objects:locations:edit` |
| GET | `/objects/locations` | List locations | `objects:locations:read` |
| GET | `/objects/locations/{oid}` | Get location | `objects:locations:read` |
| PUT | `/objects/locations/{oid}` | Update location | `objects:locations:edit` |
| DELETE | `/objects/locations/{oid}` | Delete location | `objects:locations:edit` |

### Location Type Values

| Type | Description | Example |
|------|-------------|---------|
| `root` | Root hierarchy node | "Tencent Location Hierarchy" |
| `region` | Geographic region | "Americas", "APAC 1" |
| `country` | Country | "USA", "China" |
| `office_location` | Physical office | "US-California-Palo Alto" |
| `remote_location` | Remote work location | "US-Idaho" |

### Create Location Example

```json
{
  "name": "US-California-Palo Alto",
  "parent_oid": "01JFXYZ987654321GHIJKL",
  "type": "office_location",
  "timezone": "America/Los_Angeles"
}
```

---

## API 3: Service Catalogs (`/objects/service-catalogs`)

### Schemas

```python
class ServiceCatalogCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_oid: Optional[str] = None
    stable_id: Optional[str] = None
    is_active: bool = True

class ServiceCatalogUpdate(BaseModel):
    name: Optional[str] = None
    parent_oid: Optional[str] = None
    stable_id: Optional[str] = None
    is_active: Optional[bool] = None

class ServiceCatalogResponse(BaseModel):
    oid: str
    name: str
    stable_id: Optional[str] = None
    parent_oid: Optional[str] = None
    path: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

class ServiceCatalogListResponse(BaseModel):
    items: List[ServiceCatalogResponse]
    total: int
    skip: int
    limit: int
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/service-catalogs` | Create entry | `objects:service_catalogs:edit` |
| GET | `/objects/service-catalogs` | List entries | `objects:service_catalogs:read` |
| GET | `/objects/service-catalogs/{oid}` | Get entry | `objects:service_catalogs:read` |
| PUT | `/objects/service-catalogs/{oid}` | Update entry | `objects:service_catalogs:edit` |
| DELETE | `/objects/service-catalogs/{oid}` | Delete entry | `objects:service_catalogs:edit` |

### Create Service Catalog Example

```json
{
  "name": "End-User Computing",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "stable_id": "123"
}
```

**Response (201):**
```json
{
  "oid": "01JFXYZ987654321GHIJKL",
  "name": "End-User Computing",
  "stable_id": "123",
  "parent_oid": "01JFXYZ123456789ABCDEF",
  "path": ["01JFXYZ123456789ABCDEF", "01JFXYZ987654321GHIJKL"],
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

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
| **Service Catalogs** |||||
| 11 | POST | `/objects/service-catalogs` | Create entry | `objects:service_catalogs:edit` |
| 12 | GET | `/objects/service-catalogs` | List entries | `objects:service_catalogs:read` |
| 13 | GET | `/objects/service-catalogs/{oid}` | Get entry | `objects:service_catalogs:read` |
| 14 | PUT | `/objects/service-catalogs/{oid}` | Update entry | `objects:service_catalogs:edit` |
| 15 | DELETE | `/objects/service-catalogs/{oid}` | Delete entry | `objects:service_catalogs:edit` |

---

## Common Query Parameters

All list endpoints support pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |
| `stable_id` | string | null | Filter by stable_id (exact match) |
| `is_active` | boolean | null | Filter by active status (true/false) |

## List Response Contract

All hierarchy list APIs return the same paginated envelope:

```json
{
  "items": [
    {
      "oid": "01JFXYZ123456789ABCDEF",
      "stable_id": "1263"
    }
  ],
  "total": 2458,
  "skip": 0,
  "limit": 100
}
```

- Applies to:
  - `GET /objects/organizations`
  - `GET /objects/locations`
  - `GET /objects/service-catalogs`
- `total` is the filtered full count.
- `items` are stably ordered by `oid` ascending to keep `skip/limit` deterministic.

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Path Semantics

- The `path` field contains ancestry from root to self
- Automatically maintained by `hierarchies.update_path()` function

### Cascade Behavior

- Deleting a hierarchy node cascades to all children
- Foreign key constraints ensure referential integrity

### Parent Updates

When `parent_oid` is changed, paths are automatically recalculated for the node and all descendants.
