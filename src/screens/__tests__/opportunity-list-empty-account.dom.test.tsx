import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../../App'
import { __resetStoreForTests } from '../../state/store'

/**
 * TASK 04 (backlog `e2337966`), AC 4/6: „keine Opportunities vorhanden"
 * (Konto/Fixture selbst leer) muss von „kein Treffer" (Filter greifen)
 * unterscheidbar bleiben — nie derselbe Text. Die reale Fixture hat immer
 * acht Zeilen, deshalb ist dieser Pfad in der App nie live erreichbar;
 * dieses Modul-Mock ist die einzige Möglichkeit, den Zweig überhaupt zu
 * durchlaufen und ihn nicht bloß per Code-Lesen zu behaupten. Eigene
 * Testdatei, damit der Mock nicht in die übrigen Opportunities-Tests
 * hineinwirkt (`vi.mock` gilt pro Testdatei).
 */
vi.mock('../../fixtures/opportunities.json', () => ({
  default: { items: [] },
}))

beforeEach(() => __resetStoreForTests())

describe('Opportunities — Konto-Leerzustand', () => {
  it('zeigt einen eigenen Text, wenn die Fixture selbst leer ist — nicht den Filter-Leertext', () => {
    render(<App />)
    expect(screen.getByText('Es sind noch keine Opportunities vorhanden.')).toBeInTheDocument()
    expect(screen.getByText(
      'Neue Opportunities erscheinen hier automatisch, sobald sie aus HubSpot übernommen werden.',
    )).toBeInTheDocument()
    expect(screen.queryByText(/Keine Opportunity entspricht den Filtern/)).not.toBeInTheDocument()
    // Kein Reset-Weg: es gibt nichts zurückzusetzen (Design-Handoff #5).
    expect(screen.queryByRole('button', { name: 'Alle Filter zurücksetzen' })).not.toBeInTheDocument()
    expect(screen.getByText('0 Projekte · 0 mit Termin')).toBeInTheDocument()
  })
})
