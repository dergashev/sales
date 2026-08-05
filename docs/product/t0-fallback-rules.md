# T0 — ядро параметров, правила подстановки и тексты допущений

Версия 0.1 · Решено автором документа по делегированию PO
Дата: 2026-08-03
Связанные документы: `parameter-triage.md`, `decisions.md`, `metrics.md`

---

## 1. Принципы, на которых построены правила

Прежде чем список — четыре правила, которые определяют, как система ведёт себя при нехватке данных. Они важнее самих коэффициентов, потому что коэффициенты вы откалибруете на архиве, а принципы менять будет поздно.

**Принцип 1. Система никогда не останавливается, но никогда и не молчит.**
Отсутствие данных не блокирует расчёт. Оно порождает три вещи одновременно: подстановку, запись в блок `Annahmen` итогового оффера и вопрос в списке для клиента. Не бывает подстановки без видимого следа — иначе через полгода никто не вспомнит, откуда взялась цифра.

**Принцип 2. Смещение в безопасную сторону — только там, где это касается объёма и риска.**
Для параметров **границы ответственности** (что входит в предложение) подставляем **All3-стандарт**, то есть то, что мы обычно действительно делаем. Занизить объём безопаснее, чем завысить: недостающее добавляется как опция и увеличивает чек, а лишнее приходится вычёркивать при клиенте, теряя лицо.
Для **статистических** величин (WFL из BGF) берём медиану, а несимметричность уносим в доверительный интервал. Систематический сдвиг медианы вверх сделает нас неконкурентными на всех проектах разом.

**Принцип 3. Допущение — это не оговорка, а рычаг продаж.**
Каждый текст в блоке `Annahmen` строится по схеме «что мы предположили → почему → **что клиент может сделать, чтобы уточнить**». Последняя часть обязательна. Она превращает список допущений в список причин для следующего контакта, а вместе с драйверами Risikozuschlag (см. `decisions.md`, D-02) — в понятную клиенту сделку: «дайте документ — уберём надбавку».

**Принцип 4. Ниже определённой точности число не показывается.**
Если накопленный доверительный интервал выходит за ±25 %, система не запрещает работу, но помечает вариант как «не готов к презентации» и объясняет, каких данных не хватает. Ваш заявленный допуск — 20–25 %. Показывать клиенту число с точностью ±40 % под видом индикативного оффера — это не быстрый оффер, это будущий конфликт.

---

## 2. Состав T0 — 16 параметров

Решение по составу принято мной. Отклонения от предыдущей версии и их причины — в разделе 4.

| # | ID | Параметр | Уровень | Тип источника |
|---|---|---|---|---|
| 1 | *(новый)* | Anzahl Gebäude | projekt | Lageplan |
| 2 | C0.14 | Klassifikation: `Gebäudeform` (Building) + `Nutzungsart` / `Belegungs-/Barrierefreiheitsprofil` / `Benchmarkprofil` (Usage Segment) | gebäude + segment | документация |
| 3 | C0.13 | Gebäudeklasse (GK) | gebäude | вывод из высоты и площадей |
| 4 | C1.01 | BGF oberirdisch | gebäude | Flächenberechnung / чертежи |
| 5 | *(новый)* | BGF R / BGF S (DIN 277:2021) | gebäude | чертежи |
| 6 | C1.15 | BGF unterirdisch | gebäude | чертежи |
| 7 | C1.21 | Anzahl Vollgeschosse | gebäude | Schnitt / Ansicht |
| 8 | C1.16 | Anzahl Wohneinheiten | gebäude | Apartment Schedule / планы |
| 9 | C1.13 | Reine Wohnnutzung | gebäude | документация |
| 10 | C1.09 | Wohnfläche WFL | gebäude | Wohnflächenberechnung |
| 11 | C1.04 | Nutzungsfläche NUF | gebäude | Flächenberechnung |
| 12 | C4.06 | Energiestandard *(включает QNG)* | gebäude | Energiekonzept / клиент |
| 13 | C3.06 | DIN-276-Kostengruppen-Zuordnung | projekt | решение sales |
| 14 | *(новый)* | UG-Leistungsumfang | projekt | решение sales |
| 15 | C0.05 | Bundesland | projekt | адрес / PLZ |
| 16 | C2.10 | Geplanter Baubeginn | projekt | клиент |

**Отдельное решение по QNG.** Не выделяю в самостоятельный параметр. В списке опций `C4.06 Energiestandard` уже есть вариант **«Effizienzhaus 40 mit Nachhaltigkeitsklasse / QNG (EH 40-NH)»** — этого достаточно для ценообразования. Отдельный булев флаг создал бы невозможные комбинации вроде «GEG-Mindeststandard + QNG». Уровень сертификации (`C4.13 DGNB-/QNG-Zielniveau`) остаётся в T1 как отдельный вопрос, влияющий на KG 700.

---

## 3. Правила подстановки и тексты допущений

Тексты `Annahmen` — на немецком, поскольку артефакты выпускаются на немецком. Формулировки соответствуют тону бренда: конкретно, уверенно, без преувеличений, с явным следующим шагом.

Колонка **Δ** — вклад в доверительный интервал при срабатывании подстановки (модель в разделе 5).

---

### 1. Anzahl Gebäude · Δ ±2 %

**Извлечение:** Lageplan, Baubeschreibung, титульные листы планов.
**Подстановка:** `1`.
**Вопрос клиенту (уточняющий):** *Umfasst das Vorhaben ein Gebäude oder mehrere Bauteile/Häuser?*

> **Annahme:** Das Angebot bezieht sich auf ein Gebäude. Sofern das Vorhaben mehrere Bauteile umfasst, wird das Angebot je Gebäude fortgeschrieben; die Bauzeit verkürzt sich dabei nicht proportional, da die Gebäude versetzt errichtet werden.

---

### 2. Klassifikation: `Gebäudeform` + Segment-Achsen · Δ ±6 %

**Единого параметра `Gebäudetyp` не существует (D-11 v2, R-13).** Классификация — четыре типизированные оси на двух уровнях, и подстановка выполняется по каждой оси отдельно: `Gebäudeform` принадлежит зданию; `Nutzungsart`, `Belegungs-/Barrierefreiheitsprofil` и `Benchmarkprofil` принадлежат сегменту использования.

**Извлечение:** Bauantrag, Baubeschreibung, Projektbezeichnung.

| Ось | Уровень | Подстановка (All3-стандарт) | Логика уточнения |
|---|---|---|---|
| `Gebäudeform` | Building | `Freistehendes Mehrfamilienhaus` | `Anzahl WE ≤ 2` → `Einfamilienhaus` / `Doppelhaus` |
| `Nutzungsart` | Usage Segment | `Wohnen` | слова `Studierende`, `Apartments`, `Wohnheim`, `Boardinghouse` → `Wohnen · Apartments`; найденные Gewerbe/Laden/Praxis/Kita → **второй сегмент** `Gewerbe` |
| `Belegungs-/Barrierefreiheitsprofil` | Usage Segment | `Standard` | `Seniorenwohnen`, `Pflege`, `barrierefrei` → соответствующий профиль |
| `Benchmarkprofil` | Usage Segment | `BKI Mehrfamilienhäuser` | следует из `Nutzungsart` и задаёт знаменатель Leitkennzahl: `€/m² WFL nach WoFlV` или `€/m² NUF nach DIN 277` |

**Вопрос клиенту (блокирующий).** Смешанное использование — это **число сегментов, а не тип**: здание с `2..n` сегментами единой Leitkennzahl не имеет, показываются сегментные ставки.

> **Annahme:** Der Kalkulation liegen die Gebäudeform «freistehendes Mehrfamilienhaus» sowie ein Nutzungssegment mit der Nutzungsart «Wohnen» und dem Belegungsprofil «Standard» zugrunde; als Benchmarkprofil ist «BKI Mehrfamilienhäuser» hinterlegt, die Leitkennzahl lautet daher €/m² WFL nach WoFlV. Gebäudeform und Nutzungsart bestimmen sowohl die Kostenkennwerte als auch die Bauzeit. Weitere Nutzungen im Gebäude werden als eigene Nutzungssegmente erfasst und mit dem jeweils zugehörigen Kennwert bepreist.

---

### 3. Gebäudeklasse (GK) · Δ ±3 %

**Извлечение:** Brandschutzkonzept, Bauantrag, Schnitt (высота верхнего пола аварийного этажа).

**Класс не выводится из числа этажей (CALC-004).** Этажность — только **триггер проверки**: она подсказывает вероятный класс и переводит параметр в состояние `Prüfung erforderlich`, но не заменяет норматив. Обязательные входы — высота верхнего пола аварийного этажа, площади нутцунгсайнхайтен и правило земли (LBO / MBO §2); пока они и набор правил не подтверждены, интерфейс показывает `Prüfung erforderlich`, а не готовый класс.

| Триггер проверки | Vermuteter Wert для расчёта | Состояние параметра |
|---|---|---|
| Vollgeschosse ≤ 4 и WFL на единицу ≤ 400 m² | `GK 4` | `Prüfung erforderlich` |
| Vollgeschosse ≥ 5 | `GK 5` | `Prüfung erforderlich` |
| Vollgeschosse ≤ 2 и ≤ 2 NE | `GK 1` / `GK 2` | `Prüfung erforderlich` |

Vermuteter Wert нужен, чтобы расчёт не останавливался: GK 5 существенно дороже за счёт требований пожарной безопасности, и молчаливая подстановка GK 4 на пятиэтажном здании занизила бы цену системно. Но `Prüfung erforderlich` — это открытый `ValidationIssue` категории `compliance`, который по R-07 блокирует все пять клиентских выдач, пока класс не подтверждён. Именно это состояние воспроизводит синтетическая фикстура (`synthetic-fixtures.md` §4).

> **Annahme:** Die Gebäudeklasse ist noch nicht bestätigt. Die Geschossanzahl ist lediglich Prüfauslöser und kein Nachweis; die Einstufung nach MBO §2 erfolgt über das Brandschutzkonzept und die zugehörigen Nachweise. Für die Kalkulation ist vorläufig GK 4 hinterlegt, Stand `Prüfung erforderlich`. Die endgültige Einstufung kann die Anforderungen an Tragwerk und Kapselung und damit den Preis verändern; mit Vorlage des Brandschutzkonzepts bestätigen wir sie.

---

### 4. BGF oberirdisch · Δ ±8 % — самый дорогой пробел

**Извлечение:** Flächenberechnung nach DIN 277, Bauantragsformulare, при их отсутствии — обмер по планам этажей.
**Подстановка (по убыванию надёжности):**
1. Сумма площадей этажей из планов.
2. `BGF = BRI / mittlere Geschosshöhe` (при наличии BRI из Bauantrag; средняя высота этажа 3,0 м).
3. `BGF = Grundfläche EG × Anzahl Vollgeschosse`.
4. `BGF = WFL / 0,75` — обратный ход, если известна только WFL.

**Если ни один путь не сработал — автоматической подстановки нет.** Это единственный параметр из шестнадцати без fallback-значения: без опорной площади индикативный оффер не является офертой, это гадание.

**Но это не тупик.** Система не блокирует работу, а переводит её в явный ручной путь: экран показывает «Berechnung wartet auf BGF» с полем ввода и подсказкой, из чего площадь можно оценить (планы этажей, BRI, площадь основания × этажность). Sales вводит значение — сам в подготовке или со слов клиента на встрече (D-08) — и расчёт запускается с чипом `manuell erfasst` либо `vom Kunden bestätigt` и соответствующей Δ (см. раздел 5.1). Мёртвой точки, из которой нет действия, в системе не существует: любое отсутствие данных всегда имеет ровно один следующий шаг — ввести или спросить.

> **Annahme:** Die Brutto-Grundfläche wurde aus den vorliegenden Plänen ermittelt, da keine Flächenberechnung nach DIN 277 vorlag. Mit Vorlage der geprüften Flächenberechnung präzisieren wir den Angebotspreis.

---

### 5. BGF R / BGF S (DIN 277:2021) · Δ ±3 %

**Контекст.** R — перекрытые и со всех сторон замкнутые площади; S — перекрытые, но не замкнутые (балконы, лоджии, галереи, навесы). Они имеют разную стоимость квадратного метра, и разделение прямо влияет на итог.
**Извлечение:** планы этажей, Flächenberechnung.
**Подстановка:** при наличии балконов `BGF S = BGF gesamt × 0,08`, иначе `BGF S = 0`.

> ⚠️ Коэффициент 0,08 — рабочее допущение, **подлежит калибровке на архиве All3**. У вас есть завершённые проекты с посчитанной BGF R+S — это первое, на чём нужно проверить значение. До калибровки помечать как provisional.

> **Annahme:** Der Anteil der Flächen nach DIN 277:2021 Bereich S (überdeckt, nicht allseitig umschlossen — Balkone, Loggien) wurde mit 8 % der Brutto-Grundfläche angesetzt. Eine plangenaue Aufteilung erfolgt mit Vorlage der Flächenberechnung.

---

### 6. BGF unterirdisch · Δ ±4 %

**Извлечение:** план подземного этажа, Schnitt, Baubeschreibung.
**Подстановка:** `0`, если в документации нет подземного этажа. Если UG упомянут, но не обмерен — `BGF UG = Grundfläche EG × 1,0`.
**Вопрос клиенту (блокирующий, если UG упомянут, но не обмерен).**

> **Annahme:** Das Vorhaben wurde ohne Untergeschoss kalkuliert. Ein Untergeschoss verändert Gründung, Abdichtung und Bauzeit erheblich und wird bei Bedarf gesondert bepreist.

---

### 7. Anzahl Vollgeschosse · Δ ±2 %

**Извлечение:** Schnitt, Ansichten, Bauantrag.
**Подстановка:** `BGF oberirdisch / Grundfläche EG`, округление вниз. Если площадь основания неизвестна — `4` (типичное для MFH в GK4).

> **Annahme:** Die Anzahl der Vollgeschosse wurde aus den vorliegenden Unterlagen abgeleitet. Sie beeinflusst Gebäudeklasse, Brandschutzanforderungen und Bauzeit.

---

### 8. Anzahl Wohneinheiten · Δ ±2 %

**Извлечение:** Apartment Schedule, Wohnungsspiegel, планы этажей.
**Подстановка:** `WE = WFL / mittlere Wohnungsgröße`, где средний размер зависит от направления использования (`C0.15`):

| Nutzungsschwerpunkt | m²/WE |
|---|---|
| Wohnen (стандарт) | 70 |
| Micro-Living / Apartments | 30 |
| Seniorenwohnen | 50 |

> ⚠️ Значения подлежат калибровке на архиве.

> **Annahme:** Die Anzahl der Wohneinheiten wurde aus der Wohnfläche abgeleitet, da kein Wohnungsspiegel vorlag. Der Wohnungsschlüssel beeinflusst die Kosten der Haustechnik und des Innenausbaus spürbar.

---

### 9. Reine Wohnnutzung · Δ ±1 %

**Извлечение:** Baubeschreibung, планы EG, Nutzungsschwerpunkt.
**Подстановка:** `ja` (All3-стандарт). Переключается в `nein` при обнаружении в планах Gewerbe, Laden, Praxis, Kita.

> **Annahme:** Es wurde von einer reinen Wohnnutzung ausgegangen. Gewerbeflächen werden gesondert erfasst und über die Nutzungsfläche NUF nach DIN 277 bepreist.

---

### 10. Wohnfläche WFL · Δ ±5 %

**Извлечение:** Wohnflächenberechnung nach WoFlV, Apartment Schedule.
**Подстановка:** `WFL = BGF oberirdisch (ohne Parkebenen und Gewerbe) × 0,75`.

> ⚠️ **Здесь нужна осторожность, и вот почему.** В проекте Referenzprojekt R-02 отношение WFL к BGF по Bauantrag составляет примерно 0,51 — потому что первый этаж занят парковкой. Слепое применение 0,75 к полной BGF дало бы завышение WFL почти в полтора раза, а значит **занижение** показателя `€/m² WFL nach WoFlV` — ключевого числа оффера. Поэтому правило применяется **только к жилой надземной BGF**, а этажи с парковкой и коммерцией вычитаются до расчёта. Коэффициент калибруется на архиве.

**Балконы:** после получения WFL применяется `Balkon-Anrechnungsfaktor`.

| | |
|---|---|
| Стандарт | **25 % — WoFlV §4** |
| Отклонение | **50 % по желанию клиента**, переключается sales в режиме презентации |

**Стандарт — это норма, а не внутреннее соглашение All3.** WoFlV §4 засчитывает балконы, лоджии, дачи и террасы, как правило, в четверть площади, и лишь при соответствующем качестве наружного пространства — до половины. Система следует норме. 50 % — не альтернативный стандарт, а **пожелание клиента**, которое sales может учесть осознанно и под запись.

**Третий случай, который надо обработать отдельно.** Клиент может предоставить собственную Wohnflächenberechnung — тогда мы принимаем её целиком, вместе с заложенным в неё коэффициентом. Именно так устроен расчёт по Referenzprojekt R-01: там взята Kundenberechnung и построчно пересчитана, а балконы в ней посчитаны по 50 %. Это не отклонение от стандарта, а работа на источнике клиента.

Отсюда требование к интерфейсу: у поля `Balkon-Anrechnung` три состояния источника, а не два.

| Состояние | Чип источника |
|---|---|
| Норма | `WoFlV §4 · 25 %` |
| Пожелание клиента | `Kundenwunsch · 50 %` |
| Расчёт клиента принят | `Kundenberechnung übernommen · 50 %` |

Третье состояние возникает не переключателем, а фактом наличия Wohnflächenberechnung клиента — и тогда WFL вообще не выводится по правилу, а берётся из документа.

> Практическое следствие для sales: 25 % даёт меньшую WFL, а значит **более высокий** показатель `€/m² WFL nach WoFlV`. Предложение выглядит дороже за метр жилой площади, чем у конкурента, считающего по 50 %. Об этом стоит предупредить sales до теста прототипа, иначе они переключат тумблер на 50 % на всех проектах, и вопрос «когда они это делают» останется без ответа.

> **Annahme:** Die Wohnfläche wurde aus der Brutto-Grundfläche abgeleitet (Faktor 0,75 auf die oberirdischen Wohngeschosse), da keine Wohnflächenberechnung nach WoFlV vorlag. Balkone und Loggien wurden mit 25 % angerechnet (Regelfall nach WoFlV §4). Mit Vorlage der Wohnflächenberechnung präzisieren wir den Preis je m² Wohnfläche.

---

### 11. Nutzungsfläche NUF · Δ ±2 %

**Применяется только при** `Reine Wohnnutzung = nein`.
**Подстановка:** `NUF Gewerbe = BGF Gewerbeflächen × 0,80`.

> **Annahme:** Die Nutzungsfläche der Gewerbeeinheiten wurde aus der Brutto-Grundfläche abgeleitet (Faktor 0,80). Der Ausbaustandard der Gewerbeflächen ist nicht Bestandteil dieses Angebots und wird gesondert abgestimmt.

---

### 12. Energiestandard · Δ ±4 %

**Извлечение:** Energiekonzept, GEG-Nachweis, KfW-Unterlagen, Energieausweis.
**Подстановка:** `Effizienzhaus 55 (EH 55)`.

**Обоснование выбора именно EH 55.** All3-стандарт указан как «EH 40 / EH 55». Подстановка EH 40 завысила бы цену и сделала предложение неконкурентным на первом же экране; подстановка GEG-Mindeststandard занизила бы её и создала разрыв при уточнении. EH 55 — середина диапазона и наиболее частый фактический выбор. Этот параметр почти всегда известен клиенту, поэтому он ставится **первым в списке блокирующих вопросов**: одна фраза в разговоре снимает ±4 %.

> **Annahme:** Der Kalkulation liegt der Effizienzhaus-Standard EH 55 zugrunde. Höhere Standards (EH 40, EH 40-NH/QNG) verändern insbesondere die Kosten der Gebäudehülle und der technischen Anlagen und eröffnen zugleich Zugang zu Förderprogrammen.

---

### 13. DIN-276-Kostengruppen-Zuordnung · Δ ±5 %

**Извлечение:** решение sales, не извлекается из документации клиента.
**Подстановка:** `KG 300 + KG 400 + KG 700` (All3-стандарт по `C3.06`).

> ✅ *Расхождение с практикой разрешено при аудите.* В расчёте по Referenzprojekt R-02 KG 700 исключена («KG 500/600/700 nicht enthalten») — тотал там равен KG 300 + 400. Стандарт каталога при этом требует KG 300+400+700. Противоречие снимает режим `KG-700-Modus = vereinfacht` (D-07): итог остаётся суммой KG 300+400 — ровно как в Referenzprojekt R-02, — но распределяется клиенту как 70/22/8 с видимой строкой Baunebenkosten. Поэтому умолчание режима — **vereinfacht**: он воспроизводит текущую расчётную практику, не меняя итога. `echt` включается, когда инженеры готовы считать KG 700 самостоятельной ставкой.

> **Annahme:** Das Angebot umfasst die Kostengruppen 300 und 400 nach DIN 276. Die Kostengruppen 100, 200, 600 und 800 sind nicht enthalten. Für die Kostengruppe 500 (Außenanlagen und Freiflächen) liegt noch keine Deckungsentscheidung vor: sie ist weder eingeschlossen noch ausgeschlossen und bislang unbewertet. Solange dieser Zustand besteht, weist das Angebot eine `Zwischensumme der kalkulierten Positionen` und keinen Gesamtpreis aus (R-18, CALC-006). Die vollständige Abgrenzung ist der Leistungsübersicht zu entnehmen.

---

### 14. UG-Leistungsumfang · Δ ±5 %

**Извлечение:** решение sales.
**Подстановка — условная, от BGF unterirdisch** *(уточнено при аудите: безусловное `ab_decke_ug` противоречило бы проектам без подземного этажа и правилу V1 из D-09)*:

| Условие | Подстановка |
|---|---|
| `BGF unterirdisch > 0` | `ab_decke_ug` — All3 строит от плиты перекрытия между UG и EG, в UG только финишная отделка |
| `BGF unterirdisch = 0` | `kein_ug` |

**Обоснование `ab_decke_ug` как умолчания при наличии UG.** Это соответствует вашему фактическому стандарту: `C1.28` помечает Tiefgaragen-Bau как «nicht All3-Festumfang (Option)», `C5.06` относит Erd- und Verbauarbeiten к AG/Dritte. Подстановка полного объёма подземного строительства завысила бы цену и приписала бы All3 работы, которые она обычно не выполняет.

> **Annahme:** Der Leistungsumfang beginnt mit der Decke über dem Untergeschoss. Gründung, Untergeschoss-Rohbau, Erd- und Verbauarbeiten liegen bauseits (AG). Im Untergeschoss sind ausschließlich Ausbauleistungen enthalten. Eine Ausführung inklusive Gründung und Untergeschoss bieten wir auf Wunsch gesondert an.

---

### 15. Bundesland · Δ ±0 % *(обновлено по D-15)*

**Извлечение:** адрес, PLZ (детерминированное сопоставление).
**Роль после D-15:** региональный фактор по умолчанию **выключен**, поэтому Bundesland на цену не влияет и Δ = 0. Параметр остаётся в T0, потому что он нужен для нормативов земли (LBO → GK, брандшутц) и для потенциального включения фактора по запросу клиента.
**Подстановка:** вывод из PLZ; если адреса нет — вопрос клиенту (уточняющий, не блокирующий).

> **Annahme** *(нужна только при явно включённом факторе и неопределённом регионе)*: Der Kalkulation liegt der bundesdurchschnittliche Kostenkennwert zugrunde, da der Standort nicht eindeutig bestimmt werden konnte.

---

### 16. Geplanter Baubeginn · Δ ±0 % (не влияет на цену)

**Извлечение:** от клиента, не из документации.
**Подстановка:** зависит от статуса разрешения (`C0.17`):

| Baugenehmigungsstatus | Подстановка |
|---|---|
| erteilt | сегодня + 3 месяца |
| beantragt | сегодня + 6 месяцев |
| не подан / неизвестно | сегодня + 9 месяцев |

> **Annahme:** Als Baubeginn wurde ein Termin sechs Monate nach Angebotsdatum angesetzt. Die Terminkette verschiebt sich mit dem tatsächlichen Baubeginn; die Bauzeit selbst bleibt davon unberührt.

---

## 4. Изменения относительно предыдущей версии списка

| Изменение | Причина |
|---|---|
| `UG-Leistungsumfang` **поднят** из T1 в T0 | PO сам назвал его среди критичных. Это переключатель границы ответственности с одним из наибольших влияний на цену — ему не место среди опций отделки |
| Добавлен `Anzahl Gebäude` | Без него не работают ни консолидация, ни сдвиг стартов в расчёте сроков |
| Отдельный флаг `QNG` **не заводится** | Уже присутствует как опция `EH 40-NH` внутри `C4.06`. Отдельный булев флаг породил бы невозможные комбинации |
| `C4.13 DGNB-/QNG-Zielniveau` оставлен в T1 | Уровень сертификации влияет на KG 700, но не блокирует базовый расчёт |
| Итог: **16 параметров** вместо 14 | |

---

## 5. Модель доверительного интервала

Простая, объяснимая, реализуемая без статистики. Именно объяснимость здесь важнее математической строгости: sales должен уметь произнести вслух, почему интервал такой.

```
Базовый интервал (все 16 параметров извлечены с источниками):  ± 10 %
Итоговый интервал = 10 % + Σ Δ по всем подставленным параметрам
Верхняя граница интервала:                                      ± 35 %
```

### 5.1 Что происходит с Δ при разных источниках значения

Найдено при аудите: «ручной ввод» и «подтверждение клиентом» — не одно и то же, и наивное правило «ввёл руками → неопределённость исчезла» позволяет sales случайно накрутить точность, вбив собственную прикидку.

| Источник значения | Δ параметра |
|---|---|
| `aus Dokument` (извлечено, источник указан) | 0 |
| `vom Kunden bestätigt` (названо клиентом на встрече) | 0 |
| `manuell erfasst` (оценка самого sales, клиент не подтверждал) | **Δ/2** |
| `abgeleitet` (подстановка по правилу) | полная Δ |

Ручной ввод sales сокращает неопределённость вдвое, но не обнуляет: оценка «на глаз» лучше формулы, потому что sales видел документы, но хуже подтверждения клиентом. Практическое следствие на встрече: когда клиент подтверждает вбитую sales цифру, чип переключается `manuell erfasst → vom Kunden bestätigt`, и интервал сужается ещё раз — прямо на глазах. Это тот же вовлекающий механизм из D-08, только двухступенчатый.

| Итоговый интервал | Поведение системы |
|---|---|
| до ± 15 % | «Belastbare Indikation» — зелёный, показывать можно |
| ± 15…25 % | «Indikation mit Annahmen» — жёлтый, показывать можно, блок Annahmen выводится в презентации на отдельном слайде |
| свыше ± 25 % | «Nicht präsentationsreif» — красный. Система не запрещает, но предупреждает sales и показывает список данных, которые дадут наибольшее сокращение интервала |

**Ключевая механика — сортировка вопросов по эффекту.** Список открытых вопросов клиенту всегда упорядочен по величине Δ: сначала классификация (`Gebäudeform` / `Nutzungsart`, ±6 %), затем BGF (±8 %, если подставлена), Energiestandard (±4 %), KG-Zuordnung (±5 %), UG-Umfang (±5 %). Sales видит не «12 вопросов», а «три вопроса, которые уберут 15 % неопределённости». Это делает подготовку накануне встречи осмысленной за десять минут вместо часа.

---

## 6. Что требует подтверждения инженерами

Правила выше работают как есть, но пять чисел в них — рабочие допущения, а не измеренные значения. У вас есть архив пар «индикативный оффер ↔ финальная смета» — на нём они калибруются за один заход.

| Что калибровать | Текущее значение | На чём калибровать |
|---|---|---|
| Коэффициент WFL / BGF (жилые надземные этажи) | 0,75 | архив завершённых проектов |
| Доля BGF S от общей BGF | 8 % | проекты с посчитанной BGF R+S |
| Средний размер WE по типам использования | 70 / 30 / 50 m² | архив |
| Отношение NUF / BGF для коммерции | 0,80 | архив |
| Веса Δ в модели интервала | см. раздел 5 | сравнение прогноза с фактом |

~~Отдельный вопрос: входит ли KG 700 в стандартный объём~~ — **закрыт при аудите**: режим `KG-700-Modus = vereinfacht` (умолчание, D-07) воспроизводит практику Referenzprojekt R-02 (тотал = KG 300+400), одновременно показывая клиенту строку Baunebenkosten. Противоречие каталога и практики снято без выбора одной из сторон.
