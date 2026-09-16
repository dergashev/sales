import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Decimal } from 'decimal.js'
import { AnimatePresence } from 'framer-motion'
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
  type AnalysisWorkspaceState,
  type DocumentDisplayState,
  type FixtureConflict,
  type FixtureDocument,
  type FixtureProject,
  type FixtureQuestion,
  type ProjectAnalysis,
} from '../state/projectAnalysis'
import {
  EVIDENCE_GROUPS,
  evidenceAuthorityTrace,
  evidenceCounts,
  evidenceGroupKey,
  evidenceGroupView,
  withEvidenceConfirmations,
  isConfirmable,
  evidenceSource,
  needsAttention,
  type EvidenceGroup,
  type FixtureEvidenceItem,
} from '../state/projectEvidence'
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
import { NNBSP, formatDE } from '../engine/money'
import { localizeMoneyText, useT } from '../i18n'
import { Button } from '../components/primitives'
import { Combobox, SegmentedControl } from '../components/controls'
import { FormField } from '../components/designSystem'
import { EmptyState, StaleState } from '../components/DataStates'
import { MediaFrame } from '../design-system/MediaFrame'
import { ProjectWorkflowNavigator } from '../components/WorkflowSpine'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { AuthorityTrace, type InformationAuthority } from '../design-system/AuthorityTrace'
import {
  DocumentRow, ProcessingJob,
  type DocumentRowState, type ProcessingJobState,
} from '../design-system/ProcessingJob'
import { Pagination } from '../design-system/Pagination'
import { ConflictResolver } from '../design-system/ConflictResolver'
import { QuestionItem, QuestionQueue } from '../design-system/QuestionQueue'
import { projectAsset } from '../assets/project-media'
import { documentAnchor, documentAsset } from '../assets/document-media'
import { useSemanticMotion } from '../design-system/motion'
import { OptionsWorkspace } from './ProjectOptions'
import { S4Vergleich } from './S4Vergleich'

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

  /**
   * A NEW Option, announced once, by the ONE live region this shell owns.
   *
   * Creating an Option also makes it the active one (released
   * `createOption` behaviour, `store.ts:7028`) and that change was silent —
   * the audit's OPT-07. It is stated here rather than in the Options
   * workspace because a second polite region beside this one would deliver
   * the same message twice, which is the defect the Documents release
   * recorded and fixed.
   *
   * `justCreated` is also what the collection focuses. It is derived from a
   * real transition (the list grew) rather than from "the last Option",
   * which is why a returning user landing on `/optionen` does not have
   * focus yanked onto a card they did not just make.
   */
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const previousOptionCount = useRef(s.options.length)
  useEffect(() => {
    if (s.options.length > previousOptionCount.current) {
      const created = s.options[s.options.length - 1]
      if (created) {
        setJustCreated(created.id)
        setStageAnnouncement(t('vr3.options.announce.created', { option: created.name }))
      }
    } else if (s.options.length < previousOptionCount.current) {
      setJustCreated(null)
    }
    previousOptionCount.current = s.options.length
  }, [s.options, t])

  // Leaving the collection ends the "just created" continuity: coming back
  // later is a return, not a creation, and it must not steal focus again.
  const stageKey = s.projectStage
  useEffect(() => {
    if (stageKey !== 'options') setJustCreated(null)
  }, [stageKey])

  if (!project || !analysis) return null

  const state = readiness(project, analysis)
  const stage = s.projectStage

  return (
    <div className="a3-project-shell">
      {/* The project's own identity band is gone: the breadcrumb above and
          the journey rail beside it both name the project, and a third
          statement of the same fact spent a band of the workspace on it. */}
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
        ) : stage === 'comparison' ? (
          /* A cross-Option destination of the PROJECT tier. It renders here
             rather than inside an Option because it is ABOUT the collection;
             the surface itself is unchanged by this ticket. */
          <S4Vergleich />
        ) : (
          <OptionsWorkspace
            project={project}
            analysis={analysis}
            justCreatedOptionId={justCreated}
          />
        )}
        {stage === 'understanding' ? (
          <GoToOptionsStep project={project} analysis={analysis} />
        ) : null}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{stageAnnouncement}</p>
    </div>
  )
}

/**
 * The one forward step of stage 2, at the bottom left of the stage.
 *
 * It states the gate rather than hiding it: while the project is not ready
 * the button is inert and names, on hover and on focus, exactly which
 * decisions are still owed — conflicts, blocking questions, values gone
 * stale, an incomplete baseline. Rule 12 holds: it explains, it never
 * silently refuses.
 */
function GoToOptionsStep({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const tipId = useId()
  const state = readiness(project, analysis)
  /* Counted on the evidence the READER sees: values settled in this session
     are settled here too, so the number falls as they work instead of
     quoting the fixture back at them.
     OVERRIDES COUNT AS SETTLED. A value somebody typed in themselves is
     human authority — the strongest kind the model has — and leaving it out
     of this projection made the gate demand that the reader confirm a
     number the machine no longer owns: the row said «entered manually» and
     the button went on counting it as derived. */
  const counts = evidenceCounts(withEvidenceConfirmations(
    project, analysis.evidenceConfirmations, analysis.evidenceOverrides,
  ))
  const openCount = openQuestions(project, analysis).length
  /* EVERY open conflict, not only the blocking ones: the tab beside this
     button counts all six, and a tip that says «0 conflicts» next to
     «Conflicts · 6» is the same fact told twice with two answers. */
  const conflictCount = project.conflicts
    .filter((conflict) => !conflictResolved(analysis, conflict.id)).length

  /* Counts, not instructions: the reader knows what a conflict is, and a
     line per kind reads faster than a sentence per kind. Every entry is a
     real number from the project — nothing is listed at zero. */
  const todo: string[] = [
    ...(counts.derived > 0
      ? [t('vr3.understanding.goToOptions.derived', { count: counts.derived })]
      : []),
    ...(conflictCount > 0
      ? [t('vr3.understanding.goToOptions.conflicts', { count: conflictCount })]
      : []),
    ...(openCount > 0
      ? [t('vr3.understanding.goToOptions.questions', { count: openCount })]
      : []),
    ...(state.staleFactKeys.length > 0
      ? [t('vr3.understanding.goToOptions.stale', { count: state.staleFactKeys.length })]
      : []),
  ]

  /* THE BUTTON IS BLOCKED BY EXACTLY WHAT THE TIP LISTS, and by nothing
     else. It used to add `readiness().canCreateOption`, which also weighs
     the analysis run and the required-fact count — conditions the tip no
     longer names. Confirming the last derived value then emptied the tip
     and left the button inert with no stated reason, which is rule 12's
     defect precisely: a blocked control that cannot say why.
     Option creation keeps its own gate on the Options stage; this control
     only says whether the reading here is finished. */
  const blocked = todo.length > 0

  return (
    <div className="a3-gostep">
      {/* The tip is owned by the wrapper, not by the button: an inert
          control still receives focus here (`aria-disabled`, never the
          native `disabled`), so hover and keyboard reach the same text. */}
      <span className="a3-gostep-anchor">
        <Button
          variant="primary"
          disabled={blocked}
          aria-describedby={blocked ? tipId : undefined}
          onClick={blocked ? undefined : () => s.openOptionsStage()}
        >
          {t('vr3.understanding.goToOptions')}
        </Button>
        {blocked ? (
          <span className="a3-gostep-tip" role="tooltip" id={tipId}>
            <span className="a3-gostep-tip-head">
              {t('vr3.understanding.goToOptions.blocked')}
            </span>
            <ul className="a3-gostep-tip-list">
              {todo.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </span>
        ) : null}
      </span>
      {/*
       * NUR FÜR DIE VORFÜHRUNG — und als solche beschriftet.
       *
       * Sie überspringt kein Tor und kennt keinen eigenen Weg daran vorbei:
       * sie führt genau die Handlungen aus, die ein Mensch hier ausführen
       * würde, in derselben Reihenfolge und über dieselben Aktionen. Jede
       * davon schreibt ihr Ereignis (M-4), also ist jeder Schritt einzeln
       * rückgängig zu machen, und das Tor öffnet sich, weil nichts mehr
       * offen ist — nicht, weil es umgangen wurde.
       *
       * Die Fragen werden als BEANTWORTET verbucht, nicht als Annahme: eine
       * Vorführung, die stillschweigend fünf Annahmen ins Angebot legt,
       * hätte in der finalen Prüfung fünf Hinweise erzeugt, die niemand
       * getroffen hat.
       */}
      {blocked ? (
        <Button
          variant="secondary"
          onClick={() => {
            for (const conflict of project.conflicts) {
              if (conflictResolved(analysis, conflict.id)) continue
              s.resolveProjectConflict(conflict.id, {
                kind: 'candidate', candidateId: conflict.recommendedCandidateId,
              })
            }
            for (const question of openQuestions(project, analysis)) {
              s.recordProjectQuestionResponse(question.id, 'answer')
            }
            for (const item of withEvidenceConfirmations(
              project, analysis.evidenceConfirmations, analysis.evidenceOverrides,
            ).evidence) {
              if (isConfirmable(item)) s.confirmProjectEvidence(item.id)
            }
            s.openOptionsStage()
          }}
        >
          {t('vr3.understanding.goToOptions.demo')}
        </Button>
      ) : null}
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
  /**
   * Which source viewer is OPEN — from the URL, not from component state.
   *
   * An id the project does not have is dropped HERE, the only layer that
   * knows the register: a copied link naming a foreign document opens the
   * plain register rather than an empty viewer.
   */
  const openDetailId = project.documents.some((d) => d.id === query.open)
    ? query.open
    : null
  /* The trigger to give focus back to. The panel is not a modal, so nothing
     restores it automatically; the element is captured at the moment of the
     click, which is the one moment the row's own button is focused. */
  const previewTrigger = useRef<HTMLElement | null>(null)
  const setOpenDetailId = (next: string | null) => {
    if (next) previewTrigger.current = document.activeElement as HTMLElement | null
    patchQuery({ open: next ?? '' })
    if (!next) {
      const back = previewTrigger.current
      previewTrigger.current = null
      back?.focus?.()
    }
  }
  const previewDoc = openDetailId
    ? project.documents.find((d) => d.id === openDetailId) ?? null
    : null
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
        <div className="a3-docws-headline">
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
        </div>
        {/* WHERE the documents came from, with the folder itself as a link.
            In testing a first-time reader read the register as a drop zone
            and its primary action as «upload these»: the page showed eight
            files and never said how they got here. The register cannot say
            it — a list of rows is silent about its own origin — so the
            sentence belongs to the header, and it STAYS after the analysis:
            «where do these files live» is asked again the moment somebody
            wants to add or replace one. */}
        <DocumentOriginLine />
      </header>

      <div className="a3-docws" data-preview={previewDoc ? 'true' : undefined}>
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

        {previewDoc ? (
          <>
            {/* The empty half the sticky panel left behind — the same device
                the evidence split uses, and what keeps the register narrow
                instead of sliding back underneath the panel. */}
            <div className="a3-docpanel-slot" aria-hidden="true" />
            <DocumentPreview
              project={project}
              doc={previewDoc}
              rowState={displayState(previewDoc.id) as DocumentRowState}
              citedAnchorId={query.anchor || null}
              onClose={() => setOpenDetailId(null)}
            />
          </>
        ) : null}
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
        <dd className="numeric">{evidenceCounts(project).total}</dd>
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
    />
  )
}

/**
 * Where the files came from, with the folder itself as a link.
 *
 * ONE translatable sentence, split on its own `{link}` placeholder rather
 * than assembled from fragments: a language that puts the folder first still
 * gets one string to translate, and no word order is baked into JSX.
 *
 * The href is a DEMONSTRATION target — this prototype has no Drive
 * connection — so the click is prevented rather than followed. It is marked
 * as a link (underline, link glyph) because the question it answers is
 * «where do these files live», and a sentence that merely NAMES the folder
 * leaves the reader where they started.
 *
 * The orange (rule 5) is on the GLYPH only. At 14 px the brand orange is
 * 3,10:1 on white — below the 4,5:1 body-text bar and permitted for text
 * only at hero size — while a graphical object needs 3:1, which it clears.
 * The link's own affordance is the underline, which does not depend on
 * colour at all (rule 8's habit, applied to a link).
 */
function DocumentOriginLine() {
  const t = useT()
  const [before, after] = t('vr3.documents.origin').split('{link}')
  return (
    <p className="a3-docws-origin">
      {before}
      <a
        className="a3-docws-origin-link hit-target"
        href={DEMO_PROJECT_FOLDER_HREF}
        onClick={(event) => event.preventDefault()}
      >
        <svg className="a3-docws-origin-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M6.5 9.5 9.5 6.5M7 4.5 8.8 2.7a2.4 2.4 0 1 1 3.4 3.4L10.4 7.9M9 11.5l-1.8 1.8a2.4 2.4 0 1 1-3.4-3.4L5.6 8.1"
            fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square"
          />
        </svg>
        {t('vr3.documents.origin.folder')}
      </a>
      {after}
    </p>
  )
}

/** Demonstration target: the prototype has no document-storage connection. */
const DEMO_PROJECT_FOLDER_HREF = '/demo/projektordner'

/** The one preview region of the documents register (see `DocumentPreview`). */
const DOCUMENT_PREVIEW_PANEL_ID = 'documents-preview-panel'

/**
 * The document, beside the register that lists it.
 *
 * The same surface the evidence step uses (`.a3-docpanel`), for the same
 * reason: a preview that covers the list makes the reader choose between
 * looking at the file and keeping their place in the register, and the whole
 * task here is comparing one against the many. Not a modal — the register
 * stays live, so Esc and the focus return have to be provided by hand, and
 * are.
 */
function DocumentPreview({
  project, doc, rowState, citedAnchorId, onClose,
}: {
  project: FixtureProject
  doc: FixtureDocument
  rowState: DocumentRowState
  citedAnchorId: string | null
  onClose: () => void
}) {
  const t = useT()
  const titleId = useId()
  void project

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside id={DOCUMENT_PREVIEW_PANEL_ID} className="a3-docpanel" aria-labelledby={titleId}>
      <div className="a3-docpanel-head">
        <h3 id={titleId} className="a3-docpanel-title">{doc.file}</h3>
        <Button
          variant="ghost"
          className="a3-docdrawer-close"
          aria-label={t('vr3.evidence.viewer.close')}
          onClick={onClose}
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4 L20 20 M20 4 L4 20"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"
            />
          </svg>
        </Button>
      </div>
      <DocumentSourceViewer doc={doc} rowState={rowState} citedAnchorId={citedAnchorId} />
    </aside>
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
      /* The document opens BESIDE the register, not under the row: the
         register keeps its order and its scroll position while the file is
         read, which is what a preview is for. The row still owns the
         control, so the disclosure names the region it opens. */
      detailControlsId={DOCUMENT_PREVIEW_PANEL_ID}
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
  const s = useStore()
  const tab = s.understandingTab

  /**
   * `v4` — EINE LISTE STATT DREI REITERN.
   *
   * Reiter trennten hier drei Sichten auf DENSELBEN Sachverhalt: die
   * ausgelesenen Angaben, die strittigen darunter und die Fragen dazu. Wer
   * die Checkliste las, sah nicht, dass sechs ihrer Werte umstritten sind;
   * wer die Konflikte las, sah die Liste nicht, in der sie stehen. Drei
   * Zählstände im Reiterband waren der Ersatz dafür — eine Zahl statt der
   * Sache.
   *
   * Also steht alles in einer Liste, und der Unterschied wird gesagt, wo er
   * hingehört: am Punkt selbst, als Status. Entschieden wird an Ort und
   * Stelle, im selben Format wie jede andere Zeile der Checkliste.
   */
  if (s.navVariant === 'v4') {
    return <UnderstandingOverview project={project} analysis={analysis} merged />
  }

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
          <UnderstandingOverview project={project} analysis={analysis} />
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

/**
 * A timestamp in the READER's calendar, never the machine's.
 *
 * The journal stores ISO-8601 with an offset, which is the right thing to
 * store and the wrong thing to show: «2026-06-08T10:20:00+02:00» is a
 * serialisation format, and rule 36 puts every date through `Intl`.
 */
function localDateTime(iso: string, language: 'de' | 'en'): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(at)
}

function UnderstandingOverview({
  project, analysis, merged,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  /** `v4`: conflicts and questions stand in the checklist, not beside it. */
  merged?: boolean
}) {
  const t = useT()
  const [filter, setFilter] = useState<ChecklistFilter>('all')

  return (
    <div className="a3-understanding-body">
      {analysis.staleFactKeys.length > 0 ? (
        <StaleState>
          {t('vr3.understanding.staleNotice', { count: analysis.staleFactKeys.length })}
        </StaleState>
      ) : null}

      {/* «Evidence detail» — the last beat of the reveal order this block
          declares at the top, and the reason a reader opens Project
          Understanding at all.

          The four groups used to be mounted ONLY in `ReadyStage`, which made
          them a REWARD for having resolved every conflict: on the complex
          project — the one with six of them — the page that exists to
          explain what was understood showed aggregate counts and nothing
          else until the work was already finished. They are facts the
          analysis produced, not a readiness state, and a contested item says
          so on its own row (its `state`, and the competing value beside the
          confirmed one). So they belong on BOTH presentations of this stage:
          the reader sees the same four groups before and after the gate
          opens, and watches the contested ones settle. */}
      <EvidenceGroups
        project={project}
        filter={merged ? filter : undefined}
        toolbar={merged ? (
          <ChecklistFilterControl
            project={project}
            value={filter}
            onChange={setFilter}
          />
        ) : undefined}
        lead={merged ? (
          <DecisionsPanel project={project} analysis={analysis} filter={filter} />
        ) : undefined}
      />
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


/* ───────────── v4 · decisions inside the checklist ───────────── */

/**
 * THE POINTS THAT ARE STILL OPEN, AS ROWS OF THE CHECKLIST.
 *
 * Same section shape as an evidence group, same list, same disclosure — so
 * it reads as the first group of one list rather than as a panel that
 * happens to sit above one. What distinguishes a row here is its STATUS, and
 * the status says which kind of open point it is: a contested value or an
 * unanswered question. Both are things somebody has to decide; splitting
 * them into two tabs made the reader ask twice.
 *
 * It disappears when there is nothing open — an empty "to decide" group
 * would be a heading for work that does not exist.
 */
function DecisionsPanel({
  project, analysis, filter = 'all',
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  filter?: ChecklistFilter
}) {
  const conflicts = filter === 'all' || filter === 'conflict' ? project.conflicts : []
  const questions = filter === 'all' || filter === 'question' ? project.questions : []
  if (conflicts.length + questions.length === 0) return null

  /**
   * KEINE EIGENE GRUPPE, KEINE EIGENE ÜBERSCHRIFT (Owner, 16.09.2026).
   *
   * Eine Gruppe «Zu entscheiden» mit eigenem Zählstand war eine zweite
   * Aussage über denselben Bestand — der Zustand steht an jeder Zeile, und
   * die Summe darüber sagte dasselbe noch einmal, nur unschärfer. Die Punkte
   * sind Zeilen der Liste, also stehen sie als Zeilen darin.
   *
   * Die REIHENFOLGE kommt aus der Quelle und aus nichts sonst: erst die
   * strittigen Angaben in ihrer Reihenfolge, dann die Fragen in ihrer. Kein
   * Sortieren nach Zustand — sonst spränge eine Zeile in dem Moment weg, in
   * dem der Leser sie entscheidet, und er verlöre die Stelle, an der er
   * gerade arbeitet. Bestätigen ändert die Zeile, nicht ihren Platz.
   */
  return (
    <dl className="a3-evlist">
      {conflicts.map((conflict) => (
        <ConflictRow
          key={conflict.id}
          project={project}
          analysis={analysis}
          conflict={conflict}
        />
      ))}
      {questions.map((question) => (
        <QuestionRow
          key={question.id}
          project={project}
          analysis={analysis}
          question={question}
        />
      ))}
    </dl>
  )
}

/**
 * Der Filter über der Checkliste.
 *
 * Er blendet AUS, er entscheidet nichts: eine ausgeblendete Zeile bleibt
 * offen, und die Tore lesen weiterhin den ganzen Bestand. Genau diese
 * Trennung hat der alte Umfang-Umschalter (DC-46) auch getragen — ein
 * Filter, der still den Gegenstand des Angebots ändert, wäre ein Schalter,
 * der verkauft.
 *
 * Ein `<select>` und keine vier Segmente: LOCALE-004 lässt ab vier
 * übersetzten Beschriftungen nur noch die Liste zu, weil vier Labels in
 * einer Reihe auf FR/ES die Zeile sprengen (Regel 36).
 */
export type ChecklistFilter = 'all' | 'conflict' | 'question' | 'derived'

function ChecklistFilterControl({
  project, value, onChange,
}: {
  project: FixtureProject
  value: ChecklistFilter
  onChange: (next: ChecklistFilter) => void
}) {
  const t = useT()
  /* Die Zählstände stehen IN den Chips, nicht daneben: eine Zahl neben dem
     Filter wäre eine zweite Stelle, an der derselbe Bestand gezählt wird —
     und zwei Zähler gehen auseinander, sobald einer vergessen wird. */
  const derived = project.evidence.filter((item) => item.authority === 'derived').length
  const options: Array<{ id: ChecklistFilter; label: string }> = [
    {
      id: 'all',
      label: t('vr3.checklist.filter.all', {
        count: project.evidence.length + project.conflicts.length + project.questions.length,
      }),
    },
    {
      id: 'conflict',
      label: t('vr3.checklist.filter.conflicts', { count: project.conflicts.length }),
    },
    {
      id: 'question',
      label: t('vr3.checklist.filter.questions', { count: project.questions.length }),
    },
    { id: 'derived', label: t('vr3.checklist.filter.derived', { count: derived }) },
  ]
  return (
    /*
     * CHIPS, NICHT VIER SEGMENTE.
     *
     * `SegmentedControl` verbietet die vierte übersetzte Beschriftung nicht
     * wegen der Zahl, sondern wegen der BREITE: vier Labels in einer starren
     * Reihe reissen die Zeile auf FR/ES auf (LOCALE-004, Regel 36). Der Chip
     * ist der Kontrolltyp, der genau dafür da ist — er bricht um, statt zu
     * drücken, und er ist als kanonischer Primitiv bereits vorhanden
     * (`.a3-chip-control`, 44-px-Zone, `aria-pressed`). Also kein neuer
     * Kontrolltyp und keine Vertragsänderung.
     */
    <div className="a3-filter-row a3-evgroups-filter" role="group" aria-label={t('vr3.checklist.filter.label')}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="a3-chip-control hit-target"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Sentinel for «ein Wert, den keine Quelle nennt». Never a candidate id. */
const CONFLICT_CUSTOM = '__custom__'

/**
 * A contested value as ONE checklist row.
 *
 * The full `ConflictResolver` stays where it is and keeps doing what it is
 * for — two sources side by side with their authority, their document and a
 * preview of each. Inside the checklist that card would be four screens of
 * evidence between two ordinary rows, so the row states the decision and
 * offers it in the format the list already uses for a value: the candidates
 * as segments, Apply beside them, and the source of each candidate named in
 * words underneath. The reader who wants the documents opens them from the
 * citation, exactly as on every other row.
 */
function ConflictRow({
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
  /**
   * Der dritte Weg: ein Wert, den keine der beiden Quellen nennt.
   *
   * Das Datenmodell kannte ihn von Anfang an (`ConflictChoice.manual` mit
   * Wert und Grund), nur gab es keine Stelle, ihn einzugeben — also war
   * jede Entscheidung gezwungen, eines von zwei Dokumenten zu wiederholen,
   * auch wenn der Mensch wusste, dass beide falsch sind. `CUSTOM` ist kein
   * Kandidat, deshalb ist es eine eigene Sentinel-Auswahl und kein
   * Eintrag in `conflict.candidates`.
   */
  const [choice, setChoice] = useState<string>(conflict.recommendedCandidateId)
  const [draft, setDraft] = useState('')
  const [missing, setMissing] = useState(false)
  const customField = useRef<HTMLInputElement>(null)
  const customId = useId()
  const custom = choice === CONFLICT_CUSTOM

  const candidateLabel = (candidateId: string) => {
    const candidate = conflict.candidates.find((c) => c.id === candidateId)
    if (!candidate) return candidateId
    return candidate.valueKey
      ? t(candidate.valueKey)
      : `${num(candidate.value ?? '0')}${conflict.unit ? `${NNBSP}${conflict.unit}` : ''}`
  }

  const scopeLabel = conflict.buildingId
    ? t('vr3.understanding.conflictScopeBuilding', {
      name: project.buildings.find((b) => b.id === conflict.buildingId)?.name ?? conflict.buildingId,
    })
    : t('vr3.understanding.conflictScopeProject')
  const resolvedValue = resolvedConflictValue(conflict, decision)

  return (
    <div className="a3-evitem" data-attention={resolved ? undefined : true}>
      {/* Der Geltungsbereich gehört zum NAMEN der Sache, nicht zu ihrem
          Zustand: «Gesamt-BGF» ohne «Projektebene» ist unvollständig, und
          «offen» ohne Projektebene ist vollständig. In der Statuszeile
          stand er zwischen zwei Aussagen über den Fortschritt und las sich
          wie eine dritte. */}
      <dt className="a3-evitem-label">
        {t(conflict.conceptKey)}
        <span className="a3-decrow-scope">{scopeLabel}</span>
      </dt>
      <dd className="a3-evitem-body">
        {/* Der Status TRÄGT die Unterscheidung: welche Art offener Punkt das
            ist, steht neben dem Zustand und nicht in einem Reiter darüber.
            Nie allein durch Farbe (Regel 8) — Zeichen und Wort. */}
        <p className="a3-decrow-marks">
          {/* Der Status NENNT die Art, wie in der grossen Karte: ein
              strittiger Wert heisst «Strittige Angabe», und wenn er das Tor
              schliesst, heisst er «Blockierende strittige Angabe». «Offen»
              daneben ein zweites Mal zu sagen, war eine Zeile, die den
              Unterschied zur Frage gerade wieder einebnete — und dieselben
              Wörter wie dort, aus denselben Schlüsseln, damit die beiden
              Darstellungen nicht auseinanderlaufen können. */}
          <SemanticStatus
            tone={resolved ? 'ok' : 'attention'}
            size="compact"
            label={resolved
              ? t('ds.conflict.state.resolved')
              : conflict.blocking
                ? t('ds.conflict.state.blocking')
                : t('ds.conflict.state.nonBlocking')}
          />
          {/* Ein Wert, den ein Mensch eingetragen hat, sagt das beim
              Zustand — nicht erst im Verlauf. «Entschieden» allein liest
              sich, als hätte eine der beiden Quellen gewonnen, und genau
              das ist hier nicht passiert. */}
          {resolved && decision?.choice.kind === 'manual' ? (
            <span className="a3-decrow-manual">
              {t('vr3.evidence.override.manualReason')}
            </span>
          ) : null}
        </p>
        <p className="a3-decrow-impact">{t(conflict.mattersKey)}</p>

        {resolved && decision ? (
          <>
            <p className="a3-decrow-decided">
              <span className="numeric">
                {resolvedValue?.valueKey
                  ? t(resolvedValue.valueKey)
                  : `${resolvedValue?.displayValue ?? ''}${
                    conflict.unit ? `${NNBSP}${conflict.unit}` : ''}`}
              </span>
            </p>
            <div className="a3-evitem-meta">
              <button
                type="button"
                className="a3-evitem-edit hit-target"
                onClick={() => s.reopenProjectConflict(conflict.id)}
              >
                {/* «Bearbeiten», wie auf jeder anderen Zeile der Liste:
                    die Handlung ist dieselbe — die Entscheidung wieder
                    offenlegen und ändern —, und zwei Namen dafür wären zwei
                    Handlungen für den Leser. */}
                {t('vr3.evidence.edit')}
              </button>
            </div>
          </>
        ) : (
          /* Die Entscheidung liest sich von oben nach unten, wie jede
             andere Zeile der Checkliste: erst die Kandidaten, dann woher
             der gewählte Wert stammt, dann der Knopf, der ihn gelten
             lässt. Nebeneinander stand der Knopf VOR seinem eigenen Grund
             — man drückte, bevor die Quelle gelesen war. */
          <div className="a3-decrow-choice">
            <SegmentedControl
              legend={t('vr3.understanding.conflictChoiceLegend')}
              legendHidden
              size="compact"
              value={choice}
              onChange={(next) => setChoice(next)}
              /* JEDER Kandidat sagt, WAS er ist, bevor er gewählt wird.
                 Zwei nackte Zahlen nebeneinander sind keine Wahl: sie
                 verlangen vom Leser, sich zu erinnern, welche aus der
                 neueren Quelle stammt — und genau diese Auskunft ist der
                 Grund, warum die grosse Karte beide Quellen zeigt. Die
                 Marke steht deshalb AN der Zahl, nicht erst unter ihr. */
              options={[
                ...conflict.candidates.map((candidate) => ({
                  value: candidate.id,
                  label: candidateLabel(candidate.id),
                  detail: t(candidate.recommended
                    ? 'ds.conflict.recommendedSource'
                    : candidate.superseded
                      ? 'ds.conflict.supersededSource'
                      : 'vr3.decisions.mark.older'),
                })),
                {
                  value: CONFLICT_CUSTOM,
                  label: t('vr3.evidence.edit.custom'),
                  detail: t('vr3.decisions.mark.manual'),
                },
              ]}
            />
            {custom ? (
              <div className="a3-docdrawer-field">
                <label className="a3-docdrawer-field-label" htmlFor={customId}>
                  {t('vr3.evidence.viewer.customValueLabel', {
                    label: t(conflict.conceptKey),
                  })}
                </label>
                <span className="a3-input">
                  <input
                    ref={customField}
                    id={customId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft}
                    aria-invalid={missing || undefined}
                    onChange={(event) => { setDraft(event.target.value); setMissing(false) }}
                  />
                  {conflict.unit ? <span className="a3-unit">{conflict.unit}</span> : null}
                </span>
                {missing ? (
                  <p className="a3-docdrawer-field-error" role="alert">
                    {t('vr3.evidence.viewer.customValueEmpty')}
                  </p>
                ) : null}
              </div>
            ) : null}
            {/* Woher der gewählte Wert stammt — EINE Zeile, die sich mit der
                Wahl ändert. Die Karte zeigt beide Quellen nebeneinander;
                hier zählt die Quelle dessen, was gleich gelten soll. */}
            {/* Und darunter, was der Systemvorschlag ist — eine Aussage
                über die EMPFEHLUNG, nicht über das Alter der Quelle, also
                eine andere als die Marke am Segment. */}
            <p className="a3-decrow-source">
              {custom
                ? t('vr3.decisions.manualNote')
                : choice === conflict.recommendedCandidateId
                ? t('vr3.decisions.sourceWithFlag', {
                  flag: t('ds.conflict.recommendationFlag'),
                  source: sourceLine(project, conflict, choice, t),
                })
                : sourceLine(project, conflict, choice, t)}
            </p>
            <div className="a3-docdrawer-actions">
              <Button
                variant="primary"
                onClick={() => {
                  if (custom) {
                    /* Nicht dauerhaft gesperrt, sondern beim Druck
                       geantwortet — dieselbe Regel wie im Zeileneditor: ein
                       stehender Satz «erst einen Wert eingeben» ist eine
                       Anweisung, keine Erklärung (Regel 12). */
                    if (draft.trim() === '') {
                      setMissing(true); customField.current?.focus(); return
                    }
                    s.resolveProjectConflict(conflict.id, {
                      kind: 'manual',
                      value: draft.trim(),
                      reason: t('vr3.evidence.override.manualReason'),
                    })
                    return
                  }
                  s.resolveProjectConflict(conflict.id, {
                    kind: 'candidate', candidateId: choice,
                  })
                }}
              >
                {/* Nur «Bestätigen». Der Knopf steht IN der Zeile, die die
                    Entscheidung ist — «Entscheidung bestätigen» sagte das
                    Substantiv, das schon zweimal darüber steht. In der
                    grossen Karte (v1–v3) bleibt der lange Name, dort trägt
                    er den Kontext. */}
                {t('vr3.decisions.confirm')}
              </Button>
            </div>
          </div>
        )}
      </dd>
    </div>
  )
}

/** The chosen candidate's document, version and date, as one sentence. */
function sourceLine(
  project: FixtureProject,
  conflict: FixtureConflict,
  candidateId: string,
  t: ReturnType<typeof useT>,
): string {
  const candidate = conflict.candidates.find((c) => c.id === candidateId)
  const doc = project.documents.find((d) => d.id === candidate?.docId)
  if (!candidate || !doc) return t(`vr3.sourceAuthority.${candidate?.authority ?? 'unknown'}`)
  return t('vr3.decisions.source', {
    authority: t(`vr3.sourceAuthority.${candidate.authority}`),
    file: doc.file,
    version: doc.version,
  })
}

/** An open question as one checklist row, with the same two answers. */
function QuestionRow({
  project, analysis, question,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  question: FixtureQuestion
}) {
  const s = useStore()
  const t = useT()
  const response = analysis.questionResponses[question.id]
  const scope = question.buildingId
    ? t('vr3.understanding.conflictScopeBuilding', {
      name: project.buildings.find((b) => b.id === question.buildingId)?.name ?? question.buildingId,
    })
    : t('vr3.understanding.conflictScopeProject')

  return (
    <div className="a3-evitem" data-attention={response ? undefined : true}>
      <dt className="a3-evitem-label">
        {t(question.questionKey)}
        <span className="a3-decrow-scope">{scope}</span>
      </dt>
      <dd className="a3-evitem-body">
        <p className="a3-decrow-marks">
          <SemanticStatus
            tone={response ? 'ok' : 'attention'}
            size="compact"
            label={response
              ? t('vr3.decisions.state.answered')
              : t('vr3.decisions.state.open')}
          />
        </p>
        <p className="a3-decrow-impact">{t(question.mattersKey)}</p>
        {question.assumptionPermitted && !response ? (
          <p className="a3-decrow-assumption">{t(question.responseKey)}</p>
        ) : null}
        {response ? (
          <p className="a3-decrow-decided">
            <span>{t(question.responseKey)}</span>
            <span className="a3-decrow-decided-meta">
              {`${response.actor} · ${response.at.slice(0, 10)}`}
            </span>
          </p>
        ) : (
          <div className="a3-docdrawer-actions">
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
          </div>
        )}
      </dd>
    </div>
  )
}

/* ─────────────────── readiness rows and the Option gate ─────────────────── */

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
  const [filter, setFilter] = useState<ChecklistFilter>('all')
  const clean = cleanPresentation(project, analysis)
  const open = openQuestions(project, analysis)

  const reviewPanel = useRef<HTMLDivElement | null>(null)

  // RESTORED, not preserved: at the audit baseline these two surfaces did not
  // exist once the gate opened, so seven open questions and six decisions were
  // numerals with no keyboard route of any kind (5 focusable elements in
  // `main`, none of them a route).
  /* `v4`: dieselbe eine Liste wie vor dem Tor. Das Tor öffnet sich, die
     Punkte bleiben, wo der Leser sie zuletzt gesehen hat — ein zweites
     Reiterband unter einer bereits offenen Checkliste hätte genau die
     Trennung zurückgebracht, die eine Zeile weiter oben aufgehoben ist. */
  const merged = s.navVariant === 'v4'

  const reviewTabs: Array<{ id: UnderstandingTab; label: string }> = clean || merged ? [] : [
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

  return (
    <div className="a3-ready">
      {/* The four groups are the page's CONTENT, not a disclosure: the
          reader came here to see what was understood. They sit directly after
          the outcome band and BEFORE the disclosed analysis detail, for two
          reasons that agree — «what do we know» reads before «how the run
          went», and the heading order stays h1 → h2 → h3 down the page. Put
          after the details region, this h2 followed the provenance column's
          h3 and the document outline read backwards. */}
      <EvidenceGroups
        project={project}
        filter={merged ? filter : undefined}
        toolbar={merged ? (
          <ChecklistFilterControl
            project={project}
            value={filter}
            onChange={setFilter}
          />
        ) : undefined}
        lead={merged ? (
          <DecisionsPanel project={project} analysis={analysis} filter={filter} />
        ) : undefined}
      />

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

/* ─────────────────────────── the source viewer ───────────────────────── */

/**
 * A document's own source, in a viewer that stays a viewer in every state.
 *
 * What this replaces: a `MediaFrame` pointed at one of six schematic SVGs
 * shared by thirty-six records. The audit's words were «It reads as a UI
 * placeholder, not a Project PDF», and the deeper problem was that two
 * different documents rendered the same picture — evidence that is
 * interchangeable is not evidence.
 *
 * Three rules the states obey:
 *
 * 1. **The chrome carries the facts, never the picture.** Filename, type,
 *    revision, issue date, `Seite n von m` and the cited clause are TEXT
 *    outside the embedded page. A reader who cannot see the rendering — a
 *    screen reader, a blocked plugin, a failed fetch — still gets the
 *    document's identity and their position in it.
 * 2. **Nothing collapses.** `unavailable` and `error` keep the viewer's box,
 *    name the file, say why, and offer a way on. A detail region that
 *    shrinks to nothing when a file is missing makes «missing» and «nothing
 *    to inspect» look identical.
 * 3. **A failed ANALYSIS is not a missing FILE.** A `FAILED` row means the
 *    analysis could not read the document; the document itself may open
 *    perfectly. The two reasons are stated separately because the recovery
 *    is different — retry the analysis, versus regenerate the pack.
 */
function DocumentSourceViewer({
  doc, rowState, citedAnchorId,
}: {
  doc: FixtureDocument
  rowState: DocumentRowState
  citedAnchorId: string | null
}) {
  const s = useStore()
  const t = useT()
  const language = s.uiLanguage as 'de' | 'en'
  const asset = documentAsset(doc.id)
  const anchor = citedAnchorId ? documentAnchor(doc.id, citedAnchorId) : null
  const page = anchor?.page ?? 1
  const pages = asset?.pages ?? doc.pages

  const identity = (
    <div className="a3-docsrc-identity">
      <p className="a3-docsrc-file">{doc.file}</p>
      <p className="a3-docsrc-meta">
        {t(`vr3.docType.${doc.documentType}`)}
        {' · '}
        {doc.version}
        {' · '}
        {t(`vr3.sourceAuthority.${doc.sourceAuthority}`)}
        {' · '}
        {doc.issuedAt}
      </p>
      {/* Position in the document, as words. `Seite 4 von 12` is the fact a
          reader needs to know where they are, and it must not depend on the
          rendered page image being visible at all. */}
      {pages !== null ? (
        <p className="a3-docsrc-position">
          {t('vr3.evidence.viewer.position', { page, pages })}
        </p>
      ) : null}
      {anchor ? (
        <p className="a3-docsrc-anchor">
          {t('vr3.evidence.viewer.citedClause', {
            label: language === 'en' ? anchor.labelEn : anchor.labelDe,
            anchor: anchor.id,
          })}
        </p>
      ) : null}
    </div>
  )

  if (!asset) {
    /**
     * No authored file for this record — so the drawer shows WHAT A VIEWER
     * LOOKS LIKE rather than an explanation of why there is nothing to see.
     *
     * A page outline with the shape of text on it: nothing legible, nothing
     * that could be mistaken for the document's content. The alternative the
     * product used to show — a schematic floor plan from the legacy image
     * model — was worse precisely because it WAS readable: two unrelated
     * records rendered the same picture and read as the same evidence.
     *
     * No recovery controls: `Erneut laden` promised to fetch a file that
     * does not exist in the fixture, and `Zurück` duplicated the drawer's
     * own close. The facts above the frame — file, type, version, page,
     * cited clause — are the real content here and are untouched.
     */
    return (
      <div className="a3-docsrc" data-state="unavailable">
        {identity}
        <div className="a3-docsrc-frame" data-empty>
          {rowState === 'FAILED' ? (
            /* The analysis failing is a different fact from the file being
               absent, and it keeps its own sentence. */
            <p className="a3-docsrc-reason">
              {t('vr3.evidence.viewer.analysisFailed')}
            </p>
          ) : null}
          {/* Pages, plural, in page proportion: a viewer that cannot be
              scrolled does not read as a document. Three is enough for the
              scroll to exist and be understood; the count is not a claim
              about the file, which is why nothing counts them out loud. */}
          <div className="a3-docpages" aria-hidden="true">
            {[0, 1, 2].map((page) => (
              <div className="a3-docpage" key={page}>
                <span className="a3-docpage-head" />
                <span className="a3-docpage-line" />
                <span className="a3-docpage-line" />
                <span className="a3-docpage-line a3-docpage-line-short" />
                <span className="a3-docpage-block" />
                <span className="a3-docpage-line" />
                <span className="a3-docpage-line a3-docpage-line-short" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="a3-docsrc" data-state="loaded">
      {identity}
      {rowState === 'FAILED' ? (
        /* The file opens; the ANALYSIS of it did not. Both facts, separately. */
        <p className="a3-docsrc-reason">{t('vr3.evidence.viewer.analysisFailed')}</p>
      ) : null}
      <div className="a3-docsrc-frame">
        {/* `<object>` rather than `<iframe>`: its children are the native
            fallback when the browser will not render a PDF, so the offer of a
            way on is part of the element instead of a second state somebody
            has to detect. The fragment asks the viewer for the cited page. */}
        <object
          className="a3-docsrc-embed"
          type="application/pdf"
          data={`${asset.url}#page=${page}`}
          aria-label={t('vr3.evidence.viewer.embedLabel', {
            file: doc.file, page, pages: asset.pages,
          })}
        >
          <p className="a3-docsrc-reason">{t('vr3.evidence.viewer.noInlineViewer')}</p>
        </object>
      </div>
    </div>
  )
}

/* ───────────────── the four evidence groups (requirement 7) ──────────── */

/**
 * What the analysis understood, in four groups a person can scan.
 *
 * This replaces a disclosed column that listed four metrics per building and
 * ended with the sentence «every value opens its source document» — printed
 * beside a filename in a `<span>`, with no route anywhere. The audit's
 * finding was not that the column was ugly; it was that the page emphasised
 * AGGREGATE COUNTS and gave the reader nothing that explains the KG 300 and
 * KG 400 decisions waiting downstream.
 *
 * Four properties are structural, not stylistic:
 *
 * 1. **Two to four items per group, then disclosure.** The head is the
 *    group's `primary` items, capped in `evidenceGroupView`, so a group that
 *    grew cannot quietly become a register again. `Alle N anzeigen` opens the
 *    REST inside the group — it never replaces the page.
 * 2. **Every item carries its own authority AND its own state.** They are two
 *    axes: a confirmed value that newer evidence contradicts is not an
 *    ordinary source-evidenced one, and the canonical `AuthorityTrace` shows
 *    the difference because the model keeps the fields apart.
 * 3. **A citation is addressable.** The source control opens the document at
 *    the cited page and anchor, through the URL, so it survives a reload and
 *    Back undoes it. That is what makes the sentence the product already
 *    printed true.
 * 4. **Counts reconcile.** The band states `evidenceCounts().total` and each
 *    heading states `visible / total`; the four group totals sum to it by
 *    construction, and `reconcileEvidenceCounts` proves it.
 */
/**
 * WHICH CITATION IS OPEN, held by the surface rather than by the row.
 *
 * The document used to open as a modal drawer over the page. It is a PANEL
 * on the page now: it takes half the workspace and the evidence columns give
 * way to it, so the claim and its source are read side by side instead of
 * one covering the other. That only works if the open citation is known
 * where the two-column split is drawn — one row cannot push its siblings.
 *
 * A context rather than props threaded through two components: the rows are
 * nested inside groups, and passing a setter down every level would make the
 * intermediate component know about a concern that is not its own.
 */
type SourceRequest = {
  item: FixtureEvidenceItem
  documentId: string
  anchorId: string | null
  /** Focus returns here on close — the citation the reader came from. */
  trigger: RefObject<HTMLButtonElement>
}

const EvidenceSourceContext = createContext<{
  openItemId: string | null
  open: (request: SourceRequest) => void
}>({ openItemId: null, open: () => {} })

function EvidenceGroups({ project: fixture, lead, toolbar, filter }: {
  project: FixtureProject
  /** The filter control, rendered under the heading when the surface has one. */
  toolbar?: ReactNode
  /** `undefined` — kein Filter auf dieser Fläche (v1–v3). */
  filter?: ChecklistFilter
  /**
   * A panel that stands FIRST in the same grid as the four evidence groups.
   * A slot rather than a fixed section, because the checklist is one list
   * and what may join it is decided by the composition above, not here.
   */
  lead?: ReactNode
}) {
  const s = useStore()
  const t = useT()
  const headingId = useId()
  /* Confirmations made in this session are a PROJECTION over the analysis
     output, applied once here so every count, group and row downstream
     reads the same evidence — never per row, which is how two surfaces
     start disagreeing about the same value. */
  const analysis = s.projectAnalyses[fixture.id]
  const project = withEvidenceConfirmations(
    fixture,
    analysis?.evidenceConfirmations ?? {},
    analysis?.evidenceOverrides ?? {},
  )
  const counts = evidenceCounts(project)
  /* What THIS session settled — the rows that must not move away from the
     reader who just settled them. */
  const settledHere = useMemo(() => new Set([
    ...Object.keys(analysis?.evidenceConfirmations ?? {}),
    ...Object.keys(analysis?.evidenceOverrides ?? {}),
  ]), [analysis?.evidenceConfirmations, analysis?.evidenceOverrides])
  const [request, setRequest] = useState<SourceRequest | null>(null)
  const sourceDoc = request
    ? project.documents.find((doc) => doc.id === request.documentId) ?? null
    : null
  const open = request !== null && sourceDoc !== null

  /** Esc closes the panel and hands focus back — rule 22, panel or not. */
  const close = useCallback(() => {
    const trigger = request?.trigger.current
    setRequest(null)
    trigger?.focus()
  }, [request])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const context = useMemo(
    () => ({ openItemId: open ? request!.item.id : null, open: setRequest }),
    [open, request],
  )

  return (
    <EvidenceSourceContext.Provider value={context}>
      <div className="a3-evsplit" data-open={open ? 'true' : undefined}>
        <section className="a3-evgroups" aria-labelledby={headingId}>
          <div className="a3-evgroups-head">
            <h2 id={headingId} className="a3-evgroups-title">
              {t('vr3.evidence.title')}
            </h2>
            <p className="a3-evgroups-lede">
              {t('vr3.evidence.lede', { count: counts.total })}
            </p>
          </div>
          {toolbar}
          <div className="a3-evgroups-grid">
            {lead}
            {/* Ein Filter, der nur Entscheidungen zeigt, lässt die vier
                Gruppen fort — nicht leer, sondern fort: eine leere Gruppe
                behauptet, dieser Art sei nichts gefunden worden, und das
                wäre eine Aussage über die Quellen statt über den Filter. */}
            {filter === 'conflict' || filter === 'question'
              ? null
              : EVIDENCE_GROUPS.map((group) => (
                <EvidenceGroupPanel
                  key={group}
                  project={project}
                  group={group}
                  settledHere={settledHere}
                  filter={filter}
                />
              ))}
          </div>
        </section>
        {open ? (
          <>
            {/* The panel stands still while the reader scrolls, so it leaves
                the flow — and this empty cell holds the half of the section
                it occupies, which is what keeps the evidence column narrow
                instead of sliding back under it. */}
            <div className="a3-docpanel-slot" aria-hidden="true" />
            <EvidenceSourcePanel
              project={project}
              request={request!}
              doc={sourceDoc!}
              onClose={close}
            />
          </>
        ) : null}
      </div>
    </EvidenceSourceContext.Provider>
  )
}

/**
 * The document, beside the claim it evidences.
 *
 * Not a modal: the page behind it stays live and readable, which is the
 * point of moving it out of a dialog. It keeps the two things a dialog gave
 * it for free and a panel has to provide itself — Esc closes it, and focus
 * returns to the citation that opened it.
 */
function EvidenceSourcePanel({
  project, request, doc, onClose,
}: {
  project: FixtureProject
  request: SourceRequest
  doc: FixtureDocument
  onClose: () => void
}) {
  const s = useStore()
  const t = useT()
  const titleId = useId()
  const analysis = s.projectAnalyses[project.id]
  const rowState: DocumentRowState = analysis
    ? documentDisplayState(
      analysis, doc.id, analysisWorkspaceState(project, analysis),
    ) as DocumentRowState
    : 'READY'

  return (
    <aside className="a3-docpanel" aria-labelledby={titleId}>
      <div className="a3-docpanel-head">
        <h3 id={titleId} className="a3-docpanel-title">{doc.file}</h3>
        {/* A glyph, not a word: «Close» beside a filename is the one control
            here whose meaning a cross carries fully, and the label wrapped to
            two lines at every panel width. The accessible name stays the
            word. Drawn rather than typed, because the head needs a larger,
            thinner cross than Visuelt's own «×». */}
        <Button
          variant="ghost"
          className="a3-docdrawer-close"
          aria-label={t('vr3.evidence.viewer.close')}
          onClick={onClose}
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4 L20 20 M20 4 L4 20"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"
            />
          </svg>
        </Button>
      </div>
      <DocumentSourceViewer
        doc={doc}
        rowState={rowState}
        citedAnchorId={request.anchorId}
      />
      {/* Confirmation lives INSIDE the document, at the end of the reading:
          the value, its page and the clause are all on screen when the act
          is offered, which is the difference between vouching for a number
          and clicking a badge. Beside it, the second honest answer to the
          same question — «the document says 2.120 and the client told me
          2.180» — because a reader who can only agree will agree. */}
      {isConfirmable(request.item) ? (
        <EvidenceDecision item={request.item} onDone={onClose} />
      ) : null}
    </aside>
  )
}

/**
 * Agree with the document, or say what is true instead.
 *
 * ONE act at a time. Pressing «Eigener Wert» REPLACES the confirm button
 * with the manual form rather than adding a second live control beside it:
 * two primaries on the same row, one of which silently ignores the field the
 * reader just typed into, is the state confusion this shape exists to avoid.
 * Cancel puts the original decision back, unchanged and unrecorded.
 *
 * The apply button is inert while the field is empty and SAYS why (rule 12):
 * a disabled control that explains nothing is the defect the rule names.
 */
function EvidenceDecision({
  item, onDone,
}: {
  item: FixtureEvidenceItem
  onDone: () => void
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const fieldId = useId()
  const [entering, setEntering] = useState(false)
  const [draft, setDraft] = useState('')
  const [missing, setMissing] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)

  /* Focus follows the act: the form is opened to be typed into. */
  useEffect(() => {
    if (entering) fieldRef.current?.focus()
  }, [entering])

  if (!entering) {
    return (
      <div className="a3-docdrawer-confirm">
        <div className="a3-docdrawer-actions">
          <Button
            variant="primary"
            onClick={() => {
              s.confirmProjectEvidence(item.id)
              onDone()
            }}
          >
            {t('vr3.evidence.viewer.confirmValue')}
          </Button>
          <Button variant="secondary" onClick={() => setEntering(true)}>
            {t('vr3.evidence.viewer.customValue')}
          </Button>
        </div>
      </div>
    )
  }

  const empty = draft.trim() === ''
  const hintId = `${fieldId}-hint`
  return (
    <div className="a3-docdrawer-confirm">
      {/* The canonical field shape (`.a3-input > input + .a3-unit`), not a
          FormField: FormField clones id and `aria-describedby` onto its ONE
          child, and the child here is the input's wrapper — the label then
          pointed at a span, so clicking it focused nothing and two elements
          carried the same id. The label owns the input directly instead. */}
      <div className="a3-docdrawer-field">
        <label className="a3-docdrawer-field-label" htmlFor={fieldId}>
          {t('vr3.evidence.viewer.customValueLabel', { label: t(item.labelKey) })}
        </label>
        <span className="a3-input">
          <input
            ref={fieldRef}
            id={fieldId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            aria-describedby={item.value ? hintId : undefined}
            aria-invalid={missing || undefined}
            onChange={(event) => { setDraft(event.target.value); setMissing(false) }}
          />
          {item.unit ? <span className="a3-unit">{item.unit}</span> : null}
        </span>
        {missing ? (
          <p className="a3-docdrawer-field-error" role="alert">
            {t('vr3.evidence.viewer.customValueEmpty')}
          </p>
        ) : null}
        {item.value ? (
          <p id={hintId} className="a3-docdrawer-field-hint">
            {t('vr3.evidence.viewer.customValueHint', {
              value: `${num(item.value, Number(item.value) % 1 === 0 ? 0 : 2)}${
                item.unit ? `${NNBSP}${item.unit}` : ''}`,
            })}
          </p>
        ) : null}
      </div>
      <div className="a3-docdrawer-actions">
        {/* Live, and it answers when pressed — see the row editor for why a
            standing disabled reason is not the right shape here. */}
        <Button
          variant="primary"
          onClick={() => {
            if (empty) { setMissing(true); fieldRef.current?.focus(); return }
            s.overrideProjectEvidence(item.id, draft)
            onDone()
          }}
        >
          {t('vr3.evidence.viewer.customValueConfirm')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => { setEntering(false); setDraft('') }}
        >
          {t('vr3.evidence.viewer.cancel')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Edit one value in place: keep the document's, or state your own.
 *
 * TWO named choices, not a field that quietly replaces a number. Which one
 * is selected on open is the value that is in force — a manual value
 * preselects «Eigener Wert», everything else preselects the document — so
 * the control STATES the current situation before it offers to change it,
 * and closing it changes nothing.
 *
 * The same shape as the decision in the document panel (radio → field →
 * apply), for the same reason: only one act is live at a time, and the apply
 * button is inert while the chosen act has nothing to apply, saying why.
 */
function EvidenceRowEditor({
  id, item, onDone,
}: {
  id: string
  item: FixtureEvidenceItem
  onDone: () => void
}) {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const fieldId = useId()
  const overridden = item.authority === 'overridden'
  const [mode, setMode] = useState<'document' | 'custom'>(
    overridden ? 'custom' : 'document',
  )
  const [draft, setDraft] = useState(overridden ? item.value ?? '' : '')
  /** Set only by a press on an empty field — never on arrival. */
  const [missing, setMissing] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'custom') fieldRef.current?.focus()
  }, [mode])

  const shown = (value: string | null): string => {
    if (value === null) return ''
    const n = Number(value)
    const text = Number.isFinite(n) ? num(value, n % 1 === 0 ? 0 : 2) : value
    return item.unit ? `${text}${NNBSP}${item.unit}` : text
  }
  /* The document's own value is what a manual entry DISPLACED, if any. */
  const documentValue = overridden ? item.previousValue : item.value
  const empty = draft.trim() === ''

  return (
    <div id={id} className="a3-evitem-editor">
      <SegmentedControl
        legend={t('vr3.evidence.edit.legend', { label: t(item.labelKey) })}
        legendHidden
        size="compact"
        value={mode}
        onChange={(next) => setMode(next)}
        options={[
          {
            value: 'document' as const,
            label: documentValue
              ? t('vr3.evidence.edit.fromDocumentValue', { value: shown(documentValue) })
              : t('vr3.evidence.edit.fromDocument'),
          },
          { value: 'custom' as const, label: t('vr3.evidence.edit.custom') },
        ]}
      />
      {mode === 'custom' ? (
        <div className="a3-docdrawer-field">
          <label className="a3-docdrawer-field-label" htmlFor={fieldId}>
            {t('vr3.evidence.viewer.customValueLabel', { label: t(item.labelKey) })}
          </label>
          <span className="a3-input">
            <input
              ref={fieldRef}
              id={fieldId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={draft}
              aria-invalid={missing || undefined}
              onChange={(event) => { setDraft(event.target.value); setMissing(false) }}
            />
            {item.unit ? <span className="a3-unit">{item.unit}</span> : null}
          </span>
          {missing ? (
            <p className="a3-docdrawer-field-error" role="alert">
              {t('vr3.evidence.viewer.customValueEmpty')}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="a3-docdrawer-actions">
        {/* NOT disabled while the field is empty.
            A permanently disabled button carries a permanently visible
            reason (rule 12), and a standing «enter a value first» under a
            control nobody has pressed yet is an instruction, not an
            explanation. The button stays live and answers at the moment it
            is pressed — which is the moment the reader asked the question. */}
        <Button
          variant="primary"
          onClick={() => {
            if (mode === 'custom' && empty) { setMissing(true); fieldRef.current?.focus(); return }
            if (mode === 'custom') s.overrideProjectEvidence(item.id, draft)
            else if (overridden) s.clearProjectEvidenceOverride(item.id)
            else if (isConfirmable(item)) s.confirmProjectEvidence(item.id)
            onDone()
          }}
        >
          {t('vr3.evidence.edit.apply')}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {t('vr3.evidence.viewer.cancel')}
        </Button>
      </div>
    </div>
  )
}

function EvidenceGroupPanel({
  project, group, settledHere, filter,
}: {
  project: FixtureProject
  group: EvidenceGroup
  settledHere: ReadonlySet<string>
  filter?: ChecklistFilter
}) {
  const t = useT()
  const headingId = useId()
  const listId = useId()
  /* Open by default: the reader came here to read. Closing is for putting a
     finished group out of the way, never a gate in front of the first look. */
  const [open, setOpen] = useState(true)
  const full = evidenceGroupView(project, group, settledHere)
  const items = filter === 'derived'
    ? full.items.filter((item) => item.authority === 'derived')
    : full.items
  const view = { ...full, items, total: items.length }
  /* Eine Gruppe, in der der Filter nichts übrig lässt, verschwindet — siehe
     die Begründung eine Ebene höher. */
  if (filter === 'derived' && items.length === 0) return null

  return (
    <section className="a3-evgroup" aria-labelledby={headingId}>
      {/* The GROUP is what opens and closes, and its heading is the control.
          What replaced: four rows shown and the rest behind «show all 6
          more», which meant a reader looking for one value had to open every
          group to learn whether it was in there, and a value settled here
          jumped out of sight at the moment it was settled. */}
      <h3 className="a3-evgroup-head">
        <button
          type="button"
          id={headingId}
          className="a3-evgroup-toggle hit-target"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          {/* A drawn chevron, not a typographic «▾»: the character renders
              at a fraction of its em box in Visuelt (5.7 × 12 px measured)
              and reads as dust beside a 16 px heading. One shape, rotated,
              so open and closed cannot drift apart. */}
          <svg
            className="a3-evgroup-disclosure-glyph"
            data-open={open ? 'true' : undefined}
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M5 3.5 L10.5 8 L5 12.5"
              fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square"
            />
          </svg>
          <span className="a3-evgroup-title">{t(evidenceGroupKey(group))}</span>
          <span className="a3-evgroup-count numeric">
            {t('vr3.evidence.groupTotal', { total: view.total })}
          </span>
        </button>
      </h3>
      {view.attentionCount > 0 ? (
        <SemanticStatus
          tone="attention"
          size="compact"
          label={t('vr3.evidence.groupAttention', { count: view.attentionCount })}
        />
      ) : null}

      {/* An empty group states that nothing of this kind was FOUND. It does
          not disappear and it does not fabricate a default: a single
          residential building with a brief and eight drawings genuinely has
          no building-services requirement, and «absence is not a default
          requirement» is the rule that makes that sentence necessary. */}
      {view.total === 0 ? (
        <p className="a3-evgroup-empty" hidden={!open}>{t('vr3.evidence.groupEmpty')}</p>
      ) : (
        /* Stays in the DOM under `aria-controls`; `hidden` is the state,
           never a `display:none` set from a style. */
        <dl id={listId} className="a3-evlist" hidden={!open}>
          {view.items.map((item) => (
            <EvidenceItemRow key={item.id} project={project} item={item} />
          ))}
        </dl>
      )}
    </section>
  )
}

/**
 * One evidence item: what it says, what it applies to, where it came from,
 * how much weight it carries, and who reads it next.
 *
 * The value and its authority are ONE object (`AuthorityTrace`'s own
 * contract), so they cannot drift into two independently rendered things.
 * STATE travels in the `freshness` slot, which is how the envelope says
 * "needs review" without losing where the value came from.
 */
function EvidenceItemRow({
  project, item,
}: {
  project: FixtureProject
  item: FixtureEvidenceItem
}) {
  const t = useT()
  const num = useLocalNumber()
  const language = useStore().uiLanguage as 'de' | 'en'
  const source = evidenceSource(project, item)
  const trace = evidenceAuthorityTrace(item)
  const attention = needsAttention(item.state)

  /* The scope line under every label is gone: in a single-building project
     it repeated the project's own name on every row, and the scope a value
     belongs to is already stated by the chapter the reader is in. It returns
     the day a row can belong to a scope the surface does not already name. */

  /**
   * Follow the citation WITHOUT leaving the reading. The source used to be
   * a stage change: the reader lost the group they were reading to look at
   * one page, and coming back meant finding their place again. The document
   * now opens in the panel beside this column — the surface owns it, because
   * opening it makes the evidence columns give way.
   */
  const citationButton = useRef<HTMLButtonElement>(null)
  const verifyButton = useRef<HTMLButtonElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const editorId = useId()
  const [editing, setEditing] = useState(false)
  const sourcePanel = useContext(EvidenceSourceContext)
  const sourceOpen = sourcePanel.openItemId === item.id
  /* Focus returns to the control that was pressed, so the reader lands back
     where they left — which is why the trigger is an argument here and not
     one ref the row assumes. */
  const openSource = (trigger: RefObject<HTMLButtonElement>) => {
    if (!source) return
    sourcePanel.open({
      item,
      documentId: source.documentId,
      anchorId: item.sourceAnchorId,
      trigger,
    })
  }

  return (
    <div className="a3-evitem" data-attention={attention || undefined}>
      <dt className="a3-evitem-label">
        {t(item.labelKey)}
      </dt>
      <dd className="a3-evitem-body">
        <AuthorityTrace
          layout="stacked"
          authority={trace.authority}
          evidence={source
            ? { label: source.file, version: source.version, issuedAt: source.issuedAt }
            : undefined}
          onOpenEvidence={source ? () => openSource(citationButton) : undefined}
          openEvidenceLabel={source
            ? t('vr3.evidence.openSourceOn', {
              file: source.file, page: source.page, label: t(item.labelKey),
            })
            : undefined}
          evidenceRef={citationButton}
          evidenceOpen={sourceOpen}
          /* WHO signed for the value is shown for values a person WROTE,
             not for every value a person waved through. Confirming what the
             document already says changes nothing about the number, and a
             name plus a timestamp under every confirmed row buried the two
             rows where a human quantity actually differs from the document.
             A replaced value carries its attribution in the override line
             below; this line covers the manual value that replaced nothing. */
          confirmation={item.authority === 'overridden' && !item.previousValue
            && item.confirmedBy && item.confirmedAt
            ? { actor: item.confirmedBy, at: localDateTime(item.confirmedAt, language) }
            : undefined}
          override={item.authority === 'overridden' && item.previousValue && item.reasonKey
            ? {
              /* The displaced value in the reader's own number format:
                 a raw decimal string («2740.00») beside a formatted one is
                 the same quantity written two ways (rule 7). */
              previous: Number.isFinite(Number(item.previousValue))
                ? `${num(item.previousValue, Number(item.previousValue) % 1 === 0 ? 0 : 2)}${
                  item.unit ? `${NNBSP}${item.unit}` : ''}`
                : item.previousValue,
              reason: t(item.reasonKey),
              actor: item.confirmedBy ?? '',
              at: item.confirmedAt ? localDateTime(item.confirmedAt, language) : '',
            }
            : undefined}
          freshness={trace.stale
            ? {
              staleReason: item.reasonKey
                ? t(item.reasonKey)
                : t(`vr3.evidence.state.${item.state}`),
            }
            : undefined}
        >
          {item.value !== null ? (
            <>
              <span className="numeric">{num(item.value)}</span>
              {item.unit ? <span className="a3-mro-unit">{item.unit}</span> : null}
            </>
          ) : (
            <span className="a3-evitem-requirement">{t(item.requirementKey!)}</span>
          )}
        </AuthorityTrace>

        {/* A contested value is shown BESIDE the value it contests, never
            instead of it: newer evidence marks confirmed truth for review, it
            does not overwrite it (M-1 / D-08). */}
        {/* EIN Wert im Zustand `unknown` sagt das auch.
            Die Spur trägt die HERKUNFT («aus Quelle belegt») und die ist
            richtig — das Dokument existiert und ist zitiert. Offen ist die
            ANGABE, und dafür hatte die Zeile bisher nur den Strich am Rand:
            zwei Ebenen, zwei Aussagen, ein Wert. Nicht über den
            `freshness`-Slot, denn der erklärt die Angabe zu `stale`, und
            «veraltet» ist etwas anderes als «nicht ermittelt». */}
        {item.state === 'unknown' ? (
          <p className="a3-evitem-conflict">
            {item.reasonKey ? t(item.reasonKey) : t('vr3.evidence.state.unknown')}
          </p>
        ) : null}

        {item.state === 'conflict' && item.previousValue ? (
          <p className="a3-evitem-conflict">
            {t('vr3.evidence.conflictCandidate', { value: num(item.previousValue) })}
          </p>
        ) : null}

        {/* ONE route to the document, and then the ACT — never two names
            for the same click. «Quelle öffnen» sat beside «Im Dokument
            prüfen» opening the same file, differing in wording and in
            nothing else. Opening now belongs to the CITATION itself (the
            file name above), which is what a reader points at anyway, and
            what remains here is the decision: it appears only where there
            is something left to settle, and it goes through the document,
            so nothing is confirmed from a label nobody opened. */}
        <div className="a3-evitem-meta">
          {source && isConfirmable(item) ? (
            <button
              ref={verifyButton}
              type="button"
              className="a3-evitem-verify hit-target"
              onClick={() => openSource(verifyButton)}
              aria-expanded={sourceOpen}
              aria-label={t('vr3.evidence.checkInSourceOn', {
                label: t(item.labelKey), file: source.file,
              })}
            >
              {t('vr3.evidence.checkInSource')}
            </button>
          ) : null}
          {/* EVERY value can be edited, not only the ones still open.
              A value is confirmed on Monday and the client re-planned on
              Tuesday; a surface that only lets a person agree with the
              document has no answer for that, and the user's answer today is
              to leave the tool. */}
          <button
            ref={editButton}
            type="button"
            className="a3-evitem-edit hit-target"
            aria-expanded={editing}
            aria-controls={editorId}
            onClick={() => setEditing((v) => !v)}
          >
            {t('vr3.evidence.edit')}
          </button>
          {source ? null : (
            /* A value whose source has left the project keeps the value and
               loses the citation. Saying so is the stronger claim. */
            <p className="a3-evitem-nosource">{t('vr3.evidence.sourceMissing')}</p>
          )}
        </div>
        {editing ? (
          <EvidenceRowEditor
            id={editorId}
            item={item}
            onDone={() => {
              setEditing(false)
              editButton.current?.focus()
            }}
          />
        ) : null}

      </dd>
    </div>
  )
}

/* ─────────────────────── compact project context ─────────────────────── */

