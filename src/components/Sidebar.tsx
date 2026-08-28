import type { RefObject } from 'react'
import {
  configuratorStepDone,
  pipelineViewForBuildingGate,
  useStore,
} from '../state/store'
import type { PipelineView } from '../state/store'
import { NNBSP } from '../engine/money'
import { activeConfiguratorWorkflow } from '../state/chapters'
import { useT, type MessageKey } from '../i18n'
import {
  isClientProjection,
  isClientVisiblePipelineView,
} from '../state/clientProjection'
import { OutputProfileSwitch, SelectField } from './designSystem'
import { WorkflowStepper, type WorkflowStep } from '../design-system/WorkflowStepper'

/**
 * Левый сайдбар — навигация оболочки.
 *
 * Экраны S1…S6 — верхний уровень; главы конфигуратора — второй уровень под
 * активным пунктом (DC-13 Workflow Stepper: нумерация — рекомендованный
 * маршрут, не принуждение; прыгать можно куда угодно, цена не теряется,
 * потому что правая панель постоянна).
 *
 * Активный пункт помечен бордером выделения и подписью — не только цветом
 * (правило 8); выделение несёт `--color-selection-border`, не бренд-оранжевый
 * (R-01/R-03).
 */

/**
 * Навигация КОНВЕЙЕРА — только то, что относится к работе над Option.
 *
 * «Projekte» и «Vorbereitung» отсюда убраны намеренно: список проектов —
 * это корень продукта (уровень выше, доступен крошкой в шапке), а
 * подготовка — уровень Opportunity. Пункт навигации, ведущий на другой
 * уровень иерархии, — не навигация, а телепорт: он ломает представление
 * пользователя о том, где он находится.
 */
const SCREENS: Array<{
  id: PipelineView
  labelKey: MessageKey
  hint?: string
}> = [
  { id: 'buildingScope', labelKey: 'nav.buildingScope', hint: '1' },
  { id: 'konfigurator', labelKey: 'nav.konfigurator', hint: '2' },
]

const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export function Sidebar({ modeRef }: { modeRef: RefObject<HTMLButtonElement> }) {
  const s = useStore()
  const view = pipelineViewForBuildingGate(s, s.pipelineView)
  const option = s.options.find((o) => o.id === s.activeOptionId)
  const t = useT()
  const client = isClientProjection(s.mode)
  const buildingGateBlocked = !s.canBeginConfiguration()
  const configurationGateBlocked = !s.configurationModeChosen || s.configurationModeEditing
  const modeBlocked = buildingGateBlocked || configurationGateBlocked
  const modeBlockedReason = buildingGateBlocked
    ? t('shell.mode.blockedReason')
    : configurationGateBlocked
      ? t('configurator.mode.clientBlocked')
      : undefined
  const gateOpen = s.canBeginConfiguration()
  // Task 03 (deep-coherence audit, F-16/PD-3, CPO-confirmed): the building
  // gate alone used to leave Export reachable at mode choice, before any
  // Configurator confirmation existed at all — a 0-€ or half-configured
  // offer was exportable. Export additionally requires the whole-option
  // confirm CTA (`configurationComplete`); the other pipeline items keep
  // using the plain building gate, unaffected.
  const exportGateOpen = gateOpen && s.configurationComplete()
  const screens = client
    ? SCREENS.filter(({ id }) => isClientVisiblePipelineView(id))
    : SCREENS
  const workflow = activeConfiguratorWorkflow({ coverage: s.coverage, mode: s.mode })

  return (
    <nav
      aria-label="Navigation"
      className="flex h-full w-panel-left shrink-0 flex-col overflow-y-auto border-r border-border-strong bg-surface-default"
    >
      <div className="border-b border-border-strong px-5 py-4">
        {option && s.activeOptionId ? (
          client ? (
            // QA rework (R3, 877f2c2a): this SelectField used to render
            // unconditionally and call `s.openOption(...)` regardless of
            // mode — a fully interactive, undisclosed second path to
            // silently change the internally active/preparation Option
            // while Kundenansicht's own mode indicator reads "der Kunde
            // sieht diesen Bildschirm", right next to the dedicated
            // presentation-only "Wird präsentiert" selector that this
            // same ticket built specifically so THAT could never happen.
            // Reproduced live via Playwright CLI (QA finding): select a
            // different Option here while presenting → `activeOptionId`
            // silently flips, no warning, no Undo toast. Client mode gets
            // an informational label instead — same value, same visual
            // position, no longer an interactive Option-switching control.
            // The client-safe way to change what is PRESENTED remains the
            // Variantenvergleich screen's own selector (`setViewedOption`,
            // which never touches `activeOptionId`).
            <div>
              <p className="a3-cap">{t('shell.optionSwitcher')}</p>
              <p className="text-body font-medium text-text-primary">{option.name}</p>
            </div>
          ) : (
            <SelectField
              label={t('shell.optionSwitcher')}
              value={s.activeOptionId}
              onChange={(event) => s.openOption(event.target.value)}
            >
              {s.options.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </SelectField>
          )
        ) : (
          <p className="text-body font-medium text-text-primary">
            {`Musterprojekt Nordfeld · Haus${NNBSP}A`}
          </p>
        )}
        {/* REDESIGN R3 (877f2c2a): this was `!client && option` — the ONLY
            entry point to Variantenvergleich was internal-only, so the new
            client-safe Options/comparison surface it now also hosts
            (`S4Vergleich.tsx`'s `client` branches) had no way to be
            reached from Kundenansicht at all. `S4Vergleich.tsx` itself
            already fully owns client-safe composition (eligible-only
            columns, the "wird präsentiert" selector, the one-Option
            summary) — this link only needed to stop being hidden. */}
        {option && (
          <button type="button" className="a3-linkbtn mt-3"
                  onClick={() => s.setPipelineView('vergleich')}>
            {t('nav.vergleich')}
          </button>
        )}
        <div className="mt-4 border-t border-border-subtle pt-4">
          <OutputProfileSwitch
            compact
            mode={s.mode}
            blocked={modeBlocked}
            blockedReason={modeBlockedReason}
            checkButtonRef={modeRef}
            onCheck={() => s.setGateOpen(true)}
            onExit={() => s.setMode('intern')}
          />
        </div>
      </div>

      <ul className="flex-1 py-2">
        <li>
          <p className="a3-cap px-5 pb-1 pt-3">
            {t('shell.sidebar.workflow')}
          </p>
        </li>
        {screens.map((item) => {
          const active = view === item.id
          const blocked = item.id !== 'buildingScope' && !gateOpen
          const reasonId = `building-gate-${item.id}`
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => { if (!blocked) s.setPipelineView(item.id) }}
                aria-current={active ? 'page' : undefined}
                aria-disabled={blocked || undefined}
                aria-describedby={blocked ? reasonId : undefined}
                className={`relative flex min-h-hit-target w-full items-center gap-3 px-5 py-2 text-left text-body ${FOCUS} ` +
                  (active
                    ? 'border-l-selected border-selection-border bg-surface-subtle font-medium text-text-primary'
                    : 'border-l-selected border-transparent text-text-secondary hover:bg-surface-subtle') +
                  (blocked ? ' cursor-default text-text-disabled' : '')}
              >
                <span className="w-5 shrink-0 text-small text-text-muted">{item.hint}</span>
                {t(item.labelKey)}
              </button>

              {blocked && item.id === 'konfigurator' && (
                <p id={reasonId} className="px-5 pb-2 pl-8 text-small text-text-secondary">
                  {t('buildingScope.gate.navigationReason')}
                </p>
              )}

              {blocked && item.id !== 'konfigurator' && (
                <span id={reasonId} className="sr-only">
                  {t('buildingScope.gate.navigationReason')}
                </span>
              )}

              {/* Главы конфигуратора — второй уровень под активным пунктом. */}
              {item.id === 'konfigurator' && active
                && s.configurationModeChosen && !s.configurationModeEditing && (
                <WorkflowStepper
                  ariaLabel={t('shell.sidebar.workflow')}
                  size="chapter"
                  steps={workflow.map((step): WorkflowStep => {
                    const open = s.openConfiguratorStep === step.id
                    const done = !open && configuratorStepDone(s, step.id)
                    return {
                      id: step.id,
                      label: t(`chapter.${step.id}`),
                      state: open ? 'current' : done ? 'done' : 'upcoming',
                      onSelect: () => s.openConfiguratorStepAt(step.id),
                    }
                  })}
                />
              )}
            </li>
          )
        })}
        {(!client || isClientVisiblePipelineView('export')) && (
          <li className="mt-2 border-t border-border-subtle pt-2">
            <p className="a3-cap px-5 pb-1 pt-3">
              {t('shell.sidebar.outputs')}
            </p>
            <button
              type="button"
              onClick={() => { if (exportGateOpen) s.setPipelineView('export') }}
              aria-current={view === 'export' ? 'page' : undefined}
              aria-disabled={!exportGateOpen || undefined}
              aria-describedby={!exportGateOpen ? 'building-gate-export' : undefined}
              className={`relative flex min-h-hit-target w-full items-center px-5 py-2 text-left text-body ${FOCUS} ` +
                (view === 'export'
                  ? 'border-l-selected border-selection-border bg-surface-subtle font-medium text-text-primary'
                  : 'border-l-selected border-transparent text-text-secondary hover:bg-surface-subtle') +
                (!exportGateOpen ? ' cursor-default text-text-disabled' : '')}
            >
              {t('nav.export')}
            </button>
            {/* Task 03 (AC3, rule 12): the reason must be visibly adjacent to
                the disabled control, not only announced to screen readers —
                the same treatment the "Konfigurator" item already gets
                below, now extended to Export since this ticket names it
                explicitly. */}
            {!exportGateOpen && (
              <p id="building-gate-export" className="px-5 pb-2 pl-8 text-small text-text-secondary">
                {!gateOpen
                  ? t('buildingScope.gate.navigationReason')
                  : t('configurator.finalGate.exportBlockedReason')}
              </p>
            )}
          </li>
        )}
      </ul>

      {!client && (
        <div className="border-t border-border-subtle px-5 py-3">
          <button type="button" className="flex min-h-hit-target w-full items-center gap-3 text-left text-body text-text-secondary outline-none hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  onClick={() => s.setPipelineView('einstellungen')}>
            <span aria-hidden="true">⚙</span>{t('nav.einstellungen')}
          </button>
          {/* REDESIGN R1 (efcbdaf3): reinstates a navigable route to the
              already-internal-only 'grundlagen' PipelineView (excluded from
              CLIENT_VISIBLE_PIPELINE_VIEWS since clientProjection.ts) — the
              QA diagnostics + D-28 registry Gallery had no way to reach it
              from the running product. Same `!client` gate as Einstellungen
              above, so it stays absent in mode-praesentation. */}
          <button type="button" className="mt-1 flex min-h-hit-target w-full items-center gap-3 text-left text-body text-text-secondary outline-none hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  onClick={() => s.setPipelineView('grundlagen')}>
            <span aria-hidden="true">◇</span>{t('nav.grundlagen')}
          </button>
        </div>
      )}
    </nav>
  )
}
