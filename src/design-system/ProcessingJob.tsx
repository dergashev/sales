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
 */

export type ProcessingJobState = 'NOT_STARTED' | 'RUNNING' | 'PARTIAL_FAILURE' | 'COMPLETE'

const JOB_TONE: Record<ProcessingJobState, SemanticStatusTone> = {
  NOT_STARTED: 'neutral',
  RUNNING: 'progress',
  PARTIAL_FAILURE: 'attention',
  COMPLETE: 'ok',
}

const JOB_LABEL_KEY: Record<ProcessingJobState, string> = {
  NOT_STARTED: 'ds.processingJob.state.notStarted',
  RUNNING: 'ds.processingJob.state.running',
  PARTIAL_FAILURE: 'ds.processingJob.state.partialFailure',
  COMPLETE: 'ds.processingJob.state.complete',
}

export type ProcessingJobFilter = {
  id: string
  label: string
  count: number
  active: boolean
  onSelect: () => void
}

export function ProcessingJob({
  state, processedCount, totalCount, progressPercent,
  activeFileName, activePhaseLabel, nextStepLabel,
  filters, filterLegend, announcement, actions, notice, children,
}: {
  state: ProcessingJobState
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
  actions?: ReactNode
  /** A partial failure explains itself here, above the rows. */
  notice?: ReactNode
  children: ReactNode
}) {
  const t = useT()
  const headingId = useId()
  const running = state === 'RUNNING' || state === 'PARTIAL_FAILURE'
  return (
    <section
      className="a3-pjob"
      aria-labelledby={headingId}
      aria-busy={running || undefined}
    >
      <div className="a3-pjob-head">
        <h2 id={headingId} className="a3-pjob-title">
          {t('ds.processingJob.heading', { done: processedCount, total: totalCount })}
        </h2>
        <SemanticStatus tone={JOB_TONE[state]} label={t(JOB_LABEL_KEY[state])} />
        {actions ? <div className="a3-pjob-actions">{actions}</div> : null}
      </div>

      {/* Semantic progress, not a decorative bar: the same numbers are in
          the accessible attributes and in the visible text. */}
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

      {notice ? <div className="a3-pjob-notice">{notice}</div> : null}

      <ul className="a3-pjob-rows">{children}</ul>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement ?? ''}
      </p>
    </section>
  )
}

export type DocumentRowState =
  | 'QUEUED' | 'READING' | 'CLASSIFYING' | 'EXTRACTING' | 'CROSS_CHECKING'
  | 'PROCESSED' | 'WARNING' | 'LOW_CONFIDENCE' | 'FAILED' | 'REMOVED'

const ROW_TONE: Record<DocumentRowState, SemanticStatusTone> = {
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
  stateReason, progress, active, stale, lineage, actions, detail,
  detailOpen, onToggleDetail, detailToggleLabel, rowMotion,
}: {
  file: string
  typeLabel: string
  versionLabel: string
  /** Which building (or the project) the document is attributed to. */
  associationLabel: string
  note?: string
  state: DocumentRowState
  /** The state as a word. The accessible name is filename + state. */
  stateLabel: string
  stateReason?: string
  /** 0…1 processing progress. Only rendered while the row is not terminal. */
  progress: number
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
  rowMotion?: DocumentRowMotion
}) {
  const t = useT()
  const detailId = useId()
  const terminal = state === 'PROCESSED' || state === 'WARNING'
    || state === 'LOW_CONFIDENCE' || state === 'FAILED' || state === 'REMOVED'
  const className = `a3-drow ${ROW_CLASS[state]}${active ? ' a3-drow-current' : ''}`
  const Row = rowMotion ? motion.li : 'li'
  return (
    <Row className={className} {...(rowMotion ?? {})}>
      <div className="a3-drow-main">
        <span className="a3-drow-kind" aria-hidden="true">PDF</span>
        <div className="a3-drow-identity">
          <b className="a3-drow-file">{file}</b>
          <span className="a3-drow-meta">
            {typeLabel} · {versionLabel} · {associationLabel}
          </span>
          {note ? <span className="a3-drow-note">{note}</span> : null}
          {lineage ? <span className="a3-drow-lineage">{lineage}</span> : null}
        </div>
        <div className="a3-drow-progress">
          {terminal ? null : (
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
          )}
        </div>
        <div className="a3-drow-state">
          {/* The accessible name of the state is filename + state, so a
              screen-reader user never hears a bare "WARNING" with no
              subject. */}
          <SemanticStatus
            tone={stale ? 'stale' : ROW_TONE[state]}
            label={stateLabel}
            reason={stateReason}
            size="compact"
          />
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
          {detail && onToggleDetail ? (
            <button
              type="button"
              className="a3-drow-action a3-drow-action-ghost hit-target"
              aria-expanded={Boolean(detailOpen)}
              aria-controls={detailId}
              onClick={onToggleDetail}
            >
              {detailToggleLabel ?? t('ds.documentRow.inspect')}
            </button>
          ) : null}
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
