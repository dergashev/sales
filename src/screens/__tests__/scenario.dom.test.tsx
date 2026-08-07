import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { activeBuilding, __resetStoreForTests, useStore } from '../../state/store'

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

/**
 * Путь до конвейера: корень → карточка → разрешить конфликт →
 * подтвердить параметры → создать Option → открыть его. Раньше конвейер
 * был корнем продукта; теперь он живёт внутри Option, и каждый тест,
 * которому нужны панели, обязан пройти этот путь целиком — иначе он
 * проверяет экран, до которого пользователь не дошёл.
 */
async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
}

describe('Сквозной сценарий продажи', () => {
  it('доходит от очереди до отправки, не теряя состояние между экранами', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Конфигуратор: смена энергостандарта — первое событие журнала.
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Energie & Zertifikate/))
    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)
    // Путь до конвейера сам оставляет след: решённый конфликт,
    // подтверждённые параметры, созданный Option — три события до этого.
    expect(useStore.getState().journal).toHaveLength(4)

    // Уход на другой экран и возврат: состояние переживает переход.
    await user.click(nav(/Variantenvergleich/))
    await user.click(nav(/Konfigurator/))
    expect(useStore.getState().journal).toHaveLength(4)
    expect(activeBuilding(useStore.getState()).energiestandard).toBe('EH_40')

    // Гейт открывается изнутри потока, а не обходится.
    expect(activeBuilding(useStore.getState()).gebaeudeklasse.confirmed).toBe(false)
    await user.click(screen.getAllByRole('button', { name: 'Klassifikation bestätigen' })[0]!)
    expect(activeBuilding(useStore.getState()).gebaeudeklasse.confirmed).toBe(true)

    // Сравнение и отправка достижимы; журнал накопил оба события.
    await user.click(nav(/Variantenvergleich/))
    await user.click(nav(/^S5|Export/))
    expect(screen.getByRole('button', { name: /Preflight/ })).toBeInTheDocument()
    expect(useStore.getState().journal).toHaveLength(5)
  })

  it('глава 9 показывает Bauzeit обеими формами: полосой и таблицей', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Termine & Kommerzielles/))

    // Диаграмма скрыта от скринридера, содержание доступно таблицей
    // (GANTT-003): полоса иллюстрирует, но не является носителем.
    const table = await screen.findByRole('table', { name: /Bauzeit nach Phasen/ })
    expect(within(table).getByText('Planung')).toBeInTheDocument()
    // Полный каркас DC-19: фаза и единица — разные колонки таблицы.
    expect(within(table).getByText('Rohbau + Ausbau')).toBeInTheDocument()
    // Матчеры testing-library нормализуют пробелы: U+202F в DOM
    // сравнивается как обычный пробел — норму U+202F держит verify, не тест.
    expect(within(table).getByText(/Haus A/)).toBeInTheDocument()
    // Подпись длительности — из той же модели, что герой срока (D-17).
    expect(within(table).getByText(/≈ 7,5 Monate ab OKBP/)).toBeInTheDocument()
    // Даты — из фикстуры, а не из разметки. 04.04 встречается дважды по
    // построению: конец планирования и начало исполнения — одна дата
    // (halfOpen-конвенция фикстуры), и это правильно, а не дубль.
    expect(within(table).getAllByText('04.04.2027')).toHaveLength(2)
    expect(within(table).getByText('19.11.2027')).toBeInTheDocument()
  })

  it('глава 7 — глава данных: риск Baugrund типизирован, пустота Erschließung названа', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Baugrund & Erschließung/))
    // Риск — категория · вероятность · следствие, и он НЕ в цене (CALC-001).
    expect(screen.getByText('Baugrundgutachten liegt nicht vor')).toBeInTheDocument()
    // Приёмка № 17: надбавка — реальные деньги (D-02), и текст обязан
    // это говорить; в фикстуре она не применена, и это названо отдельно.
    expect(screen.getByText(/Risikozuschlag \+ 4 % auf KG 320/)).toBeInTheDocument()
    expect(screen.getByText(/Der Zuschlag ist echtes Geld/)).toBeInTheDocument()
    expect(screen.getByText(/noch nicht enthalten/)).toBeInTheDocument()
    // Пустота по Erschließung названа с источником, решение — в главе 3.
    expect(screen.getByText(/keine Angaben zur Erschließung/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zu Kapitel 3/ })).toBeInTheDocument()
  })

  it('дельта-чип и призрак ВИДИМЫ: состояние несёт .a3-show, не кадр анимации', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Energie & Zertifikate/))

    // До изменения слоты существуют (высота зарезервирована), но пусты.
    const chipBefore = document.querySelector('.a3-delta')!
    expect(chipBefore).toBeInTheDocument()
    expect(chipBefore.className).not.toContain('a3-show')

    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)

    // Приёмка № 17 нашла чип с opacity 0: класс ставился через rAF, который
    // в неактивной вкладке не выполняется. Теперь состояние — это класс на
    // постоянном элементе, и кадр анимации ни при чём.
    const chip = document.querySelector('.a3-delta')!
    expect(chip.className).toContain('a3-show')
    expect(chip.className).toMatch(/a3-(saving|cost)/)
    // Одна строка: двухстрочный чип распирал слот и сдвигал вёрстку.
    expect(chip.querySelectorAll('.block')).toHaveLength(0)
  })

  it('интервал точности показан деньгами, а не только процентом (DC-3)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // Интервал уже сужен: путь до конвейера включает разрешение конфликта
    // WFL, а оно делает значение подтверждённым клиентом — −5 Pp (D-19).
    // Поэтому края считаются от ± 17 %, а не от исходных ± 22 %: полоса
    // показывает ТЕКУЩУЮ точность, и это ровно то поведение, ради которого
    // интервал показан деньгами.
    expect(screen.getByText(/3\.169\.000/)).toBeInTheDocument()
    expect(screen.getByText(/4\.467\.000/)).toBeInTheDocument()
  })

  it('скидка: слайдер называет последствие, сторож маржи — текстом (DC-25)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
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
    await enterPipeline(user)
    await user.click(screen.getAllByRole('button', { name: 'Klassifikation bestätigen' })[0]!)
    const modus = screen.getByRole('radiogroup', { name: 'Modus' })
    await user.click(within(modus).getAllByRole('radio')[1]!)
    await user.click(nav(/^S5|Export/))
    expect(screen.queryByText(/Marge Eigenleistung/)).not.toBeInTheDocument()
  })

  it('кольцо готовности считает пункты, а не проценты (DC-26)', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Кольцо живёт в карточке Opportunity (гейт создания Options), а не
    // в списке проектов — списка S1 в конвейере больше не существует.
    await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    const ring = screen.getByRole('group', { name: /Bereitschaft/ })
    // Подпись называет ПУНКТЫ: «73 %» не говорит, чего не хватает.
    expect(within(ring).getByText(/von 2 Punkten erledigt/)).toBeInTheDocument()
  })

  it('Recap после доставки выводится из журнала, а не пишется руками (DC-31)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Изменение, которое обязано попасть в итог встречи.
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Energie & Zertifikate/))
    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)
    await user.click(screen.getAllByRole('button', { name: 'Klassifikation bestätigen' })[0]!)

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


  it('клиентская поверхность не цитирует реестр требований (MODE-001, дефект 13)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // Вход в презентацию гейтуется подтверждением классификации.
    await user.click(screen.getAllByRole('button', { name: 'Klassifikation bestätigen' })[0]!)
    const modes = screen.getByRole('radiogroup', { name: 'Modus' })
    await user.click(within(modes).getAllByRole('radio')[1]!)
    expect(useStore.getState().mode).toBe('praesentation')

    // Коды реестра — доказательная база подготовки, не язык переговоров.
    // Перечень префиксов явный: `OPT-01` (имя Option пользователя) и
    // `KG 300`/`DIN 276` кодами реестра не являются и остаются.
    const REGISTRY = /\b(?:CALC|XSC|VARIANT|MODE|OUT|GATE|LOCALE|EMAIL|SECURITY|DEMO|DC|RM|CORE|SCHED|DATA|OPTION|DRIVER|ANALYSIS|PROGRESS|STATE|LAYOUT|TOKEN|COLOR|TYPE|BORDER|MOTION|KEY|TABS|SOURCE|COMPLEX|METRIC|CHANGE|VERSION|SCOPE|PRINT|NOTE|ARCH|A11Y)-\d{2,3}\b|\bR-\d{2}\b|\bD-\d{2}\b/

    for (const chapter of [/Gebäude & Umfang/, /Leistungen KG 300/, /Leistungsabgrenzung/,
                           /Baugrund & Erschließung/, /Termine & Kommerzielles/]) {
      await user.click(nav(chapter))
      const text = document.body.textContent ?? ''
      const hit = text.match(REGISTRY)
      expect(hit?.[0] ?? null, `Kapitel ${chapter}: код реестра на клиентской поверхности`).toBeNull()
    }
  })
})
