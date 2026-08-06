import { Decimal } from 'decimal.js'
import { NNBSP, formatDE, present } from '../engine/money'

/**
 * DC-3 · EstimateUncertaintyBadge — интервал точности полосой, не только словом.
 *
 * Прежде интервал жил в прототипе одной строкой «Schätzunsicherheit ± 22 %».
 * Это верно, но недостаточно: контракт требует, чтобы **краевые подписи шкалы
 * входили в текст, а не только в графику** — то есть клиент должен видеть,
 * между какими суммами лежит оценка, а не только на сколько процентов она
 * может отличаться. Процент отвечает «насколько точно», края отвечают
 * «сколько это в деньгах», и второй вопрос на переговорах задают чаще.
 *
 * Края считаются от ТОЧНОГО итога и округляются как деньги: производные
 * величины считаются от точных значений, никогда от показанных (CALC-007).
 */
export function UncertaintyBand({ totalExact, pp }: {
  /** Точный итог. Не показанный: показанный уже округлён. */
  totalExact: Decimal
  /** Ширина интервала в процентных пунктах. */
  pp: number
}) {
  const factor = new Decimal(pp).div(100)
  const low = present(totalExact.mul(new Decimal(1).minus(factor)))
  const high = present(totalExact.mul(new Decimal(1).plus(factor)))
  const money = (d: ReturnType<typeof present>) =>
    `${d.prefix ? d.prefix + NNBSP : ''}${d.display}${NNBSP}€`

  return (
    <div className="a3-iv-sub">
      <div className="a3-iv-bandbox">
        {/* Полоса — иллюстрация; всё, что она показывает, названо текстом
            ниже, поэтому она скрыта от скринридера. */}
        <div className="a3-iv-band" aria-hidden="true">
          <div
            className="a3-fill"
            style={{ left: '0%', width: '100%' }}
          />
        </div>
        <div className="a3-iv-edges">
          <span className="numeric">{money(low)}</span>
          <span className="numeric">{money(high)}</span>
        </div>
      </div>
      {/* Само число интервала остаётся: полоса не заменяет его, а дополняет. */}
      <span className="a3-cap">
        Schätzunsicherheit ±{NNBSP}{formatDE(new Decimal(pp))}{NNBSP}%
      </span>
    </div>
  )
}
