import { clampPage, pageCountFor } from '../design-system/Pagination'
import type { DocumentDisplayState } from './projectAnalysis'
import type { FixtureDocument } from './projectAnalysis'

/**
 * The Documents register's VIEW state (accepted 2026-09-05 Documents
 * workspace UX audit, "Filtering specification" and "Pagination
 * specification").
 *
 * Two properties matter more than anything this file does:
 *
 * 1. **It is presentation only.** Search, type, status and page decide
 *    which rows are LISTED. They decide nothing about what the analysis
 *    operates on — that set is `eligibleDocuments`, and the rail states it
 *    independently of everything here. Starting an analysis from page 2 of
 *    6 still analyses all sixty documents, and the CTA says so.
 * 2. **It lives in the URL.** The register is the working context: a user
 *    who opens a document, looks at its evidence and comes back has not
 *    asked to lose their filter and their page. The portfolio register
 *    already owns this pattern (`projectPortfolio.ts`), and this follows it
 *    — including the part that is easy to get wrong: encoding PRESERVES
 *    query parameters it does not own, so navigating back to the portfolio
 *    does not arrive with its own filters silently dropped.
 */

export type DocumentStatusFilter = 'all' | 'attention' | 'processed'

/** The `All types` sentinel. Not a document type; the absence of a filter. */
export const ANY_TYPE = 'all'

/** The audit's default page size. Pagination appears from the 11th result. */
export const DOCUMENTS_PAGE_SIZE = 10

export type DocumentsQuery = {
  text: string
  /** A `documentType` value, or `ANY_TYPE`. */
  type: string
  status: DocumentStatusFilter
  /** 1-based. Clamped against the CURRENT result set by `documentsPage`. */
  page: number
  /**
   * The document whose viewer is OPEN, or `''`.
   *
   * It lives in the query — and therefore in the URL — because an evidence
   * item cites a document, a page and an anchor inside it, and a citation
   * that cannot be addressed is not a citation. While the open row was
   * component-local state, the product printed «every value opens its
   * source document» beside a filename in a `<span>` and the only route to
   * evidence was a stage switch to the whole register.
   *
   * Being in the URL also makes Back the natural way out of a source: the
   * reader returns to the register they came from, in the state they left
   * it, without the screen having to remember anything.
   */
  open: string
  /**
   * The ANCHOR inside the open document that was cited, or `''`.
   *
   * The document alone is not the citation: an evidence item names a clause
   * on a page, and opening page 1 of a twelve-page Baubeschreibung is not
   * «opens its source». The anchor travels beside the document so the viewer
   * can name the page position and the clause, and so the link survives a
   * reload like every other bit of register state.
   */
  anchor: string
}

export const DEFAULT_DOCUMENTS_QUERY: DocumentsQuery = {
  text: '', type: ANY_TYPE, status: 'all', page: 1, open: '', anchor: '',
}

const PARAM = {
  text: 'docq',
  type: 'doctype',
  status: 'docstatus',
  page: 'docpage',
  open: 'docopen',
  anchor: 'docanchor',
} as const

function isStatus(value: string | null): value is DocumentStatusFilter {
  return value === 'all' || value === 'attention' || value === 'processed'
}

/**
 * The query as `location.search`, merged into whatever is already there.
 *
 * `existing` is the current search string: parameters belonging to another
 * register survive, ours are written only when they differ from the
 * default, so an untouched Documents workspace leaves no trace in the URL.
 */
export function encodeDocumentsQuery(query: DocumentsQuery, existing = ''): string {
  const params = new URLSearchParams(
    existing.startsWith('?') ? existing.slice(1) : existing,
  )
  const write = (key: string, value: string, keep: boolean) => {
    if (keep) params.set(key, value)
    else params.delete(key)
  }
  write(PARAM.text, query.text.trim(), query.text.trim() !== '')
  write(PARAM.type, query.type, query.type !== ANY_TYPE)
  write(PARAM.status, query.status, query.status !== 'all')
  write(PARAM.page, String(query.page), query.page > 1)
  write(PARAM.open, query.open, query.open !== '')
  // An anchor without its document would address nothing.
  write(PARAM.anchor, query.anchor, query.open !== '' && query.anchor !== '')
  return params.toString()
}

/** Unknown values fall back to the default rather than throwing at a reader. */
export function decodeDocumentsQuery(search: string): DocumentsQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const status = params.get(PARAM.status)
  const page = Number.parseInt(params.get(PARAM.page) ?? '', 10)
  return {
    text: params.get(PARAM.text) ?? '',
    type: params.get(PARAM.type) ?? ANY_TYPE,
    status: isStatus(status) ? status : 'all',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    // A document id this project does not have is dropped by the SCREEN,
    // which is the only layer that knows the register. Decoding cannot
    // reject it without taking a dependency on the project.
    open: params.get(PARAM.open) ?? '',
    anchor: params.get(PARAM.anchor) ?? '',
  }
}

/**
 * How many NARROWINGS are active. `open` is deliberately not one of them:
 * opening a source shows a document, it does not filter the register, and
 * counting it would make «Filter (1)» appear because somebody followed a
 * citation.
 */
export function activeDocumentFilters(query: DocumentsQuery): number {
  return (query.text.trim() !== '' ? 1 : 0)
    + (query.type !== ANY_TYPE ? 1 : 0)
    + (query.status !== 'all' ? 1 : 0)
}

/**
 * The searchable text of one document.
 *
 * The audit's rule: search matches filename, recognised type and
 * association. Those last two are LABELS — translated, owned by the screen
 * — so the screen builds the index and this module stays free of i18n.
 * Nothing else is searchable: an index over invented metadata would let the
 * field find something the register cannot show.
 */
export type DocumentSearchIndex = Readonly<Record<string, string>>

export function documentSearchEntry(...parts: ReadonlyArray<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase()
}

export type DocumentTypeCount = { type: string; count: number }

/** Available types with their counts, in register order. */
export function documentTypeCounts(
  documents: ReadonlyArray<FixtureDocument>,
): DocumentTypeCount[] {
  const counts = new Map<string, number>()
  for (const doc of documents) {
    counts.set(doc.documentType, (counts.get(doc.documentType) ?? 0) + 1)
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }))
}

function matchesStatus(state: DocumentDisplayState, status: DocumentStatusFilter): boolean {
  if (status === 'all') return true
  if (status === 'processed') return state === 'PROCESSED'
  return state === 'WARNING' || state === 'LOW_CONFIDENCE' || state === 'FAILED'
}

/** The rows the current query lists, in register order. */
export function documentsMatching(
  documents: ReadonlyArray<FixtureDocument>,
  query: DocumentsQuery,
  index: DocumentSearchIndex,
  displayState: (docId: string) => DocumentDisplayState,
): FixtureDocument[] {
  const needle = query.text.trim().toLowerCase()
  return documents.filter((doc) => {
    if (query.type !== ANY_TYPE && doc.documentType !== query.type) return false
    if (!matchesStatus(displayState(doc.id), query.status)) return false
    if (needle === '') return true
    return (index[doc.id] ?? doc.file.toLowerCase()).includes(needle)
  })
}

export type DocumentsPage = {
  /** The rows to render. */
  rows: FixtureDocument[]
  /** Clamped: a filter that shrinks the set never strands the reader. */
  page: number
  pageCount: number
  total: number
  from: number
  to: number
  /** Below the activation threshold the register shows everything. */
  paginated: boolean
}

/**
 * One page of results.
 *
 * The activation rule is the audit's: up to ten results are all shown with
 * no controls at all; from the eleventh the register paginates at ten. The
 * page is clamped here rather than in a component, so an invalid page can
 * never reach the DOM in the first place.
 */
export function documentsPage(
  matching: ReadonlyArray<FixtureDocument>,
  page: number,
  pageSize = DOCUMENTS_PAGE_SIZE,
): DocumentsPage {
  const total = matching.length
  const paginated = total > pageSize
  if (!paginated) {
    return {
      rows: [...matching],
      page: 1,
      pageCount: 1,
      total,
      from: total === 0 ? 0 : 1,
      to: total,
      paginated: false,
    }
  }
  const pageCount = pageCountFor(total, pageSize)
  const current = clampPage(page, pageCount)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  return {
    rows: matching.slice(from - 1, to),
    page: current,
    pageCount,
    total,
    from,
    to,
    paginated: true,
  }
}
