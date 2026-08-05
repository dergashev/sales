import { useEffect, useState } from 'react'
import { checkFonts, checkCascade, type FontCheck } from './lib/font-check'
import { Diagnostics } from './components/Diagnostics'
import { S3Konfigurator } from './screens/S3Konfigurator'
import { S2Vorbereitung } from './screens/S2Vorbereitung'
import { S4Vergleich } from './screens/S4Vergleich'
import { S5Export } from './screens/S5Export'
import { S1Projektliste } from './screens/S1Projektliste'
import { S6Einstellungen } from './screens/S6Einstellungen'

type View = 'projekte' | 'vorbereitung' | 'konfigurator' | 'vergleich' | 'export' | 'einstellungen' | 'grundlagen'

export function App() {
  const [view, setView] = useState<View>('konfigurator')
  const [fonts, setFonts] = useState<FontCheck | null>(null)
  const [cascade, setCascade] = useState<string[] | null>(null)

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFonts(checkFonts())
      setCascade(checkCascade())
    })
  }, [])

  return (
    <>
      {/* Переключатель вида — временный, до появления S1 с очередью проектов. */}
      <nav className="border-b border-border-subtle px-5 py-2" aria-label="Ansicht">
        <div className="mx-auto flex max-w-content gap-3">
          {(['projekte', 'vorbereitung', 'konfigurator', 'vergleich', 'export', 'einstellungen', 'grundlagen'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-current={view === v ? 'page' : undefined}
              className={'relative py-1 text-small before:absolute before:left-1/2 ' +
                'before:top-1/2 before:min-h-hit-target before:w-full ' +
                'before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""] ' +
                'outline-none focus-visible:outline focus-visible:outline-2 ' +
                'focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
                (view === v ? 'font-medium text-text-primary' : 'text-text-secondary')}
            >
              {({projekte: 'S1 Projekte', vorbereitung: 'S2 Vorbereitung', konfigurator: 'S3 Konfigurator', vergleich: 'S4 Vergleich', export: 'S5 Export', einstellungen: 'S6 Einstellungen', grundlagen: 'Grundlagen'} as const)[v]}
            </button>
          ))}
        </div>
      </nav>
      {view === 'projekte' && (
        <S1Projektliste openVorbereitung={() => setView('vorbereitung')} />
      )}
      {view === 'einstellungen' && <S6Einstellungen />}
      {view === 'vorbereitung' && (
        <S2Vorbereitung openKonfigurator={() => setView('konfigurator')} />
      )}
      {view === 'konfigurator' && <S3Konfigurator />}
      {view === 'vergleich' && <S4Vergleich />}
      {view === 'export' && <S5Export />}
      {view === 'grundlagen' && <main className="mx-auto max-w-content px-5 py-7">
            <h1 className="text-display-numeric-narrow font-bold text-text-primary">
              Grundlagen
            </h1>
            <Diagnostics fonts={fonts} cascade={cascade} />
          </main>}
      {null}
    </>
  )
}
