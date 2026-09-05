import { describe, expect, it } from 'vitest'
import {
  clampPage, pageCountFor, paginationPages, paginationRange,
} from '../../design-system/Pagination'
import {
  ANY_TYPE,
  DEFAULT_DOCUMENTS_QUERY,
  DOCUMENTS_PAGE_SIZE,
  activeDocumentFilters,
  decodeDocumentsQuery,
  documentSearchEntry,
  documentTypeCounts,
  documentsMatching,
  documentsPage,
  encodeDocumentsQuery,
  type DocumentsQuery,
} from '../projectDocumentsView'
import type { DocumentDisplayState, FixtureDocument } from '../projectAnalysis'

/**
 * The register's PRESENTATION model, proved without rendering.
 *
 * Two properties are load-bearing for the accepted 2026-09-05 Documents
 * workspace target and are therefore asserted as rules rather than as
 * examples:
 *
 * 1. **The activation threshold is the eleventh result**, at a page size of
 *    exactly ten — under it the register shows everything and offers no
 *    controls at all.
 * 2. **A page can never be invalid.** Filters shrink result sets at
 *    runtime; the model clamps, so an impossible page cannot reach the DOM
 *    in the first place.
 */

function doc(id: string, over: Partial<FixtureDocument> = {}): FixtureDocument {
  return {
    id,
    file: `${id}.pdf`,
    documentType: 'floorPlan',
    projectLevel: false,
    buildingIds: ['B1'],
    version: 'V1',
    issuedAt: '2026-04-27',
    supersedes: null,
    duplicateOf: null,
    recognitionQuality: 'high',
    recognitionMedium: 'vector',
    processingOutcome: 'PROCESSED',
    issueKey: null,
    sourceAuthority: 'planner',
    previewAssetId: null,
    ...over,
  }
}

/** N documents, as the register would hold them. */
function documents(count: number): FixtureDocument[] {
  return Array.from({ length: count }, (_, i) => doc(`D${String(i + 1).padStart(3, '0')}`))
}

const READY = (): DocumentDisplayState => 'READY'
const NO_INDEX = {}

describe('the pagination model', () => {
  it('activates from the eleventh result and never before it', () => {
    for (const count of [0, 1, 8, 10]) {
      const page = documentsPage(documents(count), 1)
      expect(page.paginated, `${count} results`).toBe(false)
      expect(page.rows).toHaveLength(count)
      expect(page.pageCount).toBe(1)
    }
    const eleven = documentsPage(documents(11), 1)
    expect(eleven.paginated).toBe(true)
    expect(eleven.pageCount).toBe(2)
    expect(eleven.rows).toHaveLength(10)
    expect(documentsPage(documents(11), 2).rows).toHaveLength(1)
  })

  it('holds the audit data scenarios exactly', () => {
    expect(DOCUMENTS_PAGE_SIZE).toBe(10)
    const scenarios: Array<[number, number, number[]]> = [
      [8, 1, [8]],
      [11, 2, [10, 1]],
      [24, 3, [10, 10, 4]],
      [60, 6, [10, 10, 10, 10, 10, 10]],
      [150, 15, Array.from({ length: 15 }, () => 10)],
    ]
    for (const [total, pages, sizes] of scenarios) {
      const all = documents(total)
      expect(pageCountFor(total, DOCUMENTS_PAGE_SIZE), `${total} documents`).toBe(pages)
      for (let page = 1; page <= pages; page += 1) {
        expect(documentsPage(all, page).rows, `${total}/${page}`)
          .toHaveLength(sizes[page - 1]!)
      }
    }
  })

  it('states the range it is showing, from one', () => {
    expect(paginationRange(1, 10, 60)).toEqual({ from: 1, to: 10 })
    expect(paginationRange(2, 10, 60)).toEqual({ from: 11, to: 20 })
    expect(paginationRange(6, 10, 60)).toEqual({ from: 51, to: 60 })
    expect(paginationRange(2, 10, 11)).toEqual({ from: 11, to: 11 })
    // Nothing to show is not "0–0 of 0 starting at one".
    expect(paginationRange(1, 10, 0)).toEqual({ from: 0, to: 0 })
  })

  it('lists every page up to seven and bounds the rest with ellipses', () => {
    expect(paginationPages(1, 6)).toEqual([1, 2, 3, 4, 5, 6])
    expect(paginationPages(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // Above seven: first, last, current ±1.
    expect(paginationPages(8, 15)).toEqual([1, 'gap', 7, 8, 9, 'gap', 15])
    expect(paginationPages(1, 15)).toEqual([1, 2, 'gap', 15])
    expect(paginationPages(15, 15)).toEqual([1, 'gap', 14, 15])
    // An ellipsis never stands for exactly one page: it would cost a click
    // and hide a choice that fits.
    expect(paginationPages(3, 15)).toEqual([1, 2, 3, 4, 'gap', 15])
    for (const model of [paginationPages(8, 15), paginationPages(4, 20)]) {
      expect(model.filter((entry) => entry === 'gap').length).toBeLessThanOrEqual(2)
    }
  })

  it('clamps rather than stranding the reader on a page that no longer exists', () => {
    expect(clampPage(9, 3)).toBe(3)
    expect(clampPage(0, 3)).toBe(1)
    expect(clampPage(-4, 3)).toBe(1)
    expect(clampPage(Number.NaN, 3)).toBe(1)
    // A filter that shrinks 60 results to 12 leaves page 6 invalid.
    const shrunk = documentsPage(documents(12), 6)
    expect(shrunk.page).toBe(2)
    expect(shrunk.rows).toHaveLength(2)
    // Zero results are page 1, not page 0 and not an empty page 6.
    const none = documentsPage([], 6)
    expect(none.page).toBe(1)
    expect(none.paginated).toBe(false)
    expect(none.total).toBe(0)
  })
})

describe('the register query', () => {
  it('filters by type, status and text against the visible fields only', () => {
    const docs = [
      doc('A', { file: 'Grundriss_EG.pdf', documentType: 'floorPlan' }),
      doc('B', { file: 'Ansicht_Nord.pdf', documentType: 'elevations' }),
      doc('C', { file: 'Schnitt_AA.pdf', documentType: 'section' }),
    ]
    const index = {
      A: documentSearchEntry('Grundriss_EG.pdf', 'Grundriss', 'Gebäude Lindenhof'),
      B: documentSearchEntry('Ansicht_Nord.pdf', 'Ansichten', 'Gebäude Hofhaus'),
      C: documentSearchEntry('Schnitt_AA.pdf', 'Schnitt', 'Projektebene'),
    }
    const state = (id: string): DocumentDisplayState => (id === 'A' ? 'WARNING' : 'PROCESSED')
    const q = (over: Partial<DocumentsQuery>): DocumentsQuery => ({
      ...DEFAULT_DOCUMENTS_QUERY, ...over,
    })

    expect(documentsMatching(docs, q({}), index, state)).toHaveLength(3)
    expect(documentsMatching(docs, q({ type: 'section' }), index, state).map((d) => d.id))
      .toEqual(['C'])
    expect(documentsMatching(docs, q({ status: 'attention' }), index, state).map((d) => d.id))
      .toEqual(['A'])
    expect(documentsMatching(docs, q({ status: 'processed' }), index, state).map((d) => d.id))
      .toEqual(['B', 'C'])
    // Search reaches the association, which the row shows…
    expect(documentsMatching(docs, q({ text: 'hofhaus' }), index, state).map((d) => d.id))
      .toEqual(['B'])
    // …and the recognised type, which it also shows.
    expect(documentsMatching(docs, q({ text: 'ansichten' }), index, state).map((d) => d.id))
      .toEqual(['B'])
    // Nothing invisible is searchable.
    expect(documentsMatching(docs, q({ text: 'planner' }), index, state)).toHaveLength(0)
  })

  it('counts the types the register actually holds', () => {
    const counts = documentTypeCounts([
      doc('A', { documentType: 'floorPlan' }),
      doc('B', { documentType: 'floorPlan' }),
      doc('C', { documentType: 'section' }),
    ])
    expect(counts).toEqual([
      { type: 'floorPlan', count: 2 },
      { type: 'section', count: 1 },
    ])
  })

  it('round-trips through the URL and preserves parameters it does not own', () => {
    const query: DocumentsQuery = {
      text: 'grundriss', type: 'floorPlan', status: 'attention', page: 3,
    }
    const search = encodeDocumentsQuery(query, '?q=lindenhain&sort=modified')
    expect(decodeDocumentsQuery(search)).toEqual(query)
    // The portfolio register's own state survives: returning to the list
    // must not arrive with its filters silently dropped.
    expect(search).toContain('q=lindenhain')
    expect(search).toContain('sort=modified')
    // A pristine register writes nothing at all.
    expect(encodeDocumentsQuery(DEFAULT_DOCUMENTS_QUERY, '')).toBe('')
    // And clearing a filter removes its parameter rather than blanking it.
    expect(encodeDocumentsQuery(DEFAULT_DOCUMENTS_QUERY, search))
      .toBe('q=lindenhain&sort=modified')
    // Unknown values fall back rather than throwing at a reader.
    expect(decodeDocumentsQuery('?docstatus=nonsense&docpage=-3'))
      .toEqual({ text: '', type: ANY_TYPE, status: 'all', page: 1 })
  })

  it('counts active filters so the reset offers itself only when it can act', () => {
    expect(activeDocumentFilters(DEFAULT_DOCUMENTS_QUERY)).toBe(0)
    expect(activeDocumentFilters({ ...DEFAULT_DOCUMENTS_QUERY, page: 4 })).toBe(0)
    expect(activeDocumentFilters({ ...DEFAULT_DOCUMENTS_QUERY, text: '  ' })).toBe(0)
    expect(activeDocumentFilters({
      ...DEFAULT_DOCUMENTS_QUERY, text: 'a', type: 'section', status: 'processed',
    })).toBe(3)
  })

  it('a document with no search index is still findable by its file name', () => {
    const docs = [doc('A', { file: 'Grundriss_EG.pdf' })]
    const query = { ...DEFAULT_DOCUMENTS_QUERY, text: 'grundriss' }
    expect(documentsMatching(docs, query, NO_INDEX, READY)).toHaveLength(1)
  })
})
