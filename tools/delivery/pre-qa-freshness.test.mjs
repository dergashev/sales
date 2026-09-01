// tools/delivery/pre-qa-freshness.test.mjs
//
// Unit coverage for checkPreQaFreshness — DELIVERY-INFRA-01 REGRESSION
// CASE E (remote advances before QA).

import { describe, expect, it } from 'vitest'
import { checkPreQaFreshness } from './pre-qa-freshness.mjs'

describe('checkPreQaFreshness — unchanged authority', () => {
  it('remoteAdvanced=false, reconciliationRequired=false when the authoritative commit still equals the candidate base', () => {
    const result = checkPreQaFreshness({
      preQaAuthoritativeCommit: 'A',
      candidateCommit: 'B',
      candidateBase: 'A',
      authorityIsAncestorOfCandidate: null, // unreachable branch when unchanged; must not be consulted
    })
    expect(result.ok).toBe(true)
    expect(result.remoteAdvanced).toBe(false)
    expect(result.reconciliationRequired).toBe(false)
  })
})

describe('checkPreQaFreshness — CASE E: authority advanced', () => {
  it('reconciliationRequired=true when the candidate does not contain the new authoritative commits', () => {
    const result = checkPreQaFreshness({
      preQaAuthoritativeCommit: 'C',
      candidateCommit: 'B',
      candidateBase: 'A',
      authorityIsAncestorOfCandidate: false,
    })
    expect(result.ok).toBe(true)
    expect(result.remoteAdvanced).toBe(true)
    expect(result.reconciliationRequired).toBe(true)
    expect(result.reason).toMatch(/must NOT proceed on this candidate as-is/)
    expect(result.reason).toMatch(/never a silent rebase\/merge/)
  })

  it('reconciliationRequired=false when the candidate already contains every authoritative commit (rebuilt from a later base)', () => {
    const result = checkPreQaFreshness({
      preQaAuthoritativeCommit: 'C',
      candidateCommit: 'B',
      candidateBase: 'A',
      authorityIsAncestorOfCandidate: true,
    })
    expect(result.ok).toBe(true)
    expect(result.remoteAdvanced).toBe(true)
    expect(result.reconciliationRequired).toBe(false)
  })

  it('fails closed (reconciliationRequired=null, ok=false) when ancestry cannot be established', () => {
    const result = checkPreQaFreshness({
      preQaAuthoritativeCommit: 'C',
      candidateCommit: 'B',
      candidateBase: 'A',
      authorityIsAncestorOfCandidate: null,
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe(3)
    expect(result.reconciliationRequired).toBe(null)
  })

  it('always reports the three identifying SHAs verbatim, on every branch', () => {
    for (const authorityIsAncestorOfCandidate of [true, false, null]) {
      const result = checkPreQaFreshness({ preQaAuthoritativeCommit: 'C', candidateCommit: 'B', candidateBase: 'A', authorityIsAncestorOfCandidate })
      expect(result.preQaAuthoritativeCommit).toBe('C')
      expect(result.candidateCommit).toBe('B')
      expect(result.candidateBase).toBe('A')
    }
  })
})
