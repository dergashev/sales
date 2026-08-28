import { useState, type RefObject } from 'react'
import { Decimal } from 'decimal.js'
import opportunities from '../fixtures/opportunities.json'
import {
  configForOption, eligibleClientOptions, projectionForOption,
  resolvedViewedOptionId, useStore, type OptionConfig, type Projection,
} from '../state/store'
import { driversSum } from '../engine/calculate'
import { NNBSP, present, formatDE, label as moneyLabel } from '../engine/money'
import { CATALOG } from '../state/catalog'
import { useT, useTx } from '../i18n'
import { PageHeader, SectionSheet, SelectField, Badge, OutputProfileSwitch } from './designSystem'
import { SegmentedControl } from './controls'
import { PartialState } from './DataStates'
import { CompositionBar } from '../design-system/CompositionBar'
import { buildKgCompositionSegments } from './costComposition'
import { MediaFrame } from '../design-system/MediaFrame'
import { useSemanticMotion } from '../design-system/motion'
import { useCountUp } from './primitives'
import { projectDriversForClient, translatedDriverLabel } from '../state/clientProjection'

/**
 * PresentationShell — REDESIGN R3 WAVE 2a.
 *
 * Заменяет рабочую трёхзонную композицию (Sidebar + main-router + OfferPanel)
 * как видимую структурную модель Kundenansicht (`App.tsx`'s `praesentation
 * && level === 'option'` fork). Собственных компонентов «мимо» системы нет:
 * каждый узел ниже — либо канонический примитив All3 (`PageHeader`,
 * `SectionSheet`, `CompositionBar`, `MediaFrame`, `SegmentedControl`,
 * `SelectField`, `Badge`, `OutputProfileSwitch`, `PartialState`), либо
 * продуктовая композиция из них (UI Design handoff, team run
 * 1787901689745, part 1–2/2 — narrative order, section content, motion
 * scope). Two small `.a3-presentation-tab`/`.a3-option-tile` rules were
 * added to `design-system/components.css`, both built from existing
 * tokens only (see that file's own comment for the reuse rationale).
 *
 * Единственный источник «какая Option сейчас показывается» —
 * `resolvedViewedOptionId`/`setViewedOption` (Wave 1, `store.ts`). Ни одна
 * секция здесь не читает `activeOptionId` для отображения контента и не
 * рендерит рабочие главы (`S3Konfigurator`/`OfferPanel`/`BuildingScope`) —
 * те читают `activeOptionId` напрямую и своим появлением здесь сломали бы
 * изоляцию (acceptance-контракт тикета: AC 5/15/16/21). Каждая секция —
 * чистая функция от `configForOption(viewedId)`/`projectionForOption
 * (viewedId)`, поэтому переключение — один согласованный ре-рендер без
 * частичного досчёта и без stale-flash (rule 32).
 */

type Candidate = { id: string; name: string; cfg: OptionConfig; p: Projection }

function buildCandidate(
  s: Parameters<typeof configForOption>[0],
  id: string,
  name: string,
): Candidate | null {
  const cfg = configForOption(s, id)
  const p = projectionForOption(s, id)
  return cfg && p ? { id, name, cfg, p } : null
}

function money(d: Decimal): string {
  const pr = present(d)
  return `${pr.prefix}${pr.prefix ? NNBSP : ''}${pr.display}`
}

function includedBuildingIdsOf(cfg: OptionConfig): string[] {
  return Object.keys(cfg.buildings).filter((id) => cfg.included[id])
}

function buildingNames(cfg: OptionConfig): string {
  return includedBuildingIdsOf(cfg)
    .map((id) => cfg.buildings[id]?.stableName ?? id)
    .join(' · ')
}

/** Считает деньги вверх до УЖЕ ОКРУГЛЁННОГО показа (rule 19) — тот же
 *  приём, что `OfferPanel.tsx`'s `totalCount` (не анимируем к точному
 *  Decimal, иначе на миг мелькнут лишние разряды сверх показанных). */
function useMoneyCountUp(exact: Decimal): { prefix: '≈' | ''; display: string } {
  const pr = present(exact)
  const counted = useCountUp(new Decimal(pr.display.replace(/\./g, '')), 0)
  return { prefix: pr.prefix, display: counted }
}

export function PresentationShell({ mainRef, modeRef }: {
  mainRef: RefObject<HTMLElement>
  modeRef: RefObject<HTMLButtonElement>
}) {
  const s = useStore()
  const tx = useTx()
  const opportunity = opportunities.items.find((o) => o.id === s.opportunityId)
  const projectName = opportunity?.name ?? s.opportunityId ?? ''

  const eligible = eligibleClientOptions(s)
  const viewedId = resolvedViewedOptionId(s)
  const currentId = eligible.some((o) => o.id === viewedId)
    ? viewedId!
    : (eligible[0]?.id ?? null)
  const current = currentId
    ? buildCandidate(s, currentId, eligible.find((o) => o.id === currentId)!.name)
    : null
  const candidates = eligible.flatMap((o) => {
    const c = buildCandidate(s, o.id, o.name)
    return c ? [c] : []
  })

  const [activeSection, setActiveSection] = useState<string>('projekt')
  const { reduced } = useSemanticMotion()

  // Anker über `id` statt React-Refs: jede Sektion trägt ihre `id` selbst
  // (via `SectionSheet`'s `...rest`), das Scrollen geht über die einzige
  // DOM-Quelle, die schon existiert — keine parallele Ref-Buchhaltung.
  // jsdom implementiert `scrollIntoView` nicht (derselbe Fall wie
  // `App.tsx`'s eigener `scrollTo`-Kommentar) — der Existenz-Check hält
  // das Klavieren in Tests sicher, ohne im echten Browser etwas zu ändern.
  const goTo = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(`presentation-${id}`)
    el?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  // Kein client-präsentierbares Option: eigener, ehrlicher Zustand statt
  // einer leeren Leinwand (AC 6/9/11/12) — dieselbe Unterscheidung, die
  // S4Vergleich (Wave 1) schon für dieselbe Frage trifft: existiert die
  // Option noch nicht, oder ist sie nur noch nicht bereit.
  if (!current) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PresentationBar
          projectName={projectName} projectCity={opportunity?.city}
          sections={[]} activeSection={activeSection}
          candidates={[]} currentId={null}
          onSwitch={() => {}} onExit={() => s.setMode('intern')} modeRef={modeRef}
        />
        <main ref={mainRef} tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none px-7 py-6">
          <PageHeader title={projectName || tx('Kundenansicht')} />
          <p className="mt-4 text-body text-text-secondary">
            <span aria-hidden="true">○ </span>
            {s.options.length > 0
              ? tx('Für dieses Projekt ist noch keine Option bereit für die Kundenansicht.')
              : tx('Noch keine Opportunity Option angelegt.')}
          </p>
        </main>
      </div>
    )
  }

  const showOptionen = candidates.length >= 2
  const sections: Array<{ id: string; label: string }> = [
    { id: 'projekt', label: tx('Projekt') },
    { id: 'umfang', label: tx('Umfang') },
    { id: 'ergebnis', label: tx('Ergebnis') },
    { id: 'zeitplan', label: tx('Zeitplan') },
    ...(showOptionen ? [{ id: 'optionen', label: tx('Optionen') }] : []),
    { id: 'angebot', label: tx('Angebot') },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PresentationBar
        projectName={projectName} projectCity={opportunity?.city}
        sections={sections}
        activeSection={activeSection} onNavigate={goTo}
        candidates={candidates} currentId={current.id}
        onSwitch={(id) => s.setViewedOption(id)}
        onExit={() => s.setMode('intern')} modeRef={modeRef}
      />

      <main ref={mainRef} tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none">
        <div className="mx-auto max-w-content px-7 py-6">
          <SectionProjekt opportunity={opportunity} current={current} />
          <SectionUmfang current={current} />
          <SectionErgebnis current={current} />
          <SectionZeitplan current={current} />
          {showOptionen && (
            <SectionOptionen
              candidates={candidates} currentId={current.id}
              onSwitch={(id) => s.setViewedOption(id)}
            />
          )}
          <SectionAngebot current={current} />
        </div>
      </main>
    </div>
  )
}

/**
 * PresentationBar — persistent, calm chrome. `OutputProfileSwitch` (DC-22/
 * DC-33) liefert Indikator + expliziten Ausstieg unverändert wieder — sie
 * ist bereits heute in Kundenansicht sichtbar (Sidebar.tsx), also kein
 * neues client-facing Verhalten, nur ein neuer Ort. Neu ist die Erzähl-
 * Leiste in der Mitte und die Option-Auswahl davor — dieselbe Auswahl-
 * Semantik, die S4Vergleich (Wave 1) schon eingeführt hat, jetzt an einer
 * Stelle, die JEDEN narrativen Abschnitt erreicht, nicht nur einen.
 */
function PresentationBar({
  projectName, projectCity, sections, activeSection, onNavigate,
  candidates, currentId, onSwitch, onExit, modeRef,
}: {
  projectName: string
  projectCity?: string
  sections: Array<{ id: string; label: string }>
  activeSection: string
  onNavigate?: (id: string) => void
  candidates: Candidate[]
  currentId: string | null
  onSwitch: (id: string) => void
  onExit: () => void
  modeRef: RefObject<HTMLButtonElement>
}) {
  const tx = useTx()
  const current = candidates.find((c) => c.id === currentId)

  return (
    <nav aria-label={tx('Präsentation')}
         className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-strong bg-surface-default px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-body font-bold text-text-primary">{projectName}</p>
        {projectCity && <p className="text-small text-text-secondary">{projectCity}</p>}
      </div>

      {sections.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1" role="list">
          {sections.map((sec) => (
            <li key={sec.id}>
              <button
                type="button"
                onClick={() => onNavigate?.(sec.id)}
                aria-current={activeSection === sec.id ? 'true' : undefined}
                className={'hit-target a3-presentation-tab' + (
                  activeSection === sec.id ? ' a3-presentation-tab-current' : ''
                )}
              >
                {sec.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {candidates.length >= 2 && current && (
          <OptionSwitcher candidates={candidates} currentId={current.id} onSwitch={onSwitch} />
        )}
        <OutputProfileSwitch
          compact
          mode="praesentation"
          onCheck={() => {}}
          onExit={onExit}
          checkButtonRef={modeRef}
        />
      </div>
    </nav>
  )
}

/** Dieselbe Auswahl-Semantik wie S4Vergleich (Wave 1): SegmentedControl bis
 *  3 Optionen (LOCALE-004), sonst kanonisches SelectField — nur an einer
 *  Stelle wiederverwendet, die die GESAMTE Erzählung erreicht. */
function OptionSwitcher({ candidates, currentId, onSwitch }: {
  candidates: Candidate[]
  currentId: string
  onSwitch: (id: string) => void
}) {
  const tx = useTx()
  const current = candidates.find((c) => c.id === currentId)!
  const segments = candidates.map((c) => ({
    value: c.id,
    label: `${c.name} · ${money(c.p.result.total.exact)}${NNBSP}€`,
  }))

  return (
    <div>
      {segments.length <= 3 ? (
        <SegmentedControl
          layout="inline"
          legend={tx('Wird präsentiert')}
          value={currentId}
          onChange={onSwitch}
          options={segments}
        />
      ) : (
        <SelectField
          label={tx('Wird präsentiert')}
          value={currentId}
          onChange={(event) => onSwitch(event.target.value)}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {money(c.p.result.total.exact)}{NNBSP}€
            </option>
          ))}
        </SelectField>
      )}
      {/* Eine knappe polite-Ansage pro Wechsel (a11y-Vertrag) — kein
          Wert-für-Wert-Rieseln. */}
      <p className="sr-only" aria-live="polite">
        {`${tx('Wird präsentiert')}: ${current.name} · ${money(current.p.result.total.exact)}${NNBSP}€`}
      </p>
    </div>
  )
}

/** §1 PROJEKT — Identitäts-Auftakt: `PageHeader`'s eigenes `<h1 data-page-
 *  heading>` ist die einzige Seitenüberschrift der ganzen Präsentation
 *  (Fokusziel bei Modus-Eintritt, App.tsx's bestehender Effekt greift
 *  unverändert). Standort, Medienrahmen, kompakte Kennzahlenreihe. */
function SectionProjekt({ opportunity, current }: {
  opportunity: { name: string; city?: string } | undefined
  current: Candidate
}) {
  const tx = useTx()
  const buildingCount = includedBuildingIdsOf(current.cfg).length
  const projectName = opportunity?.name ?? current.name

  return (
    <section id="presentation-projekt" aria-label={projectName}>
      <PageHeader title={projectName} meta={opportunity?.city} />
      <div className="mt-4">
        <MediaFrame ratio="pano" state="fallback" seed={projectName} fallbackLabel={projectName} />
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <dt className="a3-cap">{tx('Gebäude')}</dt>
          <dd className="numeric text-body font-medium text-text-primary">{buildingCount}</dd>
        </div>
        <div>
          <dt className="a3-cap">{tx('WFL nach WoFlV')}</dt>
          <dd className="numeric text-body font-medium text-text-primary">
            {formatDE(current.cfg.fields.wfl.value, 0)}{NNBSP}m²
          </dd>
        </div>
        <div>
          <dt className="a3-cap">{tx('Wohneinheiten')}</dt>
          <dd className="numeric text-body font-medium text-text-primary">
            {formatDE(current.cfg.fields.we.value, 0)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** §2 UMFANG — Scope-Story: Gebäude, Leistungsumfang, ruhige Annahmen. */
function SectionUmfang({ current }: { current: Candidate }) {
  const t = useT()
  const tx = useTx()
  const includedIds = includedBuildingIdsOf(current.cfg)
  const includedGroups = (Object.keys(current.p.kgSplit) as Array<keyof typeof current.p.kgSplit>)
    .filter((g) => current.p.kgSplit[g]?.greaterThan(0))
    .map((g) => t(`costGroup.${g}`))
  // Annahmen (rule 10: nicht erfunden — nur bereits berechnete
  // Rundungs-/Herkunftshinweise, die `present()` für den Hero ohnehin
  // trägt; präsent, aber nicht dominierend, in einem stillen Disclosure.
  const heroDisclosure = present(current.p.result.total.exact).disclosure

  return (
    <SectionSheet id="presentation-umfang" title={tx('Umfang')} className="mt-8">
      <div>
        <p className="a3-cap">{tx('Gebäude im Angebot')}</p>
        <p className="mt-1 flex flex-wrap gap-2">
          {includedIds.map((id) => (
            <span key={id} className="border border-border-default px-2 py-1 text-small text-text-secondary">
              {current.cfg.buildings[id]?.stableName ?? id}
            </span>
          ))}
        </p>
      </div>

      {includedGroups.length > 0 && (
        <p className="mt-3 text-body text-text-secondary">
          {tx('Enthalten:')} {includedGroups.join(' · ')}
        </p>
      )}

      {heroDisclosure && (
        <details className="mt-3">
          <summary className="text-small text-text-secondary">{tx('Annahmen')}</summary>
          <p className="mt-1 text-small text-text-secondary">{heroDisclosure}</p>
        </details>
      )}
    </SectionSheet>
  )
}

/** §3 ERGEBNIS — die Bühne (rule 31 DC-38 Hierarchie), Kostentreiber-Auszug. */
function SectionErgebnis({ current }: { current: Candidate }) {
  const t = useT()
  const tx = useTx()
  const { p, cfg } = current
  // Dieselbe einfache, im Client-Modus bereits akzeptierte Bedingung wie
  // S4Vergleich (Wave 1) — keine zweite Interpretation von "unavailable"
  // erfinden.
  const priceUnavailable = p.result.total.exact.isZero()
  const hero = useMoneyCountUp(p.result.total.exact)
  const segments = buildKgCompositionSegments(p.kgSplit, (g) => t(`costGroup.${g}`))
  // Kostentreiber-Auszug (DC-44/rule 35): dieselbe Privacy-Projektion, die
  // OfferPanel schon für KG 800 nutzt — Summe der gezeigten Treiber bleibt
  // exakt gleich dem Total (rule 32), auch wenn KG 800 aggregiert wird.
  const clientDrivers = projectDriversForClient(p.result.drivers, 'praesentation', cfg.kg800ClientRevealed)
  const driversTotal = driversSum(clientDrivers)
  // SB-13 (backlog 2be8e69c, R-25): `computeProjection` prefixes a driver's
  // `key` with its building id whenever more than one building is included
  // (`${buildingId}:${d.key}`) — OfferPanel's rail already strips that
  // prefix before translating (so labels resolve instead of falling
  // through to raw German) and aggregates same-label siblings into ONE
  // summed row in Kundenansicht, so two buildings choosing the identical
  // "Energiestandard EH 55" never survive as an unlabelled, seemingly
  // duplicate pair that leaks per-building attribution the client was
  // never shown a name for. Same two steps, reproduced here rather than
  // reached into OfferPanel's private (unexported) helpers for — this
  // section only ever renders in Kundenansicht, so unlike OfferPanel's
  // version there is no intern-mode branch to preserve.
  const includedIds = includedBuildingIdsOf(cfg)
  const stripBuildingPrefix = (key: string): string => {
    if (includedIds.length <= 1) return key
    const owner = includedIds.find((id) => key.startsWith(`${id}:`))
    return owner ? key.slice(owner.length + 1) : key
  }
  const byLabel = new Map<string, { key: string; exact: Decimal }>()
  for (const d of clientDrivers) {
    const label = translatedDriverLabel({ ...d, key: stripBuildingPrefix(d.key) }, t)
    const existing = byLabel.get(label)
    if (existing) existing.exact = existing.exact.plus(d.exact)
    else byLabel.set(label, { key: label, exact: d.exact })
  }
  const topDrivers = [...byLabel.entries()]
    .map(([label, row]) => ({ label, exact: row.exact }))
    .sort((a, b) => b.exact.abs().minus(a.exact.abs()).toNumber())
    .slice(0, 5)
  // QA REWORK (rule 40, D-15): an inactive Regionalfaktor is a decided
  // fact about THIS calculation, not merely a Vorbereitung-only detail —
  // it must always appear as a "nicht aktiviert" row in Kostentreiber,
  // naming the amount it would have added, exactly like OfferPanel.tsx's
  // own row (same key, same formula — `p.result.bauwerk` × the catalog
  // factor minus one — reused verbatim, no new calculation invented).
  // This row was reachable and asserted in Kundenansicht before this
  // wave (OfferPanel's rail rendered it there); the simplified §3 extract
  // had silently dropped it — QA caught the regression live.
  const regionalFactorAmount = priceUnavailable
    ? t('money.priceNotDetermined')
    : moneyLabel(present(p.result.bauwerk.mul(CATALOG.regionalFactor.value.minus(1))))

  return (
    <SectionSheet id="presentation-ergebnis" title={tx('Ergebnis')} className="mt-8">
      <div className="a3-heroband">
        <div className="a3-hb a3-hb-total">
          <h3 className="a3-hb-cap">{tx(p.result.totalLabel)}</h3>
          {priceUnavailable ? (
            <PartialState label={t('money.priceNotDetermined')} consequence={p.result.totalLabel} />
          ) : (
            <p className="a3-hb-num numeric">
              {hero.prefix && <span aria-hidden="true">{hero.prefix}{NNBSP}</span>}
              {hero.display}
              <span className="a3-hb-unit">{NNBSP}€</span>
            </p>
          )}
          <p className="a3-cap mt-1">{tx('Schätzunsicherheit')} ±{NNBSP}{p.uncertaintyPp}{NNBSP}%</p>
        </div>
        {!priceUnavailable && <>
          <div className="a3-hb">
            <p className="a3-hb-num numeric">
              {p.leadRate.prefix && <span aria-hidden="true">{p.leadRate.prefix}{NNBSP}</span>}
              {p.leadRate.display}
              <span className="a3-hb-unit">{NNBSP}€/m²</span>
            </p>
            <span className="a3-hb-cap">{tx(p.leadRate.denominatorLabel)}</span>
          </div>
          <div className="a3-hb">
            <p className="a3-hb-num numeric">
              {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
              {p.duration.display.replace(`${NNBSP}Monate`, '')}
              <span className="a3-hb-unit">{NNBSP}Monate</span>
            </p>
            <span className="a3-hb-cap">
              {tx('ab OKBP')} · {tx('Fertigstellung')} {formatDate(p.duration.completionDate)}
            </span>
          </div>
        </>}
      </div>

      {segments.length > 0 && (
        <div className="mt-5">
          <p className="a3-cap">{tx('Kostengliederung')}</p>
          <div className="mt-2 a3-tbl-scroll">
            <CompositionBar segments={segments} total={p.result.total.exact} variant="compact"
                             incompleteLabel={t('money.priceNotDetermined')} />
          </div>
        </div>
      )}

      {topDrivers.length > 0 && !priceUnavailable && (
        <div className="mt-5">
          <p className="a3-cap">{tx('Kostentreiber')}</p>
          <ul className="mt-2">
            {topDrivers.map((d) => (
              <li key={d.label} className="flex justify-between gap-2 border-b border-border-subtle py-1 text-small">
                <span className="text-text-secondary">{d.label}</span>
                <span className="numeric shrink-0 text-text-primary">{money(d.exact)}{NNBSP}€</span>
              </li>
            ))}
          </ul>
          {!current.cfg.regionalfaktorActive && (
            <p className="mt-2 text-small text-text-secondary">
              {t('offer.drivers.regionalInactive', { amount: regionalFactorAmount })}
            </p>
          )}
          <p className="a3-cap mt-1">{tx('Summe der Treiber entspricht dem Gesamtergebnis:')} {money(driversTotal)}{NNBSP}€</p>
        </div>
      )}
    </SectionSheet>
  )
}

/** §4 ZEITPLAN — Leitgrößen als klientenlesbare Projekt-Story (headline
 *  facts pro AC: Fertigstellung + Bauzeit). Entfällt vollständig, wenn keine
 *  brauchbaren Termindaten existieren (Empty-State-Prinzip, rule 30) —
 *  Erzählkontinuität bleibt gewahrt, keine leere Sektion wird gerendert. */
function SectionZeitplan({ current }: { current: Candidate }) {
  const tx = useTx()
  const { p } = current
  if (!p.duration.completionDate) return null

  return (
    <SectionSheet id="presentation-zeitplan" title={tx('Zeitplan')} className="mt-8">
      <div className="a3-heroband">
        <div className="a3-hb">
          <p className="a3-hb-num numeric">
            {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
            {p.duration.display.replace(`${NNBSP}Monate`, '')}
            <span className="a3-hb-unit">{NNBSP}Monate</span>
          </p>
          <span className="a3-hb-cap">{tx('Bauzeit ab OKBP')}</span>
        </div>
        <div className="a3-hb">
          <p className="a3-hb-num numeric">{formatDate(p.duration.completionDate)}</p>
          <span className="a3-hb-cap">{tx('Fertigstellung')}</span>
        </div>
      </div>
    </SectionSheet>
  )
}

/** §5 OPTIONEN — nur mit ≥2 client-eligible Optionen: kompakte Auswahlkarten
 *  (Identität, Hero-Wert, Gebäude, KG-Unterschied), niemals eine Empfehlung. */
function SectionOptionen({ candidates, currentId, onSwitch }: {
  candidates: Candidate[]
  currentId: string
  onSwitch: (id: string) => void
}) {
  const t = useT()
  const tx = useTx()

  return (
    <SectionSheet id="presentation-optionen" title={tx('Optionen')} className="mt-8">
      <ul className="grid gap-3 sm:grid-cols-2" role="list">
        {candidates.map((c) => {
          const selected = c.id === currentId
          const segments = buildKgCompositionSegments(c.p.kgSplit, (g) => t(`costGroup.${g}`))
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSwitch(c.id)}
                aria-pressed={selected}
                className={'hit-target a3-option-tile' + (selected ? ' a3-option-tile-selected' : '')}
              >
                <p className="text-body font-bold text-text-primary">{c.name}</p>
                <p className="mt-1 numeric text-metric-section font-bold text-text-primary">
                  {moneyLabel(present(c.p.result.total.exact))}
                </p>
                <p className="mt-1 text-small text-text-secondary">{buildingNames(c.cfg)}</p>
                {segments.length > 0 && (
                  <div className="mt-2">
                    <CompositionBar segments={segments} total={c.p.result.total.exact} variant="compact"
                                     incompleteLabel={t('money.priceNotDetermined')} />
                  </div>
                )}
                {selected && (
                  <p className="mt-2 text-small font-medium text-text-primary">
                    <span aria-hidden="true">✓ </span>{tx('Wird präsentiert')}
                  </p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </SectionSheet>
  )
}

/** §6 ANGEBOT — Erzählung endet als kompakte Zusammenfassung, KEIN
 *  Versand-Formular (das bleibt Wave 2b/S5Export — AC-43-Trap). */
function SectionAngebot({ current }: { current: Candidate }) {
  const tx = useTx()
  const { p } = current
  const priceUnavailable = p.result.total.exact.isZero()

  return (
    <SectionSheet id="presentation-angebot" title={tx('Angebot')} className="mt-8">
      <div>
        <Badge sign="●" kind="metadata">{current.name}</Badge>
      </div>
      {/* `.numeric` right-aligns (tabular-nums context) — correct inside a
          constrained cell, but this paragraph spans the section's full
          width with nothing to align against, which pushed the value to
          the far edge. `inline-block` shrinks the box to its own content
          first, so the alignment has nothing left to do. */}
      <div className="mt-3 inline-block">
        <p className="numeric text-metric-section font-bold text-text-primary">
          {priceUnavailable ? tx('Preis nicht ermittelt') : moneyLabel(present(p.result.total.exact))}
        </p>
      </div>
      <p className="mt-1 text-body text-text-secondary">{buildingNames(current.cfg)}</p>
    </SectionSheet>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
