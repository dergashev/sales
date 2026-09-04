import { useEffect, useRef, useState, type Ref } from 'react'
import {
  clientScenarioDelta,
  clientScenarioTrustedNow,
  useStore,
} from '../state/store'
import { scenarioChangeCount } from '../state/clientScenario'
import { signedMoneyText } from '../design-system/CommercialNumber'
import { localizeMoneyText, useT } from '../i18n'
import { Button } from './primitives'
import { ClientPanel, PageFrame, PageLede } from './ClientNarrative'
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
 */
export function ClientPrintDocument({ view }: { view: ClientView }) {
  const t = useT()
  const s = useStore()
  const changed = scenarioChangeCount(s.clientScenario) > 0
  const delta = clientScenarioDelta(s)
  const result = view.presented.result
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
            delta: delta ? signedMoneyText(delta, view.language) : '',
          })
          : t('vr3.client.print.sourceSaved', {
            option: view.optionName,
            version: view.savedVersion?.version ?? 1,
          })}
      </p>
      <h1 className="a3-client-print-title">{view.projectName}</h1>
      {/* QA-01's family, on the artefact the client KEEPS: `display` comes
          from `formatDE` and is German by construction, so an English
          presentation printed "38.740.000" directly under an authority line
          that had already localised its own delta to "+ 310,000 €". Every
          other string in this document goes through `t()` or
          `signedMoneyText(..., view.language)`; this was the one that did
          not. */}
      <p className="a3-client-print-total numeric">
        {localizeMoneyText(result.total.display, view.language)}
      </p>
      <p className="a3-client-print-total-label">{result.totalLabel}</p>
      <p className="a3-client-print-note">{t('vr3.client.print.demo')}</p>
    </div>
  )
}
