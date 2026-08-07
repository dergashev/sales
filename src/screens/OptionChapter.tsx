import { Decimal } from 'decimal.js'
import derived from '../fixtures/derived-prototype.json'
import { activeBuilding, useStore } from '../state/store'
import { NNBSP, present } from '../engine/money'
import { choiceBlocked, isGroupActive, type OptionGroup } from '../engine/options'
import {
  FacadeTileGroup, RadioCardGroup, type FacadeMaterial,
} from '../components/controls'
import { Button } from '../components/primitives'
import { useTx } from '../i18n'

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

function euro(d: Decimal): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  const word = d.isNegative() ? 'Minderpreis' : 'Mehrpreis'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€${NNBSP}${word}`
}

export function OptionChapter({ groups, intro }: {
  groups: OptionGroup[]
  intro: string
}) {
  const s = useStore()
  const tx = useTx()
  const b = activeBuilding(s)
  const chosen = s.kg300[b.id] ?? {}
  const prov = s.kg300Provenance[b.id] ?? {}

  // Пока здание не подтверждено, спускаться рано: опции у здания, чьи
  // метрики ещё спорны, придётся пересматривать целиком.
  if (!s.buildingConfirmed[b.id]) {
    return (
      <div className="a3-sheet">
        <p className="text-body text-text-primary">
          <span aria-hidden="true">▲ </span>
          {tx('Zuerst die Gebäudedaten bestätigen.')}
        </p>
        <p className="a3-cap mt-1">
          {tx('Leistungen für ein Gebäude auszuwählen, dessen Flächen und Einstufung noch offen sind, hiesse die Auswahl später vollständig zu wiederholen.')}
        </p>
        <div className="mt-3">
          <Button variant="primary" onClick={() => s.openChapterAt(1)}>
            {tx('Zu Kapitel 1 · Gebäude & Umfang')}
          </Button>
        </div>
      </div>
    )
  }

  const visible = groups.filter((g) => isGroupActive(g, chosen))

  return (
    <div className="grid gap-5">
      {s.mode === 'intern' && (
        <p className="a3-cap a3-lede">
          {intro}
        </p>
      )}

      {visible.map((g: OptionGroup) => {
        const value = chosen[g.id] ?? g.default
        const source = prov[g.id] ?? 'Standard'
        return (
          <section key={g.id} className="a3-sheet">
            <h2 className="text-heading-3 font-bold text-text-primary">{tx(g.label)}</h2>
            <p className="a3-cap mt-1">{tx(g.question)}</p>

            {/* Провенанс выбора — пункт 8: найденное в документах предвыбрано
                и называет файл, но остаётся переключаемым. */}
            {source === 'aus Dokument' && g.documentRef && (
              <p className="a3-chip-src mt-2">
                <span aria-hidden="true" className="a3-dot" />
                <span aria-hidden="true">◆ </span>
                {tx('Anforderung aus der Dokumentation')} · {g.documentRef}
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
                const mapped = g.choices.map((c) => {
                  const rate = new Decimal(c.rate)
                  const qty = g.denominator === 'BGF_ABOVE_GROUND' ? b.bgfAboveGround
                    : g.denominator === 'BGF_BELOW_GROUND' ? b.bgfBelowGround
                      : bgfS(b.id)
                  const current = new Decimal(
                    g.choices.find((x) => x.value === value)?.rate ?? '0')
                  // Нормативное ограничение сильнее коммерческого выбора:
                  // при GK 5 лифт обязателен, и «без лифта» не является
                  // решением, которое продавец вправе принять.
                  const norm = choiceBlocked(c, b.gebaeudeklasse.value)
                  const noBase = qty.lte(0) && !rate.isZero()
                  return {
                    value: c.value,
                    title: tx(c.label),
                    description: `${tx(c.basis)} ${MARK}`,
                    consequence: c.value === value
                      ? tx('aktuelle Auswahl')
                      : euro(rate.minus(current).mul(qty)),
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
                return facade ? (
                  <FacadeTileGroup
                    legend={g.question}
                    value={value}
                    onChange={(v) => s.setKg300(g.id, v)}
                    options={mapped.map((m) => ({
                      value: m.value,
                      label: m.title,
                      consequence: m.consequence,
                      material: FACADE_PRESENTATION[m.value]!.material,
                      axes: FACADE_PRESENTATION[m.value]!.axes.map(tx),
                      disabled: m.disabled,
                      disabledReason: m.disabledReason,
                    }))}
                  />
                ) : (
                  <RadioCardGroup
                    legend={g.question}
                    legendHidden
                    value={value}
                    onChange={(v) => s.setKg300(g.id, v)}
                    options={mapped}
                  />
                )
              })()}
            </div>
          </section>
        )
      })}

      <p className="a3-cap text-text-muted">
        {MARK} · {DERIVED_LABEL}. Die Preiswirkung erscheint sofort in der
        Angebotsspalte rechts und im Kostentreiber.
      </p>
    </div>
  )
}

function bgfS(id: string): Decimal {
  const d = (derived.buildings as Record<string, { bgfSAboveGround?: { value: string | null } }>)[id]
  const v = d?.bgfSAboveGround?.value
  return v ? new Decimal(v) : new Decimal(0)
}
