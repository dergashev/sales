import { createStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import {
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
  bgfAboveGround, calculateBuilding, kgSplit, sumOfBlock,
  SCOPE_BOUNDARIES_DECIDABLE_GROUPS,
  totalLabel as calculationTotalLabel,
  type BuildingInput, type Coverage, type CoverageState,
  type CostGroup, type BuildingResult,
} from '../engine/calculate'
import {
  present, rate, NNBSP, formatDE, type Displayed, type Rate,
} from '../engine/money'
import {
  defaultOptionChoices, optionDrivers, coverageDrivers, ALL_OPTION_GROUPS, ZERT_GROUPS,
} from '../engine/options'
import derivedFx from '../fixtures/derived-prototype.json'
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
  type StoreyStructure,
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
  source: string
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
  coverage: Coverage
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
  'buildingConfirmation', 'configurationMode', 'configurationModeChosen',
  'pricingStarted', 'configurationVisitedChapters', 'sharedConfiguration',
  'buildingConfigState',
  'kg300', 'kg300Provenance', 'kg700Mode', 'coverage',
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
  | 'configurationMode' | 'configurationModeChosen' | 'pricingStarted'
  | 'configurationVisitedChapters'
  | 'sharedConfiguration' | 'buildingConfigState'
  | 'kg300' | 'kg300Provenance' | 'kg700Mode' | 'coverage'
  | 'scopeBoundariesConfirmedFingerprint'
  | 'esConfirmed' | 'regionalfaktorActive' | 'risikoAktiv' | 'discountPercent'
  | 'constructionStartDate'>,
  'configurationModeChosen' | 'pricingStarted' | 'configurationVisitedChapters'
    | 'scopeBoundariesConfirmedFingerprint' | 'constructionStartDate'> & {
    /** Optional only while reading v1 payloads saved before explicit entry. */
    configurationModeChosen?: boolean
    /** Optional while reading candidates saved before the pricing boundary. */
    pricingStarted?: boolean
    configurationVisitedChapters?: Record<string, Array<ConfiguratorStepId | number>>
    /** Optional while reading payloads saved before Scope Boundaries confirmation existed. */
    scopeBoundariesConfirmedFingerprint?: string | null
    /** Optional while reading payloads saved before Construction Period existed. */
    constructionStartDate?: string | null
  }

const PERSISTED_CONFIG_KEYS = [
  'activeBuildingId', 'included', 'buildingReviews', 'buildingConfirmation',
  'configurationMode', 'configurationModeChosen', 'pricingStarted',
  'configurationVisitedChapters',
  'sharedConfiguration', 'buildingConfigState',
  'kg300', 'kg300Provenance', 'kg700Mode', 'coverage',
  'scopeBoundariesConfirmedFingerprint', 'esConfirmed',
  'regionalfaktorActive', 'risikoAktiv', 'discountPercent',
  'constructionStartDate',
] as const satisfies ReadonlyArray<keyof PersistedProposalConfig>

const LEGACY_PERSISTED_CONFIG_KEYS = PERSISTED_CONFIG_KEYS.filter(
  (key) => key !== 'configurationModeChosen'
    && key !== 'pricingStarted'
    && key !== 'configurationVisitedChapters'
    && key !== 'scopeBoundariesConfirmedFingerprint'
    && key !== 'constructionStartDate',
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
}

/**
 * Покрытие групп затрат Scope Boundaries — умолчание `unknown`, а не решение.
 *
 * Продуктовое решение по текущей задаче (Product Decision Brief, тикет
 * 627d3191, одобрено CPO, дословно проверено против бэклога): «no KG is
 * pre-selected as included, including 300/400/700. This supersedes
 * decisions.md D-07's "default 300/400/700 = included" clause.» Ни одна из
 * шести показанных групп Scope Boundaries — KG 200, 300, 400, 500, 600, 700 —
 * не предрешена: «выключено по умолчанию» означает «решение ещё не принято»
 * (`unknown` / «noch offen»), а не «продавец уже решил исключить» (SCOPE-001,
 * `data-model.md` §5.4, D-18).
 *
 * Сырое значение KG 300/400/700 также остаётся `unknown`: оно не фабрикует
 * пользовательское решение и сохраняет совместимость с уже записанными
 * конфигурациями. Эти группы при этом обязательны по политике и показаны в
 * `ChapterUmfang` как `mandatory`; поэтому только канонические
 * `SCOPE_BOUNDARIES_DECIDABLE_GROUPS` (KG 200/500/600) создают открытое
 * решение и блокируют полноту. `calculateBuilding` по-прежнему считает
 * базовую стоимость KG 300/400/700 безусловно, независимо от `coverage`.
 *
 * KG 100 (Grundstück) и KG 800 (Finanzierung) в перечень Scope Boundaries
 * этой задачи не входят (тикет называет ровно шесть групп) и сохраняют
 * прежнее `notApplicable`.
 */
const INITIAL_COVERAGE: Coverage = {
  KG_100: 'notApplicable', KG_200: 'unknown',
  KG_300: 'unknown', KG_400: 'unknown', KG_500: 'unknown',
  KG_600: 'unknown', KG_700: 'unknown', KG_800: 'notApplicable',
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
      // `vollgeschosse` does not prove UG/EG/OG/SG semantics.
      storeyStructure: fact<StoreyStructure>(null, UNKNOWN_SOURCE),
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
            // A verification-event id is audit plumbing, not sales-facing
            // evidence. Keep the fixture date as the visible authority cue
            // and leave the immutable event itself in the conflict record.
            reference: 'capturedAt' in candidate
              && typeof candidate.capturedAt === 'string'
              ? `vom Kunden bestätigt am ${new Intl.DateTimeFormat('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
                }).format(new Date(`${candidate.capturedAt}T00:00:00Z`))}`
              : 'vom Kunden bestätigt',
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
function defaultOptionConfig(): OptionConfig {
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
    kg700Mode: 'vereinfacht',
    coverage: INITIAL_COVERAGE,
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
  if (!record(value.coverage)
    || !hasOnlyKeys(value.coverage, COVERAGE_KEYS)
    || !Object.values(value.coverage).every((item) =>
      COVERAGE_STATES.includes(item as CoverageState))) return false
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

function isPersistedProposalPayload(value: unknown): value is PersistedProposalPayload {
  if (!record(value)
    || !hasOnlyKeys(value, [
      'active', 'options', 'activeOptionId', 'optionSeq', 'optionConfigs',
      'buildingConflicts',
    ])
    || !isPersistedProposalConfig(value.active)
    || !Array.isArray(value.options)
    || !Number.isInteger(value.optionSeq) || (value.optionSeq as number) < 0
    || !record(value.optionConfigs)
    || !record(value.buildingConflicts)) return false

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
  const buildings = Object.fromEntries(FIXTURE_BUILDING_IDS.map((id) => {
    const building = toBuildingInput(persisted.buildingReviews[id]!)
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
    configurationModeChosen: persisted.configurationModeChosen === true,
    pricingStarted: persisted.pricingStarted === true,
    configurationVisitedChapters,
    scopeBoundariesConfirmedFingerprint:
      persisted.scopeBoundariesConfirmedFingerprint ?? null,
    buildings,
    fields: legacyFieldsFromReview(
      persisted.buildingReviews[LEGACY_FIELDS_BUILDING_ID]!,
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
  }
}

export type Projection = {
  result: BuildingResult
  kgSplit: ReturnType<typeof kgSplit>
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
  coverage: Coverage
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
  /** Дельта-чип живёт 4 секунды, потом уезжает в журнал (DC-2). */
  activeDelta: { label: string; deltaExact: Decimal; percent: Decimal } | null
  /**
   * Geist-Vorschau (DC-28): последствие опции у цены ДО клика. Эфемерное
   * UI-состояние вроде `openConfiguratorStep` — данные не меняются, события нет.
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
  setUntergeschoss: (v: BuildingInput['untergeschoss']) => void
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
  confirmProjectParams: () => void
  /** Гейт: можно ли создавать Options (конфликты решены, параметры приняты). */
  canCreateOptions: () => boolean
  createOption: (name: string) => void
  /** Тихая запись заметки: событие журнала есть, тоста нет (правило 34). */
  saveNote: (text: string) => void
  /** Симуляция круга до CRM завершилась — отдельное событие (NOTE-003). */
  markNoteSynced: () => void
  openOption: (id: string) => void
  setActiveBuilding: (id: string) => void
  /** Включить/исключить здание из предложения — событие журнала. */
  toggleBuildingIncluded: (id: string) => void
  confirmBuilding: (id: string) => void
  setConfigurationMode: (mode: ConfigurationMode) => void
  confirmConfigurationMode: (mode: ConfigurationMode) => void
  beginConfigurationModeEdit: () => void
  markBuildingConfigurationCompleted: (id: string) => void
  confirmBuildingConfiguration: (id: string) => void
  confirmVisibleConfiguration: () => void
  buildingConfigurationStatus: (id: string) => BuildingConfigurationState['status']
  /** Выбрать опцию KG 300 у активного здания — событие журнала с дельтой. */
  setKg300: (groupId: string, value: string) => void
  setKg700Mode: (m: 'vereinfacht' | 'hoaiAho') => void
  /** Применить или снять надбавку за риск (D-02) — событие с дельтой. */
  toggleRisiko: (id: string) => void
  /** Все включённые здания подтверждены — шаг вниз к сервисам открыт. */
  allBuildingsConfirmed: () => boolean
  canBeginConfiguration: () => boolean
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
 * контракту: решаемые группы затрат (KG 200/500/600 — KG 300/400/700
 * обязательны и решением не являются, SCOPE-BOUNDARIES-001), Energiestandard
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
 * KG 200/500/600, Energiestandard oder Zertifikate haben sich seither
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
  const visited = s.visitedConfiguratorSteps.includes(stepId)
  switch (stepId) {
    case CONFIGURATOR_STEP.SCOPE_BOUNDARIES:
      // Leistungsabgrenzung решена, когда ни одна решаемая группа не
      // осталась `unknown`: непринятое решение — не пройденный шаг.
      return visited
        && !SCOPE_BOUNDARIES_DECIDABLE_GROUPS
          .some((group) => s.coverage[group] === 'unknown')
    default:
      return visited
  }
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
  | { kind: 'untergeschoss'; value: BuildingInput['untergeschoss'] }
  | { kind: 'coverage'; group: CostGroup; value: CoverageState }
  | { kind: 'risiko'; id: string; active: boolean }
  | { kind: 'kg700'; value: 'vereinfacht' | 'hoaiAho' }
  | { kind: 'kg300'; buildingId: string; groupId: string; value: string }

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
    case 'untergeschoss':
      return {
        ...s,
        buildings: {
          ...s.buildings,
          [s.activeBuildingId]: {
            ...s.buildings[s.activeBuildingId]!, [change.kind]: change.value,
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
  }
}

function computeProjection(
  s: Pick<Store, 'buildings' | 'activeBuildingId' | 'included' | 'coverage'
    | 'fields' | 'esConfirmed' | 'regionalfaktorActive' | 'kg300' | 'kg700Mode'
    | 'risikoAktiv' | 'scopeBuildingId' | 'discountPercent'
    | 'configurationMode' | 'sharedConfiguration' | 'buildingReviews'
    | 'constructionStartDate'>,
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
  const optDrivers = list.flatMap((b, i) => [
    ...optionDrivers(b, choicesFor(s, b.id), bgfSOf(b.id)),
    // Группы затрат, включённые решением пользователя: они не входят в
    // базовую ставку, поэтому включение ДОБАВЛЯЕТ, а не перераспределяет.
    // База для групп с объявленной долей — блок Bauwerk ЭТОГО здания.
    ...coverageDrivers(
      b, s.coverage as unknown as Record<string, string>, bgfSOf(b.id),
      perBuilding[i]!.bauwerk, CATALOG.kgShares,
    ),
  ].map((d) => ({ ...d, key: list.length > 1 ? `${list[i]!.id}:${d.key}` : d.key })))
  // Блок Bauwerk — это KG 300 + 400 + UG и ТОЛЬКО они. Прежде всё
  // складывалось в один `bauwerkSum`, и включение KG 500 увеличивало базу
  // KG 700, базу сплита и базу надбавок за риск: группа затрат вне блока
  // повышала цену того, что от блока считается (сплошное ревью 26,
  // находки 9 и 20). Место вклада объявляется его создателем полем `block`,
  // а не выводится здесь из позиции: у надбавки за риск база названа
  // `KG 320`, и по позиции она от вклада внутри блока неотличима.
  const bauwerkBlock = sumOfBlock(
    [...perBuilding.flatMap((r) => r.drivers), ...optDrivers], 'bauwerk',
  )
  // KG 700 в режиме HOAI+AHO — СОБСТВЕННАЯ позиция 12 % от блока
  // (`calculation-spec` §1, решение D-27). В режиме `vereinfacht` тотал не
  // меняется: доли 70/22/8 перераспределяют уже посчитанное. Прежде ставка
  // была 8,7 % и сама попадала в базу сплита — та же позиция проводилась
  // дважды.
  const kg700 = s.kg700Mode === 'hoaiAho'
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
  const splitMode = s.kg700Mode === 'hoaiAho' ? 'echt' : 'vereinfacht'
  const kg300Exact = kgSplit(bauwerkBlock, CATALOG.kgShares, splitMode).KG_300
  for (const risk of RISK_ITEMS) {
    if (!s.risikoAktiv[risk.id]) continue
    const d = riskDriver(risk, kg300Exact)
    if (d) optDrivers.push(d)
  }
  const separateSum = sumOfBlock(
    [...perBuilding.flatMap((r) => r.drivers), ...optDrivers], 'separatePosition')
  const surchargeSum = sumOfBlock(
    [...perBuilding.flatMap((r) => r.drivers), ...optDrivers], 'surcharge')
  // Скидка — «после всего» (`calculation-spec` §2) и от ТОЧНОГО итога, не от
  // показанного (CALC-007). Она вклад, а не постобработка: иначе итог и
  // Kostentreiber расходятся, и снапшот хранит цену, которой не было на
  // экране (сплошное ревью 26, находка 14).
  const beforeDiscount = bauwerkBlock.plus(separateSum).plus(surchargeSum)
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
  const allDrivers = [...perBuilding.flatMap((r) => r.drivers), ...optDrivers]
  const total = beforeDiscount.plus(sumOfBlock(allDrivers, 'discount'))
  const completeness = perBuilding.every((r) => r.completeness === 'complete')
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
    drivers: [
      ...perBuilding.flatMap((r, i) =>
        r.drivers.map((d) => ({ ...d, key: list.length > 1 ? `${list[i]!.id}:${d.key}` : d.key }))),
      ...optDrivers,
    ],
    bauwerk: perBuilding.reduce((a, r) => a.plus(r.bauwerk), new Decimal(0)),
    total: present(total),
    totalLabel: calculationTotalLabel(completeness, declaredPricingScope),
    completeness,
    incompleteReasons: perBuilding.flatMap((r) => r.incompleteReasons),
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
  const executionAnchor = demo.schedule.metrics
    .find((m) => m.metricKey === 'project.planning')!.startDate
  const shiftedExecution = (s.constructionStartDate
    ? shiftScheduleMetrics(
      [{ startDate: '2027-04-04', endDate: '2027-11-19' }],
      executionAnchor,
      s.constructionStartDate,
    )
    : [{ startDate: '2027-04-04', endDate: '2027-11-19' }])[0]!
  const duration = presentDuration(
    {
      metricKey: `building:${list[0]!.id}.execution`,
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
    kgSplit: kgSplit(bauwerkBlock, CATALOG.kgShares, splitMode),
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
 * Дельта тоста DC-29 по фикстурному образцу контракта:
 * `− 476.000 € gegenüber DEMO-VV-0003` (префикс ≈ — до знака, как в DC-12).
 */
function dc29Delta(d: Decimal): string {
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€` +
    `${NNBSP}gegenüber DEMO-VV-0003`
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
  storeyStructure: 'Geschossstruktur',
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
   */
  const apply = (e: Omit<JournalEvent, 'seq' | 'at' | 'optionId'>) => {
    const { journal, level, activeOptionId } = get()
    const seq = journal.length + 1
    // Контекст события: внутри конвейера — активная Option, на уровнях
    // списка и карточки — `null`. Создание Option происходит ДО входа в
    // конвейер и потому остаётся событием уровня Opportunity.
    const optionId = level === 'option' ? activeOptionId : null
    set({
      journal: [...journal, { ...e, seq, at: new Date().toISOString(), optionId }],
      undoToast: e.inverse
        ? {
            seq,
            statusText: e.label,
            deltaText: e.deltaExact ? dc29Delta(e.deltaExact) : null,
          }
        : null,
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
          percent: delta.div(before).mul(100),
        },
      })
    }
  }

  return {
    // Конфигурация активной Option — плоские поля из единой фабрики.
    // До создания первой Option эти же поля обслуживают уровень
    // Opportunity (анализ, параметры): рабочая копия существует всегда.
    ...defaultOptionConfig(),
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
        label: `Gebäudedaten ${id} · ${BUILDING_FACT_LABELS[key]} manuell bearbeitet`,
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
        label: `Gebäudedaten ${id} · ${BUILDING_FACT_LABELS[key]} auf Quellenwert zurückgesetzt`,
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
      const label = `Energiestandard → ${v.replace('_', ' ')} (${appliesTo.join(', ')})`
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
        activeDelta: { label, deltaExact: delta, percent: delta.div(before).mul(100) },
      })
    },

    setUntergeschoss: (v) => {
      const s = get()
      const b = activeBuilding(s)
      if (b.untergeschoss === v) return
      const before = s.projection().result.total.exact
      const prev = b.untergeschoss
      const id = s.activeBuildingId
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
      apply({
        kind: 'option.selected',
        label: `Untergeschoss ${LABEL_UG[prev]} → ${LABEL_UG[v]}`,
        deltaExact: delta,
        inverse: () => write(prev),
        forward: () => write(v),
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
      const write = (value: CoverageState) => set((current) => {
        const coverage = { ...current.coverage, [g]: value }
        return {
          coverage,
          // A future conditional KG step can disappear immediately after a
          // Scope Boundaries decision. Keep the page on the nearest active
          // semantic step; App.tsx then moves focus to that step's h1.
          openConfiguratorStep: nearestActiveConfiguratorStep({
            coverage,
            mode: current.mode,
          }, current.openConfiguratorStep),
        }
      })
      write(st)
      apply({
        kind: 'coverage.changed',
        label: `${g} ${COVERAGE_LABEL[prev]} → ${COVERAGE_LABEL[st]}`,
        deltaExact: null,
        inverse: () => write(prev),
        forward: () => write(st),
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
      apply({
        kind: 'conflict.resolved',
        label: resolution.decision === 'defer'
          ? `Gebäudekonflikt ${conflictId} zurückgestellt`
          : `Gebäudekonflikt ${conflictId} gelöst`,
        deltaExact: null,
        inverse: () => write('defer', null, 'Rückgängig'),
        forward: () => write(resolution.decision, selectedId, 'Wiederholt'),
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
          percent: delta.div(before).mul(100),
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
      // M-3 snapshots freeze the sold option, never a temporary building
      // lens used while editing the Configurator.
      const p = projectProjection(s)
      const snap: OfferSnapshot = {
        id: `SNAP-${s.snapshots.length + 1}`,
        at: new Date().toISOString(),
        kind,
        optionId: s.activeOptionId,
        optionName: s.options.find((o) => o.id === s.activeOptionId)?.name ?? null,
        totalExact: p.result.total.exact.toFixed(2),
        totalLabel: p.result.totalLabel,
        uncertaintyPp: p.uncertaintyPp,
        regionalfaktorActive: s.regionalfaktorActive,
        coverage: { ...s.coverage },
        discountPercent: s.discountPercent ? s.discountPercent.toFixed(1) : null,
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
          futureTotal: out.futureTotal,
          deltaExact: out.delta,
          contextRef: 'DEMO-SC-01 · Vorschau-Lauf DEMO-RUN-0009',
          futureLabel: out.futureLabel,
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
      set({
        mode: m,
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
        configurationModeEditing: false,
        // Рабочая копия покидаемой Option убирается в хранилище — иначе
        // следующее открытие вернуло бы её к чужому состоянию.
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
      return wflConflict(s).state === 'resolved' && s.projectParamsConfirmed
    },

    createOption: (name) => {
      if (!get().canCreateOptions()) return
      const s = get()
      // Идентификатор МОНОТОНЕН, а не выведен из длины списка. Прежде
      // удаление OPT-02 и создание новой давало снова `OPT-02`, и события
      // журнала прежней Option начинали ссылаться на чужую (сплошное ревью
      // 26, находка 11). Счётчик не убывает при отмене — это надгробие, а
      // не свободное место.
      const seq = s.optionSeq + 1
      const id = `OPT-${String(seq).padStart(2, '0')}`
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
        options: [...s.options, { id, name }],
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
        label: `Opportunity Option «${name}» angelegt`,
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
          }
        }),
        forward: () => set((x) => ({
          options: [...x.options, { id, name }],
          activeOptionId: id,
          level: 'option' as const,
          pipelineView: 'buildingScope' as const,
          ...(x.activeOptionId && x.activeOptionId !== id
            ? { optionConfigs: { ...x.optionConfigs, [x.activeOptionId]: captureConfig(x) } }
            : {}),
          ...removed,
          configurationModeEditing: false,
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
      apply({
        kind: 'option.selected',
        label: `${id} ${next ? 'in das Angebot aufgenommen' : 'aus dem Angebot genommen'}`,
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
      apply({
        kind: 'option.selected',
        label: `${group.label}: ${choice?.label ?? value} (${appliesTo.join(', ')})`,
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
      const appliesTo = includedBuildingIds(s).join(', ')
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
      apply({
        kind: 'value.edited',
        label: `Gebäudekonfiguration ${id} abgeschlossen`,
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
      apply({
        kind: 'value.confirmed',
        label: `Gebäudekonfiguration ${id} bestätigt`,
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
    | 'included'>,
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
    case 'kg300':
      return `${change.groupId} · ${change.value}`
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

export { LABEL_UG, COVERAGE_LABEL, LABELS }
