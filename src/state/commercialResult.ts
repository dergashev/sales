import Decimal from 'decimal.js'
import type { CostGroup, Driver } from '../engine/calculate'
import { KG_SCOPE_GROUPS, type KgScopeDecision } from '../engine/kgConfiguration'
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
   * The last calculation failed and this is the previous TRUSTED result.
   * Never a zero and never a blank: an offer engine that answers "0 EUR"
   * when it cannot answer is worse than one that says so (rule 16).
   */
  | 'error'

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
  openDecisions: number
  invalidServices: number
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
  scope: CommercialScopeSummary
  lastChange: CommercialChange | null
  status: CommercialStatus
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
