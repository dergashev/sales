import { expect, type Page } from '@playwright/test'
import {
  BUILDING_SCOPE, DEMO_COMPLEX_PROJECT_NAME, DEMO_COMPLEX_PROJECT_TITLE,
  DEMO_PROJECT_NAME, DEMO_PROJECT_TITLE, KONFIGURATOR_GATE, NAV, OPPORTUNITY,
} from './anchors'

/**
 * Short project name → the portfolio card's canonical title.
 *
 * Specs identify a fixture by the name they see everywhere INSIDE it; the
 * portfolio card is the one surface that titles it by address. One mapping
 * here beats every spec learning the address form.
 */
function portfolioTitleOf(projectName: string): string {
  if (projectName === DEMO_PROJECT_NAME) return DEMO_PROJECT_TITLE
  if (projectName === DEMO_COMPLEX_PROJECT_NAME) return DEMO_COMPLEX_PROJECT_TITLE
  throw new Error(`journey: «${projectName}» is not a navigable portfolio project`)
}

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
  // One anchor: every navigable card offers the same primary action, and
  // its accessible name carries the card's canonical TITLE. `projectName`
  // stays the parameter because that is what callers know; the title is
  // resolved here so no spec has to.
  await page.getByRole('button', {
    name: OPPORTUNITY.configureCta(portfolioTitleOf(projectName)),
  }).click()

  const start = page.getByRole('button', { name: OPPORTUNITY.startAnalysis })
  await expect(start).toBeVisible()
  await start.click()

  // Completion does not navigate by itself (accepted 2026-09-05 Documents
  // workspace audit): the user has to be able to see what the analysis
  // produced before the page moves. The rail's primary action is that
  // deliberate step, and it appears only when the job is terminal.
  const review = page.getByRole('button', { name: OPPORTUNITY.reviewUnderstanding })
  await expect(review).toBeVisible({ timeout: 30_000 })
  await review.click()

  // The gate opens only when the analysis has completed and no blocking
  // conflict is outstanding. `toBeEnabled` is not enough on its own: the
  // canonical Button blocks with `aria-disabled`, so the gate's own state
  // is the honest signal.
  const create = page.getByRole('button', { name: OPPORTUNITY.createOption, exact: true })
  await expect(create).toBeVisible({ timeout: 30_000 })

  // The complex fixture's six blocking conflicts are a hard gate: no Option
  // exists until every one of them carries a decision. They are decided from
  // the fixture's OWN recommendation — the demonstration's sanctioned
  // answer — so this walks the gate rather than bypassing it.
  const conflictsTab = page.getByRole('tab', { name: /Strittige Angaben/ })
  if (await conflictsTab.count() > 0) {
    await conflictsTab.click()
    for (let i = 0; i < 12; i += 1) {
      const recommended = page.getByRole('radio', { name: /Empfohlener Wert/ }).first()
      if (await recommended.count() === 0) break
      await recommended.click()
      const record = page.getByRole('button', { name: 'Entscheidung bestätigen' }).first()
      if (await record.count() === 0) break
      await record.click()
    }
  }

  await expect(create).not.toHaveAttribute('aria-disabled', 'true', { timeout: 30_000 })
  await create.click()

  // VR3-02 (T-012): the hand-off's one continuation names the stage it
  // opens. `Öffnen` in the Option gallery still exists and still works —
  // this walks the primary path, which is the one the target describes.
  await page.getByRole('button', { name: OPPORTUNITY.defineScope }).click()
  await expect(page.getByRole('heading', { level: 1, name: NAV.items.buildingScope }))
    .toBeVisible({ timeout: 15_000 })
}

/**
 * Confirm every selected building's baseline and save the scope — the
 * transition that unlocks the Konfigurator (T-017).
 *
 * It reads the identities off the surface rather than being told them, so
 * it walks one building on the clean fixture and three on the complex one
 * without the caller having to know which.
 */
export async function saveBuildingScope(page: Page) {
  const confirms = page.getByRole('button', { name: /^Gebäudegrundlage bestätigen · / })
  // Only one baseline is open at a time, so this is a loop over identities,
  // not over controls that are all on screen at once.
  const reviews = page.getByRole('button', { name: /^Grundlage prüfen · / })
  const buildingCount = Math.max(await reviews.count(), 1)
  for (let i = 0; i < buildingCount; i += 1) {
    if (await reviews.count() > 0) await reviews.nth(i).click()
    const confirm = confirms.first()
    await expect(confirm).toBeVisible({ timeout: 15_000 })
    await confirm.click()
  }
  const save = page.getByRole('button', { name: BUILDING_SCOPE.save })
  await expect(save).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 })
  await save.click()
  await expect(page.getByRole('heading', { level: 1, name: KONFIGURATOR_GATE.available }))
    .toBeVisible({ timeout: 15_000 })
}
