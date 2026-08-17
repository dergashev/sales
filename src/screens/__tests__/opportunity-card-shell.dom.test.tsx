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
 * - статус в шапке несёт иконку И текст, тем же тегом, что список Opportunities;
 * - у обзора готовности всегда ровно один текущий шаг (aria-current="step");
 * - состояние шага читается ТЕКСТОМ, а не только маркером/цветом;
 * - позиция шага не спрятана от скринридера (номер не aria-hidden);
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

    // Статус — DC-16 StatusTag (.a3-tag: иконка-точка + текст), не подпись
    // caption'ом внутри строки метаданных (R-24).
    const tag = masthead.querySelector('.a3-tag')
    expect(tag).toBeInTheDocument()
    expect(tag!.querySelector('.a3-dot')).toBeInTheDocument()
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

    // Позиция — текстом и доступна скринридеру: номер не спрятан aria-hidden,
    // как и в эталонном экземпляре DC-13 (Sidebar.tsx).
    steps.forEach((step, i) => {
      expect(step).toHaveTextContent(String(i + 1))
      expect(step.querySelector('.a3-n')).not.toHaveAttribute('aria-hidden')
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
