import { describe, expect, it } from 'vitest'
import {
  decodeRoutePath,
  routeHref,
  routePath,
  sameRoute,
  type AppRoute,
} from '../appRoute'

/**
 * The route model, as arithmetic.
 *
 * Every rule the accepted 2026-09-06 IA audit states about the URL is either
 * a property of these two functions or it is a promise nobody checks:
 *
 * - a path answers WHICH PROJECT, WHICH OPTION, WHICH STAGE, and round-trips;
 * - `viewedOptionId` and `mode` have no encoder in either direction, so
 *   neither can reach the address bar by accident;
 * - an unknown shape decodes to `null`, never to a plausible guess — the
 *   caller answers it with a stated reason, and a blank Configurator is the
 *   one outcome the audit forbids outright;
 * - the search string belongs to the released filter registers and passes
 *   through untouched.
 */

const ROUTES: AppRoute[] = [
  { kind: 'portfolio' },
  { kind: 'project', projectId: 'DEMO-HAPPY-01', stage: 'dokumente' },
  { kind: 'project', projectId: 'DEMO-HAPPY-01', stage: 'verstaendnis' },
  { kind: 'project', projectId: 'DEMO-HAPPY-01', stage: 'optionen' },
  { kind: 'project', projectId: 'DEMO-COMPLEX-01', stage: 'vergleich' },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-01',
    view: 'konfigurieren',
    step: 'gebaeude-umfang',
  },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-02',
    view: 'konfigurieren',
    step: 'leistungsabgrenzung',
  },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-02',
    view: 'kalkulieren',
    step: 'kg400',
  },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-02',
    view: 'kalkulieren',
    step: 'terminplan',
  },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-03',
    view: 'pruefen',
    step: 'speichern',
  },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-03',
    view: 'praesentieren',
    step: null,
  },
  {
    kind: 'option',
    projectId: 'DEMO-HAPPY-01',
    optionId: 'OPT-03',
    view: 'export',
    step: null,
  },
]

describe('the route model round-trips every destination', () => {
  for (const route of ROUTES) {
    it(routePath(route), () => {
      expect(decodeRoutePath(routePath(route))).toEqual(route)
      expect(sameRoute(decodeRoutePath(routePath(route)), route)).toBe(true)
    })
  }

  it('names the project, the Option and the stage in the path itself', () => {
    expect(routePath({
      kind: 'option',
      projectId: 'DEMO-HAPPY-01',
      optionId: 'OPT-02',
      view: 'kalkulieren',
      step: 'kg300',
    })).toBe('/projekt/DEMO-HAPPY-01/option/OPT-02/kalkulieren/kg300')
  })
})

describe('what the URL refuses to carry', () => {
  it('has no encoder for the presented Option or the output mode', () => {
    // `viewedOptionId` is deliberately non-persisted so a reload cannot
    // resurrect a stale presentation selection — and a URL is persistence.
    // `mode` is out for the same reason: a link that lands a colleague in
    // Kundenansicht is a link that shows a client an unfinished offer.
    const encoded = ROUTES.map((route) => routeHref(route, '')).join(' ')
    expect(encoded).not.toMatch(/viewed/i)
    expect(encoded).not.toMatch(/mode|praesentation|intern/i)
  })

  it('decodes an unknown shape to null rather than to a plausible guess', () => {
    for (const path of [
      '/projekt',
      '/projekt/DEMO-HAPPY-01',
      '/projekt/DEMO-HAPPY-01/unbekannt',
      '/projekt/DEMO-HAPPY-01/option',
      '/projekt/DEMO-HAPPY-01/option/OPT-01',
      '/projekt/DEMO-HAPPY-01/option/OPT-01/konfigurieren/kg300',
      '/projekt/DEMO-HAPPY-01/option/OPT-01/kalkulieren/gebaeude-umfang',
      '/projekt/DEMO-HAPPY-01/option/OPT-01/praesentieren/kg300',
      '/projekt/DEMO-HAPPY-01/option/OPT-01/export/kg300',
      '/etwas/anderes',
    ]) {
      expect(decodeRoutePath(path), path).toBeNull()
    }
  })
})

describe('the search string is not ours', () => {
  it('carries every register parameter through a path change untouched', () => {
    const search = '?docq=Bau&docpage=3&optpage=2&fremd=1'
    expect(routeHref({ kind: 'project', projectId: 'P', stage: 'optionen' }, search))
      .toBe('/projekt/P/optionen?docq=Bau&docpage=3&optpage=2&fremd=1')
  })

  it('writes no query at all when there is none', () => {
    expect(routeHref({ kind: 'portfolio' }, '')).toBe('/')
  })
})
