import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Клавиатурные маршруты и фокус — правило проекта 22 и контракты
 * `components-core.md`.
 *
 * До 06.08 этот класс не проверялся ничем: движок покрывали юнит-тесты,
 * разметку — SSR-строки, а поведение под клавиатурой попадало в раздел
 * «проверяется только в браузере» каждого вердикта. Проверка «настоящий
 * ли это `<button>`» ничего не говорит о том, доходит ли до него фокус.
 *
 * Что здесь НЕ проверяется и почему: jsdom не считает раскладку, поэтому
 * зона нажатия 44 × 44, видимость контура фокуса и отсутствие
 * горизонтальной прокрутки остаются за живым браузером.
 */

beforeEach(() => __resetStoreForTests())

/**
 * Конвейер живёт внутри Opportunity Option, а не в корне продукта.
 * Каждый тест панелей обязан пройти путь пользователя целиком: иначе он
 * проверяет экран, до которого в продукте не дойти.
 */
async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
}

describe('Табы S2 — ручная активация (TABS-001, KEY-003)', () => {
  async function openVorbereitung(user: ReturnType<typeof userEvent.setup>) {
    // Подготовка живёт на уровне Opportunity, не в конвейере: пункт
    // навигации, ведущий на другой уровень, был телепортом, и его больше нет.
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    await user.click(screen.getByRole('button', { name: 'Vorbereitung öffnen' }))
    return screen.getByRole('tablist', { name: 'Vorbereitung' })
  }

  it('стрелка двигает фокус, но НЕ выбирает — выбор только Enter/Space', async () => {
    const user = userEvent.setup()
    const tablist = await openVorbereitung(user)
    const tabs = within(tablist).getAllByRole('tab')

    const selectedBefore = tabs.find((t) => t.getAttribute('aria-selected') === 'true')!
    await user.click(selectedBefore)
    await user.keyboard('{ArrowRight}')

    // Фокус уехал…
    expect(document.activeElement).not.toBe(selectedBefore)
    // …а выбор остался прежним: автоактивация запускала бы пересчёт панели.
    expect(selectedBefore).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Enter}')
    expect(document.activeElement).toHaveAttribute('aria-selected', 'true')
    expect(selectedBefore).toHaveAttribute('aria-selected', 'false')
  })

  it('roving tabindex: ровно один таб в цикле Tab', async () => {
    const user = userEvent.setup()
    const tablist = await openVorbereitung(user)
    const tabs = within(tablist).getAllByRole('tab')
    const inCycle = tabs.filter((t) => t.getAttribute('tabindex') === '0')
    expect(inCycle).toHaveLength(1)
  })

  it('Home и End уводят фокус на края списка', async () => {
    const user = userEvent.setup()
    const tablist = await openVorbereitung(user)
    const tabs = within(tablist).getAllByRole('tab')

    await user.click(tabs[0]!)
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(tabs[tabs.length - 1])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(tabs[0])
  })
})

describe('Herkunft-Popover — Esc закрывает и ВОЗВРАЩАЕТ фокус (KEY-002)', () => {
  it('открытие, закрытие по Esc, фокус на триггере', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    const trigger = screen.getAllByRole('button', { name: 'Herkunft anzeigen' })[0]!

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Herkunft des Werts' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    // Узел исчезает не мгновенно: AnimatePresence держит его до конца
    // выхода. Проверяется исчезновение, а не срок — срок принадлежит
    // движению и живёт в токенах.
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
    // Возврат фокуса — половина контракта: без него клавиатурный
    // пользователь оказывается в начале документа.
    expect(document.activeElement).toBe(trigger)
  })

  it('Tab внутри поповера циклится, наружу не уходит', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    await user.click(screen.getAllByRole('button', { name: 'Herkunft anzeigen' })[0]!)
    const dialog = screen.getByRole('dialog', { name: 'Herkunft des Werts' })

    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})

describe('Опции — нативная radio-группа (RADIO-001)', () => {
  it('стрелка в группе опций двигает И выбирает, событие попадает в журнал', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    // Навигация настоящая, через интерфейс: дёргать store мимо React
    // значило бы проверять не тот путь, которым ходит пользователь.
    // Пункт главы в сайдбаре — первый из совпадающих (второй появляется
    // в подписи кнопки «Weiter» внизу рабочей области).
    await user.click(screen.getAllByRole('button', { name: /Energie & Zertifikate/ })[0]!)

    const group = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    const radios = within(group).getAllByRole('radio')
    const checkedBefore = radios.findIndex((r) => (r as HTMLInputElement).checked)

    radios[checkedBefore]!.focus()
    await user.keyboard('{ArrowDown}')

    const checkedAfter = within(group).getAllByRole('radio')
      .findIndex((r) => (r as HTMLInputElement).checked)
    expect(checkedAfter).not.toBe(checkedBefore)
    // Выбор стрелкой — такое же событие журнала, как выбор мышью (M-4).
    expect(useStore.getState().journal.length).toBeGreaterThan(0)
  })
})

describe('Гейт режима презентации — блокировка объясняет причину (правило 12)', () => {
  it('сегмент недоступен и несёт видимую причину, а не только погашен', async () => {
    await enterPipeline(userEvent.setup())
    const group = screen.getByRole('radiogroup', { name: 'Modus' })
    const praesentation = within(group).getAllByRole('radio')[1] as HTMLInputElement
    expect(praesentation.disabled).toBe(true)
    // Причина именно видима, а не спрятана в title.
    expect(screen.getByText(/offener Blocker DEMO-VI-0001/)).toBeInTheDocument()
  })

  it('после подтверждения классификации переключение работает', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    await user.click(screen.getAllByRole('button', { name: 'Klassifikation bestätigen' })[0]!)

    const group = screen.getByRole('radiogroup', { name: 'Modus' })
    const praesentation = within(group).getAllByRole('radio')[1] as HTMLInputElement
    expect(praesentation.disabled).toBe(false)
    await user.click(praesentation)
    expect(useStore.getState().mode).toBe('praesentation')
  })
})
