import { Decimal } from 'decimal.js'

/**
 * Точное значение и его показ — две разные величины (CALC-007).
 *
 * Правило, которое здесь закодировано, стоило проекту нескольких циклов
 * аудита: **производные величины считаются от точных значений, никогда от
 * показанных**. Скидка от округлённого итога дала однажды «точное» значение,
 * завышенное на 160 €, и оно выглядело правдоподобно ровно потому, что было
 * почти верным.
 *
 * Поэтому `Money` не имеет способа отдать показ как число. `display` —
 * строка, и её нельзя случайно умножить.
 */

// 28 знаков хватает: самая длинная цепочка — база × три множителя × скидка.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

export type Rounding = { step: string; unit: string }

export const MONEY: Rounding = { step: '1000', unit: 'EUR' }
export const RATE: Rounding = { step: '1', unit: 'EUR/m2' }
export const PERCENT: Rounding = { step: '0.1', unit: 'pp' }

/** Узкий неразрывный пробел U+202F — разделитель числа и единицы в de-DE. */
export const NNBSP = ' '

export type Displayed = {
  /** Точное значение. Единственное, что участвует в дальнейших расчётах. */
  exact: Decimal
  /** Показ. Строка, а не число — умножить её нельзя. */
  display: string
  /** `≈`, если показ отличается от точного. Иначе пусто. */
  prefix: '≈' | ''
  /** Раскрытие для интерфейса и обязательной сноски в PDF и письме. */
  disclosure: string | null
}

function roundTo(value: Decimal, step: string): Decimal {
  const s = new Decimal(step)
  return value.div(s).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(s)
}

/** Немецкий формат: точка — разделитель тысяч, запятая — десятичная. */
export function formatDE(value: Decimal, decimals = 0): string {
  const fixed = value.toFixed(decimals, Decimal.ROUND_HALF_UP)
  const [int, frac] = fixed.split('.')
  const sign = int!.startsWith('-') ? '-' : ''
  const digits = sign ? int!.slice(1) : int!
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return sign + grouped + (frac ? ',' + frac : '')
}

/**
 * Приводит точное значение к показу по правилу округления.
 *
 * Обратный случай — тоже дефект: префикс `≈` у значения, которое от
 * округления не изменилось, утверждает расхождение, которого нет. Аудит
 * поймал это в проекте отдельным пунктом, поэтому условие здесь строгое
 * равенство, а не «похоже».
 */
export function present(exact: Decimal, rule: Rounding = MONEY): Displayed {
  const rounded = roundTo(exact, rule.step)
  const differs = !rounded.equals(exact)
  const decimals = rule.step.includes('.') ? rule.step.split('.')[1]!.length : 0
  return {
    exact,
    display: formatDE(rounded, decimals),
    prefix: differs ? '≈' : '',
    disclosure: differs
      ? `Gerundet auf ${formatDE(new Decimal(rule.step))}${NNBSP}${rule.unit === 'EUR' ? '€' : rule.unit}; ` +
        `exakter Rechenwert ${formatDE(exact, 2)}${NNBSP}${rule.unit === 'EUR' ? '€' : rule.unit}`
      : null,
  }
}

/** Готовая к выводу строка: префикс, число, узкий неразрывный, единица. */
export function label(d: Displayed, unit = '€'): string {
  return `${d.prefix}${d.prefix ? NNBSP : ''}${d.display}${NNBSP}${unit}`
}

/**
 * A DRIVING QUANTITY, typeset once (rule 7, rule 36).
 *
 * `KgServiceKind.quantity` stores its value locale-free, exactly as the user
 * typed it, so an invalid entry can be shown back to them (rule 12). That raw
 * string is the right thing inside the FIELD and the wrong thing everywhere
 * else: printed as-is a site clearance of 9500 square metres reads
 * `9500 m²` — neither German grouping nor the narrow no-break space rule 7
 * requires between a number and its unit.
 *
 * The value's OWN precision is preserved rather than forced to a fixed
 * number of places: a count stays `4`, and an entered `1187.5` stays
 * `1.187,5`. That is the same distinction `SCOPE_QUANTITY_IS_COUNT` draws
 * for the other catalogue, made here from the value instead of from a list,
 * because the value already knows.
 *
 * German is produced here and `localizeMoneyText` re-typesets it for EN —
 * the chain money already uses. An UNPARSEABLE raw string is returned with
 * its unit and no grouping: the reader has to see what they actually typed
 * beside the error that names the problem.
 */
export function quantityLabel(raw: string, unit: string): string {
  const trimmed = raw.trim()
  const fraction = trimmed.split('.')[1]
  let value: Decimal
  try {
    value = new Decimal(trimmed)
  } catch {
    return `${trimmed}${NNBSP}${unit}`
  }
  if (!value.isFinite()) return `${trimmed}${NNBSP}${unit}`
  return `${formatDE(value, fraction ? fraction.length : 0)}${NNBSP}${unit}`
}

/**
 * Ставка с **типизированным знаменателем**.
 *
 * Знаменатель — не подпись, а ссылка на конкретную площадь с её типом.
 * Именно это закрывает `DATA-001`: сложить надземную и подземную площадь и
 * подписать результат «oberirdisch» становится невозможно, потому что у одной
 * ставки один знаменатель, и его тип назван.
 */
export type AreaType =
  | 'BGF_TOTAL' | 'BGF_ABOVE_GROUND' | 'BGF_BELOW_GROUND' | 'BGF_R' | 'BGF_S'
  | 'BGF_R_S' | 'WFL_WOFLV' | 'NUF_DIN277' | 'COMMUNAL_AREA' | 'CUSTOM_EXPLICIT'

/**
 * Знаменатель ставки бывает **двух видов** (data-model §5.3): площадь с
 * нормативом либо счётная величина. Смешивать их нельзя: у первой подпись
 * обязана называть норматив, у второй норматива не существует, и требовать
 * его значило бы выдумывать.
 *
 * Разница не теоретическая. `€ je Wohneinheit` считался деньгами и
 * округлялся до 1.000 €, давая 239.000 вместо 238.615 — тест поймал это на
 * первом же прогоне. Ставка округляется до единицы, деньги до тысячи, и
 * различие между ними — вид знаменателя, а не размер числа.
 */
export type UnitCountType = 'WOHNEINHEITEN' | 'STELLPLAETZE'

export type Rate = Displayed & {
  numerator: Decimal
  denominator: Decimal
  denominatorType: AreaType | UnitCountType
  /** Подпись знаменателя обязана называть норматив (R-11, DATA-001). */
  denominatorLabel: string
  denominatorKind: 'area' | 'unitCount'
}

const UNIT_COUNT_LABEL: Record<UnitCountType, string> = {
  WOHNEINHEITEN: 'je Wohneinheit',
  STELLPLAETZE: 'je Stellplatz',
}

/**
 * Подписи знаменателей — один экспортируемый источник. Прежде правая панель
 * держала свои: `driverLabel` печатал «BGF oberirdisch» и «BGF unterirdisch»
 * рядом со ставкой, взятой из каталога напрямую. Две записи об одном
 * знаменателе расходятся при первой правке, и расходятся молча.
 */
export const DENOMINATOR_LABEL: Record<AreaType, string> = {
  BGF_TOTAL: 'BGF',
  BGF_ABOVE_GROUND: 'BGF oberirdisch',
  BGF_BELOW_GROUND: 'BGF unterirdisch',
  BGF_R: 'BGF R',
  BGF_S: 'BGF S',
  BGF_R_S: 'BGF R+S',
  WFL_WOFLV: 'WFL nach WoFlV',
  NUF_DIN277: 'NUF nach DIN 277',
  COMMUNAL_AREA: 'Gemeinschaftsfläche',
  CUSTOM_EXPLICIT: 'benutzerdefiniert',
}

function isUnitCount(t: AreaType | UnitCountType): t is UnitCountType {
  return t in UNIT_COUNT_LABEL
}

export function rate(
  numerator: Decimal,
  denominator: Decimal,
  denominatorType: AreaType | UnitCountType,
): Rate {
  if (denominator.lte(0)) {
    throw new Error(
      `знаменатель ставки должен быть положительным, получено ${denominator.toString()}`,
    )
  }
  const unitCount = isUnitCount(denominatorType)
  const exact = numerator.div(denominator)
  return {
    ...present(exact, RATE),
    numerator,
    denominator,
    denominatorType,
    denominatorKind: unitCount ? 'unitCount' : 'area',
    denominatorLabel: unitCount
      ? UNIT_COUNT_LABEL[denominatorType]
      : DENOMINATOR_LABEL[denominatorType],
  }
}

/**
 * `≈ 2.545 €/m² WFL nach WoFlV` либо `≈ 238.615 € je Wohneinheit`.
 * Знаменатель назван всегда; `€/m²` появляется только у площадных.
 */
export function rateLabel(r: Rate): string {
  return `${rateUnit(r)}${NNBSP}${r.denominatorLabel}`
}

/**
 * Ставка БЕЗ имени знаменателя: `≈ 2.545 €/m²`.
 *
 * Для узких плиток, где знаменатель назван в ПОДПИСИ (правило 31:
 * `Leitkennzahl … €/m² WFL nach WoFlV` — норматив принадлежит имени
 * метрики), а в значении остаётся число с единицей. Выбор единицы —
 * площадная или поштучная — живёт ТОЛЬКО здесь: тернарник, скопированный
 * в компонент, расходится с `rateLabel` при первой правке.
 */
export function rateUnit(r: Rate): string {
  const unit = r.denominatorKind === 'area' ? '€/m²' : '€'
  return `${r.prefix}${r.prefix ? NNBSP : ''}${r.display}${NNBSP}${unit}`
}
