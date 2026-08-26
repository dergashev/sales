import { useRef, useState, type ReactNode, type KeyboardEvent } from 'react'
import { useTx } from '../i18n'

/**
 * WorkflowStepper — canonical progress-navigation family (REDESIGN R1,
 * DESIGN-14; contract `design-system/components-core.md`).
 *
 * Before R1 no canonical implementation existed: the Project Card stepper
 * was four bordered prose-cards (each carrying 2-3 lines of explanatory
 * copy, DESIGN-08) and the S3 chapter nav was a separate, unregistered
 * pattern. This is the ONE family both should migrate onto (a product-wide
 * migration is R2/R3/R4's job, not this ticket's — see governance).
 *
 * Anatomy (audit §"STEPPER ANATOMY"): state glyph + short label + optional
 * position, rationale behind native `<details>` disclosure — never
 * permanent prose. Two size variants (`workflow` horizontal /  `chapter`
 * vertical, compact) share one anatomy and one token set.
 *
 * States: upcoming / current / done / attention / blocked / skipped, PLUS
 * the composite done+current (a revisited step you are currently on). The
 * composite MUST be carried by two classes together on one element
 * (`.a3-wfs-done.a3-wfs-cur`) — a single merged state class reintroduces
 * the recorded orange-on-green 1.15:1 collision class of defect.
 *
 * Accessibility: `<ol>` semantics, `aria-current="step"` (not `"true"` —
 * that drift is a recorded DS-remediation defect this component does not
 * repeat), every glyph is `aria-hidden` with state carried in text/position
 * (rule 8, never colour alone), interactive steps are real `<button>`s
 * with the 44px hit-target contract, blocked steps stay focusable with a
 * visible reason.
 */

export type WorkflowStepState =
  | 'upcoming' | 'current' | 'done' | 'attention' | 'blocked' | 'skipped'

export type WorkflowStep = {
  id: string
  label: string
  state: WorkflowStepState
  /** Composite done+current: a revisited step you are currently on. Only
   * meaningful when `state === 'current'` — carried as an independent flag
   * because a step's `state` is a single value, not two booleans. Renders
   * as done's fill PLUS current's ring (`.a3-wfs-done.a3-wfs-cur`), the
   * exact composite-class shape that fixed the recorded orange-on-green
   * 1.15:1 collision elsewhere in this system — a merged single state
   * class would reintroduce that defect class. */
  previouslyDone?: boolean
  /** Revealed behind native `<details>` — never permanently visible prose. */
  rationale?: ReactNode
  /** Present only on steps the user may navigate to directly. */
  onSelect?: () => void
  /** Required (and rendered) when `state === 'blocked'` and `onSelect` is set —
   * a blocked step never disables silently (rule 12). */
  blockedReason?: string
}

const GLYPH: Record<WorkflowStepState, string> = {
  upcoming: '', // filled with the 1-based position instead
  current: '',
  done: '✓',   // ✓
  attention: '!',
  blocked: '✕', // ✕
  skipped: '·', // ·
}

// One fully-written class name per state, not a template interpolation —
// tools/verify.py's DS-CLASS-EXISTS gate statically greps source for that
// pattern, and an interpolated suffix leaves only the bare prefix for it
// to match, which it then reports as an undeclared class.
const STATE_CLASS: Record<WorkflowStepState, string> = {
  upcoming: 'a3-wfs-upcoming',
  current: 'a3-wfs-current',
  done: 'a3-wfs-done',
  attention: 'a3-wfs-attention',
  blocked: 'a3-wfs-blocked',
  skipped: 'a3-wfs-skipped',
}

const STATE_LABEL_KEY: Record<WorkflowStepState, string> = {
  upcoming: 'designSystem.workflowStepper.state.upcoming',
  current: 'designSystem.workflowStepper.state.current',
  done: 'designSystem.workflowStepper.state.done',
  attention: 'designSystem.workflowStepper.state.attention',
  blocked: 'designSystem.workflowStepper.state.blocked',
  skipped: 'designSystem.workflowStepper.state.skipped',
}

/** Fallback DE copy for the four internal strings this component needs
 * (state names + "Schritt x von y" + "Warum?"). Registered as dictionary
 * keys so a future pass can move them into `src/i18n/index.ts` without an
 * API change — that file currently carries an unrelated large in-flight
 * changeset (see R1 implementation notes) this task deliberately does not
 * touch, so the literal DE text (source/fallback language, rule 10) ships
 * inline here today and `useTx` still resolves any matching future key. */
const FALLBACK_DE: Record<string, string> = {
  'designSystem.workflowStepper.state.upcoming': 'ausstehend',
  'designSystem.workflowStepper.state.current': 'aktuell',
  'designSystem.workflowStepper.state.done': 'erledigt',
  'designSystem.workflowStepper.state.attention': 'benötigt Aufmerksamkeit',
  'designSystem.workflowStepper.state.blocked': 'blockiert',
  'designSystem.workflowStepper.state.skipped': 'übersprungen',
  'designSystem.workflowStepper.position': 'Schritt {n} von {total}',
  'designSystem.workflowStepper.why': 'Warum?',
}

function tx1(key: string, tx: (k: string) => string, vars?: Record<string, string | number>): string {
  const resolved = tx(key)
  const text = resolved === key ? (FALLBACK_DE[key] ?? key) : resolved
  if (!vars) return text
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), text,
  )
}

export function WorkflowStepper({
  steps, ariaLabel, size = 'workflow',
}: {
  steps: ReadonlyArray<WorkflowStep>
  /** Required accessible name for the `<nav>` landmark — no visual label
   * doubles as one by default (the stepper is often the only orientation
   * cue on a busy workspace). */
  ariaLabel: string
  size?: 'workflow' | 'chapter'
}) {
  const tx = useTx()
  // Written as a static branch rather than a template interpolation — see
  // the STATE_CLASS comment above for why.
  const sizeClass = size === 'workflow' ? 'a3-wfs-workflow' : 'a3-wfs-chapter'

  // Roving tabindex (KEY-003, DS-GOV-EX-07's removal condition): only ONE
  // interactive step is a Tab stop at a time; arrow keys move focus (and
  // the roving position) between interactive steps without leaving the
  // stepper. Defaults to the current step when it is itself interactive,
  // otherwise the first interactive step — never an index that can't
  // receive focus.
  const interactiveIndices = steps.reduce<number[]>(
    (acc, s, i) => (s.onSelect ? [...acc, i] : acc), [],
  )
  const defaultRovingIndex = steps.findIndex((s) => s.state === 'current' && s.onSelect)
  const [rovingIndex, setRovingIndex] = useState(
    defaultRovingIndex >= 0 ? defaultRovingIndex : (interactiveIndices[0] ?? 0),
  )
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const moveFocus = (fromIndex: number, direction: 1 | -1 | 'first' | 'last') => {
    if (interactiveIndices.length === 0) return
    const pos = interactiveIndices.indexOf(fromIndex)
    let nextPos: number
    if (direction === 'first') nextPos = 0
    else if (direction === 'last') nextPos = interactiveIndices.length - 1
    else nextPos = (pos + direction + interactiveIndices.length) % interactiveIndices.length
    const nextIndex = interactiveIndices[nextPos]!
    setRovingIndex(nextIndex)
    buttonRefs.current[nextIndex]?.focus()
  }

  const handleKeyDown = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); moveFocus(i, 1); break
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); moveFocus(i, -1); break
      case 'Home': e.preventDefault(); moveFocus(i, 'first'); break
      case 'End': e.preventDefault(); moveFocus(i, 'last'); break
      default: break
    }
  }

  return (
    <nav aria-label={ariaLabel} className={`a3-wfs ${sizeClass}`}>
      <ol className="a3-wfs-list">
        {steps.map((step, i) => {
          const isCurrent = step.state === 'current'
          const composite = isCurrent && step.previouslyDone
          // Composite done+current shows the DONE glyph (✓), not the plain
          // position number — the outer ring (className below) is what
          // marks it as also current. Caught visually: an earlier version
          // computed the glyph from `step.state` alone, so a revisited
          // step showed its position number with no visible sign it had
          // already been completed.
          const glyph = composite ? GLYPH.done : (GLYPH[step.state] || String(i + 1))
          const stateText = tx1(STATE_LABEL_KEY[step.state], tx)
          const positionText = tx1(
            'designSystem.workflowStepper.position', tx,
            { n: i + 1, total: steps.length },
          )
          const className = [
            'a3-wfs-step',
            composite ? 'a3-wfs-done' : STATE_CLASS[step.state],
            composite ? 'a3-wfs-cur' : '',
          ].filter(Boolean).join(' ')
          const marker = (
            <span className="a3-wfs-marker" aria-hidden="true">
              {glyph || i + 1}
            </span>
          )
          const body = (
            <>
              {marker}
              <span className="a3-wfs-text">
                <span className="a3-wfs-label">{step.label}</span>
                <span className="a3-wfs-meta">
                  {positionText} · {stateText}
                </span>
              </span>
            </>
          )
          return (
            <li
              key={step.id}
              className={className}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {step.onSelect ? (
                <button
                  ref={(el) => { buttonRefs.current[i] = el }}
                  type="button"
                  className="a3-wfs-button hit-target"
                  onClick={() => { setRovingIndex(i); step.onSelect!() }}
                  onKeyDown={handleKeyDown(i)}
                  tabIndex={i === rovingIndex ? 0 : -1}
                  aria-describedby={
                    step.state === 'blocked' && step.blockedReason
                      ? `${step.id}-blocked-reason` : undefined
                  }
                >
                  {body}
                </button>
              ) : (
                <div className="a3-wfs-static">{body}</div>
              )}
              {step.state === 'blocked' && step.blockedReason && (
                <p id={`${step.id}-blocked-reason`} className="a3-wfs-blocked-reason">
                  {step.blockedReason}
                </p>
              )}
              {step.rationale && (
                <details className="a3-wfs-rationale">
                  <summary>{tx1('designSystem.workflowStepper.why', tx)}</summary>
                  <div>{step.rationale}</div>
                </details>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
