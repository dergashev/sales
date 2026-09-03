import { Decimal } from 'decimal.js'
import { formatDE } from '../engine/money'
import { localizeMoneyText } from '../i18n'
import { useStore } from '../state/store'

/**
 * ONE formatter for every quantity the product prints.
 *
 * German is the source format (`1.234,56`); the English projection swaps the
 * separators. It lives here rather than beside one screen because two
 * screens that format the same area differently is the "contradictory
 * rounding" defect the Design System delta named — and the second copy is
 * always written by someone who did not know the first existed.
 *
 * The formatted string is a PROJECTION. It is never parsed back, and never
 * becomes the input to a calculation: the canonical decimal string in the
 * model is the only thing arithmetic ever sees.
 */
export function useLocalNumber() {
  const language = useStore().uiLanguage
  return (value: string | number, decimals = 0) => localizeMoneyText(
    formatDE(new Decimal(value), decimals), language,
  )
}
