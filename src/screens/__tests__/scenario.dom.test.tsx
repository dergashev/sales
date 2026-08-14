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
async function enterOption(user: ReturnType<typeof userEvent.setup>) {
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
  await user.click(screen.getByRole('radio', { name: /Je Gebäude konfigurieren/ }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
  await user.click(nav(/Leistungsabgrenzung/))
  await user.click(nav(/Leistungen KG 300/))
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
    // подтверждённые параметры, созданный Option и подтверждённое здание.
    expect(useStore.getState().journal).toHaveLength(6)

    // Уход на другой экран и возврат: состояние переживает переход.
    await user.click(nav(/Variantenvergleich/))
    await user.click(nav(/Konfigurator/))
    expect(useStore.getState().journal).toHaveLength(6)
    expect(activeBuilding(useStore.getState()).energiestandard).toBe('EH_40')

    // Гейт открывается на top-level шаге здания, а не обходится.
    expect(activeBuilding(useStore.getState()).gebaeudeklasse.confirmed).toBe(true)

    // Сравнение и отправка достижимы; журнал накопил оба события.
    await user.click(nav(/Variantenvergleich/))
    await user.click(nav(/^S5|Export/))
    expect(screen.getByRole('button', { name: /Preflight/ })).toBeInTheDocument()
    expect(useStore.getState().journal).toHaveLength(6)
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
    // Надбавка — реальные деньги (D-02) с НАЗВАННОЙ базой: подгруппа
    // KG 320, а не «примерно от KG 300». Решение PO 07.08 о третьем
    // уровне KG сделало сумму вычислимой.
    expect(screen.getByText(/Baugrundgutachten liegt nicht vor/)).toBeInTheDocument()
    expect(screen.getByText(/Zuschlag · 4 % auf KG 320/)).toBeInTheDocument()
    expect(screen.getAllByText(/Noch nicht im Angebot/).length).toBe(2)

    // Применение меняет ЦЕНУ и создаёт событие журнала.
    const before = useStore.getState().projection().result.total.exact
    await user.click(screen.getAllByRole('button', { name: 'Zuschlag anwenden' })[0]!)
    const after = useStore.getState().projection().result.total.exact
    expect(after.gt(before)).toBe(true)
    // Ровно 4 % от подгруппы KG 320, а не от чего-то похожего.
    const kg320 = useStore.getState().projection().kgSplit.KG_300.mul('0.11')
    expect(after.minus(before).toFixed(2)).toBe(kg320.mul('0.04').toFixed(2))
    expect(screen.getAllByText(/Im Angebot enthalten/).length).toBe(1)
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

  it('карточки опций несут фотографии, но смысл остаётся за подписью (D-21, правило 8)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungen KG 300/))

    const media = document.querySelectorAll('img.a3-option-media, img.a3-img')
    expect(media.length).toBeGreaterThan(5)
    // Изображение декоративно: вариант назван текстом, и повтор мотива
    // вслух был бы вторым чтением того же (правило 8).
    for (const img of media) expect(img.getAttribute('alt')).toBe('')
    // Подпись и цена стоят на плитке независимо от картинки.
    const tile = document.querySelector('.a3-okc-tile')!
    expect(tile.querySelector('b')?.textContent?.length).toBeGreaterThan(1)
    expect(tile.querySelector('.a3-pd')).not.toBeNull()
  })

  it('варианты сравниваются бок о бок ДО фиксации, и итог сходится с плиткой', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungen KG 300/))

    const before = useStore.getState().projection().result.total.exact
    // Сравнение раскрывается по требованию: каталог остаётся лёгким.
    await user.click(screen.getAllByRole('button', { name: /Varianten nebeneinander/ })[0]!)
    const table = screen.getAllByRole('table', { name: /Vergleich der Varianten/ })[0]!
    // Строк столько же, сколько вариантов группы, и текущая помечена.
    // «aktuelle Auswahl» стоит и на плитке, и в строке сравнения — один
    // и тот же факт в двух представлениях, поэтому ищем внутри таблицы.
    expect(within(table).getAllByText('aktuelle Auswahl').length).toBe(1)
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(2)

    // «Где мы окажемся» = текущий итог плюс последствие: второго способа
    // посчитать не существует, поэтому число обязано совпасть.
    // Первый вариант первой группы, отличный от текущего: имена вариантов
    // приходят из каталога и меняться не обязаны — тест не привязывается
    // к конкретному слову.
    const radios = within(table.closest('section')!)
      .getAllByRole('radio') as HTMLInputElement[]
    await user.click(radios.find((r) => !r.checked)!)
    const after = useStore.getState().projection().result.total.exact
    expect(after.equals(before)).toBe(false)
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
    const modus = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(modus).getAllByRole('radio')[1]!)
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    await user.click(nav(/^S5|Export/))
    expect(screen.queryByText(/Marge Eigenleistung/)).not.toBeInTheDocument()
  })

  it('гейт готовности называет пункты вместо кольца и процентов (DC-26)', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Гейт живёт в карточке Opportunity, а не в списке проектов.
    await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    const gate = screen.getByRole('group', { name: /Bereitschaft/ })
    expect(within(gate).getByText(/von 2 Voraussetzungen erfüllt/)).toBeInTheDocument()
    expect(within(gate).getAllByText('Strittige Angaben')).not.toHaveLength(0)
    expect(within(gate).getByText('Projektparameter bestätigen')).toBeInTheDocument()
    expect(gate.querySelector('svg, .a3-ring')).toBeNull()
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
    // Label format aligned with `setKg300`'s established SHARED-fan-out
    // convention after Tech Review P0 (ticket d21f8d48): target value +
    // `appliesTo`, not a single "from → to" pair — a SHARED-mode change can
    // apply to more than one building, which may not share one prior value.
    expect(within(box).getByText(/Energiestandard.*EH 40/)).toBeInTheDocument()
    // Открытое покрытие KG 500 попадает в «что осталось» из того же
    // множества, которое делает итог промежуточным.
    expect(within(box).getByText(/KG.500 — Deckungsentscheidung offen/)).toBeInTheDocument()
  })


  it('печать — свой профиль со СВОЕЙ проверкой, не наследует гейт письма (DC-42, PRINT-001)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterOption(user)
    const blockedExport = nav(/Export/)
    expect(blockedExport).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText(/mindestens ein Gebäude auswählen/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    await user.click(nav(/Export/))
    await user.click(screen.getByRole('button', { name: /Druckansicht öffnen/ }))

    const dialog = screen.getByRole('dialog', { name: /Drucken/ })
    // Проверка печати — своя: на бумаге нет поповера, поэтому сноска
    // округления и охват обязаны стоять на самой странице.
    expect(within(dialog).getByText(/Rundungshinweise stehen auf derselben Seite/))
      .toBeInTheDocument()
    expect(within(dialog).getByText(/Umfang auf jeder Seite/)).toBeInTheDocument()
    // Der eigene Druckpfad übernimmt nicht stillschweigend den E-Mail-
    // Preflight: die offene Deckungsentscheidung bleibt sein eigener Blocker.
    const start = within(dialog).getByRole('button', { name: /Druckauftrag starten/ })
    expect(start).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).getByText(/Alle Deckungsentscheidungen getroffen/))
      .toHaveTextContent(/^! /)
    expect(within(dialog).getByText(/Klassifikation bestätigt/))
      .toHaveTextContent(/^✓ /)
    // Внутренний экспорт остаётся доступным: он маркирован и не клиентский.
    expect(within(dialog).getByRole('button', { name: /Internen Muster-Export/ }))
      .not.toHaveAttribute('aria-disabled')
  })

  it('предупреждение у клиента свёрнуто в точку, у продавца развёрнуто (DC-7, правило 11)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Leistungsabgrenzung/))

    // Внутри: список причин, с которым можно работать.
    expect(screen.getByText(/Deckungsentscheidung noch offen/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hinweis' })).toBeNull()

    // У клиента: та же правда, свёрнутая в нейтральную точку.
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(screen.queryByText(/Deckungsentscheidung noch offen/)).toBeNull()
    const dot = screen.getAllByRole('button', { name: 'Hinweis' })[0]!
    expect(dot).toHaveAttribute('aria-expanded', 'false')
    await user.click(dot)
    // Клиентская формулировка упрощает детали, но не меняет правду.
    expect(screen.getByText(/noch nicht entschieden/)).toBeInTheDocument()
  })

  it('клиентская поверхность не цитирует реестр требований (MODE-001, дефект 13)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // Вход в презентацию гейтуется подтверждением здания.
    const modes = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(modes).getAllByRole('radio')[1]!)
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    expect(useStore.getState().mode).toBe('praesentation')

    // Коды реестра — доказательная база подготовки, не язык переговоров.
    // Перечень префиксов явный: `OPT-01` (имя Option пользователя) и
    // `KG 300`/`DIN 276` кодами реестра не являются и остаются.
    const REGISTRY = /\b(?:CALC|XSC|VARIANT|MODE|OUT|GATE|LOCALE|EMAIL|SECURITY|DEMO|DC|RM|CORE|SCHED|DATA|OPTION|DRIVER|ANALYSIS|PROGRESS|STATE|LAYOUT|TOKEN|COLOR|TYPE|BORDER|MOTION|KEY|TABS|SOURCE|COMPLEX|METRIC|CHANGE|VERSION|SCOPE|PRINT|NOTE|ARCH|A11Y)-\d{2,3}\b|\bR-\d{2}\b|\bD-\d{2}\b/

    await user.click(nav(/Gebäude & Umfang/))
    expect((document.body.textContent ?? '').match(REGISTRY)?.[0] ?? null).toBeNull()
    await user.click(nav(/Konfigurator/))
    for (const chapter of [/Leistungen KG 300/, /Leistungsabgrenzung/,
                           /Baugrund & Erschließung/, /Termine & Kommerzielles/]) {
      await user.click(nav(chapter))
      const text = document.body.textContent ?? ''
      const hit = text.match(REGISTRY)
      expect(hit?.[0] ?? null, `Kapitel ${chapter}: код реестра на клиентской поверхности`).toBeNull()
    }
  })

  it('клиентский профиль исключает внутреннюю навигацию, действия и идентификаторы из DOM', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Проверяем переход с внутренней главы: клиентский маршрут обязан
    // нормализоваться до разрешённой главы без промежуточной утечки.
    await user.click(nav(/Baunebenkosten KG 700/))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(screen.getByText('Kundenansicht — der Kunde sieht diesen Bildschirm'))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beenden' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Einstellungen/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Grundlagen/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Baunebenkosten KG 700/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rundgang durch das Werkzeug' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kundenansicht prüfen' })).toBeNull()
    expect(screen.queryByText(/Journal|Marge|interne Notiz/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)
    expect(document.querySelector('[data-driver-id]')).toBeNull()

    await user.click(nav(/Gebäude & Umfang/))
    expect(screen.queryAllByRole('button', {
      name: /Frage an den Kunden|Zur Opportunity-Karte/,
    })).toHaveLength(0)
    await user.click(nav(/Konfigurator/))
    const clientChapters = [
      /Leistungen KG 300/,
      /Leistungsabgrenzung/,
      /Technik KG 400/,
      /Energie & Zertifikate/,
      /Flächen im Detail/,
      /Baugrund & Erschließung/,
      /Termine & Kommerzielles/,
    ]
    for (const chapter of clientChapters) {
      await user.click(nav(chapter))
      expect(screen.queryAllByRole('button', {
        name: /Frage an den Kunden|Zur Opportunity-Karte/,
      }), `Interne Navigation in ${chapter}`).toHaveLength(0)
      expect(screen.getByRole('button', { name: 'Beenden' })).toBeInTheDocument()
      expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)
    }

    await user.click(nav(/Variantenvergleich/))
    expect(screen.queryByRole('button', { name: 'Zur Opportunity-Karte' })).toBeNull()
    expect(document.body).not.toHaveTextContent(/(?:D-19|VARIANT-001|XSC-08|HOAI und AHO|70\/22\/8)/)
    expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)

    await user.click(nav(/^4Export/))
    expect(document.body).not.toHaveTextContent(/(?:clientPrint|clientSafe|R-07|EMAIL-007)/)
    expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)

    await user.click(screen.getByRole('button', { name: 'Beenden' }))
    expect(useStore.getState().mode).toBe('intern')
    expect(screen.getByRole('button', { name: 'Kundenansicht prüfen' })).toBeInTheDocument()
  })

  it('leaves the client projection before any workspace-level transition', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(useStore.getState().mode).toBe('praesentation')
    expect(useStore.getState().level).toBe('option')

    act(() => useStore.getState().openOpportunity(useStore.getState().opportunityId!))

    expect(useStore.getState().mode).toBe('intern')
    expect(useStore.getState().level).toBe('opportunity')
    expect(screen.queryByText('Kundenansicht — der Kunde sieht diesen Bildschirm')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Beenden' })).toBeNull()
  })
})
