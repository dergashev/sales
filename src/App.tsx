import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { useT } from './i18n'
import { checkFonts, checkCascade, type FontCheck } from './lib/font-check'
import { SegmentedControl } from './components/controls'
import { Sidebar, type View } from './components/Sidebar'
import { OfferPanel } from './components/OfferPanel'
import { UndoToast } from './components/UndoToast'
import { S3Konfigurator } from './screens/S3Konfigurator'
import { S2Vorbereitung } from './screens/S2Vorbereitung'
import { S4Vergleich } from './screens/S4Vergleich'
import { S5Export } from './screens/S5Export'
import { S1Projektliste } from './screens/S1Projektliste'
import { S6Einstellungen } from './screens/S6Einstellungen'
import { Grundlagen } from './screens/Grundlagen'

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
  const t = useT()
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

  // Плотность независима от режима (D-16): класс существует в tokens.css.
  useEffect(() => {
    document.documentElement.classList.toggle('density-compact', s.density === 'kompakt')
  }, [s.density])

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
          <SegmentedControl
            layout="inline"
            legend="Modus"
            value={s.mode}
            onChange={(m) => s.setMode(m)}
            options={[
              { value: 'intern', label: t('shell.mode.intern') },
              {
                value: 'praesentation',
                label: t('shell.mode.praesentation'),
                disabled: modeBlocked,
                disabledReason: modeBlocked ? t('shell.mode.blockedReason') : undefined,
              },
            ]}
          />
          {!praesentation && (
            <p className="text-small text-text-secondary">
              {t('shell.prototypeNote')} · {s.uiLanguage.toUpperCase()}
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
          {view === 'grundlagen' && <Grundlagen fonts={fonts} cascade={cascade} />}
        </main>

        <OfferPanel />
      </div>

      <UndoToast />
    </div>
  )
}
