import { beforeEach, describe, expect, it } from 'vitest'
import {
  act, fireEvent, render, screen, within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections, confirmWholeConfiguration } from '../../test/offer-option'
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
  await confirmBuildingReviewSections(user)
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
  await user.click(screen.getByRole('radio', { name: /Je Gebäude konfigurieren/ }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
  act(() => {
    useStore.getState().setCoverage('KG_300', 'included')
    useStore.getState().setCoverage('KG_400', 'included')
    useStore.getState().setCoverage('KG_700', 'included')
    // These explicit fixture decisions belong to setup, not to the transient
    // UI state that the scenario under test is about.
    useStore.getState().clearDelta()
    useStore.getState().previewOption(null)
    useStore.getState().dismissUndoToast()
  })
  await user.click(nav(/Leistungsabgrenzung/))
  await user.click(nav(/Leistungen KG 300/))
}

describe('Сквозной сценарий продажи', () => {
  it('доходит от очереди до отправки, не теряя состояние между экранами', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Конфигуратор: смена энергостандарта — первое событие журнала.
    // "Rebuild Project Card Workflow" Part 14: Energiestandard is edited
    // directly on Leistungsabgrenzung now, not a separate chapter.
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungsabgrenzung/))
    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)
    // Путь до конвейера сам оставляет след: решённый конфликт,
    // подтверждённые параметры, созданный Option и подтверждённое здание.
    // KG 300/400/700 are mandatory now ("Rebuild Project Card Workflow"
    // #16) — the three `setCoverage` calls in `enterPipeline` above are
    // guarded no-ops and no longer add journal entries (3 fewer than
    // before).
    expect(useStore.getState().journal).toHaveLength(9)

    // Уход на другой экран и возврат: состояние переживает переход.
    await user.click(nav(/Variantenvergleich/))
    await user.click(nav(/Konfigurator/))
    expect(useStore.getState().journal).toHaveLength(9)
    expect(activeBuilding(useStore.getState()).energiestandard).toBe('EH_40')

    // Гейт открывается на top-level шаге здания, а не обходится.
    expect(activeBuilding(useStore.getState()).gebaeudeklasse.confirmed).toBe(true)

    // Сравнение и отправка достижимы; журнал накопил оба события.
    await user.click(nav(/Variantenvergleich/))
    // Task 03 (F-16/PD-3): Export now requires the whole-option confirm
    // CTA — this test's subject is state continuity across screens, not
    // that gate itself.
    confirmWholeConfiguration()
    await user.click(nav(/^S5|Export/))
    // REDESIGN R3 (877f2c2a): "Preflight" was renamed to the outcome-language
    // "prüfen"/"Prüfung" across S5Export.tsx — same stage-advance CTA.
    expect(screen.getByRole('button', { name: 'Angebot prüfen' })).toBeInTheDocument()
    // +2 over the earlier assertions: Scope Boundaries confirmation and the
    // one building's configuration confirmation, both journal events.
    expect(useStore.getState().journal).toHaveLength(11)
  })

  it('глава 9 показывает Bauzeit обеими формами: полосой и таблицей', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Termine/))

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

  it('Baubeginn hat einen barrierefreien Namen und verschiebt Gantt UND Angebots-Hero auf DASSELBE Datum (Tech Review P1/P2)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Termine/))

    // P1 (Barrierefreiheit): `<label htmlFor>` muss auf das ECHTE Feld
    // zeigen, nicht auf eine Wrapper-`<span>` — genau das war der Fehler.
    const startDate = screen.getByLabelText('Baubeginn') as HTMLInputElement
    expect(startDate).toHaveAttribute('type', 'date')
    // Der Hilfetext muss vom Feld selbst referenziert werden, nicht von
    // einer Hülle — `aria-describedby` ist nur korrekt gesetzt, wenn
    // `cloneElement` das Feld direkt getroffen hat.
    expect(startDate).toHaveAccessibleDescription(
      /Verschiebt die Termine unten; die Bauzeit selbst bleibt gleich/,
    )

    // 2027-03-01 ist genau der im Tech Review durchgerechnete Fall: 56 Tage
    // nach dem Fixture-Anker (`project.planning` beginnt am 2027-01-04),
    // und bricht die Ganzmonat-Eigenschaft der Planung (D-17).
    fireEvent.change(startDate, { target: { value: '2027-03-01' } })

    const table = screen.getByRole('table', { name: /Bauzeit nach Phasen/ })
    // P1 (Terminkonsistenz): Gantt-Tabelle UND Angebots-Hero zeigen dieselbe
    // verschobene Fertigstellung — vorher wich der Hero (fixer Literal) ab.
    expect(within(table).getByText('14.01.2028')).toBeInTheDocument()
    expect(screen.queryByText('19.11.2027')).not.toBeInTheDocument()
    expect(screen.getByText(/Fertigstellung 14\.01\.2028/)).toBeInTheDocument()

    // P2 (D-17): vorher stand hier UNABHÄNGIG vom Anker immer der Literal
    // "3 Monate" — eine ganze Zahl, die einen exakten Kalendermonat-Ganzzahl-
    // Ursprung behauptet. Nach dem Sprung ist 01.03. → 30.05. KEIN ganzer
    // Kalendermonat mehr (Tag-des-Monats weicht ab: `wholeCalendarMonths`
    // liefert null), also muss `presentDuration` in den Rundungs-Zweig
    // wechseln — erkennbar an der Dezimalstelle ("3,0" statt "3"), exakt wie
    // bei der bereits bestehenden Ausführungs-Dauer.
    expect(within(table).getByText('3,0 Monate')).toBeInTheDocument()
    expect(within(table).queryByText('3 Monate')).not.toBeInTheDocument()

    // Zurücksetzen stellt beide Ansichten wieder auf den Fixture-Wert —
    // kein Restzustand aus dem verschobenen Anker.
    fireEvent.change(startDate, { target: { value: '' } })
    expect(within(table).getByText('19.11.2027')).toBeInTheDocument()
    expect(screen.getByText(/Fertigstellung 19\.11\.2027/)).toBeInTheDocument()
  })

  it('keeps ground risk in KG 300 and relocates KG 200 status into Scope Boundaries', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    // Тикет KG300/400/700 + Construction Period, пункт 9: Ground
    // Conditions & Access переехал в KG 300 из «Baugrund & Erschließung» —
    // тот же самый уже согласованный accept/ignore-механизм, другое место.
    await user.click(nav(/Leistungen KG 300/))
    act(() => useStore.getState().setUiLanguage('en'))
    // "Rebuild Project Card Workflow" Part 16: "Areas in detail" is
    // removed; the recap's cross-reference now names its actual current
    // owner, Building & Scope (the same link every other building-level
    // fact in this product already uses).
    expect(screen.getByRole('button', {
      name: 'Review in Building & scope',
    })).toBeInTheDocument()
    act(() => useStore.getState().setUiLanguage('de'))
    // Риск — категория · вероятность · следствие, и он НЕ в цене (CALC-001).
    expect(screen.getByText('Baugrundgutachten liegt nicht vor')).toBeInTheDocument()
    // Надбавка — реальные деньги (D-02) с НАЗВАННОЙ базой: подгруппа
    // KG 320, а не «примерно от KG 300». Решение PO 07.08 о третьем
    // уровне KG сделало сумму вычислимой.
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

    // The content-free legacy Ground chapter is retired. Its authoritative
    // KG-200 status remains next to the decision that owns it.
    expect(screen.queryByRole('button', { name: /Baugrund & Erschließung/ })).toBeNull()
    await user.click(nav(/Leistungsabgrenzung/))
    const status = screen.getByTestId('kg-200-servicing-status')
    // Binary contract (CPO decision, 22.08.2026): KG 200 starts `excluded`
    // by default — there is no "noch offen" state to observe any more.
    expect(status).toHaveTextContent('Erschließung · KG 200 im Angebot: nicht enthalten')
    act(() => useStore.getState().setCoverage('KG_200', 'included'))
    expect(status).toHaveTextContent('Erschließung · KG 200 im Angebot: enthalten')
    act(() => useStore.getState().setCoverage('KG_200', 'excluded'))
    expect(status).toHaveTextContent('Erschließung · KG 200 im Angebot: nicht enthalten')
    act(() => useStore.getState().setUiLanguage('en'))
    expect(status).toHaveTextContent('Site servicing · KG 200 in the offer: excluded')
  })

  // Task 04 (F-11, rule 32): the audit found an EXCLUSION's negative
  // adjustment ("KG 300 … ausgeschlossen ≈ −4.437.000 €") listed under the
  // "Im Angebot gewählt" (chosen) heading — reads as a charge for
  // something explicitly removed. It must now render under its own
  // "Ausgeschlossen" heading instead.
  // "Rebuild Project Card Workflow" #16 makes KG 300 mandatory — it can no
  // longer be excluded, so this F-11 regression case (excluding a core
  // group must list its adjustment under "Ausgeschlossen", not "Im Angebot
  // gewählt") is no longer reachable through the UI for KG 300 specifically.
  // The general "Ausgeschlossen" heading mechanism itself is a presentation
  // concern of `OfferPanel.tsx`, not something this ticket's mandatory-lock
  // change touches, and remains covered by that component's own tests for
  // the KGs that are still genuinely excludable (200/500/600).

  // Task 04 (F-11 companion, rule 36): audit example "2,00 Gebäude ×
  // 20.000 €/Gebäude" — a discrete count must print as a whole number.
  // `kg200-03` (Öffentliche Erschließung) is quantified by `building_count`
  // (derived automatically from the included buildings, no manual input
  // needed), default variant 20.000 €/Gebäude — the exact audited example.
  it('a KG 200 driver quantified by building count prints a whole number, not "2,00 Gebäude" (F-11)', () => {
    act(() => { useStore.getState().setCoverage('KG_200', 'included') })
    const driver = useStore.getState().projection().result.drivers
      .find((d) => d.key === 'scope_kg200-03_03')
    expect(driver).toBeDefined()
    expect(driver!.label).toMatch(/\d+\s*Geb.ude/)
    expect(driver!.label).not.toMatch(/\d,\d\d\s*Geb.ude/)
  })

  it('Projekt-Vorbereitung zitiert keine Requirement-IDs mehr (F05, UI-Audit 2026-08-21)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', {
      name: /Musterprojekt Nordfeld öffnen/,
    }))

    // Strittige Angaben · offener Konflikt — die frühere "· Vorbereitung"-
    // Kopie dieses Konflikts zitierte "DEMO-VE-0002" und "(SOURCE-001)" als
    // Requirement-/Fixture-IDs neben dem eigentlichen Satz. Task 01 löscht
    // diese Kopie zusammen mit der ganzen separaten Vorbereitung-Oberfläche
    // (AC3): das verbleibende Original war stets sauber.
    expect(document.body.textContent ?? '').not.toMatch(/DEMO-VE-\d|SOURCE-\d{2,3}/)

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    // Strittige Angaben · gelöster Konflikt — dieselbe Requirement-ID stand
    // ein zweites Mal in der "gelöst"-Meldung der gelöschten Kopie.
    expect(document.body.textContent ?? '').not.toMatch(/SOURCE-\d{2,3}/)

    // PD-1 (ticket-supplied default): P5 "Varianten" is hidden behind the
    // consolidation, not deleted — no tab, no entry point, and consequently
    // no VARIANT- citation reachable at all.
    expect(screen.queryByRole('tab', { name: /Varianten/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Varianten · Haus/)).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/VARIANT-\d{2,3}/)
  })

  // The former "переводит параметризованную ссылку допущения на актуальную
  // главу" test exercised the KG 500 coverage assumption item's "go to
  // configurator chapter" link — that item is retired (CPO decision,
  // 22.08.2026: no KG 200-800 coverage decision is ever left `unknown`, so
  // the assumption it described can no longer occur). No remaining
  // assumption item takes the parametrized-chapter-link branch; the only
  // active one (Gebäudeklasse) always has its own direct `resolve` action.

  it('дельта-чип и призрак ВИДИМЫ: состояние несёт .a3-show, не кадр анимации', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungsabgrenzung/))

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
    confirmWholeConfiguration()
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
    confirmWholeConfiguration()
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
    // Task 01 removes the duplicated "Bereitschaft für Optionen" checklist
    // group in favor of the one progress model (AC2): DC-26's actual
    // requirement — name what's missing, never a ring/percentage — is now
    // carried by the stage overview together with the create-option gate's
    // own named reason (rule 12), not a second, separate checklist.
    expect(screen.queryByRole('group', { name: /Bereitschaft/ })).not.toBeInTheDocument()
    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })
    expect(within(overview).getAllByText('Strittige Angaben')).not.toHaveLength(0)
    expect(within(overview).getByText('Projektgrundlage')).toBeInTheDocument()
    const create = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    // #16's Projektstatus-Stepper now echoes the same reason text next to
    // the create-button's own explanation — resolved via the button's own
    // `aria-describedby` rather than an ambiguous text match.
    const explanation = document.getElementById(create.getAttribute('aria-describedby')!)!
    expect(explanation).toHaveTextContent('Erst Konflikte entscheiden und Projektparameter bestätigen')
    expect(document.querySelector('svg, .a3-ring')).toBeNull()
  })

  it('Recap после доставки выводится из журнала, а не пишется руками (DC-31)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Изменение, которое обязано попасть в итог встречи.
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungsabgrenzung/))
    const es = await screen.findByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!)
    confirmWholeConfiguration()
    await user.click(nav(/^S5|Export/))
    await user.click(screen.getByRole('button', { name: 'Angebot prüfen' }))
    await user.click(screen.getByRole('button', { name: /Prüfung bestanden/ }))
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
    // Binary contract (CPO decision, 22.08.2026): KG 200/500/600/800 start
    // determinate `excluded` — no KG coverage gap can appear in the recap
    // any more (`coverageUnknown` is unreachable), for any group.
    for (const kg of ['200', '300', '400', '500', '600', '700', '800']) {
      expect(within(box).queryByText(
        new RegExp(`KG.${kg} — Deckungsentscheidung offen`),
      )).not.toBeInTheDocument()
    }
  })


  it('печать — свой профиль со СВОЕЙ проверкой, не наследует гейт письма (DC-42, PRINT-001)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterOption(user)
    const blockedExport = nav(/Export/)
    expect(blockedExport).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText(/mindestens ein Gebäude auswählen/).length).toBeGreaterThan(0)
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    // Task 03 (F-16/PD-3): Export now requires a chosen mode plus a fully
    // confirmed configuration — this test's actual subject is print's own
    // independent gate, not the email/export gate itself.
    await user.click(screen.getByRole('radio', { name: /Je Gebäude konfigurieren/ }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    confirmWholeConfiguration()
    await user.click(nav(/Export/))
    await user.click(screen.getByRole('button', { name: /Druckansicht öffnen/ }))

    const dialog = screen.getByRole('dialog', { name: /Drucken/ })
    // Проверка печати — своя: на бумаге нет поповера, поэтому сноска
    // округления и охват обязаны стоять на самой странице.
    expect(within(dialog).getByText(/Rundungshinweise stehen auf derselben Seite/))
      .toBeInTheDocument()
    expect(within(dialog).getByText(/Umfang auf jeder Seite/)).toBeInTheDocument()
    // Binary contract (CPO decision, 22.08.2026): with KG 300/400/700
    // included and KG 200/500/600/800 at their determinate `excluded`
    // default, and Gebäudeklasse confirmed via `Gebäude bestätigen` above,
    // the offer is genuinely complete — the print path's own preflight (its
    // own gate, independent of the email preflight) correctly allows it.
    const start = within(dialog).getByRole('button', { name: /Druckauftrag starten/ })
    expect(start).not.toHaveAttribute('aria-disabled')
    expect(within(dialog).getByText(/Alle Deckungsentscheidungen getroffen/))
      .toHaveTextContent(/^✓ /)
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

    // Binary contract (CPO decision, 22.08.2026): with KG 300/400/700
    // included and KG 200/500/600/800 at their determinate `excluded`
    // default, the offer is complete from the start — there is no coverage
    // gap left to collapse into a client-facing notice dot at all. The
    // seller sees the same "fully decided" confirmation the client would.
    expect(screen.queryByText(/Deckungsentscheidung noch offen/)).toBeNull()
    expect(screen.getByText(/Alle Deckungsentscheidungen getroffen/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hinweis' })).toBeNull()

    // У клиента: то же полное состояние — тоже без предупреждения.
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(screen.queryByText(/Deckungsentscheidung noch offen/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hinweis' })).toBeNull()
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
                           /Termine/]) {
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
    // Task 03 (F-16/PD-3): this test reaches Export further down — its own
    // subject is client-profile DOM hygiene, not the confirmation gate.
    confirmWholeConfiguration()

    // Проверяем переход с внутренней главы: клиентский маршрут обязан
    // нормализоваться до разрешённой главы без промежуточной утечки.
    await user.click(nav(/Baunebenkosten KG 700/))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(screen.getByText('Kundenansicht — der Kunde sieht diesen Bildschirm'))
      .toBeInTheDocument()
    // KG 700 is internal-only. Removing the currently viewed step when the
    // output profile changes lands on the next active step and moves focus to
    // its h1 instead of leaving focus in removed content.
    expect(screen.getByRole('heading', { level: 1, name: 'Termine' }))
      .toHaveFocus()
    // Client-visible chapters are now Leistungsabgrenzung/KG 300/KG 400/
    // Termine (4, not 6) — Energie & Zertifikate and Flächen im Detail no
    // longer exist ("Rebuild Project Card Workflow" Parts 15/16); KG 700
    // stays internal-only as before.
    expect(screen.getByText('Kapitel 4 von 4 · Konfigurator')).toBeInTheDocument()
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
      /Termine/,
    ]
    for (const chapter of clientChapters) {
      await user.click(nav(chapter))
      expect(screen.queryAllByRole('button', {
        name: /Frage an den Kunden|Zur Opportunity-Karte/,
      }), `Interne Navigation in ${chapter}`).toHaveLength(0)
      expect(screen.getByRole('button', { name: 'Beenden' })).toBeInTheDocument()
      expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)
    }

    await user.click(screen.getByRole('button', { name: /Varianten vergleichen/ }))
    expect(screen.queryByRole('button', { name: 'Zur Opportunity-Karte' })).toBeNull()
    expect(document.body).not.toHaveTextContent(/(?:D-19|VARIANT-001|XSC-08|HOAI und AHO|70\/22\/8)/)
    expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)

    await user.click(nav(/^Export$/))
    expect(document.body).not.toHaveTextContent(/(?:clientPrint|clientSafe|R-07|EMAIL-007)/)
    expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)

    await user.click(screen.getByRole('button', { name: 'Beenden' }))
    expect(useStore.getState().mode).toBe('intern')
    expect(screen.getByRole('button', { name: 'Kundenansicht prüfen' })).toBeInTheDocument()
  })

  /**
   * QA rework (REDESIGN R3, 877f2c2a): QA independently reproduced a live
   * defect via Playwright CLI against the exact candidate — the Sidebar's
   * "Opportunity Option" `<select>` rendered unconditionally regardless of
   * mode and called `openOption()` on change, so a salesperson could
   * silently overwrite the internally active/preparation Option while
   * literally presenting to a client ("der Kunde sieht diesen Bildschirm"),
   * with no warning and no Undo toast — directly falsifying AC 17/18/19
   * ("client-side Option switching does not mutate the internally active
   * Option"), the exact contract the ticket's own "Wird präsentiert"
   * selector (S4Vergleich.tsx) exists to guarantee. This test proves the
   * fix: the interactive switcher is gone from client DOM; only a static,
   * non-interactive label remains.
   */
  it('the "Opportunity Option" switcher is not interactive inside Kundenansicht (QA rework, 877f2c2a)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    confirmWholeConfiguration()
    expect(useStore.getState().activeOptionId).toBe('OPT-01')

    // Внутри Vorbereitung переключатель — живой <select>.
    expect(screen.getByRole('combobox', { name: 'Opportunity Option' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    expect(useStore.getState().mode).toBe('praesentation')

    // Внутри Kundenansicht переключателя-<select> больше нет вовсе — только
    // информационная подпись с тем же именем Option, не идентификатором
    // (правило клиентского профиля: `OPT-xx` не выводится, см. соседний
    // тест этого файла).
    expect(screen.queryByRole('combobox', { name: 'Opportunity Option' })).toBeNull()
    expect(screen.getByText('Option 1')).toBeInTheDocument()

    // Раньше: выбор в этом контроле молча переключал `activeOptionId` даже
    // в клиентском виде. Контрола для этого больше нет — состояние
    // подготовки не может измениться из клиентского DOM этим путём.
    expect(useStore.getState().activeOptionId).toBe('OPT-01')
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
