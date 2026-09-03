import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import {
  clientBaselineConfig,
  clientDecisionValue,
  clientPresentationDecisions,
  clientScenarioDelta,
  clientScenarioNameAvailable,
  clientScenarioTrustedNow,
  clientScenarioWarnings,
  useStore,
} from '../state/store'
import { scenarioChangeCount } from '../state/clientScenario'
import type { PresentationDecision } from '../state/clientScenario'
import { CommercialNumber, signedMoneyText } from '../design-system/CommercialNumber'
import { useSemanticMotion } from '../design-system/motion'
import { useT } from '../i18n'
import { Button } from './primitives'
import { ClientPanel, ClientFactRow, PageFrame, PageLede } from './ClientNarrative'
import type { ClientView } from './ClientNarrative'

/**
 * VR3-05 — THE PRESENTATION SCENARIO, on screen.
 *
 * The bar, the decisions and the two dialogs share one job: make it
 * impossible to be confused about WHICH STATE IS BEING LOOKED AT and WHAT
 * AUTHORITY IT HAS. A client watching a number change has to be able to
 * tell, without being told, whether they are seeing the offer or an
 * experiment against it — so the bar is persistent, names the saved Option
 * it is a delta from, and says in words that the saved Option is unchanged.
 *
 * The decisions are real radio groups. `ChoiceGroup`'s contract exists
 * because a decorative span over a control intercepts clicks; in a client
 * meeting that failure is not a bug report, it is a stalled sentence.
 */

/* ─────────────────────────── decision control ─────────────────────────── */

function ScenarioDecisionGroup({ decision }: {
  decision: PresentationDecision
}) {
  const t = useT()
  const s = useStore()
  const groupId = useId()
  const current = clientDecisionValue(s, decision)
  const baselineConfig = clientBaselineConfig(s)
  const baselineValue = baselineConfig
    ? clientDecisionValue({ ...s, clientScenario: null } as typeof s, decision)
    : null

  return (
    <fieldset className="a3-client-decision" aria-describedby={`${groupId}-note`}>
      <legend className="a3-client-panel-title">{t(decision.titleKey)}</legend>
      <div className="a3-client-decision-options">
        {decision.options.map((option) => {
          const selected = option.value === current
          const isBaseline = option.value === baselineValue
          return (
            <label
              key={option.value}
              className="a3-client-decision-option hit-target"
              data-selected={selected ? 'true' : undefined}
            >
              <input
                type="radio"
                className="a3-client-decision-input"
                name={`${groupId}-${decision.id}`}
                value={option.value}
                checked={selected}
                onChange={() => s.setPresentationDecision(decision.id, option.value)}
              />
              <span className="a3-client-decision-label">{t(option.labelKey)}</span>
              <span className="a3-client-decision-note">
                {isBaseline
                  ? t('vr3.client.decision.role.baseline')
                  : selected
                    ? t('vr3.client.decision.role.scenario')
                    : t('vr3.client.decision.role.alternative')}
              </span>
            </label>
          )
        })}
      </div>
      <p id={`${groupId}-note`} className="a3-client-prose a3-client-decision-consequence">
        {current ? t(decision.consequenceKeyOf[current] ?? '') : ''}
      </p>
    </fieldset>
  )
}

/* ────────────────────── §4 · services and what-ifs (T-038/T-041) ──────── */

/**
 * The services page carries the what-ifs because that is where a client
 * asks them. The alternative — a separate "scenarios" tab — would have made
 * exploring an offer a different activity from reading it, which is exactly
 * the "hidden internal configurator" the target refuses.
 */
export function PageServices({ view, headingRef }: {
  view: ClientView
  headingRef: RefObject<HTMLHeadingElement>
}) {
  const t = useT()
  const s = useStore()
  const decisions = clientPresentationDecisions(s).filter((d) => d.section === 'services')
  const changed = scenarioChangeCount(s.clientScenario) > 0
  const delta = clientScenarioDelta(s)
  const trusted = clientScenarioTrustedNow(s)
  const result = view.presented.result
  const baselineResult = view.baseline.result

  return (
    <PageFrame>
      <PageLede
        eyebrow={changed
          ? t('vr3.client.services.eyebrow.scenario')
          : t('vr3.client.services.eyebrow', { option: view.optionName })}
        title={t(changed
          ? 'vr3.client.services.title.scenario'
          : 'vr3.client.services.title')}
        headingRef={headingRef}
      />
      <div className="a3-client-split">
        <ClientPanel>
          {decisions.length > 0
            ? decisions.map((decision) => (
              <ScenarioDecisionGroup key={decision.id} decision={decision} />
            ))
            : <p className="a3-client-prose">{t('vr3.client.services.none')}</p>}
        </ClientPanel>
        <ClientPanel>
          <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
            {changed
              ? t('vr3.client.services.currentScenario')
              : t('vr3.client.services.currentBaseline')}
          </p>
          <p className="a3-client-hero-number">
            <CommercialNumber
              exact={result.total.exact}
              displayed={result.total}
              language={view.language}
              emphasis="hero"
              className="a3-display-accent"
            />
          </p>
          {/* One polite announcement per change, with the full formatted
              total — M-11's accessibility half. The delta alone would tell a
              screen-reader user the size of the move and not where it
              landed. */}
          <p aria-live="polite" className="a3-client-prose">
            {changed && delta
              ? t('vr3.client.services.versus', {
                delta: signedMoneyText(delta, view.language),
                option: view.optionName,
                total: result.total.display,
              })
              : t('vr3.client.services.atBaseline', { option: view.optionName })}
          </p>
          {!trusted ? (
            <p className="a3-client-stale">
              <span aria-hidden="true">! </span>
              {t('vr3.client.scenario.stale')}
            </p>
          ) : null}
          <div className="a3-client-rows">
            <ClientFactRow
              label={t('vr3.client.services.savedOption')}
              value={baselineResult.total.display}
            />
            <ClientFactRow
              label={t('vr3.client.services.temporaryScenario')}
              value={changed ? result.total.display : '—'}
            />
            <ClientFactRow
              label={t('vr3.client.services.changeCount')}
              value={String(scenarioChangeCount(s.clientScenario))}
            />
          </div>
        </ClientPanel>
      </div>
    </PageFrame>
  )
}

/* ───────────────────── the schedule what-if, as a warning ─────────────── */

/** The schedule page's own decision plus the open question it leaves. */
export function ScheduleScenarioSlot() {
  const t = useT()
  const s = useStore()
  const decisions = clientPresentationDecisions(s).filter((d) => d.section === 'schedule')
  const warnings = clientScenarioWarnings(s)
  if (decisions.length === 0) return null
  return (
    <div className="a3-client-schedule-decision">
      {warnings.length > 0 ? (
        <p className="a3-client-warning" role="status">
          <span aria-hidden="true">! </span>
          {t('vr3.client.scenario.openQuestion')}
        </p>
      ) : null}
      {decisions.map((decision) => (
        <ScenarioDecisionGroup key={decision.id} decision={decision} />
      ))}
    </div>
  )
}

/* ──────────────────────── the scenario bar (T-041) ────────────────────── */

/**
 * Persistent, and persistent on purpose.
 *
 * It is the one element that is true on every section: which state is being
 * shown, what it is a delta from, and the two ways out of it. A bar that
 * appeared only on the page where the change was made would let a presenter
 * navigate to the investment page and present a scenario total as the offer.
 */
export function ScenarioBar({ view, onRevert, onSaveAsNew }: {
  view: ClientView
  onRevert: () => void
  onSaveAsNew: () => void
}) {
  const t = useT()
  const s = useStore()
  const count = scenarioChangeCount(s.clientScenario)
  const delta = clientScenarioDelta(s)
  const changed = count > 0

  return (
    <div className="a3-client-scenario-bar" data-state={changed ? 'modified' : 'baseline'}>
      <div className="a3-client-scenario-identity">
        <p className="a3-client-scenario-title">
          {changed
            ? t('vr3.client.scenario.modified')
            : t('vr3.client.scenario.baseline')}
        </p>
        <p className="a3-client-scenario-source">
          {changed
            ? t('vr3.client.scenario.sourceUnchanged', { option: view.optionName })
            : t('vr3.client.scenario.sourceSaved', {
              option: view.optionName,
              version: view.savedVersion?.version ?? 1,
            })}
        </p>
      </div>
      <p className="a3-client-scenario-delta numeric">
        {changed && delta ? signedMoneyText(delta, view.language) : ''}
        {changed ? (
          <span className="a3-client-scenario-count">
            {t('vr3.client.scenario.changes', { count })}
          </span>
        ) : null}
      </p>
      <div className="a3-client-scenario-actions">
        <Button
          variant="secondary"
          onClick={onRevert}
          disabled={!changed}
          disabledReason={t('vr3.client.scenario.revertDisabled')}
        >
          {t('vr3.client.scenario.revert')}
        </Button>
        <Button
          variant="primary"
          onClick={onSaveAsNew}
          disabled={!changed}
          disabledReason={t('vr3.client.scenario.saveDisabled')}
        >
          {t('vr3.client.scenario.saveAsNew')}
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────── dialogs (T-043/T-044) ────────────────────── */

/**
 * A minimal focus-trapping dialog.
 *
 * `<dialog>`'s own modal mode is what `Dialog.tsx` wraps for the internal
 * shell, and reusing it here would inherit the internal chrome and the Work
 * palette. The client dialogs are a different surface with the same
 * OBLIGATIONS — trap, restore, Esc, labelled — so the obligations are
 * implemented and the chrome is not.
 */
function ClientDialog({ open, onClose, labelledBy, children, returnFocusTo }: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: React.ReactNode
  returnFocusTo: RefObject<HTMLElement>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(
      'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      )).filter((el) => !el.hasAttribute('disabled'))
      if (focusable.length === 0) return
      const firstEl = focusable[0]!
      const lastEl = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      // Focus returns to what opened it — a dialog that dumps focus at the
      // document root leaves a keyboard presenter with nowhere to be.
      returnFocusTo.current?.focus()
    }
  }, [open, onClose, returnFocusTo])

  if (!open) return null
  return (
    <div className="a3-client-overlay">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="a3-client-modal"
      >
        {children}
      </div>
    </div>
  )
}

export function ScenarioRevertDialog({ open, onClose, view, returnFocusTo }: {
  open: boolean
  onClose: () => void
  view: ClientView
  returnFocusTo: RefObject<HTMLElement>
}) {
  const t = useT()
  const s = useStore()
  const titleId = useId()
  const count = scenarioChangeCount(s.clientScenario)
  return (
    <ClientDialog
      open={open} onClose={onClose} labelledBy={titleId} returnFocusTo={returnFocusTo}
    >
      <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
        {t('vr3.client.revert.eyebrow')}
      </p>
      <h2 id={titleId} className="a3-client-modal-title">
        {t('vr3.client.revert.title', { option: view.optionName })}
      </h2>
      <p className="a3-client-prose">
        {t('vr3.client.revert.body', { count })}
      </p>
      <div className="a3-client-modal-actions">
        <Button
          variant="primary"
          onClick={() => { s.revertPresentationScenario(); onClose() }}
        >
          {t('vr3.client.revert.confirm', { count })}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('vr3.client.revert.cancel')}
        </Button>
      </div>
    </ClientDialog>
  )
}

export function ScenarioSaveDialog({ open, onClose, view, returnFocusTo }: {
  open: boolean
  onClose: () => void
  view: ClientView
  returnFocusTo: RefObject<HTMLElement>
}) {
  const t = useT()
  const s = useStore()
  const titleId = useId()
  const fieldId = useId()
  const commit = s.clientScenarioSave
  const count = scenarioChangeCount(s.clientScenario)
  const delta = clientScenarioDelta(s)
  if (!commit || commit.stage !== 'NAMING') return null
  const nameOk = clientScenarioNameAvailable(s, commit.name)

  return (
    <ClientDialog
      open={open} onClose={onClose} labelledBy={titleId} returnFocusTo={returnFocusTo}
    >
      <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
        {t('vr3.client.save.eyebrow')}
      </p>
      <h2 id={titleId} className="a3-client-modal-title">
        {t('vr3.client.save.title', { name: commit.name })}
      </h2>
      <div className="a3-client-field">
        <label htmlFor={fieldId} className="a3-client-field-label">
          {t('vr3.client.save.nameLabel')}
        </label>
        <input
          id={fieldId}
          className="a3-client-field-input"
          value={commit.name}
          aria-invalid={commit.errorKey ? true : undefined}
          aria-describedby={commit.errorKey ? `${fieldId}-error` : undefined}
          onChange={(event) => s.setScenarioSaveName(event.target.value)}
        />
        {commit.errorKey ? (
          <p id={`${fieldId}-error`} role="alert" className="a3-client-field-error">
            <span aria-hidden="true">! </span>{t(commit.errorKey)}
          </p>
        ) : null}
      </div>
      <div className="a3-client-callout">
        <span aria-hidden="true" className="a3-client-callout-mark">→</span>
        <div>
          <p className="a3-client-callout-title">
            {t('vr3.client.save.source', { option: view.optionName })}
          </p>
          <p className="a3-client-callout-body">
            {t('vr3.client.save.summary', {
              count,
              delta: delta ? signedMoneyText(delta, view.language) : '',
              option: view.optionName,
            })}
          </p>
        </div>
      </div>
      <div className="a3-client-modal-actions">
        <Button
          variant="primary"
          onClick={() => s.commitScenarioSaveAsNew()}
          disabled={!nameOk}
          disabledReason={t('vr3.client.save.error.nameEmpty')}
        >
          {t('vr3.client.save.confirm')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('vr3.client.save.cancel')}
        </Button>
      </div>
    </ClientDialog>
  )
}

/** The receipt a completed Save as New leaves behind (M-12). */
export function ScenarioSaveReceipt({ view }: { view: ClientView }) {
  const t = useT()
  const s = useStore()
  const commit = s.clientScenarioSave
  const [dismissed, setDismissed] = useState(false)
  const { reduced } = useSemanticMotion()
  useEffect(() => { setDismissed(false) }, [commit?.savedOptionId])
  if (!commit?.savedOptionId || dismissed) return null
  const source = s.options.find((o) => o.id === commit.sourceOptionId)
  return (
    <div className="a3-client-receipt" role="status" data-reduced={reduced ? 'true' : undefined}>
      <p className="a3-client-receipt-title">
        {t('vr3.client.save.receipt.title', { option: view.optionName })}
      </p>
      <p className="a3-client-receipt-body">
        {t('vr3.client.save.receipt.body', {
          presented: view.optionName,
          active: source?.name ?? commit.sourceOptionId,
        })}
      </p>
      <Button variant="ghost" onClick={() => setDismissed(true)}>
        {t('vr3.client.save.receipt.dismiss')}
      </Button>
    </div>
  )
}
