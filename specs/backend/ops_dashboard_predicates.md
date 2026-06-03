# Ops Dashboard — Shared Predicate Contract

**Status:** authoritative. Both the backend `GET /objects/activities/ops-dashboard/report/hub` SQL and the frontend `lib/ops_dashboard/aggregate.ts` helpers MUST reproduce the rules in this file byte-for-byte. Any divergence is a bug — see §10 (Drift defence).

**Scope:** the Active Monitoring Hub page (`/operation-teams/ops-dashboard`) and every drill-in dashboard that shares its KPI vocabulary (Unassigned, VIP, Aging Incidents / SC Tasks / Asset Tasks). The new report endpoint is the canonical implementation; the frontend keeps the JS predicates only for the detail-table render path.

---

## 1. Active states

A ticket counts as **active** when its `state` text is one of:

```
New
In Progress
On Hold
Solution Proposed
Open
Work in Progress
Pending
```

- Comparison is **case-sensitive** (matches the SN-supplied labels verbatim).
- Anything else — including `Resolved`, `Closed Complete`, `Cancelled`, `Closed Incomplete`, NULL, empty string — counts as inactive.
- Backend SQL: `state = ANY(ARRAY[…])` (already exposed as the `states_list` FilterSpec on the list endpoints).
- Frontend: `ACTIVE_STATES` + `isActiveState()` in `lib/ops_dashboard/aggregate.ts`.

## 2. OIT scope (assignment-group filter)

Every Hub-level KPI, donut, bar, region bubble, and aging count is restricted to tickets whose `assigned_group` (case-insensitive) **contains** any of:

```
oit
servicenow
microsoft o365
security
myaccess
```

- Rows with NULL / empty `assigned_group` are excluded.
- Backend SQL: `LOWER(assigned_group) LIKE ANY (ARRAY['%oit%', '%servicenow%', '%microsoft o365%', '%security%', '%myaccess%'])`.
- Frontend: `OIT_SCOPE_GROUP_KEYWORDS` + `isInScopeGroup()` in `lib/ops_dashboard/aggregate.ts`.

Why: an unfiltered active-ticket count surfaces ~213 Amazon-Ordering, HR, and Workday rows that aren't OIT's responsibility and drown the signal.

## 3. Request-type classifier

Requests don't carry a server-side type column yet; classify each row by:

1. **`stable_id` prefix** (authoritative — ServiceNow numbering convention):
   - `ASTTASK*` → `asset_task`
   - `SCTASK*`  → `catalog_task`
2. **Keyword fallback** on `LOWER(item || ' ' || request_item)` (only if step 1 didn't match):
   - matches `/asset|hardware|device/` → `asset_task`
3. **Default:** `catalog_task` (NOT `generic` — see note below).

The default is intentional: rows whose `item` field is unpopulated are still SN service-catalog requests; treating them as `generic` previously created a gap where `totalActive` exceeded the sum of the three bucket KPIs.

- Backend SQL: a `CASE WHEN UPPER(stable_id) LIKE 'ASTTASK%' THEN 'asset_task' WHEN UPPER(stable_id) LIKE 'SCTASK%' THEN 'catalog_task' WHEN LOWER(COALESCE(item,'') || ' ' || COALESCE(request_item,'')) ~ 'asset|hardware|device' THEN 'asset_task' ELSE 'catalog_task' END`.
- Frontend: `classifyRequestType()` in `lib/ops_dashboard/aggregate.ts`.

Asset/catalog counts only consider rows where `object_type = 'request'`; incidents are always `incident`.

## 4. Unassigned

A ticket is **unassigned** when:

```
assigned_to_oid IS NULL OR length(trim(assigned_to_oid::text)) = 0
```

- **Source of truth is the OID, not the name.** The upstream sync drops `assigned_to_name` for many rows whose `assigned_to_oid` is populated; filtering on the name field over-counts unassigned by ~5×.
- Backend SQL: `COUNT(*) FILTER (WHERE assigned_to_oid IS NULL)` is sufficient (BYTEA NULL handling is exact; the `trim()` clause is JS belt-and-braces).
- Frontend: `!r.assigned_to_oid || (typeof r.assigned_to_oid === 'string' && r.assigned_to_oid.trim() === '')`.

## 5. Aging thresholds

The aging clock reads **`source_updated_at`** (SN's `sys_updated_on`), falling back to local `updated_at` only when `source_updated_at IS NULL` (pre-backfill rows / non-SN sources).

| KPI                    | Object filter                                    | Threshold (`now - last_update`) |
|------------------------|--------------------------------------------------|---------------------------------|
| `agingIncidentGt2d`    | `object_type = 'incident'`                       | `> 2 days`                      |
| `agingCatalogGt30d`    | `object_type = 'request'` ∧ classifier = catalog | `> 30 days`                     |
| `agingAssetGt30d`      | `object_type = 'request'` ∧ classifier = asset   | `> 30 days`                     |

- Days-floor semantics: `FLOOR(EXTRACT(EPOCH FROM (now() - last_update)) / 86400)`. A delta ≤ 0 maps to 0 days.
- Backend SQL: use `COALESCE(source_updated_at, updated_at)` as the timestamp column.
- Frontend: `daysSinceUpdated()` in `lib/ops_dashboard/aggregate.ts`.

> **Never age off `updated_at` alone.** After Phase 2 it bumps on every DB mutation (`onupdate=func.now()`), including internal edits that don't reflect upstream activity.

## 6. Open-date filter

The user-picked Open Date range filters against **`source_created_at`** (SN's `sys_created_on`), not the local DB `created_at`. Sync backfills land recent `created_at` on historical tickets and would otherwise inflate MTD counts by an order of magnitude.

- Anchor timezone: **America/Los_Angeles** with DST handled per date (PDT = UTC-7 from mid-March to early November, PST = UTC-8 otherwise).
- A picked `YYYY-MM-DD` becomes `[YYYY-MM-DDT00:00:00±TZ, YYYY-MM-DDT23:59:59.999±TZ]`.
- Backend SQL: `source_created_at >= :from AND source_created_at <= :to` with bounds passed as ISO strings already in LA-offset form (frontend produces them via `snDayStartIso` / `snDayEndIso`).
- Frontend: `snDayStartIso()` / `snDayEndIso()` in `lib/ops_dashboard/aggregate.ts`. The function names date from when the anchor was Asia/Shanghai; semantics are now LA. Do not change the names — too many call sites.
- The Active Monitoring Hub (`OpsDashboardHub.tsx`) leaves the picker unset by default; drill-in dashboards default to MTD.

## 7. Region resolution

Region is geographic (where the caller is), not organisational (which team picked the ticket up). The frontend's three-step fallback chain in `regionOf()` MUST be reproduced server-side as a single `CASE` expression:

1. **Backend-resolved actor region** — `actor.location.region`, normalised. Accepted inputs: `AMER` / `EMEA` / `APAC` / `AMERICAS` / `EUROPE` / `EU` / `EURP` / `ASIA` plus any trailing variant (`AMER-1`, `APAC 2`); split on first non-letter and uppercase.
2. **Country → region map** — leading-token country match on `actor.location.descriptor`. Match priority:
   1. Whole-string match (handles multi-word country names like `Hong Kong`, `Korea, Republic of`, `United Kingdom`).
   2. Dash-head match (`US-California-Palo Alto` → `us`).
   3. First-token-on-any-separator match (`Singapore TWP Office` → `singapore`).
3. **Assignment-group prefix sniff** — apply the same normalisation as step 1 to `assigned_group` (catches `AMER OIT Support`, `EMEA HelpDesk`, etc).

Default when all three return null: **`OTHER`**.

### 7.1 Country → region table

The full canonical map lives in `lib/ops_dashboard/region.ts` (`COUNTRY_TO_REGION`). Currently:

- **AMER (13):** us, usa, united states, united states of america, canada, mexico, brazil, argentina, chile, colombia, peru, americas, amer
- **EMEA (57):** united kingdom, uk, great britain, ireland, france, germany, italy, spain, portugal, netherlands, belgium, luxembourg, switzerland, austria, denmark, finland, norway, sweden, iceland, poland, czech republic, slovakia, hungary, romania, bulgaria, greece, croatia, serbia, slovenia, türkiye, turkey, russia, russian federation, ukraine, belarus, kazakhstan, uzbekistan, azerbaijan, georgia, israel, saudi arabia, uae, united arab emirates, qatar, kuwait, bahrain, oman, jordan, lebanon, egypt, morocco, algeria, tunisia, south africa, nigeria, kenya, emea
- **APAC (31):** china, hong kong, macau, taiwan, japan, korea, s.korea, south korea, `korea, republic of`, india, pakistan, bangladesh, sri lanka, nepal, myanmar, thailand, vietnam, viet nam, cambodia, laos, malaysia, singapore, indonesia, philippines, brunei, mongolia, australia, new zealand, fiji, papua new guinea, apac

Lookup is **case-insensitive** on the trimmed token. To keep the backend in sync, port `COUNTRY_TO_REGION` into a SQL reference table or a generated VALUES list — do **not** hand-translate. The frontend treats `lib/ops_dashboard/region.ts` as the source of truth for this map until the backend table exists; once the backend table ships, swap the frontend to read from `/api/...` and delete the duplicated constant.

### 7.2 Canonical-country aliases (filter parity only)

The Country dropdown in `RegionCountryFilter` collapses spelling variants to a single label:

| Raw spellings                                                          | Canonical          |
|------------------------------------------------------------------------|--------------------|
| `US`, `USA`, `United States`, `United States of America`               | United States      |
| `UK`, `Great Britain`, `United Kingdom`                                | United Kingdom     |
| `S.Korea`, `South Korea`, `Korea`, `Korea, Republic of`                | South Korea        |
| `Viet Nam`, `Vietnam`                                                  | Vietnam            |
| `Türkiye`, `Turkey`                                                    | Türkiye            |
| `UAE`, `United Arab Emirates`                                          | United Arab Emirates |
| `Russia`, `Russian Federation`                                         | Russia             |

The report endpoint's `country_in[]` filter accepts canonical forms; the backend MUST apply this alias map before matching against `actor.location.descriptor`'s leading token.

## 8. Snapshot replay (`wasActiveAt` / MoM)

Month-over-month deltas for the four `…Active` KPIs (`totalActive`, `activeIncident`, `activeCatalog`, `activeAsset`) compare:

- **current** = `COUNT(*) FILTER (WHERE isActiveState(state))`
- **previous** = `COUNT(*) FILTER (wasActiveAt(row, now - INTERVAL '30 day'))`

`wasActiveAt(row, t)` returns true iff:

1. The row was **opened by `t`** — `COALESCE(source_created_at, created_at) <= t`. Use `source_created_at` first; this aligns the snapshot with when SN saw the ticket, not when our pipeline ingested it.
2. The row was **not yet closed at `t`** — closure timestamp is, in priority order:
   1. `COALESCE(source_resolved_at, source_closed_at)` if either is set;
   2. else, if `state` is **not** in the active list (§1), `COALESCE(source_updated_at, updated_at)` is used as a closure-time proxy;
   3. else the row is still considered active (closure timestamp = ∞).
3. If a closure timestamp resolves and is `<= t`, the row was closed by then → not active.

`vipActive` has **no MoM** (deliberately null on the frontend): the VIP fetches today are pre-filtered to `states_list=ACTIVE_STATES` server-side, so the necessary closure history isn't present in the slice. The report endpoint runs a single un-narrowed query and so CAN return a VIP MoM — adding it is a follow-up (out of scope for v1).

`now` is **server-stamped** in the response (`meta.now`). The frontend MUST NOT recompute `now` for delta math; it reads `meta.now` so old vs. new code paths produce identical numbers on the same response.

## 9. Endpoint contract — `GET /objects/activities/ops-dashboard/report/hub`

```ts
type OpsHubReport = {
  current: {
    kpis: {
      totalActive: number;
      activeIncident: number;
      activeIncidentHigh: number;       // priority = 'High' subset of activeIncident
      activeCatalog: number;
      activeAsset: number;
      vipActive: number;
      unassigned: number;
      agingIncidentGt2d: number;
      agingCatalogGt30d: number;
      agingAssetGt30d: number;
    };
    charts: {
      group_donut: { name: string; value: number }[];   // top 8, all OIT-scope rows, NULL/'' → 'Unknown'
      assignee_bar: { key: string; count: number }[];   // top 10, unassigned → 'Unassigned'
      region:      { region: 'AMER'|'EMEA'|'APAC'|'OTHER'; count: number }[]; // always 4 entries
    };
    filter_options: {
      assigned_groups: string[];      // distinct values seen in the OIT-scope active set, sorted
      locations: string[];            // distinct actor.location.descriptor values, sorted
      priorities: string[];           // distinct priority values, sorted
    };
  };
  previous: {
    kpis: {
      totalActive: number;
      activeIncident: number;
      activeCatalog: number;
      activeAsset: number;
    };
  };
  meta: {
    now: string;          // ISO8601, server clock used for §5 aging math and §8 MoM math
    snapshot_at: string;  // ISO8601, identical to `now` unless the response is served from cache
    partial?: boolean;    // true if the underlying query hit the 5s statement-timeout budget
  };
};
```

**Query params** (all optional):

- `region_in[]` — subset of `AMER | EMEA | APAC | OTHER`. Filter applies via §7 to every aggregate.
- `country_in[]` — canonical country labels (see §7.2).
- `location_in[]` — verbatim `actor.location.descriptor` strings.
- `assigned_group_in[]` — donut-driven, verbatim values.
- `priority_in[]` — verbatim priority strings.
- `source_created_at_from` / `source_created_at_to` — §6 LA-anchored ISOs.

**Caching:** `Cache-Control: private, max-age=60` — mirrors the slim list endpoint. The 60s in-memory cache on the frontend (`lib/hooks/useOpsDashboard.ts`) continues to dedup repeated filter combinations.

**Permission:** `objects:incidents:read` AND `objects:requests:read` (intersect with caller's existing ABAC scope; the report respects WORKER_ORG row-level filtering the same way the list endpoints do).

## 10. Drift defence — fixture parity test

The backend ships `tests/test_ops_dashboard_hub_report.py`. It loads a hand-curated fixture of ~50 ticket rows covering every branch above (active/inactive states, all OIT keyword variants, ASTTASK/SCTASK/heuristic-fallback requests, unassigned-by-OID vs unassigned-by-name, aging tiers around the 2d/30d boundaries, all three region fallback layers, snapshot-replay edge cases) and asserts:

- The SQL aggregate's `{current, previous}` block equals a hand-coded reference dict.
- A pure-Python port of the frontend's predicates (lifted from `lib/ops_dashboard/aggregate.ts`) computed over the same fixture also equals the reference dict.

Both equality checks MUST pass on every CI run. Adding a new branch (e.g. a new active state) is a three-step PR: (1) update this spec; (2) update the SQL + Python port; (3) extend the fixture.

The frontend additionally keeps a dev-only diff mode (`?compare=1`) that fetches the new report AND the legacy `fetchAll` arrays, recomputes the legacy KPIs in-browser, and console-logs any non-zero deltas. This is the manual spot-check gate before the v1 cutover.

## Appendix — file pointers

Where each rule lives today on the frontend:

| Rule          | File                                                                          |
|---------------|-------------------------------------------------------------------------------|
| §1 states     | `lib/ops_dashboard/aggregate.ts` — `ACTIVE_STATES`, `isActiveState()`         |
| §2 OIT scope  | `lib/ops_dashboard/aggregate.ts` — `OIT_SCOPE_GROUP_KEYWORDS`, `isInScopeGroup()` |
| §3 classifier | `lib/ops_dashboard/aggregate.ts` — `classifyRequestType()`                    |
| §4 unassigned | `app/(main)/operation-teams/ops-dashboard/OpsDashboardHub.tsx` (KPI loop)     |
| §5 aging      | `lib/ops_dashboard/aggregate.ts` — `daysSinceUpdated()`                       |
| §6 dates      | `lib/ops_dashboard/aggregate.ts` — `snDayStartIso()` / `snDayEndIso()` / `TICKET_TIMEZONE` |
| §7 region     | `lib/ops_dashboard/region.ts` + `OpsDashboardHub.tsx` `regionOf()` chain      |
| §8 MoM        | `lib/ops_dashboard/aggregate.ts` — `wasActiveAt()`, `momActiveSnapshot()`     |
