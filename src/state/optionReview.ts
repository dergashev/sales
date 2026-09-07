/**
 * VR3-04 · FINAL VALIDATION — a long professional review, made navigable.
 *
 * The audit's finding was not that the review was short. It was that the
 * review DID NOT EXIST (C-022 MISSING): the nearest thing in the released
 * product is Export's send preflight, which checks four things and has no
 * opinion about the Option as a document. So "complete" silently doubled as
 * "reviewed", and an Option nobody had read could be presented to a client
 * (audit F-002).
 *
 * The answer the target insists on is NOT a shorter recap. A long
 * specification stays long; what it gains is a sticky index, a status per
 * section, an exact edit route per issue and a return that does not lose the
 * reader's place (T-030–T-032).
 *
 * THIS MODULE OWNS THE REVIEW'S STRUCTURE, NOT ITS CONTENT.
 *
 * Every section's content is read from its own authority at render time —
 * the baseline, the saved building scope, the KG decisions, the schedule and
 * the canonical commercial result. Nothing is copied here, because a review
 * that stored its own copy of a total would be a second total (the data
 * invariant this ticket is held to: "Validation and saved snapshot read
 * canonical sources; they store no duplicate editable totals").
 *
 * What IS stored is one fingerprint per section, so a review is provably
 * about the values that were on screen when it was given, and a later
 * material edit reopens exactly the sections it touched — the lesson of
 * VR3-02's per-building confirmation, applied to twelve sections.
 */

export type ReviewGroupId =
  | 'projectBaseline'
  | 'buildings'
  | 'scope'
  | 'costGroups'
  | 'responsibility'
  | 'schedule'
  | 'assumptions'
  | 'commercialResult'

export type ReviewSectionId =
  | 'projectBaseline'
  | 'buildings'
  | 'scopeDecisions'
  | 'kg200' | 'kg300' | 'kg400' | 'kg500' | 'kg600' | 'kg700'
  | 'responsibility'
  | 'schedule'
  | 'assumptions'
  | 'commercialResult'

/** Where an issue in this section is fixed. One route per owning stage. */
export type ReviewRoute =
  | 'project'
  | 'buildingScope'
  | 'scopeBoundaries'
  | 'kg200' | 'kg300' | 'kg400' | 'kg500' | 'kg600' | 'kg700'
  | 'responsibility'
  | 'schedule'

export type ReviewSectionDefinition = Readonly<{
  id: ReviewSectionId
  groupId: ReviewGroupId
  titleKey: string
  /** The stage that owns this section's data, and therefore its fix. */
  route: ReviewRoute
}>

/**
 * The thirteen sections, in reading order, grouped into the eight index
 * entries beneath the Overview anchor.
 *
 * Twelve in VR3-04 rather than eight because the six cost groups are six
 * sections: a single "KG 200–700 reviewed" tick would be one acknowledgement
 * standing for six independent bodies of decisions. VR3-TGA-UX-00 adds the
 * thirteenth: the interface/responsibility matrix, which used to be reviewed
 * implicitly inside KG 400's fingerprint and now has its own owner, its own
 * section and its own route.
 */
export const REVIEW_SECTIONS: readonly ReviewSectionDefinition[] = [
  { id: 'projectBaseline', groupId: 'projectBaseline', titleKey: 'vr3.review.section.projectBaseline', route: 'project' },
  { id: 'buildings', groupId: 'buildings', titleKey: 'vr3.review.section.buildings', route: 'buildingScope' },
  { id: 'scopeDecisions', groupId: 'scope', titleKey: 'vr3.review.section.scopeDecisions', route: 'scopeBoundaries' },
  { id: 'kg200', groupId: 'costGroups', titleKey: 'vr3.review.section.kg200', route: 'kg200' },
  { id: 'kg300', groupId: 'costGroups', titleKey: 'vr3.review.section.kg300', route: 'kg300' },
  { id: 'kg400', groupId: 'costGroups', titleKey: 'vr3.review.section.kg400', route: 'kg400' },
  { id: 'kg500', groupId: 'costGroups', titleKey: 'vr3.review.section.kg500', route: 'kg500' },
  { id: 'kg600', groupId: 'costGroups', titleKey: 'vr3.review.section.kg600', route: 'kg600' },
  { id: 'kg700', groupId: 'costGroups', titleKey: 'vr3.review.section.kg700', route: 'kg700' },
  // VR3-TGA-UX-00: responsibility truth left the KG 400 section's fingerprint
  // and is represented HERE, exactly once — moving it out of the chapter must
  // not make it disappear from Option readiness.
  { id: 'responsibility', groupId: 'responsibility', titleKey: 'vr3.review.section.responsibility', route: 'responsibility' },
  { id: 'schedule', groupId: 'schedule', titleKey: 'vr3.review.section.schedule', route: 'schedule' },
  { id: 'assumptions', groupId: 'assumptions', titleKey: 'vr3.review.section.assumptions', route: 'project' },
  { id: 'commercialResult', groupId: 'commercialResult', titleKey: 'vr3.review.section.commercialResult', route: 'scopeBoundaries' },
]

export const REVIEW_SECTION_COUNT = REVIEW_SECTIONS.length

/** The index's own entries, in order, each naming the sections beneath it. */
export const REVIEW_GROUPS: readonly Readonly<{
  id: ReviewGroupId
  titleKey: string
  sectionIds: readonly ReviewSectionId[]
}>[] = [
  { id: 'projectBaseline', titleKey: 'vr3.review.group.projectBaseline', sectionIds: ['projectBaseline'] },
  { id: 'buildings', titleKey: 'vr3.review.group.buildings', sectionIds: ['buildings'] },
  { id: 'scope', titleKey: 'vr3.review.group.scope', sectionIds: ['scopeDecisions'] },
  { id: 'costGroups', titleKey: 'vr3.review.group.costGroups', sectionIds: ['kg200', 'kg300', 'kg400', 'kg500', 'kg600', 'kg700'] },
  { id: 'responsibility', titleKey: 'vr3.review.group.responsibility', sectionIds: ['responsibility'] },
  { id: 'schedule', titleKey: 'vr3.review.group.schedule', sectionIds: ['schedule'] },
  { id: 'assumptions', titleKey: 'vr3.review.group.assumptions', sectionIds: ['assumptions'] },
  { id: 'commercialResult', titleKey: 'vr3.review.group.commercialResult', sectionIds: ['commercialResult'] },
]

/* ──────────────────────────────── issues ─────────────────────────────── */

export type ReviewIssueSeverity = 'blocker' | 'permittedWarning'

/**
 * One finding inside one section.
 *
 * `blocker` locks the save; `permittedWarning` is a warning the Product
 * explicitly permits to travel with an indicative offer (an accepted
 * assumption, an uncertainty band) and therefore does not lock anything. A
 * warning that locked the save would make every indicative offer
 * unsendable; a blocker that did not would make the gate decorative.
 */
export type ReviewIssue = Readonly<{
  id: string
  sectionId: ReviewSectionId
  severity: ReviewIssueSeverity
  messageKey: string
  values?: Readonly<Record<string, string | number>>
  /**
   * A duration the sentence needs, in HALF MONTHS — raw for the same reason
   * `ScheduleIssue` keeps it raw: `{months}` has to be both localised and
   * correctly inflected, and this module has no locale.
   */
  durationHalfMonths?: number
  /** The stage that fixes it. Always present: an issue without a route is a dead end. */
  route: ReviewRoute
}>

/**
 * One section as the review sees it: its identity, the fingerprint of the
 * values it currently shows, and its findings. The store composes these
 * from the canonical authorities; this module never reads them itself.
 */
export type ReviewSectionInput = Readonly<{
  id: ReviewSectionId
  fingerprint: string
  issues: readonly ReviewIssue[]
}>

/* ──────────────────────────────── state ──────────────────────────────── */

export type ReviewAcknowledgement = Readonly<{
  fingerprint: string
  actor: string
  at: string
}>

export type ReviewConfirmation = Readonly<{
  fingerprint: string
  actor: string
  at: string
}>

export type OptionReviewState = {
  /** Per-section acknowledgement, keyed by section id. */
  reviewAcknowledged: Readonly<Partial<Record<ReviewSectionId, ReviewAcknowledgement>>>
  /** The one final confirmation that makes Save available. */
  reviewConfirmation: ReviewConfirmation | null
  /** The section the reader is on, so a return route lands where it left. */
  reviewFocusSectionId: ReviewSectionId | null
}

/* ─────────────────────────────── reading ─────────────────────────────── */

export type ReviewSectionStatus = 'ISSUE' | 'PENDING' | 'STALE' | 'REVIEWED'

/**
 * A section's status.
 *
 * `ISSUE` outranks everything: a section with a blocker is not "reviewed"
 * even if somebody ticked it before the blocker appeared. `STALE` is an
 * acknowledgement whose fingerprint no longer describes the section — it is
 * not the same as never having read it, and the surface says which.
 */
export function reviewSectionStatus(
  state: Pick<OptionReviewState, 'reviewAcknowledged'>,
  input: ReviewSectionInput,
): ReviewSectionStatus {
  if (input.issues.some((issue) => issue.severity === 'blocker')) return 'ISSUE'
  const acknowledged = state.reviewAcknowledged[input.id]
  if (!acknowledged) return 'PENDING'
  return acknowledged.fingerprint === input.fingerprint ? 'REVIEWED' : 'STALE'
}

export type ReviewProgress = {
  reviewed: number
  total: number
  /** Sections still owing a read, in reading order. */
  outstanding: readonly ReviewSectionId[]
  blockers: readonly ReviewIssue[]
  permittedWarnings: readonly ReviewIssue[]
}

export function reviewProgress(
  state: Pick<OptionReviewState, 'reviewAcknowledged'>,
  inputs: readonly ReviewSectionInput[],
): ReviewProgress {
  const outstanding: ReviewSectionId[] = []
  let reviewed = 0
  const blockers: ReviewIssue[] = []
  const permittedWarnings: ReviewIssue[] = []
  for (const definition of REVIEW_SECTIONS) {
    const input = inputs.find((candidate) => candidate.id === definition.id)
    if (!input) { outstanding.push(definition.id); continue }
    for (const issue of input.issues) {
      if (issue.severity === 'blocker') blockers.push(issue)
      else permittedWarnings.push(issue)
    }
    if (reviewSectionStatus(state, input) === 'REVIEWED') reviewed += 1
    else outstanding.push(definition.id)
  }
  return {
    reviewed,
    total: REVIEW_SECTION_COUNT,
    outstanding,
    blockers,
    permittedWarnings,
  }
}

/** The next section owing a read, so "REVIEW NEXT" is a route and not a hint. */
export function nextReviewSection(
  state: Pick<OptionReviewState, 'reviewAcknowledged'>,
  inputs: readonly ReviewSectionInput[],
): ReviewSectionId | null {
  return reviewProgress(state, inputs).outstanding[0] ?? null
}

/**
 * The fingerprint of the whole review: every section's own fingerprint, in
 * reading order. The final confirmation records it, so ANY material change
 * anywhere in the Option reopens the confirmation — which is exactly the
 * behaviour the ticket asks for ("Any material post-confirmation edit marks
 * validation stale") and exactly what a per-section list cannot express on
 * its own.
 */
export function reviewFingerprint(
  inputs: readonly ReviewSectionInput[],
): string {
  return REVIEW_SECTIONS
    .map((definition) => {
      const input = inputs.find((candidate) => candidate.id === definition.id)
      return `${definition.id}=${input?.fingerprint ?? '-'}`
    })
    .join('#')
}

export type ReviewStage =
  | 'UNAVAILABLE'
  | 'INCOMPLETE'
  | 'ISSUES'
  | 'READY'
  | 'CONFIRMED'
  | 'STALE'

/**
 * The review stage. `available` is the gate this stage sits behind — a
 * confirmed schedule — and it is passed in rather than derived here, because
 * this module deliberately knows nothing about the schedule.
 */
export function optionReviewStage(
  state: Pick<OptionReviewState, 'reviewAcknowledged' | 'reviewConfirmation'>,
  inputs: readonly ReviewSectionInput[],
  available: boolean,
): ReviewStage {
  if (!available) return 'UNAVAILABLE'
  const progress = reviewProgress(state, inputs)
  if (progress.blockers.length > 0) return 'ISSUES'
  const confirmation = state.reviewConfirmation
  if (confirmation) {
    return confirmation.fingerprint === reviewFingerprint(inputs)
      ? 'CONFIRMED'
      : 'STALE'
  }
  return progress.reviewed === progress.total ? 'READY' : 'INCOMPLETE'
}

export function reviewReadyToConfirm(
  state: Pick<OptionReviewState, 'reviewAcknowledged' | 'reviewConfirmation'>,
  inputs: readonly ReviewSectionInput[],
  available: boolean,
): boolean {
  const stage = optionReviewStage(state, inputs, available)
  if (stage === 'READY') return true
  // A STALE confirmation is confirmable again once every section it
  // invalidated has been read again. Otherwise the recovery route is the
  // sections, not the confirm button.
  return stage === 'STALE'
    && reviewProgress(state, inputs).reviewed === REVIEW_SECTION_COUNT
}

/** The save gate: a final confirmation that still describes the Option. */
export function reviewConfirmed(
  state: Pick<OptionReviewState, 'reviewAcknowledged' | 'reviewConfirmation'>,
  inputs: readonly ReviewSectionInput[],
  available: boolean,
): boolean {
  return optionReviewStage(state, inputs, available) === 'CONFIRMED'
}

export function reviewSectionDefinition(id: ReviewSectionId): ReviewSectionDefinition {
  const definition = REVIEW_SECTIONS.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`unknown review section: ${id}`)
  return definition
}
