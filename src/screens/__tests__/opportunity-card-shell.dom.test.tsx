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

    // Проектный ID теперь виден в шапке (его не было в прежней вёрстке).
    expect(within(masthead as HTMLElement).getByText(/DEMO-0001/)).toBeInTheDocument()

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

  it('обзор готовности называет все четыре стадии и держит ровно один текущий шаг', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)

    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })
    const steps = within(overview).getAllByRole('button')
    expect(steps).toHaveLength(4)
    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringContaining('Dokumentgrundlage'),
      expect.stringContaining('Strittige Angaben'),
      expect.stringContaining('Projektparameter'),
      expect.stringContaining('Opportunity Options'),
    ])

    // Позиция — ЦЕЛОЙ ФРАЗОЙ для скринридера (DC-13, Screen-reader-Klausel
    // «Schritt 3 von 5»), а не одной цифрой; видимой остаётся компактная
    // цифра, и она aria-hidden, чтобы позиция не читалась дважды.
    steps.forEach((step, i) => {
      const marker = step.querySelector('.a3-n')!
      // Проверяется ВИДИМАЯ цифра — отдельный узел внутри маркера, а не сам
      // маркер: прежняя редакция утверждала `not.toHaveAttribute('aria-hidden')`
      // на обёртке `.a3-n`, которая этого атрибута никогда и не несла, и
      // `toHaveTextContent(String(i + 1))` на ней же — а его удовлетворяла уже
      // sr-only-фраза («4Schritt 4 von 4» содержит «4»). Обе проверки не могли
      // упасть: снятие `aria-hidden` (двойное озвучивание позиции) и удаление
      // самой цифры оставляли набор зелёным.
      const digit = marker.querySelector(':scope > span:not(.sr-only)')
      expect(digit).toHaveAttribute('aria-hidden', 'true')
      expect(digit!.textContent).toBe(String(i + 1))
      const position = within(step).getByText(`Schritt ${i + 1} von 4`)
      expect(position).toHaveClass('sr-only')
    })

    // Состояние читается текстом, не только маркером/цветом (STEP-002, правило 8).
    expect(within(overview).getByText(
      'Ein Dokument ist nicht lesbar · blockiert das Anlegen einer Opportunity Option nicht',
    )).toBeInTheDocument()
    expect(within(overview).getByText(
      'Entscheidung erforderlich · blockiert das Anlegen einer Opportunity Option',
    )).toBeInTheDocument()
    expect(within(overview).getByText(
      'Bestätigung erforderlich · blockiert das Anlegen einer Opportunity Option',
    )).toBeInTheDocument()
    expect(within(overview).getByText('Wartet auf die Voraussetzungen oben')).toBeInTheDocument()

    // Ровно один шаг — «текущий» (следующий нерешённый по порядку), не два и не ноль.
    const current = steps.filter((s) => s.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Strittige Angaben')
  })

  it('обзор готовности отражает реальные переходы: конфликт → параметры → Option', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)
    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })
    const stepAt = (i: number) => within(overview).getAllByRole('button')[i]!

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    expect(stepAt(1)).toHaveTextContent('Entschieden')
    expect(stepAt(1)).not.toHaveAttribute('aria-current')
    expect(stepAt(2)).toHaveAttribute('aria-current', 'step')

    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    expect(stepAt(2)).toHaveTextContent('Bestätigt')
    expect(stepAt(2)).not.toHaveAttribute('aria-current')
    expect(stepAt(3)).toHaveTextContent('Bereit zum Anlegen')
    expect(stepAt(3)).toHaveAttribute('aria-current', 'step')

    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    expect(stepAt(3)).toHaveTextContent('Angelegt')
    // Terminalzustand: die Vorbereitung "endet" nicht — genau EIN Schritt
    // bleibt aktuell (das akzeptierte Product-Ruling), und zwar der letzte,
    // weil dort ab jetzt weitergearbeitet wird (Opportunity Options).
    const current = within(overview).getAllByRole('button').filter((s) => s.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Opportunity Options')
  })

  it('ein Klick auf einen Schritt springt zum jeweiligen Abschnitt, ohne dessen Aktion auszuführen', async () => {
    const user = userEvent.setup()
    await openProjectCard(user)
    const overview = screen.getByRole('navigation', { name: 'Projektstatus' })

    await user.click(within(overview).getAllByRole('button')[2]!) // Projektparameter
    const section = screen.getByRole('region', { name: 'Projektparameter' })
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
