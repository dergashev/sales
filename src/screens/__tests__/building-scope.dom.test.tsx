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

    // Task 02 (F-22): sections no longer have an independent confirm
    // action — the single "Gebäude bestätigen" click now confirms every
    // ready section (each still gets its own fingerprint/journal event)
    // AND finalizes the building in one action.
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    expect(useStore.getState().buildingSectionConfirmations['DEMO-B-A']?.identity)
      .toBeDefined()
    // F05: der Toast/Journal-Eintrag nennt den Anzeigenamen des Gebäudes,
    // nie die interne ID (gleiche Regel wie confirmBuilding()'s eigener
    // Toast). The section confirmation is no longer necessarily the LAST
    // journal entry (the building-level confirmation follows it in the
    // same click) — assert its presence anywhere in the journal instead.
    expect(useStore.getState().journal.some((e) =>
      e.label === 'Gebäude Haus A · Abschnitt Identität bestätigt')).toBe(true)
    expect(useStore.getState().journal.every((e) => !e.label.includes('DEMO-B-A')))
      .toBe(true)

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

  // Task 02 (deep-coherence audit, F-22): the review-section ladder is
  // status-only now; "Gebäude bestätigen" alone confirms every ready
  // section and finalizes the building. AC5: exactly one confirmation
  // action per building — total for Nordfeld's two buildings must be ≤ 3
  // (today before this fix: 8).
  it('confirms a fully-documented building in exactly one action, and both of Nordfeld\'s buildings in two total', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)

    expect(screen.queryByRole('button', { name: 'Abschnitt bestätigen' })).toBeNull()
    let confirmClicks = 0

    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    confirmClicks += 1
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-A')).toBe(true)

    await user.click(screen.getByRole('checkbox', { name: 'Haus B' }))
    const tablist = screen.getByRole('tablist', { name: 'Gewählte Gebäude' })
    await user.click(within(tablist).getByRole('tab', { name: /Haus B/ }))
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    confirmClicks += 1
    expect(buildingConfirmed(useStore.getState(), 'DEMO-B-B')).toBe(true)

    expect(confirmClicks).toBe(2)
    expect(confirmClicks).toBeLessThanOrEqual(3)
    // Every section still got its own fingerprint/journal event — the
    // change is which user action triggers them, not whether they happen.
    expect(useStore.getState().buildingSectionConfirmations['DEMO-B-A']).toMatchObject({
      identity: expect.anything(),
      areas: expect.anything(),
      storeys: expect.anything(),
    })
    expect(useStore.getState().buildingSectionConfirmations['DEMO-B-B']).toMatchObject({
      identity: expect.anything(),
      areas: expect.anything(),
      storeys: expect.anything(),
    })
  })

  // Task 02 (deep-coherence audit, F-23): "Angabe übernehmen" used to be
  // always-enabled and only discover a no-op AFTER the click, rendering
  // the captured error "Mindestens eine Geschossart muss eine Anzahl
  // größer als null haben." for a click that changed nothing.
  it('disables "Angabe übernehmen" for Geschossstruktur with a visible reason instead of erroring after a no-op click', async () => {
    const user = userEvent.setup()
    await openBuildingScope(user)

    await user.click(screen.getByRole('button', { name: 'Geschossstruktur' }))
    await user.click(screen.getByText('Detaillierte Aufteilung bearbeiten'))
    for (const label of [
      'Untergeschosse (UG)', 'Erdgeschosse (EG)', 'Obergeschosse (OG)', 'Staffelgeschosse (SG)',
    ]) {
      const input = screen.queryByRole('spinbutton', { name: label })
      if (input) await user.clear(input)
    }

    const apply = screen.getByRole('button', {
      name: 'Angabe übernehmen: Geschossstruktur',
    })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
    expect(apply).toHaveAttribute('aria-describedby')
    const reasonId = apply.getAttribute('aria-describedby')!
    expect(document.getElementById(reasonId)?.textContent)
      .toMatch(/Geschossart.*größer als null/)

    const before = useStore.getState().buildingReviews['DEMO-B-A']!.facts.storeyStructure.override
    await user.click(apply)
    // The no-op click produced neither an override write nor an alert —
    // disabled means disabled, not "click and then explain what happened".
    expect(useStore.getState().buildingReviews['DEMO-B-A']!.facts.storeyStructure.override)
      .toBe(before)
    // No NEW alert appeared from the click itself (a pre-existing, unrelated
    // font-loading banner is always present in this test environment).
    expect(screen.queryAllByRole('alert').some((el) =>
      /Geschossart.*größer als null/.test(el.textContent ?? ''))).toBe(false)
  })
})
