import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import {
  confirmBuildingReviewSections, confirmWholeConfiguration, enterOptionWorkspace,
  completeBuildingScope, decideAllKgScope, completeKgConfiguration,
  saveOptionBaseline,
  openPresentStage,
} from '../../test/offer-option'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * VR3-CP-00: Client Mode has no entry boundary any more — the gate dialog's
 * "Kundenansicht starten" lands directly in the PresentationShell, whose one
 * presenter bar (`region "Präsentation"`) is on screen in both the narrative
 * and its honest "not ready" fallback. The gate's close and the shell swap
 * are two renders, hence `findByRole`.
 */
const awaitClientShell = () => screen.findByRole('region', { name: 'Präsentation' })

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
// VR3-01: the retired five-click project preamble is gone, so this
// entry point no longer drives the UI — the underscore keeps every
// existing `await enterOption(user)` call site untouched.
async function enterOption(_user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  enterOptionWorkspace()
}

async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  await enterOption(user)
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  // VR3-03: the six cost groups are stages of the one journey now, and a
  // KG page opens only once every scope decision is explicit.
  decideAllKgScope('included')
  act(() => {
    useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_300_DETAILS)
  })
}

/**
 * VR3-04: the pipeline plus a SAVED Option — the state the client-view gate
 * now requires.
 *
 * `enterPipeline` above reaches the Konfigurator, which used to be all the
 * client-view switch needed (`canBeginConfiguration && configurationComplete`).
 * It is not enough any more: eligibility is a valid saved baseline (audit
 * F-002), so the tests whose subject is the gate DIALOG — its focus trap,
 * its Escape return, the fact that the mode changes from inside it and not
 * past it — have to reach a state in which the gate can legitimately open.
 */
async function enterClientReadyPipeline(user: ReturnType<typeof userEvent.setup>) {
  await enterPipeline(user)
  completeKgConfiguration()
  saveOptionBaseline()
}

describe('Projektstatus-Überblick (Task 01) — roving tabindex (TABS-001/KEY-003 keyboard contract)', () => {
  // Task 01 (deep-coherence audit) dissolves the separate "· Vorbereitung"
  // tab workspace this describe block used to exercise: its six former
  // preparation capabilities now live as stacked sections on the Project
  // Card, reachable through the one progress model above them (AC2). That
  // overview did not previously carry roving tabindex/arrow-key movement at
  // all (a known, deliberately-deferred DS-GOV-EX-07 gap) — Task 01 closes
  // it for this instance, so the TABS-001/KEY-003 keyboard contract this
  // block protected now applies here instead.
  // The project's ONE progress model is the canonical journey navigation.
  // It is now `WorkflowNavigator` (nav «Projektablauf», six grouped
  // stages) instead of the thirteen-row spine; the contract this block
  // protects — roving tabindex, arrow movement, Home/End, and NO
  // activation on arrow — is unchanged and moved with it. An Option is
  // created first because only then are several project stations
  // navigable (`onSelect`) at once: a navigator with a single interactive
  // stage could not prove movement between them at all.
  //
  // The queries below are scoped to the TOP-LEVEL stage buttons: the
  // current stage also discloses its own members, and those are ordinary
  // buttons outside the roving cycle.
  async function openOverview(_user: ReturnType<typeof userEvent.setup>) {
    render(<App />)
    enterOptionWorkspace()
    act(() => { useStore.getState().backToOpportunity() })
    return screen.getByRole('navigation', { name: 'Projektablauf' })
  }

  function stageButtons(overview: HTMLElement): HTMLButtonElement[] {
    return [...overview.querySelectorAll<HTMLButtonElement>('.a3-wfn-button')]
  }

  it('стрелка двигает фокус, но НЕ открывает раздел — открытие только по клику/Enter/Space (STEP-003)', async () => {
    const user = userEvent.setup()
    const overview = await openOverview(user)
    const steps = stageButtons(overview)
    expect(steps.length).toBeGreaterThan(1)
    // Leaving the Option workspace lands on the collection — the Option's
    // home — not on a stage named after the act of creating one.
    expect(useStore.getState().projectStage).toBe('options')

    steps[0]!.focus()
    await user.keyboard('{ArrowRight}')

    // Фокус ушёл на следующую стадию…
    expect(document.activeElement).toBe(steps[1])
    // …а сама стадия ещё НЕ открыта: автоактивация стрелкой меняла бы
    // экран при каждом нажатии.
    expect(useStore.getState().projectStage).toBe('options')

    await user.keyboard('{Enter}')
    // Enter открывает — и открывает ИМЕННО ту стадию, на которой фокус.
    expect(useStore.getState().projectStage).toBe('understanding')
    expect(screen.getByRole('heading', {
      // The ready stage's H1 states the OUTCOME (clean-pass audit PU-03); the
      // former string claimed a resolution history this project never had.
      name: 'Bereit, eine Option anzulegen',
    })).toBeInTheDocument()
  })

  it('roving tabindex: ровно одна кнопка обзора в цикле Tab', async () => {
    const user = userEvent.setup()
    const overview = await openOverview(user)
    const steps = stageButtons(overview)
    const inCycle = steps.filter((s) => s.getAttribute('tabindex') === '0')
    expect(inCycle).toHaveLength(1)
  })

  it('Home и End уводят фокус на края списка', async () => {
    const user = userEvent.setup()
    const overview = await openOverview(user)
    const steps = stageButtons(overview)

    steps[0]!.focus()
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(steps[steps.length - 1])
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(steps[0])
  })
})

describe('Herkunft-Popover — Esc закрывает и ВОЗВРАЩАЕТ фокус (KEY-002)', () => {
  // Task 04 (F-35, rail a11y): the rail's three hero triggers no longer
  // share the exact accessible name "Herkunft anzeigen" — each carries its
  // own metric suffix so a screen-reader buttons list can tell them apart.
  // `/^Herkunft anzeigen/` still grabs the first one (the total's), unaffected.
  it('открытие, закрытие по Esc, фокус на триггере', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    const trigger = screen.getAllByRole('button', { name: /^Herkunft anzeigen/ })[0]!

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
    await user.click(screen.getAllByRole('button', { name: /^Herkunft anzeigen/ })[0]!)
    const dialog = screen.getByRole('dialog', { name: 'Herkunft des Werts' })

    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})

describe('Account menu — controlled dismissal', () => {
  it('closes on Escape and outside click, returning focus after Escape', async () => {
    const user = userEvent.setup()
    render(<App />)
    // The trigger names the signed-in person and the action it performs;
    // the popover is that person's menu.
    const trigger = screen.getByRole('button', { name: 'Daniel Weber, Kontomenü öffnen' })

    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Daniel Weber' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Daniel Weber' })).toBeNull()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(document.body)
    expect(screen.queryByRole('dialog', { name: 'Daniel Weber' })).toBeNull()
  })

  it('states the demo-account reason exactly once and points the blocked action at it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Daniel Weber, Kontomenü öffnen' }))
    const popover = screen.getByRole('dialog', { name: 'Daniel Weber' })

    const reason = 'Demo-Konto: dieser Prototyp führt keine verifizierte Sitzungsidentität, '
      + 'deshalb ist Abmelden ohne Wirkung und bleibt gesperrt.'
    // ONE sentence, not the same message printed as body and again as the
    // button's own disabled reason.
    expect(within(popover).getAllByText(reason)).toHaveLength(1)

    const signOut = within(popover).getByRole('button', { name: 'Abmelden' })
    expect(signOut).toHaveAttribute('aria-disabled', 'true')
    // The reason is ANNOUNCED with the action, without being repeated.
    const describedBy = signOut.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)!).toHaveTextContent(reason)
    // Identity hierarchy: name, then role.
    expect(within(popover).getByText('Projektleiter')).toBeInTheDocument()
  })
})

describe('Опции — нативная radio-группа (RADIO-001)', () => {
  it('стрелка в группе опций двигает И выбирает, событие попадает в журнал', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    // Навигация настоящая, через интерфейс: дёргать store мимо React
    // значило бы проверять не тот путь, которым ходит пользователь.
    // VR3-03: Energiestandard is a CONFIGURED VARIANT of a KG 400 service
    // now — the same decision, in the cost group whose services deliver it,
    // rendered by the canonical `ChoiceGroup`. The contract under test is
    // unchanged and is exactly what that control has to satisfy: a native
    // radio group where an arrow both MOVES and SELECTS (RADIO-001), and
    // where selecting by keyboard journals the same event as selecting by
    // pointer (M-4).
    act(() => {
      useStore.getState().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_400_DETAILS)
    })

    // VR3-TGA-01: the same decision, under the name the Rahmen band gives it
    // (`Energieziel` — split from the statutory minimum, which is derived and
    // never a choice), and reached the way a user reaches it: the band's own
    // `ändern`. Progressive disclosure is the change; RADIO-001 is not.
    await user.click(await screen.findByRole('button', { name: 'ändern' }))
    const group = await screen.findByRole('radiogroup', { name: /Energieziel/ })
    const radios = within(group).getAllByRole('radio')
    const checkedBefore = radios.findIndex((r) => (r as HTMLInputElement).checked)

    const journalBefore = useStore.getState().journal.length
    radios[checkedBefore]!.focus()
    await user.keyboard('{ArrowDown}')

    const checkedAfter = within(group).getAllByRole('radio')
      .findIndex((r) => (r as HTMLInputElement).checked)
    expect(checkedAfter).not.toBe(checkedBefore)
    // VR3-TGA-UX-00: the arrow MOVES and SELECTS the draft (RADIO-001 holds);
    // the WRITE is the explicit `Übernehmen` — the same one commit for the
    // keyboard as for the pointer, and the same one journal event (M-4).
    expect(useStore.getState().journal.length).toBe(journalBefore)
    const editor = group.closest('.a3-dec-editor')!
    await user.click(within(editor as HTMLElement).getByRole('button', { name: 'Übernehmen' }))
    expect(useStore.getState().journal.length).toBe(journalBefore + 1)
  })
})

describe('Гейт режима презентации — блокировка объясняет причину (правило 12)', () => {
  it('сегмент недоступен и несёт видимую причину, а не только погашен', async () => {
    await enterOption(userEvent.setup())
    // The mode switch is the `Präsentieren` stage's own control now. The
    // stage stays REACHABLE while it is locked, precisely so the blocked
    // segment can carry its reason instead of the rail simply refusing.
    openPresentStage()
    const group = screen.getByRole('radiogroup', { name: 'Ansicht' })
    const praesentation = within(group).getAllByRole('radio')[1] as HTMLInputElement
    expect(praesentation.disabled).toBe(true)
    // Причина именно видима, а не спрятана в title.
    expect(screen.getAllByText(/mindestens ein Gebäude auswählen/).length).toBeGreaterThan(0)
  })

  /**
   * VR3-04: the precondition is now a SAVED Option, not a confirmed
   * building — the gate moved (audit F-002) and this test's subject is the
   * route through the gate, not the gate's own predicate. The predicate is
   * proved in `src/state/__tests__/store.test.ts` and in
   * `src/screens/__tests__/final-validation.dom.test.tsx`.
   */
  it('nach dem Speichern der Option funktioniert der Wechsel', async () => {
    const user = userEvent.setup()
    await enterClientReadyPipeline(user)

    openPresentStage()
    const group = screen.getByRole('radiogroup', { name: 'Ansicht' })
    const praesentation = within(group).getAllByRole('radio')[1] as HTMLInputElement
    expect(praesentation.disabled).toBe(false)
    // Путь в клиентский вид — через ворота DC-33: переключатель их
    // открывает, режим меняет кнопка диалога (приёмка волны C).
    await user.click(praesentation)
    expect(useStore.getState().mode).toBe('intern')
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    await awaitClientShell()
    expect(useStore.getState().mode).toBe('praesentation')
    expect(useStore.getState().gateOpen).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Bereit für die Präsentation/ })).toBeNull())
    // VR3-CP-00: the shell lands on chapter 1 "Angebot", never on whatever
    // chapter was last open internally — its H1 is the project's own name
    // (and the honest "not ready" fallback's H1 is the same project name),
    // and that heading is the mode-entry focus target. Scoped to the stage
    // (`<main>`): the printed sheet (`.a3-client-print-doc`, CSS
    // `display:none` on screen) carries an H1 of the same name, and jsdom
    // applies no stylesheet.
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Wohnhof Lindenhain' }))
      .toHaveFocus()
  })
})

describe('Маршрут экрана возвращает начало документа', () => {
  it('сбрасывает прокрутку и фокусирует новый H1 при каждой смене экрана', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    const main = screen.getByRole('main')
    main.scrollTop = 420

    /**
     * Comparison is a PROJECT destination since the 2026-09-06 IA rebuild —
     * it is about the COLLECTION, so it is reached from the collection. The
     * subject of this case is unchanged (scroll and focus return to the top
     * of a new document on every route change); only the route changed.
     */
    act(() => { useStore.getState().openOptionsStage() })
    const main2 = screen.getByRole('main')
    main2.scrollTop = 420
    act(() => { useStore.getState().createOption() })
    const comparisonEntries = screen.getAllByRole('button', { name: 'Variantenvergleich' })
    expect(comparisonEntries).toHaveLength(1)
    await user.click(comparisonEntries[0]!)
    expect(main2.scrollTop).toBe(0)
    // ACCEPTANCE REMEDIATION (cycle 2, ACCEPT-01): the H1 on this route is
    // now the approved target's decision headline (comparison.headline),
    // not the generic screen name — this assertion's subject remains
    // scroll/focus reset on navigation, unaffected by the wording change.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Entscheiden, nicht nur vergleichen.' }),
    ).toHaveFocus()

    // Back into the Option workspace for the Export route below.
    act(() => {
      const st = useStore.getState()
      st.openOption(st.options[0]!.id)
    })
    const main3 = screen.getByRole('main')
    main3.scrollTop = 320
    // Task 03 (F-16/PD-3): Export now requires the whole-option confirm
    // CTA — this test's subject is scroll/focus reset on navigation, not
    // that gate itself.
    // VR3-03: Export additionally requires the KG configuration to be
    // complete, so the preamble's six scope decisions are joined by every
    // explicit service decision.
    completeKgConfiguration()
    confirmWholeConfiguration()
    openPresentStage()
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(main3.scrollTop).toBe(0)
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
    // диалог: блокировка объясняет себя (правило 12). Ворота живут на
    // стадии «Präsentieren», и стадия достижима именно в запертом
    // состоянии — иначе причина была бы недостижима вместе с ними.
    openPresentStage()
    expect(screen.getAllByText(/mindestens ein Gebäude auswählen/).length).toBeGreaterThan(0)
    await confirmBuildingReviewSections(user)
    completeBuildingScope('PER_BUILDING')
    openPresentStage()
    // VR3-04: a saved scope opens the KONFIGURATOR, not the client view.
    // The gate's own reason changes accordingly, and the dialog still does
    // not open — which is the "blocking explains itself" rule holding at
    // the next prerequisite rather than stopping at the first.
    expect(screen.getAllByText(/Die Kundenansicht braucht eine gespeicherte Option/).length)
      .toBeGreaterThan(0)
    completeKgConfiguration()
    saveOptionBaseline()
    // The gate lives on the `Präsentieren` stage: one rail, one place, and
    // the stage the action belongs to.
    openPresentStage()
    const trigger = screen.getByRole('button', { name: 'Kundenansicht prüfen' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: /Bereit für die Präsentation/ })
    expect(dialog.contains(document.activeElement)).toBe(true)
    // Показано ИМЕННО то, что перестанет быть видимым. VR3-CP-00 оставил
    // одну формулировку со ссылкой на профиль выдачи: перечень ярлыков
    // («Marge, Δ-Werte, KG-700-Modus…») был вторым списком рядом с
    // нормативным определением (output-model §6.5) и снят как заготовка
    // для расхождения.
    expect(within(dialog).getByText(/in der Kundenansicht ausgeblendet/))
      .toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(useStore.getState().mode).toBe('intern')
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('переход в клиентский вид происходит из диалога, а не мимо него', async () => {
    const user = userEvent.setup()
    await enterClientReadyPipeline(user)
    openPresentStage()
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    await awaitClientShell()
    expect(useStore.getState().mode).toBe('praesentation')
  })
})

describe('Preparation navigation cleanup', () => {
  it('does not expose the retired guided tour or its modal', async () => {
    const user = userEvent.setup()
    await enterPipeline(user)
    expect(screen.queryByRole('button', { name: /Rundgang durch das Werkzeug/ }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Der Preis ist immer sichtbar/ }))
      .not.toBeInTheDocument()
  })

  it('в презентации тура не существует — ни кнопки, ни карточки', async () => {
    const user = userEvent.setup()
    await enterClientReadyPipeline(user)
    openPresentStage()
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))
    await awaitClientShell()

    expect(screen.queryByRole('button', { name: /Rundgang/ })).toBeNull()
    act(() => useStore.getState().setTourOpen(true))
    expect(screen.queryByRole('dialog', { name: /Der Preis/ })).toBeNull()
  })
})
