import type { RefObject } from 'react'
import {
  configuratorStepDone,
  pipelineViewForBuildingGate,
  useStore,
} from '../state/store'
import type { PipelineView } from '../state/store'
import { NNBSP } from '../engine/money'
import { activeConfiguratorWorkflow } from '../state/chapters'
import { useT, useTx, type MessageKey } from '../i18n'
import {
  isClientProjection,
  isClientVisiblePipelineView,
} from '../state/clientProjection'
import { OutputProfileSwitch, SelectField } from './designSystem'

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
  const tx = useTx()
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
        ) : (
          <p className="text-body font-medium text-text-primary">
            {`Musterprojekt Nordfeld · Haus${NNBSP}A`}
          </p>
        )}
        {!client && option && (
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
                <ol className="a3-chapters">
                  {workflow.map((step, index) => {
                    const number = index + 1
                    const open = s.openConfiguratorStep === step.id
                    // Прогресс — из состояния активной Option (данные и след
                    // посещения), не из номера главы (ревью № 13, дефект 7).
                    const done = !open && configuratorStepDone(s, step.id)
                    return (
                      <li key={step.id}>
                        <button
                          type="button"
                          onClick={() => s.openConfiguratorStepAt(step.id)}
                          aria-current={open ? 'true' : undefined}
                          className={'a3-ch relative flex min-h-hit-target w-full items-center ' +
                            `gap-2 py-1 pl-8 pr-5 text-left ${FOCUS} ` +
                            (open ? 'a3-cur ' : '') + (done ? 'a3-done' : '')}
                        >
                          {/* Номер главы несёт состояние классом системы
                              (`.a3-ch.a3-done .a3-n`), а не подменой символа:
                              статус остаётся и знаком, и подписью (правило 8).
                              Цифра aria-hidden, как в ReadinessOverview
                              (OpportunityCard.tsx): скринридер получает целую
                              фразу «Schritt N von M» (тот же ключ словаря), а
                              не голую цифру дважды (F02/F03 — маркер трактуется
                              как графический объект с порогом 3:1, а не текст
                              с порогом 4.5:1). */}
                          <span className="a3-n numeric shrink-0">
                            <span aria-hidden="true">{number}</span>
                            <span className="sr-only">
                              {t('oppcard.stepPosition', { n: number, total: workflow.length })}
                            </span>
                          </span>
                          <span aria-hidden="true" className="w-3 shrink-0">
                            {done ? '✓' : open ? '▸' : ''}
                          </span>
                          <span>{tx(step.label)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
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
              onClick={() => { if (gateOpen) s.setPipelineView('export') }}
              aria-current={view === 'export' ? 'page' : undefined}
              aria-disabled={!gateOpen || undefined}
              aria-describedby={!gateOpen ? 'building-gate-export' : undefined}
              className={`relative flex min-h-hit-target w-full items-center px-5 py-2 text-left text-body ${FOCUS} ` +
                (view === 'export'
                  ? 'border-l-selected border-selection-border bg-surface-subtle font-medium text-text-primary'
                  : 'border-l-selected border-transparent text-text-secondary hover:bg-surface-subtle') +
                (!gateOpen ? ' cursor-default text-text-disabled' : '')}
            >
              {t('nav.export')}
            </button>
            {!gateOpen && (
              <span id="building-gate-export" className="sr-only">
                {t('buildingScope.gate.navigationReason')}
              </span>
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
        </div>
      )}
    </nav>
  )
}
