# Kernkomponenten — контракты примитивов ядра

Версия 0.1 · 2026-08-05 · статус зрелости всех контрактов ниже — `experimental`

**Нормативный источник:** `All3_Design_System_Audit_Batches_01-02_Consistency_Reviewed_2026-08-04.md`,
раздел 7 «Core component requirements» целиком, раздел 2 (R-01…R-05, R-19, R-21, R-24, R-25),
раздел 10 «Accessibility release gates», раздел 13 «Каноническая архитектура design tokens»,
раздел 16.1 «Universal criteria».
**Единственный источник значений:** `design-system/tokens.css`. Ни одно значение в этом документе
не вводится помимо токенов; отсутствующее значение оформлено как `[ADR-PENDING]` и вынесено
в раздел 10 «Требуемые новые токены» (R-25, TOKEN-005).

Язык документа: пояснительная проза — русский, идентификаторы и токены — английский,
все пользовательские подписи — немецкий.

---

## 0. Область и статус

Здесь описаны только примитивы ядра — то, что аудит перечисляет в разделе 7. Доменные
компоненты (раздел 8 аудита, `DC-*` в `design-system/README.md`) строятся из этих примитивов
и в этот файл не входят.

> **Ни один контракт ниже не может достичь `beta`/`stable`.** Раздел 13 аудита перечисляет
> 25 записей `component.*` **без присвоенных значений**, и прямая цитата раздела 13 —
> «Entries above without an assigned value are not defaults. They are explicit blocking
> decisions under R-25». Слой `component.*` в `tokens.css` отсутствует умышленно, поэтому
> каждый контракт ссылается на semantic-слой напрямую. Это допустимо для `experimental`
> и блокирует `beta` до утверждения ADR (TOKEN-005, DOCS-008).

---

## 1. Универсальные требования — применяются к каждому контракту

### 1.1 Definition of Done (раздел 16.1)

Контракт считается закрытым, только если выполнены все пункты:

- канонические имя и запись в реестре компонентов (`DOCS-014`); имя пригодно для поиска по коду,
  нарративные названия (`Der Moment`, `Die Reise`) допустимы только подзаголовком (DOCS-006);
- используются только утверждённые visual-токены; нерешённый пункт R-25 блокирует релиз;
- нет захардкоженных инстанс-значений (суммы проекта, даты, адреса, данные пользователя) и нет
  пользовательских строк в коде: подписи приходят из словарей локализации, стабильные
  идентификаторы состояний — из утверждённых контрактов;
- задокументированы anatomy, variants, states, transitions, events;
- есть контракты keyboard, screen reader, touch и reduced-motion;
- пройдены тесты contrast, zoom/reflow (200 %, 320 px), long-content и псевдолокализации (+35 %);
- реестр объявляет применимость **всех семи** состояний оси данных §1.3 —
  `loading / empty / partial / ready / stale / error / permission`; у применимого — пример,
  у неприменимого — `notApplicableReason` **с текстом причины** (слово `notApplicableReason`
  без причины пункт не закрывает). `ready` объявляется наравне с остальными: это пятое
  состояние правила проекта 30, имя `ideal` отменено (STATE-003);
- во всей общей документации только синтетические фикстуры из
  `docs/audit/synthetic-fixtures.md` (R-23): комплекс `Haus A` / `Haus B`,
  `scenarioId: DEMO-SC-01`, `projectId: DEMO-0001`. Итоги —
  `≈ 3.818.000 €` (`DEMO-RUN-0007`, Haus A · точное `3.817.835,00`) ·
  `≈ 2.005.000 €` (`DEMO-RUN-0008`, Haus B · точное `2.005.101,00`) ·
  `≈ 5.823.000 €` (`DEMO-RUN-0012`, Komplex · точное `5.822.936,00`); префикс `≈` обязателен
  у всех трёх, потому что отображаемое отличается от точного (CALC-007), а label каждого —
  `Zwischensumme der kalkulierten Positionen`, поскольку KG 500 во всей фикстуре имеет
  coverage `unknown` (R-18, CALC-006);
- **каждый денежный спесимен несёт `scenarioId` и `calculationRunId` фикстуры** (DOCS-011)
  и выведен из точного Decimal, а не из уже округлённого отображаемого числа (CALC-007);
  спесимен без идентификации сценария в контракт не попадает;
- owner, maturity, version, last review, Figma/code parity актуальны;
- проходят применимые unit/invariant, axe, keyboard E2E, visual regression и print тесты;
- реестр перечисляет каждый родительский P0 и все привязанные P1/P2 со статусом `closed`
  (с доказательством) либо `notApplicable` (с утверждённой причиной).

### 1.2 Инварианты, действующие во всех контрактах

| Правило | Что означает для примитива |
|---|---|
| **R-01** | `#FD5E00` (`--color-brand-accent`) **запрещён** как цвет действия, выделения, фокуса, warning, error и статуса. Как текст допустим только ≥ 24 px Regular или ≥ 18,67 px Bold на белом (`--color-text-display-accent`). Ни один контракт ниже не использует `--color-brand-accent`. |
| **R-02** | Действие — только `--color-action-primary-bg` (4,79:1) → `--color-action-primary-hover` (5,60:1) → `--color-action-primary-pressed` (6,59:1) с `--color-action-primary-text`. |
| **R-03** | Выделение — `--border-selected` (2 px `--color-selection-border`, 4,79:1 к белому). Фокус двухслойный: внутренний separator 2 px `--color-focus-separator` + внешний ring 2 px `--color-focus-ring`. Реализация — глобальное правило `:focus-visible` в `tokens.css`; компонент его не переопределяет и не отключает. |
| **R-04** | Зона нажатия и фокуса ≥ 44 × 44 px всегда, включая `Kompakt`. Визуальная высота может быть 32 / 40 / 48 px (`--size-control-visual-sm/md/lg`) **только при одновременном выполнении обоих условий R-04**: (а) невидимая hit-зона `.hit-target::before` не перекрывает соседние контролы **и** (б) focus outline виден полностью — ни родительский `overflow`, ни соседняя поверхность его не обрезают. |
| **R-05** | Существенная информация, цена, последствие и действие доступны **без hover**. Hover только дублирует уже доступное. Всё, что открывается по hover, открывается также по focus и по tap. |
| **R-19** | Каждая дельта несёт baseline, направление, знак и единицу: `≈ +97.000 € gegenüber Variante Basis` — точное `+97.335,00 €`, `+2,55 %`, фикстура `DEMO-SC-01`, `DEMO-RUN-0007 → DEMO-RUN-0009`. Цвет и иконка — вторичные носители. |
| **R-21** | Итоговое значение доступно немедленно; движение никогда не единственный feedback; `prefers-reduced-motion` гасит всё (в `tokens.css` длительности обнуляются). |
| **R-24** | Роли типографики фиксированы. Кнопка — `button.primary 16/20 Medium`, **не Bold**. `caption 12/16` и `badge.metadata 12/16` **запрещены** для scope, source, assumption, exclusion, error, blocker и workflow-status: этим смыслам минимум `small 14/20` или `badge.status 14/20 Medium`. |
| **R-25** | Значение без утверждения не выбирается «разумным дефолтом». Отсутствующее — `[ADR-PENDING]`. |
| **Раздел 10** | 22 accessibility release gate применяются к каждому компоненту; ниже они цитируются номером — например «gate 21» = forced-colors сохраняет focus/selection/error/required без опоры на заливку. |

**Контрастные ограничения, следующие из `tokens.css` (проверены расчётом):**
`--color-text-muted` (3,36:1) и `--color-text-disabled` (2,71:1) **не проходят** 4,5:1 и
запрещены для helper, error, статуса и любого текста, несущего решение. Helper-текст —
`--color-text-secondary` (5,33:1). `--color-status-error` (3,64:1 на белом) и
`--color-status-success` (4,19:1) допустимы только как цвет бордера, иконки или заливки бейджа;
текст статуса всегда `--color-text-primary`. `--color-status-info` (7,90:1) как текст допустим.

### 1.3 Две независимые оси состояний (STATE-001)

Каждый контракт объявляет их раздельно:

- **Взаимодействие:** `default · hover · focus · pressed · selected · disabled · readOnly · loading`.
- **Данные:** `loading · empty · partial · ready · stale · error · permission`.
  Слово `ideal` отменено (STATE-003): корректное имя — `ready`.

**`ready` объявляется в каждом контракте наравне с остальными шестью** — применимым
с примером или неприменимым с названной причиной. Пропуск `ready` — это отсутствие пятого
состояния правила проекта 30, и такой контракт в прототип не попадает. Каждое
`notApplicableReason` ниже стоит вместе с причиной; слово без причины не является объявлением.

Оси комбинируются: `ready + hover`, `partial + disabled` — валидные сочетания.
`stale / superseded / conflicted / unverified` не подменяют друг друга и сосуществуют (STATE-008).
Каждый error объявляет cause, impact, remedy и retry policy; `Fehler` без расшифровки
недостаточен (STATE-005). Причина `disabled` стоит рядом в порядке чтения и называет
следующий шаг (STATE-006, gate 15) — тултип на disabled-контроле решением не является.

---

## 2. Раздел 7.1 — Buttons и links

### Button

**Закрывает:** BUTTON-001 · BUTTON-002 · BUTTON-003 · BUTTON-004 (частично: LINK-002 для
кнопки-загрузки, ICON-002 для icon-only, gate 15)

**Анатомия:**
`root <button type="button|submit">` → `[leadingIcon?]` → `label` → `[trailingIcon?]` →
`[busyIndicator]` (в потоке, в зарезервированном слоте) → `.hit-target::before` (невидимая
цель 44 × 44). Рядом с root, **в обычном порядке чтения**, но вне кнопки: `reasonBlock`
(текст причины недоступности + отдельная кнопка следующего шага).
Ширина фиксируется `min-width`, вычисленным по самой длинной подписи из всех состояний
(измерение в `ch`, не в px — метрики шрифта не закладываются в пиксели).

**Варианты:**

| Вариант | Поверхность | Бордер | Текст |
|---|---|---|---|
| `primary` | `--color-action-primary-bg` | нет | `--color-action-primary-text` |
| `secondary` | `--color-action-secondary-bg` | `--border-contrast-1px` | `--color-action-secondary-text` |
| `ghost` | прозрачная | нет | `--color-text-primary` |
| `destructive` | **`[ADR-PENDING: нужен токен --color-action-destructive-bg/-hover/-pressed/-text]`** | — | — |

`destructive` существует только для delete/revoke (BUTTON-001) и в v0.5 **не собирается**:
единственный красный токен `--color-status-error` даёт с белым текстом 3,64:1 и нарушает gate 1.
До ADR деструктивное действие оформляется как `secondary` + `--border-error` + подпись,
называющая объект удаления, и подтверждается через Dialog. Success-состояния кнопки не
существует: успех сообщают Toast и SaveStatus (BUTTON-001).

Размеры: `sm` = `--size-control-visual-sm`, `md` = `--size-control-visual-md` (по умолчанию,
= `--control-height`), `lg` = `--size-control-visual-lg`. Icon-only — только для действий,
не несущих решения (ICON-002); у него обязательное `aria-label` и Tooltip, а смысл,
влияющий на решение, дублируется видимым текстом (R-05).

**Состояния:**

*Взаимодействие*
- `default` — цветовая пара варианта.
- `hover` — `primary`: `--color-action-primary-hover`; `secondary`/`ghost`: заливка
  `--color-action-secondary-hover`. Hover ничего не сообщает сверх видимого (R-05).
- `focus` — глобальный `:focus-visible` (R-03); собственного стиля нет.
- `pressed` — `primary`: `--color-action-primary-pressed`; `secondary`/`ghost`:
  **`[ADR-PENDING: нужен токен --color-action-secondary-pressed / --color-action-ghost-pressed]`**.
  До ADR pressed у этих вариантов выражается только `aria-pressed`/фокусом, без визуальной смены
  тона — выдумывать тон запрещено (R-25).
- `loading` — ширина не меняется (BUTTON-002); подпись описывает процесс: `Wird berechnet …`,
  `Wird gesendet …`; сохраняется цветовая пара enabled; повторная отправка блокируется
  `aria-disabled="true"` + идемпотентный ключ запроса. **`disabled` в этом состоянии не
  ставится** — атрибут `disabled` убрал бы фокус с только что нажатой кнопки.
  Индикатор — indeterminate, длительность `--motion-reveal`, при `prefers-reduced-motion`
  остаётся статическим (R-21, gate 9).
- `disabled` — `--color-action-disabled-bg` / `--color-action-disabled-text` /
  `--color-action-disabled-border`; только `opacity` запрещён (A11Y-001).
- `selected` — notApplicableReason: кнопка не несёт состояния выбора; выбор — SegmentedControl,
  RadioCardGroup или CheckboxCard.
- `readOnly` — notApplicableReason: у контрола действия нет режима «только чтение».

*Данные*: `ready` — предусловия выполнены, кнопка активна, подпись называет исполнимое
действие (`Analyse starten`); это рабочее состояние по умолчанию, `reasonBlock` отсутствует ·
`loading` (см. выше) · `error` — кнопка возвращается в `default`, ошибка живёт
в Toast + inline-блоке · `permission` — недоступное по правам действие показывается
`aria-disabled` c причиной `Keine Berechtigung · Freigabe beim Projektverantwortlichen anfragen`;
скрывать его нельзя, CSS-скрытие не является границей безопасности (R-16) ·
`empty / partial / stale` — notApplicableReason: кнопка не отображает данные, а запускает
действие; неполнота данных живёт в блоке, который кнопка обслуживает, и выражается
её `reasonBlock`-ом, а не собственным состоянием кнопки.

**BUTTON-003.** Disabled primary никогда не используется как способ объяснить предусловие.
Порядок: (1) по возможности кнопка остаётся активной и по нажатию открывает блокер;
(2) если действие объективно невыполнимо — `aria-disabled="true"` (кнопка остаётся
фокусируемой), рядом в порядке чтения `Export nicht möglich · 2 Flächen nicht bestätigt`
и отдельная активная кнопка следующего шага `Flächen bestätigen`.

**BUTTON-004.** Подпись — глагол + объект: `Dokumentwert verwenden` · `Termin vorbereiten` ·
`Angebot prüfen` · `Analyse starten` · `Änderung übernehmen`. Запрещены `OK`, `Weiter`,
`Vorbereiten`, `Speichern?` без объекта.

**Клавиатура:** `Tab` / `Shift+Tab` — единственный вход; `Enter` и `Space` активируют
(нативный `<button>`), `Space` не прокручивает страницу, пока кнопка в фокусе (KEY-003).
Клавиша не активирует кнопку в состоянии `loading`. Собственного `tabindex` кнопка не задаёт.
Порядок фокуса: `Button` → `reasonBlock`-кнопка следующего шага (причина читается раньше
самой кнопки, если стоит перед ней в DOM).

**Screen reader:** нативная роль `button`. `aria-disabled="true"` вместо `disabled` там, где
нужно сохранить фокус и озвучить причину; причина связана `aria-describedby` с `reasonBlock`
**и** присутствует в обычном порядке чтения (gate 15). `loading` объявляется `aria-busy="true"`
на кнопке и сменой доступного имени на подпись процесса; никакого `aria-live` на самой кнопке —
результат объявит Toast/SaveStatus (gate 10). Иконка внутри кнопки с видимым текстом —
`aria-hidden="true"` (ICON-002). Кнопка-загрузка добавляет в доступное имя тип и размер:
`Angebot als PDF herunterladen (PDF, 2,4 MB)` (LINK-002).

**Токены:** `--color-action-primary-bg` · `--color-action-primary-hover` ·
`--color-action-primary-pressed` · `--color-action-primary-text` · `--color-action-secondary-bg` ·
`--color-action-secondary-border` · `--color-action-secondary-text` ·
`--color-action-secondary-hover` · `--color-action-disabled-bg` · `--color-action-disabled-text` ·
`--color-action-disabled-border` · `--color-text-primary` · `--border-contrast-1px` ·
`--border-error` · `--color-focus-ring` · `--color-focus-separator` · `--border-width-focus` ·
`--radius` (= 0) · `--control-height` · `--size-control-visual-sm/-md/-lg` ·
`--size-hit-target-default` · `--size-icon-sm/-md` · `--space-2` · `--space-3` · `--space-4` ·
`--type-button-primary-size/-line/-weight` · `--motion-feedback` · `--motion-reveal`.

**Запреты:**
- `--color-brand-accent` / `#FD5E00` как поверхность или текст кнопки — R-01, A11Y-001;
- Bold в подписи — R-24 (`button.primary 16/20 Medium`);
- `border-radius`, градиент, тень — правило бренда «плоский прямоугольник», BORDER-002;
- смена ширины при `loading` — BUTTON-002;
- `disabled` как носитель объяснения предусловия — BUTTON-003, STATE-006, gate 15;
- тултип как единственное место причины недоступности — STATE-006;
- зона нажатия < 44 × 44 при уменьшении визуальной высоты до 32 px — R-04;
- собственное правило `outline: none` — R-03, gate 2.

---

### Link

**Закрывает:** LINK-001 · LINK-002

**Анатомия:** `root <a href>` → `label` → `[externalIcon | downloadIcon]` →
`[visuallyHiddenPurpose]`. Внутри плотных таблиц ссылка не сокращается многоточием так,
чтобы терялась идентичность цели (PROVENANCE-006).

**Варианты:** `inline` (внутри текста) · `standalone` (отдельной строкой) ·
`external` · `download` · `sourceRef` (ссылка на документ/страницу источника).

**Состояния:**

*Взаимодействие*
- `default` — цвет `--color-text-primary` + **постоянное подчёркивание сплошной линией**.
  Цвет не является носителем: gate 7 и LINK-001. Отдельного утверждённого цвета ссылки нет —
  **`[ADR-PENDING: нужен токен --color-action-link-text]`**; до ADR различие несёт подчёркивание.
- `hover` — усиление подчёркивания (толщина), никакой новой информации (R-05).
- `focus` — глобальный `:focus-visible`.
- `pressed` — notApplicableReason: у навигационного перехода нет удерживаемого состояния;
  утверждённого тона нет (R-25).
- `disabled` — notApplicableReason: недоступная ссылка не рендерится ссылкой; вместо неё
  текст + причина (STATE-006).
- `loading` — notApplicableReason: переход не имеет промежуточного состояния в компоненте;
  ожидание показывает целевой экран.

*Данные*: `ready` — цель существует, актуальна и достижима; доступное имя называет её
идентичность (`Grundrisse_Muster_V2.pdf, Seite 12`) · `stale` — ссылка на устаревшую версию
документа несёт рядом `Veraltet · Stand 04.08.2026` бейджем (PROVENANCE-005) ·
`permission` — вместо ссылки текст с причиной ·
`loading / empty / partial / error` — notApplicableReason: ссылка адресует цель, а не отображает
её содержимое; загрузка, пустота, неполнота и ошибка принадлежат целевому экрану и объявляются
там, иначе одна и та же ошибка сообщалась бы дважды.

**Клавиатура:** `Tab` — вход, `Enter` — переход (`Space` для `<a>` не активирует и это
корректно). Ссылка всегда настоящий `<a href>`; кликабельные `<span>`/`<u>` запрещены.

**Screen reader:** роль `link`. Доступное имя самодостаточно вне контекста: не `hier`,
не `mehr`. `external`: видимая иконка + `aria-hidden="true"` на ней + скрытый текст
`(öffnet in neuem Tab)`, атрибуты `target="_blank" rel="noopener noreferrer"` (LINK-002 —
контекст не меняется неожиданно). `download`: тип и размер в доступном имени
`Kalkulation herunterladen (PDF, 2,4 MB)`. `sourceRef`: доступное имя называет документ,
версию и страницу — `Grundrisse_Muster_V2.pdf, Version 2, Seite 12` (PROVENANCE-002; имя
документа — из синтетической библиотеки фикстур, R-23); неоднозначные даты вида `12-08`
запрещены (PROVENANCE-003).

**Токены:** `--color-text-primary` · `--type-link-size/-line/-weight` ·
`--color-focus-ring` · `--color-focus-separator` · `--border-width-focus` ·
`--size-hit-target-default` · `--size-icon-sm`.

**Запреты:**
- пунктирное подчёркивание как единственный affordance — LINK-001;
- цвет как единственный признак ссылки — gate 7;
- `--color-brand-accent` как цвет ссылки — R-01;
- открытие нового окна без объявления — LINK-002;
- ссылка-обманка (`<span onclick>`) — README §6.1, gate 3.

---

## 3. Раздел 7.2 — Tabs, segmented controls и radios

> **Три разные семантики, смешивать запрещено.**
> **Tabs** переключают *представления* одного и того же объекта — они ничего не конфигурируют.
> **SegmentedControl** — это radio group: он *задаёт значение* (`EH 55 / EH 40`, `Komfortabel /
> Kompakt`, язык выдачи). **RadioCardGroup** — тот же выбор значения, но карточками с описанием
> и последствием. Для Option Tile: бинарная аддитивная опция — **checkbox-card**, взаимоисключающие
> — **radio-card**; **switch-семантика для Option Tile запрещена** (OPTION-008).

### Tabs

**Закрывает:** TABS-001 · TABS-002 (граница применения) · TABS-003 · TABS-004 · KEY-003

**Анатомия:** `scrollStartButton?` → `tablist [role="tablist"]` → `tab[] [role="tab"]`
(`label` + `[countBadge]`) → `scrollEndButton?` ⟶ `tabpanel[] [role="tabpanel"]`.
Кнопки прокрутки стоят **вне** `tablist`, чтобы не попасть в roving-цикл, и имеют подписи
`Zurück blättern` / `Weiter blättern`. Индикатор активного таба — нижняя линия
`--border-contrast-2px` **плюс** `aria-selected`; цвет не единственный носитель (gate 7).

**Варианты:** `underline` (по умолчанию) · `overflow` (при переполнении).
Вертикальных табов нет.

**Состояния:**

*Взаимодействие*: `default` · `hover` (`--color-action-secondary-hover`) ·
`focus` (глобальный ring; виден целиком даже при `overflow: auto` — контейнер получает
`scroll-padding` под ширину ring) · `selected` (`--border-contrast-2px` + `aria-selected="true"`) ·
`disabled` — notApplicableReason: недоступное представление не показывается табом; вместо него
таб остаётся активным и панель объясняет причину (STATE-006) · `pressed` —
notApplicableReason: выбор фиксируется мгновенно, отдельного pressed-тона нет (R-25) ·
`loading` — на уровне панели, не таба.

*Данные*: `ready` — панель показывает полное содержимое представления, счётчик в табе
соответствует числу строк панели (`Offene Fragen, 4 Einträge`) · `loading` — панель показывает
Skeleton, `aria-busy` на панели (SKELETON-001) · `empty` · `partial` · `stale` · `error` ·
`permission` — все семь состояний живут на уровне `tabpanel`; сам `tablist` данных
не отображает и собственной оси данных не имеет.

**TABS-003.** Активный таб синхронизируется с URL/history (query-параметр, не hash-навигация),
`popstate` возвращает выбор без перемонтирования формы. Несохранённое локальное состояние формы
при переключении **сохраняется**: оно живёт в Draft Revision и не является авторитетным входом
(R-10), поэтому переключение таба не создаёт VariantVersion и не теряет ввод.

**TABS-004.** При переполнении `tablist` остаётся `tablist`: горизонтальная прокрутка внутри
контейнера с `overflow-x: auto`, кнопки start/end, автопрокрутка активного таба в зону видимости
(`scrollIntoView({ block: 'nearest', inline: 'nearest' })`, поведение `auto` при
`prefers-reduced-motion`). Подменять переполненный `tablist` меню запрещено. Горизонтально
прокручивается только сам `tablist`, страница — никогда (gate 6).

**Клавиатура (TABS-001, KEY-003):** roving tabindex — ровно один таб с `tabindex="0"`,
остальные `-1`. `←` / `→` перемещают фокус с зацикливанием; `Home` / `End` — первый / последний.
Активация **ручная**: `Enter` или `Space` выбирают таб под фокусом (панели тяжёлые, автоактивация
на каждой стрелке запускала бы лишние расчёты). `Tab` из `tablist` уводит в `tabpanel`
(`tabindex="-1"` на панели, если внутри нет фокусируемых элементов). Стрелки меняют таб **только**
когда фокус внутри `tablist` (KEY-003). Порядок фокуса: `scrollStartButton` → активный `tab` →
`scrollEndButton` → содержимое `tabpanel`.

**Screen reader:** `role="tablist"` с `aria-label` (например `Ansichten der Kalkulation`);
`role="tab"` + `aria-selected` + `aria-controls`; `role="tabpanel"` + `aria-labelledby`.
Выбор объявляется самой сменой `aria-selected`; отдельный `aria-live` не добавляется —
это дало бы двойное объявление (gate 10). Счётчик в табе входит в доступное имя:
`Offene Fragen, 4 Einträge`.

**Токены:** `--border-contrast-2px` · `--color-border-strong` · `--color-action-secondary-hover` ·
`--color-text-primary` · `--color-text-secondary` · `--type-label-size/-line/-weight` ·
`--space-2` · `--space-3` · `--space-4` · `--control-height` · `--size-hit-target-default` ·
`--color-focus-ring` · `--color-focus-separator` · `--border-width-focus` · `--motion-feedback`.

**Запреты:**
- табы для конфигурационного выбора (`EH 55 / EH 40`, язык выдачи) — TABS-002; это SegmentedControl;
- меню вместо переполненного `tablist` — TABS-004;
- `aria-selected` без roving tabindex — TABS-001;
- оранжевая подчёркивающая линия активного таба — R-01;
- потеря введённых данных при переключении — TABS-003;
- горизонтальная прокрутка страницы вместо прокрутки `tablist` — gate 6.

---

### SegmentedControl

**Закрывает:** TABS-002 · (применяется DENSITY-002 `Komfortabel | Kompakt`, LOCALE-004 для 2–3
языков выдачи)

**Анатомия:** `fieldset` → `legend` (видимый, не `placeholder`) → `group [role="radiogroup"]` →
`segment[] <input type="radio">` + `<label>` → `[helperText]`. Сегменты в одной рамке
`--border-contrast-1px`, разделители — `--border-hairline`.

**Варианты:** `2 сегмента` · `3 сегмента`. При **4 и более значениях** SegmentedControl
не применяется — используется подписанный `<select>` / меню (LOCALE-004).

**Состояния:**

*Взаимодействие*: `default` · `hover` (`--color-action-secondary-hover`) · `focus` (глобальный ring
вокруг сегмента, не вокруг группы) · `selected` — `--border-selected` 2 px + заливка
`--color-surface-selected` + видимая иконка ✓; **заливка носителем не является** (в forced-colors
она исчезает, gate 21) · `disabled` — отдельный сегмент недоступен только вместе с видимой
причиной рядом · `pressed` — notApplicableReason: выбор фиксируется на `change`, отдельного
удерживаемого тона нет · `loading` — notApplicableReason: значение применяется локально,
пересчёт показывает целевой блок с `aria-busy`.

*Данные*: `ready` — все сегменты доступны, текущее значение выбрано и озвучивается при входе
в группу: `Dichte, Komfortabel ausgewählt, 1 von 2` ·
`permission` (сегмент недоступен по правам, причина рядом) ·
`loading / empty / partial / stale / error` — notApplicableReason: контрол хранит выбранное
значение, а не загруженные данные; набор сегментов задан контрактом и не приходит с сервера,
поэтому у него не бывает загрузки, пустоты, неполноты, устаревания и ошибки выборки —
эти состояния принадлежат блоку, который значение пересчитывает.

**Клавиатура:** нативная семантика radio group. `Tab` входит в группу на выбранный сегмент
(ровно один `tabindex` в цикле — обеспечивается нативно); `←`/`↑` и `→`/`↓` перемещают фокус
**и одновременно выбирают** (стандартное поведение radio, отличие от Tabs); `Home` / `End` —
первый / последний; `Space` выбирает сегмент под фокусом. `Tab` выводит из группы целиком.

**Screen reader:** `fieldset`/`legend` дают групповое имя (`Dichte`, `Sprache der Ausgabe`);
каждый сегмент — нативный `radio` с `aria-checked` из состояния input. Текущее значение
озвучивается при входе в группу (DENSITY-002). Подпись показывает **текущее состояние**,
а не действие: `Komfortabel` / `Kompakt`, но не `Kompakt umschalten` (LAYOUT-008).

**Токены:** `--border-contrast-1px` · `--border-hairline` · `--border-selected` ·
`--color-selection-border` · `--color-surface-selected` · `--color-surface-default` ·
`--color-action-secondary-hover` · `--color-text-primary` · `--type-label-size/-line/-weight` ·
`--control-height` · `--size-hit-target-default` · `--space-2` · `--space-3` ·
`--size-icon-sm` · `--motion-feedback`.

**Запреты:**
- `role="tablist"` на конфигурационном выборе — TABS-002;
- заливка `--color-brand-accent` у выбранного сегмента — R-01;
- заливка как единственный признак выбора — gate 7, gate 21;
- 4+ сегментов — LOCALE-004;
- подпись-действие вместо подписи-состояния — LAYOUT-008.

---

### RadioCardGroup

**Закрывает:** RADIO-001 · RADIO-002 · (семантическая половина OPTION-008 —
взаимоисключающие опции)

**Анатомия:** `fieldset` → `legend` → `group` → `card[]`:
`<input type="radio">` (визуально скрыт, но фокусируем и в потоке) + `<label>` →
`checkIndicator` (круг + ✓) → `title` (блочный элемент) → `description` (блочный) →
`consequenceLine` (цена/срок — блочный) → `[badge Empfohlen]` → `[constraintLine]` →
`[detailsButton]`. Каждая подпись — **блочный элемент**: инлайновые `<span>` склеиваются
(регрессия «PersonenaufzuginklusiveGK 5»). Заголовки — `overflow-wrap: break-word` +
`hyphens: auto` при выставленном `lang`; правый паддинг резервирует место под `checkIndicator`;
ширины через `minmax()`, не фиксированные.

**Варианты:** `compactList` (одна колонка, описание одной строкой) ·
`tileGrid` (сетка карточек с последствием). Высота карточек в ряду выравнивается сеткой,
чтобы длина слова не создавала визуального ранжирования (OPTION-010).

**Состояния:**

*Взаимодействие*: `default` (`--border-default`) · `hover` (`--color-surface-subtle`;
никакой новой информации — цена и последствие видны всегда, R-05/OPTION-009) ·
`focus` (глобальный двухслойный ring; на выбранной карточке белый separator отделяет ring
от `--color-selection-border` — ради этого R-03 и требует два слоя) ·
`selected` (`--border-selected` + `--color-surface-selected` + видимый ✓ + `aria-checked`) ·
`disabled` (`--color-action-disabled-*`; причина рядом видимым текстом, не тултипом) ·
`pressed` — notApplicableReason: выбор фиксируется на `change` мгновенно, удерживаемого
состояния у radio нет и утверждённого тона для него не существует (R-25) ·
`loading` — на уровне `consequenceLine`
(«Vorschau wird berechnet»), не на уровне карточки.

*Данные*: `ready` (цена и последствие рассчитаны и видны без hover:
`EH 40 · ≈ +97.000 € Mehrpreis`, фикстура `DEMO-SC-01`, `DEMO-RUN-0007 → DEMO-RUN-0009`) ·
`loading` (цена в расчёте — показывается индикатор, **прежнее значение без пометки
`Vorheriger Stand` не показывается**) · `partial` (цена не определена → `Preis nicht ermittelt`,
никогда `0 €`) · `stale` · `error` · `permission`; `empty` — на уровне группы:
`Keine Optionen verfügbar` + объяснение.

**RADIO-002 — `Empfohlen` ≠ `Ausgewählt`.** Рекомендация показывается бейджем
`badge.status 14/20 Medium` с иконкой и **никогда не меняет значение автоматически**.
Выбор показывается ✓ + `--border-selected` + `aria-checked="true"`. Оба признака могут
присутствовать одновременно и озвучиваются раздельно:
`Empfohlen, ausgewählt, EH 40, ≈ 97.000 € Mehrpreis gegenüber Variante Basis`
(фикстура `DEMO-SC-01`, `DEMO-RUN-0007 → DEMO-RUN-0009`; точное `+97.335,00 €`, `+2,55 %`).
Округление до 1.000 € и точное значение раскрываются у самой цены, а не в доступном
имени карточки (CALC-007).

**Клавиатура:** нативная radio group: `Tab` входит на выбранную (или первую) карточку,
стрелки перемещают **и выбирают**, `Home`/`End` — края, `Space` выбирает. `detailsButton`
внутри карточки — **отдельный focus stop после** самой карточки, с `stopPropagation`
(LAYOUT-010, OPTION-008 «Details action отдельна»); собственного `tabindex` у карточки нет —
фокус принимает input.

**Screen reader:** `fieldset`/`legend` — имя группы (`Energiestandard`). Доступное имя карточки =
`title`; `description`, `consequenceLine`, `constraintLine` и бейджи связаны `aria-describedby`
в этом порядке. Ограничение — часть доступного имени, а не декоративная подпись:
`GK 5 erforderlich` (OPTION-004, и это `small 14/20`, не caption — R-24).
Недоступность объявляется причиной: `Nicht verfügbar · GK 5 nicht gewählt`.

**Токены:** `--border-default` · `--border-selected` · `--color-selection-border` ·
`--color-surface-default` · `--color-surface-subtle` · `--color-surface-selected` ·
`--color-action-disabled-bg/-text/-border` · `--color-text-primary` · `--color-text-secondary` ·
`--type-label-size/-line/-weight` · `--type-small-size/-line/-weight` ·
`--type-badge-status-size/-line/-weight` · `--space-2` · `--space-3` · `--space-4` ·
`--size-icon-md` · `--size-hit-target-default` · `--motion-feedback` · `--enter-shift`.
Визуальный размер индикатора выбора токеном не задан —
**`[ADR-PENDING: нужен токен --size-control-indicator]`** (в README §3 указано 18 px,
это значение вне шкалы отступов и без утверждения; LAYOUT-002 требует отдельного
санкционированного токена для геометрии контролов).

**Запреты:**
- `div[role="radio"]` вместо нативного input без полного контракта клавиатуры — RADIO-001;
- заливка `--color-brand-accent` при `checked` — R-01;
- **любая заливка как единственный носитель `checked`** — gate 21: в forced-colors фон
  подменяется системным и признак выбора исчезает. Носитель — `--border-selected`
  (2 px `--color-selection-border`) + видимая ✓ + `aria-checked`; `--color-surface-selected`
  только поддерживает. Это то же назначение токена, что предписывает
  `design-system/README.md` §3 для checkbox/radio, — расхождения между документами здесь нет;
- автоматическая установка рекомендованного значения — RADIO-002;
- цена/последствие только по hover — R-05, OPTION-009, gate 8;
- `caption 12/16` для ограничений, источника и статуса — R-24, TYPE-011;
- `tabindex` на самой карточке при наличии внутренних контролов — LAYOUT-010.

---

### CheckboxCard

**Закрывает:** OPTION-008 (бинарная аддитивная опция) · опирается на CARD-001

**Анатомия:** идентична RadioCardGroup, но `<input type="checkbox">`, индикатор — квадрат с ✓,
и карточки независимы (нет группового цикла стрелок).

**Варианты:** `standalone` · `list` (список независимых опций под общим `legend`).

**Состояния:** обе оси объявлены здесь целиком; наследование прозой не считается объявлением
(STATE-001).

*Взаимодействие*: `default` (`--border-default`) · `hover` (`--color-surface-subtle`;
цена и последствие видны и без hover, R-05/OPTION-009) · `focus` (глобальный двухслойный ring) ·
`selected` (`--border-selected` + `--color-surface-selected` + видимый ✓ + `aria-checked="true"`;
заливка носителем не является — gate 21) · `disabled` (`--color-action-disabled-*`, причина
рядом видимым текстом, не тултипом) · `pressed` — notApplicableReason: переключение
фиксируется на `change` мгновенно, удерживаемого состояния у checkbox нет и утверждённого
тона для него не существует (R-25) · `loading` — на уровне `consequenceLine`
(`Vorschau wird berechnet`), не на уровне карточки: сама опция остаётся переключаемой.

Дополнительно к обеим осям — `mandatory`: замок-иконка + подпись `Pflicht`
(OPTION-002/OPTION-005). Обязательная включённая опция выглядит **locked/required**, а не
`disabled`; снятие выбора недоступно, но контрол остаётся фокусируемым и объясняет причину.

*Данные*: `ready` (цена опции рассчитана и видна:
`Untergeschoss inkl. Tiefgarage · +476.000 € Mehrpreis` — точное `+476.000,00 €`, префикс `≈`
не нужен, потому что округление до 1.000 € значение не меняет; фикстура
`DEMO-SC-02`/`DEMO-RUN-0011` → `DEMO-SC-01`/`DEMO-RUN-0007`) ·
`loading` (цена в расчёте — индикатор; прежнее значение
без пометки `Vorheriger Stand` не показывается) · `partial` (`Preis nicht ermittelt`,
никогда `0 €` — SCOPE-001) · `stale` (`Veraltet · Stand 04.08.2026` рядом с ценой) ·
`error` (`Preis nicht abrufbar · erneut versuchen`) · `permission` (опция недоступна по правам —
видимая строка с причиной, не тихое исчезновение, R-16) · `empty` — на уровне списка
(`Keine Optionen verfügbar` + объяснение), у отдельной карточки notApplicableReason: карточка
описывает ровно одну опцию, поэтому пустого набора у неё быть не может.

**Клавиатура:** `Tab` — каждый checkbox отдельный focus stop; `Space` переключает; `Enter`
не переключает (нативное поведение checkbox) — это сознательно не переопределяется.

**Screen reader:** нативная роль `checkbox` + `aria-checked`. `mandatory` объявляется
`aria-disabled="true"` **и** текстом `Pflicht`, а не только иконкой замка (gate 7, ICON-003).

**Токены:** те же, что у RadioCardGroup.

**Запреты:**
- `role="switch"` для опции — **OPTION-008 прямо запрещает switch-семантику для Option Tile**;
- зелёная галочка и обобщённая «серая карточка» как обозначение состояния — OPTION-002
  (галочка = `selected` цветом `--color-selection-border`, замок = `mandatory`,
  текстовый бейдж = статус ценообразования);
- `disabled` для обязательной включённой опции — OPTION-005.

---

### Switch

**Закрывает:** граница применения OPTION-008 (где switch допустим, а где нет)

**Анатомия:** `<button role="switch">` → прямоугольный трек → квадратный ползунок →
`label` слева (видимый) → `stateText` (`Ein` / `Aus`) справа.

**Варианты:** `md` (по умолчанию). Switch допустим **только** для немедленного бинарного
переключения состояния интерфейса или расчётной настройки, которая не является выбором
позиции оффера: `KG-700-Modus`, `Regionalfaktor anwenden`.

**Состояния:**

*Взаимодействие*: `default` · `hover` (`--color-surface-subtle` на треке) ·
`focus` (глобальный двухслойный ring вокруг `<button role="switch">`) ·
`pressed` — notApplicableReason: состояние фиксируется на отпускании мгновенно, промежуточного
удерживаемого тона нет, а выдумывать его без утверждённого токена запрещено (R-25) ·
`checked` (`--border-selected` на треке + позиция ползунка + `stateText`) ·
`disabled` (с видимой причиной рядом в порядке чтения, STATE-006) ·
`loading` — notApplicableReason: переключение применяется локально и немедленно; асинхронен
только пересчёт, который живёт в целевом блоке с `aria-busy`, а не в самом переключателе —
иначе контрол «зависал» бы под рукой пользователя.

*Данные*: `ready` — настройка применена, `stateText` называет действующее значение
(`KG-700-Modus · Ein`, `Regionalfaktor anwenden · Aus`) ·
`permission` — переключатель недоступен по правам: остаётся видимым и фокусируемым,
`aria-disabled="true"` + причина рядом (R-16) ·
`loading / empty / partial / stale / error` — notApplicableReason: switch хранит булево
предпочтение интерфейса или расчёта, а не загруженные данные. Значение известно синхронно
из состояния приложения, поэтому у него нет ни загрузки, ни пустоты, ни неполноты, ни
устаревания, ни ошибки выборки; ошибка применения настройки принадлежит блоку, который
она пересчитывает.

**Клавиатура:** `Tab` — вход; `Space` и `Enter` переключают.

**Screen reader:** `role="switch"` + `aria-checked`; видимый `stateText` дублирует состояние
текстом — позиция ползунка не единственный носитель (gate 7).

**Токены:** `--border-contrast-1px` · `--border-selected` · `--color-selection-border` ·
`--color-surface-default` · `--color-surface-subtle` · `--color-text-primary` ·
`--type-label-size/-line/-weight` · `--size-hit-target-default` · `--space-2` ·
`--motion-feedback`.

**Запреты:**
- switch для выбора опции оффера — OPTION-008;
- switch как замена radio при трёх и более значениях;
- скругления на треке — правило бренда.

---

## 4. Раздел 7.3 — Forms, numeric input, slider и textarea

### FormField

**Закрывает:** FORM-001 · FORM-003 · (несущая обвязка для NumericInput, Slider, Textarea)

**Анатомия:** `root` → `<label for>` (видимый, всегда) → `[requirementMarker]` →
`control` → `[unitAdornment]` → `helperText` → `errorText` → `[sourceChip]`.
Порядок в DOM = порядок чтения: label → control → helper → error.

**Варианты:** `text` · `numeric` · `select` · `textarea` · `date`. Плотность влияет только
на высоту контрола (`--control-height`) и паддинги, не на наличие подписей (LAYOUT-009).

**Состояния:**

*Взаимодействие*: `default` (`--border-default`) · `hover` (`--color-border-strong`) ·
`focus` (глобальный двухслойный ring; собственная смена цвета бордера не требуется) ·
`disabled` (`--color-action-disabled-*` + видимая причина) ·
`readOnly` (`--color-surface-subtle`, значение выделяемо, `aria-readonly`) ·
`error` (`--border-error` + `errorText` + `aria-invalid="true"`) ·
`pressed` — notApplicableReason: поле ввода не активируется нажатием ·
`loading` — только для полей, значение которых доезжает асинхронно: Skeleton в слоте значения
+ `aria-busy` на root.

*Данные*: `ready` (значение есть и подтверждено — `sourceChip` = `vom Kunden bestätigt`,
например `Wohnfläche 1.500,00 m²`; поле редактируемо, `errorText` пуст) · `loading` ·
`empty` (нет значения — показывается плейсхолдер-подсказка формата **в helper**,
не в `placeholder`) · `partial` (значение выведено, а не подтверждено —
`sourceChip` = `abgeleitet`) · `stale` · `error` · `permission` (readOnly + причина).

**FORM-001.** У каждого контрола видимая программно связанная подпись (`<label for>`);
`aria-label` вместо видимой подписи применяется только у icon-only контролов. Требуемость
выражается **текстом**: `Pflichtfeld` рядом с подписью, `optional` — для необязательных
полей в преимущественно обязательной форме; звёздочка без легенды запрещена.
Helper связан `aria-describedby`, error — тоже, и при `aria-invalid="true"` объявляется первым.

**FORM-003 — четыре различимых класса валидации** (STATE-005: cause · impact · remedy · retry):

| Класс | Когда | Немецкий текст (пример) | Retry |
|---|---|---|---|
| `parseError` | ввод не разбирается | `Eingabe nicht lesbar · erwartet wird eine Zahl, z. B. 1.250,50` | пользователь исправляет ввод |
| `outOfRange` | разбирается, но вне допустимого | `Wert außerhalb des zulässigen Bereichs · zulässig sind 0 bis 100 %` | пользователь исправляет ввод |
| `conflict` | противоречит подтверждённому значению другого источника | `Widerspricht dem bestätigten Dokumentwert 1.500 m² · Quelle wählen` + кнопка `Konflikt lösen` | разрешение конфликта, не повтор |
| `calculationError` | сервер/расчёт не отдал результат | `Berechnung fehlgeschlagen · Wert unverändert · erneut versuchen` | кнопка `Erneut versuchen`, экспоненциальная задержка |

`conflict` **не** превращается в `parseError` и не «схлопывается» в общий `Fehler` (SOURCE-001,
STATE-005). Сводка ошибок формы стоит вверху, каждая строка — ссылка на контрол (gate 16).

**Клавиатура:** `Tab` / `Shift+Tab`. Одноклавишные шорткаты внутри поля не срабатывают
(KEY-001). `Enter` в однострочном поле не отправляет форму там, где отправка имеет
необратимый эффект (EMAIL-011: `Enter` в поле темы письма никогда не отправляет).
Клик по `<label>` переводит фокус в контрол.

**Screen reader:** имя из `<label>`; `aria-describedby` = `helperText` + `errorText`
(+ `sourceChip` при наличии); `aria-required="true"` при обязательности;
`aria-invalid="true"` при ошибке. Появление ошибки объявляется один раз через сводку
`role="alert"`, а не на каждое нажатие клавиши (gate 10). Единица измерения входит в
доступное имя контрола: `Wohnfläche in Quadratmetern`.

**Токены:** `--border-default` · `--border-error` · `--color-border-strong` ·
`--color-border-error` · `--color-status-error` · `--color-surface-default` ·
`--color-surface-subtle` · `--color-text-primary` · `--color-text-secondary` ·
`--color-action-disabled-bg/-text/-border` · `--type-label-size/-line/-weight` ·
`--type-input-size/-line/-weight` · `--type-helper-size/-line/-weight` ·
`--type-error-size/-line/-weight` · `--control-height` · `--cell-pad-x` · `--space-1` ·
`--space-2` · `--space-3` · `--size-hit-target-default` · `--color-focus-ring` ·
`--color-focus-separator` · `--border-width-focus`.

**Запреты:**
- `placeholder` вместо подписи — FORM-001, TEXTAREA-001;
- floating label — подпись обязана быть видимой всегда;
- `--color-text-muted` / `--color-text-disabled` для helper и error — контраст 3,36:1 / 2,71:1
  против требуемых 4,5:1 (gate 1, COLOR-008);
- `caption 12/16` для сообщения об ошибке — R-24, TYPE-011;
- обобщённое `Fehler` без причины, следствия и способа починки — STATE-005;
- красная рамка без текста — gate 7.

---

### NumericInput

**Закрывает:** FORM-002 · (совместно со Slider — SLIDER-001)

**Анатомия:** `FormField` → `<input inputmode="decimal">` → `unitAdornment`
(нередактируемый суффикс `m²`, `€`, `%`) → `[stepperButtons?]` → `[sourceChip]`.
Ширина поля — в `ch` по максимальному числу знаков, не в px (метрики шрифта в пиксели
не закладываются).

**Варианты:** `currency` · `area` · `percent` · `count`. У каждого — своя точность и правило
округления, они объявлены рядом со значением, где значение влияет на решение (16.2).

**Состояния:** обе оси — те же, что у FormField, с двумя дополнениями.

*Взаимодействие*: дополнительно `loading` — во время авторитетного пересчёта поле остаётся
редактируемым, а зависимые значения помечены `aria-busy`; подмена значения «под руками»
пользователя запрещена.

*Данные*: все семь состояний FormField применимы; `ready` — значение разобрано, хранится
как Decimal и отформатировано по локали: `≈ 2.545 €/m² WFL nach WoFlV` (точное `2.545,22`,
фикстура `DEMO-SC-01`, `DEMO-RUN-0007`). Точность и правило округления варианта объявлены
рядом со значением (16.2), а не подразумеваются.

**FORM-002 — четыре обязательства:**
1. **Locale-aware paste.** Принимаются `1.250,50` (de-DE), `1 250,50`, `1250.5`, `1250,50`;
   разбор через явный парсер по текущей локали, а не `parseFloat`. Нераспознанное даёт
   `parseError` с примером формата, а не молчаливый `0`.
2. **Хранение — Decimal.** Внутреннее значение — десятичное с фиксированной точностью;
   `number` с плавающей точкой не используется (CALC-007: скрытое округление денег запрещено).
3. **Единица отделена от редактируемого значения.** `m²` / `€` / `%` — нередактируемый
   adornment и часть доступного имени; пользователь не может стереть единицу вводом.
4. **Форматирование не разрушает каретку.** Во время ввода группировка тысяч **не**
   применяется; форматирование происходит на `blur` и на программной установке значения.
   Позиция каретки сохраняется при любом программном изменении.

**Клавиатура:** `↑` / `↓` — шаг; `PageUp` / `PageDown` — крупный шаг; `Home` / `End`
**не перехватываются** — они двигают каретку внутри поля (KEY-003, ожидание пользователей
текстового ввода). Шаг и крупный шаг объявлены в helper. Одноклавишные шорткаты приложения
внутри поля не срабатывают (KEY-001).

**Screen reader:** нативный `textbox` с `inputmode="decimal"`. Если добавлены stepper-кнопки,
поле получает `role="spinbutton"` + `aria-valuenow` / `aria-valuemin` / `aria-valuemax` /
`aria-valuetext` (`≈ 2.545 €/m² WFL nach WoFlV` — точное `2.545,22`; фикстура `DEMO-SC-01`,
`DEMO-RUN-0007`). Префикс `≈` входит в озвучиваемый текст, потому что отображаемое значение
отличается от точного (CALC-007); `aria-valuenow` при этом несёт **точное** число, а не
округлённое. Пересчитанные зависимые значения объявляются **одним** сообщением
`aria-live="polite"` после завершения ввода, а не на каждый символ (gate 10).

**Токены:** токены FormField + `--font-numeric` (`tnum`, обязателен) ·
`--type-table-numeric-size/-line/-weight` (в табличном контексте) ·
`--color-data-changed` (пометка изменённого значения — вместе с текстом, не вместо) ·
`--color-data-uncertain` · `--motion-value-change`.

**Запреты:**
- `type="number"` со «спиннером» браузера как единственным способом ввода — колесо мыши
  меняет значение случайно;
- форматирование на каждый keystroke — FORM-002;
- единица внутри редактируемого значения — FORM-002;
- `0 €` вместо `auf Anfrage` / `Preis nicht ermittelt` при отсутствии расчётной базы —
  SCOPE-001;
- пропорциональные цифры в числовых полях — TYPE-006.

---

### Slider

**Закрывает:** SLIDER-001 · SLIDER-002 · MOTION-005 · gate 10

**Анатомия:** `label` (видимый) → `track` → `[rangeFill]` → `thumb` (квадратный) →
`minLabel` / `maxLabel` (видимые, с единицами) → **сопряжённый `NumericInput`** →
`helperText` (шаг) → `[currentValueReadout]`.

**Варианты:** `single`. Диапазон с двумя ползунками в v0.5 не входит: асимметричный интервал
показывается двумя раздельными полями (STATE-010).

**Состояния:**

*Взаимодействие*: `default` · `hover` (`--color-border-strong` на треке) ·
`focus` (глобальный ring вокруг `thumb`, целиком видимый — трек не обрезает его) ·
`pressed` / `dragging` (`--border-contrast-2px` на `thumb`) · `disabled` (с видимой причиной) ·
`readOnly` (значение показано, ползунок не двигается, `aria-readonly`) ·
`loading` — notApplicableReason: значение локально и доступно немедленно; асинхронен только
пересчёт последствия, он живёт в целевом блоке.

*Данные*: `ready` — значение задано, применено и показано текстом рядом с ползунком
(`3 % Rabatt`), сопряжённый `NumericInput` показывает то же число ·
`error` (значение не применилось — `calculationError`, ползунок возвращается
к последнему подтверждённому значению с видимым сообщением) · `permission` ·
`loading / empty / partial / stale` — notApplicableReason: слайдер задаёт значение, а не
отображает загруженные данные. `min`/`max`/`step` заданы контрактом, текущее значение известно
синхронно, поэтому загрузки, пустоты, неполноты и устаревания у него не бывает; эти состояния
принадлежат блоку последствия, который слайдер пересчитывает.

**SLIDER-001.** Слайдер **никогда** не единственный способ задать значение: рядом всегда
`NumericInput` с тем же значением, а `min` / `max` / `step` видимы подписями. Точное текущее
значение показано текстом всегда, а не только во время перетаскивания (R-05).

**SLIDER-002.** Квадратный `thumb` допустим (форма бренда). Визуальный размер `thumb` и толщина
трека токенами не заданы — **`[ADR-PENDING: нужны токены --size-slider-thumb-visual и
--size-slider-track-thickness]`**. Независимо от визуального размера, зона нажатия и фокуса
`thumb` — `--size-hit-target-default` через `.hit-target::before` (R-04).

**Клавиатура:** `←` / `↓` — −1 шаг; `→` / `↑` — +1 шаг; `PageDown` / `PageUp` — крупный шаг;
`Home` — `min`; `End` — `max`. Изменение с клавиатуры **коммитится** по `keyup` с задержкой
(дебаунс), чтобы удержание стрелки не запускало серию авторитетных пересчётов (MOTION-005).

**Screen reader:** `role="slider"` (нативный `<input type="range">`) + `aria-valuemin` /
`aria-valuemax` / `aria-valuenow` / `aria-valuetext` (`3 % Rabatt`, `≈ −115.000 € Auswirkung` —
фикстура `DEMO-SC-01`, `DEMO-RUN-0007`, точное `−114.535,05 €`; вывод спесимена см. ниже).
**Промежуточные тики при перетаскивании не объявляются** (gate 10): объявление —
`aria-live="polite"` один раз после `pointerup` / `keyup`-дебаунса. Последствие изменения
доступно текстом, а не только движением полосы (MOTION-004).

**Денежный спесимен слайдера скидки (CALC-007).** Фикстура `DEMO-SC-01`, `DEMO-RUN-0007`:
3 % берутся от **точного** итога `3.817.835,00`, а не от отображаемого `≈ 3.818.000 €`.
Точное воздействие — `114.535,05 €`; отображение округляется до 1.000 € и получает префикс
`≈`, поэтому в `aria-valuetext` стоит `≈ −115.000 € Auswirkung`. Раскрытие
`Gerundet auf 1.000 €; exakter Rechenwert −114.535,05 €` доступно постоянно у самого
значения, рядом со слайдером (CALC-007, DISCOUNT-001). Брать процент от уже округлённого
отображаемого числа запрещено — это ровно тот дефект, который CALC-007 описывает.

**Токены:** `--color-border-default` · `--color-border-strong` · `--border-contrast-2px` ·
`--color-surface-default` · `--color-surface-subtle` · `--color-text-primary` ·
`--type-label-size/-line/-weight` · `--type-helper-size/-line/-weight` ·
`--type-small-size/-line/-weight` · `--font-numeric` · `--size-hit-target-default` ·
`--space-2` · `--space-3` · `--motion-feedback` · `--motion-value-change` ·
`--color-focus-ring` · `--color-focus-separator` · `--border-width-focus`.

**Запреты:**
- слайдер без числового поля — SLIDER-001;
- точное значение только в тултипе во время drag — R-05, gate 8;
- анимация и авторитетный пересчёт на каждый тик — MOTION-005;
- объявление каждого промежуточного значения — gate 10;
- заливка `rangeFill` цветом `--color-brand-accent` — R-01;
- скруглённый `thumb` — правило бренда (квадрат допустим, SLIDER-002).

---

### Textarea

**Закрывает:** TEXTAREA-001 · TEXTAREA-002 · (совместно с SaveStatus — SAVE-001/002)

**Анатомия:** `<label for>` (видимый) → `instructionText` (helper, **не** `placeholder`) →
`<textarea>` → `characterCounter?` → `SaveStatus` → `[recoveryBanner]`.

**Варианты:** `note` (внутренняя заметка) · `emailBody` · `comment`.
Автоувеличение высоты по содержимому, без внутреннего скролла до предела высоты.

**Состояния:**

*Взаимодействие*: `default` · `hover` · `focus` · `disabled` (с причиной) ·
`readOnly` · `error` · `pressed` — notApplicableReason: текстовое поле активируется
установкой каретки, а не нажатием-удержанием; удерживаемого состояния у `<textarea>` нет
и утверждённого тона для него не существует (R-25) · `loading` — при загрузке
существующего черновика: Skeleton + `aria-busy`.

*Данные*: `ready` (текст загружен и синхронизирован — SaveStatus в состоянии
`Gespeichert um 14:32 Uhr (Europe/Berlin)`, `recoveryBanner` отсутствует) ·
`loading` · `empty` (пустое поле + инструкция в helper) ·
`partial` (черновик восстановлен из локального хранилища — баннер
`Nicht gespeicherter Entwurf wiederhergestellt · Stand 14:32 Uhr (Europe/Berlin)` с кнопками
`Entwurf übernehmen` / `Entwurf verwerfen`) · `stale` (удалённая версия новее локальной —
конфликт синхронизации, NOTE-003) · `error` · `permission`.

**TEXTAREA-002 — автосохранение и восстановление.** Состояния автосохранения — это **та же
машина**, что описана в контракте SaveStatus (`ungespeichert → wird gespeichert →
gespeichert um <Zeit> | offline | Fehler`), а не отдельный чип. Локальный черновик пишется
независимо от сервера; уход с экрана или закрытие панели не теряет ввод, а невосстановимая
потеря предупреждается заранее (NOTE-004). Синхронизация никогда молча не перезаписывает
более свежую удалённую версию (NOTE-003).

**Клавиатура:** `Tab` вставляет переход фокуса, **не** символ табуляции. `Enter` — перенос
строки, никогда не отправка. Одноклавишные шорткаты внутри поля не срабатывают (KEY-001).
`Esc` при открытой панели заметки закрывает панель только если нет несохранённых изменений;
иначе показывается подтверждение (KEY-002 — Esc закрывает верхний слой, но не уничтожает данные).

**Screen reader:** имя из `<label>`; инструкция — `aria-describedby`. Счётчик символов
объявляется на пороговых значениях, а не на каждый символ (gate 10). Статус сохранения
объявляется SaveStatus, а не самим полем.

**Токены:** токены FormField + `--measure-body-max` (мера читаемости) ·
`--type-body-size/-line/-weight` · `--space-3` · `--space-4`.

**Запреты:**
- инструкция только в `placeholder` — TEXTAREA-001;
- `placeholder` вместо `<label>` — TEXTAREA-001, NOTE-001;
- статус сохранения «декоративным чипом» без машины состояний — SAVE-001;
- `Gespeichert` до подтверждения сервером — SAVE-002, RELIABILITY-001;
- фиксированная ширина текстового контейнера — псевдолокализация +35 % (TYPE-012).

---

## 5. Раздел 7.4 — Tables и disclosure

### DataTable

**Закрывает:** TABLE-001 · TABLE-002 · TABLE-003 · TABLE-006 · TABLE-007 ·
(вместе с DisclosureRow — TABLE-004, TABLE-005)

**Анатомия:**
`scrollRegion [role="region" tabindex="0" aria-labelledby]` (`overflow-x: auto`) →
`<table>` → `<caption>` (видимая, называет объект и охват) → `<colgroup>` →
`<thead>` → `<tr>` → `<th scope="col">` (подпись + единица) →
`<tbody>` → `<tr>` → `<th scope="row">` + `<td class="numeric">` →
`<tfoot>` → строки `Zwischensumme der kalkulierten Positionen` и `Gesamt netto · <Declared Pricing Scope>`.
Над таблицей — панель управления: `Alle aufklappen` / `Alle zuklappen`, сортировка, плотность.

**Варианты:** `financial` (высота строки `--row-height-financial`) ·
`plain` (`--row-height`) · `hierarchical` (см. DisclosureRow) ·
`comparison` (несколько колонок вариантов, липкая колонка подписей строк).

**Состояния:**

*Взаимодействие*: `default` · `hover` (подсветка строки `--color-surface-subtle`;
несёт только аффорданс, никакой информации — R-05) ·
`focus` (глобальный ring на `scrollRegion` и на интерактивных элементах внутри) ·
`selected` (строка выбранного сравнения: `--border-selected` слева + текстовая пометка) ·
`disabled` — notApplicableReason: строка данных не является контролом ·
`pressed` — notApplicableReason: строка не активируется нажатием-удержанием; нажимаются
только контролы внутри неё (кнопка раскрытия, сортировка, ссылка), и удерживаемое состояние
принадлежит им, а не `<tr>` · `loading` — Skeleton строк известной геометрии,
`aria-busy="true"` на `scrollRegion`, максимум 2 с, дальше content или error (SKELETON-003).

*Данные*: `ready` (все позиции охвата рассчитаны, `<tfoot>` несёт
`Zwischensumme der kalkulierten Positionen ≈ 3.818.000 €` — точное `3.817.835,00`;
фикстура `DEMO-SC-01`, `DEMO-RUN-0007`) · `loading` ·
`empty` (`Keine Positionen im gewählten Umfang` + действие) ·
`partial` (часть позиций без цены: ячейка `auf Anfrage`, итог понижается до
`Zwischensumme der kalkulierten Positionen` — R-18) ·
`stale` (`Veraltet · Stand 04.08.2026` бейджем у заголовка; для клиентских выдач блокировано) ·
`error` (`Kalkulation nicht abrufbar · erneut versuchen`) · `permission`.

**TABLE-001.** Только семантическая разметка: `<table>`, `<caption>`, `<th scope>`.
Порядок линеаризованного чтения предсказуем: заголовок строки → значения слева направо.
Разметка «таблица из `<div>`» запрещена (gate 12).

**TABLE-002.** Числовые колонки — `text-align: right` и `--font-numeric` (`tnum`, `lnum`)
через класс `.numeric`; выравнивание по десятичному разделителю. Единица стоит **в заголовке
колонки** (`Kosten in €`, `Rate in €/m² WFL nach WoFlV`) и входит в доступное имя ячейки:
`≈ 2.545 €/m² WFL nach WoFlV` (точное `2.545,22`; фикстура `DEMO-SC-01`, `DEMO-RUN-0007`).
Префикс `≈` обязателен, потому что отображаемое отличается от точного (CALC-007), а раскрытие
`Gerundet auf 1 €/m²; exakter Rechenwert 2.545,22 €/m²` доступно у значения постоянно.
Знаменатель обязан совпадать с подписью — складывать надземную и подземную площадь под
подписью `oberirdisch` запрещено (DATA-001).

**DENSITY-007 — минимальные высоты строк.** Финансовые и табличные строки берут высоту из
`--row-height-financial` / `--row-height`, а `tokens.css` задаёт им в `Komfortabel` 52 px
и в `Kompakt` 44 px; уменьшать эти значения контракт не разрешает. Зона нажатия и фокуса
любого контрола внутри строки в **обеих** плотностях остаётся ≥ 44 × 44 px через
`.hit-target::before` (R-04), поэтому переход в `Kompakt` меняет высоту строки, но не цель
нажатия. Плотность — независимое пользовательское предпочтение и режимом не управляется
(DENSITY-001, LAYOUT-007).

**TABLE-003.** Липкий `<thead>` и липкая первая колонка через `position: sticky` с непрозрачным
фоном `--color-surface-default` и разделяющим бордером `--border-contrast-1px` — тень для
отделения не используется (бренд плоский). Горизонтально прокручивается **только**
`scrollRegion`; страница — никогда (gate 6). Регион получает `tabindex="0"` и `aria-labelledby`,
иначе он недостижим с клавиатуры.

**TABLE-006.** `Zwischensumme der kalkulierten Positionen` и `Gesamt netto · <Declared Pricing Scope>`
различаются структурно, а не оттенком:
`Zwischensumme der kalkulierten Positionen` — верхний бордер `--border-contrast-1px` +
`--type-table-header-weight`; `Gesamt netto · <Declared Pricing Scope>` — верхний бордер
`--border-contrast-2px` + `--type-label-weight` + собственная строка `<tfoot>`.
Усечённые подписи итога без названного Declared Pricing Scope запрещены (R-18, COPY-008);
дефектные формы здесь не цитируются, иначе правило валит собственную проверку.
Пояснительный суффикс (`ohne Grundstück`, `netto`,
`Preisstand 08/2026`) стоит **отдельной строкой** `small 14/20` под подписью итога, а не
приклеивается к числу в одной слабоконтрастной строке.
Точные подписи итогов (R-18 / COPY-008):
`Gesamt netto · Grundleistung All3` при завершённом авторитетном расчёте ·
`Zwischensumme der kalkulierten Positionen` при неполном ·
префикс `Vorschau ·` для preview-расчёта.

**TABLE-007.** Сортировка, фильтрация и приоритет колонок задокументированы в реестре.
Заголовок сортируемой колонки — `<th aria-sort="ascending|descending|none">` с кнопкой внутри.
После пересортировки фокус **остаётся на нажатой кнопке**; результат объявляется один раз:
`Nach Kosten absteigend sortiert · 24 Zeilen`. Живая пересортировка без действия пользователя
запрещена.

**Дельты в ячейках (R-19, TYPE-010):** ячейка изменения содержит знак, значение, единицу и
базу сравнения — `≈ +97.000 € gegenüber Variante Basis` (точное `+97.335,00 €`, `+2,55 %`;
фикстура `DEMO-SC-01`, `DEMO-RUN-0007 → DEMO-RUN-0009`). Дельта считается из точных Decimal
обоих расчётов и только затем округляется; вычитание уже округлённых отображаемых чисел
запрещено (CALC-007). Цвет и иконка —
вторичные признаки; `--color-data-changed` нейтральный, поэтому носитель — знак и текст.
Счёт числа (`--motion-value-change`) не скрывает итог: итоговое значение доступно в дереве
доступности сразу (MOTION-002, R-21).

**Клавиатура:** `Tab` входит в `scrollRegion`; стрелки прокручивают регион (нативно);
`Tab` внутри проходит только по интерактивным элементам (кнопки disclosure, сортировки,
ссылки) в порядке DOM. Навигации по ячейкам стрелками нет — `treegrid`/`grid` в v0.5
вне области (TABLE-004).

**Screen reader:** `<caption>` называет объект, охват и валюту:
`Kostengliederung nach DIN 276 · Haus A · Beträge netto in Euro`.
`<th scope="col">` / `<th scope="row">` обязательны. `scrollRegion` — `role="region"` с именем,
иначе прокручиваемая область не объявляется. Строка итога озвучивается полной подписью
включая Declared Pricing Scope. Числа читаются с единицей из заголовка.

**Токены:** `--border-hairline` · `--border-contrast-1px` · `--border-contrast-2px` ·
`--border-selected` · `--color-border-subtle` · `--color-border-default` ·
`--color-border-strong` · `--color-surface-default` · `--color-surface-subtle` ·
`--color-text-primary` · `--color-text-secondary` · `--color-data-changed` ·
`--color-data-uncertain` · `--type-table-header-size/-line/-weight` ·
`--type-table-body-size/-line/-weight` · `--type-table-numeric-size/-line/-weight` ·
`--type-delta-size/-line/-weight` · `--type-small-size/-line/-weight` ·
`--type-label-size/-line/-weight` · `--font-numeric` · `--row-height` ·
`--row-height-financial` · `--cell-pad-x` · `--cell-pad-y` · `--size-hit-target-default` ·
`--motion-value-change` · `--stagger-row`.

**Запреты:**
- таблица из `<div>` с `role="table"` вместо нативной разметки — TABLE-001, gate 12;
- зебра-заливка вместо hairline-бордеров — правило системы (`README` §3);
- горизонтальная прокрутка страницы вместо прокрутки региона — TABLE-003, gate 6;
- тень для отделения липкого заголовка — бренд без теней;
- различение итогов только цветом или только размером — TABLE-006, gate 7;
- `caption 12/16` для пояснения к итогу, исключения или источника — R-24, TYPE-004;
- `Gesamt netto` без названия Declared Pricing Scope — R-18, COPY-008;
- пропорциональные цифры и выравнивание чисел влево — TABLE-002, TYPE-006;
- перенос фокуса после пересортировки — TABLE-007.

---

### DisclosureRow

**Закрывает:** TABLE-004 · TABLE-005 · (DENSITY-003, DENSITY-004, LAYOUT-011)

**Анатомия:** `<tr>` → первая ячейка: `disclosureButton` (каретка + доступное имя) +
`levelIndicator` (отступ + скрытый текст `Ebene 2`) + `rowLabel` → числовые ячейки →
дочерние `<tr>` того же `<tbody>`, скрытые при свёрнутом состоянии.
Отдельно, над таблицей: `Alle aufklappen` / `Alle zuklappen` (DENSITY-004).

**Варианты:** `groupRow` (несёт агрегат) · `hiddenGroupsRow` (сводная строка
`12 weitere Gruppen ausgeblendet` — **всегда доступная кнопка раскрытия**, не `disabled`-строка;
TABLE-005).

**Состояния:**

*Взаимодействие*: `default` (collapsed) · `expanded` · `hover` (подсветка всей строки) ·
`focus` (ring на `disclosureButton`) · `disabled` — notApplicableReason: у строки без потомков
кнопки раскрытия просто нет; «серая нерабочая строка» запрещена (TABLE-005) ·
`pressed` — notApplicableReason: удерживаемое состояние принадлежит `disclosureButton`
как обычной кнопке, а не строке; отдельного тона для `<tr>` нет и вводить его без
утверждённого токена запрещено (R-25) · `loading` — при ленивой подгрузке потомков:
`aria-busy` на строке + Skeleton дочерних строк.

*Данные*: `ready` (агрегат группы рассчитан и совпадает с суммой её потомков —
`KG 300 Bauwerk – Baukonstruktionen ≈ 2.672.000 €`, точное `2.672.484,50`; фикстура
`DEMO-SC-01`, `DEMO-RUN-0007`) · `loading` · `empty` (группа без позиций — раскрывается
в строку `Keine Positionen in dieser Gruppe`) · `partial` · `stale` · `error` · `permission`
(группа скрыта по правам — видимая строка с причиной, не тихое исчезновение, R-16).

Отображаемые агрегаты групп в сумме **не обязаны** совпадать с отображаемым итогом: каждая
строка округляется независимо, и сверка идёт по точным Decimal (фикстура: точные
`2.672.484,50 + 839.923,70 + 305.426,80 = 3.817.835,00`, тогда как отображаемые дают
`3.817.000` при итоге `≈ 3.818.000 €`). Складывать округлённые строки и ожидать округлённый
итог запрещено — CALC-007.

**TABLE-004.** v0.5 использует семантическую таблицу + кнопки раскрытия + объявленный уровень
иерархии. **`treegrid` явно вне области** — навигация стрелками по ячейкам не реализуется.

**LAYOUT-011.** У строки есть **отдельная кнопка-каретка**. Клик по остальной площади строки
тоже раскрывает — но обработчик не срабатывает, если (а) в момент отпускания мыши есть
выделенный текст (`window.getSelection().toString()` не пуст) или (б) клик пришёлся в
интерактивный элемент ячейки (`stopPropagation`). Раскрытие по строке — удобство; носителем
контракта остаётся кнопка.

**Клавиатура:** `Tab` — на `disclosureButton`; `Enter` / `Space` — раскрытие/сворачивание.
Стрелки строку не раскрывают (это не `treegrid`, KEY-003). `Alle aufklappen` / `Alle zuklappen` —
обычные кнопки; после нажатия фокус остаётся на них, результат объявляется:
`Alle Gruppen aufgeklappt · 24 Zeilen sichtbar`.

**Screen reader:** `disclosureButton` — `aria-expanded="true|false"` + `aria-controls`
(идентификаторы дочерних строк). Доступное имя называет объект и уровень:
`KG 300 Bauwerk – Baukonstruktionen, Ebene 1, aufklappen`. Свёрнутые дочерние строки
**удалены** из порядка чтения и фокуса (не `visibility: hidden` поверх фокусируемых
элементов) — gate 14, PROJECT-005. Сводная строка скрытых групп объявляется как кнопка:
`12 weitere Gruppen einblenden`.

**Токены:** `--border-disclosure` · `--color-border-disclosure` · `--border-hairline` ·
`--color-surface-subtle` · `--color-text-primary` · `--type-table-body-size/-line/-weight` ·
`--type-table-header-size/-line/-weight` · `--space-3` · `--space-4` · `--size-icon-sm` ·
`--size-hit-target-default` · `--row-height` · `--row-height-financial` · `--cell-pad-x` ·
`--cell-pad-y` · `--motion-reveal` · `--stagger-row`.

**Запреты:**
- `role="treegrid"` — TABLE-004 (явно вне области v0.5);
- «серая нерабочая» строка вместо доступной кнопки раскрытия — TABLE-005;
- раскрытие только по каретке без клика по строке или только по строке без каретки —
  LAYOUT-011, README §6.3;
- перехват выделения текста кликом строки — LAYOUT-011;
- уровень иерархии только отступом без объявления — gate 14;
- `aria-expanded` без `aria-controls` и без реального удаления содержимого из порядка чтения —
  gate 14.

---

## 6. Раздел 7.5 — Cards, badges, chips и tooltips

### Card

**Закрывает:** CARD-001 · (LAYOUT-010, PROJECT-007)

**Анатомия:** `root <article>` → `primaryDestination` (**ровно один** `<a>` или `<button>`,
растянутый псевдоэлементом `::after` на площадь карточки) → `title` (блочный) →
`metaBlock` (блочные строки) → `statusArea` (Badge/Chip) → `secondaryActions`
(кнопки, `position: relative` + `z-index` выше растяжки, `stopPropagation`) →
`nonInteractiveArea` (текст, доступный для выделения; помечается в контракте явно).

**Варианты:** `navigational` (вся карточка ведёт к объекту) ·
`selectable` (выбор — делегируется RadioCardGroup / CheckboxCard, собственной семантики выбора
у Card нет) · `static` (без назначения; тогда `primaryDestination` отсутствует).

**Состояния:**

*Взаимодействие*: `default` (`--border-default`) · `hover` (`--color-surface-subtle`;
только аффорданс) · `focus` (ring рисуется вокруг **карточки** — `:focus-within`-обводка
недопустима как подмена: ring принадлежит фокусируемому элементу, а карточка получает
визуальную рамку производной от него) · `selected` (только в `selectable`:
`--border-selected` + ✓ + `aria-checked` на input) ·
`disabled` — notApplicableReason: карточка не отключается; недоступность выражается состоянием
`permission` с видимой причиной · `pressed` — notApplicableReason: нажимается не `<article>`,
а `primaryDestination` внутри него; удерживаемое состояние принадлежит этой ссылке или кнопке,
и дублировать его на контейнере значило бы дать два разных носителя одному событию ·
`loading` — Skeleton известной геометрии.

*Данные*: `ready` (объект загружен, `title`, `metaBlock` и `statusArea` заполнены —
например `Musterprojekt Nordfeld · Zwischensumme der kalkulierten Positionen ≈ 5.823.000 €`,
точное `5.822.936,00`; фикстура `DEMO-SC-01`, `DEMO-RUN-0012`) · `loading` · `empty` ·
`partial` · `stale` · `error` · `permission` — все семь применимы (PROJECT-006).

**CARD-001 — четыре обязательные декларации:**
1. **primary destination** — один и только один; его доступное имя = `title` карточки.
2. **secondary actions** — отдельные валидные focus stops, никогда не вложенные
   в `primaryDestination` (LAYOUT-010: «кнопка в кнопке» запрещена).
3. **selected state** — только через нативный input внутри, не через `role` на `<article>`.
4. **non-interactive areas** — перечислены; в них клик ничего не делает и выделение текста
   работает. Растянутая ссылка блокирует выделение текста на своей площади — поэтому
   `nonInteractiveArea` с текстом, который пользователь должен копировать (номера, даты),
   поднимается `z-index` над растяжкой.

**Клавиатура:** порядок фокуса: `primaryDestination` → `secondaryActions` слева направо.
Собственного `tabindex` у `<article>` нет (README §6.4). `Enter` активирует
`primaryDestination`; `Enter` / `Space` — кнопки внутри.

**Screen reader:** `<article>` с `aria-labelledby` на `title`. Статусы и метаданные читаются
как содержимое карточки. Срочность передаётся текстом и иконкой, не цветом:
`überfällig`, `morgen`, `blockiert` (PROJECT-002, gate 7), плюс абсолютные дата, время и
IANA-таймзона в деталях — `04.08.2026, 14:32 Uhr (Europe/Berlin)` (gate 19).

**Токены:** `--border-default` · `--border-selected` · `--border-hairline` ·
`--color-surface-default` · `--color-surface-subtle` · `--color-surface-selected` ·
`--color-text-primary` · `--color-text-secondary` · `--type-heading-3-size/-line` ·
`--type-heading-weight` · `--type-body-size/-line/-weight` ·
`--type-small-size/-line/-weight` · `--space-3` · `--space-4` · `--space-5` ·
`--size-hit-target-default` · `--motion-reveal` · `--enter-shift`.

**Запреты:**
- `onclick` на `<div>`/`<article>` вместо настоящего контрола — gate 3, README §6.1;
- вложенные интерактивные элементы внутри `primaryDestination` — LAYOUT-010;
- собственный `tabindex` у карточки при наличии внутренних контролов — README §6.4;
- скругления, тени, градиенты — правило бренда;
- слипшиеся инлайновые подписи (`<span>` подряд) — README §6.5, регрессия
  «PersonenaufzuginklusiveGK 5»: каждая подпись — блочный элемент;
- фиксированная ширина карточки — псевдолокализация +35 % (TYPE-012); ширины через `minmax()`.

---

### Badge

**Закрывает:** BADGE-001 · BADGE-002 · (STATE-002, STATE-007, TYPE-011)

**Анатомия:** `root <span>` → `icon` (`aria-hidden`) → `text`. Прямоугольник,
бордер 1 px, без заливки-акцента. Бейдж **никогда** не содержит кнопок, каретки и не
реагирует на hover.

**Варианты — по namespace (BADGE-001, STATE-002); смешивать семейства запрещено:**

| Namespace | Примеры подписей | Тип |
|---|---|---|
| `workflow` | `Neu` · `In Arbeit` · `Versendet` | `badge.status 14/20 Medium` |
| `dataQuality` | `Abgeleitet` · `Vom Kunden bestätigt` · `Nicht überprüft` | `badge.status` |
| `versionLifecycle` | `Veraltet · Stand 04.08.2026` · `Ersetzt` | `badge.status` |
| `delivery` | `Gesendet` · `Zugestellt` · `Unzustellbar` | `badge.status` |
| `severity` | `Konflikt` · `Blocker` · `Hinweis` | `badge.status` |
| `selection` | `Empfohlen` · `Pflicht` | `badge.status` |
| `metadata` | `PDF` · `Version 3` · `n = 16` | `badge.metadata 12/16 Medium` |

Каждое семейство в документации показано отдельной группой с легендой (SPECIMEN-005).

**Состояния:**

*Взаимодействие*: `default` — единственное. `hover` / `focus` / `pressed` / `disabled` /
`loading` — notApplicableReason: бейдж статичен и не является контролом; интерактивный
аналог — Chip (STATE-007).

*Данные*: `ready` — бейдж отрисован, его namespace и подпись определены
(`Vom Kunden bestätigt`, `n = 16`); это его обычное состояние ·
`stale` (бейдж сам выражает устаревание: `Veraltet · Stand 04.08.2026`) ·
`loading / empty / partial / error / permission` — notApplicableReason: бейдж показывает одно
уже вычисленное состояние соседнего объекта. Пока состояние неизвестно, бейджа просто нет —
он не рендерится «пустым» или «загружающимся», иначе сам стал бы источником неопределённости;
загрузка, пустота, неполнота, ошибка и отсутствие прав объявляются тем объектом, который
бейдж уточняет.

**BADGE-002.** Статус никогда не передаётся только цветом. Для `Konflikt`, `Fehler` и
дедлайнов иконка **и** текст обязательны; цвет — третий, вспомогательный признак
(`--color-status-error`, `--color-deadline-critical` — только как бордер/иконка, текст всегда
`--color-text-primary`). В forced-colors бейдж остаётся читаемым: несущий элемент — бордер
и текст, не заливка (gate 21).

**Клавиатура:** notApplicableReason — бейдж не фокусируем и не входит в порядок табуляции.

**Screen reader:** обычный текст в потоке. Если бейдж уточняет соседний объект, он связан
с ним `aria-describedby`, а не «висит» рядом. Иконка внутри — `aria-hidden="true"` (ICON-002).

**Токены:** `--border-hairline` · `--border-contrast-1px` · `--border-error` ·
`--border-warning` · `--color-border-subtle` · `--color-border-default` ·
`--color-status-error` · `--color-status-info` · `--color-status-success` ·
`--color-status-warning` · `--color-deadline-warning` · `--color-deadline-critical` ·
`--color-text-primary` · `--color-surface-default` · `--color-surface-subtle` ·
`--type-badge-status-size/-line/-weight` · `--type-badge-metadata-size/-line/-weight` ·
`--space-1` · `--space-2` · `--size-icon-sm`.

**Запреты:**
- `badge.metadata 12/16` для scope, source, assumption, exclusion, error, blocker и
  workflow-status — R-24, TYPE-011; для них минимум `badge.status 14/20 Medium`;
- вид кликабельного элемента (каретка, hover-тон, курсор-указатель) у статичного бейджа —
  BADGE-001, STATE-007;
- смешение namespace в одном ряду без легенды — BADGE-001, SPECIMEN-005;
- статус только цветом — BADGE-002, gate 7;
- `--color-brand-accent` как статусная заливка — R-01;
- цветной текст статуса на цветной заливке — контраст `--color-status-error` 3,64:1 (gate 1).

---

### Chip

**Закрывает:** CHIP-001 · (PROVENANCE-001…006, STATE-007)

**Анатомия:** `root <button aria-expanded>` → `layerIcons` (до пяти слоёв провенанса) →
`text` → `caret` ⟶ `popover` (`Herkunft`): `sourceLayer` · `derivationLayer` ·
`verificationLayer` · `conflictLayer` · `freshnessLayer` + ссылка на точную версию/страницу.

**Варианты:** `sourceChip` (провенанс значения) · `filterChip` (активный фильтр, с кнопкой
`Entfernen`) · `deltaChip` (изменение цены; текст по R-19).

**Состояния:**

*Взаимодействие*: `default` · `hover` (`--color-surface-subtle`) · `focus` · `pressed`
(во время открытия поповера — `aria-expanded="true"`) · `disabled` — notApplicableReason:
провенанс есть всегда, отсутствие источника — это тоже состояние (`Keine Quelle hinterlegt`) ·
`loading` — notApplicableReason: провенанс приходит вместе со значением.

*Данные*: `ready` (все пять слоёв провенанса известны и озвучены:
`Herkunft: Dokument, abgeleitet, vom Kunden bestätigt, kein Konflikt, Stand 04.08.2026`) ·
`partial` (часть слоёв неизвестна — слой показывается как `unbekannt`, не скрывается) ·
`stale` (`Veraltet · Stand 04.08.2026` — виден рядом со значением и обесценивает зависимую
выдачу, PROVENANCE-005) · `error` · `permission` (клиентская формулировка упрощает детали,
но не меняет правду о верификации и конфликте — PROVENANCE-007) ·
`loading` — notApplicableReason: провенанс приходит вместе со значением одним ответом;
чип, «догружающий» источник после числа, показал бы значение без его происхождения ·
`empty` — notApplicableReason: отсутствие источника — это не пустота, а содержательный
слой `Keine Quelle hinterlegt`, поэтому пустого чипа не существует.

**CHIP-001 — провенанс композитный, а не «один цвет из списка».** Пять слоёв показываются
одновременно и независимо: источник (`Dokument` / `Kunde` / `CRM` / `Annahme`), вывод
(`abgeleitet nach Regel v4`), верификация (`vom Kunden bestätigt`), конфликт
(`Konflikt mit Grundrisse_Muster_V2.pdf, Seite 12` — имя документа из синтетической библиотеки
фикстур, R-23), свежесть (`Stand 04.08.2026`). Детали открываются **явным
контролом** — сам чип является `<button>`; открытие по hover как единственный способ запрещено
(R-05, gate 8). Точки-индикаторы источника не являются единственным носителем: рядом текст
и иконка (COLOR-007, gate 7).

**Клавиатура:** `Tab` — вход; `Enter` / `Space` — открыть/закрыть поповер; `Esc` — закрыть
**только этот** поповер (верхний слой, KEY-002) и вернуть фокус на чип; `Tab` внутри поповера
циклится по его содержимому и закрывает поповер при выходе за его пределы.

**Screen reader:** `role="button"` + `aria-expanded` + `aria-controls` на поповере;
поповер — `role="dialog"` с `aria-label` `Herkunft des Werts` при наличии интерактивного
содержимого, иначе просто озвучиваемый блок. Доступное имя чипа перечисляет слои словами:
`Herkunft: Dokument, abgeleitet, vom Kunden bestätigt, Stand 04.08.2026`. Длинные подписи
источника сокращаются визуально, но идентичность (версия, страница) не теряется —
она остаётся в доступном имени и в поповере (PROVENANCE-006).

**Токены:** `--border-hairline` · `--border-contrast-1px` · `--color-border-subtle` ·
`--color-surface-default` · `--color-surface-subtle` · `--color-text-primary` ·
`--color-text-secondary` · `--color-data-uncertain` · `--color-data-changed` ·
`--type-small-size/-line/-weight` · `--type-delta-size/-line/-weight` ·
`--space-1` · `--space-2` · `--space-3` · `--size-icon-sm` · `--size-hit-target-default` ·
`--layer-popover` · `--motion-reveal` · `--enter-shift`.

**Запреты:**
- `caption 12/16` для подписи источника — R-24 (исправление DC-1: было 12 px Regular,
  стало `small 14/20`);
- один взаимоисключающий цвет как модель провенанса — PROVENANCE-001;
- открытие деталей только по hover — R-05, CHIP-001, gate 8;
- точка-индикатор без текста — COLOR-007, gate 7;
- неоднозначные даты `12-08` — PROVENANCE-003; только абсолютный формат локали;
- статичная подпись, оформленная как чип-кнопка — STATE-007.

---

### Tooltip

**Закрывает:** TOOLTIP-001 · (ICON-002, gate 8)

**Анатомия:** `trigger` — **явный** `<button>` с доступным именем (`Erläuterung anzeigen`)
или контрол, чьё имя уже видимо → `tip` (`role="tooltip"`) → `text` (одна-две фразы).
Стрелки-указателя нет (плоская геометрия).

**Варианты:** `infoTip` (по кнопке-«i») · `labelTip` (расшифровка icon-only контрола).

**Состояния:**

*Взаимодействие*: `default` (закрыт) · `open` (по hover **и** по focus **и** по tap) ·
`focus` (ring на триггере) · `hover` · `disabled` — notApplicableReason: тултип на
неактивном контроле решением не является (STATE-006), причина стоит текстом рядом ·
`pressed` — notApplicableReason: триггер тултипа открывает подсказку по наведению, фокусу
и tap, но сам ничего не фиксирует; удерживаемого состояния у него нет, а собственного тона
без утверждённого токена вводить нельзя (R-25) · `loading` / `error` — notApplicableReason:
содержимое тултипа статично и приходит из словаря локализации, поэтому загружаться и
не загрузиться оно не может.

*Данные*: `ready` — notApplicableReason наравне с остальными шестью
(`loading / empty / partial / stale / error / permission`): содержимое тултипа — статическая
строка словаря локализации, она есть всегда и не проходит через загрузку. «Готовности данных»
у неё не бывает, поэтому объявлять `ready` применимым значило бы утверждать, что у тултипа
есть данные. Любое значение, влияющее на решение (цена, площадь, срок, исключение), в тултипе
не живёт (R-05, gate 8).

**TOOLTIP-001 — четыре ограничения:**
1. Только **дополнительная** информация. Обязательная — в основном потоке.
2. Открывается по hover, по focus и по tap на явном триггере; hover не единственный путь.
3. Закрывается `Esc` (верхний слой), tap вне, уходом фокуса; остаётся открытым, пока
   указатель движется к содержимому (безопасный треугольник).
4. **Не содержит интерактивных элементов** — ни ссылок, ни кнопок. Нужны действия или
   длинный текст → это Popover (Chip) или Dialog, а не Tooltip.

**Клавиатура:** `Tab` — на триггер, тултип открывается по фокусу. `Esc` закрывает только
верхний открытый слой (KEY-002) и не всплывает дальше. Внутрь тултипа фокус не заходит.

**Screen reader:** триггер несёт `aria-describedby` на `tip`, пока тултип открыт;
`role="tooltip"` на содержимом. Для icon-only контрола видимая расшифровка обязательна,
но смысл, влияющий на решение, дополнительно продублирован видимым текстом (ICON-002).

**Токены:** `--type-tooltip-size/-line/-weight` · `--color-text-inverse` ·
`--space-2` · `--space-3` · `--layer-tooltip` · `--motion-reveal` · `--size-icon-sm` ·
`--size-hit-target-default`.
Тёмная поверхность тултипа (`README` §3 — «поверхность black, текст white») токеном
не задана: **`[ADR-PENDING: нужен токен --color-surface-inverse]`**.
Максимальная ширина 320 px из `README` §3 — provisional и без токена:
**`[ADR-PENDING: нужен токен --size-tooltip-max-width]`**; до ADR ширина ограничивается
`min(<токен>, calc(100vw − 2 × var(--gutter-narrow)))`.
Задержка открытия по hover токеном не задана:
**`[ADR-PENDING: нужен токен --motion-delay-hover-preview]`** (200 мс для Geist-Vorschau
и 300 мс для тултипа — оба значения в прозе, ни одно не утверждено, R-25).

**Запреты:**
- обязательная информация, цена или последствие внутри тултипа — R-05, TOOLTIP-001, gate 8;
- кнопка или ссылка внутри тултипа — TOOLTIP-001;
- тултип на `disabled`-контроле как объяснение причины — STATE-006, gate 15;
- открытие только по hover (без focus и tap) — gate 8;
- `title`-атрибут вместо компонента — недоступен с клавиатуры и на touch.

---

## 7. Раздел 7.6 — Feedback, toast, dialog и save status

### Toast

**Закрывает:** FEEDBACK-001 · (DC-29 Undo, R-10, KEY-002)

**Анатомия:** `region [role="region" aria-label="Benachrichtigungen"]` (нижний левый угол —
правая сторона занята панелью цены) → `toast` → `statusBorderLeft` → `icon` (`aria-hidden`) →
`text` (причина + следствие) → `[actionButton]` (`Rückgängig`) → `closeButton`
(`Benachrichtigung schließen`).

**Варианты:** `info` · `success` · `error` · `undo`.

**Состояния:**

*Взаимодействие*: `default` · `hover` (таймер автозакрытия ставится на паузу) ·
`focus` (внутри тоста таймер на паузе, пока фокус внутри) · `pressed` (кнопка внутри) ·
`disabled` — notApplicableReason: тост не является контролом и целиком не отключается;
недоступное действие внутри него (например `Rückgängig` после истечения окна отмены)
не рендерится вовсе, а не показывается серым — иначе отключённая кнопка объясняла бы
предусловие, что запрещает BUTTON-003 и gate 15 · `loading` — notApplicableReason: тост
сообщает о **завершившемся** результате; незавершённый процесс показывает indeterminate-
индикатор в том блоке, который его выполняет.

*Данные*: `ready` — тост показывает завершившийся результат целиком: причина, следствие
и, при наличии, `Rückgängig`:
`Rabatt auf 3 % geändert · Zwischensumme der kalkulierten Positionen ≈ 3.703.000 €`
(фикстура `DEMO-SC-01`, `DEMO-RUN-0007`); это его обычное состояние ·
`error` (тост сообщает об ошибке, но **не является** её единственным носителем) ·
`loading / empty / partial / stale / permission` — notApplicableReason: тост порождается уже
состоявшимся событием и несёт его текст. Незавершённого результата он не показывает (для
процесса есть indeterminate-индикатор в самом блоке), пустого тоста не существует, неполный
или устаревший результат сообщается inline-состоянием затронутого блока, а отказ по правам —
это состояние действия, а не уведомления о нём.

**FEEDBACK-001 — тост не единственный носитель.** Каждое сообщение тоста дублируется в
постоянном месте: результат изменения — записью журнала событий, ошибка — inline-состоянием
затронутого блока, отмена — доступным откатом из истории (R-10: transient Undo — это
дополнительный шорткат, а не механизм отката авторитетной конфигурации). Тост, исчезнувший
незамеченным, не может привести к потере информации.

**Тайминги.** Автозакрытие обычного тоста и тоста с `Rückgängig` — поведенческие пороги
без утверждённого значения: **`[ADR-PENDING: нужны токены --duration-toast-default и
--duration-toast-undo]`** (в прозе фигурируют 4 с и 8 с; R-25 запрещает считать их дефолтом).
До ADR тост не закрывается автоматически, если содержит действие, и закрывается по явному
`closeButton`.

**Клавиатура:** тост-регион стоит последним в DOM и достижим `Tab` без ловушки.
Фокус **не** переносится в тост автоматически (это прервало бы ввод). `Esc` закрывает тост
только когда фокус внутри него — тост не участвует в глобальном стеке `Esc` наравне
с модальными слоями (KEY-002). Порядок фокуса внутри: `actionButton` → `closeButton`.

**Screen reader:** контейнер — `aria-live="polite"` для `info` / `success` / `undo`
и `role="alert"` (assertive) только для `error`. Объявляется полный текст: причина и
следствие:
`Rabatt auf 3 % geändert · Zwischensumme der kalkulierten Positionen ≈ 3.703.000 €`
(фикстура `DEMO-SC-01`, `DEMO-RUN-0007`, точное `3.703.299,95 €`; вывод
спесимена см. ниже). Кнопка `Rückgängig` имеет самодостаточное имя:
`Änderung des Rabatts rückgängig machen`.

**Денежный спесимен тоста (CALC-007, DOCS-011).** Фикстура `DEMO-SC-01`, `DEMO-RUN-0007`:
3 % считаются от точного итога `3.817.835,00`, результат — точное `3.703.299,95 €`,
отображение — `≈ 3.703.000 €`. Шаг округления — **1.000 €**, он единственный санкционированный
для денег; округление до 100 € ни один нормативный документ не разрешает. Префикс `≈`
обязателен, потому что отображаемое отличается от точного. Раскрытие
`Gerundet auf 1.000 €; exakter Rechenwert 3.703.299,95 €` живёт постоянно у самого значения
в панели цены и в записи журнала, а не в исчезающем тосте (CALC-007 требует постоянной
доступности деталей, FEEDBACK-001 — постоянного носителя).
Label — `Zwischensumme der kalkulierten Positionen`, потому что KG 500 во всей фикстуре имеет coverage `unknown`
(R-18, CALC-006).

**Токены:** `--color-surface-default` · `--border-contrast-1px` · `--border-error` ·
`--color-status-error` · `--color-status-info` · `--color-status-success` ·
`--color-status-warning` · `--color-text-primary` · `--type-body-size/-line/-weight` ·
`--type-small-size/-line/-weight` · `--space-3` · `--space-4` · `--size-icon-md` ·
`--size-hit-target-default` · `--layer-toast` · `--motion-reveal` · `--motion-duration-fast` ·
`--enter-shift`.
Максимальная ширина тоста токеном не задана: **`[ADR-PENDING: нужен токен
--size-toast-max-width]`**.

**Запреты:**
- критическая информация только в тосте — FEEDBACK-001;
- тост как единственный путь восстановления — FEEDBACK-001, R-10;
- автоперенос фокуса в тост;
- `role="alert"` для нейтральных сообщений — gate 10 (лишняя навязчивость);
- перекрытие правой панели цены — тосты живут слева внизу;
- статус тоста только цветом полосы — gate 7 (иконка и текст обязательны).

---

### Dialog

**Закрывает:** FEEDBACK-002 · (SAFETY-001, LAYER-002, R-10)

**Анатомия:** `backdrop` → `dialog [role="dialog" aria-modal="true"]` → `title` (`<h2>`) →
`impactTable` (`Vorher` / `Nachher` по осям: Umfang · Preis · Termin · Betroffene Ausgaben) →
`consequenceText` → `[warningBlock]` → `actions`: `primary` (глагол + объект) + `secondary`
(`Abbrechen`) → `closeButton`.

**Варианты:** `confirmHighImpact` · `confirmDestructive` (только реальное удаление/отзыв) ·
`gate` (G6-Freigabe) · `informational`.

**Состояния:**

*Взаимодействие*: `default` · `focus` (внутри ловушки фокуса) · `pressed` (кнопки) ·
`loading` (подтверждение выполняется: primary в `loading`, повторная отправка блокирована,
диалог не закрывается до ответа) · `disabled` — только для primary при незакрытом блокере,
с видимой причиной · `hover` — на кнопках.

*Данные*: `ready` (все последствия рассчитаны: `impactTable` показывает `Vorher` / `Nachher`
по каждой оси, денежное последствие несёт знак, базу и префикс округления —
`≈ +97.000 € gegenüber Variante Basis`, точное `+97.335,00 €`; фикстура `DEMO-SC-01`,
`DEMO-RUN-0007 → DEMO-RUN-0009`; primary активен) · `loading` (расчёт последствий ещё идёт —
примерная сводка **не** показывается, показывается индикатор) · `partial` (часть последствий
не рассчитана — явная пометка, подтверждение остаётся возможным только если это допускает
policy) · `error` (`Änderung nicht übernommen · Ursache · erneut versuchen`) · `stale`
(конфигурация изменилась под диалогом — диалог перечитывает данные и требует повторного
подтверждения) · `permission` · `empty` — notApplicableReason: диалог открывается только
по конкретному изменению и всегда имеет предмет; «подтверждение ничего» не существует,
а отсутствие последствий — это состояние `partial` с явной пометкой, не пустота.

**FEEDBACK-002 — что обязан показать high-impact confirm:**
старое и новое значение, охват изменения (`Haus A` / `Gesamter Komplex`), денежное последствие
со знаком и базой (R-19), последствие для срока в точных единицах (`46 Kalendertage früher`,
— **дельта** срока показывается в днях, потому что разность двух величин, округлённых до половины месяца, теряет смысл; сама длительность при этом остаётся в месяцах по решению PO), и список затронутых выдач (`Client PDF`, `Client E-Mail`),
которые изменение обесценивает (STALE-001). Деструктивная визуальная семантика (красный бордер,
слово `löschen`) — **только** при реальной деструктивности; изменение конфигурации
деструктивным не оформляется.

**SAFETY-001.** Одной кнопки и исчезающего Undo недостаточно: подтверждённое изменение
создаёт новую VariantVersion, а откат всегда доступен из постоянной истории (R-10).
Диалог называет это прямо: `Diese Änderung erzeugt eine neue Version · Rücknahme über die Historie`.

**Клавиатура:** при открытии фокус переносится на `title` (или на первый интерактивный
элемент, если заголовок не фокусируем). Ловушка фокуса: `Tab` циклится внутри диалога.
`Esc` закрывает **верхний** диалог и возвращает фокус на элемент-инициатор (gate 3, KEY-002);
если внутри диалога есть несохранённые изменения — сначала подтверждение.
`Enter` активирует сфокусированную кнопку, но **не** назначается «умолчальному действию»
у необратимых операций.

**Screen reader:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (title) +
`aria-describedby` (`consequenceText`). Содержимое под диалогом получает `inert`.
`impactTable` — настоящая таблица с `<caption>` (gate 12). Числа читаются с единицей
и базой сравнения (R-19, TYPE-010).

**Токены:** `--color-surface-overlay` · `--color-surface-default` · `--border-contrast-2px` ·
`--border-error` · `--border-warning` · `--color-border-strong` · `--color-text-primary` ·
`--type-heading-2-size/-line` · `--type-heading-weight` · `--type-body-size/-line/-weight` ·
`--type-small-size/-line/-weight` · `--type-delta-size/-line/-weight` · `--font-numeric` ·
`--space-4` · `--space-5` · `--space-6` · `--content-max-width` · `--measure-body-max` ·
`--layer-dialog` · `--layer-dialog-backdrop` · `--motion-reveal` · `--enter-shift` ·
`--size-hit-target-default`.

**Запреты:**
- тень как средство отделения оверлея — LAYER-002 требует backdrop, бордер и ловушку фокуса,
  а бренд запрещает тени;
- деструктивное оформление обычного изменения — FEEDBACK-002;
- подтверждение необратимого действия по `Enter` без явного фокуса на кнопке;
- отсутствие возврата фокуса после закрытия — gate 3;
- модальное окно для того, что решается инлайн (README §3);
- `aria-hidden` на фоне вместо `inert` — фон остаётся достижим клавиатурой.

---

### SaveStatus

**Закрывает:** SAVE-001 · SAVE-002 · (RELIABILITY-001, STATE-004, gate 19)

**Анатомия:** `root` → `icon` (`aria-hidden`) → `stateText` → `[timestamp]` →
`[retryButton]` → скрытый `liveRegion`.
Это **машина состояний**, а не декоративный чип: у каждого состояния определены переходы,
побочные эффекты и политика повтора (STATE-004).

**Варианты:** `global` (шапка рабочей области) · `local` (у Textarea/поля).

**Состояния (SAVE-001 — точный перечень):**

| Состояние | Немецкая подпись | Вход | Побочный эффект | Выход |
|---|---|---|---|---|
| `unsaved` | `Ungespeichert` | изменение поля | локальный черновик записан | → `saving` по debounce или явному сохранению |
| `saving` | `Wird gespeichert …` | старт запроса | повторная отправка блокирована, идемпотентный ключ | → `saved` при подтверждённом commit; → `error`; → `offline` |
| `saved` | `Gespeichert um 14:32 Uhr (Europe/Berlin)` | **сервер подтвердил commit и вернул версию** | версия зафиксирована | → `unsaved` при новом изменении |
| `offline` | `Offline · Änderungen lokal gesichert` | сеть недоступна | очередь на отправку, черновик сохранён | → `saving` при восстановлении сети |
| `error` | `Fehler · erneut versuchen` + причина | сервер отверг или таймаут | черновик сохранён, кнопка `Erneut versuchen` активна | → `saving` по повтору |

*Взаимодействие*: `focus` / `hover` / `pressed` — только у `retryButton` в состоянии `error`;
в остальных состояниях компонент нефокусируем. `disabled` — notApplicableReason: единственный
контрол компонента, `retryButton`, существует только тогда, когда повтор возможен; если
повторять нечего, кнопка не рендерится вовсе. Отключённая кнопка повтора была бы
`disabled`-объяснением предусловия, что запрещает BUTTON-003 и gate 15.

*Данные*: `ready` (`saved` — сервер подтвердил commit и вернул версию, подпись
`Gespeichert um 14:32 Uhr (Europe/Berlin)`; это состояние `ready` оси данных, выраженное
машиной состояний SAVE-001) · `stale` (локальная версия старше удалённой — отдельное
состояние конфликта синхронизации, NOTE-003, не подменяется `error`) ·
`permission` (нет права на запись — `Keine Schreibberechtigung`, локальный черновик
не создаётся) · `loading / empty / partial` — notApplicableReason: компонент отображает
не данные, а исход их записи. Промежуточная фаза записи — это `saving` из таблицы SAVE-001,
а не `loading` оси данных; «пустого» и «неполного» сохранения не бывает: запись либо
подтверждена сервером, либо нет, и любое смягчение этой дихотомии нарушает
SAVE-002/RELIABILITY-001.

**SAVE-002 / RELIABILITY-001.** `Gespeichert` объявляется **только** после подтверждённого
сервером commit с возвращённым идентификатором версии. Оптимистичное «сохранено» запрещено.
Потеря сети во время `saving` переводит в `offline`, **никогда** в `saved`. Время в подписи —
абсолютное, с таймзоной (gate 19); относительная формулировка (`vor 2 Minuten`) допустима
только вместе с абсолютной в доступном имени.

**Клавиатура:** в состояниях `unsaved` / `saving` / `saved` / `offline` компонент не входит
в порядок табуляции. В `error` `retryButton` — обычная кнопка (`Tab`, `Enter`, `Space`).
Глобальный шорткат сохранения `Ctrl+S` / `Cmd+S` перехватывается и запускает `saving`
(перечислен в справке шорткатов, KEY-005).

**Screen reader:** `liveRegion` — `aria-live="polite"`, объявляет **только смену состояния**,
не прогресс; `error` дополнительно `role="alert"`. Объявления: `Wird gespeichert`,
`Gespeichert um 14:32 Uhr`, `Offline, Änderungen lokal gesichert`,
`Fehler beim Speichern, erneut versuchen`. Иконка `aria-hidden`; состояние всегда есть текстом
(gate 7).

**Токены:** `--color-text-primary` · `--color-text-secondary` · `--color-status-error` ·
`--color-status-success` · `--color-status-info` · `--color-status-warning` ·
`--type-small-size/-line/-weight` · `--type-badge-status-size/-line/-weight` ·
`--space-1` · `--space-2` · `--size-icon-sm` · `--size-hit-target-default` ·
`--motion-duration-fast`.

**Запреты:**
- `Gespeichert` без подтверждения сервера — SAVE-002, RELIABILITY-001;
- `Gespeichert` при отсутствии сети — RELIABILITY-001;
- статус только цветной точкой — gate 7, NOTE-007;
- `caption 12/16` для статуса — R-24, TYPE-011;
- относительное время без абсолютного и таймзоны — gate 19;
- объявление каждого нажатия клавиши через `aria-live` — gate 10;
- молчаливая перезапись более свежей удалённой версии — NOTE-003.

---

## 8. Раздел 7.7 — Keyboard shortcuts

### KeyboardShortcutService

**Закрывает:** KEY-001 · KEY-002 · KEY-003 · KEY-006 · (gate 4)

**Анатомия:** это не визуальный компонент, а сервис с четырьмя частями:
`registry` (список зарегистрированных сочетаний со scope) · `guard` (условия срабатывания) ·
`layerStack` (LIFO-стек закрываемых слоёв для `Esc`) · `settingsToggle`
(`Einzeltasten-Kurzbefehle` в настройках, глобальное вкл/выкл).

**Варианты scope:** `global` · `screen` · `widget` (внутри композитного контрола).
У каждой записи реестра — scope, условие доступности и видимый эквивалент-контрол.

**Состояния:**

*Взаимодействие*: `enabled` · `disabledByUserSetting` (`Einzeltasten-Kurzbefehle` выключены —
многоклавишные сочетания продолжают работать) · `suppressedWhileTyping` (фокус в
`input`, `textarea`, `select`, `[contenteditable]` или открыт composition-режим IME).
`hover` / `focus` / `pressed` / `loading` / `error` — notApplicableReason: у сервиса нет
визуального представления; его состояние видно в справке и в настройках.

*Данные*: `ready` и все остальные шесть (`loading / empty / partial / stale / error /
permission`) — notApplicableReason по одной и той же причине: реестр сочетаний задан
контрактом на этапе сборки, а не загружается. Он существует целиком с первого кадра, поэтому
у него нет ни загрузки, ни пустоты, ни неполноты, ни устаревания, ни ошибки выборки, ни
разграничения прав — и «готовности данных» тоже нет: объявить `ready` применимым значило бы
приписать сервису данные, которых у него не бывает. Доступность конкретного сочетания
выражается осью взаимодействия (`enabled` / `disabledByUserSetting` /
`suppressedWhileTyping`), а результат его срабатывания — состоянием того компонента,
который изменился.

**KEY-001.** Одноклавишные шорткаты не срабатывают при вводе. Проверка — по цели события
(`event.target`) и по признаку `isComposing`; не срабатывают также при зажатом модификаторе.
В настройках есть глобальный переключатель `Einzeltasten-Kurzbefehle` (gate 4).
**Переназначение клавиш вне области v0.5 и в интерфейсе не рекламируется.**

**KEY-002.** `Esc` закрывает **только верхний** закрываемый слой из `layerStack`
(поповер → диалог → тур), а не «каждый оверлей». Событие не всплывает дальше первого
обработчика. Тост в стек не входит, пока фокус вне его.

**KEY-003.** Стрелки меняют выбор только когда фокус внутри соответствующего композита
(`tablist`, radiogroup, slider). Вне композита стрелки прокручивают страницу.
`Space` активирует только сфокусированный контрол и не ломает прокрутку, когда контрол
не сфокусирован.

**KEY-006 — `/`.** Регистрируется **только** если на экране есть видимый подписанный контрол
поиска. Шорткат переводит фокус на него и объявляет его подпись; при вводе не срабатывает.
Если поиск не входит в v0.5 — шорткат **и строка в справке удаляются**, а не оставляются
неработающими.

**Совместимость со средствами доступности (обязательная часть контракта):**
- ни одно действие не доступно **только** по шорткату: у каждой записи реестра есть видимый
  контрол-эквивалент. В browse-режиме NVDA/JAWS одиночные буквы перехватываются экранным
  диктором и до приложения не доходят — приложение на них не полагается;
- запрещено регистрировать `Ctrl+Alt+<клавиша>`: на немецкой раскладке это `AltGr`
  и ломает ввод `@`, `€`, `~`, `\`;
- запрещено регистрировать `Ctrl+Option+<клавиша>` (клавиши-модификаторы VoiceOver) и
  `Caps Lock`-сочетания (NVDA/JAWS);
- не переопределяются `Tab`, `Shift+Tab`, `Enter`, `Space`, `Home`, `End`, `F6`,
  а также браузерные `Ctrl/Cmd+F`, `Ctrl/Cmd+P`, `Ctrl/Cmd+плюс/минус`;
- `Ctrl/Cmd+Z` — отмена последнего действия (обратное событие журнала); работает и когда
  фокус в поле ввода, где отменяет ввод, а не действие приложения.

**Клавиатура (реестр v0.5):**

| Сочетание | Scope | Действие | Видимый эквивалент |
|---|---|---|---|
| `?` | global | открыть справку по шорткатам | кнопка `Tastaturkürzel` |
| `Esc` | topmost layer | закрыть верхний слой | кнопка закрытия слоя |
| `Ctrl/Cmd+S` | screen | сохранить | SaveStatus |
| `Ctrl/Cmd+Z` | screen | отменить последнее действие | кнопка `Rückgängig` в журнале |
| `←` `→` `Home` `End` | widget | перемещение в `tablist` | сами табы |
| `←` `↑` `→` `↓` `Home` `End` | widget | выбор в radiogroup / slider | сами контролы |
| `/` | global, **условно** | фокус в поиск | видимое поле поиска |

**Screen reader:** сервис ничего не объявляет сам. Результат шортката объявляется тем
компонентом, который изменился (фокус, `aria-live` целевого блока). Справка перечисляет
сочетания текстом, а не только глифами.

**Токены:** `--type-kbd-size/-line/-weight` (в справке и подсказках) ·
`--color-surface-subtle` · `--border-hairline` · `--color-text-primary`.

**Запреты:**
- одноклавишный шорткат при вводе — KEY-001, gate 4;
- отсутствие глобального выключателя — KEY-001, gate 4;
- глобальный `Esc`, закрывающий сразу все слои — KEY-002;
- стрелки, меняющие таб при фокусе вне `tablist` — KEY-003;
- `/`, зарегистрированный без видимого поля поиска — KEY-006;
- реклама переназначения клавиш — KEY-001, gate 4;
- перехват сочетаний, зарезервированных экранным диктором и раскладкой — gate 4;
- действие, доступное **только** с клавиатуры и не имеющее видимого контрола — gate 3.

---

### ShortcutHelpDialog

**Закрывает:** KEY-004 · KEY-005

**Анатомия:** `Dialog` (наследует контракт выше) → `title` `Tastaturkürzel` →
`scopeGroups[]` (`Überall` · `Auf diesem Bildschirm` · `In Listen und Tabellen`) →
`shortcutRow[]` (`<kbd>` + описание) → `conflictsSection`
(`Bekannte Konflikte mit Screenreader-Tastenbefehlen`) →
`enableToggle` (`Einzeltasten-Kurzbefehle`) → `standardKeysSection`.

**Варианты:** один.

**Состояния:** обе оси наследуются от Dialog. По оси данных уточняются два состояния:

- `ready` — реестр сочетаний прочитан для текущего экрана, все три `scopeGroups` заполнены,
  раздел `conflictsSection` перечислен, `enableToggle` показывает действующее значение
  настройки `Einzeltasten-Kurzbefehle`;
- `partial` — если условный шорткат (`/`) не зарегистрирован на текущем экране, его строка
  **отсутствует**, а не показывается серой (KEY-006).

Остальные пять (`loading / empty / stale / error / permission`) — как у Dialog.

**KEY-004.** Открывается по `event.key === '?'` — именно по `key`, не по `code`:
на немецкой раскладке `?` = `Shift+ß`, на английской = `Shift+/`, и проверка по `code`
сломала бы одну из раскладок. Тестируется на обеих раскладках. Плюс видимая кнопка
`Tastaturkürzel` — шорткат не единственный путь. Отображаемое сочетание локализовано:
`Umschalt` вместо `Shift`, `Strg` вместо `Ctrl`, `Eingabe` вместо `Enter`.

**KEY-005 — обязательное содержимое:**
- **scope** каждого сочетания (где действует);
- **конфликты**: перечислены сочетания, которые перехватываются экранным диктором или
  браузером, с указанием видимой альтернативы;
- **включение/выключение**: переключатель `Einzeltasten-Kurzbefehle` прямо в диалоге;
- **стандартные клавиши**: `Eingabe` · `Pos 1` (`Home`) · `Ende` (`End`) ·
  `Strg+Z` / `Cmd+Z` · `Umschalt+Tab`.

**Клавиатура:** как у Dialog. `?` при открытом диалоге закрывает его (переключение).
Внутри — обычная навигация `Tab`; таблица сочетаний не является `grid`.

**Screen reader:** содержимое — настоящая таблица с `<caption>` и заголовками
`Tastenkombination` / `Funktion` / `Gültig in` (gate 12). Каждое сочетание в `<kbd>`
имеет читаемое имя словами, а не только символ: `Umschalt und Tab`.

**Токены:** токены Dialog + `--type-kbd-size/-line/-weight` · `--color-surface-subtle` ·
`--border-hairline` · `--type-table-header-size/-line/-weight` ·
`--type-table-body-size/-line/-weight`.

**Запреты:**
- определение `?` по `event.code` — KEY-004 (ломает немецкую раскладку);
- справка без раздела конфликтов и без переключателя — KEY-005;
- строка про `/` при отсутствии поиска — KEY-006;
- открытие только по шорткату без видимой кнопки — KEY-004;
- глифы `⇧`, `⌘` без текстовой расшифровки — gate 7.

---

## 9. Матрица покрытия раздела 7

| ID | Компонент | Статус |
|---|---|---|
| BUTTON-001 | Button | закрыт частично — `destructive` заблокирован ADR (§10 №3, см. §11 №1) |
| BUTTON-002 | Button | закрыт |
| BUTTON-003 | Button | закрыт |
| BUTTON-004 | Button | закрыт |
| LINK-001 | Link | закрыт (носитель — подчёркивание; цвет ссылки — ADR) |
| LINK-002 | Link · Button (download) | закрыт |
| TABS-001 | Tabs | закрыт |
| TABS-002 | Tabs (граница) · SegmentedControl | закрыт |
| TABS-003 | Tabs | закрыт |
| TABS-004 | Tabs | закрыт |
| RADIO-001 | RadioCardGroup | закрыт частично — размер чек-индикатора заблокирован ADR (§10 №10) |
| RADIO-002 | RadioCardGroup | закрыт |
| FORM-001 | FormField | закрыт |
| FORM-002 | NumericInput | закрыт |
| FORM-003 | FormField | закрыт |
| SLIDER-001 | Slider | закрыт |
| SLIDER-002 | Slider | закрыт частично — геометрия `thumb`/трека ADR |
| TEXTAREA-001 | Textarea · FormField | закрыт |
| TEXTAREA-002 | Textarea · SaveStatus | закрыт |
| TABLE-001 | DataTable | закрыт |
| TABLE-002 | DataTable | закрыт |
| TABLE-003 | DataTable | закрыт |
| TABLE-004 | DisclosureRow | закрыт |
| TABLE-005 | DisclosureRow | закрыт |
| TABLE-006 | DataTable | закрыт |
| TABLE-007 | DataTable | закрыт |
| CARD-001 | Card | закрыт |
| BADGE-001 | Badge | закрыт |
| BADGE-002 | Badge | закрыт |
| CHIP-001 | Chip | закрыт |
| TOOLTIP-001 | Tooltip | закрыт частично — поверхность, ширина и задержка ADR |
| FEEDBACK-001 | Toast | закрыт частично — длительности ADR |
| FEEDBACK-002 | Dialog | закрыт |
| SAVE-001 | SaveStatus | закрыт |
| SAVE-002 | SaveStatus | закрыт |
| KEY-001 | KeyboardShortcutService | закрыт |
| KEY-002 | KeyboardShortcutService | закрыт |
| KEY-003 | KeyboardShortcutService · Tabs | закрыт |
| KEY-004 | ShortcutHelpDialog | закрыт |
| KEY-005 | ShortcutHelpDialog | закрыт |
| KEY-006 | KeyboardShortcutService · ShortcutHelpDialog | закрыт |

Дополнительно закрыты требования из смежных разделов, без которых контракты примитивов
неполны: OPTION-002, OPTION-005, OPTION-008, OPTION-009, OPTION-010, DENSITY-002,
DENSITY-003, DENSITY-004, DENSITY-007, LAYOUT-008, LAYOUT-009, LAYOUT-010, LAYOUT-011,
STATE-001, STATE-002, STATE-003, STATE-005, STATE-006, STATE-007, ICON-002, ICON-003,
PROVENANCE-001, PROVENANCE-003, PROVENANCE-005, PROVENANCE-006, SKELETON-001, SKELETON-003,
TYPE-004, TYPE-006, TYPE-010, TYPE-011, TYPE-012, MOTION-002, MOTION-004, MOTION-005,
LOCALE-004, NOTE-001, NOTE-003, NOTE-004, NOTE-007, COPY-008.

**DENSITY-007 — где именно закрыт.** Контракт DataTable, абзац «DENSITY-007 — минимальные
высоты строк»: `--row-height-financial` / `--row-height` = 52 px в `Komfortabel` и 44 px
в `Kompakt` (значения из `tokens.css`, уменьшению не подлежат), зона нажатия и фокуса
в обеих плотностях ≥ 44 × 44 px через `.hit-target::before` (R-04). DisclosureRow берёт
те же два токена и наследует ограничение. Заявка на закрытие держится этим абзацем;
если абзац исчезнет, DENSITY-007 из списка выше обязан исчезнуть вместе с ним.

---

## 10. Требуемые новые токены `[ADR-PENDING]`

По R-25 и TOKEN-005 значение выбирает владелец дизайна в ADR; ни одно из перечисленного
не имеет значения по умолчанию. До утверждения зависимый компонент остаётся `experimental`.
Каждой записи нужны: точное значение, обоснование и предписанная верификация
(контраст — для цветов, collision test — для слоёв, geometry test — для размеров).

| # | Токен | Кому нужен | Требование, которое без него не закрывается | Верификация |
|---|---|---|---|---|
| 1 | `--color-action-secondary-pressed` | Button | BUTTON-001 требует `pressed` у **каждого** варианта; есть только `hover` | контраст ≥ 4,5:1 с `--color-action-secondary-text` |
| 2 | `--color-action-ghost-pressed` | Button | BUTTON-001 для варианта `ghost`; `hover` у `ghost` **не требует нового токена** — контракт Button назначает ему существующий `--color-action-secondary-hover` | контраст ≥ 4,5:1 |
| 3 | `--color-action-destructive-bg`, `-hover`, `-pressed`, `-text` | Button | BUTTON-001 (destructive для delete/revoke); `--color-status-error` даёт с белым 3,64:1 | контраст ≥ 4,5:1 для normal text |
| 4 | `--color-action-link-text` | Link | LINK-001 — ссылка должна быть узнаваема без hover; сейчас несёт только подчёркивание | контраст ≥ 4,5:1 к `--color-surface-default` и ≥ 3:1 к `--color-text-primary` |
| 5 | `--color-surface-inverse` (+ подтверждение пары с `--color-text-inverse`) | Tooltip, `kbd` | TOOLTIP-001 — тёмная поверхность тултипа описана в прозе `README` §3, токена нет | контраст ≥ 4,5:1 с `--color-text-inverse`; проверка forced-colors |
| 6 | `--size-tooltip-max-width` | Tooltip | TOOLTIP-001 + мера читаемости; 320 px в прозе не утверждены | reflow 320 px, zoom 200 % |
| 7 | `--size-toast-max-width` | Toast | FEEDBACK-001 — тост не должен перекрывать панель цены | reflow 320 px |
| 8 | `--motion-delay-hover-preview` | Tooltip, Geist-Vorschau | TOOLTIP-001, DC-28; в прозе фигурируют 300 мс и 200 мс — два разных неутверждённых значения | reduced-motion: задержка не превращается в единственный feedback |
| 9 | `--duration-toast-default`, `--duration-toast-undo` | Toast | FEEDBACK-001 + DC-29; 4 с / 8 с — поведенческие пороги без утверждения | тест: сообщение продублировано в постоянном месте |
| 10 | `--size-control-indicator` | RadioCardGroup, CheckboxCard, Switch | RADIO-001 / OPTION-008 — геометрия чек-круга и чек-квадрата; 18 px из `README` §3 вне шкалы и без утверждения (LAYOUT-002) | geometry test + hit-area 44 × 44 |
| 11 | `--size-slider-thumb-visual`, `--size-slider-track-thickness` | Slider | SLIDER-002 — «square thumb допускается», но размер не задан | geometry test + hit-area 44 × 44 + focus ring не обрезан |
| 12 | `--layer-presentation-banner` | оверлей режима презентации | LAYER-001 перечисляет **presentation banner** среди обязательных слоёв; в `tokens.css` его нет | collision test со всеми слоями |
| 13 | весь слой `component.*` (25 записей раздела 13) | все контракты | TOKEN-002 — компоненты обязаны ссылаться на component-алиасы; сейчас ссылаются на semantic напрямую | TOKEN-005: блокирует `beta`/`stable` для всех |

---

## 11. Открытые пробелы и разночтения — с владельцем и способом закрытия

> **Переклассифицировано, цикл 1 Batch 5a.** Прежняя редакция называла этот раздел
> «Открытые противоречия между правилами» и перечисляла семь мест, где норматив якобы
> противоречит сам себе. Аудитор проверил все семь по исходному тексту норматива:
> **ни одно не подтвердилось.** Квалификация «норматив противоречит сам себе» — это форма
> легитимации пропуска: у коллизии чужого документа нет ни владельца, ни срока, и пункт
> может стоять открытым бесконечно. Названный **пробелом неутверждённого токена** или
> **разночтением формулировки**, тот же пункт получает и то и другое. Содержательные решения
> ниже сохранены без изменений — изменилась только классификация и адрес закрытия.

Каждая запись имеет один из трёх типов:
**A — пробел токена** (значения нет в `tokens.css`, закрывается ADR из раздела 10; владелец —
владелец дизайн-системы) · **B — разночтение формулировки** (норматив выполним, требовалось
прочтение; закрывается здесь, владельца-снаружи нет) ·
**C — снято** (утверждение о конфликте было ошибочным).

**1. `destructive`-вариант Button — тип A, пробел токена.**
BUTTON-001 звучит так: «every button variant has default, hover, focus, pressed, loading and
disabled. Destructive variant существует **только** для delete/revoke actions». Это
**ограничение области применения** деструктивного варианта, а не предписание его построить.
Норматив сам с собой не спорит; отсутствует ровно одно — утверждённая цветовая пара.
Единственный «опасный» токен `--color-status-error` даёт с белым
текстом 3,64:1 при требуемых 4,5:1 (gate 1), а `--color-brand-accent` запрещён R-01.
**Решение (без изменений):** в v0.5 залитой деструктивной кнопки нет; деструктивное действие —
`secondary` + `--border-error` + подпись, называющая объект удаления, + подтверждение диалогом.
**Закрывается:** ADR №3 раздела 10 (`--color-action-destructive-bg/-hover/-pressed/-text`),
верификация — контраст ≥ 4,5:1. **Владелец:** владелец дизайн-системы.
**До ADR:** контракт Button остаётся `experimental`, статус BUTTON-001 в §9 — «закрыт частично».

**2. `--color-text-muted` / `--color-text-disabled` — тип A, пробел токена.**
Конфликта с гейтом здесь нет: COLOR-008 требует читаемости, gate 1 требует 4,5:1, оба говорят
одно и то же. Не проходят проверку **значения**, а не норматив:
Значения токенов дают 3,36:1 и 2,71:1 —
этих значений в нормативе нет, они введены реализацией и уже помечены `[ADR-PENDING]` в самом
`tokens.css`. Прежняя редакция признавала это в собственном тексте и всё равно
классифицировала пункт как коллизию норматива — так нельзя: признание источника значения
и обвинение норматива не могут стоять в одной записи.
**Решение (без изменений):** helper — `--color-text-secondary` (5,33:1); причина
недоступности — `--color-text-primary` отдельным блоком рядом, а не «серым текстом внутри
контрола». **Закрывается:** ADR на цветовую шкалу текста. **Владелец:** владелец
дизайн-системы. **До ADR:** оба токена запрещены для helper, error, статуса и любого текста,
несущего решение (§1.2).

**3. Носитель `checked` у checkbox/radio — тип C, снято; остаточное возражение — тип B.**
Утверждение прежней редакции о том, что `design-system/README.md` §3 предписывает для
`checked` бренд-оранжевую заливку, **не соответствует тексту README** — проверено по
источнику. Фактический абзац `Checkbox/Radio` в README §3 «Примитивы — краткие правила»
назначает при `checked` токен `--color-selection-border`, называет `checked` состоянием
выделения по R-03 и прямо оговаривает, что бренд-оранжевый здесь запрещён R-01, — то есть
предписывает ровно то же, что и контракты ниже. Расхождения между документами нет,
правка README не требуется, задача на неё отозвана.
**Остаётся другое, содержательное возражение — гейт 21:** заливка любого цвета не переживает
forced-colors, где фон подменяется системным. Поэтому решение контрактов RadioCardGroup /
CheckboxCard / SegmentedControl **остаётся прежним, но обосновано гейтом 21, а не конфликтом
документов**: носитель выбора — `--border-selected` (2 px `--color-selection-border`, 4,79:1)
+ видимая ✓ + `aria-checked`; `--color-surface-selected` только поддерживает и носителем
не является. **Закрывается:** проверкой forced-colors в релизном прогоне (gate 21, пункт
раздела 10 аудита «visual regression … forced-colors»). **Владелец:** контракты этого файла.

**4. Слово «оранжевый» в OPTION-002 — тип B, разночтение формулировки.**
R-01 запрещает конкретный примитив `#FD5E00`; R-03 предписывает для выделения
`--color-selection-border`, и это тоже оранжевый — `#C94700`. Оба правила выполнимы
одновременно, взаимоисключения нет. Расходится не норматив, а бытовое слово «оранжевый»,
покрывающее оба тона.
**Решение (без изменений):** в контрактах используется только токен, сырой hex не пишется;
`selected` несёт ✓ + `--border-selected`. **Закрывается:** этой записью — прочтение
зафиксировано. **Владелец:** контракты этого файла. Внешнего действия не требуется.

**5. Icon-only контрол и тултип — тип B, разночтение формулировки.**
ICON-002 читается целиком: «Icon-only control имеет programmatic accessible name и visible
tooltip; **decision-critical meaning дополнительно имеет visible text**». Оговорка стоит
в том же предложении, что и требование, — норматив сам разрешает случай, ради которого
прежняя редакция объявляла конфликт с R-05 и gate 8.
**Решение (без изменений):** icon-only разрешён только для действий, не несущих решения;
любой смысл, влияющий на решение, дублируется видимым текстом. **Закрывается:** этой записью.
**Владелец:** контракты Button и Tooltip.

**6. Тост и стек `Esc` — тип B, разночтение формулировки.**
KEY-002 ограничивает `Esc` верхним **закрываемым** слоем. Тост, вне которого находится фокус,
закрываемым слоем в этом смысле не является — он не удерживает взаимодействие и не перекрывает
путь к нижележащему диалогу. «Тост в стеке только пока фокус внутри него» — это **прямое
применение** KEY-002, а не его сужение; прежняя формулировка «формально это сужение KEY-002»
снята как неверная.
**Решение (без изменений):** тост входит в `layerStack` только пока фокус внутри тоста;
фокус в тост автоматически не переносится. **Закрывается:** этой записью.
**Владелец:** контракты Toast и KeyboardShortcutService.

**7. Несохранённое состояние формы при переключении таба — тип B, разночтение формулировки.**
R-10 требует, чтобы через Draft Revision → commit → VariantVersion шла мутация **авторитетного
входа**. Несохранённое локальное состояние формы авторитетным входом по определению
не является, поэтому TABS-003 и R-10 не сталкиваются. Прежняя редакция сама писала
«противоречия нет» и всё же держала пункт в списке противоречий.
**Решение (без изменений):** состояние хранится как Draft Revision; переключение таба
не создаёт VariantVersion и не запускает авторитетный расчёт.
**Остаётся требование доказательства:** связывание Draft Revision с контролом обязано быть
указано в реестре компонента (16.2) — без записи в реестре требование выполняется формально.
**Закрывается:** записью в машиночитаемом реестре компонентов (DOCS-014).
**Владелец:** владелец реестра компонентов.

**Сводка:** тип A — 2 записи (обе адресованы ADR раздела 10) · тип B — 4 записи (закрыты
прочтением здесь; одна из них, №7, дополнительно требует записи в реестре) · тип C — 1 запись
(снята). Записей без владельца и без способа закрытия в разделе не осталось.
