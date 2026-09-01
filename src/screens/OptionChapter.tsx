import { Decimal } from 'decimal.js'
import derived from '../fixtures/derived-prototype.json'
import {
  activeBuilding, buildingConfirmed, choiceProvenanceFor, choicesFor, useStore,
} from '../state/store'
import { NNBSP, present, label as moneyLabel } from '../engine/money'
import { choiceBlocked, isGroupActive, type OptionGroup } from '../engine/options'
import { bgfAboveGround } from '../engine/calculate'
import {
  FacadeTileGroup, RadioCardGroup, type FacadeMaterial,
} from '../components/controls'
import { useState } from 'react'
import { Button } from '../components/primitives'
import { useT, useTx } from '../i18n'
import { optionImage } from '../assets/option-images'

/**
 * Глава опций — один компонент на все группы затрат.
 *
 * KG 300 и KG 400 различаются содержанием каталога, а не поведением:
 * вопрос, варианты, последствие у каждого, провенанс и зависимость. Две
 * копии этого экрана разошлись бы при первой же правке — и разошлись бы
 * молча, потому что обе продолжали бы работать.
 *
 * Каждая группа — один вопрос с последствием у каждого ответа, видимым
 * до клика (R-05/OPTION-009). Последствие считает тот же движок, что и
 * фиксация: у превью нет своей арифметики.
 *
 * Зависимые группы не показываются, пока их условие не выполнено: тип
 * балкона не существует, пока балконы не включены. Скрытая группа не
 * участвует и в цене — иначе пользователь платил бы за выбор, которого
 * не видел.
 *
 * Пункт 8 сценария реализован провенансом: найденное в документации
 * предвыбрано и несёт ссылку на файл, но переключается вручную; ручное
 * переключение меняет провенанс, потому что собственное решение продавца
 * и подтверждение документом — разные вещи.
 */

const MARK = derived.marker
const DERIVED_LABEL = derived.provenanceLabel

/**
 * Материал и оси фасадных вариантов (DC-20). Плейсхолдер-образцы системы,
 * не рендеры (D-21). Оси — читаемая сводка выбранного под сеткой.
 */
/**
 * Redesign R4 (calm-density finding): a genuinely binary "aufnehmen / nicht
 * aufnehmen" inclusion decision carries no differentiating image at all —
 * `optionImage(g.id, value)` resolves the SAME group-level motif for both
 * `ja` and `nein` (there is nothing else to depict for "leave this cost
 * group out"), so the 4:3 media slot was pure vertical cost with zero
 * information value: ~1.200 px / 2 image tiles per binary decision measured
 * live on KG 300 (Erdarbeiten, Bodenplatte, Balkone, Garage). A genuine
 * material choice (Bauweise Holz/Massiv, Fassade, Balkontyp …) keeps its
 * image — there the image IS the decision.
 *
 * `RadioCardGroup`'s image slot is already optional
 * (`image?: {...} | null`) and falls back to the canonical compact
 * non-image tile with ZERO component change — the same fallback R2 already
 * proved out removing the garage/qng/dgnb near-duplicate image pairs
 * (`design-system-remediation-programme` memory). No new Design System
 * primitive, no new local pattern — this reuses existing canonical
 * behaviour on genuinely differentiated data.
 */
function isBinaryInclusionGroup(g: OptionGroup): boolean {
  return g.choices.length === 2
    && g.choices.every((c) => c.value === 'ja' || c.value === 'nein')
}

const FACADE_PRESENTATION: Record<string, { material: FacadeMaterial; axes: string[] }> = {
  plaster: { material: 'putz', axes: ['Material: Putz', 'Farbwelt: hell'] },
  timber: { material: 'holz', axes: ['Material: Holz vertikal', 'Farbwelt: natur'] },
  mixedTimber: {
    material: 'kombi',
    axes: ['Material: Putz + Holz', 'EG: Putz', 'ab 1. OG: Holz'],
  },
  klinker: {
    material: 'klinker',
    axes: ['Material: Klinkerriemchen', 'Farbwelt: siehe Klinkerfarbe'],
  },
  mixedKlinker: {
    material: 'kombi',
    axes: ['Material: Putz + Klinker', 'EG: Putz', 'ab 1. OG: Klinker'],
  },
}

// F-20: `word` was hardcoded German regardless of `uiLanguage` — every tile
// consequence and comparison-row delta on this screen stayed German after
// switching to EN. `driver.surcharge`/`driver.saving` already carry both
// languages (used by the Kostentreiber rail); this reuses them instead of a
// second, EN-only literal pair.
function euro(d: Decimal, t: (key: string) => string): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  const word = t(d.isNegative() ? 'driver.saving' : 'driver.surcharge')
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€${NNBSP}${word}`
}

/**
 * Сравнение вариантов ОДНОЙ группы бок о бок — до фиксации (приёмка № 17,
 * дефект 21; решение о форме — моё).
 *
 * Почему не на плитках. Плитка уже несёт последствие («+ 82.000 €
 * Mehrpreis»), и второе число на ней превратило бы каталог в таблицу:
 * нужное для сравнения мешало бы нужному для выбора. Поэтому сравнение —
 * отдельный слой, раскрываемый по требованию, и он отвечает на другой
 * вопрос: не «сколько стоит это», а «где мы окажемся».
 *
 * Почему таблица системы (`.a3-cmp`, DC-11). Сравнение вариантов уже
 * существует как компонент — тот, что сравнивает созданные Options. Второй
 * вид сравнения с собственной вёрсткой был бы двойником, а разница между
 * «сравнить Options» и «сравнить варианты одной группы» — в данных, не в
 * анатомии.
 *
 * Арифметики здесь нет: итог после выбора — текущий итог плюс то же
 * последствие, что стоит на плитке. Вклады аддитивны (calculation-spec §2),
 * поэтому второго способа посчитать не существует и разойтись не с чем.
 */
function VariantsSideBySide({ rows, currentValue }: {
  rows: Array<{ value: string; label: string; consequence: string; after: Decimal | null }>
  currentValue: string
}) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  if (rows.length < 2) return null
  return (
    <div className="mt-3">
      <button
        type="button"
        className="a3-linkbtn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '▾ ' : '▸ '}</span>
        {tx('Varianten nebeneinander')}
      </button>
      {open && (
        <div className="a3-tbl-scroll mt-2">
          <table className="a3-cmp w-full border-collapse">
            <caption className="a3-visually-hidden">
              {tx('Vergleich der Varianten dieser Gruppe vor der Auswahl')}
            </caption>
            <thead>
              <tr>
                <th>{tx('Variante')}</th>
                <th className="a3-num">{tx('Preiswirkung')}</th>
                <th className="a3-num">{tx('Angebotssumme danach')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.value}>
                  <td>
                    {r.label}
                    {r.value === currentValue && (
                      <span className="a3-d">{tx('aktuelle Auswahl')}</span>
                    )}
                  </td>
                  <td className="a3-num">{r.consequence}</td>
                  <td className="a3-num">
                    {r.after ? moneyLabel(present(r.after)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function OptionChapter({ groups, intro, variant = 'standard', footnote = 'show' }: {
  groups: OptionGroup[]
  intro: string
  /** Explicit visual composition for a live Configurator consumer. */
  variant?: 'standard' | 'workstage'
  footnote?: 'show' | 'hide'
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const b = activeBuilding(s)
  const chosen = choicesFor(s, b.id)
  const prov = choiceProvenanceFor(s, b.id)

  // Пока здание не подтверждено, спускаться рано: опции у здания, чьи
  // метрики ещё спорны, придётся пересматривать целиком.
  if (!buildingConfirmed(s, b.id)) {
    return (
      <div className="a3-sheet">
        <p className="text-body text-text-primary">
          <span aria-hidden="true">▲ </span>
          {tx('Zuerst die Gebäudedaten bestätigen.')}
        </p>
        <p className="a3-cap mt-1">
          {tx('Leistungen für ein Gebäude auszuwählen, dessen Flächen und Einstufung noch offen sind, hieße die Auswahl später vollständig zu wiederholen.')}
        </p>
        <div className="mt-3">
          <Button variant="primary" onClick={() => s.setPipelineView('buildingScope')}>
            {t('configurator.returnBuildingScope')}
          </Button>
        </div>
      </div>
    )
  }

  const visible = groups.filter((g) => isGroupActive(g, chosen))

  return (
    <div className={'a3-config-option-list grid gap-5' +
      (variant === 'workstage' ? ' a3-config-option-list-workstage' : '')}>
      {s.mode === 'intern' && (
        <p className="a3-config-option-intro a3-cap a3-lede">
          {tx(intro)}
        </p>
      )}

      {visible.map((g: OptionGroup) => {
        const value = chosen[g.id] ?? g.default
        const source = prov[g.id] ?? 'Standard'
        return (
          <section key={g.id} className={'a3-config-option-decision a3-sheet' +
            (variant === 'workstage' ? ` a3-config-workstage-${g.id}` : '')}>
            <h2 className="text-heading-3 font-bold text-text-primary">{tx(g.label)}</h2>
            <p className="a3-cap mt-1">{tx(g.question)}</p>

            {/* Провенанс выбора — пункт 8: найденное в документах предвыбрано
                и называет файл, но остаётся переключаемым. */}
            {source === 'aus Dokument' && g.documentRef && (
              <p className="a3-chip-src mt-2">
                <span aria-hidden="true" className="a3-dot" />
                <span aria-hidden="true">◆ </span>
                {tx('Anforderung aus der Dokumentation')} · {tx(g.documentRef!)}
              </p>
            )}
            {source === 'manuell erfasst' && (
              <p className="a3-chip-src mt-2">
                <span aria-hidden="true" className="a3-dot" />
                <span aria-hidden="true">✎ </span>{tx('manuell geändert')}
              </p>
            )}

            <div className="mt-3">
              {(() => {
                // Последствие и будущий итог приходят из ТОЙ ЖЕ проекции,
                // что и клик (предложение № 1 исследования рычага). Прежде
                // карточка перемножала ставки сама — второй калькулятор той
                // же величины, который на двух зданиях в предложении давал
                // не то, что случалось после клика.
                const outcome = (v: string) => s.outcomeOf({
                  kind: 'kg300', buildingId: b.id, groupId: g.id, value: v,
                })
                const binaryInclusion = isBinaryInclusionGroup(g)
                const mapped = g.choices.map((c) => {
                  const rate = new Decimal(c.rate)
                  const qty = g.denominator === 'BGF_ABOVE_GROUND' ? bgfAboveGround(b)
                    : g.denominator === 'BGF_BELOW_GROUND' ? b.bgfBelowGround
                      : bgfS(b.id)
                  // Нормативное ограничение сильнее коммерческого выбора:
                  // при GK 5 лифт обязателен, и «без лифта» не является
                  // решением, которое продавец вправе принять.
                  const norm = choiceBlocked(c, b.gebaeudeklasse.value)
                  const noBase = qty.lte(0) && !rate.isZero()
                  return {
                    value: c.value,
                    title: tx(c.label),
                    image: binaryInclusion ? null : optionImage(g.id, c.value),
                    description: `${tx(c.basis)} ${MARK}`,
                    consequence: c.value === value
                      ? tx('aktuelle Auswahl')
                      : euro(outcome(c.value).delta, t),
                    disabled: norm.blocked || noBase,
                    disabledReason: norm.blocked ? norm.reason
                      : noBase
                        ? 'Für dieses Gebäude gibt es keine Bezugsfläche für diese Leistung'
                        : undefined,
                  }
                })
                // Фасад — витринные карточки материала (DC-20): материал
                // различим до чтения. Остальные группы — плитки DC-40.
                const facade = g.id === 'fassade'
                  && mapped.every((m) => FACADE_PRESENTATION[m.value])
                // Итог после выбора: текущий плюс последствие варианта.
                // Заблокированный вариант итога не получает — «где мы
                // окажемся» не имеет смысла там, куда попасть нельзя.
                const compareRows = mapped.map((m) => {
                  const out = outcome(m.value)
                  return {
                    value: m.value,
                    label: m.title,
                    // Колонка отвечает за ДЕНЬГИ: у текущего варианта это
                    // ноль, а не подпись «aktuelle Auswahl» — та живёт
                    // отдельной пометкой строки и не занимает числовую
                    // ячейку (иначе в столбце цен стоит не цена).
                    consequence: euro(out.delta, t),
                    // «Станет» — не сложение в уме, а сам будущий итог из
                    // проекции: прежде здесь складывали текущий с дельтой,
                    // и при двух зданиях сумма расходилась с фактом.
                    after: m.disabled ? null : out.futureTotal.exact,
                  }
                })
                const comparison = (
                  <VariantsSideBySide rows={compareRows} currentValue={value} />
                )
                return facade ? (<>
                  <FacadeTileGroup
                    legend={g.question}
                    value={value}
                    onChange={(v) => s.setKg300(g.id, v)}
                    onPreview={(v: string | null) => s.previewOption(v
                      ? { kind: 'kg300', buildingId: b.id, groupId: g.id, value: v }
                      : null)}
                    options={mapped.map((m) => ({
                      value: m.value,
                      label: m.title,
                      consequence: m.consequence,
                      image: m.image,
                      material: FACADE_PRESENTATION[m.value]!.material,
                      axes: FACADE_PRESENTATION[m.value]!.axes.map(tx),
                      disabled: m.disabled,
                      disabledReason: m.disabledReason,
                    }))}
                  />
                  {comparison}
                </>) : (<>
                  <RadioCardGroup
                    legend={g.question}
                    legendHidden
                    value={value}
                    onChange={(v) => s.setKg300(g.id, v)}
                    onPreview={(v) => s.previewOption(v
                      ? { kind: 'kg300', buildingId: b.id, groupId: g.id, value: v }
                      : null)}
                    options={mapped}
                  />
                  {comparison}
                </>)
              })()}
            </div>
          </section>
        )
      })}

      {footnote === 'show' && (
        <p className="a3-cap">
          {MARK} · {DERIVED_LABEL}. Die Preiswirkung erscheint sofort in der
          Angebotsspalte rechts und im Kostentreiber.
        </p>
      )}
    </div>
  )
}

function bgfS(id: string): Decimal {
  const d = (derived.buildings as Record<string, { bgfSAboveGround?: { value: string | null } }>)[id]
  const v = d?.bgfSAboveGround?.value
  return v ? new Decimal(v) : new Decimal(0)
}
