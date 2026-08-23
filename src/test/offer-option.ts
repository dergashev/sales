import type userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { includedBuildingIds, useStore } from '../state/store'

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
