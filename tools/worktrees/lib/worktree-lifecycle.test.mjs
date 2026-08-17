// tools/worktrees/lib/worktree-lifecycle.test.mjs
//
// Pure unit tests for the decision tables — injected fixtures, no real git
// process, no filesystem. Mirrors tools/gate/lib/resolve-candidate.test.mjs.
// Real-git integration (including the actual "locked survives prune"
// mechanism these decision tables are built around) is covered separately
// in worktree-lifecycle.integration.test.mjs.

import { describe, expect, it } from 'vitest'
import { planPreviewRefresh, planReleaseWorktreeCleanup } from './worktree-lifecycle.mjs'

function entry(overrides = {}) {
  return { path: '/repo/.worktrees/release-integration', sha: 'a'.repeat(40), branch: 'main', detached: false, locked: false, lockReason: null, prunable: false, prunableReason: null, ...overrides }
}

const MAIN = entry()
const OTHER = { path: '/repo/.worktrees/other', sha: 'b'.repeat(40), branch: 'feature/x', detached: false, locked: false, lockReason: null, prunable: false, prunableReason: null }
const PREVIEW = { path: '/repo/.preview/main', sha: MAIN.sha, branch: null, detached: true, locked: false, lockReason: null, prunable: false, prunableReason: null }

const samePath = (a, b) => a === b

describe('planReleaseWorktreeCleanup', () => {
  function baseOpts(overrides = {}) {
    return {
      worktrees: [MAIN, OTHER],
      targetPath: MAIN.path,
      dirtyEntriesFn: () => [],
      samePathFn: samePath,
      force: false,
      unlock: false,
      ...overrides,
    }
  }

  it('blocks (code 3) when git worktree list itself failed', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ worktrees: null }))
    expect(plan).toEqual({ action: 'blocked', code: 3, reason: expect.stringContaining('worktree list') })
  })

  it('is a no-op when the target path is not registered at all', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ targetPath: '/repo/.worktrees/never-existed' }))
    expect(plan.action).toBe('noop')
  })

  it('prunes when git itself reports the registered entry prunable (the recoverable stale shape)', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ worktrees: [entry({ prunable: true, prunableReason: 'gitdir file points to non-existent location' }), OTHER] }))
    expect(plan.action).toBe('prune')
  })

  it('blocks (code 2) with an --unlock escape hatch when the entry is locked — never auto-unlocks', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ worktrees: [entry({ locked: true, lockReason: 'release in progress' }), OTHER] }))
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(2)
    expect(plan.reason).toContain('release in progress')
    expect(plan.unblockingRequirement).toContain('--unlock')
  })

  it('defers to unlock-then-replan when locked and --unlock was given, regardless of prunable/dirty (git never computes those for a locked entry)', () => {
    const plan = planReleaseWorktreeCleanup(
      baseOpts({ worktrees: [entry({ locked: true, lockReason: 'release in progress', prunable: true, prunableReason: 'gone' }), OTHER], unlock: true }),
    )
    expect(plan.action).toBe('unlock-then-replan')
  })

  it('unlock-then-replan is chosen for a locked-and-clean entry too — the caller must re-list, never guess', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ worktrees: [entry({ locked: true, lockReason: 'x' }), OTHER], unlock: true }))
    expect(plan.action).toBe('unlock-then-replan')
  })

  it('blocks (code 2) on a dirty worktree without --force', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ dirtyEntriesFn: () => ['src/App.tsx'] }))
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(2)
  })

  it('ignores advisory-only dirty entries (tsconfig.tsbuildinfo) and still removes', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ dirtyEntriesFn: () => ['tsconfig.tsbuildinfo'] }))
    expect(plan.action).toBe('remove')
  })

  it('removes (without force) a clean, present, registered, unlocked worktree', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts())
    expect(plan).toMatchObject({ action: 'remove', force: false, sha: MAIN.sha, branch: 'main' })
  })

  it('removes with force=true when dirty and --force was given', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ dirtyEntriesFn: () => ['src/App.tsx'], force: true }))
    expect(plan).toMatchObject({ action: 'remove', force: true })
  })

  it('blocks (code 3) when git status itself failed', () => {
    const plan = planReleaseWorktreeCleanup(baseOpts({ dirtyEntriesFn: () => null }))
    expect(plan).toEqual({ action: 'blocked', code: 3, reason: expect.stringContaining('status --porcelain') })
  })
})

describe('planPreviewRefresh', () => {
  function baseOpts(overrides = {}) {
    return {
      mainSha: MAIN.sha,
      worktrees: [MAIN, OTHER],
      previewPath: PREVIEW.path,
      existsFn: () => false,
      dirtyEntriesFn: () => [],
      samePathFn: samePath,
      ...overrides,
    }
  }

  it('blocks when main itself did not resolve', () => {
    const plan = planPreviewRefresh(baseOpts({ mainSha: null }))
    expect(plan).toEqual({ action: 'blocked', code: 2, reason: expect.stringContaining('rev-parse main') })
  })

  it('blocks (code 3) when git worktree list itself failed', () => {
    const plan = planPreviewRefresh(baseOpts({ worktrees: null }))
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(3)
  })

  it('creates when the preview is not registered and the directory does not exist', () => {
    const plan = planPreviewRefresh(baseOpts())
    expect(plan).toEqual({ action: 'create', sha: MAIN.sha })
  })

  it('refuses to guess when the preview directory exists but is not a registered worktree', () => {
    const plan = planPreviewRefresh(baseOpts({ existsFn: () => true }))
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(3)
  })

  it('blocks when the registered preview is locked (dev:main never locks its own preview)', () => {
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, { ...PREVIEW, locked: true, lockReason: 'x' }] }))
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(3)
  })

  it('recreates when the registered preview is stale/prunable', () => {
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, { ...PREVIEW, prunable: true, prunableReason: 'gone' }] }))
    expect(plan).toMatchObject({ action: 'recreate', sha: MAIN.sha })
  })

  it('reuses when the preview is already pinned to current main', () => {
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, PREVIEW] }))
    expect(plan).toEqual({ action: 'reuse', sha: MAIN.sha })
  })

  it('checks out the new SHA when the preview is registered, clean, but behind main', () => {
    const behind = { ...PREVIEW, sha: 'c'.repeat(40) }
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, behind], dirtyEntriesFn: () => [] }))
    expect(plan).toEqual({ action: 'checkout', sha: MAIN.sha, from: behind.sha })
  })

  it('refuses (never discards) a dirty preview that is behind main', () => {
    const behind = { ...PREVIEW, sha: 'c'.repeat(40) }
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, behind], dirtyEntriesFn: () => ['src/App.tsx'] }))
    expect(plan.action).toBe('refuse-dirty')
    expect(plan.code).toBe(2)
    expect(plan.dirty).toEqual(['src/App.tsx'])
  })

  it('ignores advisory-only dirty entries when deciding whether to refuse', () => {
    const behind = { ...PREVIEW, sha: 'c'.repeat(40) }
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, behind], dirtyEntriesFn: () => ['tsconfig.tsbuildinfo'] }))
    expect(plan.action).toBe('checkout')
  })

  it('blocks (code 3) when git status itself failed while checking a behind-main preview', () => {
    const behind = { ...PREVIEW, sha: 'c'.repeat(40) }
    const plan = planPreviewRefresh(baseOpts({ worktrees: [MAIN, OTHER, behind], dirtyEntriesFn: () => null }))
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(3)
  })
})
