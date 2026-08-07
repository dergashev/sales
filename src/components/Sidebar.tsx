import { chapterDone, useStore } from '../state/store'
import type { PipelineView } from '../state/store'
import { NNBSP } from '../engine/money'
import { CHAPTERS } from '../screens/S3Konfigurator'
import { useT, useTx, type MessageKey } from '../i18n'

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
const SCREENS: Array<{ id: PipelineView; labelKey: MessageKey; hint?: string }> = [
  { id: 'konfigurator', labelKey: 'nav.konfigurator', hint: '1' },
  { id: 'vergleich', labelKey: 'nav.vergleich', hint: '2' },
  { id: 'export', labelKey: 'nav.export', hint: '3' },
  { id: 'einstellungen', labelKey: 'nav.einstellungen', hint: '⚙' },
  { id: 'grundlagen', labelKey: 'nav.grundlagen', hint: 'QA' },
]

const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export function Sidebar() {
  const s = useStore()
  const view = s.pipelineView
  const option = s.options.find((o) => o.id === s.activeOptionId)
  const t = useT()
  const tx = useTx()

  return (
    <nav
      aria-label="Navigation"
      className="flex h-full w-panel-left shrink-0 flex-col overflow-y-auto border-r border-border-strong bg-surface-default"
    >
      <div className="border-b border-border-strong px-5 py-4">
        <p className="text-body font-medium text-text-primary">
          {option ? option.name : `Musterprojekt Nordfeld · Haus${NNBSP}A`}
        </p>
        <p className="a3-cap mt-1">
          {option ? option.id : t('shell.variant')} ·{' '}
          {t(s.mode === 'praesentation' ? 'shell.mode.praesentation' : 'shell.mode.intern')}
        </p>
      </div>

      <ul className="flex-1 py-2">
        {SCREENS.map((item) => {
          const active = view === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => s.setPipelineView(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-hit-target w-full items-center gap-3 px-5 py-2 text-left text-body ${FOCUS} ` +
                  (active
                    ? 'border-l-selected border-selection-border bg-surface-subtle font-medium text-text-primary'
                    : 'border-l-selected border-transparent text-text-secondary hover:bg-surface-subtle')}
              >
                <span className="w-5 shrink-0 text-small text-text-muted">{item.hint}</span>
                {t(item.labelKey)}
              </button>

              {/* Главы конфигуратора — второй уровень под активным пунктом. */}
              {item.id === 'konfigurator' && active && (
                <ol className="a3-chapters">
                  {CHAPTERS.map((c, i) => {
                    const n = i + 1
                    const open = s.openChapter === n
                    // Прогресс — из состояния активной Option (данные и след
                    // посещения), не из номера главы (ревью № 13, дефект 7).
                    const done = !open && chapterDone(s, n)
                    return (
                      <li key={c}>
                        <button
                          type="button"
                          onClick={() => s.openChapterAt(n)}
                          aria-current={open ? 'true' : undefined}
                          className={'a3-ch relative flex min-h-hit-target w-full items-center ' +
                            `gap-2 py-1 pl-8 pr-5 text-left ${FOCUS} ` +
                            (open ? 'a3-cur ' : '') + (done ? 'a3-done' : '')}
                        >
                          {/* Номер главы несёт состояние классом системы
                              (`.a3-ch.a3-done .a3-n`), а не подменой символа:
                              статус остаётся и знаком, и подписью (правило 8). */}
                          <span className="a3-n numeric shrink-0">{n}</span>
                          <span aria-hidden="true" className="w-3 shrink-0">
                            {done ? '✓' : open ? '▸' : ''}
                          </span>
                          <span>{tx(c)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ul>

      {/* Тур — только во внутреннем пространстве (DC-14): в презентации
          кнопки не существует, а не «она недоступна». */}
      {s.mode === 'intern' && (
        <div className="border-t border-border-subtle px-5 py-3">
          <button type="button" className="a3-linkbtn"
                  onClick={() => s.setTourOpen(true)}>
            {t('nav.tour')}
          </button>
        </div>
      )}

      <div className="border-t border-border-subtle px-5 py-3">
        <p className="text-small text-text-muted">
{t('shell.prototypeNote')} · v0.5
        </p>
      </div>
    </nav>
  )
}
