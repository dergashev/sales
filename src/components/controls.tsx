import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Контролы выбора по контрактам `design-system/components-core.md` §3:
 * SegmentedControl · RadioCardGroup · Switch.
 *
 * Общее решение всех трёх: **нативные `<input>`/`role="switch"`, не
 * кнопки с ролью** (RADIO-001 прямо запрещает role=radio без полного
 * клавиатурного контракта — стрелки у нативной radio-группы двигают фокус
 * И выбирают бесплатно и правильно).
 *
 * Носитель выбора — бордер `--color-selection-border` + видимый ✓ +
 * `aria-checked`; заливка `--color-surface-selected` только поддерживает
 * (gate 21: в forced-colors фон исчезает). Оранжевого здесь не существует
 * (R-01).
 */

const FOCUS_RING =
  'peer-focus-visible:outline peer-focus-visible:outline-2 ' +
  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring'

/* ── SegmentedControl ──────────────────────────────────────────────────── */

export type Segment<T extends string> = {
  value: T
  label: string
  disabled?: boolean
  /** Недоступный сегмент существует только вместе с видимой причиной. */
  disabledReason?: string
}

/**
 * SegmentedControl (TABS-002): конфигурационный выбор из 2–3 значений.
 * 4+ значений — уже `<select>` (LOCALE-004), контрол этого не поддерживает.
 * Подпись — состояние, не действие (LAYOUT-008): `Kompakt`, не
 * `Kompakt umschalten`.
 */
export function SegmentedControl<T extends string>({
  legend, value, options, onChange, helperText, layout = 'stack',
  disabled, disabledReason,
}: {
  legend: string
  value: T
  options: ReadonlyArray<Segment<T>>
  onChange: (v: T) => void
  helperText?: string
  /** `row` — legend слева в строке списка; `inline` — компактно в шапке. */
  layout?: 'stack' | 'row' | 'inline'
  /** Недоступность всей группы — только с видимой причиной (STATE-006). */
  disabled?: boolean
  disabledReason?: string
}) {
  const name = useId()
  if (options.length > 3) {
    throw new Error(
      `SegmentedControl: ${options.length} сегментов — при 4+ значениях контракт требует <select> (LOCALE-004)`,
    )
  }
  const reasons = [
    ...(disabled && disabledReason ? [disabledReason] : []),
    ...options.filter((o) => o.disabled && o.disabledReason).map((o) => o.disabledReason!),
  ]

  return (
    <fieldset className={layout === 'row'
      ? 'flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3'
      : layout === 'inline' ? 'flex flex-wrap items-center gap-3' : ''}>
      <legend className={layout === 'row'
        ? 'float-left text-body text-text-primary'
        : layout === 'inline'
          ? 'float-left text-small text-text-secondary'
          : 'text-small font-medium text-text-primary'}>
        {legend}
      </legend>
      {/* Имя группы обязано быть у ТОГО элемента, который несёт роль:
          `legend` называет `fieldset`, а вложенная radiogroup оставалась
          безымянной — скринридер объявлял «группа» без темы. Найдено
          jsdom-тестом, не глазами. */}
      <div role="radiogroup" aria-label={legend}
           className={'flex border-contrast border-border-strong ' +
        (layout === 'stack' ? 'mt-2 w-max' : layout === 'row' ? 'ml-auto' : '')}>
        {options.map((o, i) => {
          const active = o.value === value
          const off = disabled || o.disabled
          return (
            <label key={o.value} className={i > 0 ? 'border-l border-border-default' : ''}>
              <input
                type="radio"
                className="peer sr-only"
                name={name}
                value={o.value}
                checked={active}
                disabled={off}
                onChange={() => onChange(o.value)}
              />
              <span
                className={`relative flex cursor-pointer items-center gap-1 px-3 text-small ${FOCUS_RING} ` +
                  'before:absolute before:left-1/2 before:top-1/2 before:min-h-hit-target ' +
                  'before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""] ' +
                  (active
                    ? 'border-selected border-selection-border bg-surface-selected font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-action-secondary-hover') +
                  (off ? ' cursor-default text-text-disabled hover:bg-surface-default' : '')}
                style={{ minHeight: 'var(--control-height)' }}
              >
                {active && <span aria-hidden="true">✓</span>}
                {o.label}
              </span>
            </label>
          )
        })}
      </div>
      {(helperText || reasons.length > 0) && (
        <p className={'text-small text-text-secondary ' +
          (layout === 'row' ? 'w-full pt-1' : layout === 'inline' ? '' : 'mt-1')}>
          {[helperText, ...reasons].filter(Boolean).join(' · ')}
        </p>
      )}
    </fieldset>
  )
}

/* ── RadioCardGroup ────────────────────────────────────────────────────── */

export type RadioCard<T extends string> = {
  value: T
  title: string
  description?: string
  /**
   * Последствие видно ВСЕГДА, не по hover (R-05, OPTION-009):
   * `≈ +97.000 € Mehrpreis` либо `aktuelle Auswahl`.
   */
  consequence: string
  /** `Empfohlen` ≠ `Ausgewählt` (RADIO-002): бейдж никогда не выбирает сам. */
  recommended?: boolean
  disabled?: boolean
  disabledReason?: string
}

/**
 * Задержка Geist-Vorschau — токен `--motion-delay-hover-preview`
 * (ADR-запись 11). Fallback 200 — только вне DOM (SSR-тесты).
 */
function previewDelayMs(): number {
  if (typeof document === 'undefined') return 200
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-delay-hover-preview')
  const ms = parseInt(raw, 10)
  return Number.isFinite(ms) && ms > 0 ? ms : 200
}

export function RadioCardGroup<T extends string>({
  legend, value, options, onChange, onPreview, legendHidden,
}: {
  legend: string
  value: T
  options: ReadonlyArray<RadioCard<T>>
  onChange: (v: T) => void
  /** Geist-Vorschau (DC-28): наведение/фокус на карточку, задержка — токен. */
  onPreview?: (v: T | null) => void
  /** Видимое имя группы уже даёт заголовок карточки-контейнера. */
  legendHidden?: boolean
}) {
  const name = useId()
  const previewTimer = useRef<ReturnType<typeof setTimeout>>()
  const previewStart = (v: T) => {
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => onPreview?.(v), previewDelayMs())
  }
  /**
   * `tapPreview` (DC-28): у касания нет наведения, поэтому и задержки нет —
   * она существует, чтобы отличить намеренное наведение от проезда мышью.
   * Ограничение названо честно: последующий клик фиксирует выбор обычным
   * путём, двухшагового «первое касание показывает, второе подтверждает»
   * здесь нет.
   */
  const previewTap = (v: T) => {
    clearTimeout(previewTimer.current)
    onPreview?.(v)
  }
  const previewStop = () => {
    clearTimeout(previewTimer.current)
    onPreview?.(null)
  }

  // Esc гасит призрак, не трогая выбор: превью — верхний временный слой
  // над ценой, и выход из него обязан быть таким же дешёвым, как вход.
  useEffect(() => {
    if (!onPreview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onPreview(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPreview])
  return (
    <fieldset>
      <legend className={legendHidden ? 'sr-only' : 'text-small font-medium text-text-primary'}>
        {legend}
      </legend>
      {/* tileGrid: высота карточек в ряду выравнивается сеткой (OPTION-010);
          ширины через minmax, не фиксированные (правило 3a). */}
      {/* Контракт требует `group [role="radiogroup"]` внутри fieldset
          (components-core §RadioCardGroup). Роли не было вовсе: нативные
          radio работали, но группа как сущность в дереве доступности
          отсутствовала. */}
      <div
        role="radiogroup"
        aria-label={legend}
        className="mt-2 grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(22ch, 1fr))' }}
      >
        {options.map((o) => {
          const active = o.value === value
          const describedBy = [
            o.description && `${name}-${o.value}-desc`,
            `${name}-${o.value}-conseq`,
            o.disabled && o.disabledReason && `${name}-${o.value}-constraint`,
          ].filter(Boolean).join(' ')
          return (
            <label
              key={o.value}
              onMouseEnter={() => !o.disabled && previewStart(o.value)}
              onMouseLeave={previewStop}
              onTouchStart={() => !o.disabled && previewTap(o.value)}
              className={'relative flex cursor-pointer flex-col gap-1 p-4 pr-7 ' +
                (active
                  ? 'border-selected border-selection-border bg-surface-selected'
                  : 'border border-border-default hover:bg-surface-subtle') +
                (o.disabled ? ' cursor-default' : '')}
            >
              <input
                type="radio"
                className="peer sr-only"
                name={name}
                value={o.value}
                checked={active}
                disabled={o.disabled}
                aria-describedby={describedBy}
                onChange={() => { clearTimeout(previewTimer.current); onChange(o.value) }}
                onFocus={() => !o.disabled && previewStart(o.value)}
                onBlur={previewStop}
              />
              {/* Индикатор: круг + ✓. Размер — существующий токен иконки:
                  собственный --size-control-indicator ждёт ADR (запись 14). */}
              <span
                aria-hidden="true"
                className={'circle absolute right-3 top-4 inline-flex items-center justify-center text-small ' +
                  (active
                    ? 'border-selected border-selection-border text-text-primary'
                    : 'border border-border-default text-transparent')}
                style={{ width: 'var(--size-icon-lg)', height: 'var(--size-icon-lg)' }}
              >
                ✓
              </span>
              <span className={`absolute inset-0 ${FOCUS_RING}`} aria-hidden="true" />
              {/* Каждая подпись — блочный элемент: инлайновые склеиваются
                  (регрессия «PersonenaufzuginklusiveGK 5»). */}
              <span className={'block text-body ' +
                (active ? 'font-medium text-text-primary' : 'text-text-primary')}
                style={{ overflowWrap: 'break-word', hyphens: 'auto' }}>
                {o.title}
              </span>
              {o.description && (
                <span id={`${name}-${o.value}-desc`} className="block text-small text-text-secondary">
                  {o.description}
                </span>
              )}
              <span id={`${name}-${o.value}-conseq`}
                    className="numeric block text-small text-text-secondary">
                {o.consequence}
              </span>
              {o.recommended && (
                <span className="block text-small font-medium text-text-secondary">
                  <span aria-hidden="true">◆ </span>Empfohlen
                </span>
              )}
              {o.disabled && o.disabledReason && (
                <span id={`${name}-${o.value}-constraint`}
                      className="block text-small text-text-secondary">
                  Nicht verfügbar · {o.disabledReason}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ── Switch ────────────────────────────────────────────────────────────── */

/**
 * Switch — ТОЛЬКО немедленное бинарное переключение расчётной настройки,
 * не выбор позиции оффера (OPTION-008): `Regionalfaktor anwenden`,
 * `KG-700-Modus`. Позиция ползунка не единственный носитель — `stateText`
 * дублирует текстом (gate 7).
 */
export function Switch({ label, checked, onChange, disabled, disabledReason, children }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  disabledReason?: string
  children?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span id={id} className="text-body text-text-primary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onChange(!checked)}
        // Дорожка, ползунок и его ход — из системы (`.a3-toggle`, `.a3-on`):
        // геометрия переключателя принадлежит дизайну, а не этому файлу.
        className={`a3-toggle ${checked ? 'a3-on' : ''} outline-none ` +
          'focus-visible:outline focus-visible:outline-2 ' +
          'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'}
      />
      <span className="text-body text-text-secondary">{checked ? 'Ein' : 'Aus'}</span>
      {disabled && disabledReason && (
        <span className="a3-cap">{disabledReason}</span>
      )}
      {children}
    </div>
  )
}
