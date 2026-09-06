import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import {
  allServices,
  blockedVariantReason,
  changedFromSource,
  chapterOf,
  chapterServiceById,
  costAuthorityOf,
  dependencySuspension,
  initialDecisions,
  isApplicable,
  kgCascadeFor,
  kgCatalogue,
  kgChapterOverview,
  kgChapterProgress,
  kgContributions,
  kgGroupAmounts,
  kgSystemProgress,
  kgTotal,
  proposalChanges,
  rendersAmount,
  serviceById,
  serviceContribution,
  serviceDecision,
  systemNarrative,
  systemServices,
  type KgDecisions,
  type KgScopeGroup,
} from '../kgConfiguration'

/**
 * KG 400 AS A SOURCE-AWARE SYSTEM CONFIGURATOR (VR3-TGA-01).
 *
 * These are the audit's own acceptance criteria as arithmetic. Every one of
 * them was measured as BROKEN on `06a4acf`, so each test names the defect it
 * closes rather than merely asserting the new behaviour.
 */

const A = kgCatalogue('DEMO-HAPPY-01')!
const B = kgCatalogue('DEMO-COMPLEX-01')!
const CHAPTER = 'KG_400' as KgScopeGroup

function included(catalogue = A): KgDecisions {
  const base = initialDecisions(catalogue)
  return {
    ...base,
    scope: Object.fromEntries(
      Object.keys(base.scope).map((g) => [g, 'included']),
    ) as KgDecisions['scope'],
  }
}

const chapterA = chapterOf(A, CHAPTER)!
const chapterB = chapterOf(B, CHAPTER)!

describe('the eight canonical TGA systems', () => {
  it('are present once, in order, on both demonstration projects', () => {
    const names = [
      'Wärme', 'Trinkwasser & Warmwasser', 'Lüftung & sommerlicher Komfort',
      'Elektro & Energie', 'Entwässerung', 'Kommunikation & Zutritt',
      'Aufzüge & Sonderanlagen', 'Schnittstellen & Verantwortung',
    ]
    expect(chapterA.groups.map((g) => g.labelDe)).toEqual(names)
    expect(chapterB.groups.map((g) => g.labelDe)).toEqual(names)
  })

  it('declares a Rahmen band, a cross-system rule and a Bemusterung boundary', () => {
    for (const chapter of [chapterA, chapterB]) {
      expect(chapter.rahmen?.map((r) => r.id)).toEqual([
        'energieziel', 'mindeststandard', 'gebaeudeumfang', 'leistungsgrenze',
      ])
      expect(chapter.rules?.map((r) => r.id)).toContain('p14a')
      expect(chapter.bemusterung).toBeTruthy()
    }
  })

  it('reads the building scope from the Option, never from the fixture', () => {
    // The one Rahmen line that must not be authored: writing "1 Gebäude ·
    // Lindenhof" into a catalogue is the chapter asserting a building set
    // instead of reading the confirmed one.
    const scope = chapterA.rahmen!.find((r) => r.id === 'gebaeudeumfang')!
    expect(scope.derive).toBe('buildingScope')
    expect(scope.valueDe).toBe('')
  })

  it('keeps the Energieziel out of the systems and in the Rahmen', () => {
    const energy = chapterServiceById(chapterA, 'a-400-es')!
    expect(energy.surface).toBe('rahmen')
    for (const group of chapterA.groups) {
      expect(systemServices(group)).not.toContain(energy)
    }
  })
})

describe('the source baseline and the Option proposal are two things', () => {
  it('keeps the documented value beside a proposal that differs from it', () => {
    const heat = chapterServiceById(chapterA, 'a-400-01')!
    // The client documents say district heating; All3 proposes its standard.
    expect(heat.source?.variant).toBe('WE_FW')
    expect(heat.source?.valueDe).toBe('Fernwärme-Übergabestation')
    expect(heat.source?.originDe).toContain('03_Energiekonzept.pdf')
    expect(heat.all3Standard).toBe('WE_LW_WP')
    expect(changedFromSource(included(), heat)).toBe(true)
  })

  it('does not overwrite the source when the proposal changes', () => {
    const heat = chapterServiceById(chapterA, 'a-400-01')!
    const before = heat.source
    const after: KgDecisions = {
      ...included(),
      services: {
        ...included().services,
        'a-400-01': { state: 'selected', variant: 'WE_SW_WP' },
      },
    }
    expect(changedFromSource(after, heat)).toBe(true)
    // The evidence is a property of the CATALOGUE, not of the decision: no
    // sequence of proposals can reach it.
    expect(chapterServiceById(chapterA, 'a-400-01')!.source).toBe(before)
  })

  it('reports NO deviation when the proposal is the documented value', () => {
    const heat = chapterServiceById(chapterA, 'a-400-01')!
    const restored: KgDecisions = {
      ...included(),
      services: {
        ...included().services,
        'a-400-01': { state: 'selected', variant: 'WE_FW' },
      },
    }
    expect(changedFromSource(restored, heat)).toBe(false)
  })

  it('says "not specified" rather than inventing a source value', () => {
    const ventilation = chapterServiceById(chapterA, 'a-400-18')!
    expect(ventilation.source?.valueDe).toBeUndefined()
    expect(ventilation.source?.originDe).toBeTruthy()
    // An undecided decision is not a deviation — it is an open question.
    expect(changedFromSource(included(), ventilation)).toBeNull()
  })

  it('lists every deviation from the client documents for the review', () => {
    const changed = proposalChanges(A, chapterA, included())
    expect(changed.map((s) => s.id)).toContain('a-400-01')
    // A restored proposal leaves the review with nothing to show for it.
    const restored: KgDecisions = {
      ...included(),
      services: {
        ...included().services,
        'a-400-01': { state: 'selected', variant: 'WE_FW' },
      },
    }
    expect(proposalChanges(A, chapterA, restored).map((s) => s.id))
      .not.toContain('a-400-01')
  })
})

describe('applicability is a statement with a cause, never an option', () => {
  it('marks a system not applicable and names why', () => {
    const drainage = chapterA.groups.find((g) => g.labelDe === 'Entwässerung')!
    expect(drainage.applicability?.state).toBe('notApplicable')
    expect(drainage.applicability?.reasonDe).toContain('kein UG')
  })

  it('offers no option called "Keine …" anywhere in the chapter', () => {
    for (const chapter of [chapterA, chapterB]) {
      for (const group of chapter.groups) {
        for (const service of group.services) {
          if (service.kind.kind !== 'singleChoice') continue
          for (const variant of service.kind.variants) {
            // `Kein Handtuchheizkörper` is a genuine product choice; a
            // `Keine Tiefgaragenlüftung` would be a project fact dressed as
            // one. The distinction is that the latter never renders at all.
            expect(variant.labelDe).not.toMatch(/^Keine (Tiefgaragen|TG|E-Mob)/)
          }
        }
      }
    }
  })

  it('never counts an inapplicable decision as outstanding work', () => {
    const decisions = included()
    const progress = kgChapterProgress(A, decisions, CHAPTER)
    const inapplicable = chapterA.groups
      .flatMap((g) => g.services)
      .filter((s) => !isApplicable(s) && s.requiresDecision)
    // Whatever the fixture marks moot cannot appear in the required count:
    // a chapter that can never be finished is the artificial completion
    // metric the audit named.
    expect(progress.requiredDecisions).toBeLessThanOrEqual(
      chapterA.groups.flatMap((g) => g.services).filter((s) => s.requiresDecision).length
        - inapplicable.length,
    )
  })

  it('contributes null, never zero, for an inapplicable decision', () => {
    const decisions = included()
    for (const group of chapterA.groups) {
      for (const service of group.services) {
        if (isApplicable(service)) continue
        expect(serviceContribution(A, decisions, service)).toBeNull()
      }
    }
  })
})

describe('a euro renders only where there is cost authority', () => {
  it('classifies every KG 400 decision explicitly', () => {
    for (const chapter of [chapterA, chapterB]) {
      for (const group of chapter.groups) {
        for (const service of group.services) {
          expect(['direct', 'bundle', 'indirect', 'noBasis', 'bauherr', 'none'])
            .toContain(costAuthorityOf(service))
        }
      }
    }
  })

  it('permits an amount ONLY on a directly priced decision', () => {
    for (const chapter of [chapterA, chapterB]) {
      for (const group of chapter.groups) {
        for (const service of group.services) {
          if (costAuthorityOf(service) === 'direct') continue
          expect(rendersAmount(service)).toBe(false)
        }
      }
    }
  })

  it('gives an alternative with no cost option its own words, not a zero', () => {
    const emission = chapterServiceById(chapterA, 'a-400-04')!
    if (emission.kind.kind !== 'singleChoice') throw new Error('not a choice')
    // Every alternative here is unpriced in the source, so none may carry a
    // delta and all of them must say so.
    for (const variant of emission.kind.variants) {
      expect(variant.noPriceBasis).toBe(true)
      expect(variant.delta).toBe('0.00')
    }
    expect(costAuthorityOf(emission)).toBe('noBasis')
  })

  it('shows no difference between central and decentral heat recovery', () => {
    // Measured in the source: `KG 430 ALD` and `KG 430 HR` each cover two
    // options, so the two heat-recovery systems share one cost option and a
    // delta between them would be fabricated.
    const ventilation = chapterServiceById(chapterA, 'a-400-18')!
    if (ventilation.kind.kind !== 'singleChoice') throw new Error('not a choice')
    const central = ventilation.kind.variants.find((v) => v.value === 'WL_ZENTRAL_WRG')!
    const decentral = ventilation.kind.variants.find((v) => v.value === 'WL_DEZ_WRG')!
    expect(central.delta).toBe(decentral.delta)
  })

  it('never gives a Bauherr-owned row an amount', () => {
    for (const chapter of [chapterA, chapterB]) {
      const owned = chapter.groups
        .flatMap((g) => g.services)
        .filter((s) => costAuthorityOf(s) === 'bauherr')
      expect(owned.length).toBeGreaterThan(0)
      for (const service of owned) {
        expect(rendersAmount(service)).toBe(false)
        expect(new Decimal(service.amount).isZero()).toBe(true)
      }
    }
  })

  it('keeps the declared KG 400 subtotal of both projects', () => {
    expect(A.declaredByCostGroup.KG_400).toBe('1390000.00')
    expect(B.declaredByCostGroup.KG_400).toBe('8420000.00')
    const overviewA = kgChapterOverview(A, included(A), chapterA)
    expect(overviewA.amount?.toFixed(2)).toBe('1390000.00')
    const overviewB = kgChapterOverview(B, included(B), chapterB)
    expect(overviewB.amount?.toFixed(2)).toBe('8420000.00')
  })
})

describe('an unavailable alternative is shown WITH its reason', () => {
  it('blocks window ventilation in the new-build path and says why', () => {
    const ventilation = chapterServiceById(chapterA, 'a-400-18')!
    const reason = blockedVariantReason(ventilation, 'WL_FENSTER', false)
    expect(reason).toBeTruthy()
    expect(reason).toContain('nutzerunabhängig')
    // It remains an alternative in the set — shown, not deleted.
    if (ventilation.kind.kind !== 'singleChoice') throw new Error('not a choice')
    expect(ventilation.kind.variants.map((v) => v.value)).toContain('WL_FENSTER')
  })

  it('blocks a hydronic towel radiator when the emitter carries no wet circuit', () => {
    const towel = chapterServiceById(chapterA, 'a-400-16')!
    expect(blockedVariantReason(towel, 'HHK_WW', false)).toBeTruthy()
    expect(blockedVariantReason(towel, 'HHK_ELEKTRO', false)).toBeNull()
  })
})

describe('a parent change cannot leave an impossible combination', () => {
  /**
   * THE P0-1 REGRESSION TEST.
   *
   * Measured on `06a4acf`: switching `Wärmekonzept` to per-building plants
   * changed ZERO of sixteen rows and left `Wärmeerzeugung zentral · Gemeinsamer
   * Ambient-Loop` included at + 1 240 000 €.
   */
  it('drops the shared heat generator when the concept becomes per-building', () => {
    const before = included(B)
    const generator = chapterServiceById(chapterB, 'b-400-01')!
    expect(serviceContribution(B, before, generator)?.toFixed(2)).toBe('1240000.00')

    const cascade = kgCascadeFor(B, before, 'b-400-heat', {
      state: 'selected', variant: 'perBuilding',
    })
    const gone = cascade.entries.filter((e) => e.effect === 'suspend')
    expect(gone.map((e) => e.service.id)).toContain('b-400-01')
    // It carries 1 240 000 €, so the user is told BEFORE it happens.
    expect(cascade.material).toBe(true)

    // THE CONSEQUENCE IS DERIVED, NOT WRITTEN: only the parent changes.
    const after: KgDecisions = {
      ...before,
      services: {
        ...before.services,
        'b-400-heat': { state: 'selected', variant: 'perBuilding' },
      },
    }
    expect(serviceContribution(B, after, generator)).toBeNull()
  })

  it('names the decisions that SURVIVE, not only the ones that reset', () => {
    // A dialogue listing only losses reads as a warning and never tells the
    // user whether the rest of their work is safe.
    const cascade = kgCascadeFor(B, included(B), 'b-400-heat', {
      state: 'selected', variant: 'central',
    })
    expect(cascade.entries.every((e) => e.effect === 'preserve')).toBe(true)
    expect(cascade.material).toBe(false)
  })

  it('reaches the WHOLE closure, not only the direct children', () => {
    /**
     * ACCEPT-01. `b-400-07` hangs off `b-400-01`, which hangs off the plant
     * concept. The first cascade walked one level, so domestic hot water was
     * never named in the dialogue and came to rest asserting a precondition
     * that no longer existed — which reported the chapter as FAILED.
     */
    const cascade = kgCascadeFor(B, included(B), 'b-400-heat', {
      state: 'selected', variant: 'perBuilding',
    })
    const gone = cascade.entries.filter((e) => e.effect === 'suspend')
      .map((e) => e.service.id)
    expect(gone).toContain('b-400-01')
    expect(gone).toContain('b-400-07')
  })

  it('treats a change with no priced victim as immaterial', () => {
    const cascade = kgCascadeFor(A, included(), 'a-400-01', {
      state: 'selected', variant: 'WE_SW_WP',
    })
    // Heat emission depends on the generator but survives any generator, so
    // nothing is destroyed and nothing needs confirming.
    expect(cascade.entries.every((e) => e.effect === 'preserve')).toBe(true)
    expect(cascade.material).toBe(false)
  })
})

describe('the overview answers what a salesperson asks', () => {
  it('reports a system state without ever reporting two at once', () => {
    for (const group of chapterA.groups) {
      const progress = kgSystemProgress(A, included(), group)
      if (progress.state === 'notApplicable') {
        expect(progress.openDecisions).toBe(0)
      }
      if (progress.state === 'open') {
        expect(progress.openDecisions).toBeGreaterThan(0)
      }
    }
  })

  it('counts only real unresolved decisions as open', () => {
    const overview = kgChapterOverview(A, included(), chapterA)
    const openRows = chapterA.groups
      .flatMap(systemServices)
      .filter((s) => isApplicable(s) && s.requiresDecision
        && serviceDecision(included(), s).state === 'undecided')
    expect(overview.open).toBeGreaterThan(0)
    expect(openRows.length).toBeGreaterThan(0)
  })

  it('excludes inapplicable systems from the relevant count', () => {
    const overview = kgChapterOverview(A, included(), chapterA)
    expect(overview.notApplicable).toBeGreaterThan(0)
    expect(overview.relevantSystems + overview.notApplicable)
      .toBe(chapterA.groups.length)
  })

  it('states how many decisions are priced and how many have no basis', () => {
    const overview = kgChapterOverview(A, included(), chapterA)
    expect(overview.directlyPriced).toBeGreaterThan(0)
    expect(overview.withoutPriceBasis).toBeGreaterThan(0)
  })
})

describe('three buildings produce one decision with three values', () => {
  it('does not repeat a decision once per building', () => {
    const distribution = chapterServiceById(chapterB, 'b-400-02')!
    expect(distribution.valueRows).toHaveLength(3)
    expect(distribution.buildingId).toBeUndefined()
    // The replaced fixture carried `b-400-02/03/04`, three near-identical
    // services whose only difference was a building name.
    expect(chapterServiceById(chapterB, 'b-400-03')).toBeNull()
    expect(chapterServiceById(chapterB, 'b-400-04')).toBeNull()
  })

  it('states a system scope exactly once', () => {
    const heat = chapterB.groups.find((g) => g.labelDe === 'Wärme')!
    expect(heat.scopeDe).toBe('gemeinsame Anlage · Verteilung je Gebäude')
  })

  it('marks a partially applicable system rather than hiding it', () => {
    const drainage = chapterB.groups.find((g) => g.labelDe === 'Entwässerung')!
    expect(drainage.applicability?.state).toBe('partial')
    const rows = chapterServiceById(chapterB, 'b-400-11')!.valueRows!
    expect(rows.filter((r) => r.notApplicable)).toHaveLength(2)
  })
})

describe('a decision with no price basis never becomes a priced contribution', () => {
  /**
   * THE QA-01 REGRESSION TEST.
   *
   * Found by QA on candidate 917cb52. The KG 400 body said
   * `keine gesonderte Preisgrundlage` correctly, and the commercial rail's
   * `Im Angebot gewählt` recap then printed `± 0 €` for the same fifteen
   * decisions — because each was still emitted as a zero-valued `Driver`,
   * and every commercial surface renders a driver's amount as a signed
   * number. For `Hausanschlüsse`, which is the Bauherr's, that reads as an
   * All3 item included at no charge: the opposite of true.
   *
   * The rail was the symptom. This is the boundary.
   */
  it.each([
    ['DEMO-HAPPY-01', A],
    ['DEMO-COMPLEX-01', B],
  ])('%s emits no zero-valued driver without cost authority', (_id, catalogue) => {
    const rows = kgContributions(catalogue, included(catalogue))
    const offenders = rows.filter((row) => {
      const service = serviceById(catalogue, row.serviceId)!
      return row.exact.isZero() && costAuthorityOf(service) !== 'direct'
    })
    expect(offenders.map((row) => row.serviceId)).toEqual([])
  })

  it('never lets a Bauherr decision reach the priced contributions at all', () => {
    for (const catalogue of [A, B]) {
      const priced = new Set(
        kgContributions(catalogue, included(catalogue)).map((row) => row.serviceId),
      )
      const bauherr = allServices(catalogue)
        .filter((service) => costAuthorityOf(service) === 'bauherr')
      expect(bauherr.length).toBeGreaterThan(0)
      for (const service of bauherr) expect(priced.has(service.id)).toBe(false)
    }
  })

  it('lets the rail and the chapter body state the same thing', () => {
    /**
     * QA's own remedy, as an invariant: the KG 400 body's cost-authority text
     * IS the source of truth for the rail line. Every row the commercial
     * surfaces price is a decision the body calls `direkt bepreist`, and no
     * other row reaches them at all — so the two can no longer disagree about
     * whether All3 charges for something.
     */
    for (const catalogue of [A, B]) {
      const rows = kgContributions(catalogue, included(catalogue))
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const service = serviceById(catalogue, row.serviceId)!
        expect(costAuthorityOf(service)).toBe('direct')
      }
    }
  })

  it('keeps a priced decision sitting on its baseline variant', () => {
    // `± 0 €` has exactly one true meaning — measurably the same price as the
    // baseline choice — and a `singleChoice` at its baseline is it. Removing
    // those too would trade one dishonest state for a missing one.
    const rows = kgContributions(A, included(A))
    expect(rows.map((row) => row.serviceId)).toContain('a-400-es')
  })

  it('moves no total by removing them', () => {
    expect(kgTotal(A, included(A)).toFixed(2)).toBe(A.declaredNetTotal)
    expect(kgTotal(B, included(B)).toFixed(2)).toBe(B.declaredNetTotal)
    expect(kgGroupAmounts(A, included(A)).KG_400?.toFixed(2))
      .toBe(A.declaredByCostGroup.KG_400)
    expect(kgGroupAmounts(B, included(B)).KG_400?.toFixed(2))
      .toBe(B.declaredByCostGroup.KG_400)
  })
})

describe('the ten things this Product must never say', () => {
  const everything = [chapterA, chapterB].flatMap((c) => [
    ...c.groups.flatMap((g) => g.services).flatMap((s) => [
      s.labelDe, s.labelEn, s.summaryDe, s.summaryEn, s.whyDe, s.whyEn,
      s.offerNoteDe, s.offerNoteEn,
      ...(s.kind.kind === 'singleChoice'
        ? s.kind.variants.flatMap((v) => [v.labelDe, v.labelEn]) : []),
      ...(s.blockedVariants ?? []).flatMap((b) => [b.reasonDe, b.reasonEn]),
    ]),
    ...(c.rules ?? []).flatMap((r) => [r.bodyDe, r.bodyEn, r.noteDe, r.noteEn]),
    ...(c.rahmen ?? []).flatMap((r) => [r.valueDe, r.valueEn, r.metaDe, r.metaEn]),
  ]).filter((v): v is string => typeof v === 'string').join(' \n ')

  it.each([
    ['a 65 % renewable-heating obligation', /65\s*%.{0,20}(EE|erneuerbar)/i],
    ['a Neubaugebiet / Bestandsgebiet branch', /Neubaugebiet|Bestandsgebiet/],
    ['locally read metering as a new-build option', /lokal ablesbar/i],
    ['heat-pump hot water at 55 / 50 °C', /55\s*\/\s*50\s*°C/],
    ['a battery multi-use or grid-charging revenue', /Multi-?Use|Netzladung/i],
    ['an unqualified Solarpflicht', /Solarpflicht gilt/i],
    ['a lightning-protection dwelling threshold', /Blitzschutz ab \d/i],
    ['a lift threshold in storeys', /Aufzug ab \d+ (Voll)?gesch/i],
    ['the repealed act short title', /\bGEG\b/],
    ['a repealed workplace rule', /ASR A3\.4/],
  ])('never says %s', (_name, pattern) => {
    expect(everything).not.toMatch(pattern)
  })

  it('cites the standards at the editions the 2026 research verified', () => {
    expect(everything).toContain('DIN 18017-3:2022-05')
    expect(everything).toContain('DIN 1946-6:2019-12')
    expect(everything).toContain('DVGW W 551:2004-04')
    expect(everything).toContain('DIN 1986-100:2016-12')
    expect(everything).toContain('GModG')
    expect(everything).toContain('§ 71 GModG ist entfallen')
  })

  it('states the statutory minimum and the funding target as two axes', () => {
    const rahmen = chapterA.rahmen!
    const statutory = rahmen.find((r) => r.id === 'mindeststandard')!
    const funding = rahmen.find((r) => r.id === 'energieziel')!
    // They must never share a UI slot: the statutory minimum is derived from
    // the building-application date and is not a choice at all.
    expect(statutory.editServiceId).toBeUndefined()
    expect(statutory.metaDe).toContain('Bauantragsdatum')
    expect(funding.editServiceId).toBe('a-400-es')
    expect(funding.metaDe).toContain('Förderziel')
  })

  it('never presents funding as an entitlement', () => {
    const energy = chapterServiceById(chapterA, 'a-400-es')!
    expect(energy.whyDe).toContain('kein Rechtsanspruch')
  })
})

/**
 * THE STATE A CASCADE COMES TO REST IN (Acceptance ACCEPT-01).
 *
 * The forward half was right from the first candidate: the dialogue named
 * `Wärmeerzeuger · 1.240.000 €` before anything moved, and undo restored the
 * whole combination in one action. What it left behind was not.
 *
 * Every assertion below is one sentence of the Acceptance report, and each
 * was measured FAILING on `cfc8e9f`.
 */
describe('the resting state after a cascade', () => {
  const perBuilding: KgDecisions = {
    ...included(B),
    services: {
      ...included(B).services,
      'b-400-heat': { state: 'selected', variant: 'perBuilding' },
    },
  }

  it('does not report the chapter as FAILED for a consistent configuration', () => {
    // `✗ 0 VON 3 ENTSCHIEDEN · FEHLGESCHLAGEN` — and "failed" is not one of
    // this domain's decision states at all. The cause was a grandchild the
    // one-level cascade never reached, left asserting a dead precondition.
    expect(kgChapterProgress(B, included(B), CHAPTER).state).toBe('incomplete')
    const after = kgChapterProgress(B, perBuilding, CHAPTER)
    expect(after.state).toBe('incomplete')
    expect(after.blockedServiceIds).toEqual([])
  })

  it('states the lapsed decision as not applicable, and names the cause', () => {
    const generator = chapterServiceById(chapterB, 'b-400-01')!
    expect(dependencySuspension(B, included(B), generator)).toBeNull()
    // The ROOT, never the link in the middle: the decision to change.
    expect(dependencySuspension(B, perBuilding, generator)?.id).toBe('b-400-heat')
    const dhw = chapterServiceById(chapterB, 'b-400-07')!
    expect(dependencySuspension(B, perBuilding, dhw)?.id).toBe('b-400-heat')
  })

  it('keeps a lapsed decision out of the offer, and out of the counts', () => {
    const generator = chapterServiceById(chapterB, 'b-400-01')!
    expect(serviceContribution(B, perBuilding, generator)).toBeNull()
    const heat = chapterB.groups.find((g) => g.id === 'b-kg400-heat')!
    const progress = kgSystemProgress(B, perBuilding, heat)
    expect(progress.openDecisions).toBe(0)
  })

  it('states the CURRENT configuration in the overview, not the first one', () => {
    // `gemeinsame Anlage · Verteilung je Gebäude` survived the user choosing
    // one plant per building — the overview asserting a combination the
    // decision three lines below it forbids.
    const heat = chapterB.groups.find((g) => g.id === 'b-kg400-heat')!
    expect(systemNarrative(B, included(B), heat).scopeDe)
      .toBe('gemeinsame Anlage · Verteilung je Gebäude')
    expect(systemNarrative(B, perBuilding, heat).scopeDe)
      .toBe('Anlage je Gebäude · Verteilung je Gebäude')
    expect(systemNarrative(B, perBuilding, heat).summaryDe).toContain('Je Gebäude')
  })

  it('gives the money back when the precondition is restored', () => {
    /**
     * THE SHARPEST ASSERTION IN THE ACCEPTANCE REPORT.
     *
     * Putting the plant concept back raised no dialogue and restored nothing:
     * outside the eight-second undo window the largest single KG 400 position
     * was gone for good, because the cascade had DELETED the answer rather
     * than suspended the question.
     */
    expect(kgTotal(B, included(B)).toFixed(2)).toBe('38740000.00')
    expect(kgGroupAmounts(B, included(B)).KG_400!.toFixed(2)).toBe('8420000.00')

    const back: KgDecisions = {
      ...perBuilding,
      services: {
        ...perBuilding.services,
        'b-400-heat': { state: 'selected', variant: 'central' },
      },
    }
    expect(kgTotal(B, back).toFixed(2)).toBe('38740000.00')
    expect(kgGroupAmounts(B, back).KG_400!.toFixed(2)).toBe('8420000.00')
    const generator = chapterServiceById(chapterB, 'b-400-01')!
    expect(serviceContribution(B, back, generator)!.toFixed(2)).toBe('1240000.00')

    // And it is announced with the same ceremony that saw it leave.
    const cascade = kgCascadeFor(B, perBuilding, 'b-400-heat', {
      state: 'selected', variant: 'central',
    })
    expect(cascade.material).toBe(true)
    const returning = cascade.entries.filter((e) => e.effect === 'restore')
    expect(returning.map((e) => e.service.id)).toContain('b-400-01')
    expect(returning.find((e) => e.service.id === 'b-400-01')!.currentAmount!.toFixed(2))
      .toBe('1240000.00')
  })

  it('never names a euro a lapsing decision has no authority to name', () => {
    // `entfällt · 0 €` says removing a bundled position is free. It is not:
    // its price lives in another position (rule 16, AC 21).
    const cascade = kgCascadeFor(B, included(B), 'b-400-heat', {
      state: 'selected', variant: 'perBuilding',
    })
    const dhw = cascade.entries.find((e) => e.service.id === 'b-400-07')!
    expect(costAuthorityOf(dhw.service)).toBe('bundle')
    expect(dhw.currentAmount).toBeNull()
    for (const entry of cascade.entries) {
      if (entry.currentAmount === null) continue
      expect(rendersAmount(entry.service)).toBe(true)
      expect(entry.currentAmount.isZero()).toBe(false)
    }
  })
})
