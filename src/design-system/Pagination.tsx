import { useT } from '../i18n'

/**
 * Pagination — the canonical page control (accepted 2026-09-05 Project
 * Documents workspace UX audit, "NEW CANONICAL CAPABILITY").
 *
 * No canonical pagination existed in this system: every long register grew
 * the page instead of navigating it, and the Documents register grew
 * without bound. The audit's answer is not "add page buttons to Documents"
 * but "add the capability once", because the same control is owed to every
 * register that outgrows one screen.
 *
 * What the capability owns and what it refuses:
 *
 * - **It owns the page MODEL, not the data.** `page`/`pageCount` are
 *   controlled by the owner; the component never slices a list, never
 *   fetches, and never decides what a page contains. The pure helpers
 *   below (`pageCountFor`, `clampPage`, `paginationPages`) are exported so
 *   the owner derives the same model without rendering, and so the model
 *   itself is unit-testable.
 * - **It refuses to imply scope.** Pagination is PRESENTATION. Nothing in
 *   this component says or suggests that an action applies to the visible
 *   page — that sentence belongs to whoever owns the action, and the
 *   Documents workspace states it explicitly beside its analysis CTA.
 * - **It owns no live region.** Page changes are meaningful and must be
 *   announced, but a control that announces itself competes with the one
 *   restrained live region a workspace is allowed. `onPageChange` is the
 *   hook: the owner announces, and the owner moves focus to its register
 *   heading or first result.
 * - **Bounded numeric choice.** Seven pages or fewer are all listed; above
 *   that the model is first · last · current ±1 with ellipses, so a
 *   150-document register never renders fifteen buttons — and never
 *   renders an ellipsis standing for a single page it could have shown.
 *
 * Accessibility: a real `<nav>` with a required accessible name, real
 * `<button>`s, `aria-current="page"` on the current page, NATIVE `disabled`
 * on the boundaries (the audit asks for native disabled semantics here —
 * unlike an action whose refusal has to be explained, a Previous on page 1
 * has nothing to explain), and non-focusable ellipses that are hidden from
 * assistive technology because the pages they stand for are reachable by
 * the numeric buttons around them.
 */

export type PaginationPage = number | 'gap'

/** Pages of `total` items at `pageSize` per page. Zero items is one page. */
export function pageCountFor(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * The nearest page that exists.
 *
 * A filter that shrinks a result set must never strand the reader on a
 * page that no longer exists — the audit's clamp rule. Zero results clamp
 * to page 1, which is the logical internal state, not an empty page 0.
 */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(Math.trunc(page), 1), Math.max(1, pageCount))
}

/** The 1-based item range shown on `page`, for the range/count text. */
export function paginationRange(
  page: number, pageSize: number, total: number,
): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 }
  const current = clampPage(page, pageCountFor(total, pageSize))
  const from = (current - 1) * pageSize + 1
  return { from, to: Math.min(current * pageSize, total) }
}

/**
 * The numeric choices to render, with `'gap'` where pages are elided.
 *
 * `fullListLimit` is the audit's "show all numeric pages when there are at
 * most seven". A gap that would stand for exactly ONE page is replaced by
 * that page: an ellipsis hiding a single choice costs a click and saves
 * nothing.
 */
export function paginationPages(
  page: number, pageCount: number, fullListLimit = 7,
): PaginationPage[] {
  const total = Math.max(1, Math.trunc(pageCount))
  const current = clampPage(page, total)
  if (total <= fullListLimit) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const keep = new Set<number>([1, total, current - 1, current, current + 1])
  const shown = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: PaginationPage[] = []
  let previous = 0
  for (const n of shown) {
    if (previous !== 0) {
      if (n - previous === 2) out.push(previous + 1)
      else if (n - previous > 2) out.push('gap')
    }
    out.push(n)
    previous = n
  }
  return out
}

export function Pagination({
  page, pageCount, onPageChange, ariaLabel, rangeLabel, pageButtonLabel,
}: {
  /** 1-based, controlled by the owner. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /**
   * Required accessible name for the `<nav>` landmark — the domain names
   * what is paginated ("Dokumentseiten"), this component does not guess.
   */
  ariaLabel: string
  /** The visible range/count, e.g. `11–20 von 60 Dokumenten`. */
  rangeLabel: string
  /** Accessible name of one page button, e.g. `(n) => \`Seite ${n}\``. */
  pageButtonLabel: (page: number) => string
}) {
  const t = useT()
  const total = Math.max(1, Math.trunc(pageCount))
  const current = clampPage(page, total)
  const pages = paginationPages(current, total)
  const go = (next: number) => {
    const target = clampPage(next, total)
    if (target !== current) onPageChange(target)
  }
  return (
    <nav className="a3-pgn" aria-label={ariaLabel}>
      <p className="a3-pgn-range">{rangeLabel}</p>
      <div className="a3-pgn-controls">
        <button
          type="button"
          className="a3-pgn-step hit-target"
          disabled={current <= 1}
          onClick={() => go(current - 1)}
        >
          {t('ds.pagination.previous')}
        </button>
        <ol className="a3-pgn-pages">
          {pages.map((entry, index) => (
            <li
              key={entry === 'gap' ? `gap-${index}` : entry}
              className={entry === 'gap' ? 'a3-pgn-gap' : 'a3-pgn-page'}
            >
              {entry === 'gap' ? (
                /* Not focusable and not announced: every page it stands
                   for is reachable from the numeric buttons beside it. */
                <span aria-hidden="true">…</span>
              ) : (
                <button
                  type="button"
                  className="a3-pgn-number hit-target"
                  aria-current={entry === current ? 'page' : undefined}
                  aria-label={pageButtonLabel(entry)}
                  onClick={() => go(entry)}
                >
                  <span className="numeric">{entry}</span>
                </button>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="a3-pgn-step hit-target"
          disabled={current >= total}
          onClick={() => go(current + 1)}
        >
          {t('ds.pagination.next')}
        </button>
      </div>
    </nav>
  )
}
