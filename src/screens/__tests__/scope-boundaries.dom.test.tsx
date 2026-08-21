import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Decimal } from 'decimal.js'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
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
  await confirmBuildingReviewSections(user)
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
      const radios = within(screen.getByRole('radiogroup', { name: kg })).getAllByRole('radio')
      expect(radios).toHaveLength(2)
      expect(radios.filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0)
    }
    expect(useStore.getState().coverage.KG_300).toBe('unknown')
    expect(useStore.getState().coverage.KG_400).toBe('unknown')
    expect(useStore.getState().coverage.KG_700).toBe('unknown')
    expect(useStore.getState().kg700Mode).toBe('hoaiAho')
    expect(useStore.getState().kg700ModeAutoFallback).toBe(true)

    const offer = screen.getByRole('complementary', { name: 'Angebot' })
    await user.click(within(offer).getByRole('button', { name: 'Kostentreiber' }))
    await user.click(within(offer).getByRole('button', { name: 'Kostengruppen nach DIN 276' }))
    expect(offer).toHaveTextContent('Preis nicht ermittelt')
    expect(offer).not.toHaveTextContent(/(^|\D)0\s*€\/m²/)
    expect(offer).not.toHaveTextContent(/(^|\D)0\s*€/)
    expect(offer).not.toHaveTextContent('Summe = 0 €')
    const unresolvedCoreAdjustments = useStore.getState().projection().result.drivers
      .filter((driver) => ['kg300_excluded_adjustment', 'kg400_excluded_adjustment']
        .includes(driver.key))
    expect(unresolvedCoreAdjustments).toHaveLength(2)
    expect(unresolvedCoreAdjustments.every((driver) => driver.origin === 'scope')).toBe(true)
    expect(unresolvedCoreAdjustments.every((driver) => !driver.label.includes('(ausgeschlossen)')))
      .toBe(true)

    await user.click(within(screen.getByRole('radiogroup', { name: /KG.300/ }))
      .getAllByRole('radio')[0]!)
    await user.click(within(screen.getByRole('radiogroup', { name: /KG.400/ }))
      .getAllByRole('radio')[0]!)
    await user.click(within(screen.getByRole('radiogroup', { name: /KG.700/ }))
      .getAllByRole('radio')[0]!)
    expect(useStore.getState().kg700Mode).toBe('vereinfacht')
    const before = useStore.getState().projection().result.total.exact
    const kg300 = screen.getByRole('radiogroup', { name: /KG.300/ })
    await user.click(within(kg300).getAllByRole('radio')[1]!)
    expect(useStore.getState().coverage.KG_300).toBe('excluded')
    expect(useStore.getState().kg700Mode).toBe('hoaiAho')
    expect(useStore.getState().journal.at(-1)?.label).toContain('automatisch')
    // Product Decision (ticket e2dac9b5, approved 2026-08-20, recorded on
    // the ticket): excluding one core group prices the remaining one at
    // its real, Referenzprojekt-R-02-audited echt share (76,2/23,8 —
    // decisions.md D-07); the deduction is derived from the amount BEFORE
    // this click, never by re-splitting an already-reduced figure.
    const projection = useStore.getState().projection()
    expect(projection.kgSplit.KG_300.isZero()).toBe(true)
    expect(projection.kgSplit.KG_400.toFixed(2))
      .toBe(before.mul('23.8').div(100).toFixed(2))
    // KG 700 automatically falls back to its own HOAI+AHO rate on the now
    // smaller block (D-07 rule 6, already covered above); the driver sum
    // still reconciles to the total (rule 32), and the total itself drops
    // well below the pre-exclusion amount.
    const driverSum = projection.result.drivers
      .reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(driverSum.toFixed(2)).toBe(projection.result.total.exact.toFixed(2))
    expect(projection.result.total.exact.lt(before)).toBe(true)
  })

  it('disables All3 with a visible reason until KG 300 and KG 400 are included', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    const kg700 = screen.getByRole('radiogroup', { name: /KG.700/ })
    await user.click(within(kg700).getAllByRole('radio')[0]!)
    await user.click(nav(/Baunebenkosten KG 700/))

    const method = screen.getByRole('radiogroup', { name: 'Berechnungsart KG 700' })
    const all3 = within(method).getByRole('radio', { name: 'All3-Verfahren 70/22/8' })
    expect(all3).toBeDisabled()
    expect(within(method).getByRole('radio', { name: 'nach HOAI und AHO' })).toBeChecked()
    expect(screen.getByText(/erst verfügbar, wenn KG 300 und KG 400 beide enthalten/))
      .toBeInTheDocument()
    expect(screen.queryByText(/Der Gesamtbetrag bleibt unverändert/)).not.toBeInTheDocument()
    expect(screen.getByText(/eigene Zeile im Kostentreiber/)).toBeInTheDocument()

    await user.click(nav(/Leistungsabgrenzung/))
    await user.click(within(screen.getByRole('radiogroup', { name: /KG.300/ }))
      .getAllByRole('radio')[0]!)
    await user.click(within(screen.getByRole('radiogroup', { name: /KG.400/ }))
      .getAllByRole('radio')[0]!)
    await user.click(nav(/Baunebenkosten KG 700/))

    const restored = screen.getByRole('radiogroup', { name: 'Berechnungsart KG 700' })
    expect(within(restored).getByRole('radio', { name: 'All3-Verfahren 70/22/8' }))
      .toBeEnabled()
    expect(within(restored).getByRole('radio', { name: 'All3-Verfahren 70/22/8' }))
      .toBeChecked()
    expect(screen.getByText(/Der Gesamtbetrag bleibt unverändert/)).toBeInTheDocument()
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
    await confirmBuildingReviewSections(user)
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
