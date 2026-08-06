import { useEffect, useState } from 'react'
import demo from '../fixtures/demo-0001.json'
import { useStore } from '../state/store'
import { Button, Skeleton, UncertaintyBadge } from '../components/primitives'

// Симулированная загрузка очереди — один раз за сессию, чтобы навигация
// назад-вперёд не проигрывала скелетон заново (loading ≠ decor).
let queueLoadedOnce = false

/**
 * S1 Projektliste — очередь действий, не таблица проектов.
 *
 * «Heute zu erledigen» — не статус, а функция: близость встречи × неготовность
 * подготовки. Статус, который надо поддерживать руками, всегда врёт;
 * вычисленное представление всегда честно.
 *
 * Карточка — один клик-контейнер; кнопки внутри останавливают всплытие
 * (правило 26). Демо-набор одного проекта: свёрнутые группы показывают
 * механику очереди, их счётчики — статика спецификации, не данные.
 */
export function S1Projektliste({ openVorbereitung }: { openVorbereitung: () => void }) {
  const s = useStore()
  const p = s.projection()
  const [loading, setLoading] = useState(!queueLoadedOnce)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => { queueLoadedOnce = true; setLoading(false) }, 700)
    return () => clearTimeout(t)
  }, [loading])

  const openQuestions =
    (s.fields.wfl.provenance === 'vom Kunden bestätigt' ? 0 : 1) +
    (s.esConfirmed ? 0 : 1)
  const blocked = !s.building.gebaeudeklasse.confirmed

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <h1 className="text-heading-2 font-bold text-text-primary">Projekte</h1>
      </header>

      <h2 className="mt-5 text-small font-medium text-text-secondary">
        HEUTE ZU ERLEDIGEN
      </h2>

      {/* loading: скелетон повторяет высоту карточки — снятие не сдвигает
          вёрстку (правило 30; без shimmer). */}
      {loading && (
        <div className="mt-2 border border-border-subtle p-4"
             style={{ minHeight: 'calc(var(--space-8) * 3)' }}>
          <Skeleton lines={3} label="Projektliste wird geladen" />
        </div>
      )}
      {!loading && (<>

      {/* Карточка — один клик-контейнер (правило 26). Вложенный <button>
          внутри <button> невалиден, поэтому контейнер — div с ролью, полным
          клавиатурным путём и видимым фокусом; настоящая кнопка внутри
          останавливает всплытие. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${demo.project.name} vorbereiten`}
        onClick={openVorbereitung}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVorbereitung() }
        }}
        className="mt-2 min-h-hit-target cursor-pointer border border-border-default p-4 outline-none hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-body font-bold text-text-primary">
            {demo.project.name}
          </h3>
          <span className="text-body text-text-primary">Termin morgen 14:00</span>
        </div>
        <p className="mt-1 text-body text-text-secondary">
          Analyse abgeschlossen ·{' '}
          {openQuestions > 0
            ? `${openQuestions} offene Fragen unbeantwortet`
            : 'alle Fragen beantwortet'}
          {blocked && <> · <span aria-hidden="true">▲ </span>Klassifikation offen</>}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <UncertaintyBadge pp={p.uncertaintyPp} />
          {/* Кнопка внутри клик-контейнера: всплытие останавливает обёртка
              (правило 26 — карточка один контейнер, кнопки stopPropagation). */}
          <span onClick={(e) => e.stopPropagation()}>
            <Button variant="primary" onClick={openVorbereitung}>
              Vorbereiten
            </Button>
          </span>
        </div>
      </div>

      <div className="mt-6">
        {[
          ['NEU AUS HUBSPOT', 3],
          ['IN ARBEIT', 5],
          ['VERSENDET — WARTET AUF RÜCKMELDUNG', 8],
        ].map(([label, n]) => (
          <p key={String(label)} className="border-b border-border-subtle py-3 text-body text-text-secondary">
            <span aria-hidden="true">▸ </span>{label} ({n})
          </p>
        ))}
        <p className="mt-2 text-small text-text-muted">
          Gruppen sind Demo-Statik der Spezifikation: der Prototyp führt ein
          Projekt{s.mode === 'intern' ? ` (${demo.project.id})` : ''}, die
          Warteschlange zeigt die Mechanik.
        </p>
      </div>
      </>)}
    </div>
  )
}
