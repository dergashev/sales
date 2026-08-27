#!/usr/bin/env bash
# tools/graphify/candidate-graph.sh — bounded, diagnostic candidate-graph
# preparation/verification for exact-SHA repository intelligence.
#
# ROOT CAUSE OF THE R2 HANG (Release & Pipeline Tooling Fixes ticket,
# reproduced independently by Frontend/QA/Tech Lead/Release across multiple
# R2 cycles: `prepare` ran >8 minutes with no output and had to be killed).
# Reproduced and root-caused directly against the installed `graphify`
# (0.9.49) and this repository — two COMPOUNDING causes, both confirmed by
# reading graphify's own implementation, not assumed:
#
#   1. UNBOUNDED EXTRACTION SCOPE. `--mode deep` does not merely enable
#      richer semantic edges — it explicitly WIDENS graphify's semantic pass
#      from its own normal INCREMENTAL (changed-files-only) gate to EVERY
#      live document/paper/image file in the corpus, every single run
#      (graphify/cli.py: "deep mode: widening semantic pass from N changed
#      to M live doc/paper/image file(s)"). This repository has ~90
#      markdown/doc files (docs/, design-system/) that `--mode deep`
#      re-processes unconditionally, changed or not.
#   2. STALE TOOLING CONTRACT. The old script's `--backend claude-cli`
#      shells out a FRESH `claude` CLI subprocess PER semantic chunk
#      (graphify/llm.py `_call_claude_cli`, up to a 600s timeout each), and
#      graphify forces `--max-concurrency 1` for this backend — so ~90 LLM
#      calls ran strictly SERIALLY. The old wrapper printed exactly two
#      lines before handing off to `graphify extract` and never reported
#      progress again — indistinguishable from a genuine hang from outside.
#
#   Classification: UNBOUNDED EXTRACTION SCOPE + STALE TOOLING CONTRACT.
#   Not environment/resource starvation, not a graphify defect, not
#   repository scale by itself, not a dependency outage.
#
# FIX:
#   - Default `prepare` now runs `graphify extract . --code-only` — pure
#     local AST extraction: no LLM call, no external CLI dependency, no API
#     key, deterministic. Measured directly against this repository: ~4s
#     wall-clock, 216 code files -> 1591 nodes / 4259 edges / 90
#     communities, and graphify's own AST pass already streams live
#     progress ("AST extraction: N/216 uncached files (P%) [W workers]").
#     This is sufficient for exact-candidate STRUCTURAL/blast-radius
#     evidence — what QA/Tech Lead/Release actually consume. Graphify
#     remains repository intelligence, never Product Authority or runtime
#     proof (team/CLAUDE.md contract) — the full semantic pass is not
#     required for that role.
#   - GRAPHIFY_DEEP=1 opts back into the full semantic `--mode deep` pass
#     (serial claude-cli calls over every doc/paper/image) for a role that
#     genuinely needs richer LLM-inferred edges. It remains available; it is
#     simply no longer the silent unconditional default.
#   - Bounded execution: the extraction runs as its own process group
#     (bash `set -m` monitor mode — makes the background job's pgid equal
#     its own pid, exactly like this repo's Node runtime tooling uses
#     `spawn(..., { detached: true })` for the same reason) and is killed,
#     GROUP-wide, if it exceeds GRAPHIFY_TIMEOUT_SECONDS (default 300s for
#     the fast path — ~75x the measured normal run — or 1800s once
#     GRAPHIFY_DEEP=1; both overridable). No dependency on GNU `timeout(1)`,
#     which is not present on stock macOS.
#   - Progress: a heartbeat line every GRAPHIFY_HEARTBEAT_SECONDS (default
#     20s) reports elapsed time plus the last line graphify itself printed
#     (captured to a log file) — never silent for minutes, even beyond
#     graphify's own progress lines.
#   - On timeout OR Ctrl-C: reports CANDIDATE SHA / STAGE / ELAPSED TIME /
#     LAST COMPLETED STEP / LIKELY CLASS / RETRY-FALLBACK GUIDANCE, and
#     exits non-zero WITHOUT writing CANDIDATE_SHA — `assert` can therefore
#     never report VERIFIED against an incomplete/killed run; a stale prior
#     graph.json (if any) still correctly BLOCKS on sha mismatch.
#
# Exit codes: 0 READY/VERIFIED · 1 assertion/config/extraction failure ·
# 2 BLOCKED (assert: missing prior prepare, or stale/wrong candidate) ·
# 124 TIMEOUT · 130 CANCELLED (SIGINT/SIGTERM while running).

set -euo pipefail

MODE="${1:-assert}"

ROOT="$(git rev-parse --show-toplevel)"
HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD)"
GRAPH_DIR="$ROOT/graphify-out"
GRAPH_FILE="$GRAPH_DIR/graph.json"
SHA_FILE="$GRAPH_DIR/CANDIDATE_SHA"
LOG_FILE="$GRAPH_DIR/.prepare.log"

DEEP="${GRAPHIFY_DEEP:-0}"
if [ "$DEEP" = "1" ]; then
  DEFAULT_TIMEOUT=1800
else
  DEFAULT_TIMEOUT=300
fi
TIMEOUT_SECONDS="${GRAPHIFY_TIMEOUT_SECONDS:-$DEFAULT_TIMEOUT}"
HEARTBEAT_SECONDS="${GRAPHIFY_HEARTBEAT_SECONDS:-20}"

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
    mkdir -p "$GRAPH_DIR"
    : > "$LOG_FILE"

    if [ "$DEEP" = "1" ]; then
      STAGE_LABEL="DEEP_SEMANTIC_EXTRACT"
      echo "[candidate-graph] mode: DEEP (GRAPHIFY_DEEP=1) — full semantic re-extraction of every doc/paper/image file, serial claude-cli backend. Bound: ${TIMEOUT_SECONDS}s."
      EXTRACT_ARGS=(extract . --backend claude-cli --mode deep --max-concurrency 1)
    else
      STAGE_LABEL="FAST_AST_EXTRACT"
      echo "[candidate-graph] mode: FAST (default) — local AST extraction only, no LLM/API dependency. Bound: ${TIMEOUT_SECONDS}s."
      echo "[candidate-graph] set GRAPHIFY_DEEP=1 for the full semantic pass (slower, serial claude-cli calls per doc/paper/image file)."
      EXTRACT_ARGS=(extract . --code-only)
    fi

    # Report a clean, actionable block on timeout/cancel — never a silent
    # kill, and never a leftover CANDIDATE_SHA that could make `assert`
    # falsely report VERIFIED for a run that did not actually complete.
    report_incomplete() {
      reason="$1"      # TIMEOUT | CANCELLED
      exit_code="$2"
      elapsed="$3"
      last_step="$(tail -n 1 "$LOG_FILE" 2>/dev/null || true)"
      [ -n "$last_step" ] || last_step="(no output yet)"
      echo ""
      echo "[candidate-graph] ${reason} (exit ${exit_code}) after ${elapsed}s"
      echo "  CANDIDATE SHA          : $HEAD_SHA"
      echo "  STAGE                  : $STAGE_LABEL"
      echo "  ELAPSED TIME           : ${elapsed}s (bound ${TIMEOUT_SECONDS}s)"
      echo "  LAST COMPLETED STEP    : $last_step"
      if [ "$reason" = "TIMEOUT" ]; then
        if [ "$DEEP" = "1" ]; then
          echo "  LIKELY CLASS           : UNBOUNDED EXTRACTION SCOPE (serial claude-cli backend over many doc/paper/image files)"
        else
          echo "  LIKELY CLASS           : ENVIRONMENT / RESOURCE STARVATION (the local AST-only path normally finishes in seconds; this bound should not be reachable under normal load)"
        fi
      else
        echo "  LIKELY CLASS           : CANCELLED (SIGINT/SIGTERM received — not a graphify failure)"
      fi
      echo "  RETRY / FALLBACK GUIDANCE:"
      echo "    - Re-run: tools/graphify/candidate-graph.sh prepare"
      echo "    - Widen the bound if needed: GRAPHIFY_TIMEOUT_SECONDS=<n> tools/graphify/candidate-graph.sh prepare"
      if [ "$DEEP" = "1" ]; then
        echo "    - Or drop GRAPHIFY_DEEP for the fast local-AST-only path (no LLM dependency, ~4s on this repository)."
      fi
      echo "    - Or use the currently approved manual/source-inspection fallback for this delivery gate, and report that fallback explicitly — never report GRAPH VERIFIED=YES without a completed prepare."
      echo "  graph.json / CANDIDATE_SHA were NOT written for this run — 'assert' will correctly report BLOCKED, not a false PASS."
    }

    # bash monitor mode: the backgrounded extraction becomes its own
    # process-group leader (pgid == its own pid), exactly like this repo's
    # Node runtime tooling uses `spawn(..., { detached: true })` for the
    # same reason (tools/runtime/main.mjs `startRuntime`) — so a timeout or
    # Ctrl-C can kill the WHOLE group (graphify's python process AND any
    # `claude` CLI child it shelled out to) instead of orphaning it.
    set -m
    GRAPHIFY_CLAUDE_CLI_MODEL="${GRAPHIFY_CLAUDE_CLI_MODEL:-sonnet}" \
      graphify "${EXTRACT_ARGS[@]}" > "$LOG_FILE" 2>&1 &
    EXTRACT_PID=$!
    set +m

    CANCELLED=0
    on_cancel() {
      CANCELLED=1
    }
    trap on_cancel INT TERM

    START_TS=$(date +%s)
    NEXT_HEARTBEAT=$((START_TS + HEARTBEAT_SECONDS))

    while kill -0 "$EXTRACT_PID" 2>/dev/null; do
      NOW=$(date +%s)
      ELAPSED=$((NOW - START_TS))

      if [ "$CANCELLED" = "1" ]; then
        kill -TERM "-$EXTRACT_PID" 2>/dev/null || kill -TERM "$EXTRACT_PID" 2>/dev/null || true
        sleep 1
        kill -KILL "-$EXTRACT_PID" 2>/dev/null || kill -KILL "$EXTRACT_PID" 2>/dev/null || true
        report_incomplete CANCELLED 130 "$ELAPSED"
        exit 130
      fi

      if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
        kill -TERM "-$EXTRACT_PID" 2>/dev/null || kill -TERM "$EXTRACT_PID" 2>/dev/null || true
        sleep 1
        kill -KILL "-$EXTRACT_PID" 2>/dev/null || kill -KILL "$EXTRACT_PID" 2>/dev/null || true
        report_incomplete TIMEOUT 124 "$ELAPSED"
        exit 124
      fi

      if [ "$NOW" -ge "$NEXT_HEARTBEAT" ]; then
        last_step="$(tail -n 1 "$LOG_FILE" 2>/dev/null || true)"
        [ -n "$last_step" ] || last_step="(starting…)"
        echo "[candidate-graph] still running — ${ELAPSED}s elapsed (bound ${TIMEOUT_SECONDS}s). Last: $last_step"
        NEXT_HEARTBEAT=$((NOW + HEARTBEAT_SECONDS))
      fi

      sleep 1
    done

    trap - INT TERM

    set +e
    wait "$EXTRACT_PID"
    STATUS=$?
    set -e
    cat "$LOG_FILE"

    if [ "$STATUS" -ne 0 ]; then
      echo "[candidate-graph] ERROR: graphify extract failed (exit $STATUS). See output above."
      exit "$STATUS"
    fi

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
    echo ""
    echo "  prepare   run/verify exact-candidate extraction (bounded; env:"
    echo "            GRAPHIFY_DEEP=1 for the full semantic pass,"
    echo "            GRAPHIFY_TIMEOUT_SECONDS=<n> to override the bound,"
    echo "            GRAPHIFY_HEARTBEAT_SECONDS=<n> to change progress cadence)"
    echo "  assert    verify a prior prepare's graph.json matches HEAD exactly"
    exit 64
    ;;
esac
