import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'
import { demoProject, readiness } from '../../state/projectAnalysis'
import {
  PORTFOLIO_CARD_COUNT, configureCtaName, openProjectCard,
} from '../../test/portfolio'

/**
 * VR3-01 — the project journey as the user actually walks it.
 *
 * The centre of this suite is one rule: **the result anatomy is not mounted
 * before the analysis produced a result.** The surface this ticket replaced
 * rendered the metrics strip, the document list, the conflict section and
 * the project baseline table unconditionally, so a project whose analysis
 * had never run still showed a metrics panel and an empty conflict area. An
 * empty conflict area reads as "no conflicts"; a zero metric reads as
 * "zero". Asserting the ABSENCE of those regions is therefore the point of
 * the first block, not a formality.
 *
 * The job's per-file progression is driven here through the store's own
 * `tickDocumentAnalysis` rather than through the component's timer: the
 * progression is the same one the UI schedules, and driving it directly
 * makes the assertion about STATES instead of about how long a timer took.
 */

beforeEach(() => __resetStoreForTests())

/**
 * Run the analysis of the currently open project to completion AND take the
 * deliberate step into Understanding.
 *
 * Completion no longer navigates by itself (accepted 2026-09-05 Documents
 * workspace audit: the user has to be able to see what happened before the
 * page moves), so the helper does what the rail's primary action does. The
 * step itself is asserted separately, in the Documents workspace suite.
 */
function finishAnalysis() {
  const st = () => useStore.getState()
  const project = demoProject(st().opportunityId)!
  act(() => st().startDocumentAnalysis())
  for (let i = 0; i < project.documents.length * 8; i++) {
    if (st().projectAnalyses[project.id]!.jobState === 'COMPLETE') break
    act(() => st().tickDocumentAnalysis())
  }
  act(() => st().setProjectStage('understanding'))
}

async function openProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  render(<App />)
  await openProjectCard(user, name)
}

describe('the portfolio register holds five cards and exactly two journeys', () => {
  it('renders every card fully imaged, and no retired demonstration row', async () => {
    render(<App />)
    const cards = await screen.findAllByRole('listitem')
    expect(cards).toHaveLength(PORTFOLIO_CARD_COUNT)
    expect(screen.getByRole('button', { name: configureCtaName('Wohnhof Lindenhain') }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: configureCtaName('Quartier Am Güterbogen') }))
      .toBeInTheDocument()
    // No card falls back to the placeholder identity graphic: every project
    // in the register has registered photographic media.
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThanOrEqual(PORTFOLIO_CARD_COUNT)
    for (const card of cards) {
      const img = within(card).getByRole('img')
      expect(img).toHaveAttribute('src')
      expect(img.getAttribute('alt')).toBeTruthy()
    }
    // None of the retired eight demonstration rows survives.
    expect(screen.queryByText(/Musterprojekt Nordfeld/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Musterquartier Südhang/)).not.toBeInTheDocument()
  })

  it('states scale from the fixture itself, and never a partial total', async () => {
    render(<App />)
    const complex = (await screen.findByRole('button', {
      name: configureCtaName('Quartier Am Güterbogen'),
    })).closest('li')!
    // Σ bgfRSTotal over the three buildings — exact, from the fixture.
    expect(within(complex).getByText('19.470 m²')).toBeInTheDocument()
    // NUF is known for ONE of three buildings, so the register refuses to
    // print a sum under a label that would claim the project total.
    expect(within(complex).getByText(/Nicht vollständig erfasst · 1 von 3/))
      .toBeInTheDocument()
    const clean = screen.getByRole('button', {
      name: configureCtaName('Wohnhof Lindenhain'),
    }).closest('li')!
    expect(within(clean).getByText('2.900 m²')).toBeInTheDocument()
    expect(within(clean).getByText('2.120 m²')).toBeInTheDocument()
  })

  it('no card shows document count, documentation state or analysis state', async () => {
    render(<App />)
    await screen.findAllByRole('listitem')
    expect(screen.queryByText(/Dokumente/)).not.toBeInTheDocument()
    expect(screen.queryByText('Dokumentation')).not.toBeInTheDocument()
    expect(screen.queryByText('Dokumentanalyse')).not.toBeInTheDocument()
  })
})

describe('before the analysis: the document register, and NO result anatomy', () => {
  it('is a document workspace: the task is the H1 and the rows are on screen', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')

    // The page H1 names the TASK. The project name is context, not the
    // page's subject — it is present, once, in the compact context bar.
    expect(screen.getByRole('heading', { level: 1, name: 'Dokumente' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Wohnhof Lindenhain' }))
      .not.toBeInTheDocument()
    const context = document.querySelector('.a3-project-context') as HTMLElement
    expect(within(context).getByText('Wohnhof Lindenhain')).toBeInTheDocument()
    expect(within(context).getByText(/Lindenhain Wohnen GmbH · Freiburg/))
      .toBeInTheDocument()
    // Every document is listed, with its own always-available inspection.
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(8)
    expect(document.querySelectorAll('.a3-drow-action-inspect')).toHaveLength(8)
    // The register's heading IS its result count; eight results need no
    // pagination at a page size of ten.
    expect(screen.getByRole('heading', { level: 2, name: '8 Dokumente' }))
      .toBeInTheDocument()
    expect(document.querySelector('.a3-pgn')).toBeNull()
    // The retired composition: hero, essay, empty-result card, aggregate
    // inspect action and static tally are all gone.
    expect(screen.queryByText('Noch keine Analyseergebnisse')).not.toBeInTheDocument()
    expect(screen.queryByText(/8 Dokumente in der Warteschlange/)).not.toBeInTheDocument()
    expect(screen.queryByText('Grundrisse · 3')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '8 Dokumente ansehen' }))
      .not.toBeInTheDocument()
  })

  it('states READY, never QUEUED, and shows no progress before work is accepted', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')

    // `QUEUED` claims processing was accepted and is waiting to start. It
    // was not: nothing has been submitted.
    expect(screen.queryByText('In der Warteschlange')).not.toBeInTheDocument()
    expect(screen.getAllByText('Bereit für die Analyse').length).toBeGreaterThan(8)
    // No zero-percent processing visuals, anywhere, before a run exists.
    expect(document.querySelectorAll('.a3-drow-meter')).toHaveLength(0)
    expect(document.querySelector('.a3-pjob-progress')).toBeNull()
    // The scope-aware action names the set the operation will process.
    expect(screen.getByRole('button', {
      name: 'Alle 8 analysierbaren Dokumente analysieren',
    })).toBeInTheDocument()
  })

  it('mounts no metrics, no conflict, no question and no readiness panel', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')

    // The four regions the retired surface always mounted.
    expect(document.querySelector('.a3-understanding-metrics')).toBeNull()
    expect(document.querySelector('.a3-cfr')).toBeNull()
    expect(document.querySelector('.a3-qq')).toBeNull()
    expect(document.querySelector('.a3-readiness')).toBeNull()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    // And no Create Option control exists yet at all.
    expect(screen.queryByRole('button', { name: 'Option anlegen' })).not.toBeInTheDocument()
    // Crucially: the six conflicts are NOT reported as zero.
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument()
  })

  it('only the Start action moves the job out of NOT STARTED', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    const st = () => useStore.getState()
    expect(st().projectAnalyses['DEMO-HAPPY-01']!.jobState).toBe('NOT_STARTED')
    // A tick on its own does nothing: the transition has exactly one door.
    act(() => st().tickDocumentAnalysis())
    expect(st().projectAnalyses['DEMO-HAPPY-01']!.jobState).toBe('NOT_STARTED')
    await user.click(screen.getByRole('button', {
      name: 'Alle 8 analysierbaren Dokumente analysieren',
    }))
    expect(st().projectAnalyses['DEMO-HAPPY-01']!.jobState).toBe('RUNNING')
  })
})

describe('during the analysis: per-file truth', () => {
  it('names the active file, the processed count and every file with its own state', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    await user.click(screen.getByRole('button', {
      name: 'Alle 8 analysierbaren Dokumente analysieren',
    }))
    const st = () => useStore.getState()
    act(() => st().tickDocumentAnalysis())

    // Semantic progress, with the real denominator in the accessible value.
    const meter = document.querySelector('.a3-pjob-meter')!
    expect(meter).toHaveAttribute('aria-valuemax', '8')
    // The active panel names the file, and the row for it exists too — the
    // filename appears in both places on purpose, so the query is scoped.
    expect(within(document.querySelector('.a3-pjob-active') as HTMLElement)
      .getByText('01_Client_Beschreibung.pdf')).toBeInTheDocument()
    // All eight rows are present with their own state from the first tick.
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(8)
  })

  it('a status filter changes which rows are listed and never the global scope', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    act(() => useStore.getState().setProjectStage('documents'))

    // Unfiltered: ten of thirty-six, because the register paginates from
    // the eleventh result.
    expect(screen.getByRole('heading', { level: 2, name: '36 Dokumente' }))
      .toBeInTheDocument()
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(10)

    await user.click(screen.getByRole('radio', { name: 'Aufmerksamkeit' }))
    // 4 warnings + 3 low confidence + 1 failed = 8 rows listed…
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(8)
    expect(screen.getByRole('heading', { level: 2, name: '8 von 36 Dokumenten' }))
      .toBeInTheDocument()
    // …while the rail's own facts still describe all thirty-six. Filtering
    // is presentation; it never narrows what the analysis covered.
    const rail = document.querySelector('.a3-docws-rail') as HTMLElement
    expect(within(rail).getByText('Analysierbar').parentElement)
      .toHaveTextContent('36')
    // A filter that is active offers its own way out.
    expect(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
      .toBeInTheDocument()
  })

  it('a failed file explains itself IN ITS ROW and offers local recovery there', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    act(() => useStore.getState().setProjectStage('documents'))
    await user.click(screen.getByRole('radio', { name: 'Aufmerksamkeit' }))

    const failed = [...document.querySelectorAll('.a3-drow')]
      .find((row) => row.textContent?.includes('24_C_Grundriss_UG_V1_SCAN.pdf')) as HTMLElement
    expect(failed).toBeDefined()
    // The row carries the outcome as a word and the reason as text.
    expect(within(failed).getByText('Fehlgeschlagen')).toBeInTheDocument()
    expect(failed.querySelector('.a3-sst-reason')?.textContent ?? '')
      .toMatch(/Erkennung/)
    // Recovery is local and only what the Product supports.
    for (const action of ['Datei ersetzen', 'Erneut lesen', 'Entfernen']) {
      expect(within(failed).getByRole('button', { name: new RegExp(action) }))
        .toBeInTheDocument()
    }
    // Inspection is independent of recovery: it exists on this row and on
    // rows that have nothing to recover from.
    expect(within(failed).getByRole('button', { name: /Beleg ansehen/ }))
      .toBeInTheDocument()
  })
})

describe('the clean route reaches readiness without review ceremony', () => {
  it('ends READY with the Create Option action available and prominent', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()

    await waitFor(() => expect(document.querySelector('.a3-ready')).not.toBeNull())
    const create = screen.getByRole('button', { name: 'Option anlegen' })
    expect(create).toBeEnabled()
    // The confidence facts state the six facts once each, and the verification
    // card reconciles with the fixture: one building, 2.900 m², eight of eight
    // documents. Scoped to the card: 2.900 m² is legitimately both the project
    // total and its single building's area.
    const verify = document.querySelector('.a3-verify') as HTMLElement
    expect(within(verify).getByText('2.900')).toBeInTheDocument()
    const facts = document.querySelector('.a3-ready-facts') as HTMLElement
    expect(within(facts).getByText('8/8 verarbeitet · 0 Hinweise')).toBeInTheDocument()
    // No ceremonial acknowledgement of empty issue queues, and — the clean-pass
    // audit's PU-01 — no section titled `Prüfung erforderlich` above a table
    // saying nothing requires review.
    expect(document.querySelector('.a3-cfr')).toBeNull()
    expect(screen.queryByText('Prüfung erforderlich')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})

describe('the complex route: the gate, the comparison and the audit record', () => {
  it('locks Create Option with the reason, the count and a route to resolve it', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()

    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3))
    const create = screen.getByRole('button', { name: 'Option anlegen' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    // A gate is never a bare disabled control: it states its count…
    // The reason lives with the action, associated and in reading order.
    expect(create).toHaveAttribute('aria-describedby')
    expect(screen.getByText(/6 blockierende strittige Angaben entscheiden/))
      .toBeInTheDocument()
    // …its unmet prerequisite…
    expect(screen.getByText('Keine blockierenden strittigen Angaben')).toBeInTheDocument()
    // …and the direct route that resolves it.
    expect(screen.getByRole('button', { name: 'Zu den strittigen Angaben' }))
      .toBeInTheDocument()
  })

  it('shows competing sources with authority and records the decision, then unlocks', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3))
    await user.click(screen.getByRole('tab', { name: /Strittige Angaben/ }))

    expect(document.querySelectorAll('.a3-cfr-open')).toHaveLength(6)
    const first = document.querySelector('.a3-cfr')! as HTMLElement
    // Both competing values, each with the document that produced it.
    expect(within(first).getByText('19.710')).toBeInTheDocument()
    expect(within(first).getByText('19.470')).toBeInTheDocument()
    expect(within(first).getByText(/04_Flaechenliste_Gesamt_FINAL/)).toBeInTheDocument()
    // The recommendation is labelled as a recommendation, never as truth.
    expect(within(first).getByText('Systemvorschlag')).toBeInTheDocument()
    expect(within(first).getByText('Empfohlener Wert')).toBeInTheDocument()

    const st = () => useStore.getState()
    for (let i = 0; i < 6; i++) {
      const buttons = screen.queryAllByRole('button', { name: 'Entscheidung bestätigen' })
      if (buttons.length === 0) break
      await user.click(buttons[0]!)
    }
    const analysis = st().projectAnalyses['DEMO-COMPLEX-01']!
    expect(Object.keys(analysis.conflictDecisions)).toHaveLength(6)
    // Every decision carries its actor and its rejected value.
    for (const decision of Object.values(analysis.conflictDecisions)) {
      expect(decision.actor).toBe('sales-user')
      expect(decision.rejectedCandidateIds.length).toBeGreaterThan(0)
    }
    expect(readiness(demoProject('DEMO-COMPLEX-01')!, analysis).canCreateOption).toBe(true)
    // Each decision is a journal event — data cannot change without one (M-4).
    expect(st().journal.filter((e) => e.kind === 'conflict.resolved')).toHaveLength(6)
  })

  it('open questions stay distinguishable from conflicts and do not all block', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3))
    await user.click(screen.getByRole('tab', { name: /Offene Fragen/ }))

    // The page heading names the section; the queue's own heading carries
    // the count. Two identical headings would be a duplicated label.
    expect(screen.getByRole('heading', { level: 1, name: 'Fragen, keine Fehler' }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Offene Fragen · 7/ }))
      .toBeInTheDocument()
    expect(screen.getByText(/0 davon blockieren/)).toBeInTheDocument()
    // A question item states whether it blocks, in words.
    expect(screen.getAllByText('blockiert nicht').length).toBeGreaterThan(0)
    // A permitted assumption is explicit.
    expect(screen.getAllByText('Zulässige Annahme').length).toBeGreaterThan(0)
    // No question is rendered as an error.
    const queue = document.querySelector('.a3-qq')! as HTMLElement
    expect(queue.querySelector('.a3-sst-error')).toBeNull()
  })

  it('re-analysis after a source change marks only the affected decision stale', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    const st = () => useStore.getState()
    act(() => {
      const project = demoProject('DEMO-COMPLEX-01')!
      for (const conflict of project.conflicts) {
        st().resolveProjectConflict(conflict.id, {
          kind: 'candidate', candidateId: conflict.recommendedCandidateId,
        })
      }
    })
    expect(st().canCreateOptions()).toBe(true)

    act(() => st().replaceDocumentRow('B-DOC-11', '11_A_Bueroflaechen_V3.pdf'))
    const analysis = st().projectAnalyses['DEMO-COMPLEX-01']!
    expect(analysis.staleConflictIds).toEqual(['B-CF-05'])
    // The five untouched decisions survive; manual work is not discarded.
    expect(Object.keys(analysis.conflictDecisions)).toHaveLength(6)
    expect(st().canCreateOptions()).toBe(false)
  })
})

describe('accessibility of the project surfaces', () => {
  it('the workflow is six grouped stages, one current, and no KG rows', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    const nav = screen.getByRole('navigation', { name: 'Projektablauf' })
    expect(nav).toBeInTheDocument()
    expect(nav.querySelectorAll('.a3-wfn-stage')).toHaveLength(6)
    for (const stage of [
      'Dokumente', 'Verstehen', 'Konfigurieren', 'Kalkulieren', 'Prüfen', 'Präsentieren',
    ]) {
      expect(within(nav).getByText(stage)).toBeInTheDocument()
    }
    // Exactly one stage is current, and it is this page's.
    const current = nav.querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Dokumente')
    // The one lock that is useful names its prerequisite; the four stages
    // after it stay neutral rather than reporting four failures.
    expect(within(nav).getByText(/Dokumentanalyse fehlt/)).toBeInTheDocument()
    expect(within(nav).queryAllByText(/^KG \d00$/)).toHaveLength(0)
    expect(within(nav).getAllByText('ausstehend')).toHaveLength(4)
  })

  it('the Understanding sections are a keyboard-operable tablist', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3))

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    // Roving tabindex: exactly one tab is a Tab stop, and it is the
    // selected one.
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
    await user.tab()
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('tab')[0]))
    await user.keyboard('{ArrowRight}')
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')
    // Each tab controls a real panel.
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-controls')
    }
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })

  it('the job announces its progress through one scoped polite region', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    await user.click(screen.getByRole('button', {
      name: 'Alle 8 analysierbaren Dokumente analysieren',
    }))
    const live = document.querySelectorAll('.a3-pjob [aria-live="polite"]')
    // One region for the whole job — not one per row.
    expect(live).toHaveLength(1)
    expect(document.querySelector('.a3-pjob')).toHaveAttribute('aria-busy', 'true')
  })

  it('every document state is carried by a word, not by colour alone', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    act(() => useStore.getState().setProjectStage('documents'))
    for (const row of Array.from(document.querySelectorAll('.a3-drow'))) {
      const label = row.querySelector('.a3-sst-label')
      expect(label?.textContent?.trim().length ?? 0).toBeGreaterThan(0)
      expect(row.querySelector('.a3-sst-glyph')).not.toBeNull()
    }
  })
})

/**
 * ACCEPT-01 (VR3-02 acceptance remediation).
 *
 * The Option-created hand-off printed the number of RECORDED conflict
 * decisions under the label that means the number still OUTSTANDING. On the
 * complex fixture that produced "Blockierende strittige Angaben 6" on a
 * surface the user can only reach because that count had reached zero — the
 * hand-off contradicted the gate that opened it.
 *
 * These two cases guard the CLASS, not the sentence: the outstanding label
 * must never appear on this surface, and the number that IS shown has to be
 * the decisions it claims to be, against the project's own conflict count.
 */
describe('the Option-created hand-off never contradicts the gate that opened it', () => {
  const OUTSTANDING = 'Blockierende strittige Angaben'

  it('reports six DECIDED conflicts on the complex route, and none outstanding', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    const st = () => useStore.getState()

    const project = demoProject('DEMO-COMPLEX-01')!
    expect(project.conflicts).toHaveLength(6)
    act(() => {
      for (const conflict of project.conflicts) {
        st().resolveProjectConflict(conflict.id, {
          kind: 'candidate', candidateId: conflict.recommendedCandidateId,
        })
      }
    })
    // The gate is open precisely BECAUSE nothing is outstanding any more.
    expect(readiness(project, st().projectAnalyses['DEMO-COMPLEX-01']!)
      .unresolvedBlockingConflicts).toBe(0)
    act(() => { st().createOption() })
    act(() => { st().setProjectStage('createOption') })

    const readinessPanel = document.querySelector('.a3-readiness')!
    // The outstanding label cannot appear here at all: this surface has no
    // outstanding conflicts to report, by construction.
    expect(readinessPanel.textContent).not.toContain(OUTSTANDING)
    // What it does report is the decisions the Option inherited, named.
    expect(within(readinessPanel as HTMLElement)
      .getByText('Entschiedene strittige Angaben')).toBeInTheDocument()
    expect(within(readinessPanel as HTMLElement).getByText('6 von 6')).toBeInTheDocument()
    expect(st().projectBaseline!.conflictDecisions).toHaveLength(6)
  })

  it('omits the row entirely on a project that had nothing to decide', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    const st = () => useStore.getState()
    expect(demoProject('DEMO-HAPPY-01')!.conflicts).toHaveLength(0)

    act(() => { st().createOption() })
    act(() => { st().setProjectStage('createOption') })

    const readinessPanel = document.querySelector('.a3-readiness')!
    expect(readinessPanel.textContent).not.toContain(OUTSTANDING)
    // A zero here would read as a finding about the project. Absence is the
    // honest state: there was never anything to decide.
    expect(readinessPanel.textContent).not.toContain('Entschiedene strittige Angaben')
    expect(within(readinessPanel as HTMLElement).getByText('Gebäude')).toBeInTheDocument()
  })
})

describe('Option creation hands off a gated, authority-aware baseline', () => {
  it('emits the snapshot as one journalled confirmation and only then creates the Option', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    await waitFor(() => expect(document.querySelector('.a3-ready')).not.toBeNull())

    const st = () => useStore.getState()
    expect(st().projectBaseline).toBeNull()
    act(() => { st().createOption() })

    const snapshot = st().projectBaseline!
    expect(snapshot.projectId).toBe('DEMO-HAPPY-01')
    expect(snapshot.buildingCount).toBe(1)
    expect(snapshot.bgfRSTotal).toBe('2900.00')
    expect(st().options).toHaveLength(1)
    expect(st().projectParamsConfirmed).toBe(true)
    // The permission it grants changed through an EVENT (M-4).
    expect(st().journal.some((e) => e.kind === 'value.confirmed')).toBe(true)
  })

  it('a closed gate refuses creation and leaves every decision intact', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    const st = () => useStore.getState()

    act(() => { st().beginOptionCreation() })
    act(() => { expect(st().createOption()).toBeNull() })

    const analysis = st().projectAnalyses['DEMO-COMPLEX-01']!
    expect(st().optionCommit).toEqual({
      projectId: 'DEMO-COMPLEX-01', stage: null, errorKey: 'vr3.option.error.gateClosed',
    })
    expect(st().options).toHaveLength(0)
    // Readiness and resolution work are untouched by the refusal.
    expect(analysis.jobState).toBe('COMPLETE')
    expect(st().projectBaseline).toBeNull()
  })

  /**
   * The two states the acceptance audit found unreachable.
   *
   * They existed in the model and a unit test proved the store could hold
   * them, but the click handler ran both stages in one tick: React never
   * painted `creating Option`, and the failure branch needed a race nobody
   * could win. The commitment is now staged, so both are ordinary states.
   */
  it('holds the creating-Option state through its stages, naming each one', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    await waitFor(() => expect(document.querySelector('.a3-ready')).not.toBeNull())
    const st = () => useStore.getState()

    // Scoped to the gate: the spine's step 3 shows the same words, and its
    // accessible name differs only by position and state.
    const gate = () => document.querySelector('.a3-gate') as HTMLElement
    await user.click(within(gate()).getByRole('button', { name: 'Option anlegen' }))

    // Stage 1 is HELD and named: the baseline is committed before an Option
    // exists, and the control says so rather than showing a percentage.
    expect(st().optionCommit?.stage).toBe('BASELINE')
    expect(screen.getByText('Projektgrundlage wird festgeschrieben …')).toBeInTheDocument()
    expect(st().options).toHaveLength(0)
    // The busy control carries the state semantically, not just visually.
    const control = within(gate())
      .getByRole('button', { name: /Projektgrundlage wird festgeschrieben/ })
    expect(control).toHaveAttribute('aria-busy', 'true')
    // A second activation while the commitment is in flight is a no-op —
    // the guard that matters, since the canonical Button blocks with
    // `aria-disabled` and the click still dispatches.
    await user.click(control)
    expect(st().optionCommit?.stage).toBe('BASELINE')

    act(() => { st().advanceOptionCreation() })
    expect(st().optionCommit?.stage).toBe('OPTION')
    expect(st().projectBaseline).not.toBeNull()
    expect(st().options).toHaveLength(0)

    act(() => { st().advanceOptionCreation() })
    expect(st().optionCommit).toBeNull()
    expect(st().options).toHaveLength(1)
  })

  it('keeps the commitment out of the undoable record', async () => {
    // The defect this replaces: the commitment lived inside
    // `ProjectAnalysis`, and every journalled analysis mutation restores a
    // whole previous `ProjectAnalysis` on undo. Undoing a conflict decision
    // mid-commitment therefore restored a snapshot from BEFORE it started
    // and erased it in mid-air — no Option, no error, no trace. Found in
    // the browser, not by a test, so here is the test.
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    const st = () => useStore.getState()
    act(() => st().seedProjectCheckpoint('DEMO-COMPLEX-01'))
    const conflictId = Object.keys(
      st().projectAnalyses['DEMO-COMPLEX-01']!.conflictDecisions,
    )[0]!

    act(() => { st().beginOptionCreation() })
    expect(st().optionCommit?.stage).toBe('BASELINE')
    // An unrelated journalled mutation, then its undo.
    act(() => { st().reopenProjectConflict(conflictId) })
    act(() => { st().undo() })
    // The commitment survived both, because it does not live in the record
    // those two rewrote.
    expect(st().optionCommit?.stage).toBe('BASELINE')
    // And it still concludes — with an outcome, not with silence.
    act(() => { st().advanceOptionCreation() })
    act(() => { st().advanceOptionCreation() })
    expect(st().optionCommit).toBeNull()
    expect(st().options).toHaveLength(1)
  })

  it('exactly one of stage and errorKey is ever set', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    const st = () => useStore.getState()
    const consistent = () => {
      const c = st().optionCommit
      if (!c) return
      expect(Boolean(c.stage) !== Boolean(c.errorKey)).toBe(true)
    }
    consistent()
    act(() => { st().beginOptionCreation() }); consistent()
    act(() => { st().beginOptionCreation() }); consistent()  // idempotent
    act(() => { st().advanceOptionCreation() }); consistent()
    act(() => { st().advanceOptionCreation() }); consistent()
    act(() => { st().advanceOptionCreation() }); consistent()  // past the end
    expect(st().options).toHaveLength(1)
  })

  it('a prerequisite withdrawn mid-commitment fails it and preserves every resolution', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    const st = () => useStore.getState()
    act(() => st().seedProjectCheckpoint('DEMO-COMPLEX-01'))
    await waitFor(() => expect(
      readiness(demoProject('DEMO-COMPLEX-01')!, st().projectAnalyses['DEMO-COMPLEX-01']!)
        .canCreateOption,
    ).toBe(true))
    const current = () => st().projectAnalyses['DEMO-COMPLEX-01']!
    const decisionsBefore = current().conflictDecisions
    const resolvedBefore = Object.keys(decisionsBefore).length
    expect(resolvedBefore).toBe(6)

    act(() => { st().beginOptionCreation() })
    expect(st().optionCommit?.stage).toBe('BASELINE')

    // The race, now winnable: reopen one conflict while the commitment is
    // in flight. This is a REAL failure path, not a contrived one — undo is
    // available on every resolved conflict (DC-29).
    const firstConflict = Object.keys(decisionsBefore)[0]!
    act(() => { st().reopenProjectConflict(firstConflict) })
    act(() => { st().advanceOptionCreation() })

    expect(st().optionCommit).toEqual({
      projectId: 'DEMO-COMPLEX-01', stage: null, errorKey: 'vr3.option.error.gateClosed',
    })
    // The failure is VISIBLE, not merely announced: the gate owns the
    // message and its retry, and a withdrawn prerequisite also drops the
    // ready surface, so the user is put on the tab that carries them.
    expect(st().understandingTab).toBe('overview')
    await waitFor(() => expect(document.querySelector('.a3-gate-error')).not.toBeNull())
    const failure = document.querySelector('.a3-gate-error')!
    expect(failure.textContent).toContain('eine Voraussetzung hat sich geändert')
    // It is an alert AND it takes focus, so it is reached rather than merely
    // announced: a gate sits far down a long review surface, and the failure
    // was once announced correctly while nothing on screen showed it.
    expect(failure).toHaveAttribute('role', 'alert')
    await waitFor(() => expect(document.activeElement).toBe(failure))
    // The recovery route is inside the region that just took focus.
    expect(failure.querySelector('button')).not.toBeNull()
    // And the word FAILED appears ONCE on the gate, not twice: the gate's
    // status line and the failure region used to print it both.
    const gateEl = failure.closest('.a3-gate')!
    // 'Fehlgeschlagen' in the DOM; the uppercase on screen is CSS.
    expect(gateEl.textContent!.match(/Fehlgeschlagen/g) ?? []).toHaveLength(1)
    // NOTHING else moved: no Option, no baseline, and the five decisions
    // that were not undone are still exactly as they were.
    expect(st().options).toHaveLength(0)
    expect(st().projectBaseline).toBeNull()
    expect(Object.keys(current().conflictDecisions)).toHaveLength(resolvedBefore - 1)
    expect(current().jobState).toBe('COMPLETE')

    // And the error is recoverable: clearing it returns the gate to the
    // state the work actually justifies, without redoing the analysis.
    act(() => { st().clearOptionCreationError() })
    expect(st().optionCommit).toBeNull()
    expect(current().jobState).toBe('COMPLETE')
  })
})

/**
 * The clean-pass split (accepted 2026-09-05 Project Understanding audit).
 *
 * Two projects reach `PROJECT_READY_FOR_OPTION` and used to render the
 * IDENTICAL composition. This block asserts the two things that made that
 * wrong, from the surface rather than from the selector:
 *
 *   1. on a clean pass the page states no review it does not have;
 *   2. on a ready state that DOES carry review work, every number it states
 *      has a keyboard-reachable route to the thing it counts.
 *
 * (2) is a FIX, not a preservation. At the audit baseline `main` held five
 * focusable elements on this state and not one of them was a route: the
 * Conflicts and Questions surfaces unmounted the moment the gate opened, so
 * seven open questions, eighteen attention values and one failed document
 * were dead numerals.
 */
describe('the ready state branches on cleanliness, never on the gate', () => {
  it('states no review on a clean pass, and mounts no surface that has nothing behind it', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    await waitFor(() => expect(document.querySelector('.a3-ready')).not.toBeNull())

    // PU-01: the section titled `Prüfung erforderlich` above a table saying
    // nothing requires review.
    expect(screen.queryByText('Prüfung erforderlich')).not.toBeInTheDocument()
    // PU-03: the H1 claimed a resolution history on a project with no conflicts.
    expect(screen.queryByText('Alle blockierenden strittigen Angaben sind entschieden.'))
      .not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Bereit, eine Option anzulegen' }))
      .toBeInTheDocument()
    // A region is absent only when ITS OWN predicate is empty.
    expect(demoProject('DEMO-HAPPY-01')!.conflicts).toHaveLength(0)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    // Six facts, each stated once, reachable without expanding anything.
    expect(document.querySelectorAll('.a3-ready-fact')).toHaveLength(6)
    expect(document.querySelector('.a3-ready-facts')!.tagName).toBe('DL')
  })

  it('keeps the disclosed region in the DOM under aria-expanded / aria-controls', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    await waitFor(() => expect(document.querySelector('.a3-ready')).not.toBeNull())

    const control = screen.getByRole('button', { name: /Analysedetails ansehen/ })
    expect(control).toHaveAttribute('aria-expanded', 'false')
    const region = document.getElementById(control.getAttribute('aria-controls')!)
    // Visual removal is not semantic removal: the region exists, addressed by
    // the control, before it is ever opened.
    expect(region).not.toBeNull()
    expect(region!.textContent).toContain('Was das System verstanden hat')

    await user.click(control)
    expect(screen.getByRole('button', { name: /Analysedetails ausblenden/ }))
      .toHaveAttribute('aria-expanded', 'true')
    expect(region!.hidden).toBe(false)
    // The provenance reads as three proportions of one total, never as a
    // partition that does not sum.
    // Source-evidenced and manually-confirmed are BOTH 42 of 42: they overlap,
    // which is exactly why they are stated as proportions and not as a split.
    expect(within(region as HTMLElement).getAllByText('42 von 42 Werten')).toHaveLength(2)
    expect(within(region as HTMLElement).getByText('0 von 42 Werten')).toBeTruthy()
  })

  it('restores a route to every number it states on a ready state that carries review work', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    const st = () => useStore.getState()
    const project = demoProject('DEMO-COMPLEX-01')!
    act(() => {
      for (const conflict of project.conflicts) {
        st().resolveProjectConflict(conflict.id, {
          kind: 'candidate', candidateId: conflict.recommendedCandidateId,
        })
      }
    })
    await waitFor(() => expect(document.querySelector('.a3-ready')).not.toBeNull())

    // The gate is OPEN …
    expect(screen.getByRole('button', { name: 'Option anlegen' }))
      .not.toHaveAttribute('aria-disabled', 'true')
    // … and the page nonetheless carries the three routes that vanished with
    // it at the audit baseline.
    expect(screen.getByRole('button', { name: 'Zu den strittigen Angaben' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Zu den offenen Fragen' }).length)
      .toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Fehlgeschlagene Dokumente ansehen' }))
      .toBeInTheDocument()
    // Both review surfaces are mounted again, each naming its own count.
    expect(screen.getByRole('tab', { name: 'Strittige Angaben · 6' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Offene Fragen · 7' })).toBeInTheDocument()

    // PU-11: `processedCount` counts FAILED as processed, so the fact must
    // never print `36/36` while a document failed. It states the distribution.
    const facts = document.querySelector('.a3-ready-facts') as HTMLElement
    expect(facts.textContent).not.toContain('36/36')
    expect(facts.textContent).toContain('1 fehlgeschlagen')

    // The route opens the surface AND takes focus with it: switching a tab
    // without moving focus leaves a keyboard user at the top of a page whose
    // bottom silently changed.
    await user.click(screen.getByRole('button', { name: 'Zu den strittigen Angaben' }))
    expect(screen.getByRole('tab', { name: 'Strittige Angaben · 6' }))
      .toHaveAttribute('aria-selected', 'true')
    expect(document.querySelector('.a3-cfr')).not.toBeNull()
  })
})
