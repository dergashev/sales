import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { App } from '../../App'
import { DELTA_CHIP_MS } from '../../config/ui-policy'
import derived from '../../fixtures/derived-prototype.json'
import demo from '../../fixtures/demo-0001.json'
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

    // F-09 fix (deep-coherence audit, Task 01): every row sums an
    // independently reviewed `buildingReviews` fact, never the fixture's
    // derived-balcony proxy that produced the old "+160 m² abgeleitet"
    // contradiction against the building reviews (documented BGF S = 0,
    // per D-26 — the derived balcony share is deliberately not reused as
    // DIN 277 BGF S).
    //
    // AUD-02 fix: the equation used to stop at "R + S" and call that sum
    // "Total BGF (R+S)" — silently above-ground-only, while the Option's
    // building cards and the fixture's own `sumBgfRS` (3.600,00) both mean
    // the grand total including underground. The equation now names and
    // includes the underground term so "R + S + unterirdisch = R+S,
    // gesamt" actually holds, and the total matches every other surface
    // that shows the same concept (see the reconciliation test below).
    const breakdown = within(baseline).getByRole('heading', {
      name: 'Bruttogeschossfläche (BGF)',
    }).parentElement!
    expect(breakdown).toHaveTextContent(/3\.200,00\s*m²/)
    expect(breakdown).toHaveTextContent(/\+\s*0,00\s*m²/)
    expect(breakdown).toHaveTextContent(/\+\s*400,00\s*m²/)
    expect(breakdown).toHaveTextContent(/=\s*3\.600,00\s*m²/)

    // Eight values remain (the fabricated NRF≈85%-of-R+S row is gone along
    // with it — it had no backing buildingReviews fact at all; AUD-02 adds
    // back exactly one truthful row, the underground term), all with
    // truthful origins. The structural building count intentionally has no
    // fabricated provenance, and none of the remaining values are "derived"
    // any more — every one is a real, document-sourced reviewed fact.
    expect(baseline.querySelectorAll('dt')).toHaveLength(8)
    expect(baseline.querySelectorAll('dd')).toHaveLength(8)
    // Scoped to the primary-facts grid + BGF equation specifically: the
    // per-building facts table further down this same section carries its
    // own provenance chips too (AC4), which is additional, not duplicate,
    // information (per-building vs. project-total), so it is intentionally
    // excluded from this dt/dd-scoped count.
    expect(within(primary as HTMLElement).getAllByLabelText(/^Herkunft:/).length
      + within(breakdown as HTMLElement).getAllByLabelText(/^Herkunft:/).length).toBe(7)
    expect(within(baseline).queryAllByLabelText(/^Herkunft: abgeleitet/)).toHaveLength(0)
    expect(within(baseline).queryByText(new RegExp(derived.provenanceLabel))).not.toBeInTheDocument()
    expect(baseline).not.toHaveTextContent(/≈\s*85\s*%\s*der BGF R\+S/)

    // The former teaser line duplicated exactly what stage 3 (Offene Fragen
    // & Annahmen) already shows in full on this same page — dissolved along
    // with the separate "· Vorbereitung" workspace it used to open (AC1/AC2).
    expect(screen.queryByText(/^Vorbereitung ·/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vorbereitung öffnen' })).not.toBeInTheDocument()
    expect(screen.getByText(/Diese 2 Fragen reduzieren die Schätzunsicherheit/)).toBeInTheDocument()
  })

  // AUD-02 (AC-1/AC-3): one aggregation truth for BGF R+S. This asserts the
  // Project Card's "Total BGF (R+S, gesamt)" against the fixture's OWN
  // numbers directly (not a hardcoded literal), so it stays true for
  // whatever `demo-0001.json` says rather than merely mirroring today's
  // values — and it fails loudly if the aggregation ever drifts from the
  // fixture again (rule 32: a number that doesn't reconcile with its own
  // fixture is a release-blocker).
  it('reconciles the Project Card BGF R+S total with the fixture\'s own bgfRS sums', () => {
    const complexRun = demo.runs.find((run) => run.subject === 'complex')
    if (!complexRun) throw new Error('demo-0001.json fixture is missing its "complex" run entry')
    const fixtureSumBgfRS = new Decimal((complexRun as { sumBgfRS: string }).sumBgfRS)

    // Self-check: the fixture's own per-building `bgfRS` values already sum
    // to its `sumBgfRS` — if this ever stopped being true the fixture
    // itself would be internally inconsistent, independent of any UI code.
    const perBuildingSum = demo.buildings.reduce(
      (total, b) => total.plus(new Decimal(b.areas.bgfRS)),
      new Decimal(0),
    )
    expect(perBuildingSum.toFixed(2)).toBe(fixtureSumBgfRS.toFixed(2))

    openProjectCard()
    const baseline = screen.getByRole('region', { name: 'Projektparameter' })
    const breakdown = within(baseline).getByRole('heading', {
      name: 'Bruttogeschossfläche (BGF)',
    }).parentElement!

    // The building cards further down the same option surface print this
    // exact per-building fact too ("BGF R+S · gesamt") — this only asserts
    // the Project Card side of the reconciliation the fixture already
    // proves is internally consistent above.
    const match = breakdown.textContent!.match(/=\s*([\d.,]+)\s*m²/)
    if (!match) throw new Error('Could not locate the "Total BGF (R+S, gesamt)" value in the breakdown')
    const displayedValue = new Decimal(match[1]!.replace(/\.(?=\d{3})/g, '').replace(',', '.'))
    expect(displayedValue.toFixed(2)).toBe(fixtureSumBgfRS.toFixed(2))
  })

  it('keeps changed-since-confirmation visible after the Delta-Chip timeout and reconfirms with focus and journal evidence', () => {
    vi.useFakeTimers()
    openProjectCard()

    fireEvent.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    const confirmed = screen.getByText('Bestätigt · Projektgrundlage aktuell')
    expect(document.activeElement).toBe(confirmed)

    fireEvent.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    expect(screen.queryByText('Bestätigt · Projektgrundlage aktuell')).not.toBeInTheDocument()
    expect(screen.getByText('Bestätigt · nicht mehr aktuell')).toBeInTheDocument()
    const staleSentence = screen.getByText(/Geändert seit der Bestätigung/)
    const stale = staleSentence.closest('[role="status"]')!
    expect(stale).toHaveTextContent('Geändert seit der Bestätigung: WFL nach WoFlV')
    expect(screen.getByRole('button', { name: 'Erneut bestätigen' })).toBeInTheDocument()
    // The former duplicated "Bereitschaft für Optionen" checklist is gone
    // (AC2) — the one progress model (the stage overview) already names
    // this, and the create-option gate itself carries the actionable state:
    // AC6, staleness must not silently re-block option creation.
    expect(screen.queryByRole('group', { name: 'Bereitschaft für Optionen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
      .not.toHaveAttribute('aria-disabled')

    act(() => vi.advanceTimersByTime(DELTA_CHIP_MS + 100))
    expect(screen.getByText(/Geändert seit der Bestätigung/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Erneut bestätigen' })).toBeInTheDocument()

    const confirmationsBefore = useStore.getState().journal.filter((event) =>
      event.label === PROJECT_PARAMS_CONFIRMATION_LABEL).length
    fireEvent.click(screen.getByRole('button', { name: 'Erneut bestätigen' }))

    expect(screen.queryByText(/Geändert seit der Bestätigung/)).not.toBeInTheDocument()
    const current = screen.getByText('Bestätigt · Projektgrundlage aktuell')
    expect(document.activeElement).toBe(current)
    expect(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
      .not.toHaveAttribute('aria-disabled')
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
    expect(within(baseline).queryByText('Bestätigt · Projektgrundlage aktuell'))
      .not.toBeInTheDocument()
    expect(within(baseline).getByText('Bestätigt · nicht mehr aktuell')).toBeInTheDocument()
    expect(useStore.getState().projectParamsConfirmed).toBe(true)
  })
})
