import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useStore,
  type UnderstandingTab,
} from '../state/store'
import {
  activeDocumentId,
  analysisWorkspaceState,
  attentionCount,
  cleanPresentation,
  conflictResolved,
  demoProject,
  documentDisplayState,
  documentLineage,
  documentProgress,
  eligibleDocuments,
  openQuestions,
  overallProgressPercent,
  processedCount,
  processedOutcomeCount,
  questionStatus,
  readiness,
  resolvedConflictValue,
  totalBgfRS,
  type AnalysisWorkspaceState,
  type DocumentDisplayState,
  type FixtureConflict,
  type FixtureDocument,
  type FixtureProject,
  type FixtureQuestion,
  type ProjectAnalysis,
} from '../state/projectAnalysis'
import {
  ANY_TYPE,
  DEFAULT_DOCUMENTS_QUERY,
  DOCUMENTS_PAGE_SIZE,
  activeDocumentFilters,
  decodeDocumentsQuery,
  documentSearchEntry,
  documentTypeCounts,
  documentsMatching,
  documentsPage,
  encodeDocumentsQuery,
  type DocumentStatusFilter,
  type DocumentsQuery,
} from '../state/projectDocumentsView'
import { formatDE } from '../engine/money'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { Button } from '../components/primitives'
import { Combobox, SegmentedControl } from '../components/controls'
import { FormField, NextStep, PageHeader, SectionSheet } from '../components/designSystem'
import { EmptyState, StaleState } from '../components/DataStates'
import { MediaFrame } from '../design-system/MediaFrame'
import { ProjectWorkflowNavigator } from '../components/WorkflowSpine'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { AuthorityTrace, MetricReadout, type InformationAuthority } from '../design-system/AuthorityTrace'
import {
  DocumentRow, ProcessingJob,
  type DocumentRowState, type ProcessingJobState,
} from '../design-system/ProcessingJob'
import { Pagination } from '../design-system/Pagination'
import { ActionGate, ProjectReadiness } from '../design-system/ActionGate'
import { ConflictResolver } from '../design-system/ConflictResolver'
import { QuestionItem, QuestionQueue } from '../design-system/QuestionQueue'
import { projectAsset } from '../assets/project-media'
import { useSemanticMotion } from '../design-system/motion'
import { InternalNoteDialog, ProjectOptionsSection } from './ProjectOptions'

/**
 * Project Home — the project half of the canonical journey (VR3-01, targets
 * `T-002`–`T-011`, motion `M-01`–`M-04`).
 *
 * This screen is a STATE MACHINE, not a page with sections. Which surface
 * exists at all is decided by the project's own analysis state, and that is
 * the whole point of the ticket: the surface it replaces mounted the
 * document list, the conflict panel, the question panel and the project
 * baseline table unconditionally, so a project whose analysis had never run
 * still showed a metrics strip and an empty conflict area. An empty
 * conflict area reads as "no conflicts". A zero metric reads as "zero".
 * Neither was true.
 *
 *   DOCUMENT_ANALYSIS_NOT_STARTED  → PrerequisiteState only
 *   DOCUMENT_ANALYSIS_RUNNING      → ProcessingJob, per-file rows
 *   DOCUMENT_ANALYSIS_PARTIAL_FAILURE → the same job, plus local recovery
 *   PROJECT_REVIEW_REQUIRED /
 *   BLOCKING_CONFLICTS_PRESENT     → Understanding, gate LOCKED with count
 *   PROJECT_READY_FOR_OPTION       → ProjectReadiness, gate OPEN
 *
 * The hard gate is exactly `unresolvedBlockingConflicts === 0 AND the
 * required baseline is complete`. It lives in `state/projectAnalysis.ts` so
 * it can be proved without rendering, and this file only ever reads it.
 */

/**
 * The job advances one file-phase per tick. Sequential, deterministic and
 * driven from here rather than from the store, so the store stays a pure
 * reducer and a test can drive the same progression with no timer at all.
 * 45 ms puts the 8-file project at roughly 1.8 s and the 36-file project at
 * roughly 8 s — long enough to be a legible story, short enough that no
 * expert is kept waiting for a demonstration.
 */
const ANALYSIS_TICK_MS = 45

/**
 * One stage of the Option-creation commitment.
 *
 * Creating an Option is a COMMITMENT — it journals the project baseline and
 * then creates the Option that inherits it — and the ticket requires both
 * `creating Option` and `Create Option error` to be observable states with
 * recovery that leaves readiness and resolution work intact. The canonical
 * Design System delta says the same thing about the control itself: the
 * action must "explain commitment level and asynchronous outcome".
 *
 * An earlier candidate ran both stages inside the click handler. The state
 * existed in the model and a unit test proved it, but React never painted
 * it and the failure branch could not be reached by anyone, which is
 * exactly what the acceptance audit rejected.
 *
 * On rule 25: what it forbids is INVENTED PROGRESS — "no made-up
 * percentages" — and what it prescribes instead is an indeterminate state
 * plus a protocol of completed phases. This shows no percentage and no
 * estimate; it names the stage that is actually pending, of two real stages
 * with real results. Simulating the duration of work that is real in
 * production is the prototype's own established convention: the document
 * analysis advances on exactly this pattern (DC-10), one file-phase per
 * tick.
 */
const OPTION_COMMIT_STAGE_MS = 200

/**
 * Rapid-click guard on Option creation (the retired project card's AUD-03
 * protection, kept). It is the SECOND line of defence: the first is
 * `beginOptionCreation`'s own idempotence, because the canonical Button
 * blocks with `aria-disabled` rather than `disabled` and a scripted click
 * therefore still dispatches.
 */
const OPTION_CREATE_GUARD_MS = 500

/**
 * The label for one document state. A processing PHASE and a terminal
 * OUTCOME are different vocabularies, and mixing them printed a raw key on
 * screen ("vr3.analysis.phase.PROCESSED") — caught in the browser, not by a
 * type: both are strings.
 */
function documentStateLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  state: DocumentRowState,
): string {
  const terminal = state === 'PROCESSED' || state === 'WARNING'
    || state === 'LOW_CONFIDENCE' || state === 'FAILED' || state === 'REMOVED'
  return terminal ? t(`vr3.analysis.outcome.${state}`) : t(`vr3.analysis.phase.${state}`)
}

export function ProjectHome() {
  const s = useStore()
  const t = useT()
  const project = demoProject(s.opportunityId)
  const analysis = project ? s.projectAnalyses[project.id] : undefined
  const [stageAnnouncement, setStageAnnouncement] = useState('')

  // The JOB's announcements — including its completion — belong to the one
  // live region the Documents workspace owns (M-03). They used to be split
  // between that region and this one, so a completed analysis was announced
  // twice; the rail now survives completion in place, so there is no longer
  // any reason for the shell to speak for it.
  //
  // What is left here is what genuinely outlives a stage change: the
  // Option-creation commitment, which is mounted by three different stages.
  // The Option-creation commitment advances here, in the shell, for the
  // same reason the completion announcement does: `CreateOptionGate` is
  // mounted by three different stages and the commitment must not depend on
  // which one is on screen — nor be ticked twice if two ever were.
  const commit = s.optionCommit?.projectId === project?.id ? s.optionCommit : null
  const commitStage = commit?.stage ?? null
  useEffect(() => {
    if (!commitStage) return
    const handle = window.setTimeout(() => s.advanceOptionCreation(), OPTION_COMMIT_STAGE_MS)
    return () => window.clearTimeout(handle)
  }, [commitStage, s])

  // The commitment and its outcome are announced politely: under reduced
  // motion there is no transition to watch, so the announcement IS the
  // feedback (the ticket requires reduced motion to preserve status, focus
  // and next action).
  //
  // The FAILURE is deliberately not announced here. `ActionGate` renders it
  // in a `role="alert"` region and takes focus to it, so repeating it in this
  // polite region would announce one failure twice.
  const previousCommitStage = useRef(commitStage)
  useEffect(() => {
    if (commitStage && !previousCommitStage.current) {
      setStageAnnouncement(t('vr3.readiness.announce.creating'))
    }
    previousCommitStage.current = commitStage
  }, [commitStage, t])

  if (!project || !analysis) return null

  const state = readiness(project, analysis)
  const stage = s.projectStage

  return (
    <div className="a3-project-shell">
      {/* Accepted 2026-09-05 Documents workspace audit, target anatomy 1-3:
          compact project CONTEXT, then a six-stage orientation, then the
          working object. The permanent thirteen-row spine that used to take
          the left column is gone — it consumed width to publish a workflow
          the user could not act on yet. */}
      <ProjectContextBar project={project} />
      <ProjectWorkflowNavigator project={project} analysis={analysis} />
      <div className="a3-project-main">
        {stage === 'documents' ? (
          <DocumentsWorkspace project={project} analysis={analysis} />
        ) : stage === 'understanding' ? (
          state.state === 'PROJECT_READY_FOR_OPTION' ? (
            <ReadyStage project={project} analysis={analysis} />
          ) : (
            <UnderstandingStage project={project} analysis={analysis} />
          )
        ) : (
          <OptionCreatedStage project={project} />
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{stageAnnouncement}</p>
    </div>
  )
}

/* ───────────────── stage 1 · the Documents workspace ───────────────── */

/**
 * The register's own state, mirrored in `location.search`.
 *
 * Same contract as the portfolio register (`OpportunityList`): a discrete
 * choice pushes a history entry so Back undoes the filter the user just
 * applied, and typing replaces it, because a history entry per keystroke
 * turns Back into a spell-checker. Encoding preserves parameters this
 * register does not own, so returning to the portfolio does not arrive with
 * its filters silently dropped.
 */
function useDocumentsQuery(): [
  DocumentsQuery,
  (next: Partial<DocumentsQuery>, history?: 'push' | 'replace') => void,
] {
  const [query, setQuery] = useState<DocumentsQuery>(() => (
    typeof window === 'undefined'
      ? DEFAULT_DOCUMENTS_QUERY
      : decodeDocumentsQuery(window.location.search)
  ))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => setQuery(decodeDocumentsQuery(window.location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const patch = useCallback((
    next: Partial<DocumentsQuery>, history: 'push' | 'replace' = 'push',
  ) => {
    setQuery((current) => {
      // Any change to search, type or status returns to page 1: the audit's
      // reset rule, applied where the change happens rather than in six call
      // sites that each have to remember it.
      const narrowed = next.text !== undefined || next.type !== undefined
        || next.status !== undefined
      const merged: DocumentsQuery = {
        ...current,
        ...next,
        page: next.page ?? (narrowed ? 1 : current.page),
      }
      if (typeof window !== 'undefined') {
        const search = encodeDocumentsQuery(merged, window.location.search)
        const url = `${window.location.pathname}${search ? `?${search}` : ''}`
        if (history === 'push') window.history.pushState(null, '', url)
        else window.history.replaceState(null, '', url)
      }
      return merged
    })
  }, [])

  return [query, patch]
}

/**
 * Project → Documents, rebuilt as a document-first analysis workspace
 * (accepted Design Director audit `docs/audit/documents-workspace-ux-audit-328330c.md`,
 * status ACCEPTED TARGET, 2026-09-05).
 *
 * The surface this replaces was six pages at once: a project landing page,
 * a thirteen-step sitemap, an analysis empty state, an explainer, a launch
 * control and — last, below all of it — the documents. At 1280×800 not one
 * document row reached the first viewport. The register is the working
 * object, so it takes the workspace; everything project-wide about the
 * analysis moves into ONE sticky rail beside it.
 *
 * Three boundaries hold this composition together:
 *
 * 1. **The register owns presentation, the rail owns the job.** Search,
 *    type, status and page decide which rows are listed. They decide
 *    nothing about scope: the CTA counts `eligibleDocuments`, which is the
 *    exact set `startJob`/`advanceJob` process, so "analyse all 36" cannot
 *    drift from what the operation does — the count and the operation read
 *    one function. Starting from page 2 of 6 still analyses all sixty.
 * 2. **A row owns only what is true about that document.** Its state, its
 *    reason, its recovery, its evidence. Never the job's progress.
 * 3. **Nothing claims more than the Product does.** Cancelling keeps the
 *    outcomes already produced — that is real — but `startJob` re-queues
 *    every eligible document, so a new run reads them all again and the
 *    rail says so instead of promising a resume that does not exist.
 */
function DocumentsWorkspace({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const { reduced, fadeRise, transition } = useSemanticMotion()
  const [query, patchQuery] = useDocumentsQuery()
  const [openDetailId, setOpenDetailId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const registerHeadingRef = useRef<HTMLHeadingElement>(null)
  const running = analysis.jobState === 'RUNNING' || analysis.jobState === 'PARTIAL_FAILURE'
  const workspaceState = analysisWorkspaceState(project, analysis)

  // M-01/M-02: the job advances itself, one file-phase at a time, and the
  // active file's name and state are announced politely. Cancelling stops
  // the ticks without discarding a single completed file.
  useEffect(() => {
    if (!running) return
    const handle = window.setTimeout(() => s.tickDocumentAnalysis(), ANALYSIS_TICK_MS)
    return () => window.clearTimeout(handle)
  }, [running, analysis.cursor, analysis.documents, s])

  const activeId = activeDocumentId(project, analysis)
  const activeDoc = activeId ? project.documents.find((d) => d.id === activeId) : null
  const activeState = activeId ? analysis.documents[activeId]?.state : undefined

  useEffect(() => {
    if (activeDoc && activeState) {
      setAnnouncement(t('vr3.analysis.announce.file', {
        file: activeDoc.file,
        state: documentStateLabel(t, activeState as DocumentRowState),
      }))
    }
  }, [activeDoc, activeState, t])

  // M-03: completion is ONE meaningful transition and it is announced once,
  // through the same region that has been narrating the run.
  const previousJobState = useRef(analysis.jobState)
  useEffect(() => {
    if (analysis.jobState === 'COMPLETE' && previousJobState.current !== 'COMPLETE') {
      setAnnouncement(t('vr3.analysis.announce.complete'))
    }
    previousJobState.current = analysis.jobState
  }, [analysis.jobState, t])

  /* ── the document set, and what is true about it ── */

  const documents = project.documents
  const eligible = eligibleDocuments(project, analysis)
  const attention = attentionCount(project, analysis)
  const processed = processedOutcomeCount(project, analysis)
  const done = processedCount(project, analysis)

  const association = (doc: FixtureDocument): string => (doc.projectLevel
    ? t('vr3.analysis.association.project')
    : t('vr3.analysis.association.buildings', {
      names: doc.buildingIds
        .map((id) => project.buildings.find((b) => b.id === id)?.name ?? id)
        .join(', '),
    }))

  // Search matches exactly what the register shows: filename, recognised
  // type, association. Nothing is searchable that is not visible.
  const searchIndex = useMemo(() => Object.fromEntries(documents.map((doc) => [
    doc.id,
    documentSearchEntry(doc.file, t(`vr3.docType.${doc.documentType}`), association(doc)),
  ])), [documents, t, project.buildings])

  const displayState = (docId: string): DocumentDisplayState => (
    documentDisplayState(analysis, docId, workspaceState)
  )

  const matching = documentsMatching(documents, query, searchIndex, displayState)
  const page = documentsPage(matching, query.page)
  const filtersActive = activeDocumentFilters(query)

  const typeOptions = useMemo(() => [
    { value: ANY_TYPE, label: t('vr3.documents.filter.allTypes') },
    ...documentTypeCounts(documents).map(({ type, count }) => ({
      value: type,
      label: t('vr3.documents.filter.typeOption', {
        type: t(`vr3.docType.${type}`), count,
      }),
    })),
  ], [documents, t])

  /* ── page changes: focus and one announcement, never a jump ── */

  const goToPage = (next: number) => {
    patchQuery({ page: next })
    setAnnouncement(t('vr3.documents.announce.page', {
      page: next,
      pages: page.pageCount,
      from: (next - 1) * DOCUMENTS_PAGE_SIZE + 1,
      to: Math.min(next * DOCUMENTS_PAGE_SIZE, page.total),
      total: page.total,
    }))
    registerHeadingRef.current?.focus()
    // `scrollIntoView` is optional by design, not by accident: the audit
    // asks for the register to be brought into view WHERE REQUIRED, and a
    // non-browser host (jsdom, a print pass) has no scrolling to do. It is
    // an enhancement of the focus move above, never its precondition.
    registerHeadingRef.current?.scrollIntoView?.({
      block: 'start', behavior: reduced ? 'auto' : 'smooth',
    })
  }

  const resetFilters = () => patchQuery({
    text: '', type: ANY_TYPE, status: 'all', page: 1,
  })

  const countLabel = filtersActive > 0
    ? t('vr3.documents.count.filtered', { shown: page.total, total: documents.length })
    : t('vr3.documents.count.all', { count: documents.length })

  return (
    <>
      <header className="a3-docws-head">
        <h1 className="a3-docws-title" tabIndex={-1} data-page-heading>
          {t('vr3.documents.title')}
        </h1>
        {/* The total is stated once, by the register's own heading below.
            The page header adds only what that line cannot: whether
            anything needs a decision. */}
        {attention > 0 ? (
          <p className="a3-docws-summary">
            {t('vr3.documents.summary.attention', { attention })}
          </p>
        ) : null}
      </header>

      <div className="a3-docws">
        {/* The rail comes FIRST in the DOM: the audit's keyboard order is
            context → workflow → the global analysis action → filters → rows
            → pagination, and reaching the primary action of the page by
            tabbing through ten rows first is not an order, it is a queue.
            At desktop it is placed in the second grid column; below the
            supported desktop range it simply stacks where it already is. */}
        <aside className="a3-docws-rail" aria-label={t('vr3.documents.rail.label')}>
          <AnalysisRail
            project={project}
            analysis={analysis}
            workspaceState={workspaceState}
            eligibleCount={eligible.length}
            attentionCount={attention}
            processedCount={processed}
            doneCount={done}
            activeFile={activeDoc?.file ?? null}
            activePhase={activeState
              ? documentStateLabel(t, activeState as DocumentRowState)
              : null}
            announcement={announcement}
            onShowAttention={() => patchQuery({ status: 'attention' })}
          />
        </aside>

        <section className="a3-docws-register" aria-labelledby="documents-register-heading">
          <div className="a3-docws-controls">
          <div
            role="search"
            aria-label={t('vr3.documents.filter.legend')}
            className="a3-docws-toolbar"
          >
            <div className="a3-docws-control a3-docws-control-search">
              <FormField htmlFor="documents-search" label={t('vr3.documents.filter.search')}>
                <input
                  id="documents-search"
                  type="search"
                  value={query.text}
                  placeholder={t('vr3.documents.filter.searchPlaceholder')}
                  onChange={(event) => patchQuery({ text: event.target.value }, 'replace')}
                />
              </FormField>
            </div>
            <div className="a3-docws-control a3-docws-control-type">
              <Combobox
                id="documents-type"
                label={t('vr3.documents.filter.type')}
                value={query.type}
                options={typeOptions}
                onChange={(value) => patchQuery({ type: value })}
                placeholder={t('vr3.documents.filter.allTypes')}
              />
            </div>
            {/* The status filter exists only once analysis has produced
                states to filter BY. Before that it would be three empty
                choices dressed as a control. */}
            {workspaceState !== 'READY' ? (
              <div className="a3-docws-control">
              <SegmentedControl
                legend={t('vr3.documents.filter.status')}
                value={query.status}
                onChange={(value: DocumentStatusFilter) => patchQuery({ status: value })}
                options={[
                  { value: 'all', label: t('vr3.documents.filter.statusAll') },
                  {
                    value: 'attention',
                    label: t('vr3.documents.filter.statusAttention'),
                  },
                  {
                    value: 'processed',
                    label: t('vr3.documents.filter.statusProcessed'),
                  },
                ]}
              />
              </div>
            ) : null}
          </div>

          <div className="a3-docws-count">
            {/* The result count IS the register's heading: it names the
                region, it is the visible focus target after a page change,
                and it is the one place the filtered/unfiltered truth is
                stated. A second decorative "Dokumentenregister" title
                above it would repeat the H1 and cost a row of the first
                viewport. */}
            <h2
              id="documents-register-heading"
              ref={registerHeadingRef}
              tabIndex={-1}
              className="a3-docws-count-text"
            >
              {countLabel}
            </h2>
            {filtersActive > 0 ? (
              <Button variant="ghost" onClick={resetFilters}>
                {t('vr3.documents.filter.reset')}
              </Button>
            ) : null}
          </div>
          </div>

          {documents.length === 0 ? (
            <EmptyState>{t('vr3.documents.empty.noDocuments')}</EmptyState>
          ) : page.total === 0 ? (
            <EmptyState action={(
              <Button variant="secondary" onClick={resetFilters}>
                {t('vr3.documents.filter.reset')}
              </Button>
            )}
            >
              {t('vr3.documents.empty.noMatches')}
            </EmptyState>
          ) : (
            <ul className="a3-pjob-rows">
              <AnimatePresence initial={false}>
                {page.rows.map((doc, index) => (
                  <DocumentRegisterRow
                    key={doc.id}
                    project={project}
                    analysis={analysis}
                    doc={doc}
                    rowState={displayState(doc.id) as DocumentRowState}
                    associationLabel={association(doc)}
                    openDetailId={openDetailId}
                    onToggleDetail={setOpenDetailId}
                    // M-01: the queue is ADMITTED in place, one canonical
                    // `fadeRise` per row with the bounded causal wave — never
                    // a stagger longer than the reveal itself, and nothing at
                    // all under `prefers-reduced-motion`.
                    rowMotion={reduced ? undefined : {
                      variants: fadeRise,
                      initial: 'hidden',
                      animate: 'visible',
                      transition: transition('reveal', Math.min(index, 6)),
                    }}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}

          {page.paginated ? (
            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              onPageChange={goToPage}
              ariaLabel={t('vr3.documents.pagination.label')}
              rangeLabel={t('vr3.documents.pagination.range', {
                from: page.from, to: page.to, total: page.total,
              })}
              pageButtonLabel={(n) => t('vr3.documents.pagination.page', { page: n })}
            />
          ) : null}
        </section>
      </div>
    </>
  )
}

/**
 * The analysis context rail — everything project-wide about the job, once.
 *
 * The not-started state used to be told six times (eyebrow, lede, empty
 * card, CTA, queued count, every row). It is told here, once, together with
 * the scope the action applies to. The rail never derives anything from the
 * visible page: its counts come from the eligible project set.
 */
function AnalysisRail({
  project, analysis, workspaceState, eligibleCount, attentionCount: attention,
  processedCount: processed, doneCount, activeFile, activePhase, announcement,
  onShowAttention,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  workspaceState: AnalysisWorkspaceState
  eligibleCount: number
  attentionCount: number
  processedCount: number
  doneCount: number
  activeFile: string | null
  activePhase: string | null
  announcement: string
  onShowAttention: () => void
}) {
  const s = useStore()
  const t = useT()
  const total = project.documents.length
  const running = workspaceState === 'ANALYSING'
  const terminal = workspaceState === 'COMPLETE' || workspaceState === 'COMPLETE_WITH_ISSUES'
  const jobState: ProcessingJobState = workspaceState === 'ANALYSING'
    ? 'RUNNING'
    : workspaceState

  const startLabel = t('vr3.analysis.start.scoped', { count: eligibleCount })

  const summary = (
    <dl className="a3-docws-facts">
      <div className="a3-docws-fact">
        <dt>{t('vr3.documents.rail.fact.documents')}</dt>
        <dd className="numeric">{total}</dd>
      </div>
      <div className="a3-docws-fact">
        <dt>{t('vr3.documents.rail.fact.eligible')}</dt>
        <dd className="numeric">{eligibleCount}</dd>
      </div>
      {workspaceState === 'READY' ? null : (
        <>
          <div className="a3-docws-fact">
            <dt>{t('vr3.documents.rail.fact.processed')}</dt>
            <dd className="numeric">{processed}</dd>
          </div>
          <div className="a3-docws-fact">
            <dt>{t('vr3.documents.rail.fact.attention')}</dt>
            <dd className="numeric">{attention}</dd>
          </div>
        </>
      )}
    </dl>
  )

  const outcome = terminal ? (
    <dl className="a3-docws-facts">
      <div className="a3-docws-fact">
        <dt>{t('vr3.documents.rail.result.values')}</dt>
        <dd className="numeric">{project.analysis.valuesExtracted}</dd>
      </div>
      <div className="a3-docws-fact">
        <dt>{t('vr3.documents.rail.result.buildings')}</dt>
        <dd className="numeric">{project.buildings.length}</dd>
      </div>
      <div className="a3-docws-fact">
        <dt>{t('vr3.documents.rail.result.conflicts')}</dt>
        <dd className="numeric">{project.conflicts.length}</dd>
      </div>
      <div className="a3-docws-fact">
        <dt>{t('vr3.documents.rail.result.questions')}</dt>
        <dd className="numeric">{openQuestions(project, analysis).length}</dd>
      </div>
    </dl>
  ) : null

  return (
    <ProcessingJob
      layout="rail"
      state={jobState}
      heading={t(`vr3.documents.rail.title.${workspaceState}`)}
      processedCount={doneCount}
      totalCount={eligibleCount}
      progressPercent={overallProgressPercent(project, analysis)}
      activeFileName={activeFile}
      activePhaseLabel={activePhase}
      announcement={announcement}
      summary={(
        <>
          {summary}
          {outcome}
          <p className="a3-docws-rail-lede">
            {t(`vr3.documents.rail.lede.${workspaceState}`, {
              count: eligibleCount, attention, processed: doneCount,
            })}
          </p>
        </>
      )}
      actions={(
        <>
          {workspaceState === 'READY' || workspaceState === 'CANCELLED' ? (
            <Button
              variant="primary"
              disabled={eligibleCount === 0}
              disabledReason={t('vr3.documents.empty.noDocuments')}
              onClick={() => s.startDocumentAnalysis()}
            >
              {startLabel}
            </Button>
          ) : null}
          {running ? (
            <Button variant="secondary" onClick={() => s.cancelDocumentAnalysis()}>
              {t('vr3.analysis.cancel')}
            </Button>
          ) : null}
          {terminal ? (
            <Button variant="primary" onClick={() => s.setProjectStage('understanding')}>
              {t('vr3.documents.rail.review')}
            </Button>
          ) : null}
          {workspaceState === 'COMPLETE_WITH_ISSUES' ? (
            <Button variant="secondary" onClick={onShowAttention}>
              {t('vr3.documents.rail.showAttention', { count: attention })}
            </Button>
          ) : null}
          {terminal ? (
            <Button variant="ghost" onClick={() => s.rerunDocumentAnalysis()}>
              {t('vr3.analysis.rerun')}
            </Button>
          ) : null}
        </>
      )}
      notice={workspaceState === 'READY' || workspaceState === 'CANCELLED' ? (
        <p className="a3-docws-rail-scope">{t('vr3.documents.rail.scopeHelper')}</p>
      ) : null}
    />
  )
}

function DocumentRegisterRow({
  project, analysis, doc, rowState, associationLabel, openDetailId,
  onToggleDetail, rowMotion,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  doc: FixtureDocument
  rowState: DocumentRowState
  associationLabel: string
  openDetailId: string | null
  onToggleDetail: (id: string | null) => void
  rowMotion?: Parameters<typeof DocumentRow>[0]['rowMotion']
}) {
  const s = useStore()
  const t = useT()
  const runtime = analysis.documents[doc.id]
  const terminal = rowState === 'PROCESSED' || rowState === 'WARNING'
    || rowState === 'LOW_CONFIDENCE' || rowState === 'FAILED' || rowState === 'REMOVED'
  const lineage = documentLineage(project, doc.id)
  const asset = doc.previewAssetId ? projectAsset(doc.previewAssetId) : null
  const active = activeDocumentId(project, analysis) === doc.id
  const open = openDetailId === doc.id

  const lineageText = [
    lineage.supersedes ? t('vr3.analysis.lineage.supersedes', { file: lineage.supersedes.file }) : null,
    lineage.supersededBy ? t('vr3.analysis.lineage.supersededBy', { file: lineage.supersededBy.file }) : null,
    lineage.duplicateOf ? t('vr3.analysis.lineage.duplicateOf', { file: lineage.duplicateOf.file }) : null,
    runtime?.replacementFile
      ? t('vr3.analysis.replacementSuffix', { file: runtime.replacementFile })
      : null,
  ].filter(Boolean).join(' · ')

  return (
    <DocumentRow
      density="compact"
      file={doc.file}
      typeLabel={t(`vr3.docType.${doc.documentType}`)}
      versionLabel={doc.version}
      associationLabel={associationLabel}
      note={doc.issueKey ? t(doc.issueKey) : undefined}
      state={rowState}
      stateLabel={documentStateLabel(t, rowState)}
      stateReason={terminal && rowState !== 'PROCESSED' && rowState !== 'REMOVED'
        ? `${t(`vr3.recognition.${doc.recognitionQuality}`)} · ${t(`vr3.medium.${doc.recognitionMedium}`)}`
        : undefined}
      progress={documentProgress(runtime?.state ?? 'QUEUED')}
      active={active}
      stale={runtime?.stale}
      lineage={lineageText || undefined}
      rowMotion={rowMotion}
      // Recovery stays exactly where the Product supports it: an outcome
      // that needs a decision. It is no longer the gatekeeper of
      // inspection — every row below has that, always.
      actions={terminal && rowState !== 'REMOVED' && rowState !== 'PROCESSED' ? [
        {
          id: 'retry',
          label: t('vr3.analysis.action.retry'),
          onSelect: () => s.retryDocumentRow(doc.id),
        },
        {
          id: 'replace',
          label: t('vr3.analysis.action.replace'),
          onSelect: () => s.replaceDocumentRow(
            doc.id, `${doc.file.replace('.pdf', '')}_REV-B.pdf`,
          ),
        },
        {
          id: 'remove',
          label: t('vr3.analysis.action.remove'),
          priority: 'ghost' as const,
          onSelect: () => {
            if (window.confirm(t('vr3.analysis.removeConfirm', { file: doc.file }))) {
              s.removeDocumentRow(doc.id)
            }
          },
        },
      ] : undefined}
      detailToggleLabel={t('vr3.analysis.action.inspect')}
      detailOpen={open}
      onToggleDetail={() => onToggleDetail(open ? null : doc.id)}
      detail={(
        <>
          <p className="a3-doc-detail-meta">
            {t(`vr3.sourceAuthority.${doc.sourceAuthority}`)}
            {' · '}
            {doc.issuedAt}
          </p>
          {rowState === 'FAILED' ? (
            <p className="a3-doc-detail-meta">{t('vr3.evidence.failedPreview')}</p>
          ) : null}
          <MediaFrame
            ratio="tile"
            state={rowState === 'FAILED' ? 'error' : asset ? 'loaded' : 'unavailable'}
            src={asset?.url}
            alt={asset ? t(asset.altKey) : undefined}
            seed={doc.id}
            sourceId={asset?.assetId}
            caption={t('vr3.evidence.assetCaption', { label: doc.file })}
          />
        </>
      )}
    />
  )
}

/* ────────────────────── stage 2 · understanding ────────────────────── */

function UnderstandingStage({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const t = useT()
  const state = readiness(project, analysis)
  const tab = useStore().understandingTab

  const tabs: Array<{ id: UnderstandingTab; label: string }> = [
    { id: 'overview', label: t('vr3.understanding.tab.overview') },
    {
      id: 'conflicts',
      label: t('vr3.understanding.tab.conflicts', { count: project.conflicts.length }),
    },
    {
      id: 'questions',
      label: t('vr3.understanding.tab.questions', {
        count: openQuestions(project, analysis).length,
      }),
    },
  ]

  return (
    <>
      <div className="a3-project-stage-head">
        <p className="a3-project-stage-eyebrow">{t('vr3.understanding.eyebrow')}</p>
        <PageHeader
          title={tab === 'conflicts'
            ? t('vr3.understanding.conflictsTitle')
            : tab === 'questions'
              ? t('vr3.understanding.questionsTitle')
              : project.name}
          lede={project.route === 'clean'
            ? t('vr3.understanding.lead.clean')
            : t('vr3.understanding.lead.complex')}
        />
      </div>
      <div className="a3-understanding-status">
        <SemanticStatus
          tone={state.state === 'PROJECT_READY_FOR_OPTION' ? 'ok' : 'attention'}
          label={state.state === 'PROJECT_READY_FOR_OPTION'
            ? t('vr3.readiness.eyebrow.ready')
            : t('vr3.readiness.eyebrow.review')}
        />
      </div>
      {/* Only mounted once the analysis has produced results, so these tabs
          can never advertise a section that has nothing behind it. */}
      <UnderstandingTabList tabs={tabs} current={tab} />
      <div
        id={`understanding-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`understanding-tab-${tab}`}
        tabIndex={-1}
        className="a3-understanding-panel"
      >
        {tab === 'overview' ? (
          <UnderstandingOverview
            project={project}
            analysis={analysis}
            readinessPanel={(
              <>
                <ReadinessRows project={project} analysis={analysis} />
                <CreateOptionGate project={project} analysis={analysis} />
              </>
            )}
          />
        ) : tab === 'conflicts' ? (
          <ConflictsPanel project={project} analysis={analysis} />
        ) : (
          <QuestionsPanel project={project} analysis={analysis} />
        )}
      </div>
    </>
  )
}

function useLocalNumber() {
  const s = useStore()
  return (value: string | number, decimals = 0) => localizeMoneyText(
    formatDE(new Decimal(value), decimals), s.uiLanguage,
  )
}

function UnderstandingOverview({
  project, analysis, readinessPanel,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  /**
   * What the readiness sheet contains. `UnderstandingStage` puts the
   * readiness rows AND the Create Option gate here, because there the gate
   * is the page's one continuation. `ReadyStage` already carries the gate
   * in its hero, so it passes the rows alone — two "Option anlegen"
   * buttons on one screen is exactly the competing primary action DC-27
   * forbids (caught by the DOM suite, which found both).
   */
  readinessPanel: ReactNode
}) {
  const t = useT()
  const num = useLocalNumber()
  const state = readiness(project, analysis)
  const dist = project.terminalDistribution

  return (
    <div className="a3-understanding-body">
      {/* Reveal order: readiness and attention → metrics and buildings →
          conflicts and questions → evidence detail. */}
      <dl className="a3-understanding-metrics">
        <MetricReadout
          label={t('vr3.understanding.metric.buildings')}
          value={num(project.buildings.length)}
          variant="compact"
        />
        <MetricReadout
          label={t('vr3.understanding.metric.bgf')}
          value={num(totalBgfRS(project))}
          unit="m²"
          variant="compact"
          authority="derived"
        />
        <MetricReadout
          label={t('vr3.understanding.metric.documents')}
          value={`${num(processedCount(project, analysis))}/${num(project.documents.length)}`}
          variant="compact"
        />
        <MetricReadout
          label={t('vr3.understanding.metric.blockingConflicts')}
          value={num(state.unresolvedBlockingConflicts)}
          variant="compact"
        />
      </dl>

      <div className="a3-understanding-grid">
        <SectionSheet title={t('vr3.understanding.understoodTitle')}>
          <p className="a3-understanding-copy">
            {t(project.analysis.understandingKey)}
            {' '}
            {t('vr3.understanding.valuesExtracted', { count: project.analysis.valuesExtracted })}
            {project.analysis.valuesRequiringAttention > 0
              ? `; ${t('vr3.understanding.valuesAttention', { count: project.analysis.valuesRequiringAttention })}`
              : ''}
          </p>
          <dl className="a3-readiness-rows">
            <div className="a3-readiness-row">
              <dt className="a3-readiness-row-label">{t('vr3.understanding.row.sourceEvidence')}</dt>
              <dd className="a3-readiness-row-value">
                {t('vr3.understanding.row.values', { count: project.analysis.sourceEvidencedValues })}
              </dd>
            </div>
            <div className="a3-readiness-row">
              <dt className="a3-readiness-row-label">{t('vr3.understanding.row.aiInferred')}</dt>
              <dd className="a3-readiness-row-value">
                {t('vr3.understanding.row.values', { count: project.analysis.aiInferredValues })}
              </dd>
            </div>
            <div className="a3-readiness-row">
              <dt className="a3-readiness-row-label">{t('vr3.understanding.row.manualConfirmed')}</dt>
              <dd className="a3-readiness-row-value">
                {t('vr3.understanding.row.values', { count: project.analysis.manualOrConfirmedValues })}
              </dd>
            </div>
            <div className="a3-readiness-row">
              <dt className="a3-readiness-row-label">{t('vr3.understanding.metric.documents')}</dt>
              <dd className="a3-readiness-row-value">
                {t('vr3.understanding.terminalSummary', {
                  processed: dist.processed,
                  warning: dist.warning,
                  lowConfidence: dist.lowConfidence,
                  failed: dist.failed,
                })}
              </dd>
            </div>
          </dl>
        </SectionSheet>

        <SectionSheet title={t('vr3.readiness.eyebrow.review')}>
          {readinessPanel}
        </SectionSheet>
      </div>

      {analysis.staleFactKeys.length > 0 ? (
        <StaleState>
          {t('vr3.understanding.staleNotice', { count: analysis.staleFactKeys.length })}
        </StaleState>
      ) : null}

      <SectionSheet title={t('vr3.understanding.buildingsTitle')}>
        <ul className="a3-building-list">
          {project.buildings.map((building) => {
            const asset = projectAsset(building.identityAssetId)
            return (
              <li key={building.id} className="a3-building-item">
                <div className="a3-building-media">
                  <MediaFrame
                    ratio="tile"
                    state={asset ? 'loaded' : 'fallback'}
                    src={asset?.url}
                    alt={asset ? t(asset.altKey) : undefined}
                    seed={building.id}
                    sourceId={asset?.assetId}
                  />
                </div>
                <div className="a3-building-body">
                  <h3 className="a3-building-name">{building.name}</h3>
                  <p className="a3-building-meta">
                    {t(building.usageKey)} · {t(building.storeysKey)}
                    {' · '}
                    {t(`vr3.building.underground.${building.undergroundLevel}`)}
                  </p>
                  {/* The leading area is the value the whole commercial
                      scale rests on, so it carries its evidence with it
                      rather than a bare authority badge. */}
                  <div className="a3-building-authority">
                    <p className="a3-building-authority-label">
                      {t('vr3.understanding.metric.bgf')}
                    </p>
                    <AuthorityTrace
                      authority={(building.authority.bgfRSTotal ?? 'derived') as InformationAuthority}
                      evidence={{
                        label: project.documents
                          .find((d) => d.id === building.evidenceDocIds[0])?.file
                          ?? building.evidenceDocIds[0] ?? building.id,
                      }}
                      layout="stacked"
                    >
                      <span className="numeric">{num(building.metrics.bgfRSTotal)}</span>
                      <span className="a3-mro-unit">m²</span>
                    </AuthorityTrace>
                  </div>
                  <dl className="a3-building-metrics">
                    {building.metrics.wfl ? (
                      <MetricReadout
                        label="WFL"
                        value={num(building.metrics.wfl)}
                        unit="m²"
                        variant="compact"
                        authority={(building.authority.wfl ?? 'sourceEvidenced') as InformationAuthority}
                      />
                    ) : null}
                    {building.metrics.nuf ? (
                      <MetricReadout
                        label="NUF"
                        value={num(building.metrics.nuf)}
                        unit="m²"
                        variant="compact"
                        authority={(building.authority.nuf ?? 'sourceEvidenced') as InformationAuthority}
                      />
                    ) : null}
                    {building.metrics.units !== null ? (
                      <MetricReadout
                        // The label names the QUANTITY, the value carries
                        // the number. Passing the counted phrase as the
                        // label printed "48 Wohnungen" above a bare "48" —
                        // the same fact twice (no duplicated labels).
                        label={t('vr3.understanding.metric.units')}
                        value={num(building.metrics.units)}
                        variant="compact"
                        authority={(building.authority.units ?? 'sourceEvidenced') as InformationAuthority}
                      />
                    ) : null}
                  </dl>
                  <p className="a3-building-evidence">
                    {t('vr3.understanding.buildingEvidence', {
                      files: building.evidenceDocIds
                        .map((id) => project.documents.find((d) => d.id === id)?.file ?? id)
                        .join(', '),
                    })}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </SectionSheet>
    </div>
  )
}

function ConflictsPanel({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const t = useT()
  const state = readiness(project, analysis)
  if (project.conflicts.length === 0) {
    // No ceremony for an empty issue queue on the clean route: the absence
    // is stated once, in one sentence, and the page moves on.
    return (
      <p className="a3-understanding-copy">{t('vr3.understanding.conflictsResolvedIntro')}</p>
    )
  }
  return (
    <div className="a3-understanding-body">
      <p className="a3-understanding-copy">
        {state.unresolvedBlockingConflicts > 0
          ? t('vr3.understanding.conflictsIntro', { count: state.unresolvedBlockingConflicts })
          : t('vr3.understanding.conflictsResolvedIntro')}
      </p>
      {project.conflicts.map((conflict) => (
        <ConflictCard key={conflict.id} project={project} analysis={analysis} conflict={conflict} />
      ))}
    </div>
  )
}

function ConflictCard({
  project, analysis, conflict,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  conflict: FixtureConflict
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const decision = analysis.conflictDecisions[conflict.id]
  const resolved = conflictResolved(analysis, conflict.id)
  const [choice, setChoice] = useState<string>(conflict.recommendedCandidateId)

  const candidateLabel = (candidateId: string) => {
    const candidate = conflict.candidates.find((c) => c.id === candidateId)
    if (!candidate) return candidateId
    return candidate.valueKey
      ? t(candidate.valueKey)
      : `${num(candidate.value ?? '0')}${conflict.unit ? ` ${conflict.unit}` : ''}`
  }

  const scopeLabel = conflict.buildingId
    ? t('vr3.understanding.conflictScopeBuilding', {
      name: project.buildings.find((b) => b.id === conflict.buildingId)?.name ?? conflict.buildingId,
    })
    : t('vr3.understanding.conflictScopeProject')

  const resolvedValue = resolvedConflictValue(conflict, decision)

  return (
    <ConflictResolver
      conceptLabel={t(conflict.conceptKey)}
      scopeLabel={scopeLabel}
      blocking={conflict.blocking}
      impact={`${t(conflict.mattersKey)} ${t(conflict.affectsKey)}`}
      sources={conflict.candidates.map((candidate) => {
        const doc = project.documents.find((d) => d.id === candidate.docId)
        const asset = doc?.previewAssetId ? projectAsset(doc.previewAssetId) : null
        return {
          id: candidate.id,
          value: candidate.valueKey
            ? t(candidate.valueKey)
            : num(candidate.value ?? '0'),
          unit: candidate.valueKey ? undefined : conflict.unit ?? undefined,
          authority: (candidate.superseded
            ? 'historical'
            : candidate.lowConfidence
              ? 'aiInferred'
              : 'sourceEvidenced') as InformationAuthority,
          authorityLabel: t(`vr3.sourceAuthority.${candidate.authority}`),
          documentLabel: doc?.file ?? candidate.docId,
          version: doc?.version ?? '',
          issuedAt: doc?.issuedAt ?? '',
          superseded: candidate.superseded,
          lowConfidence: candidate.lowConfidence,
          recommended: candidate.recommended,
          preview: asset ? (
            <MediaFrame
              ratio="tile"
              state="loaded"
              src={asset.url}
              alt={t(asset.altKey)}
              seed={candidate.id}
              sourceId={asset.assetId}
            />
          ) : undefined,
        }
      })}
      recommendation={t('vr3.understanding.conflictChoiceCandidate', {
        value: candidateLabel(conflict.recommendedCandidateId),
      })}
      choiceLegend={t('vr3.understanding.conflictChoiceLegend')}
      choices={conflict.candidates.map((candidate) => ({
        id: candidate.id,
        label: t('vr3.understanding.conflictChoiceCandidate', {
          value: candidateLabel(candidate.id),
        }),
        detail: candidate.recommended
          ? t('vr3.understanding.conflictChoiceRecommendedValue')
          : candidate.superseded
            ? t('vr3.understanding.conflictChoiceSuperseded')
            : t('vr3.understanding.conflictChoiceOlder'),
        selected: choice === candidate.id,
        onSelect: () => setChoice(candidate.id),
      }))}
      confirmAction={(
        <Button
          variant="primary"
          onClick={() => s.resolveProjectConflict(conflict.id, {
            kind: 'candidate', candidateId: choice,
          })}
        >
          {t('vr3.understanding.conflictConfirm')}
        </Button>
      )}
      inspectAction={(
        <Button variant="secondary" onClick={() => s.setUnderstandingTab('overview')}>
          {t('vr3.understanding.conflictInspect')}
        </Button>
      )}
      resolved={resolved && decision ? {
        valueLabel: resolvedValue?.valueKey
          ? t(resolvedValue.valueKey)
          : `${resolvedValue?.displayValue ?? ''}${conflict.unit ? ` ${conflict.unit}` : ''}`,
        actor: decision.actor,
        at: decision.at.slice(0, 10),
        rejectedLabel: t('vr3.understanding.conflictRejected', {
          values: decision.rejectedCandidateIds.map(candidateLabel).join(', '),
        }),
      } : undefined}
      reopen={resolved ? {
        label: t('vr3.understanding.conflictReopen'),
        onSelect: () => s.reopenProjectConflict(conflict.id),
      } : undefined}
    />
  )
}

function QuestionsPanel({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const t = useT()
  const state = readiness(project, analysis)
  const open = openQuestions(project, analysis)

  if (project.questions.length === 0) {
    return <p className="a3-understanding-copy">{t('vr3.understanding.questionsNoneIntro')}</p>
  }

  return (
    <QuestionQueue
      heading={t('vr3.understanding.tab.questions', { count: open.length })}
      summary={t('vr3.understanding.questionsIntro', {
        open: open.length,
        blocking: state.blockingQuestions,
        assumptions: state.permittedAssumptions,
      })}
      note={state.permittedAssumptions > 0 ? t('vr3.understanding.questionsNote') : undefined}
    >
      {project.questions.map((question) => (
        <QuestionCard key={question.id} project={project} analysis={analysis} question={question} />
      ))}
    </QuestionQueue>
  )
}

function QuestionCard({
  project, analysis, question,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  question: FixtureQuestion
}) {
  const s = useStore()
  const t = useT()
  const status = questionStatus(question, analysis)
  const response = analysis.questionResponses[question.id]
  const scope = question.buildingId
    ? t('vr3.understanding.conflictScopeBuilding', {
      name: project.buildings.find((b) => b.id === question.buildingId)?.name ?? question.buildingId,
    })
    : t('vr3.understanding.conflictScopeProject')

  return (
    <QuestionItem
      kind={question.kind}
      status={status}
      blocking={question.blocking}
      question={t(question.questionKey)}
      scopeLabel={scope}
      matters={t(question.mattersKey)}
      evidenceContext={t(question.evidenceKey)}
      assumption={question.assumptionPermitted ? t(question.responseKey) : undefined}
      response={response ? {
        label: t(question.responseKey),
        actor: response.actor,
        at: response.at.slice(0, 10),
      } : undefined}
      actions={response ? undefined : (
        <>
          <Button
            variant="secondary"
            onClick={() => s.recordProjectQuestionResponse(question.id, 'answer')}
          >
            {t('vr3.understanding.recordAnswer')}
          </Button>
          {question.assumptionPermitted ? (
            <Button
              variant="ghost"
              onClick={() => s.recordProjectQuestionResponse(question.id, 'assumption')}
            >
              {t('vr3.understanding.acceptAssumption')}
            </Button>
          ) : null}
        </>
      )}
    />
  )
}

/* ─────────────────── readiness rows and the Option gate ─────────────────── */

function ReadinessRows({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const t = useT()
  const state = readiness(project, analysis)
  return (
    <dl className="a3-readiness-rows">
      <div className="a3-readiness-row">
        <dt className="a3-readiness-row-label">{t('vr3.readiness.row.analysisComplete')}</dt>
        <dd className="a3-readiness-row-value">
          <SemanticStatus
            tone={state.analysisComplete ? 'ok' : 'neutral'}
            label={state.analysisComplete
              ? t('ds.processingJob.state.complete')
              : t('ds.processingJob.state.notStarted')}
            size="compact"
          />
        </dd>
      </div>
      <div className="a3-readiness-row">
        <dt className="a3-readiness-row-label">{t('vr3.readiness.row.blockingConflicts')}</dt>
        <dd className="a3-readiness-row-value">{state.unresolvedBlockingConflicts}</dd>
      </div>
      <div className="a3-readiness-row">
        <dt className="a3-readiness-row-label">{t('vr3.readiness.row.requiredInformation')}</dt>
        <dd className="a3-readiness-row-value">
          {state.requiredBaselineComplete >= state.requiredBaselineTotal
            ? t('vr3.readiness.row.requiredInformationComplete')
            : t('vr3.readiness.row.requiredInformationReview')}
        </dd>
      </div>
      <div className="a3-readiness-row">
        <dt className="a3-readiness-row-label">{t('vr3.readiness.row.openQuestions')}</dt>
        <dd className="a3-readiness-row-value">
          {t('vr3.readiness.row.openQuestionsValue', {
            open: state.openQuestions, blocking: state.blockingQuestions,
          })}
        </dd>
      </div>
    </dl>
  )
}

function CreateOptionGate({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const state = readiness(project, analysis)
  // The commitment is top-level and transient, and it belongs to ONE
  // project: a commitment opened elsewhere must not make this gate busy.
  const commit = s.optionCommit?.projectId === project.id ? s.optionCommit : null
  const busy = Boolean(commit?.stage)
  const errorKey = commit?.errorKey ?? null
  const lastRequestAt = useRef(0)

  const create = () => {
    // Guarded by STATE first, then by time. `beginOptionCreation` is
    // idempotent for the same reason, so three independent things would
    // have to fail at once to create two Options from one intent.
    if (busy) return
    const now = Date.now()
    if (now - lastRequestAt.current < OPTION_CREATE_GUARD_MS) return
    lastRequestAt.current = now
    // Only OPENS the commitment. The stages are advanced by the shell's
    // own tick, so the busy state is actually painted and the gate is
    // re-read at every stage boundary.
    s.beginOptionCreation()
  }

  return (
    <ActionGate
      status={errorKey
        ? 'error'
        : busy ? 'busy' : state.canCreateOption ? 'available' : 'locked'}
      // The reason is NOT repeated here: the canonical Button below renders
      // its `disabledReason` in reading order and associates it with
      // `aria-describedby`. One sentence, one place.
      prerequisites={[
        {
          id: 'analysis',
          label: t('vr3.readiness.prereq.analysis'),
          met: state.analysisComplete,
        },
        {
          id: 'conflicts',
          label: t('vr3.readiness.prereq.conflicts'),
          met: state.unresolvedBlockingConflicts === 0,
          detail: t('vr3.readiness.prereq.conflictsDetail', {
            count: state.unresolvedBlockingConflicts,
          }),
        },
        {
          id: 'baseline',
          label: t('vr3.readiness.prereq.baseline'),
          met: state.requiredBaselineComplete >= state.requiredBaselineTotal,
          detail: t('vr3.readiness.prereq.baselineDetail', {
            done: state.requiredBaselineComplete, total: state.requiredBaselineTotal,
          }),
        },
      ]}
      /* An OPEN gate with open questions still needs the route, and this is
         where the clean-pass audit's P1 was: the alternative below said the
         questions "can be answered later" while offering no way to reach
         them, because reaching readiness unmounted the questions surface.
         A clean pass has no open question, so it renders no route — the
         predicate decides, not the layout. */
      route={state.canCreateOption
        ? (state.openQuestions > 0 ? {
          label: t('vr3.readiness.routeToQuestions'),
          onSelect: () => s.setUnderstandingTab('questions'),
        } : undefined)
        : {
          label: state.unresolvedBlockingConflicts > 0
            ? t('vr3.readiness.routeToConflicts')
            : state.analysisComplete
              ? t('vr3.readiness.routeToQuestions')
              : t('vr3.readiness.routeToAnalysis'),
          onSelect: () => {
            if (!state.analysisComplete) s.setProjectStage('documents')
            else if (state.unresolvedBlockingConflicts > 0) s.setUnderstandingTab('conflicts')
            else s.setUnderstandingTab('questions')
          },
        }}
      alternative={state.permittedAssumptions > 0 ? t('vr3.readiness.alternative') : undefined}
      error={errorKey ? {
        message: t(errorKey),
        onRetry: () => s.clearOptionCreationError(),
      } : undefined}
    >
      <Button
        variant="primary"
        disabled={!state.canCreateOption || busy}
        disabledReason={state.lockReasonKey ? t(state.lockReasonKey, {
          count: state.unresolvedBlockingConflicts || state.blockingQuestions || state.staleFactKeys.length,
        }) : undefined}
        loading={busy}
        loadingLabel={commit?.stage === 'OPTION'
          ? t('vr3.readiness.creatingOption.option')
          : t('vr3.readiness.creatingOption.baseline')}
        onClick={create}
      >
        {t('vr3.readiness.createOption')}
      </Button>
    </ActionGate>
  )
}

/* ─────────────────────────── stage 2b · ready ─────────────────────────── */

/**
 * The READY state, in two presentations (accepted 2026-09-05 clean-pass audit).
 *
 * `PROJECT_READY_FOR_OPTION` is a GATE state, not a CLEANLINESS state, and this
 * screen used to answer only the gate. One composition served both a project
 * that never had a conflict and a project with six decided conflicts, seven
 * open questions and one failed document: on the first its copy was false, and
 * on the second it stated those numbers with no route to any of them, because
 * reaching readiness unmounted the Conflicts and Questions surfaces entirely.
 *
 * So the composition branches on `cleanPresentation()` — presentation only,
 * never a gate — and the branch is a SHORTENING, not a different screen:
 *
 *   band 1   outcome + next action  │  project verification (building 1 of n)
 *            six confidence facts, each stated exactly once on the page
 *            one disclosure control
 *   band 2   the disclosed region: provenance, document outcomes, evidence
 *   band 3   the review surfaces — ONLY where their own predicate is non-empty
 *
 * A region is absent only when its own predicate is empty. The review tabs are
 * absent on a clean pass because `project.conflicts.length === 0` and no
 * question is open — not because the page is tidier without them.
 */
function ReadyStage({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const { fadeRise, transition } = useSemanticMotion()
  const clean = cleanPresentation(project, analysis)
  const open = openQuestions(project, analysis)

  const detailsId = useId()
  const [detailsOpen, setDetailsOpen] = useState(false)
  /**
   * The region stays in the DOM under `aria-controls`. `mounted` drives the
   * `hidden` attribute and lags `detailsOpen` on CLOSE only, so the fade is
   * actually painted before the element leaves the box tree.
   *
   * Both are set in the SAME event, deliberately. An earlier candidate raised
   * `mounted` in an effect: the reveal then started while the region was still
   * `display: none`, finished unseen, and the content appeared fully opaque the
   * moment `hidden` came off — the animation ran and nobody could watch it.
   */
  const [mounted, setMounted] = useState(false)
  const toggleDetails = () => {
    if (!detailsOpen) setMounted(true)
    setDetailsOpen(!detailsOpen)
  }

  const reviewPanel = useRef<HTMLDivElement | null>(null)

  // RESTORED, not preserved: at the audit baseline these two surfaces did not
  // exist once the gate opened, so seven open questions and six decisions were
  // numerals with no keyboard route of any kind (5 focusable elements in
  // `main`, none of them a route).
  const reviewTabs: Array<{ id: UnderstandingTab; label: string }> = clean ? [] : [
    ...(project.conflicts.length > 0
      ? [{
        id: 'conflicts' as const,
        label: t('vr3.understanding.tab.conflicts', { count: project.conflicts.length }),
      }]
      : []),
    ...(open.length > 0
      ? [{
        id: 'questions' as const,
        label: t('vr3.understanding.tab.questions', { count: open.length }),
      }]
      : []),
  ]
  // A tab remembered from the closed-gate stage must never select a panel this
  // presentation does not render.
  const tab = reviewTabs.some((entry) => entry.id === s.understandingTab)
    ? s.understandingTab
    : reviewTabs[0]?.id ?? 'overview'

  /**
   * A fact's route opens the surface that fact is about and takes focus with
   * it. Selecting a tab without moving focus would leave a keyboard user at
   * the top of a page whose bottom silently changed.
   */
  const routeTo = (target: UnderstandingTab) => () => {
    s.setUnderstandingTab(target)
    window.requestAnimationFrame(() => reviewPanel.current?.focus())
  }

  return (
    <div className="a3-ready">
      <div className="a3-ready-primary">
        <div className="a3-ready-outcome">
          <p className="a3-ready-eyebrow">{t('vr3.readiness.eyebrow.stage')}</p>
          {/* An OUTCOME, not a resolution history. `All blocking conflicts are
              resolved.` was rendered at 48/56 on a project whose `conflicts`
              array was empty. */}
          <h1 className="a3-ready-title" tabIndex={-1} data-page-heading>
            {t('vr3.readiness.title.ready')}
          </h1>
          <ReadyLead project={project} analysis={analysis} clean={clean} />
          <CreateOptionGate project={project} analysis={analysis} />
          {/* DC-27: exactly one next step, and it names what that step decides. */}
          <p className="a3-ready-next">{t('vr3.readiness.nextStep')}</p>
          <ReadyFacts
            project={project}
            analysis={analysis}
            clean={clean}
            onRoute={routeTo}
          />
          <button
            type="button"
            className="a3-ready-disclosure hit-target"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={toggleDetails}
          >
            <span className="a3-ready-disclosure-glyph" aria-hidden="true">
              {detailsOpen ? '▾' : '▸'}
            </span>
            {detailsOpen ? t('vr3.readiness.detailsHide') : t('vr3.readiness.detailsShow')}
          </button>
        </div>
        <ProjectVerification project={project} />
      </div>

      {/* Opens DOWNWARD: the outcome, the CTA and the building stay exactly
          where they were. Rule 20's grammar — fade + 8px rise in, fade out —
          and nothing else; `prefers-reduced-motion` zeroes both. */}
      <div id={detailsId} className="a3-ready-details" hidden={!mounted}>
        <motion.div
          className="a3-ready-details-grid"
          initial={false}
          variants={fadeRise}
          /* `hidden`, never `exit`: the shared `exit` variant is written for an
             AnimatePresence UNMOUNT and keeps `opacity: 0` unconditionally, so
             a persistent toggle driven from it would still animate 0 -> 1
             under `prefers-reduced-motion` (rule 21). `hidden` collapses to the
             visible value when motion is reduced, which makes the first paint
             already the final state. */
          animate={detailsOpen ? 'visible' : 'hidden'}
          transition={transition(detailsOpen ? 'reveal' : 'feedback')}
          onAnimationComplete={(definition) => {
            if (definition === 'hidden') setMounted(false)
          }}
        >
          <ReadyProvenance project={project} />
          <ReadyEvidence project={project} />
        </motion.div>
      </div>

      {reviewTabs.length > 0 ? (
        <div className="a3-ready-review">
          <UnderstandingTabList tabs={reviewTabs} current={tab} />
          <div
            id={`understanding-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`understanding-tab-${tab}`}
            tabIndex={-1}
            ref={reviewPanel}
            className="a3-understanding-panel"
          >
            {tab === 'conflicts' ? (
              <ConflictsPanel project={project} analysis={analysis} />
            ) : (
              <QuestionsPanel project={project} analysis={analysis} />
            )}
          </div>
        </div>
      ) : null}

      {analysis.staleFactKeys.length > 0 ? (
        <StaleState>
          {t('vr3.understanding.staleNotice', { count: analysis.staleFactKeys.length })}
        </StaleState>
      ) : null}
    </div>
  )
}

/**
 * The lead sentence, derived from the two distinctions the product actually
 * holds: `project.conflicts.length` says whether a conflict was ever FOUND,
 * the live selectors say whether it was RESOLVED. No invented history.
 */
function ReadyLead({
  project, analysis, clean,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  clean: boolean
}) {
  const t = useT()
  const state = readiness(project, analysis)
  return (
    <p className="a3-ready-lead">
      {clean
        ? t('vr3.readiness.lead.readyNoneFound', { required: state.requiredBaselineTotal })
        : t('vr3.readiness.lead.readyResolved', {
          resolved: project.conflicts.length,
          open: openQuestions(project, analysis).length,
          complete: state.requiredBaselineComplete,
          required: state.requiredBaselineTotal,
        })}
    </p>
  )
}

/**
 * The tab list `UnderstandingStage` and `ReadyStage` share.
 *
 * Extracted rather than copied: roving tabindex, arrow semantics and the
 * `understanding-tab-*` / `understanding-panel-*` id contract are ONE
 * behaviour, and two implementations of it would drift on the next change.
 */
function UnderstandingTabList({
  tabs, current,
}: {
  tabs: ReadonlyArray<{ id: UnderstandingTab; label: string }>
  current: UnderstandingTab
}) {
  const s = useStore()
  const t = useT()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const move = (from: number, delta: 1 | -1) => {
    const next = (from + delta + tabs.length) % tabs.length
    s.setUnderstandingTab(tabs[next]!.id)
    refs.current[next]?.focus()
  }

  return (
    <div
      className="a3-understanding-tabs"
      role="tablist"
      aria-label={t('vr3.understanding.tablist')}
    >
      {tabs.map((entry, index) => (
        <button
          key={entry.id}
          ref={(el) => { refs.current[index] = el }}
          type="button"
          role="tab"
          id={`understanding-tab-${entry.id}`}
          aria-selected={current === entry.id}
          aria-controls={`understanding-panel-${entry.id}`}
          tabIndex={current === entry.id ? 0 : -1}
          className={current === entry.id
            ? 'a3-understanding-tab a3-understanding-tab-current hit-target'
            : 'a3-understanding-tab hit-target'}
          onClick={() => s.setUnderstandingTab(entry.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(index, 1) }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(index, -1) }
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The project verification card — the block the audit found in the worst
 * position on the page (y 1835, 1 112 px after the CTA) carrying the only
 * content the user is actually here to check.
 *
 * One building: identity photograph, name, usage, storeys, basement, then the
 * three numbers the commercial scale rests on with their authority and, for
 * BGF R+S, the source file it came from.
 *
 * `n >= 2`: a compact row per building — thumbnail, name, BGF R+S with its
 * authority — and the full per-building detail moves into the disclosed
 * region. The composition is written for `n`, not tuned to the one-building
 * fixture.
 */
function ProjectVerification({ project }: { project: FixtureProject }) {
  const t = useT()
  const num = useLocalNumber()
  const buildings = project.buildings

  const sourceFile = (building: FixtureProject['buildings'][number]) => project.documents
    .find((d) => d.id === building.evidenceDocIds[0])?.file
    ?? building.evidenceDocIds[0] ?? building.id

  if (buildings.length !== 1) {
    return (
      <section className="a3-verify" aria-labelledby="ready-verify-title">
        <ul className="a3-verify-list">
          <li className="a3-verify-list-head">
            <p className="a3-verify-eyebrow" id="ready-verify-title">
              {t('vr3.readiness.verify.many', { total: buildings.length })}
            </p>
          </li>
          {buildings.map((building) => {
            const asset = projectAsset(building.identityAssetId)
            return (
              <li key={building.id} className="a3-verify-list-item">
                <div className="a3-verify-thumb">
                  <MediaFrame
                    ratio="tile"
                    state={asset ? 'loaded' : 'fallback'}
                    src={asset?.url}
                    alt={asset ? t(asset.altKey) : undefined}
                    seed={building.id}
                    sourceId={asset?.assetId}
                  />
                </div>
                <div className="a3-verify-list-body">
                  <h2 className="a3-verify-list-name">{building.name}</h2>
                  <p className="a3-verify-list-meta">
                    {t(building.usageKey)} · {t(building.storeysKey)}
                  </p>
                  <p className="a3-verify-list-metric">
                    <span className="a3-verify-list-label">
                      {t('vr3.understanding.metric.bgf')}
                    </span>
                    <AuthorityTrace
                      authority={(building.authority.bgfRSTotal ?? 'derived') as InformationAuthority}
                      evidence={{ label: sourceFile(building) }}
                    >
                      <span className="numeric">{num(building.metrics.bgfRSTotal)}</span>
                      <span className="a3-mro-unit">m²</span>
                    </AuthorityTrace>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  const building = buildings[0]
  if (!building) return null
  const asset = projectAsset(building.identityAssetId)

  return (
    <section className="a3-verify" aria-labelledby="ready-verify-title">
      <div className="a3-verify-media">
        <MediaFrame
          ratio="pano"
          state={asset ? 'loaded' : 'fallback'}
          src={asset?.url}
          alt={asset ? t(asset.altKey) : undefined}
          seed={building.id}
          sourceId={asset?.assetId}
        />
      </div>
      <div className="a3-verify-body">
        <p className="a3-verify-eyebrow" id="ready-verify-title">
          {t('vr3.readiness.verify.one', { index: 1, total: buildings.length })}
        </p>
        <h2 className="a3-verify-name">{building.name}</h2>
        <p className="a3-verify-meta">{t(building.usageKey)}</p>
        <p className="a3-verify-meta">
          {t(building.storeysKey)}
          {' · '}
          {t(`vr3.building.underground.${building.undergroundLevel}`)}
        </p>
        <dl className="a3-verify-metrics">
          {/* BGF R+S carries its evidence rather than a bare badge: it is the
              number every commercial figure downstream is derived from. */}
          <div className="a3-verify-metric">
            <dt className="a3-verify-metric-label">{t('vr3.understanding.metric.bgf')}</dt>
            <dd className="a3-verify-metric-value">
              <AuthorityTrace
                authority={(building.authority.bgfRSTotal ?? 'derived') as InformationAuthority}
                /* Default (inline) layout, not `stacked`: the stacked variant
                   adds an authority-coloured left rule and an indent, which
                   would set BGF apart from the two metrics beside it in the
                   same row for no informational reason — the word BERECHNET /
                   DERIVED already carries the authority. */
                evidence={{ label: sourceFile(building) }}
              >
                <span className="numeric">{num(building.metrics.bgfRSTotal)}</span>
                <span className="a3-mro-unit">m²</span>
              </AuthorityTrace>
            </dd>
          </div>
          {building.metrics.wfl ? (
            <MetricReadout
              label={t('vr3.understanding.metric.wfl')}
              value={num(building.metrics.wfl)}
              unit="m²"
              authority={(building.authority.wfl ?? 'sourceEvidenced') as InformationAuthority}
            />
          ) : null}
          {building.metrics.units !== null ? (
            <MetricReadout
              label={t('vr3.understanding.metric.units')}
              value={num(building.metrics.units)}
              authority={(building.authority.units ?? 'sourceEvidenced') as InformationAuthority}
            />
          ) : null}
        </dl>
      </div>
    </section>
  )
}

/**
 * The six confidence facts.
 *
 * Every one of them is stated EXACTLY ONCE on the collapsed page. At the audit
 * baseline nine facts were rendered twenty-six times: a four-row readiness
 * sheet, a four-tile metric strip, a verbatim subset of that sheet 940 px
 * lower, and a second document count inside the provenance panel.
 *
 * On READY WITH REVIEW a fact that names something reviewable carries the
 * route to it. On a clean pass the same facts carry none, because their own
 * predicates are empty.
 */
function ReadyFacts({
  project, analysis, clean, onRoute,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  clean: boolean
  onRoute: (tab: UnderstandingTab) => () => void
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const state = readiness(project, analysis)
  const dist = project.terminalDistribution
  const facts = project.analysis
  const openCount = openQuestions(project, analysis).length
  const degraded = dist.warning + dist.lowConfidence + dist.failed

  return (
    <dl className="a3-ready-facts">
      <ReadyFact
        label={t('vr3.understanding.metric.documents')}
        /* PU-11: `processedCount` counts FAILED as processed, so `n/n` would
           claim a clean run while a document failed. The proportion is printed
           only when nothing degraded; otherwise the distribution is. */
        value={degraded === 0
          ? t('vr3.readiness.fact.documentsClean', {
            processed: dist.processed,
            total: project.documents.length,
            warning: dist.warning,
          })
          : t('vr3.understanding.terminalSummary', {
            processed: dist.processed,
            warning: dist.warning,
            lowConfidence: dist.lowConfidence,
            failed: dist.failed,
          })}
        route={degraded > 0 ? {
          label: dist.failed > 0
            ? t('vr3.readiness.routeToFailedDocuments')
            : t('vr3.readiness.routeToDocuments'),
          onSelect: () => s.setProjectStage('documents'),
        } : undefined}
      />
      <ReadyFact
        label={t('vr3.readiness.fact.values')}
        value={clean
          ? t('vr3.readiness.fact.valuesClean', { count: facts.valuesExtracted })
          : t('vr3.readiness.fact.valuesReview', {
            total: facts.valuesExtracted,
            evidenced: facts.sourceEvidencedValues,
            inferred: facts.aiInferredValues,
          })}
      />
      <ReadyFact
        label={t('vr3.readiness.row.requiredInformation')}
        value={t('vr3.readiness.fact.requiredValue', {
          done: state.requiredBaselineComplete,
          total: state.requiredBaselineTotal,
        })}
      />
      <ReadyFact
        label={t('vr3.readiness.fact.conflicts')}
        value={project.conflicts.length === 0
          ? t('vr3.readiness.fact.conflictsNone')
          : t('vr3.readiness.fact.conflictsResolved', { count: project.conflicts.length })}
        route={project.conflicts.length > 0 ? {
          label: t('vr3.readiness.routeToConflicts'),
          onSelect: onRoute('conflicts'),
        } : undefined}
      />
      <ReadyFact
        label={t('vr3.readiness.row.openQuestions')}
        value={openCount === 0
          ? t('vr3.readiness.fact.questionsNone')
          : t('vr3.readiness.row.openQuestionsValue', {
            open: openCount, blocking: state.blockingQuestions,
          })}
        route={openCount > 0 ? {
          label: t('vr3.readiness.routeToQuestions'),
          onSelect: onRoute('questions'),
        } : undefined}
      />
      <ReadyFact
        label={t('vr3.readiness.fact.buildings')}
        value={clean
          ? t('vr3.readiness.fact.buildingsComplete', { count: project.buildings.length })
          : num(project.buildings.length)}
      />
    </dl>
  )
}

function ReadyFact({
  label, value, route,
}: {
  label: string
  value: ReactNode
  route?: { label: string; onSelect: () => void }
}) {
  return (
    <div className="a3-ready-fact">
      <dt className="a3-ready-fact-label">{label}</dt>
      {/* No tone colour here on purpose: `--color-status-success` is declared
          never to be used as body text (tokens.css contrast note — 4.19:1 at
          14px/700). `None found` and `0 warnings` ARE the meaning; green would
          only repeat it below the contrast floor. */}
      <dd className="a3-ready-fact-value">
        {value}
        {route ? (
          <button
            type="button"
            className="a3-ready-fact-route hit-target"
            onClick={route.onSelect}
          >
            {route.label}
          </button>
        ) : null}
      </dd>
    </div>
  )
}

/** Disclosed column 1 — what the system understood, and from what. */
function ReadyProvenance({ project }: { project: FixtureProject }) {
  const s = useStore()
  const t = useT()
  const facts = project.analysis
  const dist = project.terminalDistribution
  const proportion = (count: number) => t('vr3.readiness.details.proportion', {
    count, total: facts.valuesExtracted,
  })

  return (
    <div className="a3-ready-details-col">
      <h3 className="a3-ready-details-title">{t('vr3.understanding.understoodTitle')}</h3>
      <p className="a3-understanding-copy">{t(facts.understandingKey)}</p>
      <dl className="a3-readiness-rows">
        {/* Three independent PROPORTIONS of the same total. Rendered as three
            bare counts they read as a partition, and 42 + 0 + 42 does not sum
            to 42. */}
        <div className="a3-readiness-row">
          <dt className="a3-readiness-row-label">{t('vr3.understanding.row.sourceEvidence')}</dt>
          <dd className="a3-readiness-row-value">{proportion(facts.sourceEvidencedValues)}</dd>
        </div>
        <div className="a3-readiness-row">
          <dt className="a3-readiness-row-label">{t('vr3.understanding.row.aiInferred')}</dt>
          <dd className="a3-readiness-row-value">{proportion(facts.aiInferredValues)}</dd>
        </div>
        <div className="a3-readiness-row">
          <dt className="a3-readiness-row-label">{t('vr3.understanding.row.manualConfirmed')}</dt>
          <dd className="a3-readiness-row-value">{proportion(facts.manualOrConfirmedValues)}</dd>
        </div>
        <div className="a3-readiness-row">
          <dt className="a3-readiness-row-label">
            {t('vr3.readiness.details.documentOutcomes')}
          </dt>
          <dd className="a3-readiness-row-value">
            {t('vr3.understanding.terminalSummary', {
              processed: dist.processed,
              warning: dist.warning,
              lowConfidence: dist.lowConfidence,
              failed: dist.failed,
            })}
          </dd>
        </div>
      </dl>
      {/* Per-document forensic evidence lives in the Documents workspace and is
          not reproduced here: one register, one place. */}
      <button
        type="button"
        className="a3-ready-details-route hit-target"
        onClick={() => s.setProjectStage('documents')}
      >
        {t('vr3.readiness.routeToDocuments')}
      </button>
    </div>
  )
}

/** Disclosed column 2 — every recognised value with its authority and source. */
function ReadyEvidence({ project }: { project: FixtureProject }) {
  const t = useT()
  const num = useLocalNumber()
  return (
    <div className="a3-ready-details-col">
      <h3 className="a3-ready-details-title">{t('vr3.readiness.details.evidenceTitle')}</h3>
      {project.buildings.map((building) => (
        <div key={building.id} className="a3-ready-evidence">
          <h4 className="a3-ready-evidence-name">{building.name}</h4>
          <dl className="a3-readiness-rows">
            <BuildingEvidenceRow
              label={t('vr3.understanding.metric.bgf')}
              value={num(building.metrics.bgfRSTotal)}
              unit="m²"
              authority={(building.authority.bgfRSTotal ?? 'derived') as InformationAuthority}
            />
            {building.metrics.wfl ? (
              <BuildingEvidenceRow
                label={t('vr3.understanding.metric.wfl')}
                value={num(building.metrics.wfl)}
                unit="m²"
                authority={(building.authority.wfl ?? 'sourceEvidenced') as InformationAuthority}
              />
            ) : null}
            {building.metrics.nuf ? (
              <BuildingEvidenceRow
                label={t('vr3.understanding.metric.nuf')}
                value={num(building.metrics.nuf)}
                unit="m²"
                authority={(building.authority.nuf ?? 'sourceEvidenced') as InformationAuthority}
              />
            ) : null}
            {building.metrics.units !== null ? (
              <BuildingEvidenceRow
                label={t('vr3.understanding.metric.units')}
                value={num(building.metrics.units)}
                authority={(building.authority.units ?? 'sourceEvidenced') as InformationAuthority}
              />
            ) : null}
          </dl>
          <p className="a3-building-evidence">
            {t('vr3.understanding.buildingEvidence', {
              files: building.evidenceDocIds
                .map((id) => project.documents.find((d) => d.id === id)?.file ?? id)
                .join(', '),
            })}
          </p>
        </div>
      ))}
      <p className="a3-ready-evidence-hint">{t('vr3.readiness.details.sourceHint')}</p>
    </div>
  )
}

function BuildingEvidenceRow({
  label, value, unit, authority,
}: {
  label: string
  value: string
  unit?: string
  authority: InformationAuthority
}) {
  return (
    <div className="a3-readiness-row">
      <dt className="a3-readiness-row-label">{label}</dt>
      <dd className="a3-readiness-row-value">
        <AuthorityTrace authority={authority}>
          <span className="numeric">{value}</span>
          {unit ? <span className="a3-mro-unit">{unit}</span> : null}
        </AuthorityTrace>
      </dd>
    </div>
  )
}

/* ───────────────────── stage 3 · Option created ───────────────────── */

function OptionCreatedStage({ project }: { project: FixtureProject }) {
  const s = useStore()
  const t = useT()
  const asset = projectAsset(project.heroAssetId)
  const latest = s.options.at(-1) ?? null
  const analysis = s.projectAnalyses[project.id]

  // VR3-01's boundary ends the moment Create Option is triggered; VR3-02
  // owns the full Option-created composition (`T-012`) and Gebäude & Umfang.
  // What is here is the honest hand-off: the Option exists, the project
  // baseline snapshot behind it is recorded, and the only substantive next
  // step is reachable.
  return (
    <>
      <ProjectReadiness
        eyebrow={t('vr3.readiness.optionCreated')}
        /* VR3-02 (T-012): the hand-off NAMES the Option and says what it is
           ready for. "Option 1" alone stated that something happened and
           not what it now needs, which is the one thing the user is here
           to find out. */
        heading={latest
          ? t('vr3.option.created.heading', { option: latest.name })
          : t('vr3.readiness.optionCreated')}
        explanation={t('vr3.option.created.lead')}
        rows={s.projectBaseline ? [
          {
            id: 'buildings',
            label: t('vr3.understanding.metric.buildings'),
            value: s.projectBaseline.buildingCount,
          },
          {
            id: 'documents',
            label: t('vr3.understanding.metric.documents'),
            value: s.projectBaseline.documentCount,
          },
          /**
           * ACCEPT-01. This row printed `conflictDecisions.length` — the
           * number of disputed values the baseline carries a DECISION for —
           * under the label that everywhere else in this file means the
           * number still OUTSTANDING (`state.unresolvedBlockingConflicts`,
           * rows above and in `ReadyStage`). So a Project B hand-off,
           * reached only because that count had reached zero, announced
           * "Blockierende strittige Angaben 6" and contradicted the gate
           * that had just opened.
           *
           * One number, two meanings — the defect class CLAUDE.md's own
           * correction log names. The number is worth showing: six recorded
           * decisions are exactly what this Option inherited. It now says
           * so, against the project's own conflict count, and it is ABSENT
           * when the project had nothing to decide rather than printing a
           * zero that would read as a finding.
           */
          ...(project.conflicts.length > 0 ? [{
            id: 'decisions',
            label: t('vr3.readiness.row.resolvedConflicts'),
            value: t('vr3.readiness.row.decidedOf', {
              decided: s.projectBaseline.conflictDecisions.length,
              total: project.conflicts.length,
            }),
          }] : []),
        ] : []}
        /* Only Gebäude & Umfang is substantive now, and every later stage
           is visible as locked WITH ITS REASON — in the spine beside this
           surface and, named, right here. A disabled label alone is not a
           gate (rule 12, T-012/T-016). */
        attention={latest ? (
          <NextStep
            label={t('vr3.option.created.nextLabel')}
            description={t('vr3.option.created.nextDetail')}
            action={t('vr3.option.created.action')}
            onAction={() => s.openOption(latest.id)}
          />
        ) : undefined}
        media={(
          <MediaFrame
            ratio="pano"
            state={asset ? 'loaded' : 'fallback'}
            src={asset?.url}
            alt={asset ? t(asset.altKey) : undefined}
            seed={project.id}
            sourceId={asset?.assetId}
          />
        )}
      />
      <ProjectOptionsSection justCreatedOptionId={latest?.id ?? null} />
      {/* Creating a FURTHER Option is a real capability the comparison
          feature depends on, and it belongs beside the gallery of Options
          rather than in the hero — the hero's one continuation is opening
          the Option that was just created (DC-27). */}
      {analysis ? (
        <div className="a3-project-stage-continue">
          <CreateOptionGate project={project} analysis={analysis} />
        </div>
      ) : null}
    </>
  )
}

/* ─────────────────────── compact project context ─────────────────────── */

/**
 * The project as CONTEXT, in one bar (accepted 2026-09-05 Documents
 * workspace audit, "Compact project context").
 *
 * What this replaces: a panoramic hero, the project name as the page H1,
 * and a status eyebrow — a landing page stacked on top of an operational
 * task, pushing the first document row to y=774 at 1440x900 and off the
 * viewport entirely at 1280x800. The identity is still here, because a
 * sales user works several projects a day and has to know which one is
 * open; it is 56px of it (48px at 1280), on one line, and the page H1 now
 * names the TASK.
 *
 * The internal note (DC-43) is a released Opportunity-level capability and
 * survives unchanged: it does not exist in a client projection at all, and
 * it stays a tertiary utility at the end of the bar rather than competing
 * with the analysis for attention.
 */
function ProjectContextBar({ project }: { project: FixtureProject }) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const [noteOpen, setNoteOpen] = useState(false)
  const noteButtonRef = useRef<HTMLButtonElement>(null)
  const asset = projectAsset(project.heroAssetId)

  if (s.mode === 'praesentation') return null

  return (
    <div className="a3-project-context">
      <span className="a3-project-context-media" aria-hidden="true">
        <MediaFrame
          ratio="tile"
          state={asset ? 'loaded' : 'fallback'}
          src={asset?.url}
          alt={asset ? t(asset.altKey) : undefined}
          seed={project.id}
          sourceId={asset?.assetId}
        />
      </span>
      <div className="a3-project-context-identity">
        <p className="a3-project-context-name">{project.name}</p>
        <p className="a3-project-context-meta">
          {project.client}
          {' · '}
          {project.city}
        </p>
      </div>
      <div className="a3-project-context-utilities">
        <Button
          ref={noteButtonRef}
          variant="ghost"
          onClick={() => setNoteOpen(true)}
        >
          {tx('Interne Notiz')}
        </Button>
      </div>
      <InternalNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        returnFocusTo={noteButtonRef}
      />
    </div>
  )
}
