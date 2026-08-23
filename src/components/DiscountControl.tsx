import { useState } from 'react'
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
 *
 * **Домен контрола 0…10 % принадлежит контролу, а не браузеру.**
 * Атрибуты `min`/`max` у `input[type=number]` ничего не валидируют: они
 * рисуют стрелки и участвуют в нативной отправке формы, которой здесь нет.
 * Обработчик клал в состояние любое введённое число, и `200` давало
 * отрицательный итог, а `−5` — надбавку под подписью «Rabatt» (сплошное
 * ревью 26, находка 2). Поэтому ввод живёт ЧЕРНОВИКОМ: подтверждается
 * только значение внутри домена, остальное остаётся в поле с объяснением и
 * до расчёта не доходит. Это то же правило 12, что и везде: не запрет
 * ввода, а невозможность им испортить цену.
 */

/** Домен скидки. Тот же у слайдера и у числового поля — один источник. */
const MIN_PERCENT = 0
const MAX_PERCENT = 10

/**
 * Ввод → процент или `null`. `null` значит «принять нельзя», и это ОТДЕЛЬНО
 * от «поле пустое»: пустое поле снимает скидку, непринимаемое не меняет
 * ничего.
 */
export function parseDiscountPercent(raw: string): Decimal | null {
  const cleaned = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const v = new Decimal(cleaned)
  if (v.lt(MIN_PERCENT) || v.gt(MAX_PERCENT)) return null
  return v
}
export function DiscountControl({ totalExact, percent, onChange, mode }: {
  totalExact: Decimal
  /** Процент скидки; `null` — скидки нет. */
  percent: Decimal | null
  onChange: (p: Decimal | null) => void
  mode: 'intern' | 'praesentation'
}) {
  const tx = useTx()
  const p = percent ?? new Decimal(0)
  // Черновик существует, только пока пользователь печатает: `null` значит
  // «поле показывает подтверждённое значение».
  const [draft, setDraft] = useState<string | null>(null)
  const rejected = draft !== null && draft !== '' && parseDiscountPercent(draft) === null
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
          min={MIN_PERCENT}
          max={MAX_PERCENT}
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
          min={MIN_PERCENT}
          max={MAX_PERCENT}
          step={0.5}
          value={draft ?? String(p.toNumber())}
          aria-label="Rabatt in Prozent, numerische Eingabe"
          aria-invalid={rejected || undefined}
          aria-describedby={rejected ? 'rabatt-domain' : undefined}
          onChange={(e) => {
            const raw = e.target.value
            setDraft(raw)
            if (raw === '') { onChange(null); return }
            const next = parseDiscountPercent(raw)
            if (next === null) return
            onChange(next.isZero() ? null : next)
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="a3-cap">%</span>
      </div>

      {/* Объяснение, а не запрет (правило 12), и словами, а не цветом
          (правило 8): поле не откатывается под руками — оно говорит, почему
          введённое не принято, и держит прежнюю цену. */}
      {rejected && (
        <p id="rabatt-domain" role="alert" className="a3-cap mt-1">
          {tx('Rabatt zwischen 0 und 10\u202f% — der eingegebene Wert wurde nicht übernommen')}
        </p>
      )}

      <p className="numeric mt-3 text-body text-text-primary">
        {moneyLabel(discounted)}
        <span className="a3-cap ml-3">
          Rabatt {moneyLabel(rabatt)}
        </span>
      </p>
      <p className="a3-cap mt-1">
        {/* F-29: the bracketed requirement code read as internal-registry
            jargon even on the operator surface (`copyFor` only ever
            stripped it for the client profile) — dropped from the sentence
            itself instead of relying on mode-gating to hide it. */}
        {copyFor(tx('Basis ist der exakte Rechenwert, nie der angezeigte.'), mode)}
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
