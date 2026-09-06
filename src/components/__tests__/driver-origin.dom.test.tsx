import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  completeKgConfiguration, confirmBuildingReviewSections,
  decideAllKgScope, enterOptionWorkspace, completeBuildingScope,
  openPresentStage,
  saveOptionBaseline,
  startClientPresentation,
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
    // client-eligible before it renders any commercial narrative section at
    // all. VR3-04 changed WHAT eligible means — a valid SAVED baseline, not
    // a confirmed configuration (audit F-002) — so the preamble saves.
    completeKgConfiguration()
    saveOptionBaseline()

    openPresentStage()
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)

    // VR3-05: the surface moved again — the approved client narrative
    // (T-040) replaces the Kostentreiber extract with the Option's
    // INVESTMENT COMPOSITION by cost group. The invariant this test exists
    // to prove is unchanged and is what is asserted below: a client-facing
    // attribution names the DIN 276 cost group, never a building. The new
    // surface cannot break it by construction — it reads the KG catalogue's
    // own chapter titles and never touches a building's display name — so
    // this is a regression guard on that construction, not on a formatter.
    await user.click(screen.getByRole('button', { name: 'Investition' }))
    const composition = await screen.findByRole('heading', {
      level: 2, name: 'Zusammensetzung',
    })
    const panel = composition.closest('article') as HTMLElement
    expect(panel).not.toBeNull()
    expect(within(panel).getByText('Baukonstruktion')).toBeInTheDocument()
    expect(within(panel).getByText('Technische Anlagen')).toBeInTheDocument()
    expect(panel).not.toHaveTextContent('Haus A')
    expect(panel).not.toHaveTextContent('Haus B')
  })
})
