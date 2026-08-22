import { Decimal } from 'decimal.js'
import { useStore } from '../state/store'
import { NNBSP, present } from '../engine/money'
import {
  SCOPE_QUANTITY_DERIVED, SCOPE_QUANTITY_UNIT,
  type ScopeOption, type ScopeQuantityKey,
} from '../engine/scopeCatalog'
import { RadioCardGroup } from '../components/controls'
import { useT } from '../i18n'
import { optionImage } from '../assets/option-images'

/**
 * KG 200/500/600/800 catalog chapter — тикет "MAKE ALL KG 200–800
 * SELECTABLE & ADD COST-BEARING CONTENT…". Тот же интерактивный образец,
 * что `OptionChapter` (RadioCardGroup, изображение, живое последствие до
 * клика), но подключён к отдельному движку `engine/scopeCatalog.ts`,
 * который не знает BGF-денoминаторов и не трогает KG 300/400.
 *
 * Локализация — НАПРЯМУЮ из каталога (`labelDe`/`labelEn` и т. д.), не
 * через `tx()`: `tx()` переводит немецкую строку только если она совпадает
 * с записью поставки Codex (`GENERATED_DE`/`GENERATED_EN`), а новый каталог
 * этой поставкой не пройден. Использовать `tx()` здесь значило бы молча
 * оставлять английский интерфейс немецким (AC-06) — каталог уже несёт
 * собственный подтверждённый EN-текст, и он используется напрямую.
 *
 * Изображение — ОДНО согласованное фото на всю KG (переиспользует
 * `scopeBoundaries`-манифест уже существующей плитки Leistungsabgrenzung):
 * приложение прямо разрешает «approved consistent placeholder» там, где
 * различие вариантов нельзя показать содержательно (§10 приложения) —
 * бюджет этого прототипа не покрывает кураторские фото на ~140 вариантов.
 */

function euro(d: Decimal, lang: 'de' | 'en'): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  const word = lang === 'en'
    ? (d.isNegative() ? 'decrease' : 'increase')
    : (d.isNegative() ? 'Minderpreis' : 'Mehrpreis')
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€${NNBSP}${word}`
}

/** Компактный ручной ввод количественного драйвера (§7 приложения). */
function QuantityInput({ quantityKey, label }: {
  quantityKey: ScopeQuantityKey
  label: string
}) {
  const s = useStore()
  const value = s.scopeCatalogQuantities[quantityKey] ?? ''
  const unit = SCOPE_QUANTITY_UNIT[quantityKey]
  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="a3-cap" htmlFor={`scope-qty-${quantityKey}`}>
        {label}
      </label>
      <input
        id={`scope-qty-${quantityKey}`}
        type="number"
        min="0"
        inputMode="decimal"
        className="a3-input w-32 numeric"
        value={value}
        onChange={(e) => s.setScopeCatalogQuantity(quantityKey, e.target.value)}
      />
      <span className="a3-cap">{unit}</span>
    </div>
  )
}

export function ScopeCatalogChapter({ options, introDe, introEn }: {
  options: readonly ScopeOption[]
  introDe: string
  introEn: string
}) {
  const s = useStore()
  const t = useT()
  const lang = s.uiLanguage
  const en = lang === 'en'

  return (
    <div className="grid gap-5">
      {s.mode === 'intern' && (
        <p className="a3-cap a3-lede">{en ? introEn : introDe}</p>
      )}
      {options.map((option) => {
        const value = s.scopeCatalogChoices[option.id] ?? option.default
        const provenance = s.scopeCatalogProvenance[option.id] ?? 'Standard'
        const image = optionImage('scopeBoundaries', option.kg)
        const outcome = (v: string) => s.outcomeOf({
          kind: 'scopeCatalog', optionId: option.id, value: v,
        })
        const mapped = option.variants.map((variant) => ({
          value: variant.value,
          title: en ? variant.labelEn : variant.labelDe,
          image,
          description: (en ? variant.summaryEn : variant.summaryDe)
            + (variant.evidenceClass !== 'R' ? ' ⚙' : ''),
          consequence: variant.value === value
            ? t('configurator.scopeCatalog.currentChoice')
            : euro(outcome(variant.value).delta, lang),
        }))
        const manualQuantityKey = option.basis.kind === 'perQuantity'
          && !SCOPE_QUANTITY_DERIVED.has(option.basis.quantityKey)
          ? option.basis.quantityKey
          : null
        return (
          <section key={option.id} className="a3-sheet">
            <h2 className="text-heading-3 font-bold text-text-primary">
              {en ? option.labelEn : option.labelDe}
            </h2>
            <p className="a3-cap mt-1">{en ? option.questionEn : option.questionDe}</p>
            {provenance === 'Standard' && (
              <p className="a3-chip-src mt-2">
                <span aria-hidden="true">✎ </span>
                {t('configurator.scopeCatalog.assumption')}
              </p>
            )}
            {manualQuantityKey && (
              <QuantityInput
                quantityKey={manualQuantityKey}
                label={t('configurator.scopeCatalog.quantityLabel')}
              />
            )}
            <div className="mt-3">
              <RadioCardGroup
                legend={en ? option.questionEn : option.questionDe}
                legendHidden
                value={value}
                onChange={(v) => s.setScopeCatalogChoice(option.id, v)}
                onPreview={(v) => s.previewOption(v
                  ? { kind: 'scopeCatalog', optionId: option.id, value: v }
                  : null)}
                options={mapped}
              />
            </div>
            {/* KG800-07 (Bürgschaftskosten/Guarantee cost) needs the
                guaranteed amount too — a contract value, not a catalog
                variant. */}
            {option.id === 'kg800-07' && (
              <QuantityInput
                quantityKey="guarantee_amount_eur"
                label={t('configurator.scopeCatalog.guaranteeAmountLabel')}
              />
            )}
          </section>
        )
      })}
      <p className="a3-cap">{t('configurator.scopeCatalog.footnote')}</p>
    </div>
  )
}
