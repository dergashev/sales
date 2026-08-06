import { NNBSP } from '../engine/money'

/**
 * DC-19 · ScheduleGantt — Bauzeit-Leiste со сдвинутыми стартами.
 *
 * Вид целиком из системы (`.a3-gantt > .a3-g-row > label + .a3-g-track >
 * .a3-g-seg`, ось и легенда — соседи). Здесь живёт только то, чего CSS не
 * знает: какие фазы, откуда их границы и как они читаются вслух.
 *
 * Контрактное требование, которое легко упустить: **диаграмма
 * `aria-hidden`, содержание читается из табличной альтернативы**
 * (`GANTT-003`). Полоса — иллюстрация уже названного числа, а не
 * единственный носитель. Поэтому таблица здесь не «дополнение для
 * скринридера», а равноправное представление тех же дат.
 *
 * Границы фаз выведены из дат метрики, а не назначены: доля фазы — это
 * её длительность к общей, посчитанная от тех же дат, что показывает
 * подпись. Придумывать разбиение фикстура не позволяет (R-25), поэтому
 * фазы приходят аргументом от вызывающего.
 */

export type Phase = {
  /** Ключ строки: он же ID вклада, если фаза когда-нибудь станет ценой. */
  key: string
  label: string
  startISO: string
  endISO: string
}

function days(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000)
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function ScheduleGantt({ phases, finishISO, caption }: {
  phases: Phase[]
  /** Веха завершения — отдельная отметка `.a3-g-fin`, не конец последней фазы. */
  finishISO: string
  caption: string
}) {
  if (phases.length === 0) return null
  const start = phases.reduce((a, p) => (p.startISO < a ? p.startISO : a), phases[0]!.startISO)
  const end = phases.reduce((a, p) => (p.endISO > a ? p.endISO : a), phases[0]!.endISO)
  const span = days(start, end)
  if (span <= 0) return null
  const pct = (from: string, to: string) => (days(from, to) / span) * 100

  return (
    <div>
      {/* Диаграмма скрыта от скринридера: то же содержание он получает из
          таблицы ниже, и получает точнее (GANTT-003). */}
      <div className="a3-gantt" aria-hidden="true">
        {phases.map((p) => (
          <div key={p.key} className="a3-g-row">
            <label>{p.label}</label>
            <div className="a3-g-track">
              <div
                className="a3-g-seg"
                style={{
                  left: `${pct(start, p.startISO)}%`,
                  width: `${pct(p.startISO, p.endISO)}%`,
                  transform: 'scaleX(1)',
                }}
              />
              <div className="a3-g-fin" style={{ left: `${pct(start, finishISO)}%` }} />
            </div>
          </div>
        ))}
        <div className="a3-g-legend">
          <span>{formatDate(start)}</span>
          <span>Fertigstellung {formatDate(finishISO)}</span>
        </div>
      </div>

      {/* Табличная альтернатива — равноправное представление, не сноска. */}
      <div className="a3-tbl-scroll mt-3">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="a3-cap text-left">Phase</th>
              <th scope="col" className="a3-cap text-left">Beginn</th>
              <th scope="col" className="a3-cap text-left">Ende</th>
              <th scope="col" className="a3-cap text-right">Dauer</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => (
              <tr key={p.key}>
                <th scope="row" className="a3-cap text-left font-regular">{p.label}</th>
                <td className="a3-cap numeric">{formatDate(p.startISO)}</td>
                <td className="a3-cap numeric">{formatDate(p.endISO)}</td>
                {/* Единица названа у каждой длительности, основание — календарные
                    дни: «дни» и «рабочие дни» это разные числа (durationBasis). */}
                <td className="a3-cap numeric text-right">
                  {days(p.startISO, p.endISO)}{NNBSP}Kalendertage
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
