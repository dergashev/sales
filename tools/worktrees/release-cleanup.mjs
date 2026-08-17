#!/usr/bin/env node
/**
 * tools/worktrees/release-cleanup.mjs — deterministic teardown for the
 * temporary Release Integration worktree.
 *
 * Ticket §2: "A successful, failed or cancelled Release must never leave
 * Git believing a missing worktree still owns `main`." This is the
 * explicit, verified cleanup step Release should run after integration
 * (success, block, or rollback) instead of leaving the worktree directory
 * to rot until someone notices `git worktree prune` can't fix it.
 *
 * Default target: `.worktrees/release-integration`, resolved against the
 * repository root (via the git COMMON dir, so this works from ANY worktree,
 * never assuming the invoking cwd is the root). Override with --path.
 *
 * Root cause this addresses (see tools/worktrees/lib/worktree-lifecycle.mjs
 * for the full story, including a corrected earlier hypothesis): a
 * `git worktree lock`ed worktree survives prune/remove indefinitely once
 * its directory is gone. Never runs a destructive filesystem operation on
 * its own initiative:
 *   - a registered-but-missing directory is cleaned up via `git worktree
 *     prune` (git-native — git itself reports it "prunable");
 *   - a DIRTY worktree is refused unless --force is passed;
 *   - a LOCKED worktree is refused (with the lock reason surfaced) unless
 *     --unlock is passed, in which case only `git worktree unlock` runs
 *     before the normal prune/remove — never a raw filesystem deletion.
 *
 * Exit codes: 0 done (including "already clean") · 2 blocked, dirty or
 * locked without an explicit opt-in · 3 git/lifecycle failure.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { dirtyEntries, gitCommonDir, listWorktrees, samePath } from '../gate/lib/git-worktrees.mjs'
import { planReleaseWorktreeCleanup } from './lib/worktree-lifecycle.mjs'

const EXIT = { OK: 0, BLOCKED: 2, LIFECYCLE: 3 }

function parseArgs(argv) {
  const args = { path: null, force: false, unlock: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--path') args.path = argv[++i]
    else if (a === '--force') args.force = true
    else if (a === '--unlock') args.unlock = true
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node tools/worktrees/release-cleanup.mjs [--path <dir>] [--force] [--unlock]')
      process.exit(EXIT.OK)
    }
  }
  return args
}

function runGit(cwd, gitArgs) {
  return spawnSync('git', gitArgs, { cwd, encoding: 'utf8' })
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()

  const commonDir = gitCommonDir(cwd)
  if (!commonDir) {
    console.error('[release-cleanup] LIFECYCLE FAILURE: "git rev-parse --git-common-dir" failed.')
    process.exit(EXIT.LIFECYCLE)
    return
  }
  const repoRoot = path.dirname(commonDir)
  const targetPath = path.resolve(repoRoot, args.path || '.worktrees/release-integration')

  const worktrees = listWorktrees(repoRoot)
  if (worktrees === null) {
    console.error('[release-cleanup] LIFECYCLE FAILURE: "git worktree list --porcelain" failed.')
    process.exit(EXIT.LIFECYCLE)
    return
  }

  let plan = planReleaseWorktreeCleanup({
    worktrees,
    targetPath,
    dirtyEntriesFn: dirtyEntries,
    samePathFn: samePath,
    force: args.force,
    unlock: args.unlock,
  })

  console.log(`[release-cleanup] target: ${targetPath}`)
  console.log(`[release-cleanup] plan  : ${plan.action}${plan.reason ? ` — ${plan.reason}` : ''}`)

  if (plan.action === 'noop') {
    process.exit(EXIT.OK)
    return
  }

  if (plan.action === 'blocked') {
    if (plan.unblockingRequirement) console.error(`[release-cleanup] unblocking requirement: ${plan.unblockingRequirement}`)
    process.exit(plan.code)
    return
  }

  if (plan.action === 'unlock-then-replan') {
    console.log('[release-cleanup] --unlock given: running "git worktree unlock" first.')
    const unlock = runGit(repoRoot, ['worktree', 'unlock', targetPath])
    if (unlock.status !== 0) {
      console.error(`[release-cleanup] LIFECYCLE FAILURE: "git worktree unlock" failed: ${unlock.stderr}`)
      process.exit(EXIT.LIFECYCLE)
      return
    }
    // Git never computes `prunable`/dirty status for a locked entry, so the
    // real action can only be known from a FRESH listing taken after the
    // unlock — never guessed from the pre-unlock snapshot.
    const refreshed = listWorktrees(repoRoot)
    if (refreshed === null) {
      console.error('[release-cleanup] LIFECYCLE FAILURE: "git worktree list --porcelain" failed after unlock.')
      process.exit(EXIT.LIFECYCLE)
      return
    }
    plan = planReleaseWorktreeCleanup({ worktrees: refreshed, targetPath, dirtyEntriesFn: dirtyEntries, samePathFn: samePath, force: args.force, unlock: false })
    console.log(`[release-cleanup] plan (post-unlock): ${plan.action}${plan.reason ? ` — ${plan.reason}` : ''}`)
    if (plan.action === 'blocked') {
      if (plan.unblockingRequirement) console.error(`[release-cleanup] unblocking requirement: ${plan.unblockingRequirement}`)
      process.exit(plan.code)
      return
    }
  }

  if (plan.action === 'prune') {
    const prune = runGit(repoRoot, ['worktree', 'prune'])
    if (prune.status !== 0) {
      console.error(`[release-cleanup] LIFECYCLE FAILURE: "git worktree prune" failed: ${prune.stderr}`)
      process.exit(EXIT.LIFECYCLE)
      return
    }
    // Tech Review P2-2: "git worktree prune" exits 0 even when it prunes
    // NOTHING (verified directly, including the locked-and-missing shape) —
    // an exit-0 check alone would report "done" while the exact stale
    // registration this ticket exists to fix survives untouched. Re-list
    // and require it to actually be gone, same as the "remove" branch below.
    const after = listWorktrees(repoRoot)
    if (after === null) {
      console.error('[release-cleanup] LIFECYCLE FAILURE: "git worktree list --porcelain" failed after prune.')
      process.exit(EXIT.LIFECYCLE)
      return
    }
    const stillThere = after.some((w) => samePath(w.path, targetPath))
    if (stillThere) {
      console.error(
        '[release-cleanup] LIFECYCLE FAILURE: "git worktree prune" exited 0 but the registration is still present ' +
          '(commonly: it became locked between listing and pruning). Re-run "npm run git:worktrees:check" for the exact state.',
      )
      process.exit(EXIT.LIFECYCLE)
      return
    }
    console.log('[release-cleanup] done: stale registration pruned.')
    process.exit(EXIT.OK)
    return
  }

  if (plan.action === 'remove') {
    const removeArgs = ['worktree', 'remove']
    if (plan.force) removeArgs.push('--force')
    removeArgs.push(targetPath)
    const remove = runGit(repoRoot, removeArgs)
    if (remove.status !== 0) {
      console.error(`[release-cleanup] LIFECYCLE FAILURE: "git worktree remove" failed: ${remove.stderr}`)
      process.exit(EXIT.LIFECYCLE)
      return
    }
    const after = listWorktrees(repoRoot)
    const stillThere = after !== null && after.some((w) => samePath(w.path, targetPath))
    if (stillThere) {
      console.error('[release-cleanup] LIFECYCLE FAILURE: git reported success but the worktree is still registered.')
      process.exit(EXIT.LIFECYCLE)
      return
    }
    console.log(`[release-cleanup] done: removed via "git worktree remove". Branch "${plan.branch ?? 'main'}" left intact.`)
    process.exit(EXIT.OK)
    return
  }

  console.error(`[release-cleanup] LIFECYCLE FAILURE: unknown plan action "${plan.action}".`)
  process.exit(EXIT.LIFECYCLE)
}

main()
