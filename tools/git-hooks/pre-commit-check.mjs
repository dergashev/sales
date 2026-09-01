#!/usr/bin/env node
/**
 * tools/git-hooks/pre-commit-check.mjs
 *
 * DELIVERY-INFRA-01 item 8 — AGENTSROOM CONTROL-STATE PROTECTION, plus a
 * commit-time backstop for item 5 — ROOT RELEASE CHECKOUT PROTECTION.
 *
 * Installed as the repository's `pre-commit` hook by
 * `tools/git-hooks/install.mjs` (wired to `npm run prepare`, so it is set
 * up automatically by `npm install`/`npm ci` — see also
 * `npm run git-hooks:install` to (re)install explicitly in an existing
 * checkout). Runs on every `git commit` in every worktree of this
 * repository (`.git/hooks/` is shared across linked worktrees by
 * default — no per-worktree install step is needed).
 *
 * Two independent guards, both fail-CLOSED on their own trigger and fail
 * OPEN (never block a commit) on a tooling error they cannot diagnose —
 * an infrastructure guard that itself becomes a hard blocker on every git
 * failure would be worse than not existing:
 *
 *   1. checkAgentsRoomGuard — refuse a commit that stages any path under
 *      `.agentsroom/**` (delivery agents must never version-control the
 *      AgentsRoom desktop app's own runtime/session/routing state as
 *      ordinary project source).
 *   2. checkRootCheckoutGuard ('commit' mode) — refuse a commit staging a
 *      Product-owned path while sitting in the authoritative ROOT release
 *      checkout (the retroactive backstop; the HARD gate that blocks
 *      before implementation even starts is `delivery:preflight`, item 4).
 *
 * Exit codes: 0 allow the commit · 1 block it (git's own pre-commit
 * convention: any non-zero exit aborts the commit).
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { gitCommonDir, samePath } from '../gate/lib/git-worktrees.mjs'
import { checkAgentsRoomGuard } from '../delivery/agentsroom-guard.mjs'
import { checkRootCheckoutGuard } from '../delivery/root-guard.mjs'

function stagedFiles(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return result.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function main() {
  const cwd = process.cwd()
  const changed = stagedFiles(cwd)
  if (changed === null) {
    // Fail OPEN: a hook that cannot even list staged files must not become
    // a hard blocker for every future commit in the repository — that is
    // an infrastructure problem for a human to fix, not a reason to stop
    // all delivery.
    console.error('[pre-commit] warning: could not list staged files ("git diff --cached --name-only" failed). Allowing the commit — this guard fails open on tooling errors it cannot diagnose.')
    process.exit(0)
    return
  }
  if (changed.length === 0) {
    process.exit(0)
    return
  }

  const agentsRoom = checkAgentsRoomGuard({ changedPaths: changed })
  if (!agentsRoom.ok) {
    console.error(`\n[pre-commit] BLOCKED (DELIVERY-INFRA-01 — AgentsRoom control-state protection): ${agentsRoom.reason}`)
    process.exit(1)
    return
  }

  const commonDir = gitCommonDir(cwd)
  const toplevelResult = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  const toplevel = toplevelResult.status === 0 ? toplevelResult.stdout.trim() : null

  if (commonDir && toplevel) {
    const repoRoot = path.dirname(commonDir)
    const rootGuard = checkRootCheckoutGuard({ repoRoot, targetPath: toplevel, samePathFn: samePath, mode: 'commit', changedPaths: changed })
    if (!rootGuard.ok) {
      console.error(`\n[pre-commit] BLOCKED (DELIVERY-INFRA-01 — root release checkout protection): ${rootGuard.reason}`)
      process.exit(1)
      return
    }
  }

  process.exit(0)
}

main()
