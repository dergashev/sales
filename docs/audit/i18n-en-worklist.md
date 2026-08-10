# Остаток EN — адресный список работ

Сгенерировано `tools/i18n_worklist.py` из `docs/audit/i18n-en-remainder-dom.md`.
Замер по DOM отвечает «сколько», этот файл — «где и почему».
Классификация машинная: принадлежность фрагмента словарю целым
значением или частью значения проверяется по тому же слиянию поставок,
из которого собирается `src/i18n/generated.ts`.

**Всего в остатке 51** · обёртка `tx()` хватит: 20 · целый ключ с числом: 14 · данные фикстур D-13: 3 · собрано в рантайме: 7 · вне словаря: 0 · ждут копирайта: 7

Адрес в исходнике найден у 41 из 44: остальные собираются из частей и точным литералом в коде не существуют — это и есть признак конкатенации, а не пропуска поиска.

## Работы в `src` — по причине, а не по алфавиту

### конкатенация с числом — нужен целый ключ (правило 36) — 14

| фрагмент | адрес | что делать |
|---|---|---|
| 200 im Angebot: | src/screens/S3Konfigurator.tsx:669 | целый ключ с подстановкой вместо частей · поставка помечает «да: номер KG» · есть `remainder5.coverage.kg200InOffer` на кусок — это мост, а не решение |
| Einbaukueche und Erstausstattung je m² BGF R ⚙ | — | целый ключ с подстановкой вместо частей · поставка помечает «да: area unit» · есть `remainder5.fixture.kg600KitchenBasis` на кусок — это мост, а не решение |
| Gebäude im Projekt | src/screens/OpportunityCard.tsx:190 | целый ключ с подстановкой вместо частей · поставка помечает «да: счётчик вне ключа» · есть `oppcard.buildingsInProject` на кусок — это мост, а не решение |
| Gebäude · | src/screens/OpportunityList.tsx:224 | целый ключ с подстановкой вместо частей · поставка помечает «да: count follows» · есть `remainder5.buildings.prefix` на кусок — это мост, а не решение |
| Gerundet auf 1.000 €; exakter Rechenwert 3.817.835,00 € | — | целый ключ с подстановкой вместо частей · поставка помечает «да: currency and values» · есть `remainder5.money.roundingDisclosureDemoA` на кусок — это мост, а не решение |
| Marge Eigenleistung nach Rabatt: | src/components/DiscountControl.tsx:150 | целый ключ с подстановкой вместо частей · поставка помечает «да: amount follows» · есть `remainder5.discount.inHouseMarginAfter` на кусок — это мост, а не решение |
| Residential area · WFL nach WoFlV: two candidates. | — | целый ключ с подстановкой вместо частей · поставка помечает «да: candidate count» · есть `remainder5.conflict.wflCandidates` на кусок — это мост, а не решение |
| Schätzunsicherheit | src/components/ClientOutputGateDialog.tsx:101 · src/components/UncertaintyBand.tsx:7 · src/components/primitives.tsx:308 | целый ключ с подстановкой вместо частей · поставка помечает «да: percentage in cells» · есть `s4.row.uncertainty` на кусок — это мост, а не решение |
| Schätzunsicherheit ± | src/components/UncertaintyBand.tsx:7 · src/components/primitives.tsx:308 · src/screens/S5Export.tsx:82 | целый ключ с подстановкой вместо частей · поставка помечает «да: percentage follows» · есть `remainder5.uncertainty.prefix` на кусок — это мост, а не решение |
| Total NUF nach DIN 277 | src/screens/OpportunityCard.tsx:199 | целый ключ с подстановкой вместо частей · поставка помечает «да: площадь вне ключа» · есть `oppcard.totalNufDin277` на кусок — это мост, а не решение |
| Total WFL nach WoFlV | src/screens/OpportunityCard.tsx:198 | целый ключ с подстановкой вместо частей · поставка помечает «да: площадь вне ключа» · есть `oppcard.totalWflWoflv` на кусок — это мост, а не решение |
| andere Dokumente sind vollständig analysiert. | src/components/DocumentAnalysis.tsx:164 | целый ключ с подстановкой вместо частей · поставка помечает «да: count precedes» · есть `remainder5.analysis.otherDocumentsComplete` на кусок — это мост, а не решение |
| €/m² WFL nach WoFlV | src/components/OfferPanel.tsx:195 · src/engine/money.ts:169 · src/fixtures/demo-0001.json:224 | целый ключ с подстановкой вместо частей · поставка помечает «да: rate in cells» · есть `s4.row.wflRate` на кусок — это мост, а не решение |
| ≈ 85 % der BGF R+S | src/fixtures/derived-prototype.json:13 · src/screens/OpportunityCard.tsx:197 | целый ключ с подстановкой вместо частей · поставка помечает «да: процент» · есть `oppcard.bgfDerivedRatio` на кусок — это мост, а не решение |

### литерала в исходнике нет — строка собрана в рантайме — 7

| фрагмент | адрес | что делать |
|---|---|---|
| . Die Preiswirkung erscheint sofort in der Angebotsspalte rechts und im Kostentreiber. | src/screens/OptionChapter.tsx:302 | JSX: `{MARK} · {DERIVED_LABEL}` и следом узел, начинающийся с точки · ключ `remainder5.option.priceEffectSuffix` |
| Gebäudedaten DEMO-B-A bestätigt | src/screens/ChapterBuildings.tsx:288 · src/state/store.ts:1507 | шаблон с id здания — ДВА места, одна фраза: экран и подпись события журнала; перевести надо оба одной правкой, иначе журнал останется немецким при английском экране · ключ `remainder5.buildings.dataConfirmedDemoA` |
| Opportunities · sortiert nach Reihenfolge der Übergabe aus HubSpot | src/screens/OpportunityList.tsx:152 | `{shown.length} von {items.length} Opportunities · …` — два числа перед текстом · ключ `remainder5.opportunities.hubspotOrder` |
| Sehr geehrte Damen und Herren, anbei erhalten Sie unser indikatives Angebot für das Muster | src/screens/S5Export.tsx:62 | конкатенация двух литералов через `+` с `\n\n` · ключ `remainder5.email.indicativeOfferNordfeld` |
| Werte extrahiert · Regelsatz RS 2026.2 | src/components/DocumentAnalysis.tsx:58 | шаблон `Werte extrahiert · Regelsatz RS${NNBSP}2026.2`: узкий пробел подставляется выражением, поэтому целой строки в файле нет вовсе · ключ `remainder5.analysis.valuesExtractedRuleset` |
| bauseits; im indikativen Angebot ohne Preisansatz ⚙ | src/fixtures/derived-prototype.json:519 | ДАННЫЕ, а не хром: `basis` производного значения по D-22; знак ⚙ приписывается при показе · ключ `remainder5.fixture.clientProvidedNoAllowance` |
| §2 nicht bestätigt. | src/screens/S5Export.tsx:76 | часть длинной строки `ValidationIssue offen: … §2 nicht bestätigt — …`, разрезанной переносом в исходнике · ключ `remainder5.classification.section2Unconfirmed` |

### обёртка `tx()` — строка целая, ключ есть — 20

| фрагмент | адрес | что делать |
|---|---|---|
| Beiträge · Summe = | src/components/OfferPanel.tsx:385 | обернуть в `tx()` · ключ `remainder5.offer.contributionsSum` |
| Der Gesamtbetrag bleibt unverändert — 70/22/8 verteilt, was bereits gerechnet ist. | src/screens/S3Konfigurator.tsx:557 | обернуть в `tx()` · ключ `kg700.distributionUnchanged` |
| Gebäudedaten | src/screens/ChapterBuildings.tsx:288 · src/screens/OptionChapter.tsx:160 · src/screens/__tests__/scenario.dom.test.tsx:157 | обернуть в `tx()` · ключ `remainder5.buildings.dataTitle` |
| Kundenansicht gesperrt: Klassifikation nach MBO | src/components/OfferPanel.tsx:606 | обернуть в `tx()` · ключ `remainder5.clientView.blockedMbo` |
| Leistungsbeginn ab OK Decke über UG | src/state/store.ts:1587 | обернуть в `tx()` · ключ `s3.basement.fromSlab` |
| Musterquartier Südhang | src/fixtures/opportunities.json:19 · src/screens/__tests__/opportunities.dom.test.tsx:97 | обернуть в `tx()` · ключ `remainder5.fixture.projectSuedhang` |
| Werte aus | src/components/DocumentAnalysis.tsx:163 · src/screens/Grundlagen.tsx:80 · src/screens/S2Vorbereitung.tsx:63 | обернуть в `tx()` · ключ `remainder5.origin.valuesFrom` |
| Wohnfläche WFL nach WoFlV | src/screens/OpportunityCard.tsx:156 · src/screens/S2Vorbereitung.tsx:206 · src/screens/S3Konfigurator.tsx:338 | обернуть в `tx()` · ключ `s2.data.wflLabel` |
| aktuelle Auswahl | src/components/controls.tsx:140 · src/screens/ChapterBuildings.tsx:276 · src/screens/Grundlagen.tsx:130 | обернуть в `tx()` · ключ `driver.currentSelection` |
| aus Dokument | src/components/primitives.tsx:150 · src/screens/Grundlagen.tsx:146 · src/screens/OptionChapter.tsx:194 | обернуть в `tx()` · ключ `provenance.document` |
| bestätigt. | src/components/OfferPanel.tsx:607 · src/screens/ChapterBuildings.tsx:234 · src/screens/OpportunityCard.tsx:209 | обернуть в `tx()` · ключ `remainder5.status.confirmedSuffix` |
| dieser Datei | src/components/DocumentAnalysis.tsx:163 · src/screens/Grundlagen.tsx:80 | обернуть в `tx()` · ключ `remainder5.document.thisFile` |
| enthält die abgeleitete S-Fläche | src/screens/ChapterBuildings.tsx:209 · src/screens/OpportunityCard.tsx:195 | обернуть в `tx()` · ключ `bldg.includesDerivedSArea` |
| nach HOAI und AHO | src/screens/S3Konfigurator.tsx:552 · src/screens/S4Vergleich.tsx:118 · src/state/store.ts:679 | обернуть в `tx()` · ключ `kg700.hoaiAhoMethod` |
| nach Planung | src/screens/S3Konfigurator.tsx:482 | обернуть в `tx()` · ключ `remainder3.schedule.afterPlanning` |
| nicht Bestandteil | src/screens/S4Vergleich.tsx:105 · src/state/store.ts:1586 | обернуть в `tx()` · ключ `s4.cell.notIncluded` |
| nicht enthalten | src/components/OfferPanel.tsx:67 · src/screens/S2Vorbereitung.tsx:418 · src/screens/S3Konfigurator.tsx:221 | обернуть в `tx()` · ключ `coverage.excluded` |
| nur Unterschiede | src/screens/S4Vergleich.tsx:149 | обернуть в `tx()` · ключ `s4.showDifferences` |
| vollständig inkl. Gründung | src/state/store.ts:1588 | обернуть в `tx()` · ключ `s3.basement.complete` |
| vom Kunden bestätigt | src/components/primitives.tsx:149 · src/screens/Grundlagen.tsx:147 · src/screens/S2Vorbereitung.tsx:173 | обернуть в `tx()` · ключ `provenance.customerConfirmed` |

### данные фикстуры (D-13) — не работа по хрому — 3

| фрагмент | адрес | что делать |
|---|---|---|
| Musterhöfe Westpark | src/fixtures/opportunities.json:31 | язык артефакта, а не интерфейса (D-13): ключом не чинится, хотя поставка выдала `remainder5.fixture.projectWestpark` |
| für den Prototyp abgeleitet, nicht kalibriert | src/fixtures/derived-prototype.json:3 | язык артефакта, а не интерфейса (D-13): ключом не чинится, хотя поставка выдала `remainder5.fixture.derivedNotCalibrated` |
| Österreich | src/fixtures/opportunities.json:44 | язык артефакта, а не интерфейса (D-13): ключом не чинится, хотя поставка выдала `remainder5.country.austria` |

## Перевода нет — в поставку копирайта

- Anteil am Bauwerk (KG 300 + 400 + UG) nach calculation-spec §1 ⚙
- Druckansicht öffnen
- Eigenes Ausgabeprofil clientPrint mit eigener Prüfung — die Freigabe der E-Mail gilt hier nicht.
- Tiefgarage · Lüftung, OS-Beschichtung, Tore
- Untergeschoss · Rohbau und Ausbau
- − 124.000 € gegenüber Aufnahme
- − ≈ 305.000 € gegenüber Aufnahme

## Как это читать

Строка «обёртка `tx()`» — работа на одну правку: словарь держит
перевод целиком, и место рендера просто не спрашивает его.

«Целый ключ с числом» дороже и правкой на месте не закрывается. Ключ
на кусок в словаре есть — поставка выдала его сознательно, чтобы мост
заработал немедленно, — но правило 36 запрещает собирать текст
конкатенацией, и подставлять число обязан форматтер по локали. Взять
здесь `tx()` значило бы закрыть остаток числом, оставив нарушение.

«Собрано в рантайме» — точного литерала в `src` нет: строку сложила
логика. Места сборки найдены чтением и объявлены таблицей в самом
скрипте (`MANUAL_SITES`), а не дописаны в этот файл: дописанное руками
в порождаемый файл исчезает при первом же прогоне. Там, где адреса
нет и в таблице, он не подставляется — угаданный адрес хуже
отсутствующего.

Фрагменты фикстур сюда попадают потому, что DOM их видит, но работой
по хрому они не являются: язык артефакта и язык интерфейса — разные
настройки (D-13), и переводить имя демонстрационного проекта ключом
значило бы стереть эту границу.
