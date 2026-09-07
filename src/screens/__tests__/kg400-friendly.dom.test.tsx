import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import {
  completeBuildingScope, completeKgConfiguration, confirmBuildingReviewSections,
  decideAllKgScope, enterOptionWorkspace,
} from '../../test/offer-option'
import { CONFIGURATOR_STEP } from '../../state/chapters'
import { __resetStoreForTests, useStore } from '../../state/store'
import { changedFromSource, serviceById } from '../../engine/kgConfiguration'
import { kgCatalogueFor } from '../../state/store'

/**
 * KG 400 AS A FRIENDLY ENGINEERING-SOLUTION CONFIGURATOR (VR3-TGA-UX-00),
 * driven as a salesperson drives it.
 *
 * The engine is proved in `kgTgaDecisions.test.ts`; this file proves the
 * SURFACE CONTRACT of the decision pattern: a decided decision is a summary
 * whose alternatives are absent from the DOM until `Ändern`; entering edit
 * mode puts focus on the current answer; `Abbrechen`/Escape discards the
 * draft and returns focus; `Übernehmen` is the ONE write; an unresolved
 * decision opens its editor on arrival and still commits only explicitly;
 * the responsibility matrix is absent from the chapter and one link away.
 *
 * Every activation is an ordinary click or a real key press — nothing forced.
 */

const st = () => useStore.getState()

beforeEach(() => __resetStoreForTests())

async function reachKg400(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  enterOptionWorkspace('DEMO-HAPPY-01')
  await confirmBuildingReviewSections(user)
  completeBuildingScope('SHARED')
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1, name: 'Leistungsabgrenzung' }))
      .toBeInTheDocument()
  })
  decideAllKgScope('included')
  act(() => { st().openKgChapter('KG_400') })
  await screen.findByRole('heading', { level: 1, name: /^KG.400 · / })
}

const systemButton = (name: RegExp) => screen.getByRole('button', { name })
const openBody = () => document.querySelector<HTMLElement>('.a3-sys-body:not([hidden])')!

describe('the decision pattern', () => {
  it('a decided decision is a summary: its alternatives are absent until Ändern, and Escape brings them back down', async () => {
    const user = userEvent.setup()
    await reachKg400(user)

    // Seven systems, no eighth "Schnittstellen & Verantwortung".
    const names = [...document.querySelectorAll('.a3-sys-name')].map((e) => e.textContent)
    expect(names).toHaveLength(7)
    expect(names).not.toContain('Schnittstellen & Verantwortung')

    await user.click(systemButton(/^Wärme · /))
    const body = openBody()
    expect(within(body).queryAllByRole('radio')).toHaveLength(0)
    expect(within(body).getByText('Luft/Wasser-Wärmepumpe')).toBeInTheDocument()
    // The deviation is explicit and adjacent — not a comparison of distant rows.
    expect(within(body).getByText(/statt Kundendokument: Fernwärme-Übergabestation/))
      .toBeInTheDocument()

    const change = within(body).getByRole('button', { name: 'Ändern · Wärmeerzeuger' })
    change.focus()
    await user.keyboard('{Enter}')
    const radios = within(openBody()).getAllByRole('radio')
    expect(radios).toHaveLength(5)
    // Focus enters on the CURRENT answer.
    expect(document.activeElement).toBe(radios.find((r) => (r as HTMLInputElement).checked))
    expect((document.activeElement as HTMLInputElement).value).toBe('WE_LW_WP')

    await user.keyboard('{Escape}')
    expect(within(openBody()).queryAllByRole('radio')).toHaveLength(0)
    expect(document.activeElement).toBe(
      within(openBody()).getByRole('button', { name: 'Ändern · Wärmeerzeuger' }),
    )
  })

  it('Übernehmen is the one write; choosing alone changes nothing, Abbrechen discards the draft', async () => {
    const user = userEvent.setup()
    await reachKg400(user)
    await user.click(systemButton(/^Wärme · /))
    const generator = () => st().kgConfig!.services['a-400-01']!

    await user.click(within(openBody()).getByRole('button', { name: 'Ändern · Wärmeerzeuger' }))
    await user.click(within(openBody()).getByText('Fernwärme-Übergabestation'))
    expect(generator().variant).toBe('WE_LW_WP')
    await user.click(within(openBody()).getByRole('button', { name: 'Abbrechen' }))
    expect(generator().variant).toBe('WE_LW_WP')
    expect(within(openBody()).queryAllByRole('radio')).toHaveLength(0)

    await user.click(within(openBody()).getByRole('button', { name: 'Ändern · Wärmeerzeuger' }))
    await user.click(within(openBody()).getByText('Fernwärme-Übergabestation'))
    await user.click(within(openBody()).getByRole('button', { name: 'Übernehmen' }))
    expect(generator().variant).toBe('WE_FW')
    // The summary collapsed and now states the documented solution as a match.
    expect(within(openBody()).queryAllByRole('radio')).toHaveLength(0)
    const service = serviceById(kgCatalogueFor(st())!, 'a-400-01')!
    expect(changedFromSource(st().kgConfig!, service)).toBe(false)
    expect(within(openBody()).getByText('Entspricht Kundendokumenten')).toBeInTheDocument()
    expect(screen.queryByText(/statt Kundendokument: Fernwärme/)).toBeNull()
  })

  it('an unresolved decision opens its editor on arrival and still commits only on Übernehmen', async () => {
    const user = userEvent.setup()
    await reachKg400(user)
    // The first system that owes a decision is open on arrival: Lüftung.
    const button = systemButton(/^Lüftung & sommerlicher Komfort · 1 Entscheidung offen$/)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const body = openBody()
    expect(within(body).getByText('Noch nicht entschieden')).toBeInTheDocument()
    const apply = within(body).getByRole('button', { name: 'Übernehmen' })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
    const ventilation = () => st().kgConfig!.services['a-400-18']!

    await user.click(within(body).getByText('Zentrale Abluftanlage', { selector: '.a3-choice-label' }))
    expect(ventilation().state).toBe('undecided')
    await user.click(within(openBody()).getByRole('button', { name: 'Übernehmen' }))
    expect(ventilation()).toEqual({ state: 'selected', variant: 'WL_ABLUFT_DACH' })
    expect(systemButton(/^Lüftung & sommerlicher Komfort · konfiguriert$/)).toBeInTheDocument()
  })

  it('the evidence is one disclosure per decision, and it carries the source', async () => {
    const user = userEvent.setup()
    await reachKg400(user)
    await user.click(systemButton(/^Wärme · /))
    const toggle = within(openBody())
      .getByRole('button', { name: 'Grundlage & Herkunft · Wärmeerzeuger' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(panel.textContent).toContain('03_Energiekonzept.pdf')
    expect(panel.textContent).toContain('GModG')
  })
})

describe('the responsibility matrix left the chapter', () => {
  it('KG 400 keeps one read-only boundary line that links to the owner', async () => {
    const user = userEvent.setup()
    await reachKg400(user)
    const chapter = document.querySelector('.a3-kgp')!
    expect(chapter.textContent).not.toContain('Schmutzwasser')
    expect(chapter.textContent).toContain('Übergabepunkt Grundstücksgrenze')

    await user.click(screen.getByRole('button', { name: 'Schnittstellen & Verantwortung öffnen' }))
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.RESPONSIBILITY)
    await screen.findByRole('heading', { level: 1, name: 'Schnittstellen & Verantwortung' })
    expect(screen.getByText('Interim · strukturelles Ziel')).toBeInTheDocument()
    const rows = document.querySelectorAll('.a3-resp-table tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.textContent).toContain('Trinkwasser')
    expect(rows[3]!.textContent).toContain('Telekommunikation')
    // No euro anywhere on the interim page.
    expect(document.querySelector('[data-responsibility-stage]')!.textContent).not.toMatch(/\d\s?€/)
  })

  it('KG 700 continues to the responsibility step, which continues to the schedule and back', async () => {
    const user = userEvent.setup()
    await reachKg400(user)
    completeKgConfiguration()
    act(() => { st().openKgChapter('KG_700') })
    await screen.findByRole('heading', { level: 1, name: /^KG.700 · / })
    await user.click(screen.getByRole('button', { name: 'Weiter zu Schnittstellen & Verantwortung' }))
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.RESPONSIBILITY)
    await user.click(screen.getByRole('button', { name: 'Weiter zum Terminplan' }))
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)
    await user.click(screen.getByRole('button', { name: 'Zurück zu Schnittstellen & Verantwortung' }))
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.RESPONSIBILITY)
    await user.click(screen.getByRole('button', { name: /^Zurück zu KG.700$/ }))
    expect(st().openConfiguratorStep).toBe(CONFIGURATOR_STEP.KG_700_DETAILS)
  })
})
