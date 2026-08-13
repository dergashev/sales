import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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
async function enterOption(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
}

async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  await enterOption(user)
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
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
    await enterOption(userEvent.setup())
    const group = screen.getByRole('radiogroup', { name: 'Ansicht' })
    const praesentation = within(group).getAllByRole('radio')[1] as HTMLInputElement
    expect(praesentation.disabled).toBe(true)
    // Причина именно видима, а не спрятана в title.
    expect(screen.getAllByText(/mindestens ein Gebäude auswählen/).length).toBeGreaterThan(0)
  })

  it('после подтверждения классификации переключение работает', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)

    const group = screen.getByRole('radiogroup', { name: 'Ansicht' })
    const praesentation = within(group).getAllByRole('radio')[1] as HTMLInputElement
    expect(praesentation.disabled).toBe(false)
    // Путь в клиентский вид — через ворота DC-33: переключатель их
    // открывает, режим меняет кнопка диалога (приёмка волны C).
    await user.click(praesentation)
    expect(useStore.getState().mode).toBe('intern')
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    expect(useStore.getState().mode).toBe('praesentation')
    expect(useStore.getState().gateOpen).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Bereit für die Präsentation/ })).toBeNull())
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungen KG 300' })).toHaveFocus()
  })
})

describe('Маршрут экрана возвращает начало документа', () => {
  it('сбрасывает прокрутку и фокусирует новый H1 при каждой смене экрана', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    const main = screen.getByRole('main')
    main.scrollTop = 420

    await user.click(screen.getByRole('button', { name: /Variantenvergleich/ }))
    expect(main.scrollTop).toBe(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Variantenvergleich' })).toHaveFocus()

    main.scrollTop = 320
    await user.click(screen.getByRole('button', { name: /^4Export/ }))
    expect(main.scrollTop).toBe(0)
    expect(screen.getByRole('heading', { level: 1, name: /Export/ })).toHaveFocus()
  })
})

describe('Herkunft-Popover: слой, фокус и выход (DC-21, KEY-002, приёмка № 17)', () => {
  async function openPopover(user: ReturnType<typeof userEvent.setup>) {
    await enterPipeline(user)
    const trigger = screen.getAllByRole('button', { name: /Herkunft anzeigen/ })[0]!
    await user.click(trigger)
    return trigger
  }

  it('фокус уходит ВНУТРЬ диалога, а не остаётся на body', async () => {
    const user = userEvent.setup()
    await openPopover(user)
    const dialog = await screen.findByRole('dialog', { name: 'Herkunft des Werts' })
    // Приёмка нашла фокус на BODY: диалог рендерился с visibility:hidden
    // до вычисления позиции, а скрытый элемент фокус не принимает.
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('Esc закрывает слой и возвращает фокус на триггер откуда угодно', async () => {
    const user = userEvent.setup()
    const trigger = await openPopover(user)
    // Фокус нарочно уводится наружу: слушатель на самом диалоге в этом
    // случае не срабатывал вовсе.
    ;(document.body as HTMLElement).focus()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Herkunft des Werts' })).toBeNull()
    })
    expect(document.activeElement).toBe(trigger)
  })

  it('прокрутка контейнера закрывает слой: объяснение не переживает смену контекста', async () => {
    const user = userEvent.setup()
    await openPopover(user)
    expect(screen.getByRole('dialog', { name: 'Herkunft des Werts' })).toBeInTheDocument()
    // Событие прокрутки не всплывает, но проходит фазу перехвата — слушатель
    // на window ловит прокрутку ЛЮБОГО контейнера страницы.
    const main = document.querySelector('main')!
    main.dispatchEvent(new Event('scroll', { bubbles: false }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Herkunft des Werts' })).toBeNull()
    })
  })
})

describe('DC-33 · единственная модалка системы — ворота в клиентский вид', () => {
  it('открывается, ловит фокус, Esc возвращает и в подготовку, и фокус', async () => {
    const user = userEvent.setup()
    await enterOption(user)
    // Пока здание не подтверждено, ворота показывают причину, а не
    // диалог: блокировка объясняет себя (правило 12).
    expect(screen.getAllByText(/mindestens ein Gebäude auswählen/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))

    const trigger = screen.getByRole('button', { name: 'Kundenansicht prüfen' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: /Bereit für die Präsentation/ })
    expect(dialog.contains(document.activeElement)).toBe(true)
    // Показано ИМЕННО то, что перестанет быть видимым; на vorgeschaltetem
    // Gebäudeschritt ohne vorgezogene Kalkulationsdaten.
    expect(within(dialog).getByText(/Bearbeitungshinweise und Quellenreferenzen/))
      .toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(useStore.getState().mode).toBe('intern')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('переход в клиентский вид происходит из диалога, а не мимо него', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    expect(useStore.getState().mode).toBe('praesentation')
  })
})

describe('DC-14 · тур: шаг без цели пропускается, а не ломает тур', () => {
  it('собирается из целей, которые ЕСТЬ на экране, и считает шаги от них', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    const appHost = document.body.firstElementChild as HTMLElement
    await user.click(screen.getByRole('button', { name: /Rundgang durch das Werkzeug/ }))

    const card = await screen.findByRole('dialog', { name: /Der Preis ist immer sichtbar/ })
    expect(card).toHaveAttribute('aria-modal', 'true')
    expect(within(card).getByRole('heading', { name: /Der Preis ist immer sichtbar/ })).toHaveFocus()
    expect(appHost.inert).toBe(true)
    // Счётчик считает ЖИВЫЕ шаги: заметки на этом экране нет, и её шаг в
    // знаменатель не попадает — иначе тур обещал бы шаг, которого не будет.
    const weiter = within(card).getByRole('button', { name: /Weiter/ })
    const total = Number(weiter.textContent!.match(/\/(\d+)/)![1])
    expect(total).toBeGreaterThan(1)
    expect(total).toBeLessThan(6)

    // Проходится до конца и закрывается сам.
    for (let k = 0; k < total; k++) {
      const btn = within(card).queryByRole('button', { name: /Weiter|Rundgang beenden/ })
      if (!btn) break
      await user.click(btn)
    }
    expect(useStore.getState().tourOpen).toBe(false)
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(appHost.inert).toBe(false)
    })
  })

  it('в презентации тура не существует — ни кнопки, ни карточки', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(screen.queryByRole('button', { name: /Rundgang/ })).toBeNull()
    act(() => useStore.getState().setTourOpen(true))
    expect(screen.queryByRole('dialog', { name: /Der Preis/ })).toBeNull()
  })
})
