import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROPOSAL_LAST_PROJECT_KEY, proposalStorageKey, type StorageLike,
} from '../persistence'
import {
  __resetStoreForTests,
  hydrateProposalState,
  initializeProposalPersistence,
  responsibilityFor,
  reviewSectionInputsFor,
  useStore,
} from '../store'
import { CONFIGURATOR_STEP } from '../chapters'
import { destinationOfNav, optionNav } from '../optionLifecycle'
import { currentRoute } from '../useAppRouting'
import { routePath } from '../appRoute'
import { completeBuildingScope, enterOptionWorkspace } from '../../test/offer-option'

/**
 * SCHNITTSTELLEN & VERANTWORTUNG — one owner, outside KG 400 (VR3-TGA-UX-00).
 *
 * The relocation map's contract, driven through the store's own doors:
 * the record is seeded when the Option is, it survives a reload, a payload
 * saved BEFORE the record existed reads through one adapter and loses
 * nothing, a malformed record is refused, two projects never share it, the
 * review represents it exactly once, and the step has one canonical route.
 */

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const st = () => useStore.getState()
const A = 'DEMO-HAPPY-01'
const B = 'DEMO-COMPLEX-01'

/** The stored payload, as an object, so a test can strip or tamper ONE key. */
function stored(storage: MemoryStorage, projectId: string) {
  return JSON.parse(storage.getItem(proposalStorageKey(projectId))!) as {
    version: number
    projectId: string
    payload: {
      active: Record<string, unknown>
      optionConfigs: Record<string, Record<string, unknown>>
    }
  }
}

function restoreFrom(projectId: string, record: unknown): boolean {
  __resetStoreForTests()
  const restored = new MemoryStorage()
  restored.setItem(proposalStorageKey(projectId), JSON.stringify(record))
  restored.setItem(PROPOSAL_LAST_PROJECT_KEY, projectId)
  return hydrateProposalState(restored)
}

beforeEach(() => { __resetStoreForTests() })

describe('the Option-owned responsibility record', () => {
  it('is seeded from the project catalogue the moment the Option is created', () => {
    enterOptionWorkspace(B)
    expect(st().responsibility).not.toBeNull()
    expect(st().responsibility!.version).toBe(1)
    const projection = responsibilityFor(st())!
    expect(projection.origin).toBe('record')
    expect(projection.media.map((m) => m.id))
      .toEqual(['potableWater', 'foulWater', 'electricityLv', 'telecommunications'])
    // The complex project's one unresolved interface survived the move.
    expect(projection.unresolved.map((m) => m.id)).toEqual(['telecommunications'])
    // And the clean project's did not acquire one.
    __resetStoreForTests()
    enterOptionWorkspace(A)
    expect(responsibilityFor(st())!.unresolved).toEqual([])
  })

  it('survives a reload as the record, not as a re-seed', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    enterOptionWorkspace(B)
    completeBuildingScope('PER_BUILDING')
    const before = st().responsibility
    expect(before).not.toBeNull()
    expect(stored(storage, B).payload.active.responsibility).toEqual(before)

    expect(restoreFrom(B, stored(storage, B))).toBe(true)
    expect(st().responsibility).toEqual(before)
    expect(responsibilityFor(st())!.origin).toBe('record')
  })

  it('reads an Option persisted BEFORE the record existed through one adapter — lossless, flagged, not written back', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    enterOptionWorkspace(B)
    completeBuildingScope('PER_BUILDING')
    const owned = responsibilityFor(st())!

    // A legacy payload is exactly the current one without the key.
    const legacy = stored(storage, B)
    delete legacy.payload.active.responsibility
    for (const config of Object.values(legacy.payload.optionConfigs)) delete config.responsibility

    expect(restoreFrom(B, legacy)).toBe(true)
    expect(st().responsibility).toBeNull()
    const projection = responsibilityFor(st())!
    expect(projection.origin).toBe('legacy')
    // Same truth, medium for medium: the adapter seeds, it does not invent.
    expect(projection.media).toEqual(owned.media)
    expect(projection.unresolved.map((m) => m.id)).toEqual(['telecommunications'])
    // Reading did not manufacture a record the user never had.
    expect(st().responsibility).toBeNull()
  })

  it('refuses a malformed record rather than restoring a shape it cannot read', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    const tampered = stored(storage, A)
    tampered.payload.active.responsibility = {
      version: 1, seededFrom: 1,
      media: {
        potableWater: { status: 'maybe' }, foulWater: { status: 'ok' },
        electricityLv: { status: 'ok' }, telecommunications: { status: 'ok' },
      },
    }
    expect(restoreFrom(A, tampered)).toBe(false)
  })

  it('never leaks between projects: each Option carries its own project’s matrix', () => {
    enterOptionWorkspace(A)
    const a = responsibilityFor(st())!
    __resetStoreForTests()
    enterOptionWorkspace(B)
    const b = responsibilityFor(st())!
    expect(a.unresolved).toEqual([])
    expect(b.unresolved.map((m) => m.id)).toEqual(['telecommunications'])
    expect(a.connections.source.originDe).not.toBe(b.connections.source.originDe)
  })
})

describe('the review represents responsibility exactly once', () => {
  it('as its own section — a permitted warning for an unresolved medium, never a blocker', () => {
    enterOptionWorkspace(B)
    completeBuildingScope('PER_BUILDING')
    const inputs = reviewSectionInputsFor(st())
    const sections = inputs.filter((input) => input.id === 'responsibility')
    expect(sections).toHaveLength(1)
    const [section] = sections
    expect(section!.issues.map((issue) => issue.severity)).toEqual(['permittedWarning'])
    expect(section!.issues[0]!.messageKey)
      .toBe('vr3.review.issue.responsibilityOpen.telecommunications')
    expect(section!.issues[0]!.route).toBe('responsibility')
    // The clean project has nothing to warn about.
    __resetStoreForTests()
    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    expect(reviewSectionInputsFor(st()).find((i) => i.id === 'responsibility')!.issues)
      .toEqual([])
  })
})

describe('the step has one canonical route', () => {
  it('KG 700 → verantwortung → terminplan, encoded and decoded through the same tables', () => {
    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    expect(optionNav({ stage: 'kalkulieren', step: 'verantwortung' }))
      .toEqual({ view: 'konfigurator', step: CONFIGURATOR_STEP.RESPONSIBILITY })
    expect(destinationOfNav('konfigurator', CONFIGURATOR_STEP.RESPONSIBILITY))
      .toEqual({ stage: 'kalkulieren', step: 'verantwortung' })

    st().setPipelineView('konfigurator')
    st().openConfiguratorStepAt(CONFIGURATOR_STEP.RESPONSIBILITY)
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.RESPONSIBILITY)
    const route = currentRoute(st())!
    expect(routePath(route)).toBe(`/projekt/${A}/option/${st().activeOptionId}/kalkulieren/verantwortung`)
    // Visiting it is recorded like any other step; it gates nothing.
    expect(st().visitedConfiguratorSteps).toContain(CONFIGURATOR_STEP.RESPONSIBILITY)
  })
})
