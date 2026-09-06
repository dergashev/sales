import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  completeBuildingScope, completeKgConfiguration, confirmBuildingReviewSections,
  decideAllKgScope, enterOptionWorkspace,
} from '../../test/offer-option'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import {
  __resetStoreForTests, commercialReconciliation, commercialResult,
  kgCatalogueFor, kgChapterProgressFor, kgConfigurationCompleteFor,
  kgScopeDecisionsComplete, useStore,
} from '../../state/store'
import { KG_SCOPE_GROUPS, allServices } from '../../engine/kgConfiguration'

/**
 * VR3-03 — the unified Konfigurator, driven as a user drives it.
 *
 * The domain arithmetic is proved in `src/engine/__tests__/kgConfiguration
 * .test.ts`; this file proves the SURFACE: six explicit decisions with no
 * implicit conclusion, one page anatomy instantiated six times, completion
 * derived from the domain rather than from having visited a chapter, and a
 * rail that explains what moved the number.
 *
 * Every activation here is an ordinary pointer click or a real key press.
 * Nothing uses `force`, `check()` or a direct store write for the act under
 * test — the audit's F-009 was precisely a control that only a forced check
 * could activate, and a suite that forces would never see it again.
 */

const st = () => useStore.getState()

beforeEach(() => __resetStoreForTests())

async function reachLedger(user: ReturnType<typeof userEvent.setup>, project = 'DEMO-COMPLEX-01') {
  render(<App />)
  enterOptionWorkspace(project)
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
      .toBeInTheDocument()
  })
}

const decisionGroups = () =>
  screen.getAllByRole('radiogroup', { name: /^Entscheidung KG/ })

describe('Leistungsabgrenzung — six explicit decisions (T-018–T-020)', () => {
  it('first entry has exactly six UNDECIDED rows and no implicit conclusion', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    const groups = decisionGroups()
    expect(groups).toHaveLength(6)
    for (const group of groups) {
      const radios = within(group).getAllByRole('radio')
      expect(radios).toHaveLength(2)
      // NOTHING is checked. That absence is the state, and it is the one the
      // replaced binary model could not hold.
      expect(radios.some((r) => (r as HTMLInputElement).checked)).toBe(false)
    }
    expect(screen.getAllByText('0 von 6 entschieden').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Entscheidung erforderlich/)).toHaveLength(6)
    expect(kgScopeDecisionsComplete(st())).toBe(false)

    // No cost group is priced, so the offer states an absence rather than a
    // zero (rule 16).
    expect(st().projection().result.total.exact.isZero()).toBe(true)
    // The rail states the ABSENCE of a priced scope, not a zero.
    expect(screen.getAllByText(/Noch keine Kostengruppe im Angebot enthalten/).length)
      .toBeGreaterThan(0)
  })

  it('the continuation is blocked and names how many decisions are missing', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    const confirm = screen.getByRole('button', { name: 'Umfang bestätigen und weiter' })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Noch 6 von 6 Kostengruppen ohne Entscheidung/))
      .toBeInTheDocument()

    // Clicking it does nothing — a blocked action explains itself and stays
    // put, it does not half-advance.
    await user.click(confirm)
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
  })

  it('each row states the consequence of BOTH choices before either is taken', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    const kg200 = decisionGroups()[0]!
    // Both options carry a consequence at all times: the one that costs
    // money states the signed amount, the one that does not states so in
    // words (R-05/OPTION-009 — never on hover).
    expect(within(kg200).getAllByText(/[+−]\s?[\d.]+\s?€|ohne Preiswirkung/).length)
      .toBe(2)
  })

  it('an ordinary pointer click on the label records the decision — no force, no check()', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    for (const group of decisionGroups()) {
      const include = within(group).getAllByRole('radio')[0]!
      await user.click(include)
      expect((include as HTMLInputElement).checked).toBe(true)
    }
    expect(kgScopeDecisionsComplete(st())).toBe(true)
    expect(screen.getAllByText('6 von 6 entschieden').length).toBeGreaterThan(0)
  })

  it('a real key press records the decision as well as a click (RADIO-001)', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    const group = decisionGroups()[0]!
    const [include, exclude] = within(group).getAllByRole('radio') as HTMLInputElement[]
    await user.click(include!)
    include!.focus()
    await user.keyboard('{ArrowRight}')
    expect(exclude!.checked).toBe(true)
    expect(st().kgConfig!.scope.KG_200).toBe('excluded')
  })

  it('an excluded group stays visible as SKIPPED in the journey, never absent', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    for (const [index, group] of decisionGroups().entries()) {
      const radios = within(group).getAllByRole('radio')
      await user.click(radios[index === 2 ? 1 : 0]!)
    }
    expect(st().kgConfig!.scope.KG_400).toBe('excluded')

    expect(screen.getByText('Bewusst ausgeschlossen')).toBeInTheDocument()
    expect(screen.getAllByText(/Nicht im Umfang · übersprungen/).length)
      .toBeGreaterThan(0)
    // And it is still a REACHABLE step of the journey. Since the 2026-09-06
    // IA rebuild the cost groups are steps of KALKULIEREN and render inside
    // that stage — progressive disclosure is the canonical navigator's
    // contract, not a flag — so the journey is walked to get to them, which
    // is exactly what a user does.
    await user.click(screen.getByRole('button', { name: /^Kalkulieren/ }))
    expect(screen.getAllByRole('button', { name: /^KG 400/ }).length)
      .toBeGreaterThan(0)
  })
})

describe('gating (workflow state machine invariants 4 and 5)', () => {
  it('no KG page is configurable before all six decisions exist', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    act(() => { st().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_300_DETAILS) })
    expect(screen.getAllByText(/Erst 0 von 6 Kostengruppen sind entschieden/).length)
      .toBeGreaterThan(0)
    // The gate offers the route that resolves it, never a dead end (rule 12).
    await user.click(screen.getByRole('button', { name: 'Zur Leistungsabgrenzung' }))
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
  })

  it('after 6/6 the first included KG is available and an excluded one explains itself', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().setKgScopeDecision('KG_500', 'excluded') })

    await user.click(screen.getByRole('button', { name: 'Umfang bestätigen und weiter' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /^KG.200 · / }))
        .toBeInTheDocument()
    })

    act(() => { st().openConfiguratorStepAt(CONFIGURATOR_STEP.KG_500_DETAILS) })
    expect(screen.getAllByText(/bewusst ausgeschlossen/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Leistungsabgrenzung öffnen' }))
      .toBeInTheDocument()
  })

  it('Schedule becomes available only when every included KG is complete', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    expect(kgConfigurationCompleteFor(st())).toBe(false)

    completeKgConfiguration()
    expect(kgConfigurationCompleteFor(st())).toBe(true)
    // Terminplan is the last step of Kalkulieren, so it is asserted where a
    // user meets it: inside that stage, unlocked, once every included cost
    // group is complete.
    await user.click(screen.getByRole('button', { name: /^Kalkulieren/ }))
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Terminplan/ }).length)
        .toBeGreaterThan(0)
    })
  })

  it('reopening one scope decision withdraws completion without a second step', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    completeKgConfiguration()
    expect(kgConfigurationCompleteFor(st())).toBe(true)

    act(() => { st().setKgScopeDecision('KG_600', 'undecided') })
    expect(kgConfigurationCompleteFor(st())).toBe(false)
    // Scoped, not global: the other five chapters keep what they earned.
    expect(kgChapterProgressFor(st(), 'KG_300')!.state).toBe('complete')
    expect(kgChapterProgressFor(st(), 'KG_600')!.state).toBe('undecidedScope')
  })
})

describe('the canonical KG page, six times (T-021–T-027)', () => {
  it('renders one anatomy for every cost group; only the domain content differs', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    const titles = new Set<string>()
    for (const group of KG_SCOPE_GROUPS) {
      act(() => { st().openKgChapter(group) })
      // Same anatomy: identity line, one H1 naming the group, a lead, a
      // progress state, service groups with decision rows, the context panel
      // and the forward action.
      const heading = await screen.findByRole('heading', { level: 1, name: new RegExp(`^KG.${group.slice(3)} · `) })
      titles.add(heading.textContent ?? '')
      expect(screen.getByText(new RegExp(`^Konfigurator · KG.${group.slice(3)}$`)))
        .toBeInTheDocument()
      expect(screen.getAllByRole('region', { name: /./ }).length).toBeGreaterThan(0)
      expect(screen.getByText('Kontext')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /Weiter zu|Weiter zum Terminplan/ }).length)
        .toBeGreaterThan(0)
      // Every row carries a service name, a decision control, a state and an
      // amount — the four-part contract, identically, in all six.
      const rows = document.querySelectorAll('.a3-svcr')
      expect(rows.length).toBeGreaterThan(2)
      for (const row of rows) {
        expect(row.querySelector('.a3-svcr-name')?.textContent?.length ?? 0)
          .toBeGreaterThan(2)
        expect(row.querySelector('.a3-svcr-status')).not.toBeNull()
        expect(row.querySelector('.a3-svcr-amount')).not.toBeNull()
      }
    }
    // Six distinct chapters, not one rendered six times by accident.
    expect(titles.size).toBe(6)
  })

  it('an optional service is a single explicit checkbox, activated by a plain click', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_200') })

    const box = (await screen.findAllByRole('checkbox', { name: 'im Angebot' }))[0]!
    expect((box as HTMLInputElement).checked).toBe(true)
    const before = st().projection().result.total.exact
    await user.click(box)
    expect((box as HTMLInputElement).checked).toBe(false)
    expect(st().projection().result.total.exact.lt(before)).toBe(true)
  })

  it('a required decision starts undecided and blocks the chapter until it is answered', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_600') })

    const progress = kgChapterProgressFor(st(), 'KG_600')!
    expect(progress.state).toBe('incomplete')
    expect(screen.getAllByText('Entscheidung offen').length).toBeGreaterThan(0)
    const next = screen.getByRole('button', { name: /Weiter zu/ })
    expect(next).toHaveAttribute('aria-disabled', 'true')

    const open = screen.getAllByRole('radiogroup', { name: /^Entscheidung/ })[0]!
    await user.click(within(open).getAllByRole('radio')[1]!)
    await waitFor(() => {
      expect(kgChapterProgressFor(st(), 'KG_600')!.state).toBe('complete')
    })
  })

  it('a dependency names its upstream service and refuses to price the position', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_700') })

    const qng = await screen.findByRole('radiogroup', { name: /QNG/ })
    await user.click(within(qng).getByRole('radio', { name: 'QNG-PLUS' }))

    expect(screen.getByText(/setzt Energiestandard voraus/)).toBeInTheDocument()
    expect(kgChapterProgressFor(st(), 'KG_700')!.state).toBe('invalid')
    // A blocked position contributes nothing: the total never carries a
    // position the configuration itself refuses.
    expect(commercialResult(st()).contributions
      .some((d) => d.key === 'kg_b-700-qng')).toBe(false)
  })

  it('an invalid quantity keeps the last valid result and says what is wrong', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_200') })

    const before = st().projection().result.total.exact
    // The quantity position of this chapter — addressed by the service it
    // belongs to, not by position in a list.
    const row = [...document.querySelectorAll('.a3-svcr')]
      .find((r) => r.textContent?.includes('Baustraße'))!
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Details öffnen' }))
    const field = await screen.findByRole('textbox', { name: /Menge in/ })
    await user.clear(field)
    await user.type(field, 'zwölf')

    expect(screen.getAllByText(/Bitte eine Zahl eintragen/).length).toBeGreaterThan(0)
    // The prior valid result survives — the total never becomes a guess and
    // never flashes zero.
    expect(st().projection().result.total.exact.toFixed(2)).toBe(before.toFixed(2))
    expect(kgChapterProgressFor(st(), 'KG_200')!.state).toBe('invalid')
  })
})

describe('the commercial rail (T-028, F-001, F-010)', () => {
  it.each([
    ['DEMO-HAPPY-01', '6480000.00', 5],
    ['DEMO-COMPLEX-01', '38740000.00', 6],
  ] as const)('%s reproduces its declared demonstration total and band', async (project, total, pp) => {
    const user = userEvent.setup()
    await reachLedger(user, project)
    completeKgConfiguration()

    const result = commercialResult(st())
    expect(result.total.exact.toFixed(2)).toBe(total)
    expect(result.uncertaintyPp).toBe(pp)
    expect(result.coverage).toBe('total')
    expect(result.basis).toBe('kgConfiguration')
    // Every group's amount matches the catalogue's own declaration.
    const catalogue = kgCatalogueFor(st())!
    for (const line of result.byCostGroup) {
      if (!KG_SCOPE_GROUPS.includes(line.group as never)) continue
      expect(line.exact!.toFixed(2))
        .toBe(Number(catalogue.declaredByCostGroup[line.group as never]).toFixed(2))
    }
  })

  it('the driver-to-total diagnostic passes on the live result', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    completeKgConfiguration()

    const reconciliation = commercialReconciliation(st())
    expect(reconciliation.reconciles).toBe(true)
    expect(reconciliation.contributionsExact.toFixed(2))
      .toBe(reconciliation.totalExact.toFixed(2))
    expect(reconciliation.groupedExact.toFixed(2))
      .toBe(reconciliation.totalExact.toFixed(2))
    expect(reconciliation.contributionCount).toBeGreaterThan(40)
  })

  it('reports what changed, its signed amount and the cost group it belongs to', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_600') })

    const box = (await screen.findAllByRole('checkbox', { name: 'im Angebot' }))[0]!
    await user.click(box)

    const change = commercialResult(st()).lastChange!
    expect(change.labelDe.length).toBeGreaterThan(3)
    expect(change.labelEn.length).toBeGreaterThan(3)
    expect(change.group).toBe('KG_600')
    expect(change.signedExact.isNegative()).toBe(true)
    // And the rail says so, durably — not only for the chip's four seconds.
    // The block cross-fades in (M-07, `AnimatePresence mode="wait"`), so the
    // new label lands one settled frame after the click, never synchronously.
    const rail = screen.getByRole('region', { name: 'Zuletzt geändert' })
    await waitFor(() => expect(rail).toHaveTextContent(change.labelDe))
    expect(rail.textContent).toMatch(/−/)
  })

  it('names the included scope and calls an incomplete result a subtotal', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    const scope = screen.getByRole('region', { name: 'Enthaltener Umfang' })
    expect(scope).toHaveTextContent('6 von 6')
    expect(scope).toHaveTextContent('offene Entscheidungen')
    // R-18 / rule 16: an offer with open decisions is a SUBTOTAL of the
    // priced positions, and it says so rather than implying a total.
    expect(commercialResult(st()).coverage).toBe('subtotal')
    expect(screen.getAllByText(/Zwischensumme/).length).toBeGreaterThan(0)

    completeKgConfiguration()
    await waitFor(() => {
      expect(commercialResult(st()).coverage).toBe('total')
    })
  })

  it('does not animate the total through intermediate values (M-07)', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    // The rail's hero prints the CURRENT rounded display and nothing else:
    // a counted value would put a number on screen that is not the result.
    const shown = () => document.querySelector('.a3-hb-total .a3-hb-num')?.textContent ?? ''
    expect(shown()).toContain(st().projection().result.total.display)
    act(() => { st().setKgScopeDecision('KG_300', 'excluded') })
    expect(shown()).toContain(st().projection().result.total.display)
  })
})

describe('persistence', () => {
  it('a reload keeps the six decisions and every service decision', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    completeKgConfiguration()

    const before = commercialResult(st())
    const catalogue = kgCatalogueFor(st())!
    const decided = allServices(catalogue)
      .filter((svc) => svc.requiresDecision)
      .map((svc) => st().kgConfig!.services[svc.id]!.state)
    expect(decided.every((state) => state === 'notSelected')).toBe(true)

    // The Option's configuration travels with the Option, so switching away
    // and back is the same read path a reload takes.
    const optionId = st().activeOptionId!
    act(() => { st().createOption('Zweite Option') })
    act(() => { st().openOption(optionId) })

    expect(kgConfigurationCompleteFor(st())).toBe(true)
    expect(commercialResult(st()).total.exact.toFixed(2))
      .toBe(before.total.exact.toFixed(2))
  })
})
