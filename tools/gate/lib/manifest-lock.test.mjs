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
const HOLD_VICTIM = path.join(HERE, 'test-fixtures', 'lock-hold-victim.mjs')

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
  // Tech Review P1, round 1: writeFileSync(lockPath, json, {flag:'wx'}) was
  // two syscalls (open(O_CREAT|O_EXCL), then write()). Between them the
  // lock file existed but was empty/unparseable, and the round-1 fix
  // reclaimed an unparseable lock after a FIXED grace period - which Tech
  // Review then reproduced as a genuine steal-from-a-live-owner given a
  // long enough stall (see the round-2 test below): a fixed timeout is a
  // heuristic, not a structural guarantee.
  //
  // Round 2 replaced the acquire mechanism itself: the owner JSON is now
  // written to a private temp file first, then published via linkSync,
  // so a live owner's lock ALWAYS has complete, valid content from the
  // instant it exists - there is no more "maybe mid-write" ambiguity for
  // OUR OWN acquire path to reason about. The tests below now describe:
  // (a) a lock file that is unparseable for a reason OTHER than our own
  //     acquire path (hand-planted, or a foreign/legacy raw-open lock) is
  //     still handled sanely - refused while young, reclaimed once aged;
  // (b) the actual promise this round-2 fix makes: an arbitrarily long
  //     REAL critical section, held through the shipped withManifestLock
  //     itself, is NEVER preempted - no fixed constant to exceed.
  // -------------------------------------------------------------------------

  it('a FRESH zero-length/corrupt lock file (not one we created) is NOT stolen', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(lockPath, '') // e.g. hand-planted, or a leftover from an unrelated tool
    let ran = false
    expect(() =>
      withManifestLock(manifestPath, () => { ran = true }, { timeoutMs: 300 }),
    ).toThrow(/Could not acquire candidate manifest lock/)
    expect(ran).toBe(false)
    expect(existsSync(lockPath)).toBe(true) // untouched, not stolen
  })

  it('a FRESH truncated-JSON lock file (not one we created) is NOT stolen', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(lockPath, '{"pid":123,"host":"' + hostname()) // partial/corrupt content, invalid JSON
    let ran = false
    expect(() =>
      withManifestLock(manifestPath, () => { ran = true }, { timeoutMs: 300 }),
    ).toThrow(/Could not acquire candidate manifest lock/)
    expect(ran).toBe(false)
  })

  it('an AGED unparseable lock (corrupt/abandoned, never a live owner) IS still reclaimed', () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    writeFileSync(lockPath, '') // same content as fresh, but...
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

  it('a foreign/legacy raw two-step lock (open-then-later-write, not our own acquire path) is NOT stolen while young', async () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true }) // openSync(lockPath,'wx') needs a3/ to exist
    const logPath = path.join(tmpRoot, 'race.log')
    // Victim: opens the lock with the OLD raw two-step shape (open, sleep,
    // THEN write owner JSON) - not how our own code acquires any more, but
    // exactly what a legacy/foreign lock-holder could still look like.
    const victim = runChild(RACE_VICTIM, [lockPath, logPath, '300', '150'])
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

  it('an arbitrarily long REAL critical section (via the shipped withManifestLock itself) is correctly waited out, never stolen', async () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    const logPath = path.join(tmpRoot, 'hold.log')
    // Note on scope: this proves a concurrent acquirer correctly WAITS for
    // release no matter how long the holder's fn() runs - which was never
    // actually the vulnerable window in round 1 either (writeFileSync's
    // internal open+write execute back-to-back with no observable gap in
    // real, non-artificially-delayed usage; ownerIsAlive already handled
    // "the pid is alive, so wait" correctly regardless of duration). It is
    // a real guarantee worth pinning, but it is NOT the P1 regression -
    // see the two tests below for that.
    const HOLD_MS = 3000
    const victim = runChild(HOLD_VICTIM, [manifestPath, logPath, String(HOLD_MS)])
    const intruder = runChild(RACE_INTRUDER, [manifestPath, logPath, '200', '8000'])
    await Promise.all([victim, intruder])

    const events = readFileSync(logPath, 'utf8').trim().split('\n')
    const enteredIdx = events.indexOf('victim:entered')
    const releasedIdx = events.indexOf('victim:released')
    const intruderIdx = events.indexOf('intruder:entered')
    expect(enteredIdx).toBeGreaterThanOrEqual(0)
    expect(releasedIdx).toBeGreaterThan(enteredIdx)
    expect(intruderIdx).toBeGreaterThan(-1)
    expect(intruderIdx).toBeGreaterThan(releasedIdx)
  })

  it('P1, round 2: no reader/acquirer EVER observes a partial lock file across many real concurrent acquisitions (the actual guarantee this fix makes)', async () => {
    mkdirSync(path.dirname(manifestPath), { recursive: true })
    const ACQUIRERS = 8
    const pollErrors = []
    let observations = 0
    let stop = false
    const pollLoop = (async () => {
      while (!stop) {
        try {
          JSON.parse(readFileSync(lockPath, 'utf8')) // ENOENT (missing) is fine; a parse failure means we saw a NAME with incomplete/invalid content, which must never happen
          observations += 1
        } catch (err) {
          if (err.code !== 'ENOENT') pollErrors.push(err.message)
        }
        await new Promise((r) => setTimeout(r, 1))
      }
    })()

    // Real separate processes, each acquiring/releasing repeatedly, all
    // through the exact shipped withManifestLock - the mechanism whose
    // structural guarantee (content-complete-before-visible) this test
    // exists to pin down.
    const runAcquirer = (idx) =>
      runChild(HOLD_VICTIM, [manifestPath, path.join(tmpRoot, `acquirer-${idx}.log`), '20'])
    await Promise.all(Array.from({ length: ACQUIRERS }, (_, i) => runAcquirer(i)))

    stop = true
    await pollLoop

    expect(pollErrors).toEqual([]) // <-- the actual P1 guarantee: never an unparseable read while a live acquirer holds it
    expect(observations).toBeGreaterThan(0) // the poll loop actually raced against real acquisitions
  })
})
