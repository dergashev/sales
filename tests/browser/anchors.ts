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

export const DEMO_PROJECT_NAME = 'Musterprojekt Nordfeld'
export const DEMO_PROJECT_ID = 'DEMO-0001'

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
  resolveWflDocument: 'Dokumentwert beibehalten',
  confirmProjectParams: 'Projektparameter bestätigen',
  createOption: 'Opportunity Option anlegen',
  openOption: 'Öffnen',
}

export const BUILDING_SCOPE = {
  confirmBuilding: 'Gebäude bestätigen',
  /**
   * `buildingScope.section.confirm` (src/i18n/index.ts) — confirms whichever
   * building-data section (Identität / Flächen / Geschossstruktur) is
   * currently expanded. Each confirm auto-collapses that section and
   * auto-expands the next incomplete one, so the SAME button label is
   * reused for all three; `confirmBuilding` above only becomes enabled
   * once every section has been confirmed this way.
   */
  confirmSection: 'Abschnitt bestätigen',
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
