import { Decimal } from 'decimal.js'
import { NNBSP, formatDE, present } from '../engine/money'
import { localizeMoneyText, localizePercentText, useTx, type UiLanguage } from '../i18n'

/**
 * VR3-03: the locale arrives as a PROP, and it is required.
 *
 * The badge's monetary edges were typeset in German unconditionally, so an
 * English interface showed `≈36.416.000 €` beside an English label — the
 * same class of defect F-20 already fixed for the badge's own prose, one
 * field further in. A canonical primitive cannot read `uiLanguage` itself:
 * `GOV-DS-DEP` freezes its dependencies to react, framer-motion, decimal.js,
 * `src/i18n` and `src/engine/money`, and the store is deliberately outside
 * that boundary. So the caller passes it, and it is not optional — a default
 * would have hidden exactly the call site that forgot.
 */
type EstimateUncertaintyBadgeProps =
  { language: UiLanguage } & (
    | { presentation: 'compact'; pp: number }
    | { presentation: 'range'; pp: number; totalExact: Decimal }
  )

/**
 * DC-3 · one canonical uncertainty component with the two released
 * presentations used by the product. The compact presentation names the
 * interval; the range presentation also exposes its monetary edges.
 */
export function EstimateUncertaintyBadge(props: EstimateUncertaintyBadgeProps) {
  // F-20: this label rendered German prose unconditionally regardless of
  // `uiLanguage` — the offer hero stayed German even after switching to EN.
  // `tx()` resolves the DE prose against the dictionary (rule 36) instead of
  // concatenating a translated fragment onto a hardcoded string.
  const tx = useTx()
  if (props.presentation === 'compact') {
    return (
      <span className="text-body text-text-secondary">
        {tx('Schätzunsicherheit')}{' '}
        {localizePercentText(`±${NNBSP}${props.pp}${NNBSP}%`, props.language)}
      </span>
    )
  }

  // Calculate from the exact total, never the already rounded display value
  // (CALC-007). Both interval edges remain textual; the band is illustrative.
  const factor = new Decimal(props.pp).div(100)
  const low = present(props.totalExact.mul(new Decimal(1).minus(factor)))
  const high = present(props.totalExact.mul(new Decimal(1).plus(factor)))
  const money = (value: ReturnType<typeof present>) => localizeMoneyText(
    `${value.prefix ? value.prefix + NNBSP : ''}${value.display}${NNBSP}€`,
    props.language,
  )

  // F18 · the band is the low→high interval, never a filled/success meter
  // (DC-3 forbids interval-as-green, AREA-004); the marker is the current/
  // indicative point. This presentation is always symmetric (±pp%), so the
  // point sits exactly at the midpoint (STATE-010: a symmetric ± label is
  // only valid when the model actually is symmetric, and here it is).
  return (
    <div className="a3-iv-sub">
      <div className="a3-iv-bandbox">
        <div className="a3-iv-band" aria-hidden="true">
          <div className="a3-iv-marker" style={{ left: '50%' }} />
        </div>
        <div className="a3-iv-edges">
          <span className="numeric">{money(low)}</span>
          <span className="numeric">{money(high)}</span>
        </div>
      </div>
      <span className="a3-cap">
        {tx('Schätzunsicherheit')}{' '}
        {localizePercentText(
          `±${NNBSP}${formatDE(new Decimal(props.pp))}${NNBSP}%`, props.language,
        )}
      </span>
    </div>
  )
}
