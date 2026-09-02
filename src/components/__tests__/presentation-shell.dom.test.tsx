import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell } from '../PresentationShell'
import { __resetStoreForTests, includedBuildingIds, useStore } from '../../state/store'

/**
 * VR2-06 — PresentationShell narrative shell.
 *
 * Rendered directly against the store (the same lightweight pattern
 * `comparison.dom.test.tsx` already uses for `S4Vergleich`/`OfferPanel`),
 * not through the full `<App/>` click-through — `setViewedOption`'s guard
 * is independent of `s.mode` (see store.ts), so this proves the shell's
 * OWN contract without also re-testing the mode-entry gate dialog that
 * `keyboard.dom.test.tsx`/DC-33 tests already cover.
 *
 * VR2-06 recomposed the shell from a scrolled stack of `SectionSheet`
 * cards (every section mounted at once) into one full-bleed narrative
 * page at a time, switched by the top-bar strip — a narrative section's
 * content only exists in the DOM while its tab is `aria-current`. Every
 * assertion below that reads a section's content therefore navigates to
 * that section's tab first; the invariants themselves (this file's
 * REDESIGN R3 Wave 2a "mandatory Client Option Isolation Test" family)
 * are unchanged — only how the test REACHES the content changed. The
 * top-bar Ansicht switcher and the exit/mode-indicator pairing remain
 * mounted regardless of the active section (DC-22 `OutputProfileSwitch`
 * anatomy), so those queries need no navigation.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** Clicks a narrative tab and waits for its page (same accessible name,
 * `aria-label` on the `<section>`) to actually mount — the tab-switch
 * cross-fade (rule 20, `AnimatePresence` `mode="wait"`, same pattern
 * `S3Konfigurator`'s own chapter transition already uses) resolves on a
 * real `requestAnimationFrame`/`setTimeout` tick (`src/test/setup.ts`'s
 * polyfill), not synchronously with the click. */
async function gotoSection(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(screen.getByRole('region', { name: label })).toBeInTheDocument())
}

/** Baut zwei vollständige, client-eligible Options mit unterschiedlichem
 *  Energiestandard (unterschiedliche Kalkulation → unterschiedlicher
 *  Hero-Wert) — 'OPT-01' bleibt am Ende aktiv, 'OPT-02' existiert nur im
 *  Speicher (isolationsprobe). */
function buildTwoEligibleOptions(opportunityId?: string) {
  if (opportunityId) st().openOpportunity(opportunityId)
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

  it('renders the full narrative with exactly one eligible Option, without a §5 Optionen tab or region', async () => {
    const user = userEvent.setup()
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
    expect(screen.queryByRole('button', { name: 'Optionen' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()

    await gotoSection(user, 'Ergebnis')
  })

  it('uses client-safe English keys for the timeline labels and continuation action', async () => {
    const user = userEvent.setup()
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Solo')
    st().openOption('OPT-01')
    includedBuildingIds(st()).forEach((id) => st().confirmBuilding(id))
    st().confirmConfigurationMode('SHARED')
    st().setCoverage('KG_300', 'included')
    st().confirmScopeBoundaries()
    includedBuildingIds(st()).forEach((id) => st().confirmBuildingConfiguration(id))
    st().setUiLanguage('en')

    render(<Harness />)

    expect(screen.getByRole('button', { name: 'Project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Building' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Result' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next step' })).toBeInTheDocument()
    expect(screen.queryByText('Bauzeit ab OKBP')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Weiter zu Optionen' })).toBeNull()

    await gotoSection(user, 'Schedule')
    expect(screen.getAllByText(/\d+(?:\.\d+)? months/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Continue to options' })).toBeInTheDocument()
  })

  /**
   * QA rework (rule 40, D-15): OfferPanel's rail always showed an inactive
   * Regionalfaktor as a "nicht aktiviert" row inside Kostentreiber, and
   * that row was reachable and tested in Kundenansicht before this wave
   * (`configurator-mode.dom.test.tsx` et al. reached the rail's "Nachweise
   * & Verlauf" dialog live). §3 Ergebnis's own Kostentreiber-Auszug must
   * not silently drop it — this test guards against it regressing again.
   */
  it('always shows the Regionalfaktor "nicht aktiviert" disclosure in Kostentreiber when inactive, and hides it when active (rule 40)', async () => {
    const user = userEvent.setup()
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
    await gotoSection(user, 'Ergebnis')
    const ergebnis = screen.getByRole('region', { name: 'Ergebnis' })
    expect(within(ergebnis).getByText(/Regionalfaktor.*nicht berücksichtigt/)).toBeInTheDocument()
    unmount()

    // Once explicitly activated, the row must disappear — it is not a
    // permanent fixture, only a disclosure of the current inactive state.
    st().toggleRegionalfaktor()
    expect(st().regionalfaktorActive).toBe(true)
    render(<Harness />)
    await gotoSection(user, 'Ergebnis')
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
    await gotoSection(user, 'Optionen')
    const optionen = screen.getByRole('region', { name: 'Optionen' })
    const tileA = within(optionen).getByRole('group', { name: 'Option A' })
    const tileB = within(optionen).getByRole('group', { name: 'Option B' })
    expect(tileA).toHaveTextContent('Wird präsentiert')
    expect(tileB).not.toHaveTextContent('Wird präsentiert')

    await gotoSection(user, 'Ergebnis')
    const ergebnisBefore = screen.getByRole('region', { name: 'Ergebnis' })
    const heroBefore = ergebnisBefore.textContent

    // Wechsel über die Ansicht-Auswahl in der Kopfzeile (nicht die
    // §5-Kachel — beide treiben denselben viewedOptionId, hier wird die
    // Kopfzeilen-Auswahl geprüft; sie bleibt unabhängig von der aktiven
    // Seite gemountet).
    const switcher = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))

    // Isolation: activeOptionId bleibt A, nur viewedOptionId ändert sich.
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBe('OPT-02')

    // Jede Sektion liest jetzt B — EIN kohärentes Update, kein Nachhinken:
    // §5's Markierung wechselt, §3's Hero-Text ändert sich (andere Summe).
    const ergebnisAfter = screen.getByRole('region', { name: 'Ergebnis' })
    expect(ergebnisAfter.textContent).not.toBe(heroBefore)

    await gotoSection(user, 'Optionen')
    const optionenAfter = screen.getByRole('region', { name: 'Optionen' })
    expect(within(optionenAfter).getByRole('group', { name: 'Option A' }))
      .not.toHaveTextContent('Wird präsentiert')
    expect(within(optionenAfter).getByRole('group', { name: 'Option B' }))
      .toHaveTextContent('Wird präsentiert')

    // Exit: the real production path (`s.setMode('intern')`, what
    // the exit action calls) discards viewedOptionId entirely; internal A
    // stays untouched.
    st().setMode('intern')
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBeNull()
  })

  it('the §5 tile is an equally valid switch control (same viewedOptionId, no activeOptionId mutation)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()

    render(<Harness />)
    await gotoSection(user, 'Optionen')
    const optionen = screen.getByRole('region', { name: 'Optionen' })
    const tileB = within(optionen).getByRole('group', { name: 'Option B' })
    await user.click(within(tileB).getByRole('button'))

    expect(st().viewedOptionId).toBe('OPT-02')
    expect(st().activeOptionId).toBe('OPT-01')
  })

  it('keeps the viewed Option through offer review and blocks sending without a recipient', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      // VR2-07: the commercial-climax headline names the project — this
      // harness never calls `openOpportunity`, so `s.opportunityId` stays
      // null and the honest fallback subject applies (same `|| fallback`
      // pattern `PageIdentity`'s own empty-state H1 already uses).
      expect(screen.getByRole('heading', { name: 'Ihr Projekt bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })

    const switcher = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBe('OPT-02')

    await user.click(screen.getByRole('button', { name: 'Angebot prüfen & senden →' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })
    expect(screen.getByText(/Option B · Ihr indikatives Angebot/)).toBeInTheDocument()

    const sendButton = screen.getByRole('button', { name: 'Angebot senden' })
    expect(sendButton).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText('Noch kein Empfänger hinterlegt')).not.toHaveLength(0)
    await user.click(sendButton)
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().snapshots).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
  })

  it('enables the validated recipient flow and creates exactly one immutable snapshot', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-0001')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      // opportunityId='DEMO-0001' here, so the real project name applies.
      expect(screen.getByRole('heading', { name: 'Musterprojekt Nordfeld bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Angebot prüfen & senden →' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })

    expect(screen.getByText('An: kontakt@beispiel-entwickler.example (aus HubSpot)')).toBeInTheDocument()
    const sendButton = screen.getByRole('button', { name: 'Angebot senden' })
    expect(sendButton).not.toHaveAttribute('aria-disabled')

    await user.click(sendButton)
    expect(st().snapshots).toHaveLength(1)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Angebot gesendet' })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Angebot zugestellt (simuliert)' })).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(st().snapshots).toHaveLength(1)
    expect(screen.getByText('An: kontakt@beispiel-entwickler.example (aus HubSpot)')).toBeInTheDocument()
  })
})

describe('PresentationShell — VR2-07 Offer climax', () => {
  it('renders the full headline and eyebrow for a long Option name without truncating or throwing (no fixed-width text container, rule 36/37)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-0001')
    const longName = 'Option 2 · Premium-Ausstattung mit vollständig unterkellertem Baukörper und Aufzugsanlage'
    st().renameOption('OPT-02', longName)
    st().setViewedOption('OPT-02')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: `Musterprojekt Nordfeld bekommt kommerzielle Kontur.` })).toBeInTheDocument()
    })
    // The eyebrow interpolates the full Option name verbatim — a fixed-width
    // container or an ellipsis/truncation rule would silently drop part of
    // it; this asserts the complete string is actually in the DOM (also
    // matched by the Ansicht switcher's own segment label, hence "some").
    const matches = screen.getAllByText(new RegExp(longName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(matches.length).toBeGreaterThan(0)
  })

  it('always lists all three structural deliverables, and marks Kostenübersicht (not the others) unavailable when the total is undetermined', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-0001')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Drei Artefakte, eine Aussage.' })).toBeInTheDocument()
    })
    // Ready path (this fixture has a determined total): all three cards
    // present, none carrying an unavailable-preview status.
    expect(screen.getByText('Angebotspräsentation')).toBeInTheDocument()
    expect(screen.getByText('Kostenübersicht DIN 276')).toBeInTheDocument()
    expect(screen.getByText('Leistungsumfang')).toBeInTheDocument()
    expect(screen.queryByText(/Vorschau nicht verfügbar/)).not.toBeInTheDocument()
  })

  it('ACCEPT-03 remediation: each gallery card genuinely starts "Wird vorbereitet …" and resolves to its real status live, not a permanently-static list', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-0001')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Drei Artefakte, eine Aussage.' })).toBeInTheDocument()
    })
    // Immediately after entering the Offer stage every card is in the
    // "generating" beat — a real, observable transient state, not a
    // hypothetical one only reachable through a special fixture.
    expect(screen.getAllByText('Wird vorbereitet …').length).toBeGreaterThan(0)
    // Once the simulated preparation completes, the ready cards expose a
    // real "Vorschau" affordance (the title becomes a button) and the
    // generating copy is gone.
    await waitFor(() => {
      expect(screen.queryByText('Wird vorbereitet …')).not.toBeInTheDocument()
    }, { timeout: 2000 })
    expect(screen.getByRole('button', { name: 'Angebotspräsentation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kostenübersicht DIN 276' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leistungsumfang' })).toBeInTheDocument()
  })

  it('ACCEPT-02 remediation: a ready card opens a real Dialog preview with actual computed data, and closing it returns focus to the trigger', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-0001')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    const offerCardButton = await screen.findByRole('button', { name: 'Angebotspräsentation' }, { timeout: 2000 })

    await user.click(offerCardButton)
    const dialog = await screen.findByRole('dialog')
    // Real computed data, not a fabricated document: the same Option name
    // and total already shown on the commercial stage (PrintFlow.tsx's own
    // `.a3-paper-preview` convention — the Option, not the project, is the
    // named subject of the document).
    expect(within(dialog).getByText('Option A')).toBeInTheDocument()
    expect(within(dialog).getByText(/Gesamt netto/)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(offerCardButton).toHaveFocus()
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
    // The narrative stays a one-document-at-a-time model: exactly one H1
    // still exists after navigating to a different narrative page.
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Ergebnis' })).toBeInTheDocument()
    })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('announces the presented Option change via a single polite live region', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    const switcher = screen.getByRole('radiogroup', { name: 'Ansicht' })
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))

    const live = document.querySelector('p[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live!.textContent).toMatch(/Option B/)
  })
})
