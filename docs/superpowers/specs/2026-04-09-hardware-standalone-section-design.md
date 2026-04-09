# Hardware Standalone Section Design

## Summary

Replace the broken `WorkerHardware` sub-resource with a standalone Hardware section. Hardware becomes a first-class object in the frontend with its own list page, detail page, sidebar entry, and updated types/API layer. The hardware display is removed from the worker detail page.

**Scope**: Standalone list + detail pages (read-only browsing). No create/edit/delete UI forms. No bulk/prune/reconcile admin endpoints exposed.

**Approach**: Clean sweep — types, API, proxy route, pages, sidebar, i18n, and worker detail cleanup all in one pass.

---

## Section 1: Types (`lib/types/objects.ts`)

- Delete `WorkerHardware`, `WorkerHardwareCreate`, `WorkerHardwareUpdate`
- Add `Hardware` interface with all 47 fields grouped by cluster:
  - Identity: `serial_number`, `asset_tag`, `asset_number`
  - Model: `model_category`, `model_display_name`, `model_name`, `main_category`, `asset_function`, `asset_owner`
  - Assignment: `assigned_to_username`, `assigned_to_display_name`, `employment_type`, `employment_start_date`, `assigned_date`, `first_assigned_date`, `worker_oid` (nullable)
  - Location/Org: `company`, `business_group`, `department`, `location`, `office_id`, `region_code`, `region`, `office_region`, `stock_room`
  - Cost: `cost` (decimal string), `cost_center`, `procured_cost_center`, `residual_value` (decimal string), `residual_date`, `budget_by_oit`, `cost_by_oit`
  - Status: `asset_status`, `substatus`, `retired_date`, `scheduled_retirement`
  - Verification: `verification_status`, `verified_date`, `verified_by`
  - Provenance: `erp_created_by`, `erp_created_date`, `erp_updated_date`, `owned_by`
  - Common: `oid`, `is_active`, `created_at`, `updated_at`
- Add `HardwareCreate` — required: `serial_number`, all else optional
- Add `HardwareUpdate` — all optional, `serial_number` omitted (immutable)
- Add `HardwareListResponse` — `{ items: Hardware[]; total: number; skip: number; limit: number }`
- Add `HardwareListParams` — 13 filter fields (skip, limit, worker_oid, assigned_to_username, serial_number, asset_tag, model_category, main_category, asset_status, office_id, region, is_active, unassigned)
- Skip bulk/prune/reconcile types (not exposed in UI)

Key type details:
- `worker_oid`: `string | null` (hardware can exist without an assigned worker)
- `cost`, `residual_value`: `string | null` (Decimal serialized as string, e.g. `"4135.83"`)
- `serial_number`: unique business key, immutable after creation

---

## Section 2: API Client (`lib/api/objects.ts`)

- Delete the 4 old functions: `getWorkerHardwares`, `createWorkerHardware`, `updateWorkerHardware`, `deleteWorkerHardware`
- Update import block: replace `WorkerHardware`, `WorkerHardwareCreate`, `WorkerHardwareUpdate` with new type names
- Add 5 new functions targeting `/objects/hardwares*`:
  - `listHardwares(params: HardwareListParams)` — `GET /objects/hardwares` with URLSearchParams
  - `getHardware(hardwareOid)` — `GET /objects/hardwares/detail?hardware_oid=...`
  - `createHardware(data)` — `POST /objects/hardwares`
  - `updateHardware(hardwareOid, data)` — `PUT /objects/hardwares/detail?hardware_oid=...`
  - `deleteHardware(hardwareOid)` — `DELETE /objects/hardwares/detail?hardware_oid=...`

---

## Section 3: Route Proxy (`app/api/objects/[resource]/route.ts`)

- Add `hardwares: '/objects/hardwares'` to `RESOURCE_PATHS` map
- Enables `useInfiniteResource` hook to fetch via `/api/objects/hardwares?skip=X&limit=Y`

---

## Section 4: Sidebar (`lib/config/sidebar.ts`)

- Add "Hardwares" item under the "Objects" section, after Workers, before Articles
- Icon: `HardDrive` from lucide-react
- Route: `/data/hardwares`
- Permission: `objects:hardwares:read`

---

## Section 5: i18n (`messages/en.json`, `messages/zh.json`)

- Update the existing `hardware` translation block to cover:
  - List page: title, subtitle, search placeholder, filter labels (Model Category, Asset Status, Region), empty state
  - Detail page: section headers for each cluster (Identity, Model, Assignment, Location/Org, Cost, Status, Verification, Provenance), all 47 field labels
  - Status labels: "In use", "Retired", "Awaiting Approval", "Unassigned"
- Remove old worker-hardware-specific strings that no longer apply

---

## Section 6: Hardware List Page (`app/(main)/data/hardwares/`)

Files:
- `page.tsx` — Server component, minimal wrapper
- `HardwaresListPage.tsx` — Client component

Behavior:
- `useInfiniteResource<Hardware>` with pageSize 50 (suitable for ~9,000 total assets)
- Header: HardDrive icon, "Hardwares" title, total count subtitle
- Search bar: client-side filter across serial_number, asset_tag, assigned_to_display_name
- 3 filter dropdowns:
  - Model Category (Laptop, Monitor, AP, etc.)
  - Asset Status (In use, Retired, Awaiting Approval)
  - Region
- List items show:
  - Model category icon (type-based)
  - Serial number (bold, primary identifier)
  - Model display name + asset tag
  - Assigned to (display name) or "Unassigned" badge
  - Asset status badge (color-coded)
- Click navigates to `/data/hardwares/[oid]`
- Infinite scroll with `InfiniteLoadTrigger`
- Active/inactive toggle, defaults to active only

---

## Section 7: Hardware Detail Page (`app/(main)/data/hardwares/[oid]/`)

Files:
- `page.tsx` — Server component, calls `getHardware(oid)`
- `HardwareDetailPage.tsx` — Client component, read-only

Header: Back button, serial number as title, active/inactive badge, model_display_name as subtitle.

8 clustered cards (rounded bordered sections):

1. **Identity** — serial_number, asset_tag, asset_number
2. **Model** — model_category, model_display_name, model_name, main_category, asset_function, asset_owner
3. **Assignment** — assigned_to_username, assigned_to_display_name, employment_type, employment_start_date, assigned_date, first_assigned_date, worker_oid (linked to worker detail if non-null, "Unassigned" badge if null)
4. **Location / Org** — company, business_group, department, location, office_id, region_code, region, office_region, stock_room
5. **Cost** — cost (formatted as currency), cost_center, procured_cost_center, residual_value (formatted as currency), residual_date, budget_by_oit, cost_by_oit (boolean badges)
6. **Status** — asset_status (color badge), substatus, retired_date, scheduled_retirement
7. **Verification** — verification_status, verified_date, verified_by
8. **Provenance** — erp_created_by, erp_created_date, erp_updated_date, owned_by

Null fields display as "—". Worker_oid link shows "Unassigned" muted badge when null.

---

## Section 8: Worker Detail Cleanup

- Remove the hardware assets section (~lines 864-940) from `WorkerDetailPage.tsx`
- Remove the `hardwares` prop and `WorkerHardware` import
- Remove the `getWorkerHardwares()` call from the server `page.tsx`
- Remove worker-detail-specific hardware i18n strings

---

## Key Behavioral Notes

- **Hardware can exist without a worker.** ~3,000+ assets have `worker_oid = null` (stockroom items, APs, retired devices).
- **`serial_number` is the business key.** Unique, immutable. Display prominently.
- **`cost` and `residual_value` are decimal strings.** Parse with `parseFloat()` only for display formatting; store/send as strings.
- **~9,000 total assets.** Use pagination (50/page). Do not fetch all at once.
- **Follow existing patterns.** Workers list/detail page structure, `useInfiniteResource` hook, sidebar config, i18n structure — match what already exists.
