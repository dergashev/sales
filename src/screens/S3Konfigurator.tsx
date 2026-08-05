import { useEffect } from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, COVERAGE_LABEL, LABEL_UG } from '../state/store'
import { label as moneyLabel, present, rateLabel, NNBSP, formatDE } from '../engine/money'
import type { CostGroup, CoverageState } from '../engine/calculate'
import {
  Button, NumericField, SegmentedThree, UncertaintyBadge, useCountUp, useReducedMotion,
} from '../components/primitives'

/**
 * S3 Konfigurator — главный экран презентации.
 *
 * Двухпанельный: слева главы, справа живой оффер. **Цена видна всегда** —
 * это не вопрос вкуса, а механика: клиент видит последствие каждого решения
 * немедленно, и именно это делает его участником, а не слушателем.
 *
 * Экран показан во ВНУТРЕННЕМ режиме, и это не упущение. В фикстуре открыт
 * блокер `DEMO-VI-0001` (класс здания не подтверждён по MBO §2), который
 * закрывает все пять клиентских профилей, включая живую конфигурацию.
 * Мокап с этими числами под подписью «Präsentationsmodus» изображал бы
 * состояние, которого фикстура не допускает — реальные числа, невозможное
 * состояние. Ворота приватные и срабатывают ДО входа: заблокирован вход,
 * а не работа (правило 12).
 */

const CHAPTERS = [
  'Projektverständnis', 'Umfang', 'Gebäude & Flächen', 'Energie & Qualität',
  'Konstruktion & Fassade', 'Ausbau & Technik', 'Baugrund & Erschließung',
  'Leistungsabgrenzung', 'Termine & Kommerzielles',
] as const

const KG_LABELS: Record<CostGroup, string> = {
  KG_100: 'Grundstück', KG_200: 'Vorbereitende Maßnahmen',
  KG_300: 'Baukonstruktion', KG_400: 'Technische Anlagen',
  KG_500: 'Außenanlagen', KG_600: 'Ausstattung',
  KG_700: 'Baunebenkosten', KG_800: 'Finanzierung',
}

const COVERAGE_OPTIONS = [
  { value: 'included' as CoverageState, label: COVERAGE_LABEL.included },
  { value: 'excluded' as CoverageState, label: COVERAGE_LABEL.excluded },
  { value: 'unknown' as CoverageState, label: COVERAGE_LABEL.unknown },
]

export function S3Konfigurator() {
  const s = useStore()
  const p = s.projection()
  const reduced = useReducedMotion()

  // Дельта-чип живёт 4 секунды, затем уезжает в журнал (DC-2).
  useEffect(() => {
    if (!s.activeDelta) return
    const t = setTimeout(() => s.clearDelta(), 4000)
    return () => clearTimeout(t)
  }, [s.activeDelta])

  const totalCount = useCountUp(new Decimal(p.result.total.display.replace(/\./g, '')), 0)
  const blocked = !s.building.gebaeudeklasse.confirmed

  return (
    <div className="mx-auto max-w-content px-5 py-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-strong pb-3">
        <h1 className="text-body font-bold text-text-primary">
          Musterprojekt Nordfeld · Haus{NNBSP}A · Variante «Basis»
        </h1>
        <span className="text-small text-text-secondary">
          ○ Vorbereitung · intern
        </span>
      </header>

      <div className="grid gap-6 py-5 lg:grid-cols-2">
        {/* ── Левая панель: главы и параметры ───────────────────────── */}
        <section aria-label="Kapitel und Parameter">
          <nav aria-label="Kapitel">
            <ol className="border-b border-border-subtle pb-3">
              {CHAPTERS.map((c, i) => {
                const n = i + 1
                const open = s.openChapter === n
                const done = n < 3
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => s.openChapterAt(n)}
                      aria-expanded={open}
                      className={'relative flex w-full items-center gap-3 py-2 text-left text-body ' +
                        'before:absolute before:left-1/2 before:top-1/2 before:min-h-hit-target ' +
                        'before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""] ' +
                        'outline-none focus-visible:outline focus-visible:outline-2 ' +
                        'focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
                        (open ? 'font-medium text-text-primary' : 'text-text-secondary')}
                    >
                      <span className="w-4 tabular-nums">{n}</span>
                      <span aria-hidden="true" className="w-3">
                        {done ? '✓' : open ? '▸' : ''}
                      </span>
                      <span>{c}</span>
                      {open && (
                        <span className="ml-auto text-small text-text-secondary">offen</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Прыгать можно куда угодно: нумерация — маршрут, не принуждение. */}
          {s.openChapter === 3 && (
            <div className="mt-5 border border-border-default p-4">
              <h2 className="text-body font-bold text-text-primary">
                Gebäude &amp; Flächen
              </h2>
              <NumericField
                label="BGF oberirdisch"
                value={s.fields.bgfOber.value}
                unit="m²"
                provenance={s.fields.bgfOber.provenance}
                onCommit={(v, c) => s.editField('bgfOber', v, c)}
              />
              <NumericField
                label="Wohnfläche WFL nach WoFlV"
                value={s.fields.wfl.value}
                unit="m²"
                provenance={s.fields.wfl.provenance}
                onCommit={(v, c) => s.editField('wfl', v, c)}
              />
              <NumericField
                label="Wohneinheiten"
                value={s.fields.we.value}
                decimals={0}
                provenance={s.fields.we.provenance}
                onCommit={(v, c) => s.editField('we', v, c)}
              />
              <div className="pt-4">
                <p className="text-small font-medium text-text-primary">Untergeschoss</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['vollausbau', 'ab_decke', 'kein_ug'] as const).map((v) => (
                    <Button
                      key={v}
                      variant={s.building.untergeschoss === v ? 'primary' : 'secondary'}
                      onClick={() => s.setUntergeschoss(v)}
                    >
                      {LABEL_UG[v]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {s.openChapter === 2 && (
            <div className="mt-5 border border-border-default p-4">
              <h2 className="text-body font-bold text-text-primary">
                Leistungsumfang nach DIN{NNBSP}276
              </h2>
              <p className="mt-2 text-small text-text-secondary">
                Drei Zustände, weil «nicht enthalten» eine Entscheidung ist und
                «noch offen» eine Lücke — beides darf nicht dasselbe Feld teilen.
              </p>
              <div className="mt-3">
                {(Object.keys(KG_LABELS) as CostGroup[]).map((g) => {
                  const state = s.coverage[g]
                  const derived = state === 'notApplicable'
                  return (
                    <SegmentedThree
                      key={g}
                      label={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
                      value={state}
                      options={COVERAGE_OPTIONS}
                      onChange={(v) => s.setCoverage(g, v)}
                      disabled={derived}
                      disabledReason={
                        'nicht anwendbar für diese Konfiguration — abgeleitet, ' +
                        'nicht gewählt'
                      }
                    />
                  )
                })}
              </div>
            </div>
          )}

          {s.openChapter === 4 && (
            <div className="mt-5 border border-border-default p-4">
              <h2 className="text-body font-bold text-text-primary">Energie &amp; Qualität</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['GEG', 'EH_55', 'EH_40'] as const).map((v) => (
                  <Button
                    key={v}
                    variant={s.building.energiestandard === v ? 'primary' : 'secondary'}
                    onClick={() => s.setEnergiestandard(v)}
                  >
                    {v.replace('_', NNBSP)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Правая панель: живой оффер ────────────────────────────── */}
        <section aria-label="Angebot" aria-live="polite">
          <p className="text-body text-text-secondary">{p.result.totalLabel}</p>

          {/* Три со-главных героя (DC-38). Оранжевый — только первый, и
              только на белой поверхности: на канве он даёт 2,60:1. */}
          <p className="numeric mt-1 text-display-numeric font-bold text-text-display-accent">
            {p.result.total.prefix && (
              <span aria-hidden="true">{p.result.total.prefix}{NNBSP}</span>
            )}
            {totalCount}
            {/* Единица меньшим кеглем, но разделитель — СИМВОЛ U+202F, не
                CSS-отступ: в буфере обмена и у скринридера число обязано
                оставаться «3.818.000 €», а не «3.818.000€». */}
            <span className="text-display-numeric-narrow">{NNBSP}€</span>
          </p>
          <p className="mt-1 text-body text-text-secondary">
            netto · <UncertaintyBadge pp={p.uncertaintyPp} />
          </p>

          <p className="numeric mt-5 text-display-numeric-narrow font-bold text-text-primary">
            {rateLabel(p.leadRate)}
          </p>
          <p className="numeric mt-2 text-body text-text-secondary">
            {rateLabel(p.secondaryRateBgf)} · {rateLabel(p.perUnit)}
          </p>

          <div className="mt-5 border-t border-border-subtle pt-3">
            <p className="numeric text-display-numeric-narrow font-bold text-text-primary">
              {p.duration.prefix && (
                <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>
              )}
              {p.duration.display}
            </p>
            <p className="text-body text-text-secondary">
              ab OKBP · Fertigstellung {formatDate(p.duration.completionDate)}
            </p>
          </div>

          <p className="mt-3 text-small text-text-muted">
            DEMO-SC-01 · DEMO-RUN-0007 · Regionalfaktor nicht aktiviert
          </p>

          {/* Дельта-чип: зарезервированный слот, появление не сдвигает вёрстку. */}
          <div className="mt-4 min-h-delta-slot">
            <AnimatePresence>
              {s.activeDelta && (
                <motion.p
                  initial={reduced ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? {} : { opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                  className="numeric border border-selection-border p-3 text-body text-text-primary"
                >
                  {s.activeDelta.label} ·{' '}
                  {signed(s.activeDelta.deltaExact)} ({signedPercent(s.activeDelta.percent)})
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <KgBreakdown
            split={p.kgSplit}
            coverage={s.coverage}
            aboveGround={p.aboveGround}
            belowGround={p.belowGround}
            total={p.result.total.exact}
          />
        </section>
      </div>

      {/* ── Нижняя полоса: журнал и ворота ───────────────────────────── */}
      <footer className="border-t border-border-strong pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-text-secondary">
            ▸ Journal dieser Sitzung:{' '}
            {s.journal.length === 0
              ? 'noch keine übernommenen Änderungen'
              : `${s.journal.length} übernommene Änderungen`}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => s.undo()} disabled={s.journal.length === 0}
                    disabledReason="noch keine Änderung übernommen">
              Rückgängig
            </Button>
            <Button>Vergleich</Button>
          </div>
        </div>

        {s.journal.length > 0 && (
          <ol className="mt-3 border-t border-border-subtle pt-2">
            {[...s.journal].reverse().map((e) => (
              <li key={e.seq} className="flex flex-wrap justify-between gap-3 py-1 text-small">
                <span className="text-text-secondary">{e.seq}. {e.label}</span>
                <span className="numeric text-text-primary">
                  {e.deltaExact ? signed(e.deltaExact) : '—'}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Ворота: причина и следующий шаг рядом, а не «недоступно». */}
        {blocked && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-contrast border-border-warning p-3">
            <p className="text-body text-text-primary">
              <span aria-hidden="true">▲ </span>
              Kundenansicht gesperrt: Klassifikation nach MBO{NNBSP}§2 nicht
              bestätigt. Geschossanzahl ist nur Prüfauslöser, kein Nachweis.
            </p>
            <Button variant="primary" onClick={() => s.confirmGebaeudeklasse()}>
              Klassifikation bestätigen
            </Button>
          </div>
        )}
        {!blocked && (
          <p className="mt-3 border border-border-default p-3 text-body text-text-primary">
            <span aria-hidden="true">✓ </span>
            Eintritts-Gate offen. Kundenansicht prüfen öffnet den Preflight —
            der Wechsel erfolgt erst nach Bestätigung.
          </p>
        )}
      </footer>
    </div>
  )
}

function KgBreakdown({
  split, coverage, aboveGround, belowGround, total,
}: {
  split: { KG_300: Decimal; KG_400: Decimal; KG_700: Decimal }
  coverage: Record<CostGroup, CoverageState>
  aboveGround: ReturnType<typeof present>
  belowGround: ReturnType<typeof present>
  total: Decimal
}) {
  const rows: Array<[CostGroup, Decimal]> = [
    ['KG_300', split.KG_300], ['KG_400', split.KG_400], ['KG_700', split.KG_700],
  ]
  const notIncluded = (Object.keys(coverage) as CostGroup[]).filter(
    (g) => coverage[g] === 'unknown' || coverage[g] === 'onRequest' || coverage[g] === 'excluded',
  )

  return (
    <div className="mt-5 border-t border-border-subtle pt-3">
      {/* Каждая таблица — в контейнере с прокруткой (правило 3a). */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Kostengruppen nach DIN 276</caption>
          <tbody>
            {rows.map(([g, v]) => (
              <tr key={g} className="border-b border-border-subtle">
                <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">
                  {g.replace('_', NNBSP)} {KG_LABELS[g]}
                </th>
                <td className="numeric py-2 pr-4 text-right text-text-primary">
                  {moneyLabel(present(v))}
                </td>
                <td className="numeric py-2 text-right text-text-secondary">
                  {v.div(total).mul(100).toFixed(0)}{NNBSP}%
                </td>
              </tr>
            ))}
            <tr className="border-b border-border-subtle">
              <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">
                ── oberirdisch
              </th>
              <td className="numeric py-2 pr-4 text-right text-text-primary" colSpan={2}>
                {moneyLabel(aboveGround)}
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">
                ── unterirdisch
              </th>
              <td className="numeric py-2 pr-4 text-right text-text-primary" colSpan={2}>
                {moneyLabel(belowGround)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {notIncluded.length > 0 && (
        <p className="mt-3 text-small text-text-secondary">
          ▸ Nicht enthalten / noch offen:{' '}
          {notIncluded.map((g) => `${g.replace('_', NNBSP)} ${COVERAGE_LABEL[coverage[g]]}`).join(' · ')}
        </p>
      )}
      <p className="mt-2 text-small text-text-muted">
        Zeilen werden unabhängig gerundet; die Prüfung läuft über exakte Werte.
      </p>
    </div>
  )
}

function signed(d: Decimal): string {
  const p = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${sign}${NNBSP}${p.prefix ? p.prefix + NNBSP : ''}${p.display}${NNBSP}€`
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
