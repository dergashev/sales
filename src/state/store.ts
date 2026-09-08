import { createStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import {
  advanceJob,
  cancelJob,
  demoProject,
  initialProjectAnalyses,
  projectBaselineSnapshot,
  readiness,
  recordQuestionResponse,
  removeDocument as removeAnalysisDocument,
  reopenConflict,
  replaceDocument as replaceAnalysisDocument,
  rerunJob,
  seededCheckpoint,
  resolveConflict as resolveAnalysisConflict,
  retryDocument as retryAnalysisDocument,
  startJob,
  type ConflictChoice,
  type OptionCommit,
  type ProjectAnalysis,
  type ProjectBaselineSnapshot,
} from './projectAnalysis'
import {
  KG_SCOPE_GROUPS,
  initialDecisions as initialKgDecisions,
  kgCatalogue,
  kgCatalogues,
  kgChapterProgress,
  kgConfigurationComplete,
  kgDrivers,
  kgDeltaAgainstStandard,
  kgGroupAmounts,
  kgSelectionsWithoutBasis,
  kgTotal,
  openKgDecisionCount,
  scopeDecisionsComplete,
  selectedVariant as kgSelectedVariant,
  serviceById as kgServiceById,
  serviceDecision as kgServiceDecision,
  unpricedIncludedKgGroups,
  type KgCatalogue,
  type KgDecisions,
  type KgScopeDecision,
  type KgScopeGroup,
  type KgChapterProgress,
  type KgServiceDecisionRecord,
  withBuildingApplicability,
} from '../engine/kgConfiguration'
import {
  initialResponsibility,
  isOptionResponsibility,
  responsibilityFingerprint,
  responsibilityProjection,
  type OptionResponsibility,
  type ResponsibilityProjection,
} from '../engine/responsibility'
import {
  applyScenarioChanges,
  availablePresentationDecisions,
  emptyScenario,
  scenarioChangeCount,
  scenarioDecisionValue,
  decisionValueIn,
  scenarioOpenQuestions,
  withDecision,
  type ClientScenario,
  type PresentationDecision,
  type ScenarioConfigSlice,
} from './clientScenario'
import {
  COMMERCIAL_TRUSTED,
  commercialGroupLines,
  reconcileCommercial,
  scopeCounts,
  type CommercialCause,
  type CommercialChange,
  type CommercialDecisionFact,
  type CommercialResult,
  type CommercialTrust,
} from './commercialResult'
/**
 * `optionLifecycle` imports this module back, and the cycle is deliberate and
 * safe: BOTH directions are used only inside function bodies, never at module
 * evaluation. The alternative was a second copy of the destination rule — one
 * in the reducer that navigates and one in the button that names where it
 * goes — which is precisely the "one question, two answers" defect the audit
 * measured on the released `openOption`.
 */
import { optionNav, optionOpenDestination } from './optionLifecycle'
import {
  buildingScopeFingerprint,
  buildingScopeSaved as scopeIsSaved,
  buildingScopeStage,
  initialScopeSelection,
  scopeBuilding,
  scopeBuildingConfirmed,
  scopeBuildingsFromBaseline,
  scopeFingerprint,
  scopeReadyToSave,
  scopeMetricValue,
  scopeSelectedIds,
  selectedBgfRSTotal,
  type BuildingScopeCommit,
  type BuildingScopeStage,
  type BuildingScopeState,
  type ScopeBuilding,
  type ScopeConfirmation,
  type ScopeMetricEdit,
  type ScopeMetricKey,
  type SavedBuildingScope,
} from './optionBuildingScope'
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
import { CATALOG, withRegionalFactor } from './catalog'
import {
  bgfAboveGround, calculateBuilding, calculateKg800, kgSplit, sumOfBlock,
  regionalFactorEffect,
  SCOPE_BOUNDARIES_DECIDABLE_GROUPS,
  totalLabel as calculationTotalLabel,
  type BuildingInput, type Coverage, type CoverageState,
  type CostGroup, type BuildingResult, type Driver, type IncompleteReason,
  type Kg800Params,
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
  unpricedScopeCatalogPositions,
  type ScopeQuantityKey, type UnpricedScopePosition,
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
  addHalfMonths, halfMonthsBetween, modelDuration, presentDuration,
  schedulePositionOf, shiftScheduleMetrics, type DurationDisplay,
} from '../engine/schedule'
import {
  RISK_ITEMS, riskOutcome,
  type Kg200Basis, type RiskBases, type RiskBasisState,
} from '../engine/risk'
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
  activeSchedulePhases,
  optionScheduleStage,
  scheduleConfirmed as scheduleIsConfirmed,
  scheduleCriticalLeadHalfMonths,
  scheduleCriticalPhase,
  scheduleDerivation,
  scheduleErrors,
  scheduleFingerprint,
  scheduleIssues,
  schedulePhasesFromProject,
  scheduleReadyToConfirm,
  scheduleWarnings,
  type ScheduleConfirmation,
  type ScheduleDerivation,
  type ScheduleIssue,
  type SchedulePhase,
  type SchedulePhaseEdit,
  type ScheduleStage,
} from './optionSchedule'
import {
  REVIEW_SECTIONS,
  nextReviewSection,
  optionReviewStage,
  reviewConfirmed as reviewIsConfirmed,
  reviewFingerprint,
  reviewProgress,
  reviewReadyToConfirm,
  reviewSectionStatus,
  type ReviewAcknowledgement,
  type ReviewConfirmation,
  type ReviewIssue,
  type ReviewProgress,
  type ReviewSectionId,
  type ReviewSectionInput,
  type ReviewSectionStatus,
  type ReviewStage,
} from './optionReview'
import {
  CLIENT_PROJECTION_VERSION,
  clientBaselineFor,
  clientModeAvailableFor,
  clientModeLockReason,
  hasUnsavedWorkingChanges,
  latestSavedVersion,
  nextSavedVersionNumber,
  optionSaveStage,
  savedResultMatchesLive,
  savedVersionsFor,
  type ClientModeLockReason,
  type OptionSaveCommit,
  type SaveStage,
  type SavedOptionVersion,
} from './optionSave'
import {
  browserProposalStorage,
  clearAllPersistedProposals,
  clearPersistedProposal,
  loadPersistedProposal,
  prunePersistedProposals,
  readLastProjectId,
  savePersistedProposal,
  serializeProposalPayload,
  writeLastProjectId,
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

/**
 * The PROJECT WORKSPACE's destinations (accepted 2026-09-06 Project → Option
 * → Configurator IA audit).
 *
 * Three stages own project data — documents, understanding, and the Options
 * collection — plus one cross-Option destination (`comparison`) that is
 * reached FROM the collection and is deliberately not a stage of it.
 * Everything after them belongs to ONE Option and is addressed by
 * `pipelineView` inside the Option workspace.
 *
 * `'createOption'` is gone as a value, and its removal is the whole point of
 * the audit: object CREATION was narrated as the first step of configuring
 * the object it creates, so the home of every Option was a surface named
 * after the act of making one. The collection's own name is `'options'`; the
 * act is a button inside it.
 */
export type ProjectStage =
  | 'documents' | 'understanding' | 'options' | 'comparison'

/** Sections of Project Understanding. Questions are not conflicts. */
export type UnderstandingTab = 'overview' | 'conflicts' | 'questions'

export type EventKind =
  | 'value.edited' | 'value.confirmed'
  | 'option.selected' | 'coverage.changed'
  | 'document.activated' | 'conflict.resolved'
  | 'offer.emailed' | 'offer.printed'
  | 'note.created' | 'note.synced_to_hubspot'
  | 'state.restored'
  | 'undo'

/** Interpolation values for a presentation key. Mirrors i18n's own shape. */
export type JournalLabelValues = Readonly<Record<string, string | number>>

export type JournalEvent = {
  seq: number
  kind: EventKind
  /** Человекочитаемая подпись — она же строка журнала сессии. */
  label: string
  /**
   * VR3-01: OPTIONAL dictionary key for showing this event to the user.
   *
   * `label` stays exactly as it was — it is the journal's canonical German
   * line and the text `projectBaselineChangeLabel` pattern-matches on, so
   * translating it in place would silently change staleness detection.
   * `UndoToast` prefers this key when an action supplies one, which is how
   * the DC-29 toast stops reading German on the EN path (QA-01's class:
   * the toast rendered `label` raw). An action without a key behaves
   * exactly as before.
   */
  labelKey?: string
  labelValues?: JournalLabelValues
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
  /**
   * VR3-03R (audit G-06): the decision this event lets the rail name.
   *
   * Carried on the EVENT rather than passed beside it so that undoing the
   * event can derive its own truthful cause from the one it reverses — the
   * rail's "last thing that moved this number" after a Rückgängig is the
   * Rückgängig, not the decision it undid. An event without a cause is one
   * whose price effect cannot be attributed, and the door treats it as
   * such.
   */
  cause?: CommercialCause
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
  /**
   * VR3-02 — the Option's building scope, inherited from the journalled
   * project baseline. See `src/state/optionBuildingScope.ts` for the
   * contract; these five fields ARE the Option's copy of it, so switching
   * Option switches the scope with everything else it owns.
   */
  scopeBuildings: readonly ScopeBuilding[]
  scopeSelected: Record<string, boolean>
  scopeEdits: Record<string, Partial<Record<string, ScopeMetricEdit>>>
  scopeConfirmations: Record<string, ScopeConfirmation>
  scopeSaved: SavedBuildingScope | null
  /** Which selected building's baseline the surface is reviewing. */
  scopeActiveBuildingId: string | null
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
  /**
   * VR3-03 — the Option's KG configuration: six explicit scope decisions and
   * every service decision under them (`src/engine/kgConfiguration.ts`).
   *
   * `null` means "this Option has no KG configuration", which is the honest
   * state of a directly driven store and of a payload saved before this
   * contract. It is also the switch that selects the pricing basis: an
   * Option WITH a configuration is priced from it, an Option without one
   * keeps the released proposal engine. Same two-layer shape as VR3-02's
   * `canBeginConfiguration`, and for the same reason — a released path must
   * not change meaning because a newer one exists beside it.
   */
  kgConfig: KgDecisions | null
  /** Fingerprint of the six scope decisions at the moment they were confirmed. */
  kgScopeConfirmedFingerprint: string | null
  /**
   * VR3-TGA-UX-00 — the Option's interface/responsibility record, the ONE
   * editable owner of `Schnittstellen & Verantwortung` (`engine/
   * responsibility.ts`). Seeded from the project catalogue when the Option is
   * created, exactly as `kgConfig` is. `null` for an Option persisted before
   * this contract; `responsibilityFor` reads such an Option through the one
   * legacy adapter (seed on read, never written back) so nothing is lost and
   * nothing is duplicated.
   */
  responsibility: OptionResponsibility | null
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
  /**
   * VR3-04 — the Option's SCHEDULE, as a stage rather than a chapter.
   *
   * `constructionStartDate` above stays exactly what it was: the anchor the
   * released Gantt and the presentation projection both shift by. What is new
   * is a phase model with its own durations, dependencies, accepted
   * dependency questions and one fingerprinted confirmation — the thing that
   * makes "the schedule is settled" a fact the product can hold instead of a
   * conclusion downstream had to infer (audit F-011).
   *
   * `scheduleStartDate` and `constructionStartDate` are kept in step by the
   * same action, deliberately: two owners of one date is exactly the defect
   * `constructionStartDate`'s own docblock records.
   */
  schedulePhases: readonly SchedulePhase[]
  scheduleEdits: Record<string, SchedulePhaseEdit>
  scheduleStartDate: string | null
  schedulePlannedCompletion: string | null
  scheduleDependencyConfirmed: readonly string[]
  scheduleConfirmation: ScheduleConfirmation | null
  /**
   * VR3-04 — FINAL VALIDATION. Twelve sections, each acknowledged against the
   * fingerprint of what it showed, plus the one final confirmation that makes
   * Save available. `reviewFocusSectionId` is what lets an edit route return
   * the reader to the section they left (T-031).
   */
  reviewAcknowledged: Partial<Record<ReviewSectionId, ReviewAcknowledgement>>
  reviewConfirmation: ReviewConfirmation | null
  reviewFocusSectionId: ReviewSectionId | null
}

const OPTION_CONFIG_KEYS = [
  'buildings', 'activeBuildingId', 'included', 'buildingReviews',
  'buildingConfirmation', 'buildingSectionConfirmations',
  'scopeBuildings', 'scopeSelected', 'scopeEdits', 'scopeConfirmations',
  'scopeSaved', 'scopeActiveBuildingId',
  'configurationMode', 'configurationModeChosen',
  'pricingStarted', 'configurationVisitedChapters', 'sharedConfiguration',
  'buildingConfigState',
  'kg300', 'kg300Provenance', 'kg700Mode', 'kg700ModeAutoFallback', 'coverage',
  'scopeCatalogChoices', 'scopeCatalogProvenance', 'scopeCatalogQuantities',
  'kg800ClientRevealed',
  'scopeBoundariesConfirmedFingerprint',
  'kgConfig', 'kgScopeConfirmedFingerprint', 'responsibility', 'fields',
  'esConfirmed', 'regionalfaktorActive', 'risikoAktiv',
  'openConfiguratorStep', 'visitedConfiguratorSteps', 'scopeBuildingId', 'discountPercent',
  'offerDraft', 'constructionStartDate',
  'schedulePhases', 'scheduleEdits', 'scheduleStartDate',
  'schedulePlannedCompletion', 'scheduleDependencyConfirmed', 'scheduleConfirmation',
  'reviewAcknowledged', 'reviewConfirmation', 'reviewFocusSectionId',
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
  | 'kgConfig' | 'kgScopeConfirmedFingerprint' | 'responsibility'
  | 'esConfirmed' | 'regionalfaktorActive' | 'risikoAktiv' | 'discountPercent'
  | 'constructionStartDate'
  | 'scopeBuildings' | 'scopeSelected' | 'scopeEdits' | 'scopeConfirmations'
  | 'scopeSaved' | 'scopeActiveBuildingId'
  | 'schedulePhases' | 'scheduleEdits' | 'scheduleStartDate'
  | 'schedulePlannedCompletion' | 'scheduleDependencyConfirmed'
  | 'scheduleConfirmation'
  | 'reviewAcknowledged' | 'reviewConfirmation'>,
  'buildingSectionConfirmations' | 'configurationModeChosen' | 'pricingStarted'
    | 'configurationVisitedChapters' | 'scopeBoundariesConfirmedFingerprint'
    | 'constructionStartDate' | 'kg700ModeAutoFallback'
    | 'scopeCatalogChoices' | 'scopeCatalogProvenance' | 'scopeCatalogQuantities'
    | 'kg800ClientRevealed' | 'kgConfig' | 'kgScopeConfirmedFingerprint' | 'responsibility'
    | 'schedulePhases' | 'scheduleEdits' | 'scheduleStartDate'
    | 'schedulePlannedCompletion' | 'scheduleDependencyConfirmed'
    | 'scheduleConfirmation' | 'reviewAcknowledged' | 'reviewConfirmation'> & {
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
    /**
     * VR3-02 — the Option's building scope. A reload must not lose a SAVED
     * scope: the gate is that save, and an Option whose Konfigurator
     * silently re-locked after a browser refresh would be the product
     * forgetting a commitment the user made and was given a receipt for.
     *
     * Optional as a matter of shape, not of compatibility: an Option
     * created before this contract existed has no scope, and the version
     * gate discards those payloads outright.
     */
    scopeBuildings?: readonly ScopeBuilding[]
    scopeSelected?: Record<string, boolean>
    scopeEdits?: Record<string, Partial<Record<string, ScopeMetricEdit>>>
    scopeConfirmations?: Record<string, ScopeConfirmation>
    scopeSaved?: SavedBuildingScope | null
    scopeActiveBuildingId?: string | null
    /**
     * VR3-03 — the Option's KG configuration. Optional as a matter of shape:
     * an Option saved before this contract has none, and `null` is the state
     * that keeps it on the released pricing basis rather than pricing it from
     * a catalogue it never had.
     */
    kgConfig?: KgDecisions | null
    kgScopeConfirmedFingerprint?: string | null
    /**
     * VR3-TGA-UX-00 — the responsibility record. Optional as a matter of
     * shape: an Option saved before this contract has none, and
     * `responsibilityFor` reads it through the one legacy adapter. No
     * persistence version bump — bumping discards every stored Option, and
     * an absent optional key is exactly what the adapter exists for.
     */
    responsibility?: OptionResponsibility | null
    /**
     * VR3-04 — the schedule and the review.
     *
     * A reload must not lose a CONFIRMED schedule or a review somebody has
     * already read twelve sections of: both are commitments the user made and
     * was given a receipt for, and re-earning them after a browser refresh
     * would be the product forgetting work it acknowledged. Optional as a
     * matter of shape (an Option created before this contract has neither),
     * and the version gate discards genuinely older payloads outright.
     */
    schedulePhases?: readonly SchedulePhase[]
    scheduleEdits?: Record<string, SchedulePhaseEdit>
    scheduleStartDate?: string | null
    schedulePlannedCompletion?: string | null
    scheduleDependencyConfirmed?: readonly string[]
    scheduleConfirmation?: ScheduleConfirmation | null
    reviewAcknowledged?: Partial<Record<ReviewSectionId, ReviewAcknowledgement>>
    reviewConfirmation?: ReviewConfirmation | null
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
  'scopeBoundariesConfirmedFingerprint',
  'kgConfig', 'kgScopeConfirmedFingerprint', 'responsibility', 'esConfirmed',
  'regionalfaktorActive', 'risikoAktiv', 'discountPercent',
  'constructionStartDate',
  'scopeBuildings', 'scopeSelected', 'scopeEdits', 'scopeConfirmations',
  'scopeSaved', 'scopeActiveBuildingId',
  'schedulePhases', 'scheduleEdits', 'scheduleStartDate',
  'schedulePlannedCompletion', 'scheduleDependencyConfirmed', 'scheduleConfirmation',
  'reviewAcknowledged', 'reviewConfirmation',
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
    && key !== 'kg800ClientRevealed'
    && key !== 'kgConfig'
    && key !== 'kgScopeConfirmedFingerprint'
    && key !== 'responsibility'
    && key !== 'schedulePhases'
    && key !== 'scheduleEdits'
    && key !== 'scheduleStartDate'
    && key !== 'schedulePlannedCompletion'
    && key !== 'scheduleDependencyConfirmed'
    && key !== 'scheduleConfirmation'
    && key !== 'reviewAcknowledged'
    && key !== 'reviewConfirmation',
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
  /**
   * VR3-04 (M-3): the immutable saved Option versions, per Option.
   *
   * A saved version is the client baseline, and "immutable/recoverable" is
   * this ticket's done condition — a baseline that a browser reload could
   * lose would be neither. Optional/defaults to `{}` on restore so an older
   * stored payload keeps loading rather than being discarded whole, the same
   * conservative shape `snapshots` already uses.
   */
  savedOptionVersions?: Record<string, SavedOptionVersion[]>
  /**
   * WHICH PROJECT this Option belongs to (VR3-03R).
   *
   * Restore used to hard-code `opportunityId: PROPOSAL_PROJECT_ID` — the
   * LEGACY single-demo id (`demo.project.id`). VR3-01 replaced that single
   * demo with a two-fixture register, and VR3-03 keyed the KG catalogue by
   * the fixture project id (`DEMO-HAPPY-01` / `DEMO-COMPLEX-01`). So after
   * any browser reload `kgCatalogue(opportunityId)` resolved to `null`,
   * `hasKgConfiguration` went false with the decisions still stored, and
   * every cost group in the journey reported itself blocked with the
   * self-contradicting reason "Erst 6 von 6 Kostengruppen sind
   * entschieden."
   *
   * That is the same class this ticket exists to close — a stated reason
   * that contradicts the state it describes — and it made the recovered
   * Konfigurator unreachable after a reload, so it could not be left for
   * later. It is NOT in the VR3-03A gap register: the audit never reloaded
   * the page. Named here, and in the change manifest, as a finding of this
   * remediation rather than one of its assignments.
   *
   * Optional, defaulting to the previous constant, so a payload stored
   * before this fix keeps loading exactly as it did rather than being
   * discarded — the same conservative shape `snapshots` and
   * `savedOptionVersions` already use.
   */
  opportunityId?: string | null
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
/**
 * The bucket a working copy is filed under BEFORE any project is opened.
 *
 * It is not "the project". Every stored proposal is now keyed by the project
 * it belongs to (`proposalProjectIdOf`), and this legacy id names the one
 * state that has no project yet: the fixture working copy the store always
 * holds, which serves the Opportunity level before the first Option exists.
 *
 * It used to be the ONLY key, for every project at once — the defect
 * `PROPOSAL_PERSISTENCE_VERSION` 5 closes.
 */
export const PROPOSAL_PROJECT_ID = demo.project.id
const LEGACY_FIELDS_BUILDING_ID = fx.id
const CUSTOMER_CONFIRMATION_ACTOR = 'customer confirmation'
/**
 * Human truth is attributable or it is absent. The prototype has one signed-in
 * seller and no account system, so the attribution is the role rather than a
 * fabricated person — an invented name would be a worse lie than a role.
 */
const SCOPE_ACTOR = 'A. Muster'

/** `2027-03-15` → `15.03.2027`. Journal labels are German by contract. */
function germanDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

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
    // A fresh Option has NO building scope until it inherits one. An empty
    // list is not "no buildings" — it is "this Option was not created from a
    // project baseline", which is exactly what a directly driven store and a
    // restored legacy session are, and the Konfigurator gate says so.
    scopeBuildings: [],
    scopeSelected: {},
    scopeEdits: {},
    scopeConfirmations: {},
    scopeSaved: null,
    scopeActiveBuildingId: null,
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
    kgConfig: null,
    kgScopeConfirmedFingerprint: null,
    responsibility: null,
    fields: legacyFieldsFromReview(INITIAL_REVIEW),
    esConfirmed: false,
    regionalfaktorActive: false,
    risikoAktiv: {},
    // Configurator opens only after the separate Building & Scope step.
    // Scope Boundaries is the first semantic Configurator step.
    openConfiguratorStep: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    discountPercent: null,
    offerDraft: {
      // VR3-01: no project name is baked into the default draft. It named a
      // retired fixture row, so every offer for either demonstration
      // project opened with the wrong project in its first sentence. The
      // sender fills the project in; the Product does not guess it.
      body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser '
        + 'indikatives Angebot.\n\n'
        + 'Mit freundlichen Grüßen',
      attachments: ['angebot', 'kostentreiber', 'annahmen'],
    },

    visitedConfiguratorSteps: [],
    scopeBuildingId: null,
    constructionStartDate: null,
    // VR3-04: a fresh Option has NO schedule until it inherits one from the
    // project, exactly like `scopeBuildings` above. An empty list is not "no
    // phases" — it is "this Option was not created from a project", which is
    // what a directly driven store is, and the stage says so.
    schedulePhases: [],
    scheduleEdits: {},
    scheduleStartDate: null,
    schedulePlannedCompletion: null,
    scheduleDependencyConfirmed: [],
    scheduleConfirmation: null,
    reviewAcknowledged: {},
    reviewConfirmation: null,
    reviewFocusSectionId: null,
  }
}

const FIXTURE_BUILDING_IDS = [fx.id, fxB.id] as const

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * A STRICT allowlist: no key the contract does not declare, and no declared
 * key missing — except the ones named `optional`, which a payload written
 * before that field existed (or by a path that legitimately never sets it)
 * is allowed to omit.
 *
 * `optional` was added because its absence was silently destroying saved
 * baselines. `SavedOptionVersion.sourceOptionId` is optional BY CONTRACT —
 * an Option saved from preparation has no parent — and every such version
 * therefore has one key fewer than the allowlist. The exact-length test
 * rejected it, `isPersistedProposalPayload` rejected the whole payload,
 * `hydrateProposalState` CLEARED it and returned false, and every saved
 * Option stopped surviving a reload. Reproduced on the released baseline
 * `06a4acf` as well as here, so it is not a regression — but it is the kind
 * of silent data loss whose own guard's comment predicted it two fields
 * earlier and could not prevent it.
 */
function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const declared = new Set(keys)
  const actual = Object.keys(value)
  if (!actual.every((key) => declared.has(key))) return false
  const present = new Set(actual)
  return keys.every((key) => present.has(key) || optional.includes(key))
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

/**
 * The Option's building scope, as a stored shape.
 *
 * Structural, not exhaustive: the ids and values come from the project
 * baseline this Option inherited, so there is no fixed allowlist to check
 * them against the way `included` is checked against the proposal fixture.
 * What IS checked is that every part of the contract the gate reads has the
 * type the gate assumes — a `scopeSaved` without a fingerprint, or a
 * confirmation without one, would open the Konfigurator on a scope nobody
 * confirmed.
 */
function isPersistedBuildingScope(value: Record<string, unknown>): boolean {
  const buildings = value.scopeBuildings
  if (buildings !== undefined) {
    if (!Array.isArray(buildings)) return false
    for (const building of buildings) {
      if (!record(building)
        || typeof building.id !== 'string'
        || typeof building.name !== 'string'
        || typeof building.usageKey !== 'string'
        || typeof building.storeysKey !== 'string'
        || typeof building.identityAssetId !== 'string'
        || (building.undergroundLevel !== 'none' && building.undergroundLevel !== 'partial'
          && building.undergroundLevel !== 'full')
        || !record(building.metrics) || !record(building.authority)
        || !Array.isArray(building.evidenceDocIds)) return false
    }
  }
  if (value.scopeSelected !== undefined) {
    if (!record(value.scopeSelected)
      || !Object.values(value.scopeSelected).every((v) => typeof v === 'boolean')) return false
  }
  if (value.scopeEdits !== undefined) {
    if (!record(value.scopeEdits)) return false
    for (const perBuilding of Object.values(value.scopeEdits)) {
      if (!record(perBuilding)) return false
      for (const edit of Object.values(perBuilding)) {
        if (!record(edit) || typeof edit.value !== 'string'
          || (edit.previous !== null && typeof edit.previous !== 'string')
          || typeof edit.reason !== 'string' || typeof edit.actor !== 'string'
          || typeof edit.at !== 'string') return false
      }
    }
  }
  if (value.scopeConfirmations !== undefined) {
    if (!record(value.scopeConfirmations)) return false
    for (const confirmation of Object.values(value.scopeConfirmations)) {
      if (!record(confirmation) || typeof confirmation.fingerprint !== 'string'
        || typeof confirmation.actor !== 'string'
        || typeof confirmation.at !== 'string') return false
    }
  }
  const saved = value.scopeSaved
  if (saved !== undefined && saved !== null) {
    if (!record(saved) || typeof saved.fingerprint !== 'string'
      || !Array.isArray(saved.selectedIds)
      || !saved.selectedIds.every((id) => typeof id === 'string')
      || typeof saved.bgfRSTotal !== 'string'
      || typeof saved.actor !== 'string' || typeof saved.at !== 'string') return false
  }
  if (value.scopeActiveBuildingId !== undefined
    && value.scopeActiveBuildingId !== null
    && typeof value.scopeActiveBuildingId !== 'string') return false
  return true
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
  if (!isPersistedBuildingScope(value)) return false
  if (typeof value.esConfirmed !== 'boolean'
    || typeof value.regionalfaktorActive !== 'boolean') return false
  if (!record(value.risikoAktiv)
    || !Object.entries(value.risikoAktiv).every(([id, active]) =>
      RISK_IDS.has(id) && typeof active === 'boolean')) return false
  if (value.constructionStartDate !== undefined
    && value.constructionStartDate !== null
    && typeof value.constructionStartDate !== 'string') return false
  if (!isPersistedOptionSchedule(value)) return false
  if (!isPersistedOptionReview(value)) return false
  // VR3-TGA-UX-00: absent (legacy) or null are valid; a present record must
  // have the shape `engine/responsibility.ts` can read.
  if (value.responsibility !== undefined && value.responsibility !== null
    && !isOptionResponsibility(value.responsibility)) return false
  return value.discountPercent === null || Decimal.isDecimal(value.discountPercent)
}

/**
 * VR3-04 — the SHAPE of a restored schedule.
 *
 * Shape only, like every other validator here: a malformed payload must not
 * resurrect a phase model the model itself cannot resolve, but a well-formed
 * one is trusted, and `optionScheduleStage` re-derives every gate from it
 * anyway. A confirmation is a fingerprint, so a payload whose values have
 * been tampered with reads as STALE rather than as CONFIRMED — the
 * fingerprint is the validation that matters.
 */
function isPersistedOptionSchedule(value: Record<string, unknown>): boolean {
  if (value.schedulePhases !== undefined) {
    if (!Array.isArray(value.schedulePhases)) return false
    for (const phase of value.schedulePhases) {
      if (!record(phase)
        || typeof phase.id !== 'string'
        || !SCHEDULE_PHASE_KINDS.includes(phase.kind as SchedulePhase['kind'])
        || (phase.buildingId !== null && typeof phase.buildingId !== 'string')
        || !Number.isInteger(phase.durationHalfMonths)
        || (phase.dependsOn !== null && typeof phase.dependsOn !== 'string')
        || !Number.isInteger(phase.leadHalfMonths)
        || (phase.dependencyQuestionId !== null
          && typeof phase.dependencyQuestionId !== 'string')) return false
    }
  }
  if (value.scheduleEdits !== undefined) {
    if (!record(value.scheduleEdits)) return false
    for (const edit of Object.values(value.scheduleEdits)) {
      if (!record(edit)) return false
      if (edit.durationHalfMonths !== undefined
        && !Number.isInteger(edit.durationHalfMonths)) return false
      if (edit.leadHalfMonths !== undefined
        && !Number.isInteger(edit.leadHalfMonths)) return false
      if (edit.dependsOn !== undefined
        && edit.dependsOn !== null
        && typeof edit.dependsOn !== 'string') return false
    }
  }
  for (const key of ['scheduleStartDate', 'schedulePlannedCompletion'] as const) {
    const date = value[key]
    if (date !== undefined && date !== null && typeof date !== 'string') return false
  }
  if (value.scheduleDependencyConfirmed !== undefined) {
    if (!Array.isArray(value.scheduleDependencyConfirmed)
      || !value.scheduleDependencyConfirmed.every((id) => typeof id === 'string')) return false
  }
  const confirmation = value.scheduleConfirmation
  if (confirmation !== undefined && confirmation !== null) {
    if (!record(confirmation) || typeof confirmation.fingerprint !== 'string'
      || typeof confirmation.actor !== 'string'
      || typeof confirmation.at !== 'string') return false
  }
  return true
}

/** VR3-04 — the SHAPE of a restored Final Validation. */
function isPersistedOptionReview(value: Record<string, unknown>): boolean {
  if (value.reviewAcknowledged !== undefined) {
    if (!record(value.reviewAcknowledged)) return false
    for (const [id, acknowledgement] of Object.entries(value.reviewAcknowledged)) {
      if (!REVIEW_SECTIONS.some((section) => section.id === id)) return false
      if (!record(acknowledgement) || typeof acknowledgement.fingerprint !== 'string'
        || typeof acknowledgement.actor !== 'string'
        || typeof acknowledgement.at !== 'string') return false
    }
  }
  const confirmation = value.reviewConfirmation
  if (confirmation !== undefined && confirmation !== null) {
    if (!record(confirmation) || typeof confirmation.fingerprint !== 'string'
      || typeof confirmation.actor !== 'string'
      || typeof confirmation.at !== 'string') return false
  }
  return true
}

const SCHEDULE_PHASE_KINDS: readonly SchedulePhase['kind'][] = [
  'planning', 'tender', 'execution', 'handover',
]

const SAVED_OPTION_VERSION_KEYS = [
  'optionId', 'optionName', 'version', 'savedAt', 'savedBy',
  // VR3-05 lineage. Listed here because `hasOnlyKeys` is a STRICT allowlist:
  // a field added to the type but not to this array makes `isSavedOptionVersion`
  // reject every newly written payload, and the saved baselines silently stop
  // surviving a reload — the pitfall `PERSISTED_PROPOSAL_PAYLOAD_KEYS` already
  // recorded once. Absent from older payloads, which stay valid.
  'sourceOptionId',
  'projectBaselineId', 'buildingScopeFingerprint', 'configurationFingerprint',
  'scheduleFingerprint', 'reviewFingerprint', 'clientProjectionVersion',
  'clientProjectionValid', 'result',
] as const

/**
 * VR3-04 (M-3): a restored saved version's SHAPE is validated; its CONTENTS
 * are trusted as-is, exactly like `isOfferSnapshot` — the version was already
 * `deepFreeze`d before it was ever persisted, and a saved baseline that a
 * malformed neighbour could discard would not be recoverable.
 */
function isSavedOptionVersion(value: unknown): value is SavedOptionVersion {
  if (!record(value)
    || !hasOnlyKeys(value, SAVED_OPTION_VERSION_KEYS, ['sourceOptionId'])) return false
  const result = value.result
  if (!record(result)
    || typeof result.totalExact !== 'string'
    || typeof result.totalDisplay !== 'string'
    || typeof result.totalLabel !== 'string'
    || (result.coverage !== 'total' && result.coverage !== 'subtotal')
    || typeof result.uncertaintyPp !== 'number'
    || !Number.isInteger(result.resultVersion)
    || !Array.isArray(result.byCostGroup)
    || !result.byCostGroup.every((line) => record(line)
      && typeof line.group === 'string'
      && (line.exact === null || typeof line.exact === 'string'))) return false
  return typeof value.optionId === 'string'
    && typeof value.optionName === 'string'
    && Number.isInteger(value.version) && (value.version as number) >= 1
    && typeof value.savedAt === 'string'
    && typeof value.savedBy === 'string'
    && (value.sourceOptionId === undefined || value.sourceOptionId === null
      || typeof value.sourceOptionId === 'string')
    && (value.projectBaselineId === null || typeof value.projectBaselineId === 'string')
    && typeof value.buildingScopeFingerprint === 'string'
    && typeof value.configurationFingerprint === 'string'
    && typeof value.scheduleFingerprint === 'string'
    && typeof value.reviewFingerprint === 'string'
    && Number.isInteger(value.clientProjectionVersion)
    && typeof value.clientProjectionValid === 'boolean'
}

const PERSISTED_PROPOSAL_PAYLOAD_KEYS = [
  'active', 'options', 'activeOptionId', 'optionSeq', 'optionConfigs',
  'buildingConflicts', 'projectParamsConfirmed', 'snapshots',
  'savedOptionVersions', 'opportunityId',
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
      && (!Array.isArray(value.snapshots) || !value.snapshots.every(isOfferSnapshot)))
    || (value.savedOptionVersions !== undefined
      && (!record(value.savedOptionVersions)
        || !Object.values(value.savedOptionVersions).every((versions) =>
          Array.isArray(versions) && versions.every(isSavedOptionVersion))))
    // VR3-03R: optional, so a payload saved before the fix still restores.
    || (value.opportunityId !== undefined && value.opportunityId !== null
      && typeof value.opportunityId !== 'string')) return false

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
    // VR3-03: an Option WITH a KG configuration derives its coverage from
    // that configuration, so a reload cannot produce a coverage the six
    // decisions contradict — and `migrateCoverage`'s legacy "unknown reads as
    // excluded" rule, correct while nothing could express undecided, must not
    // erase a decision the user has genuinely not made yet.
    coverage: persisted.kgConfig
      ? coverageFromKgDecisions(persisted.kgConfig)
      : migrateCoverage(persisted.coverage),
    kgConfig: persisted.kgConfig ?? null,
    kgScopeConfirmedFingerprint: persisted.kgScopeConfirmedFingerprint ?? null,
    // VR3-TGA-UX-00: `null` here is the legacy state `responsibilityFor`
    // reads through its adapter. Nothing is seeded on rehydrate on purpose —
    // a restore must not manufacture a record the user never had.
    responsibility: persisted.responsibility ?? null,
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
    scopeBuildings: persisted.scopeBuildings ?? [],
    scopeSelected: persisted.scopeSelected ?? {},
    scopeEdits: persisted.scopeEdits ?? {},
    scopeConfirmations: persisted.scopeConfirmations ?? {},
    scopeSaved: persisted.scopeSaved ?? null,
    scopeActiveBuildingId: persisted.scopeActiveBuildingId ?? null,
    // VR3-04: absent in payloads saved before the schedule became a stage.
    // An Option restored without one has no schedule, and the stage says so
    // rather than fabricating phases the Option never had.
    schedulePhases: persisted.schedulePhases ?? [],
    scheduleEdits: persisted.scheduleEdits ?? {},
    scheduleStartDate: persisted.scheduleStartDate ?? null,
    schedulePlannedCompletion: persisted.schedulePlannedCompletion ?? null,
    scheduleDependencyConfirmed: persisted.scheduleDependencyConfirmed ?? [],
    scheduleConfirmation: persisted.scheduleConfirmation ?? null,
    reviewAcknowledged: persisted.reviewAcknowledged ?? {},
    reviewConfirmation: persisted.reviewConfirmation ?? null,
    // Never persisted: where the reader's eye was is a view position, not a
    // commitment. A reload opens the review at its own beginning.
    reviewFocusSectionId: null,
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
    savedOptionVersions: Object.fromEntries(
      Object.entries(state.savedOptionVersions).map(([id, versions]) => [id, [...versions]]),
    ),
    opportunityId: state.opportunityId,
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
  /**
   * Состояние базы каждой ПРИМЕНЁННОЙ надбавки за риск.
   *
   * «Применена» и «в цене» — разные утверждения, и до этой задачи ни одна
   * поверхность не могла их различить: `ClientOutputGateDialog` объявлял
   * «Risikozuschlag ist aktiv und im Preis enthalten» по одному булеву
   * флагу `risikoAktiv`, а надбавка с неразрешимой базой в цену не
   * попадала. Пустой массив означает «ни одна не применена», а НЕ «все
   * применённые в цене».
   */
  riskBasisStates: readonly RiskBasisState[]
}

export type Store = {
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
  /* VR3-02 — the Option's building scope (`optionBuildingScope.ts`). */
  scopeBuildings: readonly ScopeBuilding[]
  scopeSelected: Record<string, boolean>
  scopeEdits: Record<string, Partial<Record<string, ScopeMetricEdit>>>
  scopeConfirmations: Record<string, ScopeConfirmation>
  scopeSaved: SavedBuildingScope | null
  scopeActiveBuildingId: string | null
  /**
   * The scope commitment IN FLIGHT. Top-level and transient, never inside
   * `OptionConfig`: every journalled scope mutation restores a whole
   * previous value set in its `inverse`, so a commitment living inside one
   * of those records would be erased mid-air by an undo — the exact defect
   * VR3-01 paid a cycle for.
   */
  scopeCommit: BuildingScopeCommit | null
  /**
   * A deselection awaiting its consequence confirmation. Also transient:
   * it is one screen's pending question, not a fact about the Option.
   */
  scopeRemovalPending: string | null
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
  /** See the matching field on `OptionConfig` for the full contract. */
  kgConfig: KgDecisions | null
  kgScopeConfirmedFingerprint: string | null
  /** See the matching field on `OptionConfig` for the full contract. */
  responsibility: OptionResponsibility | null
  /**
   * The most recent causal cost change (T-028, M-07).
   *
   * Transient like `activeDelta` and deliberately NOT persisted: it explains
   * what the user just did, and a reload has no "just". It carries BOTH
   * languages because the catalogue does, so the rail never prints a German
   * decision label beside an English interface.
   */
  lastCommercialChange: CommercialChange | null
  /** Monotonic result version, so two surfaces can prove they agree. */
  commercialResultVersion: number
  /**
   * The total the published cause was measured AGAINST (VR3-03R, audit
   * G-06).
   *
   * The causality contract needs a "before" that survives between actions,
   * not one each action captures for itself: an action that captures its own
   * before can only explain its own change, and every OTHER path to a new
   * total then leaves the previous explanation standing beside it. This is
   * that shared before, maintained by the one door every commit passes
   * through.
   */
  commercialBaselineTotal: Decimal
  /**
   * Whether the shown commercial result is current, and if not, why
   * (VR3-03R, audit G-07).
   */
  commercialTrust: CommercialTrust
  /**
   * The decision made while the engine could not price it (VR3-03R rework).
   *
   * `null` with a non-zero count means SEVERAL decisions went unpriced, and
   * attributing the accumulated movement to any one of them would be a
   * guess wearing a decision's name.
   */
  commercialPendingCause: CommercialCause | null
  commercialPendingCount: number
  /**
   * The controlled calculation-failure mechanism (screen-by-screen spec §15,
   * "ENTRY PRECONDITION=Controlled fixture/runtime failure mechanism").
   *
   * A recovery state nobody can reach is a recovery state nobody can review,
   * and the audit's own G-07 evidence line is "failure could not be induced
   * through ordinary Product controls". So the fault is inducible — from the
   * console, never from product UI — and refused in a production build for
   * the same reason `__resetStoreForTests` is.
   */
  commercialFault: boolean
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
  /**
   * VR3-04 (M-3): the immutable saved Option versions, per Option id.
   *
   * NOT part of `OptionConfig`. A saved version is a record ABOUT an Option,
   * not a value inside it: switching Options must not carry one Option's
   * saved baseline into another's working copy, and `openOption`'s
   * working-copy swap is exactly the operation that would. It lives beside
   * `snapshots`, which is the same kind of fact for the same reason.
   */
  savedOptionVersions: Record<string, readonly SavedOptionVersion[]>
  /** The save in flight, or the one that failed. Transient, never undoable. */
  optionSaveCommit: OptionSaveCommit | null
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
    /** VR3-COST-00: the piece of the change that a `PriceChange` cannot
     *  represent — today only KG 700's automatic calculation-basis switch —
     *  carried as an i18n KEY rather than composed German prose, so the
     *  cockpit's change slot stays one language in EN.
     *
     *  Task 05 left this as a documented gap ("the rare fallback-transition
     *  text is a known remaining gap"): it was rare only in that task's
     *  evidenced scenario. On this surface the trigger is an ordinary KG 700
     *  coverage toggle, so the gap renders `KG700 enthalten` inside an
     *  otherwise English rail — which AC 63 (`EN is complete`) does not
     *  allow. The permanent journal `label` a few lines above is untouched:
     *  it is a German record of record, not UI copy. */
    noteKey?: string
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
  undoToast: {
    seq: number
    statusText: string
    /** Preferred over `statusText` when the action supplied one (VR3-01). */
    statusKey?: string
    statusValues?: JournalLabelValues
    deltaText: string | null
  } | null
  /**
   * The Option-creation commitment in flight, or the failure it ended in.
   *
   * TRANSIENT, and top-level for the reason recorded on `OptionCommit`: it
   * lived inside `ProjectAnalysis` for one candidate, and because every
   * journalled analysis mutation restores a whole previous `ProjectAnalysis`
   * on undo, undoing a conflict decision mid-commitment erased the
   * commitment in mid-air — no Option, no error, no trace. It is cleared by
   * `NO_TRANSIENT` like the preview and the undo toast.
   */
  optionCommit: OptionCommit | null
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
  /**
   * VR3-01 — per-project documentation analysis, conflict decisions,
   * question responses and freshness. Keyed by project id so the two
   * demonstration fixtures never share a job: opening the other project
   * must not inherit the first one's progress.
   */
  projectAnalyses: Record<string, ProjectAnalysis>
  /**
   * The project baseline committed into Option creation (VR3-02's input).
   * `null` until the user actually commits it — an uncommitted baseline is
   * absent, not an empty snapshot.
   */
  projectBaseline: ProjectBaselineSnapshot | null
  /** Which project-level stage the Project shell is showing. */
  projectStage: ProjectStage
  /** Which Understanding section is current once analysis has completed. */
  understandingTab: UnderstandingTab
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
   * VR3-05 — the temporary presentation scenario, or `null` while the
   * presentation is showing the saved baseline unmodified.
   *
   * NEVER PERSISTED, for the same reason `viewedOptionId` is not: a scenario
   * is a conversation in a meeting, and a reload that resurrected one would
   * put an unsaved what-if in front of the next client under the name of a
   * saved Option. Its lifetime is exactly the Client Mode session — created
   * on entry, cleared on exit, on option switch and on level change, in the
   * same `set()` calls that clear `viewedOptionId`.
   *
   * It holds a CHANGE LIST, not a configuration: see `clientScenario.ts` for
   * why the saved Option's immutability is then structural rather than
   * maintained.
   */
  clientScenario: ClientScenario | null
  /**
   * The last scenario result that derived successfully.
   *
   * The ticket requires that a calculation failure "retains the last trusted
   * scenario result and lets the user revert/retry" — so the failure path
   * needs somewhere to fall back TO. This is a read-through memo of the pure
   * derivation, exactly as `commercialTrusted` is for the baseline, and for
   * the lesson the VR3-03R remediation recorded: a trusted snapshot kept as
   * store state alone has nothing to offer when the FIRST derivation is the
   * one that fails.
   */
  clientScenarioTrusted: ClientScenarioSnapshot | null
  /** The presenter has acknowledged exporting an unsaved scenario. */
  clientScenarioExportAcknowledged: boolean
  /** The Save-as-new-Option commitment, or `null` when the dialog is closed. */
  clientScenarioSave: ClientScenarioSaveCommit | null
  /**
   * VR3-CP-00 — the chapter the client presentation is currently on.
   *
   * It lives HERE and not in the shell's React state for one measured
   * reason: chapter position was local `useState`, so any remount of the
   * shell silently returned the presenter to chapter 1 — mid-meeting, in
   * front of the client. It must survive a remount within the session.
   *
   * It must equally NOT survive the session, and must never reach the URL.
   * `mode` and `viewedOptionId` have no route encoder by contract, and a
   * presentation is not a shareable place: it is a room. So this is reset
   * to `null` in the same `set()` calls that reset `viewedOptionId`, and it
   * is absent from the persisted payload.
   */
  presentationChapter: string | null
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
  /**
   * VR3-04 — the Option's schedule stage and its Final Validation, both part
   * of `OptionConfig` for the same reason `constructionStartDate` is: they
   * describe ONE Option, and comparing two Options must compare two
   * schedules rather than one global one. See the `OptionConfig` docblocks.
   */
  schedulePhases: readonly SchedulePhase[]
  scheduleEdits: Record<string, SchedulePhaseEdit>
  scheduleStartDate: string | null
  schedulePlannedCompletion: string | null
  scheduleDependencyConfirmed: readonly string[]
  scheduleConfirmation: ScheduleConfirmation | null
  reviewAcknowledged: Partial<Record<ReviewSectionId, ReviewAcknowledgement>>
  reviewConfirmation: ReviewConfirmation | null
  reviewFocusSectionId: ReviewSectionId | null

  projection: () => Projection
  /**
   * Re-derive the commercial result and record the outcome (VR3-03R,
   * audit G-07). Idempotent; never discards a user decision.
   */
  retryCommercialResult: () => void
  /** Induce/clear the controlled calculation failure. Non-production only. */
  setCommercialFault: (on: boolean) => void
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
  /**
   * `Alle Optionen` — the explicit reverse of crossing the seam.
   *
   * It leaves the Option WORKSPACE without leaving the Option: the
   * collection marks the Option the user just left as the active one, so
   * their position in it is never lost. That is why, unlike `backToList`,
   * it does not clear `activeOptionId` — a state the released product
   * already produces on every `createOption` (level stays `'opportunity'`
   * while the new Option becomes active).
   */
  openOptionsStage: () => void
  /**
   * `Variantenvergleich` — a project-level, cross-Option destination.
   *
   * Not a stage and never numbered beneath a rail: comparison is about the
   * COLLECTION, so it is reached from the collection and belongs to the
   * project tier that owns it.
   */
  openComparison: () => void
  confirmProjectParams: () => void
  /** VR3-01 — project-level navigation and documentation analysis. */
  setProjectStage: (stage: ProjectStage) => void
  setUnderstandingTab: (tab: UnderstandingTab) => void
  startDocumentAnalysis: () => void
  /**
   * Puts one demonstration project at its seeded checkpoint: analysis
   * complete, every blocking conflict decided from the fixture's own
   * recommendation, every already-answered question recorded. Sanctioned
   * by the fixture specification for demos; it changes a state of an
   * EXISTING project and never adds a list entry.
   */
  seedProjectCheckpoint: (projectId: string) => void
  /**
   * One deterministic step of the running job. The UI schedules ticks; a
   * test drives them directly, so per-file progression is provable without
   * a timer and without a fake overall percentage.
   */
  tickDocumentAnalysis: () => void
  cancelDocumentAnalysis: () => void
  rerunDocumentAnalysis: () => void
  retryDocumentRow: (docId: string) => void
  replaceDocumentRow: (docId: string, replacementFile: string) => void
  removeDocumentRow: (docId: string) => void
  resolveProjectConflict: (conflictId: string, choice: ConflictChoice) => void
  reopenProjectConflict: (conflictId: string) => void
  recordProjectQuestionResponse: (
    questionId: string, kind: 'answer' | 'assumption',
  ) => void
  /** Commits the project baseline snapshot Option creation consumes. */
  commitProjectBaseline: () => void
  beginOptionCreation: () => void
  /**
   * Advance the in-flight Option-creation commitment by ONE stage.
   *
   * Same shape as `tickDocumentAnalysis`: the store owns the state, the UI
   * schedules the tick, and tests drive it directly without timers — so a
   * stalled commitment fails on state rather than on timing.
   */
  advanceOptionCreation: () => void
  clearOptionCreationError: () => void
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
  /**
   * VR3-CP-00 — move the client presentation to a chapter.
   *
   * Session state, deliberately: it survives a remount of the shell and is
   * cleared with the session. It writes no journal entry, changes no
   * preparation state, and never reaches the URL — Browser Back does not
   * step through chapters, because a chapter is not a place.
   */
  setPresentationChapter: (chapter: string) => void
  /* ── VR3-05 · the presentation scenario ──────────────────────────────── */
  /**
   * Choose `value` on a supported presentation decision.
   *
   * Writes the CHANGE SET and nothing else — no Option field, no journal
   * entry, no commercial settle. That is deliberate and it is the ticket's
   * boundary: "must not change private preparation state except through an
   * explicit Save as New Option command". A what-if that journalled would be
   * a what-if the Option's own history had to carry, and undo inside the
   * Konfigurator would then be able to reach into a client meeting.
   */
  setPresentationDecision: (decisionId: string, value: string) => void
  /** Discard every temporary change and return to the saved baseline. */
  revertPresentationScenario: () => void
  /** Acknowledge that an unsaved scenario may go to PDF/print, labelled. */
  acknowledgeScenarioExport: () => void
  /** Open the Save-as-new-Option dialog with a proposed unique name. */
  beginScenarioSaveAsNew: () => void
  setScenarioSaveName: (name: string) => void
  cancelScenarioSaveAsNew: () => void
  /** Commit: create a distinct saved Option descended from the source. */
  commitScenarioSaveAsNew: () => void
  setActiveBuilding: (id: string) => void
  /** Включить/исключить здание из предложения — событие журнала. */
  toggleBuildingIncluded: (id: string) => void
  /* VR3-02 — the Option's building scope. */
  setScopeActiveBuilding: (id: string) => void
  /** Selecting is immediate; DEselecting with consequences asks first. */
  toggleScopeBuilding: (id: string) => void
  confirmScopeRemoval: () => void
  cancelScopeRemoval: () => void
  /** Only a VALID value reaches the store; the field owns its own error. */
  editScopeMetric: (
    buildingId: string, key: ScopeMetricKey, value: string, reason: string,
  ) => void
  /** Recovers the value the override replaced, with its own event. */
  revertScopeMetric: (buildingId: string, key: ScopeMetricKey) => void
  confirmScopeBuilding: (id: string) => void
  beginBuildingScopeSave: () => void
  advanceBuildingScopeSave: () => void
  clearBuildingScopeSaveError: () => void
  buildingScopeStage: () => BuildingScopeStage
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
  /**
   * VR3-03 — the six explicit scope decisions and every service decision
   * under them. Both journal, both produce an undoable inverse and both
   * publish the causal change the rail explains (T-028, M-06/M-07).
   */
  setKgScopeDecision: (group: KgScopeGroup, decision: KgScopeDecision) => void
  setKgServiceDecision: (serviceId: string, decision: KgServiceDecisionRecord) => void
  /** Records the confirmation of the six decisions. It does not gate them. */
  confirmKgScope: () => void
  /** Opens one KG chapter, refusing an excluded or still-locked one. */
  openKgChapter: (group: KgScopeGroup) => void
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

  /**
   * VR3-04 — the SCHEDULE stage.
   *
   * Every one of these journals an undoable inverse: a schedule edit is a
   * commercial decision about a delivery date, and rule 13's "no data
   * change without an event" does not stop being true because the value is
   * a duration rather than a price.
   */
  setScheduleStart: (iso: string | null) => void
  setSchedulePlannedCompletion: (iso: string | null) => void
  setSchedulePhaseDuration: (phaseId: string, halfMonths: number) => void
  setSchedulePhaseLead: (phaseId: string, halfMonths: number) => void
  setSchedulePhaseDependency: (phaseId: string, dependsOn: string | null) => void
  /** Accept (or withdraw) a documented dependency question. */
  setScheduleDependencyConfirmed: (phaseId: string, confirmed: boolean) => void
  /** Records the confirmation that unlocks Final Validation. */
  confirmSchedule: () => void

  /**
   * VR3-04 — FINAL VALIDATION.
   *
   * `acknowledgeReviewSection` records that one of twelve sections has been
   * read, against the fingerprint of what it showed; `confirmFinalValidation`
   * is the single explicit confirmation that makes Save available.
   */
  acknowledgeReviewSection: (sectionId: ReviewSectionId) => void
  setReviewFocusSection: (sectionId: ReviewSectionId | null) => void
  confirmFinalValidation: () => void
  /** Return to the stage that owns one section's data, and come back to it. */
  openReviewIssueRoute: (sectionId: ReviewSectionId) => void

  /**
   * VR3-04 — the EXPLICIT SAVE.
   *
   * Two steps, exactly like the building-scope save and Option creation:
   * `beginOptionSave` states the intent and shows the busy action,
   * `advanceOptionSave` performs it and either appends ONE immutable version
   * or records the failure. A retry reuses the intended version number, so a
   * failure followed by a success produces one version and not two.
   */
  beginOptionSave: () => void
  advanceOptionSave: () => void
  clearOptionSaveError: () => void
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
  // An Option-creation commitment is transient in exactly the same sense:
  // it belongs to one screen and one intent, and navigating away abandons
  // it rather than carrying it somewhere it no longer means anything.
  optionCommit: null,
  // The building-scope save and the pending deselection are transient for
  // exactly the same reason.
  scopeCommit: null,
  scopeRemovalPending: null,
  // A save commitment is transient in exactly the same sense: the SAVED
  // VERSION is durable, the attempt that produced it is not. Carrying a
  // failed attempt to another surface would report a failure about an Option
  // the user is no longer looking at.
  optionSaveCommit: null,
  // VR3-05: a presentation scenario is the MOST transient thing in the
  // store — it is one meeting's what-if against one saved Option. Anything
  // that abandons the Option abandons it, and it is listed here so that
  // every such exit gets the reset for free instead of each remembering.
  clientScenario: null,
  clientScenarioTrusted: null,
  clientScenarioExportAcknowledged: false,
  clientScenarioSave: null,
  presentationChapter: null,
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

/**
 * Is the Option's configuration complete?
 *
 * VR3-03 added the half that was missing. The predicate used to combine the
 * old Scope Boundaries fingerprint with each included BUILDING's own
 * confirmation — a model in which a chapter counted as done because it had
 * been visited and confirmed per building. Under that predicate an Option
 * with six UNDECIDED cost groups was exportable, because "undecided" could
 * not exist and the fingerprint only had to match itself.
 *
 * An Option that carries a KG configuration must now also satisfy it: every
 * required service decision, value and dependency in every included cost
 * group (`kgConfigurationCompleteFor`). An Option without one keeps exactly
 * the released predicate.
 */
export function configurationComplete(
  s: Pick<Store, 'buildings' | 'included' | 'configurationMode'
    | 'configurationModeChosen' | 'configurationVisitedChapters'
    | 'sharedConfiguration' | 'kg300' | 'buildingConfigState'
    | 'buildingReviews' | 'buildingConfirmation' | 'buildingConflicts'
    | 'coverage' | 'scopeBoundariesConfirmedFingerprint'
    | 'kgConfig' | 'opportunityId'>,
): boolean {
  const ids = includedBuildingIds(s)
  if (hasKgConfiguration(s) && !kgConfigurationCompleteFor(s)) return false
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

/**
 * The Konfigurator gate.
 *
 * VR3-02 moved the authority: when the Option inherited a project baseline,
 * the SAVED building scope is the gate — at least one building selected,
 * every selected one confirmed, and the saved fingerprint still describing
 * what is on screen. The legacy proposal confirmation remains the gate for
 * an Option with no baseline behind it (a directly driven store, a restored
 * session from before this ticket), so nothing that used to open loses its
 * way in.
 */
export function canBeginConfiguration(
  s: Pick<Store, 'buildings' | 'included' | 'buildingReviews'
    | 'buildingConfirmation' | 'buildingConflicts'> & Partial<BuildingScopeState>,
): boolean {
  if (s.scopeBuildings && s.scopeBuildings.length > 0) {
    return scopeIsSaved(s as BuildingScopeState)
  }
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
    | 'buildingConfirmation' | 'buildingConflicts'> & Partial<BuildingScopeState>,
  view: PipelineView,
): PipelineView {
  if (canBeginConfiguration(s)) return view
  // VR3-02: the Konfigurator itself is no longer redirected away. It is
  // still fail-closed — the configurator is NOT MOUNTED behind a closed
  // gate — but the stage the user asked for renders its own lock, with the
  // named prerequisite and the route that resolves it. Bouncing them back
  // to a surface that does not explain itself is the "disabled navigation
  // as the explanation" defect the target names (T-016).
  //
  // 2026-09-06: `praesentieren` joins it for exactly the same reason. Its
  // surface carries the released mode switch, blocked, with the first of
  // three ordered reasons — which is the explanation a bounce would deny.
  if (view === 'konfigurator' || view === 'praesentieren') return view
  return view !== 'buildingScope' ? 'buildingScope' : view
}

/**
 * WHERE a returning user lands when they open a project (accepted 2026-09-06
 * IA audit, "Returning user behaviour").
 *
 * The rule is derived from the project's own job and its own collection, and
 * it decides ONE thing: which of the three project stages is on screen. It
 * enables nothing — every gate below it is unchanged — and it can never send
 * a user to a stage that has no content, because the stage it names always
 * has some.
 *
 * The old rule stopped at `understanding`, so a user with three Options in
 * progress was greeted, every single morning, by the surface whose primary
 * action is `Option anlegen`: the product's answer to "where was I" was
 * "make another one".
 */
export function landingProjectStage(
  s: Pick<Store, 'projectAnalyses' | 'options'>, projectId: string | null,
): ProjectStage {
  const analysis = projectId ? s.projectAnalyses[projectId] : undefined
  if (!analysis || analysis.jobState !== 'COMPLETE') return 'documents'
  return s.options.length > 0 ? 'options' : 'understanding'
}

/**
 * Crossing the seam OUTWARDS: the shared half of `backToOpportunity`,
 * `openOptionsStage` and `openComparison`.
 *
 * `activeOptionId` deliberately SURVIVES. It is the internal preparation
 * Option, the collection marks it `● Aktiv`, and clearing it would lose the
 * reader's place in the very list they were sent to. The state is not new:
 * `createOption` has always left `level: 'opportunity'` with an active
 * Option. What must still reset is `viewedOptionId` — the presented Option
 * is a client-mode selection and it never outlives the client mode, exactly
 * as `modeForLevelTransition` handles `mode` itself.
 *
 * The working copy stays in the flat fields rather than being captured into
 * `optionConfigs`, because the Option is still the active one:
 * `configForOption` reads `captureConfig` for the active Option and the
 * store for every other, so both halves agree with no copy to keep in sync.
 */
function leaveOptionWorkspace(s: Store) {
  return {
    mode: modeForLevelTransition(s.mode, 'opportunity'),
    level: 'opportunity' as const,
    viewedOptionId: null,
    configurationModeEditing: false,
  }
}

/**
 * Is the Konfigurator view showing its LOCK rather than the configurator?
 * One predicate, so the router, the spine and the surface cannot disagree
 * about whether the gate is open.
 */
/* ─────────────────── VR3-03 · the KG configuration ──────────────────── */

/**
 * The one map between a DIN 276 group and its Configurator step.
 *
 * Six instances of one page still need six identities in the journey, and
 * deriving the step id from the group name by string surgery is how a rename
 * becomes a silent navigation failure.
 */
/**
 * The KG catalogue's energy-standard services, and the released building
 * axis each variant maps onto.
 *
 * Named explicitly, in one place: a bridge derived from a string pattern is
 * a bridge that breaks silently when a fixture id changes.
 */
const ENERGY_STANDARD_SERVICE_IDS = new Set(['a-400-es', 'b-400-es'])

const ENERGY_STANDARD_OF_VARIANT: Readonly<Record<string, BuildingInput['energiestandard'] | undefined>> = {
  geg: 'GEG',
  eh55: 'EH_55',
  eh40: 'EH_40',
  eh40nh: 'EH_40_NH',
}

export const KG_CHAPTER_STEP: Readonly<Record<KgScopeGroup, ConfiguratorStepId>> = {
  KG_200: CONFIGURATOR_STEP.KG_200_DETAILS,
  KG_300: CONFIGURATOR_STEP.KG_300_DETAILS,
  KG_400: CONFIGURATOR_STEP.KG_400_DETAILS,
  KG_500: CONFIGURATOR_STEP.KG_500_DETAILS,
  KG_600: CONFIGURATOR_STEP.KG_600_DETAILS,
  KG_700: CONFIGURATOR_STEP.KG_700_DETAILS,
}

/** The cost group a Configurator step configures, or `null`. */
export function kgGroupOfStep(id: ConfiguratorStepId): KgScopeGroup | null {
  return (Object.entries(KG_CHAPTER_STEP) as Array<[KgScopeGroup, ConfiguratorStepId]>)
    .find(([, step]) => step === id)?.[0] ?? null
}

/**
 * The catalogue this Option is priced against, or `null`.
 *
 * VR3-KG-UNIFY-00 — RESOLVED AGAINST THE OPTION'S BUILDINGS. A construction
 * decision that exists only for a building with a basement declares that
 * condition (`appliesWhen`) and the catalogue is resolved here, once, at the
 * one door every consumer already reads — so "applicability follows the
 * actual Building baseline" is true by construction rather than per surface.
 * A caller that carries no `scopeBuildings` (a narrow engine `Pick`) reads
 * the static catalogue, which is what the fixture's own proofs describe.
 * Memoised on the building facts, so the catalogue keeps its identity across
 * renders and `useMemo` consumers stay stable.
 */
export function kgCatalogueFor(
  s: Pick<Store, 'opportunityId'> & Partial<Pick<Store, 'scopeBuildings'>>,
): KgCatalogue | null {
  const base = kgCatalogue(s.opportunityId)
  if (!base || !s.scopeBuildings || s.scopeBuildings.length === 0) return base
  const facts = s.scopeBuildings.map((b) => ({ id: b.id, undergroundLevel: b.undergroundLevel }))
  const key = facts.map((f) => `${f.id}=${f.undergroundLevel}`).join('|')
  const cached = RESOLVED_CATALOGUES.get(base)
  if (cached && cached.key === key) return cached.catalogue
  const catalogue = withBuildingApplicability(base, facts)
  RESOLVED_CATALOGUES.set(base, { key, catalogue })
  return catalogue
}

const RESOLVED_CATALOGUES = new WeakMap<KgCatalogue, { key: string; catalogue: KgCatalogue }>()

/** The Option's KG decisions, or `null` when it has no configuration. */
export function kgDecisionsFor(
  s: Pick<Store, 'kgConfig'>,
): KgDecisions | null {
  return s.kgConfig
}

/**
 * Does this Option have a live KG configuration?
 *
 * Both halves must hold: the decisions AND the catalogue they describe. A
 * configuration without its catalogue is a payload restored under a project
 * that no longer declares one, and pricing it would be pricing a shape whose
 * meaning is gone.
 */
export function hasKgConfiguration(
  s: Pick<Store, 'kgConfig' | 'opportunityId'>,
): boolean {
  return s.kgConfig !== null && kgCatalogueFor(s) !== null
}

/**
 * The fingerprint of the six scope decisions.
 *
 * A fingerprint, not a flag — the same reason VR3-02 fingerprints the
 * building scope: reopening one decision invalidates the confirmation by
 * construction, so no invalidation step can be forgotten.
 */
export function kgScopeFingerprint(decisions: KgDecisions): string {
  return KG_SCOPE_GROUPS.map((g) => `${g}=${decisions.scope[g]}`).join('|')
}

export type KgScopeStatus = 'open' | 'confirmed' | 'recheck'

export function kgScopeStatus(
  s: Pick<Store, 'kgConfig' | 'kgScopeConfirmedFingerprint'>,
): KgScopeStatus {
  if (!s.kgConfig) return 'open'
  if (!s.kgScopeConfirmedFingerprint) return 'open'
  return s.kgScopeConfirmedFingerprint === kgScopeFingerprint(s.kgConfig)
    ? 'confirmed'
    : 'recheck'
}

/** How many of the six decisions are explicit. */
export function kgDecidedScopeCount(s: Pick<Store, 'kgConfig'>): number {
  return s.kgConfig
    ? KG_SCOPE_GROUPS.filter((g) => s.kgConfig!.scope[g] !== 'undecided').length
    : 0
}

/**
 * The gate every KG chapter sits behind: six explicit decisions.
 *
 * Not "six decisions AND a confirmation": the state machine's transition is
 * `six of six decided → first included KG available`, and adding a second
 * lock would be the extra unmodelled gate the target explicitly refuses.
 * The confirmation exists, is journalled, and drives the "changed since you
 * confirmed it" notice — it does not gate the work twice.
 */
export function kgScopeDecisionsComplete(
  s: Pick<Store, 'kgConfig' | 'opportunityId'>,
): boolean {
  return hasKgConfiguration(s) && scopeDecisionsComplete(s.kgConfig!)
}

export function kgChapterProgressFor(
  s: Pick<Store, 'kgConfig' | 'opportunityId'>,
  group: KgScopeGroup,
): KgChapterProgress | null {
  const catalogue = kgCatalogueFor(s)
  if (!catalogue || !s.kgConfig) return null
  return kgChapterProgress(catalogue, s.kgConfig, group)
}

/**
 * All included KG configurations complete — the transition that makes
 * Schedule available (this ticket's end boundary).
 */
export function kgConfigurationCompleteFor(
  s: Pick<Store, 'kgConfig' | 'opportunityId'>,
): boolean {
  const catalogue = kgCatalogueFor(s)
  if (!catalogue || !s.kgConfig) return false
  return kgConfigurationComplete(catalogue, s.kgConfig)
}

/**
 * VR3-TGA-UX-00 — THE responsibility selector.
 *
 * Every consumer reads this and nothing else: the dedicated step, the KG 400
 * Rahmen band's read-only boundary line, the review section and its
 * fingerprint. Catalogue + record, resolved once; a legacy Option (record
 * `null`) is answered through the engine's one adapter and flagged as such.
 * `null` when the project declares no responsibility block.
 */
export function responsibilityFor(
  s: Pick<Store, 'responsibility' | 'opportunityId'>
  & Partial<Pick<Store, 'scopeBuildings'>>,
): ResponsibilityProjection | null {
  /**
   * `scopeBuildings` is part of the Pick DELIBERATELY.
   *
   * `kgCatalogueFor` resolves per-building applicability, and its own
   * docstring warns that a caller carrying no `scopeBuildings` silently
   * reads the STATIC catalogue. This selector used to declare exactly such
   * a narrow Pick, so responsibility was projected against an unresolved
   * catalogue while every other client selector saw a resolved one — the
   * same "one door, two readings" defect the client surfaces had (D-23).
   * Widening the Pick is the whole fix: every existing caller passes the
   * full store and now gets the resolved catalogue.
   */
  return responsibilityProjection(kgCatalogueFor(s), s.responsibility)
}

/**
 * THE commercial result, derived. Throws if the engine cannot answer.
 *
 * It is derived from `computeProjection` rather than beside it, so the rail
 * cannot show a total the comparison screen, the export preflight or a
 * snapshot disagrees with — which is precisely the class of defect F-001
 * recorded.
 *
 * VR3-03R split this from `commercialResult` below. The derivation is
 * allowed to FAIL — that is the honest behaviour of a calculation whose
 * basis is broken — and the guarded reader is the one place that decides
 * what a reader sees when it does. Merging the two is how VR3-03 came to
 * declare a `status` field and then hard-code it to `'ready'`.
 */
/**
 * The per-decision facts every commercial surface reads (VR3-COST-00).
 *
 * Built HERE, once, from the catalogue and the decisions, so no view has to
 * reach into `kgCatalogues()` to answer "which alternative is selected" or
 * "what is this choice's delta against the declared All3 standard". Both
 * answers are fixture-declared; neither is derived from a price the view
 * happens to have on screen.
 */
function commercialDecisionFacts(
  catalogue: KgCatalogue, decisions: KgDecisions,
): Record<string, CommercialDecisionFact> {
  const facts: Record<string, CommercialDecisionFact> = {}
  for (const chapter of catalogue.chapters) {
    for (const group of chapter.groups) {
      for (const service of group.services) {
        const decision = kgServiceDecision(decisions, service)
        if (decision.state !== 'selected') continue
        const variant = kgSelectedVariant(service, decision)
        facts[`kg_${service.id}`] = {
          valueDe: variant ? variant.labelDe : null,
          valueEn: variant ? variant.labelEn : null,
          standard: kgDeltaAgainstStandard(service, decision),
        }
      }
    }
  }
  return facts
}

function deriveCommercialResult(s: Store, projection: Projection): CommercialResult {
  if (s.commercialFault) {
    // The controlled failure mechanism, from the SAME place a genuine engine
    // failure would surface: the guarded reader below cannot tell them
    // apart, so the state QA reaches is the state a real failure produces.
    throw new Error('commercial calculation fault injected')
  }
  const decisions = s.kgConfig
  const catalogue = kgCatalogueFor(s)
  const decisionOf = (group: CostGroup): KgScopeDecision | 'notDecidable' => {
    if (!decisions) {
      // Without a KG configuration the legacy coverage IS the decision, and
      // its third state has always meant "not answered".
      const state = s.coverage[group]
      return state === 'included' ? 'included'
        : state === 'excluded' ? 'excluded'
          : state === 'unknown' ? 'undecided' : 'notDecidable'
    }
    return (KG_SCOPE_GROUPS as readonly string[]).includes(group)
      ? decisions.scope[group as KgScopeGroup]
      : 'notDecidable'
  }
  const lines = commercialGroupLines(projection.kgSplit, decisionOf)
  const discount = projection.discountDriver?.exact ?? new Decimal(0)
  const { reconciles, drift } = reconcileCommercial(
    lines, discount, projection.result.total.exact,
  )
  const counts = scopeCounts(decisionOf)
  const progress = catalogue && decisions
    ? KG_SCOPE_GROUPS.map((g) => kgChapterProgress(catalogue, decisions, g))
    : []
  return {
    version: s.commercialResultVersion,
    basis: hasKgConfiguration(s) ? 'kgConfiguration' : 'proposal',
    total: projection.result.total,
    totalLabel: projection.result.totalLabel,
    coverage: projection.result.completeness === 'complete' ? 'total' : 'subtotal',
    uncertaintyPp: projection.uncertaintyPp,
    leadRate: projection.leadRate,
    byCostGroup: lines,
    contributions: projection.result.drivers,
    selectionsWithoutBasis: catalogue && decisions
      ? kgSelectionsWithoutBasis(catalogue, decisions)
      : [],
    decisionFacts: catalogue && decisions
      ? commercialDecisionFacts(catalogue, decisions)
      : {},
    bauwerk: projection.result.bauwerk,
    regionalFactor: {
      active: s.regionalfaktorActive,
      value: CATALOG.regionalFactor.value,
      // ONE definition of the quantity, shared with `calculateBuilding`
      // (VR3-COST-00 §3). The rail no longer owns a second copy of it.
      effect: regionalFactorEffect(
        projection.result.bauwerk, CATALOG.regionalFactor.value,
      ),
    },
    scope: {
      ...counts,
      selectedServices: progress.reduce((n, p) => n + p.selectedServiceCount, 0),
      // ONE completeness authority on BOTH bases (VR3-COST-00, gate 7).
      // Identical to `openKgDecisionCount` wherever a KG configuration
      // exists — `kgConfigurationProjection` builds this very reason from
      // it — and truthful on the proposal basis, which used to report a
      // hard-coded 0 that the compact cockpit now renders.
      openDecisions: projection.result.incompleteReasons.reduce(
        (n, reason) => (reason.code === 'openMaterialIssues' ? n + reason.count : n),
        0,
      ),
      invalidServices: progress.reduce(
        (n, p) => n + p.invalidServiceIds.length + p.blockedServiceIds.length, 0,
      ),
    },
    lastChange: s.lastCommercialChange,
    trust: s.commercialTrust,
    derivedAtIso: new Date().toISOString(),
    reconciles,
    reconciliationDrift: drift,
  }
}

/**
 * The last result the engine actually produced.
 *
 * A READ-THROUGH CACHE of a pure selector, not store state — and the
 * distinction is what makes it correct. The first draft kept this snapshot
 * in the store, written only by the journal door, so a failure that arrived
 * before the first journalled commit found nothing to fall back on and the
 * guarded reader rethrew. Observed live: injecting a calculation fault on a
 * freshly loaded page produced a WHITE SCREEN — a React crash — which is the
 * one outcome this whole state exists to prevent. Rule 16 forbids answering
 * 0 EUR for a missing basis; crashing is not the permitted alternative.
 *
 * As a cache it is warmed by every successful READ, so the app's own first
 * render seeds it and no reachable failure can find it empty. It is cleared
 * with the store in `__resetStoreForTests`, because a snapshot of a
 * discarded Option is not a fallback, it is a wrong answer.
 */
type CommercialSnapshot = Readonly<{
  result: CommercialResult
  /** The SAME projection the result was derived from, never a second read. */
  projection: Projection
}>

let lastTrustedCommercial: CommercialSnapshot | null = null

/**
 * THE commercial snapshot every rail surface reads — result AND the
 * projection it came from, as ONE object.
 *
 * WHY BOTH TRAVEL TOGETHER (VR3-03R rework, QA-01). The first draft guarded
 * only the result, while `OfferPanel` went on reading `s.projection()`
 * directly for its hero total, its uncertainty band and its DIN 276 table —
 * 73 call sites of a second, unguarded source. So a failed calculation
 * rendered a TORN rail: the total and the composition committed the fresh
 * value while the causal line and the scope summary stayed frozen on the
 * previous one, under a banner claiming the shown figure was not the result
 * of the latest decision — which was false, because it was exactly that.
 *
 * Two renderings of one truth is precisely the F-001 class this whole
 * object was introduced to end, and the freeze made it visible rather than
 * causing it. A snapshot is only a snapshot if EVERYTHING in it is from the
 * same instant.
 *
 * Three outcomes, in the order the reader's trust decays:
 *
 * 1. the engine answers, and the answer describes the current decisions;
 * 2. the engine cannot answer, and the LAST answer it gave stays on screen
 *    — whole — carrying `trust.status = 'stale'` and the reason;
 * 3. the engine has never answered, so there is nothing trusted to show —
 *    and this rethrows rather than invent a snapshot, because a fabricated
 *    "last trusted" total is worse than a boundary that admits it has none.
 *
 * The persistence half rides the same object: a result that is current but
 * unsaved is also a result the user should not quote yet, and one state
 * with a named reason beats two independent badges the reader has to
 * reconcile (target L).
 */
export function commercialSnapshot(s: Store): CommercialSnapshot {
  try {
    // ONE projection read, shared by the result and by every consumer of
    // this snapshot — the rail can no longer show a total the result object
    // disagrees with, because there is nothing left for it to disagree with.
    const projection = s.projection()
    const fresh: CommercialSnapshot = {
      result: deriveCommercialResult(s, projection),
      projection,
    }
    // A persistence failure does not make the NUMBERS stale — it makes the
    // saved copy of them stale — so the fresh result keeps its own values
    // and carries the store's trust verdict verbatim.
    lastTrustedCommercial = fresh
    return fresh
  } catch (error) {
    const trusted = lastTrustedCommercial
    if (!trusted) throw error
    return {
      projection: trusted.projection,
      result: {
        ...trusted.result,
        /**
         * THE CAUSE IS NOT PART OF THE FROZEN COMPUTATION.
         *
         * Everything else here is arithmetic and freezes with the figure it
         * describes — including the scope summary, which says what THAT
         * total contains and would be a lie if it counted today's decisions
         * against yesterday's number. The causal line is different in kind:
         * it records what the user did, and the door already cleared it the
         * moment a decision could not be priced. Reading it from the store
         * rather than from the snapshot is what stops the rail explaining a
         * frozen figure with a decision taken after it.
         */
        lastChange: s.lastCommercialChange,
        trust: s.commercialTrust.status === 'stale'
          ? s.commercialTrust
          : {
            status: 'stale',
            reason: 'calculation',
            sinceIso: trusted.result.derivedAtIso,
            attempts: 0,
          },
      },
    }
  }
}

/** The result half, for surfaces that need no projection of their own. */
export function commercialResult(s: Store): CommercialResult {
  return commercialSnapshot(s).result
}

/* ─────────── VR3-04 · schedule, final validation and the save ────────── */

/**
 * The buildings the Option's schedule plans for.
 *
 * The SAVED building scope, not the legacy proposal's `included` map: the
 * schedule's execution phases are keyed by the PROJECT's building ids
 * (`A-BLDG-01`, `B-BLDG-C`), which is what `scopeBuildings` carries, and the
 * legacy map's fixture ids describe a different set of buildings entirely.
 * Mixing the two would silently plan for buildings the Option does not
 * cover — the "one number, two meanings" class ACCEPT-01 recorded, one
 * ticket on.
 */
export function optionScheduleBuildingIds(
  s: Pick<Store, 'scopeBuildings' | 'scopeSelected'>,
): readonly string[] {
  return scopeSelectedIds(s)
}

/**
 * Is the Schedule stage available at all?
 *
 * One transition, stated once: all included KGs complete. The spine, the
 * stage's own gate and Final Validation's prerequisite all read this, so
 * they cannot disagree about whether the schedule can be worked on.
 */
export function scheduleAvailableFor(
  s: Pick<Store, 'kgConfig' | 'opportunityId'>,
): boolean {
  return kgConfigurationCompleteFor(s)
}

export function scheduleDerivationFor(s: Store) {
  return scheduleDerivation(s, optionScheduleBuildingIds(s))
}

export function scheduleIssuesFor(s: Store): ScheduleIssue[] {
  return scheduleIssues(s, optionScheduleBuildingIds(s))
}

export function scheduleFingerprintFor(s: Store): string {
  return scheduleFingerprint(s, optionScheduleBuildingIds(s))
}

export function optionScheduleStageFor(s: Store): ScheduleStage {
  return optionScheduleStage(s, optionScheduleBuildingIds(s))
}

export function scheduleConfirmedFor(s: Store): boolean {
  return scheduleIsConfirmed(s, optionScheduleBuildingIds(s))
}

export function scheduleReadyToConfirmFor(s: Store): boolean {
  return scheduleReadyToConfirm(s, optionScheduleBuildingIds(s))
}

export function scheduleCriticalPhaseFor(s: Store) {
  return scheduleCriticalPhase(scheduleDerivationFor(s))
}

export function scheduleCriticalLeadFor(s: Store): number | null {
  return scheduleCriticalLeadHalfMonths(scheduleDerivationFor(s))
}

export function activeSchedulePhasesFor(s: Store): SchedulePhase[] {
  return activeSchedulePhases(s, optionScheduleBuildingIds(s))
}

/**
 * Final Validation is available when the schedule is confirmed — and it
 * STAYS available once a review has legitimately begun.
 *
 * The first half is the gate: not configuration completeness (that is the
 * SCHEDULE's prerequisite, one stage earlier), and not a visit.
 *
 * The second half is what the approved target shows. T-031 is a review with
 * nine of twelve sections read and an OPEN schedule issue beside them — a
 * state that only exists if losing the schedule confirmation reopens the
 * schedule SECTION rather than closing the whole stage. Slamming the door
 * on a reader who has already worked through nine sections, because a date
 * they were about to fix went stale, would throw away their work to enforce
 * an ordering they had already satisfied once.
 *
 * Nothing is weakened by it: the schedule section becomes a BLOCKER with an
 * exact route (`reviewSectionInputsFor`), and Save stays locked while any
 * blocker exists.
 */
export function finalValidationAvailableFor(s: Store): boolean {
  if (scheduleConfirmedFor(s)) return true
  return Object.keys(s.reviewAcknowledged).length > 0
    || s.reviewConfirmation !== null
}

/**
 * The twelve review sections, each with the fingerprint of what it currently
 * shows and its own findings.
 *
 * Every value is READ from its canonical authority here and nothing is
 * copied into review state — the ticket's data invariant ("Validation and
 * saved snapshot read canonical sources; they store no duplicate editable
 * totals"). What the review stores is a fingerprint, which is a statement
 * about values rather than a second copy of them.
 */
export function reviewSectionInputsFor(s: Store): ReviewSectionInput[] {
  const inputs: ReviewSectionInput[] = []
  const push = (
    id: ReviewSectionId, fingerprint: string, issues: ReviewIssue[],
  ) => { inputs.push({ id, fingerprint, issues }) }

  // 1 — the project baseline this Option inherited.
  const baseline = s.projectBaseline
  push('projectBaseline',
    baseline
      ? [baseline.projectId, baseline.at, baseline.buildingCount,
        baseline.bgfRSTotal, baseline.documentCount,
        baseline.conflictDecisions.length, baseline.reanalysisCount].join(':')
      : 'none',
    baseline ? [] : [{
      id: 'baselineMissing',
      sectionId: 'projectBaseline',
      severity: 'blocker',
      messageKey: 'vr3.review.issue.baselineMissing',
      route: 'project',
    }])

  // 2 — the confirmed and saved building scope.
  const scopeSaved = scopeIsSaved(s)
  push('buildings', scopeFingerprint(s), scopeSaved ? [] : [{
    id: 'scopeNotSaved',
    sectionId: 'buildings',
    severity: 'blocker',
    messageKey: 'vr3.review.issue.scopeNotSaved',
    route: 'buildingScope',
  }])

  // 3 — the six explicit scope decisions.
  const decisions = s.kgConfig
  push('scopeDecisions',
    decisions ? kgScopeFingerprint(decisions) : 'none',
    kgScopeDecisionsComplete(s) ? [] : [{
      id: 'scopeDecisionsOpen',
      sectionId: 'scopeDecisions',
      severity: 'blocker',
      messageKey: 'vr3.review.issue.scopeDecisionsOpen',
      values: { decided: kgDecidedScopeCount(s), total: KG_SCOPE_GROUPS.length },
      route: 'scopeBoundaries',
    }])

  // 4–9 — one section per cost group. An EXCLUDED group is a section too:
  // "out of scope by decision" is exactly the kind of thing a reviewer has
  // to see and acknowledge, and hiding it would be the D-016 defect again.
  for (const group of KG_SCOPE_GROUPS) {
    const sectionId = `kg${group.slice(3)}` as ReviewSectionId
    const progress = kgChapterProgressFor(s, group)
    const decision = decisions?.scope[group] ?? 'undecided'
    const fingerprint = progress
      ? [decision, progress.state, progress.requiredDecisions,
        progress.decidedDecisions, progress.selectedServiceCount,
        progress.invalidServiceIds.join(','),
        progress.blockedServiceIds.join(',')].join(':')
      : `${decision}:none`
    const blocked = progress !== null
      && progress.state !== 'complete'
      && progress.state !== 'outOfScope'
    push(sectionId, fingerprint, blocked ? [{
      id: `kgIncomplete:${group}`,
      sectionId,
      severity: 'blocker',
      messageKey: progress!.state === 'invalid'
        ? 'vr3.review.issue.kgInvalid'
        : 'vr3.review.issue.kgIncomplete',
      values: { group: `KG${NNBSP}${group.slice(3)}` },
      route: sectionId as ReviewIssue['route'],
    }] : [])
  }

  // 10 — Schnittstellen & Verantwortung (VR3-TGA-UX-00). The matrix left the
  // KG 400 fingerprint and is represented here exactly once. An unresolved
  // medium is a CONDITION the offer names — a permitted warning, never a
  // blocker (it gates neither the schedule nor the save) and never an amount.
  const responsibility = responsibilityFor(s)
  push('responsibility',
    responsibilityFingerprint(responsibility),
    (responsibility?.unresolved ?? []).map((medium): ReviewIssue => ({
      id: `responsibilityOpen:${medium.id}`,
      sectionId: 'responsibility',
      severity: 'permittedWarning',
      // One key per medium: the medium's name is a language, and an issue
      // stores identities, never sentences (recorded pitfall, TGA-01).
      messageKey: `vr3.review.issue.responsibilityOpen.${medium.id}`,
      route: 'responsibility',
    })))

  // 11 — the schedule. It can only be reached with a confirmed schedule, so
  // an issue here means the confirmation was LOST after the review began:
  // an edit, a withdrawn dependency acceptance, a building leaving the
  // scope. The sentence names which, because "not confirmed" is not a route.
  const scheduleStage = optionScheduleStageFor(s)
  const scheduleErrorList = scheduleErrors(s, optionScheduleBuildingIds(s))
  const scheduleWarningList = scheduleWarnings(s, optionScheduleBuildingIds(s))
  const scheduleIssueList: ReviewIssue[] = []
  if (scheduleStage !== 'CONFIRMED') {
    const first = scheduleErrorList[0] ?? scheduleWarningList[0] ?? null
    scheduleIssueList.push({
      id: 'scheduleNotConfirmed',
      sectionId: 'schedule',
      severity: 'blocker',
      messageKey: first
        ? first.messageKey
        : scheduleStage === 'STALE'
          ? 'vr3.review.issue.scheduleStale'
          : 'vr3.review.issue.scheduleNotConfirmed',
      values: first?.values,
      durationHalfMonths: first?.durationHalfMonths,
      route: 'schedule',
    })
  }
  push('schedule', scheduleFingerprintFor(s), scheduleIssueList)

  // 12 — assumptions and the warnings the Product permits to travel with an
  // indicative offer. These are `permittedWarning`, never blockers: an
  // indicative offer that could not carry a permitted assumption would not
  // be an indicative offer.
  const assumptions = baseline?.permittedAssumptionIds ?? []
  const openQuestionIds = baseline?.openQuestionIds ?? []
  push('assumptions',
    [assumptions.join(','), openQuestionIds.join(','),
      s.esConfirmed ? 'es' : '-', s.regionalfaktorActive ? 'rf' : '-'].join('#'),
    [
      ...assumptions.map((id): ReviewIssue => ({
        id: `assumption:${id}`,
        sectionId: 'assumptions',
        severity: 'permittedWarning',
        messageKey: 'vr3.review.issue.permittedAssumption',
        values: { assumption: id },
        route: 'project',
      })),
      ...(s.regionalfaktorActive ? [] : [{
        id: 'regionalfaktorInactive',
        sectionId: 'assumptions' as ReviewSectionId,
        severity: 'permittedWarning' as const,
        messageKey: 'vr3.review.issue.regionalfaktorInactive',
        route: 'scopeBoundaries' as ReviewIssue['route'],
      }]),
    ])

  // 13 — the canonical commercial result. A result whose own composition
  // does not sum to its own total is a release blocker (rule 32), and this
  // is the surface that says so instead of printing it anyway.
  const result = commercialResult(s)
  push('commercialResult',
    [result.version, result.total.exact.toFixed(2), result.totalLabel,
      result.coverage, result.uncertaintyPp,
      // VR3-03R: trust is part of this section's IDENTITY, not a note beside
      // it. Without it a result that went stale would carry the fingerprint
      // it had while trusted, and `advanceSavedVersion`'s idempotence check
      // would read the two as the same commitment.
      result.trust.status, result.trust.reason ?? '-'].join(':'),
    [
      ...(result.reconciles ? [] : [{
        id: 'resultDrift',
        sectionId: 'commercialResult' as ReviewSectionId,
        severity: 'blocker' as const,
        messageKey: 'vr3.review.issue.resultDrift',
        route: 'scopeBoundaries' as ReviewIssue['route'],
      }]),
      ...(result.trust.status === 'stale' ? [{
        id: 'resultStale',
        sectionId: 'commercialResult' as ReviewSectionId,
        severity: 'blocker' as const,
        messageKey: result.trust.reason === 'persistence'
          ? 'vr3.review.issue.resultUnsaved'
          : 'vr3.review.issue.resultStale',
        route: 'scopeBoundaries' as ReviewIssue['route'],
      }] : []),
      ...(result.coverage === 'subtotal' ? [{
        id: 'resultSubtotal',
        sectionId: 'commercialResult' as ReviewSectionId,
        severity: 'permittedWarning' as const,
        messageKey: 'vr3.review.issue.resultSubtotal',
        route: 'scopeBoundaries' as ReviewIssue['route'],
      }] : []),
      ...(result.uncertaintyPp > 25 ? [{
        id: 'resultUncertainty',
        sectionId: 'commercialResult' as ReviewSectionId,
        severity: 'permittedWarning' as const,
        messageKey: 'vr3.review.issue.resultUncertainty',
        values: { pp: result.uncertaintyPp },
        route: 'scopeBoundaries' as ReviewIssue['route'],
      }] : []),
    ])

  return inputs
}

export function reviewFingerprintFor(s: Store): string {
  return reviewFingerprint(reviewSectionInputsFor(s))
}

export function reviewProgressFor(s: Store): ReviewProgress {
  return reviewProgress(s, reviewSectionInputsFor(s))
}

export function reviewSectionStatusFor(
  s: Store, sectionId: ReviewSectionId,
): ReviewSectionStatus {
  const input = reviewSectionInputsFor(s).find((c) => c.id === sectionId)
  if (!input) return 'PENDING'
  return reviewSectionStatus(s, input)
}

export function optionReviewStageFor(s: Store): ReviewStage {
  return optionReviewStage(
    s, reviewSectionInputsFor(s), finalValidationAvailableFor(s),
  )
}

export function reviewReadyToConfirmFor(s: Store): boolean {
  return reviewReadyToConfirm(
    s, reviewSectionInputsFor(s), finalValidationAvailableFor(s),
  )
}

export function finalValidationConfirmedFor(s: Store): boolean {
  return reviewIsConfirmed(
    s, reviewSectionInputsFor(s), finalValidationAvailableFor(s),
  )
}

export function nextReviewSectionFor(s: Store): ReviewSectionId | null {
  return nextReviewSection(s, reviewSectionInputsFor(s))
}

export function optionSaveStageFor(s: Store): SaveStage {
  return optionSaveStage(
    s, s.activeOptionId, finalValidationConfirmedFor(s), reviewFingerprintFor(s),
  )
}

export function unsavedWorkingChangesFor(s: Store): boolean {
  return hasUnsavedWorkingChanges(s, s.activeOptionId, reviewFingerprintFor(s))
}

export function savedOptionVersionsFor(
  s: Pick<Store, 'savedOptionVersions'>, optionId: string | null,
): readonly SavedOptionVersion[] {
  return savedVersionsFor(s, optionId)
}

export function latestSavedOptionVersion(
  s: Pick<Store, 'savedOptionVersions'>, optionId: string | null,
): SavedOptionVersion | null {
  return latestSavedVersion(s, optionId)
}

/**
 * Is the client projection of the working copy valid RIGHT NOW?
 *
 * Checked at save time and stored on the saved version, so Client Mode reads
 * one recorded fact instead of re-deriving a projection every time it is
 * asked. A projection is valid when the Option has a saved building scope,
 * a complete configuration and a commercial result that reconciles: those
 * are the three things a client-facing number rests on.
 */
export function clientProjectionValidFor(s: Store): boolean {
  const result = commercialResult(s)
  return scopeIsSaved(s)
    && kgConfigurationCompleteFor(s)
    && result.reconciles
    // VR3-03R: a STALE total must not become a client-visible offer. This
    // tightens the VR3-04 predicate only in a state that did not previously
    // exist — before this ticket the result could not report staleness at
    // all — so the ordinary path is unchanged, and the failure path stops
    // committing a number the engine had already disowned.
    && result.trust.status === 'ready'
}

/**
 * THE Client Mode predicate, per Option.
 *
 * It replaces `canBeginConfiguration && configurationComplete`, which was
 * the audit's F-002: a working configuration nobody had reviewed was already
 * client-ready, because persistence was the only kind of commitment the
 * product had. Now a valid SAVED baseline is the only thing that unlocks a
 * meeting, and continuing to work never revokes it (M-3).
 */
export function clientModeAvailableForOption(
  s: Pick<Store, 'savedOptionVersions'>, optionId: string | null,
): boolean {
  return clientModeAvailableFor(s, optionId)
}

export function clientModeLockReasonFor(
  s: Pick<Store, 'savedOptionVersions'>, optionId: string | null,
): ClientModeLockReason | null {
  return clientModeLockReason(s, optionId)
}

export function savedClientBaseline(
  s: Pick<Store, 'savedOptionVersions'>, optionId: string | null,
): SavedOptionVersion | null {
  return clientBaselineFor(s, optionId)
}

/**
 * The reconciliation the receipt and the review both print: does the SAVED
 * baseline still say the same thing as the live canonical result?
 *
 * `true` with unsaved working changes is normal and expected — it means the
 * changes did not move the number. `false` is the honest statement that the
 * working copy has moved past its saved baseline commercially, which is
 * different from having moved at all.
 */
export function savedBaselineMatchesLiveResult(s: Store): boolean | null {
  const saved = latestSavedVersion(s, s.activeOptionId)
  if (!saved) return null
  const result = commercialResult(s)
  return savedResultMatchesLive(saved, {
    totalExact: result.total.exact.toFixed(2),
    totalLabel: result.totalLabel,
    coverage: result.coverage,
    uncertaintyPp: result.uncertaintyPp,
  })
}

/**
 * The reconciliation the live diagnostic reads (F-001).
 *
 * It answers the question the broken check only appeared to ask: do the
 * contributions the product is SHOWING sum to the total it is showing? The
 * replaced check read a two-entry excerpt out of an archived fixture run and
 * compared it against that run's full total — a comparison that could only
 * ever fail, and did, on a surface a user can reach.
 */
export function commercialReconciliation(s: Store): Readonly<{
  reconciles: boolean
  contributionsExact: Decimal
  groupedExact: Decimal
  totalExact: Decimal
  contributionCount: number
}> {
  const result = commercialResult(s)
  const contributionsExact = result.contributions
    .reduce((sum, d) => sum.plus(d.exact), new Decimal(0))
  const groupedExact = result.byCostGroup
    .reduce((sum, line) => sum.plus(line.exact ?? new Decimal(0)), new Decimal(0))
    .plus(result.contributions
      .filter((d) => d.block === 'discount')
      .reduce((sum, d) => sum.plus(d.exact), new Decimal(0)))
  const totalExact = result.total.exact
  return {
    reconciles: contributionsExact.equals(totalExact)
      && groupedExact.equals(totalExact)
      && result.contributions.length > 0,
    contributionsExact,
    groupedExact,
    totalExact,
    contributionCount: result.contributions.length,
  }
}

export function konfiguratorLocked(
  s: Pick<Store, 'buildings' | 'included' | 'buildingReviews'
    | 'buildingConfirmation' | 'buildingConflicts'> & Partial<BuildingScopeState>,
): boolean {
  return !canBeginConfiguration(s)
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
 * Options eligible for client presentation — a VALID SAVED BASELINE, and
 * nothing else (VR3-04, audit F-002).
 *
 * The replaced predicate was `canBeginConfiguration && configurationComplete`
 * per Option, argued at the time as "client-presentable and ready to export
 * are one question, not two". They are one question, and the answer both of
 * them needed was the one the product did not have: an explicit saved
 * baseline. Under the old predicate a configuration that was merely complete
 * — never reviewed, never confirmed, never saved by anybody — was already
 * client-ready, because continuous persistence was the only kind of
 * commitment that existed.
 *
 * `clientBaselineFor` is now the single authority (this ticket's done
 * condition: "Client Mode availability has one authoritative predicate"), and
 * it reads a RECORD rather than re-deriving a projection: the baseline was
 * validated when it was saved, and it is immutable, so continuing to work
 * never revokes a client's right to see what was saved (M-3).
 */
export function eligibleClientOptions(
  s: Pick<Store, 'options' | 'savedOptionVersions'>,
): Array<{ id: string; name: string }> {
  return s.options.filter((o) => clientModeAvailableFor(s, o.id))
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

/* ──────────────── VR3-05 · the client presentation scenario ───────────── */

/**
 * One derivation of a presentation state — baseline or scenario — through
 * the SAME canonical path preparation uses.
 *
 * `config` is the configuration that produced it, which is what Save as New
 * Option persists: the new Option is not "the baseline plus a note about
 * three changes", it is the exact configuration the client was looking at.
 */
export type ClientScenarioSnapshot = Readonly<{
  config: OptionConfig
  projection: Projection
  result: CommercialResult
}>

/**
 * The Save-as-new-Option commitment.
 *
 * Modelled on `OptionSaveCommit` rather than on a component's `useState`
 * because the failure contract is the same one VR3-04 already wrote down:
 * "Save-new failure retains name and changes and creates no partial Option."
 * A name typed into a dialog that unmounts on error is a name the presenter
 * has to retype in front of a client.
 */
export type ClientScenarioSaveCommit = Readonly<{
  sourceOptionId: string
  name: string
  stage: 'NAMING' | 'SAVING' | null
  errorKey: string | null
  /** The Option the last successful save created, for the receipt. */
  savedOptionId: string | null
}>

/** The configuration slice a scenario may address, from any Option config. */
function scenarioSliceOf(config: OptionConfig): ScenarioConfigSlice {
  return {
    kgConfig: config.kgConfig,
    scheduleEdits: config.scheduleEdits,
    schedulePhases: config.schedulePhases,
  }
}

/**
 * Derive one presentation state from a configuration.
 *
 * THE WHOLE POINT of this function is that it takes a CONFIGURATION and not
 * the store: `{ ...s, ...config }` is a new object, so a scenario is priced
 * by the canonical derivation without a single write anywhere. That is what
 * makes "the baseline snapshot remains byte-equivalent before and after
 * unsaved scenario editing" true by construction rather than by care.
 *
 * Throws exactly where `deriveCommercialResult` throws — the caller decides
 * whether a failure is a white screen or a retained last-trusted result, and
 * for the presentation it is always the latter.
 */
function deriveClientSnapshot(s: Store, config: OptionConfig): ClientScenarioSnapshot {
  const overlay = { ...s, ...config }
  const projection = projectProjection(overlay)
  return { config, projection, result: deriveCommercialResult(overlay, projection) }
}

/**
 * The saved Option the presentation is speaking for, as a configuration.
 *
 * `configForOption` and not the `SavedOptionVersion` record: the record
 * stores the RESULT of a save, not the configuration that produced it, and a
 * scenario needs a configuration to change. The saved record remains the
 * authority for what the presentation CLAIMS — `clientBaselineFor` names the
 * Option, its version and its saved total — and this is the state the story
 * is rendered from, exactly as it was before this ticket.
 */
export function clientBaselineConfig(s: Store): OptionConfig | null {
  const optionId = resolvedViewedOptionId(s)
  return optionId ? configForOption(s, optionId) : null
}

/**
 * The presentation's baseline derivation: the saved Option, unmodified.
 *
 * Guarded like `commercialSnapshot`: a derivation failure must not take the
 * client screen down mid-meeting. `null` is the honest answer and the shell
 * renders the projection-error state the ticket requires.
 */
export function clientBaselineSnapshot(s: Store): ClientScenarioSnapshot | null {
  const config = clientBaselineConfig(s)
  if (!config) return null
  try {
    return deriveClientSnapshot(s, config)
  } catch {
    return null
  }
}

/**
 * VR3-CP-00 — the SAME canonical derivation for ANY Option, by id.
 *
 * The Varianten layer compares Options, and a comparison column must state
 * exactly the numbers the chapters state for the same Option — total,
 * lead rate, uncertainty, duration, completion. Those come from the
 * commercial result, not from the legacy proposal projection, so a column
 * that read `projectionForOption` alone put two engines on one client
 * screen (3.980.335 € beside 38.740.000 € for the same Option). Guarded
 * like the baseline: `null` is the honest answer for a column that cannot
 * be derived, and the model states the missing basis rather than a number.
 */
export function clientSnapshotForOption(s: Store, optionId: string): ClientScenarioSnapshot | null {
  const config = configForOption(s, optionId)
  if (!config) return null
  try {
    return deriveClientSnapshot(s, config)
  } catch {
    return null
  }
}

/**
 * The schedule of the state the presentation is SHOWING.
 *
 * Derived from the presented configuration rather than from the store, so a
 * handover what-if moves the programme on the schedule page the same way a
 * service what-if moves the total on the investment page. `scheduleDerivationFor`
 * would have answered for the internal working copy — the right answer to a
 * different question, and the one that would have left the client looking at
 * a sequence that contradicts the decision they just watched being taken.
 */
export function clientScheduleDerivation(
  s: Store, snapshot: ClientScenarioSnapshot | null,
): ScheduleDerivation | null {
  if (!snapshot) return null
  const overlay = { ...s, ...snapshot.config }
  return scheduleDerivation(overlay, optionScheduleBuildingIds(overlay))
}

/** The presented state's schedule phases, in dependency order. */
export function clientSchedulePhases(
  s: Store, snapshot: ClientScenarioSnapshot | null,
): readonly SchedulePhase[] {
  if (!snapshot) return []
  const overlay = { ...s, ...snapshot.config }
  return activeSchedulePhases(overlay, optionScheduleBuildingIds(overlay))
}

/** The decisions this presentation may offer, in narrative order. */
export function clientPresentationDecisions(s: Store): readonly PresentationDecision[] {
  const config = clientBaselineConfig(s)
  if (!config) return []
  return availablePresentationDecisions(kgCatalogueFor(s), scenarioSliceOf(config))
}

/** The value a decision currently holds in the presented state. */
export function clientDecisionValue(
  s: Store, decision: PresentationDecision,
): string | null {
  const config = clientBaselineConfig(s)
  if (!config) return null
  return scenarioDecisionValue(
    s.clientScenario, decision, scenarioSliceOf(config), kgCatalogueFor(s),
  )
}

/**
 * What choosing `value` on `decision` would cost, against the SAVED baseline.
 *
 * The ticket's "supported in-context alternatives expose client-readable
 * consequence BEFORE commit": every option can state its own effect while it
 * is still just an option, because pricing one is a pure derivation over a
 * configuration nobody has to adopt first. Measured against the baseline
 * rather than against the current scenario so the three numbers on a control
 * are comparable with each other — a delta-against-the-last-click would
 * change every option's label every time any option was pressed.
 */
export function clientDecisionOptionDelta(
  s: Store, decision: PresentationDecision, value: string,
): Decimal | null {
  const config = clientBaselineConfig(s)
  const baseline = clientBaselineSnapshot(s)
  if (!config || !baseline) return null
  const catalogue = kgCatalogueFor(s)
  const sourceOptionId = resolvedViewedOptionId(s)
  if (!sourceOptionId) return null
  // A HYPOTHETICAL scenario: one decision, against the baseline, adopted by
  // nobody. It is never written to the store — it exists for the length of
  // this derivation and then it is garbage.
  const hypothetical = withDecision(
    emptyScenario(sourceOptionId), decision, value, scenarioSliceOf(config), catalogue,
  )
  try {
    const applied = applyScenarioChanges(config, hypothetical.changes, catalogue)
    const result = deriveClientSnapshot(s, applied)
    return result.result.total.exact.minus(baseline.result.total.exact)
  } catch {
    return null
  }
}

/** The value a decision holds in the SAVED baseline, ignoring the scenario. */
export function clientBaselineDecisionValue(
  s: Store, decision: PresentationDecision,
): string | null {
  const config = clientBaselineConfig(s)
  if (!config) return null
  return decisionValueIn(decision, scenarioSliceOf(config), kgCatalogueFor(s))
}

/** Decisions the scenario moved that leave a documented question open. */
export function clientScenarioWarnings(s: Store): readonly PresentationDecision[] {
  return scenarioOpenQuestions(s.clientScenario, clientPresentationDecisions(s))
}

/**
 * The state the presentation is currently SHOWING: baseline, or baseline
 * with the scenario's changes applied.
 *
 * On a derivation failure the last trusted scenario snapshot is returned
 * instead — the number on screen stays the last one that was true, and the
 * shell says so and offers revert/retry. Returning the BASELINE here would
 * have been worse than a failure: the client would see a total that silently
 * stopped answering the control they just used.
 */
export function clientPresentedSnapshot(s: Store): ClientScenarioSnapshot | null {
  const config = clientBaselineConfig(s)
  if (!config) return null
  const scenario = s.clientScenario
  if (!scenario || scenario.changes.length === 0) return clientBaselineSnapshot(s)
  const catalogue = kgCatalogueFor(s)
  // Applied to the WHOLE config rather than to the slice: the slice type is
  // the boundary declaring what a scenario may touch, and passing the whole
  // config through a function typed by that boundary keeps the guarantee
  // while returning something the canonical derivation accepts unchanged.
  const scenarioConfig = applyScenarioChanges(config, scenario.changes, catalogue)
  try {
    return deriveClientSnapshot(s, scenarioConfig)
  } catch {
    return s.clientScenarioTrusted
  }
}

/**
 * Is the presented number the one the current decisions imply?
 *
 * `false` means a derivation failed and the screen is holding the last
 * trusted scenario result. It is the scenario's own equivalent of
 * `CommercialTrust.status === 'stale'`, and the shell must say it in words —
 * a stale total that looks fresh is the one failure a client cannot detect.
 */
export function clientScenarioTrustedNow(s: Store): boolean {
  const config = clientBaselineConfig(s)
  if (!config) return false
  const scenario = s.clientScenario
  if (!scenario || scenario.changes.length === 0) return clientBaselineSnapshot(s) !== null
  const catalogue = kgCatalogueFor(s)
  try {
    deriveClientSnapshot(s, applyScenarioChanges(config, scenario.changes, catalogue))
    return true
  } catch {
    return false
  }
}

/**
 * The scenario's signed delta against the saved baseline, or `null` when the
 * presentation is at the baseline.
 *
 * Measured between two derivations of the SAME function over two
 * configurations that differ only by the change set. An empty change set
 * therefore yields exactly zero — not "approximately zero", not "zero
 * because we restored the fields we remembered".
 */
export function clientScenarioDelta(s: Store): Decimal | null {
  if (scenarioChangeCount(s.clientScenario) === 0) return null
  const baseline = clientBaselineSnapshot(s)
  const presented = clientPresentedSnapshot(s)
  if (!baseline || !presented) return null
  return presented.result.total.exact.minus(baseline.result.total.exact)
}

/** Is a name free for a new Option in this Opportunity? */
export function clientScenarioNameAvailable(s: Store, name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length === 0) return false
  return !s.options.some((o) => o.name.trim().toLowerCase() === trimmed.toLowerCase())
}

/** The name Save as New proposes: the source's name plus the moved decision. */
export function clientScenarioProposedName(s: Store): string {
  const sourceId = resolvedViewedOptionId(s)
  const source = s.options.find((o) => o.id === sourceId)
  const base = source?.name ?? 'Option'
  const proposal = `${base} · Szenario`
  if (clientScenarioNameAvailable(s, proposal)) return proposal
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${proposal} ${n}`
    if (clientScenarioNameAvailable(s, candidate)) return candidate
  }
  return proposal
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
  // VR3-03: the two decisions the unified Konfigurator records. They exist
  // here for the same reason every other case does — the consequence the
  // user is promised before the click has to be computed by the SAME
  // function that computes it after, or the promise and the outcome drift.
  | { kind: 'kgScope'; group: KgScopeGroup; value: KgScopeDecision }
  | { kind: 'kgService'; serviceId: string; value: KgServiceDecisionRecord }

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
    case 'kgScope':
      // The legacy `coverage` mirror moves WITH the decision, in the same
      // hypothetical state: every released consumer of `coverage` (the rail's
      // DIN 276 rows, the export preflight, the client projection) would
      // otherwise preview a scope that disagrees with the total beside it.
      return s.kgConfig
        ? {
          ...s,
          kgConfig: {
            ...s.kgConfig,
            scope: { ...s.kgConfig.scope, [change.group]: change.value },
          },
          coverage: {
            ...s.coverage,
            [change.group]: coverageStateOfKgDecision(change.value),
          },
        }
        : s
    case 'kgService':
      return s.kgConfig
        ? {
          ...s,
          kgConfig: {
            ...s.kgConfig,
            services: { ...s.kgConfig.services, [change.serviceId]: change.value },
          },
        }
        : s
  }
}

/**
 * The legacy `Coverage` value a KG scope decision maps to.
 *
 * `undecided` becomes `'unknown'` — the third state the released type always
 * had and `migrateCoverage` used to erase on read. Erasing it was correct
 * while no surface could express it; now one can, and reviving the value is
 * what lets the released consumers (`deriveCompleteness`, the rail, the
 * export preflight) keep reading ONE coverage instead of two.
 */
function coverageStateOfKgDecision(decision: KgScopeDecision): CoverageState {
  return decision === 'included' ? 'included'
    : decision === 'excluded' ? 'excluded'
      : 'unknown'
}

/** The legacy `Coverage` a whole KG configuration implies. */
export function coverageFromKgDecisions(decisions: KgDecisions): Coverage {
  const coverage: Coverage = {
    ...INITIAL_COVERAGE,
    // KG 100 and KG 800 are not decidable in this Product; the KG
    // configuration says nothing about them and must not pretend to.
    KG_100: 'notApplicable',
    KG_800: 'excluded',
  }
  for (const group of KG_SCOPE_GROUPS) {
    coverage[group] = coverageStateOfKgDecision(decisions.scope[group])
  }
  return coverage
}

/**
 * SIDEBAR 02 (backlog 41b8ab39, SB-06): which of the option-level scope-
 * catalog groups (KG 200/500/600) are `included` but genuinely have no
 * price basis — as opposed to a genuinely DECIDED zero-rate variant (e.g.
 * "Baufreies Grundstück"), which is a real, calculated €0 and not a gap
 * (rule 16 forbids the latter, not the former). It is a completeness
 * CLASSIFICATION of an existing decision, feeding the same
 * `IncompleteReason` mechanism `deriveCompleteness` (engine) already
 * produces per building.
 *
 * The criterion itself no longer lives here. It is
 * `unpricedScopeCatalogPositions` (`engine/scopeCatalog.ts`), beside the
 * calculator whose `null` it classifies, because the same question is now
 * asked by four surfaces and a second copy of the criterion diverges on
 * the first edit.
 *
 * TWO defects the previous local criterion carried, both fixed by moving it:
 *
 * 1. **It required the WHOLE GROUP to price to zero** (`!groupSum(…)
 *    .isZero() → continue`), so a group that prices ONE position claimed a
 *    complete total while other included positions stayed unpriced. KG 200
 *    hits this on its own defaults: `kg200-03` (20.000 €/Gebäude, quantity
 *    derived from the project) and `kg200-06` (15.000 € pauschal) both
 *    price, while `kg200-02` (Bodenaushub-Entsorgung, 12 €/t) and
 *    `kg200-04` (Private Erschließung, 30 €/m²) are included with a
 *    non-zero rate and NO quantity. Including KG 200 therefore produced a
 *    total labelled complete with two silently dropped positions inside it
 *    — exactly the aggregate claim rule 16 forbids.
 * 2. **It treated an entered zero as a missing quantity** (`qty === null
 *    || qty.lte(0)`). A quantity of zero is an answer: that scope is not in
 *    this project, and the position is a calculated €0, not a gap.
 *
 * The group list stays the return type because `IncompleteReason` speaks in
 * cost groups; the POSITIONS behind it are returned separately for the
 * surfaces that must name them.
 */
function unpricedScopeCatalogGroups(
  groups: readonly ('KG_200' | 'KG_500' | 'KG_600')[],
  isActive: (g: 'KG_200' | 'KG_500' | 'KG_600') => boolean,
  positions: readonly UnpricedScopePosition[],
): CostGroup[] {
  return groups.filter((g) => isActive(g) && positions.some((p) => p.kg === g))
}

/**
 * The Bauzeit hero, unchanged from the released implementation and extracted
 * so both pricing bases read ONE schedule.
 *
 * Schedule is VR3-04's stage; this ticket must not invent a delivery window
 * for the VR3 projects, so the KG-configuration basis keeps the same fixture
 * schedule the released product already shows rather than a second answer.
 *
 * Rule 39: Bauzeit is `max(start + dauer)` over the included buildings, never
 * a sum and never one arbitrarily chosen building.
 */
function proposalDuration(
  s: Pick<Store, 'buildings' | 'included' | 'scopeBuildingId' | 'constructionStartDate'>,
): DurationDisplay {
  const list = scopedBuildings(s)
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
  return presentDuration(
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
}

type ProjectionInput = Pick<Store, 'buildings' | 'activeBuildingId' | 'included' | 'coverage'
  | 'fields' | 'esConfirmed' | 'regionalfaktorActive' | 'kg300' | 'kg700Mode'
  | 'risikoAktiv' | 'scopeBuildingId' | 'discountPercent'
  | 'configurationMode' | 'sharedConfiguration' | 'buildingReviews'
  | 'constructionStartDate' | 'scopeCatalogChoices' | 'scopeCatalogQuantities'>
  & Partial<Pick<Store, 'kgConfig' | 'opportunityId' | 'scopeBuildings'
    | 'scopeSelected' | 'scopeEdits'>>

/**
 * ONE projection, TWO bases (VR3-03).
 *
 * The `Projection` shape is unchanged, and that is the point: the rail, the
 * comparison screen, the export preflight, the client projection and every
 * snapshot already read it, so switching what PRICES an Option cannot make
 * two surfaces disagree about the same Option. What changes is only where
 * the drivers come from.
 *
 * An Option with a KG configuration is priced from it. An Option without one
 * — a directly driven store, a payload saved before this contract — keeps the
 * released proposal engine untouched. The switch is the presence of the
 * configuration, never a flag someone has to remember to set.
 */
function computeProjection(s: ProjectionInput): Projection {
  const catalogue = kgCatalogueOf(s)
  if (s.kgConfig && catalogue) return kgConfigurationProjection(s, catalogue, s.kgConfig)
  return proposalProjection(s)
}

/** The catalogue this state prices against, or `null`. */
function kgCatalogueOf(s: Partial<Pick<Store, 'opportunityId'>>): KgCatalogue | null {
  return kgCatalogue(s.opportunityId ?? null)
}

/**
 * The Option's commercial result, derived from its own KG configuration.
 *
 * Every euro here is a declared demonstration amount from
 * `src/fixtures/kg-configuration.json`, summed by
 * `src/engine/kgConfiguration.ts`. Nothing is a coefficient this ticket
 * invented, and no released formula is touched: the drivers ARE the
 * configuration, so the Kostentreiber, the DIN 276 table and the total are
 * three views of one list rather than three calculations (F-001).
 */
function kgConfigurationProjection(
  s: ProjectionInput, catalogue: KgCatalogue, decisions: KgDecisions,
): Projection {
  const drivers = kgDrivers(catalogue, decisions)
  const amounts = kgGroupAmounts(catalogue, decisions)
  const beforeDiscount = kgTotal(catalogue, decisions)
  const allDrivers: Driver[] = [...drivers]
  if (s.discountPercent && !s.discountPercent.isZero()) {
    const factor = s.discountPercent.div(100)
    allDrivers.push({
      key: 'rabatt',
      origin: 'decision',
      block: 'discount',
      exact: beforeDiscount.mul(factor).negated(),
      label: `Rabatt ${formatDE(s.discountPercent, 1)}${NNBSP}%`,
      scopeRefs: [],
      basis: { kind: 'factor', appliedTo: beforeDiscount, factor },
    })
  }
  const total = beforeDiscount.plus(sumOfBlock(allDrivers, 'discount'))
  const kgSplitFull: Projection['kgSplit'] = {
    KG_300: amounts.KG_300 ?? new Decimal(0),
    KG_400: amounts.KG_400 ?? new Decimal(0),
    ...(amounts.KG_200 ? { KG_200: amounts.KG_200 } : {}),
    ...(amounts.KG_500 ? { KG_500: amounts.KG_500 } : {}),
    ...(amounts.KG_600 ? { KG_600: amounts.KG_600 } : {}),
    ...(amounts.KG_700 ? { KG_700: amounts.KG_700 } : {}),
  }
  // Completeness is a statement about the SCOPE, not about the arithmetic.
  // Six explicit decisions and no open service decision make it a total;
  // anything less is a subtotal of the positions that ARE priced, which is
  // exactly what rule 16 and R-18 require instead of a confident zero.
  const undecidedGroups = KG_SCOPE_GROUPS.filter((g) => decisions.scope[g] === 'undecided')
  const openDecisions = openKgDecisionCount(catalogue, decisions)
  const unpriced = unpricedIncludedKgGroups(catalogue, decisions)
  const incompleteReasons: IncompleteReason[] = [
    ...(undecidedGroups.length > 0
      ? [{ code: 'coverageUnknown' as const, groups: [...undecidedGroups] }] : []),
    ...(unpriced.length > 0
      ? [{ code: 'includedUnpriced' as const, groups: [...unpriced] }] : []),
    ...(openDecisions > 0
      ? [{ code: 'openMaterialIssues' as const, count: openDecisions }] : []),
  ]
  const completeness = incompleteReasons.length === 0 ? 'complete' : 'incomplete'
  const scopedBuildingList = kgScopeBuildings(s)
  const result: BuildingResult = {
    buildingId: scopedBuildingList.map((b) => b.id).join('+') || 'kg-configuration',
    drivers: allDrivers,
    bauwerk: (amounts.KG_300 ?? new Decimal(0)).plus(amounts.KG_400 ?? new Decimal(0)),
    total: present(total),
    totalLabel: calculationTotalLabel(completeness, DECLARED_PRICING_SCOPE),
    completeness,
    incompleteReasons,
  }
  const areas = kgScopeAreas(s, scopedBuildingList)
  // Rule 39: unit values are derived FROM the sums, never averaged, and a
  // complex names BGF above ground — the denominator the label promises.
  const denominator = areas.bgfAbove.gt(0) ? areas.bgfAbove : new Decimal(1)
  const leadRate = scopedBuildingList.length > 1 || areas.wfl === null
    ? (areas.nuf !== null && scopedBuildingList.length === 1 && areas.wfl === null
      ? rate(total, areas.nuf, 'NUF_DIN277')
      : rate(total, denominator, 'BGF_ABOVE_GROUND'))
    : rate(total, areas.wfl, 'WFL_WOFLV')
  return {
    result,
    kgSplit: kgSplitFull,
    discountDriver: allDrivers.find((d) => d.key === 'rabatt') ?? null,
    leadRate,
    secondaryRateBgf: rate(total, denominator, 'BGF_ABOVE_GROUND'),
    perUnit: areas.units === null || areas.units.lte(0)
      ? null
      : rate(total, areas.units, 'WOHNEINHEITEN'),
    duration: proposalDuration(s),
    // This pricing basis has never applied risk surcharges: it prices from
    // the KG configuration's declared amounts, and `riskDriver` is not part
    // of it. The list is therefore EMPTY, which is the honest answer —
    // reporting the applied risks here would tell every consumer the
    // surcharge reached a price it never reached.
    riskBasisStates: [],
    aboveGround: present(total.minus(areas.belowGroundShare)),
    belowGround: present(areas.belowGroundShare),
    // The demonstration band is DECLARED by the fixture, not narrowed by a
    // rule this ticket owns: an indicative offer's uncertainty is a Product
    // statement about the evidence, and inventing a narrowing here would be
    // inventing commercial semantics (D-19).
    uncertaintyPp: Number.parseFloat(catalogue.uncertaintyPercent),
  }
}

const DECLARED_PRICING_SCOPE = 'Grundleistung All3'

/** The Option's selected scope buildings, or an empty list. */
function kgScopeBuildings(s: ProjectionInput): readonly ScopeBuilding[] {
  const buildings = s.scopeBuildings ?? []
  const selected = s.scopeSelected ?? {}
  const chosen = buildings.filter((b) => selected[b.id])
  return chosen.length > 0 ? chosen : buildings
}

/**
 * The denominators the lead metric is allowed to use.
 *
 * `null` is a real answer: a building whose WFL is unknown must never borrow
 * another denominator under the same label (DATA-001), and a complex never
 * sums WFL and NUF into one figure (rule 39 / R-11).
 */
function kgScopeAreas(s: ProjectionInput, buildings: readonly ScopeBuilding[]) {
  const metric = (b: ScopeBuilding, key: ScopeMetricKey): Decimal | null => {
    const raw = scopeMetricValue({ scopeEdits: s.scopeEdits ?? {} }, b, key)
    if (raw === null || raw.trim() === '') return null
    try {
      const value = new Decimal(raw)
      return value.isFinite() ? value : null
    } catch {
      return null
    }
  }
  const sumOf = (key: ScopeMetricKey): Decimal | null => {
    const values = buildings.map((b) => metric(b, key))
    return values.every((v): v is Decimal => v !== null) && values.length > 0
      ? values.reduce((a, v) => a.plus(v), new Decimal(0))
      : null
  }
  const bgfAbove = sumOf('bgfRSAbove') ?? new Decimal(0)
  const bgfBelow = sumOf('bgfRSBelow') ?? new Decimal(0)
  const bgfTotal = bgfAbove.plus(bgfBelow)
  return {
    bgfAbove,
    wfl: sumOf('wfl'),
    nuf: sumOf('nuf'),
    units: sumOf('units'),
    /** Only for the released above/below split the rail already renders. */
    belowGroundShare: bgfTotal.isZero()
      ? new Decimal(0)
      : bgfBelow.div(bgfTotal),
  }
}

function proposalProjection(s: ProjectionInput): Projection {
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

  // SIDEBAR 02 (backlog 41b8ab39, SB-06/AC-3/AC-4): an included scope-
  // catalog position with no price basis is an option-level completeness
  // fact `calculateBuilding`/`deriveCompleteness` (engine, per-building)
  // cannot see — it is computed once for the whole option here, not per
  // building. Folded into the SAME `completeness`/`incompleteReasons`
  // fields those already populate, not a second mechanism.
  //
  // Computed HERE, before the risk surcharges below, because the KG 200
  // risk basis depends on it: a group that still owes a position cannot
  // hand a complete denominator to a percentage.
  const unpricedScopePositions = unpricedScopeCatalogPositions(
    ALL_SCOPE_CATALOG_OPTIONS.filter(
      (o) => o.kg !== 'KG_800' && scopeCatalogActive(o.kg),
    ),
    s.scopeCatalogChoices, scopeQuantityOf, kg300Plus400,
  )

  // Надбавки за риск — аддитивно после блока Bauwerk (calculation-spec §2:
  // «модификаторы мультипликативны до регионального фактора, надбавки и
  // скидка — аддитивны после»). База каждой — своя группа затрат, поэтому
  // считается от разбиения блока, а не от итога: включив надбавку в базу
  // распределения, мы растворили бы её в KG 300 — она перестала бы быть
  // отдельной строкой и вдобавок увеличила бы собственную базу.
  //
  // Порядок вызова: ПОСЛЕ каталога KG 200, потому что база драйвера
  // Bestand/Abbruch (calculation-spec §1.4, +5 % от KG 200) — это уже
  // посчитанная сумма включённых позиций KG 200, а не доля блока Bauwerk:
  // KG 200 в `K_base` не входит вовсе. Суммы блоков ниже считаются от
  // готового списка, поэтому перестановка вкладов внутри `optDrivers`
  // ничего не двигает — двигало бы отсутствие базы.
  const kg200RiskBasis: Kg200Basis = !scopeCatalogActive('KG_200')
    ? { kind: 'notIncluded' }
    : unpricedScopePositions.some((position) => position.kg === 'KG_200')
      ? { kind: 'notDetermined' }
      : {
          kind: 'amount',
          exact: optDrivers
            .filter((d) => d.scopeRefs.includes('KG 200'))
            .reduce((sum, d) => sum.plus(d.exact), new Decimal(0)),
        }
  const riskBases: RiskBases = { kg300Exact, kg200: kg200RiskBasis }
  const riskBasisStates: RiskBasisState[] = []
  for (const risk of RISK_ITEMS) {
    if (!s.risikoAktiv[risk.id]) continue
    const { basis, driver } = riskOutcome(risk, riskBases)
    riskBasisStates.push({ riskId: risk.id, basis })
    if (driver) optDrivers.push(driver)
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
  // `block !== 'surcharge'` states GENERALLY what the paragraph above says
  // about KG 300/400: a DIN 276 group row is the structural cost of that
  // group, never that cost plus a risk surcharge standing on it. Until the
  // KG 200 driver existed, only KG 320/KG 300 carried a surcharge and both
  // rows were assembled from `effectiveKgSplit` rather than from this
  // sweep, so the omission was invisible; `Bestand / Abbruchumfang` tags
  // `KG 200`, whose row IS assembled from this sweep, and would have been
  // counted twice — once in its own reconciliation line, once inside the
  // group it surcharges.
  const kgGroupSum = (label: string) => allDrivers
    .filter((d) => d.scopeRefs.includes(label) && d.block !== 'surcharge')
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
  const unpricedScopeGroups = unpricedScopeCatalogGroups(
    ['KG_200', 'KG_500', 'KG_600'], scopeCatalogActive, unpricedScopePositions,
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
  const duration = proposalDuration(s)

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
    riskBasisStates,
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
  /**
   * THE commercial transaction (VR3-03R, audit G-06 and G-07).
   *
   * WHAT WENT WRONG BEFORE. VR3-03 published the rail's causal line from a
   * helper (`publishCommercialChange`) that two actions out of thirteen
   * remembered to call. Everything else that moved the total — `undo` most
   * visibly, since its button lives INSIDE the rail — moved it silently and
   * left the previous explanation standing. Reproduced live on the ordinary
   * path: include all six cost groups, undo the sixth, and the total drops
   * by 490.000 EUR while the rail still reads "KG 700 enthalten · +
   * 490.000 EUR". The rail did not merely lose its explanation; it asserted
   * the opposite of the truth, confidently, in the one place a salesperson
   * looks to answer a client's "why".
   *
   * This is the SAME lesson `preview: null` above already learned, one
   * ticket on: a rule that lives in each action's memory is a rule the next
   * action forgets. So the door enforces it instead.
   *
   * THREE OBLIGATIONS, ONE PLACE:
   *
   * · CAUSALITY. An event that names its cause publishes it with the delta
   *   measured against the shared baseline. An event that moves the total
   *   WITHOUT naming a cause clears the old one — "I cannot tell you why
   *   this moved" is a truthful answer and a stale label is not. An event
   *   that moves nothing leaves the standing explanation alone, because it
   *   is still the last thing that moved the number.
   *
   * · VERSION. `commercialResultVersion` documented itself as incrementing
   *   "whenever the numbers change" while only two actions bumped it. Now
   *   the door bumps it exactly when the total actually moved, so the field
   *   means what it says and two surfaces comparing versions are comparing
   *   something real.
   *
   * · TRUST. The derivation runs here, once, and its outcome is recorded:
   *   success refreshes the last trusted snapshot, failure marks the result
   *   stale and leaves that snapshot — and the baseline, and the standing
   *   cause — exactly as they were. Nothing falls to zero.
   */
  const settleCommercial = (
    e: Pick<JournalEvent, 'cause' | 'deltaExact'>, seq: number,
  ) => {
    const cause = e.cause
    const state = get()
    let fresh: CommercialSnapshot | null = null
    try {
      const projection = state.projection()
      fresh = { result: deriveCommercialResult(state, projection), projection }
    } catch {
      fresh = null
    }

    if (!fresh) {
      /**
       * The engine could not answer. Everything the reader currently sees
       * stays exactly as it is — that is the point — and only the verdict
       * about it changes.
       *
       * THE STANDING CAUSE GOES (VR3-03R rework, QA-01). A decision has just
       * been made and could not be priced, so the previous explanation is no
       * longer the last thing that happened to this offer: leaving it would
       * be the stale-label defect G-06 exists to forbid, arriving through
       * the outage instead of through an unattributed mutation.
       *
       * The decision itself is REMEMBERED, so recovery can still explain it.
       * One pending cause can be attributed to the whole accumulated
       * movement once the engine answers again; a second one makes that
       * attribution a guess, and `pendingCause` collapses to `null` to say
       * so rather than credit one decision with another's money.
       */
      set((current) => ({
        lastCommercialChange: null,
        commercialPendingCause: current.commercialPendingCount === 0
          ? cause ?? null
          : null,
        commercialPendingCount: current.commercialPendingCount + 1,
        commercialTrust: current.commercialTrust.status === 'stale'
          ? current.commercialTrust
          : {
            status: 'stale',
            reason: 'calculation',
            sinceIso: lastTrustedCommercial?.result.derivedAtIso ?? null,
            attempts: 0,
          },
      }))
      return
    }

    const after = fresh.result.total.exact
    /**
     * THE FIRST result of a session has nothing to have moved FROM.
     *
     * The baseline starts at zero, and `after − 0` is the whole total, not a
     * delta — caught live on the exact candidate: the first scope decision
     * after a reload published "KG 500 nicht enthalten · + 6.180.000 €",
     * which is the total wearing a delta's sign. So the first settle
     * ESTABLISHES the baseline and asserts nothing about movement. There is
     * no standing explanation to clear either: `lastCommercialChange` is
     * transient by contract, so a freshly loaded rail has none.
     */
    const seeding = lastTrustedCommercial === null
    /**
     * The delta a CAUSAL event publishes is the one the action measured
     * around its own write (`deltaExact`), not a difference against the
     * shared baseline. The action is the only place that knows the total
     * immediately before its own mutation; the baseline exists for the
     * other question — whether a CAUSELESS event moved the number — and
     * using it for both is how the seeding defect above arose.
     */
    const signed = e.deltaExact ?? new Decimal(0)
    const moved = !seeding && !after.equals(state.commercialBaselineTotal)

    lastTrustedCommercial = fresh
    set((current) => ({
      commercialBaselineTotal: after,
      commercialResultVersion: moved
        ? current.commercialResultVersion + 1
        : current.commercialResultVersion,
      // A calculation that just succeeded is not stale. A PERSISTENCE
      // failure is a different claim about the same result and is not
      // cleared here — only a successful write clears that one.
      commercialTrust: current.commercialTrust.reason === 'persistence'
        ? current.commercialTrust
        : COMMERCIAL_TRUSTED,
      lastCommercialChange: cause
        ? {
          id: `chg-${seq}`,
          labelDe: cause.de,
          labelEn: cause.en,
          signedExact: signed,
          group: cause.group,
          atIso: new Date().toISOString(),
        }
        // An unattributable move clears the explanation; a move of zero
        // leaves the standing one, which is still the last real cause.
        : moved ? null : current.lastCommercialChange,
      // A settle that succeeded leaves nothing pending: this event's own
      // cause has just been published (or deliberately cleared), so an
      // earlier outage's memory would only mislead the next recovery.
      commercialPendingCause: null,
      commercialPendingCount: 0,
    }))
  }

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
            statusKey: e.labelKey,
            statusValues: e.labelValues,
            deltaText: e.deltaExact ? dc29Delta(e.deltaExact) : null,
          }
        : null,
      preview: null,
    })
    settleCommercial(e, seq)
  }

  /**
   * One selection change, journalled and reversible.
   *
   * Deselecting also moves the REVIEW focus, because a panel reviewing a
   * building that is no longer in scope is a metric detached from its
   * owner — the one thing the building-scope surface exists to prevent.
   */
  /**
   * One writer for every phase override of the schedule.
   *
   * Three actions, one journalled transition: duration, lead and dependency
   * are the same kind of change to the same record, and three copies of this
   * closure would be three places for the inverse to drift.
   *
   * ACCEPTING A DEPENDENCY IS WITHDRAWN BY EDITING IT. Changing the
   * dependency a documented question hangs on drops that phase's acceptance:
   * the question was answered ABOUT a dependency, so a different dependency
   * has not been answered.
   */
  const editSchedulePhase = (
    phaseId: string, patch: SchedulePhaseEdit, labelKey: string,
  ) => {
    const s = get()
    const phase = s.schedulePhases.find((candidate) => candidate.id === phaseId)
    if (!phase) return
    const previousEdits = s.scheduleEdits
    const previousConfirmed = s.scheduleDependencyConfirmed
    const nextEdits: Record<string, SchedulePhaseEdit> = {
      ...previousEdits,
      [phaseId]: { ...previousEdits[phaseId], ...patch },
    }
    const nextConfirmed = Object.hasOwn(patch, 'dependsOn')
      ? previousConfirmed.filter((id) => id !== phaseId)
      : previousConfirmed
    const write = (
      edits: Record<string, SchedulePhaseEdit>, confirmed: readonly string[],
    ) => set({ scheduleEdits: edits, scheduleDependencyConfirmed: confirmed })
    write(nextEdits, nextConfirmed)
    apply({
      kind: 'value.edited',
      label: `Terminplan geändert · ${phaseId}`,
      labelKey,
      labelValues: { phase: phaseId },
      deltaExact: null,
      inverse: () => write(previousEdits, previousConfirmed),
      forward: () => write(nextEdits, nextConfirmed),
    })
  }

  const applyScopeSelection = (id: string, next: boolean, name: string) => {
    const capture = (state: Pick<Store, 'scopeSelected' | 'scopeActiveBuildingId'>) => ({
      scopeSelected: state.scopeSelected,
      scopeActiveBuildingId: state.scopeActiveBuildingId,
    })
    const before = capture(get())
    const write = (value: boolean) => set((state) => {
      const selected = { ...state.scopeSelected, [id]: value }
      const stillSelected = state.scopeBuildings
        .filter((building) => selected[building.id])
        .map((building) => building.id)
      const active = value
        ? id
        : state.scopeActiveBuildingId === id
          ? stillSelected[0] ?? null
          : state.scopeActiveBuildingId
      return { scopeSelected: selected, scopeActiveBuildingId: active }
    })
    write(next)
    const after = capture(get())
    apply({
      kind: 'option.selected',
      label: next
        ? `${name} in den Angebotsumfang aufgenommen`
        : `${name} aus dem Angebotsumfang genommen`,
      labelKey: next ? 'vr3.journal.scopeBuildingAdded' : 'vr3.journal.scopeBuildingRemoved',
      labelValues: { building: name },
      deltaExact: null,
      inverse: () => set(before),
      forward: () => set(after),
    })
  }

  /**
   * The Option's PRICING PROJECTION of the baseline the user just confirmed.
   *
   * VR3-02 moved the Option's building scope onto the project baseline; the
   * proposal record in `buildingReviews` is what the calculation engine
   * reads, and it is no longer a surface the user edits. Confirming the
   * Option's baseline therefore has to carry through to it, or the engine
   * would keep pricing an unconfirmed building class — a change in released
   * commercial behaviour that no one asked for and no one would see.
   *
   * The WFL disagreement in the proposal fixture is resolved to its
   * CUSTOMER-CONFIRMED candidate, which is the value every released journey
   * already inherited (the retired project preamble adopted it before the
   * Option existed, and `createOption` still inherits it when the project
   * carries it). Preserving that is not a new decision — leaving it open
   * would be the change.
   */
  const syncPricingProjection = () => {
    if (wflConflict(get()).state === 'open') get().resolveWflConflict('customer')
    for (const id of includedBuildingIds(get())) {
      if (!buildingConfirmed(get(), id)) get().confirmBuilding(id)
    }
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
    savedOptionVersions: {},
    optionSaveCommit: null,
    activeDelta: null,
    preview: null,
    undoToast: null,
    optionCommit: null,
    scopeCommit: null,
    scopeRemovalPending: null,
    mode: 'intern',
    constructionStartDate: null,
    level: 'liste',
    opportunityId: null,
    projectAnalyses: initialProjectAnalyses(),
    projectBaseline: null,
    projectStage: 'documents',
    understandingTab: 'overview',
    projectParamsConfirmed: false,
    noteText: '',
    noteSavedAt: null,
    noteSyncedAt: null,
    options: [],
    activeOptionId: null,
    viewedOptionId: null,
    clientScenario: null,
    clientScenarioTrusted: null,
    clientScenarioExportAcknowledged: false,
    clientScenarioSave: null,
    presentationChapter: null,
    optionSeq: 0,
    discountPercent: null,
    offerDraft: {
      // VR3-01: no project name is baked into the default draft. It named a
      // retired fixture row, so every offer for either demonstration
      // project opened with the wrong project in its first sentence. The
      // sender fills the project in; the Product does not guess it.
      body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser '
        + 'indikatives Angebot.\n\n'
        + 'Mit freundlichen Grüßen',
      attachments: ['angebot', 'kostentreiber', 'annahmen'],
    },

    uiLanguage: 'de',
    lastCommercialChange: null,
    commercialResultVersion: 0,
    // The baseline starts at zero and the first commit through the door
    // establishes the real one. It is deliberately NOT seeded from a
    // derivation at construction time: the store is built before its
    // fixtures are chosen, and a baseline captured from the wrong Option is
    // a delta measured against a different offer.
    commercialBaselineTotal: new Decimal(0),
    commercialTrust: COMMERCIAL_TRUSTED,
    commercialPendingCause: null,
    commercialPendingCount: 0,
    commercialFault: false,
    density: 'komfortabel',

    projection: () => computeProjection(get()),

    /**
     * Recover the commercial result (VR3-03R, audit G-07; target L).
     *
     * IDEMPOTENT BY CONSTRUCTION: it re-derives and records the outcome, so
     * calling it twice on a healthy result changes nothing and calling it
     * twice on a broken one reports two failed attempts rather than
     * pretending the second one was the first. Nothing about the user's
     * decisions is touched on either path — recovery that could lose work
     * is not recovery.
     *
     * A PERSISTENCE failure retries the write, not the arithmetic: the
     * numbers were never in doubt, only the saved copy of them.
     */
    retryCommercialResult: () => {
      const s = get()
      if (s.commercialTrust.reason === 'persistence') {
        if (retryProposalPersistence()) {
          set({ commercialTrust: COMMERCIAL_TRUSTED })
        } else {
          set((current) => ({
            commercialTrust: {
              ...current.commercialTrust,
              attempts: current.commercialTrust.attempts + 1,
            },
          }))
        }
        return
      }
      let fresh: CommercialSnapshot | null = null
      try {
        const current = get()
        const projection = current.projection()
        fresh = { result: deriveCommercialResult(current, projection), projection }
      } catch {
        fresh = null
      }
      if (!fresh) {
        set((current) => ({
          commercialTrust: {
            ...current.commercialTrust,
            attempts: current.commercialTrust.attempts + 1,
          },
        }))
        return
      }
      /**
       * Recovery updates the snapshot ONCE, clears the stale state, and
       * ANSWERS FOR THE OUTAGE (VR3-03R rework, QA-01).
       *
       * A decision taken while the engine was down still moved this number,
       * and after recovery the user is owed the same explanation any other
       * decision earns. The amount is the movement accumulated since the
       * last trusted total — which is exactly what the baseline holds — and
       * it is attributable only when ONE decision went unpriced. Two or
       * more, and the honest rail says nothing rather than crediting the
       * first with the second's money.
       *
       * With nothing pending, the standing cause is left alone: the engine's
       * outage did not change what the user last decided.
       */
      const after = fresh.result.total.exact
      const recoveredDelta = after.minus(s.commercialBaselineTotal)
      const pending = s.commercialPendingCause
      lastTrustedCommercial = fresh
      set((current) => ({
        commercialBaselineTotal: after,
        commercialTrust: COMMERCIAL_TRUSTED,
        commercialPendingCause: null,
        commercialPendingCount: 0,
        commercialResultVersion: recoveredDelta.isZero()
          ? current.commercialResultVersion
          : current.commercialResultVersion + 1,
        lastCommercialChange: s.commercialPendingCount === 0
          ? current.lastCommercialChange
          : pending
            ? {
              id: `chg-recovered-${current.journal.length}`,
              labelDe: pending.de,
              labelEn: pending.en,
              signedExact: recoveredDelta,
              group: pending.group,
              atIso: new Date().toISOString(),
            }
            : null,
      }))
    },

    /**
     * The controlled failure mechanism (screen-by-screen spec §15).
     *
     * Refused in a production build, exactly like `__resetStoreForTests`:
     * a switch that can make a released offer engine lie is not a switch a
     * released build should own. In development it is reachable from the
     * console (`window.__all3Fault`), never from product UI — a recovery
     * state has to be inducible to be reviewable, and the audit's own G-07
     * finding was that it could not be induced at all.
     */
    setCommercialFault: (on) => {
      const mode = (import.meta as { env?: { MODE?: string } }).env?.MODE
      if (mode === 'production') {
        throw new Error(
          'setCommercialFault ist nur außerhalb des Produktionsbuilds erlaubt: '
          + 'eine erzwungene Kalkulationsstörung ist ein Prüfwerkzeug, kein Produktschalter',
        )
      }
      set({ commercialFault: on })
      if (on) {
        set(() => ({
          commercialTrust: {
            status: 'stale',
            reason: 'calculation',
            sinceIso: lastTrustedCommercial?.result.derivedAtIso ?? null,
            attempts: 0,
          },
        }))
      } else {
        get().retryCommercialResult()
      }
    },

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
          // VR3-COST-00: the decision itself is ALWAYS a plain `coverage`
          // change — a KG group moved to a coverage state — so it always
          // carries its translatable form. What the fallback branches add is
          // not a different decision but a consequence OF it, and it now
          // travels as `noteKey` (below) instead of forcing the render site
          // back onto the German-only `label`.
          change: { kind: 'coverage', group: g, value: st },
          noteKey: fallbackApplied
            ? 'coverage.kg700.fallbackApplied'
            : fallbackReverted
              ? 'coverage.kg700.fallbackReverted'
              : undefined,
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
        /**
         * VR3-03R (audit G-06): an undo EXPLAINS ITSELF.
         *
         * The last thing that moved the number after a Rückgängig is the
         * Rückgängig — so the rail says so, with the reversed amount,
         * instead of keeping the label of the decision that no longer
         * applies. Undoing an event that never had an attributable cause
         * supplies none here either, and the door clears the standing one:
         * the honest outcome, since nothing available can name why.
         */
        cause: target.cause
          ? {
            de: `${UNDO_CAUSE_PREFIX.de}${target.cause.de}`,
            en: `${UNDO_CAUSE_PREFIX.en}${target.cause.en}`,
            group: target.cause.group,
          }
          : undefined,
      })
    },

    dismissUndoToast: () => set({ undoToast: null }),

    setMode: (m) => {
      const s = get()
      // VR3-04: the entry gate is a VALID SAVED BASELINE, not configuration
      // completeness. The building gate stays in the predicate because an
      // Option whose scope is not saved cannot have a saved baseline either
      // — keeping it makes the refusal explicable at the point of refusal
      // rather than only downstream.
      if (m === 'praesentation'
        && (s.level !== 'option'
          || !canBeginConfiguration(s)
          || !clientModeAvailableFor(s, s.activeOptionId))) return
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
        // VR3-05 gating contract: "Entry creates scenario state from saved
        // baseline WITHOUT writing the Option". Entry therefore mints an
        // EMPTY scenario — a branch that exists and has changed nothing —
        // rather than deferring creation to the first click. The difference
        // is not cosmetic: the scenario's `sourceOptionId` is pinned at the
        // moment of entry, so a later option switch cannot retro-attach the
        // presenter's changes to an Option they were not exploring.
        ...(entering && s.activeOptionId
          ? { clientScenario: emptyScenario(s.activeOptionId) }
          : {}),
        // Chapter position is session state: it survives a remount inside
        // the presentation and nothing beyond it.
        ...(entering ? { presentationChapter: null } : {}),
        ...(leaving
          ? {
            clientScenario: null,
            clientScenarioTrusted: null,
            clientScenarioExportAcknowledged: false,
            clientScenarioSave: null,
            presentationChapter: null,
          }
          : {}),
        /**
         * D-18 — `Beenden` returns to the stage the presenter came from.
         *
         * Entering Client Mode rewrites `pipelineView` through
         * `pipelineViewForOutputProfile`, and `praesentieren` is absent from
         * the client-visible allowlist (correctly — it is an internal
         * stage), so the view became `konfigurator` on entry and the exit
         * faithfully restored… the Configurator. The presenter was dropped
         * somewhere they never were.
         *
         * The fix is the RETURN TARGET, not the allowlist: widening
         * `CLIENT_VISIBLE_PIPELINE_VIEWS` would make an internal stage
         * client-visible, which is forbidden. Both entry doors — the
         * Präsentieren stage and the portfolio card — lead to the same
         * place, so both come back to it.
         */
        pipelineView: leaving && s.level === 'option' && s.activeOptionId
          ? 'praesentieren'
          : pipelineViewForBuildingGate(s, outputView),
        openConfiguratorStep: nearestActiveConfiguratorStep({
          coverage: s.coverage,
          mode: m,
        }, s.openConfiguratorStep),
      })
    },

    /**
     * Open a project — and, when it is a DIFFERENT project, move the whole
     * Option workspace with it.
     *
     * Until this fix the action set `opportunityId` and nothing else, so the
     * Options, the confirmed building scope, the KG configuration, the saved
     * versions and the journal of the project being LEFT stayed in the
     * store and were served to the project being opened. Measured on
     * `887c74c`: an Option created under `DEMO-HAPPY-01` appeared in
     * `DEMO-COMPLEX-01`'s collection, opened there, and kept `Lindenhof` —
     * the other project's building — as its confirmed scope, through a
     * reload. Since `kgCatalogueFor` keys the price catalogue off
     * `opportunityId`, KG 400 could then price one project's catalogue
     * against another project's buildings.
     *
     * The swap happens BEFORE `landingProjectStage` reads the state, because
     * where a project lands ("does it have Options yet?") is a question about
     * the incoming project and must not be answered from the outgoing one's
     * workspace.
     */
    openOpportunity: (id) => {
      const swapped = switchProjectWorkspace(id)
      set((s) => {
        const next = { ...s, ...swapped } as Store
        return {
          ...swapped,
          mode: modeForLevelTransition(s.mode, 'opportunity'),
          level: 'opportunity',
          opportunityId: id,
          projectStage: landingProjectStage(next, id),
          understandingTab: 'overview',
        }
      })
    },
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
        ...leaveOptionWorkspace(s),
        projectStage: landingProjectStage(s, s.opportunityId),
      })
    },

    openOptionsStage: () => {
      const s = get()
      set({
        ...NO_TRANSIENT,
        ...leaveOptionWorkspace(s),
        projectStage: 'options',
      })
    },

    openComparison: () => {
      const s = get()
      set({
        ...NO_TRANSIENT,
        ...leaveOptionWorkspace(s),
        projectStage: 'comparison',
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

    setProjectStage: (stage) => set({ projectStage: stage }),

    setUnderstandingTab: (tab) => set({ understandingTab: tab }),

    seedProjectCheckpoint: (projectId) => {
      const project = demoProject(projectId)
      if (!project) return
      const s = get()
      set({
        projectAnalyses: {
          ...s.projectAnalyses,
          [projectId]: seededCheckpoint(project, new Date().toISOString()),
        },
        projectStage: s.opportunityId === projectId ? 'understanding' : s.projectStage,
      })
    },

    startDocumentAnalysis: () => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis || analysis.jobState !== 'NOT_STARTED') return
      set({
        projectAnalyses: {
          ...s.projectAnalyses,
          [project.id]: startJob(project, analysis, new Date().toISOString()),
        },
        projectStage: 'documents',
      })
    },

    tickDocumentAnalysis: () => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const next = advanceJob(project, analysis)
      if (next === analysis) return
      set({ projectAnalyses: { ...s.projectAnalyses, [project.id]: next } })
    },

    cancelDocumentAnalysis: () => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      set({
        projectAnalyses: { ...s.projectAnalyses, [project.id]: cancelJob(analysis) },
      })
    },

    /**
     * Re-analysis is a DOCUMENT-BASE event: it re-runs every file, and the
     * confirmations that depend on changed evidence become reviewable
     * rather than being silently replaced (M-1/D-08).
     */
    rerunDocumentAnalysis: () => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const previous = analysis
      const next = rerunJob(project, analysis, new Date().toISOString())
      const write = (value: ProjectAnalysis) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
      })
      write(next)
      apply({
        kind: 'document.activated',
        label: `Dokumentanalyse erneut ausgeführt · ${project.name}`,
        labelKey: 'vr3.journal.rerunAnalysis',
        labelValues: { project: project.name },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      }, null)
    },

    retryDocumentRow: (docId) => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      set({
        projectAnalyses: {
          ...s.projectAnalyses,
          [project.id]: retryAnalysisDocument(analysis, docId),
        },
      })
    },

    replaceDocumentRow: (docId, replacementFile) => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const previous = analysis
      const next = replaceAnalysisDocument(project, analysis, docId, replacementFile)
      const write = (value: ProjectAnalysis) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
      })
      write(next)
      apply({
        kind: 'document.activated',
        label: `Dokument ersetzt · ${docId} → ${replacementFile}`,
        labelKey: 'vr3.journal.documentReplaced',
        labelValues: { document: docId, file: replacementFile },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      }, null)
    },

    /** Removal keeps an audit record: the row stays, dated and explained. */
    removeDocumentRow: (docId) => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const previous = analysis
      const next = removeAnalysisDocument(
        project, analysis, docId, new Date().toISOString(),
      )
      const write = (value: ProjectAnalysis) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
      })
      write(next)
      apply({
        kind: 'document.activated',
        label: `Dokument entfernt · ${docId}`,
        labelKey: 'vr3.journal.documentRemoved',
        labelValues: { document: docId },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      }, null)
    },

    resolveProjectConflict: (conflictId, choice) => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const previous = analysis
      const next = resolveAnalysisConflict(
        project, analysis, conflictId, choice, new Date().toISOString(),
      )
      if (next === analysis) return
      const write = (value: ProjectAnalysis) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
      })
      write(next)
      apply({
        kind: 'conflict.resolved',
        label: `Strittige Angabe entschieden · ${conflictId}`,
        labelKey: 'vr3.journal.conflictResolved',
        labelValues: { conflict: conflictId },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      }, null)
    },

    reopenProjectConflict: (conflictId) => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const previous = analysis
      const next = reopenConflict(analysis, conflictId)
      if (next === analysis) return
      const write = (value: ProjectAnalysis) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
      })
      write(next)
      apply({
        kind: 'conflict.resolved',
        label: `Strittige Angabe zurückgestellt · ${conflictId}`,
        labelKey: 'vr3.journal.conflictReopened',
        labelValues: { conflict: conflictId },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      }, null)
    },

    recordProjectQuestionResponse: (questionId, kind) => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      const previous = analysis
      const next = recordQuestionResponse(
        analysis, questionId, kind, new Date().toISOString(),
      )
      const write = (value: ProjectAnalysis) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
      })
      write(next)
      apply({
        kind: 'value.edited',
        label: kind === 'assumption'
          ? `Offene Frage ${questionId} · Annahme dokumentiert`
          : `Offene Frage ${questionId} · Antwort erfasst`,
        labelKey: kind === 'assumption'
          ? 'vr3.journal.questionAssumed'
          : 'vr3.journal.questionAnswered',
        labelValues: { question: questionId },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      }, null)
    },

    /**
     * Committing the project baseline is the transition Option creation
     * consumes. It is one journalled event, so the permission it grants
     * cannot change without an event (M-4), and it records the snapshot
     * WITH the authority of every value — a snapshot without provenance
     * would let a later stage present an assumption as a fact.
     */
    commitProjectBaseline: () => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return
      if (!readiness(project, analysis).canCreateOption) return
      const at = new Date().toISOString()
      const snapshot = projectBaselineSnapshot(project, analysis, at)
      const previousSnapshot = s.projectBaseline
      const previousConfirmed = s.projectParamsConfirmed
      const previousAnalysis = analysis
      const committed: ProjectAnalysis = { ...analysis, baselineCommittedAt: at }
      const write = (
        value: ProjectAnalysis,
        baseline: ProjectBaselineSnapshot | null,
        confirmed: boolean,
      ) => set({
        projectAnalyses: { ...get().projectAnalyses, [project.id]: value },
        projectBaseline: baseline,
        projectParamsConfirmed: confirmed,
      })
      write(committed, snapshot, true)
      apply({
        kind: 'value.confirmed',
        label: PROJECT_PARAMS_CONFIRMATION_LABEL,
        labelKey: 'vr3.journal.projectBaselineConfirmed',
        deltaExact: null,
        inverse: () => write(previousAnalysis, previousSnapshot, previousConfirmed),
        forward: () => write(committed, snapshot, true),
      }, null)
    },

    beginOptionCreation: () => {
      const s = get()
      const project = demoProject(s.opportunityId)
      if (!project) return
      if (!s.projectAnalyses[project.id]) return
      // IDEMPOTENT. A commitment already in flight is not restarted, and
      // this is the guard that actually holds: the canonical Button blocks
      // with `aria-disabled` rather than `disabled`, so a scripted or
      // rapid second activation still dispatches its click. A time window
      // alone let one through once and created a second Option (AUD-03).
      if (s.optionCommit?.stage) return
      set({ optionCommit: { projectId: project.id, stage: 'BASELINE', errorKey: null } })
    },

    advanceOptionCreation: () => {
      const s = get()
      const commit = s.optionCommit
      if (!commit?.stage) return
      const project = demoProject(s.opportunityId)
      // A commitment belongs to the project that opened it. If the user
      // navigated away it is abandoned, not applied to whatever is open now.
      if (!project || project.id !== commit.projectId) {
        set({ optionCommit: null })
        return
      }

      // A failure moves ONLY the commitment. Readiness, conflict decisions
      // and question responses are untouched — the ticket requires an
      // Option-creation failure to leave resolution work intact.
      //
      // It does move the user to the surface that EXPLAINS it. The gate owns
      // the failure message and its retry, and the gate lives on the
      // Understanding overview; a withdrawn prerequisite also drops the
      // ready surface, so without this the user could land on the conflicts
      // tab with no visible reason why their Option never appeared. Found in
      // the browser: the announcement was correct and nothing on screen
      // was. Announced is not the same as observable.
      const fail = (errorKey: string) => set({
        optionCommit: { projectId: commit.projectId, stage: null, errorKey },
        understandingTab: 'overview',
      })

      // The gate is re-read at EVERY stage boundary, not once when the
      // button rendered. Undoing a conflict resolution mid-flight is a real
      // race and this is where it is caught.
      if (!get().canCreateOptions()) {
        fail('vr3.option.error.gateClosed')
        return
      }

      if (commit.stage === 'BASELINE') {
        if (!get().projectBaseline) get().commitProjectBaseline()
        // A baseline that refused to commit is a real failure, not a
        // reason to create an Option with no baseline behind it.
        if (!get().projectBaseline) {
          fail('vr3.option.error.baseline')
          return
        }
        set({ optionCommit: { projectId: commit.projectId, stage: 'OPTION', errorKey: null } })
        return
      }

      // Final stage. `createOption` clears the commitment on success through
      // `NO_TRANSIENT`, and records its own refusal.
      if (!get().createOption() && get().optionCommit?.stage) {
        fail('vr3.option.error.gateClosed')
      }
    },

    clearOptionCreationError: () => {
      if (get().optionCommit?.errorKey) set({ optionCommit: null })
    },

    /**
     * ONE meaning, two layers.
     *
     * The gate has always been "the project baseline is confirmed", and
     * `projectParamsConfirmed` has always carried that confirmation — so a
     * baseline that is ALREADY committed keeps the gate open, which is what
     * makes a restored session and a directly driven store behave as before.
     *
     * What VR3-01 changed is the PRECONDITION for committing it. The hard
     * gate the target specification states is exactly: unresolved BLOCKING
     * conflicts must be zero and the required project baseline must be
     * complete. Questions do not gate unless a question declares itself
     * blocking — a question is not a conflict. The previous predicate
     * (`wflConflict` resolved) belonged to the proposal fixture, not to the
     * project, and it could never express a six-conflict project at all.
     */
    canCreateOptions: () => {
      const s = get()
      if (s.projectParamsConfirmed) return true
      const project = demoProject(s.opportunityId)
      if (!project) return false
      const analysis = s.projectAnalyses[project.id]
      if (!analysis) return false
      return readiness(project, analysis).canCreateOption
    },

    createOption: (name) => {
      // VR3-01: the gate is re-read at the moment of the transition, not at
      // the moment the button rendered. A conflict reopened in between is a
      // genuine failure path, and it must leave readiness and resolution
      // work exactly as it was rather than half-creating an Option.
      if (!get().canCreateOptions()) {
        const failingProject = demoProject(get().opportunityId)
        if (failingProject) {
          set({
            optionCommit: {
              projectId: failingProject.id,
              stage: null,
              errorKey: 'vr3.option.error.gateClosed',
            },
          })
        }
        return null
      }
      // The project baseline is committed as its own journalled event
      // BEFORE the Option exists: the Option inherits a baseline that was
      // already authoritative, never one invented during creation.
      if (!get().projectBaseline) get().commitProjectBaseline()
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
      // VR3-02: the Option INHERITS the project baseline that the stage
      // before it journalled. Not a live read of the fixture — a variant is
      // a variant of the project as it was understood on the day it was
      // created, and a later re-analysis must never move an Option's
      // commercial base underneath it (M-1/M-3).
      const inheritedScope = scopeBuildingsFromBaseline(s.projectBaseline)
      if (inheritedScope.length > 0) {
        fresh.scopeBuildings = inheritedScope
        fresh.scopeSelected = initialScopeSelection(inheritedScope)
        fresh.scopeActiveBuildingId = inheritedScope[0]!.id
      }
      // VR3-03: the Option starts with SIX UNDECIDED scope decisions and its
      // project's own service catalogue. Nothing is pre-included and nothing
      // is pre-excluded — that absence is the state the target's first frame
      // shows (T-018) and the defect the replaced model could not express.
      const catalogue = kgCatalogue(s.opportunityId)
      if (catalogue) {
        fresh.kgConfig = initialKgDecisions(catalogue)
        fresh.kgScopeConfirmedFingerprint = null
        fresh.coverage = coverageFromKgDecisions(fresh.kgConfig)
        // VR3-TGA-UX-00: the responsibility record is seeded the same way,
        // at the same moment, from the same catalogue — one owner from the
        // Option's first second, never a dual write with the KG 400 chapter.
        fresh.responsibility = initialResponsibility(catalogue)
      }
      // VR3-04: the Option INHERITS the project's schedule model the same
      // way it inherits the building scope — phases, durations, dependencies
      // and the documented dependency questions, once, at creation. The
      // construction start is inherited too, so the stage opens on a real
      // plan rather than on an empty date field, and `constructionStartDate`
      // is set from the same value so the released presentation projection
      // and the offer panel's Bauzeit hero never disagree with it.
      const project = demoProject(s.opportunityId)
      const inheritedPhases = schedulePhasesFromProject(project)
      if (project && inheritedPhases.length > 0) {
        fresh.schedulePhases = inheritedPhases
        fresh.scheduleStartDate = project.schedule.constructionStartDate
        fresh.schedulePlannedCompletion = project.schedule.plannedCompletionDate
        fresh.constructionStartDate = project.schedule.constructionStartDate
      }
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
        // `NO_TRANSIENT` carries `optionCommit: null`, so a successful
        // creation clears the commitment through the same one convention
        // that clears the preview and the undo toast.
        ...NO_TRANSIENT,
        options: [...s.options, { id, name: resolvedName }],
        activeOptionId: id,
        optionSeq: seq,
        pipelineView: 'buildingScope',
        // The Option's HOME is the collection. Creating one navigates there
        // and stops: configuration is a separate, deliberate act, and the
        // Open button on the new card says where it leads (target frame
        // T-03, which is normative for this exact state).
        projectStage: 'options',
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
        label: `Option «${resolvedName}» angelegt`,
        labelKey: 'vr3.journal.optionCreated',
        labelValues: { option: resolvedName },
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
        label: `Option «${previousName}» in «${trimmed}» umbenannt`,
        labelKey: 'vr3.journal.optionRenamed',
        labelValues: { previous: previousName, next: trimmed },
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

    /**
     * Enter the Option workspace at the first stage that is not complete.
     *
     * DETERMINISTIC AND TOTAL (accepted 2026-09-06 IA audit, §8). The
     * released action chose between two surfaces from one predicate and
     * announced neither; every card action and every switcher entry now
     * NAMES this destination before the click, and they name it by calling
     * the same function (`optionOpenDestination`) that this action lands on.
     * A button that says `Fortsetzen · Kalkulieren` and a store that opens
     * Gebäude & Umfang would be two answers to one question.
     *
     * It decides nothing about what is ALLOWED. Every gate predicate is
     * untouched; the destination is simply the furthest point the gates
     * already permit, computed instead of guessed.
     */
    openOption: (id) => {
      const s = get()
      if (!s.options.some((o) => o.id === id)) return
      const target = optionOpenDestination(s, id)
      const nav = target ? optionNav(target) : null
      if (s.activeOptionId === id) {
        const pipelineView = nav?.view ?? (canBeginConfiguration(s) ? 'konfigurator' : 'buildingScope')
        const openConfiguratorStep = nav?.step ?? s.openConfiguratorStep
        set({
          level: 'option',
          pipelineView,
          openConfiguratorStep,
          configurationModeEditing: false,
          ...(canBeginConfiguration(s) && s.configurationModeChosen
            && !s.configurationModeEditing
            && !s.visitedConfiguratorSteps.includes(openConfiguratorStep)
            ? {
                visitedConfiguratorSteps: [
                  ...s.visitedConfiguratorSteps,
                  openConfiguratorStep,
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
        optionConfigs: s.activeOptionId
          ? { ...rest, [s.activeOptionId]: captureConfig(s) }
          : rest,
        ...next,
        pipelineView: nav?.view ?? (canBeginConfiguration({
          ...next,
          buildingConflicts: s.buildingConflicts,
        }) ? 'konfigurator' : 'buildingScope'),
        // The destination's own step wins; `nearestActiveConfiguratorStep`
        // remains the fallback for a stored step that the Option's current
        // output profile no longer renders.
        openConfiguratorStep: nav?.step ?? nearestActiveConfiguratorStep({
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
      // VR3-05: switching the presented Option starts a NEW scenario against
      // the new source. A change set is meaningful only against the Option
      // it was measured from — carrying one across would price a heating
      // decision taken on Option 1 into Option 2's total and call the
      // difference a delta.
      set({
        viewedOptionId: id,
        clientScenario: emptyScenario(id),
        clientScenarioTrusted: null,
        clientScenarioExportAcknowledged: false,
        clientScenarioSave: null,
      })
    },

    /**
     * VR3-CP-00 — move to a chapter. Note what it does NOT reset: the
     * presented Option and the scenario both survive, because a client
     * asking to see the price of the other variant has not left the story.
     */
    setPresentationChapter: (chapter) => {
      if (!isClientProjection(get().mode)) return
      set({ presentationChapter: chapter })
    },

    /* ── VR3-05 · the presentation scenario ────────────────────────────── */

    setPresentationDecision: (decisionId, value) => {
      const s = get()
      if (!isClientProjection(s.mode)) return
      const sourceOptionId = resolvedViewedOptionId(s)
      if (!sourceOptionId) return
      const config = clientBaselineConfig(s)
      if (!config) return
      const decision = clientPresentationDecisions(s).find((d) => d.id === decisionId)
      if (!decision) return
      const scenario = s.clientScenario ?? emptyScenario(sourceOptionId)
      if (scenario.sourceOptionId !== sourceOptionId) return
      const next = withDecision(
        scenario, decision, value, scenarioSliceOf(config), kgCatalogueFor(s),
      )
      if (next === scenario) return
      // The trusted memo is refreshed from the NEW state, so a later
      // derivation failure falls back to what this decision produced rather
      // than to a state two decisions ago. Refreshed BEFORE the set() has
      // any reader, and only when the new state actually derives — a failing
      // derivation must not overwrite the last good one with nothing.
      const candidate = { ...s, clientScenario: next }
      let trusted = s.clientScenarioTrusted
      try {
        trusted = clientPresentedSnapshot(candidate as Store) ?? trusted
      } catch {
        // Keep the previous trusted snapshot: that is its entire purpose.
      }
      set({
        clientScenario: next,
        clientScenarioTrusted: trusted,
        // A new change invalidates an acknowledgement given for the previous
        // one: the presenter agreed to export THAT state, not this one.
        clientScenarioExportAcknowledged: false,
      })
    },

    revertPresentationScenario: () => {
      const s = get()
      if (!isClientProjection(s.mode)) return
      const sourceOptionId = resolvedViewedOptionId(s)
      if (!sourceOptionId) return
      // Revert is not a restore. It is the removal of the change set, which
      // is why it cannot half-fail and why the resulting derivation is the
      // baseline derivation itself rather than something equal to it.
      set({
        clientScenario: emptyScenario(sourceOptionId),
        clientScenarioTrusted: null,
        clientScenarioExportAcknowledged: false,
        clientScenarioSave: null,
      })
    },

    acknowledgeScenarioExport: () => {
      if (!isClientProjection(get().mode)) return
      set({ clientScenarioExportAcknowledged: true })
    },

    beginScenarioSaveAsNew: () => {
      const s = get()
      if (!isClientProjection(s.mode)) return
      const sourceOptionId = resolvedViewedOptionId(s)
      if (!sourceOptionId) return
      if (scenarioChangeCount(s.clientScenario) === 0) return
      if (s.clientScenarioSave?.stage === 'SAVING') return
      set({
        clientScenarioSave: {
          sourceOptionId,
          name: clientScenarioProposedName(s),
          stage: 'NAMING',
          errorKey: null,
          savedOptionId: null,
        },
      })
    },

    setScenarioSaveName: (name) => {
      const commit = get().clientScenarioSave
      if (!commit || commit.stage !== 'NAMING') return
      // Typing clears the previous refusal: a name error that outlived the
      // name it described would tell the presenter their new name is taken.
      set({ clientScenarioSave: { ...commit, name, errorKey: null } })
    },

    cancelScenarioSaveAsNew: () => {
      const commit = get().clientScenarioSave
      if (!commit || commit.stage === 'SAVING') return
      // Cancel leaves the SCENARIO intact — only the naming attempt ends.
      set({ clientScenarioSave: null })
    },

    commitScenarioSaveAsNew: () => {
      const s = get()
      const commit = s.clientScenarioSave
      if (!commit || commit.stage !== 'NAMING') return
      const sourceOptionId = resolvedViewedOptionId(s)
      // Re-read every precondition AT the commitment, exactly as
      // `advanceOptionSave` does: the dialog rendered against a state that
      // may have moved, and a partial Option is the one outcome the failure
      // contract forbids.
      if (!isClientProjection(s.mode) || sourceOptionId !== commit.sourceOptionId) {
        set({
          clientScenarioSave: {
            ...commit, stage: null, errorKey: 'vr3.client.save.error.sourceChanged',
          },
        })
        return
      }
      const name = commit.name.trim()
      if (!clientScenarioNameAvailable(s, name)) {
        set({
          clientScenarioSave: {
            ...commit,
            errorKey: name.length === 0
              ? 'vr3.client.save.error.nameEmpty'
              : 'vr3.client.save.error.nameTaken',
          },
        })
        return
      }
      if (scenarioChangeCount(s.clientScenario) === 0) {
        set({
          clientScenarioSave: {
            ...commit, stage: null, errorKey: 'vr3.client.save.error.noChanges',
          },
        })
        return
      }
      const snapshot = clientPresentedSnapshot(s)
      const trustedNow = clientScenarioTrustedNow(s)
      if (!snapshot || !trustedNow) {
        // Saving a total the calculator could not reproduce would mint a
        // baseline nobody can recompute. The scenario and the name survive.
        set({
          clientScenarioSave: {
            ...commit, stage: null, errorKey: 'vr3.client.save.error.calculation',
          },
        })
        return
      }
      const seq = s.optionSeq + 1
      const newOptionId = `OPT-${String(seq).padStart(2, '0')}`
      const baseline = s.projectBaseline
      const overlay = { ...s, ...snapshot.config }
      // Version 1 of a NEW Option, not version N+1 of the source. The
      // lineage lives in `sourceOptionId`, and the source's own version
      // history is untouched — that is what "the original remains
      // recoverable" means at the level of the record.
      const version: SavedOptionVersion = deepFreeze({
        optionId: newOptionId,
        optionName: name,
        version: 1,
        savedAt: new Date().toISOString(),
        savedBy: SCOPE_ACTOR,
        sourceOptionId: commit.sourceOptionId,
        projectBaselineId: baseline ? `${baseline.projectId}@${baseline.at}` : null,
        buildingScopeFingerprint: scopeFingerprint(overlay),
        configurationFingerprint: snapshot.config.kgConfig
          ? kgScopeFingerprint(snapshot.config.kgConfig)
          : '',
        scheduleFingerprint: scheduleFingerprintFor(overlay),
        reviewFingerprint: reviewFingerprintFor(overlay),
        clientProjectionVersion: CLIENT_PROJECTION_VERSION,
        clientProjectionValid: true,
        result: {
          totalExact: snapshot.result.total.exact.toFixed(2),
          totalDisplay: snapshot.result.total.display,
          totalLabel: snapshot.result.totalLabel,
          coverage: snapshot.result.coverage,
          uncertaintyPp: snapshot.result.uncertaintyPp,
          byCostGroup: snapshot.result.byCostGroup.map((line) => ({
            group: line.group,
            exact: line.exact ? line.exact.toFixed(2) : null,
          })),
          resultVersion: snapshot.result.version,
        },
      })
      set({
        options: [...s.options, { id: newOptionId, name }],
        optionSeq: seq,
        // The scenario's configuration IS the new Option's configuration.
        // `activeOptionId` is untouched, so this write cannot collide with
        // the flat working copy: the new Option is never the active one.
        optionConfigs: { ...s.optionConfigs, [newOptionId]: snapshot.config },
        savedOptionVersions: {
          ...s.savedOptionVersions,
          [newOptionId]: Object.freeze([version]),
        },
        // The new Option becomes the presented baseline, with no changes
        // against it — the scenario has been spent.
        viewedOptionId: newOptionId,
        clientScenario: emptyScenario(newOptionId),
        clientScenarioTrusted: null,
        clientScenarioExportAcknowledged: false,
        clientScenarioSave: {
          ...commit, stage: null, errorKey: null, savedOptionId: newOptionId,
        },
      })
      // NO INVERSE, for the reason `advanceOptionSave` states: a saved
      // Option version is a client baseline (M-3). This is the one and only
      // journalled consequence a client presentation may have, and it is
      // journalled precisely because it is the moment the meeting changed
      // preparation state.
      apply({
        kind: 'value.confirmed',
        label: `Option gespeichert · ${name} · aus ${commit.sourceOptionId}`,
        labelKey: 'vr3.journal.optionSavedFromScenario',
        labelValues: { option: name, source: commit.sourceOptionId },
        deltaExact: null,
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

    setKgScopeDecision: (group, decision) => {
      const s = get()
      if (!s.kgConfig || !kgCatalogueFor(s)) return
      const prev = s.kgConfig.scope[group]
      if (prev === decision) return
      const before = s.projection().result.total.exact
      const write = (value: KgScopeDecision) => set((state) => {
        if (!state.kgConfig) return {}
        const next: KgDecisions = {
          ...state.kgConfig,
          scope: { ...state.kgConfig.scope, [group]: value },
        }
        return {
          kgConfig: next,
          // ONE coverage. Every released consumer — the DIN 276 rail rows,
          // the export preflight, the client projection — reads
          // `coverage`, so the decision has to land in both or two surfaces
          // describe the same Option differently.
          coverage: coverageFromKgDecisions(next),
        }
      })
      write(decision)
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      const labels = kgChangeLabels({ kind: 'kgScope', group, value: decision })
      apply({
        kind: 'coverage.changed',
        label: labels.de,
        deltaExact: delta.isZero() ? null : delta,
        inverse: () => write(prev),
        forward: () => write(decision),
        // The cause travels WITH the event, so undoing it can name itself.
        cause: { de: labels.de, en: labels.en, group },
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: labels.de,
            // VR3-COST-00: `labels` above already holds BOTH languages, and
            // the journal event two lines up carries both in `cause`. The
            // cockpit's change slot was the one consumer left reading only
            // `labels.de`, which put `KG 700 enthalten` inside an otherwise
            // English rail on the most ordinary change this surface has —
            // a Leistungsabgrenzung scope toggle. Handing the render site
            // the `PriceChange` lets `translatedChangeLabel` reach the same
            // `kgChangeLabels` and pick the right side of it.
            change: { kind: 'kgScope', group, value: decision },
            deltaExact: delta,
            percent: before.isZero() ? null : delta.div(before).mul(100),
          },
        })
      }
    },

    setKgServiceDecision: (serviceId, decision) => {
      const s = get()
      const catalogue = kgCatalogueFor(s)
      if (!s.kgConfig || !catalogue) return
      const service = kgServiceById(catalogue, serviceId)
      if (!service) return
      const prev = kgServiceDecision(s.kgConfig, service)
      if (prev.state === decision.state
        && prev.variant === decision.variant
        && prev.quantity === decision.quantity) return
      /**
       * VR3-TGA-01 — THE CASCADE TRAVELS WITH THE PARENT.
       *
       * Measured on `06a4acf`: switching `Wärmekonzept` to per-building
       * plants changed ZERO of sixteen rows and left a shared-plant heat
       * generator included at + 1 240 000 €. The configuration was allowed
       * to be self-contradictory, and only an arithmetic delta hinted at it.
       *
       * THE CONSEQUENCE IS DERIVED, NOT WRITTEN (Acceptance ACCEPT-01).
       *
       * The first version wrote the children too: every suspended decision
       * was overwritten with a reset record in the same `set`. It closed the
       * contradiction and opened a worse one — the answer was DESTROYED, so
       * putting the plant concept back left 1.240.000 € gone for good and the
       * decision itself unreachable, outside the eight-second undo window.
       * Deleting a human decision to express that its precondition lapsed is
       * exactly the overwrite this product forbids (rule 14).
       *
       * So only the parent is written. `dependencySuspension` derives the
       * rest, which makes the state reversible by construction: restore the
       * precondition and every decision under it returns with the answer the
       * user gave it. One `set`, one journal event, one undo — and the undo
       * now restores the combination because there is only ever one fact to
       * restore.
       */
      const before = s.projection().result.total.exact
      const write = (value: KgServiceDecisionRecord) => set((state) => {
        if (!state.kgConfig) return {}
        return {
          kgConfig: {
            ...state.kgConfig,
            services: {
              ...state.kgConfig.services,
              [serviceId]: value,
            },
          },
          // ONE energy standard. The axis has a released home in the
          // building model, and exactly one surface still displays it from
          // there (the comparison screen's per-building parameter line). A
          // configured variant that moved the price without moving that
          // field would put two different standards on two screens of the
          // same Option — the cross-surface contradiction this ticket
          // exists to close. The bridge is deliberate and narrow: one axis,
          // one map, named here rather than inferred from a string.
          ...(ENERGY_STANDARD_SERVICE_IDS.has(serviceId)
            && value.state === 'selected' && value.variant
            && ENERGY_STANDARD_OF_VARIANT[value.variant]
            ? {
              buildings: Object.fromEntries(
                Object.entries(state.buildings).map(([id, building]) => [
                  id,
                  { ...building, energiestandard: ENERGY_STANDARD_OF_VARIANT[value.variant!]! },
                ]),
              ),
            }
            : {}),
        }
      })
      write(decision)
      const after = get().projection().result.total.exact
      const delta = after.minus(before)
      const labels = kgChangeLabels({ kind: 'kgService', serviceId, value: decision })
      const group = KG_SCOPE_GROUPS.find((g) => {
        const chapter = catalogue.chapters.find((c) => c.group === g)
        return chapter?.groups.some((sg) => sg.services.some((sv) => sv.id === serviceId))
      }) ?? null
      apply({
        kind: 'option.selected',
        label: labels.de,
        deltaExact: delta.isZero() ? null : delta,
        // ONE event, both directions. Restoring the parent restores every
        // decision that hung off it, because their suspension was never a
        // stored fact — half a restored cascade is not reachable any more.
        inverse: () => write(prev),
        forward: () => write(decision),
        cause: { de: labels.de, en: labels.en, group },
      })
      if (!delta.isZero()) {
        set({
          activeDelta: {
            label: labels.de,
            // Same as `setKgScopeDecision` above: the TGA service decision is
            // the other ordinary change this cockpit reports, and it has the
            // same two-language `labels` in hand.
            change: { kind: 'kgService', serviceId, value: decision },
            deltaExact: delta,
            percent: before.isZero() ? null : delta.div(before).mul(100),
          },
        })
      }
    },

    confirmKgScope: () => {
      const s = get()
      if (!s.kgConfig || !kgScopeDecisionsComplete(s)) return
      const fingerprint = kgScopeFingerprint(s.kgConfig)
      if (s.kgScopeConfirmedFingerprint === fingerprint) return
      const prev = s.kgScopeConfirmedFingerprint
      const write = (value: string | null) => set({ kgScopeConfirmedFingerprint: value })
      write(fingerprint)
      apply({
        kind: 'value.confirmed',
        label: 'Leistungsabgrenzung bestätigt',
        labelKey: 'vr3.journal.kgScopeConfirmed',
        deltaExact: null,
        inverse: () => write(prev),
        forward: () => write(fingerprint),
      })
    },

    /* ─────────── VR3-04 · the schedule stage's own actions ─────────── */

    setScheduleStart: (iso) => {
      const s = get()
      if (s.scheduleStartDate === iso) return
      const previousStart = s.scheduleStartDate
      const previousCompletion = s.schedulePlannedCompletion
      const previousAnchor = s.constructionStartDate
      // MOVING THE START MOVES THE PLAN, not the duration. That is the
      // released anchor-shift semantics the date field already promised
      // ("Verschiebt die Termine unten; die Bauzeit selbst bleibt gleich"),
      // and keeping the planned completion where it was would report an
      // overshoot for a plan the user only slid sideways.
      const shifted = iso !== null && previousStart !== null
        && previousCompletion !== null
        && schedulePositionOf(iso) !== null
        && schedulePositionOf(previousStart) !== null
        && schedulePositionOf(previousCompletion) !== null
        ? addHalfMonths(previousCompletion, halfMonthsBetween(previousStart, iso))
        : previousCompletion
      const write = (
        start: string | null, completion: string | null, anchor: string | null,
      ) => set({
        scheduleStartDate: start,
        schedulePlannedCompletion: completion,
        // ONE date, one owner. `constructionStartDate` is what the released
        // presentation projection and the offer panel's Bauzeit hero both
        // shift by, so the two must never diverge — two owners of one date
        // is the defect that field's own docblock records.
        constructionStartDate: anchor,
      })
      write(iso, shifted, iso)
      apply({
        kind: 'value.edited',
        label: iso
          ? `Baubeginn auf ${germanDate(iso)} gesetzt`
          : 'Baubeginn zurückgesetzt',
        labelKey: iso ? 'vr3.journal.scheduleStartSet' : 'vr3.journal.scheduleStartCleared',
        labelValues: iso ? { date: germanDate(iso) } : undefined,
        deltaExact: null,
        inverse: () => write(previousStart, previousCompletion, previousAnchor),
        forward: () => write(iso, shifted, iso),
      })
    },

    setSchedulePlannedCompletion: (iso) => {
      const s = get()
      if (s.schedulePlannedCompletion === iso) return
      const previous = s.schedulePlannedCompletion
      const write = (value: string | null) => set({ schedulePlannedCompletion: value })
      write(iso)
      apply({
        kind: 'value.edited',
        label: iso
          ? `Geplante Fertigstellung auf ${germanDate(iso)} gesetzt`
          : 'Geplante Fertigstellung zurückgesetzt',
        labelKey: iso
          ? 'vr3.journal.scheduleCompletionSet'
          : 'vr3.journal.scheduleCompletionCleared',
        labelValues: iso ? { date: germanDate(iso) } : undefined,
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(iso),
      })
    },

    setSchedulePhaseDuration: (phaseId, halfMonths) => {
      editSchedulePhase(phaseId, { durationHalfMonths: halfMonths },
        'vr3.journal.schedulePhaseDuration')
    },

    setSchedulePhaseLead: (phaseId, halfMonths) => {
      editSchedulePhase(phaseId, { leadHalfMonths: halfMonths },
        'vr3.journal.schedulePhaseLead')
    },

    setSchedulePhaseDependency: (phaseId, dependsOn) => {
      editSchedulePhase(phaseId, { dependsOn },
        'vr3.journal.schedulePhaseDependency')
    },

    setScheduleDependencyConfirmed: (phaseId, confirmed) => {
      const s = get()
      const phase = activeSchedulePhasesFor(s)
        .find((candidate) => candidate.id === phaseId)
      // Only a dependency that CARRIES a documented question can be
      // accepted. Accepting one that never asked anything would be a
      // recorded decision about nothing.
      if (!phase?.dependencyQuestionId) return
      const already = s.scheduleDependencyConfirmed.includes(phaseId)
      if (already === confirmed) return
      const previous = s.scheduleDependencyConfirmed
      const next = confirmed
        ? [...previous, phaseId]
        : previous.filter((id) => id !== phaseId)
      const write = (value: readonly string[]) =>
        set({ scheduleDependencyConfirmed: value })
      write(next)
      apply({
        kind: 'value.confirmed',
        label: confirmed
          ? `Terminabhängigkeit bestätigt · ${phase.dependencyQuestionId}`
          : `Terminabhängigkeit zurückgezogen · ${phase.dependencyQuestionId}`,
        labelKey: confirmed
          ? 'vr3.journal.scheduleDependencyConfirmed'
          : 'vr3.journal.scheduleDependencyWithdrawn',
        labelValues: { question: phase.dependencyQuestionId },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      })
    },

    confirmSchedule: () => {
      const s = get()
      // The gate is re-read AT the transition, never trusted from the render
      // that drew the button — the same boundary `advanceBuildingScopeSave`
      // guards, for the same reason.
      if (!scheduleAvailableFor(s) || !scheduleReadyToConfirmFor(s)) return
      const fingerprint = scheduleFingerprintFor(s)
      const previous = s.scheduleConfirmation
      const next: ScheduleConfirmation = {
        fingerprint,
        actor: SCOPE_ACTOR,
        at: new Date().toISOString(),
      }
      const write = (value: ScheduleConfirmation | null) =>
        set({ scheduleConfirmation: value })
      write(next)
      apply({
        kind: 'value.confirmed',
        label: 'Terminplan bestätigt',
        labelKey: 'vr3.journal.scheduleConfirmed',
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      })
    },

    /* ───────────── VR3-04 · Final Validation's own actions ──────────── */

    acknowledgeReviewSection: (sectionId) => {
      const s = get()
      if (!finalValidationAvailableFor(s)) return
      const input = reviewSectionInputsFor(s).find((c) => c.id === sectionId)
      if (!input) return
      // A section with a blocker cannot be marked read: the review would
      // then count a section whose own content is not yet valid, which is
      // exactly the "complete means reviewed" conflation this stage exists
      // to remove.
      if (input.issues.some((issue) => issue.severity === 'blocker')) return
      const previous = s.reviewAcknowledged
      const next = {
        ...previous,
        [sectionId]: {
          fingerprint: input.fingerprint,
          actor: SCOPE_ACTOR,
          at: new Date().toISOString(),
        },
      }
      const write = (
        value: Partial<Record<ReviewSectionId, ReviewAcknowledgement>>,
      ) => set({ reviewAcknowledged: value, reviewFocusSectionId: sectionId })
      write(next)
      apply({
        kind: 'value.confirmed',
        label: `Prüfabschnitt geprüft · ${sectionId}`,
        labelKey: 'vr3.journal.reviewSectionAcknowledged',
        labelValues: { section: sectionId },
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      })
    },

    setReviewFocusSection: (sectionId) => {
      if (get().reviewFocusSectionId === sectionId) return
      set({ reviewFocusSectionId: sectionId })
    },

    /**
     * Leave the review for the stage that owns a section's data, remembering
     * where to come back to.
     *
     * The return is not a history entry: the review REMEMBERS the section
     * (`reviewFocusSectionId`), so coming back lands on it rather than at the
     * top of a twelve-section page — which on a long review is the difference
     * between an edit route and losing your place (T-031).
     */
    openReviewIssueRoute: (sectionId) => {
      const definition = REVIEW_SECTIONS.find((section) => section.id === sectionId)
      if (!definition) return
      set({ reviewFocusSectionId: sectionId })
      const route = definition.route
      if (route === 'project') { get().backToOpportunity(); return }
      if (route === 'buildingScope') { get().setPipelineView('buildingScope'); return }
      get().setPipelineView('konfigurator')
      if (route === 'scopeBoundaries') {
        get().openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
        return
      }
      if (route === 'schedule') {
        get().openConfiguratorStepAt(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)
        return
      }
      if (route === 'responsibility') {
        get().openConfiguratorStepAt(CONFIGURATOR_STEP.RESPONSIBILITY)
        return
      }
      const group = `KG_${route.slice(2)}` as KgScopeGroup
      get().openKgChapter(group)
    },

    confirmFinalValidation: () => {
      const s = get()
      if (!reviewReadyToConfirmFor(s)) return
      const fingerprint = reviewFingerprintFor(s)
      const previous = s.reviewConfirmation
      const next: ReviewConfirmation = {
        fingerprint,
        actor: SCOPE_ACTOR,
        at: new Date().toISOString(),
      }
      const write = (value: ReviewConfirmation | null) =>
        set({ reviewConfirmation: value })
      write(next)
      apply({
        kind: 'value.confirmed',
        label: 'Finale Prüfung bestätigt',
        labelKey: 'vr3.journal.finalValidationConfirmed',
        deltaExact: null,
        inverse: () => write(previous),
        forward: () => write(next),
      })
    },

    /* ──────────────── VR3-04 · the explicit save ───────────────── */

    beginOptionSave: () => {
      const s = get()
      const optionId = s.activeOptionId
      if (!optionId) return
      if (s.optionSaveCommit?.stage === 'SAVING') return
      if (!finalValidationConfirmedFor(s)) return
      // The intended version is minted HERE and reused by every retry of
      // this attempt, so a failure followed by a success produces one
      // version and not two. A retry of a FAILED commit keeps the number the
      // failed attempt reserved.
      const intendedVersion = s.optionSaveCommit?.optionId === optionId
        && s.optionSaveCommit.errorKey !== null
        ? s.optionSaveCommit.intendedVersion
        : nextSavedVersionNumber(s, optionId)
      set({
        optionSaveCommit: { optionId, stage: 'SAVING', errorKey: null, intendedVersion },
      })
    },

    advanceOptionSave: () => {
      const s = get()
      const commit = s.optionSaveCommit
      if (!commit?.stage) return
      const optionId = commit.optionId
      if (optionId !== s.activeOptionId) {
        set({
          optionSaveCommit: {
            ...commit, stage: null, errorKey: 'vr3.save.error.optionChanged',
          },
        })
        return
      }
      // Re-read the gate AT the commitment. Editing while the save is in
      // flight is a real race, and this is where it is caught: the save
      // fails, the confirmed validation stays confirmed, and nothing the
      // user did is lost.
      if (!finalValidationConfirmedFor(s)) {
        set({
          optionSaveCommit: {
            ...commit, stage: null, errorKey: 'vr3.save.error.changed',
          },
        })
        return
      }
      const existing = savedVersionsFor(s, optionId)
      // IDEMPOTENT BY IDENTITY, not by luck: a version whose reviewFingerprint
      // is already saved is the same commitment, so a double-advance appends
      // nothing rather than minting a second identical version.
      const reviewPrint = reviewFingerprintFor(s)
      if (existing.some((version) => version.reviewFingerprint === reviewPrint)) {
        set({ optionSaveCommit: null })
        return
      }
      const result = commercialResult(s)
      const option = s.options.find((candidate) => candidate.id === optionId)
      const baseline = s.projectBaseline
      const version: SavedOptionVersion = deepFreeze({
        optionId,
        optionName: option?.name ?? optionId,
        version: commit.intendedVersion,
        savedAt: new Date().toISOString(),
        savedBy: SCOPE_ACTOR,
        projectBaselineId: baseline ? `${baseline.projectId}@${baseline.at}` : null,
        buildingScopeFingerprint: scopeFingerprint(s),
        configurationFingerprint: s.kgConfig ? kgScopeFingerprint(s.kgConfig) : '',
        scheduleFingerprint: scheduleFingerprintFor(s),
        reviewFingerprint: reviewPrint,
        clientProjectionVersion: CLIENT_PROJECTION_VERSION,
        clientProjectionValid: clientProjectionValidFor(s),
        result: {
          totalExact: result.total.exact.toFixed(2),
          totalDisplay: result.total.display,
          totalLabel: result.totalLabel,
          coverage: result.coverage,
          uncertaintyPp: result.uncertaintyPp,
          byCostGroup: result.byCostGroup.map((line) => ({
            group: line.group,
            exact: line.exact ? line.exact.toFixed(2) : null,
          })),
          resultVersion: result.version,
        },
      })
      const previous = s.savedOptionVersions
      const next = {
        ...previous,
        [optionId]: Object.freeze([...existing, version]),
      }
      // NO INVERSE. A saved Option version is the client baseline (M-3), and
      // an offer that could be un-saved by pressing Rückgängig would be a
      // baseline the client's own copy might no longer match. Same contract
      // as a sent snapshot, for the same reason.
      set({ savedOptionVersions: next, optionSaveCommit: null })
      apply({
        kind: 'value.confirmed',
        label: `Option gespeichert · ${version.optionName} · Version ${version.version}`,
        labelKey: 'vr3.journal.optionSaved',
        labelValues: { option: version.optionName, version: version.version },
        deltaExact: null,
      })
    },

    clearOptionSaveError: () => {
      if (get().optionSaveCommit?.errorKey) set({ optionSaveCommit: null })
    },

    openKgChapter: (group) => {
      const s = get()
      if (!kgScopeDecisionsComplete(s)) return
      if (s.kgConfig?.scope[group] !== 'included') return
      get().openConfiguratorStepAt(KG_CHAPTER_STEP[group])
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
        // The stored label stays byte-identical (M-4); the KEY is the
        // presentation, so the journal and the toast read in the user's own
        // locale. VR3-02 made this event reachable from the scope save,
        // where a raw German label would have been the only German line on
        // an English screen.
        labelKey: 'vr3.journal.buildingConfirmed',
        labelValues: {
          building: effectiveFactValue(review.facts.documentationName) ?? id,
        },
        deltaExact: null,
        inverse: () => write(previousReview, previousConfirmation),
        forward: () => write(confirmedReview, confirmed),
      })
    },

    /* ───────────── VR3-02 · the Option's building scope ───────────── */

    setScopeActiveBuilding: (id) => {
      const s = get()
      if (!s.scopeSelected[id] || s.scopeActiveBuildingId === id) return
      set({ scopeActiveBuildingId: id })
    },

    toggleScopeBuilding: (id) => {
      const s = get()
      const building = scopeBuilding(s, id)
      if (!building) return
      const next = !s.scopeSelected[id]
      // Removing a building the user already confirmed, or one a saved
      // scope depends on, is a consequence — so it is asked, once, and the
      // question is state rather than a browser confirm() the product
      // cannot style, translate or test.
      const hasConsequence = !next
        && (scopeBuildingConfirmed(s, id) || s.scopeSaved !== null)
      if (hasConsequence && s.scopeRemovalPending !== id) {
        set({ scopeRemovalPending: id })
        return
      }
      applyScopeSelection(id, next, building.name)
    },

    confirmScopeRemoval: () => {
      const s = get()
      const id = s.scopeRemovalPending
      if (!id) return
      const building = scopeBuilding(s, id)
      set({ scopeRemovalPending: null })
      if (!building) return
      applyScopeSelection(id, false, building.name)
    },

    cancelScopeRemoval: () => {
      if (get().scopeRemovalPending) set({ scopeRemovalPending: null })
    },

    editScopeMetric: (buildingId, key, value, reason) => {
      const s = get()
      const building = scopeBuilding(s, buildingId)
      if (!building) return
      const current = s.scopeEdits[buildingId]?.[key]
      const previous = current
        ? current.previous
        : building.metrics[key] ?? null
      // The same value again is not an override, and journalling it would
      // put an event with no change into the record (M-4 works the other
      // way round: no change without an event, not an event without one).
      if ((current?.value ?? building.metrics[key] ?? null) === value) return
      const edit: ScopeMetricEdit = {
        value,
        previous,
        reason,
        actor: SCOPE_ACTOR,
        at: new Date().toISOString(),
      }
      const before = s.scopeEdits
      const after = {
        ...before,
        [buildingId]: { ...(before[buildingId] ?? {}), [key]: edit },
      }
      set({ scopeEdits: after })
      apply({
        kind: 'value.edited',
        label: `${building.name}: ${key} überschrieben`,
        labelKey: 'vr3.journal.scopeMetricEdited',
        labelValues: { building: building.name, metric: key },
        deltaExact: null,
        inverse: () => set({ scopeEdits: before }),
        forward: () => set({ scopeEdits: after }),
      })
    },

    revertScopeMetric: (buildingId, key) => {
      const s = get()
      const building = scopeBuilding(s, buildingId)
      const current = s.scopeEdits[buildingId]?.[key]
      if (!building || !current) return
      const before = s.scopeEdits
      const { [key]: _removed, ...rest } = before[buildingId] ?? {}
      const after = { ...before, [buildingId]: rest }
      set({ scopeEdits: after })
      apply({
        kind: 'value.edited',
        label: `${building.name}: ${key} auf Quellwert zurückgesetzt`,
        labelKey: 'vr3.journal.scopeMetricReverted',
        labelValues: { building: building.name, metric: key },
        deltaExact: null,
        inverse: () => set({ scopeEdits: before }),
        forward: () => set({ scopeEdits: after }),
      })
    },

    confirmScopeBuilding: (id) => {
      const s = get()
      const building = scopeBuilding(s, id)
      if (!building || !s.scopeSelected[id]) return
      if (scopeBuildingConfirmed(s, id)) return
      const confirmation: ScopeConfirmation = {
        fingerprint: buildingScopeFingerprint(s, building),
        actor: SCOPE_ACTOR,
        at: new Date().toISOString(),
      }
      const before = s.scopeConfirmations
      const after = { ...before, [id]: confirmation }
      set({ scopeConfirmations: after })
      apply({
        kind: 'value.confirmed',
        label: `Gebäudegrundlage ${building.name} bestätigt`,
        labelKey: 'vr3.journal.scopeBuildingConfirmed',
        labelValues: { building: building.name },
        deltaExact: null,
        inverse: () => set({ scopeConfirmations: before }),
        forward: () => set({ scopeConfirmations: after }),
      })
    },

    beginBuildingScopeSave: () => {
      const s = get()
      if (s.scopeCommit?.stage) return
      if (!scopeReadyToSave(s)) return
      set({ scopeCommit: { stage: 'SAVING', errorKey: null } })
    },

    advanceBuildingScopeSave: () => {
      const s = get()
      if (!s.scopeCommit?.stage) return
      // The gate is re-read AT the commitment's boundary, not when the
      // button rendered. Editing a metric while the save is in flight is a
      // real race, and this is where it is caught: the save fails, and
      // every selection and every edit is exactly where the user left it.
      if (!scopeReadyToSave(s)) {
        set({ scopeCommit: { stage: null, errorKey: 'vr3.scope.error.changed' } })
        return
      }
      const saved: SavedBuildingScope = {
        fingerprint: scopeFingerprint(s),
        selectedIds: scopeSelectedIds(s),
        bgfRSTotal: selectedBgfRSTotal(s),
        actor: SCOPE_ACTOR,
        at: new Date().toISOString(),
      }
      const before = s.scopeSaved
      const beforeMode = s.configurationMode
      // The configuration MODE is not a separate gate before
      // Leistungsabgrenzung (target spec §3): it is a consequence of the
      // scope that was just saved. One selected building is configured as
      // one thing; several are configured per building, which is exactly
      // what the user just declared by selecting them. `configurationModeChosen`
      // is deliberately NOT set here — entering Leistungsabgrenzung is the
      // transition that starts pricing, and it stays one transition.
      const mode: ConfigurationMode = saved.selectedIds.length > 1 ? 'PER_BUILDING' : 'SHARED'
      const write = (
        value: SavedBuildingScope | null, configMode: ConfigurationMode,
      ) => set({
        scopeSaved: value,
        scopeCommit: null,
        configurationMode: configMode,
      })
      write(saved, mode)
      // BEFORE the save's own event, not after: `apply` gives the LAST
      // journalled event the undo toast, and the projection's events are an
      // internal consequence. Running them afterwards put "Gebäude Haus A
      // bestätigt" — a building the user has never seen — on screen as the
      // outcome of saving their scope.
      syncPricingProjection()
      apply({
        kind: 'value.confirmed',
        label: `Gebäudeumfang gespeichert · ${saved.selectedIds.length} Gebäude`,
        labelKey: 'vr3.journal.buildingScopeSaved',
        labelValues: { count: saved.selectedIds.length },
        deltaExact: null,
        inverse: () => write(before, beforeMode),
        forward: () => write(saved, mode),
      })
    },

    clearBuildingScopeSaveError: () => {
      if (get().scopeCommit?.errorKey) set({ scopeCommit: null })
    },

    buildingScopeStage: () => buildingScopeStage(get()),

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
 * The payload already on disk, so an unchanged state does not rewrite it.
 *
 * VR3-03R moved this out of `initializeProposalPersistence`'s closure: a
 * failed write has to be RETRYABLE from the rail, and a retry needs to know
 * what the last successful write actually was. Keeping it in the closure is
 * what made the failure unrecoverable as well as invisible.
 */
let lastPersistedSerialization: string | null = null
/**
 * The payload whose write already FAILED.
 *
 * Without it the failure handler recurses without end: recording the
 * failure is itself a state change, the subscriber runs again, the payload
 * still differs from the last SUCCESSFUL write, so it writes again, fails
 * again, records again. Caught by the blocked-storage test with "Maximum
 * call stack size exceeded" — a self-inflicted defect of exactly the kind
 * the visible-failure requirement exists to expose rather than hide.
 *
 * A payload known to fail is not retried on every subsequent keystroke.
 * The user's explicit Retry clears this, because "try it again" is a new
 * instruction, not a repeat of the same one.
 */
let lastFailedSerialization: string | null = null

/**
 * WHICH PROJECT the working copy currently in the store belongs to.
 *
 * One function, so the subscriber, the explicit write, the restore and the
 * reset cannot disagree about where a proposal is filed. Before any project
 * is opened there is no project to name, and the pre-project bucket answers
 * for the fixture working copy the store always holds.
 */
function proposalProjectIdOf(state: Pick<Store, 'opportunityId'>): string {
  return state.opportunityId ?? PROPOSAL_PROJECT_ID
}

/**
 * Everything in the store that belongs to ONE project's Option workspace.
 *
 * Derived by SUBTRACTION, deliberately. Listing what to swap would mean that
 * a field added later and forgotten silently leaks across projects — the
 * exact defect this fix exists to close, reintroduced by omission. Listing
 * what to KEEP makes the safe direction the default: a new field is
 * project-scoped until somebody says otherwise, in writing, here.
 *
 * Kept across a project switch, and why:
 *   uiLanguage · density        the user's preferences, not the project's
 *   projectAnalyses             the project REGISTER's own state, already
 *                               keyed by project id — swapping it would
 *                               discard the analysis of every other project
 *   mode · level · projectStage · understandingTab · opportunityId
 *                               navigation, which `openOpportunity` sets
 *                               itself in the same write
 *
 * Actions are excluded by their type: a partial `set` never replaces them,
 * and `INITIAL_SNAPSHOT` carries the same function identities anyway.
 */
const PROJECT_SCOPED_KEEP: ReadonlySet<string> = new Set([
  'uiLanguage', 'density', 'projectAnalyses',
  'mode', 'level', 'opportunityId', 'projectStage', 'understandingTab',
])

/**
 * The initial value of every project-scoped field — i.e. the workspace a
 * project that has never been opened starts from.
 *
 * Computed once from `INITIAL_SNAPSHOT`, which is the store's own boot state
 * rather than a second hand-written copy of it.
 */
function emptyProjectWorkspace(): Partial<Store> {
  const initial = INITIAL_SNAPSHOT as unknown as Record<string, unknown>
  const empty: Record<string, unknown> = {}
  for (const key of Object.keys(initial)) {
    if (PROJECT_SCOPED_KEEP.has(key)) continue
    if (typeof initial[key] === 'function') continue
    empty[key] = initial[key]
  }
  return empty as Partial<Store>
}

/**
 * Move the store from the project it is in to another one.
 *
 * Three steps, and the order is the whole point: the project being LEFT is
 * written to its own key first, so nothing it holds is lost; the store is
 * then reset to an empty workspace, so nothing it holds can be inherited;
 * and only then is the incoming project's stored workspace restored over it.
 *
 * The reset in the middle is not redundant with the restore. A project with
 * nothing stored must start empty, not inherit whatever the previous project
 * happened to leave in the fields its own payload does not mention.
 *
 * The JOURNAL is part of the workspace and is cleared with it. Its entries
 * carry `inverse`/`forward` closures written against the state that produced
 * them, so an undo surviving a project switch would apply another project's
 * change to this one's data — the same class of defect, one level down. It
 * is session-scoped by construction anyway: a reload has never restored it.
 */
function switchProjectWorkspace(nextProjectId: string): Partial<Store> {
  const state = store.getState()
  if (state.opportunityId === nextProjectId) return {}
  if (activeProposalStorage) writeProposalPersistence()
  const empty = emptyProjectWorkspace()
  const restored = activeProposalStorage
    ? restoredProjectWorkspace(activeProposalStorage, nextProjectId)
    : null
  // The bookkeeping describes a payload for the project being left; keeping
  // it would make the incoming project's first write look like a no-op.
  lastPersistedSerialization = null
  lastFailedSerialization = null
  lastTrustedCommercial = null
  return { ...empty, ...(restored ?? {}), opportunityId: nextProjectId }
}

/**
 * Write the current state to storage, once, and say whether it worked.
 *
 * WHY THIS EXISTS (VR3-03R, audit G-07). The subscriber used to read
 * `savePersistedProposal`'s boolean and, on `false`, simply not update its
 * bookkeeping — no state, no surface, no retry. So a full or blocked
 * storage backend meant the user kept working against decisions that were
 * no longer being saved, and nothing anywhere said so. Target L's own
 * words: "REMOVE=Zero fallback, silent failure and hidden save rejection."
 *
 * The user's decisions are never at risk here — they live in the store, and
 * this function does not touch them. What is at risk is the user's BELIEF
 * that they are safe, which is why the failure has to be visible.
 */
function writeProposalPersistence(): boolean {
  const storage = activeProposalStorage
  if (!storage) return false
  const state = store.getState()
  const projectId = proposalProjectIdOf(state)
  const payload = capturePersistedProposal(state)
  const serialized = serializeProposalPayload(projectId, payload)
  if (serialized === lastPersistedSerialization) return true
  if (!savePersistedProposal(storage, projectId, payload)) {
    lastFailedSerialization = serialized
    return false
  }
  writeLastProjectId(storage, projectId)
  lastPersistedSerialization = serialized
  lastFailedSerialization = null
  return true
}

/**
 * The rail's Retry for a save failure.
 *
 * IDEMPOTENT, and it forgets the previous failure first: the subscriber
 * deliberately does not re-attempt a payload it already knows fails, so a
 * retry that did not clear that memory would report success without ever
 * having tried.
 */
function retryProposalPersistence(): boolean {
  lastFailedSerialization = null
  return writeProposalPersistence()
}

/**
 * One project's stored workspace, as a state patch — or `null` when it has
 * none, or has one that cannot be trusted.
 *
 * Extracted from `hydrateProposalState` so that booting into a project and
 * SWITCHING to one restore through exactly the same reader. Two readers were
 * how the single-key contract survived as long as it did: the boot path was
 * the only one anybody looked at, and switching projects had no restore at
 * all — it simply kept whatever was already in the store.
 *
 * It deliberately does NOT set `opportunityId`: the caller knows which
 * project it asked for, and a payload is not allowed to answer that question
 * for itself.
 */
function restoredProjectWorkspace(
  storage: StorageLike, projectId: string,
): Partial<Store> | null {
  const loaded = loadPersistedProposal(storage, projectId)
  if (loaded.status !== 'loaded') return null
  if (!isPersistedProposalPayload(loaded.payload)) {
    clearPersistedProposal(storage, projectId)
    return null
  }
  try {
    const payload = loaded.payload
    const active = restoredOptionConfig(payload.active, payload.buildingConflicts)
    const optionConfigs = Object.fromEntries(
      Object.entries(payload.optionConfigs).map(([id, config]) => [
        id, restoredOptionConfig(config, payload.buildingConflicts),
      ]),
    )
    return {
      ...active,
      configurationModeEditing: false,
      options: payload.options,
      activeOptionId: payload.activeOptionId,
      optionSeq: payload.optionSeq,
      optionConfigs,
      buildingConflicts: payload.buildingConflicts,
      projectParamsConfirmed: payload.projectParamsConfirmed === true,
      snapshots: Object.freeze(
        (payload.snapshots ?? []).map((snap) => deepFreeze({ ...snap })),
      ) as OfferSnapshot[],
      savedOptionVersions: Object.fromEntries(
        Object.entries(payload.savedOptionVersions ?? {}).map(([id, versions]) => [
          id,
          Object.freeze(versions.map((version) => deepFreeze({ ...version }))),
        ]),
      ) as Record<string, readonly SavedOptionVersion[]>,
      ...NO_TRANSIENT,
    }
  } catch {
    // An incompatible payload must never prevent the fixture-backed store
    // from mounting, nor a project from being opened.
    clearPersistedProposal(storage, projectId)
    return null
  }
}

/**
 * Restore is explicit and atomic. A valid payload adds exactly one
 * non-undoable event; absent or rejected payloads leave the fixture intact.
 *
 * `projectId` names WHICH project to restore. It defaults to the project the
 * browser was last working in, because with one key per project the boot
 * path can no longer assume there is only one candidate — and guessing would
 * restore a project the user never asked for.
 */
export function hydrateProposalState(
  storage = browserProposalStorage(),
  projectId?: string,
): boolean {
  if (!storage) return false
  const wanted = projectId ?? readLastProjectId(storage) ?? PROPOSAL_PROJECT_ID
  const loaded = loadPersistedProposal(storage, wanted)
  if (loaded.status !== 'loaded') return false
  if (!isPersistedProposalPayload(loaded.payload)) {
    clearPersistedProposal(storage, wanted)
    return false
  }

  try {
    const payload = loaded.payload
    const restored = restoredProjectWorkspace(storage, wanted)
    if (!restored) return false
    store.setState((state) => ({
      ...restored,
      level: payload.activeOptionId ? 'option' : 'liste',
      /**
       * The project the payload was FILED UNDER, not the one it claims.
       *
       * Under the single-key contract this read `payload.opportunityId`,
       * because the key could not answer the question — it was the same key
       * for every project. It can now, and the key is the authority: a
       * payload restored from `proposalStorageKey(X)` belongs to X by
       * construction, and `prunePersistedProposals` has already dropped any
       * payload whose envelope disagreed with its own key.
       */
      opportunityId: payload.activeOptionId ? wanted : null,
      mode: 'intern',
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
    clearPersistedProposal(storage, wanted)
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
  /**
   * Drop untrusted payloads BEFORE restoring anything.
   *
   * This is what retires the single-key contract on a browser that already
   * holds one: the legacy payload is filed under a constant that names no
   * project, so it fails the envelope check and is removed rather than being
   * served to whichever project is opened first.
   */
  prunePersistedProposals(storage)
  hydrateProposalState(storage)
  lastPersistedSerialization = serializeProposalPayload(
    proposalProjectIdOf(store.getState()), capturePersistedProposal(store.getState()),
  )
  stopProposalPersistence = store.subscribe((state) => {
    const projectId = proposalProjectIdOf(state)
    const payload = capturePersistedProposal(state)
    const serialized = serializeProposalPayload(projectId, payload)
    if (serialized === lastPersistedSerialization) return
    // A payload already known to fail is not written again on every
    // subsequent state change — see `lastFailedSerialization`.
    if (serialized === lastFailedSerialization) return
    if (savePersistedProposal(storage, projectId, payload)) {
      // Recorded only on a SUCCESSFUL write: a pointer at a project whose
      // workspace was never stored would restore nothing on the next boot
      // and lose the project the user actually was in.
      writeLastProjectId(storage, projectId)
      lastPersistedSerialization = serialized
      lastFailedSerialization = null
      // A write that succeeded clears a save failure and nothing else. A
      // CALCULATION failure is a different claim about a different thing,
      // and a successful save is no evidence about the arithmetic.
      if (state.commercialTrust.reason === 'persistence') {
        store.setState({ commercialTrust: COMMERCIAL_TRUSTED })
      }
      return
    }
    lastFailedSerialization = serialized
    if (state.commercialTrust.reason === 'persistence') return
    store.setState({
      commercialTrust: {
        status: 'stale',
        reason: 'persistence',
        sinceIso: new Date().toISOString(),
        attempts: 0,
      },
    })
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
 * The controlled calculation-failure door (VR3-03R, audit G-07;
 * screen-by-screen spec §15 "ENTRY PRECONDITION=Controlled fixture/runtime
 * failure mechanism").
 *
 *   window.__all3Fault.calculation(true)   // induce
 *   window.__all3Fault.calculation(false)  // recover
 *
 * The audit's own G-07 evidence line was "failure could not be induced
 * through ordinary Product controls", and a recovery state nobody can reach
 * is a recovery state nobody can review — which is how it went unbuilt for a
 * release. So it is reachable from the console, and from nowhere else: no
 * button, no setting, no URL parameter.
 *
 * IT LIVES HERE, NOT IN `main.tsx`. The first draft registered it from the
 * entry module, which imports this one — and under Vite's HMR that left the
 * handle holding a store instance the React tree no longer rendered from, so
 * injecting a fault silently did nothing (observed live: three calls, no
 * state change, no error, and a stale state that would not clear).
 * Registering it beside the store it perturbs means the handle and the state
 * can only ever come from the same module instance. Absent entirely from a
 * production build, which is also why `setCommercialFault` refuses to run
 * there.
 */
if (typeof window !== 'undefined'
  && (import.meta as { env?: { MODE?: string } }).env?.MODE !== 'production') {
  (window as unknown as {
    __all3Fault?: {
      calculation: (on: boolean) => void
      trust: () => unknown
    }
  }).__all3Fault = {
    calculation: (on: boolean) => store.getState().setCommercialFault(on),
    /**
     * Read the trust verdict without inferring it from the screen.
     *
     * A reviewer proving "the total stayed and the state says stale" should
     * not have to deduce the state from the pixels that are the thing under
     * review. Read-only, and dev-only like its neighbour.
     */
    trust: () => ({
      fault: store.getState().commercialFault,
      ...store.getState().commercialTrust,
    }),
  }
}

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
  // VR3-03R: the written-payload bookkeeping moved to module scope so a
  // failed write could be retried. It has to be reset with the rest of it,
  // or a serialization left by the previous test makes the next one's first
  // write look like a no-op.
  lastPersistedSerialization = null
  lastFailedSerialization = null
  // A trusted snapshot of a discarded Option is not a fallback, it is a
  // wrong answer.
  lastTrustedCommercial = null
  // EVERY project's workspace, not just one: with a key per project, clearing
  // a single id would leave the next test inheriting another project's
  // proposal — the very leak this contract exists to prevent, reintroduced
  // inside the reset that is supposed to guarantee a clean slate.
  if (activeProposalStorage) {
    clearAllPersistedProposals(activeProposalStorage)
    clearPersistedProposal(activeProposalStorage, PROPOSAL_PROJECT_ID)
  }
  const browserStorage = browserProposalStorage()
  if (browserStorage && browserStorage !== activeProposalStorage) {
    clearAllPersistedProposals(browserStorage)
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
    | 'included' | 'scopeCatalogChoices'>
    & Partial<Pick<Store, 'kgConfig'>>,
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
    case 'kgScope':
      return s.kgConfig?.scope[change.group] === change.value
    case 'kgService': {
      const held = s.kgConfig?.services[change.serviceId]
      return held?.state === change.value.state
        && held?.variant === change.value.variant
        && held?.quantity === change.value.quantity
    }
  }
}

/**
 * The bilingual label of a KG decision, read from the catalogue that owns it.
 *
 * Both languages come back together because the change has to be legible on
 * the rail in whichever language the interface is in, and a single-language
 * label would leave the other one either raw or German (the exact class
 * `translatedDriverLabel` is still recovering from). Service ids are unique
 * across the two demonstration catalogues, so searching both is a lookup,
 * not a guess.
 */
export function kgChangeLabels(
  change: Extract<PriceChange, { kind: 'kgScope' | 'kgService' }>,
): { de: string; en: string } {
  if (change.kind === 'kgScope') {
    const group = change.group.replace('_', `${NNBSP}`)
    return {
      de: `${group} ${COVERAGE_LABEL[coverageStateOfKgDecision(change.value)]}`,
      en: `${group} ${COVERAGE_LABEL_EN[coverageStateOfKgDecision(change.value)]}`,
    }
  }
  for (const catalogue of kgCatalogues()) {
    const service = kgServiceById(catalogue, change.serviceId)
    if (!service) continue
    if (change.value.state === 'selected' && service.kind.kind === 'singleChoice') {
      const variant = service.kind.variants.find((v) => v.value === change.value.variant)
      if (variant) {
        return {
          de: `${service.labelDe} · ${variant.labelDe}`,
          en: `${service.labelEn} · ${variant.labelEn}`,
        }
      }
    }
    const suffixDe = change.value.state === 'selected' ? 'aufgenommen'
      : change.value.state === 'notSelected' ? 'nicht aufgenommen' : 'offen'
    const suffixEn = change.value.state === 'selected' ? 'included'
      : change.value.state === 'notSelected' ? 'not included' : 'open'
    return {
      de: `${service.labelDe} · ${suffixDe}`,
      en: `${service.labelEn} · ${suffixEn}`,
    }
  }
  return { de: change.serviceId, en: change.serviceId }
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
    case 'kgScope':
    case 'kgService':
      return kgChangeLabels(change).de
  }
}

const LABEL_UG: Record<BuildingInput['untergeschoss'], string> = {
  kein_ug: 'nicht Bestandteil',
  ab_decke: 'Leistungsbeginn ab OK Decke über UG',
  vollausbau: 'vollständig inkl. Gründung',
}

/**
 * The undo prefix, in both languages (VR3-03R).
 *
 * Beside `COVERAGE_LABEL`/`COVERAGE_LABEL_EN` rather than in a dictionary
 * because it composes a `CommercialChange`, and that record stores resolved
 * text in both languages by contract — the rail picks the language, it does
 * not translate. `translatedChangeLabel` documents why: store logic has no
 * i18n hook, and a key resolved at the wrong moment is how a German label
 * ends up beside an English service name.
 */
const UNDO_CAUSE_PREFIX = { de: 'Rückgängig · ', en: 'Undone · ' } as const

const COVERAGE_LABEL: Record<CoverageState, string> = {
  included: 'enthalten',
  excluded: 'nicht enthalten',
  onRequest: 'auf Anfrage',
  unknown: 'noch offen',
  notApplicable: 'nicht anwendbar',
}

/** The same six words in English. The catalogue is bilingual, so the label
 * around it has to be too — a German word beside an English service name is
 * the mixed-language state rule 10 forbids. */
const COVERAGE_LABEL_EN: Record<CoverageState, string> = {
  included: 'included',
  excluded: 'not included',
  onRequest: 'on request',
  unknown: 'still open',
  notApplicable: 'not applicable',
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
  lang: 'de' | 'en' = 'de',
): string {
  // VR3-03: the KG catalogue stores BOTH languages beside each other, so this
  // is a lookup rather than a reverse-index bridge — the one class of silent
  // failure `translatedDriverLabel` documents.
  if (change.kind === 'kgScope' || change.kind === 'kgService') {
    const labels = kgChangeLabels(change)
    return lang === 'en' ? labels.en : labels.de
  }
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
