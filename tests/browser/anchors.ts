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
export const PROJECT_LIST_HEADING = 'Projekte'
/** The canonical full-journey rail on the project level. */
export const PROJECT_SPINE_LANDMARK = 'Projekt- und Optionsverlauf'

export const NAV = {
  landmark: 'Navigation',
  items: {
    buildingScope: 'Gebäude & Umfang',
    konfigurator: 'Konfigurator',
    vergleich: 'Variantenvergleich',
    export: 'Export',
    einstellungen: 'Einstellungen',
    grundlagen: 'Grundlagen',
  },
} as const

export const BREADCRUMB_LANDMARK = 'Pfad'

export const OPPORTUNITY = {
  // The card action's accessible name is its VISIBLE label plus the
  // project (WCAG 2.5.3), and the two fixtures carry different verbs:
  // the clean route offers `Projekt öffnen`, the one that needs a
  // decision offers `Projekt prüfen`. Two anchors, because a single
  // one would have to guess the route.
  openCta: (name: string) => `Projekt öffnen · ${name}`,
  reviewCta: (name: string) => `Projekt prüfen · ${name}`,
  // VR3-01 replaced the retired project card's five-control preamble
  // (`Kundenwert übernehmen` / `Dokumentwert beibehalten` /
  // `Projektparameter bestätigen` / `Opportunity Option anlegen`) with the
  // real journey: start the analysis, then create the Option once the
  // readiness gate is open. The Option gallery's own `Öffnen` survives.
  startAnalysis: 'Dokumentanalyse starten',
  createOption: 'Option anlegen',
  openOption: 'Öffnen',
  /** VR3-02 (T-012): the hand-off's one continuation names the stage. */
  defineScope: 'Gebäude & Umfang festlegen',
  readinessHeadingRegion: 'Opportunity Options',
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
