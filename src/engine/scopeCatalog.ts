import { Decimal } from 'decimal.js'
import type { CostGroup, Driver } from './calculate'
import { NNBSP, formatDE } from './money'
import scopeCatalogFx from '../fixtures/scope-catalog.json'

/**
 * KG 200 / 500 / 600 / 800 option/variant catalog (тикет "MAKE ALL KG
 * 200–800 SELECTABLE & ADD COST-BEARING CONTENT…", источник —
 * `KG_200_500_600_800_CONFIGURATOR_RESEARCH.md`).
 *
 * Модель ОТДЕЛЬНАЯ от `engine/options.ts` (KG 300/400/Zertifikate) —
 * намеренно, а не по недосмотру: та модель знает только BGF-знаменатели
 * (`OptionGroup.denominator`) и по построению не может выразить тонны
 * грунта, штуки стояночных мест, здания, проценты от произвольной базы.
 * Расширять типизированный `AreaType`/`DriverBasis` под каждую новую
 * единицу измерения значило бы трогать нормативную, уже проверенную цепочку
 * форматирования (`money.ts`, `OfferPanel.tsx`), которую эта задача не
 * владеет и не обязана менять. Вместо этого количество/ставка/единица
 * называются прямо в подписи вклада (`label`) — то же требование
 * прозрачности (AC-09), другая поверхность показа: подробный Herkunft-
 * Popover для этих строк не строится, подпись самодостаточна.
 *
 * KG 300/400/700/`options.ts` этой моделью не затронуты.
 */

export type ScopeQuantityKey =
  | 'site_area_m2' | 'affected_site_area_m2' | 'existing_building_bgf_m2'
  | 'soil_disposal_t' | 'building_count' | 'private_infrastructure_area_m2'
  | 'compensation_area_m2' | 'hardscape_area_m2' | 'vegetated_area_m2'
  | 'sealed_connected_area_m2' | 'surface_parking_spaces' | 'bicycle_spaces'
  | 'amenity_area_m2' | 'external_light_count' | 'dwelling_count'
  | 'furnished_dwelling_count' | 'furnished_common_area_m2' | 'laundry_room_count'
  | 'guarantee_amount_eur'

/** Единица измерения количества — только для подписи вклада (см. выше). */
export const SCOPE_QUANTITY_UNIT: Record<ScopeQuantityKey, string> = {
  site_area_m2: 'm²', affected_site_area_m2: 'm²', existing_building_bgf_m2: 'm²',
  soil_disposal_t: 't', building_count: 'Gebäude',
  private_infrastructure_area_m2: 'm²', compensation_area_m2: 'm²',
  hardscape_area_m2: 'm²', vegetated_area_m2: 'm²', sealed_connected_area_m2: 'm²',
  surface_parking_spaces: 'Stellplatz', bicycle_spaces: 'Fahrradstellplatz',
  amenity_area_m2: 'm²', external_light_count: 'Leuchte', dwelling_count: 'Wohneinheit',
  furnished_dwelling_count: 'Wohneinheit', furnished_common_area_m2: 'm²',
  laundry_room_count: 'Waschküche', guarantee_amount_eur: '€',
}

/**
 * Квантити, выводимые из уже авторитетного состояния проекта, а не
 * запрашиваемые вводом (§7 приложения: «не спрашивать сумму вручную, если
 * существующий параметр проекта может её вести»).
 */
export const SCOPE_QUANTITY_DERIVED: ReadonlySet<ScopeQuantityKey> = new Set([
  'building_count', 'dwelling_count',
])

/**
 * Task 04 (F-11 companion, rule 36): discrete counts (Gebäude, Stellplätze,
 * Wohneinheiten …) formatted with `formatDE(qty, 2)` printed "2,00 Gebäude"
 * — a count is never fractional, and the two decimal places read as false
 * precision (audit finding: recap label "2,00 Gebäude × 20.000 €/Gebäude").
 * Measured quantities (m², t, €) keep 2 decimals; this set names exactly
 * the keys whose unit is a discrete item, not a measurement.
 */
export const SCOPE_QUANTITY_IS_COUNT: ReadonlySet<ScopeQuantityKey> = new Set([
  'building_count', 'dwelling_count', 'furnished_dwelling_count',
  'surface_parking_spaces', 'bicycle_spaces', 'external_light_count',
  'laundry_room_count',
])

export type ScopeOptionBasis =
  | { kind: 'perQuantity'; quantityKey: ScopeQuantityKey }
  /** KG600-07 Kunst am Bau: доля от уже посчитанного блока KG 300 + 400. */
  | { kind: 'percentOfKg300Kg400' }
  /** Ставка уже равна сумме за проект целиком (`per_project`). */
  | { kind: 'flat' }

export type ScopeVariant = {
  value: string
  labelDe: string
  labelEn: string
  summaryDe: string
  summaryEn: string
  characteristicsDe: readonly string[]
  characteristicsEn: readonly string[]
  /** Числовая строка. Для `percentOfKg300Kg400` — процент (например "0.50"). */
  rate: string
  /**
   * Второе число варианта — используется только KG800-06 (Bereitstellungszins):
   * `rate` = свободные месяцы, `rate2` = месячная ставка платы за
   * резервирование (%). KG 800 не проходит через `scopeCatalogDriver` — его
   * варианты читает `calculateKg800` напрямую (`state/store.ts`).
   */
  rate2?: string
  evidenceClass: 'R' | 'D' | 'P'
  /** KG200-01: количество меняется по варианту (площадь участка ИЛИ BGF сноса). */
  quantityKeyOverride?: ScopeQuantityKey
}

export type ScopeOption = {
  id: string
  kg: Extract<CostGroup, 'KG_200' | 'KG_500' | 'KG_600' | 'KG_800'>
  labelDe: string
  labelEn: string
  questionDe: string
  questionEn: string
  basis: ScopeOptionBasis
  default: string
  variants: readonly ScopeVariant[]
}

function euroPerUnit(rate: Decimal, unit: string): string {
  return `${formatDE(rate, unit === '€' ? 2 : 0)}${NNBSP}€/${unit}`
}

/**
 * Исход одного выбранного варианта — ТРИ состояния, а не «драйвер или
 * `null`».
 *
 * Прежняя редакция возвращала `null` и в случае осознанного нулевого
 * варианта каталога («Baufreies Grundstück» — настоящий, посчитанный 0 €),
 * и в случае недоступного количества (цена НЕИЗВЕСТНА). Снаружи эти два
 * случая неразличимы, и включённая позиция с непустой ставкой, у которой
 * ещё нет количества, исчезала из расчёта молча — ровно тот класс, что
 * запрещает правило 16: «неизвестно» никогда не равно нулю. Сумма при этом
 * выглядела законченной, потому что рядом лежала другая позиция той же
 * группы, чьё количество выводится из проекта.
 *
 * Числа не меняются: `priced` отдаёт тот же вклад, что прежде, остальные
 * два исхода вклада не создают. Меняется только то, что вызывающий теперь
 * ВИДИТ разницу и обязан её объявить.
 */
export type ScopeCatalogOutcome =
  /** Позиция посчитана. */
  | { kind: 'priced'; driver: Driver }
  /**
   * Решённый ноль: вариант объявляет ставку `0`, либо количество выведено
   * и равно нулю. Коммерческое решение, а не пробел — цена определена и
   * равна нулю.
   */
  | { kind: 'noCost'; reason: 'zeroRate' | 'zeroQuantity' }
  /**
   * Цена не определена: у ставки нет знаменателя. `quantityKey` называет
   * то, чего не хватает, чтобы поверхность могла сказать это словами.
   */
  | { kind: 'notDetermined'; quantityKey: ScopeQuantityKey | null }

export function scopeCatalogOutcome(
  option: ScopeOption,
  variant: ScopeVariant,
  quantityOf: (key: ScopeQuantityKey) => Decimal | null,
  kg300Plus400: Decimal,
): ScopeCatalogOutcome {
  const rate = new Decimal(variant.rate)
  if (rate.isZero()) return { kind: 'noCost', reason: 'zeroRate' }
  const scopeRef = option.kg.replace('_', ' ')
  const evidenceMark = variant.evidenceClass === 'R' ? '' : ` ${'⚙'}`

  if (option.basis.kind === 'percentOfKg300Kg400') {
    if (kg300Plus400.lte(0)) return { kind: 'notDetermined', quantityKey: null }
    const factor = rate.div(100)
    return {
      kind: 'priced',
      driver: {
        key: `scope_${option.id}_${variant.value}`,
        origin: 'decision',
        block: 'separatePosition',
        exact: kg300Plus400.mul(factor),
        label: `${option.labelDe} · ${variant.labelDe} · `
          + `${formatDE(rate, 2)}${NNBSP}%${NNBSP}von KG 300+400${evidenceMark}`,
        scopeRefs: [scopeRef],
        basis: { kind: 'factor', appliedTo: kg300Plus400, factor },
      },
    }
  }

  if (option.basis.kind === 'flat') {
    return {
      kind: 'priced',
      driver: {
        key: `scope_${option.id}_${variant.value}`,
        origin: 'decision',
        block: 'separatePosition',
        exact: rate,
        label: `${option.labelDe} · ${variant.labelDe}${evidenceMark}`,
        scopeRefs: [scopeRef],
        basis: null,
      },
    }
  }

  const quantityKey = variant.quantityKeyOverride ?? option.basis.quantityKey
  const qty = quantityOf(quantityKey)
  // Отсутствующее количество и введённый ноль — разные ответы. Первое
  // означает «ещё не знаем» и обязано быть объявлено; второе означает
  // «этого в проекте нет» и является посчитанным нулём.
  if (qty === null) return { kind: 'notDetermined', quantityKey }
  if (qty.lte(0)) return { kind: 'noCost', reason: 'zeroQuantity' }
  const unit = SCOPE_QUANTITY_UNIT[quantityKey]
  // Task 04 (F-11 companion, rule 36): a count (Gebäude, Stellplätze, …)
  // prints as a whole number — see `SCOPE_QUANTITY_IS_COUNT` docblock.
  const qtyDecimals = SCOPE_QUANTITY_IS_COUNT.has(quantityKey) ? 0 : 2
  return {
    kind: 'priced',
    driver: {
      key: `scope_${option.id}_${variant.value}`,
      origin: 'decision',
      block: 'separatePosition',
      exact: qty.mul(rate),
      label: `${option.labelDe} · ${variant.labelDe} · `
        + `${formatDE(qty, qtyDecimals)}${NNBSP}${unit} × ${euroPerUnit(rate, unit)}${evidenceMark}`,
      scopeRefs: [scopeRef],
      basis: null,
    },
  }
}

/**
 * Вклад одного выбранного варианта — тонкая обёртка над
 * `scopeCatalogOutcome`. Существует, чтобы у суммирующих поверхностей
 * остался один и тот же ответ, что и прежде: непосчитанная позиция вклада
 * не создаёт. Классификацию читает тот, кто обязан её объявить.
 */
export function scopeCatalogDriver(
  option: ScopeOption,
  variant: ScopeVariant,
  quantityOf: (key: ScopeQuantityKey) => Decimal | null,
  kg300Plus400: Decimal,
): Driver | null {
  const outcome = scopeCatalogOutcome(option, variant, quantityOf, kg300Plus400)
  return outcome.kind === 'priced' ? outcome.driver : null
}

/** Выбранный вариант опции — `null`, если выбор не существует в каталоге. */
export function selectedScopeVariant(
  option: ScopeOption,
  selections: Record<string, string>,
): ScopeVariant | null {
  const value = selections[option.id] ?? option.default
  return option.variants.find((v) => v.value === value) ?? null
}

/** Вклады всех выбранных вариантов набора опций одной KG. */
export function scopeCatalogDrivers(
  options: readonly ScopeOption[],
  selections: Record<string, string>,
  quantityOf: (key: ScopeQuantityKey) => Decimal | null,
  kg300Plus400: Decimal,
): Driver[] {
  const out: Driver[] = []
  for (const option of options) {
    const variant = selectedScopeVariant(option, selections)
    if (!variant) continue
    const driver = scopeCatalogDriver(option, variant, quantityOf, kg300Plus400)
    if (driver) out.push(driver)
  }
  return out
}

/**
 * Включённая позиция, чья цена НЕ определена.
 *
 * Одна функция — один критерий для всех поверхностей: правой панели,
 * причины неполноты, экрана включения групп и клиентской выдачи. Прежде
 * критерий существовал только внутри `unpricedScopeCatalogGroups`
 * (`state/store.ts`), был групповым и срабатывал лишь при НУЛЕВОЙ сумме
 * группы: KG 200 по умолчанию считает две позиции из выведенных величин
 * (`kg200-03` × Gebäude и `kg200-06` пауш.), поэтому сумма группы не ноль,
 * и две остальные включённые позиции с непустой ставкой — вывоз грунта
 * (12 €/t) и приватная инфраструктура (30 €/m²) — выпадали ТИХО, а сводка
 * при этом называла итог полным.
 */
export type UnpricedScopePosition = {
  optionId: string
  kg: ScopeOption['kg']
  labelDe: string
  labelEn: string
  variantValue: string
  variantLabelDe: string
  variantLabelEn: string
  /** Чего не хватает; `null` — не хватает самой базы KG 300+400. */
  quantityKey: ScopeQuantityKey | null
}

export function unpricedScopeCatalogPositions(
  options: readonly ScopeOption[],
  selections: Record<string, string>,
  quantityOf: (key: ScopeQuantityKey) => Decimal | null,
  kg300Plus400: Decimal,
): UnpricedScopePosition[] {
  const out: UnpricedScopePosition[] = []
  for (const option of options) {
    const variant = selectedScopeVariant(option, selections)
    if (!variant) continue
    const outcome = scopeCatalogOutcome(option, variant, quantityOf, kg300Plus400)
    if (outcome.kind !== 'notDetermined') continue
    out.push({
      optionId: option.id,
      kg: option.kg,
      labelDe: option.labelDe,
      labelEn: option.labelEn,
      variantValue: variant.value,
      variantLabelDe: variant.labelDe,
      variantLabelEn: variant.labelEn,
      quantityKey: outcome.quantityKey,
    })
  }
  return out
}

/** Умолчания выбора — набор `default` каждой опции (§6 приложения). */
export function defaultScopeCatalogSelections(
  options: readonly ScopeOption[],
): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.id, o.default]))
}

/**
 * Каталоги KG 200/500/600/800 — тот же принцип владения, что
 * `KG300_GROUPS`/`KG400_GROUPS` в `engine/options.ts`: движок владеет
 * фикстурой своего домена, продукт и экран только читают экспорт.
 */
export const KG200_CATALOG_OPTIONS = scopeCatalogFx.kg200 as unknown as ScopeOption[]
export const KG500_CATALOG_OPTIONS = scopeCatalogFx.kg500 as unknown as ScopeOption[]
export const KG600_CATALOG_OPTIONS = scopeCatalogFx.kg600 as unknown as ScopeOption[]
export const KG800_CATALOG_OPTIONS = scopeCatalogFx.kg800 as unknown as ScopeOption[]
export const ALL_SCOPE_CATALOG_OPTIONS: ScopeOption[] = [
  ...KG200_CATALOG_OPTIONS, ...KG500_CATALOG_OPTIONS,
  ...KG600_CATALOG_OPTIONS, ...KG800_CATALOG_OPTIONS,
]
