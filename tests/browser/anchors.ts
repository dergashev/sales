/**
 * Stable DOM anchors for the desktop browser smoke suite.
 *
 * The shipped app has no `data-testid` attributes anywhere (verified against
 * `src/**` before writing this file). Every anchor below is a role, an
 * `aria-*` attribute, or an i18n-sourced text string already present in
 * `src/i18n/index.ts` / the components that render it. Centralizing them
 * here means a copy change is a one-file fix instead of a scattered spec
 * update (Engineering Architecture handoff, risk R3).
 *
 * German is the source/default UI language (CLAUDE.md rule 10) and the app
 * boots with `uiLanguage: 'de'`, so all literal strings below are the DE
 * copy actually rendered on first load.
 */

export const DOCUMENT_TITLE = 'All3 · Indikatives Angebot'

/**
 * VR3-01: the normal Project List holds exactly two demonstration projects.
 * The clean route is the one every downstream smoke walks, because it
 * reaches an Option in eight files with no conflict to resolve.
 */
export const DEMO_PROJECT_NAME = 'Wohnhof Lindenhain'
export const DEMO_PROJECT_ID = 'DEMO-HAPPY-01'
export const DEMO_COMPLEX_PROJECT_NAME = 'Quartier Am Güterbogen'
export const DEMO_COMPLEX_PROJECT_ID = 'DEMO-COMPLEX-01'
/**
 * The portfolio card's canonical TITLE — `[country] – [postcode] [city] –
 * [address]`. The card no longer prints the short project name at all, so
 * every card-level locator needs the title; the short names above still
 * identify the fixtures everywhere INSIDE a project, where they remain the
 * heading.
 */
const composeTitle = (
  countryCode: string, postcode: string, city: string, addressLine: string,
) => `${countryCode} – ${postcode} ${city} – ${addressLine}`
export const DEMO_PROJECT_TITLE =
  composeTitle('DE', '79100', 'Freiburg im Breisgau', 'Lindenhain 12')
export const DEMO_COMPLEX_PROJECT_TITLE =
  composeTitle('DE', '04109', 'Leipzig', 'Am Güterbogen 5')
/** The register: five cards, two of them navigable journeys. */
export const PORTFOLIO_CARD_COUNT = 5
export const PORTFOLIO_NAVIGABLE_COUNT = 2
export const PORTFOLIO_DISPLAY_ONLY_COUNT = 3
export const PROJECT_LIST_HEADING = 'Projekte'
/**
 * TWO WORKSPACES, ONE SEAM (accepted 2026-09-06 IA audit): one rail is
 * mounted at a time, and both are the canonical `WorkflowNavigator`.
 * The retired flat spine's landmark (`Projekt- und Optionsverlauf`) exists
 * on no surface any more.
 */
export const PROJECT_JOURNEY_LANDMARK = 'Projektablauf'
export const OPTION_JOURNEY_LANDMARK = 'Optionsablauf'

/**
 * Destination LABELS. The left rail that used to carry them as a numbered
 * list is retired: `Gebäude & Umfang` and the cost groups are nested steps
 * of the Option rail, `Variantenvergleich` is a project destination offered
 * on the Options collection, and `Export` is an Option action on the
 * `Präsentieren` stage. The words are unchanged; only their homes moved.
 */
export const NAV = {
  items: {
    buildingScope: 'Gebäude & Umfang',
    vergleich: 'Variantenvergleich',
    export: 'Export',
    einstellungen: 'Einstellungen',
    grundlagen: 'Grundlagen',
  },
} as const

/** The Option workspace: its context header, its rail and its collection. */
export const OPTION_WORKSPACE = {
  allOptions: 'Alle Optionen',
  switcher: 'Option wechseln',
  stages: {
    configure: 'Konfigurieren',
    calculate: 'Kalkulieren',
    validate: 'Prüfen',
    present: 'Präsentieren',
  },
} as const

export const BREADCRUMB_LANDMARK = 'Pfad'

export const OPPORTUNITY = {
  // The card action's accessible name is its VISIBLE label plus the
  // canonical project title (WCAG 2.5.3).
  //
  // The Projects portfolio rebuild collapsed the two route-specific verbs
  // (`Projekt öffnen` / `Projekt prüfen`) into ONE primary action,
  // `Projekt konfigurieren`, for every navigable project: the portfolio's
  // question is "can I continue configuring this", and the answer does not
  // depend on whether the analysis found conflicts. So there is one anchor
  // now, and it takes the card's canonical TITLE (see
  // `DEMO_PROJECT_TITLE` above), not the project's short name, because the
  // title is what the card renders and what its accessible name contains.
  configureCta: (title: string) => `Projekt konfigurieren · ${title}`,
  clientViewCta: (title: string) => `Kundenansicht öffnen · ${title}`,
  // VR3-01 replaced the retired project card's five-control preamble
  // (`Kundenwert übernehmen` / `Dokumentwert beibehalten` /
  // `Projektparameter bestätigen` / `Opportunity Option anlegen`) with the
  // real journey: start the analysis, then create the Option once the
  // readiness gate is open. The Option gallery's own `Öffnen` survives.
  // Documents-workspace rebuild: the analysis action is SCOPE-AWARE — it
  // names the eligible set it will process, so the anchor is a pattern
  // rather than a fixed string (8 documents on the clean fixture, 36 on
  // the complex one).
  startAnalysis: /^Alle \d+ analysierbaren Dokumente analysieren$/,
  /** Completion no longer navigates by itself; the rail offers the step. */
  reviewUnderstanding: 'Projektverständnis prüfen',
  createOption: 'Option anlegen',
  openOption: 'Öffnen',
  /**
   * The Options collection's own action NAMES its destination (2026-09-06 IA
   * audit): `Öffnen · <first step>` for a new Option, `Fortsetzen · <where>`
   * for one in progress, `Präsentieren` for a client-ready one. The retired
   * hand-off page's `Gebäude & Umfang festlegen` is gone with the page.
   */
  openNewOption: 'Öffnen · Gebäude & Umfang',
  optionsHeading: 'Optionen',
}

/**
 * VR3-02: Gebäude & Umfang is the Option's building scope, inherited from
 * the project baseline. Its controls NAME the building they act on (WCAG
 * 2.5.3), so every anchor here is a function of that identity — a bare verb
 * would match three different buildings on the complex fixture.
 *
 * `Gebäude bestätigen` / `Gebäude verwalten` and the whole
 * `Konfigurationsmodus wählen` step are gone: the first two belonged to the
 * retired proposal-review surface, and the mode is now derived from the
 * saved scope rather than being an extra gate of its own.
 */
export const BUILDING_SCOPE = {
  building: (mark: string, name: string) => `Gebäude ${mark} · ${name}`,
  select: (identity: string) => `Im Angebotsumfang führen · ${identity}`,
  review: (identity: string) => `Grundlage prüfen · ${identity}`,
  confirm: (identity: string) => `Gebäudegrundlage bestätigen · ${identity}`,
  save: 'Gebäudeumfang speichern',
  /** The scope surface's own completion count, e.g. "0 von 3 bestätigt". */
  progress: (confirmed: number, total: number) => `${confirmed} von ${total} bestätigt`,
}

/**
 * VR3-COST-00 · the commercial cockpit and its Kostendetails page.
 *
 * Every string is the DE copy the app actually renders, from
 * `src/i18n/index.ts`'s `commercial.*` / `costDetails.*` block. The three
 * class hooks are the canonical Design System classes the cockpit is built
 * from — the shipped app has no `data-testid` anywhere, and the geometry gate
 * has to measure BOXES, which a role cannot address.
 */
export const COCKPIT = {
  landmark: 'Angebot',
  effectsHeading: 'Auswahl mit Preiswirkung',
  effectsList: 'Aktuell gewählte Auswahl mit Preiswirkung',
  dinHeading: 'Kostengruppen nach DIN 276',
  cta: 'Alle Kostendetails',
  origin: /^Herkunft anzeigen/,
  toDecision: (decision: string) => `Zur Entscheidung · ${decision}`,
  cls: {
    rail: 'aside.a3-cockpit',
    band: '.a3-rail-band-budget',
    hero: '.a3-cockpit-hero',
    basis: '.a3-cockpit-basis',
    change: '.a3-cockpit-change',
    complete: '.a3-cockpit-complete',
    effects: '.a3-cockpit-effects',
    effect: '.a3-cockpit-effect',
    kg: '.a3-cockpit-kg',
    ctaBlock: '.a3-cockpit-cta',
    sect: '.a3-cockpit-sect',
  },
} as const

export const COST_DETAILS = {
  title: 'Kostendetails',
  path: (projectId: string, optionId: string) =>
    `/projekt/${projectId}/option/${optionId}/kostendetails`,
  sections: [
    'A · Kaufmännische Zusammenfassung',
    'B · Aktuell gewählte Auswahl mit Preiswirkung',
    'C · Zusammensetzung nach DIN 276',
    'D · Beitragsverzeichnis',
    'E · Offen, ohne Preisgrundlage, Bauseits und ausgeschlossen',
    'F · Regionalfaktor',
    'G · Preisgrundlage und Herkunft',
    'H · Änderungsverlauf',
  ],
  ledgerSum: 'Summe der Beiträge',
  noAmount: 'kein Betrag',
  states: {
    noBasis: 'keine gesonderte Preisgrundlage',
    bundle: /^im Bündel bepreist/,
    bauseits: 'Bauseits',
    notInScope: 'Nicht im All3-Umfang',
  },
  regionalInactive: 'nicht aktiviert',
} as const

export const KONFIGURATOR_GATE = {
  locked: 'Konfigurator gesperrt',
  available: 'Konfigurator verfügbar',
  start: 'Leistungsabgrenzung starten',
}

/** Buildings of the two VR3 demonstration projects, by fixture identity. */
export const SCOPE_BUILDINGS = {
  a1: BUILDING_SCOPE.building('A', 'Lindenhof'),
  bA: BUILDING_SCOPE.building('A', 'Kontorhaus'),
  bB: BUILDING_SCOPE.building('B', 'Hofhaus'),
  bC: BUILDING_SCOPE.building('C', 'Stadthaus'),
}

export const CONFIGURATOR_SCOPE = {
  /** `role="tablist"` legend when per-building scope switching is shown. */
  legend: 'Konfigurationsumfang',
}

/**
 * Scope Boundaries (Leistungsabgrenzung, ticket d21f8d48): each applicable
 * KG group is its own `role="radiogroup"` named "KG <n> <costGroup.<n>>"
 * (`src/i18n/generated.ts`'s `costGroup.*` keys), containing exactly two
 * radios — "enthalten" first, "nicht enthalten" second (never a third
 * "unresolved" option). `enthalten`/`nicht enthalten` cannot be matched by
 * accessible name alone: "nicht enthalten" contains "enthalten" as a
 * substring, so callers must pick by position within the group, exactly as
 * `scope-boundaries.dom.test.tsx` already does. The narrow no-break space
 * between "KG" and the number (design-system rule 7) is why group-name
 * matches use a regex with `.` rather than a literal ASCII space.
 */
export const SCOPE_BOUNDARIES = {
  kg300Group: /KG.300/,
}

/**
 * Configurator chapter names (`src/state/chapters.ts`), by identity rather
 * than position — "Konfiguration starten" lands on `scopeBoundaries` first
 * (Product contract, 2026-08-18: Scope Boundaries is the authoritative
 * first Configurator step), which is project-level, not building-scoped;
 * `kg300` is the first building-scoped chapter reached from there.
 */
export const CONFIGURATOR_CHAPTERS = {
  scopeBoundaries: 'Leistungsabgrenzung',
  kg300: 'Leistungen KG 300',
}

/**
 * From src/fixtures/demo-0001.json's `stableName` field (rendered as
 * `documentationName` — the display name used on checkboxes/tabs).
 * `gebaeudeform` in that same fixture file ("Freistehendes
 * Mehrfamilienhaus" / "Bürobaukörper") is a different, descriptive string
 * that is never rendered as a building's name — confirmed against a live
 * accessibility snapshot, not assumed from the fixture alone.
 */
export const BUILDINGS = {
  a: 'Haus A',
  b: 'Haus B',
}

export const VIEWPORT_GUARD = {
  selector: '.a3-viewport-warning',
  titleDe: 'Bildschirm zu klein',
}

// ACCEPTANCE REMEDIATION (cycle 2, ACCEPT-01): the comparison route's H1 is
// now the approved target's decision headline (src/i18n/index.ts
// `comparison.headline`), independent of the sidebar nav label
// (`NAV.items.vergleich`, still "Variantenvergleich") they used to share.
export const COMPARISON = {
  headline: 'Entscheiden, nicht nur vergleichen.',
}

/**
 * VR3-CP-00 · the client presentation as a ten-chapter proposal narrative.
 *
 * One presenter bar (`.a3-cp-bar`) carries the chapter rail — a `<nav>`
 * named `Kapitel` whose buttons are labelled `{n} · {chapter}` and mark the
 * current one with `aria-current="step"` — the Varianten layer trigger
 * (present only with ≥ 2 eligible Options), the DE/EN control and `Beenden`.
 * Chapters 4 and 8 are conditional (a second building; qualifying media),
 * so `chapters` is the fixed ORDER, not the set a given Option presents.
 * Strings are the DE copy from `src/i18n/index.ts` (`vr3.client.*`).
 */
export const CLIENT_PRESENTATION = {
  railLabel: 'Kapitel',
  /** The same landmark once the presenter switches the client to EN. */
  railLabelEn: 'Chapters',
  barLabel: 'Präsentation',
  exit: 'Beenden',
  variantenTitle: 'Die Optionen im Vergleich.',
  variantenClose: 'Schließen',
  whatIf: 'Was wäre, wenn',
  chapters: [
    'Angebot', 'Projektüberblick', 'Das Projekt', 'Die Gebäude',
    'Preiszusammensetzung', 'Leistungsumfang', 'Terminplan', 'Architektur',
    'Grundlagen', 'Nächster Schritt',
  ],
  cls: {
    shell: '.a3-cp-shell',
    bar: '.a3-cp-bar',
    /** The presenter band: the bar plus the running-identity row beneath it,
     *  which is where the what-if slot lives (so the rail keeps its row). */
    band: '.a3-cp-band',
    stage: '.a3-cp-stage',
    scenarioSlot: '.a3-cp-bar-scenario',
    receipt: '.a3-cp-receipt',
    printDoc: '.a3-client-print-doc',
    /** Chapter 2's lead hero and the printed sheet's total — one number. */
    heroTotal: '.a3-cp-hero-total',
    printTotal: '.a3-client-print-total',
    languageEn: '.a3-language-control label:has(input[value="en"])',
    languageDe: '.a3-language-control label:has(input[value="de"])',
  },
} as const

/**
 * B1 · Project truth and evidence.
 *
 * The Projects register, its filters, and the four evidence groups of
 * Project Understanding. Every string below is the DE copy the app renders
 * on first load, from `src/i18n/index.ts`'s `portfolio.*` / `vr3.evidence.*`
 * blocks — the same rule as everything above: no `data-testid` exists in
 * `src/**`, so an anchor is a role, an `aria-*` attribute, an i18n string, or
 * a canonical Design System class when a BOX has to be measured.
 */
export const PORTFOLIO = {
  heading: PROJECT_LIST_HEADING,
  filterToggle: /^Filter/,
  filterLegend: 'Projekte filtern',
  search: 'Projekte durchsuchen',
  country: 'Land',
  city: 'Stadt',
  manager: 'Verantwortlich',
  statusLegend: 'Projektstatus',
  activeLegend: 'Aktive Filter',
  clearAll: 'Alle Filter zurücksetzen',
  chipRemove: (label: string) => `Filter entfernen: ${label}`,
  any: 'Alle',
  emptyFiltered: 'Kein Projekt entspricht den aktiven Filtern.',
  /** A fresh session derives `New` for both navigable projects. */
  statusNew: 'Neu',
  integrations: {
    legend: 'Verknüpfte Systeme',
    hubspot: 'Projekt in HubSpot',
    missionControl: 'Projekt in Mission Control',
    notConnected: 'Integration in dieser Demonstration nicht verbunden',
  },
  cls: {
    card: '.a3-pf-card',
    links: '.a3-pf-links',
    chips: '.a3-pf-chips',
  },
} as const

export const EVIDENCE = {
  title: 'Was wir verstanden haben',
  groups: [
    'Projekt und Geometrie',
    'Planungsanforderungen',
    'Bauliche Anforderungen',
    'TGA-Anforderungen',
  ],
  groupCount: /^\d+ von \d+ gezeigt$/,
  showAll: /^Alle \d+ weiteren anzeigen$/,
  downstream: /^Wird gelesen von: /,
  emptyGroup: 'Keine Anforderung dieser Art in den Quellen gefunden · nichts wird angenommen',
  cls: {
    groups: '.a3-evgroups',
    group: '.a3-evgroup',
    list: '.a3-evlist',
    item: '.a3-evitem',
  },
} as const

export const DOCUMENT_SOURCE = {
  register: 'Dokumentseiten',
  inspect: 'Beleg ansehen',
  openSource: /^Quelle öffnen · Seite \d+$/,
  position: /^Seite \d+ von \d+$/,
  citedClause: /^Zitierte Stelle: /,
  provenance: /^Herkunft: internal synthetic · All3/,
  noInlineViewer: 'Dieser Browser zeigt PDF nicht direkt an.',
  retry: 'Erneut laden',
  back: 'Zurück zum Projektverständnis',
  cls: {
    viewer: '.a3-docsrc',
    frame: '.a3-docsrc-frame',
    embed: '.a3-docsrc-embed',
    identity: '.a3-docsrc-identity',
  },
} as const
