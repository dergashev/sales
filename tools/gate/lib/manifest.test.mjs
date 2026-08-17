// tools/gate/lib/manifest.test.mjs

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as manifestLock from './manifest-lock.mjs'
import { declareCandidate, defaultManifestPath, readManifest, writeManifestAtomic } from './manifest.mjs'

// Spies on the REAL withManifestLock (passes through via `actual`) so this
// file can assert declareCandidate is wired to it, deterministically and
// without depending on race timing. This is what catches a regression like
// "declareCandidate stops calling withManifestLock" on every single run,
// complementing the real-process tests below (which are demonstrably able
// to catch the same regression, but only ~92% of the time per the
// Architecture handoff's measurement — see the DETERMINISTIC fixture test).
vi.mock('./manifest-lock.mjs', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, withManifestLock: vi.fn(actual.withManifestLock) }
})

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DECLARE_WRITER = path.join(HERE, 'test-fixtures', 'declare-writer.mjs')
const DELAYED_WRITER = path.join(HERE, 'test-fixtures', 'delayed-writer.mjs')

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

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-gate-manifest-'))
  manifestPath = path.join(tmpRoot, 'a3', 'validation-candidates.json')
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('candidate manifest', () => {
  it('defaultManifestPath places the file inside the given git-common-dir under a3/', () => {
    expect(defaultManifestPath('/repo/.git')).toBe(path.join('/repo/.git', 'a3', 'validation-candidates.json'))
  })

  it('readManifest returns {} when the file does not exist yet', () => {
    expect(readManifest(manifestPath)).toEqual({})
  })

  it('declareCandidate creates the manifest (including the a3/ directory) on first use', () => {
    const entry = { sha: 'a'.repeat(40), worktree: '/repo/.worktrees/x', branch: 'feature/x', declaredAt: '2026-01-01T00:00:00.000Z' }
    declareCandidate(manifestPath, 'engineering', entry)
    expect(readManifest(manifestPath)).toEqual({ engineering: entry })
  })

  it('declaring a second lane preserves the first lane\'s entry (merge, not overwrite)', () => {
    const entryA = { sha: 'a'.repeat(40), worktree: '/repo/.worktrees/a', declaredAt: 't1' }
    const entryB = { sha: 'b'.repeat(40), worktree: '/repo/.worktrees/b', declaredAt: 't2' }
    declareCandidate(manifestPath, 'engineering', entryA)
    declareCandidate(manifestPath, 'client-experience', entryB)
    expect(readManifest(manifestPath)).toEqual({ engineering: entryA, 'client-experience': entryB })
  })

  it('re-declaring the same lane (rework, Scenario E) overwrites only that lane\'s entry with the new SHA', () => {
    const first = { sha: 'a'.repeat(40), worktree: '/repo/.worktrees/x', declaredAt: 't1' }
    const reworked = { sha: 'c'.repeat(40), worktree: '/repo/.worktrees/x', declaredAt: 't2' }
    declareCandidate(manifestPath, 'engineering', first)
    declareCandidate(manifestPath, 'calculation', { sha: 'z'.repeat(40), worktree: '/repo/.worktrees/z', declaredAt: 't0' })
    declareCandidate(manifestPath, 'engineering', reworked)

    const manifest = readManifest(manifestPath)
    expect(manifest.engineering).toEqual(reworked)
    expect(manifest.calculation.sha).toBe('z'.repeat(40)) // untouched by the engineering re-declaration
  })

  it('is implemented in terms of withManifestLock — deterministic, non-racy proof declareCandidate cannot silently bypass the lock', () => {
    manifestLock.withManifestLock.mockClear() // this file's other tests also exercise declareCandidate
    declareCandidate(manifestPath, 'engineering', { sha: 'a'.repeat(40) })
    expect(manifestLock.withManifestLock).toHaveBeenCalledTimes(1)
    expect(manifestLock.withManifestLock).toHaveBeenCalledWith(manifestPath, expect.any(Function))
  })
})

describe('writeManifestAtomic cleans up its own temp file on a failed write', () => {
  it('unlinks the sibling .tmp-* file when renameSync fails, and leaves no stray file behind', () => {
    // Force renameSync to fail by making the manifest PATH itself a
    // directory: writeFileSync(tmp, ...) still succeeds (distinct path),
    // but renameSync(tmp, manifestPath) throws (EISDIR/ENOTEMPTY).
    mkdirSync(manifestPath, { recursive: true })
    expect(() => writeManifestAtomic(manifestPath, { engineering: { sha: 'a'.repeat(40) } })).toThrow()
    const leftovers = readdirSync(path.dirname(manifestPath)).filter((f) => f !== path.basename(manifestPath))
    expect(leftovers).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Concurrency regressions (ticket: candidate declarations must be
// concurrency-safe across delivery lanes).
//
// These spawn REAL, separate OS processes against a shared manifest file,
// exercising actual cross-process file contention — not mocked/sequential
// in-process calls — per ticket §12.
// ---------------------------------------------------------------------------

describe('declareCandidate concurrency (real child processes)', () => {
  it('§11.A — client-experience + engineering concurrent: both survive', async () => {
    await Promise.all([
      runChild(DECLARE_WRITER, [manifestPath, 'client-experience', 'a'.repeat(40)]),
      runChild(DECLARE_WRITER, [manifestPath, 'engineering', 'b'.repeat(40)]),
    ])
    const manifest = readManifest(manifestPath)
    expect(Object.keys(manifest).sort()).toEqual(['client-experience', 'engineering'])
    expect(manifest['client-experience'].sha).toBe('a'.repeat(40))
    expect(manifest.engineering.sha).toBe('b'.repeat(40))
  })

  it('§11.B — engineering + calculation concurrent: both survive', async () => {
    await Promise.all([
      runChild(DECLARE_WRITER, [manifestPath, 'engineering', 'b'.repeat(40)]),
      runChild(DECLARE_WRITER, [manifestPath, 'calculation', 'c'.repeat(40)]),
    ])
    const manifest = readManifest(manifestPath)
    expect(Object.keys(manifest).sort()).toEqual(['calculation', 'engineering'])
  })

  it('§11.C — all three lanes concurrent: all three survive, no leftover lock/temp files', async () => {
    await Promise.all([
      runChild(DECLARE_WRITER, [manifestPath, 'client-experience', 'a'.repeat(40)]),
      runChild(DECLARE_WRITER, [manifestPath, 'engineering', 'b'.repeat(40)]),
      runChild(DECLARE_WRITER, [manifestPath, 'calculation', 'c'.repeat(40)]),
    ])
    const manifest = readManifest(manifestPath)
    expect(Object.keys(manifest).sort()).toEqual(['calculation', 'client-experience', 'engineering'])
    expect(readdirSync(path.dirname(manifestPath))).toEqual(['validation-candidates.json'])
  })

  it('§11.D — repeated concurrent cycles under contention: every cycle preserves all 3 lanes', async () => {
    for (let cycle = 0; cycle < 5; cycle += 1) {
      await Promise.all([
        runChild(DECLARE_WRITER, [manifestPath, 'client-experience', `a${cycle}`.padEnd(40, '0')]),
        runChild(DECLARE_WRITER, [manifestPath, 'engineering', `b${cycle}`.padEnd(40, '0')]),
        runChild(DECLARE_WRITER, [manifestPath, 'calculation', `c${cycle}`.padEnd(40, '0')]),
      ])
      const manifest = readManifest(manifestPath)
      expect(Object.keys(manifest).sort()).toEqual(['calculation', 'client-experience', 'engineering'])
    }
  })

  it('same-lane contention: N concurrent declarations for ONE lane serialize to exactly one intact entry, never a mix', async () => {
    const CANDIDATES = Array.from({ length: 5 }, (_, i) => `${i}`.repeat(40))
    await Promise.all(CANDIDATES.map((sha) => runChild(DECLARE_WRITER, [manifestPath, 'engineering', sha])))
    const manifest = readManifest(manifestPath)
    expect(Object.keys(manifest)).toEqual(['engineering'])
    // The stored entry must be structurally intact and exactly equal to
    // ONE of the declared candidates - never a value assembled from more
    // than one (e.g. a SHA that doesn't match any candidate would prove a
    // corrupted/mixed write).
    expect(CANDIDATES).toContain(manifest.engineering.sha)
    expect(manifest.engineering.worktree).toBe('/wt/engineering')
  })

  it('no reader ever observes a partial/invalid manifest while writers are contending', async () => {
    let observations = 0
    let stop = false
    const pollErrors = []
    const pollLoop = (async () => {
      while (!stop) {
        try {
          readManifest(manifestPath) // must never throw a JSON parse error
          observations += 1
        } catch (err) {
          pollErrors.push(err)
        }
        await new Promise((r) => setTimeout(r, 2))
      }
    })()

    await Promise.all([
      runChild(DECLARE_WRITER, [manifestPath, 'client-experience', 'a'.repeat(40)]),
      runChild(DECLARE_WRITER, [manifestPath, 'engineering', 'b'.repeat(40)]),
      runChild(DECLARE_WRITER, [manifestPath, 'calculation', 'c'.repeat(40)]),
    ])
    stop = true
    await pollLoop

    expect(pollErrors).toEqual([])
    expect(observations).toBeGreaterThan(0) // the poll loop actually raced against the writers
  })

  it('DETERMINISTIC regression fixture: unlocked always loses declarations, locked always keeps all 3 (150ms in-critical-section delay)', async () => {
    const LANES = [
      ['client-experience', 'a'.repeat(40)],
      ['engineering', 'b'.repeat(40)],
      ['calculation', 'c'.repeat(40)],
    ]

    // Unlocked: the OLD (pre-fix) read/mutate/write shape, run through the
    // SAME production readManifest/writeManifestAtomic. With a 150ms delay
    // widening the read..write gap, every writer reads the same starting
    // {} and the LAST rename to complete wins — deterministically losing
    // the other two lanes' entries, every time.
    const unlockedManifest = path.join(tmpdir(), `a3-unlocked-${process.pid}-${Date.now()}`, 'validation-candidates.json')
    await Promise.all(LANES.map(([lane, sha]) => runChild(DELAYED_WRITER, ['unlocked', unlockedManifest, lane, sha, '150'])))
    const unlockedResult = readManifest(unlockedManifest)
    expect(Object.keys(unlockedResult).length).toBe(1) // deterministically lost 2 of 3
    rmSync(path.dirname(unlockedManifest), { recursive: true, force: true })

    // Locked: the same delayed critical section, wrapped in the real
    // withManifestLock. All 3 lanes survive, every time.
    await Promise.all(LANES.map(([lane, sha]) => runChild(DELAYED_WRITER, ['locked', manifestPath, lane, sha, '150'])))
    const lockedResult = readManifest(manifestPath)
    expect(Object.keys(lockedResult).sort()).toEqual(['calculation', 'client-experience', 'engineering'])
    expect(readdirSync(path.dirname(manifestPath))).toEqual(['validation-candidates.json']) // no leaked .lock/.tmp-*
  })
})
