import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * ChoiceGroup — the canonical RECORDED DECISION (VR3-03, targets T-018–T-027).
 *
 * WHY A NEW CAPABILITY AND NOT `SegmentedControl`.
 *
 * `SegmentedControl` is a settings control: it always has a value, and its
 * contract (`components-core.md` §3) is a configuration choice among 2–3
 * options. A recorded decision is a different thing in three ways that
 * matter here, and each of them is a defect if you pretend otherwise:
 *
 * 1. It has an UNDECIDED zero-state. Nothing is checked, and that absence is
 *    the honest state of a question nobody has answered — the exact
 *    distinction the replaced binary scope model could not hold (VR3-00
 *    D-014).
 * 2. Every option carries its CONSEQUENCE, visibly and always, because the
 *    user is deciding money (R-05/OPTION-009).
 * 3. It is dense enough to repeat once per row in a table of six or of
 *    sixty, which the segmented control's `min-height` control geometry is
 *    not.
 *
 * DECORATION IS INERT (audit F-009). A decorative `aria-hidden` layer once
 * intercepted a real service choice in this product, so a normal pointer
 * click could not activate it and only a forced check could. Here the native
 * `<input>` inside its `<label>` owns the whole hit area and every
 * decorative layer is `pointer-events: none` in `.a3-choice`'s own CSS —
 * pointer, keyboard and assistive activation are the same act.
 */

export type ChoiceOption<T extends string> = {
  value: T
  /** The state, as a word — never an action ("Enthalten", not "Aufnehmen"). */
  label: string
  /**
   * The consequence of choosing this, visible at all times rather than on
   * hover. A signed amount, or the word that stands in for one.
   */
  consequence?: string
  disabled?: boolean
  /** An unavailable option exists only together with its visible reason. */
  disabledReason?: string
  /**
   * VR3-TGA-UX-00 — the option CARD's fixed slots, for the `stack`/`grid`
   * layouts: ONE differentiator under the name, an optional neutral badge
   * (`All3-Standard`, informative and never "required") and an optional
   * supportive image the caller has already decided is decorative. All three
   * are absent from the released inline layout, whose options are words.
   */
  description?: string
  badge?: string
  media?: ReactNode
}

/**
 * How the options are laid out (VR3-TGA-UX-00, decision pattern contract).
 *
 * `inline` is the released segmented row — two or three words side by side.
 * `stack` is ONE column of full-width option cards, the layout for five or
 * more alternatives or for any long technical name. `grid` is two columns of
 * cards where the editor is wide enough (a container query decides, at
 * 720 px) and one column where it is not. The caller chooses from option
 * count and copy length — deterministically, never per decision.
 */
export type ChoiceLayout = 'inline' | 'stack' | 'grid'

export function ChoiceGroup<T extends string>({
  legend, legendHidden, value, options, onChange, onPreview,
  density = 'default', invalid, describedBy, footer, layout = 'inline', autoFocus = false,
}: {
  legend: string
  /** The row or heading already names the decision. */
  legendHidden?: boolean
  /** `null` is UNDECIDED: no option is checked and none is implied. */
  value: T | null
  options: ReadonlyArray<ChoiceOption<T>>
  onChange: (value: T) => void
  /** Geist-Vorschau (DC-28): the consequence before the commitment. */
  onPreview?: (value: T | null) => void
  density?: 'default' | 'compact'
  invalid?: boolean
  describedBy?: string
  footer?: ReactNode
  layout?: ChoiceLayout
  /**
   * Put focus on the checked option — or the first enabled one when nothing
   * is checked — as the group mounts. Entering edit mode (VR3-TGA-UX-00) is
   * the one caller: `Ändern` opens the alternatives and the keyboard user
   * arrives INSIDE them, on the current answer, rather than back at the top.
   */
  autoFocus?: boolean
}) {
  const name = useId()
  const groupRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!autoFocus) return
    const radios = [...(groupRef.current?.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]:not(:disabled)',
    ) ?? [])]
    const target = radios.find((radio) => radio.checked) ?? radios[0]
    target?.focus()
    // Mount only: re-running on every value change would drag focus back to
    // the group while the user is already elsewhere in the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])
  const reasons = options
    .filter((o) => o.disabled && o.disabledReason)
    .map((o) => o.disabledReason!)
  const reasonId = useId()

  return (
    <fieldset className="a3-choice-fieldset">
      <legend className={legendHidden ? 'sr-only' : 'a3-choice-legend'}>{legend}</legend>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={legend}
        aria-invalid={invalid || undefined}
        aria-describedby={[describedBy, reasons.length > 0 ? reasonId : null]
          .filter(Boolean).join(' ') || undefined}
        className={density === 'compact' ? 'a3-choice a3-choice-compact' : 'a3-choice'}
        data-layout={layout === 'inline' ? undefined : layout}
        onKeyDown={(event) => {
          // Native radios already move focus AND selection with the arrows.
          // Home/End are the two the platform does not give for free, and the
          // canonical `SegmentedControl` adds them the same way.
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
        onMouseLeave={() => onPreview?.(null)}
      >
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className="a3-choice-option"
              data-checked={checked || undefined}
              data-disabled={option.disabled || undefined}
              onMouseEnter={() => { if (!option.disabled) onPreview?.(option.value) }}
              onFocus={() => { if (!option.disabled) onPreview?.(option.value) }}
              onBlur={() => onPreview?.(null)}
            >
              <input
                type="radio"
                className="a3-choice-input"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                /**
                 * AN UNAVAILABLE OPTION CARRIES ITS REASON IN ITS OWN NAME.
                 *
                 * The reason was already rendered — once, for the whole
                 * group, via `aria-describedby`. That is enough when one
                 * option is unavailable and ambiguous when two are, and a
                 * disabled radio is skipped by keyboard navigation anyway, so
                 * a user arriving at the group by any route heard "not
                 * selectable" without ever hearing why. Folding the reason
                 * into the option's accessible name makes "why can't I offer
                 * this?" answerable wherever the option is encountered
                 * (VR3-TGA-01; the group-level list below is unchanged and
                 * remains the visible carrier).
                 */
                aria-label={option.disabled && option.disabledReason
                  ? `${option.label} — ${option.disabledReason}`
                  : undefined}
                onChange={() => onChange(option.value)}
              />
              {/* State is never colour alone (rule 8): the glyph is a second
                  carrier beside the word, and it is decorative because the
                  input already exposes `checked`. */}
              <span className="a3-choice-check" aria-hidden="true">{checked ? '✓' : ''}</span>
              {option.media && <span className="a3-choice-media" aria-hidden="true">{option.media}</span>}
              <span className="a3-choice-text">
                <span className="a3-choice-label">{option.label}</span>
                {option.description && (
                  <span className="a3-choice-description">{option.description}</span>
                )}
                {option.badge && <span className="a3-choice-badge">{option.badge}</span>}
              </span>
              {option.consequence && (
                <span className="a3-choice-consequence">{option.consequence}</span>
              )}
            </label>
          )
        })}
      </div>
      {reasons.length > 0 && (
        <p id={reasonId} className="a3-choice-reason">{reasons.join(' · ')}</p>
      )}
      {footer}
    </fieldset>
  )
}
