# Survey List Location Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new **Location** column to the survey list page — both the on-screen row display and the Excel export — showing each receiver's specific office/site name (the leaf location behind `Worker.location_oid`).

**Architecture:** The backend's Worker list endpoint denormalizes `country_name` and `region_name` onto Worker rows but does **not** denormalize the leaf location name. So the frontend fetches the full `Location` list once (same pattern as the existing `useAllActiveWorkers` hook), builds an in-memory `location_oid → location.name` map, and joins it against each survey's `receiver_oid → Worker.location_oid`. The existing workers-loading guard on the export button is extended to also wait for locations. The display list gets a new subtitle segment.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript, existing `/api/objects/locations` proxy route, existing `downloadXlsx` helper.

---

## File Structure

### Files to create
- `components/campaign_surveys/useAllLocations.ts` — client hook that fetches every `Location` via the proxied `/api/objects/locations` endpoint, paginating until exhausted. Mirrors `useAllActiveWorkers.ts` exactly (return shape: `{ locations, isLoading, error, reload }`).

### Files to modify
- `app/(main)/data/surveys/SurveysListPage.tsx` — wire the new hook, extend the worker-geo map value type to include `locationName`, add a `Location` column to the xlsx export (slotted between `Region` and `Status` so the geographic columns stay grouped), render the location in the row subtitle, extend the export readiness guard and the error banner to account for the new data dependency.

No backend changes. No changes to `lib/types/objects.ts` — `Location` already exists at `lib/types/objects.ts:85-96`.

---

## Context notes for the implementing engineer

- `Worker.location_oid` (see `lib/types/objects.ts:165`) is a nullable pointer to a `Location` row. Workers with no office assignment (e.g. remote-only, contractors pending onboarding) have `null` here → show blank.
- The `/api/objects/locations` route is proxied through `app/api/objects/[resource]/route.ts` (`resource === 'locations'`). It forwards `limit`/`skip` query params and returns `{ items: Location[], total, skip, limit }` like the workers endpoint. Default limit on the server side is 1000.
- The existing hook `components/campaign_surveys/useAllActiveWorkers.ts` is your template — use the exact same pagination guard logic (`MAX_PAGES = 200`, dedupe by `oid`, break on short page or when `total` reached).
- There is no test infrastructure in this repo (confirmed: no Jest / Vitest config, no project `*.test.*` files outside `node_modules`). Verification is manual browser + `npx tsc --noEmit`. This plan does **not** include TDD steps because the skill's test steps would not run.
- The feature branch for this work is the current `local` branch. Sync-to-development is a separate workflow in `CLAUDE.md`; do not squash-merge inside these tasks.

---

## Tasks

### Task 1: Create the `useAllLocations` hook

**Files:**
- Create: `components/campaign_surveys/useAllLocations.ts`

- [ ] **Step 1: Write the hook**

Create `components/campaign_surveys/useAllLocations.ts` with the following contents (deliberately mirrors `useAllActiveWorkers.ts:1-93`):

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Location } from '@/lib/types/objects';

interface LocationListEnvelope {
    items: Location[];
    total?: number;
    skip?: number;
    limit?: number;
}

interface UseAllLocationsResult {
    locations: Location[];
    isLoading: boolean;
    error: string | null;
    reload: () => Promise<void>;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

export function useAllLocations(): UseAllLocationsResult {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadLocations = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const allLocations: Location[] = [];
            const seen = new Set<string>();
            let skip = 0;
            let pageCount = 0;
            let total: number | null = null;

            while (pageCount < MAX_PAGES) {
                const response = await fetch(
                    `/api/objects/locations?limit=${PAGE_SIZE}&skip=${skip}`,
                    { cache: 'no-store' }
                );

                if (!response.ok) {
                    throw new Error(`Failed to load locations (${response.status})`);
                }

                const payload = (await response.json()) as LocationListEnvelope;
                const pageItems = Array.isArray(payload.items) ? payload.items : [];

                if (typeof payload.total === 'number' && Number.isFinite(payload.total)) {
                    total = payload.total;
                }

                for (const loc of pageItems) {
                    if (seen.has(loc.oid)) continue;
                    seen.add(loc.oid);
                    allLocations.push(loc);
                }

                if (pageItems.length < PAGE_SIZE) {
                    break;
                }

                if (typeof total === 'number' && allLocations.length >= total) {
                    break;
                }

                skip += PAGE_SIZE;
                pageCount += 1;
            }

            setLocations(allLocations);
        } catch (err) {
            setLocations([]);
            setError(err instanceof Error ? err.message : 'Failed to load locations');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLocations();
    }, [loadLocations]);

    return {
        locations,
        isLoading,
        error,
        reload: loadLocations,
    };
}
```

Why this shape: the caller only needs the full set once on mount, re-fetch is never triggered today, and keeping the interface identical to `useAllActiveWorkers` means a future refactor can merge the two into a generic `useAllPagedResource<T>(path)` helper in one pass.

- [ ] **Step 2: Type-check the new file in isolation**

Run: `npx tsc --noEmit`
Expected: exits 0 with no diagnostics. If `Location` import fails, verify `lib/types/objects.ts:85` still exports `Location`.

- [ ] **Step 3: Commit**

```bash
git add components/campaign_surveys/useAllLocations.ts
git commit -m "feat: add useAllLocations hook for client-side location lookup"
```

---

### Task 2: Wire `useAllLocations` into SurveysListPage and build the lookup map

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` (imports block ~lines 1-10, hook usage ~line 39, `workerGeoMap` memo ~lines 123-132)

- [ ] **Step 1: Add the import**

In `app/(main)/data/surveys/SurveysListPage.tsx`, locate the existing import block and add the hook next to `useAllActiveWorkers`:

```ts
import { useAllActiveWorkers } from '@/components/campaign_surveys/useAllActiveWorkers';
import { useAllLocations } from '@/components/campaign_surveys/useAllLocations';
```

- [ ] **Step 2: Call the hook alongside the workers hook**

Replace the existing worker-hook line (currently around `app/(main)/data/surveys/SurveysListPage.tsx:39`):

```ts
    const { workers, error: workersError, isLoading: isLoadingWorkers } = useAllActiveWorkers();
```

with:

```ts
    const { workers, error: workersError, isLoading: isLoadingWorkers } = useAllActiveWorkers();
    const { locations, error: locationsError, isLoading: isLoadingLocations } = useAllLocations();
```

- [ ] **Step 3: Build a `locationNameMap` and extend `workerGeoMap` to include `locationName`**

Replace the entire `workerGeoMap` memo block (currently `app/(main)/data/surveys/SurveysListPage.tsx:120-132`) with the following. The new memo first indexes locations by oid, then walks the workers list once to produce a single `workerGeoMap` whose value now carries all three strings the export needs.

```ts
    // Map location_oid → Location.name. Built from the full Locations list so we
    // can resolve the leaf office/site that Worker.location_oid points at. The
    // backend's Worker list endpoint denormalizes country_name/region_name but
    // not the location name, so this lookup lives client-side.
    const locationNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const loc of locations) {
            map.set(loc.oid, loc.name);
        }
        return map;
    }, [locations]);

    // Map worker_oid → denormalized country/region + resolved location name.
    // Used by both the row renderer and handleExportExcel. Any field can be null
    // when the backend has not resolved geo for that worker or when location_oid
    // points at a stale/unknown location.
    const workerGeoMap = useMemo(() => {
        const map = new Map<string, { country: string | null; region: string | null; location: string | null }>();
        for (const w of workers) {
            const locationName = w.location_oid ? locationNameMap.get(w.location_oid) ?? null : null;
            map.set(w.oid, {
                country: w.country_name ?? null,
                region: w.region_name ?? null,
                location: locationName,
            });
        }
        return map;
    }, [workers, locationNameMap]);
```

Note: `locationNameMap.get(w.location_oid) ?? null` converts the `undefined` (missing key) case into `null` so the downstream cell logic only has one "no data" sentinel to handle.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. If TypeScript complains about the map value shape, confirm Step 3 replaced the entire old `workerGeoMap` block and did not leave the old `Map<string, { country; region }>` declaration above the new one.

- [ ] **Step 5: Commit**

```bash
git add app/\(main\)/data/surveys/SurveysListPage.tsx
git commit -m "feat: resolve worker location name in surveys list page"
```

---

### Task 3: Add the Location column to the Excel export

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` (the `handleExportExcel` callback — currently ~lines 140-215)

- [ ] **Step 1: Update the export readiness guard**

Find the line (currently around `app/(main)/data/surveys/SurveysListPage.tsx:142`):

```ts
    const isExportReady = !isLoadingSurveys && !isLoadingWorkers && filteredSurveys.length > 0;
```

Replace with (adds locations to the gate):

```ts
    const isExportReady = !isLoadingSurveys && !isLoadingWorkers && !isLoadingLocations && filteredSurveys.length > 0;
```

- [ ] **Step 2: Add "Location" to the export header row**

Find the header array inside `handleExportExcel` (currently ~`app/(main)/data/surveys/SurveysListPage.tsx:158-160`):

```ts
        const headers: string[] = [
            'Receiver Stable ID', 'Country', 'Region', 'Status', 'Submitted At', 'Created At', 'Updated At',
        ];
```

Replace with (new `Location` column slots between `Region` and `Status` so geographic fields stay grouped):

```ts
        const headers: string[] = [
            'Receiver Stable ID', 'Country', 'Region', 'Location', 'Status', 'Submitted At', 'Created At', 'Updated At',
        ];
```

- [ ] **Step 3: Emit the location cell in every row**

Find the per-survey row assembly block (currently `app/(main)/data/surveys/SurveysListPage.tsx:207-217`):

```ts
            const geo = workerGeoMap.get(survey.receiver_oid);
            return [
                survey.receiver_stable_id,
                geo?.country ?? '',
                geo?.region ?? '',
                survey.status,
                survey.submitted_at ?? '',
                survey.created_at,
                survey.updated_at,
                ...qaCells,
            ];
```

Replace with (new cell `geo?.location ?? ''` inserted after Region, matching the header order):

```ts
            const geo = workerGeoMap.get(survey.receiver_oid);
            return [
                survey.receiver_stable_id,
                geo?.country ?? '',
                geo?.region ?? '',
                geo?.location ?? '',
                survey.status,
                survey.submitted_at ?? '',
                survey.created_at,
                survey.updated_at,
                ...qaCells,
            ];
```

- [ ] **Step 4: Update the `handleExportExcel` dependency array**

Find the closing `useCallback` deps (currently ~`app/(main)/data/surveys/SurveysListPage.tsx:222`):

```ts
    }, [isExportReady, filteredSurveys, selectedBatch, workerGeoMap]);
```

`workerGeoMap` already depends on `locations` transitively via Task 2 Step 3, so the dep list does **not** need to change. Leave it as-is. (This step exists only to stop a future engineer from adding a redundant `locations` dep and triggering an ESLint exhaustive-deps warning.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/\(main\)/data/surveys/SurveysListPage.tsx
git commit -m "feat: add Location column to survey Excel export"
```

---

### Task 4: Show the location on the on-screen row

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` (the list-row render block — currently ~lines 326-347)

- [ ] **Step 1: Read the location inside the row map**

Find the row map (currently `app/(main)/data/surveys/SurveysListPage.tsx:328-347`):

```tsx
                            {filteredSurveys.map((survey) => {
                                const statusStyle = STATUS_COLORS[survey.status] || STATUS_COLORS.created;
                                return (
                                    <button
                                        key={survey.oid}
                                        onClick={() => router.push(`/data/surveys/${survey.oid}?batch=${survey.survey_batch_oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {survey.receiver_stable_id}
                                            </div>
                                            <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {survey.submitted_at ? `Submitted ${new Date(survey.submitted_at).toLocaleDateString()}` : 'Not submitted'}
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                            {survey.status}
                                        </span>
                                    </button>
                                );
                            })}
```

Replace with (pulls the same `workerGeoMap` entry used by the export so on-screen and exported values can never disagree; appends the location to the existing subtitle line with a middle-dot separator, or falls back to a dash when absent so the row stays visually stable):

```tsx
                            {filteredSurveys.map((survey) => {
                                const statusStyle = STATUS_COLORS[survey.status] || STATUS_COLORS.created;
                                const geo = workerGeoMap.get(survey.receiver_oid);
                                const locationLabel = geo?.location ?? '—';
                                const submittedLabel = survey.submitted_at
                                    ? `Submitted ${new Date(survey.submitted_at).toLocaleDateString()}`
                                    : 'Not submitted';
                                return (
                                    <button
                                        key={survey.oid}
                                        onClick={() => router.push(`/data/surveys/${survey.oid}?batch=${survey.survey_batch_oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {survey.receiver_stable_id}
                                            </div>
                                            <div className={`text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {submittedLabel} · {locationLabel}
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                            {survey.status}
                                        </span>
                                    </button>
                                );
                            })}
```

Why a subtitle segment instead of a new visual column: the current row is a flex layout, not a table, and squeezing a fourth top-level element compresses the status pill on narrow viewports. Keeping location in the subtitle preserves the existing rhythm while still making the value scannable.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/data/surveys/SurveysListPage.tsx
git commit -m "feat: show worker location in survey list row subtitle"
```

---

### Task 5: Extend the export-button loading state and the error banner

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` (export button tooltip/spinner — currently ~lines 259-279; geo error banner — currently ~lines 299-304)

- [ ] **Step 1: Update the export button's tooltip and spinner conditions**

Find the export button block (currently `app/(main)/data/surveys/SurveysListPage.tsx:259-279`):

```tsx
                        <button
                            onClick={handleExportExcel}
                            disabled={!isExportReady}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'} disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={
                                isLoadingSurveys
                                    ? 'Loading surveys — export will be enabled when all rows are loaded'
                                    : isLoadingWorkers
                                        ? 'Loading worker geo data — export will be enabled shortly'
                                        : filteredSurveys.length === 0
                                            ? 'No surveys to export'
                                            : 'Export to Excel'
                            }
                        >
                            {isLoadingSurveys || isLoadingWorkers ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                        </button>
```

Replace with (adds `isLoadingLocations` to both the tooltip decision tree and the spinner condition):

```tsx
                        <button
                            onClick={handleExportExcel}
                            disabled={!isExportReady}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'} disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={
                                isLoadingSurveys
                                    ? 'Loading surveys — export will be enabled when all rows are loaded'
                                    : isLoadingWorkers
                                        ? 'Loading worker geo data — export will be enabled shortly'
                                        : isLoadingLocations
                                            ? 'Loading office/site locations — export will be enabled shortly'
                                            : filteredSurveys.length === 0
                                                ? 'No surveys to export'
                                                : 'Export to Excel'
                            }
                        >
                            {isLoadingSurveys || isLoadingWorkers || isLoadingLocations ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                        </button>
```

- [ ] **Step 2: Update the geo failure banner to cover both hooks**

Find the banner block (currently `app/(main)/data/surveys/SurveysListPage.tsx:299-304`):

```tsx
                {/* Worker geo data failure banner — export still works, but Country/Region cells will be empty */}
                {workersError && (
                    <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        Country/Region unavailable — worker geo data failed to load. Export will still run with empty geo columns.
                    </div>
                )}
```

Replace with (the banner now triggers on either failure and names the specific missing columns so ops can tell which upstream service is down):

```tsx
                {/* Worker/location geo data failure banner — export still works, but affected cells will be empty */}
                {(workersError || locationsError) && (
                    <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {workersError && locationsError
                            ? 'Country/Region/Location unavailable — worker and location data failed to load. Export will still run with empty geo columns.'
                            : workersError
                                ? 'Country/Region unavailable — worker geo data failed to load. Export will still run with empty geo columns.'
                                : 'Location unavailable — office/site data failed to load. Export will still run with empty Location cells.'}
                    </div>
                )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/data/surveys/SurveysListPage.tsx
git commit -m "feat: extend export loading guard and banner to cover locations"
```

---

### Task 6: Browser verification

**Files:** none modified — manual verification against the running dev container (port 3007 per `CLAUDE.md` / project memory).

- [ ] **Step 1: Rebuild and restart the local Docker**

```bash
docker stop it-aware-frontend 2>/dev/null; docker rm it-aware-frontend 2>/dev/null
docker build -t it-aware-frontend:latest .
docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:latest
```

Expected: `docker ps --filter name=it-aware-frontend` shows `Up ...` with port mapping `0.0.0.0:3007->3000/tcp`. `docker logs it-aware-frontend` ends with `✓ Ready in …`.

- [ ] **Step 2: Load the Surveys page**

Open `http://localhost:3007/data/surveys` in a browser. Wait for the batch dropdown to populate and a batch's surveys to load.

Expected (happy path):
1. Each row's subtitle reads `Submitted MM/DD/YYYY · <Office Name>` (or `Not submitted · <Office Name>`). Rows whose worker has no `location_oid` show `· —`.
2. While either workers or locations is still loading, the header Download button shows the spinner icon and the tooltip names which dataset is loading (hover to see it).
3. When everything is loaded, the Download icon returns and the button becomes clickable.

- [ ] **Step 3: Export and inspect the xlsx**

Click the Download button. Open the downloaded `surveys_<batch>_export.xlsx`.

Expected:
1. Header row order: `Receiver Stable ID | Country | Region | Location | Status | Submitted At | Created At | Updated At | Question 1 | Answer 1 | …`.
2. For any row whose receiver has a known office assignment, the `Location` cell is populated and matches the subtitle shown in the UI for that same row.
3. For any row whose receiver's worker has `location_oid === null`, the `Location` cell is blank (not `—` — the dash is a display convention for the on-screen subtitle only).
4. Rows whose `receiver_oid` is not in the workers list still export (blank `Country`/`Region`/`Location` — behavior matches the pre-existing fallback).

- [ ] **Step 4: Verify the failure banner (optional, if an environment is available where the locations endpoint can be made to fail)**

If you can force the Locations proxy to return a non-2xx response (e.g. revoke a dependent cookie, or temporarily block the upstream in a dev stack), reload the page.

Expected:
1. The amber banner above the list shows `Location unavailable — office/site data failed to load.`
2. The Download button is still enabled once surveys + workers have loaded; the export runs with blank `Location` cells.

If you cannot reproduce this environment, skip this step and note it in the PR description.

---

### Task 7: Final repo verification and push

**Files:** none modified.

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: exits 0 with no diagnostics.

- [ ] **Step 2: Confirm the branch is clean and review the log**

```bash
git status
git log --oneline -8
```

Expected: working tree clean; commits from Tasks 1-5 visible in order (5 atomic commits).

- [ ] **Step 3: Hand off**

Do **not** execute the `CLAUDE.md` sync-branch workflow inside this plan — that happens separately when the user asks for a sync. Report completion and let the user drive the sync step.

---

## Self-review notes (written while drafting)

- **Spec coverage** — User asked for: (a) new column in the download, (b) new column in the displaying list, both for worker's location. Task 3 covers (a), Task 4 covers (b), Tasks 1-2 build the shared data path both need, and Task 5 ensures neither the button nor the banner silently gives users stale data. Covered.
- **Placeholder scan** — No `TBD` / `TODO` / `similar to` references; every code step shows the final file contents or an exact replacement. Steps that do nothing-but-reason (Task 3 Step 4) are labelled as such to explain *why* they exist.
- **Type consistency** — `workerGeoMap` value type in Task 2 (`{ country; region; location }`) matches the cell reads in Task 3 (`geo?.location`) and Task 4 (`geo?.location`). Hook return keys (`locations`, `isLoading`, `error`, `reload`) match the destructuring in Task 2 Step 2. The `Location` type imported in the hook matches the one exported at `lib/types/objects.ts:85`.
- **Known deviation from the skill template** — TDD steps omitted because the repo has no test runner; verification is compiler + manual browser, called out in the *Context notes* section so an executing agent doesn't try to add a Jest config mid-plan.
