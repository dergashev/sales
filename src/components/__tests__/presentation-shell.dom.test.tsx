import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell } from '../PresentationShell'
import { __resetStoreForTests, includedBuildingIds, useStore } from '../../state/store'

/**
 * REDESIGN R3 WAVE 2a (backlog ce17da51) — PresentationShell.
 *
 * Rendered directly against the store (the same lightweight pattern
 * `comparison.dom.test.tsx` already uses for `S4Vergleich`/`OfferPanel`),
 * not through the full `<App/>` click-through — `setViewedOption`'s guard
 * is independent of `s.mode` (see store.ts), so this proves the shell's
 * OWN contract without also re-testing the mode-entry gate dialog that
 * `keyboard.dom.test.tsx`/DC-33 tests already cover.
 *
 * This file EXTENDS the mandatory "Client Option Isolation Test" family
 * (store.ts's own `describe('REDESIGN R3: viewedOptionId isolation …')`
 * already proves the store-level contract) — its own job is proving the
 * contract reaches EVERY narrative section, not just `S4Vergleich`, which
 * is exactly the Wave 1 → Wave 2a gap this ticket closes.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** Baut zwei vollständige, client-eligible Options mit unterschiedlichem
 *  Energiestandard (unterschiedliche Kalkulation → unterschiedlicher
 *  Hero-Wert) — 'OPT-01' bleibt am Ende aktiv, 'OPT-02' existiert nur im
 *  Speicher (isolationsprobe). */
function buildTwoEligibleOptions() {
  st().resolveWflConflict('customer')
  st().confirmProjectParams()

  st().createOption('Option A')
  st().openOption('OPT-01')
  includedBuildingIds(st()).forEach((id) => st().confirmBuilding(id))
  st().confirmConfigurationMode('SHARED')
  st().setCoverage('KG_300', 'included')
  st().setCoverage('KG_400', 'included')
  st().setEnergiestandard('EH_55')
  st().confirmScopeBoundaries()
  includedBuildingIds(st()).forEach((id) => st().confirmBuildingConfiguration(id))

  st().createOption('Option B')
  st().openOption('OPT-02')
  includedBuildingIds(st()).forEach((id) => st().confirmBuilding(id))
  st().confirmConfigurationMode('SHARED')
  st().setCoverage('KG_300', 'included')
  st().setCoverage('KG_400', 'included')
  st().setEnergiestandard('EH_40')
  st().confirmScopeBoundaries()
  includedBuildingIds(st()).forEach((id) => st().confirmBuildingConfiguration(id))

  st().openOption('OPT-01')
  // `setViewedOption` is intentionally a no-op outside Kundenansicht
  // (store.ts: `if (!isClientProjection(s.mode)) return`) — defense in
  // depth so a stale/expired selector click can never mutate presentation
  // state anywhere but inside the client projection. `setMode` itself
  // requires `canBeginConfiguration`, already satisfied above.
  st().setMode('praesentation')
}

describe('PresentationShell — empty/edge states (AC 6/9/11/12)', () => {
  it('renders an honest state, never a blank main, when no Option exists at all', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Noch keine Opportunity Option angelegt/)).toBeInTheDocument()
  })

  it('renders an honest state, never a blank main, when an Option exists but is not yet client-eligible', () => {
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Unfertig')
    st().openOption('OPT-01')

    render(<Harness />)
    expect(screen.getByText(/noch keine Option bereit für die Kundenansicht/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Ergebnis' })).toBeNull()
  })

  it('renders the full narrative with exactly one eligible Option, without a §5 Optionen section or selector', () => {
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Solo')
    st().openOption('OPT-01')
    includedBuildingIds(st()).forEach((id) => st().confirmBuilding(id))
    st().confirmConfigurationMode('SHARED')
    st().setCoverage('KG_300', 'included')
    st().confirmScopeBoundaries()
    includedBuildingIds(st()).forEach((id) => st().confirmBuildingConfiguration(id))

    render(<Harness />)
    expect(screen.getByRole('region', { name: 'Ergebnis' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Optionen' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Wird präsentiert' })).toBeNull()
  })

  /**
   * QA rework (rule 40, D-15): OfferPanel's rail always showed an inactive
   * Regionalfaktor as a "nicht aktiviert" row inside Kostentreiber, and
   * that row was reachable and tested in Kundenansicht before this wave
   * (`configurator-mode.dom.test.tsx` et al. reached the rail's "Nachweise
   * & Verlauf" dialog live). §3 Ergebnis's own simplified Kostentreiber-
   * Auszug had silently dropped it — QA caught the regression live and
   * traced the exact reuse path (same i18n key, same formula, no new
   * calculation). This test guards against it regressing silently again.
   */
  it('always shows the Regionalfaktor "nicht aktiviert" disclosure in Kostentreiber when inactive, and hides it when active (rule 40)', () => {
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Solo')
    st().openOption('OPT-01')
    includedBuildingIds(st()).forEach((id) => st().confirmBuilding(id))
    st().confirmConfigurationMode('SHARED')
    st().setCoverage('KG_300', 'included')
    st().confirmScopeBoundaries()
    includedBuildingIds(st()).forEach((id) => st().confirmBuildingConfiguration(id))

    // D-15: Regionalfaktor is inactive by default — the disclosure row
    // must be present.
    expect(st().regionalfaktorActive).toBe(false)
    const { unmount } = render(<Harness />)
    const ergebnis = screen.getByRole('region', { name: 'Ergebnis' })
    expect(within(ergebnis).getByText(/Regionalfaktor.*nicht berücksichtigt/)).toBeInTheDocument()
    unmount()

    // Once explicitly activated, the row must disappear — it is not a
    // permanent fixture, only a disclosure of the current inactive state.
    st().toggleRegionalfaktor()
    expect(st().regionalfaktorActive).toBe(true)
    render(<Harness />)
    const ergebnisActive = screen.getByRole('region', { name: 'Ergebnis' })
    expect(within(ergebnisActive).queryByText(/Regionalfaktor.*nicht berücksichtigt/)).toBeNull()
  })
})

describe('PresentationShell — mandatory Client Option Isolation Test (AC 5/15/16/21)', () => {
  it('switching the presented Option updates every narrative section coherently, without ever mutating activeOptionId', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    expect(st().activeOptionId).toBe('OPT-01')
    // Initial-continuity rule: entering Kundenansicht starts the
    // presentation-only viewed Option at the internally active one.
    expect(st().viewedOptionId).toBe('OPT-01')

    render(<Harness />)

    // Vor dem Wechsel: §5 Optionen existiert (≥2 eligible), Option A ist
    // markiert "Wird präsentiert", §3 zeigt A's Hero.
    const optionen = screen.getByRole('region', { name: 'Optionen' })
    const tileA = within(optionen).getByRole('button', { name: /Option A/ })
    const tileB = within(optionen).getByRole('button', { name: /Option B/ })
    expect(tileA).toHaveAttribute('aria-pressed', 'true')
    expect(tileB).toHaveAttribute('aria-pressed', 'false')

    const ergebnisBefore = screen.getByRole('region', { name: 'Ergebnis' })
    const heroBefore = ergebnisBefore.textContent

    // Wechsel über die PresentationBar-Auswahl (nicht die §5-Kachel — beide
    // treiben denselben viewedOptionId, hier wird die Bar-Auswahl geprüft).
    const switcher = screen.getByRole('radiogroup', { name: 'Wird präsentiert' })
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))

    // Isolation: activeOptionId bleibt A, nur viewedOptionId ändert sich.
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBe('OPT-02')

    // Jede Sektion liest jetzt B — EIN kohärentes Update, kein Nachhinken:
    // §5's Markierung wechselt, §3's Hero-Text ändert sich (andere Summe).
    const optionenAfter = screen.getByRole('region', { name: 'Optionen' })
    expect(within(optionenAfter).getByRole('button', { name: /Option A/ }))
      .toHaveAttribute('aria-pressed', 'false')
    expect(within(optionenAfter).getByRole('button', { name: /Option B/ }))
      .toHaveAttribute('aria-pressed', 'true')
    const ergebnisAfter = screen.getByRole('region', { name: 'Ergebnis' })
    expect(ergebnisAfter.textContent).not.toBe(heroBefore)

    // Exit: the real production path (`s.setMode('intern')`, what
    // `OutputProfileSwitch`'s "Beenden" button calls) discards
    // viewedOptionId entirely; internal A stays untouched.
    st().setMode('intern')
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBeNull()
  })

  it('the §5 tile is an equally valid switch control (same viewedOptionId, no activeOptionId mutation)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()

    render(<Harness />)
    const optionen = screen.getByRole('region', { name: 'Optionen' })
    await user.click(within(optionen).getByRole('button', { name: /Option B/ }))

    expect(st().viewedOptionId).toBe('OPT-02')
    expect(st().activeOptionId).toBe('OPT-01')
  })
})

describe('PresentationShell — accessibility (AC 62–67)', () => {
  it('exposes exactly one H1 and a keyboard-operable narrative strip with aria-current', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    const bar = screen.getByRole('navigation', { name: 'Präsentation' })
    const projektTab = within(bar).getByRole('button', { name: 'Projekt' })
    expect(projektTab).toHaveAttribute('aria-current', 'true')
    const ergebnisTab = within(bar).getByRole('button', { name: 'Ergebnis' })
    expect(ergebnisTab).not.toHaveAttribute('aria-current')

    await user.click(ergebnisTab)
    expect(ergebnisTab).toHaveAttribute('aria-current', 'true')
    expect(projektTab).not.toHaveAttribute('aria-current')
  })

  it('announces the presented Option change via a single polite live region', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    const switcher = screen.getByRole('radiogroup', { name: 'Wird präsentiert' })
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))

    const live = document.querySelector('p[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live!.textContent).toMatch(/Option B/)
  })
})
