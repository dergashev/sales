// tools/gate/lib/manifest.test.mjs

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { declareCandidate, defaultManifestPath, readManifest } from './manifest.mjs'

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
})
