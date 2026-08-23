import type userEvent from '@testing-library/user-event'

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
