ВОЛНА D: принято 2/3 блоков · «магазин» 9 из 14 (было 7) · немецкого в EN: 76 фрагментов · пометка EN снимается: нет

# Приёмка волны D

Дата прохода: 07.08.2026. Автор несколько раз нарушал заморозку `src/**` во время приёмки; все промежуточные замеры отброшены. Финальный проход начат на чистой контрольной точке `HEAD = 886be4d9b6a1c346c06499496d39c97be293c5cf`, сводный SHA-256 `src/** = 9277b10ad1e774fcf99cf60dd0466087fa990b34f805bd0fe5734f6bf7b7280e`. В финальном проходе `src/**` только читался.

## A. Три повторно принимаемых блока

| блок | вердикт | проверенный механизм |
|---|---|---|
| 4 · слоты и popover | **принят** | Ghost реально имеет четыре объявленные `.a3-ghost-line` по 24 px; slot/content = 96/96 px. Delta slot/content = 58/30 px. Между max-preview и показанной delta `recapTop` не сдвинулся: 588 → 588 px. При viewport height 500 trigger был `318…362`, dialog после завершения motion — `134…492`: слой раскрылся вверх, полностью остался в viewport и сфокусировал `Schließen`. Причина провала волны C закрыта: `.a3-show` ставится до измерения (`src/components/OriginPopover.tsx:58-76,140-170`). |
| 5 · DC-14 / DC-30 / DC-33 / DC-43 | **принят** | `guidedTour`, `internalNote` и `clientOutputGate` объявляют все семь осей с реализацией либо конкретной причиной N/A (`src/state/data-states.ts:97-123`). DC-14 фильтрует шаги по живым целям, отсутствующую цель пропускает, в presentation не рендерится (`src/components/GuidedTour.tsx:72-155`). Closed gate в DOM нет, open gate фокусирует `h4` (`src/components/ClientOutputGateDialog.tsx:42-85`); header открывает gate, а не вызывает `setMode` (`src/App.tsx:169-180`). `InternalNote` владеет своей секцией и в presentation возвращает `null` до неё (`src/components/InternalNote.tsx:54,81-112`; `src/screens/OpportunityCard.tsx:222-226`). Tests покрывают единый gate, пустую цель тура и его permission-state. |
| 2 · раскладка | **отклонён** | Сама grid теперь считает host: grid/scroll равны, внутри grid ни одна плитка не выходит. Но при центральной колонке 300 px `main client/scroll = 300/370`; все 21 плитка главы 2 выходят за правую границу `main` на 22,25 px. Причина: handoff TASK-22 требовал сделать `fieldset` носителем `.a3-grid-host`, а в `src/components/controls.tsx:205-228,350-353` добавлен дочерний `div`; min-content самого `fieldset` остался необнулённым. Измерение: `main right = 656,27`, tile right = 678,52. На 640/1240 px выходов нет; видимые медиа имеют соотношение 1,333, а на 300 px скрыты целиком — полосок нет. |

Итог A: **принято 2/3**. Для добора блока раскладки нужно перенести `.a3-grid-host` на два `fieldset` либо эквивалентно обнулить min-inline-size у каждого родителя. Повторный критерий — не только `grid.scrollWidth === grid.clientWidth`, но и ноль tile rectangles за границей `main` на 300 px.

## B. EN — 76 видимых фрагментов

Независимый обход живого DOM на EN golden path совпал с актуальным DOM-инвентарём: **76 уникальных фрагментов**. Из них 59 — пропуски перевода, 7 — значения фикстур, 10 — содержимое артефактов D-13. Чистых нормативных имён, которые сами по себе объясняли бы остаток, — 0; нормативный акроним внутри немецкой фразы не делает всю фразу нормативным именем.

### Пропуск перевода: ключ есть, но мост не подключён — 24

Причина каждой строки в этом списке: **пропуск перевода; готовый ключ не проведён через `tx/t` в месте рендера**.

- `Basis ist der exakte Rechenwert, nie der angezeigte (CALC-007).`
- `Der Gesamtbetrag bleibt unverändert — 70/22/8 verteilt, was bereits gerechnet ist.`
- `EN: Entwurf — Übersetzung noch nicht vollständig`
- `Gebäude im Projekt`
- `Gebäudeklasse nach MBO §2`
- `Kalender: Kalendermonate · Staffelstart aus ScheduleModel · DEMO-SC-01`
- `Kunde`
- `Leistungsbeginn ab OK Decke über UG`
- `Schätzunsicherheit`
- `Total NUF nach DIN 277`
- `Total WFL nach WoFlV`
- `Wohnfläche WFL nach WoFlV`
- `aktuelle Auswahl`
- `aus Dokument`
- `enthält die abgeleitete S-Fläche`
- `nach HOAI und AHO`
- `nach Planung`
- `nicht Bestandteil`
- `nicht enthalten`
- `nur Unterschiede`
- `vollständig inkl. Gründung`
- `vom Kunden bestätigt`
- `€/m² WFL nach WoFlV`
- `≈ 85 % der BGF R+S`

### Пропуск перевода: ключа нет — 35

Причина каждой строки в этом списке: **пропуск перевода; английской строки нет в словаре**.

- `. Die Preiswirkung erscheint sofort in der Angebotsspalte rechts und im Kostentreiber.`
- `200 im Angebot:`
- `Ab GK 5 ist ein Personenaufzug erforderlich — die Wahl ist keine kaufmaennische Entscheidung`
- `Alle Zahlen rechts gelten für den gesamten Komplex.`
- `Baukonstruktion und technische Anlagen sind keine Auswahl: ohne sie gibt es kein Angebot. Baunebenkosten sind immer enthalten — verhandelbar ist nur die Berechnungsart, und die ist intern.`
- `Beiträge · Summe =`
- `Drei Zustände, weil «nicht enthalten» eine Entscheidung ist und «noch offen» eine Lücke. Solange eine Lücke bleibt, weist das Angebot eine Zwischensumme der kalkulierten Positionen aus und keinen Gesamtpreis.`
- `Entscheidung, keine Lücke: die Summe bleibt vollständig`
- `Gebäude`
- `Gebäude ·`
- `Gebäudedaten`
- `Gebäudedaten DEMO-B-A bestätigt`
- `Gerundet auf 1.000 €; exakter Rechenwert 3.817.835,00 €`
- `Kern des Angebots`
- `Kundenansicht gesperrt: Klassifikation nach MBO`
- `Lücke, keine Entscheidung: das Angebot weist keinen Gesamtpreis aus`
- `Marge Eigenleistung nach Rabatt:`
- `Nicht verfügbar`
- `Opportunities · sortiert nach Reihenfolge der Übergabe aus HubSpot`
- `Planung ist Projektgröße, Ausführung gehört zum Gebäude — deshalb zwei Zeilen und nicht eine. Die Fertigstellung ist dieselbe Zahl, die oben rechts als Kennzahl steht.`
- `Schätzunsicherheit ±`
- `Umfang der Anzeige`
- `Von oben nach unten: erst der Umfang, dann die Konstruktion, zuletzt die Oberfläche. Jede Antwort zeigt ihre Folge am Preis, bevor sie gewählt wird.`
- `Werte aus`
- `Werte extrahiert · Regelsatz RS 2026.2`
- `Zertifikate sind eine eigene Achse: der Energiestandard beschreibt das Gebäude, das Siegel beschreibt das Verfahren, mit dem es nachgewiesen wird.`
- `Zwei Verfahren mit unterschiedlichem Ergebnis. Das All3-Verfahren verteilt die bereits berechnete Summe und ändert den Gesamtbetrag nicht; HOAI und AHO rechnen die Nebenkosten als eigene Position hinzu. Der Kunde sieht in beiden Fällen dieselbe Aussage: KG 700 ist enthalten.`
- `andere Dokumente sind vollständig analysiert.`
- `bestätigt.`
- `dieser Datei`
- `für den Prototyp abgeleitet, nicht kalibriert`
- `ohne Preisansatz im indikativen Angebot`
- `§2 nicht bestätigt.`
- `− 124.000 € € gegenüber Aufnahme`
- `− 230.000 € € gegenüber Aufnahme`

Последние две строки дополнительно несут copy/format defect: единица евро выведена дважды.

### Значения фикстур — 7

Причина каждой строки: **значение фикстуры**, а не UI-copy. Для трёх оснований каталога это законная классификация для этого замера; если UI-language обязан локализовать и фикстурные основания, нужна отдельная policy.

- `Einbaukueche und Erstausstattung je m² BGF R ⚙`
- `Musterhöfe Westpark`
- `Musterquartier Südhang`
- `Wege, Stellplaetze im Freien, Bepflanzung je m² BGF R ⚙`
- `bauseits; im indikativen Angebot ohne Preisansatz ⚙`
- `nächste Woche`
- `Österreich`

### Содержимое артефактов D-13 — 10

Причина каждой строки: **содержимое артефакта по D-13**, а не язык оболочки.

- `Bauantrag_Mappe_Muster.pdf · Baugrubenaushub im Leistungsverzeichnis`
- `Bauantrag_Mappe_Muster.pdf · Holzbauweise im Erlaeuterungsbericht`
- `Bauantrag_Mappe_Muster.pdf · Lueftungskonzept mit Waermerueckgewinnung`
- `Bauantrag_Mappe_Muster.pdf · Waermepumpe im Energiekonzept`
- `Grundrisse_Muster_V2.pdf · Aufzugsschacht im Kern`
- `Grundrisse_Muster_V2.pdf · Balkone und Loggien, WoFlV §4`
- `Grundrisse_Muster_V2.pdf · Stellplaetze im Erdgeschoss`
- `Grundrisse_Muster_V2.pdf · Tiefgarage im UG`
- `Residential area · WFL nach WoFlV: two candidates.`
- `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser indikatives Angebot für das Musterprojekt Nordfeld.\n\nMit freundlichen Grüßen`

Итог B: даже после исключения 17 объяснимых fixture/artifact строк остаются **59 пропусков перевода**. Пометка `EN · Entwurf` **не снимается**.

## C. Четвёртый UX-замер

Шкала та же: «магазин» требует видимого выбора, его последствия до commit и безопасного эксперимента, а не только карточного вида.

| поверхность | решений одновременно | до видимого последствия | progress / next | безопасность | плотность | вердикт |
|---|---:|---:|---|---|---|---|
| Список | 4 фильтра + карточки | — | корень и CTA ясны | фильтры обратимы | умеренная | **между** |
| Opportunity | file/conflict/parameters/gate | 3–4 | ring 2/2, путь в Option | Undo; manual capture | очень высокая | **между** |
| Глава 1 | scope + buildings + energy | 1 | scope честно называет что считается | energy preview, Undo, обратимый scope | высокая, но иерархия ясна | **магазин** |
| Глава 2 | до 9 групп | 1 | chapter + next | price preview, ghost, Undo | длинный каталог | **магазин** |
| Глава 3 | 4 coverage-решения | 1 | total consequence + next | цена на каждой плитке, Undo | 12 плиток, 0 SegmentedControl | **магазин** |
| Глава 4 | engineering-группы | 1 | chapter + next | ghost/Undo | длинный каталог | **магазин** |
| Глава 5 | energy + certificates | 1 | chapter + next | ghost/Undo + confirm | умеренная | **магазин** |
| Глава 6 | 3 факта + basement | 1 | chapter + next | ghost/Undo | форма + плитки | **между** |
| Глава 7 | 2 risk-решения | 1 | chapter + next | preview, apply/remove, Undo | умеренная | **магазин** |
| Глава 8 | 1 способ расчёта | 1 | chapter + next | Undo; preview малополезен | разреженная | **между** |
| Глава 9 | read-only schedule | нет | CTA к Vergleich | только просмотр | Gantt + таблица | **между** |
| Правая панель | total, drivers, recap, gate | мгновенно | gate + journal | live delta, ghost, Undo | высокая, slots стабильны | **магазин** |
| Vergleich | варианты рядом | уже рядом | CTA к Export | Options изолированы | плотная таблица | **магазин** |
| Export | 6 artifacts, discount, email | 1 | Compose → Preflight → Confirm | snapshot + preflight | две колонки | **магазин** |

Новый счёт — **9 из 14**. Изменились ровно две поверхности:

- Глава 1: **«налоговая форма» → «магазин»**. DC-46 явно переключает охват, объясняет контекст чисел, а DC-47 даёт сравнение зданий; последствия energy-выбора видны до commit. Адреса: `src/screens/ChapterBuildings.tsx:73-142,144-186,265-278`.
- Глава 3: **«налоговая форма» → «магазин»**. Четыре coverage-решения теперь раскрыты в 12 option tiles; каждая несёт денежное или completeness-последствие, а `SegmentedControl` в главе больше нет (`src/screens/S3Konfigurator.tsx:193-273`).

## D. Прогоны

| проверка | результат |
|---|---|
| `npm test` | **прошёл**: 152/152, 8 файлов; DOM EN-budget = 76 |
| `npm run build` | **прошёл**: 478 modules; 43 option WebP, включая обязательные QNG/DGNB логотипы; JS 607,46 kB, CSS 87,39 kB; только Vite warning о chunk >500 kB |
| `npm run verify` | **прошёл**: 0 new, 4 known-open, 21 warnings; warning selftest 13 веток / 0 failures |
| `git diff --check` | **прошёл** |
| `prefers-reduced-motion: reduce` | **прошёл**: ghost/delta/toast transition 0s, animation none |
| фокус после смены главы | **прошёл**: active element `MAIN`, H1 = `Baugrund & Erschließung` |
| ghost/delta slots | **прошли**: 96/96 и 58/30 px; recap shift 0 |
| popover при height 500 | **прошёл**: dialog 134…492, в viewport, открывается вверх |
| tiles при center 300 / 640 / 1240 | **не прошли** на 300: 21/21 выходит за `main` на 22,25 px; на 640/1240 — 0; image ratio 4:3 либо media скрыто |
| EN golden path | **не прошёл критерий снятия пометки**: 76 fragments, из них 59 пропусков |

Волна D не принята целиком: остаются один точечный layout-дефек в `src/components/controls.tsx:205-228,350-353` и 59 необъяснимых пропусков EN. Слоты/popover, контракты DC-14/DC-30/DC-33/DC-43 и две UX-ремедиации приняты.
