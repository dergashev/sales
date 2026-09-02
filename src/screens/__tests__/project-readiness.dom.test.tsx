import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'
import { demoProject, readiness } from '../../state/projectAnalysis'

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

/** Run the analysis of the currently open project to completion. */
function finishAnalysis() {
  const st = () => useStore.getState()
  const project = demoProject(st().opportunityId)!
  act(() => st().startDocumentAnalysis())
  for (let i = 0; i < project.documents.length * 8; i++) {
    if (st().projectAnalyses[project.id]!.jobState === 'COMPLETE') break
    act(() => st().tickDocumentAnalysis())
  }
}

async function openProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: `${name} öffnen` }))
}

describe('the normal Project List contains exactly two complete projects', () => {
  it('renders both fixtures, both fully imaged, and no third demo', async () => {
    render(<App />)
    const cards = await screen.findAllByRole('listitem')
    expect(cards).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Wohnhof Lindenhain öffnen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quartier Am Güterbogen öffnen' })).toBeInTheDocument()
    // No card falls back to the placeholder identity graphic: both projects
    // have registered photographic media.
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThanOrEqual(2)
    for (const card of cards) {
      const img = within(card).getByRole('img')
      expect(img).toHaveAttribute('src')
      expect(img.getAttribute('alt')).toBeTruthy()
    }
    // None of the retired eight demonstration rows survives.
    expect(screen.queryByText(/Musterprojekt Nordfeld/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Musterquartier Südhang/)).not.toBeInTheDocument()
  })

  it('states the counts the fixture declares, not a screen-local number', async () => {
    render(<App />)
    const complex = (await screen.findByRole('button', { name: 'Quartier Am Güterbogen öffnen' }))
      .closest('li')!
    expect(within(complex).getByText(/3 Gebäude · 36 Dokumente/)).toBeInTheDocument()
    const clean = screen.getByRole('button', { name: 'Wohnhof Lindenhain öffnen' }).closest('li')!
    expect(within(clean).getByText(/1 Gebäude · 8 Dokumente/)).toBeInTheDocument()
  })
})

describe('before the analysis: a prerequisite state, and NO result anatomy', () => {
  it('explains the documents and the unlock, and offers exactly one primary action', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')

    expect(screen.getByRole('heading', { level: 1, name: 'Wohnhof Lindenhain' }))
      .toBeInTheDocument()
    expect(screen.getByText('Noch keine Analyseergebnisse')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dokumentanalyse starten' })).toBeInTheDocument()
    // The document set is explained from its own register.
    expect(screen.getByText(/8 Dokumente in der Warteschlange/)).toBeInTheDocument()
    expect(screen.getByText('Grundrisse · 3')).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Dokumentanalyse starten' }))
    expect(st().projectAnalyses['DEMO-HAPPY-01']!.jobState).toBe('RUNNING')
  })
})

describe('during the analysis: per-file truth', () => {
  it('names the active file, the processed count and every file with its own state', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    await user.click(screen.getByRole('button', { name: 'Dokumentanalyse starten' }))
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

  it('a filter changes which rows are listed and never the overall counts', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()

    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3))
    await user.click(screen.getByRole('tab', { name: /Übersicht/ }))
    // Back to the document stage to reach the filters.
    act(() => useStore.getState().setProjectStage('documents'))

    const attention = screen.getByRole('button', { name: /Brauchen Aufmerksamkeit/ })
    expect(attention).toHaveAttribute('aria-pressed', 'false')
    await user.click(attention)
    expect(attention).toHaveAttribute('aria-pressed', 'true')
    // 4 warnings + 3 low confidence + 1 failed = 8 rows listed…
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(8)
    // …while the job's own heading still states all 36.
    expect(screen.getByText(/36 Dateien verarbeitet/)).toBeInTheDocument()
  })

  it('a failed file explains the cause, the consequence and offers local recovery', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Quartier Am Güterbogen')
    finishAnalysis()
    act(() => useStore.getState().setProjectStage('documents'))

    expect(screen.getByText(/24_C_Grundriss_UG_V1_SCAN\.pdf konnte nicht erkannt werden/))
      .toBeInTheDocument()
    // The consequence names what is affected and that the job continued.
    expect(screen.getByText(/Die übrigen 35 Dateien bleiben nutzbar/)).toBeInTheDocument()
    const notice = document.querySelector('.a3-pjob-notice')!
    expect(within(notice as HTMLElement).getByRole('button', { name: /Datei ersetzen/ }))
      .toBeInTheDocument()
    expect(within(notice as HTMLElement).getByRole('button', { name: /Erneut lesen/ }))
      .toBeInTheDocument()
  })
})

describe('the clean route reaches readiness without review ceremony', () => {
  it('ends READY with the Create Option action available and prominent', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()

    await waitFor(() => expect(document.querySelector('.a3-readiness')).not.toBeNull())
    const create = screen.getByRole('button', { name: 'Option anlegen' })
    expect(create).toBeEnabled()
    // The readiness rows state the facts, and the metrics reconcile with
    // the fixture: one building, 2.900 m², eight of eight documents.
    // Scoped to the metrics strip: 2.900 m² is legitimately both the
    // project total and its single building's area.
    const metrics = document.querySelector('.a3-understanding-metrics') as HTMLElement
    expect(within(metrics).getByText('2.900')).toBeInTheDocument()
    expect(within(metrics).getByText('8/8')).toBeInTheDocument()
    // No ceremonial acknowledgement of empty issue queues.
    expect(document.querySelector('.a3-cfr')).toBeNull()
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
  it('the workflow spine is a real navigation with a current step and a reason for each lock', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    const spine = screen.getByRole('navigation', { name: 'Projekt- und Optionsverlauf' })
    expect(spine).toBeInTheDocument()
    expect(within(spine).getByText('Dokumente')).toBeInTheDocument()
    // A locked step never disables silently: the reason is in its text.
    expect(within(spine).getAllByText(/Voraussetzung fehlt|Dokumentanalyse fehlt|Projekt noch nicht bereit/).length)
      .toBeGreaterThan(0)
    // Exactly one step is current.
    expect(spine.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
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
    await user.click(screen.getByRole('button', { name: 'Dokumentanalyse starten' }))
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

describe('Option creation hands off a gated, authority-aware baseline', () => {
  it('emits the snapshot as one journalled confirmation and only then creates the Option', async () => {
    const user = userEvent.setup()
    await openProject(user, 'Wohnhof Lindenhain')
    finishAnalysis()
    await waitFor(() => expect(document.querySelector('.a3-readiness')).not.toBeNull())

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
    expect(analysis.optionCreationErrorKey).toBe('vr3.option.error.gateClosed')
    expect(analysis.creatingOption).toBe(false)
    expect(st().options).toHaveLength(0)
    // Readiness and resolution work are untouched by the refusal.
    expect(analysis.jobState).toBe('COMPLETE')
    expect(st().projectBaseline).toBeNull()
  })
})
