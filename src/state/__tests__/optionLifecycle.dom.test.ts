import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStoreForTests,
  canBeginConfiguration,
  clientModeAvailableForOption,
  configurationComplete,
  kgConfigurationCompleteFor,
  kgScopeStatus,
  optionSaveStageFor,
  useStore,
} from '../store'
import {
  optionLifecycleState,
  optionOpenDestination,
  optionStateView,
  orderedOptions,
  resumeOption,
  type OptionLifecycleState,
} from '../optionLifecycle'
import { CLIENT_PROJECTION_VERSION, clientModeLockReason } from '../optionSave'
import { REVIEW_SECTIONS } from '../optionReview'
import {
  completeBuildingScope,
  completeKgConfiguration,
  decideAllKgScope,
  enterOptionWorkspace,
} from '../../test/offer-option'


/**
 * `optionLifecycleState` — the derived selector, and the four properties the
 * CPO ruling of 2026-09-06 made non-negotiable when it took scope addition A
 * into this ticket.
 *
 * The point of this file is that none of the four is asserted in prose:
 *
 * 1. EVERY state it can return is REACHED by driving the real store. "A state
 *    that cannot be reached is not implemented" is a recorded rule of this
 *    project ([[vr3-project-readiness]]), and a selector with an
 *    unreachable branch is a lie about the Product's own state machine.
 * 2. It DECIDES NOTHING. Every gate's serialised output is captured before
 *    and after the selector runs, in every one of those states, and compared.
 * 3. It STORES NOTHING. The Option row, `OptionConfig` and the persisted
 *    payload are unchanged by construction, and the source scan below proves
 *    no reducer references it.
 * 4. The DESTINATION agrees with the badge, because both come from the same
 *    place — a card cannot say `In Arbeit · Kalkulieren` beside a button that
 *    opens Gebäude & Umfang.
 */

const st = () => useStore.getState()

/** Everything a gate answers, as one comparable string. */
function gateOutput(): string {
  const s = st()
  return JSON.stringify({
    canCreateOptions: s.canCreateOptions(),
    canBeginConfiguration: canBeginConfiguration(s),
    configurationComplete: configurationComplete(s),
    kgScopeStatus: kgScopeStatus(s),
    kgConfigurationComplete: kgConfigurationCompleteFor(s),
    optionSaveStage: optionSaveStageFor(s),
    clientModeAvailable: clientModeAvailableForOption(s, s.activeOptionId),
    pipelineView: s.pipelineView,
    openConfiguratorStep: s.openConfiguratorStep,
    activeOptionId: s.activeOptionId,
  })
}

/** Drive the clean fixture to one lifecycle state and return its id. */
function reach(state: OptionLifecycleState): string {
  enterOptionWorkspace('DEMO-HAPPY-01')
  const id = st().activeOptionId!
  if (state === 'NEW') return id

  if (state === 'RECHECK') {
    // A saved scope whose fingerprint no longer describes the building it
    // was saved for: an authorised metric override is a real, journalled,
    // attributable edit, and it un-confirms the building by arithmetic.
    completeBuildingScope('SHARED')
    act(() => {
      const building = st().scopeBuildings[0]!
      st().editScopeMetric(building.id, 'wfl', '1234.00', 'Nachtrag vom Bauherrn')
    })
    return id
  }

  completeBuildingScope('SHARED')
  if (state === 'BOUNDARIES_OPEN') return id

  act(() => { decideAllKgScope('included') })
  act(() => { st().confirmKgScope() })
  if (state === 'CALCULATING') return id

  completeKgConfiguration()
  if (state === 'SCHEDULE_OPEN') return id

  act(() => {
    for (const phase of st().schedulePhases) {
      if (phase.dependencyQuestionId) {
        st().setScheduleDependencyConfirmed(phase.id, true)
      }
    }
    st().confirmSchedule()
  })
  if (state === 'REVIEW_OPEN') return id

  act(() => {
    for (const section of REVIEW_SECTIONS) st().acknowledgeReviewSection(section.id)
    st().confirmFinalValidation()
  })
  if (state === 'SAVE_AVAILABLE') return id

  if (state === 'SAVE_FAILED') {
    // A real failure path: the commitment opens, the configuration moves
    // underneath it, and the attempt refuses rather than saving something
    // nobody reviewed.
    act(() => { st().beginOptionSave() })
    act(() => { st().setKgScopeDecision('KG_600', 'undecided') })
    act(() => { st().advanceOptionSave() })
    return id
  }

  act(() => { st().beginOptionSave() })
  act(() => { st().advanceOptionSave() })
  if (state === 'CLIENT_READY') return id

  if (state === 'SENT') {
    act(() => { st().sendOffer('email') })
    return id
  }
  throw new Error(`unhandled lifecycle state ${state}`)
}

describe('optionLifecycleState · every state is reachable by driving the store', () => {
  beforeEach(() => { __resetStoreForTests() })

  const CASES: Array<[OptionLifecycleState, { stage: string; step: string | null }]> = [
    ['NEW', { stage: 'konfigurieren', step: 'gebaeude-umfang' }],
    ['RECHECK', { stage: 'konfigurieren', step: 'gebaeude-umfang' }],
    ['BOUNDARIES_OPEN', { stage: 'konfigurieren', step: 'leistungsabgrenzung' }],
    ['CALCULATING', { stage: 'kalkulieren', step: 'kg200' }],
    ['SCHEDULE_OPEN', { stage: 'kalkulieren', step: 'terminplan' }],
    ['REVIEW_OPEN', { stage: 'pruefen', step: 'finale-pruefung' }],
    // The failure's own trigger reopened a scope decision, so the total
    // destination function points at the thing that is actually incomplete
    // — which is the property that makes it total rather than a lookup.
    ['SAVE_FAILED', { stage: 'konfigurieren', step: 'leistungsabgrenzung' }],
    ['SAVE_AVAILABLE', { stage: 'pruefen', step: 'speichern' }],
    ['CLIENT_READY', { stage: 'praesentieren', step: null }],
    ['SENT', { stage: 'praesentieren', step: null }],
  ]

  for (const [state, destination] of CASES) {
    it(`${state} is reachable, and its destination is the one the button names`, () => {
      const id = reach(state)
      expect(optionLifecycleState(st(), id)).toBe(state)
      expect(optionOpenDestination(st(), id)).toEqual(destination)
    })
  }

})

describe('optionLifecycleState · it decides nothing', () => {
  beforeEach(() => { __resetStoreForTests() })

  const STATES: OptionLifecycleState[] = [
    'NEW', 'RECHECK', 'BOUNDARIES_OPEN', 'CALCULATING', 'SCHEDULE_OPEN',
    'REVIEW_OPEN', 'SAVE_AVAILABLE', 'SAVE_FAILED', 'CLIENT_READY', 'SENT',
  ]

  for (const state of STATES) {
    it(`every gate's output is identical before and after reading ${state}`, () => {
      const id = reach(state)
      const before = gateOutput()
      // Read it the way every consumer does — badge, ordering, resume line
      // and destination all at once.
      optionLifecycleState(st(), id)
      optionOpenDestination(st(), id)
      orderedOptions(st())
      resumeOption(st())
      optionStateView(st(), id)
      expect(gateOutput()).toBe(before)
    })
  }

  it('no reducer references the selector: the store imports the DESTINATION only', () => {
    const source = readFileSync(
      path.resolve(__dirname, '..', 'store.ts'), 'utf8',
    )
    const importLine = source
      .split('\n')
      .find((line) => line.includes("from './optionLifecycle'"))
    expect(importLine).toBe("import { optionNav, optionOpenDestination } from './optionLifecycle'")
    // The lifecycle value itself must not be reachable from any reducer: a
    // gate that read it would be a gate reading a presentation.
    expect(source).not.toContain('optionLifecycleState')
  })

  /**
   * B9 — a SAVED Option whose client eligibility has been revoked.
   *
   * The Product cannot produce it TODAY, and that is a property worth
   * stating rather than hiding: `advanceOptionSave` refuses outright when
   * the client projection is not valid, so no save can write
   * `clientProjectionValid: false`, and `CLIENT_PROJECTION_VERSION` has
   * never been bumped. The branch exists because the predicate does —
   * `clientModeLockReason` returns `projectionInvalid`/`projectionOutdated`
   * and the audit's state matrix lists B9 — and because the version constant
   * exists precisely to revoke a stored baseline's eligibility the day the
   * contract changes.
   *
   * So it is proved as what it is: a PURE branch over an existing predicate,
   * exercised on a saved state whose recorded contract version is one behind
   * the current one. The store is not mutated — `setState` is not exported,
   * deliberately — the selector is simply asked about that state.
   */
  it('CLIENT_LOCKED is the branch a contract bump produces, and it is live', () => {
    const id = reach('CLIENT_READY')
    expect(optionLifecycleState(st(), id)).toBe('CLIENT_READY')

    const aged = {
      ...st(),
      savedOptionVersions: {
        ...st().savedOptionVersions,
        [id]: st().savedOptionVersions[id]!.map((version) => ({
          ...version, clientProjectionVersion: CLIENT_PROJECTION_VERSION - 1,
        })),
      },
    }
    expect(clientModeLockReason(aged, id)).toBe('projectionOutdated')
    expect(optionLifecycleState(aged, id)).toBe('CLIENT_LOCKED')
    expect(optionOpenDestination(aged, id))
      .toEqual({ stage: 'pruefen', step: 'finale-pruefung' })
    // The saved receipt itself is intact: only the CLIENT's right to see it
    // is revoked, which is what a contract bump means.
    expect(aged.savedOptionVersions[id]).toHaveLength(1)
  })

  it('nothing is persisted: the Option row keeps exactly id and name', () => {
    const id = reach('CALCULATING')
    optionLifecycleState(st(), id)
    expect(Object.keys(st().options[0]!).sort()).toEqual(['id', 'name'])
  })
})
