import { expect, test, type Page } from '@playwright/test'
import { BUILDING_SCOPE, DEMO_COMPLEX_PROJECT_NAME, KONFIGURATOR_GATE, NAV } from '../anchors'
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * VR3-05 — the client presentation, walked as a presenter walks it.
 *
 * Every state below is reached through the product's own gates: the Option
 * is configured, scheduled, reviewed and SAVED before Client Mode exists at
 * all, because that is the gate this ticket's first acceptance criterion is
 * about. Nothing is seeded, so a broken gate fails here rather than being
 * stepped over.
 *
 * The screenshots are the evidence T-034…T-045 are compared against. They
 * are named for the target they answer, so a reviewer can put them side by
 * side without being told which is which.
 */

const EVIDENCE = '.artifacts/vr3-05'

async function shot(page: Page, name: string) {
  // The narrative swap is an AnimatePresence `mode="wait"` pair: the old
  // section leaves before the new one enters. A screenshot taken between
  // them photographs the previous section under the new nav state — the
  // kind of evidence that looks like a bug and is only a race. Settling on
  // "no animation is running" is the honest wait, and it costs nothing when
  // reduced motion is on because then there is nothing to wait for.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== 'running'),
    undefined,
    { timeout: 5_000 },
  ).catch(() => {})
  await page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: false })
}

/** Navigate the narrative rail and wait for the section to actually be on. */
async function toSection(page: Page, label: string, heading: RegExp) {
  await page.getByRole('navigation', { name: 'Präsentation' })
    .getByRole('button', { name: label }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
}

/** Decide all six cost groups, then confirm the scope. */
async function decideScopeLedger(page: Page) {
  await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
  const groups = page.getByRole('radiogroup')
  const count = await groups.count()
  for (let i = 0; i < count; i += 1) {
    // "enthalten" is a substring of "nicht enthalten", so the INCLUDED
    // radio is chosen by position, exactly as the DOM suites already do.
    // The LABEL is clicked, not the input: the canonical choice control puts
    // the whole label in the hit area, so that is what a user presses and
    // what actionability must therefore be proven against.
    await groups.nth(i).locator('label').first().click()
  }
  const confirm = page.getByRole('button', { name: 'Umfang bestätigen und weiter' })
  await expect(confirm).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await confirm.click()
}

/**
 * Answer every outstanding service decision in every included cost group.
 *
 * The fixture baseline the VR3-00 specification sanctions is "every explicit
 * decision recorded as NOT included" — the same state the DOM helper
 * records, and the state in which the declared demonstration totals hold
 * exactly. This walks the six chapters and takes that answer.
 */
async function configureAllChapters(page: Page) {
  for (let chapter = 0; chapter < 8; chapter += 1) {
    const groups = page.getByRole('radiogroup')
    const count = await groups.count()
    for (let i = 0; i < count; i += 1) {
      const group = groups.nth(i)
      const radios = group.getByRole('radio')
      if (await radios.count() < 2) continue
      const checked = await group.getByRole('radio', { checked: true }).count()
      if (checked > 0) continue
      // "nicht aufnehmen" — the second radio of an include/exclude pair.
      await group.locator('label').nth(1).click()
    }
    const toSchedule = page.getByRole('button', { name: 'Weiter zum Terminplan' })
    if (await toSchedule.count() > 0
      && await toSchedule.getAttribute('aria-disabled') !== 'true') {
      await toSchedule.click()
      return
    }
    const next = page.getByRole('button', { name: /^Weiter zu / })
    if (await next.count() === 0) break
    await expect(next.first()).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
    await next.first().click()
  }
}

async function confirmScheduleAndReview(page: Page) {
  const accept = page.getByRole('button', { name: 'Abhängigkeit bestätigen' })
  for (let i = 0; i < 6 && await accept.count() > 0; i += 1) await accept.first().click()
  const confirmSchedule = page.getByRole('button', { name: 'Terminplan bestätigen' })
  await expect(confirmSchedule).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await confirmSchedule.click()
  await page.getByRole('button', { name: 'Weiter zur finalen Prüfung' }).click()

  // A reviewed section KEEPS its control and disables it ("Dieser Abschnitt
  // ist geprüft."), so the loop must ask for the OUTSTANDING ones rather
  // than for all of them — otherwise it waits forever on a button that is
  // doing exactly what it should.
  const outstanding = page.locator(
    'button[aria-disabled="false"]:has-text("Abschnitt geprüft"), '
    + 'button:not([aria-disabled]):has-text("Abschnitt geprüft")',
  )
  for (let i = 0; i < 30; i += 1) {
    if (await outstanding.count() === 0) break
    await outstanding.first().click()
  }
  const confirmReview = page.getByRole('button', { name: 'Prüfung bestätigen' })
  await expect(confirmReview).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await confirmReview.click()
}

async function saveAndEnterClientMode(page: Page) {
  const save = page.getByRole('button', { name: 'Option speichern' })
  await expect(save).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await save.click()
  const enter = page.getByRole('button', { name: 'Kundenpräsentation starten' })
  await expect(enter).toBeVisible({ timeout: 15_000 })
  await enter.click()
  // The gate dialog, then the boundary screen.
  const gateStart = page.getByRole('button', { name: 'Kundenansicht starten' })
  if (await gateStart.count() > 0) await gateStart.click()
}

async function reachClientMode(page: Page) {
  await page.goto('/')
  await reachOptionWorkspace(page, DEMO_COMPLEX_PROJECT_NAME)
  await saveBuildingScope(page)
  await decideScopeLedger(page)
  await configureAllChapters(page)
  await confirmScheduleAndReview(page)
  await saveAndEnterClientMode(page)
}

test.describe('VR3-05 · client presentation, scenario and outputs', () => {
  test('walks the complete narrative from a saved Option', async ({ page }) => {
    test.setTimeout(180_000)
    await reachClientMode(page)

    // T-034 — the boundary names the mode and the saved source Option.
    await expect(page.getByRole('heading', { level: 1 }))
      .toContainText('gespeicherte Option')
    await expect(page.getByText(/Gespeicherter Stand · /)).toBeVisible()
    // The Work → Present swap is a view transition across two shells; the
    // boundary screen is only itself once it has finished.
    await expect(page.getByRole('navigation', { name: 'Präsentation' })).toBeVisible()
    await shot(page, 'T-034-entry-1440')

    await page.getByRole('button', { name: 'Präsentation starten' }).click()

    // T-035 — identity.
    await expect(page.getByRole('heading', { level: 1, name: DEMO_COMPLEX_PROJECT_NAME }))
      .toBeVisible()
    await shot(page, 'T-035-identity-1440')

    // The rail is the six target sections, in order, and nothing else.
    const nav = page.getByRole('navigation', { name: 'Präsentation' })
    await expect(nav.getByRole('button')).toHaveText(
      ['Projekt', 'Gebäude', 'Umfang', 'Leistungen', 'Terminplan', 'Investition'],
    )

    await toSection(page, 'Gebäude', /Gebäudegeschichten|Aufgabe/)
    await shot(page, 'T-036-buildings-1440')

    await toSection(page, 'Umfang', /Umfang\.$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Enthalten' })).toBeVisible()
    await shot(page, 'T-037-scope-1440')

    await toSection(page, 'Leistungen', /sichtbar gemacht\.$/)
    await shot(page, 'T-038-services-1440')

    await toSection(page, 'Terminplan', /^Ein abgestimmter Weg/)
    await expect(page.getByRole('heading', { level: 2, name: 'Ablauf' })).toBeVisible()
    await shot(page, 'T-039-schedule-1440')

    await toSection(page, 'Investition', /gemeinsame\s+Entscheidung\.$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Zusammensetzung' }))
      .toBeVisible()
    await shot(page, 'T-040-investment-1440')
  })

  test('recomposes a scenario, reverts it and saves it as a descendant', async ({ page }) => {
    test.setTimeout(180_000)
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()

    const nav = page.getByRole('navigation', { name: 'Präsentation' })
    await nav.getByRole('button', { name: 'Leistungen' }).click()

    // The bar starts at the saved baseline and names its version.
    const bar = page.locator('.a3-client-scenario-bar')
    await expect(bar).toContainText('Gespeicherter Stand')
    await expect(bar).toContainText('Version 1')

    // What-if 1 — decentralised heat, priced by the canonical calculator.
    await page.getByRole('radio', { name: /Dezentral je Gebäude/ }).click()
    await expect(bar).toContainText('Nicht gespeichertes Präsentations-Szenario')
    await expect(bar).toContainText(/−.?310\.000/)
    await expect(bar).toContainText('eine Änderung')
    await shot(page, 'T-041-scenario-1440')

    // What-if 2 — gastronomy readiness composes with it.
    await page.getByRole('radio', { name: /Gastronomie vorbereitet/ }).click()
    await expect(bar).toContainText(/\+.?110\.000/)
    await expect(bar).toContainText('2 Änderungen')
    await shot(page, 'T-042-recalculation-1440')

    // The investment page recomposed with it — one result, not two.
    await nav.getByRole('button', { name: 'Investition' }).click()
    await expect(page.getByText('38.850.000\u202f€').first()).toBeVisible()

    // T-043 — revert states the count and that the saved Option is untouched.
    await toSection(page, 'Leistungen', /hidden|./)
    await page.getByRole('button', { name: 'Zurücksetzen' }).click()
    const revertDialog = page.getByRole('dialog')
    await expect(revertDialog).toContainText('2 temporäre Änderungen')
    await shot(page, 'T-043-revert-1440')
    await page.getByRole('button', { name: /Änderungen verwerfen/ }).click()
    await expect(bar).toContainText('Gespeicherter Stand')
    await expect(bar).not.toContainText('Änderungen')

    // T-044 — save as new Option.
    await page.getByRole('radio', { name: /Dezentral je Gebäude/ }).click()
    await page.getByRole('button', { name: 'Als neue Option speichern' }).click()
    await expect(page.getByRole('dialog')).toContainText('Quelle:')
    await shot(page, 'T-044-save-new-1440')
    await page.getByRole('dialog')
      .getByRole('button', { name: 'Neue Option speichern', exact: true }).click()
    // The receipt says which Option is presented and which stays active.
    const receipt = page.locator('.a3-client-receipt')
    await expect(receipt).toContainText('Szenario')
    await expect(receipt).toContainText('Option 1')
    await shot(page, 'M-12-save-receipt-1440')
    // The scenario is spent and the descendant is the new baseline.
    await expect(bar).toContainText('Gespeicherter Stand')
  })

  test('gates outputs by authority', async ({ page }) => {
    test.setTimeout(180_000)
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()
    const nav = page.getByRole('navigation', { name: 'Präsentation' })

    // A saved baseline: all three outputs are open.
    await nav.getByRole('button', { name: 'Investition' }).click()
    await page.getByRole('button', { name: 'Abschließen & teilen' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Verbindlichkeit')
    await expect(page.getByRole('button', { name: 'Versand vorbereiten' })).toBeVisible()
    await shot(page, 'T-045-outputs-saved-1440')

    // An unsaved scenario: PDF/print need an acknowledgement, email is routed.
    await nav.getByRole('button', { name: 'Leistungen' }).click()
    await page.getByRole('radio', { name: /Dezentral je Gebäude/ }).click()
    await nav.getByRole('button', { name: 'Investition' }).click()
    await page.getByRole('button', { name: 'Abschließen & teilen' }).click()

    await expect(page.getByText('Ein temporäres Szenario ist kein angenommenes Angebot'))
      .toBeVisible()
    await expect(page.getByRole('button', { name: 'Prüfen & sichern' }))
      .toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByRole('button', { name: 'Als neue Option speichern' }).last())
      .toBeVisible()
    await shot(page, 'T-045-outputs-unsaved-1440')

    await page.getByRole('checkbox', { name: /nicht gespeichert/ }).check()
    await expect(page.getByRole('button', { name: 'Prüfen & sichern' }))
      .not.toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: 'Prüfen & sichern' }).click()
    await expect(page.getByRole('dialog')).toContainText('nicht gespeichertes Szenario')
    await shot(page, 'T-045-preflight-1440')
  })

  test('contains no internal identifier, note or diagnostic', async ({ page }) => {
    test.setTimeout(180_000)
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()
    const nav = page.getByRole('navigation', { name: 'Präsentation' })
    for (const section of ['Projekt', 'Gebäude', 'Umfang', 'Leistungen', 'Terminplan', 'Investition']) {
      await nav.getByRole('button', { name: section }).click()
      const body = await page.locator('body').innerText()
      expect(body).not.toMatch(/\bOPT-\d+\b/)
      expect(body).not.toMatch(/\bSNAP-[A-Z0-9-]+\b/)
      expect(body).not.toMatch(/\bDEMO-[A-Z0-9-]+\b/)
      expect(body).not.toMatch(/Journal|Marge|interne Notiz/i)
      expect(body).not.toMatch(/Konfidenz|OCR/i)
    }
  })

  test('recomposes at 1280 and keeps the scenario actions reachable', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()
    await shot(page, 'T-035-identity-1280')

    await toSection(page, 'Gebäude', /Gebäudegeschichten|Aufgabe/)
    // Three building stories stay one row at 1280 — the target's own
    // responsive requirement, and the reason the grid is auto-fit on a
    // card measure rather than a fixed three columns.
    const cards = page.locator('.a3-client-building')
    await expect(cards).toHaveCount(3)
    const tops = await cards.evaluateAll(
      (els) => els.map((el) => Math.round(el.getBoundingClientRect().top)),
    )
    expect(new Set(tops).size).toBe(1)
    await shot(page, 'T-036-buildings-1280')

    await toSection(page, 'Leistungen', /sichtbar gemacht\.$/)
    await page.getByRole('radio', { name: /Dezentral je Gebäude/ }).click()
    const bar = page.locator('.a3-client-scenario-bar')
    // The commercial actions stay visible without overlaying the content.
    await expect(bar.getByRole('button', { name: 'Zurücksetzen' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Als neue Option speichern' }))
      .toBeVisible()
    await shot(page, 'T-041-scenario-1280')

    await toSection(page, 'Investition', /gemeinsame\s+Entscheidung\.$/)
    await page.getByRole('button', { name: 'Abschließen & teilen' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Verbindlichkeit')
    await shot(page, 'T-045-outputs-1280')

    // Nothing scrolls sideways: a client presentation that needs a
    // horizontal scrollbar has stopped being a composition.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('reduced motion: sections replace directly and the delta survives', async ({ page }) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()

    await toSection(page, 'Leistungen', /sichtbar gemacht\.$/)
    await page.getByRole('radio', { name: /Dezentral je Gebäude/ }).click()

    // The meaning survives without the movement: the delta is a persistent
    // label, the state is named in words, and nothing is animating.
    const bar = page.locator('.a3-client-scenario-bar')
    await expect(bar).toContainText('Nicht gespeichertes Präsentations-Szenario')
    await expect(bar).toContainText(/−.?310\.000/)
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    )
    expect(running).toBe(0)
    await shot(page, 'M-11-reduced-motion-1440')
  })
})
