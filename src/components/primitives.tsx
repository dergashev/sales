import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import { formatDE, NNBSP } from '../engine/money'

/**
 * Примитивы по контрактам `design-system/components-core.md`.
 *
 * Минимальный набор под шесть экранов — решение PO: прототип доказывает
 * поток, а не полноту библиотеки. Остальные контракты остаются
 * спецификацией для ин-хаус команды.
 *
 * Что здесь соблюдается структурно, а не проверяется потом:
 * зона нажатия 44 px при любой видимой высоте · настоящие контролы вместо
 * `div` с обработчиком · статус никогда не одним цветом · счёт числа гасится
 * при `prefers-reduced-motion`.
 */

/** Зона нажатия ≥ 44 × 44 при любой видимой высоте контрола (R-04). */
export const HIT = 'relative before:absolute before:left-1/2 before:top-1/2 ' +
  'before:min-h-hit-target before:min-w-hit-target ' +
  'before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]'

const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(q.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return reduced
}

/**
 * Счёт числа вместо подмены (правило проекта 19): 400 мс, de-DE, tnum.
 * При `prefers-reduced-motion` — мгновенно, включая счёт (правило 21).
 */
export function useCountUp(target: Decimal, decimals = 0): string {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const raf = useRef<number>()

  useEffect(() => {
    if (reduced) { setShown(target); from.current = target; return }
    const start = performance.now()
    const a = from.current
    const delta = target.minus(a)
    if (delta.isZero()) return
    const tick = (now: number) => {
      const t = Math.min((now - start) / 400, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(a.plus(delta.mul(eased)))
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = target
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target.toString(), reduced])

  return formatDE(shown, decimals)
}

/**
 * Button — вид приходит из дизайн-системы (`.a3-btn`, DC-контракт в
 * `components.css`), поведение остаётся здесь.
 *
 * Разделение буквальное: этот компонент больше не решает, какого кнопка
 * цвета, размера и с каким наведением. Он решает, что она — настоящий
 * `<button>`, что заблокированная не теряет фокус, и что причина блокировки
 * достижима. Смена вида кнопки в системе приходит сюда сама.
 *
 * Зона нажатия 44 px тоже пришла из системы (`.a3-btn::before`), поэтому
 * локальный HIT здесь снят: два псевдоэлемента на одном контроле — это
 * две зоны нажатия, а не одна надёжная.
 */
export function Button({
  children, onClick, variant = 'secondary', disabled, disabledReason, ...rest
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  /** Заблокированный элемент всегда объясняет причину (правило 12). */
  disabledReason?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const look = variant === 'primary' ? '' : variant === 'ghost' ? 'a3-ghost' : 'a3-sec'
  return (
    <button
      type="button"
      onClick={onClick}
      // aria-disabled, а не disabled: заблокированная кнопка не должна терять
      // фокус, иначе причина блокировки недостижима с клавиатуры.
      aria-disabled={disabled || undefined}
      title={disabled ? disabledReason : undefined}
      onClickCapture={(e) => { if (disabled) { e.stopPropagation(); e.preventDefault() } }}
      className={`a3-btn ${look} ${FOCUS}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Чип происхождения значения (DC-1). Знак плюс подпись, не только цвет. */
export function ProvenanceChip({ provenance }: { provenance: string }) {
  const mark = provenance === 'vom Kunden bestätigt' ? '✓'
    : provenance === 'aus Dokument' ? '◆'
      : provenance === 'abgeleitet' ? '▲' : '✎'
  return (
    <span className="a3-chip-src">
      {/* `.a3-chip-src .a3-dot` — точка индикатора из системы; знак остаётся
          рядом с ней, потому что цвет не является носителем (правило 8). */}
      <span aria-hidden="true" className="a3-dot" />
      <span aria-hidden="true">{mark}</span>
      {provenance}
    </span>
  )
}

/**
 * Числовое поле с происхождением (DC-4). Правка прямо в презентации —
 * самый сильный момент демонстрации: клиент называет площадь, sales вводит,
 * всё пересчитывается, интервал сужается на глазах.
 */
export function NumericField({
  label, value, unit, provenance, decimals = 2, onCommit,
}: {
  label: string
  value: Decimal
  unit?: string
  provenance: string
  decimals?: number
  onCommit: (v: Decimal, confirmed: boolean) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? formatDE(value, decimals)

  const commit = (confirmed: boolean) => {
    if (draft === null) return
    const parsed = draft.replace(/\./g, '').replace(',', '.')
    const next = new Decimal(parsed || '0')
    setDraft(null)
    if (!next.equals(value) && next.gt(0)) onCommit(next, confirmed)
  }

  return (
    <div className="border-b border-border-subtle py-4">
      <label className="block text-small font-medium text-text-primary">{label}</label>
      {/* Оболочка и единица — из системы (`.a3-input > input + .a3-unit`);
          высота 44 px, бордер и типографика приходят оттуда же. */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="a3-input">
          <input
            className={FOCUS}
            value={shown}
            inputMode="decimal"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(true)
              if (e.key === 'Escape') setDraft(null)
            }}
            aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
          />
          {unit && <span className="a3-unit">{unit}</span>}
        </span>
        <ProvenanceChip provenance={draft !== null ? 'wird bearbeitet' : provenance} />
      </div>
      {draft !== null && (
        <p className="a3-cap mt-2">
          Enter — vom Kunden bestätigt · Tab — manuell erfasst · Esc — verwerfen
        </p>
      )}
    </div>
  )
}

/**
 * Skeleton (правило 30): плоские блоки БЕЗ shimmer-градиента — градиенты
 * запрещены правилом 4, и заглушка не притворяется контентом. Скринридеру
 * сообщается загрузка, блоки скрыты.
 */
export function Skeleton({ lines = 3, label = 'Wird geladen' }: {
  lines?: number
  label?: string
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}{NNBSP}…</span>
      <div aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="a3-skel mb-2"
            style={{ width: `${100 - (i % 3) * 18}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/** Интервал точности (DC-3). Термин производственный, не отменённый. */
export function UncertaintyBadge({ pp }: { pp: number }) {
  return (
    <span className="text-body text-text-secondary">
      Schätzunsicherheit ±{NNBSP}{pp}{NNBSP}%
    </span>
  )
}
