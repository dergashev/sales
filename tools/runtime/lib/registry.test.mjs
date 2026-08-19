// tools/runtime/lib/registry.test.mjs
//
// Exercises the real file lock + atomic write this module reuses from
// tools/gate/lib (no re-implementation, no mock) — same style as
// tools/worktrees/lib/preview-state.test.mjs — plus the legacy
// preview-state.json migration read path.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  defaultRegistryPath,
  listClaims,
  putRuntimeClaim,
  readRegistry,
  removeRuntimeClaim,
  resolveCurrentMainClaim,
  runtimeId,
} from './registry.mjs'

let tmpRoot
let registryPath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-runtime-registry-'))
  registryPath = defaultRegistryPath(tmpRoot)
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('registry basics', () => {
  it('defaultRegistryPath places the file under a3/runtimes.json inside the given common dir', () => {
    expect(registryPath).toBe(path.join(tmpRoot, 'a3', 'runtimes.json'))
  })

  it('reads {} when nothing has ever been registered', () => {
    expect(readRegistry(registryPath)).toEqual({})
    expect(listClaims(registryPath)).toEqual([])
  })

  it('putRuntimeClaim writes a claim keyed by runtimeId, and other ids are preserved', () => {
    const idA = runtimeId('TASK_CANDIDATE', '/worktrees/a')
    const idB = runtimeId('REVIEW_CANDIDATE', '/worktrees/b')
    putRuntimeClaim(registryPath, idA, { purpose: 'TASK_CANDIDATE', sha: 'aaa' })
    putRuntimeClaim(registryPath, idB, { purpose: 'REVIEW_CANDIDATE', sha: 'bbb' })

    const claims = listClaims(registryPath)
    expect(claims).toHaveLength(2)
    expect(claims.find((c) => c.id === idA)).toMatchObject({ purpose: 'TASK_CANDIDATE', sha: 'aaa' })
    expect(claims.find((c) => c.id === idB)).toMatchObject({ purpose: 'REVIEW_CANDIDATE', sha: 'bbb' })
  })

  it('runtimeId makes CURRENT_MAIN a singleton by construction: the same purpose+worktree always yields the same id, regardless of trailing slash/relative noise', () => {
    const a = runtimeId('CURRENT_MAIN', path.join(tmpRoot, 'preview', 'main'))
    const b = runtimeId('CURRENT_MAIN', path.join(tmpRoot, 'preview', '.', 'main'))
    expect(a).toBe(b)
  })

  it('re-registering the SAME id overwrites the previous claim (last writer wins for that id, other ids untouched)', () => {
    const id = runtimeId('CURRENT_MAIN', path.join(tmpRoot, 'preview', 'main'))
    putRuntimeClaim(registryPath, id, { purpose: 'CURRENT_MAIN', sha: 'old' })
    putRuntimeClaim(registryPath, id, { purpose: 'CURRENT_MAIN', sha: 'new' })
    const claims = listClaims(registryPath)
    expect(claims).toHaveLength(1)
    expect(claims[0].sha).toBe('new')
  })

  it('removeRuntimeClaim deletes exactly the named id and is a no-op for one that never existed', () => {
    const idA = runtimeId('TASK_CANDIDATE', '/worktrees/a')
    const idB = runtimeId('TASK_CANDIDATE', '/worktrees/b')
    putRuntimeClaim(registryPath, idA, { purpose: 'TASK_CANDIDATE', sha: 'aaa' })
    putRuntimeClaim(registryPath, idB, { purpose: 'TASK_CANDIDATE', sha: 'bbb' })

    removeRuntimeClaim(registryPath, idA)
    expect(listClaims(registryPath).map((c) => c.id)).toEqual([idB])

    expect(() => removeRuntimeClaim(registryPath, 'never-existed')).not.toThrow()
    expect(listClaims(registryPath)).toHaveLength(1)
  })
})

describe('resolveCurrentMainClaim — legacy preview-state.json dual-read', () => {
  const previewWorktreePath = '/repo/.preview/main'

  it('returns claim:null, source:"none" when neither the registry nor legacy preview-state.json has anything', () => {
    const legacyPath = path.join(tmpRoot, 'a3', 'preview-state.json')
    const result = resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath: legacyPath, previewWorktreePath })
    expect(result.claim).toBeNull()
    expect(result.source).toBe('none')
  })

  it('prefers the NEW registry claim when both exist', () => {
    const id = runtimeId('CURRENT_MAIN', previewWorktreePath)
    putRuntimeClaim(registryPath, id, { purpose: 'CURRENT_MAIN', sha: 'from-registry', worktree: previewWorktreePath })

    const legacyPath = path.join(tmpRoot, 'a3', 'preview-state.json')
    mkdirSync(path.dirname(legacyPath), { recursive: true })
    writeFileSync(legacyPath, JSON.stringify({ sha: 'from-legacy', dir: previewWorktreePath, pid: 999, port: 1234 }))

    const result = resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath: legacyPath, previewWorktreePath })
    expect(result.source).toBe('registry')
    expect(result.claim.sha).toBe('from-registry')
  })

  it('synthesizes a claim from legacy preview-state.json when the registry has none — an older worktree\'s dev:main copy is still recognized, not reported as "never created"', () => {
    const legacyPath = path.join(tmpRoot, 'a3', 'preview-state.json')
    mkdirSync(path.dirname(legacyPath), { recursive: true })
    writeFileSync(legacyPath, JSON.stringify({ sha: 'from-legacy', dir: previewWorktreePath, pid: 999, port: 1234, startedAt: '2026-01-01T00:00:00.000Z' }))

    const result = resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath: legacyPath, previewWorktreePath })
    expect(result.source).toBe('legacy-preview-state')
    expect(result.claim).toMatchObject({ purpose: 'CURRENT_MAIN', sha: 'from-legacy', pid: 999, port: 1234, url: 'http://127.0.0.1:1234', nonce: null })
  })

  it('a legacy record with no sha at all is treated as "nothing registered", not a claim', () => {
    const legacyPath = path.join(tmpRoot, 'a3', 'preview-state.json')
    mkdirSync(path.dirname(legacyPath), { recursive: true })
    writeFileSync(legacyPath, JSON.stringify({ installedLockHash: 'x' }))
    const result = resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath: legacyPath, previewWorktreePath })
    expect(result.claim).toBeNull()
  })
})
