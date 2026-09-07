import type { Ref } from 'react'
import type { ClientProposal } from '../state/clientProposal'
import { ScheduleGantt, type Phase } from './ScheduleGantt'
import { MediaGallery } from '../design-system/MediaGallery'
import { CommercialNumber } from '../design-system/CommercialNumber'
import { DataTable, type DataTableRow } from '../design-system/DataTable'
import { ChapterFrame, ChapterLede, ClientFactRow, ClientPanel } from './ClientNarrative'
import { localizeMoneyText, useT } from '../i18n'

/**
 * VR3-CP-00 — the closing chapters: 7 Terminplan · 8 Architektur ·
 * 9 Grundlagen · 10 Nächster Schritt.
 *
 * Same contract as the rest of the narrative: a `ClientProposal` and
 * nothing else. Chapters 8 is CONDITIONAL — with no qualifying media it is
 * absent from the rail entirely rather than rendering a placeholder, which
 * is why the shell filters the chapter list rather than these components
 * guarding themselves.
 */

/* The six dataviz category tokens, written out because the class/token
   checkers are static greps and cannot follow a constructed name. */
const PHASE_COLOR: readonly string[] = [
  'var(--color-dataviz-category-1)',
  'var(--color-dataviz-category-2)',
  'var(--color-dataviz-category-3)',
  'var(--color-dataviz-category-4)',
  'var(--color-dataviz-category-5)',
  'var(--color-dataviz-category-6)',
]

function dateText(iso: string | null, language: 'de' | 'en'): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

/* ─────────────────────── chapter 7 · Terminplan ──────────────────────── */

/**
 * The schedule, told as a duration with a NAMED boundary.
 *
 * `Bauzeit` alone is not a client fact — a duration without the moment it
 * starts from is unfalsifiable. The internal cockpit already names that
 * boundary; the client surface used the weaker word `Baubeginn` for the
 * same boundary, so the client got the less precise of two available
 * statements. One boundary, one name, everywhere.
 *
 * `ScheduleGantt` (the released DC-19 implementation) carries its own
 * mandatory tabular alternative and marks the diagram itself `aria-hidden`,
 * so the content is read from the table rather than from the drawing. Its
 * `provenance` prop is deliberately NOT passed: that line is internal
 * derivation detail.
 */
export function ChapterTerminplan({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { schedule, language, identity } = proposal
  const completion = dateText(schedule.completionISO, language)
  const start = dateText(schedule.startISO, language)
  const durationText = localizeMoneyText(
    `${schedule.durationPrefix}${schedule.durationPrefix ? ' ' : ''}${schedule.durationText}`,
    language,
  )

  const phases: Phase[] = schedule.phases.map((p, i) => ({
    key: p.id,
    label: p.label,
    unit: identity.projectName,
    dependency: i === 0 ? '—' : schedule.phases[i - 1]!.label,
    startISO: p.startISO,
    endISO: p.endISO,
    durationLabel: p.durationText,
    colorVar: PHASE_COLOR[i % PHASE_COLOR.length]!,
  }))

  return (
    <ChapterFrame label={t('vr3.client.chapter.terminplan')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.terminplan')}
        title={completion
          ? t('vr3.client.schedule.title', { completion })
          : t('vr3.client.schedule.title.open')}
        headingRef={headingRef}
      />
      <div className="a3-cp-schedule">
        <ClientPanel className="a3-cp-panel-plain">
          <div className="a3-cp-rows">
            <ClientFactRow
              label={`${t('vr3.client.schedule.duration')} · ${schedule.startBoundary}`}
              value={durationText}
            />
            {start ? (
              <ClientFactRow label={t('vr3.client.schedule.start')} value={start} />
            ) : null}
            {completion ? (
              <ClientFactRow
                label={t('vr3.client.schedule.completion')} value={completion}
              />
            ) : null}
          </div>
          {schedule.criticalPhaseLabel ? (
            <p className="a3-cp-callout">
              <span className="a3-cp-callout-title">
                {t('vr3.client.schedule.critical', { phase: schedule.criticalPhaseLabel })}
              </span>
              <span className="a3-cp-callout-body">
                {t('vr3.client.schedule.criticalBody')}
              </span>
            </p>
          ) : null}
        </ClientPanel>
        {phases.length > 0 && schedule.completionISO ? (
          <ScheduleGantt
            phases={phases}
            finishISO={schedule.completionISO}
            caption={t('vr3.client.schedule.sequence')}
          />
        ) : (
          // A designed unavailable state: the chapter is always present, so
          // a missing datum must say what is missing rather than leave air.
          <p className="a3-cp-unavailable">{t('vr3.client.schedule.unavailable')}</p>
        )}
      </div>
    </ChapterFrame>
  )
}

/* ────────────────────── chapter 8 · Architektur ──────────────────────── */

/**
 * Conditional on qualifying media — with none, the chapter does not exist
 * and the rail recomputes. A placeholder would be worse than an absence:
 * it would promise imagery the Product does not hold.
 *
 * Media here is meaning, not filler. One dominant image at real scale plus
 * supporting imagery, each bound to the building it depicts, captions
 * naming the context, alt text from the asset manifest. No near-duplicate
 * repeated to fill a grid.
 */
export function ChapterArchitektur({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { media } = proposal
  const items = media.lead ? [media.lead, ...media.supporting] : []
  return (
    <ChapterFrame label={t('vr3.client.chapter.architektur')} tone="stage">
      <ChapterLede
        eyebrow={t('vr3.client.chapter.architektur')}
        title={t('vr3.client.architecture.title')}
        headingRef={headingRef}
      />
      <MediaGallery
        items={items.map((item) => ({
          id: item.id,
          src: item.asset.url,
          alt: item.alt,
          caption: item.caption,
          context: item.context ?? undefined,
          sourceId: item.asset.assetId,
        }))}
        label={t('vr3.client.architecture.galleryLabel')}
        emptyLabel={t('vr3.client.architecture.empty')}
        closeLabel={t('vr3.client.architecture.close')}
        previousLabel={t('vr3.client.architecture.previous')}
        nextLabel={t('vr3.client.architecture.next')}
        positionLabel={(index, total) =>
          t('vr3.client.architecture.position', { index: index + 1, total })}
        onDark
      />
      <p className="a3-cp-disclaimer">{t('vr3.client.architecture.disclaimer')}</p>
    </ChapterFrame>
  )
}

/* ─────────────────────── chapter 9 · Grundlagen ──────────────────────── */

/**
 * Three groups, and an empty one disappears.
 *
 * The distinction this chapter exists to hold: *not contractually final* is
 * client-relevant; *internal system confidence is low* is not. So the open
 * points come only from the released responsibility projection's unresolved
 * media — an unclarified interface enters the offer as a CONDITION, in the
 * Product's own words, never as an amount and never as a gap — and never
 * from project-analysis open questions, which are preparation state.
 */
export function ChapterGrundlagen({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { assumptions } = proposal
  const groups: Array<[string, readonly string[]]> = [
    [t('vr3.client.basis.offer'), assumptions.offer],
    [t('vr3.client.basis.areas'), assumptions.basis],
    [t('vr3.client.basis.open'), assumptions.open],
  ]
  return (
    <ChapterFrame label={t('vr3.client.chapter.grundlagen')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.grundlagen')}
        title={t('vr3.client.basis.title')}
        headingRef={headingRef}
      />
      <div className="a3-cp-basis">
        {groups
          .filter(([, items]) => items.length > 0)
          .map(([title, items]) => (
            <ClientPanel key={title} title={title}>
              <ul className="a3-cp-list" role="list">
                {items.map((item) => (
                  <li key={item} className="a3-cp-list-item">{item}</li>
                ))}
              </ul>
            </ClientPanel>
          ))}
      </div>
    </ChapterFrame>
  )
}

/* ──────────────────── chapter 10 · Nächster Schritt ──────────────────── */

/**
 * Conclude the narrative, then offer the supported outputs under their
 * existing gates. No transactional next step is invented that the Product
 * cannot honour, and the supporting artefacts are reused BY REFERENCE —
 * there is no second document repository here.
 */
export function ChapterAbschluss({ proposal, headingRef, outputs }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
  outputs: React.ReactNode
}) {
  const t = useT()
  const { commercial, schedule, identity, language } = proposal
  const offerDate = dateText(identity.offerDateISO, language)
  const completion = dateText(schedule.completionISO, language)

  const rows: DataTableRow[] = [
    {
      key: 'option',
      header: t('vr3.client.opening.option'),
      cells: [{ content: identity.optionName, align: 'numeric' }],
    },
    {
      key: 'total',
      header: commercial.signature,
      cells: [{
        content: (
          <CommercialNumber exact={commercial.totalExact} language={language} emphasis="default" />
        ),
        align: 'numeric',
      }],
    },
    {
      key: 'rate',
      header: commercial.leadRateLabel,
      cells: [{ content: localizeMoneyText(commercial.leadRateText, language), align: 'numeric' }],
    },
    {
      key: 'duration',
      header: `${t('vr3.client.schedule.duration')} · ${schedule.startBoundary}`,
      cells: [{
        content: localizeMoneyText(
          `${schedule.durationPrefix}${schedule.durationPrefix ? ' ' : ''}${schedule.durationText}`,
          language,
        ),
        align: 'numeric',
      }],
    },
    ...(completion ? [{
      key: 'completion',
      header: t('vr3.client.schedule.completion'),
      cells: [{ content: completion, align: 'numeric' as const }],
    }] : []),
    ...(offerDate ? [{
      key: 'date',
      header: t('vr3.client.opening.offerDate'),
      cells: [{ content: offerDate, align: 'numeric' as const }],
    }] : []),
  ]

  return (
    <ChapterFrame label={t('vr3.client.chapter.abschluss')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.abschluss')}
        title={t('vr3.client.closing.title')}
        headingRef={headingRef}
      />
      <div className="a3-cp-closing">
        <ClientPanel title={t('vr3.client.closing.basis')}>
          <DataTable
            caption={t('vr3.client.closing.basis')}
            captionHidden
            columns={[
              { key: 'fact', header: t('vr3.client.closing.colFact') },
              { key: 'value', header: t('vr3.client.closing.colValue'), align: 'numeric' },
            ]}
            rows={rows}
          />
          <p className="a3-cp-fineprint">{t('vr3.client.closing.disclaimer')}</p>
        </ClientPanel>
        <ClientPanel title={t('vr3.client.closing.open')}>
          {proposal.assumptions.open.length > 0 ? (
            <ul className="a3-cp-list" role="list">
              {proposal.assumptions.open.map((item) => (
                <li key={item} className="a3-cp-list-item">{item}</li>
              ))}
            </ul>
          ) : (
            <p className="a3-cp-prose">{t('vr3.client.closing.noOpen')}</p>
          )}
          {proposal.artefacts.length > 0 ? (
            <div className="a3-cp-artefacts">
              <h3 className="a3-cp-panel-subtitle">{t('vr3.client.closing.artefacts')}</h3>
              <ul className="a3-cp-list" role="list">
                {proposal.artefacts.map((a) => (
                  <li key={a.id} className="a3-cp-list-item">{a.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </ClientPanel>
        {outputs}
      </div>
    </ChapterFrame>
  )
}
