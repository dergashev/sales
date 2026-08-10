import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from './primitives'
import { useT, useTx } from '../i18n'

/**
 * DC-21 · CalculationOriginPopover — Herkunft-Popover.
 *
 * Поповер только объясняет: он ничего не выбирает и не редактирует.
 * Контрактные механики:
 * - триггер — настоящая кнопка `Herkunft anzeigen` рядом со значением,
 *   hit-зона 44 px;
 * - `role="dialog"` c `aria-label="Herkunft des Werts"`, цепочка — список;
 * - обязательное раскрытие округления (CALC-007): если показ ≠ точному,
 *   строка `Gerundet auf …; exakter Rechenwert …` приходит из `present()`;
 * - Esc закрывает ТОЛЬКО этот слой и возвращает фокус на триггер (KEY-002);
 *   Tab внутри циклится;
 * - ширина — min(--size-popover-max-width, 100vw − 2·gutter-narrow), токен
 *   provisional (ADR-PENDING DC-21);
 * - диалог рендерится ПОРТАЛОМ в body (ревью № 13, дефект 6): триггер
 *   легально живёт внутри <p>, а блочный диалог — нет; заодно портал
 *   выводит его из-под overflow панели. Позиция fixed от триггера с
 *   зажимом в границы вьюпорта; скролл и resize закрывают слой —
 *   объяснение значения не переживает смену контекста;
 * - в презентации внутренние ссылки (Regelsatz, runRef) отсутствуют в
 *   дереве, а не скрыты стилем (permission-состояние, R-17).
 */

export type OriginRow = {
  label: string
  value: string
  /** Приглушённая строка — например `Regionalfaktor · deaktiviert` (правило 40). */
  muted?: boolean
  /** Итоговая строка цепочки. */
  strong?: boolean
}

export function OriginPopover({ rows, rounding, runRef, triggerLabel }: {
  rows: OriginRow[]
  /** Раскрытие округления из `present().disclosure`; null — показ равен точному. */
  rounding: string | null
  /** Внутренняя ссылка на правило и прогон; null в презентации (permission). */
  runRef: string | null
  triggerLabel?: string
}) {
  const tx = useTx()
  const t = useT()
  const label = triggerLabel ?? t('common.showOrigin')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const reduced = useReducedMotion()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  // Позиция от триггера; после появления диалог зажимается в границы
  // вьюпорта (правило 3a: поповеры — min(px, calc(100vw − …))).
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const gutter = 8
    const box = dialogRef.current?.getBoundingClientRect()
    const w = box?.width ?? 0
    const h = box?.height ?? 0
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.max(gutter, Math.min(r.left, vw - w - gutter))
    // Вертикаль: под триггером, но если снизу не помещается — НАД ним
    // (приёмка № 17: у нижней границы диалог уезжал за экран на 194 px).
    // Зажим остаётся страховкой на случай, когда не помещается и сверху.
    const below = r.bottom + 4
    const above = r.top - 4 - h
    const flip = below + h > vh - gutter && above >= gutter
    const top = Math.max(gutter, Math.min(flip ? above : below, vh - h - gutter))
    setPos({ top, left })
  }, [open])

  // Прокрутка или resize меняют контекст — слой закрывается, а не едет.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    // `pos` в зависимостях не декоративен: до его вычисления диалог
    // отрисован с `visibility: hidden`, а скрытый элемент фокус НЕ
    // принимает — приёмка № 17 нашла фокус, оставшийся на BODY, и
    // как следствие неработающий Esc.
    if (!open || !pos) return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]'))
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
      if (e.key === 'Tab') {
        const f = focusables()
        if (f.length === 0) return
        const first = f[0]!, last = f[f.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    // Слушателя вешаем на ДОКУМЕНТ: Esc обязан закрывать верхний слой
    // независимо от того, где сейчас фокус (KEY-002). На диалоге он
    // работал только при фокусе внутри — то есть не работал при отказе
    // фокусировки.
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, pos])

  return (
    <span className="a3-hk-wrap">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={'a3-hk-val outline-none focus-visible:outline ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'}
      >
        {label}
      </button>

      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-label="Herkunft des Werts"
            aria-labelledby={headingId}
            initial={reduced ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? {} : { opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            /* `.a3-show` ставится СРАЗУ: без него контрактный класс
               держит `display:none`, измеряемого бокса не существует, и
               первое измерение даёт нулевую высоту — переворот у нижней
               границы не срабатывал именно поэтому (приёмка волны C).
               До вычисления позиции элемент скрыт `visibility`, который
               размеров не отнимает. */
            className={'a3-hk-pop' + (open ? ' a3-show' : '')}
            style={{
              /* Вид (рамка, фон, паддинг, ширина, типографика, движение)
                 приходит из `.a3-hk-pop`. Позиционирование — нет: контракт
                 кладёт слой `absolute` внутрь обёртки, а обёртка живёт в
                 прокручиваемой панели и обрезает его (дефект 6 приёмки
                 № 13/№ 17). Портал с `fixed` — то, чем дефект закрыт;
                 несовместимость названа в handoff для DC-21. */
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              right: 'auto',
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            <p id={headingId} className="text-small font-bold text-text-primary">{tx('Herkunft des Werts')}</p>
            {/* Строка цепочки — `.a3-r` контракта, число — `.a3-fnum`. */}
            <ol className="mt-2">
              {rows.map((r) => (
                <li key={r.label + r.value}
                    className={'a3-r' + (r.muted ? ' text-text-muted' : '')}>
                  <span>{r.label}</span>
                  <span className="a3-fnum">{r.value}</span>
                </li>
              ))}
            </ol>
            {rounding && (
              <p className="numeric mt-2 text-small text-text-secondary">{rounding}</p>
            )}
            {runRef && (
              <p className="mt-2 text-caption text-text-muted">{runRef}</p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => { setOpen(false); triggerRef.current?.focus() }}
                className={'a3-hk-val outline-none focus-visible:outline ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  'focus-visible:outline-focus-ring'}
              >
                {t('common.close')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </span>
  )
}
