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

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
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
    return Date.now() - Date.parse(owner.startedAt) < FOREIGN_HOST_STALE_MS
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
 * Try to steal a lock file whose owner is provably dead. Uses
 * `renameSync` (atomic) to a unique graveyard name so that if two
 * processes race to steal the same stale lock, exactly one rename wins
 * and the loser's rename throws (ENOENT, the source is already gone) —
 * it simply retries the acquire loop rather than deleting a lock a
 * concurrent stealer just legitimately re-created.
 */
function tryStealStaleLock(lockPath) {
  const owner = readOwner(lockPath)
  if (owner !== null && ownerIsAlive(owner)) return false
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
