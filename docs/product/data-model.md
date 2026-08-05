# Модель данных и состояний

Версия 0.3 · Дата: 2026-08-05 · **Переписана под аудит Batches 01–02, разделы 5.1–5.8**
Связанные: `t0-fallback-rules.md`, `decisions.md`, `screen-map.md`, `calculation-spec.md`, `metrics.md` §12, `docs/audit/synthetic-fixtures.md`

**Что изменилось против v0.1.** Версия 0.1 описывала модель словами и списком таблиц. Внешний аудит показал, что словесной модели недостаточно: двенадцать release-блокеров (`DATA-001`, `DATA-004`, `DATA-005`, `CALC-001…014`, `SCOPE-001`, `VERSION-001/002`, `SOURCE-001`, `STALE-001`) — это не ошибки реализации, а следствия того, что модель не различала сущности, которые обязана различать. Число не знало своего знаменателя, «конфликт» был значением поля «источник», итог назывался полным при неоценённой группе затрат. Версия 0.2 добавила формальную типизированную модель (§5) и превратила §9 в исполняемый набор инвариантов.

**Что изменилось против v0.2.** Формальная модель v0.2 **ссылалась на типы, которых не определяла**: `ScheduleDurationUncertainty` в §5.8, `ImpactAffectedRef`, `CostRangeImpact` и `ScheduleRangeImpact` в §5.6, `ProposedScopeSelection` и `OptionSelection` в §5.4, `ValidationIssue` — сразу из трёх мест. Висячая ссылка в контракте хуже пропущенного раздела: она выглядит выполненным требованием, а проверяется одним `grep`. Версия 0.3 определяет их и ещё шесть конструкций, которые норматив называет по имени внутри блокирующих требований: `OptionUiState` (CALC-011 требует `OptionUiState.authoritativeReady` буквально), слой котировок R-18, `OptionDefinition` и `OptionEvaluation` вместе с инвариантами графа опций, документный слой VERSION-002, `Conflict` и `ValueAuditIndex` из осей SOURCE-001, `ConfigurationDraft` и `ConfigurationProposal` вместо комментария-заглушки. Плюс `ValidationIssue`, `ValidationIssueStatusEvent` и `OutputProfile` в новом §5.11. Одновременно в §9 перенесены инварианты, которые в v0.2 остались прозой, отсутствовали или потеряли вторую половину формулировки: пункты 53–84.

**Почему это отдельная редакция, а не правка.** Правило приёмки, за которое батчи отклонялись пять раз: **исправляется заявление, а не объект**. Абзац «модель обязана содержать тип X» требование не закрывает — закрывает только сам тип X в тексте контракта и нумерованный проверяемый пункт §9.

**Что не изменилось.** M-1…M-4 неприкосновенны и остались дословно. §10 показывает, что формальная модель — их уточнение, а не замена: каждый из четырёх принципов отображается в конструкции §5 без потерь.

---

## 0. Откуда взята модель

Продукт по своей природе — **CPQ-система** (Configure–Price–Quote) для строительного девелопера. Из зрелой CPQ-практики взяты три проверенных паттерна: версионирование ценовых правил (нужно знать, по каким ставкам считался любой прошлый оффер), **неизменяемый снапшот отправленного предложения** и сквозной audit trail ([Salesforce](https://www.salesforce.com/sales/cpq/what-is-cpq/), [NetSuite](https://www.netsuite.com/portal/resource/articles/erp/configure-price-quote-cpq.shtml), [Zone & Co](https://www.zoneandco.com/articles/what-is-configure-price-quote-cpq-software)). Всё остальное — доменное: слой доказательств из документации, наследование значений, здания как отдельная сущность.

Ядро модели — четыре собственных решения (M-1…M-4), каждое с бизнес-обоснованием. Они важнее списка таблиц: таблицы ин-хаус команда может переименовать, а эти четыре принципа менять нельзя, не сломав продукт.

---

## 1. M-1: Два слоя — Evidenz и Festlegung

**Решение.** Данные проекта разделены на два слоя, которые никогда не смешиваются:

- **Evidenz (уровень проекта)** — «что говорят документы и клиент»: извлечённые из документации значения с источником (файл + страница), уверенностью и статусом подтверждения. Один слой на проект, общий для всех вариантов.
- **Festlegung (уровень варианта)** — «что мы предлагаем в этом оффере»: выбранные значения параметров конкретного варианта.

**Бизнес-обоснование.** BGF здания — это факт о здании, а Energiestandard EH 40 в оффере — это наше коммерческое решение. Смешивание фактов и решений в одном поле — источник всех тупиков, найденных при аудите: перезапись подтверждённых значений парсером, расползание вариантов после доприсланных документов, невозможность ответить «откуда цифра». Два слоя решают все три класса проблем одной конструкцией.

Чипы источников из D-08 — это в точности состояния записи Evidenz плюс отметка происхождения Festlegung:

| Чип | Слой | Что означает |
|---|---|---|
| `aus Dokument` | Evidenz | извлечено, источник указан |
| `vom Kunden bestätigt` | Evidenz | подтверждено клиентом (вопросом до встречи или на встрече) |
| `abgeleitet` | Evidenz | подстановка по fallback-правилу (T0) или All3-стандарт (T1) |
| `manuell erfasst` | Festlegung | введено sales без подтверждения клиента |

> **Уточнение v0.2 (SOURCE-001).** Чип — это **проекция**, а не поле. Он вычисляется из независимых осей §5.2: происхождение (`SourceReference`), вывод (`derivation`), подтверждение (`VerificationEvent`), конфликт (`Conflict`), свежесть и статус выбора (`ValueContextState`). Значение может одновременно быть выведенным из документа, подтверждённым клиентом, конфликтующим с другим источником, устаревшим в текущем контексте и всё ещё authoritative в отправленной версии. Одно поле `konfidenz` этого не выражает — оно было упрощением, которое аудит справедливо назвал блокером.

---

## 2. M-2: Наследование до фиксации (Vererbung bis Festlegung)

**Решение.** Вариант **не хранит копию всех 68 параметров**. Он хранит только то, что в нём явно изменено. Значение параметра в варианте разрешается каскадом:

```
1. Festlegung этого варианта            (если sales явно менял — festgelegt)
2. Evidenz: vom Kunden bestätigt
3. Evidenz: aus Dokument
4. Evidenz: abgeleitet  ← fallback-правило T0 / All3-стандарт T1
```

Каскад — это формализация цепочки из `t0-fallback-rules.md`, доведённая до механики хранения.

**Бизнес-обоснование.**

1. **Подтверждение клиентом распространяется само.** Клиент на встрече назвал WFL → обновляется Evidenz → новое значение мгновенно видят **все варианты, которые его не переопределяли**. Не нужно вручную актуализировать четыре варианта — это ровно тот цикл ручной синхронизации, который убивает доверие к таким системам.
2. **Сравнение вариантов — это буквально содержимое хранилища.** Таблица S4 «показываем только различия» не вычисляется диффом — различия и есть то, что хранится (множества Festlegungen). Дешёво, безошибочно, мгновенно.
3. **Уникальность вариантов тривиальна.** Требование PO «двух одинаковых вариантов быть не должно» — это сравнение нормализованных множеств `(Festlegungen + состав зданий + набор KG + скидка)`. Совпал хеш при сохранении/клонировании → предупреждение с предложением открыть существующий.
4. **Клонирование бесплатно.** «Вариант без UG» = базовый + 1 Festlegung. Требование «< 3 минут на альтернативный вариант» выполняется по построению.

> **Уточнение v0.2 — где каскад живёт, а где заканчивается.** Аудит требует, чтобы `VariantVersion` содержала **полные целевые множества** — по одной записи на каждый Scope Item и на каждую применимую опцию, «не разрежённый патч» (§5.4). Противоречия с M-2 здесь нет, потому что это разные стадии жизненного цикла:
>
> | Стадия | Что хранится | Кто это в §5 |
> |---|---|---|
> | Редактирование | только отличия от базы — каскад живой | `ConfigurationDraftRevision` |
> | Фиксация в предложение | полное целевое множество, у изменённых записей — `proposalReason` | `ConfigurationProposal` |
> | Коммит | полный неизменяемый снапшот; **у неизменённых записей переиспользуются ссылки базы на событие и значение** | `VariantVersion` |
>
> Именно последняя оговорка сохраняет все четыре выгоды M-2: неизменённая запись физически ссылается на то же `CoverageDecisionEvent` и тот же `ValueId`, что и база. Сравнение вариантов остаётся сравнением множеств ссылок, клонирование остаётся дешёвым, а подтверждение клиента по-прежнему распространяется — но при этом отправленный оффер полон и воспроизводим, а не зависит от того, чему равен каскад в момент открытия. **Разрежённость — свойство черновика, полнота — свойство снапшота.**

---

## 3. M-3: Заморозка при отправке (Einfrieren beim Versand)

**Решение.** Наследование живо, пока вариант в работе. В момент экспорта/отправки создаётся **неизменяемый снапшот**: все разрешённые значения, все ставки и коэффициенты расчёта (версия таблицы ставок!), итоги, интервал, состав допущений, тексты. Отправленный оффер ссылается только на снапшот.

Если после отправки Evidenz меняется (клиент дослал документы), рабочий вариант обновляется, а у отправленного появляется флаг **«Grundlage seit Versand geändert»** с диффом снапшот ↔ текущее.

**Бизнес-обоснование.** Без заморозки возможен юридически опасный сценарий: клиент получил PDF с итоговой суммой, через неделю прислал уточнённые планы, sales открывает систему — а там уже другое число, и никто не может воспроизвести отправленное. Снапшот + версионированные ставки = любой когда-либо отправленный оффер воспроизводим бит-в-бит. Это же требование CPQ-аудита: «what was in effect on any given date».

---

## 4. M-4: Журнал событий как хребет (Ereignis-Log)

**Решение.** Каждое изменение — append-only событие. Схема событий уже определена в `metrics.md` §12 и **является частью модели данных**, а не аналитической добавкой. Из одного журнала производятся четыре вещи:

| Потребитель | Как |
|---|---|
| История варианта и лог проекта (требование PO) | проекция журнала по variant_id / project_id |
| Журнал сессии (S3) | события с момента входа в Präsentationsmodus |
| Undo | обратное применение последнего события |
| Все метрики §12 | журнал и есть их источник |

**Бизнес-обоснование.** Альтернатива — четыре отдельных механизма (история, сессия, undo, аналитика), которые расходятся между собой. Один журнал делает расхождение невозможным. Дополнительно: `Annahmen` **не хранятся как отдельные записи** — активное допущение = состояние «каскад дошёл до уровня 4» + событие `assumption.created` для метрик. Список допущений в P4 и блок в PDF всегда точны по построению, потому что выводятся из тех же данных, что и расчёт.

> **Уточнение v0.2 (CALC-014).** Сессионная сводка строится **только из закоммиченных событий журнала**, хранит `baselineVersionId`, `headVersionId`, упорядоченный список ID событий и точную Decimal-дельту; действия без изменения данных (открыл, посмотрел, свернул) в счётчик не входят. Подпись — `Preisänderung gegenüber <Vergleichsbasis>` с суммой и словом `netto`, где `netto` обозначает налоговую базу, а не результат взаимозачёта. Раскрывающийся список строк ссылается на ключи `ImpactContributionDelta` и обязан суммироваться в заголовок точно, до отображаемого округления; расхождение блокирует клиентскую сводку и экспорт.

---

## 5. Формальная модель

Раздел соответствует §5.1–5.8 норматива аудита. Типы записаны на TypeScript-подобном псевдокоде: это контракт для ин-хаус команды, а не исходник прототипа. Прототип реализует подмножество (§8).

**Одно осознанное расширение охвата.** §5.11 берёт `ValidationIssue`, `ValidationIssueStatusEvent` и `OutputProfile` из §5.9 норматива, хотя охват партии — §5.1–5.8. Причина структурная, а не по инициативе: на `ValidationIssue` ссылаются `PricingSummary.completeness` (§5.4), документный слой (§5.7) и инварианты 16 и 27, то есть три места **внутри** охвата. Оставить тип неопределённым значило бы сохранить висячую ссылку — тот самый дефект, из-за которого понадобилась эта редакция. Остальное содержимое §5.9 норматива (`FieldOutputPolicy`, `OutputPreflightResult`, `OutputCalculationBinding`) в модель не переносится: на него внутри §5.1–5.8 никто не ссылается, и его место — в партии по выдачам.

**Общее правило именования.** Ни одно поле не называется `confidence`, `status`, `type` или `source` без уточнения. Обобщённое имя — это место, куда через полгода сложат две несовместимые сущности; именно так «конфликт» стал значением поля «источник» (SOURCE-001).

**Общее правило ссылок: тип, на который ссылаются, обязан быть объявлен.** Скаляры, ссылки на снапшоты и таксономии перечислены ниже целиком, а не подразумеваются. Причина та же, по которой запрещены висячие ссылки на токены дизайн-системы: имя, которого нигде нет, читается как выполненное требование и проверяется одним поиском. Идентификаторы с суффиксом `…Id` — единственное исключение: они непрозрачны по конвенции и структуры не имеют.

```ts
// ── скаляры ────────────────────────────────────────────────────────────────
type Decimal          = string;   // точное десятичное значение; НИКОГДА не binary float
type ISODate          = string;   // календарная дата в формате ISO 8601 (машинное значение)
type ISODateTime      = string;   // момент времени со смещением зоны в формате ISO 8601
type IanaTimezone     = string;   // идентификатор зоны IANA, например Europe/Berlin
type ISO4217Currency  = string;   // трёхбуквенный код валюты, например EUR
type Unit             = string;   // каноническая единица величины, например m2
type LocalizationKey  = string;   // ключ словаря i18n; UI-текст строкой не хранится (DC-45)

BoundingBox { page: number; x: Decimal; y: Decimal; width: Decimal; height: Decimal }

ScopeRef {
  entityRef: EntityRef;            // к чему относится величина
  costGroupCodes: string[];        // покрытые группы затрат; пустой массив = все
  qualifierKeys: string[];         // дополнительные ограничители из каталога
}

// ── ссылка на снапшот: идентификатор ПЛЮС хеш ──────────────────────────────
// Ссылка без хеша не доказывает, что расчёт видел именно эту редакцию, —
// поэтому пары «id + hash» здесь нет ни одного исключения.
type SnapshotRef = { snapshotId: string; snapshotHash: string };

type RulesetSnapshotRef                 = SnapshotRef;
type BenchmarkSnapshotRef               = SnapshotRef;
type InputSnapshotRef                   = SnapshotRef;
type TaxRateSnapshotRef                 = SnapshotRef;
type FxRateSnapshotRef                  = SnapshotRef;
type ComparisonNormalizationSnapshotRef = SnapshotRef;
type AllocationRuleSnapshotRef          = SnapshotRef;
type ImpactAggregationRuleSnapshotRef   = SnapshotRef;
type UncertaintyMethodSnapshotRef       = SnapshotRef;
type OptionCatalogSnapshotRef           = SnapshotRef;
type ParameterCatalogSnapshotRef        = SnapshotRef;

// ── таксономии: значения живут в версионированном каталоге, не в модели ─────
// Литеральный union здесь был бы продуктовым решением, принятым в документе
// модели: каталог параметров пополняется без правки контракта.
type CatalogValueRef  = { catalogRef: ParameterCatalogSnapshotRef; valueKey: string };
type BuildingForm     = CatalogValueRef;   // Gebäudeform — уровень Building (D-11 v2)
type UseClass         = CatalogValueRef;   // Nutzungsart — уровень Usage Segment
type OccupancyProfile = CatalogValueRef;   // Belegungs-/Barrierefreiheitsprofil
type DocumentPurpose  = CatalogValueRef;   // назначение документа в проекте

CostGroupRef       { standardRef: RulesetSnapshotRef; costGroupCode: string }
BenchmarkRegionRef { benchmarkSnapshotRef: BenchmarkSnapshotRef; regionKey: string }
PriceModelRef      { catalogRef: OptionCatalogSnapshotRef; priceModelKey: string }

// ── внешние записи ─────────────────────────────────────────────────────────
ContactRef   { crmContactId: string }
CrmRecordRef { crmObjectType: string; crmObjectId: string }
ImportRef    { importBatchId: string; rowNumber: number }

type EvidenceRef =
  | { kind: "document"; documentVersionId: DocumentVersionId; page?: number }
  | { kind: "value";    valueId: ValueId }
  | { kind: "quote";    quoteRecordId: QuoteRecordId }
  | { kind: "external"; systemKey: string; recordKey: string; capturedAt: ISODateTime };

// ── закрытые перечисления, выведенные из правил §5.3 и §5.8 ────────────────
// Каждый код — одна из причин несравнимости, названных в §5.3. Список закрыт:
// новая причина требует изменения схемы, а не свободной строки.
type NonComparabilityReason =
  | "scopeMismatch" | "standardMismatch" | "areaTypeMismatch"
  | "denominatorKindMismatch" | "taxBasisMismatch"
  | "currencyWithoutFxSnapshot" | "normalizationEvidenceMissing";

BenchmarkAdjustmentStep {
  order: number;                   // позиция в упорядоченном списке поправок
  kind: "region" | "volume" | "priceLevel" | "scopeNormalization" | "taxBasis";
  ruleRef: RulesetSnapshotRef;
  applied: boolean;                // выключенная поправка остаётся в списке (D-15)
}

ScheduleMilestone  { id: ScheduleMilestoneId; date: ISODate; labelKey: LocalizationKey }

SchedulePhase {
  id: SchedulePhaseId; entityRef: EntityRef; labelKey: LocalizationKey;
  startDate: ISODate; endDate: ISODate;      // точные даты, никогда «месяц N»
}

ScheduleDependency {
  fromPhaseId: SchedulePhaseId; toPhaseId: SchedulePhaseId;
  kind: "finishToStart" | "startToStart" | "finishToFinish";
  lagDays: number;                 // целые знаковые дни
}

ScheduleBuffer {
  id: ScheduleBufferId; afterPhaseId: SchedulePhaseId;
  durationDays: number;            // целые неотрицательные дни
  reasonKey: LocalizationKey;
}
```

### 5.1. Сущности и кардинальность

```ts
type EntityRef =
  | { kind: "project";      id: ProjectId }
  | { kind: "building";     id: BuildingId }
  | { kind: "usageSegment"; id: UsageSegmentId };

Project {
  id: ProjectId;
  complexIds: ComplexId[];
  buildingIds: BuildingId[];
  variantIds: VariantId[];
  variantRoles: VariantRoleRefs;      // хранятся один раз на проект
  projectCurrency: ISO4217Currency;   // валюта проекта, не локали UI
}

Complex   { id: ComplexId; projectId: ProjectId; buildingIds: BuildingId[] }
Building  { id: BuildingId; projectId: ProjectId; complexId?: ComplexId;
            usageSegmentIds: UsageSegmentId[]; stableName: string }
UsageSegment { id: UsageSegmentId; buildingId: BuildingId; stableName: string }
```

**Кардинальность.** Project содержит `1..n` Building, `0..n` Complex, `1..n` Variant. Complex содержит `2..n` Building, и `Complex.buildingIds` — подмножество `Project.buildingIds`. Building принадлежит максимум одному Complex и содержит `1..n` Usage Segment. Ссылки двусторонне согласованы: Complex перечисляет только те здания, чей `complexId` указывает обратно на него; ни одна сущность не встречается в двух родительских массивах.

**Классификация не живёт в стабильной записи.** Четыре оси D-11 v2 редактируемы только внутри снапшота конфигурации:

```ts
BuildingConfiguration     { buildingId: BuildingId; buildingForm: BuildingForm }
UsageSegmentConfiguration { usageSegmentId: UsageSegmentId;
                            useClass: UseClass;
                            occupancyProfile?: OccupancyProfile;
                            benchmarkProfileId?: BenchmarkProfileId;
                            areaValueIds: AreaValueId[] }
```

`Gebäudeform` — свойство здания; `Nutzungsart`, `Belegungs-/Barrierefreiheitsprofil`, `Benchmarkprofil` — свойства сегмента использования. Это структурная причина, по которой единый селектор `Gebäudetyp` запрещён (DATA-003): у здания с двумя сегментами нет одного `useClass`, и место, куда его записать, отсутствует в модели. Смена оси у Haus A не может задеть Haus B, потому что записи разные.

**DATA-004 — два разных понятия смешения.** Модель различает их структурно, а не подписью:

| Понятие | Определение через модель | Где показывается |
|---|---|---|
| `Gemischte Nutzung im Gebäude` | `Building.usageSegmentIds.length ≥ 2` | карточка здания |
| `Heterogener Komplex` | у зданий комплекса различаются `useClass` их сегментов | строка комплекса |

Оба могут быть истинны одновременно и оба ложны. Одно слово `gemischt` на две ситуации запрещено; UI всегда называет, что именно смешано.

**Снапшот конфигурации и версия варианта.**

```ts
ProjectConfigurationSnapshot {
  scopeUniverseSnapshotId: ScopeUniverseSnapshotId;   // фиксирует состав Scope Items
  optionCatalogSnapshotRef: OptionCatalogSnapshotRef; // фиксирует опции и граф зависимостей
  buildingConfigurations: BuildingConfiguration[];
  usageSegmentConfigurations: UsageSegmentConfiguration[];
  inputValueIds: ValueId[];
}

ConfigurationVariant {
  id: VariantId; projectId: ProjectId;
  displayName: string;                  // только навигация; никогда не авторитетно для объёма
  status: "active" | "archived";
  versionIds: VariantVersionId[];
  headVersionId: VariantVersionId;
  createdFromVersionId?: VariantVersionId;
}

VariantVersion {
  id: VariantVersionId; variantId: VariantId;
  versionNumber: number;                // уникален и монотонно растёт внутри варианта
  parentVersionId?: VariantVersionId;
  scopeSelections: CommittedScopeSelection[];   // полное множество; тип — §5.4
  optionSelections: OptionSelection[];          // полное множество; тип — §5.4
  configuration: ProjectConfigurationSnapshot;
  calculationInputHash: string;  // конфигурация + оба снапшота каталогов + покрытие + опции
  snapshotHash: string;          // вся неизменяемая запись версии, включая аудит-метаданные
  createdAt: ISODateTime; actorId: UserId; reason: string;
}
```

Каждый снапшот содержит ровно одну `BuildingConfiguration` на каждое здание проекта и ровно одну `UsageSegmentConfiguration` на каждый сегмент — без лишних записей. **Все перечисленные выше массивы ID содержат только уникальные значения**, а `inputValueIds` дополнительно обязаны принадлежать родословной субъекта: значение чужого проекта или чужого здания в снапшот попасть не может. Оговорка выглядит формальностью, но без неё дубликат ID тихо удваивает вклад при обходе множества, а чужое значение делает расчёт невоспроизводимым — обе ошибки не видны глазом и ловятся только тестом. `VariantVersion` неизменяема после создания. Два хеша разделены намеренно: `calculationInputHash` покрывает только то, что влияет на числа, поэтому две версии с разными аудит-метаданными, но одинаковым входом расчёта сравнимы; `snapshotHash` покрывает запись целиком. Первая версия новой ветки не имеет `parentVersionId` и ссылается на происхождение через `ConfigurationVariant.createdFromVersionId`; каждая следующая берёт предыдущий `headVersionId` того же варианта. `headVersionId` двигается только явным коммитом. Заголовок и детали всегда показывают сгенерированную сводку закреплённой версии — устаревшее `displayName` не может переопределить объём.

**Расчётный прогон.**

```ts
type CalculationSubjectRef =
  | { kind: "variantVersion"; variantVersionId: VariantVersionId; calculationInputHash: string }
  | { kind: "proposal";       proposalId: ProposalId;             calculationInputHash: string };

CalculationRun {
  id: CalculationRunId;
  purpose: "authoritative" | "preview";
  subject: CalculationSubjectRef;
  inputSnapshotRef: InputSnapshotRef;  inputSnapshotHash: string;
  rulesetSnapshotRefs: RulesetSnapshotRef[];
  benchmarkSnapshotRefs: BenchmarkSnapshotRef[];
  calculationEngineVersion: string;
  createdAt: ISODateTime; startedAt?: ISODateTime; finishedAt?: ISODateTime;
  actorId: UserId;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  outputHash?: string; failureCode?: string; cancelReason?: string;
}
```

Это ответ на **VERSION-001**: расчёт версионирован и воспроизводим, потому что прогон хранит снапшот входа, версии правил, снапшот бенчмарка, версию движка, актора, время и хеш выхода. Отправленный оффер открывается с теми же входами и теми же выходами.

Комбинации субъекта и назначения не смешиваются: `authoritative` требует субъекта-версии, чей `calculationInputHash` совпадает с версией; `preview` требует субъекта-предложения. Инварианты статусов точные, и **у каждого статуса есть не только требования, но и запреты** — без запретов запись «отказ, но с хешем выхода» остаётся законной, а именно она позволяет показать результат провалившегося прогона:

| Статус | Требует | **Запрещает** |
|---|---|---|
| `queued` | — | `startedAt`, `finishedAt`, `outputHash`, `failureCode`, `cancelReason` |
| `running` | `startedAt` | `finishedAt`, `outputHash`, `failureCode`, `cancelReason` |
| `completed` | `startedAt`, `finishedAt`, `outputHash` | `failureCode`, `cancelReason` |
| `failed` | `finishedAt`, `failureCode` | `outputHash`, `cancelReason` |
| `cancelled` | `finishedAt`, `cancelReason` | `outputHash`, `failureCode` |

`startedAt` опускается **только** у `failed` и `cancelled`, и только когда отказ или отмена случились до начала исполнения. Во всех остальных случаях поле обязательно: прогон, который считался, не может не иметь времени начала. Порядок времени инвариантен: `createdAt ≤ startedAt ≤ finishedAt` для присутствующих полей; у терминального прогона всегда `createdAt ≤ finishedAt`. Терминальный прогон неизменяем; повтор создаёт новый ID. **Клиентская выдача — только завершённый актуальный authoritative-прогон**; preview показывается лишь на явно помеченных поверхностях и никогда не сериализуется как оффер.

### 5.2. Типизированные значения и составное происхождение

Ответ на **SOURCE-001**. Обобщённое поле `confidence` запрещено; шесть осей моделируются независимо.

```ts
type SourceReference =
  | { kind: "document"; documentVersionId: DocumentVersionId; page?: number;
      region?: BoundingBox; parserVersion: string;
      extractionScore?: Decimal }   // [0,1], метрика парсера; НИКОГДА не показывается как деловая точность
  | { kind: "manual";   actorId: UserId; capturedAt: ISODateTime }
  | { kind: "customer"; contactRef: ContactRef; capturedAt: ISODateTime; context: string }
  | { kind: "crm";      recordRef: CrmRecordRef; capturedAt: ISODateTime }
  | { kind: "import";   importRef: ImportRef; capturedAt: ISODateTime }
  | { kind: "system";   ruleRef: RulesetSnapshotRef; capturedAt: ISODateTime };

VerificationEvent {
  id: VerificationEventId; valueId: ValueId;
  sequenceNumber: number;                       // присваивается атомарно сервером
  status: "confirmed" | "rejected";
  recordedByUserId: UserId; assertedByContactRef?: ContactRef;
  recordedAt: ISODateTime; assertedAt?: ISODateTime; context: string;
}

ValueRecord<T> {
  id: ValueId; value: T; unit?: Unit; scopeRef: ScopeRef;
  effectiveAt?: ISODateTime; capturedAt: ISODateTime;
  displayPrecision: number;
  displayRoundingMode: "halfUp" | "halfEven" | "floor" | "ceil";
  sourceRefs: SourceReference[];
  derivation?: { formulaId: string; formulaVersion: string; inputValueIds: ValueId[] };
  modelUncertainty?: AsymmetricRange;
}

Conflict {
  id: ConflictId;
  slotKey: string;                    // спорный слот, а не «поле значения»
  scopeRef: ScopeRef;
  candidateValueIds: ValueId[];       // ≥ 2 конкурирующих ValueRecord, все сохраняются
  detectedAt: ISODateTime;
  detectedByRuleRef: RulesetSnapshotRef;
  validationIssueId: ValidationIssueId;   // материальность и блокируемые профили живут там (§5.11)
  resolutionEvents: ConflictResolutionEvent[];   // append-only
}

ConflictResolutionEvent {
  id: ConflictResolutionEventId;
  conflictId: ConflictId;
  sequenceNumber: number;             // присваивается атомарно сервером
  decision: "selectCandidate" | "captureNewValue" | "defer";
  selectedValueId?: ValueId;
  actorId: UserId; occurredAt: ISODateTime; reason: string;
}

ValueAuditIndex {
  valueId: ValueId;
  verificationEventIds: VerificationEventId[];
  conflictIds: ConflictId[];
  projectionVersion: number;
}

ValueContextState {
  valueId: ValueId; subject: CalculationSubjectRef; slotKey: string;
  selectionStatus: "authoritative" | "alternative" | "superseded";
  freshnessStatus: "current" | "stale";
  contextHash: string; derivedAt: ISODateTime;
}
```

**У `ValueRecord` нет глобального состояния `active/superseded`.** Одно и то же неизменяемое значение остаётся authoritative в старой версии варианта и заменено в новой. Это то, что делает M-3 работоспособным: отправленный оффер воспроизводится не копированием чисел, а тем, что состояние выбора хранится **в контексте**, а не в значении.

**Подтверждение выводится, а не хранится.** Нет событий → `unverified`; иначе решает событие с наибольшим `sequenceNumber`. Номер присваивается атомарно и не может быть задним числом; `assertedAt` фиксирует, когда клиент это сказал, не меняя порядок событий. Отмена — новое событие; удаление и переписывание запрещены. Подтверждение клиентом значения из документа **добавляет событие, а не переписывает источник** — цепочка «страница 47 чертежа → значение → клиент подтвердил на встрече» остаётся целой. Подтверждение считается тем же значением, только если нормализованное Decimal, единица и scope совпадают точно; любое расхождение создаёт новое значение с происхождением `customer` плюс связь конфликта с прежним.

**`Conflict` — запись, а не значение поля «источник».** Это и есть исправление SOURCE-001 в его буквальной формулировке: `Konflikt` был одним из значений оси происхождения, поэтому конфликтующее значение теряло собственный источник — «откуда цифра» превращалось в «конфликт». Теперь конфликт живёт отдельной append-only записью, которая **не трогает ни один из конкурирующих `ValueRecord`**: все кандидаты остаются целыми со своими источниками, а спорным объявляется слот. Разрешение — тоже событие: статус конфликта выводится из события с наибольшим `sequenceNumber`, `selectCandidate` требует `selectedValueId` из числа кандидатов, `captureNewValue` требует нового значения вне списка кандидатов (и создаёт его как обычный `ValueRecord` с собственным происхождением), `defer` — это кнопка `Später entscheiden` из CONFLICT-001: конфликт остаётся открытым, и это законное состояние, а не пропуск. Переписать или удалить событие нельзя; «отмена решения» — новое событие. Материальность и перечень заблокированных выдач конфликт **не хранит сам**, а берёт из связанного `ValidationIssue` (§5.11) — иначе появились бы два независимых мнения о том, блокирует ли этот конфликт клиентский PDF.

**`ValueAuditIndex` — перестраиваемая серверная проекция, не входящая в хеш `ValueRecord`.** Она существует только чтобы не сканировать все события ради вопроса «что известно про это значение». Авторитетны исключительно append-only записи `VerificationEvent` и `Conflict`; при расхождении индекса с ними правым всегда оказывается поток событий, а индекс пересобирается. Поэтому `projectionVersion` — версия схемы проекции, а не версия данных: индекс не является данными.

Свежесть и выбор выводятся в `ValueContextState` для точной пары «субъект + слот»; клиент их не изменяет. На одну пару `(subject, slotKey)` не бывает больше одного `authoritative`. Ноль authoritative допустим только пока нерешённый конфликт блокирует все зависимые Output Profile.

**Диапазоны и дельты.**

```ts
AsymmetricRange { representation: "absolute" | "relativePercent"; lower: Decimal; upper: Decimal }
MoneyRange      { lower: Decimal; upper: Decimal; currency: ISO4217Currency; taxBasis: "net" | "gross" }
MoneyBoundDelta { lowerBoundDelta: Decimal; upperBoundDelta: Decimal;
                  currency: ISO4217Currency; taxBasis: "net" | "gross" }
DurationRange   { lower: Decimal; upper: Decimal;
                  durationBasis: "calendarDay" | "workingDay"; calendarId?: CalendarId }
DurationDelta      { value: Decimal; durationBasis: …; calendarId?: CalendarId }
DurationBoundDelta { lowerBoundDelta: Decimal; upperBoundDelta: Decimal; durationBasis: …; calendarId?: … }
```

У каждого диапазона `lower ≤ upper`. У `relativePercent` дополнительно `lower ≤ 0 ≤ upper`. Пары `*BoundDelta` — знаковые изменения границ, а не диапазоны: у них нет требования упорядоченности, и путать их с диапазоном нельзя. `calendarId` обязателен ровно для `workingDay` и запрещён для `calendarDay`.

Четыре контракта, каждый из которых закрывает свой способ получить бессмысленное число:

- **`absolute`-`AsymmetricRange` наследует единицу целевой `ValueRecord`** и своей единицы не имеет. Диапазон в неизвестной единице — это два числа, а не диапазон; при этом собственное поле единицы позволяло бы объявить `± 200` метров у денежной величины.
- **`DurationRange` — только неотрицательные целые дни.** Отрицательная длительность не существует, а дробный день превращает сверку «даты минус даты» в вопрос о порядке округления.
- **`DurationDelta` и `DurationBoundDelta` — целые знаковые дни.** Знак обязателен, потому что смысл дельты в направлении; целость — потому что дельта считается вычитанием двух целых величин и дробной быть не может.
- **`MoneyRange` и `MoneyBoundDelta` — общая валюта и общая налоговая база у обеих границ.** Граница `lower` в netto и `upper` в brutto даёт диапазон, ширина которого измеряет ставку НДС, а не неопределённость. По той же причине запрещено выводить налоговую базу из подписи (§5.3).

### 5.3. Площади, деньги и ставки

Ответ на **DATA-001**, **DATA-005** и **CALC-010**.

```ts
type AreaType =
  | "BGF_TOTAL" | "BGF_ABOVE_GROUND" | "BGF_R" | "BGF_S"
  | "WFL_WOFLV" | "NUF_DIN277" | "COMMUNAL_AREA" | "CUSTOM_EXPLICIT";

interface AreaValue extends ValueRecord<Decimal> {
  areaType: AreaType; unit: "m2";
  standardRef?: RulesetSnapshotRef;      // обязателен для WFL/NUF/BGF
  customDefinitionId?: AreaDefinitionId; // обязателен и только для CUSTOM_EXPLICIT
  inclusions: ScopeRef[]; exclusions: ScopeRef[];
}

interface MoneyValue extends ValueRecord<Decimal> {
  currency: ISO4217Currency; taxBasis: "net" | "gross"; taxRateRef?: TaxRateSnapshotRef;
}

type RateDenominator =
  | { kind: "area";      areaValueId: AreaValueId }
  | { kind: "unitCount"; unitCountValueId: UnitCountValueId };

RateMetric {
  id: RateMetricId;
  numeratorMoneyValueId: MoneyValueId;
  denominator: RateDenominator;          // ровно один
  calculationRunId: CalculationRunId;
  scopeRef: ScopeRef;
}
```

**Ставка ссылается на знаменатель, а не на подпись.** Это и есть исправление DATA-001: `1.820 €/m² BGF oberirdisch` не текст, а `RateMetric`, чей `denominator.areaValueId` указывает на конкретный `AreaValue` с `areaType = BGF_ABOVE_GROUND`. Сложить надземную и подземную площадь и подписать «oberirdisch» становится невозможно — знаменатель одной ставки не может быть двумя разными значениями. Проверка «`сумма / знаменатель` воспроизводит ставку в пределах задокументированного округления» — инвариант §9.

**DATA-005 — коммунальные площади.** `COMMUNAL_AREA` — отдельный тип. Подпись `WFL` не включает ненормативные площади ни при каких условиях; если бенчмарк-профиль их включает, он говорит это явно своим составом, а не сноской у метрики. Формулировка вида «WFL, включающая коммунальные площади» устранена из всех выдач и запрещена автоматической проверкой — сама эта строка её не цитирует, иначе документ нарушал бы правило, которое вводит.

**CALC-010 — выведенная площадь.** Если `WFL` получена как `BGF × k`, `AreaValue.derivation` хранит `inputValueIds` (точный `AreaValue` источника), `formulaId` и `formulaVersion`, а UI показывает все три компонента. Инвариант: `вход × коэффициент == точное выведенное значение` до отображаемого округления; отсутствие ссылки на вход или расхождение валит тест. Именно это ловит дефект «правило `WFL = BGF × 0,75`, но видимые BGF такого результата не дают».

**Сравнимость — свойство пары, а не метрики.**

```ts
RateUnitDescriptor {
  numeratorCurrency: ISO4217Currency; taxBasis: "net" | "gross";
  denominatorKind: "area" | "unitCount"; denominatorUnit: Unit;
  areaType?: AreaType;                    // обязателен ровно для area-знаменателя
  standardRef?: RulesetSnapshotRef; scopeRef: ScopeRef;
}

RateComparisonResult {
  id: RateComparisonResultId;
  subjectRateMetricId: RateMetricId;
  target: { kind: "rateMetric"; rateMetricId: RateMetricId }
        | { kind: "benchmark"; benchmarkSnapshotRef: BenchmarkSnapshotRef; benchmarkRateId: BenchmarkRateId };
  status: "comparable" | "notComparable";
  reasonCode?: NonComparabilityReason;
  normalizedRateUnit?: RateUnitDescriptor;
  normalizedSubjectRate?: Decimal; normalizedTargetRate?: Decimal;
  absoluteDelta?: Decimal;          // subject − target, в normalizedRateUnit
  relativeDeltaPercent?: Decimal;   // ((s − t) / |t|) × 100; отсутствует при t == 0
  fxSnapshotRef?: FxRateSnapshotRef;
  normalizationSnapshotRefs: ComparisonNormalizationSnapshotRef[];
  comparedAt: ISODateTime; comparisonContextHash: string;
}
```

`notComparable` требует `reasonCode` и запрещает нормализованные значения и дельты. `comparable` запрещает `reasonCode` и требует все четыре числовых поля, причём `absoluteDelta = normalizedSubjectRate − normalizedTargetRate`. `relativeDeltaPercent` — относительный процент, **никогда не процентный пункт**; при нулевом целевом значении он отсутствует, а не равен нулю. `fxSnapshotRef` обязателен ровно тогда, когда валюты различаются. Отсутствие требуемого доказательства нормализации делает результат `notComparable` — тихая конвертация запрещена. Валюта берётся из `Project.projectCurrency`, а не из локали интерфейса; налоговая база — из `MoneyValue.taxBasis`, а не из текста подписи. `areaType` и `standardRef` в `RateUnitDescriptor` обязательны ровно для area-знаменателя и отсутствуют у знаменателя-количества.

**Что покрывает `comparisonContextHash` — перечислением, а не «контекстом сравнения».** Хеш, состав которого не назван, не доказывает ничего: любое расхождение можно объявить «другим контекстом». Покрываются девять составляющих:

1. точные значения субъекта и цели (сами ставки, а не их ID);
2. `normalizedRateUnit` целиком — включая `denominatorKind`, `denominatorUnit`, `areaType` и `standardRef`;
3. `scopeRef` субъекта и цели;
4. нормативы (`standardRef`) обеих сторон;
5. налоговая база обеих сторон;
6. валюта обеих сторон;
7. `fxSnapshotRef`, если он требуется;
8. **каждый** снапшот нормализации из `normalizationSnapshotRefs`, в объявленном порядке;
9. снапшоты правил и бенчмарка, участвовавшие в получении обеих величин.

Совпадение хешей означает, что два показанных сравнения обязаны давать одну дельту; расхождение обязано быть видимым в интерфейсе, а не объяснённым словами.

### 5.4. Scope, опции и ценовые сводки

Самый большой раздел: здесь живут **SCOPE-001**, **CALC-006**, **CALC-011**, **CALC-013** и правило R-18.

```ts
type CoverageState = "included" | "excluded" | "onRequest" | "unknown" | "notApplicable";

ScopeUniverseItemRef { scopeItemId: ScopeItemId; appliesTo: EntityRef }

ScopeUniverseSnapshot {
  id: ScopeUniverseSnapshotId; projectId: ProjectId;
  catalogVersion: string; itemRefs: ScopeUniverseItemRef[]; snapshotHash: string;
}

CoverageDecisionEvent {
  id: CoverageDecisionEventId;
  scopeItemId: ScopeItemId; appliesTo: EntityRef; coverage: CoverageState;
  actorId: UserId; decidedAt: ISODateTime; sourceRef: SourceReference; reason: string;
}

CommittedScopeSelection {
  scopeItemId: ScopeItemId; appliesTo: EntityRef; coverage: CoverageState;
  coverageDecisionEventId: CoverageDecisionEventId; sourceValueId?: ValueId;
}

ProposedScopeSelection {
  scopeItemId: ScopeItemId; appliesTo: EntityRef;
  proposedCoverage: CoverageState;      // цель, а не решение: события ещё нет
  sourceValueId?: ValueId;
  proposalReason?: string;              // обязателен ровно у изменённых записей
}

DeclaredPricingScopeSnapshot {
  id: ScopeId; calculationRunId: CalculationRunId;
  scopeUniverseSnapshotId: ScopeUniverseSnapshotId;
  includedItemRefs: ScopeUniverseItemRef[];
  displayNameKey: LocalizationKey; snapshotHash: string;
}
```

**Почему предлагаемый выбор — отдельный тип от закоммиченного.** `CommittedScopeSelection` обязан ссылаться на `CoverageDecisionEvent`: решение о покрытии без актора, времени, источника и причины не существует. У `ProposedScopeSelection` события нет и быть не может — черновик ещё ничего не решил, и выдать намерение за решение значило бы задним числом сфабриковать запись журнала. Событие создаётся только при коммите, и только для тех записей, чьё целевое покрытие или источник отличаются от базы; остальные переиспользуют ссылки базы (это и есть механика §2, сохраняющая выгоды M-2). Поэтому и `proposalReason` **обязателен ровно тогда, когда целевое покрытие или источник отличаются от базовой версии, и отсутствует у наследованных неизменённых записей**. Вторая половина правила не менее важна первой: если требовать причину у каждой из сотен записей полного целевого множества, поле мгновенно заполнится словом «unverändert», и «причина» перестанет отличать изменённое от унаследованного — то есть перестанет работать ровно там, где нужна.

`DeclaredPricingScopeSnapshot.includedItemRefs` **точно равны** множеству `included`-выборов субъекта или прогона — не подмножеству, не «включает основные позиции». Обе стороны обязаны ссылаться на один и тот же `ScopeUniverseSnapshot`, а `PricingSummary.declaredPricingScopeId` — именно на этот снапшот. Строгое равенство существует потому, что подпись итога называет Declared Pricing Scope: объём, названный в подписи, обязан быть тем же объёмом, по которому сложена сумма, иначе клиент читает верное число под неверным обещанием.

**SCOPE-001 — отсутствие бенчмарка не равно «по запросу».** Пять состояний покрытия различают три разные вещи, которые прежняя модель схлопывала в одну:

| Ситуация | Состояние | Почему |
|---|---|---|
| Мы не знаем, входит ли это в объём | `unknown` | пробел в данных |
| Входит, но цены нет | `included` + попадает в `unpricedIncludedItemRefs` | пробел в оценке |
| Явно решено: считаем отдельно по запросу | `onRequest` | коммерческое решение |

`onRequest` устанавливается **только** явным `CoverageDecisionEvent` с актором, временем, источником и причиной. Автоматическое отображение «нет базы для расчёта → auf Anfrage» запрещено: удаление бенчмарка не меняет покрытие. Правило проекта 16 («строка без расчётной базы показывает «auf Anfrage», никогда не 0 €») сохраняет силу как **запрет показывать ноль**, но перестаёт быть разрешением подставлять `onRequest`: строка без базы показывает `Preis nicht ermittelt` и переводит сводку в промежуточный итог.

**R-18, последнее предложение — внешняя `Preisangabe` для `onRequest`.** Позиция «по запросу» рано или поздно получает цену от субподрядчика. Норматив требует, чтобы эта цена жила **отдельным слоем** и не попадала в итог сама: у неё другой источник, другой срок действия и другой владелец решения.

```ts
QuoteRecord {
  id: QuoteRecordId; projectId: ProjectId;
  scopeItemId: ScopeItemId; appliesTo: EntityRef;
  quotedMoneyValueId: MoneyValueId;
  capturedAt: ISODateTime;
  validUntil?: ISODateTime;
}

QuoteWithdrawalEvent {
  id: QuoteWithdrawalEventId; quoteRecordId: QuoteRecordId;
  withdrawnAt: ISODateTime; reason: string; actorId: UserId;
}

QuoteSelectionEvent {
  id: QuoteSelectionEventId; projectId: ProjectId;
  scopeItemId: ScopeItemId; appliesTo: EntityRef;
  sequenceNumber: number;                 // атомарный, уникален в тройке ниже
  decision: "select" | "clear";
  quoteRecordId?: QuoteRecordId;          // обязателен при select, запрещён при clear
  actorId: UserId; occurredAt: ISODateTime;
}

QuoteEvaluation {
  quoteRecordId: QuoteRecordId;
  evaluatedAt: ISODateTime;               // точная метка времени рендера или preflight
  status: "valid" | "expired" | "withdrawn";
  withdrawalEventId?: QuoteWithdrawalEventId;
}
```

**Текущую котировку выбирает событие с наибольшим `sequenceNumber`** в тройке `(projectId, scopeItemId, appliesTo)`, а не самая свежая или самая дешёвая запись. `select` требует `QuoteRecord` с той же тройкой и `capturedAt ≤ occurredAt`; `clear` запрещает `quoteRecordId`. Отсюда ровно ноль или одна текущая котировка на позицию, а остальные записи остаются альтернативами и историей — их не удаляют, потому что вопрос «почему выбрали эту» задаётся через полгода.

`QuoteRecord` **неизменяем**. Отзыв не правит запись, а добавляет не более одного `QuoteWithdrawalEvent` с непустой причиной и `withdrawnAt ≥ capturedAt`; отозванная котировка в v0.5 не реактивируется — новая цена от того же субподрядчика есть новый `QuoteRecord`. Причина строгости бытовая: «цену отозвали» — это разговор, который надо уметь предъявить, а перезаписанное поле его не хранит.

`QuoteEvaluation` **выводится на точную метку времени рендера или preflight**, а не хранится статусом на записи: «действительна» — свойство момента, и артефакт, собранный в конкретную секунду, обязан зафиксировать состояние именно этой секунды. Порядок вывода строгий: сначала `withdrawn`, если существует событие отзыва с `withdrawnAt ≤ evaluatedAt` (тогда `withdrawalEventId` обязателен), затем `expired`, если задан `validUntil ≤ evaluatedAt`, иначе `valid`. У `valid` и `expired` поле `withdrawalEventId` отсутствует. Уже истёкшую котировку можно завести для истории — она сразу оценится как `expired`, и это не порча данных, а нормальный случай.

Четыре подписи и четыре действия, и других нет:

| Состояние | Подпись | Действие |
|---|---|---|
| текущей котировки нет | `Auf Anfrage · nicht enthalten` | `Kosten anfragen` |
| текущая действительна | `Preisangabe erfasst · nicht enthalten` | `Preisangabe prüfen` |
| текущая истекла | `Preisangabe abgelaufen · nicht enthalten` | `Neu anfragen` |
| текущая отозвана | `Preisangabe zurückgezogen · nicht enthalten` | `Neu anfragen` |

Во всех четырёх подписях стоит `nicht enthalten`, и это не дублирование: **деньги котировки входят в итог только после явного решения о покрытии `included` и нового завершённого authoritative-прогона**. Ни заведение котировки, ни её выбор, ни её действительность итог не меняют. Иначе достаточно было бы вписать цену субподрядчика, чтобы сумма в клиентской выдаче выросла без единого решения человека и без пересчёта — а сверка драйверов при этом перестала бы сходиться.

**R-18 / CALC-006 — как называется итог.**

```ts
PricingSummary {
  calculationRunId: CalculationRunId; declaredPricingScopeId: ScopeId;
  includedCostLineIds: CostLineId[];
  pricedIncludedItemRefs:   ScopeUniverseItemRef[];
  unpricedIncludedItemRefs: ScopeUniverseItemRef[];
  excludedItemRefs:         ScopeUniverseItemRef[];
  onRequestItemRefs:        ScopeUniverseItemRef[];
  notApplicableItemRefs:    ScopeUniverseItemRef[];
  unknownItemRefs:          ScopeUniverseItemRef[];
  exactPricedMoneyValueId: MoneyValueId;
  completeness: "complete" | "incomplete";   // выводится, никогда не задаётся вручную
}
```

`completeness` равна `complete` ровно тогда, когда `unknownItemRefs` и `unpricedIncludedItemRefs` пусты **и** ни одна открытая существенная финансовая или объёмная проблема валидации не затрагивает прогон. Отсюда четыре подписи, и других нет:

| Прогон | Полнота | Подпись |
|---|---|---|
| authoritative | complete | `Gesamt netto · <Declared Pricing Scope>` |
| preview | complete | `Vorschau · Gesamt netto · <Declared Pricing Scope>` |
| authoritative | incomplete | `Zwischensumme der kalkulierten Positionen` |
| preview | incomplete | `Vorschau · Zwischensumme der kalkulierten Positionen` |

**Итог без названного Declared Pricing Scope запрещён.** В синтетической фикстуре покрытие KG 500 равно `unknown`, поэтому весь набор примеров показывает `Zwischensumme der kalkulierten Positionen` — это сделано намеренно: фикстура обязана воспроизводить блокирующее правило, а не обходить его.

Шесть массивов покрытия попарно не пересекаются, и их объединение равно точному Scope Universe прогона. `excluded`, `onRequest` и `notApplicable` всегда показываются отдельным блоком покрытия; `onRequest` не имеет вклада в стоимость и **исключён из знаменателя процентов** — иначе доля группы затрат считалась бы от суммы, в которую эта группа не входит.

**Стоимостные строки и вклады.**

```ts
CostLine {
  id: CostLineId; calculationRunId: CalculationRunId; appliesTo: EntityRef;
  costGroupRef: CostGroupRef; contributionIds: CostContributionId[];
  exactMoneyValueId: MoneyValueId;
}

CostContribution {
  id: CostContributionId; calculationRunId: CalculationRunId; costLineId: CostLineId;
  coveredScopeItemRefs: ScopeUniverseItemRef[];
  source: { kind: "base";       scopeItemId: ScopeItemId }
        | { kind: "option";     optionId: OptionId; appliesTo: EntityRef }
        | { kind: "adjustment"; ruleId: RuleId };
  exactMoneyValueId: MoneyValueId;
  allocationRelationId?: CostAllocationRelationId;
}
```

Каждый `pricedIncludedItemRef` покрыт хотя бы одним текущим вкладом; каждый `unpricedIncludedItemRef` — ни одним. **Точный ноль допустим только как явное нулевое денежное значение**; отсутствующая цена никогда не выводится как ноль. `exactPricedMoneyValueId` равен точной Decimal-сумме денежных значений строк **до отображаемого округления**; ни один вклад вне Declared Pricing Scope в эту сумму не входит. У каждого `CostContribution` массив `coveredScopeItemRefs` непуст и уникален, и каждая перечисленная позиция имеет покрытие `included` в том же Declared Pricing Scope.

**Все денежные значения, входящие в один итог, используют валюту проекта и `taxBasis = net`.** Формулировка «делят валюту и налоговую базу» слабее и пропускает целый класс дефекта: две строки могут добросовестно делить между собой brutto и при этом складываться под подписью `Gesamt netto · <Declared Pricing Scope>`, где слово `netto` уже произнесено. Требование поэтому абсолютное, а не относительное: валюта — `Project.projectCurrency`, налоговая база — `net`, и обе величины берутся из `MoneyValue`, а не из подписи. Значение в чужой валюте или в brutto попадает в сумму **только** через явное версионированное преобразование, чьи входы и снапшоты курса и налоговой ставки остаются в происхождении — тогда «откуда это число» отвечается и через год.

**CALC-013 — запрет двойного учёта.** По умолчанию множества Scope Item базы и опций **не пересекаются**. Пересечение допустимо только как документированное разбиение одной суммы:

```ts
type CostAllocationRelation =
  | { id: CostAllocationRelationId; sourceMoneyValueId: MoneyValueId;
      method: "exactAmount"; contributionIds: CostContributionId[] }
  | { id: CostAllocationRelationId; sourceMoneyValueId: MoneyValueId;
      method: "percentage";  contributionIds: CostContributionId[];
      exactShares: Decimal[];                       // тот же порядок; точная сумма == 1
      allocationRuleRef: AllocationRuleSnapshotRef } // детерминированно распределяет остаток
```

Любое другое пересечение запрещено и **блокирует расчёт до разрешения**. Это ответ на ситуацию, где `Untergeschoss inkl. Tiefgarage` стоит в драйверах затрат, а `UG-Ausbau` и `Tiefgaragen-Zuschlag` одновременно предлагаются опциями: без явного разбиения нельзя доказать, что работы не посчитаны дважды. UI обязан перечислить, какие работы по подземному этажу уже включены и что именно добавляет каждая опция.

**Опция: определение, выбор, оценка — три разные записи.** Каталог опций фиксируется снапшотом (`optionCatalogSnapshotRef` в §5.1), выбор принадлежит субъекту, а требуемость, доступность и цена — **выходы расчёта**, а не редактируемые поля. Смешение выбора и оценки в одной записи — это тот способ, которым интерфейс начинает показывать «недоступно», но при этом считать деньги.

```ts
OptionDefinition {
  id: OptionId;
  appliesToKinds: EntityRef["kind"][];      // на каком уровне опция вообще применима
  dependencyOptionIds: OptionId[];
  incompatibleOptionIds: OptionId[];
  impactRuleIds: RuleId[];
  priceModelRef?: PriceModelRef;
}

OptionSelection {
  optionId: OptionId; appliesTo: EntityRef;
  selected: boolean;
  quantity?: Decimal;                       // отсутствует при selected = false
}

OptionEvaluation {
  calculationRunId: CalculationRunId;
  optionId: OptionId; appliesTo: EntityRef;
  requirementStatus: "optional" | "mandatory";
  availabilityStatus: "available" | "unavailable" | "incompatible";
  pricing: OptionPricingEvaluation;
  validationIssueIds: ValidationIssueId[];  // §5.11
}
```

`VariantVersion.optionSelections` и предлагаемые множества черновика и предложения — **полные целевые множества**: на каждую пару «`OptionDefinition` × применимый `EntityRef`» из закреплённого снапшота каталога существует ровно один `OptionSelection`, и ни один выбор не ссылается на опцию вне снапшота. Инварианты графа опций проверяются до оценки, потому что недействительный граф делает любую цену недоказуемой:

- **граф зависимостей ацикличен** — цикл «A требует B, B требует A» превращает выбор в неразрешимый, и любая реализация начнёт разрешать его порядком обхода, то есть случайно;
- **несовместимость симметрична** — «A несовместима с B» без обратной записи означает, что запрет зависит от того, какую опцию нажали первой;
- **одна и та же пара опций не может быть одновременно зависимостью и несовместимостью** — это противоречие, а не сложное правило; недействительный граф блокирует оценку;
- `selected = false` → **`quantity` отсутствует**; выбранная небинарная опция → **`quantity > 0`**. Количество у невыбранной опции — это забытое значение, которое всплывёт при повторном выборе; нулевое количество у выбранной означает «выбрал ничего»;
- выбранная опция с невыбранной зависимостью создаёт `dependencyMissing`, обязательная невыбранная — `requiredOptionMissing`; **ни в одном из двух случаев выбор не меняется за пользователя молча**;
- `unavailable` или `incompatible` при `selected = true` — **блокер**, а не тихое отбрасывание выбора: пользователь обязан узнать, что его решение не прошло, иначе он увидит цену без опции, которую считал выбранной.

**CALC-011 — когда опция вправе называться «Im Angebot».**

```ts
type OptionPricingEvaluation =
  | { status: "unpriced";          costContributionIds: [] }
  | { status: "pricedNotIncluded"; priceType: "fixed" | "estimate" | "allowance";
      displayPriceValueId: MoneyValueId; costContributionIds: [] }
  | { status: "includedInBase";    priceType: "includedNoSurcharge";
      incrementalPriceDeltaValueId: MoneyValueId;   // точный ноль
      includedScopeItemRefs: ScopeUniverseItemRef[];
      costContributionIds: CostContributionId[] }
  | { status: "includedAsSeparateContribution"; priceType: "fixed" | "estimate" | "allowance";
      sourcePriceValueId?: MoneyValueId; costContributionIds: CostContributionId[] };
```

Состояние, на которое ссылается это правило, — не строка и не флаг, а типизированный союз, где **субъект и статус расчёта связаны жёстко**:

```ts
type OptionUiState =
  | { subject: { kind: "configurationDraftRevision";
                 draftId: ConfigurationDraftId; revision: number; draftContentHash: string };
      optionId: OptionId; appliesTo: EntityRef;
      calculationStatus: "dirty" }
  | { subject: { kind: "proposal";
                 proposalId: ProposalId; calculationInputHash: string };
      optionId: OptionId; appliesTo: EntityRef;
      calculationStatus: "previewPending" | "previewReady" | "error" }
  | { subject: { kind: "variantVersion";
                 variantVersionId: VariantVersionId; calculationInputHash: string };
      optionId: OptionId; appliesTo: EntityRef;
      calculationStatus: "authoritativePending" | "authoritativeReady" | "error" };
```

Три субъекта и шесть значений `calculationStatus` — `dirty`, `previewPending`, `previewReady`, `authoritativePending`, `authoritativeReady`, `error` — распределены по субъектам без пересечений, и распределение и есть содержание правила:

| Субъект | Допустимые статусы | Почему только эти |
|---|---|---|
| `configurationDraftRevision` | `dirty` | у черновика ещё нет прогона: любое «готово» здесь было бы ложью о существовании расчёта |
| `proposal` | `previewPending` · `previewReady` · `error` | предпросмотр считает замороженное предложение, но ничего не коммитит |
| `variantVersion` | `authoritativePending` · `authoritativeReady` · `error` | authoritative-статус имеет право существовать только у неизменяемой версии |

`dirty` невозможен у предложения и версии, preview-статусы невозможны у черновика и версии, authoritative-статусы невозможны у черновика и предложения. `authoritativeReady` дополнительно требует совпадающего завершённого **актуального** authoritative-прогона — не просто существующего, а того, чей `calculationInputHash` равен версии.

Подпись `Im Angebot` разрешена **только** при совпадении четырёх условий: опция выбрана в версии варианта, `OptionUiState.calculationStatus = authoritativeReady`, оценка — `includedAsSeparateContribution`, есть связанные вклады в завершённом актуальном authoritative-прогоне. **Только `authoritativeReady` вправе использовать закоммиченные подписи вида `Im Angebot`** — ни `previewReady`, ни `dirty`, ни `authoritativePending`. До этого состояние называется `Ausgewählt · Neuberechnung ausstehend`. Стоимость опции присутствует в итоге и в сверке драйверов **ровно один раз**.

Ещё несколько инвариантов опций, каждый из которых закрывает конкретный способ соврать: выбранная неоценённая опция создаёт существенную финансовую проблему и делает сводку неполной; невыбранная неоценённая допустима и показывает `Preis nicht ermittelt`; `includedInBase` требует точного нулевого приращения, но связанные вклады могут быть положительными, потому что представляют затраты, уже сидящие в базе; нулевое приращение **никогда** не означает «по запросу», «неизвестно» или «затрат нет»; обязательная невыбранная опция создаёт блокирующую проблему и не выбирается за пользователя молча.

**Черновик → предложение → коммит.** Три сущности вместо одной — потому что предпросмотр обязан замораживать то, что показал:

```ts
ConfigurationDraft {
  id: ConfigurationDraftId; projectId: ProjectId;
  currentRevision: number;              // указывает на наибольшую сохранённую ревизию
  createdAt: ISODateTime; createdByUserId: UserId;
}

ConfigurationDraftRevision {
  draftId: ConfigurationDraftId; revision: number;
  baseVariantVersionId: VariantVersionId; baseVariantVersionSnapshotHash: string;
  proposedConfiguration: ProjectConfigurationSnapshot;
  proposedScopeSelections: ProposedScopeSelection[];   // полное целевое множество
  proposedOptionSelections: OptionSelection[];
  draftContentHash: string; createdAt: ISODateTime; actorId: UserId;
}

ConfigurationProposal {
  id: ProposalId;
  sourceDraftId: ConfigurationDraftId;      // из какой ревизии заморожено
  sourceDraftRevision: number;
  sourceDraftContentHash: string;
  baseVariantVersionId: VariantVersionId; baseVariantVersionSnapshotHash: string;
  proposedConfiguration: ProjectConfigurationSnapshot;
  proposedScopeSelections: ProposedScopeSelection[];
  proposedOptionSelections: OptionSelection[];
  calculationInputHash: string;   // семантическая цель; тот же алгоритм, что у VariantVersion
  proposalHash: string;           // вся неизменяемая запись предложения
  createdAt: ISODateTime; actorId: UserId;
}

ProposalCommitEvent {
  id: ProposalCommitEventId; proposalId: ProposalId; proposalHash: string;
  proposalCalculationInputHash: string;
  commitMode: "appendToBaseVariant" | "createNewVariant";
  createdVariantId: VariantId; createdVariantVersionId: VariantVersionId;
  createdVariantVersionCalculationInputHash: string;
  createdVariantVersionSnapshotHash: string;
  committedAt: ISODateTime; actorId: UserId;
}
```

Каждая пара `(draftId, revision)` неизменяема; правка создаёт следующую целочисленную ревизию, а не меняет прежнюю, и `ConfigurationDraft.currentRevision` всегда указывает на наибольшую сохранённую. Черновик существует отдельной записью от своих ревизий именно поэтому: «где я сейчас» — изменяемое состояние, «что я тогда предложил» — нет, и одна запись эти два смысла нести не может. Предпросмотр замораживает текущую ревизию в `ConfigurationProposal` — три поля происхождения (`sourceDraftId`, `sourceDraftRevision`, `sourceDraftContentHash`) обязаны совпасть с той ревизией, а базовая версия и её хеш — с неизменяемой базой. Последующие правки черновика предложение не трогают и требуют нового. На одно предложение существует не более одного события коммита; коммит идемпотентен по паре `(proposalId, proposalHash)`. `appendToBaseVariant` разрешён, только пока база — всё ещё текущая голова ветки; **устаревший редактор коммитит исключительно как `createNewVariant`** — это структурная защита от потери чужой правки при десяти одновременных пользователях.

### 5.5. Роли вариантов

Ответ на **VARIANT-001**. Четыре независимые роли хранятся **один раз на проект**, а не флагами внутри каждого варианта:

```ts
VariantRoleRefs {
  comparisonBaselineVersionId?: VariantVersionId;  // Vergleichsbasis — с чем сравниваем
  currentEditingVariantId: VariantId;              // что редактируем сейчас
  targetOfferVersionId?: VariantVersionId;         // Ziel — что предлагаем
  recommendedVersionId?: VariantVersionId;         // что рекомендуем
}
```

Базис, цель и рекомендация закрепляют **точные ID версий**, включая архивные — сравнение с отправленным офером не ломается от того, что вариант ушёл в архив. Текущее редактирование указывает на `active`-вариант и разрешается в его голову. Одна версия может быть одновременно базисом и целью; UI показывает **два независимых текстовых бейджа**. Булево `selected` и одна звезда для четырёх ролей запрещены: звезда, означающая и «базис», и «цель», — это ровно тот дефект, который аудит зафиксировал наблюдением.

> Правило v0.1 «независимый флаг `ziel` (★, ровно один на проект)» уточнено: флаг остаётся ровно один, но он один **из четырёх** ролей, и подчёркивание больше не используется — оно неотличимо от активной вкладки.

### 5.6. Влияние вопросов

Ответ на **CALC-001**. Неопределённость, риск, стоимость и срок — четыре разные величины с разной арифметикой; складывать их в одну строку нельзя.

```ts
type ImpactAffectedRef =
  | { kind: "value";           valueId: ValueId }
  | { kind: "scopeItem";       scopeItemId: ScopeItemId }
  | { kind: "validationIssue"; validationIssueId: ValidationIssueId }
  | { kind: "scheduleMetric";  metricKey: string }
  | { kind: "outputProfile";   outputProfile: OutputProfile };

type UncertaintyImpact =
  | { kind: "relativeSymmetric"; targetValueId: ValueId;
      fromMarginPercent: Decimal; toMarginPercent: Decimal;
      marginDeltaPp: Decimal }        // to − from; отрицательное сужает
  | { kind: "relativeAsymmetric"; targetValueId: ValueId;
      fromRange: AsymmetricRange; toRange: AsymmetricRange;   // обе relativePercent
      lowerMarginDeltaPp: Decimal; upperMarginDeltaPp: Decimal }
  | { kind: "absolute"; targetValueId: ValueId;
      fromRange: AsymmetricRange; toRange: AsymmetricRange;   // обе absolute
      lowerBoundDelta: Decimal; upperBoundDelta: Decimal; unit: Unit };

RiskImpact {
  targetRiskId: RiskRecordId;
  category: "cost" | "schedule" | "compliance" | "scope" | "dataQuality";
  change: { kind: "level"; riskScaleId: RiskScaleId; fromLevelId: RiskLevelId; toLevelId: RiskLevelId }
        | { kind: "probability"; fromProbabilityPercent: Decimal;
            toProbabilityPercent: Decimal; probabilityDeltaPp: Decimal };
}

CostRangeImpact {
  fromPricingScopeId: ScopeId; toPricingScopeId: ScopeId;   // объём обоих концов назван
  fromRange: MoneyRange; toRange: MoneyRange;
  boundDelta: MoneyBoundDelta;      // граница к границе, а не размах к размаху
}

ScheduleRangeImpact {
  metricKey: string;                // одна названная метрика на оба конца
  fromRange: DurationRange; toRange: DurationRange;
  boundDelta: DurationBoundDelta;
}

QuestionImpact {
  baselineCalculationRunId: CalculationRunId;
  affectedRefs: ImpactAffectedRef[];
  uncertaintyImpacts: UncertaintyImpact[];
  riskImpacts: RiskImpact[];
  costRangeImpacts: CostRangeImpact[];
  scheduleRangeImpacts: ScheduleRangeImpact[];
  dependencyQuestionIds: QuestionId[];
  aggregationGroupId: ImpactAggregationGroupId;
  aggregation: "additive" | "correlated" | "exclusive" | "modelled";
  aggregationRuleRef: ImpactAggregationRuleSnapshotRef;
  modelVersion: string;
}
```

**Пять видов затронутого — один типизированный союз.** `ImpactAffectedRef` существует потому, что вопрос задевает разнородные вещи: конкретное значение, позицию объёма, открытую проблему валидации, метрику срока и целый профиль выдачи. Список строк здесь недостаточен — по строке нельзя перейти к объекту и нельзя проверить, что объект существует. Требования к самому массиву:

- `affectedRefs` **непусто**: влияние, не затрагивающее ничего, не является влиянием, и такая запись означает потерянную связь, а не безобидный ноль;
- массив **равен дедуплицированному объединению всех явных целей влияния** плюс отдельно затронутых ссылок на объём, валидацию и профили выдачи. Ни лишней устаревшей ссылки, ни влияния, чья цель не перечислена: первое рисует последствия, которых нет, второе скрывает существующие.

**Стоимостное и срочное влияние — границы, а не размахи.** `CostRangeImpact` и `ScheduleRangeImpact` хранят оба конца целиком и дельту **по границам раздельно** (`boundDelta` равна `to − from` для нижней и для верхней границы отдельно). Разность размахов теряет направление: интервал, сдвинувшийся вверх без изменения ширины, дал бы дельту размаха ноль. Оба конца `CostRangeImpact` называют свой `ScopeId`, и они вправе различаться только когда вопрос сам меняет объём; from, to и дельта делят валюту и налоговую базу. `ScheduleRangeImpact` использует одну и ту же `metricKey`, одну базу длительности и один календарь во всех трёх полях.

**Сужение неопределённости выражается в процентных пунктах** (`Pp`), а не в процентах: путь от `±22 %` к `±13 %` — это `−9` процентных пунктов, и назвать это «минус 9 %» значит утверждать другое число. `relativeSymmetric` означает `±margin`, а не полный размах, и требует неотрицательных margin-значений. У `absolute` **единица равна единице целевой `ValueRecord`**, а процентно-пунктового поля в этом варианте не существует вовсе. Уровень риска сравнивается по **версионированной упорядоченной шкале**, а не вычитанием целых; вероятность риска лежит в `[0,100]` процентов, а `probabilityDeltaPp = toProbabilityPercent − fromProbabilityPercent` — то есть тоже процентный пункт, потому что вычитаются два процента.

**Заголовок считает только правило агрегации.** `baselineCalculationRunId` обязан быть завершённым актуальным authoritative-прогоном — влияние, посчитанное от предпросмотра, сравнивало бы с тем, что ещё не является предложением. `aggregationRuleRef` — единственный источник итогового эффекта; интерфейс никогда не суммирует подписи строк. Три вопроса, каждый «минус 4 процентных пункта», дают минус 12 только если правило говорит `additive`; при `correlated` — другое число, при `exclusive` — эффект одного. Все записи одной группы обязаны разделять `aggregation`, `aggregationRuleRef` и `modelVersion`; смешанные определения делают группу недействительной и блокируют заголовок. Граф зависимостей между вопросами ацикличен.

### 5.7. Модель документов

Ответ на **VERSION-002**: активная версия документа выбирается событием, а не датой в штампе чертежа.

```ts
DocumentRecord {
  id: DocumentRecordId; projectId: ProjectId;
  purpose: DocumentPurpose;
  humanTitle: string;
  activeVersionId?: DocumentVersionId;   // материализованная проекция событий, не решение
  versionIds: DocumentVersionId[];
  activationEvents: DocumentActivationEvent[];
}

DocumentVersion {
  id: DocumentVersionId; documentRecordId: DocumentRecordId;
  rawFilename: string;
  fileHash: string;                      // содержимое файла, а не имя и не размер
  pageCount?: number; fileSize: number;
  uploadedAt: ISODateTime; uploaderId: UserId;
  planDate?: ISODate;                    // дата штампа — доказательство, не решение
  parseStatus: "queued" | "running" | "partial" | "ready" | "failed" | "cancelled";
  versionEvidence: VersionEvidence[];
  supersedesId?: DocumentVersionId;      // заявленное отношение замены, тоже доказательство
}

type VersionEvidence =
  | { kind: "planDate";       planDate: ISODate; extractedFrom: SourceReference }
  | { kind: "titleMatch";     matchedTitle: string; similarity: Decimal }   // [0,1]
  | { kind: "revisionMatch";  revisionLabel: string; matchedVersionId: DocumentVersionId }
  | { kind: "hashRelation";   relation: "identicalContent" | "differentContent";
                              comparedVersionId: DocumentVersionId }
  | { kind: "pageCountDelta"; fromPageCount: number; toPageCount: number };

type DocumentActivationEvent =
  | { id: DocumentActivationEventId; documentRecordId: DocumentRecordId;
      sequenceNumber: number; decision: "activate";
      previousActiveVersionId?: DocumentVersionId; activatedVersionId: DocumentVersionId;
      reason: string; actorId: UserId; occurredAt: ISODateTime }
  | { id: DocumentActivationEventId; documentRecordId: DocumentRecordId;
      sequenceNumber: number; decision: "deactivate";
      deactivatedVersionId: DocumentVersionId;
      reason: string; actorId: UserId; occurredAt: ISODateTime }
  | { id: DocumentActivationEventId; documentRecordId: DocumentRecordId;
      sequenceNumber: number; decision: "rejectCandidate";
      rejectedVersionId: DocumentVersionId;
      reason: string; actorId: UserId; occurredAt: ISODateTime };

DocumentVersionState {
  documentVersionId: DocumentVersionId;
  lifecycleStatus: "candidate" | "active" | "superseded" | "inactive" | "rejected";
  derivedFromActivationEventId?: DocumentActivationEventId;
}
```

**`versionEvidence` — то, чего требует VERSION-002 буквально: структурированное доказательство.** Дата плана, совпадение названия и ревизии, отношение хешей — это пять разных наблюдений с разной силой, и склеивать их в текст `«похоже, новее»` запрещено: по тексту нельзя ни перепроверить вывод, ни показать пользователю, какое именно наблюдение его породило. `planDate`, `fileHash` и `supersedesId` живут полями по той же причине — иначе «система решила по дате чертежа» невозможно ни доказать, ни опровергнуть.

События append-only и упорядочены атомарным `sequenceNumber`, уникальным внутри одного `DocumentRecord`. **Предусловия решений и отображение «событие → жизненный цикл» точные:**

| Решение | Предусловие | Результат |
|---|---|---|
| `activate` при уже активной версии | `previousActiveVersionId` **обязателен** и равен точной текущей активной версии | активируемая становится `active`, прежняя — `superseded` |
| `activate` при отсутствии активной | `previousActiveVersionId` **отсутствует** | активируемая становится `active` |
| `deactivate` | `deactivatedVersionId` равен точной текущей активной версии | она становится `inactive` |
| `rejectCandidate` | `rejectedVersionId` — неактивная версия в состоянии `candidate` | она становится `rejected`; **в v0.5 это терминально** |

Требование «равен точной текущей активной» существует, чтобы событие нельзя было применить к устаревшему представлению: два человека, одновременно активирующие разные версии, дают два события, и второе обязано быть отклонено, а не молча перезаписать первое. Версия без события жизненного цикла остаётся `candidate` — состояние по умолчанию, а не пустота. **Ровно ноль или одна версия активна**, и только она равна `activeVersionId`.

`DocumentRecord.activeVersionId` — **материализованная проекция**: она обязана совпадать с состоянием, выведенным из последовательности событий, и расхождение — блокер целостности данных, а не мелочь синхронизации. Неудачный или отменённый разбор активировать нельзя. **Частичный разбор остаётся существенной проблемой**, пока его `ValidationIssue` не закрыт доказательством, называющим каждую принятую и каждую исключённую страницу; `parseStatus` остаётся `partial`, и ограничение видно в происхождении значений.

Дата в штампе чертежа — **доказательство, а не решение**: при конфликте версия не активируется автоматически, показывается структурированное доказательство, дифф-предпросмотр и явное подтверждение. `versionEvidence` и `supersedesId` **никогда не активируют версию без `DocumentActivationEvent`**. Исключённая версия остаётся прослеживаемой и не исчезает из расчётной истории.

### 5.8. Модель сроков

Ответ на **CALC-005**: одна модель, один epoch, точные даты.

```ts
ScheduleDurationMetric {
  id: ScheduleDurationMetricId;
  metricKey: string;              // project.planning | project.total | building:<BuildingId>.execution
  kind: "planning" | "buildingExecution" | "projectTotal";
  entityRef: EntityRef;
  startMilestoneId: ScheduleMilestoneId; endMilestoneId: ScheduleMilestoneId;
  durationBasis: "calendarDay" | "workingDay"; calendarId?: CalendarId;
  durationPresentationPolicy: "wholeCalendarMonthsElseDays" | "halfMonthRounded";
  labelKey: LocalizationKey;
}

ScheduleDurationUncertainty {
  metricId: ScheduleDurationMetricId;    // не более одной записи на метрику
  range: DurationRange;                  // та же база и тот же календарь, что у метрики
  methodRef: UncertaintyMethodSnapshotRef;   // чем получен разброс
}

ScheduleModel {
  calculationRunId: CalculationRunId;
  epoch: { kind: "fixedDate" | "planningStart" | "OKBP"; date: ISODate };
  timezone: IanaTimezone;
  displayScale: "month";          // только подписи диаграммы, никогда не единица длительности
  endpointConvention: "halfOpen"; // интервал [startDate, endDate)
  phases: SchedulePhase[]; dependencies: ScheduleDependency[];
  buffers: ScheduleBuffer[]; milestones: ScheduleMilestone[];
  durationMetrics: ScheduleDurationMetric[];
  durationUncertainties: ScheduleDurationUncertainty[];
  rulesetVersion: string;
}
```

Каждая фаза хранит точные `startDate` и `endDate`. Каждая метрика считает свою длительность по собственной базе; рабочие дни считаются по названному снапшоту календаря. Тик `0` диаграммы равен `epoch.date`, тик `n` — плюс ровно `n` календарных месяцев. **Epoch — только начало оси**: он не является началом длительности, если сам не назначен стартовой вехой. Заголовок, строки зданий, диаграмма и дата завершения берут одни и те же вехи, даты, соглашение о границах и базу — расхождение «в таблице 6 месяцев, на диаграмме с 6-го по 13-й, в итоге 12, веха на 13-м» становится структурно невозможным.

Ключи метрик канонические и стабильны между сравнимыми прогонами. На прогон существует не более одной метрики планирования и не более одной итоговой; у каждого показываемого здания — не более одной метрики исполнения. Bauzeit комплекса — `max(start + dauer)`, а не сумма (правило проекта 39); в терминах модели это метрика `project.total` с собственными вехами, а не арифметика над строками зданий.

**Привязка метрики к сущности типизирована, а не подразумевается.** `planning` и `projectTotal` требуют `entityRef` уровня Project: срок планирования всего проекта, приписанный одному зданию, немедленно превращается в вопрос «а у второго здания какой». `buildingExecution` требует `entityRef` того самого Building, чей ID стоит в `metricKey` — расхождение между ключом и ссылкой означает строку, подписанную одним домом и считающую другой. Каждая веха, на которую ссылается метрика, **существует в той же `ScheduleModel`**, и начальная веха раньше конечной; ссылка на веху чужой модели — это срок, склеенный из двух разных расчётов.

**Неопределённость срока — не более одной записи на метрику.** Две записи на одну метрику дают два интервала на одно число, и интерфейс выберет тот, который встретил первым. Диапазон использует ту же базу длительности и тот же календарь, что метрика, и неотрицательные целые дни; способ получения назван `methodRef`, потому что «плюс-минус месяц» без метода не проверяется.

> **`durationPresentationPolicy` — зафиксированное отклонение от R-26.** Норматив допускает единственное значение `wholeCalendarMonthsElseDays` и запрещает десятичные месяцы. PO отклонил R-26 **в части отображения**, поэтому добавлено второе значение `halfMonthRounded` — округление до половины месяца по методологии Bauzeit v1.1. Отклонение осознанное и не молчаливое: **`decisions.md` D-17** (записано 05.08 — до этого ссылка на `decisions.md` была ложной, решения там не существовало) и план ремедиации, Batch 0 §D. **Отклонение сужено:** `halfMonthRounded` допустим только там, где день месяца у `startDate` и `endDate` не совпадает; при совпадении обязателен целый `n Monate`, потому что норматив запрещает не месяцы, а десятичный перевод. Первая редакция просила отклонение шире, чем требовала задача. Митигация принята PO: рядом с длительностью всегда стоит абсолютная дата завершения, а `durationBasis` и политика отображения входят в снапшот расчёта. **Отклонена только подпись — требование единой модели, единого epoch, точных дат, соглашения о границах `halfOpen` и базы длительности остаётся в полной силе**, и именно оно закрывает CALC-005. Значение `wholeCalendarMonthsElseDays` сохраняет свою нормативную семантику: оно реализует R-26 и **запрещает** перевод в десятичные месяцы. **CALC-007 отклонением не затронут:** префикс `≈` обязателен и для срока — точная длительность `7,283` месяца при показе `7,5` даёт расхождение, и оно обязано быть видимым.

### 5.9. Точность, округление и устаревание

**CALC-007 — точное значение и `≈`.** Все деньги, площади и ставки хранятся как точный Decimal без отображаемого округления. Округление — свойство показа: `displayPrecision` и `displayRoundingMode` живут в `ValueRecord` и попадают в снапшот прогона, поэтому показ воспроизводим. Если показанное значение отличается от точного:

- интерактивный интерфейс ставит префикс `≈` и держит постоянно доступной расшифровку `Gerundet auf <Schritt>; exakter Rechenwert <Wert>`;
- PDF и письмо ставят пометку `gerundet` **непосредственно у метрики** и повторяют шаг округления и точное значение в связанной обязательной сноске; оба элемента обязательны, одного недостаточно.

Производные величины считаются **от точных значений, никогда от показанных**. Скидка 3 % берётся от точной суммы, а не от округлённого тотала — иначе «точное» значение в расшифровке не совпадает с самим собой. Удельные величины комплекса считаются от сумм, а не как среднее из средних (правило проекта 39).

**CALC-002 — идентичность сценария.** Каждый блок, показывающий неопределённость, стоимость или срок, несёт `scenarioId`, `variantVersionId`, `calculationRunId`, `runPurpose`, `rulesetVersion`, `benchmarkSnapshot`, `engineVersion` и отметку времени в зоне IANA. Две последовательности вида `±19 % → ±14 %` и `±22 % → ±13 %` либо явно принадлежат разным прогонам, либо тест падает. Это же требование делает возможной §9.

**STALE-001 — что делает выдачу устаревшей.** Изменение любого authoritative-входа, версии правил, снапшота бенчмарка или активной версии документа **инвалидирует зависимые прогоны и выдачи**. Устаревший оффер невозможно отправить или показать клиенту без нового прогона. В терминах модели: `ValueContextState.freshnessStatus` переходит в `stale`, состояние опции — в `authoritativePending`, а гейт отправки читает именно эти поля, а не отдельный флаг «актуально», который кто-то должен поддерживать руками.

**CALC-008 — снапшот бенчмарка.**

```ts
BenchmarkSnapshot {
  id: BenchmarkSnapshotId;
  edition: string;                 // издание справочника, например «BKI 2026 Q1»
  priceBasis: { kind: "net" | "gross"; asOfDate: ISODate };
  regionRef: BenchmarkRegionRef;   // регион справочника, не Bundesland проекта
  scopeRef: ScopeRef;              // какие группы затрат покрывает значение
  denominator: RateUnitDescriptor; // знаменатель с типом площади и нормативом
  exclusions: ScopeRef[];          // что справочник заведомо не содержит
  adjustmentOrder: BenchmarkAdjustmentStep[];  // упорядоченный список поправок
  capturedAt: ISODateTime; snapshotHash: string;
}

BenchmarkRate {
  id: BenchmarkRateId; benchmarkSnapshotId: BenchmarkSnapshotId;
  benchmarkProfileId: BenchmarkProfileId;
  median: Decimal; lowerQuartile?: Decimal; upperQuartile?: Decimal;
}
```

Семь полей снапшота — это ровно семь способов получить сравнение яблок с апельсинами, и каждое из них закрывает свой. Порядок поправок хранится списком, а не подразумевается: региональная поправка после нормализации объёма и до неё дают разные числа, и «примерно то же самое» здесь не работает.

Вывод «x % ниже медианы» **невозможен** при несовместимом объёме или выключенной нормализации — вместо него `nicht vergleichbar` с названной причиной. Знаменатель сравнения обязан совпадать со знаменателем сравниваемой ставки: `€/m² BGF oberirdisch` сопоставляется только с бенчмарком, чей `denominator.areaType` тоже `BGF_ABOVE_GROUND`.

> **Пробел фикстуры, зафиксированный явно.** Синтетический снапшот `BM-BKI-2026Q1-SYNTH` объявлен в `synthetic-fixtures.md`, но числовое значение медианы в нём не задано. Пока оно не задано, примеров вида «x % от медианы» в документации не приводится — привести их значило бы выдумать значение там, где его нет (R-25). Закрывается вместе с фикстурой бенчмарка.

**CALC-009 — региональный фактор.** Фактор выключен по умолчанию (D-15). Модель хранит формулу и **перечень затронутых строк до активации**, поэтому предпросмотр воспроизводит эффект построчно и предотвращает двойной учёт. В драйверах затрат фактор присутствует строкой всегда: при выключенном состоянии — с суммой, которую он добавил бы, и пометкой `nicht aktiviert`. Состояние флага входит в снапшот отправленного оффера.

**CALC-003 / CALC-004 — Gebäudeklasse.** Класс здания определяется юрисдикционным набором правил и обязательными параметрами; число этажей — только триггер проверки, а не вывод. Пока обязательные входы или набор правил не подтверждены, интерфейс пишет `Prüfung erforderlich`. Классификация, зависимости опций и драйверы затрат читают **одно authoritative-состояние**: получить подпись `GK 4` при активных драйверах, существующих только для `GK 5`, без явного состояния конфликта невозможно, а спорное значение блокирует клиентскую выдачу (правило R-07).

### 5.10. ImpactSnapshot — одна дельта на один контекст

Ответ на **CALC-012**.

```ts
type ImpactEndpointRef =
  | { kind: "variantVersion"; variantVersionId: VariantVersionId; calculationRunId: CalculationRunId }
  | { kind: "proposal";       proposalId: ProposalId;             calculationRunId: CalculationRunId };

ImpactContributionDelta {
  impactLineKey: string;                       // стабильный ключ строки
  fromContributionIds: CostContributionId[];   // только из прогона «от»
  toContributionIds: CostContributionId[];     // только из прогона «к»
  exactMoneyDeltaValueId: MoneyValueId;        // sum(to) − sum(from)
}

ImpactSnapshot {
  id: ImpactSnapshotId;
  from: { variantVersionId: VariantVersionId; calculationRunId: CalculationRunId };
  to: ImpactEndpointRef;
  fromPricingScopeId: ScopeId; toPricingScopeId: ScopeId;
  contextHash: string;   // хеши концов + входы + правила + бенчмарки + движок + оба scope
  exactMoneyDeltaValueId: MoneyValueId;
  scheduleDelta?: { metricKey: string; delta: DurationDelta };
  affectedScopeItemRefs: ScopeUniverseItemRef[];
  affectedOptionIds: OptionId[];
  contributionDeltas: ImpactContributionDelta[];
}
```

**Полный Impact Context** — это восемь составляющих: конец «от» (версия варианта), конец «к» (версия варианта либо неизменяемое предложение до коммита), снапшот входа, снапшот правил, снапшот бенчмарка, версия движка и оба ID ценового объёма. При совпадении контекста предпросмотр изменения, журнал, сравнение вариантов и выдача обязаны ссылаться на **один `ImpactSnapshotId`** и показывать одну точную дельту. При различающемся контексте интерфейс обязан показать различающиеся ID и подписи контекста — одинаковое по смыслу изменение с двумя разными дельтами и без объяснения запрещено, и расхождение блокирует коммит и клиентскую выдачу.

Дельты строк уникальны по `impactLineKey` и **суммируются в заголовок точно**. Дельта срока называет одну метрику, чья база и календарь совпадают в обеих моделях сроков.

**Когда журнал и сравнение вправе переиспользовать снапшот предпросмотра.** Предпросмотр изменения считает конец «к» на **предложении**, а закоммиченная история — на **версии варианта**. Это разные концы, поэтому переиспользование того же `ImpactSnapshot` разрешено ровно при двух условиях одновременно:

1. `ProposalCommitEvent` фиксирует **тот же** `proposalHash`, что и предложение, на котором считался предпросмотр;
2. `proposalCalculationInputHash == createdVariantVersionCalculationInputHash` — то есть коммит не изменил ни одного входа расчёта.

**Полные хеши предложения и версии при этой проверке не сравниваются**, и это не послабление, а необходимость: `proposalHash` и `snapshotHash` покрывают запись целиком, включая аудит-метаданные, а коммит по построению добавляет ID событий, время и актора. Требовать равенства полных хешей значило бы запретить переиспользование всегда — и тогда одно и то же изменение получало бы в предпросмотре и в журнале два разных `ImpactSnapshotId` при полностью совпадающей арифметике, то есть ровно тот дефект CALC-012, против которого раздел написан. Сравнение по `calculationInputHash` разделяет «изменились числа» и «добавилась запись в журнал» — а это и есть причина, по которой два хеша разведены ещё в §5.1.

### 5.11. Проблемы валидации и профили выдачи

Тип, на который опираются `PricingSummary.completeness` (§5.4), правило R-07 и инварианты 16 и 27, в v0.2 существовал только по названию. Пока `ValidationIssue` — слово, а не запись, «существенная проблема» остаётся оценочным суждением интерфейса, и любой блокер снимается тем, что его перестали показывать.

```ts
type OutputProfile =
  | "internalWorkspace"
  | "clientReadOnly" | "clientLiveConfiguration"
  | "clientPdf" | "clientEmail" | "clientPrint"
  | "internalExport";

ValidationIssue {
  id: ValidationIssueId;
  deduplicationKey: string;        // «то же правило о том же субъекте»
  evaluationContextHash: string;   // «те же входы, что породили проблему»
  supersedesValidationIssueId?: ValidationIssueId;
  createdAt: ISODateTime;
  category:
    | "compliance" | "scope" | "financial" | "schedule" | "dataQuality"
    | "documentVersion" | "locale" | "stale"
    | "authorization" | "security" | "privacy" | "delivery";
  materiality: "warning" | "material";
  subject: ImpactAffectedRef;       // о чём именно проблема
  reasonCode: string;
  remedyActionId: ActionId;         // блокировка обязана предлагать выход
  affectedOutputProfiles: OutputProfile[];
  blockedOutputProfiles: OutputProfile[];
  policyVersion: string;
  statusEvents: ValidationIssueStatusEvent[];   // append-only
}

ValidationIssueStatusEvent {
  id: ValidationIssueStatusEventId;
  validationIssueId: ValidationIssueId;
  sequenceNumber: number;
  action: "resolve" | "reopen";
  evidenceRef: EvidenceRef;         // обязателен: решение без доказательства не решение
  actorId: UserId; occurredAt: ISODateTime;
}
```

**Одна `severity` разложена на две независимые оси.** «Существенная финансовая проблема» — это два разных утверждения: *о чём* она (`category = financial`) и *насколько* она серьёзна (`materiality = material`). Существуют финансовые предупреждения, не блокирующие ничего, и существенные проблемы совсем других категорий — например `privacy` или `delivery`. Одно поле «серьёзность» их схлопывает, и тогда «понизить существенность» становится способом сменить тему проблемы. Обязательный минимум вердикта закрыт так: `id` — `id`, «severity» — пара `category` + `materiality`, «code» — `reasonCode`, «subject» — `subject`, `blockedOutputProfiles` — одноимённое поле, состояние решения — вывод из `statusEvents`.

**Состояние решения выводится, а не хранится флагом.** Нет событий или последнее `reopen` — проблема `open`; последнее `resolve` — `resolved`. Разрешение требует доказательства и **никогда не является визуальным отпущением**: спрятать предупреждение и закрыть проблему — разные операции, и вторая обязана оставить след. Повторная оценка с тем же `deduplicationKey` и тем же `evaluationContextHash` дописывает `reopen` к той же проблеме; при другом `evaluationContextHash` создаётся новая открытая проблема, чей `supersedesValidationIssueId` указывает на предыдущую с тем же ключом дедупликации. История прежней проблемы при этом не переписывается — иначе «сколько раз мы это уже видели» становится неотвечаемым вопросом.

**Материальность — это перечень заблокированных профилей, а не цвет и не тон формулировки.** `warning` имеет пустой `blockedOutputProfiles`; `material` имеет хотя бы один заблокированный профиль, и каждый заблокированный профиль обязан входить и в `affectedOutputProfiles`. Три категории — `compliance`, `scope` и `financial` — при `materiality = material` блокируют **все пять клиентских профилей**: `clientReadOnly`, `clientLiveConfiguration`, `clientPdf`, `clientEmail`, `clientPrint` (R-07). Внутренние профили добавляются только отдельной политикой, а не «на всякий случай».

Категории `financial` и `scope` — это ровно те «существенные финансовые или объёмные проблемы», от которых зависит `completeness` в §5.4: сводка полна только при пустых `unknownItemRefs` и `unpricedIncludedItemRefs` **и** отсутствии открытой существенной проблемы этих двух категорий, затрагивающей прогон. Связь названа здесь, а не описана словами в двух местах, потому что два независимых определения «существенности» — это гарантированное расхождение.

`remedyActionId` обязателен по правилу проекта 12: заблокированный элемент всегда объясняет причину и называет действие. Блокировка без выхода в системе, работающей при клиенте, — это не строгость, а тупик.

---

## 6. Машины состояний

Принцип из S1: **статусов мало, очереди вычисляются**. Статус, который надо поддерживать руками, всегда врёт; вычисленное представление всегда честно. «Heute zu erledigen» — не статус, а функция (близость встречи × неготовность).

### Projekt — 6 состояний, переходы почти все автоматические

```
neu ──analyse gestartet──► in_arbeit ──offer.sent──► versendet ──┬─► gewonnen
 ▲ из HubSpot                                        (событие     ├─► verloren
                                                      meeting/CRM)└─► ruhend
```

`gewonnen/verloren/ruhend` проставляются из CRM-синка или события `meeting.outcome` — единственный ручной ввод. Возврат `versendet → in_arbeit` разрешён (новый раунд по тому же проекту).

### Variante

```
entwurf ──export──► versendet ──► angenommen
   │                    │
   └──► verworfen ◄─────┘        (архив, вычёркивается из сравнения)
```

Роли варианта — не состояния, а ссылки уровня проекта (§5.5). `entwurf` — живое наследование; `versendet` — есть снапшот; правка `versendet`-варианта создаёт новый `entwurf`-клон, отправленное неприкосновенно (M-3).

### Dokument

`hochgeladen → in_analyse → analysiert | fehler` — процесс разбора (`parseStatus`, §5.7, включая `partial`).
Независимо: жизненный цикл версии `candidate | active | superseded | inactive | rejected` — выводится из событий активации, а не проставляется. Система предлагает по доказательствам, sales подтверждает явно (G2, VERSION-002).

### Evidenz-запись

`extrahiert → bestätigt` (вопросом или на встрече) · `extrahiert → verworfen` (sales отклонил извлечение). Подстановки живут со статусом `abgeleitet` до появления лучшего источника. Повторный анализ **никогда** не трогает `bestätigt` и не перекрывает Festlegungen — при конфликте создаёт `konflikt`-пометку с диффом (D-08).

> В терминах §5.2 это не одна машина, а три независимые оси: подтверждение выводится из последовательности `VerificationEvent`, конфликт — отдельная запись `Conflict` со своими `ConflictResolutionEvent`, выбор и свежесть — `ValueContextState`. «Состояние записи Evidenz» — удобная проекция для интерфейса, но хранить его одним полем нельзя (SOURCE-001).

### Frage

`offen → beantwortet | hinfällig`. Ответ не хранится в вопросе — он **становится Evidenz со статусом `bestätigt`**, и допущение исчезает само (M-4). `hinfällig` — вопрос снят другим путём (дослан документ).

### Calculation Run

`queued → running → completed | failed | cancelled`. Терминальные состояния неизменяемы; повтор — новый прогон с новым ID (§5.1). Клиентские выдачи читают только `completed` + `authoritative` + `current`.

---

## 7. Хранение

**Прототип:** фикстуры трёх демо-проектов как JSON; изменения — в localStorage (ключ = project_id); журнал событий — массив в том же JSON. Никакого бэкенда. Кнопка «Zurücksetzen» восстанавливает фикстуру — важно для повторных прогонов теста с разными sales.

**Прод (эскиз для ин-хаус команды):** реляционная БД, где **одиннадцать** append-only таблиц физически запрещают UPDATE и DELETE — `Ereignis`, `VerificationEvent`, `Conflict`, `ConflictResolutionEvent`, `CoverageDecisionEvent`, `QuoteRecord`, `QuoteSelectionEvent`, `QuoteWithdrawalEvent`, `DocumentActivationEvent`, `ProposalCommitEvent`, `ValidationIssueStatusEvent` — а проекции (`ValueAuditIndex`, `DocumentRecord.activeVersionId`, `ValueContextState`, `DocumentVersionState`, `QuoteEvaluation`) пересобираются из этих таблиц и не входят в хеши. Ratenkatalog с `gültig_ab`-версионированием, снапшоты как JSONB. Отдельные вопросы вне прототипа: роли (Sales / Vertriebsleitung / Admin — кто меняет маржу и ставки), синк HubSpot (webhook → Projekt), хранилище документов (ЕС-регион, ссылка из Dokument).

**Конкурентный доступ.** Формулировка v0.1 «оптимистичные блокировки достаточны» заменена на конкретный механизм §5.4: устаревший редактор не может дописать в чужую ветку и коммитит только как `createNewVariant`. Это не блокировка, а структурная невозможность потерять правку — при десяти пользователях и сделке в 3 млн € разница существенна.

**Что из §5 прототип не реализует.** Прототип — симулятор без бэкенда, поэтому серверные гарантии в нём недостижимы по построению: атомарное присвоение `sequenceNumber`, серверная проверка авторизации (SECURITY-001), настоящие хеши содержимого файлов. Прототип реализует эти места как честные заглушки с явной пометкой, а не как работающий механизм. Полный перечень таких мест ведётся в реестре требований с меткой `SPEC`. Для клиентских выдач он не дублируется здесь, а живёт в одном месте — `output-model.md` §13: сетевой payload, серверная авторизация, настоящие хеши байтов, доставка письма и идемпотентность приёмки. Держать список `SPEC` в двух документах значит гарантировать их расхождение.

---

## 8. Что прототип обязан реализовать по-настоящему

Разделение важно, потому что «прототип-симулятор» — не индульгенция. Настоящими в прототипе обязаны быть все места, где симуляция скрыла бы дефект модели:

| Обязательно настоящее | Почему |
|---|---|
| Арифметика в Decimal, точные значения, `≈` при показе | CALC-007 — симуляция округления прячет ровно тот баг, который ищем |
| Пять состояний покрытия и вывод `completeness` | CALC-006 — подпись итога обязана меняться от данных, а не быть строкой |
| Полнота множеств в снапшоте версии | иначе воспроизводимость M-3 не проверяется |
| Ссылка ставки на конкретный `AreaValue` | DATA-001 — без этого знаменатель снова станет подписью |
| Один `ImpactSnapshot` на контекст | CALC-012 — две дельты одного изменения ловятся только так |
| Журнал как единственный источник сессионной сводки | CALC-014 |
| Инварианты §9 как тесты | они и есть приёмка |

---

## 9. Инварианты — исполняемые тесты

Нумерация сохраняет первые восемь пунктов v0.1 и продолжает их. Каждый пункт — тест; пункт без теста в этот список не входит.

**Снапшоты и версии**

1. Отправленный снапшот неизменяем; повторный экспорт того же варианта без изменений → тот же результат бит-в-бит.
2. Два варианта с одинаковым нормализованным множеством решений не могут существовать (предупреждение при сохранении).
3. `bestätigt`-Evidenz и Festlegung никогда не перезаписываются анализом.
4. Сумма перераспределения 70/22/8 равна сумме до перераспределения (D-07: итог не меняется).
5. Активные допущения ≡ параметры, чей каскад дошёл до уровня 4 — ни больше, ни меньше.
6. Δ-веса в интервале соответствуют таблице §5.1 fallback-правил для текущего источника каждого параметра.
7. Целевая версия оффера — максимум одна на проект; роли базиса, цели, рекомендации и текущего редактирования хранятся отдельными ссылками и могут указывать на одну версию.
8. Ereignis-журнал не имеет дыр: любое расхождение двух состояний варианта объяснимо цепочкой событий.

**Структура и ссылки (§5.1)**

9. Ссылки Project/Complex/Building/UsageSegment двусторонне согласованы; ни одна сущность не встречается в двух родительских массивах.
10. `ProjectConfigurationSnapshot` содержит ровно одну конфигурацию на каждое здание и ровно одну на каждый сегмент — ни одной лишней, ни одной пропущенной.
11. `versionNumber` уникален и монотонно растёт внутри варианта; `headVersionId` меняется только событием коммита.
12. Инварианты статусов `CalculationRun` выполняются во всех пяти состояниях; `createdAt ≤ startedAt ≤ finishedAt` для присутствующих полей.
13. Клиентская выдача ссылается только на `completed` + `authoritative` прогон.

**Значения и происхождение (§5.2)**

14. У каждого `ValueRecord` есть хотя бы одна `SourceReference`, неотрицательная `displayPrecision` и `scopeRef`, действительный для снапшота проекта.
15. Статус подтверждения выводится из события с наибольшим `sequenceNumber`; удаление и переписывание событий невозможны.
16. На пару `(subject, slotKey)` приходится не более одного `authoritative`; ноль допустим только при открытом конфликте, блокирующем все зависимые Output Profile.
17. Значение из документа, подтверждённое клиентом, с открытым конфликтом, устаревшее в одном контексте и authoritative в другом, воспроизводится без потери цепочки источников (приёмка SOURCE-001).

**Площади, деньги, ставки (§5.3)**

18. `сумма / знаменатель` воспроизводит ставку в пределах задокументированного округления для каждой `RateMetric`.
19. Ни одна ставка с подписью `oberirdisch` не имеет знаменателем площадь, включающую подземную часть (DATA-001).
20. `вход × коэффициент == точное выведенное значение` для каждой производной площади; отсутствие ссылки на вход валит тест (CALC-010).
21. Подпись `WFL` не включает ненормативные площади; `COMMUNAL_AREA` учитывается отдельным типом (DATA-005).
22. `comparable` требует все нормализованные поля и `absoluteDelta = subject − target`; `notComparable` требует причину и запрещает числа.
23. Объединённая `Σ WFL + Σ NUF` отсутствует во всех клиентских выдачах (R-11, правило проекта 39).

**Объём и цены (§5.4)**

24. Шесть массивов покрытия попарно не пересекаются, и их объединение равно точному Scope Universe прогона.
25. Каждый `pricedIncludedItemRef` покрыт хотя бы одним вкладом; каждый `unpricedIncludedItemRef` — ни одним.
26. `exactPricedMoneyValueId` равен точной Decimal-сумме строк до отображаемого округления; вклады вне Declared Pricing Scope в сумму не входят.
27. `completeness = complete` тогда и только тогда, когда `unknownItemRefs` и `unpricedIncludedItemRefs` пусты и нет открытых существенных проблем категорий `financial` или `scope`, затрагивающих прогон (CALC-006).
28. Подпись итога соответствует таблице четырёх подписей; итог без названного Declared Pricing Scope не встречается ни в одной выдаче (R-18).
29. `onRequest` не входит в знаменатель процентов и не имеет вклада в стоимость.
30. `onRequest` присутствует только там, где есть `CoverageDecisionEvent` с актором, временем, источником и причиной; удаление бенчмарка покрытия не меняет (SCOPE-001).
31. Множества Scope Item базы и опций не пересекаются, либо пересечение покрыто `CostAllocationRelation`, чьи доли суммируются точно (CALC-013).
32. Стоимость опции входит в итог ровно один раз; `Im Angebot` встречается только при выполнении всех четырёх условий CALC-011.
33. Каждая `CostLine` равна точной сумме своих вкладов; все связанные денежные значения делят валюту и налоговую базу.
34. Отсутствующая цена никогда не представлена нулём; точный ноль существует только как явное нулевое денежное значение.

**Влияние и дельты (§5.6, §5.10)**

35. Сужение неопределённости выражено в процентных пунктах; `marginDeltaPp = to − from`.
36. Заголовок влияния воспроизводится правилом агрегации без ручного текста; строки не суммируются интерфейсом (CALC-001).
37. Один Impact Context → один `ImpactSnapshotId` → одна точная дельта во всех четырёх местах: предпросмотр, журнал, сравнение, выдача (CALC-012).
38. Дельты строк уникальны по ключу и суммируются в заголовок точно.
39. Сессионная сводка строится только из закоммиченных событий, хранит ID базиса и головы, и сумма её строк равна заголовку (CALC-014).

**Документы и сроки (§5.7, §5.8)**

40. `activeVersionId` совпадает с состоянием, выведенным из последовательности событий активации; ровно ноль или одна версия активна; дата штампа чертежа сама ничего не активирует (VERSION-002).
41. Неудачный или отменённый разбор не может быть активирован; частичный остаётся существенной проблемой до закрытия валидации.
42. Заголовок, строки зданий, диаграмма и дата завершения выводятся из одной модели сроков и проходят перекрёстную сверку (CALC-005).
43. Bauzeit комплекса равна `max(start + dauer)`, а не сумме длительностей.
44. `calendarId` присутствует ровно при `workingDay`.

**Точность и устаревание (§5.9)**

45. Все производные величины считаются от точных значений; ни одна не берёт на вход отображаемое число (CALC-007).
46. Показ, отличающийся от точного значения, несёт `≈` и расшифровку в интерфейсе, а в PDF и письме — пометку у метрики **и** сноску.
47. Удельные величины комплекса считаются от сумм, а не как среднее из средних.
48. Изменение authoritative-входа, правил, бенчмарка или активного документа переводит зависимые выдачи в `stale`; отправка устаревшей выдачи невозможна (STALE-001).
49. Вывод «x % от медианы» невозможен при несовместимом объёме или выключенной нормализации (CALC-008).
50. Региональный фактор присутствует строкой в драйверах затрат и при выключенном состоянии, с суммой, которую он добавил бы (D-15, CALC-009).
51. Подпись `GK 4` невозможна при активных драйверах, существующих только для `GK 5`, без явного состояния конфликта (CALC-003).
52. Пока обязательные входы или набор правил не подтверждены, класс здания показывается как `Prüfung erforderlich` (CALC-004).

**Уникальность ссылок и запреты статусов (§5.1)**

53. Каждый массив ID модели содержит только уникальные значения; `inputValueIds` уникальны **и** принадлежат родословной субъекта — значение чужого проекта или чужого здания в снапшот не попадает.
54. Запреты статусов `CalculationRun` выполняются наравне с требованиями: `failed` запрещает `outputHash` и `cancelReason`; `cancelled` запрещает `outputHash` и `failureCode`; `queued` запрещает все пять терминальных и временны́х полей; `startedAt` опускается **только** при отказе или отмене до начала исполнения.

**Конфликт, проекция и контракты диапазонов (§5.2)**

55. `Conflict` — отдельная append-only запись со списком кандидатов; её статус выводится из `ConflictResolutionEvent` с наибольшим `sequenceNumber`; `defer` оставляет конфликт открытым; ни один конкурирующий `ValueRecord` при разрешении не переписывается.
56. `ValueAuditIndex` пересобирается из append-only записей, не входит в хеш `ValueRecord`, и при расхождении с потоком событий правым признаётся поток, а не индекс.
57. Границы `DurationRange` — неотрицательные целые дни; `DurationDelta` и `DurationBoundDelta` — целые знаковые дни.
58. `MoneyRange` и `MoneyBoundDelta` используют одну валюту и одну налоговую базу у обеих границ.
59. `absolute`-`AsymmetricRange` наследует единицу целевой `ValueRecord` и собственной единицы не объявляет; `relativePercent` дополнительно требует `lower ≤ 0 ≤ upper`.

**Состав хеша сравнения (§5.3)**

60. `comparisonContextHash` покрывает все девять составляющих, перечисленных в §5.3, включая каждый снапшот нормализации в объявленном порядке; `areaType` и `standardRef` присутствуют в `RateUnitDescriptor` ровно у area-знаменателя и отсутствуют у знаменателя-количества.

**Объём, предложения, опции и котировки (§5.4)**

61. `DeclaredPricingScopeSnapshot.includedItemRefs` **точно равны** множеству `included`-выборов субъекта или прогона и ссылаются на тот же `ScopeUniverseSnapshot`; `PricingSummary.declaredPricingScopeId` указывает именно на этот снапшот.
62. `proposalReason` присутствует ровно у тех `ProposedScopeSelection`, чьё целевое покрытие или источник отличаются от базовой версии, **и отсутствует у наследованных неизменённых записей**.
63. Все денежные значения, входящие в один итог с подписью `Gesamt netto · <Declared Pricing Scope>`, используют валюту проекта и `taxBasis = net`; чужая валюта или brutto входят только через явное версионированное преобразование, сохранённое в происхождении.
64. Граф опций закреплённого снапшота каталога ацикличен, несовместимость симметрична, и ни одна пара опций не является одновременно зависимостью и несовместимостью; недействительный граф блокирует оценку.
65. `selected = false` → `quantity` отсутствует; выбранная небинарная опция → `quantity > 0`.
66. Выбранная опция с невыбранной зависимостью даёт `dependencyMissing`, обязательная невыбранная — `requiredOptionMissing`; ни в одном случае выбор не изменяется автоматически.
67. `unavailable` или `incompatible` при `selected = true` создаёт блокер и не отбрасывается молча.
68. `OptionUiState` соблюдает распределение статусов по субъектам: `dirty` — только у ревизии черновика, preview-статусы — только у предложения, authoritative-статусы — только у версии варианта; **подпись `Im Angebot` доступна исключительно при `authoritativeReady`** с совпадающим завершённым актуальным authoritative-прогоном.
69. Текущую котировку определяет `QuoteSelectionEvent` с наибольшим `sequenceNumber` в тройке `(projectId, scopeItemId, appliesTo)`; текущих котировок ноль или одна; `QuoteRecord` неизменяем, а отзыв существует только как append-only `QuoteWithdrawalEvent` с непустой причиной.
70. `QuoteEvaluation` выводится на точную метку времени рендера или preflight в порядке `withdrawn` → `expired` → `valid`, и каждому из четырёх состояний соответствует ровно одна подпись и одно действие из таблицы §5.4.
71. Деньги котировки входят в итог только после явного решения о покрытии `included` **и** нового завершённого authoritative-прогона; ни заведение, ни выбор, ни действительность котировки итог не меняют.

**Влияние и переиспользование снапшота (§5.6, §5.10)**

72. `affectedRefs` непусто и равно дедуплицированному объединению всех явных целей влияния и отдельно затронутых ссылок на объём, валидацию и профили выдачи; лишних устаревших ссылок и неперечисленных целей нет.
73. Вероятность риска лежит в `[0,100]` процентов, `probabilityDeltaPp = toProbabilityPercent − fromProbabilityPercent`; направление уровня риска берётся из версионированной шкалы, а не из разности целых.
74. `CostRangeImpact` и `ScheduleRangeImpact` считают дельту по каждой границе отдельно; `CostRangeImpact` делит валюту и налоговую базу между from, to и дельтой, `ScheduleRangeImpact` — метрику, базу длительности и календарь.
75. Журнал и сравнение вариантов переиспользуют `ImpactSnapshot` предпросмотра **только** когда `ProposalCommitEvent` фиксирует тот же `proposalHash` и `proposalCalculationInputHash == createdVariantVersionCalculationInputHash`; полные хеши предложения и версии при этой проверке не сравниваются, потому что аудит-метаданные коммита заведомо различаются.

**Документы и неопределённость срока (§5.7, §5.8)**

76. Предусловия документных решений выполняются точно: `activate` при уже активной версии требует `previousActiveVersionId`, равного точной текущей активной, и переводит её в `superseded`; при отсутствии активной это поле отсутствует; `deactivate` требует равенства точной текущей активной и даёт `inactive`; `rejectCandidate` требует неактивного кандидата, даёт `rejected` и терминален в v0.5; версия без события остаётся `candidate`.
77. `versionEvidence` и `supersedesId` — только доказательство: ни одно из них не активирует версию без `DocumentActivationEvent`.
78. На одну `ScheduleDurationMetric` существует не более одной `ScheduleDurationUncertainty`; её диапазон использует ту же базу длительности, тот же календарь и неотрицательные целые дни.
79. `planning` и `projectTotal` требуют `entityRef` уровня Project, `buildingExecution` — `entityRef` того Building, чей ID стоит в `metricKey`; каждая веха метрики существует в той же `ScheduleModel`, и начальная веха раньше конечной.

**Проблемы валидации (§5.11)**

80. Состояние `ValidationIssue` выводится из `ValidationIssueStatusEvent` с наибольшим `sequenceNumber`; `resolve` требует `evidenceRef`; повторная оценка с тем же `deduplicationKey` и тем же `evaluationContextHash` дописывает `reopen`, при другом хеше создаётся преемник с обратной ссылкой, а история прежней проблемы не переписывается.
81. `warning` имеет пустой `blockedOutputProfiles`; `material` имеет хотя бы один, и каждый заблокированный профиль входит в `affectedOutputProfiles`; открытая существенная проблема категорий `compliance`, `scope` или `financial` блокирует все пять клиентских профилей (R-07).

**Воспроизводимость, идентичность сценария и смешанное использование**

82. Каждый блок, показывающий неопределённость, стоимость или срок, несёт `scenarioId`, `variantVersionId`, `calculationRunId`, `runPurpose`, `rulesetVersion`, снапшот бенчмарка, версию движка и отметку времени в названной зоне IANA; две последовательности интервалов без такой идентификации не сосуществуют (CALC-002).
83. Каждый `CalculationRun` хранит снапшот входа, версии правил, снапшот бенчмарка, версию движка, актора, время и хеш выхода, поэтому любой когда-либо отправленный оффер открывается с теми же входами и теми же выходами (VERSION-001).
84. `Gemischte Nutzung im Gebäude` (`usageSegmentIds.length ≥ 2`) и `Heterogener Komplex` (различие `useClass` между зданиями комплекса) — два независимых предиката: каждый может быть истинным и ложным независимо от другого, и одно слово `gemischt` не используется для обоих (DATA-004).

---

## 10. Отображение M-1…M-4 на формальную модель

Проверка, что неприкосновенное ядро уцелело. Слева — принцип, справа — конструкции §5, которые его реализуют.

| Принцип | Конструкции §5 | Что уточнилось |
|---|---|---|
| **M-1** Evidenz ≠ Festlegung | `ValueRecord` + `VerificationEvent` (Evidenz) против `ProjectConfigurationSnapshot.inputValueIds` и `CommittedScopeSelection` (Festlegung) | Чип источника стал проекцией шести независимых осей вместо поля `konfidenz` |
| **M-2** наследование до фиксации | `ConfigurationDraftRevision` (разрежённый) → `ConfigurationProposal` → `VariantVersion` (полный, с переиспользованием ссылок базы) | Разрежённость — свойство черновика; снапшот полон, но неизменённые записи физически ссылаются на события и значения базы |
| **M-3** заморозка при отправке | Неизменяемая `VariantVersion` + `CalculationRun` со снапшотами входа, правил, бенчмарка и хешем выхода | Воспроизводимость перестала зависеть от копирования чисел: состояние выбора живёт в `ValueContextState` по контексту |
| **M-4** журнал как хребет | Одиннадцать append-only таблиц (перечень — §7) + проекции, не входящие в хеши | Сессионная сводка получила базис, голову и обязательную сверку суммы строк с заголовком |

**Ни один из четырёх принципов не ослаблен, но точность формулировок v0.1 сохранена не везде.** M-1 получил недостающие оси, M-3 — воспроизводимость по контексту вместо копий, M-4 — доказуемую сверку.

M-2 сохранён по существу: выгода 3 (уникальность варианта через хеш) даже усилена — `calculationInputHash` строже прежнего хеша множества, потому что покрывает оба снапшота каталогов; выгода 4 (дешёвое клонирование) не затронута. Две другие требуют уточнения, и прежняя редакция §10 их переоценивала:

- **Выгода 1 «подтверждение распространяется само»** на *закоммиченные* версии не распространяется по построению, и это правильно: `VariantVersion` неизменяема, а новое подтверждение создаёт **новую** `ValueRecord`, на которую старая версия не ссылается — иначе рухнул бы M-3. Актуальная ветка получает значение не «сама», а по цепочке `freshnessStatus → stale` → новый прогон → по R-10 новая `VariantVersion`. Цикл ручной синхронизации четырёх вариантов по-прежнему не нужен, но слово «само» неточно: между подтверждением и новым числом стоит явный прогон.
- **Выгода 2 «различия и есть то, что хранится, а не вычисляется диффом»** буквально перестала быть верной: сравнение стало обходом двух полных множеств. По существу оно осталось дешёвым и безошибочным — сравниваются идентичности ссылок на события и значения, а не значения, — но это уже дифф по ссылкам, а не отсутствие диффа.

Разница между «сохранено» и «сохранено по существу» здесь не педантизм: именно на таких формулировках держится доверие к документу, и именно её отсутствие делает заявление непроверяемым.

---

## 11. Зафиксированные отклонения от норматива

Правило 0.9 аудита: отклонения существуют, но не бывают молчаливыми.

| Отклонение | Что решено | Митигация |
|---|---|---|
| **R-26** — десятичные месяцы | PO отклонил в части отображения; добавлено значение `halfMonthRounded` в `durationPresentationPolicy` | Рядом с длительностью всегда абсолютная дата завершения; политика и база входят в снапшот. Единая модель, единый epoch и точные даты не затронуты |
| **R-11** — `Σ WFL + Σ NUF` | Убрана из всех клиентских выдач; сохранена как `Interne Bezugsgröße` во внутреннем пространстве | Обязательная пометка «keine normative Fläche · kein BKI-Vergleich»; сравнение с бенчмарком запрещено структурно |
