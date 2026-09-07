// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaGallery, type MediaGalleryItem } from '../MediaGallery'
import { setReducedMotion } from '../../test/setup'

/**
 * The canonical client-facing gallery, proved where a model cannot reach.
 *
 * jsdom does not lay out, so the "dominant image's long edge ≥ 640 px at
 * 1440" half of the contract is NOT asserted here and is not pretended to
 * be: it lives in the stylesheet (`.a3-mg-lead` spans the whole grid) and
 * belongs to a live browser. What IS provable here is everything a
 * screen-reader user and a keyboard user actually meet: that every tile is
 * a real button with a name, that inspection is one modal with a name of
 * its own, that paging is ordered and clamped, and — the requirement this
 * component exists to protect — that the spoken position is worded by the
 * CALLER and never invented as a chapter counter.
 */

const ITEMS: MediaGalleryItem[] = [
  {
    id: 'street', src: '/street.webp',
    alt: 'Strassenansicht mit vertikaler Holzschalung',
    caption: 'Strassenansicht', context: 'Haus A', sourceId: 'fassade/timber',
  },
  {
    id: 'court', src: '/court.webp',
    alt: 'Hofseite mit Balkonreihen',
    caption: 'Hofseite', context: 'Haus A',
  },
  {
    id: 'context', src: '/context.webp',
    alt: 'Anschluss an die Klinkerbebauung',
    caption: 'Anschluss an den Bestand', context: 'Haus B',
  },
]

function positionLabel(index: number, total: number) {
  return `Bild ${index} / ${total}`
}

function renderGallery(items: readonly MediaGalleryItem[] = ITEMS, filters?: Parameters<typeof MediaGallery>[0]['filters']) {
  render(
    <MediaGallery
      items={items}
      label="Architektur"
      emptyLabel="Für dieses Gebäude ist noch kein Bild hinterlegt."
      closeLabel="Schliessen"
      previousLabel="Vorheriges Bild"
      nextLabel="Nächstes Bild"
      positionLabel={positionLabel}
      filters={filters}
    />,
  )
  return screen.getByRole('region', { name: 'Architektur' })
}

async function openViewer(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name }))
  return screen.getByRole('dialog', { name: 'Architektur' })
}

describe('canonical MediaGallery', () => {
  it('names every item and opens each one as a real button', async () => {
    const user = userEvent.setup()
    const region = renderGallery()

    // Каждая плитка — настоящий <button> с именем (правило 22), а описание
    // кадра живёт на самом изображении.
    for (const item of ITEMS) {
      expect(within(region).getByRole('button', { name: `${item.caption} · ${item.context}` }))
        .toBeInTheDocument()
      expect(within(region).getByRole('img', { name: item.alt })).toBeInTheDocument()
    }
    // The caption is visible text, not only an accessible name.
    expect(within(region).getByText('Strassenansicht')).toBeInTheDocument()

    const dialog = await openViewer(user, 'Strassenansicht · Haus A')
    expect(within(dialog).getByRole('img', { name: 'Strassenansicht mit vertikaler Holzschalung' }))
      .toBeInTheDocument()
  })

  it('announces the position in the caller’s words and never as a chapter counter', async () => {
    const user = userEvent.setup()
    renderGallery()
    const dialog = await openViewer(user, 'Hofseite · Haus A')

    const status = within(dialog).getByRole('status')
    expect(status).toHaveTextContent('Bild 2 / 3')
    // The forbidden phrasing is the reason this string is a prop at all.
    expect(dialog.textContent).not.toMatch(/Kapitel\s+\d+\s+von\s+\d+/)
    expect(dialog.textContent).not.toMatch(/\d+\s+von\s+\d+/)
  })

  it('pages with the arrow keys, jumps with Home and End, and clamps at both ends', async () => {
    const user = userEvent.setup()
    renderGallery()
    const dialog = await openViewer(user, 'Strassenansicht · Haus A')
    const status = within(dialog).getByRole('status')

    expect(status).toHaveTextContent('Bild 1 / 3')
    // Первое изображение — граница: `Vorheriges Bild` остаётся в DOM и в
    // порядке Tab и просто отказывается двигаться (aria-disabled, не disabled).
    const previous = within(dialog).getByRole('button', { name: 'Vorheriges Bild' })
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    expect(previous).not.toBeDisabled()

    await user.keyboard('{ArrowRight}')
    expect(status).toHaveTextContent('Bild 2 / 3')
    await user.keyboard('{ArrowLeft}')
    expect(status).toHaveTextContent('Bild 1 / 3')
    // Clamped, not wrapped: the first item stays the first item.
    await user.keyboard('{ArrowLeft}')
    expect(status).toHaveTextContent('Bild 1 / 3')

    await user.keyboard('{End}')
    expect(status).toHaveTextContent('Bild 3 / 3')
    expect(within(dialog).getByRole('button', { name: 'Nächstes Bild' }))
      .toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{ArrowRight}')
    expect(status).toHaveTextContent('Bild 3 / 3')

    await user.keyboard('{Home}')
    expect(status).toHaveTextContent('Bild 1 / 3')

    // The two visible buttons do the same thing as the keys.
    await user.click(within(dialog).getByRole('button', { name: 'Nächstes Bild' }))
    expect(status).toHaveTextContent('Bild 2 / 3')
  })

  it('closes through the canonical Dialog and returns focus to the tile that opened it', async () => {
    const user = userEvent.setup()
    renderGallery()
    const trigger = screen.getByRole('button', { name: 'Anschluss an den Bestand · Haus B' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Architektur' })).toBeInTheDocument()

    // Escape belongs to Dialog — the gallery neither adds nor duplicates it.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())

    await user.click(trigger)
    await user.click(await screen.findByRole('button', { name: 'Schliessen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('names the absence instead of rendering a hole', () => {
    const region = renderGallery([])
    expect(within(region).getByText('Für dieses Gebäude ist noch kein Bild hinterlegt.'))
      .toBeInTheDocument()
    expect(within(region).queryByRole('button')).not.toBeInTheDocument()
  })

  it('carries the filter selection on aria-pressed, not on colour alone', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const region = renderGallery(ITEMS, [
      { id: 'all', label: 'Alle Gebäude', active: true, onSelect: () => {} },
      { id: 'b', label: 'Haus B', active: false, onSelect },
    ])
    expect(within(region).getByRole('button', { name: 'Alle Gebäude' }))
      .toHaveAttribute('aria-pressed', 'true')
    const other = within(region).getByRole('button', { name: 'Haus B' })
    expect(other).toHaveAttribute('aria-pressed', 'false')
    await user.click(other)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('still pages when the user asks for reduced motion (rule 21)', async () => {
    setReducedMotion(true)
    const user = userEvent.setup()
    renderGallery()
    const dialog = await openViewer(user, 'Strassenansicht · Haus A')
    await user.keyboard('{ArrowRight}')
    // The DIRECTION verb is zeroed by useSemanticMotion, and the content —
    // the point of the transition — is present immediately either way.
    expect(within(dialog).getByRole('status')).toHaveTextContent('Bild 2 / 3')
    await waitFor(() => expect(
      within(dialog).getByRole('img', { name: 'Hofseite mit Balkonreihen' }),
    ).toBeInTheDocument())
  })
})
