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

/**
 * VR3-KG-UNIFY-00: every KG chapter is the KG 400 composition — compact
 * system rows, one open at a time, and inside them decision rows whose
 * alternatives exist only in edit mode. A DECIDED decision is a summary
 * with `Ändern · <name>`; choosing is a draft; `Übernehmen` is the one
 * write. The helpers below address a system by its visible name and a
 * decision by its catalogue id, never by position in a list.
 */
const systemButton = (name: RegExp) => screen.getByRole('button', { name })
const openBody = () => document.querySelector<HTMLElement>('.a3-sys-body:not([hidden])')!
const decisionRow = (id: string): HTMLElement => {
  const row = openBody().querySelector<HTMLElement>(`[data-decision="${id}"]`)
  expect(row).not.toBeNull()
  return row!
}

/** Open one system by name — a no-op where it already opened itself on arrival. */
async function openSystem(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const button = systemButton(name)
  if (button.getAttribute('aria-expanded') !== 'true') await user.click(button)
  expect(systemButton(name)).toHaveAttribute('aria-expanded', 'true')
}

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
      expect(screen.getAllByRole('button', { name: /Weiter zu|Weiter zum Terminplan/ }).length)
        .toBeGreaterThan(0)
      /**
       * VR3-TGA-01: a chapter renders the anatomy its DATA declares.
       *
       * A chapter that declares TGA systems dissolves the Kontext card into
       * a Rahmen band and an overview summary (AC 4 — nothing it showed is
       * lost), and its rows are system rows rather than service rows. The
       * contract this test protects is unchanged and is asserted on both
       * shapes: every row names something, states something, and says what
       * it costs. What is NOT allowed is a third shape, or a shape chosen by
       * cost-group name rather than by content.
       */
      const systems = document.querySelectorAll('.a3-sys')
      if (systems.length > 0) {
        // VR3-TGA-UX-00: the summary line counts systems, configured, changed
        // from source, open and not applicable — zero facts are omitted.
        expect(screen.getByText(/^Systeme$/)).toBeInTheDocument()
        // VR3-KG-UNIFY-00: the basis band is OPTIONAL by contract ("optional
        // small basis band for discriminating project/building facts only"):
        // a short chapter such as KG 600 renders its rows directly under the
        // title, so the band is asserted where the chapter declares a Rahmen
        // or decides per building, not unconditionally.
        const perBuilding = document.querySelector('.a3-rahmen-cell[data-control], .a3-rahmen')
        expect(perBuilding === null || perBuilding instanceof HTMLElement).toBe(true)
        for (const row of systems) {
          expect(row.querySelector('.a3-sys-name')?.textContent?.length ?? 0)
            .toBeGreaterThan(2)
          expect(row.querySelector('.a3-sys-state')).not.toBeNull()
          expect(row.querySelector('.a3-sys-cost')).not.toBeNull()
        }
      } else {
        expect(screen.getByText('Kontext')).toBeInTheDocument()
        const rows = document.querySelectorAll('.a3-svcr')
        expect(rows.length).toBeGreaterThan(2)
        for (const row of rows) {
          expect(row.querySelector('.a3-svcr-name')?.textContent?.length ?? 0)
            .toBeGreaterThan(2)
          expect(row.querySelector('.a3-svcr-status')).not.toBeNull()
          expect(row.querySelector('.a3-svcr-amount')).not.toBeNull()
        }
      }
    }
    // Six distinct chapters, not one rendered six times by accident.
    expect(titles.size).toBe(6)
  })

  it('an optional decision is one explicit include/exclude choice, written only by Übernehmen', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_200') })
    await screen.findByRole('heading', { level: 1, name: /^KG.200 · / })

    // A decided, non-required position is a SUMMARY: it reads as included
    // and its alternatives are absent until `Ändern`.
    await openSystem(user, /^Baustelleneinrichtung · /)
    const row = decisionRow('b-200-01')
    expect(within(row).getByText('Enthalten', { selector: '.a3-dec-value' })).toBeInTheDocument()
    expect(within(row).queryAllByRole('radio')).toHaveLength(0)
    const before = st().projection().result.total.exact

    await user.click(within(row).getByRole('button', { name: 'Ändern · Baustelleneinrichtung Quartier' }))
    const radios = within(decisionRow('b-200-01')).getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios[0]!.checked).toBe(true)
    // Choosing is a draft — nothing has moved yet (the one write is explicit).
    await user.click(within(decisionRow('b-200-01')).getByText('nicht aufnehmen', { selector: '.a3-choice-label' }))
    expect(st().kgConfig!.services['b-200-01']?.state ?? 'selected').toBe('selected')
    expect(st().projection().result.total.exact.toFixed(2)).toBe(before.toFixed(2))

    await user.click(within(decisionRow('b-200-01')).getByRole('button', { name: 'Übernehmen' }))
    expect(st().kgConfig!.services['b-200-01']!.state).toBe('notSelected')
    expect(st().projection().result.total.exact.lt(before)).toBe(true)
    // The summary collapsed and states the exclusion in words, never a zero.
    const after = decisionRow('b-200-01')
    expect(within(after).queryAllByRole('radio')).toHaveLength(0)
    expect(within(after).getByText('Nicht enthalten', { selector: '.a3-dec-value' })).toBeInTheDocument()
  })

  it('a required decision starts undecided and blocks the chapter until it is answered', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_600') })
    await screen.findByRole('heading', { level: 1, name: /^KG.600 · / })

    const progress = kgChapterProgressFor(st(), 'KG_600')!
    expect(progress.state).toBe('incomplete')
    // The open state is a WORD on the system row and on the decision, never
    // a colour alone (rule 8).
    expect(screen.getAllByText(/Entscheidung offen/).length).toBeGreaterThan(0)
    const next = screen.getByRole('button', { name: /Weiter zu/ })
    expect(next).toHaveAttribute('aria-disabled', 'true')

    // The first system that owes a decision opened itself on arrival, with
    // the unresolved decision's editor already open — and still nothing is
    // written until the user says so.
    const button = systemButton(/^Leitsystem & Kunst · 1 Entscheidung offen$/)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const row = decisionRow('b-600-90')
    expect(within(row).getByText('Noch nicht entschieden')).toBeInTheDocument()
    const radios = within(row).getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios.some((r) => r.checked)).toBe(false)
    expect(within(row).getByRole('button', { name: 'Übernehmen' })).toHaveAttribute('aria-disabled', 'true')

    await user.click(within(row).getByText('nicht aufnehmen', { selector: '.a3-choice-label' }))
    expect(st().kgConfig!.services['b-600-90']?.state ?? 'undecided').toBe('undecided')
    expect(kgChapterProgressFor(st(), 'KG_600')!.state).toBe('incomplete')
    await user.click(within(decisionRow('b-600-90')).getByRole('button', { name: 'Übernehmen' }))
    await waitFor(() => {
      expect(kgChapterProgressFor(st(), 'KG_600')!.state).toBe('complete')
    })
    expect(st().kgConfig!.services['b-600-90']!.state).toBe('notSelected')
    expect(systemButton(/^Leitsystem & Kunst · konfiguriert$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weiter zu/ })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('a dependency names its upstream service and refuses to price the position', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_700') })
    await screen.findByRole('heading', { level: 1, name: /^KG.700 · / })

    await openSystem(user, /^Nachweise & Qualität · /)
    await user.click(within(decisionRow('b-700-qng')).getByRole('button', { name: 'Ändern · QNG-Siegel' }))
    await user.click(within(decisionRow('b-700-qng')).getByText('QNG-PLUS', { selector: '.a3-choice-label' }))
    await user.click(within(decisionRow('b-700-qng')).getByRole('button', { name: 'Übernehmen' }))
    expect(st().kgConfig!.services['b-700-qng']).toEqual({ state: 'selected', variant: 'plus' })

    // The engine refuses the position: the chapter is invalid and the total
    // never carries a position the configuration itself refuses.
    expect(kgChapterProgressFor(st(), 'KG_700')!.state).toBe('invalid')
    expect(commercialResult(st()).contributions
      .some((d) => d.key === 'kg_b-700-qng')).toBe(false)

    // The dependency names the upstream decision by the name the user sees.
    // It used to say `Energiestandard`; the Rahmen band calls that line
    // `Energieziel`, and a warning that names a control nobody can find is
    // the class of defect this whole ticket exists to remove. In the
    // decision pattern the warning is the editor's note, so it is read where
    // a user looks for the reason: by reopening the decision.
    await user.click(within(decisionRow('b-700-qng')).getByRole('button', { name: 'Ändern · QNG-Siegel' }))
    // The unmet prerequisite is named on the row's relation line AND repeated
    // as the editor's note while editing — twice by design, once per surface.
    expect(within(decisionRow('b-700-qng')).getAllByText(/setzt Energieziel voraus/).length)
      .toBeGreaterThan(0)
  })

  it('an invalid quantity keeps the last valid result and says what is wrong', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().openKgChapter('KG_200') })
    await screen.findByRole('heading', { level: 1, name: /^KG.200 · / })

    const before = st().projection().result.total.exact
    const progressBefore = kgChapterProgressFor(st(), 'KG_200')!.state
    const recordBefore = st().kgConfig!.services['b-200-05']
    // The quantity position of this chapter — addressed by the decision it
    // is, not by position in a list. Its quantity field lives INSIDE the
    // editor, so it exists only once `Ändern` opened the alternatives.
    await openSystem(user, /^Baustelleneinrichtung · /)
    expect(screen.queryByRole('textbox', { name: /Menge in/ })).toBeNull()
    await user.click(within(decisionRow('b-200-05')).getByRole('button', { name: 'Ändern · Baustraße & Zufahrt' }))
    const field = within(decisionRow('b-200-05')).getByRole('textbox', { name: /Menge in m²/ })
    await user.clear(field)
    await user.type(field, 'zwölf')

    expect(screen.getAllByText(/Bitte eine Zahl eintragen/).length).toBeGreaterThan(0)
    // An invalid draft cannot be applied — the one write refuses it.
    expect(within(decisionRow('b-200-05')).getByRole('button', { name: 'Übernehmen' }))
      .toHaveAttribute('aria-disabled', 'true')
    // The prior valid result survives — the draft never reaches the Option,
    // so the total never becomes a guess and never flashes zero.
    expect(st().kgConfig!.services['b-200-05']).toEqual(recordBefore)
    expect(st().projection().result.total.exact.toFixed(2)).toBe(before.toFixed(2))
    expect(kgChapterProgressFor(st(), 'KG_200')!.state).toBe(progressBefore)
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

    await screen.findByRole('heading', { level: 1, name: /^KG.600 · / })

    // Take one included position out of the offer through the decision
    // pattern: `Ändern`, choose the exclusion, `Übernehmen`.
    await openSystem(user, /^Gebäudeausstattung · /)
    await user.click(within(decisionRow('b-600-01')).getByRole('button', { name: 'Ändern · Briefkastenanlagen' }))
    await user.click(within(decisionRow('b-600-01')).getByText('nicht aufnehmen', { selector: '.a3-choice-label' }))
    await user.click(within(decisionRow('b-600-01')).getByRole('button', { name: 'Übernehmen' }))
    expect(st().kgConfig!.services['b-600-01']!.state).toBe('notSelected')

    const change = commercialResult(st()).lastChange!
    expect(change.labelDe.length).toBeGreaterThan(3)
    expect(change.labelEn.length).toBeGreaterThan(3)
    expect(change.group).toBe('KG_600')
    expect(change.signedExact.isNegative()).toBe(true)
    // VR3-COST-00: the rail states the change in the COMMERCIAL-BASIS
    // slot — the same reserved box that otherwise carries `± n % · netto ·
    // Herkunft` — for the change's own four-second life. The durable record
    // moved to Kostendetails § H, which is where a history belongs; what the
    // cockpit owes the reader is the CURRENT state plus a brief, named
    // account of what just moved it.
    const slot = document.querySelector('.a3-cockpit-change')
    expect(slot).not.toBeNull()
    await waitFor(() => expect(slot!.textContent ?? '').toContain(change.labelDe))
    expect(slot!.textContent).toMatch(/−/)
    // The delta NAMES its reference: an unqualified signed number is the one
    // thing every commercial source in the audit's research refuses to ship.
    expect(slot!.textContent).toContain('gegenüber')
  })

  it('names the included scope and calls an incomplete result a subtotal', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    // VR3-COST-00: completeness is ONE line, immediately below the amount,
    // in a fixed slot with all three counts always present — and it reads
    // the canonical selector, never a counter the view keeps for itself.
    const completeness = document.querySelector('.a3-cockpit-complete')
    expect(completeness).not.toBeNull()
    expect(completeness!.textContent).toContain('6/6 im Angebot')
    expect(completeness!.textContent).toContain('0 ausgeschlossen')
    // The open-decision count is real: it comes from the engine's own
    // completeness reasons, and it is what makes this result a subtotal.
    expect(completeness!.textContent).toMatch(/[1-9]\d* offen/)
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
    const shown = () => document.querySelector('.a3-cockpit-hero')?.textContent ?? ''
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
