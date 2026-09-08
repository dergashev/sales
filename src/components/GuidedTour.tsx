import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { AnimatePresence, motion, useIsPresent, type Variants } from 'framer-motion'
import { useStore } from '../state/store'
import { Button } from './primitives'
import { useTx } from '../i18n'
import { Dialog, type DialogHandle } from './Dialog'
import { useSemanticMotion } from '../design-system/motion'

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
 * Вырез прямоугольный — скруглений в системе нет (правило 4). Его внешняя
 * тень затемняет всё вокруг цели без маски и без анимированного перемещения.
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
]

function TourStepContent({
  step,
  index,
  total,
  titleId,
  titleRef,
  variants,
  onNext,
  onClose,
}: {
  step: Step
  index: number
  total: number
  titleId: string
  titleRef: RefObject<HTMLHeadingElement>
  variants: Variants
  onNext: () => void
  onClose: () => void
}) {
  const tx = useTx()
  const present = useIsPresent()
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (rootRef.current) rootRef.current.inert = !present
  }, [present])

  return (
    <motion.div
      ref={rootRef}
      aria-hidden={present ? undefined : 'true'}
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <h4
        ref={present ? titleRef : undefined}
        id={present ? titleId : undefined}
        tabIndex={-1}
      >
        {tx(step.title)}
      </h4>
      <p>{tx(step.body)}</p>
      <div className="a3-tour-actions">
        <Button variant="primary" onClick={onNext}>
          {index + 1 < total
            ? `${tx('Weiter')} · ${index + 1}/${total}`
            : tx('Rundgang beenden')}
        </Button>
        <Button variant="ghost" onClick={onClose}>{tx('Tour beenden')}</Button>
      </div>
    </motion.div>
  )
}

export function GuidedTour() {
  const s = useStore()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<DialogHandle>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const open = s.tourOpen
  const { fadeRise } = useSemanticMotion()

  // Сборка тура: шаги без цели на экране исключаются ЗДЕСЬ, при запуске.
  useEffect(() => {
    if (!open) return
    const live = STEPS.filter((st) => document.querySelector(st.target))
    setSteps(live)
    setI(0)
    if (live.length === 0) s.setTourOpen(false)
  }, [open])

  const step = steps[i]

  useLayoutEffect(() => {
    if (!open || !step) { setRect(null); return }
    const el = document.querySelector(step.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [open, step])

  // Тур в клиентских профилях недоступен: он про инструмент, не про оффер.
  const dialogOpen = open && s.mode !== 'praesentation' && Boolean(step)

  const next = () => (i + 1 < steps.length
    ? setI(i + 1)
    : dialogRef.current?.close())

  return (
    <Dialog
      ref={dialogRef}
      open={dialogOpen}
      onOpenChange={(nextOpen) => { if (!nextOpen) s.setTourOpen(false) }}
      labelledBy={titleId}
      initialFocusRef={titleRef}
      panelClassName="a3-tour-card a3-tour-card-live"
      scrimClassName="a3-tour-scrim"
      underlay={rect ? (
        <div className="a3-tour-cutout" aria-hidden="true"
             style={{
               position: 'fixed',
               top: rect.top, left: rect.left,
               width: rect.width, height: rect.height,
             }} />
      ) : undefined}
    >
      {step && (
        <AnimatePresence mode="sync" initial={false}>
          <TourStepContent
            key={step.target}
            step={step}
            index={i}
            total={steps.length}
            titleId={titleId}
            titleRef={titleRef}
            variants={fadeRise}
            onNext={next}
            onClose={() => dialogRef.current?.close()}
          />
        </AnimatePresence>
      )}
    </Dialog>
  )
}
