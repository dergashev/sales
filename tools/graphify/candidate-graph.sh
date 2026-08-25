#!/bin/sh
set -eu

MODE="${1:-assert}"

ROOT="$(git rev-parse --show-toplevel)"
HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD)"
GRAPH_DIR="$ROOT/graphify-out"
GRAPH_FILE="$GRAPH_DIR/graph.json"
SHA_FILE="$GRAPH_DIR/CANDIDATE_SHA"

case "$MODE" in
  prepare)
    echo "[candidate-graph] worktree: $ROOT"
    echo "[candidate-graph] candidate: $HEAD_SHA"

    if [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]; then
      echo "[candidate-graph] ERROR: tracked working tree is not clean."
      echo "[candidate-graph] Commit the candidate before preparing exact-SHA graph evidence."
      exit 1
    fi

    cd "$ROOT"

    GRAPHIFY_CLAUDE_CLI_MODEL="${GRAPHIFY_CLAUDE_CLI_MODEL:-sonnet}" \
      graphify extract . \
        --backend claude-cli \
        --mode deep \
        --max-concurrency 1

    test -f "$GRAPH_FILE"

    printf '%s\n' "$HEAD_SHA" > "$SHA_FILE"

    echo "[candidate-graph] READY"
    echo "[candidate-graph] graph: $GRAPH_FILE"
    echo "[candidate-graph] candidate: $HEAD_SHA"
    ;;

  assert)
    if [ ! -f "$GRAPH_FILE" ]; then
      echo "[candidate-graph] BLOCKED: graph.json is missing."
      echo "[candidate-graph] Run: tools/graphify/candidate-graph.sh prepare"
      exit 2
    fi

    if [ ! -f "$SHA_FILE" ]; then
      echo "[candidate-graph] BLOCKED: CANDIDATE_SHA is missing."
      echo "[candidate-graph] Run: tools/graphify/candidate-graph.sh prepare"
      exit 2
    fi

    GRAPH_SHA="$(cat "$SHA_FILE")"

    if [ "$GRAPH_SHA" != "$HEAD_SHA" ]; then
      echo "[candidate-graph] BLOCKED: stale or wrong-candidate graph."
      echo "[candidate-graph] HEAD:  $HEAD_SHA"
      echo "[candidate-graph] GRAPH: $GRAPH_SHA"
      echo "[candidate-graph] Run: tools/graphify/candidate-graph.sh prepare"
      exit 3
    fi

    echo "[candidate-graph] VERIFIED"
    echo "[candidate-graph] candidate: $HEAD_SHA"
    echo "[candidate-graph] graph: $GRAPH_FILE"
    ;;

  *)
    echo "Usage: $0 prepare|assert"
    exit 64
    ;;
esac
