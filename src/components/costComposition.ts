import { Decimal } from 'decimal.js'
import type { CostGroup } from '../engine/calculate'
import type { CompositionSegment } from '../design-system/CompositionBar'

/**
 * REDESIGN R2, §8 "ADOPT COMPOSITION GRAPHICS" — the one place a
 * `Projection.kgSplit` becomes `CompositionBar` segments. Consumed by
 * `OptionCard` (OpportunityCard.tsx) and `S4Vergleich`'s column headers so
 * the two surfaces never grow two independent readings of the same split.
 *
 * `kgSplit` already carries only the groups this option's coverage/scope
 * actually includes (`computeProjection` in store.ts) — no filtering
 * happens here, and the exact `Decimal` values pass through untouched
 * (CALC-007: never the display-rounded string). Slot order follows the DIN
 * 276 group order (200→800) so the bar and any legend read left→right in
 * the order a reader already expects from the KG tables elsewhere.
 */
const GROUP_ORDER: CostGroup[] = [
  'KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700', 'KG_800',
]

export function buildKgCompositionSegments(
  kgSplit: Partial<Record<CostGroup, Decimal>>,
  translateGroup: (group: CostGroup) => string,
): CompositionSegment[] {
  return GROUP_ORDER
    .filter((group) => kgSplit[group] !== undefined && kgSplit[group]!.greaterThan(0))
    .map((group, index) => ({
      id: group,
      label: translateGroup(group),
      value: kgSplit[group]!,
      categorySlot: index + 1,
    }))
}
