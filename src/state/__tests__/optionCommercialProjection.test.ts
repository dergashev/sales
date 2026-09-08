import Decimal from 'decimal.js'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStoreForTests,
  activeOptionCommercialProjection,
  commercialResult,
  kgCatalogueFor,
  optionCommercialProjectionFor,
  useStore,
} from '../store'
import {
  buildingUseClass,
  optionUseProfile,
  optionCommercialProjection,
} from '../optionCommercialProjection'
import { DENOMINATOR_LABEL } from '../../engine/money'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

/**
 * B2 · requirement 9 — ONE commercial projection, and its denominators.
 *
 * The assertions here are deliberately arithmetic rather than textual. The
 * defect class this ticket closes is not a wrong word on a card: it is two
 * surfaces publishing two numbers for one Option, and a denominator whose
 * caption does not describe what was summed (DATA-001). Both are provable,
 * so they are proved.
 *
 * The fixture areas these tests are read against (`vr3-demo-projects.json`):
 *
 * ```
 * DEMO-HAPPY-01 · Freiburg   A-BLDG-01  residentialMfh  WFL 2 120  BGF↑ 2 900
 * DEMO-COMPLEX-01 · Leipzig  B-BLDG-A   office          NUF 4 360  BGF↑ 6 030
 *                            B-BLDG-B   residential     WFL 3 410  BGF↑ 4 800
 *                            B-BLDG-C   mixed           WFL 3 620  BGF↑ 6 420
 *                                                       commercial NUF 920
 * ```
 */

function projection() {
  return activeOptionCommercialProjection(st())
}

function metric(id: 'wfl' | 'nuf' | 'bgfAbove') {
  return projection().metrics.find((m) => m.id === id) ?? null
}

describe('the use axis is declared, never guessed', () => {
  it('classifies exactly the four fixture use keys and refuses the rest', () => {
    expect(buildingUseClass('vr3.building.usage.residential')).toBe('residential')
    expect(buildingUseClass('vr3.building.usage.residentialMfh')).toBe('residential')
    expect(buildingUseClass('vr3.building.usage.office')).toBe('nonResidential')
    expect(buildingUseClass('vr3.building.usage.mixed')).toBe('mixed')
    // An unlisted key is an honest absence, NOT a default to residential:
    // guessing here would publish a WoFlV label over an area nobody measured
    // under WoFlV.
    expect(buildingUseClass('vr3.building.usage.hospital')).toBeNull()
    expect(buildingUseClass('')).toBeNull()
  })

  it('derives the Option profile from its buildings, and calls an unclassifiable scope unknown', () => {
    const building = (usageKey: string) => ({
      id: usageKey, name: usageKey, usageKey,
      storeysKey: 'x', undergroundLevel: 'none' as const, identityAssetId: '',
      metrics: {} as never, authority: {}, evidenceDocIds: [],
    })
    expect(optionUseProfile([building('vr3.building.usage.residential')]))
      .toBe('residential')
    expect(optionUseProfile([building('vr3.building.usage.office')]))
      .toBe('nonResidential')
    // One mixed building is already both segments — mixed use is a count of
    // segments, not a building type (rule 33).
    expect(optionUseProfile([building('vr3.building.usage.mixed')])).toBe('mixed')
    expect(optionUseProfile([
      building('vr3.building.usage.residential'),
      building('vr3.building.usage.office'),
    ])).toBe('mixed')
    expect(optionUseProfile([building('vr3.building.usage.hospital')])).toBe('unknown')
    expect(optionUseProfile([])).toBe('unknown')
  })
})

describe('a residential-only Option is measured in WFL nach WoFlV', () => {
  beforeEach(() => {
    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    completeKgConfiguration()
  })

  it('publishes WFL and the BGF scale, and no NUF metric at all', () => {
    const p = projection()
    expect(p.useProfile).toBe('residential')
    expect(p.metrics.map((m) => m.id)).toEqual(['wfl', 'bgfAbove'])
    expect(metric('nuf')).toBeNull()
    // The building HAS a `nuf` value (2 240) — it is simply not this
    // Option's normative area, and a residential-only offer must not
    // publish it as one.
    expect(p.gaps).toEqual([])
  })

  it('divides by the fixture WFL and names WoFlV in the denominator label', () => {
    const wfl = metric('wfl')!
    expect(wfl.role).toBe('segment')
    expect(wfl.rate.denominator.toFixed(2)).toBe('2120.00')
    expect(wfl.rate.denominatorLabel).toBe('WFL nach WoFlV')
    expect(wfl.rate.denominatorType).toBe('WFL_WOFLV')
    // The numerator is the result's own total — never recomputed here.
    expect(wfl.rate.numerator.toFixed(2))
      .toBe(commercialResult(st()).total.exact.toFixed(2))
  })

  it('names BGF above ground as a construction SCALE, not as the lead metric', () => {
    const bgf = metric('bgfAbove')!
    expect(bgf.role).toBe('scale')
    expect(bgf.rate.denominator.toFixed(2)).toBe('2900.00')
    expect(bgf.rate.denominatorLabel).toBe('BGF oberirdisch')
  })
})

describe('a mixed-use Option carries BOTH segment metrics and blends nothing', () => {
  beforeEach(() => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
  })

  it('sums each segment from its OWN metric — commercial NUF, never plain NUF', () => {
    const p = projection()
    expect(p.useProfile).toBe('mixed')
    expect(p.metrics.map((m) => m.id)).toEqual(['wfl', 'nuf', 'bgfAbove'])
    // Residential: Hofhaus 3 410 + Stadthaus 3 620.
    expect(metric('wfl')!.rate.denominator.toFixed(2)).toBe('7030.00')
    // Non-residential: Kontorhaus NUF 4 360 + Stadthaus COMMERCIAL NUF 920.
    // Using Stadthaus's plain `nuf` here would be a different measurement
    // of a different part of the building.
    expect(metric('nuf')!.rate.denominator.toFixed(2)).toBe('5280.00')
    expect(metric('bgfAbove')!.rate.denominator.toFixed(2)).toBe('17250.00')
  })

  it('never produces a blended denominator, and says the two metrics are not additive', () => {
    const p = projection()
    const blended = new Decimal('7030').plus('5280')
    for (const m of p.metrics) {
      expect(m.rate.denominator.equals(blended)).toBe(false)
    }
    expect(p.metricsAreAdditive).toBe(false)
    // Both segment labels name their norm; neither is a bare `€/m²`.
    const labels = p.metrics.map((m) => m.rate.denominatorLabel)
    expect(labels).toContain(DENOMINATOR_LABEL.WFL_WOFLV)
    expect(labels).toContain(DENOMINATOR_LABEL.NUF_DIN277)
    expect(labels.every((label) => label.trim().length > 0)).toBe(true)
  })

  it('follows the SELECTED scope: deselecting the residential buildings leaves a non-residential Option', () => {
    act(() => {
      st().toggleScopeBuilding('B-BLDG-B')
      st().confirmScopeRemoval()
      st().toggleScopeBuilding('B-BLDG-C')
      st().confirmScopeRemoval()
    })
    const p = projection()
    expect(p.useProfile).toBe('nonResidential')
    expect(p.metrics.map((m) => m.id)).toEqual(['nuf', 'bgfAbove'])
    expect(metric('nuf')!.rate.denominator.toFixed(2)).toBe('4360.00')
    expect(metric('bgfAbove')!.rate.denominator.toFixed(2)).toBe('6030.00')
  })
})

describe('an applicable segment with no area is a named absence, never a zero', () => {
  it('reports a gap that still spells out the norm', () => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    const s = st()
    // Strip the non-residential areas while keeping the uses that demand
    // them: rule 16's case — the question applies and the answer is unknown.
    const stripped = {
      ...s,
      scopeBuildings: s.scopeBuildings.map((b) => ({
        ...b,
        metrics: { ...b.metrics, nuf: null, commercialNuf: null },
      })),
    }
    const p = optionCommercialProjection(
      stripped, commercialResult(s), kgCatalogueFor(s), s.kgConfig,
    )
    expect(p.useProfile).toBe('mixed')
    expect(p.metrics.map((m) => m.id)).toEqual(['wfl', 'bgfAbove'])
    expect(p.gaps).toEqual([
      { id: 'nuf', segmentLabelKey: 'b2.metric.segment.nonResidential', denominatorLabel: 'NUF nach DIN 277' },
    ])
  })

  it('reports an unknown segment as a gap when ONE contributing building is missing its value', () => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    const s = st()
    const stripped = {
      ...s,
      scopeBuildings: s.scopeBuildings.map((b) => (b.id === 'B-BLDG-C'
        ? { ...b, metrics: { ...b.metrics, wfl: null } }
        : b)),
    }
    const p = optionCommercialProjection(
      stripped, commercialResult(s), kgCatalogueFor(s), s.kgConfig,
    )
    // ALL-OR-NOTHING: 3 410 alone under the label `WFL nach WoFlV` for a
    // two-building residential segment would be a denominator that does not
    // describe what it claims to.
    expect(p.metrics.find((m) => m.id === 'wfl')).toBeUndefined()
    expect(p.gaps.map((g) => g.id)).toEqual(['wfl'])
  })
})

describe('the projection carries the Energy, QNG and DGNB axes', () => {
  beforeEach(() => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
  })

  it('reports each axis from its DECLARED service, not from a hardcoded id', () => {
    const p = projection()
    expect(p.energy?.serviceId).toBe('b-400-es')
    expect(p.qng?.serviceId).toBe('b-700-qng')
    expect(p.dgnb?.serviceId).toBe('b-700-dgnb')
    expect(p.energy?.axis).toBe('energy')
    // Untouched axes stand at their catalogue baseline and say so.
    expect(p.energy?.isBaseline).toBe(true)
    expect(p.qng?.variantId).toBe('none')
    expect(p.dgnb?.variantId).toBe('none')
  })

  it('follows a real decision through the store', () => {
    act(() => {
      st().setKgServiceDecision('b-400-es', { state: 'selected', variant: 'eh40' })
    })
    const p = projection()
    expect(p.energy?.variantId).toBe('eh40')
    expect(p.energy?.isBaseline).toBe(false)
    expect(p.energy?.variantLabelDe).toContain('40')
  })
})

describe('one projection, so surfaces cannot disagree', () => {
  it('gives the card path and the rail path the same values and the same result version', () => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    saveOptionBaseline()

    const optionId = st().activeOptionId!
    const card = optionCommercialProjectionFor(st(), optionId)!
    const rail = activeOptionCommercialProjection(st())

    expect(card.netTotal.exact.toFixed(2)).toBe(rail.netTotal.exact.toFixed(2))
    expect(card.totalLabel).toBe(rail.totalLabel)
    expect(card.coverage).toBe(rail.coverage)
    expect(card.useProfile).toBe(rail.useProfile)
    expect(card.resultVersion).toBe(rail.resultVersion)
    expect(card.metrics.map((m) => [m.id, m.rate.display, m.rate.denominatorLabel]))
      .toEqual(rail.metrics.map((m) => [m.id, m.rate.display, m.rate.denominatorLabel]))
    expect(card.energy?.variantId).toBe(rail.energy?.variantId)

    /**
     * AC-3 — the chain that reaches the exports and Client Mode.
     *
     * These two paths are genuinely independent derivations of one
     * configuration: the card projects `clientSnapshotForOption`'s result
     * (the same function `clientBaselineSnapshot` and the client projection
     * use) and the rail projects the guarded `commercialSnapshot`'s. Their
     * agreement is what makes every downstream consumer agree, because none
     * of them re-prices — `clientProposal` takes a `CommercialResult` and
     * the export surfaces read the same one.
     *
     * The literal anchors that chain to the DECLARED fixture total, which
     * `clientScenario.test.ts` asserts from the client side. One number,
     * two suites, opposite ends of the product.
     */
    expect(card.netTotal.exact.toFixed(2)).toBe('38740000.00')
    expect(rail.netTotal.exact.toFixed(2)).toBe('38740000.00')
  })

  it("keeps each Option's projection to itself when the workspace switches", () => {
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    const first = st().activeOptionId!
    const firstProfile = activeOptionCommercialProjection(st()).useProfile

    act(() => { st().createOption('Option 2') })
    const second = st().activeOptionId!
    expect(second).not.toBe(first)

    // The first Option's projection is still readable, unchanged, from the
    // second Option's workspace — `optionCommercialProjectionFor` reads that
    // Option's own configuration and never the flat working copy.
    expect(optionCommercialProjectionFor(st(), first)!.useProfile).toBe(firstProfile)
  })
})
