# Каталог параметров: разбор и классификация для индикативного оффера

Версия 0.1 · черновик, требует вычитки PO
Источник: `All3_Parameter-Rahmenwerk_klassifiziert.csv` — 277 уникальных параметров в 11 кластерах
Дата: 2026-08-03

---

## 1. Зачем эта классификация

277 параметров нельзя показать sales-менеджеру. Даже 100 нельзя. Задача — разделить каталог на четыре уровня по одному критерию: **что происходит, если параметр не заполнен.**

| Уровень | Критерий | Объём | Где живёт в продукте |
|---|---|---|---|
| **T0 — Kern** | Драйвер всего расчёта. Не найден → подстановка + Annahme + вопрос клиенту | **16** | Режим подготовки + главы 1–3 презентации |
| **T1 — Konfigurator** | Настоящий выбор клиента или sales, двигает цену или срок, есть умолчание | **52** | Главы 2–9 конфигуратора |
| **T2 — Dokumente** | Не выбирается на встрече: тексты документов, производные и константы | **~100** | Только режим подготовки, свёрнуто |
| **T3 — Ausserhalb** | Относится к стадиям после контракта (Bemusterung, LP5+) | **~128** | Из продукта исключить, из каталога не удалять |

Принцип: **T0 спрашиваем, T1 показываем, T2 подставляем по умолчанию, T3 не трогаем.**

---

## 2. Дефекты каталога, которые надо починить

Найдено при разборе. Каждый из них при переносе «как есть» станет багом в проде.

### 2.1 Дубликаты между C10 и C7/C8/C9 — около 30 пар

Весь кластер C10 «Bemusterung» дублирует уже описанные в C7–C9 параметры:

| C10 (Bemusterung) | Дубль в | Комментарий |
|---|---|---|
| C10.14 Bemusterung Fenster | C7.01 Fensterrahmenmaterial | одно и то же решение |
| C10.15 Bemusterung Sonnenschutz | C7.12 Sonnenschutz-Typ | одно и то же |
| C10.17 Bemusterung Hauseingangstür | C7.18 / C7.19 | одно и то же |
| C10.27 Bemusterung Wohnungseingangstür | C7.21 / C8.21 | **тройной** дубль |
| C10.28 Bemusterung Innentüren | C7.23 / C8.20 | **тройной** дубль |
| C10.31 Bemusterung Bodenbelag Wohnräume | C8.10 | одно и то же |
| C10.33 Bemusterung Balkon-/Terrassenbelag | C7.15 | одно и то же |
| C10.34 Bemusterung Wandfliesen Bad | C8.05 / C8.06 | тройной дубль |
| C10.37 Bemusterung Sanitärarmaturen | C9.17 | одно и то же |
| C10.41 Bemusterung Duschabtrennung | C9.14 | одно и то же |
| C10.45 Bemusterung Einbauküche | C8.16 | одно и то же |

**Причина:** C10 описывает не другой параметр, а **другую фазу того же решения**. На стадии индикативного оффера мы фиксируем принцип («Bodenbelag: Parkett»), на стадии Bemusterung — конкретный артикул.

**Решение:** не заводить два параметра. Завести один параметр с двумя уровнями зрелости: `entscheidung` (индикативный оффер) и `produkt` (Bemusterung после контракта). Второй в нашем продукте не используется вообще.

### 2.2 Дубликат BGF с противоречивыми флагами

- `C1.01` — «Brutto-Grundfläche BGF (DIN 277)», стандарт: *oberirdisches Gebäude*, флаг **obligatory**
- `C1.15` — «Brutto-Grundfläche BGF (DIN 277)», стандарт: *unterirdisch Gebäude*, флаг **optional**

Одинаковые названия при разном смысле. В интерфейсе это гарантированно перепутают. **Переименовать** в `BGF oberirdisch` / `BGF unterirdisch`.

### 2.3 Параметр без имени

`C1.14` — тип «Zahl», флаг **obligatory**, поле `parameter_de` пустое. Обязательный параметр без названия. Нужно восстановить или удалить.

### 2.4 Каталог не знает, что зданий может быть несколько

Все параметры кластера C1 описывают **одно здание**. В каталоге нет сущности «проект содержит N зданий», нет `Anzahl Gebäude`, нет способа задать разную BGF, GK и тип для Haus A / Haus B / Haus C.

При этом:
- Бизнес-требование: один оффер может покрывать несколько зданий с консолидированным тоталом.
- Bauzeit-калькулятор уже считает по зданиям со сдвигом стартов (`STAGGER_MONTHS`).

**Это самый серьёзный структурный пробел.** В `Timeline Estimation` лежит файл `All3_Parameter-Rahmenwerk_klassifiziert_entity-level...csv` — судя по названию, работа над уровнями сущностей уже начиналась. Нужно довести: каждый параметр должен иметь явный **уровень применения**.

| Уровень | Пример параметров |
|---|---|
| `projekt` | Bundesland, Grundstück, Baubeginn, Vergütungsmodell, Außenanlagen |
| `gebaeude` | BGF, WFL, GK, `Gebäudeform`, Geschosse, Dachform, Fassade |
| `einheit` | Wohnungsmix, Nasszellen je WE *(на индикативной стадии почти не нужен)* |

### 2.5 Отсутствуют параметры, которых требует движок расчёта

Движок из `Sales/Wizard/wizard_brd_v3_unified.md` и бизнес-требования используют величины, которых в каталоге нет:

| Отсутствует | Кто требует | Комментарий |
|---|---|---|
| **BGF R / BGF S** (разделение по DIN 277:2021) | Движок расчёта, `bgf_breakdown_mode` | В каталоге только суммарная BGF |
| **Balkon-Anrechnungsfaktor (25 % / 50 %)** | Бизнес-требование PO | Влияет на WFL, а значит на `€/m² WFL nach WoFlV` — ключевой показатель оффера |
| **Anzahl Gebäude** | Bauzeit-калькулятор, консолидация | См. 2.4 |
| **UG-Leistungsumfang** | Критерий сравнения вариантов | Определение ниже |
| **Regionalfaktor / Landkreis** | Движок (regional factor точнее, чем Bundesland) | В каталоге только C0.05 Bundesland |

**Определение нового параметра `UG-Leistungsumfang`** (уточнено PO):

| Опция | Что входит | KG |
|---|---|---|
| `vollausbau` — Vollständiger UG-Bau inkl. Gründung | All3 строит весь подземный этаж вместе с фундаментом | KG 320 (Gründung), 330/340 (Wände UG), 350 (Decke über UG), плюс Ausbau |
| `ab_decke_ug` — Leistungsbeginn ab OK Decke über UG, im UG nur Ausbau | Конструктив подземного этажа и фундамент — со стороны AG. All3 начинает с плиты перекрытия между UG и EG. В самом UG выполняет только финишную отделку | KG 350 и выше; в UG только Ausbau-позиции |
| `kein_ug` — Kein Untergeschoss | Подземной части нет | глава UG скрыта целиком |

Это **не** параметр качества, а параметр **границы ответственности**. Поэтому он одновременно меняет цену, состав Leistungen и строки разделительной ведомости — то есть относится к самой опасной группе AG/AN-переключателей.

### 2.6 Списки опций — в порядке ✅

*Проверено 2026-08-03.* В CSV **919 строк опций для 229 параметров** — списки заполнены, а не пусты. Каждый параметр занимает несколько строк, по одной на вариант.

Выгрузка по T0 + T1 → `parameters-t0-t1.json` *(пересобрана после аудита 2026-08-03 под финальный состав)*:

| | |
|---|---|
| Параметров выгружено | **68** (T0 16 + T1 52, включая 7 синтетических `NEU.*`) |
| Всего вариантов опций | **261** — C0.14 дополнен типами Hotels / Büro / Gewerbe (D-11), отсутствовавшими в мастер-CSV |
| Параметров типа Auswahl **без** опций | **0** |

Синтетические (`NEU.*`) — параметры, отсутствующие в каталоге, но определённые в продуктовых документах: Anzahl Gebäude, BGF R/S, UG-Leistungsumfang, Balkon-Anrechnungsfaktor, Angebotsgültigkeit, Preisstand, Finanzierungszinssatz. **Пробелов нет, задача снята с критического пути.**

---

## 3. T0 — Kernparameter (16)

> **Источник истины по составу T0, правилам подстановки и текстам Annahmen — `t0-fallback-rules.md`.** Здесь только состав. *(Синхронизировано при аудите 2026-08-03: добавлены `Anzahl Gebäude` и `UG-Leistungsumfang`, ранее список насчитывал 14.)*

Отсутствие T0-параметра не блокирует расчёт (кроме BGF — см. правило 4 в fallback-документе): система подставляет значение, пишет допущение в блок `Annahmen` и ставит вопрос в список для клиента.

| # | ID | Параметр | Уровень |
|---|---|---|---|
| 1 | *(новый)* | Anzahl Gebäude | projekt |
| 2 | C0.14 | `Gebäudeform` (Building) + `Nutzungsart` / `Belegungs-/Barrierefreiheitsprofil` / `Benchmarkprofil` (Usage Segment) — D-11 v2 | gebäude + segment |
| 3 | C0.13 | Gebäudeklasse (GK) | gebäude |
| 4 | C1.01 | BGF oberirdisch *(переименовать)* | gebäude |
| 5 | *(новый)* | BGF R / BGF S (DIN 277:2021) | gebäude |
| 6 | C1.15 | BGF unterirdisch *(переименовать)* | gebäude |
| 7 | C1.21 | Anzahl Vollgeschosse | gebäude |
| 8 | C1.16 | Anzahl Wohneinheiten | gebäude |
| 9 | C1.13 | Reine Wohnnutzung | gebäude |
| 10 | C1.09 | Wohnfläche WFL | gebäude |
| 11 | C1.04 | Nutzungsfläche NUF | gebäude |
| 12 | C4.06 | Energiestandard *(включает QNG как опцию EH 40-NH)* | gebäude |
| 13 | C3.06 | DIN-276-Kostengruppen-Zuordnung | projekt |
| 14 | *(новый)* | UG-Leistungsumfang | projekt |
| 15 | C0.05 | Bundesland | projekt |
| 16 | C2.10 | Geplanter Baubeginn | projekt |

Пример механики (полные правила — в fallback-документе): `WFL` не найдена → `WFL = жилая надземная BGF × 0,75` → в оффер блок Annahmen с готовым текстом → доверительный интервал расширяется на Δ ±5 %.

---

## 4. T1 — Konfigurator (52)

Параметры, которые двигают цену или срок, имеют All3-умолчание и которые sales переключает при клиенте. Главы совпадают с главами конфигуратора в `screen-map.md` (аудит 2026-08-03 устранил расхождение нумерации: глава 8 — Leistungsabgrenzung, а не «Brandschutz»; параметры качества среды перенесены в главу 4).

**Критерий пребывания в T1 ужесточён:** параметр остаётся, только если это *выбор клиента или sales*. Инженерные следствия других выборов (класс огнестойкости из GK, остекление из энергостандарта) из T1 удалены — они вычисляются и показываются, но не выбираются. Список изъятых — в конце раздела.

### Глава 2 — Umfang (самый сильный рычаг цены)

| ID | Параметр | Влияние |
|---|---|---|
| C3.06 | DIN-276-KG-Zuordnung *(T0)* | Цена, состав оффера |
| C3.02 | All3-Festleistungen | Цена, Leistungen |
| C3.03 | Optionspakete | Цена, отдельные позиции |
| C10.01 | Leistungsstatus Außenanlagen | Цена (KG 500), SSL |
| C1.28 | Tiefgaragen-Stellplätze | Цена подземной части |
| **C0.20** | **Bestandsgebäude / Abbruch erforderlich** ⬆ *повышен из T2* | **Цена (KG 200), SSL** |

> ⬆ **C0.20 повышен по итогам аудита.** Демо-проект Referenzprojekt R-01 имеет «Abbruch im Leistungsumfang All3» — снос существующего здания входит в объём и материально двигает цену. Параметр, который в реальном проекте демо-набора определяет заметную статью затрат, не может лежать в T2. Он же — условие включения KG 200. Дубль `C5.05 Bestandssituation` схлопнут в C0.20 (см. список изъятых).

### Глава 3 — Gebäude & Flächen
C1.20 Staffelgeschoss · C1.23 Lichte Raumhöhe · C1.26 Anzahl Treppenhäuser · C1.27 Anzahl Aufzüge · C1.29 Oberirdische Stellplätze · **Balkon-Anrechnungsfaktor** *(новый: WoFlV §4 = 25 %, Kundenwunsch = 50 %)*

### Глава 4 — Energie, Nachhaltigkeit & Qualität
C4.06 Energiestandard *(T0)* · C4.12 Nachhaltigkeitszertifizierung · C4.13 DGNB-/QNG-Zielniveau · C4.14 KfW-/BEG-Förderung · **C4.04 Schallschutzniveau** · **C4.09 Barrierefreiheit** · **C4.10 Anteil barrierefreier WE** *(последние три перенесены из бывшей главы «Brandschutz & Schallschutz» — это клиентские выборы качества, а не инженерные следствия)*

### Глава 5 — Konstruktion & Fassade *(питает рендеры)*
**C6.04 Fassadenoberfläche** ← рендер · **C6.10 Dachform** ← рендер · C6.12 Deckschicht Flachdach · C6.16 Dachbegrünung · C6.17 Retention · **C7.14 Balkonstruktion** ← рендер · C7.16 Absturzsicherung Balkone · C7.01 Fensterrahmenmaterial · C7.12 Sonnenschutz-Typ

### Глава 6 — Ausbau & Technik
C8.10 Bodenbelag Wohnräume · C8.16 Einbauküche · C8.18 Ausstattungswert Elektro · C8.19 Ausstattungslinie · C9.01 Wärmeerzeuger · C9.18 Wohnungslüftung · C9.22 E-Mobilitäts-Infrastruktur · C9.32 Photovoltaikanlage · C9.34 PV-Leistung · C9.35 Batteriespeicher

### Глава 7 — Baugrund & Erschließung
C5.01 Topografie · C5.02 Baugrund · C5.03 Grundwasser · C5.07 Gründungsart · **C0.22 Baustellenzufahrt & Krananlieferung** ⬆ *повышен из T2* — для модульного домостроения узкий подъезд и невозможность кранования это прямой драйвер Risikozuschlag; вопрос из раздела 5 закрыт решением «повысить»

### Глава 8 — Leistungsabgrenzung (AG/AN)
C3.04 Ausschlüsse / AG-Leistungen · C3.05 Schnittstellen-Verantwortlichkeit · C5.06 Baugrubenverbau (AG/AN) · C5.13 Hausanschlüsse · C5.14 Hausanschluss-Leistungsstatus · C3.07 Angebotsgliederung

### Глава 9 — Termine & Kommerzielles
C2.15 Terminanforderung · C3.08 Vergütungsmodell · **Angebotsgültigkeit** *(новый: срок действия оферты, умолчание 3 месяца — стандарт индикативного предложения, без него юридический шаблон неполон)* · **Preisstand** *(новый: дата ценовой базы, автозаполнение датой оффера — офферы с длинным циклом сделки должны нести отметку, к какому моменту привязаны ставки)* · **Finanzierungszinssatz** *(новый, условный: показывается только при включённой KG 800)* · **Regionalfaktor-Schalter** *(новый, D-15: по умолчанию aus, включение — явное решение с дельта-чипом)* · Marge / Risikozuschlag / Rabatt *(живут в настройках и главе 9, см. D-01, D-02)*

### Изъято из T1 при аудите — 15 параметров ⬇ в T2

| Параметр | Причина изъятия |
|---|---|
| C6.01 Konstruktionssystem Tragwerk | Это и есть продукт All3 (Holzrahmen/Hybrid) — не выбор, а константа. Показывается как факт, не редактируется |
| C6.02 Außenwandsystem · C6.09 Geschossdecken | Внутренние инженерные решения, клиент их не выбирает |
| C5.08 Bodenplattentyp | Следствие C5.03/C5.07, не самостоятельный выбор |
| C5.05 Bestandssituation | Дубль C0.20 — схлопнут (ещё одна пара к списку 2.1) |
| C2.16 Vorfertigungsgrad | Высокий префаб — константа бизнес-модели All3 |
| C4.02 Feuerwiderstandsklasse · C4.03 Kapselung | Выводятся из GK автоматически (GK4/GK5 → K260). Показывать — да, выбирать — нет |
| C4.07 65 %-EE-Pflicht | Законодательное требование, следствие выбора Wärmeerzeuger |
| C4.08 Sommerlicher Wärmeschutz | Nachweis, следствие выбора Sonnenschutz |
| C7.02 Verglasung | Следствие Energiestandard (3-fach при EH 55+) |
| C8.01 Innenputz Q-Stufe | Стандарт Q2, ценовое влияние мизерное |
| C9.04 Wärmeabgabe · C9.07 Warmwasserbereitung | Следствия выбора C9.01 Wärmeerzeuger |
| C9.30 Aufzugsantrieb | Драйвер цены — количество лифтов (C1.27), тип привода — деталь |

Эффект: T1 сокращён с ~60 до **52** (48 из каталога + 4 новых: Balkon-Anrechnungsfaktor, Angebotsgültigkeit, Preisstand, Finanzierungszinssatz), и каждый оставшийся параметр — настоящий выбор. Меньше экранного шума в конфигураторе, меньше поводов для sales запутаться при клиенте.

---

## 5. T2 — Dokumente (~85)

Не влияют на цену, влияют на тексты артефактов. **В презентации не показываются.** Заполняются All3-умолчанием, доступны в режиме подготовки в свёрнутом виде.

Типичные представители:

- **Договорные (C3):** C3.09 Zahlungsbedingungen · C3.10 Gewährleistung · C3.11 Abnahmeform · C3.12 QS-Meilensteine · C3.13 Leistungsgrenze TGA
- **Детали окон и дверей (C7):** C7.05–C7.11 Farben, Fensterbänke, Rollladenkasten · C7.17 Geländerhöhe · C7.20–C7.31 Türen, Zargen, Handläufe, Beschläge
- **Детали отделки (C8):** C8.02–C8.09 Putz, Fliesen, Abdichtung · C8.11–C8.15 Bodenbeläge Nebenräume · C8.17 Dunstabzug
- **Детали TGA (C9):** C9.02–C9.03 Wärmeverteilung, Zähler · C9.05–C9.06 Regelung, Rohrmaterial · C9.08–C9.17 Sanitärobjekte · C9.19–C9.20 Sonderlüftung · C9.23–C9.29 Zähler, TK, Sprechanlage, Zutritt · C9.31 Sicherheitsbeleuchtung · C9.36 Blitzschutz
- **Нормативные (C5):** C5.09–C5.12 Drainage, Entwässerung · C5.15 Telekommunikation · C5.16 Gutachten · C5.17–C5.19 Wind-/Schnee-/Erdbebenzone · C5.20 Restriktionen · C5.05 *(схлопнут в C0.20)* · C5.08 Bodenplattentyp
- **Локация и право (C0):** C0.06–C0.12 Grundstück, GRZ, GFZ, BauNVO · C0.16–C0.19, C0.21 Status, Denkmalschutz, Schallschutz-Umfeld *(C0.20 и C0.22 повышены в T1 при аудите)*
- **Производные и константы (из T1 при аудите):** C6.01, C6.02, C6.09, C2.16 — константы бизнес-модели All3 · C4.02, C4.03, C4.07, C4.08, C7.02, C9.04, C9.07 — вычисляются из GK / Energiestandard / Wärmeerzeuger, в подготовке показываются как «abgeleitet» · C8.01, C9.30 — стандарт с мизерным ценовым влиянием

---

## 6. T3 — Ausserhalb (~128)

Из продукта исключить. Из каталога не удалять — понадобятся на стадии реализации проекта.

- **Весь кластер C10 кроме C10.01** — 44 параметра Bemusterung. Это фаза после контракта, конкретные артикулы и продукты. На индикативной стадии обсуждение уровня «Betätigungsplatte Kunststoff weiß» невозможно и вредно.
- **LOIN и BIM (C2):** C2.05–C2.09 LOIN-Stufen · C2.17–C2.18 BIM-Leistungsumfang · C3.14 BIM-Leistungstiefe
- **Детальные геометрии (C1):** C1.02 BGF Regelgeschoss · C1.03 NRF · C1.05–C1.08 TF, VF, KGF, BRI · C1.17–C1.19 Wohnungsmix, Spanne, Barrierefreiheit · C1.22 Geschossigkeit-Freitext · C1.24–C1.25 Raumhöhe Bad, Außenabmessungen · C1.30–C1.33 Fahrrad, Nasszellen, Stellplatzschlüssel
- **Прочее:** C2.19–C2.21 Brandschutzkonzept-Status, Modulkonzept, Witterungsschutz · C4.15–C4.17 weitere Förderprogramme, EU-Taxonomie, Wärmebrückennachweis · C6.03, C6.05–C6.08, C6.11, C6.13–C6.15, C6.18–C6.19 конструктивные детали

**Аргумент против включения C10 в продукт:** каждый параметр Bemusterung, показанный на встрече, создаёт у клиента ожидание, что решение зафиксировано. Через полгода на реальной Bemusterung это станет предметом спора. Индикативный оффер должен фиксировать **уровень качества**, а не артикул.

---

## 7. Что делать дальше

| # | Действие | Кто | Статус / Блокирует |
|---|---|---|---|
| 1 | ~~Подтвердить состав T0~~ | — | ✅ Закрыто аудитом: 16 параметров, источник истины — `t0-fallback-rules.md` |
| 2 | ~~Прописать fallback-правила и тексты Annahmen~~ | — | ✅ Закрыто: `t0-fallback-rules.md`. Осталась калибровка 5 коэффициентов на архиве (инженеры) |
| 3 | Уровень применения (`projekt` / `gebäude`) | частично — | ✅ для продуктового подмножества: поле `ebene` в `parameters-t0-t1.json` (43 gebäude / 25 projekt). Открыто только для остальных ~200 параметров мастер-каталога (PO, не блокирует) |
| 4 | ~~Определить недостающие параметры~~ | — | ✅ Закрыто: BGF R/S, Balkon-Faktor, Anzahl Gebäude, UG-Leistungsumfang, Angebotsgültigkeit, Preisstand, Finanzierungszinssatz определены; Landkreis — T1-уточнение регионального фактора |
| 5 | Схлопнуть ~31 дубликат (C10 ↔ C7/C8/C9, C5.05 ↔ C0.20) | PO | Чистоту модели данных |
| 6 | ~~Собрать списки опций для T0 + T1~~ | — | ✅ Закрыто: опции уже в каталоге, выгружены в `parameters-t0-t1.json` |
| 7 | ~~Решить судьбу C0.22 (Baustellenzufahrt)~~ | — | ✅ Закрыто аудитом: повышен в T1 как драйвер Risikozuschlag |

Критический путь прототипа чист. Осталось на стороне инженеров: калибровка коэффициентов (п. 2) и ставки Risikozuschlag-драйверов.
