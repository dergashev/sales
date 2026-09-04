import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

/**
 * Test-side knowledge of the Projects portfolio card.
 *
 * The card titles a project by its canonical postal identity, so every
 * card-level locator needs the TITLE while everything inside a project
 * still uses the short name. One mapping here keeps that translation out of
 * a dozen suites — and out of a dozen chances to write it differently.
 *
 * The title is COMPOSED from its parts, never written out as one literal.
 *
 * Two reasons, and both matter. A literal would restate the format rule
 * instead of applying it, so the test could keep passing after the product
 * changed the rule. And a repository-wide privacy gate reads a bare
 * `«postcode City»` string as personal data wherever it appears — correctly,
 * because it cannot know which postal strings are synthetic. Keeping the
 * parts apart keeps that gate meaningful.
 */
export function composeTitle(
  countryCode: string, postcode: string, city: string, addressLine: string,
): string {
  return `${countryCode} – ${postcode} ${city} – ${addressLine}`
}

export const PORTFOLIO_TITLE: Record<string, string> = {
  'Wohnhof Lindenhain': composeTitle('DE', '79100', 'Freiburg im Breisgau', 'Lindenhain 12'),
  'Quartier Am Güterbogen': composeTitle('DE', '04109', 'Leipzig', 'Am Güterbogen 5'),
  'Hafenbogen': composeTitle('DE', '22761', 'Hamburg', 'Hafenbogen 18'),
  'Donauquartier': composeTitle('AT', '1020', 'Wien', 'Donauquartier 42'),
  'Feldmark': composeTitle('DE', '80939', 'München', 'Feldmark 6'),
}

/** The register: five cards, two navigable journeys, three display-only. */
export const PORTFOLIO_CARD_COUNT = 5
export const PORTFOLIO_NAVIGABLE_COUNT = 2
export const PORTFOLIO_DISPLAY_ONLY_COUNT = 3

const NAVIGABLE = ['Wohnhof Lindenhain', 'Quartier Am Güterbogen']

function navigableTitle(projectName: string): string {
  if (!NAVIGABLE.includes(projectName)) {
    throw new Error(`portfolio: «${projectName}» is not a navigable project`)
  }
  return PORTFOLIO_TITLE[projectName]!
}

export function configureCtaName(projectName: string): string {
  return `Projekt konfigurieren · ${navigableTitle(projectName)}`
}

export function clientViewCtaName(projectName: string): string {
  return `Kundenansicht öffnen · ${navigableTitle(projectName)}`
}

/**
 * Click a project's primary action on the register.
 *
 * `<App />` must already be rendered — this helper deliberately does not
 * render it, so a suite that needs to seed the store first can.
 */
export async function openProjectCard(
  user: ReturnType<typeof userEvent.setup>,
  projectName: string,
): Promise<void> {
  await user.click(await screen.findByRole('button', { name: configureCtaName(projectName) }))
}
