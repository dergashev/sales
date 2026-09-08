import { describe, expect, it } from 'vitest'
import {
  DECLARABLE_LIFECYCLE_STATUSES,
  EXPLICIT_PROJECT_HOLDS,
  LIFECYCLE_STATUSES,
  analysisLifecycleFacts,
  deriveProjectLifecycle,
  isDeclarableLifecycleStatus,
  isExplicitProjectHold,
  lifecycleStatusKey,
  lifecycleStatusTone,
  projectBaselineIdOf,
  projectLifecycleStatus,
  projectReadyToPitch,
  savedVersionFingerprint,
  loadedOptionFacts,
  type LoadedOptionFacts,
  type ProjectReadinessRecord,
} from '../projectLifecycle'
import {
  DEMO_PROJECTS,
  initialProjectAnalysis,
  type ProjectAnalysis,
} from '../projectAnalysis'
import { CLIENT_PROJECTION_VERSION, type SavedOptionVersion } from '../optionSave'
import {
  PORTFOLIO_PROJECTS,
  resolveProjectLifecycles,
} from '../projectPortfolio'

const A = DEMO_PROJECTS[0]!
const P = A.id

/* ───────────────────────────── fixtures ─────────────────────────────── */

const BASELINE = { projectId: P, at: '2026-09-08T09:00:00.000Z' }
const BASELINE_ID = projectBaselineIdOf(BASELINE)!

function version(over: Partial<SavedOptionVersion> = {}): SavedOptionVersion {
  return {
    optionId: 'OPT-1',
    optionName: 'Basis',
    version: 1,
    savedAt: '2026-09-08T10:00:00.000Z',
    savedBy: 'sales-user',
    projectBaselineId: BASELINE_ID,
    buildingScopeFingerprint: 'scope-1',
    configurationFingerprint: 'config-1',
    scheduleFingerprint: 'schedule-1',
    reviewFingerprint: 'review-1',
    clientProjectionVersion: CLIENT_PROJECTION_VERSION,
    clientProjectionValid: true,
    result: {
      totalExact: '1000',
      totalDisplay: '1.000',
      totalLabel: 'Gesamt netto',
      coverage: 'total',
      uncertaintyPp: 5,
      resultVersion: 1,
      byCostGroup: [],
    },
    ...over,
  } as SavedOptionVersion
}

function options(over: Partial<LoadedOptionFacts> = {}): LoadedOptionFacts {
  return {
    projectId: P,
    savedVersions: [version()],
    currentProjectBaselineId: BASELINE_ID,
    baselineChangesSinceConfirmation: [],
    ...over,
  }
}

function reviewed(over: Partial<ProjectReadinessRecord> = {}): ProjectReadinessRecord {
  return {
    reviewedOptionId: 'OPT-1',
    reviewedFingerprint: savedVersionFingerprint(version()),
    reviewedBy: 'sales-user',
    reviewedAt: '2026-09-08T11:00:00.000Z',
    requiredExportMaterialsAvailable: true,
    ...over,
  }
}

function analysis(over: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return { ...initialProjectAnalysis(A), ...over }
}

/* ───────────────────────── the closed vocabulary ────────────────────── */

describe('the lifecycle vocabulary is closed and every member is renderable', () => {
  it('maps all seven statuses onto a key and a canonical tone', () => {
    expect(LIFECYCLE_STATUSES).toHaveLength(7)
    for (const status of LIFECYCLE_STATUSES) {
      expect(lifecycleStatusKey(status)).toBe(`portfolio.status.${status}`)
      expect(['neutral', 'progress', 'ok', 'attention', 'stale'])
        .toContain(lifecycleStatusTone(status))
    }
  })

  it('lets a fixture declare only what a derivation must never invent', () => {
    // The three explicit holds are somebody's statement about the project.
    // Nothing derives them: an unanswered question inside the analysis is not
    // «waiting for the client», and inferring it would make every incomplete
    // project a waiting one.
    for (const hold of EXPLICIT_PROJECT_HOLDS) {
      expect(isExplicitProjectHold(hold)).toBe(true)
      expect(LIFECYCLE_STATUSES).toContain(hold)
    }
    expect(isExplicitProjectHold('ready_to_pitch')).toBe(false)
    expect(isExplicitProjectHold('review_required')).toBe(false)
    // A synthetic register record may declare a state it can honestly be in,
    // and never one that asserts a state of the product.
    expect(isDeclarableLifecycleStatus('ready_to_pitch')).toBe(false)
    expect(isDeclarableLifecycleStatus('review_required')).toBe(false)
    expect(DECLARABLE_LIFECYCLE_STATUSES).toHaveLength(5)
  })
})

/* ───────────────────────────── the decision ─────────────────────────── */

describe('facts decide the status, and the precedence is the model’s', () => {
  const base = {
    hold: null, workCommitted: false, confirmedTruthStale: false, readyToPitch: false,
  } as const

  it('starts at New and needs nothing to be true', () => {
    expect(projectLifecycleStatus(base)).toBe('new')
  })

  it('lets a human statement outrank every derivation', () => {
    // A project a person parked is parked, even if it is also ready and also
    // has stale truth. The alternative — a derivation that overrides what
    // somebody recorded — is the same class of defect as a re-analysis
    // overwriting a confirmed value.
    for (const hold of EXPLICIT_PROJECT_HOLDS) {
      expect(projectLifecycleStatus({
        hold, workCommitted: true, confirmedTruthStale: true, readyToPitch: true,
      })).toBe(hold)
    }
  })

  it('puts Ready to pitch above Review required, and both above In progress', () => {
    expect(projectLifecycleStatus({ ...base, readyToPitch: true })).toBe('ready_to_pitch')
    expect(projectLifecycleStatus({ ...base, confirmedTruthStale: true }))
      .toBe('review_required')
    // Stale truth outranks «work exists»: the point of the status is that
    // somebody must look at something, and that is true mid-flight too.
    expect(projectLifecycleStatus({
      ...base, workCommitted: true, confirmedTruthStale: true,
    })).toBe('review_required')
    expect(projectLifecycleStatus({ ...base, workCommitted: true })).toBe('in_progress')
  })

  it('is total: every combination produces one of the seven', () => {
    for (const hold of [null, ...EXPLICIT_PROJECT_HOLDS]) {
      for (const workCommitted of [false, true]) {
        for (const confirmedTruthStale of [false, true]) {
          for (const readyToPitch of [false, true]) {
            expect(LIFECYCLE_STATUSES).toContain(projectLifecycleStatus({
              hold, workCommitted, confirmedTruthStale, readyToPitch,
            }))
          }
        }
      }
    }
  })
})

describe('the facts come from the analysis every project carries', () => {
  it('calls an untouched project untouched — a visit is not work', () => {
    const facts = analysisLifecycleFacts(initialProjectAnalysis(A))
    expect(facts).toEqual({ workCommitted: false, confirmedTruthStale: false })
    // And a project with no analysis record at all is the same answer, not a
    // crash and not an optimistic one.
    expect(analysisLifecycleFacts(undefined))
      .toEqual({ workCommitted: false, confirmedTruthStale: false })
  })

  it('counts any committed work, from four independent signals', () => {
    expect(analysisLifecycleFacts(analysis({ jobState: 'RUNNING' })).workCommitted).toBe(true)
    expect(analysisLifecycleFacts(analysis({
      conflictDecisions: {
        'CF-1': { conflictId: 'CF-1', choice: { kind: 'candidate', candidateId: 'c' }, rejectedCandidateIds: [], actor: 'a', at: 'now' },
      },
    })).workCommitted).toBe(true)
    expect(analysisLifecycleFacts(analysis({
      questionResponses: {
        'Q-1': { questionId: 'Q-1', kind: 'answer', actor: 'a', at: 'now' },
      },
    })).workCommitted).toBe(true)
    expect(analysisLifecycleFacts(analysis({
      baselineCommittedAt: '2026-09-08T09:00:00.000Z',
    })).workCommitted).toBe(true)
  })

  it('reads invalidated confirmed truth from stale facts and reopened conflicts', () => {
    expect(analysisLifecycleFacts(analysis({ staleFactKeys: ['A-BLDG-01:wfl'] }))
      .confirmedTruthStale).toBe(true)
    expect(analysisLifecycleFacts(analysis({ staleConflictIds: ['B-CF-05'] }))
      .confirmedTruthStale).toBe(true)
  })
})

/* ─────────────────────── the readiness conjunction ──────────────────── */

describe('Ready to pitch is a conjunction, and every conjunct can refuse it', () => {
  it('is true only when the whole predicate holds', () => {
    expect(projectReadyToPitch({
      projectId: P, readiness: reviewed(), options: options(), confirmedTruthStale: false,
    })).toBe(true)
  })

  it('refuses a project nobody reviewed — which is every project today', () => {
    // The ledger is empty at boot and no fixture may seed it, so this is the
    // reason no demonstration project starts ready: not a stub, a fact.
    expect(projectReadyToPitch({
      projectId: P, readiness: undefined, options: options(), confirmedTruthStale: false,
    })).toBe(false)
  })

  it('refuses stale confirmed truth, whatever the Option says', () => {
    expect(projectReadyToPitch({
      projectId: P, readiness: reviewed(), options: options(), confirmedTruthStale: true,
    })).toBe(false)
  })

  it('refuses a review of a version whose fingerprint has moved', () => {
    // A review acknowledges a FINGERPRINT. A changed fingerprint is an
    // unreviewed Option wearing a reviewed Option's id.
    expect(projectReadyToPitch({
      projectId: P,
      readiness: reviewed({ reviewedFingerprint: 'something-else' }),
      options: options(),
      confirmedTruthStale: false,
    })).toBe(false)
    expect(projectReadyToPitch({
      projectId: P,
      readiness: reviewed(),
      options: options({ savedVersions: [version({ configurationFingerprint: 'config-2' })] }),
      confirmedTruthStale: false,
    })).toBe(false)
  })

  it('refuses when a required export material is not available', () => {
    // Availability is the requirement. Downloading is not, and this test is
    // the boundary: the predicate must not acquire a file-was-fetched clause.
    expect(projectReadyToPitch({
      projectId: P,
      readiness: reviewed({ requiredExportMaterialsAvailable: false }),
      options: options(),
      confirmedTruthStale: false,
    })).toBe(false)
  })

  it('refuses a saved version the client projection would not show', () => {
    for (const broken of [
      version({ clientProjectionValid: false }),
      version({ clientProjectionVersion: CLIENT_PROJECTION_VERSION - 1 }),
    ]) {
      expect(projectReadyToPitch({
        projectId: P,
        readiness: reviewed({ reviewedFingerprint: savedVersionFingerprint(broken) }),
        options: options({ savedVersions: [broken] }),
        confirmedTruthStale: false,
      })).toBe(false)
    }
  })

  it('refuses a version saved against project truth that has since moved', () => {
    expect(projectReadyToPitch({
      projectId: P,
      readiness: reviewed(),
      options: options({ currentProjectBaselineId: `${P}@2026-09-09T09:00:00.000Z` }),
      confirmedTruthStale: false,
    })).toBe(false)
    expect(projectReadyToPitch({
      projectId: P,
      readiness: reviewed(),
      options: options({ baselineChangesSinceConfirmation: ['WFL nach WoFlV'] }),
      confirmedTruthStale: false,
    })).toBe(false)
  })

  it('never reads one project’s ledger against another project’s workspace', () => {
    // The per-project storage split means only ONE project's Options are in
    // memory. Answering «is this project ready» from whichever workspace
    // happens to be open is the cross-project leak that split closed, one
    // level up.
    expect(projectReadyToPitch({
      projectId: 'DEMO-COMPLEX-01',
      readiness: reviewed(),
      options: options(),
      confirmedTruthStale: false,
    })).toBe(false)
    expect(projectReadyToPitch({
      projectId: P, readiness: reviewed(), options: null, confirmedTruthStale: false,
    })).toBe(false)
  })
})

/* ─────────────────────── the whole derivation ───────────────────────── */

describe('deriveProjectLifecycle, end to end', () => {
  it('derives New for a project nobody has touched', () => {
    expect(deriveProjectLifecycle({
      projectId: P, hold: null, analysis: initialProjectAnalysis(A),
      readiness: undefined, options: null,
    })).toBe('new')
  })

  it('derives Review required from a baseline that moved after confirmation', () => {
    // Visible only while the project's own workspace is loaded, and it counts
    // as BOTH work and stale truth: a baseline cannot move before it exists.
    expect(deriveProjectLifecycle({
      projectId: P, hold: null, analysis: initialProjectAnalysis(A),
      readiness: undefined,
      options: options({ baselineChangesSinceConfirmation: ['BGF'] }),
    })).toBe('review_required')
  })

  it('derives Ready to pitch only with the complete record', () => {
    expect(deriveProjectLifecycle({
      projectId: P, hold: null,
      analysis: analysis({ jobState: 'COMPLETE', baselineCommittedAt: 'then' }),
      readiness: reviewed(), options: options(),
    })).toBe('ready_to_pitch')
  })
})

/* ──────────────────── the register’s one producer ───────────────────── */

describe('resolveProjectLifecycles is the only producer of a status', () => {
  it('stamps every record exactly once, in order', () => {
    const rows = resolveProjectLifecycles(PORTFOLIO_PROJECTS, {
      analyses: {}, readiness: {}, options: null,
    })
    expect(rows.map((row) => row.id)).toEqual(PORTFOLIO_PROJECTS.map((p) => p.id))
    for (const row of rows) expect(LIFECYCLE_STATUSES).toContain(row.lifecycleStatus)
  })

  it('gives a fresh session no ready project and no review-required project', () => {
    const rows = resolveProjectLifecycles(PORTFOLIO_PROJECTS, {
      analyses: {}, readiness: {}, options: null,
    })
    expect(rows.filter((row) => row.lifecycleStatus === 'ready_to_pitch')).toEqual([])
    expect(rows.filter((row) => row.lifecycleStatus === 'review_required')).toEqual([])
  })

  it('moves a navigable card when its own project state moves, and no other', () => {
    const rows = resolveProjectLifecycles(PORTFOLIO_PROJECTS, {
      analyses: { [P]: analysis({ staleFactKeys: ['A-BLDG-01:wfl'] }) },
      readiness: {},
      options: null,
    })
    const byId = new Map(rows.map((row) => [row.id, row.lifecycleStatus]))
    expect(byId.get(P)).toBe('review_required')
    // The other navigable project is untouched, and a synthetic record keeps
    // declaring its own state — it has no journey to derive from.
    expect(byId.get('DEMO-COMPLEX-01')).toBe('new')
    expect(byId.get('PORTFOLIO-AT-01')).toBe('in_progress')
    expect(byId.get('PORTFOLIO-MUC-01')).toBe('waiting_for_feedback')
  })

  it('reads Option facts only for the project whose workspace is loaded', () => {
    const rows = resolveProjectLifecycles(PORTFOLIO_PROJECTS, {
      analyses: {},
      readiness: { [P]: reviewed(), 'DEMO-COMPLEX-01': reviewed() },
      // The workspace belongs to DEMO-HAPPY-01. The complex project's ledger
      // entry must not be answered from it.
      options: options(),
    })
    const byId = new Map(rows.map((row) => [row.id, row.lifecycleStatus]))
    expect(byId.get(P)).toBe('ready_to_pitch')
    expect(byId.get('DEMO-COMPLEX-01')).toBe('new')
  })
})

describe('the baseline id has ONE formatter', () => {
  it('formats and parses the same string the store mints', () => {
    expect(projectBaselineIdOf(BASELINE)).toBe(`${P}@${BASELINE.at}`)
    expect(projectBaselineIdOf(null)).toBeNull()
  })

  it('builds the loaded-workspace facts, or says there is no workspace', () => {
    expect(loadedOptionFacts({
      opportunityId: null,
      savedOptionVersions: {},
      projectBaseline: null,
      baselineChangesSinceConfirmation: [],
    })).toBeNull()
    const facts = loadedOptionFacts({
      opportunityId: P,
      savedOptionVersions: { 'OPT-1': [version()], 'OPT-2': [version({ optionId: 'OPT-2' })] },
      projectBaseline: BASELINE,
      baselineChangesSinceConfirmation: ['BGF'],
    })!
    expect(facts.projectId).toBe(P)
    expect(facts.savedVersions).toHaveLength(2)
    expect(facts.currentProjectBaselineId).toBe(BASELINE_ID)
    expect(facts.baselineChangesSinceConfirmation).toEqual(['BGF'])
  })
})
