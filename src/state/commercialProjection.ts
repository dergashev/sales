import Decimal from 'decimal.js'
import type { CostAuthority, CostGroup, Driver } from '../engine/calculate'
import {
  KG_SCOPE_GROUPS,
  chapterOf,
  kgCatalogues,
  serviceById as kgServiceById,
  type KgScopeGroup,
  type KgSelectionWithoutBasis,
} from '../engine/kgConfiguration'
import { KG_STEP_ID, type OptionDestination } from './optionLifecycle'
import type {
  CommercialDecisionFact, CommercialGroupLine, CommercialResult,
} from './commercialResult'

/**
 * THE COMMERCIAL PROJECTIONS — read, classify, rank, route. Never price.
 *
 * VR3-COST-00. One commercial authority already exists and is released:
 *
 * ```
 * computeProjection → deriveCommercialResult → commercialSnapshot → CommercialResult
 * ```
 *
 * What did NOT exist was a layer between it and the surfaces that read it, so
 * ten commercial calculations grew inside `OfferPanel.tsx` — including a
 * second copy of the Regionalfaktor counterfactual and a second completeness
 * recount — and every new surface was one more chance for two renderings of
 * one truth to disagree. That is the F-001 class this file closes for good.
 *
 * WHAT EVERY FUNCTION HERE MAY DO: select, group, classify, rank, resolve a
 * destination, and describe a presentation state.
 *
 * WHAT NONE OF THEM MAY DO: re-price, invent a rate, change a formula, or
 * recompute anything `CommercialResult` already decided. There is no
 * `Decimal` arithmetic in this file beyond comparison and sign, and the two
 * places that add (`contributionLedger`'s per-group sum, the composition
 * share) sum values the result itself produced and state that they do.
 *
 * TWO CONCEPTS, DELIBERATELY NOT ONE:
 *
 * - `commercialComposition` answers **where is the current money** — the
 *   reconciling DIN 276 structure. Rule 35's arithmetic invariant lives here.
 * - `selectedCommercialEffects` answers **which of my choices matter
 *   commercially** — a projection of the current Option's decisions. It does
 *   NOT sum to the total, by construction, because the total also contains
 *   base, fact-derived, inherited and non-configurable cost.
 *
 * They are related. They are not interchangeable, and they never share a name.
 */

/* ── 1 · commercial completeness ───────────────────────────────────────── */

export type CommercialCompleteness = Readonly<{
  coverage: 'total' | 'subtotal'
  includedGroups: number
  excludedGroups: number
  undecidedGroups: number
  decidableGroups: number
  openDecisions: number
  /** Green only when nothing is open and nothing is undecided. */
  settled: boolean
}>

/**
 * The completeness line, from the canonical counters and nowhere else.
 *
 * `OfferPanel` used to recount included/decided groups from `s.coverage`
 * beside a `CommercialRailScope` block reading `result.scope` — two counters
 * of one fact, one of them in a view.
 */
export function commercialCompleteness(result: CommercialResult): CommercialCompleteness {
  const { scope } = result
  return {
    coverage: result.coverage,
    includedGroups: scope.includedGroups,
    excludedGroups: scope.excludedGroups,
    undecidedGroups: scope.undecidedGroups,
    decidableGroups: scope.decidableGroups,
    openDecisions: scope.openDecisions,
    settled: scope.undecidedGroups === 0 && scope.openDecisions === 0,
  }
}

/* ── 2 · DIN 276 composition ───────────────────────────────────────────── */

/**
 * Why a composition row carries no amount. `UNKNOWN ≠ ZERO`, and neither do
 * the other three — each is a different sentence and none of them is `0 €`.
 */
export type CompositionRowState =
  /** A real amount, from the result's own composition. */
  | 'priced'
  /** Included, decided, and no priced position exists for it yet. */
  | 'unpriced'
  /** Deliberately not part of the offer. */
  | 'excluded'
  /** No explicit decision has been taken. */
  | 'undecided'

export type CompositionRow = Readonly<{
  group: CostGroup
  state: CompositionRowState
  /** `null` is an ABSENCE and must never be rendered as `0 €` (rule 16). */
  exact: Decimal | null
  /** Share of the CURRENT basis, or `null` when there is no amount. */
  sharePercent: number | null
}>

export type CommercialComposition = Readonly<{
  rows: readonly CompositionRow[]
  /** The row the shares are shares OF — a subtotal when coverage is partial. */
  totalExact: Decimal
  totalLabel: string
  coverage: 'total' | 'subtotal'
  reconciles: boolean
  reconciliationDrift: Decimal
}>

function stateOfLine(line: CommercialGroupLine): CompositionRowState {
  if (line.decision === 'excluded') return 'excluded'
  if (line.decision === 'undecided' || line.decision === 'notDecidable') return 'undecided'
  return line.exact === null ? 'unpriced' : 'priced'
}

/**
 * The top-level DIN 276 composition, exactly as the result composed it.
 *
 * The rail renders this and nothing below it: a Kostenschätzung is determined
 * at the second DIN level, so level 1 is the summary and level 2 belongs to
 * Kostendetails. The percentage basis is the CURRENT total — which is a
 * subtotal whenever coverage is partial, and the surface says so once rather
 * than implying shares of a complete project value.
 */
export function commercialComposition(result: CommercialResult): CommercialComposition {
  const basis = result.total.exact
  const rows = result.byCostGroup.map((line): CompositionRow => {
    const state = stateOfLine(line)
    const exact = state === 'priced' ? line.exact : null
    return {
      group: line.group,
      state,
      exact,
      sharePercent: exact && !basis.isZero()
        ? exact.div(basis).mul(100).toNumber()
        : null,
    }
  })
  return {
    rows,
    totalExact: basis,
    totalLabel: result.totalLabel,
    coverage: result.coverage,
    reconciles: result.reconciles,
    reconciliationDrift: result.reconciliationDrift,
  }
}

/**
 * The rows the COMPACT rail shows: everything that carries a commercial
 * statement, and nothing that is merely still open.
 *
 * A group with no decision yet has nothing to say in a composition — it is
 * neither an amount nor a stated boundary — and the completeness line one
 * block above already counts it, by name, in the same glance. A deliberately
 * EXCLUDED group is the opposite: that is a decision with a commercial
 * meaning (`Nicht im All3-Umfang`), and it earns its row.
 *
 * Kostendetails § C shows all of them, undecided included, because a full
 * breakdown that silently omits a group is a breakdown that cannot be
 * reconciled against the six decisions the Option owes.
 */
export function railCompositionRows(
  composition: CommercialComposition,
): readonly CompositionRow[] {
  return composition.rows.filter((row) => row.state !== 'undecided')
}

/* ── 3 · selected commercial effects (`Auswahl mit Preiswirkung`) ───────── */

/**
 * The authority a selected effect declares — or the honest admission that the
 * producer declared none.
 *
 * `unknown` exists so a missing authority can never be silently read as
 * `direct`. Missing authority is not evidence of direct pricing, and an
 * `unknown` row renders no exact amount.
 */
export type EffectAuthority = CostAuthority | 'unknown'

export type SelectedCommercialEffect = Readonly<{
  /** Stable identity, including any `${buildingId}:` prefix. */
  key: string
  /** The engine's German label; the view translates it. */
  label: string
  /** The chosen alternative, where the decision has one. */
  valueDe: string | null
  valueEn: string | null
  authority: EffectAuthority
  bundleLabelDe: string | null
  bundleLabelEn: string | null
  /**
   * The CURRENT contribution, unsigned in meaning: `430.000 €`, never
   * `+ 430.000 €`. `null` means no amount may be rendered at all — never 0,
   * never `± 0 €`.
   */
  exact: Decimal | null
  /** A contribution whose own value is negative — a `Minderung`, not a delta. */
  negative: boolean
  costGroup: CostGroup | null
  /**
   * The named reference this effect can be compared against, and the delta
   * against it. `null` is an ABSENT delta, which is a correct and common
   * state — never `± 0 €`, which would claim the two options cost the same.
   */
  reference: CommercialDecisionFact['standard']
  /** Where the decision that controls this effect lives, or `null`. */
  destination: OptionDestination | null
  /** The underlying contribution, for surfaces that need its basis/provenance. */
  driver: Driver | null
  /** A priced position whose quantity is zero: a rate, nothing to apply it to. */
  zeroQuantity?: true
}>

export type SelectedCommercialEffects = Readonly<{
  /** Every current effect: rankable ones first, then the amount-less ones. */
  all: readonly SelectedCommercialEffect[]
  /** What the compact rail shows. Never more than `RAIL_EFFECT_LIMIT`. */
  ranked: readonly SelectedCommercialEffect[]
  /** Everything `ranked` left out, amount-bearing and not. */
  hiddenCount: number
  /** How many of the hidden ones carry no amount of their own. */
  hiddenWithoutAmountCount: number
}>

/**
 * THE RAIL SHOWS EXACTLY THREE.
 *
 * A summary list is capped and finite with a labelled path to the complete
 * set; a list that grows with the data is not a summary. Measured at
 * 1280 × 800: three keeps the whole cockpit — figures, effects, DIN 276 and
 * the CTA — inside the first viewport; five costs it the composition.
 */
export const RAIL_EFFECT_LIMIT = 3

/** A driver key without the `${buildingId}:` prefix `computeProjection` adds. */
export function withoutBuildingPrefix(
  key: string, buildingIds: readonly string[],
): string {
  if (buildingIds.length <= 1) return key
  const id = buildingIds.find((candidate) => key.startsWith(`${candidate}:`))
  return id ? key.slice(id.length + 1) : key
}

const KG_REF = /^KG[\s  ](\d)00$/

function costGroupOfDriver(driver: Driver): CostGroup | null {
  for (const ref of driver.scopeRefs) {
    const match = KG_REF.exec(ref.trim())
    if (match) return `KG_${match[1]}00` as CostGroup
  }
  return null
}

/**
 * Which decision controls this effect — SEMANTIC routing, never a DOM anchor.
 *
 * Every pattern below is a key convention that already exists in the
 * producers (`kgConfiguration.ts`, `options.ts`, `scopeCatalog.ts`,
 * `store.ts`). A key that matches none of them resolves to `null`, and a
 * `null` destination renders as plain text — which is what makes a dead
 * `Zur Entscheidung` impossible by construction rather than by review.
 */
export function costDriverDestination(
  key: string, buildingIds: readonly string[] = [],
): OptionDestination | null {
  const bare = withoutBuildingPrefix(key, buildingIds)
  if (bare.startsWith('kg_')) {
    const serviceId = bare.slice(3)
    for (const catalogue of kgCatalogues()) {
      const service = kgServiceById(catalogue, serviceId)
      if (!service) continue
      const group = KG_SCOPE_GROUPS.find((g) => {
        const chapter = chapterOf(catalogue, g)
        return chapter?.groups.some((entry) =>
          entry.services.some((candidate) => candidate.id === serviceId)) ?? false
      })
      if (group) return { stage: 'kalkulieren', step: KG_STEP_ID[group] }
    }
    return null
  }
  if (bare.startsWith('cov_')
    || bare === 'kg300_excluded_adjustment'
    || bare === 'kg400_excluded_adjustment') {
    return { stage: 'konfigurieren', step: 'leistungsabgrenzung' }
  }
  const scoped = /^(?:opt|scope)_/.test(bare)
  if (scoped) return { stage: 'konfigurieren', step: 'leistungsabgrenzung' }
  return null
}

/** The KG chapter a group-scoped selection belongs to. */
function destinationOfGroup(group: KgScopeGroup): OptionDestination {
  return { stage: 'kalkulieren', step: KG_STEP_ID[group] }
}

function authorityOf(driver: Driver): EffectAuthority {
  return driver.costAuthority ?? 'unknown'
}

/**
 * May this authority carry an exact amount?
 *
 * `direct` only. Everything else states its basis in words — and `unknown`
 * is emphatically included, because the one inference this axis exists to
 * prevent is "no authority declared, therefore directly priced".
 */
export function rendersExactAmount(authority: EffectAuthority): boolean {
  return authority === 'direct'
}

function effectFromDriver(
  driver: Driver,
  buildingIds: readonly string[],
  facts: Readonly<Record<string, CommercialDecisionFact>>,
): SelectedCommercialEffect {
  const authority = authorityOf(driver)
  /**
   * A driver produced OUTSIDE the KG catalogue declares no authority, and
   * the honest reading of that is not `unknown` in the sense of "we lost it"
   * — those producers have always priced directly and their `exact` IS the
   * released contribution. `unknown` is reserved for a KG-shaped key whose
   * authority genuinely failed to cross the boundary, which after this task
   * cannot happen; the branch stays because a future producer could.
   */
  const bare = withoutBuildingPrefix(driver.key, buildingIds)
  const isKgService = bare.startsWith('kg_')
  const fact = facts[bare] ?? null
  const resolved: EffectAuthority = driver.costAuthority
    ? authority
    : (isKgService ? 'unknown' : 'direct')
  return {
    key: driver.key,
    label: driver.label,
    valueDe: fact?.valueDe ?? null,
    valueEn: fact?.valueEn ?? null,
    authority: resolved,
    bundleLabelDe: driver.bundleLabelDe ?? null,
    bundleLabelEn: driver.bundleLabelEn ?? null,
    exact: rendersExactAmount(resolved) ? driver.exact : null,
    negative: driver.exact.isNegative(),
    costGroup: costGroupOfDriver(driver),
    reference: fact?.standard ?? null,
    destination: costDriverDestination(driver.key, buildingIds),
    driver,
  }
}

function effectFromSelection(
  selection: KgSelectionWithoutBasis,
  facts: Readonly<Record<string, CommercialDecisionFact>>,
): SelectedCommercialEffect {
  return {
    key: `kg_${selection.serviceId}`,
    label: selection.labelDe,
    valueDe: selection.valueDe,
    valueEn: selection.valueEn,
    authority: selection.costAuthority,
    bundleLabelDe: selection.costBasisDe ?? null,
    bundleLabelEn: selection.costBasisEn ?? null,
    // Structurally impossible to render an amount: there is none to render.
    exact: null,
    negative: false,
    costGroup: selection.group,
    // A selection with no price basis has no truthful delta either: the
    // product knows it has no basis, not that the price did not move.
    reference: facts[`kg_${selection.serviceId}`]?.standard ?? null,
    destination: destinationOfGroup(selection.group),
    driver: null,
    ...(selection.zeroQuantity ? { zeroQuantity: true as const } : {}),
  }
}

/**
 * THE current commercial configuration — a projection of state, never a log.
 *
 * Membership is the released predicate, not a new one:
 * `contributions.filter(origin === 'decision')`, minus `discount` and
 * `surcharge` (a discount is a commercial instrument and a risk surcharge is
 * a derived percentage; both keep their own rows in the composition), plus
 * the selections that are commercially real and carry no amount at all.
 *
 * MAGNITUDE NEVER CONFERS MEMBERSHIP. `Tragwerk Massivbau` is the largest
 * single number in the happy fixture and is `origin: 'base'`, so it is
 * composition, not a choice, and it appears only in the DIN 276 breakdown and
 * the contribution ledger.
 *
 * Ranking is `|exact|` descending with `key` ascending as a stable tie-break:
 * a saving is exactly as commercially material as an increase of the same
 * size, and two equal contributions must not swap places on a re-render.
 */
export function selectedCommercialEffects(
  result: CommercialResult,
  buildingIds: readonly string[] = [],
): SelectedCommercialEffects {
  const fromDrivers = result.contributions
    .filter((d) => d.origin === 'decision'
      && d.block !== 'discount' && d.block !== 'surcharge')
    .map((d) => effectFromDriver(d, buildingIds, result.decisionFacts))
  const fromSelections = result.selectionsWithoutBasis
    .map((selection) => effectFromSelection(selection, result.decisionFacts))
  const seen = new Set(fromDrivers.map((e) => e.key))
  const all = [
    ...fromDrivers,
    ...fromSelections.filter((e) => !seen.has(e.key)),
  ]
  const rankable = all
    .filter((e) => e.exact !== null)
    .sort((a, b) => {
      const magnitude = b.exact!.abs().comparedTo(a.exact!.abs())
      if (magnitude !== 0) return magnitude
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    })
  const withoutAmount = all
    .filter((e) => e.exact === null)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const ordered = [...rankable, ...withoutAmount]
  const ranked = rankable.slice(0, RAIL_EFFECT_LIMIT)
  const hidden = ordered.slice(ranked.length)
  return {
    all: ordered,
    ranked,
    hiddenCount: hidden.length,
    hiddenWithoutAmountCount: hidden.filter((e) => e.exact === null).length,
  }
}

/* ── 4 · the contribution ledger ───────────────────────────────────────── */

export type LedgerOrigin = Driver['origin']

export type LedgerRow = Readonly<{
  key: string
  label: string
  exact: Decimal
  costGroup: CostGroup | null
  origin: LedgerOrigin
  authority: EffectAuthority
  driver: Driver
}>

export type LedgerGroup = Readonly<{
  group: CostGroup | null
  rows: readonly LedgerRow[]
  subtotal: Decimal
}>

export type ContributionLedger = Readonly<{
  groups: readonly LedgerGroup[]
  /** The sum of every row. It reconciles, and the surface proves it. */
  sum: Decimal
  totalExact: Decimal
  reconciles: boolean
  drift: Decimal
  rowCount: number
}>

const LEDGER_ORDER: readonly CostGroup[] = [
  'KG_100', 'KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700', 'KG_800',
]

/**
 * Every contribution that builds the current amount, grouped by cost group.
 *
 * This is the `Nachweise & Verlauf` modal's one genuinely valuable table,
 * rehoused on a page that can hold it. It DOES reconcile — that is what
 * distinguishes it from the selected-effects projection — and the sum is
 * computed here from the same rows the surface prints rather than asserted
 * in a caption beside them.
 */
export function contributionLedger(
  result: CommercialResult, drivers?: readonly Driver[],
): ContributionLedger {
  const source = drivers ?? result.contributions
  const rows = source.map((driver): LedgerRow => ({
    key: driver.key,
    label: driver.label,
    exact: driver.exact,
    costGroup: costGroupOfDriver(driver),
    origin: driver.origin,
    authority: driver.costAuthority ?? 'direct',
    driver,
  }))
  const groups: LedgerGroup[] = []
  for (const group of LEDGER_ORDER) {
    const members = rows.filter((row) => row.costGroup === group)
    if (members.length === 0) continue
    groups.push({
      group,
      rows: members,
      subtotal: members.reduce((sum, row) => sum.plus(row.exact), new Decimal(0)),
    })
  }
  const unattributed = rows.filter((row) => row.costGroup === null)
  if (unattributed.length > 0) {
    groups.push({
      group: null,
      rows: unattributed,
      subtotal: unattributed.reduce((sum, row) => sum.plus(row.exact), new Decimal(0)),
    })
  }
  const sum = rows.reduce((acc, row) => acc.plus(row.exact), new Decimal(0))
  const drift = result.total.exact.minus(sum)
  return {
    groups,
    sum,
    totalExact: result.total.exact,
    reconciles: drift.isZero(),
    drift,
    rowCount: rows.length,
  }
}

/* ── 5 · Regionalfaktor ────────────────────────────────────────────────── */

export type RegionalFactorPresentation = Readonly<{
  active: boolean
  value: Decimal
  /** What the factor adds, or would add. Never recomputed by a view. */
  effect: Decimal
  /** Whether `effect` is part of the printed amount. */
  included: boolean
}>

/**
 * The Regionalfaktor, stated (rule 40, D-15).
 *
 * Inactive is the default and the product must always be able to say what
 * activating it WOULD add — as a counterfactual that is explicitly NOT in the
 * amount, never as a silent absence and never as `0 €`.
 */
export function regionalFactorPresentation(
  result: CommercialResult,
): RegionalFactorPresentation {
  return {
    active: result.regionalFactor.active,
    value: result.regionalFactor.value,
    effect: result.regionalFactor.effect,
    included: result.regionalFactor.active,
  }
}

/* ── 6 · non-numeric commercial states ─────────────────────────────────── */

export type OpenStateKind =
  | 'undecidedGroup'
  | 'excludedGroup'
  | 'unpricedGroup'
  | 'noBasis'
  | 'bundle'
  | 'indirect'
  | 'bauherr'
  /** Included, priced by a rate, but the quantity entered is zero. */
  | 'zeroQuantity'
  | 'unknownAuthority'

export type OpenStateRow = Readonly<{
  key: string
  kind: OpenStateKind
  /** German label; the view translates cost groups and driver labels itself. */
  label: string
  costGroup: CostGroup | null
  bundleLabelDe: string | null
  bundleLabelEn: string | null
  destination: OptionDestination | null
}>

/**
 * Everything that deliberately carries NO amount, in one deliberate place.
 *
 * Unknown is not zero, Bauseits is not zero, and no price basis is not zero.
 * Burying these among euro rows is how all three came to be printed as
 * `± 0 €`; giving them their own section is how the product states them.
 */
export function openCommercialStates(
  result: CommercialResult,
  effects: SelectedCommercialEffects,
): readonly OpenStateRow[] {
  const rows: OpenStateRow[] = []
  for (const line of result.byCostGroup) {
    const state = stateOfLine(line)
    if (state === 'priced') continue
    rows.push({
      key: `group:${line.group}`,
      kind: state === 'excluded' ? 'excludedGroup'
        : state === 'unpriced' ? 'unpricedGroup' : 'undecidedGroup',
      label: line.group,
      costGroup: line.group,
      bundleLabelDe: null,
      bundleLabelEn: null,
      destination: { stage: 'konfigurieren', step: 'leistungsabgrenzung' },
    })
  }
  for (const effect of effects.all) {
    if (effect.exact !== null) continue
    // A zero quantity is read BEFORE the authority: the position is `direct`
    // and would otherwise be filed as an unknown authority, which is the one
    // thing it is not.
    const kind: OpenStateKind = effect.zeroQuantity ? 'zeroQuantity'
      : effect.authority === 'bundle' ? 'bundle'
        : effect.authority === 'indirect' ? 'indirect'
          : effect.authority === 'bauherr' ? 'bauherr'
            : effect.authority === 'noBasis' ? 'noBasis'
              : 'unknownAuthority'
    rows.push({
      key: `effect:${effect.key}`,
      kind,
      label: effect.label,
      costGroup: effect.costGroup,
      bundleLabelDe: effect.bundleLabelDe,
      bundleLabelEn: effect.bundleLabelEn,
      destination: effect.destination,
    })
  }
  return rows
}
