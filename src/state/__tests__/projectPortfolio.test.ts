import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PORTFOLIO_QUERY,
  DISPLAY_ONLY_PORTFOLIO_COUNT,
  NAVIGABLE_PORTFOLIO_COUNT,
  PORTFOLIO_PROJECTS,
  PORTFOLIO_PROJECT_COUNT,
  activeFilterCount,
  cityOptions,
  clientOptions,
  deadlineState,
  decodePortfolioQuery,
  encodePortfolioQuery,
  isNavigableProject,
  latestPresentableSnapshot,
  managerOptions,
  PORTFOLIO_PAGE_SIZE,
  portfolioPage,
  portfolioTitle,
  portfolioValue,
  projectIdOfSavedVersion,
  resolveProjectLifecycles,
  selectPortfolio,
  type PortfolioQuery,
} from '../projectPortfolio'
import { LIFECYCLE_STATUSES, lifecycleStatusTone } from '../projectLifecycle'
import { CLIENT_PROJECTION_VERSION, type SavedOptionVersion } from '../optionSave'

const byId = (id: string) => PORTFOLIO_PROJECTS.find((p) => p.id === id)!

/**
 * The register as a FRESH SESSION renders it.
 *
 * A record has no lifecycle status; a ROW does, and only
 * `resolveProjectLifecycles` produces one. A fresh session has no analysis,
 * no readiness ledger and no loaded Option workspace, so this is also the
 * boot state every ordering and filter assertion below is written against.
 */
const ROWS = resolveProjectLifecycles(PORTFOLIO_PROJECTS, {
  analyses: {}, readiness: {}, options: null,
})
const rowStatus = (id: string) => ROWS.find((p) => p.id === id)!.lifecycleStatus
const titles = (q: Partial<PortfolioQuery>) =>
  selectPortfolio(ROWS, { ...DEFAULT_PORTFOLIO_QUERY, ...q }).map(portfolioTitle)

/** Titles come from the register itself, keyed by id — see the note in
 *  `src/test/portfolio.ts` on why they are never spelled out as literals. */
const T = {
  lindenhain: portfolioTitle(byId('DEMO-HAPPY-01')),
  guterbogen: portfolioTitle(byId('DEMO-COMPLEX-01')),
  hamburg: portfolioTitle(byId('PORTFOLIO-HH-01')),
  wien: portfolioTitle(byId('PORTFOLIO-AT-01')),
  muenchen: portfolioTitle(byId('PORTFOLIO-MUC-01')),
}

describe('the register: five records, two of them journeys', () => {
  it('declares 5 = 2 + 3 and proves non-navigability structurally', () => {
    expect(PORTFOLIO_PROJECT_COUNT).toBe(5)
    expect(NAVIGABLE_PORTFOLIO_COUNT).toBe(2)
    expect(DISPLAY_ONLY_PORTFOLIO_COUNT).toBe(3)
    expect(PORTFOLIO_PROJECTS.filter((p) => !p.displayOnly)).toHaveLength(2)
    expect(PORTFOLIO_PROJECTS.filter((p) => p.displayOnly)).toHaveLength(3)
    // The workflow layer has never heard of a display-only id. This is the
    // guarantee no rendering change can undo: there is nothing to open.
    for (const project of PORTFOLIO_PROJECTS) {
      expect(isNavigableProject(project.id)).toBe(!project.displayOnly)
    }
  })

  it('titles every card as [country] – [postcode] [city] – [address]', () => {
    // Asserted as the RULE, applied to every record, rather than as five
    // copied strings: a literal restates the format instead of proving it.
    for (const p of PORTFOLIO_PROJECTS) {
      expect(portfolioTitle(p))
        .toBe(`${p.countryCode} – ${p.postcode} ${p.city} – ${p.addressLine}`)
      expect(portfolioTitle(p)).toMatch(/^[A-Z]{2} – \d{4,5} .+ – .+$/)
    }
    expect(new Set(PORTFOLIO_PROJECTS.map(portfolioTitle)).size).toBe(5)
  })

  it('maps all seven lifecycle statuses onto a canonical tone', () => {
    for (const status of LIFECYCLE_STATUSES) {
      expect(['neutral', 'progress', 'ok', 'attention', 'stale'])
        .toContain(lifecycleStatusTone(status))
    }
  })

  it('gives a RECORD no status, and a ROW exactly one', () => {
    // The split is the mechanism, not a naming preference: a record has no
    // field a card or a filter could read as "current truth", and every row
    // carries one value from the closed set. `resolveProjectLifecycles` is
    // the only producer, so the card and the status filter read the same
    // field and cannot disagree.
    for (const record of PORTFOLIO_PROJECTS) {
      expect(record).not.toHaveProperty('lifecycleStatus')
      expect(['derived', 'declaredSynthetic']).toContain(record.lifecycle.kind)
    }
    expect(ROWS).toHaveLength(PORTFOLIO_PROJECTS.length)
    for (const row of ROWS) {
      expect(LIFECYCLE_STATUSES).toContain(row.lifecycleStatus)
    }
  })

  it('derives a real project and lets only a display record declare', () => {
    // A navigable project's fixture contributes at most an explicit human
    // hold; it cannot name a status. A display-only record has no journey to
    // derive from, so its synthetic status is its own — and is restricted to
    // the values a synthetic record can honestly be in.
    for (const record of PORTFOLIO_PROJECTS) {
      expect(record.lifecycle.kind)
        .toBe(record.displayOnly ? 'declaredSynthetic' : 'derived')
      if (record.lifecycle.kind === 'declaredSynthetic') {
        expect(['ready_to_pitch', 'review_required'])
          .not.toContain(record.lifecycle.status)
      }
    }
  })

  it('starts both navigable projects at New in a fresh session', () => {
    // Nothing has been analysed, decided or committed, so there is nothing
    // for `New` to be untrue about. This is the assertion the old fixture
    // could not make: it printed `Ready to pitch` on a card that had no
    // calculated price and a disabled client view.
    expect(rowStatus('DEMO-HAPPY-01')).toBe('new')
    expect(rowStatus('DEMO-COMPLEX-01')).toBe('new')
  })
})

describe('aggregates never state a partial total', () => {
  it('sums BGF exactly and reports an incomplete area in words', () => {
    const complex = byId('DEMO-COMPLEX-01')
    // 6030.00 + 5780.00 + 7660.00
    expect(complex.metrics.bgfRSTotal).toEqual({ kind: 'exact', value: '19470.00' })
    // NUF is known for the office building only.
    expect(complex.metrics.areaMetric).toBe('nuf')
    expect(complex.metrics.area).toEqual({
      kind: 'incomplete', knownCount: 1, applicableCount: 3,
    })
    // A building with no dwellings has no dwelling count to be missing, so
    // the unit total stays exact: 46 + 48.
    expect(complex.metrics.residentialUnits).toEqual({ kind: 'exact', value: '94' })
  })

  it('reports a residential-only project with WFL, exactly', () => {
    const clean = byId('DEMO-HAPPY-01')
    expect(clean.metrics.areaMetric).toBe('wfl')
    expect(clean.metrics.area).toEqual({ kind: 'exact', value: '2120.00' })
    expect(clean.metrics.residentialUnits).toEqual({ kind: 'exact', value: '18' })
    expect(clean.metrics.buildingCount).toBe(1)
  })

  it('never mixes WFL and NUF into one figure', () => {
    for (const project of PORTFOLIO_PROJECTS) {
      expect(['wfl', 'nuf']).toContain(project.metrics.areaMetric)
    }
  })
})

describe('the value comes from a saved snapshot or says it does not exist', () => {
  const emptyState = { savedOptionVersions: {} }

  const snapshot = (over: Partial<SavedOptionVersion> = {}): SavedOptionVersion => ({
    optionId: 'OPT-1',
    optionName: 'Basis',
    version: 1,
    savedAt: '2026-09-01T10:00:00.000Z',
    savedBy: 'test',
    projectBaselineId: 'DEMO-HAPPY-01@2026-09-01T09:00:00.000Z',
    buildingScopeFingerprint: 'a',
    configurationFingerprint: 'b',
    scheduleFingerprint: 'c',
    reviewFingerprint: 'd',
    clientProjectionVersion: CLIENT_PROJECTION_VERSION,
    clientProjectionValid: true,
    result: {
      totalExact: '4123456.78',
      totalDisplay: '4.123.000',
      totalLabel: 'Gesamt netto',
      coverage: 'total',
      uncertaintyPp: 10,
      byCostGroup: [],
      resultVersion: 1,
    },
    ...over,
  })

  it('says the price is not determined rather than showing zero', () => {
    expect(portfolioValue(byId('DEMO-HAPPY-01'), emptyState))
      .toEqual({ kind: 'notCalculated' })
  })

  it('recovers the project from the baseline id and reads the latest eligible save', () => {
    const older = snapshot({ savedAt: '2026-08-01T10:00:00.000Z', result: { ...snapshot().result, totalDisplay: '1.000.000' } })
    const newer = snapshot({ savedAt: '2026-09-02T10:00:00.000Z' })
    expect(projectIdOfSavedVersion(newer)).toBe('DEMO-HAPPY-01')
    const state = { savedOptionVersions: { 'OPT-1': [older, newer] } }
    expect(latestPresentableSnapshot(state, 'DEMO-HAPPY-01')).toBe(newer)
    expect(portfolioValue(byId('DEMO-HAPPY-01'), state)).toEqual({
      kind: 'amount',
      display: '4.123.000',
      exact: '4123456.78',
      coverage: 'total',
      asOf: '2026-09-02T10:00:00.000Z',
      provenance: 'savedOptionSnapshot',
    })
  })

  it('refuses a snapshot the client projection never validated', () => {
    const state = {
      savedOptionVersions: { 'OPT-1': [snapshot({ clientProjectionValid: false })] },
    }
    expect(portfolioValue(byId('DEMO-HAPPY-01'), state)).toEqual({ kind: 'notCalculated' })
  })

  it('refuses a snapshot validated against an older projection contract', () => {
    const state = {
      savedOptionVersions: {
        'OPT-1': [snapshot({ clientProjectionVersion: CLIENT_PROJECTION_VERSION - 1 })],
      },
    }
    expect(portfolioValue(byId('DEMO-HAPPY-01'), state)).toEqual({ kind: 'notCalculated' })
  })

  it('never attributes another project’s snapshot', () => {
    const state = { savedOptionVersions: { 'OPT-1': [snapshot()] } }
    expect(portfolioValue(byId('DEMO-COMPLEX-01'), state)).toEqual({ kind: 'notCalculated' })
  })

  it('carries a display-only amount with explicit synthetic provenance', () => {
    expect(portfolioValue(byId('PORTFOLIO-HH-01'), emptyState)).toEqual({
      kind: 'amount',
      display: '51.240.000',
      exact: '51240000',
      coverage: 'total',
      asOf: '2026-09-03T15:45:00+02:00',
      provenance: 'syntheticPortfolioFixture',
    })
  })

  it('renames the row when the saved scope is only a subtotal', () => {
    const state = {
      savedOptionVersions: {
        'OPT-1': [snapshot({ result: { ...snapshot().result, coverage: 'subtotal' } })],
      },
    }
    const value = portfolioValue(byId('DEMO-HAPPY-01'), state)
    expect(value).toMatchObject({ kind: 'amount', coverage: 'subtotal' })
  })
})

describe('the deadline, against an injected clock', () => {
  const now = Date.parse('2026-09-04T12:00:00+02:00')

  it('classifies missing, overdue, imminent and scheduled', () => {
    expect(deadlineState(null, now)).toEqual({ kind: 'none' })
    expect(deadlineState('nonsense', now)).toEqual({ kind: 'none' })
    expect(deadlineState('2026-09-01T14:00:00+02:00', now))
      .toEqual({ kind: 'overdue', at: '2026-09-01T14:00:00+02:00' })
    expect(deadlineState('2026-09-09T10:00:00+02:00', now))
      .toEqual({ kind: 'soon', at: '2026-09-09T10:00:00+02:00', days: 5 })
    expect(deadlineState('2026-09-18T14:30:00+02:00', now))
      .toEqual({ kind: 'scheduled', at: '2026-09-18T14:30:00+02:00' })
  })

  it('treats exactly seven days away as imminent and eight as not', () => {
    expect(deadlineState('2026-09-11T11:00:00+02:00', now).kind).toBe('soon')
    expect(deadlineState('2026-09-12T13:00:00+02:00', now).kind).toBe('scheduled')
  })
})

describe('search, filters and their combination', () => {
  it('matches identity, client, manager, city, address, postcode and id', () => {
    expect(titles({ text: 'Lindenhain' })).toEqual([T.lindenhain])
    expect(titles({ text: 'Nordraum Projekt GmbH' })).toEqual([T.hamburg])
    expect(titles({ text: 'Miriam Schneider' })).toEqual([T.muenchen])
    expect(titles({ text: 'Wien' })).toEqual([T.wien])
    expect(titles({ text: 'Feldmark 6' })).toEqual([T.muenchen])
    expect(titles({ text: '22761' })).toEqual([T.hamburg])
    expect(titles({ text: 'DEMO-COMPLEX-01' })).toEqual([T.guterbogen])
  })

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(titles({ text: '   hAmBuRg  ' })).toEqual([T.hamburg])
  })

  it('combines groups with AND and statuses with OR', () => {
    // In a fresh session BOTH navigable projects derive `new` — nobody has
    // run an analysis, decided a conflict or committed a baseline — and
    // Hamburg declares it. That is three cards, in last-modified order.
    expect(titles({ statuses: ['new'] }))
      .toEqual([T.lindenhain, T.guterbogen, T.hamburg])
    expect(titles({ statuses: ['new', 'in_progress'] }))
      .toEqual([T.lindenhain, T.guterbogen, T.hamburg, T.wien])
    // AND across groups narrows the OR result.
    expect(titles({ statuses: ['new', 'in_progress'], city: 'Wien' })).toEqual([T.wien])
    // No selected status is every status, never nothing.
    expect(titles({ statuses: [] })).toHaveLength(5)
  })

  it('offers `ready_to_pitch` as a filter and finds nothing to force it', () => {
    // The status is a supported member of the closed set and the filter
    // offers it. What no fixture can do is SATISFY it: readiness needs an
    // explicit Client Mode review of one exact saved Option version, and a
    // fresh session has none. An empty result here is the honest one.
    expect(LIFECYCLE_STATUSES).toContain('ready_to_pitch')
    expect(titles({ statuses: ['ready_to_pitch'] })).toEqual([])
    expect(titles({ statuses: ['review_required'] })).toEqual([])
  })

  it('offers options from the whole register', () => {
    expect(clientOptions(PORTFOLIO_PROJECTS)).toEqual([
      'Donauquartier Entwicklung GmbH', 'Güterbogen Projektentwicklung GmbH',
      'Isargrund Wohnen KG', 'Lindenhain Wohnen GmbH', 'Nordraum Projekt GmbH',
    ])
    expect(managerOptions(PORTFOLIO_PROJECTS)).toEqual([
      'Daniel Weber', 'Lena Hoffmann', 'Miriam Schneider', 'Tobias Keller',
    ])
    // Every city the register holds, whatever is selected — otherwise the
    // filter could not be undone from inside itself. There is no country
    // facet to scope them by: the country lives on the card title and in the
    // text search, and has no control of its own.
    expect(cityOptions(PORTFOLIO_PROJECTS)).toContain('Wien')
    expect(cityOptions(PORTFOLIO_PROJECTS)).toContain('Leipzig')
  })

  it('counts every active narrowing, statuses individually', () => {
    expect(activeFilterCount(DEFAULT_PORTFOLIO_QUERY)).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_PORTFOLIO_QUERY, text: '  ' })).toBe(0)
    expect(activeFilterCount({
      ...DEFAULT_PORTFOLIO_QUERY,
      text: 'a', city: 'Leipzig', client: 'Nordraum Projekt GmbH',
      manager: 'Daniel Weber', statuses: ['new', 'archive'],
    })).toBe(6)
  })
})

describe('the four chronological orders are deterministic', () => {
  it('defaults to last modified, newest first', () => {
    expect(DEFAULT_PORTFOLIO_QUERY.sort).toBe('updatedDesc')
    expect(titles({})).toEqual([T.lindenhain, T.guterbogen, T.hamburg, T.wien, T.muenchen])
  })

  it('reverses cleanly and orders by creation independently', () => {
    expect(titles({ sort: 'updatedAsc' }))
      .toEqual([T.muenchen, T.wien, T.hamburg, T.guterbogen, T.lindenhain])
    expect(titles({ sort: 'createdDesc' }))
      .toEqual([T.hamburg, T.lindenhain, T.wien, T.muenchen, T.guterbogen])
    expect(titles({ sort: 'createdAsc' }))
      .toEqual([T.guterbogen, T.muenchen, T.wien, T.lindenhain, T.hamburg])
  })

  it('breaks a tie by identity, then by id', () => {
    const same = '2026-01-01T00:00:00+01:00'
    const tied = ROWS.map((p) => ({ ...p, updatedAt: same }))
    const order = selectPortfolio(tied, DEFAULT_PORTFOLIO_QUERY).map(portfolioTitle)
    expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b)))
    // Identical titles fall through to the id, and the result is stable.
    const clones = [
      { ...ROWS[0]!, id: 'B', updatedAt: same },
      { ...ROWS[0]!, id: 'A', updatedAt: same },
    ]
    expect(selectPortfolio(clones, DEFAULT_PORTFOLIO_QUERY).map((p) => p.id))
      .toEqual(['A', 'B'])
  })
})

describe('urgency is orderable, not only visible', () => {
  /**
   * A plain ascending sort on the meeting instant IS the queue order:
   * every overdue meeting is in the past and every upcoming one is in the
   * future, so «missed longest ago» → «happening soonest» → «nothing
   * booked» falls out of one comparison and needs no clock at all.
   */
  it('puts overdue first, then soonest, then no meeting at all', () => {
    expect(titles({ sort: 'meetingAsc' }))
      .toEqual([T.muenchen, T.wien, T.hamburg, T.guterbogen, T.lindenhain])
  })

  it('does not depend on the clock', () => {
    // Two runs a decade apart must produce the same register. A sort that
    // re-ranked itself as time passed would not be an order, it would be
    // an event.
    const first = titles({ sort: 'meetingAsc' })
    expect(titles({ sort: 'meetingAsc' })).toEqual(first)
    const unreadable = ROWS.map((p) => (
      p.id === 'PORTFOLIO-AT-01' ? { ...p, nextClientMeetingAt: 'not-a-date' } : p
    ))
    // An unreadable stamp is «no meeting», never «the epoch».
    const ordered = selectPortfolio(unreadable, {
      ...DEFAULT_PORTFOLIO_QUERY, sort: 'meetingAsc',
    }).map(portfolioTitle)
    expect(ordered.slice(-2)).toEqual([T.wien, T.lindenhain].sort((a, b) => a.localeCompare(b)))
    expect(ordered[0]).toBe(T.muenchen)
  })

  it('orders alphabetically by the ONE canonical title', () => {
    expect(titles({ sort: 'titleAsc' }))
      .toEqual([T.wien, T.guterbogen, T.hamburg, T.lindenhain, T.muenchen])
  })

  it('leaves the default alone', () => {
    // Changing it would silently re-order every shared URL and every test
    // that has ever linked to this register. It is a Product Decision, and
    // this ticket deliberately does not take it.
    expect(DEFAULT_PORTFOLIO_QUERY.sort).toBe('updatedDesc')
  })
})

describe('the register pages at ten, and only past ten', () => {
  const stub = (n: number) => Array.from({ length: n }, (_, i) => ({
    ...ROWS[0]!, id: `P${String(i).padStart(3, '0')}`,
  }))

  it('shows everything and paginates nothing at the threshold', () => {
    for (const n of [0, 1, 10]) {
      const page = portfolioPage(stub(n), 1)
      expect(page.paginated).toBe(false)
      expect(page.rows).toHaveLength(n)
      expect(page.pageCount).toBe(1)
      expect(page.total).toBe(n)
      expect(page.from).toBe(n === 0 ? 0 : 1)
      expect(page.to).toBe(n)
    }
  })

  it('slices at ten from the eleventh result', () => {
    const page = portfolioPage(stub(11), 1)
    expect(page.paginated).toBe(true)
    expect(page.rows).toHaveLength(PORTFOLIO_PAGE_SIZE)
    expect(page.pageCount).toBe(2)
    expect([page.from, page.to]).toEqual([1, 10])
    const last = portfolioPage(stub(11), 2)
    expect(last.rows.map((p) => p.id)).toEqual(['P010'])
    expect([last.from, last.to]).toEqual([11, 11])
  })

  it('clamps a page that no longer exists instead of stranding the reader', () => {
    // A copied link to page 5 of a register that has since been filtered
    // down to 23 results lands on the last page that DOES exist — never on
    // an empty page, and never on a thrown error in front of a reader.
    expect(portfolioPage(stub(23), 99).page).toBe(3)
    expect(portfolioPage(stub(23), 99).rows).toHaveLength(3)
    expect(portfolioPage(stub(23), 0).page).toBe(1)
    expect(portfolioPage(stub(23), Number.NaN).page).toBe(1)
  })

  it('slices the set the sort already ordered, never the other way round', () => {
    const many = [1, 2, 3].flatMap((round) => ROWS.map((p, i) => ({
      ...p,
      id: `${p.id}-${round}`,
      nextClientMeetingAt: p.nextClientMeetingAt
        ? `2026-1${round}-0${i + 1}T09:00:00+01:00`
        : null,
    })))
    const ordered = selectPortfolio(many, { ...DEFAULT_PORTFOLIO_QUERY, sort: 'meetingAsc' })
    const first = portfolioPage(ordered, 1)
    const second = portfolioPage(ordered, 2)
    expect([...first.rows, ...second.rows].map((p) => p.id))
      .toEqual(ordered.map((p) => p.id))
  })
})

describe('the URL carries exactly the register state', () => {
  it('writes only what differs from the default', () => {
    expect(encodePortfolioQuery(DEFAULT_PORTFOLIO_QUERY)).toBe('')
    expect(encodePortfolioQuery({ ...DEFAULT_PORTFOLIO_QUERY, text: '  Wien  ' }))
      .toBe('q=Wien')
  })

  it('round-trips every field', () => {
    const query: PortfolioQuery = {
      text: 'Hafenbogen',
      city: 'Hamburg',
      client: 'Nordraum Projekt GmbH',
      manager: 'Daniel Weber',
      statuses: ['new', 'ready_to_pitch'],
      sort: 'createdAsc',
      page: 3,
    }
    expect(decodePortfolioQuery(encodePortfolioQuery(query))).toEqual(query)
    expect(decodePortfolioQuery(`?${encodePortfolioQuery(query)}`)).toEqual(query)
  })

  it('carries the page, and only past the first one', () => {
    expect(encodePortfolioQuery({ ...DEFAULT_PORTFOLIO_QUERY, page: 1 })).toBe('')
    expect(encodePortfolioQuery({ ...DEFAULT_PORTFOLIO_QUERY, page: 4 })).toBe('page=4')
    // An OUT-OF-RANGE page is decoded, not rejected: it is a legitimate
    // link to a register that has since shrunk, and `portfolioPage` clamps
    // it. Only a NON-page falls back to the first.
    expect(decodePortfolioQuery('?page=999').page).toBe(999)
    expect(decodePortfolioQuery('?page=abc').page).toBe(1)
    expect(decodePortfolioQuery('?page=0').page).toBe(1)
    expect(decodePortfolioQuery('?page=-3').page).toBe(1)
  })

  it('falls back rather than throwing at an unreadable link', () => {
    expect(decodePortfolioQuery('?sort=nonsense').sort).toBe(DEFAULT_PORTFOLIO_QUERY.sort)
    expect(decodePortfolioQuery('?status=nonsense&status=new').statuses).toEqual(['new'])
    // A repeated status is still one selection of it.
    expect(decodePortfolioQuery('?status=new&status=new').statuses).toEqual(['new'])
    expect(decodePortfolioQuery('')).toEqual(DEFAULT_PORTFOLIO_QUERY)
  })
})
