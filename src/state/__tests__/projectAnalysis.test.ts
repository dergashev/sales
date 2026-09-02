import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/vr3-demo-projects.json'
import { registeredProjectAssetIds } from '../../assets/project-media'
import {
  DEMO_PROJECTS,
  NORMAL_LIST_PROJECT_COUNT,
  activeDocumentId,
  advanceJob,
  affectedByDocuments,
  cancelJob,
  conflictResolved,
  demoProject,
  documentTypeTally,
  initialProjectAnalysis,
  isTerminal,
  openQuestions,
  overallProgressPercent,
  processedCount,
  projectBaselineSnapshot,
  readiness,
  recordQuestionResponse,
  removeDocument,
  replaceDocument,
  rerunJob,
  resolveConflict,
  retryDocument,
  seededCheckpoint,
  startJob,
  totalBgfRS,
  type FixtureProject,
  type ProjectAnalysis,
} from '../projectAnalysis'

/**
 * VR3-01 — the fixture and the gate, proved without rendering anything.
 *
 * Two different jobs live here and they are deliberately not mixed.
 *
 * The first is FIXTURE ARITHMETIC (CLAUDE.md rule 32): a number that does
 * not reconcile with its own fixture is a release blocker, so every count
 * and every sum the ticket declares an invariant is re-derived from the
 * committed JSON rather than restated. `src/fixtures/vr3-demo-projects.json`
 * is the repository's single source for these numbers; if someone edits a
 * document row and forgets the distribution, this file fails with the
 * address.
 *
 * The second is the STATE MACHINE and the GATE. Both are pure functions on
 * purpose: the hard gate ("unresolved blocking conflicts must be zero and
 * the required baseline complete") can therefore be proved as arithmetic,
 * not inferred from a screenshot.
 */

const A = demoProject('DEMO-HAPPY-01')!
const B = demoProject('DEMO-COMPLEX-01')!

/** Drive the job to completion the way the UI's ticker does. */
function runToCompletion(project: FixtureProject, from?: ProjectAnalysis): ProjectAnalysis {
  let analysis = from ?? startJob(project, initialProjectAnalysis(project), '2026-09-03T09:00:00.000Z')
  // A generous bound that still cannot mask a stall: five phases per file
  // plus slack. Exceeding it is a real defect, not a slow test.
  for (let i = 0; i < project.documents.length * 8; i++) {
    const next = advanceJob(project, analysis)
    if (next === analysis) break
    analysis = next
    if (analysis.jobState === 'COMPLETE') break
  }
  return analysis
}

describe('VR3-01 fixture invariants (rule 32 — a number must reconcile with its own fixture)', () => {
  it('the normal Project List contains exactly the two specified projects', () => {
    expect(NORMAL_LIST_PROJECT_COUNT).toBe(2)
    expect(DEMO_PROJECTS).toHaveLength(2)
    expect(DEMO_PROJECTS.map((p) => p.id)).toEqual(['DEMO-HAPPY-01', 'DEMO-COMPLEX-01'])
    // The declared count and the actual list cannot drift apart.
    expect(fixture.normalListProjectCount).toBe(fixture.projects.length)
  })

  it('Project A: 1 building, 8 documents, 0 conflicts, 0 blocking questions', () => {
    expect(A.buildings).toHaveLength(1)
    expect(A.documents).toHaveLength(8)
    expect(A.conflicts).toHaveLength(0)
    expect(A.questions.filter((q) => q.blocking)).toHaveLength(0)
    expect(A.terminalDistribution)
      .toEqual({ processed: 8, warning: 0, lowConfidence: 0, failed: 0 })
  })

  it('Project B: 3 buildings, 36 documents, 6 initial blocking conflicts', () => {
    expect(B.buildings).toHaveLength(3)
    expect(B.documents).toHaveLength(36)
    expect(B.conflicts.filter((c) => c.blocking)).toHaveLength(6)
    expect(B.conflicts.map((c) => c.id))
      .toEqual(['B-CF-01', 'B-CF-02', 'B-CF-03', 'B-CF-04', 'B-CF-05', 'B-CF-06'])
  })

  it('Project B terminal distribution is 28 + 4 + 3 + 1 = 36', () => {
    const { processed, warning, lowConfidence, failed } = B.terminalDistribution
    expect({ processed, warning, lowConfidence, failed })
      .toEqual({ processed: 28, warning: 4, lowConfidence: 3, failed: 1 })
    expect(processed + warning + lowConfidence + failed).toBe(36)
    // Declared distribution vs the register itself — the two cannot drift.
    const counted = { processed: 0, warning: 0, lowConfidence: 0, failed: 0 }
    const key = {
      PROCESSED: 'processed', WARNING: 'warning',
      LOW_CONFIDENCE: 'lowConfidence', FAILED: 'failed',
    } as const
    for (const doc of B.documents) counted[key[doc.processingOutcome]] += 1
    expect(counted).toEqual(B.terminalDistribution)
    expect(B.documents.filter((d) => d.processingOutcome === 'WARNING').map((d) => d.id))
      .toEqual(['B-DOC-13', 'B-DOC-21', 'B-DOC-34', 'B-DOC-36'])
    expect(B.documents.filter((d) => d.processingOutcome === 'LOW_CONFIDENCE').map((d) => d.id))
      .toEqual(['B-DOC-03', 'B-DOC-12', 'B-DOC-31'])
    expect(B.documents.filter((d) => d.processingOutcome === 'FAILED').map((d) => d.id))
      .toEqual(['B-DOC-24'])
  })

  it('Project B total BGF R+S is 19.470 m², summed from the buildings themselves', () => {
    expect(totalBgfRS(B)).toBe('19470.00')
    // Rule 39: a total is the sum of its parts, never a separately stored
    // number that can drift from them.
    const parts = B.buildings.map((b) => Number(b.metrics.bgfRSTotal))
    expect(parts.reduce((sum, x) => sum + x, 0)).toBe(19470)
    expect(parts).toEqual([6030, 5780, 7660])
  })

  it('every building reconciles R + S above ground and above + below ground', () => {
    for (const project of DEMO_PROJECTS) {
      for (const b of project.buildings) {
        const m = b.metrics
        expect(Number(m.bgfRAbove) + Number(m.bgfSAbove), `${b.id} R+S above`)
          .toBe(Number(m.bgfRSAbove))
        expect(Number(m.bgfRSAbove) + Number(m.bgfRSBelow), `${b.id} total`)
          .toBe(Number(m.bgfRSTotal))
      }
    }
    expect(totalBgfRS(A)).toBe('2900.00')
  })

  it('every referenced document, candidate and media asset actually exists', () => {
    const registered = new Set(registeredProjectAssetIds())
    for (const project of DEMO_PROJECTS) {
      const ids = new Set(project.documents.map((d) => d.id))
      expect(registered.has(project.heroAssetId), `${project.id} hero`).toBe(true)
      for (const b of project.buildings) {
        expect(registered.has(b.identityAssetId), `${b.id} identity`).toBe(true)
        expect(registered.has(b.planAssetId), `${b.id} plan`).toBe(true)
        for (const doc of b.evidenceDocIds) expect(ids.has(doc), `${b.id} → ${doc}`).toBe(true)
      }
      for (const doc of project.documents) {
        if (doc.previewAssetId) {
          expect(registered.has(doc.previewAssetId), `${doc.id} preview`).toBe(true)
        }
        if (doc.supersedes) expect(ids.has(doc.supersedes), `${doc.id} supersedes`).toBe(true)
        if (doc.duplicateOf) expect(ids.has(doc.duplicateOf), `${doc.id} duplicate`).toBe(true)
      }
      for (const conflict of project.conflicts) {
        for (const c of conflict.candidates) {
          expect(ids.has(c.docId), `${conflict.id} → ${c.docId}`).toBe(true)
        }
        expect(conflict.candidates.map((c) => c.id))
          .toContain(conflict.recommendedCandidateId)
      }
      for (const question of project.questions) {
        for (const doc of question.evidenceDocIds) {
          expect(ids.has(doc), `${question.id} → ${doc}`).toBe(true)
        }
      }
    }
  })

  it('the document-type tally is counted from the register, not stated on a screen', () => {
    // Project A: 3 floor plans, 2 elevations, 2 sections, 1 further document.
    expect(documentTypeTally(A)).toEqual([
      { documentType: 'floorPlan', count: 3 },
      { documentType: 'elevations', count: 2 },
      { documentType: 'section', count: 2 },
      { documentType: 'other', count: 1 },
    ])
    expect(documentTypeTally(A).reduce((n, e) => n + e.count, 0)).toBe(8)
    expect(documentTypeTally(B).reduce((n, e) => n + e.count, 0)).toBe(36)
  })

  it('duplicate and supersession relationships are inspectable', () => {
    const duplicate = B.documents.find((d) => d.id === 'B-DOC-13')!
    expect(duplicate.duplicateOf).toBe('B-DOC-06')
    expect(B.documents.find((d) => d.id === 'B-DOC-06')!.supersedes).toBe('B-DOC-05')
    expect(B.documents.find((d) => d.id === 'B-DOC-26')!.supersedes).toBe('B-DOC-25')
    expect(B.documents.find((d) => d.id === 'B-DOC-25')!.supersedes).toBe('B-DOC-24')
  })

  it('every document is attributed to the project or to a real building', () => {
    for (const doc of B.documents) {
      for (const id of doc.buildingIds) {
        expect(B.buildings.map((b) => b.id)).toContain(id)
      }
      expect(doc.projectLevel || doc.buildingIds.length === 1).toBe(true)
    }
  })
})

describe('the analysis job (per-file truth, never a page spinner)', () => {
  it('starts only through the Start action and reaches the declared distribution', () => {
    const fresh = initialProjectAnalysis(B)
    expect(fresh.jobState).toBe('NOT_STARTED')
    // Nothing advances a job that was never started.
    expect(advanceJob(B, fresh)).toBe(fresh)

    const finished = runToCompletion(B)
    expect(finished.jobState).toBe('COMPLETE')
    expect(processedCount(B, finished)).toBe(36)
    const states = B.documents.map((d) => finished.documents[d.id]!.state)
    expect(states.every(isTerminal)).toBe(true)
    expect(states.filter((s) => s === 'PROCESSED')).toHaveLength(28)
    expect(states.filter((s) => s === 'WARNING')).toHaveLength(4)
    expect(states.filter((s) => s === 'LOW_CONFIDENCE')).toHaveLength(3)
    expect(states.filter((s) => s === 'FAILED')).toHaveLength(1)
  })

  it('the clean route produces eight processed files and no attention at all', () => {
    const finished = runToCompletion(A)
    expect(finished.jobState).toBe('COMPLETE')
    expect(A.documents.every((d) => finished.documents[d.id]!.state === 'PROCESSED')).toBe(true)
  })

  it('a failed file makes the job PARTIAL FAILURE and the job still continues', () => {
    let analysis = startJob(B, initialProjectAnalysis(B), 'x')
    let sawPartialFailure = false
    for (let i = 0; i < B.documents.length * 8; i++) {
      analysis = advanceJob(B, analysis)
      if (analysis.jobState === 'PARTIAL_FAILURE') sawPartialFailure = true
      if (analysis.jobState === 'COMPLETE') break
    }
    expect(sawPartialFailure).toBe(true)
    // …and it still finished, because B-DOC-26 provides current replacement
    // evidence for the one file that failed.
    expect(analysis.jobState).toBe('COMPLETE')
    expect(analysis.documents['B-DOC-24']!.state).toBe('FAILED')
    expect(processedCount(B, analysis)).toBe(36)
  })

  it('overall progress is derived from the real denominator and never exceeds it', () => {
    let analysis = startJob(A, initialProjectAnalysis(A), 'x')
    expect(overallProgressPercent(A, analysis)).toBe(0)
    const seen: number[] = []
    for (let i = 0; i < 80; i++) {
      analysis = advanceJob(A, analysis)
      seen.push(overallProgressPercent(A, analysis))
      if (analysis.jobState === 'COMPLETE') break
    }
    expect(Math.max(...seen)).toBe(100)
    expect(seen.every((n) => n >= 0 && n <= 100)).toBe(true)
    // Monotonic: progress never goes backwards during one run.
    expect([...seen].sort((x, y) => x - y)).toEqual(seen)
  })

  it('names the file it is actually working on, and nothing while idle', () => {
    let analysis = startJob(A, initialProjectAnalysis(A), 'x')
    expect(activeDocumentId(A, analysis)).toBe('A-DOC-01')
    analysis = advanceJob(A, analysis)
    expect(analysis.documents['A-DOC-01']!.state).toBe('READING')
    const finished = runToCompletion(A)
    expect(activeDocumentId(A, finished)).toBeNull()
    expect(activeDocumentId(A, initialProjectAnalysis(A))).toBeNull()
  })

  it('cancelling keeps every completed file', () => {
    let analysis = startJob(A, initialProjectAnalysis(A), 'x')
    for (let i = 0; i < 12; i++) analysis = advanceJob(A, analysis)
    const doneBefore = processedCount(A, analysis)
    expect(doneBefore).toBeGreaterThan(0)
    const cancelled = cancelJob(analysis)
    expect(cancelled.jobState).toBe('NOT_STARTED')
    expect(processedCount(A, cancelled)).toBe(doneBefore)
  })

  it('retry re-queues one file and preserves the prior completed work', () => {
    const finished = runToCompletion(B)
    const retried = retryDocument(finished, 'B-DOC-24')
    expect(retried.documents['B-DOC-24']!.state).toBe('QUEUED')
    expect(retried.documents['B-DOC-24']!.retries).toBe(1)
    expect(retried.jobState).toBe('RUNNING')
    expect(processedCount(B, retried)).toBe(35)
    expect(retried.documents['B-DOC-06']!.state).toBe('PROCESSED')
  })

  it('replace links the old and the new evidence and removal keeps a record', () => {
    const finished = runToCompletion(B)
    const replaced = replaceDocument(B, finished, 'B-DOC-24', '24_C_Grundriss_UG_REV-C.pdf')
    expect(replaced.documents['B-DOC-24']!.replacementFile).toBe('24_C_Grundriss_UG_REV-C.pdf')
    expect(replaced.documents['B-DOC-24']!.state).toBe('QUEUED')

    const removed = removeDocument(B, finished, 'B-DOC-13', '2026-09-03T10:00:00.000Z')
    expect(removed.documents['B-DOC-13']!.removedAt).toBe('2026-09-03T10:00:00.000Z')
    // The row is still there — a removal is an audit record, not a deletion.
    expect(Object.keys(removed.documents)).toContain('B-DOC-13')
    expect(processedCount(B, removed)).toBe(35)
  })
})

describe('conflicts and the Create Option gate', () => {
  it('an incomplete analysis reports no conflicts — absence is not zero', () => {
    const fresh = initialProjectAnalysis(B)
    const state = readiness(B, fresh)
    expect(state.state).toBe('DOCUMENT_ANALYSIS_NOT_STARTED')
    // Six conflicts EXIST in the fixture; the analysis has not found them
    // yet, so the gate does not report a count it has not computed.
    expect(state.unresolvedBlockingConflicts).toBe(0)
    expect(state.canCreateOption).toBe(false)
    expect(state.lockReasonKey).toBe('vr3.gate.reason.analysisNotStarted')
    expect(state.requiredBaselineComplete).toBe(0)
  })

  it('the clean route is READY the moment the analysis completes', () => {
    const state = readiness(A, runToCompletion(A))
    expect(state.state).toBe('PROJECT_READY_FOR_OPTION')
    expect(state.canCreateOption).toBe(true)
    expect(state.unresolvedBlockingConflicts).toBe(0)
    expect(state.blockingQuestions).toBe(0)
    expect(state.lockReasonKey).toBeNull()
    expect(state.requiredBaselineComplete).toBe(state.requiredBaselineTotal)
  })

  it('six unresolved blocking conflicts lock the gate, and resolving them opens it one by one', () => {
    let analysis = runToCompletion(B)
    expect(readiness(B, analysis).state).toBe('BLOCKING_CONFLICTS_PRESENT')
    expect(readiness(B, analysis).unresolvedBlockingConflicts).toBe(6)
    expect(readiness(B, analysis).lockReasonKey).toBe('vr3.gate.reason.blockingConflicts')

    const countdown: number[] = []
    for (const conflict of B.conflicts) {
      analysis = resolveConflict(B, analysis, conflict.id, {
        kind: 'candidate', candidateId: conflict.recommendedCandidateId,
      }, '2026-09-03T11:00:00.000Z')
      countdown.push(readiness(B, analysis).unresolvedBlockingConflicts)
      expect(conflictResolved(analysis, conflict.id)).toBe(true)
    }
    expect(countdown).toEqual([5, 4, 3, 2, 1, 0])
    expect(readiness(B, analysis).state).toBe('PROJECT_READY_FOR_OPTION')
    expect(readiness(B, analysis).canCreateOption).toBe(true)
  })

  it('a resolution records its actor, its time and the value it rejected', () => {
    let analysis = runToCompletion(B)
    analysis = resolveConflict(B, analysis, 'B-CF-01', {
      kind: 'candidate', candidateId: 'B-CF-01-b',
    }, '2026-09-03T11:00:00.000Z')
    const decision = analysis.conflictDecisions['B-CF-01']!
    expect(decision.actor).toBe('sales-user')
    expect(decision.at).toBe('2026-09-03T11:00:00.000Z')
    // Rejected evidence stays visible historically.
    expect(decision.rejectedCandidateIds).toEqual(['B-CF-01-a'])
  })

  it('an authorised manual value is a first-class resolution with its reason', () => {
    let analysis = runToCompletion(B)
    analysis = resolveConflict(B, analysis, 'B-CF-01', {
      kind: 'manual', value: '19.470', reason: 'Aus dem Schnitt gemessen',
    }, 'x')
    const decision = analysis.conflictDecisions['B-CF-01']!
    expect(decision.choice).toEqual({
      kind: 'manual', value: '19.470', reason: 'Aus dem Schnitt gemessen',
    })
    // A manual value rejects BOTH candidates, and says so.
    expect(decision.rejectedCandidateIds).toEqual(['B-CF-01-a', 'B-CF-01-b'])
  })
})

describe('questions are not conflicts', () => {
  it('open questions do not gate, and permitted assumptions are explicit', () => {
    const analysis = runToCompletion(B)
    const state = readiness(B, analysis)
    // Seven items still need an answer or a review…
    expect(state.openQuestions).toBe(7)
    // …and NONE of them blocks. Only the six conflicts do.
    expect(state.blockingQuestions).toBe(0)
    expect(state.permittedAssumptions).toBeGreaterThan(0)
    expect(B.questions.filter((q) => q.blocking)).toHaveLength(0)
  })

  it('the two questions the fixture answers from source start answered', () => {
    const analysis = runToCompletion(B)
    const open = openQuestions(B, analysis).map((q) => q.id)
    expect(open).not.toContain('B-Q-03')
    expect(open).not.toContain('B-Q-07')
    expect(open).toContain('B-Q-01')
    expect(open).toContain('B-DS-01')
  })

  it('recording an answer or an assumption removes the item from the open queue', () => {
    let analysis = runToCompletion(B)
    const before = openQuestions(B, analysis).length
    analysis = recordQuestionResponse(analysis, 'B-Q-01', 'assumption', 'x')
    expect(openQuestions(B, analysis)).toHaveLength(before - 1)
    expect(analysis.questionResponses['B-Q-01']).toMatchObject({
      kind: 'assumption', actor: 'sales-user',
    })
  })
})

describe('re-analysis marks ONLY the affected values stale', () => {
  it('a replaced source invalidates the conflicts it evidences and nothing else', () => {
    let analysis = runToCompletion(B)
    for (const conflict of B.conflicts) {
      analysis = resolveConflict(B, analysis, conflict.id, {
        kind: 'candidate', candidateId: conflict.recommendedCandidateId,
      }, 'x')
    }
    expect(readiness(B, analysis).canCreateOption).toBe(true)

    // B-DOC-11 is Building A's current office area schedule; it evidences
    // B-CF-05 (Building A NUF) and nothing else.
    const affected = affectedByDocuments(B, ['B-DOC-11'])
    expect(affected.conflictIds).toEqual(['B-CF-05'])

    const stale = replaceDocument(B, analysis, 'B-DOC-11', '11_A_Bueroflaechen_V3.pdf')
    expect(stale.staleConflictIds).toEqual(['B-CF-05'])
    // The other five decisions are untouched — a source change must not
    // invalidate a confirmation it never touched.
    expect(conflictResolved(stale, 'B-CF-01')).toBe(true)
    expect(conflictResolved(stale, 'B-CF-05')).toBe(false)
    const state = readiness(B, stale)
    expect(state.state).not.toBe('PROJECT_READY_FOR_OPTION')
    expect(state.canCreateOption).toBe(false)
  })

  it('a rerun re-queues every file and counts itself', () => {
    const finished = runToCompletion(B)
    const rerun = rerunJob(B, finished, '2026-09-03T12:00:00.000Z')
    expect(rerun.jobState).toBe('RUNNING')
    expect(rerun.reanalysisCount).toBe(1)
    expect(processedCount(B, rerun)).toBe(0)
    // The decisions the user already made are NOT discarded by a rerun.
    const withDecision = resolveConflict(B, finished, 'B-CF-01', {
      kind: 'candidate', candidateId: 'B-CF-01-b',
    }, 'x')
    const rerunAfter = rerunJob(B, withDecision, 'x')
    expect(rerunAfter.conflictDecisions['B-CF-01']).toBeDefined()
  })
})

describe('the project baseline snapshot Option creation consumes', () => {
  it('carries the buildings, the total, the decisions and the open questions with their authority', () => {
    let analysis = runToCompletion(B)
    for (const conflict of B.conflicts) {
      analysis = resolveConflict(B, analysis, conflict.id, {
        kind: 'candidate', candidateId: conflict.recommendedCandidateId,
      }, 'x')
    }
    const snapshot = projectBaselineSnapshot(B, analysis, '2026-09-03T13:00:00.000Z')
    expect(snapshot.projectId).toBe('DEMO-COMPLEX-01')
    expect(snapshot.buildingCount).toBe(3)
    expect(snapshot.bgfRSTotal).toBe('19470.00')
    expect(snapshot.documentCount).toBe(36)
    expect(snapshot.conflictDecisions).toHaveLength(6)
    expect(snapshot.terminalDistribution).toEqual(B.terminalDistribution)
    // Authority travels WITH the value: a snapshot without provenance would
    // let a later stage present an assumption as a fact.
    expect(snapshot.buildings.map((b) => b.id))
      .toEqual(['B-BLDG-A', 'B-BLDG-B', 'B-BLDG-C'])
    expect(snapshot.buildings[0]!.authority.bgfRSTotal).toBeDefined()
    expect(snapshot.openQuestionIds.length).toBeGreaterThan(0)
    expect(snapshot.permittedAssumptionIds.every((id) => snapshot.openQuestionIds.includes(id)))
      .toBe(true)
  })
})

describe('the deterministic reset and the seeded checkpoint', () => {
  it('a reset returns both projects to NOT STARTED and keeps the full register', () => {
    for (const project of DEMO_PROJECTS) {
      const fresh = initialProjectAnalysis(project)
      expect(fresh.jobState).toBe('NOT_STARTED')
      expect(fresh.conflictDecisions).toEqual({})
      expect(fresh.questionResponses).toEqual({})
      expect(fresh.staleFactKeys).toEqual([])
      expect(Object.keys(fresh.documents)).toHaveLength(project.documents.length)
      expect(Object.values(fresh.documents).every((d) => d.state === 'QUEUED')).toBe(true)
    }
  })

  it('the seeded checkpoint is the same state the manual journey produces', () => {
    const seeded = seededCheckpoint(B, '2026-09-03T14:00:00.000Z')
    expect(seeded.jobState).toBe('COMPLETE')
    expect(processedCount(B, seeded)).toBe(36)
    expect(readiness(B, seeded).canCreateOption).toBe(true)
    expect(Object.keys(seeded.conflictDecisions)).toHaveLength(6)
    // …and it never becomes a third project.
    expect(DEMO_PROJECTS).toHaveLength(2)
  })
})
