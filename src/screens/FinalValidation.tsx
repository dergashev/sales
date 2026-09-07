import { useEffect, useRef } from 'react'
import {
  clientModeAvailableForOption,
  clientModeLockReasonFor,
  commercialResult,
  finalValidationAvailableFor,
  kgChapterProgressFor,
  latestSavedOptionVersion,
  optionReviewStageFor,
  optionSaveStageFor,
  reviewProgressFor,
  reviewReadyToConfirmFor,
  reviewSectionInputsFor,
  reviewSectionStatusFor,
  responsibilityFor,
  savedBaselineMatchesLiveResult,
  scheduleCriticalPhaseFor,
  scheduleDerivationFor,
  unsavedWorkingChangesFor,
  useStore,
} from '../state/store'
import {
  REVIEW_GROUPS,
  REVIEW_SECTIONS,
  type ReviewSectionId,
  type ReviewStage,
} from '../state/optionReview'
import { KG_SCOPE_GROUPS, type KgScopeGroup } from '../engine/kgConfiguration'
import { scopeSelectedIds, scopeBuilding, scopeMetricValue, selectedBgfRSTotal } from '../state/optionBuildingScope'
import { halfMonthsToMonths } from '../engine/schedule'
import { NNBSP } from '../engine/money'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { useT } from '../i18n'
import { useLocalNumber } from '../lib/localNumber'
import { Button } from '../components/primitives'
import { ActionGate } from '../design-system/ActionGate'
import { CommercialNumber } from '../design-system/CommercialNumber'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { MediaFrame } from '../design-system/MediaFrame'
import { projectAsset } from '../assets/project-media'
import {
  ReviewIndex,
  ReviewSection,
  ValidationReview,
  type ReviewIndexEntry,
  type ReviewSectionIssue,
  type ReviewSectionState,
} from '../design-system/ValidationReview'
import { SaveFailureNotice, SaveReceipt } from '../design-system/SaveReceipt'

/**
 * FINAL VALIDATION, the explicit SAVE, and the Client Mode unlock
 * (VR3-04, targets T-030–T-033, M-08).
 *
 * ONE STAGE, FIVE STATES. Locked behind an unconfirmed schedule; a long
 * review with sections still to read; a review with issues; a confirmed
 * review with Save available; and — after the save — the receipt that names
 * the version and unlocks the meeting. They are states of one place, because
 * a save that lived on a different screen from the review it depends on
 * would be a save the reader has to go and find.
 *
 * WHY IT IS LONG ON PURPOSE. "A long review is grouped and scannable, not
 * truncated into a superficial recap." Twelve sections, each read from its
 * own authority, each acknowledged explicitly, each with an exact route back
 * to the stage that owns it. The temptation this surface exists to resist is
 * the four-line summary — which is what the released product had, in Export,
 * and which is why "configuration complete" became the de-facto approval.
 */
export function FinalValidation() {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()

  const available = finalValidationAvailableFor(s)
  const inputs = reviewSectionInputsFor(s)
  const stage = optionReviewStageFor(s)
  const progress = reviewProgressFor(s)
  const readyToConfirm = reviewReadyToConfirmFor(s)
  const saveStage = optionSaveStageFor(s)
  const saved = latestSavedOptionVersion(s, s.activeOptionId)
  const clientAvailable = clientModeAvailableForOption(s, s.activeOptionId)
  const unsaved = unsavedWorkingChangesFor(s)
  const result = commercialResult(s)
  const heading = useRef<HTMLHeadingElement>(null)

  /**
   * M-08: the receipt REPLACES the busy action, and focus follows it. The
   * heading of the saved state is what receives focus (`SaveReceipt`'s own
   * `autoFocus`), so the outcome is announced rather than merely rendered —
   * which is the entire reduced-motion equivalent of the unlock emphasis.
   */
  const wasSaved = useRef(saveStage === 'SAVED')
  const justSaved = saveStage === 'SAVED' && !wasSaved.current
  useEffect(() => { wasSaved.current = saveStage === 'SAVED' }, [saveStage])

  if (!available) {
    return (
      <div className="px-7 py-6">
        <ActionGate
          status="locked"
          prerequisites={[{
            id: 'schedule',
            label: t('vr3.review.prereq.schedule'),
            met: false,
            detail: t('vr3.review.prereq.scheduleDetail'),
          }]}
          route={{
            label: t('vr3.review.route.schedule'),
            onSelect: () =>
              s.openConfiguratorStepAt(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE),
          }}
        >
          <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
            {t('vr3.review.heading.locked')}
          </h1>
        </ActionGate>
      </div>
    )
  }

  // ── the saved state (T-033) ──────────────────────────────────────────
  if (saveStage === 'SAVED' && saved) {
    const asset = projectAsset(
      scopeBuilding(s, scopeSelectedIds(s)[0] ?? null)?.identityAssetId ?? '',
    )
    const lockReason = clientModeLockReasonFor(s, s.activeOptionId)
    return (
      <div className="px-7 py-6">
        <SaveReceipt
          autoFocus={justSaved}
          eyebrow={t('vr3.save.receipt.eyebrow', { version: saved.version })}
          heading={t('vr3.save.receipt.heading', { option: saved.optionName })}
          explanation={t('vr3.save.receipt.explanation')}
          rows={[
            {
              id: 'validation',
              label: t('vr3.save.receipt.row.validation'),
              value: (
                <SemanticStatus
                  tone="ok"
                  size="compact"
                  label={t('vr3.save.receipt.row.validationConfirmed')}
                />
              ),
            },
            {
              id: 'savedAt',
              label: t('vr3.save.receipt.row.savedAt'),
              value: `${germanDate(saved.savedAt.slice(0, 10))}${NNBSP}·${NNBSP}${saved.savedAt.slice(11, 16)}`,
            },
            {
              id: 'total',
              label: saved.result.totalLabel,
              value: (
                <CommercialNumber
                  exact={result.total.exact}
                  language={s.uiLanguage}
                  displayed={result.total}
                  emphasis="compact"
                />
              ),
            },
            {
              id: 'clientMode',
              label: t('vr3.save.receipt.row.clientMode'),
              value: t(clientAvailable
                ? 'vr3.save.receipt.row.clientAvailable'
                : 'vr3.save.receipt.row.clientLocked'),
            },
          ]}
          unlock={clientAvailable
            ? { tone: 'ok', label: t('vr3.save.unlock.available'), reason: t('vr3.save.unlock.availableReason') }
            : {
              tone: 'attention',
              label: t('vr3.save.unlock.locked'),
              reason: t(lockReason === 'projectionInvalid'
                ? 'vr3.save.unlock.projectionInvalid'
                : lockReason === 'projectionOutdated'
                  ? 'vr3.save.unlock.projectionOutdated'
                  : 'vr3.save.unlock.notSaved'),
            }}
          actions={(
            <>
              <Button
                variant="primary"
                disabled={!clientAvailable}
                disabledReason={clientAvailable ? undefined : t('vr3.save.unlock.locked')}
                onClick={() => s.setGateOpen(true)}
              >
                {t('vr3.save.action.enterClientMode')}
              </Button>
              <Button variant="secondary" onClick={() => s.backToOpportunity()}>
                {t('vr3.save.action.anotherOption')}
              </Button>
            </>
          )}
          media={asset ? (
            <MediaFrame
              ratio="card"
              state="loaded"
              src={asset.url}
              alt={t(asset.altKey)}
              seed={saved.optionId}
              sourceId={asset.assetId}
            />
          ) : undefined}
        />
        {unsaved && (
          // A post-save working edit NEVER moves the saved baseline (M-3).
          // Saying so on the receipt is the only place the distinction is
          // legible: the version above is what the client sees, and the
          // working copy has moved past it.
          <div className="a3-rvw-dock">
            <SemanticStatus
              as="div"
              tone="stale"
              label={t('vr3.save.unsaved.label')}
              reason={t('vr3.save.unsaved.reason', { version: saved.version })}
            />
            <Button
              variant="secondary"
              onClick={() => s.setReviewFocusSection('projectBaseline')}
            >
              {t('vr3.save.unsaved.reopen')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── the review itself (T-030–T-032) ──────────────────────────────────
  const derivation = scheduleDerivationFor(s)
  const critical = scheduleCriticalPhaseFor(s)
  const baseline = s.projectBaseline
  const selectedIds = scopeSelectedIds(s)

  /**
   * A duration, in months, with its unit.
   *
   * Two decisions, both small and both wrong the other way round: the
   * decimal place appears only for a HALF month (`12`, never `12,0`), and
   * exactly one month is `1 Monat` rather than `1 Monate` — a plural the
   * grammar does not have is the kind of detail that makes a schedule read
   * as machine output.
   */
  const monthsLabel = (halfMonths: number) =>
    `${num(halfMonthsToMonths(halfMonths).toString(), halfMonths % 2 === 0 ? 0 : 1)}${NNBSP}`
    + t(halfMonths === 2 ? 'vr3.schedule.unit.month' : 'vr3.schedule.unit.months')

  const rowsFor = (sectionId: ReviewSectionId) => {
    if (sectionId === 'projectBaseline') {
      return baseline ? [
        { id: 'project', label: t('vr3.review.row.project'), value: baseline.projectName },
        {
          id: 'buildings',
          label: t('vr3.review.row.baselineBuildings'),
          value: t('vr3.review.value.baselineBuildings', {
            count: baseline.buildingCount,
            area: num(baseline.bgfRSTotal, 0),
          }),
        },
        {
          id: 'documents',
          label: t('vr3.review.row.documents'),
          value: num(baseline.documentCount),
        },
        {
          id: 'decisions',
          label: t('vr3.review.row.conflictDecisions'),
          value: num(baseline.conflictDecisions.length),
        },
      ] : []
    }
    if (sectionId === 'buildings') {
      return [
        {
          id: 'selected',
          label: t('vr3.review.row.selectedBuildings'),
          value: t('vr3.review.value.selectedBuildings', {
            count: selectedIds.length,
            area: num(selectedBgfRSTotal(s), 0),
          }),
        },
        ...selectedIds.map((id) => {
          const building = scopeBuilding(s, id)
          const bgf = building ? scopeMetricValue(s, building, 'bgfRSTotal') : null
          return {
            id,
            label: building?.name ?? id,
            value: bgf
              ? `${num(bgf, 0)}${NNBSP}${t('vr3.scope.unit.area')}`
              : t('vr3.review.value.absent'),
          }
        }),
      ]
    }
    if (sectionId === 'scopeDecisions') {
      return KG_SCOPE_GROUPS.map((group) => ({
        id: group,
        label: `KG${NNBSP}${group.slice(3)}`,
        value: t(`vr3.review.value.scope.${s.kgConfig?.scope[group] ?? 'undecided'}`),
      }))
    }
    if (sectionId === 'responsibility') {
      // VR3-TGA-UX-00: read through the ONE selector every consumer uses.
      // No amount row — the house connections are the Bauherr's, and the
      // boundary carries no cost authority; the section says so in words.
      const responsibility = responsibilityFor(s)
      if (!responsibility) {
        return [{
          id: 'absent',
          label: t('vr3.review.row.boundary'),
          value: t('vr3.review.value.absent'),
        }]
      }
      const en = s.uiLanguage === 'en'
      return [
        {
          id: 'boundary',
          label: t('vr3.review.row.boundary'),
          value: en
            ? responsibility.scopeBoundary.handoverEn
            : responsibility.scopeBoundary.handoverDe,
        },
        {
          id: 'connections',
          label: t('vr3.review.row.connections'),
          value: t('vr3.review.value.connections', {
            settled: responsibility.media.length - responsibility.unresolved.length,
            total: responsibility.media.length,
          }),
        },
        {
          id: 'costAuthority',
          label: t('vr3.review.row.costAuthority'),
          value: t('vr3.tga.price.bauherr'),
        },
      ]
    }
    if (sectionId === 'schedule') {
      return [
        {
          id: 'window',
          label: t('vr3.review.row.scheduleWindow'),
          value: derivation.startISO && derivation.completionISO
            ? `${germanDate(derivation.startISO)}${NNBSP}→${NNBSP}${germanDate(derivation.completionISO)}`
            : t('vr3.review.value.absent'),
        },
        {
          id: 'total',
          label: t('vr3.review.row.scheduleTotal'),
          value: derivation.totalHalfMonths === null
            ? t('vr3.review.value.absent')
            : monthsLabel(derivation.totalHalfMonths),
        },
        {
          id: 'critical',
          label: t('vr3.review.row.scheduleCritical'),
          value: critical
            ? phaseLabelOf(critical.phase.id, critical.phase.buildingId, s, t)
            : t('vr3.review.value.noCritical'),
        },
        {
          id: 'phases',
          label: t('vr3.review.row.schedulePhases'),
          value: num(derivation.windows.length),
        },
      ]
    }
    if (sectionId === 'assumptions') {
      return [
        {
          id: 'permitted',
          label: t('vr3.review.row.permittedAssumptions'),
          value: num(baseline?.permittedAssumptionIds.length ?? 0),
        },
        {
          id: 'openQuestions',
          label: t('vr3.review.row.openQuestions'),
          value: num(baseline?.openQuestionIds.length ?? 0),
        },
        {
          id: 'regionalfaktor',
          label: t('vr3.review.row.regionalfaktor'),
          value: t(s.regionalfaktorActive
            ? 'vr3.review.value.regionalfaktorActive'
            : 'vr3.review.value.regionalfaktorInactive'),
        },
      ]
    }
    if (sectionId === 'commercialResult') {
      return [
        {
          id: 'total',
          label: result.totalLabel,
          value: (
            <CommercialNumber
              exact={result.total.exact}
              language={s.uiLanguage}
              displayed={result.total}
              emphasis="default"
            />
          ),
        },
        {
          id: 'uncertainty',
          label: t('vr3.review.row.uncertainty'),
          value: `±${NNBSP}${num(result.uncertaintyPp)}${NNBSP}%`,
        },
        {
          id: 'reconciles',
          label: t('vr3.review.row.reconciles'),
          value: (
            <SemanticStatus
              size="compact"
              tone={result.reconciles ? 'ok' : 'error'}
              label={t(result.reconciles
                ? 'vr3.review.value.reconciles'
                : 'vr3.review.value.reconcilesNot')}
            />
          ),
        },
        ...(saved ? [{
          id: 'savedMatch',
          label: t('vr3.review.row.savedMatch'),
          value: (
            <SemanticStatus
              size="compact"
              tone={savedBaselineMatchesLiveResult(s) ? 'ok' : 'stale'}
              label={t(savedBaselineMatchesLiveResult(s)
                ? 'vr3.review.value.savedMatch'
                : 'vr3.review.value.savedDiffers')}
            />
          ),
        }] : []),
      ]
    }
    // A cost group.
    const group = `KG_${sectionId.slice(2)}` as KgScopeGroup
    const chapter = kgChapterProgressFor(s, group)
    const line = result.byCostGroup.find((candidate) => candidate.group === group)
    return [
      {
        id: 'decision',
        label: t('vr3.review.row.decision'),
        value: t(`vr3.review.value.scope.${s.kgConfig?.scope[group] ?? 'undecided'}`),
      },
      {
        id: 'services',
        label: t('vr3.review.row.services'),
        value: chapter
          ? t('vr3.review.value.services', {
            selected: chapter.selectedServiceCount,
            decided: chapter.decidedDecisions,
            required: chapter.requiredDecisions,
          })
          : t('vr3.review.value.absent'),
      },
      {
        id: 'amount',
        label: t('vr3.review.row.amount'),
        value: (
          <CommercialNumber
            exact={line?.exact ?? null}
            language={s.uiLanguage}
            emphasis="compact"
            absentLabel={t('vr3.review.value.unpriced')}
          />
        ),
      },
    ]
  }

  const sections = REVIEW_SECTIONS.map((definition) => {
    const input = inputs.find((candidate) => candidate.id === definition.id)
    const state = reviewSectionStatusFor(s, definition.id) as ReviewSectionState
    const issues: ReviewSectionIssue[] = (input?.issues ?? []).map((issue) => ({
      id: issue.id,
      tone: issue.severity === 'blocker' ? 'error' : 'attention',
      label: t(issue.severity === 'blocker'
        ? 'vr3.review.issue.blocker'
        : 'vr3.review.issue.permitted'),
      // A duration inside a finding is formatted with the same helper the
      // schedule's own rows use: one overshoot cannot print `0.5` here and
      // `0,5` one stage back.
      reason: t(issue.messageKey, issue.durationHalfMonths !== undefined
        ? { ...issue.values, months: monthsLabel(issue.durationHalfMonths) }
        : issue.values),
      route: {
        label: t('vr3.review.route.section', {
          stage: t(`vr3.review.stage.${issue.route}`),
        }),
        onSelect: () => s.openReviewIssueRoute(definition.id),
      },
    }))
    const blocked = state === 'ISSUE'
    return (
      <ReviewSection
        key={definition.id}
        id={`review-${definition.id}`}
        title={t(definition.titleKey)}
        state={state}
        stateLabel={t(`vr3.review.state.${state}`)}
        rows={rowsFor(definition.id)}
        issues={issues}
        focused={s.reviewFocusSectionId === definition.id}
        acknowledge={blocked ? undefined : (
          <>
            {/* SECONDARY, twelve times over. A long review has exactly one
                primary action — the confirmation in the dock at its end —
                and twelve orange buttons down a scrolling document would
                make the page shout its own furniture instead of its
                content. */}
            <Button
              variant="secondary"
              disabled={state === 'REVIEWED'}
              disabledReason={state === 'REVIEWED'
                ? t('vr3.review.action.alreadyReviewed')
                : undefined}
              onClick={() => s.acknowledgeReviewSection(definition.id)}
            >
              {t(state === 'STALE'
                ? 'vr3.review.action.reviewAgain'
                : 'vr3.review.action.review')}
            </Button>
            {state !== 'REVIEWED' && (
              <Button
                variant="ghost"
                onClick={() => s.openReviewIssueRoute(definition.id)}
              >
                {t('vr3.review.action.openStage', {
                  stage: t(`vr3.review.stage.${definition.route}`),
                })}
              </Button>
            )}
          </>
        )}
      />
    )
  })

  /**
   * NOT memoised, deliberately.
   *
   * This stage returns early for its locked state and for its saved state,
   * so a hook below those returns is a hook that runs on some renders and
   * not others — React's "rendered fewer hooks than expected", which is
   * exactly what a `useMemo` here produced. And there is nothing to memoise:
   * every entry is derived from the store, so the dependency list would be
   * the whole store and the memo would recompute on every render anyway.
   */
  const entries: ReviewIndexEntry[] = REVIEW_GROUPS.map((group) => {
    const states = group.sectionIds.map((id) => reviewSectionStatusFor(s, id))
    const worst: ReviewSectionState = states.includes('ISSUE') ? 'ISSUE'
      : states.includes('STALE') ? 'STALE'
        : states.every((state) => state === 'REVIEWED') ? 'REVIEWED' : 'PENDING'
    return {
      id: group.id,
      label: t(group.titleKey),
      state: worst,
      stateLabel: t(`vr3.review.state.${worst}`),
      count: group.sectionIds.length > 1
        ? {
          reviewed: states.filter((state) => state === 'REVIEWED').length,
          total: group.sectionIds.length,
        }
        : undefined,
      current: group.sectionIds.includes(s.reviewFocusSectionId ?? 'projectBaseline')
        && s.reviewFocusSectionId !== null,
      /**
       * ONE operation, not two.
       *
       * `focus()` already scrolls a focusable element into view — that is
       * spec behaviour, not a browser courtesy — so the `scrollIntoView`
       * that used to follow it was doing the same job a second time. It was
       * also the only reason this handler threw in jsdom, which implements
       * `focus` and not `scrollIntoView`: QA saw a green suite logging an
       * unhandled TypeError, which is exactly the noise that hides the next
       * real error.
       *
       * Where the heading LANDS is a styling question, and it is answered in
       * styling: `.a3-rvs-title` carries `scroll-margin-top`, so the focused
       * heading is not jammed against the top edge. Same result, one call,
       * and nothing to stub in a test environment.
       */
      onSelect: () => {
        const first = group.sectionIds[0]!
        s.setReviewFocusSection(first)
        document.getElementById(`review-${first}-heading`)?.focus()
      },
    }
  })

  return (
    <div className="px-7 py-6">
      {/* The one learned stage header again — position, name, lead, state. */}
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
          <p className="a3-cap">{t('vr3.review.eyebrow', { count: progress.total })}</p>
          <h1 className="a3-kgp-title" data-page-heading tabIndex={-1} ref={heading}>
            {t(stage === 'CONFIRMED' || stage === 'READY'
              ? 'vr3.review.heading.ready'
              : 'vr3.review.heading.review')}
          </h1>
          <p className="a3-lede">{t('vr3.review.lead')}</p>
        </div>
        <div className="a3-kgp-progress">
          <SemanticStatus
            tone={progress.blockers.length > 0 ? 'error'
              : stage === 'CONFIRMED' ? 'ok'
                : stage === 'STALE' ? 'stale' : 'attention'}
            label={progress.blockers.length > 0
              // One finding is `1 offener Befund`, not `1 offene Befunde`:
              // a plural the grammar does not have reads as machine output
              // on the surface whose whole job is to be trusted.
              ? t(progress.blockers.length === 1
                ? 'vr3.review.status.issue'
                : 'vr3.review.status.issues', { count: progress.blockers.length })
              : stage === 'CONFIRMED'
                ? t('vr3.review.status.confirmed')
                : t('vr3.review.status.progress', {
                  reviewed: progress.reviewed, total: progress.total,
                })}
            reason={stage === 'STALE' ? t('vr3.review.status.staleReason') : undefined}
          />
        </div>
      </div>

      <ValidationReview
        sectionsLabel={t('vr3.review.sectionsLabel')}
        index={(
          <ReviewIndex
            label={t('vr3.review.indexLabel')}
            entries={entries}
            progressLabel={t('vr3.review.status.progress', {
              reviewed: progress.reviewed, total: progress.total,
            })}
          />
        )}
        sections={sections}
        dock={(
          <>
            {saveStage === 'FAILED' && s.optionSaveCommit?.errorKey ? (
              <SaveFailureNotice
                label={t('vr3.save.failed.label')}
                reason={t(s.optionSaveCommit.errorKey)}
                preserved={t('vr3.save.failed.preserved')}
                retry={(
                  <>
                    <Button variant="primary" onClick={() => runSave(s)}>
                      {t('vr3.save.failed.retry')}
                    </Button>
                    <Button variant="ghost" onClick={() => s.clearOptionSaveError()}>
                      {t('vr3.save.failed.dismiss')}
                    </Button>
                  </>
                )}
              />
            ) : (
              <>
                <div>
                  <SemanticStatus
                    as="div"
                    tone={stage === 'CONFIRMED' ? 'ok' : 'neutral'}
                    label={t(stage === 'CONFIRMED'
                      ? 'vr3.review.dock.confirmed'
                      : 'vr3.review.dock.open')}
                    reason={progress.outstanding.length > 0
                      ? t('vr3.review.dock.outstanding', {
                        section: t(sectionTitleKey(progress.outstanding[0]!)),
                      })
                      : undefined}
                  />
                </div>
                <div className="a3-rvs-ack">
                  <Button
                    variant={stage === 'CONFIRMED' ? 'secondary' : 'primary'}
                    disabled={!readyToConfirm}
                    // A confirmed review is not blocked, it is DONE. Saying
                    // "review every section first" to somebody who just did
                    // is the wrong sentence twice over: it is untrue, and it
                    // sends them back into a document they have finished.
                    /* Same total-map discipline as the schedule stage after
                       QA-01: this ternary told the truth for every stage it
                       could reach, but it is the SHAPE that failed there —
                       one named branch and a default everything else
                       borrows. `REVIEW_BLOCKED_REASON_KEY` is exhaustive, so
                       a new review stage cannot inherit a wrong sentence. */
                    disabledReason={readyToConfirm
                      ? undefined
                      : t(REVIEW_BLOCKED_REASON_KEY[stage])}
                    onClick={() => s.confirmFinalValidation()}
                  >
                    {t('vr3.review.action.confirm')}
                  </Button>
                  <ActionGate
                    status={saveStage === 'SAVING' ? 'busy'
                      : saveStage === 'AVAILABLE' ? 'available' : 'locked'}
                    prerequisites={saveStage === 'LOCKED' ? [{
                      id: 'confirmation',
                      label: t('vr3.save.prereq.confirmation'),
                      met: false,
                      // The three reasons are different, and saying the
                      // wrong one is worse than saying none: findings,
                      // sections still to read, and "everything is read,
                      // the confirmation itself is what is missing" —
                      // which is where a reader who has just finished
                      // twelve sections actually stands.
                      detail: progress.blockers.length > 0
                        ? t('vr3.save.prereq.blockers', { count: progress.blockers.length })
                        : progress.reviewed < progress.total
                          ? t('vr3.save.prereq.outstanding', {
                            count: progress.total - progress.reviewed,
                          })
                          : t('vr3.save.prereq.confirmationMissing'),
                    }] : undefined}
                    route={saveStage === 'LOCKED' && progress.outstanding.length > 0
                      ? {
                        label: t('vr3.save.route.section', {
                          section: t(sectionTitleKey(progress.outstanding[0]!)),
                        }),
                        onSelect: () => {
                          const first = progress.outstanding[0]!
                          s.setReviewFocusSection(first)
                          document.getElementById(`review-${first}-heading`)?.focus()
                        },
                      }
                      : undefined}
                  >
                    <Button
                      variant="primary"
                      disabled={saveStage !== 'AVAILABLE'}
                      onClick={() => runSave(s)}
                    >
                      {t(saveStage === 'SAVING'
                        ? 'vr3.save.action.saving'
                        : 'vr3.save.action.save')}
                    </Button>
                  </ActionGate>
                </div>
              </>
            )}
          </>
        )}
      />
    </div>
  )
}

/**
 * Why the review's confirm reason is a total map too — see the schedule
 * stage's `STAGE_BLOCKED_REASON_KEY` for the defect that motivated it.
 *
 * `UNAVAILABLE` is unreachable from this control (the stage renders its own
 * gate instead of the dock), and `READY` is confirmable, so neither entry is
 * read in practice. They exist because the map is total and because a
 * sentence that would be wrong if it were ever read is exactly the thing
 * this shape exists to prevent.
 */
const REVIEW_BLOCKED_REASON_KEY: Readonly<Record<ReviewStage, string>> = {
  UNAVAILABLE: 'vr3.review.dock.unavailable',
  INCOMPLETE: 'vr3.review.dock.blocked',
  ISSUES: 'vr3.review.dock.blocked',
  READY: 'vr3.review.dock.blocked',
  CONFIRMED: 'vr3.review.dock.alreadyConfirmed',
  STALE: 'vr3.review.dock.blocked',
}

/**
 * The save, as two store transitions.
 *
 * `beginOptionSave` shows the busy action and RESERVES the version number;
 * `advanceOptionSave` performs the write and re-reads the gate at the
 * commitment's own boundary. Two calls rather than one because a save is a
 * commitment with a visible in-flight state, exactly like the building-scope
 * save and Option creation before it — and because the reserved number is
 * what makes a retry idempotent.
 */
function runSave(s: ReturnType<typeof useStore.getState>) {
  s.beginOptionSave()
  s.advanceOptionSave()
}

function sectionTitleKey(id: ReviewSectionId): string {
  return REVIEW_SECTIONS.find((section) => section.id === id)!.titleKey
}

function phaseLabelOf(
  phaseId: string,
  buildingId: string | null,
  s: ReturnType<typeof useStore.getState>,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (buildingId) {
    return t('vr3.schedule.phase.execution', {
      building: scopeBuilding(s, buildingId)?.name ?? buildingId,
    })
  }
  const kind = phaseId.split(':')[0]!
  return t(`vr3.schedule.phase.${kind}`)
}

function germanDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
