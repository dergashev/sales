import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  clientScenarioDelta,
  clientScenarioTrustedNow,
  useStore,
} from '../state/store'
import { scenarioChangeCount } from '../state/clientScenario'
import {
  CHAPTER_LABEL_KEY,
  type ClientBuilding,
  type ClientCompositionRow,
  type ClientConstructionLine,
  type ClientProposal,
  type ClientView,
} from '../state/clientProposal'
import { NNBSP } from '../engine/money'
import { CommercialNumber, signedMoneyText } from '../design-system/CommercialNumber'
import { localizeMoneyText, useT } from '../i18n'
import { Button } from './primitives'
import { ClientPanel } from './ClientNarrative'
import { EstimateUncertaintyBadge } from './EstimateUncertaintyBadge'

/**
 * VR3-CP-00 — CLIENT-SAFE OUTPUTS, inside chapter 10.
 *
 * ## Why PDF and print produce no snapshot, and email does
 *
 * An `OfferSnapshot` is the immutable record of WHAT THE CLIENT RECEIVED AS
 * AN OFFER (M-3). An unsaved what-if scenario is by definition not one, so
 * minting a snapshot for it would create exactly the artefact the ticket
 * forbids: a client-received record with no saved baseline,
 * indistinguishable later from a real one. The released policy holds:
 *
 *   PDF / PRINT — permitted for a what-if scenario after an EXPLICIT
 *   acknowledgement; the sheet carries a client-safe banner naming the
 *   delta against the presented proposal.
 *
 *   EMAIL — requires a saved Option. A what-if scenario routes to Save as
 *   New Option instead of being sent, because sending IS the snapshot, and a
 *   snapshot needs an Option to be a version of.
 *
 * ## No PDF renderer was invented
 *
 * The platform has no PDF library. Both document cards drive the same
 * client-safe print document through `window.print()`, and the copy says so
 * plainly rather than implying a server-side renderer that does not exist.
 *
 * ## What the store is read for — and what it is not
 *
 * The panel reads the store for GATE STATE only: whether the scenario has
 * changes, whether the presenter acknowledged the export, whether the
 * scenario is still trusted, and the delta the acknowledgement copy names.
 * Every CONTENT fact on this surface and in the printed sheet comes from the
 * one declared `ClientProposal` (see `src/state/clientProposal.ts`), so the
 * screen and the sheet cannot drift: they are two renderings of one object.
 */

type OutputChannel = 'pdf' | 'print' | 'email'
type OutputStage = 'idle' | 'preflight' | 'busy' | 'success' | 'failed'

export function ClientOutputsPanel({ view, proposal, onSaveAsNew, onEmail }: {
  view: ClientView
  proposal: ClientProposal
  onSaveAsNew: () => void
  onEmail: () => void
}) {
  const t = useT()
  const s = useStore()
  const changed = scenarioChangeCount(s.clientScenario) > 0
  const acknowledged = s.clientScenarioExportAcknowledged
  const trusted = clientScenarioTrustedNow(s)
  const delta = clientScenarioDelta(s)

  const [channel, setChannel] = useState<OutputChannel | null>(null)
  const [stage, setStage] = useState<OutputStage>('idle')
  const pdfRef = useRef<HTMLButtonElement>(null)
  const printRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const busyTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (busyTimer.current !== null) window.clearTimeout(busyTimer.current)
  }, [])

  const openPreflight = (next: OutputChannel, trigger: HTMLElement | null) => {
    triggerRef.current = trigger
    setChannel(next)
    setStage('preflight')
  }

  const runDocument = () => {
    setStage('busy')
    busyTimer.current = window.setTimeout(() => {
      try {
        // Idempotent by construction: printing the same state twice produces
        // the same document and mutates nothing, so a retry after a failure
        // cannot leave a half-output behind or a duplicate record anywhere.
        window.print()
        setStage('success')
      } catch {
        setStage('failed')
      }
    }, 0)
  }

  const closeOutput = () => {
    setStage('idle')
    setChannel(null)
    triggerRef.current?.focus()
  }

  const documentBlocked = changed && !acknowledged
  const emailBlocked = changed

  return (
    <ClientPanel title={t('vr3.client.outputs.title')}>
      <p className="a3-client-prose">
        {t(changed
          ? 'vr3.client.outputs.lede.scenario'
          : 'vr3.client.outputs.lede.saved', { option: view.optionName })}
      </p>

      {changed ? (
        <div className="a3-client-warning-block" role="status">
          <span aria-hidden="true" className="a3-client-callout-mark">!</span>
          <div>
            <p className="a3-client-callout-title">
              {t('vr3.client.outputs.notAnOffer')}
            </p>
            <p className="a3-client-callout-body">
              {t('vr3.client.outputs.scenarioBody')}
            </p>
            <label className="a3-client-acknowledge hit-target">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={() => s.acknowledgeScenarioExport()}
                disabled={acknowledged}
              />
              <span>{t('vr3.client.outputs.acknowledge')}</span>
            </label>
          </div>
        </div>
      ) : null}

      {!trusted ? (
        <p className="a3-client-warning" role="status">
          <span aria-hidden="true">! </span>{t('vr3.client.scenario.stale')}
        </p>
      ) : null}

      <div className="a3-client-output-grid">
        <ClientPanel className="a3-client-output">
          <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
            {t(changed
              ? 'vr3.client.outputs.pdf.gate'
              : 'vr3.client.outputs.pdf.ready')}
          </p>
          <h3 className="a3-client-output-title">{t('vr3.client.outputs.pdf.title')}</h3>
          <p className="a3-client-prose">{t('vr3.client.outputs.pdf.body')}</p>
          <Button
            variant="primary"
            disabled={documentBlocked}
            disabledReason={t('vr3.client.outputs.acknowledgeFirst')}
            ref={pdfRef}
            onClick={() => openPreflight('pdf', pdfRef.current)}
          >
            {t('vr3.client.outputs.pdf.action')}
          </Button>
        </ClientPanel>

        <ClientPanel className="a3-client-output">
          <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
            {t(changed
              ? 'vr3.client.outputs.print.gate'
              : 'vr3.client.outputs.print.ready')}
          </p>
          <h3 className="a3-client-output-title">{t('vr3.client.outputs.print.title')}</h3>
          <p className="a3-client-prose">{t('vr3.client.outputs.print.body')}</p>
          <Button
            variant="secondary"
            disabled={documentBlocked}
            disabledReason={t('vr3.client.outputs.acknowledgeFirst')}
            ref={printRef}
            onClick={() => openPreflight('print', printRef.current)}
          >
            {t('vr3.client.outputs.print.action')}
          </Button>
        </ClientPanel>

        <ClientPanel className="a3-client-output">
          <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
            {t('vr3.client.outputs.email.gate')}
          </p>
          <h3 className="a3-client-output-title">{t('vr3.client.outputs.email.title')}</h3>
          <p className="a3-client-prose">
            {t(emailBlocked
              ? 'vr3.client.outputs.email.bodyBlocked'
              : 'vr3.client.outputs.email.body')}
          </p>
          {emailBlocked ? (
            <Button variant="secondary" onClick={onSaveAsNew}>
              {t('vr3.client.outputs.email.route')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onEmail}>
              {t('vr3.client.outputs.email.action')}
            </Button>
          )}
        </ClientPanel>
      </div>

      <p className="a3-client-authority" data-state={changed ? 'unsaved' : 'saved'}>
        {changed
          ? t('vr3.client.outputs.authority.scenario', {
            option: view.optionName,
            delta: delta ? signedMoneyText(delta, view.language) : '',
          })
          : t('vr3.client.outputs.authority.saved', {
            option: view.optionName,
            version: view.savedVersion?.version ?? 1,
          })}
      </p>

      {stage !== 'idle' && channel ? (
        <OutputPreflight
          view={view}
          proposal={proposal}
          channel={channel}
          stage={stage}
          unsaved={changed}
          onConfirm={runDocument}
          onRetry={runDocument}
          onClose={closeOutput}
        />
      ) : null}
    </ClientPanel>
  )
}

/**
 * The preflight lists the chapters the document ACTUALLY contains — read
 * from `proposal.chapters`, the same list the rail renders — rather than a
 * fixed set of section names. A chapter that is absent from the proposal
 * (no second building, no qualifying media) is absent from this list too.
 */
function OutputPreflight({
  view, proposal, channel, stage, unsaved, onConfirm, onRetry, onClose,
}: {
  view: ClientView
  proposal: ClientProposal
  channel: OutputChannel
  stage: OutputStage
  unsaved: boolean
  onConfirm: () => void
  onRetry: () => void
  onClose: () => void
}) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="a3-client-overlay">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(`vr3.client.outputs.${channel}.title`)}
        className="a3-client-modal"
      >
        <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
          {t('vr3.client.outputs.preflight.eyebrow')}
        </p>
        <h2 className="a3-client-modal-title">
          {t(`vr3.client.outputs.${channel}.title`)}
        </h2>

        <p className="a3-client-prose">
          {unsaved
            ? t('vr3.client.outputs.preflight.authorityScenario', { option: view.optionName })
            : t('vr3.client.outputs.preflight.authoritySaved', {
              option: view.optionName,
              version: view.savedVersion?.version ?? 1,
            })}
        </p>

        <p className="a3-client-eyebrow a3-client-eyebrow-onpanel">
          {t('vr3.client.outputs.preflight.contains')}
        </p>
        <ul className="a3-client-preflight-list" role="list">
          {proposal.chapters.map((id) => (
            <li key={id}>
              <span aria-hidden="true" className="a3-client-check">✓</span>
              {t(CHAPTER_LABEL_KEY[id])}
            </li>
          ))}
        </ul>
        <p className="a3-client-prose">{t('vr3.client.outputs.preflight.excludes')}</p>

        <p aria-live="polite" className="a3-client-output-status">
          {stage === 'busy' ? t('vr3.client.outputs.status.busy') : null}
          {stage === 'success' ? (
            <>
              <span aria-hidden="true">✓ </span>
              {t('vr3.client.outputs.status.success')}
            </>
          ) : null}
          {stage === 'failed' ? (
            <>
              <span aria-hidden="true">! </span>
              {t('vr3.client.outputs.status.failed')}
            </>
          ) : null}
        </p>

        <div className="a3-client-modal-actions">
          {stage === 'preflight' ? (
            <Button variant="primary" onClick={onConfirm}>
              {t(`vr3.client.outputs.${channel}.confirm`)}
            </Button>
          ) : null}
          {stage === 'busy' ? (
            <Button variant="primary" loading loadingLabel="vr3.client.outputs.status.busy">
              {t(`vr3.client.outputs.${channel}.confirm`)}
            </Button>
          ) : null}
          {stage === 'failed' ? (
            <Button variant="primary" onClick={onRetry}>
              {t('vr3.client.outputs.status.retry')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            {t(stage === 'success'
              ? 'vr3.client.outputs.status.done'
              : 'vr3.client.outputs.status.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────────── the print document ────────────────────── */

/**
 * The print document, always mounted, shown by `@media print` alone.
 *
 * `.a3-client-print-doc` is `display:none` on screen and `display:block`
 * under `@media print`. That is MEDIUM selection — the same content, on the
 * medium it is designed for — and not an exclusion mechanism: nothing in
 * this tree is hidden because it should not reach the client. What must not
 * reach the client is not in `ClientProposal`, so it is not here to hide.
 * For the same reason the root carries no `aria-hidden`, and nothing below
 * it uses `hidden`, `display:none` or `aria-hidden`.
 *
 * ## One object, two renderings
 *
 * The shell builds the proposal for this document with profile
 * `'clientPrint'` and hands it in. Every section below reads that object and
 * nothing else — not the store, not the view, not a selector. The screen
 * and the sheet therefore cannot disagree on a building, a scope decision or
 * a date, because there is no second reading to disagree with.
 *
 * ## Paper, in one column
 *
 * `break-inside: avoid` lives in the stylesheet against
 * `.a3-client-print-section`: a section that splits across a page puts a
 * client's scope list in two places. The rounding footnote is placed
 * directly beneath the total inside the same section for the same reason —
 * a `≈` whose explanation is on another page is a `≈` without one.
 */
export function ClientPrintDocument({ proposal, scenario }: {
  proposal: ClientProposal
  scenario: { changed: boolean; deltaText: string | null }
}) {
  const t = useT()
  const {
    language, identity, overview, commercial, buildings, construction,
    scope, responsibility, schedule, assumptions, drivers, artefacts,
  } = proposal
  const offerDate = dateText(identity.offerDateISO, language)
  const totalText = localizeMoneyText(
    `${commercial.totalPrefix}${commercial.totalPrefix ? ' ' : ''}${commercial.totalDisplay} €`,
    language,
  )
  const metaLine = [
    identity.addressLine,
    `${t('vr3.client.opening.option')}: ${identity.optionName}`,
    offerDate ? `${t('vr3.client.opening.offerDate')}: ${offerDate}` : null,
    identity.clientName ? `${t('vr3.client.opening.client')}: ${identity.clientName}` : null,
    identity.legalEntity,
  ].filter((part): part is string => part !== null).join(' · ')

  const scopeGroups: ReadonlyArray<[string, readonly typeof scope.groups.included[number][]]> = [
    [t('vr3.client.print.scope.considered'), scope.groups.considered],
    [t('vr3.client.scope.included'), scope.groups.included],
    [t('vr3.client.scope.excluded'), scope.groups.excluded],
  ]
  const assumptionGroups: ReadonlyArray<[string, readonly string[]]> = [
    [t('vr3.client.basis.offer'), assumptions.offer],
    [t('vr3.client.basis.areas'), assumptions.basis],
    [t('vr3.client.basis.open'), assumptions.open],
  ]

  return (
    <div className="a3-client-print-doc">
      {scenario.changed ? (
        <p className="a3-client-print-banner">
          {scenario.deltaText
            ? t('vr3.client.print.scenarioBanner', { delta: scenario.deltaText })
            : t('vr3.client.print.scenarioBannerNoDelta')}
        </p>
      ) : null}

      <p className="a3-client-print-authority">{t('vr3.client.opening.eyebrow')}</p>
      <h1 className="a3-client-print-title">{identity.projectName}</h1>
      <p className="a3-client-print-meta">{metaLine}</p>
      {identity.hero && !proposal.chapters.includes('architektur') ? (
        <img src={identity.hero.url} alt={identity.heroAlt ?? identity.projectName} />
      ) : null}

      {/* Überblick — the supporting facts of chapter 2. */}
      {overview.length > 0 ? (
        <PrintSection title={t(CHAPTER_LABEL_KEY.ueberblick)}>
          <PrintRows>
            {overview.map((m) => (
              <PrintRow
                key={m.label}
                label={m.note ? `${m.label} · ${m.note}` : m.label}
                value={m.unit ? `${m.value}${NNBSP}${m.unit}` : m.value}
              />
            ))}
          </PrintRows>
        </PrintSection>
      ) : null}

      {/* Preis — the commercial result under its derived R-18 signature.
          The number and its label keep their own classes: the two locale
          regressions QA found are asserted against exactly these hooks. */}
      <PrintSection title={t(CHAPTER_LABEL_KEY.preis)}>
        <p className="a3-client-print-total numeric">{totalText}</p>
        <p className="a3-client-print-total-label">{commercial.signature}</p>
        {commercial.totalDisclosure ? (
          <p className="a3-client-print-note">{commercial.totalDisclosure}</p>
        ) : null}
        <PrintRows>
          <PrintRow
            label={commercial.leadRateLabel}
            value={localizeMoneyText(commercial.leadRateText, language)}
          />
        </PrintRows>
        <p className="a3-client-print-lede">
          <EstimateUncertaintyBadge
            presentation="compact"
            pp={commercial.uncertaintyPp}
            language={language}
          />
        </p>
        <p className="a3-client-print-note">{commercial.taxNote}</p>

        <p className="a3-client-print-lede">{t('vr3.client.investment.composition')}</p>
        <PrintRows>
          {commercial.composition.map((row) => (
            <div key={row.group} className="a3-client-print-row">
              <span>{`${row.number} · ${row.title}`}</span>
              <span className="numeric"><CompositionAmount row={row} language={language} /></span>
            </div>
          ))}
          <PrintRow label={commercial.signature} value={totalText} />
        </PrintRows>

        <p className="a3-client-print-lede">{t('vr3.client.print.drivers')}</p>
        <PrintRows>
          {drivers.rows.map((d) => (
            <div key={d.key} className="a3-client-print-row">
              <span>{d.label}</span>
              <span className="numeric">
                <CommercialNumber exact={d.exact} language={language} emphasis="compact" />
              </span>
            </div>
          ))}
          <div className="a3-client-print-row">
            <span>{t('vr3.client.print.driverSum')}</span>
            <span className="numeric">
              <CommercialNumber exact={drivers.sumExact} language={language} emphasis="compact" />
            </span>
          </div>
          {/* Present in EVERY client output, in either flag state (rule 40):
              when the factor is off the amount is what it WOULD add. */}
          <div className="a3-client-print-row">
            <span>{drivers.regionalFactor.text}</span>
            <span className="numeric">
              <CommercialNumber
                exact={drivers.regionalFactor.effect}
                language={language}
                emphasis="compact"
              />
            </span>
          </div>
        </PrintRows>
      </PrintSection>

      {/* Projekt / Gebäude — every building the Option sells, with the same
          A/B/C identity the stage uses. Only facts the Product holds are
          printed; a missing area is absent, never a zero. */}
      <PrintSection title={t(CHAPTER_LABEL_KEY.projekt)}>
        <p className="a3-client-print-lede">{t('vr3.client.project.method')}</p>
        <PrintRows>
          <PrintRow
            label={t('vr3.client.project.metric.buildings')}
            value={String(buildings.length)}
          />
          {buildings.reduce((n, b) => (b.units === null ? n : n + b.units), 0) > 0 ? (
            <PrintRow
              label={t('vr3.client.project.metric.units')}
              value={String(buildings.reduce((n, b) => (b.units === null ? n : n + b.units), 0))}
            />
          ) : null}
        </PrintRows>
        {proposal.chapters.includes('gebaeude') ? null : buildings.map((b) => (
          <PrintBuilding key={b.id} building={b} language={language} />
        ))}
      </PrintSection>

      {/* Die Gebäude — present exactly when the stage has the chapter. */}
      {proposal.chapters.includes('gebaeude') ? (
        <PrintSection title={t(CHAPTER_LABEL_KEY.gebaeude)}>
          {buildings.map((b) => (
            <PrintBuilding key={b.id} building={b} language={language} />
          ))}
        </PrintSection>
      ) : null}

      {/* Konstruktion — the client-safe construction statements, each
          qualified by its building where the answer differs per building. */}
      {construction.story.length + construction.detail.length > 0 ? (
        <PrintSection title={t('vr3.client.project.construction')}>
          <PrintRows>
            {construction.story.map((line) => (
              <PrintConstructionLine key={line.id} line={line} />
            ))}
            {construction.detail.map((line) => (
              <PrintConstructionLine key={line.id} line={line} />
            ))}
          </PrintRows>
        </PrintSection>
      ) : null}

      {/* Leistungen — the boundary, what is considered / included / excluded,
          and every DIN 276 scope decision including the undecided ones. An
          exclusion a client cannot read is the one that becomes a dispute. */}
      <PrintSection title={t(CHAPTER_LABEL_KEY.leistungen)}>
        {scope.boundary ? <p className="a3-client-print-lede">{scope.boundary}</p> : null}
        {scopeGroups
          .filter(([, items]) => items.length > 0)
          .map(([title, items]) => (
            <div key={title}>
              <p className="a3-client-print-lede">{title}</p>
              <ul className="a3-client-print-list">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.buildingName ? `${item.text} · ${item.buildingName}` : item.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        <PrintRows>
          {scope.rows.map((row) => (
            <PrintRow key={row.group} label={row.title} value={row.stateText} />
          ))}
        </PrintRows>
      </PrintSection>

      {/* Schnittstellen und Verantwortung — an unresolved medium is a named
          CONDITION of the offer, never a euro. */}
      {responsibility ? (
        <PrintSection title={t('vr3.client.print.responsibility')}>
          {responsibility.boundary ? (
            <p className="a3-client-print-lede">{responsibility.boundary}</p>
          ) : null}
          {responsibility.handover ? (
            <PrintRows>
              <PrintRow label={t('vr3.client.print.handover')} value={responsibility.handover} />
            </PrintRows>
          ) : null}
          <ul className="a3-client-print-list">
            {responsibility.media.map((m) => (
              <li key={m.id}>
                {t('vr3.client.print.medium', {
                  medium: m.label, client: m.clientText, all3From: m.all3From,
                })}
                {m.attention ? ` · ${t('vr3.client.responsibility.attention')}` : ''}
              </li>
            ))}
          </ul>
        </PrintSection>
      ) : null}

      {/* Terminplan — a duration with a NAMED boundary, the dates, the
          phases, and what determines completion. */}
      <PrintSection title={t(CHAPTER_LABEL_KEY.terminplan)}>
        <PrintRows>
          <PrintRow
            label={`${t('vr3.client.schedule.duration')} · ${schedule.startBoundary}`}
            value={localizeMoneyText(
              `${schedule.durationPrefix}${schedule.durationPrefix ? ' ' : ''}${schedule.durationText}`,
              language,
            )}
          />
          {schedule.startISO ? (
            <PrintRow
              label={t('vr3.client.schedule.start')}
              value={dateText(schedule.startISO, language) ?? schedule.startBoundary}
            />
          ) : null}
          {schedule.completionISO ? (
            <PrintRow
              label={t('vr3.client.schedule.completion')}
              value={dateText(schedule.completionISO, language) ?? ''}
            />
          ) : null}
          {schedule.phases.map((p) => (
            <PrintRow
              key={p.id}
              label={p.label}
              value={localizeMoneyText(p.durationText, language)}
            />
          ))}
        </PrintRows>
        {schedule.criticalPhaseLabel ? (
          <p className="a3-client-print-note">
            {t('vr3.client.schedule.critical', { phase: schedule.criticalPhaseLabel })}
          </p>
        ) : null}
      </PrintSection>

      {/* Grundlagen — three groups, and an empty one disappears. */}
      <PrintSection title={t(CHAPTER_LABEL_KEY.grundlagen)}>
        {assumptionGroups
          .filter(([, items]) => items.length > 0)
          .map(([title, items]) => (
            <div key={title}>
              <p className="a3-client-print-lede">{title}</p>
              <ul className="a3-client-print-list">
                {items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
      </PrintSection>

      {/* Architektur — the same imagery the stage shows, when the chapter
          exists. With no qualifying media the chapter is absent here too. */}
      {proposal.chapters.includes('architektur') && proposal.media.lead ? (
        <PrintSection title={t(CHAPTER_LABEL_KEY.architektur)}>
          {[proposal.media.lead, ...proposal.media.supporting].map((item) => (
            <figure key={item.id} className="a3-client-print-figure">
              <img src={item.asset.url} alt={item.alt} />
              <figcaption className="a3-client-print-note">
                {item.context ? `${item.caption} · ${item.context}` : item.caption}
              </figcaption>
            </figure>
          ))}
          <p className="a3-client-print-note">{t('vr3.client.architecture.disclaimer')}</p>
        </PrintSection>
      ) : null}

      {/* Nächster Schritt — the facts at a glance and the supporting
          artefacts, by reference. Always present, like the chapter. */}
      <PrintSection title={t(CHAPTER_LABEL_KEY.abschluss)}>
        <PrintRows>
          <PrintRow label={t('vr3.client.opening.option')} value={identity.optionName} />
          {offerDate ? (
            <PrintRow label={t('vr3.client.opening.offerDate')} value={offerDate} />
          ) : null}
        </PrintRows>
        <p className="a3-client-print-note">{t('vr3.client.closing.disclaimer')}</p>
        {artefacts.length > 0 ? (
          <>
            <p className="a3-client-print-lede">{t('vr3.client.closing.artefacts')}</p>
            <ul className="a3-client-print-list">
              {artefacts.map((a) => <li key={a.id}>{a.title}</li>)}
            </ul>
          </>
        ) : null}
      </PrintSection>

      <p className="a3-client-print-note">{t('vr3.client.print.demo')}</p>
    </div>
  )
}

/* ────────────────────────────── print pieces ─────────────────────────── */

/**
 * One DIN 276 amount, by its released state.
 *
 * `± 0 €` is legal for `zeroDirect` alone, where it means "measurably the
 * same price as the baseline choice". Every other non-priced state prints
 * its released phrase; `noBasis` is never a zero (rule 16).
 */
function CompositionAmount({ row, language }: {
  row: ClientCompositionRow
  language: 'de' | 'en'
}) {
  if (row.state === 'priced') {
    return <CommercialNumber exact={row.exact} language={language} emphasis="compact" />
  }
  if (row.state === 'zeroDirect') return <>{`±${NNBSP}0${NNBSP}€`}</>
  return <>{row.stateText ?? '—'}</>
}

function PrintBuilding({ building: b, language }: {
  building: ClientBuilding
  language: 'de' | 'en'
}) {
  const t = useT()
  const count = (n: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'de-DE').format(n)
  const facts: ReadonlyArray<[string, string | null]> = [
    [t('vr3.client.project.metric.units'), b.units === null ? null : count(b.units)],
    [t('vr3.client.project.metric.bgfRS'), b.bgfRSAbove],
    [t('vr3.client.project.metric.bgfBelow'), b.bgfRSBelow],
    [t('vr3.client.project.metric.wfl'), b.wfl],
    [t('vr3.client.project.metric.nuf'), b.nuf],
    [t('vr3.client.buildings.basement'), b.basementText],
  ]
  return (
    <div>
      <p className="a3-client-print-lede">
        {`${b.mark} · ${b.name} · ${b.usage} · ${b.storeys}`}
      </p>
      <PrintRows>
        {facts
          .filter((entry): entry is [string, string] => entry[1] !== null)
          .map(([label, value]) => <PrintRow key={label} label={label} value={value} />)}
      </PrintRows>
    </div>
  )
}

function PrintConstructionLine({ line }: { line: ClientConstructionLine }) {
  return (
    <PrintRow
      label={line.buildingName ? `${line.label} · ${line.buildingName}` : line.label}
      value={line.stateText ? `${line.value} · ${line.stateText}` : line.value}
    />
  )
}

/** A date in the reader's locale (rule 36), or nothing when there is none. */
function dateText(iso: string | null, language: 'de' | 'en'): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

/**
 * One printed section: a heading and its block, kept on one page by the
 * stylesheet's `break-inside: avoid` on this class.
 */
function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="a3-client-print-section">
      <h2 className="a3-client-print-section-title">{title}</h2>
      {children}
    </section>
  )
}

function PrintRows({ children }: { children: ReactNode }) {
  return <div className="a3-client-print-rows">{children}</div>
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="a3-client-print-row">
      <span>{label}</span>
      <span className="numeric">{value}</span>
    </div>
  )
}
