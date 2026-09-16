import type { InformationAuthority } from '../design-system/AuthorityTrace'
import type { FixtureDocument, FixtureProject } from './projectAnalysis'

/**
 * What the analysis UNDERSTOOD, as individually addressable items.
 *
 * Before this module the project's understanding existed as five numerals in
 * the fixture — `valuesExtracted: 141`, `sourceEvidencedValues: 123`,
 * `aiInferredValues: 12`, `manualOrConfirmedValues: 6`,
 * `valuesRequiringAttention: 18` — and nothing behind them. Two consequences
 * followed, and both were visible in the product:
 *
 * 1. **The numbers did not reconcile.** For the single-building project the
 *    fixture declared 42 extracted values of which 42 were source-evidenced
 *    AND 42 were manual/confirmed. As sets that is impossible; as literals
 *    nobody noticed, because there was no set. Here the counts are DERIVED
 *    from the items, and the authority counts are partitions of one item set
 *    by construction — `reconcileEvidenceCounts` proves it rather than
 *    asserting it.
 * 2. **A cited source could not be opened.** The product printed
 *    «Jeder Wert führt zu seinem Quelldokument» beside a filename in a
 *    `<span>`; the only route to evidence was a stage switch to the whole
 *    Documents register. An item here carries the document AND the page and
 *    the anchor inside it, so the claim the copy makes is the claim the
 *    interface can honour.
 *
 * Two axes stay separate on purpose. AUTHORITY says where a value's weight
 * comes from — read from a source, derived from other values, confirmed by a
 * person, overridden by a person. STATE says whether it is still good —
 * current, contradicted, stale, superseded, unknown. Collapsing them is how a
 * confirmed value that newer evidence contradicts comes to look identical to
 * an ordinary source-evidenced one; the product's own `AuthorityTrace`
 * already carries the distinction (`authority` + `freshness`), and this model
 * feeds both slots from separate fields.
 *
 * What this module does NOT do: it never decides a gate. Readiness is
 * `projectAnalysis.readiness()` and nothing here is allowed to move it. An
 * evidence register that could block Option creation would be a second gate
 * beside the audited one.
 */

/* ──────────────────────────────── groups ─────────────────────────────── */

/**
 * The four groups, in reading order.
 *
 * The order is the order a project is understood in, not an alphabet:
 * geometry is what the building IS, then what the design must achieve, then
 * how it is built, then what has to be installed in it. `tga` is last
 * because it is the group whose items are consumed furthest downstream — by
 * KG 400 and by the procurement specification — and it is the one the audit
 * found missing entirely.
 */
export const EVIDENCE_GROUPS = ['geometry', 'design', 'construction', 'tga'] as const

export type EvidenceGroup = (typeof EVIDENCE_GROUPS)[number]

export function isEvidenceGroup(value: string): value is EvidenceGroup {
  return (EVIDENCE_GROUPS as readonly string[]).includes(value)
}

/** Dictionary key for a group heading. One mapping, no second list. */
export function evidenceGroupKey(group: EvidenceGroup): string {
  return `vr3.evidence.group.${group}`
}

/* ──────────────────────────── authority & state ──────────────────────── */

/**
 * The four authorities an evidence item may carry.
 *
 * A deliberate SUBSET of the design system's `InformationAuthority`: those
 * ten values cover every value envelope in the product, and an extracted
 * evidence item can only be one of these four. Narrowing it here means the
 * fixture cannot declare `assumed` or `historical` for an item the analysis
 * produced, and `evidenceAuthorityTrace` maps each onto the canonical
 * envelope so the rendering stays the canonical capability's.
 */
export const EVIDENCE_AUTHORITIES = [
  'sourceEvidenced',
  'derived',
  'confirmed',
  'overridden',
] as const

export type EvidenceAuthority = (typeof EVIDENCE_AUTHORITIES)[number]

export function isEvidenceAuthority(value: string): value is EvidenceAuthority {
  return (EVIDENCE_AUTHORITIES as readonly string[]).includes(value)
}

/**
 * Whether the item is still good.
 *
 * `conflict` is NOT `unknown`: a contradicted value still has its previous
 * value and its source, and the product must show both. `superseded` is the
 * item's own history — a later revision replaced its source document, and
 * the item survives as the record of what the earlier one said.
 */
export const EVIDENCE_STATES = [
  'current',
  'conflict',
  'stale',
  'superseded',
  'unknown',
] as const

export type EvidenceState = (typeof EVIDENCE_STATES)[number]

export function isEvidenceState(value: string): value is EvidenceState {
  return (EVIDENCE_STATES as readonly string[]).includes(value)
}

/** A state that means somebody has to look at this item. */
export function needsAttention(state: EvidenceState): boolean {
  return state === 'conflict' || state === 'stale' || state === 'unknown'
}

/* ───────────────────────────── downstream ────────────────────────────── */

/**
 * Where an item is consumed later.
 *
 * This is the half of the model the audit was most explicit about: a KG 400
 * decision must name the upstream evidence it rests on or state that no
 * source requirement was found, and «absence is not a default requirement».
 * Declaring the direction HERE, on the item, means the later decision can
 * resolve its own provenance by id instead of a screen re-deriving it.
 */
export const DOWNSTREAM_REFS = [
  'buildingBaseline',
  'scopeDecision',
  'kg300',
  'kg400',
  'schedule',
  'export',
] as const

export type DownstreamRef = (typeof DOWNSTREAM_REFS)[number]

export function isDownstreamRef(value: string): value is DownstreamRef {
  return (DOWNSTREAM_REFS as readonly string[]).includes(value)
}

export function downstreamRefKey(ref: DownstreamRef): string {
  return `vr3.evidence.downstream.${ref}`
}

/* ─────────────────────────────── the item ────────────────────────────── */

/**
 * One atomic thing the analysis understood.
 *
 * `value` and `requirementKey` are exclusive and exactly one is set. A
 * geometry item HAS a value (`2900.00`, unit `m²`); a design or TGA item
 * states a REQUIREMENT in words, and words in this product live in the
 * dictionary, never in a fixture (rule 36). Both are evidence and both count:
 * «Requirements that are qualitative still count as evidence items when they
 * have a source and downstream relevance.»
 *
 * `projectLevel` + `buildingIds` mirror `FixtureDocument` exactly rather than
 * inventing a second way to say "what does this apply to".
 */
export type FixtureEvidenceItem = {
  /** Stable across surfaces. Downstream decisions cite this, not a label. */
  id: string
  group: EvidenceGroup
  /** Dictionary key for the item's own label. */
  labelKey: string
  /** A decimal string or a count, for an item that has a value. */
  value: string | null
  /** Dictionary key for a requirement stated in words. */
  requirementKey: string | null
  /** Unit for `value`, from the closed unit list. `null` for a count. */
  unit: string | null
  projectLevel: boolean
  buildingIds: string[]
  sourceDocumentId: string
  /** The anchor inside the document, as registered in its manifest. */
  sourceAnchorId: string
  sourcePage: number
  authority: EvidenceAuthority
  state: EvidenceState
  downstreamRefs: DownstreamRef[]
  /**
   * The value this one replaced, for an overridden item, or the value the
   * newer source proposes, for a conflicting one. NEVER discarded: manual
   * and confirmed truth keeps what it displaced (M-1 / D-08).
   */
  previousValue: string | null
  /** Dictionary key for why the human changed it, or why it is contested. */
  reasonKey: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  /**
   * Whether the item is shown before disclosure. `primary` is the group's
   * high-impact head — two to four items — chosen by downstream relevance,
   * not by how interesting the number looks.
   */
  impact: 'primary' | 'secondary'
}

/* ──────────────────────────── the projection ─────────────────────────── */

/** Items of one group, split into what is shown and what discloses. */
export type EvidenceGroupView = {
  group: EvidenceGroup
  /** Every item of the group, in reading order. Nothing is withheld. */
  items: readonly FixtureEvidenceItem[]
  total: number
  /** Items in this group that need somebody to look at them. */
  attentionCount: number
}

/** Every item of a project, in fixture order. */
/**
 * The project as the reader sees it after confirmations made in session.
 *
 * The fixture is the analysis's OUTPUT and stays untouched; a confirmation
 * is a later act by a person, so it is applied as a projection over it
 * rather than by editing the extracted record. Attribution travels with the
 * value — `confirmed` without an actor and a time is exactly what
 * `validateEvidence` rejects.
 */
export function withEvidenceConfirmations(
  project: FixtureProject,
  confirmations: Record<string, { by: string; at: string }>,
  /**
   * Values a person typed in place of the extracted one.
   *
   * Applied AFTER the confirmations and winning over them: a manual value is
   * the stronger act, and it keeps what it displaced (`previousValue`) rather
   * than erasing it — M-1/D-08 hold for a value a person replaced exactly as
   * they hold for one they vouched for.
   */
  overrides: Record<string, { value: string; by: string; at: string }> = {},
): FixtureProject {
  const ids = Object.keys(confirmations)
  const overrideIds = Object.keys(overrides)
  if (ids.length === 0 && overrideIds.length === 0) return project
  let changed = false
  const evidence = project.evidence.map((item) => {
    const override = overrides[item.id]
    if (override) {
      changed = true
      return {
        ...item,
        value: override.value,
        authority: 'overridden' as EvidenceAuthority,
        previousValue: item.previousValue ?? item.value,
        reasonKey: item.reasonKey ?? 'vr3.evidence.override.manualReason',
        confirmedBy: override.by,
        confirmedAt: override.at,
      }
    }
    const confirmation = confirmations[item.id]
    if (!confirmation || item.authority === 'confirmed') return item
    changed = true
    return {
      ...item,
      authority: 'confirmed' as EvidenceAuthority,
      confirmedBy: confirmation.by,
      confirmedAt: confirmation.at,
    }
  })
  return changed ? { ...project, evidence } : project
}

/** Can this value still be confirmed by a person, or is it already vouched for? */
export function isConfirmable(item: FixtureEvidenceItem): boolean {
  return item.authority === 'derived' && item.state === 'current'
}

export function evidenceItems(project: FixtureProject): readonly FixtureEvidenceItem[] {
  return project.evidence
}

/**
 * One group's items, in reading order.
 *
 * NOTHING IS FOLDED AWAY. The group used to show four rows and hide the rest
 * behind «show all 6 more»: the count on the heading then had to explain why
 * a group of ten showed four, and a reader looking for one value had to open
 * every group to find out whether it was in there. The group is the unit of
 * reading, so the group itself is what opens and closes — every row inside it
 * is present the moment it is open.
 *
 * The ORDER carries the work: items still waiting for a person first, then
 * the ones settled in this session directly under them — a value must not
 * travel across the screen at the moment somebody vouches for it — then the
 * rest in fixture order.
 */
export function evidenceGroupView(
  project: FixtureProject,
  group: EvidenceGroup,
  /** Items confirmed or entered by hand in THIS session. */
  settledHere: ReadonlySet<string> = new Set(),
): EvidenceGroupView {
  const all = project.evidence.filter((item) => item.group === group)
  const open = all.filter((item) => isConfirmable(item))
  const openIds = new Set(open.map((item) => item.id))
  const justSettled = all.filter(
    (item) => !openIds.has(item.id) && settledHere.has(item.id),
  )
  const settledIds = new Set(justSettled.map((item) => item.id))
  const rest = all.filter(
    (item) => !openIds.has(item.id) && !settledIds.has(item.id),
  )
  const items = [...open, ...justSettled, ...rest]
  return {
    group,
    items,
    total: all.length,
    attentionCount: all.filter((item) => needsAttention(item.state)).length,
  }
}

export function evidenceGroupViews(project: FixtureProject): EvidenceGroupView[] {
  return EVIDENCE_GROUPS.map((group) => evidenceGroupView(project, group))
}

/* ───────────────────────────── the counts ────────────────────────────── */

/**
 * The aggregate, DERIVED.
 *
 * `total` is the number of atomic items, not of UI rows: an item shown twice
 * — once in its group's head and once in a downstream decision's provenance
 * — is one thing understood, and counting rows would inflate the project's
 * apparent knowledge every time a surface was added.
 *
 * The four authority counts are a PARTITION of the same set. That is why they
 * are computed in one pass from one array instead of being four fixture
 * fields: four independent numbers can contradict each other, and in this
 * fixture they did.
 */
export type EvidenceCounts = {
  total: number
  sourceEvidenced: number
  derived: number
  confirmed: number
  overridden: number
  /** Items in a state that asks for a human. NOT part of the partition. */
  requiringAttention: number
}

export function evidenceCounts(project: FixtureProject): EvidenceCounts {
  const counts: EvidenceCounts = {
    total: 0,
    sourceEvidenced: 0,
    derived: 0,
    confirmed: 0,
    overridden: 0,
    requiringAttention: 0,
  }
  for (const item of project.evidence) {
    counts.total += 1
    counts[item.authority] += 1
    if (needsAttention(item.state)) counts.requiringAttention += 1
  }
  return counts
}

/**
 * The reconciliation, as a value a test can assert on.
 *
 * Returns the list of broken statements, empty when the register is coherent.
 * A boolean would say that something is wrong; this says WHAT, which is the
 * difference between a failing assertion somebody can fix and one somebody
 * re-runs.
 */
export function reconcileEvidenceCounts(project: FixtureProject): string[] {
  const problems: string[] = []
  const counts = evidenceCounts(project)
  /**
   * A project with documents but no evidence has not been understood at all.
   * The register is what the analysis PRODUCED, so an empty one beside a
   * full document shelf is the state the retired count literals used to
   * hide: they said 141 values while nothing behind them existed.
   */
  if (project.documents.length > 0 && counts.total === 0) {
    problems.push(
      `${project.id}: ${project.documents.length} documents and no evidence item — `
      + 'the understanding register is empty',
    )
  }
  const partition = counts.sourceEvidenced + counts.derived
    + counts.confirmed + counts.overridden
  if (partition !== counts.total) {
    problems.push(
      `${project.id}: the authority counts sum to ${partition} but there are `
      + `${counts.total} items — they must partition one set`,
    )
  }
  const grouped = evidenceGroupViews(project)
    .reduce((sum, view) => sum + view.total, 0)
  if (grouped !== counts.total) {
    problems.push(
      `${project.id}: the four groups hold ${grouped} items but the project has `
      + `${counts.total} — every item belongs to exactly one group`,
    )
  }
  const seen = new Set<string>()
  for (const item of project.evidence) {
    if (seen.has(item.id)) problems.push(`${project.id}: duplicate evidence id «${item.id}»`)
    seen.add(item.id)
    const hasValue = item.value !== null
    const hasRequirement = item.requirementKey !== null
    if (hasValue === hasRequirement) {
      problems.push(
        `${project.id}: «${item.id}» must state either a value or a requirement, `
        + `not ${hasValue ? 'both' : 'neither'}`,
      )
    }
    if (item.projectLevel === (item.buildingIds.length > 0)) {
      problems.push(
        `${project.id}: «${item.id}» is ${item.projectLevel ? 'project-level' : 'building-level'} `
        + `and names ${item.buildingIds.length} buildings`,
      )
    }
    if (item.authority === 'overridden' && item.previousValue === null) {
      problems.push(
        `${project.id}: «${item.id}» is an override with no previous value — `
        + 'a manual value that discards what it replaced is not an override',
      )
    }
    if ((item.authority === 'confirmed' || item.authority === 'overridden')
      && (item.confirmedBy === null || item.confirmedAt === null)) {
      problems.push(
        `${project.id}: «${item.id}» claims human authority without an actor and a time`,
      )
    }
    if (item.state === 'conflict' && item.previousValue === null) {
      problems.push(
        `${project.id}: «${item.id}» is in conflict but names no competing value`,
      )
    }
  }
  for (const group of EVIDENCE_GROUPS) {
    const view = evidenceGroupView(project, group)
    /**
     * An EMPTY group is not a defect. A single residential building with a
     * client brief and eight drawings has no building-services document, so
     * it has no TGA requirement — and the honest rendering of that is the
     * group's own empty state, not an invented default. «Absence is not a
     * default requirement» is the audit's wording and this is where it is
     * enforced: nothing may be fabricated to fill a heading.
     *
     * A group that HAS items must offer every one of them: the check used to
     * assert a two-to-four compact head, which stopped being the shape of
     * the surface when the disclosure was replaced by a group that opens.
     */
    if (view.total === 0) continue
    if (view.items.length !== view.total) {
      problems.push(
        `${project.id}: group «${group}» holds ${view.total} items but offers `
        + `${view.items.length}; a group withholds nothing`,
      )
    }
  }
  return problems
}

/* ─────────────────────────── the source link ─────────────────────────── */

/** Where an item's citation points, resolved against the document register. */
export type EvidenceSource = {
  documentId: string
  /** The document's own filename — the label a reader recognises. */
  file: string
  version: string
  issuedAt: string
  page: number
  anchorId: string
}

/**
 * Resolve an item's citation, or `null` when the document is not in the
 * project's register.
 *
 * `null` is a real state and the caller must render it as one: an item whose
 * source has been removed from the project keeps its value and loses its
 * citation, and showing the value with a silently missing source would be
 * the stronger claim.
 */
export function evidenceSource(
  project: FixtureProject,
  item: FixtureEvidenceItem,
): EvidenceSource | null {
  const doc: FixtureDocument | undefined = project.documents
    .find((d) => d.id === item.sourceDocumentId)
  if (!doc) return null
  return {
    documentId: doc.id,
    file: doc.file,
    version: doc.version,
    issuedAt: doc.issuedAt,
    page: item.sourcePage,
    anchorId: item.sourceAnchorId,
  }
}

/**
 * The item's authority as the canonical value envelope wants it.
 *
 * `stale` is not an authority in this model, but it IS one in
 * `InformationAuthority`, where `AuthorityTrace` derives it from the
 * `freshness` slot. So the mapping is explicit: the authority travels as the
 * authority, and a stale or conflicting state travels as freshness, which is
 * what makes the envelope show «needs review» without losing where the value
 * came from.
 */
export function evidenceAuthorityTrace(item: FixtureEvidenceItem): {
  authority: InformationAuthority
  stale: boolean
} {
  return {
    authority: item.authority satisfies EvidenceAuthority as InformationAuthority,
    stale: item.state === 'stale' || item.state === 'conflict',
  }
}

/**
 * The items a downstream decision may cite.
 *
 * Used by KG 400 and by the procurement specification to answer «what
 * required this» by id. An empty result is the honest answer «no source
 * requirement found», and the caller must say that rather than assume a
 * default (`evidence-information-model.md`: absence is not a default
 * requirement).
 */
export function evidenceForDownstream(
  project: FixtureProject,
  ref: DownstreamRef,
): readonly FixtureEvidenceItem[] {
  return project.evidence.filter((item) => item.downstreamRefs.includes(ref))
}

/** One item by id, or `null`. Downstream provenance resolves through this. */
export function evidenceItem(
  project: FixtureProject,
  id: string,
): FixtureEvidenceItem | null {
  return project.evidence.find((item) => item.id === id) ?? null
}
