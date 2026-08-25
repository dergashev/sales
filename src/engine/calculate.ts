import { Decimal } from 'decimal.js'
import { present, rate, type AreaType, type Displayed, type Rate } from './money'

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

/**
 * Leistungsabgrenzung groups considered by the binary-scope contract.
 *
 * Ticket "Rebuild Project Card Workflow" supersedes the 22.08.2026 "MAKE
 * ALL KG 200–800 SELECTABLE" decision for two groups:
 * - KG 800 (Finanzierung) is no longer a supported Scope Boundaries
 *   decision at all; it is never offered and its coverage is forced to
 *   `excluded` (dormant — the same "no active cost" mechanism the binary
 *   contract already gives every excluded group), so it is intentionally
 *   absent from this list.
 * - KG 300/400/700 remain in this list even though they are no longer a
 *   real user decision (`migrateCoverage`/`setCoverage` force them to
 *   `included`): keeping them here is what makes `isScopeUniverseEmpty`
 *   correctly stay `false` once a mandatory core group is guaranteed
 *   included, with no change to this function's own logic.
 * KG 100 (Grundstück) stays out of this task's scope and remains absent.
 */
export const SCOPE_BOUNDARIES_DECIDABLE_GROUPS = [
  'KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700',
] as const satisfies readonly CostGroup[]

/**
 * Task 03 (deep-coherence audit, F-10): true when no decidable cost group is
 * included — a genuinely empty Declared Pricing Scope. `completeness` alone
 * cannot express this: the 22.08.2026 binary-scope contract makes an
 * all-excluded scope a fully DECIDED (`complete`) one, with a real total of
 * exactly zero. Rule 16 forbids presenting a zero total as an ordinary
 * result regardless of how the completeness label reads, so callers use
 * this to switch to an empty-state presentation instead of the numeric
 * hero — never to reclassify `completeness` itself, which stays exactly as
 * the binary-scope contract defines it.
 */
export function isScopeUniverseEmpty(coverage: Coverage): boolean {
  return !SCOPE_BOUNDARIES_DECIDABLE_GROUPS.some((group) => coverage[group] === 'included')
}

export type BuildingInput = {
  id: string
  /** Ось Gebäudeform — уровень Building (D-11 v2). */
  gebaeudeform: 'MFH' | 'EFH_ZFH' | 'DH_REH' | 'BUERO'
  /** Класс здания. `state` важнее значения: спорное блокирует выдачу. */
  gebaeudeklasse: { value: 'GK_1_3' | 'GK_4' | 'GK_5'; confirmed: boolean }
  /**
   * `EH_40_NH` (Effizienzhaus 40 mit Nachhaltigkeitsklasse / QNG) отсутствовал
   * здесь при уже одобренном множителе 1,09 (`calculation-spec.md` §1:
   * «Energiestandard ⚙ | GEG 1,00 · EH 55 1,03 · EH 40 1,06 ·
   * EH 40-NH (QNG) 1,09»). Без этого варианта четвёртый уровень C4.06 не мог
   * быть посчитан — дефект реализации, а не продуктовое решение.
   */
  energiestandard: 'GEG' | 'EH_55' | 'EH_40' | 'EH_40_NH'
  /**
   * Надземная BGF типа **R** — «überdeckt und allseitig umschlossen».
   *
   * Прежде поле называлось `bgfAboveGround` и означало сразу две вещи: экран
   * подписывал его «BGF (R, oberirdisch)», а движок множил на полную ставку
   * всю надземную площадь. Пока `S = 0`, разница невидима; сценарий 2
   * приносит S ≠ 0, и тогда одно поле не может быть обоими (решение D-26,
   * сплошное ревью 26, находка 17).
   */
  bgfRAbove: Decimal
  /** Надземная BGF типа **S**: считается по доле `f_S` от ставки R. */
  bgfSAbove: Decimal
  bgfBelowGround: Decimal
  untergeschoss: 'kein_ug' | 'ab_decke' | 'vollausbau'
  hasParking: boolean
}

export type Catalog = {
  kBase: Decimal
  /** Доля ставки R для площадей S (`calculation-spec` §1, решение D-26). */
  fS: Decimal
  costFactors: {
    gebaeudeklasse: Record<string, Decimal>
    energiestandard: Record<string, Decimal>
    gebaeudeform: Record<string, Decimal>
    untergeschoss: {
      /** Конструктив + Gründung + Ausbau. */
      vollausbau: Decimal
      /** Только Ausbau: Rohbau подвала не в объёме. */
      abDecke: Decimal
      /** Надбавка за паркинг — складывается с базовой ставкой режима. */
      tiefgarageZuschlag: Decimal
      /** Вычисляемая сумма первой и третьей — на неё ссылается фикстура. */
      vollausbauMitTiefgarage: Decimal
    }
  }
  /**
   * Доли групп затрат. Объявлены `calculation-spec.md` §1/§2 и приходят из
   * каталога, а не из строк в коде: KG 500 считалась производной ставкой
   * 115 €/m² при существующей формуле, KG 700 — 8,7 % при объявленных 12 %
   * (решение D-27).
   */
  kgShares: {
    kg500PercentOfBauwerk: Decimal
    kg700EchtPercentOfBauwerk: Decimal
    vereinfacht: { KG_300: Decimal; KG_400: Decimal; KG_700: Decimal }
    echt: { KG_300: Decimal; KG_400: Decimal }
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
 * суммы основания нет вовсе. Знаменатель ставки — ТИПИЗИРОВАННЫЙ `AreaType`,
 * тот же, что у `Rate`: подпись обязана называть норматив, и брать её из
 * одного места — ровно то, чем закрыт DATA-001 у ставок.
 */
export type DriverBasis =
  | { kind: 'factor'; appliedTo: Decimal; factor: Decimal }
  | { kind: 'rate'; quantity: Decimal; denominator: AreaType; rate: Decimal }

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
   * `decision` — то, что продавец выбрал и может отменить;
   * `scope` — ценовая корректировка из ещё не принятого решения о покрытии.
   *   Она сохраняет честный промежуточный расчёт, но не попадает в список
   *   выбранного и не выдаёт пробел данных за коммерческое решение.
   */
  origin: 'base' | 'fact' | 'decision' | 'scope'
  /**
   * Место вклада в структуре сметы. Поле, а не вывод из `scopeRefs`: у
   * надбавки за риск база названа как `KG 320`, и по позиции она неотличима
   * от вклада внутри блока — а входить в блок она не имеет права, иначе
   * увеличивает собственную базу.
   *
   * `bauwerk` — блок KG 300 + 400 + UG, к которому применяются доли и от
   *   которого считаются проценты;
   * `separatePosition` — группа затрат вне блока (KG 100/200/500/600/800 и
   *   KG 700 в режиме echt): она добавляется к итогу, но базой не является;
   * `surcharge` — аддитивная надбавка после блока (`calculation-spec` §2);
   * `discount` — скидка «после всего», от точного итога (CALC-007).
   *
   * Прежде всё складывалось в один `bauwerkSum`, и включение KG 500
   * увеличивало базу KG 700, сплита 70/22/8 и надбавок за риск (сплошное
   * ревью 26, находки 9 и 20).
   */
  block: 'bauwerk' | 'separatePosition' | 'surcharge' | 'discount'
}

/** Сумма вкладов одного места сметы. Один обход, одно определение. */
export function sumOfBlock(
  drivers: Driver[], block: Driver['block'],
): Decimal {
  return drivers
    .filter((d) => d.block === block)
    .reduce((a, d) => a.plus(d.exact), new Decimal(0))
}

/**
 * Вся надземная BGF здания. Одно определение на продукт: «oberirdisch» —
 * это R + S, и складывать их каждый раз заново значило бы заводить столько
 * определений, сколько мест.
 */
export function bgfAboveGround(b: BuildingInput): Decimal {
  return b.bgfRAbove.plus(b.bgfSAbove)
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
  const unknown = SCOPE_BOUNDARIES_DECIDABLE_GROUPS
    .filter((group) => coverage[group] === 'unknown')
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

  const base = b.bgfRAbove.mul(cat.kBase)
  drivers.push({
    key: 'basis', exact: base, label: 'Grundleistung',
    origin: 'base' as const, block: 'bauwerk' as const,
    scopeRefs: SCOPE_BAUWERK_BASE,
    basis: {
      kind: 'rate', quantity: b.bgfRAbove,
      denominator: 'BGF_R', rate: cat.kBase,
    },
  })

  // Площади S — отдельным вкладом по доле `f_S` (спецификация §2):
  //   BGF_R × K × … + BGF_S × K × … × f_S
  // Вклад отдельный, а не слитый с базой, потому что доля — решение
  // норматива о том, что S дешевле R, и она обязана быть видимой.
  let baseS = new Decimal(0)
  if (b.bgfSAbove.gt(0)) {
    const rateS = cat.kBase.mul(cat.fS)
    baseS = b.bgfSAbove.mul(rateS)
    drivers.push({
      key: 'basis_s', exact: baseS,
      label: 'Grundleistung · überdeckte Sonderflächen',
      origin: 'base' as const, block: 'bauwerk' as const,
      scopeRefs: SCOPE_BAUWERK_BASE,
      basis: {
        kind: 'rate', quantity: b.bgfSAbove, denominator: 'BGF_S', rate: rateS,
      },
    })
  }

  // Форма: множитель только если он есть в каталоге. MFH — базовая.
  const formKey = FORM_FACTOR_KEY[b.gebaeudeform]
  let running = base.plus(baseS)
  if (formKey) {
    const f = cat.costFactors.gebaeudeform[formKey]
    if (!f) throw new Error(`нет множителя формы для ${formKey}`)
    const uplift = running.mul(f.minus(1))
    running = running.plus(uplift)
    drivers.push({
      key: `gebaeudeform_${formKey}`, exact: uplift, label: 'Gebäudeform',
      origin: 'fact' as const, block: 'bauwerk' as const,
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
      origin: 'fact' as const, block: 'bauwerk' as const,
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
      origin: 'decision' as const, block: 'bauwerk' as const,
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

  // Подземный этаж: РЕЖИМ ОТДЕЛКИ и ПАРКИНГ — две независимые величины.
  //
  // Прежняя редакция знала один случай, «vollausbau с паркингом», и брала
  // единственную слитую ставку 1.190. Следствий было два, и оба находились
  // на живых контролах: `ab_decke` проваливался в нулевой default — подвал
  // есть, стоит 0 € (запрещённый ноль, правило 16), — а `vollausbau` без
  // паркинга считался на 90 €/m² дороже, потому что `hasParking` объявлен
  // во входе и не читался ни разу (сплошное ревью 26, находки 6 и 7).
  //
  // Надбавка выделена ОТДЕЛЬНЫМ вкладом, а не спрятана в ставку: иначе
  // Kostentreiber не может назвать её причиной, а продавец — снять.
  const UG_RATE_KEY = {
    kein_ug: null,
    ab_decke: 'abDecke',
    vollausbau: 'vollausbau',
  } as const
  let ug = new Decimal(0)
  const ugKey = UG_RATE_KEY[b.untergeschoss]
  if (ugKey && b.bgfBelowGround.gt(0)) {
    const baseRate = cat.costFactors.untergeschoss[ugKey]
    ug = b.bgfBelowGround.mul(baseRate)
    drivers.push({
      key: `untergeschoss_${b.untergeschoss}`,
      origin: 'decision' as const, block: 'bauwerk' as const,
      exact: ug,
      label: b.untergeschoss === 'vollausbau'
        ? 'Untergeschoss · Rohbau und Ausbau'
        : 'Untergeschoss · nur Ausbau',
      // Вклад подвала — ставка × площадь, и поповер теперь это и
      // показывает: прежде он молчал о том, из чего сумма получена.
      basis: {
        kind: 'rate', quantity: b.bgfBelowGround,
        denominator: 'BGF_BELOW_GROUND', rate: baseRate,
      },
      scopeRefs: SCOPE_UG,
    })
    if (b.hasParking) {
      const tgRate = cat.costFactors.untergeschoss.tiefgarageZuschlag
      const tgAmount = b.bgfBelowGround.mul(tgRate)
      ug = ug.plus(tgAmount)
      drivers.push({
        key: 'tiefgarage_zuschlag',
        origin: 'decision' as const, block: 'bauwerk' as const,
        exact: tgAmount,
        label: 'Tiefgarage · Lüftung, OS-Beschichtung, Tore',
        basis: {
          kind: 'rate', quantity: b.bgfBelowGround,
          denominator: 'BGF_BELOW_GROUND', rate: tgRate,
        },
        scopeRefs: SCOPE_UG,
      })
    }
  }

  const bauwerk = running.plus(ug)

  // Регион-фактор — к блоку Bauwerk, не к итогу. Выключен по умолчанию (D-15).
  let regional = new Decimal(0)
  if (cat.regionalFactor.active) {
    regional = bauwerk.mul(cat.regionalFactor.value.minus(1))
    drivers.push({
      key: 'regionalfaktor', exact: regional, label: 'Regionalfaktor',
      origin: 'decision' as const, block: 'bauwerk' as const,
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
export type KgSplit = {
  KG_300: Decimal
  KG_400: Decimal
  /** В режиме `echt` KG 700 — отдельная позиция, а не доля блока. */
  KG_700?: Decimal
}

/**
 * Разбивка блока Bauwerk по группам затрат.
 *
 * Долей ДВЕ, и выбор между ними — не оформление, а следствие режима KG 700
 * (`calculation-spec.md` §1/§2):
 *
 * · `vereinfacht` — KG 700 внутри блока, доли 70/22/8, итог не меняется;
 * · `echt` — KG 700 стоит СВОЕЙ позицией 12 % от блока, поэтому внутри
 *   блока остаются только KG 300 и KG 400, и их доли другие: 76,2 / 23,8
 *   (факт Referenzprojekt R-02).
 *
 * Прежде существовала одна редакция, 70/22/8, и режим `echt` применял её к
 * блоку, уже содержавшему собственную KG 700, — то есть проводил ту же
 * позицию дважды (сплошное ревью 26, находка 9).
 */
export function kgSplit(
  bauwerkExact: Decimal,
  shares: Catalog['kgShares'],
  mode: 'vereinfacht' | 'echt',
): KgSplit {
  const pct = (p: Decimal) => bauwerkExact.mul(p).div(100)
  const split: KgSplit = mode === 'vereinfacht'
    ? {
        KG_300: pct(shares.vereinfacht.KG_300),
        KG_400: pct(shares.vereinfacht.KG_400),
        KG_700: pct(shares.vereinfacht.KG_700),
      }
    : {
        KG_300: pct(shares.echt.KG_300),
        KG_400: pct(shares.echt.KG_400),
      }
  const sum = Object.values(split)
    .reduce((a: Decimal, b) => a.plus(b ?? 0), new Decimal(0))
  if (!sum.equals(bauwerkExact)) {
    throw new Error(
      `сплит KG (${mode}) не сходится с блоком: ${sum.toString()} ≠ `
        + `${bauwerkExact.toString()}`,
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

/**
 * KG 800 — Finanzierung (тикет "MAKE ALL KG 200–800 SELECTABLE…", §5 KG800 /
 * §8.2 приложенного исследования).
 *
 * Формулы дословно из приложения:
 *
 *   PRE_FINANCING_COST = KG100..KG700 (без самой KG 800 — не рекурсивно)
 *   DEBT_PRINCIPAL      = PRE_FINANCING_COST × DEBT_RATIO
 *   EQUITY_PRINCIPAL    = PRE_FINANCING_COST − DEBT_PRINCIPAL
 *   AVG_DRAWN_DEBT      = DEBT_PRINCIPAL × DRAWDOWN_FACTOR
 *   AVG_INVESTED_EQUITY = EQUITY_PRINCIPAL × DRAWDOWN_FACTOR
 *   YEARS               = FINANCING_MONTHS / 12
 *   KG820 (Fremdkapitalzinsen)   = AVG_DRAWN_DEBT × DEBT_RATE × YEARS
 *   KG830 (Eigenkapitalzinsen)   = AVG_INVESTED_EQUITY × EQUITY_RATE × YEARS
 *   KG810a (Finanzierungsnebenkosten) = DEBT_PRINCIPAL × FEE_RATE
 *   KG810b (Bereitstellungszinsen)    = «примерный неиспользованный остаток
 *     долга × месячная ставка × число оплачиваемых месяцев», НИКОГДА не
 *     от уже выбранного долга (явное указание приложения); остаток
 *     приближён как DEBT_PRINCIPAL − AVG_DRAWN_DEBT, оплачиваемые месяцы —
 *     `max(0, FINANCING_MONTHS − FREE_MONTHS)`.
 *   KG840 (Bürgschaftskosten)   = GUARANTEE_AMOUNT × GUARANTEE_RATE × GUARANTEE_YEARS
 *     (guaranteeYears по умолчанию равна YEARS — приложение не называет
 *     отдельный срок поручительства, домысливать новый параметр нельзя, D-22
 *     разрешает вывести значение и обязывает нести пометку ⚙).
 *
 * KG 800 никогда не финансирует сама себя: `preFinancingCost` передаётся
 * ВЫЗЫВАЮЩИМ кодом и обязан быть суммой блоков KG100–700, посчитанной ДО
 * вызова этой функции — здесь не существует пути прочитать собственный же
 * результат обратно во вход (нерекурсивность обеспечена структурой, а не
 * проверкой постфактум).
 */
export type Kg800Params = {
  /** KG800-01, доля заёмного капитала, 0..1 (0%..90%). */
  debtRatio: Decimal
  /** KG800-02, ставка по кредиту, доля годовых (например 0.045 = 4,5 %). */
  debtRate: Decimal
  /** KG800-03, срок финансирования в месяцах. */
  financingMonths: Decimal
  /** KG800-04, доля среднего использования капитала за срок (Mittelabrufprofil). */
  drawdownFactor: Decimal
  /** KG800-05, комиссия за организацию финансирования, доля от DEBT_PRINCIPAL. */
  financingFeeRate: Decimal
  /** KG800-06, свободный от платы период, месяцы. */
  commitmentFreeMonths: Decimal
  /** KG800-06, ставка платы за резервирование, доля В МЕСЯЦ. */
  commitmentMonthlyRate: Decimal
  /** KG800-07, обеспечиваемая сумма (внешний ввод — контракт/договор). */
  guaranteeAmount: Decimal
  /** KG800-07, ставка поручительства, доля годовых. */
  guaranteeRate: Decimal
  /** KG800-08, ставка калькуляционных процентов на собственный капитал, доля годовых. */
  equityRate: Decimal
}

export type Kg800Result = {
  preFinancingCost: Decimal
  debtPrincipal: Decimal
  equityPrincipal: Decimal
  avgDrawnDebt: Decimal
  avgInvestedEquity: Decimal
  years: Decimal
  debtInterest: Decimal
  equityInterest: Decimal
  financingFee: Decimal
  commitmentInterest: Decimal
  guaranteeCost: Decimal
  total: Decimal
}

export function calculateKg800(
  preFinancingCost: Decimal,
  p: Kg800Params,
): Kg800Result {
  const debtPrincipal = preFinancingCost.mul(p.debtRatio)
  const equityPrincipal = preFinancingCost.minus(debtPrincipal)
  const avgDrawnDebt = debtPrincipal.mul(p.drawdownFactor)
  const avgInvestedEquity = equityPrincipal.mul(p.drawdownFactor)
  const years = p.financingMonths.div(12)

  const debtInterest = avgDrawnDebt.mul(p.debtRate).mul(years)
  const equityInterest = avgInvestedEquity.mul(p.equityRate).mul(years)
  const financingFee = debtPrincipal.mul(p.financingFeeRate)

  const undrawnBalance = Decimal.max(debtPrincipal.minus(avgDrawnDebt), 0)
  const chargeableMonths = Decimal.max(
    p.financingMonths.minus(p.commitmentFreeMonths), 0,
  )
  const commitmentInterest = undrawnBalance
    .mul(p.commitmentMonthlyRate)
    .mul(chargeableMonths)

  // Срок поручительства не назван приложением отдельным параметром — берём
  // срок финансирования (D-22: вывод разрешён, пометка ⚙ обязательна на
  // экране, не здесь).
  const guaranteeCost = p.guaranteeAmount.mul(p.guaranteeRate).mul(years)

  const total = debtInterest.plus(equityInterest).plus(financingFee)
    .plus(commitmentInterest).plus(guaranteeCost)

  return {
    preFinancingCost, debtPrincipal, equityPrincipal, avgDrawnDebt,
    avgInvestedEquity, years, debtInterest, equityInterest, financingFee,
    commitmentInterest, guaranteeCost, total,
  }
}
