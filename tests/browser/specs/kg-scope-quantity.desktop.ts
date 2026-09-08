import { expect, test, type Locator, type Page } from '@playwright/test'
import { CONFIGURATOR_CHAPTERS, DEMO_PROJECT_NAME, KONFIGURATOR_GATE } from '../anchors'
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * A KG 200/500/600 position is configured by its own quantity — in the browser.
 *
 * The defect class this pins is a SCOPE defect, not a rendering one: ten
 * positions of the site-works, external-works and fit-out chapters shipped
 * as flat `includeExclude` services. They carried a declared euro amount
 * and no driving quantity at all, so the only two answers a seller could
 * give were «in» and «out». A clearance of 3.300 m² instead of 2.200 m², or four
 * house connections instead of three, was not a question the product could
 * be asked — the number that produces the money was frozen in the fixture.
 * KG 300 and KG 400 had been configurable for releases; the outer chapters
 * silently were not, and nothing failed, because a capability that does not
 * exist renders no wrong pixel.
 *
 * The engine invariant can read the converted fixture and multiply. It
 * cannot see whether a seller is offered a field, whether the field carries
 * the documented baseline, whether committing it moves the chapter's own
 * money, or whether the correction comes back to exactly the declared
 * subtotal. That is this suite, at both supported widths, in both languages.
 *
 * `DEMO-HAPPY-01` is the only project walked. The complex fixture's six
 * `b-*` conversions go through the same data-driven renderer, and their
 * per-row arithmetic is the engine invariant's job; a second full journey
 * would buy a repeat of one renderer at twice the runtime.
 */

/**
 * Rule 7's narrow no-break space, U+202F — the ONLY separator allowed
 * between a number and its unit.
 *
 * It appears here in the expectations that read raw DOM text, and nowhere
 * in a role name or a text matcher: see `textOf` below for why those two
 * cannot carry it.
 *
 * Written as an ESCAPE, never as the character. A literal U+202F in source
 * is indistinguishable from a space on screen and is silently rewritten to
 * one by editors and formatters; when that happened here, every expectation
 * in this file kept its shape and lost its meaning at once — the positive
 * ones failed loudly, and the two «never a bare 0 €» regexes passed
 * vacuously, which is the worse half.
 */
const NNBSP = '\u202f'

/**
 * The rail step and H1 of the chapters under test, matched by ACCESSIBLE
 * NAME — which is why the space in them is a plain ASCII one even though
 * the rendered string is `KG<U+202F>200`. Chromium folds the narrow
 * no-break space into a regular space while computing an accessible name,
 * so a role query written with U+202F matches nothing at all (verified in
 * the browser, not assumed).
 *
 * Deliberately local rather than added to `anchors.ts`, for the same reason
 * the pricing-coverage spec keeps its KG 300 pair local: the shared
 * `CONFIGURATOR_CHAPTERS` carries only `scopeBoundaries` and a
 * pre-unification `kg300` label, and growing it with three more chapters
 * would touch a file every other spec reads — work this ticket does not
 * own. `CONFIGURATOR_CHAPTERS` is still imported for `scopeBoundaries`,
 * which is current.
 */
const railStep = (kg: string) => new RegExp(`^KG ${kg} · `)
const chapterHeading = (kg: string) => new RegExp(`^KG ${kg} · `)

/**
 * The chapter's own money, as the seller reads it above the system list:
 * `KG 200 · 180.000 €` (`SystemOverviewSummary`). It is a `<span>` with no
 * role of its own, so a class is the only address it has.
 */
const CHAPTER_TOTAL = '.a3-sysum-total'

/** The system disclosure of the KG chapter (`SystemRow`'s own button). */
const SYSTEM_TOGGLE = 'main button.a3-sys-btn'

/**
 * The position under test, and the fixture numbers it is built from
 * (`src/fixtures/kg-configuration.json`, catalogue `DEMO-HAPPY-01`).
 * They are written out rather than derived, so a fixture edited without its
 * spec fails here instead of agreeing with itself.
 */
const CLEARANCE = {
  system: /^Baufeld & Bestand/,
  decision: 'a-200-02',
  name: 'Baufeldfreimachung & Rodung',
  nameEn: 'Site clearance',
  unit: 'm²',
  baseline: 2200,
  changed: 3300,
  rate: 20,
}
/** The declared KG 200 subtotal — unchanged by the conversion. */
const KG200_DECLARED = 180_000

/** A counted position: four connections, and never «4,0». */
const CONNECTIONS = { system: /^Erschließung & Hausanschlüsse/, decision: 'a-200-03' }

/**
 * KG 500 and KG 600 must be configurable by the same grammar. One position
 * per chapter is enough to prove the chapter is reachable and editable —
 * the renderer is shared, so a second row of the same chapter proves
 * nothing the first did not.
 */
const OUTER_CHAPTERS = [
  {
    kg: '500',
    system: /^Bepflanzung & Spiel/,
    decision: 'a-500-02',
    name: 'Bepflanzung & Rasen',
    unit: 'm²',
    baseline: 740,
    rate: 100,
  },
  {
    kg: '600',
    system: /^Gemeinschaftsausstattung/,
    decision: 'a-600-02',
    name: 'Fahrradabstellanlage',
    unit: 'Plätze',
    baseline: 84,
    rate: 500,
  },
]

/** Claims that may never stand on a configurable position, in either language. */
const RETIRED = ['keine Preiswirkung', 'no price effect']

/** German grouping, so an expected amount is derived rather than transcribed. */
const grouped = (amount: number) => new Intl.NumberFormat('de-DE').format(amount)

/**
 * Text as the DOM actually holds it: line breaks and ASCII runs collapse,
 * U+202F survives.
 *
 * This exists because Playwright's own text matchers cannot carry rule 7.
 * `toContainText` normalizes BOTH sides with `\s+ → ' '`, and JavaScript's
 * `\s` includes U+202F — so an assertion written through it passes
 * identically whether the product typesets a narrow no-break space or a
 * plain one, which is the regression worth catching. Everything that is
 * ABOUT the separator therefore reads this string instead.
 */
async function textOf(locator: Locator): Promise<string> {
  // `[^\S\u202f]` is "whitespace, except U+202F" — the one separator
  // this file must never collapse. Written as an escape rather than as
  // the character itself, so it survives a careless editor.
  return (await locator.innerText()).replace(/[^\S\u202f]+/g, ' ')
}

/**
 * Await a fragment in a locator's raw text.
 *
 * Polling rather than a plain read: money and quantities arrive through the
 * count-up (rule 19), so the first frame after a commit still shows the old
 * number. This is the "await the WRITE" step every commit here is followed
 * by, and it fails with its own message rather than a bare timeout.
 */
async function expectText(locator: Locator, fragment: string, why: string) {
  await expect.poll(() => textOf(locator), { message: why, timeout: 10_000 })
    .toContain(fragment)
}

/**
 * The euro amount a fragment states, as a number.
 *
 * German grouping only: every amount this spec reads is a whole euro, and a
 * fragment that suddenly carried a decimal comma is a change worth failing
 * on rather than parsing around.
 */
function euroIn(text: string, what: string): number {
  const match = text.match(new RegExp(`(\\d[\\d.]*)${NNBSP}€`))
  expect(match, `${what}: no euro amount on screen — «${text}»`).not.toBeNull()
  return Number(match![1].replace(/\./g, ''))
}

/**
 * Reach a KG chapter of the Konfigurator, as a seller does.
 *
 * The Konfigurator opens on Leistungsabgrenzung, and no KG chapter exists
 * as navigation until every one of the six DIN 276 groups carries an
 * explicit decision. That gate is the released contract, so this walks it.
 * Every group is INCLUDED: an excluded group's chapter has nothing to
 * configure.
 */
async function reachChapter(page: Page, kg: string) {
  await page.goto('/')
  await reachOptionWorkspace(page, DEMO_PROJECT_NAME)
  await saveBuildingScope(page)
  await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
  await expect(page.getByRole('heading', {
    level: 1, name: CONFIGURATOR_CHAPTERS.scopeBoundaries,
  })).toBeVisible({ timeout: 15_000 })

  // Re-resolved from the DOM on every pass: each click re-renders the
  // table, so an index captured before the click points at a stale node.
  for (let pass = 0; pass < 10; pass += 1) {
    const index = await page.evaluate(() => {
      const radios = [...document.querySelectorAll('main input[type=radio]')]
      return radios.findIndex((radio) => !(radio as HTMLInputElement).checked
        && !(radio as HTMLInputElement).disabled
        && /^\s*enthalten/.test((radio.closest('label')?.textContent ?? '').replace(/^✓/, '')))
    })
    if (index < 0) break
    const radio = page.locator('main input[type=radio]').nth(index)
    // Scrolled into view and clicked WITHOUT `force`: the table is taller
    // than the viewport at both supported widths, and a forced click lands
    // on whatever occupies those coordinates instead of the control.
    await radio.scrollIntoViewIfNeeded()
    await radio.click()
    // Await the WRITE, not just the click: the store commits through a
    // journal event and React re-renders after it. Firing the next pass
    // early makes the scan return the same index and the loop stalls.
    await expect(radio).toBeChecked({ timeout: 10_000 })
  }

  const confirm = page.getByRole('button', { name: /^Umfang bestätigen und weiter/ })
  await expect(confirm).toBeEnabled({ timeout: 15_000 })
  await confirm.click()

  await openChapter(page, kg)
}

/** Move to a chapter that is already reachable in the rail. */
async function openChapter(page: Page, kg: string) {
  const step = page.getByRole('button', { name: railStep(kg) })
  await expect(step).toBeVisible({ timeout: 15_000 })
  await step.click()
  await expect(page.getByRole('heading', { level: 1, name: chapterHeading(kg) }))
    .toBeVisible({ timeout: 15_000 })
}

/**
 * Open one system of the chapter.
 *
 * The chapter is an accordion — one system open at a time — and on arrival
 * it opens the first system that still owes a decision, which is rarely the
 * one under test. `aria-expanded` is both the guard and the acknowledgement.
 */
async function openSystem(page: Page, name: RegExp) {
  const system = page.getByRole('button', { name })
  await expect(system, `no system row named ${name}`).toHaveCount(1)
  await system.scrollIntoViewIfNeeded()
  if (await system.getAttribute('aria-expanded') !== 'true') await system.click()
  await expect(system).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 })
}

/** Set one quantity and commit it, then wait for the row's own new text. */
async function commitQuantity(page: Page, decision: string, value: string) {
  const row = page.locator(`[data-decision="${decision}"]`)
  await row.getByRole('button', { name: /^Ändern · / }).click()
  const input = row.locator('input[inputmode="decimal"]')
  await expect(input).toBeVisible({ timeout: 10_000 })
  await input.fill(value)
  await expect(input).toHaveValue(value)
  await row.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  // Await the WRITE, not the click: the editor collapses back into the
  // summary, and the summary is what every total is then read against.
  await expect(row.getByRole('button', { name: /^Ändern · / }))
    .toBeVisible({ timeout: 10_000 })
}

/**
 * Everything the chapter says, with every system opened in turn.
 *
 * The accordion shows one system at a time, so a single read would see one
 * system of three or four.
 */
async function everySystemText(page: Page): Promise<string> {
  const systems = page.locator(SYSTEM_TOGGLE)
  const count = await systems.count()
  expect(count, 'the chapter renders no system row at all').toBeGreaterThan(0)
  let text = await textOf(page.locator('main'))
  for (let i = 0; i < count; i += 1) {
    const system = systems.nth(i)
    await system.scrollIntoViewIfNeeded()
    if (await system.getAttribute('aria-expanded') !== 'true') await system.click()
    await expect(system).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 })
    text += `\n${await textOf(page.locator('main'))}`
  }
  return text
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  const label = `${viewport.width}x${viewport.height}`

  test.describe(`Menge als Stellgröße in KG 200/500/600 — ${label}`, () => {
    test.use({ viewport })

    test('the KG 200 clearance position offers its driving quantity, with its unit and its rate', async ({ page }) => {
      await reachChapter(page, '200')
      await openSystem(page, CLEARANCE.system)

      const row = page.locator(`[data-decision="${CLEARANCE.decision}"]`)
      await expect(row).toHaveCount(1)
      await expectText(row, `2.200${NNBSP}${CLEARANCE.unit}`,
        'the clearance row does not state its documented quantity')

      await row.getByRole('button', { name: `Ändern · ${CLEARANCE.name}` }).click()

      // The field itself: labelled by its unit, helped by its rate, and
      // carrying the baseline the fixture declares. An empty field, or one
      // pre-filled with something else, would make the seller's first
      // change a silent overwrite of the documented quantity.
      const input = page.locator('main input[inputmode="decimal"]')
      await expect(input).toHaveCount(1)
      await expect(input).toHaveValue(String(CLEARANCE.baseline))
      await expect(input).toBeEditable()

      const field = page.locator('main .a3-form-field:has(input[inputmode="decimal"])')
      await expectText(field, `Menge in ${CLEARANCE.unit}`,
        'the quantity field does not name its unit')
      await expectText(field, `Ansatz ${CLEARANCE.rate}${NNBSP}€ je ${CLEARANCE.unit}.`,
        'the quantity field does not state the rate it will be multiplied by')

      // Keyboard, at the level that matters here: the control is in the tab
      // order and takes typed digits. The full tab-order walk belongs to the
      // keyboard suite, not to a scope spec.
      expect(await input.evaluate((el: HTMLInputElement) => el.tabIndex),
        'the quantity field is out of the tab order').toBeGreaterThanOrEqual(0)
      await input.focus()
      await expect(input).toBeFocused()
      await input.press('ControlOrMeta+a')
      await page.keyboard.type('2500')
      await expect(input).toHaveValue('2500')

      // Nothing is committed here, so the row must still read the baseline.
      await row.getByRole('button', { name: 'Abbrechen', exact: true }).click()
      await expectText(row, `2.200${NNBSP}${CLEARANCE.unit}`,
        'an abandoned draft changed the committed quantity')
    })

    test('a counted position states whole units, never a manufactured decimal', async ({ page }) => {
      await reachChapter(page, '200')
      await openSystem(page, CONNECTIONS.system)

      const row = page.locator(`[data-decision="${CONNECTIONS.decision}"]`)
      await expect(row).toHaveCount(1)
      const text = await textOf(row)
      // Four house connections. A formatter that reached for two decimals
      // because the RATE has them would print `4,00 Anschlüsse` and turn a
      // count into a measurement.
      expect(text, `the connection count is missing — «${text}»`)
        .toContain(`4${NNBSP}Anschlüsse`)
      expect(text, `the count is typeset as a decimal — «${text}»`).not.toMatch(/4[.,]0/)
    })

    test('a changed quantity reaches the offer, and the correction restores the declared subtotal', async ({ page }) => {
      await reachChapter(page, '200')
      await openSystem(page, CLEARANCE.system)

      const row = page.locator(`[data-decision="${CLEARANCE.decision}"]`)
      const total = page.locator(CHAPTER_TOTAL)
      await expect(total).toHaveCount(1)

      await expectText(total, `180.000${NNBSP}€`,
        'KG 200 does not open on its declared subtotal')
      const before = euroIn(await textOf(total), 'the opening chapter subtotal')
      expect(before).toBe(KG200_DECLARED)
      expect(euroIn(await textOf(row), 'the baseline position'),
        'the baseline position is not its quantity times its rate')
        .toBe(CLEARANCE.baseline * CLEARANCE.rate)

      await commitQuantity(page, CLEARANCE.decision, String(CLEARANCE.changed))

      await expectText(row, `3.300${NNBSP}${CLEARANCE.unit}`,
        'the committed quantity is not on the row')
      await expectText(row, `direkt bepreist · 66.000${NNBSP}€`,
        'the row does not trace the amount its new quantity produced')
      await expectText(total, `202.000${NNBSP}€`,
        'the chapter subtotal did not follow the position')

      // The strings above are what a seller reads; these are the claims
      // they stand for. 3.300 m² × 20 €/m² = 66.000 €, and the chapter's own
      // subtotal moved by exactly the difference — not by a rounded step,
      // not by a re-declared fixture number.
      expect(euroIn(await textOf(row), 'the changed position'))
        .toBe(CLEARANCE.changed * CLEARANCE.rate)
      const after = euroIn(await textOf(total), 'the changed chapter subtotal')
      expect(after).toBe(202_000)
      expect(after - before,
        'the chapter subtotal did not move by quantity difference × rate')
        .toBe((CLEARANCE.changed - CLEARANCE.baseline) * CLEARANCE.rate)

      // And back. A configurator that cannot return to the documented
      // quantity is a one-way door, and the declared subtotal is the proof
      // that the return is exact rather than approximately right.
      await commitQuantity(page, CLEARANCE.decision, String(CLEARANCE.baseline))
      await expectText(row, `2.200${NNBSP}${CLEARANCE.unit}`,
        'the correction did not reach the row')
      await expectText(total, `180.000${NNBSP}€`,
        'the correction did not restore the declared KG 200 subtotal')
      expect(euroIn(await textOf(row), 'the restored position'))
        .toBe(CLEARANCE.baseline * CLEARANCE.rate)
      expect(euroIn(await textOf(total), 'the restored chapter subtotal'))
        .toBe(KG200_DECLARED)
    })

    test('KG 500 and KG 600 are configurable by quantity, and each states a traced amount', async ({ page }) => {
      await reachChapter(page, OUTER_CHAPTERS[0].kg)

      for (const [index, chapter] of OUTER_CHAPTERS.entries()) {
        if (index > 0) await openChapter(page, chapter.kg)
        await openSystem(page, chapter.system)

        const row = page.locator(`[data-decision="${chapter.decision}"]`)
        await expect(row, `KG ${chapter.kg}: ${chapter.decision} is not on screen`)
          .toHaveCount(1)
        // Traced, not asserted: the row names the price basis it used and
        // states the amount that basis produced from the quantity.
        await expectText(row,
          `direkt bepreist · ${grouped(chapter.baseline * chapter.rate)}${NNBSP}€`,
          `KG ${chapter.kg}: the row does not trace its amount to the quantity`)
        expect(euroIn(await textOf(row), `KG ${chapter.kg} · ${chapter.decision}`),
          `KG ${chapter.kg}: the amount is not its quantity times its rate`)
          .toBe(chapter.baseline * chapter.rate)

        await row.getByRole('button', { name: `Ändern · ${chapter.name}` }).click()
        const input = page.locator('main input[inputmode="decimal"]')
        await expect(input, `KG ${chapter.kg}: ${chapter.decision} offers no quantity field`)
          .toHaveCount(1)
        await expect(input).toHaveValue(String(chapter.baseline))
        await expect(input).toBeEditable()
        await expectText(page.locator('main .a3-form-field:has(input[inputmode="decimal"])'),
          `Menge in ${chapter.unit}`, `KG ${chapter.kg}: the field does not name its unit`)
        await row.getByRole('button', { name: 'Abbrechen', exact: true }).click()
      }
    })

    test('no chapter of the converted catalogue asserts a zero or a lack of price effect', async ({ page }) => {
      await reachChapter(page, '200')

      for (const kg of ['200', '500', '600']) {
        if (kg !== '200') await openChapter(page, kg)
        const text = await everySystemText(page)

        for (const phrase of RETIRED) {
          expect(text, `KG ${kg} still says «${phrase}»`).not.toContain(phrase)
        }
        // A standalone zero is the claim «this costs nothing», and rule 16
        // forbids it outright. Grouped amounts end in zeros, so the boundary
        // is what carries the test: `180.000 €` is money, ` 0 €` is a claim.
        expect(text, `KG ${kg} prints a bare zero euro`)
          .not.toMatch(new RegExp(`(?<![\\d.,])0${NNBSP}€`))
        expect(text, `KG ${kg} prints a signed zero`)
          .not.toMatch(new RegExp(`[±+−-] ?0${NNBSP}€`))
      }
    })

    test('the quantity control and the money it produces are typeset in English', async ({ page }) => {
      await reachChapter(page, '200')
      await openSystem(page, CLEARANCE.system)
      await commitQuantity(page, CLEARANCE.decision, String(CLEARANCE.changed))

      const row = page.locator(`[data-decision="${CLEARANCE.decision}"]`)
      await expectText(row, `66.000${NNBSP}€`, 'the German amount never landed')

      // The product's own toggle, scoped to the header's language control:
      // `EN` also occurs inside decision labels. `force` is required — the
      // canonical radio hides its input behind a styled indicator, so it is
      // never "visible" to actionability.
      await page.getByRole('radiogroup', { name: 'Sprache' })
        .getByRole('radio', { name: 'EN' }).click({ force: true })

      // Re-typeset, not merely re-labelled: English grouping is a comma, and
      // the German form has to be GONE rather than accompanied.
      await expectText(row, `directly priced · 66,000${NNBSP}€`,
        'the amount was not re-typeset for English')
      const rowText = await textOf(row)
      expect(rowText).toContain(`3,300${NNBSP}${CLEARANCE.unit}`)
      expect(rowText, 'the amount is still grouped in German').not.toContain('66.000')

      await row.getByRole('button', { name: `Change · ${CLEARANCE.nameEn}` }).click()
      const field = page.locator('main .a3-form-field:has(input[inputmode="decimal"])')
      await expectText(field, `Quantity in ${CLEARANCE.unit}`,
        'the English quantity field does not name its unit')
      await expectText(field, `Rate ${CLEARANCE.rate}${NNBSP}€ per ${CLEARANCE.unit}.`,
        'the English quantity field does not state its rate')

      const chapter = await textOf(page.locator('main'))
      for (const phrase of RETIRED) {
        expect(chapter, `the English chapter says «${phrase}»`).not.toContain(phrase)
      }
    })
  })
}
