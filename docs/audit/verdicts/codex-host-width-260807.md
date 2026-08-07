ХОСТ: сетки на container queries: да · при колонке 300 px клиппинга нет: да · слоты: вариант 2 · медиа-слот: порог назван

# TASK-22 · компонент подстраивается под хост

Дата: 07.08.2026. Изменена только зона `design-system/**` и добавлен этот отчёт; `src/**` не изменялся Codex.

## A. Сетки по ширине контейнера

Добавлен публичный носитель `.a3-grid-host`:

```css
.a3-grid-host { container: a3-grid-host / inline-size; }
```

`.a3-ogrid` и `.a3-fgrid` больше не получают число колонок из viewport `@media`. Их база — одна колонка; пороги вместимости хоста дают 2 / 3 / 4 колонки, где четыре — потолок. У grid, host и tile задан `min-inline-size: 0`; ширина сетки ограничена хостом (`design-system/components.css:396-417,485-530`). Viewport в этом контракте не участвует.

Прогон в Brave/Chromium на изолированных хостах:

| inline-size хоста | `.a3-ogrid` | `.a3-fgrid` | grid / scrollWidth | плиток снаружи |
|---:|---:|---:|---|---:|
| 300 px | 1 колонка · tile 300 px | 1 колонка · tile 300 px | 300 / 300 px | 0 |
| 640 px | 2 колонки · tile 312 px | 2 колонки · tile 312 px | 640 / 640 px | 0 |
| 1240 px | 4 колонки · tile 298 px | 4 колонки · tile 298 px | 1240 / 1240 px | 0 |

Узкое правило `.a3-fgrid` удалено из viewport `@media`; оставшиеся media queries в конце CSS отвечают за page typography/navigation/print, а не за раскладку этих двух компонентов.

## B. Слоты — вариант 2

Выбран вариант **«резервировать высоту самого высокого состояния»**, без clip и внутреннего scroll:

- DC-28 несёт три обязательные смысловые строки: будущий total, delta с baseline, preview-run. Четвёртая визуальная строка зарезервирована для одного переноса на DE/EN +35%. `--size-ghost-row = 4 × --type-body-line = 96 px`.
- DC-2 допускает две visual rows. `--size-delta-row` считает две small-line, row-gap, padding и border и равен 58 px на текущих токенах.
- Пятая visual line ghost и третья delta не являются состоянием: автор контента обязан сократить строку или вынести детали в поповер.

Браузерное измерение при ширине контента 471 px:

| состояние | ghost slot / content | delta slot / content | сдвиг нижнего маркера |
|---|---|---|---:|
| пустое | 96 / 0 px | 58 / 30 px | — |
| четыре visual ghost lines + две delta rows | 96 / 96 px | 58 / 58 px | **0 px** |

Контракты и specimen обновлены в `design-system/README.md:501-512,637-646,704-714`, `design-system/components-core.md:419-455` и `design-system/all3-design-system.html:78-82`.

## C. Минимальная ширина медиа

Назван токен `--measure-option-media-min: 15rem` (`[provisional]` до ADR). Каждая `.a3-okc-tile` / `.a3-fk` сама является inline-size container. 4:3 `.a3-option-media` / `.a3-img` рендерится только при ширине content box плитки не меньше 15 rem. Ниже порога медиа исчезает целиком; label, description, price/consequence, state, input и hit target остаются. Прогон: при host 230 px медиа `display:none`, при 300 px — `display:block`; полоски нет.

Новый токен добавлен, а значения `--size-ghost-row` и `--size-delta-row` изменены. Токены не переименовывались и не удалялись. До утверждения 15 rem в ADR DC-20/DC-40 сохраняют `alpha`, что записано в `design-system/README.md:4117-4136`.

## Handoff в `src/**`

Codex не правит зону Claude. Для подключения контракта нужны только следующие правки разметки:

1. `src/components/controls.tsx:205-224` — добавить `.a3-grid-host` на `fieldset`-предка `.a3-ogrid`.
2. `src/components/controls.tsx:343-346` — добавить `.a3-grid-host` на `fieldset`-предка `.a3-fgrid`.
3. `src/components/OfferPanel.tsx:284-304` — обернуть три смысловые строки ghost в `.a3-ghost-line`; строка partial-scope может занять четвёртую visual line, но не пятую.

Медиа не требует нового атрибута: size-container живёт на самой плитке. Существующие `hidden` по error, пустой `alt`, label и price fallback остаются без изменений.

`npm run verify` после правок дизайн-системы: **0 новых нарушений**, warning selftest 13/13. До подключения handoff проверка честно показывает `.a3-grid-host` как невзятый класс DC-20/DC-40; это ожидаемый адресный handoff, а не маскировка.
