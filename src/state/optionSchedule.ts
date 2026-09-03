import {
  addHalfMonths,
  halfMonthsBetween,
  halfMonthsToMonths,
  schedulePositionOf,
} from '../engine/schedule'
import type { FixtureProject, FixtureSchedulePhaseKind } from './projectAnalysis'
import type { Decimal } from 'decimal.js'

/**
 * VR3-04 · the Option's SCHEDULE — a deliberate stage, not a chapter.
 *
 * The released product had a schedule surface, and it was honest about what
 * it showed: a Gantt bar read straight out of the fixture plus one editable
 * anchor (`constructionStartDate`). What it had no way to be was a STAGE.
 * There was no phase state, no dependency, and above all no confirmation —
 * so "the schedule is settled" was not a fact the product could hold, and
 * everything downstream had to infer it from configuration completeness
 * instead (audit F-011).
 *
 * This module is pure. The store holds the state; here it is described and
 * derived, so every gate below can be proved by arithmetic without
 * rendering anything — the shape VR3-01 and VR3-02 both used, for the same
 * reason.
 *
 * THREE DELIBERATE BOUNDARIES.
 *
 * 1. **Durations are half months, and the lattice is the engine's.** Both
 *    demonstration projects state a completion date AND a total in months,
 *    and those two facts only agree on a half-month lattice (see the
 *    docblock in `src/engine/schedule.ts`). A schedule that cannot reach its
 *    own stated completion date is a schedule nobody can confirm.
 * 2. **Nothing here invents a duration.** `modelDuration` in the engine
 *    remains the only derivation of a construction period from building
 *    data, and it is not used here: the phase durations are the fixture's
 *    own, and the user may override them. An override is a user's decision,
 *    which is exactly not the same thing as a new formula (D-22).
 * 3. **Confirmation is a FINGERPRINT, never a flag.** Removing a building,
 *    editing a duration or repointing the handover invalidates the
 *    confirmation by arithmetic. No invalidation action can be forgotten,
 *    which is the whole lesson of VR3-02's saved building scope.
 */

/* ─────────────────────────────── the model ────────────────────────────── */

export type SchedulePhaseKind = FixtureSchedulePhaseKind

/**
 * One phase, as the Option holds it.
 *
 * `durationHalfMonths` and `leadHalfMonths` are editable; `dependsOn` is
 * editable for the handover (that is what "Abhängigkeiten bearbeiten" edits)
 * and structural for the rest. `dependencyQuestionId` is inherited from the
 * project's documented open questions and is never invented here.
 */
export type SchedulePhase = {
  id: string
  kind: SchedulePhaseKind
  buildingId: string | null
  durationHalfMonths: number
  dependsOn: string | null
  leadHalfMonths: number
  dependencyQuestionId: string | null
}

/** An authorised override of one phase field, with everything it replaced. */
export type SchedulePhaseEdit = {
  durationHalfMonths?: number
  leadHalfMonths?: number
  dependsOn?: string | null
}

export type ScheduleConfirmation = {
  fingerprint: string
  actor: string
  at: string
}

export type OptionScheduleState = {
  /** The inherited phase model. Empty means the Option has no schedule. */
  schedulePhases: readonly SchedulePhase[]
  /** Per-phase authorised overrides, by phase id. */
  scheduleEdits: Readonly<Record<string, SchedulePhaseEdit>>
  /** The construction start the user chose; the fixture's when untouched. */
  scheduleStartDate: string | null
  /** The completion the user is planning for. Validated, never derived. */
  schedulePlannedCompletion: string | null
  /** Dependency ids whose documented open question the user has confirmed. */
  scheduleDependencyConfirmed: readonly string[]
  scheduleConfirmation: ScheduleConfirmation | null
}

/* ───────────────────────────── inheritance ───────────────────────────── */

export function schedulePhasesFromProject(
  project: FixtureProject | null,
): SchedulePhase[] {
  if (!project) return []
  return project.schedule.phases.map((phase) => ({
    id: phase.id,
    kind: phase.kind,
    buildingId: phase.buildingId,
    durationHalfMonths: phase.durationHalfMonths,
    dependsOn: phase.dependsOn,
    leadHalfMonths: phase.leadHalfMonths,
    dependencyQuestionId: phase.dependencyQuestionId,
  }))
}

/* ─────────────────────────────── reading ─────────────────────────────── */

/** The effective phase: the authorised override where one exists. */
export function effectivePhase(
  state: Pick<OptionScheduleState, 'scheduleEdits'>,
  phase: SchedulePhase,
): SchedulePhase {
  const edit = state.scheduleEdits[phase.id]
  if (!edit) return phase
  return {
    ...phase,
    durationHalfMonths: edit.durationHalfMonths ?? phase.durationHalfMonths,
    leadHalfMonths: edit.leadHalfMonths ?? phase.leadHalfMonths,
    dependsOn: edit.dependsOn !== undefined ? edit.dependsOn : phase.dependsOn,
  }
}

/**
 * The phases this Option actually plans, in model order.
 *
 * A building outside the Option's saved scope has no execution phase: the
 * Option prices the buildings it covers, and a schedule that still planned
 * the others would contradict its own commercial base. Project-level phases
 * (planning, tender, handover) always survive.
 */
export function activeSchedulePhases(
  state: Pick<OptionScheduleState, 'schedulePhases' | 'scheduleEdits'>,
  includedBuildingIds: readonly string[],
): SchedulePhase[] {
  return state.schedulePhases
    .filter((phase) => phase.buildingId === null
      || includedBuildingIds.includes(phase.buildingId))
    .map((phase) => effectivePhase(state, phase))
}

export function scheduleStart(
  state: Pick<OptionScheduleState, 'scheduleStartDate'>,
): string | null {
  return state.scheduleStartDate
}

/* ────────────────────────── derived windows ─────────────────────────── */

export type SchedulePhaseWindow = {
  phase: SchedulePhase
  /** Half months from the construction start. */
  startHalfMonths: number
  endHalfMonths: number
  startISO: string
  endISO: string
  durationMonths: Decimal
}

/**
 * Resolve every phase's window from the dependency chain.
 *
 * `start = predecessorEnd − lead`, so a lead of `0` means strictly
 * afterwards and a positive lead is a DECLARED OVERLAP — an ordinary
 * construction fact (tendering runs into the last of the design work), not
 * an error. A phase with no predecessor starts at the construction start.
 *
 * Resolution is iterative rather than recursive so an unresolvable
 * dependency (a missing predecessor, or a cycle) simply leaves that phase
 * unresolved instead of overflowing the stack. `scheduleIssues` below is
 * what turns "unresolved" into a sentence the user can act on.
 */
export function schedulePhaseWindows(
  phases: readonly SchedulePhase[],
  startISO: string,
): SchedulePhaseWindow[] {
  const resolved = new Map<string, SchedulePhaseWindow>()
  const byId = new Map(phases.map((phase) => [phase.id, phase]))
  // At most one phase can be resolved per pass in the worst case, so the
  // chain is fully walked in `phases.length` passes.
  for (let pass = 0; pass < phases.length; pass += 1) {
    let progressed = false
    for (const phase of phases) {
      if (resolved.has(phase.id)) continue
      let startHalfMonths: number
      if (phase.dependsOn === null) {
        startHalfMonths = 0
      } else {
        const predecessor = resolved.get(phase.dependsOn)
        if (!predecessor) {
          // Either not resolved yet, or genuinely absent. A later pass
          // decides which; an absent one never resolves.
          if (!byId.has(phase.dependsOn)) continue
          continue
        }
        startHalfMonths = predecessor.endHalfMonths - phase.leadHalfMonths
      }
      const endHalfMonths = startHalfMonths + phase.durationHalfMonths
      resolved.set(phase.id, {
        phase,
        startHalfMonths,
        endHalfMonths,
        startISO: addHalfMonths(startISO, startHalfMonths),
        endISO: addHalfMonths(startISO, endHalfMonths),
        durationMonths: halfMonthsToMonths(phase.durationHalfMonths),
      })
      progressed = true
    }
    if (!progressed) break
  }
  return phases
    .map((phase) => resolved.get(phase.id))
    .filter((window): window is SchedulePhaseWindow => window !== undefined)
}

export type ScheduleDerivation = {
  startISO: string | null
  windows: SchedulePhaseWindow[]
  /** Phases the dependency chain could not place. */
  unresolvedPhaseIds: readonly string[]
  completionISO: string | null
  totalHalfMonths: number | null
  totalMonths: Decimal | null
  /** The phase whose end IS the completion — the critical path's last link. */
  criticalPhaseId: string | null
  /** Half months by which the critical phase outlasts the next-latest one. */
  criticalLeadHalfMonths: number | null
}

export function scheduleDerivation(
  state: Pick<OptionScheduleState,
    'schedulePhases' | 'scheduleEdits' | 'scheduleStartDate'>,
  includedBuildingIds: readonly string[],
): ScheduleDerivation {
  const phases = activeSchedulePhases(state, includedBuildingIds)
  const startISO = state.scheduleStartDate
  if (!startISO || schedulePositionOf(startISO) === null || phases.length === 0) {
    return {
      startISO,
      windows: [],
      unresolvedPhaseIds: phases.map((phase) => phase.id),
      completionISO: null,
      totalHalfMonths: null,
      totalMonths: null,
      criticalPhaseId: null,
      criticalLeadHalfMonths: null,
    }
  }
  const windows = schedulePhaseWindows(phases, startISO)
  const placed = new Set(windows.map((window) => window.phase.id))
  const unresolvedPhaseIds = phases
    .map((phase) => phase.id)
    .filter((id) => !placed.has(id))
  if (windows.length === 0) {
    return {
      startISO,
      windows,
      unresolvedPhaseIds,
      completionISO: null,
      totalHalfMonths: null,
      totalMonths: null,
      criticalPhaseId: null,
      criticalLeadHalfMonths: null,
    }
  }
  const ends = [...windows].sort((a, b) => b.endHalfMonths - a.endHalfMonths)
  const last = ends[0]!
  // A TIE is not a lead. When two phases end on the same day, no single one
  // drives the completion, and `criticalLeadHalfMonths: 0` is how that is
  // said — reaching past the tie to the next distinct end would report a
  // lead the plan does not have.
  const tied = ends.filter((window) => window.endHalfMonths === last.endHalfMonths)
  const runnerUp = ends.find((window) => window.endHalfMonths < last.endHalfMonths)
  return {
    startISO,
    windows,
    unresolvedPhaseIds,
    completionISO: last.endISO,
    totalHalfMonths: last.endHalfMonths,
    totalMonths: halfMonthsToMonths(last.endHalfMonths),
    criticalPhaseId: last.phase.id,
    criticalLeadHalfMonths: tied.length > 1
      ? 0
      : runnerUp
        ? last.endHalfMonths - runnerUp.endHalfMonths
        : null,
  }
}

/**
 * The phase that DRIVES the completion, when a single one does.
 *
 * NOT the phase that ends last. On both fixtures that is the handover, and
 * "Übergabe bestimmt die Fertigstellung" is a tautology: the handover ends
 * last because it is the handover. What a reader needs is the answer the
 * approved frame gives — "Building C drives completion" — which is the
 * EXECUTION the terminal phases are waiting for.
 *
 * So the driver is the latest-ending execution, and its lead is measured
 * against the next-latest execution: that difference is what would actually
 * move the completion date if the building were faster. `null` when two
 * executions tie, because then no single one drives anything and claiming
 * one did would be a fiction; `null` too when the plan has no execution at
 * all, which is a plan for no buildings.
 */
export function scheduleCriticalPhase(
  derivation: ScheduleDerivation,
): SchedulePhaseWindow | null {
  const executions = derivation.windows
    .filter((window) => window.phase.kind === 'execution')
  if (executions.length === 0) return null
  const latest = executions
    .reduce((a, b) => (b.endHalfMonths > a.endHalfMonths ? b : a))
  const tied = executions
    .filter((window) => window.endHalfMonths === latest.endHalfMonths)
  if (tied.length > 1) return null
  return latest
}

/**
 * By how much the driving execution outlasts the next one, in half months.
 *
 * `null` when there is no driver, and `null` when it is the only execution —
 * a single building always drives its own completion, and there is no lead
 * to state.
 */
export function scheduleCriticalLeadHalfMonths(
  derivation: ScheduleDerivation,
): number | null {
  const critical = scheduleCriticalPhase(derivation)
  if (!critical) return null
  const others = derivation.windows
    .filter((window) => window.phase.kind === 'execution'
      && window.phase.id !== critical.phase.id)
  if (others.length === 0) return null
  const runnerUp = others.reduce((a, b) => (b.endHalfMonths > a.endHalfMonths ? b : a))
  return critical.endHalfMonths - runnerUp.endHalfMonths
}

/* ───────────────────────────── validation ───────────────────────────── */

export type ScheduleIssueSeverity = 'error' | 'warning'

/**
 * One named schedule defect. `fieldId` is what the surface focuses, and it
 * is what makes "the schedule is invalid" into "this field is invalid".
 */
export type ScheduleIssue = {
  id: string
  severity: ScheduleIssueSeverity
  /** The dictionary key of the sentence. Never a rule name. */
  messageKey: string
  values?: Readonly<Record<string, string | number>>
  /** The control that owns it, for focus and for the return route. */
  fieldId: string
  phaseId: string | null
  /**
   * A duration this issue's sentence needs, in HALF MONTHS.
   *
   * Raw rather than formatted, because the sentence's `{months}` has to be
   * both localised AND correctly inflected (`0,5 Monate`, `1 Monat`), and
   * this module has no locale. The surface formats it with the same helper
   * every other duration on the page uses, so one overshoot cannot print
   * differently from one phase duration.
   */
  durationHalfMonths?: number
}

export const SCHEDULE_MIN_DURATION_HALF_MONTHS = 1
export const SCHEDULE_MAX_DURATION_HALF_MONTHS = 120

export function scheduleIssues(
  state: Pick<OptionScheduleState, 'schedulePhases' | 'scheduleEdits'
    | 'scheduleStartDate' | 'schedulePlannedCompletion'
    | 'scheduleDependencyConfirmed'>,
  includedBuildingIds: readonly string[],
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = []
  const phases = activeSchedulePhases(state, includedBuildingIds)
  if (phases.length === 0) return issues

  if (!state.scheduleStartDate) {
    issues.push({
      id: 'startMissing',
      severity: 'error',
      messageKey: 'vr3.schedule.issue.startMissing',
      fieldId: 'schedule-start',
      phaseId: null,
    })
  } else if (schedulePositionOf(state.scheduleStartDate) === null) {
    issues.push({
      id: 'startOffLattice',
      severity: 'error',
      messageKey: 'vr3.schedule.issue.startOffLattice',
      fieldId: 'schedule-start',
      phaseId: null,
    })
  }

  for (const phase of phases) {
    if (!Number.isInteger(phase.durationHalfMonths)
      || phase.durationHalfMonths < SCHEDULE_MIN_DURATION_HALF_MONTHS
      || phase.durationHalfMonths > SCHEDULE_MAX_DURATION_HALF_MONTHS) {
      issues.push({
        id: `duration:${phase.id}`,
        severity: 'error',
        messageKey: 'vr3.schedule.issue.duration',
        fieldId: `schedule-duration-${phase.id}`,
        phaseId: phase.id,
      })
    }
    if (phase.dependsOn !== null) {
      const predecessor = phases.find((other) => other.id === phase.dependsOn)
      if (!predecessor) {
        issues.push({
          id: `dependencyMissing:${phase.id}`,
          severity: 'error',
          messageKey: 'vr3.schedule.issue.dependencyMissing',
          fieldId: `schedule-dependency-${phase.id}`,
          phaseId: phase.id,
        })
      } else if (phase.leadHalfMonths < 0
        || (phase.leadHalfMonths > 0
          && phase.leadHalfMonths >= predecessor.durationHalfMonths)) {
        // A lead as long as the predecessor would move this phase to (or
        // before) the predecessor's own start: the dependency would no
        // longer describe an order at all.
        issues.push({
          id: `lead:${phase.id}`,
          severity: 'error',
          messageKey: 'vr3.schedule.issue.lead',
          fieldId: `schedule-lead-${phase.id}`,
          phaseId: phase.id,
        })
      }
    }
  }

  const derivation = scheduleDerivation(state, includedBuildingIds)
  for (const id of derivation.unresolvedPhaseIds) {
    issues.push({
      id: `unresolved:${id}`,
      severity: 'error',
      messageKey: 'vr3.schedule.issue.unresolved',
      fieldId: `schedule-dependency-${id}`,
      phaseId: id,
    })
  }

  if (derivation.windows.some((window) => window.startHalfMonths < 0)) {
    issues.push({
      id: 'beforeStart',
      severity: 'error',
      messageKey: 'vr3.schedule.issue.beforeStart',
      fieldId: 'schedule-start',
      phaseId: null,
    })
  }

  if (derivation.completionISO
    && state.schedulePlannedCompletion
    && schedulePositionOf(state.schedulePlannedCompletion) !== null) {
    const overshoot = halfMonthsBetween(
      state.schedulePlannedCompletion, derivation.completionISO,
    )
    if (overshoot > 0) {
      issues.push({
        id: 'completionOvershoot',
        severity: 'error',
        messageKey: 'vr3.schedule.issue.completionOvershoot',
        durationHalfMonths: overshoot,
        fieldId: 'schedule-completion',
        phaseId: null,
      })
    }
  } else if (state.schedulePlannedCompletion
    && schedulePositionOf(state.schedulePlannedCompletion) === null) {
    issues.push({
      id: 'completionOffLattice',
      severity: 'error',
      messageKey: 'vr3.schedule.issue.completionOffLattice',
      fieldId: 'schedule-completion',
      phaseId: null,
    })
  }

  // The documented dependencies. A phase whose dependency carries an open
  // project question stays a WARNING until the user confirms it explicitly:
  // the question is real, the product did not invent it, and answering it
  // is not something a default may do on the user's behalf.
  for (const phase of phases) {
    if (!phase.dependencyQuestionId) continue
    if (state.scheduleDependencyConfirmed.includes(phase.id)) continue
    issues.push({
      id: `dependencyUnconfirmed:${phase.id}`,
      severity: 'warning',
      messageKey: 'vr3.schedule.issue.dependencyUnconfirmed',
      values: { question: phase.dependencyQuestionId },
      fieldId: `schedule-dependency-confirm-${phase.id}`,
      phaseId: phase.id,
    })
  }

  return issues
}

/* ──────────────────────────── the fingerprint ───────────────────────── */

/**
 * Every material value of the schedule, in one string.
 *
 * Material means: what a reader of the confirmed schedule was shown. The
 * included buildings are part of it, because dropping a building changes
 * which phases exist; the dependency confirmations are part of it, because
 * un-confirming one is a change of the same order as moving a date.
 */
export function scheduleFingerprint(
  state: Pick<OptionScheduleState, 'schedulePhases' | 'scheduleEdits'
    | 'scheduleStartDate' | 'schedulePlannedCompletion'
    | 'scheduleDependencyConfirmed'>,
  includedBuildingIds: readonly string[],
): string {
  const phases = activeSchedulePhases(state, includedBuildingIds)
    .map((phase) => [
      phase.id,
      phase.durationHalfMonths,
      phase.dependsOn ?? '-',
      phase.leadHalfMonths,
      state.scheduleDependencyConfirmed.includes(phase.id) ? 'confirmed' : 'open',
    ].join(':'))
  return [
    `start=${state.scheduleStartDate ?? '-'}`,
    `completion=${state.schedulePlannedCompletion ?? '-'}`,
    `buildings=${[...includedBuildingIds].sort().join(',')}`,
    `phases=${phases.join('|')}`,
  ].join('#')
}

/* ─────────────────────────────── the stage ──────────────────────────── */

export type ScheduleStage =
  | 'NO_SCHEDULE'
  | 'INCOMPLETE'
  | 'INVALID'
  | 'WARNING'
  | 'READY_TO_CONFIRM'
  | 'CONFIRMED'
  | 'STALE'

export function scheduleErrors(
  state: Parameters<typeof scheduleIssues>[0],
  includedBuildingIds: readonly string[],
): ScheduleIssue[] {
  return scheduleIssues(state, includedBuildingIds)
    .filter((issue) => issue.severity === 'error')
}

export function scheduleWarnings(
  state: Parameters<typeof scheduleIssues>[0],
  includedBuildingIds: readonly string[],
): ScheduleIssue[] {
  return scheduleIssues(state, includedBuildingIds)
    .filter((issue) => issue.severity === 'warning')
}

/**
 * The schedule stage.
 *
 * The order of these tests is the contract, not an implementation detail.
 *
 * An OUTSTANDING WARNING outranks a stale confirmation, and outstanding
 * warnings block confirmation. That is what "warning acceptance" means here:
 * the complex fixture's single handover follows building C, and whether the
 * client wants one handover or several is a documented open question
 * (`B-Q-08`) the product must not answer by default. Accepting it is one
 * explicit action, and until it is taken the schedule is not confirmable —
 * which is different from invalid, and the surface says so.
 *
 * `CONFIRMED` requires the confirmation's fingerprint still to describe what
 * is on screen; `STALE` is a confirmation that no longer does. Both are
 * different from never having confirmed, and the surface says which.
 */
export function optionScheduleStage(
  state: Pick<OptionScheduleState, 'schedulePhases' | 'scheduleEdits'
    | 'scheduleStartDate' | 'schedulePlannedCompletion'
    | 'scheduleDependencyConfirmed' | 'scheduleConfirmation'>,
  includedBuildingIds: readonly string[],
): ScheduleStage {
  if (activeSchedulePhases(state, includedBuildingIds).length === 0) return 'NO_SCHEDULE'
  if (scheduleErrors(state, includedBuildingIds).length > 0) {
    return state.scheduleStartDate === null ? 'INCOMPLETE' : 'INVALID'
  }
  if (scheduleWarnings(state, includedBuildingIds).length > 0) return 'WARNING'
  const confirmation = state.scheduleConfirmation
  if (!confirmation) return 'READY_TO_CONFIRM'
  return confirmation.fingerprint === scheduleFingerprint(state, includedBuildingIds)
    ? 'CONFIRMED'
    : 'STALE'
}

/**
 * Can the schedule be confirmed right now?
 *
 * Errors block, and so do unaccepted warnings — see the stage docblock. A
 * STALE confirmation is confirmable again: that is the recovery, not a
 * second kind of block.
 */
export function scheduleReadyToConfirm(
  state: Parameters<typeof optionScheduleStage>[0],
  includedBuildingIds: readonly string[],
): boolean {
  const stage = optionScheduleStage(state, includedBuildingIds)
  return stage === 'READY_TO_CONFIRM' || stage === 'STALE'
}

/**
 * The gate Final Validation sits behind: a schedule confirmed and still
 * describing itself. Warnings that WERE accepted at confirmation time stay
 * accepted — the fingerprint carries them, so re-opening one re-opens the
 * gate too.
 */
export function scheduleConfirmed(
  state: Parameters<typeof optionScheduleStage>[0],
  includedBuildingIds: readonly string[],
): boolean {
  return optionScheduleStage(state, includedBuildingIds) === 'CONFIRMED'
}
