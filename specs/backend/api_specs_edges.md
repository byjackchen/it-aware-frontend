# Edges Module API Specifications

## Overview

The Edges module provides APIs for managing relationships (edges) between objects in the global registry. Edges establish graph-like connections between any two registered objects, enabling relationship tracking, dependency mapping, and organizational hierarchy representation.

### Key Concepts

- **Edge**: A directional relationship between two objects (from_oid → to_oid)
- **Edge Type**: Categorizes the nature of the relationship (e.g., `assigned_to`, `reports_to`)
- **Edge Fact**: Optional textual description of the relationship
- **Composite Key**: Edges are uniquely identified by `(from_oid, to_oid, edge_type)`

---

## Data Model

### Database Schema

```
Schema: edges
Table: global_edges
```

### Entity Relationship

```
┌───────────────────┐         ┌───────────────────┐
│  registry.global  │         │  registry.global  │
│     (from_oid)    │         │     (to_oid)      │
└─────────┬─────────┘         └─────────┬─────────┘
          │                             │
          │ FK                          │ FK
          ▼                             ▼
┌─────────────────────────────────────────────────┐
│              edges.global_edges                  │
├─────────────────────────────────────────────────┤
│ PK: (from_oid, to_oid, edge_type)               │
│                                                  │
│ from_oid      BYTEA(16)  NOT NULL  FK           │
│ to_oid        BYTEA(16)  NOT NULL  FK           │
│ edge_type     VARCHAR(50) NOT NULL              │
│ edge_fact     TEXT                               │
│ edge_metadata JSONB                              │
│ is_active     BOOLEAN    DEFAULT TRUE           │
│ effective_at  TIMESTAMPTZ (nullable)            │
│ created_at    TIMESTAMPTZ DEFAULT NOW()         │
│ created_by    BYTEA(16)  FK (nullable)          │
└─────────────────────────────────────────────────┘
```

### SQLAlchemy Model

```python
class GlobalEdge(Base):
    __tablename__ = "global_edges"
    __table_args__ = {"schema": "edges"}

    from_oid = Column(BYTEA(16), ForeignKey("registry.global.oid"), primary_key=True)
    to_oid = Column(BYTEA(16), ForeignKey("registry.global.oid"), primary_key=True)
    edge_type = Column(String(50), primary_key=True)
    edge_fact = Column(Text, nullable=True)
    edge_metadata = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    effective_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(BYTEA(16), ForeignKey("registry.global.oid"), nullable=True)
```

---

## Predefined Edge Types

| Edge Type | Description | Typical Usage |
|-----------|-------------|---------------|
| `assigned_to` | Assignment relationship | Incident → Worker |
| `escalated_to` | Escalation relationship | Incident → Worker |
| `owned_by` | Ownership relationship | Any → Worker |
| `created_by` | Creation attribution | Any → Worker |
| `belongs_to` | Organizational membership | Worker → Organization |
| `located_at` | Location assignment | Worker → Location |
| `reports_to` | Reporting hierarchy | Worker → Worker |
| `related_to` | Generic relationship | Any → Any |
| `depends_on` | Dependency relationship | Any → Any |
| `blocked_by` | Blocker relationship | Incident → Incident |
| `duplicates` | Duplicate indication | Incident → Incident |
| `recurring_issue` | Worker has >= 3 activities against catalog | Worker → ServiceCatalog |
| `knowledge_relevant` | Article covers worker's pain catalog | Article → Worker |
| `feedback_cluster` | Analyses share catalog+semantic+intent | Analysis → Analysis |
| `topic_peer` | Workers share >= 2 profile topics | Worker → Worker |

### Custom Edge Types

Custom edge types are allowed and must match the pattern:
- Regex: `^[a-z][a-z0-9_]{0,49}$`
- Must start with a lowercase letter
- Can contain lowercase letters, numbers, and underscores
- Maximum 50 characters

---

## Pydantic Schemas

### Request Schemas

```python
class GlobalEdgeCreate(BaseModel):
    from_oid: str = Field(..., min_length=22, max_length=22, description="Source object OID (22-char base64url)")
    to_oid: str = Field(..., min_length=22, max_length=22, description="Target object OID (22-char base64url)")
    edge_type: str = Field(..., min_length=1, max_length=50, description="Relationship type")
    edge_fact: Optional[str] = Field(None, description="Factual description of the edge")
    is_active: bool = Field(True, description="Whether the edge is active")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional additional data")
```

### Response Schemas

```python
class GlobalEdgeResponse(BaseModel):
    from_oid: str
    to_oid: str
    edge_type: str
    edge_fact: Optional[str] = None
    is_active: bool
    metadata: Optional[Dict[str, Any]] = None
    effective_at: Optional[datetime] = None          # Derived from connected objects' dates
    created_at: datetime
    created_by: Optional[str] = None
    from_object: Optional[RegistryResponse] = None  # Included when include_objects=true
    to_object: Optional[RegistryResponse] = None    # Included when include_objects=true

class GlobalEdgeListResponse(BaseModel):
    items: List[GlobalEdgeResponse]
    total: int
    page: int
    page_size: int
```

---

## API Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/edges` | Create a new edge | Yes |
| GET | `/edges/types` | List predefined edge types | No |
| GET | `/edges/from/{oid}` | List edges from an object | Yes |
| GET | `/edges/to/{oid}` | List edges to an object | Yes |
| GET | `/edges/connected/{oid}` | List all edges connected to an object | Yes |
| GET | `/edges/{from_oid}/{to_oid}/{edge_type}` | Get a specific edge | Yes |
| DELETE | `/edges/{from_oid}/{to_oid}/{edge_type}` | Delete an edge | Yes |

---

## API 1: Create Edge

**`POST /edges`**

Creates a new directional edge between two objects.

### Request Body

```json
{
  "from_oid": "01JFXYZ123456789ABCDEF",
  "to_oid": "01JFXYZWORKER123456AB",
  "edge_type": "assigned_to",
  "edge_fact": "Assigned for urgent resolution",
  "is_active": true,
  "metadata": {
    "priority": "high",
    "assigned_by": "manager"
  }
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from_oid` | string | Yes | Source object OID (22-char base64url) |
| `to_oid` | string | Yes | Target object OID (22-char base64url) |
| `edge_type` | string | Yes | Relationship type (1-50 chars, lowercase) |
| `edge_fact` | string | No | Textual description of the relationship |
| `is_active` | boolean | No | Whether edge is active (default: `true`) |
| `metadata` | object | No | Additional JSON metadata |

### Response (201 Created)

```json
{
  "from_oid": "01JFXYZ123456789ABCDEF",
  "to_oid": "01JFXYZWORKER123456AB",
  "edge_type": "assigned_to",
  "edge_fact": "Assigned for urgent resolution",
  "is_active": true,
  "metadata": {
    "priority": "high",
    "assigned_by": "manager"
  },
  "effective_at": "2025-01-15T09:00:00Z",
  "created_at": "2025-01-15T10:30:00Z",
  "created_by": null,
  "from_object": {
    "oid": "01JFXYZ123456789ABCDEF",
    "object_type": "incident",
    "descriptor": "INC-2025-001",
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-15T09:00:00Z"
  },
  "to_object": {
    "oid": "01JFXYZWORKER123456AB",
    "object_type": "worker",
    "descriptor": "john.doe",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid OID format | `{"detail": "Invalid OID format: ..."}` |
| 400 | Invalid edge_type | `{"detail": "edge_type must be lowercase letters, numbers, and underscores only, starting with a letter"}` |
| 400 | Referenced OID doesn't exist | `{"detail": "Failed to create edge: ..."}` |
| 409 | Edge already exists | `{"detail": "Edge already exists"}` |

---

## API 2: List Edge Types

**`GET /edges/types`**

Returns all predefined edge types.

### Response (200 OK)

```json
[
  "assigned_to",
  "belongs_to",
  "blocked_by",
  "created_by",
  "depends_on",
  "duplicates",
  "escalated_to",
  "feedback_cluster",
  "knowledge_relevant",
  "located_at",
  "owned_by",
  "recurring_issue",
  "related_to",
  "reports_to",
  "topic_peer"
]
```

---

## API 3: List Edges From Object

**`GET /edges/from/{oid}`**

Lists all edges originating from a specific object.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `oid` | string | Source object OID (22-char base64url) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `edge_type` | string | null | Filter by edge type |
| `is_active` | boolean | null | Filter by active status |
| `effective_at_from` | datetime | null | Filter edges with effective_at >= this (UTC ISO8601) |
| `effective_at_to` | datetime | null | Filter edges with effective_at <= this (UTC ISO8601) |
| `include_objects` | boolean | false | Include from/to object details |
| `page` | integer | 1 | Page number (min: 1) |
| `page_size` | integer | 20 | Items per page (min: 1, max: 100) |

### Example Request

```
GET /edges/from/01JFXYZ123456789ABCDEF?edge_type=assigned_to&is_active=true&include_objects=true&page=1&page_size=20
```

### Response (200 OK)

```json
{
  "items": [
    {
      "from_oid": "01JFXYZ123456789ABCDEF",
      "to_oid": "01JFXYZWORKER123456AB",
      "edge_type": "assigned_to",
      "edge_fact": "Primary assignee",
      "is_active": true,
      "metadata": null,
      "created_at": "2025-01-15T10:30:00Z",
      "created_by": null,
      "from_object": {
        "oid": "01JFXYZ123456789ABCDEF",
        "object_type": "incident",
        "descriptor": "INC-2025-001",
        "created_at": "2025-01-15T09:00:00Z",
        "updated_at": "2025-01-15T09:00:00Z"
      },
      "to_object": {
        "oid": "01JFXYZWORKER123456AB",
        "object_type": "worker",
        "descriptor": "john.doe",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid OID format | `{"detail": "Invalid OID format"}` |

---

## API 4: List Edges To Object

**`GET /edges/to/{oid}`**

Lists all edges pointing to a specific object.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `oid` | string | Target object OID (22-char base64url) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `edge_type` | string | null | Filter by edge type |
| `is_active` | boolean | null | Filter by active status |
| `effective_at_from` | datetime | null | Filter edges with effective_at >= this (UTC ISO8601) |
| `effective_at_to` | datetime | null | Filter edges with effective_at <= this (UTC ISO8601) |
| `include_objects` | boolean | false | Include from/to object details |
| `page` | integer | 1 | Page number (min: 1) |
| `page_size` | integer | 20 | Items per page (min: 1, max: 100) |

### Example Request

```
GET /edges/to/01JFXYZWORKER123456AB?include_objects=true
```

### Response (200 OK)

```json
{
  "items": [
    {
      "from_oid": "01JFXYZ123456789ABCDEF",
      "to_oid": "01JFXYZWORKER123456AB",
      "edge_type": "assigned_to",
      "edge_fact": "Primary assignee",
      "is_active": true,
      "metadata": null,
      "effective_at": "2025-01-15T09:00:00Z",
      "created_at": "2025-01-15T10:30:00Z",
      "created_by": null,
      "from_object": {...},
      "to_object": {...}
    },
    {
      "from_oid": "01JFXYZTICKET2345678A",
      "to_oid": "01JFXYZWORKER123456AB",
      "edge_type": "escalated_to",
      "edge_fact": null,
      "is_active": true,
      "metadata": null,
      "effective_at": "2025-01-16T07:00:00Z",
      "created_at": "2025-01-16T08:00:00Z",
      "created_by": null,
      "from_object": {...},
      "to_object": {...}
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 20
}
```

---

## API 5: List Connected Edges

**`GET /edges/connected/{oid}`**

Lists all edges connected to an object (either as source or target).

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `oid` | string | Object OID (22-char base64url) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `edge_type` | string | null | Filter by edge type |
| `is_active` | boolean | null | Filter by active status |
| `effective_at_from` | datetime | null | Filter edges with effective_at >= this (UTC ISO8601) |
| `effective_at_to` | datetime | null | Filter edges with effective_at <= this (UTC ISO8601) |
| `include_objects` | boolean | false | Include from/to object details |
| `page` | integer | 1 | Page number (min: 1) |
| `page_size` | integer | 20 | Items per page (min: 1, max: 100) |

### Example Request

```
GET /edges/connected/01JFXYZWORKER123456AB?is_active=true
```

### Response (200 OK)

```json
{
  "items": [
    {
      "from_oid": "01JFXYZ123456789ABCDEF",
      "to_oid": "01JFXYZWORKER123456AB",
      "edge_type": "assigned_to",
      "edge_fact": null,
      "is_active": true,
      "metadata": null,
      "effective_at": "2025-01-15T09:00:00Z",
      "created_at": "2025-01-15T10:30:00Z",
      "created_by": null,
      "from_object": null,
      "to_object": null
    },
    {
      "from_oid": "01JFXYZWORKER123456AB",
      "to_oid": "01JFXYZMANAGER1234567",
      "edge_type": "reports_to",
      "edge_fact": "Direct report",
      "is_active": true,
      "metadata": null,
      "effective_at": "2025-01-01T00:00:00Z",
      "created_at": "2025-01-01T00:00:00Z",
      "created_by": null,
      "from_object": null,
      "to_object": null
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 20
}
```

---

## API 6: Get Specific Edge

**`GET /edges/{from_oid}/{to_oid}/{edge_type}`**

Retrieves a specific edge by its composite key.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from_oid` | string | Source object OID |
| `to_oid` | string | Target object OID |
| `edge_type` | string | Edge type |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_objects` | boolean | false | Include from/to object details |

### Example Request

```
GET /edges/01JFXYZ123456789ABCDEF/01JFXYZWORKER123456AB/assigned_to?include_objects=true
```

### Response (200 OK)

```json
{
  "from_oid": "01JFXYZ123456789ABCDEF",
  "to_oid": "01JFXYZWORKER123456AB",
  "edge_type": "assigned_to",
  "edge_fact": "Primary assignee",
  "is_active": true,
  "metadata": {
    "priority": "high"
  },
  "effective_at": "2025-01-15T09:00:00Z",
  "created_at": "2025-01-15T10:30:00Z",
  "created_by": null,
  "from_object": {
    "oid": "01JFXYZ123456789ABCDEF",
    "object_type": "incident",
    "descriptor": "INC-2025-001",
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-15T09:00:00Z"
  },
  "to_object": {
    "oid": "01JFXYZWORKER123456AB",
    "object_type": "worker",
    "descriptor": "john.doe",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid OID format | `{"detail": "Invalid OID format"}` |
| 404 | Edge not found | `{"detail": "Edge not found"}` |

---

## API 7: Delete Edge

**`DELETE /edges/{from_oid}/{to_oid}/{edge_type}`**

Deletes a specific edge.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from_oid` | string | Source object OID |
| `to_oid` | string | Target object OID |
| `edge_type` | string | Edge type |

### Example Request

```
DELETE /edges/01JFXYZ123456789ABCDEF/01JFXYZWORKER123456AB/assigned_to
```

### Response (204 No Content)

No body returned on success.

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid OID format | `{"detail": "Invalid OID format"}` |
| 404 | Edge not found | `{"detail": "Edge not found"}` |

---

## Testing with cURL

### Complete Edge Management Example

```bash
#!/bin/bash
BASE_URL="http://localhost:8000"

# Assume you have two existing objects in the registry
FROM_OID="01JFXYZ123456789ABCDEF"  # e.g., an incident
TO_OID="01JFXYZWORKER123456AB"     # e.g., a worker

# 1. List available edge types
echo "=== List Edge Types ==="
curl -s "$BASE_URL/edges/types" | jq

# 2. Create an edge
echo -e "\n=== Create Edge ==="
curl -s -X POST "$BASE_URL/edges" \
  -H "Content-Type: application/json" \
  -d '{
    "from_oid": "'"$FROM_OID"'",
    "to_oid": "'"$TO_OID"'",
    "edge_type": "assigned_to",
    "edge_fact": "Assigned for urgent resolution",
    "is_active": true,
    "metadata": {"priority": "high"}
  }' | jq

# 3. Get the specific edge
echo -e "\n=== Get Edge ==="
curl -s "$BASE_URL/edges/$FROM_OID/$TO_OID/assigned_to?include_objects=true" | jq

# 4. List edges from the source object
echo -e "\n=== List Edges From Object ==="
curl -s "$BASE_URL/edges/from/$FROM_OID?include_objects=true" | jq

# 5. List edges to the target object
echo -e "\n=== List Edges To Object ==="
curl -s "$BASE_URL/edges/to/$TO_OID" | jq

# 6. List all connected edges
echo -e "\n=== List Connected Edges ==="
curl -s "$BASE_URL/edges/connected/$TO_OID?is_active=true" | jq

# 7. Create another edge (different type)
echo -e "\n=== Create Another Edge ==="
curl -s -X POST "$BASE_URL/edges" \
  -H "Content-Type: application/json" \
  -d '{
    "from_oid": "'"$FROM_OID"'",
    "to_oid": "'"$TO_OID"'",
    "edge_type": "escalated_to",
    "edge_fact": "Escalated due to SLA breach"
  }' | jq

# 8. Delete an edge
echo -e "\n=== Delete Edge ==="
curl -s -X DELETE "$BASE_URL/edges/$FROM_OID/$TO_OID/assigned_to"
echo "Edge deleted (204 No Content)"

echo -e "\n=== Done ==="
```

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Edge Direction

Edges are **directional**. An edge from A→B is different from B→A. If bidirectional relationships are needed, create two separate edges.

### Composite Primary Key

Edges are uniquely identified by the combination of:
- `from_oid` - Source object
- `to_oid` - Target object  
- `edge_type` - Relationship type

This means:
- Same two objects can have multiple edges of **different types**
- Same two objects **cannot** have multiple edges of the **same type**

### Cascade Behavior

- Deleting an object from `registry.global` will cascade delete all edges where that object is `from_oid` or `to_oid`
- Edges do not cascade delete the referenced objects

### Performance Considerations

- Indexes exist on `from_oid`, `to_oid`, `edge_type`, and `effective_at DESC` for efficient queries
- Use pagination for large result sets
- The `include_objects` parameter adds JOINs; use only when needed
