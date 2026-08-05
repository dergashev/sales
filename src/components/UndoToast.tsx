import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../state/store'
import { Button, useReducedMotion } from './primitives'
import { useT } from '../i18n'

/**
 * DC-29 · UndoToast — Rückgängig-Hinweis.
 *
 * Тост — дополнительный шорткат, не единственный путь: откат всегда доступен
 * из журнала DC-12 (FEEDBACK-001), поэтому закрытие тоста ничего не теряет.
 *
 * Контрактные механики:
 * - нижний ЛЕВЫЙ угол — справа живёт панель цены;
 * - время жизни — токен `--duration-toast-undo` (provisional, ADR-запись 13);
 * - hover/focus ставят таймер на паузу (уход — полный отсчёт заново:
 *   надмножество контрактной паузы, пользователь получает не меньше времени);
 * - Esc закрывает верхний закрываемый слой (KEY-002) — в прототипе других
 *   слоёв нет;
 * - `role="status"` + `aria-live="polite"`; фокус в тост сам не переносится;
 * - «отмена отмены — тоже событие»: кнопка вызывает адресный `undoEvent`,
 *   и тост события отмены снова несёт `Rückgängig`.
 */

const FALLBACK_MS = 8000

function toastLifetimeMs(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--duration-toast-undo')
  const ms = parseInt(raw, 10)
  return Number.isFinite(ms) && ms > 0 ? ms : FALLBACK_MS
}

export function UndoToast() {
  const s = useStore()
  const toast = s.undoToast
  const reduced = useReducedMotion()
  const t = useT()
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!toast || paused) return
    const t = setTimeout(() => s.dismissUndoToast(), toastLifetimeMs())
    return () => clearTimeout(t)
  }, [toast?.seq, paused])

  useEffect(() => {
    if (!toast) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') s.dismissUndoToast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toast?.seq])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.seq}
          role="status"
          aria-live="polite"
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? {} : { opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="fixed bottom-5 left-5 z-toast border-contrast border-border-strong bg-surface-default p-4"
          style={{
            maxWidth: 'min(var(--size-toast-max-width), calc(100vw - 2 * var(--space-5)))',
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <p className="text-body text-text-primary">{toast.statusText}</p>
          {toast.deltaText && (
            <p className="numeric mt-1 text-small text-text-secondary">
              {toast.deltaText}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => s.undoEvent(toast.seq)}>{t('common.undo')}</Button>
            <Button variant="ghost" onClick={() => s.dismissUndoToast()}>
              {t('common.close')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
