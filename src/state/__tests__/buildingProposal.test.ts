import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  buildingConfirmed,
  canBeginConfiguration,
  choicesFor,
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

  it('invalidates only the edited building confirmation and can be re-confirmed', () => {
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
    st().confirmBuilding('DEMO-B-A')
    expect(buildingConfirmed(st(), 'DEMO-B-A')).toBe(true)
    st().resolveWflConflict('customer')
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
})

describe('selection and configuration modes', () => {
  it('cannot remove the final building and the pure gate rejects zero included', () => {
    st().toggleBuildingIncluded('DEMO-B-A')
    expect(st().included['DEMO-B-A']).toBe(true)
    expect(canBeginConfiguration({ ...st(), included: {
      'DEMO-B-A': false, 'DEMO-B-B': false,
    } })).toBe(false)
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
})
