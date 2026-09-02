import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion } from 'framer-motion'
import { demoProject } from '../state/projectAnalysis'
import demo from '../fixtures/demo-0001.json'
import all3Logo from '../../design-system/All3Logo.png'
import {
  configForOption, eligibleClientOptions, projectionForOption,
  resolvedViewedOptionId, useStore, type OfferSnapshot, type OptionConfig,
  type Projection,
} from '../state/store'
import { driversSum } from '../engine/calculate'
import { modelDuration, presentDuration, shiftScheduleMetrics } from '../engine/schedule'
import { NNBSP, present, formatDE, label as moneyLabel } from '../engine/money'
import { CATALOG } from '../state/catalog'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { recipientForOpportunity, type ValidatedRecipient } from '../state/emailRecipient'
import { Badge, SelectField } from './designSystem'
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
import { MediaFrame } from '../design-system/MediaFrame'
import { ScheduleGantt } from './ScheduleGantt'
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
type PresentationFlow = 'narrative' | 'offer' | 'send' | 'sent' | 'delivered' | 'snapshot'

function buildCandidate(
  s: Parameters<typeof configForOption>[0],
  id: string,
  name: string,
): Candidate | null {
  const cfg = configForOption(s, id)
  const p = projectionForOption(s, id)
  return cfg && p ? { id, name, cfg, p } : null
}

function money(d: Decimal): string {
  const pr = present(d)
  return `${pr.prefix}${pr.prefix ? NNBSP : ''}${pr.display}`
}

function durationNumber(duration: Projection['duration'], language: 'de' | 'en'): string {
  const number = duration.display.replace(`${NNBSP}Monate`, '')
  return localizeMoneyText(number, language)
}

function durationText(duration: Projection['duration'], language: 'de' | 'en'): string {
  const prefix = duration.prefix ? `${duration.prefix}${NNBSP}` : ''
  const unit = language === 'en' ? 'months' : 'Monate'
  return `${prefix}${durationNumber(duration, language)}${NNBSP}${unit}`
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
  const tx = useTx()
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

  const [activeSection, setActiveSection] = useState<string>('projekt')

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
    () => (latestViewedSnapshot ? 'delivered' : 'narrative'),
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
      setFlow('narrative')
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

  // Every narrative page is its own small "document" (VR2-06 shell recompose:
  // one full-bleed page at a time, not a scrolled stack) — moving to it
  // focuses its own heading, the same continuity contract App.tsx's own
  // scroll-reset effect already gives every Work screen. First render is
  // skipped: nobody's focus should be stolen on mode entry.
  const pageHeadingRef = useRef<HTMLHeadingElement>(null)
  const firstSectionRender = useRef(true)
  useEffect(() => {
    if (firstSectionRender.current) { firstSectionRender.current = false; return }
    pageHeadingRef.current?.focus()
  }, [activeSection, flow])

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
  const goTo = (id: string) => {
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
          candidates={[]} currentId={null}
          onSwitch={() => {}} onExit={exitToWork} modeRef={modeRef}
        />
        <main ref={mainRef} tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none px-7 py-6">
          <h1 ref={pageHeadingRef} tabIndex={-1} className="text-heading-1 font-bold text-text-primary">
            {projectName || t('shell.profile.client')}
          </h1>
          <p className="mt-4 text-body text-text-secondary">
            <span aria-hidden="true">○ </span>
            {s.options.length > 0
              ? tx('Für dieses Projekt ist noch keine Option bereit für die Kundenansicht.')
              : tx('Noch keine Opportunity Option angelegt.')}
          </p>
        </main>
      </div>
    )
  }

  const showOptionen = candidates.length >= 2
  const sections: Array<{ id: string; label: string }> = [
    { id: 'projekt', label: t('presentation.nav.project') },
    { id: 'gebaeude', label: t('presentation.nav.building') },
    { id: 'ergebnis', label: t('presentation.nav.result') },
    { id: 'zeitplan', label: t('presentation.nav.schedule') },
    ...(showOptionen ? [{ id: 'optionen', label: t('presentation.nav.options') }] : []),
    { id: 'naechster-schritt', label: t('presentation.nav.nextStep') },
  ]

  const switchViewedOption = (id: string) => {
    startContinuityTransition(reduced, () => s.setViewedOption(id))
  }

  const startOffer = () => {
    setSentSnapshot(null)
    setSendStatus('idle')
    setDelivery('sent')
    setFlow('offer')
    setActiveSection('naechster-schritt')
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
    setActiveSection('naechster-schritt')
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

  const motionKey = flow === 'narrative' ? activeSection : flow

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PresentationTopBar
        sections={sections}
        activeSection={activeSection} onNavigate={goTo}
        candidates={candidates} currentId={current.id}
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={motionKey}
            variants={fadeRise}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-0 flex-1 flex-col"
          >
            {flow === 'narrative' ? (
              activeSection === 'projekt' ? (
                <PageIdentity opportunity={opportunity} current={current} headingRef={pageHeadingRef} />
              ) : activeSection === 'gebaeude' ? (
                <PageScope current={current} onNext={() => goTo('ergebnis')} headingRef={pageHeadingRef} />
              ) : activeSection === 'ergebnis' ? (
                <PageErgebnis current={current} headingRef={pageHeadingRef} />
              ) : activeSection === 'zeitplan' ? (
                <PageZeitplan current={current}
                              onNext={() => goTo(showOptionen ? 'optionen' : 'naechster-schritt')}
                              headingRef={pageHeadingRef} />
              ) : activeSection === 'optionen' ? (
                <PageOptionen projectName={projectName} candidates={candidates} currentId={current.id}
                              onSwitch={switchViewedOption} onNext={() => goTo('naechster-schritt')}
                              headingRef={pageHeadingRef} />
              ) : (
                <PageNaechsterSchritt current={current} onPrepare={startOffer} headingRef={pageHeadingRef} />
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
      </main>
    </div>
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
  sections, activeSection, onNavigate,
  candidates, currentId, onSwitch, onExit, modeRef,
}: {
  sections: Array<{ id: string; label: string }>
  activeSection: string
  onNavigate?: (id: string) => void
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
    <div className="a3-presentation-topbar">
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
            <OptionSwitcher candidates={candidates} currentId={currentId} onSwitch={onSwitch} />
          </div>
        ) : currentId ? (
          // Exactly one eligible Option: no switcher to show (nothing to
          // switch between), but the client must still be able to name
          // which Option context they are looking at — an informational
          // caption with the Option's NAME, never its internal id.
          <p className="a3-presentation-ansicht">
            <span className="a3-cap">{t('presentation.ansicht.legend')}</span>
            <br />
            <span className="text-small font-bold text-text-primary">
              {candidates.find((c) => c.id === currentId)?.name}
            </span>
          </p>
        ) : null}
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
          <p className="a3-mode-indicator" role="status" aria-live="polite" aria-atomic="true">
            <span aria-hidden="true">◉</span>
            <span>{t('shell.profile.clientIndicator')}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

/** Dieselbe Auswahl-Semantik wie S4Vergleich (Wave 1): SegmentedControl bis
 *  3 Optionen (LOCALE-004), sonst kanonisches SelectField — nur an einer
 *  Stelle wiederverwendet, die die GESAMTE Erzählung erreicht. */
function OptionSwitcher({ candidates, currentId, onSwitch }: {
  candidates: Candidate[]
  currentId: string
  onSwitch: (id: string) => void
}) {
  const t = useT()
  const current = candidates.find((c) => c.id === currentId)!
  const legend = t('presentation.ansicht.legend')
  const segments = candidates.map((c) => ({
    value: c.id,
    label: `${c.name} · ${money(c.p.result.total.exact)}${NNBSP}€`,
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
              {c.name} · {money(c.p.result.total.exact)}{NNBSP}€
            </option>
          ))}
        </SelectField>
      )}
      {/* Eine knappe polite-Ansage pro Wechsel (a11y-Vertrag) — kein
          Wert-für-Wert-Rieseln. */}
      <p className="sr-only" aria-live="polite">
        {`${legend}: ${current.name} · ${money(current.p.result.total.exact)}${NNBSP}€`}
      </p>
    </div>
  )
}

type PageHeadingRef = RefObject<HTMLHeadingElement>

/** §1 PROJEKT — Identitäts-Auftakt: full-bleed identity media with the
 *  project's own caption card overlapping its lower edge, matching the
 *  approved target's composition instead of a boxed page header above a
 *  bounded media tile. */
function PageIdentity({ opportunity, current, headingRef }: {
  opportunity: { name: string; city?: string } | undefined
  current: Candidate
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const s = useStore()
  const buildingCount = includedBuildingIdsOf(current.cfg).length
  const projectName = opportunity?.name ?? current.name
  const bgfSum = includedBuildingIdsOf(current.cfg)
    .reduce((sum, id) => sum.plus(current.cfg.buildings[id]!.bgfRAbove), new Decimal(0))
  const dateLabel = new Intl.DateTimeFormat(s.uiLanguage === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())

  return (
    <section id="presentation-projekt" aria-label={t('presentation.nav.project')} className="a3-presentation-page">
      <div className="a3-presentation-identity">
        <div className="a3-presentation-identity-media">
          {/* No caption label: the identity card's own H1 (below/adjacent)
              already names the project — MediaFrame's fallback graphic is
              `aria-hidden`, so a caption here would only repeat the H1 at
              the far end of a full-bleed box. */}
          <MediaFrame ratio="hero" state="fallback" seed={projectName} />
        </div>
        <div className="a3-presentation-identity-card">
          <p className="a3-cap">{t('presentation.identity.eyebrow', { date: dateLabel })}</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-heading-1 font-bold text-text-primary">
            {projectName}
          </h1>
          <div className="a3-presentation-fact-row mt-4">
            {opportunity?.city && (
              <span className="a3-presentation-fact-chip">{opportunity.city}</span>
            )}
            <span className="a3-presentation-fact-chip numeric">
              {formatDE(new Decimal(buildingCount), 0)}{NNBSP}{t('presentation.identity.buildingCount')}
            </span>
            {bgfSum.greaterThan(0) && (
              <span className="a3-presentation-fact-chip numeric">
                {formatDE(bgfSum, 0)}{NNBSP}m² BGF
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function buildingFormLabel(
  form: OptionConfig['buildings'][string]['gebaeudeform'],
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string,
): string {
  return form === 'MFH' ? t('buildingScope.form.mfh')
    : form === 'BUERO' ? t('buildingScope.form.office')
      : form === 'EFH_ZFH' ? t('buildingScope.form.efh')
        : t('buildingScope.form.row')
}

function undergroundLabel(
  scope: OptionConfig['buildings'][string]['untergeschoss'],
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string,
): string {
  return scope === 'vollausbau' ? t('presentation.building.fullBasement')
    : scope === 'ab_decke' ? t('presentation.building.partialBasement')
      : t('presentation.building.noBasement')
}

/** §2 GEBÄUDE — one building story at a time, full height media | facts,
 *  with an explicit page-advance CTA alongside true prev/next building
 *  cycling (named by the neighbouring building, never a bare arrow). */
function PageScope({ current, onNext, headingRef }: {
  current: Candidate
  onNext: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const includedIds = includedBuildingIdsOf(current.cfg)
  const includedGroups = (Object.keys(current.p.kgSplit) as Array<keyof typeof current.p.kgSplit>)
    .filter((g) => current.p.kgSplit[g]?.greaterThan(0))
    .map((g) => t(`costGroup.${g}`))

  const [buildingIndex, setBuildingIndex] = useState(0)
  const safeIndex = includedIds.length === 0 ? 0 : Math.min(buildingIndex, includedIds.length - 1)
  const buildingId = includedIds[safeIndex]
  const building = buildingId ? current.cfg.buildings[buildingId] : undefined
  const buildingName = building?.stableName ?? t('buildingScope.title')
  const prevId = includedIds.length > 1 ? includedIds[(safeIndex - 1 + includedIds.length) % includedIds.length]! : null
  const nextId = includedIds.length > 1 ? includedIds[(safeIndex + 1) % includedIds.length]! : null
  const prevName = prevId ? current.cfg.buildings[prevId]?.stableName ?? prevId : null
  const nextName = nextId ? current.cfg.buildings[nextId]?.stableName ?? nextId : null

  return (
    <section id="presentation-gebaeude" aria-label={t('presentation.nav.building')}
             className="a3-presentation-page a3-presentation-scope">
      <div className="a3-presentation-scope-media">
        {/* Same reasoning as the identity page: the adjacent H1 already
            names the building. */}
        <MediaFrame ratio="hero" state="fallback" seed={buildingName} />
      </div>
      <div className="a3-presentation-scope-copy">
        <p className="a3-cap">
          {t('presentation.scope.eyebrow')} · {t('presentation.scope.position', { n: safeIndex + 1, total: includedIds.length })}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-heading-2 font-bold text-text-primary">
          {buildingName}
        </h1>
        <p className="mt-2 text-body text-text-secondary">
          {building ? buildingFormLabel(building.gebaeudeform, t) : t('buildingScope.title')}
        </p>
        <div className="a3-presentation-fact-grid mt-5">
          <div>
            <dt className="a3-cap">{t('buildingScope.fact.bgfRAbove')}</dt>
            <dd className="numeric text-body font-medium">{building ? formatDE(building.bgfRAbove, 0) : '—'}{NNBSP}m²</dd>
          </div>
          <div>
            <dt className="a3-cap">{t('buildingScope.fact.units')}</dt>
            <dd className="numeric text-body font-medium">{building?.units ? formatDE(building.units, 0) : t('presentation.building.notCaptured')}</dd>
          </div>
          <div>
            <dt className="a3-cap">{t('presentation.building.underground')}</dt>
            <dd className="text-body font-medium">{building ? undergroundLabel(building.untergeschoss, t) : t('presentation.building.notCaptured')}</dd>
          </div>
          <div>
            <dt className="a3-cap">{t('buildingScope.fact.class')}</dt>
            <dd className="text-body font-medium">{building ? building.gebaeudeklasse.value.replace('_', ' ') : t('presentation.building.notCaptured')}</dd>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {prevName && (
              <Button variant="secondary" onClick={() => setBuildingIndex((i) => (i - 1 + includedIds.length) % includedIds.length)}>
                {t('presentation.scope.previous', { building: prevName })}
              </Button>
            )}
            {nextName && (
              <Button variant="secondary" onClick={() => setBuildingIndex((i) => (i + 1) % includedIds.length)}>
                {t('presentation.scope.next', { building: nextName })}
              </Button>
            )}
          </div>
          <p className="text-small text-text-secondary">{buildingName} · {t('presentation.scope.included')}</p>
          <Button variant="primary" onClick={onNext}>
            {t('presentation.scope.continueTo', { section: t('presentation.nav.result') })}
          </Button>
        </div>
        {includedGroups.length > 0 && (
          <p className="mt-4 text-small text-text-secondary">{t('buildingScope.selection.title')}: {includedGroups.join(' · ')}</p>
        )}
      </div>
    </section>
  )
}

/** §3 ERGEBNIS — die Bühne (rule 31 DC-38 Hierarchie) auf `--color-surface-
 *  stage-deep` (ADR-R1-02), Kostentreiber-Auszug. */
function PageErgebnis({ current, headingRef }: {
  current: Candidate
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const tx = useTx()
  const language = useStore().uiLanguage
  const { p, cfg } = current
  // Dieselbe einfache, im Client-Modus bereits akzeptierte Bedingung wie
  // S4Vergleich (Wave 1) — keine zweite Interpretation von "unavailable"
  // erfinden.
  const priceUnavailable = p.result.total.exact.isZero()
  const hero = useMoneyCountUp(p.result.total.exact)
  const segments = buildKgCompositionSegments(p.kgSplit, (g) => t(`costGroup.${g}`))
  // Kostentreiber-Auszug (DC-44/rule 35): dieselbe Privacy-Projektion, die
  // OfferPanel schon für KG 800 nutzt — Summe der gezeigten Treiber bleibt
  // exakt gleich dem Total (rule 32), auch wenn KG 800 aggregiert wird.
  const clientDrivers = projectDriversForClient(p.result.drivers, 'praesentation', cfg.kg800ClientRevealed)
  const driversTotal = driversSum(clientDrivers)
  // SB-13 (backlog 2be8e69c, R-25): `computeProjection` prefixes a driver's
  // `key` with its building id whenever more than one building is included
  // — strip that prefix and aggregate same-label siblings into one summed
  // row (see the original R3 Wave 2a rationale this file used to carry).
  const includedIds = includedBuildingIdsOf(cfg)
  const stripBuildingPrefix = (key: string): string => {
    if (includedIds.length <= 1) return key
    const owner = includedIds.find((id) => key.startsWith(`${id}:`))
    return owner ? key.slice(owner.length + 1) : key
  }
  const byLabel = new Map<string, { key: string; exact: Decimal }>()
  for (const d of clientDrivers) {
    const label = translatedDriverLabel({ ...d, key: stripBuildingPrefix(d.key) }, t)
    const existing = byLabel.get(label)
    if (existing) existing.exact = existing.exact.plus(d.exact)
    else byLabel.set(label, { key: label, exact: d.exact })
  }
  const topDrivers = [...byLabel.entries()]
    .map(([label, row]) => ({ label, exact: row.exact }))
    .sort((a, b) => b.exact.abs().minus(a.exact.abs()).toNumber())
    .slice(0, 5)
  const regionalFactorAmount = priceUnavailable
    ? t('money.priceNotDetermined')
    : moneyLabel(present(p.result.bauwerk.mul(CATALOG.regionalFactor.value.minus(1))))

  return (
    <section id="presentation-ergebnis" aria-label={t('presentation.nav.result')}
             className="a3-presentation-page a3-presentation-commercial a3-stage-deep">
      <div className="min-w-0">
        <p className="a3-cap">{t('presentation.commercial.eyebrow', { option: current.name })}</p>
        {priceUnavailable ? (
          <div className="mt-3">
            <PartialState label={t('money.priceNotDetermined')} consequence={p.result.totalLabel} />
          </div>
        ) : (
          <p className="mt-3 numeric text-display-numeric font-bold" style={{ color: 'var(--color-brand-accent)' }}>
            {hero.prefix && <span aria-hidden="true">{hero.prefix}{NNBSP}</span>}
            {hero.display}
            <span className="text-heading-2 text-text-inverse">{NNBSP}€</span>
          </p>
        )}
        <p className="mt-2 text-body text-text-inverse">{tx('Schätzunsicherheit')} ±{NNBSP}{p.uncertaintyPp}{NNBSP}%</p>

        {segments.length > 0 && (
          <div className="mt-6 a3-tbl-scroll">
            <CompositionBar segments={segments} total={p.result.total.exact} variant="compact" onDark
                             incompleteLabel={t('money.priceNotDetermined')} />
          </div>
        )}

        {!priceUnavailable && (
          <div className="a3-presentation-commercial-tiles mt-6">
            <div>
              {/* `p.leadRate.denominatorLabel` is the normative denominator
                  name (e.g. "WFL nach WoFlV") — a glossary term, never
                  machine-translated (LOCALE-009), same as `p.duration`'s
                  own OKBP references. Not a generic "Leitkennzahl" caption. */}
              <p className="a3-cap">{tx(p.leadRate.denominatorLabel)}</p>
              <p className="mt-1 numeric text-heading-2 font-bold text-text-inverse">
                {p.leadRate.prefix && <span aria-hidden="true">{p.leadRate.prefix}{NNBSP}</span>}
                {p.leadRate.display}<span className="text-small">{NNBSP}€/m²</span>
              </p>
            </div>
            <div>
              <p className="a3-cap">{t('presentation.nav.schedule')}</p>
              <p className="mt-1 numeric text-heading-2 font-bold text-text-inverse">
                {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
                {durationNumber(p.duration, language)}<span className="text-small">{NNBSP}{language === 'en' ? 'months' : 'Monate'}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="a3-presentation-commercial-drivers">
        <h1 ref={headingRef} tabIndex={-1} className="text-heading-2 font-bold text-text-inverse">
          {t('presentation.commercial.driversTitle')}
        </h1>
        {topDrivers.length > 0 && !priceUnavailable && (
          <>
            <p className="a3-cap mt-1">{tx('Kostentreiber')}</p>
            <ul className="a3-presentation-commercial-driver-list">
              {topDrivers.map((d) => (
                <li key={d.label} className="text-text-inverse">
                  <span>{d.label}</span>
                  <span className="numeric shrink-0">{money(d.exact)}{NNBSP}€</span>
                </li>
              ))}
              {current.cfg.regionalfaktorActive && (
                <li className="text-text-inverse">
                  <span>{tx('Regionalfaktor')}</span>
                  <span className="numeric shrink-0">{tx('aktiviert')}</span>
                </li>
              )}
            </ul>
            {!current.cfg.regionalfaktorActive && (
              <p className="text-small text-text-inverse">
                {t('offer.drivers.regionalInactive', { amount: regionalFactorAmount })}
              </p>
            )}
            <p className="a3-cap">{t('presentation.commercial.driversSum')} {money(driversTotal)}{NNBSP}€</p>
          </>
        )}
      </div>
    </section>
  )
}

const EXECUTION_COLOR_VARS = ['--color-dataviz-category-2', '--color-dataviz-category-3']

/** §4 ZEITPLAN — editorial page around the canonical `ScheduleGantt`
 *  (DC-19), scoped to the VIEWED Option's own included buildings/anchor —
 *  never the internal active Option's (`s.buildings`/`s.constructionStart
 *  Date` stay untouched; `cfg.constructionStartDate` is per-Option, Tech
 *  Review cycle 2). Reuses the exact schedule fixture/shift/duration
 *  functions the internal `ChapterTermine` chapter already uses instead of
 *  re-deriving scheduling math for the client narrative. */
function PageZeitplan({ current, onNext, headingRef }: {
  current: Candidate
  onNext: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const language = useStore().uiLanguage
  const { p } = current
  const includedIds = includedBuildingIdsOf(current.cfg)

  if (!p.duration.completionDate || includedIds.length === 0) {
    return (
      <section id="presentation-zeitplan" aria-label={t('presentation.nav.schedule')}
               className="a3-presentation-page a3-presentation-page-pad">
        <h1 ref={headingRef} tabIndex={-1} className="text-heading-2 font-bold text-text-primary">
          {t('presentation.timeline.headline')}
        </h1>
        <p className="mt-4 text-body text-text-secondary">
          <span aria-hidden="true">▲ </span>
          {t('presentation.timeline.incomplete')}
        </p>
      </section>
    )
  }

  const planningFixture = demo.schedule.metrics.find((m) => m.metricKey === 'project.planning')!
  const executionFixtures = includedIds.map((id) => ({
    id,
    fixture: demo.schedule.metrics.find((m) => m.metricKey === `building:${id}.execution`),
  })).filter((e): e is { id: string; fixture: NonNullable<typeof e.fixture> } => Boolean(e.fixture))

  let phases: Array<{
    key: string; label: string; unit: string; dependency: string
    startISO: string; endISO: string; durationLabel: string; colorVar: string
  }> = []
  let finishISO = p.duration.completionDate

  if (executionFixtures.length > 0) {
    const anchor = current.cfg.constructionStartDate
    const shifted = anchor
      ? shiftScheduleMetrics([planningFixture, ...executionFixtures.map((e) => e.fixture)], planningFixture.startDate, anchor)
      : [planningFixture, ...executionFixtures.map((e) => e.fixture)]
    const planning = shifted.find((m) => m.metricKey === planningFixture.metricKey)!
    const executions = executionFixtures.map(({ id, fixture }) => ({
      id, metric: shifted.find((m) => m.metricKey === fixture.metricKey)!,
    }))
    const latestExecution = executions.reduce((latest, cur) => (cur.metric.endDate > latest.metric.endDate ? cur : latest))
    finishISO = latestExecution.metric.endDate
    const planningDuration = presentDuration(
      { metricKey: planning.metricKey, kind: 'planning', startDate: planning.startDate, endDate: planning.endDate, durationBasis: 'calendarDay' },
      planningFixture.wholeCalendarMonths != null ? new Decimal(planningFixture.wholeCalendarMonths) : null,
    )
    phases = [
      {
        key: planning.metricKey,
        label: t('presentation.timeline.planningPhase'),
        unit: t('presentation.timeline.wholeProject'),
        dependency: '',
        startISO: planning.startDate,
        endISO: planning.endDate,
        durationLabel: durationText(planningDuration, language),
        colorVar: '--color-dataviz-category-1',
      },
      ...executions.map(({ id, metric }, index) => {
        const buildingName = current.cfg.buildings[id]?.stableName ?? id
        const dur = presentDuration(
          { ...metric, kind: 'buildingExecution', durationBasis: 'calendarDay' },
          modelDuration(current.cfg.buildings[id]!.bgfRAbove, new Decimal('1.00'), new Decimal('1.15')),
        )
        return {
          key: metric.metricKey,
          label: buildingName,
          unit: buildingName,
          dependency: t('presentation.timeline.afterPlanning'),
          startISO: metric.startDate,
          endISO: metric.endDate,
          durationLabel: durationText(dur, language),
          colorVar: EXECUTION_COLOR_VARS[index % EXECUTION_COLOR_VARS.length]!,
        }
      }),
    ]
  }

  return (
    <section id="presentation-zeitplan" aria-label={t('presentation.nav.schedule')} className="a3-presentation-page">
      <div className="a3-presentation-page-pad">
        <p className="a3-cap">{t('presentation.timeline.eyebrow', { option: current.name })}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-heading-2 font-bold text-text-primary">
          {t('presentation.timeline.headline')}
        </h1>
        <p className="mt-2 text-body text-text-secondary">{t('presentation.timeline.intro')}</p>
        {phases.length > 0 && (
          <div className="mt-6">
            <ScheduleGantt
              caption={t('presentation.timeline.headline')}
              finishISO={finishISO}
              phases={phases}
            />
          </div>
        )}
      </div>
      <div className="a3-presentation-consequence mt-auto">
        <div>
          <p className="a3-cap">{t('presentation.commercialConsequence')}</p>
          <p className="mt-1 text-body font-medium text-text-primary">
            {t('presentation.commercialConsequenceCopy')}
          </p>
        </div>
        <Button variant="primary" onClick={onNext}>{t('presentation.nextStep.continue')}</Button>
      </div>
    </section>
  )
}

/** §5 OPTIONEN — nur mit ≥2 client-eligible Optionen: three-up decision
 *  cards (price, delta vs. the VIEWED Option, composition bar, two
 *  established facts). No recommendation/favourite field exists on
 *  Option (VR2-05 decision, same constraint here) — the viewed card is
 *  distinguished only by an honest "now presenting" state, never a
 *  fabricated favourite. */
function PageOptionen({ projectName, candidates, currentId, onSwitch, onNext, headingRef }: {
  projectName: string
  candidates: Candidate[]
  currentId: string
  onSwitch: (id: string) => void
  onNext: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const language = useStore().uiLanguage
  const current = candidates.find((c) => c.id === currentId)!

  return (
    <section id="presentation-optionen" aria-label={t('presentation.nav.options')} className="a3-presentation-page a3-presentation-page-pad">
      <p className="a3-cap">{t('presentation.options.eyebrow', { project: projectName })}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-heading-2 font-bold text-text-primary">
        {t('presentation.options.headline')}
      </h1>
      <ul className="a3-presentation-option-grid mt-6" role="list"
          style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(0,1fr))` }}>
        {candidates.map((c) => {
          const selected = c.id === currentId
          const segments = buildKgCompositionSegments(c.p.kgSplit, (g) => t(`costGroup.${g}`))
          const delta = c.p.result.total.exact.minus(current.p.result.total.exact)
          return (
            <li key={c.id} role="group" aria-label={c.name}
                className={'a3-presentation-option-card' + (selected ? ' a3-presentation-option-card-current' : '')}>
              {selected && (
                <Badge sign="●" kind="status">{t('presentation.options.viewing')}</Badge>
              )}
              <p className={selected ? 'mt-3 text-body font-bold text-text-primary' : 'text-body font-bold text-text-primary'}>{c.name}</p>
              <p className="mt-2 numeric text-metric-section font-bold text-text-primary">
                {moneyLabel(present(c.p.result.total.exact))}
              </p>
              {!selected && !delta.isZero() && (
                <p className="numeric text-small text-text-secondary">
                  {delta.greaterThan(0) ? '+' : ''}{money(delta)}{NNBSP}€
                </p>
              )}
              {segments.length > 0 && (
                <div className="mt-3">
                  <CompositionBar segments={segments} total={c.p.result.total.exact} variant="compact"
                                   incompleteLabel={t('money.priceNotDetermined')} />
                </div>
              )}
              <div className="mt-3">
                <p className="a3-presentation-option-fact"><span className="text-text-secondary">{t('presentation.options.fact.building')}</span><span className="font-medium">{buildingNames(c.cfg)}</span></p>
                <p className="a3-presentation-option-fact"><span className="text-text-secondary">{t('presentation.options.fact.duration')}</span><span className="font-medium">{durationText(c.p.duration, language)}</span></p>
              </div>
              <Button className="mt-4" variant={selected ? 'primary' : 'secondary'} onClick={() => onSwitch(c.id)}>
                {selected ? t('presentation.options.present', { option: c.name }) : t('presentation.options.view')}
              </Button>
            </li>
          )
        })}
      </ul>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onNext}>
          {t('presentation.scope.continueTo', { section: t('presentation.nav.nextStep') })}
        </Button>
      </div>
    </section>
  )
}

/** §6 NÄCHSTER SCHRITT — the narrative hands off to a separate, explicit
 * offer flow. No internal preparation/export vocabulary is shown to
 * clients, and the invariant this whole ticket protects is stated in
 * plain client language: viewing another Option here never touches the
 * internal active/preparation Option. */
function PageNaechsterSchritt({ current, onPrepare, headingRef }: {
  current: Candidate
  onPrepare: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const s = useStore()
  const { p } = current
  const priceUnavailable = p.result.total.exact.isZero()
  const activeOption = s.options.find((o) => o.id === s.activeOptionId)
  const activeOptionName = activeOption?.name ?? current.name

  return (
    <section id="presentation-naechster-schritt" aria-label={t('presentation.nav.nextStep')}
             className="a3-presentation-page a3-presentation-next">
      <div className="a3-presentation-next-primary">
        <p className="a3-cap">{t('presentation.nextStep.eyebrow')}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-heading-2 font-bold text-text-primary">
          {t('presentation.nextStep.headline', { option: current.name })}
        </h1>
        <p className="mt-2 text-body text-text-secondary">
          {t('presentation.nextStep.copy')}
        </p>
        <div className="a3-presentation-next-callout mt-6">
          <p className="a3-cap">{t('presentation.nextStep.confirmationLabel')}</p>
          <p className="mt-1 text-body font-medium text-text-primary">
            {priceUnavailable
              ? `${current.name} · ${t('money.priceNotDetermined')}`
              : t('presentation.nextStep.confirmationValue', {
                option: current.name,
                total: moneyLabel(present(p.result.total.exact)),
                pp: p.uncertaintyPp,
              })}
          </p>
        </div>
      </div>
      <div className="a3-presentation-next-aside">
        <p className="a3-cap">{t('presentation.nextStep.artifacts')}</p>
        {/* VR2-08: the real, seller-selected artefact list (`offerDraft.
            attachments` against the shared `OFFER_ARTIFACTS` catalog) —
            not a static three-item stand-in that would silently disagree
            with the Send review immediately after it. */}
        {(() => {
          const artefacts = buildGalleryArtifacts(s.offerDraft.attachments, priceUnavailable, t)
            .filter((a) => a.available)
          return artefacts.length === 0 ? (
            <div className="mt-2"><EmptyState>{t('presentation.flow.galleryEmpty')}</EmptyState></div>
          ) : (
            <ul className="a3-presentation-artifacts mt-2">
              {artefacts.map((a) => <li key={a.id}>{a.title}</li>)}
            </ul>
          )
        })()}
        <Button className="mt-4" variant="primary" onClick={onPrepare}>
          {t('presentation.nextStep.title')}
        </Button>
        <p className="mt-3 text-small text-text-secondary">
          {t('presentation.nextStep.workingOptionNotice', { option: activeOptionName })}
        </p>
      </div>
    </section>
  )
}

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
