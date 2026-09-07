import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell } from '../PresentationShell'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * VR3-05 — what the scenario dialogs SAY about one change and about a name
 * that is already taken.
 *
 * Both assertions below are regressions on defects the browser loop found
 * and source review had not:
 *
 * 1. THE COUNTED SENTENCE. The store discriminates one change from many, so
 *    a presenter with a single what-if must never read "1 Änderungen
 *    verwerfen" in the revert dialog or "1 Szenario-Änderungen" in the save
 *    summary. German plural is not optional here.
 *
 * 2. A BLOCKED CONTROL STATES ITS OWN REASON. Save as New is blocked by TWO
 *    constraints — no name, and a name another Option already carries — and
 *    `commitScenarioSaveAsNew` tells them apart (`nameEmpty` / `nameTaken`).
 *    The button's `disabledReason` must name the one actually blocking it.
 *
 * Structure since VR3-CP-00: Client Mode opens directly on chapter 1; the
 * what-if state is a slot of the one presenter bar (label
 * "Was-wäre-wenn-Stand", delta, "Zurücksetzen", "Als neue Option
 * speichern"), present only while the scenario has changes.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** The saved complex Option the fixture specification describes, presented. */
function presentSavedComplexOption() {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  completeBuildingScope('PER_BUILDING')
  completeKgConfiguration()
  saveOptionBaseline()
  act(() => { useStore.getState().setMode('praesentation') })
}

describe('VR3-05 · one scenario change reads as one', () => {
  it('the revert dialog and the save summary agree with the store about a single change', async () => {
    const user = userEvent.setup()
    presentSavedComplexOption()
    render(<Harness />)
    // Without changes the bar carries no what-if slot at all.
    expect(screen.queryByText('Was-wäre-wenn-Stand')).toBeNull()

    act(() => { useStore.getState().setPresentationDecision('heatStrategy', 'perBuilding') })
    expect(st().clientScenario!.changes).toHaveLength(1)

    // The bar's slot appears with exactly one change on record.
    await waitFor(() => expect(screen.getByText('Was-wäre-wenn-Stand')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
    const revert = await screen.findByRole('dialog')
    expect(revert).toHaveTextContent(
      'Eine temporäre Änderung wird verworfen. Das vorgestellte Angebot bleibt unverändert.',
    )
    expect(revert).not.toHaveTextContent('1 temporäre Änderungen')
    // The confirming verb counts the same way.
    expect(screen.getByRole('button', { name: 'Änderung verwerfen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 Änderungen verwerfen' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Weiter ansehen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Als neue Option speichern' }))
    const save = await screen.findByRole('dialog')
    expect(save).toHaveTextContent(/Eine Szenario-Änderung wird übernommen/)
    expect(save).not.toHaveTextContent('1 Szenario-Änderungen')
  })
})

describe('VR3-05 · Save as New states the constraint that is actually blocking it', () => {
  it('names the empty field when empty and the taken name when taken', async () => {
    const user = userEvent.setup()
    presentSavedComplexOption()
    render(<Harness />)

    act(() => { useStore.getState().setPresentationDecision('heatStrategy', 'perBuilding') })
    await user.click(await screen.findByRole('button', { name: 'Als neue Option speichern' }))
    await screen.findByRole('dialog')

    const field = screen.getByLabelText('NAME DER OPTION')
    const sourceName = st().options.find((o) => o.id === st().activeOptionId)!.name
    // Re-queried each time: the canonical Button changes shape when it
    // starts carrying a blocked reason, so a captured node goes stale.
    const confirm = () => screen.getByRole('button', { name: 'Neue Option speichern' })
    // The canonical Button omits the attribute when it is not blocking.
    const blocked = () => confirm().getAttribute('aria-disabled') === 'true'
    const reason = () => confirm().getAttribute('title')

    // A proposed name is available, so nothing is blocked yet.
    expect(blocked()).toBe(false)

    // EMPTY: the reason is the missing name.
    await user.clear(field)
    await waitFor(() => expect(blocked()).toBe(true))
    expect(reason()).toBe('Bitte einen Namen für die neue Option angeben.')

    // TAKEN: a name IS present, so the reason must be the collision.
    await user.type(field, sourceName)
    await waitFor(() => expect(field).toHaveValue(sourceName))
    expect(blocked()).toBe(true)
    expect(reason()).toBe('Dieser Name ist bereits vergeben. Bitte einen anderen wählen.')

    // And a free name unblocks it, so the gate is about the name and not
    // about the dialog having been shown an error once.
    await user.clear(field)
    await user.type(field, 'Szenario Wärme dezentral')
    await waitFor(() => expect(blocked()).toBe(false))
  })
})
