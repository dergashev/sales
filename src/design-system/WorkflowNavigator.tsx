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

/**
 * ONE state vocabulary, as an EXPLICIT VARIANT (B2, Product Owner
 * requirement 15; navigation-and-blocker-patterns.md).
 *
 * What this replaces is the shape, not the meanings. The released model was
 * a four-value union (`current | done | upcoming | locked`) plus three
 * side-channels bolted on beside it — `lockedReason`, `attention: string`
 * and `outOfScope: boolean` — so a member's real state was spread across
 * four props and had to be reassembled by every renderer, in the right
 * order, from `outOfScope ? … : attention ? … : state`. Three of the seven
 * states were therefore not states at all, and the contract this ticket is
 * held to says it plainly: state is an explicit variant, and per-state
 * boolean props are what a navigator must not accumulate.
 *
 * So there are seven values and ONE `reason`, and no combination to get
 * wrong:
 *
 * - `current`   — exactly one, and it carries `aria-current="step"`;
 * - `done`      — settled, including a group deliberately excluded;
 * - `available` — reachable and not yet done (the released `upcoming`,
 *                 renamed to say what it offers rather than when it is);
 * - `locked`    — a prerequisite is missing, and `reason` NAMES it;
 * - `warning`   — reachable, holding something that needs a human, and
 *                 `reason` says what (the released `attention`);
 * - `stale`     — was settled, and something under it moved since;
 * - `outOfScope`— taken out by an explicit decision, still visible in place.
 *
 * `reason` belongs to `locked`, `warning` and `stale`. Nothing else reads it,
 * and none of the three is allowed to appear without it — a state that says
 * only that something is unavailable is the defect rule 12 forbids.
 */
export type WorkflowState =
  | 'current' | 'done' | 'available' | 'locked' | 'warning' | 'stale' | 'outOfScope'

/**
 * The released name, kept as an alias because the top-level rail and the
 * secondary navigator now share one vocabulary — there is no second union
 * left for it to name.
 */
export type WorkflowStageState = WorkflowState

export type WorkflowSubStep = {
  id: string
  label: string
  state: WorkflowState
  onSelect?: () => void
  /**
   * Why this member is `locked`, `warning` or `stale`. Required for all
   * three: a lock, a warning and a stale mark each name their cause or they
   * are decoration (rule 12, rule 8).
   */
  reason?: string
  /**
   * VR3-KG-UNIFY-00 — the word the PROGRESSION shows where the full label
   * would not fit eight segments at 1280 (`Verantwortung` for
   * `Schnittstellen & Verantwortung`). The full label stays the accessible
   * name and the tooltip; the visible word is contained in it (label-in-name).
   */
  shortLabel?: string
}

/**
 * How a stage draws its members while it is current (VR3-KG-UNIFY-00).
 *
 * `list` is the released band of label + state pairs. `progression` is ONE
 * contiguous row of equal segments — glyph + short label — for a stage whose
 * members are an ORDERED SEQUENCE the user walks (the eight Configurator
 * chapters). The disclosure rule is identical for both: members render for
 * the current stage and for no other.
 */
export type WorkflowStepsPresentation = 'list' | 'progression'

export type WorkflowStage = WorkflowSubStep & {
  /**
   * The stage's own members. Rendered ONLY while this stage is current —
   * see the docblock: progressive disclosure is the contract, not an
   * option the caller can switch off.
   */
  steps?: ReadonlyArray<WorkflowSubStep>
  stepsPresentation?: WorkflowStepsPresentation
}

// One fully-written class name per state: verify.py's DS-CLASS-EXISTS greps
// source for literal `a3-*` names, and an interpolated suffix would leave it
// only the bare prefix to match.
const STATE_CLASS: Record<WorkflowState, string> = {
  current: 'a3-wfn-current',
  done: 'a3-wfn-done',
  available: 'a3-wfn-upcoming',
  locked: 'a3-wfn-locked',
  warning: 'a3-wfn-warning',
  stale: 'a3-wfn-stale',
  outOfScope: 'a3-wfn-outofscope',
}

const STATE_KEY: Record<WorkflowState, string> = {
  current: 'ds.workflowNavigator.state.current',
  done: 'ds.workflowNavigator.state.done',
  available: 'ds.workflowNavigator.state.upcoming',
  locked: 'ds.workflowNavigator.state.locked',
  warning: 'ds.workflowNavigator.state.attention',
  stale: 'ds.workflowNavigator.state.stale',
  outOfScope: 'ds.workflowNavigator.state.outOfScope',
}

const GLYPH: Record<WorkflowState, string> = {
  current: '',
  done: '✓',
  available: '',
  locked: '',
  warning: '!',
  stale: '↻',
  outOfScope: '—',
}

/** The three states that must name their cause, and nothing else may. */
const REASON_STATES: ReadonlySet<WorkflowState> = new Set(['locked', 'warning', 'stale'])

/**
 * The state, in words, with its cause where it has one. ONE function, so the
 * rail, the progression and the list cannot describe the same state in three
 * different orders — which is exactly what the four-prop model made them do.
 */
function stateText(
  t: (key: string, values?: Record<string, string | number>) => string,
  step: { state: WorkflowState; reason?: string },
): string {
  const word = t(STATE_KEY[step.state])
  return REASON_STATES.has(step.state) && step.reason
    ? `${word} · ${step.reason}`
    : word
}

/**
 * The progression's marks. Each state has a DIFFERENT shape, so a locked and
 * an upcoming chapter are told apart without colour; the word travels in the
 * accessible name.
 */
const PROGRESSION_GLYPH: Record<WorkflowState, string> = {
  current: '●',
  done: '✓',
  available: '○',
  locked: '–',
  warning: '!',
  stale: '↻',
  outOfScope: '—',
}

/**
 * ORIENTATION IS A VARIANT OF THIS NAVIGATOR, NOT A SECOND NAVIGATOR.
 *
 * `horizontal` (default) is the released rail, unchanged in every respect —
 * the band of members still spans the whole rail beneath it, because inside
 * their stage's own column they sized it (see the note at that band).
 *
 * `vertical` draws the same stages, the same states, the same vocabulary and
 * the same keyboard model as one column, and puts the current stage's
 * members directly UNDER that stage, inside its own `<li>` — in a column
 * there is no width to compete for, so the reason the band was lifted out
 * does not apply, and nesting restores the association the horizontal band
 * has to recover through an accessible name. A `progression` presentation
 * is ignored here and the list is drawn instead: the progression is a
 * contiguous row of eight equal segments, which a rail column cannot hold.
 */
export type WorkflowOrientation = 'horizontal' | 'vertical'

export function WorkflowNavigator({
  stages, ariaLabel, orientation = 'horizontal',
}: {
  stages: ReadonlyArray<WorkflowStage>
  /** Required accessible name for the `<nav>` landmark. */
  ariaLabel: string
  orientation?: WorkflowOrientation
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

  const vertical = orientation === 'vertical'

  /** The current stage's members as a list — the only shape a column holds. */
  const membersList = (stage: WorkflowStage) => (
    <ol
      className="a3-wfn-sub"
      aria-label={t('ds.workflowNavigator.stepsOf', { stage: stage.label })}
    >
      {stage.steps!.map((step) => (
        <li
          key={step.id}
          className={`a3-wfn-substep ${STATE_CLASS[step.state]}`}
          data-state={step.state}
        >
          {step.onSelect ? (
            <button
              type="button"
              className="a3-wfn-subbutton hit-target"
              aria-current={step.state === 'current' ? 'step' : undefined}
              onClick={step.onSelect}
            >
              <span className="a3-wfn-sublabel">{step.label}</span>
              <span className="a3-wfn-substate">{stateText(t, step)}</span>
            </button>
          ) : (
            <span className="a3-wfn-substatic">
              <span className="a3-wfn-sublabel">{step.label}</span>
              <span className="a3-wfn-substate">{stateText(t, step)}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  )

  const hasMembers = (stage: WorkflowStage | undefined): stage is WorkflowStage =>
    !!stage && !!stage.steps && stage.steps.length > 0

  return (
    <nav
      className={`a3-wfn${vertical ? ' a3-wfn-vertical' : ''}`}
      aria-label={ariaLabel}
    >
      <ol className="a3-wfn-list">
        {stages.map((stage, index) => {
          const stageStateText = stateText(t, stage)
          const glyph = GLYPH[stage.state] || String(index + 1)
          const body = (
            <>
              <span className="a3-wfn-marker" aria-hidden="true">{glyph}</span>
              <span className="a3-wfn-text">
                <span className="a3-wfn-label">{stage.label}</span>
                <span className="a3-wfn-state">{stageStateText}</span>
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
              {/* In a column the members belong to the stage they describe,
                  so they are drawn inside it — see the orientation note. */}
              {vertical && stage.state === 'current' && hasMembers(stage)
                ? membersList(stage)
                : null}
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
      {!vertical && current && current.steps && current.steps.length > 0
        && current.stepsPresentation === 'progression' ? (
        /*
          THE COMPACT CHAPTER PROGRESSION (VR3-KG-UNIFY-00, navigation
          contract). Eight destinations as ONE contiguous row of equal
          segments, visually continuous at 1440 and 1280: a mark and a short
          label per member, the current one carried by the accent underline
          and `aria-current="step"`. It is the same `<ol>` of the same
          members with the same routes — a projection of the registry, never
          a second order — so the released list above is what it replaces,
          not what it competes with.
        */
          <ol
            className="a3-wfn-prog"
            aria-label={t('ds.workflowNavigator.progressionOf', { stage: current.label })}
          >
            {current.steps.map((step) => {
              // ONE state, ONE mark, ONE sentence. The released version
              // reassembled all three from `outOfScope ? … : attention ? … :
              // state` at every render site; the state is now the state.
              const text = stateText(t, step)
              const glyph = PROGRESSION_GLYPH[step.state]
              const visible = step.shortLabel ?? step.label
              // The full label IS the accessible name; the visible short word
              // is contained in it, so label-in-name holds for voice users.
              const name = `${step.label} · ${text}`
              const title = visible === step.label ? undefined : step.label
              const body = (
                <>
                  <span className="a3-wfn-segmark" aria-hidden="true">{glyph}</span>
                  <span className="a3-wfn-seglabel">{visible}</span>
                </>
              )
              return (
                <li
                  key={step.id}
                  className={`a3-wfn-seg ${STATE_CLASS[step.state]}`}
                  data-state={step.state}
                >
                  {step.onSelect ? (
                    <button
                      type="button"
                      className="a3-wfn-segbtn hit-target"
                      aria-current={step.state === 'current' ? 'step' : undefined}
                      aria-label={name}
                      title={title}
                      onClick={step.onSelect}
                    >
                      {body}
                    </button>
                  ) : (
                    <span
                      className="a3-wfn-segstatic"
                      aria-current={step.state === 'current' ? 'step' : undefined}
                      title={title}
                    >
                      {body}
                      <span className="sr-only">{` · ${text}`}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        ) : !vertical && current && current.steps && current.steps.length > 0 ? (
        <ol
          className="a3-wfn-sub"
          aria-label={t('ds.workflowNavigator.stepsOf', { stage: current.label })}
        >
          {current.steps.map((step) => (
            <li
              key={step.id}
              className={`a3-wfn-substep ${STATE_CLASS[step.state]}`}
              data-state={step.state}
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
                  <span className="a3-wfn-substate">{stateText(t, step)}</span>
                </button>
              ) : (
                <span className="a3-wfn-substatic">
                  <span className="a3-wfn-sublabel">{step.label}</span>
                  <span className="a3-wfn-substate">{stateText(t, step)}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </nav>
  )
}
