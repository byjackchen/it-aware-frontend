# Improvements Backlog

## Consistency
- Standardize server action error contracts (throw vs `{ error }`) across `app/actions/*`.
- Consolidate cookie filtering and non-ASCII handling into a shared utility to avoid drift between `proxy.ts` and `app/api/auth/me/route.ts`.
- Replace `any` in `lib/types/objects.ts` message fields with explicit types.

## Runtime Compatibility
- Replace client-side `Buffer` usage with a browser-safe Base64 helper in `lib/contexts/user-context.tsx`.
- Keep auth/proxy helpers free of Node-only APIs if Edge support is required later.

## Observability
- Gate any future debug logging behind an env flag (for example, `DEBUG_AUTH`) and use a single logger wrapper.

## Testing
- Add unit tests for permission matching (wildcards) in `lib/contexts/user-context.tsx`.
- Add integration tests for auth flows (`/api/auth/me`, login, refresh).

## Tooling
- Add Prettier or tighten ESLint rules to enforce consistent formatting.
