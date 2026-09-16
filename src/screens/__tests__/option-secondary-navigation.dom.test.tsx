import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'
import {
  OPTION_STAGE_STEPS,
  destinationOfNav,
} from '../../state/optionLifecycle'
import {
  completeBuildingScope,
  completeKgConfiguration,
  decideAllKgScope,
  enterOptionWorkspace,
} from '../../test/offer-option'

beforeEach(() => {
  __resetStoreForTests()
  window.history.replaceState(null, '', '/')
})

const st = () => useStore.getState()

/**
 * B2 · requirements 15 and 16 — ONE secondary navigator, and All cost details
 * inside Calculate.
 *
 * The audit measured two separate defects with one shape. Calculate had the
 * preferred compact progression while Configure and Validate used unrelated
 * submenu compositions, so three stages of one workflow taught three
 * navigations; and opening the calculation's own complete explanation
 * switched the visible secondary navigation back to Configure, because the
 * destination belonged to no stage at all.
 */

/** The band of segments the current stage draws. */
const progression = () =>
  screen.getByRole('list', { name: /· Kapitel$|· chapters$/ })

const segments = () =>
  within(progression()).getAllByRole('listitem')

const segment = (name: RegExp) =>
  segments().find((li) => new RegExp(name).test(li.textContent ?? ''))

describe('one secondary navigator across Configure, Calculate and Validate', () => {
  it('draws the SAME progression band for all three stages', async () => {
    render(<App />)
    enterOptionWorkspace('DEMO-COMPLEX-01')

    // CONFIGURE — the released build drew a list band here, not this one.
    await waitFor(() => expect(progression()).toBeInTheDocument())
    expect(segments().map((li) => li.textContent)).toHaveLength(2)
    expect(segment(/Gebäude/)).toBeTruthy()
    expect(segment(/Abgrenzung/)).toBeTruthy()

    completeBuildingScope('PER_BUILDING')
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_200') })

    // CALCULATE — nine members in the canonical order.
    await waitFor(() => {
      expect(segments().length).toBe(9)
    })
    expect(segment(/Kostendetails/)).toBeTruthy()

    // VALIDATE — NO band at all (Product Owner, 2026-09-16). The released
    // build drew two segments here, `Prüfung` and `Speichern`, and both
    // resolved to the SAME surface: a progression whose two positions were
    // one place. Checking and saving are one act on the Prüfen stage, so the
    // stage declares no members and the band is absent rather than
    // single-segmented.
    completeKgConfiguration()
    act(() => {
      st().confirmSchedule()
      st().openConfiguratorStepAt('finalValidation')
    })
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: /· Kapitel$|· chapters$/ })).toBeNull()
    })
    expect(OPTION_STAGE_STEPS.pruefen).toEqual([])
  })

  it('names the canonical Calculate order, with All cost details between Responsibility and Schedule', () => {
    expect(OPTION_STAGE_STEPS.kalkulieren).toEqual([
      'kg200', 'kg300', 'kg400', 'kg500', 'kg600', 'kg700',
      'verantwortung', 'alle-kosten', 'terminplan',
    ])
  })

  it('uses ONE state vocabulary: exactly one current member, and every non-default state carries a word', async () => {
    render(<App />)
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_300') })

    await waitFor(() => expect(segments().length).toBe(9))
    // Exactly one `aria-current="step"` in the band — the invariant a
    // seven-value union makes checkable, because `current` is a state and not
    // one of several booleans that could all be set at once.
    const currents = progression().querySelectorAll('[aria-current="step"]')
    expect(currents).toHaveLength(1)
    // Every segment carries its state IN WORDS (rule 8): the accessible name
    // is `<label> · <state>`, never a glyph or a colour alone.
    for (const li of segments()) {
      const control = li.querySelector('button, span[aria-current], .a3-wfn-segstatic')!
      const name = control.getAttribute('aria-label') ?? control.textContent ?? ''
      expect(name.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps an excluded cost group visible and inspectable as out of scope, never as done', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    act(() => {
      // Five in, KG 500 deliberately OUT — a decision, not missing work.
      for (const g of ['KG_200', 'KG_300', 'KG_400', 'KG_600', 'KG_700'] as const) {
        st().setKgScopeDecision(g, 'included')
      }
      st().setKgScopeDecision('KG_500', 'excluded')
      st().openKgChapter('KG_200')
    })

    await waitFor(() => expect(segments().length).toBe(9))
    const kg500 = segment(/KG 500/)!
    // The STATE says it, and so does the word. A tick there would be the
    // fabricated completion the navigation contract forbids (D-016) — which
    // is exactly what the released `state: 'done'` + `outOfScope: true`
    // combination rendered underneath its override.
    expect(kg500).toHaveAttribute('data-state', 'outOfScope')
    const control = within(kg500).getByRole('button')
    expect(control.getAttribute('aria-label')).toMatch(/außerhalb Umfang/)

    // …and it is still INSPECTABLE: the segment routes to the chapter, which
    // explains the exclusion and offers to reopen it.
    await user.click(control)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /^KG.500 · / }))
        .toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Leistungsabgrenzung öffnen/ }))
      .toBeInTheDocument()
  })
})

describe('All cost details is a member of Calculate', () => {
  it('resolves the cost-details view to the Calculate stage rather than to the default', () => {
    // The unit of the defect: a view no stage claimed fell through to
    // Configure. This is the line that used to be missing.
    expect(destinationOfNav('kostendetails', 'kg300Details'))
      .toEqual({ stage: 'kalkulieren', step: 'alle-kosten' })
  })

  it('keeps Calculate current and its progression visible when opened', async () => {
    const user = userEvent.setup()
    render(<App />)
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    act(() => { st().openKgChapter('KG_300') })
    await waitFor(() => expect(segments().length).toBe(9))

    await user.click(segment(/Kostendetails/)!.querySelector('button')!)

    // The page opened…
    await waitFor(() => { expect(st().pipelineView).toBe('kostendetails') })
    // …and the stage rail still says Calculate, with its own progression on
    // screen and `Alle Kostendetails` the current member. Before this ticket
    // the rail switched to Configure here.
    const rail = screen.getByRole('navigation', { name: /Option/ })
    const calculate = within(rail).getByRole('button', { name: /Kalkulieren/ })
    expect(calculate).toHaveAttribute('aria-current', 'step')
    expect(progression()).toBeInTheDocument()
    const current = progression().querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.getAttribute('aria-label')).toMatch(/Alle Kostendetails/)
  })

  it('writes the Calculate address, and still resolves the older cost-details URL', async () => {
    render(<App />)
    enterOptionWorkspace('DEMO-COMPLEX-01')
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    act(() => { st().setPipelineView('kostendetails') })

    // The URL says what the rail says (requirement 16).
    await waitFor(() => {
      expect(window.location.pathname).toMatch(/kalkulieren\/alle-kosten$/)
    })

    // …and the older `/kostendetails` spelling still resolves, so a bookmark
    // saved before this ticket lands on the page rather than nowhere.
    const older = window.location.pathname.replace(
      /kalkulieren\/alle-kosten$/, 'kostendetails',
    )
    // Leave the page first, so arriving back is a real navigation and not a
    // no-op that would pass whatever the route decoder did.
    act(() => { st().setPipelineView('konfigurator') })
    expect(st().pipelineView).toBe('konfigurator')
    act(() => {
      window.history.pushState(null, '', older)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => { expect(st().pipelineView).toBe('kostendetails') })
  })
})
