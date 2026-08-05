import { useRef, type ReactNode } from 'react'
import { useStore, COVERAGE_LABEL, LABEL_UG } from '../state/store'
import { NNBSP } from '../engine/money'
import type { BuildingInput } from '../engine/calculate'
import type { CostGroup, CoverageState } from '../engine/calculate'
import { Button, NumericField, SegmentedThree, HIT } from '../components/primitives'

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

const GEIST_VORSCHAU_DELAY_MS = 200

export function S3Konfigurator() {
  const s = useStore()
  const n = s.openChapter
  const title = CHAPTERS[n - 1] ?? CHAPTERS[0]

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <p className="text-small text-text-secondary">
          Kapitel {n}{NNBSP}von{NNBSP}9 · Konfigurator
        </p>
        <h1 className="mt-1 text-heading-2 font-bold text-text-primary">{title}</h1>
      </header>

      <div className="max-w-content py-5">
        {n === 2 && <ChapterUmfang />}
        {n === 3 && <ChapterFlaechen />}
        {n === 4 && <ChapterEnergie />}
        {n !== 2 && n !== 3 && n !== 4 && <ChapterParked title={title} />}
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

/**
 * Опция с Geist-Vorschau (DC-28): наведение/фокус — последствие у цены через
 * 200 мс; уход — превью гаснет; клик — фиксация. Выбранная несёт бордер
 * выделения И знак ✓ — статус не только цветом (правило 8).
 */
function OptionButton({ selected, onSelect, onPreview, children }: {
  selected: boolean
  onSelect: () => void
  onPreview: (on: boolean) => void
  children: ReactNode
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const start = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onPreview(true), GEIST_VORSCHAU_DELAY_MS)
  }
  const stop = () => {
    clearTimeout(timer.current)
    onPreview(false)
  }
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => { clearTimeout(timer.current); onSelect() }}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className={`${HIT} inline-flex items-center gap-2 px-4 text-body outline-none ` +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
        'focus-visible:outline-focus-ring ' +
        (selected
          ? 'border-selected border-selection-border font-medium text-text-primary'
          : 'border border-border-default text-text-secondary hover:bg-surface-subtle')}
      style={{ minHeight: 'var(--size-control-visual-md)' }}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
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
            <SegmentedThree
              key={g}
              label={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
              value={state}
              options={COVERAGE_OPTIONS}
              onChange={(v) => s.setCoverage(g, v)}
              disabled={derived}
              disabledReason={
                'nicht anwendbar für diese Konfiguration — abgeleitet, nicht gewählt'
              }
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
        <div role="radiogroup" aria-label="Untergeschoss" className="flex flex-wrap gap-3">
          {(['vollausbau', 'ab_decke', 'kein_ug'] as const).map((v) => (
            <OptionButton
              key={v}
              selected={s.building.untergeschoss === v}
              onSelect={() => s.setUntergeschoss(v)}
              onPreview={(on) =>
                s.previewOption(on ? { kind: 'untergeschoss', value: v } : null)}
            >
              {LABEL_UG[v]}
            </OptionButton>
          ))}
        </div>
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
        <div role="radiogroup" aria-label="Energiestandard" className="flex flex-wrap gap-3">
          {(['GEG', 'EH_55', 'EH_40'] as const).map((v) => (
            <OptionButton
              key={v}
              selected={s.building.energiestandard === v}
              onSelect={() => s.setEnergiestandard(v)}
              onPreview={(on) =>
                s.previewOption(on ? { kind: 'energiestandard', value: v } : null)}
            >
              {LABEL_ES[v]}
            </OptionButton>
          ))}
        </div>
        {!s.esConfirmed && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
            <p className="text-small text-text-secondary">
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
