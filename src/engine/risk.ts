import { Decimal } from 'decimal.js'
import derived from '../fixtures/derived-prototype.json'
import type { Driver } from './calculate'

/**
 * Risikozuschlag — надбавка за отсутствующий документ (D-02).
 *
 * Продуктовая суть, дословно из D-02: «мы добавили надбавку на фундаменты,
 * потому что нет Baugrundgutachten; пришлите его — снимем». Это РЕАЛЬНЫЕ
 * деньги, прибавляемые к цене, и их нельзя смешивать с Genauigkeitsband:
 * та — статистическая неопределённость, которая показывается диапазоном и
 * НЕ прибавляется.
 *
 * База надбавки — конкретная группа затрат (`KG 320` у Baugrund,
 * `KG 300` у статики). Именно поэтому появился третий уровень KG:
 * посчитать 4 % «примерно от KG 300» значило бы применить ставку к чужому
 * знаменателю — тот же класс ошибки, что DATA-001, где надземная и
 * подземная площади складывались под подписью «oberirdisch».
 *
 * Порядок операций (calculation-spec §2): модификаторы мультипликативны
 * ДО регионального фактора, надбавки и скидка аддитивны ПОСЛЕ.
 */

export type RiskItem = {
  id: string
  label: string
  kategorie: string
  wahrscheinlichkeit: string
  /** Группа затрат-база: `KG_320` либо `KG_300`. */
  base: string
  rate: string
  remedy: string
}

export const RISK_ITEMS = derived.risiken.items as unknown as RiskItem[]

const SPLIT = derived.kg300Split.shares as unknown as
  Record<string, { share: string; label: string }>

/** Подгруппы KG 300 в порядке DIN 276 — с долями и подписями. */
export const KG300_SUBGROUPS = Object.entries(SPLIT).map(([id, v]) => ({
  id, share: new Decimal(v.share), label: v.label,
}))

/**
 * Разбиение KG 300 по подгруппам. Считается от ТОЧНОГО значения группы
 * (CALC-007): «сначала округлили, потом посчитали» — источник расхождения,
 * при котором расшифровка не сходится сама с собой.
 */
export function splitKg300(kg300Exact: Decimal): Array<{
  id: string; label: string; exact: Decimal
}> {
  return KG300_SUBGROUPS.map((g) => ({
    id: g.id, label: g.label, exact: kg300Exact.mul(g.share),
  }))
}

/** Сумма подгрупп обязана равняться группе — инвариант, не пожелание. */
export function subgroupSum(kg300Exact: Decimal): Decimal {
  return splitKg300(kg300Exact).reduce((a, r) => a.plus(r.exact), new Decimal(0))
}

/**
 * Вклад надбавки за один активный риск. База берётся из объявления риска:
 * `KG_320` — подгруппа третьего уровня, `KG_300` — вся группа.
 */
export function riskDriver(
  risk: RiskItem,
  kg300Exact: Decimal,
): Driver | null {
  const base = risk.base === 'KG_300'
    ? kg300Exact
    : splitKg300(kg300Exact).find((g) => g.id === risk.base)?.exact
  if (!base || base.lte(0)) return null
  const rate = new Decimal(risk.rate)
  return {
    key: `risk_${risk.id}`,
    exact: base.mul(rate),
    label: `Risikozuschlag · ${risk.label}`,
    scopeRefs: [risk.base.replace('_', ' ')],
    basis: { kind: 'factor', appliedTo: base, factor: rate },
    // Применение надбавки — решение продавца: он вправе её снять, получив
    // документ. Это не факт здания и не база.
    origin: 'decision',
    // Аддитивная надбавка ПОСЛЕ блока (`calculation-spec` §2). В блок она
    // войти не может: тогда она увеличила бы собственную базу.
    block: 'surcharge',
  }
}
