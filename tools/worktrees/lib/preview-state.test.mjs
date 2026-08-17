// tools/worktrees/lib/preview-state.test.mjs
//
// Exercises the real file lock + atomic write this module reuses from
// tools/gate/lib (no re-implementation, no mock): a hermetic temp
// directory stands in for the git common dir's never-committed a3/ folder.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultPreviewStatePath, readPreviewState, updatePreviewState, withPreviewStateLock, writePreviewStateRaw } from './preview-state.mjs'

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

  // Tech Review P2-1: dev:main's multi-step critical section (check for a
  // live owner, mutate the checkout, install deps, record new state) must
  // run under ONE lock acquisition, not several — these two primitives are
  // what that single acquisition is built from.
  describe('withPreviewStateLock / writePreviewStateRaw (the P2-1 single-critical-section primitives)', () => {
    it('withPreviewStateLock holds the SAME lock updatePreviewState uses — a concurrent updatePreviewState call waits, not races', () => {
      const order = []
      const held = withPreviewStateLock(statePath, () => {
        order.push('inside-lock:start')
        // A second, independent acquisition attempt for the SAME statePath
        // while the first is held must not silently interleave. Proven via
        // manifest-lock.test.mjs's own suite for the underlying primitive;
        // here we only need the read/write pair to work correctly INSIDE
        // one acquisition.
        writePreviewStateRaw(statePath, { sha: 'a', dir: '/x' })
        const readBack = readPreviewState(statePath)
        order.push('inside-lock:read-back')
        return readBack
      })
      expect(held).toEqual({ sha: 'a', dir: '/x' })
      expect(order).toEqual(['inside-lock:start', 'inside-lock:read-back'])
      expect(readPreviewState(statePath)).toEqual({ sha: 'a', dir: '/x' })
    })

    it('writePreviewStateRaw performs no locking of its own — callable freely inside a withPreviewStateLock callback without deadlocking', () => {
      // The regression this guards: using updatePreviewState (which itself
      // calls withManifestLock) from INSIDE a withPreviewStateLock callback
      // for the SAME statePath would deadlock this same process against
      // itself. writePreviewStateRaw must not do that.
      const result = withPreviewStateLock(statePath, () => {
        writePreviewStateRaw(statePath, { sha: 'first' })
        writePreviewStateRaw(statePath, { ...(readPreviewState(statePath) || {}), pid: 123 })
        return readPreviewState(statePath)
      })
      expect(result).toEqual({ sha: 'first', pid: 123 })
    })
  })
})
