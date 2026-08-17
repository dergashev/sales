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
    // Die UI-Sprache ist jetzt Englisch: der sichtbare Tag muss selbst
    // englisch sein (t('shell.en.draftTag')), nicht das deutsche Wort
    // aus einem rohen tx()-Literal ohne Wörterbucheintrag - genau der
    // Regressionsfall, den Tech Review im vorigen Durchlauf gefunden hat.
    expect(tag).toHaveTextContent('Draft')
    expect(tag).not.toHaveTextContent('Entwurf')
    expect(tag).not.toHaveAttribute('aria-hidden')

    expect(within(control).getByText(/translation not yet complete/)).toHaveClass('sr-only')
  })

  it('fügt beim Sprachwechsel keine zusätzliche Block-Node in die Kopfzeile ein', async () => {
    // Höhe wird hier NICHT gemessen: jsdom kennt kein Layout und liefert für
    // jede Box 0, ein Höhenvergleich könnte also niemals fehlschlagen und wäre
    // als Beweis wertlos. Die echte Messung bei 1280 px gehört in den Browser
    // (QA). Was jsdom belastbar prüfen kann, ist die STRUKTUR, auf der die
    // Korrektur beruht: die Kopfzeile bekommt durch den Wechsel keinen
    // zusätzlichen sichtbaren Block, sondern nur den kompakten Inline-Tag.
    const user = userEvent.setup()
    render(<App />)
    const header = document.querySelector('.a3-global-header') as HTMLElement
    const control = header.querySelector('.a3-language-control') as HTMLElement
    expect(control).toBeInTheDocument()

    const visibleBlocks = (root: HTMLElement) =>
      [...root.querySelectorAll('p, div')].filter((el) => !el.classList.contains('sr-only')).length
    const before = visibleBlocks(control)

    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)

    expect(visibleBlocks(control)).toBe(before)
    // Der einzige Zuwachs ist der Inline-Tag - er ist kein Block und steht
    // in derselben Zeile wie die Segmentkontrolle.
    const tag = control.querySelector('.a3-tag')!
    expect(tag.tagName).toBe('SPAN')
    expect(tag.closest('p, div')).toBe(control)
  })
})
