import { useCallback, useEffect, useRef, useState } from 'react'
import {
  decodeRoutePath,
  routeHref,
  routePath,
  type AppRoute,
  type ProjectRouteStage,
} from './appRoute'
import {
  destinationOfNav,
  optionNav,
  type OptionStepId,
} from './optionLifecycle'
import { isClientProjection, pipelineViewForOutputProfile } from './clientProjection'
import { demoProject } from './projectAnalysis'
import { pipelineViewForBuildingGate, useStore, type ProjectStage, type Store } from './store'

/**
 * The store and the address bar, kept in step.
 *
 * Accepted 2026-09-06 IA audit, "Route model". This is the whole router: a
 * derivation from state to a path, a decoder from a path to store actions,
 * and three effects that keep them honest. A library would have been more
 * code and a second navigation model beside the one the store already has.
 *
 * THREE PROPERTIES ARE THE CONTRACT.
 *
 * 1. **The store leads, the URL follows.** Every navigation is still a store
 *    action; this hook only writes the path that action produced. A route
 *    therefore cannot exist that no action can reach.
 * 2. **Back and Forward move between DESTINATIONS.** Only a change of PATH
 *    pushes an entry. The released filter registers write their own entries
 *    on the search string alone and nest underneath untouched, which is why
 *    Back from the Configurator now leaves the Configurator instead of
 *    undoing a document filter three levels below it.
 * 3. **The client projection writes nothing.** `mode` must never enter a URL
 *    (a link that lands a colleague in Kundenansicht is a link that shows a
 *    client an unfinished offer), so while `mode: 'praesentation'` is active
 *    the path is frozen at whatever the internal workspace last wrote.
 *    `viewedOptionId` has no encoder at all, in either direction.
 */

const PROJECT_STAGE_OF_ROUTE: Readonly<Record<string, ProjectStage>> = {
  dokumente: 'documents',
  verstaendnis: 'understanding',
  optionen: 'options',
  vergleich: 'comparison',
}

const ROUTE_OF_PROJECT_STAGE: Readonly<Record<ProjectStage, ProjectRouteStage>> = {
  documents: 'dokumente',
  understanding: 'verstaendnis',
  options: 'optionen',
  comparison: 'vergleich',
}

/** WHERE the store currently is, as a route. `null` when it is nowhere yet. */
export function currentRoute(s: Store): AppRoute | null {
  if (s.level === 'liste') return { kind: 'portfolio' }
  const projectId = s.opportunityId
  if (!projectId) return { kind: 'portfolio' }
  if (s.level === 'opportunity') {
    return {
      kind: 'project',
      projectId,
      stage: ROUTE_OF_PROJECT_STAGE[s.projectStage] ?? 'optionen',
    }
  }
  const optionId = s.activeOptionId
  if (!optionId) return { kind: 'project', projectId, stage: 'optionen' }
  const view = pipelineViewForBuildingGate(
    s, pipelineViewForOutputProfile(s.mode, s.pipelineView),
  )
  if (view === 'export' || view === 'einstellungen' || view === 'grundlagen') {
    return { kind: 'option', projectId, optionId, view, step: null }
  }
  // `vergleich` is no longer reachable as an Option-level view — comparison
  // is a project destination — but a rehydrated payload can still carry it.
  if (view === 'vergleich') return { kind: 'project', projectId, stage: 'vergleich' }
  const destination = destinationOfNav(view, s.openConfiguratorStep)
  return {
    kind: 'option',
    projectId,
    optionId,
    view: destination.stage,
    step: destination.step,
  }
}

export type RouteNotice = 'unknownProject' | 'unknownOption' | null

/**
 * Apply a decoded route to the store, or say why it could not be applied.
 *
 * An unknown project falls back to the portfolio and an unknown Option to
 * that project's `Optionen` — WITH A STATED REASON, never to a blank
 * Configurator. That is the audit's explicit requirement and the reason this
 * returns a notice instead of silently succeeding.
 */
function applyRoute(s: Store, route: AppRoute): RouteNotice {
  if (route.kind === 'portfolio') {
    if (s.level !== 'liste') s.backToList()
    return null
  }
  if (!demoProject(route.projectId)) {
    if (s.level !== 'liste') s.backToList()
    return 'unknownProject'
  }
  if (route.projectId !== s.opportunityId || s.level === 'liste') {
    s.openOpportunity(route.projectId)
  }
  if (route.kind === 'project') {
    if (s.level === 'option') s.backToOpportunity()
    s.setProjectStage(PROJECT_STAGE_OF_ROUTE[route.stage] ?? 'options')
    return null
  }
  if (!s.options.some((option) => option.id === route.optionId)) {
    s.setProjectStage('options')
    return 'unknownOption'
  }
  s.openOption(route.optionId)
  if (route.view === 'export' || route.view === 'einstellungen'
      || route.view === 'grundlagen') {
    s.setPipelineView(route.view)
    return null
  }
  const nav = optionNav({ stage: route.view, step: route.step as OptionStepId | null })
  s.setPipelineView(nav.view)
  if (nav.step) s.openConfiguratorStepAt(nav.step)
  return null
}

export function useAppRouting(): RouteNotice {
  const s = useStore()
  const [notice, setNotice] = useState<RouteNotice>(null)
  const booted = useRef(false)
  const route = currentRoute(s)
  const path = route ? routePath(route) : null
  const client = isClientProjection(s.mode)

  const applyFromLocation = useCallback((store: Store, boot = false) => {
    if (typeof window === 'undefined') return
    const decoded = decodeRoutePath(window.location.pathname)
    /**
     * `/` ON BOOT IS NOT A DESTINATION, it is the absence of one.
     *
     * The store rehydrates from `localStorage`, so a reload with no path in
     * the address bar has a position already and the URL has nothing to say
     * about it. Treating `/` as "go to the portfolio" here would throw that
     * position away on every reload — and, in a suite, would reset a store a
     * case had just driven into an Option. The honest answer is the reverse:
     * the store wins, and the address bar is corrected to say where it is.
     *
     * A `/` the user actually NAVIGATES to is a different thing entirely: it
     * arrives as a store action (`backToList`) and writes its own path.
     */
    if (boot && decoded?.kind === 'portfolio' && store.level !== 'liste') {
      const here = currentRoute(store)
      if (here) {
        window.history.replaceState(null, '', routeHref(here, window.location.search))
      }
      return
    }
    if (!decoded) {
      // An unparseable path is not an error the reader caused; the product
      // simply states where it actually is by rewriting the address.
      const here = currentRoute(store)
      if (here) {
        window.history.replaceState(
          null, '', routeHref(here, window.location.search),
        )
      }
      setNotice(window.location.pathname === '/' ? null : 'unknownProject')
      return
    }
    setNotice(applyRoute(store, decoded))
  }, [])

  // 1 · The address the app was opened at wins, once.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    applyFromLocation(useStore.getState(), true)
  }, [applyFromLocation])

  // 2 · Back and Forward.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => applyFromLocation(useStore.getState())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyFromLocation])

  // 3 · A store navigation writes its path — and only when the PATH changed,
  // so a register that rewrites the search string never pushes twice.
  useEffect(() => {
    if (typeof window === 'undefined' || !booted.current || !path) return
    if (client) return
    if (window.location.pathname === path) return
    window.history.pushState(null, '', `${path}${window.location.search}`)
  }, [path, client])

  return notice
}
