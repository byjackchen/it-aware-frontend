# Backend Refactor: Adding `is_active` Field

> **Purpose:** Frontend adoption guide for the `is_active` soft deletion field being added to Organization, Location, and Ticket entities.

## Summary

This refactor adds an `is_active` boolean field to **Organization**, **Location**, and **Ticket** entities for soft deletion support. Worker already has this field.

## API Changes

### New Field in Responses

All affected entities will now include `is_active: boolean` in their response schemas:

| Entity | Endpoint | New Field |
|--------|----------|-----------|
| Organization | `/hierarchies/organizations/*` | `is_active: boolean` |
| Location | `/hierarchies/locations/*` | `is_active: boolean` |
| Ticket | `/objects/tickets/*` | `is_active: boolean` |

### Create Requests

New field available (defaults to `true` if not provided):

```typescript
// OrganizationCreate
{
  name: string;
  parent_oid?: string;
  stable_id?: string;
  type: string;
  is_active?: boolean;  // NEW - defaults to true
}

// LocationCreate  
{
  name: string;
  parent_oid?: string;
  type: string;
  timezone: string;
  stable_id?: string;
  is_active?: boolean;  // NEW - defaults to true
}

// TicketCreate
{
  org_oid: string;
  title?: string;
  status?: string;
  is_active?: boolean;  // NEW - defaults to true
}
```

### Update Requests

New optional field:

```typescript
// OrganizationUpdate
{
  name?: string;
  parent_oid?: string;
  stable_id?: string;
  type?: string;
  is_active?: boolean;  // NEW
}

// LocationUpdate
{
  name?: string;
  parent_oid?: string;
  type?: string;
  timezone?: string;
  stable_id?: string;
  is_active?: boolean;  // NEW
}

// TicketUpdate
{
  title?: string;
  status?: string;
  is_active?: boolean;  // NEW
}
```

### Response Schemas

All responses now include `is_active`:

```typescript
// OrganizationResponse
{
  oid: string;
  name: string;
  stable_id: string | null;
  type: string;
  parent_oid: string | null;
  path: string[];
  is_active: boolean;  // NEW
  created_at: string;
  updated_at: string;
}

// LocationResponse
{
  oid: string;
  name: string;
  type: string;
  timezone: string;
  stable_id: string | null;
  parent_oid: string | null;
  path: string[];
  is_active: boolean;  // NEW
  created_at: string;
  updated_at: string;
}

// TicketResponse
{
  oid: string;
  org_oid: string;
  worker_oid: string;
  status: string;
  title: string | null;
  is_active: boolean;  // NEW
  created_at: string;
}
```

## Frontend TypeScript Changes

### Update Interfaces

```typescript
// types/organization.ts
interface Organization {
  // ... existing fields
  is_active: boolean;  // ADD
}

interface OrganizationCreate {
  // ... existing fields
  is_active?: boolean;  // ADD (optional)
}

interface OrganizationUpdate {
  // ... existing fields
  is_active?: boolean;  // ADD
}
```

```typescript
// types/location.ts
interface Location {
  // ... existing fields
  is_active: boolean;  // ADD
}

interface LocationCreate {
  // ... existing fields
  is_active?: boolean;  // ADD (optional)
}

interface LocationUpdate {
  // ... existing fields
  is_active?: boolean;  // ADD
}
```

```typescript
// types/ticket.ts
interface Ticket {
  // ... existing fields
  is_active: boolean;  // ADD
}

interface TicketCreate {
  // ... existing fields
  is_active?: boolean;  // ADD (optional)
}

interface TicketUpdate {
  // ... existing fields
  is_active?: boolean;  // ADD
}
```

## UI Considerations

1. **Display**: Show active/inactive status badge in list views and detail pages
2. **Filtering**: Consider adding filter option to show/hide inactive items
3. **Soft Delete**: Replace hard delete with setting `is_active: false`
4. **Visual Indicator**: Style inactive items differently (grayed out, strikethrough, etc.)

## Migration Notes

- **Existing data**: All existing records will have `is_active: true` after migration
- **No breaking changes**: Field is additive; existing API calls continue to work
- **Default behavior**: List endpoints return ALL records (active and inactive) unless filtered
