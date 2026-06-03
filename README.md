This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Encapsulation, Modulization, Coding Guidance

### Theme

Uses CSS variables with `dark`/`light` class toggling on `<html>` element.

| File | Purpose |
|------|---------|
| `lib/contexts/theme-context.tsx` | React context + cookie persistence (`it-aware-theme`) |
| `components/layout/ThemeSwitcher.tsx` | Toggle button component |
| `app/globals.css` | CSS variables (`.dark`, `.light`) and utility classes |

**Usage:**
- Use CSS variables: `var(--text-primary)`, `var(--glass-bg)`
- Use utility classes: `.theme-text-primary`, `.theme-input`, `.glass-card`
- Access in components: `const { theme, toggleTheme } = useTheme()`

### Internationalization

Uses `next-intl` with cookie-based locale detection (no URL prefix).

| File | Purpose |
|------|---------|
| `i18n/routing.ts` | Locale config (`en`, `zh`), `localePrefix: 'never'` |
| `i18n/request.ts` | Server-side locale from cookie (`IT_AWARE_LOCALE`) |
| `messages/en.json`, `messages/zh.json` | Translation strings |
| `components/layout/LanguageSwitcher.tsx` | Toggle button component |

**Usage:**
- In components: `const t = useTranslations('Security'); t('common.save')`
- Nest translations by module: `TopBar`, `Sidebar`, `Security.users`, etc.

### Component Data Flow Reference

For a comprehensive map of how data flows from backend APIs to Server Pages and Client Components, refer to:
> [Component Data Flow](file:///Users/byjackchen/codespace/it-aware-frontend/specs/components_data_flow.md)

### Server Components vs. Client Components

| Component Type | Use When | Marker |
|----------------|----------|--------|
| **Server Component** | Data fetching, no interactivity, access to backend | (default, no directive) |
| **Client Component** | Hooks, event handlers, browser APIs | `'use client'` at top |

**Patterns in this codebase:**
- **Pages** (`page.tsx`): Server Components - fetch data, pass to children
- **Forms/Interactive UI**: Client Components - handle state, events
- **Layouts**: Server Components - wrap with providers

**Example:** `app/(main)/security/users/`
```
page.tsx          → Server Component (fetches users, roles)
UserList.tsx      → Client Component (click handling, navigation)
UserDetail.tsx    → Client Component (form state, submission)
UserForm.tsx      → Client Component (form inputs, validation)
```

### Server Actions

| Action Type | Location | Example |
|-------------|----------|---------|
| **Global/Cross-cutting** | `app/actions/` | auth, notifications |
| **Feature-specific** | `app/(main)/[module]/actions.ts` | security CRUD |

- Place shared actions (auth, logging) in `app/actions/`
- Place domain-specific actions alongside their module in `app/(main)/[module]/actions.ts`

### Loading States (Suspense)

Next.js 16 App Router uses React Suspense for loading states.

| File | Purpose |
|------|---------|
| `app/(main)/loading.tsx` | Global loading boundary for the main layout. Shows `<PageLoading />`. |
| `components/layout/LoadingSpinner.tsx` | Reusable spinner components (`PageLoading`, `LoadingSpinner`). |

**Usage:**
- **Automatic:** The `loading.tsx` file automatically wraps page content in a Suspense boundary. It displays while server components are fetching data.
- **Manual:** For granular loading in client components, use `useState` with `isPending` or similar flags, and render `<LoadingSpinner />` conditionally.

### Error Handling

The application uses a multi-layered error handling strategy.

| Layer | Specific | Implementation |
|-------|----------|----------------|
| **Route Error Boundary** | `app/(main)/error.tsx` | Catches unhandled errors in Server Components. Displays a full-page error UI with "Try Again" and navigation options. Auto-classifies common HTTP errors (401, 403, 404, 500). |
| **Client Toast System** | `lib/contexts/error-context.tsx` | Provides `useError()` hook for Client Components. Displays ephemeral toast notifications (top-right) for non-critical errors (e.g., form submission failures). |
| **Helper** | `classifyError()` | Utility in `error-context.tsx` to categorize unknown errors into `auth`, `network`, `api`, or `unknown` types. |

**Usage:**
- **Server Components:** Allow errors to bubble up to `error.tsx`.
- **Client Components:** Catch errors in handlers (e.g., `try/catch` in `onSubmit`), then call `showError(message, type)`.

### Logging

Uses `console.log` with structured prefixes for traceability.

**Format:** `[Layer:Module:requestId] Message`

| Layer | Format | Example |
|-------|--------|---------|
| Middleware | `[Middleware:requestId]` | `[Middleware:gwj0mk] Request started` |
| API Route | `[APIRoute:/path:requestId]` | `[APIRoute:/auth/me:abc123] Fetching user` |
| Server Action | `[Action:Module:action:requestId]` | `[Action:Auth:login:xyz789] Login started` |

**Request ID:** 6-char random string generated per request for log correlation.

**Guidelines:**
- Always include `requestId` for traceability across async operations
- Log at request start, key decision points, and completion
- Include relevant context: `username`, `status`, `duration`
- Avoid logging sensitive data (passwords, full tokens)

## Ops Dashboard (Phase 1)

10 operations-focused pages at `/operation-teams/ops-dashboard/*` backed by client-side aggregation over the existing activity + hardware list endpoints. See [`docs/ops-dashboard.md`](docs/ops-dashboard.md) for the route map, key architectural notes (slim view / partial responses / actor eager-load), smoke-test checklist, and Phase 2 follow-ups.

## End-to-End Testing

Two complementary modes — pick whichever fits the task.

| Mode | When to use | Setup |
|------|-------------|-------|
| **In-repo Playwright spec** | Regression net. Run before merging, in CI, or whenever you want a deterministic "did I break the smoke?" answer in ~15 s. | One-time: `npm install` (already includes `@playwright/test`) then `npx playwright install chromium`. |
| **MCP-driven Playwright** | Exploratory walks, debugging a UI bug visually, capturing selectors for a brand-new spec, or having Claude Code drive the browser as you. | One-time, user-scoped: `claude mcp add playwright --scope user -- npx -y @playwright/mcp@latest` then restart Claude Code. |

### In-repo spec — `npx playwright test`

Pre-reqs: backend on `localhost:8007` with auth seeding done (P0–P5), frontend on `localhost:3007`, `byjackchen` admin account exists.

```bash
npm run test:e2e              # headless run, default reporter
npm run test:e2e:headed       # watch the browser drive itself
npm run test:e2e:ui           # interactive Playwright UI
E2E_BASE_URL=http://localhost:3007 npx playwright test       # override base URL
E2E_USERNAME=foo E2E_PASSWORD=secret npx playwright test     # different account
```

Layout (`e2e/`):
- `auth.setup.ts` — logs in once and saves storageState; every other test starts pre-authenticated.
- `qa-smoke.spec.ts` — Phase C activities-decouple smoke (sidebar / Systems / no Inquiries / QA Score).
- `qa-activities.spec.ts` — incidents + requests routes (list, detail, dashboards, persona, creation form) with explicit regression nets for known issues (B1 ABAC alias, B2/B3/B4 i18n drift).

Failure artifacts land under `test-results/<test>/` — screenshot, video, and Playwright trace. Open a trace with `npx playwright show-trace test-results/.../trace.zip`.

When adding a new spec, **always start the listener before navigating**:
```ts
const listPromise = page.waitForResponse(r => r.url().includes('/api/objects/things') && r.request().method() === 'GET');
await page.goto('/data/things');
const list = await listPromise;
```
Otherwise the client-side fetch can resolve before the listener attaches and you'll get a flaky timeout.

### MCP-driven Playwright — Claude drives the browser

Once installed, Claude Code gains 23 `mcp__playwright__browser_*` tools (`_navigate`, `_click`, `_fill_form`, `_snapshot`, `_evaluate`, `_console_messages`, `_network_requests`, `_take_screenshot`, …). You can ask Claude things like:

- "Log in as byjackchen and walk every incident route, capture any console errors."
- "Drive the requests/new form and submit a test request."
- "Toggle dark mode and screenshot the persona page."

The MCP server creates a per-session `.playwright-mcp/` folder for screenshots and console logs (already in `.gitignore`).

**Workflow tip:** use MCP to explore + capture working selectors, then have Claude port the verified flow into `e2e/*.spec.ts` so you have a permanent regression net. The activities-decouple Phase C verification was done exactly this way: 10 routes driven via MCP, 4 bugs surfaced and fixed, then crystallized into the 10 tests in `qa-activities.spec.ts`.

## Docker

Build and run the image:

```bash
docker build -t it-aware-frontend:latest .
docker stop it-aware-frontend && docker rm it-aware-frontend
docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:latest
```

The app will be available at http://localhost:3000. The Docker build copies `.env.docker` to `.env.local` so the environment variables defined there are used during the build. You can also override any variable at runtime with `-e KEY=VALUE`.

# Repo Scripts

## Generate headers
```bash
npx ts-node scripts/generate_headers.ts
```
