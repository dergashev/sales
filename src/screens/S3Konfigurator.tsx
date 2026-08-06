import { type ReactNode } from 'react'
import { activeBuilding, useStore, COVERAGE_LABEL, LABEL_UG } from '../state/store'
import { NNBSP } from '../engine/money'
import { useTx } from '../i18n'
import type { BuildingInput } from '../engine/calculate'
import type { CostGroup, CoverageState } from '../engine/calculate'
import { Decimal } from 'decimal.js'
import { Button, NumericField } from '../components/primitives'
import { RadioCardGroup, SegmentedControl } from '../components/controls'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { ChapterBuildings } from './ChapterBuildings'
import { OptionChapter } from './OptionChapter'
import { KG300_GROUPS, KG400_GROUPS, ZERT_GROUPS, COVERAGE_RATES } from '../engine/options'
import demo from '../fixtures/demo-0001.json'
import { present, label as moneyLabel } from '../engine/money'

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
  'Gebäude & Umfang', 'Leistungen KG 300', 'Leistungsabgrenzung', 'Technik KG 400',
  'Energie & Zertifikate', 'Flächen im Detail', 'Baugrund & Erschließung',
  'Baunebenkosten KG 700', 'Termine & Kommerzielles',
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
  const tx = useTx()
  const n = s.openChapter
  const title = CHAPTERS[n - 1] ?? CHAPTERS[0]

  return (
    <div className="px-7 py-6">
      {/* Заголовок экрана — masthead витрины: крупный титул и мета на
          одной базовой линии, как в образце. */}
      <header className="a3-masthead border-b border-border-strong">
        <h1 className="a3-hero-title">{tx(title)}</h1>
        <p className="a3-cap">Kapitel {n}{NNBSP}von{NNBSP}9 · Konfigurator</p>
      </header>

      {/* Ширина содержимого не ограничивается: центровщик остаётся пределом
          ДЛИННОГО ТЕКСТА (он стоит на абзацах внутри карточек), а не клеткой
          для рабочей области — аудит верно указал, что здесь он обнимал всю
          главу целиком. */}
      <div className="py-5">
        {n === 1 && <ChapterBuildings />}
        {n === 2 && <OptionChapter groups={KG300_GROUPS}
          intro={'Von oben nach unten: erst der Umfang, dann die Konstruktion, '
            + 'zuletzt die Oberfläche. Jede Antwort zeigt ihre Folge am Preis, '
            + 'bevor sie gewählt wird.'} />}
        {n === 3 && <ChapterUmfang />}
        {n === 4 && <OptionChapter groups={KG400_GROUPS}
          intro={'Technische Anlagen nach DIN 276. Die Wahl der Erzeugung und der Lüftung entscheidet mit, welcher Energiestandard überhaupt erreichbar bleibt.'} />}
        {n === 5 && (
          <div className="grid gap-5">
            <ChapterEnergie />
            {/* Сертификаты — отдельная ось: EH описывает качество здания,
                QNG и DGNB — процедуру его подтверждения (см. options.ts). */}
            <OptionChapter groups={ZERT_GROUPS}
              intro={'Zertifikate sind eine eigene Achse: der Energiestandard '
                + 'beschreibt das Gebäude, das Siegel beschreibt das Verfahren, '
                + 'mit dem es nachgewiesen wird.'} />
          </div>
        )}
        {n === 6 && <ChapterFlaechen />}
        {n === 8 && <ChapterKg700 />}
        {n === 9 && <ChapterTermine />}
        {![1, 2, 3, 4, 5, 6, 8, 9].includes(n) && <ChapterParked title={title} />}
      </div>

      {/* Один следующий шаг всегда на экране (DC-27): маршрут, не принуждение. */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        {n > 1 ? (
          <Button onClick={() => s.openChapterAt(n - 1)}>
            ← Kapitel {n - 1}: {tx(CHAPTERS[n - 2]!)}
          </Button>
        ) : <span />}
        {n < 9 && (
          <Button variant="primary" onClick={() => s.openChapterAt(n + 1)}>
            Weiter · Kapitel {n + 1}: {tx(CHAPTERS[n]!)}
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
    <section className="a3-sheet">
      <h2 className="text-heading-3 font-bold text-text-primary">{title}</h2>
      {intro && mode === 'intern' && (
        <p className="mt-2 max-w-content text-body text-text-secondary">{intro}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * Глава 3 · Leistungsabgrenzung — какие группы затрат входят в предложение
 * (пункт 11 сценария).
 *
 * Группы разделены по природе решения, а не по номеру:
 * · KG 300 и 400 — ядро предложения, их не выбирают: без них нет продукта;
 * · KG 700 включена всегда, спорен лишь СПОСОБ расчёта (глава 8, только
 *   внутренний режим) — клиент видит долю, а не метод;
 * · KG 200, 500, 600, 800 — настоящее решение, и оно меняет цену;
 * · KG 100 (Grundstück) вне объёма подрядчика.
 *
 * Три состояния вместо галочки: «не входит» — решение, «ещё открыто» —
 * пробел в данных, и подпись итога зависит от второго, а не от первого
 * (R-18/CALC-006).
 */
function ChapterUmfang() {
  const s = useStore()
  const b = activeBuilding(s)
  const p = s.projection()
  const decidable: CostGroup[] = ['KG_200', 'KG_500', 'KG_600', 'KG_800']

  return (
    <div className="grid gap-5">
      <Card
        title={`Kern des Angebots`}
        intro={'Baukonstruktion und technische Anlagen sind keine Auswahl: '
          + 'ohne sie gibt es kein Angebot. Baunebenkosten sind immer enthalten '
          + '— verhandelbar ist nur die Berechnungsart, und die ist intern.'}
      >
        <ul>
          {(['KG_300', 'KG_400', 'KG_700'] as CostGroup[]).map((g) => (
            <li key={g} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-2">
              <span className="text-body text-text-primary">
                {g.replace('_', NNBSP)} {KG_LABELS[g]}
              </span>
              <span className="a3-cap">
                <span aria-hidden="true">✓ </span>immer enthalten
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={`Zu entscheiden`}
        intro={'Drei Zustände, weil «nicht enthalten» eine Entscheidung ist und '
          + '«noch offen» eine Lücke. Solange eine Lücke bleibt, weist das '
          + 'Angebot eine Zwischensumme der kalkulierten Positionen aus und '
          + 'keinen Gesamtpreis.'}
      >
        {decidable.map((g) => {
          const spec = COVERAGE_RATES[g]
          const qty = b.bgfAboveGround
          const preis = spec ? new Decimal(spec.rate).mul(qty) : null
          return (
            <div key={g}>
              <SegmentedControl
                layout="row"
                legend={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
                value={s.coverage[g]}
                options={COVERAGE_OPTIONS}
                onChange={(v) => s.setCoverage(g, v)}
              />
              <p className="a3-cap pb-2">
                {preis && !preis.isZero()
                  ? <>Aufnahme kostet {moneyLabel(present(preis))} ⚙ · {spec!.basis}</>
                  : <>ohne Preisansatz im indikativen Angebot{spec ? ` · ${spec.basis}` : ''}</>}
              </p>
            </div>
          )
        })}
      </Card>

      <Card title="Folge für die Angebotssumme">
        <p className="text-body text-text-primary">{p.result.totalLabel}</p>
        {p.result.completeness === 'incomplete' && (
          <ul className="mt-2">
            {p.result.incompleteReasons.map((r) => (
              <li key={r} className="a3-cap">
                <span aria-hidden="true">○ </span>{r}
              </li>
            ))}
          </ul>
        )}
        {p.result.completeness === 'complete' && (
          <p className="a3-cap mt-2">
            <span aria-hidden="true">✓ </span>
            Alle Deckungsentscheidungen getroffen und keine offenen
            wesentlichen Punkte — das Angebot weist einen Gesamtpreis aus.
          </p>
        )}
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
  const s = useStore()
  const metrics = demo.schedule.metrics
  const planning = metrics.find((m) => m.metricKey === 'project.planning')!
  const haus = metrics.find((m) => m.metricKey === 'building:DEMO-B-A.execution')!
  // Подпись длительности исполнения — из ТОЙ ЖЕ проекции, что герой срока
  // в панели: два представления одной величины из одного места.
  const dur = s.projection().duration

  return (
    <div className="grid gap-5">
      <Card
        title="Bauzeit"
        intro={'Planung ist Projektgröße, Ausführung gehört zum Gebäude — deshalb ' +
          'zwei Zeilen und nicht eine. Die Fertigstellung ist dieselbe Zahl, die ' +
          'oben rechts als Kennzahl steht.'}
      >
        <ScheduleGantt
          caption="Bauzeit nach Phasen mit Beginn, Ende, Dauer und Abhängigkeit"
          finishISO={haus.endDate}
          provenance={s.mode === 'intern'
            ? 'Kalender: Kalendermonate · Staffelstart aus ScheduleModel · DEMO-SC-01'
            : undefined}
          phases={[
            {
              key: planning.metricKey,
              label: 'Planung',
              unit: 'Gesamtprojekt',
              dependency: 'Planungsbeginn',
              startISO: planning.startDate,
              endISO: planning.endDate,
              durationLabel: `3${NNBSP}Monate`,
              colorVar: '--color-dataviz-category-1',
            },
            {
              key: haus.metricKey,
              label: 'Rohbau + Ausbau',
              unit: `Haus${NNBSP}A`,
              dependency: 'nach Planung',
              startISO: haus.startDate,
              endISO: haus.endDate,
              durationLabel: `${dur.prefix}${dur.prefix ? NNBSP : ''}${dur.display} ab${NNBSP}OKBP`,
              colorVar: '--color-dataviz-category-2',
            },
          ]}
        />
      </Card>

      {/* Последняя глава конвейера обязана называть следующий шаг (DC-27):
          продолжение в левой навигации — это поиск, а не маршрут. */}
      <div className="a3-nextstep">
        <p className="a3-mtag">Nächster Schritt</p>
        <p className="text-body text-text-primary">
          Die Konfiguration ist durchlaufen — weiter zum Vergleich der
          Optionen nebeneinander.
        </p>
        <div className="mt-2">
          <Button variant="primary" onClick={() => s.setPipelineView('vergleich')}>
            Varianten vergleichen
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Глава 8 · KG 700 — настройка ПОДГОТОВКИ, не переговоров (пункт 12).
 *
 * Клиент видит, что KG 700 включена, и её долю в смете. Каким способом
 * она посчитана — HOAI и AHO собственной ставкой или распределением
 * 70/22/8 — внутреннее решение: клиенту оно ничего не объясняет, а
 * продавцу даёт другую цену. Поэтому в презентации глава не существует
 * (правило 11), а не показывается свёрнутой.
 */
function ChapterKg700() {
  const s = useStore()
  const p = s.projection()

  if (s.mode === 'praesentation') {
    return (
      <div className="a3-sheet">
        <p className="text-body text-text-secondary">
          <span aria-hidden="true">○ </span>
          Die Berechnungsart der Baunebenkosten ist eine interne Einstellung
          und im Präsentationsmodus nicht verfügbar.
        </p>
        <p className="a3-cap mt-2">
          Für den Kunden gilt unverändert: KG{NNBSP}700 ist im Angebot
          enthalten, ihr Anteil steht in der Kostenübersicht.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <Card
        title={`Baunebenkosten KG${NNBSP}700`}
        intro={'Zwei Verfahren mit unterschiedlichem Ergebnis. Das All3-Verfahren '
          + 'verteilt die bereits berechnete Summe und ändert den Gesamtbetrag '
          + 'nicht; HOAI und AHO rechnen die Nebenkosten als eigene Position '
          + 'hinzu. Der Kunde sieht in beiden Fällen dieselbe Aussage: '
          + 'KG 700 ist enthalten.'}
      >
        <SegmentedControl
          legend="Berechnungsart KG 700"
          value={s.kg700Mode}
          onChange={(m) => s.setKg700Mode(m)}
          options={[
            { value: 'vereinfacht', label: 'All3-Verfahren 70/22/8' },
            { value: 'hoaiAho', label: 'nach HOAI und AHO' },
          ]}
        />
        <p className="a3-cap mt-3">
          {s.kg700Mode === 'vereinfacht'
            ? 'Der Gesamtbetrag bleibt unverändert — 70/22/8 verteilt, was bereits gerechnet ist.'
            : 'Die Nebenkosten kommen als eigene Zeile im Kostentreiber hinzu.'}
        </p>
        <p className="numeric mt-2 text-body text-text-primary">
          Anteil KG{NNBSP}700: {moneyLabel(present(p.kgSplit.KG_700))}
        </p>
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
    <div className="a3-sheet">
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
