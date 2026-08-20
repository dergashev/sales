import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests } from '../../state/store'

/**
 * Тикет REBUILD PROJECT CARD SHELL, пункт 5. Found by Tech Review: making
 * the DE/EN readiness note inline (grid → flex) shortened it locally but
 * widened the global header's right column enough to squeeze the left
 * column into wrapping on the pipeline screen at the 1280 px floor —
 * a real regression, measured 131 → 161 px. The fix replaces the always-
 * visible full sentence with the segmented control's own dictionary-driven
 * option label ("EN · Draft"/"EN · Entwurf", visible before AND after
 * switching), keeping the full sentence available to assistive technology
 * via a visually-hidden node. This protects both halves of that fix: no
 * permanent visible paragraph, and the authoritative text is never lost.
 *
 * Design Review finding UX-PC-01 (same ticket) later removed a separate
 * compact DC-16 status tag that used to render next to the control only
 * while EN was active: it repeated the exact word the segment's own label
 * already showed, so the header said "Draft" twice at once. Removing it
 * loses no information — the tests below assert that directly.
 */
beforeEach(() => __resetStoreForTests())

describe('Globale Sprachkontrolle — compact DE/EN selector', () => {
  it('renders only the two compact language labels without draft chrome', () => {
    render(<App />)
    const control = document.querySelector('.a3-language-control') as HTMLElement
    expect(control).toBeInTheDocument()

    expect(control.querySelector('.a3-tag')).not.toBeInTheDocument()
    expect(within(control).getByRole('radio', { name: 'DE' })).toBeInTheDocument()
    expect(within(control).getByRole('radio', { name: 'EN' })).toBeInTheDocument()
    expect(control).not.toHaveTextContent(/Entwurf|Draft/)
  })

  it('keeps EN compact after switching', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)

    const control = document.querySelector('.a3-language-control') as HTMLElement
    expect(control.querySelector('.a3-tag')).not.toBeInTheDocument()
    const enInput = screen.getAllByRole('radio', { name: /EN/ })[0]!
    const enLabel = enInput.closest('label')!
    expect(enLabel).toHaveTextContent('EN')
    expect(enLabel).not.toHaveTextContent('Draft')
    expect(enLabel).not.toHaveTextContent('Entwurf')
  })

  it('fügt beim Sprachwechsel keine zusätzliche sichtbare Node in die Kopfzeile ein', async () => {
    // Höhe wird hier NICHT gemessen: jsdom kennt kein Layout und liefert für
    // jede Box 0, ein Höhenvergleich könnte also niemals fehlschlagen und wäre
    // als Beweis wertlos. Die echte Messung bei 1280 px gehört in den Browser
    // (QA). Was jsdom belastbar prüfen kann, ist die STRUKTUR: der Wechsel
    // ändert nur die Textinhalte, keine neue sichtbare Block- oder Inline-
    // Node kommt hinzu (der frühere Inline-Tag existiert seit UX-PC-01
    // nicht mehr).
    const user = userEvent.setup()
    render(<App />)
    const header = document.querySelector('.a3-global-header') as HTMLElement
    const control = header.querySelector('.a3-language-control') as HTMLElement
    expect(control).toBeInTheDocument()

    const visibleNodes = (root: HTMLElement) =>
      [...root.querySelectorAll('*')].filter((el) => !el.classList.contains('sr-only')).length
    const before = visibleNodes(control)

    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)

    expect(visibleNodes(control)).toBe(before)
    expect(control.querySelector('.a3-tag')).not.toBeInTheDocument()
  })
})
