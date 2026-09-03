import Decimal from 'decimal.js'
import catalogueFixture from '../fixtures/kg-configuration.json'
import type { CostGroup, Driver } from './calculate'

/**
 * The canonical KG configuration model (VR3-03, targets T-018–T-028).
 *
 * ONE SYSTEM, SIX INSTANCES.
 *
 * Before this module KG 200/500/600 were a "scope catalog", KG 300/400 were
 * "option groups" and KG 700 was a mode switch — three engines, three
 * grammars, three places a decision could mean something slightly different.
 * The audit named the consequence: knowledge learned in one KG did not
 * transfer to another (F-008). This module is the single domain contract all
 * six read, so a KG page is a data variant, never a design.
 *
 * PURE ON PURPOSE. Nothing here touches the store, React or the DOM: the
 * scope gate, every completion state and the commercial total are arithmetic
 * provable without rendering — the same shape VR3-01's readiness and
 * VR3-02's building-scope gate already use.
 *
 * WHAT IT DOES NOT DO. It invents no production coefficient. Every amount is
 * a declared demonstration value from `src/fixtures/kg-configuration.json`,
 * proved against the approved VR3-00 fixture spec by
 * `__tests__/kgConfiguration.test.ts`. The released engine
 * (`calculate.ts`/`store.ts`'s proposal projection) remains authority for an
 * Option that has no KG configuration.
 */

/** The six DIN 276 groups this Product decides. KG 100 and KG 800 are not
 * decidable here — the same closed set `SCOPE_BOUNDARIES_DECIDABLE_GROUPS`
 * already declares in `calculate.ts`. */
export const KG_SCOPE_GROUPS = [
  'KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700',
] as const

export type KgScopeGroup = typeof KG_SCOPE_GROUPS[number]

/**
 * A scope decision has THREE states, and `undecided` is the initial one.
 *
 * The replaced model had two, which is why "not yet answered" and
 * "deliberately excluded" were the same value and an unanswered KG silently
 * read as excluded work (VR3-00 D-014). `undecided` is not a default answer:
 * it is the absence of one, and it blocks configuration rather than pricing
 * a guess.
 */
export type KgScopeDecision = 'undecided' | 'included' | 'excluded'

export type KgServiceVariant = Readonly<{
  value: string
  labelDe: string
  labelEn: string
  /** Effect RELATIVE to the baseline variant, which is therefore always 0. */
  delta: string
}>

export type KgServiceKind =
  | Readonly<{ kind: 'includeExclude' }>
  | Readonly<{
    kind: 'singleChoice'
    baselineVariant: string
    variants: readonly KgServiceVariant[]
  }>
  | Readonly<{
    kind: 'quantity'
    unitAmount: string
    baselineQuantity: string
    unitDe: string
    unitEn: string
    minQuantity: string
    maxQuantity: string
  }>
  | Readonly<{ kind: 'readOnlyRequired' }>

/**
 * A dependency names the upstream service that has to hold, so a blocked row
 * can offer the route to it rather than a rule name (rule 12).
 *
 * `appliesToVariants` exists because a dependency can be conditional on the
 * user's OWN choice: QNG-PLUS needs Effizienzhaus 40 NH, "kein QNG" needs
 * nothing. Attaching the dependency to the whole service would have blocked
 * the variant that is always legitimate.
 */
export type KgServiceDependency = Readonly<{
  serviceId: string
  requiresVariant?: string
  requiresSelected?: boolean
  appliesToVariants?: readonly string[]
}>

export type KgServiceAuthority = 'sourceEvidenced' | 'derived' | 'assumed'

export type KgService = Readonly<{
  id: string
  labelDe: string
  labelEn: string
  summaryDe: string
  summaryEn: string
  /** Base amount. For `singleChoice` this is 0 and the variant carries the effect. */
  amount: string
  baseline: 'selected' | 'notSelected'
  /** The domain demands an explicit answer; there is no safe default. */
  requiresDecision: boolean
  kind: KgServiceKind
  authority: KgServiceAuthority
  buildingId?: string
  dependsOn?: KgServiceDependency
}>

export type KgServiceGroup = Readonly<{
  id: string
  labelDe: string
  labelEn: string
  services: readonly KgService[]
}>

export type KgChapter = Readonly<{
  group: KgScopeGroup
  titleDe: string
  titleEn: string
  /** The KG page's lead: what this cost group covers, in a sentence. */
  scopeNoteDe: string
  scopeNoteEn: string
  /** The ledger row's concise boundary: the same fact, at a glance. */
  boundaryDe: string
  boundaryEn: string
  groups: readonly KgServiceGroup[]
}>

export type KgCatalogue = Readonly<{
  projectId: string
  uncertaintyPercent: string
  declaredNetTotal: string
  declaredByCostGroup: Readonly<Record<KgScopeGroup, string>>
  chapters: readonly KgChapter[]
}>

const CATALOGUES = (catalogueFixture as { catalogues: KgCatalogue[] }).catalogues

/** The catalogue of a demonstration project, or `null` when none exists.
 * `null` is the honest answer for a directly driven store: it selects the
 * released proposal engine instead of pricing a project that has no
 * catalogue. */
export function kgCatalogue(projectId: string | null | undefined): KgCatalogue | null {
  if (!projectId) return null
  return CATALOGUES.find((c) => c.projectId === projectId) ?? null
}

export function kgCatalogues(): readonly KgCatalogue[] {
  return CATALOGUES
}

/* ── decisions ─────────────────────────────────────────────────────────── */

export type KgServiceState = 'undecided' | 'selected' | 'notSelected'

export type KgServiceDecisionRecord = Readonly<{
  state: KgServiceState
  /** Chosen variant of a `singleChoice` service. */
  variant?: string
  /** Raw, locale-free quantity of a `quantity` service — kept as the user
   * typed it so an invalid entry can be shown back to them (rule 12). */
  quantity?: string
}>

export type KgDecisions = Readonly<{
  scope: Readonly<Record<KgScopeGroup, KgScopeDecision>>
  services: Readonly<Record<string, KgServiceDecisionRecord>>
}>

export function allServices(catalogue: KgCatalogue): readonly KgService[] {
  return catalogue.chapters.flatMap((c) => c.groups.flatMap((g) => g.services))
}

export function chapterOf(
  catalogue: KgCatalogue, group: KgScopeGroup,
): KgChapter | null {
  return catalogue.chapters.find((c) => c.group === group) ?? null
}

export function serviceById(
  catalogue: KgCatalogue, id: string,
): KgService | null {
  return allServices(catalogue).find((s) => s.id === id) ?? null
}

export function groupOfService(
  catalogue: KgCatalogue, id: string,
): KgScopeGroup | null {
  for (const chapter of catalogue.chapters) {
    for (const group of chapter.groups) {
      if (group.services.some((s) => s.id === id)) return chapter.group
    }
  }
  return null
}

/**
 * The state every service starts in.
 *
 * A service the domain demands an answer on starts UNDECIDED, never at a
 * convenient default: that is the whole point of the replaced model's
 * defect. Everything else starts at its fixture baseline, which is the
 * project's standard scope and not a scope conclusion — the KG it belongs to
 * still has to be included before it contributes anything.
 */
export function initialDecisions(catalogue: KgCatalogue | null): KgDecisions {
  const scope = Object.fromEntries(
    KG_SCOPE_GROUPS.map((g) => [g, 'undecided' as KgScopeDecision]),
  ) as Record<KgScopeGroup, KgScopeDecision>
  const services: Record<string, KgServiceDecisionRecord> = {}
  if (catalogue) {
    for (const service of allServices(catalogue)) {
      services[service.id] = initialServiceDecision(service)
    }
  }
  return { scope, services }
}

export function initialServiceDecision(service: KgService): KgServiceDecisionRecord {
  if (service.kind.kind === 'readOnlyRequired') return { state: 'selected' }
  if (service.requiresDecision) return { state: 'undecided' }
  const base: KgServiceDecisionRecord = {
    state: service.baseline === 'selected' ? 'selected' : 'notSelected',
  }
  if (service.kind.kind === 'singleChoice') {
    return { ...base, variant: service.kind.baselineVariant }
  }
  if (service.kind.kind === 'quantity') {
    return { ...base, quantity: service.kind.baselineQuantity }
  }
  return base
}

export function serviceDecision(
  decisions: KgDecisions, service: KgService,
): KgServiceDecisionRecord {
  return decisions.services[service.id] ?? initialServiceDecision(service)
}

/* ── validation ────────────────────────────────────────────────────────── */

export type KgQuantityProblem = 'notANumber' | 'belowMinimum' | 'aboveMaximum'

/**
 * An invalid quantity is a problem WITH A NAME, returned rather than thrown.
 *
 * The prior valid result has to survive it (ticket: "Invalid quantity/value
 * preserves prior valid result and identifies impact"), so the amount
 * function falls back to the baseline quantity and the row shows the problem
 * — the total never becomes a guess and never becomes zero.
 */
export function quantityProblem(
  service: KgService, raw: string | undefined,
): KgQuantityProblem | null {
  if (service.kind.kind !== 'quantity') return null
  const text = (raw ?? '').trim()
  if (text === '') return 'notANumber'
  let value: Decimal
  try {
    value = new Decimal(text)
  } catch {
    return 'notANumber'
  }
  if (!value.isFinite()) return 'notANumber'
  if (value.lt(new Decimal(service.kind.minQuantity))) return 'belowMinimum'
  if (value.gt(new Decimal(service.kind.maxQuantity))) return 'aboveMaximum'
  return null
}

/**
 * Is this service's dependency satisfied for the decision it currently holds?
 *
 * Unmet returns the upstream service id so the row can link to it; met
 * returns `null`. A dependency scoped to particular variants is inert for
 * every other variant.
 */
export function dependencyBlocker(
  catalogue: KgCatalogue, decisions: KgDecisions, service: KgService,
): string | null {
  const dep = service.dependsOn
  if (!dep) return null
  const own = serviceDecision(decisions, service)
  if (dep.appliesToVariants && !dep.appliesToVariants.includes(own.variant ?? '')) {
    return null
  }
  if (own.state === 'notSelected' || own.state === 'undecided') return null
  const upstream = serviceById(catalogue, dep.serviceId)
  if (!upstream) return dep.serviceId
  const upstreamGroup = groupOfService(catalogue, dep.serviceId)
  if (upstreamGroup && decisions.scope[upstreamGroup] !== 'included') return dep.serviceId
  const state = serviceDecision(decisions, upstream)
  if (dep.requiresSelected && state.state !== 'selected') return dep.serviceId
  if (dep.requiresVariant && state.variant !== dep.requiresVariant) return dep.serviceId
  return null
}

/* ── amounts ───────────────────────────────────────────────────────────── */

/**
 * What one service contributes, or `null` when it contributes nothing.
 *
 * `null` and `0` are different answers and the caller must be able to tell
 * them apart: a service nobody selected has no contribution at all, while a
 * genuinely free position would be a priced zero. Nothing here ever returns
 * a value for an unanswered required decision — unknown is not zero, and it
 * is certainly not an amount.
 */
export function serviceContribution(
  catalogue: KgCatalogue, decisions: KgDecisions, service: KgService,
): Decimal | null {
  const decision = serviceDecision(decisions, service)
  if (decision.state !== 'selected') return null
  if (dependencyBlocker(catalogue, decisions, service)) return null
  const base = new Decimal(service.amount)
  switch (service.kind.kind) {
    case 'singleChoice': {
      // A decision that names no variant falls back to the BASELINE variant,
      // not to "no effect": the baseline is the project's standard, and its
      // own delta is 0 by construction, so the two happen to agree today —
      // but reading it explicitly keeps that a fixture fact rather than an
      // assumption this function makes on the fixture's behalf.
      const wanted = decision.variant ?? service.kind.baselineVariant
      const chosen = service.kind.variants.find((v) => v.value === wanted)
      return chosen ? base.plus(new Decimal(chosen.delta)) : base
    }
    case 'quantity': {
      const problem = quantityProblem(service, decision.quantity)
      // An invalid entry keeps the last VALID basis — the baseline quantity —
      // so the total stays a real number while the row states the problem.
      const raw = problem ? service.kind.baselineQuantity : decision.quantity!
      return new Decimal(service.kind.unitAmount).mul(new Decimal(raw))
    }
    default:
      return base
  }
}

export type KgContribution = Readonly<{
  serviceId: string
  group: KgScopeGroup
  groupId: string
  labelDe: string
  labelEn: string
  exact: Decimal
  buildingId?: string
  authority: KgServiceAuthority
}>

/** Every contribution of every INCLUDED cost group, in DIN 276 order. */
export function kgContributions(
  catalogue: KgCatalogue, decisions: KgDecisions,
): readonly KgContribution[] {
  const out: KgContribution[] = []
  for (const chapter of catalogue.chapters) {
    if (decisions.scope[chapter.group] !== 'included') continue
    for (const group of chapter.groups) {
      for (const service of group.services) {
        const exact = serviceContribution(catalogue, decisions, service)
        if (exact === null) continue
        out.push({
          serviceId: service.id,
          group: chapter.group,
          groupId: group.id,
          labelDe: service.labelDe,
          labelEn: service.labelEn,
          exact,
          authority: service.authority,
          ...(service.buildingId ? { buildingId: service.buildingId } : {}),
        })
      }
    }
  }
  return out
}

/**
 * Per cost group: the amount, or `null` when the group carries no priced
 * position. `null` is never rendered as 0 (rule 16).
 */
export function kgGroupAmounts(
  catalogue: KgCatalogue, decisions: KgDecisions,
): Readonly<Record<KgScopeGroup, Decimal | null>> {
  const contributions = kgContributions(catalogue, decisions)
  const out = {} as Record<KgScopeGroup, Decimal | null>
  for (const group of KG_SCOPE_GROUPS) {
    const rows = contributions.filter((c) => c.group === group)
    out[group] = rows.length === 0
      ? null
      : rows.reduce((sum, c) => sum.plus(c.exact), new Decimal(0))
  }
  return out
}

export function kgTotal(
  catalogue: KgCatalogue, decisions: KgDecisions,
): Decimal {
  return kgContributions(catalogue, decisions)
    .reduce((sum, c) => sum.plus(c.exact), new Decimal(0))
}

/**
 * The `Driver` shape the released rail, Kostentreiber, comparison, export and
 * client projection already consume.
 *
 * Producing drivers rather than a private total is what makes ONE result feed
 * every surface: no consumer needs to know which engine priced the Option.
 * KG 300 and KG 400 declare `block: 'bauwerk'` because they ARE the Bauwerk
 * block (`calculate.ts`), and everything else is its own position.
 */
export function kgDrivers(
  catalogue: KgCatalogue, decisions: KgDecisions,
): Driver[] {
  return kgContributions(catalogue, decisions).map((c) => ({
    key: `kg_${c.serviceId}`,
    exact: c.exact,
    label: c.labelDe,
    scopeRefs: [`KG ${c.group.slice(3)}`],
    basis: null,
    origin: 'decision' as const,
    block: c.group === 'KG_300' || c.group === 'KG_400'
      ? ('bauwerk' as const)
      : ('separatePosition' as const),
  }))
}

/* ── completion ────────────────────────────────────────────────────────── */

export function decidedScopeCount(decisions: KgDecisions): number {
  return KG_SCOPE_GROUPS.filter((g) => decisions.scope[g] !== 'undecided').length
}

export function scopeDecisionsComplete(decisions: KgDecisions): boolean {
  return decidedScopeCount(decisions) === KG_SCOPE_GROUPS.length
}

export type KgChapterState =
  | 'outOfScope' | 'undecidedScope' | 'incomplete' | 'invalid' | 'complete'

export type KgChapterProgress = Readonly<{
  group: KgScopeGroup
  state: KgChapterState
  /** Explicit decisions the domain requires in this chapter. */
  requiredDecisions: number
  decidedDecisions: number
  /** Services whose entry or dependency is broken — completion is refused. */
  invalidServiceIds: readonly string[]
  blockedServiceIds: readonly string[]
  selectedServiceCount: number
}>

/**
 * Completion is DERIVED, never recorded.
 *
 * "Visited" was the previous predicate (`configuratorStepDone` read a list of
 * chapters the user had opened), so walking past a chapter marked it done and
 * a required decision could stay unanswered behind a tick. A chapter is
 * complete when every decision its own domain demands is answered, every
 * value validates and no dependency is broken — and it stops being complete
 * the moment one of those stops holding, with no invalidation step to forget.
 */
export function kgChapterProgress(
  catalogue: KgCatalogue, decisions: KgDecisions, group: KgScopeGroup,
): KgChapterProgress {
  const scope = decisions.scope[group]
  const chapter = chapterOf(catalogue, group)
  const services = chapter
    ? chapter.groups.flatMap((g) => g.services)
    : []
  const required = services.filter((s) => s.requiresDecision)
  const decided = required.filter((s) =>
    serviceDecision(decisions, s).state !== 'undecided')
  const invalid = services.filter((s) => {
    const decision = serviceDecision(decisions, s)
    return decision.state === 'selected'
      && quantityProblem(s, decision.quantity) !== null
  })
  const blocked = services.filter((s) =>
    dependencyBlocker(catalogue, decisions, s) !== null)
  const selected = services.filter((s) =>
    serviceDecision(decisions, s).state === 'selected')
  const state: KgChapterState = scope === 'excluded'
    ? 'outOfScope'
    : scope === 'undecided'
      ? 'undecidedScope'
      : invalid.length > 0 || blocked.length > 0
        ? 'invalid'
        : decided.length < required.length
          ? 'incomplete'
          : 'complete'
  return {
    group,
    state,
    requiredDecisions: required.length,
    decidedDecisions: decided.length,
    invalidServiceIds: invalid.map((s) => s.id),
    blockedServiceIds: blocked.map((s) => s.id),
    selectedServiceCount: selected.length,
  }
}

export function kgConfigurationComplete(
  catalogue: KgCatalogue, decisions: KgDecisions,
): boolean {
  if (!scopeDecisionsComplete(decisions)) return false
  return KG_SCOPE_GROUPS.every((group) => {
    const progress = kgChapterProgress(catalogue, decisions, group)
    return progress.state === 'outOfScope' || progress.state === 'complete'
  })
}

/** The first cost group that still needs the user, in DIN 276 order. */
export function firstOutstandingKgGroup(
  catalogue: KgCatalogue, decisions: KgDecisions,
): KgScopeGroup | null {
  return KG_SCOPE_GROUPS.find((group) => {
    const state = kgChapterProgress(catalogue, decisions, group).state
    return state === 'incomplete' || state === 'invalid'
  }) ?? null
}

export function firstIncludedKgGroup(
  decisions: KgDecisions,
): KgScopeGroup | null {
  return KG_SCOPE_GROUPS.find((g) => decisions.scope[g] === 'included') ?? null
}

/** Every open explicit decision across the whole configuration. */
export function openKgDecisionCount(
  catalogue: KgCatalogue, decisions: KgDecisions,
): number {
  return KG_SCOPE_GROUPS.reduce((sum, group) => {
    const progress = kgChapterProgress(catalogue, decisions, group)
    if (progress.state === 'outOfScope' || progress.state === 'undecidedScope') return sum
    return sum + (progress.requiredDecisions - progress.decidedDecisions)
  }, 0)
}

export function invalidKgServiceIds(
  catalogue: KgCatalogue, decisions: KgDecisions,
): readonly string[] {
  return KG_SCOPE_GROUPS.flatMap((group) => {
    const progress = kgChapterProgress(catalogue, decisions, group)
    return [...progress.invalidServiceIds, ...progress.blockedServiceIds]
  })
}

/**
 * The reconciliation the audit's P0 finding demands (F-001).
 *
 * A rail that ASSERTS its drivers sum to its total in a caption while nothing
 * computes it is how a diagnostic came to contradict the number beside it.
 * This returns the drift so a test, the live diagnostic and the rail read the
 * same arithmetic instead of three opinions.
 */
export function reconcileKgResult(
  catalogue: KgCatalogue, decisions: KgDecisions,
): Readonly<{ reconciles: boolean; drift: Decimal; total: Decimal }> {
  const total = kgTotal(catalogue, decisions)
  const groups = kgGroupAmounts(catalogue, decisions)
  const grouped = KG_SCOPE_GROUPS.reduce(
    (sum, g) => sum.plus(groups[g] ?? new Decimal(0)), new Decimal(0),
  )
  const drift = total.minus(grouped)
  return { reconciles: drift.isZero(), drift, total }
}

/** Cost groups that are included but carry no priced position at all. */
export function unpricedIncludedKgGroups(
  catalogue: KgCatalogue, decisions: KgDecisions,
): readonly CostGroup[] {
  const amounts = kgGroupAmounts(catalogue, decisions)
  return KG_SCOPE_GROUPS.filter((g) =>
    decisions.scope[g] === 'included' && amounts[g] === null)
}
