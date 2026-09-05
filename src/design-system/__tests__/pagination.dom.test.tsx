import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../Pagination'

/**
 * The canonical Pagination as a control, not as a model.
 *
 * The page model itself is proved in `state/__tests__/projectDocumentsView`.
 * What is proved here is the part a model cannot: that the control is a
 * real navigation landmark, that its boundaries use NATIVE disabled
 * semantics, that the current page is identified to assistive technology,
 * and that an ellipsis is never something a keyboard can land on.
 */

function renderPagination(page: number, pageCount: number) {
  const onPageChange = vi.fn()
  render(
    <Pagination
      page={page}
      pageCount={pageCount}
      onPageChange={onPageChange}
      ariaLabel="Dokumentseiten"
      rangeLabel={`Seite ${page} von ${pageCount}`}
      pageButtonLabel={(n) => `Seite ${n}`}
    />,
  )
  return { onPageChange, nav: screen.getByRole('navigation', { name: 'Dokumentseiten' }) }
}

describe('canonical Pagination', () => {
  it('is a named navigation with a visible range and real buttons', async () => {
    const user = userEvent.setup()
    const { onPageChange, nav } = renderPagination(2, 6)
    expect(within(nav).getByText('Seite 2 von 6')).toBeInTheDocument()
    // All six numeric choices fit under the seven-page limit.
    for (let n = 1; n <= 6; n += 1) {
      expect(within(nav).getByRole('button', { name: `Seite ${n}` })).toBeInTheDocument()
    }
    await user.click(within(nav).getByRole('button', { name: 'Seite 4' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
    // Previous/Next move by one and are ordinary keyboard-reachable buttons.
    await user.click(within(nav).getByRole('button', { name: 'Weiter' }))
    expect(onPageChange).toHaveBeenLastCalledWith(3)
    await user.click(within(nav).getByRole('button', { name: 'Zurück' }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)
  })

  it('identifies the current page and disables only the real boundaries', () => {
    const { nav } = renderPagination(1, 6)
    expect(within(nav).getByRole('button', { name: 'Seite 1' }))
      .toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Seite 2' }))
      .not.toHaveAttribute('aria-current')
    // Native disabled: a Previous on page 1 has nothing to explain, so it
    // is genuinely inoperable rather than aria-disabled with a reason.
    expect(within(nav).getByRole('button', { name: 'Zurück' })).toBeDisabled()
    expect(within(nav).getByRole('button', { name: 'Weiter' })).toBeEnabled()
  })

  it('disables Next on the final page', () => {
    const { nav } = renderPagination(6, 6)
    expect(within(nav).getByRole('button', { name: 'Weiter' })).toBeDisabled()
    expect(within(nav).getByRole('button', { name: 'Zurück' })).toBeEnabled()
  })

  it('bounds a 150-document register and keeps the ellipses out of the way', async () => {
    const user = userEvent.setup()
    const { onPageChange, nav } = renderPagination(8, 15)
    // Fifteen pages, five numeric choices: first, current ±1, last.
    const numbers = within(nav).getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter((text) => text && /^\d+$/.test(text))
    expect(numbers).toEqual(['1', '7', '8', '9', '15'])
    // The ellipses are not focusable and are not announced: every page
    // they stand for is reachable from the numbers beside them.
    const gaps = nav.querySelectorAll('.a3-pgn-gap')
    expect(gaps).toHaveLength(2)
    for (const gap of gaps) {
      expect(gap.querySelector('[aria-hidden="true"]')).not.toBeNull()
      expect(gap.querySelector('button')).toBeNull()
    }
    // The whole control is reachable by keyboard, in order.
    await user.tab()
    expect(document.activeElement).toBe(within(nav).getByRole('button', { name: 'Zurück' }))
    await user.tab()
    expect(document.activeElement).toBe(within(nav).getByRole('button', { name: 'Seite 1' }))
    await user.keyboard('{Enter}')
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('never reports a page change that would not move', async () => {
    const user = userEvent.setup()
    const { onPageChange, nav } = renderPagination(3, 6)
    await user.click(within(nav).getByRole('button', { name: 'Seite 3' }))
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
