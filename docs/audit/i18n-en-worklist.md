# Остаток EN — адресный список работ

Сгенерировано `tools/i18n_worklist.py` из `docs/audit/i18n-en-remainder-dom.md`.
Замер по DOM отвечает «сколько», этот файл — «где и почему».
Классификация машинная: принадлежность фрагмента словарю целым
значением или частью значения проверяется по тому же слиянию поставок,
из которого собирается `src/i18n/generated.ts`.

**Всего в остатке 52** · обёртка `tx()` хватит: 15 · целый ключ с числом: 13 · данные фикстур D-13: 3 · собрано в рантайме: 4 · вне словаря: 0 · ждут копирайта: 17

Адрес в исходнике найден у 32 из 35: остальные собираются из частей и точным литералом в коде не существуют — это и есть признак конкатенации, а не пропуска поиска.

## Работы в `src` — по причине, а не по алфавиту

### конкатенация с числом — нужен целый ключ (правило 36) — 13

| фрагмент | адрес | что делать |
|---|---|---|
| 200 im Angebot: | src/screens/S3Konfigurator.tsx:1543 | целый ключ с подстановкой вместо частей · поставка помечает «да: номер KG» · есть `remainder5.coverage.kg200InOffer` на кусок — это мост, а не решение |
| Einbaukueche und Erstausstattung je m² BGF R ⚙ | — | целый ключ с подстановкой вместо частей · поставка помечает «да: area unit» · есть `remainder5.fixture.kg600KitchenBasis` на кусок — это мост, а не решение |
| Gebäude im Projekt | src/screens/OpportunityCard.tsx:210 | целый ключ с подстановкой вместо частей · поставка помечает «да: счётчик вне ключа» · есть `oppcard.buildingsInProject` на кусок — это мост, а не решение |
| Gebäude · | src/design-system/registry.tsx:213 · src/screens/OpportunityList.tsx:223 | целый ключ с подстановкой вместо частей · поставка помечает «да: count follows» · есть `remainder5.buildings.prefix` на кусок — это мост, а не решение |
| Gerundet auf 1.000 €; exakter Rechenwert 3.817.835,00 € | — | целый ключ с подстановкой вместо частей · поставка помечает «да: currency and values» · есть `remainder5.money.roundingDisclosureDemoA` на кусок — это мост, а не решение |
| Marge Eigenleistung nach Rabatt: | src/components/DiscountControl.tsx:150 | целый ключ с подстановкой вместо частей · поставка помечает «да: amount follows» · есть `remainder5.discount.inHouseMarginAfter` на кусок — это мост, а не решение |
| Residential area · WFL nach WoFlV: two candidates. | — | целый ключ с подстановкой вместо частей · поставка помечает «да: candidate count» · есть `remainder5.conflict.wflCandidates` на кусок — это мост, а не решение |
| Schätzunsicherheit | src/components/ClientOutputGateDialog.tsx:74 · src/components/EstimateUncertaintyBadge.tsx:17 · src/components/__tests__/design-system.dom.test.tsx:83 | целый ключ с подстановкой вместо частей · поставка помечает «да: percentage in cells» · есть `s4.row.uncertainty` на кусок — это мост, а не решение |
| Schätzunsicherheit ± | src/components/EstimateUncertaintyBadge.tsx:17 · src/components/__tests__/design-system.dom.test.tsx:83 · src/screens/S5Export.tsx:83 | целый ключ с подстановкой вместо частей · поставка помечает «да: percentage follows» · есть `remainder5.uncertainty.prefix` на кусок — это мост, а не решение |
| Total NUF nach DIN 277 | src/screens/OpportunityCard.tsx:219 | целый ключ с подстановкой вместо частей · поставка помечает «да: площадь вне ключа» · есть `oppcard.totalNufDin277` на кусок — это мост, а не решение |
| Total WFL nach WoFlV | src/screens/OpportunityCard.tsx:218 | целый ключ с подстановкой вместо частей · поставка помечает «да: площадь вне ключа» · есть `oppcard.totalWflWoflv` на кусок — это мост, а не решение |
| andere Dokumente sind vollständig analysiert. | src/components/DocumentAnalysis.tsx:164 | целый ключ с подстановкой вместо частей · поставка помечает «да: count precedes» · есть `remainder5.analysis.otherDocumentsComplete` на кусок — это мост, а не решение |
| ≈ 85 % der BGF R+S | src/fixtures/derived-prototype.json:13 · src/screens/OpportunityCard.tsx:217 | целый ключ с подстановкой вместо частей · поставка помечает «да: процент» · есть `oppcard.bgfDerivedRatio` на кусок — это мост, а не решение |

### литерала в исходнике нет — строка собрана в рантайме — 4

| фрагмент | адрес | что делать |
|---|---|---|
| . Die Preiswirkung erscheint sofort in der Angebotsspalte rechts und im Kostentreiber. | src/screens/OptionChapter.tsx:302 | JSX: `{MARK} · {DERIVED_LABEL}` и следом узел, начинающийся с точки · ключ `remainder5.option.priceEffectSuffix` |
| Opportunities · sortiert nach Reihenfolge der Übergabe aus HubSpot | src/screens/OpportunityList.tsx:152 | `{shown.length} von {items.length} Opportunities · …` — два числа перед текстом · ключ `remainder5.opportunities.hubspotOrder` |
| Sehr geehrte Damen und Herren, anbei erhalten Sie unser indikatives Angebot für das Muster | src/screens/S5Export.tsx:62 | конкатенация двух литералов через `+` с `\n\n` · ключ `remainder5.email.indicativeOfferNordfeld` |
| Werte extrahiert · Regelsatz RS 2026.2 | src/components/DocumentAnalysis.tsx:58 | шаблон `Werte extrahiert · Regelsatz RS${NNBSP}2026.2`: узкий пробел подставляется выражением, поэтому целой строки в файле нет вовсе · ключ `remainder5.analysis.valuesExtractedRuleset` |

### обёртка `tx()` — строка целая, ключ есть — 15

| фрагмент | адрес | что делать |
|---|---|---|
| Beiträge · Summe = | src/components/OfferPanel.tsx:392 | обернуть в `tx()` · ключ `remainder5.offer.contributionsSum` |
| Der Gesamtbetrag bleibt unverändert — 70/22/8 verteilt, was bereits gerechnet ist. | src/screens/S3Konfigurator.tsx:1405 | обернуть в `tx()` · ключ `kg700.distributionUnchanged` |
| Leistungsbeginn ab OK Decke über UG | src/state/store.ts:3404 | обернуть в `tx()` · ключ `s3.basement.fromSlab` |
| Musterquartier Südhang | src/fixtures/opportunities.json:19 · src/screens/__tests__/opportunities.dom.test.tsx:151 | обернуть в `tx()` · ключ `remainder5.fixture.projectSuedhang` |
| Projektparameter bestätigt (Gebäude, Flächen, Einheiten) | src/state/store.ts:2641 | обернуть в `tx()` · ключ `domain4.journal.projectParametersConfirmed` |
| Werte aus | src/components/DocumentAnalysis.tsx:163 · src/screens/S2Vorbereitung.tsx:67 | обернуть в `tx()` · ключ `remainder5.origin.valuesFrom` |
| aktuelle Auswahl | src/components/controls.tsx:151 · src/design-system/registry.tsx:122 · src/screens/OptionChapter.tsx:129 | обернуть в `tx()` · ключ `driver.currentSelection` |
| dieser Datei | src/components/DocumentAnalysis.tsx:163 · src/design-system/registry.tsx:304 · src/screens/S3Konfigurator.tsx:904 | обернуть в `tx()` · ключ `remainder5.document.thisFile` |
| enthält die abgeleitete S-Fläche | src/screens/OpportunityCard.tsx:215 | обернуть в `tx()` · ключ `bldg.includesDerivedSArea` |
| nach HOAI und AHO | src/screens/S3Konfigurator.tsx:1400 · src/screens/S4Vergleich.tsx:132 · src/state/store.ts:1583 | обернуть в `tx()` · ключ `kg700.hoaiAhoMethod` |
| nach Planung | src/screens/S3Konfigurator.tsx:1329 | обернуть в `tx()` · ключ `remainder3.schedule.afterPlanning` |
| nicht Bestandteil | src/screens/S4Vergleich.tsx:118 · src/state/store.ts:3403 | обернуть в `tx()` · ключ `s4.cell.notIncluded` |
| noch offen | src/components/OfferPanel.tsx:69 · src/i18n/reasons.ts:17 · src/screens/OptionChapter.tsx:166 | обернуть в `tx()` · ключ `coverage.unknown` |
| nur Unterschiede | src/screens/S4Vergleich.tsx:167 | обернуть в `tx()` · ключ `s4.showDifferences` |
| vollständig inkl. Gründung | src/state/store.ts:3405 | обернуть в `tx()` · ключ `s3.basement.complete` |

### данные фикстуры (D-13) — не работа по хрому — 3

| фрагмент | адрес | что делать |
|---|---|---|
| Musterhöfe Westpark | src/fixtures/opportunities.json:31 | язык артефакта, а не интерфейса (D-13): ключом не чинится, хотя поставка выдала `remainder5.fixture.projectWestpark` |
| für den Prototyp abgeleitet, nicht kalibriert | src/fixtures/derived-prototype.json:3 | язык артефакта, а не интерфейса (D-13): ключом не чинится, хотя поставка выдала `remainder5.fixture.derivedNotCalibrated` |
| Österreich | src/fixtures/opportunities.json:44 | язык артефакта, а не интерфейса (D-13): ключом не чинится, хотя поставка выдала `remainder5.country.austria` |

## Перевода нет — в поставку копирайта

- Anteil am Bauwerk (KG 300 + 400 + UG) nach calculation-spec §1 ⚙
- Die folgenden Auswahlmöglichkeiten sind bereits auf diesen Standard abgestimmt.
- Druckansicht öffnen
- Eigenes Ausgabeprofil clientPrint mit eigener Prüfung — die Freigabe der E-Mail gilt hier nicht.
- Energiestandard und Zertifizierung
- Entschieden in Leistungsabgrenzung — hier nur zur Einordnung sichtbar.
- Erst nach Bestätigung gilt die nachfolgende Konfiguration als abschließbar.
- Geprüfte Gebäudewerte tragen ihre Herkunft; Änderungen heben die Bestätigung auf und werden in Gebäude & Umfang erneut geprüft.
- Immer Bestandteil des Angebots · kein Einfluss auf die Bauzeit — keine Auswahl.
- Konfiguration je Gebäude bestätigt
- Leistungsabgrenzung bestätigen
- Sechs Kostengruppen bestimmen den Angebotsumfang. KG 300, 400 und 700 sind Kern des Angebots und nicht abwählbar — ohne sie gibt es kein Angebot; bei KG 700 ist nur die Berechnungsart verhandelbar, und die ist intern. KG 200, 500 und 600 sind echte Entscheidungen: «noch offen» ist eine Lücke, keine Entscheidung, und verhindert den Gesamtpreis, solange sie offen bleibt.
- Tiefgarage im Untergeschoss enthalten.
- Tiefgarage · Lüftung, OS-Beschichtung, Tore
- Untergeschoss · Rohbau und Ausbau
- Verschiebt die Termine unten; die Bauzeit selbst bleibt gleich.
- ≈ 2.447 €/m² WFL nach WoFlV

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
