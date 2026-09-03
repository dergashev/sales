import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  completeKgConfiguration, confirmBuildingReviewSections, confirmWholeConfiguration,
  decideAllKgScope, enterOptionWorkspace, completeBuildingScope,
} from '../../test/offer-option'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Раскрытие происхождения (DC-21) у КАЖДОГО вида вклада.
 *
 * Сплошное ревью 26 нашло здесь падение всего экрана: поповер решал по
 * одному `appliedTo`, а у вкладов «ставка × количество» множителя нет —
 * `formatDE(d.factor!)` бросал `Cannot read properties of null`. Достаточно
 * было включить любую ценовую опцию и нажать `Details`.
 *
 * Юнит-тест движка этого не ловил и не мог: типы полей допускали такую
 * комбинацию, а падал не движок, а разметка. Поэтому тест здесь обходит
 * ВСЕ строки водопада и раскрывает каждую — единственная проверка, которая
 * растёт вместе с числом видов вклада, вместо того чтобы перечислять их
 * поимённо и отстать от следующего.
 */

beforeEach(() => __resetStoreForTests())

async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  enterOptionWorkspace()
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  // VR3-03: the contributions are the Option's own KG service decisions, so
  // the six scope decisions have to exist before there is a driver at all.
  decideAllKgScope('included')
}

describe('DC-21: происхождение раскрывается у каждого вида вклада', () => {
  it('водопад с вкладами всех видов раскрывается целиком и не роняет экран', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Включаем группу затрат: её вклад — «ставка × количество», тот самый
    // вид, на котором поповер падал. Плюс надбавка за риск (множитель от
    // своей базы) и вклад опции. После этого в водопаде есть все три вида.
    act(() => {
      useStore.getState().setCoverage('KG_500', 'included')
      useStore.getState().toggleRisiko('RISK-STATIK')
    })

    const drivers = useStore.getState().projection().result.drivers
    // VR3-03: every contribution is a DECLARED service amount from the KG
    // catalogue, so none of them carries a derived rate or factor basis —
    // and that is the honest shape. The defect this test exists for is the
    // popover crashing on a kind it did not expect, which is exactly what a
    // uniform `basis: null` set would have triggered before the fix.
    expect(drivers.length).toBeGreaterThan(20)
    expect(drivers.every((d) => d.basis === null)).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Alle Details ansehen' }))
    // Task 04 (F-35, rail a11y): each row's trigger now carries its own
    // driver-specific accessible name ("Details · <label>") so a
    // screen-reader buttons list can tell 12+ rows apart — the visible
    // text stays "Details", matched here by prefix.
    const details = screen.getAllByRole('button', { name: /^Details/ })
    expect(details.length).toBe(drivers.length)

    for (const btn of details) {
      await user.click(btn)
      await user.click(btn)
    }
  })

  it('ein Beitrag ohne Rechenbasis nennt Kostengruppe und Betrag — und erfindet keine Menge', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    await user.click(screen.getByRole('button', { name: 'Alle Details ansehen' }))
    const row = document.querySelector('[data-driver-id^="kg_"]')
    expect(row).not.toBeNull()
    await user.click(row!.querySelector('button')!)

    const text = document.body.textContent ?? ''
    // The popover states what IS known — the DIN 276 group the contribution
    // belongs to — and prints neither a quantity nor a rate it does not
    // have. A fabricated "Angewendet auf" line beside a declared amount is
    // the same class of defect as a quantity in the wrong unit.
    expect(text).toContain('KG')
    expect(text).not.toContain('Angewendet auf')
    expect(text).not.toContain('Satz')
  })

  it('в клиентском режиме сохраняет объявленный DIN 276 scope вместо имени здания', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // REDESIGN R3 WAVE 2a (ce17da51): Kundenansicht needs the Option to be
    // client-eligible (PD-3 readiness) before it renders any commercial
    // narrative section at all.
    completeKgConfiguration()
    confirmWholeConfiguration()

    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    // OfferPanel's rich Level-3 "Nachweise & Verlauf" dialog (origin
    // popovers, per-driver reconciliation table) no longer renders in
    // Kundenansicht at all — the rail itself is unmounted in client mode;
    // PresentationShell's §3 Ergebnis shows a simpler top-5 Kostentreiber-
    // Auszug instead (rule 35's actual minimum bar is up to 5 drivers +
    // sum = total, not the drill-down audit trail — see PresentationShell
    // .tsx and its own memory note on this disclosed scope boundary). The
    // underlying invariant this test exists to prove — DIN 276 scope
    // naming, never a building name — still holds, even more directly:
    // the new surface never calls the building-attribution resolver at
    // all (it strips any building-id key prefix and aggregates by label
    // instead of ever reading a building's display name).
    //
    // VR2-06: the narrative shell now shows one full-bleed page at a time
    // (switched by the top-bar strip) instead of a scrolled stack of every
    // section — §3 Ergebnis only mounts once its tab is active, and the
    // tab-switch cross-fade resolves on a real timer tick, not
    // synchronously with the click (`src/test/setup.ts`'s `requestAnimation
    // Frame` polyfill).
    await user.click(screen.getByRole('button', { name: 'Ergebnis' }))
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Ergebnis' })).toBeInTheDocument()
    })
    const ergebnis = screen.getByRole('region', { name: 'Ergebnis' })
    expect(within(ergebnis).getByText('Kostentreiber')).toBeInTheDocument()
    expect(ergebnis).not.toHaveTextContent('Haus A')
    expect(ergebnis).not.toHaveTextContent('Haus B')
  })
})
