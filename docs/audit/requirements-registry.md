# Реестр требований аудита — полная экстракция

**Источник:** All3_Design_System_Audit_Batches_01-02_Consistency_Reviewed_2026-08-04.md  
**Извлечено:** 2026-08-05  
**Назначение:** отслеживание покрытия. Статусы проставляются вручную по мере ремедиации.

**Метод извлечения:** извлечены все строки вида `- [ ] **ID · Pn · TYPE** — текст` из всего документа (проверено скриптом по markdown-источнику, не по памяти), плюс правила `R-01…R-26` (раздел 2) и разрешения `XSC-01…XSC-22` (раздел 4). Текст требования в основном сохранён близко к оригиналу источника; сжаты только формулировки, где это не теряет конкретных значений (числа, hex, названия токенов, ключи состояний).

**Важное ограничение экстракции:** заголовки раздела 3 «Канонический реестр release blockers» (`A11Y-001`, `SAFETY-001`, `DATA-001…005`, `CALC-001…014`, `SCOPE-001`, `VERSION-001/002`, `PRIVACY-001`, `SECURITY-001`, `MODE-001`, `LOCALE-001`, `EMAIL-001/002`, `SOURCE-001`, `CONFLICT-001`, `VARIANT-001`, `FACADE-001`, `STALE-001`) оформлены в источнике как `### ID · P0 · TYPE — текст` (заголовок), а не как чекбокс `- [ ] **ID ...**`. По заданному шаблону извлечения («каждое требование с чекбоксом») они не создают строк в этом реестре. Из списка «уже затронутых» это касается `A11Y-001`, `DATA-002…005`, `CALC-002`, `PRIVACY-001` — см. отчёт.

## Сводка

| Раздел | Требований | P0 | P1 | P2 | SPEC |
|---|---:|---:|---:|---:|---:|
| Раздел 5.11 — Concurrency и audit | 5 | 0 | 5 | 0 | 5 |
| Раздел 6 — Foundations и документация дизайн-системы | 83 | 0 | 73 | 10 | 38 |
| Раздел 7 — Core component requirements | 41 | 0 | 40 | 1 | 25 |
| Раздел 8 — Domain components и flows | 233 | 0 | 217 | 16 | 73 |
| Раздел 9 — Content design и немецкая терминология | 15 | 0 | 12 | 3 | 2 |
| Раздел 12 — Performance, reliability, security и privacy | 12 | 0 | 12 | 0 | 12 |
| Раздел 13 — Каноническая архитектура design tokens | 5 | 0 | 5 | 0 | 5 |
| **Итого (чекбокс-требования)** | **394** | **0** | **364** | **30** | **160** |

Столбец `SPEC` считает требования, у которых тип включает `SPEC` (в т.ч. комбинации `OBS/SPEC`); он не суммируется с P0/P1/P2 (это разные оси). Чекбокс-требований с приоритетом `P0` в документе нет: все `P0` в источнике оформлены как заголовки раздела 3 (release blockers) и в этот реестр не входят по правилам экстракции.

## Правила R-01…R-26

| ID | Краткая суть (одна строка) | Затрагивает |
|---|---|---|
| R-01 | Brand orange `#FD5E00` — только logo/декоративный акцент, не единственный носитель смысла; как текст — только large text на белом, contrast ≥3:1; запрещён как semantic color для action/selection/focus/warning/error/status. | COLOR-001/002/006, A11Y-001 |
| R-02 | Primary action exact tokens: default `#C94700`, hover `#B83F00`, pressed `#A63800`, text `#FFFFFF`; все пары ≥4.5:1 normal-text contrast. | COLOR-001/002, A11Y-001, BUTTON-001 |
| R-03 | Selection border `#C94700`; focus indicator = внутренний separator `2px #FFFFFF` + внешний ring `2px #005FCC`. | COLOR-001/002, BORDER-001 |
| R-04 | Hit area ≥44×44 CSS px; визуальная высота control может быть 32 px, если invisible hit area не перекрывает соседей и focus outline виден. | SLIDER-002, DENSITY-007, XSC-07 |
| R-05 | Существенная информация/цена/consequence/action доступны без hover; hover только дублирует уже доступный preview. | A11Y-002, OPTION-009, TOOLTIP-001 |
| R-06 | `Client Read-only View` всегда read-only; клиентское редактирование — только отдельный `Client Live Configuration` flow с restricted allowlist и versioned commit. | GATE-003/004 |
| R-07 | Material Blocker блокирует все Output Profiles из `blockedOutputProfiles`; для compliance/scope/financial — обязательно все пять client profiles. | CALC-003, MODE-001, GATE-002, CONFLICT-007 |
| R-08 | Missing/unapproved translation блокирует client-facing output; silent fallback и manual override для legal/commercial copy запрещены. | LOCALE-001/008, GATE-002 |
| R-09 | E-mail flow фиксирован: Compose → Preflight → Confirm & Send → Delivery status; body/attachments просматриваются до confirmation. | EMAIL-001/007 |
| R-10 | High-impact change создаёт новую VariantVersion и инвалидирует dependent Runs/outputs; output-only edits создают только draft-версию. | SAFETY-001, CHANGE-004, ARCH-002/004 |
| R-11 | `WFL + NUF` не используется как client-facing denominator и не сравнивается с BKI; `Interne Mischkennzahl` в v0.5 не реализуется. | DATA-002, COMPLEX-004 |
| R-12 | Mixed-use Building = `2..n` Usage Segments; Complex из разных Building/use types не называется mixed-use Building. | DATA-004, COMPLEX-003 |
| R-13 | `Building Form` редактируется только на Building; `Use Class`/`Occupancy Profile`/`Benchmark Profile` — только на Usage Segment; единый `Gebäudetyp` selector запрещён. | DATA-003, BUILDING-001, COMPLEX-002 |
| R-14 | Inputs/rulesets/benchmarks/documents/variants/Runs/outputs versioned; existing offer не пересчитывается in place. | VERSION-001 |
| R-15 | Design tokens содержат только visual values; workflow/permissions/Output Profiles/domain enums/business rules — в data/policy contracts. | TOKEN-004/005 |
| R-16 | Authorization и output visibility независимы; server-side authorization обязательна, CSS hiding не security boundary. | SECURITY-001/003 |
| R-17 | Client outputs строятся только из allowlist; internal-only fields отсутствуют в DOM/a11y tree/network payload/generated bytes. | SECURITY-001 |
| R-18 | Qualified Total только для completed authoritative Run с resolved coverage и complete pricing; иначе Subtotal; excluded/onRequest/notApplicable — отдельный coverage summary, не 0 €. | CALC-006, SCOPE-001, COSTTABLE-002/004/008 |
| R-19 | Каждая delta содержит baseline, direction, signed value, unit; color/icon — вторичные cues. | CHANGE-002, VARIANT-004/005 |
| R-20 | Readiness — checklist + blockers + warnings по каждому Output Profile; percentage score запрещён. | READY-001/005 |
| R-21 | Final value доступен немедленно; motion не единственный feedback, отключается при `prefers-reduced-motion`. | MOTION-002/003 |
| R-22 | Configuration Variant — именованная ветка; Variant Version — immutable snapshot; `Ohne UG + EH 40` допустимы в одной Version. | VARIANT-011 |
| R-23 | Public/shared docs, screenshots, tests, recordings — только synthetic data; source screenshots не копируются как fixtures. | PRIVACY-001/002, DOCS-011 |
| R-24 | Visuelt Pro roles фиксированы: display 64/68 Bold (narrow 48/52), H1 48/56 (narrow 36/44), H2 32/40, H3 24/32, body 16/24 Regular, small 14/20, caption 12/16, status badge 14/20 Medium, metadata badge 12/16 Medium, label/table header 14/20 Medium, button 16/20 Medium, table body/numeric 14/20 Regular tabular-nums. | TYPE-002/011 |
| R-25 | Тёмная тема вне v0.5; любой token/threshold/parameter без exact approved value — blocking design-decision item; Claude не выбирает значение молча. | COLOR-011, TOKEN-005 |
| R-26 | Duration только из exact startDate/endDate/durationBasis; calendarDay → integer `n Monate` только при точном совпадении календарных месяцев, иначе `n Kalendertage`; workingDay → `n Arbeitstage gemäß <Kalender>`; decimal months запрещены. | CALC-005, METRIC-003, GANTT-001 |

## Разрешения противоречий XSC-01…XSC-22

| ID | Конфликт | Каноническое разрешение (сжато) |
|---|---|---|
| XSC-01 | `1.602 €/m² BGF` vs BGF `1.969,67` и `2.297,95` | Rate хранит точный denominatorRef и scope; несовместимый BKI denominator блокирует comparison. |
| XSC-02 | Global `Mehrfamilienhäuser` vs Haus B Büro | R-13: Gebäudeform — уровень Building; Nutzungsart/Benchmarkprofil — уровень Usage Segment; `Gesamt` — read-only aggregation. |
| XSC-03 | GK 5 driver/lift vs GK 4 client label | Один authoritative classification state; до разрешения — hard gate, GK 4 в client output не появляется. |
| XSC-04 | Haus B `6,0 Monate`, Gantt до `Monat 13`, total `12,0` | Всё генерируется из одного ScheduleModel с exact dates по R-26; decimal month labels удаляются. |
| XSC-05 | `±19→±14` и `±22→±13` | Каждый block получает scenarioId/variantId/calculationRunId; различия без разных IDs = test failure. |
| XSC-06 | `Gesamt 100%` при KG 500 `auf Anfrage` | R-18: qualified total только при resolved coverage; KG 500 отдельно; header `Anteil an Gesamt netto · <Scope>`. |
| XSC-07 | `Klick-Ziele 32 px` vs 44 px | R-04: 32 px — визуальная высота control; 44×44 px — hit/focus target. |
| XSC-08 | Star для `Basis` и `Ziel` | Star резервируется для `Ziel`; baseline — text badge `Vergleichsbasis`. |
| XSC-09 | `14-05-2027` vs немецкий формат | Всегда `14.05.2027`; machine value — ISO date. |
| XSC-10 | `KfW 55` vs `EH 40` | UI использует `EH 55`/`EH 40`; KfW-формулировка остаётся только в provenance. |
| XSC-11 | `provisorische Werte gekennzeichnet` без видимой маркировки всех provisional values | Каждый provisional value получает `Vorläufig` + provenance; глобальная декларация не заменяет field state. |
| XSC-12 | Заявленные `47 Domänen-Komponenten` не сверяются с registry | Count генерируется из component registry; hardcoded marketing count удаляется. |
| XSC-13 | `WFL inkl. Gemeinschaftsfl.` | Разделить WFL и communal area; denominator выбирается benchmark profile. |
| XSC-14 | Base driver `EH 55 +96.000 €` и variant delta `EH 40 +96.000 €` | Cumulative model: `BKI-Basis→EH 55 = +96.000 €`, затем `EH 55→EH 40 = +96.000 €`; отдельные IDs/from/to, reconcile total. |
| XSC-15 | Client mode назван `neutral`, но кодируется orange bar | Явный persistent label режима; orange не является смыслом режима. |
| XSC-16 | Status family смешивает workflow/target/environment/version/error | Разделить namespaces и визуальные components; единая полоска tags запрещена. |
| XSC-17 | `Gespeichert` в documentation shell выглядит как runtime status | В docs shell убрать; в product demo — полная save state machine. |
| XSC-18 | `WFL 1.240,39 m²` не воспроизводится из visible `BGF × 0,75` | Derived value обязан ссылаться на exact BGF input; mismatch = CALC-010 failure. |
| XSC-19 | Photovoltaik `+18.000 € · im Angebot` без visible total reconciliation | `Im Angebot` только в completed run с reconciled contribution ровно один раз; иначе pending state. |
| XSC-20 | No-UG preview `−335.000 €` vs no-UG variant `−391.000 €` | Один full Impact Context (endpoints+input/ruleset/benchmark/engine/scope IDs) = один ImpactSnapshot; different context должен быть labelled. |
| XSC-21 | UG/Tiefgarage `+391.000 €` в base vs `UG-Ausbau +115.000 €`/`TG-Zuschlag +30.000 €` options | Base/option ScopeItems disjoint по умолчанию; partition — exact-amount allocation (сумма к source) либо percentage allocation (доли = 1 + versioned residual rule); прочий overlap блокирует расчёт. |
| XSC-22 | `5 Änderungen · +212.000 €` без itemization | Session delta генерируется из committed journal events и reconciles exact itemized sum. |

## Требования по разделам

### Раздел 5.11 — Concurrency и audit

#### 5.11. Concurrency and audit

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| ARCH-001 | P1 | SPEC | все mutating requests используют optimistic concurrency/version checks; stale editor не перезаписывает новую версию молча. | `[ ]` |
| ARCH-002 | P1 | SPEC | audit event содержит actor, timestamp, old/new references, reason и output invalidation. | `[ ]` |
| ARCH-003 | P1 | SPEC | autosave и explicit commit различаются: черновой UI state не становится authoritative calculation input без commit. | `[ ]` |
| ARCH-004 | P1 | SPEC | rollback создаёт новую head version; история не переписывается. | `[ ]` |
| ARCH-005 | P1 | SPEC | retention policy формально определяет срок хранения runs, exports, messages и notes. | `[ ]` |

_Подраздел «5.11. Concurrency and audit»: 5 требований._

**Итого по разделу «Раздел 5.11 — Concurrency и audit»: 5 требований.**

---

### Раздел 6 — Foundations и документация дизайн-системы

#### 6.1. Documentation architecture

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| DOCS-001 | P1 | OBS | разделить documentation shell и product UI. Верхняя навигация документации, save status и product specimens не должны выглядеть одной runtime-страницей. | `[ ]` |
| DOCS-002 | P1 | OBS | заменить IA `Farben / Typografie / Bewegung / Mechaniken / Typen / Dichte / Zustände / Komponenten` на visible German labels: `Grundlagen / Barrierefreiheit / Basiskomponenten / Datenkomponenten / Fachkomponenten / Interaktionsmuster / Vorlagen / Inhalte / Steuerung & Freigabe / Änderungsprotokoll`. Route/code IDs остаются английскими. | `[ ]` |
| DOCS-003 | P1 | OBS | удалить `Typen`: название конфликтует с Typografie и Gebäudetypen. | `[ ]` |
| DOCS-004 | P1 | OBS | `Bewegung` и `Mechaniken` объединить в visible section `Interaktionsmuster`; внутри отдельно документировать interaction behavior и motion. Narrative не заменяет specification. | `[ ]` |
| DOCS-005 | P1 | SPEC | каждая component page содержит: purpose, anatomy, when to use, when not to use, variants, props, states, events, keyboard, screen reader, responsive, content rules, data contract, examples, anti-patterns, testing и changelog. | `[ ]` |
| DOCS-006 | P1 | OBS | narrative titles вроде `Der Moment`, `die Reise`, `das Nachspiel`, `der Mensch entscheidet`, `Lernender Loader` оставить только subtitle. Canonical component names должны быть стабильными и пригодными для code search. | `[ ]` |
| DOCS-007 | P1 | OBS | `DC-xx`, `G6`, `S1`, `P1–P5` не показывать в product-facing headings. В docs они допустимы только как metadata/code badges. | `[ ]` |
| DOCS-008 | P1 | SPEC | каждому component назначить owner, maturity (`experimental/beta/stable/deprecated`), version, last review, Figma parity и code parity. | `[ ]` |
| DOCS-009 | P1 | SPEC | внедрить semantic versioning, deprecation window, migration notes и release changelog. | `[ ]` |
| DOCS-010 | P1 | OBS | claims `47 Domänen-Komponenten` и `provisorische Werte gekennzeichnet` генерировать из registry/state, а не хардкодить. | `[ ]` |
| DOCS-011 | P1 | SPEC | каждый specimen имеет synthetic `scenarioId`, project/variant/run labels и purpose. Несвязанные examples не должны повторять одинаковые суммы так, будто это один scenario. | `[ ]` |
| DOCS-012 | P1 | SPEC | добавить edge-case specimens: длинные labels, 1–12 buildings, 3+ sources, unknown areas, negative/zero deltas, stale benchmark, archived variant, permission denied, offline, empty, partial и errors. | `[ ]` |
| DOCS-013 | P2 | OBS | номер заказа шрифта и procurement metadata убрать из UI docs; хранить в закрытом asset register. | `[ ]` |
| DOCS-014 | P2 | SPEC | добавить machine-readable component registry, из которого строятся nav, counts, status и docs index. | `[ ]` |
| DOCS-015 | P2 | SPEC | contribution workflow defines proposer, design/content/a11y/engineering reviewers, breaking-change criteria, release channel and required evidence; unreviewed component variants cannot enter registry. | `[ ]` |
| DOCS-016 | P2 | SPEC | every open design-decision item has owner, deadline, alternatives considered, chosen outcome and ADR link; unresolved decision never masquerades as implementation freedom. | `[ ]` |

_Подраздел «6.1. Documentation architecture»: 16 требований._

#### 6.2. Цвет

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| COLOR-001 | P1 | OBS | внедрить aliases из R-01–R-03. Raw `#FD5E00` не используется внутри component styles; components обращаются только к semantic tokens. | `[~]` (Batch 1) |
| COLOR-002 | P1 | OBS | создать separate semantic roles: `brandAccent`, `actionPrimary`, `selection`, `warning`, `dataChanged`, `dataUncertain`, `deadlineWarning`, `deadlineCritical`; `actionPrimary` и `selection` используют exact values из R-02/R-03. | `[~]` (Batch 1) |
| COLOR-003 | P1 | OBS | `Blue · Info / Fokus` разделить: focus является interaction state, info — content semantics. | `[~]` (Batch 1) |
| COLOR-004 | P1 | OBS | status green и Gantt green разделить. Data visualization palette не должна выглядеть как success/status palette. | `[~]` (Batch 1) |
| COLOR-005 | P1 | SPEC | для каждого status/data-viz color документировать hex, allowed surfaces, text/icon pair, non-text contrast, hover/pressed, print и forced-colors fallback. | `[~]` (Batch 1) |
| COLOR-006 | P1 | OBS | добавить warning semantic color; brand orange не является универсальным warning. | `[~]` (Batch 1) |
| COLOR-007 | P1 | OBS | provenance dots не использовать как единственный cue; нужны text/icon semantics. | `[~]` (Batch 1) |
| COLOR-008 | P1 | OBS | disabled text и helper copy остаются читаемыми. Ключевое недоступное действие должно объяснять причину рядом, а не исчезать в low-contrast state. | `[~]` (Batch 1) |
| COLOR-009 | P1 | SPEC | определить neutral surface/border/text scales: canvas, surface, subtle, selected, overlay, border subtle/default/strong, divider, text primary/secondary/muted/disabled/inverse. | `[~]` (Batch 1) |
| COLOR-010 | P1 | SPEC | проверять contrast во всех combinations, включая selected card на white/grey, focus вокруг orange border, red deadlines и printed grayscale. | `[~]` (Batch 1) |
| COLOR-011 | P2 | SPEC | dark theme явно помечается `Nicht unterstützt in v0.5`; отдельные dark-mode tokens и toggle в v0.5 не создаются. | `[ ]` |

_Подраздел «6.2. Цвет»: 11 требований._

#### 6.3. Типографика и форматирование

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| TYPE-001 | P1 | OBS | убрать универсальную декларацию `Zeilenhöhe 4/3`. Каждому text token назначить собственные size/line-height/weight. | `[~]` (Batch 1) |
| TYPE-002 | P1 | OBS | применить exact role/weight/line-height matrix из R-24. Body/small/table body используют Regular; Medium используется для labels/table headers/status badges; Bold — для display/headings. | `[ ]` |
| TYPE-003 | P1 | SPEC | определить роли: display number, H1/H2/H3, body, small, supplementary caption, button, input, label, helper, error, link, tooltip, kbd, status badge, metadata badge, table header, table number, delta. | `[~]` (Batch 1) |
| TYPE-004 | P1 | OBS | critical source/scope/assumption copy не использовать как 12 px caption. Она должна быть читаема как body/small и присутствовать в export. | `[ ]` |
| TYPE-005 | P1 | OBS | запретить ручные агрессивные переносы UI-терминов (`Mehrfamilien-häuser`, `Verwaltungsge-bäude`). Использовать достаточную width, natural wrapping и responsive column reduction. | `[ ]` |
| TYPE-006 | P1 | SPEC | numeric styles используют tabular lining numerals; columns выравниваются по правому краю и decimal separator. | `[ ]` |
| TYPE-007 | P1 | SPEC | formatter управляет thousands, decimals, signs, currency, units, ranges и plurals; форматированные strings не хардкодятся. | `[ ]` |
| TYPE-008 | P1 | SPEC | display scale адаптивна; крупная сумма не выталкивает rate/duration и не обрезается при 200% text zoom. | `[ ]` |
| TYPE-009 | P1 | SPEC | font fallback stack metric-compatible; loading не вызывает существенный layout shift. | `[ ]` |
| TYPE-010 | P1 | OBS | delta повторяет unit в accessible name и export: `−315 €/m² WFL`, а не `−315` без context. | `[ ]` |
| TYPE-011 | P1 | OBS | workflow/error/blocker/status tags используют `14/20 Medium`; `12/16` разрешён только для noncritical metadata badge. Padding, wrap policy и minimum hit area определены отдельно. | `[ ]` |
| TYPE-012 | P1 | SPEC | pseudo-localization проверяет минимум +35% expansion для German/English/French/Italian/Spanish. | `[ ]` |
| TYPE-013 | P2 | OBS | использовать одну систему немецких кавычек во всём UI/export. | `[ ]` |
| TYPE-014 | P2 | SPEC | primary/fallback fonts проходят glyph-coverage test для всех supported locales, `€`, `²`, математических знаков, стрелок и DIN/technical abbreviations; missing glyph/tofu блокирует locale release. | `[ ]` |

_Подраздел «6.3. Типографика и форматирование»: 14 требований._

#### 6.4. Spacing, grid, density и responsive foundations

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| LAYOUT-001 | P1 | OBS | spacing scale `4, 8, 12, 16, 24, 32, 48, 64` остаётся base scale; semantic aliases обязательны. | `[~]` (Batch 1) |
| LAYOUT-002 | P1 | OBS | правило `Werte außerhalb der Skala sind verboten` относится только к layout spacing. Border widths, icon geometry, optical offsets и typography metrics используют отдельные sanctioned tokens. | `[ ]` |
| LAYOUT-003 | P1 | SPEC | docs/workspace content container max-width `1200 px`; outer gutter `16 px` below `768 px`, `24 px` from `768` to `1199 px`, `32 px` at `1200 px+`; body text measure `≤75ch`; data tables may use full container width. Component breakpoints derive from documented minimum widths. | `[~]` (Batch 1) |
| LAYOUT-004 | P1 | OBS | убрать нестабильный hero layout: price/rate/duration используют единый `KeyMetricsGrid` и предсказуемый priority order. | `[ ]` |
| LAYOUT-005 | P1 | OBS | сократить вложенные рамки. Border используется только для meaningful group/interaction boundary; spacing и headings создают остальную структуру. | `[ ]` |
| LAYOUT-006 | P1 | OBS | длинные footnotes ограничить readable measure; critical caveat поднять из footnote в основной flow. | `[ ]` |
| LAYOUT-007 | P1 | SPEC | `comfortable` и `compact` являются density preferences. Они не меняют semantics, permissions или output profile. | `[~]` (Batch 1) |
| LAYOUT-008 | P1 | OBS | density toggle показывает current state и destination: `Komfortabel` / `Kompakt`, а не `Kompakt umschalten`. | `[ ]` |
| LAYOUT-009 | P1 | SPEC | compact mode не уменьшает All3 hit-area policy и не скрывает labels/actions. | `[ ]` |
| LAYOUT-010 | P1 | OBS | clickable card с внутренней CTA не создаёт nested interactive controls. Card destination и secondary action имеют отдельные, валидные focus stops. | `[ ]` |
| LAYOUT-011 | P1 | OBS | whole-row disclosure получает отдельный caret button; row click не перехватывает text selection и cell actions. | `[ ]` |
| LAYOUT-012 | P1 | OBS | chapter stepper не оставляет пустую область: current-step content всегда занимает adjacent main panel; contextual summary является optional secondary block и не заменяет main content. | `[ ]` |
| LAYOUT-013 | P2 | SPEC | reference viewports для visual regression: 320, 375, 768, 1024, 1440 и wide desktop. Это test fixtures, не обязательные CSS breakpoint values. | `[ ]` |

_Подраздел «6.4. Spacing, grid, density и responsive foundations»: 13 требований._

#### 6.5. Iconography, borders и layers

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| ICON-001 | P1 | OBS | определить icon sizes, viewBox grid, stroke/fill family, optical alignment и selected/disabled treatment. Разные building icons сейчас выглядят как набор разной плотности. | `[ ]` |
| ICON-002 | P1 | SPEC | decorative icon получает `aria-hidden=true`. Icon рядом с visible text также hidden. Icon-only control имеет programmatic accessible name и visible tooltip; decision-critical meaning дополнительно имеет visible text. | `[ ]` |
| ICON-003 | P1 | OBS | check, info, error, lock, required и selection icons не переиспользуются для разных смыслов без label. | `[ ]` |
| BORDER-001 | P1 | SPEC | зафиксировать border widths и colors для default, selected, focus, warning, error и disclosure. | `[~]` (Batch 1) |
| BORDER-002 | P2 | OBS | square brand geometry сохраняется; отсутствие radius не должно уменьшать hit area или запрещать системные controls. | `[ ]` |
| LAYER-001 | P1 | SPEC | определить z-index/layer model для header, popover, tooltip, dialog, toast и presentation banner. | `[ ]` |
| LAYER-002 | P1 | SPEC | overlay не полагается только на shadow; backdrop, border и focus trapping должны быть формально описаны. | `[ ]` |

_Подраздел «6.5. Iconography, borders и layers»: 7 требований._

#### 6.6. Motion и progress

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| MOTION-001 | P1 | SPEC | purpose-based motion tokens: feedback, reveal, reorder, value change; durations/easings не хардкодятся. | `[~]` (Batch 1) |
| MOTION-002 | P1 | OBS | count-up не скрывает final value. Accessibility tree и copy содержат итог сразу. | `[ ]` |
| MOTION-003 | P1 | SPEC | `prefers-reduced-motion` отключает count-up/sliding/decorative transitions; state change остаётся мгновенным и понятным. | `[ ]` |
| MOTION-004 | P1 | OBS | price recalculation не объясняется только движением. Показываются textual status, old/new delta и journal entry. | `[ ]` |
| MOTION-005 | P1 | SPEC | animation не запускается на каждый slider tick при drag; preview throttled, commit происходит после завершения interaction. | `[ ]` |
| PROGRESS-001 | P1 | OBS | determinate и indeterminate progress не смешиваются. `14 von 16` требует корректного value; неизвестный total использует indeterminate state. | `[ ]` |
| PROGRESS-002 | P1 | SPEC | long-running analysis продолжается в background, переживает navigation/reload и открывается из task center. | `[ ]` |
| PROGRESS-003 | P1 | SPEC | partial results не используются в final offer до успешного gate. | `[ ]` |

_Подраздел «6.6. Motion и progress»: 8 требований._

#### 6.7. State architecture

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| STATE-001 | P1 | OBS | interaction states (`default/hover/focus/pressed/selected/disabled/readOnly`) и data states (`loading/empty/partial/ready/stale/error`) документируются отдельно и могут комбинироваться. | `[ ]` |
| STATE-002 | P1 | OBS | namespaces разделены: workflow, data quality, version lifecycle, delivery, environment, selection/target и severity. | `[ ]` |
| STATE-003 | P1 | OBS | state `ideal` заменить на `ready`; `complete` использовать только для завершённого process, не как оценку качества. | `[ ]` |
| STATE-004 | P1 | SPEC | каждый state machine содержит допустимые transitions, side effects, retry и invalid transitions. | `[ ]` |
| STATE-005 | P1 | OBS | error содержит cause, impact, remedy и retry policy; generic `Fehler`/`nicht lesbar` недостаточны. | `[ ]` |
| STATE-006 | P1 | OBS | disabled reason доступна рядом в reading order; tooltip на disabled control не является решением. | `[ ]` |
| STATE-007 | P1 | OBS | interactive chip/tag визуально и семантически отличается от static status. | `[ ]` |
| STATE-008 | P1 | SPEC | stale/superseded/conflicted/unverified не заменяют друг друга и могут сосуществовать в composable data state. | `[ ]` |
| STATE-009 | P1 | OBS | accuracy zones `±12/±19/±28` запрещены как брендовые thresholds до empirical calibration, owner и inclusive boundary rules. | `[ ]` |
| STATE-010 | P1 | DOMAIN | symmetric `±` range используется только если модель действительно symmetric; иначе показывать asymmetric lower/upper range. | `[ ]` |

_Подраздел «6.7. State architecture»: 10 требований._

#### 6.8. Brand assets

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| BRAND-001 | P1 | SPEC | logo component имеет approved master SVG, clear-space rule, minimum rendered size, monochrome/inverse variants и version owner. | `[ ]` |
| BRAND-002 | P1 | SPEC | logo как home link получает accessible name `All3 Startseite`; decorative wordmark duplicate скрывается от accessibility tree. | `[ ]` |
| BRAND-003 | P1 | SPEC | favicon/app icon/social preview assets versioned; произвольный recolor, stretching и recreation textом запрещены. | `[ ]` |
| BRAND-004 | P2 | SPEC | font/logo license records хранятся в закрытом asset register; public docs показывают только usage status, не procurement identifiers. | `[ ]` |

_Подраздел «6.8. Brand assets»: 4 требований._

**Итого по разделу «Раздел 6 — Foundations и документация дизайн-системы»: 83 требований.**

---

### Раздел 7 — Core component requirements

#### 7.1. Buttons и links

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| BUTTON-001 | P1 | SPEC | every button variant has default, hover, focus, pressed, loading and disabled. Destructive variant существует только для delete/revoke actions; success feedback показывается отдельным status/toast, не как обязательный button state. | `[~]` (Batch 1) |
| BUTTON-002 | P1 | SPEC | loading не меняет width; label описывает процесс; double submit блокируется. | `[ ]` |
| BUTTON-003 | P1 | OBS | disabled primary action не используется для объяснения prerequisite; рядом показывается reason и next action. | `[ ]` |
| BUTTON-004 | P1 | OBS | CTA формируется как verb + object: `Dokumentwert verwenden`, `Termin vorbereiten`, `Angebot prüfen`. | `[ ]` |
| LINK-001 | P1 | OBS | links видимы без hover; dotted underline не является единственным affordance. | `[ ]` |
| LINK-002 | P1 | SPEC | external/download/source links имеют accessible purpose и не меняют context неожиданно. | `[ ]` |

_Подраздел «7.1. Buttons и links»: 6 требований._

#### 7.2. Tabs, segmented controls и radios

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| TABS-001 | P1 | SPEC | tabs используют `tablist/tab/tabpanel`, roving tabindex, Arrow/Home/End, announced selection и stable focus. | `[ ]` |
| TABS-002 | P1 | OBS | tabs применяются только для переключения views. Configuration choices (`EH 55/EH 40`, language for output) используют segmented radio/select. | `[ ]` |
| TABS-003 | P1 | SPEC | tab state синхронизируется с URL/history; switching сохраняет unsaved local form state. | `[ ]` |
| TABS-004 | P1 | SPEC | overflowing tablist остаётся tablist и использует controlled horizontal scroll с start/end buttons; active tab автоматически прокручивается в view. Menu не подменяет Tabs primitive. | `[ ]` |
| RADIO-001 | P1 | SPEC | building/facade cards реализованы как radio group с visible focus, label, description и selected announcement. | `[ ]` |
| RADIO-002 | P1 | SPEC | recommended и selected различаются; recommendation не меняет value автоматически. | `[ ]` |

_Подраздел «7.2. Tabs, segmented controls и radios»: 6 требований._

#### 7.3. Forms, numeric input, slider и textarea

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| FORM-001 | P1 | SPEC | каждый control имеет visible programmatic label, helper/error linkage и required/optional state. | `[ ]` |
| FORM-002 | P1 | SPEC | numeric input принимает locale-aware paste, хранит Decimal, отделяет unit от editable value и не форматирует cursor-destructively. | `[ ]` |
| FORM-003 | P1 | SPEC | validation различает parse error, out-of-range, conflict и server/calculation error. | `[ ]` |
| SLIDER-001 | P1 | OBS | slider всегда сопровождается numeric input, min/max/step, keyboard controls и exact value. | `[ ]` |
| SLIDER-002 | P1 | OBS | square thumb допускается, но hit/focus area соответствует R-04. | `[ ]` |
| TEXTAREA-001 | P1 | OBS | instruction не хранится только в placeholder; placeholder не заменяет label. | `[ ]` |
| TEXTAREA-002 | P1 | SPEC | autosave states и unsaved-change recovery обязательны. | `[ ]` |

_Подраздел «7.3. Forms, numeric input, slider и textarea»: 7 требований._

#### 7.4. Tables и disclosure

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| TABLE-001 | P1 | SPEC | financial tables используют semantic table markup, caption, row/column headers и predictable reading order. | `[ ]` |
| TABLE-002 | P1 | SPEC | numeric columns right-aligned; decimals/tabular numerals; units доступны в header и accessible names. | `[ ]` |
| TABLE-003 | P1 | SPEC | large tables имеют sticky header/first column и controlled horizontal region, но не горизонтальный scroll всей страницы. | `[ ]` |
| TABLE-004 | P1 | OBS | v0.5 uses semantic table plus disclosure buttons and announced hierarchy level. Treegrid is explicitly out of scope. | `[ ]` |
| TABLE-005 | P1 | OBS | `weitere Gruppen ... ausgeblendet` выглядит как доступный disclosure, не disabled row. | `[ ]` |
| TABLE-006 | P1 | OBS | subtotal/total визуально различаются; explanatory suffix не смешивается с number в одной слабоконтрастной строке. | `[ ]` |
| TABLE-007 | P2 | SPEC | sorting/filtering/column priority документированы; live resort не переносит focus. | `[ ]` |

_Подраздел «7.4. Tables и disclosure»: 7 требований._

#### 7.5. Cards, badges, chips и tooltips

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| CARD-001 | P1 | SPEC | card anatomy определяет primary destination, secondary actions, selected state и non-interactive areas. | `[ ]` |
| BADGE-001 | P1 | OBS | badge families разделены по namespaces; badge не выглядит clickable без interaction. | `[ ]` |
| BADGE-002 | P1 | OBS | status не передаётся только цветом; icon и text обязательны для conflict/error/deadline. | `[ ]` |
| CHIP-001 | P1 | OBS | source chips показывают composable provenance и открывают details через explicit button/link affordance. | `[ ]` |
| TOOLTIP-001 | P1 | SPEC | tooltip содержит только supplementary information, открывается hover/focus и tap на explicit info trigger, закрывается Esc/tap outside и не хранит обязательную информацию или action. | `[ ]` |

_Подраздел «7.5. Cards, badges, chips и tooltips»: 5 требований._

#### 7.6. Feedback, toast, dialog и save status

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| FEEDBACK-001 | P1 | SPEC | toast сообщает результат, но не является единственным recovery или carrier критической информации. | `[ ]` |
| FEEDBACK-002 | P1 | SPEC | high-impact confirm dialog показывает old/new, scope, money, schedule и affected outputs; destructive visual semantics только при реальной деструктивности. | `[ ]` |
| SAVE-001 | P1 | OBS | save status имеет states `ungespeichert / wird gespeichert / gespeichert um / offline / Fehler · erneut versuchen`. | `[ ]` |
| SAVE-002 | P1 | SPEC | global save status не утверждает `Gespeichert`, пока authoritative commit/version не подтверждены server-side. | `[ ]` |

_Подраздел «7.6. Feedback, toast, dialog и save status»: 4 требований._

#### 7.7. Keyboard shortcuts

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| KEY-001 | P1 | OBS/SPEC | single-character shortcuts не срабатывают в input/textarea/contenteditable. Settings содержит global toggle `Einzeltasten-Kurzbefehle`; remapping не входит в текущий scope. | `[ ]` |
| KEY-002 | P1 | OBS | Esc закрывает только topmost dismissible layer, а не «каждый overlay». | `[ ]` |
| KEY-003 | P1 | OBS | Arrow keys меняют tab только при focus внутри tablist; Space активирует только focused control и не ломает scroll. | `[ ]` |
| KEY-004 | P1 | SPEC | help открывается по `event.key === '?'` и через visible Help button; displayed shortcut локализован и тестируется на German/English keyboard layouts. | `[ ]` |
| KEY-005 | P1 | SPEC | shortcut help dialog содержит scope, conflicts, enable/disable и standard keys Enter/Home/End/Ctrl\|Cmd+Z/Shift+Tab. | `[ ]` |
| KEY-006 | P1 | OBS/SPEC | `/` регистрируется только если существует видимый labelled search control. Shortcut фокусирует этот control, объявляет его label и не запускается при typing; если search не входит в v0.5, shortcut и строка help удаляются. | `[ ]` |

_Подраздел «7.7. Keyboard shortcuts»: 6 требований._

**Итого по разделу «Раздел 7 — Core component requirements»: 41 требований.**

---

### Раздел 8 — Domain components и flows

#### 8.1. Documentation navigation

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| NAV-001 | P1 | OBS | active section всегда виден и объявлен screen reader. | `[ ]` |
| NAV-002 | P1 | SPEC | sticky nav не перекрывает anchor target; присутствует skip link к main content. | `[ ]` |
| NAV-003 | P1 | SPEC | при viewport `<768 px` documentation navigation сворачивается в labelled menu `Bereiche`; horizontal top-nav scroll не используется. | `[ ]` |
| NAV-004 | P2 | OBS | wording nav соответствует IA из DOCS-002; смешанные German/English section names не использовать без language policy. | `[ ]` |
| NAV-005 | P1 | OBS/SPEC | documentation search имеет видимый input/button, searchable scope и empty/no-results/error states; скрытый shortcut target без visible control запрещён. | `[ ]` |

_Подраздел «8.1. Documentation navigation»: 5 требований._

#### 8.2. Key Metrics / Price Overview

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| METRIC-001 | P1 | OBS | price, rate и duration имеют стабильный priority order и не меняют смысл при переносе строки. | `[ ]` |
| METRIC-002 | P1 | OBS | каждый rate показывает denominator, scope, entity и net/gross: например `2.968 €/m² WFL · Haus A · netto`. | `[ ]` |
| METRIC-003 | P1 | OBS | duration различает planning, execution и total и следует R-26. Whole calendar months показываются integer; otherwise показываются exact calendar/working days. Decimal months запрещены. | `[ ]` |
| METRIC-004 | P1 | OBS | completion date генерируется из ScheduleModel и форматируется по разделу 1.4. | `[ ]` |
| METRIC-005 | P1 | SPEC | change preview показывает delta и Preview Total с prefix `Vorschau ·` до commit; committed headline остаётся visually separate. После commit и completed authoritative recalculation key metric обновляется, получает changed indicator и history link. | `[ ]` |
| METRIC-006 | P1 | OBS | subtitle не перегружается provenance/scope длинной серой строкой; source открывается отдельной affordance. | `[ ]` |
| METRIC-007 | P1 | CALC | per-unit metric маркируется rounded, если `display value × quantity` не равен display total. | `[ ]` |

_Подраздел «8.2. Key Metrics / Price Overview»: 7 требований._

#### 8.3. Cost Breakdown / DIN 276

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| COSTTABLE-001 | P1 | OBS | exact DIN 276 ruleset/version и price basis видимы в details/export. | `[ ]` |
| COSTTABLE-002 | P1 | OBS | percentage header is dynamic: complete summary → `Anteil an Gesamt netto · <Scope>`; incomplete summary → `Anteil an Zwischensumme`. Bare `Anteil` запрещён. | `[ ]` |
| COSTTABLE-003 | P1 | OBS | allocated rows (`rechnerisch verteilt`) отличаются от source-based costs и имеют method/source details. | `[ ]` |
| COSTTABLE-004 | P1 | OBS | CoverageState `onRequest` исключён из summation/percentage denominator и никогда не трактуется как zero. Label/action derive from the current QuoteSelectionEvent and QuoteEvaluation exactly as section 5.4: none → `Auf Anfrage · nicht enthalten` / `Kosten anfragen`; valid → `Preisangabe erfasst · nicht enthalten` / `Preisangabe prüfen`; expired → `Preisangabe abgelaufen · nicht enthalten` / `Neu anfragen`; withdrawn → `Preisangabe zurückgezogen · nicht enthalten` / `Neu anfragen`. Explicit `onRequest` не блокирует Qualified Total при otherwise complete coverage. `unknown` показывает field-specific capture action and always produces Subtotal. | `[ ]` |
| COSTTABLE-005 | P1 | SPEC | expand/collapse all предусмотрен для большой hierarchy; state сохраняется в пределах view. | `[ ]` |
| COSTTABLE-006 | P1 | CALC | parent/child sums, percentages и rounded total проходят reconciliation tests; rounding residual распределяется по формальному правилу. | `[ ]` |
| COSTTABLE-007 | P2 | OBS | capitalization и labels (`KG · DIN 276`, `netto`, `Anteil`) приведены к одному content style. | `[ ]` |
| COSTTABLE-008 | P1 | DOMAIN | missing benchmark/price basis при отсутствии coverage decision оставляет `unknown`; при explicit `included` создаёт unpriced included item. `onRequest` появляется только из explicit CoverageDecisionEvent. Rule `ohne Kennwertbasis immer auf Anfrage` удаляется. | `[ ]` |

_Подраздел «8.3. Cost Breakdown / DIN 276»: 8 требований._

#### 8.4. Cost Drivers

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| DRIVER-001 | P1 | OBS | headline benchmark statement показывает dataset, edition, price basis, region, denominator и exclusions рядом, а не только в footnote. | `[ ]` |
| DRIVER-002 | P1 | OBS | inactive factor отображается как `Nicht berücksichtigt`; `0 €` без status запрещён. | `[ ]` |
| DRIVER-003 | P1 | OBS | potential factor effect показывает application base и formula. | `[ ]` |
| DRIVER-004 | P1 | OBS | positive и negative drivers поддерживаются симметрично; direction не кодируется только sign/color. | `[ ]` |
| DRIVER-005 | P1 | OBS | если документация обещает bars, specimen действительно показывает bars и text alternative. | `[ ]` |
| DRIVER-006 | P1 | OBS | каждая строка открывает calculation detail через explicit button, не invisible row click/dotted underline. | `[ ]` |
| DRIVER-007 | P1 | DOMAIN | base, UG, GK, energy, regional and option CostContributions use unique IDs and reconciled Scope Universe item refs; one contribution cannot enter two totals/drivers, and overlapping allocation creates a blocker. | `[ ]` |
| DRIVER-008 | P2 | OBS | internal sales wording вроде `Verhandlungsanker` исключается из client profiles. | `[ ]` |

_Подраздел «8.4. Cost Drivers»: 8 требований._

#### 8.5. Area Confirmation / Uncertainty

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| AREA-001 | P1 | OBS | exact value не округляется в CTA без маркировки. `1.240,39 m²` и `1.240 m²` не считаются одним confirmed input. | `[ ]` |
| AREA-002 | P1 | OBS | deterministic actions: same-value verbal confirmation → `<Wert> <Einheit> als vom Kunden bestätigt markieren`; different customer value → `Abweichenden Kundenwert erfassen`. Confirmation never changes source origin. | `[ ]` |
| AREA-003 | P1 | OBS | range показывает numeric lower/upper values, method и applies-to value; `−19 % / +19 %` без чисел недостаточно. | `[ ]` |
| AREA-004 | P1 | OBS | uncertainty range не окрашивается как success green. | `[ ]` |
| AREA-005 | P1 | DOMAIN | customer confirmation appends verification event and does not change origin or erase the original derived/document value. Customer replacement creates a new customer-origin ValueRecord. | `[ ]` |
| AREA-006 | P1 | SPEC | after commit dependent outputs переходят stale/recalculating/current с явным status. | `[ ]` |

_Подраздел «8.5. Area Confirmation / Uncertainty»: 6 требований._

#### 8.6. Assumption Card

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| ASSUMP-001 | P1 | OBS | AssumptionCard использует общую ValueRecord/Data Quality model; отдельная несовместимая taxonomy запрещена. | `[ ]` |
| ASSUMP-002 | P1 | OBS | `Δ ±5 %` заменить на `Potenzielle Reduktion der Schätzunsicherheit: 5 Prozentpunkte`, только если model это подтверждает. | `[ ]` |
| ASSUMP-003 | P1 | OBS | action называет поле: `Wohnfläche erfassen`, не `Wert erfassen`. | `[ ]` |
| ASSUMP-004 | P1 | OBS | card перечисляет affected outputs и consequence of unresolved assumption. | `[ ]` |
| ASSUMP-005 | P1 | OBS | left border не является единственным warning/assumption cue. | `[ ]` |
| ASSUMP-006 | P1 | SPEC | assumption имеет owner, source expected, due date, resolution options и history. | `[ ]` |

_Подраздел «8.6. Assumption Card»: 6 требований._

#### 8.7. Readiness & Next Step

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| READY-001 | P1 | OBS | удалить ring `82 %`; заменить checklist `4/5 Pflichtangaben`, blockers и warnings. | `[ ]` |
| READY-002 | P1 | OBS | `TO-Abdeckung`, `Zone` и другие неутверждённые abbreviations удалить из production UI; вернуть их можно только после glossary entry с exact expansion и definition. | `[ ]` |
| READY-003 | P1 | OBS | next step показывает reason, expected uncertainty/risk effect и affected output, но не обещает недоказанную точную delta. | `[ ]` |
| READY-004 | P1 | OBS | `Frage senden` открывает recipient/channel/draft review, а не отправляет одним click. | `[ ]` |
| READY-005 | P1 | DOMAIN | readiness считается отдельно для meeting, client view, PDF и e-mail; один global score запрещён. | `[ ]` |
| READY-006 | P2 | OBS | wording ориентирован на качество решения, а не gamification/score maximization. | `[ ]` |

_Подраздел «8.7. Readiness & Next Step»: 6 требований._

#### 8.8. Change Preview / Journal / Undo

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| CHANGE-001 | P1 | DOMAIN | severity определяется policy: low (local view), medium (calculation input), high (scope/offer/output/compliance). | `[ ]` |
| CHANGE-002 | P1 | OBS | diff показывает old/new, absolute delta, scope items, options, Schnittstellen и schedule. Relative delta показывается только при non-zero baseline; при baseline `0` UI пишет `relative Änderung nicht definiert`. | `[ ]` |
| CHANGE-003 | P1 | OBS | `5 Zeilen → AG` раскрывает meaning of AG и конкретные rows; opaque counts недостаточны. | `[ ]` |
| CHANGE-004 | P1 | SPEC | Preview freezes one exact ConfigurationDraft Revision into an immutable ConfigurationProposal plus matching preview Run and never mutates the authoritative model. At most one ProposalCommitEvent exists per Proposal. `appendToBaseVariant` requires unchanged base snapshot and current head; `createNewVariant` requires unchanged base snapshot but may branch from a stale head. Repeated identical commit returns the same event/version; another mode or payload is rejected. Created Proposal/VariantVersion calculation-input hashes are equal. | `[ ]` |
| CHANGE-005 | P1 | SPEC | journal event ссылается на affected Calculation Runs/outputs и показывает invalidation. | `[ ]` |
| CHANGE-006 | P1 | SPEC | rollback available from history. При concurrent newer head v0.5 запрещает automatic merge/overwrite и предлагает только `Als neue Variante speichern`, создавая новую Variant branch из stale editor base. | `[ ]` |
| CHANGE-007 | P1 | SPEC | screen reader получает короткое polite announcement после commit, без перечитывания whole page. | `[ ]` |
| CHANGE-008 | P1 | CALC | proposed/committed change reuses one ImpactSnapshot only when ProposalCommitEvent proves the same proposal hash, equal Proposal/VariantVersion calculation-input hashes and identical full Impact Context; full audit-record hashes may differ. Otherwise views show different endpoint/context IDs. | `[ ]` |
| CHANGE-009 | P1 | CALC | session count/delta генерируются из committed journal events, показывают baseline/head versions и раскрываются в exact itemized reconciliation. | `[ ]` |

_Подраздел «8.8. Change Preview / Journal / Undo»: 9 требований._

#### 8.9. Discount Control / Margin Guard

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| DISCOUNT-001 | P1 | OBS | рядом со slider показаны percentage, exact discount amount, exact/rounded final price и tax basis (`netto`/`brutto`). Если displayed amount округлён, применяется единый rounding disclosure из CALC-007. | `[ ]` |
| DISCOUNT-002 | P1 | OBS | margin floor и approval threshold объяснены текстом; green dot без label запрещён. | `[ ]` |
| DISCOUNT-003 | P1 | DOMAIN | discount applies-to base и rounding order формально определены; taxes/options исключения видимы. | `[ ]` |
| DISCOUNT-004 | P1 | SPEC | crossing threshold запускает approval workflow с approver/status; value не silently commits. | `[ ]` |
| DISCOUNT-005 | P1 | SPEC | preview updates during drag; commit происходит on release/Enter и создаёт journal event. | `[ ]` |
| DISCOUNT-006 | P1 | DOMAIN | margin data доступна только authorized internal roles и отсутствует во всех client profiles. | `[ ]` |

_Подраздел «8.9. Discount Control / Margin Guard»: 6 требований._

#### 8.10. Client Output Gate and client modes

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| GATE-001 | P1 | OBS | source button `Präsentationsmodus starten` переименовать `Kundenansicht prüfen`; он открывает preflight, а не сразу переключает view. | `[ ]` |
| GATE-002 | P1 | OBS | preflight показывает blockers, warnings, passed checks, last run, locale completeness и stale outputs. | `[ ]` |
| GATE-003 | P1 | SPEC | Client Read-only View имеет persistent text/icon indicator и explicit exit. | `[ ]` |
| GATE-004 | P1 | SPEC | Client Live Configuration имеет отдельный persistent indicator и restricted action allowlist. Preview zone всегда помечена `Vorschau · noch nicht übernommen`; committed summary remains authoritative, and export/send/print are disabled until explicit commit and completed authoritative recalculation. | `[ ]` |
| GATE-005 | P1 | SPEC | switching mode не сбрасывает focus/context и объявляется assistive technology. | `[ ]` |
| GATE-006 | P1 | SPEC | mode entry/exit и output generation создают audit event. | `[ ]` |
| GATE-007 | P1 | OBS | слово `neutral` удалить; оно не описывает visibility/security policy. | `[ ]` |
| GATE-008 | P1 | SPEC | client tooltip/popover содержит только client-safe content и работает click/focus/touch. | `[ ]` |

_Подраздел «8.10. Client Output Gate and client modes»: 8 требований._

#### 8.11. Conflict Resolver

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| CONFLICT-002 | P1 | OBS | actions: `Dokumentwert verwenden`, `Manuellen Wert beibehalten`, `Später entscheiden`; generic `Übernehmen/Behalten` удалить. | `[ ]` |
| CONFLICT-003 | P1 | OBS | показывать absolute/relative delta и same unit/precision. | `[ ]` |
| CONFLICT-004 | P1 | OBS | source cards содержат human source title, document version/page, actor/role и unambiguous timestamp. | `[ ]` |
| CONFLICT-005 | P1 | OBS | downstream impact показывает rates, totals, schedule, variants и stale outputs. | `[ ]` |
| CONFLICT-006 | P1 | SPEC | поддержать 3+ sources grouped by exact normalized value. Merge разрешён только для disjoint fields; two values for the same field require authoritative choice and cannot be merged. | `[ ]` |
| CONFLICT-007 | P1 | SPEC | unresolved conflict blocks dependent output according to severity policy; user может продолжить unrelated work. | `[ ]` |
| CONFLICT-008 | P1 | OBS | red border сопровождается status text/icon и не является единственным cue. | `[ ]` |

_Подраздел «8.11. Conflict Resolver»: 7 требований._

#### 8.12. Meeting Summary / Follow-up

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| SUMMARY-001 | P1 | OBS | разделить confirmed decisions, changes, open questions, blockers и warnings. Green check у open question запрещён. | `[ ]` |
| SUMMARY-002 | P1 | OBS | показать participants, owner, absolute timestamp/timezone и linked variant/run. | `[ ]` |
| SUMMARY-003 | P1 | OBS | каждое change line ведёт к journal/source; total delta имеет scope и rounding. | `[ ]` |
| SUMMARY-004 | P1 | DOMAIN | internal notes и client-safe summary хранятся отдельными fields/output policies. | `[ ]` |
| SUMMARY-005 | P1 | SPEC | e-mail draft создаётся из snapshot summary, но body всегда review/edit до send. | `[ ]` |
| SUMMARY-006 | P2 | OBS | `das Nachspiel` оставить docs subtitle; exact production heading: `Termin-Zusammenfassung`. | `[ ]` |

_Подраздел «8.12. Meeting Summary / Follow-up»: 6 требований._

#### 8.13. Skeleton

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| SKELETON-001 | P1 | SPEC | skeleton скрыт от screen reader; region имеет `aria-busy` и stable dimensions. | `[ ]` |
| SKELETON-002 | P1 | SPEC | timeout/error приводит к retry/recovery, не к вечному skeleton. | `[ ]` |
| SKELETON-003 | P1 | SPEC | skeleton используется только для initial page/card load with known final geometry. Максимум через `2 s` он заменяется content, error либо labelled loading/progress state; document analysis always uses Progress component. | `[ ]` |
| SKELETON-004 | P2 | OBS | правило no-shimmer сохранить; оно не отменяет reduced-motion requirement для других animations. | `[ ]` |

_Подраздел «8.13. Skeleton»: 4 требований._

#### 8.14. Building Type Selector

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| BUILDING-001 | P1 | DOMAIN | заменить `Gebäudetyp wählen` на coordinated controls: `Gebäudeform` at Building; `Nutzungsart`, `Belegungs-/Barrierefreiheitsprofil` and `Benchmarkprofil` at Usage Segment, exactly as R-13. | `[~]` (Batch 1a) |
| BUILDING-002 | P1 | OBS | hardcoded `Gewerbe im EG`, `barrierefrei`, `Gemeinschaftsflächen` не входят в type label; это отдельные structured fields. | `[~]` (Batch 1a) |
| BUILDING-003 | P1 | OBS | before commit показывать diff benchmark, denominator, options, assumptions и existing outputs. | `[~]` (Batch 1a) |
| BUILDING-004 | P1 | OBS | context header показывает, для какого Building/Segment выполняется выбор. | `[~]` (Batch 1a) |
| BUILDING-005 | P1 | OBS | `All3-Empirie n = 16` показывает cohort filters, date, distribution, range, owner и suitability; маленькая выборка не называется universal benchmark. | `[~]` (Batch 1a) |
| BUILDING-006 | P1 | OBS | `Optionsprofil: 12 Gruppen` заменить на readable impact summary и link to profile. | `[~]` (Batch 1a) |
| BUILDING-007 | P1 | SPEC | states: unselected, selected, recommended, inherited, disabled-with-reason, conflict, recalculating. | `[~]` (Batch 1a) |
| BUILDING-008 | P1 | OBS | card widths/word wrapping исправить; German compound не режется на 3–4 строки без necessity. | `[~]` (Batch 1a) |
| BUILDING-009 | P2 | OBS | taxonomy/labels проходят German spellcheck и domain review; спорная категория `Doppel-/Reihenendhäuser` не публикуется без определения. | `[~]` (Batch 1a) |

_Подраздел «8.14. Building Type Selector»: 9 требований._

#### 8.15. Building Complex / Building Switch

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| COMPLEX-001 | P1 | OBS | `Gesamt · 2 Gebäude`, Haus A и Haus B показывают scope persistently; current context не теряется after scroll. | `[~]` (Batch 1a) |
| COMPLEX-002 | P1 | DOMAIN | switch changes view context, not entity data. Type/options edit applies only to current Building/Segment. | `[~]` (Batch 1a) |
| COMPLEX-003 | P1 | OBS | total row `gemischt` заменить generated use summary: localized unique Use Class labels сортируются по Building order и соединяются ` + `, например `Wohnen + Büro`; count `2 Gebäude` остаётся отдельным field. | `[~]` (Batch 1a) |
| COMPLEX-004 | P1 | OBS | combined WFL+NUF metric удалить из v0.5 по R-11. Complex summary показывает total cost, BGF comparison basis и separate rates per Usage Segment. | `[~]` (Batch 1a) |
| COMPLEX-005 | P1 | OBS | building duration и complex total duration labels различаются. | `[~]` (Batch 1a) |
| COMPLEX-006 | P1 | OBS | each segment rate appears once in the primary summary table; duplicate standalone metric blocks are removed. | `[~]` (Batch 1a) |
| COMPLEX-007 | P1 | SPEC | 1–12 buildings, long/custom names и keyboard navigation supported. | `[~]` (Batch 1a) |
| COMPLEX-008 | P2 | OBS | в current `BuildingSwitch` icons удалить; context задаётся text labels `Gesamt`, `Haus A`, `Haus B`. Building Form icons остаются только в typed Building Form selector. | `[~]` (Batch 1a) |

_Подраздел «8.15. Building Complex / Building Switch»: 8 требований._

#### 8.16. Option Tiles

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| OPTION-001 | P1 | OBS | Option Tile = one OptionSelection + matching OptionEvaluation (same Run) + discriminated OptionUiState; source defines an exhaustive, mutually-exclusive label for every dirty/previewPending/previewReady/authoritativePending/authoritativeReady combination crossed with mandatory/optional/priced/unpriced/unavailable/incompatible state (e.g. `Vorgeschlagen · +<Preis> · noch nicht übernommen`, `Im Angebot · +<Preis>`, `Pflicht fehlt`); full label matrix — see source §8.16. | `[ ]` |
| OPTION-002 | P1 | OBS | orange check обозначает `selected`; lock обозначает `mandatory`; text badge обозначает pricing/calculation status. Green check и generic greyed card удаляются как неоднозначные. | `[ ]` |
| OPTION-003 | P1 | OBS | price qualifier включает net/gross, price type, quantity/unit, source, validity и affected entity. | `[ ]` |
| OPTION-004 | P1 | OBS | dependencies/conflicts видимы до selection; `GK 5 erforderlich` является constraint, а не caption. | `[ ]` |
| OPTION-005 | P1 | OBS | mandatory included option выглядит locked/required, не disabled. | `[ ]` |
| OPTION-006 | P1 | SPEC | non-binary options поддерживают quantity/configuration и validation. | `[ ]` |
| OPTION-007 | P1 | SPEC | selection проходит preview при medium/high impact; pending recalculation и committed states различаются. | `[ ]` |
| OPTION-008 | P1 | SPEC | binary additive option использует checkbox-card semantics; mutually exclusive options use radio-card group; switch semantics для Option Tile запрещена. Details action отдельна. | `[ ]` |
| OPTION-009 | P1 | OBS | price/impact доступен touch/focus; hover не требуется. | `[ ]` |
| OPTION-010 | P2 | OBS | title wrapping и card heights не создают visual ranking по длине слова. | `[ ]` |
| OPTION-011 | P1 | CALC | UG/TG/PV base and option contributions expose included Scope Universe item refs and CostContribution IDs; overlap or unassigned surcharge blocks calculation. | `[ ]` |

_Подраздел «8.16. Option Tiles»: 11 требований._

#### 8.17. Variant Comparison

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| VARIANT-002 | P1 | OBS | header явно показывает `Vergleichsbasis`, `Zielangebot`, `Aktuell bearbeitet`, `Empfohlen` отдельными badges. | `[ ]` |
| VARIANT-003 | P1 | OBS | `nur Unterschiede` дополняется common-scope summary и toggle `Alle Merkmale`; shared exclusions/assumptions не скрываются полностью. | `[ ]` |
| VARIANT-004 | P1 | OBS | delta написана human-readable: `391.000 € günstiger`, `315 €/m² WFL niedriger`. | `[ ]` |
| VARIANT-005 | P1 | OBS | date delta называет exact unit from ScheduleModel: `46 Kalendertage früher` for calendar-day model или `<n> Arbeitstage gemäß <Kalender>` for working-day model; unit никогда не опускается. | `[ ]` |
| VARIANT-006 | P1 | DOMAIN | rates сравниваются только при compatible denominators; иначе row показывает `nicht vergleichbar` и оба denominators. | `[ ]` |
| VARIANT-007 | P1 | OBS | variant header показывает version, updatedAt, owner, stale/conflict state и run ID. | `[ ]` |
| VARIANT-008 | P1 | SPEC | 4+ variants поддерживают pin baseline, add/remove/reorder и controlled horizontal scroll with sticky row labels. | `[ ]` |
| VARIANT-009 | P1 | SPEC | accessible data table, linear reading order и announced deltas обязательны. | `[ ]` |
| VARIANT-010 | P1 | OBS | exact copy by context: variant name `Ohne UG`; comparison row `Untergeschoss: nicht Bestandteil`; scope detail `UG nicht Bestandteil des All3-Leistungsumfangs`. `keins` запрещено. | `[ ]` |
| VARIANT-011 | P1 | DOMAIN | ConfigurationVariant `displayName` используется только для navigation. Header/details показывают generated summary pinned VariantVersion; если name устарел, UI показывает warning and rename action. EH 40 и no-UG могут комбинироваться в одном snapshot. | `[ ]` |
| VARIANT-012 | P1 | SPEC | export сохраняет common scope, units, provenance, roles и calculation versions. | `[ ]` |

_Подраздел «8.17. Variant Comparison»: 11 требований._

#### 8.18. Chapter / Workflow Stepper

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| STEP-001 | P1 | OBS | canonical name `Workflow Stepper`; `Kapitel` допустимо только как content label. | `[ ]` |
| STEP-002 | P1 | OBS | показывать `Schritt 3 von 5`, completed/current/upcoming/skipped/blocked/error с text states. | `[ ]` |
| STEP-003 | P1 | OBS | `Sprünge erlaubt` означает просмотр allowed; dependent output остаётся blocked при missing prerequisites. | `[ ]` |
| STEP-004 | P1 | OBS | upcoming items не выглядят disabled, если clickable. | `[ ]` |
| STEP-005 | P1 | SPEC | sticky price/context реально реализованы, а не декларированы рядом. | `[ ]` |
| STEP-006 | P1 | SPEC | deep link/back/forward сохраняют data, scroll и validation; current step announced. | `[ ]` |
| STEP-007 | P1 | SPEC | mobile version: `Schritt n von m` + accessible menu, без потери names/status. | `[ ]` |

_Подраздел «8.18. Chapter / Workflow Stepper»: 7 требований._

#### 8.19. Open Questions / Impact Ranking

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| QUESTION-001 | P1 | OBS | rows имеют actions: answer, send, assign document, not relevant, later. | `[ ]` |
| QUESTION-002 | P1 | OBS | states: open, sent, answered, blocked, overdue, not relevant, contradictory. | `[ ]` |
| QUESTION-003 | P1 | OBS | owner, expected source, recipient и deadline visible. | `[ ]` |
| QUESTION-004 | P1 | OBS | affected outputs visible: WFL, KG, schedule, readiness profile. | `[ ]` |
| QUESTION-005 | P1 | DOMAIN | impact explains model version and correlation; dependent questions grouped to prevent double count. | `[ ]` |
| QUESTION-006 | P1 | SPEC | answer stores before/after ValueRecords, delta and history link. | `[ ]` |
| QUESTION-007 | P1 | SPEC | live resort does not move focus; user receives stable row identity. | `[ ]` |
| QUESTION-008 | P2 | OBS | headline states current uncertainty and achievable modeled range, not marketing promise. | `[ ]` |

_Подраздел «8.19. Open Questions / Impact Ranking»: 8 требований._

#### 8.20. Document Analysis Progress

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| ANALYSIS-001 | P1 | OBS | canonical name `Dokumentanalyse`; `Lernender Loader` and `Fortschrittslüge` only docs narrative. | `[ ]` |
| ANALYSIS-002 | P1 | OBS | completed steps use completed tense; active step uses present progressive; total progress matches stage model. | `[ ]` |
| ANALYSIS-003 | P1 | SPEC | every analysis stage has `cancelPolicy`. `cancellable` exposes Cancel and safe resume; `nonCancellable` omits Cancel and shows reason. Retry operates per failed file/stage. | `[ ]` |
| ANALYSIS-004 | P1 | SPEC | each stage records start/end, parser/rules version, error and partial outputs. | `[ ]` |
| ANALYSIS-005 | P1 | SPEC | one unreadable file does not discard successful results from others. | `[ ]` |
| ANALYSIS-006 | P1 | SPEC | screen reader receives sparse meaningful updates, not every log line. | `[ ]` |
| ANALYSIS-007 | P1 | SPEC | progress and results persist through reload/navigation and are visible in project/task history. | `[ ]` |

_Подраздел «8.20. Document Analysis Progress»: 7 требований._

#### 8.21. Facade / Render Selector

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| FACADE-002 | P1 | OBS | every tile compares the same attributes. `Kombination · Sockel dunkel` cannot replace roof attribute used by other tiles. | `[ ]` |
| FACADE-003 | P1 | OBS | Material, facade system, orientation/pattern, Farbwelt, roof, plinth, window system and render asset are structured fields. | `[ ]` |
| FACADE-004 | P1 | OBS | placeholder silhouettes replaced with project-specific thumbnails using consistent camera/lighting and larger preview. | `[ ]` |
| FACADE-005 | P1 | OBS | без current preview action называется `Vorschau erzeugen`; после successful current render — `Am Gebäude ansehen`. Selection сама по себе не меняет render status. | `[ ]` |
| FACADE-006 | P1 | OBS | `calculation-affecting` choice показывает cost/time/maintenance/technical impact; `visual-only` choice показывает exact label `Nur Visualisierung · keine Kalkulationswirkung`. | `[ ]` |
| FACADE-007 | P1 | SPEC | states: undecided, standard, selected, recommended, custom, uploaded reference, stale asset. | `[ ]` |
| FACADE-008 | P1 | SPEC | asset metadata: source, version, rights, generatedAt, aspect ratio and stale status. | `[ ]` |
| FACADE-009 | P1 | SPEC | visual description/alt does not rely solely on thumbnail. | `[ ]` |
| FACADE-010 | P2 | OBS | selected chips show structured values and do not merely repeat title. | `[ ]` |

_Подраздел «8.21. Facade / Render Selector»: 9 требований._

#### 8.22. Source / Provenance UI

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| PROVENANCE-001 | P1 | OBS | displayed layers: source, derivation, verification, conflict and freshness; not one mutually exclusive color list. | `[ ]` |
| PROVENANCE-002 | P1 | OBS | document source opens exact version/page/region; manual/customer/CRM source opens actor/role, timestamp and context. | `[ ]` |
| PROVENANCE-003 | P1 | OBS | ambiguous dates like `12-08` prohibited; use absolute locale date/time. | `[ ]` |
| PROVENANCE-004 | P1 | OBS | derived value shows formula/rule version, inputs and applicability. | `[ ]` |
| PROVENANCE-005 | P1 | OBS | stale/superseded state visible next to value and invalidates dependent output. | `[ ]` |
| PROVENANCE-006 | P1 | SPEC | long source labels use accessible details/popover without truncating critical identity. | `[ ]` |
| PROVENANCE-007 | P1 | DOMAIN | client wording may simplify source details but cannot change verification/conflict truth. | `[ ]` |

_Подраздел «8.22. Source / Provenance UI»: 7 требований._

#### 8.23. Project Queue Cards

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| PROJECT-001 | P1 | OBS | current sort/filter and rationale visible: deadline, risk, owner or next action. | `[ ]` |
| PROJECT-002 | P1 | OBS | urgency has text/icon (`morgen`, `überfällig`, `blockiert`), absolute date/time and IANA timezone in details. | `[ ]` |
| PROJECT-003 | P1 | OBS | CTA specific: `Termin vorbereiten`, `Analyse starten`; generic `Vorbereiten` removed. | `[ ]` |
| PROJECT-004 | P1 | OBS | uncertainty labelled and linked to range/details; not just `±19 %` badge. | `[ ]` |
| PROJECT-005 | P1 | OBS | Comfortable card shows owner, last activity and blocker summary inline. Compact card keeps owner and blocker count visible; exact last activity is inside an explicit disclosure. When collapsed, the disclosure button accessible name states that last-activity details are available; hidden panel content is correctly removed from reading/focus order until expanded. | `[ ]` |
| PROJECT-006 | P1 | SPEC | states: loading, empty, error, no permission, archived, stale analysis. | `[ ]` |
| PROJECT-007 | P1 | SPEC | whole-card destination and secondary action follow CARD-001; responsive keeps title/deadline/action intact. | `[ ]` |
| PROJECT-008 | P2 | OBS | red used only for policy-defined severity, not generic visual priority. | `[ ]` |

_Подраздел «8.23. Project Queue Cards»: 8 требований._

#### 8.24. Document Rows / Version Status

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| DOCUMENT-001 | P1 | OBS | group versions under logical DocumentRecord; flat unrelated filenames prohibited. | `[ ]` |
| DOCUMENT-002 | P1 | OBS | human-readable title primary; raw filename secondary. | `[ ]` |
| DOCUMENT-003 | P1 | OBS | `aktiv` becomes `Aktuelle Version · V2 von 2`; superseded row states replacement, dates and reason. | `[ ]` |
| DOCUMENT-004 | P1 | OBS | `nicht lesbar` shows cause and remedies: retry, replace, better scan, manual capture. | `[ ]` |
| DOCUMENT-005 | P1 | OBS | columns/list headers for title, pages, version, analysis and actions. | `[ ]` |
| DOCUMENT-006 | P1 | SPEC | file icon/status/action have accessible names and All3 hit area. | `[ ]` |
| DOCUMENT-007 | P1 | OBS | version history opened by explicit disclosure/button, not dotted text. | `[ ]` |
| DOCUMENT-008 | P1 | SPEC | metadata includes uploader/source, upload time, file size, hash and parser/rules version. | `[ ]` |
| DOCUMENT-009 | P1 | SPEC | reanalysis has queued/running/succeeded/failed and double-start prevention. | `[ ]` |
| DOCUMENT-010 | P1 | DOMAIN | upload security/retention/access policy documented; raw client filename is not exposed in client outputs. | `[ ]` |

_Подраздел «8.24. Document Rows / Version Status»: 10 требований._

#### 8.25. Schedule / Gantt

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| GANTT-001 | P1 | OBS | axis label uses the actual epoch, never slash placeholder: `Projektmonate ab Planungsbeginn` or `Projektmonate ab OKBP`; each tick maps to an exact date. `Projektmonat` is a visual bucket, not the duration unit defined by R-26. | `[ ]` |
| GANTT-002 | P1 | OBS | bars carry text/pattern labels; color legend is secondary. | `[ ]` |
| GANTT-003 | P1 | SPEC | accessible table alternative lists phase, entity, start/end, duration and dependencies. | `[ ]` |
| GANTT-004 | P1 | OBS | exact milestone date shown alongside `Monat 13`. | `[ ]` |
| GANTT-005 | P1 | OBS | Staffelstart, buffers, dependencies and critical path explained in details. | `[ ]` |
| GANTT-006 | P1 | SPEC | provenance includes assumptions, calendar, ruleset and last recalculation. | `[ ]` |
| GANTT-007 | P1 | SPEC | interactive bars receive focus/details; static bars are not placed in tab order. | `[ ]` |
| GANTT-008 | P1 | SPEC | responsive/print uses controlled timeline region with fixed row labels and monochrome fallback. | `[ ]` |

_Подраздел «8.25. Schedule / Gantt»: 8 требований._

#### 8.26. State Specimens / Status Tags / Accuracy Zones

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| SPECIMEN-001 | P1 | OBS | docs specimen must demonstrate every claimed rule. `Fokus immer sichtbar`, `Disabled erklärt sich`, `Fehler nennen die Abhilfe` require visible examples. | `[ ]` |
| SPECIMEN-002 | P1 | OBS | decorative unlabelled square удаляется. Real checkbox получает visible label и programmatic association. | `[ ]` |
| SPECIMEN-003 | P1 | OBS | disabled Export shows exact prerequisite and next step. | `[ ]` |
| SPECIMEN-004 | P1 | OBS | `loading/empty/error/partial/ready` shown separately from button states. | `[ ]` |
| SPECIMEN-005 | P1 | OBS | status namespaces displayed in separate groups with legends. | `[ ]` |
| SPECIMEN-006 | P1 | SPEC | contrast for replaced/disabled/helper/status text tested and recorded. | `[ ]` |
| SPECIMEN-007 | P1 | DOMAIN | zone label `nicht präsentationsreif` includes blockers/actions; threshold alone insufficient. | `[ ]` |

_Подраздел «8.26. State Specimens / Status Tags / Accuracy Zones»: 7 требований._

#### 8.27. Language & Localization

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| LOCALE-002 | P1 | DOMAIN | separate user UI locale, source-document language, project language, client-view locale, PDF locale and e-mail locale. | `[ ]` |
| LOCALE-003 | P1 | OBS | `…` is not an unnamed language tab; use `Weitere Sprachen` menu. | `[ ]` |
| LOCALE-004 | P1 | OBS | 2–3 available output locales use segmented radio; 4+ use labelled select/menu `Sprache`; Tabs применяются только для simultaneous parallel preview panels. | `[ ]` |
| LOCALE-005 | P1 | SPEC | Intl formatting covers numbers, currency, dates, timezones, units, plural and ranges. | `[ ]` |
| LOCALE-006 | P1 | SPEC | user preference and per-output locale stored separately. | `[ ]` |
| LOCALE-007 | P1 | OBS | show translation completeness, last review, content version and legal approval. | `[ ]` |
| LOCALE-008 | P1 | SPEC | selecting English changes complete preview; mixed-language output fails automated test. | `[ ]` |
| LOCALE-009 | P1 | DOMAIN | approved glossary protects BGF/WFL/NUF/OKBP/EH and legal-commercial copy. | `[ ]` |
| LOCALE-010 | P2 | OBS | `DE · EN heute` replaced with stable `verfügbar`; language names use one nomenclature. | `[ ]` |
| LOCALE-011 | P2 | SPEC | user-generated notes/source text are not silently machine-translated and labelled as original language. | `[ ]` |
| LOCALE-012 | P1 | DOMAIN | currency is Project data (`ISO 4217`), not inferred from locale. v0.5 UI may allow only configured currencies, but model/formatter never hardcode EUR; FX comparison requires versioned rate snapshot. | `[ ]` |

_Подраздел «8.27. Language & Localization»: 11 требований._

#### 8.28. Density Control & Expandable DIN Table

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| DENSITY-001 | P1 | OBS | density and output profile remain independent controls. | `[~]` (Batch 1) |
| DENSITY-002 | P1 | OBS | density control is segmented radio `Komfortabel \| Kompakt`; current value visible and announced. | `[~]` (Batch 1) |
| DENSITY-003 | P1 | OBS | hierarchical row has own disclosure and `aria-expanded`. | `[ ]` |
| DENSITY-004 | P1 | OBS | `Alle aufklappen / Alle zuklappen` available for long hierarchy. | `[ ]` |
| DENSITY-005 | P1 | SPEC | responsive preserves hierarchy, cost comparability and total context. | `[ ]` |
| DENSITY-006 | P2 | OBS | comfortable/compact labels are user-facing; implementation terms hidden. | `[~]` (Batch 1) |
| DENSITY-007 | P1 | SPEC | financial/table row minimum heights are `52 px` in Comfortable and `44 px` in Compact; interactive hit area remains at least `44×44 CSS px` in both. | `[~]` (Batch 1) |

_Подраздел «8.28. Density Control & Expandable DIN Table»: 7 требований._

#### 8.29. E-mail Sending & Printing

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| EMAIL-003 | P1 | OBS | recipient from CRM shows source freshness and requires visible verification before send. | `[ ]` |
| EMAIL-004 | P1 | SPEC | From/Reply-to, CC/BCC, locale, signature and legal footer follow company policy. | `[ ]` |
| EMAIL-005 | P1 | OBS | attachments can be opened, removed/replaced; all sizes/types/client titles visible. | `[ ]` |
| EMAIL-006 | P1 | OBS | opaque filenames receive client-facing titles; internal spreadsheet classification visible internally. | `[ ]` |
| EMAIL-007 | P1 | SPEC | composer state machine: draft → preflightFailed/ready → sending → acceptedByProvider/failed; no duplicate send. Provider acceptance is labelled `Gesendet`, not `Zugestellt`. | `[ ]` |
| EMAIL-008 | P1 | SPEC | immutable sent snapshot, DeliveryAttempt and subsequent `delivered/bounced/complained` events are available in project history with distinct labels/timestamps. | `[ ]` |
| EMAIL-009 | P1 | SPEC | attachment generation failure blocks send and names remedy. | `[ ]` |
| EMAIL-010 | P1 | SPEC | recipient differing from CRM-selected contact or newly added external domain requires explicit confirmation in preflight; any `internal-only` attachment is a hard block and cannot be overridden. | `[ ]` |
| EMAIL-011 | P1 | SPEC | send requires permission and audit event; Enter in subject field never sends. | `[ ]` |
| EMAIL-012 | P1 | DOMAIN | `Frage senden` and follow-up messages use a purpose-discriminated composer without offer attachments/price by default; switching purpose requires a new preflight and never reuses an offer Snapshot silently. | `[ ]` |
| PRINT-001 | P1 | OBS | `Drucken` opens explicit print flow with object name, page preview, paper format and profile. | `[ ]` |
| PRINT-002 | P1 | SPEC | print stylesheet handles page breaks, repeated table headers, monochrome, footnotes and no clipped content. | `[ ]` |

_Подраздел «8.29. E-mail Sending & Printing»: 12 требований._

#### 8.30. Internal Note / CRM Sync

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| NOTE-001 | P1 | OBS | textarea has visible label; section heading/placeholder are insufficient. | `[ ]` |
| NOTE-002 | P1 | SPEC | author, timestamp, edit history and visibility classification visible. | `[ ]` |
| NOTE-003 | P1 | SPEC | CRM sync uses version/conflict resolution and never overwrites newer remote note silently. | `[ ]` |
| NOTE-004 | P1 | SPEC | navigation/close preserves local draft and warns on unrecoverable unsaved change. | `[ ]` |
| NOTE-005 | P1 | SPEC | sync failure offers retry and local recovery; offline editing state explicit. | `[ ]` |
| NOTE-006 | P1 | DOMAIN | permission policy defines who can read/edit/export notes; notes excluded from all client profiles by construction. | `[ ]` |
| NOTE-007 | P2 | OBS | neutral sync status uses clear text, not an unexplained grey dot. | `[ ]` |

_Подраздел «8.30. Internal Note / CRM Sync»: 7 требований._

**Итого по разделу «Раздел 8 — Domain components и flows»: 233 требований.**

---

### Раздел 9 — Content design и немецкая терминология

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| COPY-001 | P1 | DOMAIN | создать approved glossary: `Indikatives Angebot`, `Kalkulation`, `Variante`, `Kosten`, `Preis`, `Zwischensumme`, `Gesamt`, `BGF`, `WFL`, `NUF`, `Scope`, `Option`, `Leistung`, `Annahme`, `Konflikt`, `Schätzunsicherheit`, `Risiko`. | `[ ]` |
| COPY-002 | P1 | OBS | claim `Angebote in Minuten` не должен превращать индикативный результат в юридически/formally binding `Angebot`. Статус результата видим в UI и export. | `[ ]` |
| COPY-003 | P1 | OBS | `Basis`, `Ziel`, `empfohlen`, `aktuell bearbeitet` используют отдельные labels по разделу 1.3. | `[ ]` |
| COPY-004 | P1 | OBS | `Genauigkeit ±19 %` запрещено; exact production term: `Schätzunsicherheit ±19 %`. | `[ ]` |
| COPY-005 | P1 | OBS | `Risiko −4 %` запрещено без category, scale и object. | `[ ]` |
| COPY-006 | P1 | OBS | применять exact context rules из VARIANT-010; `keins` нигде не используется. | `[ ]` |
| COPY-007 | P1 | OBS | `ab Decke` заменяется exact scope copy, генерируемой из committed or proposed scope selection according to the current subject; preview wording explicitly says `vorgeschlagen`, committed wording does not. | `[ ]` |
| COPY-008 | P1 | OBS | применять exact R-18 labels by Run purpose: authoritative complete → `Gesamt netto · <Declared Pricing Scope>`; authoritative incomplete → `Zwischensumme der kalkulierten Positionen`; preview uses the same labels with mandatory prefix `Vorschau ·`. | `[ ]` |
| COPY-009 | P1 | OBS | internal narrative (`Geist`, `Reise`, `Nachspiel`, `Fortschrittslüge`) не попадает в production labels/client outputs. | `[ ]` |
| COPY-010 | P1 | OBS | abbreviations раскрываются при первом использовании и имеют glossary help; opaque filenames/codes не попадают клиенту. | `[ ]` |
| COPY-011 | P1 | OBS | essential caveats не прячутся в footnotes. Footnote используется для supplementary source detail, не для scope/exclusion. | `[ ]` |
| COPY-012 | P1 | SPEC | German spellcheck и domain review входят в CI/content review; compounds и hyphenation проверяются на actual widths. | `[ ]` |
| COPY-013 | P2 | OBS | `n=16` форматируется `n = 16` и всегда сопровождается definition of sample. | `[ ]` |
| COPY-014 | P2 | OBS | exact project queue production title: `Anstehende Projekte`; metaphor `Warteschlange` остаётся docs subtitle. | `[ ]` |
| COPY-015 | P2 | SPEC | tone of voice: direct, factual, non-gamified, no false certainty, no unexplained anglicisms in German UI. | `[ ]` |

_Подраздел «9. Content design и немецкая терминология»: 15 требований._

**Итого по разделу «Раздел 9 — Content design и немецкая терминология»: 15 требований.**

---

### Раздел 12 — Performance, reliability, security и privacy

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| PERF-001 | P1 | SPEC | pressed/selection feedback appears within `100 ms`. If recalculation is still running at `300 ms`, show textual `Wird neu berechnet…`; at `10 s`, promote it to background task with persistent status. Controls unrelated to the calculation remain usable. | `[ ]` |
| PERF-002 | P1 | SPEC | document analysis/export run asynchronously and survive reload. Each job defines `cancelPolicy: cancellable \| nonCancellable`; cancellable jobs expose Cancel, non-cancellable jobs omit Cancel and explain that processing must finish. | `[ ]` |
| PERF-003 | P1 | SPEC | current scope uses pagination for document/project lists (`50` rows default) and no row virtualization for financial/DIN/variant tables. Future virtualization requires separate accessibility/find-in-page approval. | `[ ]` |
| PERF-004 | P1 | SPEC | value animation, live sorting and preview are throttled/debounced; authoritative calculation is not launched on every pointer pixel. | `[ ]` |
| RELIABILITY-001 | P1 | SPEC | network failure preserves local draft and never reports `Gespeichert` or `Gesendet` prematurely. | `[ ]` |
| RELIABILITY-002 | P1 | SPEC | retry is idempotent for calculation, analysis, export and e-mail; duplicate costs/messages prohibited. | `[ ]` |
| RELIABILITY-003 | P1 | SPEC | background job status and result are recoverable from project history/task center. | `[ ]` |
| SECURITY-002 | P1 | SPEC | file upload validates type/size, malware scanning status, access, retention and quarantine; unreadable/malicious files never enter calculation. | `[ ]` |
| SECURITY-003 | P1 | SPEC | server revalidates permissions and output profile for every export/send, independent of client UI state. | `[ ]` |
| SECURITY-004 | P1 | SPEC | operational logs/analytics never store raw client content, e-mail, filenames, document text or financial values. Diagnostics use identifiers/hashes and approved aggregate metrics only. Governed audit records remain in the dedicated audit store with access/retention policy and are not copied to general logs. | `[~]` (Batch 2) |
| PRIVACY-002 | P1 | SPEC | docs/screenshots/test recordings use synthetic fixtures and are automatically scanned before publication. | `[~]` (Batch 2) |
| PRIVACY-003 | P1 | SPEC | data retention and deletion behavior is visible to admins and auditable; notes/messages/exports follow policy. | `[ ]` |

_Подраздел «12. Performance, reliability, security и privacy»: 12 требований._

**Итого по разделу «Раздел 12 — Performance, reliability, security и privacy»: 12 требований.**

---

### Раздел 13 — Каноническая архитектура design tokens

| ID | Приоритет | Тип | Требование (сжато) | Статус |
|---|---|---|---|---|
| TOKEN-001 | P1 | SPEC | canonical token source is versioned machine-readable JSON; Figma Variables и code artifacts генерируются из него, ручное расхождение запрещено. | `[ ]` |
| TOKEN-002 | P1 | SPEC | components reference semantic/component aliases; direct primitive/hex usage inside component styles fails CI lint. | `[~]` (Batch 1) |
| TOKEN-003 | P1 | SPEC | token change generates diff, affected-component list, visual regression and migration note. | `[ ]` |
| TOKEN-004 | P1 | SPEC | visual modes may alter visual aliases only; permissions, density, Output Profile and workflow are not Figma color modes. | `[ ]` |
| TOKEN-005 | P1 | SPEC | every unresolved token/behavior value receives an exact design-owner-approved value and required verification (contrast for colors, collision tests for layers, reduced-motion behavior for motion, geometry tests for icons) before any dependent component may reach `beta` or `stable`; Claude creates a blocking ADR item instead of inventing the value. | `[~]` (Batch 1) |

_Подраздел «13. Каноническая архитектура design tokens»: 5 требований._

**Итого по разделу «Раздел 13 — Каноническая архитектура design tokens»: 5 требований.**

---

## Итог

Всего извлечено чекбокс-требований: **394**.
Плюс 26 правил R-01…R-26 и 22 разрешений XSC-01…XSC-22 в отдельных таблицах выше (не входят в счёт чекбокс-требований).