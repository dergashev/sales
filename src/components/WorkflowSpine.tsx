import { useStore, canBeginConfiguration } from '../state/store'
import { buildingScopeStage } from '../state/optionBuildingScope'
import { readiness, type ProjectAnalysis, type FixtureProject } from '../state/projectAnalysis'
import { useT } from '../i18n'
import { WorkflowStepper, type WorkflowStep } from '../design-system/WorkflowStepper'

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

const DOWNSTREAM: ReadonlyArray<readonly [SpineStepId, string]> = [
  ['scopeBoundaries', 'vr3.spine.step.scopeBoundaries'],
  ['kg200', 'costGroup.200'],
  ['kg300', 'costGroup.300'],
  ['kg400', 'costGroup.400'],
  ['kg500', 'costGroup.500'],
  ['kg600', 'costGroup.600'],
  ['kg700', 'costGroup.700'],
  ['schedule', 'vr3.spine.step.schedule'],
  ['finalValidation', 'vr3.spine.step.finalValidation'],
]

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
  const gateOpen = canBeginConfiguration(s)
  const stage = buildingScopeStage(s)
  const onScope = s.pipelineView === 'buildingScope'

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
    ...DOWNSTREAM.map(([id, key], index): WorkflowStep => {
      const isFirst = index === 0
      const current = gateOpen && isFirst && !onScope
      return {
        id,
        // The rail names a cost group by its NUMBER, as the approved target
        // does; the full DIN 276 title belongs on the KG page itself.
        label: id.startsWith('kg') ? `KG ${id.slice(2)}` : t(key),
        state: current ? 'current' : gateOpen && isFirst ? 'upcoming' : 'blocked',
        // The IMMEDIATE next stage names its actual prerequisite; the ones
        // behind it say only that a prerequisite is missing. Thirteen
        // full sentences would turn the spine into a wall of prose and
        // bury the one reason the user can act on — the exact prerequisite
        // for every locked stage is named on the stage's own gate.
        blockedReason: current || (gateOpen && isFirst)
          ? undefined
          : isFirst
            ? t('vr3.spine.reason.needsBuildingScope')
            : t('vr3.spine.reason.locked'),
        // The FIRST downstream stage stays reachable even while it is
        // locked: a direct navigation attempt is exactly how a user finds
        // out what is missing, and it lands on that stage's own gate with
        // the named prerequisite and the route that resolves it (T-016).
        // A label they cannot even click is the "disabled navigation as
        // the explanation" defect this ticket replaces.
        onSelect: isFirst ? () => s.setPipelineView('konfigurator') : undefined,
        blockedRoute: isFirst ? () => s.setPipelineView('konfigurator') : undefined,
      }
    }),
  ]

  return <WorkflowStepper steps={steps} ariaLabel={t('vr3.spine.label')} size="spine" />
}

/**
 * The project-level spine. Extracted from `ProjectHome` unchanged in
 * meaning so both contexts read one definition of the journey; the only
 * difference is that here the first three stages are still being earned.
 */
export function ProjectWorkflowSpine({
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

  const go = (target: typeof stage) => () => s.setProjectStage(target)

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
      // VR3-02 (T-012): once the Option EXISTS this stage is complete, and
      // the current stage is the one it handed off to. Leaving it "current"
      // while an Option sat beside it said the user still had to do the
      // thing they had just done.
      state: hasOption
        ? 'done'
        : stage === 'createOption'
          ? 'current'
          : state.canCreateOption ? 'attention' : 'blocked',
      blockedReason: state.canCreateOption || hasOption
        ? undefined
        : t('vr3.spine.reason.needsReadiness'),
      onSelect: hasOption ? go('createOption') : undefined,
    },
    {
      id: 'buildingScope',
      label: t('nav.buildingScope'),
      // VR3-02: once the Option exists this stage is the CURRENT one — it
      // is not "blocked · Option fehlt", which is what it said while an
      // Option sat right beside it.
      state: hasOption ? 'current' : 'blocked',
      blockedReason: hasOption ? undefined : t('vr3.spine.reason.needsReadiness'),
      onSelect: hasOption && latestOption
        ? () => s.openOption(latestOption.id)
        : undefined,
    },
    ...DOWNSTREAM.map(([id, key]): WorkflowStep => ({
      id,
      label: id.startsWith('kg') ? `KG ${id.slice(2)}` : t(key),
      state: 'blocked' as const,
      blockedReason: !hasOption
        ? t('vr3.spine.reason.needsReadiness')
        : id === 'scopeBoundaries'
          ? t('vr3.spine.reason.needsBuildingScope')
          : t('vr3.spine.reason.locked'),
    })),
  ]

  return <WorkflowStepper steps={steps} ariaLabel={t('vr3.spine.label')} size="spine" />
}
