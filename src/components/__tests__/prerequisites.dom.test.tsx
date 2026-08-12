import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PrerequisiteChecklist } from '../PrerequisiteChecklist'

function Subject() {
  const [conflict, setConflict] = useState(false)
  const [parameters, setParameters] = useState(false)
  return (
    <PrerequisiteChecklist
      label="Bereitschaft für Optionen"
      requirements={[
        {
          id: 'conflict', label: 'Strittige Angaben entscheiden', resolved: conflict,
          sourceLabel: 'Zu den strittigen Angaben', nextActionLabel: 'Strittige Angaben jetzt entscheiden',
          onOpenSource: () => setConflict(true),
        },
        {
          id: 'parameters', label: 'Projektparameter bestätigen', resolved: parameters,
          sourceLabel: 'Zu den Projektparametern', nextActionLabel: 'Projektparameter jetzt bestätigen',
          onOpenSource: () => setParameters(true),
        },
      ]}
      createLabel="Opportunity Option anlegen"
      canCreate={conflict && parameters}
      createDisabledReason="Erst Voraussetzungen erfüllen"
      onCreate={() => {}}
    />
  )
}

describe('Opportunity prerequisites', () => {
  it('names every requirement, exposes one primary next action, and never renders aggregate ring progress', async () => {
    const user = userEvent.setup()
    const { container } = render(<Subject />)
    const gate = screen.getByRole('group', { name: 'Bereitschaft für Optionen' })
    const liveSummary = within(gate).getByText('0 von 2 Voraussetzungen erfüllt')
    expect(liveSummary).toHaveAttribute('aria-live', 'polite')
    expect(within(gate).getByText('Strittige Angaben entscheiden')).toBeInTheDocument()
    expect(within(gate).getByText('Projektparameter bestätigen')).toBeInTheDocument()
    expect(container.querySelector('svg, .a3-ring, [class*="percentage"]')).toBeNull()
    expect(container.querySelectorAll('.a3-btn:not(.a3-sec):not(.a3-ghost)')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Strittige Angaben jetzt entscheiden' }))
    expect(within(gate).getByText('1 von 2 Voraussetzungen erfüllt')).toBe(liveSummary)
    expect(liveSummary.isConnected).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Projektparameter jetzt bestätigen' }))
    expect(within(gate).getByText('2 von 2 Voraussetzungen erfüllt')).toBe(liveSummary)
    expect(liveSummary.isConnected).toBe(true)
    expect(screen.getByRole('button', { name: 'Opportunity Option anlegen' })).not.toHaveAttribute('aria-disabled')
  })

  it('keeps create unavailable when the canonical owner denies it even if rows look resolved', () => {
    render(
      <PrerequisiteChecklist
        label="Bereitschaft für Optionen"
        requirements={[
          {
            id: 'conflict', label: 'Strittige Angaben entscheiden', resolved: true,
            sourceLabel: 'Zu den strittigen Angaben', nextActionLabel: 'Konflikt entscheiden',
            onOpenSource: () => {},
          },
          {
            id: 'parameters', label: 'Projektparameter bestätigen', resolved: true,
            sourceLabel: 'Zu den Projektparametern', nextActionLabel: 'Parameter bestätigen',
            onOpenSource: () => {},
          },
        ]}
        createLabel="Opportunity Option anlegen"
        canCreate={false}
        createDisabledReason="Erstellung derzeit nicht verfügbar"
        onCreate={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
      .toHaveAttribute('aria-disabled', 'true')
  })
})
