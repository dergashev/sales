import { useCallback, useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog } from '../components/Dialog'
import { MediaFrame } from './MediaFrame'
import { useSemanticMotion } from './motion'

/**
 * MediaGallery — the canonical client-facing image gallery (VR3-CP-00).
 *
 * Until this module the system owned ONE media capability, `MediaFrame`: a
 * single frame with a ratio, a caption slot and six designed states. A
 * chapter that has to SHOW a building — one dominant view plus the
 * supporting ones, each inspectable at full size — had no canonical shape at
 * all. `src/design-system/Gallery.tsx` is not that shape: it is the QA
 * specimen frame, import-forbidden from product code (GOV-QA-BOUNDARY), and
 * it renders contracts, not architecture.
 *
 * What this closes, and what it deliberately does NOT own:
 *
 * · It composes `MediaFrame` — it does not re-implement ratios, image
 *   states or the identity fallback art. One media primitive, one gallery
 *   over it.
 * · Full-screen inspection is the canonical `Dialog` (`src/components/
 *   Dialog.tsx`), which already owns the portal, the focus trap, Escape,
 *   background `inert` and focus return. A second modal in this file would
 *   be the exact duplication the Design System governance forbids. No React
 *   portal is opened here — the registry test asserts that this module names
 *   the canonical Dialog and opens no portal of its own.
 * · Every user-visible string is a REQUIRED PROP. The gallery adds no i18n
 *   key and reads no dictionary: the consumer supplies already-translated
 *   copy, so the same canonical component serves a German meeting and an
 *   English one without the capability owning a locale.
 *
 * The position announcement is deliberately caller-supplied
 * (`positionLabel`) rather than composed here. A gallery that announced its
 * own "N / M" would be inventing copy, and inside a presentation chapter
 * the wrong wording reads as a CHAPTER counter — the client hears "three of
 * seven" and believes four chapters are still to come. The caller names the
 * unit; the gallery only says when to say it.
 */

export type MediaGalleryItem = Readonly<{
  id: string
  src: string
  /** Accessible description of what the image shows. Never the caption verbatim. */
  alt: string
  caption: string
  /** Optional context line under the caption, e.g. a building name. */
  context?: string
  /** Asset-manifest id, rendered only as a data attribute, never shown. */
  sourceId?: string
}>

type MediaGalleryFilter = Readonly<{
  id: string
  label: string
  active: boolean
  onSelect: () => void
}>

/** Ordered progression, so the DIRECTION verb applies (motion.ts, ADR-R1-05). */
type Direction = 'forward' | 'backward'

export function MediaGallery({
  items,
  label,
  emptyLabel,
  closeLabel,
  previousLabel,
  nextLabel,
  positionLabel,
  filters,
  onDark = false,
}: {
  items: readonly MediaGalleryItem[]
  /** Accessible name of the gallery region. */
  label: string
  /** Empty-state copy when `items` is empty. The chapter normally omits itself instead. */
  emptyLabel: string
  closeLabel: string
  previousLabel: string
  nextLabel: string
  /** `index` is 1-based, `total` is the number of items — the caller words it. */
  positionLabel: (index: number, total: number) => string
  /** Optional filter chips (e.g. per building). Purely presentational. */
  filters?: readonly MediaGalleryFilter[]
  onDark?: boolean
}): JSX.Element {
  const titleId = useId()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [direction, setDirection] = useState<Direction>('forward')
  const motionTokens = useSemanticMotion()

  const total = items.length
  const activeIndex = openIndex === null ? -1 : openIndex
  const current = activeIndex >= 0 && activeIndex < total ? items[activeIndex]! : null
  const open = current !== null

  const goTo = useCallback((next: number, how: Direction) => {
    setDirection(how)
    setOpenIndex(next)
  }, [])

  /**
   * Paging CLAMPS at both ends instead of wrapping, and the boundary button
   * stays in the DOM and in the tab order as `aria-disabled` — the same
   * boundary semantics the canonical Pagination contract already carries. A
   * control that disappears at the first item makes a keyboard reader
   * re-learn the viewer's shape on every image.
   */
  const step = useCallback((delta: -1 | 1) => {
    if (activeIndex < 0) return
    const next = activeIndex + delta
    if (next < 0 || next >= total) return
    goTo(next, delta === 1 ? 'forward' : 'backward')
  }, [activeIndex, goTo, total])

  const onViewerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (activeIndex < 0) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      goTo(0, 'backward')
    } else if (event.key === 'End') {
      event.preventDefault()
      goTo(total - 1, 'forward')
    }
    // Escape belongs to the canonical Dialog, which owns the topmost layer.
  }

  return (
    <section className={onDark ? 'a3-mg a3-mg-dark' : 'a3-mg'} aria-label={label}>
      {filters && filters.length > 0 && (
        <div className="a3-mg-filters" role="group" aria-label={label}>
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="a3-mg-filter hit-target"
              aria-pressed={filter.active}
              onClick={filter.onSelect}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <p className="a3-mg-empty">{emptyLabel}</p>
      ) : (
        <ul className="a3-mg-grid">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={index === 0 ? 'a3-mg-cell a3-mg-lead' : 'a3-mg-cell'}
            >
              <div className="a3-mg-media">
                {/* The first item is the dominant view: it takes the full
                    grid width at a 16:9 ratio, so at 1440 its long edge is
                    the chapter's own measure — far past the ~640 px the
                    brief asks for — while the supporting views stay a
                    three-up row of 3:2 cards. */}
                <MediaFrame
                  ratio={index === 0 ? 'hero' : 'card'}
                  state="loaded"
                  src={item.src}
                  alt={item.alt}
                  seed={item.id}
                  sourceId={item.sourceId}
                />
                {/* A real <button>, laid over the frame rather than wrapped
                    around it: `MediaFrame` renders a <figure>, which is flow
                    content and may not sit inside a button. The overlay is
                    the whole frame, so the 44 × 44 hit target never collides
                    with a neighbour (R-04) and the focus ring draws on the
                    image edge. */}
                <button
                  type="button"
                  className="a3-mg-open hit-target"
                  aria-label={item.context ? `${item.caption} · ${item.context}` : item.caption}
                  onClick={() => goTo(index, 'forward')}
                />
              </div>
              <p className="a3-mg-caption">
                <span className="a3-mg-caption-text">{item.caption}</span>
                {item.context && (
                  <span className="a3-mg-caption-context">{item.context}</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => { if (!next) setOpenIndex(null) }}
        labelledBy={titleId}
        panelClassName="a3-mg-viewer"
        scrimClassName="a3-mg-scrim"
      >
        {current && (
          /* The paging keys belong to the viewer as a whole — the listener
             sits on the panel body so it fires wherever focus rests inside
             it — and every one of them also has its own real button, so the
             key handling is a shortcut, never the only route. */
          <div className="a3-mg-viewer-body" onKeyDown={onViewerKeyDown}>
            <div className="a3-mg-viewer-bar">
              <h2 id={titleId} className="a3-mg-viewer-title" tabIndex={-1}>{label}</h2>
              <p className="a3-mg-viewer-pos" role="status">
                {positionLabel(activeIndex + 1, total)}
              </p>
              <button
                type="button"
                className="a3-mg-viewer-close hit-target"
                onClick={() => setOpenIndex(null)}
              >
                {closeLabel}
              </button>
            </div>

            <div className="a3-mg-viewer-stage">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  className="a3-mg-viewer-figure"
                  variants={motionTokens.direction[direction]}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <MediaFrame
                    ratio="hero"
                    state="loaded"
                    src={current.src}
                    alt={current.alt}
                    seed={current.id}
                    sourceId={current.sourceId}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <p className="a3-mg-viewer-caption">
              <span className="a3-mg-caption-text">{current.caption}</span>
              {current.context && (
                <span className="a3-mg-viewer-context">{current.context}</span>
              )}
            </p>

            <div className="a3-mg-viewer-nav">
              <button
                type="button"
                className="a3-mg-viewer-step hit-target"
                aria-disabled={activeIndex === 0}
                onClick={() => step(-1)}
              >
                {previousLabel}
              </button>
              <button
                type="button"
                className="a3-mg-viewer-step hit-target"
                aria-disabled={activeIndex === total - 1}
                onClick={() => step(1)}
              >
                {nextLabel}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  )
}
