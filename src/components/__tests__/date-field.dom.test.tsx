import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateField } from '../controls'

function DateHarness({ onCommit }: { onCommit: (date: Date | null, confirmed: boolean) => void }) {
  const [value, setValue] = useState<Date | null>(new Date(2027, 0, 4))
  return (
    <DateField
      label="Baubeginn"
      helperText="Verschiebt Termine, nicht die Bauzeit."
      value={value}
      onCommit={(next, confirmed) => {
        onCommit(next, confirmed)
        setValue(next)
      }}
    />
  )
}

describe('DateField', () => {
  it('commits only valid German calendar dates and keeps label, helper, and error together', () => {
    const onCommit = vi.fn()
    render(<DateHarness onCommit={onCommit} />)

    const input = screen.getByLabelText('Baubeginn') as HTMLInputElement
    expect(input).toHaveValue('04.01.2027')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAccessibleDescription('Verschiebt Termine, nicht die Bauzeit.')

    fireEvent.change(input, { target: { value: '31.02.2027' } })
    fireEvent.blur(input)
    expect(screen.getByRole('alert')).toHaveTextContent('Ungültiges Datum — Format TT.MM.JJJJ')
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '01.03.2027' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledTimes(1)
    const [date, confirmed] = onCommit.mock.calls[0]!
    expect(date).toMatchObject({ getFullYear: expect.any(Function) })
    expect((date as Date).getFullYear()).toBe(2027)
    expect((date as Date).getMonth()).toBe(2)
    expect((date as Date).getDate()).toBe(1)
    expect(confirmed).toBe(true)
    expect(input).toHaveValue('01.03.2027')
  })

  it('restores the last committed date on Escape without changing persistence authority', () => {
    const onCommit = vi.fn()
    render(<DateHarness onCommit={onCommit} />)
    const input = screen.getByLabelText('Baubeginn') as HTMLInputElement

    fireEvent.change(input, { target: { value: '12.12.2030' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(input).toHaveValue('04.01.2027')
    expect(onCommit).not.toHaveBeenCalled()
  })
})
