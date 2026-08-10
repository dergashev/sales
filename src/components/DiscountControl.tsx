import { Decimal } from 'decimal.js'
import { copyFor } from '../i18n/internal-refs'
import { useTx } from '../i18n'
import catalog from '../fixtures/catalog.json'
import { NNBSP, formatDE, label as moneyLabel, present } from '../engine/money'
import { applyDiscount } from '../engine/calculate'

/**
 * DC-25 · DiscountControl — скидка со сторожем маржи.
 *
 * Три требования контракта, каждое из которых легко потерять:
 *
 * 1. **`role="slider"` с `aria-valuenow` и `aria-valuetext`**, и valuetext
 *    называет не процент, а последствие: «3 Prozent, Rabatt 114.535 Euro,
 *    Endpreis rund 3.703.000 Euro netto». Процент без денег заставляет
 *    считать в уме на переговорах.
 * 2. **Состояние маржи — текстом, а не цветом.** Точка `.a3-guard` только
 *    поддерживает подпись (правило 8).
 * 3. **Маржа не существует в клиентском режиме** (D-01, правило 11): она не
 *    скрывается стилем, её нет в дереве.
 *
 * Чего здесь СОЗНАТЕЛЬНО нет: порога «предупреждать при N %». Такого правила
 * источники не объявляют, и выдумать его значило бы подсунуть продавцу
 * выдуманную границу как политику компании (R-25). Сторож сообщает только
 * выводимое: сколько маржи остаётся после скидки и превышает ли скидка маржу
 * — это арифметика, а не порог.
 */
export function DiscountControl({ totalExact, percent, onChange, mode }: {
  totalExact: Decimal
  /** Процент скидки; `null` — скидки нет. */
  percent: Decimal | null
  onChange: (p: Decimal | null) => void
  mode: 'intern' | 'praesentation'
}) {
  const tx = useTx()
  const p = percent ?? new Decimal(0)
  const discounted = applyDiscount(totalExact, p)
  const rabatt = present(totalExact.minus(discounted.exact))

  // Маржа Eigenleistung — внутренняя величина из каталога, извлечённого
  // построителем из calculation-spec §1.1. Не константа экрана.
  const marge = new Decimal(catalog.internalConfig.margins.eigenleistungPercent)
  const rest = marge.minus(p)
  const uebersteigt = p.gt(marge)

  const valueText =
    `${formatDE(p, 1)} Prozent, Rabatt ${rabatt.display} Euro, ` +
    `Endpreis ${discounted.prefix ? 'rund ' : ''}${discounted.display} Euro netto`

  return (
    <div>
      <div className="a3-row">
        <input
          type="range"
          className="a3-rb"
          min={0}
          max={10}
          step={0.5}
          value={p.toNumber()}
          aria-label="Rabatt in Prozent"
          aria-valuenow={p.toNumber()}
          aria-valuetext={valueText}
          onChange={(e) => {
            const next = new Decimal(e.target.value)
            onChange(next.isZero() ? null : next)
          }}
        />
        <input
          type="number"
          className="a3-rb-number numeric"
          min={0}
          max={10}
          step={0.5}
          value={p.toNumber()}
          aria-label="Rabatt in Prozent, numerische Eingabe"
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') { onChange(null); return }
            const next = new Decimal(raw)
            onChange(next.isZero() ? null : next)
          }}
        />
        <span className="a3-cap">%</span>
      </div>

      <p className="numeric mt-3 text-body text-text-primary">
        {moneyLabel(discounted)}
        <span className="a3-cap ml-3">
          Rabatt {moneyLabel(rabatt)}
        </span>
      </p>
      <p className="a3-cap mt-1">
        {copyFor(tx('Basis ist der exakte Rechenwert, nie der angezeigte (CALC-007).'), mode)}
        {discounted.disclosure ? ` ${discounted.disclosure}` : ''}
      </p>

      {/* Сторож маржи: внутренняя величина — в презентации отсутствует. */}
      {mode === 'intern' && (
        <p className="a3-cap mt-2">
          <span className="a3-guard" aria-hidden="true" />
          {uebersteigt
            ? <>Rabatt übersteigt die Marge Eigenleistung
                ({formatDE(marge)}{NNBSP}%) um {formatDE(p.minus(marge), 1)}{NNBSP}Pp</>
            : <>Marge Eigenleistung nach Rabatt: {formatDE(rest, 1)}{NNBSP}%
                von {formatDE(marge)}{NNBSP}%</>}
        </p>
      )}
    </div>
  )
}
