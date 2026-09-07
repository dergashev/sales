import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import {
  KG_SCOPE_GROUPS,
  chapterBuildingIds,
  chapterForBuilding,
  chapterOf,
  contributionCostAuthority,
  costAuthorityOf,
  dependencyBlocker,
  dependencySuspension,
  derivedValue,
  initialDecisions,
  kgCascadeFor,
  kgChapterProgress,
  kgContributions,
  kgDeltaAgainstStandard,
  kgSelectionsWithoutBasis,
  kgSystemProgress,
  serviceById,
  serviceContribution,
  serviceDecision,
  withBuildingApplicability,
  type KgBuildingCondition,
  type KgCatalogue,
  type KgChapter,
  type KgDecisions,
  type KgScopeGroup,
  type KgService,
  type KgServiceDecisionRecord,
  type KgServiceGroup,
  type KgServiceVariant,
} from '../kgConfiguration'

/**
 * KG 300 AS A CONSTRUCTION CONFIGURATOR (VR3-KG-UNIFY-00).
 *
 * The engine additions this file proves are the ones the construction
 * chapter needs and the TGA chapter never did: a dependency on ANY of several
 * upstream variants, an alternative that removes the position from the offer,
 * an authority declared per alternative, applicability that follows the
 * confirmed Building, a read-only value derived from other decisions, and a
 * chapter projected onto one building at a time.
 *
 * The catalogue is SYNTHETIC and in memory. The demonstration fixture is a
 * moving target while it is being rewritten, and an engine proof that depends
 * on which rows a fixture happens to declare is a fixture test wearing an
 * engine test's name.
 */

const CHAPTER = 'KG_300' as KgScopeGroup

const NO_UG: KgBuildingCondition = {
  fact: 'undergroundLevel',
  oneOf: ['partial', 'full'],
  reasonDe: 'Gebäude ohne Untergeschoss',
  reasonEn: 'Building without a basement',
}

function variant(
  value: string, delta: string, extra: Partial<KgServiceVariant> = {},
): KgServiceVariant {
  return { value, labelDe: `${value} de`, labelEn: `${value} en`, delta, ...extra }
}

type ServiceOverrides = Partial<Omit<KgService, 'id' | 'kind'>> & Pick<KgService, 'kind'>

function service(id: string, overrides: ServiceOverrides): KgService {
  return {
    id,
    labelDe: `${id} de`,
    labelEn: `${id} en`,
    summaryDe: '',
    summaryEn: '',
    amount: '0.00',
    baseline: 'selected',
    requiresDecision: false,
    authority: 'assumed',
    ...overrides,
  }
}

function choice(
  id: string,
  baselineVariant: string,
  variants: readonly KgServiceVariant[],
  overrides: Partial<Omit<KgService, 'id' | 'kind'>> = {},
): KgService {
  return service(id, {
    kind: { kind: 'singleChoice', baselineVariant, variants },
    ...overrides,
  })
}

function group(
  id: string, services: readonly KgService[], overrides: Partial<KgServiceGroup> = {},
): KgServiceGroup {
  return { id, labelDe: `${id} de`, labelEn: `${id} en`, services, ...overrides }
}

/* ── the synthetic construction chapter ────────────────────────────────── */

/** Five façade compositions; the timber colour family exists under two. */
const FACADE = choice('facade', 'PUTZ', [
  variant('PUTZ', '0.00'),
  variant('HOLZ', '40000.00'),
  variant('PUTZ_HOLZ', '25000.00'),
  variant('KLINKER', '90000.00'),
  variant('METALL', '70000.00'),
])

const TIMBER_COLOUR = choice('timber-colour', 'NATUR', [
  variant('NATUR', '0.00'),
  variant('GRAU', '5000.00'),
], {
  dependsOn: { serviceId: 'facade', requiresVariantIn: ['HOLZ', 'PUTZ_HOLZ'] },
})

const ROOF_ACCESS = choice('roof-access', 'NOT_OCCUPIED', [
  variant('NOT_OCCUPIED', '0.00'),
  variant('OCCUPIED', '30000.00'),
], { requiresDecision: true })

const ROOF_GREEN = choice('roof-green', 'NONE', [
  variant('NONE', '0.00'),
  variant('GREEN', '20000.00'),
])

const ROOF_REQUIREMENT = service('roof-requirement', {
  kind: { kind: 'readOnlyRequired' },
  derived: {
    from: ['roof-access', 'roof-green'],
    byValues: {
      'OCCUPIED|GREEN': { valueDe: 'Begehbar und begrünt', valueEn: 'Occupied and green' },
      'OCCUPIED|NONE': { valueDe: 'Begehbar, unbegrünt', valueEn: 'Occupied, not green' },
      'NOT_OCCUPIED|NONE': { valueDe: 'Nicht begehbar', valueEn: 'Not occupied' },
    },
    fallbackDe: 'Folgt aus Zugang und Begrünung',
    fallbackEn: 'Follows from access and greening',
  },
})

/** The basement scope decision of Haus A: one priced position, one Bauherr's. */
const BASEMENT_B1 = choice('basement-b1', 'ALL3', [
  variant('ALL3', '0.00'),
  variant('WEISSE_WANNE', '80000.00'),
  variant('BAUHERR', '0.00', { excludesPosition: true, costAuthority: 'bauherr' }),
  variant('OFFEN', '0.00', { excludesPosition: true, noPriceBasis: true }),
], {
  amount: '520000.00',
  requiresDecision: true,
  all3Standard: 'ALL3',
  buildingId: 'b1',
  appliesWhen: NO_UG,
  includeLabelDe: 'Im All3-Leistungsumfang',
  includeLabelEn: 'In the All3 scope',
  excludeLabelDe: 'Nicht im All3-Leistungsumfang',
  excludeLabelEn: 'Not in the All3 scope',
})

const BASEMENT_B2 = choice('basement-b2', 'ALL3', [
  variant('ALL3', '0.00'),
  variant('BAUHERR', '0.00', { excludesPosition: true, costAuthority: 'bauherr' }),
], {
  amount: '480000.00',
  requiresDecision: true,
  buildingId: 'b2',
  appliesWhen: NO_UG,
  applicability: { state: 'notApplicable', reasonDe: NO_UG.reasonDe, reasonEn: NO_UG.reasonEn },
})

const SLAB_B1 = choice('slab-b1', 'STB', [variant('STB', '0.00'), variant('HOLZ', '12000.00')], {
  amount: '150000.00', buildingId: 'b1',
})
const SLAB_B2 = choice('slab-b2', 'STB', [variant('STB', '0.00'), variant('HOLZ', '12000.00')], {
  amount: '140000.00', buildingId: 'b2',
})
/** A building the Option does not carry: its static statement must survive. */
const SLAB_B9 = choice('slab-b9', 'STB', [variant('STB', '0.00')], {
  amount: '100000.00',
  buildingId: 'b9',
  appliesWhen: NO_UG,
  applicability: { state: 'partial', reasonDe: 'teilweise', reasonEn: 'partly' },
})

const BALCONY = service('balcony', {
  kind: { kind: 'includeExclude' },
  amount: '60000.00',
  requiresDecision: true,
})
const BALCONY_SUPPORT = choice('balcony-support', 'STUETZEN', [
  variant('STUETZEN', '0.00'),
  variant('AUSKRAGEND', '15000.00'),
], {
  dependsOn: { serviceId: 'balcony', requiresSelected: true },
})
const BALCONY_RAILING = choice('balcony-railing', 'STAB', [
  variant('STAB', '0.00'),
  variant('GLAS', '9000.00'),
], {
  requiresDecision: true,
  dependsOn: { serviceId: 'balcony', requiresSelected: true },
})

const GROUPS: readonly KgServiceGroup[] = [
  group('g-facade', [FACADE, TIMBER_COLOUR]),
  group('g-roof', [ROOF_ACCESS, ROOF_GREEN, ROOF_REQUIREMENT]),
  group('g-basement-b1', [BASEMENT_B1], { buildingId: 'b1', appliesWhen: NO_UG }),
  group('g-basement-b2', [BASEMENT_B2], {
    buildingId: 'b2',
    appliesWhen: NO_UG,
    applicability: { state: 'notApplicable', reasonDe: NO_UG.reasonDe, reasonEn: NO_UG.reasonEn },
  }),
  group('g-slab-b1', [SLAB_B1], { buildingId: 'b1' }),
  group('g-slab-b2', [SLAB_B2], { buildingId: 'b2' }),
  group('g-slab-b9', [SLAB_B9], { buildingId: 'b9', appliesWhen: NO_UG }),
  group('g-balcony', [BALCONY, BALCONY_SUPPORT, BALCONY_RAILING]),
]

function catalogueOf(groups: readonly KgServiceGroup[]): KgCatalogue {
  const chapter: KgChapter = {
    group: CHAPTER,
    titleDe: 'Bauwerk – Baukonstruktionen',
    titleEn: 'Building construction',
    scopeNoteDe: '',
    scopeNoteEn: '',
    boundaryDe: '',
    boundaryEn: '',
    groups,
  }
  return {
    projectId: 'SYNTH-KG300',
    uncertaintyPercent: '10',
    declaredNetTotal: '0.00',
    declaredByCostGroup: Object.fromEntries(
      KG_SCOPE_GROUPS.map((g) => [g, '0.00']),
    ) as Record<KgScopeGroup, string>,
    chapters: [chapter],
  }
}

const CAT = catalogueOf(GROUPS)
const CHAPTER_OBJ = chapterOf(CAT, CHAPTER)!

/** Every KG included, every service at its initial state. */
function included(catalogue: KgCatalogue = CAT): KgDecisions {
  const base = initialDecisions(catalogue)
  return {
    ...base,
    scope: Object.fromEntries(
      KG_SCOPE_GROUPS.map((g) => [g, 'included']),
    ) as KgDecisions['scope'],
  }
}

function withDecisions(
  decisions: KgDecisions, patch: Record<string, KgServiceDecisionRecord>,
): KgDecisions {
  return { ...decisions, services: { ...decisions.services, ...patch } }
}

function svc(id: string, catalogue: KgCatalogue = CAT): KgService {
  const found = serviceById(catalogue, id)
  if (!found) throw new Error(`synthetic catalogue has no service ${id}`)
  return found
}

/* ── 1 · requiresVariantIn ─────────────────────────────────────────────── */

describe('a dependency on ANY of several upstream variants (requiresVariantIn)', () => {
  it('blocks the answered downstream while the upstream holds a variant outside the list', () => {
    const decisions = withDecisions(included(), {
      facade: { state: 'selected', variant: 'KLINKER' },
      'timber-colour': { state: 'selected', variant: 'GRAU' },
    })
    // The upstream id, so the row can route to the decision that has to move.
    expect(dependencyBlocker(CAT, decisions, svc('timber-colour'))).toBe('facade')
  })

  it('does not block once the upstream holds any variant IN the list', () => {
    for (const composition of ['HOLZ', 'PUTZ_HOLZ']) {
      const decisions = withDecisions(included(), {
        facade: { state: 'selected', variant: composition },
        'timber-colour': { state: 'selected', variant: 'GRAU' },
      })
      expect(dependencyBlocker(CAT, decisions, svc('timber-colour'))).toBeNull()
    }
  })

  it('suspends the downstream when the upstream variant is outside the list, and not when it is inside', () => {
    const outside = withDecisions(included(), {
      facade: { state: 'selected', variant: 'METALL' },
    })
    expect(dependencySuspension(CAT, outside, svc('timber-colour'))).toBe(svc('facade'))
    const inside = withDecisions(included(), {
      facade: { state: 'selected', variant: 'HOLZ' },
    })
    expect(dependencySuspension(CAT, inside, svc('timber-colour'))).toBeNull()
  })

  it('reads the BASELINE variant when the upstream is selected without naming one', () => {
    // `PUTZ` is the façade baseline and is not a timber composition: the
    // colour family lapses.
    const bare = withDecisions(included(), { facade: { state: 'selected' } })
    expect(dependencySuspension(CAT, bare, svc('timber-colour'))).toBe(svc('facade'))

    // The same rule with a baseline INSIDE the list keeps it live.
    const timberFirst = catalogueOf([
      group('g-facade', [
        choice('facade', 'HOLZ', FACADE.kind.kind === 'singleChoice' ? FACADE.kind.variants : []),
        TIMBER_COLOUR,
      ]),
    ])
    const bareTimber = withDecisions(included(timberFirst), { facade: { state: 'selected' } })
    expect(dependencySuspension(timberFirst, bareTimber, svc('timber-colour', timberFirst))).toBeNull()
  })

  it('keeps a timber colour family live under exactly the two timber compositions of five', () => {
    const live: string[] = []
    const suspended: string[] = []
    for (const composition of ['PUTZ', 'HOLZ', 'PUTZ_HOLZ', 'KLINKER', 'METALL']) {
      const decisions = withDecisions(included(), {
        facade: { state: 'selected', variant: composition },
      })
      const cause = dependencySuspension(CAT, decisions, svc('timber-colour'))
      if (cause === null) live.push(composition)
      else {
        expect(cause.id).toBe('facade')
        suspended.push(composition)
      }
    }
    expect(live).toEqual(['HOLZ', 'PUTZ_HOLZ'])
    expect(suspended).toEqual(['PUTZ', 'KLINKER', 'METALL'])
  })

  it('takes the suspended colour out of the priced contributions and puts it back with the composition', () => {
    const grey = { state: 'selected', variant: 'GRAU' } as const
    const underTimber = withDecisions(included(), {
      facade: { state: 'selected', variant: 'HOLZ' }, 'timber-colour': grey,
    })
    expect(serviceContribution(CAT, underTimber, svc('timber-colour'))?.toFixed(2)).toBe('5000.00')
    const underBrick = withDecisions(underTimber, {
      facade: { state: 'selected', variant: 'KLINKER' },
    })
    expect(serviceContribution(CAT, underBrick, svc('timber-colour'))).toBeNull()
    // The answer itself is untouched: only the precondition moved.
    expect(serviceDecision(underBrick, svc('timber-colour')).variant).toBe('GRAU')
  })
})

/* ── 2 · excludesPosition ──────────────────────────────────────────────── */

describe('an alternative that removes the position from the All3 offer (excludesPosition)', () => {
  const excluded = () => withDecisions(included(), {
    'basement-b1': { state: 'selected', variant: 'BAUHERR' },
  })

  it('contributes null — not a zero — when chosen', () => {
    const value = serviceContribution(CAT, excluded(), svc('basement-b1'))
    expect(value).toBeNull()
    // And the priced alternatives of the same decision still contribute.
    const priced = withDecisions(included(), {
      'basement-b1': { state: 'selected', variant: 'WEISSE_WANNE' },
    })
    expect(serviceContribution(CAT, priced, svc('basement-b1'))?.toFixed(2)).toBe('600000.00')
  })

  it('emits no driver for the excluded position', () => {
    const ids = kgContributions(CAT, excluded()).map((c) => c.serviceId)
    expect(ids).not.toContain('basement-b1')
    // Nor a `± 0 €` in disguise: no contribution of the chapter is a zero
    // that is not directly priced.
    for (const contribution of kgContributions(CAT, excluded())) {
      if (contribution.exact.isZero()) expect(contribution.costAuthority).toBe('direct')
    }
  })

  it('states the exclusion as a selection without a price basis, with the variant authority', () => {
    const rows = kgSelectionsWithoutBasis(CAT, excluded())
    const row = rows.find((r) => r.serviceId === 'basement-b1')
    expect(row?.costAuthority).toBe('bauherr')
    expect(row?.valueDe).toBe('BAUHERR de')
    expect(row?.buildingId).toBe('b1')
  })

  it('has no delta against the standard when either side excludes the position', () => {
    const decision: KgServiceDecisionRecord = { state: 'selected', variant: 'BAUHERR' }
    expect(kgDeltaAgainstStandard(svc('basement-b1'), decision)).toBeNull()
    // A priced alternative against a priced standard keeps its delta — so the
    // `null` above is the exclusion, not a broken reference.
    expect(kgDeltaAgainstStandard(svc('basement-b1'), { state: 'selected', variant: 'WEISSE_WANNE' })
      ?.delta.toFixed(2)).toBe('80000.00')
    // Standard itself excluding: the reference cannot take part in a difference.
    const standardExcludes = choice('x', 'BAUHERR', [
      variant('BAUHERR', '0.00', { excludesPosition: true, costAuthority: 'bauherr' }),
      variant('ALL3', '50000.00'),
    ], { all3Standard: 'BAUHERR' })
    expect(kgDeltaAgainstStandard(standardExcludes, { state: 'selected', variant: 'ALL3' })).toBeNull()
  })

  it('still counts as an ANSWERED decision in the system and chapter progress', () => {
    const decisions = excluded()
    const basementGroup = CHAPTER_OBJ.groups.find((g) => g.id === 'g-basement-b1')!
    const system = kgSystemProgress(CAT, decisions, basementGroup)
    expect(system.openDecisions).toBe(0)
    expect(system.state).toBe('decided')
    // No priced position remains in the system; the row says so in words.
    expect(system.amount).toBeNull()
    expect(system.costAuthority).toBe('noBasis')

    const before = kgChapterProgress(CAT, included(), CHAPTER)
    const after = kgChapterProgress(CAT, decisions, CHAPTER)
    expect(after.requiredDecisions).toBe(before.requiredDecisions)
    expect(after.decidedDecisions).toBe(before.decidedDecisions + 1)
    expect(after.blockedServiceIds).not.toContain('basement-b1')
    expect(after.invalidServiceIds).not.toContain('basement-b1')
  })
})

/* ── 3 · variant-level costAuthority ───────────────────────────────────── */

describe('the authority of the CURRENT alternative (contributionCostAuthority)', () => {
  it('returns the variant’s own authority when it declares one', () => {
    expect(contributionCostAuthority(svc('basement-b1'), { state: 'selected', variant: 'BAUHERR' }))
      .toBe('bauherr')
  })

  it('falls back to bundle, then noBasis, then the service’s own authority', () => {
    const decision = choice('y', 'A', [
      variant('A', '0.00'),
      variant('B', '1000.00', { bundled: true }),
      variant('C', '0.00', { noPriceBasis: true }),
      variant('D', '0.00', { bundled: true, noPriceBasis: true, costAuthority: 'indirect' }),
    ])
    expect(costAuthorityOf(decision)).toBe('direct')
    expect(contributionCostAuthority(decision, { state: 'selected', variant: 'B' })).toBe('bundle')
    expect(contributionCostAuthority(decision, { state: 'selected', variant: 'C' })).toBe('noBasis')
    expect(contributionCostAuthority(decision, { state: 'selected', variant: 'A' })).toBe('direct')
    // The variant's declared authority outranks its flags.
    expect(contributionCostAuthority(decision, { state: 'selected', variant: 'D' })).toBe('indirect')
    // A decision selected without a variant answers for its baseline.
    expect(contributionCostAuthority(decision, { state: 'selected' })).toBe('direct')
  })

  it('answers with the service authority where the service declares one and the variant nothing', () => {
    const decision = choice('z', 'A', [variant('A', '0.00'), variant('B', '0.00')], {
      costAuthority: 'indirect',
    })
    expect(contributionCostAuthority(decision, { state: 'selected', variant: 'B' })).toBe('indirect')
  })
})

/* ── 4 · withBuildingApplicability ─────────────────────────────────────── */

describe('applicability that follows the confirmed Building (withBuildingApplicability)', () => {
  const facts = (b1: string, b2: string) => [
    { id: 'b1', undergroundLevel: b1 },
    { id: 'b2', undergroundLevel: b2 },
  ]
  const groupIn = (catalogue: KgCatalogue, id: string) =>
    chapterOf(catalogue, CHAPTER)!.groups.find((g) => g.id === id)!

  it('derives notApplicable with the declared reason for a building without a basement', () => {
    const resolved = withBuildingApplicability(CAT, facts('none', 'none'))
    const g = groupIn(resolved, 'g-basement-b1')
    expect(g.applicability).toEqual({
      state: 'notApplicable', reasonDe: NO_UG.reasonDe, reasonEn: NO_UG.reasonEn,
    })
    expect(g.services[0]!.applicability).toEqual({
      state: 'notApplicable', reasonDe: NO_UG.reasonDe, reasonEn: NO_UG.reasonEn,
    })
    // And the derived statement is what the progress reads: not outstanding work.
    const decisions = included(resolved)
    const progress = kgSystemProgress(resolved, decisions, g)
    expect(progress.state).toBe('notApplicable')
    expect(progress.openDecisions).toBe(0)
  })

  it('leaves a building WITH a basement applicable — no applicability at all', () => {
    const resolved = withBuildingApplicability(CAT, facts('full', 'full'))
    expect(groupIn(resolved, 'g-basement-b1').applicability).toBeUndefined()
    expect(groupIn(resolved, 'g-basement-b1').services[0]!.applicability).toBeUndefined()
    // A static `notApplicable` that the building contradicts is REPLACED,
    // not kept: the catalogue may not assert the basement twice.
    expect(groupIn(resolved, 'g-basement-b2').applicability).toBeUndefined()
    expect(groupIn(resolved, 'g-basement-b2').services[0]!.applicability).toBeUndefined()
  })

  it('keeps identity where the static declaration already equals the derived one', () => {
    const resolved = withBuildingApplicability(CAT, facts('none', 'none'))
    // b2 declares statically what `none` derives: the same service object and
    // the same applicability object come back.
    expect(groupIn(resolved, 'g-basement-b2').services[0]).toBe(BASEMENT_B2)
    expect(groupIn(resolved, 'g-basement-b2').applicability).toBe(GROUPS[3]!.applicability)
    // b1 moved, so the catalogue as a whole is a new object.
    expect(resolved).not.toBe(CAT)
  })

  it('returns the SAME catalogue when nothing declares a condition', () => {
    const unconditional = catalogueOf([
      group('g-facade', [FACADE, TIMBER_COLOUR]),
      group('g-slab-b1', [SLAB_B1], { buildingId: 'b1' }),
    ])
    expect(withBuildingApplicability(unconditional, facts('none', 'full'))).toBe(unconditional)
    // Also when every condition already agrees with the facts.
    const agreeing = catalogueOf([GROUPS[3]!])
    expect(withBuildingApplicability(agreeing, facts('none', 'none'))).toBe(agreeing)
  })

  it('keeps the static declaration for a building the Option does not carry', () => {
    const resolved = withBuildingApplicability(CAT, facts('none', 'none'))
    const g = groupIn(resolved, 'g-slab-b9')
    expect(g.applicability).toBeUndefined()
    expect(g.services[0]).toBe(SLAB_B9)
    expect(g.services[0]!.applicability?.state).toBe('partial')
  })

  it('does not mutate the catalogue it resolves', () => {
    const snapshot = JSON.stringify(CAT)
    withBuildingApplicability(CAT, facts('none', 'full'))
    withBuildingApplicability(CAT, facts('full', 'none'))
    expect(JSON.stringify(CAT)).toBe(snapshot)
    expect(BASEMENT_B1.applicability).toBeUndefined()
    expect(GROUPS[2]!.applicability).toBeUndefined()
  })
})

/* ── 5 · derivedValue ──────────────────────────────────────────────────── */

describe('a read-only value derived from other decisions (derivedValue)', () => {
  const roof = () => svc('roof-requirement')

  it('reads the authored sentence for the governors’ joined variants, in declared order', () => {
    const decisions = withDecisions(included(), {
      'roof-access': { state: 'selected', variant: 'OCCUPIED' },
      'roof-green': { state: 'selected', variant: 'GREEN' },
    })
    expect(derivedValue(CAT, decisions, roof(), 'de')).toBe('Begehbar und begrünt')
    expect(derivedValue(CAT, decisions, roof(), 'en')).toBe('Occupied and green')
  })

  it('uses the baseline for a governor selected without a variant', () => {
    const decisions = withDecisions(included(), {
      'roof-access': { state: 'selected', variant: 'OCCUPIED' },
      'roof-green': { state: 'selected' },
    })
    // `NONE` is the greening baseline: the key is `OCCUPIED|NONE`.
    expect(derivedValue(CAT, decisions, roof(), 'de')).toBe('Begehbar, unbegrünt')
  })

  it('answers the fallback while a governor is undecided', () => {
    // Roof access demands an explicit answer and starts undecided.
    const decisions = included()
    expect(serviceDecision(decisions, svc('roof-access')).state).toBe('undecided')
    expect(derivedValue(CAT, decisions, roof(), 'de')).toBe('Folgt aus Zugang und Begrünung')
    expect(derivedValue(CAT, decisions, roof(), 'en')).toBe('Follows from access and greening')
  })

  it('answers the fallback for a combination the fixture did not author — never a guess', () => {
    const decisions = withDecisions(included(), {
      'roof-access': { state: 'selected', variant: 'NOT_OCCUPIED' },
      'roof-green': { state: 'selected', variant: 'GREEN' },
    })
    expect(derivedValue(CAT, decisions, roof(), 'de')).toBe('Folgt aus Zugang und Begrünung')
  })

  it('answers null for a service without a derived declaration', () => {
    expect(derivedValue(CAT, included(), svc('facade'), 'de')).toBeNull()
    expect(derivedValue(CAT, included(), svc('balcony'), 'en')).toBeNull()
  })
})

/* ── 6 · one page, one building ────────────────────────────────────────── */

describe('the chapter projected onto one building (chapterForBuilding, chapterBuildingIds)', () => {
  it('keeps shared groups and only the given building’s groups and services', () => {
    const view = chapterForBuilding(CHAPTER_OBJ, 'b1')
    expect(view.groups.map((g) => g.id)).toEqual([
      'g-facade', 'g-roof', 'g-basement-b1', 'g-slab-b1', 'g-balcony',
    ])
    expect(view.groups.flatMap((g) => g.services).map((s) => s.id)).not.toContain('basement-b2')
    expect(view.groups.flatMap((g) => g.services).map((s) => s.id)).not.toContain('slab-b2')
    // Shared groups arrive as they were declared.
    expect(view.groups.flatMap((g) => g.services).map((s) => s.id)).toEqual(
      expect.arrayContaining(['facade', 'timber-colour', 'roof-requirement', 'balcony-support']),
    )
  })

  it('drops a shared group whose every service belongs to another building', () => {
    const mixed = catalogueOf([
      group('g-shared', [
        { ...SLAB_B1, id: 'slab-x-b1' },
        { ...SLAB_B2, id: 'slab-x-b2' },
      ]),
      group('g-facade', [FACADE]),
    ])
    const chapter = chapterOf(mixed, CHAPTER)!
    const forB1 = chapterForBuilding(chapter, 'b1')
    expect(forB1.groups.find((g) => g.id === 'g-shared')?.services.map((s) => s.id)).toEqual(['slab-x-b1'])
    const forB3 = chapterForBuilding(chapter, 'b3')
    expect(forB3.groups.map((g) => g.id)).toEqual(['g-facade'])
  })

  it('returns the chapter unchanged for a null building context', () => {
    expect(chapterForBuilding(CHAPTER_OBJ, null)).toBe(CHAPTER_OBJ)
  })

  it('does not mutate the chapter it projects', () => {
    const snapshot = JSON.stringify(CHAPTER_OBJ)
    const groupsBefore = CHAPTER_OBJ.groups
    chapterForBuilding(CHAPTER_OBJ, 'b1')
    chapterForBuilding(CHAPTER_OBJ, 'b2')
    expect(JSON.stringify(CHAPTER_OBJ)).toBe(snapshot)
    expect(CHAPTER_OBJ.groups).toBe(groupsBefore)
    expect(CHAPTER_OBJ.groups).toHaveLength(8)
  })

  it('lists the buildings the chapter decides for, in catalogue order, without duplicates', () => {
    expect(chapterBuildingIds(CHAPTER_OBJ)).toEqual(['b1', 'b2', 'b9'])
    // A building named only on a service inside a shared group counts too.
    const serviceOnly = chapterOf(catalogueOf([
      group('g-shared', [{ ...SLAB_B2, id: 's2' }, { ...SLAB_B1, id: 's1' }, { ...SLAB_B2, id: 's2b' }]),
    ]), CHAPTER)!
    expect(chapterBuildingIds(serviceOnly)).toEqual(['b2', 'b1'])
    // A chapter shared by the whole Option names none.
    const shared = chapterOf(catalogueOf([group('g-facade', [FACADE, TIMBER_COLOUR])]), CHAPTER)!
    expect(chapterBuildingIds(shared)).toEqual([])
  })
})

/* ── 7 · cascade coherence for a scope parent ──────────────────────────── */

describe('a scope parent’s cascade over its dependants (kgCascadeFor)', () => {
  const support = () => svc('balcony-support')
  const configured = () => withDecisions(included(), {
    balcony: { state: 'selected' },
    'balcony-support': { state: 'selected', variant: 'AUSKRAGEND' },
  })

  it('reports the support choice as suspended when the balcony leaves the scope', () => {
    const cascade = kgCascadeFor(CAT, configured(), 'balcony', { state: 'notSelected' })
    const entry = cascade.entries.find((e) => e.service.id === 'balcony-support')
    expect(entry?.effect).toBe('suspend')
    expect(entry?.group).toBe(CHAPTER)
    expect(entry?.currentVariant).toBe('AUSKRAGEND')
    expect(entry?.currentAmount?.toFixed(2)).toBe('15000.00')
    // Money leaves the offer: the change is material and is confirmed first.
    expect(cascade.material).toBe(true)
  })

  it('does not report a dependant nobody has answered', () => {
    // The railing is a required decision that is still undecided: there is
    // no answer to lose, so the dialogue does not list it.
    const cascade = kgCascadeFor(CAT, configured(), 'balcony', { state: 'notSelected' })
    expect(cascade.entries.map((e) => e.service.id)).not.toContain('balcony-railing')
  })

  it('leaves the child’s recorded answer untouched after the parent is written', () => {
    // The store writes ONLY the parent (rule 14): simulate that write.
    const after = withDecisions(configured(), { balcony: { state: 'notSelected' } })
    expect(serviceDecision(after, support())).toEqual({ state: 'selected', variant: 'AUSKRAGEND' })
    // The consequence is derived, not written.
    expect(dependencySuspension(CAT, after, support())).toBe(svc('balcony'))
    expect(serviceContribution(CAT, after, support())).toBeNull()
    expect(kgContributions(CAT, after).map((c) => c.serviceId)).not.toContain('balcony-support')
    // A lapsed precondition is not a broken one: the chapter is not `invalid`.
    const progress = kgChapterProgress(CAT, after, CHAPTER)
    expect(progress.blockedServiceIds).not.toContain('balcony-support')
    expect(progress.state).not.toBe('invalid')
  })

  it('reports the same decision as restored, with its own answer, when the balcony is re-included', () => {
    const after = withDecisions(configured(), { balcony: { state: 'notSelected' } })
    const cascade = kgCascadeFor(CAT, after, 'balcony', { state: 'selected' })
    const entry = cascade.entries.find((e) => e.service.id === 'balcony-support')
    expect(entry?.effect).toBe('restore')
    expect(entry?.currentVariant).toBe('AUSKRAGEND')
    expect(entry?.currentAmount?.toFixed(2)).toBe('15000.00')
    expect(cascade.material).toBe(true)
    // Applied: the 15.000 € comes back exactly, without the child being rewritten.
    const restored = withDecisions(after, { balcony: { state: 'selected' } })
    expect(serviceContribution(CAT, restored, support())).toEqual(new Decimal('15000.00'))
    expect(serviceDecision(restored, support())).toEqual(serviceDecision(configured(), support()))
  })

  it('reports a still-live dependant as preserved when the parent changes without lapsing', () => {
    // Re-selecting an already selected parent moves nothing; the dependant is
    // named so the dialogue can say the rest of the work is safe.
    const cascade = kgCascadeFor(CAT, configured(), 'balcony', { state: 'selected' })
    const entry = cascade.entries.find((e) => e.service.id === 'balcony-support')
    expect(entry?.effect).toBe('preserve')
    expect(cascade.material).toBe(false)
  })
})
