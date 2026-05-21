# Apple-to-apple comparison harness

End-to-end verification recipe for changes that touch both repos (frontend + backend) or that swap one tier in place — e.g. moving aggregation from the browser into a new backend endpoint without shifting any number a user sees on a dashboard.

The first run of this recipe (May 2026) validated the Ops Dashboard `/report/hub` endpoint against the legacy 4-fetch client aggregation; one numeric drift was caught (`region_filter` semantics) and one UX regression (`detail-count when collapsed`) was flagged. Both were found because the same browser session was driven through both stacks side-by-side.

## When to use

- Refactors that **replace** a data path (legacy fetch → backend report endpoint, ORM query → raw SQL, in-memory dedup → DB unique constraint).
- Migrations that should be invisible to the user — a "zero drift" requirement is the explicit success criterion.
- Backend changes whose effects only manifest through the UI (chart rendering, filter cascades, lazy-loaded panels).

It is **overkill** for: single-tier UI tweaks (use the regular dev server), backend-only changes covered by unit tests, or anything where pixel-perfect output is the goal (use Playwright snapshot tests instead).

## What you'll have at the end

Two complete container stacks running in parallel on the same Docker host, both pointing at the same Postgres / Redis so the data is identical:

```
baseline:  it-aware-fe-base :3088  →  it-aware-be-base :8088  →  postgres / redis
worktree:  it-aware-fe-wt   :3089  →  it-aware-be-wt   :8089  →  postgres / redis
                                      (additive — same DB, no migrations)
```

Plus a set of paired screenshots (`base-N-<scenario>.png` / `wt-N-<scenario>.png`) captured via Playwright MCP. One pair per scenario; review them side-by-side, flag anything that differs.

## Step 0 — branch hygiene

Both repos use the convention: branch off `origin/development`, not `origin/master`. See `CLAUDE.md` in each repo for the rationale.

```bash
# In each worktree
git checkout -B <branch> origin/development
```

## Step 1 — build four images

The backend Dockerfile lives at `app/Dockerfile`; the frontend at the root. Both build from their respective repo roots.

```bash
# Backend baseline
cd it-aware-backend
docker build -f app/Dockerfile -t it-aware-backend:base .

# Backend worktree
cd it-aware-backend/.claude/worktrees/<your-be-worktree>
docker build -f app/Dockerfile -t it-aware-backend:wt .

# Frontend baseline
cd it-aware-frontend
docker build -t it-aware-frontend:base .

# Frontend worktree
cd it-aware-frontend/.claude/worktrees/<your-fe-worktree>
docker build -t it-aware-frontend:wt .
```

Tip: run all four `docker build` in parallel as background jobs. Backend builds the Python venv (~3 min); frontend builds the Next.js bundle (~3–5 min). Layer caching across the baseline and worktree images cuts the second-of-each build to seconds.

## Step 2 — run on dedicated ports

Pick a port pair that isn't already in use. The convention below is `8088 / 3088` for baseline and `8089 / 3089` for worktree. The currently-running team containers (`it-aware-backend` on 8007, `it-aware-frontend` on 3007) are left undisturbed.

```bash
# Baseline backend
docker run -d --name it-aware-be-base --network dev-net \
  --env-file /path/to/it-aware-backend/.env.docker \
  -e IT_AWARE_API_BASE_URL=http://it-aware-be-base:8000 \
  -p 8088:8000 it-aware-backend:base

# Baseline frontend
docker run -d --name it-aware-fe-base --network dev-net \
  -e NODE_ENV=production \
  -e BACKEND_DOMAIN=http://it-aware-be-base:8000 \
  -e BACKEND_PUBLIC_DOMAIN=http://localhost:8088 \
  -e TAIHU_PAAS_TOKEN=mock-token-mock-token-mock-token \
  -p 3088:3000 it-aware-frontend:base

# Worktree backend (same env, different port + container name)
docker run -d --name it-aware-be-wt --network dev-net \
  --env-file /path/to/it-aware-backend/.env.docker \
  -e IT_AWARE_API_BASE_URL=http://it-aware-be-wt:8000 \
  -p 8089:8000 it-aware-backend:wt

# Worktree frontend
docker run -d --name it-aware-fe-wt --network dev-net \
  -e NODE_ENV=production \
  -e BACKEND_DOMAIN=http://it-aware-be-wt:8000 \
  -e BACKEND_PUBLIC_DOMAIN=http://localhost:8089 \
  -e TAIHU_PAAS_TOKEN=mock-token-mock-token-mock-token \
  -p 3089:3000 it-aware-frontend:wt
```

Why override `IT_AWARE_API_BASE_URL` per backend: `.env.docker` hard-codes it to the team-stack name `it-aware-backend:8000`. Without the override the new backends self-reference the wrong container and any internal callback that loops through the public URL will hit the wrong stack.

Why override `BACKEND_DOMAIN` per frontend: directs each frontend's Next.js server-side proxy to its paired backend over `dev-net` (resolved by Docker DNS).

Block until both stacks respond (a 200 / 307 / 404 is "alive enough" — the backend redirects unauthenticated requests):

```bash
until curl -sf -o /dev/null http://localhost:8088/docs && \
      curl -sf -o /dev/null http://localhost:8089/docs && \
      curl -sf -o /dev/null http://localhost:3088/ && \
      curl -sf -o /dev/null http://localhost:3089/; do sleep 3; done
echo "ALL READY"
```

## Step 3 — drive the browser via Playwright MCP

Playwright MCP gives you one browser context per session. That's enough — navigate to the baseline, screenshot, navigate to the worktree, screenshot, repeat per scenario.

```
1. browser_resize 1600x1000  (or taller if the page has inner overflow-auto)
2. browser_navigate http://localhost:3088/<page>
3. fill the login form once on 3088 (cookies are shared across localhost ports)
4. for each scenario:
     base:  browser_navigate :3088 → apply filter / click element → wait → screenshot base-N.png
     wt:    browser_navigate :3089 → apply same filter → wait → screenshot wt-N.png
```

### Cookie sharing across ports

Browsers do not isolate cookies by port for the same hostname (`localhost`). One login on 3088 authenticates 3089 too. Convenient for this recipe — but it also means **localStorage is NOT shared** (origin = scheme + host + port). Any filter state persisted via `useOpsGlobalFilter` (region/country/location) has to be applied on each port independently.

### Inner overflow gotcha

Pages that use `<div className="h-[calc(100vh-4rem)] overflow-hidden ...">` plus an inner `overflow-auto` will not capture content below the viewport with `browser_take_screenshot fullPage:true` — the inner div has its own scroll, not the body. Two workarounds:

- Resize the viewport tall (e.g. 1600×2400) so all panels fit inline.
- Use `target=<element-ref>` to screenshot a specific section.

## Step 4 — pick the scenarios

A useful scenario set covers: (a) the default state, (b) one filter narrowed to a small subset, (c) a chart cross-filter (interactivity), (d) a lazy / expandable section. For the Ops Dashboard Hub the canonical four are:

| # | Scenario | What to compare |
|---|---|---|
| 1 | Initial load (no filters) | Every KPI value, donut top-N + ordering, region bubble counts |
| 2 | Narrow region filter (e.g. AMER) | Filtered KPIs · donut now shows only in-region groups · region bubble shows single region |
| 3 | Cross-filter via chart click (e.g. top donut slice) | Single-slice donut · KPI subset matching that group · region distribution narrows |
| 4 | Detail / lazy panel expanded | Full row count · first page of detail rows · column shape |

## Step 5 — read the screenshots side-by-side

Open each pair in the same image viewer (or via the Read tool in the agent) and walk the KPI grid, chart legends, and any visible table rows. Drift will show up as: different KPI numbers, different chart slices, different ordering, missing/extra entries in dropdowns.

When you find drift:

1. **Numeric drift** — the new path is computing a different number for the same question. Either a predicate was implemented wrong, or the two paths interpret a corner case differently. Reproduce against the API directly (`curl -b 'it_aware_access=...' http://localhost:8089/...`) and trace into the SQL / aggregator.
2. **Behavior change that's not in numbers** — e.g. the new filter dropdown lists fewer values because the data source changed (`allTickets` → `report.filter_options`). Decide whether the change is desirable; if not, restore the legacy semantics.
3. **UX regression unrelated to the data** — e.g. the new path lazy-loads a count that used to be computed eagerly, so a "0 records" placeholder appears. Usually a one-line fix to read from the available cached number.

## Step 6 — teardown

```bash
docker stop it-aware-be-base it-aware-be-wt it-aware-fe-base it-aware-fe-wt
docker rm   it-aware-be-base it-aware-be-wt it-aware-fe-base it-aware-fe-wt
# Images persist — keep them if you'll iterate, delete with `docker image rm` otherwise.
```

The screenshots are the durable artifact. Keep them in a `tmp/comparison-<date>/` directory next to the PR description, or attach them to the merge request, so reviewers can see the same evidence.

## What this recipe explicitly does NOT do

- **It is not a regression test.** No assertions, no CI hook. It's a human-in-the-loop verification gate. The corresponding automated gate for the Ops Dashboard is `tests/test_ops_dashboard_hub_report.py` on the backend.
- **It does not catch every drift.** Only what the chosen scenarios surface. Pick scenarios that exercise every distinct code path (every KPI predicate, every chart aggregation, every filter dimension). Edge cases that don't appear in the live data won't be caught.
- **It does not isolate from cache state.** Backend Redis cache shapes second-fetch behavior. If you suspect cache poisoning, restart the backend between scenarios or use a unique URL param to bust the cache.

## See also

- `specs/backend/ops_dashboard_predicates.md` — the rules the Hub aggregate must follow, mirrored on both repos
- `it-aware-backend/tests/test_ops_dashboard_hub_report.py` — the automated parity gate that runs on every CI build
- `AGENTS.md` (both repos) — broader delivery workflow
