import { useRef } from 'react'
import { useStore } from '../state/store'
import { readiness, type FixtureProject, type ProjectAnalysis } from '../state/projectAnalysis'
import { ActionGate } from '../design-system/ActionGate'
import { Button } from './primitives'
import { useT } from '../i18n'

/**
 * Creating an Option — the COMMITMENT, in one place, behind two presentations.
 *
 * Extracted from `ProjectHome.tsx` unchanged in substance. The reason it moved
 * is the reason the extraction is worth making: the act now has two homes —
 * the full gate on `Projektverständnis`, where creating the FIRST Option is
 * the surface's primary action and its prerequisites need naming, and a bare
 * secondary button on `Optionen`, where the gate is open by construction
 * (Options exist) and a prerequisite list would state the obvious. Two copies
 * of the guard would have been two chances to lose the double-click
 * protection or the staged commitment.
 *
 * NOTHING about the commitment changed: `beginOptionCreation` is still
 * idempotent, the shell still advances `BASELINE → OPTION` so the busy state
 * is actually painted, the failure branch still leaves readiness and every
 * resolved conflict untouched, and the DC-29 undo is untouched.
 */

/** The transient half of the commitment, for one project. */
function useOptionCommit(project: FixtureProject) {
  const s = useStore()
  const commit = s.optionCommit?.projectId === project.id ? s.optionCommit : null
  const lastRequestAt = useRef(0)
  const busy = Boolean(commit?.stage)

  /**
   * Guarded by STATE first, then by time. `beginOptionCreation` is idempotent
   * for the same reason, so three independent things would have to fail at
   * once to create two Options from one intent — the canonical Button blocks
   * with `aria-disabled` rather than `disabled`, so a scripted or rapid
   * second activation still dispatches its click (AUD-03).
   */
  const create = () => {
    if (busy) return
    const now = Date.now()
    if (now - lastRequestAt.current < OPTION_CREATE_GUARD_MS) return
    lastRequestAt.current = now
    s.beginOptionCreation()
  }

  return { commit, busy, create, errorKey: commit?.errorKey ?? null }
}

/** Rapid-click guard on Option creation (the retired project card's AUD-03). */
export const OPTION_CREATE_GUARD_MS = 500

/**
 * The bare action, for a surface whose gate is already open.
 *
 * It still refuses when `canCreateOption` is false and still states WHY
 * through the canonical Button's own `disabledReason`, so rule 12 holds
 * without an `ActionGate` around it: a blocked element always explains
 * itself, and one sentence in one place is the whole point.
 */
export function CreateOptionButton({
  project, analysis, variant, label,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  variant: 'primary' | 'secondary'
  label: string
}) {
  const t = useT()
  const state = readiness(project, analysis)
  const { busy, create, commit, errorKey } = useOptionCommit(project)
  return (
    <Button
      variant={variant}
      disabled={!state.canCreateOption || busy}
      disabledReason={state.lockReasonKey
        ? t(state.lockReasonKey, {
          count: state.unresolvedBlockingConflicts || state.blockingQuestions
            || state.staleFactKeys.length,
        })
        : errorKey ? t(errorKey) : undefined}
      loading={busy}
      loadingLabel={commit?.stage === 'OPTION'
        ? t('vr3.readiness.creatingOption.option')
        : t('vr3.readiness.creatingOption.baseline')}
      onClick={create}
    >
      {label}
    </Button>
  )
}

/**
 * The full gate, for `Projektverständnis` — where the FIRST Option is created
 * and the prerequisites are the point of the surface.
 */
export function CreateOptionGate({
  project, analysis,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
}) {
  const s = useStore()
  const t = useT()
  const state = readiness(project, analysis)
  const { busy, create, commit, errorKey } = useOptionCommit(project)

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
          count: state.unresolvedBlockingConflicts || state.blockingQuestions
            || state.staleFactKeys.length,
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
