// tools/gate/lib/resolve-candidate.mjs
//
// The exact-candidate contract (ticket §1/§2/§5/§11 AC-1..4,8):
// resolve which worktree/SHA a gate run must validate, and refuse — never
// substitute the repository root, never guess by recency or branch name —
// whenever that cannot be established with certainty.
//
// Pure function of its inputs (a listWorktrees()-shaped array, a manifest
// entry, explicit CLI overrides) so it can be unit-tested against
// hermetic fixtures without touching the real repository or real manifest.

import { existsSync } from 'node:fs'
import { dirtyEntries, headSha, samePath } from './git-worktrees.mjs'

/** Files whose churn is a known, non-representative artifact (see project
 *  memory: tsconfig.tsbuildinfo regenerates on every tsc invocation and is
 *  git-tracked rather than gitignored). Present alone, it is advisory, not
 *  a blocking dirty-tree finding. Anything else dirty still blocks. */
const ADVISORY_ONLY_DIRTY_FILES = new Set(['tsconfig.tsbuildinfo'])

function fail(code, reason) {
  return { ok: false, code, reason }
}

/**
 * @param {object} opts
 * @param {string} opts.lane - required lane key ("client-experience" | "engineering" | "calculation" | ...)
 * @param {string|null} opts.expectShaArg - --expect-sha, if the caller passed one explicitly
 * @param {string|null} opts.worktreeArg - --worktree, if the caller passed one explicitly
 * @param {boolean} opts.allowDirty - --allow-dirty
 * @param {object|null} opts.manifestEntry - manifest[lane], or null/undefined if undeclared
 * @param {Array<{path:string,sha:string|null,branch:string|null,detached:boolean}>|null} opts.worktrees
 *   - result of listWorktrees(); null means git itself failed (lifecycle failure, not provenance).
 * @param {(dir:string)=>boolean} [opts.existsFn] - injectable for tests; defaults to fs.existsSync
 * @param {(dir:string)=>string|null} [opts.headShaFn] - injectable for tests
 * @param {(dir:string)=>string[]|null} [opts.dirtyEntriesFn] - injectable for tests
 */
export function resolveCandidate(opts) {
  const {
    lane,
    expectShaArg,
    worktreeArg,
    allowDirty,
    manifestEntry,
    worktrees,
    existsFn = existsSync,
    headShaFn = headSha,
    dirtyEntriesFn = dirtyEntries,
  } = opts

  if (!lane) return fail(2, 'No --lane given. Every gate invocation must declare which delivery lane it is validating.')

  if (worktrees === null) {
    return fail(3, '"git worktree list --porcelain" failed. Cannot enumerate registered worktrees from this checkout.')
  }

  const expectSha = expectShaArg || manifestEntry?.sha || null
  let worktree = worktreeArg || manifestEntry?.worktree || null

  if (!expectSha) {
    return fail(
      2,
      `No expected candidate SHA for lane "${lane}": no --expect-sha was given and no candidate is declared in the manifest. ` +
        `Run "node tools/gate/declare-candidate.mjs --lane ${lane}" from the candidate worktree first.`,
    )
  }

  if (!worktree) {
    const matches = worktrees.filter((w) => w.sha === expectSha)
    if (matches.length === 0) {
      return fail(
        2,
        `No registered worktree has HEAD == ${expectSha} for lane "${lane}". Declare the candidate ` +
          `(node tools/gate/declare-candidate.mjs --lane ${lane}) or pass --worktree explicitly.`,
      )
    }
    if (matches.length > 1) {
      return fail(
        2,
        `Ambiguous candidate for lane "${lane}": ${matches.length} registered worktrees have HEAD == ${expectSha} ` +
          `(${matches.map((m) => m.path).join(', ')}). Refusing to guess — pass --worktree explicitly.`,
      )
    }
    worktree = matches[0].path
  }

  const registered = worktrees.find((w) => samePath(w.path, worktree))
  if (!registered) {
    return fail(
      2,
      `"${worktree}" is not a path returned by "git worktree list" for this repository. Refusing to validate ` +
        'an unregistered directory (this is what stops a mismatched checkout, e.g. the repository root, from silently PASSing).',
    )
  }

  if (!existsFn(worktree)) {
    return fail(3, `Candidate worktree "${worktree}" is registered but missing on disk.`)
  }

  const actualHead = headShaFn(worktree)
  if (actualHead === null) {
    return fail(3, `"git -C ${worktree} rev-parse HEAD" failed — worktree is not a valid, readable git checkout.`)
  }

  if (actualHead !== expectSha) {
    return fail(
      2,
      `ACTUAL HEAD (${actualHead}) at "${worktree}" does not match EXPECTED CANDIDATE (${expectSha}). ` +
        'Refusing to validate the wrong candidate. If this worktree was reworked, declare the new candidate first.',
    )
  }

  const rawDirty = dirtyEntriesFn(worktree)
  if (rawDirty === null) {
    return fail(3, `"git -C ${worktree} status --porcelain" failed.`)
  }

  const blockingDirty = rawDirty.filter((entry) => !ADVISORY_ONLY_DIRTY_FILES.has(entry))
  if (blockingDirty.length > 0 && !allowDirty) {
    return fail(
      2,
      `Worktree "${worktree}" is dirty (${blockingDirty.join(', ')}) and clean provenance is required. ` +
        'Commit or stash the changes, or pass --allow-dirty if the caller genuinely intends to validate a dirty tree.',
    )
  }

  return {
    ok: true,
    lane,
    worktree,
    sha: actualHead,
    branch: registered.detached ? null : registered.branch,
    detached: registered.detached,
    dirty: rawDirty.length > 0,
    dirtyEntries: rawDirty,
    advisoryDirtyOnly: rawDirty.length > 0 && blockingDirty.length === 0,
  }
}
