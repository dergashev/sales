ЗАКРЫТИЕ: сырых значений устранено 244 из 244 · DC покрыто 45 из 45 · примитивов готово к сборке 16, ждут владельца 6 · ADR доведено 17 из 17

# Закрытие скоупа дизайн-системы · TASK-11 · 06.08.2026

## Вердикт

Этапы A–E выполнены в разрешённой зоне. `design-system/components.css` остаётся единственным
общим визуальным источником: существующие `a3-*` не переименованы, добавлены только новые
классы. Устаревший `design-system/preview.html` удалён; снимок восстановим из истории git.

## A. Сырые значения

Контрольный скан значений деклараций, после исключения содержимого `var(...)`, даёт:

| Класс | Было | Осталось |
|---|---:|---:|
| литеральные `px` | 236 | 0 |
| литеральные `rgba(...)` | 8 | 0 |
| всего | 244 | 0 |

**Остаточные сырые значения адресами:** отсутствуют.

Что сделано:

- величины из утверждённых шкал переведены на существующие spacing, type, control, icon и
  border tokens;
- геометрия, округление которой заметно меняло бы пропорции контрола, диаграммы или
  placeholder-материала, перенесена без изменения в локальную группу `[provisional]` в
  `tokens.css`; комментарий фиксирует источник и обязательность отдельного ADR;
- альфы разделены по назначению: grid line, neutral data-viz bar, disabled outline, mortar и
  window placeholder получили разные semantic-алиасы; текстовые альфы заменены существующими
  `--color-text-secondary` / `--color-text-muted`;
- SVG data URL, в который нельзя корректно подставить CSS custom property, заменён
  токенизированным CSS-gradient для того же placeholder-назначения;
- единственная responsive-граница записана как `47.5rem`, потому что custom properties не
  разрешены в условиях обычного `@media`; геометрия при базовом размере шрифта сохранена.

Строки `1px` / `2px` внутри имён существующих токенов (`--border-contrast-1px`) не являются
значениями деклараций и контрольным счётчиком не учитываются.

## B. Покрытие DC

Сверка 45 заголовков вида `### DC-NN` в `README.md` с владельцами `DC-NN` в
`components.css` даёт **45/45**.

Семь исходных пробелов закрыты так:

| DC | Ответ | Эталон |
|---:|---|---|
| 23 | образец уже существовал, добавлена явная принадлежность | `.a3-preflight-list` |
| 27 | образец уже существовал, добавлена явная принадлежность | `.a3-nextstep` |
| 28 | образец уже существовал, добавлена явная принадлежность | `.a3-ghost-slot > .a3-ghost` |
| 30 | образец уже существовал, добавлен структурный контракт | `.a3-savechip` |
| 34 | добавлены класс и самостоятельный образец | `.a3-project-search` |
| 37 | добавлен внутренний `alpha`-образец | `.a3-scope-line-item`; клиентское применение всё ещё ждёт PO по `README` §2.8 №2 |
| 45 | образец уже существовал, добавлена явная принадлежность | `.a3-seg` |

**Непокрытые DC с причиной:** отсутствуют.

## C. Один действующий визуальный источник

`design-system/preview.html` удалён как устаревший рабочий дубль. Действующая витрина —
`design-system/all3-design-system.html`, подключающая `tokens.css` и `components.css`.
Удаление сняло 41 ранее зарегистрированное нарушение `verify` (48 известных до удаления,
7 после), включая старые privacy и A11Y дефекты дубля.

## D. 22 контракта примитивов

Критерий разделения: **ждёт владельца**, если контракт прямо ссылается на токен без принятого
значения; прежний CSS-скелет не считается готовностью. **Готов**, если опубликованных токенов
достаточно для класса и эталона. Для поведенческого `KeyboardShortcutService` отдельная
visual root-класса намеренно нет; его видимое состояние доказано через
`ShortcutHelpDialog` и settings-switch.

Инвентарная поправка к заданию: в `components-core.md` действительно 22 заголовка контрактов,
но `Skeleton` среди них нет (это DC-35), а в перечислении задания отсутствовали реальные
`CheckboxCard` и `Toast`.

| Примитив | Результат |
|---|---|
| Button | ждёт владельца: `--color-action-destructive-*`, `--color-action-secondary-pressed`, `--color-action-ghost-pressed` |
| Link | ждёт владельца: `--color-action-link-text` |
| Tabs | готов: `.a3-tabs` + образец |
| SegmentedControl | готов: `.a3-seg` / `.a3-radio-segments` + образцы |
| RadioCardGroup | ждёт владельца: `--size-control-indicator` |
| CheckboxCard | ждёт владельца: наследует `--size-control-indicator` |
| Switch | готов: `.a3-switch-button` + образец |
| FormField | готов: `.a3-form-field` + образец |
| NumericInput | готов: `.a3-input` + образец |
| Slider | ждёт владельца: `--size-slider-thumb-visual`, `--size-slider-track-thickness` |
| Textarea | готов: `.a3-textarea-field` + образец |
| DataTable | готов: `.a3-data-table` + образец |
| DisclosureRow | готов: `.a3-disclosure-row` + образец |
| Card | готов: `.a3-card-core` + образец |
| Badge | готов: `.a3-badge` + status/metadata образцы |
| Chip | готов: `.a3-chip-control` + образец |
| Tooltip | ждёт владельца: `--color-surface-inverse`, `--size-tooltip-max-width`, hover-delay |
| Toast | готов: `.a3-toast` + static/runtime образцы; duration — UI-policy, не visual token blocker |
| Dialog | готов: `.a3-dialog-spec` / `.a3-modal` + образцы |
| SaveStatus | готов: `.a3-save-status` + образец |
| KeyboardShortcutService | готов: поведенческий, без visual root; доказан справкой и настройкой |
| ShortcutHelpDialog | готов: `.a3-shortcut-help` + таблица, конфликты и switch |

Итого: **16 готовы**, **6 ждут владельца**. Та же матрица закреплена в
`components-core.md` §9.1.

## E. Семнадцать ADR

Все 17 строк `components-core.md` §10.1 теперь имеют пять полей: открытая запись,
`[provisional]`-предложение, основание, обязательная проверка и поимённое разблокирование.
Ни одно предложение автоматически не опубликовано как принятое значение.

Разблокирование охватывает `Button.destructive/secondary/ghost`, `Link`, `Tooltip`,
inverse-`kbd`, `Toast`, `UndoToast`, DC-28, `RadioCardGroup`, `CheckboxCard`, geometry-test
`Switch`, `Slider` и presentation banner DC-22. Для UI-policy явно указано, что она завершает
поведение, но не блокирует визуальный класс.

## Проверки

| Проверка | Результат |
|---|---|
| raw-value scan `components.css` | 0 `px` values · 0 `rgba(...)` |
| DC intersection | 45/45 · missing `[]` |
| PostCSS parse | `tokens.css` и `components.css` разобраны без syntax error |
| selector prefix scan | 269 уникальных классов · 0 вне `a3-*` |
| JSDOM specimen scan | все 13 новых обязательных селекторов найдены · duplicate id `[]` |
| `npm run verify` | PASS · 0 новых · 7 известных открытых |
| `npm run typecheck` | PASS |
| `npm test` | PASS · 4 файла · 84/84 теста |
| `npm run build` | PASS · Vite production build |
| `git diff --check` | PASS |

Один ошибочный диагностический запуск `npm test -- --runInBand` был отвергнут Vitest как
неизвестная опция; корректный штатный `npm test` после него прошёл 84/84. Тесты повторяют три
старых React warning о вложении `p` / `ol` / `div` внутрь `p` через
`src/components/OriginPopover.tsx:11` и `src/components/OfferPanel.tsx:39`. `src/**` вне зоны
TASK-11, поэтому исправление не подменялось изменением продукта.

Семь известных открытых `verify` не созданы этой задачей: четыре проверки формулировок
контраста (`tokens.css:211–212`, `docs/audit/adr-blocking.md:62`), две устаревшие цифры
индекса (`TASK-04-stage4-content.md:78`) и один NBSP в отдельной поставке копирайта
(`content/i18n-en-260806.md:424`).
