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
import { CONFIGURATOR_STEP } from '../chapters'

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

  it('persists journalled building-section confirmations across reload', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().confirmBuildingSection('DEMO-B-A', 'identity', 'identity:fingerprint')
    expect(st().journal.at(-1)?.kind).toBe('value.confirmed')
    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    expect(raw).toContain('identity:fingerprint')

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(proposalStorageKey('DEMO-0001'), raw)
    expect(hydrateProposalState(restoredStorage)).toBe(true)
    expect(st().buildingSectionConfirmations['DEMO-B-A']?.identity?.fingerprint)
      .toBe('identity:fingerprint')
  })

  it('restores the complete proposal slice with one event, a sent snapshot (VR2-08, M-3), and no private/session data otherwise', () => {
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
    const sentSnapshot = st().sendOffer('email')

    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    expect(raw).not.toContain('"journal"')
    expect(raw).not.toContain('"noteText"')
    expect(raw).not.toContain('"fields"')
    expect(raw).not.toContain('must never leave the private session')
    // VR2-08 (M-3, SNAPSHOT BINDING): unlike `journal`/notes above, a sent
    // snapshot is not private session scratch — it is the immutable record
    // of what the client actually received, and the ordinary portfolio
    // route must be able to re-show it after a genuine browser reload, not
    // only within the same in-memory session. It DOES now appear in the
    // persisted payload, deliberately.
    expect(raw).toContain('"snapshots"')
    expect(raw).toContain(sentSnapshot.id)
    // F-07 (deep-coherence audit 2026-08-22): the Opportunity-level gate flag
    // must persist with the same rigor as the conflict decision below —
    // previously absent from this payload entirely, it reverted silently on
    // reload while `buildingConflicts` survived.
    expect(raw).toContain('"projectParamsConfirmed":true')

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(proposalStorageKey('DEMO-0001'), raw)
    expect(hydrateProposalState(restoredStorage)).toBe(true)

    expect(st().journal).toHaveLength(1)
    expect(st().journal[0]!.kind).toBe('state.restored')
    expect(st().journal[0]!.label).toBe('Angebotsstand wiederhergestellt')
    // VR2-08 (M-3): the sent snapshot itself survives, frozen, byte-for-byte
    // (a real reload is a structured-clone round trip, not a memory alias —
    // `Object.isFrozen` proves `hydrateProposalState` re-freezes rather than
    // merely trusting the deserialised, inherently-mutable JSON objects).
    expect(st().snapshots).toHaveLength(1)
    expect(st().snapshots[0]).toEqual(sentSnapshot)
    expect(Object.isFrozen(st().snapshots)).toBe(true)
    expect(Object.isFrozen(st().snapshots[0])).toBe(true)
    expect(st().noteText).toBe('')
    expect(st().options.map((option) => option.name)).toEqual(['Hausweise', 'Geteilt'])
    expect(st().activeOptionId).toBe('OPT-02')
    expect(wflConflict(st()).state).toBe('resolved')
    expect(st().projectParamsConfirmed).toBe(true)
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

  it('persists explicit mode consent, pricing entry and per-scope progress', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Mode persistence')
    st().confirmBuilding('DEMO-B-A')
    expect(st().pricingStarted).toBe(false)
    st().confirmConfigurationMode('PER_BUILDING')
    // "Konfiguration starten" enters Scope Boundaries (chapter 1) in the
    // very same transition that confirms the mode — pricing begins right
    // here, not from the earlier mode radio choice on its own.
    expect(st().pricingStarted).toBe(true)
    st().setCoverage('KG_400', 'included')
    st().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_400_DETAILS)
    expect(st().pricingStarted).toBe(true)

    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    expect(raw).toContain('"configurationModeChosen":true')
    expect(raw).toContain('"pricingStarted":true')
    expect(raw).toContain(`"${CONFIGURATOR_STEP.KG_400_DETAILS}"`)

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(proposalStorageKey('DEMO-0001'), raw)
    expect(hydrateProposalState(restoredStorage)).toBe(true)
    expect(st().configurationModeChosen).toBe(true)
    expect(st().configurationMode).toBe('PER_BUILDING')
    expect(st().pricingStarted).toBe(true)
    // Leistungsabgrenzung (chapter 1) is project-level, not building-scoped
    // — confirmConfigurationMode no longer records it into this per-building
    // list; only the explicit chapter-3 visit does.
    expect(st().configurationVisitedChapters['DEMO-B-A'])
      .toEqual([CONFIGURATOR_STEP.KG_400_DETAILS])

    // Payloads written before semantic step identities stored chapter 3 for
    // the same KG-400 progress. Restore migrates it without keeping numeric
    // authority in live state.
    const legacyRaw = raw.replace(`"${CONFIGURATOR_STEP.KG_400_DETAILS}"`, '3')
    __resetStoreForTests()
    const legacyStorage = new MemoryStorage()
    legacyStorage.setItem(proposalStorageKey('DEMO-0001'), legacyRaw)
    expect(hydrateProposalState(legacyStorage)).toBe(true)
    expect(st().configurationVisitedChapters['DEMO-B-A'])
      .toEqual([CONFIGURATOR_STEP.KG_400_DETAILS])
  })

  it('persists and restores the included core scope decisions', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().setCoverage('KG_200', 'excluded')
    st().setCoverage('KG_500', 'excluded')
    st().setCoverage('KG_600', 'excluded')
    st().confirmGebaeudeklasse()

    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    expect(raw).toContain('"KG_300":"included"')
    expect(raw).toContain('"KG_400":"included"')
    expect(raw).toContain('"KG_700":"included"')

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(proposalStorageKey('DEMO-0001'), raw)
    expect(hydrateProposalState(restoredStorage)).toBe(true)

    expect(st().coverage.KG_300).toBe('included')
    expect(st().coverage.KG_400).toBe('included')
    expect(st().coverage.KG_700).toBe('included')
    expect(st().projection().result.incompleteReasons
      .some((reason) => reason.code === 'coverageUnknown')).toBe(false)
    expect(st().projection().result.completeness).toBe('complete')
    expect(st().projection().result.totalLabel).toBe('Gesamt netto · Grundleistung All3')
  })

  it('migrates legacy `unknown`/`notApplicable` coverage to the binary contract on load (CPO decision, 22.08.2026 — AC-21)', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()
    st().confirmGebaeudeklasse()

    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    // Simulate a payload saved before this ticket: KG 200/500/600 still
    // `unknown` (the retired D-18/D-29 default), KG 800 still `notApplicable`
    // (it was not yet a decidable group).
    const legacyRaw = raw
      .replace('"KG_200":"excluded"', '"KG_200":"unknown"')
      .replace('"KG_500":"excluded"', '"KG_500":"unknown"')
      .replace('"KG_600":"excluded"', '"KG_600":"unknown"')
      .replace('"KG_800":"excluded"', '"KG_800":"notApplicable"')
    expect(legacyRaw).not.toBe(raw)

    __resetStoreForTests()
    const legacyStorage = new MemoryStorage()
    legacyStorage.setItem(proposalStorageKey('DEMO-0001'), legacyRaw)
    expect(hydrateProposalState(legacyStorage)).toBe(true)

    // No third state is ever resurrected — every legacy gap lands on the
    // current binary default (`excluded`), never silently on `included`.
    expect(st().coverage.KG_200).toBe('excluded')
    expect(st().coverage.KG_500).toBe('excluded')
    expect(st().coverage.KG_600).toBe('excluded')
    expect(st().coverage.KG_800).toBe('excluded')
    expect(st().projection().result.incompleteReasons
      .some((reason) => reason.code === 'coverageUnknown')).toBe(false)
    expect(st().projection().result.completeness).toBe('complete')
  })

  it('reverts a legacy `kg700ModeAutoFallback:true` payload to `vereinfacht` on load, not stuck in `hoaiAho` (Tech Lead rework, ticket #16)', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()
    st().confirmGebaeudeklasse()

    const key = proposalStorageKey('DEMO-0001')
    const envelope = JSON.parse(storage.getItem(key)!) as {
      payload: {
        active: {
          coverage: Record<string, string>
          kg700Mode: string
          kg700ModeAutoFallback?: boolean
        }
      }
    }
    // Simulate a payload saved before this ticket, when KG 300 could still
    // be excluded through `setCoverage` and D-07 rule 6's now-deleted
    // runtime branch had auto-switched the project to `hoaiAho`.
    envelope.payload.active.coverage.KG_300 = 'excluded'
    envelope.payload.active.kg700Mode = 'hoaiAho'
    envelope.payload.active.kg700ModeAutoFallback = true

    __resetStoreForTests()
    const legacyStorage = new MemoryStorage()
    legacyStorage.setItem(key, JSON.stringify(envelope))
    expect(hydrateProposalState(legacyStorage)).toBe(true)

    // KG 300 is mandatory now (migrateCoverage) — the very condition the
    // deleted runtime revert branch required before switching back.
    expect(st().coverage.KG_300).toBe('included')
    // The stale auto-fallback flag must not leave the project stuck
    // computing KG 700 via `hoaiAho` forever with no way to self-correct.
    expect(st().kg700Mode).toBe('vereinfacht')
    expect(st().kg700ModeAutoFallback).toBe(false)
  })

  it('leaves a deliberately chosen `hoaiAho` (no auto-fallback) untouched on load', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()
    st().confirmGebaeudeklasse()
    st().setKg700Mode('hoaiAho')

    const raw = storage.getItem(proposalStorageKey('DEMO-0001'))!
    expect(raw).toContain('"kg700Mode":"hoaiAho"')

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(proposalStorageKey('DEMO-0001'), raw)
    expect(hydrateProposalState(restoredStorage)).toBe(true)
    expect(st().kg700Mode).toBe('hoaiAho')
    expect(st().kg700ModeAutoFallback).toBe(false)
  })

  it('defaults pre-boundary candidate payloads to pricing not started', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Legacy boundary')
    st().confirmBuilding('DEMO-B-A')
    st().confirmConfigurationMode('PER_BUILDING')

    const key = proposalStorageKey('DEMO-0001')
    const envelope = JSON.parse(storage.getItem(key)!) as {
      payload: { active: { pricingStarted?: boolean } }
    }
    delete envelope.payload.active.pricingStarted

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(key, JSON.stringify(envelope))
    expect(hydrateProposalState(restoredStorage)).toBe(true)
    expect(st().configurationModeChosen).toBe(true)
    expect(st().pricingStarted).toBe(false)
  })

  it('defaults a payload saved before F-07 (no projectParamsConfirmed key) to unconfirmed, not a rejected payload', () => {
    const storage = new MemoryStorage()
    initializeProposalPersistence(storage)
    const st = () => useStore.getState()

    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Pre-F-07 payload')

    const key = proposalStorageKey('DEMO-0001')
    const envelope = JSON.parse(storage.getItem(key)!) as {
      payload: { projectParamsConfirmed?: boolean }
    }
    expect(envelope.payload.projectParamsConfirmed).toBe(true)
    delete envelope.payload.projectParamsConfirmed

    __resetStoreForTests()
    const restoredStorage = new MemoryStorage()
    restoredStorage.setItem(key, JSON.stringify(envelope))
    // An older payload predating this field must still restore — never be
    // discarded whole — and the gate reverts to the same conservative
    // default as a first-ever visit, not a crash or a silently-invented true.
    expect(hydrateProposalState(restoredStorage)).toBe(true)
    expect(st().projectParamsConfirmed).toBe(false)
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
