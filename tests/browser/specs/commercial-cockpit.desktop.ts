import { test, expect, type Page } from '../fixtures'
import {
  COCKPIT,
  COST_DETAILS,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME,
  KONFIGURATOR_GATE,
} from '../anchors'
import { reachOptionWorkspace, saveBuildingScope } from '../journey'

/**
 * VR3-COST-00 · the commercial cockpit and Kostendetails.
 *
 * WHY THIS SPEC IS A BROWSER SPEC AND NOT A DOM TEST.
 *
 * Three of the four defects this ticket exists to remove are GEOMETRIC, and
 * jsdom has no layout: it reports every box as zero, so the rail that
 * displaced its own content by 57–81 px on every committed decision, and
 * again four seconds later when a marker expired, passed the entire unit
 * suite. The only instrument that can see that defect is a real engine, so
 * the acceptance gate for it lives here — and it MEASURES rather than
 * observes: `scrollHeight`, `scrollTop`, the selected-effects block height,
 * and the viewport top of the DIN section and the CTA, sampled before the
 * commit, after it settles, after the change window expires, and six seconds
 * on.
 *
 * The other half is semantic, and it is here for the same reason: `element
 * FromPoint` is what proves no transient message covers a commercial fact.
 */

const COMMITTABLE_AMOUNT = /100\.000|100,000/

/** Reach a Configurator with a real, priced, six-group configuration. */
async function reachConfiguredRail(page: Page) {
  await page.goto('/')
  await reachOptionWorkspace(page, DEMO_PROJECT_NAME)
  await saveBuildingScope(page)
  await page.getByRole('button', { name: KONFIGURATOR_GATE.start }).click()
  // Every cost group in scope: the heaviest composition the clean fixture
  // can produce, which is what the depth budget has to hold.
  for (let pass = 0; pass < 10; pass += 1) {
    const index = await page.evaluate(() => {
      const radios = [...document.querySelectorAll('main input[type=radio]')]
      return radios.findIndex((radio) => !radio.checked && !(radio as HTMLInputElement).disabled
        && /^\s*enthalten/.test((radio.closest('label')?.textContent ?? '').replace(/^✓/, '')))
    })
    if (index < 0) break
    await page.locator('main input[type=radio]').nth(index).click({ force: true })
  }
  await expect(page.locator(COCKPIT.cls.rail)).toBeVisible()
}

/**
 * The one geometry a committed change must never move.
 *
 * Self-contained on purpose: `page.evaluate` serialises this function and
 * runs it in the page, where nothing of this module's scope exists — a
 * closed-over selector reads as `undefined` there, not as a compile error.
 */
function railGeometry() {
  const rail = document.querySelector('aside.a3-cockpit') as HTMLElement
  const sections = rail.querySelectorAll('.a3-cockpit-sect')
  const cta = rail.querySelector('.a3-cockpit-cta') as HTMLElement
  const effects = rail.querySelector('.a3-cockpit-effects') as HTMLElement
  return {
    scrollHeight: rail.scrollHeight,
    scrollTop: Math.round(rail.scrollTop),
    effectsHeight: Math.round(effects.getBoundingClientRect().height),
    dinTop: Math.round(sections[sections.length - 1]!.getBoundingClientRect().top),
    ctaTop: Math.round(cta.getBoundingClientRect().top),
    changeShown: !!rail.querySelector('.a3-cockpit-change'),
  }
}

/** Commit one ordinary configuration change with a real delta and a cascade. */
async function commitOneChange(page: Page) {
  const index = await page.evaluate((pattern) => {
    const radios = [...document.querySelectorAll('main input[type=radio]')]
    return radios.findIndex((radio) => !radio.checked && !(radio as HTMLInputElement).disabled
      && new RegExp(pattern).test(radio.closest('label')?.textContent ?? ''))
  }, COMMITTABLE_AMOUNT.source)
  expect(index, 'no committable configuration decision on this surface').toBeGreaterThan(-1)
  await page.locator('main input[type=radio]').nth(index).click({ force: true })
}

test.describe('Commercial cockpit · the compact live rail', () => {
  test('four blocks, one hero, one provenance affordance, one live region', async ({ page }) => {
    await reachConfiguredRail(page)
    const rail = page.locator(COCKPIT.cls.rail)

    // ── the landmark and its heading hierarchy ──────────────────────────
    await expect(page.getByRole('complementary', { name: COCKPIT.landmark }))
      .toBeVisible()
    await expect(rail.getByRole('heading', { level: 3, name: COCKPIT.effectsHeading }))
      .toBeVisible()
    await expect(rail.getByRole('heading', { level: 3, name: COCKPIT.dinHeading }))
      .toBeVisible()

    // ── the order is the contract, and it is fixed ──────────────────────
    const order = await page.evaluate(() => {
      const r = document.querySelector('aside.a3-cockpit') as HTMLElement
      const top = (sel: string) => {
        const e = r.querySelector(sel)
        return e ? e.getBoundingClientRect().top : Number.NaN
      }
      return {
        band: top('.a3-rail-band-budget'),
        effects: top('.a3-cockpit-effects'),
        din: top('.a3-cockpit-kg'),
        cta: top('.a3-cockpit-cta'),
      }
    })
    expect(order.band).toBeLessThan(order.effects)
    expect(order.effects).toBeLessThan(order.din)
    expect(order.din).toBeLessThan(order.cta)

    // ── ONE dominant number, and it is the only brand accent ────────────
    const heroes = await page.evaluate(() => {
      const r = document.querySelector('aside.a3-cockpit') as HTMLElement
      // The OUTERMOST element at display size, so a value wrapped in its
      // own animation span is counted once rather than twice.
      const big = [...r.querySelectorAll('*')]
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) >= 30
          && (e.textContent ?? '').trim().length > 0)
      return big
        .filter((e) => !big.some((other) => other !== e && other.contains(e)))
        .map((e) => (e.textContent ?? '').trim())
    })
    expect(heroes.length, `expected one dominant figure, got ${heroes.join(' | ')}`).toBe(1)

    // ── the persistent commercial basis is NEVER replaced ───────────────
    await expect(rail.locator(COCKPIT.cls.basis)).toContainText('±')
    await expect(rail.getByRole('button', { name: COCKPIT.origin })).toBeVisible()

    // ── the selected effects are a real list, capped at three ───────────
    await expect(rail.getByRole('list', { name: COCKPIT.effectsList })).toBeVisible()
    const effects = rail.locator(COCKPIT.cls.effect)
    expect(await effects.count()).toBeLessThanOrEqual(3)

    // ── the DIN composition is top level, with column identity ──────────
    await expect(rail.locator(`${COCKPIT.cls.kg} thead th[scope="col"]`)).toHaveCount(3)
    // No child contribution rows: every body row is a top-level cost group
    // or the subtotal, and nothing expands.
    await expect(rail.locator(`${COCKPIT.cls.kg} tbody [aria-expanded]`)).toHaveCount(0)

    // ── exactly one polite live region, and no competing status boxes ───
    expect(await rail.locator('[aria-live]').count()).toBe(1)

    // ── the rail is the single scroll owner ─────────────────────────────
    const nested = await page.evaluate(() => {
      const r = document.querySelector('aside.a3-cockpit') as HTMLElement
      return [...r.querySelectorAll('*')].filter((e) => {
        const style = getComputedStyle(e)
        return (style.overflowY === 'auto' || style.overflowY === 'scroll')
          && e.scrollHeight > e.clientHeight + 1
      }).length
    })
    expect(nested, 'a nested long scroll region inside the rail').toBe(0)

    // ── one width authority, and no horizontal overflow anywhere ────────
    const width = await page.evaluate(() => {
      const r = document.querySelector('aside.a3-cockpit') as HTMLElement
      return {
        rail: r.clientWidth,
        railOverflows: r.scrollWidth > r.clientWidth,
        pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    expect(width.rail).toBeGreaterThanOrEqual(300)
    expect(width.rail).toBeLessThanOrEqual(340)
    expect(width.railOverflows).toBe(false)
    expect(width.pageOverflows).toBe(false)

    // ── the band budget is ON, on this surface too ──────────────────────
    const band = await page.evaluate(() => {
      const b = document.querySelector('.a3-rail-band-budget') as HTMLElement
      return {
        maxHeight: getComputedStyle(b).maxHeight,
        overflows: b.scrollHeight > b.clientHeight + 1,
      }
    })
    expect(band.maxHeight).not.toBe('none')
    expect(band.overflows, 'the pinned band is over its own budget').toBe(false)
  })

  test('a committed change costs ZERO downstream geometry, twice over', async ({ page }) => {
    await reachConfiguredRail(page)
    await page.getByRole('button', { name: /^Leistungsabgrenzung/ }).first().click()
      .catch(() => {})
    await page.goto(`/projekt/${DEMO_PROJECT_ID}/option/OPT-01/konfigurieren/leistungsabgrenzung`)
    await expect(page.locator(COCKPIT.cls.rail)).toBeVisible()

    // Scroll the rail, so a drift would be visible at all.
    await page.evaluate(() => {
      (document.querySelector('aside.a3-cockpit') as HTMLElement).scrollTop = 120
    })
    const before = await page.evaluate(railGeometry)

    await commitOneChange(page)
    await page.waitForTimeout(700)
    const settled = await page.evaluate(railGeometry)
    expect(settled.changeShown, 'the committed change is not stated').toBe(true)

    // The change window expires — the audit measured a SECOND shift here.
    await page.waitForTimeout(4200)
    const expired = await page.evaluate(railGeometry)
    expect(expired.changeShown).toBe(false)

    await page.waitForTimeout(2000)
    const sixSeconds = await page.evaluate(railGeometry)

    for (const [label, sample] of [
      ['after settlement', settled],
      ['after the change expired', expired],
      ['six seconds after the commit', sixSeconds],
    ] as const) {
      expect(sample.scrollHeight, `rail scrollHeight moved ${label}`).toBe(before.scrollHeight)
      expect(sample.scrollTop, `the reading anchor moved ${label}`).toBe(before.scrollTop)
      expect(sample.effectsHeight, `the effects block resized ${label}`)
        .toBe(before.effectsHeight)
      expect(sample.dinTop, `the DIN composition moved ${label}`).toBe(before.dinTop)
      expect(sample.ctaTop, `the Cost Details CTA moved ${label}`).toBe(before.ctaTop)
    }

    // Nothing transient may cover a commercial fact or a control. The PINNED
    // band legitimately covers content scrolled under it; a message must not.
    const covered = await page.evaluate(() => {
      const r = document.querySelector('aside.a3-cockpit') as HTMLElement
      const hits: string[] = []
      for (const sel of ['.a3-cockpit-hero', '.a3-cockpit-complete', '.a3-cockpit-facts',
        '.a3-cockpit-effects', '.a3-cockpit-kg', '.a3-cockpit-cta']) {
        const e = r.querySelector(sel)
        if (!e) continue
        const box = e.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) continue
        const top = document.elementFromPoint(
          box.left + Math.min(box.width / 2, 40), box.top + Math.min(box.height / 2, 8),
        )
        if (!top || e.contains(top) || top.contains(e)) continue
        if (top.closest('.a3-rail-sticky-top')) continue
        hits.push(`${sel} covered by .${top.className}`)
      }
      return hits
    })
    expect(covered).toEqual([])
  })

  test('rapid repeated changes do not drift the rail', async ({ page }) => {
    await reachConfiguredRail(page)
    await page.goto(`/projekt/${DEMO_PROJECT_ID}/option/OPT-01/konfigurieren/leistungsabgrenzung`)
    await expect(page.locator(COCKPIT.cls.rail)).toBeVisible()
    await page.evaluate(() => {
      (document.querySelector('aside.a3-cockpit') as HTMLElement).scrollTop = 120
    })
    const before = await page.evaluate(railGeometry)
    for (let i = 0; i < 8; i += 1) {
      await commitOneChange(page)
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(6500)
    const after = await page.evaluate(railGeometry)
    expect(after.scrollHeight).toBe(before.scrollHeight)
    expect(after.scrollTop, 'cumulative scroll drift').toBe(before.scrollTop)
    expect(after.effectsHeight).toBe(before.effectsHeight)
    expect(after.dinTop).toBe(before.dinTop)
    expect(after.ctaTop).toBe(before.ctaTop)
  })
})

test.describe('Kostendetails · the complete commercial explanation', () => {
  test('opens as a PAGE, with eight sections and focus on its own heading', async ({ page }) => {
    await reachConfiguredRail(page)
    await page.getByRole('button', { name: COCKPIT.cta }).click()

    // A ROUTE, not a modal: the address bar says where the reader is, which
    // is the whole reason Back can bring them home.
    await expect(page).toHaveURL(new RegExp(`${COST_DETAILS.path(DEMO_PROJECT_ID, 'OPT-01')}$`))
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: COST_DETAILS.title }))
      .toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1')

    for (const heading of COST_DETAILS.sections) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible()
    }

    // The rail does not follow: the same figures a second time, in a third
    // of the width, competing with the explanation the reader came for.
    await expect(page.locator(COCKPIT.cls.rail)).toHaveCount(0)

    // The ledger reconciles — that is what makes it composition rather than
    // the selection projection above it.
    await expect(page.getByText(COST_DETAILS.ledgerSum)).toBeVisible()

    // Non-numeric commercial states carry WORDS and never an amount.
    const openSection = page.locator('#kd-e')
    await expect(openSection.getByText(COST_DETAILS.states.noBasis).first()).toBeVisible()
    await expect(openSection.getByText(COST_DETAILS.states.bundle).first()).toBeVisible()
    // `± 0 €` never stands in for any of them.
    await expect(openSection).not.toContainText('± 0')

    // Regionalfaktor is stated, from canonical authority, as NOT included.
    await expect(page.locator('#kd-f')
      .getByText(COST_DETAILS.regionalInactive, { exact: true })).toBeVisible()

    // No nested detail chain survives: one page, no layer over a layer.
    await expect(page.getByRole('button', { name: 'Alle Details ansehen' })).toHaveCount(0)
  })

  test('effect → owning decision → Back → the same page → Back → the same context',
    async ({ page }) => {
      await reachConfiguredRail(page)
      await page.goto(`/projekt/${DEMO_PROJECT_ID}/option/OPT-01/kalkulieren/kg400`)
      const origin = page.url()
      await page.getByRole('button', { name: COCKPIT.cta }).click()
      const costDetails = page.url()

      const go = page.locator('#kd-b button.a3-dt-go').first()
      await expect(go).toBeVisible()
      // The accessible name NAMES the decision — never a bare arrow.
      expect(await go.getAttribute('aria-label')).toMatch(/^Zur Entscheidung · .+/)
      await go.click()
      // Semantic routing: a Configurator step, resolved through `optionNav`.
      await expect(page).toHaveURL(/\/kalkulieren\/kg\d00$/)

      await page.goBack()
      await expect(page).toHaveURL(costDetails)
      await page.goBack()
      await expect(page).toHaveURL(origin)
      await expect(page.locator(COCKPIT.cls.rail)).toBeVisible()
    })
})
