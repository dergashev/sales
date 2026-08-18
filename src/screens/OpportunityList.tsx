import { useMemo, useState } from 'react'
import opportunities from '../fixtures/opportunities.json'
import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { Card, FormField, SelectField } from '../components/designSystem'
import { STAGE_TAG } from '../lib/opportunityStage'
import { useT, useTx } from '../i18n'

/**
 * Корень продукта — список Opportunities (DC-34 · Suche & Filter,
 * CARD-001 · Card).
 *
 * Уровень выше рабочего конвейера: здесь ещё нет ни панелей, ни цены.
 * Цена не может быть показана до того, как выбран Option, — а Option
 * появляется только после карточки. Показать сумму здесь значило бы
 * пообещать число, у которого ещё нет конфигурации.
 *
 * Структура — контрактная (ревью № 13, дефект 14): поиск и фильтры живут
 * в `.a3-project-search`, активные фильтры — `.a3-chip-control` с зоной
 * нажатия 44 (дефект 19: прежний `.a3-tag` — статусный знак, а не
 * контрол), число совпадений — `.a3-search-result-count`.
 *
 * Карточка (TASK 03, backlog `ff3a8ad9`) — канонический примитив `Card`
 * (`components-core.md` CARD-001), а не рукописный `<div onClick>`: тот
 * был явным нарушением gate 3 («onclick на div/article вместо настоящего
 * контрола») и не давал ни одного клавиатурного пути ко всей карточке —
 * только к CTA-кнопке. `Card.onOpen` делает название проекта настоящим
 * растянутым `primaryDestination` (тот же клик-контейнер, что и раньше,
 * но теперь фокусируемый), CTA остаётся отдельным `secondaryAction`
 * (правило 26 продолжает выполняться — раньше через ручной
 * `stopPropagation`, теперь через `z-index`-порядок самого примитива).
 * Статус-тег (DC-16 `.a3-tag`, общий с `OpportunityCard`-шапкой через
 * `STAGE_TAG`) остаётся как есть — миграция на общий `Badge` здесь не
 * делается, иначе один и тот же lifecycle-статус выглядел бы по-разному
 * на списке и на детальном экране (см. design-system-ledger DC-16).
 *
 * Иерархия шапки (TASK 02, решение Design Review): `.a3-masthead` несёт
 * только `h1` — контракт PageHeader прямо запрещает breadcrumbs внутри
 * title, а прежняя строка `.a3-cap` («Wurzel · alle Opportunities») была
 * ровно этим: она стояла ПЕРЕД h1 в том же flex-ряду с
 * `justify-content: space-between`, из-за чего заголовок улетал к правому
 * краю экрана, а «Wurzel» — необъяснённый термин уровня кода, нигде не
 * принятый как продуктовый. Место «локации» уже занято постоянной
 * глобальной шапкой (`AppHeader`) — она есть на каждом экране и уже
 * сознательно не показывает `Pfad`-крошку на этом, корневом уровне.
 * Число результатов теперь строка между title и `.a3-project-search`
 * (требуемый порядок: локация → title → результат → поиск/фильтры →
 * список), без выдуманного утверждения о сортировке (ушедшее
 * «sortiert nach Reihenfolge der Übergabe aus HubSpot» не имело
 * никакой сортировки за собой — решение 161c0b7b).
 */

const ALL = 'alle'

/** CTA карточки — следующая лучшая работа стадии, не общее «öffnen». */
const STAGE_CTA: Record<string, string> = {
  'neu aus HubSpot': 'Analyse starten',
  'in Vorbereitung': 'Vorbereiten',
  'versendet': 'Ansehen',
}

/**
 * Aktionabilität laut genehmigtem Opportunities Product Authority Contract
 * (backlog `161c0b7b`, §5/§12 «ACTIONABILITY»): YES für Project received
 * (`neu aus HubSpot`) und Prioritised and in progress (`in Vorbereitung`),
 * NO by default für Awaiting customer feedback (`versendet`). Nur die drei
 * heute in der Fixture vorhandenen Stadien — die restigen fünf HubSpot-
 * Status existieren noch nicht als Fixture-Zeile (separate, bereits
 * vermerkte Downstream-Aufgabe). Steuert ausschließlich die CTA-Betonung
 * (primary/secondary), keine neue Fachlogik.
 */
const ACTIONABLE_NOW = new Set(['neu aus HubSpot', 'in Vorbereitung'])

export function OpportunityList() {
  const s = useStore()
  const t = useT()
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

  // Kompaktes Ergebnis-Resümee (Anforderung „RESULT SUMMARY", TASK 02):
  // ungefiltert nennt es nur die Gesamtzahl, gefiltert macht es die
  // Einschränkung sichtbar — nie eine Ranking-/Sortier-Behauptung.
  const resultSummary = active.length > 0
    ? t('opplist.resultSummary.filtered', { shown: shown.length, total: items.length })
    : t('opplist.resultSummary.total', { count: items.length })

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
        <h1 className="a3-hero-title">{t('opplist.title')}</h1>
      </header>

      {/* Число совпадений объявляется один раз после сужения, а не на
          каждый символ (DC-34): иначе скринридер читает набор вслух.
          Steht zwischen Titel und Suche/Filter (geforderte Reihenfolge:
          Standort → Titel → Ergebniskontext → Suche/Filter → Ergebnisse). */}
      <div className="a3-search-result-count mt-1" role="status" aria-live="polite">
        {resultSummary}
      </div>

      {/* DC-34: видимый контрол поиска, фильтры и активные фильтр-чипы —
          одна рамка, один контракт. */}
      <div role="search" className="a3-project-search mt-4">
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
              placeholder={tx('Name, Stadt, Owner, ID')}
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
            {/* Card (CARD-001): title = primaryDestination (Name, mit
                onOpen), status/meta/Termin/Zähler = nonInteractiveArea,
                actions = die eine sekundäre CTA-Aktion. Termin (falls
                vorhanden) wird NEUTRAL angezeigt — kein Dringlichkeits-
                Ranking: `meetingAt` ist Freitext, kein echtes Datum (Data-
                Model-Gap, genehmigter Contract `161c0b7b` §5). */}
            <Card
              className="h-full"
              title={o.name}
              meta={<>{o.city} · {o.country} · {o.owner}</>}
              status={
                <span className={'a3-tag ' + STAGE_TAG[o.stage]}>
                  {tx(o.stage)}
                </span>
              }
              actions={
                <Button
                  variant={ACTIONABLE_NOW.has(o.stage) ? 'primary' : 'secondary'}
                  onClick={() => s.openOpportunity(o.id)}
                  aria-label={`${o.name} öffnen`}
                >
                  {tx(STAGE_CTA[o.stage] ?? 'Öffnen')}
                </Button>
              }
              onOpen={() => s.openOpportunity(o.id)}
            >
              {o.meetingAt && (
                <span className="a3-term block">
                  {tx('Termin')}{NNBSP}{tx(o.meetingAt)}
                </span>
              )}
              <span className="block">
                {o.buildings}{NNBSP}Gebäude · {o.documents}{NNBSP}Dokumente
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
