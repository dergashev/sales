// tools/gate/lib/test-fixtures/lock-hold-victim.mjs
//
// Spawned as a REAL, separate OS process. Holds the REAL manifest lock,
// through the shipped `withManifestLock` itself (no simulated raw
// open/write), for a controllable `holdMs` - simulating an arbitrarily
// long real critical section. This is the exact class of stall Tech
// Review showed could exceed a FIXED grace period in round 1 of the P1
// fix; round 2 (atomic link()-based acquire) is not supposed to have any
// such ceiling, so this fixture is used with `holdMs` deliberately set
// longer than the old grace constant to prove that.
//
// argv: manifestPath logPath holdMs

import { appendFileSync } from 'node:fs'
import { withManifestLock } from '../manifest-lock.mjs'

const [, , manifestPath, logPath, holdMs] = process.argv

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
function log(line) {
  appendFileSync(logPath, `${line}\n`)
}

withManifestLock(manifestPath, () => {
  log('victim:entered')
  sleepSync(Number(holdMs))
  log('victim:about-to-release')
})
log('victim:released')
