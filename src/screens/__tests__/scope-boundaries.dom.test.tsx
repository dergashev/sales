import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('Leistungsabgrenzung / Scope Boundaries (mandatory-core contract, "Rebuild Project Card Workflow" #16)', () => {
  it('renders KG 300/400/700 as a single locked mandatory tile and KG 200/500/600 as binary decisions, `nicht enthalten` checked by default; KG 800 does not appear at all', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    for (const kg of [/KG.300/, /KG.400/, /KG.700/]) {
      // `CheckboxCard` renders a native `<fieldset>` (implicit ARIA
      // `group`) around its own explicit `role="group"` div with the same
      // accessible name — both match, so take the outer fieldset.
      const group = screen.getAllByRole('group', { name: kg })[0]!
      const tiles = within(group).getAllByRole('checkbox')
      expect(tiles).toHaveLength(1)
      expect(tiles[0]).toBeChecked()
      expect(tiles[0]).toHaveAttribute('aria-disabled', 'true')
      expect(within(group).getByText(/Pflicht/)).toBeInTheDocument()
    }
    for (const kg of [/KG.200/, /KG.500/, /KG.600/]) {
      const radios = within(screen.getByRole('radiogroup', { name: kg })).getAllByRole('radio')
      expect(radios).toHaveLength(2)
      // Binary default: `nicht enthalten` (index 1) starts checked — no
      // third "unknown" tile/state exists any more.
      expect((radios[0] as HTMLInputElement).checked).toBe(false)
      expect((radios[1] as HTMLInputElement).checked).toBe(true)
    }
    expect(screen.queryByRole('radiogroup', { name: /KG.800/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /KG.800/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Finanzierung/)).not.toBeInTheDocument()

    expect(useStore.getState().coverage.KG_200).toBe('excluded')
    expect(useStore.getState().coverage.KG_300).toBe('included')
    expect(useStore.getState().coverage.KG_400).toBe('included')
    expect(useStore.getState().coverage.KG_500).toBe('excluded')
    expect(useStore.getState().coverage.KG_600).toBe('excluded')
    expect(useStore.getState().coverage.KG_700).toBe('included')
    expect(useStore.getState().coverage.KG_800).toBe('excluded')
    // Both mandatory core groups are included from the start, so the
    // simplified All3 method is immediately available — no reversible
    // automatic fallback is manufactured for a fresh Option any more.
    expect(useStore.getState().kg700Mode).toBe('vereinfacht')
    expect(useStore.getState().kg700ModeAutoFallback).toBe(false)

    // The mandatory tile is not a real decision: clicking it must not fire
    // the native checkbox change handler and must leave coverage untouched.
    const kg300Group = screen.getAllByRole('group', { name: /KG.300/ })[0]!
    await user.click(within(kg300Group).getByRole('checkbox'))
    expect(useStore.getState().coverage.KG_300).toBe('included')
  })

  it('All3-Verfahren is available immediately since KG 300/400 are mandatory and always included', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)
    await user.click(nav(/Baunebenkosten KG 700/))

    const method = screen.getByRole('radiogroup', { name: 'Berechnungsart KG 700' })
    const all3 = within(method).getByRole('radio', { name: 'All3-Verfahren 70/22/8' })
    expect(all3).toBeEnabled()
    expect(all3).toBeChecked()
    expect(screen.getByText(/Der Gesamtbetrag bleibt unverändert/)).toBeInTheDocument()
  })

  it('lets optional groups choose included or excluded without an unknown tile', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)

    const kg500 = screen.getByRole('radiogroup', { name: /KG.500/ })
    expect(useStore.getState().coverage.KG_500).toBe('excluded')
    const options = within(kg500).getAllByRole('radio')
    expect(options).toHaveLength(2)
    await user.click(options[0]!) // "enthalten"
    expect(useStore.getState().coverage.KG_500).toBe('included')
  })

  it('bietet den vierten Energiestandard EH 40 NH (QNG) als Kachel an', async () => {
    const user = userEvent.setup()
    await openScopeBoundaries(user)
    // "Rebuild Project Card Workflow" Part 14/15: Energiestandard is
    // edited directly on Leistungsabgrenzung now — no navigation to a
    // separate chapter is needed any more.
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
    // KG 600 already starts `nicht enthalten` (binary default) — flip it to
    // `enthalten` to exercise a real post-confirmation change.
    await user.click(within(kg600).getAllByRole('radio')[0]!)
    expect(screen.getByRole('button', { name: /Umfang bestätigen/ })).toBeInTheDocument()
    expect(screen.getByText(/erneut geprüft|geändert/))
      .toBeInTheDocument()
  })

  /**
   * Tech Review P0/P2 (ticket d21f8d48, commit 2871a63): every prior test in
   * this file ran with a single building, where SHARED and PER_BUILDING are
   * indistinguishable — exactly the gap that let `setEnergiestandard` ship
   * writing only the active building while the screen showing the picker
   * shows "gilt für den gesamten Komplex" with no building tabs to reach
   * the other one. "Rebuild Project Card Workflow" Part 14 relocated the
   * sole editable picker back onto Leistungsabgrenzung, which — exactly
   * like the former "Energie & Zertifikate" chapter — shows no building
   * tabs in SHARED mode (it is `scope: 'project'`), so this regression
   * coverage still applies unchanged, just from its (now permanent) home.
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

    expect(useStore.getState().buildings['DEMO-B-A']!.energiestandard).toBe('EH_55')
    expect(useStore.getState().buildings['DEMO-B-B']!.energiestandard).toBe('EH_55')

    const es = screen.getByRole('radiogroup', { name: 'Energiestandard' })
    await user.click(within(es).getAllByRole('radio')[2]!) // EH_40

    // No building tabs exist on this building-scoped chapter in SHARED
    // mode — the change must reach BOTH buildings, not just whichever one
    // was active.
    expect(useStore.getState().buildings['DEMO-B-A']!.energiestandard).toBe('EH_40')
    expect(useStore.getState().buildings['DEMO-B-B']!.energiestandard).toBe('EH_40')

    // Confirmation covers both buildings' requirements, not just the active
    // one. Scope Boundaries confirmation lives back on Leistungsabgrenzung.
    await user.click(nav(/Leistungsabgrenzung/))
    await user.click(screen.getByRole('button', { name: /Umfang bestätigen/ }))
    expect(useStore.getState().scopeBoundariesConfirmedFingerprint).not.toBeNull()
  })
})
