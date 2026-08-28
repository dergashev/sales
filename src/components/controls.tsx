import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useT, useTx } from '../i18n'

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
  /** A composed control may own the visible reason outside this fieldset. */
  descriptionId?: string
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
  const descriptionId = useId()
  const groupRef = useRef<HTMLDivElement>(null)
  if (options.length > 3) {
    throw new Error(
      `SegmentedControl: ${options.length} сегментов — при 4+ значениях контракт требует <select> (LOCALE-004)`,
    )
  }
  const tx = useTx()
  const layoutClass = {
    stack: 'a3-segmented-stack',
    row: 'a3-segmented-row',
    inline: 'a3-segmented-inline',
  }[layout]
  const reasons = [
    ...(disabled && disabledReason ? [tx(disabledReason)] : []),
    ...options.filter((o) => o.disabled && o.disabledReason)
      .map((o) => tx(o.disabledReason!)),
  ]

  return (
    <fieldset className={`a3-segmented-fieldset ${layoutClass}`}>
      <legend>
        {legend}
      </legend>
      {/* Имя группы обязано быть у ТОГО элемента, который несёт роль:
          `legend` называет `fieldset`, а вложенная radiogroup оставалась
          безымянной — скринридер объявлял «группа» без темы. Найдено
          jsdom-тестом, не глазами. */}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={legend}
        className="a3-radio-segments"
        onKeyDown={(event) => {
          if (event.key !== 'Home' && event.key !== 'End') return
          const radios = [...(groupRef.current?.querySelectorAll<HTMLInputElement>(
            'input[type="radio"]:not(:disabled)',
          ) ?? [])]
          const target = event.key === 'Home' ? radios[0] : radios.at(-1)
          if (!target) return
          event.preventDefault()
          target.focus()
          target.click()
        }}
      >
        {options.map((o) => {
          const active = o.value === value
          const off = disabled || o.disabled
          return (
            <label key={o.value} data-disabled={off || undefined}>
              <input
                type="radio"
                className="peer sr-only"
                name={name}
                value={o.value}
                checked={active}
                disabled={off}
                aria-describedby={off
                  ? o.descriptionId ?? (reasons.length > 0 ? descriptionId : undefined)
                  : undefined}
                onChange={() => onChange(o.value)}
              />
              <span className={FOCUS_RING} aria-hidden="true" />
              <span className="a3-segment-check" aria-hidden="true">
                {active ? '✓' : ''}
              </span>
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
      {(helperText || reasons.length > 0) && (
        <p id={descriptionId} className="a3-segmented-helper">
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
  /**
   * Фотография варианта (поставка № 18). ВТОРИЧНЫЙ носитель: подпись и
   * цена остаются на плитке при любой судьбе картинки — не загрузилась,
   * не существует, отключена пользователем (правило 8).
   */
  image?: { url: string; motif: string } | null
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
  value: T | null
  options: ReadonlyArray<RadioCard<T>>
  onChange: (v: T) => void
  /** Geist-Vorschau (DC-28): наведение/фокус на карточку, задержка — токен. */
  onPreview?: (v: T | null) => void
  /** Видимое имя группы уже даёт заголовок карточки-контейнера. */
  legendHidden?: boolean
}) {
  const name = useId()
  const tx = useTx()
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
      {/* `.a3-grid-host` — носитель container query (TASK-22): сетка
          считает ширину КОЛОНКИ, в которой лежит, а не окна. Без него
          плитки раскладывались по вьюпорту и вылезали из центральной
          зоны между панелями. */}
      <div className="a3-grid-host mt-2">
      <div
        role="radiogroup"
        aria-label={legend}
        className="a3-ogrid"
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
                (o.disabled ? ' cursor-default' : '')}
            >
              {/* Task 04 (F-03, P0): Klick war bisher nur Commit — der
                  Timer wurde gelöscht, aber ein bereits AUSGELÖSTES
                  `onPreview(v)` (Hover/Fokus vor dem Klick) blieb im Store
                  stehen, bis ein separates mouseleave/blur folgte. Fokus
                  bleibt nach einem Radio-Klick nativ auf dem Element — ohne
                  folgendes blur zeigte der Geist die bereits übernommene
                  Änderung unbegrenzt weiter (DC-28 verlangt „Klick —
                  Fixierung, Vorschau erlischt"). Commit löscht die Vorschau
                  jetzt selbst, unabhängig von einem späteren
                  Maus-/Fokusereignis. */}
              <input
                type="radio"
                className="peer a3-input-cover"
                name={name}
                value={o.value}
                checked={active}
                disabled={o.disabled}
                aria-label={tx(o.title)}
                aria-describedby={describedBy}
                onChange={() => {
                  clearTimeout(previewTimer.current)
                  onChange(o.value)
                  onPreview?.(null)
                }}
                onFocus={() => !o.disabled && previewStart(o.value)}
                onBlur={previewStop}
              />
              {/* Медиа-слот контракта идёт ПЕРВЫМ. `alt=""` намеренно:
                  вариант уже назван подписью, и повтор мотива вслух был бы
                  вторым чтением того же. Битая картинка снимает слот, а не
                  ломает плитку. */}
              {o.image && (
                <img
                  className="a3-option-media"
                  src={o.image.url}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.hidden = true }}
                />
              )}
              {/* checkIndicator контракта — `.a3-ok` (✓-круг системы). Видимость
                  и бордер выделения теперь читает CSS напрямую из реального
                  состояния (`.a3-okc-tile:has(:checked)`, components.css),
                  а не из параллельного Tailwind-класса: `.a3-okc-tile .a3-ok`
                  — двух-классовый селектор компонента (специфичность 0,2,0) —
                  всегда побеждал одноклассовый `.opacity-100` (0,1,0)
                  независимо от порядка объявления, поэтому отметка выбора
                  никогда не была видна (F10). */}
              <span aria-hidden="true" className="a3-ok">
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
                  <span aria-hidden="true">◆ </span>{tx('Empfohlen')}</span>
              )}
              {o.disabled && o.disabledReason && (
                <span id={`${name}-${o.value}-constraint`} className="a3-st">
                  {tx('Nicht verfügbar')} · {tx(o.disabledReason)}
                </span>
              )}
            </label>
          )
        })}
      </div>
      </div>
    </fieldset>
  )
}

/* ── CheckboxCard ──────────────────────────────────────────────────────── */

export type CheckboxCardOption = {
  value: string
  title: string
  /** Фотография — та же логика, что у RadioCardGroup: вторичный носитель. */
  image?: { url: string; motif: string } | null
  description?: string
  /** Последствие видно ВСЕГДА, не по hover (R-05, OPTION-009). */
  consequence: string
  checked: boolean
  onChange: (checked: boolean) => void
  /**
   * Обязательная включённая опция (OPTION-002/OPTION-005): замок-иконка +
   * видимая подпись `Pflicht`, а не `disabled` — `disabled` для неё запрещён
   * контрактом. Контрол остаётся фокусируемым; снятие выбора блокируется на
   * `click`, не через нативный атрибут `disabled` (иначе выпал бы из
   * Tab-порядка, а «остаётся фокусируемым» — часть контракта).
   */
  mandatory?: boolean
  mandatoryReason?: string
  disabled?: boolean
  disabledReason?: string
}

/**
 * CheckboxCard (components-core.md §CheckboxCard, OPTION-008): анатомия
 * идентична RadioCardGroup (медиа-слот, `title`, `description`,
 * `consequenceLine`), но `<input type="checkbox">`, индикатор — квадрат с ✓
 * (не круг RadioCardGroup — контракт называет форму явно), и карточки
 * независимы: нет группового цикла стрелок, каждый checkbox — свой
 * focus stop (родная семантика).
 */
export function CheckboxCard({ legend, legendHidden, options }: {
  legend: string
  options: ReadonlyArray<CheckboxCardOption>
  /** Видимое имя группы уже даёт заголовок карточки-контейнера. */
  legendHidden?: boolean
}) {
  const name = useId()
  const tx = useTx()
  return (
    <fieldset>
      <legend className={legendHidden ? 'sr-only' : 'text-small font-medium text-text-primary'}>
        {legend}
      </legend>
      <div className="a3-grid-host mt-2">
        <div role="group" aria-label={legend} className="a3-ogrid">
          {options.map((o) => {
            const describedBy = [
              o.description && `${name}-${o.value}-desc`,
              `${name}-${o.value}-conseq`,
              o.mandatory && `${name}-${o.value}-mandatory`,
              !o.mandatory && o.disabled && o.disabledReason && `${name}-${o.value}-constraint`,
            ].filter(Boolean).join(' ')
            return (
              <label
                key={o.value}
                /* `data-mandatory` excludes mandatory tiles from the
                   `:has(:checked)` selected-state CSS (components.css):
                   a mandatory tile is always `checked`, but it is an
                   informational fact, not a user decision, and must never
                   visually impersonate a real selection (F19). Its only
                   state signal remains the `■ Pflicht` label below. */
                data-mandatory={o.mandatory || undefined}
                className={'a3-okc-tile block' +
                  (o.disabled && !o.mandatory ? ' cursor-default' : '')}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={o.checked}
                  aria-label={tx(o.title)}
                  aria-describedby={describedBy}
                  aria-disabled={o.mandatory || o.disabled || undefined}
                  disabled={o.disabled && !o.mandatory}
                  onClick={(e) => {
                    if (!o.mandatory) return
                    e.preventDefault()
                    // Belt-and-suspenders: some test/browser environments
                    // still flip the native `.checked` property as part of
                    // dispatching `click` even when the default action is
                    // cancelled. Re-assert synchronously so a mandatory tile
                    // can never render/report unchecked, in code or in tests.
                    e.currentTarget.checked = true
                  }}
                  onChange={() => { if (!o.mandatory) o.onChange(!o.checked) }}
                />
                {o.image && (
                  <img
                    className="a3-option-media"
                    src={o.image.url}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.currentTarget.hidden = true }}
                  />
                )}
                <span aria-hidden="true" className="a3-ok a3-ok-square">
                  ✓
                </span>
                <span className={`absolute inset-0 ${FOCUS_RING}`} aria-hidden="true" />
                <b>{o.title}</b>
                {o.description && (
                  <span id={`${name}-${o.value}-desc`} className="a3-st">
                    {o.description}
                  </span>
                )}
                <span id={`${name}-${o.value}-conseq`} className="a3-pd numeric">
                  {o.consequence}
                </span>
                {o.mandatory && (
                  <span id={`${name}-${o.value}-mandatory`} className="a3-st">
                    {/* Tech Review P2: geometric glyph, not a color emoji —
                        every other status mark in this product is
                        monochrome (✓ ✗ ✕ ✎ ⚙ ◆ ○); an emoji would be the
                        only source of uncontrolled color in the UI. The
                        glyph is decorative (aria-hidden): "Pflicht" carries
                        the meaning (ICON-003). */}
                    <span aria-hidden="true">■ </span>
                    {tx('Pflicht')}
                    {o.mandatoryReason ? ` · ${tx(o.mandatoryReason)}` : ''}
                  </span>
                )}
                {!o.mandatory && o.disabled && o.disabledReason && (
                  <span id={`${name}-${o.value}-constraint`} className="a3-st">
                    {tx('Nicht verfügbar')} · {tx(o.disabledReason)}
                  </span>
                )}
              </label>
            )
          })}
        </div>
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

export function FacadeTileGroup({
  legend, value, onChange, onPreview, options,
}: {
  legend: string
  value: string
  onChange: (v: string) => void
  /**
   * Geist-Vorschau (DC-28): последствие у цены ДО клика. Витринные плитки
   * фасада — такое же денежное решение, как карточки опций, и молчать о
   * будущем итоге им нечем оправдаться.
   */
  onPreview?: (v: string | null) => void
  options: Array<{
    value: string
    label: string
    consequence: string
    /** Плейсхолдер-образец материала — запасной вид, если фото нет. */
    material: FacadeMaterial
    image?: { url: string; motif: string } | null
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
      <div className="a3-grid-host">
      <div role="radiogroup" aria-label={legend} className="a3-fgrid">
        {options.map((o) => {
          const active = o.value === value
          return (
            <label
              key={o.value}
              className={'a3-fk block' +
                (active ? ' border-selection-border' : '') +
                (o.disabled ? ' cursor-default' : '')}
              onMouseEnter={() => !o.disabled && onPreview?.(o.value)}
              onMouseLeave={() => onPreview?.(null)}
              onFocusCapture={() => !o.disabled && onPreview?.(o.value)}
              onBlurCapture={() => onPreview?.(null)}
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
              {/* Фотография материала, если поставка её дала; иначе —
                  плейсхолдер-образец системы. Контракт DC-20 объявляет
                  `img.a3-img` опциональным ровно для этого. */}
              {o.image ? (
                <img className="a3-img" src={o.image.url} alt="" loading="lazy"
                     onError={(e) => { e.currentTarget.hidden = true }} />
              ) : (
                <span aria-hidden="true"
                      className={`a3-img ${FACADE_MATERIAL_CLS[o.material]} a3-f-win`} />
              )}
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
  const reasonId = useId()
  const tx = useTx()
  return (
    <div className="a3-switch-row">
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        onClick={() => !disabled && onChange(!checked)}
        className="a3-switch-button"
      >
        <span className="a3-switch-track" aria-hidden="true" />
        <span className="a3-switch-thumb" aria-hidden="true" />
      </button>
      <span className="a3-switch-state">{tx(checked ? 'Ein' : 'Aus')}</span>
      {disabled && disabledReason && (
        <span id={reasonId} className="a3-form-disabled-reason">
          {tx(disabledReason)}
        </span>
      )}
      {children}
    </div>
  )
}

/* ── DateField (R1 · DESIGN-15) ──────────────────────────────────────────
 * Replaces the native `<input type="date">` exposed on client-visible
 * commercial screens (Termine, also in Kundenansicht — the exact surface
 * the audit named). A real text input with an explicit `TT.MM.JJJJ` format
 * HINT (not a raw native placeholder) keeps keyboard-first precision entry
 * — the expert path — without native browser chrome. No calendar popover:
 * the audit's ticket explicitly scopes that out until there is evidence a
 * picker is worth the added surface. */

const INPUT_FOCUS = 'outline-none focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

const DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/

function parseDE(raw: string): Date | null {
  const m = DATE_PATTERN.exec(raw.trim())
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const day = Number(dd), month = Number(mm), year = Number(yyyy)
  const d = new Date(year, month - 1, day)
  // Reject values `Date` silently rolled over (e.g. 31.02.2026).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

function formatDEDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function DateField({
  label, value, onCommit, min, max, helperText, name = 'date',
}: {
  label: string
  /** `null` — no date set yet (empty state, never "0000-00-00"). */
  value: Date | null
  onCommit: (date: Date | null, confirmed: boolean) => void
  min?: Date
  max?: Date
  helperText?: string
  name?: string
}) {
  const t = useT()
  const id = useId()
  const helperId = useId()
  const errorId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const shown = draft ?? (value ? formatDEDate(value) : '')

  const commit = (confirmed: boolean) => {
    if (draft === null) return
    if (draft.trim() === '') { setDraft(null); setInvalid(false); onCommit(null, confirmed); return }
    const parsed = parseDE(draft)
    if (!parsed || (min && parsed < min) || (max && parsed > max)) { setInvalid(true); return }
    setDraft(null)
    setInvalid(false)
    onCommit(parsed, confirmed)
  }

  return (
    <div className="a3-form-field">
      <label htmlFor={id} className="block text-small font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={`a3-input mt-2 ${INPUT_FOCUS}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder="TT.MM.JJJJ"
        value={shown}
        onChange={(e) => { setDraft(e.target.value); setInvalid(false) }}
        onBlur={() => commit(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(true)
          if (e.key === 'Escape') { setDraft(null); setInvalid(false) }
        }}
        aria-describedby={[helperText ? helperId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined}
        aria-invalid={invalid || undefined}
      />
      {helperText && (
        <p id={helperId} className="a3-cap mt-1">{helperText}</p>
      )}
      {invalid && (
        <p id={errorId} role="alert" className="a3-cap mt-1">
          {t('configurator.schedule.dateInvalid')}
        </p>
      )}
    </div>
  )
}

/* ── Stepper (R1 · DESIGN-15) ─────────────────────────────────────────────
 * Canonical internal preparation control, APPROVED_DOWNSTREAM for VO-T3.
 * It is intentionally not adopted in Offer, Presentation, or another
 * client-facing surface by VO-T4. The numeric field and +/- buttons preserve
 * discrete steps and leave the commercial consequence to the owning screen. */

export function Stepper({
  label, value, min, max, step = 1, unit, onChange, impact,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  /** Live consequence of the current value (e.g. "− 38.200 €"), rendered
   * next to the control — not owned by this primitive's own semantics. */
  impact?: ReactNode
}) {
  const tx = useTx()
  const id = useId()
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const dec = () => onChange(clamp(value - step))
  const inc = () => onChange(clamp(value + step))
  return (
    <div className="a3-form-field">
      <label htmlFor={id} className="block text-small font-medium text-text-primary">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className="a3-stepper-button hit-target"
          onClick={dec}
          disabled={value <= min}
          aria-label={tx('Verringern')}
        >
          −
        </button>
        <span className="a3-input a3-stepper-value">
          <input
            id={id}
            className={`numeric ${INPUT_FOCUS}`}
            type="text"
            inputMode="numeric"
            readOnly
            value={String(value)}
            aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
          />
          {unit && <span className="a3-unit">{unit}</span>}
        </span>
        <button
          type="button"
          className="a3-stepper-button hit-target"
          onClick={inc}
          disabled={value >= max}
          aria-label={tx('Erhöhen')}
        >
          +
        </button>
        {impact && <span className="ml-2 numeric text-text-secondary">{impact}</span>}
      </div>
    </div>
  )
}
