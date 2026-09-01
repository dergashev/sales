import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { confirmBuildingReviewSections } from '../../test/offer-option'
import { __resetStoreForTests } from '../../state/store'

/**
 * REDESIGN R4 (calm-density recomposition): a genuinely binary
 * "aufnehmen / nicht aufnehmen" KG 300/400 decision (Erdarbeiten,
 * Bodenplatte, Balkone, Förderanlagen …) resolves the SAME
 * `optionImage(groupId, value)` motif for both choices — the media slot
 * carried zero differentiating information and cost ~1.200 px / 2 tiles per
 * decision (measured live against CURRENT_MAIN `beaf4f1`, KG 300 chapter
 * main-pane scroll height 11.992 px → 9.832 px after this fix).
 *
 * `OptionChapter.tsx` now passes `image: null` for those groups only —
 * `RadioCardGroup`'s image slot is documented as optional
 * (components-core.md §RadioCardGroup, "Слот опционален") and already
 * falls back to the canonical compact non-image tile with zero component
 * change, the same fallback R2 used for the garage/qng/dgnb near-duplicate
 * removals. A genuine multi-way material choice (Balkontyp, Fassade,
 * Bauweise) is untouched and must keep its differentiating image.
 */

beforeEach(() => __resetStoreForTests())

async function openKg300(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
  await confirmBuildingReviewSections(user)
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
  await user.click(screen.getByRole('radio', { name: 'Gemeinsam konfigurieren' }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
  await user.click(screen.getAllByRole('button', { name: /Leistungen KG 300/ })[0]!)
}

describe('OptionChapter calm-density: binary inclusion groups render without images (R4)', () => {
  it('renders no <img> inside a binary ja/nein group (Erdarbeiten), and keeps images on a genuine multi-way material group (Balkontyp)', async () => {
    const user = userEvent.setup()
    await openKg300(user)

    const erdarbeitenHeading = await screen.findByRole('heading', { name: 'Erdarbeiten' })
    const erdarbeitenSection = erdarbeitenHeading.closest('section')
    expect(erdarbeitenSection).not.toBeNull()
    expect(erdarbeitenSection!.querySelectorAll('img')).toHaveLength(0)

    // The two choices ("aufnehmen"/"nicht aufnehmen") must still be fully
    // present, priced and selectable — only the decorative media slot is
    // gone. Title/description/consequence stay block-level text.
    expect(screen.getAllByRole('radio', { name: /aufnehmen/i }).length).toBeGreaterThan(0)

    const bodenplatteHeading = screen.getByRole('heading', { name: 'Bodenplatte' })
    expect(bodenplatteHeading.closest('section')!.querySelectorAll('img')).toHaveLength(0)

    const balkoneHeading = screen.getByRole('heading', { name: 'Balkone' })
    expect(balkoneHeading.closest('section')!.querySelectorAll('img')).toHaveLength(0)

    const showAll = screen.getByRole('button', { name: 'Alle 7 anzeigen' })
    expect(showAll).toHaveAttribute('aria-expanded', 'false')
    await user.click(showAll)

    // Balkontyp is a real 3-way material choice (diagonal/Stützen/Konsole)
    // and must keep its differentiating images.
    const balkontypHeading = screen.getByRole('heading', { name: 'Balkontyp' })
    const balkontypSection = balkontypHeading.closest('section')!
    expect(balkontypSection.querySelectorAll('img').length).toBeGreaterThan(0)

    // Erdgeschoss (Bauweise: Holz/Massiv) is a 2-way choice but NOT ja/nein
    // — it is a genuine material decision and must keep its image.
    const egHeading = screen.getByRole('heading', { name: 'Erdgeschoss' })
    const egSection = egHeading.closest('section')!
    expect(egSection.querySelectorAll('img').length).toBeGreaterThan(0)
  })
})
