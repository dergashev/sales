import { Decimal } from 'decimal.js'
import type { BuildingInput } from '../engine/calculate'

/** Where the extracted side of a reviewed fact came from. */
export type FactSource =
  | { kind: 'document'; reference: string }
  | { kind: 'customer'; reference: string }
  | { kind: 'derived'; reference: string }
  | { kind: 'unknown'; reference: null }

export type BuildingFact<T> = {
  extracted: { value: T | null; source: FactSource }
  override: { value: T; at: string; actor: string } | null
}

export type StoreyKind = 'UG' | 'EG' | 'OG' | 'SG'

/**
 * Semantic floors are explicit, so `UG + EG + 3 OG + SG` can be preserved
 * without pretending that an undifferentiated floor count proves the split.
 */
export type StoreyStructure = {
  levels: Array<{ kind: StoreyKind; count: number }>
  context: string | null
}

export type BuildingFactValueMap = {
  documentationName: string
  address: string
  buildingForm: BuildingInput['gebaeudeform']
  buildingClass: BuildingInput['gebaeudeklasse']['value']
  bgfRAbove: Decimal
  bgfSAbove: Decimal
  /** Independently extracted aggregate, checked against R + S. */
  bgfRSAbove: Decimal
  bgfRBelow: Decimal
  bgfSBelow: Decimal
  /** Independently extracted aggregate, checked against R + S. */
  bgfRSBelow: Decimal
  /** Independently extracted total above + below ground. */
  bgfRSTotal: Decimal
  wfl: Decimal
  nuf: Decimal
  units: Decimal
  storeyStructure: StoreyStructure
}

export const BUILDING_FACT_KEYS = [
  'documentationName', 'address', 'buildingForm', 'buildingClass',
  'bgfRAbove', 'bgfSAbove', 'bgfRSAbove',
  'bgfRBelow', 'bgfSBelow', 'bgfRSBelow', 'bgfRSTotal',
  'wfl', 'nuf', 'units', 'storeyStructure',
] as const satisfies ReadonlyArray<keyof BuildingFactValueMap>

export type BuildingFactKey = typeof BUILDING_FACT_KEYS[number]

export type BuildingReview = {
  id: string
  facts: { [K in BuildingFactKey]: BuildingFact<BuildingFactValueMap[K]> }
  /** Existing calculation inputs that are not review fields in this slice. */
  engine: {
    energyStandard: BuildingInput['energiestandard']
    undergroundScope: BuildingInput['untergeschoss']
    hasParking: boolean
    buildingClassConfirmed: boolean
  }
}

export type ReviewedBuildingInput = BuildingInput & {
  stableName: string
  address: string | null
  wfl: Decimal | null
  nuf: Decimal | null
  units: Decimal | null
  storeyStructure: StoreyStructure | null
}

export type BuildingConflictCandidate = {
  id: string
  origin: 'document' | 'customer' | 'derived' | 'manual'
  /** Canonical value; Decimal values use their unrounded decimal string. */
  value: string
  source: FactSource
}

export type ConflictResolution = {
  sequenceNumber: number
  decision: 'selectCandidate' | 'captureNewValue' | 'defer'
  selectedCandidateId: string | null
  actor: string
  at: string
  reason: string
}

export type BuildingConflict = {
  id: string
  buildingId: string
  factKey: BuildingFactKey | DerivedAreaKey
  candidates: BuildingConflictCandidate[]
  /** Decisions are immutable history; current state is derived from max seq. */
  resolutions: ConflictResolution[]
}

export type BuildingConflictState = {
  status: 'open' | 'resolved'
  selectedCandidateId: string | null
  latestResolution: ConflictResolution | null
}

export type DerivedAreaKey = 'bgfRSAbove' | 'bgfRSBelow' | 'bgfRSTotal'

export type DerivedAreaConflict = {
  id: string
  buildingId: string
  factKey: DerivedAreaKey
  candidates: BuildingConflictCandidate[]
}

export type DerivedAreaState = {
  value: Decimal | null
  basis: 'components' | 'extracted' | 'unknown' | 'conflict' | 'resolved'
  conflict: DerivedAreaConflict | null
}

export function fact<T>(value: T | null, source: FactSource): BuildingFact<T> {
  return { extracted: { value, source }, override: null }
}

export function effectiveFactValue<T>(value: BuildingFact<T>): T | null {
  return value.override?.value ?? value.extracted.value
}

export function isManualFact<T>(value: BuildingFact<T>): boolean {
  return value.override !== null
}

export function withFactOverride<K extends BuildingFactKey>(
  review: BuildingReview,
  key: K,
  value: BuildingFactValueMap[K],
  actor: string,
  at: string,
): BuildingReview {
  return {
    ...review,
    facts: {
      ...review.facts,
      [key]: { ...review.facts[key], override: { value, actor, at } },
    },
  } as BuildingReview
}

export function withoutFactOverride<K extends BuildingFactKey>(
  review: BuildingReview,
  key: K,
): BuildingReview {
  return {
    ...review,
    facts: {
      ...review.facts,
      [key]: { ...review.facts[key], override: null },
    },
  } as BuildingReview
}

export function withEngineState(
  review: BuildingReview,
  patch: Partial<BuildingReview['engine']>,
): BuildingReview {
  return { ...review, engine: { ...review.engine, ...patch } }
}

function candidateOrigin(source: FactSource): BuildingConflictCandidate['origin'] {
  return source.kind === 'unknown' ? 'derived' : source.kind
}

function canonicalDecimal(value: Decimal): string {
  return value.toFixed()
}

function derivedCandidate(
  buildingId: string,
  key: DerivedAreaKey,
  value: Decimal,
): BuildingConflictCandidate {
  const canonical = canonicalDecimal(value)
  return {
    id: `${buildingId}:${key}:components:${canonical}`,
    origin: 'derived',
    value: canonical,
    source: { kind: 'derived', reference: 'BGF R + BGF S' },
  }
}

function extractedCandidate(
  buildingId: string,
  key: DerivedAreaKey,
  aggregate: BuildingFact<Decimal>,
  value: Decimal,
): BuildingConflictCandidate {
  const canonical = canonicalDecimal(value)
  const manual = aggregate.override !== null
  return {
    id: `${buildingId}:${key}:${manual ? 'manual' : 'extracted'}:${canonical}`,
    origin: manual ? 'manual' : candidateOrigin(aggregate.extracted.source),
    value: canonical,
    source: manual
      ? { kind: 'derived', reference: `manuelle Korrektur durch ${aggregate.override!.actor}` }
      : aggregate.extracted.source,
  }
}

function derivePair(
  buildingId: string,
  key: DerivedAreaKey,
  r: Decimal | null,
  s: Decimal | null,
  aggregate: BuildingFact<Decimal>,
): DerivedAreaState {
  const extracted = effectiveFactValue(aggregate)
  if (r !== null && s !== null) {
    const sum = r.plus(s)
    if (extracted !== null && !sum.equals(extracted)) {
      return {
        value: null,
        basis: 'conflict',
        conflict: {
          id: `DERIVED:${buildingId}:${key}`,
          buildingId,
          factKey: key,
          candidates: [
            derivedCandidate(buildingId, key, sum),
            extractedCandidate(buildingId, key, aggregate, extracted),
          ],
        },
      }
    }
    return { value: sum, basis: 'components', conflict: null }
  }
  if (extracted !== null) {
    return { value: extracted, basis: 'extracted', conflict: null }
  }
  return { value: null, basis: 'unknown', conflict: null }
}

export function derivedArea(
  review: BuildingReview,
  key: DerivedAreaKey,
): DerivedAreaState {
  if (key === 'bgfRSAbove') {
    return derivePair(
      review.id,
      key,
      effectiveFactValue(review.facts.bgfRAbove),
      effectiveFactValue(review.facts.bgfSAbove),
      review.facts.bgfRSAbove,
    )
  }
  if (key === 'bgfRSBelow') {
    return derivePair(
      review.id,
      key,
      effectiveFactValue(review.facts.bgfRBelow),
      effectiveFactValue(review.facts.bgfSBelow),
      review.facts.bgfRSBelow,
    )
  }

  const above = derivedArea(review, 'bgfRSAbove')
  const below = derivedArea(review, 'bgfRSBelow')
  return derivePair(
    review.id,
    key,
    above.value,
    below.value,
    review.facts.bgfRSTotal,
  )
}

export function derivedAreaConflicts(review: BuildingReview): DerivedAreaConflict[] {
  return (['bgfRSAbove', 'bgfRSBelow', 'bgfRSTotal'] as const)
    .flatMap((key) => {
      const conflict = derivedArea(review, key).conflict
      return conflict ? [conflict] : []
    })
}

/** A conflict stays visible after resolution, while its chosen value becomes usable. */
export function effectiveDerivedArea(
  review: BuildingReview,
  conflicts: Record<string, BuildingConflict>,
  key: DerivedAreaKey,
): DerivedAreaState {
  const derived = derivedArea(review, key)
  if (!derived.conflict) return derived
  const conflict = conflicts[derived.conflict.id]
  if (!conflict) return derived
  const state = deriveConflictState(conflict)
  const candidate = conflict.candidates.find(
    (item) => item.id === state.selectedCandidateId,
  )
  if (!candidate) return derived
  try {
    return {
      value: new Decimal(candidate.value),
      basis: 'resolved',
      conflict: derived.conflict,
    }
  } catch {
    return derived
  }
}

export function synchronizeDerivedConflicts(
  registry: Record<string, BuildingConflict>,
  review: BuildingReview,
): Record<string, BuildingConflict> {
  const current = derivedAreaConflicts(review)
  const currentIds = new Set(current.map((conflict) => conflict.id))
  const derivedPrefix = `DERIVED:${review.id}:`
  let next = registry

  for (const id of Object.keys(registry)) {
    if (id.startsWith(derivedPrefix) && !currentIds.has(id)) {
      if (next === registry) next = { ...registry }
      delete next[id]
    }
  }

  for (const conflict of current) {
    const previous = next[conflict.id]
    if (next === registry) next = { ...registry }
    next[conflict.id] = {
      ...conflict,
      resolutions: previous?.resolutions ?? [],
    }
  }
  return next
}

export function deriveConflictState(conflict: BuildingConflict): BuildingConflictState {
  const latest = conflict.resolutions.reduce<ConflictResolution | null>(
    (current, item) => !current || item.sequenceNumber > current.sequenceNumber
      ? item : current,
    null,
  )
  if (!latest || latest.decision === 'defer' || latest.selectedCandidateId === null) {
    return { status: 'open', selectedCandidateId: null, latestResolution: latest }
  }
  const candidateExists = conflict.candidates.some(
    (candidate) => candidate.id === latest.selectedCandidateId,
  )
  return candidateExists
    ? {
        status: 'resolved',
        selectedCandidateId: latest.selectedCandidateId,
        latestResolution: latest,
      }
    : { status: 'open', selectedCandidateId: null, latestResolution: latest }
}

export function appendConflictResolution(
  conflict: BuildingConflict,
  resolution: ConflictResolution,
): BuildingConflict {
  const maxSequence = conflict.resolutions.reduce(
    (max, item) => Math.max(max, item.sequenceNumber),
    0,
  )
  if (resolution.sequenceNumber <= maxSequence) {
    throw new Error('conflict resolution sequence must be strictly increasing')
  }
  if (resolution.decision === 'defer' && resolution.selectedCandidateId !== null) {
    throw new Error('defer cannot select a conflict candidate')
  }
  if (resolution.decision !== 'defer') {
    const selected = conflict.candidates.some(
      (candidate) => candidate.id === resolution.selectedCandidateId,
    )
    if (!selected) throw new Error('conflict resolution must select an existing candidate')
  }
  return { ...conflict, resolutions: [...conflict.resolutions, resolution] }
}

function canonicalValue(value: unknown): unknown {
  if (Decimal.isDecimal(value)) return { decimal: value.toFixed() }
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalValue(item)]),
    )
  }
  return value
}

export function buildingFingerprint(
  review: BuildingReview,
  conflicts: Record<string, BuildingConflict>,
): string {
  const facts = BUILDING_FACT_KEYS.map((key) => {
    const item = review.facts[key]
    const value: unknown = item.override?.value ?? item.extracted.value
    return [
      key,
      canonicalValue(value),
      item.override ? 'manual' : item.extracted.source.kind,
    ]
  })
  const derived = (['bgfRSAbove', 'bgfRSBelow', 'bgfRSTotal'] as const)
    .map((key) => {
      const state = effectiveDerivedArea(review, conflicts, key)
      return [key, state.basis, canonicalValue(state.value)]
    })
  const conflictState = Object.values(conflicts)
    .filter((conflict) => conflict.buildingId === review.id)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((conflict) => {
      const state = deriveConflictState(conflict)
      return [
        conflict.id,
        state.status,
        state.selectedCandidateId,
        state.latestResolution?.sequenceNumber ?? null,
      ]
    })
  return JSON.stringify({
    id: review.id,
    facts,
    engine: canonicalValue(review.engine),
    derived,
    conflicts: conflictState,
  })
}

export type BuildingConfirmation = { fingerprint: string; at: string }

export function isBuildingConfirmed(
  review: BuildingReview | undefined,
  confirmation: BuildingConfirmation | undefined,
  conflicts: Record<string, BuildingConflict>,
): boolean {
  return review !== undefined
    && confirmation !== undefined
    && confirmation.fingerprint === buildingFingerprint(review, conflicts)
}

/**
 * Adapter for the existing pricing boundary. The engine type remains
 * untouched; reviewed facts are copied into its existing input atomically.
 */
export function toBuildingInput(review: BuildingReview): ReviewedBuildingInput | null {
  const stableName = effectiveFactValue(review.facts.documentationName)
  const buildingForm = effectiveFactValue(review.facts.buildingForm)
  const buildingClass = effectiveFactValue(review.facts.buildingClass)
  const bgfRAbove = effectiveFactValue(review.facts.bgfRAbove)
  const bgfSAbove = effectiveFactValue(review.facts.bgfSAbove)
  const bgfBelowGround = effectiveFactValue(review.facts.bgfRSBelow)
  if (
    stableName === null || buildingForm === null || buildingClass === null
    || bgfRAbove === null || bgfSAbove === null || bgfBelowGround === null
  ) return null

  return {
    id: review.id,
    stableName,
    address: effectiveFactValue(review.facts.address),
    wfl: effectiveFactValue(review.facts.wfl),
    nuf: effectiveFactValue(review.facts.nuf),
    units: effectiveFactValue(review.facts.units),
    storeyStructure: effectiveFactValue(review.facts.storeyStructure),
    gebaeudeform: buildingForm,
    gebaeudeklasse: {
      value: buildingClass,
      confirmed: review.engine.buildingClassConfirmed,
    },
    energiestandard: review.engine.energyStandard,
    bgfRAbove,
    bgfSAbove,
    bgfBelowGround,
    untergeschoss: review.engine.undergroundScope,
    hasParking: review.engine.hasParking,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFactSource(value: unknown): value is FactSource {
  if (!isRecord(value)) return false
  if (value.kind === 'unknown') return value.reference === null
  return (value.kind === 'document' || value.kind === 'customer' || value.kind === 'derived')
    && typeof value.reference === 'string'
}

function isStoreyStructure(value: unknown): value is StoreyStructure {
  if (!isRecord(value) || !Array.isArray(value.levels)) return false
  if (value.context !== null && typeof value.context !== 'string') return false
  return value.levels.every((level) => isRecord(level)
    && (level.kind === 'UG' || level.kind === 'EG' || level.kind === 'OG' || level.kind === 'SG')
    && typeof level.count === 'number' && Number.isInteger(level.count) && level.count > 0)
}

function isFactValue(key: BuildingFactKey, value: unknown): boolean {
  if (value === null) return true
  switch (key) {
    case 'documentationName':
    case 'address':
      return typeof value === 'string'
    case 'buildingForm':
      return value === 'MFH' || value === 'EFH_ZFH' || value === 'DH_REH' || value === 'BUERO'
    case 'buildingClass':
      return value === 'GK_1_3' || value === 'GK_4' || value === 'GK_5'
    case 'storeyStructure':
      return isStoreyStructure(value)
    default:
      return Decimal.isDecimal(value)
  }
}

function isBuildingFact(key: BuildingFactKey, value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.extracted)) return false
  if (!isFactSource(value.extracted.source) || !isFactValue(key, value.extracted.value)) {
    return false
  }
  if (value.override === null) return true
  return isRecord(value.override)
    && isFactValue(key, value.override.value)
    && value.override.value !== null
    && typeof value.override.at === 'string'
    && typeof value.override.actor === 'string'
}

export function isBuildingReview(value: unknown): value is BuildingReview {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false
  }
  const facts = value.facts
  if (!isRecord(facts)
    || !BUILDING_FACT_KEYS.every((key) => isBuildingFact(key, facts[key]))) {
    return false
  }
  const engine = value.engine
  return isRecord(engine)
    && (engine.energyStandard === 'GEG'
      || engine.energyStandard === 'EH_55'
      || engine.energyStandard === 'EH_40')
    && (engine.undergroundScope === 'kein_ug'
      || engine.undergroundScope === 'ab_decke'
      || engine.undergroundScope === 'vollausbau')
    && typeof engine.hasParking === 'boolean'
    && typeof engine.buildingClassConfirmed === 'boolean'
}

export function isBuildingConflict(value: unknown): value is BuildingConflict {
  if (!isRecord(value) || typeof value.id !== 'string'
    || typeof value.buildingId !== 'string'
    || !BUILDING_FACT_KEYS.includes(value.factKey as BuildingFactKey)
      && value.factKey !== 'bgfRSAbove'
      && value.factKey !== 'bgfRSBelow'
      && value.factKey !== 'bgfRSTotal'
    || !Array.isArray(value.candidates)
    || !Array.isArray(value.resolutions)) return false

  const candidates = value.candidates.every((candidate) => isRecord(candidate)
    && typeof candidate.id === 'string'
    && (candidate.origin === 'document' || candidate.origin === 'customer'
      || candidate.origin === 'derived' || candidate.origin === 'manual')
    && typeof candidate.value === 'string'
    && isFactSource(candidate.source))
  if (!candidates) return false
  const candidateIds = value.candidates.map((candidate) => candidate.id)
  if (candidateIds.length === 0 || new Set(candidateIds).size !== candidateIds.length) {
    return false
  }

  let previousSequence = 0
  const resolutions = value.resolutions.every((resolution) => {
    if (!isRecord(resolution) || typeof resolution.sequenceNumber !== 'number') {
      return false
    }
    if (!Number.isInteger(resolution.sequenceNumber)
      || resolution.sequenceNumber <= previousSequence
      || resolution.decision !== 'selectCandidate'
        && resolution.decision !== 'captureNewValue'
        && resolution.decision !== 'defer'
      || typeof resolution.actor !== 'string'
      || typeof resolution.at !== 'string'
      || typeof resolution.reason !== 'string') return false

    const selected = resolution.selectedCandidateId
    if (resolution.decision === 'defer' ? selected !== null
      : typeof selected !== 'string' || !candidateIds.includes(selected)) return false
    previousSequence = resolution.sequenceNumber
    return true
  })
  return resolutions
}
