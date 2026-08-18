/**
 * Декларации состояний данных (правило 30, дефект 3 ревью № 13).
 *
 * Каждый компонент с данными объявляет пять состояний плюс две оси —
 * ЛИБО с названной причиной неприменимости: правило 30 разрешает второе
 * ровно в этой форме, и прототип-симулятор пользуется этим честно, а не
 * молча. Непроизводимость здесь — следствие архитектуры фикстур
 * (синхронный импорт, синхронная проекция), а не забытая ветка.
 *
 * Тест `data-states.test.ts` держит полноту: каждая декларация обязана
 * назвать все семь осей. Появление в прототипе реального источника данных
 * (API) делает причину ложной — и тогда падает не тест, а ревью Codex,
 * потому что причина перестала быть правдой. Это осознанная граница.
 */
import type { DataStateKind } from '../components/DataStates'

export type DataStateDecl =
  /** Ветка реализована — есть видимое состояние на экране. */
  | { status: 'implemented'; where: string }
  /** Ветка непроизводима в прототипе — причина обязана быть названа. */
  | { status: 'notApplicable'; reason: string }

const SYNC_FIXTURE = 'источник — синхронный импорт фикстуры: промежутка ' +
  'загрузки и сетевой ошибки не существует по построению'
const SYNC_PROJECTION = 'проекция пересчитывается синхронно при каждом ' +
  'событии журнала (M-4): устаревшее значение не существует по построению'

export const DATA_STATE_DECLARATIONS: Record<
  string, Record<DataStateKind, DataStateDecl>
> = {
  opportunityList: {
    loading: { status: 'notApplicable', reason: SYNC_FIXTURE },
    empty: { status: 'implemented', where: 'a3-empty-spec при пустом результате фильтров' },
    partial: { status: 'notApplicable', reason: 'фикстура одинаково полна для всех восьми записей списка (имя/статус/локация/owner/Termin-или-null/счётчики); флаг `worked` — служебная пометка объёма прототипа, не пользовательское состояние (решение 161c0b7b, TASK 03) и с картой не связан — полнота подготовки самой Opportunity показывается на уровне Project Card, не на уровне списка' },
    ready: { status: 'implemented', where: 'список карточек' },
    error: { status: 'notApplicable', reason: SYNC_FIXTURE },
    stale: { status: 'notApplicable', reason: 'список — константа модуля: источника, который мог бы измениться после чтения, не существует; устаревать нечему относительно чего' },
    permission: { status: 'notApplicable', reason: 'уровень выше конвейера: цены и внутренние ссылки здесь не существуют, режимной фильтрации нечего фильтровать' },
  },
  documentAnalysis: {
    loading: { status: 'implemented', where: 'running: a3-analysis-track + активная фаза' },
    empty: { status: 'notApplicable', reason: 'запуск без документов невозможен: анализ вызывается с фикстурным списком карточки' },
    partial: { status: 'implemented', where: 'cancelled: «Angehalten nach N von M Phasen», завершённые фазы сохранены' },
    ready: { status: 'implemented', where: 'протокол фаз + файлы со статусами' },
    error: { status: 'implemented', where: 'a3-analysis-error: нечитаемый файл — причина · последствие · средство' },
    stale: { status: 'notApplicable', reason: 'протокол показывает ПОСЛЕДНИЙ прогон и заменяется целиком при перезапуске: состояния «показано старое, есть новее» не возникает. Запрет перезаписи подтверждённых значений (D-08) — другое требование, к устареванию показа отношения не имеющее' },
    permission: { status: 'notApplicable', reason: 'анализ существует только на внутреннем уровне Opportunity — в презентации карточка не показывается' },
  },
  offerPanel: {
    loading: { status: 'notApplicable', reason: SYNC_PROJECTION },
    empty: { status: 'notApplicable', reason: 'проекция без единого здания невозможна по построению: последнее включённое здание не снимается (гейт стора)' },
    partial: { status: 'implemented', where: 'Zwischensumme der kalkulierten Positionen + причины неполноты (IncompleteReason)' },
    ready: { status: 'implemented', where: 'Gesamt netto при полном покрытии' },
    error: { status: 'notApplicable', reason: SYNC_PROJECTION },
    stale: { status: 'notApplicable', reason: SYNC_PROJECTION },
    permission: { status: 'implemented', where: 'präsentation: маржа, Δ-проценты, runRef отсутствуют в дереве (не скрыты стилем)' },
  },
  optionTiles: {
    loading: { status: 'notApplicable', reason: SYNC_FIXTURE },
    empty: { status: 'notApplicable', reason: 'группа без вариантов не существует в каталоге; зависимая группа с невыполненным условием скрыта вместе с ценой (isGroupActive)' },
    partial: { status: 'implemented', where: 'noBase: вариант без расчётной базы заблокирован с причиной' },
    ready: { status: 'implemented', where: 'плитки DC-40/DC-20 с ценой и статусом' },
    error: { status: 'notApplicable', reason: SYNC_FIXTURE },
    stale: { status: 'notApplicable', reason: SYNC_PROJECTION },
    permission: { status: 'implemented', where: 'gate: до подтверждения здания глава закрыта с причиной и следующим шагом' },
  },
  scheduleGantt: {
    loading: { status: 'notApplicable', reason: SYNC_FIXTURE },
    empty: { status: 'implemented', where: '«Keine Terminphasen im Modell» — не молчаливый null' },
    partial: { status: 'implemented', where: '«Termindaten unvollständig» при непригодном интервале дат' },
    ready: { status: 'implemented', where: 'полоса + таблица DC-19' },
    error: { status: 'notApplicable', reason: SYNC_FIXTURE },
    stale: { status: 'notApplicable', reason: 'даты приходят из ScheduleModel фикстуры и меняются только с ней' },
    permission: { status: 'implemented', where: 'provenance-строка с DEMO-идентификаторами — только интерн' },
  },
  vergleich: {
    loading: { status: 'notApplicable', reason: SYNC_PROJECTION },
    empty: { status: 'implemented', where: '«Noch keine Opportunity Option angelegt» с объяснением пути' },
    partial: { status: 'implemented', where: 'одна Option: сравнение с самой собой + CTA к созданию второй' },
    ready: { status: 'implemented', where: 'колонки созданных Options живым расчётом' },
    error: { status: 'notApplicable', reason: SYNC_PROJECTION },
    stale: { status: 'notApplicable', reason: 'колонки считаются из конфигураций Options на каждом рендере — второго набора чисел нет' },
    permission: { status: 'implemented', where: 'DEMO-SC-01 в заголовке — только интерн' },
  },
  export: {
    loading: { status: 'implemented', where: 'gesendet → zugestellt: индикация доставки без выдуманных процентов' },
    empty: { status: 'implemented', where: 'Anlagen: «keine — links auswählen»' },
    partial: { status: 'implemented', where: 'preflight с блокерами: причина + активный следующий шаг' },
    ready: { status: 'implemented', where: 'confirm с A4-превью пакета' },
    error: { status: 'notApplicable', reason: 'доставка симулируется таймером без ветки сбоя: выдуманная сетевая ошибка была бы симуляцией, выданной за реализацию' },
    stale: { status: 'implemented', where: 'после отправки: конфигурация, изменённая позже снапшота, помечается — клиент видит снимок, а не текущее состояние (M-3)' },
    permission: { status: 'implemented', where: 'интерн-идентификаторы прогона в recap — только интерн' },
  },
  internalNote: {
    loading: { status: 'notApplicable', reason: 'черновик живёт в сторе и рендерится синхронно: между «нет заметки» и «есть заметка» нет промежутка, который нужно объявлять' },
    empty: { status: 'implemented', where: 'чип «→ CRM · noch keine Änderungen» — пустота названа текстом, а не пустым полем (NOTE-007)' },
    partial: { status: 'implemented', where: 'чип «Entwurf, noch nicht gespeichert»: набрано, но пауза не истекла' },
    ready: { status: 'implemented', where: 'чип «✓ synchronisiert · HubSpot-Projektkarte»' },
    error: { status: 'notApplicable', reason: 'синк симулируется таймером без ветки сбоя; ветка `fehler` в типе объявлена и ждёт настоящего CRM — выдуманная сетевая ошибка была бы симуляцией, выданной за реализацию' },
    stale: { status: 'notApplicable', reason: 'поле и стор — один источник; расхождение «показано старое» возникло бы только при втором редакторе той же заметки, которого в прототипе нет (разрешение конфликтов NOTE-003 ждёт реального CRM)' },
    permission: { status: 'implemented', where: 'praesentation: компонент вместе со своей секцией не рендерится вовсе (NOTE-006)' },
  },
  clientOutputGate: {
    loading: { status: 'notApplicable', reason: 'чек-лист считается из проекции синхронно (M-4)' },
    empty: { status: 'notApplicable', reason: 'ворота без единого пункта не существуют: итог и интервал есть всегда' },
    partial: { status: 'implemented', where: 'блокеры перечислены отдельными строками, переход заблокирован с причиной' },
    ready: { status: 'implemented', where: 'все пункты ✓, кнопка «Kundenansicht starten» активна' },
    error: { status: 'notApplicable', reason: 'диалог не выполняет операций, которые могут не удаться: он показывает состояние и переключает режим' },
    stale: { status: 'notApplicable', reason: 'диалог читает проекцию в момент открытия и закрывается решением; жить дольше своего состояния он не может' },
    permission: { status: 'implemented', where: 'это и есть контроль прав: единственный путь во внешний профиль' },
  },
  guidedTour: {
    loading: { status: 'notApplicable', reason: 'тексты тура приходят из словаря локализации и через загрузку данных не проходят (контракт DC-14 называет это прямо)' },
    empty: { status: 'notApplicable', reason: 'тур собирается из непустого списка шагов; тура без шагов не существует — если ни одной цели нет на экране, тур не открывается' },
    partial: { status: 'notApplicable', reason: 'шаг либо имеет цель на экране, либо пропускается: половина шага не имеет смысла' },
    ready: { status: 'implemented', where: 'шаг с существующей целью: вырез на цели, карточка с текстом и «Weiter n/N»' },
    error: { status: 'notApplicable', reason: 'отсутствие цели — встроенная деградация, а не ошибка: шаг исключается при сборке тура, и тур продолжается' },
    stale: { status: 'notApplicable', reason: 'тур не отображает расчётных значений — устаревать нечему' },
    permission: { status: 'implemented', where: 'praesentation: ни тура, ни кнопки запуска не существует — тур объясняет инструмент, а не оффер' },
  },
  clientNotice: {
    loading: { status: 'notApplicable', reason: 'текст предупреждения известен в момент рендера: он выводится из состояния покрытия, а не загружается' },
    empty: { status: 'notApplicable', reason: 'точка появляется только когда есть что сообщить; нечего сообщать — значит точки нет (контракт DC-7 называет это прямо)' },
    partial: { status: 'notApplicable', reason: 'предупреждение либо есть, либо нет: половины у него не бывает' },
    ready: { status: 'implemented', where: 'свёрнутая точка с нейтральным текстом в поповере' },
    error: { status: 'notApplicable', reason: 'компонент ничего не выполняет — он показывает то, что уже вычислено' },
    stale: { status: 'notApplicable', reason: 'текст выводится из текущего состояния при каждом рендере' },
    permission: { status: 'implemented', where: 'существует ТОЛЬКО в клиентских профилях; во внутреннем пространстве вместо точки остаётся развёрнутый список причин' },
  },
  // Обзор готовности карточки Opportunity (второй экземпляр анатомии DC-13,
  // отклонение DS-GOV-EX-07). Декларация была написана прозой в самом
  // отклонении и не попадала в этот реестр — то есть требование правила 30
  // не проверялось машинно, а одно правило жило в двух местах. Формулировки
  // здесь — те же, что в DS-GOV-EX-07, и расходиться им нельзя.
  readinessOverview: {
    loading: { status: 'notApplicable', reason: 'состав стадий и их состояния выводятся синхронно из полей, уже прочитанных стором и фикстурой (wflConflict, projectParamsConfirmed, options, demo.documents): асинхронного чтения за обзором нет' },
    empty: { status: 'notApplicable', reason: 'набор стадий задан рабочим процессом статически — четыре стадии всегда (то же notApplicableReason, что у DC-13); Opportunity без стадий не существует' },
    partial: { status: 'notApplicable', reason: 'ни одно состояние стадии не считается асинхронно и не оценивается приблизительно, поэтому пометка «wird geprüft» недостижима: каждая стадия разрешается в том же рендере, что и карточка' },
    ready: { status: 'implemented', where: 'четыре стадии с определённым состоянием, каждое ТЕКСТОМ (STEP-002); ровно один шаг несёт aria-current="step" в каждом достижимом состоянии, включая терминальное' },
    error: { status: 'notApplicable', reason: 'обзор читает проверенные поля стора, а не ненадёжный источник; отказ, который существует выше, обрабатывается до рендера обзора: непроработанная Opportunity даёт карточку «im Prototyp nicht ausgearbeitet», неизвестный id — пустой регион' },
    stale: { status: 'notApplicable', reason: 'сознательно НЕ реализовано: STALE-001 не реализован во всём продукте, и пометка свежести, выдуманная в одном экране, обещала бы актуальность, которую продукт не может подтвердить' },
    permission: { status: 'notApplicable', reason: 'прототип не моделирует прав на отдельный шаг: все четыре стадии — внутренняя подготовка, а различие профилей действует на уровне экрана, поэтому у R-16 «показать с причиной, а не удалить» здесь нет триггера' },
  },
  printFlow: {
    loading: { status: 'notApplicable', reason: 'превью собирается из проекции синхронно; печать в прототипе не уходит на устройство и ждать нечего' },
    empty: { status: 'notApplicable', reason: 'печатать нечего невозможно: поток открывается из Option, у которой всегда есть итог' },
    partial: { status: 'implemented', where: 'пункты собственного preflight с «!» — печать клиентского профиля заблокирована, внутренний экспорт остаётся' },
    ready: { status: 'implemented', where: 'все пункты ✓, «Druckauftrag starten» активна' },
    error: { status: 'notApplicable', reason: 'отправки на устройство нет — выдуманная ошибка принтера была бы симуляцией, выданной за реализацию' },
    stale: { status: 'notApplicable', reason: 'превью читает проекцию в момент открытия и закрывается решением' },
    permission: { status: 'implemented', where: 'clientPrint блокируется собственным гейтом; internalExport остаётся с пометкой «Nur intern»' },
  },
}
