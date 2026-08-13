import { useMemo, useState } from 'react'
import opportunities from '../fixtures/opportunities.json'
import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { FormField, SelectField } from '../components/designSystem'
import { useTx } from '../i18n'

/**
 * Корень продукта — список Opportunities (DC-34 · Suche & Filter,
 * DC-15 · Projekt-Karten).
 *
 * Уровень выше рабочего конвейера: здесь ещё нет ни панелей, ни цены.
 * Цена не может быть показана до того, как выбран Option, — а Option
 * появляется только после карточки. Показать сумму здесь значило бы
 * пообещать число, у которого ещё нет конфигурации.
 *
 * Структура — контрактная (ревью № 13, дефект 14): поиск и фильтры живут
 * в `.a3-project-search`, активные фильтры — `.a3-chip-control` с зоной
 * нажатия 44 (дефект 19: прежний `.a3-tag` — статусный знак, а не
 * контрол), число совпадений — `.a3-search-result-count`, карточка —
 * `.a3-pcard` с анатомией top/mid/cta: карточка открывает Opportunity,
 * кнопка — следующая лучшая работа (правило 26).
 */

const ALL = 'alle'

/** Цвет стадии — вариант тега системы; текст остаётся носителем. */
const STAGE_TAG: Record<string, string> = {
  'neu aus HubSpot': 'a3-blue',
  'in Vorbereitung': 'a3-orange',
  'versendet': 'a3-green',
}

/** CTA карточки — следующая лучшая работа стадии, не общее «öffnen». */
/**
 * Срочность выводится из подписи встречи фикстуры, а не из отдельного
 * флага: два источника «когда встреча» разошлись бы при первой правке.
 * Слова «heute/morgen» — то, чем фикстура называет ближайшие сроки.
 */
function isUrgent(meetingAt: string | null | undefined): boolean {
  if (!meetingAt) return false
  return /\b(heute|morgen)\b/i.test(meetingAt)
}

const STAGE_CTA: Record<string, string> = {
  'neu aus HubSpot': 'Analyse starten',
  'in Vorbereitung': 'Vorbereiten',
  'versendet': 'Ansehen',
}

export function OpportunityList() {
  const s = useStore()
  const tx = useTx()
  const [q, setQ] = useState('')
  const [country, setCountry] = useState(ALL)
  const [city, setCity] = useState(ALL)
  const [owner, setOwner] = useState(ALL)

  const items = opportunities.items
  const countries = useMemo(
    () => [ALL, ...Array.from(new Set(items.map((i) => i.country))).sort()], [items])
  // Города зависят от выбранной страны: список, предлагающий город из
  // другой страны, обещает результат, которого не будет.
  const cities = useMemo(() => [ALL, ...Array.from(new Set(
    items.filter((i) => country === ALL || i.country === country).map((i) => i.city),
  )).sort()], [items, country])
  const owners = useMemo(
    () => [ALL, ...Array.from(new Set(items.map((i) => i.owner))).sort()], [items])

  const shown = items.filter((i) =>
    (country === ALL || i.country === country) &&
    (city === ALL || i.city === city) &&
    (owner === ALL || i.owner === owner) &&
    (q.trim() === '' ||
      `${i.name} ${i.city} ${i.owner} ${i.id}`.toLowerCase().includes(q.trim().toLowerCase())))

  const active = [
    country !== ALL && { label: `Land: ${country}`, clear: () => setCountry(ALL) },
    city !== ALL && { label: `Stadt: ${city}`, clear: () => setCity(ALL) },
    owner !== ALL && { label: `Owner: ${owner}`, clear: () => setOwner(ALL) },
    q.trim() !== '' && { label: `Suche: ${q.trim()}`, clear: () => setQ('') },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>

  const resetAll = () => { setQ(''); setCountry(ALL); setCity(ALL); setOwner(ALL) }

  const select = (id: string, label: string) => (
    <SelectField
      id={`opp-${id}`}
      label={label}
      value={id === 'land' ? country : id === 'stadt' ? city : owner}
      onChange={(e) => (id === 'land' ? setCountry(e.target.value)
        : id === 'stadt' ? setCity(e.target.value) : setOwner(e.target.value))}
    >
      {(id === 'land' ? countries : id === 'stadt' ? cities : owners).map((v) => (
        <option key={v} value={v}>{v === ALL ? tx('alle') : v}</option>
      ))}
    </SelectField>
  )

  return (
    <div className="px-7 py-6">
      <header className="a3-masthead">
        <p className="a3-cap">{tx('Wurzel · alle Opportunities')}</p>
        <h1 className="a3-hero-title">Opportunities</h1>
      </header>

      {/* DC-34: видимый контрол поиска, фильтры и число результатов —
          одна рамка, один контракт. */}
      <div role="search" className="a3-project-search mt-5">
        <div className="a3-search-line">
          <FormField
            htmlFor="opp-suche"
            label={tx('Opportunities durchsuchen')}
          >
            <input
              id="opp-suche"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, Stadt, Owner, ID"
            />
          </FormField>
          {select('land', tx('Land'))}
          {select('stadt', tx('Stadt'))}
          {select('owner', tx('Opportunity Owner'))}
        </div>

        {active.length > 0 && (
          <div className="a3-filter-row">
            {active.map((f) => (
              <button
                key={f.label}
                type="button"
                className="a3-chip-control"
                aria-pressed="true"
                onClick={f.clear}
              >
                {f.label}{NNBSP}<span aria-hidden="true">✕</span>
                <span className="a3-visually-hidden">Filter entfernen: {f.label}</span>
              </button>
            ))}
            <button type="button" className="a3-linkbtn" onClick={resetAll}>
              {tx('Alle Filter zurücksetzen')}
            </button>
          </div>
        )}

        {/* Число совпадений объявляется один раз после сужения, а не на
            каждый символ (DC-34): иначе скринридер читает набор вслух. */}
        <div className="a3-search-result-count" role="status" aria-live="polite">
          {shown.length} von {items.length} Opportunities · sortiert nach Reihenfolge
          der Übergabe aus HubSpot
        </div>
      </div>

      {shown.length === 0 && (
        <div className="a3-empty-spec mt-5">
          <span className="a3-empty-icon" aria-hidden="true">○</span>
          <div>
            <p className="text-body text-text-primary">
              {tx('Keine Opportunity entspricht den Filtern.')}
            </p>
            <p className="a3-cap mt-1">
              {tx('Entfernen Sie einen Filter oben, um wieder Treffer zu sehen.')}
            </p>
            <div className="mt-2">
              <Button onClick={resetAll}>{tx('Alle Filter zurücksetzen')}</Button>
            </div>
          </div>
        </div>
      )}

      <ul className="a3-opportunity-grid mt-4">
        {shown.map((o) => (
          <li key={o.id}>
            {/* Карточка = один клик-контейнер без собственного tabindex;
                клавиатурный путь — CTA-кнопка внутри (правило 26). */}
            {/* `.a3-urgent` — срочность встречи, не украшение: карточка со
                встречей «сегодня/завтра» получает красную кромку контракта
                DC-15 плюс подпись (правило 8: цвет не единственный
                носитель). Добор DC-COVERAGE приёмки № 17. */}
            <div
              className={'a3-pcard h-full cursor-pointer'
                + (isUrgent(o.meetingAt) ? ' a3-urgent' : '')}
              onClick={() => s.openOpportunity(o.id)}
            >
              <div className="a3-top">
                <b>{o.name}</b>
                {o.meetingAt && (
                  <span className="a3-term">
                    {isUrgent(o.meetingAt) && (
                      <span aria-hidden="true">▲{NNBSP}</span>
                    )}
                    {tx('Termin')}{NNBSP}{tx(o.meetingAt)}
                    {isUrgent(o.meetingAt) && ` · ${tx('dringend')}`}
                  </span>
                )}
              </div>
              <div className="a3-mid">
                {/* Стадия — цветной статус-тег системы; цвет поддерживает,
                    носителем остаётся текст (правило 8). */}
                <span className={'a3-tag ' + STAGE_TAG[o.stage]}>
                  <span aria-hidden="true" className="a3-dot" />
                  {tx(o.stage)}
                </span>
                <span>
                  {o.city} · {o.country} · {o.owner}
                </span>
                {/* stopPropagation на обёртке: клик по CTA не должен
                    второй раз дёргать клик-контейнер карточки (правило 26). */}
                <span className="a3-cta" onClick={(e) => e.stopPropagation()}>
                  <Button
                    onClick={() => s.openOpportunity(o.id)}
                    aria-label={`${o.name} öffnen`}
                  >
                    {tx(STAGE_CTA[o.stage] ?? 'Öffnen')}
                  </Button>
                </span>
              </div>
              <div className="a3-mid">
                <span>
                  {o.buildings}{NNBSP}Gebäude · {o.documents}{NNBSP}Dokumente
                </span>
                {/* Честность объёма прототипа прямо на карточке: проработан
                    один кейс, и продукт говорит это до клика, а не после. */}
                {!o.worked && (
                  <span className="a3-cap">
                    <span aria-hidden="true">○ </span>
                    {tx('im Prototyp nicht ausgearbeitet')}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
