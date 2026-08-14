import { test, expect } from '../fixtures'
import { VIEWPORT_GUARD } from '../anchors'

/**
 * Guard-integrity negative control (Engineering Architecture handoff,
 * smoke coverage item 3 / testing expectation T5).
 *
 * Same build, same runner, same served candidate — only the viewport
 * changes, to BELOW the 1280px minimum (`--size-app-min-width`,
 * `design-system/tokens.css:443`). At 1279px the guard
 * (`.a3-viewport-warning`) MUST become visible with its German copy.
 *
 * This proves two things this suite cannot otherwise prove from the
 * >=1280px specs alone:
 *  - the responsive guard is unmodified, not merely "happens to be hidden";
 *  - nothing in this test runner (no CSS injection, no media-query
 *    override, no zoom, no forced deviceScaleFactor) suppresses it — the
 *    task explicitly forbids bypassing the guard, and a suite that only
 *    ever asserted "hidden at 1440" could not tell a real guard from a
 *    disabled one.
 */
test.use({ viewport: { width: 1279, height: 900 } })

test.describe('viewport guard integrity', () => {
  test('the minimum-width guard appears below 1280px, unmodified', async ({ page }) => {
    await page.goto('/')

    const guard = page.locator(VIEWPORT_GUARD.selector)
    await expect(guard).toBeVisible()
    await expect(guard.locator('strong')).toHaveText(VIEWPORT_GUARD.titleDe)
  })
})
