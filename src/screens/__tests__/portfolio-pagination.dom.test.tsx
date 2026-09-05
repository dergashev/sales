import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpportunityList } from '../OpportunityList'
import { __resetStoreForTests } from '../../state/store'
import {
  PORTFOLIO_PROJECTS,
  type PortfolioProject,
} from '../../state/projectPortfolio'

/**
 * The register's pagination contract, at a scale the shipped register
 * cannot reach.
 *
 * Five projects is the Product's fixture and an invariant of its own — at
 * five, pagination must be completely absent, and `opportunities.dom` holds
 * that half of the contract by rendering the real `<App />`. The OTHER half
 * — ten per page, `?page=n`, a reset on every query change, a clamp on an
 * out-of-range link, one ordering across the whole set, and a focus move
 * that is not a new tab stop — needs more than ten results to exist at all.
 *
 * So this suite hands the SAME screen a larger register through its one
 * test seam. Nothing else is stubbed: the query still lives in the real
 * URL, the ordering is the real comparator, and the control is the
 * canonical `Pagination`.
 */

/** 23 records: three pages of ten / ten / three. */
const MANY: PortfolioProject[] = Array.from({ length: 23 }, (_, i) => ({
  ...PORTFOLIO_PROJECTS[i % PORTFOLIO_PROJECTS.length]!,
  id: `PAGED-${String(i).padStart(2, '0')}`,
  displayOnly: true,
  // A distinct, strictly decreasing `updatedAt` so the default ordering is
  // total and the page boundaries are unambiguous.
  updatedAt: `2026-08-${String(23 - i).padStart(2, '0')}T09:00:00+02:00`,
  addressLine: `Musterweg ${i + 1}`,
}))

beforeEach(() => {
  __resetStoreForTests()
  // jsdom shares one `window.location` across a file, and this register
  // keeps its whole query in it.
  window.history.replaceState(null, '', '/')
})

const pager = () => screen.getByRole('navigation', { name: 'Projektseiten' })
const cards = () => document.querySelectorAll('.a3-pf-card')
const count = () => document.querySelector('.a3-pf-count')!

describe('the Projects register beyond ten results', () => {
  it('renders ten cards, a page in the URL and an honest range', async () => {
    const user = userEvent.setup()
    render(<OpportunityList projects={MANY} />)

    expect(cards()).toHaveLength(10)
    expect(count().textContent).toBe('Demonstrationsportfolio · 1–10 von 23 Projekten')
    expect(window.location.search).toBe('')

    await user.click(within(pager()).getByRole('button', { name: 'Seite 2' }))
    expect(cards()).toHaveLength(10)
    expect(count().textContent).toBe('Demonstrationsportfolio · 11–20 von 23 Projekten')
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2')

    // Previous and Next move by exactly one.
    await user.click(within(pager()).getByRole('button', { name: 'Weiter' }))
    expect(count().textContent).toBe('Demonstrationsportfolio · 21–23 von 23 Projekten')
    expect(cards()).toHaveLength(3)
    await user.click(within(pager()).getByRole('button', { name: 'Zurück' }))
    expect(count().textContent).toBe('Demonstrationsportfolio · 11–20 von 23 Projekten')
  })

  it('keeps the boundaries in the DOM, in the tab order, and inert', async () => {
    const user = userEvent.setup()
    render(<OpportunityList projects={MANY} />)

    const previous = within(pager()).getByRole('button', { name: 'Zurück' })
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    expect(previous).not.toBeDisabled()
    await user.click(previous)
    expect(count().textContent).toBe('Demonstrationsportfolio · 1–10 von 23 Projekten')

    expect(within(pager()).getByRole('button', { name: 'Seite 1' }))
      .toHaveAttribute('aria-current', 'page')
    // The ellipsis stands for pages the numbers around it already reach,
    // so it is neither focusable nor announced.
    expect(pager().querySelectorAll('.a3-pgn-gap button')).toHaveLength(0)
  })

  it('moves focus to the count without making it a tab stop', async () => {
    const user = userEvent.setup()
    render(<OpportunityList projects={MANY} />)

    await user.click(within(pager()).getByRole('button', { name: 'Seite 3' }))
    // The sentence whose meaning just changed takes focus…
    expect(document.activeElement).toBe(count())
    // …but it is never something Tab walks INTO on the way to the cards.
    // Pagination must not buy its focus management with a permanent extra
    // stop in everybody else's keyboard path.
    expect(count()).toHaveAttribute('tabindex', '-1')
  })

  it('returns to page 1 whenever the query itself changes', async () => {
    const user = userEvent.setup()
    render(<OpportunityList projects={MANY} />)

    const toPageThree = async () => {
      await user.click(within(pager()).getByRole('button', { name: 'Seite 3' }))
      expect(new URLSearchParams(window.location.search).get('page')).toBe('3')
    }

    // SORT.
    await toPageThree()
    await user.selectOptions(
      screen.getByLabelText('Sortierung'), 'titleAsc',
    )
    expect(new URLSearchParams(window.location.search).get('page')).toBeNull()
    expect(count().textContent).toBe('Demonstrationsportfolio · 1–10 von 23 Projekten')

    // SEARCH. Page 3 of a set the search is about to shrink to nine would
    // otherwise be an empty page — the exact defect the reset prevents.
    await toPageThree()
    await user.type(screen.getByRole('searchbox'), 'Musterweg 1')
    expect(new URLSearchParams(window.location.search).get('page')).toBeNull()

    // FILTER.
    await user.clear(screen.getByRole('searchbox'))
    await toPageThree()
    await user.click(screen.getByRole('button', { name: /^Filter/ }))
    await user.click(document.querySelector('.a3-pf-status-list label')!)
    expect(new URLSearchParams(window.location.search).get('page')).toBeNull()
  })

  it('clamps a link to a page that no longer exists', () => {
    window.history.replaceState(null, '', '/?page=99')
    render(<OpportunityList projects={MANY} />)
    // Last valid page, not an empty one and not an error in front of a reader.
    expect(count().textContent).toBe('Demonstrationsportfolio · 21–23 von 23 Projekten')
    expect(within(pager()).getByRole('button', { name: 'Seite 3' }))
      .toHaveAttribute('aria-current', 'page')
  })

  it('orders the whole result set before it slices it', async () => {
    const user = userEvent.setup()
    render(<OpportunityList projects={MANY} />)
    await user.selectOptions(screen.getByLabelText('Sortierung'), 'titleAsc')

    const titlesOf = () => [...document.querySelectorAll('.a3-pf-title')]
      .map((h) => h.textContent!)
    const first = titlesOf()
    await user.click(within(pager()).getByRole('button', { name: 'Seite 2' }))
    const second = titlesOf()
    // Page 2 continues page 1's ordering. Sorting each page on its own
    // would make page 2 a second, unrelated register.
    const joined = [...first, ...second]
    expect(joined).toEqual([...joined].sort((a, b) => a.localeCompare(b)))
  })

  it('states the register total beside the match count when filtered', async () => {
    const user = userEvent.setup()
    render(<OpportunityList projects={MANY} />)
    await user.type(screen.getByRole('searchbox'), 'Musterweg 1')
    // 1, 10..19 → eleven matches, still paginated, and the line says both
    // how many matched AND how many the register holds.
    expect(count().textContent)
      .toBe('Demonstrationsportfolio · 1–10 von 11 Treffern · 23 im Register')
  })

  it('renders no pagination chrome at all for the shipped five', () => {
    render(<OpportunityList />)
    expect(cards()).toHaveLength(5)
    expect(screen.queryByRole('navigation', { name: 'Projektseiten' })).toBeNull()
    expect(count().textContent).toBe('Demonstrationsportfolio · 5 Projekte')
  })
})
