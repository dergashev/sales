import { beforeEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
import { ConfigurationScopeTabs } from '../S3Konfigurator'
import {
  __resetStoreForTests,
  choicesFor,
  configurationComplete,
  configurationDisplayStatusFor,
  useStore,
} from '../../state/store'

beforeEach(() => __resetStoreForTests())

const nav = (name: RegExp) => screen.getAllByRole('button', { name })[0]!

async function openBuildingScope(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
}

async function openModeStep(
  user: ReturnType<typeof userEvent.setup>,
  buildingCount: 1 | 2,
) {
  await openBuildingScope(user)
  if (buildingCount === 2) {
    await user.click(screen.getByRole('checkbox', { name: 'Haus B' }))
  }
  await confirmBuildingReviewSections(user)
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  if (buildingCount === 2) {
    const tabs = screen.getByRole('tablist', { name: 'Gewählte Gebäude' })
    await user.click(within(tabs).getByRole('tab', { name: /Haus B/ }))
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  }
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
}

async function startMode(
  user: ReturnType<typeof userEvent.setup>,
  mode: 'SHARED' | 'PER_BUILDING',
) {
  await user.click(screen.getByRole('radio', {
    name: mode === 'SHARED' ? 'Gemeinsam konfigurieren' : 'Je Gebäude konfigurieren',
  }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
}

function includeCoreScope() {
  act(() => {
    useStore.getState().setCoverage('KG_300', 'included')
    useStore.getState().setCoverage('KG_400', 'included')
    useStore.getState().setCoverage('KG_700', 'included')
  })
}

async function visitRequiredBuildingChapters(user: ReturnType<typeof userEvent.setup>) {
  // Leistungsabgrenzung (chapter 1) is project-level, not building-scoped —
  // confirmConfigurationMode no longer visits a building-scoped chapter for
  // free, so Leistungen KG 300 must be visited explicitly here too.
  await user.click(nav(/Leistungen KG 300/))
  await user.click(nav(/Technik KG 400/))
  await user.click(nav(/Energie & Zertifikate/))
  await user.click(nav(/Flächen im Detail/))
}

describe('Konfigurator mode entry and building-aware navigation', () => {
  it('starts with a truly unselected inline step and no pricing or journal mutation', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)

    expect(screen.getByRole('heading', { level: 1, name: 'Konfigurationsmodus wählen' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    screen.getAllByRole('radio', { name: /konfigurieren/ })
      .forEach((radio) => expect(radio).not.toBeChecked())
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Leistungsabgrenzung/ })).toBeNull()

    const beforeJournal = useStore.getState().journal.length
    await user.click(screen.getByRole('radio', { name: 'Gemeinsam konfigurieren' }))

    expect(useStore.getState().journal).toHaveLength(beforeJournal)
    expect(useStore.getState().activeDelta).toBeNull()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    expect(useStore.getState().configurationModeChosen).toBe(true)
    // Scope Boundaries is the authoritative first Configurator step
    // (Product contract, 2026-08-18): this single click both confirms the
    // mode and enters Leistungsabgrenzung, so pricing begins right here —
    // the earlier mode radio choice on its own never started it.
    expect(useStore.getState().pricingStarted).toBe(true)
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
      .toHaveFocus()
    const workflowNav = document.querySelector<HTMLElement>('.a3-chapters')!
    // `:scope > span:last-child` (not the unscoped `span:last-child`, which
    // matches the FIRST last-child span anywhere in the subtree): the F02/F03
    // a11y fix (Sidebar.tsx) nests an aria-hidden numeral + sr-only "Schritt N
    // von M" span inside the marker span that precedes this one, and the
    // sr-only span is itself a last-child of ITS OWN parent — an unscoped
    // selector would match that instead of the button's own last direct
    // child (the visible chapter label this assertion means to check).
    expect(within(workflowNav).getAllByRole('button').map((button) =>
      button.querySelector(':scope > span:last-child')?.textContent)).toEqual([
      'Leistungsabgrenzung',
      'Energie & Zertifikate',
      'Flächen im Detail',
      'Termine & Kommerzielles',
    ])
    expect(screen.queryByRole('button', { name: /Baugrund & Erschließung/ })).toBeNull()
    expect(screen.getByText('Kapitel 1 von 4 · Konfigurator')).toBeInTheDocument()
    // Leistungsabgrenzung is project-level, not building-scoped: no per-
    // building tabs, no per-building readiness detail on this chapter.
    expect(screen.getByText('Gilt für den gesamten Komplex')).toBeInTheDocument()
    expect(screen.queryByText(/Gebäudeschritte 1, 3, 4 und 5/)).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()
    expect(screen.queryByText('Kalkulation noch nicht gestartet')).toBeNull()

    includeCoreScope()

    await user.click(nav(/Variantenvergleich/))
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungen KG 300/))
    expect(screen.getByText(/Leistungen KG 300, Technik KG 400/)).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Modus ändern' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Konfigurationsmodus wählen' }))
      .toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Gemeinsam konfigurieren' })).toBeChecked()
    // Editing an already-chosen mode hides the Angebot panel again (pre-
    // existing behavior, unrelated to this reorder) — but the underlying
    // `pricingStarted` flag itself is not rolled back.
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(useStore.getState().pricingStarted).toBe(true)
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    expect(useStore.getState().configurationMode).toBe('PER_BUILDING')
    expect(useStore.getState().configurationModeChosen).toBe(true)
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
      .toHaveFocus()

    await user.click(nav(/Leistungen KG 300/))
    const oneBuildingTabs = screen.getByRole('tablist', {
      name: 'Konfigurationsumfang',
    })
    expect(within(oneBuildingTabs).getAllByRole('tab')).toHaveLength(1)
    expect(within(oneBuildingTabs).getByRole('tab', { name: /Haus A · Unvollständig/ }))
      .toHaveAttribute('aria-selected', 'true')
  })

  it('keeps shared choices common while building facts and costs remain separate', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')
    includeCoreScope()
    // "Konfiguration starten" lands on Leistungsabgrenzung (project-level);
    // the building-scoped SHARED text below only renders on a
    // building-scoped chapter.
    await user.click(nav(/Leistungen KG 300/))

    expect(screen.queryByRole('tablist', { name: 'Konfigurationsumfang' })).toBeNull()
    expect(screen.getAllByText(/Gemeinsame Konfiguration · gilt für Haus A und Haus B/))
      .not.toHaveLength(0)

    const facade = screen.getByRole('heading', { level: 2, name: 'Fassade' })
      .closest('section')!
    const klinker = within(facade).getAllByRole('radio')
      .find((radio) => radio.getAttribute('value') === 'klinker')!
    await user.click(klinker)
    const state = useStore.getState()
    expect(choicesFor(state, 'DEMO-B-A').fassade).toBe('klinker')
    expect(choicesFor(state, 'DEMO-B-B').fassade).toBe('klinker')
    expect(state.buildings['DEMO-B-A']).not.toEqual(state.buildings['DEMO-B-B'])

    await visitRequiredBuildingChapters(user)
    const confirm = screen.getByRole('button', {
      name: 'Gemeinsame Konfiguration bestätigen',
    })
    expect(confirm).not.toHaveClass('a3-sec')
    expect(nav(/Weiter · Kapitel 6: Baunebenkosten KG 700/)).toHaveClass('a3-sec')
    await user.click(screen.getByRole('button', {
      name: 'Gemeinsame Konfiguration bestätigen',
    }))
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-A'))
      .toBe('confirmed')
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-B'))
      .toBe('confirmed')
    // Scope Boundaries confirmation (ticket d21f8d48) is now its own
    // prerequisite for configurationComplete, independent of the per-building
    // configuration confirmation exercised above.
    act(() => useStore.getState().confirmScopeBoundaries())
    expect(configurationComplete(useStore.getState())).toBe(true)
  })

  it('isolates per-building progress and atomically aligns edit and offer scope', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'PER_BUILDING')

    expect(useStore.getState().journal.at(-1)).toMatchObject({
      label: 'Konfiguration je Gebäude bestätigt',
      deltaExact: null,
    })
    includeCoreScope()

    // "Konfiguration starten" lands on Leistungsabgrenzung (project-level,
    // no building tabs); the per-building switcher below lives on a
    // building-scoped chapter.
    await user.click(nav(/Leistungen KG 300/))
    const switcher = screen.getByRole('tablist', { name: 'Konfigurationsumfang' })
    expect(within(switcher).getByRole('tab', { name: /Haus B · Unvollständig/ }))
      .toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /Haus B · Unvollständig/ }))
      .toBeInTheDocument()
    await visitRequiredBuildingChapters(user)
    expect(within(switcher).getByRole('tab', { name: /Haus B · Bereit zum Bestätigen/ }))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', {
      name: 'Konfiguration für Haus B bestätigen',
    }))
    expect(within(switcher).getByRole('tab', { name: /Haus B · Bestätigt/ }))
      .toBeInTheDocument()
    expect(configurationComplete(useStore.getState())).toBe(false)

    const beforeSwitchJournal = useStore.getState().journal.length
    const hausA = within(switcher).getByRole('tab', { name: /Haus A · Unvollständig/ })
    await user.click(hausA)
    expect(document.activeElement).toBe(hausA)
    expect(useStore.getState().activeBuildingId).toBe('DEMO-B-A')
    expect(useStore.getState().scopeBuildingId).toBe('DEMO-B-A')
    expect(useStore.getState().journal).toHaveLength(beforeSwitchJournal)
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-B'))
      .toBe('confirmed')
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-A')).toBe('open')

    await user.click(nav(/Leistungsabgrenzung/))
    expect(screen.queryByRole('tablist', { name: 'Konfigurationsumfang' })).toBeNull()
    expect(screen.getByText('Gilt für den gesamten Komplex')).toBeInTheDocument()
    expect(useStore.getState().activeBuildingId).toBe('DEMO-B-A')
    expect(useStore.getState().scopeBuildingId).toBeNull()

    await user.click(nav(/Leistungen KG 300/))
    const restored = screen.getByRole('tablist', { name: 'Konfigurationsumfang' })
    expect(within(restored).getByRole('tab', { name: /Haus A · Unvollständig/ }))
      .toHaveAttribute('aria-selected', 'true')

    const current = within(restored).getByRole('tab', { name: /Haus A · Unvollständig/ })
    current.focus()
    await user.keyboard('{Home}')
    const total = within(restored).getByRole('tab', {
      name: /Gesamt · 1 von 2 bestätigt/,
    })
    expect(document.activeElement).toBe(total)
    expect(total).toHaveAttribute('aria-selected', 'false')
    expect(current).toHaveAttribute('aria-selected', 'true')
    await user.keyboard(' ')
    expect(total).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /Gesamt · 1 von 2 bestätigt/ }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Konfigurationsstand' }))
      .toBeInTheDocument()
    await user.keyboard('{End}')
    const hausB = within(restored).getByRole('tab', { name: /Haus B · Bestätigt/ })
    expect(document.activeElement).toBe(hausB)
    expect(total).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(hausB).toHaveAttribute('aria-selected', 'true')

    await user.click(within(restored).getByRole('tab', {
      name: /Haus A · Unvollständig/,
    }))
    await visitRequiredBuildingChapters(user)
    await user.click(screen.getByRole('button', {
      name: 'Konfiguration für Haus A bestätigen',
    }))
    expect(within(restored).getByRole('tab', { name: /Haus A · Bestätigt/ }))
      .toBeInTheDocument()
    // Scope Boundaries confirmation (ticket d21f8d48) is now its own
    // prerequisite for configurationComplete, independent of the per-building
    // configuration confirmation exercised above.
    act(() => useStore.getState().confirmScopeBoundaries())
    expect(configurationComplete(useStore.getState())).toBe(true)
  })

  it('keeps narrowed pricing qualified and restores the complex before export', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'PER_BUILDING')
    await user.click(nav(/Leistungsabgrenzung/))
    // Scope Boundaries (AC22/D-18): all six KG groups start `unknown`.
    // This test resolves them through the same store actions used by the six
    // RadioCardGroups because its subject is narrowed pricing, not tile input.
    act(() => useStore.getState().setCoverage('KG_200', 'excluded'))
    act(() => useStore.getState().setCoverage('KG_300', 'included'))
    act(() => useStore.getState().setCoverage('KG_400', 'included'))
    act(() => useStore.getState().setCoverage('KG_500', 'excluded'))
    act(() => useStore.getState().setCoverage('KG_600', 'excluded'))
    act(() => useStore.getState().setCoverage('KG_700', 'included'))
    await user.click(nav(/Leistungen KG 300/))

    const switcher = screen.getByRole('tablist', { name: 'Konfigurationsumfang' })
    await user.click(within(switcher).getByRole('tab', {
      name: /Gesamt · 0 von 2 bestätigt/,
    }))
    const complex = useStore.getState().projection().result
    expect(complex.totalLabel).toBe('Gesamt netto · Grundleistung All3')

    await user.click(within(switcher).getByRole('tab', {
      name: /Haus A · Unvollständig/,
    }))
    const narrowed = useStore.getState().projection().result
    expect(narrowed.total.exact.lt(complex.total.exact)).toBe(true)
    expect(narrowed.totalLabel).toBe('Gesamt netto · Grundleistung All3 · Haus A')
    act(() => useStore.getState().setUiLanguage('en'))
    expect(screen.getAllByText('Net total · All3 core service · Haus A'))
      .not.toHaveLength(0)
    act(() => useStore.getState().setUiLanguage('de'))

    await user.click(nav(/Variantenvergleich/))
    expect(useStore.getState().scopeBuildingId).toBeNull()
    expect(useStore.getState().projection().result.total.exact.eq(complex.total.exact))
      .toBe(true)

    await user.click(nav(/Export/))
    await user.click(screen.getByRole('button', { name: 'Weiter zum Preflight' }))
    await user.click(screen.getByRole('button', { name: /Preflight bestanden/ }))
    await user.click(screen.getByRole('button', { name: 'Bestätigen & senden' }))
    const snapshot = useStore.getState().snapshots.at(-1)!
    expect(snapshot.totalExact).toBe(complex.total.exact.toFixed(2))
    expect(snapshot.totalLabel).toBe(complex.totalLabel)
    expect(screen.getByText((content) => content.includes(
      `Snapshot ${snapshot.id}: ${complex.totalLabel} ${snapshot.totalExact}`,
    ))).toBeInTheDocument()

    await user.click(nav(/Konfigurator/))
    expect(useStore.getState().scopeBuildingId).toBe('DEMO-B-A')
    const directSnapshot = useStore.getState().sendOffer('email')
    expect(directSnapshot.totalExact).toBe(complex.total.exact.toFixed(2))
    expect(directSnapshot.totalLabel).toBe(complex.totalLabel)
  })

  it('surfaces upstream invalidation as recheck instead of reviving confirmation', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'PER_BUILDING')
    includeCoreScope()
    await visitRequiredBuildingChapters(user)
    await user.click(screen.getByRole('button', {
      name: 'Konfiguration für Haus A bestätigen',
    }))
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-A'))
      .toBe('confirmed')

    await user.click(nav(/Gebäude & Umfang/))
    const name = screen.getByRole('textbox', { name: 'Bezeichnung aus der Dokumentation' })
    await user.clear(name)
    await user.type(name, 'Haus A Nord')
    await user.click(screen.getByRole('button', {
      name: 'Angabe übernehmen: Bezeichnung aus der Dokumentation',
    }))
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-A'))
      .toBe('recheck')
    expect(screen.getByText('Konfigurationsbestätigung aufgehoben: Haus A Nord.'))
      .toBeInTheDocument()
    expect(screen.getByText(/Andere gültige Konfigurationsarbeit bleibt gespeichert/))
      .toBeInTheDocument()

    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    expect(screen.queryByText(/Konfigurationsbestätigung aufgehoben/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    expect(screen.getByText('Erneut prüfen')).toBeInTheDocument()
    expect(screen.queryByText('Die sichtbare Konfiguration ist bestätigt.')).toBeNull()
    expect(screen.getByRole('button', {
      name: 'Konfiguration für Haus A Nord bestätigen',
    })).toBeInTheDocument()
  })

  it('binds Chapter 5 facts to the active building and fails visibly for missing facts', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'PER_BUILDING')
    await user.click(nav(/Flächen im Detail/))

    expect(screen.getByRole('heading', { level: 2, name: 'Flächen · Haus B' }))
      .toBeInTheDocument()
    // Task 02 (deep-coherence audit, F-15): this chapter no longer re-edits
    // building facts (a third editing surface duplicating Building &
    // Scope, AC2) — area values are now a read-only `.numeric` display,
    // not an editable textbox.
    expect(screen.queryByRole('textbox', { name: /BGF R\+S/ })).toBeNull()
    expect(screen.getByText(/1\.200,00\s*m²/)).toBeInTheDocument()
    expect(screen.queryByText(/2\.000,00\s*m²/)).toBeNull()
    expect(screen.getByText(/WFL nach WoFlV ist für Haus B noch nicht belastbar verfügbar/))
      .toBeInTheDocument()
    expect(screen.getByText(/Einheiten ist für Haus B noch nicht belastbar verfügbar/))
      .toBeInTheDocument()
    // Every present fact still links back to the one place it is actually
    // editable.
    expect(screen.getAllByRole('button', { name: 'In Gebäude & Umfang prüfen' }).length)
      .toBeGreaterThan(0)

    const tabs = screen.getByRole('tablist', { name: 'Konfigurationsumfang' })
    await user.click(within(tabs).getByRole('tab', {
      name: /Haus A · Unvollständig/,
    }))

    expect(screen.getByRole('heading', { level: 2, name: 'Flächen · Haus A' }))
      .toBeInTheDocument()
    expect(screen.getByText(/2\.000,00\s*m²/)).toBeInTheDocument()
    expect(screen.getByText(/1\.560,00\s*m²/)).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()

    // Editing a fact happens exclusively in Building & Scope now; the
    // "In Gebäude & Umfang prüfen" link is the only route there from here.
    const state = useStore.getState()
    expect(state.buildingReviews['DEMO-B-A']!.facts.bgfRSAbove.override).toBeNull()
    expect(state.buildingReviews['DEMO-B-B']!.facts.bgfRSAbove.override).toBeNull()
    await user.click(screen.getAllByRole('button', { name: 'In Gebäude & Umfang prüfen' })[0]!)
    expect(screen.getByRole('heading', { level: 1, name: 'Gebäude & Umfang' }))
      .toBeInTheDocument()
  })

  it('does not treat unrelated building price geometry as configuration consent', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    const before = useStore.getState().projection().result.total.exact
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    expect(useStore.getState().projection().result.total.exact.eq(before)).toBe(true)
    expect(useStore.getState().configurationModeChosen).toBe(false)
    expect(before.isPositive()).toBe(true)
  })

  it('keeps 4+ building views as an overflow tablist with manual activation', async () => {
    const user = userEvent.setup()
    const options = [
      { value: '__TOTAL__', label: 'Gesamt · 0 von 3 bestätigt' },
      { value: 'DEMO-B-A', label: 'Haus A · Offen' },
      { value: 'DEMO-B-B', label: 'Haus B · Bereit' },
      { value: 'DEMO-B-C', label: 'Haus C · Bestätigt' },
    ]

    function FourScopeHarness() {
      const [value, setValue] = useState('__TOTAL__')
      return (
        <>
          <ConfigurationScopeTabs
            legend="Konfigurationsumfang"
            value={value}
            options={options}
            onChoose={setValue}
          />
          <output data-testid="scope-value">{value}</output>
        </>
      )
    }

    render(<FourScopeHarness />)
    const tablist = screen.getByRole('tablist', { name: 'Konfigurationsumfang' })
    expect(tablist).toHaveClass('overflow-x-auto', 'flex-nowrap')
    expect(screen.queryByRole('combobox', { name: 'Konfigurationsumfang' })).toBeNull()
    for (const option of options) {
      expect(within(tablist).getByRole('tab', { name: option.label }))
        .toBeInTheDocument()
    }
    const total = within(tablist).getByRole('tab', { name: options[0]!.label })
    total.focus()
    await user.keyboard('{End}')
    const last = within(tablist).getByRole('tab', { name: options[3]!.label })
    expect(document.activeElement).toBe(last)
    expect(total).toHaveAttribute('aria-selected', 'true')
    await user.keyboard(' ')
    expect(last).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('scope-value')).toHaveTextContent('DEMO-B-C')
    expect(screen.getByRole('button', { name: 'Zum ersten Konfigurationsumfang' }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zum letzten Konfigurationsumfang' }))
      .toBeInTheDocument()
  })
})

/**
 * Task 02 (deep-coherence audit, F-01/F-02/F-15/F-17): reproduces the
 * audit's exact SHARED-mode scenario — Haus A keeps Untergeschoss
 * `vollausbau` (its fixture default), Haus B is set to `kein_ug` — and
 * asserts the contradiction (one building's state rendered as if it were
 * the option's own, unnamed) does NOT reproduce.
 */
describe('Task 02 — building-scope attribution in SHARED mode', () => {
  it('names every building in the Untergeschoss recap and decision, never one unnamed building standing in for the option', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => useStore.getState().setUntergeschoss('DEMO-B-B', 'kein_ug'))
    await user.click(nav(/Leistungen KG 300/))

    // F-01: both buildings' Untergeschoss state is visible, each naming its
    // own building — never a bare "Nicht enthalten"/"Enthalten" with no
    // building attribution standing in for the whole option.
    expect(screen.getByText('Untergeschoss · Haus A')).toBeInTheDocument()
    expect(screen.getByText('Untergeschoss · Haus B')).toBeInTheDocument()
    const recap = screen.getByRole('heading', { name: 'Untergeschoss', level: 2 }).closest('section')!
    expect(within(recap).getByText('Enthalten')).toBeInTheDocument()
    expect(within(recap).getByText('Nicht enthalten')).toBeInTheDocument()

    // F-02: the recap's cross-reference names the actual decision owner
    // ("Flächen im Detail"), not "Leistungsabgrenzung" (chapter 1), which
    // owns no Untergeschoss control at all.
    const goTo = within(recap).getByRole('button', { name: /Zu Kapitel \d+ · Flächen im Detail/ })
    expect(goTo).toBeInTheDocument()

    // F-15: "Flächen im Detail" itself shows both buildings' Untergeschoss
    // decision, each with its own explicit heading and independently
    // interactive control — not just the invisible active building.
    await user.click(goTo)
    expect(screen.getByRole('heading', { level: 2, name: 'Untergeschoss · Haus A' }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Untergeschoss · Haus B' }))
      .toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /vollständig inkl\. Gründung/, checked: true }))
      .toBeInTheDocument()

    // F-01 (recap/drivers): the priced Untergeschoss contribution names its
    // building in intern mode's "Im Angebot gewählt" recap.
    const buildingAware = screen.getByText('Untergeschoss · Rohbau und Ausbau')
      .closest('li')!
    expect(within(buildingAware).getByText(/· Haus A/)).toBeInTheDocument()
  })

  it('lists a schedule phase for every included building and the hero date matches the latest one (rule 39)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')
    includeCoreScope()
    await visitRequiredBuildingChapters(user)
    await user.click(nav(/Termine & Kommerzielles/))

    // F-17: the fixture's real per-building execution windows are both
    // read — Haus B's already ends later (2028-01-04) than Haus A's
    // (2027-11-19) — no building is silently dropped from the schedule.
    const table = screen.getByRole('table', {
      name: 'Bauzeit nach Phasen mit Beginn, Ende, Dauer und Abhängigkeit',
    })
    const executionRows = within(table).getAllByRole('row')
      .filter((row) => within(row).queryByRole('rowheader', { name: 'Rohbau + Ausbau' }))
    expect(executionRows).toHaveLength(2)
    expect(executionRows.map((row) => within(row).getAllByRole('cell')[0]!.textContent))
      .toEqual(expect.arrayContaining(['Haus A', 'Haus B']))
    // Rule 39: Fertigstellung is the LATEST building end, not Haus A's
    // (first in the buildings list) or a sum of the two.
    expect(screen.getByText(/Fertigstellung 04\.01\.2028/)).toBeInTheDocument()
    expect(screen.queryByText(/Fertigstellung 19\.11\.2027/)).toBeNull()
    expect(screen.getByText(/Fertigstellung bestimmt durch Haus B/)).toBeInTheDocument()
  })
})
