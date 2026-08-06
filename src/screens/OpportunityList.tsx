import { useMemo, useState } from 'react'
import opportunities from '../fixtures/opportunities.json'
import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'

/**
 * Корень продукта — список Opportunities (DC-34 · Suche & Filter).
 *
 * Уровень выше рабочего конвейера: здесь ещё нет ни панелей, ни цены.
 * Цена не может быть показана до того, как выбран Option, — а Option
 * появляется только после карточки. Показать сумму здесь значило бы
 * пообещать число, у которого ещё нет конфигурации.
 *
 * Фильтры и поиск сужают ОДНО множество и показываются вместе с числом
 * совпадений: фильтр, не сообщающий, сколько он спрятал, превращает
 * пустой экран в загадку. Активные фильтры видны и снимаются по одному —
 * «почему я ничего не вижу» обязано отвечаться с экрана.
 */

const ALL = 'alle'

export function OpportunityList() {
  const s = useStore()
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

  const select = (id: string, label: string) => (
    <label className="flex flex-col gap-1">
      <span className="a3-cap">{label}</span>
      <select
        className="a3-rb-number"
        style={{ width: 'var(--measure-form-control)' }}
        value={id === 'land' ? country : id === 'stadt' ? city : owner}
        onChange={(e) => (id === 'land' ? setCountry(e.target.value)
          : id === 'stadt' ? setCity(e.target.value) : setOwner(e.target.value))}
      >
        {(id === 'land' ? countries : id === 'stadt' ? cities : owners).map((v) => (
          <option key={v} value={v}>{v === ALL ? 'alle' : v}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <p className="a3-cap">Wurzel · alle Opportunities</p>
        <h1 className="mt-1 text-heading-2 font-bold text-text-primary">Opportunities</h1>
      </header>

      <div role="search" className="mt-5 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="a3-cap">Suche</span>
          <input
            className="a3-rb-number"
            style={{ width: 'var(--measure-card-compact)' }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, Stadt, Owner, ID"
            aria-label="Opportunities durchsuchen"
          />
        </label>
        {select('land', 'Land')}
        {select('stadt', 'Stadt')}
        {select('owner', 'Opportunity Owner')}
      </div>

      {/* Число совпадений объявляется один раз после сужения, а не на
          каждый символ (DC-34): иначе скринридер читает набор вслух. */}
      <p className="a3-cap mt-3" aria-live="polite">
        {shown.length} von {items.length} Opportunities
      </p>

      {active.length > 0 && (
        <div className="a3-row mt-2">
          {active.map((f) => (
            <button
              key={f.label}
              type="button"
              className="a3-tag"
              onClick={f.clear}
              aria-label={`Filter entfernen: ${f.label}`}
            >
              {f.label}<span aria-hidden="true">{NNBSP}✕</span>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <p className="mt-5 border border-border-default p-4 text-body text-text-secondary">
          <span aria-hidden="true">○ </span>
          Keine Opportunity entspricht den Filtern. Entfernen Sie einen Filter
          oben, um wieder Treffer zu sehen.
        </p>
      )}

      <ul className="mt-4 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(34ch, 1fr))' }}>
        {shown.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => s.openOpportunity(o.id)}
              className="a3-pcard w-full text-left"
              aria-label={`${o.name} öffnen`}
            >
              <span className="block text-body font-bold text-text-primary">{o.name}</span>
              <span className="a3-cap block">
                {o.city} · {o.country} · {o.owner}
              </span>
              <span className="a3-cap block">
                {o.buildings}{NNBSP}Gebäude · {o.documents}{NNBSP}Dokumente · {o.stage}
                {o.meetingAt ? ` · Termin ${o.meetingAt}` : ''}
              </span>
              {/* Честность объёма прототипа прямо на карточке: проработан
                  один кейс, и продукт говорит это до клика, а не после. */}
              {!o.worked && (
                <span className="a3-cap block text-text-muted">
                  <span aria-hidden="true">○ </span>
                  im Prototyp nicht ausgearbeitet
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
