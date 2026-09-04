import { beforeEach, describe, expect, it } from 'vitest'
import {
  act, render, screen, within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  confirmBuildingReviewSections,
  confirmWholeConfiguration,
  enterOptionWorkspace,
  enterProjectUnderstanding,
  completeBuildingScope,
  completeKgConfiguration,
  saveOptionBaseline,
  startClientPresentation,
} from '../../test/offer-option'
import { activeBuilding, __resetStoreForTests, useStore } from '../../state/store'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import { openProjectCard } from '../../test/portfolio'

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
// VR3-01: the retired five-click project preamble is gone, so this
// entry point no longer drives the UI — the underscore keeps every
// existing `await enterOption(user)` call site untouched.
async function enterOption(_user: ReturnType<typeof userEvent.setup>) {
  enterOptionWorkspace()
}

async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  await enterOption(user)
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  // VR3-03: the six explicit scope decisions ARE the way into the
  // configuration now — `setCoverage` no longer writes the Option's scope.
  // These suites' subject is downstream of the configuration (comparison,
  // export, delivery, client projection), so they start from the FIXTURE
  // BASELINE: six groups in scope and every explicit service decision
  // recorded, which is the state in which the Option is genuinely complete.
  completeKgConfiguration()
  // VR3-04: Client Mode is no longer unlocked by a complete configuration —
  // it needs a valid SAVED baseline (audit F-002). These suites' subject is
  // downstream of the meeting, so the schedule confirmation, the twelve
  // review sections and the save are DRIVEN here rather than faked: a helper
  // that wrote the saved version directly would let a broken gate keep
  // passing, which is the failure mode this ticket removes.
  saveOptionBaseline()
  act(() => {
    // These explicit fixture decisions belong to setup, not to the transient
    // UI state that the scenario under test is about.
    useStore.getState().clearDelta()
    useStore.getState().previewOption(null)
    useStore.getState().dismissUndoToast()
    useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_300_DETAILS)
  })
}

describe('Сквозной сценарий продажи', () => {
  it('доходит от очереди до отправки, не теряя состояние между экранами', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // VR3-03: the Energiestandard is a configured variant of a KG 400
    // service — the same decision, in the cost group whose services deliver
    // it. Choosing it still writes the released building axis (one energy
    // standard, one Option), which is what the comparison screen reads
    // further down this very test.
    act(() => {
      useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_400_DETAILS)
    })
    const es = await screen.findByRole('radiogroup', { name: /Energiestandard/ })
    await user.click(within(es).getAllByRole('radio')[2]!)
    // Путь до конвейера сам оставляет след: решённый конфликт,
    // подтверждённые параметры, созданный Option и подтверждённое здание.
    // KG 300/400/700 are mandatory now ("Rebuild Project Card Workflow"
    // #16) — the three `setCoverage` calls in `enterPipeline` above are
    // guarded no-ops and no longer add journal entries (3 fewer than
    // before).
    //
    // VR3-02 replaced one of them: the Option's building baseline is now
    // confirmed and SAVED as two events, and saving carries the Option's
    // pricing projection (the proposal record the engine reads) with it —
    // the inherited WFL resolution and that record's own confirmation.
    //
    // VR3-03 adds thirteen: SIX explicit scope decisions, SIX explicit
    // service decisions (the fixture baseline's non-selections) and one
    // scope confirmation, all recorded by `completeKgConfiguration` above,
    // plus the energy standard chosen here. Every one of them is a real
    // decision with a price consequence and an inverse — data cannot change
    // without an event (M-4), and the count is asserted exactly so a hidden
    // write would fail here rather than pass unnoticed.
    // VR3-04 adds FIFTEEN: the schedule confirmation, twelve review-section
    // acknowledgements, the final validation confirmation and the save.
    // Every one of them is a decision somebody took — a review nobody could
    // prove had happened is exactly the thing this stage exists to replace —
    // and the count is asserted exactly so a hidden write fails here rather
    // than passing unnoticed.
    expect(useStore.getState().journal).toHaveLength(36)

    // Уход на другой экран и возврат: состояние переживает переход.
    await user.click(nav(/Variantenvergleich/))
    expect(useStore.getState().journal).toHaveLength(36)
    expect(activeBuilding(useStore.getState()).energiestandard).toBe('EH_40')

    // Гейт открывается на top-level шаге здания, а не обходится.
    expect(activeBuilding(useStore.getState()).gebaeudeklasse.confirmed).toBe(true)

    // Сравнение и отправка достижимы; журнал накопил оба события.
    // VR3-03: the comparison screen replaces the shell (App.tsx renders no
    // Sidebar there), so the way onward is its OWN navigation — clicking a
    // rail item that is not on screen was only ever reaching the first
    // match of a regex, not a real route.
    await user.click(nav(/^Konfigurator$/))
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
    expect(useStore.getState().journal).toHaveLength(38)
  })

  /**
   * VR3-04 replaced this test's SUBJECT and kept its principle.
   *
   * It used to assert the retired `ChapterTermine`: a read-only fixture
   * Gantt with the caption "Bauzeit nach Phasen …", the legacy proposal
   * building "Haus A" and the model duration "≈ 7,5 Monate ab OKBP". That
   * chapter is gone, replaced by the `ScheduleStage` — a stage with a phase
   * model, dependencies, validation and a confirmation of its own.
   *
   * GANTT-003's principle survives untouched and is what this checks: the
   * bar ILLUSTRATES, the table CARRIES. Every value the timeline draws is
   * read from the table, and the values come from the demonstration
   * project's own schedule rather than from the markup.
   */
  it('der Terminplan zeigt beide Formen: Balken und Tabelle (GANTT-003)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    act(() => {
      useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)
    })

    const table = await screen.findByRole('table', { name: /Terminplan nach Phasen/ })
    // Every phase of the clean fixture, named, with the building its
    // execution belongs to in its own column.
    expect(within(table).getByText('Planung')).toBeInTheDocument()
    expect(within(table).getByText('Vergabe und Baustelleneinrichtung')).toBeInTheDocument()
    expect(within(table).getByText('Ausführung Lindenhof')).toBeInTheDocument()
    expect(within(table).getByText('Übergabe')).toBeInTheDocument()
    expect(within(table).getByText('Lindenhof')).toBeInTheDocument()
    expect(within(table).getAllByText('Gesamtprojekt')).toHaveLength(3)

    // Dates come from the fixture's own schedule, on the half-month lattice
    // the engine owns: 15.03.2027 + 33 half months is exactly 31.07.2028,
    // which is the completion the fixture specification states.
    expect(within(table).getByText('15.03.2027')).toBeInTheDocument()
    // 15.07.2027 appears twice by construction — the end of planning and the
    // start of tendering are one date, and that is right rather than a
    // duplicate.
    expect(within(table).getAllByText('15.07.2027')).toHaveLength(2)
    expect(within(table).getByText('31.07.2028')).toBeInTheDocument()
    // Matchers normalise whitespace: U+202F in the DOM compares as a plain
    // space — the U+202F norm itself is held by verify, not by this test.
    expect(within(table).getByText('10 Monate')).toBeInTheDocument()
    expect(within(table).getByText('1 Monat')).toBeInTheDocument()
    // The dependency is a column of the table, not a tooltip on the bar.
    expect(within(table).getByText('nach Ausführung Lindenhof')).toBeInTheDocument()
  })

  /* VR3-03 removed this case with its subject. It asserted the KG 300
     chapter's own ground-risk section and the KG 200 servicing status line
     inside Leistungsabgrenzung — two page-local compositions of the six
     retired chapter grammars ("Retire local chapter selectors/cards"). The
     risk model itself is untouched in `engine/risk.ts` and is covered by
     `src/engine/__tests__`; what is gone is the local surface, deliberately. */
  it('a KG 200 driver quantified by building count prints a whole number, not "2,00 Gebäude" (F-11)', () => {
    act(() => { useStore.getState().setCoverage('KG_200', 'included') })
    const driver = useStore.getState().projection().result.drivers
      .find((d) => d.key === 'scope_kg200-03_03')
    expect(driver).toBeDefined()
    expect(driver!.label).toMatch(/\d+\s*Geb.ude/)
    expect(driver!.label).not.toMatch(/\d,\d\d\s*Geb.ude/)
  })

  /* VR3-03 removed this case with its subject: `VariantsSideBySide` was a
     KG 300/400-local comparison table inside the retired `OptionChapter`.
     A configured variant's consequence is now stated on the row and in the
     rail's causal change block, both of which are covered by
     `kg-configuration.dom.test.tsx` and `preview-lifecycle.dom.test.tsx`. */
  it('интервал точности показан деньгами, а не только процентом (DC-3)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // VR3-03: the demonstration band is DECLARED by the fixture (± 5 % for
    // this project), not narrowed by a confirmation rule — an indicative
    // offer's uncertainty is a Product statement about the evidence, and
    // this ticket must not invent a narrowing. 6.480.000 € ± 5 % is
    // therefore 6.156.000 € to 6.804.000 €, and the band shows both in
    // money because that is what gets asked in a negotiation.
    expect(screen.getByText(/6\.156\.000/)).toBeInTheDocument()
    expect(screen.getByText(/6\.804\.000/)).toBeInTheDocument()
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
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)
    // REDESIGN R3 WAVE 2a (ce17da51): Kundenansicht is now ONE continuous
    // PresentationShell document, not a per-chapter router — every
    // narrative section (incl. §3 Ergebnis, the only place a commercial
    // total renders) is already in the DOM at once. No "Export" nav item
    // exists to click through any more; a single body-wide check already
    // covers the entire client surface.
    expect(screen.queryByText(/Marge Eigenleistung/)).not.toBeInTheDocument()
  })

  it('гейт готовности называет пункты вместо кольца и процентов (DC-26)', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Гейт живёт на уровне проекта, а не в списке проектов.
    await openProjectCard(user, 'Quartier Am Güterbogen')
    // Ein GESCHLOSSENES Gate braucht einen echten offenen Grund: Analyse
    // abgeschlossen, aber die sechs blockierenden strittigen Angaben noch
    // nicht entschieden.
    enterProjectUnderstanding('DEMO-COMPLEX-01', { conflicts: 'open' })

    // Task 01 removes the duplicated "Bereitschaft für Optionen" checklist
    // group in favor of the one progress model (AC2): DC-26's actual
    // requirement — name what's missing, never a ring/percentage — is now
    // carried by the workflow spine together with the create-option gate's
    // own named reason (rule 12), not a second, separate checklist.
    expect(screen.queryByRole('group', { name: /Bereitschaft/ })).not.toBeInTheDocument()
    // VR3-01: der eine Verlauf heißt jetzt „Projekt- und Optionsverlauf"
    // und nennt die Stationen; die Bereitschaftszeilen nennen die Sache.
    const spine = screen.getByRole('navigation', { name: 'Projekt- und Optionsverlauf' })
    expect(within(spine).getByText('Projektverständnis')).toBeInTheDocument()
    expect(within(spine).getByText('Option anlegen')).toBeInTheDocument()
    expect(screen.getAllByText('Blockierende strittige Angaben').length).toBeGreaterThan(0)

    const create = screen.getByRole('button', { name: 'Option anlegen' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    // Die Ursache hängt am Knopf selbst (`aria-describedby`), nicht an
    // einem beliebigen Textfund auf der Seite.
    const explanation = document.getElementById(create.getAttribute('aria-describedby')!)!
    expect(explanation).toHaveTextContent(
      'Gesperrt: 6 blockierende strittige Angaben entscheiden',
    )
    // Und das Gate NENNT die offenen Punkte statt sie zu zählen: die
    // unerfüllte Voraussetzung steht mit ihrem Rückstand da.
    const gate = create.closest('.a3-gate')!
    expect(gate).toHaveTextContent('Keine blockierenden strittigen Angaben')
    expect(gate).toHaveTextContent('Noch offen: 6')
    // Kein Ring, kein erfundener Prozentsatz (DC-26, Regel 25). Der frühere
    // `svg`-Selektor war ein Stellvertreter für „Ring": der kanonische
    // `Button` rendert heute ein echtes Spinner-`<svg>` für seinen
    // Ladezustand, deshalb prüft dies den Ring beim Namen — plus die
    // Prozentangabe, die DC-26 eigentlich verbietet.
    expect(document.querySelector('.a3-ring')).toBeNull()
    expect(gate.textContent ?? '').not.toMatch(/\d+\s*%/)
  })

  it('Recap после доставки выводится из журнала, а не пишется руками (DC-31)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    // Изменение, которое обязано попасть в итог встречи.
    act(() => {
      useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_400_DETAILS)
    })
    const es = await screen.findByRole('radiogroup', { name: /Energiestandard/ })
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
    // VR3-03: the recap is derived from the JOURNAL, and the journal now
    // records the decision the user actually made — a KG 400 configured
    // variant named in the user's language ("Energiestandard ·
    // Effizienzhaus 40"), not the engine's `EH_40` enum. The recap being
    // derived rather than hand-written is the subject; the label following
    // the decision's own copy is the improvement.
    expect(within(box).getByText(/Energiestandard.*Effizienzhaus 40/))
      .toBeInTheDocument()
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
    // VR3-02: before the Konfigurator opens, the rail carries the thirteen-
    // step journey and not the four-item workspace list, so Export is not a
    // navigation item yet — it is a locked STAGE, and the stage after
    // Gebäude & Umfang states the prerequisite by name.
    expect(screen.getAllByText(/Gebäudeumfang noch nicht gespeichert/).length)
      .toBeGreaterThan(0)
    await confirmBuildingReviewSections(user)
    // Task 03 (F-16/PD-3): Export now requires a chosen mode plus a fully
    // confirmed configuration — this test's actual subject is print's own
    // independent gate, not the email/export gate itself.
    completeBuildingScope('PER_BUILDING')
    const blockedExport = nav(/Export/)
    expect(blockedExport).toHaveAttribute('aria-disabled', 'true')
    // VR3-03: Export additionally requires the KG configuration to be
    // complete. Under the retired predicate an Option with six UNDECIDED
    // cost groups was exportable, because "undecided" could not exist and
    // the scope fingerprint only had to match itself.
    completeKgConfiguration()
    confirmWholeConfiguration()
    await user.click(nav(/Export/))
    await user.click(screen.getByRole('button', { name: /Druckansicht öffnen/ }))

    const dialog = screen.getByRole('dialog', { name: /Drucken/ })
    // Проверка печати — своя: на бумаге нет поповера, поэтому сноска
    // округления и охват обязаны стоять на самой странице.
    expect(within(dialog).getByText(/Rundungshinweise stehen auf derselben Seite/))
      .toBeInTheDocument()
    expect(within(dialog).getByText(/Umfang auf jeder Seite/)).toBeInTheDocument()
    // VR3-03: the offer is complete because the FIXTURE BASELINE is on
    // record — six explicit scope decisions and every explicit service
    // decision (`completeKgConfiguration` in the preamble) — not because
    // three cost groups were included by default. The print path's own
    // preflight (its own gate, independent of the email preflight) reads
    // that same completeness and correctly allows it.
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
    // VR3-03: "every cost group is decided" is stated by the ledger's own
    // completion summary and its footer — the surface that owns the
    // decisions — and the commercial consequence is stated once, in the
    // rail. The retired chapter printed a third copy of the same fact in a
    // "Folge für die Angebotssumme" section of its own.
    expect(screen.queryByText(/Deckungsentscheidung noch offen/)).toBeNull()
    expect(screen.getAllByText(/6 von 6 entschieden/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Jede Kostengruppe hat ein bewusstes Ergebnis/))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hinweis' })).toBeNull()

    // У клиента: то же полное состояние — тоже без предупреждения.
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)

    expect(screen.queryByText(/Deckungsentscheidung noch offen/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hinweis' })).toBeNull()
  })

  it('клиентская поверхность не цитирует реестр требований (MODE-001, дефект 13)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    confirmWholeConfiguration()
    // Вход в презентацию гейтуется подтверждением здания.
    const modes = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(modes).getAllByRole('radio')[1]!)
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)
    expect(useStore.getState().mode).toBe('praesentation')

    // Коды реестра — доказательная база подготовки, не язык переговоров.
    // Перечень префиксов явный: `OPT-01` (имя Option пользователя) и
    // `KG 300`/`DIN 276` кодами реестра не являются и остаются.
    const REGISTRY = /\b(?:CALC|XSC|VARIANT|MODE|OUT|GATE|LOCALE|EMAIL|SECURITY|DEMO|DC|RM|CORE|SCHED|DATA|OPTION|DRIVER|ANALYSIS|PROGRESS|STATE|LAYOUT|TOKEN|COLOR|TYPE|BORDER|MOTION|KEY|TABS|SOURCE|COMPLEX|METRIC|CHANGE|VERSION|SCOPE|PRINT|NOTE|ARCH|A11Y)-\d{2,3}\b|\bR-\d{2}\b|\bD-\d{2}\b/

    // REDESIGN R3 WAVE 2a (ce17da51): the whole narrative — §1 Projekt
    // through §6 Angebot — renders in ONE PresentationShell document at
    // once (no per-chapter router to click through any more), so one
    // whole-body check already covers every narrative section.
    expect((document.body.textContent ?? '').match(REGISTRY)?.[0] ?? null).toBeNull()
  })

  it('клиентский профиль исключает внутреннюю навигацию, действия и идентификаторы из DOM', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // Task 03 (F-16/PD-3) / REDESIGN R3 WAVE 2a: the Option must be
    // client-eligible (PD-3 readiness) BEFORE entering Kundenansicht, or
    // PresentationShell renders its own honest "noch keine Option bereit"
    // state instead of the narrative — this test's subject is client-
    // profile DOM hygiene of the real narrative, not that fallback.
    act(() => {
      useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_700_DETAILS)
    })
    confirmWholeConfiguration()
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)

    // REDESIGN R3 WAVE 2a (ce17da51): Kundenansicht is now ONE continuous
    // PresentationShell document — no per-chapter router, no Sidebar, no
    // OfferPanel rail, no "Kapitel X von Y" step counter (explicitly
    // forbidden by the shell's own contract: the narrative strip is story
    // navigation, never a workflow stepper). §1 Projekt is always the
    // shell's opening section, so its H1 (the project's own name, not a
    // leftover internal chapter title) is the mode-entry focus target.
    expect(screen.getByText(/Kundenansicht — der Kunde sieht diesen Bildschirm/))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Wohnhof Lindenhain' }))
      .toHaveFocus()
    expect(screen.queryByText(/Kapitel \d+ von \d+/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Beenden' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Einstellungen/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Grundlagen/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Baunebenkosten KG 700/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rundgang durch das Werkzeug' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kundenansicht prüfen' })).toBeNull()
    expect(screen.queryByText(/Journal|Marge|interne Notiz/i)).toBeNull()
    // The whole narrative (incl. §2 Umfang's building rows and §5
    // Optionen, when it exists) is already in the DOM at once — a single
    // whole-body pass already covers what used to need one nav click per
    // chapter.
    expect(screen.queryAllByRole('button', {
      name: /Frage an den Kunden|Zur Opportunity-Karte/,
    })).toHaveLength(0)
    expect(document.body).not.toHaveTextContent(
      /(?:D-19|VARIANT-001|XSC-08|HOAI und AHO|70\/22\/8|clientPrint|clientSafe|R-07|EMAIL-007)/,
    )
    expect(document.body.textContent).not.toMatch(/\b(?:DEMO|OPT|SNAP|BM)-[A-Z0-9-]+\b/)
    expect(document.querySelector('[data-driver-id]')).toBeNull()

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
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)
    expect(useStore.getState().mode).toBe('praesentation')

    // Внутри Kundenansicht переключателя-<select> больше нет вовсе. Имя
    // презентуемой Option по-прежнему названо — VR3-05 перенёс его в
    // индикатор режима (цель T-034/T-035: `KUNDENPRÄSENTATION · <Option>`),
    // чтобы одно и то же имя не стояло на экране дважды. Идентификатор
    // `OPT-xx` не выводится по-прежнему — соседний тест этого файла.
    expect(screen.queryByRole('combobox', { name: 'Opportunity Option' })).toBeNull()
    expect(screen.getByText(/Kundenansicht — der Kunde sieht diesen Bildschirm · Option 1/))
      .toBeInTheDocument()

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
    // VR3-05 (T-034): Client Mode opens on its boundary screen; the
    // narrative these suites are about begins one deliberate click later.
    await startClientPresentation(user)

    expect(useStore.getState().mode).toBe('praesentation')
    expect(useStore.getState().level).toBe('option')

    act(() => useStore.getState().openOpportunity(useStore.getState().opportunityId!))

    expect(useStore.getState().mode).toBe('intern')
    expect(useStore.getState().level).toBe('opportunity')
    expect(screen.queryByText('Kundenansicht — der Kunde sieht diesen Bildschirm')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Beenden' })).toBeNull()
  })
})
