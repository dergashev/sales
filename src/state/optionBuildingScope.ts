import type { ProjectBaselineSnapshot } from './projectAnalysis'

/**
 * VR3-02 — the Option's building-scope contract.
 *
 * This module is PURE. The store holds the state; this file describes it and
 * derives every answer the product asks of it. The consequence that matters:
 * the Konfigurator gate is arithmetic, provable without rendering.
 *
 * ONE AUTHORITY, NOT A SECOND COPY OF THE NUMBERS.
 *
 * `scopeBuildings` is the Option's inheritance of the project baseline that
 * VR3-01 journalled (`ProjectBaselineSnapshot`) — the same values, taken once,
 * at the moment the Option was created, and never recomputed from a rendered
 * string. The Option is a variant of a project as it was understood on a
 * given day; a later re-analysis of the project must not silently move an
 * Option's commercial base, which is why the snapshot is inherited rather
 * than read live (M-1/M-3). What CAN move is an authorised edit, and that is
 * an explicit, attributable override recorded here with the value it
 * replaced.
 *
 * CONFIRMATION IS A FINGERPRINT, NOT A FLAG.
 *
 * The same mechanism `buildingReview` uses, for the same reason: a boolean
 * survives an edit that invalidates it. A confirmation stores the exact
 * material value set it confirmed. Change any of those values and the
 * recomputed fingerprint stops matching — the building is un-confirmed by
 * arithmetic, and no invalidation action can be forgotten. The saved scope
 * fingerprint composes the per-building ones with the selected id set, so
 * removing a building invalidates the SAVE without invalidating the
 * confirmations of the buildings that stayed.
 */

/** The material metrics of one building, as the baseline carries them. */
export type ScopeMetricKey =
  | 'bgfRAbove'
  | 'bgfSAbove'
  | 'bgfRSAbove'
  | 'bgfRBelow'
  | 'bgfSBelow'
  | 'bgfRSBelow'
  | 'bgfRSTotal'
  | 'wfl'
  | 'nuf'
  | 'commercialNuf'
  | 'units'
  | 'workplaces'
  | 'parkingSpaces'
  | 'siteArea'

/**
 * The metrics an authorised user may override on the Option's baseline.
 *
 * BGF values are deliberately NOT here. They are the plan-derived areas the
 * commercial scale rests on, and the baseline reports them with the authority
 * that produced them; replacing one by hand would move the commercial base
 * without evidence, which is a Product decision this ticket does not own
 * (its target shows exactly one editable metric, a usable area). Usable and
 * countable quantities are editable because a seller legitimately holds
 * later knowledge about them than the drawing set does.
 */
export const EDITABLE_SCOPE_METRICS = [
  'wfl', 'nuf', 'commercialNuf', 'units', 'workplaces', 'parkingSpaces', 'siteArea',
] as const

export type EditableScopeMetricKey = typeof EDITABLE_SCOPE_METRICS[number]

const EDITABLE = new Set<string>(EDITABLE_SCOPE_METRICS)

export function isEditableScopeMetric(key: string): key is EditableScopeMetricKey {
  return EDITABLE.has(key)
}

/** Counted quantities are integers; areas carry two decimals. */
const COUNT_METRICS = new Set<string>(['units', 'workplaces', 'parkingSpaces'])

export function isCountMetric(key: string): boolean {
  return COUNT_METRICS.has(key)
}

export type ScopeUndergroundLevel = 'none' | 'partial' | 'full'

/**
 * One building as the Option owns it. Values are decimal STRINGS exactly as
 * the fixture and the baseline carry them: no float ever enters the model,
 * and no formatted number ever leaves it as an input.
 */
export type ScopeBuilding = {
  id: string
  name: string
  usageKey: string
  storeysKey: string
  undergroundLevel: ScopeUndergroundLevel
  identityAssetId: string
  metrics: Readonly<Record<ScopeMetricKey, string | null>>
  /** Per-fact information authority, from the baseline. */
  authority: Readonly<Record<string, string>>
  /** The documents this building's facts were read from. */
  evidenceDocIds: readonly string[]
}

/** An authorised override: the new value plus everything it replaced. */
export type ScopeMetricEdit = {
  value: string
  /** The value this override replaced. `null` means the fact was unknown. */
  previous: string | null
  reason: string
  actor: string
  at: string
}

export type ScopeConfirmation = {
  fingerprint: string
  actor: string
  at: string
}

export type SavedBuildingScope = {
  fingerprint: string
  selectedIds: readonly string[]
  /** The selected all-building BGF R+S at the moment of saving. */
  bgfRSTotal: string
  actor: string
  at: string
}

/** The transient half. It never lives inside an undoable record. */
export type BuildingScopeCommit = {
  /** The stage in flight; `null` once the commitment has failed. */
  stage: 'SAVING' | null
  /** Why it failed; `null` while it is still in flight. */
  errorKey: string | null
}

export type BuildingScopeState = {
  scopeBuildings: readonly ScopeBuilding[]
  scopeSelected: Readonly<Record<string, boolean>>
  scopeEdits: Readonly<Record<string, Readonly<Partial<Record<string, ScopeMetricEdit>>>>>
  scopeConfirmations: Readonly<Record<string, ScopeConfirmation>>
  scopeSaved: SavedBuildingScope | null
}

/* ───────────────────────────── inheritance ───────────────────────────── */

/**
 * The Option's buildings, inherited from the journalled project baseline.
 *
 * Every selected by default: the baseline states which buildings the project
 * HAS, and an Option that covers the project it was created from is the only
 * honest starting point. Deselecting is a decision with a consequence, and
 * the product asks for it explicitly.
 */
export function scopeBuildingsFromBaseline(
  baseline: ProjectBaselineSnapshot | null,
): ScopeBuilding[] {
  if (!baseline) return []
  return baseline.buildings.map((building) => ({
    id: building.id,
    name: building.name,
    usageKey: building.usageKey,
    storeysKey: building.storeysKey,
    undergroundLevel: building.undergroundLevel,
    identityAssetId: building.identityAssetId,
    // Counted quantities arrive as JSON numbers and areas as decimal
    // strings. One shape here, so a fingerprint of `18` and a fingerprint
    // of `"18"` can never describe the same building differently.
    metrics: Object.fromEntries(
      (Object.keys(building.metrics) as ScopeMetricKey[]).map((key) => {
        const value = building.metrics[key]
        return [key, value === null ? null : normaliseMetric(value)]
      }),
    ) as Record<ScopeMetricKey, string | null>,
    authority: { ...building.authority },
    evidenceDocIds: [...building.evidenceDocIds],
  }))
}

function normaliseMetric(value: string | number): string {
  return fromCents(centsOf(typeof value === 'number' ? String(value) : value))
}

export function initialScopeSelection(
  buildings: readonly ScopeBuilding[],
): Record<string, boolean> {
  return Object.fromEntries(buildings.map((building) => [building.id, true]))
}

/* ─────────────────────────────── reading ─────────────────────────────── */

export function scopeBuilding(
  state: Pick<BuildingScopeState, 'scopeBuildings'>,
  buildingId: string | null,
): ScopeBuilding | null {
  if (!buildingId) return null
  return state.scopeBuildings.find((building) => building.id === buildingId) ?? null
}

/**
 * The effective value of one metric: the authorised override when one
 * exists, otherwise the baseline's own value. `null` stays `null` — an
 * unknown quantity is never rendered as zero (rule 16).
 */
export function scopeMetricValue(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  building: ScopeBuilding,
  key: ScopeMetricKey,
): string | null {
  const edit = state.scopeEdits[building.id]?.[key]
  if (edit) return edit.value
  return building.metrics[key] ?? null
}

export function scopeMetricEdit(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  buildingId: string,
  key: ScopeMetricKey,
): ScopeMetricEdit | null {
  return state.scopeEdits[buildingId]?.[key] ?? null
}

/**
 * The information authority of one metric AS IT NOW STANDS. An override
 * replaces whatever authority the source carried: a value a person typed is
 * `overridden`, never still `sourceEvidenced` (interaction legend).
 */
export function scopeMetricAuthority(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  building: ScopeBuilding,
  key: ScopeMetricKey,
): string {
  if (state.scopeEdits[building.id]?.[key]) return 'overridden'
  const declared = building.authority[key]
  if (declared) return declared
  return building.metrics[key] === null ? 'unknown' : 'sourceEvidenced'
}

export function scopeSelectedIds(
  state: Pick<BuildingScopeState, 'scopeBuildings' | 'scopeSelected'>,
): string[] {
  return state.scopeBuildings
    .filter((building) => state.scopeSelected[building.id])
    .map((building) => building.id)
}

/* ───────────────────────────── fingerprints ──────────────────────────── */

/**
 * The material value set of one building.
 *
 * "Material" means: everything a downstream configuration would have to be
 * rechecked against. Identity and use belong to it because a building that
 * changed its use is not the building that was confirmed; the metrics belong
 * to it because they are the quantity bases. The FORMATTED value never
 * appears here — only the canonical decimal string.
 */
export function buildingScopeFingerprint(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  building: ScopeBuilding,
): string {
  const metrics = (Object.keys(building.metrics) as ScopeMetricKey[])
    .slice()
    .sort()
    .map((key) => [key, scopeMetricValue(state, building, key)])
  return JSON.stringify({
    id: building.id,
    name: building.name,
    usage: building.usageKey,
    storeys: building.storeysKey,
    underground: building.undergroundLevel,
    metrics,
  })
}

export function scopeBuildingConfirmed(
  state: Pick<BuildingScopeState, 'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings'>,
  buildingId: string,
): boolean {
  const building = scopeBuilding(state, buildingId)
  const confirmation = state.scopeConfirmations[buildingId]
  if (!building || !confirmation) return false
  return confirmation.fingerprint === buildingScopeFingerprint(state, building)
}

/**
 * A building whose confirmation exists but no longer matches. This is the
 * STALE state, and it is materially different from "never confirmed": the
 * user confirmed this building and then something changed under it, so the
 * product owes them the fact rather than a silent return to the start.
 */
export function scopeBuildingStale(
  state: Pick<BuildingScopeState, 'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings'>,
  buildingId: string,
): boolean {
  return Boolean(state.scopeConfirmations[buildingId])
    && !scopeBuildingConfirmed(state, buildingId)
}

export type ScopeBuildingStatus = 'unselected' | 'open' | 'stale' | 'confirmed'

export function scopeBuildingStatus(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'>,
  buildingId: string,
): ScopeBuildingStatus {
  if (!state.scopeSelected[buildingId]) return 'unselected'
  if (scopeBuildingConfirmed(state, buildingId)) return 'confirmed'
  return scopeBuildingStale(state, buildingId) ? 'stale' : 'open'
}

export function scopeConfirmedCount(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'>,
): number {
  return scopeSelectedIds(state).filter((id) => scopeBuildingConfirmed(state, id)).length
}

/**
 * The scope fingerprint: the selected id set plus every selected building's
 * own material fingerprint. Sorted, so the same scope always produces the
 * same string regardless of the order the user selected in.
 */
export function scopeFingerprint(
  state: Pick<BuildingScopeState, 'scopeEdits' | 'scopeBuildings' | 'scopeSelected'>,
): string {
  const ids = scopeSelectedIds(state).slice().sort()
  return JSON.stringify(ids.map((id) => {
    const building = scopeBuilding(state, id)
    return [id, building ? buildingScopeFingerprint(state, building) : null]
  }))
}

/* ─────────────────────────────── the gate ────────────────────────────── */

/**
 * Every selected building carries a complete, valid, CURRENT confirmation,
 * and at least one building is selected.
 */
export function scopeReadyToSave(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'>,
): boolean {
  const ids = scopeSelectedIds(state)
  return ids.length > 0 && ids.every((id) => scopeBuildingConfirmed(state, id))
}

/**
 * The Konfigurator gate. A saved scope opens it only while the saved
 * fingerprint still describes the scope on screen: a later material change
 * closes the gate again by arithmetic, never by remembering to close it.
 */
export function buildingScopeSaved(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected' | 'scopeSaved'>,
): boolean {
  const saved = state.scopeSaved
  if (!saved) return false
  if (!scopeReadyToSave(state)) return false
  return saved.fingerprint === scopeFingerprint(state)
}

/**
 * A scope that WAS saved and no longer matches. The saved baseline still
 * exists — this is the recheck state, not the absence of a save.
 */
export function buildingScopeStale(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected' | 'scopeSaved'>,
): boolean {
  return state.scopeSaved !== null && !buildingScopeSaved(state)
}

export type BuildingScopeStage =
  | 'NO_BASELINE'
  | 'NO_SELECTION'
  | 'INCOMPLETE'
  | 'READY_TO_SAVE'
  | 'STALE'
  | 'SAVED'

export function buildingScopeStage(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected' | 'scopeSaved'>,
): BuildingScopeStage {
  if (state.scopeBuildings.length === 0) return 'NO_BASELINE'
  if (buildingScopeSaved(state)) return 'SAVED'
  if (scopeSelectedIds(state).length === 0) return 'NO_SELECTION'
  if (buildingScopeStale(state)) return 'STALE'
  return scopeReadyToSave(state) ? 'READY_TO_SAVE' : 'INCOMPLETE'
}

/**
 * The buildings that still owe a confirmation, in scope order. The gate
 * names them: "Gebäude C still needs metric verification" is a route, and
 * "unavailable" is not.
 */
export function scopeUnconfirmedBuildings(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'>,
): ScopeBuilding[] {
  return state.scopeBuildings.filter((building) =>
    state.scopeSelected[building.id] && !scopeBuildingConfirmed(state, building.id))
}

/* ──────────────────────────── selected total ─────────────────────────── */

/**
 * The selected all-building BGF R+S.
 *
 * Summed in integer cents from the per-building totals — never averaged,
 * never parsed back out of a formatted string, and derived from the SELECTED
 * ids so the number always describes the scope actually on screen (rule 39).
 */
export function selectedBgfRSTotal(
  state: Pick<BuildingScopeState, 'scopeEdits' | 'scopeBuildings' | 'scopeSelected'>,
): string {
  let cents = 0n
  for (const building of state.scopeBuildings) {
    if (!state.scopeSelected[building.id]) continue
    cents += centsOf(scopeMetricValue(state, building, 'bgfRSTotal') ?? '0')
  }
  return fromCents(cents)
}

/**
 * Integer cents from a decimal string. The same parser shape
 * `projectAnalysis.totalBgfRS` uses, and for the same reason: a float would
 * make the demonstration's own arithmetic unprovable.
 */
export function centsOf(value: string): bigint {
  const trimmed = value.trim()
  const negative = trimmed.startsWith('-')
  const [whole, fraction = ''] = (negative ? trimmed.slice(1) : trimmed).split('.')
  const padded = `${fraction}00`.slice(0, 2)
  const magnitude = BigInt(whole || '0') * 100n + BigInt(padded || '0')
  return negative ? -magnitude : magnitude
}

export function fromCents(cents: bigint): string {
  const negative = cents < 0n
  const magnitude = negative ? -cents : cents
  const whole = magnitude / 100n
  const fraction = magnitude % 100n
  return `${negative ? '-' : ''}${whole}.${String(fraction).padStart(2, '0')}`
}

/* ─────────────────────────────── editing ─────────────────────────────── */

export type ScopeEditError =
  | 'empty'
  | 'notANumber'
  | 'negative'
  | 'notAnInteger'
  | 'tooLarge'

/** An area above this is not a building metric, it is a typing accident. */
const MAX_AREA = 10_000_000n * 100n

/**
 * Validation lives here so the screen and the store cannot disagree about
 * what a valid metric is. An INVALID edit never reaches the store: it stays
 * in the field with its message, and the prior confirmed value is still
 * exactly where it was.
 */
export function validateScopeMetric(
  key: ScopeMetricKey,
  raw: string,
  locale: 'de' | 'en' = 'de',
): { ok: true; value: string } | { ok: false; error: ScopeEditError } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, error: 'empty' }
  /**
   * The separators are LOCALE-DEFINED, not guessed.
   *
   * `3.410` is three thousand four hundred and ten in German and three
   * point four one in English, and no heuristic can tell those apart from
   * the string alone. The field opens on the value the screen showed,
   * formatted in the user's own locale, so the same locale reads it back —
   * guessing here would silently turn an area into a thousandth of itself.
   */
  const group = locale === 'de' ? '.' : ','
  const decimal = locale === 'de' ? ',' : '.'
  const withDecimal = trimmed
    .replace(/[\s\u00a0\u202f]/g, '')
    .split(group).join('')
    .split(decimal).join('.')
  if (!/^\d+(\.\d{1,2})?$/.test(withDecimal)) {
    return { ok: false, error: /^-/.test(trimmed) ? 'negative' : 'notANumber' }
  }
  const cents = centsOf(withDecimal)
  if (isCountMetric(key) && cents % 100n !== 0n) {
    return { ok: false, error: 'notAnInteger' }
  }
  if (cents > MAX_AREA) return { ok: false, error: 'tooLarge' }
  return { ok: true, value: fromCents(cents) }
}
