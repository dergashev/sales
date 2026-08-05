import { useEffect, useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../state/store'
import { CATALOG } from '../state/catalog'
import { NNBSP, present, rateLabel, formatDE, label as moneyLabel } from '../engine/money'
import type { CostGroup, CoverageState } from '../engine/calculate'
import { Button, UncertaintyBadge, useCountUp, useReducedMotion } from './primitives'
import { OriginPopover } from './OriginPopover'

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
  const reduced = useReducedMotion()
  const [journalOpen, setJournalOpen] = useState(false)
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
  const blocked = !s.building.gebaeudeklasse.confirmed

  // Сессионная дельта (DC-12, CALC-014): сумма точных дельт журнала —
  // undo несёт отрицание, поэтому простая сумма и есть «к базе», без
  // второго источника в виде запомненного базового итога.
  const sessionDelta = s.journal.reduce(
    (acc, e) => (e.deltaExact ? acc.plus(e.deltaExact) : acc),
    new Decimal(0),
  )

  const notIncluded = (Object.keys(s.coverage) as CostGroup[]).filter(
    (g) => ['unknown', 'onRequest', 'excluded'].includes(s.coverage[g]),
  )

  return (
    <aside
      aria-label="Angebot"
      className="flex h-full w-panel-right shrink-0 flex-col overflow-y-auto border-l border-border-strong bg-surface-default"
    >
      <div className="flex-1 px-5 py-5" aria-live="polite">
        {/* ── Герой №1: тотал — единственный оранжевый (DC-38) ─────────── */}
        <p className="text-small text-text-secondary">{p.result.totalLabel}</p>
        <p className="numeric mt-1 text-display-numeric font-bold text-text-display-accent">
          {p.result.total.prefix && (
            <span aria-hidden="true">{p.result.total.prefix}{NNBSP}</span>
          )}
          {totalCount}
          <span className="text-display-numeric-narrow">{NNBSP}€</span>
        </p>
        <p className="mt-1 text-small text-text-secondary">
          netto · <UncertaintyBadge pp={p.uncertaintyPp} />
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

        {/* ── Герои №2 и №3: ведущая ставка и срок, чёрные (DC-38) ─────── */}
        <p className="numeric mt-4 text-display-numeric-narrow font-bold text-text-primary">
          {rateLabel(p.leadRate)}
        </p>
        <p className="numeric mt-1 text-small text-text-secondary">
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

        <p className="numeric mt-4 text-display-numeric-narrow font-bold text-text-primary">
          {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
          {p.duration.display}
        </p>
        <p className="text-small text-text-secondary">
          ab OKBP · Fertigstellung {formatDate(p.duration.completionDate)}
        </p>

        {/* Внутренние идентификаторы прогона — не для клиентской поверхности
            (MODE-001): в презентации отсутствуют, а не скрыты стилем. */}
        {s.mode === 'intern' && (
          <p className="mt-3 text-small text-text-muted">
            DEMO-SC-01 · DEMO-RUN-0007
          </p>
        )}

        {/* ── Слот дельта-чипа: зарезервирован, появление не двигает ──────
            Дельта фиксации всегда приоритетнее превью; превью (DC-28) —
            вторичным цветом, потому что это гипотеза, а не факт. */}
        <div className="mt-3 min-h-delta-slot">
          <AnimatePresence>
            {s.activeDelta ? (
              <motion.p
                key="delta"
                initial={reduced ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? {} : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
                className="numeric border-selected border-selection-border p-3 text-body text-text-primary"
              >
                {s.activeDelta.label}
                <span className="mt-1 block font-medium">
                  {signed(s.activeDelta.deltaExact)}
                  {/* Δ-проценты — только внутренние (правило 11). */}
                  {s.mode === 'intern' && <> ({signedPercent(s.activeDelta.percent)})</>}
                </span>
              </motion.p>
            ) : s.preview ? (
              <motion.p
                key="preview"
                initial={reduced ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? {} : { opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.12 }}
                className="numeric border border-border-default p-3 text-body text-text-secondary"
              >
                Vorschau · {s.preview.label}
                <span className="mt-1 block">{signed(s.preview.deltaExact)}</span>
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ── Kostentreiber (DC-44) — обязателен после каждой калькуляции ──
            DC-21 отвечает машине, DC-44 — клиенту: переговорный аргумент,
            входит в клиентский PDF. Бары относительно наибольшего вклада и
            дублируются числом (DRIVER-005). */}
        <section aria-label="Kostentreiber" className="mt-5 border-t border-border-subtle pt-4">
          <h2 className="text-small font-bold text-text-primary">Kostentreiber</h2>
          {/* Шапка бенчмарка (DRIVER-001, CALC-008): фикстура объявляет только
              ID снапшота — медианы нет, и выдумать её нельзя (R-25), поэтому
              вывод «x % zur Mediane» честно заменён названной причиной. */}
          <p className="numeric mt-1 text-small text-text-secondary">
            {rateLabel(p.secondaryRateBgf)} gegen Snapshot
            BM-BKI-2026Q1-SYNTH (Bundesdurchschnitt, Regionalfaktor
            inaktiv{NNBSP}·{NNBSP}D-15) — nicht vergleichbar: Median im
            Snapshot nicht deklariert.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-small">
              <caption className="sr-only">
                Kostentreiber: Beiträge summieren sich exakt zur Zwischensumme
              </caption>
              <tbody>
                {(() => {
                  const max = p.result.drivers.reduce(
                    (m, d) => (d.exact.gt(m) ? d.exact : m),
                    p.result.drivers[0]!.exact,
                  )
                  return p.result.drivers.map((d) => (
                    <tr key={d.key} className="border-b border-border-subtle">
                      <th scope="row" className="py-2 pr-3 text-left font-regular text-text-secondary">
                        {driverLabel(d.key, d.label, s)}
                      </th>
                      <td className="w-8 py-2 pr-2" aria-hidden="true">
                        <div
                          className="h-2 bg-border-strong"
                          style={{ width: `${d.exact.div(max).mul(100).toNumber()}%` }}
                        />
                      </td>
                      <td className="numeric py-2 text-right text-text-primary">
                        {moneyLabel(present(d.exact))}
                      </td>
                    </tr>
                  ))
                })()}
                {/* Неактивный фактор — строкой (DRIVER-002, CALC-009, D-15):
                    формулировка называет базу применения. 0 € без статуса
                    запрещён; величина из каталога, не из константы экрана. */}
                {!s.regionalfaktorActive && (
                  <tr className="border-b border-border-subtle">
                    <td colSpan={3} className="py-2 text-text-muted">
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
                <tr>
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-text-primary">
                    {p.result.totalLabel}
                  </th>
                  <td aria-hidden="true" />
                  <td className="numeric py-2 text-right font-medium text-text-primary">
                    {moneyLabel(p.result.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Разбивка KG ────────────────────────────────────────────────── */}
        <section aria-label="Kostengruppen" className="mt-4 border-t border-border-subtle pt-4">
          <h2 className="text-small font-bold text-text-primary">
            Kostengruppen nach DIN{NNBSP}276 · vereinfacht
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-small">
              <caption className="sr-only">Verteilung 70/22/8</caption>
              <tbody>
                {([['KG_300', p.kgSplit.KG_300], ['KG_400', p.kgSplit.KG_400],
                   ['KG_700', p.kgSplit.KG_700]] as const).map(([g, v]) => (
                  <tr key={g} className="h-row-financial border-b border-border-subtle">
                    <th scope="row" className="py-1 pr-3 text-left font-regular text-text-secondary">
                      {g.replace('_', NNBSP)} {KG_LABELS[g as CostGroup]}
                    </th>
                    <td className="numeric py-1 text-right text-text-primary">
                      {moneyLabel(present(v))}
                    </td>
                    <td className="numeric py-1 pl-3 text-right text-text-secondary">
                      {v.div(p.result.total.exact).mul(100).toFixed(0)}{NNBSP}%
                    </td>
                  </tr>
                ))}
                {/* Надземная/подземная части: показ равен точному у 476.000 —
                    поэтому без префикса; ложный `≈` — тоже дефект (CALC-007). */}
                <tr className="border-b border-border-subtle">
                  <th scope="row" className="py-2 pr-3 text-left font-regular text-text-secondary">
                    ── oberirdisch
                  </th>
                  <td className="numeric py-2 text-right text-text-primary" colSpan={2}>
                    {moneyLabel(p.aboveGround)}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 pr-3 text-left font-regular text-text-secondary">
                    ── unterirdisch
                  </th>
                  <td className="numeric py-2 text-right text-text-primary" colSpan={2}>
                    {moneyLabel(p.belowGround)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-small text-text-muted">
            Zeilen werden unabhängig gerundet; die Prüfung läuft über exakte Werte.
          </p>
          {notIncluded.length > 0 && (
            <p className="mt-2 text-small text-text-secondary">
              ▸ Nicht enthalten / noch offen:{' '}
              {notIncluded.map((g) =>
                `${g.replace('_', NNBSP)}${NNBSP}${COVERAGE_SHORT[s.coverage[g]]}`).join(' · ')}
            </p>
          )}
        </section>
      </div>

      {/* ── Гейт: причина и следующий шаг рядом (DC-33) ──────────────────── */}
      <div className="border-t border-border-strong px-5 py-3">
        {blocked ? (
          <div className="border-contrast border-border-warning p-3">
            <p className="text-small text-text-primary">
              <span aria-hidden="true">▲ </span>
              Kundenansicht gesperrt: Klassifikation nach MBO{NNBSP}§2 nicht
              bestätigt.
            </p>
            <div className="mt-2">
              <Button variant="primary" onClick={() => s.confirmGebaeudeklasse()}>
                Klassifikation bestätigen
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-small text-text-primary">
            <span aria-hidden="true">✓ </span>
            Eintritts-Gate offen — Kundenansicht prüfen öffnet den Preflight.
          </p>
        )}

        {/* ── Журнал сессии (DC-12): подпись с названной базой ───────────── */}
        <div className={'mt-3 transition-colors duration-base ' +
          (journalFlash ? 'bg-surface-subtle' : '')}>
          <button
            type="button"
            onClick={() => setJournalOpen((v) => !v)}
            aria-expanded={journalOpen}
            className="relative w-full text-left text-small text-text-secondary outline-none before:absolute before:left-1/2 before:top-1/2 before:min-h-hit-target before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span aria-hidden="true">{journalOpen ? '▾ ' : '▸ '}</span>
            {s.journal.length === 0
              ? 'Journal: noch keine übernommenen Änderungen'
              : <>Preisänderung gegenüber Vergleichsbasis DEMO-VV-0003:{' '}
                  <span className="numeric font-medium text-text-primary">
                    {dc12Delta(sessionDelta)}
                  </span>{' '}netto · {s.journal.length} übernommene Änderung(en)</>}
          </button>

          {journalOpen && s.journal.length > 0 && (
            <ol className="mt-2 overflow-y-auto border-t border-border-subtle pt-1"
                style={{ maxHeight: 'calc(var(--space-8) * 3)' }}>
              {[...s.journal].reverse().map((e) => (
                <li key={e.seq} className="flex justify-between gap-2 py-1 text-small">
                  <span className="text-text-secondary">{e.seq}. {e.label}</span>
                  <span className="numeric shrink-0 text-text-primary">
                    {e.deltaExact ? signed(e.deltaExact) : '—'}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-2">
            <Button onClick={() => s.undo()}
                    disabled={s.journal.length === 0}
                    disabledReason="noch keine Änderung übernommen">
              Rückgängig
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}

/**
 * Подпись драйвера по DC-44: где вклад — произведение, формула называется
 * прямо в строке (`Basis 2.000,00 m² × 1.545 €/m² BGF oberirdisch`).
 * Количества — из состояния, ставки — из каталога: собственных чисел у
 * подписи нет.
 */
function driverLabel(
  key: string,
  engineLabel: string,
  s: { building: { bgfAboveGround: Decimal; bgfBelowGround: Decimal } },
): string {
  if (key === 'basis') {
    return `Basis ${formatDE(s.building.bgfAboveGround, 2)}${NNBSP}m² × ` +
      `${formatDE(CATALOG.kBase, 0)}${NNBSP}€/m²${NNBSP}BGF oberirdisch`
  }
  if (key === 'untergeschoss_mit_tiefgarage') {
    return `Untergeschoss inkl. Tiefgarage ${formatDE(s.building.bgfBelowGround, 2)}${NNBSP}m² × ` +
      `${formatDE(CATALOG.costFactors.untergeschoss.vollausbauMitTiefgarage, 0)}${NNBSP}€/m²${NNBSP}BGF unterirdisch`
  }
  return engineLabel
}

function signed(d: Decimal): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${sign}${NNBSP}${pr.prefix ? pr.prefix + NNBSP : ''}${pr.display}${NNBSP}€`
}

/** Формат DC-12 (README §журнал): `≈ + 97.000 €` — префикс ДО знака. */
function dc12Delta(d: Decimal): string {
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
