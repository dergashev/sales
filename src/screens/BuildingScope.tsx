import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../state/store'
import {
  EDITABLE_SCOPE_FACTS,
  buildingScopeStage,
  SCOPE_CHOICE_FACTS,
  derivedImpact,
  isCountMetric,
  isScopeChoiceFact,
  scopeBuilding,
  scopeBuildingConfirmed,
  scopeBuildingStale,
  scopeBuildingStatus,
  scopeCandidate,
  scopeCandidateCount,
  scopeConfirmedCount,
  scopeConflictsOf,
  scopeFactSource,
  scopeFactValue,
  scopeHasConflict,
  scopeMetricAuthority,
  scopeMetricEdit,
  scopeMetricValue,
  scopeSelectedIds,
  scopeUnconfirmedBuildings,
  selectedBgfRSTotal,
  validateScopeChoice,
  validateScopeMetric,
  type DerivedImpact,
  type DerivedResolution,
  type ScopeBuilding,
  type ScopeFactKey,
  type ScopeMetricKey,
} from '../state/optionBuildingScope'
import { useT } from '../i18n'
import { useLocalNumber } from '../lib/localNumber'
import { Button } from '../components/primitives'
import { FormField } from '../components/designSystem'
import { EmptyState, StaleState } from '../components/DataStates'
import { projectAsset } from '../assets/project-media'
import { MediaFrame } from '../design-system/MediaFrame'
import { ActionGate, PrerequisiteState, type GatePrerequisite } from '../design-system/ActionGate'
import { authorityLabelKey, type InformationAuthority } from '../design-system/AuthorityTrace'
import { SemanticStatus, type SemanticStatusTone } from '../design-system/SemanticStatus'
import {
  BuildingBaselineProvenance,
  BuildingBaselineRow,
  BuildingBaselineSheet,
  BuildingIdentityGroup,
  BuildingScopePanel,
  SelectableBuildingCard,
  type BuildingScopeState,
} from '../design-system/BuildingScopePanel'
import { USE_KEYS } from '../state/optionCommercialProjection'
import { SelectField } from '../components/designSystem'
import { STOREYS_KEYS } from '../state/projectAnalysis'
import { useSemanticMotion } from '../design-system/motion'

/**
 * Gebäude & Umfang — the ONLY substantive surface an Option has before its
 * Konfigurator is unlocked (VR3-02, targets T-013/T-014/T-015).
 *
 * It asks one question — what does this Option cover, and is each covered
 * building's baseline trustworthy — and it answers it at two densities: a
 * single building is a review, three buildings are a comparison. Both are
 * the same canonical capability, so a project that gains a building does not
 * gain a different screen.
 *
 * Every number on it comes from `optionBuildingScope`. This file formats and
 * arranges; it owns no metric, derives no total and stores no value. That is
 * the "no UI-owned duplicate metrics" rule, made structural: there is
 * nothing here for a second copy of a number to live in.
 */

/**
 * EVERY DISPLAYED FACT, in baseline order (B2, requirement 10).
 *
 * The released list showed four of the seven BGF facts and hid the three
 * sums' own components, which is part of why editing them was impossible to
 * offer: `BGF R+S oberirdisch` was not on screen to be edited, and neither
 * was the below-ground component it is built from. All fifteen are here now,
 * with the derived sums in their place among their parts, so an edit's
 * consequence is visible in the same table as its cause.
 */
const AREA_METRICS: ScopeMetricKey[] = [
  'bgfRAbove', 'bgfSAbove', 'bgfRSAbove',
  'bgfRBelow', 'bgfSBelow', 'bgfRSBelow', 'bgfRSTotal',
]

const QUANTITY_METRICS: ScopeMetricKey[] = [
  'wfl', 'nuf', 'commercialNuf', 'units', 'workplaces', 'parkingSpaces', 'siteArea',
]

const METRIC_LABEL_KEY: Record<string, string> = {
  usage: 'vr3.scope.metric.usage',
  storeys: 'vr3.scope.metric.storeys',
  underground: 'vr3.scope.metric.underground',
  bgfRAbove: 'vr3.scope.metric.bgfRAbove',
  bgfSAbove: 'vr3.scope.metric.bgfSAbove',
  bgfRSAbove: 'vr3.scope.metric.bgfRSAbove',
  bgfRBelow: 'vr3.scope.metric.bgfRBelow',
  bgfSBelow: 'vr3.scope.metric.bgfSBelow',
  bgfRSBelow: 'vr3.scope.metric.bgfRSBelow',
  bgfRSTotal: 'vr3.scope.metric.bgfRSTotal',
  wfl: 'vr3.scope.metric.wfl',
  nuf: 'vr3.scope.metric.nuf',
  commercialNuf: 'vr3.scope.metric.commercialNuf',
  units: 'vr3.scope.metric.units',
  workplaces: 'vr3.scope.metric.workplaces',
  parkingSpaces: 'vr3.scope.metric.parkingSpaces',
  siteArea: 'vr3.scope.metric.siteArea',
}

/**
 * The closed domain of each choice fact, and how to READ one of its values.
 *
 * The domains come from the modules that own them — the use keys from the
 * metric policy that classifies them, the storey keys from the project
 * baseline — so this screen holds no second copy of either list.
 */
const CHOICE_DOMAIN: Record<string, readonly string[]> = {
  usage: USE_KEYS,
  storeys: STOREYS_KEYS,
  underground: ['none', 'partial', 'full'],
}

/** A choice value, in the user's language. */
function choiceLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  key: string,
  value: string,
): string {
  return key === 'underground'
    ? t(UNDERGROUND_KEY[value as keyof typeof UNDERGROUND_KEY] ?? value)
    : t(value)
}

const UNDERGROUND_KEY = {
  none: 'vr3.scope.underground.none',
  partial: 'vr3.scope.underground.partial',
  full: 'vr3.scope.underground.full',
} as const

/**
 * One authority, presented once. The tone and the word come from the same
 * lookup, so a state can never be shown with another state's colour — and
 * colour is never the only carrier (rule 8): the word is always there.
 */
const AUTHORITY_TONE: Record<string, SemanticStatusTone> = {
  sourceEvidenced: 'ok',
  confirmed: 'ok',
  derived: 'neutral',
  userEntered: 'neutral',
  historical: 'neutral',
  aiInferred: 'attention',
  assumed: 'attention',
  overridden: 'attention',
  stale: 'stale',
  unknown: 'unknown',
}

function authorityPresentation(
  t: (key: string, values?: Record<string, string | number>) => string,
  authority: string,
): { tone: SemanticStatusTone; label: string } {
  return {
    tone: AUTHORITY_TONE[authority] ?? 'unknown',
    label: t(authorityLabelKey(authority as InformationAuthority)),
  }
}

/** `Gebäude A` … from the building's position in the Option's own scope. */
function designation(index: number): string {
  return String.fromCharCode(65 + index)
}

export function BuildingScope() {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const motionSpec = useSemanticMotion()
  const [announcement, setAnnouncement] = useState('')
  /**
   * The building whose first unresolved action the gate has asked for.
   *
   * Held here rather than in the store because it is transient interaction
   * state with no journal entry and no persistence — the same reason the
   * announcement above lives here.
   */
  const [focusRequest, setFocusRequest] = useState<string | null>(null)
  const stage = buildingScopeStage(s)

  const selectedIds = scopeSelectedIds(s)
  const confirmed = scopeConfirmedCount(s)
  const activeId = s.scopeActiveBuildingId && selectedIds.includes(s.scopeActiveBuildingId)
    ? s.scopeActiveBuildingId
    : selectedIds[0] ?? null
  const active = scopeBuilding(s, activeId)
  const multi = s.scopeBuildings.length > 1

  /**
   * The save is a staged commitment the surface TICKS, exactly like Option
   * creation: one advance per frame-scale timeout, so the busy state is
   * genuinely reachable and its failure branch is not a race against a
   * zero-length window. A state nobody can reach is not implemented.
   */
  const saving = s.scopeCommit?.stage === 'SAVING'
  useEffect(() => {
    if (!saving) return
    const handle = window.setTimeout(() => s.advanceBuildingScopeSave(), SAVE_STAGE_MS)
    return () => window.clearTimeout(handle)
  }, [saving, s])

  // M-05: the availability of the Konfigurator changes ONCE, and the user is
  // taken to the surface that states it. Announcement and route are the
  // reduced-motion equivalent — they are not decoration on top of motion,
  // they are the meaning motion would otherwise carry alone.
  const isSaved = stage === 'SAVED'
  /**
   * Seeded with the CURRENT value, not `false`.
   *
   * A ref initialised to `false` treats every mount as a transition into
   * saved, so returning to this surface from the Konfigurator bounced the
   * user straight back — the stage became unreachable the moment it was
   * complete. Found in the browser: the spine's own step 4 did nothing.
   */
  const wasSaved = useRef(isSaved)
  useEffect(() => {
    if (isSaved && !wasSaved.current) {
      setAnnouncement(t('vr3.scope.announce.saved'))
      s.setPipelineView('konfigurator')
    }
    wasSaved.current = isSaved
  }, [isSaved, s, t])

  if (s.scopeBuildings.length === 0) {
    return (
      <div className="px-7 py-6">
        <PrerequisiteState
          eyebrow={t('vr3.scope.eyebrow.noBaseline')}
          heading={t('vr3.scope.noBaseline.heading')}
          explanation={t('vr3.scope.noBaseline.explanation')}
          absenceTitle={t('vr3.scope.noBaseline.absenceTitle')}
          absenceDetail={t('vr3.scope.noBaseline.absenceDetail')}
          action={(
            <Button variant="primary" onClick={() => s.backToOpportunity()}>
              {t('vr3.scope.noBaseline.action')}
            </Button>
          )}
        />
      </div>
    )
  }

  const announce = (message: string) => setAnnouncement(message)

  return (
    <div className="px-7 py-6">
      <BuildingScopePanel
        eyebrow={t(isSaved ? 'vr3.scope.eyebrow.saved' : 'vr3.scope.eyebrow.review')}
        heading={t('nav.buildingScope')}
        progress={t('vr3.scope.progress', { confirmed, total: selectedIds.length })}
        lead={t(multi ? 'vr3.scope.lead.multi' : 'vr3.scope.lead.single')}
        notice={<ScopeNotice onAnnounce={announce} />}
        selection={(
          <BuildingIdentityGroup
            label={t('vr3.scope.selection.legend')}
            density={multi ? 'comparison' : 'single'}
          >
            {s.scopeBuildings.map((building, index) => (
              <IdentityCard
                key={building.id}
                building={building}
                designation={designation(index)}
                reviewing={multi && building.id === activeId}
                showReview={multi}
              />
            ))}
          </BuildingIdentityGroup>
        )}
        baseline={active ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              variants={motionSpec.fadeRise}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={motionSpec.transition('reveal')}
            >
              <Baseline
                building={active}
                designation={designation(
                  s.scopeBuildings.findIndex((b) => b.id === active.id),
                )}
                onAnnounce={announce}
                focusRequested={focusRequest === active.id}
                onFocusTaken={() => setFocusRequest(null)}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <EmptyState>{t('vr3.scope.empty')}</EmptyState>
        )}
        gate={<SaveGate onAnnounce={announce} onRequestFocus={setFocusRequest} />}
      />
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <p className="sr-only">
        {t('vr3.scope.selectedTotal', { value: num(selectedBgfRSTotal(s), 0) })}
      </p>
    </div>
  )
}

/** One advance per tick; the commitment is state, never a sleep. */
const SAVE_STAGE_MS = 200

/* ─────────────────────────────── identity ────────────────────────────── */

/**
 * The Option's scope state for one building, from the released status.
 *
 * `reviewRequired` is the audit's own word, and it covers the three ways a
 * selected building genuinely needs a human: a sum that contradicts its own
 * components, a re-analysis proposal nobody has decided, and a confirmation
 * that no longer matches what it confirmed. The released card said `Prüfung
 * offen` for the first visit and `Erneut prüfen` for staleness, and had no
 * word at all for the other two — because neither state existed yet.
 */
function scopeStateOf(
  s: ReturnType<typeof useStore>, buildingId: string,
): BuildingScopeState {
  const status = scopeBuildingStatus(s, buildingId)
  if (status === 'unselected') return 'excluded'
  if (status === 'confirmed') {
    return scopeCandidateCount(s, buildingId) > 0 ? 'reviewRequired' : 'confirmed'
  }
  if (status === 'conflict' || status === 'stale') return 'reviewRequired'
  return scopeCandidateCount(s, buildingId) > 0 ? 'reviewRequired' : 'included'
}

function IdentityCard({
  building, designation: mark, reviewing, showReview,
}: {
  building: ScopeBuilding
  designation: string
  reviewing: boolean
  showReview: boolean
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const asset = projectAsset(building.identityAssetId)
  const name = `${t('vr3.scope.building', { mark })} · ${building.name}`
  const state = scopeStateOf(s, building.id)
  const conflicts = Object.keys(scopeConflictsOf(s, building.id)).length
  const candidates = scopeCandidateCount(s, building.id)

  /** WHY this building needs a human — never `reviewRequired` on its own. */
  const reason = state !== 'reviewRequired'
    ? undefined
    : conflicts > 0
      ? t(conflicts === 1
        ? 'vr3.scope.reviewReason.conflict'
        : 'vr3.scope.reviewReason.conflicts', { count: conflicts })
      : candidates > 0
        ? t('vr3.scope.reviewReason.candidates', { count: candidates })
        : scopeBuildingStale(s, building.id)
          ? t('vr3.scope.reviewReason.stale')
          : undefined

  const bgf = scopeMetricValue(s, building, 'bgfRSTotal')
  return (
    <SelectableBuildingCard
      name={building.name}
      designation={t('vr3.scope.building', { mark })}
      meta={`${choiceLabel(t, 'usage', scopeFactValue(s, building, 'usage') ?? building.usageKey)} · ${
        choiceLabel(t, 'underground', scopeFactValue(s, building, 'underground') ?? building.undergroundLevel)}`}
      media={(
        <MediaFrame
          ratio="pano"
          state={asset ? 'loaded' : 'fallback'}
          src={asset?.url}
          alt={asset ? t(asset.altKey) : undefined}
          fallbackLabel={building.name}
          seed={building.id}
          sourceId={asset?.assetId}
        />
      )}
      state={state}
      reason={reason}
      onToggle={() => s.toggleScopeBuilding(building.id)}
      // WCAG 2.5.3: the visible words are contained in the accessible name,
      // and the identity is IN it — a control that acts on one building is
      // never named by its verb alone.
      selectLabel={`${t('vr3.scope.selectAction')} · ${name}`}
      summary={bgf === null ? undefined : (
        <p className="a3-sbc-summary-line">
          {t('vr3.scope.summary.bgf', { value: num(bgf, 0) })}
        </p>
      )}
      onOpenBaseline={showReview ? () => s.setScopeActiveBuilding(building.id) : undefined}
      reviewing={showReview ? reviewing : undefined}
      // The VISIBLE label stays short and the identity lives in the
      // accessible name — WCAG 2.5.3 is satisfied because the visible words
      // are CONTAINED in it, and three cards do not each carry a
      // two-line control that says the name a third time.
      openLabel={showReview ? t('vr3.scope.reviewAction') : undefined}
      openAccessibleLabel={showReview ? `${t('vr3.scope.reviewAction')} · ${name}` : undefined}
    />
  )
}

/* ─────────────────────────────── baseline ────────────────────────────── */

/**
 * Das Baseline-Blatt ist vorübergehend ausgeblendet (Owner, 16.09.2026).
 *
 * Die elf Zeilen wiederholten, was die Gebäudekarte darüber bereits sagt.
 * Ausgeblendet bleibt NUR die Tabelle samt Kopf: die Bestätigung — und bei
 * einem Entwurf der Hinweis auf die Folgen — bleibt stehen, weil das
 * Speicher-Gate genau diese Bestätigung verlangt. Ohne sie wäre `Gebäude-
 * umfang speichern` für ein frisches Gebäude unerreichbar.
 *
 * Auf `true` setzen bringt das Blatt unverändert zurück.
 */
const SHOW_BASELINE_SHEET = false

type DraftEdit = {
  key: ScopeFactKey
  value: string
  reason: string
  error: string | null
  /**
   * The explicit outcome for this edit's derived dependants. `null` means
   * the user has not chosen yet, and Save stays closed while it is — the
   * Product does not pick for them (baseline-editing-model.md).
   */
  resolution: DerivedResolution | null
}

function Baseline({
  building, designation: mark, onAnnounce, focusRequested, onFocusTaken,
}: {
  building: ScopeBuilding
  designation: string
  onAnnounce: (message: string) => void
  /** The gate sent the user here and asked for its outstanding action. */
  focusRequested?: boolean
  onFocusTaken?: () => void
}) {
  const s = useStore()
  const t = useT()
  const [draft, setDraft] = useState<DraftEdit | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  /**
   * The recovery's focus, taken once, by the surface that OWNS the target.
   *
   * The first unresolved thing is a conflict resolution if this building has
   * one, then a source proposal, then the confirmation — the same order the
   * gate's prerequisites list them in. Taken on the effect rather than in
   * the click handler, so it happens after this baseline has actually
   * mounted (`AnimatePresence mode="wait"` means that is later than the
   * click, by the exit transition).
   */
  useEffect(() => {
    if (!focusRequested) return
    const target = sheetRef.current?.querySelector<HTMLElement>(
      '.a3-bsp-conflict button, .a3-bsp-candidate button, .a3-bsp-baseline-actions button',
    )
    if (!target) return
    target.focus()
    // Bringing it into view is a COURTESY, not the contract: the focus above
    // is what the recovery owes the user. `scrollIntoView` is unimplemented
    // in the test environment, and an exception thrown from this effect
    // remounted the sheet and took the focus straight back off — the failure
    // looked exactly like "focus was never taken".
    target.scrollIntoView?.({ block: 'nearest' })
    onFocusTaken?.()
    // The request is consumed on arrival; re-running would fight the user
    // for focus every time this building's baseline re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequested, building.id])
  const name = `${t('vr3.scope.building', { mark })} · ${building.name}`
  const isConfirmed = scopeBuildingConfirmed(s, building.id)
  const isStale = scopeBuildingStale(s, building.id)
  const confirmation = s.scopeConfirmations[building.id]

  /**
   * EVERY DISPLAYED FACT IS A `MetricRow` NOW (B2, requirement 10).
   *
   * Use, storeys and the basement situation were three hand-written
   * read-only rows here — which is exactly how they came to be the facts
   * nobody could edit: they were not rows of the editable kind, they were
   * paragraphs. They are the same row as an area now, with the control their
   * data deserves, so "every displayed baseline row provides Edit" is true
   * by construction rather than by remembering to add three more editors.
   *
   * A metric with no value and no override is still absent: an unknown
   * quantity is not a row asking to be filled in from nothing (rule 16), and
   * a `0.00` below-ground area on a building without a basement is the
   * fixture saying "none" rather than a measurement.
   */
  const rows = [
    ...SCOPE_CHOICE_FACTS.map((key) => (
      <MetricRow
        key={key}
        building={building}
        metric={key}
        buildingName={name}
        draft={draft?.key === key ? draft : null}
        onDraft={setDraft}
        onAnnounce={onAnnounce}
      />
    )),
    ...[...AREA_METRICS, ...QUANTITY_METRICS]
      .filter((key) => scopeMetricValue(s, building, key) !== null
        && scopeMetricValue(s, building, key) !== '0.00')
      .map((key) => (
        <MetricRow
          key={key}
          building={building}
          metric={key}
          buildingName={name}
          draft={draft?.key === key ? draft : null}
          onDraft={setDraft}
          onAnnounce={onAnnounce}
        />
      )),
  ]

  const notice = draft ? (
    <div className="a3-bsp-consequence" role="note">
      <SemanticStatus tone="attention" label={t('vr3.scope.edit.consequenceTitle')} />
      <p className="a3-bsp-consequence-detail">{t('vr3.scope.edit.consequenceDetail')}</p>
    </div>
  ) : isStale ? (
    <StaleState>{t('vr3.scope.stale.building', { building: name })}</StaleState>
  ) : undefined

  const actions = isConfirmed ? (
    <p className="a3-bsp-confirmed" tabIndex={-1}>
      <SemanticStatus tone="ok" label={t('vr3.scope.confirmed.label')} />
      <span className="a3-bsp-confirmed-meta">
        {t('vr3.scope.confirmed.meta', {
          actor: confirmation?.actor ?? '',
          at: (confirmation?.at ?? '').slice(0, 10),
        })}
      </span>
    </p>
  ) : (
    <Button
      variant="primary"
      onClick={() => {
        s.confirmScopeBuilding(building.id)
        onAnnounce(t('vr3.scope.announce.confirmed', { building: name }))
      }}
      disabled={Boolean(draft)}
      disabledReason={draft ? t('vr3.scope.confirm.blockedByEdit') : undefined}
      aria-label={`${t('vr3.scope.confirm.action')} · ${name}`}
    >
      {t('vr3.scope.confirm.action')}
    </Button>
  )

  if (!SHOW_BASELINE_SHEET) {
    return (
      <div ref={sheetRef}>
        {/* Die Klasse bleibt: die Wiederherstellung des Gates sucht ihre
            Schaltfläche genau hier. */}
        {notice}
        <div className="a3-bsp-baseline-actions">{actions}</div>
      </div>
    )
  }

  return (
    <div ref={sheetRef}>
      <BuildingBaselineSheet
        title={t('vr3.scope.baseline.title', { building: name })}
        authorityLabel={t('vr3.scope.baseline.authority', {
          authority: t(overallAuthorityKey(building)),
        })}
        rows={rows}
        notice={notice}
        actions={actions}
      />
    </div>
  )
}

/**
 * The building's overall authority: the weakest one any material fact
 * carries. A baseline is only as trustworthy as its least-supported number,
 * and averaging trust would be the "assumption presented as source
 * evidence" defect the authority contract exists to prevent.
 */
const AUTHORITY_RANK: Record<string, number> = {
  unknown: 0, assumed: 1, aiInferred: 2, userEntered: 3, overridden: 4,
  // Derived and source-evidenced are the SAME trust level, not a ladder: a
  // number computed from evidenced numbers is evidence-backed, and ranking
  // it below its own inputs would label a fully documented building
  // "calculated" — an understatement of what the sources actually support.
  derived: 5, sourceEvidenced: 5, confirmed: 6,
}

function overallAuthorityKey(building: ScopeBuilding): string {
  let weakest = 6
  for (const value of Object.values(building.authority)) {
    const rank = AUTHORITY_RANK[value] ?? 0
    if (rank < weakest) weakest = rank
  }
  // The evidence level is reported as SOURCE EVIDENCED: at that level the
  // useful thing to say is that a source stands behind the value, not which
  // arithmetic step produced it.
  const name = weakest === 5
    ? 'sourceEvidenced'
    : Object.keys(AUTHORITY_RANK).find((key) => AUTHORITY_RANK[key] === weakest) ?? 'unknown'
  return `ds.authority.${name}`
}

function MetricRow({
  building, metric, buildingName, draft, onDraft, onAnnounce,
}: {
  building: ScopeBuilding
  metric: ScopeFactKey
  buildingName: string
  draft: DraftEdit | null
  onDraft: (draft: DraftEdit | null) => void
  onAnnounce: (message: string) => void
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const fieldId = useId()
  const reasonId = useId()
  const choice = isScopeChoiceFact(metric)
  const value = scopeFactValue(s, building, metric)
  const override = scopeMetricEdit(s, building.id, metric)
  const authority = scopeMetricAuthority(s, building, metric) as InformationAuthority
  const conflict = scopeConflictsOf(s, building.id)[metric]
  const candidate = scopeCandidate(s, building.id, metric)
  // EVERY displayed fact (requirement 10). The list is the contract; this
  // row does not decide what may be edited.
  const editable = (EDITABLE_SCOPE_FACTS as readonly string[]).includes(metric)
  const decimals = 0
  const unit = choice || isCountMetric(metric) ? undefined : t('vr3.scope.unit.area')
  const label = t(METRIC_LABEL_KEY[metric] ?? metric)
  const shown = value === null
    ? undefined
    : choice ? choiceLabel(t, metric, value) : num(value, decimals)

  /**
   * What this edit would move. Recomputed on every keystroke from the SAME
   * function the store will use to apply it, so the panel cannot promise one
   * outcome and the commit produce another.
   */
  const impacts: readonly DerivedImpact[] = draft && !choice && draft.error === null
    ? impactOf(s, building, metric, draft.value, s.uiLanguage)
    : []
  const needsResolution = impacts.length > 0

  const commit = () => {
    if (!draft) return
    const parsed = choice
      ? validateScopeChoice(draft.value, CHOICE_DOMAIN[metric] ?? [])
      : validateScopeMetric(metric as ScopeMetricKey, draft.value, s.uiLanguage)
    if (!parsed.ok) {
      onDraft({ ...draft, error: t(`vr3.scope.edit.error.${parsed.error}`) })
      return
    }
    if (draft.reason.trim() === '') {
      onDraft({ ...draft, error: t('vr3.scope.edit.error.reason') })
      return
    }
    // The derived dependants are RESOLVED BEFORE the commit, never after and
    // never by default: the store refuses an unresolved edit that has them,
    // and this is the surface that asks.
    const derived = impactOf(s, building, metric, parsed.value, s.uiLanguage)
    if (derived.length > 0 && !draft.resolution) {
      onDraft({ ...draft, error: t('vr3.scope.impact.detail') })
      return
    }
    s.editScopeMetric(
      building.id, metric, parsed.value, draft.reason.trim(),
      draft.resolution ?? undefined,
    )
    onDraft(null)
    onAnnounce(t('vr3.scope.announce.edited', { metric: label, building: buildingName }))
  }

  return (
    <BuildingBaselineRow
      label={label}
      value={shown}
      unit={value === null ? undefined : unit}
      invalid={Boolean(draft?.error)}
      control={draft ? (
        <div className="a3-bsp-edit">
          {choice ? (
            <SelectField
              id={fieldId}
              label={<span className="sr-only">{`${label} · ${buildingName}`}</span>}
              value={draft.value}
              error={draft.error ?? undefined}
              onChange={(event) => onDraft({
                ...draft, value: event.target.value, error: null,
              })}
            >
              {(CHOICE_DOMAIN[metric] ?? []).map((option) => (
                <option key={option} value={option}>
                  {choiceLabel(t, metric, option)}
                </option>
              ))}
            </SelectField>
          ) : (
            <FormField
              /* The row's own `<dt>` already names this fact in the column
                 beside it; a second visible label under it would print the
                 same words twice. The accessible name still carries the
                 building, because a control that changes one building's area
                 must say which building it belongs to. */
              label={<span className="sr-only">{`${label} · ${buildingName}`}</span>}
              htmlFor={fieldId}
              error={draft.error ?? undefined}
            >
              <input
                id={fieldId}
                className="a3-input numeric"
                inputMode="decimal"
                autoComplete="off"
                value={draft.value}
                onChange={(event) => onDraft({ ...draft, value: event.target.value, error: null })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); commit() }
                  if (event.key === 'Escape') { event.preventDefault(); onDraft(null) }
                }}
              />
            </FormField>
          )}
          {/* THE SOURCE VALUE, beside the field that replaces it. The editor
              contract asks for it explicitly, and it is the one thing a
              reader needs to judge an override they are about to make. */}
          <p className="a3-bsp-edit-source">
            {t('vr3.scope.edit.source')}
            {': '}
            {(() => {
              const source = scopeFactSource(building, metric)
              if (source === null) return t('vr3.scope.edit.sourceUnknown')
              return choice ? choiceLabel(t, metric, source) : num(source, decimals)
            })()}
          </p>
          <FormField label={t('vr3.scope.edit.reasonLabel')} htmlFor={reasonId}>
            <input
              id={reasonId}
              className="a3-input"
              autoComplete="off"
              value={draft.reason}
              onChange={(event) => onDraft({ ...draft, reason: event.target.value, error: null })}
            />
          </FormField>
          {/* THE IMPACT PANEL — before/after, and the two explicit outcomes.
              Rendered only when there is something to resolve, so an edit
              with no dependants is not slowed by a question about nothing. */}
          {needsResolution ? (
            <div className="a3-bsp-impact" role="group" aria-label={t('vr3.scope.impact.title')}>
              <SemanticStatus tone="attention" label={t('vr3.scope.impact.title')} />
              <p className="a3-bsp-impact-detail">{t('vr3.scope.impact.detail')}</p>
              <ul className="a3-bsp-impact-rows">
                {impacts.map((impact) => (
                  <li key={impact.key} className="a3-bsp-impact-row">
                    {t(impact.manual ? 'vr3.scope.impact.rowManual' : 'vr3.scope.impact.row', {
                      metric: t(METRIC_LABEL_KEY[impact.key] ?? impact.key),
                      before: impact.before === null
                        ? t('ds.authority.unknown')
                        : num(impact.before, decimals),
                      after: num(impact.after, decimals),
                    })}
                  </li>
                ))}
              </ul>
              <div className="a3-bsp-impact-choice">
                <label className="a3-bsp-impact-option">
                  <input
                    type="radio"
                    name={`${fieldId}-resolution`}
                    checked={draft.resolution === 'recalculate'}
                    onChange={() => onDraft({ ...draft, resolution: 'recalculate', error: null })}
                  />
                  <span>{t('vr3.scope.impact.recalculate')}</span>
                </label>
                <label className="a3-bsp-impact-option">
                  <input
                    type="radio"
                    name={`${fieldId}-resolution`}
                    checked={draft.resolution === 'keepManual'}
                    onChange={() => onDraft({ ...draft, resolution: 'keepManual', error: null })}
                  />
                  <span>{t('vr3.scope.impact.keep')}</span>
                </label>
              </div>
              {draft.resolution === 'keepManual' ? (
                <p className="a3-bsp-impact-detail">{t('vr3.scope.impact.keepHint')}</p>
              ) : null}
            </div>
          ) : null}
          <div className="a3-bsp-edit-actions">
            <Button
              variant="primary"
              onClick={commit}
              disabled={needsResolution && !draft.resolution}
              disabledReason={needsResolution && !draft.resolution
                ? t('vr3.scope.impact.detail')
                : undefined}
            >
              {t('vr3.scope.edit.commit')}
            </Button>
            {/* Cancel discards the draft and makes NO event. */}
            <Button onClick={() => onDraft(null)}>{t('vr3.scope.edit.cancel')}</Button>
          </div>
        </div>
      ) : undefined}
      provenance={(
        <>
          <BuildingBaselineProvenance
            authority={authorityPresentation(t, authority)}
            evidence={building.evidenceDocIds[0]}
            override={override ? {
              previous: override.previous === null
                ? t('ds.authority.unknown')
                : choice
                  ? choiceLabel(t, metric, override.previous)
                  : num(override.previous, decimals),
              reason: override.reason,
              actor: override.actor,
              at: override.at.slice(0, 10),
              label: t('ds.authority.overrodeValue', {
                previous: override.previous === null
                  ? t('ds.authority.unknown')
                  : choice
                    ? choiceLabel(t, metric, override.previous)
                    : num(override.previous, decimals),
                reason: override.reason,
                actor: override.actor,
                at: override.at.slice(0, 10),
              }),
            } : undefined}
          />
          {/* A SUM THAT CONTRADICTS ITS OWN COMPONENTS says so, where it is,
              until somebody resolves it. This is what `Keep dependent manual
              values` produces, and the whole reason that choice is safe to
              offer: the disagreement is never silent. */}
          {conflict ? (
            <div className="a3-bsp-conflict" role="note">
              <SemanticStatus tone="attention" label={t('vr3.scope.conflict.title')} />
              <p className="a3-bsp-conflict-detail">
                {t('vr3.scope.conflict.detail', {
                  metric: label,
                  kept: num(conflict.kept, decimals),
                  derived: num(conflict.derived, decimals),
                  cause: t(METRIC_LABEL_KEY[conflict.causedBy] ?? conflict.causedBy),
                })}
              </p>
              <Button
                onClick={() => {
                  s.resolveScopeConflict(building.id, metric)
                  onAnnounce(t('vr3.scope.conflict.resolve'))
                }}
              >
                {t('vr3.scope.conflict.resolve')}
              </Button>
            </div>
          ) : null}
          {/* A RE-ANALYSIS PROPOSAL, beside the value it may not overwrite
              (rule 14, D-08). Three explicit actions and no default. */}
          {candidate ? (
            <div className="a3-bsp-candidate" role="note">
              <SemanticStatus tone="stale" label={t('vr3.scope.candidate.title')} />
              <p className="a3-bsp-conflict-detail">
                {t('vr3.scope.candidate.detail', {
                  current: candidate.current === null
                    ? t('ds.authority.unknown')
                    : choice
                      ? choiceLabel(t, metric, candidate.current)
                      : num(candidate.current, decimals),
                  candidate: choice
                    ? choiceLabel(t, metric, candidate.value)
                    : num(candidate.value, decimals),
                })}
              </p>
              <div className="a3-bsp-edit-actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    s.acceptScopeCandidate(
                      building.id, metric, t('vr3.scope.candidate.reason'),
                    )
                    onAnnounce(t('vr3.scope.announce.edited', {
                      metric: label, building: buildingName,
                    }))
                  }}
                >
                  {t('vr3.scope.candidate.accept')}
                </Button>
                <Button onClick={() => s.dismissScopeCandidate(building.id, metric)}>
                  {t('vr3.scope.candidate.keep')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
      actions={(
        <>
          {editable && !draft ? (
            <button
              type="button"
              className="a3-bsp-edit-open hit-target"
              // The field opens on the value the user is LOOKING AT, in the
              // format they are looking at it in. Seeding it with the raw
              // canonical string would ask them to edit a number the screen
              // never showed them. A choice opens on its own key, because
              // that is what its select holds.
              onClick={() => onDraft({
                key: metric,
                value: choice ? (value ?? '') : (value === null ? '' : num(value, decimals)),
                reason: override?.reason ?? '',
                error: null,
                resolution: null,
              })}
              aria-label={`${t('vr3.scope.edit.open')} · ${label} · ${buildingName}`}
            >
              {t('vr3.scope.edit.open')}
            </button>
          ) : null}
          {override && !draft ? (
            <button
              type="button"
              className="a3-bsp-edit-open hit-target"
              onClick={() => {
                s.revertScopeMetric(building.id, metric)
                onAnnounce(t('vr3.scope.announce.reverted', {
                  metric: label, building: buildingName,
                }))
              }}
              aria-label={`${t('vr3.scope.edit.revert')} · ${label} · ${buildingName}`}
            >
              {t('vr3.scope.edit.revert')}
            </button>
          ) : null}
        </>
      )}
    />
  )
}

/**
 * The impact of a DRAFT value, parsed the way the commit will parse it.
 *
 * The draft holds what the user typed, in their locale; `derivedImpact`
 * needs the canonical decimal string. Parsing here with the same validator
 * the commit uses is what keeps the previewed before/after and the committed
 * before/after the same numbers — a second parser here is how a promise and
 * an outcome come to differ by a thousand.
 */
function impactOf(
  state: Parameters<typeof derivedImpact>[0],
  building: ScopeBuilding,
  metric: ScopeFactKey,
  raw: string,
  locale: 'de' | 'en',
): readonly DerivedImpact[] {
  if (isScopeChoiceFact(metric)) return []
  const parsed = validateScopeMetric(metric as ScopeMetricKey, raw, locale)
  if (!parsed.ok) return []
  return derivedImpact(state, building, metric, parsed.value)
}

/* ──────────────────────────── notices and gate ───────────────────────── */

function ScopeNotice({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const s = useStore()
  const t = useT()
  const pendingId = s.scopeRemovalPending
  const pending = scopeBuilding(s, pendingId)
  if (pending) {
    return (
      <div className="a3-bsp-consequence" role="alert" tabIndex={-1}>
        <SemanticStatus
          tone="attention"
          label={t('vr3.scope.removal.title', { building: pending.name })}
        />
        <p className="a3-bsp-consequence-detail">{t('vr3.scope.removal.detail')}</p>
        <div className="a3-bsp-edit-actions">
          <Button
            onClick={() => {
              s.confirmScopeRemoval()
              onAnnounce(t('vr3.scope.announce.removed', { building: pending.name }))
            }}
          >
            {t('vr3.scope.removal.confirm')}
          </Button>
          <Button variant="primary" onClick={() => s.cancelScopeRemoval()}>
            {t('vr3.scope.removal.cancel')}
          </Button>
        </div>
      </div>
    )
  }
  if (s.scopeSaved && buildingScopeStage(s) !== 'SAVED') {
    return <StaleState>{t('vr3.scope.stale.scope')}</StaleState>
  }
  return null
}

/**
 * The save gate, as a CONTEXTUAL DOCK (B2, Product Owner requirement 12).
 *
 * The audit measured this exact control: `Save building scope`, its blocker
 * and its recovery routes all sat at the END of a multi-building baseline,
 * below the initial viewport, so the reason a user could not save was off
 * screen at the moment they went looking for it. Nothing about the reasons
 * was wrong — their PLACE was.
 *
 * It is the same `ActionGate` with `placement="dock"`: sticky beside the
 * decision at 1440, stacked immediately above the action at 1280. The dock
 * is a Design System placement rather than a local sticky wrapper here,
 * because the next long surface with a blocked action needs the same thing
 * and a page-specific copy is how two gates come to behave differently.
 */
function SaveGate({ onAnnounce, onRequestFocus }: {
  onAnnounce: (message: string) => void
  /**
   * RECOVERY RETURNS FOCUS, and it does so DECLARATIVELY.
   *
   * `navigation-and-blocker-patterns.md` is explicit: "Recovery stores
   * `{returnRoute, focusTarget}`. Completing the prerequisite returns the
   * user to the blocked decision and restores focus to the action or first
   * unresolved item" — and names this exact case: "`Go to Hofhaus`, for
   * example, focuses that building's first unresolved baseline fact".
   *
   * The gate REQUESTS the focus and the baseline takes it when it mounts,
   * rather than the gate reaching into the DOM after the click. The first
   * cut did reach in, on the next animation frame, and it silently did
   * nothing: the baseline is inside `AnimatePresence mode="wait"`, so the
   * new building's sheet does not exist yet one frame later. A focus that
   * depends on winning a race against an exit transition is a focus that
   * works until the transition timing changes.
   */
  onRequestFocus: (buildingId: string) => void
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const selectedIds = scopeSelectedIds(s)
  const unconfirmed = scopeUnconfirmedBuildings(s)
  const saving = s.scopeCommit?.stage === 'SAVING'
  const errorKey = s.scopeCommit?.errorKey ?? null
  const ready = selectedIds.length > 0 && unconfirmed.length === 0
  const saved = buildingScopeStage(s) === 'SAVED'
  const conflicted = s.scopeBuildings.filter((building) =>
    s.scopeSelected[building.id] && scopeHasConflict(s, building.id))

  const prerequisites: GatePrerequisite[] = [
    {
      id: 'selection',
      label: t('vr3.scope.prereq.selection'),
      met: selectedIds.length > 0,
      detail: selectedIds.length > 0 ? undefined : t('vr3.scope.gate.noSelection'),
    },
    ...s.scopeBuildings
      .filter((building) => s.scopeSelected[building.id])
      .map((building, index) => ({
        id: `confirm-${building.id}`,
        label: t('vr3.scope.prereq.building', {
          building: `${t('vr3.scope.building', { mark: designation(index) })} · ${building.name}`,
        }),
        met: scopeBuildingConfirmed(s, building.id)
          && !scopeHasConflict(s, building.id),
        detail: scopeHasConflict(s, building.id)
          ? t('vr3.scope.conflict.title')
          : scopeBuildingConfirmed(s, building.id)
            ? undefined
            : t('vr3.scope.prereq.buildingDetail'),
      })),
  ]

  /**
   * ONE primary recovery, and it goes to the EARLIEST unmet prerequisite.
   *
   * Zero buildings first, because nothing else can be resolved until one is
   * in scope: `Include at least one building` used to be a `disabledReason`
   * with no route at all, so a user who had deselected everything was told
   * what was wrong and given nowhere to go. The route focuses the selection
   * group, which is the control that resolves it.
   */
  const route = selectedIds.length === 0
    ? {
      label: t('vr3.scope.gate.noSelectionRoute'),
      onSelect: () => {
        const group = document.querySelector<HTMLInputElement>('.a3-sbc-input')
        group?.focus()
        // Same courtesy, same guard as the baseline's recovery above.
        group?.scrollIntoView?.({ block: 'nearest' })
      },
    }
    : conflicted[0]
      ? {
        label: t('vr3.scope.gate.conflictRoute', { building: conflicted[0].name }),
        onSelect: () => {
          s.setScopeActiveBuilding(conflicted[0]!.id)
          onRequestFocus(conflicted[0]!.id)
        },
      }
      : unconfirmed[0]
        ? {
          label: t('vr3.scope.gate.route', { building: unconfirmed[0].name }),
          onSelect: () => {
            s.setScopeActiveBuilding(unconfirmed[0]!.id)
            onRequestFocus(unconfirmed[0]!.id)
          },
        }
        : undefined

  /** The other buildings that also owe something, when more than one does. */
  const secondaryRoutes = unconfirmed
    .slice(1)
    .map((building) => ({
      id: building.id,
      label: t('vr3.scope.gate.route', { building: building.name }),
      onSelect: () => {
        s.setScopeActiveBuilding(building.id)
        onRequestFocus(building.id)
      },
    }))

  return (
    <ActionGate
      placement="dock"
      status={errorKey ? 'error' : saving ? 'busy' : ready ? 'available' : 'locked'}
      prerequisites={prerequisites}
      route={route}
      secondaryRoutes={secondaryRoutes}
      error={errorKey ? {
        message: t(errorKey),
        retryLabel: t('vr3.scope.save.retry'),
        onRetry: () => {
          s.clearBuildingScopeSaveError()
          s.beginBuildingScopeSave()
        },
      } : undefined}
      alternative={selectedIds.length > 0 ? (
        <p className="a3-bsp-total">
          {t('vr3.scope.selectedTotal', { value: num(selectedBgfRSTotal(s), 0) })}
        </p>
      ) : undefined}
    >
      <Button
        variant="primary"
        loading={saving}
        loadingLabel={t('vr3.scope.save.busy')}
        disabled={!ready || saved}
        disabledReason={
          saved ? t('vr3.scope.save.alreadySaved')
            // `Include at least one building` — the target's own words, and
            // now beside a route that reaches the selection.
            : selectedIds.length === 0 ? t('vr3.scope.gate.noSelection')
              : conflicted.length > 0 ? t('vr3.scope.conflict.title')
                : t(unconfirmed.length === 1
                  ? 'vr3.scope.save.blocked.one'
                  : 'vr3.scope.save.blocked.many', { count: unconfirmed.length })
        }
        onClick={() => {
          s.beginBuildingScopeSave()
          onAnnounce(t('vr3.scope.announce.saving'))
        }}
      >
        {t('vr3.scope.save.action')}
      </Button>
    </ActionGate>
  )
}
