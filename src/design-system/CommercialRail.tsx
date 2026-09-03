import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'
import { useSemanticMotion } from './motion'

/**
 * CommercialRail — the causal half of the commercial rail (VR3-03, target
 * T-028, motion M-07; audit F-010).
 *
 * WHAT THE RAIL ALREADY HAD, AND WHY THIS IS NOT A SECOND RAIL.
 *
 * The released rail (`components-core.md` §13: OfferRailShell,
 * StickyCommercialBand, CompositionRow, RailTable) already carries the
 * canonical total, the uncertainty band, the DIN 276 composition and the
 * cost drivers, and it is genuinely good at them. The audit's finding was
 * narrower and sharper: "The rail displays totals and reacts to
 * configuration, but the user does not receive a durable, semantically
 * linked 'what changed / delta / affected total' explanation." Building a
 * whole second rail beside a working one would have been the parallel
 * grammar this ticket exists to remove — so these are the parts the delta
 * asked for, composed INTO the one rail that already exists.
 *
 * THREE PARTS, THREE JOBS:
 * - `CommercialRailChange` — what moved the number, signed, and it STAYS.
 * - `CommercialRailScope`  — what the number currently contains.
 * - `CommercialRailStatus` — whether the number can be trusted right now.
 *
 * MOTION (M-07). The value is REPLACED, never rolled: a total that counts
 * through 39, 38, 37 million on its way to a new value is three false
 * statements in 400 ms, and an expert reading a client's offer should never
 * have to wait for a number to settle. The change block crossfades in, and
 * under `prefers-reduced-motion` it simply appears — with the same text,
 * because the meaning was never in the movement.
 */

export type CommercialChangeDirection = 'increase' | 'decrease' | 'neutral'

export function CommercialRailChange({
  heading, label, amount, direction, meta, announcement,
}: {
  heading: string
  /** The decision, named. Never "Konfiguration geändert". */
  label: string
  /** The signed amount, already formatted by `CommercialNumber`. */
  amount: ReactNode
  direction: CommercialChangeDirection
  meta?: string
  /**
   * The polite announcement, as one whole sentence including the formatted
   * total. Scoped here rather than wrapping the whole band: a live region
   * around the entire commercial header re-reads every number on every
   * keystroke (SB-17).
   */
  announcement?: string
}) {
  const { reduced } = useSemanticMotion()
  return (
    <section className="a3-crc" aria-label={heading}>
      <p className="a3-cap">{heading}</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={label}
          className="a3-crc-body"
          data-direction={direction}
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduced ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <span className="a3-crc-label">{label}</span>
          <span className="a3-crc-amount">{amount}</span>
          {meta && <span className="a3-crc-meta">{meta}</span>}
        </motion.div>
      </AnimatePresence>
      {announcement && (
        <p className="sr-only" aria-live="polite">{announcement}</p>
      )}
    </section>
  )
}

/**
 * What the number currently contains.
 *
 * VR3-03R made it COLLAPSIBLE (target O: "make secondary rail detail
 * expandable" at 1280). The composition of the scope is secondary to the
 * total and its cause, and at 1280 those two have to be readable without
 * scrolling the rail — which they were not while this block sat BETWEEN
 * them in the rail's flow. Two changes, one requirement: the causal line
 * moved above this block (see `OfferPanel`), and this block can now be
 * folded away by the reader who wants the rail shorter still.
 *
 * It stays open by default, at both supported widths, because collapsing
 * information the reader did not ask to hide is its own defect — the
 * disclosure is theirs to use, not a default that hides scope from someone
 * who never learns it is there. Native `<details>`, so it is
 * keyboard-operable and announced with no disclosure state of our own.
 */
export function CommercialRailScope({
  heading, rows,
}: {
  heading: string
  rows: ReadonlyArray<{ label: string; value: string }>
}) {
  return (
    // The LANDMARK stays a labelled region and the disclosure lives inside
    // it. Making the `<details>` itself the outer element cost the block its
    // region role and its accessible name — a collapsible section is still a
    // section, and a screen-reader user navigating by landmark should not
    // lose one because a sighted user gained a fold.
    <section className="a3-crs" aria-label={heading}>
      <details open>
        <summary className="a3-crs-summary">
          <span className="a3-cap">{heading}</span>
        </summary>
        <dl className="a3-crs-rows">
          {rows.map((row) => (
            <div className="a3-crs-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}

/**
 * The rail's trust state, and the way out of it.
 *
 * `stale` exists because a failed calculation must keep the LAST TRUSTED
 * total and say so, rather than print a zero or a blank. Rule 16 forbids
 * the zero; a blank would be worse, because it looks like the number is
 * still coming.
 *
 * VR3-03R added `recovery` (audit G-07, target L). A state that names a
 * failure and offers nothing is a dead end: the reader learns the number
 * cannot be trusted and has no way to change that. `SaveReceipt` already
 * pairs a failure with its retry for the Option save; this is the same
 * pairing for the commercial result, on the surface the number lives on.
 *
 * FOCUS IS NOT STOLEN. The block renders as a `status`, not an `alert`, and
 * nothing here moves the caret: the user may well be mid-decision when a
 * write fails, and yanking focus to a retry button would interrupt the very
 * work the retry exists to protect (spec §15's own words). Urgency is
 * carried by the tone and the words.
 *
 * `detail` holds what the reader needs only if they ask — when the value
 * was last current, how many attempts have failed — and is a sibling of the
 * reason rather than a second status line, so the compact 1280 rail keeps
 * one trust block, not two.
 */
export function CommercialRailStatus({
  tone, label, reason, detail, recovery,
}: {
  tone: SemanticStatusTone
  label: string
  reason?: string
  detail?: string
  /** The action that resolves this state. Idempotent by contract. */
  recovery?: ReactNode
}) {
  return (
    <div className="a3-crst" role="status">
      <SemanticStatus tone={tone} label={label} reason={reason} />
      {detail && <p className="a3-crst-detail">{detail}</p>}
      {recovery && <div className="a3-crst-recovery">{recovery}</div>}
    </div>
  )
}
