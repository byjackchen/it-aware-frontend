#!/usr/bin/env bash
# The deploy-time tag check (OHLA CI gate v0.3 §5, phase 3): the first stage of the
# dev pipeline it-aware-dev-frontend calls this script and stops the
# deploy unless it exits 0.
#
# The commit being built (HEAD of the pipeline's checkout) must itself carry ONE
# annotated converged/<UTC ts> tag whose message is a report with
#   schema ohla-gate-report/1, kind converged, commit = that SHA, verdict green,
#   tree_clean true, e2e.converged true, and an embedded static report
#   (static.kind static, static.commit = that SHA, static.verdict green).
# ci/e2e.sh creates it, after ci/gate.sh was green on the same commit. A tag on an
# ancestor does not count.
#
# It needs git and bash, plus python3 or jq to read the JSON; no toolchain, no
# credentials beyond the pipeline's own checkout. It takes no arguments.
set -uo pipefail

if [ "$#" -ne 0 ]; then
  echo "ci/check-tags.sh takes no arguments" >&2
  exit 2
fi
cd "$(dirname "$0")/.." || exit 2

SHA=$(git rev-parse HEAD) || exit 2
echo "check-tags: commit $SHA"
if ! git fetch --quiet --force origin 'refs/tags/converged/*:refs/tags/converged/*'; then
  echo "check-tags: could not fetch tags from origin" >&2
  exit 1
fi

# field <dotted.path>: the value at that path of the JSON on stdin ("None"/"null" if absent)
if command -v python3 >/dev/null 2>&1; then
  field() {
    python3 -c '
import json, sys
v = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    v = v.get(k) if isinstance(v, dict) else None
print(str(v).lower() if isinstance(v, bool) else v)' "$1" 2>/dev/null
  }
elif command -v jq >/dev/null 2>&1; then
  field() { jq -r --arg k "$1" 'getpath($k | split(".")) | tostring' 2>/dev/null; }
else
  echo "check-tags: needs python3 or jq on the build agent" >&2
  exit 1
fi

# valid <tag> <kind>: the tag is annotated and its message is a green report of that
# kind for SHA. For kind converged the embedded static report and the e2e verdict
# must be green for SHA too.
valid() {
  local tag=$1 kind=$2 body
  [ "$(git cat-file -t "refs/tags/$tag")" = tag ] || { echo "  $tag: not an annotated tag"; return 1; }
  body=$(git tag -l --format='%(contents)' "$tag")
  local schema commit verdict clean got_kind
  schema=$(printf '%s' "$body" | field schema)
  commit=$(printf '%s' "$body" | field commit)
  verdict=$(printf '%s' "$body" | field verdict)
  clean=$(printf '%s' "$body" | field tree_clean)
  got_kind=$(printf '%s' "$body" | field kind)
  if [ "$schema" = ohla-gate-report/1 ] && [ "$commit" = "$SHA" ] && [ "$verdict" = green ] &&
    [ "$clean" = true ] && [ "$got_kind" = "$kind" ]; then
    if [ "$kind" = converged ]; then
      local s_kind s_commit s_verdict e2e_ok
      s_kind=$(printf '%s' "$body" | field static.kind)
      s_commit=$(printf '%s' "$body" | field static.commit)
      s_verdict=$(printf '%s' "$body" | field static.verdict)
      e2e_ok=$(printf '%s' "$body" | field e2e.converged)
      if [ "$s_kind" != static ] || [ "$s_commit" != "$SHA" ] || [ "$s_verdict" != green ] || [ "$e2e_ok" != true ]; then
        echo "  $tag: rejected (static=$s_kind/${s_commit:0:12}/$s_verdict e2e.converged=$e2e_ok)"
        return 1
      fi
    fi
    echo "  $tag: ok (kind $kind, verdict green)"
    return 0
  fi
  echo "  $tag: rejected (schema=$schema commit=${commit:0:12} verdict=$verdict tree_clean=$clean kind=$got_kind)"
  return 1
}

# first_valid <prefix> <kind>: print the newest valid tag of that kind on SHA
first_valid() {
  local tag
  for tag in $(git tag --points-at "$SHA" -l "$1/*" | sort -r); do
    if valid "$tag" "$2"; then
      FOUND=$tag
      return 0
    fi
  done
  return 1
}

FOUND=""
if first_valid converged converged; then
  echo "check-tags: OK, commit ${SHA:0:12} carries a green $FOUND (static + e2e)"
  exit 0
fi

echo "check-tags: DEPLOY REFUSED: commit ${SHA:0:12} has no valid converged/* tag." >&2
echo "check-tags: run ci/gate.sh and then ci/e2e.sh on this commit, and push it with the tag:" >&2
echo "check-tags:   git push origin development converged/<ts>" >&2
exit 1
