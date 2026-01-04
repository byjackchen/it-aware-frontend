# Organization Object Enhancement - Frontend API Changes

## Overview

The Organization object has been enhanced with two new fields: `stable_id` and `type`. This document outlines all API changes that frontend applications need to adapt to.

**Breaking Change:** Creating an organization now requires the `type` field.

---

## New Fields

### `stable_id` (Optional)

- **Type:** `string | null`
- **Description:** External stable identifier (e.g., Workday `tencent_org_id`)
- **Constraints:** Unique if provided, nullable
- **Updateable:** Yes

### `type` (Required)

- **Type:** `string`
- **Description:** Organization type/level in the hierarchy
- **Possible Values:**
  - `Top Level` - Root organization
  - `Business Group` - Major business unit
  - `Line` - Business line within a group
  - `Center` - Functional center
  - `Department` - Department within a center/line
  - `Team` - Team within a department
- **Constraints:** Required on creation, cannot be null
- **Updateable:** Yes

---

## API Endpoint Changes

### 1. POST /hierarchies/organizations - Create Organization

**Breaking Change:** Request body now requires `type` field.

#### Request Body

```typescript
interface OrganizationCreate {
  name: string;                    // Existing field (required)
  parent_oid?: string | null;      // Existing field (optional)
  
  // NEW FIELDS
  stable_id?: string | null;       // Optional - external identifier
  type: string;                    // REQUIRED - organization type
}
```

#### Example Request

```json
{
  "name": "Engineering Department",
  "parent_oid": "a1b2c3d4...",
  "stable_id": "1263",
  "type": "Department"
}
```

#### Response

```typescript
interface OrganizationResponse {
  oid: string;
  name: string;
  stable_id?: string | null;       // NEW
  type: string;                    // NEW
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
  "name": "Engineering Department",
  "stable_id": "1263",
  "type": "Department",
  "parent_oid": "e5f6g7h8...",
  "path": ["e5f6g7h8...", "a1b2c3d4..."],
  "created_at": "2026-01-04T12:00:00Z",
  "updated_at": "2026-01-04T12:00:00Z"
}
```

---

### 2-4. GET/PUT Endpoints

All read and update endpoints now include `stable_id` and `type` in responses.

---

## Frontend Adaptation Checklist

- [ ] **Update Organization Creation Forms** - Add `type` dropdown (required)
- [ ] **Update Organization Display** - Show `type` in lists/details
- [ ] **Update Organization Edit Forms** - Add `type` and `stable_id` fields
- [ ] **Update TypeScript Interfaces** - Add `stable_id` and `type` to all interfaces

---

## Organization Type Values

| Type | Description |
|------|-------------|
| `Top Level` | Root organization |
| `Business Group` | Major business unit |
| `Line` | Business line |
| `Center` | Functional center |
| `Department` | Department |
| `Team` | Individual team |

---

## Error Handling

Missing `type` on creation returns 422:
```json
{"detail": [{"loc": ["body", "type"], "msg": "field required"}]}
```
