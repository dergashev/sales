// tools/gate/lib/resolve-candidate.test.mjs
//
// Pure unit tests for the exact-candidate resolution decision table.
// Injects listWorktrees()-shaped fixtures and manifest entries directly —
// no real git process, no filesystem — so every branch of the fail-closed
// contract (ticket §1/§2/§5/§11 AC-1..4,8) is exercised deterministically
// and fast. Real-git integration is covered separately in
// git-worktrees.test.mjs and the end-to-end gate.test.mjs.

import { describe, expect, it } from 'vitest'
import { resolveCandidate } from './resolve-candidate.mjs'

const ROOT = { path: '/repo/root', sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', branch: 'unrelated-branch', detached: false }
const CANDIDATE = { path: '/repo/.worktrees/candidate', sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', branch: 'feature/x', detached: false }
const OTHER_AT_SAME_SHA = { path: '/repo/.worktrees/other', sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', branch: 'feature/y', detached: false }

function baseOpts(overrides = {}) {
  return {
    lane: 'engineering',
    expectShaArg: null,
    worktreeArg: null,
    allowDirty: false,
    manifestEntry: null,
    worktrees: [ROOT, CANDIDATE],
    existsFn: () => true,
    headShaFn: (dir) => (dir === CANDIDATE.path ? CANDIDATE.sha : ROOT.sha),
    dirtyEntriesFn: () => [],
    ...overrides,
  }
}

describe('resolveCandidate — the exact-candidate fail-closed contract', () => {
  it('fails (code 2) when no --lane is given', () => {
    const result = resolveCandidate(baseOpts({ lane: null }))
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
  })

  it('fails (code 3) when git worktree list itself failed', () => {
    const result = resolveCandidate(baseOpts({ worktrees: null }))
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
  })

  it('fails (code 2) when no expected SHA is available from either --expect-sha or the manifest', () => {
    const result = resolveCandidate(baseOpts({ manifestEntry: null }))
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(/declare-candidate/)
  })

  it('Scenario A: candidate in an isolated worktree, root on an unrelated branch -> candidate is validated, never root', () => {
    const result = resolveCandidate(
      baseOpts({ manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path } }),
    )
    expect(result.ok).toBe(true)
    expect(result.worktree).toBe(CANDIDATE.path)
    expect(result.worktree).not.toBe(ROOT.path)
    expect(result.sha).toBe(CANDIDATE.sha)
  })

  it('Scenario A (no explicit worktree): resolves the one registered worktree whose HEAD matches the expected SHA', () => {
    const result = resolveCandidate(
      baseOpts({ expectShaArg: CANDIDATE.sha, manifestEntry: null, worktreeArg: null }),
    )
    expect(result.ok).toBe(true)
    expect(result.worktree).toBe(CANDIDATE.path)
  })

  it('fails (code 2) when zero registered worktrees match the expected SHA and none is given explicitly', () => {
    const result = resolveCandidate(
      baseOpts({ expectShaArg: 'cccccccccccccccccccccccccccccccccccccccc', manifestEntry: null }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
  })

  it('fails (code 2) on ambiguity: two registered worktrees share the expected SHA and none is given explicitly', () => {
    const result = resolveCandidate(
      baseOpts({
        worktrees: [ROOT, CANDIDATE, OTHER_AT_SAME_SHA],
        expectShaArg: CANDIDATE.sha,
        manifestEntry: null,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(/Ambiguous/)
  })

  it('fails (code 2): an explicit --worktree not present in "git worktree list" is refused, not substituted', () => {
    const result = resolveCandidate(
      baseOpts({
        worktreeArg: '/repo/root', // root literal path spelled explicitly, but distinct object than ROOT below
        worktrees: [CANDIDATE], // root not even registered in this scenario
        expectShaArg: CANDIDATE.sha,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(/not a path returned by "git worktree list"/)
  })

  it('Scenario C (code 3): registered worktree directory is missing on disk', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        existsFn: () => false,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
    expect(result.reason).toMatch(/missing on disk/)
  })

  it('fails (code 3) when "git rev-parse HEAD" cannot be read from the worktree', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        headShaFn: () => null,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
  })

  it('Scenario B (code 2): declared/expected SHA differs from the worktree\'s actual HEAD -> fail closed', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        headShaFn: () => 'dddddddddddddddddddddddddddddddddddddddd',
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(/ACTUAL HEAD.*does not match EXPECTED CANDIDATE/)
  })

  it('Scenario E: rework moves HEAD without re-declaring -> the stale declaration is rejected the same way as Scenario B', () => {
    // A prior PASS had declared CANDIDATE.sha; a new commit landed without
    // calling gate:declare again, so the manifest is now stale.
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path }, // stale
        headShaFn: () => 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // new HEAD after rework
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
  })

  it('fails (code 3) when "git status --porcelain" cannot be read', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        dirtyEntriesFn: () => null,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
  })

  it('fails (code 2) on a dirty tree without --allow-dirty', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        dirtyEntriesFn: () => ['src/foo.ts'],
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.reason).toMatch(/is dirty/)
  })

  it('succeeds on a dirty tree WITH --allow-dirty, and reports dirty:true', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        allowDirty: true,
        dirtyEntriesFn: () => ['src/foo.ts'],
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.dirty).toBe(true)
    expect(result.advisoryDirtyOnly).toBe(false)
  })

  it('the tsconfig.tsbuildinfo churn is advisory-only and does NOT block even without --allow-dirty', () => {
    const result = resolveCandidate(
      baseOpts({
        manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path },
        dirtyEntriesFn: () => ['tsconfig.tsbuildinfo'],
      }),
    )
    expect(result.ok).toBe(true)
    expect(result.dirty).toBe(true)
    expect(result.advisoryDirtyOnly).toBe(true)
  })

  it('a clean tree resolves with dirty:false', () => {
    const result = resolveCandidate(baseOpts({ manifestEntry: { sha: CANDIDATE.sha, worktree: CANDIDATE.path } }))
    expect(result.ok).toBe(true)
    expect(result.dirty).toBe(false)
  })
})
