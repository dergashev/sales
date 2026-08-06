import { Decimal } from 'decimal.js'
import derived from '../fixtures/derived-prototype.json'
import type { BuildingInput, Driver } from './calculate'

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

function denominatorValue(
  b: BuildingInput,
  denominator: OptionGroup['denominator'],
  bgfS: Decimal,
): Decimal {
  switch (denominator) {
    case 'BGF_ABOVE_GROUND': return b.bgfAboveGround
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
      exact: qty.mul(rate),
      label: `${g.label} · ${choice.label}`,
      scopeRefs: [scopeOf(g.id)],
      appliedTo: qty,
      factor: null,
    })
  }
  return out
}
