import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Button, useReducedMotion } from './primitives'
import { NNBSP } from '../engine/money'

/**
 * DC-10 · DocumentAnalysisProgress — Dokumentanalyse.
 *
 * Каноническое имя — Dokumentanalyse (ANALYSIS-001). Симуляция таймерами —
 * объявленная механика прототипа; дефект был бы в симуляции, выданной за
 * реализацию, поэтому запуск подписан «Simulation».
 *
 * Контрактные механики:
 * - проценты, которых мы не знаем, не показываются: полоса indeterminate
 *   (PROGRESS-001), никакого смешения с determinate;
 * - времена глаголов различаются (ANALYSIS-002): завершённая фаза — прошедшим
 *   (`2 Planversionen gefunden` — фикстурный образец контракта), активная —
 *   настоящим (`Prüft Planversionen …`);
 * - завершённые фазы остаются списком с ✓ (максимум три видимых);
 * - стадии cancellable: `Abbrechen` останавливает без потери завершённых фаз,
 *   `Fortsetzen` продолжает со следующей (ANALYSIS-003);
 * - один нечитаемый файл не отменяет остальные (ANALYSIS-005): ошибка несёт
 *   причину, последствие и средство, повтор — по файлу;
 * - высота фиксирована — текст меняется без прыжков;
 * - повторный анализ никогда не перезаписывает bestätigt/manuell erfasst
 *   (M-1/D-08) — в симуляторе значения фикстуры и не меняются.
 */

type Doc = { file: string; pages: number | null; parseStatus: string }

const PHASE_MS = 800

export function DocumentAnalysis({ docs, onManualCapture }: {
  docs: Doc[]
  onManualCapture: () => void
}) {
  const reduced = useReducedMotion()
  const readable = docs.filter((d) => d.parseStatus !== 'failed')
  const failed = docs.filter((d) => d.parseStatus === 'failed')

  // Фазы: счётчики выводятся из фикстуры, тексты — по образцам контракта.
  const phases = [
    { active: 'Liest Dokumente …', done: `${docs.length} Dokumente gelesen` },
    { active: 'Prüft Planversionen …', done: '2 Planversionen gefunden' },
    { active: 'Extrahiert Werte …', done: `Werte extrahiert · Regelsatz RS${NNBSP}2026.2` },
  ]

  // ready (протокол сохранён) → running (симуляция) → cancelled → ready.
  const [phase, setPhase] = useState(phases.length) // = все завершены
  const [running, setRunning] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!running) return
    if (phase >= phases.length) { setRunning(false); return }
    timer.current = setTimeout(() => setPhase((n) => n + 1), PHASE_MS)
    return () => clearTimeout(timer.current)
  }, [running, phase])

  const start = () => { setPhase(0); setRunning(true) }
  const cancel = () => { clearTimeout(timer.current); setRunning(false) }
  const resume = () => setRunning(true)
  const ready = !running && phase >= phases.length
  const cancelled = !running && phase < phases.length

  return (
    <div
      aria-busy={running || undefined}
      className="border border-border-default p-4"
      style={{ minHeight: 'calc(var(--space-8) * 5)' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-heading-3 font-bold text-text-primary">Dokumentanalyse</h2>
        <span className="text-small text-text-muted">
          Simulation · Parsing im Prototyp nachgestellt
        </span>
      </div>

      {/* Полоса: indeterminate, потому что общее количество шагов внутри фазы
          неизвестно (PROGRESS-001). При reduced-motion полоса статична,
          активность несёт текст фазы. */}
      <div className="mt-3 h-1 w-full overflow-hidden bg-surface-subtle" aria-hidden="true">
        {running && !reduced && (
          <motion.div
            className="h-1 w-4 bg-border-strong"
            animate={{ x: ['0%', '2400%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {running && reduced && <div className="h-1 w-full bg-border-strong" />}
      </div>

      {/* Протокол фаз: завершённые остаются с ✓, активная — настоящим временем. */}
      <ol className="mt-3">
        {phases.map((ph, i) => (
          <li key={ph.active} className="flex items-baseline gap-2 py-1 text-small">
            {i < phase ? (
              <><span aria-hidden="true" className="w-3 shrink-0">✓</span>
                <span className="text-text-secondary">{ph.done}</span></>
            ) : i === phase && running ? (
              <><span aria-hidden="true" className="w-3 shrink-0">…</span>
                <span className="font-medium text-text-primary">{ph.active}</span></>
            ) : (
              <><span aria-hidden="true" className="w-3 shrink-0"></span>
                <span className="text-text-muted">{ph.active.replace(' …', '')}</span></>
            )}
          </li>
        ))}
      </ol>

      {/* Ошибка файла: причина · последствие · средство (ANALYSIS-005).
          Успешные результаты остальных файлов не отменяются. */}
      {ready && failed.map((d) => (
        <div key={d.file} className="mt-3 border-contrast border-border-error p-3">
          <p className="text-small text-text-primary">
            <span aria-hidden="true">✗ </span>
            {d.file} nicht lesbar: Auflösung zu gering
          </p>
          <p className="a3-cap mt-1">
            Werte aus dieser Datei fehlen — {readable.length} andere Dokumente
            sind vollständig analysiert.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled disabledReason="Datei-Upload existiert im Prototyp nicht — Parsing ist simuliert">
              Besseren Scan hochladen
            </Button>
            <Button onClick={onManualCapture}>Manuell erfassen</Button>
          </div>
        </div>
      ))}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-text-muted">
          {ready && <>Protokoll gespeichert · bestätigte und manuell erfasste
            Werte bleiben bei erneuter Analyse unverändert (D-08)</>}
          {running && <>Stufe abbrechbar — abgeschlossene Phasen bleiben erhalten</>}
          {cancelled && <>Angehalten nach {phase} von {phases.length} Phasen —
            Ergebnisse der abgeschlossenen Phasen bleiben gültig</>}
        </p>
        <div className="flex gap-2">
          {running && <Button onClick={cancel}>Abbrechen</Button>}
          {cancelled && <Button variant="primary" onClick={resume}>Fortsetzen</Button>}
          {ready && <Button onClick={start}>Analyse erneut ausführen</Button>}
        </div>
      </div>
    </div>
  )
}
