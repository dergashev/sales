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

/**
 * One chapter, as a landmark carrying the name the rail carries.
 *
 * Four tones, and each is a SPATIAL model rather than a colour:
 *
 * - default — the chapter measure on white, hairlines and air;
 * - `stage` — full-bleed deep stage, content still on the measure;
 * - `hero`  — the deep stage with NO measure and no padding at all: the
 *   opening's image is the chapter (ACCEPT-05), and the copy carries its
 *   own inset. A contained image inside a padded two-column grid is a
 *   different spatial model, not a narrower version of this one;
 * - `tiles` — the canvas ground the approved chapter-2 grid stands on, so
 *   its white tiles are a surface rather than an outline (ACCEPT-04).
 */
const CHAPTER_TONE_CLASS: Record<'ground' | 'stage' | 'hero' | 'tiles', string> = {
  ground: 'a3-cp-chapter',
  stage: 'a3-cp-chapter a3-cp-chapter-stage',
  hero: 'a3-cp-chapter a3-cp-chapter-stage a3-cp-chapter-hero',
  tiles: 'a3-cp-chapter a3-cp-chapter-tiles',
}

export function ChapterFrame({ children, label, tone }: {
  children: ReactNode
  label: string
  tone?: 'ground' | 'stage' | 'hero' | 'tiles'
}) {
  return (
    <section aria-label={label} className={CHAPTER_TONE_CLASS[tone ?? 'ground']}>
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

/**
 * `≈ 2.246 €/m²` → `['≈ 2.246', '€/m²']`; `18,5 Monate` → `['18,5', 'Monate']`.
 *
 * Rule 31 / DC-38: the unit is set smaller ON THE SAME BASELINE, never on
 * its own line and never at footnote size. The composed string stays the one
 * source of the unit — `money.ts` owns the `€/m²` vs `€` choice and says so
 * in its own comment — so this decides only where the tail is TYPESET, and
 * refuses to split anything whose tail still contains a digit.
 */
function splitUnit(text: string): [string, string | null] {
  const cut = Math.max(text.lastIndexOf(' '), text.lastIndexOf(' '))
  if (cut <= 0) return [text, null]
  const tail = text.slice(cut + 1)
  if (tail.length === 0 || /\d/.test(tail)) return [text, null]
  return [text.slice(0, cut), tail]
}

/** Sum one area across the Option's buildings, in the reader's locale. */
function sumArea(
  buildings: readonly ClientBuilding[],
  pick: (b: ClientBuilding) => string | null,
  language: 'de' | 'en',
): string | null {
  const values = buildings.map(pick).filter((v): v is string => v !== null)
  if (values.length === 0) return null
  const total = values.reduce(
    (acc, v) => acc + Number(v.replace(/[.\s ]/g, '').replace(',', '.')), 0)
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(total)
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
 * commercial detail appears — which is why the project image IS the chapter
 * and the identity is set ON it, and why nothing about All3's preparation
 * process survives entry.
 *
 * ## ACCEPT-05 — a full-bleed hero is a spatial model, not a bigger picture
 *
 * The surface this replaces put a CONTAINED 763 × 429 image in the left
 * column of a padded two-column grid and left ~190 px of empty stage under
 * it. That is a card layout wearing dark paint: at the one moment the
 * client is meant to see their own project, two fifths of the stage were
 * type and a fifth was nothing. So the geometry is now stated once and
 * properly — the media fills the stage (`.a3-cp-chapter-hero` carries no
 * measure and no padding), and the identity block sits on it, bottom-left,
 * with its own inset.
 *
 * Legibility over an arbitrary photograph is carried by a FLAT token scrim
 * (`--color-surface-overlay`, the declared 48 % overlay) behind the copy —
 * never a gradient, which rule 4 forbids outright.
 *
 * With no qualifying hero asset this renders `MediaFrame`'s designed
 * fallback state, which is information-bearing. Never a grey rectangle, and
 * never an empty stage.
 *
 * `sourceId` is deliberately NOT passed (ACCEPT-07): `MediaFrame` renders it
 * as `data-source-id`, and an asset-manifest identifier is provenance for
 * QA — it has no business in a DOM a client can open. `seed` stays, because
 * it selects the fallback's material variant and names nothing.
 */
export function ChapterAngebot({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { identity } = proposal
  const offerDate = dateText(identity.offerDateISO, proposal.language)
  return (
    <ChapterFrame label={t('vr3.client.chapter.angebot')} tone="hero">
      <div className="a3-cp-opening">
        <div className="a3-cp-opening-media">
          {identity.hero ? (
            <MediaFrame
              ratio="hero" state="loaded" src={identity.hero.url}
              alt={identity.heroAlt ?? identity.projectName}
              seed={identity.hero.assetId}
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
          {/*
            A hairline, then ONE footer row: what this offer is and which
            Option it speaks for on the left, who is offering it on the
            right. It is the colophon of a proposal, not a fact list.
          */}
          <div className="a3-cp-opening-facts">
            <p className="a3-cp-opening-facts-left">
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
            </p>
            <p className="a3-cp-opening-entity">{identity.legalEntity}</p>
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}

/* ──────────────── chapter 2 · Projektüberblick (F02/F04) ─────────────── */

/**
 * The commercial climax, early — the approved TILE GRID (ACCEPT-04).
 *
 * ## Why a grid of tiles and not a text stack
 *
 * The surface this replaces set the same facts as a linear column on white:
 * total, then rate, then Bauzeit, then one fact, then ~200 px of empty
 * stage, no project image at all. Everything was legible and nothing was
 * ranked — a reader scanning it had to read it. The approved composition
 * puts each fact in its own white tile on the canvas ground, so rank is
 * carried by AREA and position before a single word is read: the total
 * takes a double-width tile on row 1, its two co-heroes sit beside it, and
 * row 2 carries the supporting facts beside the project image.
 *
 * The hierarchy inside the tiles is DC-38 / rule 31 unchanged:
 *
 * - the total at 64 px in the brand accent — the ONE permitted orange, and
 *   it is legal here precisely because the tile is white
 *   (`--color-surface-default`) rather than the canvas it stands on;
 * - the lead rate at 48 px black, whose denominator names its norm in the
 *   metric label AND states its own area beneath, so the rate can be
 *   checked rather than trusted;
 * - the Bauzeit at 48 px black, with the SAME start boundary the internal
 *   cockpit uses and the absolute completion date.
 *
 * Every unit is set smaller on the SAME baseline, never on its own line.
 *
 * Each tile is composed from `ClientProposal` and nothing else. The
 * Energiestandard tile is present exactly when the Option declares one —
 * absent is absent, not an empty tile — and the media tile's caption is the
 * buildings' own marks and names, never authored marketing prose.
 */
export function ChapterUeberblick({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { commercial, schedule, language, identity, buildings } = proposal
  const completion = dateText(schedule.completionISO, language)
  const totalText = localizeMoneyText(
    `${commercial.totalPrefix}${commercial.totalPrefix ? ' ' : ''}${commercial.totalDisplay}`,
    language,
  )
  const [durationValue, durationUnit] = splitUnit(localizeMoneyText(
    `${schedule.durationPrefix}${schedule.durationPrefix ? ' ' : ''}${schedule.durationText}`,
    language,
  ))
  const [rateValue, rateUnitText] = splitUnit(
    localizeMoneyText(commercial.leadRateText, language))

  /*
    The lead rate's own denominator, as a figure. A rate whose denominator is
    only NAMED ("BGF oberirdisch") and never stated is a number the client
    has to take on trust; the approved overview puts both on the tile. The
    projection formats the figure — this composes the sentence.
  */
  const leadNote = commercial.leadDenominatorText
    ? t('vr3.client.overview.leadArea', {
      area: commercial.leadDenominatorText,
      denominator: commercial.leadRate.denominatorLabel,
      tax: commercial.taxNote,
    })
    : commercial.taxNote

  /*
    The project tile's supporting line. Storeys are stated only when every
    building answers the same — naming ONE storey line for a three-building
    Option would be false, which is the rule chapter 3 already follows.
  */
  const bgfRS = sumArea(buildings, (b) => b.bgfRSAbove, language)
  const storeys = buildings.length > 0
    && buildings.every((b) => b.storeys === buildings[0]!.storeys)
    ? buildings[0]!.storeys
    : null
  const projectNote = [
    storeys,
    bgfRS === null ? null : t('vr3.client.overview.projectArea', { area: bgfRS }),
  ].filter((part): part is string => part !== null).join(' · ') || null
  // Resolved through the SAME key the projection resolved, so picking the
  // project tile out of the supporting metrics is an identity, not a guess.
  const projectLabel = t('vr3.client.overview.project')

  return (
    <ChapterFrame label={t('vr3.client.chapter.ueberblick')} tone="tiles">
      <ChapterLede
        eyebrow={t('vr3.client.chapter.ueberblick')}
        title={t('vr3.client.overview.title')}
        headingRef={headingRef}
      />
      <div
        className="a3-cp-tiles"
        data-energy={proposal.overview.length > 1 ? 'yes' : 'no'}
      >
        <div className="a3-cp-tile a3-cp-tile-total a3-cp-hero-total">
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
        <div className="a3-cp-tile a3-cp-hero-side">
          <MetricHero
            variant="co"
            label={commercial.leadRateLabel}
            value={rateValue}
            unit={rateUnitText}
            note={leadNote}
          />
        </div>
        <div className="a3-cp-tile">
          <MetricHero
            variant="co"
            label={t('vr3.client.overview.duration')}
            value={durationValue}
            unit={durationUnit}
            note={completion
              ? `${schedule.startBoundary} · ${t('vr3.client.schedule.completion')} ${completion}`
              : schedule.startBoundary}
          />
        </div>
        {proposal.overview.map((metric: ClientMetric) => (
          <div
            key={metric.label}
            className={metric.label === projectLabel
              ? 'a3-cp-tile a3-cp-tile-project'
              : 'a3-cp-tile'}
          >
            <MetricHero
              variant="fact"
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              note={metric.label === projectLabel
                ? [metric.note, projectNote]
                  .filter((part): part is string => part !== null && part !== '')
                  .join(' · ') || null
                : metric.note}
            />
          </div>
        ))}
        {/*
          The project image, IN the grid rather than beside it — the tile is
          the second half of row 2 and carries the buildings it shows.
          `sourceId` is not passed: asset provenance belongs to QA, never to
          a DOM the client can open (ACCEPT-07).
        */}
        <div className="a3-cp-tile a3-cp-tile-media">
          <div className="a3-cp-tile-media-frame">
            {identity.hero ? (
              <MediaFrame
                ratio="card" state="loaded" src={identity.hero.url}
                alt={identity.heroAlt ?? identity.projectName}
                seed={identity.hero.assetId}
              />
            ) : (
              <MediaFrame
                ratio="card" state="fallback" seed={identity.projectName}
                fallbackLabel={identity.projectName}
              />
            )}
          </div>
          <div className="a3-cp-tile-media-copy">
            <p className="a3-cp-metric-label">{t('vr3.client.overview.volumes')}</p>
            <p className="a3-cp-metric-note">
              {buildings.map((b) => `${b.mark} · ${b.name}`).join(' · ')}
            </p>
          </div>
        </div>
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
  const sum = (pick: (b: ClientBuilding) => string | null) => sumArea(buildings, pick, language)
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
