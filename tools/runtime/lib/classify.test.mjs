// tools/runtime/lib/classify.test.mjs
//
// Full truth table for classifyRuntime — pure function, no fs/net/git.

import { describe, expect, it } from 'vitest'
import { classifyRuntime, RUNTIME_STATUS } from './classify.mjs'

const CLAIM = { purpose: 'CURRENT_MAIN', sha: 'aaaa', worktree: '/preview/main', pid: 111, port: 5000, url: 'http://127.0.0.1:5000', nonce: 'nonce-1', startedAt: '2026-01-01T00:00:00.000Z' }
const JSON_ECHO = { ok: true, contentType: 'application/json', sha: 'aaaa', purpose: 'CURRENT_MAIN', nonce: 'nonce-1' }

describe('classifyRuntime', () => {
  it('MISSING: no claim at all', () => {
    expect(classifyRuntime({ claim: null, pidAlive: false, echo: null }).status).toBe(RUNTIME_STATUS.MISSING)
  })

  it('DEAD: claim exists, pid is not alive', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: false, echo: null })
    expect(result.status).toBe(RUNTIME_STATUS.DEAD)
  })

  it('UNVERIFIED: pid alive but the echo never answered (unreachable)', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: null })
    expect(result.status).toBe(RUNTIME_STATUS.UNVERIFIED)
  })

  it('UNVERIFIED: pid alive, echo.ok === false (HTTP error)', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: { ok: false, contentType: null } })
    expect(result.status).toBe(RUNTIME_STATUS.UNVERIFIED)
  })

  it('UNVERIFIED: the exact live-verified case — an unmanaged vite dev server answers HTTP 200 with text/html (SPA fallback)', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: { ok: true, contentType: 'text/html' } })
    expect(result.status).toBe(RUNTIME_STATUS.UNVERIFIED)
    expect(result.reason).toMatch(/text\/html/)
  })

  it('FOREIGN_HOST: application/json but no nonce field at all (legacy/foreign JSON server)', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: { ok: true, contentType: 'application/json', sha: 'aaaa', purpose: 'CURRENT_MAIN', nonce: null } })
    expect(result.status).toBe(RUNTIME_STATUS.FOREIGN_HOST)
  })

  it('FOREIGN_HOST: nonce present but does not match the registered claim', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: { ...JSON_ECHO, nonce: 'someone-elses-nonce' } })
    expect(result.status).toBe(RUNTIME_STATUS.FOREIGN_HOST)
  })

  it('FOREIGN_HOST: nonce matches but purpose does not', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: { ...JSON_ECHO, purpose: 'TASK_CANDIDATE' } })
    expect(result.status).toBe(RUNTIME_STATUS.FOREIGN_HOST)
  })

  it('DRIFTED: nonce+purpose verified, but the live sha disagrees with the registry claim', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: { ...JSON_ECHO, sha: 'zzzz' } })
    expect(result.status).toBe(RUNTIME_STATUS.DRIFTED)
  })

  it('STALE (CURRENT_MAIN): verified and self-consistent, but local main has advanced past the claimed sha', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: JSON_ECHO, gitMainSha: 'newer-sha' })
    expect(result.status).toBe(RUNTIME_STATUS.STALE)
  })

  it('SERVING_VERIFIED (CURRENT_MAIN): verified and matches current main exactly', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: JSON_ECHO, gitMainSha: 'aaaa' })
    expect(result.status).toBe(RUNTIME_STATUS.SERVING_VERIFIED)
  })

  it('SERVING_VERIFIED (CURRENT_MAIN): no gitMainSha supplied at all -> cannot detect staleness, so a self-consistent claim passes', () => {
    const result = classifyRuntime({ claim: CLAIM, pidAlive: true, echo: JSON_ECHO })
    expect(result.status).toBe(RUNTIME_STATUS.SERVING_VERIFIED)
  })

  describe('non-CURRENT_MAIN purposes (TASK_CANDIDATE / REVIEW_CANDIDATE) use expectedSha, never gitMainSha', () => {
    const candidateClaim = { ...CLAIM, purpose: 'REVIEW_CANDIDATE', sha: 'commit-c' }
    const candidateEcho = { ok: true, contentType: 'application/json', sha: 'commit-c', purpose: 'REVIEW_CANDIDATE', nonce: 'nonce-1' }

    it('SERVING_VERIFIED: expectedSha matches the claimed/echoed sha', () => {
      const result = classifyRuntime({ claim: candidateClaim, pidAlive: true, echo: candidateEcho, expectedSha: 'commit-c' })
      expect(result.status).toBe(RUNTIME_STATUS.SERVING_VERIFIED)
    })

    it('STALE: expectedSha (e.g. implementationCommit after rework) no longer matches what this runtime serves', () => {
      const result = classifyRuntime({ claim: candidateClaim, pidAlive: true, echo: candidateEcho, expectedSha: 'commit-d' })
      expect(result.status).toBe(RUNTIME_STATUS.STALE)
    })

    it('gitMainSha is ignored entirely for a candidate purpose (main advancing must not affect a pinned candidate)', () => {
      const result = classifyRuntime({ claim: candidateClaim, pidAlive: true, echo: candidateEcho, expectedSha: 'commit-c', gitMainSha: 'unrelated-newer-main' })
      expect(result.status).toBe(RUNTIME_STATUS.SERVING_VERIFIED)
    })
  })
})
