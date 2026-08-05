import { Decimal } from 'decimal.js'
import { present, rate, type Displayed, type Rate } from './money'

/**
 * Расчёт варианта чистыми функциями. Цепочка — из `calculation-spec.md` §2.
 *
 * Три правила закодированы структурно, а не проверяются потом:
 *
 * 1. **`completeness` выводится, никогда не задаётся** (CALC-006). Поэтому
 *    подпись итога — возвращаемое значение, а не аргумент: назвать итог
 *    полным при неоценённой группе затрат здесь невозможно.
 * 2. **Множитель принадлежит оси, а не «типу здания»** (D-11 v2). Форма
 *    читается со здания, назначение — с сегмента; единого «типа» в аргументах
 *    нет, потому что у здания с двумя сегментами его не существует.
 * 3. **Региональный фактор применяется к блоку Bauwerk**, а не к итогу
 *    (CALC-009). Разница видна только когда есть надбавки за риск, и именно
 *    поэтому она закодирована сразу.
 */

export type CoverageState =
  | 'included' | 'excluded' | 'onRequest' | 'unknown' | 'notApplicable'

export type CostGroup = 'KG_100' | 'KG_200' | 'KG_300' | 'KG_400'
  | 'KG_500' | 'KG_600' | 'KG_700' | 'KG_800'

export type Coverage = Record<CostGroup, CoverageState>

export type BuildingInput = {
  id: string
  /** Ось Gebäudeform — уровень Building (D-11 v2). */
  gebaeudeform: 'MFH' | 'EFH_ZFH' | 'DH_REH' | 'BUERO'
  /** Класс здания. `state` важнее значения: спорное блокирует выдачу. */
  gebaeudeklasse: { value: 'GK_1_3' | 'GK_4' | 'GK_5'; confirmed: boolean }
  energiestandard: 'GEG' | 'EH_55' | 'EH_40'
  bgfAboveGround: Decimal
  bgfBelowGround: Decimal
  untergeschoss: 'kein_ug' | 'ab_decke' | 'vollausbau'
  hasParking: boolean
}

export type Catalog = {
  kBase: Decimal
  costFactors: {
    gebaeudeklasse: Record<string, Decimal>
    energiestandard: Record<string, Decimal>
    gebaeudeform: Record<string, Decimal>
    untergeschoss: { vollausbauMitTiefgarage: Decimal }
  }
  regionalFactor: { active: boolean; value: Decimal }
}

export type Driver = { key: string; exact: Decimal; label: string }

export type BuildingResult = {
  buildingId: string
  drivers: Driver[]
  /** Блок Bauwerk: KG 300 + 400 + UG. Только к нему применим регион-фактор. */
  bauwerk: Decimal
  total: Displayed
  /** Подпись выводится из покрытия, а не назначается. */
  totalLabel: string
  completeness: 'complete' | 'incomplete'
  incompleteReasons: string[]
}

const FORM_FACTOR_KEY: Record<BuildingInput['gebaeudeform'], string | null> = {
  MFH: null, // 1,00 — базовая форма, множителя нет по построению
  EFH_ZFH: 'EFH_ZFH',
  DH_REH: 'DH_REH',
  BUERO: 'BUERO',
}

/**
 * Подпись итога. Единственное место, где она рождается.
 *
 * `Gesamt netto` требует названного объёма; голое `Gesamt` — Unqualified
 * Total, запрещённый во всех профилях (R-18). Поэтому объём — обязательный
 * аргумент, а не опциональный.
 */
export function totalLabel(
  completeness: 'complete' | 'incomplete',
  declaredPricingScope: string,
  purpose: 'authoritative' | 'preview' = 'authoritative',
): string {
  const prefix = purpose === 'preview' ? 'Vorschau · ' : ''
  if (completeness === 'complete') {
    if (!declaredPricingScope.trim()) {
      throw new Error(
        'полный итог требует названного Declared Pricing Scope (R-18): ' +
          'итог без объёма является Unqualified Total и запрещён',
      )
    }
    return `${prefix}Gesamt netto · ${declaredPricingScope}`
  }
  return `${prefix}Zwischensumme der kalkulierten Positionen`
}

/**
 * Полнота выводится из покрытия и открытых проблем. Никогда не задаётся.
 *
 * Явное «по запросу» полноту **не нарушает** — оно решено, просто вне объёма
 * ценообразования. Смешение его с «неизвестно» было настоящим дефектом
 * контракта: одно коммерческое решение, другое пробел в данных.
 */
export function deriveCompleteness(
  coverage: Coverage,
  unpricedIncluded: CostGroup[],
  openMaterialIssues: number,
): { completeness: 'complete' | 'incomplete'; reasons: string[] } {
  const reasons: string[] = []
  const unknown = (Object.entries(coverage) as [CostGroup, CoverageState][])
    .filter(([, s]) => s === 'unknown')
    .map(([g]) => g)
  if (unknown.length) reasons.push(`coverage unknown: ${unknown.join(', ')}`)
  if (unpricedIncluded.length) {
    reasons.push(`включено без цены: ${unpricedIncluded.join(', ')}`)
  }
  if (openMaterialIssues > 0) {
    reasons.push(`открытых существенных проблем: ${openMaterialIssues}`)
  }
  return {
    completeness: reasons.length ? 'incomplete' : 'complete',
    reasons,
  }
}

export function calculateBuilding(
  b: BuildingInput,
  cat: Catalog,
  coverage: Coverage,
  opts: { unpricedIncluded?: CostGroup[]; openMaterialIssues?: number } = {},
): BuildingResult {
  const drivers: Driver[] = []

  const base = b.bgfAboveGround.mul(cat.kBase)
  drivers.push({ key: 'basis', exact: base, label: 'Grundleistung' })

  // Форма: множитель только если он есть в каталоге. MFH — базовая.
  const formKey = FORM_FACTOR_KEY[b.gebaeudeform]
  let running = base
  if (formKey) {
    const f = cat.costFactors.gebaeudeform[formKey]
    if (!f) throw new Error(`нет множителя формы для ${formKey}`)
    const uplift = running.mul(f.minus(1))
    running = running.plus(uplift)
    drivers.push({ key: `gebaeudeform_${formKey}`, exact: uplift, label: 'Gebäudeform' })
  }

  const gkFactor = cat.costFactors.gebaeudeklasse[b.gebaeudeklasse.value]
  if (!gkFactor) throw new Error(`нет множителя класса ${b.gebaeudeklasse.value}`)
  const gkUplift = running.mul(gkFactor.minus(1))
  if (!gkUplift.isZero()) {
    drivers.push({
      key: `gebaeudeklasse_${b.gebaeudeklasse.value}`,
      exact: gkUplift,
      label: `Gebäudeklasse ${b.gebaeudeklasse.value.replace('GK_', '')}`,
    })
  }
  running = running.plus(gkUplift)

  const ehFactor = cat.costFactors.energiestandard[b.energiestandard]
  if (!ehFactor) throw new Error(`нет множителя стандарта ${b.energiestandard}`)
  const ehUplift = running.mul(ehFactor.minus(1))
  if (!ehUplift.isZero()) {
    drivers.push({
      key: `energiestandard_${b.energiestandard}`,
      exact: ehUplift,
      label: `Energiestandard ${b.energiestandard.replace('_', ' ')}`,
    })
  }
  running = running.plus(ehUplift)

  // Подземный этаж. Ставка уже включает надбавку за паркинг, поэтому
  // отдельной опции «Tiefgaragen-Zuschlag» при этом варианте существовать
  // не может — иначе работа посчиталась бы дважды (CALC-013).
  let ug = new Decimal(0)
  if (b.untergeschoss === 'vollausbau') {
    ug = b.bgfBelowGround.mul(cat.costFactors.untergeschoss.vollausbauMitTiefgarage)
    drivers.push({
      key: 'untergeschoss_mit_tiefgarage',
      exact: ug,
      label: 'Untergeschoss inkl. Tiefgarage',
    })
  }

  const bauwerk = running.plus(ug)

  // Регион-фактор — к блоку Bauwerk, не к итогу. Выключен по умолчанию (D-15).
  let regional = new Decimal(0)
  if (cat.regionalFactor.active) {
    regional = bauwerk.mul(cat.regionalFactor.value.minus(1))
    drivers.push({ key: 'regionalfaktor', exact: regional, label: 'Regionalfaktor' })
  }

  const total = bauwerk.plus(regional)

  const issues = opts.openMaterialIssues ?? 0
  const { completeness, reasons } = deriveCompleteness(
    coverage,
    opts.unpricedIncluded ?? [],
    // Неподтверждённый класс здания — существенная проблема: спорное значение
    // не может стать подтверждённой клиентской подписью (CALC-003, MODE-001).
    issues + (b.gebaeudeklasse.confirmed ? 0 : 1),
  )
  if (!b.gebaeudeklasse.confirmed) {
    reasons.push('Gebäudeklasse: Prüfung erforderlich (CALC-004)')
  }

  return {
    buildingId: b.id,
    drivers,
    bauwerk,
    total: present(total),
    totalLabel: totalLabel(completeness, 'Grundleistung All3'),
    completeness,
    incompleteReasons: reasons,
  }
}

/** Сумма драйверов обязана равняться итогу. Это инвариант, а не пожелание. */
export function driversSum(drivers: Driver[]): Decimal {
  return drivers.reduce((acc, d) => acc.plus(d.exact), new Decimal(0))
}

/**
 * Разбивка KG в упрощённом режиме. Тотал **не меняется** (D-07):
 * это перераспределение, а не добавление.
 */
export type KgSplitVereinfacht = {
  KG_300: Decimal
  KG_400: Decimal
  KG_700: Decimal
}

export function kgSplitVereinfacht(total: Decimal): KgSplitVereinfacht {
  const split = {
    KG_300: total.mul('0.70'),
    KG_400: total.mul('0.22'),
    KG_700: total.mul('0.08'),
  }
  const sum = Object.values(split).reduce((a, b) => a.plus(b), new Decimal(0))
  if (!sum.equals(total)) {
    throw new Error(
      `сплит KG не сходится с итогом: ${sum.toString()} ≠ ${total.toString()}`,
    )
  }
  return split
}

/**
 * Агрегация комплекса. Удельные считаются **от сумм**, никогда как среднее
 * из средних (правило проекта 39). Ведущая метрика — надземная площадь, и
 * знаменатель обязан совпадать с подписью.
 */
export function aggregateComplex(
  results: BuildingResult[],
  areas: { aboveGround: Decimal; rs: Decimal },
): { total: Displayed; leadRate: Rate; secondaryRate: Rate } {
  const sum = results.reduce((a, r) => a.plus(r.total.exact), new Decimal(0))
  return {
    total: present(sum),
    leadRate: rate(sum, areas.aboveGround, 'BGF_ABOVE_GROUND'),
    secondaryRate: rate(sum, areas.rs, 'BGF_R_S'),
  }
}

/** Скидка от **точного** итога. База — не показанное значение (CALC-007). */
export function applyDiscount(exactTotal: Decimal, percent: Decimal): Displayed {
  return present(exactTotal.mul(new Decimal(1).minus(percent.div(100))))
}
