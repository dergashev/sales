import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

/** Complete the three explicit building-review sections before final confirmation. */
export async function confirmBuildingReviewSections(
  user: ReturnType<typeof userEvent.setup>,
) {
  for (let section = 0; section < 3; section += 1) {
    await user.click(await screen.findByRole('button', { name: 'Abschnitt bestätigen' }))
  }
}
