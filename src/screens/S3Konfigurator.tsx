import { type ReactNode } from 'react'
import { activeBuilding, useStore, COVERAGE_LABEL, LABEL_UG } from '../state/store'
import { NNBSP } from '../engine/money'
import { useTx } from '../i18n'
import { incompleteReasonText } from '../i18n/reasons'
import type { BuildingInput } from '../engine/calculate'
import type { CostGroup, CoverageState } from '../engine/calculate'
import { Decimal } from 'decimal.js'
import { Button, NumericField, type ProvenanceKind } from '../components/primitives'
import { PageHeader, SectionSheet } from '../components/designSystem'
import { ClientNotice } from '../components/ClientNotice'
import { RadioCardGroup, SegmentedControl } from '../components/controls'
import { optionImage } from '../assets/option-images'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { OptionChapter } from './OptionChapter'
import {
  KG300_GROUPS, KG400_GROUPS, ZERT_GROUPS, COVERAGE_RATES,
} from '../engine/options'
import { RISK_ITEMS, riskDriver } from '../engine/risk'
import demo from '../fixtures/demo-0001.json'
import { present, label as moneyLabel } from '../engine/money'
import {
  CLIENT_VISIBLE_CHAPTERS,
  chapterForOutputProfile,
  isClientProjection,
  isVisibleInOutputProfile,
} from '../state/clientProjection'

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

/**
 * Имена изображений остались от снятой опции `ugVariante`: снимки сделаны
 * по TASK-18 и описывают ровно эти три состояния подвала. Соответствие
 * объявлено здесь, а не угадывается по совпадению строк.
 */
const UG_IMAGE_VALUE: Record<'vollausbau' | 'ab_decke' | 'kein_ug', string> = {
  vollausbau: 'rohbauAusbau',
  ab_decke: 'nurAusbau',
  kein_ug: 'keins',
}

export const CHAPTERS = [
  'Leistungen KG 300', 'Leistungsabgrenzung', 'Technik KG 400',
  'Energie & Zertifikate', 'Flächen im Detail', 'Baugrund & Erschließung',
  'Baunebenkosten KG 700', 'Termine & Kommerzielles',
] as const

const KG_LABELS: Record<CostGroup, string> = {
  KG_100: 'Grundstück', KG_200: 'Vorbereitende Maßnahmen',
  KG_300: 'Baukonstruktion', KG_400: 'Technische Anlagen',
  KG_500: 'Außenanlagen', KG_600: 'Ausstattung',
  KG_700: 'Baunebenkosten', KG_800: 'Finanzierung',
}

/**
 * Последствие опции для consequenceLine — видно всегда, не по hover
 * (R-05/OPTION-009). Образец контракта: `≈ +97.000 € Mehrpreis`.
 */
function consequenceLabel(delta: Decimal, zero?: string): string {
  if (delta.isZero()) return zero ?? `±${NNBSP}0${NNBSP}€`
  const pr = present(delta.abs())
  const sign = delta.isNegative() ? '−' : '+'
  const word = delta.isNegative() ? 'Minderpreis' : 'Mehrpreis'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${pr.display}${NNBSP}€${NNBSP}${word}`
}

export function S3Konfigurator() {
  const s = useStore()
  const tx = useTx()
  const client = isClientProjection(s.mode)
  const n = chapterForOutputProfile(s.mode, s.openChapter)
  const title = CHAPTERS[n - 1] ?? CHAPTERS[0]
  const chapterRoute: readonly number[] = client
    ? CLIENT_VISIBLE_CHAPTERS
    : [1, 2, 3, 4, 5, 6, 7, 8]
  const routeIndex = chapterRoute.indexOf(n)
  const previous = routeIndex > 0 ? chapterRoute[routeIndex - 1] : null
  const next = routeIndex >= 0 && routeIndex < chapterRoute.length - 1
    ? chapterRoute[routeIndex + 1]
    : null

  return (
    <div className="px-7 py-6">
      {/* Заголовок экрана — masthead витрины: крупный титул и мета на
          одной базовой линии, как в образце. */}
      <PageHeader
        title={tx(title)}
        meta={<>Kapitel {routeIndex + 1}{NNBSP}von{NNBSP}{chapterRoute.length} · Konfigurator</>}
      />

      {/* Ширина содержимого не ограничивается: центровщик остаётся пределом
          ДЛИННОГО ТЕКСТА (он стоит на абзацах внутри карточек), а не клеткой
          для рабочей области — аудит верно указал, что здесь он обнимал всю
          главу целиком. */}
      <div className="py-5">
        {n === 1 && <OptionChapter groups={KG300_GROUPS}
          intro={'Von oben nach unten: erst der Umfang, dann die Konstruktion, '
            + 'zuletzt die Oberfläche. Jede Antwort zeigt ihre Folge am Preis, '
            + 'bevor sie gewählt wird.'} />}
        {n === 2 && <ChapterUmfang />}
        {n === 3 && <OptionChapter groups={KG400_GROUPS}
          intro={'Technische Anlagen nach DIN 276. Die Wahl der Erzeugung und der Lüftung entscheidet mit, welcher Energiestandard überhaupt erreichbar bleibt.'} />}
        {n === 4 && (
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
        {n === 5 && <ChapterFlaechen />}
        {n === 6 && <ChapterBaugrund />}
        {n === 7 && <ChapterKg700 />}
        {n === 8 && <ChapterTermine />}
        {![1, 2, 3, 4, 5, 6, 7, 8].includes(n) && <ChapterParked title={title} />}
      </div>

      {/* Один следующий шаг всегда на экране (DC-27): маршрут, не принуждение. */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        {previous ? (
          <Button onClick={() => s.openChapterAt(previous)}>
            ← Kapitel {routeIndex}: {tx(CHAPTERS[previous - 1]!)}
          </Button>
        ) : <span />}
        {next && (
          <Button variant="primary" onClick={() => s.openChapterAt(next)}>
            Weiter · Kapitel {routeIndex + 2}: {tx(CHAPTERS[next - 1]!)}
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
  const tx = useTx()
  return (
    <SectionSheet title={tx(title)} intro={intro && mode === 'intern' ? tx(intro) : undefined}>
      <div className="mt-3">{children}</div>
    </SectionSheet>
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
  const tx = useTx()
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
        {/* Карточки объёма вместо набора сегментных переключателей
            (приёмка волны C: глава дважды оценена «налоговой формой»).
            Решение здесь коммерческое — «берём ли мы это на себя», — и
            выглядеть оно должно как выбор позиции, а не как заполнение
            поля. Плитки те же, что в главах опций: у каждой цена
            последствия на самой плитке и последствие видно ДО клика. */}
        {decidable.map((g) => {
          const spec = COVERAGE_RATES[g]
          // Последствие приходит из ТОЙ ЖЕ проекции, что и клик: и охват
          // считается по ВСЕМ включённым зданиям, а не по активному.
          // Прежде плитка умножала ставку на площадь активного здания и
          // обещала +230.000 €, тогда как итог менялся на +368.000 €
          // (сплошное ревью 26, находка 13; предложение № 1 исследования
          // рычага). Второй калькулятор последствия расходится молча.
          const outcome = (v: CoverageState) =>
            s.coverage[g] === v ? null : s.outcomeOf({ kind: 'coverage', group: g, value: v })
          const tile = (v: CoverageState, title: string, zero: string) => ({
            value: v,
            title,
            description: v === 'included' && spec ? `${tx(spec.basis)} ⚙` : undefined,
            consequence: s.coverage[g] === v
              ? tx('aktuelle Auswahl')
              : consequenceLabel(outcome(v)!.delta, zero),
          })
          return (
            <div key={g} className="mt-4">
              <RadioCardGroup
                legend={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
                value={s.coverage[g]}
                onChange={(v) => s.setCoverage(g, v as CoverageState)}
                onPreview={(v) => s.previewOption(
                  v ? { kind: 'coverage', group: g, value: v as CoverageState } : null,
                )}
                options={[
                  tile('included', tx(COVERAGE_LABEL.included),
                       tx('ohne Preisansatz im indikativen Angebot')),
                  tile('excluded', tx(COVERAGE_LABEL.excluded),
                       tx('Entscheidung, keine Lücke: die Summe bleibt vollständig')),
                  {
                    value: 'unknown' as const,
                    title: tx(COVERAGE_LABEL.unknown),
                    description: tx('Lücke, keine Entscheidung: das Angebot weist keinen Gesamtpreis aus'),
                    consequence: s.coverage[g] === 'unknown'
                      ? tx('aktuelle Auswahl')
                      : tx('Zwischensumme statt Gesamtpreis'),
                  },
                ]}
              />
            </div>
          )
        })}
      </Card>

      <Card title="Folge für die Angebotssumme">
        <p className="text-body text-text-primary">{tx(p.result.totalLabel)}</p>
        {p.result.completeness === 'incomplete' && (
          /* Правило 11: у клиента предупреждение свёрнуто в нейтральную
             точку, у продавца остаётся списком причин, с которым можно
             работать. Существенная проблема сюда не попадает по
             построению: с ней клиентский вид не открывается вовсе. */
          <ClientNotice clientText="Einzelne Kostengruppen sind noch nicht entschieden — das Angebot weist deshalb eine Zwischensumme aus.">
            <ul className="mt-2">
              {p.result.incompleteReasons.map((r) => (
                <li key={r.code + ('groups' in r ? r.groups.join() : '')}
                    className="a3-cap">
                  <span aria-hidden="true">○ </span>
                  {tx(incompleteReasonText(r, s.mode))}
                </li>
              ))}
            </ul>
          </ClientNotice>
        )}
        {p.result.completeness === 'complete' && (
          <p className="a3-cap mt-2">
            <span aria-hidden="true">✓ </span>{tx('Alle Deckungsentscheidungen getroffen und keine offenen wesentlichen Punkte — das Angebot weist einen Gesamtpreis aus.')}</p>
        )}
      </Card>
    </div>
  )
}

function ChapterFlaechen() {
  const tx = useTx()
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
          provenance={{
            kind: fieldProvenanceKind(s.fields.bgfOber.provenance),
            label: tx(s.fields.bgfOber.provenance),
          }}
          onCommit={(v, c) => s.editField('bgfOber', v, c)}
        />
        <NumericField
          label="Wohnfläche WFL nach WoFlV"
          value={s.fields.wfl.value}
          unit="m²"
          provenance={{
            kind: fieldProvenanceKind(s.fields.wfl.provenance),
            label: tx(s.fields.wfl.provenance),
          }}
          onCommit={(v, c) => s.editField('wfl', v, c)}
        />
        <NumericField
          label="Wohneinheiten"
          value={s.fields.we.value}
          decimals={0}
          integer
          provenance={{
            kind: fieldProvenanceKind(s.fields.we.provenance),
            label: tx(s.fields.we.provenance),
          }}
          onCommit={(v, c) => s.editField('we', v, c)}
        />
      </Card>

      <Card
        title="Untergeschoss"
        intro={'Die Vorschau am Preis erscheint beim Zeigen auf eine Option — ' +
          'entschieden ist erst der Klick.'}
      >
        {/* Одно решение — один владелец. Прежде тот же выбор существовал
            ВТОРОЙ раз опцией `ugVariante` в главе KG 300, со своими
            дельтами −714 / −1190 от слитой ставки 1.190: числа расходились
            со спецификацией на 36 €/m², а два контрола над одной физической
            областью позволяли вычесть подвал дважды (ревью 26, находки 5 и
            19). Ось принадлежит уровню Building (D-11 v2), цену считает
            движок по трём ставкам каталога — а карточки с изображениями
            переехали сюда, потому что выбор объёма подвала и должен
            выглядеть выбором, а не полем формы. */}
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
            image: optionImage('ugVariante', UG_IMAGE_VALUE[v]),
            consequence: activeBuilding(s).untergeschoss === v
              ? 'aktuelle Auswahl'
              : consequenceLabel(s.optionDelta({ kind: 'untergeschoss', value: v })),
          }))}
        />
      </Card>
    </div>
  )
}

function fieldProvenanceKind(
  provenance: 'aus Dokument' | 'vom Kunden bestätigt' | 'abgeleitet' | 'manuell erfasst',
): ProvenanceKind {
  return provenance === 'aus Dokument' ? 'document'
    : provenance === 'vom Kunden bestätigt' ? 'customerConfirmed'
      : provenance === 'abgeleitet' ? 'derived' : 'manual'
}

function ChapterEnergie() {
  const tx = useTx()
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
            <p className="a3-cap">{tx('Standard gewählt, vom Kunden noch nicht bestätigt — Band unverändert.')}</p>
            <Button onClick={() => s.confirmEnergiestandardAnswer()}>{tx('Vom Kunden bestätigt')}</Button>
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
  const tx9 = useTx()
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
            ? tx9('Kalender: Kalendermonate · Staffelstart aus ScheduleModel · DEMO-SC-01')
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
        <p className="a3-mtag">{tx9('Nächster Schritt')}</p>
        <p className="text-body text-text-primary">
          {tx9('Die Konfiguration ist durchlaufen — weiter zum Vergleich der Optionen nebeneinander.')}
        </p>
        <div className="mt-2">
          <Button variant="primary" onClick={() => s.setPipelineView('vergleich')}>
            {tx9('Varianten vergleichen')}
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
  const tx = useTx()
  const s = useStore()
  const p = s.projection()

  if (s.mode === 'praesentation') {
    return (
      <div className="a3-sheet">
        <p className="text-body text-text-secondary">
          <span aria-hidden="true">○ </span>{tx('Die Berechnungsart der Baunebenkosten ist eine interne Einstellung und im Präsentationsmodus nicht verfügbar.')}</p>
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
        {/* В режиме echt доли KG 700 внутри блока нет: она стоит своей
            позицией и живёт в водопаде, а не в разбивке блока. */}
        {p.kgSplit.KG_700 && (
          <p className="numeric mt-2 text-body text-text-primary">
            Anteil KG{NNBSP}700: {moneyLabel(present(p.kgSplit.KG_700))}
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
/**
 * Глава 7 · Baugrund & Erschließung — глава ДАННЫХ, не выбора (дефект 4
 * ревью № 13: раньше здесь стояло «не проработано» посреди золотого пути).
 *
 * Содержание строго из источников: риск Baugrund — типизированная запись
 * фикстуры (категория · вероятность · Kostenwirkung +4 % auf KG 320,
 * calculation-spec §«Baugrundgutachten liegt nicht vor»); риск НЕ входит
 * в цену — он ось риска, не неопределённости, и до появления Gutachten
 * остаётся названным риском (CALC-001: оси не смешиваются). По
 * Erschließung документация фикстуры фактов не содержит — пустота названа
 * с источником, решение о KG 200 живёт в главе 3 и здесь только
 * показывается со ссылкой.
 */
function ChapterBaugrund() {
  const s = useStore()
  const tx = useTx()
  const kg200 = s.coverage.KG_200
  const kg300Exact = s.projection().kgSplit.KG_300

  return (
    <div className="grid gap-5">
      <Card
        title="Baugrund"
        intro={'Der Baugrund entscheidet über Gründung und KG 320. Ohne '
          + 'Gutachten bleibt er ein benanntes Risiko — kein Preisbestandteil '
          + 'und keine stillschweigende Annahme.'}
      >
        {/* Типизированные риски фикстуры: категория · вероятность ·
            ставка · НАЗВАННАЯ база. Надбавка — реальные деньги (D-02),
            и её сумма считается от своей группы затрат, а не «примерно
            от KG 300»: для этого и появился третий уровень KG. */}
        {RISK_ITEMS.map((r) => {
          const d = riskDriver(r, kg300Exact)
          const on = s.risikoAktiv[r.id] === true
          return (
            <div key={r.id} className="a3-konflikt mt-3">
              <p className="text-body text-text-primary">
                <span aria-hidden="true">{on ? '● ' : '▲ '}</span>
                {tx(r.label)}
              </p>
              <div className="a3-kv">
                <span>
                  <span className="a3-cap block">{tx('Kategorie')}</span>
                  {tx(r.kategorie)}
                </span>
                <span>
                  <span className="a3-cap block">{tx('Wahrscheinlichkeit')}</span>
                  {tx(r.wahrscheinlichkeit)}
                </span>
                <span>
                  <span className="a3-cap block">
                    {tx('Zuschlag')} · {(Number(r.rate) * 100).toFixed(0)}{NNBSP}%
                    {' '}{tx('auf')} {r.base.replace('_', NNBSP)}
                  </span>
                  <span className="numeric">
                    {d ? moneyLabel(present(d.exact)) : '—'}
                  </span>
                </span>
              </div>
              <p className="a3-cap mt-2">
                {on
                  ? tx('Im Angebot enthalten. Der Zuschlag ist die Rechnung für ein fehlendes Dokument und entfällt, sobald es vorliegt.')
                  : tx('Noch nicht im Angebot. Die Schätzunsicherheit bleibt davon unberührt: sie ist Statistik und wird nicht addiert.')}
              </p>
              <p className="a3-cap mt-1">
                <span aria-hidden="true">→ </span>{tx(r.remedy)}
              </p>
              {/* Последствие видно ДО клика и приходит из той же проекции
                  (R-05, предложение № 1 исследования рычага). Прежде у
                  надбавки будущего итога не было вовсе: сумма самой
                  надбавки есть, а «сколько станет» продавец складывал
                  в голове. */}
              <p className="a3-cap mt-1 numeric">
                {consequenceLabel(
                  s.outcomeOf({ kind: 'risiko', id: r.id, active: !on }).delta,
                )}
              </p>
              <div className="a3-row mt-3">
                <Button
                  variant={on ? 'secondary' : 'primary'}
                  onClick={() => s.toggleRisiko(r.id)}
                  onMouseEnter={() =>
                    s.previewOption({ kind: 'risiko', id: r.id, active: !on })}
                  onMouseLeave={() => s.previewOption(null)}
                  onFocus={() =>
                    s.previewOption({ kind: 'risiko', id: r.id, active: !on })}
                  onBlur={() => s.previewOption(null)}
                >
                  {on ? tx('Zuschlag entfernen') : tx('Zuschlag anwenden')}
                </Button>
                {isVisibleInOutputProfile(s.mode, 'internalOnly') && (
                  <Button onClick={() => s.opportunityId && s.openOpportunity(s.opportunityId)}>
                    {tx('Frage an den Kunden · in der Vorbereitung')}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </Card>

      <Card
        title="Erschließung"
        intro={'Erschließung gehört zu KG 200 — die Entscheidung über den '
          + 'Umfang fällt in Kapitel 3, hier steht ihr Stand.'}
      >
        {/* Пустота названа с источником (правило 30): факта нет в
            документации, и это не то же самое, что «его нет». */}
        <p className="a3-cap">
          <span aria-hidden="true">○ </span>{tx('Die Dokumentation der Opportunity enthält keine Angaben zur Erschließung — kein Wert wird angenommen.')}</p>
        <p className="mt-3 text-body text-text-primary">
          KG{NNBSP}200 im Angebot: {COVERAGE_LABEL[kg200]}
        </p>
        <div className="mt-2">
          <Button onClick={() => s.openChapterAt(3)}>{tx('Zu Kapitel 3 · Leistungsabgrenzung')}</Button>
        </div>
      </Card>
    </div>
  )
}

function ChapterParked({ title }: { title: string }) {
  const tx = useTx()
  return (
    <div className="a3-sheet">
      <p className="text-body text-text-primary">
        <span aria-hidden="true">○ </span>
        Kapitel «{title}» ist im Prototyp nicht ausgearbeitet.
      </p>
      <p className="mt-2 max-w-content text-small text-text-secondary">{tx('Die Kalkulation der Fixture hängt an den Kapiteln 2–4; dieses Kapitel zeigt im Prototyp bewusst keinen erfundenen Inhalt. Der volle Kapitelumfang ist in der Screen-Map spezifiziert.')}</p>
    </div>
  )
}
