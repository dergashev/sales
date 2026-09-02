import { useRef, useState } from 'react'
import { activeBuilding, projectProjection, useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { DiscountControl } from '../components/DiscountControl'
import { Button } from '../components/primitives'
import { EstimateUncertaintyBadge } from '../components/EstimateUncertaintyBadge'
import { PageHeader } from '../components/designSystem'
import { useT, useTx } from '../i18n'
import { PrintFlow } from '../components/PrintFlow'
import { DELIVERY_SIMULATION_MS } from '../config/ui-policy'
import { OFFER_ARTIFACTS as ARTIFACTS } from '../config/offer-artifacts'
import { demoProject } from '../state/projectAnalysis'

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

type Stage = 'compose' | 'preflight' | 'confirm' | 'gesendet' | 'zugestellt'

export function S5Export() {
  const s = useStore()
  // VR3-01: the fallback names the OPEN PROJECT. It named a retired fixture
  // row, so an Option without a name printed the wrong project.
  const projectName = demoProject(s.opportunityId)?.name ?? ''
  const t = useT()
  const tx = useTx()
  const printBtnRef = useRef<HTMLButtonElement>(null)
  // Сколько ЦЕНОВЫХ событий этой Option произошло после отправки. Считается
  // из журнала против `journalSeqAt` снапшота — второго счётчика нет.
  //
  // Снапшот берётся СВОЕЙ Option, а не последний вообще: отправив Option 2 и
  // открыв экспорт Option 1, экран рассказывал про чужую отправку и считал
  // изменения против чужой отметки (находка 15).
  const lastSnap = [...s.snapshots]
    .reverse().find((x) => x.optionId === s.activeOptionId)
  const changedAfterSend = lastSnap
    ? s.journal.filter((e) => e.seq > lastSnap.journalSeqAt
        && e.deltaExact !== null && e.optionId === s.activeOptionId).length
    : 0
  const p = projectProjection(s)
  // Текст письма и вложения живут в конфигурации Option: уход в сравнение и
  // возврат стирали написанное продавцом (находка 15).
  const selected = new Set(s.offerDraft.attachments)
  const setSelected = (next: Set<string>) =>
    s.setOfferDraft({ attachments: [...next] })
  const body = s.offerDraft.body
  const setBody = (v: string) => s.setOfferDraft({ body: v })
  // Стадия ДОСТАВКИ — состояние экрана, и это правильно: она описывает, где
  // сейчас находится человек в потоке отправки. Но начальная стадия
  // выводится из ФАКТА: если оффер по этой Option уже ушёл, экран не вправе
  // открыться в «составить письмо», как будто ничего не было.
  const [stage, setStage] = useState<Stage>(lastSnap ? 'zugestellt' : 'compose')

  // Открытые решения по покрытию — то же множество, что делает итог
  // промежуточным: список Recap не может разойтись с подписью итога.
  const offen = p.result.incompleteReasons
    .find((reason) => reason.code === 'coverageUnknown')?.groups ?? []
  const total = p.result.total.exact

  // Preflight — вывод, не заявление: блокер, интервал, допущения.
  const blockers: string[] = []
  // Task 03 (deep-coherence audit, F-16/PD-3, CPO-confirmed): the Sidebar
  // nav gate is the primary defense, but preflight is the ticket's own
  // stated second layer ("Export disabled ...; preflight blocks
  // otherwise") — this view must not silently allow sending an option
  // whose configuration was never confirmed, however it was reached.
  if (!s.configurationComplete()) {
    blockers.push(
      s.mode === 'intern'
        ? 'Konfiguration nicht bestätigt — Leistungsabgrenzung und jedes einbezogene Gebäude müssen im gewählten Modus bestätigt sein'
        : 'Die Konfiguration ist noch nicht vollständig bestätigt — das Angebot kann noch nicht freigegeben werden',
    )
  }
  if (!activeBuilding(s).gebaeudeklasse.confirmed) {
    blockers.push(
      s.mode === 'intern'
        ? 'ValidationIssue offen: Klassifikation nach MBO §2 nicht bestätigt — blockiert alle fünf Kundenprofile (R-07)'
        : 'Klassifikation nach MBO §2 nicht bestätigt — das Angebot kann noch nicht freigegeben werden',
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
      <PageHeader title={`Export · ${s.options.find((o) => o.id === s.activeOptionId)?.name ?? projectName}`} />

      <div className="a3-grid-host">
      <div className="a3-export-grid">
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
                    className="h-4 w-4 accent-selection-border"
                  />
                  {tx(a.label)}
                  <span className="ml-auto text-small text-text-muted">{tx('Muster')}</span>
                </label>
              </li>
            ))}
          </ul>

          {/* Печать — ОТДЕЛЬНЫЙ профиль выдачи со своим гейтом (PRINT-001),
              а не побочное действие отправки: результат проверки письма
              она не наследует. */}
          <h2 className="mt-6 text-heading-3 font-bold text-text-primary">{tx('Drucken')}</h2>
          <p className="a3-cap mt-1">
            {s.mode === 'intern'
              ? tx('Eigenes Ausgabeprofil für die Druckausgabe mit eigener Prüfung — die Freigabe der E-Mail gilt hier nicht.')
              : tx('Die Druckansicht wird vor dem Öffnen eigenständig geprüft.')}
          </p>
          <div className="mt-2">
            <Button ref={printBtnRef} onClick={() => s.setPrintOpen(true)}>
              {tx('Druckansicht öffnen')}
            </Button>
          </div>
          <PrintFlow returnFocusTo={printBtnRef} />

          <h2 className="mt-6 text-heading-3 font-bold text-text-primary">{tx('Rabatt')}</h2>
          <div className="mt-2">
            {/* Скидка живёт в конфигурации Option, а не в состоянии экрана:
                иначе контрол показывает одно, снапшот хранит другое, а
                возврат на экран её стирает (находка 14). */}
            <DiscountControl
              totalExact={total}
              percent={s.discountPercent}
              onChange={(v) => s.setDiscount(v)}
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
                  value={`Indikatives Angebot – ${s.options.find((o) => o.id === s.activeOptionId)?.name ?? projectName}`}
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
                  {tx('Angebot prüfen')}
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
                  {/* F-29: named the classifier (`clientSafe`) instead of the
                      outcome; routed through the existing `s5.preflight.
                      attachments` key (already carrying `{count}`) instead of
                      a parallel hardcoded literal. */}
                  <li>✓ {s.mode === 'intern'
                    ? t('s5.preflight.attachments', { count: selected.size })
                    : `Anhänge: ${selected.size}`}</li>
                  <li>✓ Aktive Annahmen: {activeBuilding(s).gebaeudeklasse.confirmed ? 1 : 2}</li>
                  <li>
                    <EstimateUncertaintyBadge presentation="compact" pp={p.uncertaintyPp} />
                  </li>
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
                  {blockers.length > 0 ? 'Blockiert — Klassifikation bestätigen' : 'Prüfung bestanden — weiter'}
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
                <b>{s.options.find((o) => o.id === s.activeOptionId)?.name ?? projectName}</b>
                <hr />
                {tx(p.result.totalLabel)}<br />
                <b>{p.result.total.prefix ? `${p.result.total.prefix}${NNBSP}` : ''}{p.result.total.display}{NNBSP}€</b><br /><br />{tx('Preisstand 08/2026')}<br />
                Angebotsgültigkeit: Musterangabe
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
                  disabledReason="Prüfung nicht abgeschlossen"
                  onClick={() => {
                    // Отправка = снапшот + событие (M-3): состояние, от
                    // которого клиент получил числа, зафиксировано до письма.
                    // В снапшот идёт ФАКТИЧЕСКИЙ процент, а не признак «скидка была»:
                    // снапшот обязан воспроизводить числа клиента (M-3).
                    s.sendOffer('email')
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
              {s.mode === 'intern' && <p className="a3-cap mt-1">
                «Gesendet» und «Zugestellt» sind zwei Zustände: der zweite
                folgt nicht aus dem ersten (EMAIL-007). Der Prototyp hat
                keinen E-Mail-Versand — die Zustellbestätigung wird nach
                2,5{NNBSP}Sekunden simuliert und ist als Simulation
                gekennzeichnet. Snapshot und Ereignis offer.emailed stehen
                im Journal.
              </p>}
              {s.mode === 'intern' && s.snapshots.length > 0 && (
                <p className="mt-2 text-small text-text-muted">
                  Snapshot {s.snapshots.at(-1)!.id}: {tx(s.snapshots.at(-1)!.totalLabel)}{' '}
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
                  {s.mode === 'intern' && <>seit Snapshot {s.snapshots.at(-1)!.id}. </>}
                  Der Kunde sieht den zuletzt versendeten Stand — für den neuen Stand braucht es ein
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
    </div>
  )
}

// F-29: this printed the internal pipeline stage names verbatim (Compose /
// Preflight / Confirm & Send / Delivery status) — English implementation
// vocabulary in a German-first screen that is visible outside intern mode
// (the client can be in the room during `mode-praesentation`). Named as
// German stage labels instead.
//
// REDESIGN R3 (877f2c2a, Offer Moment §"UX WRITING IMPACT"): the earlier
// revision of this comment kept "Preflight" as "the accepted, naturalized
// term used elsewhere in this screen's own copy" — that copy is exactly
// what R3 owns fixing. Every occurrence in this file (stage label, the
// stage-advance CTA, the blocked-state reason) now reads "Prüfung", the
// same outcome-language word already used two lines below in this screen
// ("Finale Prüfung") — one vocabulary, not two words for one step.
function stageLabel(s: Stage): string {
  return s === 'compose' ? 'Entwurf'
    : s === 'preflight' ? 'Prüfung'
      : s === 'confirm' ? 'Bestätigung & Versand'
        : s === 'gesendet' ? 'Sendestatus · Gesendet'
          : 'Sendestatus · Zugestellt'
}
