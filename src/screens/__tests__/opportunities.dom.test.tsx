import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
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

    // #16's own Projektstatus-Stepper now echoes the very same reason text
    // (Project Baseline/Opportunity Options stateText) — `getByText` would
    // be ambiguous, so the explanation is resolved via the button's OWN
    // `aria-describedby`, not by matching the reason string in the DOM.
    expect(create).toHaveAttribute('aria-disabled', 'true')
    const explanationId = create.getAttribute('aria-describedby')
    expect(explanationId).toBeTruthy()
    const explanation = document.getElementById(explanationId!)!
    expect(explanation).toHaveTextContent(reason)
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

  // The former "выведенные значения несут пометку происхождения (D-22)" test
  // exercised the Project Card's own "Total BGF (S)"/"Total BGF (R+S)"/
  // "Total NRF" rows — the exact F-09 defect (deep-coherence audit, Task 01):
  // those rows read a fixture's derived-balcony proxy that CONTRADICTED the
  // accepted buildingReviews fact (documented BGF S = 0, per D-26 — the
  // derived balcony share is deliberately not reused as DIN 277 BGF S). The
  // "3 derived values" this test asserted were the bug, not a legitimate D-22
  // example: fixing F-09 makes every remaining Project Card value a genuine
  // document-sourced building-review fact, so no "abgeleitet" row is left at
  // this level any more (D-22 itself — that derived values carry a mark — is
  // still covered elsewhere, e.g. the DC-21 driver-origin suite, wherever a
  // real derived contribution still exists). See
  // `project-baseline.dom.test.tsx` for the corrected BGF equation assertions.

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

    // #16 Part 5/AC-07: Internal Note ist keine primäre Workflow-Stufe mehr —
    // der EINZIGE Einstieg ist jetzt der Header-Utility-Button, der den
    // kanonischen `Dialog` öffnet.
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

    // In der Kundenansicht existiert die Notiz nicht im DOM — nicht einmal
    // ihr Einstiegspunkt (NOTE-006: nicht versteckt, sondern nicht vorhanden).
    expect(screen.queryByRole('button', { name: 'Interne Notiz' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /Interne Notiz/ })).toBeNull()
    expect(document.body.textContent).not.toContain('HubSpot-Projektkarte')
  })
})

describe('AUD-03 — Option identity & creation continuity', () => {
  async function reachCreateGate(user: ReturnType<typeof userEvent.setup>) {
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  }

  it('AC-1/AC-2: ein schneller Doppelklick erzeugt genau eine Option, ein Journal-Event', async () => {
    const user = userEvent.setup()
    await reachCreateGate(user)
    const create = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    const journalBefore = useStore.getState().journal.length
    // `fireEvent`, nicht `userEvent`: zwei WIRKLICH unmittelbar
    // aufeinanderfolgende Klick-Events, ohne die kleine reale Verzögerung,
    // die `userEvent.click()` selbst schon einführt — genau der
    // Doppelklick-Fall, den die Guard-Zeit abfangen soll (AC-1).
    fireEvent.click(create)
    fireEvent.click(create)
    expect(useStore.getState().options).toHaveLength(1)
    expect(useStore.getState().journal.length).toBe(journalBefore + 1)
    expect(useStore.getState().undoToast?.statusText).toContain('Option 1')
  })

  it('AC-1: ein Klick nach Ablauf der Guard-Zeit erzeugt eine ZWEITE, eindeutig benannte Option', async () => {
    const user = userEvent.setup()
    await reachCreateGate(user)
    const create = () => screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    await user.click(create())
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1'])
    // Über die Guard-Zeit hinaus warten (echte Timer, wie der bestehende
    // DELTA_CHIP_MS-Wait weiter oben in dieser Datei) — kein Doppelklick,
    // ein zweiter, eigenständiger Klick.
    await act(() => new Promise((r) => setTimeout(r, 600)))
    await user.click(create())
    expect(useStore.getState().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
  })

  it('AC-3: nach dem Anlegen liegt der Fokus auf der NEUEN Zeile, nicht auf der Seitenüberschrift', async () => {
    const user = userEvent.setup()
    await reachCreateGate(user)
    // Regressionswache für den eigentlichen Fund: das Erzeugen einer Option
    // hat früher `App.tsx`'s globalen "neues Dokument"-Effekt fälschlich
    // ausgelöst (scrollTop=0 + Fokus auf das Seiten-`h1`), obwohl der
    // Bildschirm dieselbe Opportunity Card blieb.
    const heading = screen.getByRole('heading', { name: 'Musterprojekt Nordfeld' })
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    const row = screen.getByText('Option 1').closest('li')!
    expect(row.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(heading)
  })

  it('AC-3: Umbenennen funktioniert in einer Interaktion, inline', async () => {
    const user = userEvent.setup()
    await reachCreateGate(user)
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Umbenennen' }))
    const field = screen.getByLabelText('Name der Option')
    await user.clear(field)
    await user.type(field, 'Zielangebot{Enter}')
    expect(screen.queryByText('Option 1')).toBeNull()
    expect(screen.getByText('Zielangebot')).toBeInTheDocument()
    expect(useStore.getState().options[0]!.name).toBe('Zielangebot')
  })

  it('AC-4: frische Option zeigt Neu/Umfang/Summe aus der Engine, gesendete verliert Umbenennen', async () => {
    const user = userEvent.setup()
    await reachCreateGate(user)
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    const row = () => screen.getByText('Option 1').closest('li')!
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
    expect(screen.getByRole('button', { name: 'Umbenennen' })).toBeInTheDocument()

    act(() => { useStore.getState().sendOffer('email') })
    expect(row()).toHaveTextContent('Versendet')
    expect(screen.queryByRole('button', { name: 'Umbenennen' })).toBeNull()
  })
})
