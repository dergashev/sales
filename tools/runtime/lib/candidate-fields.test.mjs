// tools/runtime/lib/candidate-fields.test.mjs

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultManifestPath, declareCandidate, readManifest } from '../../gate/lib/manifest.mjs'
import { updateCandidateFields } from './candidate-fields.mjs'

let tmpRoot
let manifestPath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-candidate-fields-'))
  manifestPath = defaultManifestPath(tmpRoot)
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('updateCandidateFields', () => {
  it('refuses (throws, writes nothing) when the lane has no existing entry', () => {
    expect(() => updateCandidateFields(manifestPath, 'engineering', { taskBaseCommit: 'A' })).toThrow(/no candidate is declared/i)
    expect(readManifest(manifestPath)).toEqual({})
  })

  it('merges additive fields onto an existing entry WITHOUT replacing the entry wholesale (the declareCandidate clobber class this exists to avoid)', () => {
    declareCandidate(manifestPath, 'engineering', { sha: 'S1', worktree: '/wt', branch: 'b', taskId: 't1', declaredAt: '2026-01-01T00:00:00.000Z' })
    const updated = updateCandidateFields(manifestPath, 'engineering', { taskBaseCommit: 'A', pinnedAt: '2026-01-02T00:00:00.000Z' })

    expect(updated).toEqual({
      sha: 'S1',
      worktree: '/wt',
      branch: 'b',
      taskId: 't1',
      declaredAt: '2026-01-01T00:00:00.000Z',
      taskBaseCommit: 'A',
      pinnedAt: '2026-01-02T00:00:00.000Z',
    })
  })

  it('other lanes are never touched', () => {
    declareCandidate(manifestPath, 'engineering', { sha: 'S1' })
    declareCandidate(manifestPath, 'calculation', { sha: 'S2' })
    updateCandidateFields(manifestPath, 'engineering', { taskBaseCommit: 'A' })

    const manifest = readManifest(manifestPath)
    expect(manifest.calculation).toEqual({ sha: 'S2' })
    expect(manifest.engineering.taskBaseCommit).toBe('A')
  })

  it('a later re-declaration of the SAME lane (a genuine rework, e.g. C after B) is a full replace as declareCandidate always was — updateCandidateFields does not fight that contract', () => {
    declareCandidate(manifestPath, 'engineering', { sha: 'B' })
    updateCandidateFields(manifestPath, 'engineering', { taskBaseCommit: 'A', pinnedAt: 'p1' })
    declareCandidate(manifestPath, 'engineering', { sha: 'C' })
    expect(readManifest(manifestPath).engineering).toEqual({ sha: 'C' })
  })
})
