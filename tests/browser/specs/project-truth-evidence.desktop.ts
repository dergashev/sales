import { test, expect, type Page } from '../fixtures'
import {
  DEMO_COMPLEX_PROJECT_TITLE, DEMO_PROJECT_TITLE, DOCUMENT_SOURCE, EVIDENCE,
  OPPORTUNITY, PORTFOLIO, PORTFOLIO_CARD_COUNT,
} from '../anchors'

/**
 * B1 · «Project truth and evidence drive readiness», in a real browser.
 *
 * Three things this ticket owns cannot be proved anywhere else:
 *
 *  - **Back and Forward.** The register keeps its filters in the URL, and
 *    the acceptance criterion is that removing one filter brings results
 *    back REPEATEDLY and through the browser's own history. jsdom has no
 *    session history; `history.back()` there is a mock of the thing under
 *    test.
 *  - **The source document.** A citation opens an authored PDF in an
 *    `<object>`. Whether the identity, the page position and the cited
 *    clause survive WITHOUT the rendered page is a question about a real
 *    embed, and the answer must be «yes» because a headless Chromium shows
 *    no PDF plugin — which is exactly the reader this rule exists for.
 *  - **Both supported widths.** 1280 is a composition, not a squeezed 1440,
 *    and the failure mode is horizontal overflow that no unit test can see.
 *
 * The viewport comes from `playwright.config.ts` (the runner's own
 * `--width`/`--height`), never from this file: an evidence run must be able
 * to state the width it actually used.
 */

/** No surface of this ticket may make the page scroll sideways. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return { scroll: doc.scrollWidth, client: doc.clientWidth }
  })
  expect(overflow.scroll, `document scrolls ${overflow.scroll}px in ${overflow.client}px`)
    .toBeLessThanOrEqual(overflow.client)
}

test.describe('the Projects register begins honestly', () => {
  test('five cards, and both navigable projects start at Neu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: PORTFOLIO.heading })).toBeVisible()

    const cards = page.locator(PORTFOLIO.cls.card)
    await expect(cards).toHaveCount(PORTFOLIO_CARD_COUNT)

    // A fresh session has no committed analysis, no baseline and no Option,
    // so the derived status of BOTH demonstration projects is `Neu`. The
    // register used to read a status off the fixture, and Freiburg claimed
    // «Bereit zur Präsentation» with no price and no client view behind it.
    for (const title of [DEMO_PROJECT_TITLE, DEMO_COMPLEX_PROJECT_TITLE]) {
      const card = cards.filter({ hasText: title })
      await expect(card).toHaveCount(1)
      await expect(card.getByText(PORTFOLIO.statusNew, { exact: true })).toBeVisible()
    }

    await expectNoHorizontalOverflow(page)
  })

  test('the CRM placeholders answer, and change nothing at all', async ({ page }) => {
    await page.goto('/')
    const url = page.url()
    const historyBefore = await page.evaluate(() => window.history.length)

    const card = page.locator(PORTFOLIO.cls.card).filter({ hasText: DEMO_PROJECT_TITLE })
    const hubspot = card.getByRole('button', {
      name: `${PORTFOLIO.integrations.hubspot} · ${DEMO_PROJECT_TITLE}`,
    })

    // Reachable and operable from the keyboard, not only by pointer.
    await hubspot.focus()
    await expect(hubspot).toBeFocused()
    // The 44px target is a rule about the HIT AREA, and a real browser is
    // the only place its computed box can be read.
    const box = (await hubspot.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)

    await page.keyboard.press('Enter')
    await expect(card.getByText(PORTFOLIO.integrations.notConnected)).toBeVisible()

    // Nothing about the project moved: not the URL, not the history, not
    // the register. A placeholder that navigated would be a broken link
    // wearing the clothes of a feature.
    expect(page.url()).toBe(url)
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore)
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(PORTFOLIO_CARD_COUNT)

    // The second control answers too, and independently.
    const mission = card.getByRole('button', {
      name: `${PORTFOLIO.integrations.missionControl} · ${DEMO_PROJECT_TITLE}`,
    })
    await mission.click()
    await expect(card.getByText(PORTFOLIO.integrations.notConnected)).toBeVisible()
    expect(page.url()).toBe(url)
  })
})

test.describe('filters survive the browser', () => {
  test('zero results, one chip back, and the same again through Back/Forward', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: PORTFOLIO.filterToggle }).click()

    const search = page.getByRole('searchbox', { name: PORTFOLIO.search })
    await search.fill('Lindenhain')
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(1)
    const filteredUrl = page.url()
    expect(filteredUrl).not.toBe(page.url().split('?')[0])

    // A second filter that cannot agree with the first: zero results, and
    // the active filters STAY on screen so the reader can see what did it.
    await page.getByLabel(PORTFOLIO.city).selectOption({ label: 'Leipzig' })
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(0)
    await expect(page.getByText(PORTFOLIO.emptyFiltered)).toBeVisible()
    const chips = page.locator(PORTFOLIO.cls.chips)
    await expect(chips).toBeVisible()
    await expectNoHorizontalOverflow(page)

    // Removing exactly ONE chip restores results — the specific escape
    // hatch, not only the blunt «clear all».
    await chips.getByRole('button', { name: PORTFOLIO.chipRemove('Stadt: Leipzig') }).click()
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(1)

    // …and it works a second time, which is the acceptance criterion that
    // the recovery is not a one-shot.
    await page.getByLabel(PORTFOLIO.city).selectOption({ label: 'Leipzig' })
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(0)
    await chips.getByRole('button', { name: PORTFOLIO.chipRemove('Stadt: Leipzig') }).click()
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(1)

    // The browser's own history is the register's undo. Back returns to the
    // zero-result state WITH its filters still shown; Forward returns to the
    // result. A register that kept its filters in component state would pass
    // every assertion above and fail both of these.
    await page.goBack()
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(0)
    await expect(page.getByText(PORTFOLIO.emptyFiltered)).toBeVisible()
    await expect(page.locator(PORTFOLIO.cls.chips)).toBeVisible()

    await page.goForward()
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(1)

    await page.getByRole('button', { name: PORTFOLIO.clearAll }).click()
    await expect(page.locator(PORTFOLIO.cls.card)).toHaveCount(PORTFOLIO_CARD_COUNT)
  })
})

test.describe('Project Understanding shows the evidence, not a count of it', () => {
  test('four groups, their counts, and a citation that opens its document', async ({
    page,
  }) => {
    test.slow()
    await page.goto('/')
    await page.getByRole('button', {
      name: OPPORTUNITY.configureCta(DEMO_COMPLEX_PROJECT_TITLE),
    }).click()

    const start = page.getByRole('button', { name: OPPORTUNITY.startAnalysis })
    await expect(start).toBeVisible()
    await start.click()

    const review = page.getByRole('button', { name: OPPORTUNITY.reviewUnderstanding })
    await expect(review).toBeVisible({ timeout: 30_000 })
    await review.click()

    // The complex project has six unresolved conflicts, so this is the
    // NOT-yet-ready presentation of the stage — and the four groups have to
    // be here, because that is where a reader asks what was understood.
    const groups = page.locator(EVIDENCE.cls.groups)
    await expect(groups).toBeVisible()
    await expect(groups.getByRole('heading', { name: EVIDENCE.title })).toBeVisible()
    for (const name of EVIDENCE.groups) {
      await expect(groups.getByRole('heading', { name, exact: true })).toBeVisible()
    }
    await expect(page.locator(EVIDENCE.cls.group)).toHaveCount(EVIDENCE.groups.length)

    // Each group states `visible / total` on its own heading, and the head
    // is capped: a group is a head with a disclosure, never a register.
    const counts = groups.getByText(EVIDENCE.groupCount)
    await expect(counts).toHaveCount(EVIDENCE.groups.length)
    await expectNoHorizontalOverflow(page)

    // Every visible item names the decisions that will read it. That is the
    // stable-id contract the KG 400 ticket consumes, stated on the surface.
    await expect(groups.getByText(EVIDENCE.downstream).first()).toBeVisible()

    // A citation is a route, not a sentence about one.
    const openSource = groups.getByRole('button', { name: DOCUMENT_SOURCE.openSource }).first()
    await expect(openSource).toBeVisible()
    await openSource.click()

    const viewer = page.locator(DOCUMENT_SOURCE.cls.viewer).first()
    await expect(viewer).toBeVisible()
    // The identity, the position and the cited clause are TEXT beside the
    // embed. Headless Chromium renders no PDF at all, which makes this the
    // exact reader the rule was written for: everything needed to know
    // WHICH document and WHERE in it must survive the picture not painting.
    await expect(viewer.locator(DOCUMENT_SOURCE.cls.identity)).toBeVisible()
    await expect(viewer.getByText(DOCUMENT_SOURCE.position)).toBeVisible()
    await expect(viewer.getByText(DOCUMENT_SOURCE.citedClause)).toBeVisible()
    // Authored, synthetic, ours — stated on the artefact itself, so a demo
    // document can never be mistaken for a client's own.
    await expect(viewer.getByText(DOCUMENT_SOURCE.provenance)).toBeVisible()
    // The viewer keeps its box; it never collapses to nothing.
    const frame = (await viewer.locator(DOCUMENT_SOURCE.cls.frame).boundingBox())!
    expect(frame.height).toBeGreaterThan(0)

    // The citation is addressable: it travelled through the URL, so a
    // reload keeps the reader on the same clause of the same document.
    expect(page.url()).toMatch(/docopen=LEI-DOC-\d+/)
    expect(page.url()).toMatch(/docanchor=LEI-DOC-\d+-A\d+/)

    await expectNoHorizontalOverflow(page)
  })
})
