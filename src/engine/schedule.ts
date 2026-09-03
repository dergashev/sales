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

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Construction Period (тикет): выбранная дата начала строительства сдвигает
 * ScheduleModel как единое целое — якорь эпохи меняется, длительности и
 * зависимости между фазами НЕТ. Это не новая формула срока (§4 остаётся
 * тем же источником длительности): к каждой дате каждой метрики прибавляется
 * одна и та же целочисленная дельта в днях между исходным и выбранным
 * началом эпохи.
 *
 * `anchorStartISO` — исходное начало эпохи фикстуры (обычно начало фазы
 * `project.planning`); `chosenStartISO` — то, что выбрал продавец.
 */
export function shiftScheduleMetrics<
  M extends { startDate: string; endDate: string },
>(
  metrics: M[],
  anchorStartISO: string,
  chosenStartISO: string,
): M[] {
  const deltaDays = Math.round(
    (Date.parse(chosenStartISO) - Date.parse(anchorStartISO)) / 86_400_000,
  )
  if (deltaDays === 0) return metrics
  return metrics.map((m) => ({
    ...m,
    startDate: addDaysISO(m.startDate, deltaDays),
    endDate: addDaysISO(m.endDate, deltaDays),
  }))
}

/* ──────────────────── VR3-04 · the half-month lattice ─────────────────── */

/**
 * A construction schedule is planned in **Monatshälften**, and this is the
 * whole reason the two demonstration projects land on their authoritative
 * completion dates exactly rather than approximately.
 *
 * The fixture specification states three facts per project: the construction
 * start, the planned completion and the total duration in months — Project A
 * `15.03.2027 → 31.07.2028 · 16,5 Monate`, Project B `15.03.2027 →
 * 30.09.2028 · 18,5 Monate`. Half months are therefore not a rounding
 * artefact of the display (that is D-17's separate concern); they are the
 * unit the plan is actually built in.
 *
 * Adding `16,5 × 30,44` days to 15.03.2027 lands on 30.07.2028 — one day
 * short — and adding "16 calendar months and 15 days" lands on 30.07.2028
 * too. Neither reproduces the authority, and a schedule whose own arithmetic
 * cannot reach its own stated completion date is a schedule nobody can
 * confirm. So a schedule date lives on a LATTICE with two positions per
 * calendar month: the **15th** (`mid`) and the **month end** (`end`). One
 * half-month step moves from one position to the next, and the month end is
 * whatever the calendar says it is — 30.09., 31.07., 29.02. in a leap year.
 *
 * On that lattice `15.03.2027 + 33` half months is 31.07.2028 and `+ 37` is
 * 30.09.2028, both exact, and February needs no special case.
 */

export type SchedulePosition = 'mid' | 'end'

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Which lattice position a date occupies, or `null` when it occupies none —
 * an off-lattice date is a rejected input, never a silently snapped one.
 */
export function schedulePositionOf(iso: string): SchedulePosition | null {
  const { y, m, d } = parse(iso)
  if (d === 15) return 'mid'
  return d === lastDayOfMonth(y, m) ? 'end' : null
}

/** Lattice index: two slots per calendar month, `mid` before `end`. */
function slotOf(iso: string): number {
  const position = schedulePositionOf(iso)
  if (position === null) {
    throw new Error(`Termindatum liegt nicht im Monatshälften-Raster: ${iso}`)
  }
  const { y, m } = parse(iso)
  return (y * 12 + (m - 1)) * 2 + (position === 'mid' ? 0 : 1)
}

function isoOfSlot(slot: number): string {
  const monthIndex = Math.floor(slot / 2)
  const mid = slot % 2 === 0
  const y = Math.floor(monthIndex / 12)
  const m = (monthIndex % 12) + 1
  const d = mid ? 15 : lastDayOfMonth(y, m)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Advance (or rewind) a lattice date by whole half months. */
export function addHalfMonths(iso: string, halfMonths: number): string {
  if (!Number.isInteger(halfMonths)) {
    throw new Error(`Halbmonate müssen ganzzahlig sein: ${halfMonths}`)
  }
  return isoOfSlot(slotOf(iso) + halfMonths)
}

/** Half months between two lattice dates. Negative when `toISO` is earlier. */
export function halfMonthsBetween(fromISO: string, toISO: string): number {
  return slotOf(toISO) - slotOf(fromISO)
}

/**
 * Half months as a month figure for display. `33 → 16,5`, `24 → 12`.
 * The caller formats it; this only owns the halving, so no surface divides
 * by two on its own and no surface can disagree about the result.
 */
export function halfMonthsToMonths(halfMonths: number): Decimal {
  return new Decimal(halfMonths).div(2)
}
