РЕВЬЮ: дефектов 22 (в DS исправлено 1, к Claude 21) · adoption-лист: 10 · экранов «магазин»: 3 из 14

# Тотальное ревью прототипа · UX/UI и принятие дизайн-системы

Дата прохода: 06.08.2026. Объект был неподвижен: `src/**` только читался; единственная правка продукта дизайн-системы сделана в `design-system/components.css`.

## Вывод

Golden path проходим от списка до Export, но основная сущность потока пока декоративна: созданная Opportunity Option хранит только `id` и имя, тогда как конфигурация глобальна, а Vergleich строит три зашитых сценария. Поэтому пользователь видит интерфейс выбора, но не создаёт независимые варианты, которые затем сравнивает и отправляет.

Визуально прототип ближе к «налоговой форме»: 3 из 14 проверяемых поверхностей достигают структуры магазина — главы 2, 4 и 5, где выбор представлен плитками с постоянно видимым денежным последствием. Остальные поверхности либо требуют держать в голове технический контекст, либо показывают таблицы/поля без каталожной сводки выбранного.

## Дефекты — по тяжести

| № | адрес | класс дефекта | что видно | что сделать | зона |
|---:|---|---|---|---|---|
| 1 | `src/state/store.ts:264-266, 542-552, 989-1006` · `src/screens/S4Vergleich.tsx:29-44` | **S0 · ложная модель Option** | Option содержит только `id/name`; все Options делят одну конфигурацию. Vergleich игнорирует `s.options` и всегда показывает `Basis / Ohne UG / EH 40`. Созданную Option нельзя независимо настроить, сравнить и воспроизвести в Export. | Хранить отдельный snapshot/configuration proposal на Option/VariantVersion; активировать состояние по `activeOptionId`; строить Vergleich и Export из созданных Options, а не из `VARIANTS`. | src — Claude |
| 2 | `src/i18n/index.ts:14-23, 31-68` · `src/screens/S3Konfigurator.tsx:36-124` · `src/components/OfferPanel.tsx:28-37, 104-229` | **S0 · i18n/permission** | В EN+Präsentation переведён chrome, но содержимое остаётся преимущественно немецким: `Kapitel`, `Kern des Angebots`, coverage-решения, единицы срока и тексты панели. Переключатель обещает EN, которого экран не даёт. | Перевести все UI-строки на уже поставленные generated-ключи; явно разделить UI-language и artifact-language; неполный EN обозначать до переключения и не предлагать его как полный режим. | src — Claude |
| 3 | `src/screens/OpportunityList.tsx:36-52, 124-130` · `src/components/DocumentAnalysis.tsx:31-71` · `src/components/OfferPanel.tsx:40-93` · `src/screens/S4Vergleich.tsx:35-44` · `src/screens/S5Export.tsx:40-79` · `src/components/ScheduleGantt.tsx:49-54` | **S0 · STATE-001 / правило 30** | Данные рендерятся в одном-двух удобных fixture-состояниях. Ни один из перечисленных потребителей не реализует полный набор `loading / empty / partial / ready / error + stale + permission`; у Gantt empty — молчаливый `null`. | Ввести типизированные состояния на границе каждого data-компонента и отрисовать все семь ветвей по контрактам; запретить неявный ready из наличия fixture. | src — Claude |
| 4 | `src/screens/S3Konfigurator.tsx:107-109, 448-464` | **S0 · незавершённый golden path** | Глава 7 открывается как сообщение «не проработано», хотя маршрут и задание обещают главы 1–9. Следствие для цены, данные и действие отсутствуют. | Реализовать главу по screen-map через DS-компоненты и семь состояний либо исключить её из доступного маршрута до готовности. | src — Claude |
| 5 | `src/App.tsx:83-95` · `src/components/OfferPanel.tsx:95-112` | **S1 · clipping на 1100–1920** | При фиксированных 400 px панель имеет `scrollWidth=439`; оранжевый total выходит за viewport примерно на 40 px и обрезает сумму/`€` на всех четырёх ширинах. Горизонтальной прокрутки документа нет — содержимое именно потеряно. | Сделать shell контейнерно-адаптивным: выделить герою достаточную ширину либо менять компоновку панели; проверить длиннейшие DE/EN числа без уменьшения нормативной иерархии метрик. | src — Claude |
| 6 | `src/components/OfferPanel.tsx:120-145, 165-190, 198-222` · `src/components/OriginPopover.tsx:77-128` | **S1 · overlay/clipping + невалидный DOM** | Popover при 1440 px имеет `x=1108`, ширину 420 и правую границу 1528; 88 px скрыты, aside получает горизонтальный скролл. Компонент `div/ol` попадает внутрь родительского `p`; тесты печатают три `validateDOMNesting` warning. | Якорить popover по доступной стороне/CollisionBoundary, вынести trigger из `p`, использовать допустимый block-контейнер; сохранить Esc и возврат фокуса. | src — Claude |
| 7 | `src/state/store.ts:588, 862` · `src/components/Sidebar.tsx:83-104` | **S1 · ложный прогресс и потеря контекста** | Новая Option открывается сразу на главе 3, а главы 1–2 получают `done` из константы `n < 3`, хотя building не подтверждён и глава 2 при открытии требует вернуться в главу 1. | Начинать новую Option с первого незавершённого шага; вычислять done из состояния конкретной Option, не из номера. | src — Claude |
| 8 | `src/App.tsx:86-91` · `src/components/Sidebar.tsx:68-105` | **S1 · навигация сохраняет чужой scrollTop** | После длинной главы переключение в другую главу/сравнение оставляет центральный `main` на прежней высоте. На 1100/1280/1440 экран открывается посередине карточек, без H1 и объяснения вопроса. | При смене `view/openChapter/activeOptionId` переводить рабочую область к началу и фокусировать H1 либо корневой регион. | src — Claude |
| 9 | `src/screens/S3Konfigurator.tsx:112-124` · `src/screens/S4Vergleich.tsx:139-191` | **S1 · тупик DC-27** | В главе 9 нет следующего шага к Vergleich; в Vergleich нет действия к Export. Продолжение приходится искать в левой навигации. | Добавить ровно один контекстный CTA: `Varianten vergleichen`, затем `Angebot prüfen und exportieren`. | src — Claude |
| 10 | `src/screens/OpportunityCard.tsx:132-140` | **S1 · действие без отклика** | `Manuell erfassen` вызывает пустой callback. После клика не меняются DOM, фокус, статус или маршрут. | Открывать P2/форму ручного ввода либо честно блокировать действие с видимой причиной; покрыть тестом видимый результат клика. | src — Claude |
| 11 | `src/components/ScheduleGantt.tsx:56-80` ↔ `design-system/components.css:342-369` | **S1 · сломанный контракт DC-19** | Использованы только корень/строки/track/segment. Нет `.a3-gantt-scroll`, `.a3-gantt-visual`, `.a3-in`, segment label/phase color, axis, details и `.a3-gantt-table`. В результате на экране видны серые дорожки и finish-линии, но не длительности фаз. | Собрать полный DC-19 DOM; передавать семантический цвет фазы, текст внутри segment и табличную альтернативу через контрактные классы. | src — Claude |
| 12 | `src/components/primitives.tsx:81-104` · пример `src/components/DocumentAnalysis.tsx:120-125` | **S1 · необъяснённая блокировка** | Generic Button кладёт `disabledReason` только в `title`; причина не стоит в порядке чтения и не связана `aria-describedby`. Серый `Besseren Scan hochladen` визуально не объясняет отсутствие upload в прототипе. | Рендерить reasonBlock рядом, связать его с `aria-describedby`, дать активный следующий шаг; `title` оставить лишь дополнением. | src — Claude |
| 13 | `src/engine/calculate.ts:142-147` · `src/screens/S3Konfigurator.tsx:224-233` | **S1 · машинный жаргон в UI** | На немецком и presentation-экране видны engine-строки `coverage unknown: KG_500` и русская строка про открытые существенные проблемы. Рядом присутствуют `Fixture`, `CALC-*`, `R-*`, `selectionStatus`, `VerificationEvent`. | Возвращать из engine типизированные reason codes, локализовать их в UI и скрывать внутренние ID/нормативные ссылки из presentation. | src — Claude |
| 14 | `src/screens/OpportunityList.tsx:61-76, 85-120, 132-165` ↔ DC-15/DC-34 | **S1 · почти правильный компонент** | `.a3-pcard` не содержит `.a3-top/.a3-mid/.a3-cta`; поиск собран из discount-поля `.a3-rb-number`; фильтры — из StatusTag. Готовые ProjectSearchFilter/Card/EmptyState не приняты. | Пересобрать список по DC-15 и DC-34, применить FormField, filterChip, result count и EmptyState. | src — Claude |
| 15 | `src/components/controls.tsx:165-251` · `src/screens/OptionChapter.tsx:108-140` ↔ DC-20/DC-40 | **S1 · двойник готовых плиток** | RadioCardGroup визуально собран утилитами. `.a3-okc-tile` и фасадные `.a3-fgrid/.a3-fk/.a3-img` не используются; фасад остаётся текстовой строкой без визуального различия материалов. | Оставить native radio-поведение, но принять контрактные grid/tile classes; для фасада использовать DC-20, показывая цену и следствие без hover. | src — Claude |
| 16 | `src/screens/S4Vergleich.tsx:139-177` · `src/components/DocumentAnalysis.tsx:74-143` · `src/screens/S5Export.tsx:81-223` | **S1 · двойники DS** | Vergleich, analysis и Export вручную повторяют готовые `.a3-cmp`, `.a3-analysis-*`, `.a3-mailcard/.a3-preflight-list/.a3-paper-preview`. Визуальный источник у каждого механизма снова двойной. | Заменить utility-копии на контрактные структуры, сохранив существующую бизнес-логику. | src — Claude |
| 17 | `src/components/OfferPanel.tsx:269-290, 296-431, 524-560` · `src/screens/OpportunityCard.tsx:145-176` · `src/components/UndoToast.tsx:73-99` · `src/components/DocumentAnalysis.tsx:94-119` | **S1 · неполные Classes-контракты** | `.a3-delta` без `.a3-show/.a3-saving|cost`; conflict без `.a3-kv`; drivers без `.a3-drivers/.a3-bmark/.a3-driver-direction`; journal без `.a3-journal-spec`; toast без `.a3-toasts/.a3-act`; `.a3-okc/.a3-errc` стоят вне контекстов, где у них вообще объявлен вид. | Собирать каждый компонент целиком по `Classes:`; не применять дочерний класс как самостоятельный utility. | src — Claude |
| 18 | `src/screens/S3Konfigurator.tsx:74-86, 134-147` · `src/screens/ChapterBuildings.tsx:70-241` · `src/screens/OpportunityCard.tsx:124-271` | **S2 · showcase API в продукте** | Прототип потребляет `.a3-sheet`, `.a3-masthead`, `.a3-hero-title`, `.a3-lede`, `.a3-cap`, `.a3-linkbtn`, хотя `components.css:6-16` прямо помечает их `not component API`. Это скрывает отсутствие Card/Typography/Link-контрактов. | Перейти на product primitives; showcase helpers оставить только витрине. | src — Claude |
| 19 | `src/screens/OpportunityList.tsx:108-120` | **S2 · hit target 22 px** | Активный фильтр — `button.a3-tag` высотой 22 px, без pseudo hit-area. Это StatusTag, а не интерактивный chip. | Использовать `.a3-chip-control` с зоной 44×44 и видимым focus; сохранить текстовое `Filter entfernen`. | src — Claude |
| 20 | `src/screens/S2Vorbereitung.tsx:381-387` | **S2 · действие без feedback** | `Fragenliste kopieren` пишет в clipboard, но не сообщает успех/ошибку; при недоступном clipboard клик молча ничего не делает. | После Promise показывать SaveStatus/Toast для success и error с средством восстановления. | src — Claude |
| 21 | `src/screens/OptionChapter.tsx:76-150` · `src/components/OfferPanel.tsx:94-290` · `src/screens/S4Vergleich.tsx:139-177` | **S2 · нет сводки выбранного** | Между выбором и Vergleich нет «корзины»: панель показывает деньги, но не список выбранных опций; сравнить соседние опции до фиксации нельзя. Пользователь должен помнить выборы из длинных глав. | Композировать DC-40 + DC-38/DC-27 в summary выбранного; использовать DC-11 для side-by-side preview до commit. | src — Claude |
| 22 | `design-system/components.css:227-228` | **S1 · коллизия класса `.a3-ghost`** | Один класс обслуживал и ghost-кнопку, и Geist-Vorschau; общий `opacity:0` скрывал `Schließen` в UndoToast, оставляя кнопку только в accessibility tree. | Правило превью сужено до контрактного `.a3-ghost-slot > .a3-ghost`; после правки кнопка имеет `opacity:1` и видимый box 121×40 с hit-area 44. | **DS — сделано** |

## Браузерный проход

Golden path: список → worked Opportunity → анализ → конфликт → параметры → создание Option → главы 1–9 → панель → Vergleich → Export. Переход возможен; проблемы маршрута перечислены выше.

| viewport | header | left | main | right | результат |
|---:|---:|---:|---:|---:|---|
| 1100 | 125 | 280 | 420 | 400 | total выходит до x=1140; центральная область превращает плитки в один столбец |
| 1280 | 69 | 280 | 600 | 400 | total выходит до x=1320 |
| 1440 | 69 | 280 | 760 | 400 | total выходит до x=1480; origin popover — до x=1528 |
| 1920 | 69 | 280 | 1240 | 400 | total всё равно выходит до x=1960: дефект зависит от контейнера панели, не от viewport |

- Intern/Präsentation: internal runRef и маржа действительно удаляются из presentation DOM; смешанный язык, engine-reasons и техническая плотность остаются.
- DE/EN: chrome переключается; содержимое — частично. На одном EN+presentation экране одновременно присутствуют `Mode`, `Presentation`, `Scope boundaries` и немецкие `Kapitel`, `Kern des Angebots`, `enthalten`, `Schätzunsicherheit`, `Monate`.
- `prefers-reduced-motion: reduce`: motion-токены становятся `0ms`, Framer-ветви рендерят без входного движения; нового дефекта движения не найдено.
- Внешнего page-level горизонтального scroll нет. Это не оправдание: total/popover обрезаются внутри aside, у которого появляется собственный горизонтальный overflow.
- Геометрия плоская: запрещённых теней/градиентов/случайных скруглений в пройденных экранах не найдено; круги используются как допустимые индикаторы.
- Формат денег/площадей в основных метриках использует U+202F и `.numeric`; отдельный прогон `npm run verify` до появления параллельного файла новых нарушений не нашёл. Машинные reason-строки и UI-копирайт остаются отдельным дефектом № 13.

## Аудит фактически используемых классов

Стартовый скрипт задания теперь печатает `282 / 79 / 203`, а не `282 / 78 / 204`: после составления TASK в DS появился и был принят `.a3-driver-table`. Но скрипт ищет подстроку, а не class token. Шесть «использований» ложные: `.a3-chip` находится внутри `a3-chip-src`, `.a3-d` — внутри длинных имён, `.a3-in` — внутри `input/inactive`, `.a3-journal` — внутри `journal-*`, `.a3-ok` — внутри `okc`, `.a3-r` — внутри `row/rb/ring`. AST-проход по исполняемым string/template literal даёт **73 реальных класса и 209 неиспользуемых**.

Все 73 реальных класса покрыты группами ниже; статус относится к полному DOM-контракту, а не к совпадению имени.

| группа | классы | результат |
|---|---|---|
| Showcase helpers · 6 | `a3-cap`, `a3-hero-title`, `a3-lede`, `a3-linkbtn`, `a3-masthead`, `a3-sheet` | Неверная зона: все шесть `not component API`, дефект № 18. |
| Controls · 11 | `a3-btn`, `a3-sec`, `a3-ghost`, `a3-row`, `a3-input`, `a3-unit`, `a3-toggle`, `a3-on`, `a3-rb`, `a3-rb-number`, `a3-guard` | Button/Input/Switch/Discount структурно работают; disabled reason нарушает контракт, `a3-rb-number` ошибочно переиспользован поиском. DS-коллизия ghost исправлена. |
| Status/provenance · 8 | `a3-tag`, `a3-blue`, `a3-green`, `a3-orange`, `a3-dot`, `a3-chip-src`, `a3-errc`, `a3-okc` | Статусы несут текст, provenance корректен; StatusTag превращён в filter button, ok/error glyphs вырваны из контрактных hosts. |
| Chapters/readiness · 10 | `a3-chapters`, `a3-ch`, `a3-n`, `a3-cur`, `a3-done`, `a3-ringwrap`, `a3-ring`, `a3-bgc`, `a3-fgc`, `a3-ringnum` | DOM-анатомия верна; состояние done ложное и не относится к Option, defect № 7. |
| Metrics/preview · 13 | `a3-hb`, `a3-hb-total`, `a3-hb-num`, `a3-hb-unit`, `a3-hb-cap`, `a3-ghost-slot`, `a3-ghost`, `a3-delta-slot`, `a3-delta`, `a3-iv-sub`, `a3-iv-bandbox`, `a3-iv-band`, `a3-fill` | Hero/interval/ghost в основном собраны; нет `.a3-heroband`, total не помещается, DeltaChip не имеет обязательного state/direction. |
| Context · 4 | `a3-pcard`, `a3-konflikt`, `a3-warn-prep`, `a3-nextstep` | Warning самостоятельный и читаемый; остальные три — неполные структуры. |
| Gantt · 7 | `a3-gantt`, `a3-g-row`, `a3-g-track`, `a3-g-seg`, `a3-g-fin`, `a3-g-legend`, `a3-tbl-scroll` | Не принят обязательный каркас DC-19; визуальное содержание фаз отсутствует. |
| Drivers · 7 | `a3-driver-table`, `a3-drv`, `a3-val`, `a3-bar-cell`, `a3-bar`, `a3-inactive`, `a3-sum` | Нативная таблица и numeric cells сохранены; отсутствуют root, benchmark и direction/base/minus. |
| Tabs/feedback · 7 | `a3-tabs`, `a3-tabpane`, `a3-journal-disclose`, `a3-journal-items`, `a3-toast`, `a3-recap`, `a3-skel` | Tabs проходят arrows + roving tabindex; Recap/Skeleton приемлемы; Journal/Toast неполны. |

### Семь состояний данных

| потребитель | объявлено в UI | отсутствует/не доказано |
|---|---|---|
| Opportunity list/cards | ready, empty фильтра | loading, partial, error, stale, permission |
| Document analysis | loading/running, partial-file error, ready, cancelled | empty, stale, permission; error не отделён типом состояния |
| Offer panel | ready, partial total, presentation permission-фильтр | loading, empty, stale, error |
| Option tiles | ready, constraint-disabled | loading, empty, partial, stale, error, permission |
| Gantt | ready fixture; empty возвращает `null` | явный empty, loading, partial, stale, error, permission |
| Vergleich | ready fixture | остальные шесть |
| Export | compose/preflight/send stages | data loading/empty/partial/stale/error/permission как независимая ось |

## Оценка UX/UI

В знаменатель входят ровно запрошенные поверхности: список, Opportunity, 9 глав, панель, Vergleich и Export — 14.

| экран | решений одновременно | кликов до видимого последствия цены | язык | прогресс / следующий шаг | безопасность эксперимента | плотность | вердикт | три главных исправления |
|---|---:|---:|---|---|---|---|---|---|
| Список | 4 фильтра + выбор карточки | —; до первой цены 4 действия после входа в Opportunity | в основном человеческий, но `Owner/Opportunity` смешаны | корень понятен; CTA карточки визуально не выделен | фильтры обратимы, empty объяснён | воздушно | **между** | DC-34; настоящий DC-15 CTA; семь states |
| Opportunity card | ошибка файла + конфликт + 8 метрик + gate | 4: решить, подтвердить, создать, открыть | много provenance/ID и нормативных сокращений | ring 2/2 есть, но подготовка и классификация остаются отдельными | Undo есть; Manual capture — no-op | длинная колонна листов | **налоговая форма** | один NextStep; manual capture; свернуть подтверждённое в summary |
| Глава 1 | scope зданий + классификация + energy + confirm | 1 | BGF/NRF/NUF/MBO доминируют | stepper врёт о done | preview/Undo есть не у всех решений | четыре sheets и таблица | **налоговая форма** | DC-46/47; человеческие следствия; реальный progress |
| Глава 2 | до 9 групп, но по одному вопросу в карточке | 1 | названия опций понятны, bases транслитерированы и технические | глава и next видны | цена всегда на плитке, ghost и Undo | длинный каталог | **магазин** | DC-40; DC-20 для фасада; sticky summary выбранного |
| Глава 3 | 4 coverage-решения | 1 | KG/coverage и engine reasons | следующий шаг есть | Undo есть, pre-commit ghost нет | сегменты как форма | **налоговая форма** | карточки scope; локализованные причины; side-by-side consequence |
| Глава 4 | несколько системных опций | 1 | технические названия, последствия видны | chapter + next | ghost/Undo | длинный каталог | **магазин** | DC-40; группировать по потребности клиента; summary |
| Глава 5 | energy + certification | 1 | ближе всего к каталогу | chapter + next | ghost/Undo, отдельное подтверждение клиента | умеренная | **магазин** | развести selection/confirmation визуально; DC-40; показать совместимость сертификатов |
| Глава 6 | 3 поля + basement | 1 blur/Enter или 1 tile click | технические площади | chapter + next | Esc/Undo/ghost | смешение формы и плиток | **между** | отделить verified facts от choices; FormField; локальный summary |
| Глава 7 | 0 реальных решений | нет | текст для разработчика, не sales | есть только обход дальше | эксперимент отсутствует | пусто | **налоговая форма** | реализовать; показать data state; связать с ценовым риском |
| Глава 8 | 1 способ расчёта | 1 | HOAI/AHO/70-22-8 без клиентского следствия | chapter + next | Undo, но нет ghost | разреженно, технически | **между** | оставить только intern; preview суммы; человеческое объяснение различия |
| Глава 9 | 0, только расписание | нет | даты читаемы, но графика пуста | нет next к Vergleich | только просмотр | воздух есть, смысла диаграммы нет | **между** | полный DC-19; CTA Vergleich; phase labels/colors |
| Правая панель | 3 героя + 2 disclosures + gate + journal | мгновенно | сильные метрики, затем служебный жаргон | gate и journal есть | лучший ghost/Undo-паттерн | перегружена и обрезана | **между** | исправить clipping; selected-options summary; progressive disclosure по контексту |
| Vergleich | 1 toggle показа строк | последствие уже видно, но не от созданных Options | таблица техническая | нет next к Export | experiment отсутствует; варианты hard-coded | стена таблицы | **между** | реальные Options; DC-11; CTA Export |
| Export | 6 attachments + discount + письмо | 1 для discount | `Compose/Preflight/Confirm & Send` рядом с DE | стадии видны | snapshot безопасен; отправка не Undo | двухколоночная форма | **налоговая форма** | DC-41/DC-23; preview пакета; итог выбранного и адресата перед confirm |

## Adoption-лист · топ-10

| приоритет | класс / механика | куда принять | выигрыш по критерию PO | контракт |
|---:|---|---|---|---|
| 1 | `.a3-ogrid`, `.a3-okc-tile`, `.a3-ok`, `.a3-pd`, `.a3-st` | главы 2, 4, 5 | выбор выглядит как каталог; цена/следствие находятся на самой плитке | `design-system/README.md:2592` · DC-40 |
| 2 | `.a3-fgrid`, `.a3-fk`, `.a3-img`, `.a3-f-*`, `.a3-faxes` | глава 2 · Fassade | материал различим до чтения, без декоративной иллюстрации | `design-system/README.md:3003` · DC-20 |
| 3 | `.a3-cmp`, `.a3-target`, `.a3-num`, `.a3-d`, `.a3-save` | Vergleich и preview до commit | side-by-side последствия вместо памяти о прошлой главе | `design-system/README.md:2698` · DC-11 |
| 4 | `.a3-project-search`, `.a3-search-line`, `.a3-form-field`, `.a3-filter-row`, `.a3-search-result-count`, `.a3-chip-control` | список Opportunities | поиск ощущается как подбор, а не форма; active filters доступны | `design-system/README.md:3263` · DC-34 |
| 5 | `.a3-scope`, `.a3-kx`, `.a3-krow`, `.a3-ktotal`, `.a3-segs`, `.a3-sg` | глава 1 и контекст панели | продавец всегда видит «весь комплекс / Haus X» и не держит scope в памяти | `design-system/README.md:2421, 2495` · DC-46/47 |
| 6 | `.a3-analysis-spec`, `.a3-analysis-track`, `.a3-analysis-log`, `.a3-analysis-files`, `.a3-analysis-error` | Opportunity · документ-анализ | одна доказуемая история loading/partial/error вместо utility-копии | `design-system/README.md:2924` · DC-10 |
| 7 | `.a3-ann`, `.a3-ann-t`, `.a3-gone` | Vorbereitung P4 и Export recap | допущения становятся отдельными разрешаемыми объектами, а не абзацами | `design-system/README.md:1230` · DC-8 |
| 8 | `.a3-mailcard`, `.a3-mailrow`, `.a3-lb`, `.a3-preflight-list`, `.a3-paper-preview` | Export | пакет виден до отправки как собранный товар; меньше памяти и риска | `design-system/README.md:1902, 3703` · DC-23/41 |
| 9 | `.a3-gantt-scroll`, `.a3-gantt-visual`, `.a3-gantt-epoch`, `.a3-g-axis`, `.a3-g-seg-label`, `.a3-gantt-details`, `.a3-gantt-table` | глава 9 | срок читается как визуальное последствие scope, не как набор дат | `design-system/README.md:3400` · DC-19 |
| 10 | `.a3-heroband`, `.a3-hb-sub`, `.a3-drivers`, `.a3-bmark`, `.a3-driver-direction`, `.a3-journal-spec`, `.a3-mtag`, `.a3-fx` | правая панель | завершает «корзину»: итог, почему он такой, что выбрано и один следующий шаг | `design-system/README.md:500, 883, 1377` · DC-38/44/27 |

### Остальные неиспользуемые классы

- **Обязан быть принят сейчас:** десять механизмов выше, включая недостающие дочерние классы уже начатых DC-19/DC-27/DC-38/DC-44, плюс `.a3-empty-spec/.a3-empty-icon` для законной пустоты списка.
- **Уместен позже:** generic DataTable/DisclosureRow, badge/zone, CostStructureTable expansion, modal/dialog, SaveStatus/AutosaveChip, note/tour, keyboard help, output-profile switch, full switch specimen, ScopeLineItemBlock и печатные specimen-actions — когда соответствующие функции появятся в product scope. Класс не надо принимать ради процента adoption.
- **Только витрина:** 28 неиспользуемых shell-классов — `.a3-cell`, `.a3-chip`, `.a3-demo-panel`, `.a3-info`, `.a3-meta`, `.a3-mono`, `.a3-numeric`, `.a3-pal`, `.a3-pal-ext`, `.a3-pnav`, `.a3-reveal`, `.a3-rulebox`, `.a3-showcase`, `.a3-sp-row`, `.a3-spec`, `.a3-specimen-block`, `.a3-specimen-meta`, `.a3-specimen-stack`, `.a3-swatch`, `.a3-t-body`, `.a3-t-cap`, `.a3-t-h1`, `.a3-t-h2`, `.a3-t-h3`, `.a3-t-hero`, `.a3-t-small`, `.a3-visually-hidden`, `.a3-wrap`. Двойное имя `.a3-in` сюда не включено: оно нужно runtime-Gantt как state-класс.

### Нужны ли новые «магазинные» компоненты

Новые параллельные API не добавлялись. Три названных в задании механики уже собираются без нового визуального источника:

- карточка опции с визуалом = DC-20 `FacadeRenderTile` + DC-40 `OptionTile`;
- сводка-«корзина» = DC-38 `KeyMetricsGrid` + список выбранных DC-40 + DC-27 `NextStepCard`;
- side-by-side до фиксации = DC-11 `VariantComparisonCell` с temporary preview state.

Пробел находится в принятии и модели Option, не в отсутствии ещё одного класса. Создание четвёртого похожего tile/summary нарушило бы единственный визуальный источник.

## Проверки

- `npm run build` — прошёл; предупреждение Vite о chunk >500 kB не относится к визуальному вердикту.
- `npm test -- --run` — 117/117; тесты печатают DOM-nesting warnings из дефекта № 6.
- Первый `npm run verify` прошёл: новых нарушений 0, только зарегистрированные known-open. Повторный финальный прогон остановлен новым `[NBSP]` в `docs/audit/i18n-remainder-260806.md:117`; файл появился параллельно, относится к зоне Claude и не изменялся в этой задаче. Два файла этой задачи новых нарушений не дали.
- После DS-правки runtime-проверка: ghost-кнопка `Schließen` видима, `opacity=1`, visual box 121×40, контрактная hit-area 44 px.

## Чего я проверить не могу

- Реальную загрузку/повторный парсинг файла: upload отсутствует, parsing симулирован.
- Реальную доставку письма и server-side snapshot: отправка и delivery status симулированы в клиенте.
- EN клиентских артефактов: отдельного artifact-language в прототипе нет, draft UI-словарь не доказывает PDF/e-mail.
- Семь data states на реальных ответах API: API и fixtures для этих ветвей отсутствуют; именно поэтому состояние нельзя считать доказанным тестами ready-path.
- Семь неworked Opportunities: интерфейс честно объявляет их непроработанными, но их golden paths отсутствуют.
- Ручной проход реальным screen reader и физическим touch-устройством; keyboard semantics, role/ARIA и геометрия проверены DOM/Playwright, но это не заменяет NVDA/VoiceOver и аппаратный tap.
