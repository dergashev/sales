import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
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
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
  await confirmBuildingReviewSections(user)
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
  await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
  act(() => {
    useStore.getState().setCoverage('KG_300', 'included')
    useStore.getState().setCoverage('KG_400', 'included')
    useStore.getState().setCoverage('KG_700', 'included')
  })
  await user.click(screen.getAllByRole('button', { name: /Leistungsabgrenzung/ })[0]!)
  await user.click(screen.getAllByRole('button', { name: /Leistungen KG 300/ })[0]!)
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
    expect(drivers.some((d) => d.basis?.kind === 'rate')).toBe(true)
    expect(drivers.some((d) => d.basis?.kind === 'factor')).toBe(true)
    // Вклада без основания в этой конфигурации больше нет: базовая ставка
    // объёма тоже «количество × ставка» и теперь это объявляет. Проверять
    // отсутствующий вид значило бы держать тест на условии, которое сняли.

    await user.click(screen.getByRole('button', { name: /Kostentreiber/ }))
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

  it('вклад по ставке показывает количество в m² и ставку в €/m², а не в €', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // Вклад по ставке — подвал: количество в m², ставка в €/m². KG 500 для
    // этого больше не годится, она считается долей блока (решение D-27), и
    // это верно: вид основания следует за формулой, а не за экраном.
    await user.click(screen.getByRole('button', { name: /Kostentreiber/ }))
    const row = document.querySelector('[data-driver-id="untergeschoss_vollausbau"]')
    expect(row).not.toBeNull()
    const trigger = row!.querySelector('button')!
    await user.click(trigger)

    // Величина и её единица обязаны совпадать. Прежняя версия печатала
    // «Angewendet auf 2.000,00 €» для двух тысяч КВАДРАТНЫХ МЕТРОВ: формат
    // верный, величина чужая, и на переговорах это неотличимо.
    const popover = document.body.textContent ?? ''
    expect(popover).toContain('Menge')
    expect(popover).toContain('Satz')
    expect(popover).not.toContain('Angewendet auf 400,00')
  })

  it('вклад по множителю показывает базу в € и сам множитель', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    await user.click(screen.getByRole('button', { name: /Kostentreiber/ }))
    const row = document.querySelector('[data-driver-id="gebaeudeklasse_GK_5"]')
    expect(row).not.toBeNull()
    await user.click(row!.querySelector('button')!)

    const text = document.body.textContent ?? ''
    expect(text).toContain('Angewendet auf')
    expect(text).toContain('Faktor')
  })

  it('в клиентском режиме сохраняет объявленный DIN 276 scope вместо имени здания', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    await user.click(screen.getByRole('button', { name: /Kostentreiber/ }))

    const drivers = screen.getByRole('region', { name: 'Kostentreiber' })
    const label = within(drivers).getByText(/^Untergeschoss · Rohbau und Ausbau ·/, {
      selector: 'span[aria-hidden="true"]',
    })
    const row = label.closest('tr')
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent(/erhöht\s*·\s*UG/)
    expect(row).not.toHaveTextContent('Haus A')

    await user.click(within(row!).getByRole('button', { name: /^Details/ }))
    const popover = screen.getByRole('dialog', { name: 'Herkunft des Werts' })
    expect(within(popover).getByText('Scope · UG')).toBeInTheDocument()
    expect(popover).not.toHaveTextContent('Haus A')
  })
})
