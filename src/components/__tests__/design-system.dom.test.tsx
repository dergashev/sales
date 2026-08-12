import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField, SelectField } from '../designSystem'
import { ProvenanceChip } from '../primitives'

describe('Canonical form contracts', () => {
  it('connects labels, help, errors, and disabled reasons to the owned control', () => {
    render(
      <FormField
        label="Projektbezeichnung"
        htmlFor="project-name"
        helperText="Im internen Arbeitsraum sichtbar"
        error="Bezeichnung fehlt"
        disabledReason="Wird aus HubSpot übernommen"
      >
        <input />
      </FormField>,
    )

    const input = screen.getByRole('textbox', { name: 'Projektbezeichnung' })
    expect(input).toHaveAttribute('id', 'project-name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const descriptions = input.getAttribute('aria-describedby')!.split(' ')
    expect(descriptions).toHaveLength(3)
    expect(descriptions.every((id) => document.getElementById(id))).toBe(true)
  })

  it('keeps a long native Select label and its error relationship explicit', () => {
    render(
      <SelectField label="Sprache" error="Auswahl erforderlich" defaultValue="">
        <option value="">Bitte wählen</option>
        <option value="fr">Français mit längerer Bezeichnung</option>
      </SelectField>,
    )

    const select = screen.getByRole('combobox', { name: 'Sprache' })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(select.getAttribute('aria-describedby')!)).not.toBeNull()
  })
})

describe('Typed provenance contract', () => {
  it('keeps document provenance when source detail contains a page suffix', () => {
    render(
      <ProvenanceChip provenance={{
        kind: 'document',
        label: 'aus Dokument',
        detail: 'Flächenberechnung_v3.pdf · S. 15',
      }} />,
    )

    const chip = screen.getByLabelText(
      'Herkunft: aus Dokument · Flächenberechnung_v3.pdf · S. 15',
    )
    expect(chip).toHaveTextContent('◆')
    expect(chip).not.toHaveTextContent('✎')
  })
})
