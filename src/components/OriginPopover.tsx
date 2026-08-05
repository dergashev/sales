import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from './primitives'

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

export function OriginPopover({ rows, rounding, runRef, triggerLabel = 'Herkunft anzeigen' }: {
  rows: OriginRow[]
  /** Раскрытие округления из `present().disclosure`; null — показ равен точному. */
  rounding: string | null
  /** Внутренняя ссылка на правило и прогон; null в презентации (permission). */
  runRef: string | null
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  useEffect(() => {
    if (!open) return
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
    dialog.addEventListener('keydown', onKey)
    return () => dialog.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={'relative text-small text-text-secondary underline-offset-2 ' +
          'hover:underline outline-none before:absolute before:left-1/2 before:top-1/2 ' +
          'before:min-h-hit-target before:min-w-hit-target before:-translate-x-1/2 ' +
          'before:-translate-y-1/2 before:content-[""] focus-visible:outline ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'}
      >
        {triggerLabel}
      </button>

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
            className="absolute left-0 top-full z-popover mt-1 border-contrast border-border-strong bg-surface-default p-4"
            style={{
              width: 'max-content',
              maxWidth: 'min(var(--size-popover-max-width), calc(100vw - 2 * var(--gutter-narrow)))',
            }}
          >
            <p id={headingId} className="text-small font-bold text-text-primary">
              Herkunft des Werts
            </p>
            <ol className="mt-2">
              {rows.map((r) => (
                <li
                  key={r.label + r.value}
                  className={'flex justify-between gap-4 border-b border-border-subtle py-1 text-small ' +
                    (r.muted ? 'text-text-muted' : 'text-text-secondary') +
                    (r.strong ? ' font-medium text-text-primary' : '')}
                >
                  <span>{r.label}</span>
                  <span className="numeric shrink-0 text-right">{r.value}</span>
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
                className={'relative text-small text-text-secondary underline-offset-2 ' +
                  'hover:underline outline-none before:absolute before:left-1/2 before:top-1/2 ' +
                  'before:min-h-hit-target before:min-w-hit-target before:-translate-x-1/2 ' +
                  'before:-translate-y-1/2 before:content-[""] focus-visible:outline ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  'focus-visible:outline-focus-ring'}
              >
                Schließen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
