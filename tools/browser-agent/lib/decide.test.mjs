import { describe, expect, it } from 'vitest'
import { classifyRuntimeStep, classifySidecarFreshness, decideSessionAction, isPreflightVerified, parseRuntimeUrl, planClose, verifyExpectedShaAgainstWorktree } from './decide.mjs'

describe('isPreflightVerified — refuse-on-nonzero-preflight', () => {
  it('exit 0 is the ONLY verified outcome', () => {
    expect(isPreflightVerified(0)).toBe(true)
  })

  it('every non-zero exit code (PROVENANCE/LIFECYCLE/TOOLING alike) refuses', () => {
    expect(isPreflightVerified(2)).toBe(false)
    expect(isPreflightVerified(3)).toBe(false)
    expect(isPreflightVerified(4)).toBe(false)
    expect(isPreflightVerified(1)).toBe(false)
  })
})

describe('classifyRuntimeStep', () => {
  it('passes through exit 0', () => {
    expect(classifyRuntimeStep({ step: 'npm run runtime:main', exitCode: 0 })).toEqual({ ok: true })
  })

  it('refuses on any non-zero exit, carrying the exact code through', () => {
    const result = classifyRuntimeStep({ step: 'npm run runtime:candidate', exitCode: 2 })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(/runtime:candidate/)
  })
})

describe('decideSessionAction — session collision', () => {
  const candidate = { purpose: 'TASK_CANDIDATE', worktree: '/repo/wt-a', sha: 'aaa' }

  it('no existing sidecar -> create', () => {
    expect(decideSessionAction(null, candidate)).toEqual({ action: 'create' })
  })

  it('existing sidecar with matching purpose/sha/worktree -> reuse', () => {
    const existing = { purpose: 'TASK_CANDIDATE', actualSha: 'aaa', worktree: '/repo/wt-a' }
    expect(decideSessionAction(existing, candidate)).toEqual({ action: 'reuse' })
  })

  it('a different purpose under the same name -> refuse', () => {
    const existing = { purpose: 'REVIEW_CANDIDATE', actualSha: 'aaa', worktree: '/repo/wt-a' }
    const result = decideSessionAction(existing, candidate)
    expect(result.action).toBe('refuse')
    expect(result.reason).toMatch(/purpose/)
  })

  it('a mismatched sha under a sha-keyed name -> refuse (should be structurally impossible, still guarded)', () => {
    const existing = { purpose: 'TASK_CANDIDATE', actualSha: 'zzz', worktree: '/repo/wt-a' }
    const result = decideSessionAction(existing, candidate)
    expect(result.action).toBe('refuse')
    expect(result.reason).toMatch(/sha-keyed/)
  })

  it('same purpose+sha but a different worktree -> refuse (real collision)', () => {
    const existing = { purpose: 'TASK_CANDIDATE', actualSha: 'aaa', worktree: '/repo/wt-b' }
    const result = decideSessionAction(existing, candidate)
    expect(result.action).toBe('refuse')
    expect(result.reason).toMatch(/collision/)
  })
})

describe('classifySidecarFreshness — sha-keyed supersession', () => {
  it('CURRENT when the sidecar sha still matches what this purpose/lane resolves to now', () => {
    expect(classifySidecarFreshness({ sidecar: { actualSha: 'A' }, currentExpectedSha: 'A' })).toBe('CURRENT')
  })

  it('SUPERSEDED once main advances (or rework produces a new implementationCommit)', () => {
    expect(classifySidecarFreshness({ sidecar: { actualSha: 'A' }, currentExpectedSha: 'B' })).toBe('SUPERSEDED')
  })

  it('UNKNOWN, never silently CURRENT, when the current expectation cannot be determined', () => {
    expect(classifySidecarFreshness({ sidecar: { actualSha: 'A' }, currentExpectedSha: null })).toBe('UNKNOWN')
  })
})

describe('planClose — close-only-own-sidecar', () => {
  it('names exactly the requested session for removal and leaves every other name untouched', () => {
    const plan = planClose({ sessionName: 'task-engineering-abc123456789', allSidecarNames: ['task-engineering-abc123456789', 'review-qa-def987654321', 'current-main-000000000000'] })
    expect(plan.toRemove).toEqual(['task-engineering-abc123456789'])
    expect(plan.untouched).toEqual(['review-qa-def987654321', 'current-main-000000000000'])
    expect(plan.untouched).not.toContain('task-engineering-abc123456789')
  })

  it('is a no-op plan (still names only the target) even if that session is not actually present', () => {
    const plan = planClose({ sessionName: 'ghost-session', allSidecarNames: ['review-qa-def987654321'] })
    expect(plan.toRemove).toEqual(['ghost-session'])
    expect(plan.untouched).toEqual(['review-qa-def987654321'])
  })
})

describe('verifyExpectedShaAgainstWorktree — D1: never trust a caller-asserted candidate sha over the worktree\'s own HEAD', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)

  it('CURRENT_MAIN is never verified here — runtime:main accepts no sha override at all, so it cannot be tricked the same way', () => {
    expect(verifyExpectedShaAgainstWorktree({ purpose: 'CURRENT_MAIN', expectedSha: B, actualHeadSha: A })).toEqual({ ok: true })
  })

  it('no --expected-sha asserted -> nothing to verify, ok (runtime:candidate will derive the worktree HEAD itself)', () => {
    expect(verifyExpectedShaAgainstWorktree({ purpose: 'TASK_CANDIDATE', expectedSha: undefined, actualHeadSha: A })).toEqual({ ok: true })
  })

  it('asserted sha matches the worktree HEAD -> ok', () => {
    expect(verifyExpectedShaAgainstWorktree({ purpose: 'REVIEW_CANDIDATE', expectedSha: A, actualHeadSha: A })).toEqual({ ok: true })
  })

  it('ticket case G/I: expected sha A, worktree actually at B -> refuse closed with PROVENANCE (2), never silently proceeds', () => {
    const result = verifyExpectedShaAgainstWorktree({ purpose: 'REVIEW_CANDIDATE', expectedSha: A, actualHeadSha: B })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(new RegExp(A))
    expect(result.reason).toMatch(new RegExp(B))
  })

  it('TASK_CANDIDATE gets the same protection as REVIEW_CANDIDATE', () => {
    const result = verifyExpectedShaAgainstWorktree({ purpose: 'TASK_CANDIDATE', expectedSha: A, actualHeadSha: B })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
  })

  it('worktree HEAD itself unresolvable -> LIFECYCLE (3), not a silent pass', () => {
    const result = verifyExpectedShaAgainstWorktree({ purpose: 'TASK_CANDIDATE', expectedSha: A, actualHeadSha: null })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
  })
})

describe('parseRuntimeUrl — no-hardcoded-port', () => {
  it('extracts whatever port the Runtime Provenance registry actually handed back', () => {
    expect(parseRuntimeUrl('http://127.0.0.1:5173')).toEqual({ host: '127.0.0.1', port: 5173, href: 'http://127.0.0.1:5173/' })
    expect(parseRuntimeUrl('http://127.0.0.1:41999')).toMatchObject({ port: 41999 })
    expect(parseRuntimeUrl('http://127.0.0.1:5174')).toMatchObject({ port: 5174 })
  })

  it('an unparseable/portless URL never falls back to a default port — it refuses (null)', () => {
    expect(parseRuntimeUrl('not-a-url')).toBeNull()
    expect(parseRuntimeUrl('http://127.0.0.1')).toBeNull()
  })
})
