import { Decimal } from 'decimal.js'
import { useTx } from '../i18n'
import { formatDE, label as moneyLabel, present, NNBSP } from '../engine/money'

/**
 * CompositionBar — canonical composition graphic (REDESIGN R1, DESIGN-12,
 * "Numbers are heroes in one place and clerks everywhere else").
 *
 * Horizontal stacked bar for additive commercial structures (KG composition
 * is the first consumer, wired by R2 — this ticket proves the primitive,
 * not the product integration). Segments use the R1 dataviz ramp
 * (`--color-dataviz-category-1..6`, ADR-R1-03) separated by a mandatory
 * `--color-dataviz-segment-divider` hairline — hue is never the only
 * carrier (rule 8); the accessible list below is the textual equivalent,
 * not decoration.
 *
 * DATA GRAPHIC RULE (ticket, non-negotiable): the graphic must represent
 * the real underlying data exactly. `reconcileComposition` is the single
 * exported arithmetic source both this component and its test use — see
 * `__tests__/composition-bar.test.ts` for the Decimal-exact fixture proof.
 * A row without a calculated basis is NEVER silently rendered as zero
 * (rule 16): callers pass the honest Zwischensumme as `total` and the gap
 * becomes a visible, labelled, neutral remainder segment.
 */

export type CompositionSegment = {
  id: string
  label: string
  /** Exact value — NEVER the display-rounded string (CALC-007). */
  value: Decimal
  /** 1-6, cycling if there are more than 6 segments; maps to the dataviz ramp. */
  categorySlot: number
}

export type ReconciledComposition = {
  segments: ReadonlyArray<CompositionSegment & { percent: Decimal }>
  /** Zero when segments already sum to `total` exactly. */
  remainder: Decimal
  remainderPercent: Decimal
  /** True only when `sum(segments) + remainder === total` EXACTLY. */
  reconciles: boolean
}

/**
 * Pure arithmetic core — no rendering, no rounding of the exact values.
 * Percent is computed from the exact `total`, never from a display-rounded
 * figure (the same CALC-007 discipline `present()`/`label()` already
 * enforce for point values).
 */
export function reconcileComposition(
  segments: ReadonlyArray<CompositionSegment>,
  total: Decimal,
): ReconciledComposition {
  const sum = segments.reduce((acc, s) => acc.plus(s.value), new Decimal(0))
  const remainder = total.minus(sum)
  const safeTotal = total.isZero() ? new Decimal(1) : total
  return {
    segments: segments.map((s) => ({
      ...s,
      percent: s.value.div(safeTotal).mul(100),
    })),
    remainder,
    remainderPercent: remainder.div(safeTotal).mul(100),
    // Reconciles only when the segments do not exceed the declared total —
    // `sum + remainder === total` is an identity by construction and would
    // never catch a caller passing an inconsistent (too-small) total.
    reconciles: sum.plus(remainder).equals(total) && remainder.greaterThanOrEqualTo(0),
  }
}

// One fully-written CSS variable reference per slot, not a template
// interpolation — tools/verify.py's TOKEN-EXISTS gate statically greps
// source for that pattern, and an interpolated numeric suffix leaves only
// the bare category prefix for it to match, which it then reports as an
// undeclared token (the same false-positive class DS-CLASS-EXISTS has for
// interpolated class-name suffixes).
const CATEGORY_VARS = [
  'var(--color-dataviz-category-1)',
  'var(--color-dataviz-category-2)',
  'var(--color-dataviz-category-3)',
  'var(--color-dataviz-category-4)',
  'var(--color-dataviz-category-5)',
  'var(--color-dataviz-category-6)',
] as const
const CATEGORY_VAR = (slot: number) => CATEGORY_VARS[(slot - 1) % 6]!

export function CompositionBar({
  segments, total, variant, unit = '€', incompleteLabel, onDark = false,
}: {
  segments: ReadonlyArray<CompositionSegment>
  /** The honest Zwischensumme this bar reconciles to — see DATA GRAPHIC RULE above. */
  total: Decimal
  variant: 'compact' | 'expanded'
  unit?: string
  /** Shown for the remainder segment when `remainder > 0` — defaults to the
   * canonical "Preis nicht ermittelt" framing (rule 16). */
  incompleteLabel?: string
  /** True on `--color-surface-stage-deep` (ADR-R1-02) — swaps legend text
   * to inverse. `text-primary`/`text-secondary` render near-illegible on
   * the dark stage surface otherwise (caught visually via Playwright: the
   * Commercial Stage Moment specimen's legend was barely readable). */
  onDark?: boolean
}) {
  const tx = useTx()
  const reconciled = reconcileComposition(segments, total)
  const hasRemainder = reconciled.remainder.greaterThan(0)
  const remainderLabel = incompleteLabel ?? tx('Preis nicht ermittelt')
  const primaryText = onDark ? 'text-text-inverse' : 'text-text-primary'
  const secondaryText = onDark ? 'text-text-inverse' : 'text-text-secondary'

  return (
    <div className="a3-composition-bar" data-variant={variant}>
      <div
        className="flex h-3 w-full overflow-hidden"
        role="img"
        aria-label={
          reconciled.segments.map((s) =>
            `${s.label} ${moneyLabel(present(s.value), unit)} · ${formatDE(s.percent, 0)}${NNBSP}%`,
          ).join(' · ') + (hasRemainder ? ` · ${remainderLabel}` : '')
        }
      >
        {reconciled.segments.map((s) => (
          <span
            key={s.id}
            aria-hidden="true"
            style={{
              width: `${s.percent.toNumber()}%`,
              background: CATEGORY_VAR(s.categorySlot),
              borderRight: '1px solid var(--color-dataviz-segment-divider)',
            }}
          />
        ))}
        {hasRemainder && (
          <span
            aria-hidden="true"
            style={{ width: `${reconciled.remainderPercent.toNumber()}%`, background: 'var(--color-dataviz-neutral)' }}
          />
        )}
      </div>

      {variant === 'expanded' && (
        <ul className="mt-2 space-y-1">
          {reconciled.segments.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 text-small ${primaryText}`}>
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 shrink-0"
                style={{ background: CATEGORY_VAR(s.categorySlot) }}
              />
              <span className="flex-1">{s.label}</span>
              <span className={`numeric ${primaryText}`}>{moneyLabel(present(s.value), unit)}</span>
              <span className={`numeric ${secondaryText}`}>{formatDE(s.percent, 0)}{NNBSP}%</span>
            </li>
          ))}
          {hasRemainder && (
            <li className={`flex items-center gap-2 text-small ${secondaryText}`}>
              <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0" style={{ background: 'var(--color-dataviz-neutral)' }} />
              <span className="flex-1">{remainderLabel}</span>
              <span className={`numeric ${primaryText}`}>{moneyLabel(present(reconciled.remainder), unit)}</span>
              <span className="numeric">{formatDE(reconciled.remainderPercent, 0)}{NNBSP}%</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
