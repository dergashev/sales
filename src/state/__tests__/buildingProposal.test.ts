import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  buildingConfirmed,
  canBeginConfiguration,
  choicesFor,
  configurationComplete,
  configurationDisplayStatusFor,
  configurationStatusFor,
  useStore,
  wflConflict,
  __resetStoreForTests,
} from '../store'
import { toBuildingInput } from '../buildingReview'

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

describe('building-aware reviewed proposal state', () => {
  it('keeps reviewed facts and pricing inputs synchronized through edits and undo', () => {
    st().setBuildingFactOverride('DEMO-B-A', 'buildingForm', 'BUERO')
    st().setBuildingFactOverride('DEMO-B-A', 'bgfRAbove', new Decimal('2100'))
    st().setBuildingFactOverride('DEMO-B-B', 'nuf', new Decimal('975'))

    for (const id of Object.keys(st().buildings)) {
      expect(toBuildingInput(st().buildingReviews[id]!)).toEqual(st().buildings[id])
    }

    st().undo()
    for (const id of Object.keys(st().buildings)) {
      expect(toBuildingInput(st().buildingReviews[id]!)).toEqual(st().buildings[id])
    }
  })

  it('keeps the Haus A compatibility fields derived from its review when another building is active', () => {
    st().setActiveBuilding('DEMO-B-B')
    st().setBuildingFactOverride('DEMO-B-A', 'wfl', new Decimal('1234'))

    expect(st().fields.wfl.value.toFixed()).toBe('1234')
    expect(st().fields.wfl.provenance).toBe('manuell erfasst')
    expect(st().buildings['DEMO-B-A']!.wfl!.toFixed()).toBe('1234')
    expect(st().journal.at(-1)!.label)
      .toBe('Gebäudedaten DEMO-B-A · WFL nach WoFlV manuell bearbeitet')

    st().undo()
    expect(st().fields.wfl.value.toFixed()).toBe('1500')
    expect(st().buildingReviews['DEMO-B-A']!.facts.wfl.override).toBeNull()
  })

  it('invalidates only the edited building confirmation and can be re-confirmed', () => {
    st().resolveWflConflict('document')
    st().confirmBuilding('DEMO-B-A')
    st().confirmBuilding('DEMO-B-B')
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)
    expect(buildingConfirmed(st(), 'DEMO-B-B')).toBe(true)

    st().setBuildingFactOverride('DEMO-B-A', 'buildingForm', 'BUERO')
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(false)
    expect(buildingConfirmed(st(), 'DEMO-B-B')).toBe(true)

    st().confirmBuilding('DEMO-B-A')
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)
    const fingerprint = st().buildingConfirmation['DEMO-B-A']!.fingerprint
    st().confirmBuilding('DEMO-B-A')
    expect(st().buildingConfirmation['DEMO-B-A']!.fingerprint).toBe(fingerprint)
  })

  it('keeps the building gate open when Configurator choices change', () => {
    st().resolveWflConflict('customer')
    st().confirmBuilding('DEMO-B-A')
    expect(canBeginConfiguration(st())).toBe(true)

    st().setEnergiestandard('EH_40')

    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)
    expect(canBeginConfiguration(st())).toBe(true)
  })

  it('requires the changed building class to be confirmed again', () => {
    st().confirmGebaeudeklasse()
    expect(st().buildings['DEMO-B-A']!.gebaeudeklasse.confirmed).toBe(true)

    st().setBuildingFactOverride('DEMO-B-A', 'buildingClass', 'GK_4')
    expect(st().buildings['DEMO-B-A']!.gebaeudeklasse).toEqual({
      value: 'GK_4', confirmed: false,
    })

    st().confirmGebaeudeklasse()
    st().clearBuildingFactOverride('DEMO-B-A', 'buildingClass')
    expect(st().buildings['DEMO-B-A']!.gebaeudeklasse).toEqual({
      value: 'GK_5', confirmed: false,
    })
  })

  it('invalidates confirmation when a conflict on that building changes', () => {
    st().resolveWflConflict('document')
    st().confirmBuilding('DEMO-B-A')
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)
    st().resolveBuildingConflict('DEMO-CONF-0001', { decision: 'defer' })
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(false)
  })

  it('keeps conflict resolutions append-only and derives the legacy WFL view', () => {
    st().resolveWflConflict('customer')
    expect(wflConflict(st()).state).toBe('resolved')
    expect(st().buildingConflicts['DEMO-CONF-0001']!.resolutions).toHaveLength(1)

    st().undo()
    expect(wflConflict(st()).state).toBe('open')
    expect(st().buildingConflicts['DEMO-CONF-0001']!.resolutions).toHaveLength(2)
    expect(st().buildingConflicts['DEMO-CONF-0001']!.resolutions[1]!.decision)
      .toBe('defer')
  })

  it('raises a top-level conflict when reviewed R+S disagrees with components', () => {
    st().setBuildingFactOverride('DEMO-B-A', 'bgfRSAbove', new Decimal('2100'))
    const conflict = st().buildingConflicts['DERIVED:DEMO-B-A:bgfRSAbove']
    expect(conflict).toBeDefined()
    expect(wflConflict(st()).id).toBe('DEMO-CONF-0001')
  })

  it('retracts a derived conflict once the disagreement disappears and restores confirmation', () => {
    st().resolveWflConflict('document')
    st().confirmBuilding('DEMO-B-A')
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)

    st().setBuildingFactOverride('DEMO-B-A', 'bgfRSAbove', new Decimal('2100'))
    expect(st().buildingConflicts['DERIVED:DEMO-B-A:bgfRSAbove']).toBeDefined()
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(false)

    st().clearBuildingFactOverride('DEMO-B-A', 'bgfRSAbove')
    expect(st().buildingConflicts['DERIVED:DEMO-B-A:bgfRSAbove']).toBeUndefined()
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)
  })

  it('uses German-primary labels for the new journal events', () => {
    st().setBuildingFactOverride('DEMO-B-A', 'wfl', new Decimal('1234'))
    st().clearBuildingFactOverride('DEMO-B-A', 'wfl')
    st().setConfigurationMode('SHARED')
    st().markBuildingConfigurationCompleted('DEMO-B-A')
    st().confirmBuildingConfiguration('DEMO-B-A')

    const labels = st().journal.map((event) => event.label).join('\n')
    expect(labels).not.toMatch(/\b(?:Building|Shared|Per-building|Proposal)\b/)
    expect(labels).toContain('Gemeinsame Konfiguration')
    expect(labels).toContain('Gebäudekonfiguration')
  })

})

describe('selection and configuration modes', () => {
  it('allows zero selected before pricing and keeps the pure gate closed', () => {
    st().toggleBuildingIncluded('DEMO-B-A')
    expect(st().included['DEMO-B-A']).toBe(false)
    expect(st().journal.at(-1)?.deltaExact).toBeNull()
    expect(canBeginConfiguration(st())).toBe(false)
  })

  it('keeps excluded evidence intact while removing it from totals and metrics', () => {
    const hausAWfl = st().buildingReviews['DEMO-B-A']!.facts.wfl.extracted.value!
    st().toggleBuildingIncluded('DEMO-B-B')
    st().toggleBuildingIncluded('DEMO-B-A')

    const projection = st().projection()
    expect(projection.result.buildingId).toBe('DEMO-B-B')
    expect(projection.leadRate.denominatorLabel).toBe('NUF nach DIN 277')
    expect(projection.leadRate.denominator.toFixed()).toBe('960')
    expect(projection.secondaryRateBgf.denominator.toFixed()).toBe('1200')
    expect(projection.perUnit).toBeNull()
    expect(st().buildingReviews['DEMO-B-A']!.facts.wfl.extracted.value)
      .toBe(hausAWfl)
  })

  it('uses BGF above ground for a complex even when every included building has WFL', () => {
    st().setBuildingFactOverride('DEMO-B-B', 'wfl', new Decimal('900'))
    st().toggleBuildingIncluded('DEMO-B-B')

    const projection = st().projection()
    expect(projection.leadRate.denominatorType).toBe('BGF_ABOVE_GROUND')
    expect(projection.leadRate.denominatorLabel).toBe('BGF oberirdisch')
    expect(projection.leadRate.denominator.toFixed()).toBe('3200')
  })

  it('uses one shared set for every included building and derives association', () => {
    st().toggleBuildingIncluded('DEMO-B-B')
    st().setConfigurationMode('SHARED')
    st().setKg300('fassade', 'klinker')

    expect(choicesFor(st(), 'DEMO-B-A').fassade).toBe('klinker')
    expect(choicesFor(st(), 'DEMO-B-B').fassade).toBe('klinker')
    expect(st().journal.at(-1)!.label).toContain('DEMO-B-A, DEMO-B-B')
    expect(st().kg300['DEMO-B-A']!.fassade).not.toBe('klinker')
    expect(st().kg300['DEMO-B-B']!.fassade).not.toBe('klinker')
  })

  it('preserves both choice sets across mode switches and mode is undoable', () => {
    st().setKg300('fassade', 'klinker')
    const perBuilding = st().kg300['DEMO-B-A']!.fassade

    st().setConfigurationMode('SHARED')
    st().setKg300('fassade', 'mixedTimber')
    const shared = st().sharedConfiguration.choices.fassade
    st().setConfigurationMode('PER_BUILDING')
    expect(choicesFor(st(), 'DEMO-B-A').fassade).toBe(perBuilding)
    expect(st().sharedConfiguration.choices.fassade).toBe(shared)

    st().undo()
    expect(st().configurationMode).toBe('SHARED')
    expect(choicesFor(st(), 'DEMO-B-A').fassade).toBe(shared)
  })

  it('keeps per-building choices and configuration confirmation isolated', () => {
    st().toggleBuildingIncluded('DEMO-B-B')
    st().setKg300('fassade', 'klinker')
    st().confirmBuildingConfiguration('DEMO-B-A')
    st().setActiveBuilding('DEMO-B-B')
    st().setKg300('fassade', 'mixedTimber')

    expect(choicesFor(st(), 'DEMO-B-A').fassade).toBe('klinker')
    expect(choicesFor(st(), 'DEMO-B-B').fassade).toBe('mixedTimber')
    expect(configurationStatusFor(st(), 'DEMO-B-A')).toBe('confirmed')
    expect(configurationStatusFor(st(), 'DEMO-B-B')).toBe('draft')

    st().setActiveBuilding('DEMO-B-A')
    st().setKg300('fassade', 'timber')
    expect(configurationStatusFor(st(), 'DEMO-B-A')).toBe('completed')
    expect(configurationStatusFor(st(), 'DEMO-B-B')).toBe('draft')
  })

  it('cannot report completion or reconfirm while upstream review is stale', () => {
    st().resolveWflConflict('customer')
    st().confirmBuilding('DEMO-B-A')
    st().confirmConfigurationMode('PER_BUILDING')
    st().openChapterAt(3)
    st().openChapterAt(4)
    st().openChapterAt(5)
    st().confirmVisibleConfiguration()
    // Scope Boundaries confirmation (ticket d21f8d48) is its own prerequisite
    // for configurationComplete, independent of per-building confirmation.
    st().confirmScopeBoundaries()
    expect(configurationComplete(st())).toBe(true)

    st().setBuildingFactOverride(
      'DEMO-B-A', 'documentationName', 'Haus A Nord',
    )
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(false)
    expect(configurationDisplayStatusFor(st(), 'DEMO-B-A')).toBe('recheck')
    expect(configurationComplete(st())).toBe(false)

    st().confirmVisibleConfiguration()
    expect(configurationDisplayStatusFor(st(), 'DEMO-B-A')).toBe('recheck')
    st().confirmBuilding('DEMO-B-A')
    st().confirmVisibleConfiguration()
    expect(configurationDisplayStatusFor(st(), 'DEMO-B-A')).toBe('confirmed')
    expect(configurationComplete(st())).toBe(true)
  })
})
