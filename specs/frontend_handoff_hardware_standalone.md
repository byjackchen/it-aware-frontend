# Frontend Handoff: Hardware Standalone Object

## Summary

The backend replaced the `objects.worker_hardwares` table (a worker subtable synced from ServiceNow) with a standalone `objects.hardwares` table synced from ERP BPMS. Hardware is now a first-class object with its own lifecycle — it can exist without an assigned worker. The routes moved from `/objects/workers/hardwares*` to `/objects/hardwares*`, and the data model expanded from 8 fields to 47 fields across 8 clusters (identity, model, assignment, location/org, cost, status, verification, provenance).

---

## What Exists in the Frontend (OLD state — needs updating)

### `lib/types/objects.ts`

| Type | Lines | Status |
|------|-------|--------|
| `WorkerHardware` | 203–216 | BROKEN — references deleted table shape |
| `WorkerHardwareCreate` | 218–227 | BROKEN — references deleted table shape |
| `WorkerHardwareUpdate` | 229–238 | BROKEN — references deleted table shape |

**`WorkerHardware` (lines 203–216)** had 8 fields:
```typescript
oid, worker_oid (required string), hardware_type, tracking_id, serial_number,
model, assignment_date, renew_eligible_date, notes, is_active, created_at, updated_at
```

**`WorkerHardwareCreate` (lines 218–227)** required `hardware_type` and `assignment_date`.

**`WorkerHardwareUpdate` (lines 229–238)** was all-optional.

### `lib/api/objects.ts`

| Function | Lines | Old Route | Status |
|----------|-------|-----------|--------|
| `getWorkerHardwares()` | 373–379 | `GET /objects/workers/hardwares?{worker_oid\|stable_id}` | BROKEN |
| `createWorkerHardware()` | 381–387 | `POST /objects/workers/hardwares?{worker_oid\|stable_id}` | BROKEN |
| `updateWorkerHardware()` | 389–395 | `PUT /objects/workers/hardwares/detail?{worker_oid}&hardware_oid` | BROKEN |
| `deleteWorkerHardware()` | 397–401 | `DELETE /objects/workers/hardwares/detail?{worker_oid}&hardware_oid` | BROKEN |

All four functions call routes under `/objects/workers/hardwares*` which **no longer exist**. Any call to these functions will receive a 404.

The import block at lines 23–25 also references the three old types:
```typescript
WorkerHardware,
WorkerHardwareCreate,
WorkerHardwareUpdate,
```

---

## What Needs to Change

### Types (`lib/types/objects.ts`)

**Rename and expand the base type:**

- Rename `WorkerHardware` → `Hardware`
- `worker_oid` changes from `string` (required) to `string | null` (optional — hardware may have no assigned worker)
- Remove old fields: `hardware_type`, `tracking_id`, `model`, `assignment_date`, `renew_eligible_date`, `notes`
- Add all 42 ERP fields listed below
- `cost` and `residual_value` are `string | null` (Decimal serialized as string, e.g. `"4135.83"`)

**New `Hardware` type shape:**

```typescript
export interface Hardware {
    oid: string;
    serial_number: string;             // Unique business key; immutable
    worker_oid: string | null;         // null when unassigned

    // Identity
    asset_tag: string | null;
    asset_number: string | null;

    // Model
    model_category: string | null;     // "Laptop", "AP", "Monitor", etc.
    model_display_name: string | null;
    model_name: string | null;
    main_category: string | null;
    asset_function: string | null;
    asset_owner: string | null;

    // Assignment
    assigned_to_username: string | null;
    assigned_to_display_name: string | null;
    employment_type: string | null;
    employment_start_date: string | null;
    assigned_date: string | null;
    first_assigned_date: string | null;

    // Location / Org
    company: string | null;
    business_group: string | null;
    department: string | null;
    location: string | null;
    office_id: string | null;
    region_code: string | null;
    region: string | null;
    office_region: string | null;
    stock_room: string | null;

    // Cost (Decimal as string)
    cost: string | null;
    cost_center: string | null;
    procured_cost_center: string | null;
    residual_value: string | null;
    residual_date: string | null;
    budget_by_oit: boolean | null;
    cost_by_oit: boolean | null;

    // Status
    asset_status: string | null;       // "In use", "Retired", "Awaiting Approval"
    substatus: string | null;
    retired_date: string | null;
    scheduled_retirement: string | null;

    // Verification
    verification_status: string | null;
    verified_date: string | null;
    verified_by: string | null;

    // Provenance
    erp_created_by: string | null;
    erp_created_date: string | null;
    erp_updated_date: string | null;
    owned_by: string | null;

    is_active: boolean;
    created_at: string;
    updated_at: string;
}
```

**Rename and update create/update types:**

- Rename `WorkerHardwareCreate` → `HardwareCreate`: required field is now `serial_number` (not `hardware_type`/`assignment_date`); all other fields optional
- Rename `WorkerHardwareUpdate` → `HardwareUpdate`: all fields optional; do NOT include `serial_number` (it is immutable)

**Add new bulk/prune/reconcile types:**

```typescript
export interface HardwareListResponse {
    items: Hardware[];
    total: number;
    skip: number;
    limit: number;
}

export interface HardwareBulkUpsertRequest {
    items: HardwareCreate[];   // max 500 items; keyed on serial_number
}

export interface HardwareBulkUpsertResponse {
    created: number;
    updated: number;
    unchanged: number;
    skipped_no_serial: number;
    errors: string[];
}

export interface HardwarePruneRequest {
    kept_serial_numbers: string[];
}

export interface HardwarePruneResponse {
    deleted: number;
}

export interface HardwareReconcileResponse {
    resolved: number;
    still_unresolved: number;
}

export interface HardwareListParams {
    skip?: number;
    limit?: number;
    worker_oid?: string;
    assigned_to_username?: string;
    serial_number?: string;
    asset_tag?: string;
    model_category?: string;
    main_category?: string;
    asset_status?: string;
    office_id?: string;
    region?: string;
    is_active?: boolean;
    unassigned?: boolean;
}
```

### API Client (`lib/api/objects.ts`)

**Update the import block** (lines 23–25): replace `WorkerHardware`, `WorkerHardwareCreate`, `WorkerHardwareUpdate` with `Hardware`, `HardwareCreate`, `HardwareUpdate`, `HardwareListResponse`, `HardwareListParams`, `HardwareBulkUpsertRequest`, `HardwareBulkUpsertResponse`, `HardwarePruneRequest`, `HardwarePruneResponse`, `HardwareReconcileResponse`.

**Replace the four old functions** (lines 373–401) with:

```typescript
// ============================================================================
// Hardware APIs
// ============================================================================

export async function listHardwares(params: HardwareListParams = {}): Promise<HardwareListResponse> {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.worker_oid) query.set('worker_oid', params.worker_oid);
    if (params.assigned_to_username) query.set('assigned_to_username', params.assigned_to_username);
    if (params.serial_number) query.set('serial_number', params.serial_number);
    if (params.asset_tag) query.set('asset_tag', params.asset_tag);
    if (params.model_category) query.set('model_category', params.model_category);
    if (params.main_category) query.set('main_category', params.main_category);
    if (params.asset_status) query.set('asset_status', params.asset_status);
    if (params.office_id) query.set('office_id', params.office_id);
    if (params.region) query.set('region', params.region);
    if (params.is_active !== undefined) query.set('is_active', String(params.is_active));
    if (params.unassigned !== undefined) query.set('unassigned', String(params.unassigned));
    return fetchApi<HardwareListResponse>(`${OBJECTS_BASE}/hardwares?${query.toString()}`);
}

export async function getHardware(hardwareOid: string): Promise<Hardware> {
    return fetchApi<Hardware>(`${OBJECTS_BASE}/hardwares/detail?hardware_oid=${encodeURIComponent(hardwareOid)}`);
}

export async function createHardware(data: HardwareCreate): Promise<Hardware> {
    return fetchApi<Hardware>(`${OBJECTS_BASE}/hardwares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function updateHardware(hardwareOid: string, data: HardwareUpdate): Promise<Hardware> {
    return fetchApi<Hardware>(`${OBJECTS_BASE}/hardwares/detail?hardware_oid=${encodeURIComponent(hardwareOid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function deleteHardware(hardwareOid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/hardwares/detail?hardware_oid=${encodeURIComponent(hardwareOid)}`, {
        method: 'DELETE',
    });
}

export async function bulkUpsertHardwares(data: HardwareBulkUpsertRequest): Promise<HardwareBulkUpsertResponse> {
    return fetchApi<HardwareBulkUpsertResponse>(`${OBJECTS_BASE}/hardwares/bulk_upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function pruneHardwares(data: HardwarePruneRequest): Promise<HardwarePruneResponse> {
    return fetchApi<HardwarePruneResponse>(`${OBJECTS_BASE}/hardwares/prune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function reconcileHardwareAssignees(): Promise<HardwareReconcileResponse> {
    return fetchApi<HardwareReconcileResponse>(`${OBJECTS_BASE}/hardwares/reconcile_assignees`, {
        method: 'POST',
    });
}
```

### Route Handlers (`app/api/objects/`)

Search for any Next.js API route files that proxy to `/objects/workers/hardwares`. If such a route exists, update the proxied path to `/objects/hardwares`.

If there is no proxy route for hardware yet but there is one for other objects sections, consider adding one at `app/api/objects/hardwares/` following the same pattern.

### UI Components

Search your codebase for any component that:
- Imports or renders `WorkerHardware` type data
- Calls `getWorkerHardwares`, `createWorkerHardware`, `updateWorkerHardware`, or `deleteWorkerHardware`
- Renders hardware in a worker sub-view (e.g. a "Hardware" tab on the worker/persona page)

All such components need to be updated to use the new types and functions.

**Null worker handling**: `worker_oid` is now nullable. Any component that displays hardware must gracefully handle `worker_oid === null`. Do not assume hardware always has an assigned worker.

**Standalone hardware page**: Hardware can now be browsed independently of workers. Consider a new `/data/hardwares` page (similar to `/data/workers`) for IT inventory management — list all ~9,000 assets, filter by status/category/region/office.

---

## Backend API Summary

Full spec: `specs/backend/api_specs_objects.md` → **API 3: Hardwares** section.

Quick endpoint reference:

| # | Verb | Path | Permission |
|---|------|------|------------|
| 1 | POST | `/objects/hardwares` | `objects:hardwares:write` |
| 2 | GET | `/objects/hardwares` | `objects:hardwares:read` |
| 3 | GET | `/objects/hardwares/detail?hardware_oid=...` | `objects:hardwares:read` |
| 4 | PUT | `/objects/hardwares/detail?hardware_oid=...` | `objects:hardwares:write` |
| 5 | DELETE | `/objects/hardwares/detail?hardware_oid=...` | `objects:hardwares:write` |
| 6 | POST | `/objects/hardwares/bulk_upsert` | `objects:hardwares:write` |
| 7 | POST | `/objects/hardwares/prune` | `objects:hardwares:write` |
| 8 | POST | `/objects/hardwares/reconcile_assignees` | `objects:hardwares:write` |

---

## Migration Checklist

- [ ] **`lib/types/objects.ts`**: Rename `WorkerHardware` → `Hardware`; update field shape (remove 6 old fields, add 42 new ERP fields; make `worker_oid` optional); rename `WorkerHardwareCreate` → `HardwareCreate` (required: `serial_number`); rename `WorkerHardwareUpdate` → `HardwareUpdate` (no `serial_number`); add `HardwareListResponse`, `HardwareListParams`, `HardwareBulkUpsertRequest`, `HardwareBulkUpsertResponse`, `HardwarePruneRequest`, `HardwarePruneResponse`, `HardwareReconcileResponse`
- [ ] **`lib/api/objects.ts`**: Replace the 4 old `*WorkerHardware*` functions with 8 new `*Hardware*` functions; update import block to use the new type names; change all route paths from `/objects/workers/hardwares*` to `/objects/hardwares*`
- [ ] **`app/api/objects/` route handlers**: Search for any proxy handler targeting `/objects/workers/hardwares`; update the proxied path or add a new `/api/objects/hardwares/` route
- [ ] **Component search**: `grep -r "WorkerHardware\|getWorkerHardwares\|createWorkerHardware\|updateWorkerHardware\|deleteWorkerHardware" app/` — update every hit to use the new types and functions
- [ ] **Null worker guard**: Audit every hardware display component — add null check for `worker_oid` and graceful empty-state rendering
- [ ] **Consider new page**: Add a standalone `/data/hardwares` list page for IT inventory management (filter by status, category, region; paginated at 50/page)
- [ ] **Test**: List hardwares with `GET /objects/hardwares`; filter by `asset_status=In use`; view a hardware detail by OID; verify a hardware record with `worker_oid = null` renders without errors; verify worker-linked hardware displays correctly

---

## Key Behavioral Differences

**Hardware can exist without a worker.** `worker_oid` is nullable (`ON DELETE SET NULL`). Approximately 3,000+ assets in the database have no assigned worker — stockroom items, APs, retired devices. Any UI that assumes `worker_oid` is always set will crash or show incorrect data.

**`serial_number` is the business key.** It is unique across the entire table and immutable after creation. The `HardwareUpdate` schema intentionally omits it. Display it prominently — it is the canonical identifier for support conversations.

**42 fields instead of 8.** The response is significantly richer. Group fields visually by cluster rather than showing a flat list: identity → model → assignment → location/org → cost → status → verification → provenance.

**`cost` and `residual_value` are Decimal strings.** These come as string representations of decimals (e.g. `"4135.83"`) rather than JS numbers, to avoid floating-point precision loss. Parse with `parseFloat()` only for display; store and send as strings.

**Total inventory is ~9,000 assets.** The list endpoint supports pagination (`skip`/`limit`) and 13 filters. Default page size is 50, maximum is 500. Do not attempt to fetch all records in a single request for UI rendering.

**`bulk_upsert` matches on `serial_number`.** If a row with that serial already exists it is updated; otherwise a new row is created. Items missing `serial_number` are counted in `skipped_no_serial` and not written.

**`prune` is destructive.** `POST /objects/hardwares/prune` hard-deletes every row whose `serial_number` is not in the `kept_serial_numbers` list. This is an ERP sync maintenance operation — do not expose it in user-facing UI without a confirmation gate.
