import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataStateBoundary, type OwnerDataState } from '../DataStates'

function Subject({ state }: { state: OwnerDataState<string> }) {
  return (
    <DataStateBoundary
      state={state}
      label="Preisprüfung"
      renderReady={(value) => <p>{value}</p>}
    />
  )
}

describe('DataStateBoundary', () => {
  it('updates aria-busy and ready semantics immediately without exposing stale results', async () => {
    const { rerender } = render(<Subject state={{ status: 'loading', label: 'Preis wird geprüft' }} />)
    const owner = screen.getByLabelText('Preisprüfung')
    expect(owner).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText(/Preis wird geprüft/)).toBeInTheDocument()

    rerender(<Subject state={{ status: 'ready', data: 'Aktueller Preisstand' }} />)
    expect(owner).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByText('Aktueller Preisstand')).toBeInTheDocument()
    expect(screen.getByText(/Preis wird geprüft/).closest('[aria-hidden="true"]')).not.toBeNull()

    rerender(<Subject state={{
      status: 'error',
      sentence: 'Prüfung fehlgeschlagen.',
      impact: 'Der bisherige Preis bleibt erhalten.',
      remedy: 'Datei ersetzen.',
      retryPolicy: 'Danach kann sicher erneut geprüft werden.',
    }} />)
    rerender(<Subject state={{ status: 'ready', data: 'Neuester Preisstand' }} />)
    expect(screen.getByText('Neuester Preisstand')).toBeInTheDocument()
    expect(screen.getByText('Prüfung fehlgeschlagen.').closest('[aria-hidden="true"]')).not.toBeNull()
    await waitFor(() => {
      expect(screen.queryByText(/Preis wird geprüft/)).toBeNull()
      expect(screen.queryByText('Prüfung fehlgeschlagen.')).toBeNull()
    })
  })
})
