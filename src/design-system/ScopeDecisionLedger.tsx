import { ChoiceGroup } from './ChoiceGroup'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * ScopeDecisionLedger — six explicit scope decisions, compactly (VR3-03,
 * targets T-018–T-020; design-system delta: large KG inclusion cards
 * REPLACED).
 *
 * WHAT IT REPLACES. Six binary decisions used to occupy six full-width
 * option-card blocks, three of which were disabled checkboxes labelled
 * "Pflicht" and three of which defaulted to "nicht enthalten". So the
 * surface was vertically enormous, three decisions were not decisions at
 * all, and the other three had already been answered on the user's behalf.
 * The audit's words: "Large vertical treatment is disproportionate to six
 * binary decisions" and "Required KGs begin included and optional KGs
 * excluded; UNDECIDED is missing".
 *
 * ONE ROW PER DECISION. Identity, the concise boundary, the two explicit
 * choices, what the decision means for scope and what it means downstream —
 * side by side, because a decision the user can compare across six rows is
 * a decision they can make once rather than six times.
 *
 * A ROW IS NOT A TOGGLE. `Switch` is reserved for an immediately reversible
 * setting; include/exclude is a recorded choice with a price and a journal
 * entry, so it is a `ChoiceGroup` with a genuine undecided zero-state.
 */

export type ScopeLedgerDecision = 'undecided' | 'included' | 'excluded'

export type ScopeLedgerRow = {
  id: string
  /** The DIN 276 number, e.g. `KG 200`. */
  identity: string
  /** What the group means, in the user's language. */
  meaning: string
  /** The concise boundary this decision draws. */
  boundary: string
  decision: ScopeLedgerDecision
  /** What the current decision means for the offer's scope. */
  summary: string
  /** What it means for the work still to come. */
  downstream: { tone: SemanticStatusTone; label: string }
  includeLabel: string
  excludeLabel: string
  includeConsequence?: string
  excludeConsequence?: string
}

export function ScopeDecisionLedger({
  rows, columns, decisionLegend, onDecide, onPreview, caption,
}: {
  rows: readonly ScopeLedgerRow[]
  columns: { group: string; decision: string; summary: string; downstream: string }
  /** Names the decision for assistive tech, per row. */
  decisionLegend: (row: ScopeLedgerRow) => string
  onDecide: (id: string, decision: Exclude<ScopeLedgerDecision, 'undecided'>) => void
  onPreview?: (id: string, decision: ScopeLedgerDecision | null) => void
  caption: string
}) {
  return (
    // Every table lives in its own horizontal scroll container (rule 3a):
    // the decision column carries two controls and the summary column carries
    // a sentence, and neither may push the page into a horizontal scroll.
    <div className="a3-tbl-scroll">
      <table className="a3-ledger">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{columns.group}</th>
            <th scope="col">{columns.decision}</th>
            <th scope="col">{columns.summary}</th>
            <th scope="col">{columns.downstream}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-decision={row.decision}>
              <th scope="row" className="a3-ledger-identity">
                {/* Each label is its own block element: the identity and the
                    meaning must not rely on markup whitespace to separate
                    them (rule 37). */}
                <span className="a3-ledger-number">{row.identity}</span>
                <span className="a3-ledger-meaning">{row.meaning}</span>
              </th>
              <td className="a3-ledger-decision">
                <ChoiceGroup
                  legend={decisionLegend(row)}
                  legendHidden
                  density="compact"
                  value={row.decision === 'undecided' ? null : row.decision}
                  onChange={(value) => onDecide(row.id, value)}
                  onPreview={(value) => onPreview?.(row.id, value)}
                  options={[
                    {
                      value: 'included' as const,
                      label: row.includeLabel,
                      consequence: row.includeConsequence,
                    },
                    {
                      value: 'excluded' as const,
                      label: row.excludeLabel,
                      consequence: row.excludeConsequence,
                    },
                  ]}
                />
              </td>
              <td className="a3-ledger-summary">
                {/* The state, then the boundary it qualifies. Two blocks, so
                    neither depends on markup whitespace (rule 37). */}
                <span className="a3-ledger-state">{row.summary}</span>
                <span className="a3-ledger-boundary">{row.boundary}</span>
              </td>
              <td className="a3-ledger-downstream">
                <SemanticStatus tone={row.downstream.tone} label={row.downstream.label} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The completion summary, `n/6 decided`.
 *
 * Separate from the table because it belongs beside the stage heading, where
 * the target puts it, and because it is the value the gate downstream reads —
 * one number, one place, rendered wherever the composition needs it.
 */
export function ScopeDecisionSummary({
  decided, total, label, tone,
}: {
  decided: number
  total: number
  label: string
  tone: SemanticStatusTone
}) {
  return (
    <p className="a3-ledger-progress" data-complete={decided === total || undefined}>
      <SemanticStatus tone={tone} label={label} />
    </p>
  )
}
