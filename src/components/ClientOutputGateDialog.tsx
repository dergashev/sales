import { useId, useRef, type RefObject } from 'react'
import { clientModeLockReasonFor, useStore } from '../state/store'
import { Button } from './primitives'
import { useT, useTx } from '../i18n'
import { NNBSP } from '../engine/money'
import { riskIsInPrice } from '../engine/risk'
import { Dialog, type DialogHandle } from './Dialog'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

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
  const t = useT()
  const tx = useTx()
  const { reduced } = useSemanticMotion()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<DialogHandle>(null)
  if (!open) return null
  // Gebäude & Umfang is deliberately pre-calculation. Even its client-view
  // gate must not invoke or reveal a projection before the Configurator.
  const p = s.pipelineView === 'buildingScope' ? null : s.projection()
  /**
   * VR3-04 — the gate's blockers, in journey order.
   *
   * The building gate stays first because it is the earliest thing that can
   * be missing; the SAVED BASELINE is the new second one (audit F-002).
   * Entering a client meeting used to require only a complete
   * configuration, so a variant nobody had reviewed could be presented —
   * and the presentation would then be reading a working copy that could
   * still move under it. A saved Option cannot.
   */
  const blockers = [
    ...(s.canBeginConfiguration()
      ? []
      : ['Gebäude & Umfang nicht vollständig bestätigt']),
    ...(clientModeLockReasonFor(s, s.activeOptionId) === null
      ? []
      : ['Option noch nicht gespeichert — die Kundenansicht zeigt nur eine gespeicherte Option']),
  ]
  /**
   * «Angewendet» und «im Preis» sind zwei Aussagen, nicht eine.
   *
   * Diese Zeile las bisher nur das Kennzeichen `risikoAktiv` und
   * behauptete daraufhin, der Zuschlag sei im Preis enthalten. Ein
   * Zuschlag, dessen Basis nicht auflösbar ist — `Bestand / Abbruchumfang`
   * ohne enthaltene KG 200, oder eine noch unbepreiste KG 200 —, erreicht
   * den Preis nicht. Die Checkliste hätte dem Verkäufer vor der
   * Präsentation Geld bestätigt, das im Angebot nicht steht.
   *
   * Der Preis wird jetzt aus derselben Projektion gelesen, die ihn
   * berechnet: `riskBasisStates` nennt für jeden angewendeten Zuschlag den
   * Zustand seiner Basis.
   */
  const riskStates = p?.riskBasisStates ?? []
  const risksInPrice = riskStates.filter(riskIsInPrice).length
  const risksWithoutBasis = riskStates.length - risksInPrice

  return (
    <Dialog
      ref={dialogRef}
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
      labelledBy={titleId}
      initialFocusRef={titleRef}
      returnFocusTo={returnFocusTo}
    >
        {/* D-10: the dialog's title is its top-level heading, not an h4
            floating under a page it does not belong to. */}
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className="outline-none">
          {tx('Bereit für die Präsentation?')}
        </h2>

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
              {risksInPrice > 0 && (
                <div className="a3-item">
                  <span className="a3-warnc" aria-hidden="true">!</span>
                  {tx('Risikozuschlag ist aktiv und im Preis enthalten.')}
                </div>
              )}
              {risksWithoutBasis > 0 && (
                <div className="a3-item">
                  <span className="a3-warnc" aria-hidden="true">!</span>
                  {t('vr3.gate.riskWithoutBasis')}
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
            и ссылка на профиль, а не список ярлыков. VR3-CP-00 снял и вторую
            формулировку с перечнем ярлыков («Marge, Δ-Werte, KG-700-Modus…»):
            это был тот самый второй перечень. */}
        <div className="a3-hidelist">
          {tx('Interne Bearbeitungshinweise und Quellenreferenzen werden in der Kundenansicht ausgeblendet.')}
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
              ? (s.canBeginConfiguration()
                ? t('vr3.client.blockedReason')
                : tx('Zuerst mindestens ein Gebäude auswählen und jedes gewählte Gebäude bestätigen.'))
              : undefined}
            onClick={() => {
              // VR2-09 — approved motion storyboard 5 "Presentation entry"
              // (MODE): the Work shell → Present shell swap is one
              // CONTINUITY edge (view-transition cross-fade; the brand mark
              // carries the same `view-transition-name` in both shells so
              // identity holds while rails retract and the narrative strip
              // appears). `setMode` still commits synchronously; reduced
              // motion or an unsupporting browser simply applies it at once.
              startContinuityTransition(reduced, () => s.setMode('praesentation'))
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
