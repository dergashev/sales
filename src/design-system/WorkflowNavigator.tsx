import { useRef, useState, type KeyboardEvent } from 'react'
import { useT } from '../i18n'

/**
 * WorkflowNavigator — the canonical HIERARCHICAL journey navigation
 * (accepted 2026-09-05 Project Documents workspace UX audit, "EVOLVE
 * CANONICAL COMPONENT: evolve WorkflowStepper into a hierarchical
 * WorkflowNavigator").
 *
 * `WorkflowStepper` is a FLAT list of stages, and that is what it stays for
 * the Option workspace: one journey, one row per stage. It cannot express
 * the thing this capability exists for — a journey whose later stages are
 * GROUPS whose members only become relevant inside them. Rendering thirteen
 * first-level rows of which nine were locked did not orient anyone: it
 * published the whole Product model, with a repeated reason for every stage
 * the user could not have reached yet, before the current task had been
 * done once.
 *
 * The capability therefore owns three things the flat stepper does not:
 *
 * 1. **Grouping.** A stage may declare nested `steps`. Six top-level stages
 *    replace thirteen first-level destinations without changing a single
 *    route: grouping is PRESENTATION, and the caller keeps every existing
 *    destination, prerequisite and gate exactly as it was.
 * 2. **Progressive disclosure, as a rule rather than a flag.** Nested steps
 *    render for the CURRENT stage and for no other. There is no
 *    `showChildren` boolean to pass — a boolean would let a caller publish
 *    the whole tree again, which is the defect this replaces.
 * 3. **Neutral futures.** `upcoming` is orientation, not failure: it shows
 *    its position and the word for its state and nothing else. `locked`
 *    exists for the rare stage whose prerequisite is genuinely useful to
 *    name, and it always names it — a stage that is merely grey states that
 *    something is unavailable and nothing else (rule 12).
 *
 * Accessibility: a real `<nav>` with a required accessible name, `<ol>`
 * semantics for the sequence, `aria-current="step"` on the one current
 * stage, roving tabindex across the top-level stages (arrow keys move,
 * Tab leaves), every glyph `aria-hidden` with the state carried in words
 * (rule 8 — never colour or shape alone), and 44px hit targets.
 */

export type WorkflowStageState = 'current' | 'done' | 'upcoming' | 'locked'

export type WorkflowSubStep = {
  id: string
  label: string
  state: WorkflowStageState
  onSelect?: () => void
  /** Required when `state === 'locked'`: a lock always names its reason. */
  lockedReason?: string
}

export type WorkflowStage = WorkflowSubStep & {
  /**
   * The stage's own members. Rendered ONLY while this stage is current —
   * see the docblock: progressive disclosure is the contract, not an
   * option the caller can switch off.
   */
  steps?: ReadonlyArray<WorkflowSubStep>
}

// One fully-written class name per state: verify.py's DS-CLASS-EXISTS greps
// source for literal `a3-*` names, and an interpolated suffix would leave it
// only the bare prefix to match.
const STATE_CLASS: Record<WorkflowStageState, string> = {
  current: 'a3-wfn-current',
  done: 'a3-wfn-done',
  upcoming: 'a3-wfn-upcoming',
  locked: 'a3-wfn-locked',
}

const STATE_KEY: Record<WorkflowStageState, string> = {
  current: 'ds.workflowNavigator.state.current',
  done: 'ds.workflowNavigator.state.done',
  upcoming: 'ds.workflowNavigator.state.upcoming',
  locked: 'ds.workflowNavigator.state.locked',
}

const GLYPH: Record<WorkflowStageState, string> = {
  current: '',
  done: '✓',
  upcoming: '',
  locked: '',
}

export function WorkflowNavigator({
  stages, ariaLabel,
}: {
  stages: ReadonlyArray<WorkflowStage>
  /** Required accessible name for the `<nav>` landmark. */
  ariaLabel: string
}) {
  const t = useT()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const interactive = stages.reduce<number[]>(
    (acc, stage, i) => (stage.onSelect ? [...acc, i] : acc), [],
  )
  const currentIndex = stages.findIndex((stage) => stage.state === 'current')
  const current = currentIndex >= 0 ? stages[currentIndex] : undefined
  const [roving, setRoving] = useState(
    currentIndex >= 0 && stages[currentIndex]?.onSelect
      ? currentIndex
      : (interactive[0] ?? 0),
  )

  const move = (from: number, direction: 1 | -1 | 'first' | 'last') => {
    if (interactive.length === 0) return
    const at = interactive.indexOf(from)
    const next = direction === 'first'
      ? 0
      : direction === 'last'
        ? interactive.length - 1
        : (at + direction + interactive.length) % interactive.length
    const index = interactive[next]!
    setRoving(index)
    buttonRefs.current[index]?.focus()
  }

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': event.preventDefault(); move(index, 1); break
      case 'ArrowLeft': case 'ArrowUp': event.preventDefault(); move(index, -1); break
      case 'Home': event.preventDefault(); move(index, 'first'); break
      case 'End': event.preventDefault(); move(index, 'last'); break
      default: break
    }
  }

  return (
    <nav className="a3-wfn" aria-label={ariaLabel}>
      <ol className="a3-wfn-list">
        {stages.map((stage, index) => {
          const stateText = t(STATE_KEY[stage.state])
          const glyph = GLYPH[stage.state] || String(index + 1)
          const body = (
            <>
              <span className="a3-wfn-marker" aria-hidden="true">{glyph}</span>
              <span className="a3-wfn-text">
                <span className="a3-wfn-label">{stage.label}</span>
                <span className="a3-wfn-state">
                  {stateText}
                  {stage.state === 'locked' && stage.lockedReason
                    ? ` · ${stage.lockedReason}`
                    : ''}
                </span>
              </span>
            </>
          )
          return (
            <li
              key={stage.id}
              className={`a3-wfn-stage ${STATE_CLASS[stage.state]}`}
            >
              {stage.onSelect ? (
                <button
                  ref={(el) => { buttonRefs.current[index] = el }}
                  type="button"
                  className="a3-wfn-button hit-target"
                  aria-current={stage.state === 'current' ? 'step' : undefined}
                  tabIndex={index === roving ? 0 : -1}
                  onKeyDown={onKeyDown(index)}
                  onClick={() => { setRoving(index); stage.onSelect!() }}
                >
                  {body}
                </button>
              ) : (
                <div
                  className="a3-wfn-static"
                  aria-current={stage.state === 'current' ? 'step' : undefined}
                >
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {/*
        THE MEMBERS OF THE CURRENT STAGE, AS A BAND UNDER THE WHOLE RAIL.
        
        The contract is unchanged and is still the point: members render for
        the CURRENT stage and for no other, there is no `showChildren` flag,
        and the caller passes exactly what it always did. What moved is where
        they are DRAWN. Inside their stage's own column they sized it: a
        Kalkulieren with seven members took 726 of 1320 px and squeezed
        `Konfigurieren` to 74, whose `nowrap` label then overflowed under the
        next stage's marker — measured at 1440 on the Option workspace, the
        first rail in this product whose current stage actually has members.
        Widening the column is not available either: a stage row of four
        equal columns is what keeps every stage label legible at 1280.

        So the band spans the rail, and the association it loses by leaving
        the `<li>` it regains as an accessible name that states which stage
        these members belong to.
      */}
      {current && current.steps && current.steps.length > 0 ? (
        <ol
          className="a3-wfn-sub"
          aria-label={t('ds.workflowNavigator.stepsOf', { stage: current.label })}
        >
          {current.steps.map((step) => (
            <li
              key={step.id}
              className={`a3-wfn-substep ${STATE_CLASS[step.state]}`}
            >
              {step.onSelect ? (
                <button
                  type="button"
                  className="a3-wfn-subbutton hit-target"
                  aria-current={step.state === 'current' ? 'step' : undefined}
                  onClick={step.onSelect}
                >
                  <span className="a3-wfn-sublabel">{step.label}</span>
                  {/* A LOCK ALWAYS NAMES ITS REASON — including when the
                      locked step is reachable so it can explain itself
                      (T-016). The static branch below always did; this one
                      did not, so a reachable lock silently lost the one
                      sentence that makes it a route rather than a refusal.
                      The top-level stage renders the reason in both branches
                      already; these two now agree. */}
                  <span className="a3-wfn-substate">
                    {t(STATE_KEY[step.state])}
                    {step.state === 'locked' && step.lockedReason
                      ? ` · ${step.lockedReason}`
                      : ''}
                  </span>
                </button>
              ) : (
                <span className="a3-wfn-substatic">
                  <span className="a3-wfn-sublabel">{step.label}</span>
                  <span className="a3-wfn-substate">
                    {t(STATE_KEY[step.state])}
                    {step.state === 'locked' && step.lockedReason
                      ? ` · ${step.lockedReason}`
                      : ''}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </nav>
  )
}
