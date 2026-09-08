import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  CLIENT_PRESENTATION as CP, DEMO_COMPLEX_PROJECT_NAME, KONFIGURATOR_GATE, NAV, OPPORTUNITY,
} from '../anchors'
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * VR3-05 / VR3-CP-00 — the client presentation, walked as a presenter walks it.
 *
 * The Client Mode is a ten-chapter proposal narrative (PresentationShell,
 * model C "Bühne & Ebene"): one chapter on stage at a time, a single
 * presenter bar (`.a3-cp-bar`) that carries the chapter rail, the Varianten
 * layer (comparison + what-ifs, present only with ≥ 2 eligible Options) and
 * chapter-specific evidence layers. There is no entry boundary any more:
 * entering lands on chapter 1.
 *
 * Every state below is reached through the product's own gates — the Option
 * is configured, scheduled, reviewed and SAVED before Client Mode exists —
 * so a broken gate fails here rather than being stepped over. Screenshots
 * go to `.artifacts/vr3-05`, named for the claim they evidence.
 */

const EVIDENCE = '.artifacts/vr3-05'

/* ───────────────────────────── small helpers ─────────────────────────── */

async function settle(page: Page) {
  // Chapter swaps are an AnimatePresence `mode="wait"` pair; photographing
  // between exit and enter records the previous chapter under the new rail
  // state. Waiting for "no animation running" is the honest wait and costs
  // nothing under reduced motion.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== 'running'),
    undefined, { timeout: 5_000 },
  ).catch(() => {})
}

async function shot(page: Page, name: string) {
  await settle(page)
  const w = page.viewportSize()?.width ?? 0
  await page.screenshot({ path: `${EVIDENCE}/${name}-${w}.png`, fullPage: false })
}

// The landmark is named in the CLIENT's language, so both names resolve it.
const rail = (page: Page) => page.getByRole('navigation', {
  name: new RegExp(`^(${CP.railLabel}|${CP.railLabelEn})$`),
})
const chapterButtons = (page: Page) => rail(page).getByRole('listitem').getByRole('button')
const bar = (page: Page) => page.locator(CP.cls.bar)

/** `aria-label="{n} · {label}"` → the chapter's label. */
async function chapterLabel(button: Locator): Promise<string> {
  const aria = (await button.getAttribute('aria-label')) ?? ''
  return aria.split(' · ').slice(1).join(' · ').trim()
}

/** The labels of every PRESENT chapter, in rail order. */
async function presentChapters(page: Page): Promise<string[]> {
  const items = chapterButtons(page)
  const n = await items.count()
  const labels: string[] = []
  for (let i = 0; i < n; i += 1) labels.push(await chapterLabel(items.nth(i)))
  return labels
}

/**
 * Navigate by chapter label and wait until the stage has actually moved.
 *
 * The rail button is clicked as a pointer would click it. If the pointer
 * cannot reach it (Chromium reports another element intercepting), that is
 * recorded as a SOFT failure with the interceptor named, and the walk
 * continues by the presenter's keyboard shortcuts so the remaining claims
 * of the test are still verified rather than lost behind a timeout.
 */
async function toChapter(page: Page, label: string) {
  const button = rail(page).getByRole('button', { name: new RegExp(`^\\d+ · ${label}$`) })
  let intercepted: string | null = null
  await button.click({ timeout: 5_000 }).catch((error: Error) => {
    intercepted = error.message.split('\n').find((l) => /intercepts pointer events/.test(l))?.trim()
      ?? error.message.split('\n')[0]!
  })
  if (intercepted) {
    expect.soft(intercepted, `the rail button "${label}" must be reachable by pointer`).toBeNull()
    const labels = await presentChapters(page)
    const from = labels.indexOf(await chapterLabel(rail(page).locator('[aria-current="step"]')))
    const to = labels.indexOf(label)
    await page.locator('main').focus()
    for (let i = 0; i < Math.abs(to - from); i += 1) {
      await page.keyboard.press(to > from ? 'ArrowRight' : 'ArrowLeft')
    }
  }
  await expect(button).toHaveAttribute('aria-current', 'step')
  // The rail flips `aria-current` from store state the moment it is clicked,
  // while `AnimatePresence mode="wait"` still has the OUTGOING chapter (and
  // its own single h1) on screen. Waiting only for those two therefore
  // returns with the previous chapter still painted — which is how a
  // one-shot assertion in this file came to measure chapter 1's colours
  // while the rail already said chapter 2. The incoming chapter's own
  // landmark is the honest signal that the swap finished.
  await expect(page.getByRole('region', { name: label })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
}

/**
 * The bar's contract: one row, constant height WHATEVER the Option count —
 * and the rail must still show every chapter button in full. A rail
 * squeezed into an overflow sliver puts chapter buttons under the step
 * arrows, and a presenter cannot reach a chapter the client is asking for.
 * Measured as what a pointer at each button's centre would actually hit.
 */
async function railGeometry(page: Page) {
  return page.evaluate((sel) => {
    const nav = document.querySelector(`${sel} nav`)!
    const list = nav.querySelector('ol')!
    const covered = Array.from(list.querySelectorAll('button')).flatMap((b) => {
      const r = b.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (hit && b.contains(hit)) return []
      const label = hit?.closest('[aria-label]')?.getAttribute('aria-label') ?? hit?.tagName ?? 'nothing'
      return [`${b.getAttribute('aria-label')} → ${label}`]
    })
    return {
      barHeight: document.querySelector(sel)!.getBoundingClientRect().height,
      railWidth: Math.round(nav.getBoundingClientRect().width),
      railOverflow: nav.scrollWidth - nav.clientWidth,
      listOverflow: list.scrollWidth - list.clientWidth,
      covered,
    }
  }, CP.cls.bar)
}

async function activeElement(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      tag: el?.tagName ?? null,
      isTheHeading: el !== null && el === document.querySelector('h1'),
      role: el?.getAttribute('role') ?? (el as HTMLInputElement | null)?.type ?? null,
      focusVisible: el?.matches(':focus-visible') ?? false,
    }
  })
}

/** The grouped euro amount in a text, e.g. `38.740.000` — never hard-coded. */
function amountIn(text: string): string {
  const m = text.match(/\d{1,3}(?:\.\d{3}){2,}/)
  if (!m) throw new Error(`no grouped amount in: ${text.slice(0, 120)}`)
  return m[0]
}

/**
 * One projection, one number: the total on chapter 2's hero is the total on
 * chapter 5's sum row and the total on the printed sheet. Returns the amount
 * so a caller can compare states, never a fixture literal.
 */
async function assertOneTotal(page: Page): Promise<string> {
  await toChapter(page, 'Projektüberblick')
  const total = amountIn(await page.locator(CP.cls.heroTotal).innerText())
  await toChapter(page, 'Preiszusammensetzung')
  await expect(page.locator('main')).toContainText(total)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator(CP.cls.printTotal)).toContainText(total)
  await page.emulateMedia({ media: 'screen' })
  return total
}

const NOT_CLIENT_SAFE = [
  /\bOPT-\d+\b/, /\bSNAP-[A-Z0-9-]+\b/, /\bDEMO-[A-Z0-9-]+\b/,
  /Journal|Marge|interne Notiz/i, /Konfidenz|OCR/i,
  // Preparation vocabulary that must never reach the client tree.
  /gespeichert|Version \d|Vorbereitung|Kapitel \d+ von \d+/i,
]

/* ───────────────────────── the walk into Client Mode ─────────────────── */

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
  /**
   * VR3-KG-UNIFY-00: every chapter presents its decisions inside SYSTEMS that
   * open one at a time, and a per-building chapter (KG 300) shows ONE
   * building's rows while its completion counts every building. So one
   * chapter may take several passes: answer the visible systems, and if the
   * forward action is still blocked, switch to the next building the band
   * offers and answer again. The band names the buildings still owing a
   * decision, which is exactly what a user follows.
   */
  const answerVisibleSystems = async () => {
    const systems = page.locator('.a3-sys-btn')
    const systemCount = await systems.count()
    for (let sys = 0; sys < systemCount; sys += 1) {
      const button = systems.nth(sys)
      const state = await button.locator('.a3-sys-state').innerText().catch(() => '')
      if (!/offen|open/i.test(state)) continue
      if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
      /**
       * A decision commits on an EXPLICIT Übernehmen (decision pattern
       * contract), and a committed editor LEAVES the DOM. So the open groups
       * are re-queried on every pass rather than counted once.
       */
      for (let pass = 0; pass < 8; pass += 1) {
        const body = page.locator('.a3-sys-body:not([hidden])')
        const groups = body.getByRole('radiogroup')
        const total = await groups.count()
        let group = null
        for (let i = 0; i < total; i += 1) {
          if (await groups.nth(i).getByRole('radio', { checked: true }).count() === 0) {
            group = groups.nth(i)
            break
          }
        }
        if (!group) break
        /**
         * The SAME answer the rest of this walk gives: an include/exclude
         * decision is recorded as NOT included — the fixture baseline the
         * declared demonstration totals hold at. The pair is recognised by
         * its VALUES (`included`/`excluded`), because a scope decision may
         * carry the domain's own words (`Nicht im All3-Leistungsumfang`).
         * A decision among real ALTERNATIVES takes the first.
         */
        const exclude = group.locator('input[value="excluded"]')
        if (await exclude.count() > 0) await group.locator('label:has(input[value="excluded"])').click()
        else await group.locator('label').first().click()
        const apply = body.getByRole('button', { name: /^(Übernehmen|Apply)$/ })
        if (await apply.count() > 0) await apply.first().click()
        else break
      }
      if (await button.getAttribute('aria-expanded') === 'true') await button.click()
    }
    // Legacy inline radiogroups, where a chapter still renders them.
    const groups = page.locator('.a3-kgp').getByRole('radiogroup')
    const count = await groups.count()
    for (let i = 0; i < count; i += 1) {
      const group = groups.nth(i)
      const radios = group.getByRole('radio')
      if (await radios.count() < 2) continue
      if (await group.getByRole('radio', { checked: true }).count() > 0) continue
      await group.locator('label').nth(1).click()
    }
  }

  // Six cost groups, then Schnittstellen & Verantwortung (VR3-TGA-UX-00),
  // then the forward action to the schedule — with one spare iteration.
  for (let chapter = 0; chapter < 9; chapter += 1) {
    const next = page.getByRole('button', { name: /^Weiter zu / })
    const blocked = async () => (await next.count()) > 0
      && (await next.first().getAttribute('aria-disabled')) === 'true'
    // One pass per building the band offers (plus the landing one). A second
    // round is taken while the forward action is still blocked: switching
    // the band re-renders the system list, and a pass that read the list
    // before the swap answers nothing for that building.
    const buildingSegments = page.locator('.a3-rahmen label:has(input[type="radio"])')
    const buildingCount = Math.max(await buildingSegments.count(), 1)
    for (let round = 0; round < 2; round += 1) {
      for (let b = 0; b < buildingCount; b += 1) {
        if (b > 0 || round > 0) {
          if (!(await blocked())) break
          if (buildingCount > 1) {
            await buildingSegments.nth(b).click()
            await expect(buildingSegments.nth(b).locator('input')).toBeChecked()
            await settle(page)
          }
        }
        await answerVisibleSystems()
      }
      if (!(await blocked())) break
    }
    const toSchedule = page.getByRole('button', { name: 'Weiter zum Terminplan' })
    if (await toSchedule.count() > 0
      && await toSchedule.getAttribute('aria-disabled') !== 'true') {
      await toSchedule.click()
      return
    }
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

async function saveOption(page: Page) {
  const save = page.getByRole('button', { name: 'Option speichern' })
  await expect(save).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await save.click()
  await expect(page.getByRole('button', { name: 'Kundenpräsentation starten' }))
    .toBeVisible({ timeout: 15_000 })
}

async function enterClientMode(page: Page) {
  await page.getByRole('button', { name: 'Kundenpräsentation starten' }).click()
  // The private preflight gate, then the stage — no boundary screen.
  const gateStart = page.getByRole('button', { name: 'Kundenansicht starten' })
  if (await gateStart.count() > 0) await gateStart.click()
  await expect(bar(page)).toBeVisible({ timeout: 15_000 })
  await expect(chapterButtons(page).first()).toHaveAttribute('aria-current', 'step')
}

/**
 * A SECOND saved Option, through the product: the receipt's "Weitere Option
 * anlegen" returns to the collection, the collection creates the Option, and
 * the same configure → schedule → review → save walk makes it eligible. The
 * Varianten layer — and with it every what-if — exists only with ≥ 2
 * eligible Options, so the scenario tests need this and nothing else does.
 */
async function createSecondSavedOption(page: Page) {
  await page.getByRole('button', { name: 'Weitere Option anlegen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Optionen/ }))
    .toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Weitere Option anlegen' }).click()
  // The saved Option offers `Präsentieren`; only the fresh one offers this.
  await page.getByRole('button', { name: OPPORTUNITY.openNewOption }).last().click()
  await expect(page.getByRole('heading', { level: 1, name: NAV.items.buildingScope }))
    .toBeVisible({ timeout: 15_000 })
  await saveBuildingScope(page)
  await decideScopeLedger(page)
  await configureAllChapters(page)
  await confirmScheduleAndReview(page)
  await saveOption(page)
}

async function reachClientMode(page: Page, opts: { secondOption?: boolean } = {}) {
  await page.goto('/')
  await reachOptionWorkspace(page, DEMO_COMPLEX_PROJECT_NAME)
  await saveBuildingScope(page)
  await decideScopeLedger(page)
  await configureAllChapters(page)
  await confirmScheduleAndReview(page)
  await saveOption(page)
  if (opts.secondOption) await createSecondSavedOption(page)
  await enterClientMode(page)
}

/** Open the Varianten layer and choose a what-if by its radio label. */
async function chooseWhatIf(page: Page, option: RegExp) {
  const trigger = bar(page).getByRole('button', { name: /^Varianten · \d+$/ })
  await trigger.click()
  const layer = page.getByRole('dialog', { name: CP.variantenTitle })
  await expect(layer).toBeVisible()
  await layer.getByRole('radio', { name: option }).click()
  return layer
}

/* ────────────────────────────────── tests ────────────────────────────── */

test.describe('VR3-05 · client presentation narrative, Varianten and outputs', () => {
  test.setTimeout(180_000)

  test('walks every present chapter of the narrative from a saved Option', async ({ page }) => {
    await reachClientMode(page)

    // Entry lands on chapter 1 with exactly one h1 — no boundary screen.
    const items = chapterButtons(page)
    const labels = await presentChapters(page)
    expect(labels.length).toBeGreaterThanOrEqual(8)
    // The present chapters are a subsequence of the fixed order; 1, 2, 5,
    // 6, 7, 9, 10 are unconditional.
    const order = labels.map((l) => CP.chapters.indexOf(l as typeof CP.chapters[number]))
    expect(order).not.toContain(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const mandatory of ['Angebot', 'Projektüberblick', 'Preiszusammensetzung',
      'Leistungsumfang', 'Terminplan', 'Grundlagen', 'Nächster Schritt']) {
      expect(labels).toContain(mandatory)
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(items.first()).toHaveAttribute('aria-current', 'step')
    await shot(page, 'CP-01-entry-chapter-1')

    // Every chapter: one h1, aria-current on exactly its own rail item.
    for (let i = 0; i < labels.length; i += 1) {
      await items.nth(i).click()
      await expect(items.nth(i)).toHaveAttribute('aria-current', 'step')
      await expect(rail(page).locator('[aria-current="step"]')).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const slug = labels[i]!.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      await shot(page, `CP-01-chapter-${String(i + 1).padStart(2, '0')}-${slug}`)
    }

    // The saved baseline is ONE number on the hero, the sum row and the sheet.
    await assertOneTotal(page)

    // Evidence layers open over the stage and Esc returns to the SAME chapter.
    await toChapter(page, 'Preiszusammensetzung')
    await page.getByRole('button', { name: 'Kostentreiber und Regionalfaktor' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'CP-01-layer-kostentreiber')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(rail(page).getByRole('button', { name: /Preiszusammensetzung$/ }))
      .toHaveAttribute('aria-current', 'step')

    // Presenter keys on the stage step chapters; Escape never exits.
    await items.nth(1).click()
    await page.locator('main').focus()
    await page.keyboard.press('ArrowRight')
    await expect(items.nth(2)).toHaveAttribute('aria-current', 'step')
    await page.keyboard.press('PageDown')
    await expect(items.nth(3)).toHaveAttribute('aria-current', 'step')
    await page.keyboard.press('ArrowLeft')
    await expect(items.nth(2)).toHaveAttribute('aria-current', 'step')
    await page.keyboard.press('PageUp')
    await expect(items.nth(1)).toHaveAttribute('aria-current', 'step')
    await page.keyboard.press('Escape')
    await expect(bar(page)).toBeVisible()

    // "Beenden" is the one way out.
    await bar(page).getByRole('button', { name: CP.exit }).click()
    await expect(bar(page)).toHaveCount(0, { timeout: 10_000 })
  })

  test('with one eligible Option the Varianten affordance is absent, not disabled', async ({ page }) => {
    await reachClientMode(page)
    await expect(bar(page).getByRole('button', { name: /Varianten/ })).toHaveCount(0)
    // And no what-if control is reachable anywhere on the client's screen.
    await expect(page.getByRole('radio', { name: /Dezentral je Gebäude/ })).toHaveCount(0)
  })

  /**
   * The scenario lifecycle — recompose, gate the outputs, revert, save as a
   * descendant — lives in the Varianten layer, which needs two eligible
   * Options. The second one is created through the product (see
   * `createSecondSavedOption`), which is why this test is the long one.
   */
  test('Varianten: recomposes a scenario, gates outputs, reverts and saves a descendant', async ({ page }) => {
    await reachClientMode(page, { secondOption: true })

    // With two eligible Options the actions gain `Varianten · 2`; the rail
    // must still show every chapter button in full.
    await shot(page, 'CP-02-bar-two-options')
    const atRest = await railGeometry(page)
    expect(atRest.barHeight).toBeLessThanOrEqual(56)
    expect(atRest.covered, `every chapter button receives its own pointer with two Options `
      + JSON.stringify(atRest)).toEqual([])

    const baseline = await assertOneTotal(page)

    const trigger = bar(page).getByRole('button', { name: /^Varianten · \d+$/ })
    await expect(trigger).toHaveText('Varianten · 2')
    await trigger.click()
    const layer = page.getByRole('dialog', { name: CP.variantenTitle })
    await expect(layer).toBeVisible()
    // The bounded comparison names both Options and offers the other one.
    await expect(layer.getByRole('table')).toBeVisible()
    await expect(layer.getByRole('button', { name: /zeigen$/ })).toHaveCount(1)
    await expect(layer.getByRole('heading', { level: 3, name: CP.whatIf })).toBeVisible()
    await shot(page, 'CP-02-varianten-layer')

    // What-if 1 — decentralised heat. VR3-TGA-01 cascade: −1 550 000 €, not
    // the −310 000 € plant-concept delta alone (see that ticket).
    await layer.getByRole('radio', { name: /Dezentral je Gebäude/ }).click()
    // A recalculation is not a document transition: the presenter keeps
    // the caret on the radio they just pressed.
    await page.waitForTimeout(700)
    expect((await activeElement(page)).role).toBe('radio')
    const scenario = page.locator(CP.cls.band).locator(CP.cls.scenarioSlot)
    await expect(scenario).toContainText('Was-wäre-wenn-Stand')
    await expect(scenario).toContainText(/−.?1\.550\.000/)

    // What-if 2 — gastronomy readiness composes with it.
    await layer.getByRole('radio', { name: /Gastronomie vorbereitet/ }).click()
    await expect(scenario).toContainText(/−.?1\.130\.000/)
    await shot(page, 'CP-02-whatif-two-changes')
    await layer.getByRole('button', { name: CP.variantenClose }).click()
    await expect(layer).toHaveCount(0)

    // The what-if slot joins the actions. The bar must still be one row of
    // ≤ 56 px AND keep the chapter rail reachable — the second half is the
    // one a wide slot can break, so it is measured, not assumed. Soft: the
    // rest of the lifecycle below is still worth verifying if it fails.
    await shot(page, 'CP-02-bar-with-scenario')
    const withScenario = await railGeometry(page)
    expect.soft(withScenario.barHeight, 'bar height with a what-if slot').toBeLessThanOrEqual(56)
    expect.soft(withScenario.covered, `every chapter button receives its own pointer with a `
      + `what-if slot ${JSON.stringify(withScenario)}`).toEqual([])

    // The narrative recomposed with it — one result on every surface, and a
    // different one from the saved baseline.
    const recomposed = await assertOneTotal(page)
    expect(recomposed).not.toBe(baseline)
    await shot(page, 'CP-02-preis-recomposed')

    // Chapter 10 — an unsaved scenario gates PDF/print and routes email.
    await toChapter(page, 'Nächster Schritt')
    await expect(page.getByText('Ein temporäres Szenario ist kein angenommenes Angebot'))
      .toBeVisible()
    const pdf = page.getByRole('button', { name: 'Prüfen & sichern' })
    await expect(pdf).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByRole('button', { name: 'Als neue Option speichern' }).last())
      .toBeVisible()
    await shot(page, 'CP-03-outputs-unsaved')
    await page.getByRole('checkbox', { name: /Was-wäre-wenn-Stand/ }).check()
    await expect(pdf).not.toHaveAttribute('aria-disabled', 'true')
    await pdf.click()
    await expect(page.getByRole('dialog')).toContainText('Was-wäre-wenn-Stand')
    await shot(page, 'CP-03-preflight-unsaved')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Revert names the count and leaves the presented Option untouched.
    await scenario.getByRole('button', { name: 'Zurücksetzen' }).click()
    const revert = page.getByRole('dialog')
    await expect(revert).toContainText('2 temporäre Änderungen')
    await shot(page, 'CP-04-revert')
    await revert.getByRole('button', { name: /Änderungen verwerfen/ }).click()
    await expect(scenario).toHaveCount(0)

    // Save as new Option: the descendant becomes the presented baseline and
    // a third eligible Option.
    await chooseWhatIf(page, /Dezentral je Gebäude/)
    await page.getByRole('dialog', { name: CP.variantenTitle })
      .getByRole('button', { name: CP.variantenClose }).click()
    await scenario.getByRole('button', { name: 'Als neue Option speichern' }).click()
    const save = page.getByRole('dialog')
    await expect(save).toContainText('Quelle:')
    await shot(page, 'CP-05-save-as-new')
    await save.getByRole('button', { name: 'Neue Option speichern', exact: true }).click()
    const receipt = page.locator(CP.cls.receipt)
    await expect(receipt).toContainText('angelegt')
    await shot(page, 'CP-05-save-receipt')
    await expect(scenario).toHaveCount(0)
    await expect(trigger).toHaveText('Varianten · 3')
  })

  test('gates outputs by authority: a saved Option opens all three outputs', async ({ page }) => {
    await reachClientMode(page)
    await toChapter(page, 'Nächster Schritt')
    await expect(page.getByRole('button', { name: 'Versand vorbereiten' })).toBeVisible()
    const pdf = page.getByRole('button', { name: 'Prüfen & sichern' })
    await expect(pdf).not.toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByText('Ein temporäres Szenario ist kein angenommenes Angebot'))
      .toHaveCount(0)
    await shot(page, 'CP-03-outputs-saved')

    // The preflight lists the chapters the document actually contains — the
    // rail's own list, not a fixed set.
    await pdf.click()
    const preflight = page.getByRole('dialog')
    await expect(preflight).toBeVisible()
    for (const label of await presentChapters(page)) {
      await expect(preflight.getByRole('listitem').filter({ hasText: label })).toHaveCount(1)
    }
    await shot(page, 'CP-03-preflight-saved')
    await page.keyboard.press('Escape')
    await expect(preflight).toHaveCount(0)
  })

  test('contains no internal identifier, note or diagnostic', async ({ page }) => {
    await reachClientMode(page)
    const sweep = async (context: string) => {
      const text = await page.locator(CP.cls.shell).innerText()
      for (const re of NOT_CLIENT_SAFE) {
        expect(text, `${context}: client screen must not match ${re}`).not.toMatch(re)
      }
    }
    const labels = await presentChapters(page)
    for (const label of labels) {
      await toChapter(page, label)
      await sweep(`DE · ${label}`)
      // Asset provenance is internal and cannot be seen by a text sweep:
      // `data-source-id` is an attribute. It reached the client tree on
      // chapters 1, 4 and 8 of the candidate this assertion was added for.
      expect(
        await page.locator(`${CP.cls.shell} [data-source-id]`).count(),
        `${label}: no asset provenance in the client DOM`,
      ).toBe(0)
    }
    // The client-safe print tree carries the same obligation.
    await page.emulateMedia({ media: 'print' })
    const printed = await page.locator(CP.cls.printDoc).innerText()
    for (const re of NOT_CLIENT_SAFE) {
      expect(printed, `print tree must not match ${re}`).not.toMatch(re)
    }
    await page.emulateMedia({ media: 'screen' })

    // EN is the same client, in the other language.
    await page.locator(CP.cls.languageEn).click()
    for (const label of [labels[0]!, 'Preiszusammensetzung', 'Nächster Schritt']) {
      const index = labels.indexOf(label)
      await chapterButtons(page).nth(index).click()
      await settle(page)
      await sweep(`EN · ${label}`)
    }
  })

  test('recomposes at 1280×800: one-row bar ≤ 56 px, no sideways scroll, actions reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await reachClientMode(page)

    const geometry = async () => page.evaluate((sel) => {
      const el = document.querySelector(sel)!
      const r = el.getBoundingClientRect()
      const children = Array.from(el.children).map((c) => c.getBoundingClientRect())
      return {
        height: r.height,
        // One row: every direct child is vertically inside the bar's box.
        oneRow: children.every((c) => c.top >= r.top - 1 && c.bottom <= r.bottom + 1),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    }, CP.cls.bar)

    const labels = await presentChapters(page)
    for (const label of labels) {
      await toChapter(page, label)
      const g = await geometry()
      expect(g.height, `bar height on ${label}`).toBeLessThanOrEqual(56)
      expect(g.oneRow, `bar is one row on ${label}`).toBe(true)
      expect(g.overflow, `no horizontal overflow on ${label}`).toBeLessThanOrEqual(0)
    }
    // Every presenter action stays reachable on the smaller frame.
    await expect(bar(page).getByRole('button', { name: CP.exit })).toBeVisible()
    await expect(page.locator(CP.cls.languageEn)).toBeVisible()
    await expect(rail(page).getByRole('button', { name: 'Nächstes Kapitel' })).toBeVisible()
    await expect(chapterButtons(page).last()).toBeVisible()
    await shot(page, 'CP-06-recomposition')
  })

  test('reduced motion: chapters replace directly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await reachClientMode(page)
    for (const label of ['Terminplan', 'Preiszusammensetzung', 'Nächster Schritt']) {
      await rail(page).getByRole('button', { name: new RegExp(`· ${label}$`) }).click()
      // Nothing animates, and the incoming chapter is already the only one.
      const running = await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      )
      expect(running, `no animation runs on the way to ${label}`).toBe(0)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    }
    await shot(page, 'M-11-reduced-motion')
  })

  /**
   * M-10 — "Heading receives programmatic focus". The defect the auditor
   * recorded was in the MECHANISM (`AnimatePresence mode="wait"` mounting the
   * incoming page after the focus effect ran), so every transition is
   * walked, not one.
   */
  test('M-10: every chapter move lands focus on the incoming heading', async ({ page }) => {
    await reachClientMode(page)
    const labels = await presentChapters(page)
    for (const label of [...labels.slice(1), labels[0]!]) {
      await toChapter(page, label)
      // The auditor's own wait, so a pass here answers the same question.
      await page.waitForTimeout(700)
      const focused = await activeElement(page)
      expect(focused.tag, `focus after navigating to ${label}`).toBe('H1')
      expect(focused.isTheHeading, `focus is on ${label}'s own heading`).toBe(true)
    }
    // Committed from the keyboard, the move must land a VISIBLE ring.
    await rail(page).getByRole('button', { name: /· Terminplan$/ }).focus()
    await page.keyboard.press('Enter')
    await expect(rail(page).getByRole('button', { name: /· Terminplan$/ }))
      .toHaveAttribute('aria-current', 'step')
    await page.waitForTimeout(700)
    const ring = await activeElement(page)
    expect(ring.tag).toBe('H1')
    expect(ring.focusVisible, 'the incoming heading shows a visible focus ring').toBe(true)
    await shot(page, 'M-10-heading-focus')
  })

  test('M-10 under reduced motion: the direct cut still moves focus', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await reachClientMode(page)
    for (const label of ['Terminplan', 'Grundlagen', 'Angebot']) {
      await toChapter(page, label)
      await page.waitForTimeout(700)
      expect((await activeElement(page)).tag, `focus after ${label}`).toBe('H1')
    }
  })

  /**
   * Focus follows a DOCUMENT TRANSITION, never an ordinary re-render. Mode
   * entry is App.tsx's transition and lands on chapter 1's heading exactly
   * once — the shell's own rule must settle there rather than fire again.
   *
   * The recalculation half of this claim (a what-if changes the money, the
   * presenter keeps the caret on the radio) is asserted in the Varianten
   * test, the only place the control is reachable. A DE→EN switch was tried
   * as a one-Option stand-in and is NOT asserted: it moves focus to the
   * chapter heading, and whether a language switch counts as a document
   * transition is a product call, not this test's (reported).
   */
  test('focus follows a document transition, not a recalculation', async ({ page }) => {
    await reachClientMode(page)
    const onEntry = await activeElement(page)
    expect(onEntry.tag).toBe('H1')
    expect(onEntry.isTheHeading, 'entry lands on chapter 1\'s heading').toBe(true)
    // The rule spends nothing on a plain re-render of the same chapter: the
    // Kostentreiber layer opens and closes, and focus returns to its trigger.
    await toChapter(page, 'Preiszusammensetzung')
    await page.getByRole('button', { name: 'Kostentreiber und Regionalfaktor' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.waitForTimeout(700)
    const after = await activeElement(page)
    expect(after.tag, 'closing a layer must not pull focus to the heading').toBe('BUTTON')
  })

  /**
   * ACCEPT-02 — nothing in the bar covers content. The stage is a sibling of
   * the bar, laid out below it; this asserts that geometry at both approved
   * viewports, plus a bar height that leaves the proposal the screen.
   */
  for (const [w, h] of [[1440, 900], [1280, 800]] as const) {
    test(`ACCEPT-02: the bar covers no content at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await reachClientMode(page)
      const bands = await page.evaluate((sel) => {
        const barEl = document.querySelector(sel)!
        const main = document.querySelector('main')!
        const h1 = document.querySelector('h1')!
        const b = barEl.getBoundingClientRect()
        const m = main.getBoundingClientRect()
        const t = h1.getBoundingClientRect()
        return {
          barHeight: b.height, barBottom: b.bottom, mainTop: m.top,
          contained: barEl.contains(main) || main.contains(barEl),
          h1: { top: t.top, bottom: t.bottom, left: t.left, right: t.right },
        }
      }, CP.cls.bar)
      expect(bands.barHeight).toBeLessThanOrEqual(56)
      expect(bands.contained, 'bar and stage are siblings').toBe(false)
      expect(bands.mainTop, 'the stage begins below the bar').toBeGreaterThanOrEqual(bands.barBottom - 1)
      // The first chapter's heading is fully on screen and below the bar.
      expect(bands.h1.top).toBeGreaterThanOrEqual(bands.barBottom - 1)
      expect(bands.h1.bottom).toBeLessThanOrEqual(h)
      expect(bands.h1.left).toBeGreaterThanOrEqual(0)
      expect(bands.h1.right).toBeLessThanOrEqual(w)
      await shot(page, 'ACCEPT-02-bar-and-stage')
    })
  }

  /**
   * ACCEPT-01 — what the browser would actually PRINT. `@media print` hides
   * the stage and shows the client-safe document, so its content is only
   * observable under print media.
   */
  /**
   * ACCEPTANCE REMEDIATION — the layer and the stage are one reading.
   *
   * The Varianten comparison used to build its scope rows from the legacy
   * per-building map while the chapters read the declared client projection,
   * so a client saw another fixture's building names and a completion date
   * the stage contradicted for the very same Option.
   */
  test('the Varianten comparison agrees with the chapters it compares', async ({ page }) => {
    await reachClientMode(page, { secondOption: true })
    const labels = await presentChapters(page)

    await toChapter(page, 'Terminplan')
    const scheduleText = await page.locator(CP.cls.stage).innerText()

    await toChapter(page, labels.includes('Die Gebäude') ? 'Die Gebäude' : 'Das Projekt')
    const buildingsText = await page.locator(CP.cls.stage).innerText()

    await page.getByRole('button', { name: /^(Varianten|Variants) · \d+$/ }).click()
    const layer = page.getByRole('dialog')
    await expect(layer).toBeVisible()
    // The canonical choice control puts the whole label in the hit area and
    // keeps the input `sr-only`, so a pointer reaches the label — clicking
    // the input is intercepted, exactly as the DOM suites already note.
    await layer.locator('label:has(input[value="all"])').click()

    const rowText = async (label: RegExp) => {
      const row = layer.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label }) })
      if (await row.count() === 0) return null
      return (await row.first().locator('td').first().innerText()).trim()
    }

    // No legacy fixture name may appear anywhere in the layer.
    expect(await layer.innerText()).not.toMatch(/\bHaus [A-Z]\b/)

    const completion = await rowText(/Geplante Fertigstellung|Planned completion/)
    if (completion) {
      expect(scheduleText, 'the layer states the completion the chapter states')
        .toContain(completion)
    }
    const buildings = await rowText(/Gebäude im Angebot|Buildings in the proposal/)
    if (buildings) {
      for (const part of buildings.split(' · ')) {
        if (!/^[A-Z]$/.test(part.trim())) continue
      }
      const first = buildings.split(' · ').slice(1, 2)[0]
      if (first) {
        expect(buildingsText, 'the layer names buildings the chapter names').toContain(first)
      }
    }
    await shot(page, 'ACCEPT-01-varianten-vs-stage')
  })

  /**
   * ACCEPTANCE REMEDIATION — the total is the one permitted brand accent
   * (rule 31 and rule 5), and only on the white surface.
   */
  test('chapter 2 states the total in the brand accent, and nothing else does', async ({ page }) => {
    await reachClientMode(page)
    await toChapter(page, 'Projektüberblick')
    const accentTexts = () => page.evaluate((shell) => {
      const out: string[] = []
      for (const node of document.querySelectorAll(`${shell} *`)) {
        const colour = getComputedStyle(node).color
        if (colour === 'rgb(253, 94, 0)' && (node.textContent ?? '').trim().length > 0) {
          out.push((node.textContent ?? '').trim().slice(0, 40))
        }
      }
      return out
    }, CP.cls.shell)
    await expect
      .poll(async () => (await accentTexts()).length,
        { message: 'the total carries the brand accent' })
      .toBeGreaterThan(0)
    // Rule 31: ONE accent on the chapter. The accented nodes are the total
    // and the parts of it — its unit sits on the same baseline and inherits
    // the colour, which is the approved treatment — and nothing else.
    const accents = await accentTexts()
    const total = (await page.locator('.a3-cp-metric-lead').first().innerText()).replace(/\s/g, '')
    expect(total, 'the lead metric states the total').toMatch(/\d/)
    expect(accents.every((text) => total.includes(text.replace(/\s/g, ''))),
      `every accented node belongs to the total "${total}": ${JSON.stringify(accents)}`)
      .toBe(true)
    await shot(page, 'ACCEPT-03-accent')
  })

  /**
   * ACCEPTANCE REMEDIATION (ACCEPT-08) — an area states the same NUMBER in
   * both languages, on the stage and on the printed sheet.
   *
   * Three chapters summed the already-formatted per-building strings and
   * parsed them back with a German-only parser; a fourth localised an
   * already-localised figure. An English reader of a 17.250,00 m² project
   * was shown `17.25`, `98,001.24` and `17.250.0`. Every existing sweep was
   * blind to it: they prove a translation exists, not that a numeral
   * survived translation.
   */
  test('every client area figure is the same number in DE and EN', async ({ page }) => {
    await reachClientMode(page)
    const labels = await presentChapters(page)

    /**
     * Every figure the chapter states in its OWN fact rows and metric notes,
     * as numbers, in reading order. Not only the ones with a unit beside
     * them: chapter 3 puts `(m²)` in the row LABEL and the bare figure in
     * the value, which is exactly the shape the broken parser corrupted.
     *
     * Deliberately not the whole chapter text: the schedule's canonical
     * Gantt renders its own dates and axis, which this ticket does not own.
     */
    const figuresOnScreen = async (language: 'de' | 'en') => page.evaluate(
      ({ shell, lang }) => {
        const scope = document.querySelector(shell)
        const text = [...(scope?.querySelectorAll(
          '.a3-cp-row-value, .a3-cp-metric-note, .a3-cp-metric-lead, .a3-cp-metric-co, .a3-cp-sub',
        ) ?? [])].map((n) => (n as HTMLElement).innerText).join(' | ')
        const out: number[] = []
        for (const match of text.matchAll(/\d[\d.,\u202f\u00a0]*\d|\d/g)) {
          const raw = match[0].replace(/[\u202f\u00a0]/g, '')
          const value = lang === 'de'
            ? raw.replace(/\./g, '').replace(',', '.')
            : raw.replace(/,/g, '')
          const n = Number(value)
          if (Number.isFinite(n)) out.push(n)
        }
        return out
      }, { shell: CP.cls.shell, lang: language })

    const de = new Map<string, number[]>()
    for (const label of labels) {
      await toChapter(page, label)
      de.set(label, await figuresOnScreen('de'))
    }
    expect([...de.values()].flat().length, 'the narrative states figures at all')
      .toBeGreaterThan(10)

    await page.locator(CP.cls.languageEn).click()
    await settle(page)
    const enLabels = await presentChapters(page)
    expect(enLabels.length, 'the same chapters exist in English').toBe(labels.length)

    for (let i = 0; i < enLabels.length; i += 1) {
      await toChapter(page, enLabels[i]!)
      const en = await figuresOnScreen('en')
      // Every number a client reads is the same number in both languages.
      expect(en, `chapter ${i + 1} (${labels[i]} / ${enLabels[i]}) states the same figures`)
        .toEqual(de.get(labels[i]!))
    }
    await shot(page, 'ACCEPT-08-en-areas')

    // The printed sheet carries the same obligation, in the language it is
    // printed in — it is the artefact the client keeps.
    await page.emulateMedia({ media: 'print' })
    const printed = await page.locator(CP.cls.printDoc).innerText()
    for (const match of printed.matchAll(/(\d[\d.,\u202f\u00a0 ]*\d)\s*m²/g)) {
      const raw = match[1]!.replace(/[\u202f\u00a0 ]/g, '')
      expect(raw, `the printed sheet states an English area, not a German one: ${raw}`)
        .not.toMatch(/\.\d{3}/)
    }
    await page.emulateMedia({ media: 'screen' })
    await page.locator(CP.cls.languageDe).click()
  })

  test('ACCEPT-01: the printed document carries the chapters and no presenter control', async ({ page }) => {
    await reachClientMode(page)
    const labels = await presentChapters(page)
    await page.emulateMedia({ media: 'print' })
    const printed = await page.locator(CP.cls.printDoc).innerText()
    // Section titles may be `text-transform: uppercase`; `innerText` returns
    // the transformed text, so the comparison is case-folded.
    const folded = printed.toLocaleLowerCase('de-DE')
    /**
     * Two chapters print their CONTENT under another heading by design
     * (ClientOutputs.tsx): `Das Projekt`'s buildings print in the section
     * titled by chapter 4 whenever chapter 4 is present, and `Architektur`
     * prints as the hero image with no section of its own. Their titles are
     * therefore not required; `Nächster Schritt` prints only when the Option
     * carries supporting artefacts. The preflight's "ENTHALTEN" list names
     * all three — a claim the sheet does not make word for word (reported).
     */
    const titledElsewhere = new Set(['Das Projekt', 'Architektur', 'Nächster Schritt'])
    for (const label of labels) {
      if (titledElsewhere.has(label)) continue
      expect(folded, `the printed sheet must contain "${label}"`)
        .toContain(label.toLocaleLowerCase('de-DE'))
    }
    expect(folded).toContain('projekt')
    expect(printed).toContain('€/m²')
    // No presenter vocabulary reaches paper.
    expect(printed).not.toMatch(/Beenden|Vollbild|Varianten|Nächstes Kapitel|Vorheriges Kapitel/)
    for (const re of NOT_CLIENT_SAFE) expect(printed).not.toMatch(re)
    // And the presenter chrome is not printed at all.
    const chromeVisible = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null
      return el ? getComputedStyle(el).display !== 'none' : false
    }, CP.cls.bar)
    expect(chromeVisible).toBe(false)
    await shot(page, 'ACCEPT-01-print-media')
    await page.emulateMedia({ media: 'screen' })
  })
})
