import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell, PresentationFlowScreen, type Candidate } from '../PresentationShell'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'
import { allServices } from '../../engine/kgConfiguration'
import {
  __resetStoreForTests, configForOption, kgCatalogueFor,
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

/**
 * VR3-05 (T-034): Client Mode opens on its boundary screen, which names the
 * saved Option and asks for one deliberate action. The narrative this suite
 * is about begins after it; the boundary itself is this ticket's own subject
 * and is tested in `client-presentation.desktop.ts`.
 */
async function startPresentation(user: ReturnType<typeof userEvent.setup>) {
  const start = screen.queryByRole('button', { name: 'Präsentation starten' })
  if (start) await user.click(start)
}

/**
 * VR3-05: the route to the offer/send lifecycle.
 *
 * It used to be §6 "Nächster Schritt" → "Angebot vorbereiten". The approved
 * narrative concludes on §6 INVESTITION instead, and the send is reached
 * through the client-safe OUTPUT GATE (T-045), where email is the one
 * channel that requires a saved Option. The lifecycle on the other side —
 * the subject of the tests below — is unchanged.
 */
async function reachOfferFlow(user: ReturnType<typeof userEvent.setup>) {
  await gotoSection(user, 'Investition')
  await user.click(screen.getByRole('button', { name: 'Abschließen & teilen' }))
  await user.click(await screen.findByRole('button', { name: 'Versand vorbereiten' }))
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

/**
 * VR3-04: build ONE saved, client-eligible Option.
 *
 * Same reason as `buildTwoEligibleOptions` below: eligibility is a valid
 * saved baseline, so the three `resolveWflConflict` /
 * `confirmBuildingConfiguration` preambles this replaces can no longer
 * reach Kundenansicht at all. Their subject was never the preamble — it is
 * the narrative with exactly one Option, which is what "no §5 Optionen tab"
 * asserts.
 */
function buildOneEligibleOption(name = 'Solo') {
  enterOptionWorkspace('DEMO-HAPPY-01')
  st().renameOption(st().activeOptionId!, name)
  completeBuildingScope('SHARED')
  completeConfigurationIfCatalogued()
  saveOptionBaseline()
}

/**
 * VR3-04: build two SAVED, client-eligible Options.
 *
 * The precondition was rebuilt, and the reason is the audit's F-002. It used
 * to be enough to confirm the buildings and confirm the configuration —
 * client eligibility was `canBeginConfiguration && configurationComplete`,
 * so an Option nobody had reviewed or saved was already presentable, and
 * the presentation would then be reading a WORKING copy that could still
 * move under a meeting. Eligibility is now a valid SAVED baseline.
 *
 * So each Option walks the real journey: inherit the project baseline, save
 * its building scope, complete its six cost groups, confirm its schedule,
 * read its twelve review sections, confirm the review and save. Driven
 * through the store's own actions — writing a saved version directly would
 * let a broken gate keep this suite green, which is exactly the failure
 * mode the new gate exists to remove.
 */
function buildTwoEligibleOptions(opportunityId = 'DEMO-HAPPY-01') {
  enterOptionWorkspace(opportunityId)
  const first = st().activeOptionId!
  st().renameOption(first, 'Option A')
  completeBuildingScope('SHARED')
  completeConfigurationIfCatalogued()
  st().setEnergiestandard('EH_55')
  saveOptionBaseline()

  const second = st().createOption('Option B')!
  st().openOption(second)
  completeBuildingScope('SHARED')
  completeConfigurationIfCatalogued()
  st().setEnergiestandard('EH_40')
  {
    // The two Options must differ in a way the CURRENT model prices, or the
    // isolation probe compares two identical totals.
    const es = energyStandardServiceId()
    if (es) st().setKgServiceDecision(es, { state: 'selected', variant: 'eh40' })
  }
  saveOptionBaseline()

  st().openOption(first)
  // `setViewedOption` is intentionally a no-op outside Kundenansicht
  // (store.ts: `if (!isClientProjection(s.mode)) return`) — defense in
  // depth so a stale/expired selector click can never mutate presentation
  // state anywhere but inside the client projection. `setMode` itself now
  // requires a valid SAVED baseline, which both Options above have.
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
    buildOneEligibleOption()

    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Optionen' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()

    await gotoSection(user, 'Investition')
  })

  it('uses client-safe English keys for the timeline labels and continuation action', async () => {
    const user = userEvent.setup()
    buildOneEligibleOption()
    st().setUiLanguage('en')

    render(<Harness />)

    // VR3-05: the approved rail is the same six sections in either locale.
    for (const label of ['Project', 'Buildings', 'Scope', 'Services', 'Schedule', 'Investment']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByText('Bauzeit ab OKBP')).toBeNull()

    await gotoSection(user, 'Schedule')
    // Durations are localised through `Intl`, never concatenated (rule 36).
    expect(screen.getAllByText(/\d+(?:\.\d+)? mo/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 2, name: 'Sequence' })).toBeInTheDocument()
  })

  /**
   * RETIRED IN VR3-05, AND DELIBERATELY NOT REPLACED HERE — see the change
   * manifest's OPEN QUESTION.
   *
   * This case guarded rule 40 / D-15 on the CLIENT side: §3 Ergebnis carried
   * a Kostentreiber extract, and an inactive Regionalfaktor had to appear in
   * it as a "nicht berücksichtigt" row. The approved VR3-05 narrative
   * (T-040) replaces that extract with the Option's INVESTMENT COMPOSITION
   * by cost group, and the target's own PDF content list names "client
   * narrative, buildings, scope, services, schedule, commercial result,
   * Option/version/date and approved assumptions" — no Kostentreiber.
   *
   * That is a genuine conflict with CLAUDE.md rule 35 ("Kostentreiber …
   * geht in den Kunden-PDF"), between the project's standing rule and this
   * ticket's approved target. Deciding it silently in either direction is
   * exactly what the source-of-truth rule forbids, so it is RAISED rather
   * than resolved: no Kostentreiber panel was invented for the client
   * narrative, and no rule-40 assertion is left standing against a surface
   * that no longer exists. The internal Kostentreiber (OfferPanel) is
   * untouched and its own coverage is unchanged.
   */
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
    await startPresentation(user)

    // Vor dem Wechsel: §5 Optionen existiert (≥2 eligible), Option A ist
    // markiert "Wird präsentiert", §3 zeigt A's Hero.
    await gotoSection(user, 'Investition')
    const optionen = screen.getByRole('region', { name: 'Investition' })
    // VR3-05: comparison moved into §6 beside the number it compares, so a
    // "tile" is now a ROW of that panel. The subject is unchanged — which
    // Option is marked as presented, and that switching never touches
    // preparation state.
    // Scoped to the comparison panel: §6's own metric grid also names the
    // presented Option, and "which row" is the question here.
    const compare = within(optionen)
      .getByRole('region', { name: 'Weitere gespeicherte Optionen' })
    const rowOf = (name: string) =>
      within(compare).getByText(name).closest('.a3-client-row') as HTMLElement
    expect(rowOf('Option A')).toHaveTextContent('Wird präsentiert')
    expect(rowOf('Option B')).not.toHaveTextContent('Wird präsentiert')

    await gotoSection(user, 'Investition')
    const ergebnisBefore = screen.getByRole('region', { name: 'Investition' })
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
    const ergebnisAfter = screen.getByRole('region', { name: 'Investition' })
    expect(ergebnisAfter.textContent).not.toBe(heroBefore)

    await gotoSection(user, 'Investition')
    const optionenAfter = screen.getByRole('region', { name: 'Investition' })
    const compareAfter = within(optionenAfter)
      .getByRole('region', { name: 'Weitere gespeicherte Optionen' })
    const rowAfter = (name: string) =>
      within(compareAfter).getByText(name).closest('.a3-client-row') as HTMLElement
    expect(rowAfter('Option A')).not.toHaveTextContent('Wird präsentiert')
    expect(rowAfter('Option B')).toHaveTextContent('Wird präsentiert')

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
    await startPresentation(user)
    await gotoSection(user, 'Investition')
    const optionen = screen.getByRole('region', { name: 'Investition' })
    const compareB = within(optionen)
      .getByRole('region', { name: 'Weitere gespeicherte Optionen' })
    const tileB = within(within(compareB).getByText('Option B')
      .closest('.a3-client-row') as HTMLElement)
      .getByRole('button', { name: 'Ansehen' })
    await user.click(tileB)

    expect(st().viewedOptionId).toBe('OPT-02')
    expect(st().activeOptionId).toBe('OPT-01')
  })

  it('keeps the viewed Option through offer review and blocks sending without a recipient', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)
    await startPresentation(user)

    await reachOfferFlow(user)
    await waitFor(() => {
      // VR2-07: the commercial-climax headline names the project. VR3-04's
      // precondition walks the real journey, so an Opportunity IS open and
      // the headline names it — the `|| fallback` subject ("Ihr Projekt")
      // now belongs to the harness shapes that genuinely have no project,
      // which is what it was always for.
      expect(screen.getByRole('heading', { name: 'Wohnhof Lindenhain bekommt kommerzielle Kontur.' })).toBeInTheDocument()
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
    // VR3-04 raised this one timeout, and owns the reason. The comment above
    // already recorded the race: the section transition is genuinely
    // asynchronous, and the default `findBy` window is one second. This
    // suite's precondition now walks the whole journey twice per test (the
    // save gate requires it), so under full-suite load that window closed
    // first about half the time. The component's behaviour is correct; the
    // window was too small for the work the test now does around it.
    await user.click(await screen.findByRole(
      'button', { name: 'Angebot prüfen & senden →' }, { timeout: 8000 },
    ))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })
    // VR2-08: the subject line now names the PROJECT (what a real email
    // subject would read), not the internal Option name.
    expect(screen.getByText(/Indikatives Angebot · Wohnhof Lindenhain/)).toBeInTheDocument()

    // VR3-04 SPLIT THIS ASSERTION, and the split is a consequence of the
    // new save gate rather than a weakening.
    //
    // The recipient is resolved from the OPPORTUNITY
    // (`recipientForOpportunity`), and both demonstration projects have
    // one. Client eligibility now requires a saved baseline, which requires
    // a project's schedule and building scope — so "a presentable Option
    // whose project has no validated recipient" is no longer a reachable
    // state, and asserting it here would mean building an Option that
    // cannot be presented in the first place.
    //
    // The recipient block itself is proved directly against
    // `PresentationFlowScreen` with `recipient={null}` in the missing-
    // recipient test below — the same direct-prop pattern this suite
    // already uses for the undetermined-price block, and for the same
    // reason: it exercises the condition rather than a route to it.
    //
    // What stays HERE is what this test is named for: the VIEWED Option
    // survives the whole offer review, and the internal active Option is
    // never touched by it.
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBe('OPT-02')
    expect(st().snapshots).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
  })

  it('blocks sending without a validated recipient, with its own distinct reason (EMAIL-001 §9.3 condition #1)', () => {
    // Direct against the flow screen, exactly like the undetermined-price
    // case: the state "no validated recipient" belongs to the OPPORTUNITY
    // and not to the Option, so a route through a presentable Option
    // cannot reach it any more (see the note above).
    buildTwoEligibleOptions()
    const cfg = configForOption(st(), st().activeOptionId!)!
    const p = projectionForOption(st(), st().activeOptionId!)!
    const current: Candidate = { id: st().activeOptionId!, name: 'Option A', cfg, p }
    render(
      <PresentationFlowScreen
        flow="send"
        delivery="sent"
        current={current}
        projectName="Wohnhof Lindenhain"
        galleryArtifacts={[]}
        onPrepare={() => {}}
        onOpenOffer={() => {}}
        priceUnavailable={false}
        canSend={false}
        recipient={null}
        onSend={() => {}}
        sendStatus="idle"
        onRetry={() => {}}
        onOpenSent={() => {}}
        onCloseSnapshot={() => {}}
        onNewVersion={() => {}}
        headingRef={{ current: null }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Angebot senden' }))
      .toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText('Noch kein Empfänger hinterlegt')).not.toHaveLength(0)
  })

  it('enables the validated recipient flow and creates exactly one immutable snapshot', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    render(<Harness />)
    await startPresentation(user)

    await reachOfferFlow(user)
    await waitFor(() => {
      // opportunityId='DEMO-HAPPY-01' here, so the real project name applies.
      expect(screen.getByRole('heading', { name: 'Wohnhof Lindenhain bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })
    // Same transition race as above (findByRole, not getByRole).
    // VR3-04 raised this one timeout, and owns the reason. The comment above
    // already recorded the race: the section transition is genuinely
    // asynchronous, and the default `findBy` window is one second. This
    // suite's precondition now walks the whole journey twice per test (the
    // save gate requires it), so under full-suite load that window closed
    // first about half the time. The component's behaviour is correct; the
    // window was too small for the work the test now does around it.
    await user.click(await screen.findByRole(
      'button', { name: 'Angebot prüfen & senden →' }, { timeout: 8000 },
    ))
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
    await startPresentation(user)

    await reachOfferFlow(user)
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
    await startPresentation(user)

    await reachOfferFlow(user)
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
    await startPresentation(user)

    await reachOfferFlow(user)
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
    await startPresentation(user)

    // Selecting a longer, non-default set (including the catalog's longest
    // label) genuinely grows the list beyond the fresh-Option EmptyState —
    // a real seller action, not a simulated one (S5Export's own
    // "Artefakte" checklist edits this exact same `offerDraft.attachments`
    // field the gallery reads).
    st().setOfferDraft({ attachments: ['praesentation', 'ssl', 'baubeschreibung', 'vertrag'] })
    await reachOfferFlow(user)
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
    await startPresentation(user)

    await reachOfferFlow(user)
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
    await startPresentation(user)

    await reachOfferFlow(user)
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
    // VR3-05: no rail item is current on the T-034 boundary — the
    // presentation has not started, so nothing may claim to be the section
    // the reader is in. Exactly one H1 holds there too.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const railBefore = screen.getByRole('navigation', { name: 'Präsentation' })
    expect(within(railBefore).queryByRole('button', { current: true })).toBeNull()

    await startPresentation(user)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    const bar = screen.getByRole('navigation', { name: 'Präsentation' })
    const projektTab = within(bar).getByRole('button', { name: 'Projekt' })
    expect(projektTab).toHaveAttribute('aria-current', 'true')
    const ergebnisTab = within(bar).getByRole('button', { name: 'Investition' })
    expect(ergebnisTab).not.toHaveAttribute('aria-current')

    await user.click(ergebnisTab)
    expect(ergebnisTab).toHaveAttribute('aria-current', 'true')
    expect(projektTab).not.toHaveAttribute('aria-current')
    // The narrative stays a one-document-at-a-time model: exactly one H1
    // still exists after navigating to a different narrative page.
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Investition' })).toBeInTheDocument()
    })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('announces the presented Option change via a single polite live region', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)
    await startPresentation(user)

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
  await reachOfferFlow(user)
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
    await startPresentation(user)

    await reachOfferFlow(user)
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
    await startPresentation(user)

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
    await startPresentation(user)
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
    await startPresentation(user)
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

    await reachOfferFlow(user)
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
