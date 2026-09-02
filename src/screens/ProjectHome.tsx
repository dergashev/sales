import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence } from 'framer-motion'
import {
  useStore,
  type ProjectStage,
  type UnderstandingTab,
} from '../state/store'
import {
  activeDocumentId,
  conflictResolved,
  demoProject,
  documentLineage,
  documentProgress,
  documentTypeTally,
  filterDocuments,
  openQuestions,
  overallProgressPercent,
  processedCount,
  questionStatus,
  readiness,
  resolvedConflictValue,
  totalBgfRS,
  type DocumentFilter,
  type FixtureConflict,
  type FixtureDocument,
  type FixtureProject,
  type FixtureQuestion,
  type ProjectAnalysis,
} from '../state/projectAnalysis'
import { formatDE } from '../engine/money'
import { localizeMoneyText, useT, useTx } from '../i18n'
import { Button } from '../components/primitives'
import { PageHeader, SectionSheet } from '../components/designSystem'
import { ErrorState, StaleState } from '../components/DataStates'
import { MediaFrame } from '../design-system/MediaFrame'
import { WorkflowStepper, type WorkflowStep } from '../design-system/WorkflowStepper'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { AuthorityTrace, MetricReadout, type InformationAuthority } from '../design-system/AuthorityTrace'
import { DocumentRow, ProcessingJob, type DocumentRowState } from '../design-system/ProcessingJob'
import { ActionGate, PrerequisiteState, ProjectReadiness } from '../design-system/ActionGate'
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

/** The simulated commit of a project baseline into a new Option. */
const OPTION_COMMIT_MS = 240

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
  const jobState = analysis?.jobState
  const [stageAnnouncement, setStageAnnouncement] = useState('')

  // M-03: completion is one meaningful transition, and it has to be
  // ANNOUNCED. The announcement cannot live inside the job: the transition
  // unmounts the job, and its live region with it, so a screen reader was
  // never told the analysis had finished. This region belongs to the shell,
  // which survives the stage change.
  const previousJobState = useRef(jobState)
  useEffect(() => {
    if (jobState === 'COMPLETE' && previousJobState.current !== 'COMPLETE') {
      setStageAnnouncement(t('vr3.analysis.announce.complete'))
    }
    previousJobState.current = jobState
  }, [jobState, t])

  if (!project || !analysis) return null

  const state = readiness(project, analysis)
  const stage = s.projectStage

  return (
    <div className="a3-project-shell">
      <aside className="a3-project-spine" aria-label={t('vr3.spine.projectLabel')}>
        <p className="a3-project-spine-eyebrow">{t('vr3.spine.projectLabel')}</p>
        <p className="a3-project-spine-name">{project.name}</p>
        <ProjectSpine project={project} analysis={analysis} />
      </aside>
      <div className="a3-project-main">
        {stage === 'documents' ? (
          <DocumentsStage project={project} analysis={analysis} />
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

/* ─────────────────────────── workflow spine ─────────────────────────── */

function ProjectSpine({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const state = readiness(project, analysis)
  const stage = s.projectStage
  const hasOption = s.options.length > 0

  const go = (target: ProjectStage) => () => s.setProjectStage(target)

  // The full journey stays visible so it is learnable; only the current
  // stage is emphasised and every locked stage carries its reason. The
  // Option-side stages are shown as the one journey they belong to — this
  // ticket owns the first three and does not pretend to own the rest.
  const steps: WorkflowStep[] = [
    {
      id: 'documents',
      label: t('vr3.spine.step.documents'),
      state: stage === 'documents'
        ? 'current'
        : analysis.jobState === 'COMPLETE' ? 'done' : 'upcoming',
      previouslyDone: stage === 'documents' && analysis.jobState === 'COMPLETE',
      onSelect: go('documents'),
    },
    {
      id: 'understanding',
      label: t('vr3.spine.step.understanding'),
      state: stage === 'understanding'
        ? 'current'
        : analysis.jobState !== 'COMPLETE'
          ? 'blocked'
          : state.state === 'PROJECT_READY_FOR_OPTION' ? 'done' : 'attention',
      blockedReason: analysis.jobState !== 'COMPLETE'
        ? t('vr3.spine.reason.needsAnalysis')
        : undefined,
      onSelect: analysis.jobState === 'COMPLETE' ? go('understanding') : undefined,
    },
    {
      id: 'createOption',
      label: t('vr3.spine.step.createOption'),
      state: stage === 'createOption'
        ? 'current'
        : hasOption
          ? 'done'
          : state.canCreateOption ? 'attention' : 'blocked',
      blockedReason: state.canCreateOption || hasOption
        ? undefined
        : t('vr3.spine.reason.needsReadiness'),
      onSelect: hasOption ? go('createOption') : undefined,
    },
    // VR3-02…VR3-05 own these stages. They are listed because the journey
    // must be one journey, and each states the prerequisite it is waiting
    // for rather than being a silently greyed-out label.
    ...([
      ['buildingScope', 'vr3.spine.step.buildingScope'],
      ['scopeBoundaries', 'vr3.spine.step.scopeBoundaries'],
      ['kg200', 'costGroup.200'],
      ['kg300', 'costGroup.300'],
      ['kg400', 'costGroup.400'],
      ['kg500', 'costGroup.500'],
      ['kg600', 'costGroup.600'],
      ['kg700', 'costGroup.700'],
      ['schedule', 'vr3.spine.step.schedule'],
      ['finalValidation', 'vr3.spine.step.finalValidation'],
    ] as const).map(([id, key]) => ({
      id,
      // The rail names a cost group by its NUMBER, as the approved target
      // does: the full DIN 276 title belongs on the KG page itself, and
      // thirteen two-line labels would turn the spine into a wall of prose.
      label: id.startsWith('kg') ? `KG\u202f${id.slice(2)}` : t(key),
      state: 'blocked' as const,
      blockedReason: hasOption
        ? t('vr3.spine.reason.needsOption')
        : t('vr3.spine.reason.needsReadiness'),
    })),
  ]

  return (
    <WorkflowStepper steps={steps} ariaLabel={t('vr3.spine.label')} size="spine" />
  )
}

/* ─────────────────────── stage 1 · documentation ─────────────────────── */

function DocumentsStage({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const { reduced, fadeRise, transition } = useSemanticMotion()
  const [filter, setFilter] = useState<DocumentFilter>('all')
  const [openDetailId, setOpenDetailId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const jobHeadingRef = useRef<HTMLDivElement>(null)
  const running = analysis.jobState === 'RUNNING' || analysis.jobState === 'PARTIAL_FAILURE'

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

  // M-03: completion is ONE meaningful transition. The job control gives
  // way to the readiness summary, focus moves to the new heading and the
  // change is announced — under reduced motion the state replacement is
  // immediate but the focus move and the announcement still happen.
  const completed = analysis.jobState === 'COMPLETE'
  const previousCompleted = useRef(completed)
  useEffect(() => {
    if (completed && !previousCompleted.current) {
      // The completion announcement belongs to the shell's live region
      // (see `ProjectHome`) — this component is about to unmount.
      s.setProjectStage('understanding')
    }
    previousCompleted.current = completed
  }, [completed, s, t])

  useEffect(() => {
    if (running) jobHeadingRef.current?.focus()
  }, [running])

  if (analysis.jobState === 'NOT_STARTED') {
    const asset = projectAsset(project.heroAssetId)
    const tally = documentTypeTally(project)
    return (
      <>
        <ProjectIdentityUtilities project={project} />
        <PrerequisiteState
          eyebrow={t('vr3.analysis.eyebrow.notStarted')}
          heading={project.name}
          explanation={t('vr3.analysis.notStarted.lead', { count: project.documents.length })}
          absenceTitle={t('vr3.analysis.notStarted.absenceTitle')}
          absenceDetail={t('vr3.analysis.notStarted.absenceDetail')}
          action={(
            <Button variant="primary" onClick={() => s.startDocumentAnalysis()}>
              {t('vr3.analysis.start')}
            </Button>
          )}
          secondaryAction={(
            <Button
              variant="ghost"
              onClick={() => setFilter('all')}
              aria-describedby={undefined}
            >
              {t('vr3.analysis.inspectDocuments', { count: project.documents.length })}
            </Button>
          )}
          media={(
            <MediaFrame
              ratio="pano"
              state={asset ? 'loaded' : 'fallback'}
              src={asset?.url}
              alt={asset ? tx(asset.motifDe) : undefined}
              seed={project.id}
              sourceId={asset?.assetId}
            />
          )}
          inventory={(
            <SectionSheet
              title={t('vr3.analysis.inventoryTitle', { count: project.documents.length })}
              intro={t('vr3.analysis.inventoryLead')}
            >
              <ul className="a3-doc-tally">
                {tally.map((entry) => (
                  <li key={entry.documentType} className="a3-doc-tally-item">
                    {t(`vr3.analysis.tally.${entry.documentType}`, { count: entry.count })}
                  </li>
                ))}
              </ul>
              <div className="a3-doc-register">
                <ul className="a3-pjob-rows">
                  {project.documents.map((doc) => (
                    <DocumentRegisterRow
                      key={doc.id}
                      project={project}
                      analysis={analysis}
                      doc={doc}
                      openDetailId={openDetailId}
                      onToggleDetail={setOpenDetailId}
                    />
                  ))}
                </ul>
              </div>
            </SectionSheet>
          )}
        />
      </>
    )
  }

  const done = processedCount(project, analysis)
  const total = project.documents.length
  const shown = filterDocuments(project, analysis, filter)
  const failedDoc = project.documents.find(
    (d) => analysis.documents[d.id]?.state === 'FAILED',
  )
  const attentionCount = project.documents.filter((d) => {
    const st = analysis.documents[d.id]?.state
    return st === 'WARNING' || st === 'LOW_CONFIDENCE' || st === 'FAILED'
  }).length
  const processedTotal = project.documents.filter(
    (d) => analysis.documents[d.id]?.state === 'PROCESSED',
  ).length

  // The heading states the job's ACTUAL state. It read "revisions are being
  // cross-checked" on a finished job, because the completed case fell
  // through to the running title.
  const title = analysis.jobState === 'PARTIAL_FAILURE'
    ? t('vr3.analysis.title.attention')
    : completed
      ? t('vr3.analysis.title.complete')
      : project.route === 'clean'
        ? t('vr3.analysis.title.running.clean')
        : t('vr3.analysis.title.running.complex')

  return (
    <>
      <ProjectIdentityUtilities project={project} />
      <div ref={jobHeadingRef} tabIndex={-1} className="a3-project-stage-head">
        <p className="a3-project-stage-eyebrow">
          {t('vr3.analysis.eyebrow.running', { done, total })}
        </p>
        <PageHeader
          title={title}
          lede={analysis.jobState === 'PARTIAL_FAILURE'
            ? t('vr3.analysis.lead.attention')
            : completed
              ? t('vr3.analysis.lead.complete')
              : t('vr3.analysis.lead.running')}
        />
      </div>
      <ProcessingJob
        state={analysis.jobState}
        processedCount={done}
        totalCount={total}
        progressPercent={overallProgressPercent(project, analysis)}
        activeFileName={activeDoc?.file ?? null}
        activePhaseLabel={activeState ? documentStateLabel(t, activeState as DocumentRowState) : null}
        nextStepLabel={t('vr3.analysis.next')}
        filterLegend={t('vr3.analysis.filter.legend')}
        filters={[
          {
            id: 'all',
            label: t('vr3.analysis.filter.all'),
            count: total,
            active: filter === 'all',
            onSelect: () => setFilter('all'),
          },
          {
            id: 'attention',
            label: t('vr3.analysis.filter.attention'),
            count: attentionCount,
            active: filter === 'attention',
            onSelect: () => setFilter('attention'),
          },
          {
            id: 'processed',
            label: t('vr3.analysis.filter.processed'),
            count: processedTotal,
            active: filter === 'processed',
            onSelect: () => setFilter('processed'),
          },
        ]}
        announcement={announcement}
        actions={(
          <>
            {running ? (
              <Button variant="secondary" onClick={() => s.cancelDocumentAnalysis()}>
                {t('vr3.analysis.cancel')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => s.rerunDocumentAnalysis()}>
                {t('vr3.analysis.rerun')}
              </Button>
            )}
          </>
        )}
        notice={failedDoc ? (
          <ErrorState
            cause={t('vr3.analysis.failureTitle', { file: failedDoc.file })}
            impact={t('vr3.analysis.failureDetail', {
              affected: t('vr3.analysis.failureAffectedC'),
              remaining: total - 1,
            })}
            remedy={t('vr3.analysis.lead.attention')}
            retryPolicy={t('vr3.analysis.retryPolicy')}
            action={(
              <div className="a3-drow-actions">
                <Button
                  variant="primary"
                  onClick={() => s.replaceDocumentRow(
                    failedDoc.id, `${failedDoc.file.replace('.pdf', '')}_REV-B.pdf`,
                  )}
                >
                  {t('vr3.analysis.action.replace')}
                </Button>
                <Button variant="secondary" onClick={() => s.retryDocumentRow(failedDoc.id)}>
                  {t('vr3.analysis.action.retry')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(t('vr3.analysis.removeConfirm', { file: failedDoc.file }))) {
                      s.removeDocumentRow(failedDoc.id)
                    }
                  }}
                >
                  {t('vr3.analysis.action.remove')}
                </Button>
              </div>
            )}
          />
        ) : null}
      >
        <AnimatePresence initial={false}>
          {shown.map((doc, index) => (
            <DocumentRegisterRow
              key={doc.id}
              project={project}
              analysis={analysis}
              doc={doc}
              openDetailId={openDetailId}
              onToggleDetail={setOpenDetailId}
              // M-01: the queue is ADMITTED in place, one canonical
              // `fadeRise` per row with the bounded causal wave — never a
              // stagger longer than the reveal itself, and nothing at all
              // under `prefers-reduced-motion`.
              rowMotion={reduced ? undefined : {
                variants: fadeRise,
                initial: 'hidden',
                animate: 'visible',
                transition: transition('reveal', Math.min(index, 6)),
              }}
            />
          ))}
        </AnimatePresence>
      </ProcessingJob>
      {filter !== 'all' ? (
        <p className="a3-doc-filter-notice">{t('vr3.analysis.filterNotice')}</p>
      ) : null}
      {completed ? (
        <div className="a3-project-stage-continue">
          <Button variant="primary" onClick={() => s.setProjectStage('understanding')}>
            {t('vr3.understanding.eyebrow')}
          </Button>
        </div>
      ) : null}
    </>
  )
}

function DocumentRegisterRow({
  project, analysis, doc, openDetailId, onToggleDetail, rowMotion,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  doc: FixtureDocument
  openDetailId: string | null
  onToggleDetail: (id: string | null) => void
  rowMotion?: Parameters<typeof DocumentRow>[0]['rowMotion']
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const runtime = analysis.documents[doc.id]
  const rowState: DocumentRowState = runtime?.removedAt
    ? 'REMOVED'
    : (runtime?.state ?? 'QUEUED') as DocumentRowState
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

  const association = doc.projectLevel
    ? t('vr3.analysis.association.project')
    : t('vr3.analysis.association.buildings', {
      names: doc.buildingIds
        .map((id) => project.buildings.find((b) => b.id === id)?.name ?? id)
        .join(', '),
    })

  return (
    <DocumentRow
      file={doc.file}
      typeLabel={t(`vr3.docType.${doc.documentType}`)}
      versionLabel={doc.version}
      associationLabel={association}
      note={doc.issueKey ? t(doc.issueKey) : undefined}
      state={rowState}
      stateLabel={documentStateLabel(t, rowState)}
      stateReason={terminal && rowState !== 'PROCESSED'
        ? `${t(`vr3.recognition.${doc.recognitionQuality}`)} · ${t(`vr3.medium.${doc.recognitionMedium}`)}`
        : undefined}
      progress={documentProgress(runtime?.state ?? 'QUEUED')}
      active={active}
      stale={runtime?.stale}
      lineage={lineageText || undefined}
      rowMotion={rowMotion}
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
            alt={asset ? tx(asset.motifDe) : undefined}
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
  const s = useStore()
  const t = useT()
  const state = readiness(project, analysis)
  const tab = s.understandingTab
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

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

  const move = (from: number, delta: 1 | -1) => {
    const next = (from + delta + tabs.length) % tabs.length
    s.setUnderstandingTab(tabs[next]!.id)
    tabRefs.current[next]?.focus()
  }

  return (
    <>
      <ProjectIdentityUtilities project={project} />
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
      <div
        className="a3-understanding-tabs"
        role="tablist"
        aria-label={t('vr3.understanding.tablist')}
      >
        {tabs.map((entry, index) => (
          <button
            key={entry.id}
            ref={(el) => { tabRefs.current[index] = el }}
            type="button"
            role="tab"
            id={`understanding-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`understanding-panel-${entry.id}`}
            tabIndex={tab === entry.id ? 0 : -1}
            className={tab === entry.id
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
  const tx = useTx()
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
                    alt={asset ? tx(asset.motifDe) : undefined}
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
                  {/* The leading area is the value the whole commercial
                      scale rests on, so it carries its evidence with it
                      rather than a bare authority badge. */}
                  <div className="a3-building-authority">
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
  const tx = useTx()
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
              alt={tx(asset.motifDe)}
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
    return <p className="a3-understanding-copy">{t('vr3.readiness.lead.ready')}</p>
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
  const busy = analysis.creatingOption

  const create = () => {
    s.beginOptionCreation()
    window.setTimeout(() => { s.createOption() }, OPTION_COMMIT_MS)
  }

  return (
    <ActionGate
      status={analysis.optionCreationErrorKey
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
      route={state.canCreateOption ? undefined : {
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
      error={analysis.optionCreationErrorKey ? {
        message: t(analysis.optionCreationErrorKey),
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
        loadingLabel={t('vr3.readiness.creatingOption')}
        onClick={create}
      >
        {t('vr3.readiness.createOption')}
      </Button>
    </ActionGate>
  )
}

/* ─────────────────────────── stage 2b · ready ─────────────────────────── */

function ReadyStage({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const t = useT()
  const tx = useTx()
  const asset = projectAsset(project.heroAssetId)
  const state = readiness(project, analysis)

  return (
    <>
      <ProjectIdentityUtilities project={project} />
      <ProjectReadiness
        eyebrow={t('vr3.readiness.eyebrow.ready')}
        heading={t('vr3.readiness.title.ready')}
        explanation={t('vr3.readiness.lead.ready')}
        rows={[
          {
            id: 'blocking',
            label: t('vr3.readiness.row.blockingConflicts'),
            value: state.unresolvedBlockingConflicts,
          },
          {
            id: 'metrics',
            label: t('vr3.readiness.row.requiredInformation'),
            value: t('vr3.readiness.row.requiredInformationComplete'),
          },
          {
            id: 'baseline',
            label: t('vr3.readiness.row.projectBaseline'),
            value: t('vr3.readiness.row.projectBaselineConfirmed'),
          },
          {
            id: 'questions',
            label: t('vr3.readiness.row.openQuestions'),
            value: t('vr3.readiness.row.openQuestionsValue', {
              open: state.openQuestions, blocking: state.blockingQuestions,
            }),
          },
        ]}
        action={<CreateOptionGate project={project} analysis={analysis} />}
        media={(
          <MediaFrame
            ratio="pano"
            state={asset ? 'loaded' : 'fallback'}
            src={asset?.url}
            alt={asset ? tx(asset.motifDe) : undefined}
            seed={project.id}
            sourceId={asset?.assetId}
          />
        )}
      />
      <div className="a3-understanding-body">
        <UnderstandingOverview
          project={project}
          analysis={analysis}
          readinessPanel={<ReadinessRows project={project} analysis={analysis} />}
        />
      </div>
    </>
  )
}

/* ───────────────────── stage 3 · Option created ───────────────────── */

function OptionCreatedStage({ project }: { project: FixtureProject }) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const asset = projectAsset(project.heroAssetId)
  const latest = s.options.at(-1) ?? null

  // VR3-01's boundary ends the moment Create Option is triggered; VR3-02
  // owns the full Option-created composition (`T-012`) and Gebäude & Umfang.
  // What is here is the honest hand-off: the Option exists, the project
  // baseline snapshot behind it is recorded, and the only substantive next
  // step is reachable.
  return (
    <>
      <ProjectIdentityUtilities project={project} />
      <ProjectReadiness
        eyebrow={t('vr3.readiness.optionCreated')}
        heading={latest ? latest.name : t('vr3.readiness.optionCreated')}
        explanation={t('vr3.readiness.optionCreatedLead')}
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
          {
            id: 'decisions',
            label: t('vr3.readiness.row.blockingConflicts'),
            value: s.projectBaseline.conflictDecisions.length,
          },
        ] : []}
        action={latest ? (
          <Button variant="primary" onClick={() => s.openOption(latest.id)}>
            {t('vr3.readiness.openOption')}
          </Button>
        ) : undefined}
        media={(
          <MediaFrame
            ratio="pano"
            state={asset ? 'loaded' : 'fallback'}
            src={asset?.url}
            alt={asset ? tx(asset.motifDe) : undefined}
            seed={project.id}
            sourceId={asset?.assetId}
          />
        )}
      />
      <ProjectOptionsSection justCreatedOptionId={latest?.id ?? null} />
    </>
  )
}

/* ───────────────────────── project utilities ───────────────────────── */

/**
 * The internal note (DC-43) is a released Opportunity-level capability and
 * it survives this rebuild unchanged: it does not exist in a client
 * projection at all, and it stays a header utility rather than competing
 * with the workflow for attention.
 */
function ProjectIdentityUtilities({ project }: { project: FixtureProject }) {
  const s = useStore()
  const tx = useTx()
  const [noteOpen, setNoteOpen] = useState(false)
  const noteButtonRef = useRef<HTMLButtonElement>(null)
  const client = useMemo(() => `${project.client} · ${project.city}`, [project])

  if (s.mode === 'praesentation') return null

  return (
    <div className="a3-project-utilities">
      <p className="a3-project-utilities-meta">{client}</p>
      <Button
        ref={noteButtonRef}
        variant="ghost"
        onClick={() => setNoteOpen(true)}
      >
        {tx('Interne Notiz')}
      </Button>
      <InternalNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        returnFocusTo={noteButtonRef}
      />
    </div>
  )
}
