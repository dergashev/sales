import { Decimal } from 'decimal.js'

/**
 * VR3-02 bumped this to 2; VR3-03 to 3; VR3-04 bumps it to 4.
 *
 * An Option saved before version 2 carries no building scope, and the
 * Konfigurator gate is that scope. An Option saved before version 3 carries
 * no KG configuration, and the configuration IS the offer: its six scope
 * decisions and every service decision under them are what price it. A
 * pre-3 payload therefore restores an Option that cannot be configured and
 * whose stored `coverage` was written under the retired binary contract, in
 * which "not yet answered" and "deliberately excluded" were the same value.
 *
 * An Option saved before version 4 carries no schedule stage, no Final
 * Validation and — the reason this bump is not optional — NO SAVED VERSION.
 * Under the pre-4 contract, persistence WAS the commitment: client
 * eligibility followed configuration completeness, so restoring such a
 * payload into a product where Client Mode requires an explicit saved
 * baseline would either silently revoke an eligibility the user had, or
 * silently grant one nobody ever gave. Neither is a state to guess at.
 *
 * An Option saved before version 5 belongs to NO IDENTIFIABLE PROJECT. Up to
 * version 4 the whole prototype shared ONE stored proposal, written under a
 * constant id (`demo.project.id`) that names neither demonstration project,
 * so the Options, the confirmed building scope and the KG configuration
 * inside a single payload could have been created under different projects —
 * and after a reload they were served to whichever project happened to be
 * open. That is the defect this version closes, and it is precisely why such
 * a payload cannot be MIGRATED: its `opportunityId` records only the project
 * it was last viewed under, not the project each part of it came from.
 * Attributing the whole payload to that one project would keep the leak and
 * merely make it look deliberate.
 *
 * The version field exists for exactly this — a stored shape whose meaning
 * changed is discarded, not guessed at.
 */
export const PROPOSAL_PERSISTENCE_VERSION = 5
export const PROPOSAL_STORAGE_PREFIX = 'all3.proposal.v1.'

/**
 * WHICH PROJECT the browser was last working in.
 *
 * A pointer, not proposal data, and deliberately outside
 * `PROPOSAL_STORAGE_PREFIX` so that pruning the proposal namespace cannot
 * eat it and a project can never be named `lastProject`.
 *
 * It exists because per-project keys create a question the single-key
 * contract never had: on boot, WHICH stored proposal should be restored?
 * Guessing — newest write, first key, the fixture default — would restore a
 * project the user never asked for. This records the answer instead.
 */
export const PROPOSAL_LAST_PROJECT_KEY = 'all3.session.v1.lastProject'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Storage that can also be ENUMERATED.
 *
 * Only the pruning path needs it: everything else addresses one known key.
 * `localStorage` satisfies it; a narrow test double may not, which is why
 * pruning is a separate entry point rather than a step inside `load`.
 */
export type EnumerableStorageLike = StorageLike & Pick<Storage, 'length' | 'key'>

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

/* ── which project the browser was last in ─────────────────────────────── */

export function readLastProjectId(storage: StorageLike): string | null {
  try {
    const raw = storage.getItem(PROPOSAL_LAST_PROJECT_KEY)
    return raw && raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

export function writeLastProjectId(
  storage: StorageLike, projectId: string,
): boolean {
  try {
    storage.setItem(PROPOSAL_LAST_PROJECT_KEY, projectId)
    return true
  } catch {
    return false
  }
}

export function clearLastProjectId(storage: StorageLike): boolean {
  try {
    storage.removeItem(PROPOSAL_LAST_PROJECT_KEY)
    return true
  } catch {
    return false
  }
}

/* ── which navigation variant the reader chose ─────────────────────────── */

/**
 * A READING PREFERENCE, stored next to `lastProject` and deliberately NOT
 * inside a proposal payload.
 *
 * It belongs to the person, not to a project: filing it with the proposal
 * would make the rail flip back on every project switch, and the payload's
 * version guard would throw the choice away on the next shape change. Same
 * namespace rule as `lastProject` — a pointer about the session, outside
 * `PROPOSAL_STORAGE_PREFIX`, so pruning proposals cannot eat it.
 */
export const NAV_VARIANT_KEY = 'all3.session.v1.navVariant'

export function readNavVariant(storage: StorageLike): 'v1' | 'v2' | 'v3' | 'v4' | null {
  try {
    const raw = storage.getItem(NAV_VARIANT_KEY)
    return raw === 'v1' || raw === 'v2' || raw === 'v3' || raw === 'v4' ? raw : null
  } catch {
    return null
  }
}

export function writeNavVariant(
  storage: StorageLike, variant: 'v1' | 'v2' | 'v3' | 'v4',
): boolean {
  try {
    storage.setItem(NAV_VARIANT_KEY, variant)
    return true
  } catch {
    return false
  }
}

/* ── the project register's own analyses ───────────────────────────────── */

/**
 * WHAT EACH PROJECT'S DOCUMENT ANALYSIS FOUND, kept across reloads.
 *
 * It is not proposal data — it belongs to the project REGISTER, is keyed by
 * project id, and one project's Option workspace must not carry another
 * project's analysis — so it lives beside `lastProject` rather than inside a
 * proposal payload, for the same reason the store keeps it out of the
 * project-scoped swap.
 *
 * Without this the register forgot every completed analysis on reload: the
 * evidence rows still rendered from the fixture while the workflow rail
 * reported `Dokumentanalyse fehlt`, so a project a person had finished
 * reading came back looking untouched.
 */
export const ANALYSES_KEY = 'all3.session.v1.analyses'

export function readProjectAnalyses(storage: StorageLike): unknown {
  try {
    const raw = storage.getItem(ANALYSES_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    // An object of objects or nothing: a malformed payload is DISCARDED, not
    // guessed at, exactly as the proposal envelope is.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

export function writeProjectAnalyses(
  storage: StorageLike, analyses: unknown,
): boolean {
  try {
    storage.setItem(ANALYSES_KEY, JSON.stringify(analyses))
    return true
  } catch {
    return false
  }
}

/* ── the proposal namespace ────────────────────────────────────────────── */

function isEnumerable(storage: StorageLike): storage is EnumerableStorageLike {
  const candidate = storage as Partial<EnumerableStorageLike>
  return typeof candidate.length === 'number' && typeof candidate.key === 'function'
}

/** Every project id that currently has a stored proposal, in storage order. */
export function persistedProposalProjectIds(
  storage: StorageLike,
): readonly string[] {
  if (!isEnumerable(storage)) return []
  const ids: string[] = []
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(PROPOSAL_STORAGE_PREFIX)) {
        ids.push(key.slice(PROPOSAL_STORAGE_PREFIX.length))
      }
    }
  } catch {
    return ids
  }
  return ids
}

/**
 * Drop every stored proposal that cannot be trusted to belong to the project
 * its key names.
 *
 * Three things make a payload untrustworthy, and all three are the same
 * defect seen from different sides: it is unparsable, it was written under a
 * superseded contract, or its envelope claims a different project from the
 * key it is filed under. The third check is what turns "the key names the
 * project" from a convention into an invariant — without it, a stale
 * single-key payload would keep being served to whatever project asked.
 *
 * Returns the project ids it removed, so a caller can say what happened
 * rather than silently losing work.
 */
export function prunePersistedProposals(
  storage: StorageLike,
): readonly string[] {
  const removed: string[] = []
  for (const projectId of persistedProposalProjectIds(storage)) {
    let raw: string | null
    try {
      raw = storage.getItem(proposalStorageKey(projectId))
    } catch {
      continue
    }
    if (raw === null) continue
    let keep = false
    try {
      const envelope: unknown = JSON.parse(raw)
      if (envelope !== null && typeof envelope === 'object' && !Array.isArray(envelope)) {
        const record = envelope as Record<string, unknown>
        keep = record.version === PROPOSAL_PERSISTENCE_VERSION
          && record.projectId === projectId
          && Object.hasOwn(record, 'payload')
      }
    } catch {
      keep = false
    }
    if (keep) continue
    try {
      storage.removeItem(proposalStorageKey(projectId))
      removed.push(projectId)
    } catch {
      // A blocked backend simply keeps the payload; the load path rejects it
      // again on its own terms, so nothing untrusted is ever restored.
    }
  }
  return removed
}

/** Forget every project's proposal AND the pointer to the last one. */
export function clearAllPersistedProposals(storage: StorageLike): readonly string[] {
  const cleared: string[] = []
  for (const projectId of persistedProposalProjectIds(storage)) {
    if (clearPersistedProposal(storage, projectId)) cleared.push(projectId)
  }
  clearLastProjectId(storage)
  return cleared
}
