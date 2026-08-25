import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  appendConflictResolution,
  buildingFingerprint,
  deriveConflictState,
  derivedArea,
  effectiveDerivedArea,
  effectiveFactValue,
  fact,
  isBuildingConfirmed,
  isBuildingConflict,
  isManualFact,
  migrateStoreyStructureFactValue,
  toBuildingInput,
  withFactOverride,
  withoutFactOverride,
  type BuildingConflict,
  type BuildingReview,
} from '../buildingReview'

const documentSource = { kind: 'document', reference: 'fixture' } as const
const unknownSource = { kind: 'unknown', reference: null } as const

function review(): BuildingReview {
  return {
    id: 'B-A',
    facts: {
      documentationName: fact('Haus A', documentSource),
      address: fact<string>(null, unknownSource),
      buildingForm: fact('MFH', documentSource),
      buildingClass: fact('GK_5', documentSource),
      bgfRAbove: fact(new Decimal('100'), documentSource),
      bgfSAbove: fact(new Decimal('20'), documentSource),
      bgfRSAbove: fact(new Decimal('120'), documentSource),
      bgfRBelow: fact<Decimal>(null, unknownSource),
      bgfSBelow: fact<Decimal>(null, unknownSource),
      bgfRSBelow: fact(new Decimal('30'), documentSource),
      bgfRSTotal: fact(new Decimal('150'), documentSource),
      wfl: fact(new Decimal('80'), documentSource),
      nuf: fact<Decimal>(null, unknownSource),
      units: fact(new Decimal('4'), documentSource),
      storeyStructure: fact<Decimal>(null, unknownSource),
    },
    engine: {
      energyStandard: 'EH_55',
      undergroundScope: 'vollausbau',
      hasParking: false,
      buildingClassConfirmed: false,
    },
  }
}

describe('building review facts', () => {
  it('keeps unknown as null and never coerces it to zero', () => {
    expect(effectiveFactValue(review().facts.address)).toBeNull()
    expect(effectiveFactValue(review().facts.nuf)).toBeNull()
    expect(effectiveFactValue(review().facts.storeyStructure)).toBeNull()
  })

  it('keeps extracted provenance reachable through an override and restores it', () => {
    const original = review()
    const edited = withFactOverride(
      original, 'wfl', new Decimal('82.5'), 'sales-user', '2026-08-13T12:00:00Z',
    )
    expect(isManualFact(edited.facts.wfl)).toBe(true)
    expect(effectiveFactValue(edited.facts.wfl)!.toFixed()).toBe('82.5')
    expect(edited.facts.wfl.extracted.value!.toFixed()).toBe('80')
    expect(edited.facts.wfl.extracted.source).toEqual(documentSource)

    const restored = withoutFactOverride(edited, 'wfl')
    expect(isManualFact(restored.facts.wfl)).toBe(false)
    expect(effectiveFactValue(restored.facts.wfl)!.toFixed()).toBe('80')
  })

  it('holds a single storey count (#16 Part 8) — no per-kind UG/EG/OG/SG breakdown any more', () => {
    const edited = withFactOverride(
      review(), 'storeyStructure', new Decimal('6'), 'sales-user', '2026-08-13T12:00:00Z',
    )
    expect(effectiveFactValue(edited.facts.storeyStructure)!.toFixed()).toBe('6')
  })
})

describe('storeyStructure legacy migration (#16 Part 8)', () => {
  it('passes null and an already-migrated Decimal through unchanged', () => {
    expect(migrateStoreyStructureFactValue(null)).toBeNull()
    const value = new Decimal('4')
    expect(migrateStoreyStructureFactValue(value)).toBe(value)
  })

  it('sums a legacy per-kind UG/EG/OG/SG breakdown into one total, losslessly', () => {
    // Design cycle-2's own reproduction example (UG=1, EG=4, OG=2, SG=1 -> 8).
    const legacy = {
      levels: [
        { kind: 'UG', count: 1 },
        { kind: 'EG', count: 4 },
        { kind: 'OG', count: 2 },
        { kind: 'SG', count: 1 },
      ],
      context: 'UG + 4 EG + 2 OG + SG',
    }
    const migrated = migrateStoreyStructureFactValue(legacy)
    expect(migrated).not.toBeNull()
    expect(migrated!.toFixed()).toBe('8')
  })

  it('does not throw and returns null for unrecognisable input', () => {
    expect(migrateStoreyStructureFactValue('garbage')).toBeNull()
    expect(migrateStoreyStructureFactValue({ nonsense: true })).toBeNull()
    expect(migrateStoreyStructureFactValue(undefined)).toBeNull()
  })
})

describe('derived BGF R+S', () => {
  it('sums known components exactly in Decimal', () => {
    const state = derivedArea(review(), 'bgfRSAbove')
    expect(state.basis).toBe('components')
    expect(state.value!.toFixed()).toBe('120')
    expect(state.conflict).toBeNull()
  })

  it('uses an independently extracted total without inventing an unknown component', () => {
    const state = derivedArea(review(), 'bgfRSBelow')
    expect(state.basis).toBe('extracted')
    expect(state.value!.toFixed()).toBe('30')
    expect(effectiveFactValue(review().facts.bgfRBelow)).toBeNull()
    expect(effectiveFactValue(review().facts.bgfSBelow)).toBeNull()
  })

  it('raises a conflict instead of choosing between a total and component sum', () => {
    const mismatched = withFactOverride(
      review(), 'bgfRSAbove', new Decimal('125'), 'sales-user', '2026-08-13T12:00:00Z',
    )
    const state = derivedArea(mismatched, 'bgfRSAbove')
    expect(state.basis).toBe('conflict')
    expect(state.value).toBeNull()
    expect(state.conflict?.candidates.map((candidate) => candidate.value))
      .toEqual(['120', '125'])
  })

  it('uses only the explicitly selected candidate after resolution', () => {
    const mismatched = withFactOverride(
      review(), 'bgfRSAbove', new Decimal('125'), 'sales-user', '2026-08-13T12:00:00Z',
    )
    const detected = derivedArea(mismatched, 'bgfRSAbove').conflict!
    const conflict = appendConflictResolution({ ...detected, resolutions: [] }, {
      sequenceNumber: 1,
      decision: 'selectCandidate',
      selectedCandidateId: detected.candidates[1]!.id,
      actor: 'sales-user',
      at: '2026-08-13T12:01:00Z',
      reason: 'reviewed',
    })
    const state = effectiveDerivedArea(
      mismatched, { [conflict.id]: conflict }, 'bgfRSAbove',
    )
    expect(state.basis).toBe('resolved')
    expect(state.value!.toFixed()).toBe('125')
  })
})

describe('append-only conflicts and value-bound confirmation', () => {
  let conflict: BuildingConflict

  beforeEach(() => {
    conflict = {
      id: 'C-1', buildingId: 'B-A', factKey: 'wfl',
      candidates: [
        {
          id: 'document', origin: 'document', value: '80', source: documentSource,
        },
        {
          id: 'customer', origin: 'customer', value: '82',
          source: { kind: 'customer', reference: 'meeting' },
        },
      ],
      resolutions: [],
    }
  })

  it('derives current state from the highest sequence and defer remains open', () => {
    conflict = appendConflictResolution(conflict, {
      sequenceNumber: 1, decision: 'selectCandidate', selectedCandidateId: 'document',
      actor: 'sales-user', at: '2026-08-13T12:00:00Z', reason: 'reviewed',
    })
    conflict = appendConflictResolution(conflict, {
      sequenceNumber: 2, decision: 'defer', selectedCandidateId: null,
      actor: 'sales-user', at: '2026-08-13T12:01:00Z', reason: 'undo',
    })
    expect(conflict.resolutions).toHaveLength(2)
    expect(deriveConflictState(conflict)).toMatchObject({
      status: 'open', selectedCandidateId: null,
    })
  })

  it('rejects persisted conflict histories that could not be appended', () => {
    expect(isBuildingConflict({
      ...conflict,
      resolutions: [{
        sequenceNumber: 1,
        decision: 'selectCandidate',
        selectedCandidateId: 'missing',
        actor: 'sales-user',
        at: '2026-08-13T12:00:00Z',
        reason: 'invalid candidate',
      }],
    })).toBe(false)

    expect(isBuildingConflict({
      ...conflict,
      resolutions: [
        {
          sequenceNumber: 2,
          decision: 'selectCandidate',
          selectedCandidateId: 'document',
          actor: 'sales-user',
          at: '2026-08-13T12:00:00Z',
          reason: 'valid candidate',
        },
        {
          sequenceNumber: 1,
          decision: 'defer',
          selectedCandidateId: null,
          actor: 'sales-user',
          at: '2026-08-13T12:01:00Z',
          reason: 'out of order',
        },
      ],
    })).toBe(false)
  })

  it('binds confirmation to facts and conflict state', () => {
    const original = review()
    const registry = { [conflict.id]: conflict }
    const confirmation = {
      fingerprint: buildingFingerprint(original, registry),
      at: '2026-08-13T12:00:00Z',
    }
    expect(isBuildingConfirmed(original, confirmation, registry)).toBe(true)

    const edited = withFactOverride(
      original, 'buildingForm', 'BUERO', 'sales-user', '2026-08-13T12:01:00Z',
    )
    expect(isBuildingConfirmed(edited, confirmation, registry)).toBe(false)

    const resolved = appendConflictResolution(conflict, {
      sequenceNumber: 1, decision: 'selectCandidate', selectedCandidateId: 'customer',
      actor: 'sales-user', at: '2026-08-13T12:02:00Z', reason: 'confirmed',
    })
    expect(isBuildingConfirmed(original, confirmation, { [resolved.id]: resolved })).toBe(false)
  })
})

describe('pricing adapter', () => {
  it('maps reviewed engine facts without leaking null review-only values', () => {
    const input = toBuildingInput(review())!
    expect(input).toMatchObject({
      id: 'B-A', stableName: 'Haus A', address: null,
      gebaeudeform: 'MFH', bgfBelowGround: new Decimal('30'),
      nuf: null, storeyStructure: null,
    })
  })
})
