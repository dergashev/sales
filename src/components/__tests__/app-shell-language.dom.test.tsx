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

describe('Globale Sprachkontrolle — kompakte Bereitschaftsinformation', () => {
  it('zeigt nie einen dauerhaften Absatz oder ein Status-Tag, aber der Hinweistext bleibt für Screenreader erhalten', () => {
    render(<App />)
    const control = document.querySelector('.a3-language-control') as HTMLElement
    expect(control).toBeInTheDocument()

    // Kein Status-Tag: die Segment-Option "EN · Entwurf" trägt die
    // Vorwarnung bereits sichtbar und dauerhaft, ein zweiter Träger für
    // dasselbe Wort wäre Redundanz (Design Review UX-PC-01, Regel 9).
    expect(control.querySelector('.a3-tag')).not.toBeInTheDocument()

    // Der volle Wortlaut existiert weiterhin im Dokument, aber nur für
    // Screenreader (sr-only visuell verklemmt jsdom prüft die Klasse,
    // die tatsächliche visuelle Klemmung ist Browser-CSS und wurde live
    // verifiziert) - nicht gelöscht, nicht als Dauer-Absatz gerendert.
    const fullText = within(control).getByText(/Übersetzung wird gerade vervollständigt/)
    expect(fullText).toHaveClass('sr-only')
    expect(fullText.tagName).toBe('P')
  })

  it('nach dem Wechsel zu EN bleibt kein Status-Tag, die Segment-Option selbst zeigt "Draft" und der volle Text bleibt verfügbar', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)

    const control = document.querySelector('.a3-language-control') as HTMLElement
    // UX-PC-01: kein separater Tag mehr, weder vor noch nach dem Wechsel.
    expect(control.querySelector('.a3-tag')).not.toBeInTheDocument()

    // Die UI-Sprache ist jetzt Englisch: die sichtbare Segment-Option muss
    // selbst englisch sein (t('shell.en.draftOption')), nicht das deutsche
    // Wort aus einem rohen Literal ohne Wörterbucheintrag - genau der
    // Regressionsfall, den Tech Review im vorigen Durchlauf gefunden hat.
    // Das <input> selbst trägt (sr-only, ohne Kinder) keinen Text - die
    // sichtbare Beschriftung steht im umschließenden <label>.
    const enInput = screen.getAllByRole('radio', { name: /EN/ })[0]!
    const enLabel = enInput.closest('label')!
    expect(enLabel).toHaveTextContent('Draft')
    expect(enLabel).not.toHaveTextContent('Entwurf')

    expect(within(control).getByText(/translation not yet complete/)).toHaveClass('sr-only')
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
