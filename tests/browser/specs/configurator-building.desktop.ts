import { test, expect } from '../fixtures'
import {
import { reachOptionWorkspace } from '../journey'
  BUILDING_SCOPE,
  BUILDINGS,
  CONFIGURATOR_CHAPTERS,
  CONFIGURATOR_MODE,
  CONFIGURATOR_SCOPE,
  NAV,
  OPPORTUNITY,
  SCOPE_BOUNDARIES,
} from '../anchors'

/**
 * Building-aware Configurator scenario (Engineering Architecture handoff,
 * smoke coverage items 5 and 6).
 *
 * There is no router and nothing on `window` (F3/F4 in the architecture
 * handoff) — the Configurator can only be reached by walking the real
 * gate chain through real UI clicks, exactly as a salesperson would. This
 * spec IS that chain, for the one fully worked-out fixture (DEMO-0001,
 * "Musterprojekt Nordfeld"):
 *
 *   Opportunity list -> open DEMO-0001 -> resolve WFL conflict -> confirm
 *   project params -> create an Option -> open it -> land on Building &
 *   Scope (gate closed) -> confirm building(s) -> Konfigurator unlocked
 *   -> choose "Je Gebäude konfigurieren" (PER_BUILDING) -> per-building
 *   scope tabs.
 *
 * Along the way it asserts the building gate itself is a genuine,
 * reactive client-facing mechanic — not just "eventually unlocked": adding
 * a second, unconfirmed building RE-LOCKS the Konfigurator nav item, and
 * confirming that building unlocks it again. That reactive lock/unlock is
 * the "meaningful client-facing interaction [that] produces the expected
 * visible result" this suite is required to cover, and it only exists
 * because building state is per-building, not global.
 *
 * Only the fixture data (project/building names) is asserted on; no
 * calculation/total is asserted here — those belong to the calculation
 * engine's own tests (CLAUDE.md rule 32/35).
 */
test.describe('building-aware Configurator gate chain', () => {
  test('confirming buildings unlocks the Konfigurator, per-building scope is reachable', async ({ page }) => {
    await page.goto('/')

    // ── Project list -> analysis -> readiness gate -> Option ─────────
    //    VR3-01 replaced the retired project card's five-control preamble
    //    with the real journey; `reachOptionWorkspace` walks it as a user.
    await reachOptionWorkspace(page, DEMO_PROJECT_NAME)

    // ── Landed on Building & Scope: the gate is closed by default ────
    const nav = page.getByRole('navigation', { name: NAV.landmark })
    const konfiguratorItem = nav.getByRole('button', { name: NAV.items.konfigurator })
    await expect(konfiguratorItem).toHaveAttribute('aria-disabled', 'true')
    await expect(konfiguratorItem).toHaveAttribute('aria-describedby', 'building-gate-konfigurator')

    // ── Confirm the only included building (Haus A) — the gate opens ─
    // Task 02 (deep-coherence audit, F-22): the building review's three
    // sections (Identität / Flächen / Geschossstruktur) used to each need
    // their own independent "Abschnitt bestätigen" click before "Gebäude
    // bestätigen" itself unlocked. The single building-level confirm
    // action now reviews and confirms every ready section itself as part
    // of one click (AC5: exactly one confirmation action per building) —
    // there is no longer a separate section-level control to click first.
    const activePanel = page.getByRole('tabpanel')
    await activePanel.getByRole('button', { name: BUILDING_SCOPE.confirmBuilding }).click()
    await expect(konfiguratorItem).not.toHaveAttribute('aria-disabled', 'true')

    // ── Include the second building (unconfirmed) — the gate RE-LOCKS ─
    // This is the reactive, building-aware behavior this scenario exists
    // to prove: the gate depends on EVERY included building, not on "at
    // least one".
    await page.getByRole('button', { name: BUILDING_SCOPE.manageBuildings }).click()
    await page.getByRole('checkbox', { name: BUILDINGS.b }).check()
    await expect(konfiguratorItem).toHaveAttribute('aria-disabled', 'true')

    // ── Confirm the second building too — the gate opens again ───────
    await page.getByRole('tab', { name: new RegExp(BUILDINGS.b) }).click()
    const buildingBPanel = page.getByRole('tabpanel')
    await buildingBPanel.getByRole('button', { name: BUILDING_SCOPE.confirmBuilding }).click()
    await expect(konfiguratorItem).not.toHaveAttribute('aria-disabled', 'true')
    await expect(konfiguratorItem).not.toHaveAttribute('aria-describedby', 'building-gate-konfigurator')

    // ── Enter the Configurator, choose the building-aware mode ───────
    await konfiguratorItem.click()
    await expect(page.getByRole('heading', { name: CONFIGURATOR_MODE.title })).toBeVisible()
    // RadioCardGroup's native <input> is visually `sr-only`; the whole tile
    // (including a purely decorative `aria-hidden` focus-ring overlay) sits
    // on top of it and carries the click via native <label> wrapping — the
    // same way a sighted mouse user activates it. `force` skips Playwright's
    // hit-test-visibility check for that decorative overlay; it does not
    // change what gets clicked or what event fires.
    await page.getByRole('radio', { name: CONFIGURATOR_MODE.perBuildingRadio }).check({ force: true })
    await page.getByRole('button', { name: CONFIGURATOR_MODE.start }).click()

    // ── Configurator entered: nav reflects the current pipeline view ─
    await expect(konfiguratorItem).toHaveAttribute('aria-current', 'page')

    // ── Scope Boundaries is the authoritative first Configurator step ─
    // (Product contract, 2026-08-18): "Konfiguration starten" lands here
    // directly, and it is project-level — no per-building scope tabs yet.
    await expect(page.getByRole('heading', {
      level: 1, name: CONFIGURATOR_CHAPTERS.scopeBoundaries,
    })).toBeVisible()
    await expect(page.getByRole('tablist', { name: CONFIGURATOR_SCOPE.legend })).toHaveCount(0)


    // ── Building-aware client-facing interaction: per-building scope ─
    // Leistungen KG 300 is the first building-scoped chapter reached from
    // Scope Boundaries once KG 300 is included. With two included buildings
    // and PER_BUILDING mode it exposes a scope tablist with a "Gesamt"
    // (total) tab plus one tab per included building.
    await nav.getByRole('button', { name: CONFIGURATOR_CHAPTERS.kg300 }).click()
    const scopeTabs = page.getByRole('tablist', { name: CONFIGURATOR_SCOPE.legend })
    await expect(scopeTabs).toBeVisible()
    await expect(scopeTabs.getByRole('tab')).toHaveCount(3)

    const buildingBTab = scopeTabs.getByRole('tab', { name: new RegExp(BUILDINGS.b) })
    await buildingBTab.click()
    await expect(buildingBTab).toHaveAttribute('aria-selected', 'true')
  })
})
