import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Сквозной сценарий одним проходом: очередь → подготовка → конфигуратор →
 * сравнение → отправка.
 *
 * Зачем отдельно от экранных тестов. Экранный тест доказывает, что экран
 * работает; он ничего не говорит о том, можно ли ДОЙТИ от первого до
 * последнего. Разрыв потока — переход, которого нет, гейт, который не
 * открывается, состояние, теряемое между экранами — не виден ни одному из
 * них по построению, потому что каждый начинает с чистого состояния.
 *
 * Проверяется именно НЕПРЕРЫВНОСТЬ: журнал накапливается через переходы,
 * гейт открывается изнутри потока, отправка достижима.
 */

beforeEach(() => __resetStoreForTests())

const nav = (name: RegExp) => screen.getAllByRole('button', { name })[0]!

describe('Сквозной сценарий продажи', () => {
  it('доходит от очереди до отправки, не теряя состояние между экранами', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Конфигуратор: смена энергостандарта — первое событие журнала.
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Energie & Qualität/))
    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)
    expect(useStore.getState().journal).toHaveLength(1)

    // Уход на другой экран и возврат: состояние переживает переход.
    await user.click(nav(/Vorbereitung/))
    await user.click(nav(/Konfigurator/))
    expect(useStore.getState().journal).toHaveLength(1)
    expect(useStore.getState().building.energiestandard).toBe('EH_40')

    // Гейт открывается изнутри потока, а не обходится.
    expect(useStore.getState().building.gebaeudeklasse.confirmed).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Klassifikation bestätigen' }))
    expect(useStore.getState().building.gebaeudeklasse.confirmed).toBe(true)

    // Сравнение и отправка достижимы; журнал накопил оба события.
    await user.click(nav(/Variantenvergleich/))
    await user.click(nav(/^S5|Export/))
    expect(screen.getByRole('button', { name: /Preflight/ })).toBeInTheDocument()
    expect(useStore.getState().journal).toHaveLength(2)
  })

  it('глава 9 показывает Bauzeit обеими формами: полосой и таблицей', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Termine & Kommerzielles/))

    // Диаграмма скрыта от скринридера, содержание доступно таблицей
    // (GANTT-003): полоса иллюстрирует, но не является носителем.
    const table = await screen.findByRole('table', { name: /Bauzeit nach Phasen/ })
    expect(within(table).getByText('Planung')).toBeInTheDocument()
    expect(within(table).getByText(/Ausführung Haus/)).toBeInTheDocument()
    // Даты — из фикстуры, а не из разметки. 04.04 встречается дважды по
    // построению: конец планирования и начало исполнения — одна дата
    // (halfOpen-конвенция фикстуры), и это правильно, а не дубль.
    expect(within(table).getAllByText('04.04.2027')).toHaveLength(2)
    expect(within(table).getByText('19.11.2027')).toBeInTheDocument()
  })

  it('интервал точности показан деньгами, а не только процентом (DC-3)', async () => {
    render(<App />)
    // ± 22 % от точного 3.817.835 → края 2.977.911,30 и 4.657.758,70,
    // округление денег до тысячи. Считается от ТОЧНОГО, не от показанного.
    expect(screen.getByText(/2\.978\.000/)).toBeInTheDocument()
    expect(screen.getByText(/4\.658\.000/)).toBeInTheDocument()
  })

  it('скидка: слайдер называет последствие, сторож маржи — текстом (DC-25)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav(/^S5|Export/))

    const slider = screen.getByRole('slider', { name: /Rabatt in Prozent/ })
    // aria-valuetext называет деньги, а не только процент: процент без
    // суммы заставляет считать в уме на переговорах.
    expect(slider.getAttribute('aria-valuetext')).toMatch(/Endpreis/)
    // Состояние маржи — текстом, не цветом (DC-25, правило 8).
    expect(screen.getByText(/Marge Eigenleistung nach Rabatt/)).toBeInTheDocument()
  })

  it('маржа не существует в презентации, а не скрыта стилем (D-01)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Klassifikation bestätigen' }))
    const modus = screen.getByRole('radiogroup', { name: 'Modus' })
    await user.click(within(modus).getAllByRole('radio')[1]!)
    await user.click(nav(/^S5|Export/))
    expect(screen.queryByText(/Marge Eigenleistung/)).not.toBeInTheDocument()
  })

  it('кольцо готовности считает пункты, а не проценты (DC-26)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav(/^S1|Projekte/))
    // Скелетон уходит через 700 мс — ждём появления карточки.
    const ring = await screen.findByRole('group', { name: /Bereitschaft/ }, { timeout: 3000 })
    // Подпись называет ПУНКТЫ: «73 %» не говорит, чего не хватает.
    expect(within(ring).getByText(/von 3 Punkten erledigt/)).toBeInTheDocument()
  })

  it('Recap после доставки выводится из журнала, а не пишется руками (DC-31)', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Изменение, которое обязано попасть в итог встречи.
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Energie & Qualität/))
    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)
    await user.click(screen.getByRole('button', { name: 'Klassifikation bestätigen' }))

    await user.click(nav(/^S5|Export/))
    await user.click(screen.getByRole('button', { name: /Preflight/ }))
    await user.click(screen.getByRole('button', { name: /Preflight bestanden/ }))
    await user.click(screen.getByRole('button', { name: /Bestätigen/ }))

    // Доставка симулируется 2,5 с. Ожидание обёрнуто в `act` намеренно:
    // обновление приходит из голого setTimeout, и без обёртки React его
    // не сбрасывает в разметку — тест ждал бы вечно то, что уже случилось.
    await act(() => new Promise((r) => setTimeout(r, 3000)))
    const recap = screen.getByRole('heading', { level: 3, name: 'Termin-Zusammenfassung' })
    const box = recap.parentElement!
    expect(within(box).getByText(/EH 55 → EH 40/)).toBeInTheDocument()
    // Открытое покрытие KG 500 попадает в «что осталось» из того же
    // множества, которое делает итог промежуточным.
    expect(within(box).getByText(/KG.500 — Deckungsentscheidung offen/)).toBeInTheDocument()
  })
})
