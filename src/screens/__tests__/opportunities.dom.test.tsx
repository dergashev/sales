import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  confirmBuildingReviewSections,
  enterOptionWorkspace,
  enterProjectUnderstanding,
} from '../../test/offer-option'
import { __resetStoreForTests, useStore } from '../../state/store'
import { ProjectOptionsSection } from '../ProjectOptions'
import { demoProject } from '../../state/projectAnalysis'

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
beforeEach(() => __resetStoreForTests())

/** Оба CTA карточек в порядке отображения — единственный надёжный способ
 *  прочитать ПОРЯДОК списка, не завязываясь на классы. */
const cardOrder = () => screen
  .getAllByRole('button', { name: /öffnen$/ })
  .map((b) => b.getAttribute('aria-label'))

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Filtern und sortieren/ }))
}

describe('Уровень Projekte', () => {
  it('корень показывает ровно два проекта, без панели цены', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Projekte' })).toBeInTheDocument()
    // Цена принадлежит Option, а Option ещё не выбран.
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    // Инвариант фикстуры: ровно две карточки, обе полные.
    expect(screen.getAllByRole('article')).toHaveLength(2)
    // Резюме называет размер портфеля из самой фикстуры — не «X из X».
    expect(screen.getByText('Demonstrationsportfolio · 2 Projekte')).toBeInTheDocument()
    expect(screen.queryByText(/von 2 Projekte/)).not.toBeInTheDocument()
    // Kein Root-Breadcrumb mehr im PageHeader (TASK 02): der Term ist
    // Code-Jargon und die globale Shell-Kopfzeile übernimmt die Verortung.
    expect(screen.queryByText(/Wurzel/)).not.toBeInTheDocument()
    // Keine erfundene Ranking-/Sortier-Behauptung im Ergebnis-Resümee.
    expect(screen.queryByText(/sortiert/)).not.toBeInTheDocument()
  })

  it('каждая карточка называет проект, клиента с городом, статус, две строки готовности и один основной CTA', () => {
    render(<App />)
    // Карточка целиком — это `<li>`: `Card` (article) живёт в ней рядом с
    // кадром изображения и меткой статуса, которая стоит в позиции
    // «бровки» НАД именем проекта, а не в слоте `status` примитива.
    const card = (name: string) => screen
      .getByRole('button', { name: `${name} öffnen` })
      .closest('li')!
    const clean = card('Wohnhof Lindenhain')
    const complex = card('Quartier Am Güterbogen')

    expect(within(clean!).getByText('Wohnhof Lindenhain')).toBeInTheDocument()
    expect(within(clean!).getByText(/Lindenhain Wohnen GmbH/)).toBeInTheDocument()
    expect(within(clean!).getByText(/Freiburg im Breisgau/)).toBeInTheDocument()
    // Статус не только цветом: у метки есть подпись (правило 8).
    expect(within(clean!).getByText('Beispiel ohne Konflikte')).toBeInTheDocument()
    expect(within(clean!).getByText('Mehrfamilienhaus · Neubau')).toBeInTheDocument()
    expect(within(clean!).getByText(/1 Gebäude · 8 Dokumente/)).toBeInTheDocument()
    // Две строки готовности ВЫВЕДЕНЫ из собственного состояния проекта:
    // до анализа карточка говорит то, что действительно известно, и НЕ
    // называет число расхождений, которого анализ ещё не вычислял.
    expect(within(clean!).getByText('Dokumentation')).toBeInTheDocument()
    expect(within(clean!).getByText('Vollständig')).toBeInTheDocument()
    expect(within(clean!).getByText('Dokumentanalyse')).toBeInTheDocument()
    expect(within(clean!).getByText('Nicht gestartet')).toBeInTheDocument()
    // Ровно один основной CTA на карточку.
    expect(within(clean!).getAllByRole('button', { name: 'Wohnhof Lindenhain öffnen' }))
      .toHaveLength(1)
    expect(within(clean!).getByRole('button', { name: 'Wohnhof Lindenhain öffnen' }))
      .toHaveTextContent('Projekt öffnen')

    expect(within(complex!).getByText('Quartier Am Güterbogen')).toBeInTheDocument()
    expect(within(complex!).getByText(/Güterbogen Projektentwicklung GmbH/)).toBeInTheDocument()
    expect(within(complex!).getByText(/Leipzig/)).toBeInTheDocument()
    expect(within(complex!).getByText('Prüfung erforderlich')).toBeInTheDocument()
    expect(within(complex!).getByText(/3 Gebäude · 36 Dokumente/)).toBeInTheDocument()
    expect(within(complex!).getByRole('button', { name: 'Quartier Am Güterbogen öffnen' }))
      .toHaveTextContent('Projekt prüfen')

    // Ни одна карточка не показывает цены: тотал принадлежит Option.
    expect(document.querySelector('.a3-project-grid')!.textContent)
      .not.toMatch(/€/)
  })

  it('обе карточки полностью изображены — ни одна не падает в графику-заглушку', () => {
    render(<App />)
    const alts = screen.getAllByRole('img').map((i) => i.getAttribute('alt'))
    expect(alts).toContain(
      'Fünfgeschossiges Mehrfamilienhaus mit warmer Mineralfassade an einem bepflanzten Innenhof',
    )
    expect(alts).toContain(
      'Quartier mit drei unterschiedlichen Baukörpern um einen begrünten Innenhof',
    )
    // Информационное состояние «изображение не зарегистрировано» остаётся
    // в MediaFrame, но ни одна из двух карточек в него не попадает.
    expect(document.querySelector('.a3-project-grid .a3-mediaframe-fallback')).toBeNull()
  })

  it('поиск, сортировка и фильтр живут за ОДНИМ раскрытием и по умолчанию закрыты', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('button', { name: /Filtern und sortieren/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByLabelText('Sortierung')).toBeNull()

    await openFilters(user)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getByLabelText('Sortierung')).toBeInTheDocument()
  })

  it('сортировка меняет порядок: Empfohlen ведёт чистым маршрутом, Name — алфавитом', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openFilters(user)
    const sort = screen.getByLabelText('Sortierung') as HTMLSelectElement

    // Empfohlen (по умолчанию): сначала чистый маршрут — сам смысл списка
    // в том, чтобы показать оба пути в этом порядке.
    expect(sort.value).toBe('recommended')
    expect(cardOrder()).toEqual([
      'Wohnhof Lindenhain öffnen', 'Quartier Am Güterbogen öffnen',
    ])

    await user.selectOptions(sort, 'name')
    expect(cardOrder()).toEqual([
      'Quartier Am Güterbogen öffnen', 'Wohnhof Lindenhain öffnen',
    ])

    // Status ставит вперёд случай, который требует решения.
    await user.selectOptions(sort, 'status')
    expect(cardOrder()).toEqual([
      'Quartier Am Güterbogen öffnen', 'Wohnhof Lindenhain öffnen',
    ])
  })

  it('фильтр по городу сужает множество и сообщает получившийся размер', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openFilters(user)
    // Селектор города опознаётся по своему СОДЕРЖИМОМУ, а не по подписи:
    // подпись рендерится сырым ключом `opplist.filter.city.label`
    // (дефект словаря, сообщён отдельно) — тест не закрепляет дефект как
    // ожидаемый текст и не ослабляет предмет проверки.
    const city = screen.getAllByRole('combobox')
      .find((c) => c.querySelector('option[value="Leipzig"]')) as HTMLSelectElement
    expect(city).toBeDefined()

    await user.selectOptions(city, 'Leipzig')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(cardOrder()).toEqual(['Quartier Am Güterbogen öffnen'])
    // Сузившееся множество объявляется ОДИН раз, после сужения.
    // "1 Projekte" is not German: the eyebrow has a singular form.
    expect(screen.getByText('Demonstrationsportfolio · 1 Projekt')).toBeInTheDocument()
    // Активный фильтр виден на самом раскрытии — счётчиком, а не чипом:
    // прежние удаляемые чипы фильтров ушли вместе с четырьмя фильтрами.
    expect(screen.getByRole('button', { name: /Filtern und sortieren \(1\)/ }))
      .toBeInTheDocument()

    await user.selectOptions(city, 'alle')
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('поиск ищет по имени, городу и клиенту', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openFilters(user)
    const search = screen.getByRole('searchbox')

    await user.type(search, 'Lindenhain')
    expect(cardOrder()).toEqual(['Wohnhof Lindenhain öffnen'])

    await user.clear(search)
    await user.type(search, 'Leipzig')
    expect(cardOrder()).toEqual(['Quartier Am Güterbogen öffnen'])

    await user.clear(search)
    await user.type(search, 'Güterbogen Projektentwicklung')
    expect(cardOrder()).toEqual(['Quartier Am Güterbogen öffnen'])
  })

  it('пустой результат объясняет себя и предлагает сброс', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openFilters(user)
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText(/Keine Opportunity entspricht der Suche/)).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    // Отличается от текста «в аккаунте вообще ничего нет» — тот живёт в
    // `opportunity-list-empty-account.dom.test.tsx` и сброса не предлагает.
    expect(screen.queryByText('Es sind noch keine Opportunities vorhanden.')).toBeNull()
    expect(document.querySelector('.a3-empty-spec button')).not.toBeNull()
  })

  it('Option нельзя создать, пока блокирующие расхождения не решены; свежая Option — без цены', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Quartier Am Güterbogen öffnen' }))
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
    await act(() => new Promise((r) => setTimeout(r, 400)))
    expect(useStore.getState().options).toHaveLength(1)

    // Option startet im vorgeschalteten Gebäudeschritt — noch ohne Preis.
    await user.click(screen.getByRole('button', { name: 'Option öffnen' }))
    expect(screen.getByRole('heading', { name: 'Gebäude & Umfang' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
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
    expect(screen.getByText('Demonstrationsportfolio · 2 Projekte')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projekte' })).toBeInTheDocument()
    await openFilters(user)
    expect(screen.getByPlaceholderText('Name, Stadt, Owner, ID')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /EN/ }))
    // Немецкая строка поискового лейбла исчезла — заменена переводом.
    expect(screen.queryByText('Opportunities durchsuchen')).toBeNull()
    expect(screen.getByPlaceholderText('Name, city, owner, ID')).toBeInTheDocument()
    expect(screen.getByText('Demonstration portfolio · 2 projects')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    expect(screen.getByText('Client ready example')).toBeInTheDocument()

    // Немецкий остаётся источником: переключение обратно восстанавливает.
    await user.click(screen.getByRole('radio', { name: /^DE$/ }))
    expect(screen.getByPlaceholderText('Name, Stadt, Owner, ID')).toBeInTheDocument()
    expect(screen.getByText('Beispiel ohne Konflikte')).toBeInTheDocument()
  })

  it('заметка: тихая запись, чип вместо тоста, в презентации не существует (DC-43, правило 34)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Wohnhof Lindenhain öffnen' }))

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
    enterOptionWorkspace()
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
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
    await act(() => new Promise((r) => setTimeout(r, 400)))
    expect(useStore.getState().options).toHaveLength(1)
    expect(useStore.getState().journal.length).toBe(journalBefore + 1)
    expect(useStore.getState().undoToast?.statusText).toContain('Option 1')
  })

  it('AC-1: ein Klick nach Ablauf der Guard-Zeit erzeugt eine ZWEITE, eindeutig benannte Option', async () => {
    const user = userEvent.setup()
    const create = reachCreateGate()
    await user.click(create())
    await act(() => new Promise((r) => setTimeout(r, 400)))
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1'])

    // Kein Doppelklick: die Guard ist abgelaufen, das Gate ist über den
    // einen Verlauf (Spine) wieder erreichbar, und der zweite,
    // eigenständige Klick legt eine zweite, eindeutig benannte Option an.
    const spine = screen.getByRole('navigation', { name: 'Projekt- und Optionsverlauf' })
    await user.click(within(spine).getByText('Projektverständnis').closest('button')!)
    await user.click(create())
    await act(() => new Promise((r) => setTimeout(r, 400)))
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
    await act(() => new Promise((r) => setTimeout(r, 400)))

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
    // Die Fixture bringt bereits reale Gebäudefakten mit (Dokumentanalyse
    // lief vor Options überhaupt existieren) — eine frische Option zeigt
    // deshalb sofort eine ehrliche, unvollständige Summe (rule 16), nicht
    // "Preis nicht ermittelt": beides ist derselbe `priceUnavailable`-Pfad,
    // hier trifft nur der andere Zweig zu. Der EXAKTE Wert kommt aus
    // `projectionForOption`, nicht aus einer eigenen UI-Berechnung.
    const total = useStore.getState().projection().result.total.exact
    expect(total.isZero()).toBe(false)
    expect(row()).toHaveTextContent('Zwischensumme der kalkulierten Positionen')
    expect(row()).toHaveTextContent('€')
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
