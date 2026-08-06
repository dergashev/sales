import { createStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import { withRegionalFactor } from './catalog'
import {
  calculateBuilding, kgSplitVereinfacht,
  type BuildingInput, type Coverage, type CoverageState,
  type CostGroup, type BuildingResult,
} from '../engine/calculate'
import { present, rate, NNBSP, type Displayed, type Rate } from '../engine/money'
import { defaultOptionChoices, optionDrivers, coverageDrivers, ALL_OPTION_GROUPS } from '../engine/options'
import derivedFx from '../fixtures/derived-prototype.json'
import { modelDuration, presentDuration, type DurationDisplay } from '../engine/schedule'

/**
 * Состояние = журнал событий + проекция (M-4).
 *
 * Данные не могут измениться без события — и это обеспечено КОНСТРУКЦИЕЙ,
 * а не соглашением. Первая редакция экспортировала zustand-hook целиком,
 * и его публичный `setState` менял расчётное состояние при пустом журнале;
 * независимый аудит показал это одним вызовом. Теперь сырой store живёт в
 * замыкании модуля: наружу выходят только хук чтения, `getState` и
 * санкционированные действия. Тестовый сброс — именованная функция, а не
 * общий сеттер.
 *
 * Undo — обратное СОБЫТИЕ с курсором. Прежняя реализация всегда брала
 * последнее не-undo событие, поэтому повторная отмена дважды применяла один
 * inverse. Курсор — список уже отменённых seq: каждое событие отменяется
 * не более одного раза, история не теряется.
 */

const D = (s: string) => new Decimal(s)

/**
 * Доля KG 700 при расчёте по HOAI и AHO. Выведена (D-22): в упрощённом
 * режиме KG 700 составляет 8 % от итога, то есть ≈ 8,7 % от блока
 * KG 300+400 — эта величина взята ориентиром, а не измерена.
 */
const KG700_HOAI_SHARE = D('0.087')

export type EventKind =
  | 'value.edited' | 'value.confirmed'
  | 'option.selected' | 'coverage.changed'
  | 'document.activated' | 'conflict.resolved'
  | 'offer.emailed' | 'offer.printed'
  | 'undo'

export type JournalEvent = {
  seq: number
  kind: EventKind
  /** Человекочитаемая подпись — она же строка журнала сессии. */
  label: string
  /** Точная денежная дельта события. Null, если событие не меняет цену. */
  deltaExact: Decimal | null
  at: string
  /** Какое событие отменено (только у kind='undo'). */
  undoOf?: number
  /** Обратное применение. Обязано восстанавливать ВСЁ, что событие меняло. */
  inverse?: () => void
  /**
   * Прямое применение — то же изменение ещё раз. Нужно ровно для одного:
   * «отмена отмены — тоже событие» (DC-29). Событие отмены получает
   * inverse = forward отменённого, и потому само отменяемо.
   */
  forward?: () => void
}

export type Provenance =
  | 'aus Dokument' | 'vom Kunden bestätigt' | 'abgeleitet' | 'manuell erfasst'

export type FieldState = { value: Decimal; provenance: Provenance }

/**
 * Конфликт значения одного слота — по фикстуре DEMO-CONF-0001.
 * Непринятый кандидат остаётся альтернативой, не исчезает (SOURCE-001).
 */
export type ConflictCandidate = {
  origin: 'document' | 'customer'
  value: string
  selectionStatus: 'authoritative' | 'alternative'
  source: string
}

export type WflConflict = {
  id: string
  state: 'open' | 'resolved'
  candidates: ConflictCandidate[]
}

/**
 * Снапшот отправленного оффера (M-3, минимум прототипа): состояние,
 * от которого клиент получил числа, воспроизводимо из самого снапшота,
 * а не из памяти. Флаг Regionalfaktor входит сюда по D-15.
 */
export type OfferSnapshot = {
  id: string
  at: string
  kind: 'email' | 'print'
  totalExact: string
  totalLabel: string
  uncertaintyPp: number
  regionalfaktorActive: boolean
  coverage: Coverage
  discountPercent: string | null
  journalSeqAt: number
}

/** Покрытие фикстуры: KG 500 неизвестно — именно поэтому итог промежуточный. */
const INITIAL_COVERAGE: Coverage = {
  KG_100: 'notApplicable', KG_200: 'excluded',
  KG_300: 'included', KG_400: 'included', KG_500: 'unknown',
  KG_600: 'notApplicable', KG_700: 'included', KG_800: 'notApplicable',
}

const fx = demo.buildings[0]!
const fxConflict = demo.conflicts[0]!

const INITIAL_BUILDING: BuildingInput = {
  id: fx.id, gebaeudeform: 'MFH',
  gebaeudeklasse: { value: 'GK_5', confirmed: false },
  energiestandard: 'EH_55',
  bgfAboveGround: D(fx.areas.bgfAboveGround!),
  bgfBelowGround: D(fx.areas.bgfBelowGround!),
  untergeschoss: 'vollausbau', hasParking: true,
}

/**
 * Второе здание проекта — Bürogebäude. Оси классификации принадлежат
 * зданию и сегменту (D-11 v2), поэтому у каждого здания они свои: форма
 * читается со здания, назначение — с сегмента, и единого «типа проекта»
 * не существует.
 */
const fxB = demo.buildings[1]!
const INITIAL_BUILDING_B: BuildingInput = {
  id: fxB.id, gebaeudeform: 'BUERO',
  gebaeudeklasse: { value: 'GK_4', confirmed: false },
  energiestandard: 'EH_55',
  bgfAboveGround: D(fxB.areas.bgfAboveGround!),
  bgfBelowGround: D(fxB.areas.bgfBelowGround!),
  untergeschoss: 'kein_ug', hasParking: false,
}

export type Projection = {
  result: BuildingResult
  kgSplit: ReturnType<typeof kgSplitVereinfacht>
  /** Ведущая ставка сегмента (D-11 v2): у Haus A единственный сегмент Wohnen. */
  leadRate: Rate
  secondaryRateBgf: Rate
  perUnit: Rate
  duration: DurationDisplay
  aboveGround: ReturnType<typeof present>
  belowGround: ReturnType<typeof present>
  /** Интервал точности. Сужается ПОДТВЕРЖДЕНИЕМ, не выбором опции (D-19). */
  uncertaintyPp: number
}

type Store = {
  /**
   * Все здания проекта. Раньше здесь жило одно — и это была не упрощённая
   * модель, а неверная: у комплекса нет «того самого» здания, а оси
   * классификации принадлежат каждому в отдельности (D-11 v2).
   */
  buildings: Record<string, BuildingInput>
  /** Какое здание правит конфигуратор. Не то же, что включённость. */
  activeBuildingId: string
  /**
   * Какие здания входят в предложение. Пользователь решает это ПЕРВЫМ,
   * до всех опций: невключённое здание не должно влиять ни на цену, ни
   * на метрики, ни на срок.
   */
  included: Record<string, boolean>
  /** Метрики и оси здания подтверждены — шаг вниз открыт. */
  buildingConfirmed: Record<string, boolean>
  /**
   * Выбор опций KG 300 по каждому зданию. Опции принадлежат зданию, а не
   * предложению: у офиса нет балконов, и общий выбор был бы неверным для
   * обоих.
   */
  kg300: Record<string, Record<string, string>>
  /**
   * Откуда взялся выбор: `Standard` — умолчание каталога, `aus Dokument` —
   * найдено в клиентской документации (тогда рядом стоит ссылка на файл),
   * `manuell erfasst` — переключено вручную. Провенанс обязателен: выбор
   * без источника неотличим от догадки.
   */
  kg300Provenance: Record<string, Record<string, string>>
  /**
   * Режим KG 700 (D-07, пункт 12 сценария). Настройка ВНУТРЕННЯЯ: клиент
   * видит только то, что KG 700 включена, и её долю в смете. Как именно
   * она посчитана — предмет подготовки предложения, а не переговоров.
   *
   * `vereinfacht` — итог KG 300+400 распределяется 70/22/8, тотал НЕ
   *   меняется (calculation-spec §83): это перераспределение, а не
   *   добавление, и именно оно воспроизводит текущую практику.
   * `hoaiAho` — KG 700 считается собственной ставкой по HOAI и AHO и
   *   ДОБАВЛЯЕТСЯ к итогу.
   */
  kg700Mode: 'vereinfacht' | 'hoaiAho'
  coverage: Coverage
  fields: { wfl: FieldState; bgfOber: FieldState; we: FieldState }
  journal: JournalEvent[]
  /** seq событий, уже отменённых: каждое отменяется не более одного раза. */
  undone: number[]
  esConfirmed: boolean
  wflConflict: WflConflict
  activeGrundrisse: 'V2' | 'V1'
  /** Regionalfaktor: выключен по умолчанию (D-15); состояние входит в снапшот. */
  regionalfaktorActive: boolean
  snapshots: OfferSnapshot[]
  /** Дельта-чип живёт 4 секунды, потом уезжает в журнал (DC-2). */
  activeDelta: { label: string; deltaExact: Decimal; percent: Decimal } | null
  /**
   * Geist-Vorschau (DC-28): последствие опции у цены ДО клика. Эфемерное
   * UI-состояние вроде `openChapter` — данные не меняются, события нет.
   * Клик фиксирует выбор обычным событием, превью гаснет.
   */
  preview: {
    label: string
    /** Будущее значение героя, а не только разница (анатомия DC-28). */
    futureTotal: Displayed
    deltaExact: Decimal
    /** Прогон превью: без него два интервала на разных экранах неотличимы
     *  от противоречия (CALC-002). */
    contextRef: string
    /** Полнота будущего прогона: при incomplete префикс называет её. */
    futureLabel: string
  } | null
  /**
   * Undo-тост (DC-29): производная ПОСЛЕДНЕГО события журнала, не отдельное
   * состояние. Каждое событие с inverse создаёт тост; событие без inverse
   * (отправка) гасит его — более новая голова делает старый тост stale
   * (CHANGE-006), а откат остаётся доступен из журнала DC-12.
   */
  undoToast: { seq: number; statusText: string; deltaText: string | null } | null
  /**
   * Режим показа (правило 11). Предпочтение UI, не данные варианта — как
   * openChapter, без события. Вход в `praesentation` гейтуется открытым
   * существенным блокером (R-07/DC-7): профиль с material-проблемой не
   * формируется, поэтому переключение — no-op, пока класс не подтверждён.
   * Плотность режимом НЕ управляется (D-16).
   */
  mode: 'intern' | 'praesentation'
  /**
   * Уровень, на котором находится пользователь. Три уровня, и они НЕ
   * являются экранами: экран — это то, что показано внутри уровня.
   *
   * `liste` — корень продукта: Opportunities, фильтры, поиск.
   * `opportunity` — карточка: анализ документов, конфликты, параметры
   *   проекта, гейт создания Options.
   * `option` — рабочий конвейер с двумя панелями; именно Options
   *   сравниваются между собой.
   *
   * Переход с `opportunity` на `option` гейтуется: пока конфликты не
   * разрешены, а параметры не подтверждены, создавать Option нельзя.
   * Это блокировка ПОДГОТОВКИ, а не блокировка при клиенте — правило 12
   * запрещает второе, а первое требует.
   */
  level: 'liste' | 'opportunity' | 'option'
  /** Выбранная Opportunity; null на корневом уровне. */
  opportunityId: string | null
  /** Подтверждены ли верхнеуровневые параметры проекта (часть гейта). */
  projectParamsConfirmed: boolean
  /** Созданные Opportunity Options. Сравниваются между собой (S4). */
  options: Array<{ id: string; name: string }>
  activeOptionId: string | null
  /** Язык UI (правило 36). Отдельная настройка от языка артефактов (D-13). */
  uiLanguage: 'de' | 'en'
  /**
   * Плотность (D-16) — независимое предпочтение пользователя: режимом НЕ
   * управляется (LAYOUT-007). Рекомендация «Komfortabel перед шарингом» —
   * пункт чек-листа G6-gate, не переопределение.
   */
  density: 'komfortabel' | 'kompakt'
  openChapter: number

  projection: () => Projection
  editField: (key: 'wfl' | 'bgfOber' | 'we', value: Decimal, confirmed: boolean) => void
  setEnergiestandard: (v: BuildingInput['energiestandard']) => void
  setUntergeschoss: (v: BuildingInput['untergeschoss']) => void
  setCoverage: (g: CostGroup, s: CoverageState) => void
  confirmGebaeudeklasse: () => void
  confirmEnergiestandardAnswer: () => void
  resolveWflConflict: (candidate: 'document' | 'customer') => void
  activateGrundrisse: (v: 'V2' | 'V1') => void
  toggleRegionalfaktor: () => void
  sendOffer: (kind: 'email' | 'print', discountPercent: string | null) => OfferSnapshot
  clearDelta: () => void
  openChapterAt: (n: number) => void
  /** DC-28: показать последствие опции до клика; null — погасить. */
  previewOption: (
    change:
      | { kind: 'energiestandard'; value: BuildingInput['energiestandard'] }
      | { kind: 'untergeschoss'; value: BuildingInput['untergeschoss'] }
      | null,
  ) => void
  /**
   * Чистая дельта опции против текущего выбора — для ВСЕГДА видимой
   * consequenceLine карточки (R-05/OPTION-009). Состояние не меняет.
   */
  optionDelta: (
    change:
      | { kind: 'energiestandard'; value: BuildingInput['energiestandard'] }
      | { kind: 'untergeschoss'; value: BuildingInput['untergeschoss'] },
  ) => Decimal
  undo: () => void
  /** Есть ли действующее событие, которое отменит `undo()`. */
  canUndo: () => boolean
  /** Адресная отмена события из тоста DC-29. Умеет отменять и отмену. */
  undoEvent: (seq: number) => void
  dismissUndoToast: () => void
  /** Правило 11: вход в презентацию закрыт, пока открыт material-блокер. */
  setMode: (m: 'intern' | 'praesentation') => void
  openOpportunity: (id: string) => void
  backToList: () => void
  confirmProjectParams: () => void
  /** Гейт: можно ли создавать Options (конфликты решены, параметры приняты). */
  canCreateOptions: () => boolean
  createOption: (name: string) => void
  openOption: (id: string) => void
  setActiveBuilding: (id: string) => void
  /** Включить/исключить здание из предложения — событие журнала. */
  toggleBuildingIncluded: (id: string) => void
  confirmBuilding: (id: string) => void
  /** Выбрать опцию KG 300 у активного здания — событие журнала с дельтой. */
  setKg300: (groupId: string, value: string) => void
  setKg700Mode: (m: 'vereinfacht' | 'hoaiAho') => void
  /** Все включённые здания подтверждены — шаг вниз к сервисам открыт. */
  allBuildingsConfirmed: () => boolean
  setUiLanguage: (l: 'de' | 'en') => void
  setDensity: (d: 'komfortabel' | 'kompakt') => void
}

/**
 * Событие, которое отменит следующий `undo()`. Одно определение на всех:
 * кнопка, действие и тест обязаны спрашивать один и тот же курсор, иначе
 * доступность контрола расходится с его поведением.
 */
function undoTarget(s: Pick<Store, 'journal' | 'undone'>): JournalEvent | undefined {
  return [...s.journal]
    .reverse()
    .find((e) => e.kind !== 'undo' && e.inverse && !s.undone.includes(e.seq))
}

/**
 * Активное здание — то, которое правит конфигуратор. Отдельная функция,
 * потому что «какое здание я редактирую» и «какие здания в предложении»
 * это разные вопросы, и путать их нельзя: пользователь может смотреть
 * метрики здания, которое решил не включать.
 */
export function activeBuilding(s: Pick<Store, 'buildings' | 'activeBuildingId'>): BuildingInput {
  const b = s.buildings[s.activeBuildingId]
  if (!b) throw new Error(`нет здания ${s.activeBuildingId}`)
  return b
}

/** Здания, входящие в предложение, в порядке фикстуры. */
function includedBuildings(
  s: Pick<Store, 'buildings' | 'included'>,
): BuildingInput[] {
  return Object.values(s.buildings).filter((b) => s.included[b.id])
}

/** Площадь S здания — выведенная величина (D-22), помечена на экране. */
function bgfSOf(id: string): Decimal {
  const b = (derivedFx.buildings as Record<string, { bgfSAboveGround?: { value: string | null } }>)[id]
  const v = b?.bgfSAboveGround?.value
  return v ? new Decimal(v) : new Decimal(0)
}

function computeProjection(
  s: Pick<Store, 'buildings' | 'activeBuildingId' | 'included' | 'coverage'
    | 'fields' | 'esConfirmed' | 'regionalfaktorActive' | 'kg300' | 'kg700Mode'>,
): Projection {
  const CATALOG = withRegionalFactor(s.regionalfaktorActive)
  const list = includedBuildings(s)
  if (list.length === 0) {
    throw new Error('в предложении нет ни одного здания — проекции не существует')
  }
  // Итог комплекса — СУММА зданий; удельные считаются от сумм, никогда
  // как среднее из средних (правило 39). Драйверы объединяются, сохраняя
  // уникальность ID: вклад одного здания не смешивается с другим.
  const perBuilding = list.map((b) => calculateBuilding(b, CATALOG, s.coverage))
  // Вклады опций KG 300 идут ПОСЛЕ базового блока и до регион-фактора не
  // домножаются: фактор применяется к Bauwerk по объявленному перечню
  // §2.3, а опции в нём не названы. Приписать их туда значило бы
  // расширить базу фактора собственным решением.
  const optDrivers = list.flatMap((b, i) => [
    ...optionDrivers(b, s.kg300[b.id] ?? {}, bgfSOf(b.id)),
    // Группы затрат, включённые решением пользователя: они не входят в
    // базовую ставку, поэтому включение ДОБАВЛЯЕТ, а не перераспределяет.
    ...coverageDrivers(b, s.coverage as unknown as Record<string, string>, bgfSOf(b.id)),
  ].map((d) => ({ ...d, key: list.length > 1 ? `${list[i]!.id}:${d.key}` : d.key })))
  const optSum = optDrivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
  const bauwerkSum = perBuilding
    .reduce((a, r) => a.plus(r.total.exact), new Decimal(0))
    .plus(optSum)
  // KG 700 в режиме HOAI+AHO — СОБСТВЕННАЯ позиция поверх KG 300+400.
  // В режиме `vereinfacht` тотал не меняется: 70/22/8 перераспределяет
  // уже посчитанное, а не добавляет (calculation-spec §83). Ставка
  // выведена (D-22) и помечена.
  const kg700 = s.kg700Mode === 'hoaiAho'
    ? bauwerkSum.mul(KG700_HOAI_SHARE)
    : new Decimal(0)
  if (!kg700.isZero()) {
    optDrivers.push({
      key: 'kg700_hoai_aho',
      exact: kg700,
      label: 'KG 700 · Baunebenkosten nach HOAI und AHO',
      scopeRefs: ['KG 700'],
      appliedTo: bauwerkSum,
      factor: null,
    })
  }
  const total = bauwerkSum.plus(kg700)
  const result: BuildingResult = {
    buildingId: list.map((b) => b.id).join('+'),
    drivers: [
      ...perBuilding.flatMap((r, i) =>
        r.drivers.map((d) => ({ ...d, key: list.length > 1 ? `${list[i]!.id}:${d.key}` : d.key }))),
      ...optDrivers,
    ],
    bauwerk: perBuilding.reduce((a, r) => a.plus(r.bauwerk), new Decimal(0)),
    total: present(total),
    totalLabel: perBuilding[0]!.totalLabel,
    completeness: perBuilding.every((r) => r.completeness === 'complete')
      ? 'complete' : 'incomplete',
    incompleteReasons: perBuilding.flatMap((r) => r.incompleteReasons),
  }
  const noUg = perBuilding.reduce((a, _, i) => a.plus(
    calculateBuilding({ ...list[i]!, untergeschoss: 'kein_ug' }, CATALOG, s.coverage).total.exact,
  ), new Decimal(0))
  const ug = total.minus(noUg)

  const duration = presentDuration(
    {
      metricKey: `building:${list[0]!.id}.execution`,
      kind: 'buildingExecution',
      startDate: '2027-04-04', endDate: '2027-11-19', durationBasis: 'calendarDay',
    },
    modelDuration(
      list.reduce((a, b) => a.plus(b.bgfAboveGround), new Decimal(0)),
      D('1.00'), D('1.15'),
    ),
  )

  // Интервал: базовые 22 пункта минус объявленные фикстурой сужения.
  // Фикстура задаёт Δ ровно для двух подтверждений: WFL −5 Pp и
  // Energiestandard −4 Pp (DEMO-SC-02). Δ остальных параметров фикстурой
  // не объявлены, и выдумывать их нельзя (R-25) — подтверждение bgfOber
  // поэтому интервал не сужает, и это честно, а не забыто. Выбор опции
  // не сужает ничего: он не подтверждение (D-19).
  const narrowing =
    (s.fields.wfl.provenance === 'vom Kunden bestätigt' ? 5 : 0) +
    (s.esConfirmed ? 4 : 0)

  return {
    result,
    kgSplit: kgSplitVereinfacht(total),
    leadRate: rate(total, s.fields.wfl.value, 'WFL_WOFLV'),
    secondaryRateBgf: rate(total, s.fields.bgfOber.value, 'BGF_ABOVE_GROUND'),
    perUnit: rate(total, s.fields.we.value, 'WOHNEINHEITEN'),
    duration,
    aboveGround: present(noUg),
    belowGround: present(ug),
    uncertaintyPp: 22 - narrowing,
  }
}

/**
 * Дельта тоста DC-29 по фикстурному образцу контракта:
 * `− 476.000 € gegenüber DEMO-VV-0003` (префикс ≈ — до знака, как в DC-12).
 */
function dc29Delta(d: Decimal): string {
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€` +
    `${NNBSP}gegenüber DEMO-VV-0003`
}

/**
 * Замораживание состояния — вторая половина инварианта M-4.
 *
 * Убрать `setState` из публичного API оказалось недостаточно: независимый
 * аудит показал, что `getState()` отдавал **живые ссылки**, и присваивание
 * `building.gebaeudeklasse.confirmed = true` меняло расчётное состояние при
 * пустом журнале. Запрет, обеспеченный только тем, что «так писать не
 * принято», не является запретом. Замороженный объект отвечает исключением
 * в строгом режиме — модули ES строгие всегда.
 *
 * `Decimal` пропускается: значения decimal.js неизменяемы по построению
 * (арифметика возвращает новые экземпляры), а заморозка чужих внутренних
 * полей — риск без выигрыша.
 */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Decimal) return value
  const obj = value as unknown as object
  if (seen.has(obj) || Object.isFrozen(obj)) return value
  seen.add(obj)
  for (const v of Object.values(obj)) deepFreeze(v, seen)
  return Object.freeze(value)
}

// Сырой store — приватный. Наружу не выходит ни он, ни его setState.
const store = createStore<Store>((set, get) => {
  /**
   * Единственная дверь для изменения данных: событие + журнал.
   * Тост DC-29 — производная этой же двери: событие с inverse отменяемо и
   * получает тост, событие без inverse гасит предыдущий (новая голова).
   */
  const apply = (e: Omit<JournalEvent, 'seq' | 'at'>) => {
    const { journal } = get()
    const seq = journal.length + 1
    set({
      journal: [...journal, { ...e, seq, at: new Date().toISOString() }],
      undoToast: e.inverse
        ? {
            seq,
            statusText: e.label,
            deltaText: e.deltaExact ? dc29Delta(e.deltaExact) : null,
          }
        : null,
    })
  }

  return {
    buildings: {
      [INITIAL_BUILDING.id]: INITIAL_BUILDING,
      [INITIAL_BUILDING_B.id]: INITIAL_BUILDING_B,
    },
    activeBuildingId: INITIAL_BUILDING.id,
    // По умолчанию в предложение входит одно здание: фикстура объявляет
    // числа именно для этого случая, и добавление второго обязано быть
    // видимым решением пользователя, а не молчаливым умолчанием.
    included: { [INITIAL_BUILDING.id]: true, [INITIAL_BUILDING_B.id]: false },
    buildingConfirmed: {},
    // Умолчания приходят из каталога; там, где каталог говорит
    // `documented`, провенанс сразу «aus Dokument» со ссылкой на файл —
    // это пункт 8 сценария: найденное в документах предвыбрано, но
    // остаётся переключаемым.
    kg300: {
      [INITIAL_BUILDING.id]: defaultOptionChoices(),
      [INITIAL_BUILDING_B.id]: defaultOptionChoices(),
    },
    kg700Mode: 'vereinfacht',
    kg300Provenance: {
      [INITIAL_BUILDING.id]: Object.fromEntries(
        ALL_OPTION_GROUPS.map((g) => [g.id, g.documented ? 'aus Dokument' : 'Standard'])),
      [INITIAL_BUILDING_B.id]: Object.fromEntries(
        ALL_OPTION_GROUPS.map((g) => [g.id, g.documented ? 'aus Dokument' : 'Standard'])),
    },
    coverage: INITIAL_COVERAGE,
    fields: {
      wfl: { value: D(fx.areas.wflWoFlV!), provenance: 'aus Dokument' },
      bgfOber: { value: D(fx.areas.bgfAboveGround!), provenance: 'aus Dokument' },
      we: { value: D(fx.areas.wohneinheiten!), provenance: 'aus Dokument' },
    },
    journal: [],
    undone: [],
    esConfirmed: false,
    wflConflict: {
      id: fxConflict.id,
      state: 'open',
      candidates: fxConflict.candidates.map((c) => ({
        origin: c.origin as 'document' | 'customer',
        value: c.value,
        selectionStatus: c.selectionStatus as 'authoritative' | 'alternative',
        source: 'source' in c && typeof (c as { source?: unknown }).source === 'string'
          ? (c as { source: string }).source
          : 'VerificationEvent DEMO-VE-0002',
      })),
    },
    activeGrundrisse: 'V2',
    regionalfaktorActive: false,
    snapshots: [],
    activeDelta: null,
    preview: null,
    undoToast: null,
    mode: 'intern',
    level: 'liste',
    opportunityId: null,
    projectParamsConfirmed: false,
    options: [],
    activeOptionId: null,
    uiLanguage: 'de',
    density: 'komfortabel',
    openChapter: 3,

    projection: () => computeProjection(get()),

    editField: (key, value, confirmed) => {
      const before = get().projection().result.total.exact
      const prev = get().fields[key]
      set((s) => ({
        fields: {
          ...s.fields,
          [key]: {
            value,
            provenance: confirmed ? 'vom Kunden bestätigt' : 'manuell erfasst',
          },
        },
        buildings: key === 'bgfOber'
          ? { ...s.buildings, [s.activeBuildingId]: { ...activeBuilding(s), bgfAboveGround: value } }
          : s.buildings,
      }))
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: confirmed ? 'value.confirmed' : 'value.edited',
        label: `${LABELS[key]} ${prev.value.toFixed(2)} → ${value.toFixed(2)}`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set((s) => ({
          fields: { ...s.fields, [key]: prev },
          buildings: key === 'bgfOber'
            ? { ...s.buildings, [s.activeBuildingId]: { ...activeBuilding(s), bgfAboveGround: prev.value } }
            : s.buildings,
        })),
        forward: () => set((s) => ({
          fields: {
            ...s.fields,
            [key]: {
              value,
              provenance: confirmed ? 'vom Kunden bestätigt' : 'manuell erfasst',
            },
          },
          buildings: key === 'bgfOber'
            ? { ...s.buildings, [s.activeBuildingId]: { ...activeBuilding(s), bgfAboveGround: value } }
            : s.buildings,
        })),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: `${LABELS[key]} geändert`,
            deltaExact: delta,
            percent: delta.div(before).mul(100),
          },
        })
      }
    },

    setEnergiestandard: (v) => {
      const s = get()
      const b = activeBuilding(s)
      if (b.energiestandard === v) return
      const before = s.projection().result.total.exact
      const prev = b.energiestandard
      const id = s.activeBuildingId
      set({ buildings: { ...s.buildings, [id]: { ...b, energiestandard: v } } })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `Energiestandard ${prev.replace('_', ' ')} → ${v.replace('_', ' ')}`,
        deltaExact: delta,
        inverse: () => set((st) => ({ buildings: { ...st.buildings, [id]: { ...st.buildings[id]!, energiestandard: prev } } })),
        forward: () => set((st) => ({ buildings: { ...st.buildings, [id]: { ...st.buildings[id]!, energiestandard: v } } })),
      })
      // Клик — фиксация: превью гаснет, начинается волна дельты (DC-28).
      set({
        preview: null,
        activeDelta: {
          label: `Energiestandard ${prev.replace('_', ' ')} → ${v.replace('_', ' ')}`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    },

    setUntergeschoss: (v) => {
      const s = get()
      const b = activeBuilding(s)
      if (b.untergeschoss === v) return
      const before = s.projection().result.total.exact
      const prev = b.untergeschoss
      const id = s.activeBuildingId
      set({ buildings: { ...s.buildings, [id]: { ...b, untergeschoss: v } } })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `Untergeschoss ${LABEL_UG[prev]} → ${LABEL_UG[v]}`,
        deltaExact: delta,
        inverse: () => set((st) => ({ buildings: { ...st.buildings, [id]: { ...st.buildings[id]!, untergeschoss: prev } } })),
        forward: () => set((st) => ({ buildings: { ...st.buildings, [id]: { ...st.buildings[id]!, untergeschoss: v } } })),
      })
      set({
        preview: null,
        activeDelta: {
          label: `Untergeschoss ${LABEL_UG[v]}`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    },

    setCoverage: (g, st) => {
      const s = get()
      const prev = s.coverage[g]
      if (prev === st) return
      set({ coverage: { ...s.coverage, [g]: st } })
      apply({
        kind: 'coverage.changed',
        label: `${g} ${COVERAGE_LABEL[prev]} → ${COVERAGE_LABEL[st]}`,
        deltaExact: null,
        inverse: () => set((x) => ({ coverage: { ...x.coverage, [g]: prev } })),
        forward: () => set((x) => ({ coverage: { ...x.coverage, [g]: st } })),
      })
    },

    confirmGebaeudeklasse: () => {
      const s = get()
      const b = activeBuilding(s)
      const id = s.activeBuildingId
      if (b.gebaeudeklasse.confirmed) return
      set({ buildings: { ...s.buildings, [id]: { ...b, gebaeudeklasse: { ...b.gebaeudeklasse, confirmed: true } } } })
      apply({
        kind: 'value.confirmed',
        label: 'Gebäudeklasse nach MBO §2 bestätigt',
        deltaExact: null,
        inverse: () => set((x) => ({ buildings: { ...x.buildings, [id]: { ...x.buildings[id]!, gebaeudeklasse: { ...x.buildings[id]!.gebaeudeklasse, confirmed: false } } } })),
        forward: () => set((x) => ({ buildings: { ...x.buildings, [id]: { ...x.buildings[id]!, gebaeudeklasse: { ...x.buildings[id]!.gebaeudeklasse, confirmed: true } } } })),
      })
    },

    confirmEnergiestandardAnswer: () => {
      if (get().esConfirmed) return
      set({ esConfirmed: true })
      apply({
        kind: 'value.confirmed',
        label: 'Energiestandard vom Kunden bestätigt',
        deltaExact: null,
        inverse: () => set({ esConfirmed: false }),
        forward: () => set({ esConfirmed: true }),
      })
    },

    /**
     * Разрешение конфликта — ОДНО событие, атомарно обратимое.
     *
     * Первая редакция делала два шага (правка поля + закрытие флага) с двумя
     * событиями, и inverse второго возвращал только флаг: после отмены
     * конфликт снова стоял открытым, а значение оставалось клиентским —
     * состояние, которого никогда не существовало. Отмена обязана
     * восстанавливать ВСЁ, что событие меняло.
     */
    resolveWflConflict: (candidate) => {
      const s = get()
      if (s.wflConflict.state !== 'open') return
      const prevField = s.fields.wfl
      const prevConflict = s.wflConflict

      const nextCandidates: ConflictCandidate[] = s.wflConflict.candidates.map((c) => ({
        ...c,
        selectionStatus:
          (candidate === 'customer') === (c.origin === 'customer')
            ? 'authoritative' : 'alternative',
      }))
      const chosen = nextCandidates.find((c) => c.selectionStatus === 'authoritative')!

      set((x) => ({
        fields: {
          ...x.fields,
          wfl: { value: D(chosen.value), provenance: 'vom Kunden bestätigt' },
        },
        wflConflict: { ...x.wflConflict, state: 'resolved', candidates: nextCandidates },
      }))
      apply({
        kind: 'conflict.resolved',
        label: candidate === 'customer'
          ? `WFL-Konflikt: Kundenwert 1.560,00${NNBSP}m² übernommen`
          : `WFL-Konflikt: Dokumentwert 1.500,00${NNBSP}m² beibehalten`,
        deltaExact: null,
        inverse: () => set((x) => ({
          fields: { ...x.fields, wfl: prevField },
          wflConflict: prevConflict,
        })),
        forward: () => set((x) => ({
          fields: {
            ...x.fields,
            wfl: { value: D(chosen.value), provenance: 'vom Kunden bestätigt' },
          },
          wflConflict: { ...x.wflConflict, state: 'resolved', candidates: nextCandidates },
        })),
      })
    },

    activateGrundrisse: (v) => {
      const s = get()
      if (s.activeGrundrisse === v) return
      const prev = s.activeGrundrisse
      set({ activeGrundrisse: v })
      apply({
        kind: 'document.activated',
        label: `Grundrisse: Version ${v} aktiviert (vorher ${prev})`,
        deltaExact: null,
        inverse: () => set({ activeGrundrisse: prev }),
        forward: () => set({ activeGrundrisse: v }),
      })
    },

    toggleRegionalfaktor: () => {
      const s = get()
      const before = s.projection().result.total.exact
      const next = !s.regionalfaktorActive
      set({ regionalfaktorActive: next })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `Regionalfaktor Musterland 1,08 ${next ? 'aktiviert' : 'deaktiviert'}`,
        deltaExact: delta,
        inverse: () => set({ regionalfaktorActive: !next }),
        forward: () => set({ regionalfaktorActive: next }),
      })
      set({
        activeDelta: {
          label: `Regionalfaktor ${next ? 'aktiviert' : 'deaktiviert'}`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    },

    /**
     * Отправка = снапшот + событие (M-3). Снапшот создаётся ДО события,
     * событие ссылается на него; inverse отсутствует намеренно —
     * отправленное неприкосновенно, отменить отправку нельзя.
     */
    sendOffer: (kind, discountPercent) => {
      const s = get()
      const p = s.projection()
      const snap: OfferSnapshot = {
        id: `SNAP-${s.snapshots.length + 1}`,
        at: new Date().toISOString(),
        kind,
        totalExact: p.result.total.exact.toFixed(2),
        totalLabel: p.result.totalLabel,
        uncertaintyPp: p.uncertaintyPp,
        regionalfaktorActive: s.regionalfaktorActive,
        coverage: { ...s.coverage },
        discountPercent,
        journalSeqAt: s.journal.length,
      }
      // Снапшот неприкосновенен по построению (M-3): и сам объект, и список.
      // Аудит показал, что возвращаемый объект был изменяем, а массив
      // допускал `splice` — «неприкосновенность», которой не существовало.
      deepFreeze(snap)
      set({ snapshots: Object.freeze([...s.snapshots, snap]) as OfferSnapshot[] })
      apply({
        kind: kind === 'email' ? 'offer.emailed' : 'offer.printed',
        label: kind === 'email'
          ? `Angebot per E-Mail gesendet · Snapshot ${snap.id}`
          : `Angebot gedruckt · Snapshot ${snap.id}`,
        deltaExact: null,
      })
      return snap
    },

    clearDelta: () => set({ activeDelta: null }),
    openChapterAt: (n) => set({ openChapter: n }),

    optionDelta: (change) => {
      // Тот же движок от точных значений — у последствия нет собственной
      // арифметики, поэтому карточка, превью и клик не могут разойтись.
      const s = get()
      const before = computeProjection(s).result.total.exact
      const after = computeProjection({
        ...s,
        buildings: { ...s.buildings, [s.activeBuildingId]: { ...activeBuilding(s), [change.kind]: change.value } },
      }).result.total.exact
      return after.minus(before)
    },

    previewOption: (change) => {
      if (change === null) {
        if (get().preview !== null) set({ preview: null })
        return
      }
      const s = get()
      const current = activeBuilding(s)[change.kind]
      if (current === change.value) {
        if (s.preview !== null) set({ preview: null })
        return
      }
      const label = change.kind === 'energiestandard'
        ? `Energiestandard ${change.value.replace('_', ' ')}`
        : `Untergeschoss ${LABEL_UG[change.value as BuildingInput['untergeschoss']]}`
      // Призрак показывает БУДУЩЕЕ значение героя, а не только разницу:
      // «на сколько изменится» без «сколько станет» заставляет клиента
      // считать в уме на переговорах.
      const future = computeProjection({
        ...s,
        buildings: { ...s.buildings, [s.activeBuildingId]: { ...activeBuilding(s), [change.kind]: change.value } },
      })
      set({
        preview: {
          label,
          futureTotal: future.result.total,
          deltaExact: get().optionDelta(change),
          contextRef: 'DEMO-SC-01 · Vorschau-Lauf DEMO-RUN-0009',
          futureLabel: future.result.totalLabel,
        },
      })
    },

    /**
     * Отмена с курсором: берётся последнее ещё не отменённое событие с
     * inverse; его seq попадает в `undone`, поэтому второй вызов отменяет
     * ПРЕДЫДУЩЕЕ событие, а не то же самое ещё раз. Кнопка журнала не
     * целится в события отмены — редо доступно только адресно из тоста.
     */
    undo: () => {
      const target = undoTarget(get())
      if (!target) return
      get().undoEvent(target.seq)
    },

    /**
     * Есть ли что отменять. Кнопка обязана спрашивать КУРСОР, а не длину
     * журнала: после отмены журнал непуст, а отменять уже нечего — аудит
     * поймал живую кнопку, нажатие которой было no-op.
     */
    canUndo: () => undoTarget(get()) !== undefined,

    /**
     * Адресная отмена (DC-29). Событие отмены получает inverse = forward
     * отменяемого, поэтому «отмена отмены» — обычное событие журнала,
     * а не спецрежим. Уже отменённый seq — no-op: курсор не даёт применить
     * один inverse дважды.
     */
    undoEvent: (seq) => {
      const { journal, undone } = get()
      const target = journal.find((e) => e.seq === seq)
      if (!target || !target.inverse || undone.includes(seq)) return
      target.inverse()
      set((s) => ({
        // Отмена СОБЫТИЯ ОТМЕНЫ возвращает исходное событие в действующие.
        // Прежняя редакция оставляла его в `undone` навсегда: состояние
        // говорило «EH 40 применён», а курсор считал его отменённым, и
        // следующий обычный undo молча ничего не делал. Курсор обязан
        // описывать то же, что состояние.
        undone: [...s.undone.filter((n) => n !== target.undoOf), seq],
      }))
      apply({
        kind: 'undo',
        label: `Rückgängig: ${target.label}`,
        deltaExact: target.deltaExact ? target.deltaExact.negated() : null,
        undoOf: seq,
        inverse: target.forward,
        forward: target.inverse,
      })
    },

    dismissUndoToast: () => set({ undoToast: null }),

    setMode: (m) => {
      if (m === 'praesentation' && !activeBuilding(get()).gebaeudeklasse.confirmed) return
      set({ mode: m })
    },

    openOpportunity: (id) => set({ level: 'opportunity', opportunityId: id }),
    backToList: () => set({ level: 'liste', activeOptionId: null }),

    /**
     * Подтверждение верхнеуровневых параметров — СОБЫТИЕ журнала, а не
     * флаг: оно открывает возможность создавать Options, то есть меняет
     * то, что пользователю разрешено. Изменение без события невозможно
     * по построению (M-4), и это относится к правам так же, как к числам.
     */
    confirmProjectParams: () => {
      if (get().projectParamsConfirmed) return
      set({ projectParamsConfirmed: true })
      apply({
        kind: 'value.confirmed',
        label: 'Projektparameter bestätigt (Gebäude, Flächen, Einheiten)',
        deltaExact: null,
        inverse: () => set({ projectParamsConfirmed: false }),
        forward: () => set({ projectParamsConfirmed: true }),
      })
    },

    canCreateOptions: () => {
      const s = get()
      return s.wflConflict.state === 'resolved' && s.projectParamsConfirmed
    },

    createOption: (name) => {
      if (!get().canCreateOptions()) return
      const s = get()
      const id = `OPT-${String(s.options.length + 1).padStart(2, '0')}`
      set({ options: [...s.options, { id, name }], activeOptionId: id })
      apply({
        kind: 'value.edited',
        label: `Opportunity Option «${name}» angelegt`,
        deltaExact: null,
        inverse: () => set((x) => ({
          options: x.options.filter((o) => o.id !== id),
          activeOptionId: null,
        })),
        forward: () => set((x) => ({ options: [...x.options, { id, name }] })),
      })
    },

    openOption: (id) => set({ level: 'option', activeOptionId: id }),

    setActiveBuilding: (id) => set({ activeBuildingId: id }),

    /**
     * Включённость здания меняет ЦЕНУ, поэтому это событие журнала с
     * дельтой, а не переключатель вида. Исключить здание и не увидеть
     * этого в журнале значило бы потерять причину изменения итога.
     */
    toggleBuildingIncluded: (id) => {
      const s = get()
      if (!s.buildings[id]) return
      const next = !s.included[id]
      // Пустое предложение не имеет проекции: последнее включённое здание
      // выключить нельзя, и причина названа в интерфейсе.
      if (!next && Object.values(s.included).filter(Boolean).length === 1) return
      const before = s.projection().result.total.exact
      set({ included: { ...s.included, [id]: next } })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `${id} ${next ? 'in das Angebot aufgenommen' : 'aus dem Angebot genommen'}`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set((x) => ({ included: { ...x.included, [id]: !next } })),
        forward: () => set((x) => ({ included: { ...x.included, [id]: next } })),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: `${id} ${next ? 'aufgenommen' : 'entfernt'}`,
            deltaExact: delta,
            percent: delta.div(before).mul(100),
          },
        })
      }
    },

    setKg700Mode: (m) => {
      const s = get()
      if (s.kg700Mode === m) return
      const prev = s.kg700Mode
      const before = s.projection().result.total.exact
      set({ kg700Mode: m })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: m === 'hoaiAho'
          ? 'KG 700 nach HOAI und AHO als eigene Position'
          : 'KG 700 im All3-Verfahren 70/22/8 verteilt',
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set({ kg700Mode: prev }),
        forward: () => set({ kg700Mode: m }),
      })
    },

    setKg300: (groupId, value) => {
      const s = get()
      const id = s.activeBuildingId
      const prev = s.kg300[id]?.[groupId]
      if (prev === value) return
      const group = ALL_OPTION_GROUPS.find((g) => g.id === groupId)
      if (!group) return
      const prevProv = s.kg300Provenance[id]?.[groupId] ?? 'Standard'
      const before = s.projection().result.total.exact
      const write = (v: string, prov: string) => set((x) => ({
        kg300: { ...x.kg300, [id]: { ...x.kg300[id], [groupId]: v } },
        kg700Mode: 'vereinfacht',
    kg300Provenance: { ...x.kg300Provenance, [id]: { ...x.kg300Provenance[id], [groupId]: prov } },
      }))
      // Ручное переключение меняет провенанс: значение больше не «из
      // документа», даже если совпадает с ним. Иначе продавец не отличит
      // подтверждённое документом от собственного решения.
      write(value, 'manuell erfasst')
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      const choice = group.choices.find((c) => c.value === value)
      apply({
        kind: 'option.selected',
        label: `${group.label}: ${choice?.label ?? value} (${id})`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(prev ?? group.default, prevProv),
        forward: () => write(value, 'manuell erfasst'),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: `${group.label}: ${choice?.label ?? value}`,
            deltaExact: delta,
            percent: delta.div(before).mul(100),
          },
        })
      }
    },

    confirmBuilding: (id) => {
      const s = get()
      if (s.buildingConfirmed[id]) return
      set({ buildingConfirmed: { ...s.buildingConfirmed, [id]: true } })
      apply({
        kind: 'value.confirmed',
        label: `Gebäudedaten ${id} bestätigt`,
        deltaExact: null,
        inverse: () => set((x) => ({ buildingConfirmed: { ...x.buildingConfirmed, [id]: false } })),
        forward: () => set((x) => ({ buildingConfirmed: { ...x.buildingConfirmed, [id]: true } })),
      })
    },

    allBuildingsConfirmed: () => {
      const s = get()
      const ids = Object.keys(s.buildings).filter((id) => s.included[id])
      return ids.length > 0 && ids.every((id) => s.buildingConfirmed[id])
    },

    setUiLanguage: (l) => set({ uiLanguage: l }),

    setDensity: (d) => set({ density: d }),
  }
})

// Каждое состояние замораживается сразу после записи: подписчик zustand
// выполняется синхронно за `set`, поэтому наружу живая ссылка не выходит.
deepFreeze(store.getState())
store.subscribe((s) => deepFreeze(s))

// Снимок начального состояния — для тестового сброса.
const INITIAL_SNAPSHOT = store.getState()

type UseStore = (() => Store) & { getState: () => Store }

/**
 * Наружу — только чтение и действия. `setState` не экспортируется:
 * данные меняются событиями, и другого пути нет по построению.
 */
const hook = (() => useZustandStore(store)) as UseStore
hook.getState = store.getState
export const useStore = hook

/**
 * Тестовый сброс — единственная санкционированная замена состояния целиком.
 * В продакшн-сборке недоступен: аудит верно указал, что production-модуль
 * экспортировал полную замену состояния без события. Экспорт остаётся ради
 * простоты импорта в тестах, но вызов вне тестовой среды — исключение.
 */
export function __resetStoreForTests(): void {
  const mode = (import.meta as { env?: { MODE?: string } }).env?.MODE
  if (mode !== 'test') {
    throw new Error(
      '__resetStoreForTests доступен только в тестовой среде: замена состояния ' +
        'целиком обходит журнал событий (M-4)',
    )
  }
  store.setState(INITIAL_SNAPSHOT, true)
}

const LABELS: Record<'wfl' | 'bgfOber' | 'we', string> = {
  wfl: 'Wohnfläche WFL nach WoFlV',
  bgfOber: 'BGF oberirdisch',
  we: 'Wohneinheiten',
}

const LABEL_UG: Record<BuildingInput['untergeschoss'], string> = {
  kein_ug: 'nicht Bestandteil',
  ab_decke: 'Leistungsbeginn ab OK Decke über UG',
  vollausbau: 'vollständig inkl. Gründung',
}

const COVERAGE_LABEL: Record<CoverageState, string> = {
  included: 'enthalten',
  excluded: 'nicht enthalten',
  onRequest: 'auf Anfrage',
  unknown: 'noch offen',
  notApplicable: 'nicht anwendbar',
}

export { LABEL_UG, COVERAGE_LABEL, LABELS }
