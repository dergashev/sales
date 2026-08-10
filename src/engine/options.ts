import { Decimal } from 'decimal.js'
import derived from '../fixtures/derived-prototype.json'
import { bgfAboveGround } from './calculate'
import type { BuildingInput, Driver } from './calculate'
import type { AreaType } from './money'

/**
 * Опции KG 300 как вклады в цену.
 *
 * Модель одна и она объясняет, почему фикстурный итог не поехал: базовая
 * ставка описывает **стандартный объём**, поэтому выбор по умолчанию даёт
 * ставку `0` и **не создаёт вклада вовсе**. Цену меняет только отклонение
 * от стандарта — и у каждого отклонения есть строка в Kostentreiber с
 * названной причиной.
 *
 * Альтернатива — считать каждую опцию абсолютной суммой и вычитать её из
 * базы — потребовала бы знать, что именно и в какой доле уже сидит в
 * `K_base`. Этого источники не говорят, а угадывать разложение базы
 * значило бы менять фикстурный итог на величину собственной догадки.
 *
 * Все ставки выведены (D-22) и несут пометку до самого экрана.
 */

export type OptionChoice = {
  value: string
  label: string
  rate: string
  basis: string
  /**
   * Классы здания, при которых выбор недоступен. Это НЕ коммерческое
   * ограничение, а нормативное: при GK 5 лифт обязателен, и «дешевле без
   * лифта» не является решением, которое продавец вправе принять.
   * Причина обязательна — заблокированный элемент объясняет себя (правило 12).
   */
  blockedWhenGk?: string[]
  blockedReason?: string
}

export type OptionGroup = {
  id: string
  label: string
  question: string
  denominator: 'BGF_ABOVE_GROUND' | 'BGF_BELOW_GROUND' | 'BGF_S'
  default: string
  documented: boolean
  documentRef?: string
  dependsOn?: { group: string; values: string[] }
  choices: OptionChoice[]
}

export const KG300_GROUPS = derived.kg300.groups as unknown as OptionGroup[]
export const KG400_GROUPS = derived.kg400.groups as unknown as OptionGroup[]
/**
 * Сертификаты — ОТДЕЛЬНАЯ ось от энергостандарта: EH описывает
 * энергетическое качество здания, QNG и DGNB — процедуру его
 * подтверждения. Одно не выводится из другого, и складывать их в один
 * селектор значило бы утверждать, что EH 40 автоматически даёт QNG.
 */
export const ZERT_GROUPS = derived.zertifikate.groups as unknown as OptionGroup[]

/** Все группы опций, влияющие на цену. Один список — один обход. */
export const ALL_OPTION_GROUPS: OptionGroup[] = [
  ...KG300_GROUPS, ...KG400_GROUPS, ...ZERT_GROUPS,
]

/** Недоступен ли выбор при текущем классе здания, и почему. */
export function choiceBlocked(
  c: OptionChoice, gk: string,
): { blocked: boolean; reason?: string } {
  const blocked = (c.blockedWhenGk ?? []).includes(gk)
  return blocked ? { blocked, reason: c.blockedReason } : { blocked: false }
}

/** Выбор по умолчанию для всех групп — состояние «стандартный объём». */
export function defaultOptionChoices(): Record<string, string> {
  return Object.fromEntries(ALL_OPTION_GROUPS.map((g) => [g.id, g.default]))
}

/**
 * Группа показывается, только если её условие выполнено: тип балкона не
 * существует, пока балконы не включены, а цвет клинкера — пока фасад не
 * клинкерный. Скрытая группа не участвует и в цене.
 */
export function isGroupActive(g: OptionGroup, chosen: Record<string, string>): boolean {
  if (!g.dependsOn) return true
  return g.dependsOn.values.includes(chosen[g.dependsOn.group] ?? '')
}

/** Группа затрат вклада выводится из группы опции, а не назначается. */
function scopeOf(groupId: string): string {
  if (groupId.startsWith('kg4')) return 'KG 400'
  if (groupId === 'qng' || groupId === 'dgnb') return 'KG 700'
  return 'KG 300'
}

/**
 * Знаменатель опции — тот же типизированный `AreaType`, что у ставок. Имя
 * оси в фикстуре и имя площади в движке совпадают по значению, но не по
 * написанию, поэтому соответствие объявлено, а не угадано.
 */
const AREA_OF: Record<OptionGroup['denominator'], AreaType> = {
  BGF_ABOVE_GROUND: 'BGF_ABOVE_GROUND',
  BGF_BELOW_GROUND: 'BGF_BELOW_GROUND',
  BGF_S: 'BGF_S',
}

function denominatorValue(
  b: BuildingInput,
  denominator: OptionGroup['denominator'],
  bgfS: Decimal,
): Decimal {
  switch (denominator) {
    case 'BGF_ABOVE_GROUND': return bgfAboveGround(b)
    case 'BGF_BELOW_GROUND': return b.bgfBelowGround
    case 'BGF_S': return bgfS
  }
}

/**
 * Вклады выбранных опций. Ставка `0` вклада не создаёт: строка «ничего не
 * изменилось» в водопаде — шум, а не информация, и она ломала бы правило
 * «до пяти драйверов» (DC-44).
 */
export function optionDrivers(
  b: BuildingInput,
  chosen: Record<string, string>,
  bgfS: Decimal,
): Driver[] {
  const out: Driver[] = []
  for (const g of ALL_OPTION_GROUPS) {
    if (!isGroupActive(g, chosen)) continue
    const value = chosen[g.id] ?? g.default
    const choice = g.choices.find((c) => c.value === value)
    if (!choice) continue
    const rate = new Decimal(choice.rate)
    if (rate.isZero()) continue
    const qty = denominatorValue(b, g.denominator, bgfS)
    if (qty.lte(0)) continue
    out.push({
      key: `opt_${g.id}_${choice.value}`,
      origin: 'decision' as const,
      // Опции KG 300/400 меняют сам блок Bauwerk; сертификаты живут в
      // KG 700 и блоком не являются. Место выводится из группы затрат
      // опции, которая уже объявлена `scopeOf`.
      block: scopeOf(g.id) === 'KG 700'
        ? ('separatePosition' as const) : ('bauwerk' as const),
      exact: qty.mul(rate),
      label: `${g.label} · ${choice.label}`,
      scopeRefs: [scopeOf(g.id)],
      basis: {
        kind: 'rate', quantity: qty, denominator: AREA_OF[g.denominator], rate,
      },
    })
  }
  return out
}

/**
 * Ставки групп затрат, включаемых решением пользователя.
 *
 * Отличие от опций KG 300/400 существенное: те описывают ОТКЛОНЕНИЕ от
 * стандартного объёма, поэтому умолчание стоит ноль. Эти группы в
 * базовую ставку не входят вовсе (`K_base` = KG 300+400), поэтому
 * включение действительно добавляет стоимость, а исключение ничего не
 * отнимает. Смешать две модели значило бы посчитать одно и то же дважды.
 */
export type CoverageRate =
  | {
      kind?: undefined
      rate: string
      denominator: 'BGF_ABOVE_GROUND' | 'BGF_BELOW_GROUND' | 'BGF_S'
      label: string
      basis: string
    }
  /**
   * Группа, чью долю объявляет спецификация. Ставки за m² у неё нет и быть
   * не может: подменить объявленную формулу выведенной ставкой — не то же
   * самое, что заполнить пробел (решение D-27).
   */
  | { kind: 'percentOfBauwerk'; label: string; basis: string }

export const COVERAGE_RATES =
  derived.coverage.rates as unknown as Record<string, CoverageRate>

/**
 * Сумма одной группы затрат. **Один калькулятор** для плитки выбора, для
 * предпросмотра, для правой панели и для выдачи.
 *
 * Прежде плитка считала сама: `new Decimal(spec.rate).mul(bgfAboveGround)`.
 * Она обещала `+230.000 €`, а итог менялся на другую величину, потому что
 * итог считался по включённым зданиям, а плитка — по активному, и потому
 * что ставка группы больше не ставка (сплошное ревью 26, находки 8 и 13).
 * Второй калькулятор той же величины расходится с первым молча.
 */
export function coverageAmount(
  spec: CoverageRate,
  b: BuildingInput,
  bgfS: Decimal,
  bauwerk: Decimal,
  shares: { kg500PercentOfBauwerk: Decimal },
): Decimal | null {
  if (spec.kind === 'percentOfBauwerk') {
    if (bauwerk.lte(0)) return null
    return bauwerk.mul(shares.kg500PercentOfBauwerk).div(100)
  }
  const rate = new Decimal(spec.rate)
  if (rate.isZero()) return null
  const qty = denominatorValue(b, spec.denominator, bgfS)
  if (qty.lte(0)) return null
  return qty.mul(rate)
}

/** Вклады включённых групп затрат. Только `included` создаёт строку. */
export function coverageDrivers(
  b: BuildingInput,
  coverage: Record<string, string>,
  bgfS: Decimal,
  /** Блок Bauwerk здания — база для групп, чью долю объявляет спецификация. */
  bauwerk: Decimal,
  shares: { kg500PercentOfBauwerk: Decimal },
): Driver[] {
  const out: Driver[] = []
  for (const [kg, spec] of Object.entries(COVERAGE_RATES)) {
    if (coverage[kg] !== 'included') continue
    const common = {
      key: `cov_${kg}`,
      origin: 'decision' as const,
      // Эти группы в блок Bauwerk не входят вовсе (`K_base` = KG 300+400),
      // поэтому они добавляют к итогу, но базой для долей и надбавок не
      // становятся.
      block: 'separatePosition' as const,
      label: `${kg.replace('_', ' ')} · ${spec.label}`,
      scopeRefs: [kg.replace('_', ' ')],
    }
    if (spec.kind === 'percentOfBauwerk') {
      if (bauwerk.lte(0)) continue
      const factor = shares.kg500PercentOfBauwerk.div(100)
      out.push({
        ...common,
        exact: bauwerk.mul(factor),
        basis: { kind: 'factor', appliedTo: bauwerk, factor },
      })
      continue
    }
    const rate = new Decimal(spec.rate)
    if (rate.isZero()) continue
    const qty = denominatorValue(b, spec.denominator, bgfS)
    if (qty.lte(0)) continue
    out.push({
      ...common,
      exact: qty.mul(rate),
      basis: {
        kind: 'rate', quantity: qty, denominator: AREA_OF[spec.denominator], rate,
      },
    })
  }
  return out
}
