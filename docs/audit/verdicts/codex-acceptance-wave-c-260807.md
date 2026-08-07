ВОЛНА C: принято 2/5 блоков · отклонено 3 (№ 2, 4, 5) · «магазин» 7 из 14 (было 5) · немецкого в EN осталось: ≥202 строк

# Приёмка волны C

Дата прохода: 07.08.2026. Объект приёмки не двигался: до и после прохода `HEAD = 25481fcf1cdbd4ef8ca3b0d79f4bc2623fb4d61c`, сводный SHA-256 содержимого `src/**` = `aaac34671b71112949d947756529d71c8dac543fd0144f00a8c9be6f3d4407cb`; diff в `src/**` пуст. Приёмка проводилась по живому golden path в Chromium и по механизмам в исходниках; `src/**` не изменялся.

## A. Пять блоков

| № | блок | вердикт | проверенный механизм |
|---:|---|---|---|
| 1 | Надбавки за риск / третий уровень KG | **принят** | Разбиение KG 300 вычисляется из точной KG 300 до риска; каждый risk driver берёт свою базу, а не всю KG 300 (`src/engine/risk.ts:50-86`, `src/state/store.ts:623-641`). Тест фиксирует сумму восьми долей = 1, KG 320 = 110 000 и 4% = 4 400, а не 40 000 (`src/engine/__tests__/fixture.test.ts:326-353`). Apply создаёт событие с delta/inverse/forward, Undo вернул исходный total (`src/state/store.ts:1356-1384`). Default off принят как решение PO. |
| 2 | 43 изображения опций | **отклонён** | Комплект и механика прошли: 43/43 WebP, все попали в production build; 3 063 648 bytes суммарно, максимум 175 634 bytes. Пара задаётся манифестом, а URL — `import.meta.glob`, без шаблона имени (`src/assets/option-images.ts:1-44`). Битый `<img>` скрывается, пустой `alt`, label и price остаются (`src/components/controls.tsx:250-280`); в браузере остальные 20/20 видимых картинок загрузились после принудительной поломки одной. **Обязательное требование PO выполнено:** QNG Plus/Premium несут официальные знаки, DGNB Silber/Gold/Platin — официальный логотип; они видимы на реальном размере плитки. Блок отклонён только из-за narrow-layout дефекта: при viewport 1100 px `main 300/832`, 83 элемента за границей и 12 image tiles вне `main`; при 1440 px `main 640/832`, 57 элементов и одна плитка вне. При 1920 px клиппинга нет. Адреса: `design-system/components.css:393-397,494-497`, где grid зависит от viewport, а не реальной ширины центральной колонки. |
| 3 | VariantsSideBySide | **принят** | Строка сравнения берёт ту же дельту `(тариф варианта − текущий тариф) × quantity`, что и плитка; `after = currentTotal.plus(delta)` (`src/screens/OptionChapter.tsx:89-140,215-266`). Второго расчёта нет. В golden path запомненная «Angebotssumme danach» совпала с total после выбора той же опции. |
| 4 | Регрессии № 17 | **отклонён** | Исходный background-tab дефект состояния исправлен: сразу после click у permanent delta и toast есть `.a3-show`; rAF-state нет. Reduced motion даёт `transition-duration: 0s`, animation none; фокус после смены главы переходит на `MAIN`, новый H1 верен. Но слоты не фиксируют высоту: ghost 21→96 px сдвигает delta/recap на 75 px; delta-slot 29→31 px сдвигает recap на 2 px (`design-system/components.css:249-252`). Поповер также не прошёл нижнюю границу: при viewport height 500 trigger `287…331`, dialog `343…751`, flip не сработал. `useLayoutEffect` измеряет portal до появления measurable box и не перемеряет его после mount (`src/components/OriginPopover.tsx:56-77`). |
| 5 | DC-33 / DC-30 / DC-43 / DC-14 | **отклонён** | DC-33, DC-30 и DC-43 имеют системные classes и базовую клавиатуру; DC-14 в `src/**` отсутствует. Живые компоненты не имеют семи состояний, а DC-14/DC-30/DC-33/DC-43 не объявлены в `src/state/data-states.ts`. `ClientOutputGateDialog` фокусирует первую кнопку, а не heading/первую failed check, и держит закрытый dialog в DOM (`src/components/ClientOutputGateDialog.tsx:42-78`); прямой `s.setMode(m)` в header обходит единый DC-33 gate (`src/App.tsx:161-178`). `InternalNote` имитирует success таймером, никогда не входит в объявленный error и не имеет loading/stale/permission/read-only; в presentation сам он возвращает `null`, но обёртка всё равно оставляет в accessibility tree пустую секцию `Interne Notiz`, что нарушает NOTE-006 (`src/screens/OpportunityCard.tsx:242-248`). |

Итог A: **2 приняты, 3 отклонены**. Для блока 2 это не отклонение ассетов: все ассеты, включая обязательные логотипы QNG/DGNB, приняты; блок удерживает только адаптивная раскладка.

## B. Третий UX-замер

Шкала не изменена: «магазин» требует видимого выбора, его последствия и безопасного эксперимента, а не только карточного вида.

| поверхность | решений одновременно | до видимого последствия | язык | progress / next | безопасность | плотность | вердикт |
|---|---|---:|---|---|---|---|---|
| Список | 4 фильтра + карточки | — | DE чистый; EN смешан | корень и CTA ясны | фильтры обратимы | умеренная | **между** |
| Opportunity | файл, conflict, parameters, gate | 3–4 | EN почти весь DE | ring 2/2, путь в Option | Undo; manual capture | очень высокая | **между** |
| Глава 1 | scope, class, energy | 1 | DIN/MBO; EN смешан | реальнее, next есть | consequence не у каждого факта | таблицы + controls, clip | **налоговая форма** |
| Глава 2 | до 9 групп | 1 | опции понятны; EN смешан | chapter + next | price preview, ghost, Undo | длинный каталог | **магазин** |
| Глава 3 | 4 coverage-решения | 1 | KG/coverage; EN смешан | next есть | Undo + comparison, но форма доминирует | сегменты формы | **налоговая форма** |
| Глава 4 | несколько engineering-групп | 1 | технический; EN смешан | chapter + next | ghost/Undo | длинный каталог | **магазин** |
| Глава 5 | energy + certificates | 1 | клиентский; EN смешан | chapter + next | ghost/Undo + confirm | умеренная | **магазин** |
| Глава 6 | 3 факта + basement | 1 | площади/статусы; EN смешан | chapter + next | ghost/Undo | форма + плитки | **между** |
| Глава 7 | 2 risk-решения | 1 | база и allowance видны; EN смешан | chapter + next | preview, apply/remove, Undo | умеренная | **магазин** |
| Глава 8 | 1 способ расчёта | 1 | HOAI/AHO; EN смешан | chapter + next | Undo, preview малополезен | разреженная | **между** |
| Глава 9 | read-only schedule | нет | даты читаемы; EN смешан | CTA к Vergleich | только просмотр | Gantt + таблица | **между** |
| Правая панель | total, drivers, recap, gate | мгновенно | сильные метрики; EN смешан | gate + journal | live delta, ghost, Undo | высокая; slot-shift | **магазин** |
| Vergleich | варианты рядом | уже рядом | технический; EN смешан | CTA к Export | Options изолированы | плотная таблица | **магазин** |
| Export | 6 artifacts, discount, email | 1 | DE/EN смешаны | Compose → Preflight → Confirm | snapshot + preflight | две колонки | **магазин** |

Новый счёт — **7 из 14**. Поменялись две поверхности:

- Глава 7: **«налоговая форма» → «магазин»**. Вместо нулевой заглушки появились два продавецких решения с собственной базой, видимой денежной надбавкой до commit, apply/remove и Undo.
- Правая панель: **«между» → «магазин»**. Recap теперь собирает decision drivers, включая basement; live delta получает state сразу, а ghost/Undo дают безопасно примерять выбор. Дефект высоты слота остаётся регрессией, но не отменяет появившийся продуктовый механизм.

Глава 1 осталась **налоговой формой**: из трёх запрошенных изменений реальный progress и часть человеческих следствий стали честнее, но DC-46/DC-47 не приняты, а таблицы и поля всё ещё доминируют. Глава 3 тоже осталась **налоговой формой**: localized reason и side-by-side consequence улучшены, но третье требование — scope cards вместо набора `SegmentedControl` — не выполнено (`src/screens/S3Konfigurator.tsx:170-249`).

## C. EN после поставки № 4

`TASK-19` не интегрирована в `src/**`, поэтому условие «если TASK-19 принята» не наступило и снимать `EN · Entwurf` нельзя. На живом EN golden path консервативный лексический сканер нашёл **202 уникальных видимых DOM text-node fragments с немецкой лексикой**. Это нижняя граница, а не обещанные две строки.

Поставка № 4 теперь содержит **91 уникальный ключ** без пересечения с прежними 784: 71 UI/guidance, 6 reason templates и 14 динамических event/driver/preview templates. После её корректной интеграции законно останутся только:

1. `Musterprojekt Nordfeld` — имя fixture-проекта.
2. Немецкое тело client email — содержимое артефакта по D-13.

Источник расхождения: пакет лежит в `docs/audit/verdicts/content/i18n-en-4-260807.md`, но текущий build i18n его не читает; кроме того, dynamic `.ts` messages должны быть подключены через параметризованные шаблоны. Поэтому перечисление каждого допустимого остатка по критерию TASK-21 ещё неприменимо: сначала нужна интеграция.

## D. Регрессии и прогоны

| проверка | результат |
|---|---|
| `npm test` | **прошёл**: 146/146, 7 файлов |
| `npm run build` | **прошёл**: 477 modules; 43/43 option WebP в output; JS 586,56 kB (gzip 185,15), CSS 86,11 kB; только Vite warning о chunk >500 kB |
| `npm run verify` | **прошёл**: 0 new, 4 known-open, 20 warnings; warning selftest 13 веток / 0 failures |
| `git diff --check` | **прошёл** |
| clipping 1100 / 1440 / 1920 | **не прошёл** на 1100 и 1440; прошёл на 1920. Aside везде ровно 519/519, но center имеет скрытое внутреннее переполнение |
| EN golden path | **не прошёл**: ≥202 уникальных немецких visible fragments; поставка № 4 не интегрирована |
| `prefers-reduced-motion: reduce` | **прошёл**: delta/ghost/toast имеют transition 0s, animation none |
| background-tab state | **прошёл по механизму**: permanent delta/toast получают `.a3-show` немедленно; paint opacity в hidden document не является корректным критерием |
| ghost/delta slots | **не прошли**: +75 px и +2 px layout shift |
| popover у нижней границы | **не прошёл**: dialog bottom 751 при viewport height 500; `src/components/OriginPopover.tsx:56-77` |
| фокус после смены главы | **прошёл**: active element `MAIN`, H1 соответствует новой главе |

### Адреса для следующей ремедиации

1. `design-system/components.css:393-397,494-497` — option grids не адаптируются к фактической ширине `main`; клиппинг 1100/1440.
2. `design-system/components.css:249-252` — min-height слотов меньше живого двухстрочного содержимого.
3. `src/components/OriginPopover.tsx:56-77` — portal box не перемеряется после mount, flip получает нулевую высоту.
4. `src/components/ClientOutputGateDialog.tsx:42-78`, `src/App.tsx:161-178` — фокус и closed DOM не соответствуют DC-33; header обходит единый gate.
5. `src/screens/OpportunityCard.tsx:242-248` — пустая `Interne Notiz` остаётся в presentation; NOTE-006 не выполнено.
6. `src/state/data-states.ts` и `src/**` — DC-14 не поставлен, семь состояний DC-14/DC-30/DC-33/DC-43 не реализованы.
7. `tools/build_i18n.py`, `src/i18n/**`, `src/state/store.ts`, `src/engine/calculate.ts` — интегрировать 91-ключевую поставку № 4 и параметризовать dynamic messages; после этого повторить полный EN golden path.

Волна C не принята целиком. До следующего раунда нужны три обязательных добора: responsive center, стабильные slots/popover и реальные component contracts с семью состояниями. EN принимается отдельно только после интеграции TASK-19.
