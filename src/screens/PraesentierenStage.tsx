import type { RefObject } from 'react'
import {
  clientModeLockReasonFor,
  latestSavedOptionVersion,
  useStore,
} from '../state/store'
import { OutputProfileSwitch } from '../components/designSystem'
import { Button } from '../components/primitives'
import { useT, useTx, localizeMoneyText } from '../i18n'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

/**
 * `Präsentieren` — the Option stage whose ACTION enters the client
 * projection.
 *
 * Accepted 2026-09-06 IA audit, "Calculate / Validate / Present ownership".
 * `Präsentieren` was the sixth entry of the project rail and permanently
 * `'upcoming'`, for a reason the audit names precisely: it is not a VIEW but
 * a MODE. `mode: 'praesentation'` replaces the whole shell
 * (`App.tsx:242-243`), so showing it as the peer of five view-like stages was
 * a category error, and no state machine could have advanced it.
 *
 * As a stage of ONE Option it becomes true: it is `locked` in the rail
 * exactly while `clientModeAvailableFor()` is false and states the
 * `ClientModeLockReason` there, and its surface carries the RELEASED
 * `OutputProfileSwitch` — same control, same gate, same three ordered
 * blocked reasons, same `role="status"` mode indicator that the retired left
 * rail used to hold. Nothing about entering the client projection changed:
 * `ClientOutputGateDialog` is still the only door, and
 * `PresentationShell`, the `mode` field and `setViewedOption` are untouched.
 *
 * The stage is REACHABLE while it is locked, deliberately — the T-016
 * principle this product already applies to every other gated stage: a
 * locked stage is reachable so that it can explain itself, and it lands on
 * its own gate rather than on its contents.
 *
 * The saved baseline is stated, not recomputed: the number a client will see
 * is the one that was committed, so the receipt prints the SAVED version's
 * own display total and its own Declared Pricing Scope label (R-18).
 */
export function PraesentierenStage({
  modeRef,
}: {
  modeRef?: RefObject<HTMLButtonElement>
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const { reduced } = useSemanticMotion()
  const optionId = s.activeOptionId
  const option = s.options.find((o) => o.id === optionId)
  const saved = latestSavedOptionVersion(s, optionId)

  // The three reasons, ordered earliest-to-latest in the journey, exactly as
  // the retired rail ordered them: no building scope, then no configuration,
  // then no saved Option. Copied rather than re-derived so the sentence the
  // user reads is about the step they are actually on.
  const buildingGateBlocked = !s.canBeginConfiguration()
  const configurationGateBlocked = !s.configurationModeChosen || s.configurationModeEditing
  const clientBaselineBlocked = clientModeLockReasonFor(s, optionId) !== null
  const blocked = buildingGateBlocked || configurationGateBlocked || clientBaselineBlocked
  const exportBlocked = buildingGateBlocked || !s.configurationComplete()
  const blockedReason = buildingGateBlocked
    ? t('shell.mode.blockedReason')
    : configurationGateBlocked
      ? t('configurator.mode.clientBlocked')
      : clientBaselineBlocked
        ? t('vr3.client.blockedReason')
        : undefined

  return (
    <div className="a3-present-stage">
      <p className="a3-cap">{t('vr3.journey.stage.present')}</p>
      <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
        {option
          ? t('vr3.present.title', { option: option.name })
          : t('vr3.journey.stage.present')}
      </h1>
      <p className="a3-present-lead">{t('vr3.present.lead')}</p>

      {saved && (
        <dl className="a3-present-baseline">
          <div className="a3-present-baseline-row">
            <dt>{t('vr3.present.baselineVersion')}</dt>
            <dd className="numeric">{saved.version}</dd>
          </div>
          <div className="a3-present-baseline-row">
            <dt>{tx(saved.result.totalLabel)}</dt>
            <dd className="numeric">
              {localizeMoneyText(saved.result.totalDisplay, s.uiLanguage)}
            </dd>
          </div>
        </dl>
      )}

      <OutputProfileSwitch
        mode={s.mode}
        blocked={blocked}
        blockedReason={blockedReason}
        checkButtonRef={modeRef}
        onCheck={() => s.setGateOpen(true)}
        onExit={() => startContinuityTransition(reduced, () => s.setMode('intern'))}
      />

      {/* Export is an Option ACTION, not a stage of it (the audit's ownership
          map) — so it lives beside the presentation action rather than as a
          numbered item beneath a rail. Its gate is UNCHANGED: the building
          gate plus the whole-option confirmation (Task 03, F-16/PD-3), with
          the same two ordered reasons the retired rail carried, so a 0-€ or
          half-configured offer is still not exportable. */}
      <div className="a3-present-actions">
        <Button
          variant="secondary"
          disabled={exportBlocked}
          disabledReason={exportBlocked
            ? (buildingGateBlocked
              ? t('buildingScope.gate.navigationReason')
              : t('configurator.finalGate.exportBlockedReason'))
            : undefined}
          onClick={() => s.setPipelineView('export')}
        >
          {t('nav.export')}
        </Button>
      </div>
    </div>
  )
}
