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
