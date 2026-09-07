import type { CostGroup } from '../engine/calculate'

/**
 * VR3-04 · the EXPLICIT SAVE and the immutable saved Option.
 *
 * The released product persists continuously: `initializeProposalPersistence`
 * subscribes to the store and writes every change to `localStorage`. That is
 * good engineering and it is NOT a commercial commitment — but the product
 * treated it as one, because nothing else existed to treat as one. Client
 * eligibility read `canBeginConfiguration && configurationComplete`, so a
 * configuration that had never been reviewed by anybody was already
 * client-ready (audit F-002).
 *
 * PERSISTENCE AND COMMITMENT ARE NOW DIFFERENT THINGS.
 *
 * Autosave keeps the WORKING copy safe; a saved Option version is a separate,
 * named, immutable record that only an explicit action creates. Editing after
 * a save changes the working copy and never the saved version (M-3), so the
 * client baseline cannot move under a meeting.
 *
 * WHAT A SAVED VERSION STORES, AND WHAT IT REFUSES TO STORE.
 *
 * It stores IDENTITY and PROVENANCE: which Option, which version, when, by
 * whom, and the fingerprints of the five things that determined it — the
 * project baseline it inherited, the building scope, the configuration, the
 * schedule and the review. It stores the exact commercial result as decimal
 * STRINGS plus the display total that was on screen.
 *
 * It refuses to store an EDITABLE total. The rail, the review and the saved
 * receipt all print the same value because they all read the same canonical
 * result; the snapshot's copy exists to prove what was saved, is never fed
 * back into a calculation, and is compared against the live result rather
 * than trusted over it (`savedResultMatchesLive`).
 */

/* ─────────────────────────── the saved record ────────────────────────── */

export type SavedOptionGroupLine = Readonly<{
  group: CostGroup
  /** Decimal string; `null` is "no priced position", never zero (rule 16). */
  exact: string | null
}>

/**
 * The commercial result exactly as it stood at save time.
 *
 * `totalExact` is the calculation's own value; `totalDisplay` is the string
 * the user read. Both are stored because a saved offer has to be able to
 * prove BOTH — the exact value it was computed from and the number that was
 * on the screen when somebody committed to it.
 */
export type SavedOptionResult = Readonly<{
  totalExact: string
  totalDisplay: string
  totalLabel: string
  coverage: 'total' | 'subtotal'
  uncertaintyPp: number
  byCostGroup: readonly SavedOptionGroupLine[]
  /** The canonical result's own monotonic version, for identity proofs. */
  resultVersion: number
}>

export type SavedOptionVersion = Readonly<{
  optionId: string
  optionName: string
  /** 1-based, monotonic per Option. A failed save mints no number. */
  version: number
  savedAt: string
  savedBy: string
  /**
   * VR3-05 — the Option this one DESCENDS FROM, or `null` for an Option
   * saved from preparation.
   *
   * Lineage lives on the saved version and not on the Option row because a
   * descendant is created by a SAVE: the relationship is a fact about the
   * commitment ("these decisions, taken from that baseline, on that date"),
   * and an Option row carries no date and no decisions. It is also why a
   * descendant starts at version 1 rather than continuing the source's
   * numbering — it is a new Option with a parent, not a new version of an
   * old one, and the source's history stays exactly as long as it was.
   *
   * Optional on READ: baselines saved before this field existed are valid
   * and simply have no recorded parent. See `hasOnlyKeys` in `store.ts` —
   * adding a key here without adding it to `SAVED_OPTION_VERSION_KEYS`
   * makes every newly written payload fail rehydration.
   */
  sourceOptionId?: string | null
  /** The project baseline this Option inherited, by its own commit id. */
  projectBaselineId: string | null
  buildingScopeFingerprint: string
  configurationFingerprint: string
  scheduleFingerprint: string
  reviewFingerprint: string
  /** The client projection contract version this baseline was validated for. */
  clientProjectionVersion: number
  /** Was the client-safe projection valid at save time? */
  clientProjectionValid: boolean
  result: SavedOptionResult
}>

/**
 * The client projection contract version.
 *
 * Client Mode reads an allowlisted projection, and a saved baseline is only
 * client-safe for the contract it was validated against. Bumping this number
 * invalidates every stored baseline's client eligibility on purpose: a
 * projection whose allowlist has changed has not been checked.
 *
 * **2 — VR3-CP-00.** What Client Presentation exposes changed materially:
 * the proposal now carries project address, offer date and legal entity;
 * per-building storeys, units, the BGF split, WFL/NUF and the basement
 * state; KG 300 construction answers; the DIN 276 composition with its
 * per-row commercial state; the responsibility projection; cost drivers and
 * the Regionalfaktor row; and project imagery — in the export as well as on
 * the stage. That is a different allowlist, so it is a different contract,
 * and a baseline saved against version 1 was never validated for it.
 */
export const CLIENT_PROJECTION_VERSION = 2

/** The transient half of the commitment. It never enters an undoable record. */
export type OptionSaveCommit = Readonly<{
  optionId: string
  /** In flight; `null` once it has failed. */
  stage: 'SAVING' | null
  errorKey: string | null
  /**
   * The version number this attempt is FOR. A retry reuses it, so a failed
   * save followed by a successful one produces one version, not two — the
   * "retry after failure creates no duplicate" requirement, held by the
   * attempt rather than by the caller remembering.
   */
  intendedVersion: number
}>

export type OptionSaveState = {
  /** Immutable saved versions per Option, oldest first. */
  savedOptionVersions: Readonly<Record<string, readonly SavedOptionVersion[]>>
  optionSaveCommit: OptionSaveCommit | null
}

/* ─────────────────────────────── reading ─────────────────────────────── */

export function savedVersionsFor(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
): readonly SavedOptionVersion[] {
  if (!optionId) return []
  return state.savedOptionVersions[optionId] ?? []
}

/** The latest saved version of an Option, or `null` when never saved. */
export function latestSavedVersion(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
): SavedOptionVersion | null {
  const versions = savedVersionsFor(state, optionId)
  return versions.length > 0 ? versions[versions.length - 1]! : null
}

export function nextSavedVersionNumber(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
): number {
  return savedVersionsFor(state, optionId).length + 1
}

export type SaveStage = 'LOCKED' | 'AVAILABLE' | 'SAVING' | 'SAVED' | 'FAILED'

/**
 * The save stage.
 *
 * The order is the contract.
 *
 * `FAILED` deliberately outranks `SAVED`: a failed retry of an Option that
 * already has a saved version has to keep saying so until it is retried or
 * dismissed, or the receipt of the OLD version would read as the outcome of
 * the NEW attempt.
 *
 * `SAVED` means the saved version still describes the working copy, and that
 * question is answered by the REVIEW's own fingerprint — it already covers
 * every material value of the Option (see `reviewFingerprint`), and the
 * saved version recorded it. So "the working copy has moved since the save"
 * is one string comparison, in one place, and cannot disagree with the
 * review's own staleness.
 */
export function optionSaveStage(
  state: Pick<OptionSaveState, 'savedOptionVersions' | 'optionSaveCommit'>,
  optionId: string | null,
  /** Is the final review confirmation in place and still current? */
  reviewConfirmed: boolean,
  /** The review fingerprint of the working copy right now. */
  liveReviewFingerprint: string,
): SaveStage {
  const commit = state.optionSaveCommit
  if (commit && commit.optionId === optionId) {
    if (commit.stage === 'SAVING') return 'SAVING'
    if (commit.errorKey !== null) return 'FAILED'
  }
  const saved = latestSavedVersion(state, optionId)
  if (saved && saved.reviewFingerprint === liveReviewFingerprint) return 'SAVED'
  return reviewConfirmed ? 'AVAILABLE' : 'LOCKED'
}

/**
 * Unsaved working changes: a saved version exists and no longer describes
 * the working copy. This is NOT an error — it is the ordinary state of
 * continuing to work after a save, and the saved client baseline stays
 * exactly where it was.
 */
export function hasUnsavedWorkingChanges(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
  liveReviewFingerprint: string,
): boolean {
  const saved = latestSavedVersion(state, optionId)
  if (!saved) return false
  return saved.reviewFingerprint !== liveReviewFingerprint
}

/* ────────────────────────── the client-mode gate ────────────────────── */

/**
 * THE ONE PREDICATE for Client Mode availability.
 *
 * "Client Mode availability has one authoritative predicate" is this
 * ticket's done condition, and this function is it. Three things, all
 * necessary: a saved version exists, it validated the client projection at
 * save time, and it was validated against the CURRENT projection contract.
 *
 * Deliberately NOT part of it: configuration completeness, the review's
 * current staleness, or whether the working copy has moved on. A saved
 * baseline is immutable, so continuing to work never revokes the client's
 * right to see what was saved — that is the entire point of saving.
 */
export function clientBaselineFor(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
): SavedOptionVersion | null {
  const saved = latestSavedVersion(state, optionId)
  if (!saved) return null
  if (!saved.clientProjectionValid) return null
  return saved.clientProjectionVersion === CLIENT_PROJECTION_VERSION ? saved : null
}

export function clientModeAvailableFor(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
): boolean {
  return clientBaselineFor(state, optionId) !== null
}

export type ClientModeLockReason =
  | 'notSaved'
  | 'projectionInvalid'
  | 'projectionOutdated'

/** Why Client Mode is locked, so the lock can name its own recovery. */
export function clientModeLockReason(
  state: Pick<OptionSaveState, 'savedOptionVersions'>,
  optionId: string | null,
): ClientModeLockReason | null {
  const saved = latestSavedVersion(state, optionId)
  if (!saved) return 'notSaved'
  if (!saved.clientProjectionValid) return 'projectionInvalid'
  if (saved.clientProjectionVersion !== CLIENT_PROJECTION_VERSION) return 'projectionOutdated'
  return null
}

/* ───────────────────────── numerical identity ───────────────────────── */

/**
 * Does a saved version still agree with the live canonical result?
 *
 * Used by the review and by the receipt to prove the ticket's numerical
 * invariant ("Saved, validation and commercial-rail numbers are identical in
 * exact value, meaning and uncertainty") rather than to assert it. Meaning
 * and uncertainty are part of the comparison, not just the amount: two
 * identical figures under different labels are two different facts.
 */
export function savedResultMatchesLive(
  saved: SavedOptionVersion,
  live: Readonly<{
    totalExact: string
    totalLabel: string
    coverage: 'total' | 'subtotal'
    uncertaintyPp: number
  }>,
): boolean {
  return saved.result.totalExact === live.totalExact
    && saved.result.totalLabel === live.totalLabel
    && saved.result.coverage === live.coverage
    && saved.result.uncertaintyPp === live.uncertaintyPp
}
