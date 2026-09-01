import { beforeEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { Decimal } from 'decimal.js'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections, confirmWholeConfiguration } from '../../test/offer-option'
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
    // Acceptance remediation (cycle 5): building inclusion is now behind the
    // "Gebäude verwalten" disclosure, closed by default once a building is
    // already selected.
    await user.click(screen.getByRole('button', { name: 'Gebäude verwalten' }))
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
  // "Rebuild Project Card Workflow" Parts 15/16 remove Energie &
  // Zertifikate and Flächen im Detail as Configurator steps entirely —
  // only the two remaining building-scoped chapters need a visit now.
  await user.click(nav(/Leistungen KG 300/))
  await user.click(nav(/Technik KG 400/))
}

describe('Konfigurator mode entry and building-aware navigation', () => {
  it('starts with a truly unselected inline step and no pricing or journal mutation', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)

    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
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
    const workflowNav = document.querySelector<HTMLElement>('.a3-wfs-chapter')!
    // KG 300/400/700 are mandatory ("Rebuild Project Card Workflow" #16) —
    // included by default, so their chapters are always in the workflow;
    // Energie & Zertifikate and Flächen im Detail no longer exist as
    // Configurator steps at all (Parts 15/16).
    expect(within(workflowNav).getAllByRole('button').map((button) =>
      button.querySelector('.a3-wfs-label')?.textContent)).toEqual([
      'Leistungsabgrenzung',
      'Leistungen KG 300',
      'Technik KG 400',
      'Baunebenkosten KG 700',
      'Termine',
    ])
    expect(screen.queryByRole('button', { name: /Baugrund & Erschließung/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Energie & Zertifikate/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Flächen im Detail/ })).toBeNull()
    expect(screen.getByText('Kapitel 1 von 5 · Konfigurator')).toBeInTheDocument()
    // Leistungsabgrenzung is project-level, not building-scoped: no per-
    // building tabs, no per-building readiness detail on this chapter.
    expect(screen.getByText('Gilt für den gesamten Komplex')).toBeInTheDocument()
    expect(screen.queryByText(/Gebäudeschritte 1, 3, 4 und 5/)).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()
    expect(screen.queryByText('Kalkulation noch nicht gestartet')).toBeNull()

    includeCoreScope()

    await user.click(nav(/Variantenvergleich/))
    // VO-T5 / AC-17: the comparison is a full-width decision surface, so
    // both operational rails are intentionally absent on this route.
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Vergleichsnavigation' }))
      .toBeInTheDocument()
    await user.click(nav(/Konfigurator/))
    await user.click(nav(/Leistungen KG 300/))
    // Only two building-scoped chapters remain (Energie & Zertifikate and
    // Flächen im Detail are gone) — `Intl.ListFormat` joins exactly two
    // items with "und", not a comma.
    expect(screen.getByText(/Leistungen KG 300 und Technik KG 400/)).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Modus ändern' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
      .toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Gemeinsam konfigurieren' })).toBeChecked()
    // SIDEBAR 01 (backlog eda1e221, SB-27, AC-11): editing an already-priced
    // offer's mode used to hide the whole Angebot panel — a 6.082.000 €
    // total disappearing from the rail on a screen whose purpose is a
    // commercially consequential decision. The panel now stays (Level 1
    // only, `variant="level1"`), and the mode-change notice is ADDED beside
    // it, not substituted for it.
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()
    expect(useStore.getState().pricingStarted).toBe(true)
    // Task 03 (deep-coherence audit, F-24): re-entering mode choice/edit
    // with an existing calculation must say so truthfully, not claim the
    // calculation never started.
    expect(screen.getByText('Kalkulation vorhanden')).toBeInTheDocument()
    expect(screen.queryByText('Kalkulation noch nicht gestartet')).toBeNull()
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
    // Task 03 (F-25): exactly one mode banner per chapter now, not two
    // back-to-back copies of the same sentence.
    expect(screen.getAllByText(/Gemeinsame Konfiguration · gilt für Haus A und Haus B/))
      .toHaveLength(1)

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
    // Chapter numbering shifted once Energie & Zertifikate (former 4) and
    // Flächen im Detail (former 5) were removed — Baunebenkosten KG 700 is
    // now chapter 4, not 6.
    expect(nav(/Weiter · Kapitel 4: Baunebenkosten KG 700/)).toHaveClass('a3-sec')
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

    // Task 03 (F-16/PD-3): Export now requires Scope Boundaries confirmed
    // and every included building's configuration confirmed — this test's
    // subject is sending/snapshotting, not that gate itself.
    confirmWholeConfiguration()
    await user.click(nav(/Export/))
    await user.click(screen.getByRole('button', { name: 'Angebot prüfen' }))
    await user.click(screen.getByRole('button', { name: /Prüfung bestanden/ }))
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
    // Acceptance remediation (cycle 6): "Identität & Nutzung" now renders a
    // read-only summary by default — the edit fields need their own
    // "Abschnitt bearbeiten" click first.
    await user.click(screen.getByRole('button', { name: 'Abschnitt bearbeiten: Identität & Nutzung' }))
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

  // "Rebuild Project Card Workflow" Part 16 removes the standalone
  // "Flächen im Detail" Configurator chapter this test used to exercise
  // entirely — Building Scope (`building-scope.dom.test.tsx`) already
  // covers per-building read-only/editable area facts as the sole
  // authoritative surface; there is no second Configurator-side location
  // left to test facts binding against any more.

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

    // "Rebuild Project Card Workflow" Part 16: "Flächen im Detail" is
    // removed; the recap's cross-reference now names its actual current
    // owner, Building & Scope (same link text every other building-level
    // fact in this product already uses).
    const goTo = within(recap).getByRole('button', { name: 'In Gebäude & Umfang prüfen' })
    expect(goTo).toBeInTheDocument()

    // Building & Scope shows both buildings' Untergeschoss decision, each
    // independently interactive — not just the invisible active building.
    // (Verified in a separate isolated flow below; navigating there here
    // would leave the Configurator offer panel this test still needs.)

    // F-01 (recap/drivers): the priced Untergeschoss contribution names its
    // building — SIDEBAR 01 merged the former standalone "Im Angebot
    // gewählt" recap into the KG 300 group's own expandable children
    // (Level 2, SB-03), collapsed by default, so the group is opened first.
    await user.click(screen.getByRole('button', { name: /Baukonstruktion/ }))
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
    await user.click(nav(/Termine/))

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

/**
 * SIDEBAR 02 (backlog 41b8ab39): the rail names its scope, its basis and
 * its completeness. Reuses this file's own `openModeStep`/`startMode`/
 * `includeCoreScope` harness rather than duplicating it — these tests are
 * fundamentally about the rail's behaviour under SHARED/PER_BUILDING mode,
 * this file's existing subject.
 */
describe('SIDEBAR 02 (backlog 41b8ab39): rail scope, completeness and signed-money consistency', () => {
  // "Rebuild Project Card Workflow" #16 supersedes the 22.08.2026 "no KG
  // mandatory" decision this test used to exercise: KG 300/400/700 are
  // mandatory and always included, so a genuinely empty scope (SB-05/SB-07's
  // "Noch keine Kostengruppe im Angebot enthalten") is no longer a reachable
  // state — the mandatory core always produces a real, non-zero offer the
  // moment Scope Boundaries is confirmed. The truthful-empty-state
  // presentation logic itself (rule 16, F-10) is unit-tested independently
  // in `store.test.ts` and remains correct; it simply has no live trigger
  // through this UI any more.
  it('a fresh option immediately has a real, non-empty offer — the mandatory core alone already produces oberirdisch/unterirdisch content, never the empty-scope sentence', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    expect(within(rail).queryByText('Noch keine Kostengruppe im Angebot enthalten.')).toBeNull()
  })

  it('KG 500 included without a quantity: the row states "Preis nicht ermittelt" and the label switches to Zwischensumme (SB-06/AC-4)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().setCoverage('KG_500', 'included') })
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    expect(within(rail).getAllByText('Preis nicht ermittelt').length).toBeGreaterThanOrEqual(1)
    expect(within(rail).getAllByText(/Zwischensumme der kalkulierten Positionen/).length)
      .toBeGreaterThanOrEqual(1)
    // AC-3: completeness line names the unpriced group.
    expect(within(rail).getByText(/1 ohne Preisansatz/)).toBeInTheDocument()
  })

  it("the amount's commercial name is identical in the hero, the KG total row and the drivers-table caption (SB-08/AC-2)", async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().confirmGebaeudeklasse() })
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    // Hero + KG total row both read the exact same string.
    expect(within(rail).getAllByText('Gesamt netto · Grundleistung All3').length)
      .toBeGreaterThanOrEqual(2)
    // The screen-reader caption (Level 3, now the canonical "Learn More /
    // See Details" `Dialog` — portalled outside the rail's own subtree, so
    // it is looked up on its own role rather than `within(rail)`) embeds
    // that SAME string, never a second, hardcoded commercial claim.
    await user.click(within(rail).getByRole('button', { name: 'Alle Details ansehen' }))
    const detailsDialog = screen.getByRole('dialog', { name: 'Nachweise & Verlauf' })
    expect(within(detailsDialog).getByText(
      /Beiträge summieren sich exakt zur Gesamt netto · Grundleistung All3\./,
    )).toBeInTheDocument()
  })

  it('no ASCII hyphen sits next to a digit anywhere in the rail — one signed-money formatter everywhere (SB-23/AC-7)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => {
      useStore.getState().confirmGebaeudeklasse()
      // Exercises the discount row's own signed cell — the exact call site
      // SB-23 found composing the sign BEFORE `moneyLabel()`'s `≈` prefix.
      useStore.getState().setDiscount(new Decimal('5'))
    })
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    expect(/[-‐‑](?=\d)|\d[-‐‑]/.test(rail.textContent ?? '')).toBe(false)
  })

  it('PER_BUILDING: switching the DC-46 tab shows an always-first scope tag and keeps the offer total visible under a building subtotal (SB-09/SB-10/AC-1)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'PER_BUILDING')
    includeCoreScope()
    await user.click(nav(/Leistungen KG 300/))
    const switcher = screen.getByRole('tablist', { name: 'Konfigurationsumfang' })
    await user.click(within(switcher).getByRole('tab', { name: /Haus B/ }))
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    // The scope tag names the narrowed building — a NEW element, separate
    // from the amount's own commercial name (still "Gesamt netto ·
    // Grundleistung All3 · Haus B" underneath, unchanged, AC-2).
    expect(within(rail).getByText('Haus B')).toBeInTheDocument()
    // The offer total (both buildings, independent of the DC-46 reading
    // lens) stays on screen while a building subtotal is shown.
    expect(within(rail).getByText(/Angebot gesamt/)).toBeInTheDocument()
  })

  it('the completeness line states decided/calculated/unpriced counts (AC-3)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    act(() => {
      useStore.getState().confirmGebaeudeklasse()
    })
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    // Binary-scope contract: every group is always DECIDED (`included` or
    // `excluded`, never `unknown`), so "decided" reads 6/6 — one fewer
    // group than before KG 800 was removed as a Scope Boundaries decision
    // ("Rebuild Project Card Workflow" #13) — from the very first
    // inclusion. KG 300/400/700 are mandatory and already `included` by
    // default, so all three are already "kalkuliert" here.
    expect(within(rail).getByText(
      '6 von 6 Kostengruppen entschieden · 3 kalkuliert · 0 ohne Preisansatz',
    )).toBeInTheDocument()
  })

  // "Rebuild Project Card Workflow" #16 makes KG 400 mandatory — it can no
  // longer be excluded, so the D-07 rule 6 auto-fallback cascade this test
  // exercised (excluding a core group -> kg700Mode switches to `hoaiAho`)
  // is now unreachable through the UI. The underlying reducer branch was
  // removed as dead code in the same change (`store.ts`'s `setCoverage`);
  // see `store.test.ts` for the guard regression coverage. The changed-row
  // diff mechanism itself (Level 2 "geändert" marking) remains exercised
  // by other tests in this file using genuinely excludable groups.
})

/**
 * SIDEBAR 03 (backlog 2be8e69c): the rail's client/locale/a11y boundary.
 * Reuses this file's own two-building SHARED-mode harness — the Nordfeld
 * fixture already gives both buildings the same Energiestandard EH 55
 * choice, which is exactly the audit's own reproduction of SB-13.
 */
describe('SIDEBAR 03 (backlog 2be8e69c): client-safe rail, EN localization', () => {
  it('aggregates same-label per-building contributions into one row in Kundenansicht, with no building identifier (SB-13/AC-1)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')
    includeCoreScope()
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    await user.click(within(rail).getByRole('button', { name: /KG.300/ }))

    // Vorbereitung: R-25 attribution names each building — two separate
    // rows for the same option, exactly what the audit measured.
    expect(within(rail).getAllByText(/Energiestandard EH 55/).length).toBeGreaterThanOrEqual(2)
    expect(within(rail).getAllByText(/Haus A/).length).toBeGreaterThanOrEqual(1)
    expect(within(rail).getAllByText(/Haus B/).length).toBeGreaterThanOrEqual(1)

    act(() => {
      useStore.getState().confirmGebaeudeklasse()
    })
    // REDESIGN R3 WAVE 2a (ce17da51): entering Kundenansicht now requires
    // the Option to be client-eligible (PD-3 readiness), or
    // PresentationShell renders its own "noch keine Option bereit" state
    // instead of the narrative this assertion needs.
    confirmWholeConfiguration()
    act(() => {
      useStore.getState().setMode('praesentation')
    })

    // Kundenansicht: R-25 strips the building suffix — SB-13 requires the
    // two contributions to aggregate into exactly one row rather than
    // surviving as an unlabelled duplicate. The Kostentreiber-Auszug that
    // used to live in OfferPanel's rail now lives in PresentationShell's
    // §3 Ergebnis (the rail itself unmounts in Kundenansicht — the stale
    // `rail` reference above would only show the frozen pre-switch DOM,
    // never prove anything about the new client surface).
    //
    // VR2-06: the narrative shell shows one full-bleed page at a time — §3
    // Ergebnis only mounts once its tab is active, and the entry point
    // after `setMode('praesentation')` is always §1 Projekt, so navigate
    // there first (its cross-fade resolves on a real timer tick, not
    // synchronously, per `src/test/setup.ts`'s `requestAnimationFrame`
    // polyfill).
    await user.click(screen.getByRole('button', { name: 'Ergebnis' }))
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Ergebnis' })).toBeInTheDocument()
    })
    const ergebnis = screen.getByRole('region', { name: 'Ergebnis' })
    expect(within(ergebnis).getAllByText(/Energiestandard EH 55/).length).toBe(1)
    expect(within(ergebnis).queryByText('Haus A')).toBeNull()
    expect(within(ergebnis).queryByText('Haus B')).toBeNull()
  })

  it('lang follows the UI locale inside the rail, and the ⚙ marker never appears without its legend (SB-14/SB-15)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().confirmGebaeudeklasse() })
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)
    expect(document.documentElement.lang).toBe('en')

    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    if (rail.textContent?.includes('⚙')) {
      expect(within(rail).getByText(/derived for the prototype, not calibrated/)).toBeInTheDocument()
    }
  })

  it('translates per-building driver labels in EN even with 2+ buildings included (SB-14, live Playwright finding)', async () => {
    // Regression guard for a defect only the browser pass caught (not the
    // jsdom SB-13 test above, which never checked EN): `computeProjection`
    // prefixes every driver's `key` with its building id whenever more
    // than one building is included, which used to defeat
    // `translatedDriverLabel`'s key-pattern matching and silently fall
    // back to raw German for EVERY driver in ANY multi-building project.
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().confirmGebaeudeklasse() })
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    await user.click(within(rail).getByRole('button', { name: 'Show all details' }))
    const detailsDialog = screen.getByRole('dialog', { name: 'Nachweise & Verlauf' })
    expect(within(detailsDialog).getAllByText(/Basement · shell and fit-out/).length).toBeGreaterThanOrEqual(1)
    expect(within(detailsDialog).getAllByText(/Underground garage · ventilation, floor coating, doors/).length)
      .toBeGreaterThanOrEqual(1)
    expect(detailsDialog.textContent).not.toMatch(/Rohbau und Ausbau/)
    expect(detailsDialog.textContent).not.toMatch(/Lüftung, OS-Beschichtung, Tore/)
  })

  it('the driver-row accessible name has no untranslated German connector words in EN (QA rework: rund/exakt regression)', async () => {
    // QA finding on the first candidate: the sr-only accessible name
    // (DRIVER-004) localized the rounded/exact VALUES via
    // localizeMoneyText but left the surrounding words "rund"/"exakt"
    // hardcoded German — audible to screen readers in EN even though the
    // visible text was already correct. `.textContent` (unlike Playwright's
    // visibility-aware innerText) reaches the sr-only span directly, so
    // this is the right assertion surface for this exact regression.
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().confirmGebaeudeklasse() })
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    await user.click(within(rail).getByRole('button', { name: 'Show all details' }))
    const detailsDialog = screen.getByRole('dialog', { name: 'Nachweise & Verlauf' })
    expect(detailsDialog.textContent).not.toMatch(/\brund\b/)
    expect(detailsDialog.textContent).not.toMatch(/\bexakt\b/)
  })

  it('the Kostentreiber benchmark line and its internal snapshot id are gone (SB-12/AC-5)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().confirmGebaeudeklasse() })
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    await user.click(within(rail).getByRole('button', { name: 'Alle Details ansehen' }))
    const detailsDialog = screen.getByRole('dialog', { name: 'Nachweise & Verlauf' })
    expect(detailsDialog.textContent).not.toMatch(/BM-BKI-2026Q1-SYNTH/)
    expect(detailsDialog.textContent).not.toMatch(/nicht vergleichbar/)
  })

  it('.a3-ghost no longer resolves to the DC-28 preview — only the tertiary button variant (SB-30)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    const matches = document.querySelectorAll('.a3-ghost')
    for (const el of matches) {
      expect(el.tagName).toBe('BUTTON')
    }
  })

  it('the rail exposes a non-skipping heading hierarchy reaching the amount, Leitkennzahl, Bauzeit and composition (SB-29/AC-9)', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 1)
    await startMode(user, 'SHARED')
    includeCoreScope()
    act(() => { useStore.getState().confirmGebaeudeklasse() })
    const rail = screen.getByRole('complementary', { name: 'Angebot' })
    const headings = within(rail).getAllByRole('heading')
    const levels = headings.map((h) => Number(h.tagName.slice(1)))
    // Exactly one rail-root h2; every other rail heading sits one level
    // under it (h3), never skipping straight to h4+.
    expect(levels.filter((l) => l === 2)).toHaveLength(1)
    expect(levels.every((l) => l === 2 || l === 3)).toBe(true)
    expect(within(rail).getByRole('heading', { name: 'Angebot', level: 2 })).toBeInTheDocument()
  })
})
