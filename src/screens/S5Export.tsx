import { useState } from 'react'
import { Decimal } from 'decimal.js'
import { useStore } from '../state/store'
import { applyDiscount } from '../engine/calculate'
import { NNBSP, label as moneyLabel } from '../engine/money'
import { Button, UncertaintyBadge } from '../components/primitives'

/**
 * S5 Export — артефакты, скидка и отправка.
 *
 * Отправка — четыре стадии: Compose → Preflight → Confirm & Send →
 * Delivery status (EMAIL-001). Одноклик-отправки не существует; тело письма
 * видно и редактируемо ДО preflight; «Gesendet» и «Zugestellt» — разные
 * состояния, и второе не выводится из первого.
 *
 * Гейт живой: пока класс здания не подтверждён, открытый блокер закрывает
 * все пять клиентских профилей (R-07) — и кнопка отправки объясняет, что
 * именно открыто и какой следующий шаг, а не просто гаснет.
 */

const ARTIFACTS = [
  { id: 'praesentation', label: 'Angebotspräsentation (PDF)', default: true },
  { id: 'leistungen', label: 'Leistungen — enthalten / nicht enthalten', default: true },
  { id: 'ssl', label: 'Schnittstellenmatrix (SSL)', default: true },
  { id: 'baubeschreibung', label: 'Baubeschreibung', default: false },
  { id: 'kg', label: 'Kostenübersicht KG', default: false },
  { id: 'vertrag', label: 'Vertragsvorlagen für die Rechtsabteilung', default: false },
] as const

type Stage = 'compose' | 'preflight' | 'confirm' | 'gesendet' | 'zugestellt'

/**
 * Доставка в прототипе СИМУЛИРУЕТСЯ таймером — и это сказано пользователю
 * на экране, а не только в комментарии. Первая редакция автоматически
 * показывала «Zugestellt» как факт, одновременно объясняя, что второй
 * статус не следует из первого, — симуляция, выданная за реализацию.
 */
const DELIVERY_SIMULATION_MS = 2500

export function S5Export() {
  const s = useStore()
  const p = s.projection()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(ARTIFACTS.filter((a) => a.default).map((a) => a.id)),
  )
  const [discountOn, setDiscountOn] = useState(false)
  const [stage, setStage] = useState<Stage>('compose')
  const [body, setBody] = useState(
    'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser indikatives ' +
    'Angebot für das Musterprojekt Nordfeld.\n\nMit freundlichen Grüßen',
  )

  const total = p.result.total.exact
  const discounted = applyDiscount(total, new Decimal('3'))

  // Preflight — вывод, не заявление: блокер, интервал, допущения.
  const blockers: string[] = []
  if (!s.building.gebaeudeklasse.confirmed) {
    blockers.push(
      'ValidationIssue offen: Klassifikation nach MBO §2 nicht bestätigt — ' +
      'blockiert alle fünf Kundenprofile (R-07)',
    )
  }
  const warnings: string[] = []
  if (p.uncertaintyPp > 25) {
    warnings.push(`Schätzunsicherheit ±${NNBSP}${p.uncertaintyPp}${NNBSP}% liegt über ±${NNBSP}25${NNBSP}%`)
  }
  if (s.coverage.KG_500 === 'unknown') {
    warnings.push('KG 500: Deckungsentscheidung offen — Angebot weist Zwischensumme aus')
  }

  const sendEnabled = stage === 'confirm' && blockers.length === 0 &&
    selected.size > 0 && body.trim().length > 0

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <h1 className="text-heading-2 font-bold text-text-primary">Export · Musterprojekt Nordfeld</h1>
      </header>

      <div className="grid gap-6 py-5 lg:grid-cols-2">
        <section aria-label="Artefakte und Rabatt">
          <h2 className="text-heading-3 font-bold text-text-primary">Artefakte</h2>
          <ul className="mt-3">
            {ARTIFACTS.map((a) => (
              <li key={a.id} className="border-b border-border-subtle">
                <label className="relative flex min-h-hit-target cursor-pointer items-center gap-3 py-2 text-body text-text-primary">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={(e) => {
                      const next = new Set(selected)
                      e.target.checked ? next.add(a.id) : next.delete(a.id)
                      setSelected(next)
                    }}
                    className="h-4 w-4 accent-[color:var(--color-selection-border)]"
                  />
                  {a.label}
                  <span className="ml-auto text-small text-text-muted">Muster</span>
                </label>
              </li>
            ))}
          </ul>

          <h2 className="mt-6 text-heading-3 font-bold text-text-primary">Rabatt</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant={discountOn ? 'secondary' : 'primary'}
                    onClick={() => setDiscountOn(false)} aria-pressed={!discountOn}>
              kein
            </Button>
            <Button variant={discountOn ? 'primary' : 'secondary'}
                    onClick={() => setDiscountOn(true)} aria-pressed={discountOn}>
              prozentual 3,0{NNBSP}%
            </Button>
          </div>
          {discountOn && (
            <div className="mt-3 border border-border-default p-3">
              <p className="numeric text-body text-text-primary">
                {moneyLabel(discounted)}
              </p>
              <p className="mt-1 text-small text-text-secondary">
                Basis ist der exakte Rechenwert, nie der angezeigte
                (CALC-007). {discounted.disclosure}
              </p>
            </div>
          )}
        </section>

        <section aria-label="Versand">
          <h2 className="text-heading-3 font-bold text-text-primary">
            Versand · Stufe: {stageLabel(stage)}
          </h2>

          {stage === 'compose' && (
            <>
              <p className="mt-2 text-small text-text-secondary">
                An: kontakt@beispiel-entwickler.example (aus HubSpot)
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                aria-label="E-Mail-Text"
                className="mt-2 w-full border border-border-default p-3 text-body text-text-primary outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
              />
              <div className="mt-3">
                <Button variant="primary" onClick={() => setStage('preflight')}>
                  Weiter zum Preflight
                </Button>
              </div>
            </>
          )}

          {stage === 'preflight' && (
            <div className="mt-3">
              {blockers.map((b) => (
                <p key={b} className="border-contrast border-border-error p-3 text-body text-text-primary">
                  <span aria-hidden="true">✗ </span>{b}
                </p>
              ))}
              {warnings.map((w) => (
                <p key={w} className="mt-2 border border-border-warning p-3 text-body text-text-primary">
                  <span aria-hidden="true">▲ </span>{w}
                </p>
              ))}
              <div className="mt-3 border border-border-default p-3">
                <p className="text-small font-medium text-text-primary">Finale Prüfung</p>
                <ul className="mt-1 text-small text-text-secondary">
                  <li>Anhänge: {selected.size} · Muster-Dateien des Prototyps, als clientSafe klassifiziert</li>
                  <li>Aktive Annahmen: {s.building.gebaeudeklasse.confirmed ? 1 : 2}</li>
                  <li><UncertaintyBadge pp={p.uncertaintyPp} /></li>
                  <li>Sprache: DE · vollständig</li>
                  {/* Рекомендация G6-gate (правило 11/D-16): пункт чек-листа,
                      не запрет — плотность остаётся выбором пользователя. */}
                  <li>
                    {s.density === 'kompakt'
                      ? <><span aria-hidden="true">▲ </span>Dichte: Kompakt —
                          vor dem Teilen des Bildschirms wird Komfortabel empfohlen</>
                      : <><span aria-hidden="true">✓ </span>Dichte: Komfortabel</>}
                  </li>
                </ul>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setStage('compose')}>Zurück</Button>
                <Button
                  variant="primary"
                  disabled={blockers.length > 0}
                  disabledReason={blockers[0]}
                  onClick={() => setStage('confirm')}
                >
                  {blockers.length > 0 ? 'Blockiert — Klassifikation bestätigen' : 'Preflight bestanden — weiter'}
                </Button>
              </div>
              {blockers.length > 0 && (
                <div className="mt-2">
                  <Button onClick={() => s.confirmGebaeudeklasse()}>
                    Nächster Schritt: Klassifikation bestätigen
                  </Button>
                </div>
              )}
            </div>
          )}

          {stage === 'confirm' && (
            <div className="mt-3 border border-border-default p-3">
              <p className="text-body text-text-primary">
                {selected.size} Anhänge · Empfänger geprüft · Text geprüft ·
                Sprache DE
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setStage('preflight')}>Zurück</Button>
                <Button
                  variant="primary"
                  disabled={!sendEnabled}
                  disabledReason="Preflight nicht vollständig"
                  onClick={() => {
                    // Отправка = снапшот + событие (M-3): состояние, от
                    // которого клиент получил числа, зафиксировано до письма.
                    s.sendOffer('email', discountOn ? '3.0' : null)
                    setStage('gesendet')
                    setTimeout(() => setStage('zugestellt'), DELIVERY_SIMULATION_MS)
                  }}
                >
                  Bestätigen &amp; senden
                </Button>
              </div>
            </div>
          )}

          {(stage === 'gesendet' || stage === 'zugestellt') && (
            <div className="mt-3 border border-border-default p-3">
              <p className="text-body text-text-primary">
                {stage === 'gesendet'
                  ? <><span aria-hidden="true">◌ </span>Gesendet — Zustellung ausstehend</>
                  : <><span aria-hidden="true">✓ </span>Zugestellt (simulierte Zustellbestätigung)</>}
              </p>
              <p className="mt-1 text-small text-text-secondary">
                «Gesendet» und «Zugestellt» sind zwei Zustände: der zweite
                folgt nicht aus dem ersten (EMAIL-007). Der Prototyp hat
                keinen E-Mail-Versand — die Zustellbestätigung wird nach
                2,5{NNBSP}Sekunden simuliert und ist als Simulation
                gekennzeichnet. Snapshot und Ereignis offer.emailed stehen
                im Journal.
              </p>
              {s.snapshots.length > 0 && (
                <p className="mt-2 text-small text-text-muted">
                  Snapshot {s.snapshots.at(-1)!.id}: Zwischensumme{' '}
                  {s.snapshots.at(-1)!.totalExact}{NNBSP}€ exakt ·
                  Regionalfaktor {s.snapshots.at(-1)!.regionalfaktorActive
                    ? 'aktiviert' : 'nicht aktiviert'} · ±{NNBSP}
                  {s.snapshots.at(-1)!.uncertaintyPp}{NNBSP}% ·
                  Journal-Stand {s.snapshots.at(-1)!.journalSeqAt}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function stageLabel(s: Stage): string {
  return s === 'compose' ? 'Compose'
    : s === 'preflight' ? 'Preflight'
      : s === 'confirm' ? 'Confirm & Send'
        : s === 'gesendet' ? 'Delivery status · Gesendet'
          : 'Delivery status · Zugestellt'
}
