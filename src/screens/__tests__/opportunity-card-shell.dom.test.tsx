import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Тикет REBUILD PROJECT CARD SHELL: шапка карточки Opportunity и обзор
 * готовности (новый экземпляр DC-13 WorkflowStepper). Найдено ревью
 * Tech Review: ни то, ни другое не было защищено тестом. Здесь проверяются
 * ровно те инварианты, которые ревью требовало явно:
 * - статус в шапке несёт ПОДПИСЬ, а не один цвет, тем же тегом, что список
 *   Opportunities (носителем была бы точка `.a3-dot`, но в контексте `.a3-tag`
 *   она не определена ни одним правилом и рисовала пустой узел);
 * - у обзора готовности всегда ровно один текущий шаг (aria-current="step");
 * - состояние шага читается ТЕКСТОМ, а не только маркером/цветом;
 * - позиция шага доступна скринридеру целой фразой «Schritt n von 4»;
 * - обзор реагирует на реальные переходы состояния (конфликт → параметры → Option).
 */
beforeEach(() => __resetStoreForTests())
afterEach(() => vi.unstubAllGlobals())

async function openProjectCard(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
}

describe('Project Card — шапка и обзор готовности', () => {
  it('шапка отличает идентичность проекта от статуса каноническим тегом', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)

    const heading = screen.getByRole('heading', { level: 1, name: 'Musterprojekt Nordfeld' })
    const masthead = heading.closest('.a3-masthead')!
    expect(masthead).toBeInTheDocument()

    // F05 (UI audit 2026-08-21): the masthead used to also print the raw
    // fixture id ("DEMO-0001") — an internal identifier with no client-facing
    // purpose once city/country/owner already identify the project. It must
    // not be reachable in the sales workflow at all (AC-04).
    expect(within(masthead as HTMLElement).queryByText(/DEMO-0001/)).not.toBeInTheDocument()
    expect(within(masthead as HTMLElement).getByText(/Musterstadt/)).toBeInTheDocument()

    // Статус — DC-16 StatusTag (.a3-tag), не подпись caption'ом внутри строки
    // метаданных (R-24). Носитель статуса, независимый от цвета (правило 8), —
    // ПОДПИСЬ самого тега: `.a3-dot` в контексте `.a3-tag` не определён ни
    // одним правилом `design-system/components.css` (он живёт только в
    // `.a3-badge` и `.a3-chip-src`) и рисовал бы пустой узел нулевого размера.
    const tag = masthead.querySelector('.a3-tag')
    expect(tag).toBeInTheDocument()
    expect(tag!.querySelector('.a3-dot')).not.toBeInTheDocument()
    expect(tag).toHaveTextContent('in Vorbereitung')
    // Тот же класс варианта, что несёт статус на карточке списка Opportunities
    // (общий STAGE_TAG, src/lib/opportunityStage.ts) — иначе экраны разойдутся.
    expect(tag!.className).toContain('a3-orange')
  })

  it('F05: die globale Pfad-Krümel-Navigation zitiert keine rohe Fixture-/Option-ID', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)

    const breadcrumb = screen.getByRole('navigation', { name: 'Pfad' })
    expect(within(breadcrumb).getByText('Musterprojekt Nordfeld')).toBeInTheDocument()
    expect(within(breadcrumb).queryByText(/DEMO-0001/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))

    const breadcrumbInOption = screen.getByRole('navigation', { name: 'Pfad' })
    expect(within(breadcrumbInOption).getByText('Option 1')).toBeInTheDocument()
    expect(within(breadcrumbInOption).queryByText(/OPT-01/)).not.toBeInTheDocument()
  })

  it('обзор готовности называет ровно четыре канонические стадии (#16 Part 1) и держит ровно один текущий шаг', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)

    // #16 "Rebuild Project Card Workflow" supersedes Task 01's six always-
    // open informational stages with FOUR stages and a real per-stage lock
    // (AC-03): Document Analysis → Conflicting Information → Project
    // Baseline → Opportunity Options. All Task 01 section content stays on
    // the one page (AC2 there) — only the stepper's own stage count and
    // lock semantics change here.
    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })
    const steps = within(overview).getAllByRole('button')
    expect(steps).toHaveLength(4)
    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringContaining('Dokumentanalyse'),
      expect.stringContaining('Strittige Angaben'),
      expect.stringContaining('Projektgrundlage'),
      expect.stringContaining('Opportunity Options'),
    ])

    // Позиция — ЦЕЛОЙ ФРАЗОЙ для скринридера (DC-13, Screen-reader-Klausel
    // «Schritt 3 von 4»), а не только маркером; marker is aria-hidden so
    // a done/current glyph cannot be announced as a second position.
    steps.forEach((step, i) => {
      const marker = step.querySelector('.a3-wfs-marker')!
      expect(marker).toHaveAttribute('aria-hidden', 'true')
      const position = step.querySelector('.a3-wfs-meta')!
      expect(position).toHaveClass('a3-wfs-meta')
      expect(position).toHaveTextContent(`Schritt ${i + 1} von 4`)
    })

    // Состояние читается текстом, не только маркером/цветом (STEP-002, правило 8).
    // VR2-02 (Acceptance remediation, cycle 5): rationale copy shortened to
    // the approved target's own terse register ("1 Entscheidung
    // erforderlich" is the target's literal step-2 text) — the invariant
    // this block protects (state carried by TEXT, not colour) is unchanged;
    // the gate consequences remain expressed by the blocked steps' own
    // blockedReason texts asserted just below.
    expect(within(overview).getByText(
      '1 Dokument nicht lesbar',
    )).toBeInTheDocument()
    expect(within(overview).getByText(
      '1 Entscheidung erforderlich',
    )).toBeInTheDocument()
    // AC-05: solange ein Konflikt offen ist, ist die Projektgrundlage ein
    // ECHTES Gate (aria-disabled), nicht nur "vorläufig".
    // VR2-02 (cycle 5): the options step's stepper-side blocked reason is
    // now a one-line summary of the same two gates ("Erst Konflikte und
    // Grundlage klären") — the FULL wording ("Erst Konflikte entscheiden
    // und Projektparameter bestätigen") remains verbatim on the Create
    // button's own aria-describedby in the Options section, per the
    // stepper's established different-wording-than-the-action rule.
    expect(within(overview).getAllByText('Erst Konflikte entscheiden')).toHaveLength(1)
    expect(within(overview).getByText(
      'Erst Konflikte und Grundlage klären',
    )).toBeInTheDocument()

    // Ровно один шаг — «текущий» (следующий нерешённый по порядку), не два и не ноль.
    const current = steps.filter((s) => s.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Strittige Angaben')

    // Echte Sperre (STEP-003/Regel 12): gesperrt bleibt tastaturerreichbar
    // (kein natives `disabled`) und nennt den Grund per `aria-describedby`,
    // ist aber `aria-disabled`, nicht bloß abgedunkelt — genau die Stufen,
    // die vom offenen Konflikt abhängen.
    expect(steps[0]).not.toHaveAttribute('aria-disabled')
    expect(steps[1]).not.toHaveAttribute('aria-disabled')
    expect(steps[2]).toHaveAttribute('aria-disabled', 'true')
    expect(steps[3]).toHaveAttribute('aria-disabled', 'true')
    expect(steps[2]).not.toHaveAttribute('disabled')
    expect(steps[2]).toHaveAttribute('aria-describedby')
  })

  it('обзор готовности отражает реальные переходы: конфликт → Projektgrundlage → Option', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)
    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })
    const stepAt = (i: number) => overview.querySelectorAll<HTMLElement>('.a3-wfs-step')[i]!

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    expect(stepAt(1)).toHaveTextContent('Entschieden')
    expect(within(stepAt(1)).getByRole('button')).not.toHaveAttribute('aria-current')
    // Die Projektgrundlage entsperrt sich, sobald der Konflikt, von dem ihr
    // Gate abhing, entschieden ist (AC-05), und wird die aktuelle Stufe.
    expect(within(stepAt(2)).getByRole('button')).not.toHaveAttribute('aria-disabled')
    expect(stepAt(2)).toHaveTextContent('Bestätigung erforderlich')
    expect(within(stepAt(2)).getByRole('button')).toHaveAttribute('aria-current', 'step')

    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    expect(stepAt(2)).toHaveTextContent('Bestätigt')
    expect(within(stepAt(2)).getByRole('button')).not.toHaveAttribute('aria-current')
    expect(within(stepAt(3)).getByRole('button')).not.toHaveAttribute('aria-disabled')
    expect(stepAt(3)).toHaveTextContent('Bereit zum Anlegen')
    expect(within(stepAt(3)).getByRole('button')).toHaveAttribute('aria-current', 'step')

    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    expect(stepAt(3)).toHaveTextContent('Angelegt')
    // Terminalzustand: die Vorbereitung "endet" nicht — genau EIN Schritt
    // bleibt aktuell (das akzeptierte Product-Ruling), und zwar der letzte,
    // weil dort ab jetzt weitergearbeitet wird (Opportunity Options).
    const current = within(overview).getAllByRole('button').filter((s) => s.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Opportunity Options')
  })

  it('ein Klick auf einen entsperrten Schritt springt zum jeweiligen Abschnitt, ohne dessen Aktion auszuführen; ein gesperrter Schritt navigiert nicht', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)
    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })

    // AC-05: solange der Konflikt offen ist, ist "Projektgrundlage" gesperrt
    // — ein Klick fokussiert (wie jeden Button) nur den Button selbst, ohne
    // den Zielabschnitt zu erreichen: `onOpen()` läuft nicht (STEP-003).
    const baselineStep = within(overview).getAllByRole('button')[2]!
    expect(baselineStep).toHaveAttribute('aria-disabled', 'true')
    await user.click(baselineStep)
    expect(document.activeElement).toBe(baselineStep)
    expect(screen.queryByRole('region', { name: 'Projektparameter' })).not.toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    const unlockedBaselineStep = within(overview).getAllByRole('button')[2]!
    expect(unlockedBaselineStep).not.toHaveAttribute('aria-disabled')

    // Stufe 3 ("Projektgrundlage") vereint die früheren Stufen 3+4+5 und
    // springt zum ERSTEN der drei zusammengehörigen Abschnitte (Offene
    // Fragen & Annahmen) — siehe dessen eigenen Kommentar in
    // OpportunityCard.tsx.
    await user.click(unlockedBaselineStep)
    const section = screen.getByRole('region', { name: 'Offene Fragen & Annahmen' })
    expect(document.activeElement).toBe(section)
    // Der Sprung darf projectParamsConfirmed NICHT selbst setzen.
    expect(useStore.getState().projectParamsConfirmed).toBe(false)
  })

  it('stellt den WFL-Konflikt ruhig zurück, ohne Kandidaten oder den offenen Zustand zu verlieren', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)

    // Unrelated progress remains available while the conflict is open.
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Später entscheiden' }))

    expect(useStore.getState().buildingConflicts['DEMO-CONF-0001']!.resolutions.at(-1))
      .toMatchObject({ decision: 'defer', selectedCandidateId: null })
    expect(useStore.getState().projectParamsConfirmed).toBe(true)
    expect(useStore.getState().canCreateOptions()).toBe(false)
    expect(screen.getByRole('button', { name: 'Kundenwert übernehmen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dokumentwert beibehalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Später entscheiden' })).toBeInTheDocument()
    expect(useStore.getState().journal.at(-1)?.label).toBe(
      'Konflikt „WFL nach WoFlV“ zurückgestellt',
    )
    expect(useStore.getState().undoToast).toBeNull()
    expect(document.body).not.toHaveTextContent('DEMO-CONF-0001')
  })

  it('zeigt Kundenevidenz als datierten Satz statt als interne Event-ID', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)
    const conflict = screen.getByRole('region', { name: 'Strittige Angaben' })

    expect(within(conflict).getByText('vom Kunden bestätigt am 05.08.2026'))
      .toBeInTheDocument()
    expect(within(conflict).queryByText('DEMO-VE-0002')).not.toBeInTheDocument()

    act(() => useStore.getState().setUiLanguage('en'))
    expect(within(conflict).getByText('confirmed by customer on 05/08/2026'))
      .toBeInTheDocument()
    expect(useStore.getState().buildingConflicts['DEMO-CONF-0001']!.candidates
      .find((candidate) => candidate.origin === 'customer')?.source.reference)
      .toBe('DEMO-VE-0002')
  })

  it('zählt die bestätigte WFL hoch, zeigt ihr Delta und journalisiert die Ursache', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)
    const params = screen.getByRole('region', { name: 'Projektparameter' })
    const wflMetric = within(params).getByText('Total WFL nach WoFlV').parentElement!
    expect(wflMetric).toHaveTextContent(/1\.500,00\s*m²/)

    // useCountUp has dedicated timing coverage. The integrated workflow gets
    // one explicit completion frame so whole-suite load cannot race the
    // canonical 400 ms animation against waitFor's wall-clock timeout.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now() + 500), 0))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))

    await waitFor(() => expect(wflMetric).toHaveTextContent(/1\.560,00\s*m²/))
    const delta = wflMetric.querySelector('.a3-delta')!
    expect(delta).toHaveClass('a3-show', 'a3-cost')
    expect(delta).toHaveTextContent('Total WFL nach WoFlV geändert')
    expect(delta).toHaveTextContent(/\+\s*60,00\s*m²/)
    expect(useStore.getState().journal.at(-2)).toMatchObject({
      kind: 'conflict.resolved',
      label: expect.stringContaining('Kundenwert'),
    })
  })
})
