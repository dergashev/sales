import {
  KG_DECIDED_SCOPE_GROUPS,
  KG_SCOPE_GROUPS,
  type KgScopeGroup,
} from '../engine/kgConfiguration'
import { hasV3Surfaces } from '../lib/variantLock'
import { CONFIGURATOR_STEP, type ConfiguratorStepId } from './chapters'
import type { PipelineView } from './clientProjection'
import { buildingScopeStale } from './optionBuildingScope'
import { clientModeLockReason, optionSaveStage } from './optionSave'
import {
  KG_CHAPTER_STEP,
  canBeginConfiguration,
  configForOption,
  finalValidationConfirmedFor,
  kgChapterProgressFor,
  kgConfigurationCompleteFor,
  kgScopeStatus,
  reviewFingerprintFor,
  type Store,
} from './store'

/**
 * The Option's lifecycle, DERIVED — and the total destination function that
 * opening one resolves to.
 *
 * Accepted 2026-09-06 Design Director audit of the Project → Option →
 * Configurator information architecture (`docs/audit/
 * project-option-workflow-06a4acf/`), scope addition A, CPO ruling of the
 * same day. Both halves of this module answer one complaint the audit
 * measured live: three freshly created Options were indistinguishable,
 * because six independent gates decide an Option's lifecycle while the card
 * badge exposed three words, and the `Öffnen` button did not say — and
 * could not predict — where it would land.
 *
 * FOUR PROPERTIES ARE NON-NEGOTIABLE, and they are why this file exists at
 * all rather than a field on the Option row:
 *
 * 1. **Derived, never stored.** Nothing here is added to the Option row, to
 *    `OptionConfig` or to `OPTION_CONFIG_KEYS`, and nothing is persisted.
 *    Same shape as `readiness()` and `optionSaveStage()`.
 * 2. **Never in an enabling condition.** This is the rule `cleanPresentation()`
 *    already carries. Every gate keeps reading its OWN predicate:
 *    `canCreateOptions`, `canBeginConfiguration`, `configurationComplete`,
 *    `optionSaveStage`, `clientModeAvailableFor` are untouched, and
 *    `optionLifecycleState` is referenced by no reducer at all — the store
 *    imports `optionOpenDestination`/`optionNav` only, which decide WHERE
 *    navigation lands and never WHETHER it may. A regression test proves
 *    every gate's serialised output is identical in every reachable state.
 * 3. **It invents no state.** Every value below is a combination of
 *    predicates that already existed at `06a4acf`, cited on its own branch,
 *    and every one of them is reachable by driving the real store.
 * 4. **It is the ONE answer.** The badge, the resume line, the ordering and
 *    the `Öffnen` destination all read it, so a card cannot say `In Arbeit ·
 *    Kalkulieren` beside a button that opens Gebäude & Umfang.
 *
 * ONE STATE VIEW, NOT SIX PARTIAL READERS. Most of the released selectors
 * read the FLAT working copy (`optionSaveStageFor`, `kgConfigurationCompleteFor`,
 * …) because exactly one Option is unpacked into the store at a time. A
 * collection has to answer for all of them, so each question is asked against
 * `{...state, ...config}` — the same merge `openOption` already performs when
 * it evaluates `canBeginConfiguration` for the Option it is about to unpack.
 */

/**
 * The eleven states of `project-option-state-matrix.md` §B.
 *
 * `RECHECK` is the matrix's B10 and covers BOTH intra-Option staleness
 * signals — a saved building scope whose fingerprint no longer matches
 * (`buildingScopeStale`) and a KG scope that was confirmed and then reopened
 * (`kgScopeStatus === 'recheck'`). They are one state because they are one
 * fact for the reader ("something you already settled needs you again") and
 * because the destination function names WHICH, which is what a route is
 * for. Cross-option staleness is deliberately absent: it does not exist in
 * the Product (M-1/M-3, audit OPT-12) and this module does not invent it.
 */
export type OptionLifecycleState =
  | 'NEW'
  | 'BOUNDARIES_OPEN'
  | 'CALCULATING'
  | 'SCHEDULE_OPEN'
  | 'REVIEW_OPEN'
  | 'SAVE_AVAILABLE'
  | 'SAVE_FAILED'
  | 'RECHECK'
  | 'CLIENT_LOCKED'
  | 'CLIENT_READY'
  | 'SENT'

/** The four stages of the Option workspace. There is no fifth. */
export type OptionStageId =
  | 'konfigurieren' | 'kalkulieren' | 'pruefen' | 'praesentieren'

export const OPTION_STAGES: readonly OptionStageId[] = [
  'konfigurieren', 'kalkulieren', 'pruefen', 'praesentieren',
]

/** A nested step of a stage. Slugs are also the URL segment. */
export type OptionStepId =
  | 'gebaeude-umfang' | 'leistungsabgrenzung'
  | 'kg200' | 'kg300' | 'kg400' | 'kg500' | 'kg600' | 'kg700'
  /**
   * B2 · requirement 16 — the complete cost explanation, as a MEMBER of
   * Calculate rather than a destination beside it.
   *
   * The route existed and the content was right; what was wrong was that it
   * belonged to no stage. `destinationOfNav` could not classify
   * `pipelineView: 'kostendetails'`, so it fell through to its default and
   * opening the calculation's own explanation switched the visible secondary
   * navigation back to Configure. Giving it a step id is what makes
   * Calculate stay current while it is open.
   */
  | 'verantwortung' | 'alle-kosten' | 'terminplan'

export type OptionDestination = Readonly<{
  stage: OptionStageId
  /** `null` for a stage whose surface has no nested step (Präsentieren). */
  step: OptionStepId | null
}>

/** The KG group each Kalkulieren step configures, and the reverse. */
export const KG_STEP_ID: Readonly<Record<KgScopeGroup, OptionStepId>> = {
  KG_200: 'kg200', KG_300: 'kg300', KG_400: 'kg400',
  KG_500: 'kg500', KG_600: 'kg600', KG_700: 'kg700',
}

/** The nested steps a stage declares, in order. */
export const OPTION_STAGE_STEPS: Readonly<Record<OptionStageId, readonly OptionStepId[]>> = {
  konfigurieren: ['gebaeude-umfang', 'leistungsabgrenzung'],
  // VR3-TGA-UX-00: `verantwortung` sits between the last cost group and the
  // schedule — the canonical order the registry (`chapters.ts`) declares.
  // The canonical Calculate order (B2 target): the six cost groups, then
  // Responsibility, then All cost details, then Schedule.
  kalkulieren: [
    ...KG_SCOPE_GROUPS.map((g) => KG_STEP_ID[g]),
    'verantwortung', 'alle-kosten', 'terminplan',
  ],
  /**
   * NO nested steps (Product Owner, 2026-09-16). The released pair
   * `finale-pruefung` / `speichern` resolved to ONE surface, so it was a
   * sequence with a single place in it. Checking and saving happen on the
   * Prüfen stage itself; the next place is Präsentieren.
   */
  pruefen: [],
  praesentieren: [],
}

/**
 * A destination, as the store's own navigation primitives.
 *
 * ONE table. The rail, the card action, the switcher, the route decoder and
 * the route encoder all resolve through it, so a destination cannot mean one
 * thing to a button and another to a URL.
 */
export type OptionNav = Readonly<{
  view: PipelineView
  step: ConfiguratorStepId | null
}>

const STEP_NAV: Readonly<Record<OptionStepId, OptionNav>> = {
  'gebaeude-umfang': { view: 'buildingScope', step: null },
  leistungsabgrenzung: { view: 'konfigurator', step: CONFIGURATOR_STEP.SCOPE_BOUNDARIES },
  kg200: { view: 'konfigurator', step: CONFIGURATOR_STEP.KG_200_DETAILS },
  kg300: { view: 'konfigurator', step: CONFIGURATOR_STEP.KG_300_DETAILS },
  kg400: { view: 'konfigurator', step: CONFIGURATOR_STEP.KG_400_DETAILS },
  kg500: { view: 'konfigurator', step: CONFIGURATOR_STEP.KG_500_DETAILS },
  kg600: { view: 'konfigurator', step: CONFIGURATOR_STEP.KG_600_DETAILS },
  kg700: { view: 'konfigurator', step: CONFIGURATOR_STEP.KG_700_DETAILS },
  verantwortung: { view: 'konfigurator', step: CONFIGURATOR_STEP.RESPONSIBILITY },
  /**
   * Its own PipelineView, kept — the page is a full-width explanation and
   * not a Configurator chapter. What changes is that the step it belongs to
   * is now declared, so the round trip through `destinationOfNav` below
   * resolves it to Calculate instead of to the default.
   *
   * The `step` it carries is the Configurator position to restore on the way
   * back: leaving the explanation returns to the last cost decision, not to
   * the top of the stage.
   */
  'alle-kosten': { view: 'kostendetails', step: null },
  terminplan: { view: 'konfigurator', step: CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE },
}

const STAGE_NAV: Readonly<Record<OptionStageId, OptionNav>> = {
  konfigurieren: STEP_NAV['gebaeude-umfang'],
  kalkulieren: STEP_NAV.kg200,
  pruefen: { view: 'konfigurator', step: CONFIGURATOR_STEP.FINAL_VALIDATION },
  praesentieren: { view: 'praesentieren', step: null },
}

export function optionNav(destination: OptionDestination): OptionNav {
  return destination.step ? STEP_NAV[destination.step] : STAGE_NAV[destination.stage]
}

export function isOptionStageId(value: string): value is OptionStageId {
  return (OPTION_STAGES as readonly string[]).includes(value)
}

export function isOptionStepOf(stage: OptionStageId, value: string): value is OptionStepId {
  return (OPTION_STAGE_STEPS[stage] as readonly string[]).includes(value)
}

/**
 * Which stage and step the CURRENT store position is, so the rail can mark
 * itself and the URL can name it. The inverse of `optionNav`.
 */
export function destinationOfNav(
  view: PipelineView, step: ConfiguratorStepId,
): OptionDestination {
  if (view === 'praesentieren') return { stage: 'praesentieren', step: null }
  if (view === 'buildingScope') return { stage: 'konfigurieren', step: 'gebaeude-umfang' }
  // B2 · requirement 16. Without this line the complete cost explanation is
  // an unclassifiable view, and the fall-through below answers `Configure`
  // for it — the exact IA defect the audit measured: the calculation's own
  // explanation switching the secondary navigation to another stage.
  if (view === 'kostendetails') return { stage: 'kalkulieren', step: 'alle-kosten' }
  if (view !== 'konfigurator') return { stage: 'konfigurieren', step: 'gebaeude-umfang' }
  if (step === CONFIGURATOR_STEP.SCOPE_BOUNDARIES) {
    return { stage: 'konfigurieren', step: 'leistungsabgrenzung' }
  }
  if (step === CONFIGURATOR_STEP.RESPONSIBILITY) {
    return { stage: 'kalkulieren', step: 'verantwortung' }
  }
  if (step === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE) {
    return { stage: 'kalkulieren', step: 'terminplan' }
  }
  if (step === CONFIGURATOR_STEP.FINAL_VALIDATION) {
    return { stage: 'pruefen', step: null }
  }
  const kg = (Object.entries(KG_CHAPTER_STEP) as Array<[KgScopeGroup, ConfiguratorStepId]>)
    .find(([, id]) => id === step)?.[0]
  return kg
    ? { stage: 'kalkulieren', step: KG_STEP_ID[kg] }
    : { stage: 'konfigurieren', step: 'leistungsabgrenzung' }
}

/* ───────────────────────────── the state view ─────────────────────────── */

/**
 * The store as it would be with `optionId` unpacked into the flat fields.
 *
 * `configForOption` already returns the ACTIVE Option's flat fields via
 * `captureConfig`, so the merge is a no-op for the active Option and a swap
 * for every other one. `null` means the Option has no configuration at all,
 * which is a corrupted state the product refuses to render (see
 * `openOption`'s deliberate throw) rather than a lifecycle value.
 */
export function optionStateView(s: Store, optionId: string): Store | null {
  const config = configForOption(s, optionId)
  return config ? { ...s, ...config } : null
}

function saveStageOf(s: Store, optionId: string, view: Store) {
  return optionSaveStage(
    s, optionId, finalValidationConfirmedFor(view), reviewFingerprintFor(view),
  )
}

/**
 * THE lifecycle value. First match wins, and the order is the contract.
 *
 * `SENT` outranks everything because a sent Option is an immutable snapshot
 * (M-3) and that is the fact the reader needs first. `SAVE_FAILED` outranks
 * `SAVED` for the reason `optionSaveStage` already states: a failed retry
 * must keep saying so, or the old receipt reads as the new outcome.
 */
export function optionLifecycleState(
  s: Store, optionId: string,
): OptionLifecycleState | null {
  const view = optionStateView(s, optionId)
  if (!view) return null
  // B11 — `snapshots[].optionId` is the only "sent" fact the Product has.
  if (s.snapshots.some((snapshot) => snapshot.optionId === optionId)) return 'SENT'
  const saveStage = saveStageOf(s, optionId, view)
  // B7 — `optionSave.ts:177`.
  if (saveStage === 'FAILED') return 'SAVE_FAILED'
  // B10 — `optionBuildingScope.ts:365-369`. Checked BEFORE B1: a stale scope
  // fails `buildingScopeSaved` too, and "never configured" is a different
  // sentence from "what you saved no longer matches".
  if (buildingScopeStale(view)) return 'RECHECK'
  // B1 — the Konfigurator gate itself. For every Option created from a
  // project baseline this IS `buildingScopeSaved`; the legacy branch covers
  // a directly driven store that has no `scopeBuildings` at all.
  if (!canBeginConfiguration(view)) return 'NEW'
  const scopeStatus = kgScopeStatus(view)
  // B10, second signal — `store.ts:3001`.
  if (scopeStatus === 'recheck') return 'RECHECK'
  // B2 — `store.ts:3001`.
  if (scopeStatus !== 'confirmed') return 'BOUNDARIES_OPEN'
  // B3 — `store.ts:3048`.
  if (!kgConfigurationCompleteFor(view)) return 'CALCULATING'
  // B4 — `OptionConfig.scheduleConfirmation`.
  if (view.scheduleConfirmation === null) return 'SCHEDULE_OPEN'
  // B5 — `OptionConfig.reviewConfirmation` (`store.ts:559-588`).
  if (view.reviewConfirmation === null) return 'REVIEW_OPEN'
  // B6 — everything is decided and the explicit save has not happened yet.
  // `SAVING` lands here too: it is the same sentence one moment earlier.
  if (saveStage !== 'SAVED') return 'SAVE_AVAILABLE'
  // B9 / B8 — `optionSave.ts:226,243`.
  return clientModeLockReason(s, optionId) === null ? 'CLIENT_READY' : 'CLIENT_LOCKED'
}

/**
 * The first cost group that still owes work.
 *
 * An EXCLUDED group owes none — that decision was taken deliberately and
 * landing on it would present a settled question as an open one.
 */
function firstOpenKgStep(view: Store): OptionStepId {
  // Asked groups only — the baseline ones have no step to land on.
  const open = KG_DECIDED_SCOPE_GROUPS.find((group) => {
    if (view.kgConfig?.scope[group] !== 'included') return false
    return kgChapterProgressFor(view, group)?.state !== 'complete'
  })
  const included = KG_DECIDED_SCOPE_GROUPS
    .find((g) => view.kgConfig?.scope[g] === 'included')
  return KG_STEP_ID[open ?? included ?? KG_DECIDED_SCOPE_GROUPS[0]]
}

/**
 * WHERE opening this Option lands — TOTAL, deterministic, and named on the
 * button before the click.
 *
 * The audit measured the released `openOption` as non-deterministic and
 * unannounced (`store.ts:7168-7222`): it chose between two surfaces from one
 * predicate and said nothing about which. This is the same journey, resolved
 * all the way to the end, from predicates that already existed. It decides
 * nothing about what is ALLOWED — a locked stage is still locked, and this
 * function simply never returns one, because the first incomplete stage is by
 * construction the furthest the gates permit.
 */
export function optionOpenDestination(
  s: Store, optionId: string,
): OptionDestination | null {
  const view = optionStateView(s, optionId)
  if (!view) return null
  if (!canBeginConfiguration(view)) {
    return { stage: 'konfigurieren', step: 'gebaeude-umfang' }
  }
  if (kgScopeStatus(view) !== 'confirmed') {
    return { stage: 'konfigurieren', step: 'leistungsabgrenzung' }
  }
  if (!kgConfigurationCompleteFor(view)) {
    return { stage: 'kalkulieren', step: firstOpenKgStep(view) }
  }
  if (view.scheduleConfirmation === null) {
    return { stage: 'kalkulieren', step: 'terminplan' }
  }
  if (view.reviewConfirmation === null) {
    return { stage: 'pruefen', step: null }
  }
  if (saveStageOf(s, optionId, view) !== 'SAVED') {
    return { stage: 'pruefen', step: null }
  }
  // A SAVED Option whose client projection is invalid or was validated
  // against an older contract has no reachable Präsentieren: the stage is
  // locked and stating its reason, so the destination is the review that
  // produced the baseline (state matrix B9). The function stays total and
  // never returns a stage the gates refuse.
  if (clientModeLockReason(s, optionId) !== null) {
    return { stage: 'pruefen', step: null }
  }
  return { stage: 'praesentieren', step: null }
}

/**
 * The collection's order: incomplete first, then most recently changed.
 *
 * "Incomplete" is `optionLifecycleState` again rather than a second opinion —
 * a client-ready or sent Option is finished work, everything else still owes
 * something. Ties fall back to the Option's own array order, which is
 * creation order, so the sort is total and stable across renders.
 */
const FINISHED: ReadonlySet<OptionLifecycleState> = new Set(['CLIENT_READY', 'SENT'])

export function optionIsFinished(state: OptionLifecycleState | null): boolean {
  return state !== null && FINISHED.has(state)
}

/** The last journalled event that belongs to this Option, or `null`. */
export function optionLastChangedAt(s: Store, optionId: string): string | null {
  for (let i = s.journal.length - 1; i >= 0; i -= 1) {
    const event = s.journal[i]
    if (event && event.optionId === optionId) return event.at
  }
  return null
}

export type OrderedOption = Readonly<{
  id: string
  name: string
  /** The first Option of the project: the variant the others depart from. */
  isBase: boolean
  state: OptionLifecycleState | null
  destination: OptionDestination | null
  lastChangedAt: string | null
}>

/* Naming lives in its own module — see `optionNaming` for why — and is
   re-exported here so every existing reader keeps one import. */
export {
  BASE_OPTION_AUTO_NAME, isAutoBaseName, optionDisplayName,
} from './optionNaming'

/**
 * The list order.
 *
 * `v3` reads the collection as a BASE and its departures: the first Option
 * stays at the top, every later one follows in the order it was created, so
 * a new variant appears at the bottom and nothing above it moves.
 *
 * `v1`/`v2` keep the order they shipped with — incomplete first, most
 * recently touched above the rest. The variants are compared side by side in
 * testing, and silently changing the two that were not asked about would
 * destroy exactly what the comparison is for.
 */
export function orderedOptions(s: Store): OrderedOption[] {
  const rows = s.options.map((option, index) => ({
    option,
    index,
    isBase: index === 0,
    state: optionLifecycleState(s, option.id),
    destination: optionOpenDestination(s, option.id),
    lastChangedAt: optionLastChangedAt(s, option.id),
  }))
  const ordered = hasV3Surfaces(s.navVariant)
    ? rows
    : rows.slice().sort((a, b) => {
      const finishedA = optionIsFinished(a.state) ? 1 : 0
      const finishedB = optionIsFinished(b.state) ? 1 : 0
      if (finishedA !== finishedB) return finishedA - finishedB
      const changedA = a.lastChangedAt ?? ''
      const changedB = b.lastChangedAt ?? ''
      if (changedA !== changedB) return changedA < changedB ? 1 : -1
      return b.index - a.index
    })
  return ordered.map(({ option, isBase, state, destination, lastChangedAt }) => ({
    id: option.id,
    name: option.name,
    isBase,
    state,
    destination,
    lastChangedAt,
  }))
}

/**
 * The Option a returning user should continue, or `null` when every Option
 * is finished. Reads the same order the list renders, so the resume line can
 * never name a row the list puts somewhere else.
 */
export function resumeOption(s: Store): OrderedOption | null {
  return orderedOptions(s).find((row) => !optionIsFinished(row.state)) ?? null
}
