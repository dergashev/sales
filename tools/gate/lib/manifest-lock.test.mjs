// tools/gate/lib/manifest-lock.test.mjs

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { withManifestLock } from './manifest-lock.mjs'

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
})
