// tools/delivery/root-guard.test.mjs
//
// Unit coverage for checkRootCheckoutGuard — DELIVERY-INFRA-01 REGRESSION
// CASE C (direct root implementation attempt).

import { describe, expect, it } from 'vitest'
import { checkRootCheckoutGuard, isProductPath } from './root-guard.mjs'

const samePathFn = (a, b) => a === b

describe('checkRootCheckoutGuard — isolated worktree (never the root)', () => {
  it('always ok when the target is not the root checkout, in either mode', () => {
    for (const mode of ['preflight', 'commit']) {
      const result = checkRootCheckoutGuard({ repoRoot: '/repo', targetPath: '/repo/.worktrees/task-1', samePathFn, mode })
      expect(result.ok).toBe(true)
      expect(result.isRootCheckout).toBe(false)
    }
  })
})

describe('checkRootCheckoutGuard — CASE C: preflight mode blocks the root checkout unconditionally', () => {
  it('blocks even with zero changed paths — the hard gate applies before any Product-code modification', () => {
    const result = checkRootCheckoutGuard({ repoRoot: '/repo', targetPath: '/repo', samePathFn, mode: 'preflight', changedPaths: [] })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.isRootCheckout).toBe(true)
    expect(result.reason).toMatch(/root release checkout/i)
    expect(result.unblockingRequirement).toMatch(/isolated task worktree/i)
  })

  it('blocks regardless of what changed — preflight mode never inspects changedPaths', () => {
    const result = checkRootCheckoutGuard({ repoRoot: '/repo', targetPath: '/repo', samePathFn, mode: 'preflight', changedPaths: ['docs/tooling/x.md'] })
    expect(result.ok).toBe(false)
  })
})

describe('checkRootCheckoutGuard — commit mode: retroactive, Product-path-scoped', () => {
  it('allows a root-checkout commit that touches only delivery-infra/docs paths', () => {
    const result = checkRootCheckoutGuard({
      repoRoot: '/repo',
      targetPath: '/repo',
      samePathFn,
      mode: 'commit',
      changedPaths: ['tools/delivery/root-guard.mjs', 'docs/tooling/delivery-lifecycle.md', 'package.json'],
    })
    expect(result.ok).toBe(true)
    expect(result.isRootCheckout).toBe(true)
  })

  it('blocks a root-checkout commit that stages a Product-owned path', () => {
    const result = checkRootCheckoutGuard({
      repoRoot: '/repo',
      targetPath: '/repo',
      samePathFn,
      mode: 'commit',
      changedPaths: ['tools/delivery/root-guard.mjs', 'src/components/Offer.tsx'],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(result.productChanges).toEqual(['src/components/Offer.tsx'])
  })

  it('blocks on design-system/ and docs/product/ and docs/audit/ paths too', () => {
    for (const p of ['design-system/tokens.css', 'docs/product/decisions.md', 'docs/audit/remediation-plan.md']) {
      const result = checkRootCheckoutGuard({ repoRoot: '/repo', targetPath: '/repo', samePathFn, mode: 'commit', changedPaths: [p] })
      expect(result.ok).toBe(false)
    }
  })

  it('defaults to commit mode when mode is omitted', () => {
    const result = checkRootCheckoutGuard({ repoRoot: '/repo', targetPath: '/repo', samePathFn, changedPaths: [] })
    expect(result.ok).toBe(true)
  })
})

describe('isProductPath', () => {
  it('classifies src/, design-system/, docs/product/, docs/audit/ as Product-owned', () => {
    expect(isProductPath('src/App.tsx')).toBe(true)
    expect(isProductPath('design-system/tokens.css')).toBe(true)
    expect(isProductPath('docs/product/decisions.md')).toBe(true)
    expect(isProductPath('docs/audit/remediation-plan.md')).toBe(true)
  })

  it('does not classify tools/, docs/tooling/, or repo-root plumbing as Product-owned', () => {
    expect(isProductPath('tools/delivery/preflight.mjs')).toBe(false)
    expect(isProductPath('docs/tooling/delivery-lifecycle.md')).toBe(false)
    expect(isProductPath('package.json')).toBe(false)
    expect(isProductPath('.agentsroom/sessions/x.json')).toBe(false)
  })
})
