import type { Ref } from 'react'
import { Decimal } from 'decimal.js'
import {
  clientSchedulePhases,
  clientScheduleDerivation,
  useStore,
  type ClientScenarioSnapshot,
} from '../state/store'
import type { SavedOptionVersion } from '../state/optionSave'
import type { ScopeBuilding } from '../state/optionBuildingScope'
import { scopeMetricValue } from '../state/optionBuildingScope'
import { KG_SCOPE_GROUPS, chapterOf, kgCatalogue } from '../engine/kgConfiguration'
import { projectAsset } from '../assets/project-media'
import { MediaFrame } from '../design-system/MediaFrame'
import { CommercialNumber } from '../design-system/CommercialNumber'
import { useT } from '../i18n'
import { Button } from './primitives'

/**
 * VR3-05 — THE CLIENT NARRATIVE.
 *
 * Six sections, in the order a client understands a project rather than the
 * order the internal workflow built it:
 *
 *   PROJECT → BUILDINGS → SCOPE → SERVICES → SCHEDULE → INVESTMENT
 *
 * The preparation journey runs the other way round — scope decisions before
 * buildings, KG order 200…700, money last as a consequence. That order is
 * correct for the person assembling the offer and wrong for the person
 * hearing it: a client needs to know WHAT this is and WHERE it stands before
 * a cost group means anything. The two orders are allowed to differ because
 * they answer different questions, and this module is where the second one
 * is written down.
 *
 * ## Everything reads the presented snapshot
 *
 * Every page takes its numbers, buildings, services and schedule from ONE
 * `ClientScenarioSnapshot` — the state the presentation is currently showing,
 * baseline or scenario. That is what makes a what-if recompose the STORY and
 * not just the total: the services page, the schedule page and the
 * investment page are three readings of the same object, so they cannot
 * disagree about which decisions are in force. A page that reached into the
 * store for its own copy would be the "one number, two meanings" defect the
 * programme has recorded twice already.
 *
 * ## Client-safe by absence
 *
 * There is no internal identifier, confidence value, OCR diagnostic, CRM
 * field or private note in this file — not hidden with CSS, not filtered out
 * at render time: ABSENT from what these components are given. The Option's
 * id is never rendered; its NAME is, because a client is told which offer
 * they are looking at. Asset ids reach the DOM only through `MediaFrame`'s
 * `sourceId` data attribute, which is audit tooling and not client content.
 */

/* ────────────────────────────── the sections ─────────────────────────── */

export const NARRATIVE_SECTIONS = [
  'project', 'buildings', 'scope', 'services', 'schedule', 'investment',
] as const

export type NarrativeSectionId = typeof NARRATIVE_SECTIONS[number]

export const SECTION_LABEL_KEY: Record<NarrativeSectionId, string> = {
  project: 'vr3.client.nav.project',
  buildings: 'vr3.client.nav.buildings',
  scope: 'vr3.client.nav.scope',
  services: 'vr3.client.nav.services',
  schedule: 'vr3.client.nav.schedule',
  investment: 'vr3.client.nav.investment',
}

/**
 * Everything the narrative needs, resolved once by the shell.
 *
 * A single prop rather than six: the pages must be reading ONE state, and a
 * type that can only be constructed whole is how that is enforced rather
 * than asked for.
 */
export type ClientView = {
  optionName: string
  savedVersion: SavedOptionVersion | null
  /** The state being shown: the saved baseline, or the scenario. */
  presented: ClientScenarioSnapshot
  /** The saved baseline, always — the authority the presentation speaks for. */
  baseline: ClientScenarioSnapshot
  projectName: string
  projectHeroAssetId: string | null
  language: 'de' | 'en'
}

/* ───────────────────────────── shared pieces ─────────────────────────── */

/**
 * One narrative section, as a LANDMARK.
 *
 * `aria-label` carries the same word the rail carries, so moving through the
 * story announces WHERE the reader now is — the ticket's "section nav is
 * keyboard operable and announces location". Meeting-scale type does not
 * replace semantics; this is the semantics.
 */
function PageFrame({ children, label }: {
  children: React.ReactNode
  label: string
}) {
  return (
    <section aria-label={label} className="a3-client-page">
      {children}
    </section>
  )
}

function PageLede({ eyebrow, title, headingRef, lede }: {
  eyebrow: string
  title: string
  headingRef: Ref<HTMLHeadingElement>
  lede?: string
}) {
  return (
    <header className="a3-client-lede">
      <p className="a3-client-eyebrow">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="a3-client-title">{title}</h1>
      {lede ? <p className="a3-client-sub">{lede}</p> : null}
    </header>
  )
}

/** A white editorial panel. The narrative's only container. */
export function ClientPanel({ title, children, className }: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <article className={`a3-client-panel${className ? ` ${className}` : ''}`}>
      {title ? <h2 className="a3-client-panel-title">{title}</h2> : null}
      {children}
    </article>
  )
}

/** A label/value row. The narrative's only table. */
export function ClientFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="a3-client-row">
      <span className="a3-client-row-label">{label}</span>
      <span className="a3-client-row-value numeric">{value}</span>
    </div>
  )
}

function metricNumber(value: string | null): Decimal | null {
  if (value === null) return null
  const parsed = new Decimal(value)
  return parsed.isZero() ? null : parsed
}

function areaText(value: string | null, language: 'de' | 'en'): string {
  const exact = metricNumber(value)
  if (exact === null) return '—'
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    maximumFractionDigits: 0,
  }).format(exact.toNumber()) + ' ' + 'm²'
}

function monthsText(halfMonths: number | null, language: 'de' | 'en'): string {
  if (halfMonths === null) return '—'
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    maximumFractionDigits: 1,
  }).format(halfMonths / 2)
}

function dateText(iso: string | null, language: 'de' | 'en'): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

/** The buildings the presented Option actually sells. */
function selectedBuildingsOf(view: ClientView): readonly ScopeBuilding[] {
  const config = view.presented.config
  return config.scopeBuildings.filter((b) => config.scopeSelected[b.id])
}

/* ─────────────────────── §0 · entry (T-034) ───────────────────────────── */

/**
 * The mode transition, as a screen rather than a fade.
 *
 * Client Mode is a client-safety boundary, and a boundary the presenter
 * crosses without noticing is not a boundary. This names the saved Option
 * being presented, states what is excluded, and asks for one deliberate
 * action — which is also the moment the room's attention is on the screen
 * for the first time, so it is composed to be looked at.
 */
export function PresentationEntry({ view, onStart, onReturn, headingRef }: {
  view: ClientView
  onStart: () => void
  onReturn: () => void
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const asset = view.projectHeroAssetId ? projectAsset(view.projectHeroAssetId) : null
  return (
    <section className="a3-client-entry a3-stage-deep">
      <div className="a3-client-entry-media">
        {asset ? (
          <MediaFrame
            ratio="hero" state="loaded" src={asset.url} alt={t(asset.altKey)}
            seed={asset.assetId} sourceId={asset.assetId}
          />
        ) : (
          <MediaFrame
            ratio="hero" state="fallback" seed={view.projectName}
            fallbackLabel={t('vr3.client.media.missing')}
          />
        )}
      </div>
      <div className="a3-client-entry-copy">
        <p className="a3-client-eyebrow">{t('vr3.client.entry.eyebrow')}</p>
        <h1 ref={headingRef} tabIndex={-1} className="a3-client-entry-title">
          {t('vr3.client.entry.title')}
        </h1>
        <p className="a3-client-entry-lede">{t('vr3.client.entry.lede')}</p>
        <ul className="a3-client-entry-checks" role="list">
          <li>
            <span aria-hidden="true" className="a3-client-check">✓</span>
            {t('vr3.client.entry.check.baseline', { option: view.optionName })}
          </li>
          <li>
            <span aria-hidden="true" className="a3-client-check">✓</span>
            {t('vr3.client.entry.check.projection')}
          </li>
          <li>
            <span aria-hidden="true" className="a3-client-check">✓</span>
            {t('vr3.client.entry.check.scenario')}
          </li>
        </ul>
        <div className="a3-client-entry-actions">
          <Button variant="primary" onClick={onStart}>
            {t('vr3.client.entry.start')}
          </Button>
          <Button variant="secondary" onClick={onReturn}>
            {t('vr3.client.entry.return')}
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────── §1 · project identity (T-035) ────────────────────── */

export function PageProjectIdentity({ view, headingRef }: {
  view: ClientView
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const s = useStore()
  const asset = view.projectHeroAssetId ? projectAsset(view.projectHeroAssetId) : null
  const buildings = selectedBuildingsOf(view)
  const bgf = buildings.reduce((sum, b) => {
    const value = scopeMetricValue(view.presented.config, b, 'bgfRSAbove')
    return value === null ? sum : sum.plus(new Decimal(value))
  }, new Decimal(0))
  const derivation = clientScheduleDerivation(s, view.presented)

  return (
    <section aria-label={t('vr3.client.nav.project')} className="a3-client-hero a3-stage-deep">
      <div className="a3-client-hero-media">
        {asset ? (
          <MediaFrame
            ratio="hero" state="loaded" src={asset.url} alt={t(asset.altKey)}
            seed={asset.assetId} sourceId={asset.assetId}
          />
        ) : (
          <MediaFrame
            ratio="hero" state="fallback" seed={view.projectName}
            fallbackLabel={t('vr3.client.media.missing')}
          />
        )}
      </div>
      <div className="a3-client-hero-copy">
        <p className="a3-client-eyebrow">
          {t('vr3.client.identity.eyebrow', { option: view.optionName })}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="a3-client-hero-title">
          {view.projectName}
        </h1>
        <p className="a3-client-hero-lede">
          {t(buildings.length > 1
            ? 'vr3.client.identity.lede.complex'
            : 'vr3.client.identity.lede.single', { count: buildings.length })}
        </p>
        <dl className="a3-client-hero-metrics">
          <div>
            <dt>{t('vr3.client.identity.metric.buildings')}</dt>
            <dd className="numeric">{buildings.length}</dd>
          </div>
          <div>
            <dt>{t('vr3.client.identity.metric.bgf')}</dt>
            <dd className="numeric">{areaText(bgf.toFixed(2), view.language)}</dd>
          </div>
          <div>
            <dt>{t('vr3.client.identity.metric.completion')}</dt>
            <dd className="numeric">
              {dateText(derivation?.completionISO ?? null, view.language)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

/* ────────────────────── §2 · building stories (T-036) ─────────────────── */

export function PageBuildings({ view, headingRef }: {
  view: ClientView
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const buildings = selectedBuildingsOf(view)
  return (
    <PageFrame label={t('vr3.client.nav.buildings')}>
      <PageLede
        eyebrow={t('vr3.client.buildings.eyebrow')}
        title={t(buildings.length > 1
          ? 'vr3.client.buildings.title.many'
          : 'vr3.client.buildings.title.one')}
        headingRef={headingRef}
      />
      <div
        className="a3-client-building-grid"
        data-count={Math.min(buildings.length, 3)}
      >
        {buildings.map((building, index) => {
          const asset = projectAsset(building.identityAssetId)
          // The same A/B/C designation the preparation surface uses — a
          // building's IDENTITY in this project, derived from its position
          // in the Option's own scope, never its internal id. The site plan
          // and the schedule name the same letters, so the client can follow
          // one building across three sections.
          const mark = String.fromCharCode(65 + index)
          return (
            <article key={building.id} className="a3-client-building">
              <div className="a3-client-building-media">
                {asset ? (
                  <MediaFrame
                    ratio="card" state="loaded" src={asset.url} alt={t(asset.altKey)}
                    seed={asset.assetId} sourceId={asset.assetId}
                  />
                ) : (
                  <MediaFrame
                    ratio="card" state="fallback" seed={building.id}
                    fallbackLabel={t('vr3.client.media.missing')}
                  />
                )}
              </div>
              <div className="a3-client-building-copy">
                <p className="a3-client-eyebrow">
                  {t('vr3.scope.building', { mark })}
                </p>
                <h2 className="a3-client-building-name">
                  {`${mark} · ${building.name}`}
                </h2>
                <p className="a3-client-building-use">{t(building.usageKey)}</p>
                <p className="a3-client-building-metric numeric">
                  {areaText(
                    scopeMetricValue(view.presented.config, building, 'bgfRSAbove'),
                    view.language,
                  )}
                  {' '}
                  <span className="a3-client-building-metric-unit">
                    {t('vr3.client.buildings.metricLabel')}
                  </span>
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </PageFrame>
  )
}

/* ────────────────────────── §3 · scope (T-037) ────────────────────────── */

export function PageScopeStory({ view, headingRef }: {
  view: ClientView
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const s = useStore()
  const catalogue = kgCatalogue(s.opportunityId)
  const decisions = view.presented.config.kgConfig
  const asset = view.projectHeroAssetId ? projectAsset(view.projectHeroAssetId) : null
  const buildings = selectedBuildingsOf(view)

  const rows = KG_SCOPE_GROUPS.map((group) => {
    const chapter = catalogue ? chapterOf(catalogue, group) : null
    return {
      group,
      title: chapter
        ? (view.language === 'en' ? chapter.titleEn : chapter.titleDe)
        : group.replace('_', ' '),
      decision: decisions?.scope[group] ?? 'undecided',
    }
  })
  const included = rows.filter((r) => r.decision === 'included')
  const excluded = rows.filter((r) => r.decision === 'excluded')

  return (
    <PageFrame label={t('vr3.client.nav.scope')}>
      <PageLede
        eyebrow={t('vr3.client.scope.eyebrow', { option: view.optionName })}
        title={t('vr3.client.scope.title')}
        headingRef={headingRef}
      />
      <div className="a3-client-split">
        <ClientPanel title={t('vr3.client.scope.included')}>
          <div className="a3-client-rows">
            {included.map((row) => (
              <ClientFactRow
                key={row.group}
                label={row.title}
                value={t('vr3.client.scope.state.included')}
              />
            ))}
          </div>
          {excluded.length > 0 ? (
            <>
              <h3 className="a3-client-panel-subtitle">
                {t('vr3.client.scope.excluded')}
              </h3>
              <div className="a3-client-rows">
                {excluded.map((row) => (
                  <ClientFactRow
                    key={row.group}
                    label={row.title}
                    value={t('vr3.client.scope.state.excluded')}
                  />
                ))}
              </div>
            </>
          ) : null}
        </ClientPanel>
        <ClientPanel title={t('vr3.client.scope.meaning')}>
          <p className="a3-client-prose">
            {t(included.length === KG_SCOPE_GROUPS.length
              ? 'vr3.client.scope.meaning.complete'
              : 'vr3.client.scope.meaning.partial', { count: buildings.length })}
          </p>
          <div className="a3-client-panel-media">
            {asset ? (
              <MediaFrame
                ratio="pano" state="loaded" src={asset.url} alt={t(asset.altKey)}
                seed={asset.assetId} sourceId={asset.assetId}
              />
            ) : (
              <MediaFrame
                ratio="pano" state="fallback" seed={view.projectName}
                fallbackLabel={t('vr3.client.media.missing')}
              />
            )}
          </div>
        </ClientPanel>
      </div>
    </PageFrame>
  )
}

/* ───────────────────────── §5 · schedule (T-039) ──────────────────────── */

const PHASE_LABEL_KEY: Record<string, string> = {
  planning: 'vr3.client.schedule.phase.planning',
  tender: 'vr3.client.schedule.phase.tender',
  execution: 'vr3.client.schedule.phase.execution',
  handover: 'vr3.client.schedule.phase.handover',
}

export function PageScheduleStory({ view, headingRef, decision }: {
  view: ClientView
  headingRef: Ref<HTMLHeadingElement>
  /** The handover what-if, rendered inside the sequence it changes. */
  decision?: React.ReactNode
}) {
  const t = useT()
  const s = useStore()
  const derivation = clientScheduleDerivation(s, view.presented)
  const phases = clientSchedulePhases(s, view.presented)
  const buildings = selectedBuildingsOf(view)
  const nameOf = (buildingId: string | null) =>
    buildings.find((b) => b.id === buildingId)?.name ?? ''
  const criticalPhase = phases.find((p) => p.id === derivation?.criticalPhaseId)
  /**
   * WHAT determines completion, not WHICH ROW is last.
   *
   * The critical phase is usually the handover, and "the handover
   * determines completion" is true and says nothing — the handover is the
   * end by definition. What a client needs is the building the handover is
   * waiting for, which is exactly what its dependency names. This is also
   * what makes the phased-handover what-if visible in words: change which
   * building the handover follows and this sentence changes with it.
   */
  const criticalDriver = criticalPhase && !criticalPhase.buildingId
    ? phases.find((p) => p.id === criticalPhase.dependsOn) ?? criticalPhase
    : criticalPhase

  return (
    <PageFrame label={t('vr3.client.nav.schedule')}>
      <PageLede
        eyebrow={t('vr3.client.schedule.eyebrow', { option: view.optionName })}
        title={t('vr3.client.schedule.title', {
          completion: dateText(derivation?.completionISO ?? null, view.language),
        })}
        headingRef={headingRef}
      />
      <div className="a3-client-split">
        <ClientPanel>
          <p className="a3-client-bignumber numeric">
            {monthsText(derivation?.totalHalfMonths ?? null, view.language)}
          </p>
          <p className="a3-client-prose">{t('vr3.client.schedule.duration')}</p>
          <div className="a3-client-rows a3-client-rows-loose">
            <div className="a3-client-stack">
              <span className="a3-client-stack-value numeric">
                {dateText(derivation?.startISO ?? null, view.language)}
              </span>
              <span className="a3-client-stack-label">
                {t('vr3.client.schedule.start')}
              </span>
            </div>
            <div className="a3-client-stack">
              <span className="a3-client-stack-value numeric">
                {dateText(derivation?.completionISO ?? null, view.language)}
              </span>
              <span className="a3-client-stack-label">
                {t('vr3.client.schedule.completion')}
              </span>
            </div>
          </div>
        </ClientPanel>
        <ClientPanel title={t('vr3.client.schedule.sequence')}>
          <div className="a3-client-rows">
            {phases.map((phase) => {
              const window = derivation?.windows.find((w) => w.phase.id === phase.id)
              const label = phase.buildingId
                ? `${t(PHASE_LABEL_KEY[phase.kind] ?? phase.kind)} · ${nameOf(phase.buildingId)}`
                : t(PHASE_LABEL_KEY[phase.kind] ?? phase.kind)
              return (
                <ClientFactRow
                  key={phase.id}
                  label={label}
                  value={t('vr3.client.schedule.months', {
                    months: monthsText(
                      window ? window.phase.durationHalfMonths : phase.durationHalfMonths,
                      view.language,
                    ),
                  })}
                />
              )
            })}
          </div>
          {criticalPhase ? (
            <div className="a3-client-callout">
              <span aria-hidden="true" className="a3-client-callout-mark">→</span>
              <div>
                <p className="a3-client-callout-title">
                  {t('vr3.client.schedule.critical', {
                    phase: criticalDriver?.buildingId
                      ? nameOf(criticalDriver.buildingId)
                      : t(PHASE_LABEL_KEY[criticalDriver?.kind ?? 'handover']
                        ?? 'vr3.client.schedule.phase.handover'),
                  })}
                </p>
                <p className="a3-client-callout-body">
                  {t('vr3.client.schedule.criticalBody')}
                </p>
              </div>
            </div>
          ) : null}
          {decision}
        </ClientPanel>
      </div>
    </PageFrame>
  )
}

/* ──────────────────────── §6 · investment (T-040) ─────────────────────── */

export function PageInvestment({ view, headingRef, onConclude, comparison }: {
  view: ClientView
  headingRef: Ref<HTMLHeadingElement>
  onConclude: () => void
  comparison?: React.ReactNode
}) {
  const t = useT()
  const s = useStore()
  const result = view.presented.result
  const derivation = clientScheduleDerivation(s, view.presented)
  const buildings = selectedBuildingsOf(view)
  const catalogue = kgCatalogue(s.opportunityId)

  return (
    <PageFrame label={t('vr3.client.nav.investment')}>
      <PageLede
        eyebrow={t('vr3.client.investment.eyebrow', { option: view.optionName })}
        title={t('vr3.client.investment.title')}
        headingRef={headingRef}
      />
      <div className="a3-client-split">
        <ClientPanel>
          <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
            {result.totalLabel}
          </p>
          <p className="a3-client-hero-number">
            <CommercialNumber
              exact={result.total.exact}
              displayed={result.total}
              language={view.language}
              emphasis="hero"
              className="a3-display-accent"
            />
          </p>
          <p className="a3-client-prose">
            {t('vr3.client.investment.uncertainty', { pp: result.uncertaintyPp })}
          </p>
          <dl className="a3-client-metric-grid">
            <div>
              {/* A rate without its denominator is a number nobody can check
                  (rule 39 / DATA-001): the label names the norm the
                  denominator comes from, and it comes from the rate itself
                  rather than being written here a second time. */}
              <dt>{result.leadRate.denominatorLabel}</dt>
              <dd className="numeric">{result.leadRate.display}</dd>
            </div>
            <div>
              <dt>{t('vr3.client.investment.duration')}</dt>
              <dd className="numeric">
                {t('vr3.client.schedule.months', {
                  months: monthsText(derivation?.totalHalfMonths ?? null, view.language),
                })}
              </dd>
            </div>
            <div>
              <dt>{t('vr3.client.investment.buildings')}</dt>
              <dd className="numeric">{buildings.length}</dd>
            </div>
            <div>
              <dt>{t('vr3.client.investment.option')}</dt>
              <dd>{view.optionName}</dd>
            </div>
          </dl>
        </ClientPanel>
        <ClientPanel title={t('vr3.client.investment.composition')}>
          <div className="a3-client-rows">
            {result.byCostGroup.map((line) => {
              // `CostGroup` is wider than the six SCOPE groups (it carries
              // KG 100, which the Option's ledger does not decide), so the
              // chapter lookup is guarded rather than cast.
              const scopeGroup = (KG_SCOPE_GROUPS as readonly string[])
                .includes(line.group)
                ? line.group as typeof KG_SCOPE_GROUPS[number]
                : null
              const chapter = catalogue && scopeGroup
                ? chapterOf(catalogue, scopeGroup)
                : null
              return (
                <div key={line.group} className="a3-client-row">
                  <span className="a3-client-row-label">
                    {chapter
                      ? (view.language === 'en' ? chapter.titleEn : chapter.titleDe)
                      : line.group.replace('_', ' ')}
                  </span>
                  <span className="a3-client-row-value numeric">
                    <CommercialNumber
                      exact={line.exact}
                      language={view.language}
                      emphasis="compact"
                      absentLabel={t('vr3.client.investment.notPriced')}
                    />
                  </span>
                </div>
              )
            })}
          </div>
          {comparison}
          <div className="a3-client-panel-actions">
            <Button variant="primary" onClick={onConclude}>
              {t('vr3.client.investment.conclude')}
            </Button>
          </div>
        </ClientPanel>
      </div>
    </PageFrame>
  )
}

export { PageFrame, PageLede, areaText, monthsText, dateText, selectedBuildingsOf }
