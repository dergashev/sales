import type {
  OptionDestination,
  OptionLifecycleState,
  OptionStageId,
  OptionStepId,
} from '../state/optionLifecycle'

/**
 * ONE vocabulary for the Option workspace, in one place.
 *
 * The audit found the same stage carrying different words in different rails
 * (`Verstehen` beside `Projektverständnis`, `Konfigurieren` as a sub-stage of
 * itself) and a card badge whose three words collapsed eleven distinguishable
 * lifecycle states. Both are the same failure: the label was decided where it
 * was rendered. Here it is decided once, so the rail, the card, the context
 * header, the switcher and the resume line cannot disagree about what a state
 * is called or where an action leads.
 *
 * Every entry resolves to a real key present in BOTH dictionaries. Nothing
 * here goes through `useTx()`: the bridge returns its German input unchanged
 * when the delivery has no match, silently, which is exactly how the released
 * `Öffnen` and `Opportunity Options` shipped untranslated (recorded pitfall,
 * `[[vr3-project-readiness]]`).
 */

type Translate = (key: string, values?: Record<string, string | number>) => string

export const OPTION_STAGE_LABEL_KEY: Readonly<Record<OptionStageId, string>> = {
  konfigurieren: 'vr3.journey.stage.configure',
  kalkulieren: 'vr3.journey.stage.calculate',
  pruefen: 'vr3.journey.stage.validate',
  praesentieren: 'vr3.journey.stage.present',
}

const STEP_LABEL_KEY: Readonly<Record<OptionStepId, string | null>> = {
  'gebaeude-umfang': 'nav.buildingScope',
  leistungsabgrenzung: 'vr3.spine.step.scopeBoundaries',
  // `KG 200` is a DIN 276 identifier, not product copy: it is the same
  // string in both locales and belongs in no dictionary.
  kg200: null, kg300: null, kg400: null, kg500: null, kg600: null, kg700: null,
  verantwortung: 'vr3.spine.step.responsibility',
  'alle-kosten': 'vr3.spine.step.costDetails',
  terminplan: 'vr3.spine.step.schedule',
}

export function optionStepLabel(t: Translate, step: OptionStepId): string {
  const key = STEP_LABEL_KEY[step]
  return key ? t(key) : `KG ${step.slice(2)}`
}

export function optionStageLabel(t: Translate, stage: OptionStageId): string {
  return t(OPTION_STAGE_LABEL_KEY[stage])
}

/**
 * What the destination is CALLED on a control that leads to it.
 *
 * The Kalkulieren stage answers with the STAGE, every other with its STEP.
 * That is the state matrix's own choice and it is a readability one: `KG 300`
 * on its own tells a seller nothing about where they are in the journey,
 * while `Terminplan` or `Finale Prüfung` name a distinct piece of work.
 */
export function optionDestinationLabel(
  t: Translate, destination: OptionDestination,
): string {
  if (destination.stage === 'kalkulieren'
    && destination.step !== 'terminplan' && destination.step !== 'verantwortung') {
    return optionStageLabel(t, 'kalkulieren')
  }
  return destination.step
    ? optionStepLabel(t, destination.step)
    : optionStageLabel(t, destination.stage)
}

/** The glyph beside a lifecycle word. Never the only carrier (rule 8). */
const LIFECYCLE_SIGN: Readonly<Record<OptionLifecycleState, string>> = {
  NEW: '○',
  BOUNDARIES_OPEN: '◐',
  CALCULATING: '◐',
  SCHEDULE_OPEN: '◐',
  REVIEW_OPEN: '◐',
  SAVE_AVAILABLE: '◐',
  SAVE_FAILED: '⚠',
  RECHECK: '⚠',
  CLIENT_LOCKED: '⚠',
  CLIENT_READY: '✓',
  SENT: '●',
}

export function optionLifecycleBadge(
  t: Translate,
  state: OptionLifecycleState,
  destination: OptionDestination | null,
): { sign: string; label: string } {
  const base = t(`vr3.option.lifecycle.${state}`)
  // `Erneut prüfen` alone does not say WHAT to recheck, and the two signals
  // it covers land on two different steps.
  const label = state === 'RECHECK' && destination
    ? `${base} · ${optionDestinationLabel(t, destination)}`
    : base
  return { sign: LIFECYCLE_SIGN[state], label }
}

/**
 * The Open button's label — it NAMES ITS DESTINATION before the click.
 *
 * `Öffnen` on its own was the released control, and the audit measured it as
 * non-deterministic and unannounced. A finished Option is `Präsentieren`, a
 * new one is `Öffnen · <first step>`, a sent one is `Öffnen` (there is
 * nothing left to continue), and everything in between is `Fortsetzen · …`.
 */
export function optionOpenActionLabel(
  t: Translate,
  state: OptionLifecycleState | null,
  destination: OptionDestination | null,
): string {
  if (state === 'SENT' || !destination) return t('vr3.option.open')
  if (destination.stage === 'praesentieren') return t('vr3.journey.stage.present')
  const where = optionDestinationLabel(t, destination)
  return state === 'NEW'
    ? t('vr3.option.openAt', { where })
    : t('vr3.option.resumeAt', { where })
}
