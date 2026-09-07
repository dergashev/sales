import {
  useCallback, useEffect, useId, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type Ref, type RefObject,
} from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { demoProject } from '../state/projectAnalysis'
import { PORTFOLIO_PROJECTS } from '../state/projectPortfolio'
import all3Logo from '../../design-system/All3Logo.png'
import {
  clientBaselineSnapshot, clientPresentedSnapshot, clientScenarioDelta,
  configForOption, eligibleClientOptions, latestSavedOptionVersion,
  projectionForOption, resolvedViewedOptionId, useStore,
  type OfferSnapshot, type OptionConfig, type Projection,
} from '../state/store'
import {
  CHAPTER_LABEL_KEY, clientProposal,
  type ClientChapterId, type ClientProposal, type ClientView,
} from '../state/clientProposal'
import { scenarioChangeCount } from '../state/clientScenario'
import {
  ChapterAngebot, ChapterGebaeude, ChapterProjekt, ChapterUeberblick,
} from './ClientNarrative'
import { ChapterLeistungen, ChapterPreis } from './ClientCommercial'
import {
  ChapterAbschluss, ChapterArchitektur, ChapterGrundlagen, ChapterTerminplan,
} from './ClientClosing'
import {
  ScenarioRevertDialog, ScenarioSaveDialog, ScenarioSaveReceipt, ScenarioState,
  VariantenLayer,
} from './ClientScenario'
import { ClientOutputsPanel, ClientPrintDocument } from './ClientOutputs'
import { signedMoneyText } from '../design-system/CommercialNumber'
import { NNBSP, present, label as moneyLabel } from '../engine/money'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { recipientForOpportunity, type ValidatedRecipient } from '../state/emailRecipient'
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
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'
import { Button, useCountUp } from './primitives'
import { projectDriversForClient, translatedDriverLabel } from '../state/clientProjection'

/**
 * PresentationShell — VR3-CP-00 · MODEL C "Bühne & Ebene".
 *
 * ```
 * LAYER 1 · STORY      one full-viewport chapter at a time, presenter-paced,
 *                      fixed semantic order (`CLIENT_CHAPTERS`)
 * LAYER 2 · DECISION   Varianten — presented-Option switching, the bounded
 *                      comparison and the what-ifs, opened over the stage
 * LAYER 3 · EVIDENCE   chapter-specific detail (cost drivers, construction
 *                      detail), opened over the stage, returning to the same
 *                      narrative position
 * ```
 *
 * A chapter is what the presenter walks through. A layer is what the client
 * asks to inspect. Nothing here links to an internal pipeline view.
 *
 * ## One projection, one stage
 *
 * The shell resolves the presented state ONCE (`ClientView`), hands it to
 * `clientProposal()` and renders chapters from the resulting `ClientProposal`
 * — the same object the printed sheet renders from, built with the print
 * profile. No chapter reaches for the store, so no chapter can disagree with
 * another about a fact neither of them computes.
 *
 * ## What is deliberately not here any more
 *
 * The entry boundary ("Präsentation starten") is gone: the private preflight
 * lives BEFORE entry, in the Präsentieren stage and `ClientOutputGateDialog`.
 * Once the client sees the screen, the first thing on it is the proposal. The
 * second persistent scenario band is gone: the what-if state is a slot of the
 * one presenter bar. The shell-local `ClientOptionComparison` is gone: the
 * comparison is `state/optionComparison.ts`, read by the Varianten layer and
 * the project-tier route alike (D-20).
 *
 * ## Chapter position
 *
 * `s.presentationChapter` is store state so a remount of this component
 * mid-meeting does not return the presenter to chapter 1. It is cleared on
 * exit and never encoded in the URL (a presentation is a room, not a place).
 *
 * ## The send lifecycle
 *
 * VR2-08's offer → send → sent → delivered → snapshot flow is preserved as
 * released and reached from chapter 10 through the client-safe output gate,
 * where email is the one channel that requires a saved Option (M-3).
 */

export type Candidate = { id: string; name: string; cfg: OptionConfig; p: Projection }

/**
 * `narrative` is the story; everything else is VR2-08's released send
 * lifecycle, reached from chapter 10's output gate and left again through
 * the chapter rail (which is always the way back).
 */
type PresentationFlow =
  | 'narrative' | 'offer' | 'send' | 'sent' | 'delivered' | 'snapshot'


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
function topCostDrivers(
  current: Candidate, t: ReturnType<typeof useT>, lang: 'de' | 'en' = 'de',
): TopDriver[] {
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
    const label = translatedDriverLabel({ ...d, key: strippedKey }, t, lang)
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


/** Whether the element that received a key is a control that owns that key. */
function keyBelongsToControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest(
    'input, select, textarea, button, a, [role="dialog"], [role="radiogroup"], '
    + '[role="tablist"], [contenteditable="true"]',
  ) !== null
}

export function PresentationShell({ mainRef, modeRef }: {
  mainRef: RefObject<HTMLElement>
  modeRef: RefObject<HTMLButtonElement>
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const project = demoProject(s.opportunityId)
  const projectName = project?.name ?? s.opportunityId ?? ''
  // Identity (client, address) comes from the portfolio register — the one
  // place the Product holds those fields. Composed at runtime, never literal.
  const portfolioProject = PORTFOLIO_PROJECTS.find((p) => p.id === s.opportunityId) ?? null

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

  const latestViewedSnapshot = currentId
    ? [...s.snapshots].reverse().find((snapshot) => snapshot.optionId === currentId)
    : undefined

  // VR2-08 — POST-SEND RE-ENTRY (M-3): an Option the store already knows was
  // sent reopens at its truthful Delivered state, never at a restart of the
  // narrative. Lazy initialisers read the snapshot truth once, at mount; the
  // effect below re-derives it only when the VIEWED Option changes.
  const [flow, setFlow] = useState<PresentationFlow>(
    () => (latestViewedSnapshot ? 'delivered' : 'narrative'),
  )
  const [delivery, setDelivery] = useState<'sent' | 'delivered'>(
    () => (latestViewedSnapshot ? 'delivered' : 'sent'),
  )
  const [sentSnapshot, setSentSnapshot] = useState<OfferSnapshot | null>(null)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'failed'>('idle')
  // The layers. OPEN is screen state; everything a layer commits is store state.
  const [variantenOpen, setVariantenOpen] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const variantenTrigger = useRef<HTMLButtonElement>(null)
  const { reduced, fadeRise, fadeOnly } = useSemanticMotion()

  // Leaving Present back to Work is the same cross-shell swap as entering it:
  // the CONTINUITY edge, with the brand mark paired across both shells.
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
      // Switching the presented Option keeps the chapter (store state) and
      // returns any send flow to the story — a client asking to see the other
      // variant has not left the narrative.
      setFlow('narrative')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  const recipient = recipientForOpportunity(s.opportunityId)

  useEffect(() => {
    if (flow !== 'sent') return
    const timer = window.setTimeout(() => {
      setDelivery('delivered')
      setFlow('delivered')
    }, DELIVERY_SIMULATION_MS)
    return () => window.clearTimeout(timer)
  }, [flow])

  /* ---- the proposal: resolved once, rendered everywhere ---- */

  const presented = clientPresentedSnapshot(s)
  const baselineSnapshot = clientBaselineSnapshot(s)
  const view: ClientView | null = current && presented && baselineSnapshot
    ? {
      optionName: current.name,
      savedVersion: latestSavedOptionVersion(s, current.id),
      presented,
      baseline: baselineSnapshot,
      projectName,
      projectHeroAssetId: project?.heroAssetId ?? null,
      language: s.uiLanguage,
    }
    : null
  const deps = { t, tx }
  const proposal: ClientProposal | null = view
    ? clientProposal(s, view, 'clientLiveConfiguration', deps, portfolioProject)
    : null
  const printProposal: ClientProposal | null = view
    ? clientProposal(s, view, 'clientPrint', deps, portfolioProject)
    : null

  const chapters: readonly ClientChapterId[] = proposal?.chapters ?? []
  const storedChapter = s.presentationChapter as ClientChapterId | null
  const activeChapter: ClientChapterId = storedChapter && chapters.includes(storedChapter)
    ? storedChapter
    : (chapters[0] ?? 'angebot')
  const chapterIndex = chapters.indexOf(activeChapter)

  // A rail click always lands in the narrative at that chapter — including
  // from inside the send lifecycle, where the rail is the one way back.
  const goTo = (id: ClientChapterId) => {
    setFlow('narrative')
    s.setPresentationChapter(id)
  }
  const step = (delta: 1 | -1) => {
    const next = chapters[chapterIndex + delta]
    if (next) goTo(next)
  }

  /**
   * Presenter shortcuts. They never take a key from a focused control: a
   * radio group's arrows, a text field's cursor and a dialog's own keys all
   * keep their meaning (AC 49). Space is deliberately not a shortcut.
   */
  const onShellKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (flow !== 'narrative') return
    if (variantenOpen || revertOpen || saveOpen) return
    if (keyBelongsToControl(event.target)) return
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault()
      step(-1)
    }
  }

  /* ---- Vollbild: offered, never required; Esc leaves it natively ---- */

  const fullscreenAvailable = typeof document !== 'undefined'
    && typeof document.documentElement.requestFullscreen === 'function'
    && document.fullscreenEnabled === true
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && document.fullscreenElement !== null,
  )
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }

  /**
   * Focus follows the chapter: moving to a chapter focuses its heading (one
   * `<h1>` at a time), spent by the ref callback rather than an effect so the
   * `AnimatePresence mode="wait"` remount cannot leave focus on `<body>`.
   * Initialised to the first render's key: mode entry is App.tsx's transition
   * and has already placed focus here, so this rule spends nothing there.
   */
  const focusKey = flow === 'narrative' ? `chapter:${activeChapter}` : `flow:${flow}`
  const wantedFocusKey = useRef<string>(focusKey)
  const focusedKey = useRef<string>(focusKey)
  wantedFocusKey.current = focusKey
  const pageHeadingRef = useCallback((el: HTMLHeadingElement | null) => {
    if (!el || focusedKey.current === wantedFocusKey.current) return
    focusedKey.current = wantedFocusKey.current
    // A chapter opens at its top, like a page — not scrolled to wherever the
    // heading happens to sit. Focus is placed without a second scroll so the
    // eyebrow above the title stays in view.
    if (mainRef.current) mainRef.current.scrollTop = 0
    el.focus({ preventScroll: true })
  }, [mainRef])

  const sendingTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (sendingTimerRef.current !== null) window.clearTimeout(sendingTimerRef.current)
  }, [])

  /* ---- honest states: no Option, none eligible, projection error ---- */

  if (!current || !view || !proposal || !printProposal) {
    const projectionError = current !== null
    return (
      <div className="a3-cp-shell">
        <div ref={barRef} className="a3-cp-band" role="region" aria-label={t('vr3.client.bar.label')}>
          <PresenterBar
            chapters={[]} activeChapter={null}
            onNavigate={() => {}} onStep={() => {}}
            variantenCount={0} onOpenVarianten={() => {}} variantenRef={variantenTrigger}
            optionName={null}
            fullscreen={fullscreen} fullscreenAvailable={fullscreenAvailable}
            onToggleFullscreen={toggleFullscreen}
            onExit={exitToWork} modeRef={modeRef}
          />
        </div>
        <main ref={mainRef} tabIndex={-1} className="a3-cp-stage">
          <div className="a3-cp-empty">
            <h1 ref={pageHeadingRef} tabIndex={-1} className="a3-cp-title">
              {projectionError
                ? t('vr3.client.projectionError.title')
                : (projectName || t('shell.profile.client'))}
            </h1>
            <p className="a3-cp-prose">
              <span aria-hidden="true">{projectionError ? '! ' : '○ '}</span>
              {projectionError
                ? t('vr3.client.projectionError.body')
                : s.options.length > 0
                  ? t('presentation.empty.noneReady')
                  : t('presentation.empty.noOption')}
            </p>
            {projectionError ? (
              <div className="a3-cp-layer-open">
                <Button variant="primary" onClick={exitToWork}>
                  {t('vr3.client.projectionError.action')}
                </Button>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    )
  }

  /* ---- the send lifecycle (VR2-08, preserved) ---- */

  const startOffer = () => {
    setSentSnapshot(null)
    setSendStatus('idle')
    setDelivery('sent')
    setFlow('offer')
  }
  const openSentSnapshot = () => {
    if (!sentSnapshot && !latestViewedSnapshot) return
    setFlow('snapshot')
  }
  const closeSentSnapshot = () => setFlow('delivered')
  const backToNarrative = () => {
    setSentSnapshot(null)
    setSendStatus('idle')
    goTo('abschluss')
  }

  // Rule 16 / EMAIL-001 §9.3 #5: an undetermined total is "not ready to
  // send" — it must never be frozen into an immutable snapshot.
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
        // The one real failure this call can produce (store.ts throws if the
        // option cannot be resolved). No snapshot is created, so the
        // immutable-snapshot invariant holds on failure too.
        setSendStatus('failed')
      }
    }, SEND_COMMIT_SIMULATION_MS)
  }

  const scenarioChanged = scenarioChangeCount(s.clientScenario) > 0
  const scenarioDelta = clientScenarioDelta(s)
  const scenarioDeltaText = scenarioDelta ? signedMoneyText(scenarioDelta, s.uiLanguage) : null

  const openSaveAsNew = () => { s.beginScenarioSaveAsNew(); setSaveOpen(true) }

  const renderChapter = (id: ClientChapterId) => {
    switch (id) {
      case 'angebot': return <ChapterAngebot proposal={proposal} headingRef={pageHeadingRef} />
      case 'ueberblick': return <ChapterUeberblick proposal={proposal} headingRef={pageHeadingRef} />
      case 'projekt': return <ChapterProjekt proposal={proposal} headingRef={pageHeadingRef} />
      case 'gebaeude': return <ChapterGebaeude proposal={proposal} headingRef={pageHeadingRef} />
      case 'preis': return <ChapterPreis proposal={proposal} headingRef={pageHeadingRef} />
      case 'leistungen': return <ChapterLeistungen proposal={proposal} headingRef={pageHeadingRef} />
      case 'terminplan': return <ChapterTerminplan proposal={proposal} headingRef={pageHeadingRef} />
      case 'architektur': return <ChapterArchitektur proposal={proposal} headingRef={pageHeadingRef} />
      case 'grundlagen': return <ChapterGrundlagen proposal={proposal} headingRef={pageHeadingRef} />
      case 'abschluss': return (
        <ChapterAbschluss
          proposal={proposal}
          headingRef={pageHeadingRef}
          outputs={(
            <ClientOutputsPanel
              view={view}
              proposal={proposal}
              onSaveAsNew={openSaveAsNew}
              onEmail={startOffer}
            />
          )}
        />
      )
    }
  }

  // Chapter change: the leaving chapter fades, the arriving one fades and
  // rises — no slide. Reduced motion collapses both to immediate.
  const chapterMotion: Variants = {
    ...fadeRise,
    ...(fadeOnly.exit ? { exit: fadeOnly.exit } : {}),
  }
  const motionKey = flow === 'narrative' ? activeChapter : flow

  return (
    <div className="a3-cp-shell" onKeyDown={onShellKeyDown}>
      {/* The presenter band: the one-row bar and the running identity
          beneath it are ONE region, so the what-if state (which lives on the
          identity row, where there is room for its delta and its two
          actions without ever squeezing the chapter rail) is reached from the
          same landmark as the rail. */}
      <div ref={barRef} className="a3-cp-band" role="region" aria-label={t('vr3.client.bar.label')}>
        <PresenterBar
          chapters={chapters.map((id) => ({ id, label: t(CHAPTER_LABEL_KEY[id]) }))}
          activeChapter={flow === 'narrative' ? activeChapter : null}
          onNavigate={goTo}
          onStep={step}
          variantenCount={candidates.length}
          onOpenVarianten={() => setVariantenOpen(true)}
          variantenRef={variantenTrigger}
          optionName={current.name}
          fullscreen={fullscreen}
          fullscreenAvailable={fullscreenAvailable}
          onToggleFullscreen={toggleFullscreen}
          onExit={exitToWork}
          modeRef={modeRef}
        />
        <RunningIdentity
          proposal={proposal}
          scenarioSlot={(
            <ScenarioState
              view={view}
              onRevert={() => setRevertOpen(true)}
              onSaveAsNew={openSaveAsNew}
            />
          )}
        />
      </div>

      <main ref={mainRef} tabIndex={-1} className="a3-cp-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={motionKey}
            variants={chapterMotion}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-1 flex-col"
          >
            {flow === 'narrative' ? renderChapter(activeChapter) : (
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

      {/* LAYER 2 — over the stage, back to the same chapter. */}
      <VariantenLayer
        view={view}
        open={variantenOpen}
        onClose={() => setVariantenOpen(false)}
        returnFocusTo={variantenTrigger}
      />
      <ScenarioRevertDialog
        open={revertOpen} onClose={() => setRevertOpen(false)}
        view={view} returnFocusTo={barRef}
      />
      <ScenarioSaveDialog
        open={saveOpen && s.clientScenarioSave?.stage === 'NAMING'}
        onClose={() => { s.cancelScenarioSaveAsNew(); setSaveOpen(false) }}
        view={view} returnFocusTo={barRef}
      />
      <ScenarioSaveReceipt view={view} />

      {/* The printed sheet: the SAME projection, print profile. */}
      <ClientPrintDocument
        proposal={printProposal}
        scenario={{ changed: scenarioChanged, deltaText: scenarioDeltaText }}
      />
    </div>
  )
}

/* ───────────────────────────── presenter bar ─────────────────────────── */

/**
 * ONE client-safe presenter bar: brand · chapter rail · actions. One row at
 * 1440 and at 1280, constant height whatever the Option count. It is
 * physically part of the client's screen, so everything on it is client
 * vocabulary: chapter names, `Varianten · N`, the presented Option's name,
 * the what-if state, DE/EN, Vollbild, Beenden. Nothing else.
 */
function PresenterBar({
  chapters, activeChapter, onNavigate, onStep, variantenCount, onOpenVarianten,
  variantenRef, optionName, fullscreen, fullscreenAvailable,
  onToggleFullscreen, onExit, modeRef,
}: {
  chapters: ReadonlyArray<{ id: ClientChapterId; label: string }>
  activeChapter: ClientChapterId | null
  onNavigate: (id: ClientChapterId) => void
  onStep: (delta: 1 | -1) => void
  variantenCount: number
  onOpenVarianten: () => void
  variantenRef: RefObject<HTMLButtonElement>
  optionName: string | null
  fullscreen: boolean
  fullscreenAvailable: boolean
  onToggleFullscreen: () => void
  onExit: () => void
  modeRef: RefObject<HTMLButtonElement>
}) {
  const t = useT()
  const s = useStore()
  const index = activeChapter ? chapters.findIndex((c) => c.id === activeChapter) : -1
  const atFirst = index <= 0
  const atLast = index === -1 || index >= chapters.length - 1

  return (
    <div className="a3-cp-bar">
      <div className="a3-cp-bar-brand">
        {/* `a3-brand-mark`: the one element both shells share, so the
            Work ⇄ Present CONTINUITY edge (view transition) can pair it. */}
        <img src={all3Logo} alt="All3" className="h-5 w-auto shrink-0 a3-brand-mark" />
      </div>

      {chapters.length > 0 ? (
        <nav aria-label={t('vr3.client.rail.label')} className="a3-cp-rail">
          <button
            type="button"
            className="a3-cp-rail-step"
            aria-label={t('vr3.client.bar.previous')}
            aria-disabled={atFirst ? 'true' : undefined}
            onClick={() => { if (!atFirst) onStep(-1) }}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <ol className="a3-cp-rail-list" role="list">
            {chapters.map((chapter, i) => (
              <li key={chapter.id}>
                {/* Ten chapters in ONE row at 1280: the rail shows every
                    chapter's number and names only the current one. Every
                    button still carries its full chapter name for AT and
                    on hover, so the jump target is never a bare numeral. */}
                <button
                  type="button"
                  onClick={() => onNavigate(chapter.id)}
                  aria-current={activeChapter === chapter.id ? 'step' : undefined}
                  aria-label={`${i + 1} · ${chapter.label}`}
                  title={chapter.label}
                  className="a3-cp-rail-item"
                >
                  <span className="a3-cp-rail-index numeric" aria-hidden="true">{i + 1}</span>
                  {activeChapter === chapter.id ? (
                    <span className="a3-cp-rail-text" aria-hidden="true">{chapter.label}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="a3-cp-rail-step"
            aria-label={t('vr3.client.bar.next')}
            aria-disabled={atLast ? 'true' : undefined}
            onClick={() => { if (!atLast) onStep(1) }}
          >
            <span aria-hidden="true">›</span>
          </button>
        </nav>
      ) : null}

      <div className="a3-cp-bar-actions">
        {/* With exactly one eligible Option there is nothing to compare, so
            the affordance is ABSENT — not disabled. */}
        {variantenCount >= 2 ? (
          <Button
            ref={variantenRef}
            variant="secondary"
            onClick={onOpenVarianten}
            aria-haspopup="dialog"
          >
            {`${t('vr3.client.varianten.open')} · ${variantenCount}`}
          </Button>
        ) : null}
        {optionName ? (
          <p className="a3-mode-indicator" role="status" aria-live="polite" aria-atomic="true">
            <span aria-hidden="true">◉</span>
            <span>{optionName}</span>
          </p>
        ) : null}
        <div className="a3-language-control">
          <SegmentedControl
            layout="inline"
            legend={t('vr3.client.bar.language')}
            legendHidden
            value={s.uiLanguage}
            onChange={(l) => s.setUiLanguage(l)}
            options={[
              { value: 'de', label: 'DE' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
        {/* Icon-only, named for AT and on hover: the label's width is what
            the chapter rail needs at 1280 to keep all ten chapters clickable
            beside `Varianten · N`, the Option name and the language switch. */}
        {fullscreenAvailable ? (
          <Button
            variant="ghost"
            className="a3-cp-fullscreen"
            onClick={onToggleFullscreen}
            aria-pressed={fullscreen}
            aria-label={t(fullscreen ? 'vr3.client.bar.exitFullscreen' : 'vr3.client.bar.fullscreen')}
            title={t(fullscreen ? 'vr3.client.bar.exitFullscreen' : 'vr3.client.bar.fullscreen')}
          >
            <span aria-hidden="true">{fullscreen ? '⤡' : '⤢'}</span>
          </Button>
        ) : null}
        <Button ref={modeRef} variant="secondary" onClick={onExit}>
          {t('shell.profile.exit')}
        </Button>
      </div>
    </div>
  )
}

/**
 * The running identity beneath the bar: project · address · `Indikatives
 * Angebot · <date>`. Visible on every chapter without competing with it.
 */
function RunningIdentity({ proposal, scenarioSlot }: {
  proposal: ClientProposal
  scenarioSlot: React.ReactNode
}) {
  const t = useT()
  const { identity, language } = proposal
  const date = identity.offerDateISO
    ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(identity.offerDateISO))
    : null
  return (
    <div className="a3-cp-identity">
      <p className="a3-cp-identity-text">
        <span className="a3-cp-identity-project">{identity.projectName}</span>
        {identity.addressLine ? (
          <span className="a3-cp-identity-address">{identity.addressLine}</span>
        ) : null}
        <span className="a3-cp-identity-offer">
          {t('vr3.client.opening.eyebrow')}
          {date ? ` · ${date}` : ''}
        </span>
      </p>
      {scenarioSlot}
    </div>
  )
}

type PageHeadingRef = Ref<HTMLHeadingElement>

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
  const topDrivers = topCostDrivers(current, t, language)
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
