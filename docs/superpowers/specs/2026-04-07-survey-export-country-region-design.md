# Survey Export — Country and Region Columns

**Date:** 2026-04-07
**Status:** Approved (brainstorming complete, pending implementation plan)
**Origin:** Request from Zhang Jingjing (Geo Ops) — add Country and Region to the raw data in `surveys_<batch>_export.xlsx` so each Geo Ops lead can filter to the items needing attention in their region.

## Problem

The Surveys list page (`/data/surveys`) exports an xlsx of all surveys in the selected batch. Today the export contains identity, status, timestamps, and one column per survey question — but no geographic information. Geo Ops leads who download the file have no way to filter to the rows for their own country or region without manually joining against an external employee directory.

The Survey Analytics dashboard already shows submission counts grouped by country/region for the same batches, and the SSC Cockpit dashboard already displays per-row Country/Region read off Worker records. The export just doesn't surface it.

## Goal

Add `Country` and `Region` columns to the Survey list xlsx export, sourced from the same Worker fields the SSC Cockpit dashboard already trusts, with no backend changes.

## Non-goals

- No country/region filter UI on the in-app surveys list — the request is specifically about the *export*.
- No backend changes.
- No changes to the interactions/incidents exports.
- No automated tests for the export — the existing export has none and adding test infra for one feature is scope creep.

## Source of truth

The Worker list endpoint already returns each worker with denormalized `region_name` and `country_name` fields, populated server-side by walking the location hierarchy. See `lib/types/objects.ts:174-177`:

```ts
// SSC dashboard — denormalized hierarchy context (populated by Worker list endpoint)
region_name?: string | null;
country_name?: string | null;
department_name?: string | null;
```

The SSC Cockpit dashboard already consumes these fields directly at `app/(main)/ssc-cockpit/dashboard/page.tsx:16-17`. The export will use the same fields, so its values match what SSC Cockpit shows for the same workers.

**Trade-off acknowledged:** This trusts the backend's denormalization. If a worker is moved to a new office but the worker record isn't refreshed, the export shows stale geo. For an internal tool with daily-or-better worker sync, this is acceptable, and matches the trust the SSC Cockpit dashboard already places in these fields.

## Contract

### Files changed

- `app/(main)/data/surveys/SurveysListPage.tsx` — only file touched.

### New columns

Position immediately after `Receiver Stable ID`:

```
Receiver Stable ID | Country | Region | Status | Submitted At | Created At | Updated At | <Q1> | <Q2> | ...
```

### Cell values

- `worker.country_name` and `worker.region_name` for the worker matching `survey.receiver_oid`.
- **Empty cell** when:
  - Survey's `receiver_oid` is not in the `workerGeoMap` (worker is inactive, or workers fetch failed)
  - The worker is in the map but the field is `null` / `undefined` (backend has no resolved country/region for them)

Empty cells let Excel's "Blanks" filter group the unresolved rows naturally.

## Data flow

```
SurveysListPage mounts
   │
   ├─► fetch /api/campaigns/survey_batchs            (existing)
   │
   ├─► batch selected → fetch surveys (paginated)    (existing)
   │
   └─► useAllActiveWorkers (NEW, runs on mount, batch-independent)
            │
            ▼
       Worker[] with country_name & region_name populated by backend
            │
            ▼
       useMemo: workerGeoMap: Map<worker_oid, { country: string|null, region: string|null }>
            │
            ▼
       handleExportExcel: workerGeoMap.get(survey.receiver_oid) → Country/Region cells
```

### Why fetch workers on mount rather than on batch-select or on click

- Workers do **not** depend on the selected batch — they are global org data. Fetching on batch-select would re-fetch identical data on every batch switch.
- Fetching on mount runs in parallel with the existing batches list fetch, hiding latency.
- Export click is instant — no spinner, no extra wait at the moment Geo Ops actually want the file.

### Reusing existing infrastructure

Reuse `useAllActiveWorkers` hook from `components/campaign_surveys/useAllActiveWorkers.ts:23`. It already paginates `/api/objects/workers?is_active=true`, fetches on mount, returns `{ workers, isLoading, error, reload }`. This is reuse, not new abstraction.

### `is_active=true` assumption for workers

The reused worker hook fetches only active workers. A worker who was active when the batch was created but is now inactive will not appear in `workerGeoMap` and will fall through to **empty** Country/Region cells. This is acceptable: Geo Ops still get the survey row, just without geo enrichment for that one departed employee. Document this in the implementation comments so future maintainers know it is intentional.

### Failure handling

If the workers fetch fails: **do not block the export.** Show a small banner ("Country/Region unavailable — worker geo data failed to load") and let the user export with empty Country/Region cells. Geo Ops still get the survey data; they just lose the filter convenience this one time.

The export button is **never** disabled by worker loading state. It tracks `filteredSurveys.length === 0` only, same as today.

## Edge cases handled

1. **Survey's `receiver_oid` not in `workerGeoMap`** (inactive worker, or workers fetch failed) → empty Country, empty Region.
2. **Worker is in map but `country_name` / `region_name` is null** (backend hasn't resolved geo for them — e.g., worker has no `location_oid`, or location doesn't roll up to country/region) → empty cell for the null field.
3. **Workers still loading when user clicks Export** → export proceeds with whatever map exists; missing rows get empty cells. Banner covers the "fetch failed entirely" case; "fetch in progress" produces partial enrichment, which is harmless and rare.
4. **Search filter active** → only the filtered, exported rows get enriched (current behavior — `filteredSurveys`, not `surveys`).

## Manual test plan

1. Open `/data/surveys`, select the Ohla Survey Feb 2026 batch, wait for it to load.
2. Click Export. Open the xlsx. Verify column order is `Receiver Stable ID | Country | Region | Status | ...` and values match what the SSC Cockpit dashboard shows for the same workers.
3. Apply a search filter, export again, verify only filtered rows + correct geo.
4. Simulate failure: in DevTools, block `/api/objects/workers`. Reload, select batch. Verify the banner appears and the export still works with empty Country/Region cells.
5. Spot-check a survey for an inactive or unresolvable worker → empty cells.

## What we are explicitly NOT doing (YAGNI)

- No locations fetch and no client-side hierarchy walk — Worker already has `region_name` / `country_name` denormalized by the backend.
- No new shared `workerGeoResolver` utility — single consumer.
- No backend / server changes — frontend-only.
- No Country/Region filter UI on the surveys list page itself — request is for the export only.
- No retry logic on workers fetch failure — banner + degrade is enough.
- No fallback to fetch *all* workers (including inactive) — graceful empty-cell degradation for departed employees is acceptable, and the existing hook is already battle-tested.
- No changes to the existing interactions/incidents exports.
