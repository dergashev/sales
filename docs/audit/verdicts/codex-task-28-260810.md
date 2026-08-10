ЗАДАНИЕ 28: правок дизайн-системы 2 · ключей поставки 2 · elementFromPoint на трёх ширинах: пройдено

# Половины дизайн-системы и orphan-ключи

## 1. Toast: невидимый слой больше не принимает указатель

В `design-system/components.css:472-475` fixed-хост `.a3-toasts` стал
pointer-inert, `.a3-toast:not(.a3-show)` явно получает `pointer-events:none`,
а только `.a3-toast.a3-show` восстанавливает `pointer-events:auto`. Это
закрывает и карточку, и пустую область хоста: одного `opacity:0` для этого
недостаточно.

Контракт закреплён в DC-29 (`design-system/README.md:1676-1703`) и в
примитиве Toast (`design-system/components-core.md:1499-1504,1541-1544`).
Витрина больше не форсирует видимость через specimen-CSS: оба видимых
образца несут настоящий `.a3-show` (`design-system/all3-design-system.html:663-668,827`),
а runtime-образец при начале ухода ставит `aria-hidden`, отключает действия
и только затем снимает класс (`:1033-1041`).

Проверка жизненного цикла в Chromium:

| Состояние | computed pointer-events | `elementFromPoint` в прежней области |
|---|---|---|
| пустой host / hidden toast | `none` | underlying button |
| `.a3-show` | `auto` | toast |
| immediate exit, DOM ещё существует | `none` | underlying button |
| после удаления | — | underlying button |

На immediate exit дополнительно подтверждены `aria-hidden=true` и
`disabled=true` у действия; после exit `toastCount=0`.

## 2. Journal: псевдоэлемент локализован

`design-system/components.css:633-634` делает существующую
`.a3-journal-disclose` positioned containing block. Её реальная кнопка уже
имеет ширину `100%` и минимальную hit-zone 44 px, поэтому декоративный
`::before` исключён из hit-testing через `pointer-events:none`. Новый класс
или carrier в `src` не нужен.

Ограничение внесено в контракт DC-12
(`design-system/README.md:1580-1585,1628-1631`) и названо рядом с живым
образцом витрины (`design-system/all3-design-system.html:695-701`).

## Browser acceptance

Проверен живой Export после полного happy path и подтверждения
классификации. На каждой ширине измерены все видимые CTA сначала в compose,
затем в preflight: `Druckansicht öffnen`, `Weiter zum Preflight`,
`Kundenansicht prüfen`, `Rückgängig`, затем `Zurück` и
`Preflight bestanden — weiter`.

| viewport | центральная колонка | CTA compose + preflight | корректный owner `elementFromPoint(center)` | disclosures |
|---:|---:|---:|---:|---:|
| 1100 px | 300 px | 4 + 5 | 9/9 | 3/3 |
| 1440 px | 640 px | 4 + 5 | 9/9 | 3/3 |
| 2040 px | 1240 px | 4 + 5 | 9/9 | 3/3 |

Итого CTA — **27/27**, disclosures — **9/9**. У всех disclosure-root
computed `position:relative`; у двух реально сгенерированных `::before` —
`pointer-events:none`, третий без pseudo-content также возвращает себя.
Ключевой CTA `Preflight bestanden — weiter` вернул сам button во всех трёх
точках: `(510; 1326)`, `(787,73; 766)` и `(1154,59; 582)` соответственно.
Console/page errors — 0.

## Проверка прочих opacity-состояний

Повторно просмотрены все `opacity:0` / hidden-селекторы
`design-system/components.css`.

- `.a3-hk-pop` и `.a3-modal-scrim` уже имеют симметричные
  `pointer-events:none/auto`.
- `.a3-chip-src.a3-fade`, `.a3-delta`, `.a3-ghost`, loader phase и
  selection marks — неинтерактивные состояния в собственном normal-flow
  слоте; соседние CTA они не перекрывают.
- Закрытый product `.a3-pop` дополнительно удалён из layout атрибутом
  `hidden`; это не opacity-only overlay.
- `.a3-ann.a3-gone` и entrance `.a3-reveal .a3-sheet` принадлежат поведению
  витрины. Pointer-only правка оставила бы их controls в Tab-порядке, поэтому
  частичное CSS-«лечение» не добавлялось: полноценный вариант требует
  синхронного `inert`/focus-контракта, а не относится к двум product-дефектам
  TASK-28.

Новых product-overlay состояний, способных перекрыть соседний CTA, в этом
проходе не найдено.

## Поставка EN № 6

`docs/audit/verdicts/content/i18n-en-6-260810.md` содержит ровно два ключа
со статусом `draft`. Для обоих выбран именованный brace-placeholder
`{amount}`:

- немецкий pattern — `{amount} gegenüber Aufnahme`;
- английский pattern — `{amount} compared with inclusion`.

`amount` — целый locale-aware money token со знаком, числом и единственным
знаком валюты. Шаблон не добавляет `−` или `€`; это исключает возврат
двойного currency sign. Подключение словаря и интерполяции остаётся адресным
handoff владельцу `src/**`, который этой задачей не изменялся.

## Автоматические проверки

- `npm run verify` — 0 новых нарушений; 4 зарегистрированных известных,
  21 предупреждение; все предупреждающие ветки прошли без провалов.
- `npm test` — 12/12 файлов, 175/175 тестов.
- Playwright/Chromium live acceptance — CTA 27/27, disclosures 9/9,
  toast hidden/show/exit пройден, console/page errors 0.
- `git diff --check` по файлам TASK-28 — без замечаний.
