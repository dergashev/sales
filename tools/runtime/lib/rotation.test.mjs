// tools/runtime/lib/rotation.test.mjs
//
// planCurrentMainRotation action-list truth table — pure, no fs/git/http.

import { describe, expect, it } from 'vitest'
import { planCurrentMainRotation } from './rotation.mjs'
import { RUNTIME_STATUS } from './classify.mjs'

function classification(status, reason = 'reason') {
  return { status, reason }
}

describe('planCurrentMainRotation', () => {
  it('SERVING_VERIFIED -> reuse (idempotent: scenario A/C repeat call is a no-op)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.SERVING_VERIFIED) })
    expect(plan.action).toBe('reuse')
  })

  it('MISSING -> start (scenario A: clean start, nothing to stop)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.MISSING) })
    expect(plan.action).toBe('start')
  })

  it('DEAD -> start (scenario E: dead pid does not block a fresh start)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.DEAD) })
    expect(plan.action).toBe('start')
  })

  it('STALE -> stop-then-start (scenario B/C: ownership already proven, only the sha disagrees)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.STALE) })
    expect(plan.action).toBe('stop-then-start')
  })

  it('DRIFTED -> stop-then-start (claim/reality mismatch, but ownership still proven via nonce)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.DRIFTED) })
    expect(plan.action).toBe('stop-then-start')
  })

  it('UNVERIFIED -> blocked, code 2 (cannot prove ownership -> never stop/mutate; e.g. an old worktree\'s plugin-less dev:main)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.UNVERIFIED) })
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(2)
  })

  it('FOREIGN_HOST -> blocked, code 2 (never kill a process we cannot prove we own)', () => {
    const plan = planCurrentMainRotation({ classification: classification(RUNTIME_STATUS.FOREIGN_HOST) })
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(2)
  })

  it('an unrecognized status blocks with code 3, never silently proceeds', () => {
    const plan = planCurrentMainRotation({ classification: classification('SOMETHING_NEW') })
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(3)
  })
})
