ВЕРДИКТ: ОТКЛОНЕНО · исправлений подтверждено 11 из 15 · ночных проверок 3 из 9 · новых дефектов 3

# Повторная проверка прототипа · 06.08.2026

## Метод и базовый прогон

Сначала проверен объект и составлено собственное мнение; сообщение коммита
`2d7ee30` и сообщения ночных коммитов прочитаны только после этого. Оригиналы
приложения не изменялись. Рабочее дерево до записи этого файла было чистым.

Для атак использованы копии `/tmp/codex-recheck-260806.Hyb5bP`,
`/tmp/codex-ssr-current.oFxixC` и дерево прежнего состояния
`/tmp/codex-ssr-old.cO14k4`. В них добавлены только аудитные тесты/точки входа.

| Проверка | Наблюдение |
|---|---|
| `npm test -- --run` | PASS · 3 файла · **64/64**: fixture 27, S4/S5 6, store 31 |
| `npm run typecheck` | PASS |
| `npm run build` | PASS · 415 модулей |
| `python3 tools/build_fixtures.py --check` | PASS · 27 сверок |
| `npm run verify` | **FAIL · 3 новых нарушения**: GATE-R15 для `--duration-toast-undo`; NBSP в `TASK-06-prototype-recheck.md`; NBSP в `TASK-07-english-copy.md` |
| временные store-атаки | PASS как воспроизведение наблюдений · 8/8 |
| текущий обычный SSR | PASS · App и начальные состояния S1–S6; отдельный тест подтвердил границу Zustand 5 |
| временный пост-событийный render-surrogate | PASS как воспроизведение наблюдений · 6/6; hook заменён на `store.getState()` **только в `/tmp`** |

Оговорка метода подтверждена: Zustand 5 в обычном SSR читает
`getInitialState()`. После прямого `setEnergiestandard('EH_40')` store уже
содержал одно событие, но `renderToString(<OfferPanel />)` всё ещё показывал
пустой начальный журнал. Поэтому DC-12, preview, presentation-state и toast
проверялись прямыми вызовами store; временная подмена hook использовалась лишь
как снимок разметки уже проверенного состояния, а не как доказательство
поведения production SSR.

## Пятнадцать исправлений

| Пункт | Подтверждающее наблюдение | Да/нет |
|---:|---|:---:|
| 1 | `useStore.setState` действительно отсутствует. Но `useStore.getState()` возвращает сырые изменяемые ссылки: присваивания `building.gebaeudeklasse.confirmed = true` и `coverage.KG_500 = 'included'` меняют расчётное состояние при пустом журнале. Кроме того, production-модуль экспортирует полный reset без события, `src/state/store.ts:683-697`. | **нет** |
| 2 | Два обычных undo дают разные `undoOf`, третий — no-op. В атаке `EH40 → kein_ug → undo → Regionalfaktor → undo → undo` получены `undoOf = [2, 4, 1]`; итог вернулся к EH55, `vollausbau`, фактор выключен. Новое событие не оживляет отменённую ветку и курсор проходит дальше к предыдущему действующему событию. | да |
| 3 | Customer-path создаёт ровно одно `conflict.resolved`; undo одновременно возвращает `1500.00`, provenance `aus Dokument` и весь открытый конфликт, `src/state/store.ts:491-529`. | да |
| 4 | После выбора клиента документный кандидат остаётся `selectionStatus: 'alternative'`; обратный путь восстанавливает исходную коллекцию, `src/state/store.ts:498-527`. | да |
| 5 | Поля снапшота и поведение undo после отправки верны: `totalExact`, Regionalfaktor, копия coverage и `journalSeqAt` есть; send без inverse пропускается и undo отменяет предыдущее событие. Но неприкосновенности нет: `sendOffer` сохраняет и возвращает один изменяемый объект, а публичный `snapshots` допускает `splice`; в атаке `snap.totalExact = '0.00'` изменил сохранённый снапшот, затем массив был очищен, `src/state/store.ts:574-597`. | **нет** |
| 6 | Видимый статус — `Zugestellt (simulierte Zustellbestätigung)`; пояснение называет таймер 2,5 секунды симуляцией, `src/screens/S5Export.tsx:230-243`. | да |
| 7 | Все шесть артефактов, включая презентацию PDF, получают видимый `Muster`; preflight говорит `Muster-Dateien des Prototyps`, `src/screens/S5Export.tsx:85-100`, `166-170`. | да |
| 8 | На копии `12 % → 13 %` в `calculation-spec.md` и балкон `25 % → 26 %` в T0 после запуска builder дали JSON `margin=13`, `balcony=26`; шесть risk drivers, cap и GK delta также извлечены. S2 и S6 читают `catalog.internalConfig`, `tools/build_fixtures.py:384-429`, `src/screens/S2Vorbereitung.tsx:247-266`, `src/screens/S6Einstellungen.tsx:16-18,78-131`. | да |
| 9 | Подстановка GK5 названа в пояснении UI, но текст не дословен. У GK отсутствуют последние две фразы источника о влиянии на Tragwerk/Kapselung и подтверждении по Brandschutzkonzept; KG500 удаляет часть исходной формулировки/ссылки. Сравнение: `src/screens/S2Vorbereitung.tsx:389-426` против `docs/product/t0-fallback-rules.md:106,245`. | **нет** |
| 10 | Главный тотал находится в постоянной панели; `{NNBSP}€` лежит внутри текстового дерева одного numeric-элемента, CSS-отступ единицы не используется, `src/components/OfferPanel.tsx:90-98`. | да |
| 11 | `rg -F '${NNBSP}' src` не находит шаблонного литерала; главы S3 используют значение `NNBSP`. | да |
| 12 | Карточка S1 имеет `role="button"`, `tabIndex={0}`, Enter/Space с `preventDefault`, `min-h-hit-target` и `focus-visible` outline, `src/screens/S1Projektliste.tsx:61-69`. | да |
| 13 | NumericField задаёт самому input `minHeight: var(--size-hit-target-default)`, то есть токен цели 44 px, `src/components/primitives.tsx:143-153`. | да |
| 14 | Обе таблицы S6 имеют `<caption>`; ставка строится как `+{NNBSP}{rate}{NNBSP}%`, `src/screens/S6Einstellungen.tsx:70-72,102-121`. | да |
| 15 | Нарушение прежнего `TASK-05` исправлено, но требование «0 новых» не выполнено: текущий verify падает на трёх находках. Токен — `design-system/tokens.css:361`; задания — `docs/audit/verdicts/TASK-06-prototype-recheck.md:61-67` и `TASK-07-english-copy.md:51-79`. | **нет** |

Итого не подтверждены пункты **1, 5, 9, 15**. Формулировка коммита
«15 дефектов закрыты» объектом не подтверждается.

## Ночная досборка · пункты 16–24

| Пункт | Подтверждающее наблюдение | Да/нет |
|---:|---|:---:|
| 16 | Sidebar, гибкий `<main>` и постоянная OfferPanel действительно образуют три зоны, `src/App.tsx:90-108`. Но заявленный снятый центровщик остался вокруг **всего** содержимого глав S3, а не только длинного текста: `src/screens/S3Konfigurator.tsx:75-80`. | **нет** |
| 17 | Тотал использует display-numeric 64 и единственный accent на default/white surface; ведущая ставка и срок — display-numeric-narrow 48, рядом названы норматив и абсолютная дата; `≈` приходит из presentation engine, `src/components/OfferPanel.tsx:84-163`. | да |
| 18 | Перечисленная арифметическая часть есть: формулы Basis/UG, относительные max-бары, честное `nicht vergleichbar`, неактивный Regionalfaktor и итог. Тест суммы сильный: фиксирует состав/точные суммы и отдельно активный фактор, `src/state/__tests__/store.test.ts:82-105`. Но **полный** DC-44 не собран: нет `detailsButton` каждой строки, слов `erhöht/senkt`, уникальных driver ID и scope-ссылок; GK/EH остаются кодами параметров, `src/components/OfferPanel.tsx:210-280,413-426` против `design-system/README.md:872-969`. | **нет** |
| 19 | После EH55→EH40 пост-событийная разметка содержит `≈ + 97.000 €` — префикс до знака — и одну Änderung; helper отдельный от общего signed formatter, `src/components/OfferPanel.tsx:362-377,436-441`. Семантическая ошибка счётчика вынесена в новые дефекты ниже. | да |
| 20 | Проверяемая подчасть работает: hover/focus используют delay-token, `optionDelta` совпадает с последующим событием, preview не пишет журнал, клик гасит preview и создаёт activeDelta, consequenceLine всегда в дереве, `src/components/controls.tsx:139-208`, `src/state/store.ts:603-629`. Но полный DC-28 требует будущий total, delta и contextRef, а также tap-path/Esc; state содержит только `{label, deltaExact}`, UI показывает только их, `src/components/OfferPanel.tsx:195-205`. | **нет** |
| 21 | Toast действительно производная `apply`, send его гасит, `undoEvent(seq)` адресный, hover/focus паузят, Esc закрывает, `src/components/UndoToast.tsx:34-88`. Однако после `undoEvent(1)` и отмены этого undo через `undoEvent(2)` исходное действие восстановлено, но seq 1 остаётся в `undone`; следующий обычный `undo()` — no-op. «Отмена отмены» работает один раз через toast, но ломает постоянный курсор, `src/state/store.ts:638-666`. | **нет** |
| 22 | Gate DEMO-VI-0001 работает; в presentation из дерева исчезают S3 coaching и числовые margin/risk S6. Но профиль не очищен глобально: OfferPanel оставляет `BM-BKI-2026Q1-SYNTH`, S2 доступен с `DEMO-VE-0002` и текстом `intern · Δ-Werte sichtbar`; S1/S4 также содержат DEMO-ID, `src/components/OfferPanel.tsx:219-223`, `src/screens/S2Vorbereitung.tsx:48-52,215-216`, `src/screens/S1Projektliste.tsx:107-108`, `src/screens/S4Vergleich.tsx:143`. | **нет** |
| 23 | SegmentedControl и RadioCardGroup используют native radio input; рукописных элементов `role="radio"` нет. Switch соответствует собственному контракту — `<button role="switch">`, а не radio; именно такую анатомию требует `components-core.md`. Табы S2 имеют manual activation Enter/Space и Home/End, `src/components/controls.tsx:68-90,188-209,278-305`, `src/screens/S2Vorbereitung.tsx:28-76`. | да |
| 24 | Словарь de/en, de-fallback и независимые `uiLanguage`/`density` существуют; switch S6 живой. Но shell chrome не весь на ключах: `legend="Modus"` жёстко немецкий, Sidebar оставляет `Variante «Basis» · ○ Vorbereitung · intern/Präsentation`; временный EN-render получился смешанным, `src/App.tsx:66-83`, `src/components/Sidebar.tsx:45-52`. | **нет** |

Итого подтверждены только **17, 19, 23**. Для пункта 23 применён сам
контракт: `design-system/components-core.md:558-600` прямо требует для Switch
`<button role="switch">`; RADIO-001 относится к двум radio-группам.

## Новые дефекты сверх 24 пунктов

Счёт `K=3` включает только отдельные находки, не повторяет провалы двух
таблиц.

1. **DC-12 считает действия без ценового принятия как `übernommene Änderungen`.**
   Число равно `s.journal.length`, `src/components/OfferPanel.tsx:372-377`.
   В прямом сценарии EH55→EH40, затем `sendOffer`, сумма осталась
   `≈ + 97.000 €`, но подпись стала `2 übernommene Änderung(en)`: отправка
   увеличила счётчик изменения цены. То же происходит с подтверждениями без
   `deltaExact` и undo-событиями.

2. **Общий formatter delta/preview снова ставит знак перед `≈`.**
   `signed()` возвращает порядок `+ ≈ 97.000 €`,
   `src/components/OfferPanel.tsx:429-433`; он используется activeDelta и
   DC-28 preview, `src/components/OfferPanel.tsx:181-205`. Исправленный порядок
   существует только в специальном `dc12Delta()`.

3. **Кнопка постоянного Undo активна, когда отменять уже нечего.**
   Disabled зависит от `journal.length === 0`,
   `src/components/OfferPanel.tsx:394-398`, тогда как курсор проверяет наличие
   неотменённого события с inverse, `src/state/store.ts:638-644`. После
   EH40→undo журнал непуст, кнопка не имеет `aria-disabled`, а нажатие — no-op.

## Тесты, история и SSR-регресс

Заявленные **54** теста в дереве коммита `2d7ee30` воспроизводятся: 27 + 6 +
21. До него было 50. Сейчас тестов 64: к 54 добавлены десять store-тестов;
`git diff 2d7ee30..HEAD` для тестов — только 111 добавленных строк, без
удалений. При сравнении с прежними 50 есть 173 добавления и 10 удалений;
удалённые строки — старые reset через публичный `setState`, прямой `apply` и
старое имя поля конфликта, заменённые новыми API/проверками. Неудобный сценарий
не удалён и ожидаемое значение не ослаблено. Тест DC-44 проверяет точный список
четырёх драйверов, их точные суммы, равенство итогу и повторяет сверку с пятым
Regionalfaktor.

При этом текущие тесты не покрывают найденные границы: мутацию ссылок из
`getState`, удаление snapshot, композицию undo с новым событием, повторный undo
после redo и корректность доступности кнопки Undo.

Сопоставимые SSR-состояния содержимое не потеряли: S1 в принудительно loaded
состоянии сохранил 400 текстовых символов, S2 — 1088, S4 — 1080, S5 — 515.
Центральный S3 стал короче (609 против 1362), потому что price/schedule/KG
вынесены в постоянную OfferPanel; полный App вырос с 1457 до 2656 текстовых
символов. S6 вырос с 1384 до 1662. Обычный первый SSR S1 теперь содержит только
skeleton (55 символов), а после перехода в loaded-state карточка и группы на
месте; это граница snapshot-state, не потеря конечного содержимого.

## Provisional-токены

Все пять токенов с буквальной пометкой `[provisional]` названы в
`docs/audit/adr-drafts-260806.md`: `--panel-left-width`,
`--duration-toast-undo`, `--size-toast-max-width`,
`--size-popover-max-width`, `--motion-delay-hover-preview`. Эта сверка
проходит. Отдельно verify справедливо не принимает место хранения
`--duration-toast-undo`: наличие ADR-заготовки не отменяет GATE-R15.

## Что по-прежнему проверяется только в браузере

- фактическая геометрия трёх зон, горизонтальный overflow, переносы и
  computed hit-area 44×44 на реальных viewport/zoom;
- computed размеры 64/48, белая подложка, cascade токенов, контраст и загрузка
  Visuelt Pro;
- настоящий keyboard/focus route: native-radio arrows, табы Home/End и
  manual activation, возврат фокуса из popover, screen-reader announcements;
- реальная задержка hover/focus preview, touch-поведение, волна, count-up,
  reduced-motion и отсутствие layout shift;
- пауза/истечение восьмисекундного toast и порядок Esc при одновременно
  открытых слоях;
- гидрированный переход S1 skeleton→content и таймер доставки 2,5 секунды;
- PDF, письмо и delivery receipt остаются симуляцией: реальных выходных
  файлов/доставки для проверки нет.

## Итог

Ремедиация существенна: курсор обычного undo, атомарный конфликт, fixture
chain, честность S5 и проверенные прежние дефекты разметки исправлены. Но M-4
по-прежнему обходится публичными ссылками, OfferSnapshot изменяем, Annahmen не
дословны, verify красный; ночные DC-44/DC-28/DC-29 и presentation/i18n заявлены
шире фактического объекта. Приёмка невозможна.
