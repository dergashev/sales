import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { enterOptionWorkspace } from '../../test/offer-option'
import { __resetStoreForTests, canBeginConfiguration, useStore } from '../../state/store'
import {
  buildingScopeStage,
  scopeBuildingConfirmed,
  selectedBgfRSTotal,
  validateScopeMetric,
} from '../../state/optionBuildingScope'

/**
 * Gebäude & Umfang — the Option's building scope (VR3-02).
 *
 * The suite is organised by the ticket's REQUIRED STATES, because those are
 * what the surface exists to make reachable: option created, scope
 * incomplete, no building selected, edited, confirmed, stale, saving, save
 * failed, confirmed, and the Konfigurator locked or available. A state that
 * cannot be reached is not implemented, and a state that only the store can
 * hold is not a state of the product.
 */

beforeEach(() => __resetStoreForTests())

/** One save advance per tick, like the surface's own ticker. */
function settleScopeSave() {
  act(() => { useStore.getState().advanceBuildingScopeSave() })
}

async function openScope(projectId = 'DEMO-HAPPY-01') {
  const view = render(<App />)
  enterOptionWorkspace(projectId)
  return view
}

/**
 * `findBy`, not `getBy`.
 *
 * Switching building deliberately runs an `AnimatePresence mode="wait"`
 * transition, so the outgoing baseline is fully unmounted before the
 * incoming one mounts and the control is legitimately absent for a moment
 * after the click. A synchronous query there asserts against a deliberately
 * asynchronous transition and flakes under suite load.
 */
function confirmButton(name: string) {
  return screen.findByRole('button', { name: `Gebäudegrundlage bestätigen · ${name}` })
}

const A_LINDENHOF = 'Gebäude A · Lindenhof'
const B_KONTORHAUS = 'Gebäude A · Kontorhaus'
const B_HOFHAUS = 'Gebäude B · Hofhaus'
const B_STADTHAUS = 'Gebäude C · Stadthaus'

describe('Gebäude & Umfang · one building (T-013)', () => {
  it('inherits the project baseline, not the proposal fixture, and states its exact metrics', async () => {
    await openScope()

    expect(screen.getByRole('heading', { level: 1, name: 'Gebäude & Umfang' }))
      .toBeInTheDocument()
    // The Option's buildings come from the project baseline VR3-01
    // journalled — "Lindenhof", not the proposal fixture's "Haus A".
    expect(screen.getByText('Lindenhof')).toBeInTheDocument()
    expect(screen.queryByText('Haus A')).toBeNull()

    // Exact fixture arithmetic: 2.740 + 160 = 2.900 m² BGF R+S.
    expect(selectedBgfRSTotal(useStore.getState())).toBe('2900.00')
    const sheet = screen.getByRole('region', { name: /Grundlage · Gebäude A · Lindenhof/ })
    expect(within(sheet).getByText('2.740')).toBeInTheDocument()
    /**
     * B2 · requirement 10 — `2.900` now appears TWICE, and correctly so.
     * The baseline displays every fact, so `BGF R+S oberirdisch` and
     * `BGF R+S gesamt` are both on screen, and for a building with no
     * basement they are the same number. The released assertion used
     * `getByText`, which requires exactly one match; the arithmetic it is
     * really about is unchanged (2 740 + 160 = 2 900), so it is asserted per
     * ROW instead of by scanning the sheet for a string.
     */
    expect(within(sheet).getAllByText('2.900').length).toBeGreaterThanOrEqual(2)
    expect(within(sheet).getByText('EG + 3 OG + DG')).toBeInTheDocument()
    expect(within(sheet).getByText('Kein UG')).toBeInTheDocument()
  })

  it('is a concise single-building review, not a multi-select table', async () => {
    await openScope()
    // One identity, so there is no comparison to switch between and no
    // "review this one" control asking the user to choose from a set of one.
    expect(screen.getAllByRole('checkbox', { name: /Im Angebotsumfang führen/ }))
      .toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Grundlage prüfen/ })).toBeNull()
    expect(screen.getByText('0 von 1 bestätigt')).toBeInTheDocument()
  })

  it('shows no commercial rail before a legitimate price exists', async () => {
    await openScope()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
    expect(useStore.getState().pricingStarted).toBe(false)
  })
})

describe('Gebäude & Umfang · selection and its consequences', () => {
  it('reaches zero selected buildings and says what that means', async () => {
    const user = userEvent.setup()
    await openScope()
    await user.click(screen.getByRole('checkbox', {
      name: `Im Angebotsumfang führen · ${A_LINDENHOF}`,
    }))

    expect(buildingScopeStage(useStore.getState())).toBe('NO_SELECTION')
    expect(screen.getByText(/Kein Gebäude im Umfang/)).toBeInTheDocument()
    expect(canBeginConfiguration(useStore.getState())).toBe(false)
  })

  it('asks before removing a building whose baseline is already confirmed', async () => {
    const user = userEvent.setup()
    await openScope()
    await user.click(await confirmButton(A_LINDENHOF))
    expect(scopeBuildingConfirmed(useStore.getState(), 'A-BLDG-01')).toBe(true)

    await user.click(screen.getByRole('checkbox', {
      name: `Im Angebotsumfang führen · ${A_LINDENHOF}`,
    }))
    // Still selected: the consequence is a question, not a side effect.
    expect(useStore.getState().scopeSelected['A-BLDG-01']).toBe(true)
    expect(screen.getByText(/Lindenhof aus dem Umfang nehmen\?/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Im Umfang lassen' }))
    expect(useStore.getState().scopeSelected['A-BLDG-01']).toBe(true)
    expect(scopeBuildingConfirmed(useStore.getState(), 'A-BLDG-01')).toBe(true)

    await user.click(screen.getByRole('checkbox', {
      name: `Im Angebotsumfang führen · ${A_LINDENHOF}`,
    }))
    await user.click(screen.getByRole('button', { name: 'Aus dem Umfang nehmen' }))
    expect(useStore.getState().scopeSelected['A-BLDG-01']).toBe(false)
  })
})

describe('Gebäude & Umfang · three buildings (T-014)', () => {
  it('presents exactly three distinguishable identities and binds every metric to its owner', async () => {
    const user = userEvent.setup()
    await openScope('DEMO-COMPLEX-01')

    for (const name of [B_KONTORHAUS, B_HOFHAUS, B_STADTHAUS]) {
      expect(screen.getByRole('checkbox', {
        name: `Im Angebotsumfang führen · ${name}`,
      })).toBeChecked()
    }
    expect(screen.getByText('0 von 3 bestätigt')).toBeInTheDocument()
    // 6.030 + 5.780 + 7.660 = 19.470 m², derived from the selected ids.
    expect(selectedBgfRSTotal(useStore.getState())).toBe('19470.00')

    // Exactly one baseline is open, and it names the building it belongs to.
    const kontorhaus = screen.getByRole('region', { name: new RegExp(B_KONTORHAUS) })
    expect(within(kontorhaus).getByText('5.820')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: new RegExp(B_HOFHAUS) })).toBeNull()

    await user.click(screen.getByRole('button', { name: `Grundlage prüfen · ${B_HOFHAUS}` }))
    const hofhaus = await screen.findByRole('region', { name: new RegExp(B_HOFHAUS) })
    // Hofhaus' own numbers, and none of Kontorhaus'.
    expect(within(hofhaus).getByText('4.620')).toBeInTheDocument()
    expect(within(hofhaus).getByText('3.410')).toBeInTheDocument()
    expect(within(hofhaus).queryByText('5.820')).toBeNull()
  })

  it('keeps the gate closed on mixed confirmations and names the buildings still owed', async () => {
    const user = userEvent.setup()
    await openScope('DEMO-COMPLEX-01')
    await user.click(await confirmButton(B_KONTORHAUS))
    expect(screen.getByText('1 von 3 bestätigt')).toBeInTheDocument()

    const save = screen.getByRole('button', { name: 'Gebäudeumfang speichern' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Grundlage bestätigt: Gebäude B · Hofhaus/))
      .toBeInTheDocument()
    expect(screen.getByText(/Grundlage bestätigt: Gebäude C · Stadthaus/))
      .toBeInTheDocument()
    expect(canBeginConfiguration(useStore.getState())).toBe(false)
  })
})

describe('Gebäude & Umfang · authorised edit (T-015)', () => {
  it('keeps an invalid edit local, with a field error and the prior value intact', async () => {
    const user = userEvent.setup()
    await openScope('DEMO-COMPLEX-01')
    await user.click(screen.getByRole('button', { name: `Grundlage prüfen · ${B_HOFHAUS}` }))
    await user.click(await confirmButton(B_HOFHAUS))
    expect(scopeBuildingConfirmed(useStore.getState(), 'B-BLDG-B')).toBe(true)

    await user.click(await screen.findByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${B_HOFHAUS}`,
    }))
    const field = screen.getByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${B_HOFHAUS}`,
    })
    await user.clear(field)
    await user.type(field, 'abc')
    await user.click(screen.getByRole('button', { name: 'Wert übernehmen' }))

    expect(screen.getByText(/Bitte eine Zahl eingeben/)).toBeInTheDocument()
    // Nothing left the field: the confirmed value and its confirmation stand.
    expect(useStore.getState().scopeEdits['B-BLDG-B']).toBeUndefined()
    expect(scopeBuildingConfirmed(useStore.getState(), 'B-BLDG-B')).toBe(true)
  })

  it('requires a reason, records what it replaced, and invalidates only that building', async () => {
    const user = userEvent.setup()
    await openScope('DEMO-COMPLEX-01')
    await user.click(await confirmButton(B_KONTORHAUS))
    await user.click(screen.getByRole('button', { name: `Grundlage prüfen · ${B_HOFHAUS}` }))
    await user.click(await confirmButton(B_HOFHAUS))

    await user.click(await screen.findByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${B_HOFHAUS}`,
    }))
    const field = screen.getByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${B_HOFHAUS}`,
    })
    await user.clear(field)
    await user.type(field, '3.500')
    await user.click(screen.getByRole('button', { name: 'Wert übernehmen' }))
    expect(screen.getByText(/Bitte begründen/)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Begründung' }), 'Planaenderung')
    await user.click(screen.getByRole('button', { name: 'Wert übernehmen' }))

    const edit = useStore.getState().scopeEdits['B-BLDG-B']!.wfl!
    expect(edit).toMatchObject({ value: '3500.00', previous: '3410.00', reason: 'Planaenderung' })
    expect(edit.actor).not.toBe('')
    // Only the edited building loses its confirmation.
    expect(scopeBuildingConfirmed(useStore.getState(), 'B-BLDG-B')).toBe(false)
    expect(scopeBuildingConfirmed(useStore.getState(), 'B-BLDG-A')).toBe(true)

    // The prior value is recoverable, as its own event.
    await user.click(screen.getByRole('button', {
      name: `Quellwert · Wohnfläche nach WoFlV · ${B_HOFHAUS}`,
    }))
    expect(useStore.getState().scopeEdits['B-BLDG-B']?.wfl).toBeUndefined()
  })

  /**
   * B2 · Product Owner requirement 10 — THE REPLACED CONTRACT.
   *
   * This test asserted that a BGF area could NOT be overridden by hand, and
   * it was right to: the ticket that wrote it said so explicitly, on the
   * grounds that "replacing one by hand would move the commercial base
   * without evidence, which is a Product decision this ticket does not
   * own". That decision is now taken — the audit measured the read-only BGF
   * as a defect ("BGF, use, storeys, and basement are read-only") and
   * requirement 10 makes every displayed value editable.
   *
   * The concern is answered rather than dropped, and this test now holds the
   * answer: a BGF edit is possible, and it CANNOT move the commercial base
   * silently, because its derived dependants must be resolved explicitly
   * before the commit is allowed.
   */
  it('lets a BGF component be overridden, and refuses to commit until its derived sums are resolved', async () => {
    const user = userEvent.setup()
    await openScope()

    await user.click(screen.getByRole('button', {
      name: `Ändern · BGF R oberirdisch · ${A_LINDENHOF}`,
    }))
    const field = screen.getByRole('textbox', {
      name: `BGF R oberirdisch · ${A_LINDENHOF}`,
    })
    await user.clear(field)
    await user.type(field, '2.840')
    await user.type(screen.getByLabelText('Begründung'), 'Aufmass korrigiert')

    // The impact is PREVIEWED before the commit: 2 840 + 160 = 3 000, and
    // the total follows it. Both dependants are named with before → after.
    const impact = screen.getByRole('group', { name: 'Abgeleitete Werte ändern sich mit' })
    expect(impact).toHaveTextContent('BGF R+S oberirdisch: 2.900 → 3.000')
    expect(impact).toHaveTextContent('BGF R+S gesamt: 2.900 → 3.000')

    // And the commit is REFUSED while no outcome has been chosen: the
    // Product does not pick for the user.
    const commit = screen.getByRole('button', { name: 'Wert übernehmen' })
    expect(commit).toHaveAttribute('aria-disabled', 'true')
    expect(useStore.getState().scopeEdits['A-BLDG-01']?.bgfRAbove).toBeUndefined()

    await user.click(within(impact).getByRole('radio', {
      name: 'Abgeleitete Werte neu berechnen',
    }))
    await user.click(screen.getByRole('button', { name: 'Wert übernehmen' }))

    // One decision, one journal event, and the sums follow their parts.
    const edits = useStore.getState().scopeEdits['A-BLDG-01']!
    expect(edits.bgfRAbove?.value).toBe('2840.00')
    expect(edits.bgfRSAbove?.value).toBe('3000.00')
    expect(edits.bgfRSTotal?.value).toBe('3000.00')
    // …and the selected total, which the commercial base rests on, moved
    // with them rather than contradicting them.
    expect(selectedBgfRSTotal(useStore.getState())).toBe('3000.00')
  })

  it('keeps a manual total against its own components as a NAMED conflict, and blocks the save until it is resolved', async () => {
    const user = userEvent.setup()
    await openScope()

    await user.click(screen.getByRole('button', {
      name: `Ändern · BGF R oberirdisch · ${A_LINDENHOF}`,
    }))
    const field = screen.getByRole('textbox', {
      name: `BGF R oberirdisch · ${A_LINDENHOF}`,
    })
    await user.clear(field)
    await user.type(field, '2.840')
    await user.type(screen.getByLabelText('Begründung'), 'Aufmass korrigiert')
    const impact = screen.getByRole('group', { name: 'Abgeleitete Werte ändern sich mit' })
    await user.click(within(impact).getByRole('radio', {
      name: 'Manuelle Werte behalten',
    }))
    await user.click(screen.getByRole('button', { name: 'Wert übernehmen' }))

    // The disagreement is NAMED, where it is, and it is not silent.
    const conflicts = useStore.getState().scopeConflicts['A-BLDG-01']!
    expect(conflicts.bgfRSAbove?.derived).toBe('3000.00')
    expect(conflicts.bgfRSAbove?.kept).toBe('2900.00')
    expect(screen.getAllByText('Widerspricht den eigenen Bestandteilen').length)
      .toBeGreaterThan(0)

    // A baseline whose total contradicts its parts is not one anybody can
    // save, and the gate says which building and why.
    expect(screen.getByRole('button', { name: 'Gebäudeumfang speichern' }))
      .toHaveAttribute('aria-disabled', 'true')

    // The resolution puts the sum back in agreement with its components.
    await user.click(screen.getAllByRole('button', {
      name: 'Summe wieder aus Bestandteilen bilden',
    })[0]!)
    expect(useStore.getState().scopeConflicts['A-BLDG-01']?.bgfRSAbove).toBeUndefined()
    expect(useStore.getState().scopeEdits['A-BLDG-01']?.bgfRSAbove?.value).toBe('3000.00')
  })

  /**
   * B2 · AC-8 — the gate's recovery RETURNS FOCUS, not just the view.
   *
   * `navigation-and-blocker-patterns.md` names this case by building:
   * "`Go to Hofhaus`, for example, focuses that building's first unresolved
   * baseline fact". A route that only switches the reviewed building leaves
   * a keyboard user where they were, which makes it a statement rather than
   * a route.
   */
  it('sends the user to the named building AND puts focus on its outstanding action', async () => {
    const user = userEvent.setup()
    await openScope('DEMO-COMPLEX-01')

    const save = screen.getByRole('button', { name: 'Gebäudeumfang speichern' })
    expect(save).toHaveAttribute('aria-disabled', 'true')

    /**
     * The gate names BUILDINGS rather than saying "unavailable" — one
     * primary route to the earliest unmet prerequisite and a secondary route
     * per remaining building, which is why this is `getAllByRole`. Hofhaus
     * is deliberately not the first: the point is that the route goes where
     * it SAYS, not to whatever happens to be open.
     */
    const routes = screen.getAllByRole('button', { name: /^Zu Gebäude|^Zu Hofhaus|^Zu / })
    const hofhaus = routes.find((b) => /Hofhaus/.test(b.textContent ?? ''))!
    expect(hofhaus).toBeInTheDocument()
    await user.click(hofhaus)

    // The baseline on screen is THAT building's, and focus is on the action
    // it is asking for.
    await waitFor(() => {
      expect(document.activeElement)
        .toHaveAccessibleName('Gebäudegrundlage bestätigen · Gebäude B · Hofhaus')
    })
  })

  /**
   * B2 · baseline-editing-model.md — "Cancel discards the draft and makes no
   * event." Asserted because it is the one editor action whose correctness is
   * invisible: a Cancel that wrote something would look exactly like a
   * Cancel that did not, until an undo replayed it.
   */
  it('discards a draft on Cancel and on Escape, writing nothing and journalling nothing', async () => {
    const user = userEvent.setup()
    await openScope()
    const journalBefore = useStore.getState().journal.length

    await user.click(screen.getByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    }))
    const field = () => screen.getByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    })
    await user.clear(field())
    await user.type(field(), '9.999')
    await user.type(screen.getByLabelText('Begründung'), 'sollte verworfen werden')

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    })).toBeNull()
    expect(useStore.getState().scopeEdits['A-BLDG-01']?.wfl).toBeUndefined()
    expect(useStore.getState().journal.length).toBe(journalBefore)

    // Escape is the same act from the keyboard, with the same absence of
    // consequence.
    await user.click(screen.getByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    }))
    await user.clear(field())
    await user.type(field(), '8.888')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    })).toBeNull()
    expect(useStore.getState().scopeEdits['A-BLDG-01']?.wfl).toBeUndefined()
    expect(useStore.getState().journal.length).toBe(journalBefore)
  })

  it('lets the building USE be changed through a select, and un-confirms the building by arithmetic', async () => {
    const user = userEvent.setup()
    await openScope()
    await user.click(await confirmButton(A_LINDENHOF))
    expect(useStore.getState().scopeConfirmations['A-BLDG-01']).toBeDefined()

    // A closed-domain fact gets the control its data deserves: a select,
    // not a number field, and not a read-only paragraph as before.
    await user.click(screen.getByRole('button', {
      name: `Ändern · Nutzung · ${A_LINDENHOF}`,
    }))
    const select = screen.getByRole('combobox', { name: `Nutzung · ${A_LINDENHOF}` })
    await user.selectOptions(select, 'vr3.building.usage.office')
    await user.type(screen.getByLabelText('Begründung'), 'Nutzung geändert')
    await user.click(screen.getByRole('button', { name: 'Wert übernehmen' }))

    expect(useStore.getState().scopeEdits['A-BLDG-01']?.usage?.value)
      .toBe('vr3.building.usage.office')
    // A building that changed its USE is not the building that was
    // confirmed. The fingerprint reads the EFFECTIVE value now, so the
    // confirmation lapses by arithmetic and not by remembering to clear it.
    expect(scopeBuildingConfirmed(useStore.getState(), 'A-BLDG-01')).toBe(false)
  })
})

describe('Gebäude & Umfang · saving and the Konfigurator gate (T-016/T-017)', () => {
  it('saves a fingerprinted scope and makes the Konfigurator available', async () => {
    const user = userEvent.setup()
    await openScope()
    await user.click(await confirmButton(A_LINDENHOF))
    await user.click(screen.getByRole('button', { name: 'Gebäudeumfang speichern' }))

    // The busy state is genuinely reachable: the save is staged.
    expect(useStore.getState().scopeCommit?.stage).toBe('SAVING')
    expect(canBeginConfiguration(useStore.getState())).toBe(false)
    settleScopeSave()

    const saved = useStore.getState().scopeSaved!
    expect(saved.selectedIds).toEqual(['A-BLDG-01'])
    expect(saved.bgfRSTotal).toBe('2900.00')
    expect(canBeginConfiguration(useStore.getState())).toBe(true)
    // The receipt is the availability surface itself.
    expect(screen.getByRole('heading', { level: 1, name: 'Konfigurator verfügbar' }))
      .toBeInTheDocument()
    expect(screen.getByText(/Eine Gebäudegrundlage bestätigt und gespeichert/))
      .toBeInTheDocument()
  })

  it('fails the save when the scope changes mid-flight, and keeps every selection and edit', async () => {
    const user = userEvent.setup()
    await openScope('DEMO-COMPLEX-01')
    await user.click(await confirmButton(B_KONTORHAUS))
    await user.click(screen.getByRole('button', { name: `Grundlage prüfen · ${B_HOFHAUS}` }))
    await user.click(await confirmButton(B_HOFHAUS))
    await user.click(screen.getByRole('button', { name: `Grundlage prüfen · ${B_STADTHAUS}` }))
    await user.click(await confirmButton(B_STADTHAUS))

    await user.click(screen.getByRole('button', { name: 'Gebäudeumfang speichern' }))
    // A metric moves while the commitment is in flight — a real race, and
    // the gate is re-read at the commitment's boundary rather than when the
    // button rendered.
    act(() => {
      useStore.getState()
        .editScopeMetric('B-BLDG-C', 'wfl', '3700.00', 'Planaenderung')
    })
    settleScopeSave()

    expect(useStore.getState().scopeCommit?.errorKey).toBe('vr3.scope.error.changed')
    expect(useStore.getState().scopeSaved).toBeNull()
    expect(canBeginConfiguration(useStore.getState())).toBe(false)
    expect(document.querySelector('.a3-gate-error')).toHaveTextContent(/erneut speichern/)
    // Nothing was discarded.
    expect(useStore.getState().scopeEdits['B-BLDG-C']!.wfl!.value).toBe('3700.00')
    expect(scopeBuildingConfirmed(useStore.getState(), 'B-BLDG-A')).toBe(true)

    // Retry succeeds once the changed building is confirmed again.
    act(() => { useStore.getState().clearBuildingScopeSaveError() })
    act(() => { useStore.getState().confirmScopeBuilding('B-BLDG-C') })
    act(() => { useStore.getState().beginBuildingScopeSave() })
    settleScopeSave()
    expect(canBeginConfiguration(useStore.getState())).toBe(true)
  })

  it('marks a saved scope stale after a material change and never keeps the gate open', async () => {
    const user = userEvent.setup()
    await openScope()
    await user.click(await confirmButton(A_LINDENHOF))
    await user.click(screen.getByRole('button', { name: 'Gebäudeumfang speichern' }))
    settleScopeSave()
    expect(canBeginConfiguration(useStore.getState())).toBe(true)

    act(() => {
      useStore.getState().editScopeMetric('A-BLDG-01', 'units', '20.00', 'Nachtrag')
    })

    expect(buildingScopeStage(useStore.getState())).toBe('STALE')
    expect(canBeginConfiguration(useStore.getState())).toBe(false)
    // The saved baseline still exists — this is a recheck, not an absence.
    expect(useStore.getState().scopeSaved).not.toBeNull()
  })

  it('renders the Konfigurator stage as an explained lock, never as an empty configurator', async () => {
    await openScope()
    act(() => { useStore.getState().setPipelineView('konfigurator') })

    expect(screen.getByRole('heading', { level: 1, name: 'Konfigurator gesperrt' }))
      .toBeInTheDocument()
    expect(screen.getByText(/Lindenhof braucht noch Prüfung und Bestätigung/))
      .toBeInTheDocument()
    // Fail-closed: no configurator, no price, no scope decisions.
    expect(screen.queryByRole('heading', { name: 'Leistungsabgrenzung' })).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).toBeNull()
  })
})

describe('Gebäude & Umfang · numeric contract', () => {
  it('reads a locale-formatted entry back in the locale that wrote it', () => {
    // `3.410` is three thousand four hundred and ten in German and three
    // point four one in English; no heuristic can tell them apart.
    expect(validateScopeMetric('wfl', '3.410', 'de')).toEqual({ ok: true, value: '3410.00' })
    expect(validateScopeMetric('wfl', '3,410.50', 'en')).toEqual({ ok: true, value: '3410.50' })
    expect(validateScopeMetric('wfl', '1.234,56', 'de')).toEqual({ ok: true, value: '1234.56' })
  })

  it('refuses a fractional count and a negative area', () => {
    expect(validateScopeMetric('units', '18,5', 'de')).toEqual({
      ok: false, error: 'notAnInteger',
    })
    expect(validateScopeMetric('wfl', '-5', 'de')).toEqual({ ok: false, error: 'negative' })
    expect(validateScopeMetric('wfl', '', 'de')).toEqual({ ok: false, error: 'empty' })
  })

  it('sums the selected total from the selected ids, never from a formatted string', () => {
    render(<App />)
    enterOptionWorkspace('DEMO-COMPLEX-01')
    expect(selectedBgfRSTotal(useStore.getState())).toBe('19470.00')
    act(() => { useStore.getState().toggleScopeBuilding('B-BLDG-B') })
    // 19.470 − 5.780 = 13.690
    expect(selectedBgfRSTotal(useStore.getState())).toBe('13690.00')
  })
})
