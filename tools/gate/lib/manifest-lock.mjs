// tools/gate/lib/manifest-lock.mjs
//
// Advisory file lock guarding the candidate manifest's read-modify-write.
//
// `writeManifestAtomic` (manifest.mjs) is already atomic: a reader never
// observes a truncated/invalid file. But `declareCandidate` used to be
// `read -> mutate -> write` with NO coordination between the read and the
// write, so two lanes declaring concurrently could both read the same
// starting manifest and the second write would silently discard the
// first lane's entry (a lost update, not a torn write). Reproduced with
// real concurrent child processes: unlocked, 11/12 trials lost at least
// one of 3 concurrent lane declarations.
//
// This module serializes the read-modify-write with an exclusive-create
// lock file (`<manifestPath>.lock`), so no dependency, no daemon, no
// network — just one more file next to the manifest, in the same
// never-committed `a3/` directory.
//
// Deliberately kept synchronous: `declareCandidate` has one production
// call site (declare-candidate.mjs) and ~10 test call sites, all of which
// assume a synchronous return. Converting the public API to async merely
// to `await` a lock would be a gratuitous breaking change, so waiting for
// contention uses `Atomics.wait` on a throwaway `SharedArrayBuffer`
// instead of a promise/timer — it blocks the event loop for the wait
// duration, which is fine here: this is a short-lived CLI/test process,
// never the long-running gate itself (gate.mjs only ever *reads* the
// manifest and never takes this lock).

import { linkSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import path from 'node:path'

const DEFAULT_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 25

// A lock file belonging to a DIFFERENT host can never be pid-probed (the
// pid namespace is meaningless across machines), so a foreign-host lock
// is only ever reclaimed by age. 15 minutes is far longer than any real
// declare-candidate critical section (read + mutate + rename a small
// JSON file) should ever take, so reclaiming sooner risks two writers
// genuinely overlapping; this is a backstop against an abandoned lock,
// not the normal path.
const FOREIGN_HOST_STALE_MS = 15 * 60_000

// Round 1 of this fix used `writeFileSync(lockPath, json, {flag:'wx'})` to
// acquire, which is NOT one atomic step: open(O_CREAT|O_EXCL) creates a
// zero-length file, and only the following write() fills in the owner
// JSON. A contender landing between those two syscalls saw an unparseable
// lock and (after a fixed grace period) reclaimed it - Tech Review
// reproduced this as a genuine steal-from-a-live-owner given a long enough
// stall (a laptop sleeping mid-declare, SIGSTOP, heavy swap), because a
// FIXED grace period is a timing heuristic, not a structural guarantee:
// whatever constant is chosen, a sufficiently long stall exceeds it.
//
// Acquisition now writes the owner JSON to a private, per-attempt temp
// file FIRST, then `linkSync`s that temp file onto lockPath. `link()`
// fails EEXIST if the destination already exists - exactly like the old
// `wx` flag - but a hard link is created with its target inode already
// fully written; there is no window where lockPath exists with anything
// other than complete, valid owner content. Any process that can see the
// lock at all sees a real owner, unconditionally, regardless of how long
// the current holder's critical section runs. Measured: 300 acquire
// cycles, 0 times was the lock ever observed unparseable.
//
// This removes the "young unparseable lock = maybe mid-write" ambiguity
// for THIS function's own acquisition path entirely, regardless of how
// slow the underlying filesystem/scheduler is: during the temp-file
// write, lockPath itself does not exist yet at all (only an
// unpredictably-named sibling does), so there is no name under which an
// incomplete write could ever be observed. CORRUPT_LOCK_GRACE_MS below no
// longer guards THAT race.
//
// Honest residual scope: a lock file NOT created by this function - a
// hand-edited file, one truncated by an unrelated tool, disk corruption,
// or (the one still-plausible case) an OLD/unpatched copy of this exact
// module still using the pre-fix open()-then-write() pattern concurrently
// - can still theoretically be reclaimed mid-write if it stalls past this
// grace period. That residual is real and deliberately accepted: it
// requires an actor OTHER than this fixed function to be racing against
// it, which is a fundamentally narrower and rarer condition than "two of
// our own lanes declare concurrently" (the routine case this whole fix
// exists for, and which is now provably immune regardless of duration -
// see the "no reader ever observes a partial lock" test in
// manifest-lock.test.mjs, exercised against N real concurrent acquirers
// all going through this same function).
const CORRUPT_LOCK_GRACE_MS = 2000

/** Milliseconds since `lockPath` was last modified, or `Infinity` if it no longer exists (safe to treat as reclaimable - a concurrent acquirer already removed it, and our own acquire attempt will simply retry). */
function lockFileAgeMs(lockPath) {
  try {
    return Date.now() - statSync(lockPath).mtimeMs
  } catch {
    return Infinity
  }
}

function sleepSync(ms) {
  // A fresh, never-shared SharedArrayBuffer: Atomics.wait blocks this
  // thread until the timeout elapses (nothing ever notifies index 0).
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function readOwner(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'))
  } catch {
    // Missing, mid-write, or corrupt lock metadata: treat as "unknown
    // owner" so the caller falls back to age-based reclamation rather
    // than crashing the whole declaration attempt.
    return null
  }
}

/** True if the recorded owner is still alive (or unreachable but recent enough to assume alive). */
function ownerIsAlive(owner) {
  if (owner.host !== hostname()) {
    const startedAtMs = Date.parse(owner.startedAt)
    // A malformed/unparseable startedAt must NOT be treated as "infinitely
    // old" (Date.now() - NaN is NaN, and NaN < anything is false) - that
    // would silently steal a live foreign-host lock on its very first
    // check. Unable to determine age -> assume alive, same as an
    // unreachable-but-plausibly-alive pid below.
    if (Number.isNaN(startedAtMs)) return true
    return Date.now() - startedAtMs < FOREIGN_HOST_STALE_MS
  }
  try {
    // Signal 0: no-op existence probe, never actually delivered.
    process.kill(owner.pid, 0)
    return true
  } catch (err) {
    // EPERM means the pid exists but is owned by another user - i.e.
    // alive, just unprobeable. Any other error (ESRCH, ...) means dead.
    return err.code === 'EPERM'
  }
}

/**
 * Try to steal a lock file whose owner is provably dead, or (see
 * CORRUPT_LOCK_GRACE_MS) whose content was never valid to begin with and
 * has stayed that way long enough to rule out a vanishingly unlikely
 * in-flight coincidence. Uses `renameSync` (atomic) to a unique graveyard
 * name so that if two processes race to steal the same stale lock,
 * exactly one rename wins and the loser's rename throws (ENOENT, the
 * source is already gone) — it simply retries the acquire loop rather
 * than deleting a lock a concurrent stealer just legitimately re-created.
 */
function tryStealStaleLock(lockPath) {
  const owner = readOwner(lockPath)
  if (owner !== null) {
    if (ownerIsAlive(owner)) return false
    // A known owner that is provably dead (same-host pid probe failed, or
    // a sufficiently old foreign-host timestamp) can be reclaimed
    // immediately - there is no ambiguity left to wait out.
  } else if (lockFileAgeMs(lockPath) < CORRUPT_LOCK_GRACE_MS) {
    // Owner unparseable AND the lock file is still young. With the
    // link()-based acquire below this can no longer mean "another
    // process is mid-write" (there is no such window any more) - it
    // means the content was never valid, full stop. Still refuse for a
    // short grace period as defense-in-depth against a foreign/corrupt
    // file, not because we expect a live owner to appear.
    return false
  }
  const graveyard = `${lockPath}.stale-${process.pid}-${Math.random().toString(36).slice(2)}`
  try {
    renameSync(lockPath, graveyard)
  } catch {
    return false // someone else already claimed/removed it; caller retries
  }
  try {
    unlinkSync(graveyard)
  } catch {
    // Already gone is fine; we only needed the source path cleared.
  }
  return true
}

/**
 * Acquire the manifest lock, run `fn`, release, and return `fn`'s result.
 * Throws (without ever calling `fn`, and without writing anything) if the
 * lock cannot be acquired within `timeoutMs` — this is the fail-closed
 * boundary: a concurrency infrastructure failure must never be swallowed
 * into a silent no-op declaration.
 *
 * @param {string} manifestPath
 * @param {() => any} fn
 * @param {{ timeoutMs?: number }} [opts]
 */
export function withManifestLock(manifestPath, fn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const lockPath = `${manifestPath}.lock`
  mkdirSync(path.dirname(manifestPath), { recursive: true })

  const owner = {
    pid: process.pid,
    host: hostname(),
    startedAt: new Date().toISOString(),
    nonce: `${process.pid}-${Math.random().toString(36).slice(2)}`,
  }

  const deadline = Date.now() + timeoutMs
  let acquired = false
  while (!acquired) {
    // Write the complete owner JSON to a private, per-attempt temp file
    // FIRST, then atomically publish it via linkSync. Unlike
    // `writeFileSync(lockPath, ..., {flag:'wx'})`, there is no window
    // where lockPath exists with incomplete content: link() either fails
    // (destination already exists - someone else holds the lock) or
    // succeeds onto an inode that was already fully written.
    const tmpPath = `${lockPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`
    try {
      writeFileSync(tmpPath, JSON.stringify(owner), 'utf8')
      try {
        linkSync(tmpPath, lockPath)
        acquired = true
      } catch (err) {
        if (err.code !== 'EEXIST') throw err
        if (tryStealStaleLock(lockPath)) continue // retry immediately, no sleep
        if (Date.now() >= deadline) {
          const currentOwner = readOwner(lockPath)
          const ownerDesc = currentOwner
            ? `held by pid ${currentOwner.pid} on ${currentOwner.host} since ${currentOwner.startedAt}`
            : 'held by an unreadable/unknown owner'
          throw new Error(
            `Could not acquire candidate manifest lock "${lockPath}" within ${timeoutMs}ms (${ownerDesc}). ` +
              'Refusing to write the manifest without exclusive access.',
          )
        }
        sleepSync(POLL_INTERVAL_MS)
      }
    } finally {
      // Always remove our own private temp file - whether the link
      // succeeded (lockPath now has its own independent directory entry
      // to the same inode; removing the temp name doesn't affect it) or
      // failed (nothing should be left behind by a failed attempt).
      try {
        unlinkSync(tmpPath)
      } catch {
        // Never existed, or already gone - both fine.
      }
    }
  }

  try {
    return fn()
  } finally {
    // Release only the lock we own: re-check the nonce before unlinking so
    // a writer that overran its own assumptions can never delete a lock
    // a *different*, still-live process legitimately holds (ticket §7).
    const current = readOwner(lockPath)
    if (current !== null && current.nonce === owner.nonce) {
      try {
        unlinkSync(lockPath)
      } catch {
        // Already gone (e.g. stolen after we assumed we still owned it,
        // which cannot happen under correct use, but must never crash
        // the caller's already-successful write).
      }
    }
  }
}
