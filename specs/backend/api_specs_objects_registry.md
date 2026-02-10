# Registry Module API Specifications

## Overview

The Global Registry provides a unified lookup service for all tracked objects in the system. It enables cross-module object discovery and resolution without coupling to specific entity implementations.

The registry is **read-only** from the API perspective. Entries are automatically maintained by database triggers when source objects (workers, organizations, locations, service catalogs, articles) are created, updated, or deleted.

---

## Key Concepts

### Object Types

| Type | Source Table | Descriptor |
|------|--------------|------------|
| `worker` | `objects.workers` | `full_name` |
| `organization` | `objects.organizations` | `name` |
| `location` | `objects.locations` | `name` |
| `service_catalog` | `hierarchies.service_catalogs` | `name` |
| `article` | `knowledges.articles` | `stable_id` |

### Descriptor

The `descriptor` field provides a human-readable identifier for each object, automatically synced from the source table's name/title field.

---

## Data Model

```python
class GlobalRegistry(Base):
    __tablename__ = "global_registry"
    __table_args__ = {"schema": "registry"}

    oid = Column(BYTEA(16), primary_key=True)  # 16-byte ULID
    object_type = Column(Text, nullable=False)  # 'worker'|'organization'|'location'|'service_catalog'|'article'
    descriptor = Column(Text, nullable=False)   # Human-readable name/title
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
```

### Indexes

- `idx_registry_type` - B-tree index on `object_type`
- `idx_registry_descriptor_trgm` - pg_trgm GIN index for fuzzy text search

---

## API Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/objects/registry/search` | Search by descriptor | No |
| GET | `/objects/registry/batch` | Batch lookup by OIDs | No |
| GET | `/objects/registry/types/{type}` | List by object type | No |
| GET | `/objects/registry/{oid}` | Single object lookup | No |

**Note:** Registry APIs are currently public (no authentication required). This may change based on security requirements.

---

## Response Schema

```python
class RegistryResponse(BaseModel):
    oid: str           # 22-char base64url encoded OID
    object_type: str   # 'worker'|'organization'|'location'|'service_catalog'|'article'
    descriptor: str    # Human-readable name/title
    created_at: datetime
    updated_at: datetime

class RegistryBatchResponse(BaseModel):
    items: List[RegistryResponse]
    found_count: int      # Number of items found
    requested_count: int  # Number of OIDs requested
```

---

## API 1: Search Objects

**`GET /objects/registry/search`**

Search objects by descriptor using case-insensitive partial matching. Uses pg_trgm index for efficient fuzzy search.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search term (min 1 char) |
| `object_type` | string | No | - | Filter by type |
| `limit` | integer | No | 20 | Max results (1-100) |

### Response (200 OK)

```json
[
  {
    "oid": "01JFXYZWRK123456789AB",
    "object_type": "worker",
    "descriptor": "Alice Smith",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  {
    "oid": "01JFXYZORG123456789AB",
    "object_type": "organization",
    "descriptor": "Alice's Team",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid object_type | `{"detail": "Invalid object_type. Must be one of: ['article', 'location', 'organization', 'service_catalog', 'worker']"}` |

### Examples

```bash
# Search all objects containing "alice"
curl "http://localhost:8000/objects/registry/search?q=alice"

# Search only workers
curl "http://localhost:8000/objects/registry/search?q=alice&object_type=worker"

# Search with custom limit
curl "http://localhost:8000/objects/registry/search?q=eng&limit=50"
```

---

## API 2: Batch Lookup

**`GET /objects/registry/batch`**

Look up multiple objects by their OIDs in a single request. Missing OIDs are silently ignored.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `oids` | string | Yes | Comma-separated OIDs (max 100) |

### Response (200 OK)

```json
{
  "items": [
    {
      "oid": "01JFXYZWRK123456789AB",
      "object_type": "worker",
      "descriptor": "Alice Smith",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    {
      "oid": "01JFXYZORG123456789AB",
      "object_type": "organization",
      "descriptor": "Engineering",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "found_count": 2,
  "requested_count": 3
}
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Too many OIDs | `{"detail": "Maximum 100 OIDs per batch request"}` |
| 400 | Invalid OID format | `{"detail": "Invalid OID format: ..."}` |

### Example

```bash
# Look up multiple objects
curl "http://localhost:8000/objects/registry/batch?oids=01JFXYZWRK123456789AB,01JFXYZORG123456789AB,01JFXYZNOTFOUND12345"
```

---

## API 3: List by Type

**`GET /objects/registry/types/{object_type}`**

List all objects of a specific type with pagination.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `object_type` | string | One of: `worker`, `organization`, `location`, `service_catalog`, `article` |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Max results (1-1000) |
| `offset` | integer | 0 | Records to skip |

### Response (200 OK)

```json
[
  {
    "oid": "01JFXYZWRK123456789AB",
    "object_type": "worker",
    "descriptor": "Alice Smith",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  {
    "oid": "01JFXYZWRK234567890BC",
    "object_type": "worker",
    "descriptor": "Bob Jones",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid type | `{"detail": "Invalid object_type. Must be one of: ['article', 'location', 'organization', 'service_catalog', 'worker']"}` |

### Examples

```bash
# List all workers
curl "http://localhost:8000/objects/registry/types/worker"

# List organizations with pagination
curl "http://localhost:8000/objects/registry/types/organization?limit=50&offset=100"
```

---

## API 4: Single Object Lookup

**`GET /objects/registry/{oid}`**

Look up a single object by its OID.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `oid` | string | Object OID (22-char base64url) |

### Response (200 OK)

```json
{
  "oid": "01JFXYZWRK123456789AB",
  "object_type": "worker",
  "descriptor": "Alice Smith",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid OID format | `{"detail": "Invalid OID format"}` |
| 404 | Object not found | `{"detail": "Object not found"}` |

### Example

```bash
curl "http://localhost:8000/objects/registry/01JFXYZWRK123456789AB"
```

---

## API Endpoint Summary

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/objects/registry/search` | Search by descriptor (fuzzy) |
| 2 | GET | `/objects/registry/batch` | Batch lookup by OIDs |
| 3 | GET | `/objects/registry/types/{type}` | List all of a type |
| 4 | GET | `/objects/registry/{oid}` | Single object lookup |

---

## Testing with cURL

### Complete Example Session

```bash
#!/bin/bash
BASE_URL="http://localhost:8000"

# 1. Search for objects
echo "=== Search for 'eng' ==="
curl -s "$BASE_URL/objects/registry/search?q=eng" | jq

# 2. Search with type filter
echo -e "\n=== Search workers only ==="
curl -s "$BASE_URL/objects/registry/search?q=alice&object_type=worker" | jq

# 3. List all organizations
echo -e "\n=== List organizations ==="
curl -s "$BASE_URL/objects/registry/types/organization?limit=10" | jq

# 4. Single lookup
echo -e "\n=== Single lookup ==="
curl -s "$BASE_URL/objects/registry/01JFXYZWRK123456789AB" | jq

# 5. Batch lookup
echo -e "\n=== Batch lookup ==="
curl -s "$BASE_URL/objects/registry/batch?oids=01JFXYZWRK123456789AB,01JFXYZORG123456789AB" | jq

echo -e "\n=== Done ==="
```

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`
- OIDs are time-sortable and globally unique

### Automatic Synchronization

Registry entries are automatically maintained by PostgreSQL triggers:

- **INSERT**: Creates registry entry when source object is created
- **UPDATE**: Updates descriptor when source object's name/title changes
- **DELETE**: Removes registry entry when source object is deleted

No manual registry management is required or supported via API.

### Search Performance

The search endpoint uses PostgreSQL's pg_trgm extension for efficient fuzzy text matching:

- Supports partial matches (e.g., "ali" matches "Alice")
- Case-insensitive
- Optimized with GIN index for large datasets
