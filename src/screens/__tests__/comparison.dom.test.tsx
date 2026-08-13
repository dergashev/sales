import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { S4Vergleich } from '../S4Vergleich'
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
})
