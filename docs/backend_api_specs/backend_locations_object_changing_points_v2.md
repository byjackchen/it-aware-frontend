# Location Object Enhancement v2 - Frontend API Changes

## Overview

The Location object has been enhanced with a new `stable_id` field. This is an incremental update to the previous enhancement that added `type` and `timezone`.

---

## New Field

### `stable_id` (Optional)

- **Type:** `string | null`
- **Description:** External stable identifier for referencing locations
- **Format:** Slugified location name (e.g., `"us-california-palo-alto"`)
- **Constraints:** Unique if provided, nullable
- **Updateable:** Yes

---

## API Endpoint Changes

### 1. POST /hierarchies/locations - Create Location

#### Request Body

```typescript
interface LocationCreate {
  name: string;                    // Existing (required)
  parent_oid?: string | null;      // Existing (optional)
  type: string;                    // Existing (required)
  timezone: string;                // Existing (required)
  
  // NEW FIELD
  stable_id?: string | null;       // Optional - external identifier
}
```

#### Example Request

```json
{
  "name": "New York Office",
  "parent_oid": "a1b2c3d4...",
  "type": "office_location",
  "timezone": "America/New_York",
  "stable_id": "new-york-office"
}
```

#### Response

```typescript
interface LocationResponse {
  oid: string;
  name: string;
  type: string;
  timezone: string;
  stable_id?: string | null;       // NEW
  parent_oid?: string | null;
  path: string[];
  created_at: string;
  updated_at: string;
}
```

#### Example Response

```json
{
  "oid": "a1b2c3d4...",
  "name": "New York Office",
  "type": "office_location",
  "timezone": "America/New_York",
  "stable_id": "new-york-office",
  "parent_oid": "e5f6g7h8...",
  "path": ["e5f6g7h8...", "a1b2c3d4..."],
  "created_at": "2026-01-04T12:00:00Z",
  "updated_at": "2026-01-04T12:00:00Z"
}
```

---

### 2-4. GET/PUT Endpoints

All read and update endpoints now include `stable_id` in responses.

---

## Frontend Adaptation Checklist

- [ ] **Update TypeScript Interfaces** - Add `stable_id?: string | null` to all Location interfaces
- [ ] **Update Location Display** - Optionally show `stable_id` in admin/detail views
- [ ] **Update Location Edit Forms** - Optionally add `stable_id` input field
- [ ] **Update Location Creation Forms** - Optionally add `stable_id` input (auto-generated if not provided)

---

## Notes

- **Non-Breaking Change:** `stable_id` is optional on creation
- **Existing Data:** All existing locations have been populated with `stable_id` derived from slugified names
- **Read Compatibility:** Existing clients will receive the additional field in responses
