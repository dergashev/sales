import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../state/store'
import { useTx } from '../i18n'

/**
 * DC-7 · ClientNoticeDot — Hinweis-Punkt. Свёрнутая нейтральная форма
 * предупреждения для клиентского вида (правило 11).
 *
 * Зачем компонент существует. Внутреннее пространство и клиентский экран
 * говорят о предупреждении по-разному не из вежливости: продавцу нужен
 * список причин, чтобы работать, клиенту — знать, что пробел назван, и не
 * читать чужую кухню. Раньше прототип показывал одно и то же в обоих
 * режимах — правило 11 требовало свёрнутой формы, и это было
 * невыполненным требованием, а не отложенной возможностью.
 *
 * **Граница, которую компонент не имеет права перейти (MODE-001).**
 * Сворачивается ТОЛЬКО предупреждение. Открытая существенная проблема
 * (`materiality = material`) в точку не сворачивается: она блокирует
 * клиентский профиль целиком, и экран просто не формируется (R-07).
 * Поэтому здесь нет и не может быть пропа «severity»: если бы компонент
 * умел показывать существенное, он умел бы нарушать R-07.
 *
 * Точка **никогда не пульсирует** и не привлекает внимание анимацией:
 * предупреждение сообщает, а не требует.
 */

export function ClientNotice({ children, clientText }: {
  /** Полная форма — внутреннее пространство. */
  children: ReactNode
  /** Нейтральная клиентская формулировка: упрощает детали, но не меняет
   *  правду о верификации и конфликте (PROVENANCE-007). */
  clientText: string
}) {
  const s = useStore()
  const tx = useTx()
  const popId = useId()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)

  // Клик вне и Esc закрывают: поповер объясняет, а не удерживает.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Во внутреннем пространстве предупреждение остаётся развёрнутым:
  // продавцу нужен список причин, чтобы с ними работать.
  if (s.mode === 'intern') return <>{children}</>

  return (
    <span ref={wrap} className="inline-flex flex-col items-start">
      <button
        type="button"
        className="a3-hinweis"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={tx('Hinweis')}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      <span id={popId} className={'a3-pop' + (open ? ' a3-show' : '')}
            role="note" hidden={!open}>
        {tx(clientText)}
      </span>
    </span>
  )
}
