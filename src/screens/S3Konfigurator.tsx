import { type ReactNode } from 'react'
import { activeBuilding, useStore, COVERAGE_LABEL, LABEL_UG } from '../state/store'
import { NNBSP } from '../engine/money'
import type { BuildingInput } from '../engine/calculate'
import type { CostGroup, CoverageState } from '../engine/calculate'
import { Decimal } from 'decimal.js'
import { Button, NumericField } from '../components/primitives'
import { RadioCardGroup, SegmentedControl } from '../components/controls'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { ChapterBuildings } from './ChapterBuildings'
import { ChapterKg300 } from './ChapterKg300'
import demo from '../fixtures/demo-0001.json'
import { present } from '../engine/money'

/**
 * S3 Konfigurator — рабочая область главы. ТОЛЬКО она: навигация по главам
 * живёт в левом сайдбаре оболочки, живой оффер — в правой панели (решение
 * PO о трёх зонах). Экран не знает о цене ничего, кроме превью-побочных
 * эффектов своих контролов.
 *
 * Механики здесь:
 * - Geist-Vorschau (DC-28): hover/focus на опции через 200 мс показывает
 *   последствие у цены в правой панели; клик — фиксация и волна.
 * - Опция выделяется бордером выделения И знаком ✓ — не только цветом
 *   (правило 8).
 * - Непроработанная глава — честное состояние с объяснением, не пустота
 *   (правило 30): прототип говорит «этого нет», а не молчит.
 *
 * Экран показан во ВНУТРЕННЕМ режиме: в фикстуре открыт блокер DEMO-VI-0001
 * (класс здания не подтверждён по MBO §2), клиентские профили закрыты
 * гейтом в правой панели.
 */

export const CHAPTERS = [
  'Gebäude & Umfang', 'Leistungen KG 300', 'Leistungsabgrenzung', 'Energie & Qualität',
  'Flächen im Detail', 'Ausbau & Technik', 'Baugrund & Erschließung',
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

/**
 * Последствие опции для consequenceLine — видно всегда, не по hover
 * (R-05/OPTION-009). Образец контракта: `≈ +97.000 € Mehrpreis`.
 */
function consequenceLabel(delta: Decimal): string {
  if (delta.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(delta.abs())
  const sign = delta.isNegative() ? '−' : '+'
  const word = delta.isNegative() ? 'Minderpreis' : 'Mehrpreis'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${pr.display}${NNBSP}€${NNBSP}${word}`
}

export function S3Konfigurator() {
  const s = useStore()
  const n = s.openChapter
  const title = CHAPTERS[n - 1] ?? CHAPTERS[0]

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <p className="a3-cap">
          Kapitel {n}{NNBSP}von{NNBSP}9 · Konfigurator
        </p>
        <h1 className="mt-1 text-heading-2 font-bold text-text-primary">{title}</h1>
      </header>

      {/* Ширина содержимого не ограничивается: центровщик остаётся пределом
          ДЛИННОГО ТЕКСТА (он стоит на абзацах внутри карточек), а не клеткой
          для рабочей области — аудит верно указал, что здесь он обнимал всю
          главу целиком. */}
      <div className="py-5">
        {n === 1 && <ChapterBuildings />}
        {n === 2 && <ChapterKg300 />}
        {n === 3 && <ChapterUmfang />}
        {n === 4 && <ChapterEnergie />}
        {n === 5 && <ChapterFlaechen />}
        {n === 9 && <ChapterTermine />}
        {![1, 2, 3, 4, 5, 9].includes(n) && <ChapterParked title={title} />}
      </div>

      {/* Один следующий шаг всегда на экране (DC-27): маршрут, не принуждение. */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        {n > 1 ? (
          <Button onClick={() => s.openChapterAt(n - 1)}>
            ← Kapitel {n - 1}: {CHAPTERS[n - 2]}
          </Button>
        ) : <span />}
        {n < 9 && (
          <Button variant="primary" onClick={() => s.openChapterAt(n + 1)}>
            Weiter · Kapitel {n + 1}: {CHAPTERS[n]}
          </Button>
        )}
      </footer>
    </div>
  )
}

/**
 * Карточка раздела внутри главы: заголовок H3 из шкалы, воздух, бордер.
 * `intro` — коучинг-подсказка для sales: в презентации не существует
 * (правило 11), данные карточки остаются.
 */
function Card({ title, intro, children }: {
  title: string
  intro?: string
  children: ReactNode
}) {
  const mode = useStore().mode
  return (
    <section className="border border-border-default p-5">
      <h2 className="text-heading-3 font-bold text-text-primary">{title}</h2>
      {intro && mode === 'intern' && (
        <p className="mt-2 max-w-content text-body text-text-secondary">{intro}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function ChapterUmfang() {
  const s = useStore()
  return (
    <div className="grid gap-5">
      <Card
        title={`Leistungsumfang nach DIN${NNBSP}276`}
        intro={'Drei Zustände, weil «nicht enthalten» eine Entscheidung ist und ' +
          '«noch offen» eine Lücke — beides darf nicht dasselbe Feld teilen.'}
      >
        {(Object.keys(KG_LABELS) as CostGroup[]).map((g) => {
          const state = s.coverage[g]
          const derived = state === 'notApplicable'
          return (
            <SegmentedControl
              key={g}
              layout="row"
              legend={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
              value={state}
              options={COVERAGE_OPTIONS}
              onChange={(v) => s.setCoverage(g, v)}
              disabled={derived}
              disabledReason={derived
                ? 'nicht anwendbar für diese Konfiguration — abgeleitet, nicht gewählt'
                : undefined}
            />
          )
        })}
      </Card>
    </div>
  )
}

function ChapterFlaechen() {
  const s = useStore()
  return (
    <div className="grid gap-5">
      <Card
        title="Flächen"
        intro={'Werte aus Dokumenten tragen ihre Herkunft; eine Änderung wird ' +
          'sofort durchgerechnet und im Journal festgehalten.'}
      >
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
      </Card>

      <Card
        title="Untergeschoss"
        intro={'Die Vorschau am Preis erscheint beim Zeigen auf eine Option — ' +
          'entschieden ist erst der Klick.'}
      >
        <RadioCardGroup
          legend="Untergeschoss"
          legendHidden
          value={activeBuilding(s).untergeschoss}
          onChange={(v) => s.setUntergeschoss(v)}
          onPreview={(v) =>
            s.previewOption(v ? { kind: 'untergeschoss', value: v } : null)}
          options={(['vollausbau', 'ab_decke', 'kein_ug'] as const).map((v) => ({
            value: v,
            title: LABEL_UG[v],
            consequence: activeBuilding(s).untergeschoss === v
              ? 'aktuelle Auswahl'
              : consequenceLabel(s.optionDelta({ kind: 'untergeschoss', value: v })),
          }))}
        />
      </Card>
    </div>
  )
}

function ChapterEnergie() {
  const s = useStore()
  const LABEL_ES: Record<BuildingInput['energiestandard'], string> = {
    GEG: 'GEG-Standard', EH_55: `Effizienzhaus${NNBSP}55`, EH_40: `Effizienzhaus${NNBSP}40`,
  }
  return (
    <div className="grid gap-5">
      <Card
        title="Energiestandard"
        intro={'Die Wahl einer Option ist keine Bestätigung: das Unsicherheitsband ' +
          'verengt sich erst, wenn der Kunde den Standard bestätigt.'}
      >
        <RadioCardGroup
          legend="Energiestandard"
          legendHidden
          value={activeBuilding(s).energiestandard}
          onChange={(v) => s.setEnergiestandard(v)}
          onPreview={(v) =>
            s.previewOption(v ? { kind: 'energiestandard', value: v } : null)}
          options={(['GEG', 'EH_55', 'EH_40'] as const).map((v) => ({
            value: v,
            title: LABEL_ES[v],
            consequence: activeBuilding(s).energiestandard === v
              ? 'aktuelle Auswahl'
              : consequenceLabel(s.optionDelta({ kind: 'energiestandard', value: v })),
          }))}
        />
        {!s.esConfirmed && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
            <p className="a3-cap">
              Standard gewählt, vom Kunden noch nicht bestätigt — Band unverändert.
            </p>
            <Button onClick={() => s.confirmEnergiestandardAnswer()}>
              Vom Kunden bestätigt
            </Button>
          </div>
        )}
        {s.esConfirmed && (
          <p className="mt-4 border-t border-border-subtle pt-3 text-small text-text-secondary">
            <span aria-hidden="true">✓ </span>
            Vom Kunden bestätigt — Unsicherheitsband um 4{NNBSP}Prozentpunkte verengt.
          </p>
        )}
      </Card>
    </div>
  )
}

/**
 * Глава 9 · Termine — Bauzeit-Leiste (DC-19).
 *
 * Фазы берутся из метрик фикстуры, а не назначаются здесь: планирование —
 * величина уровня проекта, исполнение — уровня здания, и это разные строки
 * в `schedule.metrics`. Веха завершения — конец исполнения Haus A, то же
 * значение, что показывает герой срока в правой панели: два представления
 * одной даты обязаны приходить из одного места.
 */
function ChapterTermine() {
  const metrics = demo.schedule.metrics
  const planning = metrics.find((m) => m.metricKey === 'project.planning')!
  const haus = metrics.find((m) => m.metricKey === 'building:DEMO-B-A.execution')!

  return (
    <div className="grid gap-5">
      <Card
        title="Bauzeit"
        intro={'Planung ist Projektgröße, Ausführung gehört zum Gebäude — deshalb ' +
          'zwei Zeilen und nicht eine. Die Fertigstellung ist dieselbe Zahl, die ' +
          'oben rechts als Kennzahl steht.'}
      >
        <ScheduleGantt
          caption="Bauzeit nach Phasen mit Beginn, Ende und Dauer in Kalendertagen"
          finishISO={haus.endDate}
          phases={[
            { key: planning.metricKey, label: 'Planung', startISO: planning.startDate, endISO: planning.endDate },
            { key: haus.metricKey, label: `Ausführung Haus${NNBSP}A`, startISO: haus.startDate, endISO: haus.endDate },
          ]}
        />
      </Card>
    </div>
  )
}

/**
 * Честное состояние непроработанной главы (правило 30): прототип объявляет
 * границу своего объёма, вместо того чтобы показать пустоту или выдумку.
 */
function ChapterParked({ title }: { title: string }) {
  return (
    <div className="border border-border-default p-5">
      <p className="text-body text-text-primary">
        <span aria-hidden="true">○ </span>
        Kapitel «{title}» ist im Prototyp nicht ausgearbeitet.
      </p>
      <p className="mt-2 max-w-content text-small text-text-secondary">
        Die Kalkulation der Fixture hängt an den Kapiteln 2–4; dieses Kapitel
        zeigt im Prototyp bewusst keinen erfundenen Inhalt. Der volle
        Kapitelumfang ist in der Screen-Map spezifiziert.
      </p>
    </div>
  )
}
