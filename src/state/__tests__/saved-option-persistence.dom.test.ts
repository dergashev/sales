import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROPOSAL_LAST_PROJECT_KEY, proposalStorageKey, type StorageLike,
} from '../persistence'
import {
  clientModeAvailableForOption,
  hydrateProposalState,
  initializeProposalPersistence,
  useStore,
  __resetStoreForTests,
} from '../store'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const st = () => useStore.getState()

/**
 * The project these Options belong to — and therefore the key their
 * workspace is filed under. It used to be `PROPOSAL_PROJECT_ID`, the single
 * key the whole prototype shared; a stored proposal is now named after its
 * own project.
 */
const PROJECT_ID = 'DEMO-HAPPY-01'

describe('a saved Option survives a reload', () => {
  beforeEach(() => { __resetStoreForTests() })

  /**
   * `SavedOptionVersion.sourceOptionId` is optional BY CONTRACT: an Option
   * saved from preparation has no parent, so the field is absent. The shape
   * guard demanded an EXACT key set, so every such version was rejected —
   * and with it the WHOLE persisted payload, which `hydrateProposalState`
   * then cleared before returning false. The saved baseline, the one record
   * in this product that is a commercial COMMITMENT and the only thing
   * Client Mode reads, was silently discarded on the next reload.
   *
   * Reproduced on the released baseline `06a4acf` as well as here, so this
   * case guards a pre-existing defect rather than a regression. It is driven
   * through the real save path for the same reason the save helper is: a
   * hand-built payload would have let the guard keep passing.
   */
  it('with no lineage, which is every Option saved from preparation', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)

    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    saveOptionBaseline()
    const optionId = st().activeOptionId!
    expect(st().savedOptionVersions[optionId]).toHaveLength(1)
    expect(st().savedOptionVersions[optionId]![0]!.sourceOptionId).toBeUndefined()

    const raw = storage.getItem(proposalStorageKey(PROJECT_ID))!
    __resetStoreForTests()
    const restored = new MemoryStorage()
    restored.setItem(proposalStorageKey(PROJECT_ID), raw)
    // A reload carries the whole browser, pointer included: without it the
    // boot path does not know which project to restore.
    restored.setItem(PROPOSAL_LAST_PROJECT_KEY, PROJECT_ID)

    expect(hydrateProposalState(restored)).toBe(true)
    expect(st().savedOptionVersions[optionId]).toHaveLength(1)
    expect(st().options.map((option) => option.id)).toContain(optionId)
    // The commitment survives in the only sense that matters: the client
    // meeting it unlocked is still unlocked.
    expect(clientModeAvailableForOption(st(), optionId)).toBe(true)
  })

  /** A payload carrying an UNKNOWN key is still refused. */
  it('but a payload with a field the contract does not declare is still refused', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    saveOptionBaseline()

    const raw = storage.getItem(proposalStorageKey(PROJECT_ID))!
    const tampered = raw.replace('"clientProjectionValid"', '"erfundenesFeld":1,"clientProjectionValid"')
    __resetStoreForTests()
    const restored = new MemoryStorage()
    restored.setItem(proposalStorageKey(PROJECT_ID), tampered)
    // Present, so the refusal below is about the unknown FIELD and not
    // about the boot path failing to find a project at all.
    restored.setItem(PROPOSAL_LAST_PROJECT_KEY, PROJECT_ID)
    expect(hydrateProposalState(restored)).toBe(false)
  })
})
