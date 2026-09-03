import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField, SelectField } from '../designSystem'
import { ProvenanceChip } from '../primitives'
import { EstimateUncertaintyBadge } from '../EstimateUncertaintyBadge'
import { useStore } from '../../state/store'
import { Decimal } from 'decimal.js'

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

    act(() => useStore.getState().setUiLanguage('en'))
    expect(screen.getByLabelText(
      'Origin: aus Dokument · Flächenberechnung_v3.pdf · S. 15',
    )).toBeInTheDocument()
    act(() => useStore.getState().setUiLanguage('de'))
  })
})

describe('Canonical uncertainty contract', () => {
  it('keeps the released compact label and monetary range presentations', () => {
    const view = render(
      <>
        <EstimateUncertaintyBadge language="de" presentation="compact" pp={22} />
        <EstimateUncertaintyBadge
          language="de"
          presentation="range"
          pp={10}
          totalExact={new Decimal('100000')}
        />
      </>,
    )

    expect(view.container.querySelector('.text-body')?.textContent)
      .toBe('Schätzunsicherheit ± 22 %')
    expect([...view.container.querySelectorAll('.a3-iv-edges .numeric')]
      .map((element) => element.textContent))
      .toEqual(['90.000 €', '110.000 €'])
    expect(view.container.querySelector('.a3-iv-sub')).toBeInTheDocument()
  })

  it('F18: renders the interval as a track + current-value marker, never a filled meter', () => {
    const view = render(
      <EstimateUncertaintyBadge language="de" presentation="range" pp={17} totalExact={new Decimal('6641000')} />,
    )

    // The old defect: an unconditional `.a3-fill` spanning 0%-100%, painted
    // in the dataviz-success-green token — DC-3 explicitly forbids an
    // interval reading as a filled/success meter (AREA-004).
    expect(view.container.querySelector('.a3-fill')).toBeNull()
    const marker = view.container.querySelector('.a3-iv-marker') as HTMLElement | null
    expect(marker).not.toBeNull()
    // Symmetric ±pp% model (STATE-010): the current/indicative point sits
    // exactly at the interval's midpoint.
    expect(marker!.style.left).toBe('50%')
  })
})
