# CI gate (it-aware-frontend)

The OHLA CI gate standard v0.3 (ohla-xray `quality/code-review/ci-gate.md`), built like it-aware-backend's `ci/`. Every change to this repo, by a person or an agent, follows the rules below. (They live here because this repo keeps `CLAUDE.md` untracked.)

## Before you push

- **Before you push, run both, with no arguments:** `ci/gate.sh` (the static gate), then `ci/e2e.sh` (the hermetic e2e). A green round tags the commit `converged/<UTC>`. Push the commit and its tag together: `git push woa development converged/<ts>`, and the same to `origin` so the remotes stay equal.
- **The dev pipeline checks the tag.** 蓝盾 `it-aware-dev-frontend` runs `ci/check-tags.sh` first and refuses a commit without its own green `converged/*` tag. A red gate is never pushed, and an untagged push does not deploy.
- **An agent session reports the last line of each run** (`GATE PASS` / `GATE FAIL: …`, `E2E PASS` / `E2E FAIL: …`) before it proposes a merge or a push.
- Docker must be running, and `gitleaks` installed (`brew install gitleaks`). Nothing else: Node, the browsers and the backend all run in containers.

## Rules (sia's, adopted with the standard)

- Never weaken a test, an assertion, a spec or the UI data set to pass the gate. A spec that broke because the product deliberately changed is updated to the new behaviour, citing the commit that changed it; one whose feature was removed is deleted, with that commit in the message. If neither applies, report the evidence and stop.
- No coverage ignore comments (`v8 ignore`, `c8 ignore`, `istanbul ignore`). Delete unreachable code instead.
- No skips: no `test.skip`, `.only`, `todo` or retries to get through. Playwright runs with `--retries=0`; a flaky spec is fixed, not retried.
- An exclusion goes in `ci/coverage/exclusions.json` with its written reason, and only for an entry point that only composes, generated code, or test scaffolding.
- **The floor only goes down.** Delete a file's entry from `ci/coverage/baseline.json` when it reaches 100%. Never add to it, and never raise a count.
- Never edit `ci/gate.sh`, `ci/e2e.sh`, `ci/check-tags.sh`, `ci/no_skips.py`, the coverage verifier, `ci/e2e/world.py` or the lint config to make a change pass, unless that is the stated task.
- A behaviour change lands with its tests in the same commit. A new or changed file in the logic tier (below) is held at 100% on statements, lines, functions and branches, and changed lines must execute.
- **Test data is synthetic.** Never put production rows, real names, usernames or chat content in specs, mocks or `ci/e2e/world.py`. Use `example.com` for emails.

## What is measured where

- **Unit (vitest, `gate.sh`):** the logic tier, as sia's workbench does: `lib/`, `i18n/`, `app/**/route.ts`, `app/actions/`, `proxy.ts` (`vitest.config.mts`, `coverage.include`). 122 files when recorded (2026-11-11), 10 of them at 100%, 112 baselined.
- **E2E (Playwright, `e2e.sh`):** pages, layouts and components, through a real browser, against the real backend.

## The e2e stack

`ci/e2e.sh` runs the backend commit named in `ci/backend.ref`, which must carry its own green `converged/*` tag. It fetches that commit from git.woa.com and starts it with the backend's own hermetic stack (`ci/e2e/stack.sh up` in it-aware-backend: Postgres, Redis, the test doubles, the synthetic seed, the backend and MCP server on 127.0.0.1). Then:

1. `ci/e2e/world.py` creates the UI's synthetic data set through the backend's API, as the synthetic admin `gate.admin`;
2. `next build` and `next start` run in `node:20-alpine`, the image production runs on;
3. Playwright runs every spec in `e2e/` in its pinned image (`mcr.microsoft.com/playwright`, the version in `package-lock.json`), inside the Next.js container's network namespace, so the app is `localhost`, as the specs' cookies expect;
4. no backend double may have seen an unexpected request, and the backend's network guard must have logged nothing.

To move to a newer backend, write its converged commit into `ci/backend.ref` in a commit of its own.

## Files

| File | What it is |
|---|---|
| `gate.sh` | The static gate. No arguments. Writes `.gate/static-report.json`; last line `GATE PASS` or `GATE FAIL: <stages>`. |
| `e2e.sh` | The hermetic e2e. Requires a green static report for the same commit; a green run on a clean tree tags `converged/<UTC>`. |
| `backend.ref` | The converged it-aware-backend commit the e2e runs against. |
| `e2e/world.py` | The UI's synthetic data set, created through the backend's API. |
| `check-tags.sh` | The dev pipeline's first step: the deployed commit must carry a green `converged/*` tag. |
| `lib.sh` | Shared helpers; `GATE_NODE_IMAGE` (= the Dockerfile's `FROM`). |
| `coverage/` | 100% per file over the logic tier, with a ratchet (`baseline.json`) and reasoned `exclusions.json`. |
| `no_skips.py` | Fails the unit stage on any skipped, todo or missing test. |
| `report.py` | The `ohla-gate-report/1` report that becomes the tag's message. |
| `test_gate_tools.py` | The gate's own tests (`python3 -m unittest discover -s ci -t .`). |

## Stages of `gate.sh`

sync · lint (changed files) · lint-repo (warn) · types · unit · no-skips · coverage · build · gate-tests · secrets · deps (opt-in, `GATE_AUDIT=1`)

Everything after `sync` runs in a `git archive` of HEAD inside one `node:20-alpine` container that is cut off from the network after `npm ci`. There is no format stage: the repo has no formatter configured. `GATE_BASE` sets the base for the changed-file stages; it defaults to `git merge-base woa/development HEAD`, or `origin/development`.

## Iterating

The gate cannot be narrowed. To iterate, run the underlying command: `npx vitest run lib/x.test.ts`, `npx eslint <file>`, `npx tsc --noEmit`. For one spec, start the backend stack by hand from an export of the commit in `ci/backend.ref` (`ci/e2e/stack.sh up <dir>`, then `python3 ci/e2e/world.py "$IT_AWARE_API_BASE_URL" gate.admin gate-fake-password` with `<dir>/stack.env` sourced), point a local `next dev` at it (`BACKEND_DOMAIN`), and run `E2E_USERNAME=gate.admin E2E_PASSWORD=gate-fake-password E2E_API_URL=… npx playwright test e2e/<spec>`.

## Limits

- The e2e runs `next start`, not the Dockerfile's standalone `server.js`; the image build itself is the dev pipeline's.
- Playwright drives Chromium only (the config's one project).
