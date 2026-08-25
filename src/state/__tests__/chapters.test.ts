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
  it('derives the approved five-step internal workflow for a fresh option (mandatory core, no Ground, no Energy/Areas chapters)', () => {
    const s = useStore.getState()
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.label)).toEqual([
      'Leistungsabgrenzung',
      'Leistungen KG 300',
      'Technik KG 400',
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

  it('keeps included KG steps active and removes them when excluded', () => {
    const s = useStore.getState()
    expect([s.coverage.KG_300, s.coverage.KG_400, s.coverage.KG_700])
      .toEqual(['included', 'included', 'included'])
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.id)).toEqual(expect.arrayContaining([
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.KG_700_DETAILS,
    ]))
    expect(activeConfiguratorWorkflow({
      coverage: { ...s.coverage, KG_400: 'excluded' },
      mode: 'intern',
    }).some((step) => step.id === CONFIGURATOR_STEP.KG_400_DETAILS)).toBe(false)
  })

  it('includes the KG 200/500/600 detail chapters, in DIN order, once each carries a real catalog; KG 800 never appears even when its coverage is included (removed, not merely excluded)', () => {
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

  it('excluding every user-decidable KG (200/500/600) leaves the mandatory core plus the required non-KG steps — never truly empty', () => {
    const s = useStore.getState()
    const onlyMandatory = {
      ...s.coverage,
      KG_200: 'excluded' as const,
      KG_500: 'excluded' as const,
      KG_600: 'excluded' as const,
    }
    expect(activeConfiguratorWorkflow({ coverage: onlyMandatory, mode: 'intern' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.KG_700_DETAILS,
      CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    ])
  })

  it('derives building progress and client visibility from the same registry', () => {
    const s = useStore.getState()
    expect(activeBuildingConfiguratorSteps({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
    ])
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'praesentation' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
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
