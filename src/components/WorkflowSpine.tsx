import { CONFIGURATOR_STEP } from '../state/chapters'
import {
  canBeginConfiguration,
  clientModeAvailableForOption,
  clientModeLockReasonFor,
  finalValidationAvailableFor,
  kgChapterProgressFor,
  kgConfigurationCompleteFor,
  kgScopeDecisionsComplete,
  kgScopeStatus,
  optionSaveStageFor,
  responsibilityFor,
  useStore,
} from '../state/store'
import { KG_SCOPE_GROUPS, type KgScopeGroup } from '../engine/kgConfiguration'
import { buildingScopeStale } from '../state/optionBuildingScope'
import {
  KG_STEP_ID,
  destinationOfNav,
  optionNav,
  type OptionDestination,
  type OptionStageId,
  type OptionStepId,
} from '../state/optionLifecycle'
import { readiness, type ProjectAnalysis, type FixtureProject } from '../state/projectAnalysis'
import { useT } from '../i18n'
import {
  WorkflowNavigator,
  type WorkflowStage,
  type WorkflowState,
  type WorkflowSubStep,
} from '../design-system/WorkflowNavigator'

/**
 * TWO WORKSPACES, ONE SEAM — the two rails, and the rule that keeps them
 * honest (accepted 2026-09-06 Project → Option → Configurator IA audit).
 *
 * > A stage may only appear in the rail of the tier that owns its data.
 *
 * What this replaces is not a layout, it is a contradiction. The product
 * carried two structurally different rails that NEVER coexisted: a
 * horizontal six-stage `WorkflowNavigator` at project level and a vertical
 * thirteen-step spine at Option level, with different orientations, different
 * numbering and different status vocabularies. Both narrated the whole
 * journey, so neither was true:
 *
 * - the project rail claimed `Kalkulieren`, `Prüfen`, `Präsentieren` and
 *   nested `Leistungsabgrenzung`, all hardcoded `'upcoming'` — four labels
 *   that could never change, on a tier that owns none of that data;
 * - the Option rail claimed `Dokumente`, `Projektverständnis` and
 *   `Option anlegen`, the last one hardcoded `done` with `backToOpportunity`
 *   behind it: the only escape from the Option workspace, disguised as a
 *   completed workflow step.
 *
 * Now three project-scoped stages live here and four Option-scoped stages
 * live there, ONE rail is mounted at a time, and every stage in both can
 * actually become `current`. There is no hardcoded state left in either.
 *
 * Both rails render the SAME released canonical `WorkflowNavigator` with the
 * same four-value vocabulary and the same contract that nested steps appear
 * only inside the current stage. No new navigation capability was created,
 * and the flat `WorkflowStepper` spine is retired as the Option rail — it was
 * 2.21 viewports tall at 1440 and 2.63 at 1280, which is the other half of
 * why the map disappeared exactly where it was needed.
 */

/* ─────────────────────── the PROJECT workspace rail ───────────────────── */

/**
 * Three stages: Dokumente · Projektverständnis · Optionen.
 *
 * Every prerequisite below is the predicate the released product already
 * read. `Optionen` is `locked` exactly while `canCreateOptions()` is false
 * and states the readiness gate's OWN reason — no new gate, no second
 * opinion about whether an Option may exist.
 *
 * `Optionen` is never `done`: a collection is not a step you finish. It is
 * `current` while the user is in it (including on the comparison destination
 * it leads to) and `upcoming` before the first Option exists.
 */
export function ProjectWorkflowNavigator({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const state = readiness(project, analysis)
  const stage = s.projectStage
  const analysed = analysis.jobState === 'COMPLETE'
  const ready = state.state === 'PROJECT_READY_FOR_OPTION'
  const canOpenOptions = s.canCreateOptions() || s.options.length > 0

  const stages: WorkflowStage[] = [
    {
      id: 'documents',
      label: t('vr3.spine.step.documents'),
      state: stage === 'documents' ? 'current' : analysed ? 'done' : 'available',
      onSelect: () => s.setProjectStage('documents'),
    },
    {
      id: 'understanding',
      label: t('vr3.spine.step.understanding'),
      state: stage === 'understanding'
        ? 'current'
        : !analysed
          ? 'locked'
          : ready ? 'done' : 'available',
      reason: analysed ? undefined : t('vr3.spine.reason.needsAnalysis'),
      onSelect: analysed ? () => s.setProjectStage('understanding') : undefined,
    },
    {
      id: 'options',
      label: t('vr3.options.stage'),
      // The comparison destination belongs to the collection, so standing on
      // it is still standing in Optionen — the rail must not go blank because
      // the user followed a link the collection itself offered.
      state: stage === 'options' || stage === 'comparison'
        ? 'current'
        : canOpenOptions ? 'available' : 'locked',
      /**
       * The readiness gate's OWN prerequisite, in the rail's own register.
       *
       * No second gate and no second opinion — the branch below reads the
       * same `readiness()` the CTA reads. What it does NOT do is repeat the
       * CTA's full sentence: `Button` already renders `disabledReason`
       * beneath the control and associates it with `aria-describedby`, and
       * printing the identical sentence in a caption two bands above it is
       * the duplicated label rule 9 forbids (and the DOM suite caught).
       */
      reason: canOpenOptions
        ? undefined
        : !analysed
          ? t('vr3.spine.reason.needsAnalysis')
          : state.unresolvedBlockingConflicts > 0
            ? t('vr3.readiness.prereq.conflictsDetail', {
              count: state.unresolvedBlockingConflicts,
            })
            : t('vr3.spine.reason.needsReadiness'),
      onSelect: canOpenOptions ? () => s.setProjectStage('options') : undefined,
      // Deliberately no nested steps: the Options collection is a list of
      // objects, not a sequence of steps, and its members are the rows.
    },
  ]

  return <WorkflowNavigator stages={stages} ariaLabel={t('vr3.journey.label')} />
}

/* ──────────────────────── the OPTION workspace rail ───────────────────── */

/**
 * Four stages: Konfigurieren · Kalkulieren · Prüfen · Präsentieren.
 *
 * All four are phases of ONE Option's lifecycle, and the proof is in the
 * data: `FinalValidation` reads `latestSavedOptionVersion(s, activeOptionId)`,
 * every KG chapter reads the active `OptionConfig`, and `savedOptionVersions`
 * is keyed by Option id. They were rendered at project level, where none of
 * that exists, which is why all three were frozen at `'upcoming'`.
 *
 * `Präsentieren` is the one that was also a category error: it is not a view
 * but a MODE (`mode: 'praesentation'`, which replaces the whole shell). It is
 * a stage here whose surface's ACTION enters that mode; `PresentationShell`,
 * the `mode` field and `setViewedOption` are untouched.
 */
export function OptionWorkflowNavigator() {
  const s = useStore()
  const t = useT()
  const here = destinationOfNav(s.pipelineView, s.openConfiguratorStep)
  const gateOpen = canBeginConfiguration(s)
  const scopeStale = buildingScopeStale(s)
  const scopeStatus = kgScopeStatus(s)
  const boundariesConfirmed = scopeStatus === 'confirmed'
  /**
   * THE gate every cost group sits behind: six EXPLICIT decisions.
   *
   * Not "six decisions and a confirmation". The state machine's transition
   * is `six of six decided → first included KG available`, and the
   * confirmation exists to drive the "changed since you confirmed it"
   * notice, not to gate the work a second time (`kgScopeDecisionsComplete`,
   * store.ts). Reading the confirmation here would have added the extra
   * unmodelled gate VR3-03 explicitly refused.
   */
  const decisionsComplete = kgScopeDecisionsComplete(s)
  const kgComplete = kgConfigurationCompleteFor(s)
  /**
   * VR3-TGA-UX-00 — the responsibility step's state is DATA-DERIVED where the
   * data speaks and visit-based where it does not: a matrix with an
   * unresolved medium is never `done`, a settled one is done once it has
   * been looked at. It gates nothing — the schedule keeps its own released
   * prerequisite (`kgComplete`) and this step is not part of it.
   */
  const responsibility = responsibilityFor(s)
  const responsibilityVisited = s.visitedConfiguratorSteps
    .includes(CONFIGURATOR_STEP.RESPONSIBILITY)
  const responsibilitySettled = (responsibility?.unresolved.length ?? 0) === 0
  const scheduleConfirmed = s.scheduleConfirmation !== null
  const reviewConfirmed = s.reviewConfirmation !== null
  const saveStage = optionSaveStageFor(s)
  const saved = saveStage === 'SAVED'
  /**
   * `Prüfen` opens exactly when the released review stage says it does.
   *
   * NOT `configurationComplete()`: that predicate is the legacy whole-option
   * confirm CTA the Export gate reads, and the schedule/review flow never
   * sets it — reading it here would have locked `Prüfen` for an Option whose
   * review was already confirmed and saved. `finalValidationAvailableFor` is
   * the stage's own released predicate, unchanged.
   */
  const reviewAvailable = finalValidationAvailableFor(s)
  const clientAvailable = clientModeAvailableForOption(s, s.activeOptionId)
  const clientLock = clientModeLockReasonFor(s, s.activeOptionId)

  const go = (destination: OptionDestination) => () => {
    const nav = optionNav(destination)
    s.setPipelineView(nav.view)
    if (nav.step) s.openConfiguratorStepAt(nav.step)
  }

  /**
   * One nested step.
   *
   * A LOCKED STEP STAYS REACHABLE unless `dead` says otherwise — the T-016
   * principle this product already applied through the retired spine's
   * `blockedRoute`: a locked stage is a PLACE that explains itself, and it
   * lands on its own gate rather than on its contents. Disabled navigation
   * IS NOT an explanation, and the surfaces behind these steps (the
   * Konfigurator gate, the schedule, the review) each render their own lock
   * with the prerequisite and the route that resolves it.
   *
   * The exception is a cost group: its lock has no gate surface of its own
   * — the reason lives in the rail — so it is stated and not offered.
   */
  const step = (
    stage: OptionStageId,
    id: OptionStepId,
    label: string,
    stepState: WorkflowState,
    reason?: string,
    dead = false,
  ): WorkflowSubStep => ({
    id,
    label,
    state: here.step === id ? 'current' : stepState,
    // `reason` belongs to the three states that must name their cause, and
    // to no other: passing it on a `done` step would print a sentence about
    // a prerequisite that has been met.
    reason: stepState === 'locked' || stepState === 'warning' || stepState === 'stale'
      ? reason
      : undefined,
    onSelect: stepState === 'locked' && dead ? undefined : go({ stage, step: id }),
  })

  const kgStep = (group: KgScopeGroup): WorkflowSubStep => {
    const decision = s.kgConfig?.scope[group] ?? 'undecided'
    const progress = kgChapterProgressFor(s, group)
    const excluded = decision === 'excluded'
    /**
     * ONE state, chosen once. The released version computed `done` here and
     * then contradicted it with two side-channels beside it — `outOfScope`
     * for an excluded group it had just called `done`, and `attention` for
     * an invalid one — which is why the progression had to reassemble the
     * truth in a three-branch ternary at render time.
     *
     * `outOfScope` and `warning` are now what they always were: STATES. An
     * excluded group is out of scope, not done — a tick there was the
     * fabricated completion the navigation contract (D-016) forbids, and it
     * was only ever readable because the boolean overrode the glyph.
     */
    const stepState: WorkflowState = !decisionsComplete
      ? 'locked'
      : excluded
        ? 'outOfScope'
        : progress?.state === 'invalid'
          ? 'warning'
          : progress?.state === 'complete'
            ? 'done'
            : 'available'
    return step(
      'kalkulieren', KG_STEP_ID[group], `KG ${group.slice(3)}`, stepState,
      stepState === 'warning'
        ? t('vr3.kg.page.blockedInvalid')
        : t('vr3.spine.reason.needsScopeDecisions'),
      // A locked cost group has no gate surface of its own: the reason lives
      // in the rail, so it is stated and not offered.
      true,
    )
  }

  const stages: WorkflowStage[] = [
    {
      id: 'konfigurieren',
      label: t('vr3.journey.stage.configure'),
      state: here.stage === 'konfigurieren'
        ? 'current'
        : gateOpen && boundariesConfirmed && !scopeStale ? 'done' : 'available',
      onSelect: go({ stage: 'konfigurieren', step: 'gebaeude-umfang' }),
      /**
       * B2 · requirement 15 — the SAME secondary navigator as Calculate.
       *
       * Configure and Validate used the released list band while Calculate
       * used the compact progression, so three stages of one workflow taught
       * three different secondary navigations. The progression is the one the
       * audit named preferred, and there is now one geometry, one keyboard
       * model and one state vocabulary across all three.
       */
      stepsPresentation: 'progression',
      steps: [
        {
          ...step(
            'konfigurieren', 'gebaeude-umfang', t('nav.buildingScope'),
            // A scope whose saved fingerprint no longer describes the
            // selection is STALE — it was settled and something moved under
            // it. A tick there would be the unqualified CONFIRMED the
            // interaction legend forbids, and `current` (what this said
            // before the state vocabulary could express staleness) claimed
            // the user was standing somewhere they were not.
            scopeStale ? 'stale' : gateOpen ? 'done' : 'available',
            t('vr3.scope.stale.scope'),
          ),
          shortLabel: t('vr3.progression.buildings'),
        },
        {
          ...step(
            'konfigurieren', 'leistungsabgrenzung', t('vr3.spine.step.scopeBoundaries'),
            !gateOpen
              ? 'locked'
              : scopeStatus === 'recheck'
                ? 'stale'
                : scopeStatus === 'confirmed' ? 'done' : 'available',
            !gateOpen
              ? t('vr3.spine.reason.needsBuildingScope')
              : t('vr3.kg.ledger.recheckReason'),
          ),
          shortLabel: t('vr3.progression.scopeDecisions'),
        },
      ],
    },
    {
      id: 'kalkulieren',
      label: t('vr3.journey.stage.calculate'),
      state: here.stage === 'kalkulieren'
        ? 'current'
        : kgComplete && scheduleConfirmed
          ? 'done'
          : gateOpen && decisionsComplete ? 'available' : 'locked',
      reason: !gateOpen
        ? t('vr3.spine.reason.needsBuildingScope')
        : decisionsComplete ? undefined : t('vr3.spine.reason.needsScopeDecisions'),
      onSelect: gateOpen && decisionsComplete
        ? go({ stage: 'kalkulieren', step: KG_STEP_ID.KG_200 })
        : undefined,
      /**
       * VR3-KG-UNIFY-00 — the eight calculation destinations are ONE ordered
       * sequence the user walks, so they render as the compact progression:
       * `KG 200 → … → KG 700 → Verantwortung → Terminplan`, contiguous at
       * 1440 and 1280. Same members, same routes, same completion truth as
       * before; only the drawing changed.
       */
      stepsPresentation: 'progression',
      steps: [
        ...KG_SCOPE_GROUPS.map(kgStep),
        {
          ...step(
            'kalkulieren', 'verantwortung', t('vr3.spine.step.responsibility'),
            !decisionsComplete
              ? 'locked'
              : responsibilityVisited && responsibilitySettled ? 'done' : 'available',
            t('vr3.spine.reason.needsScopeDecisions'),
          ),
          shortLabel: t('vr3.progression.responsibility'),
        },
        /**
         * B2 · requirement 16 — ALL COST DETAILS, inside Calculate.
         *
         * It was a destination of its own, which `destinationOfNav` could not
         * classify, so opening the complete cost explanation switched the
         * visible secondary navigation back to Configure — the reported IA
         * defect. It is a member of Calculate now: read-only calculation
         * evidence, after Responsibility and before Schedule, and Calculate
         * stays current while it is open.
         *
         * `available` and never `done`: an explanation is not a step you
         * finish. It is locked only while there is no calculation to explain.
         */
        {
          ...step(
            'kalkulieren', 'alle-kosten', t('vr3.spine.step.costDetails'),
            !decisionsComplete ? 'locked' : 'available',
            t('vr3.spine.reason.needsScopeDecisions'),
          ),
          shortLabel: t('vr3.progression.costDetails'),
        },
        {
          ...step(
            'kalkulieren', 'terminplan', t('vr3.spine.step.schedule'),
            !kgComplete ? 'locked' : scheduleConfirmed ? 'done' : 'available',
            t('vr3.kg.gate.scheduleReason'),
          ),
          shortLabel: t('vr3.progression.schedule'),
        },
      ],
    },
    {
      id: 'pruefen',
      label: t('vr3.journey.stage.validate'),
      state: here.stage === 'pruefen'
        ? 'current'
        : saved ? 'done' : reviewAvailable ? 'available' : 'locked',
      reason: reviewAvailable ? undefined : t('vr3.spine.reason.needsSchedule'),
      onSelect: reviewAvailable
        ? go({ stage: 'pruefen', step: 'finale-pruefung' })
        : undefined,
      // The same secondary navigator as Configure and Calculate (req 15).
      stepsPresentation: 'progression',
      steps: [
        {
          ...step(
            'pruefen', 'finale-pruefung', t('vr3.spine.step.finalValidation'),
            reviewConfirmed ? 'done' : 'available',
          ),
          shortLabel: t('vr3.progression.review'),
        },
        {
          ...step(
            'pruefen', 'speichern', t('vr3.journey.step.save'),
            saveStage === 'SAVED'
              ? 'done'
              : saveStage === 'FAILED'
                ? 'warning'
                : reviewConfirmed ? 'available' : 'locked',
            saveStage === 'FAILED'
              ? t('vr3.spine.reason.saveFailed')
              : t('vr3.spine.reason.needsReview'),
          ),
          shortLabel: t('vr3.progression.save'),
        },
      ],
    },
    {
      id: 'praesentieren',
      label: t('vr3.journey.stage.present'),
      state: here.stage === 'praesentieren'
        ? 'current'
        : clientAvailable ? 'available' : 'locked',
      reason: clientAvailable || clientLock === null
        ? undefined
        : t(`vr3.client.lock.${clientLock}`),
      // Reachable while LOCKED, on purpose — the T-016 principle this
      // product already applies to every other gated stage: a locked stage
      // is reachable so it can explain itself, and it lands on its own gate
      // rather than on its contents. The stage's own surface carries the
      // released mode switch with its ordered blocked reason.
      onSelect: go({ stage: 'praesentieren', step: null }),
      // No nested steps: entering the client projection is one act.
    },
  ]

  return <WorkflowNavigator stages={stages} ariaLabel={t('vr3.option.rail.label')} />
}
