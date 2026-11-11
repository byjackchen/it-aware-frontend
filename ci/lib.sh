# Shared helpers for ci/gate.sh and ci/e2e.sh. Sourced, never run.

# The image production builds and runs on (Dockerfile FROM). Change it with the
# Dockerfile, in the same commit.
GATE_NODE_IMAGE=node:20-alpine

now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }
since() { perl -e 'printf "%.1f", $ARGV[1] - $ARGV[0]' "$1" "$(now)"; }

# node_up <name> <tree>: a throwaway $GATE_NODE_IMAGE container with <tree> at
# /app; the npm cache is a named volume, so repeated runs do not re-download.
# `nx <cmd...>` runs a command in it. The caller removes it (docker rm -f).
node_up() {
  GATE_CTR=$1
  docker rm -f "$GATE_CTR" >/dev/null 2>&1
  docker run -d --name "$GATE_CTR" -v "$2":/app -v it-aware-fe-npm:/root/.npm -w /app \
    -e CI=1 "$GATE_NODE_IMAGE" sleep 86400 >/dev/null
}
nx() { docker exec "$GATE_CTR" "$@"; }
