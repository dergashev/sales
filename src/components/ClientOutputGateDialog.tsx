import { useId, useRef, type RefObject } from 'react'
import { useStore } from '../state/store'
import { Button } from './primitives'
import { useTx } from '../i18n'
import { NNBSP } from '../engine/money'
import { Dialog, type DialogHandle } from './Dialog'

/**
 * DC-33 · ClientOutputGateDialog — Freigabe-Dialog.
 *
 * **Единственная модалка-ворота в системе** (контракт говорит это прямо):
 * всё остальное — инлайн. Она существует ради одного момента — перехода в
 * клиентский вид, — и её задача не «спросить подтверждение», а показать
 * ровно то, что перестанет быть видимым, ДО того как экран увидит клиент.
 *
 * Почему это диалог, а не полоса, которой гейт был раньше. Полоса
 * сообщает состояние; здесь же нужно решение с последствиями, которые
 * нельзя проверить постфактум: после переключения продавец уже не увидит
 * скрытого и не сможет сравнить. Прерывание внимания здесь оправдано
 * ровно потому, что момент необратим на глазах у клиента.
 *
 * Контрактные механики: focus-trap, `Esc` возвращает в подготовку, фокус
 * возвращается на кнопку-инициатор. Строка плотности (D-16) —
 * предупреждение, а не блокер: переключение `Komfortabel` происходит
 * ЗДЕСЬ, до входа, чтобы вёрстка не перестраивалась на глазах у клиента.
 */

export function ClientOutputGateDialog({ returnFocusTo }: {
  returnFocusTo: RefObject<HTMLElement>
}) {
  const s = useStore()
  const open = s.gateOpen
  const onClose = () => s.setGateOpen(false)
  const tx = useTx()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<DialogHandle>(null)
  if (!open) return null
  // Gebäude & Umfang is deliberately pre-calculation. Even its client-view
  // gate must not invoke or reveal a projection before the Configurator.
  const p = s.pipelineView === 'buildingScope' ? null : s.projection()
  const blockers = s.canBeginConfiguration()
    ? []
    : ['Gebäude & Umfang nicht vollständig bestätigt']
  const risksActive = Object.values(s.risikoAktiv).some(Boolean)

  return (
    <Dialog
      ref={dialogRef}
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
      labelledBy={titleId}
      initialFocusRef={titleRef}
      returnFocusTo={returnFocusTo}
    >
        <h4 ref={titleRef} id={titleId} tabIndex={-1} className="outline-none">
          {tx('Bereit für die Präsentation?')}
        </h4>

        {/* Чек-лист DC-23: что готово и что мешает — фактами состояния,
            а не бодрым «всё хорошо». */}
        <div>
          {p && (
            <>
              <div className="a3-item">
                <span className="a3-okc" aria-hidden="true">✓</span>
                {p.result.totalLabel} · {p.result.total.prefix}
                {p.result.total.prefix ? NNBSP : ''}{p.result.total.display}{NNBSP}€
              </div>
              <div className="a3-item">
                <span className={p.uncertaintyPp <= 17 ? 'a3-okc' : 'a3-warnc'} aria-hidden="true">
                  {p.uncertaintyPp <= 17 ? '✓' : '!'}
                </span>
                {tx('Schätzunsicherheit')} ±{NNBSP}{p.uncertaintyPp}{NNBSP}%
              </div>
              {risksActive && (
                <div className="a3-item">
                  <span className="a3-warnc" aria-hidden="true">!</span>
                  {tx('Risikozuschlag ist aktiv und im Preis enthalten.')}
                </div>
              )}
            </>
          )}
          {blockers.map((x) => (
            <div key={x} className="a3-item">
              <span className="a3-warnc" aria-hidden="true">!</span>
              {tx('Blockierend')}: {x}
            </div>
          ))}
        </div>

        {/* Что перестанет быть видимым. Состав групп определён нормативом
            (output-model §6.5) — второй перечень рядом с определением стал
            бы заготовкой для расхождения, поэтому здесь общая формулировка
            и ссылка на профиль, а не список ярлыков. */}
        <div className="a3-hidelist">
          {s.pipelineView === 'buildingScope'
            ? tx('Interne Bearbeitungshinweise und Quellenreferenzen werden in der Kundenansicht ausgeblendet.')
            : tx('Ausgeblendet werden Marge, Δ-Werte, KG-700-Modus, Coaching-Hinweise und interne Notizen. Der Umfang folgt dem Ausgabeprofil, nicht dieser Liste.')}
        </div>

        {/* Плотность (D-16): рекомендация, не запрет, и переключение —
            ЗДЕСЬ, до входа, чтобы вёрстка не перестраивалась при клиенте. */}
        {s.density === 'kompakt' && (
          <div className="a3-item">
            <span className="a3-warnc" aria-hidden="true">!</span>
            <span>
              {tx('Ansicht steht auf «Kompakt» — bei Bildschirmfreigabe ist «Komfortabel» besser lesbar')}
              <span className="mt-2 block">
                <Button onClick={() => s.setDensity('komfortabel')}>
                  {tx('Auf Komfortabel umstellen')}
                </Button>
              </span>
            </span>
          </div>
        )}

        <div className="a3-row">
          <Button
            variant="primary"
            disabled={blockers.length > 0}
            disabledReason={blockers.length > 0
              ? tx('Zuerst mindestens ein Gebäude auswählen und jedes gewählte Gebäude bestätigen.')
              : undefined}
            onClick={() => {
              s.setMode('praesentation')
              dialogRef.current?.close(() => document.querySelector<HTMLElement>('[data-page-heading], h1'))
            }}
          >
            {tx('Kundenansicht starten')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => dialogRef.current?.close()}
          >
            {tx('Zurück zur Vorbereitung')}
          </Button>
        </div>
    </Dialog>
  )
}
