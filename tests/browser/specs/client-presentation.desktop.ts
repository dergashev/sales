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
    /**
     * VR3-TGA-01: a chapter may present its decisions inside SYSTEMS that
     * open one at a time. An outstanding decision inside a collapsed system
     * is real work the user has to do, so the walk has to do it too — the
     * previous version simply never saw those controls and then failed on
     * the forward action they block, which is the correct refusal reported
     * at the wrong place.
     */
    const systems = page.locator('.a3-sys-btn')
    const systemCount = await systems.count()
    for (let sys = 0; sys < systemCount; sys += 1) {
      const button = systems.nth(sys)
      const state = await button.locator('.a3-sys-state').innerText().catch(() => '')
      if (!/offen/i.test(state)) continue
      if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
      const open = page.locator('.a3-sys-body:not([hidden])').getByRole('radiogroup')
      const openCount = await open.count()
      for (let i = 0; i < openCount; i += 1) {
        const group = open.nth(i)
        if (await group.getByRole('radio', { checked: true }).count() > 0) continue
        // The first alternative — the All3 standard where one is marked.
        await group.locator('label').first().click()
      }
      await button.click()
    }
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
    /**
     * VR3-TGA-01 moved this number, and the move is the fix.
     *
     * It read −310 000 €: the plant-concept delta alone. Switching to
     * per-building plants used to change no other row and left a shared-plant
     * heat generator included at + 1 240 000 €, so the scenario priced a
     * configuration that cannot be built — in the one place a client sees it.
     * The cascade now drops that row with its parent.
     */
    await expect(bar).toContainText(/−.?1\.550\.000/)
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
    await expect(bar).toContainText(/−.?1\.550\.000/)
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    )
    expect(running).toBe(0)
    await shot(page, 'M-11-reduced-motion-1440')
  })

  /**
   * M-10 — "Heading receives programmatic focus".
   *
   * ACCEPTANCE REMEDIATION (cycle 2). The reproduction the auditor recorded:
   * navigate to Terminplan, wait 700 ms, and `document.activeElement` is
   * BODY. Cause: the focus effect fired on the state change, but
   * `AnimatePresence mode="wait"` mounts the incoming page only after the
   * outgoing one has exited — so it addressed the heading that was leaving.
   *
   * This walks EVERY transition rather than the one that was reported: the
   * defect was in the mechanism, not in one section, and a test that only
   * covers Terminplan would let the same mechanism fail anywhere else.
   */
  test('M-10: every section move lands focus on the incoming heading', async ({ page }) => {
    test.setTimeout(180_000)
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()

    const sections: Array<[string, RegExp]> = [
      ['Terminplan', /^Ein abgestimmter Weg/],
      ['Gebäude', /Gebäudegeschichten|Aufgabe/],
      ['Investition', /gemeinsame\s+Entscheidung\.$/],
      ['Umfang', /Umfang\.$/],
      ['Leistungen', /sichtbar gemacht\.$/],
      ['Projekt', /Quartier/],
    ]
    for (const [label, heading] of sections) {
      await toSection(page, label, heading)
      // The auditor's own wait, so a pass here answers the same question.
      await page.waitForTimeout(700)
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return { tag: el?.tagName ?? null, text: el?.textContent?.trim() ?? null }
      })
      expect(focused.tag, `focus after navigating to ${label}`).toBe('H1')
      expect(focused.text).toMatch(heading)
    }

    // A focus move a keyboard user cannot SEE is only half of M-10. The strip
    // is a NAVIGATION of ordinary buttons — not a tablist, so Tab and Enter
    // are the right keys and arrows are correctly inert — and committing one
    // from the keyboard must land a visible ring on the incoming heading
    // rather than a silent caret.
    await page.getByRole('navigation', { name: 'Präsentation' })
      .getByRole('button', { name: 'Leistungen' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/sichtbar gemacht\.$/)
    await page.waitForTimeout(700)
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      return { tag: el.tagName, visible: el.matches(':focus-visible') }
    })
    expect(ring?.tag).toBe('H1')
    expect(ring?.visible, 'the incoming heading shows a visible focus ring').toBe(true)
    // The width is READ, never asserted: this file is also run at 1280, and a
    // 1280 frame filed under a 1440 name is the kind of evidence that proves
    // whatever the reader already believes.
    const w = page.viewportSize()?.width ?? 0
    await shot(page, `M-10-heading-focus-${w}`)
  })

  test('M-10 under reduced motion: the direct cut still moves focus', async ({ page }) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await reachClientMode(page)
    await page.getByRole('button', { name: 'Präsentation starten' }).click()

    await toSection(page, 'Terminplan', /^Ein abgestimmter Weg/)
    await page.waitForTimeout(700)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    await toSection(page, 'Investition', /gemeinsame\s+Entscheidung\.$/)
    await page.waitForTimeout(700)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')
  })

  /**
   * The other half of the same mechanism, and the one that keeps M-10 from
   * becoming a nuisance: focus follows a DOCUMENT TRANSITION, never an
   * ordinary re-render.
   *
   * Entering Client Mode is a document transition and already has an owner —
   * `App.tsx`'s scroll-and-focus effect, whose dependencies include
   * `s.mode`, established long before VR3-05 ("after the transition
   * `activeElement` stayed BODY and no context was announced"). The shell's
   * own rule must therefore SETTLE on the boundary rather than fire a second
   * time at it: one focus move for one transition.
   *
   * Choosing a scenario option is the opposite case. The screen recalculates
   * — new total, new delta, a re-render of the whole narrative page — but
   * the presenter has not gone anywhere, so the radio they just pressed must
   * keep the caret. Deriving the wanted key during render is exactly what
   * buys this: the key is unchanged, so the ref spends nothing.
   */
  test('focus follows a document transition, not a recalculation', async ({ page }) => {
    test.setTimeout(180_000)
    await reachClientMode(page)

    // Mode entry: one owner, one move, landing on the boundary heading.
    await expect(page.getByRole('heading', { level: 1 }))
      .toContainText('Eine gespeicherte Option zeigen')
    const onEntry = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? null,
      text: document.activeElement?.textContent?.trim() ?? null,
    }))
    expect(onEntry.tag).toBe('H1')
    expect(onEntry.text).toMatch(/Eine gespeicherte Option zeigen/)

    await page.getByRole('button', { name: 'Präsentation starten' }).click()
    await toSection(page, 'Leistungen', /sichtbar gemacht\.$/)

    // A live what-if: the money changes, the presenter does not move.
    const decentral = page.getByRole('radio', { name: /Dezentral je Gebäude/ })
    await decentral.click()
    await expect(page.locator('.a3-client-scenario-bar')).toContainText(/−.?1\.550\.000/)
    await page.waitForTimeout(700)
    const afterDecision = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? null,
      role: document.activeElement?.getAttribute('role')
        ?? (document.activeElement as HTMLInputElement | null)?.type
        ?? null,
    }))
    expect(afterDecision.tag, 'a recalculation must not pull focus to the heading')
      .not.toBe('H1')
    expect(afterDecision.role).toBe('radio')
  })

  /**
   * ACCEPT-02 — the scenario bar stays actionable WITHOUT overlaying the
   * story it is a delta from.
   *
   * The bar used to be the last child of the scrolling `<main>`, held in
   * view by `position: sticky; bottom: 0`, and the narrative page inside
   * that `<main>` carried `min-height: 0` — which defeats a column flex
   * item's automatic minimum size, so the page was laid out shorter than
   * its own content and, having no `overflow` of its own, simply painted
   * that content outside its box. The two together are why the Terminplan
   * section — the tallest one, and the one carrying the phased-handover
   * what-if — put its choice labels behind the bar at BOTH approved
   * viewports (1440×900: labels y802–958 behind a bar at y818–900) and why
   * scrolling could not free them: there was nothing to scroll, because the
   * page had never claimed the height its content needed.
   *
   * A DOM test cannot see any of this. The markup was correct and the
   * control was present, focusable and clickable — it was simply not
   * READABLE, which is a geometry fact and belongs here.
   *
   * So this asserts the two halves of §17's "the scenario bar remains fully
   * actionable" as GEOMETRY:
   *
   *   1. the bar occupies its own band — it does not intersect the region
   *      the narrative is laid out in, so it cannot cover anything at any
   *      content height, at rest or scrolled;
   *   2. the scenario choice is fully READABLE inside that region — the
   *      whole control, not a bisected fragment.
   *
   * It must not be satisfied by deleting the lever, so the control's
   * existence is asserted first: the phased-handover decision is part of
   * the demonstration fixture and part of this ticket's scope.
   */
  for (const [w, h] of [[1440, 900], [1280, 800]] as const) {
    test(`ACCEPT-02: the scenario bar never covers a scenario choice at ${w}x${h}`,
      async ({ page }) => {
        test.setTimeout(180_000)
        await page.setViewportSize({ width: w, height: h })
        await reachClientMode(page)
        await page.getByRole('button', { name: 'Präsentation starten' }).click()
        await toSection(page, 'Terminplan', /^Ein abgestimmter Weg/)

        // The lever exists. A "fix" that removed the phased-handover choice
        // would satisfy every geometry assertion below and fail the ticket.
        const choices = page.locator('.a3-client-schedule-decision label')
        expect(await choices.count(),
          'the phased-handover what-if must still be offered')
          .toBeGreaterThan(0)

        /**
         * The bar's band and the narrative's band are disjoint.
         *
         * This is the structural claim, and it is what makes the defect
         * unrepeatable rather than merely absent on this fixture: while the
         * bar lives outside the scroll region, no content height can put
         * anything behind it.
         */
        const bands = await page.evaluate(() => {
          const main = document.querySelector('main')
          const bar = document.querySelector('.a3-client-scenario-bar')
          if (!main || !bar) return null
          const m = main.getBoundingClientRect()
          const b = bar.getBoundingClientRect()
          return {
            main: { top: m.top, bottom: m.bottom },
            bar: { top: b.top, bottom: b.bottom },
            scrollable: main.scrollHeight - main.clientHeight,
            contained: main.contains(bar),
          }
        })
        expect(bands).not.toBeNull()
        // The bar is not INSIDE the scroller — that is the fix, stated.
        expect(bands!.contained,
          'the scenario bar must not live inside the scrolling narrative')
          .toBe(false)
        expect(bands!.bar.top,
          'the bar must begin at or below the end of the narrative region')
          .toBeGreaterThanOrEqual(bands!.main.bottom - 1)
        // And it is fully on screen: "actionable" is the other half of the
        // requirement, and a bar pushed off the bottom would pass the
        // no-overlap check by not being there.
        expect(bands!.bar.bottom).toBeLessThanOrEqual(h + 1)
        expect(bands!.bar.top).toBeGreaterThanOrEqual(0)

        /**
         * And the choice is fully readable inside the narrative region.
         *
         * The page now claims the height its content needs, so the surplus
         * is SCROLLABLE rather than painted outside the box — this asserts
         * the consequence a presenter cares about: after bringing the
         * decision into view, the whole card is visible, not a headless
         * fragment cut off mid-sentence.
         */
        await choices.first().scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        const clipped = await page.evaluate(() => {
          const main = document.querySelector('main')
          if (!main) return ['no narrative region']
          const m = main.getBoundingClientRect()
          const hits: string[] = []
          for (const el of document.querySelectorAll('.a3-client-schedule-decision label')) {
            const r = el.getBoundingClientRect()
            if (r.top < m.top - 1 || r.bottom > m.bottom + 1) {
              hits.push(`${(el.textContent ?? '').trim().slice(0, 40)}`
                + ` @ ${Math.round(r.top)}-${Math.round(r.bottom)}`
                + ` vs narrative ${Math.round(m.top)}-${Math.round(m.bottom)}`)
            }
          }
          return hits
        })
        expect(clipped,
          'a scenario choice must be readable in full, not bisected')
          .toEqual([])

        await shot(page, `ACCEPT-02-schedule-scenario-bar-${w}`)
      })
  }

  /**
   * ACCEPT-01 — what the browser would actually PRINT.
   *
   * `@media print` hides the narrative and prints the client-safe document,
   * so what a client keeps is only ever visible under print media. Reading
   * the page's own text under `emulateMedia({ media: 'print' })` is the only
   * place the cover-sheet defect was observable at all — which is exactly
   * why it passed three green cycles.
   */
  test('ACCEPT-01: the printed document contains the six client sections',
    async ({ page }) => {
      test.setTimeout(180_000)
      await reachClientMode(page)
      await page.getByRole('button', { name: 'Präsentation starten' }).click()

      await page.emulateMedia({ media: 'print' })
      const printed = await page.evaluate(() => document.body.innerText)

      // Section headings are `text-transform: uppercase`, and `innerText`
      // returns the TRANSFORMED text — so the comparison is case-folded
      // rather than asserting the casing the stylesheet chose.
      const folded = printed.toLocaleLowerCase('de-DE')
      for (const section of ['Projekt', 'Gebäude', 'Umfang', 'Leistungen',
        'Terminplan', 'Investition', 'Annahmen']) {
        expect(folded, `the printed sheet must contain "${section}"`)
          .toContain(section.toLocaleLowerCase('de-DE'))
      }
      // Option, version and date (§16), and the lead metric with its unit.
      expect(printed).toMatch(/Version\s*1/)
      expect(printed).toContain('€/m²')
      // Nothing internal came with the extra content.
      expect(printed).not.toMatch(/\bDEMO-[A-Z0-9-]+\b/)
      expect(printed).not.toMatch(/Konfidenz|OCR|Marge/i)

      await shot(page, 'ACCEPT-01-print-media-1440')
      await page.emulateMedia({ media: 'screen' })
    })
})
