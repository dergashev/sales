import type { ReactNode } from 'react'

/**
 * DataTable — the canonical semantic table (VR3-COST-00).
 *
 * `components-core.md` §13 has carried a DataTable CONTRACT with no
 * component behind it, and the consequence was measurable: every surface
 * that needed a table wrote its own `<table>`, and each one re-decided
 * whether the money column has a header, whether that header is `scope`d,
 * whether numerals are tabular, and whether the row label is a `<th>`. The
 * audit found a rail table whose money and share columns had no identity at
 * all, and a modal whose four-line number cells came from centring numerals
 * in a row sized by a wrapping label.
 *
 * This is that contract, implemented once. It is NOT a data grid: no
 * sorting, no filtering, no virtualisation, no state. It is the markup and
 * the alignment rules, so a consumer supplies rows and cannot get the
 * semantics wrong.
 *
 * THREE RULES IT ENFORCES STRUCTURALLY:
 *
 * 1. Every table has a `<caption>` — visible or visually hidden, never
 *    absent, because a table with no name is a table a screen-reader user
 *    meets with no idea what it lists.
 * 2. Every column has a `<th scope="col">`, so the money column and the
 *    share column have identity.
 * 3. Numerals align to the label's FIRST baseline and are `max-content`
 *    wide (rule 3a) — they never vertically centre inside a row a wrapping
 *    label made tall, which is what produced the measured multi-line
 *    number cells.
 */

export type DataTableAlign = 'start' | 'numeric'

export type DataTableColumn = Readonly<{
  key: string
  header: ReactNode
  align?: DataTableAlign
  /** A column whose header is deliberately empty (an action column). */
  unlabelled?: boolean
}>

export type DataTableCell = Readonly<{
  content: ReactNode
  align?: DataTableAlign
  /** Renders as the muted "no amount" treatment — never as a zero. */
  absent?: boolean
  colSpan?: number
}>

export type DataTableRow = Readonly<{
  key: string
  /** The row's own name. Rendered as `<th scope="row">`. */
  header: ReactNode
  cells: readonly DataTableCell[]
  /** `group` bolds the row; `indent` marks a second-level child; `sum` rules off. */
  variant?: 'default' | 'group' | 'indent' | 'sum'
  /**
   * CONTRACT CHANGE 16.09.2026 — a row may OPEN the rows beneath it.
   *
   * Still not a data grid: the table holds no state and decides nothing. The
   * consumer says whether this row is expanded and supplies only the rows
   * that are currently visible; all the table does is render the row's name
   * as a real `<button aria-expanded>` instead of plain text, so the
   * disclosure is operable by keyboard and announced as what it is. Written
   * here rather than as a second table because a list that cannot be folded
   * is not a different table — it is this one with every section open, and
   * two hundred rows of it is a scroll, not a reading.
   */
  disclosure?: Readonly<{ expanded: boolean; onToggle: () => void }>
  /** Indentation level for a tree, when `variant` is not enough (0 = flush). */
  depth?: 0 | 1 | 2 | 3
}>

/**
 * The row variants, written out.
 *
 * This used to interpolate the variant into the class name at runtime. That
 * reads as four declared classes and is really a promise the stylesheet
 * cannot be checked against: `default` has no rule at all, so it shipped a
 * class that styles nothing, and any variant added later would do the same
 * silently. A literal map is what the Design System class checker can
 * verify, which is why it refuses constructed class names.
 */
const ROW_VARIANT_CLASS: Record<
  NonNullable<DataTableRow['variant']>, string | undefined
> = {
  default: undefined,
  group: 'a3-dt-group',
  indent: 'a3-dt-indent',
  sum: 'a3-dt-sum',
}

export function DataTable({
  caption, captionHidden = false, columns, rows, className,
}: {
  caption: string
  captionHidden?: boolean
  columns: readonly DataTableColumn[]
  rows: readonly DataTableRow[]
  className?: string
}) {
  return (
    <div className="a3-dt-scroll">
      <table className={['a3-dt', className].filter(Boolean).join(' ')}>
        <caption className={captionHidden ? 'a3-visually-hidden' : 'a3-dt-caption'}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.align === 'numeric' ? 'a3-dt-num' : undefined}
              >
                {column.unlabelled
                  ? <span className="a3-visually-hidden">{column.header}</span>
                  : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={ROW_VARIANT_CLASS[row.variant ?? 'default']}
              data-depth={row.depth ?? undefined}
            >
              <th scope="row">
                {row.disclosure
                  ? (
                    <button
                      type="button"
                      className="a3-dt-twist hit-target"
                      aria-expanded={row.disclosure.expanded}
                      onClick={row.disclosure.onToggle}
                    >
                      {/* Ein GEZEICHNETER Winkel, kein typografisches «▸»:
                          das Zeichen rendert in Visuelt auf einem Bruchteil
                          seiner em-Box und liest sich als Staub neben einer
                          fetten Zeilenüberschrift. Dieselbe Form wie die
                          Aufklapper der Checkliste, einmal gedreht — offen
                          und zu können nicht auseinanderlaufen. */}
                      <svg
                        className="a3-dt-twist-glyph"
                        data-open={row.disclosure.expanded ? 'true' : undefined}
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path
                          d="M5 3.5 L10.5 8 L5 12.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="square"
                        />
                      </svg>
                      {row.header}
                    </button>
                  )
                  : row.header}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  // Cells are positional by construction: a cell's identity IS
                  // its column, and the column list is static per table.
                  key={columns[index + 1]?.key ?? `cell-${index}`}
                  colSpan={cell.colSpan}
                  className={[
                    cell.align === 'numeric' ? 'a3-dt-num' : null,
                    cell.absent ? 'a3-dt-absent' : null,
                  ].filter(Boolean).join(' ') || undefined}
                >
                  {cell.content}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A commercial state, as a word inside a bordered tag.
 *
 * Rule 8 without exception: `im Bündel bepreist`, `Bauseits` and
 * `Entscheidung offen` are different statements and are told apart by their
 * WORDS. The tone only reinforces what the word already says.
 */
export function StateTag({
  label, tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'warning' | 'success'
}) {
  return <span className="a3-dt-tag" data-tone={tone}>{label}</span>
}
