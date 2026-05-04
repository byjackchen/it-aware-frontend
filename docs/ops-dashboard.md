# Ops Dashboard — Phase 1 Frontend

10 operations-focused pages under `/operation-teams/ops-dashboard/*`. Built client-side against the existing `/objects/activities/incidents`, `/objects/activities/requests`, and `/objects/hardwares` list endpoints — no dedicated aggregation API in Phase 1 (the prototype's client-side aggregation pattern is preserved).

## Routes

| Path | Purpose | Data source |
|---|---|---|
| `/operation-teams/ops-dashboard` | Active Monitoring Hub — KPIs + donuts + trend + world map | incidents + requests + hardwares |
| `/operation-teams/ops-dashboard/incidents` | Incident Analysis — priority/state donuts, group bar, trend | incidents |
| `/operation-teams/ops-dashboard/catalog` | Catalog Task Dashboard — state/group/dept breakdowns | requests (client-side `request_type='catalog_task'`) |
| `/operation-teams/ops-dashboard/aging-incidents` | Aging Incidents >2d / >7d | incidents |
| `/operation-teams/ops-dashboard/aging-sc-tasks` | Aging SC Tasks >30d / >60d | requests (catalog_task) |
| `/operation-teams/ops-dashboard/aging-asset-tasks` | Aging Asset Tasks >30d / >60d | requests (asset_task) |
| `/operation-teams/ops-dashboard/vip-tickets` | VIP-only active tickets (incidents + requests) | both |
| `/operation-teams/ops-dashboard/assets` | Asset Hub — KPIs + donuts + support-group × device stacked bar | hardwares |
| `/operation-teams/ops-dashboard/in-stock-assets` | In-Stock Assets — KPIs + donuts + table | hardwares (in-stock only) |
| `/operation-teams/ops-dashboard/pending-assets` | Pending Assets — 3-tab substatus view | hardwares |

## Key architectural notes

- **All reads use `view=slim`** — backend drops heavy fields (`chat_transcripts`, `description`, review fields) for dashboard pulls; `Cache-Control: private, max-age=60` on slim responses stacks with the `useOpsDashboard` hook's 60s in-memory cache.
- **Partial responses** — on a 5s backend timeout the list endpoints return `{ items: [], total: null, partial: true }`. Dashboard pages render a soft amber "retry" banner rather than erroring.
- **Actor eager-load** — `incident.actor` / `request.actor` is populated server-side with `{ fullname, organization.descriptor, location.{descriptor, region} }` so the frontend never N+1s to resolve worker details. The world map reads `actor.location.region`.
- **`updated_at` is the aging clock** — it mirrors ServiceNow's `sys_updated_on` (sync-DAG authoritative). Don't write `activities.*.updated_at` in app code; the guardrail test `tests/activities/test_updated_at_invariant.py` in the backend enforces this.
- **Client-side request_type classifier** — Phase 1 heuristic on `item` / `request_item` fields. Phase 2 replaces with a server-side discriminator column.

## Shared primitives

Located under `components/ops_dashboard/` and `lib/ops_dashboard/`:

- `DataTable` — server-paginated; accepts `rows, total, skip, limit, onPageChange` props.
- `KpiCard` — big-number tile. Optional props: `delta` (▲ orange / ▼ green per the rising-is-warning convention), `linkHref` + `linkLabel` (chevron drill-in arrow to a related dashboard), `valueSize` (`md`/`lg`/`xl` headline size), `className` (h-full row stretch).
- `DonutCard`, `DonutLegend` — donut card with optional **interactive-legend mode**: pass `selectedSlices` + `onLegendToggle` and the recharts built-in legend is replaced by `DonutLegend` (multi-select; selected slices keep full opacity + white stroke, others dim to 0.25). Built-in tooltip is omitted in this mode — slice metadata lives in the legend.
- `TrendLineCard` — line chart with optional `series: TrendSeries[]` for multi-line rendering. Used by Incidents + Catalog cumulative opened/closed trends; single-line callers (`count` field) untouched.
- `GroupBarCard` — reusable bar card matching `SurveyAnalyticsDashboard` styling.
- `AgingTable` — extracted shared table shell with warn/danger threshold props (used by 3 aging pages).
- `RegionMap` — dynamic-imported (`ssr: false`) wrapper around `react-simple-maps` for the Hub's world map.
- `TopFilterBar` — collapsible filter strip with `headerSlot` (renders before the slicer grid) + `headerActions` (top-right of header) + `hideHeaderClear` (suppresses the built-in inline clear). `SidebarFilters` and `DateRangePicker` remain available for legacy/non-dashboard pages.
- `MultiSelect` — controlled multi-select primitive. Optional `searchable` (popover search input), `group` (per-option header — caller pre-sorts by group), `optionCount` (trailing count badge). Closes on outside-click + Escape.
- `RegionCountryFilter` — three-level geographic slicer (Region → Country grouped by region → Location grouped by city). Cascade narrowing: shrinking Region drops orphaned Country / Location selections; shrinking Country drops orphaned Locations. Region/Country/Location filtering is geographic only — derived from the row's caller-side or asset-side location string via `lib/ops_dashboard/region.ts` (canonicalises "US" / "United States" / "USA" → "United States" etc.).
- `aggregate.ts` — `summarizeTickets`, `summarizeAssets`, `groupBy`, `trendByMonth`, `cumulativeTrendByMonth`, `momByDate`, `momActiveSnapshot`, `formatMoM`, `inferDeviceType`, `classifyRequestType`, active-state / in-stock predicates.
- `region.ts` — `countryToRegion`, `extractCountry`, `extractCity`, `canonicalizeCountry`, `normalizeRegion`, `regionToCountries`, `countryToLocations`, `matchesRegionCountry`.

### Filter pattern (current convention across all dashboards)

1. **Region / Country / Location** live in `TopFilterBar.headerSlot` via `RegionCountryFilter`. Geographic filtering — applies to caller-side `actor.location.descriptor` for tickets and `r.location` for hardware (HardwareRow's location column carries the same `Country-State-City` vocabulary as the ticket caller location).
2. **Open Date** (where applicable) stays as the only slicer in `TopFilterBar.slicers`.
3. **Chart filters** are donut-driven: clicking a slice or a `DonutLegend` item toggles the corresponding param (e.g. priority, state, assigned_group, stock_room) on the page-level filter state.
4. **Clear All Filters** lives in `TopFilterBar.headerActions` (red when any dimension is active, grey + disabled when nothing is) — single button that resets every dimension across geography + chart filters + date.

## Smoke-test checklist

Run `npm run dev` against a backend with seeded data, then navigate each route and verify:

- [ ] No console errors on initial render or filter changes.
- [ ] Amber banner appears on simulated 5s timeout (can fire by slowing backend network or dropping a fixture).
- [ ] Sidebar filters mutate the data in real time (verify ticket count ticks down as you add filters).
- [ ] Click-to-cross-filter on donut slices (Asset Hub procured-by, Catalog active-by-group).
- [ ] World map renders three bubbles (AMER / EMEA / APAC) with correct count scaling.
- [ ] Aging color coding: >2d orange + >7d red on Aging Incidents; >30d orange + >60d red on SC / Asset Tasks.
- [ ] Pending Assets 3-tab component — each tab shows only rows whose substatus matches the tab.
- [ ] Language toggle (EN ↔ ZH) swaps every label without missing-translation warnings.
- [ ] Theme toggle (light ↔ dark) preserves card contrast across all 10 pages.

## Phase 2 follow-ups (tracked here for continuity)

- **OpenAPI slim contract**: slim list responses don't currently have a dedicated response schema advertised — TypeScript clients that regenerate types will see the full shape. See `../it-aware-backend/docs/ops-dashboard/e2e_adaptation_plan.md` §3 for the schema migration path.
- **Real Postgres `statement_timeout`**: current timeout is `asyncio.wait_for` (client-side) — server-side queries may keep running briefly post-cancel. Add `SET LOCAL statement_timeout` inside the dashboard handlers when DB-side load-shedding becomes a concern.
- **Hardware `substatus` normalization**: real values are verbose mixed-case ("Convert to personal"); Pending Assets tabs match via substring. Either normalize server-side or pass exact values through.
- **Distinct-values endpoint**: country/location options are now derived client-side via `regionToCountries` / `countryToLocations` over the fetched row set. Phase 2 may still want a dedicated endpoint for very large data sets, but the immediate need disappeared with the geo classifier.
- **Server-side `request_type`**: replaces the client-side classifier, lifts the accuracy caveat footer on Catalog / Aging SC / Aging Asset pages.
- **`procured_by` / `support_group` semantic mapping**: `procuredByOf` now uses `asset_owner` (canonical OIT / Studio); `supportGroupOf` derives from a 6-level region fallback chain (`office_region → region → region_code → location-as-region-label → location-derived country → stock_room-derived country`) — no more `company`/`department` stand-ins.
- **i18n coverage of the new filter strings**: Region / Country / Location labels, "Showing N countries in...", "Clear All Filters", "High Priority" / "Medium Priority", "Cumulative opened vs. closed", and the MoM `▲ X% vs last mo` template are currently hardcoded English. Track follow-up to migrate them into `messages/en.json` ↔ `messages/zh.json` and audit zh.json for orphaned keys from dropped slicers.
- **Frontend test coverage**: no automated tests cover the dashboard filter cascade, donut chart-filter toggle, or the priority bucketing. Track follow-up to introduce a frontend test runner (vitest or similar) and minimal coverage for the geo filter cascade + chart-filter wiring.

See `../it-aware-backend/docs/ops-dashboard/e2e_adaptation_plan.md` for the full Phase 2 scope.
