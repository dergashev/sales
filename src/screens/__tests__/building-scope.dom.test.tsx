import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
import {
  buildingConfirmed,
  __resetStoreForTests,
  useStore,
} from '../../state/store'

beforeEach(() => __resetStoreForTests())

async function openBuildingScope(user: ReturnType<typeof userEvent.setup>) {
  const view = render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
  return view
}

describe('Gebäude & Umfang — vorgeschalteter Option-Schritt', () => {
  it('startet ohne Preisoberfläche und lässt die Auswahl bis null reichen', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)

    expect(screen.getByRole('heading', { level: 1, name: 'Gebäude & Umfang' }))
      .toBeInTheDocument()
    const header = document.querySelector('.a3-global-header') as HTMLElement
    expect(within(header).queryByRole('group', { name: 'Ansicht' })).toBeNull()
    expect(within(screen.getByRole('navigation', { name: 'Navigation' }))
      .getByRole('group', { name: 'Ansicht' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(screen.getByText('Kalkulation noch nicht gestartet')).toBeInTheDocument()
    expect(screen.queryByText(/Gesamtpreis|Schätzunsicherheit|Bauzeit|Kostentreiber/))
      .toBeNull()

    await user.click(screen.getByRole('button', { name: 'Geschossstruktur' }))
    const storeySummary = document.querySelector(
      'dl[aria-label="Kompakte Geschossübersicht"]',
    ) as HTMLElement
    // F21: the empty-value marker now leads with "○ " so it reads as
    // visually distinct from a populated value (rule 8), not by colour alone.
    expect(within(storeySummary).getAllByText('○ Nicht erfasst')).toHaveLength(3)
    expect(within(storeySummary).queryByText('0', { exact: true })).toBeNull()

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

    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)

    const hausA = screen.getByRole('checkbox', { name: 'Haus A' })
    await user.click(hausA)
    await user.click(hausA)

    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)
    expect(screen.getByText('Gebäude bestätigt')).toBeInTheDocument()
  })

  it('bewahrt Abschnittsbestätigungen über Remounts und invalidiert sie nach Änderungen', async () => {
    const user = userEvent.setup()
    const view = await openBuildingScope(user)

    await user.click(screen.getByRole('button', { name: 'Abschnitt bestätigen' }))
    expect(useStore.getState().buildingSectionConfirmations['DEMO-B-A']?.identity)
      .toBeDefined()
    // F05: der Toast/Journal-Eintrag nennt den Anzeigenamen des Gebäudes,
    // nie die interne ID (gleiche Regel wie confirmBuilding()'s eigener
    // Toast weiter unten in diesem Test).
    expect(useStore.getState().journal.at(-1)?.label)
      .toBe('Gebäude Haus A · Abschnitt Identität bestätigt')
    expect(useStore.getState().journal.at(-1)?.label).not.toContain('DEMO-B-A')

    view.unmount()
    render(<App />)
    const identity = screen.getByRole('button', { name: 'Identität' }).closest('tr')!
    expect(within(identity).getByText('Bestätigt')).toBeInTheDocument()

    const documentationName = useStore.getState()
      .buildingReviews['DEMO-B-A']!.facts.documentationName
    const currentName = documentationName.override?.value
      ?? documentationName.extracted.value
      ?? 'Haus A'
    act(() => useStore.getState().setBuildingFactOverride(
      'DEMO-B-A', 'documentationName', `${currentName} Nord`,
    ))
    const changedIdentity = screen.getByRole('button', { name: 'Identität' }).closest('tr')!
    expect(within(changedIdentity).getByText('Geändert · erneut bestätigen'))
      .toBeInTheDocument()
  })

  it('übersetzt Kennzahlen und Sidebar-Gruppen ohne Profilbegriffe als Überschriften', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)

    const header = document.querySelector('.a3-global-header') as HTMLElement
    await user.click(within(header).getByRole('radio', { name: 'EN' }))

    expect(screen.queryByText('BGF gesamt')).toBeNull()
    expect(screen.getAllByText('GFA R+S · total').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Living area under WoFlV').length).toBeGreaterThan(0)
    const navigation = screen.getByRole('navigation', { name: 'Navigation' })
    expect(within(navigation).getByText('Current option')).toBeInTheDocument()
    expect(within(navigation).queryByText('Client view', { selector: 'p' })).toBeNull()
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
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('checkbox', { name: 'Haus B' }))

    const tablist = screen.getByRole('tablist', { name: 'Gewählte Gebäude' })
    const hausBTab = within(tablist).getByRole('tab', { name: /Haus B/ })
    await user.click(hausBTab)
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-B')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Identität' }))
    const name = screen.getByRole('textbox', { name: 'Bezeichnung aus der Dokumentation' })
    await user.clear(name)
    await user.type(name, 'Haus B West')
    await user.click(screen.getByRole('button', {
      name: 'Angabe übernehmen: Bezeichnung aus der Dokumentation',
    }))

    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-B')).toBe(false)
    expect(screen.getByText('Geändert · erneut bestätigen')).toBeInTheDocument()
    expect(screen.getByText(/Bestätigung aufgehoben.*Haus B West/))
      .toBeInTheDocument()
  })

  it('bleibt auch in der Kundenansicht eine reine Vor-Kalkulationsfläche', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    await user.click(screen.getByRole('button', { name: /^1Gebäude & Umfang$/ }))

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
