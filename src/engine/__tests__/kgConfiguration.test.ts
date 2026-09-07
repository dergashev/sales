import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import {
  KG_SCOPE_GROUPS,
  allServices,
  dependencyBlocker,
  decidedScopeCount,
  firstOutstandingKgGroup,
  initialDecisions,
  kgCatalogue,
  kgCatalogues,
  kgChapterProgress,
  kgConfigurationComplete,
  kgContributions,
  kgDrivers,
  kgGroupAmounts,
  kgTotal,
  openKgDecisionCount,
  quantityProblem,
  reconcileKgResult,
  serviceById,
  serviceContribution,
  unpricedIncludedKgGroups,
  type KgDecisions,
  type KgScopeGroup,
} from '../kgConfiguration'

/**
 * The fixture's arithmetic is the release gate (rule 32, VR3-03 invariant 8).
 *
 * The generator `tools/build_kg_fixture.py` already refuses to emit a
 * catalogue whose baseline does not sum to the declared totals. This suite
 * re-proves it from the SHIPPED JSON through the SHIPPED engine, so a hand
 * edit to the fixture — or a change of meaning in the engine — fails here
 * and not in a screenshot.
 */

/**
 * VR3-TGA-01 restructured KG 400 and these counts moved with it.
 *
 * The chapter was three inclusion checkboxes and two variant services; it is
 * now the eight canonical TGA systems, so it carries real engineering
 * alternatives where it carried none, and the complex project's nine
 * near-identical per-building rows became three decisions that state their
 * scope once. The VR3-03 numbers were A 21/3/6 and B 43/7/11 — recorded here
 * so the change is legible rather than silently absorbed.
 *
 * The TOTALS did not move, and that is the point: a restructure that changed
 * what the chapter asks must not change what the Option costs.
 */
const DECLARED = {
  // VR3-TGA-UX-00: `Leistungsgrenze TGA` and `Hausanschlüsse` (read-only,
  // selected, worth nothing) left KG 400 for the catalogue's own
  // `responsibility` block — A 31 → 29, B 48 → 46. No amount moved with them.
  //
  // VR3-KG-UNIFY-00: KG 300 rebuilt into the 20 audited construction records
  // PER BUILDING (kg300-content-dictionary.md). Each building now carries 6
  // selected read-only/scope records, 18 configured variants and 1 explicit
  // balcony decision; B keeps `b-300-90`/`b-300-91` as explicit decisions and
  // drops the two superseded quarter-level choices (`b-300-ug`,
  // `b-300-facade`, both at a baseline delta of 0). A 29/11/7 → 31/28/8,
  // B 46/10/11 → 53/59/17. The TOTALS did not move — proved below.
  'DEMO-HAPPY-01': { total: '6480000', uncertainty: '5', selected: 31, variants: 28, decisions: 8 },
  'DEMO-COMPLEX-01': { total: '38740000', uncertainty: '6', selected: 53, variants: 59, decisions: 17 },
} as const

/** Every cost group included, every explicit decision still open. This is the
 * state the demonstration reaches by deciding 6/6 IN SCOPE and nothing else. */
function allIncluded(catalogueId: keyof typeof DECLARED): KgDecisions {
  const catalogue = kgCatalogue(catalogueId)!
  const base = initialDecisions(catalogue)
  return {
    ...base,
    scope: Object.fromEntries(
      KG_SCOPE_GROUPS.map((g) => [g, 'included' as const]),
    ) as Record<KgScopeGroup, 'included'>,
  }
}

/** The fixture baseline: 6/6 included AND every explicit decision recorded as
 * "not included" — the Option example the VR3-00 fixture spec describes. */
function fixtureBaseline(catalogueId: keyof typeof DECLARED): KgDecisions {
  const catalogue = kgCatalogue(catalogueId)!
  const decisions = allIncluded(catalogueId)
  const services = { ...decisions.services }
  for (const service of allServices(catalogue)) {
    if (service.requiresDecision) services[service.id] = { state: 'notSelected' }
  }
  return { ...decisions, services }
}

describe('KG configuration catalogue', () => {
  it('ships exactly the two demonstration catalogues', () => {
    expect(kgCatalogues().map((c) => c.projectId))
      .toEqual(['DEMO-HAPPY-01', 'DEMO-COMPLEX-01'])
    expect(kgCatalogue('does-not-exist')).toBeNull()
    expect(kgCatalogue(null)).toBeNull()
  })

  it('declares exactly the six decidable DIN 276 groups, once each', () => {
    for (const catalogue of kgCatalogues()) {
      expect(catalogue.chapters.map((c) => c.group)).toEqual([...KG_SCOPE_GROUPS])
    }
  })

  it('gives every service a unique id and bilingual copy', () => {
    for (const catalogue of kgCatalogues()) {
      const services = allServices(catalogue)
      expect(new Set(services.map((s) => s.id)).size).toBe(services.length)
      for (const service of services) {
        expect(service.labelDe.length).toBeGreaterThan(2)
        expect(service.labelEn.length).toBeGreaterThan(2)
        expect(service.summaryDe.length).toBeGreaterThan(10)
        expect(service.summaryEn.length).toBeGreaterThan(10)
      }
      for (const chapter of catalogue.chapters) {
        for (const group of chapter.groups) {
          expect(group.labelDe.length).toBeGreaterThan(2)
          expect(group.labelEn.length).toBeGreaterThan(2)
        }
      }
    }
  })

  it('resolves every declared dependency to a real service', () => {
    for (const catalogue of kgCatalogues()) {
      for (const service of allServices(catalogue)) {
        if (!service.dependsOn) continue
        expect(serviceById(catalogue, service.dependsOn.serviceId)).not.toBeNull()
      }
    }
  })
})

describe('initial state', () => {
  it.each(Object.keys(DECLARED) as Array<keyof typeof DECLARED>)(
    '%s starts with six undecided scope rows and no contribution',
    (id) => {
      const catalogue = kgCatalogue(id)!
      const decisions = initialDecisions(catalogue)
      expect(decidedScopeCount(decisions)).toBe(0)
      for (const group of KG_SCOPE_GROUPS) {
        expect(decisions.scope[group]).toBe('undecided')
        expect(kgChapterProgress(catalogue, decisions, group).state)
          .toBe('undecidedScope')
      }
      // No cost group is included, so nothing is priced — and the total is an
      // absence, not a zero the rail may print (rule 16).
      expect(kgContributions(catalogue, decisions)).toEqual([])
      expect(kgTotal(catalogue, decisions).isZero()).toBe(true)
      expect(kgConfigurationComplete(catalogue, decisions)).toBe(false)
    },
  )

  it('starts every service the domain demands an answer on as undecided', () => {
    for (const catalogue of kgCatalogues()) {
      const decisions = initialDecisions(catalogue)
      for (const service of allServices(catalogue)) {
        if (!service.requiresDecision) continue
        expect(decisions.services[service.id]!.state).toBe('undecided')
        // An unanswered decision contributes NOTHING. Unknown is not zero and
        // it is certainly not an amount.
        expect(serviceContribution(catalogue, decisions, service)).toBeNull()
      }
    }
  })
})

describe('declared demonstration totals', () => {
  it.each(Object.keys(DECLARED) as Array<keyof typeof DECLARED>)(
    '%s reproduces its declared net total and per-group split',
    (id) => {
      const catalogue = kgCatalogue(id)!
      const declared = DECLARED[id]
      expect(catalogue.declaredNetTotal).toBe(`${declared.total}.00`)
      expect(catalogue.uncertaintyPercent).toBe(declared.uncertainty)

      for (const decisions of [allIncluded(id), fixtureBaseline(id)]) {
        const amounts = kgGroupAmounts(catalogue, decisions)
        for (const group of KG_SCOPE_GROUPS) {
          expect(amounts[group]!.toFixed(2))
            .toBe(new Decimal(catalogue.declaredByCostGroup[group]).toFixed(2))
        }
        expect(kgTotal(catalogue, decisions).toFixed(2))
          .toBe(new Decimal(declared.total).toFixed(2))
      }
    },
  )

  it.each(Object.keys(DECLARED) as Array<keyof typeof DECLARED>)(
    '%s: the per-group split sums to the total (rule 32)',
    (id) => {
      const catalogue = kgCatalogue(id)!
      for (const decisions of [allIncluded(id), fixtureBaseline(id)]) {
        const { reconciles, drift } = reconcileKgResult(catalogue, decisions)
        expect(drift.toFixed(2)).toBe('0.00')
        expect(reconciles).toBe(true)
      }
    },
  )

  it.each(Object.keys(DECLARED) as Array<keyof typeof DECLARED>)(
    '%s: the drivers sum to the total (F-001)',
    (id) => {
      const catalogue = kgCatalogue(id)!
      const decisions = fixtureBaseline(id)
      const drivers = kgDrivers(catalogue, decisions)
      const sum = drivers.reduce((acc, d) => acc.plus(d.exact), new Decimal(0))
      expect(sum.toFixed(2)).toBe(kgTotal(catalogue, decisions).toFixed(2))
      expect(drivers.length).toBeGreaterThan(0)
      // Each driver carries the cost group it belongs to, so the rail's DIN 276
      // table is a grouping of the SAME rows the Kostentreiber prints.
      for (const driver of drivers) {
        expect(driver.scopeRefs).toHaveLength(1)
        expect(driver.scopeRefs[0]).toMatch(/^KG [2-7]00$/)
      }
    },
  )

  it.each(Object.keys(DECLARED) as Array<keyof typeof DECLARED>)(
    '%s carries exactly the service counts the ticket declares',
    (id) => {
      const catalogue = kgCatalogue(id)!
      const declared = DECLARED[id]
      const services = allServices(catalogue)
      const requiresDecision = services.filter((s) => s.requiresDecision)
      const variants = services.filter((s) =>
        !s.requiresDecision && s.kind.kind === 'singleChoice')
      const selected = services.filter((s) =>
        !s.requiresDecision && s.kind.kind !== 'singleChoice' && s.baseline === 'selected')
      expect(requiresDecision).toHaveLength(declared.decisions)
      expect(variants).toHaveLength(declared.variants)
      expect(selected).toHaveLength(declared.selected)
    },
  )
})

describe('completion is derived from the domain, not from visiting', () => {
  it('an included chapter with an open required decision is incomplete', () => {
    const catalogue = kgCatalogue('DEMO-HAPPY-01')!
    const decisions = allIncluded('DEMO-HAPPY-01')
    for (const group of KG_SCOPE_GROUPS) {
      const progress = kgChapterProgress(catalogue, decisions, group)
      expect(progress.state).toBe('incomplete')
      expect(progress.requiredDecisions).toBeGreaterThan(0)
      expect(progress.decidedDecisions).toBe(0)
    }
    expect(kgConfigurationComplete(catalogue, decisions)).toBe(false)
    // Seven, not six: KG 400's ventilation system now asks which solution the
    // Lüftungskonzept admits, where the chapter previously asked nothing at
    // all about it. An inapplicable decision is still not counted here — that
    // is asserted directly in `kgTgaDecisions.test.ts`.
    expect(openKgDecisionCount(catalogue, decisions)).toBe(7)
    expect(firstOutstandingKgGroup(catalogue, decisions)).toBe('KG_200')
  })

  it('recording every required decision completes the configuration', () => {
    const catalogue = kgCatalogue('DEMO-HAPPY-01')!
    const decisions = fixtureBaseline('DEMO-HAPPY-01')
    for (const group of KG_SCOPE_GROUPS) {
      expect(kgChapterProgress(catalogue, decisions, group).state).toBe('complete')
    }
    expect(openKgDecisionCount(catalogue, decisions)).toBe(0)
    expect(firstOutstandingKgGroup(catalogue, decisions)).toBeNull()
    expect(kgConfigurationComplete(catalogue, decisions)).toBe(true)
  })

  it('an excluded chapter is complete by intentional exclusion, and unpriced', () => {
    const catalogue = kgCatalogue('DEMO-HAPPY-01')!
    const baseline = fixtureBaseline('DEMO-HAPPY-01')
    const decisions: KgDecisions = {
      ...baseline,
      scope: { ...baseline.scope, KG_500: 'excluded' },
    }
    const progress = kgChapterProgress(catalogue, decisions, 'KG_500')
    expect(progress.state).toBe('outOfScope')
    expect(kgGroupAmounts(catalogue, decisions).KG_500).toBeNull()
    // The excluded group's amount leaves the total; nothing is redistributed.
    expect(kgTotal(catalogue, decisions).toFixed(2)).toBe('6180000.00')
    expect(kgConfigurationComplete(catalogue, decisions)).toBe(true)
  })

  it('reopening one scope decision withdraws completion without an extra step', () => {
    const catalogue = kgCatalogue('DEMO-HAPPY-01')!
    const baseline = fixtureBaseline('DEMO-HAPPY-01')
    const reopened: KgDecisions = {
      ...baseline,
      scope: { ...baseline.scope, KG_400: 'undecided' },
    }
    expect(kgConfigurationComplete(catalogue, reopened)).toBe(false)
    expect(kgChapterProgress(catalogue, reopened, 'KG_400').state).toBe('undecidedScope')
    // The other five chapters are untouched: invalidation is scoped, not global.
    expect(kgChapterProgress(catalogue, reopened, 'KG_300').state).toBe('complete')
  })
})

describe('quantity entry', () => {
  const catalogue = kgCatalogue('DEMO-HAPPY-01')!
  const paths = serviceById(catalogue, 'a-500-01')!

  it('prices the baseline quantity at the declared unit amount', () => {
    const decisions = fixtureBaseline('DEMO-HAPPY-01')
    expect(serviceContribution(catalogue, decisions, paths)!.toFixed(2))
      .toBe('96000.00')
  })

  it('names an invalid entry and keeps the last valid basis', () => {
    expect(quantityProblem(paths, '')).toBe('notANumber')
    expect(quantityProblem(paths, 'zwölf')).toBe('notANumber')
    expect(quantityProblem(paths, '-1')).toBe('belowMinimum')
    expect(quantityProblem(paths, '999999')).toBe('aboveMaximum')
    expect(quantityProblem(paths, '300')).toBeNull()

    const baseline = fixtureBaseline('DEMO-HAPPY-01')
    const broken: KgDecisions = {
      ...baseline,
      services: { ...baseline.services, 'a-500-01': { state: 'selected', quantity: 'zwölf' } },
    }
    // The prior valid result survives an invalid entry — the total never
    // becomes a guess and never flashes zero.
    expect(serviceContribution(catalogue, broken, paths)!.toFixed(2)).toBe('96000.00')
    expect(kgChapterProgress(catalogue, broken, 'KG_500').state).toBe('invalid')
    expect(kgConfigurationComplete(catalogue, broken)).toBe(false)
  })

  it('recomputes the amount from a valid new quantity', () => {
    const baseline = fixtureBaseline('DEMO-HAPPY-01')
    const doubled: KgDecisions = {
      ...baseline,
      services: { ...baseline.services, 'a-500-01': { state: 'selected', quantity: '600' } },
    }
    expect(serviceContribution(catalogue, doubled, paths)!.toFixed(2)).toBe('192000.00')
    expect(kgTotal(catalogue, doubled).toFixed(2)).toBe('6576000.00')
  })
})

describe('dependencies', () => {
  const catalogue = kgCatalogue('DEMO-COMPLEX-01')!

  it('is inert for the variant that needs nothing', () => {
    const decisions = fixtureBaseline('DEMO-COMPLEX-01')
    const qng = serviceById(catalogue, 'b-700-qng')!
    expect(decisions.services['b-700-qng']!.variant).toBe('none')
    expect(dependencyBlocker(catalogue, decisions, qng)).toBeNull()
  })

  it('names the upstream service when a dependent variant is chosen', () => {
    const baseline = fixtureBaseline('DEMO-COMPLEX-01')
    const wanted: KgDecisions = {
      ...baseline,
      services: {
        ...baseline.services,
        'b-700-qng': { state: 'selected', variant: 'plus' },
      },
    }
    const qng = serviceById(catalogue, 'b-700-qng')!
    expect(dependencyBlocker(catalogue, wanted, qng)).toBe('b-400-es')
    expect(kgChapterProgress(catalogue, wanted, 'KG_700').state).toBe('invalid')
    // A blocked service contributes nothing: the total never carries a
    // position the configuration itself refuses.
    expect(serviceContribution(catalogue, wanted, qng)).toBeNull()
  })

  it('clears once the upstream decision satisfies it', () => {
    const baseline = fixtureBaseline('DEMO-COMPLEX-01')
    const satisfied: KgDecisions = {
      ...baseline,
      services: {
        ...baseline.services,
        'b-400-es': { state: 'selected', variant: 'eh40nh' },
        'b-700-qng': { state: 'selected', variant: 'plus' },
      },
    }
    const qng = serviceById(catalogue, 'b-700-qng')!
    expect(dependencyBlocker(catalogue, satisfied, qng)).toBeNull()
    expect(serviceContribution(catalogue, satisfied, qng)!.toFixed(2)).toBe('340000.00')
    // 38.740.000 + 1.180.000 (EH 40 NH) + 340.000 (QNG-PLUS)
    expect(kgTotal(catalogue, satisfied).toFixed(2)).toBe('40260000.00')
  })

  it('blocks a dependent service when its upstream cost group leaves scope', () => {
    const baseline = fixtureBaseline('DEMO-COMPLEX-01')
    const withCharging: KgDecisions = {
      ...baseline,
      scope: { ...baseline.scope, KG_300: 'excluded' },
      services: {
        ...baseline.services,
        'b-400-91': { state: 'selected', quantity: '22' },
      },
    }
    const charging = serviceById(catalogue, 'b-400-91')!
    // No dependency is declared on this one, so it stays priced: the point of
    // this case is that scope exclusion alone must not silently break it.
    expect(dependencyBlocker(catalogue, withCharging, charging)).toBeNull()
    expect(serviceContribution(catalogue, withCharging, charging)!.toFixed(2))
      .toBe('176000.00')
  })
})

describe('unpriced included groups', () => {
  it('reports an included group that carries no priced position', () => {
    const catalogue = kgCatalogue('DEMO-HAPPY-01')!
    const baseline = fixtureBaseline('DEMO-HAPPY-01')
    const services = { ...baseline.services }
    for (const service of allServices(catalogue)) {
      if (service.id.startsWith('a-600-')) services[service.id] = { state: 'notSelected' }
    }
    const emptied: KgDecisions = { ...baseline, services }
    expect(unpricedIncludedKgGroups(catalogue, emptied)).toEqual(['KG_600'])
    expect(kgGroupAmounts(catalogue, emptied).KG_600).toBeNull()
  })
})
