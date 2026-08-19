import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultSidecarDir, listSidecars, readSidecar, removeSidecar, writeSidecar } from './sidecar-store.mjs'

let dir

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'browser-agent-sidecars-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('defaultSidecarDir', () => {
  it('lives under .artifacts (already repository-gitignored), never under a tracked path', () => {
    expect(defaultSidecarDir('/repo')).toBe(path.join('/repo', '.artifacts', 'browser-agent-sessions'))
  })
})

describe('sidecar-store roundtrip', () => {
  it('reading a session that was never written returns null, not throwing', () => {
    expect(readSidecar(dir, 'never-written')).toBeNull()
  })

  it('write then read returns exactly what was written', () => {
    const record = { sessionName: 'task-engineering-abc123456789', purpose: 'TASK_CANDIDATE', actualSha: 'abc123456789', url: 'http://127.0.0.1:41999' }
    writeSidecar(dir, 'task-engineering-abc123456789', record)
    expect(readSidecar(dir, 'task-engineering-abc123456789')).toEqual(record)
  })

  it('writeSidecar creates the directory on demand', () => {
    const fresh = path.join(dir, 'nested', 'does', 'not', 'exist', 'yet')
    writeSidecar(fresh, 'x', { sessionName: 'x' })
    expect(readSidecar(fresh, 'x')).toEqual({ sessionName: 'x' })
  })

  it('removeSidecar is idempotent — removing a session with no sidecar is a no-op, not an error', () => {
    expect(() => removeSidecar(dir, 'was-never-there')).not.toThrow()
  })

  it('close-only-own-sidecar: removing one session leaves every other sidecar file untouched', () => {
    writeSidecar(dir, 'session-a', { sessionName: 'session-a' })
    writeSidecar(dir, 'session-b', { sessionName: 'session-b' })
    writeSidecar(dir, 'session-c', { sessionName: 'session-c' })

    removeSidecar(dir, 'session-b')

    expect(readSidecar(dir, 'session-a')).toEqual({ sessionName: 'session-a' })
    expect(readSidecar(dir, 'session-b')).toBeNull()
    expect(readSidecar(dir, 'session-c')).toEqual({ sessionName: 'session-c' })
  })

  it('listSidecars returns every tracked session, and [] for a directory that does not exist yet', () => {
    expect(listSidecars(path.join(dir, 'nope'))).toEqual([])

    writeSidecar(dir, 'session-a', { purpose: 'CURRENT_MAIN' })
    writeSidecar(dir, 'session-b', { purpose: 'TASK_CANDIDATE' })

    const all = listSidecars(dir).sort((a, b) => a.sessionName.localeCompare(b.sessionName))
    expect(all).toEqual([
      { sessionName: 'session-a', purpose: 'CURRENT_MAIN' },
      { sessionName: 'session-b', purpose: 'TASK_CANDIDATE' },
    ])
  })
})
