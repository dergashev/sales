import { test, expect } from '../fixtures'
import {
  BUILDING_SCOPE,
  CONFIGURATOR_CHAPTERS,
  DEMO_COMPLEX_PROJECT_NAME,
  DEMO_PROJECT_NAME,
  KONFIGURATOR_GATE,
  NAV,
  OPTION_JOURNEY_LANDMARK,
  SCOPE_BUILDINGS,
} from '../anchors'
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * The Option's building-scope gate chain (VR3-02, targets T-013 – T-017).
 *
 * There is no router and nothing on `window` — the Konfigurator can only be
 * reached by walking the real gate chain through real UI clicks, exactly as
 * a salesperson would, and this spec IS that chain:
 *
 *   Projects → open the project → run the analysis → create an Option →
 *   Gebäude & Umfang (Konfigurator locked) → confirm each selected
 *   building → save the scope → Konfigurator available → start
 *   Leistungsabgrenzung.
 *
 * It asserts the gate is a genuine, reactive mechanic and not "eventually
 * unlocked": a material change AFTER the save re-locks it, and the locked
 * stage renders its own explanation rather than a greyed-out label. That
 * reactive lock/unlock only exists because the gate is a fingerprint of the
 * selected buildings and their confirmed values.
 *
 * Only fixture identity is asserted on; no calculation total is asserted
 * here — those belong to the calculation engine's own tests (rule 32/35).
 */
test.describe('Option building scope · gate chain', () => {
  test('one building: confirm, save, and the Konfigurator becomes available', async ({ page }) => {
    await page.goto('/')
    await reachOptionWorkspace(page, DEMO_PROJECT_NAME)

    // ── Landed on Gebäude & Umfang: the gate is closed ───────────────
    await expect(page.getByRole('heading', { level: 1, name: NAV.items.buildingScope }))
      .toBeVisible()
    await expect(page.getByText(BUILDING_SCOPE.progress(0, 1))).toBeVisible()
    // The Option's buildings come from the PROJECT baseline, not from the
    // proposal fixture the engine prices: this baseline belongs to
    // Lindenhof, and there is no "Haus A" anywhere on the surface.
    await expect(page.getByRole('region', { name: new RegExp(SCOPE_BUILDINGS.a1) }))
      .toBeVisible()
    await expect(page.getByText('Haus A', { exact: true })).toHaveCount(0)

    const save = page.getByRole('button', { name: BUILDING_SCOPE.save })
    await expect(save).toHaveAttribute('aria-disabled', 'true')

    // ── The locked step is a PLACE and explains itself (T-016) ───────
    //    2026-09-06 IA rebuild: one rail, `Optionsablauf`, and a step's
    //    accessible name is its label plus its state — the retired flat
    //    spine's `Schritt 5 von 13` position no longer exists.
    const rail = page.getByRole('navigation', { name: OPTION_JOURNEY_LANDMARK })
    await rail.getByRole('button', { name: /^Leistungsabgrenzung/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: KONFIGURATOR_GATE.locked }))
      .toBeVisible()
    // Fail-closed: no configurator is mounted behind the closed gate.
    await expect(page.getByRole('heading', {
      level: 1, name: CONFIGURATOR_CHAPTERS.scopeBoundaries,
    })).toHaveCount(0)
    // A named recovery route, not a disabled label.
    await page.getByRole('button', { name: /Lindenhof prüfen/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: NAV.items.buildingScope }))
      .toBeVisible()

    // ── Confirm and save: the gate opens with its receipt (T-017) ────
    await page.getByRole('button', { name: BUILDING_SCOPE.confirm(SCOPE_BUILDINGS.a1) }).click()
    await expect(page.getByText(BUILDING_SCOPE.progress(1, 1))).toBeVisible()
    await expect(save).not.toHaveAttribute('aria-disabled', 'true')
    await save.click()

    await expect(page.getByRole('heading', { level: 1, name: KONFIGURATOR_GATE.available }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Eine Gebäudegrundlage bestätigt und gespeichert/))
      .toBeVisible()

    // ── One transition into Leistungsabgrenzung, not two ─────────────
    await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
    await expect(page.getByRole('heading', {
      level: 1, name: CONFIGURATOR_CHAPTERS.scopeBoundaries,
    })).toBeVisible()
  })

  test('three buildings: distinct identities, per-building confirmation, and a re-locking gate', async ({ page }) => {
    await page.goto('/')
    await reachOptionWorkspace(page, DEMO_COMPLEX_PROJECT_NAME)

    // ── Exactly three identities, each with its own metrics ──────────
    await expect(page.getByText(BUILDING_SCOPE.progress(0, 3))).toBeVisible()
    for (const identity of [SCOPE_BUILDINGS.bA, SCOPE_BUILDINGS.bB, SCOPE_BUILDINGS.bC]) {
      await expect(page.getByRole('checkbox', { name: BUILDING_SCOPE.select(identity) }))
        .toBeChecked()
    }
    // Exactly one baseline is open, and it names the building it belongs to.
    await expect(page.getByRole('region', { name: new RegExp(SCOPE_BUILDINGS.bA) }))
      .toBeVisible()
    await expect(page.getByRole('region', { name: new RegExp(SCOPE_BUILDINGS.bC) }))
      .toHaveCount(0)

    await page.getByRole('button', { name: BUILDING_SCOPE.review(SCOPE_BUILDINGS.bC) }).click()
    const stadthaus = page.getByRole('region', { name: new RegExp(SCOPE_BUILDINGS.bC) })
    await expect(stadthaus).toBeVisible()
    // Stadthaus' own storey structure, from the fixture — never Kontorhaus'.
    await expect(stadthaus.getByText('Teil-UG + EG + 6 OG')).toBeVisible()

    // ── Save the scope, then break it again ─────────────────────────
    await saveBuildingScope(page)

    await page.getByRole('navigation', { name: OPTION_JOURNEY_LANDMARK })
      .getByRole('button', { name: /^Gebäude & Umfang/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: NAV.items.buildingScope }))
      .toBeVisible()
    await page.getByRole('button', { name: BUILDING_SCOPE.review(SCOPE_BUILDINGS.bB) }).click()
    await page.getByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${SCOPE_BUILDINGS.bB}`,
    }).click()
    const field = page.getByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${SCOPE_BUILDINGS.bB}`,
    })
    await field.fill('3.500')
    await page.getByRole('textbox', { name: 'Begründung' }).fill('Planaenderung OG2')
    await page.getByRole('button', { name: 'Wert übernehmen' }).click()

    // The confirmation of the EDITED building dies; the other two stand.
    await expect(page.getByText(BUILDING_SCOPE.progress(2, 3))).toBeVisible()
    await expect(page.getByText(/beschreibt nicht mehr die aktuelle Auswahl/)).toBeVisible()
    // The gate is closed again: a saved scope that no longer describes the
    // selection is a recheck, never a still-open gate.
    await expect(page.getByRole('button', { name: BUILDING_SCOPE.save }))
      .toHaveAttribute('aria-disabled', 'true')
  })
})
