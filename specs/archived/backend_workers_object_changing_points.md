# Worker Object API Changes

> **Date:** 2026-01-05  
> **Summary:** Breaking changes to the Worker object API for frontend adoption

---

## Breaking Changes

### Field Removed
| Field | Change |
|-------|--------|
| `full_name` | **REMOVED** - Replaced by `legal_first_name` + `legal_last_name` |

### Fields Added
| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `stable_id` | `string` | ✅ | Stable identifier for sync (same as WeChat ID) |
| `legal_first_name` | `string` | ✅ | Legal first name |
| `legal_last_name` | `string` | ✅ | Legal last name |
| `preferred_first_name` | `string` | ❌ | Preferred/nickname |
| `gender` | `string` | ❌ | Gender |
| `management_level` | `string` | ❌ | Management level |
| `professional_level` | `string` | ❌ | Professional level |
| `location_oid` | `string` | ❌ | Location OID (was missing before) |

---

## Updated TypeScript Interface

```typescript
// BEFORE
interface Worker {
  oid: string;
  worker_id?: string;
  full_name: string;  // ❌ REMOVED
  email?: string;
  org_oid: string;
  manager_oid?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// AFTER
interface Worker {
  oid: string;
  worker_id?: string;
  stable_id: string;           // ✅ NEW (required)
  legal_first_name: string;    // ✅ NEW (required)
  legal_last_name: string;     // ✅ NEW (required)
  preferred_first_name?: string; // ✅ NEW
  email?: string;
  gender?: string;             // ✅ NEW
  management_level?: string;   // ✅ NEW
  professional_level?: string; // ✅ NEW
  org_oid: string;
  location_oid?: string;       // ✅ NEW
  manager_oid?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## API Schemas

### WorkerCreate
```typescript
interface WorkerCreate {
  worker_id?: string;          // optional
  stable_id: string;           // REQUIRED
  legal_first_name: string;    // REQUIRED
  legal_last_name: string;     // REQUIRED
  preferred_first_name?: string;
  email?: string;
  gender?: string;
  management_level?: string;
  professional_level?: string;
  org_oid: string;             // REQUIRED
  location_oid?: string;
  manager_oid?: string;
  is_active?: boolean;         // default: true
}
```

### WorkerUpdate
All fields are optional for PATCH-style updates.

---

## Migration Steps for Frontend

1. **Update TypeScript interfaces** - Replace `full_name` with new name fields
2. **Update forms** - Workers creation/edit forms need:
   - `stable_id` (required)
   - `legal_first_name` (required)
   - `legal_last_name` (required)
   - Optional: `preferred_first_name`, `gender`, `management_level`, `professional_level`, `location_oid`
3. **Update display components** - Use computed full name:
   ```typescript
   const fullName = `${worker.legal_first_name} ${worker.legal_last_name}`;
   const displayName = worker.preferred_first_name || worker.legal_first_name;
   ```
4. **Update API calls** - Ensure create/update payloads use new field names
