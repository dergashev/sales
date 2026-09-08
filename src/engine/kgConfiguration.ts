import Decimal from 'decimal.js'
import catalogueFixture from '../fixtures/kg-configuration.json'
import type { CostAuthority, CostGroup, Driver } from './calculate'
import type { ResponsibilityCatalogue } from './responsibility'

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
  /**
   * This alternative has NO cost option of its own (VR3-TGA-01).
   *
   * Measured in the source: 3 of the 5 heat generators carry no cost option
   * at all, and 92.7 % of option rows carry none. Such an alternative must
   * say `keine gesonderte Preisgrundlage` — never `± 0 €`, which is a
   * positive claim that two options cost the same, and never a blank.
   *
   * Its `delta` stays `0.00` because the product has no basis on which to
   * move the total, not because it knows the total does not move. Those are
   * different statements and only one of them is true here.
   */
  noPriceBasis?: boolean
  /**
   * Priced, but inside another position — which one is named in the label
   * the UI shows. `delta` is `0.00` for the same reason as above.
   */
  bundled?: boolean
  /**
   * The ONE differentiator an option card shows under the solution name
   * (VR3-TGA-UX-00). `label` stays the human name and the journal's word for
   * the choice; a technical qualifier that used to share the label now has
   * its own slot, so the primary copy is a name and the secondary copy is a
   * distinction. Absent where the name already distinguishes.
   */
  detailDe?: string
  detailEn?: string
  /**
   * VR3-KG-UNIFY-00 — the authority of THIS alternative, where it differs
   * from the decision's. A basement scope decision carries one directly
   * priced position and one alternative that is the Bauherr's; naming the
   * authority on the variant keeps that a fixture fact, not a component's
   * guess. Absent ⇒ `bundled` / `noPriceBasis` / the service's own.
   */
  costAuthority?: KgCostAuthority
  /**
   * Choosing this alternative REMOVES the position from the All3 offer.
   *
   * `Nicht im All3-Leistungsumfang` is a legitimate answer to a scope
   * decision, and it is neither `notSelected` (the decision IS answered) nor
   * a priced variant with a negative delta (which would put a `direct` zero
   * into the drivers and `± 0 €` into the rail — QA-01). The contribution
   * is `null`, the phrase is the variant's own authority (`bauherr` when the
   * owner is confirmed, `noBasis` while it is open), and the offer states
   * the exclusion in words (`offerNote`).
   */
  excludesPosition?: boolean
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
  /**
   * VR3-KG-UNIFY-00 — the upstream may hold ANY of these. A timber colour
   * family exists under two of the five façade compositions (full timber and
   * rendered-ground-floor-timber-above); one `requiresVariant` cannot say so,
   * and two dependencies cannot either. Same semantics as `requiresVariant`
   * for blocking and suspension.
   */
  requiresVariantIn?: readonly string[]
  requiresSelected?: boolean
  appliesToVariants?: readonly string[]
}>

export type KgServiceAuthority = 'sourceEvidenced' | 'derived' | 'assumed'

/* ── VR3-TGA-01 · the decision layer ───────────────────────────────────── */

/**
 * WHAT A EURO IS ALLOWED TO MEAN (audit `tga-cost-authority-map.md`).
 *
 * Measured, not assumed: **15 of 206** source option rows carry any cost
 * option at all. 92.7 % of them carry none — so "no separate price basis" is
 * the NORMAL state of a TGA decision, and the interface has to be able to say
 * it without lying.
 *
 * `± 0 €` may only ever mean *measurably the same price as the baseline
 * choice*. It may never stand for "excluded", "unknown" or "we have no basis
 * for this": those are three different statements and the product used to
 * print the same thing for all of them.
 */
/**
 * VR3-COST-00: the union itself MOVED to `calculate.ts` as `CostAuthority`,
 * beside the `Driver` shape that now carries it across the engine boundary.
 * The name published here is kept verbatim — TGA's own surfaces, tests and
 * fixtures all read it — but there is exactly ONE declaration, so the
 * commercial cockpit and the TGA chapter can never coin a seventh state
 * between them. Values are still produced here (`costAuthorityOf`).
 */
export type KgCostAuthority = CostAuthority

/**
 * Applicability is a STATEMENT WITH A CAUSE, never an option named `Keine …`.
 *
 * The audit is explicit: `Keine Tiefgaragenlüftung` is not an engineering
 * alternative a salesperson chooses, it is a consequence of the project
 * having no underground garage. Offering it as a choice invites a decision
 * nobody is entitled to make and hides the real reason.
 */
export type KgApplicability = Readonly<{
  state: 'notApplicable' | 'partial'
  reasonDe: string
  reasonEn: string
}>

/**
 * VR3-KG-UNIFY-00 — applicability that FOLLOWS THE BUILDING, live.
 *
 * `applicability` above is a statement the catalogue makes. A basement scope
 * decision is different: whether it exists is a property of the Building the
 * Option confirmed (`ScopeBuilding.undergroundLevel`), and the catalogue must
 * not assert it twice. So the service declares WHICH building fact governs
 * it and which values keep it alive; `withBuildingApplicability` resolves the
 * declaration against the Option's buildings and writes the derived
 * `applicability` — with the reason the declaration carries — before any
 * selector sees the catalogue. A catalogue that reaches a selector without
 * being resolved keeps whatever static applicability it declared, so the pure
 * engine and its tests read the same shape either way.
 */
export type KgBuildingCondition = Readonly<{
  fact: 'undergroundLevel'
  oneOf: readonly string[]
  reasonDe: string
  reasonEn: string
}>

/** The building facts the condition may read — a projection of `ScopeBuilding`. */
export type KgBuildingFacts = Readonly<{
  id: string
  undergroundLevel: string
}>

/**
 * A valid alternative that is NOT available here, shown with its reason.
 *
 * Shown, not hidden and not merely `disabled`: a salesperson asked "why can't
 * I offer window ventilation?" needs the answer on the row, and a bare
 * disabled radio answers nothing. The reason travels into the accessible name
 * so it is not a sighted-only affordance.
 */
export type KgBlockedVariant = Readonly<{
  value: string
  reasonDe: string
  reasonEn: string
}>

/**
 * One row of a value set INSIDE a single decision (frames T-03, T-06, T-08).
 *
 * The audit's multi-building rule in one type: three buildings produce three
 * values inside ONE decision, never nine near-identical rows, and the building
 * name appears once. The same shape carries the per-medium responsibility set
 * of `Hausanschlüsse`, which is why the label is not assumed to be a building.
 */
export type KgValueRow = Readonly<{
  /** A building this value belongs to; its name is resolved from Option state. */
  buildingId?: string
  /** Used when the row is not a building — a medium, a capacity, a model. */
  labelDe?: string
  labelEn?: string
  valueDe: string
  valueEn: string
  /**
   * A decimal money string this row contributes, formatted by the UI.
   *
   * NOT pre-formatted copy. A fixture that writes `520.000 €` is a second
   * formatter — it decides the thousands separator, the currency position and
   * the number/unit separator for a locale it cannot see, and rule 7's narrow
   * no-break space is exactly the kind of thing it gets wrong.
   */
  amount?: string
  /** A word where an amount would be a lie: `abgeleitet`, `im Bündel`. */
  noteDe?: string
  noteEn?: string
  /** A resolved/unresolved interface, never colour alone. */
  status?: 'ok' | 'attention'
  notApplicable?: boolean
}>

/**
 * WHAT THE CLIENT DOCUMENTS SAID — kept separate from what All3 proposes.
 *
 * The heart of the chapter. Changing the proposal must never overwrite this,
 * because it is EVIDENCE, not a default: it is what the salesperson compares
 * against when the client asks "why is this different from what we sent you".
 */
export type KgSourceBaseline = Readonly<{
  /** The documented value, or absent when the source does not specify it. */
  valueDe?: string
  valueEn?: string
  /** Which variant of this decision the source value corresponds to. */
  variant?: string
  /** `03_Energiekonzept.pdf · S. 12`, a Project fact, or who entered it. */
  originDe: string
  originEn: string
}>

/** A cross-system rule stated ONCE and referenced, never restated. */
export type KgSystemRule = Readonly<{
  id: string
  titleDe: string
  titleEn: string
  bodyDe: string
  bodyEn: string
  /** The consequence, when there is one beyond the statement itself. */
  noteDe?: string
  noteEn?: string
  sourceDe: string
  sourceEn: string
}>

/**
 * One line of the Rahmen band: a condition everything below depends on.
 *
 * NOT a system and NOT a second configuration form. Three of the four are
 * read-only context; only `Energieziel` is a decision, and it says so by
 * carrying `editServiceId`.
 */
export type KgRahmenEntry = Readonly<{
  id: string
  labelDe: string
  labelEn: string
  valueDe: string
  valueEn: string
  /** `Förderziel · Annahme`, `aus Bauantragsdatum abgeleitet`. */
  metaDe: string
  metaEn: string
  /** Present only where the Rahmen line is genuinely editable. */
  editServiceId?: string
  /**
   * The value comes from live Option state, not from the fixture.
   *
   * `buildingScope` exists because the building set is the Option's, not the
   * catalogue's: writing "1 Gebäude · Lindenhof" into a fixture would be the
   * chapter asserting a building scope instead of reading the one the user
   * confirmed — the very class of defect that made KG 400 unbuildable in the
   * first place. VR3-TGA-UX-00 adds two of the same kind: `sourceDocuments`
   * (the project baseline's document count) and `responsibility` (the scope
   * boundary, read from the Option's responsibility owner and never authored
   * twice).
   */
  derive?: 'buildingScope' | 'sourceDocuments' | 'responsibility'
  /**
   * The formal statement BEHIND the value, disclosed on demand — the
   * statutory minimum behind the funding target. The band shows orientation;
   * the regulation waits in the entry's evidence disclosure.
   */
  basisDe?: string
  basisEn?: string
}>

/** The Bemusterung boundary: stated once, at the foot. Never a ninth system. */
export type KgBemusterungBoundary = Readonly<{
  titleDe: string
  titleEn: string
  bodyDe: string
  bodyEn: string
  decidedHeadingDe: string
  decidedHeadingEn: string
  deferredHeadingDe: string
  deferredHeadingEn: string
  rows: ReadonlyArray<Readonly<{
    decidedDe: string
    decidedEn: string
    deferredDe: string
    deferredEn: string
  }>>
}>

/**
 * An OPTION-LEVEL scope-decision axis (B2, Product Owner requirement 14).
 *
 * Energy efficiency, QNG and DGNB are not late KG answers. They are scope
 * decisions the whole Option is prepared under: KG 300, KG 400, the cost
 * detail, the exports and the client projection all READ them, and the audit
 * found them editable in two different cost chapters instead — the Energy
 * target inside KG 400 and both certifications inside KG 700 — which is a
 * decision configured where its consequences land rather than where it is
 * taken.
 *
 * The axis is DECLARED BY THE DATA and never inferred from a service id.
 * Two catalogues already carry two ids for the same axis (`a-400-es` and
 * `b-400-es`), a third project would carry a third, and the private
 * `ENERGY_STANDARD_SERVICE_IDS` set this marker replaces was exactly the
 * "bridge derived from a string" its own comment warned about. A service
 * that declares an axis is edited ONCE, in Configure · Scope decisions; its
 * cost chapter shows the value it must live with and the route back to the
 * decision.
 */
export type KgScopeAxis = 'energy' | 'qng' | 'dgnb'

export type KgService = Readonly<{
  id: string
  labelDe: string
  labelEn: string
  summaryDe: string
  summaryEn: string
  /**
   * The Option-level axis this service IS, when it is one. Absent for every
   * ordinary cost decision, which is the overwhelming majority — an absent
   * marker means "configured in its own cost chapter", the released
   * behaviour, unchanged.
   */
  scopeAxis?: KgScopeAxis
  /** Base amount. For `singleChoice` this is 0 and the variant carries the effect. */
  amount: string
  baseline: 'selected' | 'notSelected'
  /** The domain demands an explicit answer; there is no safe default. */
  requiresDecision: boolean
  kind: KgServiceKind
  authority: KgServiceAuthority
  buildingId?: string
  dependsOn?: KgServiceDependency

  /* ── VR3-TGA-01 · optional decision layer ────────────────────────────
   * Every field below is optional BY DESIGN. A KG chapter that declares
   * none of them renders exactly as it did before, which is what lets one
   * composition serve all six chapters without a `switch (group)`. */

  /** What the client documentation says. Never overwritten by a proposal. */
  source?: KgSourceBaseline
  /** Which variant is the All3 standard — a marker, not a selection. */
  all3Standard?: string
  /** Why this decision exists and what it determines, in the user's terms. */
  whyDe?: string
  whyEn?: string
  /** The Option-scope statement: `gilt für 1 Gebäude`, `je Gebäude`. */
  scopeDe?: string
  scopeEn?: string
  /** What a euro is allowed to mean here. Absent ⇒ the released behaviour. */
  costAuthority?: KgCostAuthority
  /** Names the bundle when `costAuthority` is `bundle`. */
  costBasisDe?: string
  costBasisEn?: string
  /**
   * BLOCKED PRICING — what is preventing a price, in the user's terms.
   *
   * `costAuthority: 'noBasis'` says only that no euro may be asserted. For
   * a decision the catalogue itself calls a material cost driver that is
   * not enough: the absence of a number reads as "this choice is free"
   * unless the CONDITION is named. `Tragsystem Balkone` is the case that
   * forced this field — three alternatives, all `noPriceBasis`, a `whyDe`
   * beginning `Ein wesentlicher Kostentreiber`, and an option card that
   * said `keine Preiswirkung`.
   *
   * A required decision with `noBasis` authority MUST declare it; the
   * fixture generator refuses to build one that does not
   * (`prove_choice_integrity`, `tools/build_kg_fixture.py`).
   */
  pricingConditionDe?: string
  pricingConditionEn?: string
  /** Not applicable, with its cause. Renders a statement, never a control. */
  applicability?: KgApplicability
  /** Valid-but-unavailable alternatives, shown with their reason. */
  blockedVariants?: readonly KgBlockedVariant[]
  /** A value set inside ONE decision (T-03/T-06/T-08), never n rows. */
  valueRows?: readonly KgValueRow[]
  /** What the Offer will say, and where. Client-safe. */
  offerNoteDe?: string
  offerNoteEn?: string
  /** Renders in the Rahmen band instead of inside a system. */
  surface?: 'rahmen'
  /** References a cross-system rule declared once on the chapter. */
  ruleId?: string

  /* ── VR3-KG-UNIFY-00 · the construction configurator ────────────────── */

  /**
   * The two answers of an `includeExclude` SCOPE decision, in the domain's
   * own words: `Im All3-Leistungsumfang` / `Nicht im All3-Leistungsumfang`.
   * The generic `Enthalten` / `Nicht enthalten` remains the fallback.
   */
  includeLabelDe?: string
  includeLabelEn?: string
  excludeLabelDe?: string
  excludeLabelEn?: string
  /**
   * What the row says about money once the position is EXCLUDED. Exclusion
   * is never `0 €` and is not automatically `Bauseits`: until responsibility
   * is confirmed it reads `nicht im All3-Angebot · Verantwortung offen`.
   */
  excludedPhraseDe?: string
  excludedPhraseEn?: string
  /** Applicability derived from the Option's Building at read time. */
  appliesWhen?: KgBuildingCondition
  /**
   * A READ-ONLY value derived from other decisions of the chapter.
   *
   * The roof requirement follows from access AND greening; the window
   * requirement profile follows from format and operable share. `from` names
   * the governing decisions in order, `byValues` maps their joined variant
   * values (`OCCUPIED|GREEN`) to the sentence, and the fallback answers when
   * a governor is unanswered. Nothing here is a price.
   */
  derived?: Readonly<{
    from: readonly string[]
    byValues: Readonly<Record<string, Readonly<{ valueDe: string; valueEn: string }>>>
    fallbackDe: string
    fallbackEn: string
  }>
}>

export type KgServiceGroup = Readonly<{
  id: string
  labelDe: string
  labelEn: string
  services: readonly KgService[]

  /* ── VR3-TGA-01 · the group becomes a SYSTEM ROW ─────────────────────
   * The overview answers, at a glance: what is proposed, what is still
   * open, what scope it applies to, and what its commercial state is. */

  /** `Luft/Wasser-Wärmepumpe · Fußbodenheizung · fernauslesbarer Zähler`. */
  summaryDe?: string
  summaryEn?: string
  /** `gilt für 1 Gebäude`, `gemeinsame Anlage · Verteilung je Gebäude`. */
  scopeDe?: string
  scopeEn?: string
  /** Not applicable / partially applicable, with its cause. */
  applicability?: KgApplicability
  /** The system's commercial state when no amount is rendered. */
  costAuthority?: KgCostAuthority
  /**
   * The decision whose answer governs how this system READS in the overview.
   *
   * The two sentences above are the row's whole content at a glance, and a
   * frozen sentence describing a shared plant survives the user choosing one
   * plant per building — an overview stating a configuration that is no
   * longer the configuration. The baseline variant is deliberately absent
   * from `byVariant`: it falls back to the editorial sentences above, so the
   * default state renders exactly as it always did.
   */
  governedBy?: string
  byVariant?: Readonly<Record<string, Readonly<{
    summaryDe: string
    summaryEn: string
    scopeDe?: string
    scopeEn?: string
  }>>>
  /**
   * VR3-KG-UNIFY-00 — the key of this system's pictogram in the shared KG
   * visual registry (`src/config/kg-visuals.ts`). Data, never an id parse:
   * `slab`, `site`, `facade`. Absent ⇒ the registry falls back to the
   * group-id suffix KG 400 has always used.
   */
  visual?: string
  /** Applicability derived from the Option's Building at read time (whole row). */
  appliesWhen?: KgBuildingCondition
  /**
   * VR3-KG-UNIFY-00 — the building whose decisions this system row holds.
   *
   * A construction system is decided PER BUILDING. Rather than one row per
   * building per system (three foundations, three façades …) the chapter
   * shows one row per system and the building context chooses which
   * building's rows are live. A group with no `buildingId` is shared by the
   * Option and is shown under every building.
   */
  buildingId?: string
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
  /**
   * VR3-KG-UNIFY-00 — the Sales QUESTION this chapter answers, as its lede:
   * `Welche Baukonstruktionslösung schlagen wir für diese Option vor?`.
   * Every KG chapter carries one; the dictionary's TGA sentence is the
   * fallback for a catalogue that declares none.
   */
  questionDe?: string
  questionEn?: string

  /* ── VR3-TGA-01 · chapter-level composition ──────────────────────────
   * Declared by the chapter, so a chapter that declares neither renders
   * neither — one composition, six chapters, no `switch (group)`. */

  /** The persistent band of cross-cutting conditions above the systems. */
  rahmen?: readonly KgRahmenEntry[]
  /** The later-specification boundary, stated once at the foot. */
  bemusterung?: KgBemusterungBoundary
  /** Cross-system rules, each stated ONCE and referenced by `ruleId`. */
  rules?: readonly KgSystemRule[]
}>

export type KgCatalogue = Readonly<{
  projectId: string
  uncertaintyPercent: string
  declaredNetTotal: string
  declaredByCostGroup: Readonly<Record<KgScopeGroup, string>>
  chapters: readonly KgChapter[]
  /**
   * VR3-TGA-UX-00 — `Schnittstellen & Verantwortung`, the project's own
   * block rather than an eighth KG 400 system. Read by the dedicated
   * Configurator step through `engine/responsibility.ts`; optional as a
   * matter of shape so a catalogue that declares none simply has no step
   * content.
   */
  responsibility?: ResponsibilityCatalogue
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

/* ── VR3-TGA-01 · applicability, surfaces and cost language ────────────── */

/**
 * Does this decision exist for THIS project at all?
 *
 * `notApplicable` is the audit's own word for a decision the project makes
 * moot — no underground garage, no garage ventilation. It is not "excluded"
 * (a commercial choice) and not "undecided" (work outstanding), and conflating
 * it with either is how the product came to count work nobody could do.
 *
 * `partial` still applies, to some buildings: it is applicable, and it says so
 * per building inside the one decision.
 */
export function isApplicable(service: KgService): boolean {
  return service.applicability?.state !== 'notApplicable'
}

/** The decisions a system actually presents — the Rahmen's own are not its. */
export function systemServices(group: KgServiceGroup): readonly KgService[] {
  return group.services.filter((service) => service.surface !== 'rahmen')
}

/** Every service the chapter declares, including the Rahmen's. */
export function chapterServices(chapter: KgChapter): readonly KgService[] {
  return chapter.groups.flatMap((group) => group.services)
}

export function chapterServiceById(
  chapter: KgChapter, id: string,
): KgService | null {
  return chapterServices(chapter).find((service) => service.id === id) ?? null
}

export function chapterRuleById(
  chapter: KgChapter, id: string,
): KgSystemRule | null {
  return chapter.rules?.find((rule) => rule.id === id) ?? null
}

/* ── VR3-KG-UNIFY-00 · building context ────────────────────────────────── */

/**
 * The buildings this chapter decides FOR, in catalogue order — the ids its
 * building-scoped groups and services name. Empty for a chapter that is
 * shared by the whole Option (every KG but the construction chapter today).
 */
export function chapterBuildingIds(chapter: KgChapter): readonly string[] {
  const ids: string[] = []
  for (const group of chapter.groups) {
    for (const id of [group.buildingId, ...group.services.map((s) => s.buildingId)]) {
      if (id && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

/**
 * ONE PAGE, ONE BUILDING AT A TIME.
 *
 * The construction chapter decides per building, but three foundations,
 * three façades and three roofs as nine rows is the overview the audit
 * measured as "cost-code administration". The projection keeps every SHARED
 * group and, of the building-scoped ones, exactly the current building's
 * services and groups — so the rows are one row per system and the building
 * context switches which building's answers they show. Nothing is written
 * and nothing is dropped from the catalogue; a projection is a view.
 *
 * `null` (no building context) returns the chapter unchanged.
 */
export function chapterForBuilding(chapter: KgChapter, buildingId: string | null): KgChapter {
  if (!buildingId) return chapter
  const groups = chapter.groups
    .filter((group) => !group.buildingId || group.buildingId === buildingId)
    .map((group) => ({
      ...group,
      services: group.services.filter((service) =>
        !service.buildingId || service.buildingId === buildingId),
    }))
    .filter((group) => group.services.length > 0)
  return { ...chapter, groups }
}

/**
 * RESOLVE the catalogue's building-derived applicability against the
 * Option's confirmed buildings — the one place `appliesWhen` is read.
 *
 * Returns the same catalogue object when nothing declares a condition, so a
 * memoising caller can rely on identity. Where a condition names a building
 * the Option does not carry, the service keeps its static declaration: an
 * unknown building is not evidence of anything.
 */
export function withBuildingApplicability(
  catalogue: KgCatalogue, buildings: readonly KgBuildingFacts[],
): KgCatalogue {
  const byId = new Map(buildings.map((b) => [b.id, b]))
  let touched = false
  const resolve = <T extends { buildingId?: string; appliesWhen?: KgBuildingCondition; applicability?: KgApplicability }>(
    item: T,
  ): T => {
    const condition = item.appliesWhen
    if (!condition || !item.buildingId) return item
    const building = byId.get(item.buildingId)
    if (!building) return item
    const holds = condition.oneOf.includes(building[condition.fact])
    const derived: KgApplicability | undefined = holds
      ? undefined
      : { state: 'notApplicable', reasonDe: condition.reasonDe, reasonEn: condition.reasonEn }
    const same = (item.applicability?.state === derived?.state)
      && (item.applicability?.reasonDe === derived?.reasonDe)
    if (same) return item
    touched = true
    const { applicability: _dropped, ...rest } = item
    return (derived ? { ...rest, applicability: derived } : rest) as T
  }
  const chapters = catalogue.chapters.map((chapter) => ({
    ...chapter,
    groups: chapter.groups.map((group) => ({
      ...resolve(group),
      services: group.services.map(resolve),
    })),
  }))
  return touched ? { ...catalogue, chapters } : catalogue
}

/**
 * The value of a DERIVED read-only decision, in the reader's language.
 *
 * Looks up the governing decisions' current variants (baseline where none is
 * chosen), joins them with `|` in declared order and reads the sentence the
 * fixture authored for that combination. An unanswered governor, or a
 * combination the fixture does not name, yields the fallback — never a guess.
 */
export function derivedValue(
  catalogue: KgCatalogue, decisions: KgDecisions, service: KgService, language: 'de' | 'en',
): string | null {
  const derived = service.derived
  if (!derived) return null
  const key = derived.from.map((id) => {
    const governor = serviceById(catalogue, id)
    if (!governor || governor.kind.kind !== 'singleChoice') return ''
    const decision = serviceDecision(decisions, governor)
    if (decision.state !== 'selected') return ''
    return decision.variant ?? governor.kind.baselineVariant
  })
  const stated = key.every(Boolean) ? derived.byValues[key.join('|')] : undefined
  if (stated) return language === 'en' ? stated.valueEn : stated.valueDe
  return language === 'en' ? derived.fallbackEn : derived.fallbackDe
}

/**
 * What this decision's euro is allowed to mean.
 *
 * Defaults to `direct` only where the fixture actually carries an amount or a
 * variant delta, and to `none` otherwise — so a chapter that declares no cost
 * authority keeps the behaviour it had, and a TGA row that declares one is
 * held to it.
 */
export function costAuthorityOf(service: KgService): KgCostAuthority {
  if (service.costAuthority) return service.costAuthority
  if (service.kind.kind === 'singleChoice') {
    return service.kind.variants.some((variant) => variant.delta !== '0.00')
      ? 'direct'
      : 'none'
  }
  return new Decimal(service.amount).isZero() ? 'none' : 'direct'
}

/**
 * May a euro amount be rendered for this decision?
 *
 * The audit's binding rule, as a predicate rather than a habit: **no `+ €`
 * without a real cost authority for that exact relationship.** Everything
 * else states its basis in words.
 */
export function rendersAmount(service: KgService): boolean {
  const authority = costAuthorityOf(service)
  return authority === 'direct'
}

/** Why an otherwise valid alternative cannot be chosen here, or `null`. */
export function blockedVariantReason(
  service: KgService, variant: string, en: boolean,
): string | null {
  const blocked = service.blockedVariants?.find((entry) => entry.value === variant)
  if (!blocked) return null
  return en ? blocked.reasonEn : blocked.reasonDe
}

/**
 * Has this decision moved away from what the client documents said?
 *
 * `null` when the source does not specify the decision at all — which is a
 * third state, not a deviation, and the UI says so in its own words.
 */
export function changedFromSource(
  decisions: KgDecisions, service: KgService,
): boolean | null {
  const source = service.source
  if (!source || source.variant === undefined) return null
  const decision = serviceDecision(decisions, service)
  if (decision.state === 'undecided') return null
  const current = decision.variant ?? (
    service.kind.kind === 'singleChoice' ? service.kind.baselineVariant : undefined
  )
  if (current === undefined) return null
  return current !== source.variant
}

/** Every decision in the chapter that now differs from the client source. */
export function proposalChanges(
  catalogue: KgCatalogue, chapter: KgChapter, decisions: KgDecisions,
): readonly KgService[] {
  return chapterServices(chapter).filter((service) =>
    isApplicable(service)
    && dependencySuspension(catalogue, decisions, service) === null
    && changedFromSource(decisions, service) === true)
}

/* ── VR3-TGA-01 · the system overview ──────────────────────────────────── */

/**
 * How this system reads RIGHT NOW — the two overview sentences.
 *
 * Data, never a branch on an id: a group that declares no `governedBy`
 * returns its own sentences unchanged, which is every system but one.
 */
export function systemNarrative(
  catalogue: KgCatalogue, decisions: KgDecisions, group: KgServiceGroup,
): Readonly<{
  summaryDe?: string; summaryEn?: string; scopeDe?: string; scopeEn?: string
}> {
  const fallback = {
    summaryDe: group.summaryDe,
    summaryEn: group.summaryEn,
    scopeDe: group.scopeDe,
    scopeEn: group.scopeEn,
  }
  if (!group.governedBy || !group.byVariant) return fallback
  const governor = serviceById(catalogue, group.governedBy)
  if (!governor || governor.kind.kind !== 'singleChoice') return fallback
  const decision = serviceDecision(decisions, governor)
  if (decision.state !== 'selected') return fallback
  const variant = decision.variant ?? governor.kind.baselineVariant
  const stated = group.byVariant[variant]
  if (!stated) return fallback
  return {
    summaryDe: stated.summaryDe,
    summaryEn: stated.summaryEn,
    scopeDe: stated.scopeDe ?? group.scopeDe,
    scopeEn: stated.scopeEn ?? group.scopeEn,
  }
}

export type KgSystemState =
  | 'notApplicable' | 'partial' | 'open' | 'fromSource' | 'decided'

export type KgSystemProgress = Readonly<{
  groupId: string
  state: KgSystemState
  /** Required decisions that are applicable AND still unanswered. */
  openDecisions: number
  /** Applicable decisions that differ from the client source. */
  changedFromSource: number
  /** The system's own priced contribution, or `null` when it has none. */
  amount: Decimal | null
  costAuthority: KgCostAuthority
}>

/**
 * One system row's state — the whole of what the overview needs.
 *
 * Ordered deliberately: `notApplicable` outranks everything, because a system
 * the project makes moot cannot also be "open"; `partial` next; then real
 * outstanding work; then provenance. A row never reports two of these at once,
 * which is the state-grammar rule that a single green tick may never carry
 * more than one axis.
 */
export function kgSystemProgress(
  catalogue: KgCatalogue, decisions: KgDecisions, group: KgServiceGroup,
): KgSystemProgress {
  const services = systemServices(group)
  // A lapsed decision is not this system's outstanding work, not a deviation
  // from the client's documents and not a priced position: it is described
  // where it lives, and it counts nowhere until its precondition returns.
  const applicable = services.filter((service) => isApplicable(service)
    && dependencySuspension(catalogue, decisions, service) === null)
  const open = applicable.filter((service) =>
    service.requiresDecision
    && serviceDecision(decisions, service).state === 'undecided').length
  const changed = applicable.filter((service) =>
    changedFromSource(decisions, service) === true).length
  const contributions = applicable
    .map((service) => serviceContribution(catalogue, decisions, service))
    .filter((value): value is Decimal => value !== null)
  const amount = contributions.length === 0
    ? null
    : contributions.reduce((sum, value) => sum.plus(value), new Decimal(0))
  const authority = group.costAuthority
    ?? (amount === null ? 'noBasis' : 'direct')
  const state: KgSystemState = group.applicability?.state === 'notApplicable'
    ? 'notApplicable'
    : group.applicability?.state === 'partial'
      ? 'partial'
      : open > 0
        ? 'open'
        : applicable.every((service) => service.authority === 'sourceEvidenced')
          && applicable.length > 0
          && changed === 0
          ? 'fromSource'
          : 'decided'
  return {
    groupId: group.id,
    state,
    openDecisions: open,
    changedFromSource: changed,
    amount,
    costAuthority: authority,
  }
}

export type KgChapterOverview = Readonly<{
  relevantSystems: number
  decided: number
  fromSource: number
  open: number
  notApplicable: number
  partial: number
  proposalChanges: number
  amount: Decimal | null
  directlyPriced: number
  withoutPriceBasis: number
}>

/**
 * The one summary line above the systems.
 *
 * Every number here has to correspond to something a user can act on: an
 * "open" count that includes decisions nobody is entitled to make is the
 * artificial completion metric the audit called out, and it is why
 * `notApplicable` systems are counted separately rather than as outstanding
 * work.
 */
export function kgChapterOverview(
  catalogue: KgCatalogue, decisions: KgDecisions, chapter: KgChapter,
): KgChapterOverview {
  const progress = chapter.groups.map(
    (group) => kgSystemProgress(catalogue, decisions, group),
  )
  const relevant = progress.filter(
    (entry) => entry.state !== 'notApplicable',
  )
  const amounts = progress
    .map((entry) => entry.amount)
    .filter((value): value is Decimal => value !== null)
  const applicable = chapter.groups
    .flatMap(systemServices)
    .filter(isApplicable)
  return {
    relevantSystems: relevant.length,
    decided: progress.filter((entry) => entry.state === 'decided').length,
    fromSource: progress.filter((entry) => entry.state === 'fromSource').length,
    open: progress.filter((entry) => entry.state === 'open').length,
    notApplicable: progress.filter((entry) => entry.state === 'notApplicable').length,
    partial: progress.filter((entry) => entry.state === 'partial').length,
    proposalChanges: proposalChanges(catalogue, chapter, decisions).length,
    amount: amounts.length === 0
      ? null
      : amounts.reduce((sum, value) => sum.plus(value), new Decimal(0)),
    directlyPriced: applicable.filter((service) =>
      costAuthorityOf(service) === 'direct').length,
    withoutPriceBasis: applicable.filter((service) =>
      costAuthorityOf(service) === 'noBasis').length,
  }
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
  if (dep.requiresVariantIn && !dep.requiresVariantIn.includes(state.variant ?? '')) {
    return dep.serviceId
  }
  return null
}

/**
 * Is a variant this service does NOT currently hold reachable at all?
 *
 * `dependencyBlocker` answers about the answer already given. Configure has
 * to answer a different question BEFORE the click: may the user pick
 * QNG-PREMIUM right now, and if not, what would make it available? An
 * unavailable choice exists only together with its reason and the action
 * that enables it (rule 12), and a reason cannot be produced by a function
 * that only inspects the current selection.
 *
 * Returns the upstream service id that is standing in the way, or `null`
 * when the variant is reachable. Same rules as `dependencyBlocker`,
 * evaluated against the HYPOTHETICAL variant — one implementation of the
 * dependency semantics, asked two different questions, rather than two
 * implementations that can drift.
 */
export function variantBlocker(
  catalogue: KgCatalogue,
  decisions: KgDecisions,
  service: KgService,
  variant: string,
): string | null {
  const dep = service.dependsOn
  if (!dep) return null
  if (dep.appliesToVariants && !dep.appliesToVariants.includes(variant)) return null
  const upstream = serviceById(catalogue, dep.serviceId)
  if (!upstream) return dep.serviceId
  const upstreamGroup = groupOfService(catalogue, dep.serviceId)
  if (upstreamGroup && decisions.scope[upstreamGroup] !== 'included') return dep.serviceId
  const state = serviceDecision(decisions, upstream)
  if (dep.requiresSelected && state.state !== 'selected') return dep.serviceId
  if (dep.requiresVariant && state.variant !== dep.requiresVariant) return dep.serviceId
  if (dep.requiresVariantIn && !dep.requiresVariantIn.includes(state.variant ?? '')) {
    return dep.serviceId
  }
  return null
}

/**
 * The variant the blocking dependency would need upstream, in words the
 * upstream service itself supplies. `null` when the dependency does not name
 * one (it merely requires the upstream to be selected).
 */
export function requiredUpstreamVariant(
  catalogue: KgCatalogue, service: KgService,
): { service: KgService; variant: KgServiceVariant | null } | null {
  const dep = service.dependsOn
  if (!dep) return null
  const upstream = serviceById(catalogue, dep.serviceId)
  if (!upstream) return null
  const wanted = dep.requiresVariant ?? dep.requiresVariantIn?.[0] ?? null
  const variant = wanted && upstream.kind.kind === 'singleChoice'
    ? upstream.kind.variants.find((v) => v.value === wanted) ?? null
    : null
  return { service: upstream, variant }
}

/**
 * DOES THIS DECISION EXIST AT ALL RIGHT NOW — and if not, because of whom?
 *
 * `dependencyBlocker` answers a narrower question: *is the answer this
 * service currently holds contradicted?* It deliberately returns `null` for a
 * service nobody has answered, because an unanswered decision cannot be
 * inconsistent with anything.
 *
 * That is not the question the state AFTER a cascade asks. When the plant
 * concept becomes one plant per building, the shared heat generator is not
 * "wrong" and it is not "unanswered" — it is a decision this project no
 * longer contains. `notApplicable` is the audit's own word for exactly that,
 * and the only difference here is that the cause is another DECISION rather
 * than the site: it can be reversed, and naming it tells the user how.
 *
 * Two properties earn their keep:
 *
 * 1. It is INDEPENDENT of the service's own state, so a lapsed decision is
 *    described the same way whether it was included, excluded or open.
 * 2. It is TRANSITIVE, and it returns the ROOT. A decision whose precondition
 *    is itself suspended has no precondition either — the reason domestic hot
 *    water lapses is the plant concept, not the heat generator standing
 *    between them, and pointing at the middle of a chain sends the user to a
 *    control that cannot help them.
 *
 * The returned service is the one to change to get this decision back.
 */
export function dependencySuspension(
  catalogue: KgCatalogue, decisions: KgDecisions, service: KgService,
): KgService | null {
  return suspensionOf(catalogue, decisions, service, new Set())
}

function suspensionOf(
  catalogue: KgCatalogue,
  decisions: KgDecisions,
  service: KgService,
  seen: Set<string>,
): KgService | null {
  const dep = service.dependsOn
  if (!dep) return null
  // A malformed cyclic fixture must not hang the configurator; a cycle is a
  // fixture defect and `tools/verify.py` owns saying so.
  if (seen.has(service.id)) return null
  seen.add(service.id)
  /**
   * WHO MOVED — the only question that separates the two failures.
   *
   * A dependency scoped with `appliesToVariants` belongs to the CHOICE, not
   * to the decision: it exists because the user picked that alternative, so
   * the user picked into a world that does not hold and only the user can
   * pick their way out. `QNG-PLUS` demanding `EH 40 NH` is that case — the
   * control stays, `dependencyBlocker` refuses completion, and the chapter is
   * right to report it as something to resolve.
   *
   * An UNSCOPED dependency is the opposite direction: the parent moved and
   * the decision's whole subject went with it. There is nothing here for the
   * user to correct, because the question itself has stopped existing.
   * Suspension is only ever about that second case.
   */
  if (dep.appliesToVariants) return null
  const upstream = serviceById(catalogue, dep.serviceId)
  // An unresolvable upstream is a broken fixture, not a lapsed decision:
  // `dependencyBlocker` already refuses completion for it, and calling it
  // "not applicable" would hide the defect behind a legitimate-looking state.
  if (!upstream) return null
  const upstreamGroup = groupOfService(catalogue, dep.serviceId)
  if (upstreamGroup && decisions.scope[upstreamGroup] !== 'included') return upstream
  if (!isApplicable(upstream)) return upstream
  const state = serviceDecision(decisions, upstream)
  if (dep.requiresSelected && state.state !== 'selected') return upstream
  if (dep.requiresVariant || dep.requiresVariantIn) {
    const current = state.state === 'selected'
      ? state.variant ?? (upstream.kind.kind === 'singleChoice'
        ? upstream.kind.baselineVariant
        : undefined)
      : undefined
    if (dep.requiresVariant && current !== dep.requiresVariant) return upstream
    if (dep.requiresVariantIn && !dep.requiresVariantIn.includes(current ?? '')) return upstream
  }
  return suspensionOf(catalogue, decisions, upstream, seen)
}

/**
 * The variant the suspending decision holds, so the cause can NAME it.
 *
 * The fixture's own labels, never a sentence: "not applicable" is only
 * actionable when it says which answer made it so. `null` where the
 * suspending decision carries no variant — the caller supplies the word for
 * its state from the dictionary, because a state is a text and texts are keys
 * (rule 36).
 */
export function suspensionVariantLabel(
  service: KgService, decisions: KgDecisions, language: 'de' | 'en',
): string | null {
  if (service.kind.kind !== 'singleChoice') return null
  const decision = serviceDecision(decisions, service)
  if (decision.state !== 'selected') return null
  const wanted = decision.variant ?? service.kind.baselineVariant
  const variant = service.kind.variants.find((v) => v.value === wanted)
  if (!variant) return null
  return language === 'en' ? variant.labelEn : variant.labelDe
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
  // A decision the project makes moot contributes nothing — and contributes
  // `null`, not `0`: there is no priced position here, which is a different
  // statement from a position that happens to be free (rule 16).
  if (!isApplicable(service)) return null
  if (dependencyBlocker(catalogue, decisions, service)) return null
  // A decision whose precondition no longer holds is not in the offer, and it
  // is `null` rather than `0` for the same reason as every other absent
  // position: no priced position exists here (rule 16).
  if (dependencySuspension(catalogue, decisions, service)) return null
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
      // `Nicht im All3-Leistungsumfang` chosen: the position has left the
      // offer. `null`, not `0` — there is no priced position here (rule 16),
      // and a `direct` zero would become a `± 0 €` driver (QA-01).
      if (chosen?.excludesPosition) return null
      return chosen ? base.plus(new Decimal(chosen.delta)) : base
    }
    case 'quantity': {
      const problem = quantityProblem(service, decision.quantity)
      // An invalid entry keeps the last VALID basis — the baseline quantity —
      // so the total stays a real number while the row states the problem.
      const raw = problem ? service.kind.baselineQuantity : decision.quantity!
      const exact = new Decimal(service.kind.unitAmount).mul(new Decimal(raw))
      // A quantity of ZERO is `null`, for the same reason `excludesPosition`
      // above is: there is no priced position here (rule 16), and a `direct`
      // zero survives `kgContributions`'s own zero-filter to become a
      // `± 0 €` driver (QA-01).
      //
      // ACCEPT-01 (Pre-Release Acceptance, candidate d1ace229). `0` is a
      // VALID entry — `minQuantity` is `"0"` — so the seller can legitimately
      // say "there is none of this". Two surfaces then disagreed about the
      // same position: the chapter said `Preis nicht ermittelt`, while
      // `Alle Kostendetails` § B, a table titled "…mit kaufmännischer
      // Wirkung", printed `0 € · ohne Preiswirkung` — the phrase the
      // pricing-coverage work retired — and § E, the section built for a
      // position with no own amount, did not list it at all.
      //
      // Classifying it here rather than on either surface is what makes all
      // fifteen quantity positions agree: every consumer already reads this
      // one answer. NO AMOUNT MOVES — a zero added to a sum and a zero left
      // out of it are the same number, and every baseline quantity is
      // positive (`quantityPositionViolations` proves the rate is too).
      return exact.isZero() ? null : exact
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
  /**
   * VR3-COST-00: what this contribution's euro is allowed to mean. The
   * catalogue has always known it (`costAuthorityOf`); it stopped here and
   * never reached `Driver`, so every commercial surface downstream had to
   * assume `direct`. Carrying it is additive and moves no money.
   */
  costAuthority: KgCostAuthority
  /** The carrying position, when `costAuthority` is `bundle`. */
  costBasisDe?: string
  costBasisEn?: string
}>

/**
 * Every PRICED contribution of every INCLUDED cost group, in DIN 276 order.
 *
 * A CONTRIBUTION IS SOMETHING THAT CONTRIBUTES (VR3-TGA-01, QA-01).
 *
 * These rows become `Driver`s, and a driver is what every commercial surface
 * lists as a priced position: the rail's `Im Angebot gewählt` recap, the
 * Kostentreiber, the comparison, the export, the client projection. Each of
 * them prints the row's amount as a signed number.
 *
 * So a decision with no cost authority must not be one. KG 400 declares
 * fifteen — `Wärmeabgabe` and every other row whose own body text reads
 * `keine gesonderte Preisgrundlage`, the bundled DHW rows, and
 * `Hausanschlüsse`, which is the Bauherr's and outside the All3 offer
 * entirely. Each of them reached the rail as `± 0 €`: a positive claim that
 * All3 includes the item and charges nothing for it. For the Bauherr row that
 * is not merely imprecise, it is the opposite of true.
 *
 * The guard is AUTHORITY, not the number. A genuinely free priced position
 * keeps its zero — `costAuthorityOf` returns `direct` for it, and `± 0 €`
 * then carries its one sanctioned meaning: measurably the same price as the
 * baseline choice. That is also why a `singleChoice` sitting on its baseline
 * variant (`Energieziel` at EH 55, `QNG-Siegel` at *kein QNG*) still appears:
 * it IS priced, and at its current value it adds nothing.
 *
 * No sum moves — every row removed here was worth exactly zero.
 */
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
        if (exact.isZero() && costAuthorityOf(service) !== 'direct') continue
        out.push({
          serviceId: service.id,
          group: chapter.group,
          groupId: group.id,
          labelDe: service.labelDe,
          labelEn: service.labelEn,
          exact,
          authority: service.authority,
          costAuthority: contributionCostAuthority(
            service, serviceDecision(decisions, service),
          ),
          ...(service.costBasisDe ? { costBasisDe: service.costBasisDe } : {}),
          ...(service.costBasisEn ? { costBasisEn: service.costBasisEn } : {}),
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
    // VR3-COST-00: the authority the catalogue already computed reaches the
    // commercial surfaces instead of being dropped at this boundary.
    costAuthority: c.costAuthority,
    ...(c.costBasisDe ? { bundleLabelDe: c.costBasisDe } : {}),
    ...(c.costBasisEn ? { bundleLabelEn: c.costBasisEn } : {}),
  }))
}

/** The alternative a `singleChoice` decision currently stands on, or `null`. */
export function selectedVariant(
  service: KgService, decision: KgServiceDecisionRecord,
): KgServiceVariant | null {
  if (service.kind.kind !== 'singleChoice') return null
  const wanted = decision.variant ?? service.kind.baselineVariant
  return service.kind.variants.find((v) => v.value === wanted) ?? null
}

/**
 * The authority of the CURRENT selection, not merely of the decision.
 *
 * `costAuthorityOf` answers for the service. A `singleChoice` answers per
 * ALTERNATIVE: three of the five heat generators carry no cost option, and
 * the fixture says so on the variant (`noPriceBasis`, `bundled`) — which
 * `KgSystemChapter` already renders. Reading only the service level would
 * report `direkt bepreist` for a chosen alternative that has no price basis
 * at all, which is the exact fabricated commercial claim §4 of the Cost
 * Driver contract forbids.
 *
 * Additive by construction: `costAuthorityOf`, `rendersAmount` and the
 * cascade rule are untouched, and a decision whose variant declares nothing
 * resolves exactly as it did before.
 */
export function contributionCostAuthority(
  service: KgService, decision: KgServiceDecisionRecord,
): KgCostAuthority {
  const chosen = selectedVariant(service, decision)
  if (chosen?.costAuthority) return chosen.costAuthority
  if (chosen?.bundled) return 'bundle'
  if (chosen?.noPriceBasis) return 'noBasis'
  return costAuthorityOf(service)
}

/**
 * A commercially real selection that carries NO amount of its own.
 *
 * These are the rows §2.6/§2.7 of the Cost Driver contract describe: chosen,
 * part of the Option, and priced somewhere else — or nowhere. They are
 * deliberately NOT contributions (`kgContributions` only emits something that
 * contributes), so without this producer they were invisible to every
 * commercial surface, and their absence read as "not selected".
 *
 * NOTHING HERE IS ARITHMETIC. It selects and classifies; no amount is read,
 * derived or invented, and a row that already produced a contribution is
 * excluded so one selection can never be counted twice.
 */
export type KgSelectionWithoutBasis = Readonly<{
  serviceId: string
  group: KgScopeGroup
  groupId: string
  labelDe: string
  labelEn: string
  /** The chosen alternative, where the decision has one. */
  valueDe: string | null
  valueEn: string | null
  costAuthority: KgCostAuthority
  /**
   * A `direct` position whose QUANTITY is zero (ACCEPT-01).
   *
   * It has a price basis — a rate — so it is not `noBasis`; it simply has
   * nothing to apply the rate to. The distinction matters because the
   * surfaces phrase the two differently, and because `direct` reaches this
   * list only in this one case.
   */
  zeroQuantity?: true
  costBasisDe?: string
  costBasisEn?: string
  buildingId?: string
}>

export function kgSelectionsWithoutBasis(
  catalogue: KgCatalogue, decisions: KgDecisions,
): readonly KgSelectionWithoutBasis[] {
  const contributed = new Set(
    kgContributions(catalogue, decisions).map((c) => c.serviceId),
  )
  const out: KgSelectionWithoutBasis[] = []
  for (const chapter of catalogue.chapters) {
    if (decisions.scope[chapter.group] !== 'included') continue
    for (const group of chapter.groups) {
      for (const service of group.services) {
        if (contributed.has(service.id)) continue
        const decision = serviceDecision(decisions, service)
        if (decision.state !== 'selected') continue
        if (!isApplicable(service)) continue
        if (dependencyBlocker(catalogue, decisions, service)) continue
        if (dependencySuspension(catalogue, decisions, service)) continue
        const authority = contributionCostAuthority(service, decision)
        /**
         * A `direct` QUANTITY position with a quantity of zero (ACCEPT-01).
         *
         * The guard below used to read "`direct` cannot land here — a
         * directly priced selection produced a contribution". That premise
         * stopped being true the moment `serviceContribution` started
         * answering `null` for a zero quantity instead of a `0 €` driver:
         * the position now produces no contribution, lands here, and would
         * have been dropped — disappearing from BOTH § B and § E rather
         * than merely from the wrong one.
         *
         * Narrowed rather than removed. Every other `direct` selection still
         * cannot reach this line, and the test asserts exactly that, so the
         * old guarantee is kept where it is still true.
         */
        const zeroQuantity = service.kind.kind === 'quantity'
          && serviceContribution(catalogue, decisions, service) === null
        if (!zeroQuantity && (authority === 'direct' || authority === 'none')) continue
        const chosen = selectedVariant(service, decision)
        out.push({
          serviceId: service.id,
          group: chapter.group,
          groupId: group.id,
          labelDe: service.labelDe,
          labelEn: service.labelEn,
          valueDe: chosen ? chosen.labelDe : null,
          valueEn: chosen ? chosen.labelEn : null,
          costAuthority: authority,
          ...(zeroQuantity ? { zeroQuantity: true as const } : {}),
          ...(service.costBasisDe ? { costBasisDe: service.costBasisDe } : {}),
          ...(service.costBasisEn ? { costBasisEn: service.costBasisEn } : {}),
          ...(service.buildingId ? { buildingId: service.buildingId } : {}),
        })
      }
    }
  }
  return out
}

/**
 * The delta of the CURRENT alternative against the declared All3 standard.
 *
 * Reference level 1 of the Cost Driver contract §5.2 — "the alternative it
 * replaced within the same decision" — and the only one the product can
 * state per ROW rather than per Option. Nothing is invented: the standard is
 * declared by the fixture (`all3Standard`), both deltas are declared by the
 * fixture, and the difference between two declared numbers against a NAMED
 * reference is the whole computation.
 *
 * `null` — an ABSENT delta, never a zero — whenever the reference does not
 * exist, the decision is not a choice between alternatives, the selection
 * already stands on the standard, or either side carries no price basis.
 * An empty delta is a correct and common state; `± 0 €` in its place would
 * be a positive claim that two options cost the same.
 */
export type KgStandardDelta = Readonly<{
  referenceDe: string
  referenceEn: string
  delta: Decimal
}>

export function kgDeltaAgainstStandard(
  service: KgService, decision: KgServiceDecisionRecord,
): KgStandardDelta | null {
  if (service.kind.kind !== 'singleChoice') return null
  const standardValue = service.all3Standard
  if (!standardValue) return null
  const chosen = selectedVariant(service, decision)
  if (!chosen || chosen.value === standardValue) return null
  const standard = service.kind.variants.find((v) => v.value === standardValue)
  if (!standard) return null
  // A side with no price basis cannot take part in a difference: the product
  // does not know that the price did not move, only that it has no basis.
  if (chosen.noPriceBasis || chosen.bundled || chosen.excludesPosition) return null
  if (standard.noPriceBasis || standard.bundled || standard.excludesPosition) return null
  return {
    referenceDe: standard.labelDe,
    referenceEn: standard.labelEn,
    delta: new Decimal(chosen.delta).minus(new Decimal(standard.delta)),
  }
}

/** The service behind a `kg_<serviceId>` driver key, across every catalogue. */
export function kgServiceOfDriverKey(key: string): KgService | null {
  if (!key.startsWith('kg_')) return null
  const serviceId = key.slice(3)
  for (const catalogue of kgCatalogues()) {
    const service = serviceById(catalogue, serviceId)
    if (service) return service
  }
  return null
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
  /**
   * A decision the project makes moot is not outstanding work.
   *
   * Counting it would produce exactly the artificial completion metric the
   * TGA audit named: a chapter that can never be finished because it is
   * waiting on an answer nobody is entitled to give. `notApplicable` is a
   * statement about the project, not a gap in the configuration.
   */
  const live = services.filter((s) =>
    dependencySuspension(catalogue, decisions, s) === null)
  const required = live.filter((s) => s.requiresDecision && isApplicable(s))
  const decided = required.filter((s) =>
    serviceDecision(decisions, s).state !== 'undecided')
  const invalid = live.filter((s) => {
    const decision = serviceDecision(decisions, s)
    return decision.state === 'selected'
      && quantityProblem(s, decision.quantity) !== null
  })
  /**
   * A LAPSED PRECONDITION IS NOT A BROKEN ONE.
   *
   * `blocked` refuses to let a chapter complete, and it is right to for a
   * fixture whose upstream does not resolve. It was also catching every
   * decision a cascade had just suspended — so changing the plant concept
   * reported the chapter as FAILED, a state the domain does not have, for a
   * configuration that was in fact perfectly consistent.
   */
  const blocked = live.filter((s) =>
    dependencyBlocker(catalogue, decisions, s) !== null)
  const selected = live.filter((s) =>
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

/* ── VR3-TGA-01 · cascading change ─────────────────────────────────────── */

export type KgCascadeEffect = 'suspend' | 'restore' | 'preserve'

export type KgCascadeEntry = Readonly<{
  service: KgService
  group: KgScopeGroup
  effect: KgCascadeEffect
  /** What the decision holds while it is live, so the dialogue can name it. */
  currentVariant?: string
  /**
   * The money this entry moves — what leaves the offer, or what returns.
   *
   * `null` wherever this decision has no authority to name a euro, and the
   * rule is applied HERE rather than trusted to each dialogue: a bundled
   * position contributes a real `0`, and a confirmation reading
   * `entfällt · 0 €` tells the user that removing it is free. It is not free;
   * its price simply lives in another position (rule 16, AC 21).
   */
  currentAmount: Decimal | null
}>

export type KgCascade = Readonly<{
  entries: readonly KgCascadeEntry[]
  /** Does this change move something priced or client-relevant? */
  material: boolean
}>

/**
 * WHAT WOULD CHANGE, computed BEFORE the change is applied.
 *
 * The audit's five-step cascade, steps 1 and 2 — with one correction the
 * Acceptance audit forced and one it earned.
 *
 * **It is the whole closure, not the direct children.** The first version
 * reached only services that named the changed one, so changing the plant
 * concept suspended the shared heat generator and left domestic hot water —
 * which depends on the generator, not on the concept — asserting a
 * precondition that no longer existed. Nothing in the dialogue mentioned it
 * and the chapter came to rest reporting FAILED. `dependencySuspension` is
 * transitive, so asking it before and after reaches every depth for free.
 *
 * **A cascade runs in both directions.** Restoring the plant concept restores
 * the decisions it suspended, and the user is entitled to see the 1.240.000 €
 * coming back with the same ceremony that saw it leave. A dialogue that only
 * ever describes losses teaches that changes are one-way.
 *
 * `preserve` is returned rather than filtered out for the same reason: a
 * dialogue that lists only what it destroys reads as a warning and never
 * tells the user whether the rest of their work is safe.
 */
export function kgCascadeFor(
  catalogue: KgCatalogue,
  decisions: KgDecisions,
  serviceId: string,
  next: KgServiceDecisionRecord,
): KgCascade {
  const after: KgDecisions = {
    ...decisions,
    services: { ...decisions.services, [serviceId]: next },
  }
  const entries: KgCascadeEntry[] = []
  for (const service of allServices(catalogue)) {
    if (service.id === serviceId) continue
    if (!service.dependsOn) continue
    if (!isApplicable(service)) continue
    const before = dependencySuspension(catalogue, decisions, service)
    const now = dependencySuspension(catalogue, after, service)
    if (before === null && now === null) {
      // Still live, and still depends on something in this chain: say so only
      // when this change could plausibly have touched it.
      if (dependsOnTransitively(catalogue, service, serviceId)) {
        entries.push({
          service,
          group: groupOfService(catalogue, service.id) ?? 'KG_400',
          effect: 'preserve',
          currentVariant: serviceDecision(decisions, service).variant,
          currentAmount: serviceContribution(catalogue, decisions, service),
        })
      }
      continue
    }
    if (before === null && now !== null) {
      // A decision nobody has taken cannot be lost by this change.
      if (serviceDecision(decisions, service).state === 'undecided') continue
      entries.push({
        service,
        group: groupOfService(catalogue, service.id) ?? 'KG_400',
        effect: 'suspend',
        currentVariant: serviceDecision(decisions, service).variant,
        currentAmount: nameableAmount(catalogue, decisions, service),
      })
      continue
    }
    if (before !== null && now === null) {
      entries.push({
        service,
        group: groupOfService(catalogue, service.id) ?? 'KG_400',
        effect: 'restore',
        currentVariant: serviceDecision(after, service).variant,
        currentAmount: nameableAmount(catalogue, after, service),
      })
    }
  }
  const material = entries.some((entry) => entry.effect !== 'preserve' && (
    entry.currentAmount !== null
    || costAuthorityOf(entry.service) === 'direct'
    || costAuthorityOf(entry.service) === 'bundle'
  ))
  return { entries, material }
}

/** The contribution, but only where this decision may name a euro at all. */
function nameableAmount(
  catalogue: KgCatalogue, decisions: KgDecisions, service: KgService,
): Decimal | null {
  if (!rendersAmount(service)) return null
  return serviceContribution(catalogue, decisions, service)
}

/** Does `service` hang off `ancestorId` through any chain of dependencies? */
function dependsOnTransitively(
  catalogue: KgCatalogue, service: KgService, ancestorId: string,
): boolean {
  const seen = new Set<string>()
  let current: KgService | null = service
  while (current?.dependsOn) {
    if (seen.has(current.id)) return false
    seen.add(current.id)
    if (current.dependsOn.serviceId === ancestorId) return true
    current = serviceById(catalogue, current.dependsOn.serviceId)
  }
  return false
}
