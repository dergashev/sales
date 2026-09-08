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
 * A closed-domain baseline fact: not a quantity, but a choice from a list.
 *
 * These three were display-only. They are facts the baseline states about a
 * building, they are part of its material fingerprint, and requirement 10
 * says every displayed value is editable — so they are edited with the
 * control their data deserves (a select, not a number field) and recorded
 * with the same authority trail as an area.
 */
export const SCOPE_CHOICE_FACTS = ['usage', 'storeys', 'underground'] as const

export type ScopeChoiceFactKey = typeof SCOPE_CHOICE_FACTS[number]

/** Every fact the baseline DISPLAYS, and therefore every fact it may edit. */
export type ScopeFactKey = ScopeMetricKey | ScopeChoiceFactKey

const CHOICE_FACTS = new Set<string>(SCOPE_CHOICE_FACTS)

export function isScopeChoiceFact(key: string): key is ScopeChoiceFactKey {
  return CHOICE_FACTS.has(key)
}

/**
 * EVERY DISPLAYED FACT IS EDITABLE (B2, Product Owner requirement 10).
 *
 * The released list held seven of fifteen metrics, and its own docblock gave
 * the reason BGF was excluded: "replacing one by hand would move the
 * commercial base without evidence, which is a Product decision this ticket
 * does not own". That was an honest boundary for the ticket that wrote it,
 * and it is exactly the Product decision THIS ticket owns — the audit
 * measured the consequence as "Only usable areas and quantities are
 * editable; BGF, use, storeys, and basement are read-only", and requirement
 * 10 answers it.
 *
 * The concern was real and is answered rather than dropped. An override
 * still moves nothing without evidence: it records the value it replaced,
 * its author, the time and a REQUIRED reason, it drops the fact's authority
 * to `overridden`, and it un-confirms the building by arithmetic. What is
 * new is that editing a BGF component now has to resolve its DERIVED
 * dependants explicitly (`derivedImpact` below) — the commercial base cannot
 * move silently, which is what "without evidence" was protecting.
 */
export const EDITABLE_SCOPE_FACTS: readonly ScopeFactKey[] = [
  ...SCOPE_CHOICE_FACTS,
  'bgfRAbove', 'bgfSAbove', 'bgfRSAbove',
  'bgfRBelow', 'bgfSBelow', 'bgfRSBelow', 'bgfRSTotal',
  'wfl', 'nuf', 'commercialNuf', 'units', 'workplaces', 'parkingSpaces', 'siteArea',
]

const EDITABLE = new Set<string>(EDITABLE_SCOPE_FACTS)

export function isEditableScopeFact(key: string): key is ScopeFactKey {
  return EDITABLE.has(key)
}

/* ────────────────────────── derived dependants ───────────────────────── */

/**
 * The BGF sums the baseline already states, as a graph.
 *
 * These are not new formulas. They are the arithmetic the fixture itself
 * carries and the engine already relies on — `bgfRSAbove = bgfRAbove +
 * bgfSAbove`, and so on up to `bgfRSTotal` — written down once so that
 * editing a component can PREVIEW what it moves instead of leaving the
 * totals to contradict their own parts.
 *
 * Verified against the demonstration baseline: Lindenhof 2 740 + 160 =
 * 2 900; Hofhaus 4 620 + 180 = 4 800 and 4 800 + 980 = 5 780; Stadthaus
 * 6 180 + 240 = 6 420 and 6 420 + 1 240 = 7 660.
 */
const DERIVED_SUMS: Readonly<Record<string, readonly ScopeMetricKey[]>> = {
  bgfRSAbove: ['bgfRAbove', 'bgfSAbove'],
  bgfRSBelow: ['bgfRBelow', 'bgfSBelow'],
  bgfRSTotal: ['bgfRSAbove', 'bgfRSBelow'],
}

/** Which facts are computed from others, in evaluation order. */
export const DERIVED_FACT_ORDER: readonly ScopeMetricKey[] = [
  'bgfRSAbove', 'bgfRSBelow', 'bgfRSTotal',
]

export function isDerivedScopeFact(key: string): boolean {
  return key in DERIVED_SUMS
}

/**
 * Every fact that would have to change if `key` changed, in the order they
 * must be recomputed. Transitive: editing `bgfRAbove` reaches `bgfRSTotal`
 * through `bgfRSAbove`, and a preview that stopped at the first level would
 * understate what the user is about to move.
 */
export function derivedDependants(key: ScopeFactKey): readonly ScopeMetricKey[] {
  const out: ScopeMetricKey[] = []
  let frontier: string[] = [key]
  // Bounded by the order list, so a cycle in the table cannot loop forever.
  for (const candidate of DERIVED_FACT_ORDER) {
    const inputs = DERIVED_SUMS[candidate] ?? []
    if (inputs.some((input) => frontier.includes(input))) {
      out.push(candidate)
      frontier = [...frontier, candidate]
    }
  }
  return out
}

export type DerivedImpact = Readonly<{
  key: ScopeMetricKey
  /** What it says now. */
  before: string | null
  /** What the existing sums make it, once the edit lands. */
  after: string
  /** True when this dependant currently carries its OWN manual override. */
  manual: boolean
}>

/**
 * The before/after of every derived dependant, computed from the SAME sums
 * the baseline already states.
 *
 * A dependant whose inputs are not all known is absent from the result: a
 * sum with an unknown term is unknown, and rule 16 forbids answering it with
 * a number.
 */
export function derivedImpact(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  building: ScopeBuilding,
  key: ScopeFactKey,
  nextValue: string,
): readonly DerivedImpact[] {
  if (isScopeChoiceFact(key)) return []
  const values = new Map<string, string | null>()
  for (const metric of Object.keys(building.metrics) as ScopeMetricKey[]) {
    values.set(metric, scopeMetricValue(state, building, metric))
  }
  values.set(key, nextValue)

  const out: DerivedImpact[] = []
  for (const dependant of derivedDependants(key)) {
    const inputs = DERIVED_SUMS[dependant] ?? []
    const terms = inputs.map((input) => values.get(input) ?? null)
    if (terms.some((term) => term === null)) continue
    const sum = terms.reduce((acc, term) => acc + centsOf(term!), 0n)
    const after = fromCents(sum)
    const before = values.get(dependant) ?? null
    values.set(dependant, after)
    if (before === after) continue
    out.push({
      key: dependant,
      before,
      after,
      manual: Boolean(state.scopeEdits[building.id]?.[dependant]),
    })
  }
  return out
}

/**
 * HOW a derived dependant is resolved. The user chooses; the Product does
 * not pick for them, because both answers are legitimate and they mean
 * different things.
 *
 * `recalculate` — the totals follow their parts, using the sums above and
 * nothing else.
 * `keepManual`  — the dependant keeps the value a person put there, and the
 * disagreement becomes a NAMED CONFLICT rather than a silent contradiction
 * between a total and its own components.
 */
export type DerivedResolution = 'recalculate' | 'keepManual'

/**
 * A derived fact that no longer agrees with its own inputs, because the user
 * chose to keep it.
 *
 * It is stored, not derived, and deliberately so: the disagreement is a
 * DECISION with an author and a time, and recomputing "does this still
 * disagree?" from the sums would erase the fact that somebody chose it.
 */
export type ScopeConflict = Readonly<{
  /** What the existing sums make this fact. */
  derived: string
  /** What the fact says instead — the value the user kept. */
  kept: string
  /** The edit that caused the disagreement. */
  causedBy: ScopeFactKey
  actor: string
  at: string
}>

export function scopeConflictsOf(
  state: Pick<BuildingScopeState, 'scopeConflicts'>,
  buildingId: string,
): Readonly<Partial<Record<string, ScopeConflict>>> {
  return state.scopeConflicts[buildingId] ?? {}
}

export function scopeHasConflict(
  state: Pick<BuildingScopeState, 'scopeConflicts'>,
  buildingId: string,
): boolean {
  return Object.keys(scopeConflictsOf(state, buildingId)).length > 0
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
  /** Derived facts the user chose to keep against their own inputs. */
  scopeConflicts: Readonly<Record<string, Readonly<Partial<Record<string, ScopeConflict>>>>>
  /** Re-analysis proposals, held BESIDE the current truth, never over it. */
  scopeCandidates: Readonly<Record<string, Readonly<Partial<Record<string, ScopeCandidate>>>>>
}

/**
 * A value a re-analysis proposes for a fact that already has one.
 *
 * It is held BESIDE the current truth and never written over it, which is
 * the whole point (M-1/D-08, rule 14): a confirmed or manually overridden
 * value is a human decision, and a fresh read of a document is a candidate
 * for that decision — not a replacement for it. The user accepts it, keeps
 * what they have, or opens the source; every path is an event.
 *
 * A re-analysis that proposes the value already in place records NO
 * candidate: an identical read is not a change, and manufacturing a
 * "conflict" out of agreement is the false invalidation the status model
 * forbids.
 */
export type ScopeCandidate = Readonly<{
  /** The proposed value. */
  value: string
  /** The value it is proposed against — the fact as it now stands. */
  current: string | null
  /** Which document the proposal came from. */
  sourceDocId: string | null
  at: string
}>

export function scopeCandidate(
  state: Pick<BuildingScopeState, 'scopeCandidates'>,
  buildingId: string,
  key: ScopeFactKey,
): ScopeCandidate | null {
  return state.scopeCandidates[buildingId]?.[key] ?? null
}

export function scopeCandidateCount(
  state: Pick<BuildingScopeState, 'scopeCandidates'>,
  buildingId: string,
): number {
  return Object.keys(state.scopeCandidates[buildingId] ?? {}).length
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
  key: ScopeFactKey,
): ScopeMetricEdit | null {
  return state.scopeEdits[buildingId]?.[key] ?? null
}

/** The building's own value for a closed-domain fact. */
function choiceFactSource(building: ScopeBuilding, key: ScopeChoiceFactKey): string {
  if (key === 'usage') return building.usageKey
  if (key === 'storeys') return building.storeysKey
  return building.undergroundLevel
}

/**
 * The effective value of ANY displayed fact — quantity or choice.
 *
 * One reader, so the fingerprint, the editor, the projection and the screen
 * cannot disagree about what a building's use currently IS. Before this,
 * `usageKey` was read straight off the inherited baseline in four places,
 * which is precisely why an edit to it could not have been expressed: there
 * was no single place for the override to be seen.
 */
export function scopeFactValue(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  building: ScopeBuilding,
  key: ScopeFactKey,
): string | null {
  const edit = state.scopeEdits[building.id]?.[key]
  if (edit) return edit.value
  return isScopeChoiceFact(key)
    ? choiceFactSource(building, key)
    : building.metrics[key] ?? null
}

/** The SOURCE value of any displayed fact, ignoring every override. */
export function scopeFactSource(
  building: ScopeBuilding, key: ScopeFactKey,
): string | null {
  return isScopeChoiceFact(key)
    ? choiceFactSource(building, key)
    : building.metrics[key] ?? null
}

/**
 * The information authority of one metric AS IT NOW STANDS. An override
 * replaces whatever authority the source carried: a value a person typed is
 * `overridden`, never still `sourceEvidenced` (interaction legend).
 */
export function scopeMetricAuthority(
  state: Pick<BuildingScopeState, 'scopeEdits'>,
  building: ScopeBuilding,
  key: ScopeFactKey,
): string {
  if (state.scopeEdits[building.id]?.[key]) return 'overridden'
  // The baseline declares `undergroundLevel`; the fact key is `underground`,
  // because that is what the row is called. Named here rather than guessed.
  const declared = building.authority[key === 'underground' ? 'undergroundLevel' : key]
  if (declared) return declared
  // A DERIVED fact says so even where the baseline forgot to: a total that
  // is the sum of two evidenced parts is derived, and calling it
  // source-evidenced would claim a document states it directly.
  if (isDerivedScopeFact(key)) return 'derived'
  return scopeFactSource(building, key) === null ? 'unknown' : 'sourceEvidenced'
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
    // EFFECTIVE, not inherited. These three became editable in B2, and a
    // fingerprint that kept reading the inherited value would leave a
    // building confirmed after its USE changed — the one thing the
    // fingerprint exists to make impossible.
    usage: scopeFactValue(state, building, 'usage'),
    storeys: scopeFactValue(state, building, 'storeys'),
    underground: scopeFactValue(state, building, 'underground'),
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

export type ScopeBuildingStatus =
  'unselected' | 'open' | 'stale' | 'conflict' | 'confirmed'

export function scopeBuildingStatus(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'
    | 'scopeConflicts'>,
  buildingId: string,
): ScopeBuildingStatus {
  if (!state.scopeSelected[buildingId]) return 'unselected'
  // A CONFLICT outranks a confirmation, and it must: a total that disagrees
  // with its own components is not a baseline anybody can confirm, and
  // letting the tick stand over it would be the unqualified CONFIRMED the
  // interaction legend forbids.
  if (scopeHasConflict(state, buildingId)) return 'conflict'
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
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'
    | 'scopeConflicts'>,
): boolean {
  const ids = scopeSelectedIds(state)
  return ids.length > 0 && ids.every((id) =>
    scopeBuildingConfirmed(state, id) && !scopeHasConflict(state, id))
}

/**
 * The Konfigurator gate. A saved scope opens it only while the saved
 * fingerprint still describes the scope on screen: a later material change
 * closes the gate again by arithmetic, never by remembering to close it.
 */
export function buildingScopeSaved(
  state: Pick<BuildingScopeState,
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected' | 'scopeSaved'
    | 'scopeConflicts'>,
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
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected' | 'scopeSaved'
    | 'scopeConflicts'>,
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
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected' | 'scopeSaved'
    | 'scopeConflicts'>,
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
    'scopeEdits' | 'scopeConfirmations' | 'scopeBuildings' | 'scopeSelected'
    | 'scopeConflicts'>,
): ScopeBuilding[] {
  return state.scopeBuildings.filter((building) =>
    state.scopeSelected[building.id]
      && (!scopeBuildingConfirmed(state, building.id)
        || scopeHasConflict(state, building.id)))
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
  /** A choice outside its own closed domain — only reachable programmatically. */
  | 'notInDomain'

/** An area above this is not a building metric, it is a typing accident. */
const MAX_AREA = 10_000_000n * 100n

/**
 * Validation lives here so the screen and the store cannot disagree about
 * what a valid metric is. An INVALID edit never reaches the store: it stays
 * in the field with its message, and the prior confirmed value is still
 * exactly where it was.
 */
/**
 * The closed domain of one choice fact, in the words its own data uses.
 *
 * Passed IN rather than hardcoded here: the use keys live with the metric
 * policy that classifies them (`optionCommercialProjection`) and the storey
 * keys live in the project baseline, and a second copy of either list here
 * is a second place for them to disagree.
 */
export function validateScopeChoice(
  raw: string, domain: readonly string[],
): { ok: true; value: string } | { ok: false; error: ScopeEditError } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, error: 'empty' }
  return domain.includes(trimmed)
    ? { ok: true, value: trimmed }
    : { ok: false, error: 'notInDomain' }
}

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
