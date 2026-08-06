import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import opportunities from '../fixtures/opportunities.json'
import derived from '../fixtures/derived-prototype.json'
import { useStore } from '../state/store'
import { NNBSP, formatDE } from '../engine/money'
import { Button } from '../components/primitives'
import { useTx } from '../i18n'
import { DocumentAnalysis } from '../components/DocumentAnalysis'
import { ReadinessRing } from '../components/ReadinessRing'
import { S2Vorbereitung } from './S2Vorbereitung'
import { useState } from 'react'

/**
 * Карточка Opportunity — уровень между списком и рабочим конвейером.
 *
 * Порядок на экране повторяет порядок работы, а не структуру данных:
 * сначала анализ документов, затем его результат, затем спорное, затем
 * то, что относится ко всему проекту, и только потом — гейт создания
 * Options. Пользователь не может создать Option раньше, чем разрешит
 * конфликты и подтвердит параметры: Option, построенный на спорных
 * данных, придётся переделывать целиком.
 *
 * Цены здесь нет и быть не может: цена принадлежит Option, а Option ещё
 * не существует. Показать сумму на этом уровне значило бы пообещать
 * число, у которого нет конфигурации.
 */

const D = (s: string) => new Decimal(s)
const MARK = derived.marker
const DERIVED = derived.provenanceLabel

/** Значение с обязательной пометкой происхождения (D-22). */
function Metric({ label, value, unit, note }: {
  label: string
  value: string | null
  unit?: string
  /** Заполнено только у выведенных значений: пометка приходит из данных. */
  note?: string
}) {
  return (
    <div className="border-b border-border-subtle py-2">
      <span className="a3-cap block">{label}</span>
      <span className="numeric block text-body text-text-primary">
        {value === null
          ? <span className="text-text-secondary">nicht erfasst</span>
          : <>{value}{unit ? `${NNBSP}${unit}` : ''}{note ? `${NNBSP}${MARK}` : ''}</>}
      </span>
      {note && <span className="a3-cap block text-text-muted">{DERIVED} · {note}</span>}
    </div>
  )
}

export function OpportunityCard() {
  const s = useStore()
  const tx = useTx()
  const meta = opportunities.items.find((o) => o.id === s.opportunityId)
  // Подготовка (вопросы, Annahmen, варианты) — уровень Opportunity, не
  // Option: она общая для всех Options этого проекта. В конвейере её нет.
  const [showVorbereitung, setShowVorbereitung] = useState(false)

  if (!meta) return null

  // Кейс проработан только один: остальные честно говорят об этом здесь,
  // а не изображают анализ, которого в прототипе нет.
  if (!meta.worked) {
    return (
      <div className="px-7 py-6">
        <header className="border-b border-border-strong pb-4">
          <p className="a3-cap">{meta.city} · {meta.country} · {meta.owner}</p>
          <h1 className="mt-1 text-heading-2 font-bold text-text-primary">{meta.name}</h1>
        </header>
        <p className="mt-5 border border-border-default p-4 text-body text-text-secondary">
          <span aria-hidden="true">○ </span>
          Diese Opportunity ist im Prototyp nicht ausgearbeitet. Vollständig
          durchgerechnet ist «{opportunities.items[0]!.name}» — dort läuft die
          Dokumentanalyse, die Konfliktlösung und die Kalkulation mit echter
          Arithmetik.
        </p>
        <div className="mt-4">
          <Button onClick={() => s.backToList()}>{tx('Zurück zu den Opportunities')}</Button>
        </div>
      </div>
    )
  }

  // ── Параметры уровня проекта: суммы от сумм, никогда среднее из средних. ──
  const bs = demo.buildings
  const sum = (pick: (b: typeof bs[number]) => string | null | undefined) =>
    bs.reduce((a, b) => { const v = pick(b); return v ? a.plus(D(v)) : a }, new Decimal(0))

  const totalBgfR = sum((b) => b.areas.bgfAboveGround)
  const totalBgfS = bs.reduce((a, b) => {
    const d = (derived.buildings as Record<string, { bgfSAboveGround?: { value: string | null } }>)[b.id]
    const v = d?.bgfSAboveGround?.value
    return v ? a.plus(D(v)) : a
  }, new Decimal(0))
  const totalWfl = sum((b) => b.areas.wflWoFlV)
  const totalNuf = sum((b) => b.areas.nufDin277)
  const totalUnits = sum((b) => b.areas.wohneinheiten)
  const totalNrf = bs.reduce((a, b) => {
    const d = (derived.buildings as Record<string, { nrf?: { value: string | null } }>)[b.id]
    const v = d?.nrf?.value
    return v ? a.plus(D(v)) : a
  }, new Decimal(0))

  if (showVorbereitung) {
    return (
      <div>
        <div className="px-7 pt-5">
          <Button onClick={() => setShowVorbereitung(false)}>
            ← Zur Opportunity-Übersicht
          </Button>
        </div>
        <S2Vorbereitung openKonfigurator={() => {
          setShowVorbereitung(false)
          if (s.options.length > 0) s.openOption(s.options[0]!.id)
        }} />
      </div>
    )
  }

  const konfliktOffen = s.wflConflict.state === 'open'
  const gateDone = [!konfliktOffen, s.projectParamsConfirmed].filter(Boolean).length

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <p className="a3-cap">{meta.city} · {meta.country} · {meta.owner} · {meta.stage}</p>
        <h1 className="mt-1 text-heading-2 font-bold text-text-primary">{meta.name}</h1>
      </header>

      {/* 1 · Анализ документации — верхний уровень карточки. */}
      <section className="a3-sheet mt-5" aria-label="Dokumentanalyse">
        <DocumentAnalysis
          docs={demo.documents.map((d) => ({
            file: d.file,
            pages: typeof d.pages === 'number' ? d.pages : null,
            parseStatus: d.parseStatus,
          }))}
          onManualCapture={() => {}}
        />
      </section>

      {/* 2 · Спорное из документации — до параметров: параметр, выведенный
          из спорного значения, тоже спорен. */}
      <section className="a3-sheet mt-6" aria-label="Strittige Angaben">
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Strittige Angaben aus der Dokumentation')}
        </h2>
        {konfliktOffen ? (
          <div className="a3-konflikt mt-3">
            <p className="text-body text-text-primary">
              <span aria-hidden="true">▲ </span>
              Wohnfläche WFL nach WoFlV: zwei Kandidaten.
            </p>
            <ul className="mt-2">
              {s.wflConflict.candidates.map((c) => (
                <li key={c.origin} className="a3-cap">
                  {c.origin === 'customer' ? 'Kunde' : 'Dokument'}: {formatDE(D(c.value), 2)}
                  {NNBSP}m² · {c.source}
                </li>
              ))}
            </ul>
            <p className="a3-cap mt-2">
              Folge der Wahl: nur der Nenner der Leitkennzahl ändert sich, die
              Zwischensumme der kalkulierten Positionen bleibt gleich. Der
              nicht gewählte Kandidat bleibt als Alternative nachvollziehbar.
            </p>
            <div className="a3-row mt-3">
              <Button variant="primary" onClick={() => s.resolveWflConflict('customer')}>
                Kundenwert übernehmen
              </Button>
              <Button onClick={() => s.resolveWflConflict('document')}>
                Dokumentwert beibehalten
              </Button>
            </div>
          </div>
        ) : (
          <p className="a3-cap mt-2">
            <span aria-hidden="true">✓ </span>
            Alle Konflikte entschieden. Die nicht gewählte Alternative bleibt
            im Journal nachvollziehbar.
          </p>
        )}
      </section>

      {/* 3 · Параметры всего проекта. Суммы считаются от сумм (правило 39). */}
      <section className="a3-sheet mt-6" aria-label="Projektparameter">
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Parameter des gesamten Projekts')}
        </h2>
        <div className="mt-3 grid gap-x-6"
             style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(26ch, 1fr))' }}>
          <Metric label="Gebäude im Projekt" value={String(bs.length)} />
          <Metric label={`Total BGF (R, oberirdisch)`} value={formatDE(totalBgfR, 2)} unit="m²" />
          <Metric label="Total BGF (S)" value={formatDE(totalBgfS, 2)} unit="m²"
                  note="Balkonanteil abgeleitet" />
          <Metric label="Total BGF (R+S)" value={formatDE(totalBgfR.plus(totalBgfS), 2)}
                  unit="m²" note="enthält die abgeleitete S-Fläche" />
          <Metric label="Total NRF" value={formatDE(totalNrf, 2)} unit="m²"
                  note="≈ 85 % der BGF R+S" />
          <Metric label="Total WFL nach WoFlV" value={formatDE(totalWfl, 2)} unit="m²" />
          <Metric label="Total NUF nach DIN 277" value={formatDE(totalNuf, 2)} unit="m²" />
          <Metric label="Wohneinheiten" value={formatDE(totalUnits)} />
        </div>
        {!s.projectParamsConfirmed && (
          <div className="mt-4">
            <Button variant="primary" onClick={() => s.confirmProjectParams()}>
              Projektparameter bestätigen
            </Button>
          </div>
        )}
        {s.projectParamsConfirmed && (
          <p className="a3-cap mt-3">
            <span aria-hidden="true">✓ </span>Projektparameter bestätigt.
          </p>
        )}
      </section>

      <section className="a3-sheet mt-6" aria-label="Vorbereitung">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="a3-cap">
            Offene Fragen, Annahmen und Dokumente im Detail — die Vorbereitung
            gilt für alle Optionen dieser Opportunity.
          </p>
          <Button onClick={() => setShowVorbereitung(true)}>
            {tx('Vorbereitung öffnen')}
          </Button>
        </div>
      </section>

      {/* 4 · Гейт и Options. */}
      <section className="a3-sheet mt-6" aria-label="Opportunity Options">
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Opportunity Options')}</h2>
        <div className="mt-3">
          <ReadinessRing
            label="Bereitschaft für Optionen"
            done={gateDone}
            total={2}
          />
        </div>
        {!s.canCreateOptions() && (
          <p className="a3-warn-prep mt-3">
            <span aria-hidden="true">▲ </span>
            Optionen lassen sich anlegen, sobald die strittigen Angaben
            entschieden und die Projektparameter bestätigt sind. Eine Option
            auf strittigen Daten müsste vollständig neu gebaut werden.
          </p>
        )}

        {s.options.length > 0 && (
          <ul className="mt-3">
            {s.options.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-2">
                <span className="text-body text-text-primary">{o.name} · {o.id}</span>
                <Button onClick={() => s.openOption(o.id)}>{tx('Öffnen')}</Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <Button
            variant="primary"
            disabled={!s.canCreateOptions()}
            disabledReason="Erst Konflikte entscheiden und Projektparameter bestätigen"
            onClick={() => s.createOption(`Option ${s.options.length + 1}`)}
          >
            Opportunity Option anlegen
          </Button>
        </div>
      </section>
    </div>
  )
}
