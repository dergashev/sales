import type userEvent from '@testing-library/user-event'
import { act, screen } from '@testing-library/react'
import {
  canBeginConfiguration, includedBuildingIds, kgCatalogueFor, useStore,
  activeSchedulePhasesFor,
  clientModeAvailableForOption,
  finalValidationConfirmedFor,
  optionSaveStageFor,
  optionScheduleStageFor,
  reviewProgressFor,
  scheduleConfirmedFor,
} from '../state/store'
import { REVIEW_SECTIONS } from '../state/optionReview'
import {
  KG_SCOPE_GROUPS, allServices, type KgScopeDecision,
} from '../engine/kgConfiguration'
import { buildingScopeStage, scopeSelectedIds } from '../state/optionBuildingScope'
import { demoProject } from '../state/projectAnalysis'

/**
 * Task 02 (deep-coherence audit, F-22): a building review used to require
 * three independent "Abschnitt bestätigen" clicks before "Gebäude
 * bestätigen" unlocked — this helper existed to perform those three clicks
 * for every caller. `BuildingScope.tsx`'s single building-level confirm
 * button now confirms every ready section itself as part of one action
 * (AC5: one confirmation action per building), so there is nothing left
 * for this helper to click. Kept as a no-op — not removed — so its many
 * call sites (each still followed by the actual "Gebäude bestätigen"
 * click) do not need touching for a change that is purely internal to
 * this one step of the flow.
 */
export async function confirmBuildingReviewSections(
  _user: ReturnType<typeof userEvent.setup>,
) {
  // Intentionally empty — see docblock above.
}

/**
 * Task 03 (deep-coherence audit, F-16/PD-3): Export is now gated on
 * `configurationComplete()` — Scope Boundaries confirmed AND every included
 * building's visible configuration confirmed. The derivation itself is
 * exercised directly by `configurator-mode.dom.test.tsx` and
 * `buildingProposal.test.ts`; tests whose actual subject is further down
 * the pipeline (Vergleich/Export/sending) only need the gate's precondition
 * satisfied, not a full click-through of every "bestätigen" affordance.
 * Call this right before reaching Export so the confirmed fingerprint
 * reflects whatever state the test has already set up — confirming earlier
 * and then still editing coverage/energiestandard/etc. would invalidate it
 * again (fingerprint-based invalidation is exactly the point, not a bug).
 */
export function confirmWholeConfiguration() {
  act(() => {
    const s = useStore.getState()
    s.confirmScopeBoundaries()
    includedBuildingIds(s).forEach((id) => s.confirmBuildingConfiguration(id))
  })
}

/**
 * VR3-03 — put the Option's six scope decisions on record.
 *
 * An Option now STARTS with six undecided cost groups, because that absence
 * is the honest initial state and the whole subject of the ledger. Suites
 * whose subject is further down the journey (comparison, export, client
 * presentation, keyboard traversal) need a priced Option, not a re-test of
 * the ledger — this records the decisions the way the ledger's own action
 * does, through the store's one door.
 */
export function decideAllKgScope(
  decision: KgScopeDecision = 'included',
) {
  act(() => {
    const s = useStore.getState()
    for (const group of KG_SCOPE_GROUPS) s.setKgScopeDecision(group, decision)
  })
}

/**
 * The FIXTURE BASELINE: six cost groups in scope and every explicit service
 * decision recorded as "not included" — the Option example the VR3-00
 * fixture specification describes, and the state in which the declared
 * demonstration totals hold exactly.
 *
 * It records real decisions through real actions, so the journal, the
 * commercial result and every gate downstream are exactly what a user who
 * clicked through it would have.
 */
export function completeKgConfiguration() {
  decideAllKgScope('included')
  act(() => {
    const s = useStore.getState()
    const catalogue = kgCatalogueFor(s)
    if (!catalogue) return
    for (const service of allServices(catalogue)) {
      if (!service.requiresDecision) continue
      s.setKgServiceDecision(service.id, { state: 'notSelected' })
    }
    s.confirmKgScope()
  })
}

/**
 * VR3-01: reach the Option workspace deterministically.
 *
 * Before VR3-01 the way in was a five-click preamble through the Project
 * Card — open the project, take the customer WFL value, confirm the project
 * parameters, create the Option, open it. Every one of those five controls
 * belonged to a surface this ticket retired, and none of them was ever the
 * subject of the suites that used them: their subject is the Option
 * workspace, and the project preamble was scaffolding.
 *
 * This helper puts the project at its SEEDED CHECKPOINT — the state the
 * fixture specification itself sanctions for demos: the analysis complete,
 * every blocking conflict decided from the fixture's own recommendation,
 * every already-answered question recorded — then commits the project
 * baseline and opens the resulting Option. It is the same state the manual
 * journey produces, reached without re-testing the journey.
 *
 * The project-level journey itself (start → per-file states → conflicts →
 * readiness → gate) is tested where it belongs, in
 * `src/screens/__tests__/project-readiness.dom.test.tsx` and
 * `src/state/__tests__/projectAnalysis.test.ts`.
 */
export function enterOptionWorkspace(projectId = 'DEMO-HAPPY-01') {
  act(() => {
    const s = useStore.getState()
    s.openOpportunity(projectId)
    s.seedProjectCheckpoint(projectId)
    // The proposal fixture's own WFL conflict belongs to the OPTION
    // workspace (Gebäude & Umfang), not to the project: VR3-01's project
    // conflicts are the six coherent ones in the fixture register. The
    // retired preamble resolved it with "Kundenwert übernehmen" before
    // creating the Option, so the created Option inherited the customer-
    // confirmed value — this keeps that exact inherited state, because the
    // suites downstream assert on the resulting WFL.
    s.resolveWflConflict('customer')
  })
  act(() => {
    const created = useStore.getState().createOption()
    if (!created) {
      throw new Error(
        `Option creation refused for ${projectId}: the readiness gate is closed. `
        + 'The seeded checkpoint should leave zero unresolved blocking conflicts.',
      )
    }
    useStore.getState().openOption(created)
  })
}

/**
 * VR3-01: reach a project's Project Understanding stage deterministically.
 *
 * The document-analysis job itself advances one file-phase per tick (36
 * files × 5 phases for the complex project), and the fixture specification
 * sanctions a SEEDED CHECKPOINT for exactly this reason: a suite whose
 * subject is the understanding surface, the readiness gate or plain text
 * hygiene must not re-drive 180 ticks of a job it is not testing.
 *
 * `conflicts: 'open'` reopens every fixture conflict again — the same
 * `reopenProjectConflict` action the UI's "Entscheidung zurücknehmen"
 * calls — which is the only way to reach "analysis complete AND blocking
 * conflicts still outstanding" without walking the job. That state is what
 * a LOCKED create-Option gate looks like, so it is the state a gate test
 * needs.
 *
 * Call it AFTER `render(<App />)`, like `enterOptionWorkspace`.
 */
export function enterProjectUnderstanding(
  projectId: string,
  options: { conflicts?: 'decided' | 'open' } = {},
) {
  act(() => {
    const s = useStore.getState()
    s.openOpportunity(projectId)
    s.seedProjectCheckpoint(projectId)
  })
  if (options.conflicts === 'open') {
    act(() => {
      const project = demoProject(projectId)
      if (!project) throw new Error(`Unknown demonstration project: ${projectId}`)
      project.conflicts.forEach((conflict) => {
        useStore.getState().reopenProjectConflict(conflict.id)
      })
    })
  }
}

/**
 * Drive an in-flight Option-creation commitment to its conclusion.
 *
 * Creating an Option is a staged commitment (baseline, then Option), and
 * the UI advances one stage per timer tick. Tests drive the STAGES instead
 * of waiting out the clock, for exactly the reason the document-analysis
 * suites do: an assertion about state cannot be made flaky by a slow
 * machine, and a commitment that stalls fails on its state rather than on
 * a sleep that happened to be long enough.
 *
 * Safe to call when nothing is in flight, and safe to call alongside the
 * component's own tick: `advanceOptionCreation` is a no-op unless a
 * commitment is actually pending.
 */
export function settleOptionCommit() {
  // One more than the number of stages: enough to finish, few enough that a
  // commitment which never settles fails here instead of spinning.
  for (let i = 0; i < 4; i++) {
    if (!useStore.getState().optionCommit?.stage) return
    act(() => useStore.getState().advanceOptionCreation())
  }
  throw new Error(
    'Option creation did not settle: the commitment is still in flight after '
    + 'four stage advances. Either a stage stopped clearing itself or a new '
    + 'stage was added without updating this helper.',
  )
}

/**
 * VR3-02: complete Gebäude & Umfang and enter the Konfigurator.
 *
 * The four-control preamble this replaces — "Gebäude bestätigen",
 * "Konfigurator öffnen", a configuration-mode radio and "Konfiguration
 * starten" — belonged to two surfaces this ticket rebuilt, and the mode
 * radio to a step the target removed outright ("configuration-mode
 * decisions, if retained, belong inside Gebäude & Umfang; they must not
 * create an extra unmodelled gate"). None of those controls was ever the
 * SUBJECT of the suites that clicked them: their subject is the
 * Configurator, and the scope preamble was scaffolding.
 *
 * It drives the same transitions the surface drives — confirm every
 * selected building, save the scope, enter Leistungsabgrenzung — so the
 * gate is genuinely satisfied rather than bypassed. The building-scope
 * journey itself is tested where it belongs, in
 * `src/screens/__tests__/building-scope.dom.test.tsx`.
 */
export function completeBuildingScope(mode: 'SHARED' | 'PER_BUILDING' = 'PER_BUILDING') {
  act(() => {
    const s = useStore.getState()
    scopeSelectedIds(s).forEach((id) => useStore.getState().confirmScopeBuilding(id))
    useStore.getState().beginBuildingScopeSave()
    useStore.getState().advanceBuildingScopeSave()
  })
  act(() => {
    const s = useStore.getState()
    if (!canBeginConfiguration(s)) {
      throw new Error(
        'Building scope did not open the Konfigurator gate: '
        + `stage=${buildingScopeStage(s)}, selected=${scopeSelectedIds(s).length}`,
      )
    }
    // The user reaches the Configurator by entering the stage and then
    // starting Leistungsabgrenzung; both transitions belong to the flow.
    s.setPipelineView('konfigurator')
    useStore.getState().confirmConfigurationMode(mode)
  })
}

/**
 * VR3-04: reach a SAVED OPTION — the state Client Mode requires.
 *
 * This exists because VR3-04 moved the client-mode gate. It used to be
 * `canBeginConfiguration && configurationComplete`, so every suite whose
 * subject is downstream of the meeting (presentation, scenario, export,
 * keyboard traversal) reached Client Mode simply by finishing the
 * configuration. That predicate was the audit's F-002 and it is gone: the
 * gate is now a valid SAVED baseline.
 *
 * So those suites need the four remaining transitions, and they need them
 * DRIVEN rather than faked — a helper that wrote `savedOptionVersions`
 * directly would let a broken gate keep passing, which is precisely the
 * failure mode this ticket exists to remove. It therefore accepts the
 * documented dependency questions, confirms the schedule, reads every one of
 * the twelve review sections, confirms the review and saves.
 *
 * The stages themselves are tested where they belong, in
 * `src/screens/__tests__/final-validation.dom.test.tsx` and
 * `src/state/__tests__/optionSchedule.test.ts`.
 */
export function saveOptionBaseline() {
  act(() => {
    const s = useStore.getState()
    // Accept every documented dependency question the fixture carries. It is
    // a real decision with a real journal entry; nothing else can make a
    // WARNING schedule confirmable.
    for (const phase of activeSchedulePhasesFor(s)) {
      if (!phase.dependencyQuestionId) continue
      useStore.getState().setScheduleDependencyConfirmed(phase.id, true)
    }
    useStore.getState().confirmSchedule()
  })
  act(() => {
    const s = useStore.getState()
    if (!scheduleConfirmedFor(s)) {
      throw new Error(
        `Schedule did not confirm: stage=${optionScheduleStageFor(s)}`,
      )
    }
    for (const section of REVIEW_SECTIONS) {
      useStore.getState().acknowledgeReviewSection(section.id)
    }
    useStore.getState().confirmFinalValidation()
  })
  act(() => {
    const s = useStore.getState()
    if (!finalValidationConfirmedFor(s)) {
      const progress = reviewProgressFor(s)
      throw new Error(
        'Final validation did not confirm: '
        + `${progress.reviewed}/${progress.total} reviewed, `
        + `${progress.blockers.length} blockers `
        + `(${progress.blockers.map((issue) => issue.id).join(', ')})`,
      )
    }
    useStore.getState().beginOptionSave()
    useStore.getState().advanceOptionSave()
  })
  act(() => {
    const s = useStore.getState()
    if (!clientModeAvailableForOption(s, s.activeOptionId)) {
      throw new Error(
        `Option did not save: stage=${optionSaveStageFor(s)}, `
        + `error=${s.optionSaveCommit?.errorKey ?? 'none'}`,
      )
    }
  })
}

/**
 * VR3-05 — cross the Client Mode boundary (T-034).
 *
 * Entering Client Mode now opens on a boundary screen that names the saved
 * Option being presented and asks for one deliberate action; the narrative
 * begins after it. Suites whose subject is the narrative (or anything past
 * it) call this immediately after `setMode('praesentation')` — the boundary
 * itself is tested where it belongs, in `client-presentation.dom.test.tsx`.
 */
export async function startClientPresentation(
  user: ReturnType<typeof userEvent.setup>,
) {
  // `findByRole`, not `queryByRole`: the gate dialog's close and the shell
  // swap are two renders, so the boundary is not on screen in the same tick
  // as the click that opened Client Mode.
  const start = await screen.findByRole('button', { name: 'Präsentation starten' })
  await user.click(start)
}
