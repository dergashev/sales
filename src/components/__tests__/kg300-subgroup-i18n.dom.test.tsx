import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * SIDEBAR 03 FOLLOW-UP (backlog 5ec7e9cf, AC-1/AC-2): a Post-Release
 * Acceptance Audit against the exact released CURRENT_MAIN found that
 * expanding "Nachweise & Verlauf → KG 300 subgroups" in EN + Kundenansicht
 * rendered all 8 subgroup labels raw in German — the engine-sourced
 * `splitKg300()` label had no translation lookup at all.
 *
 * This checks the full live DOM text (`document.body.textContent`, which
 * — unlike a visible-text-only heuristic — also covers any `sr-only`/
 * `aria-hidden` span, exactly as the ticket's AC-1 requires) once the
 * subgroups are expanded, rather than inspecting source strings.
 */

const GERMAN_SUBGROUP_LABELS = [
  'Baugrube · Erdbau',
  'Gründung · Unterbau',
  'Außenwände · Vertikale Baukonstruktionen',
  'Innenwände · Vertikale Baukonstruktionen',
  'Decken · Horizontale Baukonstruktionen',
  'Dächer',
  'Infrastrukturanlagen · Einbauten',
  'Sonstige Maßnahmen für Baukonstruktionen',
]

const ENGLISH_SUBGROUP_LABELS = [
  'Excavation · earthworks',
  'Foundations · substructure',
  'Exterior walls · vertical structural elements',
  'Interior walls · vertical structural elements',
  'Floor slabs · horizontal structural elements',
  'Roofs',
  'Infrastructure installations · fixtures',
  'Other structural measures',
]

beforeEach(() => __resetStoreForTests())

describe('KG 300 subgroup labels translate in EN + Kundenansicht (AC-1/AC-2)', () => {
  it('renders all 8 subgroup labels in English with no bare German remainder, KG_3xx id kept literal', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))
    await confirmBuildingReviewSections(user)
    await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
    await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
    await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
    await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
    act(() => {
      useStore.getState().setCoverage('KG_300', 'included')
    })

    // Client view (Kundenansicht) — the ticket's exact reproduction profile.
    await user.click(screen.getByRole('button', { name: 'Kundenansicht prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Kundenansicht starten' }))

    // Switch UI language to EN — after all German-labeled navigation, so
    // the clicks above keep matching regardless of when the toggle fires.
    await user.click(screen.getAllByRole('radio', { name: 'EN' })[0]!)

    await user.click(screen.getByRole('button', { name: /Nachweise & Verlauf/ }))
    await user.click(screen.getByRole('button', { name: 'KG 300 subgroups' }))

    const rendered = document.body.textContent ?? ''

    for (const label of GERMAN_SUBGROUP_LABELS) {
      expect(rendered).not.toContain(label)
    }
    for (const label of ENGLISH_SUBGROUP_LABELS) {
      expect(rendered).toContain(label)
    }

    // LOCALE-009: the `KG 3xx` identifier itself is a normative denominator
    // and must stay literal/untranslated in every locale — only the
    // descriptive label part is translated.
    expect(rendered).toContain('KG 310')
    expect(rendered).toContain('KG 390')
  })
})
