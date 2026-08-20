import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { App } from '../../App'
import { DELTA_CHIP_MS } from '../../config/ui-policy'
import {
  __resetStoreForTests,
  PROJECT_PARAMS_CONFIRMATION_LABEL,
  useStore,
} from '../../state/store'

beforeEach(() => __resetStoreForTests())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function openProjectCard() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
}

describe('Project Card — project baseline', () => {
  it('presents primary facts and the BGF equation as one semantic, provenance-labelled baseline', () => {
    openProjectCard()
    const baseline = screen.getByRole('region', { name: 'Projektparameter' })

    expect(within(baseline).getByRole('heading', { name: 'Projektgrundlage' }))
      .toBeInTheDocument()
    expect(within(baseline).getByText(
      'Gemeinsame Basis für alle Opportunity Options dieses Projekts.',
    )).toBeInTheDocument()

    const primary = baseline.querySelector('.a3-project-baseline-primary-grid')!
    expect(primary.children).toHaveLength(4)
    expect(primary).toHaveTextContent('Gebäude im Projekt')
    expect(primary).toHaveTextContent('Total WFL nach WoFlV')
    expect(primary).toHaveTextContent('Total NUF nach DIN 277')
    expect(primary).toHaveTextContent('Wohneinheiten')

    const breakdown = within(baseline).getByRole('heading', {
      name: 'Bruttogeschossfläche (BGF)',
    }).parentElement!
    expect(breakdown).toHaveTextContent(/3\.200,00\s*m²/)
    expect(breakdown).toHaveTextContent(/\+\s*160,00\s*m²/)
    expect(breakdown).toHaveTextContent(/=\s*3\.360,00\s*m²/)
    expect(breakdown).toHaveTextContent(/→\s*2\.720,00\s*m²/)

    // Eight values remain, now with seven truthful origins. The structural
    // building count intentionally has no fabricated provenance.
    expect(baseline.querySelectorAll('dt')).toHaveLength(8)
    expect(baseline.querySelectorAll('dd')).toHaveLength(8)
    expect(within(baseline).getAllByLabelText(/^Herkunft:/)).toHaveLength(7)
    expect(within(baseline).getAllByLabelText(/^Herkunft: abgeleitet/)).toHaveLength(3)
    expect(baseline).toHaveTextContent(/≈\s*85\s*%\s*der BGF R\+S/)
    expect(baseline).not.toHaveTextContent('⚙')

    expect(screen.getByText(
      'Vorbereitung · Offene Fragen: 2 · Aktive Annahmen: 2',
    )).toBeInTheDocument()
  })

  it('keeps changed-since-confirmation visible after the Delta-Chip timeout and reconfirms with focus and journal evidence', () => {
    vi.useFakeTimers()
    openProjectCard()

    fireEvent.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    const confirmed = screen.getByText('Bestätigt · Projektgrundlage aktuell')
    expect(document.activeElement).toBe(confirmed)

    fireEvent.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    const staleSentence = screen.getByText(/Geändert seit der Bestätigung/)
    const stale = staleSentence.closest('[role="status"]')!
    expect(stale).toHaveTextContent('Geändert seit der Bestätigung: WFL nach WoFlV')
    expect(screen.getByRole('button', { name: 'Erneut bestätigen' })).toBeInTheDocument()
    expect(screen.getByText(
      'Vorbereitung · Offene Fragen: 1 · Aktive Annahmen: 2',
    )).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(DELTA_CHIP_MS + 100))
    expect(screen.getByText(/Geändert seit der Bestätigung/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Erneut bestätigen' })).toBeInTheDocument()

    const confirmationsBefore = useStore.getState().journal.filter((event) =>
      event.label === PROJECT_PARAMS_CONFIRMATION_LABEL).length
    fireEvent.click(screen.getByRole('button', { name: 'Erneut bestätigen' }))

    expect(screen.queryByText(/Geändert seit der Bestätigung/)).not.toBeInTheDocument()
    const current = screen.getByText('Bestätigt · Projektgrundlage aktuell')
    expect(document.activeElement).toBe(current)
    expect(useStore.getState().journal.filter((event) =>
      event.label === PROJECT_PARAMS_CONFIRMATION_LABEL)).toHaveLength(confirmationsBefore + 1)
  })

  it('shows manual WFL authority separately from the stale confirmation lifecycle', () => {
    openProjectCard()
    fireEvent.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))

    act(() => useStore.getState().editField('wfl', new Decimal('1510'), false))

    const baseline = screen.getByRole('region', { name: 'Projektparameter' })
    expect(within(baseline).getByLabelText('Herkunft: manuell erfasst')).toBeInTheDocument()
    expect(within(baseline).getByText(/Geändert seit der Bestätigung: WFL nach WoFlV/))
      .toBeInTheDocument()
    expect(useStore.getState().projectParamsConfirmed).toBe(true)
  })
})
