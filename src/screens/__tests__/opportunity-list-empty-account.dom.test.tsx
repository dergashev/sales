import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../../App'
import { __resetStoreForTests } from '../../state/store'

/**
 * TASK 04 (backlog `e2337966`), AC 4/6: „keine Opportunities vorhanden"
 * (Konto/Fixture selbst leer) muss von „kein Treffer" (Filter greifen)
 * unterscheidbar bleiben — nie derselbe Text, und der Konto-Leerzustand
 * bietet KEINEN Reset-Weg an: es gibt nichts zurückzusetzen.
 *
 * Das Register speist sich jetzt aus ZWEI Fixtures: den navigierbaren
 * Projekten (`vr3-demo-projects.json`, über `state/projectAnalysis.ts`) und
 * den reinen Anzeige-Datensätzen (`portfolio-display-projects.json`, über
 * `state/projectPortfolio.ts`). Der Konto-Leerzustand hängt an der SUMME
 * beider, also müssen beide leer sein — ein Mock von nur einer Quelle würde
 * drei Karten stehen lassen und den Zweig gar nicht erreichen.
 *
 * Das reale Register trägt IMMER fünf Einträge (Fixture-Invariante des
 * Tickets), deshalb ist dieser Pfad in der App nie live erreichbar; diese
 * Modul-Mocks sind die einzige Möglichkeit, den Zweig überhaupt zu
 * durchlaufen und ihn nicht bloß per Code-Lesen zu behaupten. Eigene
 * Testdatei, damit die Mocks nicht in die übrigen Projektlisten-Tests
 * hineinwirken (`vi.mock` gilt pro Testdatei).
 */
vi.mock('../../fixtures/vr3-demo-projects.json', () => ({
  default: { normalListProjectCount: 0, projects: [] },
}))
vi.mock('../../fixtures/portfolio-display-projects.json', () => ({
  default: { displayOnlyProjectCount: 0, projects: [] },
}))

beforeEach(() => __resetStoreForTests())

describe('Opportunities — Konto-Leerzustand', () => {
  it('zeigt einen eigenen Text, wenn die Fixture selbst leer ist — nicht den Filter-Leertext', () => {
    render(<App />)
    expect(screen.getByText('Es sind noch keine Opportunities vorhanden.')).toBeInTheDocument()
    expect(screen.getByText(
      'Neue Opportunities erscheinen hier automatisch, sobald sie aus HubSpot übernommen werden.',
    )).toBeInTheDocument()
    // Der Filter-Leertext ist ein ANDERER Satz und existiert hier nicht.
    expect(screen.queryByText(/Kein Projekt entspricht/)).not.toBeInTheDocument()
    // Kein Reset-Weg: es gibt nichts zurückzusetzen (Design-Handoff #5).
    // Stärker als „kein Knopf mit Namen X": der Leerzustand trägt
    // ÜBERHAUPT keine Aktion, während der Filter-Zweig genau eine trägt.
    const emptyState = screen.getByText('Es sind noch keine Opportunities vorhanden.')
      .closest('.a3-pf-empty')!
    expect(emptyState.querySelectorAll('button')).toHaveLength(0)
    // Das editoriale Resümee nennt die Portfolio-Größe aus der Fixture —
    // bei leerer Fixture also null Projekte.
    expect(screen.getByText('Demonstrationsportfolio · 0 Projekte')).toBeInTheDocument()
  })
})
