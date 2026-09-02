import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { TOAST_EXIT_MS, UNDO_WINDOW_MS } from '../config/ui-policy'
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

export function UndoToast() {
  const s = useStore()
  const toast = s.undoToast
  const t = useT()
  const [paused, setPaused] = useState(false)
  // Содержимое переживает уход — но только НА ВРЕМЯ ухода. Гасить его сразу
  // значило бы показывать пустую рамку весь транзишн; оставлять навсегда —
  // держать невидимые кнопки в порядке обхода и под курсором, что и нашло
  // сплошное ревью 26 (находка 31): исчезнувший тост продолжал принимать
  // Tab и клики в своей прежней области.
  const [shown, setShown] = useState(toast)
  useEffect(() => {
    if (toast) { setShown(toast); return }
    const t = setTimeout(() => setShown(null), TOAST_EXIT_MS)
    return () => clearTimeout(t)
  }, [toast])

  // Контракт требует ПАУЗЫ таймера на hover и focus, а не перезапуска.
  // Прежняя редакция сбрасывала отсчёт заново: пользователь получал не
  // меньше времени, поэтому дефект был невидим — но «навёл на секунду и
  // снова восемь секунд» это другое поведение, чем «пока смотрю, время
  // стоит». Остаток хранится явно.
  const remaining = useRef(UNDO_WINDOW_MS)
  const startedAt = useRef(0)

  useEffect(() => {
    remaining.current = UNDO_WINDOW_MS
  }, [toast?.seq])

  useEffect(() => {
    if (!toast) return
    if (paused) {
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
      return
    }
    startedAt.current = Date.now()
    const t = setTimeout(() => s.dismissUndoToast(), remaining.current)
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
    /* Анатомия DC-29 целиком: хост `.a3-toasts` (он же владеет
       позиционированием и шириной — раньше это делали утилиты приложения),
       карточка `.a3-toast`, состояние `.a3-show`, действие `.a3-act`.
       Движение — транзишн системы: элемент постоянен, класс несёт
       появление; кадр анимации в условии не участвует (тот же урок, что
       с дельта-чипом в приёмке № 17). */
    <div className="a3-toasts">
      <div
        role="status"
        aria-live="polite"
        aria-hidden={toast ? undefined : true}
        className={'a3-toast' + (toast ? ' a3-show' : '')}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {shown && (<>
          <span>
            {/* VR3-01: an action may supply a dictionary key for its own
                message. The journal's stored `label` is German by contract
                (it is also the text staleness detection matches on), so the
                toast rendered German on the EN path until actions could
                name a key. Actions without one are unchanged. */}
            {shown.statusKey
              ? t(shown.statusKey, shown.statusValues)
              : shown.statusText}
            {shown.deltaText && (
              <span className="numeric block">{shown.deltaText}</span>
            )}
          </span>
          {/* Действие тоста — `.a3-act` контракта: подчёркнутая ссылка-кнопка
              в одной строке с сообщением, не блок кнопок под ним. */}
          {/* Пока тост уходит, его кнопки уже не действуют: `disabled`
              убирает их и из порядка обхода, и из-под курсора. Полностью
              зону нажатия закрывает `pointer-events` у невидимого хоста —
              это правка дизайн-системы, она передана отдельно. */}
          <button type="button" className="a3-act" disabled={!toast}
                  onClick={() => s.undoEvent(shown.seq)}>
            {t('common.undo')}
          </button>
          <button type="button" className="a3-act" disabled={!toast}
                  onClick={() => s.dismissUndoToast()}>
            {t('common.close')}
          </button>
        </>)}
      </div>
    </div>
  )
}
