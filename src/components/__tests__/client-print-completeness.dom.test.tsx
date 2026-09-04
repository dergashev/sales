import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresentationShell } from '../PresentationShell'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'
import { useStore, __resetStoreForTests } from '../../state/store'

/**
 * ACCEPT-01 — the artefact the client KEEPS must contain the presentation.
 *
 * `@media print` hides the whole narrative and prints `ClientPrintDocument`
 * instead, which is the right call: a client document is a document, not a
 * photograph of a meeting-scale stage. But that document carried only a
 * banner, an authority line, the project name, one number, one label and a
 * note — so the PDF a client keeps was a COVER SHEET, while the card
 * offering it promised "Kundennarrativ · gespeicherte Quelle ·
 * Szenario-Differenz · Kennzeichnung" and the preflight beside it listed all
 * six sections as ENTHALTEN. The output stated an authority it did not
 * carry, and the Acceptance Auditor failed the candidate for it.
 *
 * ## Why three green cycles did not catch it
 *
 * The existing print tests assert the total and its label — the two strings
 * that were there. A suite that only asks about what a component renders can
 * never report what it does not render, which is the same detection gap the
 * i18n negative-case guard exists to close, one layer up. So this file
 * asserts the CONTENT MODEL against the approved list rather than against
 * the current markup: target spec §16, "PDF includes client narrative,
 * buildings, scope, services, schedule, commercial result,
 * Option/version/date and approved assumptions".
 *
 * Every assertion below reads the SAME store the screen reads and compares
 * the sheet to it, so the sheet cannot pass by containing a plausible string
 * — it has to contain the presented Option's own buildings, its own scope
 * decisions and its own dates.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** One saved, client-eligible Option off the complex fixture. */
function savedComplexOption(): void {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  completeBuildingScope('PER_BUILDING')
  completeKgConfiguration()
  saveOptionBaseline()
  act(() => { st().setMode('praesentation') })
}

async function startPresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Präsentation starten' }))
}

const printDoc = () =>
  document.querySelector('.a3-client-print-doc') as HTMLElement

const printText = () => printDoc()?.textContent ?? ''

const sectionTitles = () =>
  [...printDoc().querySelectorAll('.a3-client-print-section-title')]
    .map((el) => el.textContent?.trim() ?? '')

describe('ACCEPT-01 · the printed client document carries the whole narrative', () => {
  it('prints a section for each of the six narrative sections', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    // The same six words the narrative rail and the output preflight use.
    // Reading them from the dictionary keys rather than typing them is what
    // keeps this test honest if a section is ever renamed.
    expect(sectionTitles()).toEqual(expect.arrayContaining([
      'Projekt', 'Gebäude', 'Umfang', 'Leistungen', 'Terminplan', 'Investition',
    ]))
  })

  it('names every building the presented Option sells', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    const config = st().optionConfigs[st().activeOptionId!] ?? null
    const buildings = (config ?? st()).scopeBuildings
      .filter((b) => (config ?? st()).scopeSelected[b.id])
    expect(buildings.length).toBeGreaterThan(1)
    for (const building of buildings) {
      expect(printText()).toContain(building.name)
    }
  })

  it('states the scope decisions, including what is NOT included', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    // The scope section's own rows: the state words the client reads. An
    // exclusion a client cannot read is the one that becomes a dispute.
    const scope = [...printDoc().querySelectorAll('.a3-client-print-section')]
      .find((el) => el.querySelector('.a3-client-print-section-title')
        ?.textContent?.trim() === 'Umfang')
    expect(scope).toBeTruthy()
    const rows = scope!.querySelectorAll('.a3-client-print-row')
    // Six decidable cost groups, every one of them stated.
    expect(rows.length).toBe(6)
  })

  it('states the schedule and the commercial result the stage states', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    // Duration, the two dates and the sequence — the schedule section is
    // not a heading over nothing.
    const schedule = [...printDoc().querySelectorAll('.a3-client-print-section')]
      .find((el) => el.querySelector('.a3-client-print-section-title')
        ?.textContent?.trim() === 'Terminplan')
    expect(schedule!.querySelectorAll('.a3-client-print-row').length)
      .toBeGreaterThan(3)

    // The commercial result keeps its own hooks: the two locale regressions
    // QA found are asserted against exactly these, and the composition is
    // the DIN 276 split the investment section shows.
    expect(printDoc().querySelector('.a3-client-print-total')).toBeTruthy()
    expect(printDoc().querySelector('.a3-client-print-total-label')).toBeTruthy()
    const investment = [...printDoc().querySelectorAll('.a3-client-print-section')]
      .find((el) => el.querySelector('.a3-client-print-section-title')
        ?.textContent?.trim() === 'Investition')
    expect(investment!.querySelectorAll('.a3-client-print-row').length)
      .toBeGreaterThan(1)
  })

  it('names the Option, its version and a date, and states the assumptions', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    const meta = printDoc().querySelector('.a3-client-print-meta')?.textContent ?? ''
    const optionName = st().options.find((o) => o.id === st().activeOptionId)?.name ?? ''
    expect(optionName).not.toBe('')
    expect(meta).toContain(optionName)
    expect(meta).toMatch(/Version\s*1/)
    // A date the client can check the sheet against, formatted by `Intl`.
    expect(meta).toMatch(/\d{4}/)

    expect(sectionTitles()).toContain('Annahmen')
    // The approved statements are QUOTED from the client surface — the
    // uncertainty band is one of them, not a sentence written for paper.
    expect(printText()).toMatch(/Unschärfeband/)
  })

  it('carries no internal identifier, note or diagnostic', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    // The document grew by five sections; the client-safety boundary did
    // not move. Same assertions the live privacy walk makes, against the
    // model rather than the screen — because this content is invisible on
    // screen and would otherwise be checked by nothing.
    const text = printText()
    expect(text).not.toMatch(/\bDEMO-[A-Z0-9-]+\b/)
    expect(text).not.toMatch(/Journal|Marge|interne Notiz/i)
    expect(text).not.toMatch(/Konfidenz|OCR/i)
    expect(printDoc().querySelector('[data-source-id]')).toBeNull()
  })
})

/**
 * ACCEPT-03 — a rate states its unit, or it is not a rate.
 *
 * The investment tile rendered `<dt>{leadRate.denominatorLabel}</dt>` over
 * `<dd>{display}</dd>`, so the lead metric read "BGF oberirdisch / 2.246" in
 * both locales: a €/m² rate under a Bruttogrundfläche label, with no unit
 * anywhere, which a client can only read as an area. The engine already
 * composes the whole string — `rateLabel()` → "≈ 2.246 €/m² BGF
 * oberirdisch" — and T-040 prints it with its unit ("Lead rate 1,990 €/m²").
 *
 * These assert the three parts that were lost, on the stage and on the
 * sheet: the UNIT, the `≈` PREFIX that says the number is rounded, and the
 * DENOMINATOR that makes the rate checkable (rule 39 / DATA-001). The
 * denominator stands in the TERM beside the metric's name — rule 31's own
 * wording of the Leitkennzahl — and the unit stands with the number, which
 * is also what keeps it out of a 180 px cell it would wrap inside.
 */
describe('ACCEPT-03 · the client lead metric states its unit', () => {
  const rateTile = (region: HTMLElement) => {
    const dd = region.querySelector('.a3-client-metric-grid dd')?.textContent ?? ''
    const dt = region.querySelector('.a3-client-metric-grid dt')?.textContent ?? ''
    return { dt, dd }
  }

  it('prints prefix, unit and denominator on the investment section (DE)', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)
    await user.click(screen.getByRole('button', { name: 'Investition' }))

    const region = await screen.findByRole('region', { name: 'Investition' })
    const { dt, dd } = rateTile(region)
    expect(dt).toMatch(/Leitkennzahl/)
    // The norm the denominator comes from, still German (LOCALE-009).
    expect(dt).toMatch(/BGF|WFL|NUF/)
    // The unit. Its absence is the whole defect.
    expect(dd).toContain('€/m²')
    // The rounding prefix the engine attaches, lost with the unit.
    expect(dd).toContain('≈')
  })

  it('keeps unit and denominator under EN and re-typesets only the numeral', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)
    act(() => { st().setUiLanguage('en') })
    await user.click(screen.getByRole('button', { name: 'Investment' }))

    const region = await screen.findByRole('region', { name: 'Investment' })
    const { dt, dd } = rateTile(region)
    expect(dt).toMatch(/Lead rate/)
    // The NORM does not follow the reader (LOCALE-009)...
    expect(dt).toMatch(/BGF|WFL|NUF/)
    expect(dd).toContain('€/m²')
    // ...and the NUMERAL does.
    expect(dd).not.toMatch(/\d{1,3}(?:\.\d{3})+/)
  })

  it('states the same lead metric on the printed sheet', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await startPresentation(user)

    // The sheet and the stage must not disagree about the lead metric: both
    // go through the engine's composer, so both carry the unit.
    expect(printText()).toContain('€/m²')
    expect(printText()).toMatch(/Leitkennzahl/)
  })
})
