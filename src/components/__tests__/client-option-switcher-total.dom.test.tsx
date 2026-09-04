import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell } from '../PresentationShell'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'
import {
  latestSavedOptionVersion,
  projectionForOption,
  useStore,
  __resetStoreForTests,
} from '../../state/store'

/**
 * VR3-05 — ONE Option has ONE client-facing number, on every path that
 * states it.
 *
 * The rule already stood in `OptionSwitcher`, written out above `segments`:
 * an Option's client-facing total is the one its SAVE committed
 * (`SavedOptionVersion.result.totalDisplay`), never the legacy proposal
 * projection. It had been applied to `segments` — and to `segments` only.
 * The same function's other two statements of the same number still read
 * `c.p.result.total`:
 *
 *   - the `sr-only` `aria-live` announcement fired on every switch, so a
 *     screen-reader user heard ≈ 3.980.000 € for the Option sighted users
 *     saw priced at 38.430.000 €;
 *   - the `SelectField` branch that replaces the segmented control above
 *     three Options — which Save as New makes ordinary to reach — printed
 *     the same wrong number visibly.
 *
 * This is the failure mode [[vr3-unified-konfigurator]] recorded as "a rule
 * that lives in each action's memory is a rule the next action forgets",
 * and the switcher is where [[vr3-client-presentation-scenarios]] already
 * recorded "two engines, one Option" once. So this file does not assert a
 * formatted string. It asserts the INVARIANT across BOTH switcher branches:
 * every number the switcher states about an Option is that Option's saved
 * total, and the legacy projection's total appears nowhere.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** Save `count` client-eligible Options off the complex fixture. */
function buildSavedOptions(count: number): string[] {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  const ids: string[] = []
  const first = st().activeOptionId!
  act(() => { st().renameOption(first, 'Option A') })
  completeBuildingScope('PER_BUILDING')
  completeKgConfiguration()
  saveOptionBaseline()
  ids.push(first)

  for (let n = 1; n < count; n += 1) {
    const id = st().createOption(`Option ${String.fromCharCode(65 + n)}`)!
    act(() => { st().openOption(id) })
    completeBuildingScope('PER_BUILDING')
    completeKgConfiguration()
    saveOptionBaseline()
    ids.push(id)
  }

  act(() => { st().openOption(first) })
  act(() => { st().setMode('praesentation') })
  return ids
}

async function startPresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Präsentation starten' }))
}

/** The saved total the switcher is required to state, and the legacy one it
 *  must never state. Both read from the store, so neither is a literal. */
function totals(id: string) {
  const saved = latestSavedOptionVersion(st(), id)!.result.totalDisplay
  const legacy = projectionForOption(st(), id)!.result.total.exact
  return { saved, legacy }
}

/** `1234567` → `1.234.567`, the grouping the switcher would have printed.
 *  The two engines' totals differ by an order of magnitude, so this is a
 *  decisive discriminator even when two Options price identically. */
function grouped(value: { toFixed: (n: number) => string }): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(Number(value.toFixed(2))))
}

describe('VR3-05 · the client Option switcher states one number per Option', () => {
  it('the segmented control and its announcement both state the SAVED total', async () => {
    const user = userEvent.setup()
    const [a, b] = buildSavedOptions(2)
    render(<Harness />)
    await startPresentation(user)

    const switcher = screen.getByRole('radiogroup', { name: 'Ansicht' })
    const first = totals(a!)

    // The visible segment and the polite announcement agree, and both agree
    // with the Option's own saved record. Queried by NAME, then read for the
    // number: two Options may legitimately price the same, so the number is
    // never the identifier here.
    const segment = (name: string) =>
      within(switcher).getByRole('radio', { name: new RegExp(name) })
        .closest('label') as HTMLElement
    expect(segment('Option A')).toHaveTextContent(first.saved)
    expect(segment('Option A')).not.toHaveTextContent(grouped(first.legacy))
    const announcement = () => screen.getByText(/^Ansicht:/)
    expect(announcement()).toHaveTextContent(first.saved)
    // And never the second engine's total for the same Option.
    expect(announcement()).not.toHaveTextContent(grouped(first.legacy))

    // Switching restates the number, still from the saved record.
    const second = totals(b!)
    await user.click(within(switcher).getByRole('radio', { name: /Option B/ }))
    await waitFor(() => expect(st().viewedOptionId).toBe(b))
    expect(announcement()).toHaveTextContent(second.saved)
    expect(announcement()).not.toHaveTextContent(grouped(second.legacy))
  })

  it('the >3-Option select branch states the SAVED total too', async () => {
    const user = userEvent.setup()
    const ids = buildSavedOptions(4)
    render(<Harness />)
    await startPresentation(user)

    // Above three Options the segmented control is replaced by the
    // canonical select (LOCALE-004) — the branch that kept the defect.
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()
    const select = screen.getByLabelText('Ansicht')

    ids.forEach((id, index) => {
      const { saved, legacy } = totals(id)
      const name = `Option ${String.fromCharCode(65 + index)}`
      const option = within(select).getByRole('option', { name: new RegExp(name) })
      expect(option).toHaveTextContent(saved)
      expect(option).not.toHaveTextContent(grouped(legacy))
    })
  })
})

/**
 * QA-01 (cycle 2) — the SAME number, typeset for the reader's own language.
 *
 * `SavedOptionResult.totalDisplay` is frozen at save time by `formatDE`,
 * which is German by construction: `.` thousands, `,` decimal. Reusing that
 * string verbatim printed "38.740.000" inside an English presentation while
 * the KG breakdown and the comparison delta 8 px away were already correctly
 * "38,740,000" — two number systems on one client screen, which is exactly
 * what CLAUDE.md rule 36 exists to prevent.
 *
 * The tests below assert FORMAT, not value: the sibling suite above already
 * pins WHICH number each surface states, and a suite that checks the value
 * only is how this shipped past a green build twice.
 */
describe('VR3-05 · the saved total is typeset for the active UI language', () => {
  /** A DE-grouped numeral (1.234.567) that is NOT also valid EN grouping. */
  const DE_GROUPED = /\d{1,3}(?:\.\d{3})+/
  /** An EN-grouped numeral (1,234,567). */
  const EN_GROUPED = /\d{1,3}(?:,\d{3})+/

  const switcherTexts = () => {
    const group = screen.getByRole('radiogroup', { name: /Ansicht|Viewing/ })
    return [...group.querySelectorAll('label')].map((l) => l.textContent ?? '')
  }
  const announcement = () => screen.getByText(/^(Ansicht|Viewing):/).textContent ?? ''

  it('states DE grouping in DE and EN grouping in EN, on every switcher surface', async () => {
    const user = userEvent.setup()
    buildSavedOptions(2)
    render(<Harness />)
    await startPresentation(user)

    // DE is the source language: dots, and no EN grouping anywhere.
    for (const text of switcherTexts()) {
      expect(text).toMatch(DE_GROUPED)
      expect(text).not.toMatch(EN_GROUPED)
    }
    expect(announcement()).toMatch(DE_GROUPED)

    act(() => { st().setUiLanguage('en') })

    // EN: commas, and the frozen German numeral must be gone.
    for (const text of switcherTexts()) {
      expect(text).toMatch(EN_GROUPED)
      expect(text).not.toMatch(DE_GROUPED)
    }
    expect(announcement()).toMatch(EN_GROUPED)
    expect(announcement()).not.toMatch(DE_GROUPED)
  })

  it('states EN grouping in the >3-Option select branch too', async () => {
    const user = userEvent.setup()
    buildSavedOptions(4)
    render(<Harness />)
    await startPresentation(user)
    act(() => { st().setUiLanguage('en') })

    const select = screen.getByLabelText(/Ansicht|Viewing/)
    for (const option of [...select.querySelectorAll('option')]) {
      const text = option.textContent ?? ''
      expect(text).toMatch(EN_GROUPED)
      expect(text).not.toMatch(DE_GROUPED)
    }
  })

  it('states EN grouping in the Investition comparison rows, and separates the delta', async () => {
    const user = userEvent.setup()
    buildSavedOptions(2)
    render(<Harness />)
    await startPresentation(user)
    act(() => { st().setUiLanguage('en') })

    await user.click(screen.getByRole('button', { name: 'Investment' }))
    const panel = await screen.findByRole('region', { name: 'Other saved Options' })
    const values = [...panel.querySelectorAll('.a3-client-row-value')]
    expect(values.length).toBeGreaterThan(0)

    for (const value of values) {
      const text = value.textContent ?? ''
      expect(text).toMatch(EN_GROUPED)
      // The frozen German total was the one thing on this row that did not
      // re-typeset, so its absence IS the fix.
      expect(text).not.toMatch(DE_GROUPED)
      // And the total must not be glued to the delta: the row read
      // "38.740.000+ 310,000 €" as a single token to any reader of the
      // accessible name. A separator exists, so no digit is ever followed
      // immediately by a sign.
      expect(text).not.toMatch(/\d[+−-]/)
    }
  })
})

/**
 * The same defect on the artefact the client KEEPS.
 *
 * `ClientPrintDocument` is the client-safe document both PDF and print drive.
 * Every string in it goes through `t()` or `signedMoneyText(…, language)` —
 * except the total, which printed `Displayed.display` straight from
 * `formatDE`. An English presentation therefore handed the client a sheet
 * reading "38.740.000" directly beneath an authority line that had already
 * localised its own delta to "+ 310,000 €".
 */
describe('VR3-05 · the client print document typesets its total for the reader', () => {
  it('prints the total AND its label in the reader\'s language (QA-02)', async () => {
    const user = userEvent.setup()
    buildSavedOptions(1)
    render(<Harness />)
    await startPresentation(user)

    const label = () =>
      document.querySelector('.a3-client-print-total-label')?.textContent?.trim() ?? ''
    const total = () =>
      document.querySelector('.a3-client-print-total')?.textContent?.trim() ?? ''

    // DE is the source language: both halves German.
    expect(total()).toMatch(/\d{1,3}(?:\.\d{3})+/)
    expect(label()).toMatch(/Gesamt netto/i)

    act(() => { st().setUiLanguage('en') })

    // QA-02: cycle 2 localised the NUMBER and left the LABEL under it in
    // German, so the sheet read "38,850,000" over "Gesamt netto ·
    // Grundleistung All3". Both halves must move together.
    expect(total()).toMatch(/\d{1,3}(?:,\d{3})+/)
    expect(label()).not.toMatch(/Gesamt netto/i)
    expect(label()).toMatch(/net total/i)
  })

  it('prints EN grouping under EN and DE grouping under DE', async () => {
    const user = userEvent.setup()
    buildSavedOptions(1)
    render(<Harness />)
    await startPresentation(user)

    const printTotal = () =>
      document.querySelector('.a3-client-print-total')?.textContent?.trim() ?? ''

    expect(printTotal()).toMatch(/\d{1,3}(?:\.\d{3})+/)
    expect(printTotal()).not.toMatch(/\d{1,3}(?:,\d{3})+/)

    act(() => { st().setUiLanguage('en') })

    expect(printTotal()).toMatch(/\d{1,3}(?:,\d{3})+/)
    expect(printTotal()).not.toMatch(/\d{1,3}(?:\.\d{3})+/)
  })
})

/**
 * The hero is rule 31's largest element, and it had two of the same defect.
 *
 * Found by looking at the EN screenshot rather than at the report: the
 * scope eyebrow over a "38,430,000 €" hero still read
 * "GESAMT NETTO · GRUNDLEISTUNG ALL3", and the lead rate beside it read
 * "2.228" — German grouping — while every other number on the panel had
 * already re-typeset. The DENOMINATOR NAME is a separate matter and must
 * stay German (LOCALE-009: normative denominators are never machine
 * translated), which is why it is asserted to SURVIVE below.
 */
describe('VR3-05 · the client investment hero speaks one language', () => {
  it('bridges the scope label and re-typesets the rate, keeping the normative denominator', async () => {
    const user = userEvent.setup()
    buildSavedOptions(1)
    render(<Harness />)
    await startPresentation(user)
    act(() => { st().setUiLanguage('en') })
    await user.click(screen.getByRole('button', { name: 'Investment' }))

    const panel = (await screen.findByRole('region', { name: 'Investment' }))
    const eyebrow = panel.querySelector('.a3-client-eyebrow-onpanel')?.textContent ?? ''
    // The scope label is bridged, so the German original is gone.
    expect(eyebrow).not.toMatch(/Gesamt netto/i)
    expect(eyebrow).toMatch(/net total/i)

    const rateValue = panel.querySelector('.a3-client-metric-grid dd')?.textContent ?? ''
    expect(rateValue).not.toMatch(/\d{1,3}(?:\.\d{3})+/)

    // ...and the normative denominator name is deliberately NOT translated.
    const rateLabel = panel.querySelector('.a3-client-metric-grid dt')?.textContent ?? ''
    expect(rateLabel).toMatch(/BGF|WFL|NUF/)
  })
})
