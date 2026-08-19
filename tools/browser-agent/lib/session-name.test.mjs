import { describe, expect, it } from 'vitest'
import { deriveSessionName, isValidPurpose, shortSha, slug } from './session-name.mjs'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

describe('isValidPurpose', () => {
  it('accepts exactly the three Runtime Provenance purposes', () => {
    expect(isValidPurpose('CURRENT_MAIN')).toBe(true)
    expect(isValidPurpose('TASK_CANDIDATE')).toBe(true)
    expect(isValidPurpose('REVIEW_CANDIDATE')).toBe(true)
    expect(isValidPurpose('SOMETHING_ELSE')).toBe(false)
    expect(isValidPurpose(undefined)).toBe(false)
  })
})

describe('shortSha', () => {
  it('takes the first 12 characters', () => {
    expect(shortSha(SHA)).toBe(SHA.slice(0, 12))
  })

  it('refuses anything that is not plausibly a full sha', () => {
    expect(() => shortSha('abc')).toThrow(/full git sha/)
    expect(() => shortSha(undefined)).toThrow()
  })
})

describe('slug', () => {
  it('lowercases and collapses non [a-z0-9-] runs to a single dash', () => {
    expect(slug('Engineering QA / Lane #1')).toBe('engineering-qa-lane-1')
    expect(slug('already-fine')).toBe('already-fine')
  })
})

describe('deriveSessionName', () => {
  it('CURRENT_MAIN never needs a lane and is a singleton by naming', () => {
    expect(deriveSessionName({ purpose: 'CURRENT_MAIN', sha: SHA })).toBe(`current-main-${SHA.slice(0, 12)}`)
  })

  it('TASK_CANDIDATE requires a lane, distinguishing concurrent candidates at the same sha', () => {
    expect(deriveSessionName({ purpose: 'TASK_CANDIDATE', sha: SHA, lane: 'engineering' })).toBe(`task-engineering-${SHA.slice(0, 12)}`)
    expect(() => deriveSessionName({ purpose: 'TASK_CANDIDATE', sha: SHA })).toThrow(/--lane is required/)
  })

  it('REVIEW_CANDIDATE requires a lane, distinguishing concurrent reviewers at the same implementationCommit', () => {
    expect(deriveSessionName({ purpose: 'REVIEW_CANDIDATE', sha: SHA, lane: 'engineering-qa' })).toBe(`review-engineering-qa-${SHA.slice(0, 12)}`)
    expect(() => deriveSessionName({ purpose: 'REVIEW_CANDIDATE', sha: SHA, lane: '   ' })).toThrow(/--lane is required/)
  })

  it('a different sha always produces a different name (structural sha-keyed supersession)', () => {
    const other = 'b'.repeat(40)
    expect(deriveSessionName({ purpose: 'CURRENT_MAIN', sha: SHA })).not.toBe(deriveSessionName({ purpose: 'CURRENT_MAIN', sha: other }))
  })

  it('rejects an unknown purpose outright', () => {
    expect(() => deriveSessionName({ purpose: 'REVIEW_CANDIDATE_TYPO', sha: SHA, lane: 'x' })).toThrow(/purpose must be one of/)
  })
})
