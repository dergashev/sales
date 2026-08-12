import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrerequisiteChecklist } from '../PrerequisiteChecklist'
import { FormField, NextStep, ReadinessChecklist } from '../designSystem'
import { __resetStoreForTests, useStore } from '../../state/store'

beforeEach(() => __resetStoreForTests())

describe('Canonical design-system copy · DC-45', () => {
  it('renders internal labels and whole count messages through the active UI dictionary', () => {
    useStore.getState().setUiLanguage('en')

    render(
      <>
        <FormField label="Project name" htmlFor="project-name" loading>
          <input id="project-name" />
        </FormField>
        <ReadinessChecklist
          label="Client profile"
          items={[
            { id: 'scope', label: 'Pricing scope', ready: true },
            { id: 'classification', label: 'Classification', ready: false },
          ]}
        />
        <NextStep description="Prerequisites are complete." action="Create option" onAction={() => {}} />
        <PrerequisiteChecklist
          label="Option prerequisites"
          requirements={[
            {
              id: 'conflict', label: 'Conflicting information', resolved: true,
              sourceLabel: 'Open source', nextActionLabel: 'Resolve now', onOpenSource: () => {},
            },
            {
              id: 'parameters', label: 'Project parameters', resolved: false,
              sourceLabel: 'Open source', nextActionLabel: 'Confirm now', onOpenSource: () => {},
            },
          ]}
          createLabel="Create option"
          canCreate={false}
          createDisabledReason="Complete prerequisites first"
          onCreate={() => {}}
        />
      </>,
    )

    expect(screen.getByText(/Field is loading/)).toBeInTheDocument()
    expect(screen.getByText('1 of 2 points ready')).toBeInTheDocument()
    expect(screen.getByText('Next step')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 prerequisites complete')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(
      /Feld wird geladen|Punkten bereit|Voraussetzungen erfüllt|Erfüllt|Offen|Nächster Schritt/,
    )
  })
})
