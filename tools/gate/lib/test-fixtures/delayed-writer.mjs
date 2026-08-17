// tools/gate/lib/test-fixtures/delayed-writer.mjs
//
// Deterministic lost-update regression fixture.
//
// The natural race is nondeterministic: measured 11/12 trials losing a
// declaration with NO artificial delay, i.e. only ~92% reproducible. A
// naive "spawn 3 concurrent declares, assert 3 survive" test would
// therefore pass roughly 1 time in 12 against the OLD, broken
// implementation — a flaky-green regression test, which ticket §12
// explicitly forbids.
//
// This fixture composes the SAME exported production primitives
// `declareCandidate` is built from (`readManifest`, `writeManifestAtomic`,
// `withManifestLock`) with an explicit delay placed INSIDE the
// read-modify-write window, widening the race's timing window to 100%
// reproducible in both directions. No test-only hook exists in
// production code (manifest.mjs / manifest-lock.mjs are unmodified for
// this purpose) — this fixture is simply another caller of their public,
// already-exported API, exactly like declare-candidate.mjs is.
//
// argv: mode(locked|unlocked) manifestPath lane sha delayMs

import { readManifest, writeManifestAtomic } from '../manifest.mjs'
import { withManifestLock } from '../manifest-lock.mjs'

const [, , mode, manifestPath, lane, sha, delayMs] = process.argv

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function criticalSection() {
  const manifest = readManifest(manifestPath)
  sleepSync(Number(delayMs)) // widen the read..write gap so 2+ processes provably overlap inside it
  manifest[lane] = { sha, worktree: `/wt/${lane}` }
  writeManifestAtomic(manifestPath, manifest)
}

if (mode === 'locked') {
  withManifestLock(manifestPath, criticalSection)
} else if (mode === 'unlocked') {
  criticalSection() // the OLD (pre-fix) shape: read/mutate/write with no coordination at all
} else {
  throw new Error(`Unknown mode "${mode}", expected "locked" or "unlocked".`)
}
