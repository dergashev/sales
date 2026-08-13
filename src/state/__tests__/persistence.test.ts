import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  loadPersistedProposal,
  proposalStorageKey,
  savePersistedProposal,
  serializeProposalPayload,
  type StorageLike,
} from '../persistence'
import {
  hydrateProposalState,
  initializeProposalPersistence,
  projectionForOption,
  useStore,
  wflConflict,
  __resetStoreForTests,
} from '../store'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('proposal persistence codec', () => {
  it('round-trips Decimal values without passing through Number', () => {
    const storage = new MemoryStorage()
    const exact = new Decimal('12345678901234567890.123456789')
    expect(savePersistedProposal(storage, 'P-1', { exact })).toBe(true)
    const result = loadPersistedProposal(storage, 'P-1')
    expect(result.status).toBe('loaded')
    if (result.status !== 'loaded') throw new Error('payload was not loaded')
    const restored = (result.payload as { exact: Decimal }).exact
    expect(Decimal.isDecimal(restored)).toBe(true)
    expect(restored.equals(exact)).toBe(true)
  })

  it('discards malformed and version-mismatched payloads whole', () => {
    const storage = new MemoryStorage()
    const key = proposalStorageKey('P-1')
    storage.setItem(key, '{bad json')
    expect(loadPersistedProposal(storage, 'P-1')).toEqual({
      status: 'discarded', reason: 'malformed',
    })
    expect(storage.getItem(key)).toBeNull()

    const valid = serializeProposalPayload('P-1', { one: new Decimal(1) })
    storage.setItem(key, valid.replace('"version":1', '"version":2'))
    expect(loadPersistedProposal(storage, 'P-1')).toEqual({
      status: 'discarded', reason: 'version',
    })
    expect(storage.getItem(key)).toBeNull()
  })
})

describe('proposal store recovery', () => {
  beforeEach(() => __resetStoreForTests())

  it('restores the complete proposal slice with one event and no private/session data', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Hausweise')
    st().setBuildingFactOverride(
      'DEMO-B-A', 'bgfRAbove', new Decimal('2100.123456789'),
    )
    st().setKg300('fassade', 'klinker')
    st().setKg700Mode('hoaiAho')
    st().setDiscount(new Decimal('2.5'))
    st().createOption('Geteilt')
    st().setCoverage('KG_500', 'included')
    st().toggleRisiko('RISK-STATIK')
    st().toggleRegionalfaktor()
    st().setDiscount(new Decimal('3.5'))
    st().confirmEnergiestandardAnswer()
    const activeTotal = st().projection().result.total.exact.toFixed()
    const activeUncertainty = st().projection().uncertaintyPp
    const storedTotal = projectionForOption(st(), 'OPT-01')!.result.total.exact.toFixed()
    st().saveNote('must never leave the private session')
    st().sendOffer('email')

    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    expect(raw).not.toContain('"journal"')
    expect(raw).not.toContain('"snapshots"')
    expect(raw).not.toContain('"noteText"')
    expect(raw).not.toContain('"fields"')
    expect(raw).not.toContain('must never leave the private session')

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(proposalStorageKey('DEMO-0001'), raw)
    expect(hydrateProposalState(restoredStorage)).toBe(true)

    expect(st().journal).toHaveLength(1)
    expect(st().journal[0]!.kind).toBe('state.restored')
    expect(st().journal[0]!.label).toBe('Angebotsstand wiederhergestellt')
    expect(st().snapshots).toEqual([])
    expect(st().noteText).toBe('')
    expect(st().options.map((option) => option.name)).toEqual(['Hausweise', 'Geteilt'])
    expect(st().activeOptionId).toBe('OPT-02')
    expect(wflConflict(st()).state).toBe('resolved')
    expect(st().projection().result.total.exact.toFixed()).toBe(activeTotal)
    expect(st().projection().uncertaintyPp).toBe(activeUncertainty)
    expect(st().coverage.KG_500).toBe('included')
    expect(st().risikoAktiv['RISK-STATIK']).toBe(true)
    expect(st().regionalfaktorActive).toBe(true)
    expect(st().discountPercent!.toFixed()).toBe('3.5')

    st().openOption('OPT-01')
    const restored = st().buildingReviews['DEMO-B-A']!.facts.bgfRAbove.override!.value
    expect(Decimal.isDecimal(restored)).toBe(true)
    expect(restored.toFixed()).toBe('2100.123456789')
    expect(st().kg300['DEMO-B-A']!.fassade).toBe('klinker')
    expect(st().kg700Mode).toBe('hoaiAho')
    expect(st().discountPercent!.toFixed()).toBe('2.5')
    expect(st().projection().result.total.exact.toFixed()).toBe(storedTotal)
  })

  it('does not persist a derived conflict after its source disagreement is removed', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().setBuildingFactOverride('DEMO-B-A', 'bgfRSAbove', new Decimal('2100'))
    expect(storage.getItem(proposalStorageKey('DEMO-0001')))
      .toContain('DERIVED:DEMO-B-A:bgfRSAbove')

    st().clearBuildingFactOverride('DEMO-B-A', 'bgfRSAbove')
    expect(storage.getItem(proposalStorageKey('DEMO-0001')))
      .not.toContain('DERIVED:DEMO-B-A:bgfRSAbove')
  })

  it('rejects a schema-invalid payload without partially hydrating it', () => {
    const storage = new MemoryStorage()
    const key = proposalStorageKey('DEMO-0001')
    storage.setItem(key, serializeProposalPayload('DEMO-0001', {
      active: { included: { 'DEMO-B-A': false } },
    }))

    expect(hydrateProposalState(storage)).toBe(false)
    expect(storage.getItem(key)).toBeNull()
    expect(useStore.getState().journal).toEqual([])
    expect(useStore.getState().projection().result.total.exact.toFixed(2))
      .toBe('3817835.00')
  })

  it.each(['wfl', 'units'] as const)(
    'discards a payload whose Haus A %s cannot feed the legacy projection',
    (factKey) => {
      const sourceStorage = new MemoryStorage()
      initializeProposalPersistence(sourceStorage)
      useStore.getState().setDiscount(new Decimal('1'))
      const key = proposalStorageKey('DEMO-0001')
      const raw = sourceStorage.getItem(key)
      expect(raw).not.toBeNull()

      const envelope = JSON.parse(raw!) as {
        payload: {
          active: {
            buildingReviews: Record<string, {
              facts: Record<string, {
                extracted: { value: unknown }
                override: unknown
              }>
            }>
          }
        }
      }
      const fact = envelope.payload.active
        .buildingReviews['DEMO-B-A']!.facts[factKey]!
      fact.extracted.value = null
      fact.override = null

      __resetStoreForTests()
      const restoredStorage = new MemoryStorage()
      restoredStorage.setItem(key, JSON.stringify(envelope))

      let restored: boolean | undefined
      expect(() => {
        restored = hydrateProposalState(restoredStorage)
      }).not.toThrow()
      expect(restored).toBe(false)
      expect(restoredStorage.getItem(key)).toBeNull()
      expect(useStore.getState().journal).toEqual([])
      expect(useStore.getState().fields.wfl.value.toFixed()).toBe('1500')
      expect(useStore.getState().projection().result.total.exact.toFixed(2))
        .toBe('3817835.00')
    },
  )

  it('does not emit state.restored when no payload exists', () => {
    expect(hydrateProposalState(new MemoryStorage())).toBe(false)
    expect(useStore.getState().journal).toEqual([])
  })
})
