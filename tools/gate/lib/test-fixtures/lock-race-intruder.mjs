// tools/gate/lib/test-fixtures/lock-race-intruder.mjs
//
// Spawned as a REAL, separate OS process alongside lock-race-victim.mjs.
// Deliberately starts partway into the victim's open()..write() window
// and attempts to acquire the SAME lock via the real, shipped
// `withManifestLock` - proving the fix refuses entry while the victim
// holds the lock (even mid-write) and only lets the intruder in once the
// victim has genuinely released.
//
// argv: manifestPath logPath startDelayMs timeoutMs

import { appendFileSync } from 'node:fs'
import { withManifestLock } from '../manifest-lock.mjs'

const [, , manifestPath, logPath, startDelayMs, timeoutMs] = process.argv

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
function log(line) {
  appendFileSync(logPath, `${line}\n`)
}

sleepSync(Number(startDelayMs))

withManifestLock(
  manifestPath,
  () => {
    log('intruder:entered')
  },
  { timeoutMs: Number(timeoutMs) },
)
