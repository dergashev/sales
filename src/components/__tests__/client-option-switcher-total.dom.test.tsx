import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell } from '../PresentationShell'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'
import {
  latestSavedOptionVersion,
  projectionForOption,
  useStore,
  __resetStoreForTests,
} from '../../state/store'

/**
 * VR3-05 — ONE Option has ONE client-facing number, on every path that
 * states it.
 *
 * The rule already stood in `OptionSwitcher`, written out above `segments`:
 * an Option's client-facing total is the one its SAVE committed
 * (`SavedOptionVersion.result.totalDisplay`), never the legacy proposal
 * projection. It had been applied to `segments` — and to `segments` only.
 * The same function's other two statements of the same number still read
 * `c.p.result.total`:
 *
 *   - the `sr-only` `aria-live` announcement fired on every switch, so a
 *     screen-reader user heard ≈ 3.980.000 € for the Option sighted users
 *     saw priced at 38.430.000 €;
 *   - the `SelectField` branch that replaces the segmented control above
 *     three Options — which Save as New makes ordinary to reach — printed
 *     the same wrong number visibly.
 *
 * This is the failure mode [[vr3-unified-konfigurator]] recorded as "a rule
 * that lives in each action's memory is a rule the next action forgets",
 * and the switcher is where [[vr3-client-presentation-scenarios]] already
 * recorded "two engines, one Option" once. So this file does not assert a
 * formatted string. It asserts the INVARIANT across BOTH switcher branches:
 * every number the switcher states about an Option is that Option's saved
 * total, and the legacy projection's total appears nowhere.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** Save `count` client-eligible Options off the complex fixture. */
function buildSavedOptions(count: number): string[] {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  const ids: string[] = []
  const first = st().activeOptionId!
  act(() => { st().renameOption(first, 'Option A') })
  completeBuildingScope('PER_BUILDING')
  completeKgConfiguration()
  saveOptionBaseline()
  ids.push(first)

  for (let n = 1; n < count; n += 1) {
    const id = st().createOption(`Option ${String.fromCharCode(65 + n)}`)!
    act(() => { st().openOption(id) })
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    saveOptionBaseline()
    ids.push(id)
  }

  act(() => { st().openOption(first) })
  act(() => { st().setMode('praesentation') })
  return ids
}

async function startPresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Präsentation starten' }))
}

/** The saved total the switcher is required to state, and the legacy one it
 *  must never state. Both read from the store, so neither is a literal. */
function totals(id: string) {
  const saved = latestSavedOptionVersion(st(), id)!.result.totalDisplay
  const legacy = projectionForOption(st(), id)!.result.total.exact
  return { saved, legacy }
}

/** `1234567` → `1.234.567`, the grouping the switcher would have printed.
 *  The two engines' totals differ by an order of magnitude, so this is a
 *  decisive discriminator even when two Options price identically. */
function grouped(value: { toFixed: (n: number) => string }): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(Number(value.toFixed(2))))
}

describe('VR3-05 · the client Option switcher states one number per Option', () => {
  it('the segmented control and its announcement both state the SAVED total', async () => {
    const user = userEvent.setup()
    const [a, b] = buildSavedOptions(2)
    render(<Harness />)
    await startPresentation(user)

    const switcher = screen.getByRole('radiogroup', { name: 'Ansicht' })
    const first = totals(a!)

    // The visible segment and the polite announcement agree, and both agree
    // with the Option's own saved record. Queried by NAME, then read for the
    // number: two Options may legitimately price the same, so the number is
    // never the identifier here.
    const segment = (name: string) =>
      within(switcher).getByRole('radio', { name: new RegExp(name) })
        .closest('label') as HTMLElement
    expect(segment('Option A')).toHaveTextContent(first.saved)
    expect(segment('Option A')).not.toHaveTextContent(grouped(first.legacy))
    const announcement = () => screen.getByText(/^Ansicht:/)
    expect(announcement()).toHaveTextContent(first.saved)
    // And never the second engine's total for the same Option.
    expect(announcement()).not.toHaveTextContent(grouped(first.legacy))

    // Switching restates the number, still from the saved record.
    const second = totals(b!)
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))
    await waitFor(() => expect(st().viewedOptionId).toBe(b))
    expect(announcement()).toHaveTextContent(second.saved)
    expect(announcement()).not.toHaveTextContent(grouped(second.legacy))
  })

  it('the >3-Option select branch states the SAVED total too', async () => {
    const user = userEvent.setup()
    const ids = buildSavedOptions(4)
    render(<Harness />)
    await startPresentation(user)

    // Above three Options the segmented control is replaced by the
    // canonical select (LOCALE-004) — the branch that kept the defect.
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()
    const select = screen.getByLabelText('Ansicht')

    ids.forEach((id, index) => {
      const { saved, legacy } = totals(id)
      const name = `Option ${String.fromCharCode(65 + index)}`
      const option = within(select).getByRole('option', { name: new RegExp(name) })
      expect(option).toHaveTextContent(saved)
      expect(option).not.toHaveTextContent(grouped(legacy))
    })
  })
})
