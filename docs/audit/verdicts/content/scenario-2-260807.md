# Синтетический сценарий 2 · `DEMO-0002` · 2026-08-07

Поставка разворачивает существующую заглушку `DEMO-0002` в независимый
рабочий сценарий. Все значения синтетические. Таблицы используют явные
колонки и стабильные идентификаторы; строки контрольной таблицы являются
ожиданиями будущих юнит-тестов.

## Scenario identity

| scenarioId | projectId | variantId | variantVersionId | calculationRunId | runPurpose | calculatedAt | timezone | rulesetVersion | benchmarkSnapshot | engineVersion | regionalFactor | kg700Mode |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `DEMO2-SC-01` | `DEMO-0002` | `DEMO2-VAR-BASIS` | `DEMO2-VV-0001` | `DEMO2-RUN-0004` | `authoritative` | `2026-08-10T09:30:00+02:00` | `Europe/Berlin` | `RS-2026.2` | `BM-BKI-2026Q2-SYNTH` | `ENG-0.5.0` | `inactive` | `vereinfacht` |

## Opportunity

| id | name | country | city | owner | stage | meetingAt | buildings | documents | worked |
|---|---|---|---|---|---|---|---:|---:|---|
| `DEMO-0002` | Musterquartier Südhang | Deutschland | Beispielheim | B. Beispiel | in Vorbereitung | `2026-08-18T10:00:00+02:00` | 3 | 5 | `true` |

## Buildings

| buildingId | stableName | included | gebaeudeform | gebaeudeklasse | classState | energiestandard | bgfRAbove | bgfSAbove | bgfRBelow | bgfSBelow | untergeschoss | hasParking | wflWoFlV | nufDin277 | nrfDin277 | units | fullStoreys |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|
| `DEMO2-B-A` | Haus A | `true` | `MFH` | `GK_4` | `confirmed` | `EH_55` | 1.600,00 m² | 100,00 m² | 300,00 m² | 0,00 m² | `vollausbau` | `false` | 1.220,00 m² | 1.340,00 m² | 1.490,00 m² | 14 | 4 |
| `DEMO2-B-B` | Haus B | `true` | `MFH` | `GK_5` | `confirmed` | `EH_40` | 3.200,00 m² | 100,00 m² | 0,00 m² | 0,00 m² | `kein_ug` | `false` | 2.500,00 m² | 2.750,00 m² | 3.050,00 m² | 30 | 6 |
| `DEMO2-B-C` | Büro C | `true` | `BUERO` | `GK_4` | `confirmed` | `GEG` | 1.200,00 m² | 100,00 m² | 200,00 m² | 0,00 m² | `ab_decke` | `true` | 0,00 m² | 940,00 m² | 1.100,00 m² | 0 | 4 |

## Usage segments

| segmentId | buildingId | nutzungsart | usageFactor | belegungsprofil | benchmarkprofil | denominatorType | denominator | costAllocation | clientLeadRate |
|---|---|---|---:|---|---|---|---:|---|---|
| `DEMO2-S-A1` | `DEMO2-B-A` | `Wohnen` | 1,00 | `Standard` | `BKI_MFH_SYNTH` | `WFL_WOFLV` | 1.220,00 m² | `buildingTotal` | `enabled` |
| `DEMO2-S-B1` | `DEMO2-B-B` | `Wohnen` | 1,00 | `Standard` | `BKI_MFH_SYNTH` | `WFL_WOFLV` | 2.500,00 m² | `buildingTotal` | `enabled` |
| `DEMO2-S-C1` | `DEMO2-B-C` | `Büro` | 1,05 | `null` | `BKI_BUERO_VERWALTUNG_SYNTH` | `NUF_DIN277` | 940,00 m² | `buildingTotal` | `enabled` |

В клиентском профиле комплекса единая смешанная Leitkennzahl отсутствует:
`WFL nach WoFlV` и `NUF nach DIN 277` остаются раздельными знаменателями.

## Documents

| documentId | fileName | pages | lifecycleStatus | parseStatus | versionFamilyId | versionOrdinal | versions | soilEvidence | classEvidence |
|---|---|---:|---|---|---|---:|---:|---|---|
| `DEMO2-DOC-2001` | `Quartier_Bauantrag_V2_Muster.pdf` | 54 | `active` | `ready` | `DEMO2-DOC-FAM-01` | 2 | 2 | `false` | `false` |
| `DEMO2-DOC-2002` | `Quartier_Bauantrag_V1_Muster.pdf` | 51 | `superseded` | `ready` | `DEMO2-DOC-FAM-01` | 1 | 2 | `false` | `false` |
| `DEMO2-DOC-2003` | `Grundrisse_Dreihaeuser_Muster.pdf` | 36 | `active` | `ready` | `DEMO2-DOC-FAM-02` | 1 | 1 | `false` | `false` |
| `DEMO2-DOC-2004` | `Baugrundgutachten_Musterquartier.pdf` | 42 | `active` | `ready` | `DEMO2-DOC-FAM-03` | 1 | 1 | `true` | `false` |
| `DEMO2-DOC-2005` | `Brandschutzkonzept_Musterquartier.pdf` | 28 | `active` | `ready` | `DEMO2-DOC-FAM-04` | 1 | 1 | `false` | `true` |

## Documentation conflicts

| collection | count | ids |
|---|---:|---|
| `valueConflicts` | 0 | `[]` |
| `versionConflicts` | 0 | `[]` |
| `openValidationIssues` | 0 | `[]` |

## Schedule

| metricId | kind | buildingId | startOffsetMonths | startDate | endDate | bgfAbove | formFactorTime | classFactorTime | exactMonths | roundedMonths | displayPolicy | prefix |
|---|---|---|---:|---|---|---:|---:|---:|---:|---:|---|---|
| `DEMO2-SCH-PLANNING` | `planning` | `null` | 0 | `2028-02-01` | `2028-05-01` | 0,00 m² | 1,00 | 1,00 | 3,000000 | 3,0 | `wholeCalendarMonthsElseDays` | `""` |
| `DEMO2-SCH-A` | `buildingExecution` | `DEMO2-B-A` | 0 | `2028-05-01` | `2028-11-01` | 1.700,00 m² | 1,00 | 1,05 | 6,230000 | 6,0 | `wholeCalendarMonthsElseDays` | `""` |
| `DEMO2-SCH-B` | `buildingExecution` | `DEMO2-B-B` | 3 | `2028-08-01` | `2029-05-16` | 3.300,00 m² | 1,00 | 1,15 | 9,276667 | 9,5 | `halfMonthRounded` | `≈` |
| `DEMO2-SCH-C` | `buildingExecution` | `DEMO2-B-C` | 6 | `2028-11-01` | `2029-05-01` | 1.300,00 m² | 1,05 | 1,05 | 5,953500 | 6,0 | `wholeCalendarMonthsElseDays` | `""` |
| `DEMO2-SCH-PROJECT` | `projectTotal` | `complex` | 0 | `2028-02-01` | `2029-05-16` | 6.300,00 m² | 1,00 | 1,00 | 15,500000 | 15,5 | `halfMonthRounded` | `≈` |

## Coverage

| costGroup | state | pricedAmountExact | completenessImpact |
|---|---|---:|---|
| `KG_100` | `notApplicable` | 0,00 € | `none` |
| `KG_200` | `excluded` | 0,00 € | `none` |
| `KG_300` | `included` | `allocation_70pct` | `none` |
| `KG_400` | `included` | `allocation_22pct` | `none` |
| `KG_500` | `unknown` | `null` | `incomplete` |
| `KG_600` | `unknown` | `null` | `incomplete` |
| `KG_700` | `included` | `allocation_8pct` | `none` |
| `KG_800` | `notApplicable` | 0,00 € | `none` |

## Risk state

| riskId | driver | active | rate | base | amountExact | evidenceDocumentId |
|---|---|---|---:|---|---:|---|
| `DEMO2-RISK-SOIL` | `Baugrundgutachten_liegt_nicht_vor` | `false` | 4,0 % | `KG_320` | 0,00 € | `DEMO2-DOC-2004` |

## Catalog inputs

| parameterId | value | unit | sourceRef | catalogStatus |
|---|---:|---|---|---|
| `K_BASE` | 1.545,00 | `EUR_PER_M2_BGF_R_ABOVE` | `calculation-spec.md#1` | `catalog` |
| `F_S` | 0,40 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_FORM_MFH` | 1,00 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_USAGE_BUERO` | 1,05 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_GK_4` | 1,00 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_GK_5` | 1,05 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_ENERGY_GEG` | 1,00 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_ENERGY_EH_55` | 1,03 | `factor` | `calculation-spec.md#1` | `catalog` |
| `F_ENERGY_EH_40` | 1,06 | `factor` | `calculation-spec.md#1` | `catalog` |
| `RATE_UG_VOLLAUSBAU` | 1.100,00 | `EUR_PER_M2_BGF_UG` | `calculation-spec.md#1` | `catalog` |
| `RATE_UG_AB_DECKE` | 350,00 | `EUR_PER_M2_BGF_UG` | `calculation-spec.md#1` | `catalog` |
| `RATE_TG` | 90,00 | `EUR_PER_M2_BGF_UG` | `calculation-spec.md#1` | `catalog` |
| `F_REGION` | 1,00 | `factor_inactive` | `calculation-spec.md#2.3` | `catalog` |
| `F_TIME_MFH` | 1,00 | `factor` | `calculation-spec.md#4` | `catalog` |
| `F_TIME_BUERO` | 1,05 | `factor` | `catalog.json#scheduleFactors` | `catalog` |
| `F_TIME_GK_4` | 1,05 | `factor` | `calculation-spec.md#4` | `catalog` |
| `F_TIME_GK_5` | 1,15 | `factor` | `calculation-spec.md#4` | `catalog` |
| `PLANNING_MONTHS` | 3,0 | `month` | `calculation-spec.md#4` | `catalog` |
| `STAGGER_MONTHS` | 3,0 | `month` | `calculation-spec.md#4` | `catalog` |

## Cost arithmetic from `K_base`

| componentId | buildingId | component | expression | exact |
|---|---|---|---|---:|
| `DEMO2-COST-A-R` | `DEMO2-B-A` | `BGF_R_ABOVE` | `1.600,00 × 1.545,00 × 1,00 × 1,00 × 1,03` | 2.546.160,00 € |
| `DEMO2-COST-A-S` | `DEMO2-B-A` | `BGF_S_ABOVE` | `100,00 × 1.545,00 × 1,00 × 1,00 × 1,03 × 0,40` | 63.654,00 € |
| `DEMO2-COST-A-UG` | `DEMO2-B-A` | `BGF_R_BELOW` | `300,00 × 1.100,00` | 330.000,00 € |
| `DEMO2-COST-A-TOTAL` | `DEMO2-B-A` | `BAUWERK` | `2.546.160,00 + 63.654,00 + 330.000,00` | 2.939.814,00 € |
| `DEMO2-COST-B-R` | `DEMO2-B-B` | `BGF_R_ABOVE` | `3.200,00 × 1.545,00 × 1,00 × 1,05 × 1,06` | 5.502.672,00 € |
| `DEMO2-COST-B-S` | `DEMO2-B-B` | `BGF_S_ABOVE` | `100,00 × 1.545,00 × 1,00 × 1,05 × 1,06 × 0,40` | 68.783,40 € |
| `DEMO2-COST-B-TOTAL` | `DEMO2-B-B` | `BAUWERK` | `5.502.672,00 + 68.783,40 + 0,00` | 5.571.455,40 € |
| `DEMO2-COST-C-R` | `DEMO2-B-C` | `BGF_R_ABOVE` | `1.200,00 × 1.545,00 × 1,05 × 1,00 × 1,00` | 1.946.700,00 € |
| `DEMO2-COST-C-S` | `DEMO2-B-C` | `BGF_S_ABOVE` | `100,00 × 1.545,00 × 1,05 × 1,00 × 1,00 × 0,40` | 64.890,00 € |
| `DEMO2-COST-C-UG` | `DEMO2-B-C` | `BGF_R_BELOW` | `200,00 × (350,00 + 90,00)` | 88.000,00 € |
| `DEMO2-COST-C-TOTAL` | `DEMO2-B-C` | `BAUWERK` | `1.946.700,00 + 64.890,00 + 88.000,00` | 2.099.590,00 € |
| `DEMO2-COST-COMPLEX` | `complex` | `BAUWERK` | `2.939.814,00 + 5.571.455,40 + 2.099.590,00` | 10.610.859,40 € |

`F_region=1,00`, `Risikozuschlag=0,00 €`, `Rabatt=0,0 %`; поэтому
`Bauwerk` каждого здания равен его промежуточному итогу. `KG 700` в режиме
`vereinfacht` распределяет итог `70/22/8` и не увеличивает его.

## Control values

| controlId | calculationRunId | scope | metric | numeratorOrExpression | denominator | denominatorType | storedExact | display |
|---|---|---|---|---|---:|---|---:|---|
| `DEMO2-CTRL-01` | `DEMO2-RUN-0001` | `DEMO2-B-A` | `subtotal` | `DEMO2-COST-A-TOTAL` | `null` | `null` | 2.939.814,00 € | ≈ 2.940.000 € |
| `DEMO2-CTRL-02` | `DEMO2-RUN-0002` | `DEMO2-B-B` | `subtotal` | `DEMO2-COST-B-TOTAL` | `null` | `null` | 5.571.455,40 € | ≈ 5.571.000 € |
| `DEMO2-CTRL-03` | `DEMO2-RUN-0003` | `DEMO2-B-C` | `subtotal` | `DEMO2-COST-C-TOTAL` | `null` | `null` | 2.099.590,00 € | ≈ 2.100.000 € |
| `DEMO2-CTRL-04` | `DEMO2-RUN-0004` | `complex` | `subtotal` | `DEMO2-CTRL-01 + DEMO2-CTRL-02 + DEMO2-CTRL-03` | `null` | `null` | 10.610.859,40 € | ≈ 10.611.000 € |
| `DEMO2-CTRL-05` | `DEMO2-RUN-0001` | `DEMO2-S-A1` | `leadRate` | 2.939.814,00 € | 1.220,00 m² | `WFL_WOFLV` | 2.409,683606557377 €/m² | ≈ 2.410 €/m² WFL nach WoFlV |
| `DEMO2-CTRL-06` | `DEMO2-RUN-0002` | `DEMO2-S-B1` | `leadRate` | 5.571.455,40 € | 2.500,00 m² | `WFL_WOFLV` | 2.228,582160000000 €/m² | ≈ 2.229 €/m² WFL nach WoFlV |
| `DEMO2-CTRL-07` | `DEMO2-RUN-0003` | `DEMO2-S-C1` | `leadRate` | 2.099.590,00 € | 940,00 m² | `NUF_DIN277` | 2.233,606382978723 €/m² | ≈ 2.234 €/m² NUF nach DIN 277 |
| `DEMO2-CTRL-08` | `DEMO2-RUN-0004` | `complex:Wohnen` | `aggregatedSegmentRate` | `2.939.814,00 + 5.571.455,40` € | `1.220,00 + 2.500,00` m² | `WFL_WOFLV` | 2.287,975645161290 €/m² | ≈ 2.288 €/m² WFL nach WoFlV |
| `DEMO2-CTRL-09` | `DEMO2-RUN-0004` | `complex` | `aboveGroundRate` | 10.610.859,40 € | `1.700,00 + 3.300,00 + 1.300,00` m² | `BGF_ABOVE_GROUND` | 1.684,263396825397 €/m² | ≈ 1.684 €/m² BGF oberirdisch |
| `DEMO2-CTRL-10` | `DEMO2-RUN-0004` | `complex` | `projectDuration` | `max(3,0 + 0,0 + 6,0; 3,0 + 3,0 + 9,5; 3,0 + 6,0 + 6,0)` | `null` | `CALENDAR_MONTH` | 15,5 Monate | ≈ 15,5 Monate · 16.05.2029 |

## Completeness control

| pricingScope | unknownGroups | unknownCount | completeness | totalLabel |
|---|---|---:|---|---|
| `Grundleistung_All3` | `KG_500,KG_600` | 2 | `incomplete` | Zwischensumme der kalkulierten Positionen |
