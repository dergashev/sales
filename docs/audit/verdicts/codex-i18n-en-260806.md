ВЕРДИКТ: ключей переведено 434 · не переводится по норме 32 · дефектов источника 18 · вопросов PO 5

# Основание подсчёта

Независимый проход выполнен по всему runtime-коду `src`, а не только по 16 файлам из машинной выборки. Единица `N` — уникальный целый message key (включая ветки состояния и ICU plural), а не литерал, фрагмент JSX или экранное повторение. Одинаковый смысл переиспользует один ключ. На стартовом срезе в `src/i18n/index.ts` было **16**, а не заявленные 15 ключей. Во время прохода параллельный commit `9badec5` добавил ещё три; текущий словарь содержит 19. `shell.mode.legend` уже совпадает с каталогом, а фрагменты `shell.variant` и `shell.phase.vorbereitung` должны быть заменены целым `shell.variantSummary`, поэтому не увеличивают `N`.

Расхождение с 156 ожидаемо и является находкой: выборка пропустила как минимум `src/App.tsx`, `src/components/controls.tsx`, `src/components/OriginPopover.tsx`, `src/components/Diagnostics.tsx` и `src/lib/font-check.ts`, а также доступные имена, состояния, строки конфигурации, журнал и варианты динамических сообщений. Клиентский текст двух Annahmen, тело письма и содержимое PDF в `N` не входят.

Каталог для механической реализации: `docs/audit/verdicts/content/i18n-en-260806.md`. Все 434 ключа имеют состояние `draft`.

# Дефекты немецкого источника

1. **Неверная исходная инвентаризация.** На стартовом срезе в объекте `de` было 16, а не 15 ключей; после параллельного commit `9badec5` их 19 (`src/i18n/index.ts:22`). Видимый runtime-текст есть и вне заявленных 16 файлов, например `src/components/controls.tsx:241`, `src/components/OriginPopover.tsx:98`, `src/components/Diagnostics.tsx:94` и `src/lib/font-check.ts:27`.

2. **Одна поверхность одновременно немецкая и русская.** QA-экран немецкий (`src/screens/Grundlagen.tsx:50`), но вся диагностика и её runtime-ошибки русские (`src/components/Diagnostics.tsx:23`, `src/components/Diagnostics.tsx:94`, `src/lib/font-check.ts:39`, `src/lib/font-check.ts:80`). Это не fallback и не клиентские данные.

3. **Неясное имя QA-сущности.** `Grundlagen` в навигации выглядит как продуктовый раздел (`src/i18n/index.ts:29`), а сам экран является внутренней витриной и диагностикой (`src/screens/Grundlagen.tsx:54`, `src/screens/Grundlagen.tsx:114`). Без контекста нельзя решить, означает ли источник foundations, reference или QA.

4. **Один режим назван с разным регистром и формой.** `Intern` (`src/i18n/index.ts:31`), `intern · Δ-Werte sichtbar` (`src/screens/S2Vorbereitung.tsx:63`) и `Einstellungen · intern` (`src/screens/S6Einstellungen.tsx:24`). Состояние должно получать один ключ.

5. **Одна Building-сущность названа `Haus`, тогда как остальная терминология использует Gebäude/Building.** Примеры: `src/components/Sidebar.tsx:47`, `src/screens/S2Vorbereitung.tsx:193`, `src/screens/S4Vergleich.tsx:143`. Английская оболочка не должна наследовать это расхождение как `House A`.

6. **`Muster` нельзя перевести без контекста.** Один и тот же badge стоит у всех типов артефактов (`src/screens/S5Export.tsx:99`), но источник не говорит, означает ли он sample, demo или template и не сообщает, что сами файлы остаются немецкими. Draft уточняет `German sample`; это вынесено на решение PO.

7. **Состояние Regionalfaktor имеет пять формулировок.** `deaktiviert` (`src/components/OfferPanel.tsx:115`), `inaktiv` (`src/components/OfferPanel.tsx:225`), `nicht berücksichtigt` (`src/components/OfferPanel.tsx:263`), `nicht aktiviert` (`src/screens/S5Export.tsx:250`) и `Standard: aus` (`src/screens/S6Einstellungen.tsx:36`). Draft разводит состояние `enabled/disabled` и действие расчёта `applied/not applied`.

8. **`notApplicable` имеет два имени.** `n. a.` в кратком покрытии (`src/components/OfferPanel.tsx:36`) и `nicht anwendbar` в состоянии (`src/state/store.ts:786`). `n. a.` также двусмысленно рядом с `not available`.

9. **Этапы доставки смешивают английский и немецкий внутри одной сущности.** `Compose`, `Preflight`, `Confirm & Send`, затем `Delivery status · Gesendet/Zugestellt` (`src/screens/S5Export.tsx:263`). Нужен один набор stage keys.

10. **Текст настройки языка устаревает в момент реализации Task 07.** Он утверждает, что EN-guidance не переведён и откатывается на немецкий (`src/screens/S6Einstellungen.tsx:176`), хотя задача поставляет этот copy как draft. В каталоге дано целевое сообщение о draft и отсутствии EN-артефактов.

11. **Динамические числа не имеют полной грамматики числа.** `offene Fragen` (`src/screens/S1Projektliste.tsx:80`), `Diese … Fragen` (`src/screens/S2Vorbereitung.tsx:334`), `Dokumente gelesen` и `Planversionen gefunden` (`src/components/DocumentAnalysis.tsx:43`) дают неверное единственное число. Нужны ICU plural keys.

12. **Sidebar собран склейкой сущностей и состояний.** Project/building summary и variant/stage/mode summary конкатенируются в `src/components/Sidebar.tsx:47` и `src/components/Sidebar.tsx:50`. Порядок слов нельзя локализовать по фрагментам.

13. **S1 собирает предложения из фрагментов.** Accessible action (`src/screens/S1Projektliste.tsx:64`), встреча (`src/screens/S1Projektliste.tsx:75`), analysis/question/blocker state (`src/screens/S1Projektliste.tsx:78`) и demo-note (`src/screens/S1Projektliste.tsx:106`) должны стать целыми ключами.

14. **DocumentAnalysis собирает фазы и ошибки по немецкому порядку слов.** Фазы — `src/components/DocumentAnalysis.tsx:43`; filename/reason и число успешных документов — `src/components/DocumentAnalysis.tsx:117`; paused-state — `src/components/DocumentAnalysis.tsx:137`. Замена отдельных существительных не даст корректный EN.

15. **S2 содержит несколько независимых конкатенаций сообщений.** Tab label (`src/screens/S2Vorbereitung.tsx:86`), WFL conflict (`src/screens/S2Vorbereitung.tsx:220`), resolved alternative (`src/screens/S2Vorbereitung.tsx:245`), вопрос с двумя процентами (`src/screens/S2Vorbereitung.tsx:334`) и assumption count (`src/screens/S2Vorbereitung.tsx:430`) требуют целых ключей.

16. **S3/S4 строят navigation и comparison copy из фрагментов данных.** Progress/previous/next chapter — `src/screens/S3Konfigurator.tsx:70`, `src/screens/S3Konfigurator.tsx:90`, `src/screens/S3Konfigurator.tsx:95`; строковые row/cell states — `src/screens/S4Vergleich.tsx:67`. Особо неясно `GK Zeit` в объяснении срока (`src/screens/S4Vergleich.tsx:184`): это не определённый пользователю термин.

17. **S5 строит preflight и snapshot по немецкому синтаксису.** Stage heading (`src/screens/S5Export.tsx:132`), checklist с числами (`src/screens/S5Export.tsx:168`), confirm summary (`src/screens/S5Export.tsx:208`) и snapshot (`src/screens/S5Export.tsx:248`) должны быть целыми ключами. Тело письма на `src/screens/S5Export.tsx:49` намеренно исключено: это клиентский артефакт.

18. **Offer/journal/formatters возвращают локализованные предложения из domain-кода.** Offer summary и origin (`src/components/OfferPanel.tsx:104`, `src/components/OfferPanel.tsx:141`), benchmark (`src/components/OfferPanel.tsx:246`), journal summary (`src/components/OfferPanel.tsx:459`), event labels (`src/state/store.ts:394`, `src/state/store.ts:434`, `src/state/store.ts:586`, `src/state/store.ts:643`), rounding disclosure (`src/engine/money.ts:71`) и months/delta (`src/engine/schedule.ts:90`, `src/engine/schedule.ts:131`) должны получать локализатор и именованные параметры.

Известные исполнителю дефекты глобального `NNBSP`, отсутствия `Intl` и тихого немецкого fallback повторно не засчитывались в эти 18.

# Вопросы PO

1. **Проценты UI.** Утвердить `±22%` в английской оболочке по `output-model.md` §8.4, при том что деньги, площади и прочие проектные числа остаются в локали проекта. Draft использует вариант без пробела; валютный формат не меняет.

2. **Имена фикстурных сущностей.** Утвердить границу: `Musterprojekt Nordfeld`, `Musterland` и сохранённые названия вариантов остаются данными без перевода, а chrome `Haus A` становится `Building A`. Иначе требуется отдельная модель локализованных display names, а не словарные ключи.

3. **Артефакт-селектор.** Утвердить английские UI-названия шести типов при неизменных немецких файлах и badge `German sample`. Альтернатива — показывать немецкое имя файла как данные, но тогда нельзя выдавать его за локализованное название типа.

4. **Название QA-раздела.** Утвердить `Foundations` либо переименовать сущность в `QA reference`. Draft сохраняет существующее намерение как `Foundations`, но немецкий источник контекст не фиксирует.

5. **`GK Zeit`.** Подтвердить, что `src/screens/S4Vergleich.tsx:183` означает *building-class schedule factor*. Draft раскрывает именно это; если это другое поле, исходнику и ключу нужно каноническое имя.

# Что нельзя проверить без запуска в браузере

- фактическое переключение всех 434 ключей без смешанного DE/RU/EN DOM и видимое состояние `draft`/`Not translated` у fallback;
- переносы и обрезание EN в Sidebar, сегментах, карточках RadioCard, OfferPanel и финансовых таблицах при реальных Visuelt Pro metrics;
- accessible names, порядок чтения целых сообщений и объявления ICU plural в screen reader;
- фокус, disabled reason, popover и toast после замены склеек на целые ключи;
- сочетание локали проекта с EN-оболочкой: `3.818.000 €`, даты проекта и выбранное PO-правило `22%`;
- сохранение явных `Sample`, `Prototype`, `Simulation` и `simulated delivery confirmation` во всех состояниях доставки и анализа.
