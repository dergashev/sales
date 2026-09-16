import type { RefObject } from 'react'
import {
  clientModeAvailableForOption,
  clientModeLockReasonFor,
  latestSavedOptionVersion,
  unsavedWorkingChangesFor,
  useStore,
} from '../state/store'
import { OutputProfileSwitch } from '../components/designSystem'
import { Button } from '../components/primitives'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { SaveReceipt } from '../design-system/SaveReceipt'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { Decimal } from 'decimal.js'
import { label as moneyLabel, present } from '../engine/money'
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
  /**
   * A post-save working edit NEVER moves the saved baseline (M-3) — and this
   * is now the surface the save lands on, so this is where that distinction
   * has to be legible. Without it the auto-route would have carried the
   * reader past the only sentence that says the version below is not what
   * they are currently editing.
   */
  const unsaved = unsavedWorkingChangesFor(s)
  const clientAvailable = clientModeAvailableForOption(s, optionId)
  const lockReason = clientModeLockReasonFor(s, optionId)

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
      {/* No eyebrow: the rail already names the stage, and repeating it
          directly above a heading that contains the same word is the
          duplicated label rule 9 forbids. */}
      {/*
        * DER BELEG IST DIE STUFE, sobald eine Fassung gespeichert ist
        * (Owner, 17.09.2026).
        *
        * Vorher stand hier eine schlichtere Wiederholung derselben drei
        * Angaben — Fassung, Zeitpunkt, Summe — neben einem Beleg, den der
        * Schritt davor schon gedruckt hatte. Es ist derselbe Beleg, also
        * dieselbe Komponente: `SaveReceipt` aus der Design-System-Quelle,
        * nicht eine zweite Abschrift ihrer Auszeichnung.
        *
        * Die Handlung bleibt UNTEN beim `OutputProfileSwitch`: er ist die
        * freigegebene Tür in die Kundenansicht und trägt die drei
        * geordneten Sperrgründe. Ein zweiter Knopf mit demselben Ziel im
        * Beleg wäre dieselbe Handlung an zwei Orten.
        */}
      {saved ? (
        <SaveReceipt
          eyebrow={t('vr3.save.receipt.eyebrow', { version: saved.version })}
          heading={t('vr3.save.receipt.heading', { option: saved.optionName })}
          explanation={t('vr3.save.receipt.explanation')}
          rows={[
            {
              id: 'savedAt',
              label: t('vr3.save.receipt.row.savedAt'),
              value: savedAtLabel(saved.savedAt, s.uiLanguage),
            },
            {
              id: 'total',
              // Die Bezeichnung des Totals komponiert die Engine auf Deutsch
              // (R-18) und wird wie bei jedem anderen Leser überbrückt.
              label: tx(saved.result.totalLabel),
              value: localizeMoneyText(
                moneyLabel(present(new Decimal(saved.result.totalExact))),
                s.uiLanguage,
              ),
            },
            {
              id: 'clientMode',
              label: t('vr3.save.receipt.row.clientMode'),
              value: t(clientAvailable
                ? 'vr3.save.receipt.row.clientAvailable'
                : 'vr3.save.receipt.row.clientLocked'),
            },
          ]}
          /* Nur die Sperre spricht — wie auf dem Beleg der Prüfung. */
          unlock={clientAvailable ? undefined : {
            tone: 'attention',
            label: t('vr3.save.unlock.locked'),
            reason: t(lockReason === 'projectionInvalid'
              ? 'vr3.save.unlock.projectionInvalid'
              : lockReason === 'projectionOutdated'
                ? 'vr3.save.unlock.projectionOutdated'
                : 'vr3.save.unlock.notSaved'),
          }}
        />
      ) : (
        <>
          <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
            {option
              ? t('vr3.present.title', { option: option.name })
              : t('vr3.journey.stage.present')}
          </h1>
          <p className="a3-present-lead">{t('vr3.present.lead')}</p>
        </>
      )}

      {saved && unsaved && (
        <div className="a3-present-unsaved">
          <SemanticStatus
            as="div"
            tone="stale"
            label={t('vr3.save.unsaved.label')}
            reason={t('vr3.save.unsaved.reason', { version: saved.version })}
          />
          <Button
            variant="secondary"
            onClick={() => {
              s.setReviewFocusSection('projectBaseline')
              s.openConfiguratorStepAt(CONFIGURATOR_STEP.FINAL_VALIDATION)
              s.setPipelineView('konfigurator')
            }}
          >
            {t('vr3.save.unsaved.reopen')}
          </Button>
        </div>
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

/**
 * The saved-at moment, in the reader's locale (rule 36) — date and time,
 * because two versions of one Option can be minted on the same day.
 */
function savedAtLabel(iso: string, language: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}
