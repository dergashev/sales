import Decimal from 'decimal.js'
import type { CostGroup, Driver } from '../engine/calculate'
import {
  KG_SCOPE_GROUPS,
  type KgScopeDecision,
  type KgSelectionWithoutBasis,
  type KgStandardDelta,
} from '../engine/kgConfiguration'
import type { Displayed, Rate } from '../engine/money'

/**
 * ONE canonical commercial result (VR3-03, targets T-028; audit F-001/F-010).
 *
 * The audit's P0 finding was not an arithmetic bug. It was that total,
 * breakdown, drivers and the diagnostic beside them were four independent
 * renderings, so one of them could contradict the others and did — a
 * user-reachable diagnostic reported drivers of EUR 3.244.500 next to a
 * result of EUR 3.817.835. This type is the answer: one object, produced
 * once, carrying the total, its meaning, the DIN 276 composition, the
 * contributions those rows are grouped FROM, the included summary, the last
 * causal change and the trust state.
 *
 * `reconciles` is COMPUTED, not asserted. A caption that claims the drivers
 * sum to the total while nothing checks it is how the contradiction survived
 * release; here the claim and the check are the same field.
 */

export type CommercialStatus =
  /** The result describes the current decisions. */
  | 'ready'
  /**
   * The shown snapshot is the last TRUSTED one, not the current one.
   * Never a zero and never a blank: an offer engine that answers "0 EUR"
   * when it cannot answer is worse than one that says so (rule 16).
   */
  | 'stale'

/**
 * WHY the shown snapshot is not current.
 *
 * Two failures, one state, because the reader's question is the same one:
 * "can I quote this number right now?". They are told apart by their words
 * and by which retry resolves them, never by tone alone (rule 8).
 */
export type CommercialStaleReason =
  /** The calculation itself could not produce a result. */
  | 'calculation'
  /** The result is current but could not be written to storage. */
  | 'persistence'

/**
 * The trust state of the shown commercial result (VR3-03R, audit G-07;
 * target L; screen-by-screen spec §15).
 *
 * VR3-03 declared a two-value `CommercialStatus` and then hard-coded
 * `status: 'ready'` at the one place a result was built — so the type
 * described a state machine the product could not enter, and no surface
 * could render one. Rule 16 forbids the zero on a missing basis; this is
 * the same obligation one level up: when the ENGINE cannot answer, the
 * last answer it gave stays on screen, labelled, with the action that
 * resolves it.
 *
 * `attempts` exists so a retry that fails AGAIN still says so. A recovery
 * affordance that looks identical before and after a failed attempt is how
 * a user comes to believe a number recovered when it did not.
 */
export type CommercialTrust = Readonly<{
  status: CommercialStatus
  reason: CommercialStaleReason | null
  /** When the shown values were last known to be current. */
  sinceIso: string | null
  /** How many recovery attempts have failed since `sinceIso`. */
  attempts: number
}>

export const COMMERCIAL_TRUSTED: CommercialTrust = Object.freeze({
  status: 'ready' as const,
  reason: null,
  sinceIso: null,
  attempts: 0,
})

export type CommercialCoverage = 'total' | 'subtotal'

export type CommercialChange = Readonly<{
  /** Monotonic within a session, so a repeated identical decision still
   * reads as a new event rather than silently reusing the old one. */
  id: string
  labelDe: string
  labelEn: string
  signedExact: Decimal
  group: CostGroup | null
  atIso: string
}>

/**
 * The attributable cause of one commercial mutation (VR3-03R, audit G-06).
 *
 * Both languages, for the reason `CommercialChange` carries both: the rail
 * has to name the decision in the interface's own language, and a German
 * label beside an English service name is the mixed-language state rule 10
 * forbids.
 *
 * An action that changes the total and supplies NO cause is not a bug in
 * this type — it is the case the contract exists for: the previous
 * explanation is cleared rather than left standing beside a number it no
 * longer explains.
 */
export type CommercialCause = Readonly<{
  de: string
  en: string
  group: CostGroup | null
}>

export type CommercialGroupLine = Readonly<{
  group: CostGroup
  decision: KgScopeDecision | 'notDecidable'
  /** `null` is "no priced position", which is never rendered as 0 (rule 16). */
  exact: Decimal | null
}>

export type CommercialScopeSummary = Readonly<{
  includedGroups: number
  excludedGroups: number
  undecidedGroups: number
  decidableGroups: number
  selectedServices: number
  /**
   * Open commercial decisions, from ONE authority (VR3-COST-00, gate 7).
   *
   * This used to read `openKgDecisionCount` on the KG basis and a literal
   * `0` on the proposal basis — a knowingly false count, harmless only
   * while nothing rendered it. The compact cockpit renders it beside the
   * amount, so it now comes from the completeness reasons the ENGINE
   * already produces (`IncompleteReason.openMaterialIssues`), which is the
   * same number on the KG basis and a truthful one on the other. No
   * eligibility rule changed; a second counter was removed.
   */
  openDecisions: number
  invalidServices: number
}>

/**
 * The Regionalfaktor, as a STATEMENT rather than a formula (rule 40, D-15).
 *
 * `effect` is what the factor contributes when it is active and what it
 * WOULD contribute when it is not — one quantity, one definition
 * (`regionalFactorEffect`, `engine/calculate.ts`). The rail used to compute
 * the counterfactual itself, which made the view a second calculator of a
 * released formula.
 */
/**
 * The per-decision facts a commercial surface needs and cannot derive from a
 * `Driver`: which alternative is currently selected, and — where the fixture
 * declares an All3 standard — the delta against that NAMED reference.
 *
 * Keyed by the driver key, so a surface looks a row up rather than reaching
 * into the catalogue itself. `standard: null` means there is no meaningful
 * reference, and the correct rendering of that is an EMPTY delta, never zero.
 */
export type CommercialDecisionFact = Readonly<{
  valueDe: string | null
  valueEn: string | null
  standard: KgStandardDelta | null
}>

export type CommercialRegionalFactor = Readonly<{
  active: boolean
  value: Decimal
  /** Applied to the Bauwerk block, never to the total (CALC-009). */
  effect: Decimal
}>

export type CommercialResult = Readonly<{
  /** Increments whenever the numbers change, so a consumer can prove two
   * surfaces are showing the same result rather than assuming it. */
  version: number
  basis: 'kgConfiguration' | 'proposal'
  total: Displayed
  /** Derived from coverage, never assigned (R-18). */
  totalLabel: string
  coverage: CommercialCoverage
  uncertaintyPp: number
  leadRate: Rate
  byCostGroup: readonly CommercialGroupLine[]
  contributions: readonly Driver[]
  /**
   * Selections that are commercially real and carry NO amount of their own
   * (VR3-COST-00 · Cost Driver contract §2.6/§2.7).
   *
   * They are deliberately absent from `contributions`, because a
   * contribution is something that contributes. Without them the product
   * could not distinguish "not selected" from "selected, priced inside
   * another position" — and rendered the second as the first.
   */
  selectionsWithoutBasis: readonly KgSelectionWithoutBasis[]
  /** Per-decision facts, by driver key. See `CommercialDecisionFact`. */
  decisionFacts: Readonly<Record<string, CommercialDecisionFact>>
  /** The Bauwerk block the Regionalfaktor and the KG shares apply to. */
  bauwerk: Decimal
  regionalFactor: CommercialRegionalFactor
  scope: CommercialScopeSummary
  lastChange: CommercialChange | null
  /**
   * Whether these numbers describe the current decisions, and if not, why.
   * Read `trust.status`, never a bare boolean: "stale" and "wrong" are
   * different claims and only one of them is true here.
   */
  trust: CommercialTrust
  /** When this snapshot was derived — the timestamp a stale label cites. */
  derivedAtIso: string
  reconciles: boolean
  reconciliationDrift: Decimal
}>

const DIN_ORDER: readonly CostGroup[] = [
  'KG_100', 'KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700', 'KG_800',
]

/** The DIN 276 lines, in DIN order, from the result's own composition. */
export function commercialGroupLines(
  split: Partial<Record<CostGroup, Decimal>>,
  decisionOf: (group: CostGroup) => KgScopeDecision | 'notDecidable',
): readonly CommercialGroupLine[] {
  return DIN_ORDER
    .filter((group) => decisionOf(group) !== 'notDecidable' || split[group] !== undefined)
    .map((group) => ({
      group,
      decision: decisionOf(group),
      exact: split[group] ?? null,
    }))
}

/**
 * Does the composition add up to the total?
 *
 * The discount is not a DIN 276 group, so it is passed separately rather than
 * folded into one — folding it in would make the rows sum to the printed
 * total while hiding which row moved (Task 04's F-30 lesson).
 */
export function reconcileCommercial(
  lines: readonly CommercialGroupLine[],
  discount: Decimal,
  total: Decimal,
): Readonly<{ reconciles: boolean; drift: Decimal }> {
  const grouped = lines.reduce(
    (sum, line) => sum.plus(line.exact ?? new Decimal(0)), new Decimal(0),
  )
  const drift = total.minus(grouped.plus(discount))
  return { reconciles: drift.isZero(), drift }
}

/** How many of the six decidable groups sit in each state. */
export function scopeCounts(
  decisionOf: (group: CostGroup) => KgScopeDecision | 'notDecidable',
) {
  let included = 0
  let excluded = 0
  let undecided = 0
  for (const group of KG_SCOPE_GROUPS) {
    const decision = decisionOf(group)
    if (decision === 'included') included += 1
    else if (decision === 'excluded') excluded += 1
    else if (decision === 'undecided') undecided += 1
  }
  return {
    includedGroups: included,
    excludedGroups: excluded,
    undecidedGroups: undecided,
    decidableGroups: KG_SCOPE_GROUPS.length,
  }
}
