// tools/worktrees/lib/worktree-lifecycle.mjs
//
// Pure decision tables for the two worktree-lifecycle problems this ticket
// exists to fix:
//
//   1. cleaning up a temporary Release Integration worktree deterministically
//      (never leaving Git believing a MISSING worktree still owns `main`);
//   2. refreshing the canonical detached local-`main` preview worktree
//      safely (never discarding unknown work, never silently guessing).
//
// Kept dependency-free of real git/fs calls (everything is injected) so the
// full decision table is unit-testable against fixtures without touching
// the real repository. Real-git integration is covered separately in
// worktree-lifecycle.integration.test.mjs.
//
// ROOT CAUSE (verified by direct experiment against real git 2.39.3, and
// the correction of an earlier, WRONG hypothesis from this ticket's own
// Engineering Architecture pass — recorded here because it is exactly the
// failure mode a future maintainer would rediscover the hard way):
//
//   The Architecture handoff originally assumed the reported symptom
//   ("git worktree prune did not immediately resolve the stale
//   registration") meant a worktree whose directory still exists but
//   whose `.git` LINK is gone. That is FALSE: `git -C <dir> rev-parse
//   HEAD` in that shape silently walks UP to an ancestor repository once
//   `<dir>`'s own `.git` is missing (it returns the PARENT checkout's
//   HEAD, not an error) — AND a bare `git worktree prune` handles both
//   "directory fully deleted" and "directory present, .git link gone"
//   immediately, with no extra flag needed. Neither shape is the bug.
//
//   The actual mechanism (reproduced directly): a worktree that was
//   `git worktree lock`ed survives BOTH `git worktree prune` (even with
//   `--expire now`) AND `git worktree remove` INDEFINITELY, however long
//   its directory has been missing — this is git's own deliberate
//   protection against removing a worktree mid-use, not a defect in
//   either command. If something locks the Release Integration worktree
//   for the duration of a run and that run's workspace is later deleted
//   without an `unlock`, this is exactly the stuck state the ticket
//   reports, and the only supported recovery is `git worktree unlock`
//   followed by the normal prune/remove — never manual `.git/worktrees/*`
//   surgery, and (unlike this module's first draft) never raw directory
//   deletion either.
//
// This module therefore trusts `git worktree list --porcelain`'s own
// `locked`/`prunable` fields (parsed in git-worktrees.mjs) rather than
// re-deriving worktree health via `existsSync`/`headSha` on the path —
// which is unreliable for exactly the nested paths this tool cares about
// (`.worktrees/*`, `.preview/*` under the repository root), for the
// upward-discovery reason above.

import { ADVISORY_ONLY_DIRTY_FILES } from '../../gate/lib/resolve-candidate.mjs'

function blockingDirtyEntries(rawDirty) {
  return rawDirty.filter((entry) => !ADVISORY_ONLY_DIRTY_FILES.has(entry))
}

/**
 * Decide what a Release Integration cleanup invocation should do to one
 * target worktree path. Never performs the action itself — the caller runs
 * the returned `action` through real git and reports the real outcome.
 *
 * @param {object} opts
 * @param {Array<{path:string,sha:string|null,branch:string|null,detached:boolean,locked:boolean,lockReason:string|null,prunable:boolean,prunableReason:string|null}>|null} opts.worktrees
 * @param {string} opts.targetPath
 * @param {(dir:string)=>string[]|null} opts.dirtyEntriesFn
 * @param {(a:string,b:string)=>boolean} opts.samePathFn
 * @param {boolean} [opts.force] - operator has explicitly accepted removing a dirty worktree.
 * @param {boolean} [opts.unlock] - operator has explicitly accepted unlocking a locked worktree first.
 */
export function planReleaseWorktreeCleanup({ worktrees, targetPath, dirtyEntriesFn, samePathFn, force = false, unlock = false }) {
  if (worktrees === null) {
    return { action: 'blocked', code: 3, reason: '"git worktree list --porcelain" failed. Cannot enumerate registered worktrees.' }
  }

  const registered = worktrees.find((w) => samePathFn(w.path, targetPath))
  if (!registered) {
    return { action: 'noop', reason: `"${targetPath}" is not a registered worktree. Nothing to clean up — already clean.` }
  }

  if (registered.locked) {
    if (!unlock) {
      return {
        action: 'blocked',
        code: 2,
        reason:
          `"${targetPath}" is locked (${registered.lockReason || 'no reason given'}). A locked worktree survives "git worktree prune" ` +
          '(even with --expire now) and refuses "git worktree remove" indefinitely, however long it has been missing — this is git\'s own ' +
          'protection against removing a worktree mid-use, not a defect in either command.',
        unblockingRequirement:
          'Confirm the lock no longer protects a live operation, then re-run with --unlock (runs "git worktree unlock", which never touches ' +
          'files) — or run "git worktree unlock" yourself first.',
      }
    }
    // Git never computes `prunable`/dirty-worthy status for a LOCKED entry
    // at all (verified: a locked-and-missing worktree's porcelain record
    // carries no `prunable` line), so the real post-unlock action cannot be
    // predicted from THIS snapshot — the caller must run "git worktree
    // unlock", re-list, and call this function again on fresh data.
    return { action: 'unlock-then-replan', reason: `"${targetPath}" is locked (${registered.lockReason || 'no reason given'}); unlocking to determine the real state.` }
  }

  if (registered.prunable) {
    return {
      action: 'prune',
      reason: `"${targetPath}" is registered but git itself reports it prunable (${registered.prunableReason || 'missing/broken worktree'}).`,
    }
  }

  // Present and not prunable: a real, readable checkout. Its dirty status
  // decides whether removal is safe.
  const rawDirty = dirtyEntriesFn(targetPath)
  if (rawDirty === null) {
    return { action: 'blocked', code: 3, reason: `"git -C ${targetPath} status --porcelain" failed.` }
  }

  const blocking = blockingDirtyEntries(rawDirty)
  if (blocking.length > 0 && !force) {
    return {
      action: 'blocked',
      code: 2,
      reason: `"${targetPath}" contains uncommitted changes (${blocking.join(', ')}). Refusing to remove a dirty worktree.`,
      unblockingRequirement: 'Commit/stash the changes in that worktree, or re-run with --force to remove it anyway (git worktree remove --force).',
    }
  }

  return { action: 'remove', force: blocking.length > 0 && force, sha: registered.sha, branch: registered.branch }
}

/**
 * Decide what the canonical local-`main` preview should do this run.
 * Mirrors the exact-candidate gate's resolve-candidate contract: never
 * substitute a guess, never discard unknown work, fail closed on ambiguity.
 *
 * @param {object} opts
 * @param {string} opts.mainSha - `git rev-parse main`, resolved by the caller.
 * @param {Array<{path:string,sha:string|null,branch:string|null,detached:boolean,locked:boolean,lockReason:string|null,prunable:boolean,prunableReason:string|null}>|null} opts.worktrees
 * @param {string} opts.previewPath
 * @param {(dir:string)=>boolean} opts.existsFn
 * @param {(dir:string)=>string[]|null} opts.dirtyEntriesFn
 * @param {(a:string,b:string)=>boolean} opts.samePathFn
 */
export function planPreviewRefresh({ mainSha, worktrees, previewPath, existsFn, dirtyEntriesFn, samePathFn }) {
  if (!mainSha) {
    return { action: 'blocked', code: 2, reason: '"git rev-parse main" did not resolve. Cannot preview an unresolvable ref.' }
  }
  if (worktrees === null) {
    return { action: 'blocked', code: 3, reason: '"git worktree list --porcelain" failed. Cannot enumerate registered worktrees.' }
  }

  const registered = worktrees.find((w) => samePathFn(w.path, previewPath))

  if (!registered) {
    if (existsFn(previewPath)) {
      return {
        action: 'blocked',
        code: 3,
        reason: `"${previewPath}" exists on disk but is not a registered worktree. Refusing to guess what it is — inspect it manually.`,
      }
    }
    return { action: 'create', sha: mainSha }
  }

  if (registered.locked) {
    return {
      action: 'blocked',
      code: 3,
      reason:
        `Preview worktree "${previewPath}" is locked (${registered.lockReason || 'no reason given'}). ` +
        'dev:main never locks its own preview — investigate manually before retrying.',
    }
  }

  if (registered.prunable) {
    return {
      action: 'recreate',
      sha: mainSha,
      reason: `Preview worktree registration is stale (${registered.prunableReason || 'missing/broken worktree'}); pruning and recreating.`,
    }
  }

  if (registered.sha === mainSha) {
    return { action: 'reuse', sha: mainSha }
  }

  const rawDirty = dirtyEntriesFn(previewPath)
  if (rawDirty === null) {
    return { action: 'blocked', code: 3, reason: `"git -C ${previewPath} status --porcelain" failed.` }
  }

  const blocking = blockingDirtyEntries(rawDirty)
  if (blocking.length > 0) {
    return {
      action: 'refuse-dirty',
      code: 2,
      dirty: blocking,
      reason:
        `Preview worktree "${previewPath}" is dirty (${blocking.join(', ')}) and main has moved to ${mainSha}. ` +
        'Refusing to discard uncommitted changes by checking out a new SHA.',
      unblockingRequirement: 'Commit/stash or discard the changes in the preview worktree yourself, then re-run.',
    }
  }

  return { action: 'checkout', sha: mainSha, from: registered.sha }
}
