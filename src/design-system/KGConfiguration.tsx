import { useId, type ReactNode } from 'react'
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * The canonical KG Configuration page (VR3-03, targets T-021–T-027).
 *
 * SIX INSTANCES OF ONE PAGE — the whole point of the ticket. Before this,
 * KG 300 had a three-region stage with a facade showcase, KG 400 had an
 * option-group list with an energy banner, KG 700 had a method switch with
 * its own five-region grid, and KG 200/500/600 shared a fourth grammar. The
 * audit's finding (F-008): "Knowledge learned in one KG does not reliably
 * transfer to another." Here the anatomy is fixed and only the DOMAIN
 * CONTENT differs, so learning one KG is learning all six.
 *
 * The page owns: identity and scope context, progress and validation,
 * group navigation, service rows with progressive detail, the building
 * context panel where building ownership matters, and previous/next. The
 * commercial rail is NOT part of it — it is the shell's, because it must
 * survive the navigation between chapters.
 *
 * COMPLETION IS NOT A BUTTON. `nextAction` continues the journey; whether
 * the chapter is complete is derived from the domain
 * (`engine/kgConfiguration.ts`) and shown, never asserted by pressing it.
 */

export type KgGroupNavItem = {
  id: string
  label: string
  /** Decisions this group still needs, so the index is a to-do, not a menu. */
  outstanding: number
  count: number
  current?: boolean
  onSelect: () => void
}

export function KGConfigurationPage({
  identity, title, lead, progress, groupNav, children, context,
  previousAction, nextAction, notice,
}: {
  /** `CONFIGURATOR · KG 400` — position before name, as the target does. */
  identity: string
  title: string
  lead: string
  /** `3 von 4 Gruppen vollständig`, with its own tone. */
  progress: { tone: SemanticStatusTone; label: string }
  groupNav?: readonly KgGroupNavItem[]
  children: ReactNode
  /** The building/scope context panel. Absent when nothing owns it. */
  context?: ReactNode
  previousAction?: ReactNode
  nextAction?: ReactNode
  /** A dependency or validation notice that belongs to the whole chapter. */
  notice?: ReactNode
}) {
  return (
    <div className="a3-kgp">
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
          <p className="a3-cap">{identity}</p>
          <h1 className="a3-kgp-title" data-page-heading tabIndex={-1}>{title}</h1>
          <p className="a3-lede">{lead}</p>
        </div>
        <div className="a3-kgp-progress">
          <SemanticStatus tone={progress.tone} label={progress.label} />
        </div>
      </div>
      {notice}
      {groupNav && groupNav.length > 1 && (
        <nav className="a3-kgp-groupnav" aria-label={identity}>
          <ul>
            {groupNav.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="a3-kgp-groupnav-item"
                  aria-current={item.current ? 'true' : undefined}
                  data-outstanding={item.outstanding > 0 || undefined}
                  onClick={item.onSelect}
                >
                  <span className="a3-kgp-groupnav-label">{item.label}</span>
                  {/* A group with no required decision has no count worth
                      printing: "0/0" is a ratio of nothing and reads as
                      unfinished work that does not exist. */}
                  {item.count > 0 && (
                    <span className="a3-kgp-groupnav-count">
                      {item.count - item.outstanding}/{item.count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="a3-kgp-stage">
        <section className="a3-kgp-services" aria-label={title}>{children}</section>
        {context && <aside className="a3-kgp-context">{context}</aside>}
      </div>
      {(previousAction || nextAction) && (
        <footer className="a3-kgp-dock">
          <div>{previousAction}</div>
          <div>{nextAction}</div>
        </footer>
      )}
    </div>
  )
}

/**
 * ServiceGroup — a scannable band of service rows.
 *
 * The heading carries the number of decisions the group holds, because a
 * group of four decisions and a group of twelve deserve different attention
 * and the count is the cheapest way to say which one you are looking at.
 */
export function ServiceGroup({
  id, label, decisionCount, decisionsLabel, children,
}: {
  id: string
  label: string
  decisionCount: number
  /** e.g. `4 Entscheidungen` — interpolated by the caller (rule 36). */
  decisionsLabel: string
  children: ReactNode
}) {
  const headingId = `svcg-${id}`
  return (
    <section className="a3-svcg" aria-labelledby={headingId}>
      <h2 className="a3-svcg-head" id={headingId}>
        <span className="a3-svcg-label">{label}</span>
        <span className="a3-svcg-count">{decisionsLabel}</span>
      </h2>
      <ul className="a3-svcg-rows">{children}</ul>
      {decisionCount === 0 && <p className="a3-cap a3-svcg-empty" />}
    </section>
  )
}

/**
 * The supported decision shapes — and there are exactly these.
 *
 * A new KG cannot introduce a seventh: the row renders the control from this
 * union, so the "same interaction contract in every KG" is a type, not a
 * convention someone has to remember.
 */
export type ServiceDecisionControl =
  /**
   * A service the domain does NOT demand an explicit decision on: it is in
   * the offer or it is not, and there is no third state to express. A single
   * checkbox with a persistent label is the whole truth, and it is what
   * keeps a list of a dozen services scannable — the two-option control
   * below costs four times the width and would buy an "undecided" state
   * that cannot occur here.
   *
   * This is still an explicit recorded choice with a journal entry and an
   * inverse, never a `Switch`: the design-system delta reserves `Switch`
   * for an immediately reversible preference, which a priced service is not.
   */
  | {
    kind: 'toggle'
    checked: boolean
    label: string
    onToggle: (checked: boolean) => void
    onPreview?: (checked: boolean | null) => void
  }
  /** Include or exclude, with a real undecided zero-state. */
  | {
    kind: 'choice'
    value: 'included' | 'excluded' | null
    includeLabel: string
    excludeLabel: string
    onDecide: (decision: 'included' | 'excluded') => void
    onPreview?: (decision: 'included' | 'excluded' | null) => void
  }
  /** One of several configured variants. */
  | {
    kind: 'variant'
    value: string | null
    options: ReadonlyArray<ChoiceOption<string>>
    onDecide: (value: string) => void
    onPreview?: (value: string | null) => void
  }
  /** A service the domain requires and the user cannot remove. */
  | { kind: 'readOnly'; label: string }

export function ServiceDecisionRow({
  name, summary, control, controlLegend, status, amount, detail, detailToggle,
  invalid, warning, buildingLabel, authorityLabel,
}: {
  name: string
  summary: string
  control: ServiceDecisionControl
  /** Names the decision for assistive tech; the row heading names it visibly. */
  controlLegend: string
  status: { tone: SemanticStatusTone; label: string }
  /** The signed contribution, or the absence marker. */
  amount: ReactNode
  detail?: ReactNode
  detailToggle?: { label: string; open: boolean; onToggle: () => void }
  invalid?: boolean
  /** A caveat that belongs to THIS service and travels with it. */
  warning?: string
  /** Which building this service belongs to, when one does. */
  buildingLabel?: string
  authorityLabel?: string
}) {
  const warningId = useId()
  return (
    <li className="a3-svcr" data-invalid={invalid || undefined}>
      <div className="a3-svcr-main">
        <div className="a3-svcr-identity">
          <span className="a3-svcr-name">{name}</span>
          <span className="a3-svcr-summary">{summary}</span>
          {(buildingLabel || authorityLabel) && (
            <span className="a3-svcr-meta">
              {[buildingLabel, authorityLabel].filter(Boolean).join(` · `)}
            </span>
          )}
        </div>
        <div className="a3-svcr-control">
          {control.kind === 'readOnly' ? (
            <span className="a3-svcr-readonly">{control.label}</span>
          ) : control.kind === 'toggle' ? (
            <label
              className="a3-svcr-toggle"
              onMouseEnter={() => control.onPreview?.(!control.checked)}
              onMouseLeave={() => control.onPreview?.(null)}
            >
              <input
                type="checkbox"
                checked={control.checked}
                aria-describedby={warning ? warningId : undefined}
                onChange={(event) => control.onToggle(event.target.checked)}
              />
              <span>{control.label}</span>
            </label>
          ) : control.kind === 'choice' ? (
            <ChoiceGroup
              legend={controlLegend}
              legendHidden
              density="compact"
              invalid={invalid}
              describedBy={warning ? warningId : undefined}
              value={control.value}
              onChange={control.onDecide}
              onPreview={control.onPreview}
              options={[
                { value: 'included' as const, label: control.includeLabel },
                { value: 'excluded' as const, label: control.excludeLabel },
              ]}
            />
          ) : (
            <ChoiceGroup
              legend={controlLegend}
              legendHidden
              density="compact"
              invalid={invalid}
              describedBy={warning ? warningId : undefined}
              value={control.value}
              onChange={control.onDecide}
              onPreview={control.onPreview}
              options={control.options}
            />
          )}
        </div>
        <div className="a3-svcr-status">
          <SemanticStatus tone={status.tone} label={status.label} />
        </div>
        <div className="a3-svcr-amount">{amount}</div>
      </div>
      {warning && <p id={warningId} className="a3-svcr-warning">{warning}</p>}
      {/* Detail opens only once the service is relevant — a giant card or a
          dialog detour would take the user off the decision they are making. */}
      {detailToggle && (
        <p className="a3-svcr-detail-toggle">
          <button
            type="button"
            className="a3-linkbtn"
            aria-expanded={detailToggle.open}
            onClick={detailToggle.onToggle}
          >
            {detailToggle.label}
          </button>
        </p>
      )}
      {detailToggle?.open && detail}
    </li>
  )
}

/**
 * ServiceDetailPanel — progressive detail, in place.
 *
 * In place, and never a dialog: the decision it configures is two lines
 * above it, and a modal would hide the very row whose consequence the user
 * is reading.
 */
export function ServiceDetailPanel({
  fields, dependency, children,
}: {
  fields?: ReadonlyArray<{ label: string; value: ReactNode }>
  /** The upstream service this one waits on, with the route to it. */
  dependency?: { message: string; action?: { label: string; onSelect: () => void } }
  children?: ReactNode
}) {
  return (
    <div className="a3-svcd">
      {fields && fields.length > 0 && (
        <dl className="a3-svcd-fields">
          {fields.map((field) => (
            <div className="a3-svcd-field" key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {dependency && (
        <p className="a3-svcd-dependency">
          <span>{dependency.message}</span>
          {dependency.action && (
            <button
              type="button"
              className="a3-linkbtn"
              onClick={dependency.action.onSelect}
            >
              {dependency.action.label}
            </button>
          )}
        </p>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   VR3-TGA-01 · the source-aware system configurator
   ══════════════════════════════════════════════════════════════════════════

   THE CHAPTER STOPPED BEING A LIST OF POSITIONS.

   The forensic audit measured KG 400 rendering five rows against a source of
   72 parameters, and the three rows carrying the entire subtotal offering no
   technical alternative at all: the product asked *shall we include heating?*
   where the source asked *which heating system?*.

   The composition below answers the second question. It is `Rahmen ·
   Übersicht · System`: a band of the conditions everything depends on, a list
   of the eight canonical systems, and one system open in place at a time.

   ONE COMPOSITION, SIX CHAPTERS — STILL. Every part of this is driven by what
   the chapter's own data declares. A KG chapter that declares no Rahmen
   renders no band, one that declares no system metadata renders the released
   service group, and `KgChapter.tsx` still contains no `switch (group)`.
*/

/**
 * The Rahmen band — the conditions every decision below depends on.
 *
 * Context, NOT a second configuration form. Three of its four lines are
 * read-only; the one that is a decision says so by offering an action, and
 * opening it reveals the same decision composition used everywhere else
 * rather than a private editor.
 */
export function RahmenBand({ entries, children }: {
  entries: ReadonlyArray<{
    id: string
    label: string
    value: string
    meta: string
    /** Present only where the line is genuinely editable. */
    action?: { label: string; expanded: boolean; onToggle: () => void }
  }>
  /** The expanded decision, when one is open. */
  children?: ReactNode
}) {
  if (entries.length === 0) return null
  return (
    <section className="a3-rahmen" aria-label={entries.map((e) => e.label).join(' · ')}>
      <dl className="a3-rahmen-grid">
        {entries.map((entry) => (
          <div className="a3-rahmen-cell" key={entry.id}>
            <dt className="a3-rahmen-key">{entry.label}</dt>
            <dd className="a3-rahmen-val">{entry.value}</dd>
            <dd className="a3-rahmen-meta">{entry.meta}</dd>
            {entry.action && (
              <dd className="a3-rahmen-act">
                <button
                  type="button"
                  className="a3-linkbtn hit-target"
                  aria-expanded={entry.action.expanded}
                  onClick={entry.action.onToggle}
                >
                  {entry.action.label}
                </button>
              </dd>
            )}
          </div>
        ))}
      </dl>
      {children}
    </section>
  )
}

/** The one summary line above the systems. Every number is actionable. */
export function SystemOverviewSummary({ facts, total }: {
  facts: ReadonlyArray<{ id: string; count: number; label: string }>
  /** `KG 400 · 1.390.000 €`, or the honest absence of a total. */
  total: ReactNode
}) {
  return (
    <p className="a3-sysum">
      {facts.map((fact, index) => (
        <span className="a3-sysum-fact" key={fact.id}>
          {index > 0 && <span className="a3-sysum-sep" aria-hidden="true">·</span>}
          <b className="a3-sysum-count">{fact.count}</b>
          <span>{fact.label}</span>
        </span>
      ))}
      <span className="a3-sysum-total">{total}</span>
    </p>
  )
}

export type SystemRowState =
  'decided' | 'fromSource' | 'open' | 'partial' | 'notApplicable'

/**
 * One system in the overview — a button that opens in place.
 *
 * A `<button aria-expanded>` controlling a region, not a link and not a
 * navigation: the audit rejected drill-down precisely because it costs a
 * navigation on every visit, and because the chapter's value is being able to
 * see the other seven systems while deciding one.
 *
 * A not-applicable system is PRESENT and states its cause. It is not hidden,
 * because "why is there no drainage decision?" is a question the salesperson
 * will otherwise ask a colleague.
 */
export function SystemRow({
  id, name, summary, scope, state, stateLabel, stateGlyph, commercial,
  expanded, onToggle, children,
}: {
  id: string
  name: string
  /** What is proposed, in one line. */
  summary: string
  /** `gilt für 1 Gebäude`, `gemeinsame Anlage · Verteilung je Gebäude`. */
  scope?: string
  state: SystemRowState
  /** The state in WORDS — never colour alone (rule 8). */
  stateLabel: string
  /** The state's glyph, paired with the word, never replacing it. */
  stateGlyph: string
  /** An amount, or the cost state in words. Never a bare zero. */
  commercial: ReactNode
  expanded: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  const bodyId = `sysbody-${id}`
  const applicable = state !== 'notApplicable'
  return (
    <section className="a3-sys" data-state={state}>
      <h3 className="a3-sys-h">
        <button
          type="button"
          className="a3-sys-btn hit-target"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="a3-sys-tw" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <span className="a3-sys-id">
            <span className="a3-sys-name">{name}</span>
            <span className="a3-sys-meta">{summary}</span>
            {scope && applicable && <span className="a3-sys-scope">{scope}</span>}
          </span>
          <span className="a3-sys-state">
            <span className="a3-sys-glyph" aria-hidden="true">{stateGlyph}</span>
            {stateLabel}
          </span>
          <span className="a3-sys-cost">{commercial}</span>
        </button>
      </h3>
      <div id={bodyId} className="a3-sys-body" hidden={!expanded}>
        {expanded && children}
      </div>
    </section>
  )
}

/**
 * The canonical decision composition.
 *
 * Everything the audit's silent-demo test asks of one row, in the order a
 * salesperson reads it: what the client documents said, what All3 proposes,
 * what else is available, what is unavailable and why, what it costs, and
 * what the offer will say. Progressive by construction — a block renders only
 * the parts its own data declares.
 */
export function DecisionBlock({
  name, scope, source, proposal, why, control, valueRows, price, note, rule,
  changedFromSource, matchesSource, restore, notApplicable,
}: {
  name: string
  scope?: string
  /** What the CLIENT DOCUMENTS said, with its provenance control. */
  source?: { label: string; value: string; origin?: ReactNode }
  /** What All3 currently proposes, stated before the control. */
  proposal?: { label: string; value: ReactNode }
  why?: string
  control?: ReactNode
  valueRows?: ReactNode
  /** The commercial consequence in the vocabulary its authority permits. */
  price?: { label: string; value: string; muted?: boolean; origin?: ReactNode }
  /** What the Offer will say, and where. */
  note?: string
  rule?: ReactNode
  /** `Vom Quell-Dokument abweichend`, with the way back. */
  changedFromSource?: string
  /** The quiet opposite: the documented solution is being retained. */
  matchesSource?: string
  restore?: { label: string; onRestore: () => void }
  /** A statement WITH A CAUSE — never an option named `Keine …`. */
  notApplicable?: string
}) {
  return (
    <div className="a3-dec" data-na={notApplicable ? true : undefined}>
      <div className="a3-dec-head">
        <span className="a3-dec-name">{name}</span>
        {scope && <span className="a3-dec-scope">{scope}</span>}
      </div>
      {notApplicable ? (
        <p className="a3-dec-na">{notApplicable}</p>
      ) : (
        <>
          {source && (
            <p className="a3-dec-src">
              <span className="a3-dec-srck">{source.label}</span>
              <span className="a3-dec-srcv">{source.value}</span>
              {source.origin}
            </p>
          )}
          {proposal && (
            <p className="a3-dec-prop">
              <span className="a3-dec-propk">{proposal.label}</span>
              <span className="a3-dec-propv">{proposal.value}</span>
            </p>
          )}
          {matchesSource && (
            <p className="a3-dec-matches">
              <span className="a3-dec-matches-mark" aria-hidden="true">✓</span>
              <span>{matchesSource}</span>
            </p>
          )}
          {changedFromSource && (
            <p className="a3-dec-changed">
              <span className="a3-dec-changed-mark" aria-hidden="true">↻</span>
              <span>{changedFromSource}</span>
              {restore && (
                <button
                  type="button"
                  className="a3-linkbtn hit-target"
                  onClick={restore.onRestore}
                >
                  {restore.label}
                </button>
              )}
            </p>
          )}
          {why && <p className="a3-dec-why">{why}</p>}
          {control}
          {valueRows}
          {price && (
            <p className="a3-dec-price">
              <span className="a3-dec-pricek">{price.label}</span>
              <span
                className="a3-dec-pricev"
                data-muted={price.muted || undefined}
              >
                {price.value}
              </span>
              {price.origin}
            </p>
          )}
          {rule}
          {note && <p className="a3-dec-note">{note}</p>}
        </>
      )}
    </div>
  )
}

/**
 * A value set inside ONE decision.
 *
 * Three buildings produce three values here, never nine rows in the overview,
 * and the building name appears exactly once. The same component carries the
 * per-medium responsibility set of `Hausanschlüsse`, where each row's status
 * is a word beside a glyph rather than a colour.
 */
export function DecisionValueRows({ rows }: {
  rows: ReadonlyArray<{
    id: string
    label: string
    value: string
    /** A formatted amount, or the word that honestly stands in for one. */
    amount?: ReactNode
    status?: { glyph: string; label: string; tone: 'ok' | 'attention' }
    notApplicable?: boolean
  }>
}) {
  if (rows.length === 0) return null
  return (
    <ul className="a3-vrows">
      {rows.map((row) => (
        <li
          className="a3-vrow"
          key={row.id}
          data-na={row.notApplicable || undefined}
        >
          <span className="a3-vrow-k">{row.label}</span>
          <span className="a3-vrow-v">{row.value}</span>
          <span className="a3-vrow-a">
            {row.status ? (
              <span className="a3-vrow-st" data-tone={row.status.tone}>
                <span aria-hidden="true">{row.status.glyph}</span>
                {row.status.label}
              </span>
            ) : row.amount}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * A cross-system rule, stated ONCE and referenced.
 *
 * The §14a rule touches heat, e-mobility and storage. Restating it on each of
 * them is how three screens come to disagree about the same law; this renders
 * the one rule object the chapter declares, wherever it is referenced.
 */
export function SystemRuleNote({ title, body, note, source }: {
  title: string
  body: string
  note?: string
  source: string
}) {
  return (
    <aside className="a3-srule">
      <p className="a3-srule-k">{title}</p>
      <p className="a3-srule-b">{body}</p>
      {note && <p className="a3-srule-n">{note}</p>}
      <p className="a3-srule-s">{source}</p>
    </aside>
  )
}

/** The later-specification boundary — a statement, never a ninth system. */
export function BemusterungBoundary({
  title, body, decidedHeading, deferredHeading, rows, detail,
}: {
  title: string
  body: string
  decidedHeading: string
  deferredHeading: string
  rows: ReadonlyArray<{ decided: string; deferred: string }>
  /**
   * The two-column detail is PROGRESSIVE.
   *
   * The boundary's job at the foot of the chapter is to answer "is this
   * decided here or later?" — one sentence. Frame T-01 draws exactly that;
   * the full mapping belongs to the reader who asks for it, and rendering it
   * unconditionally costs the overview a fifth of its height for a table
   * nobody scrolls to.
   */
  detail?: { label: string; open: boolean; onToggle: () => void }
}) {
  return (
    <section className="a3-bem" aria-label={title}>
      <h3 className="a3-bem-h">{title}</h3>
      <p className="a3-bem-b">{body}</p>
      {detail && rows.length > 0 && (
        <p className="a3-bem-toggle">
          <button
            type="button"
            className="a3-linkbtn hit-target"
            aria-expanded={detail.open}
            onClick={detail.onToggle}
          >
            {detail.label}
          </button>
        </p>
      )}
      {rows.length > 0 && (!detail || detail.open) && (
        <table className="a3-bem-t">
          <thead>
            <tr>
              <th scope="col">{decidedHeading}</th>
              <th scope="col">{deferredHeading}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.decided}>
                <td>{row.decided}</td>
                <td>{row.deferred}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
