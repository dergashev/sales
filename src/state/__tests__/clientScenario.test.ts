import { beforeEach, describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import {
  clientBaselineSnapshot,
  clientDecisionValue,
  clientPresentationDecisions,
  clientPresentedSnapshot,
  clientScenarioDelta,
  clientScenarioNameAvailable,
  clientScenarioProposedName,
  clientScenarioTrustedNow,
  clientScenarioWarnings,
  latestSavedOptionVersion,
  savedOptionVersionsFor,
  useStore,
  __resetStoreForTests,
} from '../store'
import {
  completeKgConfiguration,
  enterOptionWorkspace,
  completeBuildingScope,
  saveOptionBaseline,
} from '../../test/offer-option'

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

/**
 * The Option the VR3-00 fixture specification describes for the complex
 * project: three buildings, six cost groups included, every explicit service
 * decision recorded as "not included", saved. Its declared net total is
 * 38.740.000 €, which is the number every assertion below is a delta from.
 */
function presentSavedComplexOption() {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  completeBuildingScope('PER_BUILDING')
  completeKgConfiguration()
  saveOptionBaseline()
  act(() => { useStore.getState().setMode('praesentation') })
}

function decide(id: string, value: string) {
  act(() => { useStore.getState().setPresentationDecision(id, value) })
}

function totalOf(snapshot: ReturnType<typeof clientPresentedSnapshot>): string {
  if (!snapshot) throw new Error('no snapshot')
  return snapshot.result.total.exact.toFixed(2)
}

describe('VR3-05 · the presentation scenario is a branch, not an edit', () => {
  it('enters Client Mode with an empty scenario pinned to the saved Option', () => {
    presentSavedComplexOption()
    const s = st()
    expect(s.mode).toBe('praesentation')
    expect(s.clientScenario).not.toBeNull()
    expect(s.clientScenario!.sourceOptionId).toBe(s.activeOptionId)
    expect(s.clientScenario!.changes).toEqual([])
    // The saved baseline is what the presentation speaks for.
    expect(totalOf(clientBaselineSnapshot(s))).toBe('38740000.00')
  })

  it('offers the fixture what-ifs and no internal configurator', () => {
    presentSavedComplexOption()
    const ids = clientPresentationDecisions(st()).map((d) => d.id)
    expect(ids).toContain('heatStrategy')
    expect(ids).toContain('gastronomyReadiness')
    expect(ids).toContain('handoverSequence')
    // Short by construction: a client meeting is not the service ledger.
    expect(ids).toHaveLength(3)
  })

  it('prices the gastronomy alternative at the catalogue amount, not a literal', () => {
    presentSavedComplexOption()
    expect(clientDecisionValue(st(), clientPresentationDecisions(st())[1]!))
      .toBe('retailOnly')

    decide('gastronomyReadiness', 'gastronomyReady')

    expect(clientScenarioDelta(st())!.toFixed(2)).toBe('420000.00')
    expect(totalOf(clientPresentedSnapshot(st()))).toBe('39160000.00')
  })

  /**
   * VR3-TGA-01 MOVED THIS NUMBER, AND THE MOVE IS THE FIX.
   *
   * It used to read −310 000 €: the plant-concept delta alone. The audit
   * measured why — switching to per-building plants changed zero other rows
   * and left `Wärmeerzeuger · Gemeinsamer Ambient-Loop` included at
   * + 1 240 000 €, so the scenario priced a configuration that cannot be
   * built. The cascade now drops that row with its parent, and the honest
   * reduction is the concept's 310 000 € plus the shared plant's 1 240 000 €.
   *
   * A client-facing what-if is exactly where this mattered most: the old
   * number was the one a salesperson would have said out loud in a meeting.
   */
  it('prices the decentralised heat alternative as a signed reduction', () => {
    presentSavedComplexOption()
    decide('heatStrategy', 'perBuilding')

    expect(clientScenarioDelta(st())!.toFixed(2)).toBe('-1550000.00')
    expect(totalOf(clientPresentedSnapshot(st()))).toBe('37190000.00')
  })

  it('composes two what-ifs into one canonical result', () => {
    presentSavedComplexOption()
    decide('gastronomyReadiness', 'gastronomyReady')
    decide('heatStrategy', 'perBuilding')

    expect(st().clientScenario!.changes).toHaveLength(2)
    // + 420 000 gastronomy − 1 550 000 heat (see the cascade note above).
    expect(clientScenarioDelta(st())!.toFixed(2)).toBe('-1130000.00')
    expect(totalOf(clientPresentedSnapshot(st()))).toBe('37610000.00')
  })

  it('counts decisions moved, not clicks: re-choosing replaces, baseline removes', () => {
    presentSavedComplexOption()
    decide('heatStrategy', 'perBuilding')
    decide('heatStrategy', 'perBuilding')
    expect(st().clientScenario!.changes).toHaveLength(1)

    // Choosing the saved value back is not a change TO the baseline; it is
    // the absence of a change, and the delta is exactly zero as a result.
    decide('heatStrategy', 'central')
    expect(st().clientScenario!.changes).toEqual([])
    expect(clientScenarioDelta(st())).toBeNull()
    expect(totalOf(clientPresentedSnapshot(st()))).toBe('38740000.00')
  })

  it('carries the project’s own open question into a phased-handover scenario', () => {
    presentSavedComplexOption()
    expect(clientScenarioWarnings(st())).toEqual([])

    decide('handoverSequence', 'phased')

    const warnings = clientScenarioWarnings(st())
    expect(warnings.map((d) => d.id)).toEqual(['handoverSequence'])
    expect(warnings[0]!.openQuestionId).toBe('B-Q-08')
    // A schedule what-if moves the programme, not the price.
    expect(clientScenarioDelta(st())!.toFixed(2)).toBe('0.00')
  })
})

describe('VR3-05 · the saved Option is untouched by an unsaved scenario', () => {
  it('leaves the saved baseline, the active Option and its config identical', () => {
    presentSavedComplexOption()
    const before = st()
    const optionId = before.activeOptionId!
    const savedBefore = JSON.stringify(savedOptionVersionsFor(before, optionId))
    const configBefore = JSON.stringify(before.kgConfig)
    const activeBefore = before.activeOptionId
    const journalBefore = before.journal.length

    decide('gastronomyReadiness', 'gastronomyReady')
    decide('heatStrategy', 'perBuilding')
    decide('handoverSequence', 'phased')

    const after = st()
    expect(JSON.stringify(savedOptionVersionsFor(after, optionId))).toBe(savedBefore)
    expect(JSON.stringify(after.kgConfig)).toBe(configBefore)
    expect(after.activeOptionId).toBe(activeBefore)
    expect(after.scheduleEdits).toEqual(before.scheduleEdits)
    // A what-if is not a journalled event: M-4 governs Option data, and a
    // scenario is not Option data until Save as New says it is.
    expect(after.journal).toHaveLength(journalBefore)
    // And the baseline still derives to exactly what was saved.
    expect(totalOf(clientBaselineSnapshot(after))).toBe('38740000.00')
  })

  it('reverts to the exact saved result in one operation', () => {
    presentSavedComplexOption()
    const baseline = totalOf(clientBaselineSnapshot(st()))

    decide('gastronomyReadiness', 'gastronomyReady')
    decide('heatStrategy', 'perBuilding')
    expect(st().clientScenario!.changes).toHaveLength(2)

    act(() => { useStore.getState().revertPresentationScenario() })

    expect(st().clientScenario!.changes).toEqual([])
    expect(clientScenarioDelta(st())).toBeNull()
    expect(totalOf(clientPresentedSnapshot(st()))).toBe(baseline)
  })

  it('discards the scenario when the presentation ends', () => {
    presentSavedComplexOption()
    decide('heatStrategy', 'perBuilding')

    act(() => { useStore.getState().setMode('intern') })

    expect(st().clientScenario).toBeNull()
    expect(st().viewedOptionId).toBeNull()
  })

  it('refuses a scenario decision outside Client Mode', () => {
    presentSavedComplexOption()
    act(() => { useStore.getState().setMode('intern') })
    decide('heatStrategy', 'perBuilding')
    expect(st().clientScenario).toBeNull()
  })
})

describe('VR3-05 · Save as New Option creates a descendant', () => {
  it('creates a distinct, uniquely named Option with explicit lineage', () => {
    presentSavedComplexOption()
    const sourceId = st().activeOptionId!
    const sourceSaved = JSON.stringify(savedOptionVersionsFor(st(), sourceId))

    decide('gastronomyReadiness', 'gastronomyReady')
    act(() => { useStore.getState().beginScenarioSaveAsNew() })
    act(() => { useStore.getState().setScenarioSaveName('Option Gastronomie vorbereitet') })
    act(() => { useStore.getState().commitScenarioSaveAsNew() })

    const s = st()
    const newId = s.clientScenarioSave!.savedOptionId!
    expect(newId).not.toBe(sourceId)
    expect(s.options.map((o) => o.id)).toContain(newId)
    expect(s.options.find((o) => o.id === newId)!.name)
      .toBe('Option Gastronomie vorbereitet')

    const version = latestSavedOptionVersion(s, newId)!
    expect(version.version).toBe(1)
    expect(version.sourceOptionId).toBe(sourceId)
    expect(version.result.totalExact).toBe('39160000.00')

    // The original is recoverable and completely unchanged.
    expect(JSON.stringify(savedOptionVersionsFor(s, sourceId))).toBe(sourceSaved)
    expect(s.activeOptionId).toBe(sourceId)

    // The descendant is now the presented baseline, with a spent scenario.
    expect(s.viewedOptionId).toBe(newId)
    expect(s.clientScenario!.changes).toEqual([])
    expect(clientScenarioDelta(s)).toBeNull()
    expect(totalOf(clientBaselineSnapshot(s))).toBe('39160000.00')
  })

  it('refuses a duplicate name and keeps the name and the changes', () => {
    presentSavedComplexOption()
    const existing = st().options[0]!.name

    decide('heatStrategy', 'perBuilding')
    act(() => { useStore.getState().beginScenarioSaveAsNew() })
    act(() => { useStore.getState().setScenarioSaveName(existing) })
    act(() => { useStore.getState().commitScenarioSaveAsNew() })

    const s = st()
    expect(s.clientScenarioSave!.errorKey).toBe('vr3.client.save.error.nameTaken')
    expect(s.clientScenarioSave!.name).toBe(existing)
    expect(s.clientScenarioSave!.stage).toBe('NAMING')
    expect(s.clientScenario!.changes).toHaveLength(1)
    expect(s.options).toHaveLength(1)
  })

  it('refuses an empty name and creates no partial Option', () => {
    presentSavedComplexOption()
    decide('heatStrategy', 'perBuilding')
    act(() => { useStore.getState().beginScenarioSaveAsNew() })
    act(() => { useStore.getState().setScenarioSaveName('   ') })
    act(() => { useStore.getState().commitScenarioSaveAsNew() })

    expect(st().clientScenarioSave!.errorKey).toBe('vr3.client.save.error.nameEmpty')
    expect(st().options).toHaveLength(1)
    expect(st().optionSeq).toBe(1)
  })

  it('proposes a unique name and reports availability', () => {
    presentSavedComplexOption()
    const proposed = clientScenarioProposedName(st())
    expect(clientScenarioNameAvailable(st(), proposed)).toBe(true)
    expect(clientScenarioNameAvailable(st(), st().options[0]!.name)).toBe(false)
    expect(clientScenarioNameAvailable(st(), '  ')).toBe(false)
  })

  it('does not offer Save as New while the presentation is at the baseline', () => {
    presentSavedComplexOption()
    act(() => { useStore.getState().beginScenarioSaveAsNew() })
    expect(st().clientScenarioSave).toBeNull()
  })

  it('journals exactly one event, naming the source', () => {
    presentSavedComplexOption()
    const before = st().journal.length

    decide('heatStrategy', 'perBuilding')
    act(() => { useStore.getState().beginScenarioSaveAsNew() })
    act(() => { useStore.getState().commitScenarioSaveAsNew() })

    const journal = st().journal
    expect(journal).toHaveLength(before + 1)
    expect(journal[journal.length - 1]!.labelKey)
      .toBe('vr3.journal.optionSavedFromScenario')
  })
})

describe('VR3-05 · a calculation failure keeps the last trusted scenario', () => {
  it('retains the last good result and reports that it is no longer trusted', () => {
    presentSavedComplexOption()
    decide('heatStrategy', 'perBuilding')
    expect(clientScenarioTrustedNow(st())).toBe(true)
    const trusted = totalOf(clientPresentedSnapshot(st()))
    expect(trusted).toBe('37190000.00')

    act(() => { useStore.getState().setCommercialFault(true) })

    expect(clientScenarioTrustedNow(st())).toBe(false)
    // The number on screen is the last one that was true, not a fresh wrong
    // one and not a crash.
    expect(totalOf(clientPresentedSnapshot(st()))).toBe(trusted)

    act(() => { useStore.getState().setCommercialFault(false) })
    expect(clientScenarioTrustedNow(st())).toBe(true)
  })

  it('refuses to save an Option whose total the calculator cannot reproduce', () => {
    presentSavedComplexOption()
    decide('heatStrategy', 'perBuilding')
    act(() => { useStore.getState().beginScenarioSaveAsNew() })
    act(() => { useStore.getState().setCommercialFault(true) })
    act(() => { useStore.getState().commitScenarioSaveAsNew() })

    expect(st().clientScenarioSave!.errorKey).toBe('vr3.client.save.error.calculation')
    expect(st().options).toHaveLength(1)
    expect(st().clientScenario!.changes).toHaveLength(1)
  })
})

describe('VR3-05 · the second fixture presents too', () => {
  it('offers the happy project’s own decisions against its own baseline', () => {
    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    saveOptionBaseline()
    act(() => { useStore.getState().setMode('praesentation') })

    expect(totalOf(clientBaselineSnapshot(st()))).toBe('6480000.00')
    const ids = clientPresentationDecisions(st()).map((d) => d.id)
    expect(ids).toEqual(['energyStandard', 'photovoltaics'])

    decide('photovoltaics', 'with')
    expect(clientScenarioDelta(st())!.toFixed(2)).toBe('165000.00')

    decide('energyStandard', 'eh40')
    expect(clientScenarioDelta(st())!.toFixed(2)).toBe('262000.00')
  })
})
