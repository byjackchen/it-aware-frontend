# lib/legacy: the legacy registry

Every old page address (the 108 pages under `app/(main)` before the task catalog) and where it goes in the task catalog: one entry per address, with its pattern (`[oid]`, `[label]` and `[section]` each stand for one segment), its new address, its entry type (`kept`, `area`, `view`, `record`, `special`, `pattern`) and, for the old-style menu, the contract views it shows (label in English and Chinese, task, grouping, permission rule). Two things are built from it and nothing else:

- **Redirects** (`redirect.ts`, called once from `proxy.ts`): an old address answers with a temporary redirect (307) to its new address, the placeholders and the query string carried over, with one log line per redirect, `[legacy-redirect] old=<pattern> new=<pattern>` (patterns only, no record IDs, no query). The kept addresses (`/`, `/home`, `/access-denied`) and `/api/**` are never redirected. 307 for the first release, so turning the switch back off is not undone by browser caches; it can become 308 (permanent) once the redirects have run a release without rollback. **On** since lane F4 moved the pages under `/tasks/...` (`LEGACY_REDIRECTS_ENABLED` in `switch.ts`); turning it off needs the pages back at their old addresses.
- **The old-style menu** (`menu.ts`, drawn by `components/legacy/LegacyMenuList.tsx`): the views a person may open, by grouping and task, shown only while the task UI is off. The layout shows it when the home it already reads for the task frame is null (the backend's tasks switch is off, or the call failed), so it costs no extra backend call. Its links go to the old addresses while the redirects are off and to the new ones once they are on.

The source is the contract's `legacy` list and tasks (`lib/tasks/contract-v3.json`). The unit tests check that every page under `app/(main)` is a kept address or lies under `/tasks/` at a view address or a record under one, that every new address has a page, that no code outside `lib/legacy/` names an old address (`no-old-addresses.test.ts`), that every contract entry is here unchanged, that every new address is a kept address, a view's address or a record under one, that every view's old address resolves to that view, and that the committed `registry.json` is exactly what the builder makes.

## The move

`move-pages.mjs` is the script that moved the pages and rewrote the links and imports, run once by lane F4 (`node lib/legacy/move-pages.mjs [--dry-run]`); kept as the record of how the move was made.

## Regenerate

After the contract changes, with Node 23.6 or later:

```sh
node lib/legacy/build-registry.mjs
```

It rewrites `registry.json` from `lib/tasks/contract-v3.json`; `build.test.ts` fails until the committed file matches.

## Retire

Delete `lib/legacy/` and `components/legacy/`, remove the hook from `proxy.ts` (the import and the `legacyRedirect(request)` lines) and the menu's branch (and its import) from `app/(main)/layout.tsx`.
