import fixture from '../fixtures/vr3-demo-projects.json'

/**
 * VR3-01 — project-level documentation analysis, information authority and
 * readiness.
 *
 * This module owns the PROJECT half of the journey: the two demonstration
 * fixtures, the per-file processing job, the conflict and question models,
 * and the readiness predicate that gates Option creation. It is pure: the
 * store holds the state, this file describes it and derives from it, so
 * every gate can be proved without rendering anything.
 *
 * Two boundaries are deliberate.
 *
 * 1. **Absence is not a zero.** Nothing here fabricates a result before the
 *    analysis has produced one. `readiness()` reports
 *    `DOCUMENT_ANALYSIS_NOT_STARTED` and the consumer mounts a prerequisite
 *    state — not an empty metric panel (VR3-00 design delta: the
 *    `PrerequisiteState` decision replaces "empty result/dashboard states").
 * 2. **Blocking conflicts alone are the hard gate.** Questions do not gate
 *    unless a question declares `blocking` itself, because a question is not
 *    a conflict and the Product must not infer that all questions block
 *    (target specification §6).
 */

/* ─────────────────────────── fixture shapes ─────────────────────────── */

export type ProcessingOutcome = 'PROCESSED' | 'WARNING' | 'LOW_CONFIDENCE' | 'FAILED'

export type RecognitionQuality = 'high' | 'medium' | 'low' | 'veryLow'

export type FixtureDocument = {
  id: string
  file: string
  documentType: string
  projectLevel: boolean
  buildingIds: string[]
  version: string
  issuedAt: string
  supersedes: string | null
  duplicateOf: string | null
  recognitionQuality: RecognitionQuality
  recognitionMedium: string
  processingOutcome: ProcessingOutcome
  issueKey: string | null
  sourceAuthority: string
  previewAssetId: string | null
}

export type FixtureBuildingMetrics = {
  bgfRAbove: string
  bgfSAbove: string
  bgfRSAbove: string
  bgfRBelow: string
  bgfSBelow: string
  bgfRSBelow: string
  bgfRSTotal: string
  wfl: string | null
  nuf: string | null
  commercialNuf: string | null
  units: number | null
  workplaces: number | null
  parkingSpaces: number | null
  siteArea: string | null
}

export type FixtureBuilding = {
  id: string
  name: string
  usageKey: string
  undergroundLevel: 'none' | 'partial' | 'full'
  storeysKey: string
  identityAssetId: string
  planAssetId: string
  metrics: FixtureBuildingMetrics
  authority: Record<string, string>
  evidenceDocIds: string[]
  geometryComplete: boolean
}

export type FixtureConflictCandidate = {
  id: string
  value?: string
  displayValue?: string
  valueKey?: string
  docId: string
  authority: string
  superseded: boolean
  recommended: boolean
  derivedFromDrawingSum?: boolean
  lowConfidence?: boolean
}

export type FixtureConflict = {
  id: string
  conceptKey: string
  blocking: boolean
  scope: 'project' | 'building'
  buildingId: string | null
  mattersKey: string
  affectsKey: string
  unit: string | null
  candidates: FixtureConflictCandidate[]
  recommendedCandidateId: string
  resolutionAuthority: string
  staleDocIds: string[]
  factKeys: string[]
}

export type FixtureQuestion = {
  id: string
  kind: 'question' | 'lowConfidence' | 'staleDependency'
  scope: 'project' | 'building'
  buildingId: string | null
  questionKey: string
  mattersKey: string
  evidenceKey: string
  responseKey: string
  status: 'open' | 'answered' | 'reviewRequired' | 'warning'
  blocking: boolean
  assumptionPermitted: boolean
  evidenceDocIds: string[]
}

/**
 * The project's demonstration schedule (VR3-04).
 *
 * Durations are HALF MONTHS on the lattice `src/engine/schedule.ts` owns, so
 * `constructionStartDate + totalHalfMonths` reproduces
 * `plannedCompletionDate` exactly rather than approximately. `leadHalfMonths`
 * is the declared overlap with the predecessor (`0` = strictly afterwards),
 * and `dependencyQuestionId` names a documented open question that makes the
 * dependency require an explicit confirmation before the Option can be
 * reviewed.
 */
export type FixtureSchedulePhaseKind = 'planning' | 'tender' | 'execution' | 'handover'

export type FixtureSchedulePhase = {
  id: string
  kind: FixtureSchedulePhaseKind
  buildingId: string | null
  durationHalfMonths: number
  dependsOn: string | null
  leadHalfMonths: number
  dependencyQuestionId: string | null
}

export type FixtureSchedule = {
  constructionStartDate: string
  plannedCompletionDate: string
  totalHalfMonths: number
  phases: FixtureSchedulePhase[]
}

/**
 * The PORTFOLIO half of a project record — its canonical postal identity,
 * its commercial lifecycle state, its dates and the area metric the register
 * reports for it.
 *
 * It lives beside the workflow fields rather than inside them because it
 * answers a different question. The workflow asks "what can this product
 * still do with the project"; this block answers "what is this project, where
 * is it, who owns it, and when does the client see us next". Nothing here
 * enters the calculation, the Option or a client output.
 */
export type FixtureProjectPortfolio = {
  /** ISO-style display code — `DE`, `AT`. */
  countryCode: string
  postcode: string
  addressLine: string
  /** One of the seven canonical values in `projectPortfolio.ts`. */
  lifecycleStatus: string
  createdAt: string
  updatedAt: string
  /** ISO timestamp with an unambiguous offset, or `null` when unscheduled. */
  nextClientMeetingAt: string | null
  /** `wfl` for a residential-only project, `nuf` once it sells commercial. */
  areaMetric: 'wfl' | 'nuf'
}

export type FixtureProject = {
  id: string
  route: 'clean' | 'complex'
  name: string
  client: string
  city: string
  region: string
  country: string
  /** The responsible manager, full first name and surname. */
  owner: string
  portfolio: FixtureProjectPortfolio
  projectTypeKey: string
  descriptionKey: string
  listStatusKey: string
  heroAssetId: string
  sitePlanAssetId: string | null
  buildings: FixtureBuilding[]
  documents: FixtureDocument[]
  conflicts: FixtureConflict[]
  questions: FixtureQuestion[]
  analysis: {
    requiredFields: number
    requiredFieldsComplete: number
    valuesExtracted: number
    sourceEvidencedValues: number
    aiInferredValues: number
    manualOrConfirmedValues: number
    valuesRequiringAttention: number
    understandingKey: string
  }
  terminalDistribution: {
    processed: number
    warning: number
    lowConfidence: number
    failed: number
  }
  schedule: FixtureSchedule
}

type Fixture = {
  normalListProjectCount: number
  projects: FixtureProject[]
}

const FIXTURE = fixture as unknown as Fixture

/** The normal Project List — exactly the two registered demonstration cases. */
export const DEMO_PROJECTS: readonly FixtureProject[] = FIXTURE.projects

export const NORMAL_LIST_PROJECT_COUNT = FIXTURE.normalListProjectCount

export function demoProject(projectId: string | null): FixtureProject | null {
  if (!projectId) return null
  return DEMO_PROJECTS.find((p) => p.id === projectId) ?? null
}

/* ───────────────────────── runtime job state ───────────────────────── */

/** Only backend-supported processing phases exist; there is no fake phase. */
export const PROCESSING_PHASES = [
  'READING', 'CLASSIFYING', 'EXTRACTING', 'CROSS_CHECKING',
] as const

export type ProcessingPhase = (typeof PROCESSING_PHASES)[number]

export type DocumentProcessingState = 'QUEUED' | ProcessingPhase | ProcessingOutcome

export type JobState = 'NOT_STARTED' | 'RUNNING' | 'PARTIAL_FAILURE' | 'COMPLETE'

export type DocumentRuntime = {
  state: DocumentProcessingState
  /** Retry attempts. A retry re-queues one file and keeps finished work. */
  retries: number
  /** Replacement lineage: the file name this row now stands for. */
  replacementFile: string | null
  /** Removed rows keep an audit record; they never vanish from history. */
  removedAt: string | null
  /** Source evidence changed after this row had already been processed. */
  stale: boolean
}

export type ConflictChoice =
  | { kind: 'candidate'; candidateId: string }
  | { kind: 'manual'; value: string; reason: string }

export type ConflictDecision = {
  conflictId: string
  choice: ConflictChoice
  /** Rejected evidence stays visible historically (canonical pattern). */
  rejectedCandidateIds: string[]
  actor: string
  at: string
}

export type QuestionResponse = {
  questionId: string
  kind: 'answer' | 'assumption'
  actor: string
  at: string
}

export type ProjectAnalysis = {
  projectId: string
  jobState: JobState
  startedAt: string | null
  completedAt: string | null
  /** Index of the file currently being processed; -1 when none is active. */
  cursor: number
  documents: Record<string, DocumentRuntime>
  conflictDecisions: Record<string, ConflictDecision>
  questionResponses: Record<string, QuestionResponse>
  /** Building fact keys whose confirmed value now needs review. */
  staleFactKeys: string[]
  /** Conflicts reopened because their evidence changed. */
  staleConflictIds: string[]
  reanalysisCount: number
  /** Recorded when the project baseline was committed into an Option. */
  baselineCommittedAt: string | null
}

/**
 * The stages of the Option-creation commitment, in order.
 *
 * `BASELINE` — build, validate and journal the project-baseline snapshot
 * (the artefact VR3-02 consumes). `OPTION` — create the Option that
 * inherits it.
 *
 * There are no percentages here and there never will be: rule 25 forbids
 * invented progress, and prescribes an indeterminate state plus a protocol
 * of COMPLETED phases instead. These are real phases with real results, so
 * naming the pending one is a fact rather than an estimate.
 */
export type OptionCommitStage = 'BASELINE' | 'OPTION'

/**
 * An Option-creation commitment in flight, or the failure it ended in.
 *
 * This is TRANSIENT state and it lives at the top level of the store, beside
 * `preview` and `undoToast` in `NO_TRANSIENT` — deliberately NOT inside
 * `ProjectAnalysis`.
 *
 * It was inside `ProjectAnalysis` for one candidate and the browser found
 * the consequence immediately: every journalled analysis mutation restores a
 * whole previous `ProjectAnalysis` on undo, so undoing a conflict decision
 * while a commitment was in flight restored a snapshot taken BEFORE it
 * started and erased the commitment mid-air. The gate fell back to LOCKED
 * with no outcome at all — neither the Option nor the error — which is
 * worse than the unreachable state it replaced. Transient state cannot live
 * inside an undoable record.
 *
 * INVARIANT: exactly one of `stage` and `errorKey` is non-null. In flight is
 * `stage !== null`; failed is `errorKey !== null`; success clears the whole
 * object.
 */
export type OptionCommit = {
  projectId: string
  /** The pending stage; `null` once the commitment has failed. */
  stage: OptionCommitStage | null
  /** Why it failed; `null` while it is still in flight. */
  errorKey: string | null
}

export const ANALYSIS_ACTOR = 'sales-user'

export function initialDocumentRuntime(): DocumentRuntime {
  return { state: 'QUEUED', retries: 0, replacementFile: null, removedAt: null, stale: false }
}

/** A deterministic reset: documentation register intact, decisions gone. */
export function initialProjectAnalysis(project: FixtureProject): ProjectAnalysis {
  const documents: Record<string, DocumentRuntime> = {}
  for (const doc of project.documents) documents[doc.id] = initialDocumentRuntime()
  return {
    projectId: project.id,
    jobState: 'NOT_STARTED',
    startedAt: null,
    completedAt: null,
    cursor: -1,
    documents,
    conflictDecisions: {},
    questionResponses: {},
    staleFactKeys: [],
    staleConflictIds: [],
    reanalysisCount: 0,
    baselineCommittedAt: null,
  }
}

export function initialProjectAnalyses(): Record<string, ProjectAnalysis> {
  const out: Record<string, ProjectAnalysis> = {}
  for (const project of DEMO_PROJECTS) out[project.id] = initialProjectAnalysis(project)
  return out
}

/* ───────────────────────── job progression ───────────────────────── */

const TERMINAL: ReadonlySet<DocumentProcessingState> =
  new Set<DocumentProcessingState>(['PROCESSED', 'WARNING', 'LOW_CONFIDENCE', 'FAILED'])

export function isTerminal(state: DocumentProcessingState): boolean {
  return TERMINAL.has(state)
}

/** Documents that still take part in the job (removed rows do not). */
function activeDocuments(project: FixtureProject, analysis: ProjectAnalysis): FixtureDocument[] {
  return project.documents.filter((d) => !analysis.documents[d.id]?.removedAt)
}

export function processedCount(project: FixtureProject, analysis: ProjectAnalysis): number {
  return activeDocuments(project, analysis)
    .filter((d) => isTerminal(analysis.documents[d.id]?.state ?? 'QUEUED')).length
}

export function activeDocumentCount(project: FixtureProject, analysis: ProjectAnalysis): number {
  return activeDocuments(project, analysis).length
}

export function activeDocumentId(
  project: FixtureProject, analysis: ProjectAnalysis,
): string | null {
  if (analysis.jobState === 'NOT_STARTED' || analysis.jobState === 'COMPLETE') return null
  const docs = activeDocuments(project, analysis)
  const current = docs[analysis.cursor]
  return current ? current.id : null
}

/**
 * Overall progress as a whole percentage. It is only ever derived from the
 * real denominator — the number of files this job actually has — so the
 * number never becomes an invented estimate (loaders do not show made-up
 * percentages, CLAUDE.md rule 25).
 */
export function overallProgressPercent(
  project: FixtureProject, analysis: ProjectAnalysis,
): number {
  const docs = activeDocuments(project, analysis)
  if (docs.length === 0) return 0
  let done = 0
  for (const doc of docs) {
    const state = analysis.documents[doc.id]?.state ?? 'QUEUED'
    if (isTerminal(state)) { done += 1; continue }
    const phase = PROCESSING_PHASES.indexOf(state as ProcessingPhase)
    if (phase >= 0) done += (phase + 1) / (PROCESSING_PHASES.length + 1)
  }
  return Math.floor((done / docs.length) * 100)
}

/** Per-file progress fraction, 0…1. Terminal rows report 1. */
export function documentProgress(state: DocumentProcessingState): number {
  if (isTerminal(state)) return 1
  const phase = PROCESSING_PHASES.indexOf(state as ProcessingPhase)
  if (phase < 0) return 0
  return (phase + 1) / (PROCESSING_PHASES.length + 1)
}

/**
 * One deterministic step of the job. Advancing the active file one phase at
 * a time is what makes the story per-file instead of one page spinner: the
 * caller schedules ticks, and a test drives them without any timer at all.
 */
export function advanceJob(
  project: FixtureProject, analysis: ProjectAnalysis,
): ProjectAnalysis {
  if (analysis.jobState !== 'RUNNING' && analysis.jobState !== 'PARTIAL_FAILURE') {
    return analysis
  }
  const docs = activeDocuments(project, analysis)
  if (docs.length === 0) {
    return { ...analysis, jobState: 'COMPLETE', cursor: -1, completedAt: new Date().toISOString() }
  }
  let cursor = analysis.cursor
  if (cursor < 0) cursor = 0
  // Skip anything already finished — a retry may have re-queued an earlier
  // row, and the cursor must find it rather than run past the end.
  while (cursor < docs.length && isTerminal(analysis.documents[docs[cursor]!.id]!.state)) {
    cursor += 1
  }
  if (cursor >= docs.length) {
    const requeued = docs.findIndex((d) => !isTerminal(analysis.documents[d.id]!.state))
    if (requeued < 0) {
      return {
        ...analysis,
        jobState: 'COMPLETE',
        cursor: -1,
        completedAt: new Date().toISOString(),
      }
    }
    cursor = requeued
  }
  const doc = docs[cursor]!
  const runtime = analysis.documents[doc.id]!
  const nextState: DocumentProcessingState = runtime.state === 'QUEUED'
    ? PROCESSING_PHASES[0]!
    : (() => {
      const at = PROCESSING_PHASES.indexOf(runtime.state as ProcessingPhase)
      const following = PROCESSING_PHASES[at + 1]
      return following ?? doc.processingOutcome
    })()

  const documents = {
    ...analysis.documents,
    [doc.id]: { ...runtime, state: nextState, stale: false },
  }
  const stillOpen = docs.some((d) => !isTerminal(
    d.id === doc.id ? nextState : analysis.documents[d.id]!.state,
  ))
  const anyFailed = docs.some((d) => (
    d.id === doc.id ? nextState : analysis.documents[d.id]!.state) === 'FAILED')

  return {
    ...analysis,
    documents,
    cursor: stillOpen ? cursor : -1,
    // A failure while other files are still running is its own state: the
    // job continues and recovery is local, so the row explains the cause
    // instead of the page pretending nothing happened.
    jobState: stillOpen ? (anyFailed ? 'PARTIAL_FAILURE' : 'RUNNING') : 'COMPLETE',
    completedAt: stillOpen ? null : new Date().toISOString(),
  }
}

export function startJob(
  project: FixtureProject, analysis: ProjectAnalysis, at: string,
): ProjectAnalysis {
  if (analysis.jobState === 'RUNNING' || analysis.jobState === 'PARTIAL_FAILURE') return analysis
  const documents: Record<string, DocumentRuntime> = {}
  for (const doc of project.documents) {
    const existing = analysis.documents[doc.id] ?? initialDocumentRuntime()
    documents[doc.id] = existing.removedAt
      ? existing
      : { ...existing, state: 'QUEUED', stale: false }
  }
  return {
    ...analysis,
    jobState: 'RUNNING',
    startedAt: at,
    completedAt: null,
    cursor: 0,
    documents,
  }
}

/** Cancelling keeps completed work; it never throws finished files away. */
export function cancelJob(analysis: ProjectAnalysis): ProjectAnalysis {
  if (analysis.jobState !== 'RUNNING' && analysis.jobState !== 'PARTIAL_FAILURE') return analysis
  const documents: Record<string, DocumentRuntime> = {}
  for (const [id, runtime] of Object.entries(analysis.documents)) {
    documents[id] = isTerminal(runtime.state) || runtime.removedAt
      ? runtime
      : { ...runtime, state: 'QUEUED' }
  }
  return { ...analysis, jobState: 'NOT_STARTED', cursor: -1, documents }
}

/**
 * A deterministic SEEDED CHECKPOINT: the project as it stands after a
 * complete analysis, with every blocking conflict decided from the
 * fixture's own recommended candidate and every question the fixture
 * declares already answered recorded as answered.
 *
 * The fixture specification sanctions exactly this ("a separate seeded
 * checkpoint may open Project B with analysis complete for demos, but it
 * must never appear as a third project") — it is a state of an existing
 * project, never a new list entry. It also gives the downstream Option-
 * workspace suites an honest way in: their subject is the Option, and
 * clicking through eleven project-level steps to reach it was never part
 * of what they test.
 *
 * It records real decisions with a real actor and timestamp, so nothing it
 * produces is distinguishable from the same journey walked by hand.
 */
export function seededCheckpoint(
  project: FixtureProject, at: string,
): ProjectAnalysis {
  const base = initialProjectAnalysis(project)
  const documents: Record<string, DocumentRuntime> = {}
  for (const doc of project.documents) {
    documents[doc.id] = { ...initialDocumentRuntime(), state: doc.processingOutcome }
  }
  let analysis: ProjectAnalysis = {
    ...base,
    jobState: 'COMPLETE',
    startedAt: at,
    completedAt: at,
    cursor: -1,
    documents,
  }
  for (const conflict of project.conflicts) {
    analysis = resolveConflict(
      project, analysis, conflict.id,
      { kind: 'candidate', candidateId: conflict.recommendedCandidateId },
      at,
    )
  }
  for (const question of project.questions) {
    if (question.status === 'answered') {
      analysis = recordQuestionResponse(analysis, question.id, 'answer', at)
    }
  }
  return analysis
}

/* ─────────────────── local recovery on one document ─────────────────── */

export function retryDocument(analysis: ProjectAnalysis, docId: string): ProjectAnalysis {
  const runtime = analysis.documents[docId]
  if (!runtime || runtime.removedAt) return analysis
  return {
    ...analysis,
    jobState: analysis.jobState === 'COMPLETE' ? 'RUNNING' : analysis.jobState,
    completedAt: null,
    documents: {
      ...analysis.documents,
      [docId]: { ...runtime, state: 'QUEUED', retries: runtime.retries + 1 },
    },
  }
}

/**
 * Replacing links the old and the new evidence: the row keeps its document
 * identity and records which file now stands for it, so the supersession
 * relationship stays inspectable instead of becoming an untraceable swap.
 */
export function replaceDocument(
  project: FixtureProject, analysis: ProjectAnalysis, docId: string, replacementFile: string,
): ProjectAnalysis {
  const runtime = analysis.documents[docId]
  if (!runtime) return analysis
  const affected = affectedByDocuments(project, [docId])
  return {
    ...analysis,
    jobState: analysis.jobState === 'COMPLETE' ? 'RUNNING' : analysis.jobState,
    completedAt: null,
    documents: {
      ...analysis.documents,
      [docId]: { ...runtime, state: 'QUEUED', replacementFile, removedAt: null },
    },
    // Only the values this document actually evidences become stale. A
    // source change must not invalidate confirmations it never touched.
    staleFactKeys: mergeUnique(analysis.staleFactKeys, affected.factKeys),
    staleConflictIds: mergeUnique(analysis.staleConflictIds, affected.conflictIds),
  }
}

export function removeDocument(
  project: FixtureProject, analysis: ProjectAnalysis, docId: string, at: string,
): ProjectAnalysis {
  const runtime = analysis.documents[docId]
  if (!runtime) return analysis
  const affected = affectedByDocuments(project, [docId])
  return {
    ...analysis,
    documents: { ...analysis.documents, [docId]: { ...runtime, removedAt: at } },
    staleFactKeys: mergeUnique(analysis.staleFactKeys, affected.factKeys),
    staleConflictIds: mergeUnique(analysis.staleConflictIds, affected.conflictIds),
  }
}

/** Re-analysis after a document change: affected confirmations need review. */
export function rerunJob(
  project: FixtureProject, analysis: ProjectAnalysis, at: string,
): ProjectAnalysis {
  const started = startJob(project, { ...analysis, jobState: 'NOT_STARTED' }, at)
  return { ...started, reanalysisCount: analysis.reanalysisCount + 1 }
}

function mergeUnique(current: string[], added: string[]): string[] {
  return [...new Set([...current, ...added])]
}

/** Which conflicts and building facts a set of documents actually evidences. */
export function affectedByDocuments(
  project: FixtureProject, docIds: string[],
): { conflictIds: string[]; factKeys: string[] } {
  const ids = new Set(docIds)
  const conflictIds: string[] = []
  const factKeys: string[] = []
  for (const conflict of project.conflicts) {
    const touches = conflict.candidates.some((c) => ids.has(c.docId))
      || conflict.staleDocIds.some((d) => ids.has(d))
    if (touches) {
      conflictIds.push(conflict.id)
      for (const key of conflict.factKeys) factKeys.push(`${conflict.buildingId ?? project.id}:${key}`)
    }
  }
  for (const building of project.buildings) {
    if (building.evidenceDocIds.some((d) => ids.has(d))) {
      factKeys.push(`${building.id}:bgfRSTotal`)
    }
  }
  return { conflictIds, factKeys: [...new Set(factKeys)] }
}

/* ─────────────────────────── conflicts ─────────────────────────── */

export function resolveConflict(
  project: FixtureProject,
  analysis: ProjectAnalysis,
  conflictId: string,
  choice: ConflictChoice,
  at: string,
): ProjectAnalysis {
  const conflict = project.conflicts.find((c) => c.id === conflictId)
  if (!conflict) return analysis
  const chosenCandidateId = choice.kind === 'candidate' ? choice.candidateId : null
  const rejected = conflict.candidates
    .filter((c) => c.id !== chosenCandidateId)
    .map((c) => c.id)
  return {
    ...analysis,
    conflictDecisions: {
      ...analysis.conflictDecisions,
      [conflictId]: {
        conflictId,
        choice,
        rejectedCandidateIds: rejected,
        actor: ANALYSIS_ACTOR,
        at,
      },
    },
    staleConflictIds: analysis.staleConflictIds.filter((id) => id !== conflictId),
    staleFactKeys: analysis.staleFactKeys.filter((key) => !conflict.factKeys
      .some((factKey) => key === `${conflict.buildingId ?? project.id}:${factKey}`)),
  }
}

/** Undo reopens the conflict and re-evaluates readiness; it is an event too. */
export function reopenConflict(
  analysis: ProjectAnalysis, conflictId: string,
): ProjectAnalysis {
  if (!analysis.conflictDecisions[conflictId]) return analysis
  const next = { ...analysis.conflictDecisions }
  delete next[conflictId]
  return { ...analysis, conflictDecisions: next }
}

export function conflictResolved(analysis: ProjectAnalysis, conflictId: string): boolean {
  return Boolean(analysis.conflictDecisions[conflictId])
    && !analysis.staleConflictIds.includes(conflictId)
}

export function unresolvedBlockingConflicts(
  project: FixtureProject, analysis: ProjectAnalysis,
): FixtureConflict[] {
  if (analysis.jobState !== 'COMPLETE') return []
  return project.conflicts.filter((c) => c.blocking && !conflictResolved(analysis, c.id))
}

/** The value a resolved conflict now carries, with its decision provenance. */
export function resolvedConflictValue(
  conflict: FixtureConflict, decision: ConflictDecision | undefined,
): { displayValue: string | null; valueKey: string | null } | null {
  if (!decision) return null
  const choice = decision.choice
  if (choice.kind === 'manual') {
    return { displayValue: choice.value, valueKey: null }
  }
  const candidate = conflict.candidates.find((c) => c.id === choice.candidateId)
  if (!candidate) return null
  return {
    displayValue: candidate.displayValue ?? null,
    valueKey: candidate.valueKey ?? null,
  }
}

/* ─────────────────────────── questions ─────────────────────────── */

export function questionStatus(
  question: FixtureQuestion, analysis: ProjectAnalysis,
): FixtureQuestion['status'] {
  const response = analysis.questionResponses[question.id]
  if (!response) return question.status
  return response.kind === 'assumption' ? 'warning' : 'answered'
}

export function openQuestions(
  project: FixtureProject, analysis: ProjectAnalysis,
): FixtureQuestion[] {
  return project.questions.filter((q) => {
    const status = questionStatus(q, analysis)
    return status === 'open' || status === 'reviewRequired'
  })
}

export function blockingQuestions(
  project: FixtureProject, analysis: ProjectAnalysis,
): FixtureQuestion[] {
  return openQuestions(project, analysis).filter((q) => q.blocking)
}

export function recordQuestionResponse(
  analysis: ProjectAnalysis,
  questionId: string,
  kind: QuestionResponse['kind'],
  at: string,
): ProjectAnalysis {
  return {
    ...analysis,
    questionResponses: {
      ...analysis.questionResponses,
      [questionId]: { questionId, kind, actor: ANALYSIS_ACTOR, at },
    },
  }
}

/* ─────────────────────────── readiness ─────────────────────────── */

export type ProjectReadinessState =
  | 'DOCUMENT_ANALYSIS_NOT_STARTED'
  | 'DOCUMENT_ANALYSIS_RUNNING'
  | 'DOCUMENT_ANALYSIS_PARTIAL_FAILURE'
  | 'PROJECT_REVIEW_REQUIRED'
  | 'BLOCKING_CONFLICTS_PRESENT'
  | 'PROJECT_READY_FOR_OPTION'

export type ProjectReadiness = {
  state: ProjectReadinessState
  analysisComplete: boolean
  /** The hard gate's own number, so the lock can state its count. */
  unresolvedBlockingConflicts: number
  openQuestions: number
  blockingQuestions: number
  permittedAssumptions: number
  requiredBaselineComplete: number
  requiredBaselineTotal: number
  staleFactKeys: string[]
  canCreateOption: boolean
  /** Why the gate is closed, as a key; `null` when it is open. */
  lockReasonKey: string | null
}

export function readiness(
  project: FixtureProject, analysis: ProjectAnalysis,
): ProjectReadiness {
  const unresolved = unresolvedBlockingConflicts(project, analysis)
  const open = openQuestions(project, analysis)
  const blocking = blockingQuestions(project, analysis)
  const stale = analysis.staleFactKeys
  const analysisComplete = analysis.jobState === 'COMPLETE'
  const baselineTotal = project.analysis.requiredFields
  const baselineComplete = analysisComplete && stale.length === 0
    ? project.analysis.requiredFieldsComplete
    : 0

  let state: ProjectReadinessState
  if (analysis.jobState === 'NOT_STARTED') state = 'DOCUMENT_ANALYSIS_NOT_STARTED'
  else if (analysis.jobState === 'PARTIAL_FAILURE') state = 'DOCUMENT_ANALYSIS_PARTIAL_FAILURE'
  else if (analysis.jobState === 'RUNNING') state = 'DOCUMENT_ANALYSIS_RUNNING'
  else if (unresolved.length > 0) state = 'BLOCKING_CONFLICTS_PRESENT'
  else if (blocking.length > 0 || stale.length > 0 || baselineComplete < baselineTotal) {
    state = 'PROJECT_REVIEW_REQUIRED'
  } else state = 'PROJECT_READY_FOR_OPTION'

  const lockReasonKey = state === 'PROJECT_READY_FOR_OPTION'
    ? null
    : state === 'BLOCKING_CONFLICTS_PRESENT'
      ? 'vr3.gate.reason.blockingConflicts'
      : state === 'PROJECT_REVIEW_REQUIRED'
        ? (blocking.length > 0
          ? 'vr3.gate.reason.blockingQuestions'
          : stale.length > 0
            ? 'vr3.gate.reason.staleBaseline'
            : 'vr3.gate.reason.incompleteBaseline')
        : state === 'DOCUMENT_ANALYSIS_NOT_STARTED'
          ? 'vr3.gate.reason.analysisNotStarted'
          : 'vr3.gate.reason.analysisRunning'

  return {
    state,
    analysisComplete,
    unresolvedBlockingConflicts: unresolved.length,
    openQuestions: open.length,
    blockingQuestions: blocking.length,
    permittedAssumptions: open.filter((q) => q.assumptionPermitted).length,
    requiredBaselineComplete: baselineComplete,
    requiredBaselineTotal: baselineTotal,
    staleFactKeys: stale,
    canCreateOption: state === 'PROJECT_READY_FOR_OPTION',
    lockReasonKey,
  }
}

/**
 * Which READY composition to render.
 *
 * PRESENTATION ONLY. It gates nothing, `canCreateOption` never reads it, and
 * `readiness()` above does not know it exists — a test asserts that the gate's
 * output is byte-identical with and without this function.
 *
 * The finding it encodes (accepted 2026-09-05 Project Understanding clean-pass
 * audit): `PROJECT_READY_FOR_OPTION` is a GATE state, not a CLEANLINESS state.
 * The gate reads `jobState`, unresolved BLOCKING conflicts, BLOCKING questions,
 * `staleFactKeys` and required-field completion — and nothing else. A project
 * with six decided conflicts, seven non-blocking open questions, twelve
 * AI-inferred values and one failed document passes it, and used to render the
 * identical composition as a project that never had a conflict at all. On the
 * first that composition's copy is true and its routes are missing; on the
 * second the copy is simply false.
 *
 * Every clause is derived from data the product already holds. Nothing here is
 * a threshold or a judgement: it is the difference between NONE FOUND and
 * RESOLVED, stated once.
 */
export function cleanPresentation(
  project: FixtureProject, analysis: ProjectAnalysis,
): boolean {
  if (readiness(project, analysis).state !== 'PROJECT_READY_FOR_OPTION') return false
  const dist = project.terminalDistribution
  return project.conflicts.length === 0
    && openQuestions(project, analysis).length === 0
    && dist.warning === 0
    && dist.lowConfidence === 0
    && dist.failed === 0
    && project.analysis.aiInferredValues === 0
    && project.analysis.valuesRequiringAttention === 0
}

/* ──────────────────── baseline snapshot (VR3-02 input) ──────────────────── */

/**
 * The project baseline VR3-02's Option creation consumes. It is emitted
 * once, at the moment the user commits the project into an Option, and it
 * carries the authority of every value with it — a snapshot without its
 * provenance would let a later stage present an assumption as a fact.
 */
export type ProjectBaselineSnapshot = {
  projectId: string
  projectName: string
  at: string
  buildingCount: number
  bgfRSTotal: string
  buildings: Array<{
    id: string
    name: string
    usageKey: string
    undergroundLevel: FixtureBuilding['undergroundLevel']
    /**
     * VR3-02: the Option's building baseline states the storey structure and
     * names the documents its facts were read from. Both are carried HERE,
     * in the journalled snapshot, rather than re-read from the live fixture
     * by the Option — an Option is a variant of the project as it was
     * understood on a given day, and a later re-analysis must not move it.
     */
    storeysKey: string
    metrics: FixtureBuildingMetrics
    authority: Record<string, string>
    identityAssetId: string
    evidenceDocIds: string[]
  }>
  documentCount: number
  terminalDistribution: FixtureProject['terminalDistribution']
  conflictDecisions: ConflictDecision[]
  openQuestionIds: string[]
  permittedAssumptionIds: string[]
  reanalysisCount: number
}

export function projectBaselineSnapshot(
  project: FixtureProject, analysis: ProjectAnalysis, at: string,
): ProjectBaselineSnapshot {
  const open = openQuestions(project, analysis)
  return {
    projectId: project.id,
    projectName: project.name,
    at,
    buildingCount: project.buildings.length,
    bgfRSTotal: totalBgfRS(project),
    buildings: project.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      usageKey: b.usageKey,
      undergroundLevel: b.undergroundLevel,
      storeysKey: b.storeysKey,
      metrics: b.metrics,
      authority: b.authority,
      identityAssetId: b.identityAssetId,
      evidenceDocIds: [...b.evidenceDocIds],
    })),
    documentCount: activeDocumentCount(project, analysis),
    terminalDistribution: project.terminalDistribution,
    conflictDecisions: Object.values(analysis.conflictDecisions),
    openQuestionIds: open.map((q) => q.id),
    permittedAssumptionIds: open.filter((q) => q.assumptionPermitted).map((q) => q.id),
    reanalysisCount: analysis.reanalysisCount,
  }
}

/**
 * Total BGF R+S over the project's buildings, summed from the per-building
 * totals. Specific values are never averaged and the total is never a
 * separately stored number that could drift from its parts (rule 39).
 */
export function totalBgfRS(project: FixtureProject): string {
  let whole = 0n
  for (const building of project.buildings) {
    whole += centsOf(building.metrics.bgfRSTotal)
  }
  const integer = whole / 100n
  const fraction = whole % 100n
  return `${integer}.${String(fraction).padStart(2, '0')}`
}

function centsOf(decimalString: string): bigint {
  const [whole, fraction = ''] = decimalString.split('.')
  return BigInt(whole ?? '0') * 100n + BigInt((fraction + '00').slice(0, 2))
}

/* ────────────────────── document register helpers ────────────────────── */

export type DocumentTypeTally = { documentType: string; count: number }

/**
 * The document register grouped by type, in register order. The
 * pre-analysis page states what the document set contains, and it states it
 * from the register itself — no screen owns an independent count.
 */
export function documentTypeTally(project: FixtureProject): DocumentTypeTally[] {
  const groups = new Map<string, number>([
    ['floorPlan', 0], ['elevations', 0], ['section', 0], ['other', 0],
  ])
  for (const doc of project.documents) {
    const bucket = doc.documentType.startsWith('floorPlan')
      ? 'floorPlan'
      : doc.documentType === 'elevations'
        ? 'elevations'
        : doc.documentType === 'section'
          ? 'section'
          : 'other'
    groups.set(bucket, (groups.get(bucket) ?? 0) + 1)
  }
  return [...groups.entries()]
    .filter(([, count]) => count > 0)
    .map(([documentType, count]) => ({ documentType, count }))
}

/** Documents this one supersedes or duplicates, for the evidence chronology. */
export function documentLineage(
  project: FixtureProject, docId: string,
): { supersedes: FixtureDocument | null; supersededBy: FixtureDocument | null; duplicateOf: FixtureDocument | null; duplicates: FixtureDocument[] } {
  const byId = new Map(project.documents.map((d) => [d.id, d]))
  const doc = byId.get(docId) ?? null
  return {
    supersedes: doc?.supersedes ? byId.get(doc.supersedes) ?? null : null,
    supersededBy: project.documents.find((d) => d.supersedes === docId) ?? null,
    duplicateOf: doc?.duplicateOf ? byId.get(doc.duplicateOf) ?? null : null,
    duplicates: project.documents.filter((d) => d.duplicateOf === docId),
  }
}

export type DocumentFilter = 'all' | 'attention' | 'processed'

export function filterDocuments(
  project: FixtureProject, analysis: ProjectAnalysis, filter: DocumentFilter,
): FixtureDocument[] {
  const docs = project.documents
  if (filter === 'all') return docs
  return docs.filter((doc) => {
    const state = analysis.documents[doc.id]?.state ?? 'QUEUED'
    const attention = state === 'WARNING' || state === 'LOW_CONFIDENCE' || state === 'FAILED'
    return filter === 'attention' ? attention : state === 'PROCESSED'
  })
}

/* ─────────────── the Documents workspace: derived, never new ───────────── */

/**
 * The five states the Documents workspace presents (accepted 2026-09-05
 * Documents workspace UX audit, "Analysis state model").
 *
 * These are a PRESENTATION of `JobState`, derived here so the mapping can be
 * proved without rendering. Nothing new is persisted and no new outcome is
 * invented: `CANCELLED` is the existing `NOT_STARTED`-after-a-start that
 * `cancelJob` produces, and `COMPLETE_WITH_ISSUES` is the existing
 * `COMPLETE` seen together with the attention outcomes the run produced.
 *
 * The audit's own table names the fifth state `PAUSED`. It is NOT called
 * that here, and the implementation ticket is explicit about why: a pause
 * implies that continuing resumes where the work stopped. `startJob` does
 * not — it re-queues every non-removed document and reads them all again.
 * Cancelling keeps what was already produced, so nothing is lost, but the
 * word for that is cancelled, and the rail says restarting reads the whole
 * eligible set again rather than promising a resume this Product cannot
 * perform.
 */
export type AnalysisWorkspaceState =
  | 'READY' | 'CANCELLED' | 'ANALYSING' | 'COMPLETE' | 'COMPLETE_WITH_ISSUES'

/**
 * The documents an analysis run actually processes.
 *
 * This is the EXISTING input set, not a new eligibility model: `startJob`
 * queues every document that has not been removed and `advanceJob` walks
 * exactly the same set. The workspace's "analyse all N eligible documents"
 * therefore counts the set the operation will process, and the two cannot
 * drift apart, because they are one function.
 */
export function eligibleDocuments(
  project: FixtureProject, analysis: ProjectAnalysis,
): FixtureDocument[] {
  return project.documents.filter((d) => !analysis.documents[d.id]?.removedAt)
}

/** Outcomes that need a decision. Removed rows are not an outcome. */
export function attentionCount(
  project: FixtureProject, analysis: ProjectAnalysis,
): number {
  return eligibleDocuments(project, analysis).filter((doc) => {
    const state = analysis.documents[doc.id]?.state
    return state === 'WARNING' || state === 'LOW_CONFIDENCE' || state === 'FAILED'
  }).length
}

/** Documents whose run ended cleanly. */
export function processedOutcomeCount(
  project: FixtureProject, analysis: ProjectAnalysis,
): number {
  return eligibleDocuments(project, analysis)
    .filter((doc) => analysis.documents[doc.id]?.state === 'PROCESSED').length
}

export function analysisWorkspaceState(
  project: FixtureProject, analysis: ProjectAnalysis,
): AnalysisWorkspaceState {
  if (analysis.jobState === 'RUNNING' || analysis.jobState === 'PARTIAL_FAILURE') {
    return 'ANALYSING'
  }
  if (analysis.jobState === 'COMPLETE') {
    return attentionCount(project, analysis) > 0 ? 'COMPLETE_WITH_ISSUES' : 'COMPLETE'
  }
  // NOT_STARTED covers both "never begun" and "begun, then cancelled". The
  // start timestamp is what tells them apart, and it survives cancellation.
  return analysis.startedAt ? 'CANCELLED' : 'READY'
}

/** What a document row truthfully reads as, given the job around it. */
export type DocumentDisplayState = 'READY' | DocumentProcessingState | 'REMOVED'

/**
 * `QUEUED` means accepted and waiting. Before a run is accepted — and after
 * one was cancelled, when nothing is waiting for anything — an unfinished
 * document is READY, not queued. The store's own value is unchanged; this
 * is the presentation of it.
 */
export function documentDisplayState(
  analysis: ProjectAnalysis, docId: string, workspace: AnalysisWorkspaceState,
): DocumentDisplayState {
  const runtime = analysis.documents[docId]
  if (runtime?.removedAt) return 'REMOVED'
  const state = runtime?.state ?? 'QUEUED'
  if (state === 'QUEUED' && (workspace === 'READY' || workspace === 'CANCELLED')) {
    return 'READY'
  }
  return state
}

/**
 * Has the project understanding MOVED since this baseline was committed?
 *
 * Scope addition B of the 2026-09-06 IA audit, CPO ruling of the same day:
 * DISCLOSURE, not invalidation. An Option inherits the project baseline by
 * value at creation, deliberately, under M-1/M-3 — a later re-analysis must
 * never move an Option's commercial base, and this function moves nothing.
 * It answers one read-only question so the product can state the truth it
 * already holds instead of letting a reader assume every Option tracks the
 * latest understanding.
 *
 * It re-derives the snapshot the project would produce RIGHT NOW and compares
 * it with the one that was committed, with the timestamp neutralised so the
 * comparison is about the understanding and not about the clock. Reusing
 * `projectBaselineSnapshot` is deliberate: a hand-written list of "material"
 * fields would be a second definition of what a baseline is, and it would
 * drift from the first one the next time a field is added.
 *
 * It gates NOTHING. No predicate reads it, no stage locks on it, and no
 * Option is invalidated by it.
 */
export function projectBaselineDrifted(
  project: FixtureProject,
  analysis: ProjectAnalysis,
  baseline: ProjectBaselineSnapshot,
): boolean {
  if (baseline.projectId !== project.id) return false
  const live = projectBaselineSnapshot(project, analysis, baseline.at)
  return JSON.stringify(live) !== JSON.stringify(baseline)
}
