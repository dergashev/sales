import { expect, test, type Page } from '@playwright/test'
import {
  CONFIGURATOR_CHAPTERS, DEMO_COMPLEX_PROJECT_NAME, DEMO_PROJECT_NAME,
  KONFIGURATOR_GATE,
} from '../anchors'

/**
 * The KG chapter rail names its steps `KG 300 · <state>`, and the page's own
 * H1 is `KG 300 · Baukonstruktion`.
 *
 * Deliberately local rather than added to `anchors.ts`: the shared
 * `CONFIGURATOR_CHAPTERS.kg300` still carries the pre-unification label
 * `Leistungen KG 300` (the i18n key `chapter.kg300Details` it came from is
 * unchanged), and correcting the shared anchor would touch every spec that
 * reads it — work this ticket does not own. `CONFIGURATOR_CHAPTERS` is still
 * imported for `scopeBoundaries`, which is current.
 */
const KG300_RAIL_STEP = /^KG 300 · /
const KG300_HEADING = /^KG 300 · Baukonstruktion/
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * A surfaced commercial selection states its price effect — in the browser.
 *
 * The engine invariant is machine-enforced by
 * `src/engine/__tests__/pricingCoverage.invariant.test.ts`. That suite reads
 * fixtures and locale tables; it cannot see what a seller reads on the
 * option card. This one does, because the defect it pins WAS a rendering
 * defect: the data said `noPriceBasis` correctly for six releases while one
 * renderer turned it into `keine Preiswirkung` — a claim that choosing
 * between a column, a diagonal and a cantilever costs the same.
 *
 * `Tragsystem Balkone` is the case under test. It is a `singleChoice` whose
 * own `whyDe` opens `Ein wesentlicher Kostentreiber`, it exists FOUR times
 * (once on the clean fixture, once per building on the complex one), and no
 * released coefficient prices it — so it must read as BLOCKED PRICING with
 * the condition named, in both languages, at both supported widths.
 */

/** The phrases that must not appear on a balcony decision, in either language. */
const RETIRED = ['keine Preiswirkung', 'no price effect']

const CONDITION_DE = 'systemspezifischer Tragwerkskoeffizient noch nicht freigegeben'
const CONDITION_EN = 'system-specific structural coefficient not yet approved'
const NOT_DETERMINED_DE = 'Preis nicht ermittelt'
const NOT_DETERMINED_EN = 'price not determined'

/**
 * Reach the KG 300 chapter, where the balcony decisions live.
 *
 * The Konfigurator opens on Leistungsabgrenzung, and the KG chapters do not
 * exist as navigation until every one of the six DIN 276 groups carries an
 * explicit decision — that gate is the released contract, so this walks it
 * rather than around it. Each group is INCLUDED, because a chapter for an
 * excluded group has nothing to render.
 */
async function reachKg300(page: Page, projectName: string) {
  await page.goto('/')
  await reachOptionWorkspace(page, projectName)
  await saveBuildingScope(page)
  await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
  await expect(page.getByRole('heading', {
    level: 1, name: CONFIGURATOR_CHAPTERS.scopeBoundaries,
  })).toBeVisible({ timeout: 15_000 })

  // Re-resolved from the DOM on every pass: each click re-renders the
  // table, so an index captured before the click points at a stale node.
  // Same technique the commercial-cockpit spec uses for this surface.
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
    // on whatever occupies those coordinates instead of the control. That
    // is why the loop used to stall on the third group.
    await radio.scrollIntoViewIfNeeded()
    await radio.click()
    // Await the WRITE, not just the click. The store commits through a
    // journal event and React re-renders after it; firing the next pass
    // before `checked` has landed makes the scan return the same index and
    // the loop spends its passes re-clicking one row (observed: two of six
    // groups decided, the gate never opening).
    await expect(radio).toBeChecked({ timeout: 10_000 })
  }

  const confirm = page.getByRole('button', { name: /^Umfang bestätigen und weiter/ })
  await expect(confirm).toBeEnabled({ timeout: 15_000 })
  await confirm.click()

  const chapter = page.getByRole('button', { name: KG300_RAIL_STEP })
  await expect(chapter.first()).toBeVisible({ timeout: 15_000 })
  await chapter.first().click()
  await expect(page.getByRole('heading', { level: 1, name: KG300_HEADING }))
    .toBeVisible({ timeout: 15_000 })
}

/**
 * Open every balcony system on the chapter and include its scope.
 *
 * The support decision is SUSPENDED while balconies are out of scope — that
 * is the released cascade contract and it is not what this spec tests. The
 * decision has to be live for its price language to be on screen at all,
 * so the scope is included first, exactly as a seller would.
 */
async function openBalconySystems(page: Page): Promise<number> {
  const systems = page.getByRole('button', { name: /^Balkone · / })
  const count = await systems.count()
  expect(count, 'the KG 300 chapter offers no balcony system').toBeGreaterThan(0)

  for (let i = 0; i < count; i += 1) {
    const system = systems.nth(i)
    await system.scrollIntoViewIfNeeded()
    if (await system.getAttribute('aria-expanded') !== 'true') await system.click()

    // Put the balconies in scope, then commit. Both steps are the product's
    // own: the support decision is SUSPENDED until the scope is included
    // (the released cascade contract), and the draft is only written by
    // `Übernehmen`.
    const include = page.getByRole('radio', { name: /^Im All3-Leistungsumfang/ }).first()
    if (await include.count() > 0 && !(await include.isChecked())) {
      await include.scrollIntoViewIfNeeded()
      await include.click()
      await expect(include).toBeChecked({ timeout: 10_000 })
      const commit = page.getByRole('button', { name: 'Übernehmen', exact: true }).first()
      if (await commit.count() > 0) {
        await commit.scrollIntoViewIfNeeded()
        await commit.click()
      }
    }
    // The support decision exists only once the scope is in.
    await expect(page.getByText('Tragsystem Balkone').first())
      .toBeVisible({ timeout: 15_000 })
  }
  return count
}

/** The visible text of the chapter body, as a reader meets it. */
async function chapterText(page: Page): Promise<string> {
  return (await page.locator('main').innerText()).replace(/\s+/g, ' ')
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  const label = `${viewport.width}x${viewport.height}`

  test.describe(`Preiswirkung der Balkon-Entscheidung — ${label}`, () => {
    test.use({ viewport })

    test('the balcony support decision names its blocking condition, never a lack of effect', async ({ page }) => {
      await reachKg300(page, DEMO_PROJECT_NAME)
      await openBalconySystems(page)

      const de = await chapterText(page)
      expect(de).toContain('Tragsystem Balkone')
      // BLOCKED PRICING, stated: the canonical rule-16 phrase plus the
      // condition that is actually blocking the price.
      expect(de).toContain(NOT_DETERMINED_DE)
      expect(de).toContain(CONDITION_DE)
      // And the claim that used to stand here is gone.
      for (const phrase of RETIRED) {
        expect(de, `the chapter still says «${phrase}»`).not.toContain(phrase)
      }

      // The same decision in English, through the product's own toggle.
      // Scoped to the header's own language control: `EN` also occurs
      // inside decision labels, and an unscoped role query is ambiguous.
      // `force`: the canonical radio's own input is visually hidden behind
      // a styled indicator, so it is never "visible" to actionability.
      await page.getByRole('radiogroup', { name: 'Sprache' })
        .getByRole('radio', { name: 'EN' }).click({ force: true })
      const en = await chapterText(page)
      expect(en).toContain('Balcony support system')
      expect(en).toContain(NOT_DETERMINED_EN)
      expect(en).toContain(CONDITION_EN)
      for (const phrase of RETIRED) {
        expect(en, `the English chapter still says «${phrase}»`).not.toContain(phrase)
      }
    })

    test('no euro is asserted for the blocked decision, and no alternative reads as free', async ({ page }) => {
      await reachKg300(page, DEMO_PROJECT_NAME)
      await openBalconySystems(page)

      /**
       * The three alternatives, read off the decision's own control group.
       *
       * Each has to carry the blocked phrase and no signed amount: `± 0 €`
       * on an alternative with no price basis is the state QA-01 removed
       * from the rail, and `keine Preiswirkung` was what replaced it here.
       * Neither may come back.
       */
      const options = await page.evaluate(() => {
        const heading = [...document.querySelectorAll('main *')]
          .find((el) => el.textContent?.trim() === 'Tragsystem Balkone')
        const group = heading?.closest('fieldset, section, div[role=radiogroup]')
          ?? heading?.parentElement
        return [...(group?.querySelectorAll('label') ?? [])]
          .map((label) => (label.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter((text) => text.length > 0)
      })
      expect(options.length, 'the balcony support decision renders no alternatives')
        .toBeGreaterThan(0)
      for (const option of options) {
        for (const phrase of RETIRED) {
          expect(option, `alternative «${option}»`).not.toContain(phrase)
        }
        expect(option, `alternative «${option}» asserts a signed euro`)
          .not.toMatch(/[+−-]\s?\d[\d.]*\s?€/)
      }
    })
  })
}

/**
 * All FOUR instances, not one fixture row.
 *
 * The complex fixture carries the decision once per building, and the
 * defect was in the shared renderer — so a fix that only reached one
 * building would be a fix that reached none of them reliably.
 */
test.describe('Preiswirkung der Balkon-Entscheidung — je Gebäude', () => {
  /**
   * The complex fixture carries the decision once per building, and the KG
   * chapter shows ONE building at a time behind the DC-46 switch — so
   * reading the page once would read one instance of four. The defect was
   * in the shared renderer, and a fix that reached one building reliably
   * reached none.
   *
   * Building B and C additionally exercise the OTHER blocked-pricing
   * condition: their documents carry no balcony position at all, so the
   * scope decision itself is blocked and names that instead.
   */
  test('every building of the complex project states a commercial condition, never a lack of effect', async ({ page }) => {
    await reachKg300(page, DEMO_COMPLEX_PROJECT_NAME)

    const buildings = page.getByRole('radiogroup', { name: 'Gebäude wählen' })
      .getByRole('radio')
    const count = await buildings.count()
    expect(count, 'the complex fixture should decide KG 300 per building')
      .toBeGreaterThan(1)

    for (let i = 0; i < count; i += 1) {
      const building = buildings.nth(i)
      const name = (await building.evaluate(
        (el) => el.closest('label')?.textContent ?? '',
      )).trim()
      await building.scrollIntoViewIfNeeded()
      // `force`: see the language toggle above — the canonical radio hides
      // its input behind a styled indicator.
      if (!(await building.isChecked())) await building.click({ force: true })
      await expect(building).toBeChecked({ timeout: 10_000 })

      await openBalconySystems(page)
      const text = await chapterText(page)
      expect(text, `${name}: no balcony support decision on screen`)
        .toContain('Tragsystem Balkone')
      for (const phrase of RETIRED) {
        expect(text, `${name}: the balcony decision still says «${phrase}»`)
          .not.toContain(phrase)
      }
      // Blocked pricing, stated — either the support coefficient, or the
      // missing balcony position for the buildings whose documents have none.
      expect(text, `${name}: no blocked-pricing statement`)
        .toContain(NOT_DETERMINED_DE)
      expect(text, `${name}: the blocking condition is not named`)
        .toMatch(new RegExp(`${CONDITION_DE}|keine Balkonposition in den Unterlagen`))
    }
  })
})
