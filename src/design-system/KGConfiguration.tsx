import { useId, type ReactNode } from 'react'
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'
import { Button } from '../components/primitives'

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
  previousAction, nextAction, notice, variant,
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
  /**
   * `systems` — the page carries a system configurator (VR3-TGA-UX-00) and
   * composes its head and dock tighter; the anatomy is unchanged.
   */
  variant?: 'systems'
}) {
  return (
    <div className="a3-kgp" data-variant={variant}>
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
  /**
   * A value this chapter SHOWS but does not own (B2, requirement 14).
   *
   * `owner` is the route back to the decision that does own it. It exists
   * because a read-only row without one is the defect the audit measured
   * from the other side: a value editable in two chapters has two answers,
   * and a value editable in NEITHER is a dead end. Naming the owner turns
   * the read-only row into a route (rule 12) instead of a wall.
   */
  | {
    kind: 'readOnly'
    label: string
    owner?: { label: string; onSelect: () => void }
  }

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
            <span className="a3-svcr-readonly">
              {control.label}
              {control.owner ? (
                <button
                  type="button"
                  className="a3-svcr-owner hit-target"
                  onClick={control.owner.onSelect}
                >
                  {control.owner.label}
                </button>
              ) : null}
            </span>
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
   VR3-TGA-01 → VR3-TGA-UX-00 · the friendly engineering-solution configurator
   ══════════════════════════════════════════════════════════════════════════

   THE CHAPTER ANSWERS ONE QUESTION: which engineering solution are we
   proposing for this Option?

   VR3-TGA-01 made KG 400 a source-aware system configurator and got the
   semantics right — eight systems, a source baseline beside every proposal,
   cost authority on every euro. The UX audit (`docs/audit/
   kg400-friendly-3bfb0bc/`) measured what it cost: a configured chapter of
   1,214 px in which decided choices still looked like open forms, every
   alternative set stayed expanded, source and proposal were repeated even
   when identical, and regulation sat beside the control. The composition
   below keeps every one of those semantics and moves the weight:

   - the overview is seven COMPACT ROWS — pictogram, system, current solution
     (one strong line, one quiet line), one dominant state, local price;
   - ONE system is open at a time, as a focused workspace under its row;
   - a DECIDED decision is a summary — name, proposal, source relation, price
     phrase, `Ändern` — and its alternatives are absent from the DOM until
     `Ändern` is pressed; an UNRESOLVED decision opens its editor at once;
   - technical basis, regulation, provenance and price authority live behind
     ONE disclosure, `Grundlage & Herkunft`.

   Attention order is fixed and is the CSS's job to make legible:
   needs decision › changed from source › configured › project-derived ›
   not applicable. Meaning is never colour alone (rule 8).

   STILL ONE COMPOSITION, SIX CHAPTERS. Everything here is driven by what the
   chapter's data declares; `KgChapter.tsx` still contains no `switch (group)`.
*/

/**
 * The Rahmen band — the conditions every decision below depends on.
 *
 * Orientation, not a fifth thing to configure: energy target, building scope,
 * source, scope boundary. An entry's action is either a TOGGLE that opens
 * the decision in place (`expanded` given) or a LINK to the step that owns
 * the value (`expanded` absent) — the scope boundary is read here and edited
 * in Schnittstellen & Verantwortung, never in two places.
 */
export function RahmenBand({ entries, children }: {
  entries: ReadonlyArray<{
    id: string
    label: string
    value: string
    meta?: string
    action?: { label: string; expanded?: boolean; onToggle: () => void; accessibleName?: string }
    /**
     * VR3-KG-UNIFY-00 — a CONTEXT SWITCH that stands in for the value: the
     * building whose decisions a per-building chapter shows. The control
     * names the current value itself, so the text is not repeated beside it.
     */
    control?: ReactNode
  }>
  /** The expanded decision, when one is open. */
  children?: ReactNode
}) {
  if (entries.length === 0) return null
  return (
    <section className="a3-rahmen" aria-label={entries.map((e) => e.label).join(' · ')}>
      <dl className="a3-rahmen-grid">
        {entries.map((entry) => (
          <div className="a3-rahmen-cell" key={entry.id} data-control={entry.control ? true : undefined}>
            <dt className="a3-rahmen-key">{entry.label}</dt>
            <dd className="a3-rahmen-val">
              {entry.control ?? entry.value}
              {entry.action && (
                <button
                  type="button"
                  className="a3-linkbtn a3-rahmen-act"
                  aria-expanded={entry.action.expanded}
                  aria-label={entry.action.accessibleName}
                  onClick={entry.action.onToggle}
                >
                  {entry.action.label}
                </button>
              )}
            </dd>
            {entry.meta && <dd className="a3-rahmen-meta">{entry.meta}</dd>}
          </div>
        ))}
      </dl>
      {children}
    </section>
  )
}

export type SummaryTone = 'ok' | 'warn' | 'quiet'

/**
 * The one summary line above the systems, derived from the canonical
 * overview and never counted twice. A zero fact is not a fact; the caller
 * omits it. Exceptions are the only loud numbers.
 */
export function SystemOverviewSummary({ facts, total }: {
  facts: ReadonlyArray<{ id: string; count: number; label: string; tone?: SummaryTone }>
  /** `KG 400 · 1.390.000 €`, or the honest absence of a total. */
  total: ReactNode
}) {
  return (
    <p className="a3-sysum">
      {facts.map((fact, index) => (
        <span className="a3-sysum-fact" key={fact.id} data-tone={fact.tone}>
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

/** The exception a row carries, if any. Drives the left accent and nothing else. */
export type SystemAttention = 'open' | 'deviation' | null

/**
 * One system in the overview — a compact row that opens in place.
 *
 * A `<button aria-expanded>` controlling a region, not a link: the chapter's
 * value is seeing the other six systems while deciding one. Its accessible
 * name is the SYSTEM AND ITS STATE (`Wärme · konfiguriert`), and the solution
 * line is its description — not a concatenation of every descendant string,
 * which is what a screen-reader user heard before this ticket.
 *
 * A not-applicable system is PRESENT and quiet: it explains project logic
 * ("why is there no drainage decision?") through a one-step `Warum?`
 * disclosure, and it never opens into an empty configuration workspace.
 */
export function SystemRow({
  id, name, pictogram, solution, state, stateLabel, stateGlyph, attention = null,
  commercial, expanded, onToggle, notApplicable, children,
}: {
  id: string
  name: string
  /** The system pictogram — a fixed small identifier, decorative. */
  pictogram?: ReactNode
  /** The current solution: one strong line, one quiet line. */
  solution: { primary: string; secondary?: string }
  state: SystemRowState
  /** The state in WORDS — never colour alone (rule 8). */
  stateLabel: string
  /** The state's glyph, paired with the word, never replacing it. */
  stateGlyph: string
  attention?: SystemAttention
  /** An amount, or the cost state in words. Never a bare zero. */
  commercial: ReactNode
  expanded: boolean
  onToggle: () => void
  /** Present for a not-applicable system: the reason, one step away. */
  notApplicable?: { whyLabel: string; reason: string; open: boolean; onToggle: () => void }
  children?: ReactNode
}) {
  const bodyId = `sysbody-${id}`
  const solutionId = `syssol-${id}`
  const cells = (
    <>
      <span className="a3-sys-pict" aria-hidden="true">{pictogram}</span>
      <span className="a3-sys-name">{name}</span>
      <span className="a3-sys-sol" id={solutionId}>
        <span className="a3-sys-solp">{solution.primary}</span>
        {solution.secondary && <span className="a3-sys-sols">{solution.secondary}</span>}
      </span>
      <span className="a3-sys-state">
        <span className="a3-sys-glyph" aria-hidden="true">{stateGlyph}</span>
        {stateLabel}
      </span>
      <span className="a3-sys-cost">{commercial}</span>
    </>
  )
  if (notApplicable) {
    return (
      <section className="a3-sys" data-state="notApplicable">
        <div className="a3-sys-row">
          {cells}
          <button
            type="button"
            className="a3-linkbtn a3-sys-why"
            aria-expanded={notApplicable.open}
            aria-controls={bodyId}
            aria-label={`${notApplicable.whyLabel} · ${name}`}
            onClick={notApplicable.onToggle}
          >
            {notApplicable.whyLabel}
          </button>
        </div>
        <div id={bodyId} className="a3-sys-nareason" hidden={!notApplicable.open}>
          {notApplicable.open && <p>{notApplicable.reason}</p>}
        </div>
      </section>
    )
  }
  return (
    <section className="a3-sys" data-state={state} data-attention={attention ?? undefined}>
      <h3 className="a3-sys-h">
        <button
          type="button"
          className="a3-sys-btn hit-target"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={`${name} · ${stateLabel}`}
          aria-describedby={solutionId}
          onClick={onToggle}
        >
          {cells}
          <span className="a3-sys-tw" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
      </h3>
      <div id={bodyId} className="a3-sys-body" hidden={!expanded}>
        {expanded && children}
      </div>
    </section>
  )
}

/**
 * The focused system's orientation header: what is proposed, for what scope,
 * at what commercial state — so the user need not reconstruct the system
 * from its decision rows.
 */
export function SystemDetailHeader({ heading, summary, badges }: {
  heading: string
  summary?: string
  badges: readonly string[]
}) {
  return (
    <div className="a3-sysd-head">
      <div className="a3-sysd-id">
        <h4 className="a3-sysd-h" tabIndex={-1}>{heading}</h4>
        {summary && <p className="a3-sysd-sum">{summary}</p>}
      </div>
      {badges.length > 0 && (
        <p className="a3-sysd-badges">
          {badges.map((badge) => <span className="a3-sysd-badge" key={badge}>{badge}</span>)}
        </p>
      )}
    </div>
  )
}

/** The relation a proposal has to the client documents (or the project). */
export type DecisionRelationTone = 'match' | 'changed' | 'missing' | 'project' | 'derived' | 'quiet'

/**
 * ONE decision grammar, every parameter type (decision pattern contract).
 *
 *   DECISION NAME   Current proposal              price phrase   [Ändern]
 *                   source relation
 *   [deviation card]  [value rows]  [editor — edit mode only]
 *   [Grundlage & Herkunft ▸]  [evidence panel]
 *
 * The summary is a statement of current Option truth; the editor is a
 * temporary selection workspace; the evidence is a disclosure, not a third
 * permanent row. A read-only decision simply has no `action`.
 */
export function DecisionRow({
  id, name, current, relation, price, action, deviation, valueRows, editor,
  evidence, attention, muted,
}: {
  id: string
  name: string
  /** The proposal, in one human-readable line. */
  current: string
  relation?: { tone: DecisionRelationTone; label: string; detail?: string }
  /** The local commercial phrase — an amount, or the authority in words. Never a bare zero. */
  price?: string
  /** `Ändern`, where the decision is editable. */
  action?: ReactNode
  /** The explicit, adjacent deviation — never a manual comparison of distant rows. */
  deviation?: { title: string; body: string; restore?: ReactNode }
  valueRows?: ReactNode
  editor?: ReactNode
  evidence?: {
    label: string
    accessibleName: string
    open: boolean
    onToggle: () => void
    children: ReactNode
  }
  attention?: 'open' | 'deviation'
  /** Project-derived and other quiet states recede. */
  muted?: boolean
}) {
  const evidenceId = `evidence-${id}`
  return (
    <li
      className="a3-dec"
      data-decision={id}
      data-attention={attention}
      data-muted={muted || undefined}
    >
      <div className="a3-dec-line">
        <span className="a3-dec-name" data-decision-heading tabIndex={-1}>{name}</span>
        <span className="a3-dec-current">
          <span className="a3-dec-value">{current}</span>
          {relation && (
            <span className="a3-dec-rel" data-tone={relation.tone}>
              <span className="a3-dec-relmark" aria-hidden="true">
                {relation.tone === 'match' ? '✓'
                  : relation.tone === 'changed' || relation.tone === 'missing' ? '!' : ''}
              </span>
              {relation.label}
              {relation.detail && <span className="a3-dec-reldetail">{relation.detail}</span>}
            </span>
          )}
        </span>
        <span className="a3-dec-price">{price}</span>
        <span className="a3-dec-act">
          {/* ONE disclosure per decision, on the line: the evidence is one
              step away and costs the row no height until it is opened. */}
          {evidence && (
            <button
              type="button"
              className="a3-linkbtn a3-dec-evbtn"
              aria-expanded={evidence.open}
              aria-controls={evidenceId}
              aria-label={evidence.accessibleName}
              onClick={evidence.onToggle}
            >
              <span aria-hidden="true">{evidence.open ? '▾ ' : '▸ '}</span>
              {evidence.label}
            </button>
          )}
          {action}
        </span>
      </div>
      {deviation && (
        <aside className="a3-dec-dev" aria-label={deviation.title}>
          <p className="a3-dec-devk">{deviation.title}</p>
          <p className="a3-dec-devb">
            {deviation.body}
            {deviation.restore}
          </p>
        </aside>
      )}
      {valueRows}
      {editor}
      {evidence && (
        <div id={evidenceId} className="a3-dec-ev" hidden={!evidence.open}>
          {evidence.open && evidence.children}
        </div>
      )}
    </li>
  )
}

/** A decision the project makes moot, or one whose precondition lapsed — a quiet statement. */
export function DecisionQuiet({ id, name, statement }: {
  id: string
  name: string
  statement: string
}) {
  return (
    <li className="a3-dec" data-decision={id} data-na>
      <div className="a3-dec-line">
        <span className="a3-dec-name">{name}</span>
        <span className="a3-dec-current"><span className="a3-dec-na">{statement}</span></span>
      </div>
    </li>
  )
}

/**
 * The edit-mode workspace under a decision: the valid alternatives, the
 * dependency consequence in plain language, and the explicit commit. It
 * exists only while editing (or while a decision is genuinely unresolved),
 * so a settled answer never looks like a question.
 */
export function DecisionEditor({ heading, hint, children, note, apply, cancel, onEscape }: {
  heading: string
  hint?: string
  children: ReactNode
  /** The plain-language consequence a choice needs to be made safely. */
  note?: string
  apply: { label: string; onApply: () => void; disabled?: boolean; disabledReason?: string }
  cancel?: { label: string; onCancel: () => void }
  onEscape?: () => void
}) {
  return (
    <div
      className="a3-dec-editor"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !onEscape) return
        event.stopPropagation()
        onEscape()
      }}
    >
      <div className="a3-dec-editor-head">
        <b>{heading}</b>
        {hint && <span className="a3-cap">{hint}</span>}
      </div>
      {children}
      {note && <p className="a3-dec-editor-note">{note}</p>}
      <div className="a3-dec-editor-acts">
        <Button
          variant="primary"
          disabled={apply.disabled}
          disabledReason={apply.disabledReason}
          onClick={apply.onApply}
        >
          {apply.label}
        </Button>
        {cancel && <Button onClick={cancel.onCancel}>{cancel.label}</Button>}
      </div>
    </div>
  )
}

/** One labelled group inside the evidence disclosure. */
export function EvidenceSection({ label, rows }: {
  label: string
  rows: ReadonlyArray<{ k: string; v: ReactNode }>
}) {
  if (rows.length === 0) return null
  return (
    <section className="a3-ev" aria-label={label}>
      <p className="a3-ev-h">{label}</p>
      <dl className="a3-ev-rows">
        {rows.map((row) => (
          <div className="a3-ev-row" key={row.k}>
            <dt>{row.k}</dt>
            <dd>{row.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * A value set inside ONE decision.
 *
 * Three buildings produce three values here, never nine rows in the overview,
 * and the building name appears exactly once. Status is a word beside a
 * glyph rather than a colour.
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
 * A cross-system rule, stated ONCE and referenced — inside the evidence
 * disclosure, where the formal basis belongs.
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

/**
 * The later-specification boundary — ONE compact sentence at the foot, never
 * a ninth system. The two-column mapping is progressive: the boundary's job
 * is to answer "is this decided here or later?" in a glance.
 */
export function BemusterungBoundary({
  title, body, decidedHeading, deferredHeading, rows, detail,
}: {
  title: string
  body: string
  decidedHeading: string
  deferredHeading: string
  rows: ReadonlyArray<{ decided: string; deferred: string }>
  detail?: { label: string; open: boolean; onToggle: () => void }
}) {
  return (
    <section className="a3-bem" aria-label={title}>
      <p className="a3-bem-line">
        <b className="a3-bem-h">{title}</b>
        <span className="a3-bem-b">{body}</span>
        {detail && rows.length > 0 && (
          <button
            type="button"
            className="a3-linkbtn a3-bem-toggle"
            aria-expanded={detail.open}
            onClick={detail.onToggle}
          >
            {detail.label}
          </button>
        )}
      </p>
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
