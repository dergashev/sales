import { useEffect, useRef, type ReactNode } from 'react'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * ValidationReview · ReviewIndex · ReviewSection — a LONG review, made
 * navigable (VR3-04, targets T-030–T-032; design-system delta: "Local
 * validation summaries → NEW CANONICAL CAPABILITY REQUIRED").
 *
 * THE POINT IS NOT TO SHORTEN IT. The released product's nearest surface is
 * Export's send preflight: four checks and a confirm. The target's answer to
 * a Final Validation is not a fifth check — it is the whole specification,
 * kept long, and given the three things that make a long professional
 * document usable: a sticky index with a status per entry, a status per
 * section, and an exact return-to-edit route on every finding.
 *
 * "A long review is grouped/scannable, not truncated into a superficial
 * recap" is the requirement in the ticket's own words, and a recap is
 * exactly what a capability like this makes tempting. So the anatomy has no
 * summary slot at all: the index IS the overview.
 *
 * THE INDEX IS A NAV, NOT A TABLIST. Every section stays mounted and the
 * page scrolls; the index moves focus to a heading. A tablist would unmount
 * eleven of twelve sections, and "the reviewer read all twelve" would then
 * be a claim about a document that was never on screen.
 *
 * FOCUS IS NEVER TRAPPED. The index is a list of links to headings in the
 * same document (`ReviewIndex`), and the headings are focusable
 * (`tabIndex={-1}`) so a jump lands somewhere a screen reader announces —
 * which is the difference between a jump and a silent scroll.
 */

export type ReviewSectionState = 'ISSUE' | 'PENDING' | 'STALE' | 'REVIEWED'

const STATE_TONE: Readonly<Record<ReviewSectionState, SemanticStatusTone>> = {
  ISSUE: 'error',
  PENDING: 'neutral',
  STALE: 'stale',
  REVIEWED: 'ok',
}

export type ReviewIndexEntry = {
  id: string
  label: string
  /** The worst state among the sections beneath this entry. */
  state: ReviewSectionState
  stateLabel: string
  /** How many sections this entry stands for, when it stands for several. */
  count?: { reviewed: number; total: number }
  onSelect: () => void
  /** `true` while the reader is inside this entry's sections. */
  current?: boolean
}

/**
 * The index. Sticky at 1440; at 1280 the same list, above the review rather
 * than beside it — a second full-height rail beside a long document would
 * compete with the document for the reader's eye, which is the "competing
 * sticky regions" the `ContextRail` contract forbids.
 */
export function ReviewIndex({ label, entries, progressLabel }: {
  label: string
  entries: readonly ReviewIndexEntry[]
  /** e.g. "9 von 12 geprüft". The count, not a percentage. */
  progressLabel: string
}) {
  return (
    <nav className="a3-rvi" aria-label={label}>
      <p className="a3-rvi-progress">{progressLabel}</p>
      <ul className="a3-rvi-list">
        {entries.map((entry) => (
          <li key={entry.id} className="a3-rvi-item">
            <button
              type="button"
              className="a3-rvi-link hit-target"
              aria-current={entry.current ? 'true' : undefined}
              onClick={entry.onSelect}
            >
              <span className="a3-rvi-state" aria-hidden="true">
                {entry.state === 'REVIEWED' ? '✓'
                  : entry.state === 'ISSUE' ? '!'
                    : entry.state === 'STALE' ? '▲' : '○'}
              </span>
              <span className="a3-rvi-label">{entry.label}</span>
              {/* The state travels in the accessible name, not in the glyph:
                  a tick nobody can hear is colour-only meaning with extra
                  steps (rule 8). */}
              <span className="sr-only">{` · ${entry.stateLabel}`}</span>
              {entry.count && (
                <span className="a3-rvi-count numeric">
                  {`${entry.count.reviewed}/${entry.count.total}`}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export type ReviewSectionIssue = {
  id: string
  tone: SemanticStatusTone
  label: string
  reason?: string
  /** The exact edit route. An issue without one is a dead end. */
  route?: { label: string; onSelect: () => void }
}

/**
 * One section of the review.
 *
 * `rows` are the facts, read from their own authority and printed as a
 * definition list — a section that stored its own copy of a total would be a
 * second total (this ticket's data invariant). `acknowledge` is the explicit
 * "I have read this", and it is absent while the section carries a blocker:
 * marking a section read whose own content is not yet valid is precisely the
 * "complete means reviewed" conflation this stage exists to remove.
 */
export function ReviewSection({
  id, title, state, stateLabel, rows, issues, acknowledge, children, focused,
}: {
  id: string
  title: string
  state: ReviewSectionState
  stateLabel: string
  rows?: readonly { id: string; label: string; value: ReactNode }[]
  issues?: readonly ReviewSectionIssue[]
  acknowledge?: ReactNode
  children?: ReactNode
  /** The section an edit route returned to. Receives focus once. */
  focused?: boolean
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  /**
   * The return route lands ON this section, ONCE, when the review mounts.
   *
   * Read from a ref seeded with the initial value rather than from the prop:
   * `focused` also tracks the section the reader last acknowledged, and
   * focusing on every change would pull focus out of the button they just
   * pressed. Focus moves when the information architecture changes — coming
   * back from an edit route is that; ticking a section is not.
   *
   * `autoFocus` on a heading is not a substitute: React honours it for form
   * controls, and a `<h3>` is not one, so the attribute renders and nothing
   * receives focus.
   *
   * DEFERRED BY ONE TICK, deliberately. The application shell moves focus to
   * the page heading on every navigation — the right default, and it runs
   * after this child effect because a parent's effects run last. A return
   * route that landed on the page heading instead of the section would be
   * the reader losing their place in a twelve-section document, which is
   * exactly what the route exists to prevent, so this claims focus after
   * that default has been applied rather than competing with it.
   */
  const landHere = useRef(focused)
  useEffect(() => {
    if (!landHere.current) return
    const id = setTimeout(() => headingRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [])
  return (
    <section
      className="a3-rvs"
      id={id}
      data-state={state}
      aria-labelledby={`${id}-heading`}
    >
      <div className="a3-rvs-head">
        <h3
          className="a3-rvs-title"
          id={`${id}-heading`}
          ref={headingRef}
          tabIndex={-1}
        >
          {title}
        </h3>
        <SemanticStatus tone={STATE_TONE[state]} label={stateLabel} size="compact" />
      </div>

      {rows && rows.length > 0 && (
        <dl className="a3-rvs-rows">
          {rows.map((row) => (
            <div key={row.id} className="a3-rvs-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {issues && issues.length > 0 && (
        <ul className="a3-rvs-issues">
          {issues.map((issue) => (
            <li key={issue.id} className="a3-rvs-issue">
              <SemanticStatus tone={issue.tone} label={issue.label} reason={issue.reason} as="div" />
              {issue.route && (
                <button
                  type="button"
                  className="a3-rvs-route hit-target"
                  onClick={issue.route.onSelect}
                >
                  {issue.route.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {acknowledge && <div className="a3-rvs-ack">{acknowledge}</div>}
    </section>
  )
}

/**
 * The review's own shell: the index beside the sections, and one dock at the
 * end for the confirmation.
 *
 * The dock is at the END rather than pinned: a confirmation that follows the
 * reader down a twelve-section document invites confirming without reading,
 * and the whole reason this stage exists is that "complete" used to mean
 * "reviewed" without anybody having read anything.
 */
export function ValidationReview({ index, sections, dock, sectionsLabel }: {
  index: ReactNode
  sections: ReactNode
  dock?: ReactNode
  sectionsLabel: string
}) {
  return (
    <div className="a3-rvw">
      <div className="a3-rvw-body">
        <div className="a3-rvw-index">{index}</div>
        <div className="a3-rvw-sections" aria-label={sectionsLabel} role="group">
          {sections}
        </div>
      </div>
      {dock && <div className="a3-rvw-dock">{dock}</div>}
    </div>
  )
}
