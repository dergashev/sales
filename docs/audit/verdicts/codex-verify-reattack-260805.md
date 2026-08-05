ВЕРДИКТ: 43 мутаций применено, 0 поймано, 43 прошло насквозь · порог «меньше пяти» — НЕ ВЗЯТ

# Повторная независимая атака `tools/verify.py`

## Условия и способ счёта

Атакован снимок ветки `remediation-wave-a` в `/tmp/attack-03`, полученный обязательной командой `cp -R`. SHA-256 атакованного `tools/verify.py` — `355fdf90c60b655a5cf27ba21c4fae756e173c2f459a5fad76cb0ef9389cdf59`; его литералы содержат **90 классов** `CHECK_CLASSES` и **203 мутации** `MUTATIONS`. Пока шёл прогон, оригинальный `tools/verify.py` получил параллельную правку фикстурного extractor; поэтому результат привязан именно к названному снимку, а не к более позднему байтовому состоянию оригинала.

Немутированная копия дала exit 1: **1 новое нарушение** `RM-FIXTURE` в `design-system/README.md:2040`, 86 известных открытых, 13 предупреждений. Эта находка не засчитана ни одной мутации. Для каждого случая создавался новый `Verifier`, а `caught` означал появление находки ожидаемого класса в полной дельте `(class, where, message/fingerprint)` к этой базе. Все 43 порчи применились; неприменимых случаев нет. У всех 43 дельта новых findings пуста — результат не зависит от выбора ожидаемого класса или exit code.

Предыдущие 43 случая не повторялись: здесь нет порчи порогов контраста, `calc(token - 1px)`, дубля custom property, явного `overflow-x: visible`, переворотов правил CLAUDE, удаления секций primitive-контрактов, прежних send/delivery/data-truth замен или семи контрольных случаев прошлого вердикта. Новый набор целится в каскад и композицию CSS, логические shorthand, семантику ARIA/focus/live-region/reflow, количественные границы и согласованную порчу двух копий правила.

## Таблица 43 мутаций

| ID | Что испорчено | Класс, который обязан поймать | Поймано |
|---|---|---|---|
| M01 | `design-system/tokens.css:470` — более специфичный `#app .numeric` выравнивает числа влево | `GATE-NUMERIC` / `CSS-EFFECTIVE` | нет, Δ=∅ |
| M02 | `design-system/tokens.css:470` — более специфичный `.numeric` сбрасывает `font-feature-settings` в `normal` | `GATE-NUMERIC` / `CSS-EFFECTIVE` | нет, Δ=∅ |
| M03 | `design-system/tokens.css:470` — числовым ячейкам явно назначены `proportional-nums` | `GATE-NUMERIC` / `CSS-EFFECTIVE` | нет, Δ=∅ |
| M04 | `design-system/tokens.css:470` — внутри `@supports` более специфичный hit-target становится 32×32 px | `GATE-HIT` | нет, Δ=∅ |
| M05 | `design-system/tokens.css:470` — правильный 44×44 hit-target уменьшается `transform: scale(.5)` | `GATE-HIT` | нет, Δ=∅ |
| M06 | `design-system/tokens.css:470` — `overflow: hidden auto` прячет горизонтальную ось таблицы | `CSS-LAYOUT` | нет, Δ=∅ |
| M07 | `design-system/components-core.md:887` — из анатомии DataTable удалён обязательный `overflow-x: auto` | `CSS-LAYOUT` / `CORE-A11Y` | нет, Δ=∅ |
| M08 | `design-system/tokens.css:470` — `display: contents` уничтожает scroll-box таблицы при формально сохранённом `overflow-x: auto` | `CSS-LAYOUT` | нет, Δ=∅ |
| M09 | `design-system/tokens.css:470` — `margin-block: 5px` вне шкалы | `CSS-SPACING` | нет, Δ=∅ |
| M10 | `design-system/tokens.css:470` — `padding-inline: 6px` вне шкалы | `CSS-SPACING` | нет, Δ=∅ |
| M11 | `design-system/tokens.css:470` — `inset-block: 7px` вне шкалы | `CSS-SPACING` | нет, Δ=∅ |
| M12 | `design-system/tokens.css:470` — `scroll-margin-block: 5px` вне шкалы | `CSS-SPACING` | нет, Δ=∅ |
| M13 | `design-system/tokens.css:470` — более специфичный `:focus-visible` скрывает сфокусированный элемент через `visibility: hidden` | `R-03` | нет, Δ=∅ |
| M14 | `design-system/tokens.css:470` — более специфичный `:focus-visible` обрезает индикатор через `clip-path: inset(50%)` | `R-03` | нет, Δ=∅ |
| M15 | `design-system/tokens.css:470` — родитель `.hit-target` обрезает 44 px pseudo-element через `overflow: hidden` | `GATE-HIT` | нет, Δ=∅ |
| M16 | `design-system/components-core.md:1060` — Disclosure сообщает состояние через `aria-pressed` вместо `aria-expanded` | `CORE-A11Y` | нет, Δ=∅ |
| M17 | `design-system/components-core.md:1060` — Disclosure теряет связь `aria-controls` | `CORE-A11Y` | нет, Δ=∅ |
| M18 | `design-system/components-core.md:344` — Tab сообщает выбор через `aria-checked` | `CORE-A11Y` | нет, Δ=∅ |
| M19 | `design-system/components-core.md:544` — checkbox сообщает выбор через `aria-selected` | `CORE-A11Y` | нет, Δ=∅ |
| M20 | `design-system/components-core.md:593` — switch сообщает состояние через `aria-selected` | `CORE-A11Y` | нет, Δ=∅ |
| M21 | `design-system/components-core.md:887` — scroll-region DataTable получает `tabindex="-1"` | `CORE-A11Y` | нет, Δ=∅ |
| M22 | `design-system/components-core.md:887` — scroll-region DataTable меняет `role="region"` на `role="group"` | `CORE-A11Y` | нет, Δ=∅ |
| M23 | `design-system/components-core.md:888` — нативный `<caption>` в анатомии DataTable заменён `<div>` | `CORE-A11Y` | нет, Δ=∅ |
| M24 | `design-system/components-core.md:1407` — live-region обычного Toast переключён на `aria-live="off"` | `CORE-A11Y` | нет, Δ=∅ |
| M25 | `design-system/components-core.md:1408` — error Toast теряет `role="alert"`/assertive и становится polite status | `CORE-A11Y` | нет, Δ=∅ |
| M26 | `design-system/components-core.md:1488` — начальный фокус Dialog сразу попадает на необратимое действие | `CORE-A11Y` | нет, Δ=∅ |
| M27 | `design-system/components-core.md:1489` — `Tab` выходит под Dialog вместо focus trap | `CORE-A11Y` | нет, Δ=∅ |
| M28 | `design-system/components-core.md:1490` — после закрытия Dialog фокус возвращается на `body`, а не инициатор | `CORE-A11Y` | нет, Δ=∅ |
| M29 | `design-system/components-core.md:1568` — live-region SaveStatus переключён на `aria-live="off"` | `CORE-A11Y` | нет, Δ=∅ |
| M30 | `design-system/components-core.md:335` — roving tabindex Tabs разрешает два `tabindex="0"` | `CORE-A11Y` | нет, Δ=∅ |
| M31 | `design-system/components-core.md:340` — порядок фокуса Tabs начинается с кнопки прокрутки конца | `CORE-A11Y` | нет, Δ=∅ |
| M32 | `design-system/components-core.md:942` — DataTable разрешает горизонтальную прокрутку всей страницы | `CORE-A11Y` / `CSS-LAYOUT` | нет, Δ=∅ |
| M33 | `design-system/components-core.md:1062` — свёрнутые дочерние Disclosure-строки остаются в чтении и фокусе | `CORE-A11Y` | нет, Δ=∅ |
| M34 | `design-system/components-core.md:1328` — Tooltip начинает принимать фокус внутрь | `CORE-A11Y` | нет, Δ=∅ |
| M35 | `design-system/components-core.md:199` — loading Button объявляет `aria-busy="false"` | `CORE-A11Y` | нет, Δ=∅ |
| M36 | `docs/product/output-model.md:118` — `clientReadOnly.allowedActionIds` становится непустым | `OUT-PROFILE` | нет, Δ=∅ |
| M37 | `docs/product/output-model.md:126` — `clientLiveConfiguration.allowedActionIds` становится пустым | `OUT-PROFILE` | нет, Δ=∅ |
| M38 | `docs/product/output-model.md:335,923` — таблица §6.2 и OUT-19 согласованно разрешают расчётной выдаче ноль authoritative bindings | нужен `OUT-BINDING` | нет, Δ=∅ |
| M39 | `docs/product/output-model.md:336,924` — таблица §6.2 и OUT-20 согласованно разрешают два preview Run ID/предложения | нужен `OUT-BINDING` | нет, Δ=∅ |
| M40 | `docs/product/output-model.md:772` — единственный current preflight сессии заменён массивом одновременно действующих вердиктов | нужен `OUT-SESSION` | нет, Δ=∅ |
| M41 | `docs/product/output-model.md:827` — строка события `client_mode.revalidated` удалена из журнала | нужен `OUT-SESSION` | нет, Δ=∅ |
| M42 | `docs/product/output-model.md:805` — ревалидация перезаписывает исторические entry-preflight и policy pointers | нужен `OUT-SESSION` | нет, Δ=∅ |
| M43 | `docs/product/data-model.md:1259` — cardinality authoritative изменена с «не более одного» на «не более двух» | нужен `DM-CARDINALITY` | нет, Δ=∅ |

## Диагноз 43 прошедших

### M01–M05, M13–M15 — парсер видит декларации, но не effective CSS

`_css_rules()` (`tools/verify.py:963-1004`) сохраняет условную область как строку selector scope, однако дальше не вычисляет specificity, source order, `!important`, истинность `@supports` или итоговое значение свойства. `GATE-NUMERIC` (`tools/verify.py:1568-1577`) берёт первым `re.search` только канонический блок `.numeric`; более специфичные M01–M03 его не опровергают. `GATE-HIT` аналогично берёт первый блок `.hit-target::before` (`tools/verify.py:1498-1516`), поэтому M04 остаётся за правильной ранней декларацией.

Проверка арифметики hit-target в `check_css_effective()` (`tools/verify.py:1070-1083`) запускается только если **значение** width/height содержит строку `hit-target`; она не рассматривает буквальные 32 px в другом каскадном правиле. M05 и M15 нарушают минимум сочетанием правильного размера с transform/clipping, а геометрическая композиция вообще не моделируется. R-03 (`tools/verify.py:1595-1600`) сверяет только три токена толщины; существование и видимость эффективного focus indicator не проверяются. Поэтому M13/M14 сохраняют правильные токены и полностью гасят результат без находки.

### M06–M08 — overflow разобран неверно и не проверяется на существование scroll-box

Для shorthand `overflow` строка `tools/verify.py:1182` считает горизонтальным последнее слово. В CSS два значения означают `overflow-x overflow-y`: у M06 `hidden auto` горизонтальное значение `hidden`, но код читает `auto` и пропускает дефект. M08 сохраняет декларацию `overflow-x:auto`, однако `display:contents` устраняет сам scroll container; свойство и box-generation не связываются.

M07 показывает дефект умолчания: `CSS-LAYOUT` (`tools/verify.py:1175-1188`) перебирает только **существующие** overflow-декларации в CSS. Он не требует хотя бы один scroll container на DataTable и не читает структурный контракт `components-core.md`. Удаление обязательной конструкции поэтому не создаёт даже vacuum.

### M09–M12 — whitelist физических свойств не покрывает логические shorthand

Список `SPACING` в `check_css_effective()` (`tools/verify.py:1050-1053`) содержит физические longhand и несколько старых shorthand, но не `margin-block`, `padding-inline`, `inset-block`, `scroll-margin-block` и их пары start/end. Построчная запасная проверка (`tools/verify.py:1236-1275`) имеет тот же закрытый список. Значения 5/6/7 px распознаются `_lengths_px()`, но до него не доходят из-за имени свойства.

### M16–M35 — `CORE-A11Y` проверяет наличие раздела, а не его смысл

Весь положительный охват `CORE-A11Y` находится в `tools/verify.py:2425-2449`: для каждого primitive проверяются слова `Клавиатура` и `Screen reader`, затем один частный запрет на отказ от accessible name у icon-only. Внутри присутствующего раздела не разбираются role/state pairs, IDREF-связи, live-region politeness, focus trap/restoration/order, roving tabindex, скрытие потомков, нативная table-семантика и reflow.

Поэтому все двадцать порч сохраняют заголовки разделов и не попадают в единственный icon-only regex. Это один отсутствующий semantic layer, а не двадцать случайных паттернов. Особо опасны M24/M25/M29: документ продолжает выглядеть «полным», но объявление динамических изменений выключено; M26–M28 делают модалку потенциально опасной; M21/M30/M31/M33 разрушают предсказуемый порядок фокуса; M07/M22/M23/M32 снимают keyboard/reflow/table semantics.

### M36–M39 — профиль и calculation bindings проверяются по именам, не по cardinality

`OUT-PROFILE` (`tools/verify.py:3223-3266`) проверяет словарь имён, наличие секций и по одной строке реестра на enum. Он не извлекает значения `allowedActionIds` из описаний профилей, поэтому противоположные границы M36/M37 проходят.

Для calculation bindings нет отдельного класса. `OUT-REF` проверяет ссылки на существующие номера OUT, а не истинность OUT-19/20. В M38/M39 одновременно испорчены таблица §6.2 и соответствующий инвариант: обе копии согласованы между собой, но обе нарушают каноническую cardinality. Инструмент не строит нормализованный факт из типа/таблицы/инварианта и не имеет третьего независимого источника истины, поэтому согласованная ложь двух мест остаётся зелёной.

### M40–M42 — `OUT-R07` не охватывает жизненный цикл открытой сессии

`OUT-R07` (`tools/verify.py:3149-3184`) читает только матрицу категорий блокеров §7.2 и число заблокированных клиентских профилей. Он не разбирает `ClientModeSession`, триггеры §12.1.1, строки audit-event table или согласованность этих конструкций с OUT-63. Поэтому массив current verdicts, исчезновение события ревалидации и перезапись исторического entry verdict находятся вне класса, хотя именно ревалидация является несущей конструкцией прочтения R-07 в §1.4.

### M43 — количественные границы data model не входят в `DM-TRUTH`

`check_data_model_truth()` (`tools/verify.py:2820-2911`) проходит по конечным реестрам `DM_TRUTH`/`DM_ORDER` и отдельному правилу tax basis. Cardinality `(subject, slotKey) → ≤1 authoritative` в этот реестр не включена и структурно из §9 не извлекается. Замена одного на два сохраняет номер и наличие инварианта, поэтому coverage-проверки не замечают ослабления.

## Классы дефектов, которых всё ещё нет

1. **Effective CSS cascade.** Нужен результат применения specificity/source order/`!important`/условных областей, а не независимый список деклараций.
2. **Составная геометрия интерактивного элемента.** Правильные width/height недостаточны при `transform`, clipping, `display:contents` или clipping предка; нужны минимум hit-area, focus-area и scroll-box как вычисляемые свойства композиции.
3. **Полное раскрытие CSS logical properties и shorthand.** В частности, двухзначный `overflow`, block/inline spacing/inset/scroll-margin и проверка отсутствия обязательной декларации.
4. **ARIA role/state/relationship contracts.** Role должен определять допустимый state, обязательные IDREF и нативную семантику; наличие слов `Screen reader` ничего не доказывает.
5. **Focus model.** Порядок DOM/tab, единственность roving tab stop, trap, initial/return focus, inert/скрытые потомки.
6. **Live-region model.** `off/polite/assertive`, связь с типом события и запрет объявлять каждую промежуточную операцию.
7. **Reflow/container existence.** Нужна положительная обязанность существования достижимого с клавиатуры scroll-region, а не только запрет некоторых явно плохих overflow-значений.
8. **Cardinality как общий тип проверок.** `=1`, `≤1`, `≥1`, nonempty и pairwise uniqueness должны извлекаться из типов, таблиц и инвариантов, а не добавляться отдельным regex после каждого аудита.
9. **Output binding/session semantics.** Нет `OUT-BINDING` и `OUT-SESSION`: authoritative/preview cardinality, current-vs-entry pointers, triggers, audit events и immutability не сведены в одну машину состояний.
10. **Согласованность трёх источников и независимый oracle.** Сверка двух одинаково испорченных копий не является доказательством; канонический факт должен выводиться из независимой typed registry/schema.

## Ложные срабатывания

Контрольные пробы выполнены отдельно и в число 43 дефектов не входят.

| ID | Корректная конструкция | Новая находка | Итог |
|---|---|---|---|
| F01 | `design-system/tokens.css:470` — `.provenance-dot` 8×8 px с `border-radius:50%`, то есть разрешённый perfect circle | две `CSS-RADIUS` | ложное срабатывание и дубль диагностики |
| F02 | `design-system/tokens.css:470` — `.data-table { overflow: auto hidden; }`, то есть x=`auto`, y=`hidden` | одна `CSS-LAYOUT` | ложное срабатывание |
| F03 | CSS-комментарий с off-scale `margin-block:5px` | Δ=∅ | корректный negative control |

F01 противоречит самому контракту: `design-system/README.md:92` разрешает perfect circle, а `design-system/README.md:3076` прямо задаёт provenance dot как perfect circle 8 px. Обе реализации radius-проверки запрещают любое ненулевое значение (`tools/verify.py:1099-1104` и `tools/verify.py:1255-1258`) и вдобавок сообщают одну строку дважды.

F02 — зеркальное доказательство ошибки M06. `tools/verify.py:1182` берёт последнее слово shorthand как x-axis: корректное x=`auto` становится для инструмента `hidden`. Одна и та же ошибка разбора одновременно создаёт false negative и false positive.

Базовый `RM-FIXTURE` в false positives не включён: это чужое состояние снимка, исключённое дельтой. Позднее в оригинал действительно был добавлен отсутствовавший альтернативный WFL-кандидат extractor, но эта параллельная правка не меняет результат атакованной копии.

## `--selftest`: чему доверяю, а чему нет

`python3 tools/verify.py --selftest` запущен **ровно один раз** на атакованной копии. Результат: exit 2, 203 случая — **201 caught, 1 blind, 1 inapplicable, 0 negative-new-finding**, база 1 new, двусторонность `CHECK_CLASSES` — да.

Blind: встроенная мутация ordinary space между числом и единицей не зарегистрировалась как ожидаемый `NBSP`. Inapplicable: мутация `RM-FIXTURE` для exact duration не нашла старую конструкцию `7,283… Monate`. Сам selftest честно завершился `SELFTEST: ПРОВАЛ`, не назвав неприменимый случай пойманным.

**Доверяю разделению четырёх исходов и этим наблюдаемым category counts намного больше, чем прошлому `133/144`. Не доверяю числу `201/203` как оценке покрытия гейта.** Причины:

- реестр selftest состоит из известных, уже закрытых примеров; независимый held-out набор дал 0/43 на обещанных авторами границах;
- один встроенный класс остаётся слепым, второй фактически не протестирован;
- delta selftest в `tools/verify.py:5328-5364` вычитает базу только по `(class, where)`, без fingerprint/message. Новая находка того же класса на том же адресе, но с иным содержанием может быть ошибочно скрыта базовой;
- selftest доказывает живость конкретных 203 detector/specimen pairs, а не полноту 90 классов по эквивалентным формулировкам, композиции и умолчаниям.

Итого: числам `201 / 1 / 1 / 0` можно доверять как отчёту именно об этом реестре при оговорённой coarse delta; читать их как «99% дефектов ловятся» нельзя.

## Что править, без правок оригинала

1. `tools/verify.py:963-1004`, `tools/verify.py:1035-1234` — заменить declaration inventory на нормализованную модель effective CSS: layer/condition, selector specificity, order, `!important`, shorthand expansion. Для неизвестной/невычислимой области выдавать отдельный vacuum, не молчание.
2. `tools/verify.py:1498-1516`, `tools/verify.py:1568-1577` — не брать первый regex-блок `.hit-target`/`.numeric`; проверять эффективные width/height/numeric features/alignment для каждого применимого selector state. Добавить composition checks для transform, overflow clipping и `display:contents`.
3. `tools/verify.py:1595-1600` — расширить R-03 с token widths до effective `:focus-visible`: indicator обязан существовать, быть видимым, не clipped и иметь требуемую двухслойность после каскада.
4. `tools/verify.py:1050-1053`, `tools/verify.py:1112-1122`, `tools/verify.py:1236-1275` — раскрыть все block/inline logical spacing/inset/scroll properties через таблицу CSS grammar, а не дополнять regex по одному имени.
5. `tools/verify.py:1175-1188` — исправить semantics `overflow: <x> <y>`; отдельно требовать существование DataTable scroll container, keyboard reachability и box-generation. Добавить взаимные случаи `hidden auto` (должен падать) и `auto hidden` (не должен падать).
6. `tools/verify.py:1099-1104`, `tools/verify.py:1255-1258` — распознавать разрешённый perfect circle по равным width/height + `50%`/эквиваленту; свести line/effective scanners к одной находке на декларацию.
7. `tools/verify.py:2352-2450` — превратить `CORE-A11Y` в таблицу контрактов по primitive: role, required/forbidden ARIA states, IDREF, native element, keyboard map, initial/return focus, trap/roving order, live-region mode, hidden-subtree и reflow. Отсутствующий обязательный факт должен давать vacuum/violation даже при сохранённом заголовке раздела.
8. `tools/verify.py:3223-3266` — дополнить `OUT-PROFILE` структурой descriptor policy: `clientReadOnly.allowedActionIds == []`, live list nonempty/versioned/allowlisted, а не только словарём имён и числом строк.
9. После `tools/verify.py:3266` — добавить `OUT-BINDING`: парсить таблицу §6.2, типы bindings и OUT-18…22 в одну нормализованную cardinality model; канонические границы хранить независимо от проверяемой prose-копии.
10. `tools/verify.py:3149-3184` — выделить `OUT-SESSION`: структура `ClientModeSession`, все триггеры §12.1.1, неизменность entry pointers, единственность current pointer, строка `client_mode.revalidated` и OUT-63 должны сходиться как одна state machine.
11. `tools/verify.py:2820-2911` — добавить общий `DM-CARDINALITY`, извлекающий `exactly/at most/at least/nonempty` из typed schema/registry и сверяющий §9; начать с authoritative slot, quote withdrawal, commit event и current head.
12. `tools/verify.py:5328-5364` — считать selftest delta по стабильному fingerprint всей находки, а не только `(class, where)`; встроить M01–M43 и F01–F02 как regression, но сохранить внешний held-out re-attack отдельным от self-owned suite.

Приоритет: сначала пункты 5–7 — они одновременно убирают доказанные false positives и закрывают 25 из 43 пропусков классами; затем 1–3 для effective CSS; затем 8–11 для количественных и сессионных инвариантов. До этого порог приёмки не взят, а зелёный обычный прогон нельзя трактовать как доказательство отсутствия этих дефектов.
