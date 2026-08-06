import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
})
