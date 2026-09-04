import {
  useCallback, useEffect, useId, useRef, useState,
  type Ref, type RefObject,
} from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion } from 'framer-motion'
import { demoProject } from '../state/projectAnalysis'
import all3Logo from '../../design-system/All3Logo.png'
import {
  clientBaselineSnapshot, clientPresentedSnapshot, configForOption,
  eligibleClientOptions, latestSavedOptionVersion, projectionForOption,
  resolvedViewedOptionId, useStore, type OfferSnapshot, type OptionConfig,
  type Projection,
} from '../state/store'
import {
  NARRATIVE_SECTIONS, PageBuildings, PageInvestment, PageProjectIdentity,
  PageScopeStory, PageScheduleStory, PresentationEntry, SECTION_LABEL_KEY,
  type ClientView, type NarrativeSectionId,
} from './ClientNarrative'
import {
  PageServices, ScenarioBar, ScenarioRevertDialog, ScenarioSaveDialog,
  ScenarioSaveReceipt, ScheduleScenarioSlot,
} from './ClientScenario'
import { ClientPrintDocument, PageOutputs } from './ClientOutputs'
import { signedMoneyText } from '../design-system/CommercialNumber'
import type { SavedOptionVersion } from '../state/optionSave'
import { NNBSP, present, label as moneyLabel } from '../engine/money'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { recipientForOpportunity, type ValidatedRecipient } from '../state/emailRecipient'
import { SelectField } from './designSystem'
import { SegmentedControl } from './controls'
import { PartialState, EmptyState } from './DataStates'
import { Dialog } from './Dialog'
import { OFFER_ARTIFACTS, type OfferArtifactId } from '../config/offer-artifacts'
import { DELIVERY_SIMULATION_MS, SEND_COMMIT_SIMULATION_MS } from '../config/ui-policy'
// F-38 (OfferPanel.tsx): `signed` is exported specifically for cross-
// component reuse of the ONE signed-delta formatter — reused here for
// "Größter Treiber" instead of a second, divergence-prone formatter.
import { signed } from './OfferPanel'
import { CompositionBar } from '../design-system/CompositionBar'
import { buildKgCompositionSegments } from './costComposition'
import { useSemanticMotion } from '../design-system/motion'
import { Button, useCountUp } from './primitives'
import { projectDriversForClient, translatedDriverLabel } from '../state/clientProjection'
import { startContinuityTransition } from '../design-system/motion'

/**
 * PresentationShell — VR2-06 client narrative shell.
 *
 * The Present shell is its own composition, not the Work three-pane shell
 * with controls hidden: it owns ONE top bar (`ALL3` brand + narrative strip
 * + a compact Ansicht/mode/exit/language cluster, `App.tsx` renders no
 * `AppHeader` while `praesentation` is true) and shows exactly ONE
 * full-bleed narrative page at a time (`SECTION_ORDER`/`activeSection`)
 * instead of a scrolled stack of `SectionSheet` cards — the structural gap
 * `visual-recovery-audit-v2` named ("Present is separate from Work but not
 * a genuinely client narrative … sections read as stacked Product panels
 * rather than a sales narrative"). Every node below is either a canonical
 * All3 primitive (`MediaFrame`, `CompositionBar`, `ScheduleGantt`,
 * `SegmentedControl`, `SelectField`, `Badge`) or a product composition of
 * them; no parallel Design System exists here (VR2-06 DESIGN SYSTEM MODE:
 * PRESERVE).
 *
 * The single source of "which Option is currently shown" remains
 * `resolvedViewedOptionId`/`setViewedOption` (Wave 1, `store.ts`) — no
 * section here reads `activeOptionId` for display, and switching the
 * viewed Option (top-bar Ansicht control or the §5 Optionen cards) never
 * mutates the internal active/preparation Option (VR2-06's CRITICAL CLIENT
 * MODE OPTION INVARIANT). Every page is a pure function of
 * `configForOption(viewedId)`/`projectionForOption(viewedId)`.
 */

export type Candidate = { id: string; name: string; cfg: OptionConfig; p: Projection }
/**
 * VR3-05 adds two phases at the two ends of the narrative.
 *
 * `entry` is the client-safety boundary made visible (T-034): Client Mode is
 * entered deliberately, naming the saved Option, or it is not a boundary at
 * all. `outputs` is the conclusion (T-045), where a state acquires an
 * AUTHORITY before it leaves the room.
 *
 * The middle — offer/send/sent/delivered/snapshot — is VR2-08's released
 * send lifecycle, reached from `outputs` by the one channel that requires a
 * saved Option. It is preserved rather than rebuilt: the immutable snapshot,
 * the validated recipient and the delivery proof are exactly what "email
 * requires a saved Option" needs on the other side of the gate.
 */
type PresentationFlow =
  | 'entry' | 'narrative' | 'outputs'
  | 'offer' | 'send' | 'sent' | 'delivered' | 'snapshot'

function buildCandidate(
  s: Parameters<typeof configForOption>[0],
  id: string,
  name: string,
): Candidate | null {
  const cfg = configForOption(s, id)
  const p = projectionForOption(s, id)
  return cfg && p ? { id, name, cfg, p } : null
}

/* `money(d)` stood here and formatted a Decimal straight off the legacy
   proposal projection. Its last two callers were the Option switcher's
   announcement and its >3-Option select, both of which now read the saved
   Option's own committed total like everything else. A helper whose only
   purpose is to print the second engine's number is removed rather than
   left as an invitation. */

function durationNumber(duration: Projection['duration'], language: 'de' | 'en'): string {
  const number = duration.display.replace(`${NNBSP}Monate`, '')
  return localizeMoneyText(number, language)
}


function includedBuildingIdsOf(cfg: OptionConfig): string[] {
  return Object.keys(cfg.buildings).filter((id) => cfg.included[id])
}

function buildingNames(cfg: OptionConfig): string {
  return includedBuildingIdsOf(cfg)
    .map((id) => cfg.buildings[id]?.stableName ?? id)
    .join(' · ')
}

type TopDriver = { label: string; exact: Decimal }

/** VR2-07 — Größter Treiber (Offer stage): the same client-safe Kostentreiber
 *  projection/aggregation §3 ERGEBNIS already uses (`projectDriversForClient`,
 *  building-prefix stripping, same-label aggregation), extracted so the
 *  Offer climax can read off the single biggest driver without duplicating
 *  §3's own tested computation inline. §3 itself is untouched — this is a
 *  new pure function, not a refactor of already-released, already-tested
 *  code. */
function topCostDrivers(current: Candidate, t: ReturnType<typeof useT>): TopDriver[] {
  const { p, cfg } = current
  const clientDrivers = projectDriversForClient(p.result.drivers, 'praesentation', cfg.kg800ClientRevealed)
  const includedIds = includedBuildingIdsOf(cfg)
  const stripBuildingPrefix = (key: string): string => {
    if (includedIds.length <= 1) return key
    const owner = includedIds.find((id) => key.startsWith(`${id}:`))
    return owner ? key.slice(owner.length + 1) : key
  }
  const byLabel = new Map<string, TopDriver>()
  for (const d of clientDrivers) {
    const strippedKey = stripBuildingPrefix(d.key)
    // The base-service contribution ('basis'/'basis_s') is the Grundleistung
    // itself, not a driver of the price beyond it — the same distinction
    // OfferPanel's own "Im Angebot gewählt" recap already draws (its
    // `looseChosen`/`looseExcluded` rows never include the base). Excluded
    // here so "Größter Treiber" names an actual deviation (e.g.
    // "Untergeschoss"), never the base package itself.
    if (strippedKey === 'basis' || strippedKey === 'basis_s') continue
    const label = translatedDriverLabel({ ...d, key: strippedKey }, t)
    const existing = byLabel.get(label)
    if (existing) existing.exact = existing.exact.plus(d.exact)
    else byLabel.set(label, { label, exact: d.exact })
  }
  return [...byLabel.values()].sort((a, b) => b.exact.abs().minus(a.exact.abs()).toNumber())
}

export type GalleryArtifact = {
  id: OfferArtifactId
  title: string
  description: string
  available: boolean
  unavailableReason?: string
}

/** Shared artefact-review source (VR2-08): the SAME real selection
 *  (`s.offerDraft.attachments` against `OFFER_ARTIFACTS`, VR2-07's shared
 *  catalog) OfferClimax already reads, now also consumed by the Send
 *  review and Delivered screens — one list, one truth, never a second
 *  static stand-in list drifting from the seller's actual choice. */
function buildGalleryArtifacts(
  attachments: readonly string[],
  priceUnavailable: boolean,
  t: ReturnType<typeof useT>,
): GalleryArtifact[] {
  const selectedIds = new Set(attachments)
  return OFFER_ARTIFACTS
    .filter((a) => selectedIds.has(a.id))
    .map((a) => {
      const unavailable = a.id === 'kg' && priceUnavailable
      return {
        id: a.id,
        title: t(`presentation.artifact.title.${a.id}`),
        description: t(`presentation.artifact.description.${a.id}`),
        available: !unavailable,
        unavailableReason: unavailable ? t('presentation.artifact.costUnavailable') : undefined,
      }
    })
}

/** Считает деньги вверх до УЖЕ ОКРУГЛЁННОГО показа (rule 19) — тот же
 *  приём, что `OfferPanel.tsx`'s `totalCount` (не анимируем к точному
 *  Decimal, иначе на миг мелькнут лишние разряды сверх показанных). */
function useMoneyCountUp(exact: Decimal): { prefix: '≈' | ''; display: string } {
  const pr = present(exact)
  const counted = useCountUp(new Decimal(pr.display.replace(/\./g, '')), 0)
  return { prefix: pr.prefix, display: counted }
}

export function PresentationShell({ mainRef, modeRef }: {
  mainRef: RefObject<HTMLElement>
  modeRef: RefObject<HTMLButtonElement>
}) {
  const s = useStore()
  const t = useT()
  // No `useTx()` here any more: the client shell's last two bridged
  // literals became dictionary keys, so this component is fully keyed.
// VR3-01: the project's display name now comes from the two-fixture
// project register (`state/projectAnalysis`). The eight-row
// `fixtures/opportunities.json` this used to read is gone with the
// portfolio it described.
  const opportunity = demoProject(s.opportunityId) ?? undefined
  const projectName = opportunity?.name ?? s.opportunityId ?? ''

  const eligible = eligibleClientOptions(s)
  const viewedId = resolvedViewedOptionId(s)
  const currentId = eligible.some((o) => o.id === viewedId)
    ? viewedId!
    : (eligible[0]?.id ?? null)
  const current = currentId
    ? buildCandidate(s, currentId, eligible.find((o) => o.id === currentId)!.name)
    : null
  const candidates = eligible.flatMap((o) => {
    const c = buildCandidate(s, o.id, o.name)
    return c ? [c] : []
  })

  const [activeSection, setActiveSection] = useState<NarrativeSectionId>('project')

  const latestViewedSnapshot = currentId
    ? [...s.snapshots].reverse().find((snapshot) => snapshot.optionId === currentId)
    : undefined

  // VR2-08 — POST-SEND RE-ENTRY (M-3): `flow`/`delivery` are local React
  // state, so without this they would always reset to 'narrative' on every
  // mount — even reopening an Option the store already knows was sent,
  // sending the ordinary portfolio route straight back to a prototype-style
  // restart instead of the real, truthful Delivered state. The lazy
  // initialisers below read the real snapshot truth ONCE, at first mount;
  // `syncedOptionIdRef` + the effect further down re-derive the same truth
  // whenever the VIEWED option actually changes (the "Ansicht" switcher),
  // without ever fighting an in-session transition for the SAME option
  // (offer → send → sent → delivered, or "Neue Version erstellen" back to
  // narrative) — that effect only fires again once `currentId` itself
  // changes.
  const [flow, setFlow] = useState<PresentationFlow>(
    // VR3-05: a fresh presentation always begins at the entry boundary. An
    // Option that was already sent reopens at its delivered artefact, which
    // is VR2-08's own contract and not something the boundary re-asks.
    () => (latestViewedSnapshot ? 'delivered' : 'entry'),
  )
  const [delivery, setDelivery] = useState<'sent' | 'delivered'>(
    () => (latestViewedSnapshot ? 'delivered' : 'sent'),
  )
  const [sentSnapshot, setSentSnapshot] = useState<OfferSnapshot | null>(null)
  // VR2-08 — 'sending' is the real, visible commit step between the click
  // and the snapshot existing (rule: "sending/committed state" between
  // action and result); 'failed' models the one real, existing failure
  // `sendOfferForOption` can produce (store.ts throws if the option cannot
  // be resolved) — never a fabricated transport failure (the prototype has
  // no transport to fail on its own; "Do NOT invent delivery evidence").
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'failed'>('idle')
  // VR3-05 — the two scenario commitments. Local, because a dialog being
  // OPEN is screen state; everything the dialogs then commit is store state.
  const [revertOpen, setRevertOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const scenarioBarRef = useRef<HTMLDivElement>(null)
  const { reduced, fadeRise } = useSemanticMotion()

  // VR2-09 — approved motion storyboard 5 "Presentation entry" (MODE), exit
  // half: leaving Present back to Work is the same cross-shell swap as
  // entering it (`ClientOutputGateDialog`), so it uses the same CONTINUITY
  // edge (`startContinuityTransition`, view-transition cross-fade with the
  // brand mark paired across both shells). Store semantics are untouched:
  // `setMode('intern')` still runs synchronously inside the transition.
  const exitToWork = () => startContinuityTransition(reduced, () => s.setMode('intern'))

  const syncedOptionIdRef = useRef<string | null>(currentId)
  useEffect(() => {
    if (syncedOptionIdRef.current === currentId) return
    syncedOptionIdRef.current = currentId
    setSentSnapshot(null)
    setSendStatus('idle')
    const existing = currentId
      ? [...s.snapshots].reverse().find((snap) => snap.optionId === currentId)
      : undefined
    if (existing) {
      setDelivery('delivered')
      setFlow('delivered')
    } else {
      // VR3-05: the boundary is crossed ONCE per presentation. Switching the
      // presented Option — and above all saving a descendant from inside the
      // meeting, which switches it — must not throw the presenter back to
      // "Präsentation starten" in front of the client. The boundary exists
      // to enter Client Mode, not to re-enter the narrative; `setMode` is
      // what resets it, and that only happens on a real exit.
      setFlow((current) => (current === 'entry' ? 'entry' : 'narrative'))
    }
    // Deliberately keyed on `currentId` alone: a send/delivery happening for
    // the option already being viewed is handled explicitly by `commitSend`,
    // not by this re-entry sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  // Reuse the validated CRM recipient contract already established for the
  // synthetic DEMO-0001 opportunity. An unknown opportunity remains blocked;
  // the client flow never invents or captures a recipient here.
  const recipient = recipientForOpportunity(s.opportunityId)

  useEffect(() => {
    if (flow !== 'sent') return
    const timer = window.setTimeout(() => {
      setDelivery('delivered')
      setFlow('delivered')
    }, DELIVERY_SIMULATION_MS)
    return () => window.clearTimeout(timer)
  }, [flow])

  /**
   * Every narrative page is its own small "document" — moving to it focuses
   * its own heading (M-10: "heading receives programmatic focus"; the same
   * continuity contract App.tsx's scroll-reset effect gives every Work
   * screen).
   *
   * MODE ENTRY IS NOT THIS EFFECT'S TRANSITION. It already has an owner:
   * App.tsx's scroll-and-focus effect depends on `s.mode`, so crossing into
   * Client Mode focuses the boundary heading there, as every document
   * transition in the product has since acceptance defect 8. The rule below
   * must therefore SETTLE on the first render rather than fire a second
   * time at the same heading — one transition, one focus move.
   *
   * FOCUS IS SPENT BY THE REF, AND THE INTENT IS DERIVED DURING RENDER.
   * Both halves are load-bearing, and each one is a bug on its own:
   *
   * - Focusing from an effect keyed on `[activeSection, flow]` addresses the
   *   heading that is LEAVING. `AnimatePresence mode="wait"` mounts the
   *   incoming page only after the outgoing one has exited, so the effect
   *   runs while the new heading does not exist; once the old one detaches,
   *   focus falls back to `<body>`. Acceptance reproduced exactly that —
   *   navigate to Terminplan, wait 700 ms, `document.activeElement` is BODY.
   *
   * - Arming that intent from an effect is then too late for the transitions
   *   that DO remount synchronously (the entry boundary into the narrative,
   *   which lives outside the section swap): React attaches refs before it
   *   runs effects, so the ref callback would fire with nothing armed and
   *   the heading would never be focused.
   *
   * Deriving the wanted key during render satisfies both without branching
   * on which kind of transition it is, and without a timer guessing when the
   * DOM caught up. It is also why an ordinary re-render — a scenario
   * decision, a recalculation — moves nothing: the key is unchanged, so the
   * presenter keeps the control they just used.
   */
  const focusKey = flow === 'narrative' ? `section:${activeSection}` : `flow:${flow}`
  const headingEl = useRef<HTMLHeadingElement | null>(null)
  const wantedFocusKey = useRef<string>(focusKey)
  // Initialised to the FIRST render's key: that render is mode entry, whose
  // focus App.tsx has already placed on this very heading. Starting level
  // means this rule spends nothing there and owns every move afterwards.
  const focusedKey = useRef<string>(focusKey)
  wantedFocusKey.current = focusKey
  const pageHeadingRef = useCallback((el: HTMLHeadingElement | null) => {
    headingEl.current = el
    if (!el || focusedKey.current === wantedFocusKey.current) return
    focusedKey.current = wantedFocusKey.current
    el.focus()
  }, [])

  // VR2-08: the deliberate 'sending' commit delay (see `commitSend` below)
  // needs its own timer handle so unmount mid-flight cannot call `setState`
  // on a gone component.
  const sendingTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (sendingTimerRef.current !== null) window.clearTimeout(sendingTimerRef.current)
  }, [])

  // VR2-07: a nav tab click always lands in the narrative at that section —
  // including from inside the offer/send/sent flow, where the narrative
  // strip stays mounted (DC-22 anatomy) but previously did nothing while a
  // flow was active. The approved Offer target relies on the strip itself
  // as the only way back (no redundant "Zurück" chrome competing with the
  // commercial result); this is what makes that true everywhere, not just
  // for the one screen that needed it.
  const goTo = (id: NarrativeSectionId) => {
    setFlow('narrative')
    setActiveSection(id)
  }

  // Kein client-präsentierbares Option: eigener, ehrlicher Zustand statt
  // einer leeren Leinwand (AC 6/9/11/12) — dieselbe Unterscheidung, die
  // S4Vergleich (Wave 1) schon für dieselbe Frage trifft: existiert die
  // Option noch nicht, oder ist sie nur noch nicht bereit.
  if (!current) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PresentationTopBar
          sections={[]} activeSection={activeSection}
          candidates={[]} currentId={null} savedTotalOf={() => '—'}
          onSwitch={() => {}} onExit={exitToWork} modeRef={modeRef}
        />
        <main ref={mainRef} tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none px-7 py-6">
          <h1 ref={pageHeadingRef} tabIndex={-1} className="text-heading-1 font-bold text-text-primary">
            {projectName || t('shell.profile.client')}
          </h1>
          <p className="mt-4 text-body text-text-secondary">
            <span aria-hidden="true">○ </span>
            {/* `tx()` is a BRIDGE for German the generated delivery already
                carries; handed a literal delivery never had, it returns the
                German unchanged in EN — silently, which is how QA-01
                shipped. These two sentences were exactly that, and they are
                this ticket's own CLIENT MODE LOCKED state, so they become
                dictionary keys with both rows. */}
            {s.options.length > 0
              ? t('presentation.empty.noneReady')
              : t('presentation.empty.noOption')}
          </p>
        </main>
      </div>
    )
  }

  // VR3-05 — the SALES narrative, six sections, in comprehension order.
  // Deliberately not the preparation order and deliberately not variable:
  // the target's rail is the same six on every frame, so a presenter builds
  // one muscle memory and a client sees one document.
  const sections = NARRATIVE_SECTIONS.map((id) => ({
    id, label: t(SECTION_LABEL_KEY[id]),
  }))
  const showOptionen = candidates.length >= 2

  const switchViewedOption = (id: string) => {
    startContinuityTransition(reduced, () => s.setViewedOption(id))
  }

  const startOffer = () => {
    setSentSnapshot(null)
    setSendStatus('idle')
    setDelivery('sent')
    setFlow('offer')
    setActiveSection('investment')
  }

  // A sent offer is a read-only artifact. Opening it must never restart the
  // narrative or create a new version; the snapshot remains the source of
  // truth even when the live Option has since changed.
  const openSentSnapshot = () => {
    if (!sentSnapshot && !latestViewedSnapshot) return
    setFlow('snapshot')
  }

  const closeSentSnapshot = () => setFlow('delivered')

  const backToNarrative = () => {
    setSentSnapshot(null)
    setSendStatus('idle')
    setFlow('narrative')
    setActiveSection('investment')
  }

  // VR2-08 preflight (§9.3 EMAIL-001 condition #5, rule 16): a genuinely
  // undetermined total is exactly the "not ready to send" case rule 16
  // already names — sending it would freeze `Preis nicht ermittelt` into an
  // immutable snapshot. Distinct blocking reason from a missing recipient,
  // both intentional (rule 12: a blocked control always names why).
  // KG 300/400/700 are structurally mandatory (store.ts `setCoverage`), so
  // a fully CONFIGURED (`configurationComplete`) Option — the only kind
  // `eligibleClientOptions` ever lets reach this screen — cannot itself
  // drive `total.isZero()` today; this stays proportionate defence in
  // depth against the underlying rule 16 condition rather than a currently
  // click-reachable state (tested directly against `PresentationFlowScreen`
  // — see presentation-shell.dom.test.tsx).
  const priceUnavailable = current.p.result.total.exact.isZero()
  const canSend = recipient !== null && !priceUnavailable
  const galleryArtifacts = buildGalleryArtifacts(s.offerDraft.attachments, priceUnavailable, t)

  const commitSend = () => {
    if (!canSend) return
    setSendStatus('sending')
    sendingTimerRef.current = window.setTimeout(() => {
      try {
        const snapshot = s.sendOfferForOption('email', current.id)
        setSentSnapshot(snapshot)
        setSendStatus('idle')
        setDelivery('sent')
        setFlow('sent')
      } catch {
        // The one real, existing failure this call can produce (store.ts
        // throws if the option cannot be resolved) — no snapshot is
        // created, so the immutable-snapshot invariant holds on failure
        // too. No fabricated provider/network failure exists to trigger
        // here; the prototype has no transport layer capable of failing on
        // its own ("Do NOT invent delivery evidence").
        setSendStatus('failed')
      }
    }, SEND_COMMIT_SIMULATION_MS)
  }

  // VR3-05 — ONE resolved state for the whole narrative. Built here so the
  // six pages cannot each reach for their own copy and disagree about which
  // decisions are in force (the "one number, two meanings" class).
  const presented = clientPresentedSnapshot(s)
  const baselineSnapshot = clientBaselineSnapshot(s)
  const view: ClientView | null = presented && baselineSnapshot
    ? {
      optionName: current.name,
      savedVersion: latestSavedOptionVersion(s, current.id),
      presented,
      baseline: baselineSnapshot,
      projectName,
      projectHeroAssetId: opportunity?.heroAssetId ?? null,
      language: s.uiLanguage,
    }
    : null

  // VR3-05 required state: PROJECTION ERROR. A presentation whose canonical
  // derivation cannot produce a state has nothing honest to show a client,
  // so it fails CLOSED and offers the route back to preparation rather than
  // rendering a shell around an absent number.
  if (!view) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PresentationTopBar
          sections={[]} activeSection={activeSection}
          candidates={[]} currentId={null} savedTotalOf={() => '—'}
          onSwitch={() => {}} onExit={exitToWork} modeRef={modeRef}
        />
        <main ref={mainRef} tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none px-7 py-6">
          <h1 ref={pageHeadingRef} tabIndex={-1}
              className="text-heading-1 font-bold text-text-primary">
            {t('vr3.client.projectionError.title')}
          </h1>
          <p className="mt-4 text-body text-text-secondary">
            <span aria-hidden="true">! </span>
            {t('vr3.client.projectionError.body')}
          </p>
          <div className="mt-5">
            <Button variant="primary" onClick={exitToWork}>
              {t('vr3.client.projectionError.action')}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // One authority for "what does this Option cost": its own saved record.
  const savedOf = (id: string) => latestSavedOptionVersion(s, id)
  // ...and one authority for HOW it is typeset. `totalDisplay` is the string
  // frozen at save time by `formatDE`, which is German by construction, so
  // reusing it verbatim printed "38.740.000" inside an English presentation
  // while the KG breakdown and the comparison delta beside it were already
  // correctly "38,740,000" — two number systems in one client screen.
  // `localizeMoneyText` re-typesets the ROUNDED numeral that is already
  // there; it does not re-decide the rounding rule (see its own contract in
  // i18n/index.ts), so the number and its `≈` prefix are untouched. `—`
  // carries no numerals and passes through unchanged.
  const savedTotalOf = (id: string) =>
    localizeMoneyText(savedOf(id)?.result.totalDisplay ?? '—', s.uiLanguage)

  const motionKey = flow === 'narrative' ? activeSection : flow

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PresentationTopBar
        sections={sections}
        // The entry boundary is not a section of the narrative, so no rail
        // item is current while it is on screen — an underline there would
        // claim the presentation had already started.
        activeSection={flow === 'entry' ? null : activeSection}
        onNavigate={goTo}
        optionName={current.name}
        candidates={candidates} currentId={current.id}
        savedTotalOf={savedTotalOf}
        onSwitch={switchViewedOption}
        onExit={exitToWork} modeRef={modeRef}
      />

      <main ref={mainRef} tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-default outline-none">
        {/* VR2-09 cohesion: the narrative page swap uses the canonical
            `fadeRise` variants (`motion.ts`: fade + `--enter-shift` rise,
            `--motion-reveal`/`--motion-feedback` durations, reduced-motion
            collapse) — the same vocabulary every Work surface uses — instead
            of a Present-local copy of that motion with literal `y: 8` /
            `0.2` / `0.12` values (rule 20: "only the shared variants"). */}
        {/* M-09 is a MODE transition, not a section change: the boundary
            replaces the shell, it does not cross-fade with a narrative
            section. Keeping it out of the section `AnimatePresence` is also
            what stops the boundary and the first section from being mounted
            at the same time while a `mode="wait"` exit is still settling —
            two client screens in one document, one of which is stale. */}
        {flow === 'entry' ? (
          <PresentationEntry
            view={view}
            onStart={() => { setFlow('narrative'); setActiveSection('project') }}
            onReturn={exitToWork}
            headingRef={pageHeadingRef}
          />
        ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={motionKey}
            variants={fadeRise}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-0 flex-1 flex-col"
          >
            {flow === 'outputs' ? (
              <PageOutputs
                view={view}
                headingRef={pageHeadingRef}
                onSaveAsNew={() => setSaveOpen(true)}
                onEmail={startOffer}
              />
            ) : flow === 'narrative' ? (
              activeSection === 'project' ? (
                <PageProjectIdentity view={view} headingRef={pageHeadingRef} />
              ) : activeSection === 'buildings' ? (
                <PageBuildings view={view} headingRef={pageHeadingRef} />
              ) : activeSection === 'scope' ? (
                <PageScopeStory view={view} headingRef={pageHeadingRef} />
              ) : activeSection === 'services' ? (
                <PageServices view={view} headingRef={pageHeadingRef} />
              ) : activeSection === 'schedule' ? (
                <PageScheduleStory
                  view={view} headingRef={pageHeadingRef}
                  decision={<ScheduleScenarioSlot language={s.uiLanguage} />}
                />
              ) : (
                <PageInvestment
                  view={view}
                  headingRef={pageHeadingRef}
                  onConclude={() => setFlow('outputs')}
                  comparison={showOptionen ? (
                    <ClientOptionComparison
                      candidates={candidates} currentId={current.id}
                      onSwitch={switchViewedOption} language={s.uiLanguage}
                      savedOf={savedOf}
                    />
                  ) : undefined}
                />
              )
            ) : (
              <PresentationFlowScreen
                flow={flow}
                delivery={delivery}
                snapshot={sentSnapshot ?? latestViewedSnapshot}
                current={current}
                projectName={projectName}
                priceUnavailable={priceUnavailable}
                galleryArtifacts={galleryArtifacts}
                onPrepare={() => setFlow('send')}
                onOpenOffer={() => setFlow('offer')}
                canSend={canSend}
                recipient={recipient}
                headingRef={pageHeadingRef}
                sendStatus={sendStatus}
                onSend={commitSend}
                onRetry={commitSend}
                onOpenSent={openSentSnapshot}
                onCloseSnapshot={closeSentSnapshot}
                onNewVersion={backToNarrative}
              />
            )}
          </motion.div>
        </AnimatePresence>
        )}

        {/* The bar is persistent across every section, which is the point:
            a presenter must not be able to navigate away from the fact that
            the number on screen is a temporary one. It is suppressed only
            for the entry boundary and the released send lifecycle, where a
            scenario is by definition not what is being looked at. */}
        {view && (flow === 'narrative' || flow === 'outputs') ? (
          <div ref={scenarioBarRef}>
            <ScenarioBar
              view={view}
              onRevert={() => setRevertOpen(true)}
              onSaveAsNew={() => { s.beginScenarioSaveAsNew(); setSaveOpen(true) }}
            />
          </div>
        ) : null}
      </main>

      {view ? (
        <>
          <ScenarioRevertDialog
            open={revertOpen} onClose={() => setRevertOpen(false)}
            view={view} returnFocusTo={scenarioBarRef}
          />
          <ScenarioSaveDialog
            open={saveOpen && s.clientScenarioSave?.stage === 'NAMING'}
            onClose={() => { s.cancelScenarioSaveAsNew(); setSaveOpen(false) }}
            view={view} returnFocusTo={scenarioBarRef}
          />
          <ScenarioSaveReceipt view={view} />
          <ClientPrintDocument view={view} />
        </>
      ) : null}
    </div>
  )
}

/**
 * Option comparison, as a panel of the investment section.
 *
 * VR2-06 gave this a section of its own. The approved VR3-05 narrative has
 * exactly six sections and comparison is not one of them — but the CAPABILITY
 * is real and a presenter with two saved Options needs it, so it moves to
 * where the comparison is actually made: beside the number being compared.
 * Only client-eligible Options appear, and switching is `setViewedOption`,
 * which touches nothing but which Option is being shown.
 */
function ClientOptionComparison({ candidates, currentId, onSwitch, language, savedOf }: {
  candidates: Candidate[]
  currentId: string
  onSwitch: (id: string) => void
  language: 'de' | 'en'
  savedOf: (id: string) => SavedOptionVersion | null
}) {
  const t = useT()
  const currentSaved = savedOf(currentId)
  return (
    <section className="a3-client-comparison" aria-label={t('vr3.client.comparison.title')}>
      <h3 className="a3-client-panel-subtitle">{t('vr3.client.comparison.title')}</h3>
      <div className="a3-client-rows">
        {candidates.map((candidate) => {
          const saved = savedOf(candidate.id)
          const delta = saved && currentSaved
            ? new Decimal(saved.result.totalExact)
              .minus(new Decimal(currentSaved.result.totalExact))
            : null
          const presented = candidate.id === currentId
          return (
            <div key={candidate.id} className="a3-client-row">
              <span className="a3-client-row-label">{candidate.name}</span>
              <span className="a3-client-row-value numeric">
                {saved ? localizeMoneyText(saved.result.totalDisplay, language) : '—'}
                {delta && !delta.isZero() ? (
                  <span className="a3-client-comparison-delta">
                    {/* The 8px margin separates these two numbers for the
                        eye, but nothing separated them in the TEXT: the row
                        read "38.740.000+ 310.000 €" as one token to a screen
                        reader and to anything else reading the accessible
                        name. A visible space would double a gap the design
                        already sets deliberately, so the separator is the
                        delta's own name, clipped from view. */}
                    <span className="sr-only">
                      {` ${t('vr3.client.comparison.delta')} `}
                    </span>
                    {signedMoneyText(delta, language)}
                  </span>
                ) : null}
              </span>
              {presented ? (
                <span className="a3-client-comparison-state">
                  {t('vr3.client.comparison.presented')}
                </span>
              ) : (
                <Button variant="ghost" onClick={() => onSwitch(candidate.id)}>
                  {t('vr3.client.comparison.show')}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * PresentationTopBar — the ONE Present-owned chrome bar (VR2-06): brand +
 * narrative strip + a compact Ansicht/mode/exit/language cluster. Replaces
 * both the generic `AppHeader` (not rendered while `praesentation`, see
 * `App.tsx`) and the previous second, Present-only bar underneath it —
 * "structurally recomposed", not Work chrome with parts hidden. The
 * mode-indicator + exit pairing is DC-22 `OutputProfileSwitch`'s own
 * anatomy (`modeIndicator` → `exitButton`, README GATE-003): both stay
 * directly visible, never folded into a menu.
 */
function PresentationTopBar({
  sections, activeSection, optionName, onNavigate,
  candidates, currentId, onSwitch, onExit, modeRef, savedTotalOf,
}: {
  sections: Array<{ id: NarrativeSectionId; label: string }>
  activeSection: NarrativeSectionId | null
  optionName?: string
  savedTotalOf: (id: string) => string
  onNavigate?: (id: NarrativeSectionId) => void
  candidates: Candidate[]
  currentId: string | null
  onSwitch: (id: string) => void
  onExit: () => void
  modeRef: RefObject<HTMLButtonElement>
}) {
  const tx = useTx()
  const t = useT()
  const s = useStore()

  return (
    <div className="a3-presentation-topbar a3-client-topbar">
      <div className="a3-presentation-brand">
        {/* `a3-brand-mark`: the one element both shells share, so the
            Work ⇄ Present CONTINUITY edge (view transition) can pair it. */}
        <img src={all3Logo} alt="All3" className="h-5 w-auto shrink-0 a3-brand-mark" />
      </div>

      {sections.length > 0 && (
        <nav aria-label={tx('Präsentation')} className="a3-presentation-nav">
          <ul className="flex flex-wrap items-center gap-1" role="list">
            {sections.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => onNavigate?.(sec.id)}
                  aria-current={activeSection === sec.id ? 'true' : undefined}
                  className={'hit-target a3-presentation-tab' + (
                    activeSection === sec.id ? ' a3-presentation-tab-current' : ''
                  )}
                >
                  {sec.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="a3-presentation-topbar-actions">
        {candidates.length >= 2 && currentId ? (
          <div className="a3-presentation-ansicht">
            <OptionSwitcher
              candidates={candidates} currentId={currentId}
              onSwitch={onSwitch} savedTotalOf={savedTotalOf}
            />
          </div>
        ) : null}
        {/* VR3-05: with exactly one eligible Option there is nothing to
            switch between, and the caption that used to stand here said the
            Option's name a second time — the mode indicator to its right
            already names it. One statement of which Option is on screen, in
            the place the target puts it. */}
        <div className="a3-language-control">
          <SegmentedControl
            layout="inline"
            legend={tx('Sprache')}
            value={s.uiLanguage}
            onChange={(l) => s.setUiLanguage(l)}
            options={[
              { value: 'de', label: 'DE' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
        <div className="a3-output-profile a3-output-profile-compact">
          <Button ref={modeRef} variant="secondary" onClick={onExit}>
            {t('shell.profile.exit')}
          </Button>
          {/* The indicator names the MODE and the saved Option it is
              presenting — the target's `CLIENT PRESENTATION · <Option>`.
              Naming the Option here is what lets the redundant static
              "Ansicht" label disappear when there is only one to show. */}
          <p className="a3-mode-indicator" role="status" aria-live="polite" aria-atomic="true">
            <span aria-hidden="true">◉</span>
            <span>
              {optionName
                ? `${t('shell.profile.clientIndicator')} · ${optionName}`
                : t('shell.profile.clientIndicator')}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

/** Dieselbe Auswahl-Semantik wie S4Vergleich (Wave 1): SegmentedControl bis
 *  3 Optionen (LOCALE-004), sonst kanonisches SelectField — nur an einer
 *  Stelle wiederverwendet, die die GESAMTE Erzählung erreicht. */
function OptionSwitcher({ candidates, currentId, onSwitch, savedTotalOf }: {
  candidates: Candidate[]
  currentId: string
  onSwitch: (id: string) => void
  savedTotalOf: (id: string) => string
}) {
  const t = useT()
  const current = candidates.find((c) => c.id === currentId)!
  const legend = t('presentation.ansicht.legend')
  // The SAVED baseline's own recorded total, never a re-derivation and never
  // the legacy proposal projection: an Option's client-facing number is the
  // one its save committed (M-3). Reading `c.p` here printed a total from a
  // different engine beside the canonical one on the investment page — two
  // numbers for one Option, in front of the client.
  const segments = candidates.map((c) => ({
    value: c.id,
    label: `${c.name} · ${savedTotalOf(c.id)}`,
  }))

  return (
    <div>
      {segments.length <= 3 ? (
        <SegmentedControl
          layout="inline"
          legend={legend}
          value={currentId}
          onChange={onSwitch}
          options={segments}
        />
      ) : (
        <SelectField
          label={legend}
          value={currentId}
          onChange={(event) => onSwitch(event.target.value)}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {savedTotalOf(c.id)}
            </option>
          ))}
        </SelectField>
      )}
      {/* Eine knappe polite-Ansage pro Wechsel (a11y-Vertrag) — kein
          Wert-für-Wert-Rieseln.

          `savedTotalOf`, like the segments above and for the same reason:
          the rule stated over `segments` was applied to `segments` only, so
          this announcement and the >3-Option `SelectField` kept reading
          `c.p` — the legacy proposal projection. A screen-reader user heard
          ≈ 3.980.000 € for the Option everyone else saw priced at
          38.430.000 €. One Option has one client-facing number, on every
          path that states it. */}
      <p className="sr-only" aria-live="polite">
        {`${legend}: ${current.name} · ${savedTotalOf(current.id)}`}
      </p>
    </div>
  )
}

type PageHeadingRef = Ref<HTMLHeadingElement>

/* VR3-05 — §1…§6 of the client narrative moved to `ClientNarrative.tsx`,
   `ClientScenario.tsx` and `ClientOutputs.tsx`. The six VR2-06 pages that
   stood here (Identität · Umfang · Ergebnis · Zeitplan · Optionen ·
   Nächster Schritt) are superseded rather than restyled: the approved
   target replaces the narrative ITSELF, in a different order and with a
   different subject, and keeping the old pages alongside the new ones
   would have left the shell able to render two different client stories.
   Option comparison survived the move — it is now a panel of §6, beside
   the commercial result it compares, instead of a section of its own. */

/** §"NÄCHSTER SCHRITT" → OFFER — the commercial climax (VR2-07, cycle 4).
 *
 * Composition (grid split, `.a3-stage-deep`, `.a3-offer-artifact` tile
 * geometry, full-width CTA) is unchanged from cycle 3, which rebuilt it
 * directly against the approved target's own SOURCE markup
 * (`artifacts/visual-outcome-audit-18e7d71/vo-t1/target-source.html`).
 * Cycle 3's Acceptance PASS on that composition stands; cycle 4 does not
 * touch it again.
 *
 * ACCEPTANCE REMEDIATION (cycle 4) corrects three deltas the Auditor found
 * the STATIC target markup does not waive, because the ticket's own
 * functional contract (independent of the visual mockup) requires them:
 *
 * 1. REAL, REACHABLE STATES. The gallery used to be a literal three-item
 *    array (`offer`/`cost`/`scope`), so no-artefact/mixed/long-title/longer
 *    -list states were structurally unreachable. It now lists exactly the
 *    real, seller-selected `s.offerDraft.attachments` against the shared
 *    `OFFER_ARTIFACTS` catalog (`config/offer-artifacts.ts`, extracted from
 *    `S5Export.tsx`'s own "Artefakte" checklist so both consumers read one
 *    source instead of two literal, driftable lists). Deselecting every
 *    attachment in S5Export now genuinely renders `EmptyState` here;
 *    selecting more than three genuinely grows the list; the catalog's own
 *    longer labels (e.g. "Vertragsvorlagen für die Rechtsabteilung")
 *    genuinely exercise the long-title case. Fixing this exposed one
 *    unavoidable dependency: `offerDraft.attachments`' DEFAULT value used a
 *    different, unrelated id scheme (`angebot`/`kostentreiber`/`annahmen`)
 *    that matched no real catalog id — S5Export's own `default: true`
 *    markers were dead code, so its checklist opened with every box
 *    unchecked. The default now reuses the catalog's own `default: true`
 *    flags (`DEFAULT_OFFER_ATTACHMENTS`), restoring what those flags were
 *    always supposed to mean.
 * 2. REAL PREVIEW/OPEN. Every available tile's title is a real `<button>`
 *    again (cycle 2 had this; cycle 3 removed it while also removing cycle
 *    2's two actual defects — this remediation restores the interaction
 *    without reintroducing either defect). Opening it shows the canonical,
 *    PLAIN `.a3-modal` dialog (same primitive and undecorated pattern
 *    `OfferPanel.tsx`'s own "Nachweise & Verlauf" detail dialog already
 *    uses) — never cycle 2's `.a3-paper-preview` "Monochrome A4 Muster"
 *    treatment, which staged the dialog to look like the generated document
 *    itself. Content is only data this screen has already computed for
 *    real: the KG split via the same `CompositionBar` (expanded) for
 *    Kostenübersicht, or the Option's real total/building scope for every
 *    other deliverable. No generation timer exists anywhere in this
 *    component (cycle 2's other actual defect) — availability is either the
 *    real selection above or the real `priceUnavailable` signal below,
 *    with no simulated "wird vorbereitet" phase in between.
 * 3. REDUCED MOTION = IMMEDIATE. See the `motion.aside` comment below.
 *
 * No in-panel "Zurück" link: the narrative strip (`goTo`, flow-aware — see
 * `PresentationShell`) is the one way back, matching the approved target's
 * clean composition instead of duplicating that affordance.
 */
function OfferClimax({ current, projectName, priceUnavailable, onPrepare, headingRef }: {
  current: Candidate
  projectName: string
  priceUnavailable: boolean
  onPrepare: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const tx = useTx()
  const s = useStore()
  const language = s.uiLanguage
  const { p, cfg } = current
  const { fadeRise, transition } = useSemanticMotion()
  const hero = useMoneyCountUp(p.result.total.exact)
  const topDrivers = topCostDrivers(current, t)
  const biggestDriver = topDrivers[0]
  const segments = buildKgCompositionSegments(p.kgSplit, (g) => t(`costGroup.${g}`))

  const galleryArtifacts = buildGalleryArtifacts(s.offerDraft.attachments, priceUnavailable, t)
  const anyAvailable = galleryArtifacts.some((a) => a.available)

  const [openId, setOpenId] = useState<OfferArtifactId | null>(null)
  const openTriggerRef = useRef<HTMLElement | null>(null)
  const dialogTitleId = useId()
  const dialogTitleRef = useRef<HTMLHeadingElement>(null)
  const openArtifact = (id: OfferArtifactId) => {
    // The title button is already focused by the click that fires this
    // handler — capturing it here (rather than threading the event through)
    // is what `returnFocusTo` needs to send focus back to the exact tile
    // that opened the dialog when several tiles can each open it.
    openTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setOpenId(id)
  }
  const openArtifactData = galleryArtifacts.find((a) => a.id === openId) ?? null

  return (
    <section className="a3-offer-climax" aria-labelledby="presentation-offer-title">
      {/* ACCEPT-04 (cycle 2): the result column now shares the shell's own
          entrance fade (App-level `motion.div` in `PresentationShell`,
          unchanged) with no SECOND nested fade competing on top of it — the
          commercial result establishes hierarchy the instant the Offer
          stage itself appears. Only the gallery gets an additional, clearly
          separated delayed reveal below (wave 3 = 240ms, still the
          canonical `--stagger-wave` step rule 19 defines — not a bespoke
          duration), so "total first, then structure/artefacts assemble" is
          an actually-measurable two-beat sequence instead of two fades
          landing within a few ms of each other. */}
      <div className="a3-offer-climax-result a3-stage-deep">
        <p className="a3-cap uppercase">{t('presentation.flow.offerEyebrow')} · {current.name}</p>
        <h1 ref={headingRef} tabIndex={-1} id="presentation-offer-title" className="mt-2 text-heading-1 font-bold text-text-inverse">
          {t('presentation.flow.offerTitle', {
            project: projectName || t('presentation.flow.offerTitleFallbackSubject'),
          })}
        </h1>

        <div className="a3-offer-climax-total mt-8">
          {priceUnavailable ? (
            <PartialState label={t('money.priceNotDetermined')} consequence={tx(p.result.totalLabel)} />
          ) : (
            <>
              <p className="numeric text-display-numeric font-bold" style={{ color: 'var(--color-brand-accent)' }}>
                {hero.prefix && <span aria-hidden="true">{hero.prefix}{NNBSP}</span>}
                {hero.display}
                <span className="text-heading-2 text-text-inverse">{NNBSP}€</span>
              </p>
              <p className="mt-2 text-body text-text-inverse">{tx(p.result.totalLabel)}</p>
              <p className="mt-1 text-small text-text-inverse">{tx('Schätzunsicherheit')} ±{NNBSP}{p.uncertaintyPp}{NNBSP}%</p>
            </>
          )}
        </div>

        {!priceUnavailable && (
          <div className="mt-6">
            <CompositionBar
              segments={segments}
              total={p.result.total.exact}
              variant="compact"
              onDark
              incompleteLabel={t('money.priceNotDetermined')}
            />
          </div>
        )}

        {!priceUnavailable && (
          <ul className="a3-presentation-commercial-driver-list mt-6">
            <li className="text-text-inverse">
              <span>{tx(p.leadRate.denominatorLabel)}</span>
              <span className="numeric shrink-0">
                {p.leadRate.prefix && <span aria-hidden="true">{p.leadRate.prefix}{NNBSP}</span>}
                {p.leadRate.display}{NNBSP}€/m²
              </span>
            </li>
            <li className="text-text-inverse">
              <span>{t('presentation.schedule.durationFromOkbp')}</span>
              <span className="numeric shrink-0">
                {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
                {durationNumber(p.duration, language)}{NNBSP}{language === 'en' ? 'months' : 'Monate'}
              </span>
            </li>
            {biggestDriver && (
              <li className="text-text-inverse">
                <span>{t('presentation.commercial.topDriver')}</span>
                <span className="numeric shrink-0">{biggestDriver.label}{NNBSP}{localizeMoneyText(signed(biggestDriver.exact), language)}</span>
              </li>
            )}
          </ul>
        )}

        <p className="a3-offer-climax-footnote mt-auto text-small">
          {t('presentation.flow.discountNotice')}
        </p>
      </div>

      <motion.aside
        className="a3-offer-climax-gallery bg-surface-default"
        aria-labelledby="presentation-offer-gallery-title"
        variants={fadeRise}
        initial="hidden"
        animate="visible"
        transition={transition('reveal', 3)}
      >
        <p className="a3-cap uppercase">{t('presentation.flow.galleryEyebrow')}</p>
        <h2 id="presentation-offer-gallery-title" className="mt-2 text-heading-2 font-bold text-text-primary">
          {t('presentation.flow.galleryHeadline')}
        </h2>

        {!anyAvailable ? (
          <div className="mt-6">
            <EmptyState>{t('presentation.flow.galleryEmpty')}</EmptyState>
          </div>
        ) : (
          <ul className="a3-offer-gallery-list mt-6">
            {galleryArtifacts.map((a) => (
              <li key={a.id}>
                <article className={'a3-offer-artifact' + (a.available ? ' a3-offer-artifact-selected' : '')}>
                  <div>
                    {a.available ? (
                      <button
                        type="button"
                        className="a3-linkbtn a3-offer-artifact-open font-bold text-text-primary"
                        onClick={() => openArtifact(a.id)}
                      >
                        {a.title}
                      </button>
                    ) : (
                      <p className="font-bold text-text-primary">{a.title}</p>
                    )}
                    <p className="mt-1 text-small text-text-secondary">{a.description}</p>
                  </div>
                  {a.available ? (
                    <span className="text-small text-text-secondary">{t('presentation.artifact.meta')}</span>
                  ) : (
                    <span className="text-small text-text-secondary">
                      <span aria-hidden="true">○ </span>{a.unavailableReason}
                    </span>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}

        <div className="a3-offer-climax-cta mt-6">
          <Button className="w-full" variant="primary" onClick={onPrepare}>{t('presentation.flow.prepare')}</Button>
        </div>
      </motion.aside>

      <Dialog
        open={openArtifactData !== null}
        onOpenChange={(next) => { if (!next) setOpenId(null) }}
        labelledBy={dialogTitleId}
        initialFocusRef={dialogTitleRef}
        returnFocusTo={openTriggerRef as RefObject<HTMLElement>}
      >
        {openArtifactData && (
          <>
            <h2
              ref={dialogTitleRef}
              id={dialogTitleId}
              tabIndex={-1}
              className="outline-none text-heading-3 font-bold text-text-primary"
            >
              {openArtifactData.title}
            </h2>
            <p className="mt-2 text-body text-text-secondary">{openArtifactData.description}</p>

            {openArtifactData.id === 'kg' ? (
              <div className="mt-4">
                <CompositionBar
                  segments={segments}
                  total={p.result.total.exact}
                  variant="expanded"
                  incompleteLabel={t('money.priceNotDetermined')}
                />
              </div>
            ) : (
              <>
                <p className="mt-4 text-small text-text-secondary">
                  {t('presentation.flow.offerEyebrow')} · {current.name}
                </p>
                <p className="mt-1 text-small text-text-secondary">
                  {t('presentation.artifact.dialogScope')}: {buildingNames(cfg)}
                </p>
                {openArtifactData.id === 'praesentation' && !priceUnavailable && (
                  <p className="mt-3 numeric text-heading-3 font-bold text-text-primary">
                    {p.result.total.prefix ? `${p.result.total.prefix}${NNBSP}` : ''}
                    {p.result.total.display}{NNBSP}€
                  </p>
                )}
              </>
            )}

            <div className="a3-row mt-4">
              <Button variant="primary" onClick={() => setOpenId(null)}>{tx('Schließen')}</Button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  )
}

type SendStatus = 'idle' | 'sending' | 'failed'

/** Read-only artefact rule-row for the Delivered/Send-review screens — the
 *  same generic, non-fabricated `presentation.artifact.meta` label
 *  OfferClimax already shows (never an invented page count/file size, see
 *  the ticket's client-safety boundary). */
function ArtifactRuleRow({ artifact, t }: { artifact: GalleryArtifact; t: ReturnType<typeof useT> }) {
  return (
    <div className="a3-presentation-rule-row">
      <span>{artifact.title}</span>
      <b>{t('presentation.artifact.meta')}</b>
    </div>
  )
}

function DeliveryProofDialog({ open, onClose, sentAt, deliveredAt, delivered, snapshotId, triggerRef }: {
  open: boolean
  onClose: () => void
  sentAt: string
  deliveredAt: string
  delivered: boolean
  snapshotId: string
  triggerRef: RefObject<HTMLElement>
}) {
  const t = useT()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}
            labelledBy={titleId} initialFocusRef={titleRef} returnFocusTo={triggerRef}>
      <h2 ref={titleRef} id={titleId} tabIndex={-1} className="outline-none text-heading-3 font-bold text-text-primary">
        {t('presentation.flow.deliveryProofTitle')}
      </h2>
      <p className="mt-2 text-body text-text-secondary">{t('presentation.flow.deliveryProofIntro')}</p>
      <dl className="a3-presentation-rule-list mt-4">
        <div className="a3-presentation-rule-row">
          <span>{t('presentation.flow.deliveryProofSentRow')}</span>
          <b>{sentAt}</b>
        </div>
        <div className="a3-presentation-rule-row">
          <span>{t('presentation.flow.deliveryProofDeliveredRow')}</span>
          <b>{delivered ? deliveredAt : t('presentation.flow.pending')}</b>
        </div>
      </dl>
      <p className="mt-4 text-small text-text-secondary">
        {t('presentation.flow.snapshotRef', { id: snapshotId })}
      </p>
      <div className="a3-row mt-4">
        <Button variant="primary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Dialog>
  )
}

/** Exported for direct, isolated testing of the 'sending'/'failed' send-
 *  status branches (VR2-08) — see presentation-shell.dom.test.tsx. The
 *  ordinary route can only ever reach these through `PresentationShell`
 *  itself; there is no reachable trigger for a real send FAILURE in this
 *  backend-less prototype (no transport exists to fail on its own), so
 *  that one branch is proven at the component level with an explicit
 *  `sendStatus` prop instead of a live click-through. */
export function PresentationFlowScreen({
  flow, delivery, snapshot, current, projectName, priceUnavailable, galleryArtifacts,
  onPrepare, onOpenOffer, canSend, recipient, onSend, sendStatus, onRetry,
  onOpenSent, onCloseSnapshot, onNewVersion, headingRef,
}: {
  flow: Exclude<PresentationFlow, 'narrative'>
  delivery: 'sent' | 'delivered'
  snapshot?: OfferSnapshot
  current: Candidate
  projectName: string
  priceUnavailable: boolean
  galleryArtifacts: GalleryArtifact[]
  onPrepare: () => void
  onOpenOffer: () => void
  canSend: boolean
  recipient: ValidatedRecipient | null
  onSend: () => void
  sendStatus: SendStatus
  onRetry: () => void
  onOpenSent: () => void
  onCloseSnapshot: () => void
  onNewVersion: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const tx = useTx()
  const language = useStore().uiLanguage
  const { p } = current
  // Declared unconditionally, before any of this function's several early
  // returns (rules of hooks) — only actually rendered/opened from the
  // 'sent'/'delivered' branch below.
  const [proofOpen, setProofOpen] = useState(false)
  const proofTriggerRef = useRef<HTMLButtonElement>(null)

  if (flow === 'offer') {
    return (
      <OfferClimax
        current={current}
        projectName={projectName}
        priceUnavailable={priceUnavailable}
        onPrepare={onPrepare}
        headingRef={headingRef}
      />
    )
  }

  if (flow === 'send') {
    const availableArtifacts = galleryArtifacts.filter((a) => a.available)
    const disabledReason = !recipient
      ? t('presentation.flow.noRecipient')
      : priceUnavailable
        ? t('presentation.flow.priceUnavailableReason')
        : undefined
    return (
      <section className="flex min-h-0 flex-1 flex-col a3-paper" aria-labelledby="presentation-send-title">
        <div className="a3-presentation-review">
          {/* Page head spans both columns (target 1440 + 1280): the Option
              total sits at the page's right edge above the artefact column. */}
          <div className="a3-presentation-review-head">
            <div>
              <p className="a3-cap">{t('presentation.flow.send.eyebrow')}</p>
              <h1 ref={headingRef} tabIndex={-1} id="presentation-send-title" className="mt-2 text-heading-1 font-bold text-text-primary">
                {t('presentation.flow.send.title')}
              </h1>
              <p className="mt-2 text-body text-text-secondary">{t('presentation.flow.send.copy')}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="a3-cap">{current.name}</p>
              <p className="numeric mt-1 text-heading-2 font-bold text-text-primary">
                {priceUnavailable ? t('money.priceNotDetermined') : moneyLabel(present(p.result.total.exact))}
              </p>
            </div>
          </div>

          <div className="a3-presentation-review-primary">
            <div>
              <div className="a3-presentation-field-head">
                <h2 className="text-heading-3 font-bold text-text-primary">{t('presentation.flow.recipient')}</h2>
              </div>
              <dl className="a3-presentation-rule-list">
                <div className="a3-presentation-rule-row">
                  <span>{t('presentation.flow.recipientLabel')}</span>
                  <b>{recipient ? recipient.address : t('presentation.flow.noRecipient')}</b>
                </div>
                <div className="a3-presentation-rule-row">
                  <span>{t('presentation.flow.subject')}</span>
                  <b>{t('presentation.flow.subjectValue', {
                    option: current.name,
                    project: projectName || t('presentation.flow.offerTitleFallbackSubject'),
                  })}</b>
                </div>
                <div className="a3-presentation-rule-row">
                  <span>{t('presentation.flow.language')}</span>
                  <b>{language === 'de' ? t('presentation.flow.german') : t('presentation.flow.english')}</b>
                </div>
              </dl>
            </div>

            <div className="mt-6">
              <div className="a3-presentation-field-head">
                <h2 className="text-heading-3 font-bold text-text-primary">{t('presentation.flow.summary')}</h2>
                <button type="button" className="a3-linkbtn text-small" onClick={onOpenOffer}>
                  {t('presentation.flow.openOffer')}
                </button>
              </div>
              <dl className="a3-presentation-rule-list">
                <div className="a3-presentation-rule-row">
                  <span>{tx(p.result.totalLabel)}</span>
                  <b className="numeric">{priceUnavailable ? t('money.priceNotDetermined') : moneyLabel(present(p.result.total.exact))}</b>
                </div>
                <div className="a3-presentation-rule-row">
                  <span>{tx('Schätzunsicherheit')}</span>
                  <b>±{NNBSP}{p.uncertaintyPp}{NNBSP}%</b>
                </div>
                <div className="a3-presentation-rule-row">
                  <span>{t('presentation.flow.completion')}</span>
                  <b>{formatDate(p.duration.completionDate, language)}</b>
                </div>
              </dl>
            </div>
          </div>

          <div className="a3-presentation-review-aside">
            <h2 className="text-heading-3 font-bold text-text-primary">
              {t('presentation.flow.artifactsHeading', { count: availableArtifacts.length })}
            </h2>
            {availableArtifacts.length === 0 ? (
              <div className="mt-4">
                <EmptyState>{t('presentation.flow.galleryEmpty')}</EmptyState>
              </div>
            ) : (
              <ul className="a3-presentation-artifact-grid">
                {availableArtifacts.map((a) => (
                  <li key={a.id}>
                    <article className="a3-offer-artifact a3-offer-artifact-selected">
                      <p className="font-bold text-text-primary">{a.title}</p>
                      <span className="text-small text-text-secondary">{t('presentation.artifact.meta')}</span>
                    </article>
                  </li>
                ))}
              </ul>
            )}
            <div className="a3-presentation-success">
              <b className="text-body text-text-primary">{t('presentation.flow.immutable')}</b>
              <p>{t('presentation.flow.immutableDetail')}</p>
            </div>
          </div>
        </div>

        <div className="a3-presentation-review-dock">
          {sendStatus === 'failed' ? (
            <>
              <p role="alert">
                <b className="text-body font-medium text-text-primary">{t('presentation.flow.sendFailedTitle')}</b>
                <span className="a3-presentation-review-dock-copy">{t('presentation.flow.sendFailedCopy')}</span>
              </p>
              <Button variant="primary" onClick={onRetry}>{t('presentation.flow.retryAction')}</Button>
            </>
          ) : (
            <>
              <p>
                <b className="text-body font-medium text-text-primary">
                  {t('presentation.flow.reviewedSummary', { count: availableArtifacts.length })}
                </b>
                <span className="a3-presentation-review-dock-copy">{t('presentation.flow.reviewedSummaryDetail')}</span>
              </p>
              <Button
                variant="primary"
                disabled={!canSend}
                disabledReason={disabledReason}
                loading={sendStatus === 'sending'}
                loadingLabel={t('presentation.flow.sendingLabel')}
                onClick={onSend}
              >
                {t('presentation.flow.sendAction')}
              </Button>
            </>
          )}
        </div>
      </section>
    )
  }

  // From here on ('sent' | 'delivered' | 'snapshot') a real, already-sent
  // snapshot is the only truthful source — its OWN frozen total/artefact
  // selection, never the live current Candidate (M-3: a later, legitimate
  // Product edit must not silently rewrite what was actually sent).
  const displayName = snapshot?.optionName ?? current.name
  const snapshotPriceUnavailable = snapshot
    ? new Decimal(snapshot.totalExact).isZero()
    : priceUnavailable
  const displayTotal = snapshot
    ? (snapshotPriceUnavailable ? t('money.priceNotDetermined') : moneyLabel(present(new Decimal(snapshot.totalExact))))
    : (priceUnavailable ? t('money.priceNotDetermined') : moneyLabel(present(p.result.total.exact)))
  const historicalArtifacts = snapshot
    ? buildGalleryArtifacts(snapshot.attachmentIds, snapshotPriceUnavailable, t).filter((a) => a.available)
    : galleryArtifacts.filter((a) => a.available)
  const sentAtIso = snapshot?.at
  const sentAtDisplay = sentAtIso ? formatDate(sentAtIso, language, true) : t('presentation.flow.justNow')
  const deliveredAtIso = sentAtIso
    ? new Date(new Date(sentAtIso).getTime() + DELIVERY_SIMULATION_MS).toISOString()
    : undefined
  const deliveredAtDisplay = deliveredAtIso ? formatDate(deliveredAtIso, language, true) : sentAtDisplay

  if (flow === 'snapshot') {
    return (
      <section className="a3-presentation-snapshot-page a3-paper" aria-labelledby="presentation-snapshot-title">
        <button type="button" className="a3-presentation-back" onClick={onCloseSnapshot}>
          {t('presentation.flow.backToDelivery')}
        </button>
        <div className="mt-4">
          <p className="a3-cap">{t('presentation.flow.version')}</p>
          <h1 ref={headingRef} tabIndex={-1} id="presentation-snapshot-title" className="mt-2 text-heading-1 font-bold text-text-primary">
            {t('presentation.flow.snapshotTitle')}
          </h1>
          <p className="mt-3 text-body text-text-secondary">
            {t('presentation.flow.snapshotCopy')}
          </p>
          <dl className="a3-presentation-rule-list mt-8">
            <div className="a3-presentation-rule-row"><span>{t('presentation.flow.sentAt')}</span><b>{sentAtDisplay}</b></div>
            <div className="a3-presentation-rule-row"><span>{t('presentation.flow.version')}</span><b>{displayName} · {displayTotal}</b></div>
            <div className="a3-presentation-rule-row"><span>{t('presentation.flow.recipient')}</span><b>{recipient ? recipient.address : t('presentation.flow.noRecipient')}</b></div>
            {snapshot && <div className="a3-presentation-rule-row"><span>{t('presentation.flow.snapshotId')}</span><b>{snapshot.id}</b></div>}
          </dl>
          <div className="mt-8">
            <p className="a3-cap">{t('presentation.nextStep.artifacts')}</p>
            {historicalArtifacts.length === 0 ? (
              <div className="mt-2"><EmptyState>{t('presentation.flow.galleryEmpty')}</EmptyState></div>
            ) : (
              <dl className="a3-presentation-rule-list mt-2">
                {historicalArtifacts.map((a) => <ArtifactRuleRow key={a.id} artifact={a} t={t} />)}
              </dl>
            )}
          </div>
          <div className="a3-presentation-success mt-6">
            <b className="text-body text-text-primary">{t('presentation.flow.immutable')}</b>
          </div>
        </div>
      </section>
    )
  }

  const delivered = flow === 'delivered' || delivery === 'delivered'

  return (
    <div className="a3-presentation-delivered-canvas">
      <section className="a3-presentation-delivered-card" aria-labelledby="presentation-delivery-title">
        <div className="a3-presentation-delivered-head">
          <div>
            <p className="a3-cap">{delivered ? t('presentation.flow.deliveredEyebrow') : t('presentation.flow.sentEyebrow')}</p>
            <h1 ref={headingRef} tabIndex={-1} id="presentation-delivery-title" className="mt-2 text-heading-1 font-bold text-text-primary">
              {delivered ? t('presentation.flow.deliveredTitle') : t('presentation.flow.sentTitle')}
            </h1>
            <p className="mt-3 text-body text-text-secondary">
              {recipient ? recipient.address : t('presentation.flow.noRecipient')} · {delivered ? deliveredAtDisplay : sentAtDisplay}
            </p>
          </div>
          <p
            className={'a3-presentation-status ' + (delivered ? 'a3-presentation-status-success' : 'a3-presentation-status-pending')}
            role="status" aria-live="polite"
          >
            {delivered ? t('presentation.flow.statusDelivered') : t('presentation.flow.statusSent')}
          </p>
        </div>

        <div className="a3-presentation-delivered-divider" />

        <div className="a3-presentation-delivered-grid">
          <div>
            <p className="a3-cap">{t('presentation.flow.version')}</p>
            <h2 className="mt-2 text-heading-3 font-bold text-text-primary">{displayName}</h2>
            <p className="numeric mt-3 text-heading-1 font-bold text-text-primary">{displayTotal}</p>
            <p className="mt-1 text-small text-text-secondary">
              {snapshot ? tx(snapshot.totalLabel) : tx(p.result.totalLabel)}
              {snapshot && <> · {t('presentation.flow.snapshotRef', { id: snapshot.id })}</>}
            </p>
          </div>
          <div>
            <p className="a3-cap">{t('presentation.nextStep.artifacts')}</p>
            {historicalArtifacts.length === 0 ? (
              <div className="mt-2"><EmptyState>{t('presentation.flow.galleryEmpty')}</EmptyState></div>
            ) : (
              <dl className="a3-presentation-rule-list mt-2">
                {historicalArtifacts.map((a) => <ArtifactRuleRow key={a.id} artifact={a} t={t} />)}
              </dl>
            )}
          </div>
        </div>

        <div className="a3-presentation-delivered-actions">
          <Button variant="secondary" onClick={onOpenSent}>{t('presentation.flow.openSent')}</Button>
          <div className="a3-row">
            <Button ref={proofTriggerRef} variant="secondary" onClick={() => setProofOpen(true)}>
              {t('presentation.flow.deliveryProofAction')}
            </Button>
            <Button variant="primary" onClick={onNewVersion}>{t('presentation.flow.newVersion')}</Button>
          </div>
        </div>
      </section>

      {snapshot && (
        <DeliveryProofDialog
          open={proofOpen}
          onClose={() => setProofOpen(false)}
          sentAt={sentAtDisplay}
          deliveredAt={deliveredAtDisplay}
          delivered={delivered}
          snapshotId={snapshot.id}
          triggerRef={proofTriggerRef as RefObject<HTMLElement>}
        />
      )}
    </div>
  )
}

function formatDate(iso: string, language: 'de' | 'en' = 'de', includeTime = false): string {
  const date = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}
