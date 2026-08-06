import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from './primitives'
import { useT } from '../i18n'

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
    const left = Math.max(gutter, Math.min(r.left, window.innerWidth - w - gutter))
    setPos({ top: r.bottom + 4, left })
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
            className="z-popover border-contrast border-border-strong bg-surface-default p-4"
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
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
