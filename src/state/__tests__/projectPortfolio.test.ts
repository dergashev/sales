import { describe, expect, it } from 'vitest'
import {
  ANY,
  DEFAULT_PORTFOLIO_QUERY,
  DISPLAY_ONLY_PORTFOLIO_COUNT,
  LIFECYCLE_STATUSES,
  NAVIGABLE_PORTFOLIO_COUNT,
  PORTFOLIO_PROJECTS,
  PORTFOLIO_PROJECT_COUNT,
  activeFilterCount,
  cityOptions,
  countryOptions,
  deadlineState,
  decodePortfolioQuery,
  encodePortfolioQuery,
  invalidatedCity,
  isNavigableProject,
  latestPresentableSnapshot,
  lifecycleStatusTone,
  managerOptions,
  portfolioTitle,
  portfolioValue,
  projectIdOfSavedVersion,
  selectPortfolio,
  type PortfolioQuery,
} from '../projectPortfolio'
import { CLIENT_PROJECTION_VERSION, type SavedOptionVersion } from '../optionSave'

const byId = (id: string) => PORTFOLIO_PROJECTS.find((p) => p.id === id)!
const titles = (q: Partial<PortfolioQuery>) =>
  selectPortfolio(PORTFOLIO_PROJECTS, { ...DEFAULT_PORTFOLIO_QUERY, ...q }).map(portfolioTitle)

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
    expect(titles({ statuses: ['new'] })).toEqual([T.hamburg])
    expect(titles({ statuses: ['new', 'in_progress'] })).toEqual([T.hamburg, T.wien])
    // AND across groups narrows the OR result.
    expect(titles({ statuses: ['new', 'in_progress'], country: 'AT' })).toEqual([T.wien])
    // No selected status is every status, never nothing.
    expect(titles({ statuses: [] })).toHaveLength(5)
  })

  it('offers options from the whole register, and narrows cities by country', () => {
    expect(countryOptions(PORTFOLIO_PROJECTS)).toEqual(['AT', 'DE'])
    expect(managerOptions(PORTFOLIO_PROJECTS)).toEqual([
      'Daniel Weber', 'Lena Hoffmann', 'Miriam Schneider', 'Tobias Keller',
    ])
    expect(cityOptions(PORTFOLIO_PROJECTS, ANY)).toContain('Wien')
    expect(cityOptions(PORTFOLIO_PROJECTS, 'DE')).not.toContain('Wien')
    // Even with a country selected, the COUNTRY list keeps every country —
    // otherwise the filter could not be undone from inside itself.
    expect(countryOptions(PORTFOLIO_PROJECTS)).toContain('AT')
  })

  it('names the city a country change invalidates, and only then', () => {
    expect(invalidatedCity(PORTFOLIO_PROJECTS, 'DE', 'Wien')).toBe('Wien')
    expect(invalidatedCity(PORTFOLIO_PROJECTS, 'DE', 'Leipzig')).toBeNull()
    expect(invalidatedCity(PORTFOLIO_PROJECTS, ANY, 'Wien')).toBeNull()
    expect(invalidatedCity(PORTFOLIO_PROJECTS, 'DE', ANY)).toBeNull()
  })

  it('counts every active narrowing, statuses individually', () => {
    expect(activeFilterCount(DEFAULT_PORTFOLIO_QUERY)).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_PORTFOLIO_QUERY, text: '  ' })).toBe(0)
    expect(activeFilterCount({
      ...DEFAULT_PORTFOLIO_QUERY,
      text: 'a', country: 'DE', city: 'Leipzig', manager: 'Daniel Weber',
      statuses: ['new', 'archive'],
    })).toBe(6)
  })
})

describe('the four chronological orders are deterministic', () => {
  it('defaults to last modified, newest first', () => {
    expect(DEFAULT_PORTFOLIO_QUERY.sort).toBe('updatedDesc')
    expect(titles({})).toEqual([T.lindenhain, T.hamburg, T.wien, T.muenchen, T.guterbogen])
  })

  it('reverses cleanly and orders by creation independently', () => {
    expect(titles({ sort: 'updatedAsc' }))
      .toEqual([T.guterbogen, T.muenchen, T.wien, T.hamburg, T.lindenhain])
    expect(titles({ sort: 'createdDesc' }))
      .toEqual([T.hamburg, T.lindenhain, T.wien, T.muenchen, T.guterbogen])
    expect(titles({ sort: 'createdAsc' }))
      .toEqual([T.guterbogen, T.muenchen, T.wien, T.lindenhain, T.hamburg])
  })

  it('breaks a tie by identity, then by id', () => {
    const same = '2026-01-01T00:00:00+01:00'
    const tied = PORTFOLIO_PROJECTS.map((p) => ({ ...p, updatedAt: same }))
    const order = selectPortfolio(tied, DEFAULT_PORTFOLIO_QUERY).map(portfolioTitle)
    expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b)))
    // Identical titles fall through to the id, and the result is stable.
    const clones = [
      { ...PORTFOLIO_PROJECTS[0]!, id: 'B', updatedAt: same },
      { ...PORTFOLIO_PROJECTS[0]!, id: 'A', updatedAt: same },
    ]
    expect(selectPortfolio(clones, DEFAULT_PORTFOLIO_QUERY).map((p) => p.id))
      .toEqual(['A', 'B'])
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
      country: 'DE',
      city: 'Hamburg',
      manager: 'Daniel Weber',
      statuses: ['new', 'ready_to_pitch'],
      sort: 'createdAsc',
    }
    expect(decodePortfolioQuery(encodePortfolioQuery(query))).toEqual(query)
    expect(decodePortfolioQuery(`?${encodePortfolioQuery(query)}`)).toEqual(query)
  })

  it('falls back rather than throwing at an unreadable link', () => {
    expect(decodePortfolioQuery('?sort=nonsense').sort).toBe(DEFAULT_PORTFOLIO_QUERY.sort)
    expect(decodePortfolioQuery('?status=nonsense&status=new').statuses).toEqual(['new'])
    // A repeated status is still one selection of it.
    expect(decodePortfolioQuery('?status=new&status=new').statuses).toEqual(['new'])
    expect(decodePortfolioQuery('')).toEqual(DEFAULT_PORTFOLIO_QUERY)
  })
})
