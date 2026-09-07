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
 * The rule: an Option's client-facing total is the one its SAVE committed
 * (`SavedOptionVersion.result.totalDisplay`), never the legacy proposal
 * projection. It was once applied to one switcher branch and forgotten in
 * the other two — the failure mode "a rule that lives in each action's
 * memory is a rule the next action forgets". So this file does not assert a
 * formatted string; it asserts the INVARIANT on every client surface that
 * states a number about an Option.
 *
 * Structure since VR3-CP-00: the top-bar `Ansicht` switcher (segmented
 * control / >3-Option select) and the §6 comparison panel are gone. The
 * presented Option is switched in the Varianten layer (`Varianten · N` →
 * `<option> zeigen`; above three Options a participant picker chooses the
 * columns), the bar's `role="status"` names the presented Option, and the
 * number itself is stated by the chapters — chapter 2's hero, chapter 5 —
 * and by the printed sheet, all reading the one `ClientProposal`.
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

/** Rail button by chapter label, then wait for the chapter to mount. */
async function gotoChapter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`· ${label}$`) }))
  await waitFor(() => expect(screen.getByRole('region', { name: label })).toBeInTheDocument())
}

const openVarianten = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /^(Varianten|Variants) · \d+$/ }))
  return screen.findByRole('dialog')
}

/** Switch the presented Option through the Varianten layer. */
async function showOption(user: ReturnType<typeof userEvent.setup>, name: string) {
  const layer = await openVarianten(user)
  await user.click(within(layer).getByRole('button', { name: new RegExp(`${name}`) }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

/** The chapter-2 hero: the one 64 px total (rule 31) and the co-hero rate. */
const hero = () => {
  const region = screen.getByRole('region', { name: /Projektüberblick|Project overview/ })
  return {
    total: region.querySelector('.a3-cp-hero-total .a3-cp-metric-lead')?.textContent ?? '',
    totalLabel: region.querySelector('.a3-cp-hero-total .a3-cp-metric-label')?.textContent ?? '',
    rate: region.querySelector('.a3-cp-hero-side .a3-cp-metric-co')?.textContent ?? '',
    rateLabel: region.querySelector('.a3-cp-hero-side .a3-cp-metric-label')?.textContent ?? '',
  }
}

const announcement = () => screen.getByRole('status').textContent ?? ''

/** The saved total the stage is required to state, and the legacy one it
 *  must never state. Both read from the store, so neither is a literal. */
function totals(id: string) {
  const saved = latestSavedOptionVersion(st(), id)!.result.totalDisplay
  const legacy = projectionForOption(st(), id)!.result.total.exact
  return { saved, legacy }
}

/** `1234567` → `1.234.567`, the grouping a legacy total would print. The two
 *  engines' totals differ by an order of magnitude, so this is a decisive
 *  discriminator even when two Options price identically. */
function grouped(value: { toFixed: (n: number) => string }): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(Number(value.toFixed(2))))
}

describe('VR3-05 · the client stage states one number per Option', () => {
  it('the hero and the bar agree on the presented Option, and the hero states its SAVED total', async () => {
    const user = userEvent.setup()
    const [a, b] = buildSavedOptions(2)
    render(<Harness />)
    await gotoChapter(user, 'Projektüberblick')

    const first = totals(a!)
    // The bar names the presented Option; the hero states ITS saved total,
    // never the second engine's total for the same Option. Queried by NAME,
    // then read for the number: two Options may legitimately price the
    // same, so the number is never the identifier here.
    expect(announcement()).toMatch(/Option A/)
    expect(hero().total).toContain(first.saved)
    expect(hero().total).not.toContain(grouped(first.legacy))

    // Switching restates the number, still from the saved record, and the
    // narrative position is kept.
    const second = totals(b!)
    await showOption(user, 'Option B zeigen')
    await waitFor(() => expect(st().viewedOptionId).toBe(b))
    expect(announcement()).toMatch(/Option B/)
    expect(screen.getByRole('region', { name: 'Projektüberblick' })).toBeInTheDocument()
    expect(hero().total).toContain(second.saved)
    expect(hero().total).not.toContain(grouped(second.legacy))
  })

  it('above three Options the Varianten layer offers a participant picker, and a picked Option is presented with its SAVED total', async () => {
    const user = userEvent.setup()
    const ids = buildSavedOptions(4)
    render(<Harness />)
    await gotoChapter(user, 'Projektüberblick')

    // Above three Options the presenter chooses the participants through a
    // client-safe control rather than being handed narrow columns — the
    // branch that used to be a `<select>` and kept the defect.
    expect(screen.queryByRole('radiogroup', { name: 'Ansicht' })).toBeNull()
    const layer = await openVarianten(user)
    const picker = within(layer).getByRole('group', { name: /Bis zu 3 Optionen/ })
    expect(within(picker).getAllByRole('checkbox')).toHaveLength(4)
    expect(within(layer).getAllByRole('columnheader')).toHaveLength(1 + 3)
    // Option D is not a column yet, so it cannot be shown yet.
    expect(within(layer).queryByRole('button', { name: 'Option D zeigen' })).toBeNull()

    await user.click(within(picker).getByRole('checkbox', { name: 'Option D' }))
    expect(within(layer).getAllByRole('columnheader')).toHaveLength(1 + 3)
    await user.click(within(layer).getByRole('button', { name: 'Option D zeigen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const d = ids[3]!
    expect(st().viewedOptionId).toBe(d)
    expect(announcement()).toMatch(/Option D/)
    const { saved, legacy } = totals(d)
    expect(hero().total).toContain(saved)
    expect(hero().total).not.toContain(grouped(legacy))
  })

  it('the Varianten layer states the SAME facts about the presented Option as the chapters do (one Option, one number)', async () => {
    const user = userEvent.setup()
    buildSavedOptions(2)
    render(<Harness />)
    await gotoChapter(user, 'Projektüberblick')

    // The lead rate the hero states for the presented Option …
    const stageRate = hero().rate.replace(/\s/g, '')
    const layer = await openVarianten(user)
    // … is the lead rate the comparison states in the presented column.
    const presentedIndex = within(layer).getAllByRole('columnheader')
      .findIndex((th) => /wird gezeigt/.test(th.textContent ?? ''))
    expect(presentedIndex).toBeGreaterThan(0)
    const rateRow = within(layer).getByRole('row', { name: /^Leitkennzahl/ })
    const cell = within(rateRow).getAllByRole('cell')[presentedIndex - 1]!
    expect(cell.textContent!.replace(/\s/g, '')).toContain(stageRate)
  })
})

/**
 * QA-01 (cycle 2) — the SAME number, typeset for the reader's own language.
 *
 * `SavedOptionResult.totalDisplay` is frozen at save time by `formatDE`,
 * which is German by construction: `.` thousands, `,` decimal. Reusing that
 * string verbatim printed "38.740.000" inside an English presentation while
 * the numbers 8 px away were already "38,740,000" — two number systems on
 * one client screen, which is exactly what CLAUDE.md rule 36 exists to
 * prevent. The tests below assert FORMAT, not value: the suite above pins
 * WHICH number each surface states.
 */
describe('VR3-05 · the saved total is typeset for the active UI language', () => {
  /** A DE-grouped numeral (1.234.567) that is NOT also valid EN grouping. */
  const DE_GROUPED = /\d{1,3}(?:\.\d{3})+/
  /** An EN-grouped numeral (1,234,567). */
  const EN_GROUPED = /\d{1,3}(?:,\d{3})+/

  it('states DE grouping in DE and EN grouping in EN, on the hero and its rate', async () => {
    const user = userEvent.setup()
    buildSavedOptions(2)
    render(<Harness />)
    await gotoChapter(user, 'Projektüberblick')

    // DE is the source language: dots, and no EN grouping anywhere.
    expect(hero().total).toMatch(DE_GROUPED)
    expect(hero().total).not.toMatch(EN_GROUPED)
    expect(hero().rate).toMatch(DE_GROUPED)

    act(() => { st().setUiLanguage('en') })

    // EN: commas, and the frozen German numeral must be gone.
    await waitFor(() => expect(hero().total).toMatch(EN_GROUPED))
    expect(hero().total).not.toMatch(DE_GROUPED)
    expect(hero().rate).toMatch(EN_GROUPED)
    expect(hero().rate).not.toMatch(DE_GROUPED)
  })

  it('states EN grouping in the Varianten comparison cells, and never glues a digit to a sign', async () => {
    const user = userEvent.setup()
    buildSavedOptions(2)
    render(<Harness />)
    act(() => { st().setUiLanguage('en') })

    const layer = await openVarianten(user)
    const cells = within(layer).getAllByRole('cell')
      // Money cells only: a date cell ('28 January 2028') carries a four-digit
      // year and no grouping, so it is not what this assertion is about.
      .filter((cell) => /\d{1,3}[.,]\d{3}/.test(cell.textContent ?? ''))
    expect(cells.length).toBeGreaterThan(0)

    for (const cell of cells) {
      const text = cell.textContent ?? ''
      // The German numeral must have re-typeset with the rest of the screen.
      expect(text).not.toMatch(DE_GROUPED)
      expect(text).toMatch(EN_GROUPED)
      // A separator exists, so no digit is ever followed immediately by a sign.
      expect(text).not.toMatch(/\d[+−-]/)
    }
  })
})

/**
 * The same defect on the artefact the client KEEPS.
 *
 * `ClientPrintDocument` is the client-safe document both PDF and print
 * drive. An English presentation once handed the client a sheet reading
 * "38.740.000" directly beneath a line that had already localised its own
 * delta to "+ 310,000 €".
 */
describe('VR3-05 · the client print document typesets its total for the reader', () => {
  it('prints the total AND its label in the reader\'s language (QA-02)', () => {
    buildSavedOptions(1)
    render(<Harness />)

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

  it('prints EN grouping under EN and DE grouping under DE', () => {
    buildSavedOptions(1)
    render(<Harness />)

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
 * The hero is rule 31's largest element, and it had two of the same defect:
 * an EN screen whose total label still read "GESAMT NETTO · GRUNDLEISTUNG
 * ALL3", and a lead rate beside it still in German grouping. The DENOMINATOR
 * NAME is a separate matter and must stay German (LOCALE-009: normative
 * denominators are never machine translated), which is why it is asserted
 * to SURVIVE below.
 */
describe('VR3-05 · the client hero speaks one language', () => {
  it('bridges the total label and re-typesets the rate, keeping the normative denominator', async () => {
    const user = userEvent.setup()
    buildSavedOptions(1)
    render(<Harness />)
    act(() => { st().setUiLanguage('en') })
    await gotoChapter(user, 'Project overview')

    const { totalLabel, rate, rateLabel } = hero()
    // The total's label is bridged, so the German original is gone.
    expect(totalLabel).not.toMatch(/Gesamt netto/i)
    expect(totalLabel).toMatch(/net total/i)

    expect(rate).not.toMatch(/\d{1,3}(?:\.\d{3})+/)
    // ACCEPT-03: the value carries the UNIT the tile used to omit...
    expect(rate).toContain('€/m²')
    // ...and the normative denominator name is deliberately NOT translated.
    // It stands in the LABEL beside the metric's own name, which is how
    // rule 31 words the Leitkennzahl.
    expect(rateLabel).toMatch(/lead rate/i)
    expect(rateLabel).toMatch(/BGF|WFL|NUF/)
  })
})
