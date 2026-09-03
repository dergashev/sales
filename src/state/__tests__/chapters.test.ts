import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeBuildingConfiguratorSteps,
  activeConfiguratorWorkflow,
  CONFIGURATOR_STEP,
  CONFIGURATOR_STEPS,
  nearestActiveConfiguratorStep,
  stepIdFromLegacyChapter,
} from '../chapters'
import { __resetStoreForTests, useStore } from '../store'

beforeEach(() => __resetStoreForTests())

describe('semantic Configurator workflow', () => {
  it('derives the eight-stage internal workflow: the ledger, all six cost groups, the schedule', () => {
    const s = useStore.getState()
    // VR3-03: every cost group is a stage of the journey ALWAYS, whatever its
    // scope decision. Filtering the registry by `coverage === 'included'` is
    // how an excluded KG stopped existing — it left the navigation and could
    // no longer explain that it was skipped (audit D-016). The decision is a
    // STATE of the stage now, carried by the spine and by the stage itself.
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.label)).toEqual([
      'Leistungsabgrenzung',
      'Vorbereitende Maßnahmen KG 200',
      'Leistungen KG 300',
      'Technik KG 400',
      'Außenanlagen KG 500',
      'Ausstattung KG 600',
      'Baunebenkosten KG 700',
      'Termine',
    ])
    expect(CONFIGURATOR_STEPS.some((step) => step.label === 'Baugrund & Erschließung'))
      .toBe(false)
    expect(CONFIGURATOR_STEPS.some((step) => step.label === 'Energie & Zertifikate'))
      .toBe(false)
    expect(CONFIGURATOR_STEPS.some((step) => step.label === 'Flächen im Detail'))
      .toBe(false)
    expect(CONFIGURATOR_STEPS.some((step) => step.label === 'Finanzierung KG 800'))
      .toBe(false)
  })

  it('keeps an EXCLUDED cost group in the workflow, so it can say it was skipped', () => {
    const s = useStore.getState()
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.id)).toEqual(expect.arrayContaining([
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.KG_700_DETAILS,
    ]))
    // The exclusion is intentional and stays visible (VR3-00 target: "An
    // excluded KG stays in navigation as OUT OF SCOPE · SKIPPED, not
    // 'incomplete' and not absent").
    expect(activeConfiguratorWorkflow({
      coverage: { ...s.coverage, KG_400: 'excluded' },
      mode: 'intern',
    }).some((step) => step.id === CONFIGURATOR_STEP.KG_400_DETAILS)).toBe(true)
  })

  it('lists the cost groups in DIN order; KG 800 never appears even when its coverage is included (removed, not merely excluded)', () => {
    const s = useStore.getState()
    const included = {
      ...s.coverage,
      KG_200: 'included' as const,
      KG_500: 'included' as const,
      KG_600: 'included' as const,
      // Deliberately still `included` here to prove KG 800 has no step at
      // all any more — not just that it defaults to excluded.
      KG_800: 'included' as const,
    }
    expect(activeConfiguratorWorkflow({ coverage: included, mode: 'intern' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
      CONFIGURATOR_STEP.KG_200_DETAILS,
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.KG_500_DETAILS,
      CONFIGURATOR_STEP.KG_600_DETAILS,
      CONFIGURATOR_STEP.KG_700_DETAILS,
      CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    ])
  })

  it('excluding every cost group still leaves all eight stages — nothing disappears', () => {
    const s = useStore.getState()
    const allExcluded = Object.fromEntries(
      Object.entries(s.coverage).map(([group]) => [group, 'excluded' as const]),
    ) as typeof s.coverage
    expect(activeConfiguratorWorkflow({ coverage: allExcluded, mode: 'intern' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
      CONFIGURATOR_STEP.KG_200_DETAILS,
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.KG_500_DETAILS,
      CONFIGURATOR_STEP.KG_600_DETAILS,
      CONFIGURATOR_STEP.KG_700_DETAILS,
      CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    ])
  })

  it('has no building-scoped stage left, and keeps KG 700 internal-only', () => {
    const s = useStore.getState()
    // VR3-03: all six cost groups are project-scoped. Building ownership is
    // expressed by the service row (each service names its building) and by
    // the page's context panel — not by a tab strip over six identical
    // pages, which would be the second navigation grammar this ticket
    // removes. Rule 38's "the screen's structure does not change" holds by
    // construction when there is one structure.
    expect(activeBuildingConfiguratorSteps({ coverage: s.coverage, mode: 'intern' }))
      .toEqual([])
    // KG 700 is `internalOnly` and still is: fees are not a client surface.
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'praesentation' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
      CONFIGURATOR_STEP.KG_200_DETAILS,
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.KG_500_DETAILS,
      CONFIGURATOR_STEP.KG_600_DETAILS,
      CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    ])
  })

  it('normalizes a removed/hidden current step to the next active semantic step', () => {
    const s = useStore.getState()
    expect(nearestActiveConfiguratorStep({
      coverage: s.coverage,
      mode: 'praesentation',
    }, CONFIGURATOR_STEP.KG_700_DETAILS)).toBe(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)
  })

  it('migrates only meaningful v1 progress numbers, not the retired Ground step; the retired Energy (4) and Areas (5) chapters land on Scope Boundaries', () => {
    expect(stepIdFromLegacyChapter(2)).toBe(CONFIGURATOR_STEP.KG_300_DETAILS)
    expect(stepIdFromLegacyChapter(4)).toBe(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
    expect(stepIdFromLegacyChapter(5)).toBe(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
    expect(stepIdFromLegacyChapter(6)).toBeNull()
  })

  it('enters Scope Boundaries and starts pricing when mode is confirmed', () => {
    const st = () => useStore.getState()
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Entry order')
    st().confirmBuilding(st().activeBuildingId)
    expect(st().pricingStarted).toBe(false)

    st().confirmConfigurationMode('SHARED')
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
    expect(st().pricingStarted).toBe(true)
    expect(st().scopeBuildingId).toBeNull()
  })
})
