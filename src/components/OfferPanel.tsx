import { Fragment, useEffect, useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import { activeBuilding, useStore } from '../state/store'
import { CATALOG } from '../state/catalog'
import { splitKg300 } from '../engine/risk'
import derivedFx from '../fixtures/derived-prototype.json'
import {
  NNBSP, present, rateLabel, formatDE, DENOMINATOR_LABEL, label as moneyLabel,
} from '../engine/money'
import type { CostGroup, CoverageState, DriverBasis } from '../engine/calculate'
import { Button, useCountUp, useReducedMotion } from './primitives'
import { OriginPopover } from './OriginPopover'
import { ClientNotice } from './ClientNotice'
import { UncertaintyBand } from './UncertaintyBand'
import { useT, useTx } from '../i18n'

/**
 * Правая панель оффера — постоянная зона всего приложения.
 *
 * «Цена видна всегда» — механика продукта: клиент видит последствие каждого
 * решения немедленно, на каком бы экране ни шла работа. Токен ширины
 * `--panel-right-width` существует в дизайн-системе именно для этой панели.
 *
 * Состав по контрактам: три со-главных героя (DC-38: тотал 64 — единственный
 * оранжевый, ведущая ставка 48, Bauzeit 48 с абсолютной датой), интервал
 * (DC-3), зарезервированный слот дельта-чипа (DC-2 — появление не сдвигает
 * вёрстку), Kostentreiber (DC-44 — обязателен после каждой калькуляции,
 * правило 35), разбивка KG, гейт с причиной и следующим шагом (DC-33) и
 * журнал сессии с подписью DC-12.
 */

/**
 * Последний показанный дельта-чип — чтобы содержимое пережило гашение.
 *
 * Приёмка № 17 нашла чип НЕВИДИМЫМ: `.a3-show` ставился через
 * `requestAnimationFrame` после монтирования, а rAF не выполняется в
 * неактивной вкладке — чип оставался с `opacity: 0`. Класс состояния,
 * зависящий от кадра анимации, — это не «отложенный старт транзишна», а
 * условие, которого может не наступить.
 *
 * Правильная анатомия контракта DC-2 та же, что в витрине: элемент
 * `.a3-delta` живёт в слоте ПОСТОЯННО, а появление и уход — это класс
 * `.a3-show` на нём. Стартовое состояние существует, потому что элемент
 * существовал раньше класса; кадр анимации ни при чём. Содержимое
 * сохраняется на время ухода — иначе чип гас бы пустым.
 */
function useLastValue<T>(current: T | null): T | null {
  const [last, setLast] = useState<T | null>(current)
  useEffect(() => {
    if (current) setLast(current)
  }, [current])
  return current ?? last
}

/** Пометка выведенной величины — из данных, не из разметки (D-22). */
const MARK = derivedFx.marker

const KG_LABELS: Record<CostGroup, string> = {
  KG_100: 'Grundstück', KG_200: 'Vorbereitende Maßnahmen',
  KG_300: 'Baukonstruktion', KG_400: 'Technische Anlagen',
  KG_500: 'Außenanlagen', KG_600: 'Ausstattung',
  KG_700: 'Baunebenkosten', KG_800: 'Finanzierung',
}

const COVERAGE_SHORT: Record<CoverageState, string> = {
  included: 'enthalten', excluded: 'nicht enthalten',
  onRequest: 'auf Anfrage', unknown: 'noch offen', notApplicable: 'n. a.',
}

export function OfferPanel() {
  const s = useStore()
  const p = s.projection()
  const t = useT()
  const tx = useTx()
  const reduced = useReducedMotion()
  const [journalOpen, setJournalOpen] = useState(false)
  // Панель — сводка, центр — работа. Тяжёлые таблицы по умолчанию
  // свёрнуты до одной итоговой строки: они разворачиваются, когда нужны
  // как переговорный аргумент, а не занимают колонку постоянно.
  const [treiberOpen, setTreiberOpen] = useState(false)
  const [kgOpen, setKgOpen] = useState(false)
  const [kg300Open, setKg300Open] = useState(false)
  const clientScopeLabel = Object.values(s.buildings)
    .filter((building) => s.included[building.id]
      && (!s.scopeBuildingId || s.scopeBuildingId === building.id))
    .map((building) => building.stableName)
    .join(`${NNBSP}· `) || tx('Gebäude')
  // Правило 24: чип «долетает» до журнала — при уходе чипа журнал вспыхивает
  // один раз. Цветовой transition, не кейфрейм (правило 20); гаснет при
  // prefers-reduced-motion (правило 21).
  const [journalFlash, setJournalFlash] = useState(false)
  const prevDelta = useRef(s.activeDelta)

  useEffect(() => {
    if (!s.activeDelta) return
    const t = setTimeout(() => s.clearDelta(), 4000)
    return () => clearTimeout(t)
  }, [s.activeDelta])

  useEffect(() => {
    const was = prevDelta.current
    prevDelta.current = s.activeDelta
    if (was && !s.activeDelta && !reduced) {
      setJournalFlash(true)
      const t = setTimeout(() => setJournalFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [s.activeDelta, reduced])

  const totalCount = useCountUp(
    new Decimal(p.result.total.display.replace(/\./g, '')), 0,
  )
  const shownDelta = useLastValue(s.activeDelta)
  const shownPreview = useLastValue(s.preview)
  const blocked = !activeBuilding(s).gebaeudeklasse.confirmed

  // Сессионная дельта (DC-12, CALC-014): сумма точных дельт журнала —
  // undo несёт отрицание, поэтому простая сумма и есть «к базе», без
  // второго источника в виде запомненного базового итога.
  const ctxJournal = s.journal.filter((e) => e.optionId === s.activeOptionId)
  const sessionDelta = ctxJournal.reduce(
    (acc, e) => (e.deltaExact ? acc.plus(e.deltaExact) : acc),
    new Decimal(0),
  )
  // «übernommene Änderungen» — это изменения ЦЕНЫ, а не все события журнала.
  // Прежде считалась длина журнала, и отправка оффера увеличивала счётчик
  // изменения цены, ничего не изменив: подпись утверждала неправду о деньгах.
  const priceChangeCount = ctxJournal.filter((e) => e.deltaExact !== null).length

  // «Корзина»: вклады, рождённые РЕШЕНИЯМИ, — по признаку самого вклада,
  // а не по префиксу ключа. Приёмка № 17 показала цену догадки: фильтр по
  // `opt_/cov_/kg700_` пропускал выбор подвала, и панель говорила
  // «Standardumfang» при изменившейся сумме.
  const cart = p.result.drivers.filter((d) => d.origin === 'decision')
  const notIncluded = (Object.keys(s.coverage) as CostGroup[]).filter(
    (g) => ['unknown', 'onRequest', 'excluded'].includes(s.coverage[g]),
  )

  return (
    <aside
      aria-label="Angebot"
      className="flex h-full w-panel-right min-w-0 max-w-panel-right shrink-0 flex-col overflow-y-auto border-l border-border-strong bg-surface-default"
    >
      <div className="flex-1 px-5 py-5" aria-live="polite">
        {/* ── Герой №1: тотал — единственный оранжевый (DC-38) ───────────
            Кегли, цвет и выравнивание по базовой линии приходят из системы
            (`.a3-hb-total .a3-hb-num` = 64 px accent, `.a3-hb-unit` = 24 px):
            иерархия метрик принадлежит дизайну, а не этому файлу. */}
        {/* Герои — в ленте контракта (.a3-heroband): базовая линия и
            переносы принадлежат системе, не этому файлу (дефект 17). */}
        <div className="a3-heroband">
        <div className="a3-hb a3-hb-total">
          <span className="a3-hb-cap">{tx(p.result.totalLabel)}</span>
          <p className="a3-hb-num numeric">
            {p.result.total.prefix && (
              <span aria-hidden="true">{p.result.total.prefix}{NNBSP}</span>
            )}
            {totalCount}
            <span className="a3-hb-unit">{NNBSP}€</span>
          </p>
        {/* Интервал — полосой с денежными краями (DC-3): «± 22 %» отвечает
            «насколько точно», края отвечают «сколько это в деньгах», и на
            переговорах спрашивают второе. */}
        <div className="mt-2">
          <UncertaintyBand totalExact={p.result.total.exact} pp={p.uncertaintyPp} />
        </div>
        <p className="a3-cap mt-1">
          netto
          {' · '}
          {/* DC-21 moneyOrigin: цепочка драйверов + округление + runRef.
              Regionalfaktor в Herkunft — «deaktiviert» (правило 40). */}
          <OriginPopover
            rows={[
              ...p.result.drivers.map((d) => ({
                label: d.label,
                value: moneyLabel(present(d.exact)),
              })),
              ...(!s.regionalfaktorActive
                ? [{ label: 'Regionalfaktor', value: 'deaktiviert', muted: true }]
                : []),
              {
                label: 'Exakter Rechenwert',
                value: `${formatDE(p.result.total.exact, 2)}${NNBSP}€`,
                strong: true,
              },
            ]}
            rounding={p.result.total.disclosure}
            runRef={s.mode === 'intern'
              ? 'Regelsatz RS-2026.2 · DEMO-SC-01 · DEMO-RUN-0007 · authoritative · 04.08.2026'
              : null}
          />
        </p>
        </div>

        {/* ── Герои №2 и №3: ведущая ставка и срок, чёрные (DC-38) ─────── */}
        {/* Структура системы: ЧИСЛО в `.a3-hb-num`, единица в `.a3-hb-unit`,
            знаменатель в `.a3-hb-cap`. Прежде сюда клалась вся строка
            `≈ 2.545 €/m² WFL nach WoFlV` целиком — а `.a3-hb-num` несёт
            `white-space: nowrap`, и в флекс-строке минимальная ширина
            элемента равна min-content. Панель раздувалась далеко за свои
            400 px и съедала рабочую область. Дефект структурный: класс
            применён не к тому, для чего объявлен. */}
        <div className="a3-hb">
          <p className="a3-hb-num numeric">
            {p.leadRate.prefix && (
              <span aria-hidden="true">{p.leadRate.prefix}{NNBSP}</span>
            )}
            {p.leadRate.display}
            <span className="a3-hb-unit">{NNBSP}€/m²</span>
          </p>
          <span className="a3-hb-cap">{tx(p.leadRate.denominatorLabel)}</span>
        <p className="a3-cap numeric mt-1" style={{ overflowWrap: 'anywhere' }}>
          {rateLabel(p.secondaryRateBgf)} · {rateLabel(p.perUnit)}
          {' · '}
          {/* DC-21 rateOrigin: знаменатель называет норматив, деление показано. */}
          <OriginPopover
            rows={[
              {
                label: 'Zähler (Gesamt exakt)',
                value: `${formatDE(p.leadRate.numerator, 0)}${NNBSP}€`,
              },
              {
                label: `Nenner (${p.leadRate.denominatorLabel})`,
                value: `${formatDE(p.leadRate.denominator, 2)}${NNBSP}m²`,
              },
              {
                label: 'Quotient exakt',
                value: `${formatDE(p.leadRate.exact, 2)}${NNBSP}€/m²`,
                strong: true,
              },
            ]}
            rounding={p.leadRate.disclosure}
            runRef={s.mode === 'intern'
              ? 'Regelsatz RS-2026.2 · DEMO-SC-01 · DEMO-RUN-0007 · authoritative · 04.08.2026'
              : null}
          />
        </p>
        </div>

        <div className="a3-hb">
          <p className="a3-hb-num numeric">
            {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
            {p.duration.display.replace(`${NNBSP}Monate`, '')}
            <span className="a3-hb-unit">{NNBSP}Monate</span>
          </p>
          <span className="a3-hb-cap">
            ab OKBP · Fertigstellung {formatDate(p.duration.completionDate)}
            {' · '}
            {/* DC-21 durationOrigin: срок — такая же расчётная величина, как
                деньги, и обязан объяснять себя. Вариант поповера называет
                основание длительности и соглашение о границах интервала —
                «дни» и «рабочие дни» это разные числа. */}
            <OriginPopover
              rows={[
                { label: 'Modellwert exakt', value: p.duration.exactMonths
                    ? `${formatDE(p.duration.exactMonths, 4)}${NNBSP}Monate` : '—' },
                { label: 'Anzeigepolitik', value: p.duration.policy === 'halfMonthRounded'
                    ? 'auf halbe Monate gerundet' : 'ganze Kalendermonate' },
                { label: 'Dauergrundlage', value: 'Kalendertage' },
                { label: 'Fertigstellung', value: formatDate(p.duration.completionDate), strong: true },
              ]}
              rounding={p.duration.prefix
                ? `Anzeige weicht vom Modellwert ab; exakt ${
                    p.duration.exactMonths ? formatDE(p.duration.exactMonths, 4) : '—'}${NNBSP}Monate`
                : null}
              runRef={s.mode === 'intern'
                ? 'Bauzeit-Methodik · DEMO-SC-01 · Staffelstart aus ScheduleModel'
                : null}
            />
          </span>
        </div>
        </div>

        {/* Внутренние идентификаторы прогона — не для клиентской поверхности
            (MODE-001): в презентации отсутствуют, а не скрыты стилем. */}
        {s.mode === 'intern' && (
          <p className="mt-3 text-small text-text-muted">
            DEMO-SC-01 · DEMO-RUN-0007
          </p>
        )}

        {/* ── Слот призрака (DC-28) — СОБСТВЕННЫЙ, не общий с дельта-чипом.
            Анатомия контракта: префикс «Vorschau ·», будущее значение,
            дельта к названной базе, ссылка на прогон превью. Высота
            зарезервирована: появление призрака не двигает вёрстку. */}
        {/* Призрак — тот же приём, что у чипа: элемент постоянен, появление
            и уход несёт `.a3-show` контракта, а не framer-motion. Утилита
            паддинга снята: вид принадлежит системе (NO-VISUAL-UTILITY). */}
        <div className="a3-ghost-slot mt-3">
          <p className={'a3-ghost numeric' + (s.preview ? ' a3-show' : '')}
             aria-hidden={s.preview ? undefined : true}>
            {shownPreview && (<>
              {/* Три смысловые строки призрака — `.a3-ghost-line`
                  контракта: слот резервирует высоту самого высокого
                  состояния (решение TASK-22, вариант 2), и строки обязаны
                  быть объявлены, а не получаться из утилит. */}
              <span className="a3-ghost-line">
                {tx('Vorschau')} · {shownPreview.label}
              </span>
              <span className="a3-ghost-line">
                {shownPreview.futureTotal.prefix && (
                  <span aria-hidden="true">{shownPreview.futureTotal.prefix}{NNBSP}</span>
                )}
                {shownPreview.futureTotal.display}{NNBSP}€
                {s.mode === 'intern' && <>
                  {' · '}
                  {signed(shownPreview.deltaExact)}{NNBSP}gegenüber DEMO-VV-0003
                </>}
              </span>
              {/* Неполнота будущего прогона называется, а не подразумевается. */}
              {shownPreview.futureLabel !== 'Gesamt netto · Grundleistung All3' && (
                <span className="a3-ghost-line">
                  {tx('Vorschau')} · {shownPreview.futureLabel}
                </span>
              )}
              {s.mode === 'intern' && (
                <span className="a3-ghost-line">{shownPreview.contextRef}</span>
              )}
            </>)}
          </p>
        </div>

        {/* ── Слот дельта-чипа: зарезервирован, появление не двигает ────── */}
        {/* Чип живёт в слоте постоянно и ОДНОЙ строкой (`.a3-delta` —
            inline-flex витрины): двухстрочный распирал зарезервированную
            высоту слота и сдвигал вёрстку на 27 px — ровно то, против чего
            слот и существует (правило 24, приёмка № 17). */}
        {s.mode === 'intern' && <div className="a3-delta-slot mt-3">
          <p
            aria-hidden={s.activeDelta ? undefined : true}
            className={'a3-delta numeric' +
              (s.activeDelta ? ' a3-show' : '') +
              /* Ровно один класс направления (контракт DC-2). */
              (shownDelta?.deltaExact.isNegative() ? ' a3-saving' : ' a3-cost')}
          >
            {shownDelta && (<>
              <span>{shownDelta.label}</span>
              <span className="font-medium">
                {signed(shownDelta.deltaExact)}
                {/* Δ-проценты — только внутренние (правило 11). */}
                {s.mode === 'intern' && <> ({signedPercent(shownDelta.percent)})</>}
              </span>
            </>)}
          </p>
        </div>}

        {/* ── Сводка выбранного — «корзина» (ревью № 13, дефект 21):
            продавец видит СПИСОК своих решений, а не только их сумму.
            Строки — те же вклады движка (opt_/cov_/kg700), что и в
            Kostentreiber: второго источника выбранного не существует. */}
        <section aria-label="Im Angebot gewählt" className="a3-recap mt-4">
          <p className="a3-mtag">{tx('Im Angebot gewählt')}</p>
          {cart.length === 0 ? (
            <p className="a3-cap">
              {tx('Standardumfang — keine Abweichungen gewählt. Jede Option in den Kapiteln links zeigt ihren Preis vor dem Klick.')}
            </p>
          ) : (
            <ul>
              {cart.map((d) => (
                <li key={d.key}
                    className="flex justify-between gap-2 border-b border-border-subtle py-1 text-small">
                  <span className="text-text-secondary">{tx(d.label)}</span>
                  <span className="numeric shrink-0 text-text-primary">
                    {signed(d.exact)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Kostentreiber (DC-44) — обязателен после каждой калькуляции ──
            DC-21 отвечает машине, DC-44 — клиенту: переговорный аргумент,
            входит в клиентский PDF. Бары относительно наибольшего вклада и
            дублируются числом (DRIVER-005). */}
        <section aria-label="Kostentreiber" className="mt-5 border-t border-border-subtle pt-4">
          <h2 className="text-small font-bold text-text-primary">
            <button
              type="button"
              aria-expanded={treiberOpen}
              onClick={() => setTreiberOpen((v) => !v)}
              className="a3-journal-disclose outline-none before:absolute before:left-1/2 before:top-1/2 before:min-h-hit-target before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span aria-hidden="true">{treiberOpen ? '▾ ' : '▸ '}</span>
              {tx('Kostentreiber')}
            </button>
          </h2>
          {!treiberOpen && (
            <p className="a3-cap numeric mt-1">
              {p.result.drivers.length}{NNBSP}Beiträge · Summe ={NNBSP}
              {moneyLabel(p.result.total)}
            </p>
          )}
          {treiberOpen && (<div className="a3-drivers mt-2">
          {/* Шапка бенчмарка (DRIVER-001, CALC-008): фикстура объявляет только
              ID снапшота — медианы нет, и выдумать её нельзя (R-25), поэтому
              вывод «x % zur Mediane» честно заменён названной причиной.
              Бенчмарк — выносной блок контракта (.a3-bmark). */}
          <p className="a3-bmark numeric">
            {s.mode === 'intern'
              ? <>{rateLabel(p.secondaryRateBgf)} gegen Snapshot BM-BKI-2026Q1-SYNTH
                  {' '}(Bundesdurchschnitt, Regionalfaktor inaktiv{NNBSP}·{NNBSP}D-15)
                  {' '}— nicht vergleichbar: Median im Snapshot nicht deklariert.</>
              : <>{rateLabel(p.secondaryRateBgf)} · Bundesdurchschnitt;
                  {' '}Regionalfaktor nicht angewendet. Ein Medianwert ist für diesen Vergleich nicht verfügbar.</>}
          </p>
          <div className="a3-tbl-scroll mt-2">
            <table className="a3-driver-table">
              <caption className="sr-only">{tx('Kostentreiber: Beiträge summieren sich exakt zur Zwischensumme der kalkulierten Positionen')}</caption>
              <tbody>
                {(() => {
                  // Бар относителен наибольшему вкладу ПО МОДУЛЮ: экономящий
                  // драйвер такой же полноправный, как удорожающий (DRIVER-004).
                  const max = p.result.drivers.reduce(
                    (m, d) => (d.exact.abs().gt(m) ? d.exact.abs() : m),
                    p.result.drivers[0]!.exact.abs(),
                  )
                  return p.result.drivers.map((d) => {
                    const senkt = d.exact.isNegative()
                    const richtung = senkt ? 'senkt' : 'erhöht'
                    const shown = present(d.exact.abs())
                    const scopeLabel = d.scopeRefs.length > 0
                      ? s.mode === 'intern'
                        ? d.scopeRefs.join(`${NNBSP}· `)
                        : clientScopeLabel
                      : 'Zuordnung offen'
                    return (
                      <tr key={d.key} {...(s.mode === 'intern' ? { 'data-driver-id': d.key } : {})}
                          className={'a3-drv'
                            + (d.origin === 'base' ? ' a3-base' : '')
                            + (senkt ? ' a3-minus' : '')}>
                        <th scope="row" className="py-2 pr-3 text-left font-regular text-text-secondary">
                          {/* Доступное имя строки называет направление словом,
                              округление и точное значение (DRIVER-004). */}
                          <span className="sr-only">
                            {driverLabel(d.label, d.basis)}, {richtung},
                            rund {shown.display} Euro, exakt {formatDE(d.exact.abs(), 2)} Euro
                          </span>
                          <span aria-hidden="true">{tx(driverLabel(d.label, d.basis))}</span>
                          <span aria-hidden="true" className="a3-driver-direction">
                            {richtung}
                            {' · '}
                            {scopeLabel}
                          </span>
                        </th>
                        <td className="a3-bar-cell" aria-hidden="true">
                          <div
                            className="a3-bar"
                            style={{ width: `${shown.exact.div(max).mul(100).toNumber()}%` }}
                          />
                        </td>
                        <td className="a3-val">
                          <span aria-hidden="true">
                            {senkt ? '−' : ''}{moneyLabel(shown)}
                          </span>
                          {/* Раскрытие строки — переход к DC-21, а не своё
                              состояние. Настоящая кнопка: невидимый клик по
                              строке как единственная affordance запрещён
                              (DRIVER-006). */}
                          <span className="mt-1 block font-regular">
                            <OriginPopover
                              triggerLabel="Details"
                              rows={[
                                ...basisRows(d.basis),
                                {
                                  label: `Scope · ${scopeLabel}`,
                                  value: richtung,
                                  muted: d.scopeRefs.length === 0,
                                },
                                {
                                  label: 'Beitrag exakt',
                                  value: `${senkt ? '−' : '+'}${NNBSP}${formatDE(d.exact.abs(), 2)}${NNBSP}€`,
                                  strong: true,
                                },
                              ]}
                              rounding={shown.disclosure}
                              runRef={s.mode === 'intern' ? `Beitrags-ID ${d.key}` : null}
                            />
                          </span>
                        </td>
                      </tr>
                    )
                  })
                })()}
                {/* Неактивный фактор — строкой (DRIVER-002, CALC-009, D-15):
                    формулировка называет базу применения. 0 € без статуса
                    запрещён; величина из каталога, не из константы экрана. */}
                {!s.regionalfaktorActive && (
                  <tr className="a3-drv a3-inactive">
                    <td colSpan={3}>
                      Regionalfaktor Musterland · nicht berücksichtigt — würde{' '}
                      <span className="numeric">
                        {moneyLabel(present(
                          p.result.bauwerk.mul(CATALOG.regionalFactor.value.minus(1)),
                        ))}
                      </span>{' '}
                      auf den Bauwerksblock bedeuten
                    </td>
                  </tr>
                )}
                <tr className="a3-drv a3-sum">
                  <th scope="row" className="text-left">
                    {tx(p.result.totalLabel)}
                  </th>
                  <td aria-hidden="true" />
                  <td className="a3-val">
                    {moneyLabel(p.result.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          </div>)}
        </section>

        {/* ── Разбивка KG ────────────────────────────────────────────────── */}
        <section aria-label="Kostengruppen" className="mt-4 border-t border-border-subtle pt-4">
          <h2 className="text-small font-bold text-text-primary">
            <button
              type="button"
              aria-expanded={kgOpen}
              onClick={() => setKgOpen((v) => !v)}
              className="a3-journal-disclose outline-none before:absolute before:left-1/2 before:top-1/2 before:min-h-hit-target before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span aria-hidden="true">{kgOpen ? '▾ ' : '▸ '}</span>
              {tx('Kostengruppen nach DIN 276 · vereinfacht')}
            </button>
          </h2>
          {kgOpen && (<>
          {/* Таблица структуры затрат — DC-5: корень `.a3-kg`, числовые
              ячейки `.a3-num`, вложенный уровень `.a3-lvl2`, итоговая
              строка `.a3-total`. Прежде это был utility-двойник рядом с
              готовым контрактом (добор DC-COVERAGE приёмки № 17). */}
          <div className="a3-tbl-scroll mt-2">
            <table className="a3-kg w-full border-collapse">
              <caption className="a3-visually-hidden">{tx('Kostengruppen nach DIN 276, vereinfachte Verteilung')}</caption>
              <tbody>
                {/* В режиме `echt` KG 700 внутри блока не существует: она
                    стоит собственной позицией 12 % и показана в водопаде.
                    Печатать её здесь нулём или долей значило бы провести
                    одну позицию дважды. */}
                {(Object.entries(p.kgSplit)
                  .filter((e): e is [string, Decimal] => e[1] !== undefined))
                  .map(([g, v]) => (
                  <Fragment key={g}>
                    {/* KG 300 раскрывается до третьего уровня: подгруппы —
                        база надбавок за риск, и продавец обязан видеть, от
                        чего считается «4 % на KG 320». Раскрытие — DC-5
                        (.a3-expand/.a3-twistbtn/.a3-open/.a3-kg-child). */}
                    <tr className={g === 'KG_300' ? 'a3-expand' + (kg300Open ? ' a3-open' : '') : ''}>
                      <td>
                        {g === 'KG_300' ? (
                          <button type="button" className="a3-twistbtn"
                                  aria-expanded={kg300Open}
                                  onClick={() => setKg300Open((v2) => !v2)}>
                            <span aria-hidden="true">{kg300Open ? '▾' : '▸'}</span>
                            {' '}{g.replace('_', NNBSP)} {KG_LABELS[g as CostGroup]}
                          </button>
                        ) : <>{g.replace('_', NNBSP)} {KG_LABELS[g as CostGroup]}</>}
                      </td>
                      <td className="a3-num">{moneyLabel(present(v))}</td>
                      <td className="a3-num">
                        {v.div(p.result.total.exact).mul(100).toFixed(0)}{NNBSP}%
                      </td>
                    </tr>
                    {g === 'KG_300' && kg300Open && splitKg300(v).map((sub) => (
                      <tr key={sub.id} className="a3-kg-child a3-muted">
                        <td>{sub.id.replace('_', NNBSP)} {sub.label} {MARK}</td>
                        <td className="a3-num">{moneyLabel(present(sub.exact))}</td>
                        <td className="a3-num" />
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {/* Надземная/подземная части — вложенный уровень той же
                    структуры, а не отдельные строки-сироты. Показ равен
                    точному у 476.000, поэтому без префикса: ложный `≈` —
                    тоже дефект. */}
                <tr className="a3-lvl2 a3-muted">
                  <td>oberirdisch</td>
                  <td className="a3-num" colSpan={2}>{moneyLabel(p.aboveGround)}</td>
                </tr>
                <tr className="a3-lvl2 a3-muted">
                  <td>unterirdisch</td>
                  <td className="a3-num" colSpan={2}>{moneyLabel(p.belowGround)}</td>
                </tr>
                <tr className="a3-total">
                  <td>{tx(p.result.totalLabel)}</td>
                  <td className="a3-num" colSpan={2}>{moneyLabel(p.result.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-small text-text-muted">{tx('Zeilen werden unabhängig gerundet; die Prüfung läuft über exakte Werte.')}</p>
          </>)}
          {kgOpen && notIncluded.length > 0 && (
            <ClientNotice clientText="Nicht alle Kostengruppen sind Bestandteil dieses Angebots; die Abgrenzung steht in der Leistungsübersicht.">
              <p className="a3-cap mt-2">
                ▸ {tx('Nicht enthalten / noch offen')}:{' '}
                {notIncluded.map((g) =>
                  `${g.replace('_', NNBSP)}${NNBSP}${COVERAGE_SHORT[s.coverage[g]]}`).join(' · ')}
              </p>
            </ClientNotice>
          )}
        </section>
      </div>

      {/* ── Журнал сессии (DC-12): внутренний след, не часть клиентской
          проекции. DC-22 в шапке является единственной точкой входа. ── */}
      {s.mode === 'intern' && <div className="border-t border-border-strong px-5 py-3">
        {blocked && <div className="a3-warn-prep mb-3">
          <p className="text-small text-text-primary">
            <span aria-hidden="true">▲ </span>
            Kundenansicht gesperrt: Klassifikation nach MBO{NNBSP}§2 nicht bestätigt.
          </p>
          <div className="mt-2">
            <Button variant="primary" onClick={() => s.confirmGebaeudeklasse()}>
              {tx('Klassifikation bestätigen')}
            </Button>
          </div>
        </div>}
        <div className={'a3-journal-spec mt-3 transition-colors duration-base ' +
          (journalFlash ? 'bg-surface-subtle' : '')}>
          <button
            type="button"
            onClick={() => setJournalOpen((v) => !v)}
            aria-expanded={journalOpen}
            className="a3-journal-disclose outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span aria-hidden="true">{journalOpen ? '▾ ' : '▸ '}</span>
            {priceChangeCount === 0
              ? t('journal.empty')
              : <>Preisänderung gegenüber Vergleichsbasis DEMO-VV-0003:{' '}
                  <span className="numeric font-medium text-text-primary">
                    {signed(sessionDelta)}
                  </span>{' '}netto · {priceChangeCount}{NNBSP}
                  {priceChangeCount === 1 ? 'übernommene Änderung' : 'übernommene Änderungen'}</>}
          </button>

          {journalOpen && ctxJournal.length > 0 && (
            <ol className="a3-journal-items overflow-y-auto"
                style={{ maxHeight: 'calc(var(--space-8) * 3)' }}>
              {[...ctxJournal].reverse().map((e) => (
                <li key={e.seq}>
                  <span className="numeric">{e.seq}</span>
                  <span>{e.label}</span>
                  <span className="numeric">
                    {e.deltaExact ? signed(e.deltaExact) : '—'}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-2">
            <Button onClick={() => s.undo()}
                    disabled={!s.canUndo()}
                    disabledReason="nichts mehr rückgängig zu machen">
              {t('common.undo')}
            </Button>
          </div>
        </div>
      </div>}
    </aside>
  )
}

/**
 * Подпись драйвера по DC-44: где вклад — произведение, формула называется
 * прямо в строке (`Basis 2.000,00 m² × 1.545 €/m² BGF oberirdisch`).
 * Количества — из состояния, ставки — из каталога: собственных чисел у
 * подписи нет.
 */
/**
 * Строки происхождения по типу основания вклада (DC-21).
 *
 * Ветка выбирается по `kind`, а не по «заполнено ли поле»: прежняя версия
 * решала по одному `appliedTo` и на вкладах «ставка × количество» печатала
 * количество в квадратных метрах со знаком евро, а следом падала на
 * отсутствующем множителе. Единица берётся из основания, а не назначается
 * здесь.
 */
function basisRows(basis: DriverBasis | null) {
  if (!basis) return []
  if (basis.kind === 'factor') {
    return [
      { label: 'Angewendet auf', value: `${formatDE(basis.appliedTo, 2)}${NNBSP}€` },
      { label: 'Faktor', value: formatDE(basis.factor, 2) },
    ]
  }
  const denom = DENOMINATOR_LABEL[basis.denominator]
  return [
    { label: `Menge · ${denom}`, value: `${formatDE(basis.quantity, 2)}${NNBSP}m²` },
    { label: 'Satz', value: `${formatDE(basis.rate, 2)}${NNBSP}€/m²` },
  ]
}

function driverLabel(
  engineLabel: string,
  basis: DriverBasis | null,
): string {
  // Суффикс «количество × ставка» выводится ИЗ ОСНОВАНИЯ вклада, а не по
  // списку ключей. Прежняя редакция перечисляла два ключа поимённо и брала
  // ставку из каталога напрямую — второй источник той же величины, который
  // разошёлся бы при первой правке ставки и промолчал бы о третьем ключе.
  if (basis?.kind === 'rate') {
    return `${engineLabel} · ${formatDE(basis.quantity, 2)}${NNBSP}m² × `
      + `${formatDE(basis.rate, 0)}${NNBSP}€/m²${NNBSP}`
      + DENOMINATOR_LABEL[basis.denominator]
  }
  return engineLabel
}

/**
 * Знаковая денежная величина. Порядок — `≈ + 97.000 €`: префикс округления
 * стоит ДО знака, потому что приблизительность относится к величине целиком,
 * а не к её направлению (образец DC-12/DC-29).
 *
 * Форматтер ОДИН на все места. Прежде их было два: общий ставил знак перед
 * `≈`, правильный жил только в подписи журнала — и дельта-чип с превью
 * показывали порядок, которого норматив не знает. Два форматтера одной
 * величины расходятся всегда, вопрос только в том, когда это заметят.
 */
function signed(d: Decimal): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€`
}

function signedPercent(d: Decimal): string {
  const rounded = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const differs = !rounded.equals(d)
  const sign = d.isNegative() ? '−' : '+'
  return `${sign}${NNBSP}${differs ? '≈' + NNBSP : ''}${formatDE(rounded.abs(), 2)}${NNBSP}%`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
