import { describe, expect, it } from 'vitest'
import fixture from '../../fixtures/vr3-demo-projects.json'
import {
  addHalfMonths,
  halfMonthsBetween,
  halfMonthsToMonths,
  schedulePositionOf,
} from '../../engine/schedule'
import {
  optionScheduleStage,
  scheduleConfirmed,
  scheduleCriticalLeadHalfMonths,
  scheduleCriticalPhase,
  scheduleDerivation,
  scheduleErrors,
  scheduleFingerprint,
  scheduleIssues,
  schedulePhasesFromProject,
  scheduleReadyToConfirm,
  scheduleWarnings,
  type OptionScheduleState,
} from '../optionSchedule'
import type { FixtureProject } from '../projectAnalysis'

/**
 * VR3-04 — the schedule's arithmetic, proved against its own fixture.
 *
 * Project rule 32: a number that does not reconcile with its own fixture is
 * a release blocker. The schedule has exactly that shape — the fixture
 * states a start, a completion and a total in months, and the phase model
 * has to reach all three from the phases alone. This file is where that is
 * checked, so no surface has to be trusted to have added up correctly.
 */

const PROJECTS = (fixture as unknown as { projects: FixtureProject[] }).projects
const HAPPY = PROJECTS.find((p) => p.id === 'DEMO-HAPPY-01')!
const COMPLEX = PROJECTS.find((p) => p.id === 'DEMO-COMPLEX-01')!

function stateFor(project: FixtureProject): OptionScheduleState {
  return {
    schedulePhases: schedulePhasesFromProject(project),
    scheduleEdits: {},
    scheduleStartDate: project.schedule.constructionStartDate,
    schedulePlannedCompletion: project.schedule.plannedCompletionDate,
    scheduleDependencyConfirmed: [],
    scheduleConfirmation: null,
  }
}

const HAPPY_BUILDINGS = HAPPY.buildings.map((b) => b.id)
const COMPLEX_BUILDINGS = COMPLEX.buildings.map((b) => b.id)

describe('the half-month lattice', () => {
  it('places the 15th and the month end, and nothing else', () => {
    expect(schedulePositionOf('2027-03-15')).toBe('mid')
    expect(schedulePositionOf('2028-07-31')).toBe('end')
    expect(schedulePositionOf('2028-09-30')).toBe('end')
    expect(schedulePositionOf('2028-02-29')).toBe('end')
    expect(schedulePositionOf('2027-02-28')).toBe('end')
    expect(schedulePositionOf('2027-03-16')).toBeNull()
    expect(schedulePositionOf('2027-03-01')).toBeNull()
  })

  it('reaches both fixture completion dates exactly', () => {
    // The reason the lattice exists: 16,5 and 18,5 months from 15.03.2027
    // are 31.07.2028 and 30.09.2028, and neither day-arithmetic nor
    // "calendar months plus 15 days" reproduces either.
    expect(addHalfMonths('2027-03-15', 33)).toBe('2028-07-31')
    expect(addHalfMonths('2027-03-15', 37)).toBe('2028-09-30')
  })

  it('is reversible and symmetric', () => {
    expect(halfMonthsBetween('2027-03-15', '2028-07-31')).toBe(33)
    expect(halfMonthsBetween('2028-09-30', '2027-03-15')).toBe(-37)
    expect(addHalfMonths(addHalfMonths('2027-03-15', 19), -19)).toBe('2027-03-15')
  })

  it('halves half months once, in one place', () => {
    expect(halfMonthsToMonths(33).toString()).toBe('16.5')
    expect(halfMonthsToMonths(24).toString()).toBe('12')
  })

  it('refuses an off-lattice date instead of snapping it', () => {
    expect(() => addHalfMonths('2027-03-16', 1)).toThrow()
  })
})

describe('the clean fixture · Wohnhof Lindenhain', () => {
  it('reconciles start, phases and completion', () => {
    const state = stateFor(HAPPY)
    const derived = scheduleDerivation(state, HAPPY_BUILDINGS)
    expect(derived.completionISO).toBe(HAPPY.schedule.plannedCompletionDate)
    expect(derived.totalHalfMonths).toBe(HAPPY.schedule.totalHalfMonths)
    expect(derived.totalMonths?.toString()).toBe('16.5')
    expect(derived.unresolvedPhaseIds).toEqual([])
  })

  it('sums its phase durations to its own total, with no overlap', () => {
    const state = stateFor(HAPPY)
    const derived = scheduleDerivation(state, HAPPY_BUILDINGS)
    const sum = derived.windows
      .reduce((total, w) => total + w.phase.durationHalfMonths, 0)
    expect(sum).toBe(HAPPY.schedule.totalHalfMonths)
    expect(derived.windows.every((w) => w.phase.leadHalfMonths === 0)).toBe(true)
  })

  it('has no open question, so it is confirmable straight away', () => {
    const state = stateFor(HAPPY)
    expect(scheduleIssues(state, HAPPY_BUILDINGS)).toEqual([])
    expect(optionScheduleStage(state, HAPPY_BUILDINGS)).toBe('READY_TO_CONFIRM')
    expect(scheduleReadyToConfirm(state, HAPPY_BUILDINGS)).toBe(true)
  })
})

describe('the complex fixture · Quartier Am Güterbogen', () => {
  it('reconciles start, phases and completion', () => {
    const state = stateFor(COMPLEX)
    const derived = scheduleDerivation(state, COMPLEX_BUILDINGS)
    expect(derived.completionISO).toBe('2028-09-30')
    expect(derived.totalHalfMonths).toBe(37)
    expect(derived.totalMonths?.toString()).toBe('18.5')
    expect(derived.unresolvedPhaseIds).toEqual([])
  })

  it('carries the approved target phase durations', () => {
    // T-029: planning 5, tender/mobilisation 2, A 12, B 13, C 14, handover
    // 1,5 months. Read off the model, not restated from the frame.
    const state = stateFor(COMPLEX)
    const derived = scheduleDerivation(state, COMPLEX_BUILDINGS)
    expect(derived.windows.map((w) => w.durationMonths.toString()))
      .toEqual(['5', '2', '12', '13', '14', '1.5'])
  })

  it('names building C as the phase that drives completion', () => {
    const state = stateFor(COMPLEX)
    const derived = scheduleDerivation(state, COMPLEX_BUILDINGS)
    // The handover ends last by construction; the phase that DRIVES the
    // completion is the execution the handover waits for.
    const handover = derived.windows.find((w) => w.phase.kind === 'handover')!
    expect(handover.phase.dependsOn).toBe('execution:B-BLDG-C')
    const executions = derived.windows.filter((w) => w.phase.kind === 'execution')
    const latest = executions.reduce((a, b) => (b.endHalfMonths > a.endHalfMonths ? b : a))
    expect(latest.phase.buildingId).toBe('B-BLDG-C')
    const runnerUp = executions
      .filter((w) => w.endHalfMonths < latest.endHalfMonths)
      .reduce((a, b) => (b.endHalfMonths > a.endHalfMonths ? b : a))
    // Six weeks — the lead the approved frame names, derived rather than
    // restated: three half months.
    expect(latest.endHalfMonths - runnerUp.endHalfMonths).toBe(3)
  })

  it('is a WARNING until the documented handover question is accepted', () => {
    const state = stateFor(COMPLEX)
    expect(scheduleErrors(state, COMPLEX_BUILDINGS)).toEqual([])
    const warnings = scheduleWarnings(state, COMPLEX_BUILDINGS)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.values?.question).toBe('B-Q-08')
    expect(warnings[0]!.phaseId).toBe('handover')
    expect(optionScheduleStage(state, COMPLEX_BUILDINGS)).toBe('WARNING')
    // An unaccepted warning is not confirmable. That is the acceptance.
    expect(scheduleReadyToConfirm(state, COMPLEX_BUILDINGS)).toBe(false)

    const accepted = { ...state, scheduleDependencyConfirmed: ['handover'] }
    expect(optionScheduleStage(accepted, COMPLEX_BUILDINGS)).toBe('READY_TO_CONFIRM')
    expect(scheduleReadyToConfirm(accepted, COMPLEX_BUILDINGS)).toBe(true)
  })

  it('drops an excluded building’s execution phase and reports the dangling dependency', () => {
    const state = stateFor(COMPLEX)
    const withoutC = ['B-BLDG-A', 'B-BLDG-B']
    const derived = scheduleDerivation(state, withoutC)
    expect(derived.windows.map((w) => w.phase.id))
      .not.toContain('execution:B-BLDG-C')
    // The handover still points at C. That is an error the surface names on
    // the dependency field — never a silent re-pointing of the plan.
    const errors = scheduleErrors(state, withoutC)
    expect(errors.map((issue) => issue.id))
      .toContain('dependencyMissing:handover')
    expect(errors[0]!.fieldId).toBe('schedule-dependency-handover')
    expect(optionScheduleStage(state, withoutC)).toBe('INVALID')
  })
})

describe('validation and confirmation', () => {
  it('names the field of an impossible duration', () => {
    const state = stateFor(HAPPY)
    const edited = {
      ...state,
      scheduleEdits: { tender: { durationHalfMonths: 0 } },
    }
    const errors = scheduleErrors(edited, HAPPY_BUILDINGS)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.fieldId).toBe('schedule-duration-tender')
    expect(errors[0]!.messageKey).toBe('vr3.schedule.issue.duration')
    expect(optionScheduleStage(edited, HAPPY_BUILDINGS)).toBe('INVALID')
  })

  it('rejects a lead that would swallow its predecessor', () => {
    const state = stateFor(COMPLEX)
    const edited = { ...state, scheduleEdits: { tender: { leadHalfMonths: 10 } } }
    const errors = scheduleErrors(edited, COMPLEX_BUILDINGS)
    expect(errors.map((issue) => issue.fieldId)).toContain('schedule-lead-tender')
  })

  it('reports the overshoot when the plan ends after the planned completion', () => {
    const state = stateFor(COMPLEX)
    const edited = {
      ...state,
      scheduleEdits: { 'execution:B-BLDG-C': { durationHalfMonths: 32 } },
    }
    const errors = scheduleErrors(edited, COMPLEX_BUILDINGS)
    const overshoot = errors.find((issue) => issue.id === 'completionOvershoot')!
    expect(overshoot.fieldId).toBe('schedule-completion')
    // HALF MONTHS, raw: the surface formats and inflects them, because this
    // module has no locale and `0,5 Monate` / `1 Monat` is a locale question.
    expect(overshoot.durationHalfMonths).toBe(4)
  })

  it('is INCOMPLETE, not INVALID, while the start is missing', () => {
    const state = { ...stateFor(HAPPY), scheduleStartDate: null }
    expect(optionScheduleStage(state, HAPPY_BUILDINGS)).toBe('INCOMPLETE')
  })

  it('goes STALE when a confirmed schedule changes, and is confirmable again', () => {
    const base = stateFor(HAPPY)
    const confirmed: OptionScheduleState = {
      ...base,
      scheduleConfirmation: {
        fingerprint: scheduleFingerprint(base, HAPPY_BUILDINGS),
        actor: 'sales-user',
        at: '2026-09-03T10:00:00.000Z',
      },
    }
    expect(scheduleConfirmed(confirmed, HAPPY_BUILDINGS)).toBe(true)
    expect(optionScheduleStage(confirmed, HAPPY_BUILDINGS)).toBe('CONFIRMED')

    // The store's own action shifts the planned completion with the start
    // (the released anchor-shift semantics: "die Bauzeit selbst bleibt
    // gleich"), so this is what a start move actually looks like.
    const moved = {
      ...confirmed,
      scheduleStartDate: '2027-04-15',
      schedulePlannedCompletion: '2028-08-31',
    }
    expect(optionScheduleStage(moved, HAPPY_BUILDINGS)).toBe('STALE')
    expect(scheduleConfirmed(moved, HAPPY_BUILDINGS)).toBe(false)
    expect(scheduleReadyToConfirm(moved, HAPPY_BUILDINGS)).toBe(true)
  })

  it('invalidates the confirmation when a building leaves the scope', () => {
    // The lesson of VR3-02's saved scope, applied one stage later: no
    // invalidation action can be forgotten, because the fingerprint carries
    // the building set.
    const base = stateFor(COMPLEX)
    const accepted = { ...base, scheduleDependencyConfirmed: ['handover'] }
    const fingerprint = scheduleFingerprint(accepted, COMPLEX_BUILDINGS)
    expect(scheduleFingerprint(accepted, ['B-BLDG-A', 'B-BLDG-B', 'B-BLDG-C']))
      .toBe(fingerprint)
    expect(scheduleFingerprint(accepted, ['B-BLDG-A', 'B-BLDG-C']))
      .not.toBe(fingerprint)
  })

  it('names the driving EXECUTION, not the phase that merely ends last', () => {
    // On both fixtures the handover ends last, and "Übergabe bestimmt die
    // Fertigstellung" is a tautology. What drives the date is the execution
    // the terminal phases wait for — the answer the approved frame gives
    // ("Building C drives completion").
    const derived = scheduleDerivation(stateFor(HAPPY), HAPPY_BUILDINGS)
    expect(derived.criticalPhaseId).toBe('handover')
    expect(scheduleCriticalPhase(derived)?.phase.id).toBe('execution:A-BLDG-01')
    // One building drives its own completion and there is no lead to state.
    expect(scheduleCriticalLeadHalfMonths(derived)).toBeNull()
  })

  it('names building C on the complex fixture, six weeks ahead of the next', () => {
    const derived = scheduleDerivation(stateFor(COMPLEX), COMPLEX_BUILDINGS)
    expect(scheduleCriticalPhase(derived)?.phase.buildingId).toBe('B-BLDG-C')
    expect(scheduleCriticalLeadHalfMonths(derived)).toBe(3)
  })

  it('has no driving execution when two executions tie for last', () => {
    const tie = scheduleDerivation({
      ...stateFor(COMPLEX),
      // B is lengthened to end exactly where C does.
      scheduleEdits: { 'execution:B-BLDG-B': { durationHalfMonths: 29 } },
    }, COMPLEX_BUILDINGS)
    expect(scheduleCriticalPhase(tie)).toBeNull()
    expect(scheduleCriticalLeadHalfMonths(tie)).toBeNull()
  })
})
