import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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
    expect(within(sheet).getByText('2.900')).toBeInTheDocument()
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

  it('never lets a BGF area be overridden by hand', async () => {
    const user = userEvent.setup()
    await openScope()
    expect(screen.queryByRole('button', {
      name: `Ändern · BGF R oberirdisch · ${A_LINDENHOF}`,
    })).toBeNull()
    expect(screen.getByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    })).toBeInTheDocument()
    // The one editable metric really is editable, so the absence above is a
    // decision and not a broken control.
    await user.click(screen.getByRole('button', {
      name: `Ändern · Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    }))
    expect(screen.getByRole('textbox', {
      name: `Wohnfläche nach WoFlV · ${A_LINDENHOF}`,
    })).toBeInTheDocument()
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
