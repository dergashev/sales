import { createStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import {
  isClientProjection,
  modeForLevelTransition,
  pipelineViewForOutputProfile,
  type OutputMode,
  type PipelineView,
  type ProductLevel,
} from './clientProjection'
import {
  activeBuildingConfiguratorSteps,
  CONFIGURATOR_STEP,
  isBuildingScopedConfiguratorStep,
  isConfiguratorStepId,
  nearestActiveConfiguratorStep,
  stepIdFromLegacyChapter,
  type ConfiguratorStepId,
} from './chapters'
import { withRegionalFactor } from './catalog'
import {
  bgfAboveGround, calculateBuilding, calculateKg800, kgSplit, sumOfBlock,
  SCOPE_BOUNDARIES_DECIDABLE_GROUPS,
  totalLabel as calculationTotalLabel,
  type BuildingInput, type Coverage, type CoverageState,
  type CostGroup, type BuildingResult, type Kg800Params,
} from '../engine/calculate'
import {
  present, rate, NNBSP, formatDE, type Displayed, type Rate,
} from '../engine/money'
import {
  defaultOptionChoices, optionDrivers, coverageDrivers, ALL_OPTION_GROUPS, ZERT_GROUPS,
} from '../engine/options'
import {
  scopeCatalogDrivers, defaultScopeCatalogSelections, SCOPE_QUANTITY_UNIT,
  ALL_SCOPE_CATALOG_OPTIONS, KG200_CATALOG_OPTIONS, KG500_CATALOG_OPTIONS,
  KG600_CATALOG_OPTIONS, KG800_CATALOG_OPTIONS,
  type ScopeQuantityKey,
} from '../engine/scopeCatalog'
import derivedFx from '../fixtures/derived-prototype.json'

/**
 * Читает 8 параметров KG 800 из выбора каталога (`kg800-01`…`kg800-08`).
 * `guaranteeAmount` — единственный параметр, чья база не вариант каталога,
 * а количество (`guarantee_amount_eur`, внешний ввод по контракту).
 */
function readKg800Params(
  choices: Record<string, string>,
  quantityOf: (key: ScopeQuantityKey) => Decimal | null,
): Kg800Params {
  const selected = (optionId: string) => {
    const option = KG800_CATALOG_OPTIONS.find((o) => o.id === optionId)!
    const value = choices[optionId] ?? option.default
    return option.variants.find((v) => v.value === value) ?? option.variants[0]!
  }
  return {
    debtRatio: new Decimal(selected('kg800-01').rate),
    debtRate: new Decimal(selected('kg800-02').rate),
    financingMonths: new Decimal(selected('kg800-03').rate),
    drawdownFactor: new Decimal(selected('kg800-04').rate),
    financingFeeRate: new Decimal(selected('kg800-05').rate),
    commitmentFreeMonths: new Decimal(selected('kg800-06').rate),
    commitmentMonthlyRate: new Decimal(selected('kg800-06').rate2 ?? '0'),
    guaranteeAmount: quantityOf('guarantee_amount_eur') ?? new Decimal(0),
    guaranteeRate: new Decimal(selected('kg800-07').rate),
    equityRate: new Decimal(selected('kg800-08').rate),
  }
}
import {
  modelDuration, presentDuration, shiftScheduleMetrics, type DurationDisplay,
} from '../engine/schedule'
import { RISK_ITEMS, riskDriver } from '../engine/risk'
import {
  appendConflictResolution,
  buildingFingerprint,
  deriveConflictState,
  effectiveFactValue,
  fact,
  isBuildingConflict,
  isBuildingConfirmed as reviewIsBuildingConfirmed,
  isBuildingReview,
  migrateStoreyStructureFactValue,
  toBuildingInput,
  synchronizeDerivedConflicts,
  withEngineState,
  withFactOverride,
  withoutFactOverride,
  type BuildingConfirmation,
  type BuildingConflict,
  type BuildingFactKey,
  type BuildingFactValueMap,
  type BuildingReview,
  type ConflictResolution,
  type ReviewedBuildingInput,
} from './buildingReview'
import {
  browserProposalStorage,
  clearPersistedProposal,
  loadPersistedProposal,
  savePersistedProposal,
  serializeProposalPayload,
  type StorageLike,
} from './persistence'

export type { PipelineView } from './clientProjection'

/** Calculation input enriched with proposal-review metadata. */
export type ProjectBuilding = ReviewedBuildingInput

export type BuildingReviewSection = 'identity' | 'areas' | 'storeys'
export type BuildingSectionConfirmation = { fingerprint: string; at: string }

const BUILDING_REVIEW_SECTIONS: ReadonlyArray<BuildingReviewSection> = [
  'identity', 'areas', 'storeys',
]

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

/*
 * Доля KG 700 в режиме HOAI+AHO больше не живёт здесь.
 *
 * Она была выведена (D-22) как «≈ 8,7 % от блока» при том, что
 * `calculation-spec.md` §1 объявляет **12 % от Bauwerk-блока** прямо. D-22
 * разрешает подобрать значение там, где источник его не даёт; здесь
 * источник даёт, и производная величина не заполнила пробел, а подменила
 * формулу — молча, потому что обе помечены ⚙ (решение D-27, сплошное
 * ревью 26, находка 9). Теперь доля приходит из каталога, извлечённая
 * построителем из спецификации.
 */

export type EventKind =
  | 'value.edited' | 'value.confirmed'
  | 'option.selected' | 'coverage.changed'
  | 'document.activated' | 'conflict.resolved'
  | 'offer.emailed' | 'offer.printed'
  | 'note.created' | 'note.synced_to_hubspot'
  | 'state.restored'
  | 'undo'

export type JournalEvent = {
  seq: number
  kind: EventKind
  /** Человекочитаемая подпись — она же строка журнала сессии. */
  label: string
  /** Точная денежная дельта события. Null, если событие не меняет цену. */
  deltaExact: Decimal | null
  at: string
  /**
   * Контекст события: внутри какой Option оно произошло. `null` — событие
   * уровня Opportunity (разрешение конфликта, подтверждение параметров,
   * создание Option). Журнал и курсор Undo фильтруются этим полем: отменить
   * из Option A событие Option B невозможно по построению, а не по
   * дисциплине.
   */
  optionId: string | null
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
  /** Raw audit reference; presentation copy must never replace it in state. */
  source: string
  /** Optional evidence date exposed separately for locale-aware presentation. */
  capturedAt: string | null
}

export type WflConflict = {
  id: string
  state: 'open' | 'resolved'
  candidates: ConflictCandidate[]
}

export type ConfigurationMode = 'SHARED' | 'PER_BUILDING'

export type SharedConfiguration = {
  choices: Record<string, string>
  provenance: Record<string, string>
}

export type BuildingConfigurationState = {
  status: 'draft' | 'completed' | 'confirmed'
  fingerprint: string | null
  at: string | null
}

export type ConfigurationDisplayStatus = 'open' | 'ready' | 'confirmed' | 'recheck'

const SHARED_CONFIGURATION_SCOPE = 'SHARED'

/**
 * Снапшот отправленного оффера (M-3, минимум прототипа): состояние,
 * от которого клиент получил числа, воспроизводимо из самого снапшота,
 * а не из памяти. Флаг Regionalfaktor входит сюда по D-15.
 */
export type OfferSnapshot = {
  id: string
  at: string
  kind: 'email' | 'print'
  /** Какая Option отправлена: снапшот обязан называть свой вариант (M-3). */
  optionId: string | null
  optionName: string | null
  totalExact: string
  totalLabel: string
  uncertaintyPp: number
  regionalfaktorActive: boolean
  coverage: Coverage
  discountPercent: string | null
  journalSeqAt: number
  /**
   * VR2-08 (SNAPSHOT BINDING): welche Artefakte zum Versandzeitpunkt real
   * gewählt waren (`offerDraft.attachments`-IDs) — ohne dieses Feld würde
   * das Delivered-Rückblickfenster die AKTUELLE, mutable Auswahl anzeigen
   * und damit genau das verletzen, was M-3 verbietet: eine spätere,
   * legitime Änderung der Artefaktauswahl dürfte die historische
   * Sendung nicht rückwirkend umschreiben.
   */
  attachmentIds: string[]
}

/**
 * Всё, что принадлежит ОДНОЙ Option, — её независимая конфигурация.
 * Ровно эти поля переезжают между плоским состоянием и `optionConfigs`
 * при переключении; поле вне этого типа по построению общее для всех
 * Options (уровень Opportunity). Ошибиться стороной нельзя: и захват,
 * и раскладка построены на одном перечне `OPTION_CONFIG_KEYS`.
 */
export type OptionConfig = {
  buildings: Record<string, ProjectBuilding>
  activeBuildingId: string
  included: Record<string, boolean>
  buildingReviews: Record<string, BuildingReview>
  buildingConfirmation: Record<string, BuildingConfirmation>
  /** Explicit section review is durable Option state, not disclosure UI state. */
  buildingSectionConfirmations: Record<
    string,
    Partial<Record<BuildingReviewSection, BuildingSectionConfirmation>>
  >
  configurationMode: ConfigurationMode
  /** The default mode is an engine fallback, never proof of user consent. */
  configurationModeChosen: boolean
  /** Pricing stays dormant until Scope Boundaries has actually been entered. */
  pricingStarted: boolean
  /** Building-chapter progress is isolated by building or shared scope. */
  configurationVisitedChapters: Record<string, ConfiguratorStepId[]>
  sharedConfiguration: SharedConfiguration
  buildingConfigState: Record<string, BuildingConfigurationState>
  kg300: Record<string, Record<string, string>>
  kg300Provenance: Record<string, Record<string, string>>
  kg700Mode: 'vereinfacht' | 'hoaiAho'
  /**
   * True exactly when the CURRENT `kg700Mode` value comes from D-07 rule-6
   * automatic enforcement (fresh-Option default or `setCoverage`), not from
   * a deliberate seller choice (`setKg700Mode`). Only an auto-set mode may be auto-reverted
   * when its triggering precondition (KG 300 and KG 400 both included)
   * is restored — a deliberate choice must never be silently overridden
   * (QA-01, ticket e2dac9b5).
   */
  kg700ModeAutoFallback: boolean
  coverage: Coverage
  /** See the matching field on `Store` for the full rationale. */
  scopeCatalogChoices: Record<string, string>
  scopeCatalogProvenance: Record<string, string>
  scopeCatalogQuantities: Record<string, string>
  kg800ClientRevealed: boolean
  scopeBoundariesConfirmedFingerprint: string | null
  fields: { wfl: FieldState; bgfOber: FieldState; we: FieldState }
  esConfirmed: boolean
  regionalfaktorActive: boolean
  /**
   * Применённые надбавки за риск (D-02). Умолчание — пусто, и это НЕ
   * означает «рисков нет»: риски объявлены фикстурой всегда, применение
   * же меняет цену и потому является решением с событием. Контрольный
   * пример calculation-spec §6.1 надбавок не содержит — включить их по
   * умолчанию значило бы молча разойтись с нормативным спесименом
   * (правило 32). Тот же приём, что у Regionalfaktor (D-15).
   */
  risikoAktiv: Record<string, boolean>
  openConfiguratorStep: ConfiguratorStepId
  visitedConfiguratorSteps: ConfiguratorStepId[]
  /**
   * Охват показа (DC-46, правило 38): `null` — весь комплекс, иначе id
   * здания. Это ПРЕДПОЧТЕНИЕ ПОКАЗА, а не состав предложения: `included`
   * решает, что продаётся, охват — на что сейчас смотрят. Смешать их
   * значило бы убирать здание из оффера кликом по вкладке.
   */
  scopeBuildingId: string | null
  /** Скидка принадлежит варианту, а не экрану (находка 14). */
  discountPercent: Decimal | null
  /**
   * Черновик письма: текст и выбранные артефакты. Принадлежит Option, как и
   * всё остальное в её конфигурации.
   *
   * Прежде и текст, и набор вложений жили в `useState` экрана: уход в
   * сравнение и возврат стирали написанное продавцом, а после отправки
   * экран снова открывался в `compose`, не помня, что оффер уже ушёл
   * (сплошное ревью 26, находка 15). Стадия доставки здесь НЕ хранится: она
   * выводится из снапшотов и журнала — иначе состояние экрана и факт
   * отправки могли бы противоречить друг другу.
   */
  offerDraft: { body: string; attachments: string[] }
  /**
   * Construction Period (тикет KG300/400/700 + Bauzeit-Reise): Baubeginn
   * гehört zur Option, wie jede andere Preis-/Terminentscheidung — NICHT
   * ein globales, ungebundenes Feld (Tech Review Zyklus 2: als globales
   * Feld gelesen von `projection()` einerseits und `projectProjection()`
   * andererseits, zeigte dieselbe Option zwei widersprüchliche
   * Fertigstellungstermine gleichzeitig auf dem client-sichtbaren
   * Vergleichsbildschirm). Ein Eigentümer, eine Option, ein Termin überall.
   */
  constructionStartDate: string | null
}

const OPTION_CONFIG_KEYS = [
  'buildings', 'activeBuildingId', 'included', 'buildingReviews',
  'buildingConfirmation', 'buildingSectionConfirmations',
  'configurationMode', 'configurationModeChosen',
  'pricingStarted', 'configurationVisitedChapters', 'sharedConfiguration',
  'buildingConfigState',
  'kg300', 'kg300Provenance', 'kg700Mode', 'kg700ModeAutoFallback', 'coverage',
  'scopeCatalogChoices', 'scopeCatalogProvenance', 'scopeCatalogQuantities',
  'kg800ClientRevealed',
  'scopeBoundariesConfirmedFingerprint', 'fields',
  'esConfirmed', 'regionalfaktorActive', 'risikoAktiv',
  'openConfiguratorStep', 'visitedConfiguratorSteps', 'scopeBuildingId', 'discountPercent',
  'offerDraft', 'constructionStartDate',
] as const satisfies ReadonlyArray<keyof OptionConfig>

/** Снять конфигурацию активной Option с плоского состояния. */
function captureConfig(s: Pick<Store, keyof OptionConfig>): OptionConfig {
  return Object.fromEntries(
    OPTION_CONFIG_KEYS.map((k) => [k, s[k]]),
  ) as unknown as OptionConfig
}

type PersistedProposalConfig = Omit<Pick<OptionConfig,
  | 'activeBuildingId' | 'included' | 'buildingReviews' | 'buildingConfirmation'
  | 'buildingSectionConfirmations'
  | 'configurationMode' | 'configurationModeChosen' | 'pricingStarted'
  | 'configurationVisitedChapters'
  | 'sharedConfiguration' | 'buildingConfigState'
  | 'kg300' | 'kg300Provenance' | 'kg700Mode' | 'kg700ModeAutoFallback' | 'coverage'
  | 'scopeCatalogChoices' | 'scopeCatalogProvenance' | 'scopeCatalogQuantities'
  | 'kg800ClientRevealed'
  | 'scopeBoundariesConfirmedFingerprint'
  | 'esConfirmed' | 'regionalfaktorActive' | 'risikoAktiv' | 'discountPercent'
  | 'constructionStartDate'>,
  'buildingSectionConfirmations' | 'configurationModeChosen' | 'pricingStarted'
    | 'configurationVisitedChapters' | 'scopeBoundariesConfirmedFingerprint'
    | 'constructionStartDate' | 'kg700ModeAutoFallback'
    | 'scopeCatalogChoices' | 'scopeCatalogProvenance' | 'scopeCatalogQuantities'
    | 'kg800ClientRevealed'> & {
    /** Optional while reading candidates saved before section review was durable. */
    buildingSectionConfirmations?: Record<
      string,
      Partial<Record<BuildingReviewSection, BuildingSectionConfirmation>>
    >
    /** Optional only while reading v1 payloads saved before explicit entry. */
    configurationModeChosen?: boolean
    /** Optional while reading candidates saved before the QA-01 fix (ticket
     * e2dac9b5); such payloads carry no fallback provenance, so they must
     * never be auto-reverted retroactively. */
    kg700ModeAutoFallback?: boolean
    /** Optional while reading candidates saved before the pricing boundary. */
    pricingStarted?: boolean
    configurationVisitedChapters?: Record<string, Array<ConfiguratorStepId | number>>
    /** Optional while reading payloads saved before Scope Boundaries confirmation existed. */
    scopeBoundariesConfirmedFingerprint?: string | null
    /** Optional while reading payloads saved before Construction Period existed. */
    constructionStartDate?: string | null
    /** Optional while reading payloads saved before KG 200/500/600/800 catalogs existed. */
    scopeCatalogChoices?: Record<string, string>
    scopeCatalogProvenance?: Record<string, string>
    scopeCatalogQuantities?: Record<string, string>
    kg800ClientRevealed?: boolean
  }

const PERSISTED_CONFIG_KEYS = [
  'activeBuildingId', 'included', 'buildingReviews', 'buildingConfirmation',
  'buildingSectionConfirmations',
  'configurationMode', 'configurationModeChosen', 'pricingStarted',
  'configurationVisitedChapters',
  'sharedConfiguration', 'buildingConfigState',
  'kg300', 'kg300Provenance', 'kg700Mode', 'kg700ModeAutoFallback', 'coverage',
  'scopeCatalogChoices', 'scopeCatalogProvenance', 'scopeCatalogQuantities',
  'kg800ClientRevealed',
  'scopeBoundariesConfirmedFingerprint', 'esConfirmed',
  'regionalfaktorActive', 'risikoAktiv', 'discountPercent',
  'constructionStartDate',
] as const satisfies ReadonlyArray<keyof PersistedProposalConfig>

const LEGACY_PERSISTED_CONFIG_KEYS = PERSISTED_CONFIG_KEYS.filter(
  (key) => key !== 'configurationModeChosen'
    && key !== 'buildingSectionConfirmations'
    && key !== 'pricingStarted'
    && key !== 'configurationVisitedChapters'
    && key !== 'scopeBoundariesConfirmedFingerprint'
    && key !== 'constructionStartDate'
    && key !== 'kg700ModeAutoFallback'
    && key !== 'scopeCatalogChoices'
    && key !== 'scopeCatalogProvenance'
    && key !== 'scopeCatalogQuantities'
    && key !== 'kg800ClientRevealed',
)

function capturePersistedConfig(
  config: Pick<OptionConfig, keyof PersistedProposalConfig>,
): PersistedProposalConfig {
  return Object.fromEntries(
    PERSISTED_CONFIG_KEYS.map((key) => [key, config[key]]),
  ) as unknown as PersistedProposalConfig
}

type PersistedProposalPayload = {
  active: PersistedProposalConfig
  options: Array<{ id: string; name: string }>
  activeOptionId: string | null
  optionSeq: number
  optionConfigs: Record<string, PersistedProposalConfig>
  buildingConflicts: Record<string, BuildingConflict>
  /**
   * Absent in payloads saved before this fix (F-07, deep-coherence audit
   * 2026-08-22): the conflict decision survived reload via `buildingConflicts`
   * while this Opportunity-level gate flag reverted silently to unconfirmed
   * with no explanation, because it was never part of this payload at all.
   * Optional so an older stored payload is not rejected outright — treated as
   * `false` on restore, the same conservative default as the initial state.
   */
  projectParamsConfirmed?: boolean
  /**
   * VR2-08 (M-3, SNAPSHOT BINDING): absent in payloads saved before this
   * fix — a sent Option's immutable snapshot previously lived ONLY in
   * memory, so a genuinely ordinary action (a real browser reload, not a
   * client-eligibility edge case) silently lost "this was already sent"
   * and routed the ordinary portfolio re-entry straight back to the
   * narrative, as if nothing had ever been sent. Optional/defaults to `[]`
   * on restore so an older stored payload keeps loading rather than being
   * discarded whole.
   */
  snapshots?: OfferSnapshot[]
}

/**
 * Покрытие групп затрат Scope Boundaries — умолчание `excluded`, а не
 * `unknown`.
 *
 * Актуальное продуктовое решение (CPO, тикет "MAKE ALL KG 200-800
 * SELECTABLE & ADD COST-BEARING CONTENT...", 22.08.2026) ЯВНО ОТМЕНЯЕТ
 * прежний контракт "пробел покрытия" (D-18/D-29/SCOPE-001): у каждой KG
 * 200-800 нормально ровно ДВА состояния - included/Enthalten или
 * excluded/Nicht enthalten, третьего "noch offen"/unknown в обычной
 * работе не существует. Умолчание для КАЖДОЙ decidable группы (KG 200, 300,
 * 400, 500, 600, 700, 800) - excluded, пока сохранённый проект не несёт
 * собственного явного значения (`restoredOptionConfig`/`migrateCoverage`
 * поднимают легаси-unknown до excluded при загрузке - отсутствие решения
 * никогда не воскрешает третье состояние).
 *
 * KG 100 (Grundstück) в эту задачу не входит и остаётся `notApplicable`.
 *
 * Прежняя редакция этого комментария (Product Decision Brief, тикет
 * 627d3191) вводила умолчание `unknown` для шести групп и явно оставляла
 * KG 800 вне перечня Scope Boundaries ("тикет называет ровно шесть групп",
 * `notApplicable`). Оба пункта отменены настоящим решением: KG 800 -
 * седьмая равноправная decidable-группа, и "решение ещё не принято" само
 * по себе больше не является нормальным отображаемым состоянием.
 */
/**
 * KG 300/400/700 are mandatory core cost groups (ticket "Rebuild Project
 * Card Workflow" #16): every offer includes them, and Scope Boundaries
 * never offers a way to exclude them. This supersedes the 22.08.2026
 * "MAKE ALL KG 200-800 SELECTABLE" decision for exactly these three
 * groups; KG 200/500/600 remain genuinely user-decidable, excluded by
 * default. KG 800 is no longer a supported Scope Boundaries group at all
 * (see `migrateCoverage` below) and is never included by default.
 */
export const MANDATORY_COST_GROUPS = ['KG_300', 'KG_400', 'KG_700'] as const
const INITIAL_COVERAGE: Coverage = {
  KG_100: 'notApplicable', KG_200: 'excluded',
  KG_300: 'included', KG_400: 'included', KG_500: 'excluded',
  KG_600: 'excluded', KG_700: 'included', KG_800: 'excluded',
}

/**
 * Поднимает легаси-покрытие (сохранённое до текущего решения) до текущего
 * бинарного контракта:
 * - любой `unknown` для decidable-группы - это молчаливо непринятое
 *   решение, которое обязано читаться как `excluded` (D-08: отсутствие
 *   решения не становится тихим включением), никогда не как воскрешённое
 *   третье состояние;
 * - KG 300/400/700 - обязательные группы (`MANDATORY_COST_GROUPS`): любое
 *   унаследованное значение, кроме `included`, поднимается до `included`,
 *   потому что предложение без них больше не существует как нормальное
 *   состояние;
 * - KG 800 больше не является decidable-группой Scope Boundaries: любое
 *   значение, кроме `excluded` (включая старое `notApplicable` или
 *   унаследованное `included`), опускается до `excluded` - тот же приём
 *   "dormant, без активной стоимости", которым уже пользуется любая
 *   исключённая группа, а не удаление данных.
 */
function migrateCoverage(coverage: Coverage): Coverage {
  const migrated = { ...coverage }
  for (const group of SCOPE_BOUNDARIES_DECIDABLE_GROUPS) {
    if (migrated[group] === 'unknown') migrated[group] = 'excluded'
  }
  for (const group of MANDATORY_COST_GROUPS) {
    migrated[group] = 'included'
  }
  migrated.KG_800 = 'excluded'
  return migrated
}

/**
 * Tech Lead rework (cycle 3, review of d6db7b5c): `setCoverage`'s D-07
 * revert branch (`hoaiAho` -> `vereinfacht` once both core KGs are
 * re-included) was correctly deleted above — KG_300/400 can never be
 * excluded through `setCoverage` any more, so the branch is unreachable
 * there. But a payload persisted BEFORE this ticket can still carry
 * `kg700ModeAutoFallback: true` from having once excluded a core group
 * pre-ticket. Coverage is now unconditionally migrated to include both
 * core groups (`migrateCoverage` above) — exactly the condition the
 * deleted runtime branch required before it would revert — so a legacy
 * `true` flag is now, by construction, always stale: it must revert here,
 * once, at load, or the project stays stuck computing KG 700 via
 * `hoaiAho` forever with no way to self-correct, silently inflating the
 * printed EUR total by KG 700's own AHO/HOAI-vs-vereinfacht delta.
 */
function migrateKg700Mode(persisted: {
  kg700Mode: Store['kg700Mode']
  kg700ModeAutoFallback?: boolean
}): { kg700Mode: Store['kg700Mode']; kg700ModeAutoFallback: boolean } {
  if (persisted.kg700ModeAutoFallback === true) {
    return { kg700Mode: 'vereinfacht', kg700ModeAutoFallback: false }
  }
  return { kg700Mode: persisted.kg700Mode, kg700ModeAutoFallback: false }
}

/**
 * #16 Part 8: `storeyStructure` shrank from a per-kind UG/EG/OG/SG
 * breakdown to a single count. A payload persisted before this change
 * already passed `isBuildingReview` (the validator accepts either shape,
 * `buildingReview.ts`) — this is where the accepted-but-legacy shape
 * actually gets normalized into the one the rest of the app now expects,
 * the same two-step "accept then normalize" split `migrateCoverage` above
 * uses for its own legacy `unknown` value.
 */
function migrateBuildingReview(review: BuildingReview): BuildingReview {
  const fact = review.facts.storeyStructure
  return {
    ...review,
    facts: {
      ...review.facts,
      storeyStructure: {
        extracted: {
          ...fact.extracted,
          value: migrateStoreyStructureFactValue(fact.extracted.value),
        },
        override: fact.override ? {
          ...fact.override,
          // Already validated as Decimal-or-legacy-shape, so this can only
          // be null if construction is somehow bypassed — the same
          // impossible-in-practice fallback pattern as elsewhere in this
          // file (clear-and-fallback, never a thrown migration).
          value: migrateStoreyStructureFactValue(fact.override.value) ?? new Decimal(0),
        } : null,
      },
    },
  }
}
// The top-level demo projection exists before an Opportunity Option does and
// keeps the released reference calculation available to diagnostics/tests.
// It is never used as the default for a newly created Option.
const ESTABLISHED_FIXTURE_COVERAGE: Coverage = {
  ...INITIAL_COVERAGE,
  KG_300: 'included',
  KG_400: 'included',
  KG_700: 'included',
}
const COVERAGE_KEYS = Object.keys(INITIAL_COVERAGE) as Array<keyof Coverage>
const COVERAGE_STATES: CoverageState[] = [
  'included', 'excluded', 'notApplicable', 'unknown',
]
const RISK_IDS = new Set(RISK_ITEMS.map((risk) => risk.id))

const fx = demo.buildings[0]!
const fxConflict = demo.conflicts[0]!
const fxB = demo.buildings[1]!
export const PROPOSAL_PROJECT_ID = demo.project.id
const LEGACY_FIELDS_BUILDING_ID = fx.id
const CUSTOMER_CONFIRMATION_ACTOR = 'customer confirmation'

type FixtureBuilding = typeof fx

function fixtureSource(buildingId: string, field: string) {
  return {
    kind: 'document' as const,
    reference: `demo-0001.json#building:${buildingId}.${field}`,
  }
}

const UNKNOWN_SOURCE = { kind: 'unknown', reference: null } as const

function decimalFact(value: string | null, buildingId: string, field: string) {
  return fact<Decimal>(
    value === null ? null : D(value),
    value === null ? UNKNOWN_SOURCE : fixtureSource(buildingId, field),
  )
}

function fixtureReview(
  building: FixtureBuilding,
  form: BuildingInput['gebaeudeform'],
  buildingClass: BuildingInput['gebaeudeklasse']['value'],
  undergroundScope: BuildingInput['untergeschoss'],
  hasParking: boolean,
): BuildingReview {
  const id = building.id
  return {
    id,
    facts: {
      documentationName: fact(building.stableName, fixtureSource(id, 'stableName')),
      address: fact<string>(null, UNKNOWN_SOURCE),
      buildingForm: fact(form, fixtureSource(id, 'gebaeudeform')),
      buildingClass: fact(buildingClass, fixtureSource(id, 'gebaeudeklasse')),
      // The accepted calculation fixture states BGF S = 0. Its derived
      // balcony area is deliberately not reused as DIN 277 BGF S (D-26).
      bgfRAbove: decimalFact(building.areas.bgfAboveGround, id, 'areas.bgfAboveGround'),
      bgfSAbove: fact(new Decimal(0), {
        kind: 'document', reference: 'docs/audit/synthetic-fixtures.md §4',
      }),
      bgfRSAbove: decimalFact(building.areas.bgfAboveGround, id, 'areas.bgfAboveGround'),
      // The fixture supplies only the aggregate underground area. R/S
      // components remain unknown rather than being reverse-engineered.
      bgfRBelow: fact<Decimal>(null, UNKNOWN_SOURCE),
      bgfSBelow: fact<Decimal>(null, UNKNOWN_SOURCE),
      bgfRSBelow: decimalFact(building.areas.bgfBelowGround, id, 'areas.bgfBelowGround'),
      bgfRSTotal: decimalFact(building.areas.bgfRS, id, 'areas.bgfRS'),
      wfl: decimalFact(building.areas.wflWoFlV, id, 'areas.wflWoFlV'),
      nuf: decimalFact(building.areas.nufDin277, id, 'areas.nufDin277'),
      units: decimalFact(building.areas.wohneinheiten, id, 'areas.wohneinheiten'),
      // `vollgeschosse` is never trusted as a proxy for the confirmed value
      // — the fixture never seeds this fact, it is manual-entry-only.
      storeyStructure: fact<Decimal>(null, UNKNOWN_SOURCE),
    },
    engine: {
      energyStandard: 'EH_55', undergroundScope, hasParking,
      buildingClassConfirmed: false,
    },
  }
}

const INITIAL_REVIEW = fixtureReview(fx, 'MFH', 'GK_5', 'vollausbau', true)
const INITIAL_REVIEW_B = fixtureReview(fxB, 'BUERO', 'GK_4', 'kein_ug', false)

function requiredBuildingInput(review: BuildingReview): ProjectBuilding {
  const input = toBuildingInput(review)
  if (!input) throw new Error(`fixture building ${review.id} lacks a pricing input`)
  return input
}

const INITIAL_BUILDING = requiredBuildingInput(INITIAL_REVIEW)
const INITIAL_BUILDING_B = requiredBuildingInput(INITIAL_REVIEW_B)

const INITIAL_BUILDING_CONFLICTS: Record<string, BuildingConflict> = {
  [fxConflict.id]: {
    id: fxConflict.id,
    buildingId: fx.id,
    factKey: 'wfl',
    candidates: fxConflict.candidates.map((candidate) => ({
      id: `${fxConflict.id}:${candidate.origin}`,
      origin: candidate.origin as 'document' | 'customer',
      value: candidate.value,
      source: candidate.origin === 'document'
        ? {
            kind: 'document',
            reference: 'source' in candidate && typeof candidate.source === 'string'
              ? candidate.source : 'demo-0001.json',
          }
        : {
            kind: 'customer',
            reference: 'verificationEventId' in candidate
              && typeof candidate.verificationEventId === 'string'
              ? candidate.verificationEventId : 'DEMO-VE-0002',
          },
    })),
    resolutions: [],
  },
}

/**
 * Свежая конфигурация Option — одно определение и для стартового состояния
 * стора, и для каждой новой Option. Два литерала разъехались бы при первой
 * правке: новая Option начинала бы жизнь не с того состояния, с которого
 * начинает прототип.
 *
 * Объекты между конфигурациями РАЗДЕЛЯЮТСЯ (INITIAL_BUILDING и т. д.) —
 * это безопасно, потому что стор меняет их только заменой ссылки, а после
 * каждого set всё замораживается deepFreeze.
 */
function defaultOptionConfig(coverage: Coverage = INITIAL_COVERAGE): OptionConfig {
  const simplifiedAvailable = coverage.KG_300 === 'included'
    && coverage.KG_400 === 'included'
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
    buildingReviews: {
      [INITIAL_REVIEW.id]: INITIAL_REVIEW,
      [INITIAL_REVIEW_B.id]: INITIAL_REVIEW_B,
    },
    buildingConfirmation: {},
    buildingSectionConfirmations: {},
    configurationMode: 'PER_BUILDING',
    configurationModeChosen: false,
    pricingStarted: false,
    configurationVisitedChapters: {},
    sharedConfiguration: {
      choices: defaultOptionChoices(),
      provenance: Object.fromEntries(
        ALL_OPTION_GROUPS.map((group) => [
          group.id, group.documented ? 'aus Dokument' : 'Standard',
        ]),
      ),
    },
    buildingConfigState: {
      [INITIAL_BUILDING.id]: { status: 'draft', fingerprint: null, at: null },
      [INITIAL_BUILDING_B.id]: { status: 'draft', fingerprint: null, at: null },
    },
    // Умолчания приходят из каталога; там, где каталог говорит
    // `documented`, провенанс сразу «aus Dokument» со ссылкой на файл —
    // пункт 8 сценария: найденное в документах предвыбрано, но переключаемо.
    kg300: {
      [INITIAL_BUILDING.id]: defaultOptionChoices(),
      [INITIAL_BUILDING_B.id]: defaultOptionChoices(),
    },
    kg300Provenance: {
      [INITIAL_BUILDING.id]: Object.fromEntries(
        ALL_OPTION_GROUPS.map((g) => [g.id, g.documented ? 'aus Dokument' : 'Standard'])),
      [INITIAL_BUILDING_B.id]: Object.fromEntries(
        ALL_OPTION_GROUPS.map((g) => [g.id, g.documented ? 'aus Dokument' : 'Standard'])),
    },
    // D-07 rule 6: the simplified 70/22/8 split is unavailable until both
    // core groups are explicitly included. A fresh Option therefore begins
    // in the reversible automatic fallback; including both groups restores
    // the canonical simplified default without manufacturing consent.
    kg700Mode: simplifiedAvailable ? 'vereinfacht' : 'hoaiAho',
    kg700ModeAutoFallback: !simplifiedAvailable,
    coverage,
    scopeCatalogChoices: defaultScopeCatalogSelections(ALL_SCOPE_CATALOG_OPTIONS),
    scopeCatalogProvenance: Object.fromEntries(
      ALL_SCOPE_CATALOG_OPTIONS.map((o) => [o.id, 'Standard'])),
    scopeCatalogQuantities: {},
    kg800ClientRevealed: false,
    scopeBoundariesConfirmedFingerprint: null,
    fields: legacyFieldsFromReview(INITIAL_REVIEW),
    esConfirmed: false,
    regionalfaktorActive: false,
    risikoAktiv: {},
    // Configurator opens only after the separate Building & Scope step.
    // Scope Boundaries is the first semantic Configurator step.
    openConfiguratorStep: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    discountPercent: null,
    offerDraft: {
      body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser '
        + 'indikatives Angebot für das Musterprojekt Nordfeld.\n\n'
        + 'Mit freundlichen Grüßen',
      attachments: ['angebot', 'kostentreiber', 'annahmen'],
    },

    visitedConfiguratorSteps: [],
    scopeBuildingId: null,
    constructionStartDate: null,
  }
}

const FIXTURE_BUILDING_IDS = [fx.id, fxB.id] as const

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function isStringRecord(value: unknown, requiredKeys?: readonly string[]): boolean {
  if (!record(value) || !Object.values(value).every((item) => typeof item === 'string')) {
    return false
  }
  return requiredKeys ? hasOnlyKeys(value, requiredKeys) : true
}

function isChoiceSet(value: unknown): boolean {
  if (!record(value)) return false
  const groupIds = ALL_OPTION_GROUPS.map((group) => group.id)
  if (!hasOnlyKeys(value, groupIds)) return false
  return ALL_OPTION_GROUPS.every((group) => group.choices.some(
    (choice) => choice.value === value[group.id],
  ))
}

function isConfigurationState(value: unknown): value is BuildingConfigurationState {
  if (!record(value)
    || value.status !== 'draft' && value.status !== 'completed' && value.status !== 'confirmed'
    || value.fingerprint !== null && typeof value.fingerprint !== 'string'
    || value.at !== null && typeof value.at !== 'string') return false
  return value.status !== 'confirmed' || typeof value.fingerprint === 'string'
}

function isPersistedProposalConfig(value: unknown): value is PersistedProposalConfig {
  if (!record(value)
    || !Object.keys(value).every((key) => PERSISTED_CONFIG_KEYS.includes(
      key as typeof PERSISTED_CONFIG_KEYS[number],
    ))
    || !LEGACY_PERSISTED_CONFIG_KEYS.every((key) => Object.hasOwn(value, key))) return false
  if (typeof value.activeBuildingId !== 'string'
    || !FIXTURE_BUILDING_IDS.includes(value.activeBuildingId as typeof FIXTURE_BUILDING_IDS[number])) {
    return false
  }

  if (!record(value.included) || !hasOnlyKeys(value.included, FIXTURE_BUILDING_IDS)
    || !Object.values(value.included).every((item) => typeof item === 'boolean')
    || !Object.values(value.included).some(Boolean)) return false

  const reviews = value.buildingReviews
  if (!record(reviews)
    || !hasOnlyKeys(reviews, FIXTURE_BUILDING_IDS)
    || !FIXTURE_BUILDING_IDS.every((id) => {
      const review = reviews[id]
      return isBuildingReview(review)
        && review.id === id
        && toBuildingInput(review) !== null
        && (id !== LEGACY_FIELDS_BUILDING_ID || legacyFieldValues(review) !== null)
    })) return false

  if (!record(value.buildingConfirmation)
    || !Object.entries(value.buildingConfirmation).every(([id, confirmation]) =>
      FIXTURE_BUILDING_IDS.includes(id as typeof FIXTURE_BUILDING_IDS[number])
      && record(confirmation)
      && typeof confirmation.fingerprint === 'string'
      && typeof confirmation.at === 'string')) return false

  if (value.buildingSectionConfirmations !== undefined) {
    if (!record(value.buildingSectionConfirmations)) return false
    if (!Object.entries(value.buildingSectionConfirmations).every(([id, sections]) =>
      FIXTURE_BUILDING_IDS.includes(id as typeof FIXTURE_BUILDING_IDS[number])
      && record(sections)
      && Object.entries(sections).every(([section, confirmation]) =>
        BUILDING_REVIEW_SECTIONS.includes(section as BuildingReviewSection)
        && record(confirmation)
        && typeof confirmation.fingerprint === 'string'
        && typeof confirmation.at === 'string'))) return false
  }

  if (value.configurationMode !== 'SHARED' && value.configurationMode !== 'PER_BUILDING') {
    return false
  }
  if (value.configurationModeChosen !== undefined
    && typeof value.configurationModeChosen !== 'boolean') return false
  if (value.pricingStarted !== undefined
    && typeof value.pricingStarted !== 'boolean') return false
  if (value.pricingStarted === true && value.configurationModeChosen !== true) return false
  if (value.configurationVisitedChapters !== undefined) {
    if (!record(value.configurationVisitedChapters)) return false
    const allowedScopes = new Set<string>([...FIXTURE_BUILDING_IDS, SHARED_CONFIGURATION_SCOPE])
    if (!Object.entries(value.configurationVisitedChapters).every(([scope, chapters]) =>
      allowedScopes.has(scope)
      && Array.isArray(chapters)
      && chapters.every((chapter) => isConfiguratorStepId(chapter)
        || (typeof chapter === 'number'
          && Number.isInteger(chapter)
          && stepIdFromLegacyChapter(chapter) !== null)))) return false
  }
  if (!record(value.sharedConfiguration)
    || !isChoiceSet(value.sharedConfiguration.choices)
    || !isStringRecord(
      value.sharedConfiguration.provenance,
      ALL_OPTION_GROUPS.map((group) => group.id),
    )) return false

  const kg300 = value.kg300
  if (!record(kg300) || !hasOnlyKeys(kg300, FIXTURE_BUILDING_IDS)
    || !FIXTURE_BUILDING_IDS.every((id) => isChoiceSet(kg300[id]))) return false
  const kg300Provenance = value.kg300Provenance
  if (!record(kg300Provenance)
    || !hasOnlyKeys(kg300Provenance, FIXTURE_BUILDING_IDS)
    || !FIXTURE_BUILDING_IDS.every((id) => isStringRecord(
      kg300Provenance[id], ALL_OPTION_GROUPS.map((group) => group.id),
    ))) return false

  const buildingConfigState = value.buildingConfigState
  if (!record(buildingConfigState)
    || !hasOnlyKeys(buildingConfigState, FIXTURE_BUILDING_IDS)
    || !FIXTURE_BUILDING_IDS.every((id) => isConfigurationState(
      buildingConfigState[id],
    ))) return false

  if (value.kg700Mode !== 'vereinfacht' && value.kg700Mode !== 'hoaiAho') {
    return false
  }
  if (value.kg700ModeAutoFallback !== undefined
    && typeof value.kg700ModeAutoFallback !== 'boolean') return false
  if (!record(value.coverage)
    || !hasOnlyKeys(value.coverage, COVERAGE_KEYS)
    || !Object.values(value.coverage).every((item) =>
      COVERAGE_STATES.includes(item as CoverageState))) return false
  // Absent in payloads saved before KG 200/500/600/800 catalogs existed.
  const scopeCatalogOptionIds = ALL_SCOPE_CATALOG_OPTIONS.map((o) => o.id)
  if (value.scopeCatalogChoices !== undefined) {
    if (!isStringRecord(value.scopeCatalogChoices)) return false
    const choices = value.scopeCatalogChoices as Record<string, string>
    if (!Object.entries(choices).every(([id, v]) => {
      const option = ALL_SCOPE_CATALOG_OPTIONS.find((o) => o.id === id)
      return option !== undefined && option.variants.some((variant) => variant.value === v)
    })) return false
  }
  if (value.scopeCatalogProvenance !== undefined) {
    if (!isStringRecord(value.scopeCatalogProvenance)) return false
    const provenance = value.scopeCatalogProvenance as Record<string, string>
    if (!Object.keys(provenance).every((id) => scopeCatalogOptionIds.includes(id))) return false
  }
  if (value.scopeCatalogQuantities !== undefined) {
    if (!isStringRecord(value.scopeCatalogQuantities)) return false
    const quantities = value.scopeCatalogQuantities as Record<string, string>
    if (!Object.values(quantities).every((v) => !Number.isNaN(Number(v)))) return false
  }
  if (value.kg800ClientRevealed !== undefined
    && typeof value.kg800ClientRevealed !== 'boolean') return false
  if (value.scopeBoundariesConfirmedFingerprint !== undefined
    && value.scopeBoundariesConfirmedFingerprint !== null
    && typeof value.scopeBoundariesConfirmedFingerprint !== 'string') return false
  if (typeof value.esConfirmed !== 'boolean'
    || typeof value.regionalfaktorActive !== 'boolean') return false
  if (!record(value.risikoAktiv)
    || !Object.entries(value.risikoAktiv).every(([id, active]) =>
      RISK_IDS.has(id) && typeof active === 'boolean')) return false
  if (value.constructionStartDate !== undefined
    && value.constructionStartDate !== null
    && typeof value.constructionStartDate !== 'string') return false
  return value.discountPercent === null || Decimal.isDecimal(value.discountPercent)
}

const PERSISTED_PROPOSAL_PAYLOAD_KEYS = [
  'active', 'options', 'activeOptionId', 'optionSeq', 'optionConfigs',
  'buildingConflicts', 'projectParamsConfirmed', 'snapshots',
] as const

const OFFER_SNAPSHOT_KEYS = [
  'id', 'at', 'kind', 'optionId', 'optionName', 'totalExact', 'totalLabel',
  'uncertaintyPp', 'regionalfaktorActive', 'coverage', 'discountPercent',
  'journalSeqAt', 'attachmentIds',
] as const

/** VR2-08 (M-3): a restored snapshot's SHAPE is validated (an incompatible
 *  payload must not resurrect a malformed "sent" record) — its CONTENTS
 *  are trusted as-is, the same way every other restored field here is;
 *  the snapshot was already `deepFreeze`d before it was ever persisted. */
function isOfferSnapshot(value: unknown): value is OfferSnapshot {
  if (!record(value) || !hasOnlyKeys(value, OFFER_SNAPSHOT_KEYS)) return false
  return typeof value.id === 'string'
    && typeof value.at === 'string'
    && (value.kind === 'email' || value.kind === 'print')
    && (value.optionId === null || typeof value.optionId === 'string')
    && (value.optionName === null || typeof value.optionName === 'string')
    && typeof value.totalExact === 'string'
    && typeof value.totalLabel === 'string'
    && typeof value.uncertaintyPp === 'number'
    && typeof value.regionalfaktorActive === 'boolean'
    && record(value.coverage)
    && (value.discountPercent === null || typeof value.discountPercent === 'string')
    && Number.isInteger(value.journalSeqAt) && (value.journalSeqAt as number) >= 0
    && Array.isArray(value.attachmentIds)
    && value.attachmentIds.every((id) => typeof id === 'string')
}

function isPersistedProposalPayload(value: unknown): value is PersistedProposalPayload {
  if (!record(value)
    // Allowlist, not exact match (mirrors `isPersistedProposalConfig`):
    // `projectParamsConfirmed` is optional so a payload saved before this
    // fix still restores instead of being discarded whole.
    || !Object.keys(value).every((key) => (PERSISTED_PROPOSAL_PAYLOAD_KEYS as readonly string[]).includes(key))
    || !isPersistedProposalConfig(value.active)
    || !Array.isArray(value.options)
    || !Number.isInteger(value.optionSeq) || (value.optionSeq as number) < 0
    || !record(value.optionConfigs)
    || !record(value.buildingConflicts)
    || (value.projectParamsConfirmed !== undefined
      && typeof value.projectParamsConfirmed !== 'boolean')
    || (value.snapshots !== undefined
      && (!Array.isArray(value.snapshots) || !value.snapshots.every(isOfferSnapshot)))) return false

  const options = value.options
  if (!options.every((option) => record(option)
    && hasOnlyKeys(option, ['id', 'name'])
    && typeof option.id === 'string'
    && typeof option.name === 'string')) return false
  const ids = options.map((option) => (option as { id: string }).id)
  if (new Set(ids).size !== ids.length) return false
  if (value.activeOptionId !== null
    && (typeof value.activeOptionId !== 'string' || !ids.includes(value.activeOptionId))) {
    return false
  }
  const expectedStored = ids.filter((id) => id !== value.activeOptionId).sort()
  if (!hasOnlyKeys(value.optionConfigs, expectedStored)
    || !Object.values(value.optionConfigs).every(isPersistedProposalConfig)) return false
  const maxOptionSeq = ids.reduce((max, id) => {
    const match = /^OPT-(\d+)$/.exec(id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  if ((value.optionSeq as number) < maxOptionSeq) return false

  if (!Object.hasOwn(value.buildingConflicts, fxConflict.id)) return false
  return Object.entries(value.buildingConflicts).every(([id, conflict]) =>
    isBuildingConflict(conflict)
    && conflict.id === id
    && FIXTURE_BUILDING_IDS.includes(
      conflict.buildingId as typeof FIXTURE_BUILDING_IDS[number],
    ))
}

function restoredOptionConfig(
  persisted: PersistedProposalConfig,
  conflicts: Record<string, BuildingConflict>,
): OptionConfig {
  const base = defaultOptionConfig()
  // #16 Part 8: normalize each building's `storeyStructure` fact BEFORE it
  // is used anywhere below — `persisted.buildingReviews` itself may still
  // carry the accepted-but-legacy per-kind shape (`isBuildingReview` allows
  // it; nothing downstream should ever see it).
  const buildingReviews = Object.fromEntries(FIXTURE_BUILDING_IDS.map((id) =>
    [id, migrateBuildingReview(persisted.buildingReviews[id]!)],
  )) as Record<string, BuildingReview>
  const buildings = Object.fromEntries(FIXTURE_BUILDING_IDS.map((id) => {
    const building = toBuildingInput(buildingReviews[id]!)
    if (!building) throw new Error(`persisted building ${id} is incomplete`)
    return [id, building]
  })) as Record<string, ProjectBuilding>
  const configurationVisitedChapters = Object.fromEntries(
    Object.entries(persisted.configurationVisitedChapters ?? {}).map(([scope, steps]) => [
      scope,
      [...new Set(steps.flatMap((step) => {
        if (isConfiguratorStepId(step)) return [step]
        const migrated = stepIdFromLegacyChapter(step)
        return migrated ? [migrated] : []
      }))],
    ]),
  )
  return {
    ...base,
    ...persisted,
    // Overrides the raw pass-through above with the migrated facts (#16
    // Part 8) — must win over `...persisted`, not the other way round.
    buildingReviews,
    // Legacy `unknown`/`notApplicable` coverage never resurfaces as a normal
    // state after load — every decidable KG lands on the current binary
    // contract (`migrateCoverage`).
    coverage: migrateCoverage(persisted.coverage),
    // Absent in payloads saved before KG 200/500/600/800 catalogs existed.
    scopeCatalogChoices: persisted.scopeCatalogChoices ?? base.scopeCatalogChoices,
    scopeCatalogProvenance:
      persisted.scopeCatalogProvenance ?? base.scopeCatalogProvenance,
    scopeCatalogQuantities:
      persisted.scopeCatalogQuantities ?? base.scopeCatalogQuantities,
    kg800ClientRevealed: persisted.kg800ClientRevealed === true,
    configurationModeChosen: persisted.configurationModeChosen === true,
    // Overrides the raw `kg700Mode`/`kg700ModeAutoFallback` pass-through
    // above: a legacy `kg700ModeAutoFallback: true` must revert to
    // `vereinfacht` here, once, since the runtime revert path that used to
    // do this was removed (`migrateKg700Mode` above; Tech Lead rework).
    ...migrateKg700Mode(persisted),
    pricingStarted: persisted.pricingStarted === true,
    configurationVisitedChapters,
    scopeBoundariesConfirmedFingerprint:
      persisted.scopeBoundariesConfirmedFingerprint ?? null,
    buildingSectionConfirmations: persisted.buildingSectionConfirmations ?? {},
    buildings,
    fields: legacyFieldsFromReview(
      buildingReviews[LEGACY_FIELDS_BUILDING_ID]!,
      conflicts,
    ),
  }
}

function capturePersistedProposal(state: Store): PersistedProposalPayload {
  return {
    active: capturePersistedConfig(state),
    options: state.options,
    activeOptionId: state.activeOptionId,
    optionSeq: state.optionSeq,
    optionConfigs: Object.fromEntries(Object.entries(state.optionConfigs)
      .map(([id, config]) => [id, capturePersistedConfig(config)])),
    buildingConflicts: state.buildingConflicts,
    projectParamsConfirmed: state.projectParamsConfirmed,
    // VR2-08 (M-3): already-frozen values — a plain reference is enough,
    // JSON serialisation does the actual copying on the way to storage.
    snapshots: state.snapshots,
  }
}

export type Projection = {
  result: BuildingResult
  /** Task 04 (F-12): расширено с {KG_300; KG_400; KG_700?} до всех
   *  ВКЛЮЧЁННЫХ групп DIN 276 (см. `fullKgSplit` в `computeProjection`) —
   *  тип шире, чем `ReturnType<typeof kgSplit>`, потому что остальные
   *  группы — не результат движковой формулы `kgSplit()`, а сумма уже
   *  посчитанных отдельных вкладов. */
  kgSplit: { KG_300: Decimal; KG_400: Decimal }
    & Partial<Record<Exclude<CostGroup, 'KG_300' | 'KG_400'>, Decimal>>
  /** Task 04 (F-12 companion): скидка — не группа DIN 276, отдельное поле. */
  discountDriver: BuildingResult['drivers'][number] | null
  /** Ведущая ставка сегмента (D-11 v2): у Haus A единственный сегмент Wohnen. */
  leadRate: Rate
  secondaryRateBgf: Rate
  perUnit: Rate | null
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
  buildings: Record<string, ProjectBuilding>
  /** Какое здание правит конфигуратор. Не то же, что включённость. */
  activeBuildingId: string
  /**
   * Какие здания входят в предложение. Пользователь решает это ПЕРВЫМ,
   * до всех опций: невключённое здание не должно влиять ни на цену, ни
   * на метрики, ни на срок.
   */
  included: Record<string, boolean>
  /** Reviewed building facts remain separate from the pricing adapter. */
  buildingReviews: Record<string, BuildingReview>
  /** Confirmation is a fingerprint of the exact reviewed value set. */
  buildingConfirmation: Record<string, BuildingConfirmation>
  /** Section confirmations are journalled and persisted per building/Option. */
  buildingSectionConfirmations: Record<
    string,
    Partial<Record<BuildingReviewSection, BuildingSectionConfirmation>>
  >
  /** Shared and per-building choice sets coexist; mode selects the reader. */
  configurationMode: ConfigurationMode
  configurationModeChosen: boolean
  configurationModeEditing: boolean
  pricingStarted: boolean
  configurationVisitedChapters: Record<string, ConfiguratorStepId[]>
  sharedConfiguration: SharedConfiguration
  buildingConfigState: Record<string, BuildingConfigurationState>
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
  kg700ModeAutoFallback: boolean
  coverage: Coverage
  /**
   * Выбор опций каталога KG 200/500/600/800 (тикет "MAKE ALL KG 200–800
   * SELECTABLE…"). ОДИН плоский project-level bucket — эти четыре главы
   * `scope: 'project'` (как уже KG 700), поэтому SHARED/PER_BUILDING их не
   * касается: ни один из их количественных драйверов не имеет собственного
   * per-building дома в существующей модели данных (площадь участка, тонны
   * грунта, штуки стояночных мест и т. д. — величины всего комплекса).
   */
  scopeCatalogChoices: Record<string, string>
  /** Провенанс выбора каталога: `Standard` (умолчание/Annahme) или `manuell erfasst`. */
  scopeCatalogProvenance: Record<string, string>
  /**
   * Компактный ручной ввод количественных драйверов, для которых
   * авторитетное состояние проекта ещё не существует (§7 приложения:
   * не запрашивать вручную то, что можно вывести — `building_count` и
   * `dwelling_count` выводятся, остальные — явный ввод). Десятичные строки.
   */
  scopeCatalogQuantities: Record<string, string>
  /**
   * KG 800 (Finanzierung) — приватная по умолчанию (`internalOnly`, как
   * KG 700): подробная разбивка появляется в Kundenansicht только после
   * явного включения этого флага на текущей встрече. Субтотал KG 800 в
   * общей сумме показывается независимо от флага — приватна детализация,
   * не факт включения группы (см. `docs/product/output-model.md`).
   */
  kg800ClientRevealed: boolean
  /**
   * Отпечаток решений Leistungsabgrenzung (KG 200/500/600 + Energiestandard
   * + Zertifikate) на момент подтверждения, `null` — ещё не подтверждено.
   * Несовпадение с текущим отпечатком — «нужна повторная проверка»
   * (`scopeBoundariesStatus`), а не тихое сохранение устаревшего решения.
   */
  scopeBoundariesConfirmedFingerprint: string | null
  fields: { wfl: FieldState; bgfOber: FieldState; we: FieldState }
  journal: JournalEvent[]
  /** seq событий, уже отменённых: каждое отменяется не более одного раза. */
  undone: number[]
  esConfirmed: boolean
  /** One conflict registry; the legacy WFL card is a derived view of it. */
  buildingConflicts: Record<string, BuildingConflict>
  activeGrundrisse: 'V2' | 'V1'
  /** Regionalfaktor: выключен по умолчанию (D-15); состояние входит в снапшот. */
  regionalfaktorActive: boolean
  /** Применённые надбавки за риск — часть конфигурации Option (D-02). */
  risikoAktiv: Record<string, boolean>
  snapshots: OfferSnapshot[]
  /** Дельта-чип живёт 4 секунды, потом уезжает в журнал (DC-2).
   *  `percent: null` — процент от нулевой базы математически не определён
   *  (деление на ноль); Task 04 (F-30) заменяет прежнее «(+ 0,00 %)» рядом
   *  с реальной ненулевой дельтой честным отсутствием строки, а не ложным
   *  нулём (rule 30 — запрет ложной точности). */
  activeDelta: {
    label: string
    /** Task 05 rework (QA AC-2): set only where a plain `PriceChange` fully
     *  explains `label` (no extra German suffix composed in) — lets the
     *  render site call `translatedChangeLabel` instead of showing the
     *  German-only `label` untranslated in EN mode. */
    change?: PriceChange
    deltaExact: Decimal
    percent: Decimal | null
  } | null
  /**
   * Geist-Vorschau (DC-28): последствие опции у цены ДО клика. Эфемерное
   * UI-состояние вроде `openConfiguratorStep` — данные не меняются, события нет.
   * Клик фиксирует выбор обычным событием, превью гаснет.
   */
  preview: {
    label: string
    /** Task 05 rework (QA AC-2): `label` above is German-only (`changeLabel`
     *  has no i18n hook access) — the render site needs the originating
     *  change back to recover a translated form via `translatedChangeLabel`. */
    change: PriceChange
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
   * openConfiguratorStep, без события. Вход в `praesentation` гейтуется открытым
   * существенным блокером (R-07/DC-7): профиль с material-проблемой не
   * формируется, поэтому переключение — no-op, пока класс не подтверждён.
   * Плотность режимом НЕ управляется (D-16).
   */
  mode: OutputMode
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
  level: ProductLevel
  /** Выбранная Opportunity; null на корневом уровне. */
  opportunityId: string | null
  /** Подтверждены ли верхнеуровневые параметры проекта (часть гейта). */
  projectParamsConfirmed: boolean
  /**
   * Внутренняя заметка (DC-43). Принадлежит УРОВНЮ Opportunity, а не
   * Option: продавец записывает услышанное о проекте, и переключение
   * варианта не должно её менять. В клиентских профилях не существует
   * (NOTE-006) — не скрыта, а отсутствует.
   */
  noteText: string
  noteSavedAt: string | null
  noteSyncedAt: string | null
  /**
   * Скидка в процентах — часть КОНФИГУРАЦИИ Option, а не состояние экрана.
   *
   * Прежде она жила в `useState` экрана экспорта: контрол показывал итог со
   * скидкой, A4-предпросмотр и отправленный снапшот — итог без неё, печать
   * передавала `discountPercent: null`, а возврат на экран скидку стирал
   * (сплошное ревью 26, находка 14). Величина, влияющая на цену и не
   * входящая в проекцию, — это второй итог, о котором проекция не знает.
   */
  discountPercent: Decimal | null
  /**
   * Черновик письма — текст и вложения. Принадлежит Option: уход в
   * сравнение и возврат стирали написанное продавцом (находка 15).
   * Стадия доставки здесь НЕ живёт: она выводится из снапшотов и журнала,
   * иначе экран мог бы противоречить факту отправки.
   */
  offerDraft: { body: string; attachments: string[] }
  /** Созданные Opportunity Options. Сравниваются между собой (S4). */
  options: Array<{ id: string; name: string }>
  activeOptionId: string | null
  /**
   * REDESIGN R3: Option currently PRESENTED in Kundenansicht. Independent of
   * `activeOptionId` — a salesperson may show the client a different
   * (client-eligible) Option than the one open for internal preparation,
   * without that choice touching preparation state at all (mandatory
   * isolation contract, ticket 877f2c2a).
   *
   * `null` whenever no presentation-only choice has been made yet — every
   * reader resolves the actually-viewed Option via
   * `resolvedViewedOptionId(s)`, which falls back to `activeOptionId`.
   * Always reset to `null` in the exact same `set()` calls that reset
   * `mode` to `'intern'` (mode entry/exit, leaving the `option` level) —
   * never persisted (absent from `capturePersistedProposal`/
   * `PersistedProposalPayload`), so a page reload or a fresh session can
   * never resurrect a stale presentation-only selection.
   */
  viewedOptionId: string | null
  /**
   * Сколько Options было создано за жизнь Opportunity. Идентификатор берётся
   * отсюда, а не из длины списка: удалённый номер не переиспользуется, иначе
   * события журнала прежней Option начинают ссылаться на чужую (сплошное
   * ревью 26, находка 11). Отмена создания счётчик НЕ убавляет — это
   * надгробие, а не свободное место.
   */
  optionSeq: number
  /**
   * Конфигурации НЕАКТИВНЫХ Options. Плоские поля стора — рабочая копия
   * активной Option; при переключении рабочая копия убирается сюда, а
   * конфигурация открываемой Option достаётся и раскладывается в плоские
   * поля. Так каждая Option — независимый вариант (ревью № 13, дефект 1),
   * а все экраны и события продолжают работать с плоским состоянием.
   * Инвариант: ключ `activeOptionId` в этой записи отсутствует.
   */
  optionConfigs: Record<string, OptionConfig>
  /**
   * Главы, которые пользователь открывал в АКТИВНОЙ Option. Навигационное
   * состояние (как `openConfiguratorStep`) — события не создаёт; прогресс в
   * сайдбаре выводится из него и из данных, а не из номера главы.
   */
  visitedConfiguratorSteps: ConfiguratorStepId[]
  scopeBuildingId: string | null
  /** Экран конвейера. UI-состояние: CTA глав ведут к сравнению и экспорту. */
  pipelineView: PipelineView
  /**
   * Открыты ли ворота выдачи (DC-33). Состояние в сторе, а не в компоненте,
   * потому что открывают их ДВА места — переключатель режима в шапке и
   * кнопка панели, — а диалог обязан быть один: контракт называет его
   * единственной модалкой системы.
   */
  gateOpen: boolean
  /**
   * Идёт ли онбординг-тур (DC-14). Только внутреннее пространство: тур
   * объясняет работу инструмента, а не оффер, и клиенту не адресован.
   */
  tourOpen: boolean
  /** Открыт ли поток печати (DC-42): свой профиль выдачи, свой гейт. */
  printOpen: boolean
  /** Язык UI (правило 36). Отдельная настройка от языка артефактов (D-13). */
  uiLanguage: 'de' | 'en'
  /**
   * Плотность (D-16) — независимое предпочтение пользователя: режимом НЕ
   * управляется (LAYOUT-007). Рекомендация «Komfortabel перед шарингом» —
   * пункт чек-листа G6-gate, не переопределение.
   */
  density: 'komfortabel' | 'kompakt'
  openConfiguratorStep: ConfiguratorStepId
  /**
   * Construction Period (тикет KG300/400/700 + Bauzeit-Reise): vom Vertrieb
   * gewählter Baubeginn. `null` — noch keine Wahl, das ScheduleModel zeigt
   * die Fixture-Epoche unverändert. Teil von `OptionConfig` (Tech Review
   * Zyklus 2): jede Option trägt ihren eigenen Anker, damit die live
   * Projektion und die gespeicherte/verglichene Projektion derselben
   * Option immer denselben Fertigstellungstermin zeigen.
   */
  constructionStartDate: string | null

  projection: () => Projection
  editField: (key: 'wfl' | 'bgfOber' | 'we', value: Decimal, confirmed: boolean) => void
  setBuildingFactOverride: <K extends BuildingFactKey>(
    id: string, key: K, value: BuildingFactValueMap[K], actor?: string,
  ) => void
  clearBuildingFactOverride: (id: string, key: BuildingFactKey) => void
  setEnergiestandard: (v: BuildingInput['energiestandard']) => void
  /**
   * Task 02 (deep-coherence audit, F-01/F-15): Untergeschoss is a
   * per-building fact (`b.untergeschoss`), never part of
   * `sharedConfiguration.choices` — unlike KG 300/400 catalog choices,
   * which genuinely resolve to the same value for every included building
   * in SHARED mode (`choicesFor`). An explicit `buildingId` is therefore
   * required here, the same way `kind: 'kg300'` already carries one in
   * `PriceChange` — so SHARED mode can render one independently editable
   * decision block per included building instead of silently mutating
   * whichever building happens to be `activeBuildingId`.
   */
  setUntergeschoss: (buildingId: string, v: BuildingInput['untergeschoss']) => void
  setCoverage: (g: CostGroup, s: CoverageState) => void
  confirmGebaeudeklasse: () => void
  confirmEnergiestandardAnswer: () => void
  confirmScopeBoundaries: () => void
  resolveWflConflict: (candidate: 'document' | 'customer') => void
  resolveBuildingConflict: (
    conflictId: string,
    resolution: { decision: 'selectCandidate'; candidateId: string }
      | { decision: 'defer' },
  ) => void
  activateGrundrisse: (v: 'V2' | 'V1') => void
  toggleRegionalfaktor: () => void
  /**
   * Отправка. Скидка НЕ передаётся аргументом: она часть конфигурации, и
   * снапшот берёт её оттуда же, откуда её берёт расчёт. Аргумент позволял
   * отправить одно, а показать другое — и позволял печати передать `null`.
   */
  sendOffer: (kind: 'email' | 'print') => OfferSnapshot
  /** Send the explicitly viewed/presented Option without changing the
   * preparation cursor or active working Option. */
  sendOfferForOption: (kind: 'email' | 'print', optionId: string | null) => OfferSnapshot
  /** Скидка как решение: событие журнала с дельтой (D-25, CALC-007). */
  setDiscount: (percent: Decimal | null) => void
  /**
   * Construction Period: Baubeginn wählen. Verschiebt nur den Anker des
   * ScheduleModel (`engine/schedule.ts: shiftScheduleMetrics`) — keine neue
   * Dauerformel, keine Preiswirkung, daher `deltaExact: null` im Journal.
   */
  setConstructionStartDate: (iso: string | null) => void
  /**
   * Правка черновика письма. События журнала НЕ создаёт: текст письма — не
   * данные варианта и цену не меняет, а M-4 говорит о данных. Но и терять
   * его при переходе между экранами нельзя.
   */
  setOfferDraft: (patch: Partial<Store['offerDraft']>) => void
  clearDelta: () => void
  openConfiguratorStepAt: (stepId: ConfiguratorStepId) => void
  /** DC-28: показать последствие решения до клика; null — погасить. */
  previewOption: (change: PriceChange | null) => void
  /**
   * Чистая дельта решения против текущего выбора — для ВСЕГДА видимой
   * consequenceLine карточки (R-05/OPTION-009). Состояние не меняет.
   */
  optionDelta: (change: PriceChange) => Decimal
  /**
   * Будущее состояние оффера, если решение принять: сумма, её подпись и
   * разница. Один источник для плитки, призрака и клика.
   */
  outcomeOf: (change: PriceChange) => {
    delta: Decimal
    futureTotal: Displayed
    futureLabel: string
  }
  undo: () => void
  /** Есть ли действующее событие, которое отменит `undo()`. */
  canUndo: () => boolean
  /** Адресная отмена события из тоста DC-29. Умеет отменять и отмену. */
  undoEvent: (seq: number) => void
  dismissUndoToast: () => void
  /** Правило 11: вход в презентацию закрыт, пока открыт material-блокер. */
  setMode: (m: OutputMode) => void
  openOpportunity: (id: string) => void
  backToList: () => void
  /**
   * Крошка внутри Option называет проект по имени и является настоящей
   * ссылкой (F-31): выход на уровень проекта (карточка Opportunity),
   * а не в общий список. Аналог `backToList`, но остаётся на этом же
   * Opportunity — те же побочные эффекты (снятие рабочей копии Option,
   * переход режима), другой целевой уровень.
   */
  backToOpportunity: () => void
  confirmProjectParams: () => void
  /** Гейт: можно ли создавать Options (конфликты решены, параметры приняты). */
  canCreateOptions: () => boolean
  /**
   * `name` необязателен: без него авто-имя вычисляется атомарно внутри
   * действия от монотонного `optionSeq` (AUD-03/EXP-04 — см. docstring
   * реализации). Возвращает id созданной Option, либо `null`, если гейт
   * закрыт и создание не произошло.
   */
  createOption: (name?: string) => string | null
  /**
   * Переименование — только `name`; никогда не тронет уже отправленную
   * (снапшот, M-3) Option. См. docstring реализации.
   */
  renameOption: (id: string, name: string) => void
  /** Тихая запись заметки: событие журнала есть, тоста нет (правило 34). */
  saveNote: (text: string) => void
  /** Симуляция круга до CRM завершилась — отдельное событие (NOTE-003). */
  markNoteSynced: () => void
  openOption: (id: string) => void
  /**
   * REDESIGN R3: switch which Option is PRESENTED in Kundenansicht.
   * Presentation-only — never touches `activeOptionId`, `optionConfigs`,
   * or any preparation/configuration/pricing state. No-op outside
   * `mode === 'praesentation'` and for any Option that is not currently
   * client-eligible (see `eligibleClientOptions`).
   */
  setViewedOption: (id: string) => void
  setActiveBuilding: (id: string) => void
  /** Включить/исключить здание из предложения — событие журнала. */
  toggleBuildingIncluded: (id: string) => void
  confirmBuilding: (id: string) => void
  confirmBuildingSection: (
    id: string,
    section: BuildingReviewSection,
    fingerprint: string,
  ) => void
  setConfigurationMode: (mode: ConfigurationMode) => void
  confirmConfigurationMode: (mode: ConfigurationMode) => void
  beginConfigurationModeEdit: () => void
  markBuildingConfigurationCompleted: (id: string) => void
  confirmBuildingConfiguration: (id: string) => void
  confirmVisibleConfiguration: () => void
  buildingConfigurationStatus: (id: string) => BuildingConfigurationState['status']
  /** Выбрать опцию KG 300 у активного здания — событие журнала с дельтой. */
  setKg300: (groupId: string, value: string) => void
  /** Выбрать вариант опции каталога KG 200/500/600/800 — событие с дельтой. */
  setScopeCatalogChoice: (optionId: string, value: string) => void
  /** Ручной ввод количественного драйвера (§7 приложения) — десятичная строка. */
  setScopeCatalogQuantity: (key: ScopeQuantityKey, value: string) => void
  /** KG 800 · «Für dieses Meeting freigeben» — приватно по умолчанию. */
  setKg800ClientRevealed: (revealed: boolean) => void
  setKg700Mode: (m: 'vereinfacht' | 'hoaiAho') => void
  /** Применить или снять надбавку за риск (D-02) — событие с дельтой. */
  toggleRisiko: (id: string) => void
  /** Все включённые здания подтверждены — шаг вниз к сервисам открыт. */
  allBuildingsConfirmed: () => boolean
  canBeginConfiguration: () => boolean
  /** Task 03 (F-16/PD-3): Scope Boundaries confirmed + every included
   * building's visible configuration confirmed. Export/preflight gate. */
  configurationComplete: () => boolean
  setUiLanguage: (l: 'de' | 'en') => void
  setDensity: (d: 'komfortabel' | 'kompakt') => void
  /** Экран конвейера — konfigurator/vergleich/export/… (UI-состояние). */
  setPipelineView: (v: PipelineView) => void
  /** Ворота выдачи: единственный путь во внешний профиль (DC-33). */
  setGateOpen: (v: boolean) => void
  setTourOpen: (v: boolean) => void
  setPrintOpen: (v: boolean) => void
  /** Atomically align edit scope, active building and offer scope. */
  setConfigurationScope: (buildingId: string | null) => void
}

/**
 * Эфемерное состояние, привязанное к КОНТЕКСТУ, а не к приложению.
 *
 * Дельта-чип, призрак и тост отмены рассказывают о последнем действии — а
 * действие принадлежит своей Option. Прежде они были глобальными и
 * переживали переключение: открыв Option B, продавец видел дельту и тост
 * от Option A, а нажатие «Rückgängig» на нём молча не делало ничего,
 * потому что курсор отмены контекст как раз учитывает (сплошное ревью 26,
 * находка 35). Состояние утверждало одно, курсор — другое.
 */
const NO_TRANSIENT = {
  activeDelta: null,
  preview: null,
  undoToast: null,
} as const

/**
 * Событие, которое отменит следующий `undo()`. Одно определение на всех:
 * кнопка, действие и тест обязаны спрашивать один и тот же курсор, иначе
 * доступность контрола расходится с его поведением.
 */
function undoTarget(
  s: Pick<Store, 'journal' | 'undone' | 'level' | 'activeOptionId'>,
): JournalEvent | undefined {
  // Курсор видит только события СВОЕГО контекста: из Option A нельзя
  // отменить событие Option B или подготовки — их inverse-замыкания
  // писали бы в чужую рабочую копию.
  const ctx = s.level === 'option' ? s.activeOptionId : null
  return [...s.journal]
    .reverse()
    .find((e) => e.kind !== 'undo' && e.inverse && !s.undone.includes(e.seq)
      && e.optionId === ctx)
}

/**
 * Активное здание — то, которое правит конфигуратор. Отдельная функция,
 * потому что «какое здание я редактирую» и «какие здания в предложении»
 * это разные вопросы, и путать их нельзя: пользователь может смотреть
 * метрики здания, которое решил не включать.
 */
export function activeBuilding(s: Pick<Store, 'buildings' | 'activeBuildingId'>): ProjectBuilding {
  const b = s.buildings[s.activeBuildingId]
  if (!b) throw new Error(`нет здания ${s.activeBuildingId}`)
  return b
}

/**
 * The Preparation screen and the Project Card summary must describe the same
 * underlying questions/assumptions. Keep the two boolean axes here so neither
 * surface invents or manually maintains a second count.
 */
export function preparationStatuses(s: Pick<Store,
  'fields' | 'esConfirmed' | 'buildings' | 'activeBuildingId' | 'coverage'
>) {
  return {
    questions: {
      wfl: s.fields.wfl.provenance !== 'vom Kunden bestätigt',
      energyStandard: !s.esConfirmed,
    },
    assumptions: {
      buildingClass: !activeBuilding(s).gebaeudeklasse.confirmed,
      // `kg500Coverage` (KG 500 coverage decision still open) is retired:
      // the binary Scope Boundaries contract (CPO decision, 22.08.2026)
      // means no KG 200-800 coverage is ever left `unknown` any more.
    },
  }
}

export const PROJECT_PARAMS_CONFIRMATION_LABEL =
  'Projektparameter bestätigt (Gebäude, Flächen, Einheiten)'

/**
 * Project-parameter freshness is derived from the existing append-only
 * journal. It is deliberately not another persisted authority flag: the
 * confirmation boolean keeps its established gate meaning while this
 * selector adds the independent stale presentation axis required by
 * STATE-003.
 */
function projectBaselineChangeLabel(event: JournalEvent): string | null {
  if (event.kind === 'document.activated') return 'Dokumentgrundlage'
  if (event.kind === 'conflict.resolved') {
    // Deferring an open conflict is an audit event but changes no baseline
    // value, so it cannot invalidate the confirmation.
    if (event.label.includes('zurückgestellt')) return null
    return event.label.includes('WFL')
      ? 'WFL nach WoFlV'
      : 'Strittige Angaben'
  }
  if (event.kind !== 'value.edited' && event.kind !== 'value.confirmed') return null
  if (event.label === PROJECT_PARAMS_CONFIRMATION_LABEL) return null
  if (event.label.includes('WFL') || event.label.includes('Wohnfläche')) {
    return 'WFL nach WoFlV'
  }
  if (event.label.includes('NUF')) return 'NUF nach DIN 277'
  if (event.label.includes('BGF')) return 'BGF'
  if (event.label.includes('Wohneinheiten')) return 'Wohneinheiten'
  return null
}

export function projectBaselineChangesSinceConfirmation(s: Pick<Store,
  'projectParamsConfirmed' | 'journal' | 'undone'
>): string[] {
  if (!s.projectParamsConfirmed) return []
  const lastConfirmation = [...s.journal].reverse().find((event) =>
    event.kind === 'value.confirmed'
    && event.label === PROJECT_PARAMS_CONFIRMATION_LABEL
    && !s.undone.includes(event.seq))
  if (!lastConfirmation) return []

  return [...new Set(s.journal
    .filter((event) => event.seq > lastConfirmation.seq && !s.undone.includes(event.seq))
    .map(projectBaselineChangeLabel)
    .filter((label): label is string => label !== null))]
}

/** Здания, входящие в предложение, в порядке фикстуры. */
function includedBuildings(
  s: Pick<Store, 'buildings' | 'included'>,
): BuildingInput[] {
  return Object.values(s.buildings).filter((b) => s.included[b.id])
}

export function includedBuildingIds(
  s: Pick<Store, 'buildings' | 'included'>,
): string[] {
  return Object.values(s.buildings).filter((building) => s.included[building.id])
    .map((building) => building.id)
}

/** The only authoritative read path for per-building option choices. */
export function choicesFor(
  s: Pick<Store, 'configurationMode' | 'sharedConfiguration' | 'kg300' | 'included'>,
  buildingId: string,
): Record<string, string> {
  return s.configurationMode === 'SHARED' && s.included[buildingId]
    ? s.sharedConfiguration.choices
    : s.kg300[buildingId] ?? {}
}

export function choiceProvenanceFor(
  s: Pick<Store, 'configurationMode' | 'sharedConfiguration'
    | 'kg300Provenance' | 'included'>,
  buildingId: string,
): Record<string, string> {
  return s.configurationMode === 'SHARED' && s.included[buildingId]
    ? s.sharedConfiguration.provenance
    : s.kg300Provenance[buildingId] ?? {}
}

function configurationFingerprint(
  s: Pick<Store, 'configurationMode' | 'sharedConfiguration' | 'kg300' | 'included'
    | 'buildingReviews' | 'buildingConflicts'>,
  buildingId: string,
): string {
  const reviewIds = (s.configurationMode === 'SHARED'
    ? Object.keys(s.included).filter((id) => s.included[id])
    : [buildingId]).sort()
  return JSON.stringify({
    mode: s.configurationMode,
    choices: Object.entries(choicesFor(s, buildingId))
      .sort(([a], [b]) => a.localeCompare(b)),
    buildingReviews: reviewIds.map((id) => [
      id,
      s.buildingReviews[id]
        ? buildingFingerprint(s.buildingReviews[id]!, s.buildingConflicts)
        : null,
    ]),
  })
}

export function configurationStatusFor(
  s: Pick<Store, 'configurationMode' | 'sharedConfiguration' | 'kg300'
    | 'included' | 'buildingConfigState' | 'buildingReviews' | 'buildingConflicts'>,
  buildingId: string,
): BuildingConfigurationState['status'] {
  const state = s.buildingConfigState[buildingId]
  if (!state) return 'draft'
  if (state.status !== 'confirmed') return state.status
  return state.fingerprint === configurationFingerprint(s, buildingId)
    ? 'confirmed' : 'completed'
}

function configurationScopeKey(
  s: Pick<Store, 'configurationMode'>,
  buildingId: string,
): string {
  return s.configurationMode === 'SHARED' ? SHARED_CONFIGURATION_SCOPE : buildingId
}

export function configurationDisplayStatusFor(
  s: Pick<Store, 'configurationMode' | 'configurationModeChosen'
    | 'configurationVisitedChapters' | 'sharedConfiguration' | 'kg300'
    | 'included' | 'buildingConfigState' | 'buildingReviews'
    | 'buildingConfirmation' | 'buildingConflicts' | 'coverage'>,
  buildingId: string,
): ConfigurationDisplayStatus {
  if (!s.configurationModeChosen) return 'open'
  const stored = s.buildingConfigState[buildingId]
  if (!buildingConfirmed(s, buildingId)) {
    return stored?.status === 'confirmed' ? 'recheck' : 'open'
  }
  const status = configurationStatusFor(s, buildingId)
  if (stored?.status === 'confirmed' && status !== 'confirmed') return 'recheck'
  if (status === 'confirmed') return 'confirmed'
  const visited = s.configurationVisitedChapters[configurationScopeKey(s, buildingId)] ?? []
  const requiredSteps = activeBuildingConfiguratorSteps({
    coverage: s.coverage,
    mode: 'intern',
  })
  return status === 'completed'
    || requiredSteps.every((step) => visited.includes(step.id))
    ? 'ready'
    : 'open'
}

/**
 * Отпечаток решений Leistungsabgrenzung, относящихся к её собственному
 * контракту: все шесть решаемых групп затрат (KG 200/300/400/500/600/700),
 * Energiestandard
 * и Zertifikate (`qng`/`dgnb`, engine/options.ts `ZERT_GROUPS`). Используется
 * только для сравнения «изменилось ли что-то с момента подтверждения», не
 * для хранения самого решения.
 */
function scopeBoundariesFingerprint(
  s: Pick<Store, 'coverage' | 'buildings' | 'included' | 'configurationMode'
    | 'sharedConfiguration' | 'kg300'>,
): string {
  // Tech Review P1 (ticket d21f8d48): must NOT key off `activeBuildingId`.
  // Leistungsabgrenzung has no building tabs (it is not in
  // semantic building steps) and Energiestandard/Zertifikate can differ
  // per building in PER_BUILDING mode — confirming while looking at Haus A
  // must still invalidate if Haus B's requirement changes, or switching
  // back to Haus A would silently read "confirmed" again (evadable by
  // navigation). Cover every included building, independent of which one
  // is active.
  const ids = includedBuildingIds(s).sort()
  // Tech Review P2: derive from ZERT_GROUPS instead of a second hardcoded
  // ['qng','dgnb'] list — a future certification group could not otherwise
  // silently escape invalidation.
  const zertIds = ZERT_GROUPS.map((g) => g.id)
  return JSON.stringify({
    coverage: SCOPE_BOUNDARIES_DECIDABLE_GROUPS.map((g) => s.coverage[g]),
    energiestandard: ids.map((id) => [id, s.buildings[id]?.energiestandard]),
    zertifikate: ids.map((id) => {
      const choices = choicesFor(s, id)
      return [id, zertIds.map((cid) => choices[cid] ?? null)]
    }),
  })
}

/**
 * `open` — noch nicht bestätigt; `confirmed` — Bestätigung deckt den
 * aktuellen Stand; `recheck` — eine gespeicherte Bestätigung existiert, aber
 * KG 200/300/400/500/600/700, Energiestandard oder Zertifikate haben sich seither
 * geändert (Ticket-Anforderung #6: Änderung invalidiert, statt still zu
 * bestehen).
 */
export function scopeBoundariesStatus(
  s: Pick<Store, 'coverage' | 'buildings' | 'configurationMode'
    | 'sharedConfiguration' | 'kg300' | 'included' | 'scopeBoundariesConfirmedFingerprint'>,
): 'open' | 'confirmed' | 'recheck' {
  if (s.scopeBoundariesConfirmedFingerprint === null) return 'open'
  return s.scopeBoundariesConfirmedFingerprint === scopeBoundariesFingerprint(s)
    ? 'confirmed'
    : 'recheck'
}

export function configurationComplete(
  s: Pick<Store, 'buildings' | 'included' | 'configurationMode'
    | 'configurationModeChosen' | 'configurationVisitedChapters'
    | 'sharedConfiguration' | 'kg300' | 'buildingConfigState'
    | 'buildingReviews' | 'buildingConfirmation' | 'buildingConflicts'
    | 'coverage' | 'scopeBoundariesConfirmedFingerprint'>,
): boolean {
  const ids = includedBuildingIds(s)
  return s.configurationModeChosen && ids.length > 0
    && scopeBoundariesStatus(s) === 'confirmed'
    && ids.every((id) => configurationDisplayStatusFor(s, id) === 'confirmed')
}

export function buildingConfirmed(
  s: Pick<Store, 'buildingReviews' | 'buildingConfirmation' | 'buildingConflicts'>,
  buildingId: string,
): boolean {
  return reviewIsBuildingConfirmed(
    s.buildingReviews[buildingId],
    s.buildingConfirmation[buildingId],
    s.buildingConflicts,
  )
}

export function canBeginConfiguration(
  s: Pick<Store, 'buildings' | 'included' | 'buildingReviews'
    | 'buildingConfirmation' | 'buildingConflicts'>,
): boolean {
  const ids = includedBuildingIds(s)
  return ids.length > 0 && ids.every((id) => buildingConfirmed(s, id))
}

/**
 * The Building & Scope gate is fail-closed for every other Option view.
 * This keeps an empty or unconfirmed proposal away from pricing surfaces
 * without inventing a zero-price projection.
 */
export function pipelineViewForBuildingGate(
  s: Pick<Store, 'buildings' | 'included' | 'buildingReviews'
    | 'buildingConfirmation' | 'buildingConflicts'>,
  view: PipelineView,
): PipelineView {
  return view !== 'buildingScope' && !canBeginConfiguration(s)
    ? 'buildingScope'
    : view
}

/** Existing S2 consumers read this view; conflict authority stays in the registry. */
export function wflConflict(
  s: Pick<Store, 'buildingConflicts'>,
): WflConflict {
  const conflict = s.buildingConflicts[fxConflict.id]
  if (!conflict) throw new Error(`missing fixture conflict ${fxConflict.id}`)
  const state = deriveConflictState(conflict)
  const fallback = conflict.candidates.find((candidate) => candidate.origin === 'document')
    ?? conflict.candidates[0]
  const selectedId = state.selectedCandidateId ?? fallback?.id ?? null
  return {
    id: conflict.id,
    state: state.status,
    candidates: conflict.candidates.map((candidate) => ({
      origin: candidate.origin === 'customer' ? 'customer' : 'document',
      value: candidate.value,
      selectionStatus: candidate.id === selectedId ? 'authoritative' : 'alternative',
      source: candidate.source.reference ?? 'unknown source',
      capturedAt: (() => {
        const fixtureCandidate = fxConflict.candidates.find(
          (item) => item.origin === candidate.origin,
        )
        return fixtureCandidate && 'capturedAt' in fixtureCandidate
          && typeof fixtureCandidate.capturedAt === 'string'
          ? fixtureCandidate.capturedAt : null
      })(),
    })),
  }
}

/**
 * Здания, попадающие в ПОКАЗ. Охват сужает показ, но не состав оффера:
 * здание, выведенное из охвата, остаётся проданным — просто на него
 * сейчас не смотрят (DC-46, правило 38).
 */
function scopedBuildings(
  s: Pick<Store, 'buildings' | 'included' | 'scopeBuildingId'>,
): BuildingInput[] {
  const all = includedBuildings(s)
  if (!s.scopeBuildingId) return all
  const one = all.filter((b) => b.id === s.scopeBuildingId)
  // Охват на исключённое здание — не ошибка, а устаревшее предпочтение:
  // показываем комплекс, а не пустоту.
  return one.length ? one : all
}

/**
 * Проекция ЛЮБОЙ Option — активной или убранной в хранилище. Сравнение
 * и экспорт считают из созданных Options, а не из зашитых сценариев
 * (ревью № 13, дефект 1). Null — Option не существует.
 */
export function projectionForOption(
  s: Pick<Store, 'activeOptionId' | 'optionConfigs' | keyof OptionConfig>,
  optionId: string,
): Projection | null {
  const cfg = configForOption(s, optionId)
  // Comparison is always option-to-option at offer scope. A Configurator
  // building selection is a reading/editing lens, never the sold scope.
  return cfg ? projectProjection(cfg) : null
}

/** Конфигурация любой Option: активная — с плоских полей, прочие — из хранилища. */
export function configForOption(
  s: Pick<Store, 'activeOptionId' | 'optionConfigs' | keyof OptionConfig>,
  optionId: string,
): OptionConfig | null {
  return optionId === s.activeOptionId
    ? captureConfig(s)
    : s.optionConfigs[optionId] ?? null
}

/**
 * REDESIGN R3: Options eligible for client presentation — the SAME PD-3
 * readiness signal that already gates Export for that Option
 * (`canBeginConfiguration && configurationComplete`), evaluated per Option
 * from its own stored/live config. Deliberately not a new eligibility
 * model: "client-presentable" and "ready to export" are one question, not
 * two. `buildingConflicts` is Opportunity-level (shared by every Option,
 * not part of `OptionConfig`), so it always comes from the live store even
 * when reading another Option's stored config — the exact pattern
 * `openOption` already uses for the same reason.
 */
export function eligibleClientOptions(
  s: Pick<Store, 'options' | 'activeOptionId' | 'optionConfigs' | 'buildingConflicts'
    | keyof OptionConfig>,
): Array<{ id: string; name: string }> {
  return s.options.filter((o) => {
    const cfg = configForOption(s, o.id)
    if (!cfg) return false
    const withConflicts = { ...cfg, buildingConflicts: s.buildingConflicts }
    return canBeginConfiguration(withConflicts) && configurationComplete(withConflicts)
  })
}

/**
 * The Option actually shown to the client right now: the presentation-only
 * choice if one has been made, otherwise the internally active Option (R3
 * "initial presented Option" continuity rule). The one place every
 * presentation-facing reader resolves which Option to render — never read
 * `viewedOptionId` directly for display purposes.
 */
export function resolvedViewedOptionId(
  s: Pick<Store, 'viewedOptionId' | 'activeOptionId'>,
): string | null {
  return s.viewedOptionId ?? s.activeOptionId
}

/**
 * Whether a semantic workflow step is done, derived from active Option state.
 * У глав с обязательным подтверждением или решением done наступает от
 * данных; у каталожных шагов, где умолчание — валидный выбор, done — это
 * след посещения.
 */
export function configuratorStepDone(
  s: Pick<Store, 'buildings' | 'included' | 'buildingReviews'
    | 'buildingConfirmation' | 'buildingConflicts' | 'coverage'
    | 'visitedConfiguratorSteps'
    | 'configurationMode' | 'configurationModeChosen'
    | 'configurationVisitedChapters' | 'activeBuildingId'>,
  stepId: ConfiguratorStepId,
): boolean {
  if (isBuildingScopedConfiguratorStep(stepId)) {
    if (!s.configurationModeChosen) return false
    return (s.configurationVisitedChapters[
      configurationScopeKey(s, s.activeBuildingId)
    ] ?? []).includes(stepId)
  }
  // Binary contract (CPO decision, 22.08.2026): no decidable KG coverage is
  // ever `unknown`, so Leistungsabgrenzung no longer needs its own extra
  // "no open coverage decision" gate on top of `visited` — visiting it is
  // the whole contract, same as every other project-scoped step.
  return s.visitedConfiguratorSteps.includes(stepId)
}

/** Площадь S здания — выведенная величина (D-22), помечена на экране. */
function bgfSOf(id: string): Decimal {
  const b = (derivedFx.buildings as Record<string, { bgfSAboveGround?: { value: string | null } }>)[id]
  const v = b?.bgfSAboveGround?.value
  return v ? new Decimal(v) : new Decimal(0)
}

/**
 * Денежное решение продавца — **один тип на все места, где оно принимается**.
 *
 * Прежде превью знало два вида (энергостандарт и подвал), а остальные
 * решения считали последствие сами: плитка охвата умножала ставку на площадь
 * АКТИВНОГО здания, тогда как включение применяется ко всем включённым, и
 * обещание `+230.000{NNBSP}€` кончалось изменением на `+368.000{NNBSP}€`
 * (сплошное ревью 26, находка 13). Второй калькулятор последствия
 * расходится с первым молча — и расходился.
 */
export type PriceChange =
  | { kind: 'energiestandard'; value: BuildingInput['energiestandard'] }
  // Task 02: carries an explicit `buildingId`, same reason `kind: 'kg300'`
  // already does — Untergeschoss is always per-building, never shared.
  | { kind: 'untergeschoss'; buildingId: string; value: BuildingInput['untergeschoss'] }
  | { kind: 'coverage'; group: CostGroup; value: CoverageState }
  | { kind: 'risiko'; id: string; active: boolean }
  | { kind: 'kg700'; value: 'vereinfacht' | 'hoaiAho' }
  | { kind: 'kg300'; buildingId: string; groupId: string; value: string }
  | { kind: 'scopeCatalog'; optionId: string; value: string }

/**
 * Состояние, каким оно СТАНЕТ, если решение принять. Гипотеза, а не запись:
 * из неё считают и превью, и плитка, и проверка того, что клик дал ровно
 * обещанное.
 */
function withChange<S extends Parameters<typeof computeProjection>[0] & {
  activeBuildingId: string
}>(s: S, change: PriceChange): S {
  switch (change.kind) {
    case 'energiestandard':
      return {
        ...s,
        buildings: {
          ...s.buildings,
          [s.activeBuildingId]: {
            ...s.buildings[s.activeBuildingId]!, energiestandard: change.value,
          },
        },
      }
    case 'untergeschoss':
      return {
        ...s,
        buildings: {
          ...s.buildings,
          [change.buildingId]: {
            ...s.buildings[change.buildingId]!, untergeschoss: change.value,
          },
        },
      }
    case 'coverage':
      return { ...s, coverage: { ...s.coverage, [change.group]: change.value } }
    case 'risiko':
      return {
        ...s,
        risikoAktiv: { ...s.risikoAktiv, [change.id]: change.active },
      }
    case 'kg700':
      return { ...s, kg700Mode: change.value }
    case 'kg300':
      if (s.configurationMode === 'SHARED' && s.included[change.buildingId]) {
        return {
          ...s,
          sharedConfiguration: {
            ...s.sharedConfiguration,
            choices: {
              ...s.sharedConfiguration.choices,
              [change.groupId]: change.value,
            },
          },
        }
      }
      return {
        ...s,
        kg300: {
          ...s.kg300,
          [change.buildingId]: {
            ...(s.kg300[change.buildingId] ?? {}), [change.groupId]: change.value,
          },
        },
      }
    case 'scopeCatalog':
      return {
        ...s,
        scopeCatalogChoices: {
          ...s.scopeCatalogChoices, [change.optionId]: change.value,
        },
      }
  }
}

/**
 * SIDEBAR 02 (backlog 41b8ab39, SB-06): which of the option-level scope-
 * catalog groups (KG 200/500/600) are `included` but genuinely have no
 * price basis — as opposed to a genuinely DECIDED zero-rate variant (e.g.
 * "Baufreies Grundstück"), which is a real, calculated €0 and not a gap
 * (rule 16 forbids the latter, not the former). This reads only
 * already-computed inputs (the selected variant's own catalog `rate`, the
 * same `quantityOf` resolver `computeProjection` already uses to price
 * these groups) and applies no formula/rate/rounding of its own — it is a
 * completeness CLASSIFICATION of an existing decision, feeding the same
 * `IncompleteReason` mechanism `deriveCompleteness` (engine) already
 * produces per building. Deliberately NOT added to `src/engine/**`: the
 * task's own DONE CONDITION requires zero changes there.
 */
function unpricedScopeCatalogGroups(
  groups: readonly ('KG_200' | 'KG_500' | 'KG_600')[],
  isActive: (g: 'KG_200' | 'KG_500' | 'KG_600') => boolean,
  groupSum: (label: string) => Decimal,
  quantityOf: (key: ScopeQuantityKey) => Decimal | null,
  selections: Record<string, string>,
): CostGroup[] {
  const out: CostGroup[] = []
  for (const g of groups) {
    if (!isActive(g) || !groupSum(g.replace('_', ' ')).isZero()) continue
    const wouldHavePriced = ALL_SCOPE_CATALOG_OPTIONS
      .filter((o) => o.kg === g)
      .some((o) => {
        const value = selections[o.id] ?? o.default
        const variant = o.variants.find((v) => v.value === value)
        if (!variant || new Decimal(variant.rate).isZero()) return false
        if (o.basis.kind !== 'perQuantity') return false
        const key = variant.quantityKeyOverride ?? o.basis.quantityKey
        const qty = quantityOf(key)
        return qty === null || qty.lte(0)
      })
    if (wouldHavePriced) out.push(g)
  }
  return out
}

function computeProjection(
  s: Pick<Store, 'buildings' | 'activeBuildingId' | 'included' | 'coverage'
    | 'fields' | 'esConfirmed' | 'regionalfaktorActive' | 'kg300' | 'kg700Mode'
    | 'risikoAktiv' | 'scopeBuildingId' | 'discountPercent'
    | 'configurationMode' | 'sharedConfiguration' | 'buildingReviews'
    | 'constructionStartDate' | 'scopeCatalogChoices' | 'scopeCatalogQuantities'>,
): Projection {
  const CATALOG = withRegionalFactor(s.regionalfaktorActive)
  const list = scopedBuildings(s)
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
  const rawOptDrivers = list.flatMap((b, i) => [
    ...optionDrivers(b, choicesFor(s, b.id), bgfSOf(b.id)),
    // Группы затрат, включённые решением пользователя: они не входят в
    // базовую ставку, поэтому включение ДОБАВЛЯЕТ, а не перераспределяет.
    // База для групп с объявленной долей — блок Bauwerk ЭТОГО здания.
    ...coverageDrivers(
      b, s.coverage as unknown as Record<string, string>, bgfSOf(b.id),
      perBuilding[i]!.bauwerk, CATALOG.kgShares,
    ),
  ].map((d) => ({ ...d, key: list.length > 1 ? `${list[i]!.id}:${d.key}` : d.key })))
  const rawBaseDrivers = perBuilding.flatMap((r, i) =>
    r.drivers.map((d) => ({
      ...d,
      key: list.length > 1 ? `${list[i]!.id}:${d.key}` : d.key,
    })))
  // Блок Bauwerk — это KG 300 + 400 + UG и ТОЛЬКО они. Прежде всё
  // складывалось в один `bauwerkSum`, и включение KG 500 увеличивало базу
  // KG 700, базу сплита и базу надбавок за риск: группа затрат вне блока
  // повышала цену того, что от блока считается (сплошное ревью 26,
  // находки 9 и 20). Место вклада объявляется его создателем полем `block`,
  // а не выводится здесь из позиции: у надбавки за риск база названа
  // `KG 320`, и по позиции она от вклада внутри блока неотличима.
  // Только `'included'` активирует группу — тот же критерий, что уже
  // применяют `coverageDrivers` для KG 500/600 (`options.ts`). Строгое
  // равенство, а не `!== 'excluded'`: иначе неопределённое `'unknown'`
  // (обязательный дефолт AC22 — решение продавца ещё не принято) молча
  // считалось бы включённым, ровно тот дефект, который правило и должно
  // было исключить.
  const coreActive = (group: 'KG_300' | 'KG_400' | 'KG_700') =>
    s.coverage[group] === 'included'
  const simplifiedScope = s.kg700Mode === 'vereinfacht'
    && coreActive('KG_300') && coreActive('KG_400') && coreActive('KG_700')
  const baseDrivers = rawBaseDrivers
  const optDrivers = rawOptDrivers
  // Полный, ещё не скорректированный блок Bauwerk — база для решения о
  // включении KG 300/400 (Product Decision, тикет e2dac9b5, 20.08.2026):
  // при исключении одной из групп оставшаяся получает свою реальную,
  // выверенную по Referenzprojekt R-02 долю (`echt`, 76,2/23,8 — decisions.md
  // D-07), а не переизобретённое число. Доля берётся ВСЕГДА от `rawBauwerk`,
  // никогда от уже скорректированного `bauwerkBlock` — иначе повторное
  // применение сплита к уже уменьшенной сумме тихо родило бы ненулевую
  // «KG 300», хотя группа исключена (тот же класс дефекта, что отклонённая
  // находка F1).
  const rawBauwerk = sumOfBlock([...baseDrivers, ...optDrivers], 'bauwerk')
  const kg300Active = coreActive('KG_300')
  const kg400Active = coreActive('KG_400')
  if (!kg300Active || !kg400Active) {
    const rawSplit = kgSplit(rawBauwerk, CATALOG.kgShares, 'echt')
    if (!kg300Active && !rawSplit.KG_300.isZero()) {
      const unresolved = s.coverage.KG_300 === 'unknown'
      optDrivers.push({
        key: 'kg300_excluded_adjustment',
        origin: unresolved ? 'scope' as const : 'decision' as const,
        block: 'bauwerk' as const,
        exact: rawSplit.KG_300.negated(),
        label: unresolved
          ? 'KG 300 · Baukonstruktionen (noch offen)'
          : 'KG 300 · Baukonstruktionen (ausgeschlossen)',
        scopeRefs: ['KG 300'],
        basis: {
          kind: 'factor',
          appliedTo: rawBauwerk,
          factor: CATALOG.kgShares.echt.KG_300.div(100).negated(),
        },
      })
    }
    if (!kg400Active && !rawSplit.KG_400.isZero()) {
      const unresolved = s.coverage.KG_400 === 'unknown'
      optDrivers.push({
        key: 'kg400_excluded_adjustment',
        origin: unresolved ? 'scope' as const : 'decision' as const,
        block: 'bauwerk' as const,
        exact: rawSplit.KG_400.negated(),
        label: unresolved
          ? 'KG 400 · Technische Anlagen (noch offen)'
          : 'KG 400 · Technische Anlagen (ausgeschlossen)',
        scopeRefs: ['KG 400'],
        basis: {
          kind: 'factor',
          appliedTo: rawBauwerk,
          factor: CATALOG.kgShares.echt.KG_400.div(100).negated(),
        },
      })
    }
  }
  // `bauwerkBlock` пересчитан ПОСЛЕ добавления корректировок — драйверы
  // сами объявляют своё место (`block`), поэтому сумма реконструируется
  // заново, а не патчится точечно (сплошное ревью 26, находки 9/20).
  const bauwerkBlock = sumOfBlock([...baseDrivers, ...optDrivers], 'bauwerk')
  // KG 700 в режиме HOAI+AHO — СОБСТВЕННАЯ позиция 12 % от блока
  // (`calculation-spec` §1, решение D-27). В режиме `vereinfacht` тотал не
  // меняется: доли 70/22/8 перераспределяют уже посчитанное. Прежде ставка
  // была 8,7 % и сама попадала в базу сплита — та же позиция проводилась
  // дважды.
  const kg700 = !simplifiedScope && coreActive('KG_700')
    ? bauwerkBlock.mul(CATALOG.kgShares.kg700EchtPercentOfBauwerk).div(100)
    : new Decimal(0)
  if (!kg700.isZero()) {
    optDrivers.push({
      key: 'kg700_hoai_aho',
      origin: 'decision' as const,
      block: 'separatePosition' as const,
      exact: kg700,
      label: 'KG 700 · Baunebenkosten nach HOAI und AHO',
      scopeRefs: ['KG 700'],
      basis: {
        kind: 'factor',
        appliedTo: bauwerkBlock,
        factor: CATALOG.kgShares.kg700EchtPercentOfBauwerk.div(100),
      },
    })
  }
  // Надбавки за риск — аддитивно после блока Bauwerk (calculation-spec §2:
  // «модификаторы мультипликативны до регионального фактора, надбавки и
  // скидка — аддитивны после»). База каждой — своя группа затрат, поэтому
  // считается от разбиения блока, а не от итога: включив надбавку в базу
  // распределения, мы растворили бы её в KG 300 — она перестала бы быть
  // отдельной строкой и вдобавок увеличила бы собственную базу.
  // Когда одна из групп исключена, `bauwerkBlock` уже равен доле
  // ОСТАВШЕЙСЯ группы (см. корректировку выше) — второй вызов `kgSplit`
  // на этой уже уменьшенной сумме заново применил бы 76,2/23,8 к чужому
  // основанию и вернул бы фантомную ненулевую долю для исключённой группы.
  // Прямое присвоение — единственный корректный путь: у оставшейся группы
  // весь блок, у исключённой — ноль.
  const effectiveKgSplit = (!kg300Active || !kg400Active)
    ? {
        KG_300: kg300Active ? bauwerkBlock : new Decimal(0),
        KG_400: kg400Active ? bauwerkBlock : new Decimal(0),
      }
    : kgSplit(
        bauwerkBlock,
        CATALOG.kgShares,
        simplifiedScope ? 'vereinfacht' : 'echt',
      )
  const kg300Exact = effectiveKgSplit.KG_300
  const kg400Exact = effectiveKgSplit.KG_400
  for (const risk of RISK_ITEMS) {
    if (!s.risikoAktiv[risk.id]) continue
    const d = riskDriver(risk, kg300Exact)
    if (d) optDrivers.push(d)
  }

  // KG 200 / 500 / 600 / 800 (тикет "MAKE ALL KG 200–800 SELECTABLE…").
  // Количественные драйверы: выведенные (здания/квартиры — из уже
  // авторитетного состояния проекта) либо явный компактный ввод (§7
  // приложения). KG600-07 (Kunst am Bau) — единственный, чья база не
  // количество, а уже посчитанная доля KG 300+400.
  const derivedDwellingCount = list.every((building) =>
    effectiveFactValue(s.buildingReviews[building.id]!.facts.units) !== null)
    ? list.reduce((sum, building) =>
      sum.plus(effectiveFactValue(s.buildingReviews[building.id]!.facts.units)!),
      new Decimal(0))
    : null
  const scopeQuantityOf = (key: ScopeQuantityKey): Decimal | null => {
    if (key === 'building_count') return new Decimal(list.length)
    if (key === 'dwelling_count') return derivedDwellingCount
    const raw = s.scopeCatalogQuantities[key]
    if (raw === undefined || raw === '') return null
    try {
      const parsed = new Decimal(raw)
      return parsed.isFinite() ? parsed : null
    } catch {
      return null
    }
  }
  const kg300Plus400 = kg300Exact.plus(kg400Exact)
  // Строгое равенство `=== 'included'`, тот же критерий, что `coreActive`
  // выше: `excluded`/дефолт никогда не считаются включёнными молча.
  const scopeCatalogActive = (group: 'KG_200' | 'KG_500' | 'KG_600' | 'KG_800') =>
    s.coverage[group] === 'included'
  if (scopeCatalogActive('KG_200')) {
    optDrivers.push(...scopeCatalogDrivers(
      KG200_CATALOG_OPTIONS, s.scopeCatalogChoices, scopeQuantityOf, kg300Plus400,
    ))
  }
  if (scopeCatalogActive('KG_500')) {
    optDrivers.push(...scopeCatalogDrivers(
      KG500_CATALOG_OPTIONS, s.scopeCatalogChoices, scopeQuantityOf, kg300Plus400,
    ))
  }
  if (scopeCatalogActive('KG_600')) {
    optDrivers.push(...scopeCatalogDrivers(
      KG600_CATALOG_OPTIONS, s.scopeCatalogChoices, scopeQuantityOf, kg300Plus400,
    ))
  }

  const separateSum = sumOfBlock([...baseDrivers, ...optDrivers], 'separatePosition')
  const surchargeSum = sumOfBlock([...baseDrivers, ...optDrivers], 'surcharge')
  // KG 800 (Finanzierung) — PRE_FINANCING_COST — это ИМЕННО сумма ДО этой
  // строки (KG 100–700, без самой KG 800): нерекурсивность обеспечена
  // порядком вычислений, а не проверкой постфактум (calculate.ts, docblock
  // `calculateKg800`).
  const preFinancingCost = bauwerkBlock.plus(separateSum).plus(surchargeSum)
  if (scopeCatalogActive('KG_800') && preFinancingCost.gt(0)) {
    const kg800Params = readKg800Params(s.scopeCatalogChoices, scopeQuantityOf)
    const kg800 = calculateKg800(preFinancingCost, kg800Params)
    const kg800Driver = (key: string, exact: Decimal, labelDe: string) => {
      if (exact.isZero()) return
      optDrivers.push({
        key: `kg800_${key}`, origin: 'decision' as const,
        block: 'separatePosition' as const, exact, label: labelDe,
        scopeRefs: ['KG 800'], basis: null,
      })
    }
    kg800Driver('debtInterest', kg800.debtInterest, 'KG 800 · Fremdkapitalzinsen')
    kg800Driver('financingFee', kg800.financingFee, 'KG 800 · Finanzierungsnebenkosten')
    kg800Driver('commitmentInterest', kg800.commitmentInterest, 'KG 800 · Bereitstellungszinsen')
    kg800Driver('guaranteeCost', kg800.guaranteeCost, 'KG 800 · Bürgschaftskosten')
    kg800Driver('equityInterest', kg800.equityInterest, 'KG 800 · Kalkulatorischer Eigenkapitalzins')
  }

  // Пересчитано ПОСЛЕ KG 800 — те же имена, теперь уже с её вкладом (если
  // включена), для итога и скидки ниже.
  const separateSumFinal = sumOfBlock([...baseDrivers, ...optDrivers], 'separatePosition')
  const surchargeSumFinal = sumOfBlock([...baseDrivers, ...optDrivers], 'surcharge')
  // Скидка — «после всего» (`calculation-spec` §2) и от ТОЧНОГО итога, не от
  // показанного (CALC-007). Она вклад, а не постобработка: иначе итог и
  // Kostentreiber расходятся, и снапшот хранит цену, которой не была на
  // экране (сплошное ревью 26, находка 14).
  const beforeDiscount = bauwerkBlock.plus(separateSumFinal).plus(surchargeSumFinal)
  if (s.discountPercent && !s.discountPercent.isZero()) {
    const factor = s.discountPercent.div(100)
    optDrivers.push({
      key: 'rabatt',
      origin: 'decision' as const,
      block: 'discount' as const,
      exact: beforeDiscount.mul(factor).negated(),
      label: `Rabatt ${formatDE(s.discountPercent, 1)}${NNBSP}%`,
      scopeRefs: [],
      basis: { kind: 'factor', appliedTo: beforeDiscount, factor },
    })
  }
  const allDrivers = [...baseDrivers, ...optDrivers]
  // Task 04 (F-12, rule 32): the DIN 276 rail table only ever printed
  // KG_300/400/700 — KG 200/500/600/800 amounts already exist as separate
  // `Driver` contributions (each tagged `scopeRefs: ['KG 200']` etc. by
  // `scopeCatalogDrivers`/the KG 700+800 pushes above), only never summed
  // for display. No new formula: this reads the SAME drivers already
  // rendered in Kostentreiber, grouped by their own existing scope tag.
  // KG_300/KG_400 stay exactly `effectiveKgSplit`'s PURE structural split —
  // deliberately NOT inflated by risk surcharges here: `splitKg300()`
  // (the KG 300 subgroup drilldown, both in this file's `riskDriver` calls
  // above and in OfferPanel's expand-row) reads this same value and
  // re-derives subgroup shares from it by FIXED percentage; folding a
  // surcharge in first would silently re-distribute that surcharge across
  // every subgroup by structural weight instead of leaving it on the one
  // subgroup it actually applies to (regression caught by
  // scenario.dom.test.tsx's ground-risk assertion during this task).
  // Active risk surcharges instead get their own reconciliation row,
  // exactly like the discount driver below (`discountDriver`).
  const kgGroupSum = (label: string) => allDrivers
    .filter((d) => d.scopeRefs.includes(label))
    .reduce((sum, d) => sum.plus(d.exact), new Decimal(0))
  const scopeCatalogGroupSplit: Partial<Record<CostGroup, Decimal>> = {
    ...(scopeCatalogActive('KG_200') ? { KG_200: kgGroupSum('KG 200') } : {}),
    ...(scopeCatalogActive('KG_500') ? { KG_500: kgGroupSum('KG 500') } : {}),
    ...(scopeCatalogActive('KG_600') ? { KG_600: kgGroupSum('KG 600') } : {}),
    ...(scopeCatalogActive('KG_800') ? { KG_800: kgGroupSum('KG 800') } : {}),
  }
  const fullKgSplit: { KG_300: Decimal; KG_400: Decimal }
    & Partial<Record<Exclude<CostGroup, 'KG_300' | 'KG_400'>, Decimal>> = {
    ...effectiveKgSplit,
    // `echt`-Modus: KG 700 ist bei `kgSplit()` (Engine) gar nicht Teil des
    // Bauwerk-Blocks mehr, sondern eine eigene `separatePosition` (Zeile
    // 2018 ff. oben, `scopeRefs: ['KG 700']`) — vorher fehlte sie im
    // Tisch aus demselben Grund wie KG 200/500/600/800. `vereinfacht`-
    // Modus liefert KG_700 bereits über `effectiveKgSplit`; die beiden
    // Quellen schließen sich gegenseitig aus (nie beide gleichzeitig
    // ungleich null), daher ist die Addition kollisionsfrei.
    KG_700: (effectiveKgSplit.KG_700 ?? new Decimal(0)).plus(kgGroupSum('KG 700')),
    ...scopeCatalogGroupSplit,
  }
  const total = beforeDiscount.plus(sumOfBlock(allDrivers, 'discount'))
  // SIDEBAR 02 (backlog 41b8ab39, SB-06/AC-3/AC-4): an included scope-
  // catalog group with no price basis (KG 500 typically) is an
  // option-level completeness fact `calculateBuilding`/`deriveCompleteness`
  // (engine, per-building) cannot see — it is computed once for the whole
  // option here, not per building. Folded into the SAME `completeness`/
  // `incompleteReasons` fields those already populate, not a second
  // mechanism.
  const unpricedScopeGroups = unpricedScopeCatalogGroups(
    ['KG_200', 'KG_500', 'KG_600'], scopeCatalogActive, kgGroupSum,
    scopeQuantityOf, s.scopeCatalogChoices,
  )
  const completeness = perBuilding.every((r) => r.completeness === 'complete')
    && unpricedScopeGroups.length === 0
    ? 'complete' : 'incomplete'
  const narrowedBuilding = s.scopeBuildingId && list.length === 1
    && list[0]!.id === s.scopeBuildingId
    ? effectiveFactValue(
        s.buildingReviews[list[0]!.id]!.facts.documentationName,
      ) ?? list[0]!.id
    : null
  const declaredPricingScope = narrowedBuilding
    ? `Grundleistung All3 · ${narrowedBuilding}`
    : 'Grundleistung All3'
  const result: BuildingResult = {
    buildingId: list.map((b) => b.id).join('+'),
    drivers: allDrivers,
    bauwerk: bauwerkBlock,
    total: present(total),
    totalLabel: calculationTotalLabel(completeness, declaredPricingScope),
    completeness,
    incompleteReasons: [
      ...perBuilding.flatMap((r) => r.incompleteReasons),
      ...(unpricedScopeGroups.length
        ? [{ code: 'includedUnpriced' as const, groups: unpricedScopeGroups }]
        : []),
    ],
  }
  const noUg = perBuilding.reduce((a, _, i) => a.plus(
    calculateBuilding({ ...list[i]!, untergeschoss: 'kein_ug' }, CATALOG, s.coverage).total.exact,
  ), new Decimal(0))
  const ug = total.minus(noUg)

  // Construction Period (тикет): Baubeginn сдвигает ScheduleModel как единое
  // целое — этот герой срока и ScheduleGantt в главе 8 обязаны показывать
  // ОДНУ и ту же Fertigstellung (Tech Review P1: до этой правки герой читал
  // фиксированный литерал и не двигался вместе с диаграммой). Якорь —
  // ТА ЖЕ дата начала `project.planning`, что использует ChapterTermine.
  //
  // Task 02 (deep-coherence audit, F-17): тот литерал был окном ИМЕННО
  // Haus A (`2027-04-04`–`2027-11-19`) — совпадение, не расчёт: герой
  // никогда не читал фикстуру нескольких зданий, только `list[0]`. Фикстура
  // уже содержит настоящее окно Haus B (`building:DEMO-B-B.execution`,
  // до 2028-01-04 — позже Haus A), поэтому у комплекса из двух зданий
  // прежний герой называл не позднейшее завершение, а завершение первого
  // здания в списке. Rule 39 (Bauzeit = max(start+dauer), никогда сумма
  // и никогда одно случайно выбранное здание): взять реальное окно КАЖДОГО
  // включённого здания из фикстуры и выбрать здание с самым поздним концом.
  const executionAnchor = demo.schedule.metrics
    .find((m) => m.metricKey === 'project.planning')!.startDate
  const buildingExecutionWindows = list.map((b) => {
    const fixture = demo.schedule.metrics
      .find((m) => m.metricKey === `building:${b.id}.execution`)!
    return { buildingId: b.id, startDate: fixture.startDate, endDate: fixture.endDate }
  })
  const latestExecution = buildingExecutionWindows.reduce((latest, current) => (
    current.endDate > latest.endDate ? current : latest
  ))
  const shiftedExecution = (s.constructionStartDate
    ? shiftScheduleMetrics(
      [latestExecution],
      executionAnchor,
      s.constructionStartDate,
    )
    : [latestExecution])[0]!
  const duration = presentDuration(
    {
      metricKey: `building:${latestExecution.buildingId}.execution`,
      kind: 'buildingExecution',
      startDate: shiftedExecution.startDate,
      endDate: shiftedExecution.endDate,
      durationBasis: 'calendarDay',
    },
    modelDuration(
      list.reduce((a, b) => a.plus(bgfAboveGround(b)), new Decimal(0)),
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

  const reviewedValues = <K extends 'wfl' | 'nuf' | 'units'>(key: K) =>
    list.map((building) => effectiveFactValue(s.buildingReviews[building.id]!.facts[key]))
  const completeSum = (values: Array<Decimal | null>): Decimal | null =>
    values.every((value): value is Decimal => value !== null)
      ? values.reduce((sum, value) => sum.plus(value), new Decimal(0))
      : null
  const wfl = completeSum(reviewedValues('wfl'))
  const nuf = completeSum(reviewedValues('nuf'))
  const units = completeSum(reviewedValues('units'))
  const bgf = list.reduce((sum, building) => sum.plus(bgfAboveGround(building)), new Decimal(0))
  // A complex uses BGF above ground as its client-facing leading metric
  // regardless of which optional segment areas happen to be populated.
  // Data availability must never turn Σ WFL into a complex denominator
  // (rule 39 / DATA-001). A single-building scope keeps its applicable
  // segment denominator.
  const leadRate = list.length > 1
    ? rate(total, bgf, 'BGF_ABOVE_GROUND')
    : wfl !== null
      ? rate(total, wfl, 'WFL_WOFLV')
      : nuf !== null
        ? rate(total, nuf, 'NUF_DIN277')
        : rate(total, bgf, 'BGF_ABOVE_GROUND')

  return {
    result,
    kgSplit: fullKgSplit,
    // Task 04 (F-30 companion): the discount driver already exists
    // (`key: 'rabatt'`, `block: 'discount'`) but had no row anywhere in
    // the rail's KG breakdown — without it, an active discount would make
    // the KG rows sum to `beforeDiscount`, not the printed `total` (rule
    // 32). Exposed as its own field rather than folded into a KG group:
    // a discount is not a DIN 276 cost group.
    discountDriver: allDrivers.find((d) => d.key === 'rabatt') ?? null,
    leadRate,
    secondaryRateBgf: rate(total, bgf, 'BGF_ABOVE_GROUND'),
    perUnit: units === null ? null : rate(total, units, 'WOHNEINHEITEN'),
    duration,
    aboveGround: present(noUg),
    belowGround: present(ug),
    uncertaintyPp: 22 - narrowing,
  }
}

/** The complete sold option, independent of the Configurator reading lens. */
export function projectProjection(
  s: Pick<Store, keyof OptionConfig>,
): Projection {
  // `constructionStartDate` is now part of `OptionConfig` (Tech Review
  // cycle 2: a global un-scoped field made the live projection and a
  // stored/compared Option's projection disagree on the SAME Option's
  // completion date on the client-visible comparison screen). No override
  // needed here anymore — `s` already carries whichever Option's own date.
  return computeProjection({ ...s, scopeBuildingId: null })
}

/**
 * Project Card / preparation-level projection (Task 01, deep-coherence
 * audit F-05): a project's building count for the rule-39 lead-metric
 * branch is how many buildings the PROJECT has, not how many happen to be
 * `included` — inclusion is a later Building & Scope / Option-level scope
 * decision (Task 02) that does not exist yet while the salesperson is still
 * in preparation. Forcing every known building "included" for this read-only
 * projection keeps the two-building Nordfeld complex on its complex-level
 * `€/m² BGF oberirdisch` denominator instead of silently degrading to a
 * single active building's segment metric before Building & Scope has run.
 */
export function preparationProjection(
  s: Pick<Store, keyof OptionConfig>,
): Projection {
  const included = Object.fromEntries(Object.keys(s.buildings).map((id) => [id, true]))
  return computeProjection({ ...s, included, scopeBuildingId: null })
}

/**
 * Mode changes may activate a retained choice set, but changing the visible
 * OfferPanel scope is navigation. Compare like-for-like project projections
 * so a building-scoped panel never becomes a journalled price delta.
 */
function projectTotal(
  s: Pick<Store, keyof OptionConfig>,
): Decimal {
  return projectProjection(s).result.total.exact
}

/**
 * Дельта тоста DC-29: `− 476.000 €` (префикс ≈ — до знака, как в DC-12).
 *
 * F05: die Fixtur-Vorlage nannte hier zusätzlich `gegenüber DEMO-VV-0003` —
 * ein fixer Fixture-Bezeichner ohne echten Bezug zur Aktion, dazu in einem
 * UndoToast, der ungated in JEDEM Modus gemountet ist (App.tsx), also auch
 * in der Kundenansicht sichtbar werden könnte. Die Differenz bezieht sich
 * ohnehin auf den unmittelbar vorherigen Stand, nicht auf eine benannte
 * Vergleichs-Variante — der Zusatz war nie eine echte Referenz.
 */
function dc29Delta(d: Decimal): string {
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€`
}

function nextConflictSequence(conflicts: Record<string, BuildingConflict>): number {
  return Object.values(conflicts).reduce(
    (max, conflict) => conflict.resolutions.reduce(
      (inner, resolution) => Math.max(inner, resolution.sequenceNumber), max,
    ),
    0,
  ) + 1
}

function withConflictResolution(
  conflicts: Record<string, BuildingConflict>,
  conflictId: string,
  decision: ConflictResolution['decision'],
  selectedCandidateId: string | null,
  actor: string,
  reason: string,
): Record<string, BuildingConflict> {
  const conflict = conflicts[conflictId]
  if (!conflict) throw new Error(`unknown building conflict ${conflictId}`)
  const resolution: ConflictResolution = {
    sequenceNumber: nextConflictSequence(conflicts),
    decision,
    selectedCandidateId,
    actor,
    at: new Date().toISOString(),
    reason,
  }
  return {
    ...conflicts,
    [conflictId]: appendConflictResolution(conflict, resolution),
  }
}

function reviewedBuildingPatch(
  state: Store,
  buildingId: string,
  review: BuildingReview,
): Pick<Store, 'buildingReviews' | 'buildings' | 'buildingConflicts' | 'fields'> {
  const building = toBuildingInput(review)
  if (!building) {
    throw new Error(`reviewed building ${buildingId} lacks required pricing facts`)
  }
  const buildingConflicts = synchronizeDerivedConflicts(
    state.buildingConflicts, review,
  )
  return {
    buildingReviews: { ...state.buildingReviews, [buildingId]: review },
    buildings: { ...state.buildings, [buildingId]: building },
    buildingConflicts,
    fields: buildingId === LEGACY_FIELDS_BUILDING_ID
      ? legacyFieldsFromReview(review, buildingConflicts)
      : state.fields,
  }
}

function sourceProvenance(review: BuildingReview, key: BuildingFactKey): Provenance {
  const override = review.facts[key].override
  if (override) {
    return override.actor === CUSTOMER_CONFIRMATION_ACTOR
      ? 'vom Kunden bestätigt'
      : 'manuell erfasst'
  }
  const source = review.facts[key].extracted.source.kind
  if (source === 'customer') return 'vom Kunden bestätigt'
  if (source === 'derived') return 'abgeleitet'
  return 'aus Dokument'
}

function combinedProvenance(
  review: BuildingReview,
  keys: BuildingFactKey[],
): Provenance {
  const provenances = keys.map((key) => sourceProvenance(review, key))
  if (provenances.includes('manuell erfasst')) return 'manuell erfasst'
  if (provenances.includes('vom Kunden bestätigt')) return 'vom Kunden bestätigt'
  if (provenances.includes('abgeleitet')) return 'abgeleitet'
  return 'aus Dokument'
}

/**
 * Compatibility projection for the pre-building-aware screens, which are
 * explicitly labelled Haus A. Values and provenance are derived from the
 * reviewed record; this slice is never an independent writable source.
 */
function legacyFieldValues(review: BuildingReview): {
  input: ReviewedBuildingInput
  wfl: Decimal
  units: Decimal
} | null {
  const input = toBuildingInput(review)
  const wfl = effectiveFactValue(review.facts.wfl)
  const units = effectiveFactValue(review.facts.units)
  return input === null || wfl === null || units === null
    ? null
    : { input, wfl, units }
}

function legacyFieldsFromReview(
  review: BuildingReview,
  conflicts: Record<string, BuildingConflict> = {},
): Store['fields'] {
  const values = legacyFieldValues(review)
  if (!values) {
    throw new Error(`legacy fields building ${review.id} lacks required facts`)
  }
  const { input, wfl, units } = values
  const wflSource = sourceProvenance(review, 'wfl')
  const wflConfirmedByConflict = Object.values(conflicts).some((conflict) =>
    conflict.buildingId === review.id
    && conflict.factKey === 'wfl'
    && deriveConflictState(conflict).status === 'resolved')
  return {
    wfl: {
      value: wfl,
      provenance: wflSource !== 'manuell erfasst' && wflConfirmedByConflict
        ? 'vom Kunden bestätigt'
        : wflSource,
    },
    bgfOber: {
      value: input.bgfRAbove.plus(input.bgfSAbove),
      provenance: combinedProvenance(review, ['bgfRAbove', 'bgfSAbove']),
    },
    we: { value: units, provenance: sourceProvenance(review, 'units') },
  }
}

const BUILDING_FACT_LABELS: Record<BuildingFactKey, string> = {
  documentationName: 'Dokumentationsname',
  address: 'Adresse',
  buildingForm: 'Gebäudeform',
  buildingClass: 'Gebäudeklasse',
  bgfRAbove: 'BGF R oberirdisch',
  bgfSAbove: 'BGF S oberirdisch',
  bgfRSAbove: 'BGF R+S oberirdisch',
  bgfRBelow: 'BGF R unterirdisch',
  bgfSBelow: 'BGF S unterirdisch',
  bgfRSBelow: 'BGF R+S unterirdisch',
  bgfRSTotal: 'BGF R+S gesamt',
  wfl: 'WFL nach WoFlV',
  nuf: 'NUF nach DIN 277',
  units: 'Wohneinheiten',
  storeyStructure: 'Anzahl Geschosse',
}

function sameFactValue(left: unknown, right: unknown): boolean {
  if (Decimal.isDecimal(left) && Decimal.isDecimal(right)) return left.equals(right)
  return JSON.stringify(left) === JSON.stringify(right)
}

function updateOptionalRecord<T>(
  source: Record<string, T>,
  id: string,
  value: T | undefined,
): Record<string, T> {
  const next = { ...source }
  if (value === undefined) delete next[id]
  else next[id] = value
  return next
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
   *
   * AUD-01 (EXP-01/AC-3, live Playwright finding on the exact candidate):
   * `preview` used to be cleared by CONVENTION — each commit action set it
   * itself, usually alongside `activeDelta` — not by CONTRACT. Only 3 of
   * the ~9 commit actions actually did (`setEnergiestandard`,
   * `setUntergeschoss`, `setCoverage`); `setKg300`, `setScopeCatalogChoice`,
   * `toggleRisiko`, `toggleRegionalfaktor`, `setKg700Mode` and
   * `commitReviewChange` never touched it — confirmed live: fixing a KG300
   * facade choice left its own pre-fixation hover preview standing on top
   * of the just-committed number, exactly AC-3's reported symptom. `apply`
   * is the one place EVERY journaled commit already passes through (its
   * own docstring above: "единственная дверь") — clearing `preview` here
   * makes "fixation gates the ghost" a structural invariant instead of a
   * per-action habit that new/existing actions can silently skip.
   */
  const apply = (
    e: Omit<JournalEvent, 'seq' | 'at' | 'optionId'>,
    optionIdOverride?: string | null,
  ) => {
    const { journal, level, activeOptionId } = get()
    const seq = journal.length + 1
    // Контекст события: внутри конвейера — активная Option, на уровнях
    // списка и карточки — `null`. Создание Option происходит ДО входа в
    // конвейер и потому остаётся событием уровня Opportunity.
    const optionId = optionIdOverride !== undefined
      ? optionIdOverride
      : level === 'option' ? activeOptionId : null
    set({
      journal: [...journal, { ...e, seq, at: new Date().toISOString(), optionId }],
      undoToast: e.inverse
        ? {
            seq,
            statusText: e.label,
            deltaText: e.deltaExact ? dc29Delta(e.deltaExact) : null,
          }
        : null,
      preview: null,
    })
  }

  const commitReviewChange = (change: {
    buildingId: string
    previousReview: BuildingReview
    nextReview: BuildingReview
    label: string
    kind: 'value.edited' | 'value.confirmed'
  }) => {
    const write = (review: BuildingReview) => set((state) =>
      reviewedBuildingPatch(state, change.buildingId, review))

    const before = get().projection().result.total.exact
    write(change.nextReview)
    const after = get().projection().result.total.exact
    const delta = after.minus(before)
    apply({
      kind: change.kind,
      label: change.label,
      deltaExact: delta.isZero() ? null : delta,
      inverse: () => write(change.previousReview),
      forward: () => write(change.nextReview),
    })
    if (!delta.isZero()) {
      set({
        activeDelta: {
          label: change.label,
          deltaExact: delta,
          percent: before.isZero() ? null : delta.div(before).mul(100),
        },
      })
    }
  }

  return {
    // Конфигурация активной Option — плоские поля из единой фабрики.
    // До создания первой Option эти же поля обслуживают уровень
    // Opportunity (анализ, параметры): рабочая копия существует всегда.
    ...defaultOptionConfig(ESTABLISHED_FIXTURE_COVERAGE),
    // Preparation-only UI state is deliberately outside OptionConfig.
    configurationModeEditing: false,
    optionConfigs: {},
    pipelineView: 'buildingScope',
    gateOpen: false,
    tourOpen: false,
    printOpen: false,
    journal: [],
    undone: [],
    buildingConflicts: INITIAL_BUILDING_CONFLICTS,
    activeGrundrisse: 'V2',
    snapshots: [],
    activeDelta: null,
    preview: null,
    undoToast: null,
    mode: 'intern',
    constructionStartDate: null,
    level: 'liste',
    opportunityId: null,
    projectParamsConfirmed: false,
    noteText: '',
    noteSavedAt: null,
    noteSyncedAt: null,
    options: [],
    activeOptionId: null,
    viewedOptionId: null,
    optionSeq: 0,
    discountPercent: null,
    offerDraft: {
      body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser '
        + 'indikatives Angebot für das Musterprojekt Nordfeld.\n\n'
        + 'Mit freundlichen Grüßen',
      attachments: ['angebot', 'kostentreiber', 'annahmen'],
    },

    uiLanguage: 'de',
    density: 'komfortabel',

    projection: () => computeProjection(get()),

    setBuildingFactOverride: (id, key, value, actor = 'sales-user') => {
      const s = get()
      const previousReview = s.buildingReviews[id]
      if (!previousReview) return
      if (sameFactValue(effectiveFactValue(previousReview.facts[key]), value)
        && previousReview.facts[key].override !== null) return

      let nextReview = withFactOverride(
        previousReview, key, value, actor, new Date().toISOString(),
      )
      if (key === 'buildingClass') {
        nextReview = withEngineState(nextReview, { buildingClassConfirmed: false })
      }
      commitReviewChange({
        buildingId: id,
        previousReview,
        nextReview,
        kind: 'value.edited',
        // QA (Rebuild Configurator Workspace, AC-11): resolve the building's
        // display name, never the raw fixture id, in this journal label.
        label: `Gebäudedaten ${effectiveFactValue(previousReview.facts.documentationName) ?? id} · ${BUILDING_FACT_LABELS[key]} manuell bearbeitet`,
      })
    },

    clearBuildingFactOverride: (id, key) => {
      const s = get()
      const previousReview = s.buildingReviews[id]
      if (!previousReview?.facts[key].override) return
      let nextReview = withoutFactOverride(previousReview, key)
      if (key === 'buildingClass') {
        nextReview = withEngineState(nextReview, { buildingClassConfirmed: false })
      }
      commitReviewChange({
        buildingId: id,
        previousReview,
        nextReview,
        kind: 'value.edited',
        // QA (Rebuild Configurator Workspace, AC-11): resolve the building's
        // display name, never the raw fixture id, in this journal label.
        label: `Gebäudedaten ${effectiveFactValue(previousReview.facts.documentationName) ?? id} · ${BUILDING_FACT_LABELS[key]} auf Quellenwert zurückgesetzt`,
      })
    },

    editField: (key, value, confirmed) => {
      const s = get()
      const previousLegacy = s.fields[key]
      // These compatibility controls are explicitly labelled Haus A. Their
      // target must therefore be stable even if another building is active
      // in the building-aware workflow.
      const target = LEGACY_FIELDS_BUILDING_ID
      const previousReview = s.buildingReviews[target]
      if (!previousReview) return
      const at = new Date().toISOString()
      const actor = confirmed ? CUSTOMER_CONFIRMATION_ACTOR : 'sales-user'
      let nextReview = previousReview
      if (key === 'wfl') {
        nextReview = withFactOverride(previousReview, 'wfl', value, actor, at)
      } else if (key === 'we') {
        nextReview = withFactOverride(previousReview, 'units', value, actor, at)
      } else {
        const sArea = effectiveFactValue(previousReview.facts.bgfSAbove)
        if (sArea === null) throw new Error(`building ${target} has unknown BGF S above`)
        nextReview = withFactOverride(
          previousReview, 'bgfRAbove', value, actor, at,
        )
        nextReview = withFactOverride(
          nextReview, 'bgfRSAbove', value.plus(sArea), actor, at,
        )
      }
      commitReviewChange({
        buildingId: target,
        previousReview,
        nextReview,
        kind: confirmed ? 'value.confirmed' : 'value.edited',
        label: `${LABELS[key]} ${previousLegacy.value.toFixed(2)} → ${value.toFixed(2)}`,
      })
    },

    setEnergiestandard: (v) => {
      const s = get()
      const id = s.activeBuildingId
      // Ticket d21f8d48 Tech Review P0: Energiestandard is a Scope
      // Boundaries requirement ("configured once for all selected
      // buildings" in SHARED mode) — it must fan out exactly like
      // `setKg300` does, not silently stay per-building. Applying it to one
      // building while Leistungsabgrenzung shows "gilt für den gesamten
      // Komplex" produced a mixed-standard aggregate the screen never
      // revealed.
      const shared = s.configurationMode === 'SHARED' && s.included[id]
      const appliesTo = shared ? includedBuildingIds(s) : [id]
      const prevByBuilding = new Map(
        appliesTo.map((bid) => [bid, s.buildings[bid]?.energiestandard]),
      )
      if (appliesTo.every((bid) => prevByBuilding.get(bid) === v)) return
      const before = s.projection().result.total.exact
      const write = (values: ReadonlyMap<string, BuildingInput['energiestandard'] | undefined>) =>
        set((state) => {
          let next = state
          for (const [bid, value] of values) {
            if (value === undefined) continue
            const review = next.buildingReviews[bid]
            if (!review) continue
            next = {
              ...next,
              ...reviewedBuildingPatch(next, bid, withEngineState(review, { energyStandard: value })),
            }
          }
          return next
        })
      write(new Map(appliesTo.map((bid) => [bid, v])))
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      // QA (Rebuild Configurator Workspace, AC-11): this label used to join
      // raw building ids directly, leaking e.g. "DEMO-B-B" into the Undo
      // toast in every mode, including true Kundenansicht. Resolve display
      // names the same way every other building-facing label in this file
      // already does (e.g. line ~3548) — never a raw id, in any mode.
      const buildingNames = appliesTo.map((bid) => {
        const review = s.buildingReviews[bid]
        return review ? effectiveFactValue(review.facts.documentationName) ?? bid : bid
      }).join(', ')
      const label = `Energiestandard → ${v.replace('_', ' ')} (${buildingNames})`
      apply({
        kind: 'option.selected',
        label,
        deltaExact: delta,
        inverse: () => write(prevByBuilding),
        forward: () => write(new Map(appliesTo.map((bid) => [bid, v]))),
      })
      // Клик — фиксация: превью гаснет, начинается волна дельты (DC-28).
      set({
        preview: null,
        activeDelta: { label, deltaExact: delta, percent: before.isZero() ? null : delta.div(before).mul(100) },
      })
    },

    setUntergeschoss: (buildingId, v) => {
      const s = get()
      const b = s.buildings[buildingId]
      if (!b || b.untergeschoss === v) return
      const before = s.projection().result.total.exact
      const prev = b.untergeschoss
      const id = buildingId
      const write = (value: BuildingInput['untergeschoss']) => set((state) => {
        const review = state.buildingReviews[id]
        if (!review) return {}
        return reviewedBuildingPatch(
          state, id, withEngineState(review, { undergroundScope: value }),
        )
      })
      write(v)
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      // Task 02: name the building in the journal label whenever more than
      // one is included — the same reason the driver `key` prefix below
      // already carries a buildingId once `list.length > 1` (rule 25/F-01).
      const review = s.buildingReviews[id]
      const docName = review ? effectiveFactValue(review.facts.documentationName) ?? id : id
      const buildingLabel = includedBuildingIds(s).length > 1 ? ` (${docName})` : ''
      apply({
        kind: 'option.selected',
        label: `Untergeschoss ${LABEL_UG[prev]} → ${LABEL_UG[v]}${buildingLabel}`,
        deltaExact: delta,
        inverse: () => write(prev),
        forward: () => write(v),
      })
      set({
        preview: null,
        activeDelta: {
          label: `Untergeschoss ${LABEL_UG[v]}`,
          deltaExact: delta,
          percent: before.isZero() ? null : delta.div(before).mul(100),
        },
      })
    },

    setCoverage: (g, st) => {
      // KG 300/400/700 are mandatory (never excludable) and KG 800 is no
      // longer a supported Scope Boundaries decision (always excluded) —
      // see `MANDATORY_COST_GROUPS`/`migrateCoverage`. Scope Boundaries no
      // longer renders an interactive control for any of the four, but
      // this guards the single state-mutation entry point directly so no
      // other caller (legacy path, test, future regression) can violate
      // the invariant either.
      if ((MANDATORY_COST_GROUPS as readonly CostGroup[]).includes(g) || g === 'KG_800') return
      const s = get()
      const prev = s.coverage[g]
      if (prev === st) return
      const before = projectTotal(s)
      const prevKg700Mode = s.kg700Mode
      const prevAutoFallback = s.kg700ModeAutoFallback
      // D-07 rule 6's auto-fallback (`vereinfacht` -> `hoaiAho` when a core
      // group is excluded, and back) is now unreachable through this
      // action: the guard above already excludes KG_300/400/700 from `g`,
      // so this call can only ever be for KG_200/500/600, which never
      // affects `kg700Mode`. `nextKg700Mode`/`nextAutoFallback` are kept as
      // named passthroughs (not inlined) only so `write`/the journal
      // entry below stay identical for every group.
      const nextKg700Mode = s.kg700Mode
      const nextAutoFallback = prevAutoFallback
      const write = (
        value: CoverageState,
        kg700Mode: Store['kg700Mode'],
        autoFallback: boolean,
      ) => set((current) => {
        const coverage = { ...current.coverage, [g]: value }
        return {
          coverage,
          kg700Mode,
          kg700ModeAutoFallback: autoFallback,
          // A future conditional KG step can disappear immediately after a
          // Scope Boundaries decision. Keep the page on the nearest active
          // semantic step; App.tsx then moves focus to that step's h1.
          openConfiguratorStep: nearestActiveConfiguratorStep({
            coverage,
            mode: current.mode,
          }, current.openConfiguratorStep),
        }
      })
      write(st, nextKg700Mode, nextAutoFallback)
      const after = projectTotal(get())
      const delta = after.minus(before)
      const fallbackApplied = nextKg700Mode === 'hoaiAho' && nextKg700Mode !== prevKg700Mode
      const fallbackReverted = nextKg700Mode === 'vereinfacht' && nextKg700Mode !== prevKg700Mode
      // Label text below names the KG group with a space ('KG 300', not the
      // internal 'KG_300' coverage key) and, on an actual kg700Mode
      // transition, names the group whose CALCULATION METHOD is switching
      // (KG 700 — never the KG 300/400 group just toggled, which is a
      // different group entirely; scope-boundaries.dom.test.tsx pins
      // 'automatisch' in this journal label, so that word is kept verbatim).
      const groupLabel = g.replace('_', ' ')
      apply({
        kind: 'coverage.changed',
        label: `${groupLabel} ${COVERAGE_LABEL[prev]} → ${COVERAGE_LABEL[st]}`
          + (fallbackApplied ? ' · KG 700: Berechnung automatisch auf HOAI/AHO umgestellt' : '')
          + (fallbackReverted ? ' · KG 700: Berechnung automatisch zurück auf All3-Verfahren umgestellt' : ''),
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(prev, prevKg700Mode, prevAutoFallback),
        forward: () => write(st, nextKg700Mode, nextAutoFallback),
      })
      set({
        preview: null,
        activeDelta: {
          // SIDEBAR 02 (backlog 41b8ab39, SB-25): the fallback-applied chip
          // used to read `${groupLabel} ausgeschlossen · KG 700 · Baunebenkosten
          // nach HOAI und AHO` — naming KG 700 as if it were a second,
          // independent decision rather than an automatic side-effect of the
          // one decision the seller actually made. The permanent journal
          // event a few lines above already phrases the SAME fact correctly
          // ("… · KG 700: Berechnung automatisch auf HOAI/AHO umgestellt");
          // this now reuses that exact, already-correct phrasing instead of
          // a second, ambiguous one for the same cascade. Per-row
          // attribution of the resulting amounts (KG 400/KG 700/KG 800) is
          // carried by OfferPanel's own changed-row marker, not by this
          // label.
          label: fallbackApplied
            ? `${groupLabel} ${COVERAGE_LABEL[st]} · KG 700: Berechnung automatisch auf HOAI/AHO umgestellt`
            : fallbackReverted
              ? `${groupLabel} ${COVERAGE_LABEL[st]} · KG 700: Berechnung automatisch zurück auf All3-Verfahren umgestellt`
              : `${groupLabel} ${COVERAGE_LABEL[st]}`,
          // Task 05 rework (QA AC-2): the fallback branches above compose an
          // extra German KG 700 auto-fallback explanation that a plain
          // `coverage` PriceChange cannot represent — only the common case
          // (no fallback transition) gets a translatable `change`; the rare
          // fallback-transition text is a known remaining gap (out of scope
          // here — QA's evidenced scenario is a plain KG toggle, not one
          // that triggers the KG 700 auto-fallback).
          change: fallbackApplied || fallbackReverted
            ? undefined : { kind: 'coverage', group: g, value: st },
          deltaExact: delta,
          percent: before.isZero() ? null : delta.div(before).mul(100),
        },
      })
    },

    confirmGebaeudeklasse: () => {
      const s = get()
      const b = activeBuilding(s)
      const id = s.activeBuildingId
      if (b.gebaeudeklasse.confirmed) return
      const write = (confirmed: boolean) => set((state) => {
        const review = state.buildingReviews[id]
        if (!review) return {}
        return reviewedBuildingPatch(
          state, id, withEngineState(review, { buildingClassConfirmed: confirmed }),
        )
      })
      write(true)
      apply({
        kind: 'value.confirmed',
        label: 'Gebäudeklasse nach MBO §2 bestätigt',
        deltaExact: null,
        inverse: () => write(false),
        forward: () => write(true),
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

    confirmScopeBoundaries: () => {
      const s = get()
      const prev = s.scopeBoundariesConfirmedFingerprint
      const next = scopeBoundariesFingerprint(s)
      if (prev === next) return
      set({ scopeBoundariesConfirmedFingerprint: next })
      apply({
        kind: 'value.confirmed',
        label: 'Leistungsabgrenzung bestätigt',
        deltaExact: null,
        inverse: () => set({ scopeBoundariesConfirmedFingerprint: prev }),
        forward: () => set({ scopeBoundariesConfirmedFingerprint: next }),
      })
    },

    resolveBuildingConflict: (conflictId, resolution) => {
      const s = get()
      const conflict = s.buildingConflicts[conflictId]
      if (!conflict) return
      if (resolution.decision === 'selectCandidate'
        && !conflict.candidates.some((item) => item.id === resolution.candidateId)) {
        return
      }
      const selectedId = resolution.decision === 'selectCandidate'
        ? resolution.candidateId : null
      const write = (
        decision: ConflictResolution['decision'],
        candidateId: string | null,
        reason: string,
      ) => set((state) => ({
        buildingConflicts: withConflictResolution(
          state.buildingConflicts,
          conflictId,
          decision,
          candidateId,
          'sales-user',
          reason,
        ),
      }))
      write(resolution.decision, selectedId, 'Prüfung der Gebäudedaten')
      const deferred = resolution.decision === 'defer'
      apply({
        kind: 'conflict.resolved',
        label: deferred
          ? `Konflikt „${BUILDING_FACT_LABELS[conflict.factKey]}“ zurückgestellt`
          : `Gebäudekonflikt ${conflictId} gelöst`,
        deltaExact: null,
        // Deferring an already-open conflict does not change its effective
        // state. Offering Undo would therefore be a false action; the audit
        // event remains in the append-only conflict and journal histories.
        ...(deferred ? {} : {
          inverse: () => write('defer', null, 'Rückgängig'),
          forward: () => write(resolution.decision, selectedId, 'Wiederholt'),
        }),
      })
    },

    /**
     * The legacy WFL action is a thin adapter over the building registry.
     * Its inverse appends `defer`; conflict history is never deleted.
     */
    resolveWflConflict: (candidate) => {
      const s = get()
      const view = wflConflict(s)
      if (view.state !== 'open') return
      const conflict = s.buildingConflicts[fxConflict.id]!
      const selected = conflict.candidates.find((item) => item.origin === candidate)
      if (!selected) return
      const buildingId = conflict.buildingId
      const prevReview = s.buildingReviews[buildingId]!
      const selectedValue = D(selected.value)
      const selectedReview = candidate === 'customer'
        ? withFactOverride(
            prevReview, 'wfl', selectedValue, CUSTOMER_CONFIRMATION_ACTOR,
            new Date().toISOString(),
          )
        : withoutFactOverride(prevReview, 'wfl')
      const write = (resolved: boolean) => set((state) => {
        const review = resolved ? selectedReview : prevReview
        const patch = reviewedBuildingPatch(state, buildingId, review)
        const buildingConflicts = withConflictResolution(
          patch.buildingConflicts,
          conflict.id,
          resolved ? 'selectCandidate' : 'defer',
          resolved ? selected.id : null,
          'sales-user',
          resolved ? 'WFL-Kandidat ausgewählt' : 'Rückgängig',
        )
        return {
          ...patch,
          buildingConflicts,
          fields: legacyFieldsFromReview(review, buildingConflicts),
        }
      })
      write(true)
      apply({
        kind: 'conflict.resolved',
        label: candidate === 'customer'
          ? `WFL-Konflikt: Kundenwert 1.560,00${NNBSP}m² übernommen`
          : `WFL-Konflikt: Dokumentwert 1.500,00${NNBSP}m² beibehalten`,
        deltaExact: null,
        inverse: () => write(false),
        forward: () => write(true),
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
          percent: before.isZero() ? null : delta.div(before).mul(100),
        },
      })
    },

    /**
     * Отправка = снапшот + событие (M-3). Снапшот создаётся ДО события,
     * событие ссылается на него; inverse отсутствует намеренно —
     * отправленное неприкосновенно, отменить отправку нельзя.
     */
    setDiscount: (percent) => {
      const s = get()
      const prev = s.discountPercent
      const same = (a: Decimal | null, b: Decimal | null) =>
        (a === null && b === null) || (!!a && !!b && a.equals(b))
      if (same(prev, percent)) return
      const before = s.projection().result.total.exact
      set({ discountPercent: percent })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'value.edited',
        label: percent
          ? `Rabatt ${formatDE(percent, 1)}${NNBSP}% angewendet`
          : 'Rabatt zurückgenommen',
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set({ discountPercent: prev }),
        forward: () => set({ discountPercent: percent }),
      })
    },

    /**
     * Construction Period: Baubeginn wählen oder zurücksetzen. Verschiebt
     * nur den Anker des ScheduleModel (`shiftScheduleMetrics`) — keine
     * Preiswirkung, daher `deltaExact: null`. M-4: keine Änderung ohne
     * Ereignis, auch wenn kein Betrag betroffen ist.
     */
    setConstructionStartDate: (iso) => {
      const s = get()
      const prev = s.constructionStartDate
      if (prev === iso) return
      set({ constructionStartDate: iso })
      const label = (d: string) => {
        const [y, m, dd] = d.split('-')
        return `${dd}.${m}.${y}`
      }
      apply({
        kind: 'value.edited',
        label: iso
          ? `Baubeginn auf ${label(iso)} gesetzt`
          : 'Baubeginn zurückgesetzt',
        deltaExact: null,
        inverse: () => set({ constructionStartDate: prev }),
        forward: () => set({ constructionStartDate: iso }),
      })
    },

    setOfferDraft: (patch) => set((s) => ({
      offerDraft: { ...s.offerDraft, ...patch },
    })),

    sendOffer: (kind) => {
      const s = get()
      return get().sendOfferForOption(kind, s.activeOptionId)
    },

    sendOfferForOption: (kind, optionId) => {
      const s = get()
      const config = optionId ? configForOption(s, optionId) : null
      if (optionId && !config) throw new Error(`Option ${optionId} nicht gefunden`)
      // M-3 snapshots freeze the sold option, never a temporary building
      // lens used while editing the Configurator.
      const p = config ? projectProjection(config) : projectProjection(s)
      const snap: OfferSnapshot = {
        id: `SNAP-${s.snapshots.length + 1}`,
        at: new Date().toISOString(),
        kind,
        optionId,
        optionName: s.options.find((o) => o.id === optionId)?.name ?? null,
        totalExact: p.result.total.exact.toFixed(2),
        totalLabel: p.result.totalLabel,
        uncertaintyPp: p.uncertaintyPp,
        regionalfaktorActive: config?.regionalfaktorActive ?? s.regionalfaktorActive,
        coverage: { ...(config?.coverage ?? s.coverage) },
        discountPercent: (config?.discountPercent ?? s.discountPercent)
          ? (config?.discountPercent ?? s.discountPercent)!.toFixed(1)
          : null,
        journalSeqAt: s.journal.length,
        // VR2-08: copy, not reference — `offerDraft.attachments` stays live
        // and mutable after this send; the snapshot's own array must not
        // alias it (the same "object AND array both frozen" discipline the
        // comment below already applies to `snap`/`s.snapshots`).
        attachmentIds: [...s.offerDraft.attachments],
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
      }, optionId)
      return snap
    },

    clearDelta: () => set({ activeDelta: null }),
    openConfiguratorStepAt: (requestedStep) => set((s) => {
      const stepId = nearestActiveConfiguratorStep({
        coverage: s.coverage,
        mode: s.mode,
      }, requestedStep)
      const buildingScoped = isBuildingScopedConfiguratorStep(stepId)
      const includedIds = includedBuildingIds(s)
      const activeBuildingId = includedIds.includes(s.activeBuildingId)
        ? s.activeBuildingId
        : includedIds[0] ?? s.activeBuildingId
      const scopeKey = configurationScopeKey(s, activeBuildingId)
      const scopedVisited = s.configurationVisitedChapters[scopeKey] ?? []
      return {
        openConfiguratorStep: stepId,
        // AUD-01 (EXP-01): the DC-28 hover preview is scoped to the control
        // the pointer/focus is currently over — navigating to a different
        // chapter always leaves that control, so the preview must clear
        // here too, not only on option switch/fixation (`NO_TRANSIENT`
        // already covers those). `activeDelta` (the post-commit chip) is
        // intentionally NOT cleared: it names a real, already-applied
        // change and keeps its own independent lifetime regardless of
        // which chapter is open.
        preview: null,
        activeBuildingId,
        pricingStarted: s.pricingStarted || (
          s.configurationModeChosen
            && !s.configurationModeEditing
            // Identity, not position (ticket "MAKE SCOPE BOUNDARIES THE
            // AUTHORITATIVE CONFIGURATOR ENTRY STEP"): pricing starts on
            // ENTERING Leistungsabgrenzung, never on a literal chapter
            // number that would silently go stale on the next reorder.
            && stepId === CONFIGURATOR_STEP.SCOPE_BOUNDARIES
        ),
        scopeBuildingId: buildingScoped && s.configurationMode === 'PER_BUILDING'
          ? activeBuildingId
          : null,
        ...(buildingScoped && s.configurationModeChosen && !s.configurationModeEditing
          && !scopedVisited.includes(stepId)
          ? {
              configurationVisitedChapters: {
                ...s.configurationVisitedChapters,
                [scopeKey]: [...scopedVisited, stepId],
              },
            }
          : {}),
        // След посещения — источник честного прогресса в сайдбаре: глава
        // «пройдена», если её открывали, а не потому что её номер меньше
        // текущего (ревью № 13, дефект 7).
        visitedConfiguratorSteps: s.visitedConfiguratorSteps.includes(stepId)
          ? s.visitedConfiguratorSteps
          : [...s.visitedConfiguratorSteps, stepId],
      }
    }),

    outcomeOf: (change) => {
      // Тот же движок от точных значений и та же ПОЛНАЯ проекция, что у
      // клика: у последствия нет собственной арифметики и нет своего охвата,
      // поэтому плитка, призрак и клик разойтись не могут.
      const s = get()
      const before = computeProjection(s).result
      const after = computeProjection(withChange(s, change)).result
      return {
        delta: after.total.exact.minus(before.total.exact),
        futureTotal: after.total,
        futureLabel: after.totalLabel,
      }
    },

    optionDelta: (change) => get().outcomeOf(change).delta,

    previewOption: (change) => {
      if (change === null) {
        if (get().preview !== null) set({ preview: null })
        return
      }
      const s = get()
      if (isCurrent(s, change)) {
        if (s.preview !== null) set({ preview: null })
        return
      }
      // Призрак показывает БУДУЩЕЕ значение героя, а не только разницу:
      // «на сколько изменится» без «сколько станет» заставляет клиента
      // считать в уме на переговорах.
      const out = get().outcomeOf(change)
      set({
        preview: {
          label: changeLabel(change),
          change,
          futureTotal: out.futureTotal,
          deltaExact: out.delta,
          contextRef: 'DEMO-SC-01 · Vorschau-Lauf DEMO-RUN-0009',
          futureLabel: out.futureLabel,
        },
        // AUD-01 (EXP-01/EXP-02, live Playwright finding): `.a3-preview`
        // and `.a3-delta` share one absolutely-positioned anchor on the
        // documented assumption that they are "mutually exclusive in
        // time" (components-core.md §13) — true for fixation clearing the
        // preview (`apply()`, above), but nothing enforced the OTHER
        // direction: hovering a genuinely new option WHILE a just-
        // committed delta chip is still in its display window left BOTH
        // visible at the identical coordinates, chip painting over the
        // preview's own first line (later in DOM order wins with no
        // z-index set on either). A fresh hover-preview is the more
        // urgent, actionable claim ("what would THIS choice do" beats
        // "what did I just do") — entering it dismisses the chip early,
        // matching the priority this ticket's own contract addition
        // documents (preview > chip > caption). The chip's underlying
        // journal entry is already recorded via `apply()` at commit time;
        // this only shortens its OWN visual display, never the record.
        activeDelta: null,
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
      const { journal, undone, level, activeOptionId } = get()
      const target = journal.find((e) => e.seq === seq)
      if (!target || !target.inverse || undone.includes(seq)) return
      // Inverse-замыкание пишет в рабочую копию ТОГО контекста, где событие
      // родилось. Вызов из чужого контекста применил бы его к чужой Option.
      if (target.optionId !== (level === 'option' ? activeOptionId : null)) return
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
      const s = get()
      if (m === 'praesentation'
        && (s.level !== 'option' || !canBeginConfiguration(s))) return
      const outputView = pipelineViewForOutputProfile(m, s.pipelineView)
      // R3 isolation contract: entering Kundenansicht starts the
      // presentation-only viewed Option at the internally active one, for
      // continuity (ticket 877f2c2a §"Initial presented Option") — leaving
      // it discards that presentation-only choice entirely, so the next
      // entry always starts fresh from whatever is active by then.
      const entering = m === 'praesentation' && s.mode !== 'praesentation'
      const leaving = m !== 'praesentation' && s.mode === 'praesentation'
      set({
        mode: m,
        ...(entering ? { viewedOptionId: s.activeOptionId } : {}),
        ...(leaving ? { viewedOptionId: null } : {}),
        pipelineView: pipelineViewForBuildingGate(s, outputView),
        openConfiguratorStep: nearestActiveConfiguratorStep({
          coverage: s.coverage,
          mode: m,
        }, s.openConfiguratorStep),
      })
    },

    openOpportunity: (id) => set((s) => ({
      mode: modeForLevelTransition(s.mode, 'opportunity'),
      level: 'opportunity',
      opportunityId: id,
    })),
    backToList: () => {
      const s = get()
      set({
        ...NO_TRANSIENT,
        mode: modeForLevelTransition(s.mode, 'liste'),
        level: 'liste',
        activeOptionId: null,
        // R3 isolation contract: leaving the option level always leaves the
        // client projection first (`modeForLevelTransition`) — the viewed
        // Option resets in the same step, exactly like `mode` itself.
        viewedOptionId: null,
        configurationModeEditing: false,
        // Рабочая копия покидаемой Option убирается в хранилище — иначе
        // следующее открытие вернуло бы её к чужому состоянию.
        ...(s.activeOptionId
          ? { optionConfigs: { ...s.optionConfigs, [s.activeOptionId]: captureConfig(s) } }
          : {}),
      })
    },
    backToOpportunity: () => {
      const s = get()
      set({
        ...NO_TRANSIENT,
        mode: modeForLevelTransition(s.mode, 'opportunity'),
        level: 'opportunity',
        activeOptionId: null,
        viewedOptionId: null,
        configurationModeEditing: false,
        ...(s.activeOptionId
          ? { optionConfigs: { ...s.optionConfigs, [s.activeOptionId]: captureConfig(s) } }
          : {}),
      })
    },

    /**
     * Подтверждение верхнеуровневых параметров — СОБЫТИЕ журнала, а не
     * флаг: оно открывает возможность создавать Options, то есть меняет
     * то, что пользователю разрешено. Изменение без события невозможно
     * по построению (M-4), и это относится к правам так же, как к числам.
     */
    confirmProjectParams: () => {
      const previousConfirmed = get().projectParamsConfirmed
      if (previousConfirmed
        && projectBaselineChangesSinceConfirmation(get()).length === 0) return
      set({ projectParamsConfirmed: true })
      apply({
        kind: 'value.confirmed',
        label: PROJECT_PARAMS_CONFIRMATION_LABEL,
        deltaExact: null,
        // Initial confirmation returns to unconfirmed. Reconfirmation returns
        // to the prior confirmed-but-stale presentation; the undone journal
        // sequence makes the earlier confirmation current again.
        inverse: () => set({ projectParamsConfirmed: previousConfirmed }),
        forward: () => set({ projectParamsConfirmed: true }),
      })
    },

    canCreateOptions: () => {
      const s = get()
      return wflConflict(s).state === 'resolved' && s.projectParamsConfirmed
    },

    createOption: (name) => {
      if (!get().canCreateOptions()) return null
      const s = get()
      // Идентификатор МОНОТОНЕН, а не выведен из длины списка. Прежде
      // удаление OPT-02 и создание новой давало снова `OPT-02`, и события
      // журнала прежней Option начинали ссылаться на чужую (сплошное ревью
      // 26, находка 11). Счётчик не убывает при отмене — это надгробие, а
      // не свободное место.
      const seq = s.optionSeq + 1
      const id = `OPT-${String(seq).padStart(2, '0')}`
      // AUD-03/EXP-04: авто-имя раньше приходило от вызывающего компонента
      // как `Option ${s.options.length + 1}`, читая снимок рендера ДО
      // перерисовки. Два быстрых клика читали одну и ту же длину списка и
      // обе Option получали одинаковое «Option 2» — притом что `id` выше
      // уже был застрахован от этого тем же монотонным счётчиком. Имя теперь
      // вычисляется ЗДЕСЬ, в момент самого атомарного перехода, от того же
      // `seq` — тем же счётчиком, тем же надгробным правилом, что и `id`.
      const resolvedName = name ?? `Option ${seq}`
      const fresh = defaultOptionConfig()
      // Состояние ДО создания — целиком, чтобы отмена вернула его, а не
      // приблизила: рабочая копия, хранилище конфигураций, активная Option
      // и уровень.
      const prevActive = s.activeOptionId
      const prevLevel = s.level
      const prevPipelineView = s.pipelineView
      const prevFlat = captureConfig(s)
      // Подготовка принадлежит Opportunity, и её результат наследуется
      // КАЖДОЙ новой Option: разрешённый конфликт WFL даёт подтверждённое
      // клиентом значение. Источник — само состояние конфликта, а не
      // копия числа: второй источник разошёлся бы при первом изменении.
      const inheritedWflConflict = wflConflict(s)
      if (inheritedWflConflict.state === 'resolved') {
        const chosen = inheritedWflConflict.candidates
          .find((c) => c.selectionStatus === 'authoritative')!
        const buildingId = fx.id
        const baseReview = fresh.buildingReviews[buildingId]!
        const inheritedReview = chosen.origin === 'customer'
          ? withFactOverride(
              baseReview, 'wfl', D(chosen.value), CUSTOMER_CONFIRMATION_ACTOR,
              new Date().toISOString(),
            )
          : withoutFactOverride(baseReview, 'wfl')
        fresh.buildingReviews = {
          ...fresh.buildingReviews,
          [buildingId]: inheritedReview,
        }
        fresh.buildings = {
          ...fresh.buildings,
          [buildingId]: requiredBuildingInput(inheritedReview),
        }
        fresh.fields = legacyFieldsFromReview(inheritedReview, s.buildingConflicts)
      }
      set({
        ...NO_TRANSIENT,
        options: [...s.options, { id, name: resolvedName }],
        activeOptionId: id,
        optionSeq: seq,
        pipelineView: 'buildingScope',
        // Новая Option — независимый вариант со свежей конфигурацией.
        // Рабочая копия предыдущей активной Option убирается в хранилище,
        // свежая раскладывается в плоские поля.
        ...(s.activeOptionId
          ? { optionConfigs: { ...s.optionConfigs, [s.activeOptionId]: captureConfig(s) } }
          : {}),
        ...fresh,
        configurationModeEditing: false,
      })
      // Что вернуть при ПОВТОРЕ отмены. Прежде `forward` восстанавливал
      // только `{id, name}`: карточка возвращалась без конфигурации, а
      // `openOption` на отсутствующем ключе молча ничего не делал. Отмена
      // отмены обязана вернуть то же, что отменила, целиком.
      let removed: OptionConfig = fresh
      apply({
        kind: 'value.edited',
        label: `Opportunity Option «${resolvedName}» angelegt`,
        deltaExact: null,
        inverse: () => set((x) => {
          const { [id]: stored, ...rest } = x.optionConfigs
          removed = stored ?? (x.activeOptionId === id ? captureConfig(x) : fresh)
          return {
            options: x.options.filter((o) => o.id !== id),
            optionConfigs: rest,
            activeOptionId: prevActive,
            pipelineView: prevPipelineView,
            mode: modeForLevelTransition(x.mode, prevLevel),
            level: prevLevel,
            ...prevFlat,
            configurationModeEditing: false,
            // AUD-01 (EXP-01): this undo/redo pair changes `activeOptionId`
            // like every other option-switch action — unlike those (which
            // spread `NO_TRANSIENT`), this one didn't, so undoing/redoing
            // option creation could leave a hover preview computed for the
            // option that just left the screen. `activeDelta` is bounded
            // (the AC-1/AC-2 commercial-integrity bug is about `preview`
            // only) but clearing it here too matches every other
            // option-identity-changing transition in this file.
            preview: null,
            activeDelta: null,
          }
        }),
        forward: () => set((x) => ({
          options: [...x.options, { id, name: resolvedName }],
          activeOptionId: id,
          level: 'option' as const,
          pipelineView: 'buildingScope' as const,
          ...(x.activeOptionId && x.activeOptionId !== id
            ? { optionConfigs: { ...x.optionConfigs, [x.activeOptionId]: captureConfig(x) } }
            : {}),
          ...removed,
          configurationModeEditing: false,
          preview: null,
          activeDelta: null,
        })),
      })
      return id
    },

    /**
     * Nur `name` ändert sich — id, Konfiguration und alle Snapshots der
     * Option bleiben unberührt. Journalisiert wie jede andere Änderung
     * (M-4); dieselbe Wache wie im UI (kein Umbenennen-Control neben dem
     * „Versendet"-Badge, AUD-03) lebt hier NOCH EINMAL, damit die Regel
     * nicht nur von der Anzeige abhängt: eine bereits versendete Option ist
     * ein unveränderliches Snapshot (M-3), auch wenn ein Aufruf das
     * UI-Verbot umgeht.
     *
     * QA-Rework (AUD-03, gefunden von QA Lead, live reproduziert): ohne
     * Eindeutigkeitswache konnte Umbenennen genau die Kollision wieder
     * herstellen, die dieses Ticket beseitigen soll — «Option 2» in «Option
     * 1» umbenannt, während «Option 1» schon existiert, gab zwei Zeilen mit
     * demselben Namen, still bestätigt per Toast. `createOption`s Garantie
     * (Name folgt demselben monotonen `optionSeq` wie `id`) galt nur bei
     * der Erstellung; sie muss auch beim Umbenennen gelten. Dieselbe Wache
     * lebt zusätzlich in der UI (`OptionCard.commitRename`), die dem Nutzer
     * den Grund nennen kann — hier bleibt sie als stiller Schutz, falls ein
     * Aufruf das UI umgeht.
     */
    renameOption: (id, name) => {
      const trimmed = name.trim()
      const s = get()
      const current = s.options.find((o) => o.id === id)
      if (!current || !trimmed || trimmed === current.name) return
      if (s.snapshots.some((sn) => sn.optionId === id)) return
      if (s.options.some((o) => o.id !== id && o.name === trimmed)) return
      const previousName = current.name
      set({ options: s.options.map((o) => (o.id === id ? { ...o, name: trimmed } : o)) })
      apply({
        kind: 'value.edited',
        label: `Opportunity Option «${previousName}» in «${trimmed}» umbenannt`,
        deltaExact: null,
        inverse: () => set((x) => ({
          options: x.options.map((o) => (o.id === id ? { ...o, name: previousName } : o)),
        })),
        forward: () => set((x) => ({
          options: x.options.map((o) => (o.id === id ? { ...o, name: trimmed } : o)),
        })),
      })
    },

    saveNote: (text) => {
      const prev = get().noteText
      if (prev === text) return
      const at = new Date().toLocaleTimeString('de-DE',
        { hour: '2-digit', minute: '2-digit' })
      set({ noteText: text, noteSavedAt: at })
      apply({
        kind: 'note.created',
        // Текст заметки в подпись НЕ попадает: журнал читают на встрече,
        // а заметка внутренняя. Событие фиксирует факт и объём правки.
        label: `Interne Notiz gespeichert · ${text.length} Zeichen`,
        deltaExact: null,
        // Без `inverse` НАМЕРЕННО: событие с обратным действием получает
        // тост (DC-29), а правило 34 требует тихой записи — «ни панели,
        // ни тостов, ни автодополнений». Отмену набора даёт само поле;
        // журнал фиксирует факт, но не предлагает откатить фразу, которую
        // продавец только что услышал от клиента.
      })
    },

    markNoteSynced: () => {
      const at = new Date().toLocaleTimeString('de-DE',
        { hour: '2-digit', minute: '2-digit' })
      set({ noteSyncedAt: at })
      apply({
        kind: 'note.synced_to_hubspot',
        label: `Notiz in die HubSpot-Projektkarte synchronisiert · ${at}`,
        deltaExact: null,
      })
    },

    openOption: (id) => {
      const s = get()
      if (!s.options.some((o) => o.id === id)) return
      if (s.activeOptionId === id) {
        set({
          level: 'option',
          pipelineView: canBeginConfiguration(s) ? 'konfigurator' : 'buildingScope',
          configurationModeEditing: false,
          ...(canBeginConfiguration(s) && s.configurationModeChosen
            && !s.configurationModeEditing
            && !s.visitedConfiguratorSteps.includes(s.openConfiguratorStep)
            ? {
                visitedConfiguratorSteps: [
                  ...s.visitedConfiguratorSteps,
                  s.openConfiguratorStep,
                ],
              }
            : {}),
        })
        return
      }
      // Своп рабочих копий: уходящая — в хранилище, открываемая — в
      // плоские поля. После свопа ключа открываемой Option в хранилище нет
      // (инвариант `optionConfigs`).
      const { [id]: next, ...rest } = s.optionConfigs
      if (!next) {
        // Молчаливый выход прятал повреждение состояния: карточка есть,
        // конфигурации нет, кнопка «Öffnen» не делает ничего и не объясняет
        // почему (сплошное ревью 26, находка 11). Такого состояния не должно
        // существовать — и если оно возникло, продукт обязан сказать это
        // вслух, а не притвориться исправным.
        throw new Error(
          `Option ${id} есть в списке, но её конфигурация отсутствует — `
          + 'состояние повреждено; открыть нечего',
        )
      }
      set({
        ...NO_TRANSIENT,
        level: 'option',
        activeOptionId: id,
        pipelineView: canBeginConfiguration({
          ...next,
          buildingConflicts: s.buildingConflicts,
        }) ? 'konfigurator' : 'buildingScope',
        optionConfigs: s.activeOptionId
          ? { ...rest, [s.activeOptionId]: captureConfig(s) }
          : rest,
        ...next,
        openConfiguratorStep: nearestActiveConfiguratorStep({
          coverage: next.coverage,
          mode: s.mode,
        }, next.openConfiguratorStep),
        configurationModeEditing: false,
      })
    },

    // R3: presentation-only Option switch. Deliberately does NOT reuse
    // `openOption` — that action swaps the working-copy flat fields and is
    // the internal preparation navigation primitive; this action changes
    // nothing but its own field. No-op outside Kundenansicht and for any
    // Option that isn't currently client-eligible, so a stale/expired
    // selector click can never leave `viewedOptionId` pointing at
    // something the client-safe UI would refuse to render.
    setViewedOption: (id) => {
      const s = get()
      if (!isClientProjection(s.mode)) return
      if (!eligibleClientOptions(s).some((o) => o.id === id)) return
      set({ viewedOptionId: id })
    },

    setPipelineView: (v) => set((s) => {
      const requested = pipelineViewForOutputProfile(s.mode, v)
      const pipelineView = pipelineViewForBuildingGate(s, requested)
      const visibleStep = nearestActiveConfiguratorStep({
        coverage: s.coverage,
        mode: s.mode,
      }, s.openConfiguratorStep)
      const includedIds = includedBuildingIds(s)
      const activeBuildingId = includedIds.includes(s.activeBuildingId)
        ? s.activeBuildingId
        : includedIds[0] ?? s.activeBuildingId
      const buildingScoped = isBuildingScopedConfiguratorStep(visibleStep)
      return {
        pipelineView,
        openConfiguratorStep: visibleStep,
        // AUD-01 (EXP-01): switching pipeline view (Konfigurator ↔
        // Vergleich/Export/Termine/…) is a route change — the hover
        // preview must not survive it, same reasoning as
        // `openConfiguratorStepAt` above.
        preview: null,
        // The narrow lens exists only inside a building-scoped Configurator
        // chapter. Vergleich, Export and snapshots always cover the option.
        scopeBuildingId: pipelineView === 'konfigurator'
          && buildingScoped
          && s.configurationMode === 'PER_BUILDING'
          && s.configurationModeChosen
          && !s.configurationModeEditing
          ? activeBuildingId
          : null,
        ...(pipelineView === 'konfigurator'
          && s.configurationModeChosen
          && !s.configurationModeEditing
          && !s.visitedConfiguratorSteps.includes(visibleStep)
          ? {
              visitedConfiguratorSteps: [
                ...s.visitedConfiguratorSteps,
                visibleStep,
              ],
            }
          : {}),
      }
    }),

    setGateOpen: (v) => set({ gateOpen: v }),

    setTourOpen: (v) => set({ tourOpen: v }),

    setPrintOpen: (v) => set({ printOpen: v }),

    setConfigurationScope: (buildingId) => set((s) => {
      if (buildingId === null) return { scopeBuildingId: null }
      if (!s.buildings[buildingId] || !s.included[buildingId]) return {}
      return {
        activeBuildingId: buildingId,
        scopeBuildingId: buildingId,
      }
    }),

    setActiveBuilding: (id) => set({ activeBuildingId: id }),

    /** Inclusion is decided before pricing starts. It remains a journalled
     * domain event, but deliberately does not ask the non-empty pricing
     * projection for a delta; zero selected is a valid gate-closed state. */
    toggleBuildingIncluded: (id) => {
      const s = get()
      if (!s.buildings[id]) return
      const next = !s.included[id]
      set({ included: { ...s.included, [id]: next } })
      // QA (Rebuild Configurator Workspace, AC-11): resolve the building's
      // display name, never the raw fixture id, in this journal label.
      const review = s.buildingReviews[id]
      const buildingName = review ? effectiveFactValue(review.facts.documentationName) ?? id : id
      apply({
        kind: 'option.selected',
        label: `${buildingName} ${next ? 'in das Angebot aufgenommen' : 'aus dem Angebot genommen'}`,
        deltaExact: null,
        inverse: () => set((x) => ({ included: { ...x.included, [id]: !next } })),
        forward: () => set((x) => ({ included: { ...x.included, [id]: next } })),
      })
    },

    toggleRisiko: (id) => {
      const s = get()
      const risk = RISK_ITEMS.find((r) => r.id === id)
      if (!risk) return
      const next = !s.risikoAktiv[id]
      const before = s.projection().result.total.exact
      set({ risikoAktiv: { ...s.risikoAktiv, [id]: next } })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: next
          ? `Risikozuschlag angewendet · ${risk.label}`
          : `Risikozuschlag entfernt · ${risk.label}`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set((x) => ({
          risikoAktiv: { ...x.risikoAktiv, [id]: !next } })),
        forward: () => set((x) => ({
          risikoAktiv: { ...x.risikoAktiv, [id]: next } })),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: next ? 'Risikozuschlag angewendet' : 'Risikozuschlag entfernt',
            deltaExact: delta,
            percent: before.isZero() ? null : delta.div(before).mul(100),
          },
        })
      }
    },

    setKg700Mode: (m) => {
      const s = get()
      if (s.kg700Mode === m) return
      const prev = s.kg700Mode
      const prevAutoFallback = s.kg700ModeAutoFallback
      const before = s.projection().result.total.exact
      // A deliberate seller choice always claims the mode from here on
      // (QA-01, ticket e2dac9b5): `setCoverage`'s automatic D-07 rule-6
      // revert must never override it, so the fallback provenance flag is
      // cleared on every explicit selection, not only when it moves away
      // from `hoaiAho`.
      set({ kg700Mode: m, kg700ModeAutoFallback: false })
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: m === 'hoaiAho'
          ? 'KG 700 nach HOAI und AHO als eigene Position'
          : 'KG 700 im All3-Verfahren 70/22/8 verteilt',
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => set({ kg700Mode: prev, kg700ModeAutoFallback: prevAutoFallback }),
        forward: () => set({ kg700Mode: m, kg700ModeAutoFallback: false }),
      })
    },

    setKg300: (groupId, value) => {
      const s = get()
      const id = s.activeBuildingId
      const shared = s.configurationMode === 'SHARED' && s.included[id]
      const prev = choicesFor(s, id)[groupId]
      if (prev === value) return
      const group = ALL_OPTION_GROUPS.find((g) => g.id === groupId)
      if (!group) return
      const prevProv = choiceProvenanceFor(s, id)[groupId] ?? 'Standard'
      const appliesTo = shared ? includedBuildingIds(s) : [id]
      const before = s.projection().result.total.exact
      // Сеттер опции KG 300 меняет ОПЦИЮ KG 300 — и ничего больше. Прежде он
      // молча ставил `kg700Mode: 'vereinfacht'`: выбор фасада отменял
      // выбранный метод расчёта Baunebenkosten, превью обещало одно, а итог
      // падал на другое, и `inverse` возвращал только фасад (сплошное ревью
      // 26, находка 10). Событие обязано хранить ровно то, что меняет.
      const write = (v: string, prov: string) => set((state) => shared
        ? {
            sharedConfiguration: {
              choices: { ...state.sharedConfiguration.choices, [groupId]: v },
              provenance: {
                ...state.sharedConfiguration.provenance, [groupId]: prov,
              },
            },
          }
        : {
            kg300: {
              ...state.kg300,
              [id]: { ...state.kg300[id], [groupId]: v },
            },
            kg300Provenance: {
              ...state.kg300Provenance,
              [id]: { ...state.kg300Provenance[id], [groupId]: prov },
            },
          })
      // Ручное переключение меняет провенанс: значение больше не «из
      // документа», даже если совпадает с ним. Иначе продавец не отличит
      // подтверждённое документом от собственного решения.
      write(value, 'manuell erfasst')
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      const choice = group.choices.find((c) => c.value === value)
      // Same class as the Energiestandard toast above (QA, AC-11): resolve
      // display names, never raw building ids, in this journal/toast label.
      const buildingNames = appliesTo.map((bid) => {
        const review = s.buildingReviews[bid]
        return review ? effectiveFactValue(review.facts.documentationName) ?? bid : bid
      }).join(', ')
      apply({
        kind: 'option.selected',
        label: `${group.label}: ${choice?.label ?? value} (${buildingNames})`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(prev ?? group.default, prevProv),
        forward: () => write(value, 'manuell erfasst'),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: `${group.label}: ${choice?.label ?? value}`,
            deltaExact: delta,
            percent: before.isZero() ? null : delta.div(before).mul(100),
          },
        })
      }
    },

    // KG 200/500/600/800 (тикет "MAKE ALL KG 200–800 SELECTABLE…"). Один
    // плоский project-level bucket — нет ветвления SHARED/PER_BUILDING, как
    // у `setKg300`, потому что `scope: 'project'` (см. `state/chapters.ts`).
    setScopeCatalogChoice: (optionId, value) => {
      const s = get()
      const prev = s.scopeCatalogChoices[optionId]
      if (prev === value) return
      const option = ALL_SCOPE_CATALOG_OPTIONS.find((o) => o.id === optionId)
      if (!option) return
      const prevProv = s.scopeCatalogProvenance[optionId] ?? 'Standard'
      const before = s.projection().result.total.exact
      const write = (v: string, prov: string) => set((state) => ({
        scopeCatalogChoices: { ...state.scopeCatalogChoices, [optionId]: v },
        scopeCatalogProvenance: {
          ...state.scopeCatalogProvenance, [optionId]: prov,
        },
      }))
      write(value, 'manuell erfasst')
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      const variant = option.variants.find((v) => v.value === value)
      apply({
        kind: 'option.selected',
        label: `${option.labelDe}: ${variant?.labelDe ?? value}`,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(prev ?? option.default, prevProv),
        forward: () => write(value, 'manuell erfasst'),
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: `${option.labelDe}: ${variant?.labelDe ?? value}`,
            deltaExact: delta,
            percent: before.isZero() ? null : delta.div(before).mul(100),
          },
        })
      }
    },

    setScopeCatalogQuantity: (key, value) => {
      const s = get()
      const prev = s.scopeCatalogQuantities[key] ?? ''
      if (prev === value) return
      const before = s.projection().result.total.exact
      const write = (v: string) => set((state) => ({
        scopeCatalogQuantities: { ...state.scopeCatalogQuantities, [key]: v },
      }))
      write(value)
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      apply({
        kind: 'option.selected',
        label: `${key}: ${value || '—'} ${SCOPE_QUANTITY_UNIT[key] ?? ''}`.trim(),
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(prev),
        forward: () => write(value),
      })
    },

    setKg800ClientRevealed: (revealed) => {
      const s = get()
      if (s.kg800ClientRevealed === revealed) return
      set({ kg800ClientRevealed: revealed })
      apply({
        kind: 'option.selected',
        label: revealed
          ? 'KG 800 · Finanzierungsdetails für dieses Meeting freigegeben'
          : 'KG 800 · Finanzierungsdetails wieder privat',
        deltaExact: null,
        inverse: () => set({ kg800ClientRevealed: !revealed }),
        forward: () => set({ kg800ClientRevealed: revealed }),
      })
    },

    confirmBuildingSection: (id, section, fingerprint) => {
      const s = get()
      const review = s.buildingReviews[id]
      if (!review || !BUILDING_REVIEW_SECTIONS.includes(section)
        || fingerprint.length === 0) return
      const previous = s.buildingSectionConfirmations[id]?.[section]
      if (previous?.fingerprint === fingerprint) return
      const confirmed: BuildingSectionConfirmation = {
        fingerprint,
        at: new Date().toISOString(),
      }
      const write = (value: BuildingSectionConfirmation | undefined) => set((state) => {
        const sections = { ...state.buildingSectionConfirmations[id] }
        if (value) sections[section] = value
        else delete sections[section]
        return {
          buildingSectionConfirmations: {
            ...state.buildingSectionConfirmations,
            [id]: sections,
          },
        }
      })
      write(confirmed)
      const sectionLabel: Record<BuildingReviewSection, string> = {
        identity: 'Identität',
        areas: 'Flächen',
        storeys: 'Geschossstruktur',
      }
      apply({
        kind: 'value.confirmed',
        // Display name, never the raw building id (F05): same fallback
        // pattern as confirmBuilding()'s own toast label below.
        label: `Gebäude ${effectiveFactValue(review.facts.documentationName) ?? id}` +
          ` · Abschnitt ${sectionLabel[section]} bestätigt`,
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(confirmed),
      })
    },

    confirmBuilding: (id) => {
      const s = get()
      const review = s.buildingReviews[id]
      if (!review || buildingConfirmed(s, id)) return
      const hasOpenConflict = Object.values(s.buildingConflicts).some(
        (conflict) => conflict.buildingId === id
          && deriveConflictState(conflict).status === 'open',
      )
      if (hasOpenConflict) return
      const previousReview = review
      const previousConfirmation = s.buildingConfirmation[id]
      const confirmedReview = withEngineState(review, { buildingClassConfirmed: true })
      const confirmed = {
        fingerprint: buildingFingerprint(confirmedReview, s.buildingConflicts),
        at: new Date().toISOString(),
      }
      const write = (
        nextReview: BuildingReview,
        value: BuildingConfirmation | undefined,
      ) => set((state) => {
        const patch = reviewedBuildingPatch(state, id, nextReview)
        const next = { ...state.buildingConfirmation }
        if (value) next[id] = value
        else delete next[id]
        return { ...patch, buildingConfirmation: next }
      })
      write(confirmedReview, confirmed)
      apply({
        kind: 'value.confirmed',
        label: `Gebäude ${effectiveFactValue(review.facts.documentationName) ?? id} bestätigt`,
        deltaExact: null,
        inverse: () => write(previousReview, previousConfirmation),
        forward: () => write(confirmedReview, confirmed),
      })
    },

    setConfigurationMode: (mode) => {
      const s = get()
      if (s.configurationMode === mode) return
      const previous = s.configurationMode
      const before = s.projection().result.total.exact
      const write = (value: ConfigurationMode) => set({ configurationMode: value })
      write(mode)
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      // Same class as the Energiestandard toast above (QA, AC-11): resolve
      // display names, never raw building ids, in this journal/toast label.
      const appliesTo = includedBuildingIds(s).map((bid) => {
        const review = s.buildingReviews[bid]
        return review ? effectiveFactValue(review.facts.documentationName) ?? bid : bid
      }).join(', ')
      apply({
        kind: 'option.selected',
        label: mode === 'SHARED'
          ? `Gemeinsame Konfiguration gilt für ${appliesTo}`
          : 'Konfiguration je Gebäude aktiviert',
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(previous),
        forward: () => write(mode),
      })
    },

    confirmConfigurationMode: (mode) => {
      const s = get()
      if (!canBeginConfiguration(s)) return
      if (s.configurationMode === mode
        && s.configurationModeChosen
        && !s.configurationModeEditing) return
      const includedIds = includedBuildingIds(s)
      const activeBuildingId = includedIds.includes(s.activeBuildingId)
        ? s.activeBuildingId
        : includedIds[0]!
      const previous = {
        configurationMode: s.configurationMode,
        configurationModeChosen: s.configurationModeChosen,
        configurationModeEditing: s.configurationModeEditing,
        activeBuildingId: s.activeBuildingId,
        scopeBuildingId: s.scopeBuildingId,
        openConfiguratorStep: s.openConfiguratorStep,
        pricingStarted: s.pricingStarted,
        visitedConfiguratorSteps: s.visitedConfiguratorSteps,
      }
      const next = {
        configurationMode: mode,
        configurationModeChosen: true,
        configurationModeEditing: false,
        activeBuildingId,
        // Leistungsabgrenzung is a project-level semantic step — landing there must
        // not narrow the live projection to one building in either mode
        // (that coupling used to be harmless only because the former entry
        // happened to be the building-scoped KG 300 step).
        scopeBuildingId: null,
        // "Konfiguration starten" enters the authoritative first
        // Configurator step (Product contract, 2026-08-18: Scope Boundaries
        // first, detailed technical configuration downstream) in the SAME
        // transition that confirms the mode. Entering Leistungsabgrenzung
        // is exactly the accepted pricingStarted trigger (mirrored in
        // `openConfiguratorStepAt` above) — so this transition starts pricing too;
        // the mode radio choice that preceded this call never did.
        openConfiguratorStep: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
        pricingStarted: true,
        visitedConfiguratorSteps: s.visitedConfiguratorSteps.includes(
          CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
        )
          ? s.visitedConfiguratorSteps
          : [...s.visitedConfiguratorSteps, CONFIGURATOR_STEP.SCOPE_BOUNDARIES],
      }
      const before = projectTotal(s)
      const write = (value: typeof previous | typeof next) => set({
        ...value,
        preview: null,
        activeDelta: null,
      })
      write(next)
      const after = projectTotal(get())
      const delta = after.minus(before)
      const buildingNames = includedIds.map((id) => {
        const review = s.buildingReviews[id]
        return review ? effectiveFactValue(review.facts.documentationName) ?? id : id
      }).join(', ')
      apply({
        kind: 'option.selected',
        label: mode === 'SHARED'
          ? `Gemeinsame Konfiguration gilt für ${buildingNames}`
          : 'Konfiguration je Gebäude bestätigt',
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(previous),
        forward: () => write(next),
      })
    },

    beginConfigurationModeEdit: () => set((s) => s.mode === 'intern'
      && s.configurationModeChosen
      ? {
          configurationModeEditing: true,
          preview: null,
          activeDelta: null,
        }
      : {}),

    markBuildingConfigurationCompleted: (id) => {
      const s = get()
      if (!s.buildings[id] || configurationStatusFor(s, id) === 'completed') return
      const previous = s.buildingConfigState[id]
      const completed: BuildingConfigurationState = {
        status: 'completed', fingerprint: null, at: new Date().toISOString(),
      }
      const write = (value: BuildingConfigurationState | undefined) => set((state) => ({
        buildingConfigState: updateOptionalRecord(state.buildingConfigState, id, value),
      }))
      write(completed)
      // QA (Rebuild Configurator Workspace, AC-11): resolve the building's
      // display name, never the raw fixture id, in this journal label.
      const completedReview = s.buildingReviews[id]
      const completedName = completedReview
        ? effectiveFactValue(completedReview.facts.documentationName) ?? id
        : id
      apply({
        kind: 'value.edited',
        label: `Gebäudekonfiguration ${completedName} abgeschlossen`,
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(completed),
      })
    },

    confirmBuildingConfiguration: (id) => {
      const s = get()
      if (!s.buildings[id] || configurationStatusFor(s, id) === 'confirmed') return
      const previous = s.buildingConfigState[id]
      const confirmed: BuildingConfigurationState = {
        status: 'confirmed',
        fingerprint: configurationFingerprint(s, id),
        at: new Date().toISOString(),
      }
      const write = (value: BuildingConfigurationState | undefined) => set((state) => ({
        buildingConfigState: updateOptionalRecord(state.buildingConfigState, id, value),
      }))
      write(confirmed)
      // QA (Rebuild Configurator Workspace, AC-11): resolve the building's
      // display name, never the raw fixture id, in this journal label.
      const confirmedReview = s.buildingReviews[id]
      const confirmedName = confirmedReview
        ? effectiveFactValue(confirmedReview.facts.documentationName) ?? id
        : id
      apply({
        kind: 'value.confirmed',
        label: `Gebäudekonfiguration ${confirmedName} bestätigt`,
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(confirmed),
      })
    },

    confirmVisibleConfiguration: () => {
      const s = get()
      if (s.mode !== 'intern' || !s.configurationModeChosen
        || s.configurationModeEditing || !canBeginConfiguration(s)) return
      const includedIds = includedBuildingIds(s)
      const ids = s.configurationMode === 'SHARED'
        ? includedIds
        : s.included[s.activeBuildingId] ? [s.activeBuildingId] : []
      if (ids.length === 0) return
      const statuses = ids.map((id) => configurationDisplayStatusFor(s, id))
      if (statuses.some((status) => status === 'open')
        || statuses.every((status) => status === 'confirmed')) return
      const at = new Date().toISOString()
      const previous = Object.fromEntries(ids.map((id) => [id, s.buildingConfigState[id]]))
      const confirmed = Object.fromEntries(ids.map((id) => [id, {
        status: 'confirmed' as const,
        fingerprint: configurationFingerprint(s, id),
        at,
      }]))
      const write = (values: Record<string, BuildingConfigurationState | undefined>) =>
        set((state) => {
          const next = { ...state.buildingConfigState }
          ids.forEach((id) => {
            const value = values[id]
            if (value) next[id] = value
            else delete next[id]
          })
          return { buildingConfigState: next }
        })
      write(confirmed)
      const activeReview = s.buildingReviews[s.activeBuildingId]
      const activeName = activeReview
        ? effectiveFactValue(activeReview.facts.documentationName) ?? s.activeBuildingId
        : s.activeBuildingId
      apply({
        kind: 'value.confirmed',
        label: s.configurationMode === 'SHARED'
          ? 'Gemeinsame Konfiguration bestätigt'
          : `Konfiguration für ${activeName} bestätigt`,
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(confirmed),
      })
    },

    buildingConfigurationStatus: (id) => configurationStatusFor(get(), id),

    allBuildingsConfirmed: () => {
      return canBeginConfiguration(get())
    },

    canBeginConfiguration: () => canBeginConfiguration(get()),

    configurationComplete: () => configurationComplete(get()),

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

let stopProposalPersistence: (() => void) | null = null
let activeProposalStorage: StorageLike | null = null

/**
 * Restore is explicit and atomic. A valid payload adds exactly one
 * non-undoable event; absent or rejected payloads leave the fixture intact.
 */
export function hydrateProposalState(storage = browserProposalStorage()): boolean {
  if (!storage) return false
  const loaded = loadPersistedProposal(storage, PROPOSAL_PROJECT_ID)
  if (loaded.status !== 'loaded') return false
  if (!isPersistedProposalPayload(loaded.payload)) {
    clearPersistedProposal(storage, PROPOSAL_PROJECT_ID)
    return false
  }

  try {
    const payload = loaded.payload
    const active = restoredOptionConfig(payload.active, payload.buildingConflicts)
    const optionConfigs = Object.fromEntries(
      Object.entries(payload.optionConfigs).map(([id, config]) => [
        id, restoredOptionConfig(config, payload.buildingConflicts),
      ]),
    )
    store.setState((state) => ({
      ...active,
      configurationModeEditing: false,
      options: payload.options,
      activeOptionId: payload.activeOptionId,
      optionSeq: payload.optionSeq,
      optionConfigs,
      buildingConflicts: payload.buildingConflicts,
      // F-07 (deep-coherence audit): this gate flag now survives reload with
      // the same rigor as the conflict decision above, instead of silently
      // reverting to unconfirmed. Absent in payloads saved before this fix.
      projectParamsConfirmed: payload.projectParamsConfirmed === true,
      // VR2-08 (M-3): a sent Option's immutable snapshot now survives an
      // ordinary reload the same way every other confirmed decision above
      // already does — `Object.freeze` re-applied since JSON deserialisation
      // produces a genuinely new, mutable array/objects (M-3's own
      // "неприкосновенен по построению" invariant does not survive a
      // structured-clone round trip for free). Absent in payloads saved
      // before this fix, defaults to the same `[]` the initial state uses.
      snapshots: Object.freeze(
        (payload.snapshots ?? []).map((snap) => deepFreeze({ ...snap })),
      ) as OfferSnapshot[],
      level: payload.activeOptionId ? 'option' : 'liste',
      opportunityId: payload.activeOptionId ? PROPOSAL_PROJECT_ID : null,
      mode: 'intern',
      ...NO_TRANSIENT,
      journal: [...state.journal, {
        seq: state.journal.length + 1,
        kind: 'state.restored',
        label: 'Angebotsstand wiederhergestellt',
        deltaExact: null,
        at: new Date().toISOString(),
        optionId: null,
      }],
    }))
    return true
  } catch {
    // Recovery is an application-start boundary: an incompatible payload must
    // never prevent the fixture-backed store from mounting.
    clearPersistedProposal(storage, PROPOSAL_PROJECT_ID)
    return false
  }
}

/** Explicit startup hook; importing the store never touches localStorage. */
export function initializeProposalPersistence(
  storage = browserProposalStorage(),
): boolean {
  if (!storage) return false
  if (stopProposalPersistence) return true
  activeProposalStorage = storage
  hydrateProposalState(storage)
  let lastSerialized = serializeProposalPayload(
    PROPOSAL_PROJECT_ID, capturePersistedProposal(store.getState()),
  )
  stopProposalPersistence = store.subscribe((state) => {
    const payload = capturePersistedProposal(state)
    const serialized = serializeProposalPayload(PROPOSAL_PROJECT_ID, payload)
    if (serialized === lastSerialized) return
    if (savePersistedProposal(storage, PROPOSAL_PROJECT_ID, payload)) {
      lastSerialized = serialized
    }
  })
  return true
}

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
  stopProposalPersistence?.()
  stopProposalPersistence = null
  if (activeProposalStorage) {
    clearPersistedProposal(activeProposalStorage, PROPOSAL_PROJECT_ID)
  }
  const browserStorage = browserProposalStorage()
  if (browserStorage && browserStorage !== activeProposalStorage) {
    clearPersistedProposal(browserStorage, PROPOSAL_PROJECT_ID)
  }
  activeProposalStorage = null
  store.setState(INITIAL_SNAPSHOT, true)
}

const LABELS: Record<'wfl' | 'bgfOber' | 'we', string> = {
  wfl: 'Wohnfläche WFL nach WoFlV',
  bgfOber: 'BGF oberirdisch',
  we: 'Wohneinheiten',
}

/**
 * Уже выбрано ли то, что предлагает решение. Превью текущего выбора — не
 * «нулевая дельта», а отсутствие решения: показывать призрак там, где
 * менять нечего, значит обещать событие, которого не будет.
 */
function isCurrent(
  s: Pick<Store, 'buildings' | 'activeBuildingId' | 'coverage' | 'risikoAktiv'
    | 'kg700Mode' | 'kg300' | 'configurationMode' | 'sharedConfiguration'
    | 'included' | 'scopeCatalogChoices'>,
  change: PriceChange,
): boolean {
  switch (change.kind) {
    case 'energiestandard':
    case 'untergeschoss':
      return s.buildings[s.activeBuildingId]![change.kind] === change.value
    case 'coverage':
      return s.coverage[change.group] === change.value
    case 'risiko':
      return (s.risikoAktiv[change.id] ?? false) === change.active
    case 'kg700':
      return s.kg700Mode === change.value
    case 'kg300':
      return choicesFor(s, change.buildingId)[change.groupId] === change.value
    case 'scopeCatalog':
      return s.scopeCatalogChoices[change.optionId] === change.value
  }
}

/** Подпись решения для призрака. Немецкий текст — из тех же словарей. */
function changeLabel(change: PriceChange): string {
  switch (change.kind) {
    case 'energiestandard':
      return `Energiestandard ${change.value.replace('_', ' ')}`
    case 'untergeschoss':
      return `Untergeschoss ${LABEL_UG[change.value]}`
    case 'coverage':
      return `${change.group.replace('_', ' ')} ${COVERAGE_LABEL[change.value]}`
    case 'risiko':
      return change.active
        ? 'Risikozuschlag anwenden' : 'Risikozuschlag zurücknehmen'
    case 'kg700':
      return change.value === 'hoaiAho'
        ? 'KG 700 nach HOAI und AHO' : 'KG 700 vereinfacht'
    case 'kg300': {
      // AUD-01 (EXP-02): used to return the raw `groupId`/`value` pair
      // unconditionally ("fassade · mixedTimber") — every KG300/KG400/
      // Zertifikate choice leaked its internal id, not only fassade. The
      // human label already exists: `ALL_OPTION_GROUPS` (options.ts) is the
      // SAME catalog `OptionChapter.tsx` reads for the option card's own
      // title (`g.label`/`c.label`), so this now shows exactly what the
      // card shows instead of re-deriving a second label.
      const group = ALL_OPTION_GROUPS.find((g) => g.id === change.groupId)
      const choice = group?.choices.find((c) => c.value === change.value)
      return group && choice
        ? `${group.label} · ${choice.label}`
        : `${change.groupId} · ${change.value}`
    }
    case 'scopeCatalog': {
      const option = ALL_SCOPE_CATALOG_OPTIONS.find((o) => o.id === change.optionId)
      const variant = option?.variants.find((v) => v.value === change.value)
      return `${option?.labelDe ?? change.optionId} · ${variant?.labelDe ?? change.value}`
    }
  }
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

const COVERAGE_LABEL_KEY: Record<CoverageState, string> = {
  included: 'coverage.included',
  excluded: 'coverage.excluded',
  onRequest: 'coverage.onRequest',
  unknown: 'coverage.unknown',
  notApplicable: 'coverage.notApplicable',
}

/**
 * Task 05 rework (QA AC-2, live EN walkthrough): translated counterpart of
 * `changeLabel` for the Geist-Vorschau render site (`preview.change`).
 * `changeLabel` itself stays German-only — it is called from plain store
 * logic with no i18n hook access. `coverage` (QA's live EN walkthrough) and
 * `kg300` (AUD-01, EXP-02) are translated here; `energiestandard`/
 * `untergeschoss`/`risiko`/`kg700`/`scopeCatalog` keep falling back to the
 * untranslated (but human, non-raw) label from `changeLabel` — closing
 * those needs the same `Driver.key`-style structural fix as
 * `translatedDriverLabel` in `clientProjection.ts` (AUD-07/AUD-12's tx()
 * bridge programme), out of scope here. AUD-01's bar is "no raw
 * id/enum/camelCase text in either language", not full EN parity — `kg300`
 * clears that bar via `changeLabel`'s own catalog lookup even without `tx`.
 */
export function translatedChangeLabel(
  change: PriceChange,
  t: (key: string, values?: Record<string, string | number>) => string,
  tx: (deText: string) => string,
): string {
  if (change.kind === 'coverage') {
    return `${change.group.replace('_', ' ')} ${t(COVERAGE_LABEL_KEY[change.value])}`
  }
  if (change.kind === 'kg300') {
    const group = ALL_OPTION_GROUPS.find((g) => g.id === change.groupId)
    const choice = group?.choices.find((c) => c.value === change.value)
    // Same reverse-lookup bridge `OptionChapter.tsx` already applies to
    // `g.label`/`c.label` for the option card itself (`tx(c.label)`) — the
    // catalog stores literal German text, not i18n keys, so this is the
    // bridge, not `t()`.
    if (group && choice) return `${tx(group.label)} · ${tx(choice.label)}`
  }
  return changeLabel(change)
}

export { LABEL_UG, COVERAGE_LABEL, LABELS }
