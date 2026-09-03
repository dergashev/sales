import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useT } from '../i18n'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * ActionGate, PrerequisiteState and ProjectReadiness — canonical workflow
 * gate capabilities (VR3-00 design delta: REPLACE of the generic disabled
 * control, and REMOVE of the empty result/dashboard state in favour of an
 * explicit prerequisite state).
 *
 * The three exist because of one recorded defect class: a workflow gate
 * presented as a greyed-out button. A disabled control states that
 * something is unavailable and nothing else — not why, not what would open
 * it, and not what the user can do instead. CLAUDE.md rule 12 is explicit:
 * a blocked element always explains itself.
 *
 * `PrerequisiteState` carries the second half of that rule. Before the
 * prerequisite action has run there is no result, so the result anatomy is
 * NOT MOUNTED — not mounted and filled with zeros, not mounted and empty.
 * A zero metric panel before an analysis is a false statement about the
 * project, and an empty-looking conflict list is worse: it reads as "no
 * conflicts".
 */

export type ActionGateStatus = 'available' | 'locked' | 'busy' | 'error'

const GATE_TONE: Record<ActionGateStatus, SemanticStatusTone> = {
  available: 'ok',
  locked: 'attention',
  busy: 'progress',
  error: 'error',
}

const GATE_LABEL_KEY: Record<ActionGateStatus, string> = {
  available: 'ds.actionGate.status.available',
  locked: 'ds.actionGate.status.locked',
  busy: 'ds.actionGate.status.busy',
  error: 'ds.actionGate.status.error',
}

export type GatePrerequisite = {
  id: string
  label: string
  met: boolean
  /** What is still outstanding, in the user's terms — not a rule name. */
  detail?: string
}

export function ActionGate({
  status, prerequisites, reason, route, alternative, error, children,
}: {
  status: ActionGateStatus
  /** The unmet prerequisites, named. An empty list with `locked` is a bug. */
  prerequisites?: ReadonlyArray<GatePrerequisite>
  /**
   * One sentence stating why the gate is closed, with its count.
   *
   * Pass it ONLY when the action does not state the reason itself. The
   * canonical `Button` renders its `disabledReason` visibly beneath the
   * control and associates it through `aria-describedby` (review 13, defect
   * 12) — passing both printed the same sentence twice, which the DOM suite
   * caught as a duplicated label.
   */
  reason?: string
  /** The direct route to resolve it. A gate without a route is a dead end. */
  route?: { label: string; onSelect: () => void }
  /** What the user can legitimately do instead, when something exists. */
  alternative?: ReactNode
  /** A failed commitment. Readiness and prior work stay untouched. */
  error?: { message: string; retryLabel?: string; onRetry?: () => void }
  /** The action itself. It renders in every status, never as a bare stub. */
  children: ReactNode
}) {
  const t = useT()
  const reasonId = useId()
  const unmet = (prerequisites ?? []).filter((p) => !p.met)

  /**
   * A failed commitment takes focus, once, when it appears.
   *
   * `role="alert"` announces the failure but moves nothing, and a gate is
   * often far down a long review surface: a failed Option creation was
   * announced correctly while the screen showed the top of the page with no
   * error in sight — observed in the browser, on the exact candidate. So the
   * capability that owns the failure also owns bringing the user to it:
   * focusing scrolls it into view for a sighted user and puts a keyboard
   * user on the retry control's own region, which is the recovery route.
   *
   * Only on the TRANSITION into failure. Focusing on every render would
   * steal focus from whatever the user did next, including the retry itself.
   */
  const errorRef = useRef<HTMLDivElement>(null)
  const hadError = useRef(false)
  const hasError = Boolean(error)
  useEffect(() => {
    if (hasError && !hadError.current) {
      errorRef.current?.focus()
      // `?.()` like `ProjectOptions`' own scroll: jsdom does not implement
      // it, and this is presentation, not behaviour under test.
      errorRef.current?.scrollIntoView?.({ block: 'nearest' })
    }
    hadError.current = hasError
  }, [hasError])
  return (
    <div className={status === 'available' ? 'a3-gate a3-gate-open' : 'a3-gate a3-gate-closed'}>
      <div className="a3-gate-action">{children}</div>
      <div className="a3-gate-explanation" id={reasonId}>
        <SemanticStatus
          tone={GATE_TONE[status]}
          label={t(GATE_LABEL_KEY[status])}
          size="compact"
        />
        {reason ? <p className="a3-gate-reason">{reason}</p> : null}
        {unmet.length > 0 ? (
          <ul className="a3-gate-prereqs">
            {unmet.map((prerequisite) => (
              <li key={prerequisite.id} className="a3-gate-prereq">
                <span className="a3-gate-prereq-label">{prerequisite.label}</span>
                {prerequisite.detail ? (
                  <span className="a3-gate-prereq-detail">{prerequisite.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {route ? (
          <button
            type="button"
            className="a3-gate-route hit-target"
            onClick={route.onSelect}
          >
            {route.label}
          </button>
        ) : null}
        {alternative ? (
          <div className="a3-gate-alternative">{alternative}</div>
        ) : null}
        {error ? (
          <div className="a3-gate-error" role="alert" tabIndex={-1} ref={errorRef}>
            {/* The gate's own status line already says FAILED when the gate
                is in its error status, and printing it twice is the
                duplicated label this system exists to avoid. It stays for a
                consumer that reports a failed attempt while the gate itself
                is available again — there the word appears once. */}
            {status === 'error' ? null : (
              <SemanticStatus tone="error" label={t('ds.actionGate.status.error')} size="compact" />
            )}
            <p className="a3-gate-error-message">{error.message}</p>
            {error.onRetry ? (
              <button
                type="button"
                className="a3-gate-route hit-target"
                onClick={error.onRetry}
              >
                {error.retryLabel ?? t('ds.actionGate.retry')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The state BEFORE a prerequisite action has produced anything. It explains
 * the material at hand, what the action will do, what it unlocks, and
 * offers exactly one unmistakable primary action.
 */
export function PrerequisiteState({
  eyebrow, heading, explanation, absenceTitle, absenceDetail,
  action, secondaryAction, media, inventory,
}: {
  eyebrow: string
  heading: ReactNode
  explanation: ReactNode
  /** Names the absence honestly: "no results yet", never "0 conflicts". */
  absenceTitle: string
  absenceDetail: string
  action: ReactNode
  secondaryAction?: ReactNode
  media?: ReactNode
  /** What the input material contains, from the register itself. */
  inventory?: ReactNode
}) {
  return (
    <div className="a3-prereq">
      <div className="a3-prereq-copy">
        <p className="a3-prereq-eyebrow">{eyebrow}</p>
        <h1 className="a3-prereq-heading" tabIndex={-1} data-page-heading>{heading}</h1>
        <p className="a3-prereq-lead">{explanation}</p>
        <div className="a3-prereq-absence">
          <span className="a3-prereq-absence-glyph" aria-hidden="true">○</span>
          <div>
            <b className="a3-prereq-absence-title">{absenceTitle}</b>
            <p className="a3-prereq-absence-detail">{absenceDetail}</p>
          </div>
        </div>
        <div className="a3-prereq-actions">
          {action}
          {secondaryAction}
        </div>
      </div>
      {media ? <div className="a3-prereq-media">{media}</div> : null}
      {inventory ? <div className="a3-prereq-inventory">{inventory}</div> : null}
    </div>
  )
}

export type ReadinessRow = {
  id: string
  label: string
  /** Already formatted value or state word. Never a bare boolean. */
  value: ReactNode
  tone?: SemanticStatusTone
}

/**
 * ProjectReadiness — the project's lifecycle and next action as the first
 * hierarchy on the page. Readiness is derived from states, never from an
 * empty array: "no conflicts recorded" and "conflicts not yet computed"
 * are different facts and this capability keeps them different.
 */
export function ProjectReadiness({
  eyebrow, heading, explanation, rows, attention, action, media, secondary,
}: {
  eyebrow: string
  heading: ReactNode
  explanation?: ReactNode
  rows: ReadonlyArray<ReadinessRow>
  /** The attention count and what it blocks, when something does. */
  attention?: ReactNode
  action?: ReactNode
  media?: ReactNode
  secondary?: ReactNode
}) {
  return (
    <div className="a3-readiness">
      <div className="a3-readiness-copy">
        <p className="a3-readiness-eyebrow">{eyebrow}</p>
        <h1 className="a3-readiness-heading" tabIndex={-1} data-page-heading>{heading}</h1>
        {explanation ? <p className="a3-readiness-lead">{explanation}</p> : null}
        <dl className="a3-readiness-rows">
          {rows.map((row) => (
            <div key={row.id} className="a3-readiness-row">
              <dt className="a3-readiness-row-label">{row.label}</dt>
              <dd className="a3-readiness-row-value">{row.value}</dd>
            </div>
          ))}
        </dl>
        {attention ? <div className="a3-readiness-attention">{attention}</div> : null}
        {action ? <div className="a3-readiness-action">{action}</div> : null}
        {secondary ? <div className="a3-readiness-secondary">{secondary}</div> : null}
      </div>
      {media ? <div className="a3-readiness-media">{media}</div> : null}
    </div>
  )
}
