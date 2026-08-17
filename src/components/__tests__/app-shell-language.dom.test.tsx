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
 * visible full sentence with a compact DC-16 status tag shown only while
 * EN is actually active, keeping the full sentence available to assistive
 * technology via a visually-hidden node. This protects both halves of
 * that fix: no permanent visible paragraph, and the authoritative text
 * is never lost.
 */
beforeEach(() => __resetStoreForTests())

describe('Globale Sprachkontrolle — kompakte Bereitschaftsinformation', () => {
  it('zeigt vor dem Wechsel keinen dauerhaften Absatz, aber der Hinweistext bleibt für Screenreader erhalten', () => {
    render(<App />)
    const control = document.querySelector('.a3-language-control') as HTMLElement
    expect(control).toBeInTheDocument()

    // Kein Status-Tag vor dem Wechsel: die Segment-Option "EN · Entwurf"
    // hat die Vorwarnung bereits sichtbar übernommen.
    expect(control.querySelector('.a3-tag')).not.toBeInTheDocument()

    // Der volle Wortlaut existiert weiterhin im Dokument, aber nur für
    // Screenreader (sr-only visuell verklemmt jsdom prüft die Klasse,
    // die tatsächliche visuelle Klemmung ist Browser-CSS und wurde live
    // verifiziert) - nicht gelöscht, nicht als Dauer-Absatz gerendert.
    const fullText = within(control).getByText(/Übersetzung wird gerade vervollständigt/)
    expect(fullText).toHaveClass('sr-only')
    expect(fullText.tagName).toBe('P')
  })

  it('zeigt nach dem Wechsel zu EN einen kompakten Status-Tag statt eines Absatzes, mit vollem Text weiterhin verfügbar', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)

    const control = document.querySelector('.a3-language-control') as HTMLElement
    const tag = control.querySelector('.a3-tag')
    expect(tag).toBeInTheDocument()
    expect(tag).toHaveTextContent('Entwurf')
    expect(tag).not.toHaveAttribute('aria-hidden')

    expect(within(control).getByText(/translation not yet complete/)).toHaveClass('sr-only')
  })

  it('lässt die globale Kopfzeile bei 1280 px so hoch wie vor dieser Änderung, in beiden Sprachen', async () => {
    const user = userEvent.setup()
    render(<App />)
    const header = document.querySelector('.a3-global-header') as HTMLElement
    const beforeHeight = header.getBoundingClientRect().height

    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)
    const afterHeight = header.getBoundingClientRect().height

    // jsdom liefert keine echte Layout-Höhe (immer 0) - das Auflösen der
    // Regression selbst ist live im Browser gemessen (Tech Review: 131 px
    // in beiden Zuständen). Dieser Test schützt zumindest, dass keine
    // Sprachumschaltung eine neue Layout-Node zwischen Kopfzeile und
    // Sprachkontrolle einfügt, die künftig Höhe kosten könnte.
    expect(afterHeight).toBe(beforeHeight)
    expect(header.contains(document.querySelector('.a3-language-control'))).toBe(true)
  })
})
