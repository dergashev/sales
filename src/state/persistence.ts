import { Decimal } from 'decimal.js'

/**
 * VR3-02 bumped this to 2; VR3-03 bumps it to 3.
 *
 * An Option saved before version 2 carries no building scope, and the
 * Konfigurator gate is that scope. An Option saved before version 3 carries
 * no KG configuration, and the configuration IS the offer: its six scope
 * decisions and every service decision under them are what price it. A
 * pre-3 payload therefore restores an Option that cannot be configured and
 * whose stored `coverage` was written under the retired binary contract, in
 * which "not yet answered" and "deliberately excluded" were the same value.
 * The version field exists for exactly this — a stored shape whose meaning
 * changed is discarded, not guessed at.
 */
export const PROPOSAL_PERSISTENCE_VERSION = 3
export const PROPOSAL_STORAGE_PREFIX = 'all3.proposal.v1.'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type PersistedProposalLoad =
  | { status: 'missing' }
  | { status: 'loaded'; payload: unknown }
  | { status: 'discarded'; reason: 'malformed' | 'version' | 'project' }
  | { status: 'unavailable' }

type EncodedValue =
  | null | boolean | number | string
  | EncodedValue[]
  | { [key: string]: EncodedValue }

const DECIMAL_TAG = '__all3_decimal__'

export function proposalStorageKey(projectId: string): string {
  return `${PROPOSAL_STORAGE_PREFIX}${projectId}`
}

function encode(value: unknown, seen: WeakSet<object>): EncodedValue {
  if (Decimal.isDecimal(value)) return { [DECIMAL_TAG]: value.toFixed() }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((item) => encode(item, seen))
  if (typeof value !== 'object') {
    throw new Error(`proposal payload contains unsupported ${typeof value}`)
  }
  if (seen.has(value)) throw new Error('proposal payload contains a cycle')
  seen.add(value)
  const encoded: Record<string, EncodedValue> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    encoded[key] = encode(item, seen)
  }
  seen.delete(value)
  return encoded
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode)
  if (value === null || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 1 && keys[0] === DECIMAL_TAG) {
    if (typeof record[DECIMAL_TAG] !== 'string') {
      throw new Error('invalid Decimal payload')
    }
    return new Decimal(record[DECIMAL_TAG])
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]))
}

export function serializeProposalPayload(projectId: string, payload: unknown): string {
  return JSON.stringify({
    version: PROPOSAL_PERSISTENCE_VERSION,
    projectId,
    payload: encode(payload, new WeakSet<object>()),
  })
}

function discard(
  storage: StorageLike,
  projectId: string,
  reason: Extract<PersistedProposalLoad, { status: 'discarded' }>['reason'],
): PersistedProposalLoad {
  try {
    storage.removeItem(proposalStorageKey(projectId))
  } catch {
    // A blocked storage backend is still treated as a discarded payload.
  }
  return { status: 'discarded', reason }
}

export function loadPersistedProposal(
  storage: StorageLike,
  projectId: string,
): PersistedProposalLoad {
  let raw: string | null
  try {
    raw = storage.getItem(proposalStorageKey(projectId))
  } catch {
    return { status: 'unavailable' }
  }
  if (raw === null) return { status: 'missing' }

  try {
    const envelope: unknown = JSON.parse(raw)
    if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return discard(storage, projectId, 'malformed')
    }
    const record = envelope as Record<string, unknown>
    if (record.version !== PROPOSAL_PERSISTENCE_VERSION) {
      return discard(storage, projectId, 'version')
    }
    if (record.projectId !== projectId) return discard(storage, projectId, 'project')
    if (!Object.hasOwn(record, 'payload')) return discard(storage, projectId, 'malformed')
    return { status: 'loaded', payload: decode(record.payload) }
  } catch {
    return discard(storage, projectId, 'malformed')
  }
}

export function savePersistedProposal(
  storage: StorageLike,
  projectId: string,
  payload: unknown,
): boolean {
  try {
    storage.setItem(proposalStorageKey(projectId), serializeProposalPayload(projectId, payload))
    return true
  } catch {
    return false
  }
}

export function clearPersistedProposal(
  storage: StorageLike,
  projectId: string,
): boolean {
  try {
    storage.removeItem(proposalStorageKey(projectId))
    return true
  } catch {
    return false
  }
}

export function browserProposalStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
