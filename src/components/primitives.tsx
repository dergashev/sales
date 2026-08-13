import { forwardRef, useId, useEffect, useRef, useState, type ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import { formatDE, NNBSP } from '../engine/money'
import { useT, useTx } from '../i18n'
import { useSemanticMotion } from '../design-system/motion'

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

const FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

/**
 * Счёт числа вместо подмены (правило проекта 19): 400 мс, de-DE, tnum.
 * При `prefers-reduced-motion` — мгновенно, включая счёт (правило 21).
 *
 * Две вещи здесь неочевидны, и обе давали НЕВЕРНОЕ ЧИСЛО на экране.
 *
 * **Прогресс зажимается снизу, а не только сверху.** `requestAnimationFrame`
 * отдаёт время НАЧАЛА кадра, и оно может быть РАНЬШЕ, чем `performance.now()`,
 * взятое в том же кадре при выполнении эффекта. Тогда `t` отрицателен, а
 * `1 − (1 − t)³` при отрицательном `t` уходит далеко в минус: первый кадр
 * счёта рисовал на герое `−1.821.397 €` вместо четырёх миллионов. Отсутствие
 * нижнего зажима выглядело безобидным ровно потому, что «время не идёт
 * назад» — а оно и не идёт: назад смотрит отметка кадра.
 *
 * **Новая анимация стартует от ПОКАЗАННОГО, а не от прежней цели.** Стартовое
 * значение обновлялось только по завершении, поэтому смена цели на лету
 * начинала счёт от числа, которого на экране давно нет, — и это подмена,
 * запрещённая правилом 19, а не счёт.
 */
export function useCountUp(target: Decimal, decimals = 0): string {
  const { reduced } = useSemanticMotion()
  const [shown, setShown] = useState(target)
  /** То, что СЕЙЧАС на экране. Отсюда стартует следующий переход. */
  const current = useRef(target)
  const raf = useRef<number>()

  useEffect(() => {
    if (reduced) { setShown(target); current.current = target; return }
    const start = performance.now()
    const a = current.current
    const delta = target.minus(a)
    if (delta.isZero()) return
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / 400, 0), 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const value = a.plus(delta.mul(eased))
      current.current = value
      setShown(value)
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else current.current = target
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
export const Button = forwardRef<HTMLButtonElement, {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  /** Заблокированный элемент всегда объясняет причину (правило 12). */
  disabledReason?: string
  /**
   * Управляемое состояние настоящей ожидающей операции. Оно сохраняет
   * focus и enabled-палитру, но блокирует повторную активацию.
   */
  loading?: boolean
  /** Доступная подпись процесса: «Wird berechnet …», не абстрактный loader. */
  loadingLabel?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>>(function Button({
  children, onClick, variant = 'secondary', disabled, disabledReason,
  loading = false, loadingLabel, className, type = 'button',
  onClickCapture, onKeyDownCapture,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  ...rest
}, ref) {
  const look = variant === 'primary' ? '' : variant === 'ghost' ? 'a3-ghost' : 'a3-sec'
  const reasonId = useId()
  // Причина блокировки — такой же текст интерфейса, как подпись кнопки
  // (D-24): она проходит через мост здесь, а не в каждом из десятков
  // мест вызова, иначе перевод забывался бы по одному.
  const tx = useTx()
  const t = useT()
  const reason = disabledReason ? tx(disabledReason) : undefined
  const processLabel = loadingLabel ? tx(loadingLabel) : t('common.loading')
  const inoperable = Boolean(disabled || loading)
  const blocked = Boolean(disabled && !loading)
  const buttonDescription = blocked && reason
    ? [describedBy, reasonId].filter(Boolean).join(' ')
    : describedBy
  const btn = (
    <button
      {...rest}
      ref={ref}
      type={type}
      onClick={() => { if (!inoperable) onClick?.() }}
      // aria-disabled, а не disabled: заблокированная кнопка не должна терять
      // фокус. Loading использует ту же семантику, но сохраняет enabled-вид.
      aria-disabled={inoperable || undefined}
      aria-busy={loading || undefined}
      aria-describedby={buttonDescription || undefined}
      aria-label={loading ? processLabel : ariaLabel}
      title={blocked ? reason : undefined}
      data-loading={loading || undefined}
      onClickCapture={(e) => {
        if (inoperable) {
          e.stopPropagation()
          e.preventDefault()
          return
        }
        onClickCapture?.(e)
      }}
      onKeyDownCapture={(e) => {
        const activationKey = e.key === 'Enter' || e.key === ' '
        // aria-disabled не подавляет нативный keyboard click сам. Кроме
        // того, autorepeat не должен превращать удержание клавиши в серию
        // заявок — новая отдельная активация возможна только после keyup.
        if (activationKey && (inoperable || e.repeat)) {
          e.stopPropagation()
          e.preventDefault()
          return
        }
        onKeyDownCapture?.(e)
      }}
      className={`a3-btn ${look}${className ? ` ${className}` : ''}`}
    >
      {loadingLabel || loading ? (
        <span className="a3-btn-content">
          <span aria-hidden={loading || undefined}>{children}</span>
          <span className="a3-btn-loading" aria-hidden={!loading || undefined}>
            <span className="a3-btn-spinner" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="square" strokeDasharray="28 10"
                />
              </svg>
            </span>
            <span>{processLabel}</span>
          </span>
        </span>
      ) : children}
    </button>
  )
  // Причина блокировки стоит В ПОРЯДКЕ ЧТЕНИЯ и связана aria-describedby
  // (ревью № 13, дефект 12): title — дополнение, а не носитель.
  if (loading || !disabled || !reason) return btn
  return (
    <span className="inline-flex max-w-full flex-col gap-1">
      {btn}
      <span id={reasonId} className="text-small text-text-secondary">
        {reason}
      </span>
    </span>
  )
})

export type ProvenanceKind =
  | 'document'
  | 'derived'
  | 'customerConfirmed'
  | 'manual'
  | 'editing'

export type ProvenancePresentation = {
  kind: ProvenanceKind
  label: string
  detail?: string
}

const PROVENANCE_MARK: Record<ProvenanceKind, string> = {
  document: '◆',
  derived: '▲',
  customerConfirmed: '✓',
  manual: '✎',
  editing: '✎',
}

/**
 * Чип происхождения значения (DC-1).
 *
 * Знак выбирается по типизированному источнику, а не по строке, которую
 * видит пользователь. Поэтому деталь вроде «S. 15» или перевод подписи не
 * может случайно превратить документ в ручной ввод.
 */
export function ProvenanceChip({ provenance }: {
  provenance: ProvenancePresentation
}) {
  const t = useT()
  const mark = PROVENANCE_MARK[provenance.kind]
  const accessibleLabel = provenance.detail
    ? t('provenance.accessibleLabelWithDetail', {
      label: provenance.label,
      detail: provenance.detail,
    })
    : t('provenance.accessibleLabel', { label: provenance.label })
  return (
    <span className="a3-chip-src" aria-label={accessibleLabel}>
      {/* `.a3-chip-src .a3-dot` — точка индикатора из системы; знак остаётся
          рядом с ней, потому что цвет не является носителем (правило 8). */}
      <span aria-hidden="true" className="a3-dot" />
      <span aria-hidden="true">{mark}</span>
      <span>{provenance.label}</span>
      {provenance.detail && <span>· {provenance.detail}</span>}
    </span>
  )
}

/**
 * Домен числового ввода. Возвращает величину либо причину отказа — **не
 * бросает**: `new Decimal('abc')` бросает `DecimalError` прямо из обработчика
 * события, и экран уходит целиком (сплошное ревью 26, находка 5).
 *
 * Что здесь проверяется и почему именно это:
 *
 * · **разбор** — потому что поле принимает текст, а не число;
 * · **положительность** — площадь и число единиц не бывают нулевыми или
 *   отрицательными, и прежняя версия такие значения молча отбрасывала:
 *   пользователь видел, что поле вернулось к старому, и не знал почему;
 * · **целость для счётных величин** — `16,5 Wohneinheiten` не существует, а
 *   прежняя версия принимала: стор делил на 16,5, поле показывало 17.
 *
 * Чего здесь СОЗНАТЕЛЬНО нет — верхней границы. Ни один источник её не
 * объявляет, и назначить её здесь значило бы выдать выдуманный предел за
 * правило (R-25). Всё, что проверяется, следует из природы величины, а не из
 * политики.
 */
export function rejectNumericInput(
  raw: string, opts: { integer?: boolean } = {},
): 'notANumber' | 'notPositive' | 'notInteger' | null {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return 'notANumber'
  const v = new Decimal(cleaned)
  if (v.lte(0)) return 'notPositive'
  if (opts.integer && !v.isInteger()) return 'notInteger'
  return null
}

export function parseNumericInput(
  raw: string, opts: { integer?: boolean } = {},
): Decimal | null {
  if (rejectNumericInput(raw, opts) !== null) return null
  return new Decimal(raw.trim().replace(/\./g, '').replace(',', '.'))
}

const REJECTION_TEXT: Record<
  NonNullable<ReturnType<typeof rejectNumericInput>>, string
> = {
  notANumber: 'Nur Zahlen — der eingegebene Wert wurde nicht übernommen',
  notPositive: 'Der Wert muss größer als null sein — nicht übernommen',
  notInteger: 'Nur ganze Einheiten — nicht übernommen',
}

/**
 * Числовое поле с происхождением (DC-4). Правка прямо в презентации —
 * самый сильный момент демонстрации: клиент называет площадь, sales вводит,
 * всё пересчитывается, интервал сужается на глазах.
 *
 * Отказ не откатывает поле молча: черновик остаётся на экране вместе с
 * причиной, и цена при этом не меняется. Это правило 12 буквально — не
 * запрет ввода, а невозможность им испортить расчёт.
 */
export function NumericField({
  label, value, unit, provenance, decimals = 2, integer = false, onCommit,
}: {
  label: string
  value: Decimal
  unit?: string
  provenance: ProvenancePresentation
  decimals?: number
  /** Счётная величина: дробное значение не существует (Wohneinheiten). */
  integer?: boolean
  onCommit: (v: Decimal, confirmed: boolean) => void
}) {
  const tx = useTx()
  const [draft, setDraft] = useState<string | null>(null)
  const [rejection, setRejection] =
    useState<ReturnType<typeof rejectNumericInput>>(null)
  const shown = draft ?? formatDE(value, decimals)

  const commit = (confirmed: boolean) => {
    if (draft === null) return
    const why = rejectNumericInput(draft, { integer })
    if (why !== null) { setRejection(why); return }
    const next = parseNumericInput(draft, { integer })!
    setDraft(null)
    setRejection(null)
    if (!next.equals(value)) onCommit(next, confirmed)
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
            onChange={(e) => { setDraft(e.target.value); setRejection(null) }}
            onBlur={() => commit(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(true)
              if (e.key === 'Escape') { setDraft(null); setRejection(null) }
            }}
            aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
            aria-invalid={rejection !== null || undefined}
          />
          {unit && <span className="a3-unit">{unit}</span>}
        </span>
        <ProvenanceChip provenance={draft !== null
          ? { kind: 'editing', label: 'wird bearbeitet' }
          : provenance} />
      </div>
      {rejection !== null && (
        <p role="alert" className="a3-cap mt-2">{tx(REJECTION_TEXT[rejection])}</p>
      )}
      {draft !== null && rejection === null && (
        <p className="a3-cap mt-2">{tx('Enter — vom Kunden bestätigt · Tab — manuell erfasst · Esc — verwerfen')}</p>
      )}
    </div>
  )
}

/**
 * Skeleton (правило 30): плоские блоки БЕЗ shimmer-градиента — градиенты
 * запрещены правилом 4, и заглушка не притворяется контентом. Скринридеру
 * сообщается загрузка, блоки скрыты.
 */
export function Skeleton({ lines = 3, label = 'Wird geladen', announce = false }: {
  lines?: number
  label?: string
  /** Static specimens are not live regions; dynamic owners opt in. */
  announce?: boolean
}) {
  return (
    <div role={announce ? 'status' : undefined} aria-live={announce ? 'polite' : undefined}>
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
