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
  it('derives the approved seven-step internal workflow without Ground', () => {
    const s = useStore.getState()
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.label)).toEqual([
      'Leistungsabgrenzung',
      'Leistungen KG 300',
      'Technik KG 400',
      'Energie & Zertifikate',
      'Flächen im Detail',
      'Baunebenkosten KG 700',
      'Termine & Kommerzielles',
    ])
    expect(CONFIGURATOR_STEPS.some((step) => step.label === 'Baugrund & Erschließung'))
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

  it('does not fabricate downstream chapters for decidable KGs with no detail experience', () => {
    const s = useStore.getState()
    const before = activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.id)
    const included = {
      ...s.coverage,
      KG_200: 'included' as const,
      KG_500: 'included' as const,
      KG_600: 'included' as const,
    }
    expect(activeConfiguratorWorkflow({ coverage: included, mode: 'intern' })
      .map((step) => step.id)).toEqual(before)
  })

  it('derives building progress and client visibility from the same registry', () => {
    const s = useStore.getState()
    expect(activeBuildingConfiguratorSteps({ coverage: s.coverage, mode: 'intern' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.ENERGY_CERTIFICATION,
      CONFIGURATOR_STEP.AREAS,
    ])
    expect(activeConfiguratorWorkflow({ coverage: s.coverage, mode: 'praesentation' })
      .map((step) => step.id)).toEqual([
      CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
      CONFIGURATOR_STEP.KG_300_DETAILS,
      CONFIGURATOR_STEP.KG_400_DETAILS,
      CONFIGURATOR_STEP.ENERGY_CERTIFICATION,
      CONFIGURATOR_STEP.AREAS,
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

  it('migrates only meaningful v1 progress numbers, not the retired Ground step', () => {
    expect(stepIdFromLegacyChapter(2)).toBe(CONFIGURATOR_STEP.KG_300_DETAILS)
    expect(stepIdFromLegacyChapter(5)).toBe(CONFIGURATOR_STEP.AREAS)
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
