import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../state/store'
import {
  EDITABLE_SCOPE_METRICS,
  buildingScopeStage,
  isCountMetric,
  scopeBuilding,
  scopeBuildingConfirmed,
  scopeBuildingStale,
  scopeBuildingStatus,
  scopeConfirmedCount,
  scopeMetricAuthority,
  scopeMetricEdit,
  scopeMetricValue,
  scopeSelectedIds,
  scopeUnconfirmedBuildings,
  selectedBgfRSTotal,
  validateScopeMetric,
  type ScopeBuilding,
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
  BuildingIdentityCard,
  BuildingIdentityGroup,
  BuildingScopePanel,
} from '../design-system/BuildingScopePanel'
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

/** Facts in baseline order: identity first, then areas, then quantities. */
const AREA_METRICS: ScopeMetricKey[] = [
  'bgfRAbove', 'bgfSAbove', 'bgfRBelow', 'bgfRSTotal',
]

const QUANTITY_METRICS: ScopeMetricKey[] = [
  'wfl', 'nuf', 'commercialNuf', 'units', 'workplaces', 'parkingSpaces', 'siteArea',
]

const METRIC_LABEL_KEY: Record<string, string> = {
  bgfRAbove: 'vr3.scope.metric.bgfRAbove',
  bgfSAbove: 'vr3.scope.metric.bgfSAbove',
  bgfRBelow: 'vr3.scope.metric.bgfRBelow',
  bgfRSTotal: 'vr3.scope.metric.bgfRSTotal',
  wfl: 'vr3.scope.metric.wfl',
  nuf: 'vr3.scope.metric.nuf',
  commercialNuf: 'vr3.scope.metric.commercialNuf',
  units: 'vr3.scope.metric.units',
  workplaces: 'vr3.scope.metric.workplaces',
  parkingSpaces: 'vr3.scope.metric.parkingSpaces',
  siteArea: 'vr3.scope.metric.siteArea',
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
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <EmptyState>{t('vr3.scope.empty')}</EmptyState>
        )}
        gate={<SaveGate onAnnounce={announce} />}
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
  const asset = projectAsset(building.identityAssetId)
  const name = `${t('vr3.scope.building', { mark })} · ${building.name}`
  const status = scopeBuildingStatus(s, building.id)
  return (
    <BuildingIdentityCard
      name={building.name}
      designation={t('vr3.scope.building', { mark })}
      meta={`${t(building.usageKey)} · ${t(UNDERGROUND_KEY[building.undergroundLevel])}`}
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
      selected={Boolean(s.scopeSelected[building.id])}
      status={status}
      onToggle={() => s.toggleScopeBuilding(building.id)}
      // WCAG 2.5.3: the visible words are contained in the accessible name,
      // and the identity is IN it — a control that acts on one building is
      // never named by its verb alone.
      selectLabel={`${t('vr3.scope.selectAction')} · ${name}`}
      onReview={showReview ? () => s.setScopeActiveBuilding(building.id) : undefined}
      reviewing={reviewing}
      // The VISIBLE label stays short and the identity lives in the
      // accessible name — WCAG 2.5.3 is satisfied because the visible words
      // are CONTAINED in it, and three cards do not each carry a
      // two-line control that says the name a third time.
      reviewLabel={showReview ? t('vr3.scope.reviewAction') : undefined}
      reviewAccessibleLabel={showReview ? `${t('vr3.scope.reviewAction')} · ${name}` : undefined}
    />
  )
}

/* ─────────────────────────────── baseline ────────────────────────────── */

type DraftEdit = { key: ScopeMetricKey; value: string; reason: string; error: string | null }

function Baseline({
  building, designation: mark, onAnnounce,
}: {
  building: ScopeBuilding
  designation: string
  onAnnounce: (message: string) => void
}) {
  const s = useStore()
  const t = useT()
  const [draft, setDraft] = useState<DraftEdit | null>(null)
  const name = `${t('vr3.scope.building', { mark })} · ${building.name}`
  const isConfirmed = scopeBuildingConfirmed(s, building.id)
  const isStale = scopeBuildingStale(s, building.id)
  const confirmation = s.scopeConfirmations[building.id]

  const rows = [
    <BuildingBaselineRow
      key="storeys"
      label={t('vr3.scope.metric.storeys')}
      value={t(building.storeysKey)}
      provenance={(
        <BuildingBaselineProvenance
          authority={authorityPresentation(t, building.authority.storeys ?? 'sourceEvidenced')}
          evidence={t('vr3.scope.evidence.planSet')}
        />
      )}
    />,
    <BuildingBaselineRow
      key="underground"
      label={t('vr3.scope.metric.underground')}
      value={t(UNDERGROUND_KEY[building.undergroundLevel])}
      provenance={(
        <BuildingBaselineProvenance
          authority={authorityPresentation(
            t, building.authority.undergroundLevel ?? 'sourceEvidenced',
          )}
          evidence={t('vr3.scope.evidence.section')}
        />
      )}
    />,
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

  return (
    <BuildingBaselineSheet
      title={t('vr3.scope.baseline.title', { building: name })}
      authorityLabel={t('vr3.scope.baseline.authority', {
        authority: t(overallAuthorityKey(building)),
      })}
      rows={rows}
      notice={draft ? (
        <div className="a3-bsp-consequence" role="note">
          <SemanticStatus tone="attention" label={t('vr3.scope.edit.consequenceTitle')} />
          <p className="a3-bsp-consequence-detail">{t('vr3.scope.edit.consequenceDetail')}</p>
        </div>
      ) : isStale ? (
        <StaleState>{t('vr3.scope.stale.building', { building: name })}</StaleState>
      ) : undefined}
      actions={isConfirmed ? (
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
      )}
    />
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
  metric: ScopeMetricKey
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
  const value = scopeMetricValue(s, building, metric)
  const override = scopeMetricEdit(s, building.id, metric)
  const authority = scopeMetricAuthority(s, building, metric) as InformationAuthority
  const editable = (EDITABLE_SCOPE_METRICS as readonly string[]).includes(metric)
  const decimals = isCountMetric(metric) ? 0 : 0
  const unit = isCountMetric(metric) ? undefined : t('vr3.scope.unit.area')
  const label = t(METRIC_LABEL_KEY[metric] ?? metric)

  const commit = () => {
    if (!draft) return
    const parsed = validateScopeMetric(metric, draft.value, s.uiLanguage)
    if (!parsed.ok) {
      onDraft({ ...draft, error: t(`vr3.scope.edit.error.${parsed.error}`) })
      return
    }
    if (draft.reason.trim() === '') {
      onDraft({ ...draft, error: t('vr3.scope.edit.error.reason') })
      return
    }
    s.editScopeMetric(building.id, metric, parsed.value, draft.reason.trim())
    onDraft(null)
    onAnnounce(t('vr3.scope.announce.edited', { metric: label, building: buildingName }))
  }

  return (
    <BuildingBaselineRow
      label={label}
      value={value === null ? undefined : num(value, decimals)}
      unit={value === null ? undefined : unit}
      invalid={Boolean(draft?.error)}
      control={draft ? (
        <div className="a3-bsp-edit">
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
          <FormField label={t('vr3.scope.edit.reasonLabel')} htmlFor={reasonId}>
            <input
              id={reasonId}
              className="a3-input"
              autoComplete="off"
              value={draft.reason}
              onChange={(event) => onDraft({ ...draft, reason: event.target.value, error: null })}
            />
          </FormField>
          <div className="a3-bsp-edit-actions">
            <Button variant="primary" onClick={commit}>{t('vr3.scope.edit.commit')}</Button>
            <Button onClick={() => onDraft(null)}>{t('vr3.scope.edit.cancel')}</Button>
          </div>
        </div>
      ) : undefined}
      provenance={(
        <BuildingBaselineProvenance
          authority={authorityPresentation(t, authority)}
          evidence={building.evidenceDocIds[0]}
          override={override ? {
            previous: override.previous === null
              ? t('ds.authority.unknown')
              : num(override.previous, decimals),
            reason: override.reason,
            actor: override.actor,
            at: override.at.slice(0, 10),
            label: t('ds.authority.overrodeValue', {
              previous: override.previous === null
                ? t('ds.authority.unknown')
                : num(override.previous, decimals),
              reason: override.reason,
              actor: override.actor,
              at: override.at.slice(0, 10),
            }),
          } : undefined}
        />
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
              // never showed them.
              onClick={() => onDraft({
                key: metric,
                value: value === null ? '' : num(value, decimals),
                reason: override?.reason ?? '',
                error: null,
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

function SaveGate({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const selectedIds = scopeSelectedIds(s)
  const unconfirmed = scopeUnconfirmedBuildings(s)
  const saving = s.scopeCommit?.stage === 'SAVING'
  const errorKey = s.scopeCommit?.errorKey ?? null
  const ready = selectedIds.length > 0 && unconfirmed.length === 0
  const saved = buildingScopeStage(s) === 'SAVED'

  const prerequisites: GatePrerequisite[] = [
    {
      id: 'selection',
      label: t('vr3.scope.prereq.selection'),
      met: selectedIds.length > 0,
      detail: selectedIds.length > 0 ? undefined : t('vr3.scope.prereq.selectionDetail'),
    },
    ...s.scopeBuildings
      .filter((building) => s.scopeSelected[building.id])
      .map((building, index) => ({
        id: `confirm-${building.id}`,
        label: t('vr3.scope.prereq.building', {
          building: `${t('vr3.scope.building', { mark: designation(index) })} · ${building.name}`,
        }),
        met: scopeBuildingConfirmed(s, building.id),
        detail: scopeBuildingConfirmed(s, building.id)
          ? undefined
          : t('vr3.scope.prereq.buildingDetail'),
      })),
  ]

  return (
    <ActionGate
      status={errorKey ? 'error' : saving ? 'busy' : ready ? 'available' : 'locked'}
      prerequisites={prerequisites}
      route={unconfirmed[0] ? {
        label: t('vr3.scope.gate.route', { building: unconfirmed[0].name }),
        onSelect: () => s.setScopeActiveBuilding(unconfirmed[0]!.id),
      } : undefined}
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
            : selectedIds.length === 0 ? t('vr3.scope.prereq.selectionDetail')
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
