import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStoreForTests,
  preparationStatuses,
  projectBaselineChangesSinceConfirmation,
  PROJECT_PARAMS_CONFIRMATION_LABEL,
  useStore,
} from '../store'

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

describe('Project baseline freshness', () => {
  it('derives stale from a material post-confirmation conflict decision and clears it through a real reconfirmation event', () => {
    st().openOpportunity('DEMO-0001')
    st().confirmProjectParams()
    expect(projectBaselineChangesSinceConfirmation(st())).toEqual([])

    // A defer is journalled but leaves the open conflict and baseline value
    // unchanged, so it must not manufacture staleness.
    st().resolveBuildingConflict('DEMO-CONF-0001', { decision: 'defer' })
    expect(projectBaselineChangesSinceConfirmation(st())).toEqual([])

    st().resolveWflConflict('customer')
    expect(st().projectParamsConfirmed).toBe(true)
    expect(projectBaselineChangesSinceConfirmation(st())).toEqual(['WFL nach WoFlV'])

    const confirmationsBefore = st().journal.filter((event) =>
      event.label === PROJECT_PARAMS_CONFIRMATION_LABEL).length
    st().confirmProjectParams()

    expect(projectBaselineChangesSinceConfirmation(st())).toEqual([])
    expect(st().journal.filter((event) =>
      event.label === PROJECT_PARAMS_CONFIRMATION_LABEL)).toHaveLength(confirmationsBefore + 1)

    // Undoing reconfirmation restores confirmed-but-stale rather than
    // pretending the original confirmation never happened.
    st().undo()
    expect(st().projectParamsConfirmed).toBe(true)
    expect(projectBaselineChangesSinceConfirmation(st())).toEqual(['WFL nach WoFlV'])
  })

  it('marks a manual baseline value change stale and uses one shared preparation status source', () => {
    st().openOpportunity('DEMO-0001')
    expect(preparationStatuses(st())).toEqual({
      questions: { wfl: true, energyStandard: true },
      // `kg500Coverage` retired (CPO decision, 22.08.2026): no KG coverage
      // decision is ever left `unknown`, so it never contributes an assumption.
      assumptions: { buildingClass: true },
    })

    st().confirmProjectParams()
    st().editField('wfl', new Decimal('1510'), false)

    expect(st().fields.wfl.provenance).toBe('manuell erfasst')
    expect(projectBaselineChangesSinceConfirmation(st())).toEqual(['WFL nach WoFlV'])
  })
})
