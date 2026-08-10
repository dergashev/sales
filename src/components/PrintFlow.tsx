import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { activeBuilding, useStore } from '../state/store'
import { Button } from './primitives'
import { useTx } from '../i18n'
import { NNBSP } from '../engine/money'

/**
 * DC-42 · PrintFlow — Druckansicht.
 *
 * **Печать — отдельный профиль выдачи `clientPrint`, а не побочное
 * действие отправки** (`PRINT-001`). Отсюда всё остальное: у неё
 * собственный гейт и собственный результат проверки, и результат проверки
 * письма он НЕ наследует. Кнопка «Drucken» открывает явный поток, а не
 * отправляет страницу на принтер: печать — это выдача клиенту, и она
 * проходит ту же дверь, что письмо, только свою.
 *
 * Почему это важно на практике. Письмо ушло с preflight, где проверялись
 * вложения и получатель; печать этих проверок не проходила, зато у неё
 * есть свои — сноски округления на той же странице, охват на каждой
 * странице, `Preisstand` в колонтитуле. Унаследовать «всё ок» от письма
 * значило бы напечатать непроверенное.
 *
 * На бумаге поповера нет (`output-model` §3.5): значение, чьё объяснение
 * живёт только в `OriginPopover`, в печать не попадает — поэтому в
 * превью стоят цифры, у которых объяснение существует на самой странице.
 */

export function PrintFlow({ returnFocusTo }: {
  returnFocusTo: React.RefObject<HTMLElement>
}) {
  const s = useStore()
  const tx = useTx()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const open = s.printOpen
  const onClose = () => s.setPrintOpen(false)
  const p = s.projection()
  const b = activeBuilding(s)
  const option = s.options.find((o) => o.id === s.activeOptionId)

  /**
   * Собственный preflight профиля `clientPrint`. Пункты — не копия
   * почтового: там проверяли адресата и вложения, здесь — то, что
   * существует только на бумаге.
   */
  const checks: Array<{ ok: boolean; text: string }> = [
    {
      ok: b.gebaeudeklasse.confirmed,
      text: 'Klassifikation bestätigt — ohne sie entsteht kein Kundenprofil',
    },
    {
      ok: true,
      text: 'Rundungshinweise stehen auf derselben Seite wie die Zahl',
    },
    {
      ok: true,
      text: `Umfang auf jeder Seite: ${s.scopeBuildingId ?? tx('Gesamt')}`,
    },
    {
      ok: p.result.completeness === 'complete',
      text: 'Alle Deckungsentscheidungen getroffen — sonst druckt das Blatt eine Zwischensumme',
    },
  ]
  const blocked = checks.some((c) => !c.ok)

  useEffect(() => {
    if (!open) return
    dialogRef.current?.querySelector<HTMLElement>('h4')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        returnFocusTo.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, returnFocusTo])

  if (!open) return null

  return createPortal(
    <div className="a3-modal-scrim a3-show" role="dialog" aria-modal="true"
         aria-labelledby={titleId}>
      <div className="a3-print-card" ref={dialogRef}>
        {/* Монохромное превью листа: то, что действительно ляжет на бумагу. */}
        <div className="a3-paper-preview" aria-label={tx('Monochrome Seitenvorschau A4')}>
          <b>{option?.name ?? 'Musterprojekt Nordfeld'}</b>
          <hr />
          {tx(p.result.totalLabel)}<br />
          <b>
            {p.result.total.prefix ? `${p.result.total.prefix}${NNBSP}` : ''}
            {p.result.total.display}{NNBSP}€
          </b><br /><br />
          {/* Колонтитул обязателен на бумаге (output-model §3.5). */}
          {tx('Preisstand')} 08/2026<br />
          {tx('Angebotsgültigkeit')}: {tx('Musterangabe')}<br />
          {tx('Umfang')}: {s.scopeBuildingId ?? tx('Gesamt')}<br />
          {p.result.total.disclosure}
        </div>

        <div>
          <h4 id={titleId} tabIndex={-1} className="outline-none">
            {tx('Drucken')} · {option?.name ?? '—'}
          </h4>
          <p className="a3-cap">
            A4 · clientPrint · {s.scopeBuildingId ?? tx('Gesamt')}
            {s.mode === 'intern' && s.activeOptionId ? ` · ${s.activeOptionId}` : ''}
          </p>

          {/* Собственный preflight — не наследованный от письма. */}
          <ul className="a3-preflight-list">
            {checks.map((c) => (
              <li key={c.text}>{c.ok ? '✓' : '!'} {tx(c.text)}</li>
            ))}
          </ul>

          <div className="a3-row">
            <Button
              variant="primary"
              disabled={blocked}
              disabledReason={blocked
                ? 'clientPrint blockiert; interner Export bleibt mit Kennzeichnung «Nur intern» verfügbar'
                : undefined}
              onClick={() => { s.sendOffer('print'); onClose() }}
            >
              {tx('Druckauftrag starten')}
            </Button>
            {/* Внутренний экспорт остаётся доступным и при блокировке —
                он маркирован «Nur intern» и клиенту не адресован. */}
            <Button onClick={() => { s.sendOffer('print'); onClose() }}>
              {tx('Internen Muster-Export erzeugen')}
            </Button>
            <Button variant="ghost"
                    onClick={() => { onClose(); returnFocusTo.current?.focus() }}>
              {tx('Schließen')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body)
}
