// tools/gate/lib/git-worktrees.mjs
//
// Pure, dependency-free helpers over `git worktree list --porcelain` and
// related plumbing commands. Kept separate from gate.mjs so the exact-
// candidate resolution logic in resolve-candidate.mjs can be unit-tested
// against hermetic throwaway repositories instead of the real checkout.

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'

/**
 * Canonicalize a path for comparison: resolves symlinks via realpath when
 * the path exists (e.g. macOS's /tmp -> /private/tmp, /var -> /private/var
 * — `git worktree list` reports the realpath, but a caller/manifest may
 * hold the symlinked form), falling back to plain path.resolve when the
 * path does not (yet) exist on disk so a genuinely-missing candidate
 * still compares by its literal location instead of throwing.
 */
function canonicalize(p) {
  try {
    return realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

/**
 * Run `git <args>` in `cwd`. Returns trimmed stdout on success, or `null`
 * on any non-zero exit / spawn failure. Never throws — callers decide how
 * a missing/failing git maps to an exit code.
 */
export function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return result.stdout.trim()
}

/** `git rev-parse HEAD` — the exact candidate SHA a checkout is sitting at. */
export function headSha(cwd) {
  return git(cwd, ['rev-parse', 'HEAD'])
}

/** `git rev-parse --abbrev-ref HEAD` — branch name, or the literal "HEAD" when detached. */
export function currentBranch(cwd) {
  return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
}

/**
 * `git rev-parse --git-common-dir` — the ONE .git shared by every linked
 * worktree. Canonicalized (realpath) before returning: git itself is
 * inconsistent about whether this comes back relative-to-a-symlinked-cwd
 * (main checkout) or already-realpath'd (linked worktree, whose metadata
 * stores an absolute path recorded at `git worktree add` time) — e.g. on
 * macOS, /tmp and /var are themselves symlinks into /private/... Without
 * canonicalizing, two worktrees of the SAME repository could compute two
 * textually different paths for what is actually one shared manifest
 * file, silently splitting it in two.
 */
export function gitCommonDir(cwd) {
  const dir = git(cwd, ['rev-parse', '--git-common-dir'])
  if (!dir) return null
  return canonicalize(path.resolve(cwd, dir))
}

/**
 * Parse `git worktree list --porcelain` into an array of
 * `{ path, sha, branch, detached, locked, lockReason, prunable, prunableReason }`.
 * Returns `null` if git itself is unavailable or the command fails (a
 * lifecycle failure, distinct from "zero worktrees").
 *
 * `locked`/`prunable` are git's OWN authoritative judgment of a
 * registered worktree's health — added for tools/worktrees (worktree
 * lifecycle/cleanup): a worktree whose directory has disappeared reports
 * `prunable` here (safe for a bare `git worktree prune`); one that is
 * `git worktree lock`ed reports `locked` and survives prune/remove
 * indefinitely regardless of how long it has been missing, however
 * expired — confirmed by direct experiment, this is the actual
 * mechanism behind "prune did not resolve the stale registration", not a
 * defect in prune itself. Prefer these fields over re-deriving worktree
 * health via `existsSync`/`headSha` on the path: `git -C <dir> rev-parse
 * HEAD` silently walks UP to an ancestor repository once a nested
 * worktree's own `.git` link is gone (verified — it returns the PARENT
 * checkout's HEAD, not an error), so that approach is unreliable for
 * exactly the paths this tool cares about (`.worktrees/*`, `.preview/*`
 * nested under the repository root).
 */
export function listWorktrees(cwd) {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) return null

  const records = result.stdout.split(/\n\n+/).filter((block) => block.trim().length > 0)
  const worktrees = []
  for (const block of records) {
    const lines = block.split('\n')
    let wtPath = null
    let sha = null
    let branch = null
    let detached = false
    let locked = false
    let lockReason = null
    let prunable = false
    let prunableReason = null
    for (const line of lines) {
      if (line.startsWith('worktree ')) wtPath = line.slice('worktree '.length).trim()
      else if (line.startsWith('HEAD ')) sha = line.slice('HEAD '.length).trim()
      else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length).trim()
        branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
      } else if (line.trim() === 'detached') detached = true
      else if (line === 'locked' || line.startsWith('locked ')) {
        locked = true
        lockReason = line === 'locked' ? null : line.slice('locked '.length).trim()
      } else if (line === 'prunable' || line.startsWith('prunable ')) {
        prunable = true
        prunableReason = line === 'prunable' ? null : line.slice('prunable '.length).trim()
      }
    }
    if (wtPath) worktrees.push({ path: wtPath, sha, branch: detached ? null : branch, detached, locked, lockReason, prunable, prunableReason })
  }
  return worktrees
}

/**
 * `git status --porcelain` split into entries, ignoring nothing by
 * default — callers apply the tsconfig.tsbuildinfo advisory exemption
 * themselves so the exemption stays visible and testable at the call site.
 * Returns `null` on a git failure (worktree not a valid checkout).
 */
export function dirtyEntries(cwd) {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[MADRCU?! ]{1,2}\s+/, ''))
}

/** True when two filesystem paths refer to the same location (resolves relative/./.. noise). */
export function samePath(a, b) {
  if (!a || !b) return false
  return canonicalize(a) === canonicalize(b)
}
