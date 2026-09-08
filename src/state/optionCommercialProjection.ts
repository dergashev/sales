import Decimal from 'decimal.js'
import { DENOMINATOR_LABEL, rate, type Displayed, type Rate } from '../engine/money'
import {
  allServices,
  serviceDecision,
  type KgCatalogue,
  type KgDecisions,
  type KgScopeAxis,
  type KgService,
} from '../engine/kgConfiguration'
import type { CommercialCoverage, CommercialResult } from './commercialResult'
import {
  scopeMetricValue,
  scopeSelectedIds,
  type BuildingScopeState,
  type ScopeBuilding,
  type ScopeMetricKey,
} from './optionBuildingScope'

/**
 * THE ONE OPTION COMMERCIAL PROJECTION — what an Option is worth, and per
 * WHICH area (B2, Product Owner requirement 9; target `Option and commercial
 * summary`).
 *
 * The audit measured the defect precisely: a saved Option summary showed a
 * subtotal, a total and a building count, and never `€/m² WFL nach WoFlV`,
 * `€/m² NUF nach DIN 277` or the Energy Efficiency standard — while the
 * Offer panel published a single BGF-above-ground ratio for every Option
 * shape. Five surfaces asked the same commercial question and four of them
 * could not answer it, so every new surface was another chance for two
 * renderings of one truth to disagree.
 *
 * This module is the answer, and it is deliberately a PROJECTION and not a
 * calculator:
 *
 * - the numerator is `CommercialResult.total`, produced by the released
 *   canonical derivation and never recomputed here;
 * - the denominators are the baseline's own areas, read through
 *   `scopeMetricValue` so an authorised override is included by construction;
 * - the only arithmetic is `rate()`, the released typed-denominator
 *   constructor, plus the integer summation of areas the segments require.
 *
 * There is no new coefficient, no new formula and no pricing authority here.
 *
 * ── WHY A SEGMENT NEVER SHARES A DENOMINATOR ──────────────────────────────
 *
 * `Σ WFL + Σ NUF` is forbidden in every client surface (rule 39, audit R-11,
 * DATA-001): WoFlV living area and DIN 277 usable area are different
 * measurements of different things, and a figure that adds them is a number
 * with no normative meaning under either label. So a mixed-use Option does
 * not get ONE blended metric — it gets TWO, each naming the norm it is
 * measured under. An unlabeled `€/m²` cannot be produced by this module at
 * all: `Rate` carries a typed denominator and `rateLabel`/`rateUnit` derive
 * the words from the type, so there is nothing here for a bare ratio to come
 * from.
 *
 * ── WHAT THE NUMERATOR IS, STATED PLAINLY ─────────────────────────────────
 *
 * Every metric divides the Option's WHOLE net total by ONE segment area.
 * That is the released semantics, unchanged: `computeProjection`'s own
 * `leadRate` already divides the whole total by WFL for a single residential
 * building and by NUF for a single non-residential one. Extending the same
 * released semantics to the second segment of a mixed-use Option adds no
 * formula — and the alternative WOULD have: allocating the total between a
 * residential and a commercial segment requires an attribution rule that
 * does not exist in this Product, and inventing one is outside this ticket's
 * authority.
 *
 * The consequence is real and must be SAID rather than left for the reader
 * to assume: two segment metrics of one Option are each a scale reference
 * for their own area, and they are NOT additive. `metricsAreAdditive` is
 * always `false` for a mixed profile, and the surfaces render the
 * non-additivity statement from it instead of each deciding for itself
 * whether to mention it.
 */

/* ── 1 · the use axis ──────────────────────────────────────────────────── */

/**
 * Which normative area a building's use is measured in.
 *
 * `mixed` is not a third measurement — it is a building that carries BOTH,
 * and it contributes to both segment sums from two different metrics
 * (`wfl` and `commercialNuf`).
 */
export type BuildingUseClass = 'residential' | 'nonResidential' | 'mixed'

/**
 * The use classification, DECLARED rather than pattern-matched.
 *
 * The same shape and the same reason as `ENERGY_STANDARD_OF_VARIANT`: a
 * bridge derived from a string pattern (`usageKey.endsWith('.office')`) is a
 * bridge that breaks silently when a fixture key is renamed, and it would
 * break by silently reclassifying a building's normative area — the exact
 * class of defect DATA-001 exists to prevent. An unlisted key is `null`,
 * which is an honest "this Product does not know which norm applies", never
 * a guess.
 */
const USE_CLASS_OF_KEY: Readonly<Record<string, BuildingUseClass>> = {
  'vr3.building.usage.residential': 'residential',
  'vr3.building.usage.residentialMfh': 'residential',
  'vr3.building.usage.office': 'nonResidential',
  'vr3.building.usage.mixed': 'mixed',
}

export function buildingUseClass(usageKey: string): BuildingUseClass | null {
  return USE_CLASS_OF_KEY[usageKey] ?? null
}

/** Every use key this Product can classify — the editor's closed domain. */
export const USE_KEYS: readonly string[] = Object.keys(USE_CLASS_OF_KEY)

/**
 * The Option's own use profile, from the buildings actually in its scope.
 *
 * `unknown` is reachable and rendered: an Option whose buildings carry a use
 * this Product cannot classify has no segment metric, and saying so is the
 * only honest surface (a BGF scale reference is still available, because BGF
 * is norm-independent).
 */
export type OptionUseProfile = 'residential' | 'nonResidential' | 'mixed' | 'unknown'

export function optionUseProfile(buildings: readonly ScopeBuilding[]): OptionUseProfile {
  let residential = false
  let nonResidential = false
  for (const building of buildings) {
    const useClass = buildingUseClass(building.usageKey)
    if (useClass === 'residential') residential = true
    if (useClass === 'nonResidential') nonResidential = true
    if (useClass === 'mixed') { residential = true; nonResidential = true }
  }
  if (residential && nonResidential) return 'mixed'
  if (residential) return 'residential'
  return nonResidential ? 'nonResidential' : 'unknown'
}

/* ── 2 · the segment areas ─────────────────────────────────────────────── */

/**
 * Which metric of a building belongs to which segment.
 *
 * A residential building's residential area is its `wfl`; a non-residential
 * building's is its `nuf`; a MIXED building contributes `wfl` to the
 * residential segment and `commercialNuf` — not `nuf` — to the
 * non-residential one, because that is the metric the baseline reserves for
 * the commercial part of a mixed building.
 */
function segmentMetric(
  useClass: BuildingUseClass | null,
  segment: 'residential' | 'nonResidential',
): ScopeMetricKey | null {
  if (useClass === null) return null
  if (segment === 'residential') {
    return useClass === 'residential' || useClass === 'mixed' ? 'wfl' : null
  }
  if (useClass === 'nonResidential') return 'nuf'
  return useClass === 'mixed' ? 'commercialNuf' : null
}

/**
 * The sum of one segment across the scope, or `null`.
 *
 * ALL-OR-NOTHING, exactly like `kgScopeAreas`' own `sumOf`: if a building
 * that contributes to this segment has no value for it, the sum is unknown.
 * A partial sum published under a full normative label is precisely the
 * "denominator does not match its caption" defect (DATA-001) — and rule 16
 * forbids answering an unknown quantity with a number at all.
 */
function segmentArea(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  buildings: readonly ScopeBuilding[],
  segment: 'residential' | 'nonResidential',
): Decimal | null {
  let sum = new Decimal(0)
  let contributors = 0
  for (const building of buildings) {
    const key = segmentMetric(buildingUseClass(building.usageKey), segment)
    if (!key) continue
    contributors += 1
    const raw = scopeMetricValue(state, building, key)
    const value = decimalOf(raw)
    if (value === null) return null
    sum = sum.plus(value)
  }
  return contributors > 0 ? sum : null
}

/** BGF above ground — norm-independent, so it never depends on the use axis. */
function bgfAboveGround(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  buildings: readonly ScopeBuilding[],
): Decimal | null {
  let sum = new Decimal(0)
  for (const building of buildings) {
    const value = decimalOf(scopeMetricValue(state, building, 'bgfRSAbove'))
    if (value === null) return null
    sum = sum.plus(value)
  }
  return buildings.length > 0 ? sum : null
}

function decimalOf(raw: string | null): Decimal | null {
  if (raw === null || raw.trim() === '') return null
  try {
    const value = new Decimal(raw)
    return value.isFinite() ? value : null
  } catch {
    return null
  }
}

/* ── 3 · the metrics ──────────────────────────────────────────────────── */

/**
 * One metric of the summary.
 *
 * `role` is what the reader is being told, and it is why a BGF figure never
 * competes with a segment metric: a `segment` metric is the Option's
 * Leitkennzahl for a normative area, a `scale` metric is the whole
 * project's construction scale. Rule 39's complex lead metric
 * (`€/m² BGF oberirdisch`) is exactly the second kind.
 */
export type OptionAreaMetricRole = 'segment' | 'scale'

export type OptionAreaMetricId = 'wfl' | 'nuf' | 'bgfAbove'

export type OptionAreaMetric = Readonly<{
  id: OptionAreaMetricId
  role: OptionAreaMetricRole
  /** The typed-denominator rate. Its label always names the norm. */
  rate: Rate
  /** i18n key naming the segment this metric measures, or `null` for scale. */
  segmentLabelKey: string | null
}>

/**
 * A segment that APPLIES but has no denominator, so it has no rate.
 *
 * This state exists because the alternative is worse in exactly the way
 * rule 16 names: a mixed-use Option whose commercial NUF is unknown must say
 * that its non-residential metric is not determined, not quietly publish one
 * metric and let the reader conclude the Option is residential-only.
 */
export type OptionAreaMetricGap = Readonly<{
  id: OptionAreaMetricId
  segmentLabelKey: string
  denominatorLabel: string
}>

const SEGMENT_LABEL_KEY: Readonly<Record<'wfl' | 'nuf', string>> = {
  wfl: 'b2.metric.segment.residential',
  nuf: 'b2.metric.segment.nonResidential',
}

/* ── 4 · the energy / certification axes ──────────────────────────────── */

/**
 * The selected value of one Option-level scope-decision axis.
 *
 * Found through the service's DECLARED `scopeAxis`, never through its id:
 * two catalogues carry two ids for the same axis (`a-400-es`, `b-400-es`)
 * and a third project would carry a third. The axis is data.
 */
export type OptionAxisValue = Readonly<{
  axis: KgScopeAxis
  serviceId: string
  labelDe: string
  labelEn: string
  /** The chosen variant's own words, or the baseline's when untouched. */
  variantLabelDe: string
  variantLabelEn: string
  variantId: string
  /** True while the axis still stands at its catalogue baseline. */
  isBaseline: boolean
}>

export function axisServices(
  catalogue: KgCatalogue, axis: KgScopeAxis,
): readonly KgService[] {
  return allServices(catalogue).filter((service) => service.scopeAxis === axis)
}

export function optionAxisValue(
  catalogue: KgCatalogue | null,
  decisions: KgDecisions | null,
  axis: KgScopeAxis,
): OptionAxisValue | null {
  if (!catalogue || !decisions) return null
  const service = axisServices(catalogue, axis)[0]
  if (!service || service.kind.kind !== 'singleChoice') return null
  const decision = serviceDecision(decisions, service)
  const variantId = decision.variant ?? service.kind.baselineVariant
  const variant = service.kind.variants.find((v) => v.value === variantId)
  if (!variant) return null
  return {
    axis,
    serviceId: service.id,
    labelDe: service.labelDe,
    labelEn: service.labelEn,
    variantLabelDe: variant.labelDe,
    variantLabelEn: variant.labelEn,
    variantId,
    isBaseline: variantId === service.kind.baselineVariant,
  }
}

/* ── 5 · the projection ───────────────────────────────────────────────── */

export type OptionCommercialProjection = Readonly<{
  /** The result's own version, so two surfaces can PROVE they agree. */
  resultVersion: number
  netTotal: Displayed
  /** Derived from coverage, never assigned (R-18). */
  totalLabel: string
  coverage: CommercialCoverage
  useProfile: OptionUseProfile
  /** Only applicable, explicitly denominated metrics. Never a bare `€/m²`. */
  metrics: readonly OptionAreaMetric[]
  /** Segments that apply but whose denominator is unknown (rule 16). */
  gaps: readonly OptionAreaMetricGap[]
  /**
   * Whether the metrics may be read as parts of one whole. Always `false`
   * once there is more than one `segment` metric — see the module docblock.
   */
  metricsAreAdditive: boolean
  energy: OptionAxisValue | null
  qng: OptionAxisValue | null
  dgnb: OptionAxisValue | null
  buildingsInScope: number
}>

export type OptionProjectionInput =
  Pick<BuildingScopeState, 'scopeEdits' | 'scopeBuildings' | 'scopeSelected'>

/**
 * THE projection every commercial summary reads.
 *
 * Takes the already-derived `CommercialResult` rather than a store, for the
 * same reason `deriveClientSnapshot` takes a configuration: a caller can
 * project ANY Option — active, saved or presented — through one function,
 * and no surface has to know how to reach a result.
 */
export function optionCommercialProjection(
  scope: OptionProjectionInput,
  result: CommercialResult,
  catalogue: KgCatalogue | null,
  decisions: KgDecisions | null,
): OptionCommercialProjection {
  const selected = new Set(scopeSelectedIds(scope))
  // The scope the money describes. Falling back to every building matches
  // `kgScopeBuildings`' own released rule: a projection of an Option that
  // has selected nothing yet still describes the buildings it inherited.
  const buildings = selected.size > 0
    ? scope.scopeBuildings.filter((b) => selected.has(b.id))
    : scope.scopeBuildings
  const profile = optionUseProfile(buildings)
  const total = result.total.exact

  const metrics: OptionAreaMetric[] = []
  const gaps: OptionAreaMetricGap[] = []

  const wantsResidential = profile === 'residential' || profile === 'mixed'
  const wantsNonResidential = profile === 'nonResidential' || profile === 'mixed'

  if (wantsResidential) {
    const area = segmentArea(scope, buildings, 'residential')
    if (area !== null && area.gt(0)) {
      metrics.push({
        id: 'wfl',
        role: 'segment',
        rate: rate(total, area, 'WFL_WOFLV'),
        segmentLabelKey: SEGMENT_LABEL_KEY.wfl,
      })
    } else {
      gaps.push({
        id: 'wfl',
        segmentLabelKey: SEGMENT_LABEL_KEY.wfl,
        denominatorLabel: DENOMINATOR_LABEL.WFL_WOFLV,
      })
    }
  }
  if (wantsNonResidential) {
    const area = segmentArea(scope, buildings, 'nonResidential')
    if (area !== null && area.gt(0)) {
      metrics.push({
        id: 'nuf',
        role: 'segment',
        rate: rate(total, area, 'NUF_DIN277'),
        segmentLabelKey: SEGMENT_LABEL_KEY.nuf,
      })
    } else {
      gaps.push({
        id: 'nuf',
        segmentLabelKey: SEGMENT_LABEL_KEY.nuf,
        denominatorLabel: DENOMINATOR_LABEL.NUF_DIN277,
      })
    }
  }

  // The whole-project construction scale, always norm-independent and always
  // last: it orients, it is not the Option's Leitkennzahl (rule 39).
  const bgf = bgfAboveGround(scope, buildings)
  if (bgf !== null && bgf.gt(0)) {
    metrics.push({
      id: 'bgfAbove',
      role: 'scale',
      rate: rate(total, bgf, 'BGF_ABOVE_GROUND'),
      segmentLabelKey: null,
    })
  }

  return {
    resultVersion: result.version,
    netTotal: result.total,
    totalLabel: result.totalLabel,
    coverage: result.coverage,
    useProfile: profile,
    metrics,
    gaps,
    metricsAreAdditive: false,
    energy: optionAxisValue(catalogue, decisions, 'energy'),
    qng: optionAxisValue(catalogue, decisions, 'qng'),
    dgnb: optionAxisValue(catalogue, decisions, 'dgnb'),
    buildingsInScope: buildings.length,
  }
}

/** The segment metrics alone — what a summary leads with. */
export function segmentMetrics(
  projection: OptionCommercialProjection,
): readonly OptionAreaMetric[] {
  return projection.metrics.filter((metric) => metric.role === 'segment')
}

/** The construction-scale metric, or `null`. */
export function scaleMetric(
  projection: OptionCommercialProjection,
): OptionAreaMetric | null {
  return projection.metrics.find((metric) => metric.role === 'scale') ?? null
}
