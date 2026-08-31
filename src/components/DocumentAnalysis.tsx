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

export function DocumentAnalysis({ docs, onManualCapture, heading, subheading }: {
  docs: Doc[]
  onManualCapture: () => void
  /**
   * VR2-02 (Project remediation, cycle 8, explicit Product directive): the
   * approved Project target's centre stage reads "Dokumente & Evidenz",
   * not the component's own registered canonical name (`ANALYSIS-001`,
   * `docs/audit/requirements-registry.md`). Overriding the RENDERED
   * heading per consumer — rather than renaming the registered contract
   * name itself — keeps `ANALYSIS-001` intact as this component's
   * identity/specimen name while letting the one current Product
   * consumer (OpportunityCard.tsx) present the target's literal copy.
   * Defaults to the canonical strings, so omitting these props reproduces
   * the exact previous behaviour.
   */
  heading?: string
  subheading?: string
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
    <div>
      {/* F15: this title used to sit INSIDE `.a3-analysis-spec`'s own
          bordered/padded box, one nesting level deeper than every other
          section heading on the Project Card — a fixed 16 px box padding on
          top of the page's own left inset, an offset off the page's shared
          left edge (measured 17 px beyond the other section headings, itself
          off the 4/8/12/16/24/32/48/64 scale once combined with the page's
          own inset). The heading is the section's own title, not the
          contract box's; it now sits at the same level as every other
          `.a3-sheet > h2`, with the box as its content below. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={phaseId} className="text-heading-3 font-bold text-text-primary">{heading ?? tx('Dokumentanalyse')}</h2>
          <p className="text-small text-text-muted">{subheading ?? tx('Simulation · Parsing im Prototyp nachgestellt')}</p>
        </div>
        {/* VR2-02 (Project remediation, cycle 7): the approved target places
            the re-run action top-right, next to the section caption, not
            buried below the whole file list — same action, same handler
            (`start`), moved from the bottom actions row so it is not
            rendered twice. */}
        {ready && <Button onClick={start}>{tx('Analyse erneut ausführen')}</Button>}
      </div>
      <div
        role="region"
        aria-busy={running || undefined}
        aria-labelledby={phaseId}
        className="a3-analysis-spec mt-3"
      >
      {/* Полоса: indeterminate, потому что общее количество шагов внутри
          фазы неизвестно (PROGRESS-001). Развёртка — ::before системы.
          VR2-02 (Project remediation, cycle 8, explicit Product directive):
          the approved target's resting "ready" state goes straight from
          the caption to the file rows — no visible progress track or
          completed-phase log, which is exactly the persistent state this
          fixture always starts in (never actually mid-run). The track is
          genuinely meaningless at rest (nothing is progressing), so it is
          simply omitted rather than rendered empty; it still appears the
          instant a real run starts (`running`). */}
      {running && <div className="a3-analysis-track mt-3" aria-hidden="true" />}

      {/* Протокол: завершённые фазы остаются с ✓ (контрактный лог,
          ANALYSIS-002 — completed steps use completed tense), активная —
          настоящим временем, жирным. VR2-02 (cycle 8): visible only WHILE
          an analysis is actually running or paused — the moment the log is
          functionally informative. In the persistent `ready` rest state it
          is `sr-only` (DOM/AT text unchanged, same established pattern as
          the workflow stepper's meta line in cycle 6): the ANALYSIS-002
          record still exists for assistive tech, but no longer consumes
          ~110px of sighted vertical space in the target's intended
          evidence-first first composition. */}
      <ol className={`a3-analysis-log mt-3${ready ? ' sr-only' : ''}`}>
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
                        disabledReason="Datei-Upload existiert im Prototyp nicht — Parsing ist simuliert">{tx('Besseren Scan hochladen')}</Button>
                <Button onClick={onManualCapture}>{tx('Manuell erfassen')}</Button>
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
          {ready && <>{tx('Protokoll gespeichert · bestätigte und manuell erfasste Werte bleiben bei erneuter Analyse unverändert (D-08)')}</>}
          {running && <>{tx('Stufe abbrechbar — abgeschlossene Phasen bleiben erhalten')}</>}
        </p>
        <div className="flex gap-2">
          {running && <Button onClick={cancel}>{tx('Abbrechen')}</Button>}
          {cancelled && <Button variant="primary" onClick={resume}>{tx('Fortsetzen')}</Button>}
        </div>
      </div>
      </div>
    </div>
  )
}
