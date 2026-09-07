import type { ReactNode, Ref } from 'react'
import type {
  ClientBuilding,
  ClientMetric,
  ClientProposal,
} from '../state/clientProposal'
import { MediaFrame } from '../design-system/MediaFrame'
import { CommercialNumber } from '../design-system/CommercialNumber'
import { DataTable, type DataTableRow } from '../design-system/DataTable'
import { EstimateUncertaintyBadge } from './EstimateUncertaintyBadge'
import { localizeMoneyText, useT } from '../i18n'

/**
 * VR3-CP-00 — THE CLIENT NARRATIVE, chapters 1–4.
 *
 * ## What changed, and why
 *
 * The surface this replaces was an internal product screen with a client
 * banner over it. Its first client-visible screen was an internal hygiene
 * notice — an eyebrow reading `VORBEREITUNG → KUNDENPRÄSENTATION`, a
 * headline about showing a saved Option rather than the working state, and a
 * checklist naming preparation vocabulary — under a live region announcing
 * that the client is looking at this screen. The price was chapter 6 of 6.
 * There was no address, no offer date and no legal entity anywhere.
 *
 * The order is now the order a proposal is actually made:
 *
 * ```
 * 1 ANGEBOT       who this is for, and what it is
 * 2 ÜBERBLICK     what it costs — early, at full scale
 * 3 DAS PROJEKT   what we understood
 * 4 DIE GEBÄUDE   how it is made up            (≥ 2 buildings)
 * ```
 *
 * ## One reading of one model
 *
 * Every chapter takes a `ClientProposal` and nothing else — no store, no
 * engine, no catalogue. The live stage and the printed sheet are two
 * renderings of the same object, so they cannot disagree about a fact
 * neither of them computes. Anything absent from that object is absent from
 * the client's screen by construction, which is the only form of the
 * client-safety boundary that survives a new field being added upstream.
 */

/* ───────────────────────────── shared pieces ─────────────────────────── */

/** One chapter, as a landmark carrying the name the rail carries. */
export function ChapterFrame({ children, label, tone }: {
  children: ReactNode
  label: string
  tone?: 'ground' | 'stage'
}) {
  return (
    <section
      aria-label={label}
      className={tone === 'stage' ? 'a3-cp-chapter a3-cp-chapter-stage' : 'a3-cp-chapter'}
    >
      {children}
    </section>
  )
}

export function ChapterLede({ eyebrow, title, headingRef, lede }: {
  eyebrow: string
  title: string
  headingRef: Ref<HTMLHeadingElement>
  lede?: string
}) {
  return (
    <header className="a3-cp-lede">
      <p className="a3-cp-eyebrow">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="a3-cp-title">{title}</h1>
      {lede ? <p className="a3-cp-sub">{lede}</p> : null}
    </header>
  )
}

export function ClientPanel({ title, children, className }: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <article className={className ? `a3-cp-panel ${className}` : 'a3-cp-panel'}>
      {title ? <h2 className="a3-cp-panel-title">{title}</h2> : null}
      {children}
    </article>
  )
}

export function ClientFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="a3-cp-row">
      <span className="a3-cp-row-label">{label}</span>
      <span className="a3-cp-row-value numeric">{value}</span>
    </div>
  )
}

/**
 * A co-hero metric (DC-38 / rule 31).
 *
 * Three sizes and no more: `lead` is the single brand-accent total at 64 px,
 * `co` is a black 48 px co-hero, `fact` is a supporting statement. The
 * defect this replaces rendered the lead rate and the Bauzeit at 16 px with
 * 14 px labels — key metrics at footnote size, beside a correct 64 px total.
 *
 * The unit sits on the same baseline at a smaller size, never on its own
 * line and never in a footnote.
 */
export function MetricHero({ variant, label, value, unit, note, accent }: {
  variant: 'lead' | 'co' | 'fact'
  label: string
  value: string
  unit?: string | null
  note?: string | null
  accent?: boolean
}) {
  const valueClass = variant === 'lead'
    ? 'a3-cp-metric-lead numeric'
    : variant === 'co' ? 'a3-cp-metric-co numeric' : 'a3-cp-metric-fact'
  return (
    <div className="a3-cp-metric">
      <p className="a3-cp-metric-label">{label}</p>
      <p className={accent ? `${valueClass} a3-display-accent` : valueClass}>
        {value}
        {unit ? <span className="a3-cp-metric-unit">{unit}</span> : null}
      </p>
      {note ? <p className="a3-cp-metric-note">{note}</p> : null}
    </div>
  )
}

function dateText(iso: string | null, language: 'de' | 'en'): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

/* ───────────────────── chapter 1 · Angebot (F01) ─────────────────────── */

/**
 * The opening. A client must recognise their own project before a single
 * commercial detail appears — which is why this is a full-bleed image with
 * the identity set on it, and why nothing about All3's preparation process
 * survives entry.
 *
 * With no qualifying hero asset this renders `MediaFrame`'s designed
 * fallback state, which is information-bearing. Never a grey rectangle.
 */
export function ChapterAngebot({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { identity } = proposal
  const offerDate = dateText(identity.offerDateISO, proposal.language)
  return (
    <ChapterFrame label={t('vr3.client.chapter.angebot')} tone="stage">
      <div className="a3-cp-opening">
        <div className="a3-cp-opening-media">
          {identity.hero ? (
            <MediaFrame
              ratio="hero" state="loaded" src={identity.hero.url}
              alt={identity.heroAlt ?? identity.projectName}
              seed={identity.hero.assetId} sourceId={identity.hero.assetId}
            />
          ) : (
            <MediaFrame
              ratio="hero" state="fallback" seed={identity.projectName}
              fallbackLabel={identity.projectName}
            />
          )}
        </div>
        <div className="a3-cp-opening-copy">
          <p className="a3-cp-opening-eyebrow">{t('vr3.client.opening.eyebrow')}</p>
          <h1 ref={headingRef} tabIndex={-1} className="a3-cp-opening-title">
            {identity.projectName}
          </h1>
          {identity.addressLine ? (
            <p className="a3-cp-opening-address">{identity.addressLine}</p>
          ) : null}
          <div className="a3-cp-opening-facts">
            {offerDate ? (
              <span className="a3-cp-opening-fact">
                {t('vr3.client.opening.offerDate')}
                {' '}
                <b>{offerDate}</b>
              </span>
            ) : null}
            <span className="a3-cp-opening-fact">
              {t('vr3.client.opening.option')}
              {' '}
              <b>{identity.optionName}</b>
            </span>
            {identity.clientName ? (
              <span className="a3-cp-opening-fact">
                {t('vr3.client.opening.client')}
                {' '}
                <b>{identity.clientName}</b>
              </span>
            ) : null}
            <span className="a3-cp-opening-entity">{identity.legalEntity}</span>
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}

/* ──────────────── chapter 2 · Projektüberblick (F02/F04) ─────────────── */

/**
 * The commercial climax, early.
 *
 * Three CO-HEROES, not a KPI grid (rule 31 / DC-38):
 *
 * - the total at 64 px in the brand accent, on white and only on white,
 *   labelled with the DERIVED R-18 signature;
 * - the lead rate at 48 px black, whose denominator names its norm inside
 *   the metric label — never a bare `2.350 €/m²`;
 * - the Bauzeit at 48 px black, with the SAME start boundary the internal
 *   cockpit uses and the absolute completion date.
 *
 * Supporting facts appear only where a real Product field exists. There is
 * no tile invented to fill the grid, and no marketing claim.
 */
export function ChapterUeberblick({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { commercial, schedule, language } = proposal
  const completion = dateText(schedule.completionISO, language)
  const totalText = localizeMoneyText(
    `${commercial.totalPrefix}${commercial.totalPrefix ? ' ' : ''}${commercial.totalDisplay}`,
    language,
  )
  const durationText = localizeMoneyText(
    `${schedule.durationPrefix}${schedule.durationPrefix ? ' ' : ''}${schedule.durationText}`,
    language,
  )

  return (
    <ChapterFrame label={t('vr3.client.chapter.ueberblick')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.ueberblick')}
        title={t('vr3.client.overview.title')}
        headingRef={headingRef}
      />
      <div className="a3-cp-heroes">
        <div className="a3-cp-hero-total">
          <MetricHero
            variant="lead"
            accent
            label={commercial.signature}
            value={totalText}
            unit="€"
          />
          <p className="a3-cp-hero-qualifier">
            {commercial.taxNote}
            {' · '}
            <EstimateUncertaintyBadge
              presentation="compact" pp={commercial.uncertaintyPp} language={language}
            />
          </p>
          {commercial.totalDisclosure ? (
            <p className="a3-cp-hero-footnote">{commercial.totalDisclosure}</p>
          ) : null}
        </div>
        <div className="a3-cp-hero-side">
          <MetricHero
            variant="co"
            label={commercial.leadRateLabel}
            value={localizeMoneyText(commercial.leadRateText, language)}
            note={commercial.taxNote}
          />
        </div>
        <div className="a3-cp-hero-side">
          <MetricHero
            variant="co"
            label={t('vr3.client.overview.duration')}
            value={durationText}
            note={completion
              ? `${schedule.startBoundary} · ${t('vr3.client.schedule.completion')} ${completion}`
              : schedule.startBoundary}
          />
        </div>
        {proposal.overview.map((metric: ClientMetric) => (
          <div key={metric.label} className="a3-cp-hero-fact">
            <MetricHero
              variant="fact"
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              note={metric.note}
            />
          </div>
        ))}
      </div>
      <p className="a3-cp-disclaimer">{t('vr3.client.overview.disclaimer')}</p>
    </ChapterFrame>
  )
}

/* ─────────────────── chapter 3 · Das Projekt (F03) ───────────────────── */

/**
 * What All3 understood, in client language.
 *
 * The metric rows carry their qualifier IN THE ROW LABEL — `BGF R+S
 * oberirdisch`, `WFL nach WoFlV`, `NUF nach DIN 277` — never in a footnote,
 * because a number whose denominator lives elsewhere is a number the reader
 * has to trust rather than read. The combined `Σ WFL + Σ NUF` never appears:
 * it is forbidden in every client profile.
 *
 * No extraction confidence, no conflict history, no authority state. A value
 * a machine inferred is either expressed in client language or omitted; it
 * is never shown as a confirmed fact, and the fact that a machine inferred
 * it is preparation state, not client content.
 */
export function ChapterProjekt({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { buildings, language } = proposal
  const sum = (pick: (b: ClientBuilding) => string | null) => {
    const values = buildings.map(pick).filter((v): v is string => v !== null)
    if (values.length === 0) return null
    const total = values.reduce((acc, v) => acc + Number(v.replace(/[.\s ]/g, '').replace(',', '.')), 0)
    return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(total)
  }
  const units = buildings.reduce((n, b) => (b.units === null ? n : n + b.units), 0)

  const rows: Array<[string, string | null]> = [
    [t('vr3.client.project.metric.buildings'), String(buildings.length)],
    [t('vr3.client.project.metric.storeys'),
      buildings.length === 1 ? buildings[0]!.storeys : null],
    [t('vr3.client.project.metric.units'), units > 0 ? String(units) : null],
    [t('vr3.client.project.metric.bgfR'), sum((b) => b.bgfRAbove)],
    [t('vr3.client.project.metric.bgfS'), sum((b) => b.bgfSAbove)],
    [t('vr3.client.project.metric.bgfRS'), sum((b) => b.bgfRSAbove)],
    [t('vr3.client.project.metric.bgfBelow'), sum((b) => b.bgfRSBelow)],
    [t('vr3.client.project.metric.wfl'), sum((b) => b.wfl)],
    [t('vr3.client.project.metric.nuf'), sum((b) => b.nuf)],
  ]

  return (
    <ChapterFrame label={t('vr3.client.chapter.projekt')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.projekt')}
        title={t(buildings.length > 1
          ? 'vr3.client.project.title.many'
          : 'vr3.client.project.title.one', { count: buildings.length })}
        headingRef={headingRef}
      />
      <div className="a3-cp-split">
        <ClientPanel className="a3-cp-panel-plain">
          <p className="a3-cp-prose">
            {t(buildings.length > 1
              ? 'vr3.client.project.lede.many'
              : 'vr3.client.project.lede.one', { count: buildings.length })}
          </p>
          <p className="a3-cp-prose">{t('vr3.client.project.method')}</p>
          {/*
            Construction reaches the project story as two named client-grade
            lines. A line whose answer differs by building carries its
            building: stating one façade for a three-building Option is
            false, and this is the only place that rule can be enforced.
          */}
          {proposal.construction.story.length > 0 ? (
            <div className="a3-cp-construction">
              <h2 className="a3-cp-panel-subtitle">
                {t('vr3.client.project.construction')}
              </h2>
              {proposal.construction.story.map((line) => (
                <div key={line.id} className="a3-cp-construction-line">
                  <span className="a3-cp-construction-label">
                    {line.label}
                    {line.buildingName ? (
                      <span className="a3-cp-construction-building">
                        {line.buildingName}
                      </span>
                    ) : null}
                  </span>
                  <span className="a3-cp-construction-value">
                    {line.stateText ?? line.value}
                  </span>
                  {line.consequence ? (
                    <span className="a3-cp-construction-note">{line.consequence}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </ClientPanel>
        <ClientPanel title={t('vr3.client.project.metrics')}>
          <div className="a3-cp-rows">
            {rows
              .filter((row): row is [string, string] => row[1] !== null)
              .map(([label, value]) => (
                <ClientFactRow key={label} label={label} value={value} />
              ))}
          </div>
        </ClientPanel>
      </div>
    </ChapterFrame>
  )
}

/* ─────────────────── chapter 4 · Die Gebäude (F09) ───────────────────── */

/**
 * Present only at two buildings or more — a single building has no
 * comparison to make and its facts belong in chapter 3.
 *
 * At 2–3 buildings the chapter is image-led, because at that count the
 * client is recognising three houses. At 4 or more it becomes the canonical
 * `DataTable` with a totals row, because at that count they are reading a
 * register. `BuildingScopePanel` is deliberately not reused: it is a scope
 * CONTROL, and a control on a client's screen invites an edit nobody meant.
 */
export function ChapterGebaeude({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { buildings } = proposal
  const asTable = buildings.length >= 4

  return (
    <ChapterFrame label={t('vr3.client.chapter.gebaeude')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.gebaeude')}
        title={t('vr3.client.buildings.title', { count: buildings.length })}
        headingRef={headingRef}
      />
      {asTable
        ? <BuildingRegister proposal={proposal} />
        : (
          <div className="a3-cp-building-grid" data-count={Math.min(buildings.length, 3)}>
            {buildings.map((b) => (
              <article key={b.id} className="a3-cp-building">
                <div className="a3-cp-building-media">
                  {b.identity ? (
                    <MediaFrame
                      ratio="card" state="loaded" src={b.identity.url}
                      alt={b.identityAlt ?? b.name} seed={b.identity.assetId}
                      sourceId={b.identity.assetId}
                    />
                  ) : (
                    <MediaFrame
                      ratio="card" state="fallback" seed={b.id} fallbackLabel={b.name}
                    />
                  )}
                </div>
                <div className="a3-cp-building-copy">
                  <h2 className="a3-cp-building-name">{`${b.mark} · ${b.name}`}</h2>
                  <p className="a3-cp-building-use">{b.usage}</p>
                  <div className="a3-cp-rows">
                    <ClientFactRow
                      label={t('vr3.client.project.metric.storeys')} value={b.storeys}
                    />
                    {b.units !== null ? (
                      <ClientFactRow
                        label={t('vr3.client.project.metric.units')}
                        value={String(b.units)}
                      />
                    ) : null}
                    {b.bgfRSAbove ? (
                      <ClientFactRow
                        label={t('vr3.client.project.metric.bgfRS')} value={b.bgfRSAbove}
                      />
                    ) : null}
                    {b.wfl ? (
                      <ClientFactRow
                        label={t('vr3.client.project.metric.wfl')} value={b.wfl}
                      />
                    ) : null}
                    {b.nuf ? (
                      <ClientFactRow
                        label={t('vr3.client.project.metric.nuf')} value={b.nuf}
                      />
                    ) : null}
                    {/*
                      The basement decision is a material scope boundary, not
                      a detail: a building with no underground level has no
                      basement decision at all, and saying so is what keeps a
                      reader from assuming one is included.
                    */}
                    <ClientFactRow
                      label={t('vr3.client.buildings.basement')}
                      value={b.basementText ?? ''}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
    </ChapterFrame>
  )
}

function BuildingRegister({ proposal }: { proposal: ClientProposal }) {
  const t = useT()
  const { buildings, language } = proposal
  const nf = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  const totalOf = (pick: (b: ClientBuilding) => string | null) => {
    const values = buildings.map(pick).filter((v): v is string => v !== null)
    if (values.length === 0) return null
    return nf.format(values.reduce(
      (acc, v) => acc + Number(v.replace(/[.\s ]/g, '').replace(',', '.')), 0))
  }
  const units = buildings.reduce((n, b) => (b.units === null ? n : n + b.units), 0)

  const rows: DataTableRow[] = buildings.map((b) => ({
    key: b.id,
    header: `${b.mark} · ${b.name}`,
    cells: [
      { content: b.usage },
      { content: b.storeys },
      { content: b.units === null ? null : String(b.units), align: 'numeric', absent: b.units === null },
      { content: b.bgfRSAbove ?? null, align: 'numeric', absent: b.bgfRSAbove === null },
      { content: b.wfl ?? b.nuf ?? null, align: 'numeric', absent: b.wfl === null && b.nuf === null },
    ],
  }))
  rows.push({
    key: 'total',
    header: t('vr3.client.buildings.total', { count: buildings.length }),
    variant: 'sum',
    cells: [
      { content: '' },
      { content: '' },
      { content: units > 0 ? String(units) : null, align: 'numeric', absent: units === 0 },
      { content: totalOf((b) => b.bgfRSAbove), align: 'numeric' },
      { content: totalOf((b) => b.wfl ?? b.nuf), align: 'numeric' },
    ],
  })

  return (
    <DataTable
      caption={t('vr3.client.buildings.tableCaption')}
      columns={[
        { key: 'building', header: t('vr3.client.buildings.colBuilding') },
        { key: 'usage', header: t('vr3.client.buildings.colUsage') },
        { key: 'storeys', header: t('vr3.client.project.metric.storeys') },
        { key: 'units', header: t('vr3.client.project.metric.units'), align: 'numeric' },
        { key: 'bgf', header: t('vr3.client.project.metric.bgfRS'), align: 'numeric' },
        { key: 'area', header: t('vr3.client.buildings.colArea'), align: 'numeric' },
      ]}
      rows={rows}
    />
  )
}

export { CommercialNumber }
