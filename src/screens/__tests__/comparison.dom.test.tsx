import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { S4Vergleich } from '../S4Vergleich'
import { OfferPanel } from '../../components/OfferPanel'
import { __resetStoreForTests, useStore } from '../../state/store'

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

describe('Variantenvergleich', () => {
  it('keeps each Option lead-rate denominator in its own comparison cell', () => {
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Nur Haus A')
    st().createOption('Komplex')
    st().setBuildingFactOverride('DEMO-B-B', 'wfl', new Decimal('900'))
    st().toggleBuildingIncluded('DEMO-B-B')

    render(<S4Vergleich />)

    const row = screen.getByRole('row', { name: /Leitkennzahl/ })
    expect(within(row).getByRole('rowheader')).toHaveTextContent(/^Leitkennzahl$/)
    const cells = within(row).getAllByRole('cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent(/€\/m² WFL nach WoFlV/)
    expect(cells[1]).toHaveTextContent(/€\/m² BGF oberirdisch/)
  })

  /**
   * Tech Review Zyklus 2, P1: `OfferPanel` liest `s.projection()`,
   * `S4Vergleich` liest für jede Spalte `projectionForOption` ->
   * `projectProjection`. Beides sind Ansichten DERSELBEN aktiven Option und
   * beide standen gleichzeitig auf demselben client-sichtbaren Bildschirm
   * (App.tsx rendert OfferPanel neben der jeweiligen Hauptansicht) — ein
   * gewählter Baubeginn, der nur den einen Lesepfad verschob, ließ die
   * beiden ein widersprüchliches Fertigstellungsdatum zeigen. Beide
   * Komponenten werden hier unabhängig gegen denselben Store gerendert, um
   * genau diese Regression direkt zu prüfen, ohne über die volle
   * App-Navigation zu gehen.
   */
  it('OfferPanel und Variantenvergleich zeigen für dieselbe Option dieselbe Fertigstellung', () => {
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Basis')
    st().openOption('OPT-01')
    st().setConstructionStartDate('2027-03-01')

    render(<OfferPanel />)
    render(<S4Vergleich />)

    expect(screen.getByText(/Fertigstellung 14\.01\.2028/)).toBeInTheDocument()
    const row = screen.getByRole('row', { name: /Fertigstellung/ })
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('14.01.2028')
    expect(screen.queryByText(/19\.11\.2027/)).not.toBeInTheDocument()
  })
})
