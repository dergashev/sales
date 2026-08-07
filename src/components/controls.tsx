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
      {/* Сетка и плитка — контракт DC-40 (`.a3-ogrid`/`.a3-okc-tile`).
          Пробел системы, названный вслух: CSS знает выбранность только как
          `[aria-pressed="true"]` (вкус-тумблер витрины), а радио-вкус
          крючка не имеет — до его появления (заявка в TASK-15) выбранность
          доносят две утилиты состояния: бордер и видимость ✓-круга. */}
      <div
        role="radiogroup"
        aria-label={legend}
        className="a3-ogrid mt-2"
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
              className={'a3-okc-tile block' +
                (active ? ' border-selection-border' : '') +
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
              {/* checkIndicator контракта — `.a3-ok` (✓-круг системы). */}
              <span aria-hidden="true"
                    className={'a3-ok' + (active ? ' opacity-100' : '')}>
                ✓
              </span>
              <span className={`absolute inset-0 ${FOCUS_RING}`} aria-hidden="true" />
              {/* Каждая подпись — блочный элемент: инлайновые склеиваются
                  (регрессия «PersonenaufzuginklusiveGK 5»). */}
              <b>{o.title}</b>
              {o.description && (
                <span id={`${name}-${o.value}-desc`} className="a3-st">
                  {o.description}
                </span>
              )}
              {/* priceDelta контракта — `.a3-pd`: цена живёт на плитке. */}
              <span id={`${name}-${o.value}-conseq`} className="a3-pd numeric">
                {o.consequence}
              </span>
              {o.recommended && (
                <span className="a3-st">
                  <span aria-hidden="true">◆ </span>Empfohlen
                </span>
              )}
              {o.disabled && o.disabledReason && (
                <span id={`${name}-${o.value}-constraint`} className="a3-st">
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

/* ── FacadeTileGroup · DC-20 ───────────────────────────────────────────── */

/**
 * Фасадные карточки (DC-20): материал различим ДО чтения подписи —
 * плитка несёт плейсхолдер-образец материала из системы (a3-f-putz
 * и родственные классы),
 * не рендер (D-21: реальные рендеры в прототип не копируются, витрина
 * говорит это прямо). Семантика — та же радиогруппа, что у DC-40:
 * взаимоисключающий выбор, switch запрещён (OPTION-008).
 *
 * Названные пробелы системы (заявка в TASK-15): радио-крючок выбранности
 * (CSS знает только `[aria-pressed]`) и слот цены на фасадной плитке —
 * цена здесь добавлена композицией, по критерию PO «цена на плитке».
 */

const FACADE_MATERIAL_CLS = {
  putz: 'a3-f-putz', holz: 'a3-f-holz',
  klinker: 'a3-f-klinker', kombi: 'a3-f-kombi',
} as const

export type FacadeMaterial = keyof typeof FACADE_MATERIAL_CLS

export function FacadeTileGroup({ legend, value, onChange, options }: {
  legend: string
  value: string
  onChange: (v: string) => void
  options: Array<{
    value: string
    label: string
    consequence: string
    material: FacadeMaterial
    axes: string[]
    disabled?: boolean
    disabledReason?: string
  }>
}) {
  const name = useId()
  const selected = options.find((o) => o.value === value)
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="a3-fgrid">
        {options.map((o) => {
          const active = o.value === value
          return (
            <label
              key={o.value}
              className={'a3-fk block' +
                (active ? ' border-selection-border' : '') +
                (o.disabled ? ' cursor-default' : '')}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={o.value}
                checked={active}
                disabled={o.disabled}
                aria-describedby={`${name}-${o.value}-pd` +
                  (o.disabled && o.disabledReason ? ` ${name}-${o.value}-why` : '')}
                onChange={() => onChange(o.value)}
              />
              <span className={`absolute inset-0 ${FOCUS_RING}`} aria-hidden="true" />
              <span aria-hidden="true"
                    className={`a3-img ${FACADE_MATERIAL_CLS[o.material]} a3-f-win`} />
              <span aria-hidden="true" className={'a3-ok' + (active ? ' opacity-100' : '')}>
                ✓
              </span>
              <span className="a3-nm">{o.label}</span>
              <span id={`${name}-${o.value}-pd`}
                    className="numeric block px-2 pb-2 text-small text-text-primary">
                {o.consequence}
              </span>
              {o.disabled && o.disabledReason && (
                <span id={`${name}-${o.value}-why`}
                      className="block px-2 pb-2 text-small text-text-secondary">
                  Nicht verfügbar · {o.disabledReason}
                </span>
              )}
            </label>
          )
        })}
      </div>
      {/* Оси выбранного варианта — читаемая сводка, не только картинка
          (правило 8: смысл не передаётся одним цветом/паттерном). */}
      {selected && (
        <div className="a3-faxes">
          {selected.axes.map((a, i) => (
            <span key={a} className={'a3-tag' + (i === 0 ? ' a3-orange' : '')}>{a}</span>
          ))}
        </div>
      )}
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
