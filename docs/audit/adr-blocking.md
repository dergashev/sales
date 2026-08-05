# Реестр блокирующих ADR-решений

**Основание:** R-25, TOKEN-005, раздел 13 аудита
**Создан:** 04.08.2026 по итогам независимого аудита Batch 1

> Раздел 13 аудита, дословно: «Entries above without an assigned value are not defaults. They are explicit blocking decisions under R-25 and may not be emitted into Figma/code until approved in an ADR.»
>
> Ниже — **все** записи, для которых аудит значения не задал, а реализация вынуждена иметь какое-то значение, чтобы страница отрисовалась. Каждое такое значение является **рабочим приближением, а не дефолтом**. Пока запись открыта, любой зависимый компонент **не может** достичь статуса `beta` или `stable` (TOKEN-005).
>
> Первая редакция файла ошибочно утверждала, что таких записей пять. Независимый аудит установил: их **34**. Ошибка исправлена.

---

> **Состав пересобран 04.08 по второму вердикту аудитора.** Прежняя редакция давала итог 34, но её таблица не совпадала с разделом 13 по составу: отсутствовала `action.secondary.*`, пары `data.*` и `deadline.*` были слиты в две строки, зато добавлены три бордера из BORDER-001, которых в разделе 13 нет. Число сходилось за счёт взаимной компенсации ошибок. Ниже состав выведен из раздела 13 построчно.

**Пересчёт от состава раздела 13:**

| Группа | Записей | Имён |
|---|---:|---:|
| `semantic.color.text.*` (primary, secondary, muted, disabled, inverse) | 5 | 5 |
| `semantic.color.surface.*` (canvas, default, subtle, selected, overlay) | 5 | 5 |
| `semantic.color.border.*` (subtle, default, strong) | 3 | 3 |
| `semantic.color.action.secondary.*` | 1 | 1 |
| `semantic.color.status.*` (info, success, warning, error) | 4 | 4 |
| `semantic.color.data.*` (changed, uncertain) | 2 | 2 |
| `semantic.color.deadline.*` (warning, critical) | 2 | 2 |
| `semantic.color.dataViz.category.1...n` | 1 | 1 |
| **Цвет — итого** | **23** | **23** |
| `semantic.layer.*` (header, popover, tooltip, dialogBackdrop, dialog, toast) | 6 | 6 |
| `semantic.motion.duration.fast/base/slow` | 1 | 3 |
| `semantic.motion.easing.standard/emphasized` | 1 | 2 |
| **ВСЕГО** | **31 строка** | **34 имени** |

Итог 34 подтверждается, но теперь он выведен, а не подогнан.

## 1. Цвет — 23 записи

| # | Токен | Приближение | Источник приближения | Обязательная верификация |
|---|---|---|---|---|
| 1 | `text.primary` | `#323232` | бренд-гайд All3 Black | контраст ✓ 12,82:1 на белом |
| 2 | `text.secondary` | `#6B6B6B` | 72 % neutral.900 на белом | **5,33:1 ✓** проходит для обычного текста |
| 3 | `text.muted` | `#8C8C8C` | 56 % neutral.900 | **3,36:1 — не проходит 4,5:1**, только для текста без решения |
| 4 | `text.disabled` | `#9D9D9D` | 48 % neutral.900 | **2,71:1 — не проходит**; disabled обязан нести текстовое объяснение |
| 5 | `text.inverse` | `#FFFFFF` | бренд-гайд | контраст ✓ |
| 6 | `surface.canvas` | `#E8ECE9` | бренд-гайд All3 Grey | — |
| 7 | `surface.default` | `#FFFFFF` | бренд-гайд | — |
| 8 | `surface.subtle` | `#F4F6F4` | 50 % neutral.100 | **1,09:1 к белому** — не носитель смысла |
| 9 | `surface.selected` | `#F2D1BF` | 25 % orange.700 на белом | **1,43:1 к белому · 1,20:1 к канве.** Выделение несёт бордер 2 px #C94700 (4,79:1), заливка лишь поддерживает |
| 10 | `surface.overlay` | 48 % neutral.950 | производное | — |
| 11 | `border.subtle` | `#DEDEDE` | 16 % neutral.900 | **1,35:1 — ниже 3:1 (WCAG 1.4.11)** |
| 12 | `border.default` | `#BDBDBD` | 32 % neutral.900 | **1,88:1 — ниже 3:1**, essential non-text indicator |
| 13 | `border.strong` | `#323232` | бренд-гайд | ✓ |
| 14 | **`action.secondary.*`** — bg/border/text/hover | `#FFFFFF` / `#323232` / `#323232` / `#E8ECE9` | бренд-гайд; **запись раздела 13, пропущенная в прежней редакции** | текст на белом 12,82:1 ✓ |
| 15 | `status.warning` | `#323232` нейтральный | **цвета нет** — COLOR-006 требует добавить warning-цвет; оранжевый запрещён R-01 | **решение владельца обязательно** |
| 16 | `status.info` | `#0B24FB` | расширенная палитра | ✓ 7,90:1 |
| 17 | `status.success` | `#3C887E` | расширенная палитра | 4,19:1 — только non-text |
| 18 | `status.error` | `#F04859` | расширенная палитра | 3,64:1 — только non-text |
| 19 | `data.changed` | `#323232` | отказ от цвета | различимость от status и от text.primary |
| 20 | `data.uncertain` | `#323232` | отказ от цвета | то же значение, что #19 — COLOR-002 выполнен только по именам |
| 21 | `deadline.warning` | `#323232` | отказ от цвета | печатный grayscale (COLOR-010) |
| 22 | `deadline.critical` | `#F04859` | расширенная палитра | 3,64:1 — только non-text |
| 23 | `dataViz.category.1…n` | `#0B24FB` / `#3C887E` / `#98CE00` — **официальные цвета фаз графика** | бренд-гайд | **COLOR-004 НЕ выполнен и не может быть выполнен внутри реализации.** Измерено: попытка развести осветлением дала 1,47:1 и 1,34:1 к статусам — визуально те же цвета, имитация решения. Значения возвращены к официальным. Нужен либо утверждённый chart-набор, либо отказ от цвета в статусах |

**Дополнительно к #23:** `#98CE00` (category.3) даёт на белом **1,88:1** — как носитель смысла в графике недопустим без подписи или узора.

## 2. Слои — 6 записей

`layer.header` 10 · `layer.popover` 20 · `layer.tooltip` 30 · `layer.dialogBackdrop` 90 · `layer.dialog` 100 · `layer.toast` 110.

Значения приняты по прежней системе. **Обязательная верификация TOKEN-005 — collision test — не выполнена.** Требуется проверка, что тултип внутри модалки, тост поверх поповера и поповер внутри липкой шапки не перекрывают друг друга неверно.

## 3. Движение — 5 записей

`motion.duration.fast/base/slow` = 120/200/240 мс · `motion.easing.standard/emphasized`.

Реализовано затухание при `prefers-reduced-motion` ✓. **Тест reduced-motion не написан.** Назначенческие токены MOTION-001 (`feedback`, `reveal`, `reorder`, `value change`) заданы приближениями от базовых длительностей.

## 4. Вне раздела 13, но введено реализацией

| Токен | Значение | Почему требует ADR |
|---|---|---|
| `panel-right-width` | 400 px | раздел 13 такой записи не содержит |
| `type.link` / `type.tooltip` / `type.kbd` | 16/24 · 14/20 · 12/16 | TYPE-003 требует роли, раздел 13 значений не даёт |
| `motion.value-change` / `motion.emphasis` | 400 / 480 мс | продуктовые анимации счёта и интервала |
| `stagger.row` / `stagger.wave` | 30 / 80 мс | — |
| иконка `stroke 1.75` | не токенизировано | LAYOUT-002 требует sanctioned token для icon geometry |
| `border.warning` / `border.error` / `border.disclosure` | `#323232` / `#F04859` / `#BDBDBD` | введены требованием BORDER-001; в разделе 13 таких записей нет |
| `surface.selected` усилен до 25 % orange | `#F2D1BF` | 1,43:1 к белому, 1,20:1 к канве — **слабое различие; носитель выделения — бордер, не заливка** |

## 5. Component-слой — 25 записей, не реализован

`component.button/tabs/segmentedControl/radioCard/input/slider/badge/card/dataTable/disclosure/metric/optionTile/conflictResolver/changePreview/variantComparison/workflowStepper/documentAnalysis/documentVersionRow/facadeSelector/provenance/projectQueueCard/scheduleTimeline/languageSelector/emailComposer/internalNote`.

Значений нет ни в аудите, ни в реализации. Слой **умышленно отсутствует** — это корректное применение R-25.

---

## 6. Незакрытая обязательная верификация (TOKEN-005)

| Вид | Статус |
|---|---|
| Contrast для цветов | **все производные посчитаны** (см. таблицу §1); не проверены только сочетания на нестандартных подложках |
| Collision test для слоёв | **отсутствует** |
| Reduced-motion behavior | реализовано, **тест отсутствует** |
| Geometry test для иконок | **отсутствует** |
| Печатный grayscale и forced-colors (COLOR-010) | **не рассмотрено** |

## 6a. Введено Batch 5a — 17 токенов, затребованных контрактами и не имеющих значения

Отличие от разделов 1–3 существенное: там записан **выбранный** токен с приближением, которое надо утвердить или заменить. Здесь значения нет вовсе — контракт примитива ссылается на токен, которого в `tokens.css` не существует. Придумать значение запрещено (R-25), поэтому ссылка помечена `[ADR-PENDING]`, а компонент не может выйти из `alpha`.

| # | Токен | Кто требует | Что должно решить ADR |
|---|---|---|---|
| 1 | `--color-action-destructive-bg` | Button | цвет опасного действия; кандидат `#F04859` даёт с белым текстом 3,64:1 и **не проходит** 4,5:1 |
| 2 | `--color-action-destructive-hover` | Button | производное от №1 |
| 3 | `--color-action-destructive-pressed` | Button | производное от №1 |
| 4 | `--color-action-destructive-text` | Button | зависит от №1: тёмный текст на светлой заливке либо наоборот |
| 5 | `--color-action-secondary-pressed` | Button | нажатое состояние вторичной кнопки |
| 6 | `--color-action-ghost-pressed` | Button | нажатое состояние ghost |
| 7 | `--color-action-link-text` | Link | цвет ссылки, отличимый от обычного текста без оранжевого (R-01) |
| 8 | `--color-surface-inverse` | Tooltip | подложка тултипа |
| 9 | `--size-tooltip-max-width` | Tooltip | ширина в `ch`, а не в px (правило проекта 3a) |
| 10 | `--size-toast-max-width` | Toast | то же |
| 11 | `--motion-delay-hover-preview` | Geist-Vorschau, DC-28 | задержка предпросмотра; в README названа 200 мс, токена нет |
| 12 | `--duration-toast-default` | Toast | время жизни тоста |
| 13 | `--duration-toast-undo` | Toast | время жизни тоста с «Rückgängig»; в CLAUDE.md названо 8 с, токена нет |
| 14 | `--size-control-indicator` | RadioCardGroup, CheckboxCard | размер круга/квадрата; README называет 18 px, токена нет |
| 15 | `--size-slider-thumb-visual` | Slider | видимый размер бегунка при зоне нажатия 44 px |
| 16 | `--size-slider-track-thickness` | Slider | толщина дорожки |
| 17 | `--layer-presentation-banner` | режим презентации | слой баннера в стеке z-index |

**Одна заявка снята при проверке.** `--color-action-ghost-hover` числился недостающим в таблице §10 `components-core.md`, но тело того же контракта (строки 134–135) уже назначает ghost при наведении существующий `--color-action-secondary-hover`. Таблица противоречит собственному контракту; токен не нужен.

Обратите внимание на записи 11, 13 и 14: значение **названо в проектной документации словами** (200 мс, 8 с, 18 px), но токена не существует. Это худший вид пробела из трёх — он выглядит закрытым при чтении и раскрывается только при сборке. Именно поэтому они здесь, а не в списке «уже решено».

## 7. Итог для планирования

**51 открытый ADR** (34 из разделов 1–3 + 17 из раздела 6a) **+ 25 нереализованных component-записей.** Следствие по TOKEN-005: **ни один компонент дизайн-системы не может быть объявлен `beta` или `stable`**, пока эти решения не приняты владельцем дизайна. Текущий достижимый статус любого компонента — `alpha`.

Это не блокирует работу прототипа-симулятора (он и не претендует на `stable`), но обязано быть на входе у ин-хаус команды.
