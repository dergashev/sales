import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  confirmBuildingReviewSections, decideAllKgScope, enterOptionWorkspace,
  completeBuildingScope,
} from '../../test/offer-option'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * AUD-01 (EXP-01/EXP-02): the pure store-level tests in
 * `preview-outcome.test.ts` prove `s.preview` itself clears/resolves
 * correctly. This file proves the RENDERED rail actually reflects that —
 * a human label reaching the DOM (not just the label-source function
 * returning one), and the preview slot genuinely losing its `.a3-show`
 * state and going `aria-hidden` on a stage change, not merely latching a
 * value nothing renders differently for.
 *
 * VR3-03 moved the subject onto the two decisions the unified Konfigurator
 * records (`kgScope`/`kgService`). The defect class is unchanged and is the
 * reason this file exists: a preview whose label is an internal id, and a
 * preview that survives a navigation the store thought it had cleared. The
 * retired `kg300` option groups were only the surface it was first found on.
 */

beforeEach(() => __resetStoreForTests())

async function enterKg400Chapter(user: ReturnType<typeof userEvent.setup>) {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  decideAllKgScope('included')
  act(() => {
    useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_400_DETAILS)
  })
}

describe('AUD-01: der gerenderte Vorschau-Slot — menschlicher Text, zuverlässiges Löschen', () => {
  it('zeigt den Dienst und die Variante im Klartext, nicht die rohen Ids (EXP-02)', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await enterKg400Chapter(user)

    act(() => {
      useStore.getState().previewOption({
        kind: 'kgService',
        serviceId: 'b-400-heat',
        value: { state: 'selected', variant: 'perBuilding' },
      })
    })

    const preview = container.querySelector('.a3-preview')
    expect(preview).not.toBeNull()
    // VR3-TGA-01 renamed this decision to the audit's canonical name: it is
    // the SCOPE decision of the heat system (`gemeinsame Anlage` vs `je
    // Gebäude`), and calling it a "concept" hid that.
    expect(preview!.textContent).toContain('Anlagenkonzept')
    expect(preview!.textContent).toContain('Je Gebäude eine eigene Anlage')
    // The raw id pair must not reach the rendered slot — the exact class of
    // defect the audit screenshotted on the retired surface.
    expect(preview!.textContent).not.toMatch(/b-400-heat/)
    expect(preview!.textContent).not.toMatch(/perBuilding/)
  })

  it('nennt eine Umfangsentscheidung mit Kostengruppe und Wort, nicht mit Enum', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await enterKg400Chapter(user)

    act(() => {
      useStore.getState().previewOption({
        kind: 'kgScope', group: 'KG_500', value: 'excluded',
      })
    })

    const preview = container.querySelector('.a3-preview')
    expect(preview!.textContent).toContain('KG')
    expect(preview!.textContent).toContain('500')
    expect(preview!.textContent).toContain('nicht enthalten')
    expect(preview!.textContent).not.toMatch(/KG_500/)
    expect(preview!.textContent).not.toMatch(/\bexcluded\b/)
  })

  it('Stufenwechsel löscht die Vorschau auch im DOM — nicht nur im Store (EXP-01, AC-1)', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await enterKg400Chapter(user)

    act(() => {
      useStore.getState().previewOption({
        kind: 'kgService',
        serviceId: 'b-400-heat',
        value: { state: 'selected', variant: 'perBuilding' },
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

  it('eine echte Zeigergeste auf einer Dienstzeile füllt den Slot ohne Force', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await enterKg400Chapter(user)

    // A real hover on a real label — the pointer path the audit found broken
    // on the retired control (F-009), proven on the canonical one.
    //
    // VR3-TGA-01: KG 400's decisions live inside a system that opens in
    // place, so reaching one means opening its system first. That is the
    // interaction under test's own precondition now, not a detour.
    await user.click(screen.getAllByRole('button', { name: /^Wärme/ })[0]!)
    // VR3-TGA-UX-00: a decided decision is a summary; its alternatives — and
    // therefore the hover preview — exist in edit mode, one `Ändern` away.
    await user.click(await screen.findByRole('button', { name: 'Ändern · Wärmeerzeuger' }))
    const rows = await screen.findAllByRole('radiogroup', { name: /^Entscheidung/ })
    await user.hover(rows[0]!.querySelectorAll('label')[1]!)
    await act(async () => { await new Promise((r) => setTimeout(r, 260)) })

    expect(container.querySelector('.a3-preview')).not.toBeNull()
  })
})
