import { Decimal } from 'decimal.js'
import displayFixture from '../fixtures/portfolio-display-projects.json'
import {
  CLIENT_PROJECTION_VERSION,
  type OptionSaveState,
  type SavedOptionVersion,
} from './optionSave'
import {
  DEMO_PROJECTS,
  type FixtureBuilding,
  type FixtureProject,
  type FixtureProjectPortfolio,
} from './projectAnalysis'

/**
 * The PORTFOLIO contract — what the Projects register knows about a project
 * before anyone opens it.
 *
 * This module is pure and it is deliberately NOT `projectAnalysis.ts`.
 * `projectAnalysis` owns the two projects that have a JOURNEY: documents, an
 * analysis, buildings, conflicts, a baseline, an Option. The register also
 * has to show projects that have none of that — three demonstration records
 * whose only purpose is to make the portfolio searchable, filterable and
 * sortable against something that looks like a real desk.
 *
 * The separation is the safety mechanism, not a filing convenience.
 * `DEMO_PROJECTS` never grows: `demoProject(id)` cannot resolve a
 * display-only record, `initialProjectAnalyses()` never seeds one, and
 * `openOpportunity(id)` therefore has nothing to open. **Non-navigability is
 * structural.** A `displayOnly` flag on a card is a rendering decision that
 * one future refactor can forget; an id the workflow layer has never heard
 * of cannot be opened by any pointer, key, or programmatic call.
 *
 * Three boundaries this module keeps:
 *
 * 1. **It never prices anything.** A project's value comes from the latest
 *    saved, presentation-eligible Option snapshot (`portfolioValue`), or it
 *    says the price has not been determined. Building metrics are areas and
 *    counts; adding them up has never produced money and must not start to.
 * 2. **A partial total is a false total.** An aggregate is `exact` only when
 *    every applicable building carries the value. Otherwise the register
 *    says so in words. Unknown is not zero, and it is not "the part we
 *    happen to have" either.
 * 3. **Synthetic numbers stay synthetic.** Every display-only figure carries
 *    `syntheticPortfolioFixture` provenance and reaches nothing but this
 *    register's own rendering.
 */

/* ───────────────────────────── lifecycle ────────────────────────────── */

/**
 * The canonical portfolio lifecycle. Seven values, closed set.
 *
 * This is NOT the clean/complex route and NOT documentation-analysis
 * readiness. Those are internal workflow facts about what the product can
 * still do with a project; this is what the organisation says the project's
 * commercial state IS. Collapsing the two would make "review required" mean
 * "the analysis found conflicts", and a project can perfectly well need a
 * commercial review with a spotless analysis.
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

/* ───────────────────────────── aggregates ───────────────────────────── */

export type PortfolioAreaMetric = 'wfl' | 'nuf'

/**
 * An aggregate over the project's buildings.
 *
 * `incomplete` exists because the alternative is a lie: summing the two
 * buildings that carry a value and printing the result under the label
 * "Total NUF" states a project total the sources do not support. The card
 * renders `incomplete` as words, never as a number.
 */
export type PortfolioAggregate =
  | { kind: 'exact'; value: string }
  | { kind: 'incomplete'; knownCount: number; applicableCount: number }
  | { kind: 'unknown' }

/** A building whose usage carries dwellings at all. */
const OFFICE_USAGE_KEY = 'vr3.building.usage.office'

function bearsDwellings(building: FixtureBuilding): boolean {
  return building.usageKey !== OFFICE_USAGE_KEY
}

function sumDecimals(values: ReadonlyArray<string>): string {
  return values
    .reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0))
    .toFixed(2)
}

function aggregateStrings(
  applicable: ReadonlyArray<string | null>,
): PortfolioAggregate {
  if (applicable.length === 0) return { kind: 'unknown' }
  const known = applicable.filter((v): v is string => v !== null)
  if (known.length === 0) return { kind: 'unknown' }
  if (known.length < applicable.length) {
    return { kind: 'incomplete', knownCount: known.length, applicableCount: applicable.length }
  }
  return { kind: 'exact', value: sumDecimals(known) }
}

function aggregateCounts(
  applicable: ReadonlyArray<number | null>,
): PortfolioAggregate {
  if (applicable.length === 0) return { kind: 'unknown' }
  const known = applicable.filter((v): v is number => v !== null)
  if (known.length === 0) return { kind: 'unknown' }
  if (known.length < applicable.length) {
    return { kind: 'incomplete', knownCount: known.length, applicableCount: applicable.length }
  }
  return { kind: 'exact', value: String(known.reduce((a, b) => a + b, 0)) }
}

export type PortfolioMetrics = {
  provenance: 'derivedFromBuildings' | 'syntheticPortfolioFixture'
  buildingCount: number
  /** Σ bgfRSTotal — exact Decimal aggregation, never a float. */
  bgfRSTotal: PortfolioAggregate
  /**
   * Which area the register reports. Declared by the project, not guessed
   * from the buildings: `nuf` as soon as the project sells commercial
   * space, `wfl` for a residential-only project. The label always names the
   * norm the number belongs to (rule 39), and the two are never added
   * together (R-11).
   */
  areaMetric: PortfolioAreaMetric
  area: PortfolioAggregate
  residentialUnits: PortfolioAggregate
}

function metricsFromBuildings(
  buildings: ReadonlyArray<FixtureBuilding>,
  areaMetric: PortfolioAreaMetric,
): PortfolioMetrics {
  const areaApplicable = areaMetric === 'wfl'
    ? buildings.filter(bearsDwellings).map((b) => b.metrics.wfl)
    : buildings.map((b) => b.metrics.nuf)
  return {
    provenance: 'derivedFromBuildings',
    buildingCount: buildings.length,
    bgfRSTotal: aggregateStrings(buildings.map((b) => b.metrics.bgfRSTotal)),
    areaMetric,
    area: aggregateStrings(areaApplicable),
    // A building with no dwellings has no dwelling count to be missing —
    // `null` there is "not applicable", not "unknown", and treating the two
    // alike would report every mixed-use project as incomplete for ever.
    residentialUnits: aggregateCounts(
      buildings.filter(bearsDwellings).map((b) => b.metrics.units),
    ),
  }
}

/* ─────────────────────────── the register ───────────────────────────── */

export type PortfolioProject = {
  id: string
  /** The project's own short name (breadcrumbs, journey, search). */
  name: string
  client: string
  /** ISO-style display code — `DE`, `AT`. */
  countryCode: string
  postcode: string
  city: string
  addressLine: string
  /** Responsible manager, full first name and surname. */
  manager: string
  lifecycleStatus: LifecycleStatus
  createdAt: string
  updatedAt: string
  /** ISO timestamp WITH offset, or `null` when nothing is booked. */
  nextClientMeetingAt: string | null
  heroAssetId: string
  /**
   * A record that exists only so the register has a realistic shape. It has
   * no journey and `projectAnalysis.ts` has never heard of its id.
   */
  displayOnly: boolean
  metrics: PortfolioMetrics
  /** Present only for a project that actually has a type on file. */
  projectTypeKey: string | null
  /** Synthetic value, display-only records only. Never a saved Option. */
  syntheticValue: { amount: string; currency: string; asOf: string } | null
}

type DisplayOnlyRecord = {
  id: string
  name: string
  client: string
  countryCode: string
  postcode: string
  city: string
  addressLine: string
  manager: string
  lifecycleStatus: string
  createdAt: string
  updatedAt: string
  nextClientMeetingAt: string | null
  heroAssetId: string
  metrics: {
    provenance: 'syntheticPortfolioFixture'
    buildingCount: number
    bgfRSTotal: string
    areaMetric: PortfolioAreaMetric
    areaValue: string
    residentialUnits: number
  }
  value: { provenance: 'syntheticPortfolioFixture'; amount: string; currency: string; asOf: string }
}

const DISPLAY_FIXTURE = displayFixture as unknown as {
  displayOnlyProjectCount: number
  projects: DisplayOnlyRecord[]
}

function assertStatus(value: string, id: string): LifecycleStatus {
  if (!isLifecycleStatus(value)) {
    throw new Error(`portfolio: «${id}» declares unknown lifecycle status «${value}»`)
  }
  return value
}

function navigableEntry(project: FixtureProject): PortfolioProject {
  const block: FixtureProjectPortfolio = project.portfolio
  return {
    id: project.id,
    name: project.name,
    client: project.client,
    countryCode: block.countryCode,
    postcode: block.postcode,
    city: project.city,
    addressLine: block.addressLine,
    manager: project.owner,
    lifecycleStatus: assertStatus(block.lifecycleStatus, project.id),
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    nextClientMeetingAt: block.nextClientMeetingAt,
    heroAssetId: project.heroAssetId,
    displayOnly: false,
    metrics: metricsFromBuildings(project.buildings, block.areaMetric),
    projectTypeKey: project.projectTypeKey,
    syntheticValue: null,
  }
}

function displayOnlyEntry(record: DisplayOnlyRecord): PortfolioProject {
  return {
    id: record.id,
    name: record.name,
    client: record.client,
    countryCode: record.countryCode,
    postcode: record.postcode,
    city: record.city,
    addressLine: record.addressLine,
    manager: record.manager,
    lifecycleStatus: assertStatus(record.lifecycleStatus, record.id),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nextClientMeetingAt: record.nextClientMeetingAt,
    heroAssetId: record.heroAssetId,
    displayOnly: true,
    metrics: {
      provenance: 'syntheticPortfolioFixture',
      buildingCount: record.metrics.buildingCount,
      bgfRSTotal: { kind: 'exact', value: record.metrics.bgfRSTotal },
      areaMetric: record.metrics.areaMetric,
      area: { kind: 'exact', value: record.metrics.areaValue },
      residentialUnits: { kind: 'exact', value: String(record.metrics.residentialUnits) },
    },
    projectTypeKey: null,
    syntheticValue: {
      amount: record.value.amount,
      currency: record.value.currency,
      asOf: record.value.asOf,
    },
  }
}

/** Every project the register shows: the two journeys plus the three records. */
export const PORTFOLIO_PROJECTS: readonly PortfolioProject[] = [
  ...DEMO_PROJECTS.map(navigableEntry),
  ...DISPLAY_FIXTURE.projects.map(displayOnlyEntry),
]

export const NAVIGABLE_PORTFOLIO_COUNT = DEMO_PROJECTS.length
export const DISPLAY_ONLY_PORTFOLIO_COUNT = DISPLAY_FIXTURE.displayOnlyProjectCount
export const PORTFOLIO_PROJECT_COUNT = PORTFOLIO_PROJECTS.length

/** The one predicate the UI asks before offering any navigation at all. */
export function isNavigableProject(id: string): boolean {
  return DEMO_PROJECTS.some((p) => p.id === id)
}

/**
 * The canonical project title: `[country] – [postcode] [city] – [address]`.
 *
 * En dash with hairline spacing, one function, used by the card, by search
 * and by every sort tie-breaker — so the thing a reader sees, the thing a
 * query matches and the thing an ordering compares can never be three
 * different strings.
 */
export function portfolioTitle(project: PortfolioProject): string {
  return `${project.countryCode} – ${project.postcode} ${project.city} – ${project.addressLine}`
}

/* ───────────────────────────── deadline ─────────────────────────────── */

export type DeadlineState =
  | { kind: 'none' }
  | { kind: 'overdue'; at: string }
  | { kind: 'soon'; at: string; days: number }
  | { kind: 'scheduled'; at: string }

export const DEADLINE_SOON_DAYS = 7

/**
 * The next client meeting, classified against an INJECTED clock.
 *
 * `now` is a parameter and not `Date.now()` because "in 5 days" is a claim
 * about the moment it is read, and a test that cannot fix that moment tests
 * the calendar rather than the product.
 */
export function deadlineState(iso: string | null, now: number): DeadlineState {
  if (!iso) return { kind: 'none' }
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return { kind: 'none' }
  const deltaMs = at - now
  if (deltaMs < 0) return { kind: 'overdue', at: iso }
  const days = Math.ceil(deltaMs / 86_400_000)
  if (days <= DEADLINE_SOON_DAYS) return { kind: 'soon', at: iso, days }
  return { kind: 'scheduled', at: iso }
}

/* ─────────────────── search, filters, ordering, URL ─────────────────── */

export const PORTFOLIO_SORTS = [
  'createdDesc', 'createdAsc', 'updatedDesc', 'updatedAsc',
] as const

export type PortfolioSort = (typeof PORTFOLIO_SORTS)[number]

export function isPortfolioSort(value: string): value is PortfolioSort {
  return (PORTFOLIO_SORTS as readonly string[]).includes(value)
}

/** `''` means "every value" — the register never filters on an empty choice. */
export const ANY = ''

export type PortfolioQuery = {
  text: string
  country: string
  city: string
  manager: string
  statuses: readonly LifecycleStatus[]
  sort: PortfolioSort
}

export const DEFAULT_PORTFOLIO_QUERY: PortfolioQuery = {
  text: '',
  country: ANY,
  city: ANY,
  manager: ANY,
  statuses: [],
  sort: 'updatedDesc',
}

function haystack(project: PortfolioProject): string {
  return [
    portfolioTitle(project),
    project.name,
    project.client,
    project.manager,
    project.city,
    project.addressLine,
    project.postcode,
    project.countryCode,
    project.id,
  ].join(' ').toLowerCase()
}

export function matchesQuery(project: PortfolioProject, query: PortfolioQuery): boolean {
  const needle = query.text.trim().toLowerCase()
  if (needle !== '' && !haystack(project).includes(needle)) return false
  if (query.country !== ANY && project.countryCode !== query.country) return false
  if (query.city !== ANY && project.city !== query.city) return false
  if (query.manager !== ANY && project.manager !== query.manager) return false
  // No selected status means every status: an empty multi-select is "I have
  // not narrowed by status", never "nothing matches".
  if (query.statuses.length > 0 && !query.statuses.includes(project.lifecycleStatus)) return false
  return true
}

function compareBy(sort: PortfolioSort, a: PortfolioProject, b: PortfolioProject): number {
  const field = sort === 'createdDesc' || sort === 'createdAsc' ? 'createdAt' : 'updatedAt'
  const descending = sort === 'createdDesc' || sort === 'updatedDesc'
  const left = Date.parse(a[field])
  const right = Date.parse(b[field])
  if (left !== right) return descending ? right - left : left - right
  // Deterministic tie-breakers: the canonical identity, then the id. Two
  // projects saved in the same second must not swap places between renders.
  const byTitle = portfolioTitle(a).localeCompare(portfolioTitle(b))
  return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id)
}

export function selectPortfolio(
  projects: readonly PortfolioProject[],
  query: PortfolioQuery,
): PortfolioProject[] {
  return projects
    .filter((p) => matchesQuery(p, query))
    .slice()
    .sort((a, b) => compareBy(query.sort, a, b))
}

/**
 * Option lists come from the WHOLE register, never from the visible subset —
 * otherwise choosing a country would delete the other countries from the
 * country list and the filter could not be undone from inside itself.
 */
export function countryOptions(projects: readonly PortfolioProject[]): string[] {
  return [...new Set(projects.map((p) => p.countryCode))].sort((a, b) => a.localeCompare(b))
}

/** Cities narrow by the selected country; with no country, every city. */
export function cityOptions(
  projects: readonly PortfolioProject[],
  country: string,
): string[] {
  const scoped = country === ANY ? projects : projects.filter((p) => p.countryCode === country)
  return [...new Set(scoped.map((p) => p.city))].sort((a, b) => a.localeCompare(b))
}

export function managerOptions(projects: readonly PortfolioProject[]): string[] {
  return [...new Set(projects.map((p) => p.manager))].sort((a, b) => a.localeCompare(b))
}

/**
 * The city a country change leaves behind.
 *
 * Returns the city that must be cleared, or `null` when the selection is
 * still valid. Naming this instead of silently resetting is the point: the
 * caller has to announce the reset, and a caller that forgets cannot claim
 * the control and the state agree.
 */
export function invalidatedCity(
  projects: readonly PortfolioProject[],
  country: string,
  city: string,
): string | null {
  if (city === ANY) return null
  return cityOptions(projects, country).includes(city) ? null : city
}

export function activeFilterCount(query: PortfolioQuery): number {
  return (query.text.trim() !== '' ? 1 : 0)
    + (query.country !== ANY ? 1 : 0)
    + (query.city !== ANY ? 1 : 0)
    + (query.manager !== ANY ? 1 : 0)
    + query.statuses.length
}

/* ──────────────────────────── URL round trip ────────────────────────── */

const PARAM = {
  text: 'q',
  country: 'country',
  city: 'city',
  manager: 'manager',
  status: 'status',
  sort: 'sort',
} as const

/**
 * The register's state as query parameters.
 *
 * Only what differs from the default is written, so a pristine portfolio has
 * a clean URL and a copied link carries exactly the narrowing its sender saw.
 */
export function encodePortfolioQuery(query: PortfolioQuery): string {
  const params = new URLSearchParams()
  if (query.text.trim() !== '') params.set(PARAM.text, query.text.trim())
  if (query.country !== ANY) params.set(PARAM.country, query.country)
  if (query.city !== ANY) params.set(PARAM.city, query.city)
  if (query.manager !== ANY) params.set(PARAM.manager, query.manager)
  for (const status of query.statuses) params.append(PARAM.status, status)
  if (query.sort !== DEFAULT_PORTFOLIO_QUERY.sort) params.set(PARAM.sort, query.sort)
  return params.toString()
}

/** Unknown values fall back to the default rather than throwing at a reader. */
export function decodePortfolioQuery(search: string): PortfolioQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const sort = params.get(PARAM.sort)
  const statuses = params.getAll(PARAM.status).filter(isLifecycleStatus)
  return {
    text: params.get(PARAM.text) ?? '',
    country: params.get(PARAM.country) ?? ANY,
    city: params.get(PARAM.city) ?? ANY,
    manager: params.get(PARAM.manager) ?? ANY,
    // A link that repeats a status is still one selection of it.
    statuses: [...new Set(statuses)],
    sort: sort && isPortfolioSort(sort) ? sort : DEFAULT_PORTFOLIO_QUERY.sort,
  }
}

/* ─────────────────────────── the project value ──────────────────────── */

export type PortfolioValue =
  /** No qualifying snapshot exists. Never rendered as 0. */
  | { kind: 'notCalculated' }
  | {
    kind: 'amount'
    /** The DECIDED, ROUNDED numeral the offer itself states, in German
     *  punctuation. Re-typeset for `en` by `localizeMoneyText` — never
     *  re-rounded, never recomputed. */
    display: string
    /** `subtotal` renames the row: an incomplete scope has no total. */
    coverage: 'total' | 'subtotal'
    asOf: string
    provenance: 'savedOptionSnapshot' | 'syntheticPortfolioFixture'
  }

/**
 * Which project a saved Option belongs to.
 *
 * `projectBaselineId` is minted in the store as `${projectId}@${at}` and a
 * project id never contains `@`, so the prefix is the project. Reading it
 * here rather than storing a second link keeps ONE source for "which project
 * is this Option a variant of".
 */
export function projectIdOfSavedVersion(version: SavedOptionVersion): string | null {
  const id = version.projectBaselineId
  if (!id) return null
  const at = id.indexOf('@')
  return at > 0 ? id.slice(0, at) : null
}

/**
 * The project's latest saved, PRESENTATION-ELIGIBLE Option snapshot.
 *
 * Eligibility is the existing client-projection contract, not a new rule:
 * the baseline must have validated its client projection at save time AND
 * match the current projection version. The portfolio therefore cannot show
 * a number the client-facing product would refuse to show, and it computes
 * nothing of its own.
 */
export function latestPresentableSnapshot(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  projectId: string,
): SavedOptionVersion | null {
  const eligible = Object.values(state.savedOptionVersions)
    .flat()
    .filter((v) => projectIdOfSavedVersion(v) === projectId)
    .filter((v) => v.clientProjectionValid
      && v.clientProjectionVersion === CLIENT_PROJECTION_VERSION)
  if (eligible.length === 0) return null
  return eligible.reduce((latest, v) => (
    Date.parse(v.savedAt) >= Date.parse(latest.savedAt) ? v : latest
  ))
}

/**
 * The value the register prints for a project.
 *
 * A display-only record states its synthetic fixture amount; a real project
 * states its latest presentable snapshot, or says the price has not been
 * determined. There is no third branch, and in particular there is no branch
 * that adds anything up (rule 16, and R-18: a total names its scope).
 */
export function portfolioValue(
  project: PortfolioProject,
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
): PortfolioValue {
  if (project.displayOnly) {
    return project.syntheticValue
      ? {
        kind: 'amount',
        display: formatGermanGrouped(project.syntheticValue.amount),
        coverage: 'total',
        asOf: project.syntheticValue.asOf,
        provenance: 'syntheticPortfolioFixture',
      }
      : { kind: 'notCalculated' }
  }
  const snapshot = latestPresentableSnapshot(state, project.id)
  if (!snapshot) return { kind: 'notCalculated' }
  return {
    kind: 'amount',
    display: snapshot.result.totalDisplay,
    coverage: snapshot.result.coverage,
    asOf: snapshot.savedAt,
    provenance: 'savedOptionSnapshot',
  }
}

/**
 * German thousands grouping for a whole-euro fixture amount.
 *
 * Deliberately the same punctuation `engine/money.ts`'s `formatDE` produces,
 * so a synthetic amount and a saved snapshot amount reach the locale layer
 * in ONE shape and `localizeMoneyText` re-typesets both identically for `en`.
 */
function formatGermanGrouped(amount: string): string {
  return new Decimal(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
