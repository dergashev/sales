import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
import derived from '../../fixtures/derived-prototype.json'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Корень продукта: Opportunities, поиск, фильтры, гейт создания Options.
 * Проверяется то, что отличает уровень от экрана: до Option цены нет,
 * а до разрешённых конфликтов нет Option.
 */
beforeEach(() => __resetStoreForTests())

describe('Уровень Opportunities', () => {
  it('корень показывает список без панели цены', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument()
    // Цена принадлежит Option, а Option ещё не выбран.
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    // Ungefiltert nennt das Resümee nur die Gesamtzahl — kein "X von X".
    expect(screen.getByText('8 Opportunities')).toBeInTheDocument()
    // Kein Root-Breadcrumb mehr im PageHeader (TASK 02): der Term ist
    // Code-Jargon und die globale Shell-Kopfzeile übernimmt die Verortung.
    expect(screen.queryByText(/Wurzel/)).not.toBeInTheDocument()
    // Keine erfundene Ranking-/Sortier-Behauptung mehr im Ergebnis-Resümee
    // (der Stage-Tag "neu aus HubSpot" bleibt als Fixture-Text erlaubt —
    // "sortiert" kam ausschließlich aus der jetzt entfernten Behauptung).
    expect(screen.queryByText(/sortiert/)).not.toBeInTheDocument()
  })

  it('фильтр сужает множество и сообщает, сколько спрятал', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Land'), 'Schweiz')
    expect(screen.getByText(/2 von 8 Opportunities/)).toBeInTheDocument()
    // Активный фильтр виден и снимается по одному.
    await user.click(screen.getByRole('button', { name: /Filter entfernen: Land/ }))
    expect(screen.getByText('8 Opportunities')).toBeInTheDocument()
  })

  it('поиск ищет по имени, городу и владельцу', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Opportunities durchsuchen'), 'Probe')
    expect(screen.getByText(/2 von 8 Opportunities/)).toBeInTheDocument()
  })

  it('пустой результат объясняет себя, а не просто пустеет', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Opportunities durchsuchen'), 'zzz')
    expect(screen.getByText(/Keine Opportunity entspricht den Filtern/)).toBeInTheDocument()
  })

  it('Option нельзя создать, пока конфликт не решён и параметры не приняты', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))

    const create = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(useStore.getState().canCreateOptions()).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    expect(useStore.getState().canCreateOptions()).toBe(false)   // параметры ещё нет
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    expect(useStore.getState().canCreateOptions()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    expect(useStore.getState().options).toHaveLength(1)
    // Option startet im vorgeschalteten Gebäudeschritt — noch ohne Preis.
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))
    expect(screen.getByRole('heading', { name: 'Gebäude & Umfang' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
  })

  it.each([
    {
      label: 'обе предпосылки открыты', conflictResolved: false, paramsConfirmed: false,
      reason: 'Erst Konflikte entscheiden und Projektparameter bestätigen',
    },
    {
      label: 'остались только параметры', conflictResolved: true, paramsConfirmed: false,
      reason: 'Erst Projektparameter bestätigen',
    },
    {
      label: 'остался только конфликт', conflictResolved: false, paramsConfirmed: true,
      reason: 'Erst Konflikte entscheiden',
    },
    {
      label: 'обе предпосылки выполнены', conflictResolved: true, paramsConfirmed: true,
      reason: null,
    },
  ])('гейт создания Option называет только актуальные причины: $label', async ({
    conflictResolved, paramsConfirmed, reason,
  }) => {
    if (conflictResolved) useStore.getState().resolveWflConflict('customer')
    if (paramsConfirmed) useStore.getState().confirmProjectParams()

    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))

    const create = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    if (reason === null) {
      expect(create).not.toHaveAttribute('aria-disabled')
      expect(create).not.toHaveAttribute('aria-describedby')
      return
    }

    const explanation = screen.getByText(reason)
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(create).toHaveAttribute('aria-describedby', explanation.id)
    if (!conflictResolved) {
      expect(screen.getByRole('button', { name: 'Kundenwert übernehmen' })).toBeInTheDocument()
    }
    if (!paramsConfirmed) {
      expect(screen.getByRole('button', { name: 'Projektparameter bestätigen' })).toBeInTheDocument()
    }

    create.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(create)
    expect(useStore.getState().options).toHaveLength(0)
    expect(create).toHaveFocus()
  })

  it('выведенные значения несут пометку происхождения (D-22)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    const params = screen.getByLabelText('Projektparameter')
    // D-22's warning comes from the derived-value fixture, not hand-authored
    // presentation copy, so removing it requires an explicit data change.
    expect(within(params).getAllByLabelText(/^Herkunft: abgeleitet/)).toHaveLength(3)
    expect(within(params).getAllByText(new RegExp(derived.provenanceLabel))).toHaveLength(3)
    expect(within(params).getAllByText(new RegExp(derived.marker, 'u'))).toHaveLength(3)
    expect(within(params).getByText(/Balkonanteil abgeleitet/)).toBeInTheDocument()
    expect(within(params).getByText(/85\s*% der BGF R\+S/)).toBeInTheDocument()
    expect(within(params).getByText(/Total BGF \(S\)/)).toBeInTheDocument()
  })

  it('EN переключает содержимое экранов, не только хром (ревью № 13, дефект 2)', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Переключатель языка — в шапке; словарь = поставка Codex + локальное
    // дополнение для строк, созданных после поставки.
    expect(screen.getByRole('radio', { name: 'EN' })).toBeInTheDocument()
    expect(screen.queryByText(/Entwurf|Draft/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name, Stadt, Owner, ID')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /EN/ }))
    // Немецкая строка поискового лейбла исчезла — заменена переводом.
    expect(screen.queryByText('Opportunities durchsuchen')).toBeNull()
    expect(screen.getByPlaceholderText('Name, city, owner, ID')).toBeInTheDocument()
    // Немецкий остаётся источником: переключение обратно восстанавливает.
    await user.click(screen.getByRole('radio', { name: /^DE$/ }))
    expect(screen.getByPlaceholderText('Name, Stadt, Owner, ID')).toBeInTheDocument()
  })

  it('непроработанная Opportunity говорит это до расчёта, а не показывает выдумку', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterquartier Südhang öffnen/ }))
    expect(screen.getByText(/im Prototyp nicht ausgearbeitet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Projektparameter')).not.toBeInTheDocument()
  })

  it('заметка: тихая запись, чип вместо тоста, в презентации не существует (DC-43, правило 34)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))

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
    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    // In der Kundenansicht existiert die Notiz nicht im DOM.
    expect(screen.queryByRole('textbox', { name: /Interne Notiz/ })).toBeNull()
    expect(document.body.textContent).not.toContain('HubSpot-Projektkarte')
  })
})
