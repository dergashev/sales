import type userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { includedBuildingIds, useStore } from '../state/store'
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
