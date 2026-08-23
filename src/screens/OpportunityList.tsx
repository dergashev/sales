import { useMemo, useState } from 'react'
import opportunities from '../fixtures/opportunities.json'
import { useStore } from '../state/store'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { Card, FormField, SelectField } from '../components/designSystem'
import { SegmentedControl, Switch } from '../components/controls'
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
 *
 * TASK 04 (backlog `e2337966`, Design-Handoff в Projektgedächtnis
 * `opportunities-landing-workflow-contract`) — operative Triage:
 *
 * - **Default-Reihenfolge** ist jetzt real (§2 des Decision Brief):
 *   aktionsfähig-jetzt zuerst, dann Lifecycle-Gewicht, dann Name — vorher
 *   war die Liste unsortiert (rohe Fixture-Reihenfolge).
 * - **Sortierung** ist ein `SegmentedControl` (nicht `Select`): genau drei
 *   genehmigte Dimensionen (Empfohlen/Name/Status, §9/§10). Dieselbe
 *   Primitive trägt bereits den DE/EN-Sprachschalter in `App.tsx` — die
 *   ausgewählte Option TRÄGT den „welche Sortierung ist aktiv"-Zustand
 *   selbst (kein zusätzlicher Caption nötig).
 * - **Zwei neue Filter-Switches** (nicht Checkbox/SegmentedControl —
 *   OPTION-008 verbietet Switch-Semantik nur für Angebots-Optionen, nicht
 *   für Interface-Zustand): „nur aktionsfähige" und „pausiert/signiert/
 *   verloren einschließen" (Recovery). Recovery bleibt strikt ein
 *   Filter-Toggle — niemals ein HubSpot-Schreibzugriff (Sales Platform
 *   hat nur Lesezugriff auf die CRM-Lifecycle, bestätigt in `161c0b7b`).
 * - **Status-Filter**-Optionen sind datengetrieben (`Array.from(new
 *   Set(...))`), genau wie Stadt von Land abhängt — nicht hartkodiert auf
 *   alle acht kanonischen Stadien, weil fünf davon noch keine Fixture-Zeile
 *   haben (dokumentierte Data-Model-Lücke, kein Erfinden von Daten).
 * - **Zwei getrennte Leerzustände** (AC 4/6): „keine Treffer" (Filter
 *   greifen) bleibt wie zuvor mit Reset-Aktion; „noch keine Opportunities"
 *   (Fixture selbst leer) ist neu, hat eigenen Text und KEINE Aktion — es
 *   gibt nichts zurückzusetzen und keinen „neu anlegen"-Weg (CRM read-only).
 * - **Loading/Error/Stale bleiben bewusst nicht implementiert**: die Liste
 *   ist ein synchroner Fixture-Import ohne Backend — `data-states.ts`
 *   deklariert das seit TASK 03 korrekt als `notApplicable`. Ein
 *   simulierter Netzwerkfehler wäre eine Simulation, die als Implementierung
 *   ausgegeben wird (derselbe Grundsatz wie bei `export`/`internalNote`).
 * - **i18n-Fix**: der Status-Tag ging vorher durch `tx(o.stage)` — die
 *   Rückwärtssuche gegen den generierten Codex-Korpus (`GENERATED_DE`)
 *   findet „versendet" dort nirgends als Einzelwort, weil es im
 *   restlichen Corpus nie allein vorkommt. Live im Browser reproduziert:
 *   im EN-Modus blieb der Tag „versendet" statt „sent". Ersetzt durch
 *   einen echten `t()`-Schlüssel pro Stadium (`STAGE_LABEL_KEY`), nicht
 *   durch einen globalen Patch der `tx()`-Brücke. Dieselbe Lücke betraf
 *   „Land:"/„Stadt:"/„Owner:"/„Suche:" in den Filter-Chips und die
 *   hartkodierten Wörter „Gebäude"/„Dokumente" — beide waren nie durch
 *   `tx()`/`t()` geführt und blieben im EN-Modus deutsch; jetzt echte
 *   Wörterbucheinträge.
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

/**
 * Default-excluded laut §8 FILTERING des genehmigten Contracts: On hold /
 * Contract signed / Lost sind standardmäßig ausgeblendet, aber über den
 * Recovery-Switch abrufbar. Die drei Rohwerte existieren noch in keiner
 * Fixture-Zeile (Data-Model-Lücke) — die Menge wird trotzdem generisch
 * geführt, damit sie sich automatisch aktiviert, sobald Zeilen dazukommen.
 */
const DEFAULT_EXCLUDED_STAGES = new Set(['ruhend', 'gewonnen', 'verloren'])

/**
 * Deterministisches Lifecycle-Gewicht §2 des Decision Brief. Nur die drei
 * heute vorhandenen Fixture-Stadien werden geprüft; die drei restlichen
 * Rohwerte sind für Vorwärtskompatibilität eingetragen. „Ready for
 * Indicative Offer" / „Planning contract" haben noch keine Fixture-
 * Schreibweise und fehlen deshalb bewusst in dieser Tabelle.
 */
const LIFECYCLE_WEIGHT: Record<string, number> = {
  'in Vorbereitung': 1, // Prioritised and in progress
  'neu aus HubSpot': 4, // Project received
  versendet: 5, // Awaiting customer feedback
  ruhend: 6, // On hold
  gewonnen: 7, // Contract signed
  verloren: 8, // Lost
}

/** Sichtbarer Schlüssel je Stadium (STATUS-TAG-i18n-Fix, siehe Docstring). */
const STAGE_LABEL_KEY: Record<string, string> = {
  'neu aus HubSpot': 'opplist.stage.neuAusHubspot',
  'in Vorbereitung': 'opplist.stage.inVorbereitung',
  versendet: 'opplist.stage.versendet',
  ruhend: 'opplist.stage.ruhend',
  gewonnen: 'opplist.stage.gewonnen',
  verloren: 'opplist.stage.verloren',
}

type OpportunityItem = (typeof opportunities.items)[number]

const byName = (a: OpportunityItem, b: OpportunityItem) => a.name.localeCompare(b.name, 'de')

const byStatus = (a: OpportunityItem, b: OpportunityItem) => {
  const diff = (LIFECYCLE_WEIGHT[a.stage] ?? 99) - (LIFECYCLE_WEIGHT[b.stage] ?? 99)
  return diff !== 0 ? diff : byName(a, b)
}

/** „Empfohlen" — aktionsfähig-jetzt zuerst, dann Lifecycle-Gewicht, dann Name (§2). */
const byRecommended = (a: OpportunityItem, b: OpportunityItem) => {
  const aActionable = ACTIONABLE_NOW.has(a.stage)
  const bActionable = ACTIONABLE_NOW.has(b.stage)
  if (aActionable !== bActionable) return aActionable ? -1 : 1
  return byStatus(a, b)
}

type SortMode = 'recommended' | 'name' | 'status'

const SORTERS: Record<SortMode, (a: OpportunityItem, b: OpportunityItem) => number> = {
  recommended: byRecommended,
  name: byName,
  status: byStatus,
}

export function OpportunityList() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const [q, setQ] = useState('')
  const [country, setCountry] = useState(ALL)
  const [city, setCity] = useState(ALL)
  const [owner, setOwner] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [actionableOnly, setActionableOnly] = useState(false)
  const [includeExcluded, setIncludeExcluded] = useState(false)
  const [sort, setSort] = useState<SortMode>('recommended')

  const items = opportunities.items
  const stageLabel = (stage: string) => t(STAGE_LABEL_KEY[stage] ?? stage)

  // Zwei Toggles bilden das Sichtbarkeits-Universum VOR den übrigen
  // Filtern — dieselbe „abhängige Optionsliste"-Logik wie Stadt/Land, nur
  // auf Ebene der ganzen Liste statt eines einzelnen Selects.
  const recoverable = useMemo(() => items.filter((i) =>
    includeExcluded || !DEFAULT_EXCLUDED_STAGES.has(i.stage)), [items, includeExcluded])
  const universe = useMemo(() => actionableOnly
    ? recoverable.filter((i) => ACTIONABLE_NOW.has(i.stage))
    : recoverable, [recoverable, actionableOnly])

  const countries = useMemo(
    () => [ALL, ...Array.from(new Set(universe.map((i) => i.country))).sort()], [universe])
  // Города зависят от выбранной страны: список, предлагающий город из
  // другой страны, обещает результат, которого не будет.
  const cities = useMemo(() => [ALL, ...Array.from(new Set(
    universe.filter((i) => country === ALL || i.country === country).map((i) => i.city),
  )).sort()], [universe, country])
  const owners = useMemo(
    () => [ALL, ...Array.from(new Set(universe.map((i) => i.owner))).sort()], [universe])
  // Status-Optionen sind datengetrieben (Design-Handoff #2): nur Stadien,
  // die im aktuellen Universum tatsächlich vorkommen, nie ein hartkodiertes
  // Acht-Status-Vokabular mit garantiert leeren Einträgen.
  const statuses = useMemo(
    () => [ALL, ...Array.from(new Set(universe.map((i) => i.stage)))], [universe])

  const shown = useMemo(() => universe.filter((i) =>
    (country === ALL || i.country === country) &&
    (city === ALL || i.city === city) &&
    (owner === ALL || i.owner === owner) &&
    (status === ALL || i.stage === status) &&
    (q.trim() === '' ||
      `${i.name} ${i.city} ${i.owner} ${i.id}`.toLowerCase().includes(q.trim().toLowerCase())))
    .slice()
    .sort(SORTERS[sort]),
  [universe, country, city, owner, status, q, sort])

  const active = [
    country !== ALL && { label: t('opplist.filter.country.chip', { value: country }), clear: () => setCountry(ALL) },
    city !== ALL && { label: t('opplist.filter.city.chip', { value: city }), clear: () => setCity(ALL) },
    owner !== ALL && { label: t('opplist.filter.owner.chip', { value: owner }), clear: () => setOwner(ALL) },
    status !== ALL && { label: t('opplist.filter.status.chip', { value: stageLabel(status) }), clear: () => setStatus(ALL) },
    actionableOnly && { label: t('opplist.filter.actionableOnly.chip'), clear: () => setActionableOnly(false) },
    includeExcluded && { label: t('opplist.filter.includeExcluded.chip'), clear: () => setIncludeExcluded(false) },
    q.trim() !== '' && { label: t('opplist.filter.search.chip', { value: q.trim() }), clear: () => setQ('') },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>

  // Sortierung ist eine eigene Achse (§10: „Separate sorting from
  // filtering") — „Alle Filter zurücksetzen" fasst sie deshalb bewusst
  // nicht an.
  const resetAll = () => {
    setQ(''); setCountry(ALL); setCity(ALL); setOwner(ALL); setStatus(ALL)
    setActionableOnly(false); setIncludeExcluded(false)
  }

  // Kompaktes Ergebnis-Resümee (Anforderung „RESULT SUMMARY", TASK 02):
  // ungefiltert nennt es nur die Gesamtzahl, gefiltert macht es die
  // Einschränkung sichtbar — nie eine Ranking-/Sortier-Behauptung.
  const resultSummary = active.length > 0
    ? t('opplist.resultSummary.filtered', { shown: shown.length, total: items.length })
    : t('opplist.resultSummary.total', { count: items.length })

  const select = (id: 'land' | 'stadt' | 'owner' | 'status', label: string) => (
    <SelectField
      id={`opp-${id}`}
      label={label}
      value={id === 'land' ? country : id === 'stadt' ? city : id === 'owner' ? owner : status}
      onChange={(e) => (id === 'land' ? setCountry(e.target.value)
        : id === 'stadt' ? setCity(e.target.value)
          : id === 'owner' ? setOwner(e.target.value) : setStatus(e.target.value))}
    >
      {(id === 'land' ? countries : id === 'stadt' ? cities : id === 'owner' ? owners : statuses)
        .map((v) => (
          <option key={v} value={v}>{v === ALL ? tx('alle') : id === 'status' ? stageLabel(v) : v}</option>
        ))}
    </SelectField>
  )

  return (
    <div className="a3-page px-7 py-6">
      <header className="a3-masthead">
        <h1 className="a3-hero-title">{t('opplist.title')}</h1>
      </header>

      {/* Число совпадений объявляется один раз после сужения, а не на
          каждый символ (DC-34): иначе скринридер читает набор вслух.
          Steht zwischen Titel und Suche/Filter (geforderte Reihenfolge:
          Standort → Titel → Ergebniskontext → Suche/Filter → Ergebnisse).
          Sortierung sitzt auf derselben Zeile (rechts), bewusst AUSSERHALB
          des Filter-Fieldsets: §10 verlangt, Sortierung von Filterung
          sichtbar zu trennen. Das ausgewählte Segment TRÄGT den
          „welche Sortierung ist aktiv"-Zustand (SegmentedControl-Kontrakt),
          kein zusätzlicher Caption nötig (Design-Handoff #1). */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-1">
        <div className="a3-search-result-count" role="status" aria-live="polite">
          {resultSummary}
        </div>
        <SegmentedControl
          legend={t('opplist.sort.legend')}
          layout="inline"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recommended', label: t('opplist.sort.recommended') },
            { value: 'name', label: t('opplist.sort.name') },
            { value: 'status', label: t('opplist.sort.status') },
          ]}
        />
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
          {select('status', t('opplist.filter.status.label'))}
        </div>

        {/* Zwei unabhängige Interface-Zustände (nicht gegenseitig
            ausschließend) — Switch, kein SegmentedControl/CheckboxCard:
            beide sind Filter-Toggles, keine Angebots-Option (OPTION-008).
            F14: `.a3-switch-group` column-aligns both toggles (each Switch's
            own label previously set its own row's width, so the two toggle
            controls landed at two different x-positions). */}
        <div className="a3-switch-group">
          <Switch
            label={t('opplist.filter.actionableOnly.label')}
            checked={actionableOnly}
            onChange={setActionableOnly}
          />
          <Switch
            label={t('opplist.filter.includeExcluded.label')}
            checked={includeExcluded}
            onChange={setIncludeExcluded}
          />
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

      {/* Zwei unterscheidbare Leerzustände (AC 4/6): „nichts existiert"
          (Fixture selbst leer) vs. „nichts trifft zu" (Filter greifen) —
          niemals derselbe Text, sonst kann der Nutzer beides nicht
          auseinanderhalten. Der Konten-Leerzustand hat KEINE Aktion: es
          gibt nichts zurückzusetzen und keinen „neu anlegen"-Weg (CRM
          read-only, Design-Handoff #5). */}
      {items.length === 0 ? (
        <div className="a3-empty-spec mt-5">
          <span className="a3-empty-icon" aria-hidden="true">○</span>
          <div>
            <p className="text-body text-text-primary">
              {t('opplist.emptyAccount.sentence')}
            </p>
            <p className="a3-cap mt-1">
              {t('opplist.emptyAccount.detail')}
            </p>
          </div>
        </div>
      ) : shown.length === 0 && (
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
                  {stageLabel(o.stage)}
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
              {/* F14: cards without a Termin used to omit this line entirely,
                  so the status chip and CTA below sat 8 px higher than a
                  neighbouring card that has one — comparable cards did not
                  share a baseline. Always reserving the line (empty and
                  hidden from assistive tech when there is no Termin) keeps
                  every card's internal rows at the same height regardless of
                  content. */}
              <span className="a3-term block" aria-hidden={o.meetingAt ? undefined : 'true'}>
                {o.meetingAt ? <>{tx('Termin')}{NNBSP}{tx(o.meetingAt)}</> : NNBSP}
              </span>
              {/* F-39: both labels always used the plural form — DE
                  "1 Dokumente" and EN "1 building"/"1 document" both read as
                  a grammar mistake. 0/1/n selection, matching the pattern
                  used elsewhere for count grammar. */}
              <span className="block">
                {o.buildings}{NNBSP}{t(o.buildings === 1
                  ? 'opplist.card.buildingLabel' : 'opplist.card.buildingsLabel')} ·{' '}
                {o.documents}{NNBSP}{t(o.documents === 1
                  ? 'opplist.card.documentLabel' : 'opplist.card.documentsLabel')}
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
