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
