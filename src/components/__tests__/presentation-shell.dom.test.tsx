import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell, PresentationFlowScreen, type Candidate } from '../PresentationShell'
import { completeKgConfiguration } from '../../test/offer-option'
import { allServices } from '../../engine/kgConfiguration'
import {
  __resetStoreForTests, configForOption, includedBuildingIds, kgCatalogueFor,
  projectionForOption, useStore,
} from '../../state/store'

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
/**
 * VR3-03: an Option created under a demonstration PROJECT carries a KG
 * configuration, and client eligibility now requires that configuration to
 * be complete. An Option created with no project open (the harness's other
 * shape) has none and keeps the released predicate — so this records the
 * decisions when there is a catalogue to record them against, and is inert
 * when there is not.
 */
function completeConfigurationIfCatalogued() {
  if (!kgCatalogueFor(st())) return
  completeKgConfiguration()
}

/** The energy-standard service of the open catalogue, or `null`. */
function energyStandardServiceId(): string | null {
  const catalogue = kgCatalogueFor(st())
  if (!catalogue) return null
  return allServices(catalogue).find((svc) => svc.id.endsWith('-400-es'))?.id ?? null
}

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
  completeConfigurationIfCatalogued()
  st().confirmScopeBoundaries()
  includedBuildingIds(st()).forEach((id) => st().confirmBuildingConfiguration(id))

  st().createOption('Option B')
  st().openOption('OPT-02')
  includedBuildingIds(st()).forEach((id) => st().confirmBuilding(id))
  st().confirmConfigurationMode('SHARED')
  st().setCoverage('KG_300', 'included')
  st().setCoverage('KG_400', 'included')
  st().setEnergiestandard('EH_40')
  completeConfigurationIfCatalogued()
  {
    // The two Options must differ in a way the CURRENT model prices, or the
    // isolation probe compares two identical totals.
    const es = energyStandardServiceId()
    if (es) st().setKgServiceDecision(es, { state: 'selected', variant: 'eh40' })
  }
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

    // `findByRole`, not `getByRole`: the radio above switches the viewed
    // Option through `startContinuityTransition`, and the sections live in an
    // `AnimatePresence mode="wait"` — the outgoing section fully unmounts
    // BEFORE the incoming one mounts, so this button is legitimately absent
    // for a moment. A synchronous query asserts against a deliberately
    // asynchronous transition, and it failed intermittently under full-suite
    // load (~1 run in 4). The component's behaviour is correct; the
    // assertion was not. Pre-existing, unrelated to VR3-01.
    await user.click(await screen.findByRole('button', { name: 'Angebot prüfen & senden →' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })
    // VR2-08: the subject line now names the PROJECT (what a real email
    // subject would read), not the internal Option name.
    expect(screen.getByText(/Indikatives Angebot · Ihr Projekt/)).toBeInTheDocument()

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
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      // opportunityId='DEMO-HAPPY-01' here, so the real project name applies.
      expect(screen.getByRole('heading', { name: 'Wohnhof Lindenhain bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })
    // Same transition race as above (findByRole, not getByRole).
    await user.click(await screen.findByRole('button', { name: 'Angebot prüfen & senden →' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })

    expect(screen.getByText('kontakt@beispiel-entwickler.example')).toBeInTheDocument()
    const sendButton = screen.getByRole('button', { name: 'Angebot senden' })
    expect(sendButton).not.toHaveAttribute('aria-disabled')

    // VR2-08: a real, visible "sending" commit step now sits between the
    // click and the snapshot existing (SEND_COMMIT_SIMULATION_MS) — the
    // button goes into its canonical loading state first.
    await user.click(sendButton)
    expect(st().snapshots).toHaveLength(0)
    await waitFor(() => {
      expect(st().snapshots).toHaveLength(1)
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Angebot gesendet' })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Angebot wurde zugestellt.' })).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(st().snapshots).toHaveLength(1)
    expect(screen.getByText(/kontakt@beispiel-entwickler\.example/)).toBeInTheDocument()
  })
})

describe('PresentationShell — VR2-07 Offer climax', () => {
  it('renders the full headline and eyebrow for a long Option name without truncating or throwing (no fixed-width text container, rule 36/37)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    const longName = 'Option 2 · Premium-Ausstattung mit vollständig unterkellertem Baukörper und Aufzugsanlage'
    st().renameOption('OPT-02', longName)
    st().setViewedOption('OPT-02')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: `Wohnhof Lindenhain bekommt kommerzielle Kontur.` })).toBeInTheDocument()
    })
    // The eyebrow interpolates the full Option name verbatim — a fixed-width
    // container or an ellipsis/truncation rule would silently drop part of
    // it; this asserts the complete string is actually in the DOM (also
    // matched by the Ansicht switcher's own segment label, hence "some").
    const matches = screen.getAllByText(new RegExp(longName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(matches.length).toBeGreaterThan(0)
  })

  it('ACCEPTANCE REMEDIATION cycle 5: preserves the existing, UNCHANGED persisted offerDraft.attachments default — a fresh Option genuinely shows the EmptyState, since that literal default matches no real catalog id (unrelated pre-existing behaviour, not something VR2-07 may fix)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    expect(st().offerDraft.attachments).toEqual(['angebot', 'kostentreiber', 'annahmen'])
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByText('Für dieses Angebot sind aktuell keine Artefakte ausgewählt.')).toBeInTheDocument()
    })
  })

  it('translates whatever the seller has genuinely selected in S5Export (offerDraft.attachments) into the client-safe gallery, in the approved target order, without S5Export/state/store.ts defaults ever changing', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    // A seller who has prepared this Option for presentation checks
    // S5Export's own (unchanged) default trio — real, editable state, the
    // same field S5Export's "Artefakte" checklist writes to.
    st().setOfferDraft({ attachments: ['praesentation', 'leistungen', 'ssl'] })
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Diese Unterlagen gehen an Ihren Kunden.' })).toBeInTheDocument()
    })
    // Renders in the catalog's own order (matches the approved target's
    // artefact order for the items the target itself shows), none carrying
    // an unavailable-preview status for this determined-total fixture.
    const titles = screen.getAllByRole('button').map((b) => b.textContent)
      .filter((text) => text === 'Angebotspräsentation (PDF)' || text === 'Leistungen — enthalten / nicht enthalten' || text === 'Schnittstellenmatrix (SSL)')
    expect(titles).toEqual(['Angebotspräsentation (PDF)', 'Leistungen — enthalten / nicht enthalten', 'Schnittstellenmatrix (SSL)'])
    expect(screen.queryByText('Kostenübersicht DIN 276')).not.toBeInTheDocument()
    expect(screen.queryByText(/Vorschau nicht verfügbar/)).not.toBeInTheDocument()
  })

  it('the gallery is driven by real, editable state — a longer/mixed selection genuinely changes the list (generated/mixed-list and long-title states are reachable from real data)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    render(<Harness />)

    // Selecting a longer, non-default set (including the catalog's longest
    // label) genuinely grows the list beyond the fresh-Option EmptyState —
    // a real seller action, not a simulated one (S5Export's own
    // "Artefakte" checklist edits this exact same `offerDraft.attachments`
    // field the gallery reads).
    st().setOfferDraft({ attachments: ['praesentation', 'ssl', 'baubeschreibung', 'vertrag'] })
    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vertragsvorlagen für die Rechtsabteilung' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Schnittstellenmatrix (SSL)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baubeschreibung' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kostenübersicht DIN 276' })).not.toBeInTheDocument()

    // Deselecting everything again returns to the genuine EmptyState.
    st().setOfferDraft({ attachments: [] })
    await waitFor(() => {
      expect(screen.getByText('Für dieses Angebot sind aktuell keine Artefakte ausgewählt.')).toBeInTheDocument()
    })
  })

  it('every available tile is a real, openable button showing genuinely computed data — never the fabricated "Muster" paper-preview or a generation timer', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    st().setOfferDraft({ attachments: ['praesentation', 'kg'] })
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kostenübersicht DIN 276' })).toBeInTheDocument()
    })
    // No simulated generation phase exists anywhere in this component.
    expect(screen.queryByText('Wird vorbereitet …')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Kostenübersicht DIN 276' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    // Real, already-computed data (the same CompositionBar/KG split this
    // page renders elsewhere) — never a "Monochrome A4 Muster" mockup.
    expect(within(dialog).queryByText(/Muster/)).not.toBeInTheDocument()
    expect(within(dialog).getByText('KG-Struktur und kommerzielle Treiber')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Focus returns to the exact tile that opened the dialog.
    expect(trigger).toHaveFocus()
  })

  it('never renders the defensive all-unavailable EmptyState when a real, non-empty selection has a determined total (the EmptyState branch itself exists for DC-30 completeness, not only for the true fresh-Option default)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    st().setOfferDraft({ attachments: ['praesentation', 'kg'] })
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kostenübersicht DIN 276' })).toBeInTheDocument()
    })
    // Real, non-empty selection with a determined total: nothing is marked
    // unavailable and the EmptyState branch stays dormant.
    expect(screen.queryByText(/Vorschau nicht verfügbar/)).not.toBeInTheDocument()
    expect(screen.queryByText('Für dieses Angebot sind aktuell keine Artefakte ausgewählt.')).not.toBeInTheDocument()
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

/** Walks a real fixture Option all the way through Send review to a
 *  genuine immutable snapshot — the same sequence a seller would take, via
 *  the ordinary narrative → Nächster Schritt → Angebot vorbereiten → Angebot
 *  prüfen & senden → Angebot senden path. Used by every VR2-08 test below
 *  that needs an actually-sent Option to reopen/inspect. */
async function sendCurrentOption(user: ReturnType<typeof userEvent.setup>) {
  await gotoSection(user, 'Nächster Schritt')
  await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Angebot prüfen & senden →' })).toBeInTheDocument()
  })
  await user.click(screen.getByRole('button', { name: 'Angebot prüfen & senden →' }))
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
  })
  await user.click(screen.getByRole('button', { name: 'Angebot senden' }))
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Angebot wurde zugestellt.' })).toBeInTheDocument()
  }, { timeout: 4000 })
}

describe('PresentationShell — VR2-08 Send review / Delivered lifecycle', () => {
  it('blocks sending on a genuinely undetermined price, with its own distinct reason from a missing recipient (rule 16, rule 12) — KG 300/400/700 are structurally mandatory (store.ts setCoverage) so a COMPLETE Option can never itself reach total.isZero() live; this Preis-nicht-ermittelt precondition is proportionate defence-in-depth for the same EMAIL-001 §9.3 condition #2, proven directly against PresentationFlowScreen with a real recipient present, so the distinctness from the recipient reason is genuinely exercised', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    const cfg = configForOption(st(), 'OPT-01')!
    const p = projectionForOption(st(), 'OPT-01')!
    const current: Candidate = { id: 'OPT-01', name: 'Option A', cfg, p }

    render(
      <PresentationFlowScreen
        flow="send"
        delivery="sent"
        current={current}
        projectName="Wohnhof Lindenhain"
        priceUnavailable
        galleryArtifacts={[]}
        onPrepare={() => {}}
        onOpenOffer={() => {}}
        canSend={false}
        recipient={{ address: 'kontakt@beispiel-entwickler.example', source: 'HubSpot' }}
        onSend={() => {}}
        sendStatus="idle"
        onRetry={() => {}}
        onOpenSent={() => {}}
        onCloseSnapshot={() => {}}
        onNewVersion={() => {}}
        headingRef={{ current: null }}
      />,
    )

    const sendButton = screen.getByRole('button', { name: 'Angebot senden' })
    expect(sendButton).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText(/Gesamtpreis noch nicht ermittelt/).length).toBeGreaterThan(0)
    // Distinct from the missing-recipient reason — never both messages for
    // one block, and never the missing-recipient text when a real
    // recipient IS present.
    expect(screen.queryByText('Noch kein Empfänger hinterlegt')).not.toBeInTheDocument()

    await user.click(sendButton)
    expect(st().snapshots).toHaveLength(0)
  })

  it('the real Send click shows a genuine, visible "sending" commit state (Button loading, no fabricated percentage) before the snapshot exists', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Angebot prüfen & senden →' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Angebot prüfen & senden →' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })

    const sendButton = screen.getByRole('button', { name: 'Angebot senden' })
    await user.click(sendButton)
    // Real SEND_COMMIT_SIMULATION_MS window: the click has committed but
    // the snapshot does not exist yet — the button shows its own real
    // aria-busy loading state (Button primitive), never a synchronous
    // click-to-success jump.
    expect(sendButton).toHaveAttribute('aria-busy', 'true')
    expect(st().snapshots).toHaveLength(0)

    await waitFor(() => {
      expect(st().snapshots).toHaveLength(1)
    }, { timeout: 2000 })
  })

  it('models the real, spec-defined send-FAILURE branch (EMAIL-007/008 "failed" outcome) at the component level: visible, actionable, no duplicate primary CTA, reviewed content preserved, and a working retry callback — this backend-less prototype has no reachable trigger for a real transport failure to click through live ("Do NOT invent delivery evidence"), so the branch is verified directly against the real, exported PresentationFlowScreen', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    const cfg = configForOption(st(), 'OPT-01')!
    const p = projectionForOption(st(), 'OPT-01')!
    const current: Candidate = { id: 'OPT-01', name: 'Option A', cfg, p }
    let retried = false

    render(
      <PresentationFlowScreen
        flow="send"
        delivery="sent"
        current={current}
        projectName="Wohnhof Lindenhain"
        priceUnavailable={false}
        galleryArtifacts={[]}
        onPrepare={() => {}}
        onOpenOffer={() => {}}
        canSend
        recipient={{ address: 'kontakt@beispiel-entwickler.example', source: 'HubSpot' }}
        onSend={() => {}}
        sendStatus="failed"
        onRetry={() => { retried = true }}
        onOpenSent={() => {}}
        onCloseSnapshot={() => {}}
        onNewVersion={() => {}}
        headingRef={{ current: null }}
      />,
    )

    expect(screen.getByText('Senden fehlgeschlagen')).toBeInTheDocument()
    expect(screen.getByText(/kein Snapshot gespeichert/)).toBeInTheDocument()
    // The failure notice REPLACES the Send action (never a second
    // visually-primary CTA alongside it) and the reviewed recipient
    // section stays visible — failure does not destroy context.
    expect(screen.queryByRole('button', { name: 'Angebot senden' })).not.toBeInTheDocument()
    expect(screen.getByText('Empfänger')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(retried).toBe(true)
  })

  it('POST-SEND RE-ENTRY (M-3): reopening an already-sent Option lands directly on the truthful Delivered state, not the narrative — the ordinary portfolio route must not replay Compose for a project that was already sent', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    const first = render(<Harness />)
    await sendCurrentOption(user)
    expect(st().snapshots).toHaveLength(1)

    // Simulate leaving and re-entering (a fresh mount of the SAME shell
    // against the SAME, now-sent, store state) — the honest equivalent of
    // closing Präsentationsmodus and reopening the Option from the
    // ordinary portfolio/Opportunity card.
    first.unmount()
    render(<Harness />)

    // No click-through required: the Delivered truth is the very first
    // thing rendered, derived from the real snapshot the store already
    // holds — never a reset to 'narrative'.
    expect(screen.getByRole('heading', { name: 'Angebot wurde zugestellt.' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bereit zum Senden' })).not.toBeInTheDocument()
    expect(st().snapshots).toHaveLength(1)
  })

  it('POST-SEND IMMUTABILITY (M-3, SNAPSHOT BINDING): a later, legitimate change to the live artefact selection does not rewrite what the Delivered screen shows was actually sent', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    st().setOfferDraft({ attachments: ['praesentation', 'leistungen'] })
    render(<Harness />)
    await sendCurrentOption(user)

    expect(screen.getByText('Angebotspräsentation (PDF)')).toBeInTheDocument()
    expect(screen.getByText('Leistungen — enthalten / nicht enthalten')).toBeInTheDocument()
    expect(screen.queryByText('Schnittstellenmatrix (SSL)')).not.toBeInTheDocument()

    // A legally editable, later Product edit — the live selection is free
    // to change; the ALREADY-SENT historical snapshot must not follow it.
    st().setOfferDraft({ attachments: ['ssl'] })
    expect(screen.getByText('Angebotspräsentation (PDF)')).toBeInTheDocument()
    expect(screen.getByText('Leistungen — enthalten / nicht enthalten')).toBeInTheDocument()
    expect(screen.queryByText('Schnittstellenmatrix (SSL)')).not.toBeInTheDocument()
  })

  it('Versandnachweis shows the real Gesendet/Zugestellt chronology (EMAIL-007/008: Gesendet ≠ Zugestellt) for the exact sent snapshot', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    render(<Harness />)
    await sendCurrentOption(user)

    await user.click(screen.getByRole('button', { name: 'Versandnachweis' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Gesendet')).toBeInTheDocument()
    expect(within(dialog).getByText('Zugestellt')).toBeInTheDocument()
    expect(within(dialog).getByText(new RegExp(`Snapshot #${st().snapshots[0]!.id}`))).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a normal portfolio re-entry never claims Delivered without a real recipient and a real snapshot — the immutable-snapshot invariant holds even on repeated mounts', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    const first = render(<Harness />)

    await gotoSection(user, 'Nächster Schritt')
    await user.click(screen.getByRole('button', { name: 'Angebot vorbereiten' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Angebot prüfen & senden →' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Angebot prüfen & senden →' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })
    expect(st().snapshots).toHaveLength(0)

    first.unmount()
    render(<Harness />)
    expect(screen.queryByRole('heading', { name: 'Angebot wurde zugestellt.' })).not.toBeInTheDocument()
    expect(st().snapshots).toHaveLength(0)
  })
})
