import { useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import catalog from '../fixtures/catalog.json'
import { useStore } from '../state/store'
import { NNBSP, formatDE, rateLabel } from '../engine/money'
import { Button, NumericField, ProvenanceChip, UncertaintyBadge } from '../components/primitives'
import { DocumentAnalysis } from '../components/DocumentAnalysis'

/**
 * S2 Vorbereitung — пять вкладок приватной подготовки.
 *
 * Экран существует только во внутреннем режиме: Δ-значения, коучинг и
 * происхождение с номерами страниц клиенту не показываются (правило 11).
 *
 * Ядро вкладки P1 — разрешение версий документов: система ПРЕДЛАГАЕТ по
 * дате в штампе, но дата — доказательство, а не решение (VERSION-002);
 * переключает sales, и переключение — событие журнала. Ядро P3 — вопросы,
 * отсортированные по величине сужения в процентных пунктах, риск отдельной
 * типизированной строкой (CALC-001).
 */

const TABS = ['Dokumente', 'Projektdaten', 'Offene Fragen', 'Annahmen', 'Varianten'] as const
type Tab = (typeof TABS)[number]

export function S2Vorbereitung({ openKonfigurator }: { openKonfigurator: () => void }) {
  const s = useStore()
  const [tab, setTab] = useState<Tab>('Projektdaten')
  const tablist = useRef<HTMLDivElement>(null)

  // Табы по контракту (TABS-001, KEY-003): стрелки двигают ТОЛЬКО фокус
  // (roving tabindex), активация ручная — Enter/Space; Home/End — края.
  // Автоактивация на стрелке запускала бы пересчёт тяжёлых панелей.
  const [focusIdx, setFocusIdx] = useState(TABS.indexOf(tab))
  const moveFocus = (next: number) => {
    setFocusIdx(next)
    const btns = tablist.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    btns?.[next]?.focus()
  }
  const onKey = (e: React.KeyboardEvent) => {
    const len = TABS.length
    const next = e.key === 'ArrowRight' ? (focusIdx + 1) % len
      : e.key === 'ArrowLeft' ? (focusIdx - 1 + len) % len
        : e.key === 'Home' ? 0
          : e.key === 'End' ? len - 1
            : null
    if (next !== null) { e.preventDefault(); moveFocus(next); return }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setTab(TABS[focusIdx]!)
    }
  }

  return (
    <div className="px-7 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-strong pb-3">
        <h1 className="text-heading-2 font-bold text-text-primary">
          Musterprojekt Nordfeld · Vorbereitung
        </h1>
        <span className="text-small text-text-secondary">
          {s.mode === 'praesentation'
            ? 'Präsentation · interne Werte ausgeblendet'
            : `intern · Δ-Werte sichtbar`}
        </span>
      </header>

      {/* Табы — примитив системы (`.a3-tabs[role=tablist] > [role=tab]`,
          затем `.a3-tabpane[role=tabpanel]`): подчёркивание активного,
          промежутки и типографика приходят оттуда. */}
      <div ref={tablist} role="tablist" aria-label="Vorbereitung"
           className="a3-tabs mt-4" onKeyDown={onKey}>
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-p${i + 1}`}
            aria-selected={tab === t}
            aria-controls="vorbereitung-panel"
            tabIndex={focusIdx === i ? 0 : -1}
            onClick={() => { setTab(t); setFocusIdx(i) }}
            className={'relative before:absolute before:left-1/2 before:top-1/2 ' +
              'before:min-h-hit-target before:w-full before:-translate-x-1/2 ' +
              'before:-translate-y-1/2 before:content-[""] outline-none ' +
              'focus-visible:outline focus-visible:outline-2 ' +
              'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'}
          >
            P{i + 1}{NNBSP}·{NNBSP}{t}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="vorbereitung-panel"
           aria-labelledby={`tab-p${TABS.indexOf(tab) + 1}`} className="a3-tabpane py-5">
        {tab === 'Dokumente' && <P1Dokumente onManualCapture={() => setTab('Projektdaten')} />}
        {tab === 'Projektdaten' && <P2Projektdaten />}
        {tab === 'Offene Fragen' && <P3OffeneFragen />}
        {tab === 'Annahmen' && <P4Annahmen setTab={setTab} />}
        {tab === 'Varianten' && <P5Varianten openKonfigurator={openKonfigurator} />}
      </div>
    </div>
  )
}

/* ── P1 · Dokumente ──────────────────────────────────────────────────────── */

function P1Dokumente({ onManualCapture }: { onManualCapture: () => void }) {
  const s = useStore()
  const docs = demo.documents

  return (
    <section aria-label="Dokumente">
      {/* DC-10: анализ уже завершён по фикстуре — протокол сохранён; повторный
          запуск проигрывает симуляцию, не трогая bestätigt-значения (M-1). */}
      <DocumentAnalysis
        docs={docs.map((d) => ({
          file: d.file,
          pages: typeof d.pages === 'number' ? d.pages : null,
          parseStatus: d.parseStatus,
        }))}
        onManualCapture={onManualCapture}
      />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Hochgeladene Dokumente</caption>
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th className="py-2 pr-4 font-medium">Datei</th>
              <th className="py-2 pr-4 font-medium">Seiten</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.file} className="border-b border-border-subtle">
                <td className="py-2 pr-4 text-text-primary">{d.file}</td>
                <td className="numeric py-2 pr-4 text-text-secondary">{d.pages}</td>
                <td className="py-2 text-text-secondary">
                  {d.parseStatus === 'failed'
                    ? <><span aria-hidden="true">✗ </span>nicht lesbar</>
                    : d.lifecycleStatus === 'superseded'
                      ? <><span aria-hidden="true">◌ </span>ersetzt</>
                      : <><span aria-hidden="true">✓ </span>aktiv · gelesen</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Разрешение версий: дата — доказательство, решает sales. */}
      <div className="mt-5 border border-border-default p-4">
        <h2 className="text-heading-3 font-bold text-text-primary">Versionsauflösung · Grundrisse</h2>
        <p className="mt-2 text-small text-text-secondary">
          Zwei Versionen gefunden. Vorschlag des Systems: V2 — Datum im
          Plankopf ist neuer. Das Datum ist ein Beleg, keine Entscheidung
          (VERSION-002): die Auswahl trifft der Vertrieb, der Wechsel wird
          protokolliert, die ausgeschlossene Version bleibt nachvollziehbar.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['V2', 'V1'] as const).map((v) => (
            <Button
              key={v}
              variant={s.activeGrundrisse === v ? 'primary' : 'secondary'}
              onClick={() => s.activateGrundrisse(v)}
              aria-pressed={s.activeGrundrisse === v}
            >
              {s.activeGrundrisse === v && <span aria-hidden="true">✓ </span>}
              Grundrisse_Muster_{v}.pdf
            </Button>
          ))}
        </div>
        <p className="mt-3 text-small text-text-muted">
          Wiederholte Analyse überschreibt niemals Werte mit «manuell erfasst»
          oder «vom Kunden bestätigt» — bei Konflikt entscheidet der Vertrieb
          über den Diff (D-08).
        </p>
      </div>
    </section>
  )
}

/* ── P2 · Projektdaten ───────────────────────────────────────────────────── */

function P2Projektdaten() {
  const s = useStore()
  const p = s.projection()
  const fxA = demo.buildings[0]!

  return (
    <section aria-label="Projektdaten">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-heading-3 font-bold text-text-primary">Gebäudekennzahlen</h2>
        <span className="text-small text-text-secondary">Haus{NNBSP}A</span>
      </div>

      <div className="mt-3 border border-border-default p-4">
        <NumericField
          label="BGF oberirdisch"
          value={s.fields.bgfOber.value}
          unit="m²"
          provenance={`${s.fields.bgfOber.provenance} · S. 15`}
          onCommit={(v, c) => s.editField('bgfOber', v, c)}
        />
        <StaticRow label="BGF unterirdisch" value={`${formatDE(new Decimal(fxA.areas.bgfBelowGround!), 2)}${NNBSP}m²`} provenance="aus Dokument · S. 7" />
        <StaticRow label="BGF S (nicht umschlossen)" value={`0,00${NNBSP}m²`} provenance="aus Dokument" />

        <NumericField
          label="Wohnfläche WFL nach WoFlV"
          value={s.fields.wfl.value}
          unit="m²"
          provenance={`${s.fields.wfl.provenance} · S. 12`}
          onCommit={(v, c) => s.editField('wfl', v, c)}
        />

        {/* Открытый конфликт значения: последствие названо ДО выбора. */}
        {s.wflConflict.state === 'open' && (
          <div className="mt-2 border-contrast border-border-warning p-3">
            <p className="text-body text-text-primary">
              <span aria-hidden="true">▲ </span>
              Konflikt: Kunde nennt 1.560,00{NNBSP}m² (VerificationEvent
              {s.mode === 'intern' ? ' DEMO-VE-0002' : ''}), Dokument zeigt
              1.500,00{NNBSP}m².
            </p>
            <p className="mt-1 text-small text-text-secondary">
              Folge der Übernahme: nur der Nenner ändert sich — Leitkennzahl
              {NNBSP}≈{NNBSP}2.545 → ≈{NNBSP}2.447{NNBSP}€/m² WFL nach WoFlV,
              die «Zwischensumme der kalkulierten Positionen» bleibt
              unverändert. Der nicht gewählte
              Kandidat bleibt als Alternative nachvollziehbar (SOURCE-001).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => s.resolveWflConflict('customer')}>
                Kundenwert übernehmen
              </Button>
              <Button onClick={() => s.resolveWflConflict('document')}>
                Dokumentwert beibehalten
              </Button>
            </div>
          </div>
        )}

        {s.wflConflict.state === 'resolved' && (
          <p className="mt-2 text-small text-text-secondary">
            <span aria-hidden="true">✓ </span>
            Konflikt gelöst. Alternative bleibt nachvollziehbar:{' '}
            {s.wflConflict.candidates
              .filter((c) => c.selectionStatus === 'alternative')
              .map((c) => `${formatDE(new Decimal(c.value), 2)}${NNBSP}m² (${c.origin === 'document' ? 'Dokument' : 'Kunde'})`)
              .join(' · ')}{' '}
            — selectionStatus «alternative», nicht «superseded» (SOURCE-001).
          </p>
        )}

        <StaticRow label="Balkon-Anrechnung" value={`${catalog.internalConfig.balconyDefaultPercent}${NNBSP}%`} provenance={`${catalog.internalConfig.balconySource} · Standard, auf Kundenwunsch 50 %`} />

        <NumericField
          label="Wohneinheiten"
          value={s.fields.we.value}
          decimals={0}
          provenance={s.fields.we.provenance}
          onCommit={(v, c) => s.editField('we', v, c)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-4">
          <div>
            <p className="text-small font-medium text-text-primary">Gebäudeklasse</p>
            <p className="mt-1 text-body text-text-primary">
              GK{NNBSP}5{' '}
              {s.building.gebaeudeklasse.confirmed
                ? <ProvenanceChip provenance="vom Kunden bestätigt" />
                : <span className="text-small text-text-secondary">
                    <span aria-hidden="true">▲ </span>
                    Prüfung erforderlich · Prüfauslöser: 5 Vollgeschosse · Δ{NNBSP}±{NNBSP}{catalog.internalConfig.gebaeudeklasseDeltaPp}{NNBSP}%
                  </span>}
            </p>
          </div>
          {!s.building.gebaeudeklasse.confirmed && (
            <Button onClick={() => s.confirmGebaeudeklasse()}>Bestätigen</Button>
          )}
        </div>

        <StaticRow
          label="Energiestandard"
          value={s.building.energiestandard.replace('_', NNBSP)}
          provenance={s.esConfirmed ? 'vom Kunden bestätigt' : 'Projektabstimmung'}
        />
      </div>

      <p className="mt-3 text-small text-text-muted">
        Aktuelle Leitkennzahl: {rateLabel(p.leadRate)} · Δ-Werte erscheinen nur
        hier und nie in der Kundenansicht (Regel 11).
      </p>
    </section>
  )
}

function StaticRow({ label, value, provenance }: { label: string; value: string; provenance: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3">
      <span className="text-small font-medium text-text-primary">{label}</span>
      <span className="numeric text-body text-text-primary">{value}</span>
      <ProvenanceChip provenance={provenance} />
    </div>
  )
}

/* ── P3 · Offene Fragen ──────────────────────────────────────────────────── */

function P3OffeneFragen() {
  const s = useStore()
  const p = s.projection()

  // Сортировка по величине сужения; Δ — в процентных пунктах (CALC-001).
  const wflDone = s.fields.wfl.provenance === 'vom Kunden bestätigt'
  const questions = [
    {
      text: 'Liegt eine Wohnflächenberechnung nach WoFlV vor?',
      deltaPp: 5, blocking: false, done: wflDone,
      action: null, // закрывается вводом значения в P2 либо решением конфликта
    },
    {
      text: 'Welcher Effizienzhaus-Standard ist vorgesehen?',
      deltaPp: 4, blocking: false, done: s.esConfirmed,
      action: () => s.confirmEnergiestandardAnswer(),
    },
  ]
  const open = questions.filter((q) => !q.done)
  const target = p.uncertaintyPp - open.reduce((a, q) => a + q.deltaPp, 0)

  return (
    <section aria-label="Offene Fragen">
      <h2 className="text-heading-3 font-bold text-text-primary">
        {open.length > 0
          ? <>Diese {open.length} Fragen reduzieren die Schätzunsicherheit von
              ±{NNBSP}{p.uncertaintyPp}{NNBSP}% auf ±{NNBSP}{target}{NNBSP}%</>
          : <>Alle Fragen beantwortet · <UncertaintyBadge pp={p.uncertaintyPp} /></>}
      </h2>
      <p className="mt-1 text-small text-text-secondary">
        Nach Wirkung sortiert; Verengung in Prozentpunkten. Eine Option zu
        wählen verengt nichts — nur die Bestätigung des Kunden (D-19).
      </p>

      <ol className="mt-4">
        {questions.map((q, i) => (
          <li key={q.text} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3">
            <span className={'text-body ' + (q.done ? 'text-text-muted' : 'text-text-primary')}>
              {q.done && <span aria-hidden="true">✓ </span>}
              {i + 1}. {q.text}
            </span>
            <span className="numeric text-body text-text-secondary">
              −{NNBSP}{q.deltaPp}{NNBSP}Prozentpunkte
            </span>
            {!q.done && q.action && (
              <Button onClick={q.action}>Antwort erfassen</Button>
            )}
            {!q.done && !q.action && (
              <span className="text-small text-text-muted">
                → P2: Wert erfassen oder Konflikt lösen
              </span>
            )}
          </li>
        ))}
        {/* Риск — отдельная ось с отдельной арифметикой, не строка списка Δ. */}
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="text-body text-text-primary">
            3. Ist ein Baugrundgutachten vorhanden?
          </span>
          <span className="text-body text-text-secondary">
            → Risiko: Baugrund · Wahrscheinlichkeit mittel ·
            Kostenwirkung +{NNBSP}4{NNBSP}% auf KG{NNBSP}320
          </span>
        </li>
      </ol>

      <div className="mt-4">
        <Button onClick={() => {
          const text = questions.filter((q) => !q.done).map((q, i) => `${i + 1}. ${q.text}`).join('\n')
          void navigator.clipboard?.writeText(text || 'Alle Fragen beantwortet.')
        }}>
          Fragenliste kopieren
        </Button>
      </div>
    </section>
  )
}

/* ── P4 · Annahmen ───────────────────────────────────────────────────────── */

function P4Annahmen({ setTab }: { setTab: (t: Tab) => void }) {
  const s = useStore()

  // Активное допущение = каскад дошёл до подстановки (M-4). Список выводится
  // из состояния, а не поддерживается руками — поэтому он всегда точен.
  const items: Array<{ id: string; text: string; resolve?: () => void; resolveLabel?: string }> = []

  if (!s.building.gebaeudeklasse.confirmed) {
    items.push({
      id: 'gk',
      // Дословно t0-fallback-rules.md:106; в слот значения подставлен
      // проектный GK 5 (в тексте правила стоит пример GK 4).
      text: 'Die Gebäudeklasse ist noch nicht bestätigt. Die Geschossanzahl ist ' +
        'lediglich Prüfauslöser und kein Nachweis; die Einstufung nach MBO §2 ' +
        'erfolgt über das Brandschutzkonzept und die zugehörigen Nachweise. ' +
        'Für die Kalkulation ist vorläufig GK 5 hinterlegt, Stand ' +
        '«Prüfung erforderlich». Die endgültige Einstufung kann die ' +
        'Anforderungen an Tragwerk und Kapselung und damit den Preis ' +
        'verändern; mit Vorlage des Brandschutzkonzepts bestätigen wir sie.',
      resolve: () => s.confirmGebaeudeklasse(),
      resolveLabel: 'Klassifikation bestätigen',
    })
  }
  if (s.coverage.KG_500 === 'unknown') {
    items.push({
      id: 'kg500',
      // Дословно t0-fallback-rules.md:245, включая вводную о KG 300/400.
      text: 'Das Angebot umfasst die Kostengruppen 300 und 400 nach DIN 276. ' +
        'Die Kostengruppen 100, 200, 600 und 800 sind nicht enthalten. Für die ' +
        'Kostengruppe 500 (Außenanlagen und Freiflächen) liegt noch keine ' +
        'Deckungsentscheidung vor: sie ist weder eingeschlossen noch ' +
        'ausgeschlossen und bislang unbewertet. Solange dieser Zustand besteht, ' +
        'weist das Angebot eine «Zwischensumme der kalkulierten Positionen» ' +
        'und keinen Gesamtpreis aus (R-18, CALC-006). Die vollständige ' +
        'Abgrenzung ist der Leistungsübersicht zu entnehmen.',
    })
  }

  return (
    <section aria-label="Annahmen">
      <h2 className="text-heading-3 font-bold text-text-primary">
        Aktive Annahmen · {items.length}
      </h2>
      <p className="mt-1 text-small text-text-secondary">
        Texte stammen aus den Fallback-Regeln; das Wertfeld (z. B. die
        Gebäudeklasse) wird mit dem Projektwert belegt — der Regeltext nennt
        einen Beispielwert. Eine Annahme verschwindet, sobald der Wert
        erfasst ist — die Liste wird abgeleitet, nicht gepflegt.
      </p>
      {items.length === 0 && (
        <p className="mt-4 border border-border-default p-4 text-body text-text-secondary">
          Keine aktiven Annahmen. Alle T0-Werte sind erfasst oder bestätigt.
        </p>
      )}
      <ul className="mt-4">
        {items.map((a) => (
          <li key={a.id} className="mt-3 border border-border-default p-4">
            <p className="text-body text-text-primary">
              <span className="font-medium">Annahme:</span> {a.text}
            </p>
            <div className="mt-3">
              {a.resolve
                ? <Button onClick={a.resolve}>{a.resolveLabel}</Button>
                : <Button onClick={() => setTab('Projektdaten')}>
                    Entscheidung im Konfigurator · Kapitel 2
                  </Button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── P5 · Varianten ──────────────────────────────────────────────────────── */

function P5Varianten({ openKonfigurator }: { openKonfigurator: () => void }) {
  const s = useStore()
  const runs = demo.runs.filter((r) => r.subject === 'DEMO-B-A')

  const roleFor = (variant: string): string[] => {
    // Роли — независимые текстовые бейджи, не звезда с двумя смыслами
    // (VARIANT-001): базис и цель могут совпадать, каждый назван словом.
    const roles: string[] = []
    if (variant === 'Basis') roles.push('Vergleichsbasis', 'Aktuell bearbeitet')
    return roles
  }

  return (
    <section aria-label="Varianten">
      <h2 className="text-heading-3 font-bold text-text-primary">Varianten · Haus{NNBSP}A</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Varianten des Projekts</caption>
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th className="py-2 pr-4 font-medium">Variante</th>
              {/* Метрика называется полностью и в шапке колонки: усечённое
                  «Zwischensumme» — Unqualified Total (R-18/COPY-008). */}
              <th className="py-2 pr-4 text-right font-medium">
                Zwischensumme der kalkulierten Positionen
              </th>
              <th className="py-2 pr-4 font-medium">Rollen</th>
              <th className="py-2 font-medium"><span className="sr-only">Aktion</span></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.calculationRunId} className="border-b border-border-subtle">
                <td className="py-2 pr-4 text-text-primary">{r.variant}</td>
                <td className="numeric py-2 pr-4 text-right text-text-primary">
                  {r.total.prefix}{r.total.prefix ? NNBSP : ''}{r.total.display}{NNBSP}€
                </td>
                <td className="py-2 pr-4 text-small text-text-secondary">
                  {roleFor(r.variant!).join(' · ') || '—'}
                </td>
                <td className="py-2">
                  <Button variant="ghost" onClick={() => {
                    if (r.variant === 'EH 40') s.setEnergiestandard('EH_40')
                    if (r.variant === 'Ohne UG') s.setUntergeschoss('kein_ug')
                    openKonfigurator()
                  }}>
                    Im Konfigurator öffnen
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-small text-text-muted">
        Zielangebot ist noch nicht gesetzt. Rollen sind unabhängige
        Text-Badges: ★ ist für «Zielangebot» reserviert und trägt nie zwei
        Bedeutungen (VARIANT-001).
      </p>
    </section>
  )
}
