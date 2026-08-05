import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { checkFonts, checkCascade, type FontCheck } from './lib/font-check'
import { Diagnostics } from './components/Diagnostics'
import { Sidebar, type View } from './components/Sidebar'
import { OfferPanel } from './components/OfferPanel'
import { UndoToast } from './components/UndoToast'
import { S3Konfigurator } from './screens/S3Konfigurator'
import { S2Vorbereitung } from './screens/S2Vorbereitung'
import { S4Vergleich } from './screens/S4Vergleich'
import { S5Export } from './screens/S5Export'
import { S1Projektliste } from './screens/S1Projektliste'
import { S6Einstellungen } from './screens/S6Einstellungen'

/**
 * Оболочка на всю ширину экрана, три зоны (решение PO):
 *
 *   слева — навигация (`--panel-left-width`) · по центру — рабочая область,
 *   в которой живёт выбранный экран · справа — всё, что относится к итоговой
 *   стоимости и сроку (`--panel-right-width`).
 *
 * Правая панель ПОСТОЯННА: «цена видна всегда» — механика продукта, а не
 * украшение. Прокручивается каждая зона отдельно; шапка и панели не уезжают.
 * Центровщик `max-w-content` остаётся типографическим пределом ДЛИННОГО
 * ТЕКСТА внутри рабочей области, но не клеткой для интерфейса.
 */
export function App() {
  const s = useStore()
  const [view, setView] = useState<View>('konfigurator')
  const [fonts, setFonts] = useState<FontCheck | null>(null)
  const [cascade, setCascade] = useState<string[] | null>(null)
  const praesentation = s.mode === 'praesentation'
  const modeBlocked = !s.building.gebaeudeklasse.confirmed

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFonts(checkFonts())
      setCascade(checkCascade())
    })
  }, [])

  // Класс режима на корне — токены и стили дизайн-системы адресуют его.
  useEffect(() => {
    document.documentElement.classList.toggle('mode-praesentation', praesentation)
  }, [praesentation])

  return (
    <div className="flex h-screen flex-col bg-surface-canvas">
      <header className="z-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-strong bg-surface-default px-5 py-3">
        <p className="text-body text-text-primary">
          <span className="font-bold">All3</span>
          <span className="text-text-secondary"> · Indicative Offer Engine</span>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {/* Режим показа (правило 11). Вход в презентацию гейтуется
              открытым material-блокером (R-07) — заблокированный контрол
              объясняет почему (правило 12). */}
          <div role="radiogroup" aria-label="Modus" className="flex">
            {([['intern', 'Intern'], ['praesentation', 'Präsentation']] as const).map(
              ([m, label]) => {
                const active = s.mode === m
                const disabled = m === 'praesentation' && modeBlocked
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-disabled={disabled || undefined}
                    title={disabled
                      ? 'Erst nach bestätigter Klassifikation (offener Blocker DEMO-VI-0001)'
                      : undefined}
                    onClick={() => !disabled && s.setMode(m)}
                    className={'relative px-3 py-1 text-small outline-none ' +
                      'before:absolute before:left-1/2 before:top-1/2 ' +
                      'before:min-h-hit-target before:w-full before:-translate-x-1/2 ' +
                      'before:-translate-y-1/2 before:content-[""] ' +
                      'focus-visible:outline focus-visible:outline-2 ' +
                      'focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
                      (active
                        ? 'border-selected border-selection-border font-medium text-text-primary'
                        : 'border border-border-default text-text-secondary') +
                      (disabled ? ' text-text-disabled' : '')}
                  >
                    {active && <span aria-hidden="true" className="mr-1">✓</span>}
                    {label}
                  </button>
                )
              },
            )}
          </div>
          {!praesentation && (
            <p className="text-small text-text-secondary">
              Prototyp · Arithmetik echt, Parsing simuliert · DE
            </p>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar view={view} setView={setView} />

        <main className="min-w-0 flex-1 overflow-y-auto bg-surface-default">
          {view === 'projekte' && (
            <S1Projektliste openVorbereitung={() => setView('vorbereitung')} />
          )}
          {view === 'vorbereitung' && (
            <S2Vorbereitung openKonfigurator={() => setView('konfigurator')} />
          )}
          {view === 'konfigurator' && <S3Konfigurator />}
          {view === 'vergleich' && <S4Vergleich />}
          {view === 'export' && <S5Export />}
          {view === 'einstellungen' && <S6Einstellungen />}
          {view === 'grundlagen' && (
            <div className="px-7 py-6">
              <h1 className="text-display-numeric-narrow font-bold text-text-primary">
                Grundlagen
              </h1>
              <Diagnostics fonts={fonts} cascade={cascade} />
            </div>
          )}
        </main>

        <OfferPanel />
      </div>

      <UndoToast />
    </div>
  )
}
