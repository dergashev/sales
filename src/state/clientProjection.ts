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
