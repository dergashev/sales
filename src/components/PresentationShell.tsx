import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion } from 'framer-motion'
import opportunities from '../fixtures/opportunities.json'
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
import { Badge, Card, SelectField } from './designSystem'
import { SegmentedControl } from './controls'
import { PartialState, EmptyState } from './DataStates'
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
import { Dialog } from './Dialog'
import {
  ARTIFACT_GENERATION_FIRST_MS, ARTIFACT_GENERATION_STAGGER_MS,
} from '../config/ui-policy'
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

type Candidate = { id: string; name: string; cfg: OptionConfig; p: Projection }
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
  const opportunity = opportunities.items.find((o) => o.id === s.opportunityId)
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
  const [flow, setFlow] = useState<PresentationFlow>('narrative')
  const [delivery, setDelivery] = useState<'sent' | 'delivered'>('sent')
  const [sentSnapshot, setSentSnapshot] = useState<OfferSnapshot | null>(null)
  const { reduced } = useSemanticMotion()

  const latestViewedSnapshot = currentId
    ? [...s.snapshots].reverse().find((snapshot) => snapshot.optionId === currentId)
    : undefined

  // Reuse the validated CRM recipient contract already established for the
  // synthetic DEMO-0001 opportunity. An unknown opportunity remains blocked;
  // the client flow never invents or captures a recipient here.
  const recipient = recipientForOpportunity(s.opportunityId)
  const canSend = recipient !== null

  useEffect(() => {
    if (flow !== 'sent') return
    const timer = window.setTimeout(() => {
      setDelivery('delivered')
      setFlow('delivered')
    }, 2500)
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
          onSwitch={() => {}} onExit={() => s.setMode('intern')} modeRef={modeRef}
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
    setDelivery('sent')
    setFlow('offer')
    setActiveSection('naechster-schritt')
  }

  // A sent offer is a read-only artifact. Opening it must never restart the
  // narrative or create a new version; the snapshot remains the source of
  // truth even when the live Option has since changed.
  const openSentSnapshot = () => {
    if (!sentSnapshot) return
    setFlow('snapshot')
  }

  const closeSentSnapshot = () => setFlow('delivered')

  const backToNarrative = () => {
    setSentSnapshot(null)
    setFlow('narrative')
    setActiveSection('naechster-schritt')
  }

  const motionKey = flow === 'narrative' ? activeSection : flow

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PresentationTopBar
        sections={sections}
        activeSection={activeSection} onNavigate={goTo}
        candidates={candidates} currentId={current.id}
        onSwitch={switchViewedOption}
        onExit={() => s.setMode('intern')} modeRef={modeRef}
      />

      <main ref={mainRef} tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-default outline-none">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={motionKey}
            initial={reduced ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: reduced ? 0 : 0.2 }}
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
                onBack={backToNarrative}
                onPrepare={() => setFlow('send')}
                canSend={canSend}
                recipient={recipient}
                headingRef={pageHeadingRef}
                onSend={() => {
                  // An absent recipient must never create an immutable snapshot.
                  if (!canSend) return
                  const snapshot = s.sendOfferForOption('email', current.id)
                  setSentSnapshot(snapshot)
                  setDelivery('sent')
                  setFlow('sent')
                }}
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
        <img src={all3Logo} alt="All3" className="h-5 w-auto shrink-0" />
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
        <ul className="a3-presentation-artifacts mt-2">
          <li>{t('presentation.artifact.offer')}</li>
          <li>{t('presentation.artifact.cost')}</li>
          <li>{t('presentation.artifact.scope')}</li>
        </ul>
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

type GalleryArtifact = {
  id: 'offer' | 'cost' | 'scope'
  title: string
  description: string
  meta: string
  available: boolean
  unavailableReason?: string
}

type ArtifactStatus = 'generating' | 'ready' | 'unavailable'

/** §"NÄCHSTER SCHRITT" → OFFER — the commercial climax (VR2-07, remediated).
 *
 * Replaces the earlier weak stub (generic title, bullet-list artefacts, a
 * `dl` of scheduling facts) with the approved target's composition: ONE
 * dominant commercial result on the canonical stage-deep surface (ADR-R1-02,
 * same surface §3 ERGEBNIS already uses — DESIGN SYSTEM MODE: PRESERVE, no
 * new surface token), restrained supporting facts, and a client-safe
 * artefact gallery built from the canonical `Card` + `Dialog` primitives
 * (`designSystem.tsx` / `Dialog.tsx`) — no parallel gallery/card/modal
 * component invented.
 *
 * The gallery always lists the product's three structural deliverable
 * types (rule: "Drei Artefakte, eine Aussage." is an editorial constant,
 * not a live count) — an artefact's PREVIEW can be unavailable (Kostenüber-
 * sicht needs a determined total, the same `priceUnavailable` condition
 * rule 16/R-18 already governs), but the deliverable itself is never
 * removed from the list on that account. A defensive all-unavailable
 * EmptyState branch exists for DC-30 completeness.
 *
 * ACCEPTANCE REMEDIATION (cycle 2): each card now runs one honest,
 * short-lived "wird vorbereitet" phase on entry (indeterminate track, same
 * class DocumentAnalysis.tsx already uses — DC-10/rule 25, no invented
 * percentages) before resolving to its real status — a genuinely reachable
 * ARTEFACT GENERATING/UNAVAILABLE state on every visit, not only a
 * hypothetical one. Each ready card carries a real "Vorschau" action
 * (`Card`'s own `onOpen`+`actions` contract, same pattern OpportunityCard.tsx
 * already uses) opening a canonical `Dialog` with the actual computed data
 * that artefact represents — never a fabricated document.
 *
 * No in-panel "Zurück" link: the narrative strip (`goTo`, now flow-aware —
 * see `PresentationShell`) is the one way back, matching the approved
 * target's clean composition instead of duplicating that affordance.
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
  const language = useStore().uiLanguage
  const { p, cfg } = current
  const { reduced, fadeRise, transition } = useSemanticMotion()
  const hero = useMoneyCountUp(p.result.total.exact)
  const topDrivers = topCostDrivers(current, t)
  const biggestDriver = topDrivers[0]
  const segments = buildKgCompositionSegments(p.kgSplit, (g) => t(`costGroup.${g}`))

  const galleryArtifacts: GalleryArtifact[] = [
    {
      id: 'offer',
      title: t('presentation.artifact.offerCardTitle'),
      description: t('presentation.artifact.offerDescription'),
      meta: t('presentation.artifact.offerMeta'),
      available: true,
    },
    {
      id: 'cost',
      title: t('presentation.artifact.costCardTitle'),
      description: t('presentation.artifact.costDescription'),
      meta: t('presentation.artifact.costMeta'),
      available: !priceUnavailable,
      unavailableReason: t('presentation.artifact.costUnavailable'),
    },
    {
      id: 'scope',
      title: t('presentation.artifact.scopeCardTitle'),
      description: t('presentation.artifact.scopeDescription'),
      meta: t('presentation.artifact.scopeMeta'),
      available: true,
    },
  ]

  // Genuinely reachable ARTEFACT GENERATING/UNAVAILABLE state: one short
  // simulated preparation beat per card on entering the Offer stage, not a
  // permanently-static list. Reduced motion resolves every card straight to
  // its final status (rule 21 — nothing to sweep). Runs once per mount, not
  // per re-render, so switching the viewed Option afterwards updates the
  // resolved status immediately without replaying the sweep.
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(
    () => (reduced ? new Set(galleryArtifacts.map((a) => a.id)) : new Set()),
  )
  useEffect(() => {
    if (reduced) return
    const ids = galleryArtifacts.map((a) => a.id)
    const timers = ids.map((id, i) => window.setTimeout(() => {
      setGeneratedIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }, ARTIFACT_GENERATION_FIRST_MS + i * ARTIFACT_GENERATION_STAGGER_MS))
    return () => timers.forEach((id) => window.clearTimeout(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const statusOf = (a: GalleryArtifact): ArtifactStatus => {
    if (!generatedIds.has(a.id)) return 'generating'
    return a.available ? 'ready' : 'unavailable'
  }

  const [previewId, setPreviewId] = useState<GalleryArtifact['id'] | null>(null)
  const previewTriggerRef = useRef<HTMLElement | null>(null)
  const previewTitleId = useId()
  const previewTitleRef = useRef<HTMLHeadingElement>(null)
  const openPreview = (id: GalleryArtifact['id']) => {
    // The button is already focused by the native click that fires this
    // handler — capturing it here (rather than threading the event through
    // `Button`'s zero-arg `onClick`) is what `returnFocusTo` needs to send
    // focus back to the exact card that opened the dialog, not just "some"
    // trigger, when several cards can each open it.
    previewTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setPreviewId(id)
  }
  const previewArtifact = galleryArtifacts.find((a) => a.id === previewId) ?? null

  const anyAvailable = galleryArtifacts.some((a) => a.available)

  return (
    <section className="a3-offer-climax" aria-labelledby="presentation-offer-title">
      <motion.div
        className="a3-offer-climax-result a3-stage-deep"
        variants={fadeRise}
        initial="hidden"
        animate="visible"
        transition={transition('reveal', 0)}
      >
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

        <p className="a3-offer-climax-footnote mt-6 text-small">
          {t('presentation.flow.discountNotice')}
        </p>
      </motion.div>

      <motion.aside
        className="a3-offer-climax-gallery bg-surface-default"
        aria-labelledby="presentation-offer-gallery-title"
        variants={fadeRise}
        initial="hidden"
        animate="visible"
        transition={transition('reveal', 1)}
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
          <ul className="a3-offer-gallery-list mt-6" aria-busy={generatedIds.size < galleryArtifacts.length || undefined}>
            {galleryArtifacts.map((a) => {
              const status = statusOf(a)
              const ready = status === 'ready'
              return (
                <li key={a.id}>
                  <Card
                    className="a3-offer-gallery-card"
                    title={a.title}
                    meta={a.description}
                    onOpen={ready ? () => openPreview(a.id) : undefined}
                  >
                    {status === 'generating' ? (
                      <span className="a3-offer-gallery-generating">
                        <span aria-hidden="true" className="a3-analysis-track" />
                        {t('presentation.artifact.generating')}
                      </span>
                    ) : status === 'unavailable' ? (
                      <span><span aria-hidden="true">○ </span>{a.unavailableReason}</span>
                    ) : (
                      <span>{a.meta} · <span aria-hidden="true">{t('presentation.artifact.previewAction')} →</span></span>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}

        <div className="a3-offer-climax-cta mt-6">
          <Button className="w-full" variant="primary" onClick={onPrepare}>{t('presentation.flow.prepare')}</Button>
        </div>
      </motion.aside>

      <Dialog
        open={previewArtifact !== null}
        onOpenChange={(next) => { if (!next) setPreviewId(null) }}
        labelledBy={previewTitleId}
        initialFocusRef={previewTitleRef}
        returnFocusTo={previewTriggerRef as RefObject<HTMLElement>}
        panelClassName="a3-print-card"
      >
        {previewArtifact && (
          <>
            <div className="a3-paper-preview" aria-label={tx('Monochrome Seitenvorschau A4')}>
              <b>{current.name}</b>
              <hr />
              {previewArtifact.id === 'offer' && (
                <>
                  {tx(p.result.totalLabel)}<br />
                  <b>
                    {p.result.total.prefix ? `${p.result.total.prefix}${NNBSP}` : ''}
                    {p.result.total.display}{NNBSP}€
                  </b><br /><br />
                  {t('presentation.artifact.offerDescription')}
                </>
              )}
              {previewArtifact.id === 'cost' && !priceUnavailable && (
                <CompositionBar
                  segments={segments}
                  total={p.result.total.exact}
                  variant="expanded"
                  incompleteLabel={t('money.priceNotDetermined')}
                />
              )}
              {previewArtifact.id === 'scope' && (
                <>
                  {tx('Gebäude')}: {buildingNames(cfg)}<br /><br />
                  {t('presentation.artifact.scopeDescription')}
                </>
              )}
            </div>
            <div>
              <h4 ref={previewTitleRef} id={previewTitleId} tabIndex={-1} className="outline-none">
                {previewArtifact.title}
              </h4>
              <p className="a3-cap">{previewArtifact.meta} · {tx('Muster')}</p>
              <p className="mt-3 text-body text-text-secondary">{previewArtifact.description}</p>
              <div className="a3-row mt-3">
                <Button variant="primary" onClick={() => setPreviewId(null)}>{tx('Schließen')}</Button>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </section>
  )
}

function PresentationFlowScreen({
  flow, delivery, snapshot, current, projectName, onBack, onPrepare, canSend, recipient, onSend,
  onOpenSent, onCloseSnapshot, onNewVersion, headingRef,
}: {
  flow: Exclude<PresentationFlow, 'narrative'>
  delivery: 'sent' | 'delivered'
  snapshot?: OfferSnapshot
  current: Candidate
  projectName: string
  onBack: () => void
  onPrepare: () => void
  canSend: boolean
  recipient: ValidatedRecipient | null
  onSend: () => void
  onOpenSent: () => void
  onCloseSnapshot: () => void
  onNewVersion: () => void
  headingRef: PageHeadingRef
}) {
  const t = useT()
  const language = useStore().uiLanguage
  const { p } = current
  const priceUnavailable = p.result.total.exact.isZero()
  const artifacts = [
    t('presentation.artifact.offer'),
    t('presentation.artifact.cost'),
    t('presentation.artifact.scope'),
  ]

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
    return (
      <section className="a3-presentation-flow a3-paper" aria-labelledby="presentation-send-title">
        <button type="button" className="a3-presentation-back" onClick={onBack}>{t('presentation.flow.back')}</button>
        <div className="a3-presentation-send mt-4">
          <div>
            <p className="a3-cap">{t('offer.label')}</p>
            <h1 ref={headingRef} tabIndex={-1} id="presentation-send-title" className="mt-2 text-heading-1 font-bold text-text-primary">{t('presentation.flow.send.title')}</h1>
            <p className="mt-3 text-body text-text-secondary">{t('presentation.flow.send.copy')}</p>
          </div>
          <dl className="a3-presentation-send-details mt-8">
            <div><dt>{t('presentation.flow.recipient')}</dt><dd>{recipient ? t('presentation.flow.recipientValue', { email: recipient.address }) : t('presentation.flow.noRecipient')}</dd></div>
            <div><dt>{t('presentation.flow.subject')}</dt><dd>{current.name} · {t('presentation.flow.offerEyebrow')}</dd></div>
            <div><dt>{t('presentation.flow.language')}</dt><dd>{language === 'de' ? t('presentation.flow.german') : t('presentation.flow.english')}</dd></div>
          </dl>
          <div className="a3-presentation-send-summary mt-8">
            <p className="a3-cap">{t('presentation.flow.summary')}</p>
            <p className="mt-2 text-body font-medium text-text-primary">
              {priceUnavailable ? t('money.priceNotDetermined') : moneyLabel(present(p.result.total.exact))}
              <span className="text-text-secondary"> · {buildingNames(current.cfg)}</span>
            </p>
          </div>
          <div className="mt-6">
            <p className="a3-cap">{t('presentation.nextStep.artifacts')}</p>
            <ul className="a3-presentation-artifacts mt-2">
              {artifacts.map((artifact) => <li key={artifact}>{artifact}</li>)}
            </ul>
          </div>
          <p className="a3-presentation-snapshot mt-6">{t('presentation.flow.immutable')}</p>
          <div className="a3-presentation-flow-dock mt-8">
            <Button
              variant="primary"
              disabled={!canSend}
              disabledReason={recipient ? undefined : t('presentation.flow.noRecipient')}
              onClick={onSend}
            >
              {t('presentation.flow.sendAction')}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  const displayName = snapshot?.optionName ?? current.name
  const displayTotal = snapshot
    ? moneyLabel(present(new Decimal(snapshot.totalExact)))
    : priceUnavailable ? t('money.priceNotDetermined') : moneyLabel(present(p.result.total.exact))
  const eventAt = snapshot?.at ? formatDate(snapshot.at, language, true) : t('presentation.flow.justNow')

  if (flow === 'snapshot') {
    return (
      <section className="a3-presentation-flow a3-paper" aria-labelledby="presentation-snapshot-title">
        <button type="button" className="a3-presentation-back" onClick={onCloseSnapshot}>
          {t('presentation.flow.backToDelivery')}
        </button>
        <div className="a3-presentation-delivered mt-4">
          <p className="a3-cap">{t('presentation.flow.version')}</p>
          <h1 ref={headingRef} tabIndex={-1} id="presentation-snapshot-title" className="mt-2 text-heading-1 font-bold text-text-primary">
            {t('presentation.flow.snapshotTitle')}
          </h1>
          <p className="mt-3 text-body text-text-secondary">
            {t('presentation.flow.snapshotCopy')}
          </p>
          <dl className="a3-presentation-delivery-details mt-8">
            <div><dt>{t('presentation.flow.sentAt')}</dt><dd>{eventAt}</dd></div>
            <div><dt>{t('presentation.flow.version')}</dt><dd>{displayName} · {displayTotal}</dd></div>
            <div><dt>{t('presentation.flow.recipient')}</dt><dd>{recipient ? t('presentation.flow.recipientValue', { email: recipient.address }) : t('presentation.flow.noRecipient')}</dd></div>
            <div><dt>{t('presentation.flow.deliveryState')}</dt><dd>{t('presentation.flow.pending')}</dd></div>
          </dl>
          <div className="mt-8">
            <p className="a3-cap">{t('presentation.nextStep.artifacts')}</p>
            <ul className="a3-presentation-artifacts mt-2">
              {artifacts.map((artifact) => <li key={artifact}>{artifact}</li>)}
            </ul>
          </div>
          <p className="a3-presentation-snapshot mt-6">{t('presentation.flow.immutable')}</p>
        </div>
      </section>
    )
  }

  const delivered = flow === 'delivered' || delivery === 'delivered'

  return (
    <section className="a3-presentation-flow a3-stage" aria-labelledby="presentation-delivery-title">
      <div className="a3-presentation-delivered">
        <p className="a3-cap">{t('offer.label')}</p>
        <h1 ref={headingRef} tabIndex={-1} id="presentation-delivery-title" className="mt-2 text-heading-1 font-bold text-text-primary">
          {delivered ? t('presentation.flow.deliveredTitle') : t('presentation.flow.sentTitle')}
        </h1>
        <p className="mt-3 text-body text-text-secondary">
          {delivered ? t('presentation.flow.deliveredCopy') : t('presentation.flow.sentCopy')}
        </p>
        <dl className="a3-presentation-delivery-details mt-8">
          <div><dt>{t(delivered ? 'presentation.flow.deliveredAt' : 'presentation.flow.sentAt')}</dt><dd>{eventAt}</dd></div>
          <div><dt>{t('presentation.flow.version')}</dt><dd>{displayName} · {displayTotal}</dd></div>
          <div><dt>{t('presentation.flow.recipient')}</dt><dd>{recipient ? t('presentation.flow.recipientValue', { email: recipient.address }) : t('presentation.flow.noRecipient')}</dd></div>
          <div><dt>{t('presentation.flow.deliveryState')}</dt><dd>{t(delivered ? 'presentation.flow.confirmed' : 'presentation.flow.pending')}</dd></div>
        </dl>
        <div className="mt-8">
          <p className="a3-cap">{t('presentation.nextStep.artifacts')}</p>
          <ul className="a3-presentation-artifacts mt-2">
            {artifacts.map((artifact) => <li key={artifact}>{artifact}</li>)}
          </ul>
        </div>
        <div className="a3-presentation-flow-dock mt-8">
          <Button variant="secondary" onClick={onOpenSent}>{t('presentation.flow.openSent')}</Button>
          <Button variant="primary" onClick={onNewVersion}>{t('presentation.flow.newVersion')}</Button>
        </div>
      </div>
    </section>
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
