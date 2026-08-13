import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  buildingConfirmed,
  __resetStoreForTests,
  useStore,
} from '../../state/store'

beforeEach(() => __resetStoreForTests())

async function openBuildingScope(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
}

describe('Gebäude & Umfang — vorgeschalteter Option-Schritt', () => {
  it('startet ohne Preisoberfläche und lässt die Auswahl bis null reichen', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)

    expect(screen.getByRole('heading', { level: 1, name: 'Gebäude & Umfang' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
    expect(screen.queryByText(/Gesamtpreis|Schätzunsicherheit|Bauzeit|Kostentreiber/))
      .toBeNull()

    const hausA = screen.getByRole('checkbox', { name: 'Haus A' })
    expect(hausA).toBeChecked()
    await user.click(hausA)

    expect(screen.getAllByRole('checkbox').every((item) => !(item as HTMLInputElement).checked))
      .toBe(true)
    expect(screen.getByText(/Noch kein Gebäude ausgewählt/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^2Konfigurator$/ }))
      .toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByText(/0\s*€/)).toBeNull()
  })

  it('bewahrt bestätigte Fakten beim Ab- und Wiederanwählen', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)

    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)

    const hausA = screen.getByRole('checkbox', { name: 'Haus A' })
    await user.click(hausA)
    await user.click(hausA)

    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)
    expect(screen.getByText('Gebäude bestätigt')).toBeInTheDocument()
  })

  it('verwendet manuell aktivierte Tabs mit roving tabindex', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)
    await user.click(screen.getByRole('checkbox', { name: 'Haus B' }))

    const tablist = screen.getByRole('tablist', { name: 'Gewählte Gebäude' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('aria-posinset', '1')
    expect(tabs[0]).toHaveAttribute('aria-setsize', '2')
    expect(tabs[1]).toHaveAttribute('aria-posinset', '2')

    tabs[0]!.focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Enter}')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[1]!.id)

    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(tabs[0])
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('ungültigt bei einer Korrektur nur das bearbeitete Gebäude', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('checkbox', { name: 'Haus B' }))

    const tablist = screen.getByRole('tablist', { name: 'Gewählte Gebäude' })
    const hausBTab = within(tablist).getByRole('tab', { name: /Haus B/ })
    await user.click(hausBTab)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-B')).toBe(true)

    const name = screen.getByRole('textbox', { name: 'Bezeichnung aus der Dokumentation' })
    await user.clear(name)
    await user.type(name, 'Haus B West')
    await user.click(screen.getByRole('button', {
      name: 'Angabe übernehmen: Bezeichnung aus der Dokumentation',
    }))

    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-B')).toBe(false)
    expect(screen.getByText(/Bestätigung aufgehoben.*Haus B West/))
      .toBeInTheDocument()
  })

  it('bleibt auch in der Kundenansicht eine reine Vor-Kalkulationsfläche', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))

    const profile = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(profile).getByRole('radio', { name: 'Kundenansicht' }))
    const gate = screen.getByRole('dialog', { name: /Bereit für die Präsentation/ })
    expect(within(gate).queryByText(/€|Schätzunsicherheit|Bauzeit|Kostentreiber|KG 700/))
      .toBeNull()
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Gebäude & Umfang' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
    expect(screen.queryByText(/Gesamtpreis|Schätzunsicherheit|Bauzeit|Kostentreiber|KG 300/))
      .toBeNull()
  })
})
