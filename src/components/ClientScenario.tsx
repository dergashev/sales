import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import {
  clientBaselineDecisionValue,
  clientDecisionOptionDelta,
  clientDecisionValue,
  clientPresentationDecisions,
  clientScenarioDelta,
  clientScenarioNameAvailable,
  clientScenarioWarnings,
  latestSavedOptionVersion,
  useStore,
} from '../state/store'
import {
  COMPARISON_VISIBLE_COLUMN_LIMIT,
  comparisonColumns,
  comparisonGroups,
  comparisonRows,
  visibleComparisonRows,
} from '../state/optionComparison'
import { scenarioChangeCount } from '../state/clientScenario'
import type { PresentationDecision } from '../state/clientScenario'
import type { ClientView } from '../state/clientProposal'
import { signedMoneyText } from '../design-system/CommercialNumber'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { useSemanticMotion } from '../design-system/motion'
import { Button } from './primitives'
import { RadioCardGroup, SegmentedControl } from './controls'
import { Dialog } from './Dialog'

/**
 * VR3-CP-00 — LAYER 2 · VARIANTEN.
 *
 * ## Why a layer and not a chapter
 *
 * Option difference is a question a client asks DURING a chapter — "and
 * what does the other variant cost?" — not a place in the story. The
 * reference decks confirm it: the two Simmozheim variants are carried
 * inside pages 2 and 4 as columns of chapters that already exist, never as
 * a separate variants page.
 *
 * Making it a layer also resolves the standing tension that Client Mode
 * looks like an editor. Every control that mutates anything now lives
 * inside one explicitly labelled decision layer, and the narrative behind
 * it is purely a narrative.
 *
 * ## What it may and may not touch
 *
 * Switching the presented Option changes the CLIENT VIEW only: same
 * chapter, same narrative position, no preparation write and no journal
 * entry. The what-ifs write a change list against a copy and nothing else
 * until an explicit Save as New Option. Those are released semantics and
 * they are preserved exactly.
 *
 * ## One comparison authority
 *
 * The comparison reads `state/optionComparison.ts`, which is also what the
 * project-tier `/vergleich` route reads. There used to be two: the screen
 * derived from the live projections while a second component inside the
 * presentation shell derived from the last saved version — two authorities
 * for one number, in front of a client. The second one is gone.
 */

/* ─────────────────────────── decision control ─────────────────────────── */

function ScenarioDecisionGroup({ decision, language }: {
  decision: PresentationDecision
  language: 'de' | 'en'
}) {
  const t = useT()
  const s = useStore()
  const current = clientDecisionValue(s, decision)
  const baselineValue = clientBaselineDecisionValue(s, decision)

  // The CANONICAL choice control, not a local one. Its contract is exactly
  // what a client-facing decision needs and what a hand-rolled fieldset
  // silently loses: the whole label is the hit area, the decoration is
  // inert, keyboard and pointer behave identically, and `consequence` is a
  // permanent slot rather than a hover affordance.
  const options = decision.options.map((option) => {
    const delta = clientDecisionOptionDelta(s, decision, option.value)
    const isBaseline = option.value === baselineValue
    const effect = delta === null
      ? t('vr3.client.decision.effect.unknown')
      : delta.isZero()
        ? t('vr3.client.decision.effect.none')
        : signedMoneyText(delta, language)
    return {
      value: option.value,
      title: t(option.labelKey),
      description: t(decision.consequenceKeyOf[option.value] ?? ''),
      consequence: isBaseline
        ? `${t('vr3.client.decision.role.baseline')} · ${effect}`
        : effect,
    }
  })

  return (
    <div className="a3-cp-decision">
      <RadioCardGroup
        legend={t(decision.titleKey)}
        value={current}
        options={options}
        onChange={(value) => s.setPresentationDecision(decision.id, value)}
      />
    </div>
  )
}

/* ────────────────────── the presenter bar's scenario slot ─────────────── */

/**
 * The what-if state, folded INTO the one presenter bar.
 *
 * It used to be a second persistent band of 82 px at 1440 (74 at 1280) under
 * a 62 px bar — two bands of chrome above a client's proposal, and the
 * lower one mounted on only two of the eight flows, so it was not even
 * reliably persistent. The obligation it carried is real and is kept: say
 * which state is on screen, what it is a delta from, and offer the way out.
 * The obligation did not need 82 px.
 */
export function ScenarioState({ view, onRevert, onSaveAsNew }: {
  view: ClientView
  onRevert: () => void
  onSaveAsNew: () => void
}) {
  const t = useT()
  const s = useStore()
  const count = scenarioChangeCount(s.clientScenario)
  const delta = clientScenarioDelta(s)
  if (count === 0) return null
  return (
    <div className="a3-cp-bar-scenario" data-state="modified">
      <span className="a3-cp-bar-scenario-label">
        {t('vr3.client.scenario.modified')}
      </span>
      <span className="a3-cp-bar-scenario-delta numeric">
        {delta ? signedMoneyText(delta, view.language) : ''}
      </span>
      <Button variant="ghost" onClick={onRevert}>
        {t('vr3.client.scenario.revert')}
      </Button>
      <Button variant="ghost" onClick={onSaveAsNew}>
        {t('vr3.client.scenario.saveAsNew')}
      </Button>
    </div>
  )
}

/* ─────────────────────────── the Varianten layer ──────────────────────── */

/**
 * The bounded comparison.
 *
 * At most three visible Option columns: beyond three the presenter chooses
 * the participants through a client-safe control rather than being handed
 * six narrow columns. Differing rows show by default with an `Alle Zeilen`
 * toggle, because "what is different" is the question being asked and the
 * rest is noise in a meeting. Real table semantics throughout — the delta
 * is explicit text, never colour alone.
 */
export function VariantenLayer({ view, open, onClose, returnFocusTo }: {
  view: ClientView
  open: boolean
  onClose: () => void
  returnFocusTo: RefObject<HTMLElement>
}) {
  const t = useT()
  const tx = useTx()
  const s = useStore()
  const titleId = useId()
  const [showAll, setShowAll] = useState(false)
  const [participants, setParticipants] = useState<readonly string[] | null>(null)

  const allColumns = useMemo(() => comparisonColumns(s), [s])
  const presentedId = view.savedVersion?.optionId
    ?? allColumns[0]?.option.id ?? null

  const chosen = participants ?? allColumns
    .slice(0, COMPARISON_VISIBLE_COLUMN_LIMIT)
    .map((c) => c.option.id)
  const columns = allColumns.filter((c) => chosen.includes(c.option.id))

  const rows = useMemo(
    () => comparisonRows(columns, { t, tx, client: true, language: view.language }),
    [columns, t, tx, view.language],
  )
  const visible = visibleComparisonRows(rows, showAll)
  const groups = comparisonGroups(visible)

  if (!open) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose() }}
      labelledBy={titleId}
      returnFocusTo={returnFocusTo}
      panelClassName="a3-cp-layer"
      scrimClassName="a3-cp-layer-scrim"
    >
      <header className="a3-cp-layer-head">
        <div>
          <p className="a3-cp-eyebrow">{t('vr3.client.varianten.eyebrow')}</p>
          <h2 id={titleId} className="a3-cp-layer-title">
            {t('vr3.client.varianten.title')}
          </h2>
        </div>
        <div className="a3-cp-layer-actions">
          <SegmentedControl
            legend={t('vr3.client.varianten.rowsLegend')}
            legendHidden
            layout="inline"
            size="compact"
            value={showAll ? 'all' : 'diff'}
            options={[
              { value: 'diff', label: t('vr3.client.varianten.rowsDiff') },
              { value: 'all', label: t('vr3.client.varianten.rowsAll') },
            ]}
            onChange={(next) => setShowAll(next === 'all')}
          />
          <Button variant="secondary" onClick={onClose}>
            {t('vr3.client.varianten.close')}
          </Button>
        </div>
      </header>

      {allColumns.length > COMPARISON_VISIBLE_COLUMN_LIMIT ? (
        <fieldset className="a3-cp-layer-pick">
          <legend className="a3-cp-eyebrow">
            {t('vr3.client.varianten.pick', {
              limit: COMPARISON_VISIBLE_COLUMN_LIMIT,
            })}
          </legend>
          {allColumns.map((c) => {
            const active = chosen.includes(c.option.id)
            return (
              <label key={c.option.id} className="a3-cp-layer-pick-item hit-target">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => setParticipants(active
                    ? chosen.filter((id) => id !== c.option.id)
                    : [...chosen, c.option.id].slice(-COMPARISON_VISIBLE_COLUMN_LIMIT))}
                />
                <span>{c.option.name}</span>
              </label>
            )
          })}
        </fieldset>
      ) : null}

      <div className="a3-cp-layer-scroll">
        <table className="a3-cp-compare">
          <caption className="a3-visually-hidden">
            {t('vr3.client.varianten.tableCaption')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('vr3.client.varianten.colFact')}</th>
              {columns.map((c) => (
                <th key={c.option.id} scope="col" className="a3-cp-compare-num">
                  {c.option.name}
                  {c.option.id === presentedId ? (
                    <span className="a3-cp-compare-presented">
                      {t('vr3.client.varianten.presented')}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group}>
              <tr className="a3-cp-compare-group">
                <th scope="rowgroup" colSpan={columns.length + 1}>{group}</th>
              </tr>
              {visible.filter((r) => r.group === group).map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, i) => (
                    <td key={columns[i]?.option.id ?? i} className="a3-cp-compare-num">
                      {localizeMoneyText(cell, view.language)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <footer className="a3-cp-layer-foot">
        <div className="a3-cp-layer-switch">
          {columns.map((c) => (
            c.option.id === presentedId ? null : (
              <Button
                key={c.option.id}
                variant="secondary"
                onClick={() => { s.setViewedOption(c.option.id); onClose() }}
              >
                {t('vr3.client.varianten.show', { option: c.option.name })}
              </Button>
            )
          ))}
        </div>
        <p className="a3-cp-layer-note">{t('vr3.client.varianten.note')}</p>
      </footer>

      <WhatIfSection view={view} />
    </Dialog>
  )
}

/**
 * The what-ifs, in the decision layer where they belong.
 *
 * They used to occupy the chapter called `Leistungen`, so the chapter a
 * client would open to read the SCOPE of the offer showed them a panel of
 * controls instead. `Leistungen` is now the inclusion/exclusion catalogue
 * and the controls are here, behind an explicit label.
 */
function WhatIfSection({ view }: { view: ClientView }) {
  const t = useT()
  const s = useStore()
  const decisions = clientPresentationDecisions(s)
  const warnings = clientScenarioWarnings(s)
  if (decisions.length === 0) return null
  return (
    <section className="a3-cp-whatif" aria-label={t('vr3.client.varianten.whatIf')}>
      <h3 className="a3-cp-panel-subtitle">{t('vr3.client.varianten.whatIf')}</h3>
      {warnings.length > 0 ? (
        <p className="a3-cp-whatif-open" role="status">
          {t('vr3.client.scenario.openQuestion', { count: warnings.length })}
        </p>
      ) : null}
      <div className="a3-cp-whatif-grid">
        {decisions.map((decision) => (
          <ScenarioDecisionGroup
            key={decision.id} decision={decision} language={view.language}
          />
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────── revert / save dialogs ────────────────────── */

/**
 * A minimal focus-trapping dialog, kept as released.
 *
 * It is deliberately NOT converted to the canonical `Dialog`: the released
 * scenario commitments are covered by the ticket's MUST-NOT-CHANGE list,
 * and swapping their container is a behavioural change to a save path in
 * exchange for nothing this task needs. The obligations it must meet —
 * trap, restore, Esc, labelled — are implemented here and are tested.
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
      returnFocusTo.current?.focus()
    }
  }, [open, onClose, returnFocusTo])

  if (!open) return null
  return (
    <div className="a3-cp-overlay">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="a3-cp-modal"
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
      <p className="a3-cp-eyebrow">{t('vr3.client.revert.eyebrow')}</p>
      <h2 id={titleId} className="a3-cp-modal-title">
        {t('vr3.client.revert.title', { option: view.optionName })}
      </h2>
      <p className="a3-cp-prose">
        {t(count === 1
          ? 'vr3.client.revert.body.one'
          : 'vr3.client.revert.body', { count })}
      </p>
      <div className="a3-cp-modal-actions">
        <Button
          variant="primary"
          onClick={() => { s.revertPresentationScenario(); onClose() }}
        >
          {t(count === 1
            ? 'vr3.client.revert.confirm.one'
            : 'vr3.client.revert.confirm', { count })}
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
  // A blocked control states ITS OWN reason. `nameOk` is false for TWO
  // different constraints, so the disabled reason makes the same
  // distinction: a presenter looking at a filled field being told to "give
  // it a name" is being sent to fix something that is not wrong.
  const blockedReasonKey = commit.name.trim().length === 0
    ? 'vr3.client.save.error.nameEmpty'
    : 'vr3.client.save.error.nameTaken'

  return (
    <ClientDialog
      open={open} onClose={onClose} labelledBy={titleId} returnFocusTo={returnFocusTo}
    >
      <p className="a3-cp-eyebrow">{t('vr3.client.save.eyebrow')}</p>
      <h2 id={titleId} className="a3-cp-modal-title">
        {t('vr3.client.save.title', { name: commit.name })}
      </h2>
      <div className="a3-cp-field">
        <label htmlFor={fieldId} className="a3-cp-field-label">
          {t('vr3.client.save.nameLabel')}
        </label>
        <input
          id={fieldId}
          className="a3-cp-field-input"
          value={commit.name}
          aria-invalid={commit.errorKey ? true : undefined}
          aria-describedby={commit.errorKey ? `${fieldId}-error` : undefined}
          onChange={(event) => s.setScenarioSaveName(event.target.value)}
        />
        {commit.errorKey ? (
          <p id={`${fieldId}-error`} role="alert" className="a3-cp-field-error">
            <span aria-hidden="true">! </span>{t(commit.errorKey)}
          </p>
        ) : null}
      </div>
      <div className="a3-cp-callout">
        <span className="a3-cp-callout-title">
          {t('vr3.client.save.source', { option: view.optionName })}
        </span>
        <span className="a3-cp-callout-body">
          {t(count === 1
            ? 'vr3.client.save.summary.one'
            : 'vr3.client.save.summary', {
            count,
            delta: delta ? signedMoneyText(delta, view.language) : '',
            option: view.optionName,
          })}
        </span>
      </div>
      <div className="a3-cp-modal-actions">
        <Button
          variant="primary"
          onClick={() => s.commitScenarioSaveAsNew()}
          disabled={!nameOk}
          disabledReason={t(blockedReasonKey)}
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

/** The receipt a completed Save as New leaves behind. */
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
    <div className="a3-cp-receipt" role="status" data-reduced={reduced ? 'true' : undefined}>
      <p className="a3-cp-receipt-title">
        {t('vr3.client.save.receipt.title', { option: view.optionName })}
      </p>
      <p className="a3-cp-receipt-body">
        {t('vr3.client.save.receipt.body', {
          presented: view.optionName,
          active: source?.name ?? '',
        })}
      </p>
      <Button variant="ghost" onClick={() => setDismissed(true)}>
        {t('vr3.client.save.receipt.dismiss')}
      </Button>
    </div>
  )
}

/** Client-facing name of the presented Option's saved baseline, for the bar. */
export function presentedOptionLabel(
  s: ReturnType<typeof useStore>, optionId: string | null, language: 'de' | 'en',
): string {
  if (!optionId) return ''
  const saved = latestSavedOptionVersion(s, optionId)
  if (!saved) return ''
  return localizeMoneyText(saved.result.totalDisplay, language)
}
