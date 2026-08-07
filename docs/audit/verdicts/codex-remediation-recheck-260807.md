ПРИЁМКА: принято 13/21 · отклонено 8 (№ 2, 3, 4, 6, 8, 13, 17, 21) · «магазин» 5 из 14 (было 3) · DC-COVERAGE: обязательных доборов 6

# Повторная приёмка ремедиации ревью № 13

Дата прохода: 07.08.2026. Проверен `HEAD f1e38ec` по живому golden path в Brave/Chromium при 1440 × 1000, отдельно геометрия при 1100/1440/1920 и DE/EN. `src/**` не изменялся.

## A. Вердикт по 21 дефекту

«Принят с оговоркой» входит в число принятых: основной механизм дефекта доказан, а остаток вынесен в адресный добор ниже.

| № | вердикт | проверка механизма и адрес |
|---:|---|---|
| 1 | **принят** | Каждая Option получает отдельный `OptionConfig`; уходящая конфигурация сохраняется, открываемая восстанавливается (`src/state/store.ts:497-512, 1165-1231`). `projectionForOption` считает и неактивную Option. Journal/Undo ограничены `optionId` (`src/state/store.ts:460-470, 688-704, 1095-1118`), снапшот называет Option (`src/state/store.ts:983-1004`). Изоляция, неактивная проекция, Undo и snapshot доказаны тестами `src/state/__tests__/store.test.ts:659-777`. |
| 2 | **отклонён** | 784 ключа не дали полный EN. Мост переводит только точное совпадение с generated-строкой, а несовпавший текст оставляет немецким (`src/i18n/index.ts:103-121`). На каждой из 14 поверхностей golden path остался немецкий chrome/guidance и/или product data; перечень — ниже. |
| 3 | **отклонён** | Таблица формально полна, но причины не все правдивы. `opportunityList.stale` объяснён синхронным импортом, который исключает loading/error, но сам по себе не исключает устаревание (`src/state/data-states.ts:34-41`). `documentAnalysis.stale` выдан за D-08 «не перезаписывать подтверждённое», хотя это не stale-state анализа (`:43-50`). `export.stale` одновременно объявлен implemented и «не устаревает по построению» (`:88-95`). Тест проверяет наличие семи ключей, а не истинность механизма. |
| 4 | **отклонён** | Глава 7 больше не пуста, но утверждает, что риск `+4 % auf KG 320` не влияет на сумму (`src/screens/S3Konfigurator.tsx:502-540`). Это противоречит продуктовому решению о реальной строке надбавки (`docs/product/decisions.md:35-44`) и формуле (`docs/product/calculation-spec.md:58, 87`). Действие только возвращает вопрос в подготовку; разрешить риск или снять надбавку в главе нельзя. |
| 5 | **принят** | Панель действительно использует ширину 520 px и не раздувается: при 1100/1440/1920, DE и EN, `clientWidth = scrollWidth = 519`, правая граница aside равна viewport, документального горизонтального scroll нет; total остаётся примерно на 80 px левее края. Структура героя исправлена в `src/components/OfferPanel.tsx:129-250`, токен — `design-system/tokens.css:429`. |
| 6 | **отклонён** | Portal и валидный DOM исправлены, горизонтальный clamp есть (`src/components/OriginPopover.tsx:58-67, 125-186`); `p div`/`p ol` в DOM нет. Но вертикального clamp/flip нет: при триггере у нижней границы dialog получил `top=1012`, `bottom=1194` при `viewportH=1000`. После открытия фокус остался на `BODY`, поэтому обработчик Esc, подвешенный только на dialog (`:81-107`), не сработал и фокус не вернулся. Реальная прокрутка `main: 0 → 80` слой не закрыла. |
| 7 | **принят** | Новая Option получает fresh config и главу 1 (`src/state/store.ts:1165-1192`). `chapterDone` берёт подтверждение здания, coverage и `besuchteKapitel`, а не номер текущей главы (`:515-537`); ложные done-пути проверены `src/state/__tests__/store.test.ts:742-756`. Комментарий `:519` про невозможность завершить главу 7 устарел, но runtime следует посещению и тесту. |
| 8 | **отклонён** | `scrollTop` теперь сбрасывается (`src/App.tsx:65-72`), live-проверка дала `190 → 0`. Вторая половина заявленного ремонта отсутствует: H1/корневой регион не получает программный фокус, `activeElement` после перехода — `BODY`. Новый документ виден сверху, но клавиатурный/экранный читатель не получает объявление контекста. |
| 9 | **принят** | В главе 9 есть активный следующий шаг к сравнению (`src/screens/S3Konfigurator.tsx:415-427`), в сравнении — к Export (`src/screens/S4Vergleich.tsx:209-220`); одинарная Option получает обратный CTA к карточке (`:156-170`). |
| 10 | **принят** | `Manuell erfassen` открывает подготовку, то есть меняет видимый DOM (`src/screens/OpportunityCard.tsx:133-144`); no-op удалён. |
| 11 | **принят** | Gantt принят полным каркасом: scroll/visual, фазы с подписями, ось, легенда, milestone и открытая табличная альтернатива (`src/components/ScheduleGantt.tsx:102-191`). Empty и некорректный интервал названы (`:73-94`), диаграмма скрыта от AT, таблица сохраняет содержание. |
| 12 | **принят** | Причина disabled стоит в порядке чтения и связана `aria-describedby`; контрол остаётся фокусируемым через `aria-disabled` (`src/components/primitives.tsx:81-119`). |
| 13 | **отклонён** | Engine теперь возвращает типизированные причины, но presentation DOM всё ещё содержит буквальный `CALC-004` из disabled reason (`src/screens/ChapterBuildings.tsx:184-191`). Live-проверка: русских строк нет, `CALC-004` есть. Требование «ни один внутренний ID ни в одном режиме» не выполнено. |
| 14 | **принят с оговоркой** | Поиск/фильтры и карточки собраны на DC-34/DC-15, filter chip — настоящий 44 px control (`src/screens/OpportunityList.tsx:90-145`). Для текущей карточки со встречей «morgen 14:00» не принят обязательный вариант `.a3-urgent`; это отдельный DC-добор. |
| 15 | **принят с оговоркой** | Общие option tiles используют `.a3-ogrid/.a3-okc-tile`, фасад — `.a3-fgrid/.a3-fk/.a3-img` (`src/components/controls.tsx:205-263, 321-366`), native radio semantics сохранены. Визуалы пока placeholder-уровня; поставка реальных локальных изображений вынесена в TASK-18. |
| 16 | **принят с оговоркой** | Заявленные корни приняты: Vergleich `.a3-cmp` (`src/screens/S4Vergleich.tsx:173-200`), анализ `.a3-analysis-*` (`src/components/DocumentAnalysis.tsx:71-151`), Export `.a3-mailcard/.a3-preflight-list/.a3-paper-preview` (`src/screens/S5Export.tsx:132-239`). Вложенные document rows всё ещё не DC-17 — это обязательный добор и часть отклонённого дефекта 17. |
| 17 | **отклонён** | Classes-контракты всё ещё собраны частично. Conflict не имеет `.a3-kv` (`src/screens/OpportunityCard.tsx:149-180`); toast не имеет host `.a3-toasts`, state `.a3-show` и action `.a3-act` (`src/components/UndoToast.tsx:65-100`); `.a3-journal-spec` ошибочно начинается на самом `<ol>`, а disclosure остаётся снаружи (`src/components/OfferPanel.tsx:581-612`); строки DC-44 не получают `.a3-base/.a3-minus` (`:389-458`). |
| 18 | **принят** | TASK-15 перевёл `sheet/masthead/hero-title/lede/cap/linkbtn` из showcase-only в поддерживаемый product API; источник статуса — `design-system/components.css:25-40` и `docs/audit/verdicts/codex-panel-primitives-260806.md`. |
| 19 | **принят** | Активные фильтры — кнопки `.a3-chip-control` с `aria-pressed`, reset и системной 44 px hit-zone (`src/screens/OpportunityList.tsx:128-145`, `design-system/components.css:123-124`). |
| 20 | **принят** | Копирование имеет отдельные success/error сообщения, включая отсутствие Clipboard API и rejected promise (`src/screens/S2Vorbereitung.tsx:383-400`). |
| 21 | **отклонён** | В панели появился список выбранных отклонений (`src/components/OfferPanel.tsx:109-115, 317-340`), но фильтр пропускает только `opt_/cov_/kg700_`: выбор basement `untergeschoss_*` изменил сумму, а recap продолжил говорить «Standardumfang». Главное требование — side-by-side preview до commit — отсутствует: ghost показывает одно будущее число, а `.a3-cmp` сравнивает только уже созданные Options (`src/screens/S4Vergleich.tsx:35-140`). |

## B. UX/UI по тем же 14 поверхностям

Шкала та же: «магазин» требует одновременно видимого выбора и его последствия, а не только более аккуратной рамки.

| поверхность | решений одновременно | до видимого последствия цены | язык | прогресс / следующий шаг | безопасность эксперимента | плотность | вердикт |
|---|---|---:|---|---|---|---|---|
| Список | 4 фильтра + карточки | — | DE чистый; EN смешан | корень и CTA ясны | фильтры обратимы, empty назван | умеренная | **между** |
| Opportunity | файл, конфликт, параметры, gate | 3–4 действия до первой цены | EN почти целиком DE | ring 2/2 и путь к Option видны | Undo; manual capture живой | очень высокая | **между** |
| Глава 1 | scope, классификация, energy | 1 | много DIN/MBO; EN смешан | честнее, но focus не переносится | preview/Undo не у каждого факта | таблицы + controls, местами clip | **налоговая форма** |
| Глава 2 | до 9 групп | 1 | опции понятны; EN guidance/data смешаны | chapter + next | цена до commit, ghost, Undo | длинный каталог | **магазин** |
| Глава 3 | 4 coverage-решения | 1 | KG/coverage; EN смешан | next есть | Undo, но нет side-by-side preview | сегменты формы | **налоговая форма** |
| Глава 4 | несколько инженерных групп | 1 | технический DE; EN смешан | chapter + next | ghost/Undo | длинный каталог | **магазин** |
| Глава 5 | energy + certificates | 1 | наиболее клиентский; EN смешан | chapter + next | ghost/Undo + confirmation | умеренная | **магазин** |
| Глава 6 | 3 факта + basement | 1 | площади/статусы; EN смешан | chapter + next | ghost/Undo | форма и плитки | **между** |
| Глава 7 | 0 разрешаемых решений | нет | guidance неверен; EN остаётся DE | можно только уйти | эксперимента нет | разреженно | **налоговая форма** |
| Глава 8 | 1 способ расчёта | 1 | HOAI/AHO; EN смешан | chapter + next | Undo, без полезного preview | разреженно | **между** |
| Глава 9 | 0, только schedule | нет | даты читаемы; EN смешан | CTA к Vergleich есть | только просмотр | Gantt + таблица | **между** |
| Правая панель | 3 героя, recap, 2 disclosures, gate | мгновенно | сильные метрики, но EN смешан | gate + journal | ghost/Undo; live delta сломан | высокая | **между** |
| Vergleich | созданные Options рядом | последствие уже рядом | технический; EN смешан | CTA к Export | варианты изолированы и воспроизводимы | плотная таблица | **магазин** |
| Export | 6 artifacts, discount, письмо | 1 для discount | DE/EN смешаны | Compose → Preflight → Confirm | immutable snapshot, проверка до send | две колонки | **магазин** |

Новый счёт — **5 из 14**. Изменившиеся вердикты:

- Opportunity: **«налоговая форма» → «между»** — анализ получил явный протокол/error remedy, manual capture стал действием, gate и 2/2 дают маршрут; экран всё ещё слишком длинный и смешивает подготовку с реестром фактов.
- Vergleich: **«между» → «магазин»** — колонки теперь являются живыми изолированными Options, дельты считаются к названной базе и есть CTA к Export.
- Export: **«налоговая форма» → «магазин»** — видны состав пакета, редактируемое письмо, Preflight и A4-preview до необратимой отправки.

Глава 9 стала содержательной благодаря полному Gantt, но остаётся read-only следствием, а не поверхностью выбора. Панель получила recap, однако из-за неполного фильтра выбранного, отсутствия side-by-side preview и невидимой live-дельты остаётся «между».

### EN golden path

| поверхность | оставшийся немецкий | характер |
|---|---|---|
| Список | `8 von 8`, сортировка HubSpot, `Gebäude/Dokumente`, сроки | chrome + fixture data |
| Opportunity | весь анализ, error/remedy, конфликт, параметры, подготовка `2 von 2` | chrome + guidance + data |
| Глава 1 | `Kapitel/Konfigurator`, guidance, метрики, классификация и reason | chrome + guidance + data |
| Глава 2 | вопросы и доказательства каталога, footer guidance | guidance + catalog data |
| Глава 3 | объяснение coverage, состояния и причины неполноты | chrome + guidance + domain data |
| Глава 4 | вопросы систем, provenance и disabled reason | guidance + catalog data |
| Глава 5 | confirmation/status и объяснение сертификатов | chrome + guidance |
| Глава 6 | provenance площадей и basement options | chrome + domain data |
| Глава 7 | весь risk/access блок | guidance + domain data |
| Глава 8 | объяснение методов и выбранный метод | guidance + domain data |
| Глава 9 | объяснение, таблица/легенда срока и provenance | chrome + guidance + data |
| Панель | total label, uncertainty, months, drivers/KG/gate | chrome + engine/domain data |
| Vergleich | caption, группы, labels, uncertainty/time | chrome + domain data |
| Export | названия artifacts, discount/margin, recipient provenance, attachments | chrome + guidance + data |

Итог: EN — не полный UI-язык. Разделение UI-language/artifact-language в комментарии не оправдывает немецкий chrome (`Kapitel`, кнопки, статусы, stage labels) и не обозначено пользователю как частичный режим до переключения.

## DC-COVERAGE

`npm run verify` сейчас печатает **13**, а не обещанные заданием 12 групп. Из них 6 требуют добора в существующем runtime-механизме:

1. **DC-5 CostStructureTable** — живая KG-таблица `src/components/OfferPanel.tsx:492-555` остаётся utility-двойником. Нужен root `.a3-kg` и классы текущей иерархии/total/state/compact из предупреждения; интерактивные `.a3-expand/.a3-twistbtn/.a3-open/.a3-kg-child` нужны при раскрытии уровней, а не декоративно.
2. **DC-15 ProjectCard** — `.a3-urgent` обязателен для worked-card со встречей `morgen 14:00` (`src/fixtures/opportunities.json:12`).
3. **DC-17 DocumentRow** — `.a3-doc/.a3-ic/.a3-pg/.a3-right` обязательны: документы, страницы, версии и status/actions уже находятся на живой Opportunity (`src/components/DocumentAnalysis.tsx:104-145`).
4. **DC-21 OriginPopover** — `.a3-hk-wrap/.a3-hk-val/.a3-hk-pop/.a3-r/.a3-fnum` обязательны вместо второго Tailwind-контракта; live-проход доказал, что текущий двойник не удерживает слой и фокус.
5. **DC-29 Toast** (из общей группы DC-29/DC-33) — `.a3-toasts/.a3-act` и локальный state `.a3-show` обязательны. Modal-классы этой группы опциональны, пока продукт не рендерит contract-dialog.
6. **DC-44 Cost drivers** — `.a3-base` и `.a3-minus` обязательны: базовая строка присутствует всегда, отрицательный driver производим выбором basement.

Остальные 7 групп опциональны для текущей фикстуры/функционального scope: DC-3/DC-16 badge-zone variants; дополнительные DC-16 red/muted statuses; DC-1 fade/stale; DC-11 target-role (роли baseline/active независимы, target не назначен); DC-7 notice dot и mode-card specimen (material blocker нельзя сворачивать); DC-39 type-grid (DC-40 option-grid уже принят, классификация не выбирается); DC-43 notecard (InternalNote не поставлен). Отсутствующий класс не следует добавлять ради процента adoption.

## C. Регрессии и прогоны

| проверка | результат |
|---|---|
| `npm test -- --run` | **129/129**, 7 файлов — прошёл |
| `npm run build` | прошёл; только прежнее предупреждение Vite о chunk 562,05 kB |
| `npm run verify` | прошёл: 0 новых, 7 known-open, 38 warnings; среди них 13 DC-COVERAGE-групп |
| total при 520 px, 1100/1440/1920, DE/EN | **прошёл**: aside 519/519, total внутри, page horizontal scroll отсутствует |
| portal/DOM popover | portal и DOM прошли; viewport/focus/Esc/scroll — **не прошли**, дефект 6 |
| ghost/delta, system-owned motion | inline style на чипе отсутствует и transition берётся из `.a3-delta`, но live state **не прошёл**: `.a3-show` не появился и opacity осталась `0` после 340 ms (`src/components/OfferPanel.tsx:34-41, 297-315`) |
| зарезервированный delta-slot | **не прошёл**: высота слота 29 px, появление двухстрочного чипа сдвинуло recap на 27 px (`design-system/components.css:243`) |
| `prefers-reduced-motion: reduce` | **прошёл**: Gantt и delta имеют `transition-duration: 0s`, `animation-name: none`; Gantt сразу в конечном transform |
| смена главы | scroll `190 → 0` прошёл; focus остался на `BODY`, дефект 8 |
| основная колонка | новая визуальная регрессия: при 1440 длинные option controls/CTA уходят под жёсткую границу 520 px панели; page scroll этого не обнаруживает (`src/App.tsx:95-106`) |

Автотесты доказывают модель Option и арифметику, но не ловят ложные декларации data-state, неполный EN, позиционирование/focus слоя и геометрию delta-slot — именно эти механизмы удерживают партию от полной приёмки.
