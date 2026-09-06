import { clampPage, pageCountFor } from '../design-system/Pagination'

/**
 * The Options register's VIEW state — one number, in the URL.
 *
 * The same contract the Documents register (`projectDocumentsView.ts`) and
 * the portfolio register (`projectPortfolio.ts`) already keep, reduced to the
 * one dimension this collection has: a page. There is no search and no filter
 * here, and none is invented — an Option collection is ordered work, not a
 * catalogue, and the audit's scale table (§D) asks for pagination and nothing
 * else.
 *
 * Two properties are inherited deliberately rather than re-decided:
 *
 * 1. **Encoding preserves foreign parameters.** Returning to the Documents
 *    workspace must not arrive with its filter silently dropped.
 * 2. **The page is CLAMPED against the current result set**, never trusted
 *    from the URL. `?optpage=9` on a project with three Options renders page
 *    one; an invalid page cannot reach the DOM.
 */

/** The audit's default page size, shared with Documents and the portfolio. */
export const OPTIONS_PAGE_SIZE = 10

const PARAM_PAGE = 'optpage'

export function encodeOptionsPage(page: number, existing = ''): string {
  const params = new URLSearchParams(
    existing.startsWith('?') ? existing.slice(1) : existing,
  )
  if (page > 1) params.set(PARAM_PAGE, String(page))
  else params.delete(PARAM_PAGE)
  return params.toString()
}

export function decodeOptionsPage(search: string): number {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const page = Number.parseInt(params.get(PARAM_PAGE) ?? '', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export type OptionsPage<T> = Readonly<{
  rows: readonly T[]
  page: number
  pageCount: number
  total: number
  /** The audit's rule: the control appears from the eleventh result. */
  paginated: boolean
}>

export function optionsPage<T>(
  all: readonly T[], page: number, pageSize = OPTIONS_PAGE_SIZE,
): OptionsPage<T> {
  const total = all.length
  const pageCount = pageCountFor(total, pageSize)
  const current = clampPage(page, pageCount)
  const from = (current - 1) * pageSize
  return {
    rows: all.slice(from, from + pageSize),
    page: current,
    pageCount,
    total,
    paginated: total > pageSize,
  }
}
