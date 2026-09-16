import raw from '../fixtures/schnittstellenmatrix.json'

/**
 * Die Schnittstellenmatrix — the contract's own division of labour, as data.
 *
 * WHAT THIS IS. The Master sheet of the project's Schnittstellenmatrix
 * (206 numbered positions, four top-level chapters), reduced to the five
 * columns the reader works with: the number, the service, and the three
 * assignments — `Nicht erford.` · `AG` · `AN (GU/GÜ)`. The sheet's two prose
 * columns (`Kommentar / Annahme / Hinweis`, `Quelle / Referenz`) are NOT in
 * the fixture: they were not asked for, and a column imported «because it
 * was in the file» is a column nobody decided to show.
 *
 * THREE MARKS, NOT TWO. The sheet writes `x` and `(x)` and they do not mean
 * the same thing: `(x)` is an assignment that holds only under a named
 * condition (the sheet's own comment column says which). Collapsing it into
 * a plain tick would silently promote a conditional obligation into an
 * unconditional one, on the one screen whose whole subject is who owes what.
 * So `conditional` is its own mark, it is visible as a word beside the box
 * (rule 8 — never a state by shape or colour alone), and it survives until
 * somebody decides otherwise.
 *
 * THE FIXTURE IS THE SOURCE, THE STORE HOLDS ONLY DEPARTURES. A row the user
 * never touched has no entry in `interfaceMatrix` at all, so re-importing a
 * newer sheet cannot be quietly overwritten by stale copies of its own
 * values, and «what did the contract say» stays answerable next to «what did
 * we decide».
 */

export type MatrixColumn = 'notRequired' | 'ag' | 'an'
export type MatrixMark = 'no' | 'yes' | 'conditional'

export const MATRIX_COLUMNS: readonly MatrixColumn[] = ['notRequired', 'ag', 'an']

export type MatrixRow = Readonly<{
  nr: string
  label: string
  notRequired: MatrixMark
  ag: MatrixMark
  an: MatrixMark
  children: readonly MatrixRow[]
}>

/** Only the marks a person changed, keyed by position number. */
export type MatrixMarks = Readonly<Record<string, Readonly<Partial<Record<MatrixColumn, MatrixMark>>>>>

export const MATRIX_SOURCE: string = raw.source
export const MATRIX_GROUPS = raw.groups as readonly MatrixRow[]

/** The mark in force: the person's decision if there is one, else the sheet's. */
export function markOf(row: MatrixRow, column: MatrixColumn, marks: MatrixMarks): MatrixMark {
  return marks[row.nr]?.[column] ?? row[column]
}

/** Was this position's mark changed by hand? Attribution, not decoration. */
export function isOverridden(row: MatrixRow, column: MatrixColumn, marks: MatrixMarks): boolean {
  const mark = marks[row.nr]?.[column]
  return mark !== undefined && mark !== row[column]
}

/**
 * A chapter's own count: how many positions it holds, and how many of them
 * carry an assignment at all. A collapsed chapter that said only its name
 * would make the reader open all four to find the one with open positions.
 */
export function matrixCounts(row: MatrixRow, marks: MatrixMarks): { rows: number; assigned: number } {
  let rows = 0
  let assigned = 0
  const walk = (node: MatrixRow) => {
    if (node.children.length === 0) {
      rows += 1
      if (MATRIX_COLUMNS.some((column) => markOf(node, column, marks) !== 'no')) assigned += 1
      return
    }
    node.children.forEach(walk)
  }
  walk(row)
  return { rows, assigned }
}

/** Every position in the tree, depth first — the order the sheet has. */
export function flattenMatrix(rows: readonly MatrixRow[]): MatrixRow[] {
  const out: MatrixRow[] = []
  const walk = (node: MatrixRow) => { out.push(node); node.children.forEach(walk) }
  rows.forEach(walk)
  return out
}
