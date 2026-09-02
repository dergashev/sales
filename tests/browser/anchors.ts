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
  openCta: (name: string) => `${name} öffnen`,
  // VR3-01 replaced the retired project card's five-control preamble
  // (`Kundenwert übernehmen` / `Dokumentwert beibehalten` /
  // `Projektparameter bestätigen` / `Opportunity Option anlegen`) with the
  // real journey: start the analysis, then create the Option once the
  // readiness gate is open. The Option gallery's own `Öffnen` survives.
  startAnalysis: 'Dokumentanalyse starten',
  createOption: 'Option anlegen',
  openOption: 'Öffnen',
  readinessHeadingRegion: 'Opportunity Options',
  /**
   * Gebäude & Umfang's own conflict control. The proposal fixture's WFL
   * conflict gates the BUILDING confirmation, so it is decided where it
   * lives — inside the Option workspace — rather than on the project.
   */
  adoptCustomerValue: `Diese Angabe übernehmen: 1.560,00\u202fm²`,
}

export const BUILDING_SCOPE = {
  // Task 02 (deep-coherence audit, F-22): this single action now reviews
  // and confirms every ready section (Identität / Flächen /
  // Geschossstruktur) itself and finalizes the building in one click —
  // there is no longer a separate per-section "Abschnitt bestätigen"
  // control to click first.
  confirmBuilding: 'Gebäude bestätigen',
  // Acceptance remediation (cycle 5): building inclusion checkboxes now sit
  // behind this disclosure toggle, closed by default whenever a building is
  // already selected (the shipped demo state always has one).
  manageBuildings: 'Gebäude verwalten',
}

export const CONFIGURATOR_MODE = {
  title: 'Konfigurationsmodus wählen',
  sharedRadio: 'Gemeinsam konfigurieren',
  perBuildingRadio: 'Je Gebäude konfigurieren',
  start: 'Konfiguration starten',
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
