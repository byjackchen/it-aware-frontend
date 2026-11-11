#!/usr/bin/env bash
# The static CI gate for it-aware-frontend (OHLA CI gate v0.3).
# Standard: ohla-xray quality/code-review/ci-gate.md. Sibling: it-aware-backend ci/gate.sh.
#
# IT TAKES NO ARGUMENTS, ON PURPOSE. A gate that can be narrowed is not a gate.
# To iterate, run the underlying command directly (npx eslint, npx vitest).
# Every stage runs even after one fails, so one run lists every red stage.
#
#   sync      npm ci in node:20-alpine (the image production builds on)    blocks
#   G2 lint   eslint on changed .ts/.tsx/.js/.mjs files                    blocks
#             eslint on the whole repo                                     warns
#      types  tsc --noEmit                                                 blocks
#   G4 unit   vitest under v8 coverage, no network, no skips               blocks
#      coverage ci/coverage/verify_coverage.py: 100% per file of the       blocks
#             logic tier (lib, i18n, route handlers, server actions,
#             proxy.ts), baseline ratchet, changed lines executed
#   G3 build  next build, as the Dockerfile does (.env from .env.example)  blocks
#      gate-tests the gate's own tests                                     blocks
#   G5 secrets gitleaks over GATE_BASE..HEAD                               blocks
#   G6 deps   npm audit, only when GATE_AUDIT=1                            warns
#
# There is no format stage: the repo has no formatter configured (G1 applies
# only where prettier is).
#
# GATE_BASE names the base for the diff-aware stages; it defaults to
# `git merge-base woa/development HEAD`, or origin/development.
#
# HERMETIC AND CREDENTIAL-FREE. The environment is cleared to PATH, HOME, TMPDIR,
# GATE_BASE, GATE_AUDIT and DOCKER_HOST. Everything after the export runs in a
# `git archive` of HEAD inside one node:20-alpine container, which never sees a
# .env file but the committed .env.example. The container is cut off from the
# network after `npm ci`, so the tests and the build cannot reach anything.
# Network use: the npm registry for `npm ci`, and Docker image pulls.
#
# It writes .gate/static-report.json (ohla-gate-report/1, kind static) and creates
# no tag: ci/e2e.sh requires this report green for the same commit, runs the e2e
# and creates the one converged/<UTC> tag the dev pipeline checks. It never pushes.
# The last line is `GATE PASS` or `GATE FAIL: <stages>`.
set -uo pipefail

if [ "$#" -ne 0 ]; then
  echo "ci/gate.sh takes no arguments" >&2
  exit 2
fi

for _v in $(compgen -e); do
  case "$_v" in
    PATH | HOME | TMPDIR | GATE_BASE | GATE_AUDIT | DOCKER_HOST) ;;
    *) unset "$_v" 2>/dev/null ;;
  esac
done
unset _v

cd "$(dirname "$0")/.." || exit 2
REPO=$(pwd -P)
# shellcheck source=lib.sh
. "$REPO/ci/lib.sh"

STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
T0=$(now)
FAILED=""

HEAD_SHA=$(git rev-parse HEAD) || exit 2
BRANCH=$(git symbolic-ref -q --short HEAD || echo HEAD)
DIRTY=$(git status --porcelain --untracked-files=normal)
if [ -n "${GATE_BASE:-}" ]; then
  BASE_REF=$GATE_BASE
else
  BASE_REF=$(git merge-base woa/development HEAD 2>/dev/null || git merge-base origin/development HEAD) ||
    { echo "gate: no merge base with woa/development or origin/development" >&2; exit 2; }
fi
BASE=$(git rev-parse --verify --quiet "$BASE_REF^{commit}") || { echo "gate: GATE_BASE $BASE_REF is not a commit" >&2; exit 2; }

WORK=$(mktemp -d "${TMPDIR:-/tmp}/it-aware-fe-gate.XXXXXX") || exit 2
TREE=$WORK/tree
CTR=itaware-fe-gate-$$
trap 'docker rm -f "$CTR" >/dev/null 2>&1; rm -rf "$WORK"' EXIT
mkdir -p "$TREE" "$REPO/.gate"
git archive HEAD | tar -x -C "$TREE" || exit 2
: >"$WORK/stages.tsv"
: >"$WORK/tools.tsv"

# stage <name> <block|warn> <command...>
stage() {
  local name=$1 mode=$2 t rc status
  shift 2
  echo "== $name"
  t=$(now)
  "$@"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    status=pass
  elif [ "$mode" = block ]; then
    status=fail
    FAILED="$FAILED $name"
  else
    status=warn
  fi
  printf '%s\t%s\t%s\n' "$name" "$status" "$(since "$t")" >>"$WORK/stages.tsv"
}
none() {
  echo "== $1 (no changed files)"
  printf '%s\t%s\t%s\n' "$1" none 0 >>"$WORK/stages.tsv"
}
skipped() {
  echo "== $1 (skipped: $2)"
  printf '%s\t%s\t%s\n' "$1" skipped 0 >>"$WORK/stages.tsv"
}

echo "gate: commit ${HEAD_SHA:0:12} on $BRANCH, base ${BASE:0:12}"
[ -n "$DIRTY" ] && echo "gate: the working tree is dirty; this run cannot be green or tagged"

if ! node_up "$CTR" "$TREE"; then
  echo "gate: could not start the $GATE_NODE_IMAGE container (is Docker running?)" >&2
  echo "GATE FAIL: docker"
  exit 1
fi
stage sync block nx sh -c 'cp .env.example .env && npm ci --no-audit --no-fund --loglevel=error'
# From here on the container has no network.
docker network disconnect bridge "$CTR" >/dev/null 2>&1

CHANGED=$(git diff --name-only --no-renames --diff-filter=ACMR "$BASE" HEAD -- '*.ts' '*.tsx' '*.js' '*.mjs' '*.mts' | grep -v '^ci/' || true)
if [ -n "$CHANGED" ]; then
  # shellcheck disable=SC2086 # one path per word; repo paths carry no spaces
  stage lint block nx npx eslint --max-warnings=0 $CHANGED
else
  none lint
fi
stage lint-repo warn nx npx eslint .
stage types block nx npx tsc --noEmit

stage unit block nx npx vitest run --coverage --coverage.reportsDirectory=/app/.gate-cov \
  --reporter=default --reporter=json --outputFile.json=/app/.gate-unit.json
stage no-skips block python3 "$TREE/ci/no_skips.py" "$TREE/.gate-unit.json"
stage coverage block python3 "$TREE/ci/coverage/verify_coverage.py" --profile "$TREE/.gate-cov/coverage-final.json" \
  --root "$TREE" --profile-root /app --base "$BASE" --repo "$REPO" --summary "$WORK/coverage-summary.json"

stage build block nx sh -c 'NEXT_TELEMETRY_DISABLED=1 npx next build >/tmp/build.log 2>&1 || { tail -40 /tmp/build.log; exit 1; }'

stage gate-tests block sh -c "cd '$TREE' && python3 -m unittest discover -q -s ci -p 'test_*.py' -t ."

if command -v gitleaks >/dev/null 2>&1; then
  stage secrets block gitleaks git --no-banner --redact --log-opts="$BASE..HEAD" "$REPO"
else
  stage secrets block sh -c 'echo "gitleaks is not installed (brew install gitleaks)" >&2; exit 1'
fi

if [ "${GATE_AUDIT:-}" = 1 ]; then
  docker network connect bridge "$CTR" >/dev/null 2>&1
  stage deps warn nx npm audit --omit=dev
else
  skipped deps "set GATE_AUDIT=1 to run npm audit; it queries an online advisory database"
fi

{
  printf 'node\t%s\n' "$(nx node --version 2>/dev/null)"
  printf 'npm\t%s\n' "$(nx npm --version 2>/dev/null)"
  for t in next typescript eslint vitest; do
    printf '%s\t%s\n' "$t" "$(nx node -p "require('$t/package.json').version" 2>/dev/null)"
  done
  printf 'image\t%s\n' "$GATE_NODE_IMAGE"
  printf 'docker\t%s\n' "$(docker version --format '{{.Server.Version}}' 2>/dev/null)"
  printf 'gitleaks\t%s\n' "$(gitleaks version 2>/dev/null)"
  printf 'git\t%s\n' "$(git --version | awk '{print $3}')"
} >"$WORK/tools.tsv"

[ -z "$DIRTY" ] && DIRTY=$(git status --porcelain --untracked-files=normal)
[ "$(git rev-parse HEAD)" = "$HEAD_SHA" ] || DIRTY="HEAD moved during the run"
TREE_CLEAN=1
[ -n "$DIRTY" ] && TREE_CLEAN=0 && FAILED="$FAILED tree-dirty"

python3 "$TREE/ci/report.py" \
  --repo it-aware-frontend --commit "$HEAD_SHA" --branch "$BRANCH" --base "$BASE" \
  --user "$(id -un)" --started "$STARTED" --finished "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --duration "$(since "$T0")" --tag none --tree-clean "$TREE_CLEAN" \
  --stages "$WORK/stages.tsv" --tools "$WORK/tools.tsv" \
  --coverage "$WORK/coverage-summary.json" --out "$REPO/.gate/static-report.json"
REPORT_RC=$?

echo
column -t -s "$(printf '\t')" "$WORK/stages.tsv" | sed 's/^/  /'
if [ -z "$FAILED" ] && [ "$REPORT_RC" -eq 0 ]; then
  echo "gate: static report for ${HEAD_SHA:0:12} written to .gate/static-report.json; run ci/e2e.sh next to get the converged tag"
  echo "GATE PASS"
  exit 0
fi
[ -z "$FAILED" ] && FAILED=" report"
echo "GATE FAIL:$FAILED"
exit 1
