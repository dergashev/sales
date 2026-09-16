import { useEffect, useRef } from 'react'
import {
  clientModeAvailableForOption,
  clientModeLockReasonFor,
  commercialResult,
  finalValidationAvailableFor,
  kgCatalogueFor,
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
import {
  KG_DECIDED_SCOPE_GROUPS,
  chapterOf,
  dependencySuspension,
  isApplicable,
  kgServiceAnswer,
  type KgScopeGroup,
} from '../engine/kgConfiguration'
import { scopeSelectedIds, scopeBuilding, scopeMetricValue, selectedBgfRSTotal } from '../state/optionBuildingScope'
import { optionCommercialProjection } from '../state/optionCommercialProjection'
import { halfMonthsToMonths } from '../engine/schedule'
import { NNBSP, rateUnit } from '../engine/money'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { useLocalNumber } from '../lib/localNumber'
import { kgAnswerText } from '../lib/kgAnswerText'
import { Button } from '../components/primitives'
import { ActionGate } from '../design-system/ActionGate'
import { CommercialNumber } from '../design-system/CommercialNumber'
import { SemanticStatus } from '../design-system/SemanticStatus'
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
  const tx = useTx()
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
  /**
   * B2 · requirement 9 — the ONE shared projection, on the surface where a
   * seller signs the Option off. Built from `result` itself, so Validate
   * cannot review a denominator the Offer panel is not showing.
   */
  const areaProjection = optionCommercialProjection(
    s, result, kgCatalogueFor(s), s.kgConfig,
  )
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
      <div className="py-6">
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
    const lockReason = clientModeLockReasonFor(s, s.activeOptionId)
    return (
      <div className="py-6">
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
              // The engine composes this caption in German by contract
              // (R-18). Bridged like every other consumer of it — the
              // receipt is the artefact the reader keeps.
              label: tx(saved.result.totalLabel),
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
          /*
           * NUR DIE SPERRE SPRICHT NOCH (Owner, 17.09.2026).
           *
           * »Kundenmodus freigeschaltet« stand unmittelbar unter der Zeile
           * `Kundenmodus · verfügbar` und über der Schaltfläche, die ihn
           * öffnet — dieselbe Aussage dreimal. Der gesperrte Fall behält
           * seinen Satz: ein Element, das nicht geht, muss sagen warum
           * (Regel 12), und diese Begründung steht sonst nirgends.
           */
          unlock={clientAvailable ? undefined : {
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

  /**
   * The decisions behind one KG chapter's summary line — name, current
   * answer, and the route to the control that owns it.
   *
   * `undefined` where the chapter cannot be enumerated at all (no
   * catalogue, no configuration): a disclosure that opens on nothing is
   * worse than the sentence alone.
   */
  const kgDecisionDetails = (sectionId: ReviewSectionId, group: KgScopeGroup) => {
    const catalogue = kgCatalogueFor(s)
    const decisions = s.kgConfig
    if (!catalogue || !decisions) return undefined
    const chapterData = chapterOf(catalogue, group)
    if (!chapterData) return undefined
    /**
     * EXACTLY the set the sentence counts over — `kgChapterProgress` reads
     * the chapter's live services, and so does this. A decision a cascade
     * has suspended is not outstanding work and appears in neither.
     *
     * A service the project makes moot stays in the list and says so: it is
     * part of what the chapter decided, and dropping it would leave a list
     * shorter than the count above it. It carries NO edit button, because
     * there is no control to route to — rule 12's "a blocked element says
     * why" is served by the reason standing in the value.
     */
    const services = chapterData.groups
      .flatMap((systemGroup) => systemGroup.services)
      .filter((service) => dependencySuspension(catalogue, decisions, service) === null)
    if (services.length === 0) return undefined
    return {
      expandLabel: t('vr3.review.details.expand', { label: t('vr3.review.row.services') }),
      collapseLabel: t('vr3.review.details.collapse', { label: t('vr3.review.row.services') }),
      items: services.map((service) => {
        const applicable = isApplicable(service)
        return {
          id: service.id,
          label: s.uiLanguage === 'en' ? service.labelEn : service.labelDe,
          /* `nicht anwendbar` is a statement about the project, in the
             product's own word — not a tone. `SemanticStatus` has no
             not-applicable tone, and borrowing `neutral` would announce
             "nothing has happened yet" for something that is settled. The
             WHY stays where it can be read in full: the chapter's own
             `Warum?` disclosure on that row. */
          value: applicable
            ? kgAnswerText(
              kgServiceAnswer(catalogue, decisions, service, s.uiLanguage), s.uiLanguage, t,
            )
            : t('vr3.tga.notApplicable'),
          ...(applicable
            ? {
              edit: {
                label: t('vr3.review.details.edit'),
                onSelect: () => s.openKgServiceDecision(sectionId, group, service.id),
              },
            }
            : {}),
        }
      }),
    }
  }

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
      // The decisions a person took — the baseline groups are not among them.
      return KG_DECIDED_SCOPE_GROUPS.map((group) => ({
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
          /**
           * `2 von 4 geklärt` is the same kind of sentence as the KG
           * chapters': a count over a list the reader cannot see. The media
           * are real per-medium states, so the row opens to name them.
           *
           * Their route is the STEP that owns them, not the individual row:
           * the responsibility step has no per-medium landing, and inventing
           * one here would be a second navigation contract. The button says
           * so by going where the section's own route goes.
           */
          details: {
            expandLabel: t('vr3.review.details.expand', {
              label: t('vr3.review.row.connections'),
            }),
            collapseLabel: t('vr3.review.details.collapse', {
              label: t('vr3.review.row.connections'),
            }),
            items: responsibility.media.map((medium) => ({
              id: medium.id,
              label: en ? medium.labelEn : medium.labelDe,
              value: (
                <SemanticStatus
                  size="compact"
                  tone={medium.status === 'ok' ? 'ok' : 'attention'}
                  label={t(`vr3.responsibility.status.${medium.status}`)}
                />
              ),
              edit: {
                label: t('vr3.review.details.edit'),
                onSelect: () => s.openReviewIssueRoute('responsibility'),
              },
            })),
          },
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
          // Same engine-composed German caption, same bridge (R-18).
          label: tx(result.totalLabel),
          value: (
            <CommercialNumber
              exact={result.total.exact}
              language={s.uiLanguage}
              displayed={result.total}
              emphasis="default"
            />
          ),
        },
        /**
         * B2 · requirement 9 — the applicable area metrics, from the ONE
         * shared projection. The audit found Validate repeating net and
         * DIN 276 values with "the segment-denominator policy absent", so
         * the surface where a seller signs off on an Option could not show
         * the metric the offer is quoted in.
         *
         * One row per applicable metric, each naming its norm; a segment
         * that applies with no area keeps its norm and says the denominator
         * is not determined (rule 16).
         */
        ...areaProjection.metrics.map((metric) => {
          // The denominator is bridged ONCE: the metric's role decides the
          // words in front of it, not whether it needs bridging.
          const denominator = tx(metric.rate.denominatorLabel)
          const role = metric.role === 'segment'
            ? t(metric.segmentLabelKey ?? 'b2.metric.scale')
            : t('b2.metric.scale')
          return {
            id: `rate-${metric.id}`,
            label: `${role} · ${denominator}`,
            value: localizeMoneyText(rateUnit(metric.rate), s.uiLanguage),
          }
        }),
        ...areaProjection.gaps.map((gap) => ({
          id: `rate-gap-${gap.id}`,
          label: `${t(gap.segmentLabelKey)} · ${tx(gap.denominatorLabel)}`,
          value: t('b2.metric.denominatorUnknown'),
        })),
        ...(areaProjection.metrics.filter((m) => m.role === 'segment').length > 1
          ? [{
            id: 'rate-note',
            label: t('b2.metric.useProfile.mixed'),
            value: t('b2.metric.notAdditive'),
          }]
          : []),
        {
          id: 'energy',
          label: t('b2.metric.energy'),
          value: areaProjection.energy
            ? (s.uiLanguage === 'en'
              ? areaProjection.energy.variantLabelEn
              : areaProjection.energy.variantLabelDe)
            : t('vr3.review.value.absent'),
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
        /**
         * The sentence STAYS and opens (owner, 16.09.2026).
         *
         * `22 gewählt · 2 von 2 entschieden` counts decisions the reader
         * could not see from here. The list under it names each one and its
         * current answer — read through the ONE engine reading every other
         * surface uses (`kgServiceAnswer`), never recomputed here — and
         * every entry carries the route to its own control.
         *
         * The set is exactly the set the sentence counts over: the
         * chapter's live, applicable services. A decision a cascade has
         * suspended is not outstanding work and is not listed, for the same
         * reason `kgChapterProgress` does not count it.
         */
        details: kgDecisionDetails(sectionId, group),
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
        /* EINE Bestätigung für den ganzen Bogen, unten im Dock.
           Zwölf gleich aussehende Knöpfe den Bogen hinunter waren Möblierung,
           kein Fortschritt: welcher davon der nächste war, stand ohnehin nur
           im Dock. Die Prüfung selbst bleibt abschnittsweise — der Knopf
           unten bestätigt genau den Abschnitt, den das Dock benennt, und
           rückt dann zum nächsten. Der Weg in die Stufe, die einen Befund
           behebt, bleibt HIER: er gehört zum Befund und nicht zum
           Fortschritt. */
        acknowledge={state === 'REVIEWED' || blocked ? undefined : (
          <Button
            variant="ghost"
            onClick={() => s.openReviewIssueRoute(definition.id)}
          >
            {t('vr3.review.action.openStage', {
              stage: t(`vr3.review.stage.${definition.route}`),
            })}
          </Button>
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
    <div className="py-6">
      {/* The one learned stage header again — position, name, lead, state. */}
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
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
                  {/* Der Sammelknopf „alle Abschnitte geprüft" ist fort
                      (Owner, 16.09.2026). Er war die Abkürzung um eine
                      Vorbedingung herum, die es nicht mehr gibt: die Freigabe
                      wartet nicht mehr darauf, dass jeder Abschnitt als
                      gelesen vermerkt wurde. Ein Knopf, der einen ganzen
                      Bogen als gelesen erklärt, ohne dass davon noch etwas
                      abhängt, behauptet nur eine Lesehandlung. Der
                      Abschnittsvermerk selbst bleibt, dort wo der Abschnitt
                      steht. */}
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
                  {/* Der Grund steht AM Knopf, nicht als Block darunter.
                      Regel 12 verlangt, dass ein gesperrtes Element erklärt,
                      warum — sie verlangt nicht, dass die Erklärung dauerhaft
                      Platz einnimmt. Der stehende Kasten wiederholte, was das
                      Dock links („als nächstes: …") und der Index oben
                      („2 von 10 geprüft") ohnehin sagen, und der Weg zum
                      offenen Abschnitt stand damit dreimal auf einem
                      Bildschirm. Die drei Gründe bleiben getrennt: offene
                      Befunde, ungelesene Abschnitte, und „alles gelesen, es
                      fehlt die Freigabe" — der letzte ist der, vor dem
                      jemand nach zehn Abschnitten tatsächlich steht. */}
                  <Button
                    variant="primary"
                    disabled={saveStage !== 'AVAILABLE'}
                    /* EIN Satz, und zwar der, der immer stimmt: gespeichert
                       wird erst nach der Freigabe daneben — egal, ob noch
                       Abschnitte offen sind, ein Befund im Weg steht oder
                       nur die Freigabe selbst fehlt. Wie viele Abschnitte
                       offen sind, steht ohnehin im Index und im Dock; hier
                       stand es ein drittes Mal, und zwar als Grund für einen
                       Knopf, der auch nach dem letzten Abschnitt noch
                       gesperrt bliebe. */
                    disabledReason={saveStage === 'AVAILABLE' || saveStage === 'SAVING'
                      ? undefined
                      : t('vr3.save.prereq.confirmFirst')}
                    onClick={() => runSave(s)}
                  >
                    {t(saveStage === 'SAVING'
                      ? 'vr3.save.action.saving'
                      : 'vr3.save.action.save')}
                  </Button>
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
/**
 * Save, and then GO — the receipt is not a station on the way (owner's
 * decision, 15.09).
 *
 * The save produced exactly one thing the seller now needs: a client
 * baseline. `Präsentieren` is where that baseline is used, it already states
 * the saved version, its total and its saved-at, and it carries the only
 * door into the client projection — so landing on a page whose own primary
 * action was "go there" made the last step of the workflow a page the reader
 * had to click through. The route is taken for them.
 *
 * Read against the store AFTER the attempt, never against the snapshot this
 * was called with: `advanceOptionSave` refuses the save on a race (an edit
 * in flight, a switched Option) and records the failure instead, and routing
 * away from that failure would hide it on the surface that reports it.
 *
 * The receipt is untouched and stays the surface of the `Speichern` step:
 * coming back to it is how the seller reads WHAT was saved, including the
 * one thing that exists nowhere else — a working copy that has since moved
 * past the saved version (M-3).
 */
function runSave(s: ReturnType<typeof useStore.getState>) {
  s.beginOptionSave()
  s.advanceOptionSave()
  const after = useStore.getState()
  if (optionSaveStageFor(after) === 'SAVED') after.setPipelineView('praesentieren')
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
