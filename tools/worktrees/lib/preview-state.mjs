// tools/worktrees/lib/preview-state.mjs
//
// Tiny, never-committed JSON record of the canonical local-`main` preview's
// last-known state, so `npm run git:worktrees:check` can report "preview is
// pinned to <sha>, main has since advanced to <sha>" without re-deriving it
// from scratch, and so a second concurrent `npm run dev:main` cannot lose an
// update to the first (same lost-update hazard the exact-candidate manifest
// already solved).
//
// Deliberately reuses tools/gate/lib/manifest.mjs's atomic JSON read/write
// and tools/gate/lib/manifest-lock.mjs's exclusive lock rather than
// re-implementing either — this is the same "one JSON file inside the git
// COMMON dir's never-committed a3/ directory, guarded by a lock file next
// to it" shape as the candidate manifest, just a different filename and a
// single record instead of one entry per lane.

import path from 'node:path'
import { readManifest, writeManifestAtomic } from '../../gate/lib/manifest.mjs'
import { withManifestLock } from '../../gate/lib/manifest-lock.mjs'

export function defaultPreviewStatePath(gitCommonDir) {
  return path.join(gitCommonDir, 'a3', 'preview-state.json')
}

/** Reads the current preview state. Missing file -> `null` (never previewed yet). */
export function readPreviewState(statePath) {
  const raw = readManifest(statePath)
  return Object.keys(raw).length === 0 ? null : raw
}

/**
 * Lock, read, let `mutateFn` compute the next full record from the current
 * one (or `null`), write atomically, unlock. Returns the new record.
 *
 * Only for a single, self-contained read-mutate-write. NEVER call this (or
 * anything else that takes the same lock) from inside a `withPreviewStateLock`
 * callback for the SAME statePath — the lock is not re-entrant, and a nested
 * acquisition attempt by the same process will spin until it times out
 * (indistinguishable from a real deadlock from the caller's point of view).
 *
 * @param {string} statePath
 * @param {(current: object|null) => object} mutateFn
 */
export function updatePreviewState(statePath, mutateFn) {
  return withManifestLock(statePath, () => {
    const current = readPreviewState(statePath)
    const next = mutateFn(current)
    writeManifestAtomic(statePath, next)
    return next
  })
}

/**
 * Holds the SAME lock `updatePreviewState` uses, for a multi-step critical
 * section (e.g. dev:main's "check for a live owner, then mutate the git
 * checkout, then record the new state" sequence) that must not be split
 * across separate lock acquisitions — a second `dev:main` could otherwise
 * interleave between separate small locked steps and observe/mutate the
 * same preview worktree concurrently.
 *
 * Inside `fn`, use `readPreviewState` (lock-free) to read and
 * `writePreviewStateRaw` (lock-free) to write — never `updatePreviewState`.
 *
 * @param {string} statePath
 * @param {() => any} fn
 */
export function withPreviewStateLock(statePath, fn) {
  return withManifestLock(statePath, fn)
}

/**
 * Writes the full state record without acquiring any lock. Only safe to call
 * from inside a `withPreviewStateLock` callback, which already holds it.
 *
 * @param {string} statePath
 * @param {object} record
 */
export function writePreviewStateRaw(statePath, record) {
  writeManifestAtomic(statePath, record)
}
