ПАНЕЛЬ: решение A=токен · тотал 10 цифр помещается: да · примитивов добавлено: 4 · переименований для src: 0

# TASK-15 · панель и продуктовые примитивы

Дата проверки: 06.08.2026. Зона изменений: `design-system/**`; `src/**` не изменялся.

## A. Панель DC-38

Выбран вариант с токеном: `--panel-right-width` увеличен с 400 до **520 px**, пометка
`[ADR-PENDING]` у токена снята. Container query не выбран: его существующий narrow-рецепт
понижает Display Numeric ниже обязательных 64/68 и тем самым создаёт конфликт с правилом 31.

Расчёт берёт консервативно измеренную ширину строки `≈ 10.489.000 €` в Visuelt Pro —
463,23 px — плюс `2 × --space-5` (48 px) и левый border 1 px: 512,23 px. Значение округлено
вверх до следующего шага 8-px сетки — 520 px.

Проверка в браузере на итоговой витрине:

- DE `≈ 10.489.000 €`: 459,875 px при 64/68; доступная внутренняя ширина 471 px;
- EN `≈ 10,489,000 €`: 459,875 px при 64/68; доступная внутренняя ширина 471 px;
- переполнения, переноса и горизонтального scroll нет;
- в реальном OfferPanel при viewport 1100 / 1280 / 1440 / 1920 px ширина aside = 520 px,
  `scrollWidth = clientWidth`, документ также не получает горизонтальный scroll;
- после переключения реального прототипа на EN тотал сохраняет 64/68 и помещается.

Адреса правок:

- `design-system/tokens.css:425` — принятое измерением значение токена и арифметика;
- `design-system/README.md:39` — shell-grid использует 520 px;
- `design-system/README.md:521` — host invariant DC-38: минимум 520 px без уменьшения
  64-px тотала, переноса и scroll;
- `design-system/all3-design-system.html:735` — отдельная DE/EN геометрическая проба.

## B. Продуктовые примитивы

Существующие классы узаконены как публичный component API, поэтому миграция потребителей
в `src` не нужна.

| Примитив | Публичные классы | Что зафиксировано |
|---|---|---|
| SectionSheet | `.a3-sheet`, `.a3-sheet-title`, `.a3-sub` | поверхность, 48-px padding, 24-px rhythm, H2 и narrow-режим |
| PageHeader | `.a3-masthead`, `.a3-hero-title`, `.a3-meta`, `.a3-lede` | title/meta baseline, отдельная lede-строка, H1 desktop/narrow |
| SmallText | `.a3-cap` | роль Small 14/20, secondary text, семантический HTML по содержанию |
| InlineLink / LinkButton | `.a3-linkbtn` | нативные `a`/`button`, зона не меньше 44×44, underline и двухслойный focus |

Таблица переименований старое → новое отсутствует: все потребляемые имена сохранены,
**M = 0**.

Контракт каждого примитива описывает назначение, анатомию, геометрию, клавиатуру,
screen reader, токены и запреты. Для SectionSheet, PageHeader и SmallText семь data states
названы неприменимыми к layout/typography-root: эти roots не загружают и не интерпретируют
данные, а дочерний data carrier по-прежнему обязан реализовать
`loading / empty / partial / ready / error / stale / permission`. Для LinkButton перечислена
граница его состояния и состояния целевого объекта; permission/loading не маскируются цветом.

Адреса правок:

- `design-system/components-core.md:2002` — четыре полных продуктовых контракта;
- `design-system/components.css:6` — классы удалены из списка showcase-only;
- `design-system/components.css:25` — реестр публичных примитивов;
- `design-system/components.css:33` — SectionSheet;
- `design-system/components.css:50` — InlineLink / LinkButton и 44-px hit area;
- `design-system/components.css:648` — PageHeader и SmallText;
- `design-system/all3-design-system.html:718` — совмещённый specimen всех четырёх
  примитивов.

Ручная focus-проверка `.a3-linkbtn`: размер 145,58×44 px; `outline` 2 px,
`outline-offset` 2 px, белый separating shadow и постоянное подчёркивание присутствуют.

## Проверки

- `npm run verify` — PASS: 0 новых нарушений, 7 известных открытых, 10 warnings;
- `npm run build` — PASS; только штатное предупреждение Vite о chunk > 500 kB;
- `git diff --check` — PASS;
- browser geometry/focus — PASS для DE, EN и четырёх проверенных viewport.

## Handoff в чужие зоны

- `docs/audit/adr-blocking.md:82` всё ещё содержит устаревшие 400 px и требование ADR;
  владельцу audit-registry нужно синхронизировать запись с принятым токеном 520 px.
- `src/components/OfferPanel.tsx:130` всё ещё содержит временный `overflow-x-auto` на тотале.
  После перехода на 520 px фактического overflow нет; владельцу `src/**` можно убрать
  workaround, не меняя кегль и не добавляя перенос.
