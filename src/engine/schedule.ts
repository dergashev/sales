import { Decimal } from 'decimal.js'
import { NNBSP, formatDE } from './money'

/**
 * Длительность и её подпись. Здесь закодировано решение **D-17**, и это
 * единственное осознанное отклонение от норматива в движке.
 *
 * Норматив запрещает не месяцы, а **десятичный перевод**. Поэтому:
 * интервал, являющийся целым числом календарных месяцев, показывается целым
 * без десятичной части; в остальных случаях — округлением до половины месяца
 * с обязательным префиксом `≈` и абсолютной датой завершения рядом.
 *
 * Признак «интервал целый» выводится **из дат**, а не из округлённого числа:
 * если день месяца у начала и конца совпадает, интервал целый по определению.
 * Первая редакция проверяла округлённое значение, и это давало неверную ветку
 * на величине вроде 7,0 — она целая по виду, но интервал за ней не целый.
 */

export type DurationBasis = 'calendarDay' | 'workingDay'

export type ScheduleMetric = {
  metricKey: string
  kind: 'planning' | 'buildingExecution' | 'projectTotal'
  startDate: string
  endDate: string
  durationBasis: DurationBasis
}

export type DurationDisplay = {
  /** Точная модельная длительность в месяцах. Участвует в расчётах. */
  exactMonths: Decimal | null
  /** Целое число календарных месяцев, если интервал таков. */
  wholeMonths: number | null
  display: string
  prefix: '≈' | ''
  /** Абсолютная дата завершения. Обязательна рядом с длительностью (D-17). */
  completionDate: string
  policy: 'wholeCalendarMonthsElseDays' | 'halfMonthRounded'
}

function parse(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`дата не разобрана: ${iso}`)
  return { y, m, d }
}

/** Целых календарных месяцев, если день месяца совпадает. Иначе null. */
export function wholeCalendarMonths(startISO: string, endISO: string): number | null {
  const s = parse(startISO)
  const e = parse(endISO)
  if (s.d !== e.d) return null
  const months = (e.y - s.y) * 12 + (e.m - s.m)
  return months > 0 ? months : null
}

export function roundToHalf(value: Decimal): Decimal {
  return value.mul(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).div(2)
}

/**
 * Модельная длительность строительства из `bauzeit-methodology`.
 *
 * Таблица множителей срока **отдельная** от стоимостной. Их смешение однажды
 * завысило комплекс на 100.000 €, потому что для класса 4 стоимостной
 * множитель равен 1,00, а срочный — 1,05.
 */
export function modelDuration(
  bgfAboveGround: Decimal,
  formFactor: Decimal,
  gkFactor: Decimal,
): Decimal {
  const raw = new Decimal(5)
    .plus(bgfAboveGround.minus(1000).div(750))
    .mul(formFactor)
    .mul(gkFactor)
  return Decimal.max(raw, new Decimal(3))
}

export function presentDuration(
  metric: ScheduleMetric,
  exactMonths: Decimal | null,
): DurationDisplay {
  const whole = wholeCalendarMonths(metric.startDate, metric.endDate)

  if (whole !== null) {
    // Интервал целый — отклонение D-17 не задействуется вовсе.
    return {
      exactMonths,
      wholeMonths: whole,
      display: `${whole}${NNBSP}Monate`,
      prefix: '',
      completionDate: metric.endDate,
      policy: 'wholeCalendarMonthsElseDays',
    }
  }

  if (exactMonths === null) {
    throw new Error(
      `${metric.metricKey}: интервал не целый, поэтому нужна модельная ` +
        'длительность — показать нечего без неё',
    )
  }
  const rounded = roundToHalf(exactMonths)
  const differs = !rounded.equals(exactMonths)
  return {
    exactMonths,
    wholeMonths: null,
    display: `${formatDE(rounded, 1)}${NNBSP}Monate`,
    prefix: differs ? '≈' : '',
    completionDate: metric.endDate,
    policy: 'halfMonthRounded',
  }
}

/**
 * Дельта срока — **в днях**, а не в месяцах.
 *
 * Разность двух величин, округлённых до половины месяца, теряет смысл: две
 * подписи «7,5» и «7,5» могут скрывать разницу в четверть месяца. Поэтому
 * изменение показывается календарными днями, вычисленными из точных дат.
 */
export function durationDeltaDays(fromEndISO: string, toEndISO: string): number {
  const ms = Date.parse(toEndISO) - Date.parse(fromEndISO)
  return Math.round(ms / 86_400_000)
}

export function durationDeltaLabel(days: number): string {
  if (days === 0) return 'unverändert'
  const abs = Math.abs(days)
  const word = days < 0 ? 'früher' : 'später'
  return `${abs}${NNBSP}Kalendertage${NNBSP}${word}`
}

/**
 * Итог комплекса — `max(start + dauer)`, **не сумма** (правило проекта 39).
 * Складывать длительности зданий, идущих со сдвигом, значит утверждать
 * последовательную стройку там, где она параллельная.
 */
export function projectTotalEnd(metrics: ScheduleMetric[]): string {
  const ends = metrics
    .filter((m) => m.kind === 'buildingExecution')
    .map((m) => m.endDate)
  if (!ends.length) throw new Error('нет метрик исполнения зданий')
  return ends.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
}
