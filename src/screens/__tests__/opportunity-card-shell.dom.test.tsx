import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
    expect(tag!.textContent!.trim().length).toBeGreaterThan(0)
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
      expect(marker).not.toHaveAttribute('aria-hidden')
      expect(marker).toHaveTextContent(String(i + 1))
      const position = within(step).getByText(`Schritt ${i + 1} von 4`)
      expect(position).toHaveClass('sr-only')
    })

    // Состояние читается текстом, не только маркером/цветом (STEP-002, правило 8).
    expect(within(overview).getByText('Ein Dokument ist nicht lesbar')).toBeInTheDocument()
    expect(within(overview).getByText('Entscheidung erforderlich')).toBeInTheDocument()
    expect(within(overview).getByText('Bestätigung erforderlich')).toBeInTheDocument()
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
    // Alles erledigt: kein Schritt bleibt "aktuell".
    expect(within(overview).getAllByRole('button').some((s) => s.hasAttribute('aria-current'))).toBe(false)
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
})
