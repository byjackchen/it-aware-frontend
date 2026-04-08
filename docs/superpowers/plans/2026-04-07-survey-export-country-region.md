# Survey Export — Country/Region Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Country` and `Region` columns to the Surveys list xlsx export, sourced from the denormalized `country_name` / `region_name` fields the backend already returns on every Worker.

**Architecture:** Single-file frontend change. Reuse the existing `useAllActiveWorkers` hook to load workers on mount in parallel with the existing batches/surveys fetches. Build a `workerGeoMap` via `useMemo`. In `handleExportExcel`, look up each survey's `receiver_oid` in the map and emit two new cells immediately after `Receiver Stable ID`. On worker fetch failure, show a non-blocking banner and let the export proceed with empty geo cells.

**Tech Stack:** React (client component), Next.js, TypeScript, existing `xlsx` package via `lib/utils/export-xlsx.ts`.

**Spec:** `docs/superpowers/specs/2026-04-07-survey-export-country-region-design.md`

---

## File structure

**Modify only:**
- `app/(main)/data/surveys/SurveysListPage.tsx` — single file. Add an import for `useAllActiveWorkers`, derive `workerGeoMap` via `useMemo`, update `handleExportExcel`, render a small failure banner.

No new files. No new hooks. No backend changes.

---

## Why no automated tests in this plan

The spec explicitly excludes test infra: "No automated tests for the export — the existing export has none and adding test infra for one feature is scope creep." This plan therefore uses manual verification at the end (Task 5) instead of TDD. This is a deliberate exception to the default TDD discipline, granted by the spec.

Each task still produces a working, committable change.

---

## Task 1: Wire in `useAllActiveWorkers` and build `workerGeoMap`

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx`

**Goal:** Load workers on mount in parallel with existing fetches, expose a `workerGeoMap: Map<worker_oid, { country: string | null; region: string | null }>` that downstream code can read. No UI changes yet, no export changes yet — just plumb the data in.

- [ ] **Step 1: Read the current file**

Run: open `app/(main)/data/surveys/SurveysListPage.tsx` and confirm the import block at lines 1-9 looks like:

```typescript
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSearch, RefreshCw, Search, Loader2, Download } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { downloadXlsx } from '@/lib/utils/export-xlsx';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import type { SurveyBatch, Survey, SurveyBatchListResponse, SurveyListResponse } from '@/lib/types/objects';
```

If line numbers have shifted, adjust the patches in the next steps to match the current line numbers but keep the patch *content* identical.

- [ ] **Step 2: Add the `useAllActiveWorkers` import**

Add a new import line right after the `QuickScrollRail` import (currently line 8). The new import block should look like:

```typescript
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { useAllActiveWorkers } from '@/components/campaign_surveys/useAllActiveWorkers';
import type { SurveyBatch, Survey, SurveyBatchListResponse, SurveyListResponse } from '@/lib/types/objects';
```

Verify the path resolves: the hook lives at `components/campaign_surveys/useAllActiveWorkers.ts:23` and is exported as a named export.

- [ ] **Step 3: Call the hook inside the component**

Inside the `SurveysListPage` function body, add the hook call right after the existing `useState` declarations (currently around line 33, just before the `useEffect` for `fetchBatches` at line 36):

```typescript
    // Workers — fetched on mount in parallel with batches/surveys; provides denormalized
    // country_name/region_name for the export. is_active=true is intentional: departed
    // workers fall through to empty geo cells in the export, which is acceptable.
    const { workers, error: workersError } = useAllActiveWorkers();
```

- [ ] **Step 4: Derive `workerGeoMap` via `useMemo`**

Add a `useMemo` immediately after the existing `filteredSurveys` useMemo (currently around line 112). Insert this block right after the `filteredSurveys` declaration closes:

```typescript
    // Map worker_oid → denormalized country/region from the Worker list endpoint.
    // Used by handleExportExcel to enrich exported rows. Either field can be null
    // when the backend has not resolved geo for that worker.
    const workerGeoMap = useMemo(() => {
        const map = new Map<string, { country: string | null; region: string | null }>();
        for (const w of workers) {
            map.set(w.oid, {
                country: w.country_name ?? null,
                region: w.region_name ?? null,
            });
        }
        return map;
    }, [workers]);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build` (or `npx tsc --noEmit` if a faster type-only check is preferred)
Expected: build succeeds with no new TS errors. If you see "Property 'country_name' does not exist on type 'Worker'" the import or type definition is wrong — re-check `lib/types/objects.ts:174-177`.

- [ ] **Step 6: Commit**

```bash
git add app/(main)/data/surveys/SurveysListPage.tsx
git commit -m "feat(surveys): load workers and build workerGeoMap for export enrichment"
```

---

## Task 2: Add Country/Region columns to `handleExportExcel`

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` — `handleExportExcel` callback (currently lines 120-170)

**Goal:** Insert `Country` and `Region` headers right after `Receiver Stable ID`, and emit the corresponding cells in each row, sourced from `workerGeoMap`.

- [ ] **Step 1: Locate `handleExportExcel`**

The callback is currently at lines 120-170 of `SurveysListPage.tsx`. Verify it starts with:

```typescript
    const handleExportExcel = useCallback(() => {
        if (filteredSurveys.length === 0) return;

        // Collect unique questions from the first survey (all surveys in a batch share the same questions)
        const questions = filteredSurveys[0]?.survey_questions?.questions ?? [];

        const headers = [
            'Receiver Stable ID', 'Status', 'Submitted At', 'Created At', 'Updated At',
            ...questions.map((q) => q.title),
        ];
```

- [ ] **Step 2: Update the headers array**

Replace the existing `headers` declaration (currently lines 126-129) with:

```typescript
        const headers = [
            'Receiver Stable ID', 'Country', 'Region', 'Status', 'Submitted At', 'Created At', 'Updated At',
            ...questions.map((q) => q.title),
        ];
```

- [ ] **Step 3: Update the row mapping to insert Country/Region cells**

Find the `return` inside the `filteredSurveys.map` (currently around lines 158-166) which looks like:

```typescript
            return [
                survey.receiver_stable_id,
                survey.status,
                survey.submitted_at ?? '',
                survey.created_at,
                survey.updated_at,
                ...answerCells,
            ];
```

Replace it with:

```typescript
            const geo = workerGeoMap.get(survey.receiver_oid);
            return [
                survey.receiver_stable_id,
                geo?.country ?? '',
                geo?.region ?? '',
                survey.status,
                survey.submitted_at ?? '',
                survey.created_at,
                survey.updated_at,
                ...answerCells,
            ];
```

`geo?.country ?? ''` produces an empty string both when the worker is missing from the map (inactive / fetch failed) and when the field is null (backend did not resolve geo for them). The xlsx generator at `lib/utils/export-xlsx.ts:10` accepts strings, numbers, and nulls — empty string is fine.

- [ ] **Step 4: Update the `useCallback` dependency array**

The current callback ends with `}, [filteredSurveys, selectedBatch]);` (around line 170). Add `workerGeoMap` to the dependency array:

```typescript
    }, [filteredSurveys, selectedBatch, workerGeoMap]);
```

This ensures the callback rebuilds when workers finish loading after the page first mounts.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build`
Expected: build succeeds. If you see a missing-property error on `survey.receiver_oid`, double-check `lib/types/objects.ts:1057` — the field exists on the `Survey` interface.

- [ ] **Step 6: Commit**

```bash
git add app/(main)/data/surveys/SurveysListPage.tsx
git commit -m "feat(surveys): add Country and Region columns to xlsx export"
```

---

## Task 3: Show a non-blocking banner on worker fetch failure

**Files:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` — JSX (currently around lines 200-240)

**Goal:** When the workers fetch fails, render a small banner above the surveys list informing the user that geo enrichment is unavailable. The export still works; cells are empty.

- [ ] **Step 1: Locate the JSX insertion point**

The JSX currently has a "Loading progress" block around lines 232-240:

```typescript
                {/* Loading progress */}
                {isLoadingSurveys && surveys.length > 0 && (
                    <div className={`mb-4 text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading surveys... {surveys.length.toLocaleString()}{totalSurveys !== null && ` / ${totalSurveys.toLocaleString()}`}
                        </span>
                    </div>
                )}
```

The banner goes immediately *before* this Loading progress block (so it sits between the batch selector and the surveys list, where it's visible but unobtrusive).

- [ ] **Step 2: Add the banner JSX**

Insert this block immediately above the `{/* Loading progress */}` comment:

```typescript
                {/* Worker geo data failure banner — export still works, but Country/Region cells will be empty */}
                {workersError && (
                    <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        Country/Region unavailable — worker geo data failed to load. Export will still run with empty geo columns.
                    </div>
                )}

```

(Keep the blank line after the closing brace so the existing `{/* Loading progress */}` block is visually separated.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: build succeeds. `workersError` is `string | null` per the `useAllActiveWorkers` hook contract at `components/campaign_surveys/useAllActiveWorkers.ts:18`, so the `&&` truthy check works directly.

- [ ] **Step 4: Commit**

```bash
git add app/(main)/data/surveys/SurveysListPage.tsx
git commit -m "feat(surveys): banner when worker geo data fails to load"
```

---

## Task 4: Sanity-check that nothing else broke

**Files:** none touched

**Goal:** Run the full project type check + lint and confirm the change is contained.

- [ ] **Step 1: Type check**

Run: `npm run build`
Expected: build succeeds with no errors related to `SurveysListPage.tsx`, `Worker`, or `useAllActiveWorkers`.

- [ ] **Step 2: Lint**

Run: `npm run lint` (if the project has a lint script — check `package.json` first; skip this step if no lint script exists)
Expected: no new lint errors in `app/(main)/data/surveys/SurveysListPage.tsx`. If there are pre-existing lint errors in unrelated files, ignore them.

- [ ] **Step 3: Inspect the diff**

Run: `git diff master -- app/(main)/data/surveys/SurveysListPage.tsx`
Expected: the diff is contained to the import block, the new hook call, the new useMemo, the headers array, the row return, the dependency array, and the banner JSX. No other changes.

If the diff touches anything else, revert those edits — this task should not include drive-by cleanups.

---

## Task 5: Manual verification

**Files:** none touched

**Goal:** Verify in a real browser against the Ohla Survey Feb 2026 batch that the export contains correct Country and Region values.

Per project memory, the local Docker container runs on port 3007. Either rebuild the container or run `npm run dev` — both work.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Or, per the project's CLAUDE.md sync workflow, build and run the Docker container:

```bash
docker build -t it-aware-frontend:latest .
docker rm -f it-aware-frontend 2>/dev/null
docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:latest
```

Expected: server boots cleanly, no errors in the startup logs.

- [ ] **Step 2: Verify the happy path**

1. Open the app in a browser, log in.
2. Navigate to `/data/surveys`.
3. Select the **Ohla Survey Feb 2026** batch (or the most recent equivalent if the name has changed). Wait for surveys to finish loading.
4. Click the Download icon (top-right of the surveys list).
5. Open the downloaded `surveys_<batch>_export.xlsx` file.

Expected:
- Column order: `Receiver Stable ID | Country | Region | Status | Submitted At | Created At | Updated At | <Q1> | <Q2> | ...`
- For workers known to be in China/APAC, the Country cell shows `China` (or whatever the live worker record says) and Region shows `APAC`.
- For at least one row that has a survey but the worker is no longer active or has no resolved location, the Country and Region cells are blank.
- The Country/Region values match what the SSC Cockpit dashboard shows for the same workers (cross-check by opening `/ssc-cockpit/dashboard` and finding the same workers in the worker map).

- [ ] **Step 3: Verify the search-filtered export**

1. Type a search query that filters the surveys list to a small subset.
2. Click Export.
3. Open the xlsx.

Expected: only the filtered rows appear, and Country/Region are still populated correctly for those rows.

- [ ] **Step 4: Verify the failure banner**

1. Open Chrome DevTools → Network tab.
2. Add a block-request rule for `/api/objects/workers*`.
3. Reload `/data/surveys`.
4. Wait for the page to settle.

Expected:
- A small amber banner appears above the surveys list reading "Country/Region unavailable — worker geo data failed to load. Export will still run with empty geo columns."
- The Export button is still clickable.
- Clicking Export produces an xlsx where the Country and Region cells are all empty, but the rest of the data is intact.

Remove the block rule before continuing.

- [ ] **Step 5: Commit a verification note (optional)**

If you discovered anything noteworthy during verification, add a one-line note to a CHANGELOG or commit message. Otherwise, skip — there is nothing to commit at this point.

---

## Done definition

- The five tasks above are complete and committed.
- `git log --oneline` shows three commits authored by this plan: workerGeoMap plumbing, export columns, failure banner.
- Manual verification (Task 5 steps 2-4) all passed.
- The diff to `master` is contained entirely to `app/(main)/data/surveys/SurveysListPage.tsx`.
