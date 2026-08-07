import { useState } from 'react'
import { Decimal } from 'decimal.js'
import { activeBuilding, useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { DiscountControl } from '../components/DiscountControl'
import { Button, UncertaintyBadge } from '../components/primitives'
import { useTx } from '../i18n'

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
  const tx = useTx()
  // Сколько ЦЕНОВЫХ событий этой Option произошло после отправки. Считается
  // из журнала против `journalSeqAt` снапшота — второго счётчика нет.
  const lastSnap = s.snapshots.at(-1)
  const changedAfterSend = lastSnap
    ? s.journal.filter((e) => e.seq > lastSnap.journalSeqAt
        && e.deltaExact !== null && e.optionId === s.activeOptionId).length
    : 0
  const p = s.projection()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(ARTIFACTS.filter((a) => a.default).map((a) => a.id)),
  )
  // Скидка — величина, а не флаг: контракт DC-25 требует слайдер со
  // значением, а не два состояния «есть / нет».
  const [discountPct, setDiscountPct] = useState<Decimal | null>(null)
  const [stage, setStage] = useState<Stage>('compose')
  const [body, setBody] = useState(
    'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser indikatives ' +
    'Angebot für das Musterprojekt Nordfeld.\n\nMit freundlichen Grüßen',
  )

  // Открытые решения по покрытию — то же множество, что делает итог
  // промежуточным: список Recap не может разойтись с подписью итога.
  const offen = (Object.keys(s.coverage) as Array<keyof typeof s.coverage>)
    .filter((g) => s.coverage[g] === 'unknown')
  const total = p.result.total.exact

  // Preflight — вывод, не заявление: блокер, интервал, допущения.
  const blockers: string[] = []
  if (!activeBuilding(s).gebaeudeklasse.confirmed) {
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
    warnings.push('KG 500: Deckungsentscheidung offen — Angebot weist eine '
      + '«Zwischensumme der kalkulierten Positionen» aus')
  }

  const sendEnabled = stage === 'confirm' && blockers.length === 0 &&
    selected.size > 0 && body.trim().length > 0

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <h1 className="text-heading-2 font-bold text-text-primary">
          Export · {s.options.find((o) => o.id === s.activeOptionId)?.name ?? 'Musterprojekt Nordfeld'}
        </h1>
      </header>

      <div className="grid gap-6 py-5 lg:grid-cols-2">
        <section aria-label="Artefakte und Rabatt">
          <h2 className="text-heading-3 font-bold text-text-primary">{tx('Artefakte')}</h2>
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
                  {tx(a.label)}
                  <span className="ml-auto text-small text-text-muted">{tx('Muster')}</span>
                </label>
              </li>
            ))}
          </ul>

          <h2 className="mt-6 text-heading-3 font-bold text-text-primary">{tx('Rabatt')}</h2>
          <div className="mt-2">
            <DiscountControl
              totalExact={total}
              percent={discountPct}
              onChange={setDiscountPct}
              mode={s.mode}
            />
          </div>
        </section>

        <section aria-label="Versand">
          <h2 className="text-heading-3 font-bold text-text-primary">
            {tx('Versand')} · {tx('Stufe')}: {stageLabel(stage)}
          </h2>

          {stage === 'compose' && (
            <div className="a3-mailcard mt-2">
              {/* Строки письма — контракт DC-41: адресат несёт провенанс
                  (aus HubSpot), вложения видны как собранный пакет. */}
              <div className="a3-mailrow">
                <span className="a3-lb">An</span>
                <span className="a3-chip-src">
                  <span aria-hidden="true" className="a3-dot" />{tx('kontakt@beispiel-entwickler.example · aus HubSpot')}</span>
              </div>
              <div className="a3-mailrow">
                <span className="a3-lb">{tx('Betreff')}</span>
                <input
                  value={`Indikatives Angebot – ${s.options.find((o) => o.id === s.activeOptionId)?.name ?? 'Musterprojekt Nordfeld'}`}
                  readOnly
                  aria-label="Betreff"
                />
              </div>
              <div className="a3-mailrow">
                <span className="a3-lb">{tx('Anlagen')}</span>
                {ARTIFACTS.filter((a) => selected.has(a.id)).map((a) => (
                  <span key={a.id} className="a3-tag a3-green">{tx(a.label)} · Muster</span>
                ))}
                {selected.size === 0 && (
                  <span className="a3-cap">{tx('keine — links auswählen')}</span>
                )}
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                aria-label="E-Mail-Text"
                className="mt-2 w-full border border-border-default p-3 text-body text-text-primary outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
              />
              <div className="mt-3">
                <Button variant="primary" onClick={() => setStage('preflight')}>
                  {tx('Weiter zum Preflight')}
                </Button>
              </div>
            </div>
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
              <div className="mt-3">
                <p className="text-small font-medium text-text-primary">{tx('Finale Prüfung')}</p>
                <ul className="a3-preflight-list">
                  <li>✓ Anhänge: {selected.size} · Muster-Dateien des Prototyps, als clientSafe klassifiziert</li>
                  <li>✓ Aktive Annahmen: {activeBuilding(s).gebaeudeklasse.confirmed ? 1 : 2}</li>
                  <li><UncertaintyBadge pp={p.uncertaintyPp} /></li>
                  <li>{tx('✓ Sprache: DE · vollständig')}</li>
                  {/* Рекомендация G6-gate (правило 11/D-16): пункт чек-листа,
                      не запрет — плотность остаётся выбором пользователя. */}
                  <li>
                    {s.density === 'kompakt'
                      ? <>{tx('▲ Dichte: Kompakt — vor dem Teilen des Bildschirms wird Komfortabel empfohlen')}</>
                      : <>{tx('✓ Dichte: Komfortabel')}</>}
                  </li>
                </ul>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setStage('compose')}>{tx('Zurück')}</Button>
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
                  <Button onClick={() => s.confirmGebaeudeklasse()}>{tx('Nächster Schritt: Klassifikation bestätigen')}</Button>
                </div>
              )}
            </div>
          )}

          {stage === 'confirm' && (
            <div className="mt-3 border border-border-default p-3">
              {/* Пакет виден ДО отправки (DC-42): монохромное A4-превью
                  первой страницы — «собранный товар», не абстрактный счётчик. */}
              <div className="a3-paper-preview mb-3" aria-label="Monochrome Seitenvorschau A4"
                   style={{ maxWidth: 'var(--measure-form-control)' }}>
                <b>{s.options.find((o) => o.id === s.activeOptionId)?.name ?? 'Musterprojekt Nordfeld'}</b>
                <hr />
                {tx(p.result.totalLabel)}<br />
                <b>{p.result.total.prefix ? `${p.result.total.prefix}${NNBSP}` : ''}{p.result.total.display}{NNBSP}€</b><br /><br />{tx('Preisstand 08/2026')}<br />
                Angebotsgültigkeit: Musterangabe
                {s.mode === 'intern' && <><br />DEMO-RUN-0007</>}
              </div>
              <p className="text-body text-text-primary">
                {selected.size} Anhänge · Empfänger geprüft · Text geprüft ·
                Sprache DE
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => setStage('preflight')}>{tx('Zurück')}</Button>
                <Button
                  variant="primary"
                  disabled={!sendEnabled}
                  disabledReason="Preflight nicht vollständig"
                  onClick={() => {
                    // Отправка = снапшот + событие (M-3): состояние, от
                    // которого клиент получил числа, зафиксировано до письма.
                    // В снапшот идёт ФАКТИЧЕСКИЙ процент, а не признак «скидка была»:
                    // снапшот обязан воспроизводить числа клиента (M-3).
                    s.sendOffer('email', discountPct ? discountPct.toFixed(1) : null)
                    setStage('gesendet')
                    setTimeout(() => setStage('zugestellt'), DELIVERY_SIMULATION_MS)
                  }}
                >
                  {tx('Bestätigen & senden')}
                </Button>
              </div>
            </div>
          )}

          {(stage === 'gesendet' || stage === 'zugestellt') && (
            <div className="mt-3 border border-border-default p-3">
              <p className="text-body text-text-primary">
                {stage === 'gesendet'
                  ? <><span aria-hidden="true">◌ </span>{tx('Gesendet — Zustellung ausstehend')}</>
                  : <><span aria-hidden="true">✓ </span>{tx('Zugestellt (simulierte Zustellbestätigung)')}</>}
              </p>
              <p className="a3-cap mt-1">
                «Gesendet» und «Zugestellt» sind zwei Zustände: der zweite
                folgt nicht aus dem ersten (EMAIL-007). Der Prototyp hat
                keinen E-Mail-Versand — die Zustellbestätigung wird nach
                2,5{NNBSP}Sekunden simuliert und ist als Simulation
                gekennzeichnet. Snapshot und Ereignis offer.emailed stehen
                im Journal.
              </p>
              {s.snapshots.length > 0 && (
                <p className="mt-2 text-small text-text-muted">
                  Snapshot {s.snapshots.at(-1)!.id}: Zwischensumme der kalkulierten Positionen{' '}
                  {s.snapshots.at(-1)!.totalExact}{NNBSP}€ exakt ·
                  Regionalfaktor {s.snapshots.at(-1)!.regionalfaktorActive
                    ? 'aktiviert' : 'nicht aktiviert'} · ±{NNBSP}
                  {s.snapshots.at(-1)!.uncertaintyPp}{NNBSP}% ·
                  Journal-Stand {s.snapshots.at(-1)!.journalSeqAt}
                </p>
              )}

              {/* Настоящее состояние `stale` (правило 30): снапшот
                  неизменяем (M-3), но конфигурация после отправки могла
                  уйти вперёд — и тогда экран продавца и письмо клиента
                  показывают разные числа. Молчать об этом опаснее всего:
                  расхождение обнаружится на встрече. */}
              {changedAfterSend > 0 && (
                <p className="a3-warn-prep mt-2">
                  <span aria-hidden="true">▲ </span>
                  Konfiguration nach dem Versand geändert:{' '}
                  {changedAfterSend}{NNBSP}
                  {changedAfterSend === 1 ? 'Preisänderung' : 'Preisänderungen'}{' '}
                  seit Snapshot {s.snapshots.at(-1)!.id}. Der Kunde sieht den
                  Stand des Snapshots — für den neuen Stand braucht es ein
                  neues Angebot.
                </p>
              )}
            </div>
          )}

          {/* DC-31 · Termin-Zusammenfassung — послесловие встречи.
              Не «спасибо за внимание», а список того, что решено и что
              осталось: продавец уходит со встречи с этим на экране.
              Пункты выводятся из журнала и покрытия, а не пишутся руками —
              иначе список расходится с тем, что произошло. */}
          {stage === 'zugestellt' && (
            <div className="a3-recap mt-4">
              <h3 className="text-heading-3 font-bold text-text-primary">{tx('Termin-Zusammenfassung')}</h3>
              <ul className="mt-2">
                {s.journal
                  .filter((e) => e.deltaExact !== null
                    && e.optionId === s.activeOptionId)
                  .map((e) => (
                    <li key={e.seq} className="a3-cap">
                      <span aria-hidden="true">✓ </span>{e.label}
                    </li>
                  ))}
                {offen.map((g) => (
                  <li key={g} className="a3-cap">
                    <span aria-hidden="true">○ </span>
                    {g.replace('_', NNBSP)} — Deckungsentscheidung offen
                  </li>
                ))}
                <li className="a3-cap">
                  <span aria-hidden="true">→ </span>{tx('Nächster Schritt: Rückmeldung des Kunden abwarten; der Snapshot bleibt unverändert und bleibt die Vergleichsbasis.')}</li>
              </ul>
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
