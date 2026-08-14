import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  ConfigurationScopeControl,
  configurationScopeControlFor,
} from '../S3Konfigurator'
import {
  __resetStoreForTests,
  choicesFor,
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
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  if (buildingCount === 2) {
    const tabs = screen.getByRole('tablist', { name: 'Gewählte Gebäude' })
    await user.click(within(tabs).getByRole('tab', { name: /Haus B/ }))
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

async function visitRequiredBuildingChapters(user: ReturnType<typeof userEvent.setup>) {
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
    expect(screen.queryByRole('button', { name: /Leistungen KG 300/ })).toBeNull()

    const beforeJournal = useStore.getState().journal.length
    await user.click(screen.getByRole('radio', { name: 'Gemeinsam konfigurieren' }))

    expect(useStore.getState().journal).toHaveLength(beforeJournal)
    expect(useStore.getState().activeDelta).toBeNull()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    expect(useStore.getState().configurationModeChosen).toBe(true)
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungen KG 300' }))
      .toHaveFocus()
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Modus ändern' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Konfigurationsmodus wählen' }))
      .toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Gemeinsam konfigurieren' })).toBeChecked()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    expect(useStore.getState().configurationMode).toBe('PER_BUILDING')
    expect(useStore.getState().configurationModeChosen).toBe(true)
  })

  it('keeps shared choices common while building facts and costs remain separate', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'SHARED')

    expect(screen.queryByRole('radiogroup', { name: 'Konfigurationsumfang' })).toBeNull()
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
    expect(screen.getByRole('button', { name: 'Gemeinsame Konfiguration bestätigen' }))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', {
      name: 'Gemeinsame Konfiguration bestätigen',
    }))
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-A'))
      .toBe('confirmed')
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-B'))
      .toBe('confirmed')
  })

  it('isolates per-building progress and atomically aligns edit and offer scope', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'PER_BUILDING')

    expect(useStore.getState().journal.at(-1)).toMatchObject({
      label: 'Konfiguration je Gebäude bestätigt',
      deltaExact: null,
    })

    const switcher = screen.getByRole('radiogroup', { name: 'Konfigurationsumfang' })
    expect(within(switcher).getByRole('radio', { name: /Haus B · Offen/ })).toBeChecked()
    await visitRequiredBuildingChapters(user)
    expect(within(switcher).getByRole('radio', { name: /Haus B · Bereit/ }))
      .toBeInTheDocument()
    await user.click(screen.getByRole('button', {
      name: 'Konfiguration für Haus B bestätigen',
    }))
    expect(within(switcher).getByRole('radio', { name: /Haus B · Bestätigt/ }))
      .toBeInTheDocument()

    const beforeSwitchJournal = useStore.getState().journal.length
    const hausA = within(switcher).getByRole('radio', { name: /Haus A · Offen/ })
    await user.click(hausA)
    expect(document.activeElement).toBe(hausA)
    expect(useStore.getState().activeBuildingId).toBe('DEMO-B-A')
    expect(useStore.getState().scopeBuildingId).toBe('DEMO-B-A')
    expect(useStore.getState().journal).toHaveLength(beforeSwitchJournal)
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-B'))
      .toBe('confirmed')
    expect(configurationDisplayStatusFor(useStore.getState(), 'DEMO-B-A')).toBe('open')

    await user.click(nav(/Leistungsabgrenzung/))
    expect(screen.queryByRole('radiogroup', { name: 'Konfigurationsumfang' })).toBeNull()
    expect(screen.getByText('Gilt für den gesamten Komplex')).toBeInTheDocument()
    expect(useStore.getState().activeBuildingId).toBe('DEMO-B-A')
    expect(useStore.getState().scopeBuildingId).toBeNull()

    await user.click(nav(/Leistungen KG 300/))
    const restored = screen.getByRole('radiogroup', { name: 'Konfigurationsumfang' })
    expect(within(restored).getByRole('radio', { name: /Haus A · Offen/ })).toBeChecked()

    const current = within(restored).getByRole('radio', { name: /Haus A · Offen/ })
    current.focus()
    await user.keyboard('{Home}')
    expect(within(restored).getByRole('radio', { name: /Gesamt · 1 von 2 bestätigt/ }))
      .toBeChecked()
    expect(screen.getByRole('heading', { level: 2, name: 'Konfigurationsstand' }))
      .toBeInTheDocument()
    await user.keyboard('{End}')
    expect(within(restored).getByRole('radio', { name: /Haus B · Bestätigt/ }))
      .toBeChecked()
  })

  it('keeps narrowed pricing qualified and restores the complex before export', async () => {
    const user = userEvent.setup()
    await openModeStep(user, 2)
    await startMode(user, 'PER_BUILDING')
    act(() => useStore.getState().setCoverage('KG_500', 'excluded'))

    const switcher = screen.getByRole('radiogroup', { name: 'Konfigurationsumfang' })
    await user.click(within(switcher).getByRole('radio', {
      name: /Gesamt · 0 von 2 bestätigt/,
    }))
    const complex = useStore.getState().projection().result
    expect(complex.totalLabel).toBe('Gesamt netto · Grundleistung All3')

    await user.click(within(switcher).getByRole('radio', { name: /Haus A · Offen/ }))
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

    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    expect(screen.getByText('Erneut prüfen')).toBeInTheDocument()
    expect(screen.queryByText('Die sichtbare Konfiguration ist bestätigt.')).toBeNull()
    expect(screen.getByRole('button', {
      name: 'Konfiguration für Haus A Nord bestätigen',
    })).toBeInTheDocument()
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

  it('uses the canonical select fallback once total plus buildings exceed three options', () => {
    expect(configurationScopeControlFor(3)).toBe('segmented')
    expect(configurationScopeControlFor(4)).toBe('select')
  })

  it('renders the 4+ scope fallback with status names and a working scope change', async () => {
    const user = userEvent.setup()
    const options = [
      { value: '__TOTAL__', label: 'Gesamt · 0 von 3 bestätigt', status: '0 / 3' },
      { value: 'DEMO-B-A', label: 'Haus A · Offen', status: 'Offen' },
      { value: 'DEMO-B-B', label: 'Haus B · Bereit', status: 'Bereit' },
      { value: 'DEMO-B-C', label: 'Haus C · Bestätigt', status: 'Bestätigt' },
    ]

    function FourScopeHarness() {
      const s = useStore()
      return (
        <ConfigurationScopeControl
          legend="Konfigurationsumfang"
          selectLabel="Konfigurationsumfang"
          value={s.scopeBuildingId ?? '__TOTAL__'}
          options={options}
          onChoose={(value) => s.setConfigurationScope(
            value === '__TOTAL__' ? null : value,
          )}
        />
      )
    }

    render(<FourScopeHarness />)
    const select = screen.getByRole('combobox', { name: 'Konfigurationsumfang' })
    for (const option of options) {
      expect(within(select).getByRole('option', { name: option.label }))
        .toBeInTheDocument()
    }
    await user.selectOptions(select, 'DEMO-B-A')
    expect(useStore.getState().scopeBuildingId).toBe('DEMO-B-A')
    expect(select).toHaveValue('DEMO-B-A')
  })
})
