import { Decimal } from 'decimal.js'
import { clampPage, pageCountFor, paginationRange } from '../design-system/Pagination'
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
  type ProjectAnalysis,
} from './projectAnalysis'
import {
  DECLARABLE_LIFECYCLE_STATUSES,
  EXPLICIT_PROJECT_HOLDS,
  deriveProjectLifecycle,
  isDeclarableLifecycleStatus,
  isExplicitProjectHold,
  isLifecycleStatus,
  type DeclarableLifecycleStatus,
  type ExplicitProjectHold,
  type LifecycleStatus,
  type LoadedOptionFacts,
  type ProjectReadinessLedger,
} from './projectLifecycle'

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
 *
 * WHERE THE VALUE COMES FROM lives in [[projectLifecycle]] and nowhere else.
 * A navigable project's status is DERIVED from its own committed truth; the
 * only thing a fixture may still declare is the explicit human state a
 * derivation must never invent. This module holds the closed set, the label
 * mapping and the tone; it does not decide.
 */
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

/**
 * WHERE a record's lifecycle status comes from — a discriminated union, so
 * the record itself answers the question rather than a reader guessing.
 *
 * `derived` is a real project: its status is computed from its own committed
 * truth by [[projectLifecycle]], and the only thing the fixture contributes
 * is `hold` — the explicit `on_hold` / `waiting_for_feedback` / `archive`
 * state a person sets and no derivation may infer.
 *
 * `declaredSynthetic` is a display-only register record. It has no
 * documents, no analysis and no Option, so there is nothing to derive from;
 * its status is synthetic register data exactly like its areas, its value
 * and its next meeting. `assertDeclarable` refuses `ready_to_pitch` and
 * `review_required` there, because those two assert a state of the product
 * that no synthetic record can be in.
 */
export type PortfolioLifecycleSource =
  | { kind: 'derived'; hold: ExplicitProjectHold | null }
  | { kind: 'declaredSynthetic'; status: DeclarableLifecycleStatus }

/**
 * A register RECORD: everything the portfolio knows about a project that is
 * not its current lifecycle status.
 *
 * The status is deliberately absent. It is added by
 * `resolveProjectLifecycles`, which is the only producer, and the result is
 * a `PortfolioRow`. Client-facing consumers (`clientProposal`,
 * `optionComparison`, `PresentationShell`, `ClientScenario`) take a RECORD,
 * so an internal workflow status has no field to travel into a client
 * projection through.
 */
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
  lifecycle: PortfolioLifecycleSource
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
  /** Synthetic register status. Refused if it asserts a product state. */
  declaredLifecycle: string
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

/**
 * A display-only record's declared status, refused unless it is one a
 * synthetic record may honestly claim.
 *
 * `ready_to_pitch` and `review_required` are rejected HERE, at fixture load,
 * and not filtered at render: a refused fixture is a failing test somebody
 * fixes, a filtered one is a lie the product tells quietly.
 */
function assertDeclarable(value: string, id: string): DeclarableLifecycleStatus {
  if (!isLifecycleStatus(value)) {
    throw new Error(`portfolio: «${id}» declares unknown lifecycle status «${value}»`)
  }
  if (!isDeclarableLifecycleStatus(value)) {
    throw new Error(
      `portfolio: «${id}» declares «${value}», which asserts a product state a `
      + 'display-only record cannot be in. Only '
      + `${DECLARABLE_LIFECYCLE_STATUSES.join(', ')} may be declared.`,
    )
  }
  return value
}

/** The explicit human state a real project's fixture may still declare. */
function assertHold(value: string | null, id: string): ExplicitProjectHold | null {
  if (value === null) return null
  if (!isExplicitProjectHold(value)) {
    throw new Error(
      `portfolio: «${id}» declares lifecycle hold «${value}». A fixture may only `
      + `declare an explicit human state (${EXPLICIT_PROJECT_HOLDS.join(', ')}); `
      + 'every other status is derived from the project\'s own truth.',
    )
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
    lifecycle: { kind: 'derived', hold: assertHold(block.lifecycleHold, project.id) },
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
    lifecycle: {
      kind: 'declaredSynthetic',
      status: assertDeclarable(record.declaredLifecycle, record.id),
    },
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

/* ────────────────────── lifecycle resolution ────────────────────────── */

/**
 * A register ROW: a record with its CURRENT lifecycle status stamped on.
 *
 * The distinction between a record and a row is the whole mechanism of this
 * slice. `lifecycleStatus` exists on exactly one type, produced by exactly
 * one function, and both the card and the status filter read that one field
 * — so "the status on the card and the status filter disagree" has no way
 * to happen. Reading a status off a raw `PortfolioProject` does not compile,
 * which is the direction that matters: no client-facing consumer can pick up
 * an internal workflow status, because the field is not on the record they
 * take. The converse is NOT enforced — TypeScript is structural, so passing
 * a row where a record is expected compiles silently — so the guarantee is
 * that `PortfolioRow` never leaves this register, and today it does not:
 * every client consumer sources `PORTFOLIO_PROJECTS` itself.
 */
export type PortfolioRow = PortfolioProject & { lifecycleStatus: LifecycleStatus }

/**
 * Everything the resolver needs from the store, as plain data.
 *
 * `analyses` is available for EVERY navigable project (`projectAnalyses` is
 * keyed by project id and kept across a project switch). `options` is the
 * ONE project whose Option workspace is currently loaded, or `null` — the
 * per-project storage split means no other project's Options are in memory,
 * and inventing them would be exactly the cross-project leak that split
 * closed.
 */
export type LifecycleResolutionInput = {
  analyses: Record<string, ProjectAnalysis>
  readiness: ProjectReadinessLedger
  options: LoadedOptionFacts | null
}

/**
 * Records → rows. THE producer of a lifecycle status.
 *
 * Pure and total: five records in, five rows out, in order, every row
 * carrying one of the seven closed statuses.
 */
export function resolveProjectLifecycles(
  records: readonly PortfolioProject[],
  input: LifecycleResolutionInput,
): PortfolioRow[] {
  return records.map((record) => ({
    ...record,
    lifecycleStatus: record.lifecycle.kind === 'declaredSynthetic'
      ? record.lifecycle.status
      : deriveProjectLifecycle({
        projectId: record.id,
        hold: record.lifecycle.hold,
        analysis: input.analyses[record.id],
        readiness: input.readiness[record.id],
        // A project only contributes Option facts when its own workspace is
        // the loaded one. `null` for every other project is not a gap: it is
        // the truthful statement that this register cannot see them.
        options: input.options && input.options.projectId === record.id
          ? input.options
          : null,
      }),
  }))
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

/**
 * The orderings the register offers.
 *
 * The four date orderings are the original register's. `meetingAsc` and
 * `titleAsc` were added when the card's own thesis — *the next client
 * meeting is the one fact that makes somebody act today* — turned out to be
 * unorderable: the screen prioritised urgency visually and denied it
 * structurally. Neither addition invents a ranking. `meetingAsc` orders an
 * existing date field ascending; `titleAsc` orders the canonical identity
 * `portfolioTitle()` already produces.
 */
export const PORTFOLIO_SORTS = [
  'createdDesc', 'createdAsc', 'updatedDesc', 'updatedAsc',
  'meetingAsc', 'titleAsc',
] as const

export type PortfolioSort = (typeof PORTFOLIO_SORTS)[number]

export function isPortfolioSort(value: string): value is PortfolioSort {
  return (PORTFOLIO_SORTS as readonly string[]).includes(value)
}

/** `''` means "every value" — the register never filters on an empty choice. */
export const ANY = ''

export type PortfolioQuery = {
  text: string
  city: string
  client: string
  manager: string
  statuses: readonly LifecycleStatus[]
  sort: PortfolioSort
  /**
   * 1-based. PRESENTATION ONLY — it decides which matches are listed and
   * nothing else. Clamped against the CURRENT result set by
   * `portfolioPage`, so a stale link can never put an empty page in the DOM.
   */
  page: number
}

export const DEFAULT_PORTFOLIO_QUERY: PortfolioQuery = {
  text: '',
  city: ANY,
  client: ANY,
  manager: ANY,
  statuses: [],
  sort: 'updatedDesc',
  page: 1,
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

export function matchesQuery(project: PortfolioRow, query: PortfolioQuery): boolean {
  const needle = query.text.trim().toLowerCase()
  if (needle !== '' && !haystack(project).includes(needle)) return false
  if (query.city !== ANY && project.city !== query.city) return false
  if (query.client !== ANY && project.client !== query.client) return false
  if (query.manager !== ANY && project.manager !== query.manager) return false
  // No selected status means every status: an empty multi-select is "I have
  // not narrowed by status", never "nothing matches".
  if (query.statuses.length > 0 && !query.statuses.includes(project.lifecycleStatus)) return false
  return true
}

/**
 * Deterministic tie-breakers: the canonical identity, then the id. Two
 * projects saved in the same second must not swap places between renders.
 */
function breakTie(a: PortfolioProject, b: PortfolioProject): number {
  const byTitle = portfolioTitle(a).localeCompare(portfolioTitle(b))
  return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id)
}

/** A bookable meeting as a comparable instant, or `null` when none exists. */
function meetingInstant(project: PortfolioProject): number | null {
  if (!project.nextClientMeetingAt) return null
  const at = Date.parse(project.nextClientMeetingAt)
  return Number.isNaN(at) ? null : at
}

function compareBy(sort: PortfolioSort, a: PortfolioRow, b: PortfolioRow): number {
  if (sort === 'titleAsc') return breakTie(a, b)
  if (sort === 'meetingAsc') {
    /**
     * Overdue first (oldest miss first), then upcoming (soonest first),
     * then everything with no meeting at all.
     *
     * A plain ascending sort on the instant produces exactly that order —
     * every overdue meeting is in the past and every upcoming one is in the
     * future — so the ordering needs NO clock. That matters twice: a sort
     * whose result depends on `Date.now()` is untestable, and a register
     * that silently re-ordered itself between two renders of the same page
     * would not be a work queue.
     */
    const left = meetingInstant(a)
    const right = meetingInstant(b)
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1
    } else if (left !== right) {
      return left - right
    }
    return breakTie(a, b)
  }
  const field = sort === 'createdDesc' || sort === 'createdAsc' ? 'createdAt' : 'updatedAt'
  const descending = sort === 'createdDesc' || sort === 'updatedDesc'
  const left = Date.parse(a[field])
  const right = Date.parse(b[field])
  if (left !== right) return descending ? right - left : left - right
  return breakTie(a, b)
}

/**
 * The WHOLE matching result set, ordered.
 *
 * Filter → sort → (only then) slice. Sorting a page rather than the result
 * set would make page 2 of «next meeting first» a second, unrelated queue,
 * so the slice deliberately lives in `portfolioPage` and never in here.
 */
export function selectPortfolio(
  projects: readonly PortfolioRow[],
  query: PortfolioQuery,
): PortfolioRow[] {
  return projects
    .filter((p) => matchesQuery(p, query))
    .slice()
    .sort((a, b) => compareBy(query.sort, a, b))
}

/* ───────────────────────────── pagination ──────────────────────────── */

/**
 * The register's page size, inherited verbatim from the accepted Documents
 * workspace contract — 10 per page, controls from the 11th result.
 *
 * One product, one pagination rhythm: somebody who learns 10-per-page in a
 * project's Documents register must not meet 12-per-page in Projects.
 */
export const PORTFOLIO_PAGE_SIZE = 10

export type PortfolioPage = {
  /** The cards to render. */
  rows: PortfolioRow[]
  /** Clamped: a filter that shrinks the set never strands the reader. */
  page: number
  pageCount: number
  total: number
  from: number
  to: number
  /** Below the activation threshold the register shows everything. */
  paginated: boolean
}

/**
 * One page of the ordered result set.
 *
 * Up to ten matches are all shown with no controls at all; from the
 * eleventh the register paginates at ten. The page is clamped HERE rather
 * than in a component, so an out-of-range `?page=` from a stale link can
 * never reach the DOM in the first place.
 */
export function portfolioPage(
  matching: readonly PortfolioRow[],
  page: number,
  pageSize = PORTFOLIO_PAGE_SIZE,
): PortfolioPage {
  const total = matching.length
  if (total <= pageSize) {
    return {
      rows: [...matching],
      page: 1,
      pageCount: 1,
      total,
      from: total === 0 ? 0 : 1,
      to: total,
      paginated: false,
    }
  }
  const pageCount = pageCountFor(total, pageSize)
  const current = clampPage(page, pageCount)
  const { from, to } = paginationRange(current, pageSize, total)
  return { rows: matching.slice(from - 1, to), page: current, pageCount, total, from, to, paginated: true }
}

/**
 * Option lists come from the WHOLE register, never from the visible subset —
 * otherwise choosing a city would delete the other cities from the list and
 * the filter could not be undone from inside itself.
 *
 * There is no country filter: the register is German to a rounding error, so
 * the control narrowed nothing while costing a column in the panel and a
 * dependency between two selects. The country still LIVES on the project —
 * it opens the card title and is searched by the text field — it simply has
 * no facet of its own.
 */
export function cityOptions(projects: readonly PortfolioProject[]): string[] {
  return [...new Set(projects.map((p) => p.city))].sort((a, b) => a.localeCompare(b))
}

/**
 * The client companies in the register.
 *
 * A facet of its own, not a text search: a sales rep remembers the PERSON
 * and the firm before the address, and the free-text field can only find a
 * company whose spelling the searcher already has exactly right.
 */
export function clientOptions(projects: readonly PortfolioProject[]): string[] {
  return [...new Set(projects.map((p) => p.client))].sort((a, b) => a.localeCompare(b))
}

export function managerOptions(projects: readonly PortfolioProject[]): string[] {
  return [...new Set(projects.map((p) => p.manager))].sort((a, b) => a.localeCompare(b))
}

export function activeFilterCount(query: PortfolioQuery): number {
  return (query.text.trim() !== '' ? 1 : 0)
    + (query.city !== ANY ? 1 : 0)
    + (query.client !== ANY ? 1 : 0)
    + (query.manager !== ANY ? 1 : 0)
    + query.statuses.length
}

/* ──────────────────────────── URL round trip ────────────────────────── */

const PARAM = {
  text: 'q',
  city: 'city',
  client: 'client',
  manager: 'manager',
  status: 'status',
  sort: 'sort',
  page: 'page',
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
  if (query.city !== ANY) params.set(PARAM.city, query.city)
  if (query.client !== ANY) params.set(PARAM.client, query.client)
  if (query.manager !== ANY) params.set(PARAM.manager, query.manager)
  for (const status of query.statuses) params.append(PARAM.status, status)
  if (query.sort !== DEFAULT_PORTFOLIO_QUERY.sort) params.set(PARAM.sort, query.sort)
  if (query.page > 1) params.set(PARAM.page, String(query.page))
  return params.toString()
}

/** Unknown values fall back to the default rather than throwing at a reader. */
export function decodePortfolioQuery(search: string): PortfolioQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const sort = params.get(PARAM.sort)
  const statuses = params.getAll(PARAM.status).filter(isLifecycleStatus)
  const page = Number.parseInt(params.get(PARAM.page) ?? '', 10)
  return {
    text: params.get(PARAM.text) ?? '',
    city: params.get(PARAM.city) ?? ANY,
    client: params.get(PARAM.client) ?? ANY,
    manager: params.get(PARAM.manager) ?? ANY,
    // A link that repeats a status is still one selection of it.
    statuses: [...new Set(statuses)],
    sort: sort && isPortfolioSort(sort) ? sort : DEFAULT_PORTFOLIO_QUERY.sort,
    // A page BEYOND the last one is not rejected here: it is a legitimate
    // link to a register that has since shrunk, and `portfolioPage` clamps
    // it to the last page that exists. Only a non-page (`?page=abc`,
    // `?page=0`, `?page=-3`) falls back to the first.
    page: Number.isFinite(page) && page > 0 ? page : 1,
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
    /** The exact value the display was rounded FROM, for deriving rates. */
    exact: string
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
        exact: project.syntheticValue.amount,
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
    exact: snapshot.result.totalExact,
    coverage: snapshot.result.coverage,
    asOf: snapshot.savedAt,
    provenance: 'savedOptionSnapshot',
  }
}

/**
 * The register's rate: value ÷ the very area the card already reports.
 *
 * Rule 39, both halves. The rate is derived FROM THE SUMS — one total
 * divided by one area — never averaged across buildings, and the caller
 * labels it with the norm that area belongs to (`WFL nach WoFlV` or
 * `NUF nach DIN 277`), so the denominator a reader sees is the denominator
 * that was used. A subtotal has no total to divide, an incomplete area has
 * no sum to divide BY, and both say so instead of printing a rate that
 * quietly means something narrower than its label.
 *
 * Whole euro, because the comparison it serves is «are we near the market
 * or not» — a cent on a €/m² rate is precision the number does not have.
 */
export function portfolioUnitValue(
  value: PortfolioValue,
  metrics: PortfolioMetrics,
): { kind: 'amount'; value: string } | { kind: 'unavailable' } {
  if (value.kind !== 'amount' || value.coverage !== 'total') return { kind: 'unavailable' }
  if (metrics.area.kind !== 'exact') return { kind: 'unavailable' }
  const area = new Decimal(metrics.area.value)
  if (area.lessThanOrEqualTo(0)) return { kind: 'unavailable' }
  return { kind: 'amount', value: new Decimal(value.exact).dividedBy(area).toFixed(0) }
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
