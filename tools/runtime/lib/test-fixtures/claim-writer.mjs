// tools/runtime/lib/test-fixtures/claim-writer.mjs
//
// Spawned as a REAL, separate OS process by registry.concurrency.test.mjs
// (ticket scenario H: "two concurrent requests attempt CURRENT_MAIN
// startup ... no lost registry writes, no dual authority"), so that test
// exercises actual cross-process file contention, not mocked/sequential
// in-process calls. Calls the exact shipped `putRuntimeClaim` — no
// test-only branching, no shortcuts. A small delay is placed between
// reading this process's own pid and writing, widening the race window
// the same way tools/gate/lib/test-fixtures/delayed-writer.mjs does for
// the candidate manifest's own regression fixture.
//
// argv: registryPath id sha delayMs

import { putRuntimeClaim } from '../registry.mjs'

const [, , registryPath, id, sha, delayMs] = process.argv

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

sleepSync(Number(delayMs) || 0)
putRuntimeClaim(registryPath, id, {
  purpose: 'CURRENT_MAIN',
  sha,
  worktree: '/preview/main',
  pid: process.pid,
  port: 5000,
  url: 'http://127.0.0.1:5000',
  nonce: `nonce-${process.pid}`,
  startedAt: new Date().toISOString(),
})
