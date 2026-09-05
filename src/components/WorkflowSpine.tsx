import { useEffect, useRef, useState } from 'react'
import {
  KG_CHAPTER_STEP,
  canBeginConfiguration,
  clientModeAvailableForOption,
  hasKgConfiguration,
  kgChapterProgressFor,
  kgConfigurationCompleteFor,
  kgDecidedScopeCount,
  kgScopeDecisionsComplete,
  optionReviewStageFor,
  optionSaveStageFor,
  optionScheduleStageFor,
  useStore,
} from '../state/store'
import { KG_SCOPE_GROUPS, type KgScopeGroup } from '../engine/kgConfiguration'
import { buildingScopeStage } from '../state/optionBuildingScope'
import { readiness, type ProjectAnalysis, type FixtureProject } from '../state/projectAnalysis'
import { useT } from '../i18n'
import { WorkflowStepper, type WorkflowStep } from '../design-system/WorkflowStepper'
import { WorkflowNavigator, type WorkflowStage } from '../design-system/WorkflowNavigator'
import { M06_UNLOCK_MS } from '../config/ui-policy'

/**
 * The canonical thirteen-step journey, computed once for both contexts.
 *
 * ONE JOURNEY, TWO CONTEXTS.
 *
 * The spine used to exist only at project level: entering an Option
 * replaced it with a four-item workspace nav, so the user's position in a
 * thirteen-stage journey silently became a position in a four-item list at
 * exactly the moment the journey got longer. The target spec says it in one
 * line — "one journey must survive across Project and Option contexts" —
 * and the state model is the reason: a stage is AVAILABLE, CURRENT,
 * COMPLETE, SKIPPED or LOCKED, and a stage that is not rendered has none of
 * those.
 *
 * EVERY LOCKED STEP CARRIES ITS REASON. A step that is merely grey states
 * that something is unavailable and nothing else — not why, and not what
 * would open it (rule 12, interaction legend LOCKED).
 */

export type SpineStepId =
  | 'documents' | 'understanding' | 'createOption' | 'buildingScope'
  | 'scopeBoundaries' | 'kg200' | 'kg300' | 'kg400' | 'kg500' | 'kg600' | 'kg700'
  | 'schedule' | 'finalValidation'

/**
 * The Option-level spine (VR3-02, targets T-012–T-017).
 *
 * The first three stages are complete by construction — an Option cannot
 * exist without them — Gebäude & Umfang is the one current, actionable
 * stage, and everything after it is locked with the prerequisite it waits
 * for. Leistungsabgrenzung becomes current the moment the scope is saved,
 * which is what makes the unlock legible in the journey itself and not only
 * in the surface that announced it.
 */
export function OptionWorkflowSpine() {
  const s = useStore()
  const t = useT()
  /**
   * M-06's unlock half (VR3-03R, audit G-09).
   *
   * The sixth scope decision is what opens the cost groups, and the journey
   * is where "opened" becomes visible. This watches the PREDICATE, not the
   * click: the spine is a different surface from the ledger, and a callback
   * threaded between them would couple two components to say something both
   * already derive from the same store.
   *
   * It resolves once and stays resolved for one paint cycle's worth of
   * transition, then clears — a permanently emphasised step is decoration,
   * and the step's own state class carries the standing truth.
   */
  const [justUnlocked, setJustUnlocked] = useState(false)
  const gateOpen = canBeginConfiguration(s)
  const stage = buildingScopeStage(s)
  const onScope = s.pipelineView === 'buildingScope'
  const inConfigurator = s.pipelineView === 'konfigurator'
  const configured = hasKgConfiguration(s)
  const scopeComplete = kgScopeDecisionsComplete(s)
  const decided = kgDecidedScopeCount(s)
  const totalGroups = KG_SCOPE_GROUPS.length
  const configurationComplete = kgConfigurationCompleteFor(s)
  const scheduleStage = optionScheduleStageFor(s)
  const reviewStage = optionReviewStageFor(s)
  const saveStage = optionSaveStageFor(s)
  const clientAvailable = clientModeAvailableForOption(s, s.activeOptionId)
  const openStep = s.openConfiguratorStep
  const decisionsReason = t('vr3.kg.gate.decisionsDetail', {
    decided, total: totalGroups,
  })

  const previouslyComplete = useRef(scopeComplete)
  useEffect(() => {
    if (scopeComplete && !previouslyComplete.current) {
      setJustUnlocked(true)
      // M-06 allows the availability transition up to 220ms. The class is
      // removed after it, so the emphasis cannot repeat or persist.
      const timer = window.setTimeout(() => setJustUnlocked(false), M06_UNLOCK_MS)
      previouslyComplete.current = scopeComplete
      return () => window.clearTimeout(timer)
    }
    previouslyComplete.current = scopeComplete
    return undefined
  }, [scopeComplete])

  /**
   * VR3-03 — the six cost groups are now LIVE steps of this one journey.
   *
   * They used to be a four-item workspace list that replaced the spine the
   * moment the Konfigurator opened, and the six KG entries in the spine
   * itself were all rendered `blocked` with the same generic reason. So the
   * one thing the target asks the rail to carry — "every KG remains visible
   * as current / incomplete / complete / skipped / out of scope" — was the
   * one thing it could not. An excluded group is SKIPPED here, never
   * absent and never "incomplete": that distinction is the whole point of
   * making the decision explicit.
   */
  const kgStep = (group: KgScopeGroup): WorkflowStep => {
    const step = KG_CHAPTER_STEP[group]
    const progress = kgChapterProgressFor(s, group)
    const isOpen = inConfigurator && openStep === step
    const decision = s.kgConfig?.scope[group] ?? 'undecided'
    const state: WorkflowStep['state'] = !configured || !scopeComplete
      ? 'blocked'
      : decision === 'excluded'
        ? 'skipped'
        : isOpen
          ? 'current'
          : progress?.state === 'complete'
            ? 'done'
            : progress?.state === 'invalid'
              ? 'attention'
              : 'upcoming'
    return {
      id: group === 'KG_200' ? 'kg200'
        : group === 'KG_300' ? 'kg300'
          : group === 'KG_400' ? 'kg400'
            : group === 'KG_500' ? 'kg500'
              : group === 'KG_600' ? 'kg600' : 'kg700',
      label: `KG ${group.slice(3)}`,
      state,
      previouslyDone: isOpen && progress?.state === 'complete',
      blockedReason: state === 'blocked'
        ? (gateOpen ? decisionsReason : t('vr3.spine.reason.needsBuildingScope'))
        : undefined,
      // An excluded group stays activatable: its own surface states the
      // decision that skipped it and offers the route to reopen it.
      onSelect: state === 'blocked'
        ? undefined
        : () => {
          s.setPipelineView('konfigurator')
          s.openConfiguratorStepAt(step)
        },
      blockedRoute: state === 'blocked' && gateOpen
        ? () => {
          s.setPipelineView('konfigurator')
          s.openConfiguratorStepAt('scopeBoundaries')
        }
        : undefined,
      // Only the groups the six decisions actually OPENED resolve. An
      // excluded group was decided too, but nothing about it became
      // available — marking it would say the opposite of `skipped`.
      justAvailable: justUnlocked && decision === 'included',
    }
  }

  const steps: WorkflowStep[] = [
    {
      id: 'documents',
      label: t('vr3.spine.step.documents'),
      state: 'done',
      onSelect: () => s.backToOpportunity(),
    },
    {
      id: 'understanding',
      label: t('vr3.spine.step.understanding'),
      state: 'done',
      onSelect: () => s.backToOpportunity(),
    },
    {
      id: 'createOption',
      label: t('vr3.spine.step.createOption'),
      state: 'done',
      onSelect: () => s.backToOpportunity(),
    },
    {
      id: 'buildingScope',
      label: t('nav.buildingScope'),
      // `stale` is not `done`: a scope whose saved fingerprint no longer
      // describes the selection is a stage that needs the user again, and
      // showing a tick there would be the "CONFIRMED without qualification"
      // the interaction legend forbids.
      state: gateOpen ? (onScope ? 'current' : 'done')
        : stage === 'STALE' ? 'attention'
          : 'current',
      previouslyDone: gateOpen && onScope,
      onSelect: () => s.setPipelineView('buildingScope'),
    },
    {
      id: 'scopeBoundaries',
      label: t('vr3.spine.step.scopeBoundaries'),
      state: !gateOpen
        ? 'blocked'
        : inConfigurator && openStep === 'scopeBoundaries'
          ? 'current'
          : scopeComplete ? 'done' : 'upcoming',
      previouslyDone: inConfigurator && openStep === 'scopeBoundaries' && scopeComplete,
      blockedReason: gateOpen ? undefined : t('vr3.spine.reason.needsBuildingScope'),
      onSelect: gateOpen
        ? () => {
          s.setPipelineView('konfigurator')
          s.openConfiguratorStepAt('scopeBoundaries')
        }
        : undefined,
      // T-016's principle: a locked stage is reachable so it can explain
      // itself, and it lands on its own gate, never on its contents.
      blockedRoute: gateOpen ? undefined : () => s.setPipelineView('konfigurator'),
    },
    ...KG_SCOPE_GROUPS.map(kgStep),
    {
      /**
       * VR3-04 — the schedule is a STAGE, so it has the states of one.
       *
       * `done` is a CONFIRMED schedule and nothing else. `attention` is a
       * schedule that is invalid, or one whose confirmation has gone stale,
       * or one whose documented dependency question is still unanswered:
       * three different reasons, one visible "this needs you again", and
       * the reason names which. Showing a tick for a schedule that had been
       * confirmed and then edited would be the "CONFIRMED without
       * qualification" the interaction legend forbids — the same rule the
       * building-scope step above already follows.
       */
      id: 'schedule',
      label: t('vr3.spine.step.schedule'),
      state: !configurationComplete
        ? 'blocked'
        : inConfigurator && openStep === 'commercialSchedule'
          ? 'current'
          : scheduleStage === 'CONFIRMED'
            ? 'done'
            : scheduleStage === 'INVALID' || scheduleStage === 'STALE'
              || scheduleStage === 'WARNING'
              ? 'attention'
              : 'upcoming',
      previouslyDone: inConfigurator && openStep === 'commercialSchedule'
        && scheduleStage === 'CONFIRMED',
      blockedReason: configurationComplete
        ? undefined
        : !scopeComplete ? decisionsReason : t('vr3.kg.gate.scheduleReason'),
      onSelect: configurationComplete
        ? () => {
          s.setPipelineView('konfigurator')
          s.openConfiguratorStepAt('commercialSchedule')
        }
        : undefined,
      blockedRoute: configurationComplete ? undefined : () => {
        s.setPipelineView('konfigurator')
        s.openConfiguratorStepAt('commercialSchedule')
      },
    },
    {
      /**
       * VR3-04 — Final Validation was hardcoded `blocked` with a generic
       * reason, because the stage did not exist. It now carries the state of
       * the review and, once the Option is saved, of the save: `done` means
       * a saved Option, `attention` means a review with issues or one that
       * went stale, and the locked reason names the schedule it waits for.
       */
      id: 'finalValidation',
      label: t('vr3.spine.step.finalValidation'),
      state: reviewStage === 'UNAVAILABLE'
        ? 'blocked'
        : inConfigurator && openStep === 'finalValidation'
          ? 'current'
          : saveStage === 'SAVED'
            ? 'done'
            : reviewStage === 'ISSUES' || reviewStage === 'STALE'
              ? 'attention'
              : 'upcoming',
      previouslyDone: inConfigurator && openStep === 'finalValidation'
        && saveStage === 'SAVED',
      blockedReason: reviewStage === 'UNAVAILABLE'
        ? (configurationComplete
          ? t('vr3.spine.reason.needsSchedule')
          : t('vr3.kg.gate.scheduleReason'))
        : undefined,
      rationale: saveStage === 'SAVED' && clientAvailable
        ? t('vr3.spine.rationale.clientAvailable')
        : undefined,
      onSelect: reviewStage === 'UNAVAILABLE'
        ? undefined
        : () => {
          s.setPipelineView('konfigurator')
          s.openConfiguratorStepAt('finalValidation')
        },
      // T-016's principle one stage later: a locked stage is REACHABLE so it
      // can explain itself, and it lands on its own gate.
      blockedRoute: reviewStage === 'UNAVAILABLE'
        ? () => {
          s.setPipelineView('konfigurator')
          s.openConfiguratorStepAt('finalValidation')
        }
        : undefined,
    },
  ]

  return <WorkflowStepper steps={steps} ariaLabel={t('vr3.spine.label')} size="spine" />
}

/**
 * The PROJECT-level journey, as six grouped stages (accepted 2026-09-05
 * Documents workspace UX audit, "Workflow navigation target").
 *
 * What this replaces: thirteen first-level rows in a permanent left rail,
 * nine of them locked, most repeating the same reason. It published the
 * whole Product model — six cost groups included — before the user had
 * finished the first task, and it consumed permanent width to do it.
 *
 * What is NOT changed, and the distinction this whole node rests on:
 * grouping is PRESENTATION. Every destination below is the destination the
 * flat spine already used, every prerequisite is the predicate the flat
 * spine already read, and nothing here decides whether a stage is reachable
 * — `canCreateOption`, `jobState` and the Option's own existence still do.
 * Six labels replace thirteen rows; not one gate moved.
 *
 * Only ONE stage is ever locked here, and only the immediate next one:
 * Understand, while the analysis has not produced anything to understand.
 * The four stages after it are `upcoming` — neutral orientation, no reason,
 * no cross. A rail of nine crosses described the system's complexity, not
 * the user's position.
 *
 * KG 200–700 exist as Calculate's own members and render only while
 * Calculate is the current stage, which at project level it never is: the
 * cost groups belong to the Option workspace, which keeps its own
 * (unchanged) full-journey spine.
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
  const hasOption = s.options.length > 0
  const latestOption = s.options[s.options.length - 1]
  const analysed = analysis.jobState === 'COMPLETE'
  const go = (target: typeof stage) => () => s.setProjectStage(target)

  const stages: WorkflowStage[] = [
    {
      id: 'documents',
      label: t('vr3.spine.step.documents'),
      state: stage === 'documents' ? 'current' : analysed ? 'done' : 'upcoming',
      onSelect: go('documents'),
    },
    {
      id: 'understand',
      label: t('vr3.journey.stage.understand'),
      // The one useful lock: the stage the user would reach for next, with
      // the prerequisite that is actually missing.
      state: stage === 'understanding'
        ? 'current'
        : !analysed
          ? 'locked'
          : state.state === 'PROJECT_READY_FOR_OPTION' ? 'done' : 'upcoming',
      lockedReason: analysed ? undefined : t('vr3.spine.reason.needsAnalysis'),
      onSelect: analysed ? go('understanding') : undefined,
    },
    {
      id: 'configure',
      label: t('vr3.journey.stage.configure'),
      state: stage === 'createOption' || hasOption ? 'current' : 'upcoming',
      onSelect: hasOption && latestOption
        ? () => s.openOption(latestOption.id)
        : state.canCreateOption ? go('createOption') : undefined,
      steps: [
        {
          id: 'createOption',
          label: t('vr3.spine.step.createOption'),
          state: hasOption ? 'done' : stage === 'createOption' ? 'current' : 'upcoming',
          onSelect: state.canCreateOption || hasOption ? go('createOption') : undefined,
        },
        {
          id: 'buildingScope',
          label: t('nav.buildingScope'),
          state: hasOption ? 'current' : 'upcoming',
          onSelect: hasOption && latestOption
            ? () => s.openOption(latestOption.id)
            : undefined,
        },
        {
          id: 'scopeBoundaries',
          label: t('vr3.spine.step.scopeBoundaries'),
          state: 'upcoming',
        },
      ],
    },
    {
      id: 'calculate',
      label: t('vr3.journey.stage.calculate'),
      state: 'upcoming',
      // Declared, never rendered from here: a stage's members appear only
      // while that stage is current, and Calculate is current inside the
      // Option workspace, not at project level.
      steps: KG_SCOPE_GROUPS.map((group) => ({
        id: group.toLowerCase(),
        label: `KG ${group.slice(3)}`,
        state: 'upcoming' as const,
      })),
    },
    {
      id: 'validate',
      label: t('vr3.journey.stage.validate'),
      state: 'upcoming',
      steps: [
        { id: 'schedule', label: t('vr3.spine.step.schedule'), state: 'upcoming' },
        {
          id: 'finalValidation',
          label: t('vr3.spine.step.finalValidation'),
          state: 'upcoming',
        },
        { id: 'save', label: t('vr3.journey.step.save'), state: 'upcoming' },
      ],
    },
    {
      id: 'present',
      label: t('vr3.journey.stage.present'),
      state: 'upcoming',
    },
  ]

  return <WorkflowNavigator stages={stages} ariaLabel={t('vr3.journey.label')} />
}
