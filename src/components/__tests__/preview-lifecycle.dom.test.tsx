import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections, enterOptionWorkspace, completeBuildingScope } from '../../test/offer-option'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import { __resetStoreForTests, includedBuildingIds, useStore } from '../../state/store'

/**
 * AUD-01 (EXP-01/EXP-02): the pure store-level tests in
 * `preview-outcome.test.ts` prove `s.preview` itself clears/resolves
 * correctly. This file proves the RENDERED rail actually reflects that —
 * a human label reaching the DOM (not just the label-source function
 * returning one), and the preview slot genuinely losing its `.a3-show`
 * state and going `aria-hidden` on a chapter change, not merely latching a
 * value nothing renders differently for.
 */

beforeEach(() => __resetStoreForTests())

async function enterKg300Chapter(user: ReturnType<typeof userEvent.setup>) {
  enterOptionWorkspace()
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  act(() => {
    useStore.getState().setCoverage('KG_300', 'included')
    useStore.getState().setCoverage('KG_400', 'included')
    useStore.getState().setCoverage('KG_700', 'included')
  })
  await user.click(screen.getAllByRole('button', { name: /Leistungsabgrenzung/ })[0]!)
  await user.click(screen.getAllByRole('button', { name: /Leistungen KG 300/ })[0]!)
}

describe('AUD-01: der gerenderte Vorschau-Slot — menschlicher Text, zuverlässiges Löschen', () => {
  it('kg300-Vorschau zeigt „Fassade · Putz im EG, Holz ab 1.OG", nicht die rohen Ids (EXP-02)', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await enterKg300Chapter(user)

    const buildingId = includedBuildingIds(useStore.getState())[0]!
    act(() => {
      useStore.getState().previewOption({
        kind: 'kg300', buildingId, groupId: 'fassade', value: 'mixedTimber',
      })
    })

    const preview = container.querySelector('.a3-preview')
    expect(preview).not.toBeNull()
    expect(preview!.textContent).toContain('Fassade')
    expect(preview!.textContent).toContain('Putz im EG, Holz ab 1.OG')
    // The exact raw pair the audit screenshotted ("fassade · mixedTimber")
    // must not appear anywhere in the rendered slot.
    expect(preview!.textContent).not.toMatch(/\bfassade\b/)
    expect(preview!.textContent).not.toMatch(/\bmixedTimber\b/)
  })

  it('Kapitelwechsel löscht die Vorschau auch im DOM — nicht nur im Store (EXP-01, AC-1)', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await enterKg300Chapter(user)

    const buildingId = includedBuildingIds(useStore.getState())[0]!
    act(() => {
      useStore.getState().previewOption({
        kind: 'kg300', buildingId, groupId: 'fassade', value: 'mixedTimber',
      })
    })
    expect(container.querySelector('.a3-preview.a3-show')).not.toBeNull()

    act(() => {
      useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
    })

    const preview = container.querySelector('.a3-preview')
    expect(preview).not.toBeNull()
    expect(preview!.classList.contains('a3-show')).toBe(false)
    expect(preview!.getAttribute('aria-hidden')).toBe('true')
  })
})
