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
 * VR3-CP-00 — PresentationShell, the ten-chapter proposal narrative.
 *
 * Rendered directly against the store (the same lightweight pattern
 * `comparison.dom.test.tsx` uses for `S4Vergleich`/`OfferPanel`), not
 * through the full `<App/>` click-through — `setViewedOption`'s guard is
 * independent of `s.mode`, so this proves the shell's OWN contract.
 *
 * Structure the tests navigate: entering Client Mode lands directly on
 * chapter 1 (no entry boundary). ONE presenter bar (`region` "Präsentation")
 * carries the chapter rail (`nav` "Kapitel": buttons labelled `n · <chapter>`,
 * `aria-current="step"` on the current one), the what-if slot, `Varianten · N`
 * (only at ≥ 2 eligible Options; opens the Varianten layer whose
 * `<option> zeigen` buttons are the ONE way to switch the presented Option),
 * a `role="status"` live region naming the presented Option, DE/EN, Beenden.
 * A chapter is a `<section aria-label=<chapter>>` with exactly one `<h1>`,
 * mounted only while current. Outputs live in chapter 10 "Nächster Schritt";
 * the email card leads into the preserved VR2-08 send lifecycle, and the rail
 * is the way back. The invariants below (Client Option Isolation, one H1,
 * keyboard-operable rail, single polite live region, send lifecycle,
 * immutable snapshot) are unchanged — only how the test REACHES them changed.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** Every rail button is labelled `n · <chapter>`; the label is the key. */
const railButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`· ${label}$`) })

/** Clicks a rail button and waits for its chapter (same accessible name,
 * `aria-label` on the `<section>`) to actually mount — the chapter
 * cross-fade (rule 20, `AnimatePresence mode="wait"`) resolves on a real
 * `requestAnimationFrame`/`setTimeout` tick, not synchronously with the
 * click. */
async function gotoChapter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(railButton(label))
  await waitFor(() => expect(screen.getByRole('region', { name: label })).toBeInTheDocument())
}

/**
 * The route to the offer/send lifecycle: chapter 10 "Nächster Schritt" →
 * the email card's "Versand vorbereiten" (the one channel that requires a
 * saved Option). The lifecycle on the other side — the subject of the VR2-08
 * tests below — is unchanged.
 */
async function reachOfferFlow(user: ReturnType<typeof userEvent.setup>) {
  await gotoChapter(user, 'Nächster Schritt')
  await user.click(await screen.findByRole('button', { name: 'Versand vorbereiten' }))
}

/** Switches the presented Option through the Varianten layer — the ONE
 * client-side switch control — and waits for the layer to close. */
async function showOption(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /^Varianten · \d+$/ }))
  const layer = await screen.findByRole('dialog')
  await user.click(within(layer).getByRole('button', { name: `${name} zeigen` }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

/** The screen's own H1s. The printed sheet (`.a3-client-print-doc`) is
 * mounted for `@media print` only — `display:none` on screen, so it is out
 * of the screen's accessibility tree in a browser, which jsdom (no
 * stylesheet) cannot reproduce. It carries no `aria-hidden` by design. */
const screenH1s = () =>
  screen.getAllByRole('heading', { level: 1 })
    .filter((h) => !h.closest('.a3-client-print-doc'))

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

/** VR3-04: build ONE saved, client-eligible Option — eligibility is a valid
 *  saved baseline, walked through the store's own actions — and enter Client
 *  Mode, where the chapter position (`setPresentationChapter`) is writable. */
function buildOneEligibleOption(name = 'Solo') {
  enterOptionWorkspace('DEMO-HAPPY-01')
  st().renameOption(st().activeOptionId!, name)
  completeBuildingScope('SHARED')
  completeConfigurationIfCatalogued()
  saveOptionBaseline()
  st().setMode('praesentation')
}

/**
 * VR3-04: build two SAVED, client-eligible Options.
 *
 * Each Option walks the real journey: inherit the project baseline, save its
 * building scope, complete its six cost groups, confirm its schedule, read
 * its twelve review sections, confirm the review and save. Driven through
 * the store's own actions — writing a saved version directly would let a
 * broken gate keep this suite green.
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

  it('renders the full narrative with exactly one eligible Option, with the Varianten affordance ABSENT rather than disabled', async () => {
    const user = userEvent.setup()
    buildOneEligibleOption()

    render(<Harness />)
    // No entry boundary: chapter 1 is the first thing on screen.
    expect(screen.getByRole('region', { name: 'Angebot' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Präsentation starten' })).toBeNull()
    // One Option: nothing to compare, so no `Varianten · N` and no switcher
    // of any shape.
    expect(screen.queryByRole('button', { name: /^Varianten/ })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()

    await gotoChapter(user, 'Preiszusammensetzung')
  })

  it('uses client-safe English keys for the chapter rail and the schedule chapter', async () => {
    const user = userEvent.setup()
    buildOneEligibleOption()
    st().setUiLanguage('en')

    render(<Harness />)

    // The eight unconditional chapters, in the rail, in the reader's language.
    for (const label of [
      'Proposal', 'Project overview', 'The project', 'Price composition',
      'Scope of services', 'Schedule', 'Basis & assumptions', 'Next step',
    ]) {
      expect(railButton(label)).toBeInTheDocument()
    }
    // Every rail item is numbered `n · <chapter>` — never a bare numeral.
    const rail = screen.getByRole('navigation', { name: 'Chapters' })
    for (const item of rail.querySelectorAll('.a3-cp-rail-item')) {
      expect(item.getAttribute('aria-label')).toMatch(/^\d+ · \S/)
    }
    expect(screen.queryByText('Bauzeit ab OKBP')).toBeNull()

    await gotoChapter(user, 'Schedule')
    const schedule = screen.getByRole('region', { name: 'Schedule' })
    // Durations are localised through `Intl`, never concatenated (rule 36).
    expect(within(schedule).getAllByText(/\d+(?:\.\d+)? months/).length).toBeGreaterThan(0)
    expect(schedule).toHaveTextContent('Sequence')
    expect(schedule).not.toHaveTextContent('Monate')
  })
})

describe('PresentationShell — mandatory Client Option Isolation Test (AC 5/15/16/21)', () => {
  it('switching the presented Option through the Varianten layer updates the narrative coherently, without ever mutating activeOptionId', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    expect(st().activeOptionId).toBe('OPT-01')
    // Initial-continuity rule: entering Kundenansicht starts the
    // presentation-only viewed Option at the internally active one.
    expect(st().viewedOptionId).toBe('OPT-01')

    render(<Harness />)

    // Before the switch: the Varianten layer marks A as the one shown.
    await gotoChapter(user, 'Projektüberblick')
    const heroBefore = screen.getByRole('region', { name: 'Projektüberblick' }).textContent

    await user.click(screen.getByRole('button', { name: 'Varianten · 2' }))
    const layer = await screen.findByRole('dialog')
    const column = (name: string) =>
      within(layer).getByRole('columnheader', { name: new RegExp(`^${name}`) })
    expect(column('Option A')).toHaveTextContent('wird gezeigt')
    expect(column('Option B')).not.toHaveTextContent('wird gezeigt')
    // The presented Option has no "show" button; the other one does.
    expect(within(layer).queryByRole('button', { name: 'Option A zeigen' })).toBeNull()
    await user.click(within(layer).getByRole('button', { name: 'Option B zeigen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Isolation: activeOptionId stays A, only viewedOptionId changes.
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBe('OPT-02')

    // ONE coherent update: the bar names B, the chapter position is kept
    // and the hero restates B's number.
    expect(screen.getByRole('status')).toHaveTextContent('Option B')
    expect(st().presentationChapter).toBe('ueberblick')
    const heroAfter = screen.getByRole('region', { name: 'Projektüberblick' }).textContent
    expect(heroAfter).not.toBe(heroBefore)

    await user.click(screen.getByRole('button', { name: 'Varianten · 2' }))
    const layerAfter = await screen.findByRole('dialog')
    const columnAfter = (name: string) =>
      within(layerAfter).getByRole('columnheader', { name: new RegExp(`^${name}`) })
    expect(columnAfter('Option A')).not.toHaveTextContent('wird gezeigt')
    expect(columnAfter('Option B')).toHaveTextContent('wird gezeigt')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Exit: the real production path (`s.setMode('intern')`, what the exit
    // action calls) discards viewedOptionId entirely; internal A stays
    // untouched.
    st().setMode('intern')
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBeNull()
  })

  it('the Varianten layer is the ONE switch control: it keeps the chapter position and there is no second switcher in the bar', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()

    render(<Harness />)
    // The retired top-bar "Ansicht" switcher and the §6 comparison panel are
    // gone; a client-facing mutation lives in exactly one labelled layer.
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weitere gespeicherte Optionen' })).toBeNull()

    await gotoChapter(user, 'Preiszusammensetzung')
    await showOption(user, 'Option B')

    expect(st().viewedOptionId).toBe('OPT-02')
    expect(st().activeOptionId).toBe('OPT-01')
    // Same chapter, same narrative position — a client asking for the other
    // variant has not left the story.
    expect(st().presentationChapter).toBe('preis')
    expect(screen.getByRole('region', { name: 'Preiszusammensetzung' })).toBeInTheDocument()
  })

  it('keeps the viewed Option through offer review and blocks sending without a recipient', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    // Switching the presented Option from INSIDE the send lifecycle returns
    // to the story at the same chapter (the rail is the way back; a switch
    // is not a send step).
    await reachOfferFlow(user)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Wohnhof Lindenhain bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })
    await showOption(user, 'Option B')
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().viewedOptionId).toBe('OPT-02')
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Nächster Schritt' })).toBeInTheDocument()
    })

    // Now the review is walked FOR the viewed Option B.
    await user.click(await screen.findByRole('button', { name: 'Versand vorbereiten' }))
    await waitFor(() => {
      // VR2-07: the commercial-climax headline names the project.
      expect(screen.getByRole('heading', { name: 'Wohnhof Lindenhain bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })
    // `findByRole`: the flow screens live in an `AnimatePresence mode="wait"`,
    // so the button is legitimately absent for a tick after the transition.
    await user.click(await screen.findByRole(
      'button', { name: 'Angebot prüfen & senden →' }, { timeout: 8000 },
    ))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Bereit zum Senden' })).toBeInTheDocument()
    })
    // VR2-08: the subject line names the PROJECT (what a real email subject
    // would read), not the internal Option name.
    expect(screen.getByText(/Indikatives Angebot · Wohnhof Lindenhain/)).toBeInTheDocument()

    // The recipient is resolved from the OPPORTUNITY, and both demonstration
    // projects have one, so "presentable Option without a validated
    // recipient" is not a reachable state here; the recipient block is
    // proved directly against `PresentationFlowScreen` below. What stays
    // HERE is what this test is named for: the VIEWED Option survives the
    // whole offer review, and the internal active Option is never touched.
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

    await reachOfferFlow(user)
    await waitFor(() => {
      // opportunityId='DEMO-HAPPY-01' here, so the real project name applies.
      expect(screen.getByRole('heading', { name: 'Wohnhof Lindenhain bekommt kommerzielle Kontur.' })).toBeInTheDocument()
    })
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

    await reachOfferFlow(user)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: `Wohnhof Lindenhain bekommt kommerzielle Kontur.` })).toBeInTheDocument()
    })
    // The eyebrow interpolates the full Option name verbatim — a fixed-width
    // container or an ellipsis/truncation rule would silently drop part of
    // it; this asserts the complete string is actually in the DOM (also
    // matched by the bar's own status region, hence "some").
    const matches = screen.getAllByText(new RegExp(longName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(matches.length).toBeGreaterThan(0)
  })

  it('ACCEPTANCE REMEDIATION cycle 5: preserves the existing, UNCHANGED persisted offerDraft.attachments default — a fresh Option genuinely shows the EmptyState, since that literal default matches no real catalog id (unrelated pre-existing behaviour, not something VR2-07 may fix)', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    expect(st().offerDraft.attachments).toEqual(['angebot', 'kostentreiber', 'annahmen'])
    render(<Harness />)

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
  it('exposes exactly one H1 and a keyboard-operable chapter rail with aria-current', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    // Direct entry: chapter 1 is current from the first render, and it is
    // the one H1 on screen.
    expect(screenH1s()).toHaveLength(1)
    const rail = screen.getByRole('navigation', { name: 'Kapitel' })
    expect(rail.closest('[role="region"]')).toHaveAccessibleName('Präsentation')
    const angebot = within(rail).getByRole('button', { name: '1 · Angebot' })
    const preis = within(rail).getByRole('button', { name: /· Preiszusammensetzung$/ })
    expect(angebot).toHaveAttribute('aria-current', 'step')
    expect(preis).not.toHaveAttribute('aria-current')
    // Exactly one current step in the rail.
    expect(within(rail).getAllByRole('button', { current: 'step' })).toHaveLength(1)

    await user.click(preis)
    expect(preis).toHaveAttribute('aria-current', 'step')
    expect(angebot).not.toHaveAttribute('aria-current')
    // The narrative stays a one-document-at-a-time model: exactly one H1
    // still exists after navigating to a different chapter, and it is the
    // chapter's own title, focused.
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Preiszusammensetzung' })).toBeInTheDocument()
    })
    expect(screenH1s()).toHaveLength(1)
    await waitFor(() => expect(screenH1s()[0]).toHaveFocus())

    // Keyboard: the step buttons are real controls — Enter on "Nächstes
    // Kapitel" moves the current step, and the rail says so.
    within(rail).getByRole('button', { name: 'Nächstes Kapitel' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(within(rail).getByRole('button', { name: /· Leistungsumfang$/ }))
        .toHaveAttribute('aria-current', 'step')
    })
    expect(preis).not.toHaveAttribute('aria-current')
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Leistungsumfang' })).toBeInTheDocument()
    })
    expect(screenH1s()).toHaveLength(1)
  })

  it('announces the presented Option change via a single polite live region', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    render(<Harness />)

    const live = () => document.querySelectorAll('[aria-live="polite"]')
    expect(live()).toHaveLength(1)
    expect(live()[0]).toHaveAttribute('role', 'status')
    expect(live()[0]!.textContent).toMatch(/Option A/)

    await showOption(user, 'Option B')

    expect(live()).toHaveLength(1)
    expect(live()[0]!.textContent).toMatch(/Option B/)
    expect(live()[0]!.textContent).not.toMatch(/Option A/)
  })
})

/** Walks a real fixture Option all the way through Send review to a
 *  genuine immutable snapshot — the same sequence a seller would take, via
 *  chapter 10 → Versand vorbereiten → Angebot prüfen & senden → Angebot
 *  senden. Used by every VR2-08 test below that needs an actually-sent
 *  Option to reopen/inspect. */
async function sendCurrentOption(user: ReturnType<typeof userEvent.setup>) {
  await reachOfferFlow(user)
  await user.click(await screen.findByRole(
    'button', { name: 'Angebot prüfen & senden →' }, { timeout: 8000 },
  ))
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

    await reachOfferFlow(user)
    await user.click(await screen.findByRole(
      'button', { name: 'Angebot prüfen & senden →' }, { timeout: 8000 },
    ))
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
    // holds — never a reset to chapter 1.
    expect(screen.getByRole('heading', { name: 'Angebot wurde zugestellt.' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bereit zum Senden' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Angebot' })).toBeNull()
    expect(st().snapshots).toHaveLength(1)
  })

  it('POST-SEND IMMUTABILITY (M-3, SNAPSHOT BINDING): a later, legitimate change to the live artefact selection does not rewrite what the Delivered screen shows was actually sent', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    st().setOfferDraft({ attachments: ['praesentation', 'leistungen'] })
    render(<Harness />)
    await sendCurrentOption(user)

    // Scoped to the Delivered card: the print document (mounted for
    // `@media print`) lists the LIVE artefact selection by reference and is
    // not the subject here.
    const card = screen.getByRole('heading', { name: 'Angebot wurde zugestellt.' })
      .closest('section') as HTMLElement
    expect(within(card).getByText('Angebotspräsentation (PDF)')).toBeInTheDocument()
    expect(within(card).getByText('Leistungen — enthalten / nicht enthalten')).toBeInTheDocument()
    expect(within(card).queryByText('Schnittstellenmatrix (SSL)')).not.toBeInTheDocument()

    // A legally editable, later Product edit — the live selection is free
    // to change; the ALREADY-SENT historical snapshot must not follow it.
    st().setOfferDraft({ attachments: ['ssl'] })
    expect(within(card).getByText('Angebotspräsentation (PDF)')).toBeInTheDocument()
    expect(within(card).getByText('Leistungen — enthalten / nicht enthalten')).toBeInTheDocument()
    expect(within(card).queryByText('Schnittstellenmatrix (SSL)')).not.toBeInTheDocument()
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

  it('the chapter rail is the way back from the send lifecycle, and it lands in the narrative at that chapter', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions('DEMO-HAPPY-01')
    render(<Harness />)
    await sendCurrentOption(user)

    // No rail item is current while a flow screen is on stage …
    const rail = screen.getByRole('navigation', { name: 'Kapitel' })
    expect(within(rail).queryByRole('button', { current: 'step' })).toBeNull()
    // … and a rail click returns to the story at exactly that chapter.
    await gotoChapter(user, 'Preiszusammensetzung')
    expect(within(rail).getByRole('button', { name: /· Preiszusammensetzung$/ }))
      .toHaveAttribute('aria-current', 'step')
    expect(screen.queryByRole('heading', { name: 'Angebot wurde zugestellt.' })).not.toBeInTheDocument()
    expect(st().snapshots).toHaveLength(1)
  })

  it('a normal portfolio re-entry never claims Delivered without a real recipient and a real snapshot — the immutable-snapshot invariant holds even on repeated mounts', async () => {
    const user = userEvent.setup()
    buildTwoEligibleOptions()
    const first = render(<Harness />)

    await reachOfferFlow(user)
    await user.click(await screen.findByRole(
      'button', { name: 'Angebot prüfen & senden →' }, { timeout: 8000 },
    ))
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
