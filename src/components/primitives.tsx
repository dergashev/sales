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
  const base = `${HIT} ${FOCUS} inline-flex items-center justify-center px-4 ` +
    'text-body font-medium transition-colors duration-fast'
  const look = variant === 'primary'
    ? 'bg-action-primary-bg text-action-primary-text hover:bg-action-primary-hover'
    : variant === 'ghost'
      ? 'text-action-secondary-text hover:bg-action-secondary-hover'
      : 'border border-action-secondary-border bg-action-secondary-bg ' +
        'text-action-secondary-text hover:bg-action-secondary-hover'
  return (
    <button
      type="button"
      onClick={onClick}
      // aria-disabled, а не disabled: заблокированная кнопка не должна терять
      // фокус, иначе причина блокировки недостижима с клавиатуры.
      aria-disabled={disabled || undefined}
      title={disabled ? disabledReason : undefined}
      onClickCapture={(e) => { if (disabled) { e.stopPropagation(); e.preventDefault() } }}
      className={`${base} ${look} ${disabled ? 'text-text-disabled' : ''}`}
      style={{ minHeight: 'var(--size-control-visual-md)' }}
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
    <span className="inline-flex items-center gap-1 text-small text-text-secondary">
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
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          // У input нет ::before, поэтому псевдо-расширение зоны нажатия
          // недоступно — минимальная высота ставится равной самой цели
          // нажатия 44 px (R-04: видимая высота МОЖЕТ быть 40, но только
          // если цель достигается иначе; здесь иначе нечем).
          className={`${FOCUS} numeric w-field border border-border-default px-3 text-body`}
          style={{ minHeight: 'var(--size-hit-target-default)' }}
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
        {unit && <span className="text-body text-text-secondary">{unit}</span>}
        <ProvenanceChip provenance={draft !== null ? 'wird bearbeitet' : provenance} />
      </div>
      {draft !== null && (
        <p className="mt-2 text-small text-text-secondary">
          Enter — vom Kunden bestätigt · Tab — manuell erfasst · Esc — verwerfen
        </p>
      )}
    </div>
  )
}

/**
 * Сегментированный контрол на три позиции покрытия (D-18).
 *
 * Чекбокс с двумя состояниями не выражает «noch offen», а пустой чекбокс
 * читается как «решено исключить» — но одно коммерческое решение, другое
 * пробел в данных, и норматив требует их различать. Три позиции видны
 * одновременно, поэтому скрытого состояния не существует.
 */
export function SegmentedThree<T extends string>({
  label, value, options, onChange, disabled, disabledReason,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3">
      <span className="text-body text-text-primary">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={disabled || undefined}
              title={disabled ? disabledReason : undefined}
              onClick={() => !disabled && onChange(o.value)}
              className={`${HIT} ${FOCUS} border px-3 text-small ` +
                (active
                  ? 'border-selection-border border-selected text-text-primary'
                  : 'border-border-default text-text-secondary') +
                (disabled ? ' text-text-disabled' : '')}
              style={{ minHeight: 'var(--size-control-visual-sm)' }}
            >
              {active && <span aria-hidden="true" className="mr-1">✓</span>}
              {o.label}
            </button>
          )
        })}
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
