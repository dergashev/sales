import { Decimal } from 'decimal.js'
import type { Driver } from '../engine/calculate'

/**
 * Authoritative boundary for the live client projection.
 *
 * Client mode is an allowlisted product projection, not a CSS variant. Every
 * route, chapter, level transition, and internal-only action consults this
 * module so a newly added navigation path cannot silently fall back to the
 * private workspace.
 */

export type OutputMode = 'intern' | 'praesentation'

export type PipelineView =
  | 'buildingScope' | 'konfigurator' | 'vergleich' | 'export'
  | 'einstellungen' | 'grundlagen'

export type ProductLevel = 'liste' | 'opportunity' | 'option'

export type ProjectionVisibility = 'clientSafe' | 'internalOnly'

const CLIENT_VISIBLE_PIPELINE_VIEWS = new Set<PipelineView>([
  'buildingScope',
  'konfigurator',
  'vergleich',
  'export',
])

export function isClientProjection(mode: OutputMode): boolean {
  return mode === 'praesentation'
}

export function isVisibleInOutputProfile(
  mode: OutputMode,
  visibility: ProjectionVisibility,
): boolean {
  return visibility === 'clientSafe' || !isClientProjection(mode)
}

export function isClientVisiblePipelineView(view: PipelineView): boolean {
  return CLIENT_VISIBLE_PIPELINE_VIEWS.has(view)
}

export function pipelineViewForOutputProfile(
  mode: OutputMode,
  view: PipelineView,
): PipelineView {
  return isClientProjection(mode) && !isClientVisiblePipelineView(view)
    ? 'konfigurator'
    : view
}

export function isClientVisibleLevel(level: ProductLevel): boolean {
  return level === 'option'
}

/** Leaving the option workspace always leaves the client projection first. */
export function modeForLevelTransition(
  mode: OutputMode,
  nextLevel: ProductLevel,
): OutputMode {
  return isClientProjection(mode) && !isClientVisibleLevel(nextLevel) ? 'intern' : mode
}

const KG800_PRIVATE_DRIVER_PREFIX = 'kg800_'

/**
 * KG 800's financing breakdown is private by default (QA finding, ticket
 * "MAKE ALL KG 200-800 SELECTABLE…"): the itemized debt/fee/commitment
 * lines must stay internal unless a seller explicitly reveals them for the
 * current meeting via `kg800ClientRevealed`.
 *
 * The AMOUNT is not hidden — it is a real, already-calculated part of every
 * total shown to the client (rule 16: no fabricated zero, no hidden gap).
 * Only the ITEMIZATION is gated: the three `kg800_*` driver rows collapse
 * into one aggregate `KG 800 · Finanzierung` row whenever the breakdown must
 * stay private, so any client-visible driver list still sums exactly to the
 * same total (rule 32) instead of silently dropping money or contradicting
 * the hero figure.
 *
 * Every OfferPanel surface that renders `Driver[]` (the recap "Im Angebot
 * gewählt" list, the Herkunft origin popover, and the Kostentreiber table)
 * must read through this projection instead of the raw engine drivers —
 * that is the actual privacy boundary, not the KG 800 chapter being absent
 * from client-facing navigation (which only hides the chapter, not these
 * three other surfaces that independently render the full driver list).
 */
export function projectDriversForClient(
  drivers: readonly Driver[],
  mode: OutputMode,
  kg800ClientRevealed: boolean,
): Driver[] {
  if (!isClientProjection(mode) || kg800ClientRevealed) return [...drivers]
  const hidden = drivers.filter((d) => d.key.startsWith(KG800_PRIVATE_DRIVER_PREFIX))
  if (hidden.length === 0) return [...drivers]
  const visible = drivers.filter((d) => !d.key.startsWith(KG800_PRIVATE_DRIVER_PREFIX))
  const sum = hidden.reduce((acc, d) => acc.plus(d.exact), new Decimal(0))
  return [
    ...visible,
    {
      key: 'kg800_aggregate',
      origin: 'decision',
      block: 'separatePosition',
      exact: sum,
      label: 'KG 800 · Finanzierung',
      scopeRefs: ['KG 800'],
      basis: null,
    },
  ]
}
