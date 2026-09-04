import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox, type ComboboxOption } from '../../components/controls'
import { __resetStoreForTests } from '../../state/store'
import { COMPONENT_REGISTRY } from '../registry'

/**
 * The canonical searchable single-select combobox.
 *
 * These are the ARIA 1.2 combobox contract and the three behaviours the
 * implementation exists to guarantee: the field never keeps an uncommitted
 * query, the result count is announced without shouting per keystroke, and
 * a failed option load keeps the selection and offers a retry.
 */
beforeEach(() => __resetStoreForTests())

const OPTIONS: ComboboxOption[] = [
  { value: '', label: 'Alle' },
  { value: 'Hamburg', label: 'Hamburg' },
  { value: 'Leipzig', label: 'Leipzig' },
  { value: 'Wien', label: 'Wien' },
]

type HarnessProps = Omit<Parameters<typeof Combobox>[0], 'id' | 'label' | 'value' | 'onChange'>

/** The harness owns the value, exactly as the real consumer does. */
function Harness({ initial = '', ...props }: Partial<HarnessProps> & { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <Combobox
      id="city"
      label="Stadt"
      options={OPTIONS}
      {...props}
      value={value}
      onChange={setValue}
    />
  )
}

const input = () => screen.getByLabelText('Stadt')
const listbox = () => screen.getByRole('listbox', { name: 'Stadt · Vorschläge' })

describe('ARIA structure', () => {
  it('puts the combobox role on the input and names its popup distinctly', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(input()).toHaveAttribute('role', 'combobox')
    expect(input()).toHaveAttribute('aria-autocomplete', 'list')
    expect(input()).toHaveAttribute('aria-expanded', 'false')
    expect(input()).toHaveAttribute('aria-controls', 'city-listbox')
    // The popup exists in the DOM even while closed: `aria-controls` must
    // point at a node that is there.
    expect(document.getElementById('city-listbox')).not.toBeNull()
    await user.click(input())
    // Its name is NOT the field's own — two identical accessible names on
    // one control make «the thing called Stadt» ambiguous.
    expect(listbox()).toHaveAttribute('aria-label', 'Stadt · Vorschläge')
  })

  it('keeps a persistent visible label', () => {
    render(<Harness />)
    const label = document.querySelector('label[for="city"]')!
    expect(label).toHaveTextContent('Stadt')
    expect(label.className).not.toMatch(/sr-only/)
  })
})

describe('the keyboard contract', () => {
  it('stays quiet on Tab, opens on ArrowDown, wraps, and commits on Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    expect(input()).toHaveFocus()
    // Focus alone does not pop a list open.
    expect(input()).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{ArrowDown}')
    expect(input()).toHaveAttribute('aria-expanded', 'true')
    expect(input()).toHaveAttribute('aria-activedescendant', 'city-option-0')

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input()).toHaveAttribute('aria-activedescendant', 'city-option-2')
    // Wraps at the end rather than dead-ending.
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input()).toHaveAttribute('aria-activedescendant', 'city-option-0')
    await user.keyboard('{ArrowUp}')
    expect(input()).toHaveAttribute('aria-activedescendant', 'city-option-3')

    await user.keyboard('{Enter}')
    expect((input() as HTMLInputElement).value).toBe('Wien')
    expect(input()).toHaveAttribute('aria-expanded', 'false')
    expect(input()).toHaveFocus()
  })

  it('jumps to first and last with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(input())
    await user.keyboard('{End}')
    expect(input()).toHaveAttribute('aria-activedescendant', 'city-option-3')
    await user.keyboard('{Home}')
    expect(input()).toHaveAttribute('aria-activedescendant', 'city-option-0')
  })

  it('addresses options by position, never by a value that is not id-safe', async () => {
    const user = userEvent.setup()
    render(<Harness options={[{ value: 'a b', label: 'Lena Hoffmann' }]} />)
    await user.click(input())
    // An id with a space is invalid and unresolvable as an IDREF.
    const active = input().getAttribute('aria-activedescendant')!
    expect(active).not.toMatch(/\s/)
    expect(document.getElementById(active)).not.toBeNull()
  })

  it('narrows the list as the query is typed, case-insensitively', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(input())
    await user.type(input(), 'I')
    expect(within(listbox()).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Leipzig', 'Wien'])
  })

  it('says «no match» rather than showing an empty popup', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(input())
    await user.type(input(), 'zzz')
    expect(within(listbox()).queryAllByRole('option')).toHaveLength(0)
    expect(within(listbox()).getByText('Keine Übereinstimmung')).toBeInTheDocument()
  })
})

describe('the field never keeps an uncommitted query', () => {
  it('restores the selected label on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(input())
    await user.keyboard('{ArrowDown}{Enter}')
    expect((input() as HTMLInputElement).value).toBe('Hamburg')

    // Re-opening clears the visible text so a new query needs no deleting.
    // The selection is still on screen twice: as the field's placeholder and
    // as the tick in the list.
    await user.type(input(), 'Lei')
    expect((input() as HTMLInputElement).value).toBe('Lei')
    expect(input()).toHaveAttribute('placeholder', 'Hamburg')

    await user.keyboard('{Escape}')
    // Not «Lei»: the screen would be claiming a filter nobody committed.
    expect((input() as HTMLInputElement).value).toBe('Hamburg')
    expect(input()).toHaveAttribute('aria-expanded', 'false')
  })

  it('restores it on an outside pointer dismissal too', async () => {
    const user = userEvent.setup()
    render(<><Harness /><button type="button">elsewhere</button></>)
    await user.click(input())
    await user.keyboard('{ArrowDown}{Enter}')
    await user.type(input(), 'xyz')
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect((input() as HTMLInputElement).value).toBe('Hamburg')
  })
})

describe('announcement discipline', () => {
  it('announces the result count once the set settles, not per keystroke', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const live = () => document.getElementById('city-status')!

    await user.click(input())
    await user.type(input(), 'i')
    // Silent while the query is still being typed.
    expect(live().textContent).toBe('')
    await waitFor(() => expect(live().textContent).toBe('2 Treffer'), { timeout: 2000 })
    expect(live()).toHaveAttribute('aria-live', 'polite')
  })
})

describe('the seven data states', () => {
  it('loading and empty both block the field, each for its own reason', () => {
    const { unmount } = render(<Harness loading />)
    expect(input()).toBeDisabled()
    unmount()
    render(<Harness options={[]} />)
    expect(input()).toBeDisabled()
  })

  it('an error keeps the last valid selection visible and offers retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(<Harness initial="Hamburg" />)
    expect((input() as HTMLInputElement).value).toBe('Hamburg')

    // The option source then fails and can no longer name the value.
    rerender(
      <Harness
        initial="Hamburg"
        options={[]}
        error="Die Liste konnte nicht geladen werden."
        onRetry={onRetry}
      />,
    )
    // The selection survives the failed load — the last valid filter state
    // matters more than an empty list.
    expect((input() as HTMLInputElement).value).toBe('Hamburg')
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Die Liste konnte nicht geladen werden.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('states permission, staleness and partiality separately, never merged', () => {
    render(
      <Harness
        disabled
        disabledReason="Keine Berechtigung."
        stale="Die Liste ist seit 10:00 nicht aktualisiert."
        partial="Es fehlen archivierte Einträge."
      />,
    )
    expect(input()).toBeDisabled()
    expect(screen.getByText('Keine Berechtigung.')).toBeInTheDocument()
    expect(screen.getByText('Die Liste ist seit 10:00 nicht aktualisiert.')).toBeInTheDocument()
    expect(screen.getByText('Es fehlen archivierte Einträge.')).toBeInTheDocument()
    expect(input().getAttribute('aria-describedby')).toBe('city-note')
  })
})

describe('the registry specimens actually mount', () => {
  it('renders the Combobox specimen with every declared data state visible', () => {
    const specimen = COMPONENT_REGISTRY.find((s) => s.id === 'combobox')!
    // The registry declares all seven data states for this capability, so
    // the specimen has to SHOW them — a catalogue that declares `error` and
    // renders only `ready` documents an intention, not a component.
    expect(Object.values(specimen.dataStates).every((v) => v === 'supported')).toBe(true)
    render(specimen.render())
    expect(screen.getByLabelText('Stadt')).toHaveAttribute('role', 'combobox')
    expect(screen.getByLabelText('Stadt · loading')).toBeDisabled()
    expect(screen.getByText('Die Liste konnte nicht geladen werden.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeInTheDocument()
    expect(screen.getByText('Für diese Rolle nicht verfügbar.')).toBeInTheDocument()
    expect(screen.getByText('Stand 10:00 — seitdem nicht aktualisiert.')).toBeInTheDocument()
    expect(screen.getByText('Archivierte Einträge fehlen.')).toBeInTheDocument()
  })

  it('renders the compact SegmentedControl specimen with R-04 geometry intact', () => {
    const specimen = COMPONENT_REGISTRY.find((s) => s.id === 'segmented-compact')!
    render(specimen.render())
    const group = screen.getByRole('radiogroup', { name: 'Sprache' })
    // The compact size is opt-in on the canonical control, not a fork of it.
    expect(group.closest('fieldset')).toHaveAttribute('data-size', 'compact')
    // Every segment keeps the 44 × 44 press/focus overlay.
    for (const label of group.querySelectorAll('label')) {
      expect(label.className).toContain('hit-target')
    }
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
  })
})
