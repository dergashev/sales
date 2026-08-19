// tools/runtime/lib/preflight.test.mjs
//
// planTaskBasePreflight (scenarios I, J) and checkBrowserProvenance
// (scenarios K, L) — pure functions, no fs/git.

import { describe, expect, it } from 'vitest'
import { checkBrowserProvenance, planTaskBasePreflight } from './preflight.mjs'

describe('planTaskBasePreflight', () => {
  it('scenario J: already PINNED -> never re-evaluated, even though main has since advanced further', () => {
    const plan = planTaskBasePreflight({
      manifestEntry: { taskBaseCommit: 'A', pinnedAt: '2026-01-01T00:00:00.000Z' },
      mainSha: 'M2-much-later',
      headSha: 'A',
      mainIsAncestorOfHead: false, // even if it WOULD now look stale, pinned wins
    })
    expect(plan.action).toBe('pinned')
    expect(plan.code).toBe(0)
    expect(plan.taskBaseCommit).toBe('A')
  })

  it('scenario I: no pin yet, main is NOT an ancestor of head -> stale, exit 2, requires a fresh worktree', () => {
    const plan = planTaskBasePreflight({ manifestEntry: null, mainSha: 'B', headSha: 'A-old', mainIsAncestorOfHead: false })
    expect(plan.action).toBe('stale')
    expect(plan.code).toBe(2)
    expect(plan.unblockingRequirement).toMatch(/fresh/i)
  })

  it('fresh and current -> pin, recording head as taskBaseCommit', () => {
    const plan = planTaskBasePreflight({ manifestEntry: null, mainSha: 'B', headSha: 'B-plus-work', mainIsAncestorOfHead: true })
    expect(plan.action).toBe('pin')
    expect(plan.code).toBe(0)
    expect(plan.taskBaseCommit).toBe('B-plus-work')
  })

  it('an existing manifest entry with no taskBaseCommit yet is treated as "no pin yet", not as already pinned', () => {
    const plan = planTaskBasePreflight({ manifestEntry: { sha: 'B-plus-work' }, mainSha: 'B', headSha: 'B-plus-work', mainIsAncestorOfHead: true })
    expect(plan.action).toBe('pin')
  })

  it('git ancestry check itself failing (null) -> blocked, code 3, never guessed', () => {
    const plan = planTaskBasePreflight({ manifestEntry: null, mainSha: 'B', headSha: 'A', mainIsAncestorOfHead: null })
    expect(plan.action).toBe('blocked')
    expect(plan.code).toBe(3)
  })
})

describe('checkBrowserProvenance', () => {
  const base = { expectedPurpose: 'CURRENT_MAIN', expectedSha: 'M2' }

  it('scenario L: verified status + matching purpose/sha -> VERIFIED', () => {
    const result = checkBrowserProvenance({ ...base, actualPurpose: 'CURRENT_MAIN', actualSha: 'M2', status: 'SERVING_VERIFIED' })
    expect(result.verified).toBe(true)
    expect(result.label).toBe('VERIFIED')
  })

  it('scenario K: runtime serves the wrong sha -> BLOCKED, labeled per purpose (CURRENT_MAIN -> STALE CURRENT_MAIN RUNTIME)', () => {
    const result = checkBrowserProvenance({ ...base, actualPurpose: 'CURRENT_MAIN', actualSha: 'M1-old', status: 'SERVING_VERIFIED' })
    expect(result.verified).toBe(false)
    expect(result.label).toBe('BLOCKED — STALE CURRENT_MAIN RUNTIME')
  })

  it('a REVIEW_CANDIDATE consumer serving the wrong implementationCommit -> BLOCKED — TARGET RUNTIME PROVENANCE NOT VERIFIED', () => {
    const result = checkBrowserProvenance({ expectedPurpose: 'REVIEW_CANDIDATE', expectedSha: 'C', actualPurpose: 'REVIEW_CANDIDATE', actualSha: 'D', status: 'SERVING_VERIFIED' })
    expect(result.verified).toBe(false)
    expect(result.label).toBe('BLOCKED — TARGET RUNTIME PROVENANCE NOT VERIFIED')
  })

  it('status is not SERVING_VERIFIED at all (e.g. UNVERIFIED) -> BLOCKED regardless of what the runtime claims', () => {
    const result = checkBrowserProvenance({ ...base, actualPurpose: 'CURRENT_MAIN', actualSha: 'M2', status: 'UNVERIFIED' })
    expect(result.verified).toBe(false)
  })

  it('purpose mismatch alone (e.g. a TASK_CANDIDATE runtime answering a CURRENT_MAIN consumer) -> BLOCKED', () => {
    const result = checkBrowserProvenance({ ...base, actualPurpose: 'TASK_CANDIDATE', actualSha: 'M2', status: 'SERVING_VERIFIED' })
    expect(result.verified).toBe(false)
  })
})
