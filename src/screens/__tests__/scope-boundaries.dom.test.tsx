import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, activeBuilding, useStore } from '../../state/store'

/**
 * Leistungsabgrenzung / Scope Boundaries (тикет d21f8d48).
 *
 * Проверяет ровно то, что разрешил Product Decision Brief этого тикета:
 * KG 200/500/600 — настоящий трёхпозиционный выбор; KG 300/400/700 —
 * зафиксированные CheckboxCard-плитки (`mandatory`), которые нельзя снять
 * кликом, но которые остаются в Tab-порядке и называют причину текстом
 * («Pflicht»), а не выглядят `disabled`. Плюс: четвёртый Energiestandard
 * (EH 40 NH/QNG) и подтверждение с инвалидацией при изменении.
 */

beforeEach(() => __resetStoreForTests())

const nav = (name: RegExp) => screen.getAllByRole('button', { name })[0]!

async function openScopeBoundaries(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
  await user.click(screen.getByRole('radio', { name: /Gemeinsam konfigurieren/ }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
  await user.click(nav(/Leistungsabgrenzung/))
}

describe('Leistungsabgrenzung / Scope Boundaries (ticket d21f8d48)', () => {
  it('zeigt KG 300/400/700 als gesperrte, aber fokussierbare Pflicht-Kacheln', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    const journalBefore = useStore.getState().journal.length
    for (const kg of [/KG.300/, /KG.400/, /KG.700/]) {
      const tile = screen.getByRole('checkbox', { name: kg })
      expect(tile).toBeChecked()
      expect(tile).toHaveAttribute('aria-disabled', 'true')
      expect(tile).not.toBeDisabled() // bleibt im Tab-Vordergrund (OPTION-005)
      await user.click(tile)
      // Der eigentliche Vertrag ist Geschäftszustand, nicht die native
      // Checkbox-Eigenschaft (die manche Testumgebungen trotz
      // `preventDefault` mutieren): ein Klick auf eine Pflicht-Kachel darf
      // keine Coverage-Entscheidung auslösen — es gibt für sie gar keine.
      expect(useStore.getState().journal).toHaveLength(journalBefore)
    }
    expect(screen.getAllByText((_, el) => (el?.textContent ?? '').includes('Pflicht'))
      .length).toBeGreaterThanOrEqual(3)
  })

  it('lässt KG 200/500/600 als echten Dreifach-Zustand wählen (D-18)', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    const kg500 = screen.getByRole('radiogroup', { name: /KG.500/ })
    expect(useStore.getState().coverage.KG_500).toBe('unknown')
    const options = within(kg500).getAllByRole('radio')
    expect(options).toHaveLength(3)
    await user.click(options[0]!) // "enthalten"
    expect(useStore.getState().coverage.KG_500).toBe('included')
  })

  it('bietet den vierten Energiestandard EH 40 NH (QNG) als Kachel an', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    const es = screen.getByRole('radiogroup', { name: 'Energiestandard' })
    const tiles = within(es).getAllByRole('radio')
    expect(tiles).toHaveLength(4)
    await user.click(tiles[3]!)
    expect(activeBuilding(useStore.getState()).energiestandard).toBe('EH_40_NH')
  })

  it('bestätigt und invalidiert bei nachträglicher Änderung (Anforderung #6)', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    await user.click(screen.getByRole('button', { name: 'Bestätigen' }))
    expect(screen.getByText('Leistungsabgrenzung bestätigt.')).toBeInTheDocument()

    const kg600 = screen.getByRole('radiogroup', { name: /KG.600/ })
    await user.click(within(kg600).getAllByRole('radio')[1]!) // "nicht enthalten"
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()
    expect(screen.getByText(/erneut geprüft|geändert/))
      .toBeInTheDocument()
  })

  /**
   * Tech Review P0/P2 (ticket d21f8d48, commit 2871a63): every prior test in
   * this file ran with a single building, where SHARED and PER_BUILDING are
   * indistinguishable — exactly the gap that let `setEnergiestandard` ship
   * writing only the active building while this screen shows "gilt für den
   * gesamten Komplex" with no building tabs to reach the other one.
   */
  it('SHARED-Modus mit zwei Gebäuden: Energiestandard gilt komplexweit', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))
    act(() => useStore.getState().toggleBuildingIncluded('DEMO-B-B'))
    act(() => useStore.getState().confirmBuilding('DEMO-B-B'))
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    await user.click(screen.getByRole('radio', { name: /Gemeinsam konfigurieren/ }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    await user.click(nav(/Leistungsabgrenzung/))

    expect(useStore.getState().buildings['DEMO-B-A']!.energiestandard).toBe('EH_55')
    expect(useStore.getState().buildings['DEMO-B-B']!.energiestandard).toBe('EH_55')

    const es = screen.getByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!) // EH_40

    // No building tabs exist on this project-scoped chapter — the change
    // must reach BOTH buildings, not just whichever one was active.
    expect(useStore.getState().buildings['DEMO-B-A']!.energiestandard).toBe('EH_40')
    expect(useStore.getState().buildings['DEMO-B-B']!.energiestandard).toBe('EH_40')

    // Confirmation covers both buildings' requirements, not just the active one.
    await user.click(screen.getByRole('button', { name: 'Bestätigen' }))
    expect(screen.getByText('Leistungsabgrenzung bestätigt.')).toBeInTheDocument()
  })
})
