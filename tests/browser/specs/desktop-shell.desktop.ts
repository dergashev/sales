import { test, expect } from '../fixtures'
import { DOCUMENT_TITLE, VIEWPORT_GUARD } from '../anchors'

/**
 * Smoke coverage items 1, 2, 4, 7 (Engineering Architecture handoff):
 *  1. the app loads at a genuine supported desktop width;
 *  2. the normal working interface renders instead of "Bildschirm zu klein";
 *  4. primary navigation is available;
 *  7. no fatal browser runtime error occurs (via the shared fixture).
 *
 * The viewport itself comes from `playwright.config.ts` (default 1440x900,
 * overridable via A3_VIEWPORT_WIDTH/HEIGHT) — this spec does not set it
 * locally, so it always reflects whatever the runner actually requested.
 */
test.describe('desktop shell', () => {
  test('loads the real working interface at desktop width', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(DOCUMENT_TITLE)
    await expect(page.locator('#root')).not.toBeEmpty()

    // Guard-integrity (C2): assert COMPUTED VISIBILITY, never element
    // absence. The guard (`.a3-viewport-warning`) is always mounted in the
    // DOM at every viewport width — only a CSS media query toggles it. If
    // the element were missing entirely, that would indicate the guard was
    // deleted, not that it correctly stayed hidden; this suite must not
    // treat that as the same thing as "hidden because we're wide enough".
    const guard = page.locator(VIEWPORT_GUARD.selector)
    await expect(guard).toHaveCount(1)
    await expect(guard).toBeHidden()

    // The list-level shell (root of the product) shows the breadcrumb-free
    // header and the Opportunity list — not the desktop-too-small notice.
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible()
  })

  test('primary navigation is available once inside an option', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: `Musterprojekt Nordfeld öffnen` }).click()

    // At Opportunity-card level there is no left sidebar yet (DC-15/DC-34:
    // list and card levels are outside the three-zone pipeline shell) — the
    // stable navigation landmark at that level is the breadcrumb.
    await expect(page.getByRole('navigation', { name: 'Pfad' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Opportunities' })).toBeVisible()
  })
})
