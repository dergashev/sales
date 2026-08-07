import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './primitives'
import { NNBSP } from '../engine/money'
import { useTx } from '../i18n'

/**
 * DC-10 · DocumentAnalysisProgress — Dokumentanalyse.
 *
 * Каноническое имя — Dokumentanalyse (ANALYSIS-001). Симуляция таймерами —
 * объявленная механика прототипа; дефект был бы в симуляции, выданной за
 * реализацию, поэтому запуск подписан «Simulation».
 *
 * Скелет — контрактный (ревью № 13, дефект 16): `.a3-analysis-spec` →
 * `.a3-analysis-track` (indeterminate-полоса системы; её ::before-развёртка
 * гаснет глобальным reduced-motion-блоком системы, правило 21) →
 * `.a3-analysis-log` (завершённые фазы с ✓) → активная фаза жирным →
 * `.a3-analysis-files` со строкой ошибки `.a3-analysis-error`. Прежняя
 * редакция собирала то же из утилит рядом с готовыми классами — двойник.
 *
 * Контрактные механики:
 * - проценты, которых мы не знаем, не показываются: полоса indeterminate
 *   (PROGRESS-001), никакого смешения с determinate;
 * - времена глаголов различаются (ANALYSIS-002): завершённая фаза — прошедшим
 *   (`2 Planversionen gefunden` — фикстурный образец контракта), активная —
 *   настоящим (`Prüft Planversionen …`);
 * - стадии cancellable: `Abbrechen` останавливает без потери завершённых фаз,
 *   `Fortsetzen` продолжает со следующей (ANALYSIS-003);
 * - один нечитаемый файл не отменяет остальные (ANALYSIS-005): ошибка несёт
 *   причину, последствие и средство, повтор — по файлу;
 * - высота фиксирована контрактом (min-height корня) — текст без прыжков;
 * - повторный анализ никогда не перезаписывает bestätigt/manuell erfasst
 *   (M-1/D-08) — в симуляторе значения фикстуры и не меняются.
 */

type Doc = { file: string; pages: number | null; parseStatus: string }

const PHASE_MS = 800

/** Тип файла для `.a3-ic` — из имени, а не из отдельного поля фикстуры. */
function ext(file: string): string {
  const dot = file.lastIndexOf('.')
  return dot < 0 ? '—' : file.slice(dot + 1).toUpperCase()
}

export function DocumentAnalysis({ docs, onManualCapture }: {
  docs: Doc[]
  onManualCapture: () => void
}) {
  const phaseId = useId()
  const tx = useTx()
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
      role="region"
      aria-busy={running || undefined}
      aria-labelledby={phaseId}
      className="a3-analysis-spec"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={phaseId} className="text-heading-3 font-bold text-text-primary">
          Dokumentanalyse
        </h2>
        <span className="text-small text-text-muted">
          Simulation · Parsing im Prototyp nachgestellt
        </span>
      </div>

      {/* Полоса: indeterminate, потому что общее количество шагов внутри
          фазы неизвестно (PROGRESS-001). Развёртка — ::before системы. */}
      {running
        ? <div className="a3-analysis-track mt-3" aria-hidden="true" />
        : <div className="mt-3" style={{ height: 'var(--border-width-strong)' }}
               aria-hidden="true" />}

      {/* Протокол: завершённые фазы остаются с ✓ (контрактный лог),
          активная — настоящим временем, жирным. */}
      <ol className="a3-analysis-log mt-3">
        {phases.slice(0, phase).map((ph) => (
          <li key={ph.done}>
            <span aria-hidden="true" className="a3-okc">✓</span> {ph.done}
          </li>
        ))}
      </ol>
      {running && phase < phases.length && (
        <p className="mt-2 text-small"><b>{phases[phase]!.active}</b></p>
      )}
      {cancelled && (
        <p className="mt-2 text-small text-text-muted">
          Angehalten nach {phase} von {phases.length} Phasen — Ergebnisse der
          abgeschlossenen Phasen bleiben gültig
        </p>
      )}

      {/* Файлы со статусом; ошибка — причина · последствие · средство
          (ANALYSIS-005). Успех остальных не отменяется. */}
      {ready && (
        <ul className="a3-analysis-files">
          {readable.map((d) => (
            /* Строка документа — анатомия DC-17: тип файла, имя, объём и
               правая группа статуса/действий. Прежде это был абзац
               списка: страницы и статус читались как продолжение имени
               файла, а не как отдельные факты (добор DC-COVERAGE). */
            <li key={d.file} className="a3-doc">
              <span className="a3-ic" aria-hidden="true">{ext(d.file)}</span>
              <span className="a3-nm">{d.file}</span>
              {d.pages !== null && (
                <span className="a3-pg">{d.pages}{NNBSP}S.</span>
              )}
              <span className="a3-right">
                <span className="a3-st">
                  <span aria-hidden="true" className="a3-okc">✓</span>
                  {tx('analysiert')}
                </span>
              </span>
            </li>
          ))}
          {failed.map((d) => (
            <li key={d.file} className="a3-doc a3-analysis-error">
              <span className="a3-ic" aria-hidden="true">{ext(d.file)}</span>
              <span className="a3-nm">{d.file}</span>
              {d.pages !== null && (
                <span className="a3-pg">{d.pages}{NNBSP}S.</span>
              )}
              <span className="a3-right">
                <span className="a3-st">
                  <span aria-hidden="true" className="a3-errc">✗</span>
                  {tx('nicht lesbar: Auflösung zu gering')}
                </span>
                <Button disabled
                        disabledReason="Datei-Upload existiert im Prototyp nicht — Parsing ist simuliert">
                  Besseren Scan hochladen
                </Button>
                <Button onClick={onManualCapture}>Manuell erfassen</Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {ready && failed.length > 0 && (
        <p className="a3-cap mt-2">
          Werte aus {failed.length === 1 ? 'dieser Datei' : 'diesen Dateien'} fehlen
          — {readable.length} andere Dokumente sind vollständig analysiert.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-text-muted">
          {ready && <>Protokoll gespeichert · bestätigte und manuell erfasste
            Werte bleiben bei erneuter Analyse unverändert (D-08)</>}
          {running && <>Stufe abbrechbar — abgeschlossene Phasen bleiben erhalten</>}
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
