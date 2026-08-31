import { useTx } from '../i18n'

/**
 * MediaFrame — canonical media primitive (REDESIGN R1, DESIGN-05/§8).
 *
 * Before R1 imagery existed only as ad-hoc `a3-option-media` tiles inside
 * the configurator: no shared ratio/treatment/caption/fallback/provenance
 * system, no project-identity primitive. This closes that Design System
 * gap (audit: "a dormant identity asset — zero consumers").
 *
 * Ratios (provisional, `--ratio-media-*` in tokens.css): `pano` 16:5
 * (project identity headers), `card` 3:2 (option/building/project cards),
 * `tile` 1:1 (thumbnails).
 *
 * Six states, all DESIGNED (never a generic grey rectangle):
 * `loaded` · `loading` (flat skeleton, rule 30 — no shimmer) · `empty` ·
 * `unavailable` · `error` (with retry when `onRetry` is given) ·
 * `fallback` (explicit: no photo asset is expected to ever exist here).
 * `empty`/`unavailable`/`error`/`fallback` all render the SAME typed
 * material-palette identity graphic (architectural massing + horizontal
 * material bands) — intentional in a client meeting, never a placeholder
 * icon or a repeated project monogram — distinguished
 * only by their accessible state text and whether retry is offered.
 *
 * Provenance: `sourceId` is the ONLY thing this component renders toward
 * an asset manifest entry (`design-system/assets-manifest.json`) — caption/
 * licence/attribution are caller-supplied copy, never invented here.
 */

export type MediaFrameRatio = 'pano' | 'card' | 'tile'
export type MediaFrameState = 'loaded' | 'loading' | 'empty' | 'unavailable' | 'error' | 'fallback'

const RATIO_CLASS: Record<MediaFrameRatio, string> = {
  pano: 'aspect-media-pano',
  card: 'aspect-media-card',
  tile: 'aspect-media-tile',
}

const STATE_TEXT_DE: Record<Exclude<MediaFrameState, 'loaded' | 'loading'>, string> = {
  empty: 'Noch kein Bild hinterlegt',
  unavailable: 'Bild derzeit nicht verfügbar',
  error: 'Bild konnte nicht geladen werden',
  fallback: '', // caller-supplied via `fallbackLabel`, e.g. a project name
}

/**
 * VR2-01 (Acceptance remediation, cycle 2): four foreground materials —
 * `timber-light` / `timber-dark` / `clinker` / `plinth` (`plaster` is
 * reserved: it IS `--color-surface-canvas`, this graphic's own background,
 * so using it in the building border or band strip would render an
 * invisible segment, not a fourth colour). Each variant below is a cyclic
 * rotation: one material takes the building border, the other three fill
 * the band strip in rotated order — every variant still shows all four
 * canonical materials, only the arrangement differs, so nothing here is an
 * invented colour (rule 2).
 */
const FALLBACK_VARIANTS: { border: string; bands: [string, string, string] }[] = [
  {
    border: 'var(--primitive-color-material-plinth)',
    bands: [
      'var(--primitive-color-material-timber-light)',
      'var(--primitive-color-material-timber-dark)',
      'var(--primitive-color-material-clinker)',
    ],
  },
  {
    border: 'var(--primitive-color-material-clinker)',
    bands: [
      'var(--primitive-color-material-plinth)',
      'var(--primitive-color-material-timber-light)',
      'var(--primitive-color-material-timber-dark)',
    ],
  },
  {
    border: 'var(--primitive-color-material-timber-dark)',
    bands: [
      'var(--primitive-color-material-clinker)',
      'var(--primitive-color-material-plinth)',
      'var(--primitive-color-material-timber-light)',
    ],
  },
  {
    border: 'var(--primitive-color-material-timber-light)',
    bands: [
      'var(--primitive-color-material-timber-dark)',
      'var(--primitive-color-material-clinker)',
      'var(--primitive-color-material-plinth)',
    ],
  },
]

/** Stable small hash of the seed → one of N deterministic fallback variants
 * (same project always renders the same variant; different projects spread
 * across all variants instead of collapsing to a two-way coin flip). */
function variantIndex(seed: string, count: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % count
}

/** The designed fallback: an information-bearing architectural identity
 * graphic over three material bands — DESIGN-05's "typed material-palette
 * composition", not a grey box or repeated initials. Acceptance (VR2-01
 * cycle 2) found every card rendering as "the same canonical fallback
 * drawing": the previous version only ever swapped the building border
 * between two colours by `seed.length % 2`, so at card thumbnail scale
 * every one of the fixture's eight opportunities looked identical. Four
 * deterministic variants (border colour AND band order both rotate)
 * replace that two-way toggle — the building silhouette itself (roof,
 * four windows, ground) stays the shared shape by design, only its
 * material identity varies per project. */
function FallbackArt({ seed }: { seed: string }) {
  const { border, bands } = FALLBACK_VARIANTS[variantIndex(seed, FALLBACK_VARIANTS.length)]!
  return (
    <div
      className="a3-media-identity-art absolute inset-0 flex flex-col"
      style={{ background: 'var(--color-surface-canvas)' }}
      aria-hidden="true"
    >
      <div className="min-h-0 flex-1 flex items-center justify-center overflow-hidden">
        <div
          className="a3-media-identity-building"
          style={{ borderColor: border }}
          aria-hidden="true"
        >
          <span className="a3-media-identity-roof" />
          <span className="a3-media-identity-window a3-media-identity-window-a" />
          <span className="a3-media-identity-window a3-media-identity-window-b" />
          <span className="a3-media-identity-window a3-media-identity-window-c" />
          <span className="a3-media-identity-window a3-media-identity-window-d" />
          <span className="a3-media-identity-ground" />
        </div>
      </div>
      <div className="flex h-2">
        {bands.map((band, i) => (
          <span key={i} className="flex-1" style={{ background: band }} />
        ))}
      </div>
    </div>
  )
}

export function MediaFrame({
  ratio, state, src, alt, seed, caption, fallbackLabel, sourceId, onRetry,
}: {
  ratio: MediaFrameRatio
  state: MediaFrameState
  /** Required when `state === 'loaded'`. */
  src?: string
  /** Accessible description of the image content (never the caption verbatim). */
  alt?: string
  /** Stable identity seed retained for the canonical media API. */
  seed: string
  /** Optional caption bar under the frame (metadata disclosure, not on-image text). */
  caption?: string
  /** Overrides the default DE state text for `state === 'fallback'`. */
  fallbackLabel?: string
  /** Asset-manifest identifier — rendered only as a data attribute for QA/audit tooling, never shown to a client. */
  sourceId?: string
  onRetry?: () => void
}) {
  const tx = useTx()
  const showFallback = state !== 'loaded' && state !== 'loading'
  const stateText = state === 'fallback' ? (fallbackLabel ?? '') : STATE_TEXT_DE[state as Exclude<MediaFrameState, 'loaded' | 'loading'>]

  return (
    <figure className="m-0">
      <div
        className={`relative overflow-hidden ${RATIO_CLASS[ratio]}`}
        style={{ containerType: 'inline-size' }}
        data-media-state={state}
        data-source-id={sourceId}
      >
        {state === 'loaded' && src && (
          // eslint-disable-next-line jsx-a11y/alt-text -- alt is required by the prop type below
          <img src={src} alt={alt ?? ''} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {state === 'loading' && (
          <div className="absolute inset-0" style={{ background: 'var(--color-surface-subtle)' }}>
            <span className="sr-only" role="status">{tx('Wird geladen')}…</span>
          </div>
        )}
        {showFallback && <FallbackArt seed={seed} />}
      </div>
      {/* State text lives BELOW the frame, not overlaid on it: an overlay
       * competed with FallbackArt's centred initials for the same vertical
       * space and visibly collided at short ratios (`card` 3:2, `pano`
       * 16:5) — caught in a Playwright check, not by any automated test.
       * Below-frame placement also matches the `caption` prop's own
       * "metadata disclosure, not on-image text" rule, applied consistently. */}
      {showFallback && stateText && (
        <p className="mt-1 text-caption text-text-secondary">
          {stateText}
          {state === 'error' && onRetry && (
            <button type="button" onClick={onRetry} className="ml-2 underline">
              {tx('Erneut versuchen')}
            </button>
          )}
        </p>
      )}
      {caption && (
        <figcaption className="mt-1 text-caption text-text-secondary">{caption}</figcaption>
      )}
    </figure>
  )
}
