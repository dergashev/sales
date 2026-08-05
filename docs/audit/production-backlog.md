# Продакшн-бэклог аудита — припарковано до фазы кода

**Создан 05.08.2026.** Здесь 321 требований внешнего аудита, которые **не влияют на стабильность прототипа и на тест с sales**. Отнесены сюда по критерию из `prototype-gate.md`: ни одно не показывает клиенту неверное число, не утекает реальными данными и не создаёт тупика в потоке.

**Ни одно требование не отменено и не переформулировано.** ID сохранены дословно, приоритет и тип проверки сохранены, текст требования остаётся в `requirements-registry.md`. Изменилась **только фаза**.

## Почему это не срезание углов

Три причины, каждая проверяемая:

1. **129 требований имеют тип `SPEC`** — они закрываются прогоном кода, которого не существует. Их «закрытие» в документации было бы заявлением, а не объектом — ровно тем классом дефекта, за который аудит отклонял партии семь раз.
2. **171 требований имеют тип `OBS`** — «найдено наблюдением». Закрываются взглядом на артефакт; пока артефакта нет, закрывать нечего.
3. Гейт передачи (`prototype-gate.md`) не пускает проект в этап 7 с открытым `P0`, поэтому парковка ограничена по времени условием, а не памятью.

## Состав по типу проверки

| Тип | Требований | Что нужно для закрытия |
|---|---:|---|
| `SPEC` | 129 | прогон кода |
| `OBS` | 171 | взгляд на отгружаемый артефакт |
| `DOMAIN` | 15 | решение владельца домена |
| `OBS/SPEC` | 3 | и то и другое |
| `CALC` | 3 | пересчёт |

## Припарковано 05.08 по второй атаке Codex — 33 класса, проверяемых только в коде

Вторая независимая атака (`verdicts/codex-verify-reattack-260805.md`) дала **43 мутации, 0 поймано**. Число не является регрессом: задание намеренно целилось туда, где автор инструмента **сам объявил слепоту**, и запрещало повторять закрытые мутации. Порог «меньше пяти» был поставлен координатором неверно — он измеряет формулировку задания, а не состояние инструмента. **Порог имеет смысл только для набора, не нацеленного в известные пробелы.**

Из 43 закрывается десять: семантическая правда в документах, которые сборка читает как спецификацию, плюс два ложных срабатывания. Остальные **33 паркуются здесь**, и причина не в объёме работы:

| Класс | Мутаций | Почему проверяем только на этапе 5 |
|---|---:|---|
| Эффективный каскад CSS: specificity, порядок, `!important`, `@supports` | 8 | требует вычисления применённого значения, то есть работающей страницы |
| Составная геометрия: `transform`, clipping, `display: contents`, обрезка предком | 4 | минимум зоны нажатия нарушается **сочетанием** корректных свойств; композиция существует только в отрендеренном DOM |
| Логические свойства и shorthand: block/inline отступы, `inset`, `scroll-margin` | 4 | раскрытие shorthand имеет смысл против применённых стилей |
| ARIA: роль определяет допустимое состояние, обязательные IDREF, нативная семантика | 12 | наличие раздела «Screen reader» в контракте ничего не доказывает; доказывает дерево доступности |
| Модель фокуса: порядок обхода, единственность roving tab stop, trap, возврат фокуса | 3 | проверяется прогоном, не чтением |
| Существование scroll-контейнера как положительная обязанность | 2 | нужен отрендеренный элемент, а не запрет отдельных значений |

**Это не отсрочка по решению, а свойство требований.** Все 33 относятся к типам `OBS` и `SPEC`: первый закрывается взглядом на артефакт, второй прогоном кода. Пока не на что смотреть и нечего прогонять, класс непроверяем **в принципе** — попытка закрыть его сейчас дала бы заявление вместо объекта, то есть ровно тот дефект, за который аудит отклонял партии семь раз.

**На этапе 5 они становятся проверяемыми и там же закрываются** — уже против кода, а не против описания кода.

### Методологическая находка, которая переносится в фазу кода

Codex сформулировал точнее всех за сессию, и это стоит держать при написании тестов прототипа:

> Самопроверка, собранная из **найденных** дефектов, измеряет живость конкретных детекторов, а не покрытие. Единственная мера покрытия — независимый набор, придуманный **не автором инструмента**.

Числу `201/203` собственной самопроверки можно верить как отчёту об её реестре. Читать как «99 % дефектов ловятся» нельзя: независимый held-out набор на тех же обещанных границах дал **0/43**.

## Перенесено из этапа 5 решением PO 05.08 — задачи окружения

| Задача | Почему не в прототипе |
|---|---|
| Деплой в продакшн-окружение | выполняют девопсы All3 в своей среде |
| Пароль на публичный адрес | защищал публичный URL; локального публичного адреса не существует, требование не применяется |

Ни одна не является требованием аудита и ID не имеет — это операционные задачи, а не припаркованные требования. Записаны здесь, чтобы не потерялись при передаче.

**`SECURITY-001` этим не затронут:** он требует, чтобы клиентская проекция не содержала внутренних полей, и проверяется в самой проекции, а не в способе размещения. Остаётся в гейте прототипа.

## Полный список

| ID | Приоритет | Тип проверки |
|---|---|---|
| `ANALYSIS-001` | P1 | `OBS` |
| `ANALYSIS-002` | P1 | `OBS` |
| `ANALYSIS-003` | P1 | `SPEC` |
| `ANALYSIS-004` | P1 | `SPEC` |
| `ANALYSIS-005` | P1 | `SPEC` |
| `ANALYSIS-006` | P1 | `SPEC` |
| `ANALYSIS-007` | P1 | `SPEC` |
| `ARCH-001` | P1 | `SPEC` |
| `ARCH-002` | P1 | `SPEC` |
| `ARCH-003` | P1 | `SPEC` |
| `ARCH-004` | P1 | `SPEC` |
| `ARCH-005` | P1 | `SPEC` |
| `ASSUMP-001` | P1 | `OBS` |
| `ASSUMP-002` | P1 | `OBS` |
| `ASSUMP-003` | P1 | `OBS` |
| `ASSUMP-004` | P1 | `OBS` |
| `ASSUMP-005` | P1 | `OBS` |
| `ASSUMP-006` | P1 | `SPEC` |
| `BADGE-001` | P1 | `OBS` |
| `BADGE-002` | P1 | `OBS` |
| `BORDER-001` | P1 | `SPEC` |
| `BORDER-002` | P2 | `OBS` |
| `BRAND-001` | P1 | `SPEC` |
| `BRAND-002` | P1 | `SPEC` |
| `BRAND-003` | P1 | `SPEC` |
| `BRAND-004` | P2 | `SPEC` |
| `BUILDING-001` | P1 | `DOMAIN` |
| `BUILDING-002` | P1 | `OBS` |
| `BUILDING-003` | P1 | `OBS` |
| `BUILDING-004` | P1 | `OBS` |
| `BUILDING-005` | P1 | `OBS` |
| `BUILDING-006` | P1 | `OBS` |
| `BUILDING-007` | P1 | `SPEC` |
| `BUILDING-008` | P1 | `OBS` |
| `BUILDING-009` | P2 | `OBS` |
| `BUTTON-001` | P1 | `SPEC` |
| `BUTTON-002` | P1 | `SPEC` |
| `BUTTON-003` | P1 | `OBS` |
| `BUTTON-004` | P1 | `OBS` |
| `CARD-001` | P1 | `SPEC` |
| `CHANGE-001` | P1 | `DOMAIN` |
| `CHANGE-002` | P1 | `OBS` |
| `CHANGE-003` | P1 | `OBS` |
| `CHANGE-004` | P1 | `SPEC` |
| `CHANGE-005` | P1 | `SPEC` |
| `CHANGE-006` | P1 | `SPEC` |
| `CHANGE-007` | P1 | `SPEC` |
| `CHANGE-008` | P1 | `CALC` |
| `CHANGE-009` | P1 | `CALC` |
| `CHIP-001` | P1 | `OBS` |
| `COLOR-001` | P1 | `OBS` |
| `COLOR-002` | P1 | `OBS` |
| `COLOR-003` | P1 | `OBS` |
| `COLOR-004` | P1 | `OBS` |
| `COLOR-005` | P1 | `SPEC` |
| `COLOR-006` | P1 | `OBS` |
| `COLOR-007` | P1 | `OBS` |
| `COLOR-008` | P1 | `OBS` |
| `COLOR-009` | P1 | `SPEC` |
| `COLOR-010` | P1 | `SPEC` |
| `COLOR-011` | P2 | `SPEC` |
| `COMPLEX-001` | P1 | `OBS` |
| `COMPLEX-002` | P1 | `DOMAIN` |
| `COMPLEX-003` | P1 | `OBS` |
| `COMPLEX-004` | P1 | `OBS` |
| `COMPLEX-005` | P1 | `OBS` |
| `COMPLEX-006` | P1 | `OBS` |
| `COMPLEX-007` | P1 | `SPEC` |
| `COMPLEX-008` | P2 | `OBS` |
| `COPY-001` | P1 | `DOMAIN` |
| `COPY-002` | P1 | `OBS` |
| `COPY-003` | P1 | `OBS` |
| `COPY-004` | P1 | `OBS` |
| `COPY-005` | P1 | `OBS` |
| `COPY-006` | P1 | `OBS` |
| `COPY-007` | P1 | `OBS` |
| `COPY-008` | P1 | `OBS` |
| `COPY-009` | P1 | `OBS` |
| `COPY-010` | P1 | `OBS` |
| `COPY-011` | P1 | `OBS` |
| `COPY-012` | P1 | `SPEC` |
| `COPY-013` | P2 | `OBS` |
| `COPY-014` | P2 | `OBS` |
| `COPY-015` | P2 | `SPEC` |
| `DENSITY-001` | P1 | `OBS` |
| `DENSITY-002` | P1 | `OBS` |
| `DENSITY-003` | P1 | `OBS` |
| `DENSITY-004` | P1 | `OBS` |
| `DENSITY-005` | P1 | `SPEC` |
| `DENSITY-006` | P2 | `OBS` |
| `DENSITY-007` | P1 | `SPEC` |
| `DISCOUNT-001` | P1 | `OBS` |
| `DISCOUNT-002` | P1 | `OBS` |
| `DISCOUNT-003` | P1 | `DOMAIN` |
| `DISCOUNT-004` | P1 | `SPEC` |
| `DISCOUNT-005` | P1 | `SPEC` |
| `DISCOUNT-006` | P1 | `DOMAIN` |
| `DOCS-001` | P1 | `OBS` |
| `DOCS-002` | P1 | `OBS` |
| `DOCS-003` | P1 | `OBS` |
| `DOCS-004` | P1 | `OBS` |
| `DOCS-005` | P1 | `SPEC` |
| `DOCS-006` | P1 | `OBS` |
| `DOCS-007` | P1 | `OBS` |
| `DOCS-008` | P1 | `SPEC` |
| `DOCS-009` | P1 | `SPEC` |
| `DOCS-010` | P1 | `OBS` |
| `DOCS-011` | P1 | `SPEC` |
| `DOCS-012` | P1 | `SPEC` |
| `DOCS-013` | P2 | `OBS` |
| `DOCS-014` | P2 | `SPEC` |
| `DOCS-015` | P2 | `SPEC` |
| `DOCS-016` | P2 | `SPEC` |
| `DOCUMENT-001` | P1 | `OBS` |
| `DOCUMENT-002` | P1 | `OBS` |
| `DOCUMENT-003` | P1 | `OBS` |
| `DOCUMENT-004` | P1 | `OBS` |
| `DOCUMENT-005` | P1 | `OBS` |
| `DOCUMENT-006` | P1 | `SPEC` |
| `DOCUMENT-007` | P1 | `OBS` |
| `DOCUMENT-008` | P1 | `SPEC` |
| `DOCUMENT-009` | P1 | `SPEC` |
| `DOCUMENT-010` | P1 | `DOMAIN` |
| `DRIVER-001` | P1 | `OBS` |
| `DRIVER-002` | P1 | `OBS` |
| `DRIVER-003` | P1 | `OBS` |
| `DRIVER-004` | P1 | `OBS` |
| `DRIVER-005` | P1 | `OBS` |
| `DRIVER-006` | P1 | `OBS` |
| `DRIVER-007` | P1 | `DOMAIN` |
| `DRIVER-008` | P2 | `OBS` |
| `FACADE-002` | P1 | `OBS` |
| `FACADE-003` | P1 | `OBS` |
| `FACADE-004` | P1 | `OBS` |
| `FACADE-005` | P1 | `OBS` |
| `FACADE-006` | P1 | `OBS` |
| `FACADE-007` | P1 | `SPEC` |
| `FACADE-008` | P1 | `SPEC` |
| `FACADE-009` | P1 | `SPEC` |
| `FACADE-010` | P2 | `OBS` |
| `FEEDBACK-001` | P1 | `SPEC` |
| `FEEDBACK-002` | P1 | `SPEC` |
| `FORM-001` | P1 | `SPEC` |
| `FORM-002` | P1 | `SPEC` |
| `FORM-003` | P1 | `SPEC` |
| `GANTT-001` | P1 | `OBS` |
| `GANTT-002` | P1 | `OBS` |
| `GANTT-003` | P1 | `SPEC` |
| `GANTT-004` | P1 | `OBS` |
| `GANTT-005` | P1 | `OBS` |
| `GANTT-006` | P1 | `SPEC` |
| `GANTT-007` | P1 | `SPEC` |
| `GANTT-008` | P1 | `SPEC` |
| `ICON-001` | P1 | `OBS` |
| `ICON-002` | P1 | `SPEC` |
| `ICON-003` | P1 | `OBS` |
| `KEY-001` | P1 | `OBS/SPEC` |
| `KEY-002` | P1 | `OBS` |
| `KEY-003` | P1 | `OBS` |
| `KEY-004` | P1 | `SPEC` |
| `KEY-005` | P1 | `SPEC` |
| `KEY-006` | P1 | `OBS/SPEC` |
| `LAYER-001` | P1 | `SPEC` |
| `LAYER-002` | P1 | `SPEC` |
| `LAYOUT-001` | P1 | `OBS` |
| `LAYOUT-002` | P1 | `OBS` |
| `LAYOUT-003` | P1 | `SPEC` |
| `LAYOUT-004` | P1 | `OBS` |
| `LAYOUT-005` | P1 | `OBS` |
| `LAYOUT-006` | P1 | `OBS` |
| `LAYOUT-007` | P1 | `SPEC` |
| `LAYOUT-008` | P1 | `OBS` |
| `LAYOUT-009` | P1 | `SPEC` |
| `LAYOUT-010` | P1 | `OBS` |
| `LAYOUT-011` | P1 | `OBS` |
| `LAYOUT-012` | P1 | `OBS` |
| `LAYOUT-013` | P2 | `SPEC` |
| `LINK-001` | P1 | `OBS` |
| `LINK-002` | P1 | `SPEC` |
| `MOTION-001` | P1 | `SPEC` |
| `MOTION-002` | P1 | `OBS` |
| `MOTION-003` | P1 | `SPEC` |
| `MOTION-004` | P1 | `OBS` |
| `MOTION-005` | P1 | `SPEC` |
| `NAV-001` | P1 | `OBS` |
| `NAV-002` | P1 | `SPEC` |
| `NAV-003` | P1 | `SPEC` |
| `NAV-004` | P2 | `OBS` |
| `NAV-005` | P1 | `OBS/SPEC` |
| `NOTE-001` | P1 | `OBS` |
| `NOTE-002` | P1 | `SPEC` |
| `NOTE-003` | P1 | `SPEC` |
| `NOTE-004` | P1 | `SPEC` |
| `NOTE-005` | P1 | `SPEC` |
| `NOTE-006` | P1 | `DOMAIN` |
| `NOTE-007` | P2 | `OBS` |
| `OPTION-001` | P1 | `OBS` |
| `OPTION-002` | P1 | `OBS` |
| `OPTION-003` | P1 | `OBS` |
| `OPTION-004` | P1 | `OBS` |
| `OPTION-005` | P1 | `OBS` |
| `OPTION-006` | P1 | `SPEC` |
| `OPTION-007` | P1 | `SPEC` |
| `OPTION-008` | P1 | `SPEC` |
| `OPTION-009` | P1 | `OBS` |
| `OPTION-010` | P2 | `OBS` |
| `OPTION-011` | P1 | `CALC` |
| `PERF-001` | P1 | `SPEC` |
| `PERF-002` | P1 | `SPEC` |
| `PERF-003` | P1 | `SPEC` |
| `PERF-004` | P1 | `SPEC` |
| `PRINT-001` | P1 | `OBS` |
| `PRINT-002` | P1 | `SPEC` |
| `PROGRESS-001` | P1 | `OBS` |
| `PROGRESS-002` | P1 | `SPEC` |
| `PROGRESS-003` | P1 | `SPEC` |
| `PROJECT-001` | P1 | `OBS` |
| `PROJECT-002` | P1 | `OBS` |
| `PROJECT-003` | P1 | `OBS` |
| `PROJECT-004` | P1 | `OBS` |
| `PROJECT-005` | P1 | `OBS` |
| `PROJECT-006` | P1 | `SPEC` |
| `PROJECT-007` | P1 | `SPEC` |
| `PROJECT-008` | P2 | `OBS` |
| `PROVENANCE-001` | P1 | `OBS` |
| `PROVENANCE-002` | P1 | `OBS` |
| `PROVENANCE-003` | P1 | `OBS` |
| `PROVENANCE-004` | P1 | `OBS` |
| `PROVENANCE-005` | P1 | `OBS` |
| `PROVENANCE-006` | P1 | `SPEC` |
| `PROVENANCE-007` | P1 | `DOMAIN` |
| `QUESTION-001` | P1 | `OBS` |
| `QUESTION-002` | P1 | `OBS` |
| `QUESTION-003` | P1 | `OBS` |
| `QUESTION-004` | P1 | `OBS` |
| `QUESTION-005` | P1 | `DOMAIN` |
| `QUESTION-006` | P1 | `SPEC` |
| `QUESTION-007` | P1 | `SPEC` |
| `QUESTION-008` | P2 | `OBS` |
| `RADIO-001` | P1 | `SPEC` |
| `RADIO-002` | P1 | `SPEC` |
| `READY-001` | P1 | `OBS` |
| `READY-002` | P1 | `OBS` |
| `READY-003` | P1 | `OBS` |
| `READY-004` | P1 | `OBS` |
| `READY-005` | P1 | `DOMAIN` |
| `READY-006` | P2 | `OBS` |
| `RELIABILITY-001` | P1 | `SPEC` |
| `RELIABILITY-002` | P1 | `SPEC` |
| `RELIABILITY-003` | P1 | `SPEC` |
| `SAVE-001` | P1 | `OBS` |
| `SAVE-002` | P1 | `SPEC` |
| `SKELETON-001` | P1 | `SPEC` |
| `SKELETON-002` | P1 | `SPEC` |
| `SKELETON-003` | P1 | `SPEC` |
| `SKELETON-004` | P2 | `OBS` |
| `SLIDER-001` | P1 | `OBS` |
| `SLIDER-002` | P1 | `OBS` |
| `SPECIMEN-001` | P1 | `OBS` |
| `SPECIMEN-002` | P1 | `OBS` |
| `SPECIMEN-003` | P1 | `OBS` |
| `SPECIMEN-004` | P1 | `OBS` |
| `SPECIMEN-005` | P1 | `OBS` |
| `SPECIMEN-006` | P1 | `SPEC` |
| `SPECIMEN-007` | P1 | `DOMAIN` |
| `STATE-001` | P1 | `OBS` |
| `STATE-002` | P1 | `OBS` |
| `STATE-003` | P1 | `OBS` |
| `STATE-004` | P1 | `SPEC` |
| `STATE-005` | P1 | `OBS` |
| `STATE-006` | P1 | `OBS` |
| `STATE-007` | P1 | `OBS` |
| `STATE-008` | P1 | `SPEC` |
| `STATE-009` | P1 | `OBS` |
| `STATE-010` | P1 | `DOMAIN` |
| `STEP-001` | P1 | `OBS` |
| `STEP-002` | P1 | `OBS` |
| `STEP-003` | P1 | `OBS` |
| `STEP-004` | P1 | `OBS` |
| `STEP-005` | P1 | `SPEC` |
| `STEP-006` | P1 | `SPEC` |
| `STEP-007` | P1 | `SPEC` |
| `SUMMARY-001` | P1 | `OBS` |
| `SUMMARY-002` | P1 | `OBS` |
| `SUMMARY-003` | P1 | `OBS` |
| `SUMMARY-004` | P1 | `DOMAIN` |
| `SUMMARY-005` | P1 | `SPEC` |
| `SUMMARY-006` | P2 | `OBS` |
| `TABLE-001` | P1 | `SPEC` |
| `TABLE-002` | P1 | `SPEC` |
| `TABLE-003` | P1 | `SPEC` |
| `TABLE-004` | P1 | `OBS` |
| `TABLE-005` | P1 | `OBS` |
| `TABLE-006` | P1 | `OBS` |
| `TABLE-007` | P2 | `SPEC` |
| `TABS-001` | P1 | `SPEC` |
| `TABS-002` | P1 | `OBS` |
| `TABS-003` | P1 | `SPEC` |
| `TABS-004` | P1 | `SPEC` |
| `TEXTAREA-001` | P1 | `OBS` |
| `TEXTAREA-002` | P1 | `SPEC` |
| `TOKEN-001` | P1 | `SPEC` |
| `TOKEN-002` | P1 | `SPEC` |
| `TOKEN-003` | P1 | `SPEC` |
| `TOKEN-004` | P1 | `SPEC` |
| `TOKEN-005` | P1 | `SPEC` |
| `TOOLTIP-001` | P1 | `SPEC` |
| `TYPE-001` | P1 | `OBS` |
| `TYPE-002` | P1 | `OBS` |
| `TYPE-003` | P1 | `SPEC` |
| `TYPE-004` | P1 | `OBS` |
| `TYPE-005` | P1 | `OBS` |
| `TYPE-006` | P1 | `SPEC` |
| `TYPE-007` | P1 | `SPEC` |
| `TYPE-008` | P1 | `SPEC` |
| `TYPE-009` | P1 | `SPEC` |
| `TYPE-010` | P1 | `OBS` |
| `TYPE-011` | P1 | `OBS` |
| `TYPE-012` | P1 | `SPEC` |
| `TYPE-013` | P2 | `OBS` |
| `TYPE-014` | P2 | `SPEC` |

---

**Как возобновлять.** Реестр не читается целиком. После сборки прототипа один аудит **работающего** артефакта закрывает требования `OBS` пачками — это принципиально дешевле, чем девять аудитов документации по партиям, каждый из которых давал отклонение с первой сдачи.
