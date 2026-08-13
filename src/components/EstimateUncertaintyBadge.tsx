import { Decimal } from 'decimal.js'
import { NNBSP, formatDE, present } from '../engine/money'

type EstimateUncertaintyBadgeProps =
  | { presentation: 'compact'; pp: number }
  | { presentation: 'range'; pp: number; totalExact: Decimal }

/**
 * DC-3 · one canonical uncertainty component with the two released
 * presentations used by the product. The compact presentation names the
 * interval; the range presentation also exposes its monetary edges.
 */
export function EstimateUncertaintyBadge(props: EstimateUncertaintyBadgeProps) {
  if (props.presentation === 'compact') {
    return (
      <span className="text-body text-text-secondary">
        Schätzunsicherheit ±{NNBSP}{props.pp}{NNBSP}%
      </span>
    )
  }

  const factor = new Decimal(props.pp).div(100)
  const low = present(props.totalExact.mul(new Decimal(1).minus(factor)))
  const high = present(props.totalExact.mul(new Decimal(1).plus(factor)))
  const money = (value: ReturnType<typeof present>) =>
    `${value.prefix ? value.prefix + NNBSP : ''}${value.display}${NNBSP}€`

  return (
    <div className="a3-iv-sub">
      <div className="a3-iv-bandbox">
        <div className="a3-iv-band" aria-hidden="true">
          <div className="a3-fill" style={{ left: '0%', width: '100%' }} />
        </div>
        <div className="a3-iv-edges">
          <span className="numeric">{money(low)}</span>
          <span className="numeric">{money(high)}</span>
        </div>
      </div>
      <span className="a3-cap">
        Schätzunsicherheit ±{NNBSP}{formatDE(new Decimal(props.pp))}{NNBSP}%
      </span>
    </div>
  )
}
