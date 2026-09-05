import { beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  confirmBuildingReviewSections,
  enterOptionWorkspace,
  enterProjectUnderstanding,
  settleOptionCommit,
  completeBuildingScope,
  completeKgConfiguration,
  saveOptionBaseline,
} from '../../test/offer-option'
import { __resetStoreForTests, useStore } from '../../state/store'
import { ProjectOptionsSection } from '../ProjectOptions'
import { demoProject } from '../../state/projectAnalysis'
import { LIFECYCLE_STATUSES, decodePortfolioQuery } from '../../state/projectPortfolio'
import {
  PORTFOLIO_CARD_COUNT, PORTFOLIO_DISPLAY_ONLY_COUNT, PORTFOLIO_NAVIGABLE_COUNT,
  PORTFOLIO_TITLE, openProjectCard,
} from '../../test/portfolio'

/**
 * Корень продукта: список проектов, поиск, сортировка, фильтр, и гейт
 * создания Options на уровне проекта.
 *
 * VR3-01 заменил слой проекта целиком. Список больше не отдаёт восемь
 * неравноценных строк из `opportunities.json`, а РОВНО ДВА полных
 * демонстрационных проекта из `vr3-demo-projects.json` — это инвариант
 * фикстуры, а не оформление. Вместе с прежними строками ушли и данные, по
 * которым фильтровали: CRM-стадия жизненного цикла, «Termin», «Owner»,
 * страна. Контрол, который фильтрует по исчезнувшему полю, хуже отсутствия
 * контрола, поэтому эти проверки удалены вместе со своим предметом, а не
 * ослаблены (перечень — в отчёте задачи).
 *
 * Что проверяется здесь и не проверяется больше нигде: до Option цены нет,
 * а до решённых блокирующих расхождений нет Option.
 */
beforeEach(() => {
  __resetStoreForTests()
  // The register now keeps its query in the URL, and jsdom shares one
  // `window.location` across a file: without this, the first test that
  // filters leaves every later test rendering a pre-filtered portfolio.
  window.history.replaceState(null, '', '/')
})

/**
 * Every card's primary CTA, in display order — the only reliable way to
 * read the register's ORDER without binding to a class name. The accessible
 * name carries the card's canonical title, so this also proves the title
 * format on every card at once.
 */
const CARD_CTA = /^Projekt konfigurieren · /
const cardOrder = () => screen
  .getAllByRole('button', { name: CARD_CTA })
  .map((b) => b.getAttribute('aria-label')!.replace('Projekt konfigurieren · ', ''))

const TITLES = {
  lindenhain: PORTFOLIO_TITLE['Wohnhof Lindenhain']!,
  guterbogen: PORTFOLIO_TITLE['Quartier Am Güterbogen']!,
  hamburg: PORTFOLIO_TITLE['Hafenbogen']!,
  wien: PORTFOLIO_TITLE['Donauquartier']!,
  muenchen: PORTFOLIO_TITLE['Feldmark']!,
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Filter/ }))
}

/** The card element for a title, whichever column the text sits in. */
const cardOf = (title: string) => screen.getByText(title).closest('li')!

describe('Уровень Projekte', () => {
  it('корень показывает пять карточек: два маршрута и три витринных проекта, без панели цены', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Projekte' })).toBeInTheDocument()
    // Цена принадлежит Option, а Option ещё не выбран.
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(PORTFOLIO_CARD_COUNT)
    // Ровно два проекта навигабельны — ровно три являются витриной.
    expect(screen.getAllByRole('button', { name: CARD_CTA })
      .filter((b) => b.getAttribute('aria-disabled') !== 'true'))
      .toHaveLength(PORTFOLIO_NAVIGABLE_COUNT)
    expect(screen.getAllByText('Demonstration · kein Workflow'))
      .toHaveLength(PORTFOLIO_DISPLAY_ONLY_COUNT)
    expect(screen.getByText('Demonstrationsportfolio · 5 Projekte')).toBeInTheDocument()
    expect(screen.queryByText(/Wurzel/)).not.toBeInTheDocument()
    expect(screen.queryByText(/sortiert/)).not.toBeInTheDocument()
  })

  it('каждая карточка называет личность, стороны, срок, масштаб, стоимость и оба действия', () => {
    render(<App />)
    const clean = cardOf(TITLES.lindenhain)

    // 1 — жизненный цикл словом, не только цветом (правило 8).
    expect(within(clean).getByText('Bereit zur Präsentation')).toBeInTheDocument()
    // 2 — канонический титул в точном формате.
    expect(within(clean).getByText(TITLES.lindenhain)).toBeInTheDocument()
    // 3 — клиент и ответственный полным именем.
    expect(within(clean).getByText('Lindenhain Wohnen GmbH')).toBeInTheDocument()
    expect(within(clean).getByText(/Verantwortlich: Daniel Weber/)).toBeInTheDocument()
    // 4 — срок: у этого проекта термина нет, и строка это ГОВОРИТ.
    expect(within(clean).getByText('Nächster Kundentermin')).toBeInTheDocument()
    expect(within(clean).getByText('Kein Kundentermin geplant')).toBeInTheDocument()
    // 5 — масштаб и стоимость.
    expect(within(clean).getByText('Gebäude')).toBeInTheDocument()
    expect(within(clean).getByText('BGF gesamt')).toBeInTheDocument()
    expect(within(clean).getByText('WFL nach WoFlV')).toBeInTheDocument()
    expect(within(clean).getByText('Wohneinheiten')).toBeInTheDocument()
    expect(within(clean).getByText('Gesamtwert')).toBeInTheDocument()
    // 6 — даты создания и изменения.
    expect(within(clean).getByText('Erstellt')).toBeInTheDocument()
    expect(within(clean).getByText('Zuletzt geändert')).toBeInTheDocument()
    // 7 — два действия, ровно по одному разу.
    expect(within(clean).getAllByRole('button', {
      name: `Projekt konfigurieren · ${TITLES.lindenhain}`,
    })).toHaveLength(1)
    expect(within(clean).getByRole('button', {
      name: `Kundenansicht öffnen · ${TITLES.lindenhain}`,
    })).toBeInTheDocument()
  })

  it('карточка портфеля не показывает ни числа документов, ни состояния анализа', () => {
    render(<App />)
    expect(screen.queryByText(/Dokumente/)).not.toBeInTheDocument()
    expect(screen.queryByText('Dokumentation')).not.toBeInTheDocument()
    expect(screen.queryByText('Dokumentanalyse')).not.toBeInTheDocument()
    expect(screen.queryByText('Nicht gestartet')).not.toBeInTheDocument()
  })

  it('жилой проект показывает WFL, проект с коммерцией — NUF, и никогда обе сразу', () => {
    render(<App />)
    const clean = cardOf(TITLES.lindenhain)
    expect(within(clean).getByText('WFL nach WoFlV')).toBeInTheDocument()
    expect(within(clean).queryByText('NUF nach DIN 277')).toBeNull()

    const complex = cardOf(TITLES.guterbogen)
    expect(within(complex).getByText('NUF nach DIN 277')).toBeInTheDocument()
    expect(within(complex).queryByText('WFL nach WoFlV')).toBeNull()
  })

  it('стоимость приходит только из сохранённого снимка Option, иначе — «не определена», но никогда 0', () => {
    render(<App />)
    // Свежее состояние: ни одной сохранённой Option, значит цены нет.
    const clean = cardOf(TITLES.lindenhain)
    expect(within(clean).getByText('Preis nicht ermittelt')).toBeInTheDocument()
    // «Нет цены» никогда не рендерится нулём (правило 16).
    expect(clean.textContent).not.toMatch(/(^|\s)0(,00)?\s*€/)
    // Витринная запись несёт собственную, явно помеченную величину.
    const hamburg = cardOf(TITLES.hamburg)
    expect(within(hamburg).getByText(/51\.240\.000/)).toBeInTheDocument()
    expect(within(hamburg).getByText(/Demonstrationswert · Stand/)).toBeInTheDocument()
  })

  it('неполный агрегат называется словами, а не частичной суммой', () => {
    render(<App />)
    const complex = cardOf(TITLES.guterbogen)
    // NUF известен у одного здания из трёх.
    expect(within(complex).getByText('Nicht vollständig erfasst · 1 von 3')).toBeInTheDocument()
    // BGF известен у всех трёх — точная сумма.
    expect(within(complex).getByText('19.470 m²')).toBeInTheDocument()
  })

  it('срок имеет три состояния: просрочен, близок и отсутствует', () => {
    render(<App />)
    // Просрочен: слово, а не только цвет.
    expect(within(cardOf(TITLES.guterbogen)).getByText('Überfällig')).toBeInTheDocument()
    // Близок: обычная подсказка на человеческом языке.
    expect(within(cardOf(TITLES.hamburg)).getByText(/^in \d+ Tagen$/)).toBeInTheDocument()
    // Отсутствует: строка остаётся и говорит это.
    expect(within(cardOf(TITLES.lindenhain)).getByText('Kein Kundentermin geplant'))
      .toBeInTheDocument()
    // Дата машиночитаема.
    const meeting = within(cardOf(TITLES.hamburg))
      .getByText('Nächster Kundentermin')
      .parentElement!.querySelector('time')
    expect(meeting).toHaveAttribute('datetime', '2026-09-11T09:30:00+02:00')
  })

  it('витринная запись не ведёт никуда: ни титул, ни изображение, ни клавиатура, ни кнопки', async () => {
    const user = userEvent.setup()
    render(<App />)
    const hamburg = cardOf(TITLES.hamburg)
    // Титул не является контролом.
    expect(within(hamburg).queryByRole('button', { name: TITLES.hamburg })).toBeNull()
    // Оба действия заблокированы нативно и объяснены ОДИН раз.
    for (const action of ['Projekt konfigurieren', 'Kundenansicht öffnen']) {
      const button = within(hamburg).getByRole('button', {
        name: `${action} · ${TITLES.hamburg}`,
      })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      await user.click(button)
    }
    expect(within(hamburg).getAllByText('Demonstration · kein Workflow'))
      .toHaveLength(1)
    // Ни один клик не увёл со списка.
    expect(useStore.getState().level).toBe('liste')
    // И программный путь тоже закрыт: слой рабочего процесса о такой
    // записи не знает вовсе.
    act(() => useStore.getState().openOpportunity('PORTFOLIO-HH-01'))
    expect(demoProject('PORTFOLIO-HH-01')).toBeNull()
  })

  it('панель фильтров закрыта по умолчанию и содержит страну, город, ответственного и статусы', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('button', { name: /^Filter/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Поиск и сортировка живут В панели инструментов, не за раскрытием:
    // это два самых частых действия, и прятать их означало бы стоить
    // клика при каждом заходе.
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByLabelText('Sortierung')).toBeInTheDocument()
    expect(screen.queryByLabelText('Land')).toBeNull()

    await openFilters(user)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    for (const label of ['Land', 'Stadt', 'Verantwortlich']) {
      const control = screen.getByLabelText(label)
      expect(control).toHaveAttribute('role', 'combobox')
      expect(control).toHaveAttribute('aria-expanded', 'false')
    }
    // Все семь канонических статусов, как настоящие чекбоксы в fieldset.
    const statuses = within(screen.getByRole('group', { name: 'Projektstatus' }))
      .getAllByRole('checkbox')
    expect(statuses).toHaveLength(LIFECYCLE_STATUSES.length)
  })

  it('четыре хронологические сортировки дают детерминированный порядок', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sort = screen.getByLabelText('Sortierung') as HTMLSelectElement
    // По умолчанию — последнее изменение, новейшее первым.
    expect(sort.value).toBe('updatedDesc')
    expect(cardOrder()).toEqual([
      TITLES.lindenhain, TITLES.hamburg, TITLES.wien, TITLES.muenchen, TITLES.guterbogen,
    ])

    await user.selectOptions(sort, 'updatedAsc')
    expect(cardOrder()).toEqual([
      TITLES.guterbogen, TITLES.muenchen, TITLES.wien, TITLES.hamburg, TITLES.lindenhain,
    ])

    await user.selectOptions(sort, 'createdDesc')
    expect(cardOrder()).toEqual([
      TITLES.hamburg, TITLES.lindenhain, TITLES.wien, TITLES.muenchen, TITLES.guterbogen,
    ])

    await user.selectOptions(sort, 'createdAsc')
    expect(cardOrder()).toEqual([
      TITLES.guterbogen, TITLES.muenchen, TITLES.wien, TITLES.lindenhain, TITLES.hamburg,
    ])
  })

  it('поиск находит по титулу, клиенту, ответственному, городу, адресу, индексу и id', async () => {
    const user = userEvent.setup()
    render(<App />)
    const search = screen.getByRole('searchbox')
    const only = async (needle: string, expected: string) => {
      await user.clear(search)
      await user.type(search, needle)
      expect(cardOrder()).toEqual([expected])
    }
    await only('Lindenhain', TITLES.lindenhain)
    await only('Nordraum Projekt', TITLES.hamburg)
    await only('  miriam schneider  ', TITLES.muenchen)
    await only('Wien', TITLES.wien)
    await only('Hafenbogen 18', TITLES.hamburg)
    await only('04109', TITLES.guterbogen)
    await only('DEMO-HAPPY-01', TITLES.lindenhain)
  })

  it('группы фильтров складываются по И, статусы внутри группы — по ИЛИ', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openFilters(user)
    const status = (label: string) => within(
      screen.getByRole('group', { name: 'Projektstatus' }),
    ).getByRole('checkbox', { name: label })

    // ИЛИ внутри группы: два статуса дают объединение.
    await user.click(status('Neu'))
    expect(cardOrder()).toEqual([TITLES.hamburg])
    await user.click(status('In Bearbeitung'))
    expect(cardOrder()).toEqual([TITLES.hamburg, TITLES.wien])

    // И между группами: тот же выбор плюс страна AT оставляет один.
    await user.type(screen.getByLabelText('Land'), 'AT')
    await user.keyboard('{Enter}')
    expect(cardOrder()).toEqual([TITLES.wien])

    // Ни одного выбранного статуса — значит все статусы.
    await user.click(status('Neu'))
    await user.click(status('In Bearbeitung'))
    expect(cardOrder()).toEqual([TITLES.wien])
  })

  it('смена страны безопасно очищает несовместимый город и объявляет это один раз', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openFilters(user)
    const city = screen.getByLabelText('Stadt') as HTMLInputElement
    await user.type(city, 'Wien')
    await user.keyboard('{Enter}')
    expect(city.value).toBe('Wien')
    expect(cardOrder()).toEqual([TITLES.wien])

    await user.type(screen.getByLabelText('Land'), 'DE')
    await user.keyboard('{Enter}')
    // Значение контрола и отфильтрованное множество не расходятся.
    expect((screen.getByLabelText('Stadt') as HTMLInputElement).value).toBe('Alle')
    expect(cardOrder()).toHaveLength(4)
    expect(screen.getByText('Stadt zurückgesetzt: Wien liegt nicht in DE.'))
      .toBeInTheDocument()
  })

  it('активные фильтры видны чипами, снимаются поштучно и сбрасываются целиком', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Без фильтров чипов не существует.
    expect(screen.queryByRole('group', { name: 'Aktive Filter' })).toBeNull()

    await user.type(screen.getByRole('searchbox'), 'Wien')
    const chips = screen.getByRole('group', { name: 'Aktive Filter' })
    expect(within(chips).getByText('Suche: Wien')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Filter \(1\)/ })).toBeInTheDocument()
    // ONE counter, and it carries the page-level demonstration marker:
    // the eyebrow that used to state the same number 268 px away is gone.
    expect(screen.getByText('Demonstrationsportfolio · 1 von 5 Projekten'))
      .toBeInTheDocument()

    await user.click(within(chips).getByRole('button', { name: 'Filter entfernen: Suche: Wien' }))
    expect(screen.queryByRole('group', { name: 'Aktive Filter' })).toBeNull()
    expect(cardOrder()).toHaveLength(PORTFOLIO_CARD_COUNT)

    await user.type(screen.getByRole('searchbox'), 'Wien')
    await user.click(screen.getAllByRole('button', { name: 'Alle Filter zurücksetzen' })[0]!)
    expect(cardOrder()).toHaveLength(PORTFOLIO_CARD_COUNT)
  })

  it('состояние регистра переживает перезагрузку через параметры адреса', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('searchbox'), 'Wien')
    expect(window.location.search).toBe('?q=Wien')

    await user.selectOptions(screen.getByLabelText('Sortierung'), 'createdAsc')
    expect(decodePortfolioQuery(window.location.search)).toMatchObject({
      text: 'Wien', sort: 'createdAsc',
    })

    // Перерисовка из адреса восстанавливает ровно то же множество.
    cleanup()
    render(<App />)
    expect(cardOrder()).toEqual([TITLES.wien])
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Wien')
  })

  it('пустой результат называет причину и предлагает ровно один выход', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('Kein Projekt entspricht den aktiven Filtern.')).toBeInTheDocument()
    expect(screen.getByText(/Die Filter grenzen das Register auf null Projekte ein/))
      .toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    // Отличается от «в аккаунте вообще ничего нет» — тот сброса не предлагает.
    expect(screen.queryByText('Es sind noch keine Opportunities vorhanden.')).toBeNull()
    expect(document.querySelector('.a3-empty-spec button')).not.toBeNull()
  })

  it('Option нельзя создать, пока блокирующие расхождения не решены; свежая Option — без цены', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openProjectCard(user, 'Quartier Am Güterbogen')
    // Анализ прошёл, шесть блокирующих расхождений ещё не решены.
    enterProjectUnderstanding('DEMO-COMPLEX-01', { conflicts: 'open' })

    const create = screen.getByRole('button', { name: 'Option anlegen' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(useStore.getState().canCreateOptions()).toBe(false)

    // Решение расхождений — единственная предпосылка, и она открывается
    // ровно на нуле: до последнего решения гейт закрыт.
    expect(useStore.getState().projectAnalyses['DEMO-COMPLEX-01']!.jobState)
      .toBe('COMPLETE')
    const conflicts = demoProject('DEMO-COMPLEX-01')!.conflicts
    expect(conflicts).toHaveLength(6)
    for (const conflict of conflicts) {
      expect(useStore.getState().canCreateOptions()).toBe(false)
      act(() => {
        useStore.getState().resolveProjectConflict(conflict.id, {
          kind: 'candidate', candidateId: conflict.recommendedCandidateId,
        })
      })
    }
    expect(useStore.getState().canCreateOptions()).toBe(true)

    await user.click(screen.getAllByRole('button', { name: 'Option anlegen' })[0]!)
    settleOptionCommit()
    expect(useStore.getState().options).toHaveLength(1)

    // Option startet im vorgeschalteten Gebäudeschritt — noch ohne Preis.
    // VR3-02: the hand-off's one continuation NAMES the stage it opens
    // ("Gebäude & Umfang festlegen"), and the Option's first surface is
    // that stage. There is no commercial rail before it and no readiness
    // rail either — the completion count lives in the surface's own header,
    // where the decision is.
    await user.click(screen.getByRole('button', { name: 'Gebäude & Umfang festlegen' }))
    expect(screen.getByRole('heading', { name: 'Gebäude & Umfang' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    expect(screen.getByText('0 von 3 bestätigt')).toBeInTheDocument()
  })

  it.each([
    {
      label: 'анализ завершён, расхождения открыты',
      setup: () => enterProjectUnderstanding('DEMO-COMPLEX-01', { conflicts: 'open' }),
      reason: 'Gesperrt: 6 blockierende strittige Angaben entscheiden',
      unmet: 'Keine blockierenden strittigen Angaben',
    },
    {
      label: 'все предпосылки выполнены',
      setup: () => enterProjectUnderstanding('DEMO-HAPPY-01'),
      reason: null,
      unmet: null,
    },
  ])('гейт создания Option называет только актуальные причины: $label', async ({
    setup, reason, unmet,
  }) => {
    const user = userEvent.setup()
    render(<App />)
    setup()

    const create = screen.getAllByRole('button', { name: 'Option anlegen' })[0]!
    if (reason === null) {
      expect(create).not.toHaveAttribute('aria-disabled')
      expect(create).not.toHaveAttribute('aria-describedby')
      return
    }

    // Причина стоит в порядке чтения и связана с кнопкой её ЖЕ
    // `aria-describedby` — не найдена совпадением строки где-то на
    // странице (тот же текст повторяет объяснение самого гейта).
    expect(create).toHaveAttribute('aria-disabled', 'true')
    const explanationId = create.getAttribute('aria-describedby')
    expect(explanationId).toBeTruthy()
    const explanation = document.getElementById(explanationId!)!
    expect(explanation).toHaveTextContent(reason)
    // И невыполненная предпосылка НАЗВАНА, а не только посчитана.
    expect(create.closest('.a3-gate')!).toHaveTextContent(unmet!)

    create.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(create)
    await act(() => new Promise((r) => setTimeout(r, 400)))
    expect(useStore.getState().options).toHaveLength(0)
    expect(create).toHaveFocus()
  })

  it('EN переключает содержимое экранов, не только хром (ревью № 13, дефект 2)', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Переключатель языка — в шапке; словарь = поставка Codex + локальное
    // дополнение для строк, созданных после поставки.
    expect(screen.getByRole('radio', { name: 'EN' })).toBeInTheDocument()
    expect(screen.queryByText(/Entwurf|Draft/)).not.toBeInTheDocument()
    // Содержимое самого списка, а не только хрома: резюме и заголовок.
    expect(screen.getByText('Demonstrationsportfolio · 5 Projekte')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projekte' })).toBeInTheDocument()
    await openFilters(user)
    expect(screen.getByPlaceholderText(
      'Titel, Kunde, Verantwortliche, Stadt, Adresse, PLZ',
    )).toBeInTheDocument()
    expect(screen.getByLabelText('Verantwortlich')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /EN/ }))
    // Немецкая строка поискового лейбла исчезла — заменена переводом.
    expect(screen.queryByText('Projekte durchsuchen')).toBeNull()
    expect(screen.getByPlaceholderText(
      'Title, client, manager, city, address, postcode',
    )).toBeInTheDocument()
    expect(screen.getByText('Demonstration portfolio · 5 projects')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    // Содержимое КАРТОЧКИ, не только панели: статус жизненного цикла,
    // подписи метрик и обе подписи действий переводятся вместе с хромом.
    // Дважды: подпись статуса на карточке и его же чекбокс в панели.
    expect(screen.getAllByText('Ready to pitch')).toHaveLength(2)
    expect(screen.getAllByText('Next client meeting')).toHaveLength(PORTFOLIO_CARD_COUNT)
    expect(screen.getAllByText('Total project value')).toHaveLength(PORTFOLIO_CARD_COUNT)
    expect(screen.getByText('No client meeting scheduled')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getAllByText('Demonstration · no workflow'))
      .toHaveLength(PORTFOLIO_DISPLAY_ONLY_COUNT)
    // Числа и даты типографируются по локали, не по языку записи.
    expect(screen.getByText('2,900 m²')).toBeInTheDocument()
    expect(screen.getByText('51,240,000 €')).toBeInTheDocument()

    // Немецкий остаётся источником: переключение обратно восстанавливает.
    await user.click(screen.getByRole('radio', { name: /^DE$/ }))
    expect(screen.getByPlaceholderText(
      'Titel, Kunde, Verantwortliche, Stadt, Adresse, PLZ',
    )).toBeInTheDocument()
    expect(screen.getAllByText('Bereit zur Präsentation')).toHaveLength(2)
    expect(screen.getByText('2.900 m²')).toBeInTheDocument()
    expect(screen.getByText('51.240.000 €')).toBeInTheDocument()
  })

  it('заметка: тихая запись, чип вместо тоста, в презентации не существует (DC-43, правило 34)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openProjectCard(user, 'Wohnhof Lindenhain')

    // #16 Part 5/AC-07: Internal Note ist keine primäre Workflow-Stufe mehr —
    // der EINZIGE Einstieg ist jetzt der Header-Utility-Button, der den
    // kanonischen `Dialog` öffnet. VR3-01 hat ihn unverändert übernommen
    // (`ProjectIdentityUtilities`), auf JEDER Projekt-Stufe.
    await user.click(screen.getByRole('button', { name: 'Interne Notiz' }))
    const field = screen.getByRole('textbox', { name: /Interne Notiz/ })
    // Нейтральный статус — ЯСНЫЙ ТЕКСТ, не необъяснённая точка (NOTE-007).
    expect(screen.getByText(/noch keine Änderungen/)).toBeInTheDocument()

    await user.type(field, 'Kunde will Klinker')
    // До паузы — черновик: событие ещё не создано, тоста нет вообще.
    expect(screen.getByText(/Entwurf, noch nicht gespeichert/)).toBeInTheDocument()
    expect(useStore.getState().journal.filter((e) => e.kind === 'note.created'))
      .toHaveLength(0)

    // Тихая запись: событие журнала появляется, тост — нет (правило 34).
    await act(() => new Promise((r) => setTimeout(r, 1000)))
    expect(useStore.getState().journal.filter((e) => e.kind === 'note.created'))
      .toHaveLength(1)
    expect(useStore.getState().undoToast).toBeNull()
    // Текст заметки в журнал не попадает: журнал читают на встрече.
    expect(useStore.getState().journal.at(-1)!.label).not.toContain('Klinker')

    // Синк — отдельное событие (правило 34).
    await act(() => new Promise((r) => setTimeout(r, 1400)))
    expect(useStore.getState().journal.filter((e) => e.kind === 'note.synced_to_hubspot'))
      .toHaveLength(1)
    expect(screen.getByText(/synchronisiert · HubSpot/)).toBeInTheDocument()

    // В клиентский профиль входят только из Option через реальный gate.
    // VR3-04: этот gate — сохранённая версия Option, а не подтверждённая
    // конфигурация (аудит F-002), поэтому преамбула проходит весь путь:
    // умфанг, шесть KG, терминплан, финальная проверка, сохранение.
    enterOptionWorkspace()
    await confirmBuildingReviewSections(user)
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    saveOptionBaseline()
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    // In der Kundenansicht existiert die Notiz nicht im DOM — nicht einmal
    // ihr Einstiegspunkt (NOTE-006: nicht versteckt, sondern nicht vorhanden).
    expect(screen.queryByRole('button', { name: 'Interne Notiz' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /Interne Notiz/ })).toBeNull()
    expect(document.body.textContent).not.toContain('HubSpot-Projektkarte')
  })
})

/**
 * AUD-03 — предмет этого блока (тождество Option и непрерывность после
 * создания) VR3-01 не тронул: ушёл только ПУТЬ к нему. Прежняя преамбула
 * из пяти кликов по карточке Opportunity («Kundenwert übernehmen» →
 * «Projektparameter bestätigen» → «Opportunity Option anlegen» →
 * «Öffnen») больше не существует; сам гейт создания живёт на экране
 * проекта, а галерея Options — в `ProjectOptions.tsx`. Ни одна проверка
 * ниже не снята.
 */
describe('AUD-03 — Option identity & creation continuity', () => {
  /**
   * Экран готовности проекта с ОТКРЫТЫМ гейтом создания.
   *
   * `commitProjectBaseline()` вызывается здесь намеренно: первое создание
   * Option само фиксирует базис проекта, и это ВТОРОЕ событие журнала.
   * Тест «один клик — одно событие» измеряет создание, а не фиксацию
   * базиса, поэтому базис фиксируется до замера.
   *
   * Кнопок «Option anlegen» на этом экране ДВЕ (один и тот же
   * `CreateOptionGate` смонтирован и в `ProjectReadiness`, и в обзоре
   * понимания) — дублирование основного действия сообщено отдельно как
   * продуктовый дефект. Берётся первая, читаемая как основная.
   */
  function reachCreateGate() {
    render(<App />)
    enterProjectUnderstanding('DEMO-HAPPY-01')
    act(() => { useStore.getState().commitProjectBaseline() })
    return () => screen.getAllByRole('button', { name: 'Option anlegen' })[0]!
  }

  /**
   * Галерея Options — сам экспортируемый раздел, в том же состоянии, в
   * котором его монтирует `ProjectHome` на стадии «Option angelegt».
   *
   * Раздел рендерится НАПРЯМУЮ, а не через `App`, по одной причине:
   * предмет этих проверок — сама галерея (тождество, переименование,
   * бейджи, отправленный снапшот), а `sendOffer`/`renameOption` работают
   * с АКТИВНОЙ Option. Возврат на уровень проекта через
   * `backToOpportunity()` активную Option обнуляет, то есть менял бы
   * состояние, которое проверяется, а не путь к нему. Компонент —
   * канонический источник, тот же, что рендерит продукт.
   */
  function reachOptionGallery() {
    enterOptionWorkspace()
    render(<ProjectOptionsSection justCreatedOptionId={null} />)
    return screen.getByRole('region', { name: 'Opportunity Options' })
  }

  it('AC-1/AC-2: ein schneller Doppelklick erzeugt genau eine Option, ein Journal-Event', async () => {
    const create = reachCreateGate()
    const journalBefore = useStore.getState().journal.length
    // `fireEvent`, nicht `userEvent`: zwei WIRKLICH unmittelbar
    // aufeinanderfolgende Klick-Events, ohne die kleine reale Verzögerung,
    // die `userEvent.click()` selbst schon einführt — genau der
    // Doppelklick-Fall, den die Guard-Zeit abfangen soll (AC-1). Die Guard
    // liegt jetzt im Create-Option-Gate: der erste Klick setzt
    // `creatingOption`, der `Button` geht in seinen kanonischen
    // Ladezustand und weist jede weitere Aktivierung ab, bis das Anlegen
    // committed ist.
    // Das Element wird EINMAL aufgelöst: im Ladezustand trägt der
    // kanonische `Button` den Prozessnamen als `aria-label`, ein zweites
    // `getByRole('Option anlegen')` würde den Knopf also gar nicht mehr
    // finden — und genau dieser Ladezustand IST die Guard.
    const button = create()
    fireEvent.click(button)
    fireEvent.click(button)
    settleOptionCommit()
    expect(useStore.getState().options).toHaveLength(1)
    expect(useStore.getState().journal.length).toBe(journalBefore + 1)
    expect(useStore.getState().undoToast?.statusText).toContain('Option 1')
  })

  it('AC-1: ein Klick nach Ablauf der Guard-Zeit erzeugt eine ZWEITE, eindeutig benannte Option', async () => {
    const user = userEvent.setup()
    const create = reachCreateGate()
    await user.click(create())
    settleOptionCommit()
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1'])

    // Kein Doppelklick: die Guard ist abgelaufen, das Gate ist über den
    // einen Verlauf (Spine) wieder erreichbar, und der zweite,
    // eigenständige Klick legt eine zweite, eindeutig benannte Option an.
    const journey = screen.getByRole('navigation', { name: 'Projektablauf' })
    await user.click(within(journey).getByText('Verstehen').closest('button')!)
    await user.click(create())
    settleOptionCommit()
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
  })

  it('AC-3: nach dem Anlegen liegt der Fokus auf der NEUEN Zeile, nicht auf der Seitenüberschrift', async () => {
    const user = userEvent.setup()
    const create = reachCreateGate()
    // Regressionswache für den eigentlichen Fund: das Erzeugen einer Option
    // hat früher `App.tsx`'s globalen "neues Dokument"-Effekt fälschlich
    // ausgelöst (scrollTop=0 + Fokus auf das Seiten-`h1`), obwohl der
    // Bildschirm dieselbe Projektebene blieb.
    await user.click(create())
    settleOptionCommit()

    const section = screen.getByRole('region', { name: 'Opportunity Options' })
    const row = within(section).getByText('Option 1').closest('li')!
    expect(row.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.querySelector('[data-page-heading]'))
  })

  it('AC-3: Umbenennen funktioniert in einer Interaktion, inline', async () => {
    const user = userEvent.setup()
    const section = reachOptionGallery()
    await user.click(within(section).getByRole('button', { name: 'Umbenennen' }))
    const field = screen.getByLabelText('Name der Option')
    await user.clear(field)
    await user.type(field, 'Zielangebot{Enter}')
    expect(screen.queryByText('Option 1')).toBeNull()
    expect(within(section).getByText('Zielangebot')).toBeInTheDocument()
    expect(useStore.getState().options[0]!.name).toBe('Zielangebot')
  })

  // QA-Rework (AUD-03): live von QA Lead in Playwright reproduziert — ein
  // Umbenennen auf einen bereits vergebenen Namen wurde vorher still
  // übernommen und gab zwei Zeilen mit demselben Namen. Rule 12 (kein
  // Blockieren ohne Erklärung): die Kollision bleibt im Bearbeitungsmodus
  // mit einer sichtbaren Ursache · Abhilfe-Zeile stehen, statt sie
  // stillschweigend zu verwerfen oder zu übernehmen.
  it('QA-Rework: Umbenennen auf einen bereits vergebenen Namen bleibt erklärt blockiert', async () => {
    const user = userEvent.setup()
    const section = reachOptionGallery()
    // Die zweite Option entsteht hier über die Store-Aktion: der Weg zur
    // zweiten Option ist Gegenstand des Guard-Tests oben, nicht dieses.
    act(() => { useStore.getState().createOption() })
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])

    const rows = within(section).getAllByRole('button', { name: 'Umbenennen' })
    expect(rows).toHaveLength(2)
    await user.click(rows[1]!)
    const field = screen.getByLabelText('Name der Option')
    await user.clear(field)
    await user.type(field, 'Option 1{Enter}')

    // Store bleibt unverändert — keine Kollision durchgekommen.
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
    // Der Bearbeitungsmodus bleibt offen (kein stilles Verwerfen) und
    // erklärt den Grund — nicht nur ein rotes Feld ohne Text (gate 7).
    expect(screen.getByLabelText('Name der Option')).toBeInTheDocument()
    expect(screen.getByText(/wird bereits verwendet/)).toBeInTheDocument()
    expect(screen.getByLabelText('Name der Option')).toHaveAttribute('aria-invalid', 'true')

    // Escape verwirft den Versuch, ohne die bestehenden Namen anzutasten.
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Name der Option')).toBeNull()
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
  })

  it('AC-4: frische Option zeigt Neu/Umfang/Summe aus der Engine, gesendete verliert Umbenennen', async () => {
    const section = reachOptionGallery()
    const row = () => within(section).getByText('Option 1').closest('li')!
    expect(row()).toHaveTextContent('Neu')
    // VR3-03: eine frische Option hat SECHS unentschiedene Kostengruppen,
    // also keine einzige kalkulierte Position — und damit keine Summe. Vorher
    // trug sie eine unvollständige Summe, weil KG 300/400/700 per Default
    // enthalten waren; genau diese stille Vorentscheidung ersetzt dieses
    // Ticket. `Preis nicht ermittelt` ist hier die ehrliche Antwort, und
    // eine Null wäre nach Regel 16 verboten.
    const total = useStore.getState().projection().result.total.exact
    expect(total.isZero()).toBe(true)
    expect(row()).toHaveTextContent('Preis nicht ermittelt')
    // Umfang: die Gebäudekomposition der Option, als Chips.
    expect(row()).toHaveTextContent('Haus A')
    expect(within(section).getByRole('button', { name: 'Umbenennen' })).toBeInTheDocument()

    act(() => { useStore.getState().sendOffer('email') })
    expect(row()).toHaveTextContent('Versendet')
    expect(within(section).queryByRole('button', { name: 'Umbenennen' })).toBeNull()
  })

  it('AC-4: eine geöffnete, aber noch nicht gesendete Option zeigt "In Arbeit"', () => {
    enterOptionWorkspace()
    // Eine triviale In-Pipeline-Aktion (level: 'option') erzeugt ein
    // optionId-getaggtes Journal-Ereignis (siehe `apply()` in store.ts) —
    // das Erzeugen selbst zählt bewusst NICHT (siehe `OptionCard`).
    act(() => { useStore.getState().toggleBuildingIncluded('DEMO-B-B') })
    render(<ProjectOptionsSection justCreatedOptionId={null} />)
    const section = screen.getByRole('region', { name: 'Opportunity Options' })
    const row = within(section).getByText('Option 1').closest('li')!
    expect(row).toHaveTextContent('In Arbeit')
    expect(row).not.toHaveTextContent('Versendet')
  })
})
