import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStoreForTests,
  activeOptionCommercialProjection,
  configForOption,
  useStore,
} from '../store'
import {
  EDITABLE_SCOPE_FACTS,
  derivedDependants,
  derivedImpact,
  scopeBuilding,
  scopeBuildingConfirmed,
  scopeBuildingStale,
  scopeBuildingStatus,
  scopeCandidate,
  scopeConflictsOf,
  scopeFactValue,
  scopeReadyToSave,
  selectedBgfRSTotal,
} from '../optionBuildingScope'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
} from '../../test/offer-option'

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()
const building = (id: string) => scopeBuilding(st(), id)!

/**
 * B2 · Product Owner requirement 10 — every displayed baseline fact is
 * editable, and nothing derived from one moves silently.
 *
 * The fixture arithmetic these tests rest on (`vr3-demo-projects.json`):
 *
 * ```
 * B-BLDG-B Hofhaus   R↑ 4 620 + S↑ 180 = R+S↑ 4 800
 *                    R↓   980 + S↓   0 = R+S↓   980
 *                                        R+S     5 780
 * ```
 */

describe('the derived graph is the sums the baseline already states', () => {
  it('reaches the transitive dependants, in evaluation order', () => {
    expect(derivedDependants('bgfRAbove')).toEqual(['bgfRSAbove', 'bgfRSTotal'])
    expect(derivedDependants('bgfSBelow')).toEqual(['bgfRSBelow', 'bgfRSTotal'])
    expect(derivedDependants('bgfRSAbove')).toEqual(['bgfRSTotal'])
    // A leaf that nothing is computed from moves nothing.
    expect(derivedDependants('wfl')).toEqual([])
    expect(derivedDependants('usage')).toEqual([])
  })

  it('previews before/after from those sums and from nothing else', () => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    const hofhaus = building('B-BLDG-B')
    const impacts = derivedImpact(st(), hofhaus, 'bgfRAbove', '4720.00')
    expect(impacts.map((i) => [i.key, i.before, i.after])).toEqual([
      ['bgfRSAbove', '4800.00', '4900.00'],
      ['bgfRSTotal', '5780.00', '5880.00'],
    ])
  })

  it('declares every displayed fact editable, including the seven BGF facts and the three choices', () => {
    for (const key of [
      'usage', 'storeys', 'underground',
      'bgfRAbove', 'bgfSAbove', 'bgfRSAbove',
      'bgfRBelow', 'bgfSBelow', 'bgfRSBelow', 'bgfRSTotal',
      'wfl', 'nuf', 'commercialNuf', 'units', 'workplaces', 'parkingSpaces', 'siteArea',
    ]) {
      expect(EDITABLE_SCOPE_FACTS).toContain(key)
    }
  })
})

describe('a derived dependant is resolved explicitly, never by default', () => {
  beforeEach(() => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
  })

  it('refuses an edit with dependants when no outcome was chosen', () => {
    act(() => {
      st().editScopeMetric('B-BLDG-B', 'bgfRAbove', '4720.00', 'Aufmass')
    })
    // Nothing written, nothing journalled: the Product does not pick.
    expect(st().scopeEdits['B-BLDG-B']?.bgfRAbove).toBeUndefined()
    expect(st().scopeConflicts['B-BLDG-B']?.bgfRSTotal).toBeUndefined()
  })

  it('recalculates the sums when that is the chosen outcome, and moves the commercial base with them', () => {
    const totalBefore = selectedBgfRSTotal(st())
    act(() => {
      st().editScopeMetric('B-BLDG-B', 'bgfRAbove', '4720.00', 'Aufmass', 'recalculate')
    })
    const edits = st().scopeEdits['B-BLDG-B']!
    expect(edits.bgfRAbove?.value).toBe('4720.00')
    expect(edits.bgfRSAbove?.value).toBe('4900.00')
    expect(edits.bgfRSTotal?.value).toBe('5880.00')
    expect(scopeConflictsOf(st(), 'B-BLDG-B')).toEqual({})
    // The selected total — the number the commercial scale rests on — moved
    // by exactly the 100 m² that was added, and not silently.
    expect(selectedBgfRSTotal(st())).not.toBe(totalBefore)
    expect(selectedBgfRSTotal(st()))
      .toBe((Number(totalBefore) + 100).toFixed(2))
  })

  it('keeps a manual total as a NAMED conflict, and blocks the save until it is resolved', () => {
    act(() => {
      st().editScopeMetric('B-BLDG-B', 'bgfRAbove', '4720.00', 'Aufmass', 'keepManual')
    })
    const conflicts = scopeConflictsOf(st(), 'B-BLDG-B')
    expect(conflicts.bgfRSAbove).toEqual(expect.objectContaining({
      derived: '4900.00', kept: '4800.00', causedBy: 'bgfRAbove',
    }))
    expect(conflicts.bgfRSTotal).toEqual(expect.objectContaining({
      derived: '5880.00', kept: '5780.00',
    }))
    // The building reports the conflict rather than a confirmation, and the
    // scope cannot be saved while a total contradicts its own components.
    expect(scopeBuildingStatus(st(), 'B-BLDG-B')).toBe('conflict')
    expect(scopeReadyToSave(st())).toBe(false)

    act(() => { st().resolveScopeConflict('B-BLDG-B', 'bgfRSAbove') })
    act(() => { st().resolveScopeConflict('B-BLDG-B', 'bgfRSTotal') })
    expect(scopeConflictsOf(st(), 'B-BLDG-B')).toEqual({})
    expect(st().scopeEdits['B-BLDG-B']?.bgfRSTotal?.value).toBe('5880.00')
  })

  it('is ONE journalled decision with ONE inverse, edit and resolution together', () => {
    const before = st().journal.length
    act(() => {
      st().editScopeMetric('B-BLDG-B', 'bgfRAbove', '4720.00', 'Aufmass', 'recalculate')
    })
    expect(st().journal.length).toBe(before + 1)
    act(() => { st().undo() })
    // An undo that restored the component while leaving the totals
    // recomputed would leave the baseline in a state nobody chose.
    expect(st().scopeEdits['B-BLDG-B']?.bgfRAbove).toBeUndefined()
    expect(st().scopeEdits['B-BLDG-B']?.bgfRSTotal).toBeUndefined()
    // BGF R+S TOTAL across the three buildings: 6 030 + 5 780 + 7 660.
    // (17 250 is the ABOVE-GROUND sum — a different denominator, and the
    // reason this product names every one of them.)
    expect(selectedBgfRSTotal(st())).toBe('19470.00')
  })
})

describe('a closed-domain fact is edited as a choice, and the fingerprint follows it', () => {
  beforeEach(() => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
  })

  it('overrides the use, and un-confirms the building by arithmetic', () => {
    expect(scopeBuildingConfirmed(st(), 'B-BLDG-A')).toBe(true)
    act(() => {
      st().editScopeMetric(
        'B-BLDG-A', 'usage', 'vr3.building.usage.residential', 'Nutzung geklärt',
      )
    })
    expect(scopeFactValue(st(), building('B-BLDG-A'), 'usage'))
      .toBe('vr3.building.usage.residential')
    // A building that changed its use is not the building that was
    // confirmed. No invalidation action can be forgotten, because there
    // isn't one — the fingerprint stops matching.
    expect(scopeBuildingConfirmed(st(), 'B-BLDG-A')).toBe(false)
    expect(scopeBuildingStale(st(), 'B-BLDG-A')).toBe(true)
  })

  it('changes the Option use profile it feeds, so the metric policy follows the edit', () => {
    // A projection has no metric and no gap until there is a price to
    // divide (rule 16), so the calculation is completed first — otherwise
    // this would assert the absence of metrics for the wrong reason.
    completeKgConfiguration()
    // Leipzig is mixed-use. Making the office building residential leaves
    // Kontorhaus + Hofhaus residential and Stadthaus still mixed, so the
    // profile stays mixed — what changes is which areas the segments sum.
    const before = activeOptionCommercialProjection(st())
    expect(before.useProfile).toBe('mixed')
    expect(before.metrics.some((m) => m.id === 'wfl')).toBe(true)
    act(() => {
      st().editScopeMetric(
        'B-BLDG-A', 'usage', 'vr3.building.usage.residential', 'Nutzung geklärt',
      )
      // The office NUF is no longer this building's normative area; its WFL
      // is, and the baseline has none, so the residential segment becomes
      // unknown rather than a partial sum under a full label.
    })
    const after = activeOptionCommercialProjection(st())
    expect(after.gaps.map((g) => g.id)).toContain('wfl')
    expect(after.metrics.some((m) => m.id === 'wfl')).toBe(false)
  })

  it('reverts to the source value, and the confirmation is required again', () => {
    act(() => {
      st().editScopeMetric('B-BLDG-A', 'underground', 'full', 'Kellergeschoss gefunden')
    })
    expect(scopeFactValue(st(), building('B-BLDG-A'), 'underground')).toBe('full')
    act(() => { st().revertScopeMetric('B-BLDG-A', 'underground') })
    // Source becomes current; the history stays in the journal.
    expect(scopeFactValue(st(), building('B-BLDG-A'), 'underground')).toBe('none')
    expect(st().scopeEdits['B-BLDG-A']?.underground).toBeUndefined()
    expect(st().journal.some((e) => e.labelKey === 'vr3.journal.scopeMetricReverted'))
      .toBe(true)
  })
})

describe('re-analysis proposes and never overwrites', () => {
  beforeEach(() => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
  })

  it('records NOTHING for a proposal identical to the current value', () => {
    const currentWfl = scopeFactValue(st(), building('B-BLDG-B'), 'wfl')!
    const journalBefore = st().journal.length
    act(() => {
      st().proposeScopeCandidates('B-BLDG-B', [{ key: 'wfl', value: currentWfl }])
    })
    // An identical read is not a change. Manufacturing a conflict out of
    // agreement is the false invalidation the status model forbids.
    expect(scopeCandidate(st(), 'B-BLDG-B', 'wfl')).toBeNull()
    expect(scopeBuildingConfirmed(st(), 'B-BLDG-B')).toBe(true)
    expect(st().journal.length).toBe(journalBefore)
  })

  it('holds a changed proposal BESIDE the confirmed value without touching it', () => {
    act(() => {
      st().proposeScopeCandidates('B-BLDG-B', [{ key: 'wfl', value: '3510.00' }])
    })
    const candidate = scopeCandidate(st(), 'B-BLDG-B', 'wfl')!
    expect(candidate.value).toBe('3510.00')
    expect(candidate.current).toBe('3410.00')
    // The confirmed value is UNTOUCHED and the confirmation still stands —
    // a proposal is not a change (rule 14, M-1/D-08).
    expect(scopeFactValue(st(), building('B-BLDG-B'), 'wfl')).toBe('3410.00')
    expect(scopeBuildingConfirmed(st(), 'B-BLDG-B')).toBe(true)
    // …but the building now needs a human, and says so.
    expect(st().scopeCandidates['B-BLDG-B']?.wfl).toBeDefined()
  })

  it('accepting takes the value through the ordinary edit, with its trail', () => {
    act(() => {
      st().proposeScopeCandidates('B-BLDG-B', [{ key: 'wfl', value: '3510.00' }])
      st().acceptScopeCandidate('B-BLDG-B', 'wfl', 'Aus erneuter Analyse')
    })
    const edit = st().scopeEdits['B-BLDG-B']?.wfl
    expect(edit?.value).toBe('3510.00')
    expect(edit?.previous).toBe('3410.00')
    expect(edit?.reason).toBe('Aus erneuter Analyse')
    expect(edit?.actor).toBeTruthy()
    expect(scopeCandidate(st(), 'B-BLDG-B', 'wfl')).toBeNull()
    // Reconfirmation is required against the NEW fact.
    expect(scopeBuildingConfirmed(st(), 'B-BLDG-B')).toBe(false)
  })

  it('keeping the current value clears the proposal and leaves the fact alone', () => {
    act(() => {
      st().proposeScopeCandidates('B-BLDG-B', [{ key: 'wfl', value: '3510.00' }])
      st().dismissScopeCandidate('B-BLDG-B', 'wfl')
    })
    expect(scopeCandidate(st(), 'B-BLDG-B', 'wfl')).toBeNull()
    expect(scopeFactValue(st(), building('B-BLDG-B'), 'wfl')).toBe('3410.00')
    expect(st().scopeEdits['B-BLDG-B']?.wfl).toBeUndefined()
    expect(scopeBuildingConfirmed(st(), 'B-BLDG-B')).toBe(true)
  })
})

describe('no edit leaks across Options', () => {
  it('keeps overrides, conflicts and proposals with the Option that owns them', () => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    const first = st().activeOptionId!

    act(() => {
      st().editScopeMetric('B-BLDG-B', 'bgfRAbove', '4720.00', 'Aufmass', 'keepManual')
      st().proposeScopeCandidates('B-BLDG-B', [{ key: 'wfl', value: '3510.00' }])
    })
    expect(Object.keys(scopeConflictsOf(st(), 'B-BLDG-B')).length).toBe(2)

    act(() => { st().createOption('Option 2') })
    const second = st().activeOptionId!
    expect(second).not.toBe(first)

    // The second Option inherits the project baseline CLEAN: it is a
    // variant of the project, not a copy of another variant's overrides.
    expect(st().scopeEdits['B-BLDG-B']?.bgfRAbove).toBeUndefined()
    expect(scopeConflictsOf(st(), 'B-BLDG-B')).toEqual({})
    expect(scopeCandidate(st(), 'B-BLDG-B', 'wfl')).toBeNull()

    // …and the first Option still holds every one of them, because all
    // three fields are part of `OPTION_CONFIG_KEYS`.
    const firstConfig = configForOption(st(), first)!
    expect(firstConfig.scopeEdits['B-BLDG-B']?.bgfRAbove?.value).toBe('4720.00')
    expect(Object.keys(firstConfig.scopeConflicts['B-BLDG-B'] ?? {}).length).toBe(2)
    expect(firstConfig.scopeCandidates['B-BLDG-B']?.wfl?.value).toBe('3510.00')
  })
})
