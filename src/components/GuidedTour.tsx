import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store'
import { Button } from './primitives'
import { useTx } from '../i18n'

/**
 * DC-14 · GuidedTourStep — Tour-Schritt.
 *
 * Онбординг G1–G21 объясняет РАБОТУ ИНСТРУМЕНТА, а не оффер, — поэтому
 * контракт разрешает тур только во внутреннем пространстве: клиенту
 * незачем смотреть, как продавец учится пользоваться экраном.
 *
 * Главная механика, которую легко потерять: **шаг, чьей цели нет на
 * экране, пропускается, и тур продолжается.** Это встроенная деградация,
 * а не состояние ошибки (контракт называет это прямо). Поэтому список
 * шагов фильтруется по факту существования цели В МОМЕНТ ЗАПУСКА, а не
 * пишется под один сценарий: тур, рассчитанный на «идеальный экран»,
 * ломается ровно там, где пользователь свернул не туда.
 *
 * Вырез прямоугольный — скруглений в системе нет (правило 4). Он рисуется
 * четырьмя затемнёнными полосами вокруг цели, а не «дыркой» в оверлее:
 * дырка потребовала бы маски, а маска — того же скругления, которого
 * система не допускает.
 */

type Step = {
  /** Цель на экране. Отсутствует — шаг пропускается. */
  target: string
  title: string
  body: string
}

/**
 * Шаги — из `guidance-system.md`. Тексты объясняют механику продукта, а
 * не элемент интерфейса: «журнал называет базу сравнения» полезнее, чем
 * «здесь журнал».
 */
const STEPS: Step[] = [
  {
    target: '.a3-hb-total',
    title: 'Der Preis ist immer sichtbar',
    body: 'Die Angebotsspalte rechts bleibt auf jedem Schritt stehen. Jede Entscheidung ändert diese Zahl sofort — man muss nirgendwo hin, um die Folge zu sehen.',
  },
  {
    target: '.a3-ogrid',
    title: 'Jede Option nennt ihren Preis vor dem Klick',
    body: 'Die Wirkung steht auf der Kachel, nicht erst nach der Auswahl. Beim Überfahren zeigt die Vorschau, wo die Summe landen würde.',
  },
  {
    target: '.a3-drivers',
    title: 'Kostentreiber erklären die Summe',
    body: 'Die Beiträge summieren sich exakt zur ausgewiesenen Summe. Jede Zeile nennt ihre Bezugsgröße — das ist das Argument im Gespräch.',
  },
  {
    target: '.a3-journal-spec',
    title: 'Preisänderungen nachvollziehen',
    body: 'Das Sitzungsjournal nennt die Vergleichsbasis und zeigt jede übernommene Änderung einzeln. Der Rückweg bleibt auch später verfügbar.',
  },
  {
    target: '.a3-nextstep',
    title: 'Ein nächster Schritt, immer sichtbar',
    body: 'Am Ende jedes Kapitels steht genau eine empfohlene Fortsetzung. Springen ist erlaubt — der Preis geht dabei nicht verloren.',
  },
  {
    target: '.a3-notecard',
    title: 'Notizen bleiben intern',
    body: 'Was hier steht, synchronisiert in die CRM-Projektkarte und erscheint in keiner Kundenansicht. Gespeichert wird still, bestätigt nur durch den Chip.',
  },
]

export function GuidedTour() {
  const s = useStore()
  const tx = useTx()
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const open = s.tourOpen

  // Сборка тура: шаги без цели на экране исключаются ЗДЕСЬ, при запуске.
  useEffect(() => {
    if (!open) return
    const live = STEPS.filter((st) => document.querySelector(st.target))
    setSteps(live)
    setI(0)
  }, [open])

  const step = steps[i]

  useLayoutEffect(() => {
    if (!open || !step) { setRect(null); return }
    const el = document.querySelector(step.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [open, step])

  useEffect(() => {
    if (!open) return
    cardRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); s.setTourOpen(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, i, s])

  // Тур в клиентских профилях недоступен: он про инструмент, не про оффер.
  if (!open || s.mode === 'praesentation') return null
  if (!step) return null

  const next = () => (i + 1 < steps.length ? setI(i + 1) : s.setTourOpen(false))

  return createPortal(
    <div className="a3-tour-stage">
      {/* Вырез — четыре полосы вокруг цели, а не дырка в оверлее: дырка
          потребовала бы маски со скруглением, которого система не знает. */}
      {rect && (
        <div className="a3-tour-cutout" aria-hidden="true"
             style={{
               position: 'fixed',
               top: rect.top, left: rect.left,
               width: rect.width, height: rect.height,
             }} />
      )}
      <div
        className="a3-tour-card"
        role="dialog"
        aria-labelledby={titleId}
        ref={cardRef}
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: 'var(--space-5)',
          bottom: 'var(--space-5)',
          maxWidth: 'var(--measure-card-compact)',
        }}
      >
        <h4 id={titleId}>{tx(step.title)}</h4>
        <p>{tx(step.body)}</p>
        <div className="a3-tour-actions">
          <Button variant="primary" onClick={next}>
            {i + 1 < steps.length
              ? `${tx('Weiter')} · ${i + 1}/${steps.length}`
              : tx('Rundgang beenden')}
          </Button>
          <Button variant="ghost" onClick={() => s.setTourOpen(false)}>
            {tx('Tour beenden')}
          </Button>
        </div>
      </div>
    </div>,
    document.body)
}
