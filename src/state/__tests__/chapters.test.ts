import { beforeEach, describe, expect, it } from 'vitest'
import { CHAPTERS, SCOPE_BOUNDARIES_CHAPTER } from '../chapters'
import { BUILDING_SCOPED_CHAPTERS, __resetStoreForTests, useStore } from '../store'
import { CLIENT_VISIBLE_CHAPTERS } from '../clientProjection'

/**
 * MAKE SCOPE BOUNDARIES THE AUTHORITATIVE CONFIGURATOR ENTRY STEP
 * (2026-08-18): Leistungsabgrenzung ↔ Leistungen KG 300 swap.
 *
 * These are the exact invariants Design's handoff called out as things a
 * future reorder could silently break again: assert them directly, rather
 * than only exercising them incidentally through DOM tests.
 */

beforeEach(() => __resetStoreForTests())

describe('Configurator chapter order (reorder ticket, 2026-08-18)', () => {
  it('Leistungsabgrenzung is chapter 1, Leistungen KG 300 is chapter 2 — chapters 3-8 unchanged', () => {
    expect(CHAPTERS).toEqual([
      'Leistungsabgrenzung', 'Leistungen KG 300', 'Technik KG 400',
      'Energie & Zertifikate', 'Flächen im Detail', 'Baugrund & Erschließung',
      'Baunebenkosten KG 700', 'Termine & Kommerzielles',
    ])
  })

  it('SCOPE_BOUNDARIES_CHAPTER is derived from CHAPTERS, not a hand-copied literal', () => {
    expect(SCOPE_BOUNDARIES_CHAPTER).toBe(CHAPTERS.indexOf('Leistungsabgrenzung') + 1)
    expect(SCOPE_BOUNDARIES_CHAPTER).toBe(1)
  })

  it('CLIENT_VISIBLE_CHAPTERS stays [1,2,3,4,5,6,8] — symmetric under the 1↔2 swap', () => {
    // Explicit regression, not an assumption: both old positions 1 and 2
    // were already client-visible, so the swap must not change this set.
    expect(CLIENT_VISIBLE_CHAPTERS).toEqual([1, 2, 3, 4, 5, 6, 8])
  })

  it('BUILDING_SCOPED_CHAPTERS becomes [2,3,4,5] — Leistungsabgrenzung is project-level', () => {
    expect(BUILDING_SCOPED_CHAPTERS).toEqual([2, 3, 4, 5])
    expect(BUILDING_SCOPED_CHAPTERS).not.toContain(SCOPE_BOUNDARIES_CHAPTER)
  })

  it('the Configurator opens on Scope Boundaries, not on KG 300 (AC-A/AC-D)', () => {
    const st = () => useStore.getState()
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption('Entry order')
    st().confirmBuilding(st().activeBuildingId)
    expect(st().pricingStarted).toBe(false)

    st().confirmConfigurationMode('SHARED')
    // The very transition that confirms the mode enters chapter 1 — and
    // chapter 1 is Leistungsabgrenzung, so pricing begins right here.
    expect(st().openChapter).toBe(SCOPE_BOUNDARIES_CHAPTER)
    expect(CHAPTERS[st().openChapter - 1]).toBe('Leistungsabgrenzung')
    expect(st().pricingStarted).toBe(true)
    // Landing on a project-level chapter must never narrow the live
    // projection to a single building.
    expect(st().scopeBuildingId).toBeNull()
  })
})
