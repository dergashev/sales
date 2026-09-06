import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROPOSAL_LAST_PROJECT_KEY,
  PROPOSAL_PERSISTENCE_VERSION,
  PROPOSAL_STORAGE_PREFIX,
  prunePersistedProposals,
  proposalStorageKey,
  serializeProposalPayload,
  type StorageLike,
} from '../persistence'
import {
  hydrateProposalState,
  initializeProposalPersistence,
  kgCatalogueFor,
  useStore,
  __resetStoreForTests,
} from '../store'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'

/**
 * ONE OPTION WORKSPACE PER PROJECT.
 *
 * Until `PROPOSAL_PERSISTENCE_VERSION` 5 the whole prototype shared a single
 * stored proposal, written under a constant id (`demo.project.id`) that names
 * neither demonstration project. Measured in a real browser on `887c74c`: an
 * Option created and building-confirmed under `Wohnhof Lindenhain` was listed
 * by `Quartier Am Güterbogen`, opened inside it, kept `Lindenhof` — the other
 * project's building — as its confirmed scope, and survived a reload.
 *
 * That is not one cosmetic defect. `kgCatalogueFor` keys the PRICE CATALOGUE
 * off `opportunityId` while the confirmed building set was whatever had been
 * saved last, so KG 400 could price one project's catalogue against another
 * project's buildings — a chapter whose money and whose subject came from two
 * different projects at once.
 *
 * These tests are the contract that replaced it. They drive the store through
 * its own doors; none of them writes a payload by hand, because a hand-built
 * payload is exactly what would let a broken swap keep passing.
 */

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  get length() { return this.values.size }
  key(index: number) { return [...this.values.keys()][index] ?? null }
}

const A = 'DEMO-HAPPY-01'
const B = 'DEMO-COMPLEX-01'
const st = () => useStore.getState()

const buildingNames = () => st().scopeBuildings.map((building) => building.name)
const optionNames = () => st().options.map((option) => option.name)

/**
 * A reload is the same BROWSER with a store that remembers nothing.
 *
 * `__resetStoreForTests` deliberately clears every stored proposal — it is
 * the "clean slate" hook, and after this fix a slate that kept one project's
 * payload would be exactly the leak under test. So a reload cannot be
 * simulated by resetting and reusing the same storage object: the copy is
 * taken first, and it carries the whole browser, pointer included.
 */
function reloadBrowser(storage: MemoryStorage): MemoryStorage {
  const copy = new MemoryStorage()
  for (const [key, value] of storage.values) copy.setItem(key, value)
  return copy
}

/**
 * The payload with its wall clocks removed.
 *
 * Two runs of the same journey record different instants, and an instant is
 * not something a project inherits. Everything else is compared verbatim.
 */
function withoutTimestamps(raw: string): unknown {
  return JSON.parse(raw.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<at>'))
}

describe('an Option workspace belongs to exactly one Project', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('does not carry one project\'s Options into another', () => {
    initializeProposalPersistence(new MemoryStorage())

    enterOptionWorkspace(A)
    st().renameOption(st().activeOptionId!, 'Lindenhain-Option')
    expect(optionNames()).toEqual(['Lindenhain-Option'])

    st().openOpportunity(B)

    // THE DEFECT, in one line: this used to be ['Lindenhain-Option'].
    expect(optionNames()).toEqual([])
    expect(st().activeOptionId).toBeNull()
    expect(st().optionSeq).toBe(0)
    expect(st().opportunityId).toBe(B)
  })

  it('does not carry one project\'s confirmed building scope into another', () => {
    initializeProposalPersistence(new MemoryStorage())

    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    expect(buildingNames()).toContain('Lindenhof')
    expect(st().scopeSaved).not.toBeNull()

    st().openOpportunity(B)

    /**
     * The building set is the FRAME of KG 400: every system states which
     * buildings it applies to, and a shared-vs-per-building plant decision is
     * a decision about that set. Inheriting it from another project does not
     * merely mislabel a row — it makes the chapter answer a question about
     * the wrong buildings.
     */
    expect(buildingNames()).not.toContain('Lindenhof')
    expect(st().scopeSaved).toBeNull()
  })

  it('never lets the price catalogue and the building scope come from different projects', () => {
    initializeProposalPersistence(new MemoryStorage())

    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    expect(kgCatalogueFor(st())?.projectId).toBe(A)

    st().openOpportunity(B)
    enterOptionWorkspace(B)
    completeBuildingScope('SHARED')

    // Both halves moved together, which is the whole invariant.
    expect(kgCatalogueFor(st())?.projectId).toBe(B)
    expect(buildingNames()).toContain('Kontorhaus')
    expect(buildingNames()).not.toContain('Lindenhof')
  })

  it('does not carry one project\'s journal into another, so undo cannot cross', () => {
    initializeProposalPersistence(new MemoryStorage())

    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    expect(st().journal.length).toBeGreaterThan(0)

    st().openOpportunity(B)

    /**
     * A journal entry carries `inverse`/`forward` closures written against
     * the state that produced them. Surviving a project switch would let an
     * undo apply one project's change to another project's data — the same
     * class of defect, one level down.
     */
    expect(st().journal).toEqual([])
    expect(st().undone).toEqual([])
  })

  it('gives each project its own key, and gives up the legacy single key', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)

    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    st().openOpportunity(B)
    enterOptionWorkspace(B)

    expect(storage.getItem(proposalStorageKey(A))).not.toBeNull()
    expect(storage.getItem(proposalStorageKey(B))).not.toBeNull()
    // `DEMO-0001` is the pre-project bucket, not a project. Once a project is
    // open, nothing is ever filed under it again.
    expect(storage.getItem(proposalStorageKey('DEMO-0001'))).toBeNull()
    // Each payload names itself, and names only itself.
    expect(storage.getItem(proposalStorageKey(A))).toContain(A)
    expect(storage.getItem(proposalStorageKey(B))).not.toContain(`"${A}"`)
  })

  it('gives a project its own work back when the user returns to it', () => {
    initializeProposalPersistence(new MemoryStorage())

    enterOptionWorkspace(A)
    st().renameOption(st().activeOptionId!, 'Lindenhain-Option')
    completeBuildingScope('SHARED')

    st().openOpportunity(B)
    expect(optionNames()).toEqual([])

    st().openOpportunity(A)

    // Isolation is not amnesia: leaving a project banks its workspace, it
    // does not discard it.
    expect(optionNames()).toEqual(['Lindenhain-Option'])
    expect(buildingNames()).toContain('Lindenhof')
    expect(st().scopeSaved).not.toBeNull()
    expect(kgCatalogueFor(st())?.projectId).toBe(A)
  })

  it('reopening the SAME project changes nothing it holds', () => {
    initializeProposalPersistence(new MemoryStorage())

    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    const optionId = st().activeOptionId
    const journalLength = st().journal.length

    st().openOpportunity(A)

    // A no-op swap must not be a reset dressed as navigation: re-entering the
    // project you are already in is how a user gets back to the overview.
    expect(st().activeOptionId).toBe(optionId)
    expect(st().journal.length).toBe(journalLength)
    expect(st().scopeSaved).not.toBeNull()
  })
})

describe('a reload restores the project the browser was last in', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('restores that project, with that project\'s workspace', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)

    enterOptionWorkspace(A)
    st().renameOption(st().activeOptionId!, 'Lindenhain-Option')
    st().openOpportunity(B)
    enterOptionWorkspace(B)
    st().renameOption(st().activeOptionId!, 'Güterbogen-Option')

    expect(storage.getItem(PROPOSAL_LAST_PROJECT_KEY)).toBe(B)

    const reloaded = reloadBrowser(storage)
    __resetStoreForTests()
    expect(hydrateProposalState(reloaded)).toBe(true)

    expect(st().opportunityId).toBe(B)
    expect(optionNames()).toEqual(['Güterbogen-Option'])
    expect(kgCatalogueFor(st())?.projectId).toBe(B)
  })

  it('restores nothing when no project was ever opened', () => {
    const storage = new MemoryStorage()
    expect(hydrateProposalState(storage)).toBe(false)
    expect(st().opportunityId).toBeNull()
  })
})

describe('a stored proposal that cannot be trusted is dropped, never attributed', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('discards a pre-fix payload rather than guessing which project it was', () => {
    const storage = new MemoryStorage()
    /**
     * The shape written by version 4: ONE key, a constant `projectId` that
     * names no project, and an `opportunityId` recording only the project it
     * was last VIEWED under. Its Options may have been created anywhere, so
     * attributing the whole payload to that one project would keep the leak
     * and merely make it look deliberate.
     */
    storage.setItem(proposalStorageKey('DEMO-0001'), JSON.stringify({
      version: 4,
      projectId: 'DEMO-0001',
      payload: { opportunityId: B, options: [{ id: 'OPT-01', name: 'Option 1' }] },
    }))

    initializeProposalPersistence(storage)

    expect(storage.getItem(proposalStorageKey('DEMO-0001'))).toBeNull()
    expect(optionNames()).toEqual([])
    expect(st().opportunityId).toBeNull()
  })

  it('drops a payload whose envelope disagrees with the key it is filed under', () => {
    const storage = new MemoryStorage()
    // Filed under A, claiming to be B. Under the single-key contract this
    // question could not even be asked; it is now the invariant that makes
    // "the key names the project" true rather than merely intended.
    storage.setItem(
      proposalStorageKey(A),
      serializeProposalPayload(B, { options: [] }),
    )
    storage.setItem(
      proposalStorageKey(B),
      serializeProposalPayload(B, { options: [] }),
    )

    expect(prunePersistedProposals(storage)).toEqual([A])
    expect(storage.getItem(proposalStorageKey(A))).toBeNull()
    expect(storage.getItem(proposalStorageKey(B))).not.toBeNull()
  })

  it('leaves the last-project pointer alone when pruning the proposal namespace', () => {
    const storage = new MemoryStorage()
    storage.setItem(PROPOSAL_LAST_PROJECT_KEY, A)
    storage.setItem(proposalStorageKey(A), '{not json')

    prunePersistedProposals(storage)

    // The pointer lives outside `PROPOSAL_STORAGE_PREFIX` precisely so that
    // pruning cannot eat it, and so that no project can ever be named after
    // it.
    expect(PROPOSAL_LAST_PROJECT_KEY.startsWith(PROPOSAL_STORAGE_PREFIX)).toBe(false)
    expect(storage.getItem(PROPOSAL_LAST_PROJECT_KEY)).toBe(A)
    expect(storage.getItem(proposalStorageKey(A))).toBeNull()
  })

  it('keeps a payload that is current and correctly filed', () => {
    const storage = new MemoryStorage()
    storage.setItem(proposalStorageKey(A), serializeProposalPayload(A, { options: [] }))
    expect(prunePersistedProposals(storage)).toEqual([])
    expect(storage.getItem(proposalStorageKey(A))).not.toBeNull()
  })

  it('states the version this contract begins at', () => {
    // Not decoration: the pre-fix payload above is hard-coded to 4, so a
    // future bump that forgets to move it would silently stop testing the
    // migration boundary.
    expect(PROPOSAL_PERSISTENCE_VERSION).toBe(5)
  })
})

describe('what a project inherits is decided by subtraction, not by a list', () => {
  beforeEach(() => { __resetStoreForTests() })

  /**
   * THE REGRESSION GUARD THAT MATTERS.
   *
   * Every other test here names a field. This one names none, and that is
   * the point: a field added to the store later, and forgotten, is exactly
   * how this defect would come back. So instead of asserting a list, it
   * compares the whole persisted payload of a project reached THROUGH
   * another one against the payload of the same project reached on a fresh
   * store — byte for byte.
   *
   * If any project-scoped field survives a switch, these two payloads differ
   * and this test fails, whatever the field is called and whenever it was
   * added.
   */
  it('a project reached through another one holds exactly what it holds on its own', () => {
    const viaOther = new MemoryStorage()
    initializeProposalPersistence(viaOther)
    enterOptionWorkspace(A)
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    saveOptionBaseline()
    st().openOpportunity(B)
    enterOptionWorkspace(B)
    completeBuildingScope('SHARED')
    const throughA = viaOther.getItem(proposalStorageKey(B))!

    __resetStoreForTests()

    const direct = new MemoryStorage()
    initializeProposalPersistence(direct)
    enterOptionWorkspace(B)
    completeBuildingScope('SHARED')
    const onItsOwn = direct.getItem(proposalStorageKey(B))!

    expect(withoutTimestamps(throughA)).toEqual(withoutTimestamps(onItsOwn))
  })
})
