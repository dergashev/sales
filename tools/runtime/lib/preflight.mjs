// tools/runtime/lib/preflight.mjs
//
// Two independent, pure decision functions:
//
//   1. `planTaskBasePreflight` — ticket "TASK BASE FRESHNESS" / "PINNED
//      CANDIDATE RULE": before a NEW implementation task's first
//      production modification, prove its worktree is not silently behind
//      already-released prerequisite work, and once `taskBaseCommit` is
//      pinned, NEVER move it again just because main advanced further
//      (scenario J) — only a genuinely fresh worktree gets a fresh pin.
//
//   2. `checkBrowserProvenance` — ticket "BROWSER CONSUMER PREFLIGHT": the
//      shared gate every browser-capable agent/tool runs before treating
//      a runtime's evidence as authoritative, for both CURRENT-MAIN and
//      QA/Review consumers.
//
// Both are dependency-free of fs/git/http so they are fully unit-testable
// against the ticket's named scenarios (I, J, K, L) without a real repo.

/**
 * @param {object} opts
 * @param {{taskBaseCommit?:string, pinnedAt?:string}|null} opts.manifestEntry - manifest[lane], or null/undefined if undeclared for this lane.
 * @param {string} opts.mainSha - `git rev-parse main` right now.
 * @param {string} opts.headSha - the task worktree's own HEAD.
 * @param {boolean|null} opts.mainIsAncestorOfHead - result of `git merge-base --is-ancestor <mainSha> <headSha>`
 *   (true = head already contains every commit main has; false = it does not; null = the git call itself failed).
 */
export function planTaskBasePreflight({ manifestEntry, mainSha, headSha, mainIsAncestorOfHead }) {
  if (manifestEntry && manifestEntry.taskBaseCommit) {
    // PINNED CANDIDATE RULE: once genuinely established, never rebase, and
    // never fail merely because main moved further in the meantime —
    // exact task provenance stays intact for the life of this candidate.
    return {
      action: 'pinned',
      code: 0,
      taskBaseCommit: manifestEntry.taskBaseCommit,
      pinnedAt: manifestEntry.pinnedAt ?? null,
      reason: `Task base already pinned at ${manifestEntry.taskBaseCommit}. Never rebased, regardless of main's current position (${mainSha}).`,
    }
  }

  if (mainIsAncestorOfHead === null) {
    return { action: 'blocked', code: 3, reason: `"git merge-base --is-ancestor ${mainSha} ${headSha}" failed. Cannot establish task-base freshness.` }
  }

  if (mainIsAncestorOfHead === false) {
    return {
      action: 'stale',
      code: 2,
      reason:
        `Task workspace HEAD (${headSha}) does not contain current main (${mainSha}) — this worktree omits already-released ` +
        'prerequisite work.',
      unblockingRequirement: 'Create a fresh implementation task worktree from current main. Never merge/rebase/reset/repoint the existing one to catch it up.',
    }
  }

  // Fresh and ahead-of-or-at main: pin it now, for the life of this candidate.
  return { action: 'pin', code: 0, taskBaseCommit: headSha, reason: `Task workspace HEAD (${headSha}) contains current main (${mainSha}); pinning as taskBaseCommit.` }
}

/**
 * Shared provenance gate for any browser-capable consumer (ticket "BROWSER
 * CONSUMER PREFLIGHT"). `expectedPurpose`/`expectedSha` describe what the
 * CALLER needs; `actualPurpose`/`actualSha`/`status` describe what
 * classify.mjs actually derived for the runtime the caller is about to use.
 *
 * @param {object} opts
 * @param {string} opts.expectedPurpose
 * @param {string} opts.expectedSha
 * @param {string|null} opts.actualPurpose
 * @param {string|null} opts.actualSha
 * @param {string} opts.status - one of classify.mjs's RUNTIME_STATUS values.
 */
export function checkBrowserProvenance({ expectedPurpose, expectedSha, actualPurpose, actualSha, status }) {
  if (status !== 'SERVING_VERIFIED') {
    const label = expectedPurpose === 'CURRENT_MAIN' ? 'BLOCKED — STALE CURRENT_MAIN RUNTIME' : 'BLOCKED — TARGET RUNTIME PROVENANCE NOT VERIFIED'
    return {
      verified: false,
      label,
      reason: `Runtime status is ${status}, not SERVING_VERIFIED. No browser evidence gathered from it may count as authoritative acceptance evidence.`,
      expectedPurpose,
      expectedSha,
      actualPurpose,
      actualSha,
    }
  }

  if (actualPurpose !== expectedPurpose) {
    return {
      verified: false,
      label: 'BLOCKED — TARGET RUNTIME PROVENANCE NOT VERIFIED',
      reason: `Runtime purpose is "${actualPurpose}", expected "${expectedPurpose}".`,
      expectedPurpose,
      expectedSha,
      actualPurpose,
      actualSha,
    }
  }

  if (actualSha !== expectedSha) {
    const label = expectedPurpose === 'CURRENT_MAIN' ? 'BLOCKED — STALE CURRENT_MAIN RUNTIME' : 'BLOCKED — TARGET RUNTIME PROVENANCE NOT VERIFIED'
    return { verified: false, label, reason: `Runtime serves ${actualSha}, expected ${expectedSha}.`, expectedPurpose, expectedSha, actualPurpose, actualSha }
  }

  return { verified: true, label: 'VERIFIED', reason: 'Runtime purpose and sha match exactly what this consumer expects.', expectedPurpose, expectedSha, actualPurpose, actualSha }
}
