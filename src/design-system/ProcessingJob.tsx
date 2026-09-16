import { useId, type ReactNode } from 'react'
import { motion, type MotionProps } from 'framer-motion'
import { useT } from '../i18n'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * ProcessingJob and DocumentRow — canonical documentation-analysis
 * capabilities (VR3-00 design delta: REPLACE of the generic phase progress
 * with per-file truth, and REPLACE of the file-list row with a workflow
 * entity that carries type, association, version, recognition, processing
 * state and its own recovery actions).
 *
 * What this capability refuses to do is as important as what it does:
 *
 * - **No page spinner stands in for the job story.** The job names the
 *   active file, the processed count out of the real denominator, and every
 *   file's own state. Repeating indeterminate motion is limited to the one
 *   file currently being processed and always has a textual equivalent.
 * - **No invented percentage.** `progressPercent` is supplied by the owner
 *   and must be derived from a denominator the owner actually knows
 *   (CLAUDE.md rule 25). There is no "estimated" mode.
 * - **A warning never erases successful files.** Filtering to the rows that
 *   need attention changes which ROWS are listed; the job's own counts stay
 *   on screen, so the filter can never hide the overall truth.
 *
 * ── Evolution, accepted 2026-09-05 Documents workspace UX audit ──────────
 *
 * The audit found three untruths in this capability and one missing layout.
 * All four are corrected HERE, canonically, rather than being worked around
 * by the one screen that noticed them:
 *
 * 1. **`READY` is a state.** A document that has never been submitted was
 *    rendered `QUEUED` with a zero-percent bar, which says processing was
 *    accepted and is about to start. It was not. `QUEUED` now means what it
 *    says — accepted, waiting for its turn — and `READY` carries the
 *    pre-start truth with no progress treatment at all.
 * 2. **The job's own vocabulary is the analysis vocabulary.** `READY`,
 *    `CANCELLED`, `RUNNING`, `COMPLETE` and `COMPLETE_WITH_ISSUES`. A
 *    terminal job with unresolved document issues can no longer be dressed
 *    as an unqualified success, which is what `COMPLETE` did while eight
 *    documents still needed attention.
 * 3. **Inspection is not a by-product of failure.** The detail disclosure
 *    used to render only inside the recovery-actions block, so a normal
 *    processed document — the overwhelming majority — could not be opened
 *    at all. Inspection is now independent: a row with a `detail` gets its
 *    toggle whether or not it has anything to recover from.
 * 4. **`layout="rail"` is a real layout.** The global job state belongs
 *    beside the register it describes, not above it. The rail is the same
 *    capability in a narrow column: same states, same counts, same progress
 *    semantics, no row list.
 */

export type ProcessingJobState =
  /** Never started. No progress treatment exists for this state. */
  | 'READY'
  /** Started, then cancelled. Terminal outcomes already produced are kept. */
  | 'CANCELLED'
  | 'RUNNING'
  | 'COMPLETE'
  /** Terminal, with outcomes that still need a decision. Never success-only. */
  | 'COMPLETE_WITH_ISSUES'

const JOB_TONE: Record<ProcessingJobState, SemanticStatusTone> = {
  READY: 'neutral',
  CANCELLED: 'neutral',
  RUNNING: 'progress',
  COMPLETE: 'ok',
  COMPLETE_WITH_ISSUES: 'attention',
}

const JOB_LABEL_KEY: Record<ProcessingJobState, string> = {
  READY: 'ds.processingJob.state.ready',
  CANCELLED: 'ds.processingJob.state.cancelled',
  RUNNING: 'ds.processingJob.state.running',
  COMPLETE: 'ds.processingJob.state.complete',
  COMPLETE_WITH_ISSUES: 'ds.processingJob.state.completeWithIssues',
}

export type ProcessingJobFilter = {
  id: string
  label: string
  count: number
  active: boolean
  onSelect: () => void
}

export function ProcessingJob({
  state, layout = 'panel', heading,
  processedCount, totalCount, progressPercent,
  activeFileName, activePhaseLabel, nextStepLabel,
  filters, filterLegend, announcement, summary, actions, notice, children,
}: {
  state: ProcessingJobState
  /**
   * `panel` is the full job with its row list; `rail` is the same job as a
   * narrow contextual column beside the register it describes.
   */
  layout?: 'panel' | 'rail'
  /** Defaults to the counted heading. The rail names the STATE instead. */
  heading?: string
  processedCount: number
  /** The real denominator. The owner never passes an estimate. */
  totalCount: number
  progressPercent: number
  activeFileName?: string | null
  activePhaseLabel?: string | null
  nextStepLabel?: string | null
  filters?: ReadonlyArray<ProcessingJobFilter>
  /** Accessible name of the filter group; required when filters are shown. */
  filterLegend?: string
  /**
   * The one scoped polite announcement for this job. Per-file changes are
   * announced through here, not by making every row its own live region.
   */
  announcement?: string
  /** Scope before the work, results after it. Never a second progress bar. */
  summary?: ReactNode
  actions?: ReactNode
  /** A partial failure explains itself here, above the rows. */
  notice?: ReactNode
  children?: ReactNode
}) {
  const t = useT()
  const headingId = useId()
  const running = state === 'RUNNING'
  // A job that has never run has NO progress to show. Rendering a 0 % bar
  // before any work was accepted is the exact untruth the audit removed.
  const hasProgress = state !== 'READY'
  return (
    <section
      className={layout === 'rail' ? 'a3-pjob a3-pjob-rail' : 'a3-pjob'}
      aria-labelledby={headingId}
      aria-busy={running || undefined}
    >
      <div className="a3-pjob-head">
        <h2 id={headingId} className="a3-pjob-title">
          {heading ?? t('ds.processingJob.heading', {
            done: processedCount, total: totalCount,
          })}
        </h2>
        {/* The status mark carries the state where the heading counts files.
            A rail whose heading IS the state does not repeat it two lines
            later — "Ready for analysis" above "READY" is the same sentence
            twice, and the audit removed six of those from this page. */}
        {heading ? null : (
          <SemanticStatus tone={JOB_TONE[state]} label={t(JOB_LABEL_KEY[state])} />
        )}
      </div>

      {summary ? <div className="a3-pjob-summary">{summary}</div> : null}

      {/* Semantic progress, not a decorative bar: the same numbers are in
          the accessible attributes and in the visible text. */}
      {hasProgress ? (
        <div className="a3-pjob-progress">
          <div
            className="a3-pjob-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={processedCount}
            aria-valuetext={t('ds.processingJob.progressText', {
              done: processedCount, total: totalCount, percent: progressPercent,
            })}
          >
            <span className="a3-pjob-meter-fill" style={{ inlineSize: `${progressPercent}%` }} />
          </div>
          <p className="a3-pjob-progress-text">
            <b className="numeric">{progressPercent}{'\u202f'}%</b>
            {' '}
            {t('ds.processingJob.overallProgress')}
          </p>
        </div>
      ) : null}

      {running && activeFileName ? (
        <div className="a3-pjob-active">
          <p className="a3-pjob-active-eyebrow">{t('ds.processingJob.nowProcessing')}</p>
          <p className="a3-pjob-active-file">{activeFileName}</p>
          <p className="a3-pjob-active-count numeric">
            {processedCount}{'\u202f'}/{'\u202f'}{totalCount}
          </p>
          {activePhaseLabel ? (
            <p className="a3-pjob-active-phase">{activePhaseLabel}</p>
          ) : null}
          {nextStepLabel ? (
            <p className="a3-pjob-active-next">{nextStepLabel}</p>
          ) : null}
        </div>
      ) : null}

      {notice ? <div className="a3-pjob-notice">{notice}</div> : null}

      {filters && filters.length > 0 ? (
        <fieldset className="a3-pjob-filters">
          <legend className="a3-pjob-filter-legend">{filterLegend}</legend>
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="a3-pjob-filter hit-target"
              aria-pressed={filter.active}
              onClick={filter.onSelect}
            >
              {filter.label}
              <span className="a3-pjob-filter-count numeric">{filter.count}</span>
            </button>
          ))}
        </fieldset>
      ) : null}

      {actions ? <div className="a3-pjob-actions">{actions}</div> : null}

      {children ? <ul className="a3-pjob-rows">{children}</ul> : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement ?? ''}
      </p>
    </section>
  )
}

export type DocumentRowState =
  /** Never submitted. Not queued, and never shown with a progress bar. */
  | 'READY'
  /** Submitted and waiting for its turn. Only valid once work was accepted. */
  | 'QUEUED'
  | 'READING' | 'CLASSIFYING' | 'EXTRACTING' | 'CROSS_CHECKING'
  | 'PROCESSED' | 'WARNING' | 'LOW_CONFIDENCE' | 'FAILED' | 'REMOVED'

const ROW_TONE: Record<DocumentRowState, SemanticStatusTone> = {
  READY: 'neutral',
  QUEUED: 'neutral',
  READING: 'progress',
  CLASSIFYING: 'progress',
  EXTRACTING: 'progress',
  CROSS_CHECKING: 'progress',
  PROCESSED: 'ok',
  // A warning and a low-confidence reading are NOT errors: they are
  // observations that need a decision. Only FAILED failed.
  WARNING: 'attention',
  LOW_CONFIDENCE: 'attention',
  FAILED: 'error',
  REMOVED: 'neutral',
}

const ROW_CLASS: Record<DocumentRowState, string> = {
  READY: 'a3-drow-ready',
  QUEUED: 'a3-drow-queued',
  READING: 'a3-drow-active',
  CLASSIFYING: 'a3-drow-active',
  EXTRACTING: 'a3-drow-active',
  CROSS_CHECKING: 'a3-drow-active',
  PROCESSED: 'a3-drow-processed',
  WARNING: 'a3-drow-warning',
  LOW_CONFIDENCE: 'a3-drow-lowconfidence',
  FAILED: 'a3-drow-failed',
  REMOVED: 'a3-drow-removed',
}

/** The four phases that describe work actually in flight. */
const IN_FLIGHT: ReadonlySet<DocumentRowState> = new Set<DocumentRowState>([
  'READING', 'CLASSIFYING', 'EXTRACTING', 'CROSS_CHECKING',
])

/**
 * The row's own entry choreography (M-01). Passed in by the owner rather
 * than owned here: only the owner knows whether this row is being admitted
 * into a freshly started job or simply re-rendered, and `useSemanticMotion`
 * has already collapsed the variants under `prefers-reduced-motion`.
 */
export type DocumentRowMotion = Pick<MotionProps, 'initial' | 'animate' | 'transition' | 'variants'>

export type DocumentRowAction = {
  id: string
  label: string
  onSelect: () => void
  priority?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  disabledReason?: string
}

export function DocumentRow({
  file, typeLabel, versionLabel, associationLabel, note, state, stateLabel,
  stateReason, progress = 0, active, stale, lineage, actions, detail,
  detailOpen, onToggleDetail, detailToggleLabel, detailControlsId,
  rowMotion, density = 'default',
}: {
  file: string
  typeLabel: string
  /** Omitted where the source carries no version — never invented. */
  versionLabel?: string
  /** Which building (or the project) the document is attributed to. */
  associationLabel?: string
  note?: string
  state: DocumentRowState
  /** The state as a word. The accessible name is filename + state. */
  stateLabel: string
  stateReason?: string
  /** 0…1 processing progress. Only rendered while work is actually in flight. */
  progress?: number
  active?: boolean
  /** Source evidence changed after this row was processed. */
  stale?: boolean
  /** Supersession / duplicate relationship, so lineage stays inspectable. */
  lineage?: string
  actions?: ReadonlyArray<DocumentRowAction>
  detail?: ReactNode
  detailOpen?: boolean
  onToggleDetail?: () => void
  detailToggleLabel?: string
  /**
   * The id of the region the toggle controls when the detail is NOT inline.
   *
   * A row may show its document in a surface of its own — a panel beside the
   * register rather than a strip under the row — and then the row has no
   * `detail` to render but still owns the control that opens it. Passing the
   * external region's id keeps `aria-expanded`/`aria-controls` pointing at
   * the thing that actually appears, which is the whole contract of a
   * disclosure; without it the button would claim to control an element that
   * does not exist.
   */
  detailControlsId?: string
  rowMotion?: DocumentRowMotion
  /** `compact` is the operational register density (64–72px collapsed). */
  density?: 'default' | 'compact'
}) {
  const t = useT()
  const detailId = useId()
  const inFlight = IN_FLIGHT.has(state)
  const meta = [typeLabel, versionLabel, associationLabel].filter(Boolean).join(' · ')
  const className = [
    'a3-drow',
    ROW_CLASS[state],
    density === 'compact' ? 'a3-drow-compact' : '',
    active ? 'a3-drow-current' : '',
  ].filter(Boolean).join(' ')
  // Inspection is INDEPENDENT of recovery (audit finding 3): a row that has
  // nothing to retry still has evidence to look at. The document itself is
  // the control: the file name carries the disclosure, so the register shows
  // no second button saying what the name already is.
  const openable = Boolean((detail || detailControlsId) && onToggleDetail)
  const Row = rowMotion ? motion.li : 'li'
  return (
    <Row className={className} {...(rowMotion ?? {})}>
      <div className="a3-drow-main">
        <span className="a3-drow-kind" aria-hidden="true">PDF</span>
        <div className="a3-drow-identity">
          {openable ? (
            <button
              type="button"
              className="a3-drow-file a3-drow-file-link hit-target"
              title={file}
              aria-expanded={Boolean(detailOpen)}
              aria-controls={detailControlsId ?? detailId}
              aria-label={t('ds.documentRow.actionOn', {
                action: detailToggleLabel ?? t('ds.documentRow.inspect'), file,
              })}
              onClick={onToggleDetail}
            >
              {file}
            </button>
          ) : (
            <b className="a3-drow-file" title={file}>{file}</b>
          )}
          {meta ? <span className="a3-drow-meta">{meta}</span> : null}
          {note ? <span className="a3-drow-note">{note}</span> : null}
          {lineage ? <span className="a3-drow-lineage">{lineage}</span> : null}
        </div>
        <div className="a3-drow-progress">
          {/* Only work that is actually in flight has a bar. A pre-start or
              terminal row has none — a 0 % or 100 % bar would be decoration
              standing where a state word already says the truth. */}
          {inFlight ? (
            <span
              className="a3-drow-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={t('ds.documentRow.progressLabel', { file })}
            >
              <span
                className="a3-drow-meter-fill"
                style={{ inlineSize: `${Math.round(progress * 100)}%` }}
              />
            </span>
          ) : null}
        </div>
        <div className="a3-drow-state">
          {/* The accessible name of the state is filename + state, so a
              screen-reader user never hears a bare "WARNING" with no
              subject.

              A row that has not been submitted yet is QUIET: the word is
              there, in full, but a register of eight identical status marks
              is a wall of pills that emphasises nothing. Emphasis is
              reserved for the states that need a decision. */}
          {state === 'READY' && !stale ? (
            <span className="a3-drow-quiet-state">{stateLabel}</span>
          ) : (
            <SemanticStatus
              tone={stale ? 'stale' : ROW_TONE[state]}
              label={stateLabel}
              reason={stateReason}
              size="compact"
            />
          )}
          <span className="sr-only">{t('ds.documentRow.stateOf', { file })}</span>
        </div>
      </div>
      {actions && actions.length > 0 ? (
        <div className="a3-drow-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={
                action.priority === 'primary'
                  ? 'a3-drow-action a3-drow-action-primary hit-target'
                  : action.priority === 'ghost'
                    ? 'a3-drow-action a3-drow-action-ghost hit-target'
                    : 'a3-drow-action hit-target'
              }
              onClick={action.onSelect}
              disabled={action.disabled}
              title={action.disabled ? action.disabledReason : undefined}
              aria-label={t('ds.documentRow.actionOn', {
                action: action.label, file,
              })}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {detail ? (
        <div id={detailId} className="a3-drow-detail" hidden={!detailOpen}>
          {detail}
        </div>
      ) : null}
    </Row>
  )
}
