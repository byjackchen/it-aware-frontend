# Survey Export — Country and Region Columns

**Date:** 2026-04-07
**Status:** Approved (brainstorming complete, pending implementation plan)
**Origin:** Request from Zhang Jingjing (Geo Ops) — add Country and Region to the raw data in `surveys_<batch>_export.xlsx` so each Geo Ops lead can filter to the items needing attention in their region.

## Problem

The Surveys list page (`/data/surveys`) exports an xlsx of all surveys in the selected batch. Today the export contains identity, status, timestamps, and one column per survey question — but no geographic information. Geo Ops leads who download the file have no way to filter to the rows for their own country or region without manually joining against an external employee directory.

The Survey Analytics dashboard already shows submission counts grouped by country/region for the same batches, so the resolution chain is established and trusted. The export just doesn't surface it.

## Goal

Add `Country` and `Region` columns to the Survey list xlsx export, sourced from the same resolution chain the Survey Analytics dashboard already uses, with no backend changes.

## Non-goals

- No country/region filter UI on the in-app surveys list — the request is specifically about the *export*.
- No new shared `locationResolver` utility — only one consumer needs it; extracting now would be premature.
- No backend changes.
- No changes to the interactions/incidents exports.
- No automated tests for the export — the existing export has none and adding test infra for one feature is scope creep.

## Resolution chain (source of truth)

`Survey.receiver_oid → Worker.location_oid → walk Location.parent_oid up the hierarchy → ancestor of type 'country' / type 'region'`

This is the same chain implemented in `app/api/dashboard/survey-analytics/submission-overview/route.ts:131-154` (`findAncestor`, `getCountry`, `getRegion`). Export numbers will therefore match what Geo Ops already see in the Survey Analytics dashboard's geo distribution chart for the same batch.

## Contract

### Files changed

- `app/(main)/data/surveys/SurveysListPage.tsx` — only file touched.

### New columns

Position immediately after `Receiver Stable ID`:

```
Receiver Stable ID | Country | Region | Status | Submitted At | Created At | Updated At | <Q1> | <Q2> | ...
```

### Cell values

- Resolved country name (e.g., `China`, `United States`) when the chain succeeds.
- Resolved region name (e.g., `APAC`, `AMER`) when the chain succeeds.
- **Empty cell** when:
  - Worker has no `location_oid`
  - Worker's `location_oid` is missing from `locMap` (orphan / stale reference)
  - Hierarchy walk does not reach a `country` or `region` ancestor

Empty cells let Excel's "Blanks" filter group the unresolved rows naturally.

## Data flow

```
SurveysListPage mounts
   │
   ├─► fetch /api/campaigns/survey_batchs            (existing)
   │
   ├─► batch selected → fetch surveys (paginated)    (existing)
   │
   └─► on mount → fetch workers + locations          (NEW, parallel, batch-independent)
            │                  │
            ▼                  ▼
       useAllActiveWorkers    /api/objects/locations
       (existing hook,        (NEW inline paginated fetch,
        active workers only)   pattern copied from fetchAllSurveys)
            │                  │
            └─────► build two lookup maps in component state:
                     workerLocMap: Map<worker_oid, location_oid | null>
                     locMap:       Map<location_oid, LocationItem>
```

### Why fetch on mount rather than on batch-select or on click

- Workers and locations do **not** depend on the selected batch — they are global org data. Fetching them on batch-select would re-fetch identical data on every batch switch.
- Fetching on mount runs in parallel with the existing batches list fetch, hiding latency.
- Export click is instant — no spinner, no extra wait at the moment Geo Ops actually want the file.

### Reusing existing infrastructure

- **Workers:** reuse `useAllActiveWorkers` hook from `components/campaign_surveys/useAllActiveWorkers.ts:23`. It already paginates `/api/objects/workers?is_active=true`, fetches on mount, returns `{ workers, isLoading, error, reload }`. This is reuse, not new abstraction.
- **Locations:** no existing hook. Add an inline paginated fetch for `/api/objects/locations` directly inside `SurveysListPage.tsx`, mirroring the pagination pattern of the existing `fetchAllSurveys` callback. Single consumer; do not extract a hook.

### `is_active=true` assumption for workers

The reused worker hook fetches only active workers. A worker who was active when the batch was created but is now inactive will not appear in `workerLocMap` and will fall through to **empty** Country/Region cells — exactly the same fallback as a worker with no `location_oid`. This is acceptable: Geo Ops still get the survey row, just without geo enrichment for that one departed employee. Document this in the implementation comments so future maintainers know it is intentional.

### Failure handling

If workers or locations fetch fails: **do not block the export.** Show a small banner ("Country/Region unavailable — geo data failed to load") and let the user export with empty Country/Region cells. Geo Ops still get the survey data; they just lose the filter convenience this one time.

The export button is **never** disabled by geo loading state. It tracks `filteredSurveys.length === 0` only, same as today.

### Resolver logic

Copied (~15 lines) from `app/api/dashboard/survey-analytics/submission-overview/route.ts:131-154` — `findAncestor`, `getCountry`, `getRegion`. Lives as local helpers inside `handleExportExcel` (or just above it in the module). Single-consumer rule: do not extract into a shared module.

## Edge cases handled

1. **Worker has no `location_oid`** → empty Country, empty Region.
2. **Worker is missing from `workerLocMap`** (inactive worker, or hook failed to load) → empty Country, empty Region.
3. **Location oid in worker but not in `locMap`** (orphan / stale) → empty Country, empty Region.
4. **Location is itself a `country` or `region` node** (not under an office) → matches `submission-overview` behavior at `route.ts:151-152`: country resolves to the location itself.
5. **Workers/locations still loading when user clicks Export** → export proceeds with whatever maps exist; missing rows get empty cells. Banner covers the "fetch failed entirely" case; "fetch in progress" produces partial enrichment, which is harmless and rare.
6. **Search filter active** → only the filtered, exported rows get enriched (current behavior — `filteredSurveys`, not `surveys`).

## Manual test plan

1. Open `/data/surveys`, select the Ohla Survey Feb 2026 batch, wait for it to load.
2. Click Export. Open the xlsx. Verify column order is `Receiver Stable ID | Country | Region | Status | ...` and values match what the Survey Analytics Geo Distribution chart shows for that batch.
3. Apply a search filter, export again, verify only filtered rows + correct geo.
4. Simulate failure: in DevTools, block `/api/objects/workers`. Reload, select batch. Verify the banner appears and the export still works with empty Country/Region cells.
5. Spot-check a worker known to have no location → empty cells.

## What we are explicitly NOT doing (YAGNI)

- No new shared `locationResolver` utility — single consumer.
- No new `useAllLocations` hook — single consumer; inline fetch is enough.
- No backend / server changes — frontend-only.
- No Country/Region filter UI on the surveys list page itself — request is for the export only.
- No retry logic on workers/locations fetch failure — banner + degrade is enough.
- No fallback to fetch *all* workers (including inactive) — graceful empty-cell degradation for departed employees is acceptable, and the existing hook is already battle-tested.
- No changes to the existing interactions/incidents exports.
