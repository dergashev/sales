import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, activeBuilding, useStore } from '../../state/store'

/**
 * Leistungsabgrenzung / Scope Boundaries (тикет d21f8d48).
 *
 * Every offered cost group uses the same binary scope decision. Core-group
 * exclusion also exercises the approved D-07 calculation fallback.
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
  it('renders all six groups as binary decisions and applies the D-07 fallback', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    for (const kg of [/KG.200/, /KG.300/, /KG.400/, /KG.500/, /KG.600/, /KG.700/]) {
      expect(within(screen.getByRole('radiogroup', { name: kg })).getAllByRole('radio'))
        .toHaveLength(2)
    }
    const totalBefore = useStore.getState().projection().result.total.exact
    const kg300 = screen.getByRole('radiogroup', { name: /KG.300/ })
    await user.click(within(kg300).getAllByRole('radio')[1]!)
    expect(useStore.getState().coverage.KG_300).toBe('excluded')
    expect(useStore.getState().kg700Mode).toBe('hoaiAho')
    expect(useStore.getState().journal.at(-1)?.label).toContain('automatisch')
    const projection = useStore.getState().projection()
    expect(projection.result.total.exact.lt(totalBefore)).toBe(true)
    expect(projection.kgSplit.KG_300.isZero()).toBe(true)
    expect(projection.kgSplit.KG_300.plus(projection.kgSplit.KG_400)
      .equals(projection.result.bauwerk)).toBe(true)
  })

  it('lets optional groups choose included or excluded without an unknown tile', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    const kg500 = screen.getByRole('radiogroup', { name: /KG.500/ })
    expect(useStore.getState().coverage.KG_500).toBe('unknown')
    const options = within(kg500).getAllByRole('radio')
    expect(options).toHaveLength(2)
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

    await user.click(screen.getByRole('button', { name: /Umfang bestätigen/ }))
    expect(useStore.getState().scopeBoundariesConfirmedFingerprint).not.toBeNull()
    await user.click(nav(/Leistungsabgrenzung/))

    const kg600 = screen.getByRole('radiogroup', { name: /KG.600/ })
    await user.click(within(kg600).getAllByRole('radio')[1]!) // "nicht enthalten"
    expect(screen.getByRole('button', { name: /Umfang bestätigen/ })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: /Umfang bestätigen/ }))
    expect(useStore.getState().scopeBoundariesConfirmedFingerprint).not.toBeNull()
  })
})
