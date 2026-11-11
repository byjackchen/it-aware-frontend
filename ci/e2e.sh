#!/usr/bin/env bash
# The hermetic e2e for it-aware-frontend (OHLA CI gate v0.3 §3b).
#
# IT TAKES NO ARGUMENTS, ON PURPOSE, like ci/gate.sh. One run is the verdict: every
# Playwright spec passes on its first try, nothing unexpected reached a backend
# double, the backend's network guard logged nothing. Every stage runs even after
# one fails.
#
#   static    .gate/static-report.json is a green static report for this commit
#   export    `git archive` HEAD into a temp dir (no .env files but .env.example)
#   backend   the backend commit pinned in ci/backend.ref, which must carry its own
#             green converged/* tag, fetched from git.woa.com and started with its
#             own hermetic stack (it-aware-backend ci/e2e/stack.sh): Postgres, Redis,
#             the doubles, the synthetic seed, the backend and the MCP server, on
#             127.0.0.1; then the UI's own synthetic data set (ci/e2e/world.py),
#             created through the backend's API
#   frontend  next build and next start in node:20-alpine (production's image),
#             pointed at that backend
#   journeys  every Playwright spec in e2e/, in the pinned Playwright image, in the
#             frontend container's network namespace (so the app is `localhost`,
#             as the specs' cookies expect), logged in as the synthetic admin
#             gate.admin; no retries, no skips
#   doubles   no backend double saw an unexpected request; the guard logged nothing
#
# Credential-free: the environment is cleared, the backend loads only its own
# hermetic.env, and every row it serves is synthetic. Network use: Docker image
# pulls, the npm registry, and git.woa.com for the backend commit.
#
# To move to a newer backend, write its converged commit into ci/backend.ref in
# a commit of its own. To iterate on one spec, start the same stack by hand (see
# ci/README.md) and run `npx playwright test <spec>` against it.
#
# A green run on a clean tree tags HEAD converged/<UTC timestamp>, the ONE tag the
# dev pipeline checks (ci/check-tags.sh). It is annotated, and its message is the
# converged report (ohla-gate-report/1) with the static report embedded. A red or
# dirty run writes the report, creates no tag and exits non-zero. It never pushes.
# The last line is `E2E PASS` or `E2E FAIL: <reason>`.
set -uo pipefail

if [ "$#" -ne 0 ]; then
  echo "ci/e2e.sh takes no arguments" >&2
  exit 2
fi

for _v in $(compgen -e); do
  case "$_v" in
    PATH | HOME | TMPDIR | UV_CACHE_DIR | XDG_CACHE_HOME | DOCKER_HOST) ;;
    *) unset "$_v" 2>/dev/null ;;
  esac
done
unset _v

cd "$(dirname "$0")/.." || exit 2
REPO=$(pwd -P)
# shellcheck source=lib.sh
. "$REPO/ci/lib.sh"

BACKEND_GIT=https://git.woa.com/Ohla/it-aware-backend.git
PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.59.1-noble # = @playwright/test in package-lock.json

STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
T0=$(now)
FAILED=""
HEAD_SHA=$(git rev-parse HEAD) || exit 2
BRANCH=$(git symbolic-ref -q --short HEAD || echo HEAD)
DIRTY=$(git status --porcelain --untracked-files=normal)
RUN_ID="e2e-$(date -u +%Y%m%dT%H%M%SZ)-${HEAD_SHA:0:8}"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/it-aware-fe-e2e.XXXXXX") || exit 2
TREE=$WORK/tree
OUT=$REPO/.gate/e2e
rm -rf "$OUT" && mkdir -p "$OUT" "$TREE"
: >"$WORK/stages.tsv"
FE=itaware-fe-e2e-next-$$
PW=itaware-fe-e2e-pw-$$
BACKEND_SHA=""
STACK=$WORK/stack

teardown() {
  docker rm -f "$PW" "$FE" >/dev/null 2>&1
  [ -x "$WORK/backend/ci/e2e/stack.sh" ] && "$WORK/backend/ci/e2e/stack.sh" down "$STACK" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap teardown EXIT

stage() {
  local name=$1 t rc status
  shift
  echo "== $name"
  t=$(now)
  "$@"
  rc=$?
  status=pass
  [ "$rc" -eq 0 ] || { status=fail; FAILED="$FAILED $name"; }
  printf '%s\t%s\t%s\n' "$name" "$status" "$(since "$t")" >>"$WORK/stages.tsv"
  return $rc
}

check_static() {
  python3 "$REPO/ci/report.py" --check-static "$REPO/.gate/static-report.json" --commit "$HEAD_SHA"
}

export_tree() {
  git archive HEAD | tar -x -C "$TREE"
}

# The pinned backend commit, from a bare cache of the backend repo under .gate/.
backend() {
  BACKEND_SHA=$(tr -d '[:space:]' <"$TREE/ci/backend.ref")
  local cache=$REPO/.gate/backend.git tag
  [ -d "$cache" ] || git init -q --bare "$cache" || return 1
  git -C "$cache" fetch -q --force "$BACKEND_GIT" "$BACKEND_SHA" 'refs/tags/converged/*:refs/tags/converged/*' ||
    { echo "e2e: could not fetch backend $BACKEND_SHA from $BACKEND_GIT" >&2; return 1; }
  tag=$(git -C "$cache" tag --points-at "$BACKEND_SHA" -l 'converged/*' | sort -r | head -1)
  if [ -z "$tag" ] || ! git -C "$cache" tag -l --format='%(contents)' "$tag" |
    python3 -c 'import json,sys; r=json.load(sys.stdin); sys.exit(0 if r.get("verdict")=="green" and r.get("commit")==sys.argv[1] else 1)' "$BACKEND_SHA"; then
    echo "e2e: backend ${BACKEND_SHA:0:12} (ci/backend.ref) carries no green converged/* tag" >&2
    return 1
  fi
  echo "e2e: backend ${BACKEND_SHA:0:12} ($tag)"
  BACKEND_TAG=$tag
  mkdir -p "$WORK/backend" && git -C "$cache" archive "$BACKEND_SHA" | tar -x -C "$WORK/backend" || return 1
  "$WORK/backend/ci/e2e/stack.sh" up "$STACK" >"$OUT/stack.log" 2>&1 || { tail -30 "$OUT/stack.log"; return 1; }
  # shellcheck disable=SC1091
  . "$STACK/stack.env"
  python3 "$TREE/ci/e2e/world.py" "$IT_AWARE_API_BASE_URL" "$STACK_ADMIN" "$STACK_PASSWORD"
}

frontend() {
  local i
  API=${IT_AWARE_API_BASE_URL/127.0.0.1/host.docker.internal} # the backend, seen from a container
  docker run -d --name "$FE" -v "$TREE":/app -v it-aware-fe-npm:/root/.npm -w /app \
    -e CI=1 -e NEXT_TELEMETRY_DISABLED=1 -e BACKEND_DOMAIN="$API" -e BACKEND_PUBLIC_DOMAIN="$API" \
    "$GATE_NODE_IMAGE" sleep 86400 >/dev/null || return 1
  GATE_CTR=$FE
  nx sh -c 'cp .env.example .env && npm ci --no-audit --no-fund --loglevel=error' || return 1
  nx sh -c 'npx next build >/tmp/build.log 2>&1 || { tail -40 /tmp/build.log; exit 1; }' || return 1
  docker exec -d "$FE" sh -c 'npx next start -H 0.0.0.0 -p 3000 >/app/.next-server.log 2>&1'
  for i in $(seq 1 60); do
    nx wget -qO /dev/null -T 2 http://127.0.0.1:3000/auth/login 2>/dev/null && return 0
    sleep 1
  done
  echo "e2e: next start did not come up" >&2
  tail -30 "$TREE/.next-server.log" >&2
  return 1
}

journeys() {
  docker run --name "$PW" --network "container:$FE" -v "$TREE":/app -w /app --ipc=host \
    -e CI=1 -e E2E_BASE_URL=http://localhost:3000 -e E2E_API_URL="$API" \
    -e E2E_USERNAME="$STACK_ADMIN" -e E2E_PASSWORD="$STACK_PASSWORD" \
    -e PLAYWRIGHT_JUNIT_OUTPUT_NAME=/app/.gate-journeys.xml \
    "$PLAYWRIGHT_IMAGE" npx playwright test --retries=0 --reporter=list,junit
  local rc=$?
  cp "$TREE/.gate-journeys.xml" "$OUT/journeys.xml" 2>/dev/null
  rm -rf "$OUT/test-results" && cp -R "$TREE/test-results" "$OUT/test-results" 2>/dev/null
  return $rc
}

doubles_clean() {
  local name port got rc=0
  for name in $(python3 -c 'import json,sys; print(" ".join(json.load(open(sys.argv[1]))))' "$STACK_PORTS"); do
    port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$STACK_PORTS" "$name")
    got=$(curl -sf "http://127.0.0.1:$port/_e2e/unexpected" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["unexpected"]))') || got=unreachable
    if [ "$got" != 0 ]; then
      echo "double $name: $got unexpected request(s)" >&2
      curl -sf "http://127.0.0.1:$port/_e2e/unexpected" >"$OUT/unexpected-$name.json"
      rc=1
    fi
  done
  if [ -s "$E2E_GUARD_LOG" ]; then
    echo "network guard: $(wc -l <"$E2E_GUARD_LOG" | tr -d ' ') attempt(s) to leave loopback" >&2
    cp "$E2E_GUARD_LOG" "$OUT/guard.log"
    rc=1
  fi
  return $rc
}

echo "e2e: commit ${HEAD_SHA:0:12} on $BRANCH, run $RUN_ID"
[ -n "$DIRTY" ] && echo "e2e: the working tree is dirty; this run cannot be green or tagged"

stage static check_static
if stage export export_tree && stage backend backend && stage frontend frontend; then
  stage journeys journeys
  stage doubles doubles_clean
fi
cp "$STACK"/*.log "$OUT/" 2>/dev/null

python3 - "$OUT/journeys.xml" "$RUN_ID" "$WORK/stages.tsv" "${BACKEND_SHA:-}" >"$WORK/e2e.json" <<'EOF'
import json, sys, xml.etree.ElementTree as ET
from pathlib import Path
junit, run_id, stages, backend = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), sys.argv[4]
names, bad = set(), set()
if junit.exists():
    for case in ET.parse(junit).getroot().iter("testcase"):
        name = f"{case.get('classname')}.{case.get('name')}"
        names.add(name)
        if any(case.find(tag) is not None for tag in ("failure", "error", "skipped")):
            bad.add(name)
tests, failures = len(names), len(bad)
all_pass = all(line.split("\t")[1] == "pass" for line in stages.read_text().splitlines() if line)
print(json.dumps({"run_id": run_id, "journeys": tests, "passed": tests - failures,
                  "unexpected": failures, "flaky": 0, "backend": backend or None,
                  "converged": bool(all_pass and tests and failures == 0)}))
EOF

{
  printf 'image\t%s\n' "$GATE_NODE_IMAGE"
  printf 'playwright\t%s\n' "$PLAYWRIGHT_IMAGE"
  printf 'backend\t%s\n' "${BACKEND_SHA:-none} ${BACKEND_TAG:-}"
  printf 'docker\t%s\n' "$(docker version --format '{{.Server.Version}}' 2>/dev/null)"
  printf 'git\t%s\n' "$(git --version | awk '{print $3}')"
} >"$WORK/tools.tsv"

[ -z "$DIRTY" ] && DIRTY=$(git status --porcelain --untracked-files=normal)
[ "$(git rev-parse HEAD)" = "$HEAD_SHA" ] || DIRTY="HEAD moved during the run"
TREE_CLEAN=1
[ -n "$DIRTY" ] && TREE_CLEAN=0 && FAILED="$FAILED tree-dirty"

BASE=$(git merge-base woa/development HEAD 2>/dev/null || git merge-base origin/development HEAD 2>/dev/null || echo "$HEAD_SHA")
TAG=converged/$(date -u +%Y%m%dT%H%M%SZ)
python3 "$REPO/ci/report.py" \
  --repo it-aware-frontend --commit "$HEAD_SHA" --branch "$BRANCH" --base "$BASE" \
  --user "$(id -un)" --started "$STARTED" --finished "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --duration "$(since "$T0")" --tag "$TAG" --tree-clean "$TREE_CLEAN" --kind converged \
  --static "$REPO/.gate/static-report.json" --e2e "$WORK/e2e.json" \
  --rounds-log "$REPO/.gate/convergence-log.jsonl" --repo-dir "$REPO" --stages "$WORK/stages.tsv" --tools "$WORK/tools.tsv" \
  --out "$REPO/.gate/converged-report.json"
REPORT_RC=$?

echo
column -t -s "$(printf '\t')" "$WORK/stages.tsv" | sed 's/^/  /'
echo "  $(cat "$WORK/e2e.json")"
if [ -z "$FAILED" ] && [ "$REPORT_RC" -eq 0 ]; then
  if git tag -a "$TAG" --cleanup=verbatim -F "$REPO/.gate/converged-report.json" "$HEAD_SHA"; then
    echo "e2e: tagged $TAG on ${HEAD_SHA:0:12} (push with the commit: git push woa development $TAG, and the same to origin)"
    echo "E2E PASS"
    exit 0
  fi
  FAILED=" tag"
fi
[ -z "$FAILED" ] && FAILED=" report"
echo "E2E FAIL:$FAILED"
exit 1
