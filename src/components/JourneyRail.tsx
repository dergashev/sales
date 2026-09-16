import { useEffect, useId, useState } from 'react'
import { demoProject } from '../state/projectAnalysis'
import { useStore } from '../state/store'
import { optionDisplayName, orderedOptions } from '../state/optionLifecycle'
import { useT } from '../i18n'
import {
  WorkflowNavigator,
  type WorkflowStage,
  type WorkflowState,
} from '../design-system/WorkflowNavigator'
import { useOptionWorkflowStages, useProjectWorkflowStages } from './WorkflowSpine'

/**
 * THE WHOLE JOURNEY AS ONE COLUMN — navigation variant `v2`.
 *
 * What it is: the same stages the two horizontal rails build, from the same
 * two builders (`useProjectWorkflowStages`, `useOptionWorkflowStages`),
 * concatenated into ONE vertical `WorkflowNavigator`. Not a second source of
 * truth about the workflow — there is no state, no label and no route
 * computed here; if a prerequisite changes in the builder, both variants
 * change with it.
 *
 * What it deliberately does NOT do: claim Option stages while no Option is
 * open. The seam audit's rule — a stage appears only in the rail of the tier
 * that owns its data — is the reason the released rails were split, and the
 * defect it named was four Option labels frozen at `upcoming` on a tier that
 * owns none of that data. So the Option half appears exactly when an Option
 * is open (`level === 'option'`), where its data exists and every one of its
 * stages can actually become current. Standing at project level, the column
 * is three stages long and states nothing it cannot know.
 *
 * The project half stays interactive inside the Option workspace: leaving an
 * Option is a real route (`backToOpportunity`), and it is the one thing the
 * retired spine got right — it was the only exit, and it was disguised as a
 * completed workflow step. Here it is the project stage itself, `available`,
 * saying where it goes.
 */
export function JourneyRail() {
  const s = useStore()
  const t = useT()
  const project = demoProject(s.opportunityId)
  const analysis = project ? s.projectAnalyses[project.id] : undefined

  /**
   * Both builders run on every render — hooks cannot be called conditionally
   * — and the Option builder is safe at project level: every predicate it
   * reads (`canBeginConfiguration`, `kgScopeStatus`, `optionSaveStageFor`, …)
   * is a total function of the store and answers for "no Option yet" the
   * same way it answers on first entry. Only the RESULT is conditional.
   */
  const projectStages = useProjectWorkflowStages(
    project && analysis ? { project, analysis } : null,
  )
  const optionStages = useOptionWorkflowStages()

  if (!project || !analysis) return null

  const inOption = s.level === 'option'
  const activeOptionId = s.activeOptionId
  const variant = s.navVariant

  /**
   * ONE `current` IN A RAIL THAT SHOWS BOTH TIERS.
   *
   * `projectStage` keeps its value while the user is inside an Option — the
   * released rails never had to reconcile that, because only one of them was
   * ever mounted. Concatenated, they said `Optionen · aktuell` and
   * `Konfigurieren · aktuell` at the same time, and "you are here" twice is
   * "you are here" nowhere.
   *
   * The Option tier owns the position while the user stands in it, so the
   * project stage becomes what it factually is: a place they can go back to.
   * `available` is that word in this vocabulary — named for what it offers,
   * not for when it happens — and it is the ONLY state this component
   * changes. No prerequisite, label or route is re-decided here.
   *
   * Crossing back is a real move, not a stage switch: `backToOpportunity`
   * leaves the Option workspace and the builder's own `onSelect` then names
   * the stage to land on, in that order, so the landing stage wins.
   */
  /**
   * THE WHOLE JOURNEY IS VISIBLE FROM THE START (owner's decision, 14.09).
   *
   * The Option stages used to appear only once an Option was open, because
   * the seam audit's rule says a stage belongs to the rail of the tier that
   * owns its data — and four labels frozen at `upcoming` on a tier that owns
   * none of it is the defect that rule exists to prevent.
   *
   * They are shown from the register now, and the honesty is bought back a
   * different way: without an open Option they are LOCKED and name what is
   * missing (`Option fehlt`), so they read as a map of what is coming rather
   * than as steps somebody could be standing on. `current` is suppressed for
   * exactly that reason — the reader is at project level, and two "you are
   * here" marks would make both meaningless. When an Option exists, the row
   * is a route into it, and the rail becomes precise the moment it opens.
   */
  const optionPreview = optionStages.map((stage) => ({
    ...stage,
    state: (activeOptionId ? 'available' : 'locked') as WorkflowState,
    reason: activeOptionId ? undefined : t('vr3.spine.reason.needsOption'),
    // Deliberately no members: the steps inside a stage nobody is standing
    // in would be a second list of things that cannot be done yet.
    steps: undefined,
    onSelect: activeOptionId ? () => s.openOption(activeOptionId) : undefined,
  }))

  const projectStagesBehind: WorkflowStage[] = projectStages.map((stage) => ({
        ...stage,
        /**
         * Inside an Option, the project stages are BEHIND the reader.
         *
         * `Optionen` reads `current` at project level for as long as
         * `projectStage` says so, which it keeps saying while the user is
         * one tier down. Two `current`s is "you are here" nowhere — and
         * `available` was not right either: the reader did not merely have
         * the chance to open an Option, they opened one and are standing in
         * it. That is what `done` means in this vocabulary, and it is the
         * tick the marker then shows instead of a number.
         *
         * Still the only state this component changes. No prerequisite,
         * label or route is re-decided here.
         */
    state: stage.state === 'current' ? ('done' as const) : stage.state,
    onSelect: stage.onSelect
      ? () => { s.backToOpportunity(); stage.onSelect!() }
      : undefined,
  }))

  /**
   * `v4` — THE JOURNEY IS TWO TIERS, AND IT SAYS SO.
   *
   * Everything after `Optionen` belongs to ONE Option: `Konfigurieren`,
   * `Kalkulieren`, `Prüfen`, `Präsentieren` are not four further steps of the
   * project, they are the steps of the variant that was opened. Read as one
   * column of seven, the rail claims a single sequence — and in a project
   * with three Options, «step 5 of 7» is a statement about which one?
   *
   * So the Option gets a block of its own, headed by the Option itself, with
   * its stages underneath. Two navigations, each with its own accessible
   * name and its own single `current`, instead of one list that has to be
   * read as though it were flat. Nothing here re-decides a stage, a
   * prerequisite, a label or a route: it is the same two builders, arranged
   * the way the data actually nests.
   */
  if (variant === 'v4') {
    const rows = orderedOptions(s)
    return (
      <aside className="a3-journey-rail" aria-label={t('vr3.spine.projectLabel')}>
        <p className="a3-journey-rail-name">{project.name}</p>
        <WorkflowNavigator
          stages={inOption ? projectStagesBehind : projectStages}
          orientation="vertical"
          ariaLabel={t('vr3.journey.label')}
        />
        {/* EVERY Option is here, not only the open one: the collection is
            what the project has, and a rail that showed one of three said
            nothing about the other two. Nothing is rendered while there is
            no Option — an empty block before the first one exists would be
            a heading for something the project does not have yet. */}
        {rows.map((row) => {
          const open = row.id === activeOptionId
          return (
            <OptionJourneyBlock
              key={row.id}
              name={optionDisplayName(row, t('vr3.option.baseName'))}
              /* Only the Option being worked on shows its steps. For the
                 others the step states would have to be computed from a
                 configuration that is not loaded — so the block opens by
                 OPENING the Option, which is the honest way to see them. */
              stages={open ? (inOption ? optionStages : optionPreview) : null}
              onOpen={open ? undefined : () => s.openOption(row.id)}
            />
          )
        })}
      </aside>
    )
  }

  const stages: WorkflowStage[] = inOption
    ? [...projectStagesBehind, ...optionStages]
    : [...projectStages, ...optionPreview]

  return (
    <aside className="a3-journey-rail" aria-label={t('vr3.spine.projectLabel')}>
      <p className="a3-journey-rail-name">{project.name}</p>
      <WorkflowNavigator
        stages={stages}
        orientation="vertical"
        ariaLabel={t('vr3.journey.label')}
      />
    </aside>
  )
}

/**
 * One Option's block in the `v4` rail — its name, and its steps under it.
 *
 * The Option being worked on carries `stages` and is collapsible, open by
 * default: those steps are what the reader walks through, so hiding them
 * would be hiding the journey. Every other Option is collapsed and its
 * heading OPENS it — the steps of an Option that is not loaded would have to
 * be invented, and this rail states nothing it cannot know.
 */
function OptionJourneyBlock({
  name, stages, onOpen,
}: {
  name: string
  /** The Option's steps, or `null` for an Option that is not open. */
  stages: WorkflowStage[] | null
  /** Given instead of steps: pressing the heading opens this Option. */
  onOpen?: () => void
}) {
  const t = useT()
  const isCurrent = Boolean(stages)
  /**
   * Collapsing is the reader's choice ABOUT THE OPTION THEY ARE IN, and it
   * ends when they leave it. Opening another Option expands that one and
   * collapses this one in the same move — one Option is open, so one block
   * shows steps, and a block cannot stay shut on the Option the reader just
   * switched to because they closed it ten minutes ago.
   */
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => { if (isCurrent) setCollapsed(false) }, [isCurrent])
  const listId = useId()
  const expanded = isCurrent && !collapsed
  return (
    <div className="a3-journey-option" data-current={stages ? 'true' : undefined}>
      <p className="a3-journey-option-head">
        <button
          type="button"
          className="a3-journey-option-toggle hit-target"
          aria-expanded={expanded}
          aria-controls={stages ? listId : undefined}
          onClick={onOpen ?? (() => setCollapsed((current) => !current))}
        >
          <svg
            className="a3-journey-option-chevron"
            data-open={expanded ? 'true' : undefined}
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M5 3.5 L10.5 8 L5 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="square"
            />
          </svg>
          <span className="a3-journey-option-name">{name}</span>
        </button>
      </p>
      {stages ? (
        <div id={listId} hidden={collapsed}>
          <WorkflowNavigator
            stages={stages}
            orientation="vertical"
            ariaLabel={t('vr3.journey.optionLabel')}
          />
        </div>
      ) : null}
    </div>
  )
}
