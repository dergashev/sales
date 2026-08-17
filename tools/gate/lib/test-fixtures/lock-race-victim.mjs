// tools/gate/lib/test-fixtures/lock-race-victim.mjs
//
// Spawned as a REAL, separate OS process by manifest-lock.test.mjs's P1
// regression test. Reproduces the exact two-syscall shape of
// `writeFileSync(lockPath, json, {flag:'wx'})` at the LOW level
// (openSync -> sleep -> writeSync -> closeSync), so the gap between
// "lock file exists" and "owner metadata is readable" is widened from
// microseconds to a controllable delay an intruder process can land
// inside. Logs each lifecycle event to a shared file so the test can
// assert ordering across both real processes.
//
// argv: lockPath logPath openToWriteDelayMs holdAfterWriteDelayMs

import { appendFileSync, closeSync, openSync, unlinkSync, writeSync } from 'node:fs'
import { hostname } from 'node:os'

const [, , lockPath, logPath, openToWriteDelayMs, holdAfterWriteDelayMs] = process.argv

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
function log(line) {
  appendFileSync(logPath, `${line}\n`)
}

const fd = openSync(lockPath, 'wx') // step 1 of writeFileSync(...,{flag:'wx'}): O_CREAT|O_EXCL only
log('victim:opened')

sleepSync(Number(openToWriteDelayMs)) // the widened open()..write() window

writeSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), startedAt: new Date().toISOString(), nonce: 'victim' }))
closeSync(fd)
log('victim:wrote-owner')

sleepSync(Number(holdAfterWriteDelayMs)) // still "inside the critical section"

unlinkSync(lockPath) // release
log('victim:released')
