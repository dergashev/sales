D-28: классов состояний 6 · форма витрины: в · разделов витрины вне реестра 33 · перечень контрактов: предложен

# TASK-30 · дизайн-система как единый источник

Дата: 10.08.2026. Зоны D-28/PROTOCOL §2-bis соблюдены: изменены только контракты и CSS
дизайн-системы плюс этот отчёт; `src/**`, `tools/**`, сборка и реестр не редактировались.

## Результат

В `components-core.md` появился отдельный core-контракт `DataStateBlock`, а в
`components.css` — его шесть публичных классов:

- `.a3-data-state` — обязательный root;
- `.a3-data-state-empty`;
- `.a3-data-state-partial`;
- `.a3-data-state-error`;
- `.a3-data-state-stale`;
- `.a3-data-state-permission`.

Контракт задаёт обязательное содержание, допустимые сочетания, переходы, keyboard/screen
reader policy и запрет автоматического live-region у статического образца. Новых токенов нет.
`error` имеет визуальный приоритет над `stale`; цвет не является единственным носителем.

`DC-24 EmptyState` не расширен до остальных состояний: он теперь явно строится из
`DataStateBlock.empty` и сохраняет собственную анатомию с объяснением и одним действием.
Расширение DC-24 на `partial/error/stale/permission` противоречило бы его же запрету подменять
ими пустоту.

Исходное условие задания про отсутствие CSS у DC-24 уже не соответствовало дереву:
`.a3-empty-spec/.a3-empty-icon` существовали до TASK-30. Отсутствовал именно общий контракт
для остальных блоков. Шесть образцов в текущем реестре — `loading` через Skeleton плюс пять
блоков; обязательного `ready` там нет. Отдельный `.a3-data-state-ready` не нужен: `ready`
демонстрируется настоящим компонентом с актуальными данными.

Адреса поставки:

- `design-system/components-core.md:1695` — контракт `DataStateBlock`;
- `design-system/components-core.md:1978` — актуализированная готовность 24 core-контрактов;
- `design-system/components.css:602` — root и пять state-модификаторов;
- `design-system/README.md:2308` — DC-24 как специализация нового primitive.

## Форма витрины: вариант в, конечная архитектура а

Выбран вариант **в — покомпонентный переход**, потому что это буквально закреплено D-28:
переход не выполняется одним движением. Сейчас реестр не способен заменить содержательную
витрину без потери 33 разделов. Big-bang вариант а либо удалил бы их, либо вынудил бы оставить
ручную копию рядом с новой страницей.

Инвариант миграции: одна атомарная правка добавляет registry specimen и в той же правке удаляет
соответствующую ручную разметку старого раздела. Для уже перенесённого компонента двух реализаций
не бывает; для ещё не перенесённого в реестре нет ложного пустого дубля. Новые ручные sections
во время перехода запрещены.

Конечная физическая форма после `M = 0` — **а**, отдельный Vite entry, который рендерит
`SPECIMEN_GROUPS`. Он сохраняет hooks, таймеры, Esc/focus и другие живые поведения. Вариант б
без hydration превратил бы интерактивные образцы в снимки; с hydration он становится вариантом
а с лишним SSR-слоем.

Оболочка публичной витрины может сохранять полноширинный рассказ, порядок и deep links, но
содержимое каждого specimen обязано приходить только из `render()` реестра. Текущую компактную
auto-fit сетку QA Foundation не следует делать обязательной оболочкой публичного документа.

## Точная дельта 37 → 15

Правило счёта: 37 исходных `h2/h3` до `Ergänzte Spezimen`; три — только групповые контейнеры,
34 — содержательные разделы. Из 34 только `Lernender Loader — Protokoll statt
Fortschrittslüge` достаточно представлен живым `DocumentAnalysis`/DC-10. Поэтому `M = 33`:
24 раздела отсутствуют полностью и девять представлены лишь частью механизма.

Три контейнера, не считающиеся самостоятельными specimens: `Interaktionsmechaniken — die
Reise`, `Gebäudetypen, Optionen & Utilities`, `Domänen-Komponenten`. Они всё равно нужны как
`SpecimenGroup.title/intro/order`, но им нельзя выдумывать component contract ID. Если считать
буквально невоспроизведённые заголовки, получится 36; это не показатель первой строки, потому
что три из них — навигационная группировка, а не образцы.

| № старой витрины | Раздел вне реестра | Состояние |
|---:|---|---|
| 1 | Farben | отсутствует; foundation |
| 2 | Typografie | отсутствует; foundation |
| 3 | Bewegung erklärt Geld | частично: OriginPopover и generic control не заменяют wave/ghost/delta/journal composition |
| 4 | Kostentreiber — Warum dieser Preis? | отсутствует, DC-44 |
| 5 | Der Moment: Kunde bestätigt eine Zahl | частично: отдельные primitive не доказывают связанный confirm-transition |
| 6 | Annahme-Karte — Ehrlichkeit als Baustein | отсутствует, DC-8 |
| 8 | Bereitschafts-Ring & Nächster Schritt | отсутствует, DC-26/DC-27 |
| 9 | Sicheres Experiment: Undo überall | отсутствует, DC-6/DC-29 |
| 10 | Rabatt-Steuerung — greifbar, mit Margen-Wächter | отсутствует, DC-25 |
| 11 | Freigabe vor der Präsentation | отсутствует, DC-33 |
| 12 | Konflikt-Karte — der Mensch entscheidet | отсутствует, DC-32 |
| 13 | Termin-Zusammenfassung — das Nachspiel | отсутствует, DC-31 |
| 14 | Skeleton & Kurzbefehle | частично: Skeleton есть, shortcut service/help отсутствуют |
| 16 | Gebäudetyp wählen | отсутствует, DC-39 |
| 17 | Gebäudekomplex — ein Umschalter, kein zweiter Bildschirm | отсутствует, DC-46/DC-47 |
| 18 | Optionen als Kacheln | частично: RadioCardGroup не закрывает DC-40, media/price/status/disabled semantics нет |
| 19 | E-Mail-Versand & Drucken | отсутствует, DC-41/DC-42 |
| 20 | Notiz — nur intern | отсутствует, DC-43 |
| 21 | Sprache | частично: SegmentedControl не доказывает locale/Intl/content behavior DC-45 |
| 22 | Abstände & Dichte | отсутствует; foundation |
| 23 | Dichte-Demo — Kostentabelle | отсутствует |
| 24 | Zustände | частично: нет `ready`, SaveStatus и полной state surface |
| 25 | Status-Tags & Genauigkeitszonen | частично: есть только один фрагмент UncertaintyBadge |
| 27 | Projekt-Karten — die Warteschlange | отсутствует, DC-15 |
| 28 | Dokument-Zeilen mit Versionsstatus | частично: строки внутри DC-10 не являются direct specimen DC-17 |
| 29 | Tabs | отсутствует, core Tabs |
| 30 | Bauzeit-Leiste | отсутствует, DC-19 |
| 31 | Fassaden-Kacheln | отсутствует, DC-20 |
| 32 | Quellen-Chips | частично: четыре плоские подписи не закрывают target/conflict/layered provenance |
| 33 | Ein Hinweis, zwei Modi | отсутствует, DC-7 |
| 34 | Offene Fragen — sortiert nach Wirkung | отсутствует, DC-9 |
| 36 | Variantenvergleich — nur Unterschiede | отсутствует, DC-11 |
| 37 | Kapitel-Navigation | отсутствует, DC-13 |

`37 − 15 = 22` здесь неверно: несколько registry specimens относятся к одному старому разделу,
один specimen входит в несколько старых compositions, а generic primitive не закрывает
составной доменный контракт.

## Contract ↔ specimen: текущий замок неполон

Устойчивого полного extraction сейчас нет:

- README-парсер берёт тела только между §2.6/§2.7 и не выдаёт `specimenRequired`;
- core-парсер читает headings между §§2–9 без component IDs, игнорирует четыре контракта §12,
  допускает уменьшение множества до 20 и содержит устаревшее число 22;
- `GALLERY-SINGLE-SOURCE` запрещает JSX образца в оболочке Gallery, но не читает поле
  `Specimen.contract` и не проверяет полноту/сироты в обе стороны;
- пять из 15 нынешних `contract` значений — requirement/policy IDs (`STATE-002`, `SCOPE-001`,
  `STATE-005`, `STATE-008`, `R-17`), а не component contract IDs.

Предлагается авторитетный `design-system/contracts.json`. После добавления DataStateBlock его
полный denominator — 77 records: 75 тел контрактов и две служебные записи DC-18/DC-36.
`specimenRequired=true` у 74, `false` ровно у трёх записей с машинной причиной: deprecated
DC-18, alias DC-36 и невизуальный `KeyboardShortcutService` с альтернативным test/evidence.

Ниже готовое содержимое минимального перечня; статус первой строки остаётся «предложен», потому
что сам JSON и его builder относятся к зоне Claude и в этой поставке не создавались.

```json
{
  "schemaVersion": 1,
  "contracts": [
    {"id":"DC-1","name":"ValueProvenanceChip","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-2","name":"PriceDeltaChip","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-3","name":"EstimateUncertaintyBadge","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-4","name":"EditableValueField","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-5","name":"CostGroupRow","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-6","name":"ChangeImpactPreview","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-7","name":"ClientNoticeDot","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-8","name":"AssumptionCard","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-9","name":"OpenQuestionRow","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-10","name":"DocumentAnalysisProgress","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-11","name":"VariantComparisonCell","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-12","name":"SessionJournalBar","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-13","name":"WorkflowStepper","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-14","name":"GuidedTourStep","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-15","name":"ProjectQueueCard","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-16","name":"StatusTag","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-17","name":"DocumentRow","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-18","name":"Tabs","kind":"domain","status":"deprecated","specimenRequired":false,"replacedBy":"DC-46"},
    {"id":"DC-19","name":"ScheduleTimeline","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-20","name":"FacadeRenderTile","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-21","name":"CalculationOriginPopover","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-22","name":"OutputProfileSwitch","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-23","name":"OutputPreflightChecklist","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-24","name":"EmptyState","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-25","name":"DiscountControl","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-26","name":"ReadinessChecklist","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-27","name":"NextStepCard","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-28","name":"ConsequencePreviewGhost","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-29","name":"UndoToast","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-30","name":"AutosaveChip","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-31","name":"MeetingSummary","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-32","name":"ConflictResolver","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-33","name":"ClientOutputGateDialog","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-34","name":"ProjectSearchFilter","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-35","name":"Skeleton","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-36","name":"ShortcutHelpDialog","kind":"domain","status":"alias","specimenRequired":false,"aliasOf":"core.shortcut-help-dialog"},
    {"id":"DC-37","name":"ScopeLineItemBlock","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-38","name":"KeyMetricsGrid","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-39","name":"ClassificationControlGroup","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-40","name":"OptionTile","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-41","name":"OfferEmailComposer","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-42","name":"PrintFlow","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-43","name":"InternalNote","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-44","name":"CostDriverBreakdown","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-45","name":"LanguageSelector","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-46","name":"BuildingSwitch","kind":"domain","status":"active","specimenRequired":true},
    {"id":"DC-47","name":"ComplexSummaryTable","kind":"domain","status":"active","specimenRequired":true},

    {"id":"docs.documentation-nav","name":"DocumentationNav","kind":"documentation","status":"active","specimenRequired":true},
    {"id":"docs.state-specimen-gallery","name":"StateSpecimenGallery","kind":"documentation","status":"active","specimenRequired":true},

    {"id":"core.button","name":"Button","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.link","name":"Link","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.tabs","name":"Tabs","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.segmented-control","name":"SegmentedControl","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.radio-card-group","name":"RadioCardGroup","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.checkbox-card","name":"CheckboxCard","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.switch","name":"Switch","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.form-field","name":"FormField","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.select","name":"Select","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.numeric-input","name":"NumericInput","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.slider","name":"Slider","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.textarea","name":"Textarea","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.data-table","name":"DataTable","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.disclosure-row","name":"DisclosureRow","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.card","name":"Card","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.badge","name":"Badge","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.chip","name":"Chip","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.tooltip","name":"Tooltip","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.toast","name":"Toast","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.dialog","name":"Dialog","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.save-status","name":"SaveStatus","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.data-state-block","name":"DataStateBlock","kind":"core","status":"active","specimenRequired":true},
    {"id":"core.keyboard-shortcut-service","name":"KeyboardShortcutService","kind":"core","status":"active","specimenRequired":false,"exemption":{"kind":"nonvisual","evidence":["core.shortcut-help-dialog","keyboard contract tests"]}},
    {"id":"core.shortcut-help-dialog","name":"ShortcutHelpDialog","kind":"core","status":"active","specimenRequired":true},

    {"id":"layout.section-sheet","name":"SectionSheet","kind":"layout","status":"active","specimenRequired":true},
    {"id":"layout.page-header","name":"PageHeader","kind":"layout","status":"active","specimenRequired":true},
    {"id":"layout.small-text","name":"SmallText","kind":"layout","status":"active","specimenRequired":true},
    {"id":"layout.inline-link-link-button","name":"InlineLink / LinkButton","kind":"layout","status":"active","specimenRequired":true}
  ]
}
```

Для `StateSpecimenGallery` specimen обязателен и строится на маленьком injected registry, а не
на глобальном реестре: это доказывает empty/partial/error самого gallery contract без рекурсии.

### Требуемый machine contract

1. У каждого contract record — уникальные `id/name`, допустимые `kind/status` и ровно один
   стабильный marker в документе: `<!-- contract-id: core.button -->`. Имя следующего heading
   обязано совпадать с manifest.
2. `alias/deprecated` всегда имеют `specimenRequired=false`, валидную цель и не принимают direct
   specimen. Циклы/цепочки aliases запрещены.
3. Любой другой `false` требует typed exemption, непустую причину и машинно-разрешимое
   alternate evidence; boolean не является escape hatch.
4. В `Specimen` свободная строка `contract` заменяется на canonical `contractId`.
   Requirement IDs живут в `requirements[]`, вложенные компоненты — в `usesContractIds[]` и не
   засчитываются как direct coverage.
5. Каждый `specimenRequired=true` имеет минимум один direct specimen; для `false` direct
   specimens нет. Specimen с неизвестным/alias/deprecated ID валит сборку. Несколько specimens
   одного active contract разрешены.
6. Python verifier сверяет JSON с markers, README table/matrix и core headings exact-set, а
   Vitest импортирует живой `ALL_SPECIMENS` и проверяет двунаправленное покрытие. Regex по
   произвольному TS не считается доказательством.
7. Обязательные мутации: удалить required specimen; добавить orphan; подставить requirement ID;
   поставить `false` без exemption; дублировать ID; удалить/переименовать marker; сделать alias
   cycle; добавить §12 contract без manifest. Каждая обязана падать.

После перехода числа 47/45/24/4/77 вычисляются из records, а не остаются источниками в прозе.

## Точные follow-up в зоне Claude

1. `src/components/DataStates.tsx`: перевести один компонентный источник на шесть классов выше.
   `EmptyState` сейчас не соответствует DC-24: это `<p>` без action; нужен полный root
   `.a3-data-state.a3-data-state-empty.a3-empty-spec`, icon, explanation и action/read-only
   policy. Устаревший комментарий об отсутствии CSS удалить.
2. `ErrorState` принимает только `cause/remedy`; добавить отдельные `impact` и `retryPolicy`.
   `.numeric` убрать с общего partial-root и оставить только на числовом фрагменте.
3. `src/design-system/registry.tsx`: добавить настоящий `ready` specimen; статические samples не
   объявлять runtime-status. `state-loading` привязать к DC-35; четыре остальных generic state
   samples — к `core.data-state-block`, а requirement IDs вынести в `requirements[]`.
4. `Skeleton` в статической галерее не должен безусловно создавать `role=status`; runtime
   loading объявляет `aria-busy` на владельце согласно DC-35.
5. `tools/verify.py`: заменить текущую частичную проверку на manifest + bidirectional coverage;
   актуализировать сообщения, всё ещё называющие 22 core contracts. `CLAUDE.md` в таблице
   источников также всё ещё называет 22 и находится вне зоны этой задачи.

## Проверка

- `npm run verify` — PASS: новых нарушений 0, вакуумов 0; 4 известных открытых и 21
  предупреждение остаются зарегистрированными и не вызваны TASK-30.
- PostCSS parse `components.css` — PASS; найдено ровно шесть уникальных `.a3-data-state*`.
- `git diff --check` — PASS.
- `src/**` этой поставкой не изменён.

Во время работы HEAD двигался параллельной очередью (`fb1e7e16…` → `4c260380…`), а в
worktree появились чужие изменения `src/state/store.ts` и i18n-аудита. До первой правки hash
`design-system/**` оставался `7fbf523a…`; пересечений с тремя изменёнными файлами TASK-30 не
было.
