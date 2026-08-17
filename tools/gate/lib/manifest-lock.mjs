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

import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
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

// `writeFileSync(lockPath, json, {flag:'wx'})` is NOT one atomic step: the
// underlying open(O_CREAT|O_EXCL) creates a zero-length file, and only the
// following write() fills in the owner JSON. Between those two syscalls the
// lock file exists but `readOwner` returns null (empty/unparseable). That
// window is normally microseconds, but a contender arriving inside it must
// NOT treat "owner unknown" as "owner dead" - Tech Review reproduced a real
// two-process steal-from-a-live-owner by widening this exact window. An
// unparseable lock is therefore only ever reclaimed once it has existed
// for at least this long - far longer than any real open..write gap, far
// shorter than a lock whose writer genuinely died before ever writing its
// owner metadata (which must still be recoverable, or a single crashed
// writer bricks validation forever).
const UNPARSEABLE_LOCK_GRACE_MS = 2000

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
 * Try to steal a lock file whose owner is provably dead (or, for an
 * unparseable owner, whose lock file has existed long enough that "still
 * being written by its creator" is no longer a plausible explanation -
 * see UNPARSEABLE_LOCK_GRACE_MS). Uses `renameSync` (atomic) to a unique
 * graveyard name so that if two processes race to steal the same stale
 * lock, exactly one rename wins and the loser's rename throws (ENOENT,
 * the source is already gone) — it simply retries the acquire loop
 * rather than deleting a lock a concurrent stealer just legitimately
 * re-created.
 */
function tryStealStaleLock(lockPath) {
  const owner = readOwner(lockPath)
  if (owner !== null) {
    if (ownerIsAlive(owner)) return false
    // A known owner that is provably dead (same-host pid probe failed, or
    // a sufficiently old foreign-host timestamp) can be reclaimed
    // immediately - there is no ambiguity left to wait out.
  } else if (lockFileAgeMs(lockPath) < UNPARSEABLE_LOCK_GRACE_MS) {
    // Owner missing/unreadable/mid-write AND the lock file is still
    // young: this is exactly the open()..write() window, not an
    // abandoned lock. Refuse to steal - the acquire loop will retry
    // shortly, by which point the real owner should have finished
    // writing (and this path will correctly see a live owner instead).
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
    try {
      // O_CREAT|O_EXCL: atomic "create if absent", the actual mutex primitive.
      writeFileSync(lockPath, JSON.stringify(owner), { flag: 'wx' })
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
