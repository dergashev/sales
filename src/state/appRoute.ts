import {
  OPTION_STAGE_STEPS,
  isOptionStageId,
  type OptionStageId,
  type OptionStepId,
} from './optionLifecycle'

/**
 * THE ROUTE MODEL — the product's destinations, as paths.
 *
 * Accepted 2026-09-06 Design Director audit, "Route model". What it replaces
 * is measurable and was measured: `location.href` did not change once across
 * the entire Project → Option → Configurator journey, `location.search` was
 * empty, `history.length` stayed at 2, and browser Back from deep inside the
 * Configurator undid a document filter. Nothing could be linked, shared,
 * bookmarked or reopened, and the one history entry the product did write
 * belonged to a register three levels below the thing the user thought they
 * were navigating.
 *
 * FOUR RULES, and each of them is a constraint this module enforces rather
 * than a convention a caller is asked to remember:
 *
 * 1. **A path answers three questions** — which project, which Option, which
 *    stage. Nothing else is a destination.
 * 2. **`viewedOptionId` and `mode` never appear.** `viewedOptionId` is
 *    deliberately non-persisted (`store.ts:2117-2133`, test
 *    `store.test.ts:1693-1716`) precisely so a reload cannot resurrect a
 *    stale presentation selection — and a URL IS persistence. `mode` is out
 *    for the same reason: a link that lands a colleague in Kundenansicht is
 *    a link that shows a client an unfinished offer. Neither has an encoder
 *    here, so neither can be added by accident.
 * 3. **The search string is not ours.** The released filter registers
 *    (`projectDocumentsView.ts`, `projectPortfolio.ts`) own their parameters
 *    and push their own history entries; this module changes the PATH and
 *    carries `location.search` through untouched, which is the same
 *    foreign-parameter-preserving contract those registers already keep with
 *    each other. A register that returns to its own destination therefore
 *    finds its filters and its page exactly where it left them.
 * 4. **No router library.** The repository has never had one and the model is
 *    eleven paths; a dependency would be more code, not less.
 */

export type ProjectRouteStage =
  | 'dokumente' | 'verstaendnis' | 'optionen' | 'vergleich'

/**
 * The four stages, plus the three destinations of the Option workspace that
 * are NOT stages of it.
 *
 * `export` is an Option ACTION (the audit's ownership map moves it out of the
 * rail); `einstellungen` and `grundlagen` are utility destinations reachable
 * only from inside an Option workspace, exactly as they were before this
 * ticket. All three still need honest paths, because a URL that says
 * `/pruefen` while the export surface is on screen is the same lie the whole
 * model removes.
 */
export type OptionRouteView =
  | OptionStageId | 'export' | 'einstellungen' | 'grundlagen'

const EXTRA_OPTION_VIEWS: readonly OptionRouteView[] = [
  'export', 'einstellungen', 'grundlagen',
]

export type AppRoute =
  | Readonly<{ kind: 'portfolio' }>
  | Readonly<{ kind: 'project'; projectId: string; stage: ProjectRouteStage }>
  | Readonly<{
    kind: 'option'
    projectId: string
    optionId: string
    view: OptionRouteView
    step: OptionStepId | null
  }>

const PROJECT_STAGES: readonly ProjectRouteStage[] = [
  'dokumente', 'verstaendnis', 'optionen', 'vergleich',
]

function segment(value: string): string {
  return encodeURIComponent(value)
}

/** The path of a route. Always absolute, never with a trailing slash. */
export function routePath(route: AppRoute): string {
  switch (route.kind) {
    case 'portfolio':
      return '/'
    case 'project':
      return `/projekt/${segment(route.projectId)}/${route.stage}`
    case 'option': {
      const base = `/projekt/${segment(route.projectId)}/option/${segment(route.optionId)}`
      return route.step ? `${base}/${route.view}/${route.step}` : `${base}/${route.view}`
    }
  }
}

/**
 * A path back into a route, or `null` when the shape is not one of ours.
 *
 * UNKNOWN IS `null`, NEVER A GUESS. An unresolvable path is answered by the
 * caller — with the portfolio, or with `/optionen` and a stated reason for an
 * Option that does not exist — and never by a blank Configurator, which is
 * the failure mode the audit named explicitly.
 */
export function decodeRoutePath(pathname: string): AppRoute | null {
  const parts = pathname.split('/').filter(Boolean).map((part) => {
    try { return decodeURIComponent(part) } catch { return part }
  })
  if (parts.length === 0) return { kind: 'portfolio' }
  if (parts[0] !== 'projekt' || !parts[1]) return null
  const projectId = parts[1]
  if (parts.length === 3 && PROJECT_STAGES.includes(parts[2] as ProjectRouteStage)) {
    return { kind: 'project', projectId, stage: parts[2] as ProjectRouteStage }
  }
  if (parts[2] !== 'option' || !parts[3] || parts.length < 5) return null
  const optionId = parts[3]
  const view = parts[4]!
  if (EXTRA_OPTION_VIEWS.includes(view as OptionRouteView)) {
    return parts.length === 5
      ? { kind: 'option', projectId, optionId, view: view as OptionRouteView, step: null }
      : null
  }
  if (!isOptionStageId(view)) return null
  if (parts.length === 5) {
    return { kind: 'option', projectId, optionId, view, step: null }
  }
  if (parts.length !== 6) return null
  const step = parts[5]!
  return (OPTION_STAGE_STEPS[view] as readonly string[]).includes(step)
    ? { kind: 'option', projectId, optionId, view, step: step as OptionStepId }
    : null
}

/** Two routes are the same destination exactly when their paths are. */
export function sameRoute(a: AppRoute | null, b: AppRoute | null): boolean {
  if (!a || !b) return a === b
  return routePath(a) === routePath(b)
}

/**
 * The full URL for a route, keeping whatever the registers put in the search.
 *
 * `search` is passed through verbatim (rule 3 above): the Documents register
 * writes `docq`/`doctype`/`docstatus`/`docpage`, the Options register writes
 * `optpage`, the portfolio writes its own, and each one already deletes its
 * parameters when they are at their default. Stripping a foreign parameter
 * here would silently drop the filter a reader is one Back press away from.
 */
export function routeHref(route: AppRoute, search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search
  return query ? `${routePath(route)}?${query}` : routePath(route)
}
