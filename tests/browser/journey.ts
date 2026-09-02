import { expect, type Page } from '@playwright/test'
import { OPPORTUNITY } from './anchors'

/**
 * The project-level preamble every Option-level smoke needs, walked as a
 * real user in a real browser.
 *
 * VR3-01 replaced the retired project card, so the way into an Option is
 * now the journey itself: open the project, start the document analysis,
 * wait for the readiness gate to open, create the Option and open it. For
 * the clean fixture that is eight files with zero conflicts, so it costs a
 * couple of seconds and — unlike the five clicks it replaces — it actually
 * exercises the gate the product ships.
 *
 * The analysis is driven by the product's own ticker; this helper only
 * waits for the state it produces, so it can never mask a stalled job:
 * the readiness surface simply never appears and the expectation fails
 * with its own timeout.
 */
export async function reachOptionWorkspace(page: Page, projectName: string) {
  await page.getByRole('button', { name: OPPORTUNITY.openCta(projectName) }).click()

  const start = page.getByRole('button', { name: OPPORTUNITY.startAnalysis })
  await expect(start).toBeVisible()
  await start.click()

  // The gate opens only when the analysis has completed and no blocking
  // conflict is outstanding. `toBeEnabled` is not enough on its own: the
  // canonical Button blocks with `aria-disabled`, so the gate's own state
  // is the honest signal.
  const create = page.getByRole('button', { name: OPPORTUNITY.createOption, exact: true })
  await expect(create).toBeVisible({ timeout: 30_000 })
  await expect(create).not.toHaveAttribute('aria-disabled', 'true', { timeout: 30_000 })
  await create.click()

  // Scoped and exact: `Öffnen` alone is a case-insensitive SUBSTRING match
  // in Playwright and would also match `Option öffnen` beside it.
  await page.getByRole('region', { name: OPPORTUNITY.readinessHeadingRegion })
    .getByRole('button', { name: OPPORTUNITY.openOption, exact: true })
    .click()

  // The proposal fixture's own WFL conflict belongs to the OPTION workspace
  // (Gebäude & Umfang), not to the project: VR3-01's project conflicts are
  // the six coherent ones in the fixture register, and this one gates the
  // building confirmation rather than Option creation. The retired project
  // card resolved it before the Option existed; it is resolved where it
  // actually lives now, so the building can be confirmed.
  const resolve = page.getByRole('button', { name: OPPORTUNITY.adoptCustomerValue }).first()
  await expect(resolve).toBeVisible({ timeout: 15_000 })
  await resolve.click()
}
