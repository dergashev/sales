import { useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
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
 * `@media print` hides the narrative stage and prints `ClientPrintDocument`
 * instead. That document once carried only a banner, a project name, one
 * number and a note — a COVER SHEET under an authority line promising the
 * whole narrative. A suite that only asks about what a component renders
 * can never report what it does not render, so this file asserts the
 * CONTENT MODEL: every chapter of the proposal, read from the SAME
 * `ClientProposal` the stage renders from (profile `clientPrint`).
 *
 * Structure since VR3-CP-00: Client Mode opens directly on chapter 1 (no
 * entry boundary); the print document is always mounted, carries no
 * `aria-hidden` (medium selection is not exclusion), and its section titles
 * are the chapter labels of the rail — Projektüberblick, Preiszusammensetzung
 * (total, lead rate, uncertainty, composition rows with total row, cost
 * drivers, Regionalfaktor row), Die Gebäude, Konstruktion, Leistungsumfang,
 * Schnittstellen und Verantwortung, Terminplan, Grundlagen. The client-safe
 * vocabulary applies to it as to the stage: no version, no "gespeichert".
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

function Harness() {
  const mainRef = useRef<HTMLElement>(null)
  const modeRef = useRef<HTMLButtonElement>(null)
  return <PresentationShell mainRef={mainRef} modeRef={modeRef} />
}

/** One saved, client-eligible Option off the complex fixture, presented. */
function savedComplexOption(): void {
  enterOptionWorkspace('DEMO-COMPLEX-01')
  completeBuildingScope('PER_BUILDING')
  completeKgConfiguration()
  saveOptionBaseline()
  act(() => { st().setMode('praesentation') })
}

/** Rail button by chapter label (`aria-label` is `n · <chapter>`), then
 *  wait for the chapter section to mount after the cross-fade. */
async function gotoChapter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`· ${label}$`) }))
  await waitFor(() => expect(screen.getByRole('region', { name: label })).toBeInTheDocument())
}

const printDoc = () =>
  document.querySelector('.a3-client-print-doc') as HTMLElement

const printText = () => printDoc()?.textContent ?? ''

const sectionTitles = () =>
  [...printDoc().querySelectorAll('.a3-client-print-section-title')]
    .map((el) => el.textContent?.trim() ?? '')

const section = (title: string) =>
  [...printDoc().querySelectorAll('.a3-client-print-section')]
    .find((el) => el.querySelector('.a3-client-print-section-title')
      ?.textContent?.trim() === title) as HTMLElement | undefined

describe('ACCEPT-01 · the printed client document carries the whole narrative', () => {
  it('prints a section for each narrative chapter, titled as the rail titles it', () => {
    savedComplexOption()
    render(<Harness />)

    // The same words the chapter rail and the output preflight use. The
    // complex fixture has three buildings, so chapter 4 exists and the
    // buildings print under ITS title.
    expect(sectionTitles()).toEqual(expect.arrayContaining([
      'Projektüberblick', 'Preiszusammensetzung', 'Die Gebäude', 'Konstruktion',
      'Leistungsumfang', 'Schnittstellen und Verantwortung', 'Terminplan', 'Grundlagen',
    ]))
    // Medium selection, not exclusion: nothing in the sheet is aria-hidden.
    expect(printDoc()).not.toHaveAttribute('aria-hidden')
    expect(printDoc().querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('names every building the presented Option sells', () => {
    savedComplexOption()
    render(<Harness />)

    const config = st().optionConfigs[st().activeOptionId!] ?? null
    const buildings = (config ?? st()).scopeBuildings
      .filter((b) => (config ?? st()).scopeSelected[b.id])
    expect(buildings.length).toBeGreaterThan(1)
    const gebaeude = section('Die Gebäude')!
    for (const building of buildings) {
      expect(gebaeude.textContent).toContain(building.name)
    }
  })

  it('states the scope decisions, including what is NOT included', () => {
    savedComplexOption()
    render(<Harness />)

    // The scope section's own rows: the state words the client reads. An
    // exclusion a client cannot read is the one that becomes a dispute.
    const scope = section('Leistungsumfang')
    expect(scope).toBeTruthy()
    const rows = scope!.querySelectorAll('.a3-client-print-row')
    // Six decidable cost groups, every one of them stated.
    expect(rows.length).toBe(6)
    for (const row of rows) {
      expect(row.textContent).toMatch(/Enthalten|Nicht enthalten|offen/i)
    }
  })

  it('states the schedule and the commercial result the stage states', () => {
    savedComplexOption()
    render(<Harness />)

    // Duration, the two dates and the phases — the schedule section is not
    // a heading over nothing.
    const schedule = section('Terminplan')!
    expect(schedule.querySelectorAll('.a3-client-print-row').length).toBeGreaterThan(3)
    expect(schedule.textContent).toMatch(/Bauzeit/)
    expect(schedule.textContent).toMatch(/Geplante Fertigstellung/)

    // The commercial result keeps its own hooks: the two locale regressions
    // QA found are asserted against exactly these.
    expect(printDoc().querySelector('.a3-client-print-total')).toBeTruthy()
    expect(printDoc().querySelector('.a3-client-print-total-label')).toBeTruthy()
    const preis = section('Preiszusammensetzung')!
    // The DIN 276 composition, its total row, the cost drivers and the
    // Regionalfaktor row (rule 35, rule 40: present in either flag state).
    expect(preis.querySelectorAll('.a3-client-print-row').length).toBeGreaterThan(1)
    expect(preis.textContent).toMatch(/Zusammensetzung/)
    expect(preis.textContent).toMatch(/Kostentreiber/)
    expect(preis.textContent).toMatch(/Summe der Kostentreiber/)
    expect(preis.textContent).toMatch(/Regionalfaktor/)
    // The total appears as the hero AND as the composition's own sum row.
    const total = printDoc().querySelector('.a3-client-print-total')!.textContent!.trim()
    const totalRows = [...preis.querySelectorAll('.a3-client-print-row')]
      .filter((row) => (row.textContent ?? '').includes(total))
    expect(totalRows.length).toBeGreaterThan(0)
  })

  it('names the Option and a date — never a version — and states the assumptions', () => {
    savedComplexOption()
    render(<Harness />)

    const meta = printDoc().querySelector('.a3-client-print-meta')?.textContent ?? ''
    const optionName = st().options.find((o) => o.id === st().activeOptionId)?.name ?? ''
    expect(optionName).not.toBe('')
    expect(meta).toContain(optionName)
    // A date the client can check the sheet against, formatted by `Intl`.
    expect(meta).toMatch(/Angebotsdatum: .*\d{4}/)
    // Saved-version vocabulary is preparation state, not client content.
    expect(meta).not.toMatch(/Version/)

    expect(sectionTitles()).toContain('Grundlagen')
    // The approved statements are QUOTED from the client surface — the
    // uncertainty band is one of them, not a sentence written for paper.
    expect(printText()).toMatch(/Unschärfeband/)
  })

  it('carries no internal identifier, note, diagnostic or preparation vocabulary', () => {
    savedComplexOption()
    render(<Harness />)

    // The document grew by several sections; the client-safety boundary did
    // not move. Same assertions the live privacy walk makes, against the
    // model rather than the screen — because this content is invisible on
    // screen and would otherwise be checked by nothing.
    const text = printText()
    expect(text).not.toMatch(/\bDEMO-[A-Z0-9-]+\b/)
    expect(text).not.toMatch(/Journal|Marge|interne Notiz/i)
    expect(text).not.toMatch(/Konfidenz|OCR/i)
    expect(text).not.toMatch(/gespeichert|Version|Vorbereitung|Kapitel \d+ von/)
    expect(printDoc().querySelector('[data-source-id]')).toBeNull()
  })
})

/**
 * ACCEPT-03 — a rate states its unit, or it is not a rate.
 *
 * The lead metric once read "BGF oberirdisch / 2.246": a €/m² rate under a
 * Bruttogrundfläche label with no unit anywhere. These assert the three
 * parts that were lost, on the stage and on the sheet: the UNIT, the `≈`
 * PREFIX that says the number is rounded, and the DENOMINATOR that makes
 * the rate checkable (rule 39 / DATA-001). The denominator stands in the
 * metric's LABEL beside its name — rule 31's own wording of the
 * Leitkennzahl — and the unit stands with the number.
 */
describe('ACCEPT-03 · the client lead metric states its unit', () => {
  /** The co-hero lead rate of chapter 5: `MetricHero variant="co"`. */
  const rateTile = (region: HTMLElement) => {
    const value = region.querySelector('.a3-cp-metric-co') as HTMLElement
    const label = value.closest('.a3-cp-metric')!.querySelector('.a3-cp-metric-label')
    return { dt: label?.textContent ?? '', dd: value.textContent ?? '' }
  }

  it('prints prefix, unit and denominator on the Preiszusammensetzung chapter (DE)', async () => {
    const user = userEvent.setup()
    savedComplexOption()
    render(<Harness />)
    await gotoChapter(user, 'Preiszusammensetzung')

    const region = screen.getByRole('region', { name: 'Preiszusammensetzung' })
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
    act(() => { st().setUiLanguage('en') })
    await gotoChapter(user, 'Price composition')

    const region = screen.getByRole('region', { name: 'Price composition' })
    const { dt, dd } = rateTile(region)
    expect(dt).toMatch(/Lead rate/)
    // The NORM does not follow the reader (LOCALE-009)...
    expect(dt).toMatch(/BGF|WFL|NUF/)
    expect(dd).toContain('€/m²')
    // ...and the NUMERAL does.
    expect(dd).not.toMatch(/\d{1,3}(?:\.\d{3})+/)
  })

  it('states the same lead metric on the printed sheet', () => {
    savedComplexOption()
    render(<Harness />)

    // The sheet and the stage must not disagree about the lead metric: both
    // render the one `ClientProposal`, so both carry the unit.
    const preis = section('Preiszusammensetzung')!
    expect(preis.textContent).toContain('€/m²')
    expect(preis.textContent).toMatch(/Leitkennzahl/)
    expect(preis.textContent).toMatch(/BGF|WFL|NUF/)
  })
})
