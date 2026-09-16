import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'
import { demoProject } from '../../state/projectAnalysis'
import { openProjectCard } from '../../test/portfolio'

/**
 * Project → Documents as a document-first analysis workspace (accepted
 * Design Director audit `documents-workspace-ux-audit-328330c.md`, status
 * ACCEPTED TARGET, 2026-09-05).
 *
 * The suite is organised around the four claims the audit made about the
 * retired surface, because those are the claims that must not come back:
 *
 * 1. The register is the working object, and it is on screen.
 * 2. Filters and pages are PRESENTATION — the analysis always covers the
 *    whole eligible project set, and the action says so.
 * 3. Every state the rail can show is truthful about what the runtime does,
 *    including the one it cannot do (resume where it stopped).
 * 4. Six grouped stages orient the user without publishing the whole
 *    Product model, and without changing one route.
 */

beforeEach(() => __resetStoreForTests())

const COMPLEX = 'Quartier Am Güterbogen'
const CLEAN = 'Wohnhof Lindenhain'

async function openProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  render(<App />)
  await openProjectCard(user, name)
}

/** Drive the job to its terminal state, exactly as the UI's timer does. */
function runAnalysis() {
  const st = () => useStore.getState()
  const project = demoProject(st().opportunityId)!
  act(() => st().startDocumentAnalysis())
  for (let i = 0; i < project.documents.length * 8; i += 1) {
    if (st().projectAnalyses[project.id]!.jobState === 'COMPLETE') break
    act(() => st().tickDocumentAnalysis())
  }
}

function rail(): HTMLElement {
  return document.querySelector('.a3-docws-rail') as HTMLElement
}

function railFact(label: string): string {
  const row = within(rail()).getByText(label).parentElement!
  return row.textContent!.replace(label, '').trim()
}

describe('the register is the working object', () => {
  it('paginates from the eleventh document at a page size of ten', async () => {
    const user = userEvent.setup()
    await openProject(user, COMPLEX)

    // Thirteen documents: two pages, ten rows, an honest range.
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(10)
    const pages = screen.getByRole('navigation', { name: 'Dokumentseiten' })
    expect(within(pages).getByText('1–10 von 13 Dokumenten')).toBeInTheDocument()
    // The boundary keeps its place in the DOM and in the tab order and
    // refuses to move (canonical Pagination's `aria-disabled` contract).
    expect(within(pages).getByRole('button', { name: 'Zurück' }))
      .toHaveAttribute('aria-disabled', 'true')

    await user.click(within(pages).getByRole('button', { name: 'Seite 2' }))
    expect(within(pages).getByText('11–13 von 13 Dokumenten')).toBeInTheDocument()
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(3)
    expect(within(pages).getByRole('button', { name: 'Weiter' }))
      .toHaveAttribute('aria-disabled', 'true')
    // A page change is announced and takes focus to the register heading,
    // rather than leaving the reader where the button was.
    expect(document.activeElement).toHaveClass('a3-docws-count-text')
    expect(rail().textContent).toContain('Seite 2 von 2, Dokumente 11–13 von 13.')
  })

  it('shows every result and no controls at all below the threshold', async () => {
    const user = userEvent.setup()
    await openProject(user, CLEAN)
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(8)
    expect(screen.queryByRole('navigation', { name: 'Dokumentseiten' }))
      .not.toBeInTheDocument()
  })

  it('a filter returns to page 1 and cannot strand the reader on a dead page', async () => {
    const user = userEvent.setup()
    await openProject(user, COMPLEX)
    const pages = () => screen.getByRole('navigation', { name: 'Dokumentseiten' })

    // Thirteen documents paginate to two pages, so the last page is page 2.
    await user.click(within(pages()).getByRole('button', { name: 'Seite 2' }))
    expect(within(pages()).getByText('11–13 von 13 Dokumenten')).toBeInTheDocument()

    // Searching from the last page lands on page 1 of the NEW result set —
    // twelve of the thirteen files carry a revision in their name, so the
    // result is still large enough to paginate…
    await user.type(screen.getByRole('searchbox', { name: /Dokumente suchen/ }), 'rev')
    expect(within(pages()).getByText('1–10 von 12 Dokumenten')).toBeInTheDocument()
    // …and narrowing further below the threshold retires the control.
    await user.clear(screen.getByRole('searchbox', { name: /Dokumente suchen/ }))
    await user.type(screen.getByRole('searchbox', { name: /Dokumente suchen/ }), 'grundriss')
    expect(screen.queryByRole('navigation', { name: 'Dokumentseiten' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /von 13 Dokumenten$/ }))
      .toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
    expect(screen.getByRole('heading', { level: 2, name: '13 Dokumente' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filter zurücksetzen' }))
      .not.toBeInTheDocument()
  })

  it('inspection is available on every row and survives the page it was opened from',
    async () => {
      const user = userEvent.setup()
      await openProject(user, COMPLEX)
      const pages = screen.getByRole('navigation', { name: 'Dokumentseiten' })
      await user.click(within(pages).getByRole('button', { name: 'Seite 2' }))

      // Page 2 is the last page and holds the remaining three rows; every
      // one of them opens, and the control IS the document — the file name,
      // not a second button repeating it.
      const inspects = document.querySelectorAll('.a3-drow-file-link')
      expect(inspects).toHaveLength(3)
      await user.click(inspects[0] as HTMLElement)
      expect(inspects[0]).toHaveAttribute('aria-expanded', 'true')
      // The document opens BESIDE the register, in the region the row's own
      // control names — not in a strip under the row, which is what the
      // register would have had to reflow around.
      expect(inspects[0])
        .toHaveAttribute('aria-controls', 'documents-preview-panel')
      const panel = document.getElementById('documents-preview-panel')
      expect(panel).not.toBeNull()
      // The register context is exactly where it was.
      expect(within(pages).getByText('11–13 von 13 Dokumenten')).toBeInTheDocument()
    })
})

describe('scope is the project, never the page', () => {
  it('the action counts the eligible set even from page 2 of 2', async () => {
    const user = userEvent.setup()
    await openProject(user, COMPLEX)
    const pages = screen.getByRole('navigation', { name: 'Dokumentseiten' })
    await user.click(within(pages).getByRole('button', { name: 'Seite 2' }))

    expect(within(rail()).getByRole('button', {
      name: 'Alle 13 Dokumente analysieren',
    })).toBeInTheDocument()
    expect(railFact('Analysierbar')).toBe('13')
    // Three rows are visible on the last page; the operation is not about
    // those three.
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(3)
  })

  it('a removed document leaves the eligible count and the action agreeing', async () => {
    const user = userEvent.setup()
    await openProject(user, COMPLEX)
    const target = demoProject('DEMO-COMPLEX-01')!.documents[0]!
    act(() => useStore.getState().removeDocumentRow(target.id))

    expect(railFact('Dokumente')).toBe('13')
    expect(railFact('Analysierbar')).toBe('12')
    expect(within(rail()).getByRole('button', {
      name: 'Alle 12 Dokumente analysieren',
    })).toBeInTheDocument()
  })
})

describe('the rail tells the truth about the job', () => {
  it('READY carries no progress and no queue', async () => {
    const user = userEvent.setup()
    await openProject(user, CLEAN)
    expect(within(rail()).getByRole('heading', { name: 'Bereit für die Analyse' }))
      .toBeInTheDocument()
    expect(rail().querySelector('.a3-pjob-progress')).toBeNull()
    expect(screen.queryByText('In der Warteschlange')).not.toBeInTheDocument()
  })

  it('a cancelled run keeps what it produced and promises no resume', async () => {
    const user = userEvent.setup()
    await openProject(user, CLEAN)
    const st = () => useStore.getState()
    act(() => st().startDocumentAnalysis())
    for (let i = 0; i < 10; i += 1) act(() => st().tickDocumentAnalysis())
    act(() => st().cancelDocumentAnalysis())

    expect(within(rail()).getByRole('heading', { name: 'Analyse abgebrochen' }))
      .toBeInTheDocument()
    // The word is CANCELLED, and the ACTION states what restarting does:
    // it names all eight eligible documents, because `startJob` re-queues
    // every one of them rather than continuing where the run stopped.
    // Nothing on the band offers to resume.
    expect(within(rail()).queryByText(/fortsetzen/i)).not.toBeInTheDocument()
    // What was produced is kept, and what was not is READY again — not
    // queued, because nothing is waiting for anything.
    expect(Number(railFact('Verarbeitet'))).toBeGreaterThan(0)
    expect(screen.queryByText('In der Warteschlange')).not.toBeInTheDocument()
    expect(within(rail()).getByRole('button', {
      name: 'Alle 8 Dokumente analysieren',
    })).toBeInTheDocument()
  })

  it('completion with open outcomes is never a success-only state', async () => {
    const user = userEvent.setup()
    await openProject(user, COMPLEX)
    runAnalysis()

    expect(within(rail()).getByRole('heading', { name: 'Mit Hinweisen abgeschlossen' }))
      .toBeInTheDocument()
    // 3 warnings + 1 low confidence + 1 failed = 5 open outcomes.
    expect(railFact('Brauchen Aufmerksamkeit')).toBe('5')
    // It does not auto-navigate: the user sees what happened and chooses.
    expect(useStore.getState().projectStage).toBe('documents')
    // The secondary action routes to the rows that need the decision.
    await user.click(within(rail()).getByRole('button', {
      name: '5 Dokumente mit Hinweisen anzeigen',
    }))
    expect(document.querySelectorAll('.a3-drow')).toHaveLength(5)
    // …and the primary one is the next stage, taken deliberately.
    await user.click(within(rail()).getByRole('button', { name: 'Projektverständnis prüfen' }))
    expect(useStore.getState().projectStage).toBe('understanding')
  })

  it('a clean run completes without issues and offers the same one next step', async () => {
    const user = userEvent.setup()
    await openProject(user, CLEAN)
    runAnalysis()

    expect(within(rail()).getByRole('heading', { name: 'Analyse abgeschlossen' }))
      .toBeInTheDocument()
    expect(railFact('Brauchen Aufmerksamkeit')).toBe('0')
    // The result summary is what the analysis actually produced.
    expect(railFact('Gebäude')).toBe('1')
    expect(useStore.getState().projectStage).toBe('documents')
    await user.click(within(rail()).getByRole('button', { name: 'Projektverständnis prüfen' }))
    expect(useStore.getState().projectStage).toBe('understanding')
  })
})

describe('the workflow orients without publishing the model', () => {
  it('exposes three project stages, one current, and no cost groups', async () => {
    const user = userEvent.setup()
    await openProject(user, CLEAN)
    const nav = screen.getByRole('navigation', { name: 'Projektablauf' })
    // 2026-09-06 IA rebuild: THREE, not six. The four Option-scoped stages
    // moved to the tier that owns their data; the rail's own grammar —
    // one current stage, members disclosed only inside it, no cost groups
    // at project level — is unchanged.
    expect(nav.querySelectorAll('.a3-wfn-stage')).toHaveLength(3)
    expect(nav.querySelectorAll('[aria-current="step"]')).toHaveLength(1)
    expect(within(nav).queryByText('KG 200')).not.toBeInTheDocument()
    expect(within(nav).queryByText('KG 700')).not.toBeInTheDocument()
    // A stage's own members stay inside it: Documents is current and has
    // no separate destinations, so nothing is disclosed here.
    expect(nav.querySelectorAll('.a3-wfn-sub')).toHaveLength(0)
  })

  it('keeps every existing destination and gate exactly where it was', async () => {
    const user = userEvent.setup()
    await openProject(user, CLEAN)
    const nav = () => screen.getByRole('navigation', { name: 'Projektablauf' })

    // Understand is gated by the same predicate as before: no analysis, no
    // entry — and the lock names the prerequisite instead of being grey.
    // Both locks name the SAME missing prerequisite, because it is the same
    // one: nothing can be understood or optioned before the analysis has run.
    expect(within(nav()).getAllByText(/gesperrt · Dokumentanalyse fehlt/)).toHaveLength(2)
    expect(within(nav()).getByText('Projekt-Checkliste').closest('button')).toBeNull()

    runAnalysis()
    const understand = within(nav()).getByText('Projekt-Checkliste').closest('button')!
    await user.click(understand)
    expect(useStore.getState().projectStage).toBe('understanding')
    // Returning is the same store transition it always was.
    await user.click(within(nav()).getByText('Dokumente').closest('button')!)
    expect(useStore.getState().projectStage).toBe('documents')
  })
})
