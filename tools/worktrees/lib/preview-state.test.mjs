// tools/worktrees/lib/preview-state.test.mjs
//
// Exercises the real file lock + atomic write this module reuses from
// tools/gate/lib (no re-implementation, no mock): a hermetic temp
// directory stands in for the git common dir's never-committed a3/ folder.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultPreviewStatePath, readPreviewState, updatePreviewState } from './preview-state.mjs'

let tmpRoot
let statePath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-preview-state-'))
  statePath = defaultPreviewStatePath(tmpRoot)
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('preview state', () => {
  it('defaultPreviewStatePath places the file under a3/ inside the given common dir', () => {
    expect(statePath).toBe(path.join(tmpRoot, 'a3', 'preview-state.json'))
  })

  it('reads null when no state has ever been written', () => {
    expect(readPreviewState(statePath)).toBeNull()
  })

  it('round-trips a written record', () => {
    const written = updatePreviewState(statePath, () => ({ sha: 'aaaa', dir: '/x', updatedAt: '2026-01-01T00:00:00.000Z' }))
    expect(written).toEqual({ sha: 'aaaa', dir: '/x', updatedAt: '2026-01-01T00:00:00.000Z' })
    expect(readPreviewState(statePath)).toEqual(written)
  })

  it('mutateFn sees the previous record (or null) and can merge into it', () => {
    updatePreviewState(statePath, () => ({ sha: 'aaaa' }))
    const merged = updatePreviewState(statePath, (current) => ({ ...current, installedLockHash: 'hash-1' }))
    expect(merged).toEqual({ sha: 'aaaa', installedLockHash: 'hash-1' })
  })

  it('mutateFn receives null on the very first write, not an empty object masquerading as data', () => {
    let seenAsFirstArg
    updatePreviewState(statePath, (current) => {
      seenAsFirstArg = current
      return { sha: 'first' }
    })
    expect(seenAsFirstArg).toBeNull()
  })
})
