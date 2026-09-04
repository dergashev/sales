import { useEffect, useRef, useState, type Ref } from 'react'
import { Decimal } from 'decimal.js'
import {
  clientDecisionValue,
  clientPresentationDecisions,
  clientScenarioDelta,
  clientScenarioTrustedNow,
  clientSchedulePhases,
  clientScheduleDerivation,
  useStore,
} from '../state/store'
import { scenarioChangeCount } from '../state/clientScenario'
import { scopeMetricValue } from '../state/optionBuildingScope'
import { kgCatalogue } from '../engine/kgConfiguration'
import { rateUnit } from '../engine/money'
import { CommercialNumber, signedMoneyText } from '../design-system/CommercialNumber'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { Button } from './primitives'
import {
  ClientPanel, PageFrame, PageLede,
  areaText, clientCostGroupTitle, clientScopeRows, dateText, monthsText,
  selectedBuildingsOf,
} from './ClientNarrative'
import type { ClientView } from './ClientNarrative'

/**
 * VR3-05 — CLIENT-SAFE OUTPUTS (T-045).
 *
 * ## Why PDF and print produce no snapshot, and email does
 *
 * An `OfferSnapshot` is the immutable record of WHAT THE CLIENT RECEIVED AS
 * AN OFFER (M-3). An unsaved presentation scenario is by definition not one:
 * the whole point of the label this screen attaches — "UNSAVED PRESENTATION
 * SCENARIO — NOT AN ACCEPTED OFFER" — is that the sheet in the client's hand
 * has no accepted Option behind it. Minting a snapshot for it would create
 * exactly the artefact the ticket forbids: a client-received record with no
 * saved baseline, indistinguishable later from a real one.
 *
 * So the policy the ticket asks us to choose ONE of, and hold:
 *
 *   PDF / PRINT — permitted for a temporary scenario after an EXPLICIT
 *   acknowledgement, and the output carries the unsaved label and names its
 *   saved source Option.
 *
 *   EMAIL — requires a saved Option. An unsaved scenario routes to Save as
 *   New Option instead of being sent, because sending IS the snapshot, and a
 *   snapshot needs an Option to be a version of.
 *
 * ## No PDF renderer was invented
 *
 * The platform has no PDF library and this ticket's non-goals forbid
 * introducing one. It does have a browser, and a browser's print path is how
 * a document becomes paper or a PDF file. Both cards therefore drive the
 * same client-safe print document through `window.print()`, and the copy
 * says so plainly rather than implying a server-side renderer that does not
 * exist. What this ticket owns is the CONTENT and its AUTHORITY LABEL — the
 * part that is a product decision — not the transport.
 */

type OutputChannel = 'pdf' | 'print' | 'email'
type OutputStage = 'idle' | 'preflight' | 'busy' | 'success' | 'failed'

/** The client sections every output carries. Named, so preflight can list them. */
const OUTPUT_SECTIONS = [
  'vr3.client.nav.project',
  'vr3.client.nav.buildings',
  'vr3.client.nav.scope',
  'vr3.client.nav.services',
  'vr3.client.nav.schedule',
  'vr3.client.nav.investment',
] as const

export function PageOutputs({ view, headingRef, onSaveAsNew, onEmail }: {
  view: ClientView
  headingRef: Ref<HTMLHeadingElement>
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
    <PageFrame label={t('vr3.client.outputs.eyebrow')}>
      <PageLede
        eyebrow={t('vr3.client.outputs.eyebrow')}
        title={t('vr3.client.outputs.title')}
        headingRef={headingRef}
        lede={t(changed
          ? 'vr3.client.outputs.lede.scenario'
          : 'vr3.client.outputs.lede.saved', { option: view.optionName })}
      />

      {changed ? (
        <div className="a3-client-warning-block" role="status">
          <span aria-hidden="true" className="a3-client-callout-mark">!</span>
          <div>
            <p className="a3-client-callout-title">
              {t('vr3.client.outputs.notAnOffer')}
            </p>
            <p className="a3-client-callout-body">
              {t('vr3.client.outputs.notAnOfferBody', { option: view.optionName })}
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
          <h2 className="a3-client-output-title">{t('vr3.client.outputs.pdf.title')}</h2>
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
          <h2 className="a3-client-output-title">{t('vr3.client.outputs.print.title')}</h2>
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
          <h2 className="a3-client-output-title">{t('vr3.client.outputs.email.title')}</h2>
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
          channel={channel}
          stage={stage}
          unsaved={changed}
          onConfirm={runDocument}
          onRetry={runDocument}
          onClose={closeOutput}
        />
      ) : null}
    </PageFrame>
  )
}

function OutputPreflight({
  view, channel, stage, unsaved, onConfirm, onRetry, onClose,
}: {
  view: ClientView
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
          {OUTPUT_SECTIONS.map((key) => (
            <li key={key}>
              <span aria-hidden="true" className="a3-client-check">✓</span>{t(key)}
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

/**
 * The print document, always mounted, visible only to the printer.
 *
 * Rendered from the SAME `ClientView` the screen reads, so the sheet and the
 * screen cannot disagree about which state was exported — and carrying the
 * authority statement as the document's own first block means the label
 * survives being handed to somebody who never saw the screen.
 *
 * ## ACCEPT-01 — the sheet now contains the presentation, not its cover
 *
 * `@media print` hides the whole narrative (`.a3-client-page`,
 * `.a3-client-hero`, `.a3-client-entry`) and prints this document instead,
 * because a client artefact is a DOCUMENT and not a photograph of a
 * meeting-scale stage: the six sections are laid out for paper, in one
 * column, without the imagery and the interactive controls that only make
 * sense on the stage. That decision was right. What was missing is that this
 * document only ever carried the banner, the authority line, the project
 * name, the total and its label — so hiding the narrative and printing this
 * meant the PDF the client keeps was a cover sheet, while the card offering
 * it promised "Kundennarrativ" and the preflight listed all six sections as
 * ENTHALTEN. The output stated an authority it did not carry.
 *
 * Target spec §16 enumerates what a PDF contains: "client narrative,
 * buildings, scope, services, schedule, commercial result, Option/version/
 * date and approved assumptions". Every one of those is now a section here,
 * derived from the presented snapshot through the SAME helpers the screen
 * uses (`clientScopeRows`, `clientCostGroupTitle`, `clientScheduleDerivation`,
 * `clientSchedulePhases`, `selectedBuildingsOf`, `areaText`, `monthsText`,
 * `dateText`, `CommercialNumber`) — not a second reading of the store. A
 * paper document that computed its own scope list would be free to disagree
 * with the screen it was printed from.
 *
 * ## Client-safe by the same construction, and NOT by CSS
 *
 * Everything here comes from `ClientView` and the client-scenario selectors,
 * which is the allowlisted projection: there is no internal id, note,
 * confidence, OCR diagnostic or CRM field to hide, because none of it
 * reaches this component. §16's own last line requires exactly that —
 * "excluded by allowlisted projection, not CSS".
 *
 * ## What is deliberately NOT here
 *
 * Kostentreiber. CLAUDE.md rule 35 requires it in the client PDF; the
 * approved target's §16 list and T-040/T-045 do not name it. That conflict
 * is unresolved AUTHORITY and has been carried since cycle 1 — the
 * Acceptance report that ordered this remediation says explicitly to
 * implement §16's list only and leave Kostentreiber alone until Product
 * rules. So this delta adds §16's sections and nothing beyond them.
 */
export function ClientPrintDocument({ view }: { view: ClientView }) {
  const t = useT()
  const tx = useTx()
  const s = useStore()
  const changed = scenarioChangeCount(s.clientScenario) > 0
  const delta = clientScenarioDelta(s)
  const result = view.presented.result
  const language = view.language

  const catalogue = kgCatalogue(s.opportunityId)
  const buildings = selectedBuildingsOf(view)
  const scopeRows = clientScopeRows(view, catalogue)
  const included = scopeRows.filter((r) => r.decision === 'included')
  const excluded = scopeRows.filter((r) => r.decision === 'excluded')
  const derivation = clientScheduleDerivation(s, view.presented)
  const phases = clientSchedulePhases(s, view.presented)
  const decisions = clientPresentationDecisions(s)
  const bgf = buildings.reduce((sum, b) => {
    const value = scopeMetricValue(view.presented.config, b, 'bgfRSAbove')
    return value === null ? sum : sum.plus(new Decimal(value))
  }, new Decimal(0))
  const nameOf = (buildingId: string | null) =>
    buildings.find((b) => b.id === buildingId)?.name ?? ''

  return (
    <div className="a3-client-print-doc" aria-hidden="true">
      {changed ? (
        <p className="a3-client-print-banner">
          {t('vr3.client.print.unsavedBanner')}
        </p>
      ) : null}
      <p className="a3-client-print-authority">
        {changed
          ? t('vr3.client.print.sourceScenario', {
            option: view.optionName,
            delta: delta ? signedMoneyText(delta, language) : '',
          })
          : t('vr3.client.print.sourceSaved', {
            option: view.optionName,
            version: view.savedVersion?.version ?? 1,
          })}
      </p>
      <h1 className="a3-client-print-title">{view.projectName}</h1>
      {/* §16: "Option/version/date". The date is the one a client can check
          the sheet against — when it was printed — formatted through `Intl`
          for the reader's locale like every other date in the product. */}
      <p className="a3-client-print-meta">
        {t('vr3.client.print.meta', {
          option: view.optionName,
          version: view.savedVersion?.version ?? 1,
          date: printDateText(language),
        })}
      </p>

      {/* §1 · PROJEKT — the client narrative's own opening claim. */}
      <PrintSection title={t('vr3.client.nav.project')}>
        <p className="a3-client-print-lede">
          {t(buildings.length > 1
            ? 'vr3.client.identity.lede.complex'
            : 'vr3.client.identity.lede.single', { count: buildings.length })}
        </p>
        <PrintRows>
          <PrintRow
            label={t('vr3.client.identity.metric.buildings')}
            value={String(buildings.length)}
          />
          <PrintRow
            label={t('vr3.client.identity.metric.bgf')}
            value={areaText(bgf.toFixed(2), language)}
          />
          <PrintRow
            label={t('vr3.client.identity.metric.completion')}
            value={dateText(derivation?.completionISO ?? null, language)}
          />
        </PrintRows>
      </PrintSection>

      {/* §2 · GEBÄUDE — the same A/B/C identity the stage and the schedule
          use, so a reader can follow one building across three sections. */}
      <PrintSection title={t('vr3.client.nav.buildings')}>
        <PrintRows>
          {buildings.map((building, index) => (
            <PrintRow
              key={building.id}
              label={`${String.fromCharCode(65 + index)} · ${building.name} · ${t(building.usageKey)}`}
              value={areaText(
                scopeMetricValue(view.presented.config, building, 'bgfRSAbove'),
                language,
              )}
            />
          ))}
        </PrintRows>
      </PrintSection>

      {/* §3 · UMFANG — included first, then what is explicitly NOT included.
          An exclusion a client cannot read is the one that becomes a
          dispute. */}
      <PrintSection title={t('vr3.client.nav.scope')}>
        <PrintRows>
          {included.map((row) => (
            <PrintRow
              key={row.group}
              label={row.title}
              value={t('vr3.client.scope.state.included')}
            />
          ))}
          {excluded.map((row) => (
            <PrintRow
              key={row.group}
              label={row.title}
              value={t('vr3.client.scope.state.excluded')}
            />
          ))}
        </PrintRows>
      </PrintSection>

      {/* §4 · LEISTUNGEN — the decisions in force, each with the consequence
          the stage states for the value that is actually selected. */}
      <PrintSection title={t('vr3.client.nav.services')}>
        {decisions.length > 0 ? (
          <PrintRows>
            {decisions.map((decision) => {
              const value = clientDecisionValue(s, decision)
              const option = decision.options.find((o) => o.value === value)
              return (
                <PrintRow
                  key={decision.id}
                  label={t(decision.titleKey)}
                  value={option ? t(option.labelKey) : '—'}
                />
              )
            })}
          </PrintRows>
        ) : (
          <p className="a3-client-print-lede">{t('vr3.client.services.none')}</p>
        )}
      </PrintSection>

      {/* §5 · TERMINPLAN — duration, the two dates, the sequence, and what
          determines completion. */}
      <PrintSection title={t('vr3.client.nav.schedule')}>
        <PrintRows>
          <PrintRow
            label={t('vr3.client.schedule.duration')}
            value={t('vr3.client.schedule.months', {
              months: monthsText(derivation?.totalHalfMonths ?? null, language),
            })}
          />
          <PrintRow
            label={t('vr3.client.schedule.start')}
            value={dateText(derivation?.startISO ?? null, language)}
          />
          <PrintRow
            label={t('vr3.client.schedule.completion')}
            value={dateText(derivation?.completionISO ?? null, language)}
          />
          {phases.map((phase) => {
            const window = derivation?.windows.find((w) => w.phase.id === phase.id)
            return (
              <PrintRow
                key={phase.id}
                label={phase.buildingId
                  ? `${t(PRINT_PHASE_LABEL_KEY[phase.kind] ?? phase.kind)} · ${nameOf(phase.buildingId)}`
                  : t(PRINT_PHASE_LABEL_KEY[phase.kind] ?? phase.kind)}
                value={t('vr3.client.schedule.months', {
                  months: monthsText(
                    window ? window.phase.durationHalfMonths : phase.durationHalfMonths,
                    language,
                  ),
                })}
              />
            )
          })}
        </PrintRows>
      </PrintSection>

      {/* §6 · INVESTITION — the commercial result. The total and its label
          keep their own classes: they are the document's largest claim, and
          the two locale regressions QA found (a German numeral under an
          English delta, then a German label under an English numeral) are
          asserted against exactly these two hooks. */}
      <PrintSection title={t('vr3.client.nav.investment')}>
        {/* QA-01's family, on the artefact the client KEEPS: `display` comes
            from `formatDE` and is German by construction, so an English
            presentation printed "38.740.000" directly under an authority
            line that had already localised its own delta to "+ 310,000 €".
            Every other string in this document goes through `t()` or
            `signedMoneyText(..., view.language)`; this was the one that did
            not. */}
        <p className="a3-client-print-total numeric">
          {localizeMoneyText(result.total.display, language)}
        </p>
        {/* QA-02. The NUMBER above this line was localised last cycle and
            its own LABEL was not, so the sheet read "38,850,000" over
            "Gesamt netto · Grundleistung All3". The identical string one
            file over (the on-screen hero) was bridged in the same commit —
            the sibling was missed. Same `tx` bridge, same reason. */}
        <p className="a3-client-print-total-label">{tx(result.totalLabel)}</p>
        <PrintRows>
          {/* ACCEPT-03's sibling: the rate names its unit and its
              denominator through the engine's own composer here too, so the
              sheet and the stage state the lead metric identically. */}
          <PrintRow
            label={`${t('vr3.client.investment.leadRate')} · ${result.leadRate.denominatorLabel}`}
            value={localizeMoneyText(rateUnit(result.leadRate), language)}
          />
          {result.byCostGroup.map((line) => (
            <div key={line.group} className="a3-client-print-row">
              <span>{clientCostGroupTitle(line.group, catalogue, language)}</span>
              <span className="numeric">
                <CommercialNumber
                  exact={line.exact}
                  language={language}
                  emphasis="compact"
                  absentLabel={t('vr3.client.investment.notPriced')}
                />
              </span>
            </div>
          ))}
        </PrintRows>
      </PrintSection>

      {/* §16's last content item: the approved assumptions the presentation
          stands on. They are QUOTED from the client surface — the
          uncertainty band, what the scope decisions mean, and the
          demonstration-data statement — not composed here. Rule 10: these
          texts come from the documents, they are not written by this
          component. */}
      <PrintSection title={t('vr3.client.print.assumptions')}>
        <ul className="a3-client-print-list">
          <li>{t('vr3.client.investment.uncertainty', { pp: result.uncertaintyPp })}</li>
          <li>
            {t(included.length === scopeRows.length
              ? 'vr3.client.scope.meaning.complete'
              : 'vr3.client.scope.meaning.partial', { count: buildings.length })}
          </li>
          <li>{t('vr3.client.outputs.preflight.excludes')}</li>
        </ul>
      </PrintSection>

      <p className="a3-client-print-note">{t('vr3.client.print.demo')}</p>
    </div>
  )
}

/** The phase words, printed the same way the stage says them. */
const PRINT_PHASE_LABEL_KEY: Record<string, string> = {
  planning: 'vr3.client.schedule.phase.planning',
  tender: 'vr3.client.schedule.phase.tender',
  execution: 'vr3.client.schedule.phase.execution',
  handover: 'vr3.client.schedule.phase.handover',
}

/** The date the sheet was produced, in the reader's locale (rule 36). */
function printDateText(language: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())
}

/**
 * One printed section: a heading and its block, kept on one page.
 *
 * `break-inside: avoid` lives in the stylesheet against this class rather
 * than on each section, which is what §16 means by "paper-specific
 * hierarchy and page-break rules" — a section that splits across a page
 * break puts a client's scope list in two places.
 */
function PrintSection({ title, children }: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="a3-client-print-section">
      <h2 className="a3-client-print-section-title">{title}</h2>
      {children}
    </section>
  )
}

function PrintRows({ children }: { children: React.ReactNode }) {
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
