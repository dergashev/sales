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

/**
 * Основание вклада — **одно типизированное поле**, а не два независимых.
 *
 * Прежняя пара `appliedTo`/`factor` допускала комбинацию «база есть,
 * множителя нет», и на ней DC-21 падал: поповер по одному `appliedTo`
 * печатал `formatDE(d.factor!)`, роняя весь экран при раскрытии любой
 * ценовой опции (сплошное ревью 26, находка 1). Хуже падения было второе:
 * ту же ветку он показывал у вкладов «ставка × количество», печатая
 * `Angewendet auf 2.000,00 €` для двух тысяч **квадратных метров** — верный
 * формат у неверной величины, и заметить это на переговорах нельзя.
 *
 * Тип запрещает обе ошибки по построению: у множителя есть база и
 * множитель, у ставки — количество с единицей и сама ставка, а у плоской
 * суммы основания нет вовсе. Единица живёт в данных, потому что выводить её
 * из имени ключа — ровно та догадка, против которой заведено поле `origin`.
 */
export type DriverBasis =
  | { kind: 'factor'; appliedTo: Decimal; factor: Decimal }
  | { kind: 'rate'; quantity: Decimal; unit: 'm²'; rate: Decimal }

/**
 * Вклад в цену (DC-44, DRIVER-007).
 *
 * `key` — уникальный ID вклада: один вклад не входит в два тотала и в два
 * драйвера. `scopeRefs` — позиции Scope Universe, на которые вклад ложится;
 * они **выведены, не назначены**: база объявлена как KG 300+400
 * (`calculation-spec.md` §1.1), множители применяются к ней же, а перечень
 * для регионального фактора объявлен поимённо в §2.3. Там, где источник
 * отнесения не объявлен, `scopeRefs` пуст — строка честно помечается
 * `Zuordnung offen`, а не приписывается наугад (R-25).
 *
 * `basis` питает DC-21: поповер происхождения обязан показать, из чего
 * вклад получен, а не только результат.
 */
export type Driver = {
  key: string
  exact: Decimal
  label: string
  scopeRefs: string[]
  basis: DriverBasis | null
  /**
   * Откуда взялся вклад. Поле, а не догадка по имени ключа: приёмка № 17
   * нашла «корзину», которая фильтровала драйверы префиксами `opt_/cov_/`
   * и потому молчала про выбор подвала, изменивший сумму. Классификация
   * принадлежит тому, кто вклад создаёт.
   *
   * `base` — базовая ставка объёма, не решение и не факт;
   * `fact` — свойство здания, которое ПОДТВЕРЖДАЮТ, а не выбирают
   *   (класс здания следует из этажности и пожарной концепции);
   * `decision` — то, что продавец выбрал и может отменить.
   */
  origin: 'base' | 'fact' | 'decision'
}

/** База KG 300+400 объявлена в `calculation-spec.md` §1.1 строкой K_base. */
const SCOPE_BAUWERK_BASE = ['KG 300', 'KG 400']
/** §2.3: «затронуто: KG 300 · KG 400 · UG (блок Bauwerk целиком)». */
const SCOPE_BAUWERK_FULL = ['KG 300', 'KG 400', 'UG']
const SCOPE_UG = ['UG']

export type BuildingResult = {
  buildingId: string
  drivers: Driver[]
  /** Блок Bauwerk: KG 300 + 400 + UG. Только к нему применим регион-фактор. */
  bauwerk: Decimal
  total: Displayed
  /** Подпись выводится из покрытия, а не назначается. */
  totalLabel: string
  completeness: 'complete' | 'incomplete'
  incompleteReasons: IncompleteReason[]
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
/**
 * Причина неполноты — ТИПИЗИРОВАННЫЙ код, не строка (ревью № 13, дефект 13).
 * Движок называет ЧТО случилось; КАК это сказать пользователю — забота UI
 * и его локализации. Прежняя редакция отдавала машинные и русские строки
 * (`coverage unknown: KG_500`) прямо на экран, включая презентацию.
 */
export type IncompleteReason =
  | { code: 'coverageUnknown'; groups: CostGroup[] }
  | { code: 'includedUnpriced'; groups: CostGroup[] }
  | { code: 'openMaterialIssues'; count: number }
  | { code: 'gebaeudeklasseUnconfirmed' }

export function deriveCompleteness(
  coverage: Coverage,
  unpricedIncluded: CostGroup[],
  openMaterialIssues: number,
): { completeness: 'complete' | 'incomplete'; reasons: IncompleteReason[] } {
  const reasons: IncompleteReason[] = []
  const unknown = (Object.entries(coverage) as [CostGroup, CoverageState][])
    .filter(([, s]) => s === 'unknown')
    .map(([g]) => g)
  if (unknown.length) reasons.push({ code: 'coverageUnknown', groups: unknown })
  if (unpricedIncluded.length) {
    reasons.push({ code: 'includedUnpriced', groups: unpricedIncluded })
  }
  if (openMaterialIssues > 0) {
    reasons.push({ code: 'openMaterialIssues', count: openMaterialIssues })
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
  drivers.push({
    key: 'basis', exact: base, label: 'Grundleistung',
      origin: 'base' as const,
    scopeRefs: SCOPE_BAUWERK_BASE, basis: null,
  })

  // Форма: множитель только если он есть в каталоге. MFH — базовая.
  const formKey = FORM_FACTOR_KEY[b.gebaeudeform]
  let running = base
  if (formKey) {
    const f = cat.costFactors.gebaeudeform[formKey]
    if (!f) throw new Error(`нет множителя формы для ${formKey}`)
    const uplift = running.mul(f.minus(1))
    running = running.plus(uplift)
    drivers.push({
      key: `gebaeudeform_${formKey}`, exact: uplift, label: 'Gebäudeform',
      origin: 'fact' as const,
      scopeRefs: SCOPE_BAUWERK_BASE,
      basis: { kind: 'factor', appliedTo: running.minus(uplift), factor: f },
    })
  }

  const gkFactor = cat.costFactors.gebaeudeklasse[b.gebaeudeklasse.value]
  if (!gkFactor) throw new Error(`нет множителя класса ${b.gebaeudeklasse.value}`)
  const gkUplift = running.mul(gkFactor.minus(1))
  if (!gkUplift.isZero()) {
    drivers.push({
      key: `gebaeudeklasse_${b.gebaeudeklasse.value}`,
      origin: 'fact' as const,
      exact: gkUplift,
      // Язык следствий, не код параметра (D-13). Следствия названы в
      // guidance-system.md и parameter-triage (C4.02/C4.03) — они не
      // выдуманы здесь.
      label: `Gebäudeklasse ${b.gebaeudeklasse.value.replace('GK_', '')} · `
        + 'Feuerwiderstand und Kapselung',
      scopeRefs: SCOPE_BAUWERK_BASE,
      basis: { kind: 'factor', appliedTo: running, factor: gkFactor },
    })
  }
  running = running.plus(gkUplift)

  const ehFactor = cat.costFactors.energiestandard[b.energiestandard]
  if (!ehFactor) throw new Error(`нет множителя стандарта ${b.energiestandard}`)
  const ehUplift = running.mul(ehFactor.minus(1))
  if (!ehUplift.isZero()) {
    drivers.push({
      key: `energiestandard_${b.energiestandard}`,
      origin: 'decision' as const,
      exact: ehUplift,
      // `EH 55` — имя норматива KfW, а не код параметра: LOCALE-009 держит
      // его в списке непереводимых нормативных терминов. Формулировки
      // следствий для энергостандарта источниками не объявлены, и
      // придумывать их здесь запрещено (R-25).
      label: `Energiestandard ${b.energiestandard.replace('_', ' ')}`,
      scopeRefs: SCOPE_BAUWERK_BASE,
      basis: { kind: 'factor', appliedTo: running, factor: ehFactor },
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
      origin: 'decision' as const,
      exact: ug,
      label: 'Untergeschoss inkl. Tiefgarage',
      // Вклад подвала — ставка × площадь, и поповер теперь это и
      // показывает: прежде он молчал о том, из чего сумма получена.
      basis: {
        kind: 'rate', quantity: b.bgfBelowGround, unit: 'm²',
        rate: cat.costFactors.untergeschoss.vollausbauMitTiefgarage,
      },
      scopeRefs: SCOPE_UG,
    })
  }

  const bauwerk = running.plus(ug)

  // Регион-фактор — к блоку Bauwerk, не к итогу. Выключен по умолчанию (D-15).
  let regional = new Decimal(0)
  if (cat.regionalFactor.active) {
    regional = bauwerk.mul(cat.regionalFactor.value.minus(1))
    drivers.push({
      key: 'regionalfaktor', exact: regional, label: 'Regionalfaktor',
      origin: 'decision' as const,
      scopeRefs: SCOPE_BAUWERK_FULL,
      basis: {
        kind: 'factor', appliedTo: bauwerk, factor: cat.regionalFactor.value,
      },
    })
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
    reasons.push({ code: 'gebaeudeklasseUnconfirmed' })
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
