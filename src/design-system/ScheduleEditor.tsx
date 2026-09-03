import { useId, useState, type ReactNode } from 'react'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * ScheduleEditor — the schedule as a WORKING STAGE (VR3-04, target T-029;
 * design-system delta: "Schedule/Gantt implementation → REFINE →
 * `ScheduleEditor` with phase rows, dependency warnings and confirmed
 * state").
 *
 * WHAT IT ADDS TO WHAT EXISTED. `ScheduleGantt` (DC-19) is a READ-ONLY
 * projection of a schedule and stays exactly that: it is what the client
 * presentation renders, and it is deliberately `aria-hidden` with a table
 * alternative beside it, because a client reads a picture of an already
 * stated date. What the released product had no capability for was EDITING
 * a schedule: there was one date field and a bar, and no phase, dependency
 * or confirmation existed anywhere (audit F-011).
 *
 * This capability owns that half. Its anatomy is the approved frame's: a
 * KEY DATES panel (start, planned completion, total duration, and the phase
 * that drives the completion) beside a PROJECT PHASES panel where every row
 * carries its own duration field and its own bar.
 *
 * THE BAR IS NOT THE INFORMATION. Every row states its duration and its
 * dates as text and as a form field; the bar is `aria-hidden` decoration of
 * a number already named, and the whole editor is backed by a table
 * alternative (`GANTT-003`'s rule, applied to an editable surface). A
 * timeline no assistive technology can read is a timeline half the users
 * cannot check.
 *
 * IT OWNS NO STATE AND NO ARITHMETIC. Windows, totals, the critical phase
 * and every validation message arrive as props from `state/optionSchedule`,
 * which derives them from the model. A design-system component that
 * computed a completion date would be a second schedule.
 *
 * WHICH CONTROLS IT OWNS, AND WHY.
 *
 * The two key DATES are the canonical `DateField`: a `TT.MM.JJJJ` field with
 * its own parse, its own rejection sentence and its own 44 px control is
 * already a capability of this system, and writing a second one here would
 * be the local competing primitive the governance forbids.
 *
 * A phase DURATION is not. It is a count of HALF MONTHS presented as a
 * German month figure (`12`, `12,5`), and neither existing control can be
 * it: `Stepper` renders its value through `String(value)`, which prints an
 * English decimal point and so cannot show `12,5` at all (rule 7), and
 * `NumericField` requires a `Decimal` plus a provenance chip that a
 * duration the user simply types has nothing to put in. So the duration
 * field is declared HERE, as part of this canonical capability, rather than
 * privately inside the product screen.
 */

export type ScheduleEditorField = {
  id: string
  label: string
  /** The value as the user reads it, already formatted (German decimals). */
  value: string
  /** Instruction text — units, format, what editing it moves. */
  hint?: string
  /** The error for THIS field. The field owns the sentence, once. */
  error?: string
  /**
   * Absent for a derived readout: a value nobody may type is not a control,
   * and a disabled input invites the reader to try.
   */
  onCommit?: (raw: string) => void
  kind: 'duration' | 'readout'
  /** Printed after the control, on the same baseline (rule 31). */
  unit?: string
}

export type ScheduleEditorPhase = {
  id: string
  /** The phase, named. */
  label: string
  /** Which building or the whole project it belongs to. */
  unit: string
  /** The predecessor, in the user's words. */
  dependency: string
  startLabel: string
  endLabel: string
  /** The duration, already formatted with its unit. */
  durationLabel: string
  /** Bar geometry as percentages of the plan. Decoration of the labels. */
  offsetPercent: number
  widthPercent: number
  /** This phase determines the completion date. */
  critical?: boolean
  /** The editable duration. Omit for a phase whose duration is fixed. */
  durationField?: ScheduleEditorField
}

export type ScheduleEditorNotice = {
  id: string
  tone: SemanticStatusTone
  label: string
  reason?: string
  /** The action that resolves it, when one action does. */
  action?: ReactNode
}

export function ScheduleEditor({
  keyDatesTitle, phasesTitle, keyDates, phases, notices, tableCaption,
  tableView, columns, dependencies, actions,
}: {
  keyDatesTitle: string
  phasesTitle: string
  /**
   * The key-dates panel's content: the canonical date fields, the derived
   * total and whatever the plan itself needs to say about its critical
   * path. Composed by the caller, because the DATES are canonical controls
   * this capability must not re-implement.
   */
  keyDates: ReactNode
  phases: readonly ScheduleEditorPhase[]
  /** Errors and the dependency questions still awaiting acceptance. */
  notices?: readonly ScheduleEditorNotice[]
  tableCaption: string
  /** The disclosure's own name, e.g. "Tabellarische Terminansicht". */
  tableView: string
  columns: {
    phase: string; unit: string; start: string; end: string
    duration: string; dependency: string
  }
  /** The dependency editor, disclosed rather than always open. */
  dependencies?: ReactNode
  /** Confirm, and whatever else the stage offers. */
  actions?: ReactNode
}) {
  /**
   * NO STATUS SLOT. The stage's own state belongs to the ONE learned stage
   * header every configuration surface shares (`.a3-kgp-head` — position,
   * name, lead, state on the right), which is also where the approved frame
   * puts it. A second status inside the editor would be the same fact in two
   * places, and the two would eventually disagree.
   */
  return (
    <div className="a3-sched">
      <div className="a3-sched-panels">
        <section className="a3-sched-keydates" aria-label={keyDatesTitle}>
          <h2 className="a3-sched-panel-title">{keyDatesTitle}</h2>
          {keyDates}
        </section>

        <section className="a3-sched-phases" aria-label={phasesTitle}>
          <h2 className="a3-sched-panel-title">{phasesTitle}</h2>
          <ul className="a3-sched-rows">
            {phases.map((phase) => (
              <li key={phase.id} className="a3-sched-row" data-critical={phase.critical ? 'true' : 'false'}>
                <span className="a3-sched-row-label">{phase.label}</span>
                {/* Decoration of a number the row already states in words.
                    Hidden from assistive tech on purpose: the duration, the
                    dates and the dependency are all read from the table
                    below, and read more precisely there. */}
                <span className="a3-sched-track" aria-hidden="true">
                  <span
                    className="a3-sched-bar"
                    style={{
                      left: `${phase.offsetPercent}%`,
                      width: `${phase.widthPercent}%`,
                    }}
                  />
                </span>
                {phase.durationField
                  ? <ScheduleField field={phase.durationField} compact />
                  : <span className="a3-sched-row-duration numeric">{phase.durationLabel}</span>}
              </li>
            ))}
          </ul>

          {/* The equal representation, never a footnote (GANTT-003) — and
              the same disclosure grammar the released `ScheduleGantt`
              already uses for it: named, open by default, collapsible. A
              second grammar for the same job would be a second thing to
              learn. */}
          <details className="a3-sched-tableview" open>
            <summary className="a3-disclosure-button hit-target">{tableView}</summary>
            <div className="a3-tbl-scroll">
            <table className="a3-sched-table">
              <caption className="sr-only">{tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{columns.phase}</th>
                  <th scope="col">{columns.unit}</th>
                  <th scope="col">{columns.start}</th>
                  <th scope="col">{columns.end}</th>
                  <th scope="col">{columns.duration}</th>
                  <th scope="col">{columns.dependency}</th>
                </tr>
              </thead>
              <tbody>
                {phases.map((phase) => (
                  <tr key={phase.id}>
                    <th scope="row">{phase.label}</th>
                    <td>{phase.unit}</td>
                    <td className="numeric">{phase.startLabel}</td>
                    <td className="numeric">{phase.endLabel}</td>
                    <td className="numeric">{phase.durationLabel}</td>
                    <td>{phase.dependency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>

          {dependencies && <div className="a3-sched-deps">{dependencies}</div>}
          {actions && <div className="a3-sched-actions">{actions}</div>}
        </section>
      </div>

      {notices && notices.length > 0 && (
        <ul className="a3-sched-notices">
          {notices.map((notice) => (
            <li key={notice.id} className="a3-sched-notice">
              <SemanticStatus tone={notice.tone} label={notice.label} reason={notice.reason} as="div" />
              {notice.action && <div className="a3-sched-notice-action">{notice.action}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The duration input.
 *
 * COMMIT ON BLUR AND ENTER, never per keystroke: a duration is a value with
 * consequences down a dependency chain, and recomputing the whole plan while
 * somebody is halfway through typing `12,5` would report an invalid `12,`
 * as a defect of the schedule. Escape discards the draft, exactly like the
 * canonical `DateField` and `NumericField` before it — one editing grammar
 * across every field in the product.
 */
function ScheduleDurationInput({
  controlId, value, describedBy, invalid, onCommit,
}: {
  controlId: string
  value: string
  describedBy?: string
  invalid: boolean
  onCommit: (raw: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const raw = draft
    setDraft(null)
    onCommit(raw)
  }
  return (
    <input
      id={controlId}
      className="a3-sched-field-input numeric hit-target"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={draft ?? value}
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { commit(); return }
        if (event.key === 'Escape') setDraft(null)
      }}
    />
  )
}

/**
 * One schedule field.
 *
 * A `readout` is a `<p>`, not a disabled input: a derived total duration is
 * not a control somebody failed to enable, and rendering it as one invites
 * the reader to try to type in it. The error sentence is owned HERE and
 * associated with the control — the row never prints it a second time (the
 * duplicate-message class the building-scope rows recorded).
 */
function ScheduleField({ field, compact }: {
  field: ScheduleEditorField
  compact?: boolean
}) {
  const id = useId()
  const controlId = `${field.id}-${id}`
  const hintId = field.hint ? `${controlId}-hint` : undefined
  const errorId = field.error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  if (field.kind === 'readout' || !field.onCommit) {
    return (
      <div className={compact ? 'a3-sched-field a3-sched-field-compact' : 'a3-sched-field'}>
        <p
          className={compact ? 'sr-only' : 'a3-sched-field-label'}
          id={`${controlId}-label`}
        >
          {field.label}
        </p>
        <p className="a3-sched-field-readout numeric" aria-labelledby={`${controlId}-label`}>
          {field.value}
          {field.unit && <span className="a3-sched-field-unit">{field.unit}</span>}
        </p>
        {field.hint && <p className="a3-sched-field-hint" id={hintId}>{field.hint}</p>}
      </div>
    )
  }

  return (
    <div
      className={compact ? 'a3-sched-field a3-sched-field-compact' : 'a3-sched-field'}
      data-invalid={field.error ? 'true' : 'false'}
    >
      {/* IN A PHASE ROW THE LABEL IS ALREADY THERE. The row names the phase
          to the left of its own field, so a second visible "Dauer Planung"
          above the input is the duplicated label this system exists to
          avoid. It stays in the accessible name, because a field with no
          name is a field only sighted users can use (WCAG 2.5.3). */}
      <label
        className={compact ? 'sr-only' : 'a3-sched-field-label'}
        htmlFor={controlId}
      >
        {field.label}
      </label>
      <span className="a3-sched-field-control">
        <ScheduleDurationInput
          controlId={controlId}
          value={field.value}
          describedBy={describedBy}
          invalid={field.error !== undefined}
          onCommit={field.onCommit}
        />
        {field.unit && <span className="a3-sched-field-unit">{field.unit}</span>}
      </span>
      {field.hint && <p className="a3-sched-field-hint" id={hintId}>{field.hint}</p>}
      {field.error && (
        <p className="a3-sched-field-error" id={errorId}>
          <span aria-hidden="true">✗ </span>{field.error}
        </p>
      )}
    </div>
  )
}
