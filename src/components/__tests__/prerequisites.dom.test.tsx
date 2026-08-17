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
          sourceLabel: 'Zu den strittigen Angaben',
          onOpenSource: () => setConflict(true),
        },
        {
          id: 'parameters', label: 'Projektparameter bestätigen', resolved: parameters,
          sourceLabel: 'Zu den Projektparametern',
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
  it('names every requirement, never renders aggregate ring progress, and never shows a second primary CTA that only navigates', async () => {
    const user = userEvent.setup()
    const { container } = render(<Subject />)
    const gate = screen.getByRole('group', { name: 'Bereitschaft für Optionen' })
    const liveSummary = within(gate).getByText('0 von 2 Voraussetzungen erfüllt')
    expect(liveSummary).toHaveAttribute('aria-live', 'polite')
    expect(within(gate).getByText('Strittige Angaben entscheiden')).toBeInTheDocument()
    expect(within(gate).getByText('Projektparameter bestätigen')).toBeInTheDocument()
    expect(container.querySelector('svg, .a3-ring, [class*="percentage"]')).toBeNull()

    // Before both prerequisites are met, the create action is the ONLY
    // button and it is honestly disabled — there is no second, primary-
    // styled button whose label promises to resolve/confirm while its
    // click only navigates (the defect this composition used to have).
    expect(container.querySelectorAll('.a3-btn:not(.a3-sec):not(.a3-ghost)')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Opportunity Option anlegen' })).toHaveAttribute('aria-disabled', 'true')

    // Each row's own source link is real navigation (a link, not a
    // primary button) and is what actually moves the underlying state.
    await user.click(within(gate).getByRole('button', { name: 'Zu den strittigen Angaben' }))
    expect(within(gate).getByText('1 von 2 Voraussetzungen erfüllt')).toBe(liveSummary)
    expect(liveSummary.isConnected).toBe(true)
    await user.click(within(gate).getByRole('button', { name: 'Zu den Projektparametern' }))
    expect(within(gate).getByText('2 von 2 Voraussetzungen erfüllt')).toBe(liveSummary)
    expect(liveSummary.isConnected).toBe(true)

    // Once both are resolved, the create action becomes the single
    // primary CTA — still exactly one, never two.
    expect(container.querySelectorAll('.a3-btn:not(.a3-sec):not(.a3-ghost)')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Opportunity Option anlegen' })).not.toHaveAttribute('aria-disabled')
  })

  it('keeps create unavailable when the canonical owner denies it even if rows look resolved', () => {
    render(
      <PrerequisiteChecklist
        label="Bereitschaft für Optionen"
        requirements={[
          {
            id: 'conflict', label: 'Strittige Angaben entscheiden', resolved: true,
            sourceLabel: 'Zu den strittigen Angaben',
            onOpenSource: () => {},
          },
          {
            id: 'parameters', label: 'Projektparameter bestätigen', resolved: true,
            sourceLabel: 'Zu den Projektparametern',
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
