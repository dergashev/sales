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
  labelEn: string
  kategorie: string
  kategorieEn: string
  wahrscheinlichkeit: string
  /**
   * Группа затрат-база, дословно из calculation-spec §1.4: `KG_320`
   * (подгруппа третьего уровня), `KG_300` (вся группа) либо `KG_200`
   * (отдельная группа, в блок Bauwerk не входящая вовсе).
   */
  base: string
  rate: string
  remedy: string
  remedyEn: string
  /** Код параметра источника, если драйвер объявлен через него (§1.4). */
  sourceParameter?: string
}

/**
 * Состояние базы KG 200 на момент расчёта.
 *
 * KG 200 отличается от KG 300 принципиально: она НЕ входит в `K_base`, а
 * появляется решением о включении группы (`coverage.KG_200`) и считается
 * каталогом позиций. Поэтому у её надбавки три разных ответа, и подменять
 * их нулём нельзя ни в одном из трёх случаев:
 *
 * - `amount` — группа включена и посчитана целиком: у надбавки есть база;
 * - `notIncluded` — группы нет в оффере: надбавке нечего удорожать, и это
 *   решённое коммерческое состояние, а не пробел;
 * - `notDetermined` — группа включена, но часть её позиций ещё не
 *   посчитана: 5 % от неполной базы — это не «почти правильно», это
 *   неверное число с видом правильного (правило 16).
 */
export type Kg200Basis =
  | { kind: 'amount'; exact: Decimal }
  | { kind: 'notIncluded' }
  | { kind: 'notDetermined' }

export type RiskBases = {
  /** Точное значение группы KG 300 — база для `KG_300` и для подгрупп. */
  kg300Exact: Decimal
  kg200: Kg200Basis
}

/**
 * Разрешение базы одного драйвера — ЯВНОЕ состояние, не `Decimal | null`.
 *
 * Прежняя редакция возвращала `Decimal | undefined` и вызывающий писал
 * `if (d) push(d)`. Активированный драйвер с неразрешимой базой исчезал
 * молча: `KG_200` не был ни `kg300Exact`, ни подгруппой `splitKg300`, так
 * что объявленный спецификацией драйвер Bestand/Abbruch не мог изменить
 * цену ни при каком состоянии продукта, и ничто об этом не сообщало.
 */
export type RiskBasisResolution =
  | { kind: 'resolved'; exact: Decimal }
  /** База существует и равна нулю — надбавка тоже ноль, и это посчитано. */
  | { kind: 'noCost'; reason: 'baseZero' }
  /** Группа-база не в оффере: удорожать нечего. */
  | { kind: 'outOfScope'; reason: 'kg200NotIncluded' }
  /** База ещё не определена — цена надбавки не определена (правило 16). */
  | { kind: 'notDetermined'; reason: 'kg200NotDetermined' }
  /**
   * Фикстура объявила базу, которую движок не знает. Это дефект данных, и
   * он обязан быть видимым: инвариант-тест запрещает такое состояние.
   */
  | { kind: 'unknownBase'; declared: string }

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
 * База одного драйвера. Разрешается по объявлению риска, а не по догадке:
 * `KG_320` — подгруппа третьего уровня, `KG_300` — вся группа, `KG_200` —
 * отдельная группа со своим состоянием включения.
 */
export function resolveRiskBasis(
  risk: RiskItem,
  bases: RiskBases,
): RiskBasisResolution {
  if (risk.base === 'KG_200') {
    switch (bases.kg200.kind) {
      case 'notIncluded': return { kind: 'outOfScope', reason: 'kg200NotIncluded' }
      case 'notDetermined':
        return { kind: 'notDetermined', reason: 'kg200NotDetermined' }
      case 'amount':
        return bases.kg200.exact.lte(0)
          ? { kind: 'noCost', reason: 'baseZero' }
          : { kind: 'resolved', exact: bases.kg200.exact }
    }
  }
  const exact = risk.base === 'KG_300'
    ? bases.kg300Exact
    : splitKg300(bases.kg300Exact).find((g) => g.id === risk.base)?.exact
  if (exact === undefined) return { kind: 'unknownBase', declared: risk.base }
  return exact.lte(0)
    ? { kind: 'noCost', reason: 'baseZero' }
    : { kind: 'resolved', exact }
}

/**
 * Вклад надбавки за один активный риск, вместе с состоянием его базы.
 *
 * Возвращаются ОБА: вклад — тому, кто считает, состояние — тому, кто
 * обязан объявить, почему вклада нет. Активированный драйвер без вклада и
 * без объявленного состояния — та самая молчаливая нулевая цена, которую
 * эта задача устраняет.
 */
export function riskOutcome(
  risk: RiskItem,
  bases: RiskBases,
): { basis: RiskBasisResolution; driver: Driver | null } {
  const basis = resolveRiskBasis(risk, bases)
  if (basis.kind !== 'resolved') return { basis, driver: null }
  const rate = new Decimal(risk.rate)
  return {
    basis,
    driver: {
      key: `risk_${risk.id}`,
      exact: basis.exact.mul(rate),
      label: `Risikozuschlag · ${risk.label}`,
      scopeRefs: [risk.base.replace('_', ' ')],
      basis: { kind: 'factor', appliedTo: basis.exact, factor: rate },
      // Применение надбавки — решение продавца: он вправе её снять, получив
      // документ. Это не факт здания и не база.
      origin: 'decision',
      // Аддитивная надбавка ПОСЛЕ блока (`calculation-spec` §2). В блок она
      // войти не может: тогда она увеличила бы собственную базу.
      block: 'surcharge',
    },
  }
}

/** Вклад надбавки — тонкая обёртка над `riskOutcome` для суммирующих мест. */
export function riskDriver(risk: RiskItem, bases: RiskBases): Driver | null {
  return riskOutcome(risk, bases).driver
}

/**
 * Состояние базы ОДНОГО применённого драйвера, как его видит расчёт.
 *
 * Живёт в результате проекции, потому что «надбавка применена» и «надбавка
 * в цене» — разные утверждения, и до этой задачи ни одна поверхность не
 * могла их различить: гейт клиентской выдачи утверждал «Risikozuschlag ist
 * aktiv und im Preis enthalten» по одному булеву флагу, не спросив, дошла
 * ли надбавка до цены.
 */
export type RiskBasisState = {
  riskId: string
  basis: RiskBasisResolution
}

/** Дошла ли применённая надбавка до цены. */
export function riskIsInPrice(state: RiskBasisState): boolean {
  return state.basis.kind === 'resolved'
}

/**
 * Предел суммы активных надбавок — calculation-spec §1.4: «Сумма активных
 * драйверов ограничена 12 % от Bauwerk — выше этого порога проект не
 * индикативный, а требующий предварительного изучения (система выдаёт
 * ПРЕДУПРЕЖДЕНИЕ, а не молча суммирует)».
 *
 * Порог именно предупреждающий: спецификация не даёт правила усечения, и
 * придумать его означало бы назвать цену, которой нет ни в одном
 * источнике. Поэтому функция ничего не ограничивает — она сообщает, что
 * порог пройден.
 *
 * Ставка порога живёт в `catalog.json` (`riskCapPercentOfBauwerk`), который
 * генерируется из спецификации, поэтому здесь она аргумент, а не константа.
 */
export function riskSurchargeExceedsCap(
  surchargeSum: Decimal, bauwerk: Decimal, capPercentOfBauwerk: Decimal,
): boolean {
  if (bauwerk.lte(0)) return false
  return surchargeSum.gt(bauwerk.mul(capPercentOfBauwerk).div(100))
}
