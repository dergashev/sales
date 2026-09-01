// tools/delivery/agentsroom-guard.test.mjs
//
// Unit coverage for checkAgentsRoomGuard — DELIVERY-INFRA-01 REGRESSION
// CASE G (.agentsroom/** manual mutation).

import { describe, expect, it } from 'vitest'
import { AGENTSROOM_OVERRIDE_ENV, checkAgentsRoomGuard } from './agentsroom-guard.mjs'

describe('checkAgentsRoomGuard — CASE G', () => {
  it('allows a commit that touches nothing under .agentsroom/', () => {
    const result = checkAgentsRoomGuard({ changedPaths: ['tools/delivery/preflight.mjs', 'src/App.tsx'], env: {} })
    expect(result.ok).toBe(true)
    expect(result.offending).toEqual([])
  })

  it('blocks a commit that stages a .agentsroom/sessions/*.json path', () => {
    const result = checkAgentsRoomGuard({ changedPaths: ['.agentsroom/sessions/agent-123.json'], env: {} })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.offending).toEqual(['.agentsroom/sessions/agent-123.json'])
    expect(result.reason).toMatch(/AgentsRoom's own runtime\/session\/routing state/)
  })

  it('blocks on any .agentsroom/** path, not just sessions', () => {
    for (const p of ['.agentsroom/memory/INDEX.md', '.agentsroom/handoff-summary-x.md', '.agentsroom/roles/_etiquette.md']) {
      const result = checkAgentsRoomGuard({ changedPaths: [p], env: {} })
      expect(result.ok).toBe(false)
    }
  })

  it('a partial-name path that merely starts with a similar prefix is NOT caught (only the real directory)', () => {
    const result = checkAgentsRoomGuard({ changedPaths: ['.agentsroom-backup/x.json'], env: {} })
    expect(result.ok).toBe(true)
  })

  it('mixed changeset: still blocks, and reports only the offending subset', () => {
    const result = checkAgentsRoomGuard({ changedPaths: ['src/App.tsx', '.agentsroom/sessions/agent-123.json', 'package.json'], env: {} })
    expect(result.ok).toBe(false)
    expect(result.offending).toEqual(['.agentsroom/sessions/agent-123.json'])
  })

  it('explicit human override env var allows a deliberate .agentsroom/** commit', () => {
    const result = checkAgentsRoomGuard({ changedPaths: ['.agentsroom/sessions/agent-123.json'], env: { [AGENTSROOM_OVERRIDE_ENV]: '1' } })
    expect(result.ok).toBe(true)
    expect(result.overridden).toBe(true)
  })

  it('an override value other than the literal "1" does not disarm the guard', () => {
    const result = checkAgentsRoomGuard({ changedPaths: ['.agentsroom/sessions/agent-123.json'], env: { [AGENTSROOM_OVERRIDE_ENV]: 'true' } })
    expect(result.ok).toBe(false)
  })
})
