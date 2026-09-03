import { useEffect, useRef, type ReactNode } from 'react'
import { SemanticStatus } from './SemanticStatus'
import { useSemanticMotion } from './motion'

/**
 * SaveReceipt — the outcome of an explicit commitment (VR3-04, targets
 * T-033, M-08).
 *
 * WHAT IT REPLACES. Nothing: the released product had no save to report on.
 * Persistence was continuous and silent, so "this Option is saved" was not a
 * sentence the product could say, and Client Mode had to be gated on
 * configuration completeness instead (audit F-002). A commitment with no
 * receipt is a commitment the user has to take on trust.
 *
 * IT NAMES THE THING IT SAVED. Option, version, time — and the state of the
 * one thing the save unlocked. "Gespeichert" alone would be the same
 * unfalsifiable reassurance as the silent autosave it replaces.
 *
 * M-08: THE RECEIPT REPLACES THE BUSY ACTION, and the unlock is emphasised
 * exactly once. `role="status"` announces it politely; a failure is
 * `role="alert"` and assertive, because a failed commitment is the one
 * outcome the user must not read past. Under `prefers-reduced-motion` the
 * emphasis is not animated and the receipt still takes focus — the meaning
 * travels in the focus move and the announcement, never in the animation
 * (rule 21).
 */

export type SaveReceiptRow = {
  id: string
  label: string
  value: ReactNode
}

export function SaveReceipt({
  eyebrow, heading, explanation, rows, unlock, actions, media, autoFocus,
}: {
  /** `OPTION GESPEICHERT · VERSION 1` — identity before prose. */
  eyebrow: string
  heading: ReactNode
  explanation?: ReactNode
  /** Validation state, save time, author — the record, as a list. */
  rows: readonly SaveReceiptRow[]
  /**
   * The one thing the save unlocked, emphasised once. Its own live region:
   * a viewer whose reason for saving was the meeting needs to hear THIS.
   */
  unlock?: { tone: 'ok' | 'attention'; label: string; reason?: string }
  actions?: ReactNode
  media?: ReactNode
  /** Move focus here once, when the receipt first appears. */
  autoFocus?: boolean
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { reduced } = useSemanticMotion()
  useEffect(() => {
    if (autoFocus) headingRef.current?.focus()
  }, [autoFocus])
  return (
    <div className="a3-svr" role="status" aria-live="polite">
      <div className="a3-svr-body">
        <p className="a3-svr-eyebrow">{eyebrow}</p>
        <h1 className="a3-hero-title a3-svr-heading" ref={headingRef} tabIndex={-1} data-page-heading>
          {heading}
        </h1>
        {explanation && <p className="a3-svr-explanation">{explanation}</p>}
        <dl className="a3-svr-rows">
          {rows.map((row) => (
            <div key={row.id} className="a3-svr-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        {unlock && (
          // The single emphasis M-08 permits, and it is a CSS animation the
          // reduced-motion class turns off rather than a transform this
          // component runs itself.
          <p className={reduced ? 'a3-svr-unlock' : 'a3-svr-unlock a3-svr-unlock-emphasis'}>
            <SemanticStatus tone={unlock.tone} label={unlock.label} reason={unlock.reason} />
          </p>
        )}
        {actions && <div className="a3-svr-actions">{actions}</div>}
      </div>
      {media && <div className="a3-svr-media">{media}</div>}
    </div>
  )
}

/**
 * A failed commitment.
 *
 * Separate from the receipt on purpose: a failure is not a receipt with a
 * different tone, it is the absence of one. It keeps the confirmed
 * validation visible ("nothing you did was lost") and offers a retry that
 * mints no second version — the idempotence lives in the store's own
 * intended-version record, and this component states that it holds.
 */
export function SaveFailureNotice({
  label, reason, retry, preserved,
}: {
  label: string
  reason: string
  retry?: ReactNode
  /** What survived the failure, named. */
  preserved?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="a3-svf" role="alert" ref={ref} tabIndex={-1}>
      <SemanticStatus tone="error" label={label} reason={reason} as="div" />
      {preserved && <p className="a3-svf-preserved">{preserved}</p>}
      {retry && <div className="a3-svf-retry">{retry}</div>}
    </div>
  )
}
