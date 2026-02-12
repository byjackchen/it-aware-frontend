# Repository Guidelines

This file is the primary guidance for AI coding agents working in this frontend repository.

## 1) Scope and Goals
- Repository type: Next.js frontend application.
- Priorities: correctness, API-contract alignment, modularity, and safe iteration.
- Default approach: spec-first for API-driven work, then implement, verify, summarize.

## 2) Project Structure
- `app/`: App Router pages, layouts, route handlers, and page-level client/server components.
- `components/`: reusable UI components.
- `lib/`: API clients, hooks, contexts, configs, shared types.
- `messages/`, `i18n/`: localization resources and i18n config.
- `specs/backend/`: backend API contracts used by frontend integration.
- `specs/REPO.md`: authoritative Docker build/run commands.
- `tests/temp/`: temporary diagnostics scripts.

## 3) Development Principles
- Contract-first: follow latest backend specs under `specs/backend/`.
- No hidden compatibility layers unless explicitly requested.
- Prefer explicit, typed data flow over implicit fallbacks.
- Keep changes small and reviewable; avoid unrelated refactors.

## 4) Standard Delivery Workflow
Use this order unless user explicitly overrides:
1. Inspect current unstaged/staged diffs (`git status`, `git diff`) and read relevant spec updates.
2. Update core types and API client contract handling.
3. Update route proxy/resource mapping if needed.
4. Update server actions.
5. Update pages/components.
6. Validate with required checks.
7. If requested, rebuild and run Docker container.

## 5) API Contract Update Checklist (Data Objects)
When adding/updating a Data object (especially Activities), check all relevant surfaces:
- `lib/types/objects.ts` (response/create/update/list types)
- `lib/api/objects.ts` (client functions)
- `app/api/objects/[resource]/route.ts` (resource mapping)
- `app/actions/objects.ts` (create/update/delete actions + revalidate paths)
- `app/(main)/data/<resource>/page.tsx`
- `app/(main)/data/<resource>/<ListPage>.tsx`
- `app/(main)/data/<resource>/[oid]/page.tsx`
- `app/(main)/data/<resource>/[oid]/<DetailPage>.tsx`
- `app/(main)/data/<resource>/new/*` (if create UI is needed)
- `lib/config/permissions.ts`
- `lib/config/sidebar.ts`
- `components/data/ObjectGraph.tsx` (route + type color if applicable)
- `lib/config/search.ts` (global search route/icon)
- `messages/en.json`, `messages/zh.json` (new labels)

## 6) Lazy Loading and List Behavior Standards
- Use `useInfiniteResource` for large list pages in Data section.
- Default/target page size for Data lists: `1000`.
- Prefer envelope responses with `items` + `total`.
- Header/count display format for Data lists:
  - `xxx Active Loaded / xxx Loaded / xxx Total`
- Keep list-level refresh behavior consistent via `reload()`.

## 7) UI and Code Conventions
- TypeScript + React with single quotes and semicolons.
- Preserve local file formatting style/indentation.
- Use `@/` path alias imports.
- Avoid `any`; use explicit types (`unknown` + narrowing when needed).
- Keep page components readable and module responsibilities clear.

## 8) Testing and Validation Strategy
Minimum required before declaring completion:
- `npm run typecheck`
- Targeted lint on changed files (for example: `npx eslint <changed-files>`)

Recommended when behavior surface changed:
- `npm run build` for route-level and integration regression check.

Notes:
- Full-repo lint may include pre-existing issues unrelated to current task.
- In that case, run targeted lint on changed files and report clearly.
- Always report what was run and what was skipped.

## 9) Docker Validation and Runtime
When asked to repackage/restart frontend Docker, use commands from `specs/REPO.md` exactly:

```bash
docker build --no-cache -t it-aware-frontend:latest .
docker stop it-aware-frontend && docker rm it-aware-frontend
docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:latest
```

After start, verify with:
- `docker ps --filter name=it-aware-frontend`
- `docker logs --tail 20 it-aware-frontend`

Runtime access:
- `http://localhost:3007`

## 10) Troubleshooting Rules
When frontend and backend contract appear mismatched:
1. Compare frontend expectations against latest `specs/backend/*.md` diff.
2. Capture exact endpoint and response shape mismatch.
3. Classify issue as frontend mapping bug vs backend contract/runtime bug.
4. If backend issue, provide precise handoff notes (endpoint, fields, expected vs actual).

## 11) Commit and PR Guidance
- Preferred commit prefixes: `feat:`, `fix:`, `refactor:`.
- Keep commits focused by feature/change unit.
- PR summary should include:
  - behavior changes
  - files touched
  - validation evidence (`typecheck`, targeted lint, build, docker if run)
  - screenshots for UI changes where relevant
