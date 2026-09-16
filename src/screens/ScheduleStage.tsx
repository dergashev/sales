import { useEffect, useRef, useState } from 'react'
import { hasV3Surfaces } from '../lib/variantLock'
import { Decimal } from 'decimal.js'
import {
  activeSchedulePhasesFor,
  optionScheduleStageFor,
  scheduleAvailableFor,
  scheduleCriticalLeadFor,
  scheduleCriticalPhaseFor,
  scheduleDerivationFor,
  scheduleIssuesFor,
  scheduleReadyToConfirmFor,
  useStore,
  kgDecidedScopeCount,
  kgScopeDecisionsComplete,
} from '../state/store'
import { KG_SCOPE_GROUPS, firstOutstandingKgGroup } from '../engine/kgConfiguration'
import { kgCatalogueFor } from '../state/store'
import { scopeBuilding } from '../state/optionBuildingScope'
import { halfMonthsToMonths } from '../engine/schedule'
import { NNBSP } from '../engine/money'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { useT } from '../i18n'
import { useLocalNumber } from '../lib/localNumber'
import { Button } from '../components/primitives'
import { DateField, Switch } from '../components/controls'
import { ActionGate } from '../design-system/ActionGate'
import { SemanticStatus, type SemanticStatusTone } from '../design-system/SemanticStatus'
import {
  ScheduleEditor,
  type ScheduleEditorNotice,
  type ScheduleEditorPhase,
} from '../design-system/ScheduleEditor'
import type { ScheduleStage as ScheduleStageState } from '../state/optionSchedule'
import { BauzeitStage } from './BauzeitStage'

/**
 * The SCHEDULE stage (VR3-04, target T-029).
 *
 * IT FOLLOWS THE CONFIGURATION AND IT IS SEPARATELY CONFIRMABLE. Those two
 * sentences are the whole ticket for this surface. What it replaces was a
 * chapter called "Bauzeit" that showed a fixture Gantt and one date field:
 * useful, honest about what it showed, and structurally unable to be a
 * stage — configuration completion had no consequence for it, and nothing
 * downstream could ask whether the schedule was settled (audit F-011).
 *
 * FAIL-CLOSED, like every stage before it. Reached before the included cost
 * groups are complete, it renders its own gate with the named prerequisite
 * and the route that resolves it — never an editable plan for a
 * configuration that is not finished, which would invite the user to settle
 * dates for services they have not chosen yet.
 */
export function ScheduleStage() {
  const s = useStore()
  /**
   * VARIANTE `v3` — dieselbe Stufe, gerechnet statt geerbt.
   *
   * Die Umschaltung steht hier und nicht im Router, damit die Stufe EIN
   * Ort bleibt: Sperre, Route und Bestätigung gehören beiden Varianten
   * gemeinsam, und nur die Darstellung des Plans unterscheidet sich.
   */
  if (hasV3Surfaces(s.navVariant)) {
    // Die Sperre zuerst, in BEIDEN Varianten: eine gerechnete Terminplanung
    // für eine unfertige Konfiguration wäre eine Zahl ohne Grundlage.
    return scheduleAvailableFor(s) ? <BauzeitStage /> : <ScheduleLockedGate />
  }
  return <ScheduleStageV2 />
}

/**
 * DIE SPERRE der Terminstufe — EIN Ort für beide Varianten.
 *
 * `v2` und `v3` unterscheiden sich in der Darstellung des Plans, nie in der
 * Voraussetzung dafür. Zwei Kopien dieser Sperre wären zwei Antworten auf
 * die Frage „darf hier schon geplant werden?", und die zweite wäre die,
 * die jemand zu pflegen vergisst.
 */
export function ScheduleLockedGate() {
  const s = useStore()
  const t = useT()
  const decided = kgDecidedScopeCount(s)
  const catalogue = kgCatalogueFor(s)
  const outstanding = catalogue && s.kgConfig
    ? firstOutstandingKgGroup(catalogue, s.kgConfig)
    : null
  const scopeComplete = kgScopeDecisionsComplete(s)
  return (
    <div className="py-6">
      <ActionGate
        status="locked"
        prerequisites={[{
          id: 'configuration',
          label: t('vr3.schedule.prereq.configuration'),
          met: false,
          detail: !scopeComplete
            ? t('vr3.kg.gate.decisionsDetail', { decided, total: KG_SCOPE_GROUPS.length })
            : outstanding
              ? t('vr3.kg.gate.chapterOutstanding', {
                group: `KG${NNBSP}${outstanding.slice(3)}`,
              })
              : t('vr3.schedule.prereq.configurationDetail'),
        }]}
        route={{
          label: outstanding
            ? t('vr3.schedule.route.chapter', {
              group: `KG${NNBSP}${outstanding.slice(3)}`,
            })
            : t('vr3.schedule.route.scope'),
          onSelect: () => {
            if (outstanding) { s.openKgChapter(outstanding); return }
            s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
          },
        }}
      >
        <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
          {t('vr3.schedule.heading.locked')}
        </h1>
      </ActionGate>
    </div>
  )
}

function ScheduleStageV2() {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()

  const available = scheduleAvailableFor(s)
  const stage = optionScheduleStageFor(s)
  const derivation = scheduleDerivationFor(s)
  const issues = scheduleIssuesFor(s)
  const phases = activeSchedulePhasesFor(s)
  const critical = scheduleCriticalPhaseFor(s)
  const criticalLead = scheduleCriticalLeadFor(s)
  const readyToConfirm = scheduleReadyToConfirmFor(s)
  const heading = useRef<HTMLHeadingElement>(null)
  const [dependenciesOpen, setDependenciesOpen] = useState(false)

  /**
   * M-08's first half: the confirmation CHANGES what is available, and the
   * meaning of that change travels in focus and in an announcement rather
   * than in an animation. Focus goes to this stage's heading when the
   * schedule becomes confirmed, because the next step is a different stage
   * and moving focus into a nav item the user did not ask for is exactly
   * what M-05 forbade one stage earlier.
   */
  const wasConfirmed = useRef(stage === 'CONFIRMED')
  useEffect(() => {
    if (stage === 'CONFIRMED' && !wasConfirmed.current) heading.current?.focus()
    wasConfirmed.current = stage === 'CONFIRMED'
  }, [stage])

  if (!available) return <ScheduleLockedGate />

  const totalHalfMonths = derivation.totalHalfMonths
  const span = totalHalfMonths ?? 0
  const percent = (halfMonths: number) => (span > 0 ? (halfMonths / span) * 100 : 0)
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
   * One issue's sentence.
   *
   * A duration inside it is formatted HERE with the same helper the phase
   * rows use, so an overshoot of half a month prints `0,5 Monate` on a
   * German screen and `0.5 months` on an English one — and can never print
   * `0.5` beside a phase that prints `0,5`.
   */
  const issueText = (issue: { messageKey: string; values?: Readonly<Record<string, string | number>>; durationHalfMonths?: number }) =>
    t(issue.messageKey, issue.durationHalfMonths !== undefined
      ? { ...issue.values, months: monthsLabel(issue.durationHalfMonths) }
      : issue.values)

  const issueFor = (fieldId: string) =>
    issues.find((issue) => issue.fieldId === fieldId)

  const phaseLabel = (phaseId: string): string => {
    const phase = phases.find((candidate) => candidate.id === phaseId)
    if (!phase) return phaseId
    if (phase.buildingId) {
      const building = scopeBuilding(s, phase.buildingId)
      return t('vr3.schedule.phase.execution', {
        building: building?.name ?? phase.buildingId,
      })
    }
    return t(`vr3.schedule.phase.${phase.kind}`)
  }

  const phaseUnit = (buildingId: string | null): string => {
    if (!buildingId) return t('vr3.schedule.unit.project')
    return scopeBuilding(s, buildingId)?.name ?? buildingId
  }

  const dependencyLabel = (dependsOn: string | null): string =>
    dependsOn === null
      ? t('vr3.schedule.dependency.start')
      : t('vr3.schedule.dependency.after', { phase: phaseLabel(dependsOn) })

  const editorPhases: readonly ScheduleEditorPhase[] = derivation.windows.map((window) => {
    const durationIssue = issueFor(`schedule-duration-${window.phase.id}`)
    return {
      id: window.phase.id,
      label: phaseLabel(window.phase.id),
      unit: phaseUnit(window.phase.buildingId),
      dependency: dependencyLabel(window.phase.dependsOn),
      startLabel: germanDate(window.startISO),
      endLabel: germanDate(window.endISO),
      durationLabel: monthsLabel(window.phase.durationHalfMonths),
      offsetPercent: percent(window.startHalfMonths),
      widthPercent: percent(window.phase.durationHalfMonths),
      critical: critical?.phase.id === window.phase.id,
      durationField: {
        id: `schedule-duration-${window.phase.id}`,
        label: t('vr3.schedule.field.duration', { phase: phaseLabel(window.phase.id) }),
        value: num(halfMonthsToMonths(window.phase.durationHalfMonths).toString(),
          window.phase.durationHalfMonths % 2 === 0 ? 0 : 1),
        unit: t('vr3.schedule.unit.months'),
        kind: 'duration',
        error: durationIssue ? issueText(durationIssue) : undefined,
        onCommit: (raw) => {
          const halves = halfMonthsFromInput(raw)
          if (halves === null) return
          s.setSchedulePhaseDuration(window.phase.id, halves)
        },
      },
    }
  })

  const notices: ScheduleEditorNotice[] = issues
    // The duration errors are already printed BY their own field, which
    // owns and associates the sentence. Printing them again here would be
    // two nodes carrying one message — the defect the building-scope rows
    // recorded, and a "found multiple elements" failure in the DOM suite.
    .filter((issue) => !issue.fieldId.startsWith('schedule-duration-'))
    .map((issue) => ({
      id: issue.id,
      tone: (issue.severity === 'error' ? 'error' : 'attention') as SemanticStatusTone,
      label: t(issue.severity === 'error'
        ? 'vr3.schedule.notice.error'
        : 'vr3.schedule.notice.warning'),
      reason: issueText(issue),
      fieldId: issue.fieldId,
      action: issue.phaseId && issue.id.startsWith('dependencyUnconfirmed:')
        ? (
          <Button
            variant="secondary"
            onClick={() => s.setScheduleDependencyConfirmed(issue.phaseId!, true)}
          >
            {t('vr3.schedule.action.acceptDependency')}
          </Button>
        )
        : undefined,
    }))

  const stageStatus = STAGE_STATUS[stage]

  return (
    <div className="py-6">
      {/* The SAME stage anatomy the six KG pages and the scope ledger use —
          position above name, lead below, state on the right. One learned
          header across the whole configuration, which is also exactly the
          composition the approved frame shows. */}
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
          <h1 className="a3-kgp-title" data-page-heading tabIndex={-1} ref={heading}>
            {t('vr3.schedule.heading.stage')}
          </h1>
          <p className="a3-lede">{t('vr3.schedule.lead')}</p>
        </div>
        <div className="a3-kgp-progress">
          <SemanticStatus
            tone={stageStatus.tone}
            label={t(stageStatus.labelKey)}
            reason={stageStatus.reasonKey ? t(stageStatus.reasonKey) : undefined}
          />
        </div>
      </div>

      <ScheduleEditor
        keyDatesTitle={t('vr3.schedule.keyDates')}
        phasesTitle={t('vr3.schedule.phases')}
        keyDates={(
          <>
            <DateField
              label={t('vr3.schedule.field.start')}
              name="schedule-start"
              helperText={t('vr3.schedule.field.startHint')}
              value={s.scheduleStartDate ? localDate(s.scheduleStartDate) : null}
              onCommit={(date) => s.setScheduleStart(date ? localIso(date) : null)}
            />
            <DateField
              label={t('vr3.schedule.field.completion')}
              name="schedule-completion"
              helperText={t('vr3.schedule.field.completionHint')}
              value={s.schedulePlannedCompletion
                ? localDate(s.schedulePlannedCompletion) : null}
              onCommit={(date) =>
                s.setSchedulePlannedCompletion(date ? localIso(date) : null)}
            />
            <div className="a3-sched-field">
              <p className="a3-sched-field-label" id="schedule-total-label">
                {t('vr3.schedule.field.total')}
              </p>
              <p className="a3-sched-field-readout numeric" aria-labelledby="schedule-total-label">
                {totalHalfMonths === null
                  ? t('vr3.schedule.field.totalAbsent')
                  : monthsLabel(totalHalfMonths)}
              </p>
              <p className="a3-sched-field-hint">
                {derivation.completionISO
                  ? t('vr3.schedule.field.totalHint', {
                    date: germanDate(derivation.completionISO),
                  })
                  : t('vr3.schedule.field.totalHintAbsent')}
              </p>
            </div>
            {critical && (
              // The critical path, named and explained. "Building C drives
              // completion" is a fact about the plan; the months are
              // DERIVED from it rather than restated beside it.
              <div className="a3-sched-notice">
                <SemanticStatus
                  tone="attention"
                  as="div"
                  label={t('vr3.schedule.critical.label', {
                    phase: phaseLabel(critical.phase.id),
                  })}
                  reason={criticalLead
                    ? t('vr3.schedule.critical.reason', {
                      months: monthsLabel(criticalLead),
                    })
                    : undefined}
                />
              </div>
            )}
          </>
        )}
        phases={editorPhases}
        notices={notices}
        tableCaption={t('vr3.schedule.tableCaption')}
        tableView={t('vr3.schedule.tableView')}
        columns={{
          phase: t('vr3.schedule.column.phase'),
          unit: t('vr3.schedule.column.unit'),
          start: t('vr3.schedule.column.start'),
          end: t('vr3.schedule.column.end'),
          duration: t('vr3.schedule.column.duration'),
          dependency: t('vr3.schedule.column.dependency'),
        }}
        dependencies={(
          <details
            className="a3-sched-deps-disclosure"
            open={dependenciesOpen}
            onToggle={(event) => setDependenciesOpen(event.currentTarget.open)}
          >
            <summary className="a3-disclosure-button hit-target">
              {t('vr3.schedule.dependencies.open')}
            </summary>
            <div className="a3-sched-deps-content">
              <p className="a3-cap">{t('vr3.schedule.dependencies.explain')}</p>
              {phases.filter((phase) => phase.dependsOn !== null).map((phase) => {
                const leadIssue = issueFor(`schedule-lead-${phase.id}`)
                const dependencyIssue = issueFor(`schedule-dependency-${phase.id}`)
                const candidates = phases.filter((candidate) =>
                  candidate.id !== phase.id && candidate.kind !== 'handover')
                return (
                  <div key={phase.id} className="a3-sched-field">
                    <label
                      className="a3-sched-field-label"
                      htmlFor={`schedule-dependency-${phase.id}`}
                    >
                      {t('vr3.schedule.field.dependency', { phase: phaseLabel(phase.id) })}
                    </label>
                    <select
                      id={`schedule-dependency-${phase.id}`}
                      className="a3-select-field hit-target"
                      value={phase.dependsOn ?? ''}
                      onChange={(event) =>
                        s.setSchedulePhaseDependency(phase.id, event.target.value || null)}
                    >
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {phaseLabel(candidate.id)}
                        </option>
                      ))}
                    </select>
                    {dependencyIssue && (
                      <p className="a3-sched-field-error">
                        <span aria-hidden="true">✗ </span>
                        {issueText(dependencyIssue)}
                      </p>
                    )}
                    <label
                      className="a3-sched-field-label"
                      htmlFor={`schedule-lead-${phase.id}`}
                    >
                      {t('vr3.schedule.field.lead', { phase: phaseLabel(phase.id) })}
                    </label>
                    <span className="a3-sched-field-control">
                      <input
                        id={`schedule-lead-${phase.id}`}
                        className="a3-sched-field-input numeric hit-target"
                        type="text"
                        inputMode="decimal"
                        defaultValue={num(
                          halfMonthsToMonths(phase.leadHalfMonths).toString(),
                          phase.leadHalfMonths % 2 === 0 ? 0 : 1,
                        )}
                        aria-invalid={leadIssue ? true : undefined}
                        onBlur={(event) => {
                          const halves = halfMonthsFromInput(event.target.value)
                          if (halves === null) return
                          s.setSchedulePhaseLead(phase.id, halves)
                        }}
                      />
                      <span className="a3-sched-field-unit">
                        {t('vr3.schedule.unit.months')}
                      </span>
                    </span>
                    {leadIssue && (
                      <p className="a3-sched-field-error">
                        <span aria-hidden="true">✗ </span>
                        {issueText(leadIssue)}
                      </p>
                    )}
                    {phase.dependencyQuestionId && (
                      <Switch
                        label={t('vr3.schedule.field.acceptDependency', {
                          question: phase.dependencyQuestionId,
                        })}
                        checked={s.scheduleDependencyConfirmed.includes(phase.id)}
                        onChange={(next) =>
                          s.setScheduleDependencyConfirmed(phase.id, next)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )}
        actions={(
          <>
            <Button
              variant="primary"
              disabled={!readyToConfirm}
              /* QA-01: the reason comes from an EXHAUSTIVE map, never from a
                 fall-through branch. See `STAGE_BLOCKED_REASON_KEY` below. */
              disabledReason={readyToConfirm
                ? undefined
                : t(STAGE_BLOCKED_REASON_KEY[stage])}
              onClick={() => s.confirmSchedule()}
            >
              {t('vr3.schedule.action.confirm')}
            </Button>
            {stage === 'CONFIRMED' && (
              <Button
                variant="secondary"
                onClick={() =>
                  s.openConfiguratorStepAt(CONFIGURATOR_STEP.FINAL_VALIDATION)}
              >
                {t('vr3.schedule.action.toValidation')}
              </Button>
            )}
          </>
        )}
      />
    </div>
  )
}

const STAGE_STATUS: Readonly<Record<ScheduleStageState, {
  tone: SemanticStatusTone; labelKey: string; reasonKey?: string
}>> = {
  NO_SCHEDULE: { tone: 'unknown', labelKey: 'vr3.schedule.state.none' },
  INCOMPLETE: { tone: 'neutral', labelKey: 'vr3.schedule.state.incomplete' },
  INVALID: { tone: 'error', labelKey: 'vr3.schedule.state.invalid' },
  WARNING: { tone: 'attention', labelKey: 'vr3.schedule.state.warning' },
  READY_TO_CONFIRM: {
    tone: 'attention',
    labelKey: 'vr3.schedule.state.confirmationRequired',
  },
  CONFIRMED: {
    tone: 'ok',
    labelKey: 'vr3.schedule.state.confirmed',
    reasonKey: 'vr3.schedule.state.confirmedReason',
  },
  STALE: {
    tone: 'stale',
    labelKey: 'vr3.schedule.state.stale',
    reasonKey: 'vr3.schedule.state.staleReason',
  },
}

/**
 * WHY THIS IS A TOTAL MAP AND NOT A TERNARY (QA-01).
 *
 * The confirm button used to read
 * `stage === 'WARNING' ? warning : invalid`, so every OTHER disabled stage
 * inherited "Zuerst die benannten Termindaten korrigieren." — and the stage
 * that inherits it most often is `CONFIRMED`, where nothing is wrong at all.
 * QA reproduced it on both fixtures, every time, immediately after a
 * successful confirmation: the product told the user to correct dates it had
 * just accepted.
 *
 * That is the same defect class the review dock already carried a fix for
 * (`vr3.review.dock.alreadyConfirmed`) — a shared control whose reason was
 * written for one branch and silently borrowed by the rest. A ternary cannot
 * be audited for that; a `Record` keyed by the stage union can, because
 * TypeScript refuses to compile a missing key and a NEW stage cannot quietly
 * inherit somebody else's sentence.
 *
 * `READY_TO_CONFIRM` and `STALE` are the two confirmable stages, so their
 * entries are never read — they are present because the map is total, and
 * they name what would be true if they ever were read.
 */
const STAGE_BLOCKED_REASON_KEY: Readonly<Record<ScheduleStageState, string>> = {
  NO_SCHEDULE: 'vr3.schedule.blocked.none',
  INCOMPLETE: 'vr3.schedule.blocked.incomplete',
  INVALID: 'vr3.schedule.blocked.invalid',
  WARNING: 'vr3.schedule.blocked.warning',
  READY_TO_CONFIRM: 'vr3.schedule.blocked.ready',
  CONFIRMED: 'vr3.schedule.blocked.confirmed',
  STALE: 'vr3.schedule.blocked.ready',
}

/** `2027-03-15` → `15.03.2027`. */
function germanDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/**
 * ISO → local `Date`, never through UTC.
 *
 * `new Date('2027-03-15')` is parsed as midnight UTC and can render as the
 * 14th west of Greenwich — the exact hazard the released construction-start
 * field documents, kept in one place here so both date fields inherit it.
 */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function localIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * A German month figure → half months.
 *
 * `12,5` and `12.5` both mean twelve and a half, and anything that is not a
 * whole number of half months is REJECTED rather than rounded: a schedule
 * that silently turned `12,3` into `12,5` would move a delivery date the
 * user did not move. The rejection surfaces as the field keeping its
 * previous valid value, which is the ticket's own error contract.
 */
function halfMonthsFromInput(raw: string): number | null {
  const normalised = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (normalised === '' || !/^\d+(\.\d+)?$/.test(normalised)) return null
  const halves = new Decimal(normalised).mul(2)
  if (!halves.isInteger()) return null
  return halves.toNumber()
}
