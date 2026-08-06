ВЕРДИКТ: этапов закрыто 5 из 5 · образцов добавлено 9 · расхождений витрина↔токены 15 · ADR-предложений 17 · блокировано владельцем 17

# Доведение дизайн-системы и единый визуальный источник · 06.08.2026

Проверялась текущая рабочая копия, а не формулировки прежних вердиктов. Зона
изменений ограничена `design-system/**` и `docs/audit/verdicts/**`; `src/**`,
`tools/**`, реестры и продуктовые документы не изменялись. Поэтому решения по
контракту и коду ниже — адресные требования второму потоку, а не заявление о
правке прототипа.

## Единый визуальный источник

ЭТАП 0/1: частных токенов переведено 28 из 28 · новых provisional-токенов 10 · расхождений значений 1 · классов извлечено 235

### Этап 0 — один словарь

Локальный `:root` удалён из витрины. Все 28 частных имён заменены именами
`tokens.css`; поиск старых имён в `all3-design-system.html` и
`components.css` даёт ноль результатов. Единственное содержательное
расхождение значений — использование brand-orange как заливки действия:
brand-роль сохранена за `--color-brand-accent`, но `.a3-btn` переведена на
`--color-action-primary-bg`; это не молчаливая подмена.

Пять цветов фасадных placeholder-плиток не имели системных эквивалентов.
Их существующие значения перенесены без изменения в primitive-слой и выведены
через пять semantic alias. Поэтому `M=10` деклараций для пяти визуальных
понятий. Все десять помечены `[provisional]` и ограничены DC-20; новых
значений не придумано. Системные токены не переименовывались и не удалялись.

| Частное имя | Системное имя | Почему это соответствие |
|---|---|---|
| `--orange` | `--color-brand-accent` | Точный официальный brand-orange; в action-контексте класс отдельно переведён на action-role. |
| `--orange-hover` | `--color-action-primary-hover` | Частное имя описывало hover primary action; токены после ремедиации авторитетнее старого значения. |
| `--black` | `--color-text-primary` | Основной текст и нейтральная графика. |
| `--grey` | `--color-surface-canvas` | Фоновая canvas-поверхность. |
| `--blue` | `--color-dataviz-category-1` | Синий в витрине используется как категория данных, не как универсальный focus/action. |
| `--dgreen` | `--color-dataviz-category-2` | Тёмно-зелёная категория и положительный вклад. |
| `--bgreen` | `--color-dataviz-category-3` | Ярко-зелёная категория Gantt. |
| `--red` | `--color-status-error` | Семантика ошибки. |
| `--white` | `--color-surface-default` | Белая основная поверхность. |
| `--b-hair` | `--border-hairline` | Тот же смысл слабого разделителя. |
| `--b-def` | `--border-default` | Обычная граница компонента. |
| `--b-strong` | `--border-contrast-1px` | Контрастная одно-пиксельная граница. |
| `--sp05` | `--space-1` | 4 px, первый шаг шкалы. |
| `--sp1` | `--space-2` | 8 px, второй шаг шкалы. |
| `--sp15` | `--space-3` | 12 px, третий шаг шкалы. |
| `--sp2` | `--space-4` | 16 px, четвёртый шаг шкалы. |
| `--sp3` | `--space-5` | 24 px, пятый шаг шкалы. |
| `--sp4` | `--space-6` | 32 px, шестой шаг шкалы. |
| `--sp6` | `--space-7` | 48 px, седьмой шаг шкалы. |
| `--sp8` | `--space-8` | 64 px, восьмой шаг шкалы. |
| `--ease` | `--motion-easing-standard` | Точное стандартное easing-значение системы. |
| `--ease-hero` | `--motion-easing-emphasized` | Точное emphasized easing для крупного изменения. |
| `--font-brand` | `--font-family` | Единый font stack уже объявлен системным токеном. |
| `--ph-putz` | `--color-material-placeholder-plaster` | Новый DC-20 semantic alias к перенесённому primitive-значению. |
| `--ph-holz-a` | `--color-material-placeholder-timber-light` | Новый DC-20 semantic alias к светлой части timber-pattern. |
| `--ph-holz-b` | `--color-material-placeholder-timber-dark` | Новый DC-20 semantic alias к тёмной части timber-pattern. |
| `--ph-klinker` | `--color-material-placeholder-clinker` | Новый DC-20 semantic alias к placeholder-клинкеру. |
| `--ph-sockel` | `--color-material-placeholder-plinth` | Новый DC-20 semantic alias к placeholder-цоколю. |

### Этап 1 — один файл классов

Весь блок `<style>` извлечён в `design-system/components.css`; витрина
подключает `tokens.css` и затем `components.css`. В HTML больше нет `<style>`
или `:root`. Уникальных публичных классов в CSS — 235, все имеют префикс
`a3-`; статических классов без префикса в HTML нет. Все `var(--x)` в новом
CSS разрешаются декларацией в `tokens.css` либо локальной density-переменной
`--cellY`. `@font-face` не дублировался: системное объявление уже живёт в
`tokens.css`.

`components.css` является общим visual source, но сам React-потребитель пока
его не подключает: это намеренно оставлено второму потоку, поскольку задание
одновременно запрещает менять `src/**`. До этой миграции автоматическое
обновление прототипа ещё не доказано.

Структурно зависимые группы, которые потребитель обязан воспроизвести:

| DC / примитив | Обязательная структура классов |
|---|---|
| Button / NumericInput / Switch | `.a3-row > .a3-btn`; `.a3-input > input + .a3-unit`; `.a3-toggle` с состоянием `.a3-on`. |
| DC-1 | `.a3-chip-src > .a3-dot + text`. |
| DC-2 | `.a3-delta` плюс state-класс `.a3-show`; вариант `.a3-cost` или `.a3-saving`. |
| DC-3 / DC-16 | `.a3-badge > .a3-dot + text`; `.a3-zone > b + .a3-lbl`; `span.a3-tag` с variant-классом. |
| DC-5 | `.a3-tbl-scroll > table.a3-kg`; numeric-cell получает `.a3-num`, иерархия — `.a3-lvl2`, итог — `.a3-total`. |
| DC-6 | `.a3-folgen > title + ul + action-row`. |
| DC-7 / DC-31 | `.a3-mode-wrap > .a3-mode-card`; `.a3-hinweis` управляет соседним `.a3-pop`. |
| DC-8 | `.a3-ann > .a3-ann-t + content/actions`. |
| DC-9 | `.a3-q > question + .a3-fx`. |
| DC-10 compact | `.a3-loader > .a3-track > .a3-run`, затем `.a3-plog + .a3-phase`. |
| DC-10 current | `.a3-analysis-spec > .a3-analysis-track + .a3-analysis-log + .a3-analysis-files`; ошибка получает `.a3-analysis-error`. |
| DC-11 | `table.a3-cmp`; target-header получает `.a3-target`, числа `.a3-num`, delta `.a3-d`. |
| DC-12 / DC-13 | `.a3-journal`; `.a3-chapters > .a3-ch > .a3-n`. |
| DC-12 current | `.a3-journal-spec > button.a3-journal-disclose + ul.a3-journal-items`. |
| DC-14 | `.a3-tour-stage > .a3-tour-cutout + .a3-tour-card`; actions расположены в карточке. |
| DC-15 | `.a3-pcard > .a3-top + .a3-mid`; CTA `.a3-cta`, срок `.a3-term`. |
| DC-17 | `.a3-doc > .a3-ic + .a3-nm + .a3-pg + .a3-right`; статус `.a3-okc` или `.a3-errc`. |
| Tabs | `.a3-tabs[role=tablist] > [role=tab]`, затем `.a3-tabpane`. |
| DC-19 | `.a3-gantt > .a3-g-row > label + .a3-g-track > .a3-g-seg/.a3-g-fin`; axis и legend — siblings. |
| DC-20 | `.a3-fgrid > button.a3-fk > .a3-img + .a3-nm + .a3-ok`; material-класс применяется только к `.a3-img`. |
| DC-21 | `.a3-hk-wrap > button.a3-hk-val + .a3-hk-pop`; popover содержит `.a3-r > label + .a3-fnum`. |
| DC-22 | `.a3-radio-segments > label > input + text`, затем sibling `.a3-profile-indicator`. |
| DC-24 | `.a3-empty-spec > .a3-empty-icon + .a3-empty-copy`; actions живут в copy-column. |
| DC-25 / DC-26 / DC-32 / DC-35 | `.a3-ringwrap`, `.a3-rb + input.a3-rb-number + .a3-guard`, `.a3-nextstep`, `.a3-konflikt > .a3-kv`, `.a3-recap > ul > li`. |
| DC-29 | `.a3-toasts > .a3-toast[role=status] > text + button.a3-act`; полный specimen — `.a3-undo-spec > copy + actions`. |
| DC-33 / Dialog | `.a3-modal-scrim > .a3-modal[role=dialog] > .a3-item/.a3-hidelist/actions`. |
| DC-38 | `.a3-heroband > .a3-hb`; корень тотала получает `.a3-hb-total`, подписи — `.a3-hb-cap/.a3-hb-sub`. |
| DC-39 / DC-40 | `.a3-tgrid > button.a3-tk` и `.a3-ogrid > button.a3-okc-tile`; визуальный status — последний child. |
| DC-41 / DC-43 | `.a3-mailcard > .a3-mailrow > .a3-lb + value`; `.a3-notecard > label + textarea + actions`. |
| DC-42 | `.a3-print-card[role=dialog] > .a3-paper-preview + .a3-preflight-list/actions`. |
| DC-44 | `.a3-drivers > .a3-bmark + repeated .a3-drv > label + .a3-val + .a3-bar`; итог получает `.a3-sum`. |
| DC-46 / DC-47 | `.a3-scope > buttons`; `table.a3-kx > .a3-krow/.a3-ktotal`; `.a3-segs > .a3-sg`. |
| Switch current | `.a3-switch-row > label + button.a3-switch-button > .a3-switch-track + .a3-switch-thumb`. |

## A. Трассируемость

В витрине 65 вхождений `data-dc` и 43 уникальных номера. Все показанные
доменные блоки получили ключ на корне. Ручной ledger оказался неточным в двух
местах: образцы DC-34 и DC-37 в HTML отсутствуют.

- DC-34 `ProjectSearchFilter` не добавлялся: в ledger он перечислен среди
  «есть в витрине», но в самой витрине поиск/фильтр отсутствовал; строить
  десятый новый образец сверх заданных девяти без контракта-фикстуры означало
  бы расширить объём.
- DC-37 `ScopeLineItemBlock` не имеет самостоятельного корня: его смысл
  частично показан внутри DC-46/47. Ложный отдельный `data-dc="37"` на чужом
  блоке был бы хуже честного пропуска.

Это находки против исходного ручного реестра, а не пробелы разметки у реально
существующего блока.

## B. Расхождения витрины с нормативом

`K=15` — классы расхождений, а не количество текстовых замен. Решение везде
одно: при конфликте авторитетны прошедшие ремедиацию токены и контракты.

| # | Расхождение старой витрины | Решение в текущей витрине |
|---:|---|---|
| 1 | Primary action использовал brand-color и старый hover. | Button использует `--color-action-primary-bg/hover/pressed` и action-text. |
| 2 | Selection, toggle и выбранные tiles использовали brand-color или canvas-grey. | Selection переведён на `--color-selection-border` и `--color-surface-selected`. |
| 3 | Focus был одной синей линией. | Общий `:focus-visible` использует нормативную двухслойную конструкцию separator + ring. |
| 4 | Disabled полагался на отсутствие реакции или opacity. | Button/tiles используют disabled semantic pair; в новых образцах причина доступна текстом. |
| 5 | Роли surface смешивались между `grey`, `white`, `#fff` и transparent. | Компонентные поверхности разведены по canvas/default/subtle/selected/overlay. |
| 6 | Body, small, labels, table headers и badges содержали старые пары line-height/weight. | Компонентные роли ссылаются на `--type-*`; буквальные размеры оставлены только в демонстрации самой шкалы и shell-композиции. |
| 7 | Визуальная геометрия 20–40 px одновременно была hit-area. | Button, input, toggle, range-пара и новые specimens обеспечивают минимум 44×44 через token/внешний hit-target. |
| 8 | Financial rows и compact-density не следовали минимумам 52/44. | `.a3-kg` использует `--row-height`; compact задаёт 44 px и canonical padding. |
| 9 | Borders были тремя частными composite-токенами. | Hairline/default/contrast/selected/error используют системные border-роли. |
| 10 | Secondary/muted text задавался произвольными alpha-цветами. | Продуктовые component-группы используют text-primary/secondary/muted; alpha сохранён только у иллюстративной графики. |
| 11 | Easing жил в частных именах, durations дублировались литералами. | Easing унифицирован; component transitions используют motion-role там, где роль определена. Ненормированные демонстрационные анимации не объявлены новым токеном из-за R-25. |
| 12 | Слои и ширина popover/toast были локальными числами. | Z-index и допустимые max-width берутся из layer/size tokens; значения без ADR остаются provisional. |
| 13 | Shell был 1100 px, а DC-44 фиксировал отдельную 168 px колонку. | Shell использует `--content-max-width`; DC-44 — content-aware `minmax`, с отдельным числовым столбцом. |
| 14 | Встречались неполные scope labels, противоречащие R-18/COPY-008. | Totals/subtotals названы полным scope-label; та же правка внесена в `content/i18n-en-260806.md`. |
| 15 | Showcase смешивал production-like данные и старую арифметику с текущей fixture. | Все примеры переведены на DEMO-идентификаторы и числа sanctioned fixture; интерактивные пересчёты согласованы с ними. |

Нормативное исключение подтверждено: круглые status-dot/indicator используют
`border-radius:50%`; скругления карточек и контролов не вводились.

## C. Недостающие образцы

Добавлен один отдельный блок на каждый из девяти пунктов задания:

1. DC-14 `GuidedTourStep`.
2. DC-22 `OutputProfileSwitch`.
3. DC-24 `EmptyState`.
4. DC-42 `PrintFlow`.
5. DC-29 `UndoToast` в полной форме.
6. `SegmentedControl`.
7. `Switch`.
8. DC-12 `SessionJournalBar` с раскрытием.
9. DC-10 `DocumentAnalysisProgress` в текущей форме.

Тексты и числа взяты из контрактов и синтетической fixture; у витрины не
появился отдельный источник продуктовых значений.

## D. Контракт против текущей реализации

Решения ниже принимают нормативную семантику, но учитывают состояние `src/**`
на момент чтения. «Код уже исправлен» означает, что прежняя находка recheck
больше не требует изменения контракта; это не независимая приёмка прототипа.

| Расхождение ledger/recheck | Решение | Текущее наблюдение / адрес |
|---|---|---|
| Store отдавал изменяемые ссылки и production reset. | Контракт M-4 прав; код должен исключать обход событий. | Уже исправлено freeze/subscriber и test-only reset: `src/state/store.ts:759-791`. |
| OfferSnapshot можно было менять и удалять из массива. | Контракт неприкосновенного snapshot прав. | Уже исправлено deep-freeze и frozen collection: `src/state/store.ts:636-640`. |
| Обычный undo/redo расходился с постоянным курсором. | Контракт адресного undo прав. | Уже исправлено cursor/undone: `src/state/store.ts:698-743`. |
| Conflict resolution раньше мог расходить value/provenance/кандидаты. | Контракт атомарного события прав. | Текущая реализация сохраняет альтернативу и inverse; контракт не смягчается. |
| Тексты активных assumptions были неполной перефразировкой T0. | Нормативный источник прав; код обязан воспроизводить полную семантику. | Текущие GK/KG500 строки восстановлены: `src/screens/S2Vorbereitung.tsx:399-423`. |
| S3 был целиком зажат text-measure. | Layout-contract прав: measure относится к длинному тексту, не workspace. | Текущая глава больше не обёрнута centering max-width: `src/screens/S3Konfigurator.tsx:75-83`. |
| DC-44 не имел direction, scope, ID и details. | Полный контракт DC-44 прав. | Текущий код уже выводит direction/scope, `data-driver-id` и OriginPopover: `src/components/OfferPanel.tsx:265-331`. |
| DC-28 показывал только delta без future total/context. | Полный контракт DC-28 прав. | Future total/label/context уже добавлены: `src/components/OfferPanel.tsx:177-207`, `src/state/store.ts:680-694`. |
| DC-12 считал все события как изменения цены. | Контракт денежного журнала прав. | Исправлено фильтром `deltaExact !== null`: `src/components/OfferPanel.tsx:72-82`. |
| Formatter ставил знак перед prefix приблизительности. | Контрактный порядок прав и должен быть один во всех местах. | Исправлено единым `signed()`: `src/components/OfferPanel.tsx:515-529`. |
| Постоянный Undo был активен при пустом cursor. | Контракт доступности прав. | Исправлено `canUndo()`: `src/state/store.ts:710-715`, потребитель `src/components/OfferPanel.tsx:480-484`. |
| Shell i18n был смешанным. | Контракт key-based shell прав. | Header и Sidebar теперь используют `t(...)`: `src/App.tsx:74-91`, `src/components/Sidebar.tsx:45-52`. |
| Presentation profile должен проходить preflight и исключать внутренние данные. | Контракт DC-22/output-model прав; прямой mode switch не равен preflight. | Код всё ещё вызывает `setMode` напрямую (`src/App.tsx:74-87`, `src/state/store.ts:748-751`) и безусловно показывает benchmark snapshot ID (`src/components/OfferPanel.tsx:245-249`). Нужны preflight, явный выход и audit-events. |
| Toast duration был назван CSS-токеном. | Код прав по архитектурному слою: окно действия — UI-policy, не theme token. | Контракт уточнён в `design-system/README.md`; устаревший комментарий требует правки в `src/components/UndoToast.tsx:16`, реализация уже читает `src/config/ui-policy`. |
| DC-21 вставлен внутрь абзаца, хотя открытый popover рендерит block-content. | Контракт dialog/list прав; host обязан допускать его DOM, а не создавать недопустимое вложение. | Тест проходит, но React печатает три `validateDOMNesting` warning: host-абзацы `src/components/OfferPanel.tsx:103-128,134-159` содержат `span`-root DC-21, внутри которого появляются `div/p/ol` из `src/components/OriginPopover.tsx:77-130`. Нужна разметка без block-descendant внутри `<p>`. |

### Примитивы: локальная блокировка и возможность спецификации

Все 22 примитива глобально остаются `alpha` из-за TOKEN-005. Ниже более
полезное локальное разделение: можно ли закрыть именно контракт примитива без
решения владельца по одной из 17 записей §6a.

| Множество | Примитивы |
|---|---|
| Реализованы, локально owner-blocked | `Button` (destructive и pressed secondary/ghost), `RadioCardGroup`, `Switch`. |
| Не реализованы, локально owner-blocked | `Tooltip`, `Link`, `Slider`, `CheckboxCard` (общая геометрия indicator). |
| Реализованы, локально специфицируемы | `SegmentedControl`, `Tabs`, `NumericInput`, `Skeleton`. |
| Не реализованы, локально специфицируемы | `Dialog`, `SaveStatus`, `KeyboardShortcutService`, `ShortcutHelpDialog`, `DataTable`, `DisclosureRow`, `Badge`, `Card`, `Chip`, `FormField`, `Textarea`. |

Отдельно от списка 22 блокируются shared `Toast/UndoToast`, DC-28 hover-preview
и presentation-banner DC-22. Для `Link` исходное требование внутренне
несовместимо: один цвет нельзя одновременно сделать достаточно контрастным к
белой поверхности и к соседнему тёмному тексту; proposal поэтому меняет
вторую проверку на постоянный non-color cue, а не маскирует математику.

## E. ADR — предложения, не решения

В `design-system/components-core.md` §10.1 добавлены ровно 17 предложений для
17 записей без значения из `docs/audit/adr-blocking.md` §6a. Каждая строка
помечена `[provisional]`, содержит обоснование и требуемую проверку. Ни одно
из этих предложений не объявлено принятым и не опубликовано автоматически в
`tokens.css` или UI-policy.

Файл `docs/audit/adr-drafts-260806.md` не изменён: он находится в зоне
`docs/**` другого потока по `PROTOCOL.md` §2-bis. Предложения помещены в
контракт и продублированы здесь, чтобы выполнить содержательную часть этапа
без конфликта владения.

| # | Предложение `[provisional]` | Что ждёт владельца / что блокируется |
|---:|---|---|
| 1 | destructive default `#C23847` | Button destructive default. |
| 2 | destructive hover `#B83240` | Button destructive hover. |
| 3 | destructive pressed `#A12835` | Button destructive pressed. |
| 4 | destructive text `#FFFFFF` | Полная destructive state-pair. |
| 5 | secondary pressed `#DEDEDE` | Button secondary pressed. |
| 6 | ghost pressed `#DEDEDE` | Button ghost pressed. |
| 7 | link `#005FCC` + постоянное подчёркивание и изменение критерия adjacent-text | Link; требуется именно решение критерия. |
| 8 | inverse surface `#1F1F1F` | Tooltip и inverse `kbd`. |
| 9 | tooltip max-width `40ch` | Tooltip reflow. |
| 10 | toast max-width `52ch` | Toast/UndoToast и collision с S3. |
| 11 | hover-preview delay `200ms` | DC-28/hover preview. |
| 12 | default toast UI-policy `6000ms` | Toast lifecycle. |
| 13 | undo toast UI-policy `8000ms` | UndoToast action window. |
| 14 | control indicator `20px` | RadioCardGroup/Switch indicator. |
| 15 | slider thumb visual `20px` | Slider geometry. |
| 16 | slider track `4px` | Slider geometry и forced-colors. |
| 17 | presentation banner layer `15` | DC-22 banner/collision order. |

`B=17` означает число решений владельца, а не число уникальных компонентов:
один компонент может зависеть от нескольких строк. До их принятия ни один
компонент не получает `beta`/`stable`.

## Что нельзя подтвердить без запуска прототипа

- что React действительно подключит `components.css`, воспроизведёт его
  обязательную DOM-структуру и перестанет дублировать visual rules;
- computed layout на 1280/1440/1920, zoom 200%, overflow и collision постоянной
  price-panel, dialog, popover, tooltip и toast;
- реальный keyboard/focus route, Esc верхнего слоя, возврат фокуса, native
  radio arrows, screen-reader announcements и forced-colors;
- timing hover/touch preview, pause/resume toast, reduced-motion и отсутствие
  layout shift;
- визуальная эквивалентность витрины до/после извлечения CSS и фактическая
  загрузка Visuelt Pro в браузере;
- server/DOM boundary всех client profiles: статический поиск находит
  безусловный benchmark ID, но отсутствие остальных внутренних данных требует
  runtime-проверки каждого output profile;
- печать/PDF/email/delivery: в прототипе это остаётся симуляцией.

## Самопроверка поставки

- `python3 tools/verify.py` — PASS: новых нарушений 0, непроведённых проверок
  0; отдельно напечатаны 48 зарегистрированных известных нарушений, главным
  образом в не пересобранном `design-system/preview.html`.
- `npm test -- --run` — PASS: 4 файла, 84/84 теста. Прогон не бесшумен:
  три `validateDOMNesting` warning DC-21 зафиксированы отдельной строкой этапа D.
- `npm run typecheck` — PASS.
- `npm run build` — PASS: 416 модулей.
- Статические проверки: 28/28 старых токенов отсутствуют; `<style>` = 0;
  `:root` = 0; уникальных `.a3-*` классов = 235; неразрешённых CSS custom
  properties = 0; статических классов HTML без `a3-` = 0.
- Это самопроверка автора и по `PROTOCOL.md` не заменяет независимый прогон
  второго инструмента.
