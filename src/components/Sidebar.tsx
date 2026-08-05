import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { CHAPTERS } from '../screens/S3Konfigurator'

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

export type View =
  | 'projekte' | 'vorbereitung' | 'konfigurator'
  | 'vergleich' | 'export' | 'einstellungen' | 'grundlagen'

const SCREENS: Array<{ id: View; label: string; hint?: string }> = [
  { id: 'projekte', label: 'Projekte', hint: 'S1' },
  { id: 'vorbereitung', label: 'Vorbereitung', hint: 'S2' },
  { id: 'konfigurator', label: 'Konfigurator', hint: 'S3' },
  { id: 'vergleich', label: 'Variantenvergleich', hint: 'S4' },
  { id: 'export', label: 'Export', hint: 'S5' },
  { id: 'einstellungen', label: 'Einstellungen', hint: 'S6' },
  { id: 'grundlagen', label: 'Grundlagen', hint: 'QA' },
]

const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  const s = useStore()

  return (
    <nav
      aria-label="Navigation"
      className="flex h-full w-panel-left shrink-0 flex-col overflow-y-auto border-r border-border-strong bg-surface-default"
    >
      <div className="border-b border-border-strong px-5 py-4">
        <p className="text-body font-medium text-text-primary">
          Musterprojekt Nordfeld · Haus{NNBSP}A
        </p>
        <p className="mt-1 text-small text-text-secondary">
          Variante «Basis» · ○ Vorbereitung ·{' '}
          {s.mode === 'praesentation' ? 'Präsentation' : 'intern'}
        </p>
      </div>

      <ul className="flex-1 py-2">
        {SCREENS.map((item) => {
          const active = view === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setView(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-hit-target w-full items-center gap-3 px-5 py-2 text-left text-body ${FOCUS} ` +
                  (active
                    ? 'border-l-selected border-selection-border bg-surface-subtle font-medium text-text-primary'
                    : 'border-l-selected border-transparent text-text-secondary hover:bg-surface-subtle')}
              >
                <span className="w-5 shrink-0 text-small text-text-muted">{item.hint}</span>
                {item.label}
              </button>

              {/* Главы конфигуратора — второй уровень под активным пунктом. */}
              {item.id === 'konfigurator' && active && (
                <ol className="border-b border-border-subtle pb-2">
                  {CHAPTERS.map((c, i) => {
                    const n = i + 1
                    const open = s.openChapter === n
                    const done = n < 3
                    return (
                      <li key={c}>
                        <button
                          type="button"
                          onClick={() => s.openChapterAt(n)}
                          aria-current={open ? 'true' : undefined}
                          className={`relative flex min-h-hit-target w-full items-center gap-2 py-1 pl-8 pr-5 text-left text-small ${FOCUS} ` +
                            (open ? 'font-medium text-text-primary' : 'text-text-secondary hover:text-text-primary')}
                        >
                          <span className="numeric w-4 shrink-0">{n}</span>
                          <span aria-hidden="true" className="w-3 shrink-0">
                            {done ? '✓' : open ? '▸' : ''}
                          </span>
                          <span>{c}</span>
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

      <div className="border-t border-border-subtle px-5 py-3">
        <p className="text-small text-text-muted">
          Prototyp v0.5 · Arithmetik echt, Parsing simuliert
        </p>
      </div>
    </nav>
  )
}
