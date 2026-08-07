ДОЛГИ: Select добавлен: да · DC-21 решение: вариант 2 · CONTRAST-UNREG закрыт: да · NBSP в поставке № 1: исправлен

# TASK-20 — долги дизайн-системы

Дата: 07.08.2026  
Исполнитель: Codex

## A. Select

Самостоятельный контракт `Select` добавлен в
`design-system/components-core.md` рядом с FormField. Он фиксирует:

- нативный `<select>` при четырёх и более значениях по `LOCALE-004`;
- hit-zone не меньше 44 px и двухслойный focus indicator;
- `disabled` без opacity, с читаемым значением и видимой причиной через
  `aria-describedby`;
- ширину `100%` с `min-width: 0`, ellipsis только для визуального выбранного
  значения и сохранение полного доступного имени;
- long-content/pseudolocale до +35 % без расширения grid или панели;
- запрет placeholder вместо видимого `<label>`;
- все семь data states: `loading`, `empty`, `partial`, `ready`, `stale`,
  `error`, `permission`.

В `design-system/components.css` опубликованы новые классы для миграции
потребителей:

| Класс | Назначение |
|---|---|
| `.a3-select-field` | Нативный `<select>`: геометрия, типографика, long-value, focus и disabled. |
| `.a3-form-disabled-reason` | Видимая причина отключённого select, связанная через `aria-describedby`. |

Существующая обвязка `.a3-form-field`, `.a3-form-helper` и `.a3-form-error`
переиспользуется. В витрине добавлены ready/long-value и disabled-примеры.
Инвентарь обновлён до 23 контрактов: 17 готовы, 6 ждут владельца.

Адрес миграции приложения: `src/screens/OpportunityList.tsx:86-106` — снять
локальную строку utility-классов `selectCls`, поставить `.a3-select-field`,
а при disabled выводить `.a3-form-disabled-reason`.

## B. DC-21

Выбран вариант 2: позиционирование принадлежит приложению, когда host имеет
собственную прокрутку или `overflow`; дизайн-система владеет видом.

Контракт в `design-system/README.md` теперь различает две ветки:

- inline-host без клиппинга использует дефолт класса `.a3-hk-pop` —
  `position: absolute; right: 0`;
- overflow-host портирует тот же `role="dialog"` в `body`; приложение задаёт
  `position: fixed`, `top`, `left`, пересчитывает координаты на scroll/resize
  и ограничивает их viewport с `--gutter-narrow`.

Новый портальный класс не вводился. Приложение не должно переопределять
рамку, фон, ширину, padding, типографику, motion или layer — только три
геометрических свойства и их вычисление. Это соответствует уже реализованной
ветке `src/components/OriginPopover.tsx` и устраняет конфликт контракта с
реальным host.

## C. CONTRAST-UNREG

Из `design-system/tokens.css` удалены два числовых утверждения об отвергнутой
палитре, для которой в системе нет цветовых пар. Текст сохраняет решение:
осветление не обеспечило достаточного различия и было отменено.

Это закрывает обе записи `CONTRAST-UNREG`, но не маскирует `COLOR-004`:
конфликт dataviz/status остаётся открытым в `docs/audit/adr-blocking.md` и
по-прежнему требует отдельной утверждённой палитры либо отказа от цвета в
статусах.

## D. U+00A0

В `docs/audit/verdicts/content/i18n-en-260806.md` исправлены оба U+00A0:

- `0 €` в `qa.state.partialNote`;
- `3.818.000 €` в пояснении формата валюты.

В файле теперь U+00A0: 0; обе пары используют U+202F.

## Проверки

- `npm run verify` — PASS: новых нарушений 0, известных открытых 4 вместо 7;
- обе записи `CONTRAST-UNREG` и запись NBSP больше не срабатывают;
- `CORE-AXES` принимает семь состояний нового Select;
- статические проверки подтвердили наличие контракта, обоих классов и двух
  образцов витрины;
- `git diff --check` — PASS.
