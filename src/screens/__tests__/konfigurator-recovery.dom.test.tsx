import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  completeBuildingScope, confirmBuildingReviewSections, decideAllKgScope,
  enterOptionWorkspace,
} from '../../test/offer-option'
import {
  __resetStoreForTests, commercialResult, clientProjectionValidFor,
  kgScopeDecisionsComplete, useStore,
} from '../../state/store'
import { KG_SCOPE_GROUPS } from '../../engine/kgConfiguration'
import { NNBSP } from '../../engine/money'
import Decimal from 'decimal.js'

/**
 * The ledger names a cost group with the NARROW NO-BREAK SPACE rule 7
 * requires (`KG\u202f500`), so a query written with an ordinary space
 * matches nothing. Naming the helper is cheaper than five regexes that each
 * look correct and each silently fail.
 */
const kgDecision = (group: string) =>
  new RegExp(`KG${NNBSP}${group.slice(3)}\\b`)

/**
 * VR3-03R — the four gaps the audit register still held open.
 *
 * VR3-03 delivered the six-decision ledger, the six peer KG pages and the
 * one page grammar; replaying the register against the merged candidate
 * confirmed those live. What it did NOT deliver were the four contracts
 * this file pins:
 *
 * · G-06 — the rail's cause is atomic with its total, for EVERY mutation.
 * · G-07 — a failed calculation keeps the last trusted total and recovers.
 * · G-07 — a failed save says so instead of being discarded silently.
 * · G-09 — M-06 resolves the sixth decision visibly.
 *
 * Every one of them is a claim about a FAILURE path, which is exactly why
 * they shipped unbuilt: the happy path never asks the question. So these
 * tests induce the failures rather than waiting for them.
 */

const st = () => useStore.getState()

beforeEach(() => __resetStoreForTests())

async function reachLedger(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  enterOptionWorkspace('DEMO-COMPLEX-01')
  await confirmBuildingReviewSections(user)
  completeBuildingScope('PER_BUILDING')
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
      .toBeInTheDocument()
  })
}

describe('the commercial cause is atomic with the total (G-06, T-028)', () => {
  it('an undo explains ITSELF, with the reversed amount', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    // A causal mutation: exclude one cost group through its own control.
    const group = screen.getByRole('radiogroup', { name: kgDecision('KG_500') })
    await user.click(within(group).getByRole('radio', { name: /^nicht enthalten/ }))

    const excluded = commercialResult(st()).lastChange!
    expect(excluded.labelDe).toContain(`KG${NNBSP}500`)
    expect(excluded.signedExact.isNegative()).toBe(true)
    const totalAfterExclude = st().projection().result.total.exact

    // THE DEFECT THIS TEST EXISTS FOR. Before VR3-03R, `undoEvent` never
    // touched `lastCommercialChange`: the total returned to its previous
    // value while the rail went on asserting the exclusion that had just
    // been reversed — a cause stating the OPPOSITE of the truth, on the one
    // surface a salesperson reads to answer "why".
    act(() => { st().undo() })

    const undone = commercialResult(st()).lastChange!
    expect(undone.id).not.toBe(excluded.id)
    expect(undone.labelDe).toContain('Rückgängig')
    expect(undone.labelDe).toContain(`KG${NNBSP}500`)
    expect(undone.labelEn).toContain('Undone')
    // The reversal moved the number the other way, and says so.
    expect(undone.signedExact.isPositive()).toBe(true)
    expect(undone.signedExact.equals(excluded.signedExact.negated())).toBe(true)
    // And the total genuinely came back.
    expect(st().projection().result.total.exact.gt(totalAfterExclude)).toBe(true)
  })

  it('a mutation that cannot name a cause CLEARS the old one', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    const group = screen.getByRole('radiogroup', { name: kgDecision('KG_600') })
    await user.click(within(group).getByRole('radio', { name: /^nicht enthalten/ }))
    expect(commercialResult(st()).lastChange).not.toBeNull()

    // `setDiscount` moves the total and supplies no cause — there are eleven
    // such actions, and before VR3-03R every one of them left the previous
    // explanation standing beside a number it no longer explained.
    const before = st().projection().result.total.exact
    act(() => { st().setDiscount(new Decimal(5)) })
    expect(st().projection().result.total.exact.equals(before)).toBe(false)

    // "I cannot tell you why this moved" is a truthful answer. A stale
    // label is not.
    expect(commercialResult(st()).lastChange).toBeNull()
  })

  it('a mutation that moves nothing leaves the standing explanation alone', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    const group = screen.getByRole('radiogroup', { name: kgDecision('KG_500') })
    await user.click(within(group).getByRole('radio', { name: /^nicht enthalten/ }))
    const standing = commercialResult(st()).lastChange!

    // A zero-effect commit is not a new cause and does not erase the old
    // one: the last thing that MOVED the number is still the last thing
    // that moved it.
    const before = st().projection().result.total.exact
    act(() => { st().setKgScopeDecision('KG_500', 'excluded') })
    expect(st().projection().result.total.exact.equals(before)).toBe(true)
    expect(commercialResult(st()).lastChange!.id).toBe(standing.id)
  })

  it('the result version increments when the numbers move, and not otherwise', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    const moved = commercialResult(st()).version
    act(() => { st().setDiscount(new Decimal(7)) })
    expect(commercialResult(st()).version).toBeGreaterThan(moved)

    // Re-committing the same discount changes no number, so the version
    // that documents itself as "increments whenever the numbers change"
    // stays put.
    const settled = commercialResult(st()).version
    act(() => { st().setDiscount(new Decimal(7)) })
    expect(commercialResult(st()).version).toBe(settled)
  })
})

describe('a failed calculation keeps the last trusted total (G-07, spec §15)', () => {
  it('goes STALE with the previous value intact — never zero, never blank', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    const trusted = commercialResult(st())
    expect(trusted.trust.status).toBe('ready')
    expect(trusted.total.exact.isZero()).toBe(false)

    act(() => { st().setCommercialFault(true) })

    const stale = commercialResult(st())
    expect(stale.trust.status).toBe('stale')
    expect(stale.trust.reason).toBe('calculation')
    // RULE 16, one level up: the engine cannot answer, so the last answer
    // it gave stays on screen. A zero here would be a fabricated total and
    // a blank would look like the number was still coming.
    expect(stale.total.exact.equals(trusted.total.exact)).toBe(true)
    expect(stale.total.exact.isZero()).toBe(false)

    // The rail says so in words, and offers the way out.
    await waitFor(() => {
      expect(screen.getAllByText(/Letzter belastbarer Stand/).length).toBeGreaterThan(0)
    })
    expect(screen.getAllByRole('button', { name: 'Erneut versuchen' }).length)
      .toBeGreaterThan(0)
  })

  it('a retry that fails again says so rather than looking like the first', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    act(() => { st().setCommercialFault(true) })
    expect(commercialResult(st()).trust.attempts).toBe(0)

    await user.click(screen.getAllByRole('button', { name: 'Erneut versuchen' })[0]!)
    expect(commercialResult(st()).trust.attempts).toBe(1)
    expect(commercialResult(st()).trust.status).toBe('stale')

    await user.click(screen.getAllByRole('button', { name: 'Erneut versuchen' })[0]!)
    expect(commercialResult(st()).trust.attempts).toBe(2)
  })

  it('recovery clears the stale state and updates once', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')
    const trusted = commercialResult(st()).total.exact

    act(() => { st().setCommercialFault(true) })
    expect(commercialResult(st()).trust.status).toBe('stale')

    act(() => { st().setCommercialFault(false) })
    const recovered = commercialResult(st())
    expect(recovered.trust.status).toBe('ready')
    expect(recovered.trust.reason).toBeNull()
    expect(recovered.total.exact.equals(trusted)).toBe(true)
  })

  it('a stale result never becomes a client-visible offer', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    act(() => { st().setCommercialFault(true) })
    // A number the engine has already disowned must not be committed as the
    // client baseline. This TIGHTENS the VR3-04 predicate only in a state
    // that did not previously exist.
    expect(clientProjectionValidFor(st())).toBe(false)

    act(() => { st().setCommercialFault(false) })
    expect(commercialResult(st()).trust.status).toBe('ready')
  })

  it('refuses to induce a fault in a production build', async () => {
    // The mechanism is a review tool. `__resetStoreForTests` guards itself
    // the same way and for the same reason.
    const user = userEvent.setup()
    await reachLedger(user)
    const mode = (import.meta as { env?: { MODE?: string } }).env?.MODE
    expect(mode).not.toBe('production')
    expect(() => st().setCommercialFault(true)).not.toThrow()
    act(() => { st().setCommercialFault(false) })
  })
})

describe('M-06 — the sixth decision resolves (G-09)', () => {
  it('marks the completing row and the counter, and unlocks the included groups', async () => {
    const user = userEvent.setup()
    await reachLedger(user)

    // Five explicit decisions, made one at a time through their own rows.
    for (const group of KG_SCOPE_GROUPS.slice(0, 5)) {
      const box = screen.getByRole('radiogroup', { name: kgDecision(group) })
      await user.click(within(box).getByRole('radio', { name: /^enthalten/ }))
    }
    expect(kgScopeDecisionsComplete(st())).toBe(false)
    expect(document.querySelector('[data-resolved="m06"]')).toBeNull()

    const sixth = KG_SCOPE_GROUPS[5]!
    const last = screen.getByRole('radiogroup', { name: kgDecision(sixth) })
    const radio = within(last).getByRole('radio', { name: /^enthalten/ })
    await user.click(radio)

    expect(kgScopeDecisionsComplete(st())).toBe(true)
    // The resolution marks the row that COMPLETED the set and the counter.
    // Probed on the pre-remediation candidate, `document.getAnimations()`
    // returned an empty array at this exact moment: the state teleported.
    await waitFor(() => {
      expect(document.querySelectorAll('[data-resolved="m06"]').length)
        .toBeGreaterThan(0)
    })
    const resolvedRow = document.querySelector('tr[data-resolved="m06"]')
    expect(resolvedRow).not.toBeNull()
    expect(resolvedRow!.textContent).toContain(`KG${' '}${sixth.slice(3)}`)

    // FOCUS STAYS ON THE CHANGED ROW. The newly available group is
    // announced, never auto-focused (spec §3).
    expect(document.activeElement).toBe(radio)

    // And the journey states the unlock, so it is legible where the work is.
    await waitFor(() => {
      expect(screen.getAllByText(
        /Alle sechs Kostengruppen sind entschieden/,
      ).length).toBeGreaterThan(0)
    })
  })

  it('carries no meaning of its own — the marks clear and the state stands', async () => {
    const user = userEvent.setup()
    await reachLedger(user)
    decideAllKgScope('included')

    // The resolution is a one-shot. What remains legible afterwards is the
    // state itself: `6 von 6`, every row decided, the groups reachable —
    // which is why suppressing the motion costs a reader nothing (rule 21).
    await waitFor(() => {
      expect(document.querySelectorAll('[data-resolved="m06"]').length).toBe(0)
    })
    expect(screen.getAllByText('6 von 6 entschieden').length).toBeGreaterThan(0)
    expect(kgScopeDecisionsComplete(st())).toBe(true)
  })
})
