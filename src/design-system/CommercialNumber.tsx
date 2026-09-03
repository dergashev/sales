import Decimal from 'decimal.js'
import { NNBSP, label as moneyLabel, present, type Displayed } from '../engine/money'
import { localizeMoneyText, localizePercentText, type UiLanguage } from '../i18n'

/**
 * CommercialNumber — the one formatted output of the commercial result
 * (VR3-03, design-system delta: "`CommercialNumber` … MERGE").
 *
 * Before this, eight files each carried their own `money`/`signed`/`percent`
 * wrapper around `engine/money` plus `localizeMoneyText`, and one of them
 * (`signed`) was exported from a 1800-line component file and imported by a
 * screen. Eight wrappers is eight chances for two surfaces to round, sign or
 * space the same number differently — and the audit found exactly that class
 * of contradiction (F-001).
 *
 * WHAT IT IS NOT. It is not a new formatter: rounding, the 1000 EUR step and
 * the U+202F separator all still come from `engine/money`, and the locale
 * re-typesetting still comes from `src/i18n`. This is the single component
 * those two agree through, so a consumer cannot accidentally skip one of
 * them.
 *
 * A `null` amount is rendered as the ABSENCE it is, never as 0 (rule 16).
 */

export type CommercialNumberProps = {
  /** The exact value. `null` means "no basis", which is not zero. */
  exact: Decimal | null
  language: UiLanguage
  /** Already-rounded presentation, when the caller holds one. */
  displayed?: Displayed
  unit?: string
  /** Prints an explicit `+`/`−` because a delta's direction is its meaning. */
  signed?: boolean
  /** The word shown instead of a number when `exact` is `null`. */
  absentLabel?: string
  emphasis?: 'hero' | 'default' | 'compact'
  className?: string
}

export function CommercialNumber({
  exact, language, displayed, unit = '€', signed, absentLabel, emphasis = 'default',
  className,
}: CommercialNumberProps) {
  const emphasisClass = emphasis === 'hero'
    ? 'a3-cnum-hero'
    : emphasis === 'compact' ? 'a3-cnum-compact' : 'a3-cnum-default'
  const classes = ['a3-cnum', emphasisClass, className].filter(Boolean).join(' ')
  if (exact === null) {
    return <span className={classes}>{absentLabel ?? '—'}</span>
  }
  const shown = displayed ?? present(exact)
  const text = signed
    ? signedMoneyText(exact, language, unit)
    : localizeMoneyText(moneyLabel(shown, unit), language)
  return <span className={classes}>{text}</span>
}

/**
 * A signed amount, in one place.
 *
 * `−` is U+2212 MINUS, not a hyphen: at the sizes a commercial delta is
 * rendered at, a hyphen reads as a dash and the sign is the whole message.
 */
export function signedMoneyText(
  exact: Decimal, language: UiLanguage, unit = '€',
): string {
  const shown = present(exact.abs())
  const sign = exact.isNegative() ? '−' : '+'
  return `${sign}${NNBSP}${localizeMoneyText(moneyLabel(shown, unit), language)}`
}

/** A percentage, with the DE narrow space and the EN none (rule 7). */
export function commercialPercentText(
  value: number, language: UiLanguage, decimals = 0,
): string {
  return localizePercentText(`${value.toFixed(decimals)}${NNBSP}%`, language)
}
