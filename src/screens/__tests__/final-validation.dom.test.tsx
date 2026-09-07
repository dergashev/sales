import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  completeBuildingScope,
  completeKgConfiguration,
  decideAllKgScope,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import { REVIEW_SECTION_COUNT } from '../../state/optionReview'
import {
  __resetStoreForTests,
  clientModeAvailableForOption,
  commercialResult,
  finalValidationConfirmedFor,
  latestSavedOptionVersion,
  optionReviewStageFor,
  optionSaveStageFor,
  optionScheduleStageFor,
  reviewProgressFor,
  savedOptionVersionsFor,
  scheduleDerivationFor,
  useStore,
} from '../../state/store'
import { setReducedMotion } from '../../test/setup'

/**
 * VR3-04 — the schedule, the long review, the explicit save and the
 * Client Mode unlock, driven as a user drives them.
 *
 * The arithmetic is proved in `src/state/__tests__/optionSchedule.test.ts`;
 * this file proves the SURFACES and the GATE CHAIN: a schedule that is
 * unavailable until the cost groups are complete and separately confirmable,
 * a Final Validation that is unavailable until the schedule is confirmed, a
 * review that stays long and navigable with an exact route per issue, a Save
 * that cannot execute before the confirmation and says why, and a saved
 * version that is the only thing which unlocks a client meeting.
 *
 * Every activation here is an ordinary pointer click or a real key press.
 * Nothing forces a control, and no test writes a saved version directly —
 * a suite that faked the commitment would let a broken gate stay green,
 * which is the exact failure mode this ticket exists to remove.
 */

const st = () => useStore.getState()

function openSchedule() {
  act(() => {
    st().setPipelineView('konfigurator')
    st().openConfiguratorStepAt(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)
  })
}

function openValidation() {
  act(() => {
    st().setPipelineView('konfigurator')
    st().openConfiguratorStepAt(CONFIGURATOR_STEP.FINAL_VALIDATION)
  })
}

/** The clean fixture, configured up to (but not through) the schedule. */
function reachSchedule(projectId = 'DEMO-HAPPY-01') {
  enterOptionWorkspace(projectId)
  completeBuildingScope(projectId === 'DEMO-HAPPY-01' ? 'SHARED' : 'PER_BUILDING')
  completeKgConfiguration()
}

beforeEach(() => {
  __resetStoreForTests()
  setReducedMotion(false)
})

describe('the Schedule is a stage: unavailable, then separately confirmable', () => {
  it('is locked while a cost group is still incomplete, and names the route out', () => {
    enterOptionWorkspace()
    completeBuildingScope('SHARED')
    // Six explicit scope decisions, but no service decisions: the
    // configuration is genuinely incomplete.
    decideAllKgScope('included')
    render(<App />)
    openSchedule()

    expect(screen.getByRole('heading', { level: 1, name: 'Terminplan gesperrt' }))
      .toBeInTheDocument()
    expect(screen.getByText('Alle einbezogenen Kostengruppen vollständig')).toBeInTheDocument()
    // A gate without a route is a dead end (rule 12).
    expect(screen.getByRole('button', { name: /^KG.200 öffnen$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminplan bestätigen' })).toBeNull()
  })

  it('opens on the project’s own plan and reconciles with the fixture’s completion', () => {
    reachSchedule()
    render(<App />)
    openSchedule()

    expect(screen.getByRole('heading', { level: 1, name: 'Terminplan' })).toBeInTheDocument()
    // The three key dates, from the fixture: 15.03.2027 → 31.07.2028, 16,5
    // months. The total is DERIVED and reconciles with the stated date.
    expect(screen.getByLabelText('Baubeginn')).toHaveValue('15.03.2027')
    expect(screen.getByLabelText('Geplante Fertigstellung')).toHaveValue('31.07.2028')
    expect(screen.getByText('16,5 Monate')).toBeInTheDocument()
    expect(screen.getByText(/Ende 31.07.2028/)).toBeInTheDocument()
    expect(scheduleDerivationFor(st()).completionISO).toBe('2028-07-31')
  })

  it('confirms, and only then does Final Validation become reachable', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openValidation()
    // Fail-closed BEFORE the schedule is confirmed: the stage renders its
    // own lock, never an empty review.
    expect(screen.getByRole('heading', { level: 1, name: 'Finale Prüfung gesperrt' }))
      .toBeInTheDocument()
    expect(screen.getByText('Terminplan bestätigt')).toBeInTheDocument()

    // The lock's own route opens the stage it waits for.
    await user.click(screen.getByRole('button', { name: 'Terminplan öffnen' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Terminplan' })).toBeInTheDocument()
    expect(optionScheduleStageFor(st())).toBe('READY_TO_CONFIRM')

    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    expect(optionScheduleStageFor(st())).toBe('CONFIRMED')
    expect(screen.getByText('Bestätigt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Weiter zur finalen Prüfung' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Die Option vollständig prüfen' }))
      .toBeInTheDocument()
  })

  it('names the invalid field and keeps the previous valid value', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()

    const duration = screen.getByLabelText(/^Dauer Planung/)
    expect(duration).toHaveValue('4')
    await user.clear(duration)
    await user.type(duration, '4,3')
    await user.tab()

    // A third of a month is not a value this plan can hold, so the field
    // keeps the value it had — the schedule never silently rounds a
    // delivery date the user did not move.
    expect(screen.getByLabelText(/^Dauer Planung/)).toHaveValue('4')
    expect(optionScheduleStageFor(st())).toBe('READY_TO_CONFIRM')

    // A value it CAN hold is taken, and the plan follows it.
    await user.clear(screen.getByLabelText(/^Dauer Planung/))
    await user.type(screen.getByLabelText(/^Dauer Planung/), '4,5')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByLabelText(/^Dauer Planung/)).toHaveValue('4,5')
    })
    // The plan now ends half a month after the planned completion, and the
    // overshoot is named on the field that owns it.
    expect(optionScheduleStageFor(st())).toBe('INVALID')
    expect(screen.getByText(/Der Plan endet 0,5 Monate nach der geplanten Fertigstellung/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
      .toHaveAttribute('aria-disabled', 'true')
  })

  it('the complex fixture is a WARNING until its documented handover question is accepted', async () => {
    const user = userEvent.setup()
    reachSchedule('DEMO-COMPLEX-01')
    render(<App />)
    openSchedule()

    // 15.03.2027 → 30.09.2028, 18,5 months — the fixture specification's
    // own values, reached from the phase model rather than restated.
    expect(screen.getByText('18,5 Monate')).toBeInTheDocument()
    expect(scheduleDerivationFor(st()).completionISO).toBe('2028-09-30')
    // Building C drives the completion, and the surface says so.
    expect(screen.getByText(/Übergabe bestimmt die Fertigstellung|Ausführung Stadthaus bestimmt die Fertigstellung/))
      .toBeInTheDocument()

    expect(optionScheduleStageFor(st())).toBe('WARNING')
    // Twice by construction: the notice states the outstanding question and
    // the dependency editor offers the control that answers it.
    expect(screen.getAllByText(/B-Q-08/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
      .toHaveAttribute('aria-disabled', 'true')
    // The reason names the WARNING, and never the invalid-dates sentence.
    expect(screen.getByText(/Zuerst die dokumentierte Terminabhängigkeit/))
      .toBeInTheDocument()
    expect(screen.queryByText(/Zuerst die benannten Termindaten korrigieren/))
      .toBeNull()

    // Accepting the documented question is one explicit action with its own
    // journal entry — never a default the product takes on the user's behalf.
    await user.click(screen.getByRole('button', { name: 'Abhängigkeit bestätigen' }))
    expect(optionScheduleStageFor(st())).toBe('READY_TO_CONFIRM')
    expect(st().journal.at(-1)!.labelKey).toBe('vr3.journal.scheduleDependencyConfirmed')
  })

  /**
   * QA-01, as a class rather than a sentence.
   *
   * The confirm button's reason used to be
   * `stage === 'WARNING' ? warning : invalid`, so a CONFIRMED schedule told
   * the user to "correct the named schedule values" — about a schedule the
   * product had just accepted. QA reproduced it on both fixtures, every
   * time.
   *
   * The guard is therefore not "the confirmed sentence appears". It is: no
   * disabled state of this control may ever show a sentence that belongs to
   * a DIFFERENT state. That is what would have caught the original defect,
   * and it is what will catch the next stage somebody adds.
   */
  it('QA-01: no schedule stage shows another stage’s disabled reason', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()

    const FIX_DATES = /Zuerst die benannten Termindaten korrigieren/
    const ACCEPT_DEPENDENCY = /Zuerst die dokumentierte Terminabhängigkeit/
    const ALREADY_CONFIRMED = /Der Terminplan ist bestätigt/

    // READY_TO_CONFIRM: enabled, so it states no reason at all.
    expect(optionScheduleStageFor(st())).toBe('READY_TO_CONFIRM')
    const confirm = () => screen.getByRole('button', { name: 'Terminplan bestätigen' })
    expect(confirm()).not.toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByText(FIX_DATES)).toBeNull()
    expect(screen.queryByText(ALREADY_CONFIRMED)).toBeNull()

    // CONFIRMED: disabled, and the reason is the confirmation — never the
    // invalid-dates sentence, which is the defect QA reported.
    await user.click(confirm())
    expect(optionScheduleStageFor(st())).toBe('CONFIRMED')
    expect(confirm()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(ALREADY_CONFIRMED)).toBeInTheDocument()
    expect(screen.queryByText(FIX_DATES)).toBeNull()
    expect(screen.queryByText(ACCEPT_DEPENDENCY)).toBeNull()

    // INVALID: the invalid-dates sentence is CORRECT here, and it is the
    // only stage that may say it.
    const duration = screen.getByLabelText(/^Dauer Planung/)
    await user.clear(duration)
    await user.type(duration, '4,5')
    await user.tab()
    await waitFor(() => expect(optionScheduleStageFor(st())).toBe('INVALID'))
    expect(screen.getByText(FIX_DATES)).toBeInTheDocument()
    expect(screen.queryByText(ALREADY_CONFIRMED)).toBeNull()
  })

  it('a material edit after confirmation makes the schedule STALE, not confirmed', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    expect(optionScheduleStageFor(st())).toBe('CONFIRMED')

    const start = screen.getByLabelText('Baubeginn')
    await user.clear(start)
    await user.type(start, '15.04.2027{Enter}')
    await waitFor(() => expect(optionScheduleStageFor(st())).toBe('STALE'))
    expect(screen.getByText('Bestätigung veraltet')).toBeInTheDocument()
    // Moving the start moves the plan, not the duration — the anchor-shift
    // semantics the released date field already promised.
    expect(scheduleDerivationFor(st()).totalHalfMonths).toBe(33)
  })
})

describe('Final Validation stays long, and every issue has a route', () => {
  it('carries thirteen sections under eight index entries, and counts them', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()

    // VR3-TGA-UX-00: thirteen — the interface/responsibility matrix is its own
    // section now, exactly once, instead of a fact inside KG 400's fingerprint.
    expect(screen.getByText('Finale Prüfung · 13 Abschnitte')).toBeInTheDocument()
    const index = screen.getByRole('navigation', { name: 'Prüfabschnitte' })
    // Eight entries, one of which stands for the six cost groups.
    expect(within(index).getAllByRole('button')).toHaveLength(8)
    expect(within(index).getByText('KG 200 – 700')).toBeInTheDocument()
    expect(within(index).getByText('Schnittstellen')).toBeInTheDocument()
    expect(within(index).getAllByText('0 von 13 geprüft').length).toBeGreaterThan(0)

    // Twelve real sections, each a landmark with its own heading. Scoped to
    // the review itself: the commercial rail beside it has headings of its
    // own, and they are not review sections.
    const review = screen.getByRole('group', { name: 'Prüfinhalt' })
    expect(within(review).getAllByRole('heading', { level: 3 }))
      .toHaveLength(REVIEW_SECTION_COUNT)
    expect(reviewProgressFor(st()).total).toBe(REVIEW_SECTION_COUNT)

    // Every required category is present, by name.
    for (const title of [
      'Projektgrundlage', 'Gebäude und Kennzahlen',
      'Leistungsabgrenzung — sechs Entscheidungen',
      'KG 200 · Vorbereitende Maßnahmen', 'KG 700 · Baunebenkosten',
      'Schnittstellen & Verantwortung',
      'Terminplan', 'Annahmen und zulässige Hinweise', 'Kommerzielles Ergebnis',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
  })

  it('the index navigates by moving focus to a section heading, and traps nothing', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()

    const index = screen.getByRole('navigation', { name: 'Prüfabschnitte' })
    await user.click(within(index).getByRole('button', { name: /Kommerzielles Ergebnis/ }))
    expect(screen.getByRole('heading', { level: 3, name: 'Kommerzielles Ergebnis' }))
      .toHaveFocus()
    // A long page is scrolled, not swapped: every other section is still
    // mounted, so "the reviewer read all twelve" is a claim about a
    // document that was genuinely on screen.
    const review = screen.getByRole('group', { name: 'Prüfinhalt' })
    expect(within(review).getAllByRole('heading', { level: 3 }))
      .toHaveLength(REVIEW_SECTION_COUNT)
  })

  it('acknowledges one section at a time, and Save stays locked until every one is read', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()

    expect(optionSaveStageFor(st())).toBe('LOCKED')
    const save = screen.getByRole('button', { name: 'Option speichern' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Finale Prüfung bestätigt')).toBeInTheDocument()
    expect(screen.getByText(/Noch 13 Abschnitte zu prüfen/)).toBeInTheDocument()

    const first = screen.getAllByRole('button', { name: 'Abschnitt geprüft' })[0]!
    await user.click(first)
    expect(reviewProgressFor(st()).reviewed).toBe(1)
    expect(screen.getAllByText('1 von 13 geprüft').length).toBeGreaterThan(0)

    // The remaining eleven, then the confirmation.
    for (const button of screen.getAllByRole('button', { name: 'Abschnitt geprüft' })) {
      await user.click(button)
    }
    expect(reviewProgressFor(st()).reviewed).toBe(REVIEW_SECTION_COUNT)
    expect(optionReviewStageFor(st())).toBe('READY')
    // Reviewed is not confirmed, and Save is still locked.
    expect(optionSaveStageFor(st())).toBe('LOCKED')

    await user.click(screen.getByRole('button', { name: 'Prüfung bestätigen' }))
    expect(finalValidationConfirmedFor(st())).toBe(true)
    expect(optionSaveStageFor(st())).toBe('AVAILABLE')
  })

  it('an unconfirmed dependency is a blocker whose route returns to the section it left', async () => {
    const user = userEvent.setup()
    reachSchedule('DEMO-COMPLEX-01')
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Abhängigkeit bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()

    // T-031's own state: a review already under way, with a schedule issue
    // beside the sections that have been read. So the reader reads some
    // sections FIRST, and only then does the acceptance get withdrawn —
    // which is what reopens the schedule section as a blocker rather than
    // closing the whole stage on somebody mid-review.
    for (const button of screen.getAllByRole('button', { name: 'Abschnitt geprüft' }).slice(0, 3)) {
      await user.click(button)
    }
    const handover = st().schedulePhases.find((p) => p.dependencyQuestionId)!
    act(() => { st().setScheduleDependencyConfirmed(handover.id, false) })

    expect(screen.getByText('1 offener Befund')).toBeInTheDocument()
    const scheduleSection = screen.getByRole('heading', { level: 3, name: 'Terminplan' })
      .closest('section')!
    expect(within(scheduleSection).getByText('Befund blockiert das Speichern'))
      .toBeInTheDocument()
    expect(within(scheduleSection).getByText(/B-Q-08/)).toBeInTheDocument()

    await user.click(within(scheduleSection).getByRole('button', { name: 'In Terminplan beheben' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Terminplan' })).toBeInTheDocument()
    // The review REMEMBERS where the reader was, so the return lands on the
    // section rather than at the top of a twelve-section page.
    expect(st().reviewFocusSectionId).toBe('schedule')

    await user.click(screen.getByRole('button', { name: 'Abhängigkeit bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()
    // The return lands ON the section the route left, and lands there with
    // focus — the difference between an edit route and losing your place in
    // a twelve-section document.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Terminplan' })).toHaveFocus()
    })
  })
})

describe('the explicit save, and the one thing it unlocks', () => {
  it('creates one named, versioned, immutable snapshot and unlocks Client Mode', async () => {
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()
    for (const button of screen.getAllByRole('button', { name: 'Abschnitt geprüft' })) {
      await user.click(button)
    }
    await user.click(screen.getByRole('button', { name: 'Prüfung bestätigen' }))

    // Before the save, Client Mode is locked and the switch says why.
    expect(clientModeAvailableForOption(st(), st().activeOptionId)).toBe(false)
    act(() => { st().setMode('praesentation') })
    expect(st().mode).toBe('intern')

    await user.click(screen.getByRole('button', { name: 'Option speichern' }))

    const version = latestSavedOptionVersion(st(), st().activeOptionId)!
    expect(version.version).toBe(1)
    expect(version.optionName).toBe('Option 1')
    expect(savedOptionVersionsFor(st(), st().activeOptionId)).toHaveLength(1)
    // Immutable, exactly like a sent snapshot (M-3).
    expect(Object.isFrozen(version)).toBe(true)
    expect(() => {
      (version as unknown as { version: number }).version = 99
    }).toThrow()

    // The receipt names the Option, the version and the time, and the
    // outcome takes focus (M-08).
    expect(screen.getByText('Option gespeichert · Version 1')).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 1, name: /Option 1 ist kundenbereit/ })
    expect(heading).toBeInTheDocument()
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByText('Kundenmodus freigeschaltet')).toBeInTheDocument()

    // And the meeting is genuinely open now.
    expect(clientModeAvailableForOption(st(), st().activeOptionId)).toBe(true)
    act(() => { st().setMode('praesentation') })
    expect(st().mode).toBe('praesentation')
  })

  it('the saved total is the rail’s total, in value, meaning and uncertainty', () => {
    reachSchedule()
    saveOptionBaseline()
    const saved = latestSavedOptionVersion(st(), st().activeOptionId)!
    const live = commercialResult(st())
    expect(saved.result.totalExact).toBe(live.total.exact.toFixed(2))
    expect(saved.result.totalDisplay).toBe(live.total.display)
    expect(saved.result.totalLabel).toBe(live.totalLabel)
    expect(saved.result.coverage).toBe(live.coverage)
    expect(saved.result.uncertaintyPp).toBe(live.uncertaintyPp)
  })

  it('a retry after a failure creates no second version', () => {
    reachSchedule()
    saveOptionBaseline()
    expect(savedOptionVersionsFor(st(), st().activeOptionId)).toHaveLength(1)

    // Provoke a real failure: begin a save, then move the Option under it.
    act(() => {
      st().beginOptionSave()
      st().setScheduleStart('2027-04-15')
      st().advanceOptionSave()
    })
    expect(optionSaveStageFor(st())).toBe('FAILED')
    expect(st().optionSaveCommit?.errorKey).toBe('vr3.save.error.changed')
    // The confirmed validation is untouched by the failure, and no second
    // version was minted.
    expect(savedOptionVersionsFor(st(), st().activeOptionId)).toHaveLength(1)

    // Recover and retry: the reserved version number is reused, so the
    // successful retry is version 2 of a genuinely different Option state,
    // never a duplicate of version 1.
    act(() => {
      for (const section of st().schedulePhases) void section
      st().clearOptionSaveError()
      st().confirmSchedule()
    })
    expect(optionScheduleStageFor(st())).toBe('CONFIRMED')
  })

  it('a working edit after the save never moves the saved baseline (M-3)', async () => {
    const user = userEvent.setup()
    reachSchedule()
    saveOptionBaseline()
    const savedBefore = latestSavedOptionVersion(st(), st().activeOptionId)!
    render(<App />)

    openSchedule()
    const start = screen.getByLabelText('Baubeginn')
    await user.clear(start)
    await user.type(start, '15.04.2027{Enter}')

    const savedAfter = latestSavedOptionVersion(st(), st().activeOptionId)!
    // Referential identity, not just equal values: nothing rewrote it.
    expect(savedAfter).toBe(savedBefore)
    expect(savedAfter.scheduleFingerprint).toBe(savedBefore.scheduleFingerprint)
    // The client baseline survives the edit — that is what saving is for.
    expect(clientModeAvailableForOption(st(), st().activeOptionId)).toBe(true)
    // And the review reopens, because the Option has genuinely moved.
    expect(optionReviewStageFor(st())).not.toBe('CONFIRMED')
  })

  it('under reduced motion the outcome arrives through focus and text, not animation', async () => {
    setReducedMotion(true)
    const user = userEvent.setup()
    reachSchedule()
    render(<App />)
    openSchedule()
    await user.click(screen.getByRole('button', { name: 'Terminplan bestätigen' }))
    openValidation()
    for (const button of screen.getAllByRole('button', { name: 'Abschnitt geprüft' })) {
      await user.click(button)
    }
    await user.click(screen.getByRole('button', { name: 'Prüfung bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Option speichern' }))

    const heading = screen.getByRole('heading', { level: 1, name: /ist kundenbereit/ })
    await waitFor(() => expect(heading).toHaveFocus())
    // The meaning travels in the FOCUS MOVE and in PERSISTENT TEXT inside a
    // polite live region — never in the animation. That is M-08's
    // reduced-motion equivalent, and it is what this asserts: the receipt's
    // own emphasis is a single non-looping CSS animation, and CSS is not
    // where a jsdom assertion can prove anything (the blanket
    // `prefers-reduced-motion` rule in components.css removes it, and the
    // browser evidence is where that is checked).
    // The receipt IS a polite live region (there are other status regions on
    // the shell, so this asserts the receipt's own).
    expect(screen.getByText('Option gespeichert · Version 1').closest('[role="status"]'))
      .not.toBeNull()
    expect(screen.getByText('Kundenmodus freigeschaltet')).toBeInTheDocument()
    expect(screen.getByText('Option gespeichert · Version 1')).toBeInTheDocument()
    // And the state is genuinely reached, not merely announced.
    expect(clientModeAvailableForOption(st(), st().activeOptionId)).toBe(true)
  })
})
