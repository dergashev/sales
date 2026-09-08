import {
  type ProjectAnalysis,
} from './projectAnalysis'
import {
  CLIENT_PROJECTION_VERSION,
  type SavedOptionVersion,
} from './optionSave'

/**
 * The ONE place a project's lifecycle status is decided.
 *
 * Before this module the two navigable demonstration projects carried a
 * `lifecycleStatus` STRING in their fixture, and the register printed it.
 * That is how a card came to say `Ready to pitch` on the same surface where
 * it also said `Price not calculated` and left `Client view` disabled: three
 * facts about one project, one of them a label nobody derived. A status that
 * is a fixture field is not a status, it is a caption.
 *
 * So the fixture no longer declares one. What a fixture may still declare is
 * an EXPLICIT HUMAN STATE (`on_hold`, `waiting_for_feedback`, `archive`),
 * because the accepted status model says those three are set by a person and
 * are never inferred — "Awaiting feedback … is never inferred from an open
 * internal question". Everything else is derived here, from the project's
 * own committed truth.
 *
 * Three properties are structural:
 *
 * 1. **One producer.** `resolveProjectLifecycles` in `projectPortfolio.ts` is
 *    the only function that stamps a `lifecycleStatus` onto a card, and it
 *    calls `projectLifecycleStatus` below to get it. The register's cards
 *    and its status filter both read that one stamped field, so "the status
 *    card and the status filter disagree" is not a bug that can be
 *    reintroduced — there is no second value to disagree with.
 * 2. **Ready to pitch is a conjunction, not a label.** `projectReadyToPitch`
 *    states the whole predicate in one expression. The conjuncts this slice
 *    can evaluate are evaluated here; the two the Export/Review slice owns
 *    (required export material availability and an explicit Client Mode
 *    review of one exact saved version) arrive through
 *    `ProjectReadinessRecord`. Until that slice writes a record, the
 *    conjunction is false for a TRUE reason — nobody has reviewed anything —
 *    not because of a stub.
 * 3. **Unknown is not a status.** A project whose Option workspace is not
 *    currently loaded contributes no Option facts, and the absence of a fact
 *    never counts as its satisfaction. It can therefore reach `in_progress`
 *    or `review_required` from its own project-level truth, and never
 *    `ready_to_pitch` on a guess.
 */

/* ──────────────────────── the closed status set ──────────────────────── */

/**
 * The canonical portfolio lifecycle. Seven values, closed set.
 *
 * It lives HERE, with the derivation, and not with the register that
 * renders it: the set, the precedence between its members and the rule
 * that produces one of them are one subject, and splitting them across two
 * modules is how a status set acquires a second, quietly different
 * interpretation.
 */
export const LIFECYCLE_STATUSES = [
  'new',
  'in_progress',
  'on_hold',
  'review_required',
  'waiting_for_feedback',
  'ready_to_pitch',
  'archive',
] as const

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]

export function isLifecycleStatus(value: string): value is LifecycleStatus {
  return (LIFECYCLE_STATUSES as readonly string[]).includes(value)
}

/** Dictionary key for a status label. One mapping, no second list. */
export function lifecycleStatusKey(status: LifecycleStatus): string {
  return `portfolio.status.${status}`
}

/**
 * Status → canonical `SemanticStatus` tone.
 *
 * Two statuses share a tone where no honest distinct tone exists (`new` and
 * `archive` are both "not in flight"; `review_required` and
 * `waiting_for_feedback` both wait on a human). That is safe and deliberate:
 * the tone is never the carrier. Every status renders its own WORD next to
 * its own GLYPH (rule 8), so the distinction a reader needs is always in
 * text, and inventing a new tone per status would fork a canonical
 * capability to encode information the label already carries.
 */
export function lifecycleStatusTone(
  status: LifecycleStatus,
): 'neutral' | 'progress' | 'ok' | 'attention' | 'stale' {
  switch (status) {
    case 'in_progress': return 'progress'
    case 'ready_to_pitch': return 'ok'
    case 'review_required': return 'attention'
    case 'waiting_for_feedback': return 'attention'
    case 'on_hold': return 'stale'
    case 'new':
    case 'archive':
    default: return 'neutral'
  }
}

/* ─────────────────────── the explicit human state ───────────────────── */

/**
 * The three statuses a person sets and no derivation may invent.
 *
 * `waiting_for_feedback` is the one worth naming twice: it means somebody
 * recorded that this project waits on an EXTERNAL party. An unanswered
 * question inside the analysis is not that, and deriving it from one would
 * turn every incomplete project into a project that is waiting.
 */
export const EXPLICIT_PROJECT_HOLDS = [
  'on_hold',
  'waiting_for_feedback',
  'archive',
] as const

export type ExplicitProjectHold = (typeof EXPLICIT_PROJECT_HOLDS)[number]

export function isExplicitProjectHold(value: string): value is ExplicitProjectHold {
  return (EXPLICIT_PROJECT_HOLDS as readonly string[]).includes(value)
}

/**
 * A lifecycle value a DISPLAY-ONLY register record may declare.
 *
 * Display-only records have no documents, no analysis and no Option — there
 * is nothing to derive from, and their areas, their value and their next
 * meeting are already synthetic register data with
 * `syntheticPortfolioFixture` provenance. Their status is the same kind of
 * thing and is honest as such.
 *
 * What they may NOT declare is a status that asserts a state of the product:
 * `ready_to_pitch` claims a reviewed saved Option version, and
 * `review_required` claims invalidated confirmed truth. Both are refused at
 * fixture load rather than filtered at render, because a refused fixture is
 * a failing test and a filtered one is a silent lie.
 */
export const DECLARABLE_LIFECYCLE_STATUSES = [
  'new',
  'in_progress',
  'on_hold',
  'waiting_for_feedback',
  'archive',
] as const

export type DeclarableLifecycleStatus = (typeof DECLARABLE_LIFECYCLE_STATUSES)[number]

export function isDeclarableLifecycleStatus(
  value: string,
): value is DeclarableLifecycleStatus {
  return (DECLARABLE_LIFECYCLE_STATUSES as readonly string[]).includes(value)
}

/* ───────────────────────── the readiness ledger ─────────────────────── */

/**
 * What the Export/Review slice records when a person completes the Client
 * Mode review of ONE exact saved Option version.
 *
 * It is a per-project ledger and not a field on the Option, because the
 * register has to answer "is this project ready" for five projects while
 * only one project's Option workspace is loaded. It is deliberately the
 * NARROWEST record that answers the question: which Option, which exact
 * saved-version fingerprint, who, when.
 *
 * `requiredExportMaterialsAvailable` is the second conjunct that slice owns.
 * It is stored rather than derived here because the required material set,
 * its dependencies and its availability rules belong to that slice's
 * catalogue — this module must not guess them, and a guess would be the
 * hidden prerequisite the audit found in the current Export gate.
 */
export type ProjectReadinessRecord = {
  reviewedOptionId: string
  /** The exact saved-version fingerprint the review was completed against. */
  reviewedFingerprint: string
  reviewedBy: string
  reviewedAt: string
  requiredExportMaterialsAvailable: boolean
}

/**
 * The ledger. Keyed by project id, EMPTY at boot, and never seeded from a
 * fixture: a demonstration record that granted itself a completed client
 * review would be the fixture-driven readiness this whole slice removes.
 */
export type ProjectReadinessLedger = Record<string, ProjectReadinessRecord>

export const EMPTY_PROJECT_READINESS: ProjectReadinessLedger = {}

/* ──────────────────────────── the facts ─────────────────────────────── */

/**
 * Everything the lifecycle decision reads, as plain data.
 *
 * A record rather than a store slice so the decision is a pure function of
 * named facts: a test can state "work was committed and a confirmed fact
 * went stale" without constructing an analysis, an Option and a browser.
 */
export type ProjectLifecycleFacts = {
  /** Set by a person. Wins over every derivation. */
  hold: ExplicitProjectHold | null
  /**
   * Committed project work exists: the analysis was run, a conflict was
   * decided, a question was answered, or a project baseline was committed
   * into an Option. A project that has merely been OPENED has none of these
   * — looking at a project is not working on it, and `New` must survive a
   * visit or the status is a page-view counter.
   */
  workCommitted: boolean
  /**
   * Confirmed or manually established project truth was invalidated: a
   * confirmed building fact went stale, a decided conflict reopened because
   * its evidence changed, or the project baseline moved after its
   * confirmation.
   */
  confirmedTruthStale: boolean
  /** The full readiness conjunction, from `projectReadyToPitch`. */
  readyToPitch: boolean
}

/**
 * The Option-level facts the readiness conjunction needs, for the ONE
 * project whose workspace is currently loaded.
 *
 * `null` means "this project's Option workspace is not loaded", which is not
 * the same as "it has no Options" and must not be read as either a pass or
 * a failure of an individual conjunct — it simply cannot contribute one, so
 * the conjunction is false.
 */
export type LoadedOptionFacts = {
  projectId: string
  savedVersions: readonly SavedOptionVersion[]
  /**
   * The project baseline id currently confirmed for this project, or `null`.
   * A reviewed version whose `projectBaselineId` no longer matches is a
   * version reviewed against superseded project truth.
   */
  currentProjectBaselineId: string | null
  /** Labels of baseline changes made since the confirmation, if any. */
  baselineChangesSinceConfirmation: readonly string[]
}

/**
 * The id a project baseline is known by once it is committed into an Option.
 *
 * ONE formatter, called by the two store sites that mint it and by the
 * register that compares against it. It used to be an inline template in
 * both store sites, which is how "the Option's baseline id" and "the
 * project's current baseline id" could have become two subtly different
 * strings — the class of defect this repository has paid for before.
 */
export function projectBaselineIdOf(
  baseline: { projectId: string; at: string } | null,
): string | null {
  return baseline ? `${baseline.projectId}@${baseline.at}` : null
}

/**
 * The Option facts the lifecycle derivation may read, for the ONE project
 * whose workspace is loaded — or `null` when none is.
 *
 * `null` is a truthful answer and not a gap: the per-project storage split
 * means no other project's Options exist in memory, and a register that
 * guessed at them would be the cross-project leak that split closed.
 */
export function loadedOptionFacts(state: {
  opportunityId: string | null
  savedOptionVersions: Readonly<Record<string, readonly SavedOptionVersion[]>>
  projectBaseline: { projectId: string; at: string } | null
  baselineChangesSinceConfirmation: readonly string[]
}): LoadedOptionFacts | null {
  if (!state.opportunityId) return null
  return {
    projectId: state.opportunityId,
    savedVersions: Object.values(state.savedOptionVersions).flat(),
    currentProjectBaselineId: projectBaselineIdOf(state.projectBaseline),
    baselineChangesSinceConfirmation: state.baselineChangesSinceConfirmation,
  }
}

/* ─────────────────────── the readiness predicate ────────────────────── */

/**
 * `Ready to pitch`, in one expression.
 *
 * Every conjunct of the accepted predicate appears here exactly once. The
 * ones this slice can evaluate are evaluated; the ones the Export/Review
 * slice owns arrive on `ProjectReadinessRecord`. Reading this function is
 * how a later engineer discovers the whole rule, instead of finding four
 * partial rules in four screens.
 *
 * Deliberately absent: any notion of a file having been GENERATED or
 * DOWNLOADED. Availability of the required material is the requirement;
 * exporting it is not.
 */
export function projectReadyToPitch(input: {
  /** The project being judged. */
  projectId: string
  readiness: ProjectReadinessRecord | undefined
  options: LoadedOptionFacts | null
  confirmedTruthStale: boolean
}): boolean {
  const { projectId, readiness, options, confirmedTruthStale } = input
  // (2) no blocking source conflict or stale confirmed baseline fact.
  if (confirmedTruthStale) return false
  // (9) an explicit Client Mode review of one exact saved version, and
  // (8) every required export material available for that same version.
  if (!readiness) return false
  if (!readiness.requiredExportMaterialsAvailable) return false
  // A ledger entry is read ONLY against the workspace of its own project.
  // Reading it against whichever project happens to be open is the leak the
  // per-project workspace split exists to prevent, one level up.
  if (!options || options.projectId !== projectId) return false
  // The reviewed version must still exist and still BE that version. A
  // review is an acknowledgement of a fingerprint, so a changed fingerprint
  // is an unreviewed Option wearing a reviewed Option's id.
  const reviewed = options.savedVersions.find(
    (v) => v.optionId === readiness.reviewedOptionId
      && savedVersionFingerprint(v) === readiness.reviewedFingerprint,
  )
  if (!reviewed) return false
  // (7) the exact Option version is saved AND its client projection was
  // valid at save time under the CURRENT projection contract. This is the
  // existing client-projection gate, not a second rule beside it.
  if (!reviewed.clientProjectionValid) return false
  if (reviewed.clientProjectionVersion !== CLIENT_PROJECTION_VERSION) return false
  // (1) (3) (4) (5) (6) reach here as the saved version's own fingerprints:
  // a version is only saved once building scope, scope decisions, the
  // calculation, responsibility and the schedule produced the fingerprints
  // it carries. What this predicate must additionally refuse is a version
  // saved against project truth that has since moved.
  if (reviewed.projectBaselineId !== options.currentProjectBaselineId) return false
  if (options.baselineChangesSinceConfirmation.length > 0) return false
  return true
}

/**
 * The exact identity of a saved Option version.
 *
 * Concatenated from the fingerprints the version already carries rather than
 * minted anew, so "the version changed" and "the fingerprint changed" cannot
 * become two different questions. The separator is a character no
 * fingerprint contains.
 */
export function savedVersionFingerprint(version: SavedOptionVersion): string {
  return [
    version.optionId,
    String(version.version),
    version.projectBaselineId ?? '∅',
    version.buildingScopeFingerprint,
    version.configurationFingerprint,
    version.scheduleFingerprint,
    version.reviewFingerprint,
  ].join('|')
}

/* ──────────────────────────── the decision ──────────────────────────── */

/**
 * Facts → status. The order of the branches IS the status model's
 * precedence, and it is total: every input produces one of the seven.
 */
export function projectLifecycleStatus(facts: ProjectLifecycleFacts): LifecycleStatus {
  // A person said this project is parked, waiting or archived. No derivation
  // overrides a human statement about the project's own commercial state.
  if (facts.hold) return facts.hold
  if (facts.readyToPitch) return 'ready_to_pitch'
  // Stale confirmed truth outranks "work exists": the point of the status is
  // that somebody must look at something, and that is true whether or not
  // the project is otherwise mid-flight.
  if (facts.confirmedTruthStale) return 'review_required'
  if (facts.workCommitted) return 'in_progress'
  return 'new'
}

/**
 * Project-level facts from the analysis record every project carries.
 *
 * `projectAnalyses` is keyed by project id and kept across a project switch
 * (see `PROJECT_SCOPED_KEEP`), so this is available for EVERY navigable
 * project, not only the open one. It is also not persisted, which is why a
 * fresh session derives `New` for both demonstration projects — the honest
 * answer, and the one the accepted target asks for.
 */
export function analysisLifecycleFacts(analysis: ProjectAnalysis | undefined): {
  workCommitted: boolean
  confirmedTruthStale: boolean
} {
  if (!analysis) return { workCommitted: false, confirmedTruthStale: false }
  const workCommitted = analysis.jobState !== 'NOT_STARTED'
    || Object.keys(analysis.conflictDecisions).length > 0
    || Object.keys(analysis.questionResponses).length > 0
    || analysis.baselineCommittedAt !== null
  const confirmedTruthStale = analysis.staleFactKeys.length > 0
    || analysis.staleConflictIds.length > 0
  return { workCommitted, confirmedTruthStale }
}

/**
 * The whole derivation for one navigable project.
 *
 * Kept as one function taking named inputs so the register, a unit test and
 * a later slice all reach the same answer through the same door.
 */
export function deriveProjectLifecycle(input: {
  projectId: string
  hold: ExplicitProjectHold | null
  analysis: ProjectAnalysis | undefined
  readiness: ProjectReadinessRecord | undefined
  options: LoadedOptionFacts | null
}): LifecycleStatus {
  const { workCommitted, confirmedTruthStale } = analysisLifecycleFacts(input.analysis)
  // A baseline that moved after its confirmation is invalidated project
  // truth in exactly the same sense as a stale fact, and it is only visible
  // while the project's own workspace is loaded.
  const baselineMoved = input.options !== null
    && input.options.baselineChangesSinceConfirmation.length > 0
  const stale = confirmedTruthStale || baselineMoved
  return projectLifecycleStatus({
    hold: input.hold,
    workCommitted: workCommitted || baselineMoved,
    confirmedTruthStale: stale,
    readyToPitch: projectReadyToPitch({
      projectId: input.projectId,
      readiness: input.readiness,
      options: input.options,
      confirmedTruthStale: stale,
    }),
  })
}
