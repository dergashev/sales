import { Decimal } from 'decimal.js'
import type { CostGroup } from '../engine/calculate'
import type { Rate } from '../engine/money'
import { NNBSP, formatDE, rateUnit } from '../engine/money'
import type {
  KgCatalogue,
  KgContribution,
  KgDecisions,
  KgScopeDecision,
  KgScopeGroup,
  KgSelectionWithoutBasis,
} from '../engine/kgConfiguration'
import {
  KG_SCOPE_GROUPS,
  chapterOf,
  contributionCostAuthority,
  dependencySuspension,
  derivedValue,
  kgContributions,
  kgSelectionsWithoutBasis,
  selectedVariant,
  serviceById,
  serviceDecision,
} from '../engine/kgConfiguration'
import type { ResponsibilityProjection } from '../engine/responsibility'
import type { ScheduleDerivation } from './optionSchedule'
import { scheduleCriticalPhase } from './optionSchedule'
import type { SchedulePhase } from './optionSchedule'
import type { ScopeBuilding } from './optionBuildingScope'
import { scopeMetricValue } from './optionBuildingScope'
import type { CommercialResult } from './commercialResult'
import type { CompositionRow } from './commercialProjection'
import { commercialComposition, regionalFactorPresentation } from './commercialProjection'
import { projectDriversForClient, translatedDriverLabel } from './clientProjection'
import type { SavedOptionVersion } from './optionSave'
import type { PortfolioProject } from './projectPortfolio'
import { OFFER_ARTIFACTS, type OfferArtifactId } from '../config/offer-artifacts'
import { projectAsset, type ProjectAsset } from '../assets/project-media'
import type { ClientScenarioSnapshot, Store } from './store'
import {
  clientScheduleDerivation,
  clientSchedulePhases,
  kgCatalogueFor,
  responsibilityFor,
} from './store'

/**
 * VR3-CP-00 — THE ONE DECLARED CLIENT PROJECTION.
 *
 * ## Why this module exists
 *
 * Before it, the live client stage and the printed sheet each reached into
 * the store and built their own reading of the same facts. That is the
 * "one number, two meanings" defect this programme has now recorded three
 * times, and `ClientNarrative.tsx` warned about it in its own comment:
 * *"the screen and the sheet in the client's hand would drift on the first
 * edit, and drift silently."* `clientScopeRows` was the one place where the
 * warning had been acted on — for six rows out of a whole proposal.
 *
 * So the architecture is now:
 *
 * ```
 *                       Product truth
 *                             ↓
 *          ONE declared client projection (profile-scoped)
 *                             ↓
 *            ┌────────────────┴────────────────┐
 *            │  live stage    │  print / export │
 *            └────────────────┴────────────────┘
 * ```
 *
 * Every client-facing surface takes a `ClientProposal` and NOTHING else.
 * That is what makes `OUT-14` structural rather than aspirational: the
 * render function has no reference to the source record, so an internal
 * field cannot leak by being forgotten — it is not there to forget.
 *
 * ## Allowlist by absence (SECURITY-001, OUT-13)
 *
 * An omitted fact is ABSENT from this object: no key, no `null`, no hiding
 * flag. `display:none`, `visibility:hidden`, `aria-hidden` and `hidden` are
 * not exclusion mechanisms, and that applies to the `@media print` tree
 * exactly as it applies to the stage.
 *
 * Never present here, at any profile: margin, discount internals, Δ
 * percentages, CRM/HubSpot state, private notes, diagnostics, parser
 * confidence, `InformationAuthority` values, provenance debugging,
 * `Interne Bezugsgröße`, `KG-700-Modus`, requirement codes, saved-version /
 * dirty / unsaved vocabulary, internal pipeline view names, or any raw id.
 *
 * ## Language
 *
 * This is a state module, so it cannot use hooks. Every user-visible string
 * is resolved by the CALLER's dictionary function and handed in through
 * `ClientProposalDeps`. Normative denominators (`BGF oberirdisch`,
 * `WFL nach WoFlV`, `NUF nach DIN 277`, `OKBP`) are never translated
 * (LOCALE-009) — they arrive already correct from the engine and are passed
 * through untouched.
 */

/* ─────────────────────────── output profile ──────────────────────────── */

/**
 * The declared output profile of a client surface (OUT-01).
 *
 * A surface that renders without one does not render, and there is no
 * default: the silent default is exactly what turned an internal view into
 * a client view on one switch (MODE-001).
 *
 * Note what this is NOT. The RUNTIME discriminator for "am I in front of a
 * client" is `OutputMode` in `clientProjection.ts`, and it stays there. This
 * is the ARTEFACT axis — which client medium is being produced — and it has
 * lived until now only as documentary prose plus the fixture field
 * `blockedOutputProfiles`. Declaring it in source is the smallest change
 * that lets a surface state its profile instead of implying one.
 */
export type ClientOutputProfile =
  | 'clientLiveConfiguration'
  | 'clientPrint'
  | 'clientPdf'
  | 'clientEmail'
  | 'clientReadOnly'

/** True for the profiles that are a DOCUMENT rather than a live stage. */
export function isDocumentProfile(profile: ClientOutputProfile): boolean {
  return profile === 'clientPrint' || profile === 'clientPdf' || profile === 'clientEmail'
}

/* ───────────────────────────── chapter model ─────────────────────────── */

/**
 * The ten narrative chapters, in the order a client is walked through them.
 *
 * This replaces the six-section rail (`project · buildings · scope ·
 * services · schedule · investment`), whose order put the price sixth of six
 * and named the what-if panel `Leistungen`.
 *
 * `varianten` is deliberately absent: it is a LAYER over the stage, not an
 * eleventh chapter, because Option difference is a question the client asks
 * DURING a chapter, not a place in the story.
 */
export const CLIENT_CHAPTERS = [
  'angebot',
  'ueberblick',
  'projekt',
  'gebaeude',
  'preis',
  'leistungen',
  'terminplan',
  'architektur',
  'grundlagen',
  'abschluss',
] as const

export type ClientChapterId = typeof CLIENT_CHAPTERS[number]

export const CHAPTER_LABEL_KEY: Readonly<Record<ClientChapterId, string>> = {
  angebot: 'vr3.client.chapter.angebot',
  ueberblick: 'vr3.client.chapter.ueberblick',
  projekt: 'vr3.client.chapter.projekt',
  gebaeude: 'vr3.client.chapter.gebaeude',
  preis: 'vr3.client.chapter.preis',
  leistungen: 'vr3.client.chapter.leistungen',
  terminplan: 'vr3.client.chapter.terminplan',
  architektur: 'vr3.client.chapter.architektur',
  grundlagen: 'vr3.client.chapter.grundlagen',
  abschluss: 'vr3.client.chapter.abschluss',
}

/* ──────────────────────────── the view input ─────────────────────────── */

/**
 * Everything the presentation resolves ONCE, before any chapter renders.
 *
 * One prop rather than six: the chapters must be reading one state, and a
 * type that can only be constructed whole is how that is enforced rather
 * than asked for.
 */
export type ClientView = {
  optionName: string
  savedVersion: SavedOptionVersion | null
  /** The state being shown: the saved baseline, or the what-if scenario. */
  presented: ClientScenarioSnapshot
  /** The saved baseline, always — the authority the presentation speaks for. */
  baseline: ClientScenarioSnapshot
  projectName: string
  projectHeroAssetId: string | null
  language: 'de' | 'en'
}

export type ClientProposalDeps = Readonly<{
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string
  tx: (deText: string) => string
}>

/* ───────────────────────────── the fact types ────────────────────────── */

export type ClientIdentity = Readonly<{
  projectName: string
  /** The client organisation, as the Product holds it — an opaque string. */
  clientName: string | null
  /**
   * Country code · postcode and city · street line, composed at runtime from
   * the Product's own fields. Never a literal in source: a written-out
   * postal line is refused by the repository's PII gate, and rightly.
   */
  addressLine: string | null
  /** ISO date of the saved baseline this proposal speaks for. */
  offerDateISO: string | null
  optionName: string
  /** Authored constant. The Product holds no legal-entity record. */
  legalEntity: string
  hero: ProjectAsset | null
  heroAlt: string | null
}>

export type ClientMetric = Readonly<{
  /** Stable identity, so a consumer never has to match on a translated label. */
  id: 'energy' | 'project'
  label: string
  value: string
  /** Rendered smaller on the same baseline, never as a footnote. */
  unit: string | null
  note: string | null
}>

export type ClientCommercial = Readonly<{
  /** The derived R-18 signature. Never assigned. */
  signature: string
  totalExact: Decimal
  totalDisplay: string
  /** `≈` when the shown value differs from the exact one. */
  totalPrefix: '≈' | ''
  /** The rounding footnote (step + exact value). Printed on the same page. */
  totalDisclosure: string | null
  coverage: 'total' | 'subtotal'
  uncertaintyPp: number
  leadRate: Rate
  leadRateText: string
  /** `Leitkennzahl · BGF oberirdisch` — the denominator names its norm. */
  leadRateLabel: string
  /**
   * The reference quantity the lead rate divides by, as a client reads it
   * (`17.250,00 m²`). A rate without the quantity it refers to is a rate a
   * client cannot check; the approved overview states both side by side.
   * `null` only when the engine gives no usable denominator.
   */
  leadDenominatorText: string | null
  /** Copy only. The engine has no VAT field and this does not create one. */
  taxNote: string
  composition: readonly ClientCompositionRow[]
}>

export type ClientCommercialState =
  | 'priced'
  | 'zeroDirect'
  | 'bundle'
  | 'indirect'
  | 'noBasis'
  | 'bauherr'
  | 'unknown'
  | 'unpriced'
  | 'excluded'
  | 'undecided'

export type ClientCompositionRow = Readonly<{
  group: CostGroup
  /** `KG 300` — the number a client reads in every real deck. */
  number: string
  title: string
  state: ClientCommercialState
  exact: Decimal | null
  /** The released phrase for this row's authority, already translated. */
  stateText: string | null
  /** All3 vs Bauherr, sourced from released output — never invented. */
  responsibility: 'all3' | 'bauherr' | null
}>

export type ClientBuilding = Readonly<{
  id: string
  /** `A` / `B` / `C` — identity within this Option, never an internal id. */
  mark: string
  name: string
  usage: string
  storeys: string
  units: number | null
  bgfRSAbove: string | null
  bgfRAbove: string | null
  bgfSAbove: string | null
  bgfRSBelow: string | null
  wfl: string | null
  nuf: string | null
  hasBasement: boolean
  basementText: string | null
  identity: ProjectAsset | null
  identityAlt: string | null
}>

export type ClientConstructionLine = Readonly<{
  id: string
  label: string
  value: string
  /** Set when this answer differs by building and must be qualified. */
  buildingName: string | null
  /** A consequence sentence the configurator authored, never a price. */
  consequence: string | null
  state: ClientCommercialState | null
  stateText: string | null
}>

export type ClientConstruction = Readonly<{
  /** Reaches the main story: façade, ground-floor structure, roof, excluded UG. */
  story: readonly ClientConstructionLine[]
  /** Everything else, on request.  */
  detail: readonly ClientConstructionLine[]
}>

export type ClientScopeRow = Readonly<{
  group: KgScopeGroup
  title: string
  decision: KgScopeDecision | 'undecided'
  /** The released phrase for the decision, already translated. */
  stateText: string
}>

export type ClientScopeGroupId = 'considered' | 'included' | 'excluded'

export type ClientScopeItem = Readonly<{
  id: string
  text: string
  buildingName: string | null
}>

export type ClientScope = Readonly<{
  rows: readonly ClientScopeRow[]
  /** The turnkey / physical boundary, in the Product's own words. */
  boundary: string | null
  groups: Readonly<Record<ClientScopeGroupId, readonly ClientScopeItem[]>>
}>

export type ClientResponsibilityMedium = Readonly<{
  id: string
  label: string
  clientText: string
  all3From: string
  /** An unresolved medium is a named CONDITION of the offer, never a euro. */
  attention: boolean
}>

export type ClientResponsibility = Readonly<{
  boundary: string | null
  handover: string | null
  media: readonly ClientResponsibilityMedium[]
  unresolved: readonly ClientResponsibilityMedium[]
}>

export type ClientSchedulePhase = Readonly<{
  id: string
  label: string
  startISO: string
  endISO: string
  durationText: string
}>

export type ClientSchedule = Readonly<{
  durationText: string
  durationPrefix: '≈' | ''
  /** The SAME word the internal cockpit uses: `ab OKBP`, never `Baubeginn`. */
  startBoundary: string
  startISO: string | null
  completionISO: string | null
  phases: readonly ClientSchedulePhase[]
  criticalPhaseLabel: string | null
}>

export type ClientMediaItem = Readonly<{
  id: string
  asset: ProjectAsset
  alt: string
  caption: string
  context: string | null
}>

export type ClientMedia = Readonly<{
  /** The one dominant image of the Architecture chapter. */
  lead: ClientMediaItem | null
  supporting: readonly ClientMediaItem[]
  /** Per-building filters, when the Option has more than one building. */
  buildingFilters: readonly Readonly<{ id: string; label: string }>[]
}>

export type ClientAssumptionGroupId = 'offer' | 'basis' | 'open'

export type ClientAssumptions = Readonly<
  Record<ClientAssumptionGroupId, readonly string[]>
>

export type ClientDriverRow = Readonly<{
  key: string
  label: string
  exact: Decimal
}>

export type ClientDrivers = Readonly<{
  rows: readonly ClientDriverRow[]
  /** The drivers reconcile to this basis exactly — asserted at the engine. */
  sumExact: Decimal
  /** Present in EVERY client output, in either flag state (OUT-56, rule 40). */
  regionalFactor: Readonly<{
    active: boolean
    /** What the factor adds, or WOULD add when it is not activated. */
    effect: Decimal
    text: string
  }>
}>

export type ClientArtefact = Readonly<{
  id: OfferArtifactId
  title: string
}>

export type ClientProposal = Readonly<{
  profile: ClientOutputProfile
  language: 'de' | 'en'
  chapters: readonly ClientChapterId[]
  identity: ClientIdentity
  overview: readonly ClientMetric[]
  commercial: ClientCommercial
  buildings: readonly ClientBuilding[]
  construction: ClientConstruction
  scope: ClientScope
  responsibility: ClientResponsibility | null
  schedule: ClientSchedule
  media: ClientMedia
  assumptions: ClientAssumptions
  drivers: ClientDrivers
  artefacts: readonly ClientArtefact[]
}>

/* ──────────────────────────── shared helpers ─────────────────────────── */

/** DC-44: the number of drivers a client is named before the remainder row. */
export const CLIENT_DRIVER_LIMIT = 5

const KG_NUMBER: Readonly<Record<string, string>> = {
  KG_100: 'KG 100',
  KG_200: 'KG 200',
  KG_300: 'KG 300',
  KG_400: 'KG 400',
  KG_500: 'KG 500',
  KG_600: 'KG 600',
  KG_700: 'KG 700',
  KG_800: 'KG 800',
}

export function selectedBuildingsOf(view: ClientView): readonly ScopeBuilding[] {
  const config = view.presented.config
  return config.scopeBuildings.filter((b) => config.scopeSelected[b.id])
}

/** `A`, `B`, `C` … — a building's identity inside this Option. */
export function buildingMark(index: number): string {
  return String.fromCharCode(65 + index)
}

function areaText(value: string | null, language: 'de' | 'en'): string | null {
  if (value === null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

/**
 * The client-facing phrase for a released cost authority.
 *
 * Every branch is the phrase the Product already owns. `unknown` is never
 * inferred as `direct`, and `noBasis` is never a zero — `± 0 €` is legal for
 * `direct` alone, where it means "measurably the same price as the baseline
 * choice".
 */
function commercialStateText(
  state: ClientCommercialState,
  deps: ClientProposalDeps,
  bundleBasis?: string | null,
): string | null {
  switch (state) {
    case 'priced': return null
    case 'zeroDirect': return null
    case 'bundle':
      return deps.t('vr3.client.state.bundle', { basis: bundleBasis ?? '' })
    case 'indirect': return deps.t('vr3.client.state.indirect')
    case 'noBasis': return deps.t('vr3.client.state.noBasis')
    case 'bauherr': return deps.t('vr3.client.state.bauherr')
    case 'unknown': return deps.t('vr3.client.state.unknown')
    case 'unpriced': return deps.t('vr3.client.state.unpriced')
    case 'excluded': return deps.t('vr3.client.state.excluded')
    case 'undecided': return deps.t('vr3.client.state.undecided')
  }
}

function compositionState(row: CompositionRow): ClientCommercialState {
  switch (row.state) {
    case 'priced': return 'priced'
    case 'unpriced': return 'unpriced'
    case 'excluded': return 'excluded'
    case 'undecided': return 'undecided'
  }
}

/* ───────────────────────── the construction summary ──────────────────── */

/**
 * KG 300, transformed into client-safe construction statements.
 *
 * The transformation is one-directional and mandatory:
 *
 * ```
 * CONFIGURATOR DETAIL   9–28 groups, 25–77 services, per building
 *         ↓  client-safe summary model
 * MAIN STORY   a small number of named construction choices
 *         ↓
 * DETAIL LAYER the rest, on request
 * ```
 *
 * ## The per-building truthfulness rule
 *
 * Since the KG unification a construction decision can differ PER BUILDING:
 * `KgServiceGroup` and `KgService` each carry `buildingId`, and the complex
 * fixture holds three physically distinct façade decisions, three slabs,
 * three roofs. **Stating one façade for a three-building Option is false.**
 * So a line whose answer differs across buildings is labelled with its
 * building; a line all buildings agree on is stated once, unqualified.
 *
 * Names come from `store.scopeBuildings` — the engine carries only ids.
 *
 * What never reaches a client from here: raw service or variant ids,
 * `appliesWhen` / `dependsOn` edges, `visual` keys and asset provenance, and
 * the internal progression vocabulary (`noch offen: …`, `außerhalb Umfang`).
 * The EFFECT of a dependency may be stated in human words; the edge may not.
 */
const STORY_SERVICE_MATCHERS: readonly Readonly<{ id: string; match: RegExp }>[] = [
  { id: 'facade', match: /facade-composition/ },
  { id: 'frame', match: /frame-system/ },
  { id: 'roof', match: /roof-(?:use|greening)/ },
  { id: 'basement', match: /basement-scope/ },
  { id: 'slab', match: /slab-scope/ },
]

function constructionLines(
  catalogue: KgCatalogue | null,
  decisions: KgDecisions | null,
  buildings: readonly ScopeBuilding[],
  view: ClientView,
  deps: ClientProposalDeps,
): ClientConstruction {
  if (!catalogue || !decisions) return { story: [], detail: [] }
  const nameOf = new Map(buildings.map((b, i) => [b.id, `${buildingMark(i)} · ${b.name}`]))
  const contributions = kgContributions(catalogue, decisions)
  const withoutBasis = kgSelectionsWithoutBasis(catalogue, decisions)

  type Raw = {
    serviceId: string
    label: string
    value: string
    buildingId: string | undefined
    consequence: string | null
    state: ClientCommercialState | null
    stateText: string | null
  }

  const raw: Raw[] = []
  const seen = new Set<string>()

  const push = (serviceId: string,
    state: ClientCommercialState | null, bundleBasis: string | null) => {
    if (seen.has(serviceId)) return
    const service = serviceById(catalogue, serviceId)
    if (!service) return
    const record = serviceDecision(decisions, service)
    const variant = selectedVariant(service, record)
    if (!variant) return
    seen.add(serviceId)
    raw.push({
      serviceId,
      label: view.language === 'en' ? service.labelEn : service.labelDe,
      value: view.language === 'en' ? variant.labelEn : variant.labelDe,
      buildingId: service.buildingId,
      consequence: derivedValue(catalogue, decisions, service, view.language),
      state,
      stateText: state ? commercialStateText(state, deps, bundleBasis) : null,
    })
  }

  for (const c of contributions as readonly KgContribution[]) {
    if (c.group !== 'KG_300') continue
    const service = serviceById(catalogue, c.serviceId)
    if (!service) continue
    // Authority is READ through the released function, never re-derived:
    // the chosen variant's declared authority now outranks the service's own.
    const authority = contributionCostAuthority(service, serviceDecision(decisions, service))
    const state: ClientCommercialState = authority === 'direct'
      ? (c.exact.isZero() ? 'zeroDirect' : 'priced')
      : authority === 'bundle' ? 'bundle'
        : authority === 'indirect' ? 'indirect'
          : authority === 'bauherr' ? 'bauherr'
            : authority === 'noBasis' ? 'noBasis' : 'priced'
    push(c.serviceId, state,
      view.language === 'en' ? c.costBasisEn ?? null : c.costBasisDe ?? null)
  }
  for (const w of withoutBasis as readonly KgSelectionWithoutBasis[]) {
    if (w.group !== 'KG_300') continue
    const state: ClientCommercialState = w.costAuthority === 'bauherr'
      ? 'bauherr'
      : w.costAuthority === 'bundle' ? 'bundle'
        : w.costAuthority === 'indirect' ? 'indirect' : 'noBasis'
    push(w.serviceId, state,
      view.language === 'en' ? w.costBasisEn ?? null : w.costBasisDe ?? null)
  }

  // A suspended decision reads as suspended, not deleted, and never as 0 €.
  for (const entry of raw) {
    const service = serviceById(catalogue, entry.serviceId)
    if (!service) continue
    const root = dependencySuspension(catalogue, decisions, service)
    if (!root) continue
    entry.state = 'noBasis'
    entry.stateText = deps.t('vr3.client.state.suspended', {
      cause: view.language === 'en' ? root.labelEn : root.labelDe,
    })
  }

  /**
   * A concept states ONE line when every building agrees, and one line per
   * building when they do not. That is the whole per-building rule: the
   * client is never told a façade that is false for two of three houses.
   */
  const toLines = (entries: readonly Raw[]): ClientConstructionLine[] => {
    const byLabel = new Map<string, Raw[]>()
    for (const e of entries) {
      const bucket = byLabel.get(e.label)
      if (bucket) bucket.push(e)
      else byLabel.set(e.label, [e])
    }
    const out: ClientConstructionLine[] = []
    for (const [label, bucket] of byLabel) {
      const values = new Set(bucket.map((e) => e.value))
      if (values.size === 1 || bucket.length === 1) {
        const first = bucket[0]!
        out.push({
          id: first.serviceId, label, value: first.value,
          buildingName: null, consequence: first.consequence,
          state: first.state, stateText: first.stateText,
        })
        continue
      }
      for (const e of bucket) {
        out.push({
          id: e.serviceId, label, value: e.value,
          buildingName: (e.buildingId && nameOf.get(e.buildingId)) ?? null,
          consequence: e.consequence, state: e.state, stateText: e.stateText,
        })
      }
    }
    return out
  }

  const isStory = (serviceId: string) =>
    STORY_SERVICE_MATCHERS.some((m) => m.match.test(serviceId))

  return {
    story: toLines(raw.filter((e) => isStory(e.serviceId))),
    detail: toLines(raw.filter((e) => !isStory(e.serviceId))),
  }
}

/* ────────────────────────────── the builder ──────────────────────────── */

/**
 * Build the whole client-safe proposal for one profile.
 *
 * Called ONCE per render by the shell (live) and once by the document
 * (print). Both readings are this function, which is the point.
 */
export function clientProposal(
  s: Store,
  view: ClientView,
  profile: ClientOutputProfile,
  deps: ClientProposalDeps,
  project: PortfolioProject | null,
): ClientProposal {
  const { t, tx } = deps
  const language = view.language
  const config = view.presented.config
  const result: CommercialResult = view.presented.result
  const projection = view.presented.projection
  const buildings = selectedBuildingsOf(view)

  /**
   * ONE catalogue reading for the whole client surface.
   *
   * `kgCatalogueFor` is the only door that resolves per-building
   * applicability; a caller that reads `kgCatalogue` directly, or hands a
   * narrow `Pick` without `scopeBuildings`, silently gets the STATIC
   * catalogue. Two client surfaces used to do exactly that, so the scope
   * chapter and the print sheet saw every decision as applicable while the
   * presenter's what-ifs saw a resolved one. That is fixed here, once.
   */
  const catalogue = kgCatalogueFor({ ...s, scopeBuildings: config.scopeBuildings })
  const decisions = config.kgConfig

  /* ---- identity ---- */

  const heroAsset = view.projectHeroAssetId ? projectAsset(view.projectHeroAssetId) : null
  const identity: ClientIdentity = {
    projectName: view.projectName,
    clientName: project?.client ?? null,
    // Composed at runtime from the Product's own fields. A literal postal
    // line in source is refused by the repository's PII gate, and rightly.
    addressLine: project
      ? `${project.countryCode} · ${project.postcode} ${project.city} · ${project.addressLine}`
      : null,
    offerDateISO: view.savedVersion?.savedAt ?? null,
    optionName: view.optionName,
    legalEntity: t('vr3.client.legalEntity'),
    hero: heroAsset,
    heroAlt: heroAsset ? t(heroAsset.altKey) : null,
  }

  /* ---- commercial ---- */

  const composition = commercialComposition(result)
  const responsibility = responsibilityFor({
    responsibility: config.responsibility,
    opportunityId: s.opportunityId,
    scopeBuildings: config.scopeBuildings,
  } as Parameters<typeof responsibilityFor>[0])

  const compositionRows: ClientCompositionRow[] = composition.rows.map((row) => {
    const state = compositionState(row)
    const scopeGroup = (KG_SCOPE_GROUPS as readonly string[]).includes(row.group)
      ? row.group as KgScopeGroup
      : null
    const chapter = catalogue && scopeGroup ? chapterOf(catalogue, scopeGroup) : null
    return {
      group: row.group,
      number: KG_NUMBER[row.group] ?? row.group.replace('_', ' '),
      title: chapter
        ? (language === 'en' ? chapter.titleEn : chapter.titleDe)
        : t(`costGroup.${row.group}`),
      state,
      exact: row.exact,
      stateText: commercialStateText(state, deps),
      // All3 vs Bauherr is asserted only where a released record owns it.
      // Absence from All3 scope is NOT evidence of who is responsible.
      responsibility: state === 'priced' || state === 'zeroDirect' ? 'all3' : null,
    }
  })

  const commercial: ClientCommercial = {
    signature: tx(result.totalLabel),
    totalExact: result.total.exact,
    totalDisplay: result.total.display,
    totalPrefix: result.total.prefix,
    totalDisclosure: result.total.disclosure ? tx(result.total.disclosure) : null,
    coverage: result.coverage,
    uncertaintyPp: result.uncertaintyPp,
    leadRate: result.leadRate,
    leadRateText: rateUnit(result.leadRate),
    // The denominator belongs IN the metric label and names its norm.
    leadRateLabel: `${t('vr3.client.investment.leadRate')} · ${result.leadRate.denominatorLabel}`,
    leadDenominatorText: (() => {
      const value = result.leadRate.denominator
      if (!value.isFinite() || value.lessThanOrEqualTo(0)) return null
      const numeral = areaText(value.toFixed(2), language)
      if (numeral === null) return null
      // An area names its unit; a count of units does not.
      return result.leadRate.denominatorKind === 'area'
        ? `${numeral}${NNBSP}m²`
        : numeral
    })(),
    taxNote: t('vr3.client.tax.net'),
    composition: compositionRows,
  }

  /* ---- buildings ---- */

  const clientBuildings: ClientBuilding[] = buildings.map((b, index) => {
    const asset = projectAsset(b.identityAssetId)
    const hasBasement = b.undergroundLevel !== 'none'
    return {
      id: b.id,
      mark: buildingMark(index),
      name: b.name,
      usage: t(b.usageKey),
      storeys: t(b.storeysKey),
      units: (() => {
        const raw = scopeMetricValue(config, b, 'units')
        return raw === null ? null : Number(raw)
      })(),
      bgfRSAbove: areaText(scopeMetricValue(config, b, 'bgfRSAbove'), language),
      bgfRAbove: areaText(scopeMetricValue(config, b, 'bgfRAbove'), language),
      bgfSAbove: areaText(scopeMetricValue(config, b, 'bgfSAbove'), language),
      bgfRSBelow: areaText(scopeMetricValue(config, b, 'bgfRSBelow'), language),
      wfl: areaText(scopeMetricValue(config, b, 'wfl'), language),
      nuf: areaText(scopeMetricValue(config, b, 'nuf'), language),
      hasBasement,
      basementText: t(hasBasement
        ? 'vr3.client.buildings.basement.present'
        : 'vr3.client.buildings.basement.none'),
      identity: asset,
      identityAlt: asset ? t(asset.altKey) : null,
    }
  })

  /* ---- overview metrics (Chapter 2 supporting facts) ---- */

  const totalUnits = clientBuildings.reduce(
    (sum, b) => (b.units === null ? sum : sum + b.units), 0)
  const energy = buildings
    .map((b) => config.buildings[b.id]?.energiestandard)
    .find((e) => e !== undefined) ?? null

  const overview: ClientMetric[] = []
  if (energy) {
    overview.push({
      id: 'energy',
      label: t('vr3.client.overview.energy'),
      // Text only — D-25 bars the badge.
      value: tx(String(energy)),
      unit: null,
      note: t('vr3.client.overview.energyNote'),
    })
  }
  overview.push({
    id: 'project',
    label: t('vr3.client.overview.project'),
    value: totalUnits > 0
      ? t('vr3.client.overview.buildingsUnits', {
        buildings: clientBuildings.length, units: totalUnits,
      })
      : t('vr3.client.overview.buildingsOnly', { buildings: clientBuildings.length }),
    unit: null,
    note: null,
  })

  /* ---- scope ---- */

  const scopeRows: ClientScopeRow[] = KG_SCOPE_GROUPS.map((group) => {
    const chapter = catalogue ? chapterOf(catalogue, group) : null
    const decision = decisions?.scope[group] ?? 'undecided'
    return {
      group,
      title: chapter
        ? (language === 'en' ? chapter.titleEn : chapter.titleDe)
        : group.replace('_', ' '),
      decision,
      // `undecided` used to be dropped by both consumers. A dropped row is
      // an invisible commercial gap, so it now renders truthfully.
      stateText: t(decision === 'included'
        ? 'vr3.client.scope.state.included'
        : decision === 'excluded'
          ? 'vr3.client.scope.state.excluded'
          : 'vr3.client.scope.state.undecided'),
    }
  })

  const construction = constructionLines(catalogue, decisions, buildings, view, deps)

  /**
   * The three scope groups the client reads (ACCEPT-06).
   *
   * `considered` used to be derived from the chapter 2 overview metrics that
   * carry a note — in practice the energy standard alone, so on a project
   * that declares none the group was empty and the chapter rendered two of
   * three groups with a third of the stage blank.
   *
   * The distinction the three groups actually carry is the one the released
   * catalogue already makes. `KG 200` (vorbereitende Maßnahmen) and `KG 700`
   * (Baunebenkosten — planning, site management, verification) are what an
   * offer takes into account IN PRINCIPLE; `KG 300`–`KG 600` are the
   * physical system All3 builds. A decided group lands in one of those two
   * by its own identity; an undecided or excluded one is stated as not
   * included, because a scope gap a client cannot read is the one that
   * becomes a dispute. Nothing here is authored: every line is a released
   * catalogue title or a construction answer the configurator recorded.
   */
  const CONSIDERED_IN_PRINCIPLE: readonly KgScopeGroup[] = ['KG_200', 'KG_700']
  const consideredItems: ClientScopeItem[] = []
  const includedItems: ClientScopeItem[] = []
  const excludedItems: ClientScopeItem[] = []
  for (const row of scopeRows) {
    const item: ClientScopeItem = { id: row.group, text: row.title, buildingName: null }
    if (row.decision !== 'included') excludedItems.push(item)
    else if (CONSIDERED_IN_PRINCIPLE.includes(row.group)) consideredItems.push(item)
    else includedItems.push(item)
  }
  // The energy target is a quality the whole offer is measured against, not
  // a position — it belongs with what is taken into account in principle.
  for (const metric of overview) {
    if (metric.note === null) continue
    consideredItems.push({
      id: `overview:${metric.label}`,
      text: `${metric.label}: ${metric.value}`,
      buildingName: null,
    })
  }
  for (const line of construction.story) {
    const item: ClientScopeItem = {
      id: `c:${line.id}`,
      text: `${line.label}: ${line.value}`,
      buildingName: line.buildingName,
    }
    if (line.state === 'bauherr' || line.state === 'excluded') excludedItems.push(item)
    else includedItems.push(item)
  }

  const scope: ClientScope = {
    rows: scopeRows,
    boundary: responsibility
      ? (language === 'en'
        ? responsibility.scopeBoundary.summaryEn
        : responsibility.scopeBoundary.summaryDe)
      : null,
    groups: {
      considered: consideredItems,
      included: includedItems,
      excluded: excludedItems,
    },
  }

  /* ---- responsibility ---- */

  const mediumOf = (m: ResponsibilityProjection['media'][number]): ClientResponsibilityMedium => ({
    id: m.id,
    label: language === 'en' ? m.labelEn : m.labelDe,
    clientText: language === 'en' ? m.clientEn : m.clientDe,
    all3From: language === 'en' ? m.all3FromEn : m.all3FromDe,
    attention: m.status === 'attention',
  })

  const clientResponsibility: ClientResponsibility | null = responsibility
    ? {
      boundary: language === 'en'
        ? responsibility.scopeBoundary.scopeEn
        : responsibility.scopeBoundary.scopeDe,
      handover: language === 'en'
        ? responsibility.scopeBoundary.handoverEn
        : responsibility.scopeBoundary.handoverDe,
      media: responsibility.media.map(mediumOf),
      unresolved: responsibility.unresolved.map(mediumOf),
    }
    : null

  /* ---- schedule ---- */

  const derivation: ScheduleDerivation | null = clientScheduleDerivation(s, view.presented)
  const phases: readonly SchedulePhase[] = clientSchedulePhases(s, view.presented)
  // A phase has a KIND, not a label: the client-facing name of a phase is
  // Product copy, one key per kind, shared with the printed sheet.
  const phaseLabel = (phase: SchedulePhase) =>
    t(`vr3.client.schedule.phase.${phase.kind}`)
  const critical = derivation ? scheduleCriticalPhase(derivation) : null
  void phases

  /**
   * ONE client-safe duration authority (ACCEPT-02).
   *
   * The Bauzeit and the completion date must be two readings of the SAME
   * released derivation, or the client is handed a duration that does not
   * reach the date printed beside it. This surface used to take the months
   * from `projection.duration` (the proposal projection: 7,5) and the date
   * from `ScheduleDerivation` (30.09.2028) — a start plus 7,5 months lands
   * nowhere near that date, and the Gantt drawn underneath ran to month 19.
   * The internal cockpit states `Gesamtdauer 18,5 Monate · abgeleitet aus
   * den Phasen` for the same Option, which is also what rule 39 requires of
   * a complex: `max(start + dauer)`, never a sum and never a second engine.
   *
   * So when the derivation exists the client reads the derivation — months,
   * completion date and phase windows alike. `projection.duration` remains
   * the fallback for an Option whose phases cannot be placed, and nothing
   * about either calculation changes: this is which released authority the
   * client consumes, not a new number.
   *
   * The numeral is German here and re-typeset by the caller's
   * `localizeMoneyText`; the UNIT is Product copy with a row per language.
   * Half months print one decimal, whole months none — the same rule the
   * internal schedule stage applies to every phase it shows.
   */
  const derivedHalfMonths = derivation?.totalHalfMonths ?? null
  const derivedMonths = derivation?.totalMonths ?? null
  const derivedDurationNumeral = derivedHalfMonths !== null && derivedMonths !== null
    ? formatDE(derivedMonths, derivedHalfMonths % 2 === 0 ? 0 : 1)
    : null
  const durationMonths = derivedDurationNumeral
    ?? projection.duration.display.replace(/[\s\u202f\u00a0]*Monate$/, '')
  const schedule: ClientSchedule = {
    durationText: t('vr3.client.schedule.durationValue', { months: durationMonths }),
    // A derived duration is exact half months, so it carries no `≈`.
    durationPrefix: derivedDurationNumeral !== null ? '' : projection.duration.prefix,
    // The internal cockpit's own word. One boundary, one name.
    startBoundary: t('vr3.client.schedule.boundary'),
    startISO: derivation?.startISO ?? null,
    completionISO: derivation?.completionISO ?? projection.duration.completionDate ?? null,
    phases: (derivation?.windows ?? []).map((w) => ({
      id: w.phase.id,
      label: phaseLabel(w.phase),
      startISO: w.startISO,
      endISO: w.endISO,
      durationText: t('vr3.client.schedule.months', {
        months: w.durationMonths.toFixed(1),
      }),
    })),
    criticalPhaseLabel: critical ? phaseLabel(critical.phase) : null,
  }

  /* ---- media ---- */

  const mediaItems: ClientMediaItem[] = []
  for (const b of clientBuildings) {
    if (!b.identity) continue
    mediaItems.push({
      id: b.id,
      asset: b.identity,
      alt: b.identityAlt ?? b.name,
      caption: `${b.mark} · ${b.name}`,
      context: b.usage,
    })
  }
  const media: ClientMedia = {
    lead: mediaItems[0] ?? (heroAsset
      ? {
        id: 'hero', asset: heroAsset, alt: identity.heroAlt ?? view.projectName,
        caption: view.projectName, context: null,
      }
      : null),
    supporting: mediaItems.slice(1),
    buildingFilters: clientBuildings.length > 1
      ? clientBuildings.map((b) => ({ id: b.id, label: `${b.mark} · ${b.name}` }))
      : [],
  }

  /* ---- assumptions ---- */

  const openPoints = (clientResponsibility?.unresolved ?? [])
    .map((m) => `${m.label} — ${m.clientText}`)
  const assumptions: ClientAssumptions = {
    offer: [
      t('vr3.client.assumptions.indicative'),
      t('vr3.client.assumptions.fitFor'),
      t('vr3.client.assumptions.uncertainty', { pp: result.uncertaintyPp }),
    ],
    basis: [
      t('vr3.client.assumptions.areas', {
        denominator: result.leadRate.denominatorLabel,
      }),
      ...(identity.offerDateISO
        ? [t('vr3.client.assumptions.asOf')]
        : []),
      ...(scope.boundary ? [scope.boundary] : []),
    ],
    open: openPoints,
  }

  /* ---- drivers + Regionalfaktor ---- */

  const clientDrivers = projectDriversForClient(
    result.contributions, 'praesentation', config.kg800ClientRevealed)
  const factor = regionalFactorPresentation(result)
  /**
   * DC-44: at most five drivers, as a client reads them. The engine's list is
   * per building and per service (a three-building Option names the same
   * façade three times), so rows with the same client label are summed
   * first, a zero row is dropped (a client never reads `0 €` as a driver),
   * the five largest are named and everything else is ONE remainder row —
   * so the rows still reconcile exactly to the basis (rule 35, unit-tested).
   */
  const basis = clientDrivers.reduce((sum, d) => sum.plus(d.exact), new Decimal(0))
  const byLabel = new Map<string, Decimal>()
  for (const d of clientDrivers) {
    const label = translatedDriverLabel(d, t, language)
    byLabel.set(label, (byLabel.get(label) ?? new Decimal(0)).plus(d.exact))
  }
  const ranked = [...byLabel.entries()]
    .filter(([, exact]) => !exact.isZero())
    .sort((a, b) => b[1].abs().comparedTo(a[1].abs()))
  const named = ranked.slice(0, CLIENT_DRIVER_LIMIT)
  const rest = ranked.slice(CLIENT_DRIVER_LIMIT)
    .reduce((sum, [, exact]) => sum.plus(exact), new Decimal(0))
  const driverRows: ClientDriverRow[] = named.map(([label, exact]) => ({
    key: label, label, exact,
  }))
  if (!rest.isZero()) {
    driverRows.push({ key: 'rest', label: t('vr3.client.price.driverRest'), exact: rest })
  }
  const drivers: ClientDrivers = {
    rows: driverRows,
    sumExact: basis,
    regionalFactor: {
      active: factor.active,
      effect: factor.effect,
      // The row exists in EVERY client output, in either state. When the
      // factor is off it names the amount it WOULD add — never a
      // manufactured value, and never silence.
      text: t(factor.active
        ? 'vr3.client.regionalFactor.active'
        : 'vr3.client.regionalFactor.inactive'),
    },
  }

  /* ---- artefacts (by reference — no second document repository) ---- */

  const attachments = new Set(s.offerDraft.attachments)
  const artefacts: ClientArtefact[] = OFFER_ARTIFACTS
    .filter((a) => attachments.has(a.id))
    .map((a) => ({ id: a.id, title: t(`presentation.artifact.title.${a.id}`) }))

  /* ---- conditional chapters ---- */

  const chapters = CLIENT_CHAPTERS.filter((id) => {
    // Chapter 4 exists only when there is more than one building to compare.
    if (id === 'gebaeude') return clientBuildings.length >= 2
    // No qualifying media ⇒ the chapter is ABSENT, never a placeholder.
    if (id === 'architektur') return media.lead !== null && mediaItems.length > 0
    return true
  })

  return {
    profile,
    language,
    chapters,
    identity,
    overview,
    commercial,
    buildings: clientBuildings,
    construction,
    scope,
    responsibility: clientResponsibility,
    schedule,
    media,
    assumptions,
    drivers,
    artefacts,
  }
}
