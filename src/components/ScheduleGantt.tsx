import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * DC-19 · ScheduleGantt — Bauzeit-Leiste со сдвинутыми стартами.
 *
 * Полный каркас контракта (ревью № 13, дефект 11): `.a3-gantt >
 * .a3-gantt-scroll > .a3-gantt-visual` с эпохой, подписями фаз ВНУТРИ
 * сегментов, осью месяцев и легендой; табличная альтернатива —
 * `details.a3-gantt-details > table.a3-gantt-table`. Прежняя редакция
 * брала только корень и дорожки — на экране были серые полосы без
 * названий фаз, то есть иллюстрация без содержания.
 *
 * Контрактное требование, которое легко упустить: **диаграмма
 * `aria-hidden`, содержание читается из табличной альтернативы**
 * (`GANTT-003`). Полоса — иллюстрация уже названного числа, а не
 * единственный носитель.
 *
 * Границы фаз выведены из дат метрик фикстуры, а не назначены (R-25);
 * подписи длительности приходят от вызывающего из того же источника,
 * что герой срока в панели, — два представления одной даты обязаны
 * приходить из одного места.
 */

export type Phase = {
  /** Ключ строки: он же ID вклада, если фаза когда-нибудь станет ценой. */
  key: string
  label: string
  /** Строка диаграммы (здание/проект) и зависимость — колонки таблицы. */
  unit: string
  dependency: string
  startISO: string
  endISO: string
  /** Подпись длительности из модели (D-17): «3 Monate», «≈ 7,5 Monate ab OKBP». */
  durationLabel: string
  /** Семантический цвет фазы — токен dataviz; носитель смысла — подпись. */
  colorVar: string
  /** Светлый сегмент → тёмная подпись (класс контракта). */
  lightSegment?: boolean
}

function days(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000)
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

const DAYS_PER_MONTH = 30.436875

export function ScheduleGantt({ phases, finishISO, caption, provenance }: {
  phases: Phase[]
  /** Веха завершения — отдельная отметка `.a3-g-fin`, не конец последней фазы. */
  finishISO: string
  caption: string
  /** Строка происхождения расчёта (интерн): календарь, правило, прогон. */
  provenance?: string
}) {
  const reduced = useReducedMotion()
  // Сегменты въезжают транзишном системы (`.a3-gantt.a3-in`); при
  // prefers-reduced-motion класс ставится сразу — движения нет (правило 21).
  const [entered, setEntered] = useState(!!reduced)
  useEffect(() => {
    if (reduced) { setEntered(true); return }
    const t = setTimeout(() => setEntered(true), 30)
    return () => clearTimeout(t)
  }, [reduced])

  if (phases.length === 0) {
    // Пустота объявляет себя (правило 30): молчаливый null был дефектом 3.
    return (
      <p className="a3-cap">
        <span aria-hidden="true">○ </span>
        Keine Terminphasen im Modell — der Zeitplan erscheint, sobald das
        ScheduleModel Phasen liefert.
      </p>
    )
  }
  const start = phases.reduce((a, p) => (p.startISO < a ? p.startISO : a), phases[0]!.startISO)
  const end = phases.reduce((a, p) => (p.endISO > a ? p.endISO : a), phases[0]!.endISO)
  const span = days(start, end)
  if (span <= 0) return null
  const pct = (from: string, to: string) => (days(from, to) / span) * 100
  const finishMonth = Math.round(days(start, finishISO) / DAYS_PER_MONTH)

  // Ось: отметка каждые 3 месяца от начала эпохи.
  const ticks: number[] = []
  for (let m = 0; m * DAYS_PER_MONTH <= span; m += 3) ticks.push(m)

  return (
    <div className={'a3-gantt' + (entered ? ' a3-in' : '')}>
      <div className="a3-gantt-scroll">
        {/* Диаграмма скрыта от скринридера: то же содержание он получает из
            таблицы ниже, и получает точнее (GANTT-003). */}
        <div className="a3-gantt-visual" aria-hidden="true">
          <p className="a3-gantt-epoch">
            Projektmonate ab Planungsbeginn · Start {formatDate(start)}
          </p>
          {phases.map((p, i) => (
            <div key={p.key} className="a3-g-row">
              <span className="a3-lbl">{p.unit}</span>
              <div className="a3-g-track">
                <div
                  className={'a3-g-seg' + (p.lightSegment ? ' a3-phase-ausbau' : '')}
                  style={{
                    left: `${pct(start, p.startISO)}%`,
                    width: `${pct(p.startISO, p.endISO)}%`,
                    background: `var(${p.colorVar})`,
                    transitionDelay: `${i * 0.1}s`,
                  }}
                  title={`${p.label} · ${p.durationLabel}`}
                >
                  <span className="a3-g-seg-label">{p.label}</span>
                </div>
                {p.endISO === end && finishISO <= end && (
                  <div className="a3-g-fin"
                       style={{ left: `${pct(start, finishISO)}%` }}
                       title={`Meilenstein · Monat ${finishMonth} · ${formatDate(finishISO)}`} />
                )}
              </div>
            </div>
          ))}
          <div className="a3-g-axis">
            <span />
            <div className="a3-scale">
              {ticks.map((m) => (
                <span key={m} style={{ left: `${(m * DAYS_PER_MONTH / span) * 100}%` }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="a3-g-legend">
            {phases.map((p) => (
              <span key={p.key}>
                <i style={{ background: `var(${p.colorVar})` }} />{p.label}
              </span>
            ))}
            <span>
              <i style={{ background: 'var(--color-text-primary)', width: 'var(--border-width-strong)' }} />
              Monat {finishMonth} · {formatDate(finishISO)}
            </span>
          </div>
        </div>
      </div>

      {/* Табличная альтернатива — равноправное представление, не сноска. */}
      <details className="a3-gantt-details" open>
        <summary>Tabellarische Terminansicht</summary>
        <div className="a3-tbl-scroll">
          <table className="a3-gantt-table">
            <caption className="a3-visually-hidden">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Phase</th>
                <th scope="col">Einheit</th>
                <th scope="col">Beginn</th>
                <th scope="col">Ende</th>
                <th scope="col">Dauer</th>
                <th scope="col">Abhängigkeit</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.label}</th>
                  <td>{p.unit}</td>
                  <td className="numeric">{formatDate(p.startISO)}</td>
                  <td className="numeric">{formatDate(p.endISO)}</td>
                  <td className="numeric">{p.durationLabel}</td>
                  <td>{p.dependency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {provenance && <p className="a3-gantt-provenance">{provenance}</p>}
    </div>
  )
}
