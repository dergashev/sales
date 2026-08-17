#!/bin/sh
# tools/gate/gate.sh — repo-owned, deterministic entry point for the
# Product Delivery Router's machine validation gate.
#
# The vendor Team runtime spawns check-gate commands through a minimal
# /bin/sh whose PATH does not include an interactively-installed node/npm
# (observed once: PATH=/usr/gnu/bin:/usr/local/bin:/bin:/usr/bin:. — no
# $HOME/.local/bin, no node, no npm). This script is the ONLY thing that
# shell has to execute successfully; it resolves the repository's approved
# node runtime deterministically — never via sudo, never via a global
# symlink, never by mutating machine-wide PATH — then execs the real gate
# (gate.mjs), so every further decision (worktree/SHA verification,
# provenance, fail-closed behavior) runs in Node, not shell.
#
# See tools/gate/gate.mjs for the exact-candidate contract this implements,
# and project memory (global/conventions/validation-and-release-gates.md)
# for the pitfall this resolves.
#
# Exit 4 ("VALIDATION INFRASTRUCTURE BLOCKER") if no runtime can be
# resolved deterministically. Never falls through to a partial/guessed
# runtime and never reports PASS on a broken harness.

set -eu

# Resolve this script's own directory (portable; no readlink -f dependency).
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

PATH_SOURCE=""
NODE_DIR=""

# 1. Explicit override — highest priority, always wins if set and valid.
if [ -n "${A3_NODE_BIN:-}" ] && [ -x "${A3_NODE_BIN}" ]; then
  NODE_DIR=$(CDPATH= cd -- "$(dirname -- "${A3_NODE_BIN}")" && pwd)
  PATH_SOURCE="A3_NODE_BIN=${A3_NODE_BIN}"
fi

# 2. Already resolvable on the inherited PATH (covers CI/dev shells that
#    already export it correctly — the common case outside the vendor gate).
if [ -z "${NODE_DIR}" ] && command -v node >/dev/null 2>&1; then
  FOUND=$(command -v node)
  NODE_DIR=$(CDPATH= cd -- "$(dirname -- "${FOUND}")" && pwd)
  PATH_SOURCE="PATH (command -v node -> ${FOUND})"
fi

# 3. Interactive-agent convention documented in project memory: some
#    AgentsRoom subprocesses omit npm from PATH; node/npm are installed
#    under $HOME/.local/bin on this machine, in every worktree.
if [ -z "${NODE_DIR}" ] && [ -x "${HOME}/.local/bin/node" ]; then
  NODE_DIR="${HOME}/.local/bin"
  PATH_SOURCE='$HOME/.local/bin'
fi

# 4. nvm's installed versions, if nvm is present but not sourced into this
#    shell. Portable POSIX sort has no `-V` (version-sort is a GNU
#    extension BSD/macOS sort lacks); plain lexicographic order is a
#    last-resort heuristic at this fallback tier, not a correctness claim.
if [ -z "${NODE_DIR}" ] && [ -n "${NVM_DIR:-}" ] && [ -d "${NVM_DIR}/versions/node" ]; then
  CANDIDATE=$(ls -d "${NVM_DIR}"/versions/node/*/bin 2>/dev/null | tail -n 1 || true)
  if [ -n "${CANDIDATE}" ] && [ -x "${CANDIDATE}/node" ]; then
    NODE_DIR="${CANDIDATE}"
    PATH_SOURCE='$NVM_DIR/versions/node (lexicographically last installed)'
  fi
fi

# 5. Volta.
if [ -z "${NODE_DIR}" ] && [ -x "${HOME}/.volta/bin/node" ]; then
  NODE_DIR="${HOME}/.volta/bin"
  PATH_SOURCE='$HOME/.volta/bin'
fi

# 6/7. Common Homebrew / local-install prefixes.
if [ -z "${NODE_DIR}" ] && [ -x "/opt/homebrew/bin/node" ]; then
  NODE_DIR="/opt/homebrew/bin"
  PATH_SOURCE="/opt/homebrew/bin"
fi
if [ -z "${NODE_DIR}" ] && [ -x "/usr/local/bin/node" ]; then
  NODE_DIR="/usr/local/bin"
  PATH_SOURCE="/usr/local/bin"
fi

if [ -z "${NODE_DIR}" ]; then
  echo "" >&2
  echo "[gate.sh] VALIDATION INFRASTRUCTURE BLOCKER (exit 4)" >&2
  echo "reason: no node runtime could be resolved deterministically" >&2
  echo 'tried, in order: $A3_NODE_BIN, PATH, $HOME/.local/bin, $NVM_DIR/versions/node, $HOME/.volta/bin, /opt/homebrew/bin, /usr/local/bin' >&2
  echo 'fix: set A3_NODE_BIN=/path/to/node, or install node under one of the above' >&2
  exit 4
fi

export PATH="${NODE_DIR}:${PATH}"
export A3_GATE_PATH_SOURCE="${PATH_SOURCE}"

exec node "${SCRIPT_DIR}/gate.mjs" "$@"
