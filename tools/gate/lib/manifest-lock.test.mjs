// tools/gate/lib/manifest-lock.test.mjs

import { spawn } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { hostname } from 'node:os'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { withManifestLock } from './manifest-lock.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RACE_VICTIM = path.join(HERE, 'test-fixtures', 'lock-race-victim.mjs')
const RACE_INTRUDER = path.join(HERE, 'test-fixtures', 'lock-race-intruder.mjs')

/** Spawn a real, separate node process and resolve when it exits 0 (reject otherwise). */
function runChild(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${scriptPath} ${args.join(' ')} exited ${code}`))))
  })
}

let tmpRoot
let manifestPath
let lockPath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-gate-manifest-lock-'))
  manifestPath = path.join(tmpRoot, 'a3', 'validation-candidates.json')
  lockPath = `${manifestPath}.lock`
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('withManifestLock', () => {
  it('creates the a3/ directory, runs fn exactly once, and returns its value', () => {
    let calls = 0
    const result = withManifestLock(manifestPath, () => {
      calls += 1
      return 'critical-section-ran'
    })
    expect(result).toBe('critical-section-ran')
    expect(calls).toBe(1)
  })

  it('releases the lock after a successful run: no lock file left behind', () => {
    withManifestLock(manifestPath, () => 'ok')
    expect(existsSync(lockPath)).toBe(false)
  })

  it('releases the lock after fn throws, and re-throws fn\'s error', () => {
    expect(() =>
      withManifestLock(manifestPath, () => {
        throw new Error('boom from critical section')
      }),
    ).toThrow('boom from critical section')
    expect(existsSync(lockPath)).toBe(false)
  })

  it('leaves no stray files in a3/ besides the manifest itself after use', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    withManifestLock(manifestPath, () => {
      writeFileSync(manifestPath, '{}\n', 'utf8')
    })
    expect(readdirSync(path.dirname(manifestPath))).toEqual(['validation-candidates.json'])
  })

  it('steals a lock whose owner pid is dead on the SAME host, and the critical section still runs', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    // A pid essentially guaranteed not to exist in this test's pid space.
    const deadPid = 999_999
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: deadPid, host: hostname(), startedAt: new Date().toISOString(), nonce: 'zombie' }),
    )
    const result = withManifestLock(manifestPath, () => 'ran-after-steal', { timeoutMs: 3000 })
    expect(result).toBe('ran-after-steal')
    expect(existsSync(lockPath)).toBe(false) // released by us after the run
  })

  it('reclaims a foreign-host lock only once it is old enough to be considered abandoned', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    const longAgo = new Date(Date.now() - 20 * 60_000).toISOString() // 20 minutes ago
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: 42, host: 'some-other-machine', startedAt: longAgo, nonce: 'foreign-stale' }),
    )
    const result = withManifestLock(manifestPath, () => 'ran-after-foreign-steal', { timeoutMs: 3000 })
    expect(result).toBe('ran-after-foreign-steal')
  })

  it('does NOT steal a live lock (alive pid, same host): acquisition throws, foreign lock survives, fn never runs', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    // process.pid is guaranteed alive for the duration of this test.
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, host: hostname(), startedAt: new Date().toISOString(), nonce: 'someone-else' }),
    )
    let ran = false
    expect(() =>
      withManifestLock(
        manifestPath,
        () => {
          ran = true
        },
        { timeoutMs: 300 },
      ),
    ).toThrow(/Could not acquire candidate manifest lock/)
    expect(ran).toBe(false)
    expect(existsSync(lockPath)).toBe(true)
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).nonce).toBe('someone-else')
  })

  it('does NOT reclaim a recent foreign-host lock: acquisition throws and the lock is untouched', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: 42, host: 'some-other-machine', startedAt: new Date().toISOString(), nonce: 'foreign-fresh' }),
    )
    expect(() => withManifestLock(manifestPath, () => 'should not run', { timeoutMs: 300 })).toThrow(
      /Could not acquire candidate manifest lock/,
    )
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).nonce).toBe('foreign-fresh')
  })

  it('never releases a lock it does not own (nonce mismatch), even if the path looks the same', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    // Simulate: our lock is legitimately held, but by the time we try to
    // release, a DIFFERENT lock (different nonce) now occupies the path
    // — must not happen under correct single-owner use, but the release
    // logic must still refuse to blindly unlink whatever is there.
    let sawDuringRun
    withManifestLock(manifestPath, () => {
      sawDuringRun = existsSync(lockPath)
      // Overwrite with a foreign owner's lock content before we return,
      // to prove release checks the nonce rather than trusting the path.
      writeFileSync(lockPath, JSON.stringify({ pid: 1, host: 'x', startedAt: new Date().toISOString(), nonce: 'intruder' }))
    })
    expect(sawDuringRun).toBe(true)
    // Our release logic saw a mismatched nonce and correctly left the file.
    expect(existsSync(lockPath)).toBe(true)
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).nonce).toBe('intruder')
  })

  // -------------------------------------------------------------------------
  // Tech Review P1: writeFileSync(lockPath, json, {flag:'wx'}) is two
  // syscalls (open(O_CREAT|O_EXCL), then write()). Between them the lock
  // file exists but is empty/unparseable. The OLD code treated that as
  // "owner unknown -> steal now", which let a contender rename away a
  // LIVE owner's lock mid-write - reproduced with two real processes.
  // These tests pin the fix: a FRESH unparseable lock must be refused,
  // an AGED one (writer that died before ever writing its owner data)
  // must still be recoverable, and the real two-process race must no
  // longer let the intruder in.
  // -------------------------------------------------------------------------

  it('P1 regression: a FRESH zero-length lock file (open()..write() window) is NOT stolen', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(lockPath, '') // exactly what open(O_CREAT|O_EXCL) alone produces
    let ran = false
    expect(() =>
      withManifestLock(manifestPath, () => { ran = true }, { timeoutMs: 300 }),
    ).toThrow(/Could not acquire candidate manifest lock/)
    expect(ran).toBe(false)
    expect(existsSync(lockPath)).toBe(true) // untouched, not stolen
  })

  it('P1 regression: a FRESH truncated-JSON lock file is NOT stolen', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(lockPath, '{"pid":123,"host":"' + hostname()) // partial write, invalid JSON
    let ran = false
    expect(() =>
      withManifestLock(manifestPath, () => { ran = true }, { timeoutMs: 300 }),
    ).toThrow(/Could not acquire candidate manifest lock/)
    expect(ran).toBe(false)
  })

  it('an AGED unparseable lock (writer died before ever writing owner data) IS still reclaimed', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(lockPath, '') // same as a fresh one, but...
    const longAgo = new Date(Date.now() - 60_000) // ...backdated well past the grace period
    utimesSync(lockPath, longAgo, longAgo)
    const result = withManifestLock(manifestPath, () => 'ran-after-aged-steal', { timeoutMs: 3000 })
    expect(result).toBe('ran-after-aged-steal')
    expect(existsSync(lockPath)).toBe(false) // released by us after the run
  })

  it('P2 regression: a foreign-host lock with an unparseable startedAt is NOT stolen immediately', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: 42, host: 'some-other-machine', startedAt: 'not-a-date', nonce: 'foreign-malformed' }),
    )
    expect(() => withManifestLock(manifestPath, () => 'should not run', { timeoutMs: 300 })).toThrow(
      /Could not acquire candidate manifest lock/,
    )
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).nonce).toBe('foreign-malformed')
  })

  it('P1 regression, real two-process race: intruder never enters while the victim holds the lock, even mid-write', async () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true }) // openSync(lockPath,'wx') needs a3/ to exist
    const logPath = path.join(tmpRoot, 'race.log')
    // Victim: opens the lock (wx), then sleeps 300ms BEFORE writing its
    // owner JSON - deliberately widening the real open()..write() window
    // from microseconds to something an intruder can land inside.
    const victim = runChild(RACE_VICTIM, [lockPath, logPath, '300', '150'])
    // Intruder: starts 100ms in, squarely inside the victim's open..write
    // window, and tries to acquire for up to 5s (long enough to observe
    // the victim's full lifecycle: open -> write-owner -> release).
    const intruder = runChild(RACE_INTRUDER, [manifestPath, logPath, '100', '5000'])
    await Promise.all([victim, intruder])

    const events = readFileSync(logPath, 'utf8').trim().split('\n')
    const openedIdx = events.indexOf('victim:opened')
    const releasedIdx = events.indexOf('victim:released')
    const enteredIdx = events.indexOf('intruder:entered')
    expect(openedIdx).toBeGreaterThanOrEqual(0)
    expect(releasedIdx).toBeGreaterThan(openedIdx)
    expect(enteredIdx).toBeGreaterThan(-1) // it must eventually get in...
    expect(enteredIdx).toBeGreaterThan(releasedIdx) // ...but only AFTER the victim released, never during
  })
})
