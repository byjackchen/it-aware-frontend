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
