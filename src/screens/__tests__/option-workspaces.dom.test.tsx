import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'
import { OPTIONS_PAGE_SIZE } from '../../state/projectOptionsView'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'

/**
 * TWO WORKSPACES, ONE SEAM — the journeys, the rails and the address bar.
 *
 * Accepted 2026-09-06 Project → Option → Configurator IA audit. Each case
 * here is one of that audit's acceptance criteria, driven the way a user
 * drives it, because every one of them was measured FAILING in a live
 * browser first: the collection had no destination, the active Option was
 * invisible, `Öffnen` did not say where it led, both rails narrated the
 * whole journey with four permanently dead labels between them, and
 * `location.href` did not change once across the entire journey.
 */

const st = () => useStore.getState()

function optionsSurface(): HTMLElement {
  return document.querySelector('.a3-options') as HTMLElement
}

/** Reach `/optionen` with one Option, the way the product reaches it. */
function oneOption() {
  enterOptionWorkspace('DEMO-HAPPY-01')
  act(() => { st().openOptionsStage() })
}

describe('the Options collection is the home of every Option', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('AC-10: the active Option is marked, and the marker reads activeOptionId', () => {
    render(<App />)
    oneOption()
    act(() => { st().createOption() })
    const rows = optionsSurface().querySelectorAll('.a3-optrow')
    expect(rows).toHaveLength(2)
    const active = optionsSurface().querySelectorAll('[aria-current="page"]')
    expect(active).toHaveLength(1)
    expect(active[0]).toHaveAttribute('data-option-id', st().activeOptionId!)
    expect(active[0]).toHaveTextContent('Aktiv')
  })

  it('AC-11: every Open button names its destination, and it is the one openOption takes', async () => {
    const user = userEvent.setup()
    render(<App />)
    oneOption()
    const open = within(optionsSurface())
      .getByRole('button', { name: 'Öffnen · Gebäude & Umfang' })
    await user.click(open)
    expect(st().level).toBe('option')
    expect(st().pipelineView).toBe('buildingScope')
  })

  it('AC-13/AC-14: no dash comparison, and the missing price is not the loudest thing', () => {
    render(<App />)
    oneOption()
    act(() => { st().createOption() })
    const surface = optionsSurface()
    // The em-dash comparison row the audit measured on every Option 2+ is
    // gone: a difference is suppressed until both sides have a value.
    expect(surface.textContent).not.toContain('Unterschied zu')
    /**
     * `Preis nicht ermittelt` is a quiet secondary line, not the metric.
     *
     * B2 moved the card's headline onto the ONE shared commercial projection
     * (`OptionMetricSummary`), so the assertion now reads that summary's own
     * state instead of the retired `.a3-optrow-amount`/`.a3-optrow-pending`
     * pair. The behaviour under test is unchanged and is now stated by the
     * data rather than inferred from which of two elements exists: a fresh
     * Option has no calculated position, so the summary declares
     * `data-price="notDetermined"`, prints the rule-16 phrase, and — because
     * a rate over an absent numerator is not a rate — publishes no metric
     * row at all.
     */
    const summary = surface.querySelector('.a3-oms')!
    expect(summary).toHaveAttribute('data-price', 'notDetermined')
    expect(summary.querySelector('.a3-oms-total-value'))
      .toHaveTextContent('Preis nicht ermittelt')
    expect(summary.querySelectorAll('[data-metric]')).toHaveLength(0)
  })

  it('AC-15: 11 Options paginate, and an invalid page cannot reach the DOM', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/?optpage=99')
    render(<App />)
    oneOption()
    act(() => { for (let i = 0; i < 10; i += 1) st().createOption() })
    expect(st().options).toHaveLength(11)

    const pager = screen.getByRole('navigation', { name: 'Optionsseiten' })
    expect(pager).toBeInTheDocument()
    // `?optpage=99` on an 11-Option collection renders page 2, not page 99
    // and not an empty page: the clamp is the register's own contract.
    expect(optionsSurface().querySelectorAll('.a3-optrow')).toHaveLength(1)
    await user.click(within(pager).getByRole('button', { name: 'Seite 1' }))
    expect(optionsSurface().querySelectorAll('.a3-optrow'))
      .toHaveLength(OPTIONS_PAGE_SIZE)
    expect(window.location.search).toBe('')
  })

  it('AC-34: the card states the baseline it inherited', () => {
    render(<App />)
    oneOption()
    expect(optionsSurface().textContent).toContain('aus der Projektgrundlage vom')
  })
})

describe('the journeys', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('AC-16: creating the first Option lands in the collection and does not start configuring', () => {
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    act(() => { st().openOptionsStage() })
    expect(st().projectStage).toBe('options')
    expect(st().level).toBe('opportunity')
    // The Option exists, is active and is marked — and nothing opened it.
    expect(optionsSurface().querySelector('[aria-current="page"]')).not.toBeNull()
  })

  it('AC-17: a further Option keeps the user here, announces the change and takes focus', async () => {
    render(<App />)
    oneOption()
    act(() => { st().createOption() })
    await waitFor(() => {
      const live = document.querySelector('[role="status"][aria-live="polite"]')!
      expect(live.textContent).toContain('als aktive Option gewählt')
    })
    expect(st().projectStage).toBe('options')
    const focused = document.activeElement as HTMLElement
    expect(focused).toHaveAttribute('data-option-id', st().activeOptionId!)
  })

  it('AC-18: a returning user with Options lands on the collection, not on create', () => {
    render(<App />)
    oneOption()
    act(() => { st().backToList() })
    act(() => { st().openOpportunity('DEMO-HAPPY-01') })
    expect(st().projectStage).toBe('options')
    // The collection itself is the answer: the Option is listed, with its
    // own row naming where it stands.
    expect(optionsSurface().querySelector('[data-option-id]')).not.toBeNull()
  })

  it('AC-19: Alle Optionen returns to the collection from inside the Option', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    expect(st().level).toBe('option')
    await user.click(screen.getByRole('button', { name: 'Alle Optionen' }))
    expect(st().level).toBe('opportunity')
    expect(st().projectStage).toBe('options')
    // The Option just left is still the active one, so the reader's place in
    // the collection is not lost.
    expect(st().activeOptionId).toBe('OPT-01')
  })

  it('AC-20: the switcher shows each Option state before the choice is made', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    act(() => { st().createOption() })
    act(() => { st().openOption('OPT-01') })
    await user.click(screen.getByRole('button', { name: /Option wechseln/ }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
    expect(menu.textContent).toContain('Neu')
  })
})

describe('the rails', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('AC-2: exactly one workflow rail is mounted, on either tier', () => {
    render(<App />)
    oneOption()
    expect(screen.getAllByRole('navigation', { name: 'Projektablauf' })).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Optionsablauf' })).toBeNull()

    act(() => { st().openOption('OPT-01') })
    expect(screen.getAllByRole('navigation', { name: 'Optionsablauf' })).toHaveLength(1)
    expect(screen.queryByRole('navigation', { name: 'Projektablauf' })).toBeNull()
  })

  it('AC-1/AC-4/AC-5: the Option rail is four Option-scoped stages, none of them constant', () => {
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    const rail = () => screen.getByRole('navigation', { name: 'Optionsablauf' })
    expect(rail().querySelectorAll('.a3-wfn-stage')).toHaveLength(4)
    for (const stage of ['Konfigurieren', 'Kalkulieren', 'Prüfen', 'Präsentieren']) {
      expect(within(rail()).getByText(stage)).toBeInTheDocument()
    }
    // AC-1: `Option anlegen` is not a stage of any rail.
    expect(within(rail()).queryByText('Option anlegen')).toBeNull()
    // AC-5: no project-scoped stage appears here.
    expect(within(rail()).queryByText('Dokumente')).toBeNull()
    expect(within(rail()).queryByText('Projekt-Checkliste')).toBeNull()
    // AC-8: exactly one current stage, and at most one current nested step.
    expect(rail().querySelectorAll('.a3-wfn-stage > [aria-current="step"]'))
      .toHaveLength(1)
    // VR3-KG-UNIFY-00: the Kalkulieren members render as the compact chapter
    // progression (`.a3-wfn-prog`); the released list (`.a3-wfn-sub`) is what
    // a stage without an ordered sequence still uses. Either way, one current.
    expect(rail().querySelectorAll('.a3-wfn-sub [aria-current="step"], .a3-wfn-prog [aria-current="step"]').length)
      .toBeLessThanOrEqual(1)

    // AC-4: every one of the four can become current. Each is reached by
    // satisfying its own gate and then USING THE RAIL — which is the only
    // proof that none of them is the hardcoded constant the project rail
    // used to carry, and that each is genuinely selectable once open.
    const current = () => rail().querySelector('.a3-wfn-current .a3-wfn-label')!.textContent
    const select = (label: string) => {
      const button = within(rail()).getByText(label).closest('button')
      if (!button) throw new Error(`stage «${label}» is not selectable`)
      act(() => { button.click() })
    }
    expect(current()).toBe('Konfigurieren')

    completeBuildingScope('SHARED')
    completeKgConfiguration()
    select('Kalkulieren')
    expect(current()).toBe('Kalkulieren')

    saveOptionBaseline()
    select('Prüfen')
    expect(current()).toBe('Prüfen')

    select('Präsentieren')
    expect(current()).toBe('Präsentieren')
  })

  it('AC-4 regression: no rail renders a stage whose state cannot change', () => {
    /**
     * The measured defect: `Kalkulieren`, `Prüfen`, `Präsentieren` and the
     * nested `Leistungsabgrenzung` were literal `'upcoming'` in the project
     * rail's source, at a tier that owns none of their data. A source scan
     * is the right guard for it — a hardcoded state is invisible from the
     * outside until the day someone waits for it to advance.
     */
    const text = readFileSync(
      path.resolve(__dirname, '..', '..', 'components', 'WorkflowSpine.tsx'), 'utf8',
    )
    const constants = [...text.matchAll(/state:\s*'(current|done|upcoming|locked)'/g)]
    expect(constants.map((match) => match[0])).toEqual([])
  })
})

describe('the address bar', () => {
  beforeEach(() => { __resetStoreForTests() })

  it('AC-21: a deep Option URL restores the same project, Option and stage', () => {
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    expect(window.location.pathname)
      .toBe('/projekt/DEMO-HAPPY-01/option/OPT-01/konfigurieren/leistungsabgrenzung')
    const deep = window.location.pathname
    const optionId = st().activeOptionId

    /**
     * Opened fresh: the document is unmounted and the app is booted again at
     * the copied address, with the store back at the portfolio — exactly
     * what a colleague following the link gets, since `options` survive a
     * reload through `localStorage` while `level`/`pipelineView` do not.
     */
    cleanup()
    act(() => { st().backToList() })
    window.history.replaceState(null, '', deep)
    render(<App />)
    expect(st().opportunityId).toBe('DEMO-HAPPY-01')
    expect(st().activeOptionId).toBe(optionId)
    expect(st().level).toBe('option')
    expect(st().pipelineView).toBe('konfigurator')
    expect(st().openConfiguratorStep).toBe('scopeBoundaries')
  })

  it('AC-22: Back moves between destinations, not between filter states', () => {
    render(<App />)
    oneOption()
    const collection = window.location.pathname
    act(() => { st().openOption('OPT-01') })
    expect(window.location.pathname).not.toBe(collection)
    act(() => { window.history.back() })
    return waitFor(() => {
      expect(window.location.pathname).toBe(collection)
      expect(st().level).toBe('opportunity')
    })
  })

  it('AC-23/AC-25: presenting another Option changes neither activeOptionId nor the URL', () => {
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    saveOptionBaseline()
    const before = window.location.href
    act(() => { st().setMode('praesentation') })
    act(() => { st().setViewedOption('OPT-01') })
    expect(st().activeOptionId).toBe('OPT-01')
    expect(window.location.href).toBe(before)
    expect(window.location.href).not.toMatch(/viewed|mode|praesentation/i)
  })

  /**
   * AC-24, from BOTH store states — and the second one is the one that
   * matters.
   *
   * The first version of this case called `backToList()` before replacing the
   * URL, so it only ever exercised a cleared store, where the implementation
   * was already correct. The Acceptance Auditor found the other half live:
   * the store PERSISTS `level: 'option'` for anyone whose last position was
   * inside an Option — exactly the population that copies a URL and reopens
   * it later — and on that path a stale link silently rewrote the address to
   * the ACTIVE Option's Configurator with no reason anywhere. A stale link
   * answering with the wrong Option is the single thing this route model
   * exists to prevent.
   *
   * So the case asserts the ROUTE and the NOTICE and WHICH RAIL is mounted,
   * from both starting states, rather than the store alone.
   */
  const STALE = '/projekt/DEMO-HAPPY-01/option/OPT-99/kalkulieren/kg300'

  async function expectStaleLinkIsAnswered() {
    await waitFor(() => {
      const notices = screen.getAllByRole('status').map((node) => node.textContent ?? '')
      expect(notices.join(' '))
        .toMatch(/Diese Option gibt es in diesem Projekt nicht/)
    })
    expect(window.location.pathname).toBe('/projekt/DEMO-HAPPY-01/optionen')
    expect(st().level).toBe('opportunity')
    expect(st().projectStage).toBe('options')
    // The project rail is what a reader of the collection gets; the Option
    // workspace must not still be mounted underneath the notice.
    expect(screen.getByRole('navigation', { name: 'Projektablauf' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Optionsablauf' })).toBeNull()
  }

  it('AC-24: an unknown Option resolves to the collection with a stated reason', async () => {
    render(<App />)
    oneOption()
    cleanup()
    act(() => { st().backToList() })
    window.history.replaceState(null, '', STALE)
    render(<App />)
    await expectStaleLinkIsAnswered()
  })

  it('AC-24: …including when the store is still inside another Option', async () => {
    render(<App />)
    enterOptionWorkspace('DEMO-HAPPY-01')
    expect(st().level).toBe('option')
    const active = st().activeOptionId
    cleanup()
    // No `backToList()`: the store keeps `level: 'option'`, which is what a
    // reload of a persisted session looks like.
    window.history.replaceState(null, '', STALE)
    render(<App />)
    await expectStaleLinkIsAnswered()
    // The Option the reader was in is untouched and still marked, so the
    // refusal costs them nothing.
    expect(st().activeOptionId).toBe(active)
    expect(window.location.pathname).not.toContain(`/option/${active}`)
  })
})
