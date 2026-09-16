import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
/*
 * Der Zählstand steht NICHT mehr über dem Index (Owner, 16.09.2026).
 * „0 von 10 geprüft" war der dritte Ort derselben Aussage: der Status am
 * Bogenkopf sagt sie, jeder Eintrag trägt seinen eigenen Zustand, und der
 * Index ist eine Wegliste, keine Fortschrittsanzeige. Die Zahl selbst ist
 * nicht verschwunden — `vr3.review.status.progress` steht weiterhin am
 * Kopf des Bogens.
 *
 * Aus demselben Grund trägt ein Eintrag seit dem 16.09.2026 auch keinen
 * eigenen Zählstand („0/3") mehr: er stand neben dem Zustand, den derselbe
 * Eintrag bereits führt, und zählte dieselben Abschnitte ein viertes Mal.
 */
export function ReviewIndex({ label, entries }: {
  label: string
  entries: readonly ReviewIndexEntry[]
}) {
  return (
    <nav className="a3-rvi" aria-label={label}>
      <ul className="a3-rvi-list">
        {entries.map((entry) => (
          <li key={entry.id} className="a3-rvi-item">
            <button
              type="button"
              className="a3-rvi-link hit-target"
              aria-current={entry.current ? 'true' : undefined}
              onClick={entry.onSelect}
            >
              {/* Der unberührte Zustand trägt KEIN Zeichen mehr. Ein Kreis
                  vor jedem noch nicht gelesenen Abschnitt sagte nichts, was
                  das Fehlen des Hakens nicht schon sagt, und in einer
                  langen Liste war er die auffälligste Marke von allen. Die
                  Spalte bleibt reserviert, damit das Erscheinen des Hakens
                  die Beschriftungen nicht verschiebt (Regel 24). */}
              <span className="a3-rvi-state" aria-hidden="true">
                {entry.state === 'REVIEWED' ? '✓'
                  : entry.state === 'ISSUE' ? '!'
                    : entry.state === 'STALE' ? '▲' : ''}
              </span>
              <span className="a3-rvi-label">{entry.label}</span>
              {/* The state travels in the accessible name, not in the glyph:
                  a tick nobody can hear is colour-only meaning with extra
                  steps (rule 8). */}
              <span className="sr-only">{` · ${entry.stateLabel}`}</span>
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
 * One item behind a summary row: a real decision, its current answer, and
 * the route to the control that owns it.
 */
export type ReviewSectionDetailItem = Readonly<{
  id: string
  label: string
  value: ReactNode
  /**
   * The exact edit route of THIS item. Absent where the product has no
   * control to route to — the item is then read-only in the review, and
   * shows nothing rather than a button that would go nowhere.
   */
  edit?: Readonly<{ label: string; onSelect: () => void }>
}>

/**
 * THE SUMMARY STAYS, AND OPENS (owner, 16.09.2026).
 *
 * `22 gewählt · 2 von 2 entschieden` is a true sentence about a list nobody
 * could see: the reader had to leave the review, find the chapter, and open
 * each system to learn WHICH services are in it. `details` adds the list
 * under the sentence — it never replaces it, because the count is what
 * makes the section scannable and the list is what makes it checkable.
 */
export type ReviewSectionRowDetails = Readonly<{
  /** Announced on the toggle in place of a bare chevron: it names what opens. */
  expandLabel: string
  collapseLabel: string
  items: readonly ReviewSectionDetailItem[]
}>

export type ReviewSectionRow = Readonly<{
  id: string
  label: string
  value: ReactNode
  details?: ReviewSectionRowDetails
}>

/**
 * A summary row that opens.
 *
 * THE TOGGLE IS THE ROW'S VALUE, not a chevron beside it: the sentence a
 * reader wants to open is the sentence they point at. It is a real
 * `<button>` with `aria-expanded`/`aria-controls` (rule 22), the disclosure
 * state is this component's own — nothing about a reading posture belongs in
 * the journal or the store (M-4) — and `Esc` closes the list and returns
 * focus to the toggle, so the keyboard has the same way out as the pointer.
 *
 * EVERY ITEM'S EDIT BUTTON IS ALWAYS IN THE DOM AND ALWAYS FOCUSABLE. It is
 * revealed by pointer hover, by focus inside its own row, and unconditionally
 * where the device has no hover at all (`@media (hover: none)`) — a control
 * that only appears under a mouse pointer does not exist for a keyboard or a
 * touch screen. Its column is reserved whether it is visible or not, so
 * revealing it moves nothing (rule 24).
 */
function ReviewSectionDetailRow({ row, details }: {
  row: ReviewSectionRow
  details: ReviewSectionRowDetails
}) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const listId = `${useId()}-details`
  return (
    <div className="a3-rvs-row a3-rvs-row-open" data-open={open ? 'true' : 'false'}>
      <dt>{row.label}</dt>
      <dd>
        <button
          type="button"
          ref={toggleRef}
          className="a3-rvs-disclose hit-target"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="a3-rvs-disclose-value">{row.value}</span>
          {/* The glyph is decorative; the state travels in `aria-expanded`
              and the action in the accessible name (rule 8). */}
          <span className="a3-rvs-disclose-mark" aria-hidden="true">{open ? '−' : '+'}</span>
          <span className="sr-only">{` · ${open ? details.collapseLabel : details.expandLabel}`}</span>
        </button>
        <div
          id={listId}
          className="a3-rvs-details"
          hidden={!open}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setOpen(false)
            toggleRef.current?.focus()
          }}
        >
          <ul className="a3-rvs-detail-list">
            {details.items.map((item) => (
              <li key={item.id} className="a3-rvs-detail">
                <span className="a3-rvs-detail-label">{item.label}</span>
                <span className="a3-rvs-detail-value">{item.value}</span>
                <span className="a3-rvs-detail-action">
                  {item.edit && (
                    <button
                      type="button"
                      className="a3-rvs-edit hit-target"
                      onClick={item.edit.onSelect}
                    >
                      {item.edit.label}
                      {/* `Bearbeiten` five times in a list is five buttons
                          with the same accessible name. The item's own name
                          travels with it, unheard by the eye and read by the
                          screen reader — the same device the index uses for
                          its state. */}
                      <span className="sr-only">{` · ${item.label}`}</span>
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </dd>
    </div>
  )
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
  rows?: readonly ReviewSectionRow[]
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
        {/*
          * DER RUHIGE ZUSTAND TRÄGT KEIN ABZEICHEN MEHR (Owner, 16.09.2026).
          *
          * „noch zu prüfen" stand an jedem ungelesenen Abschnitt und sagte
          * nur, dass der Leser noch nicht unten angekommen ist — dreizehn
          * Mal dasselbe. Ein Befund und ein veralteter Abschnitt behalten
          * ihr Abzeichen: dort ist der farbige Rand sonst der einzige
          * Träger der Aussage, und Zustand allein durch Farbe ist verboten
          * (Regel 8). Für die Vorlesesoftware bleibt der Zustand in jedem
          * Fall am Abschnitt.
          */}
        {state === 'ISSUE' || state === 'STALE' ? (
          <SemanticStatus tone={STATE_TONE[state]} label={stateLabel} size="compact" />
        ) : (
          <span className="sr-only">{stateLabel}</span>
        )}
      </div>

      {rows && rows.length > 0 && (
        <dl className="a3-rvs-rows">
          {rows.map((row) => (
            row.details
              ? <ReviewSectionDetailRow key={row.id} row={row} details={row.details} />
              : (
                <div key={row.id} className="a3-rvs-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              )
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
