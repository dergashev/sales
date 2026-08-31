import manifest from '../../design-system/assets/identity/manifest.json'

/**
 * VR2-01 (Acceptance remediation, cycle 3) — project identity photography
 * for Opportunity portfolio cards.
 *
 * Acceptance rejected cycle 2 for "all eight candidate cards render fallback
 * art; target uses photographic project media for Nordfeld/Westpark/
 * Seeblick." The fixture (`src/fixtures/opportunities.json`) still carries
 * no image field — this lookup is presentation-only, keyed by opportunity
 * `id`, and never touches the commercial fixture data (PRESERVE, no
 * Opportunity-data changes).
 *
 * The image itself is not new sourcing: it is recovered from the
 * Design-Director-and-Product-Owner-approved VO-T1 target board
 * (`artifacts/visual-outcome-audit-18e7d71/vo-t1/target-source.html`,
 * commit 966c833), which used this SAME single photograph as its
 * "photographed project" placeholder for THREE portfolio cards — Nordfeld
 * (centred), Westpark (left-cropped), Seeblick (right-cropped) — via CSS
 * `background-position`. This mapping replicates that exact target
 * assignment, matched by project name, using `MediaFrame`'s new
 * `focalPoint` prop to reproduce the three crops from the one source frame.
 *
 * Provenance is intentionally incomplete, not fabricated: see
 * `design-system/assets/identity/manifest.json`'s `auditStatus` field. The
 * asset predates any sourcing record anywhere in this repository's history;
 * `design-system/asset-provenance.md` forbids inventing a licence/author
 * that isn't actually known, so this entry says exactly that instead.
 *
 * `follow the manifest`, not a filename convention (same reasoning as
 * `option-images.ts`): a renamed/removed manifest entry gives a missing
 * lookup, not a silently wrong image.
 */

type Entry = { id: string; file: string; motifDe: string }

const FILES = import.meta.glob(
  '../../design-system/assets/identity/*.webp',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const BY_NAME = new Map(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!, url]),
)

const INDEX = new Map((manifest as Entry[]).map((e) => [e.id, e]))

/** Opportunity id → { manifest id, focal point on the shared source frame,
 * i18n key naming the specific view/credit }. Only the three opportunities
 * the approved VO-T1 target itself names as photographed are mapped — every
 * other opportunity keeps the intentional fallback identity graphic (target
 * parity, not an arbitrary subset). The credit/view name is a genuine
 * user-visible product string, so it is a dictionary key (DE/EN, rule 36),
 * resolved by the caller via `useT()` — this module stays presentation-data
 * only, like `motifDe` in `option-images.ts`'s own manifest. */
const OPPORTUNITY_MEDIA: Record<string, { assetId: string; focalPoint: 'left' | 'center' | 'right'; creditKey: string }> = {
  'DEMO-0001': { assetId: 'opp-nordfeld-hero', focalPoint: 'center', creditKey: 'opplist.media.credit.nordfeld' },
  'DEMO-0003': { assetId: 'opp-nordfeld-hero', focalPoint: 'left', creditKey: 'opplist.media.credit.westpark' },
  'DEMO-0004': { assetId: 'opp-nordfeld-hero', focalPoint: 'right', creditKey: 'opplist.media.credit.seeblick' },
}

export type OpportunityMedia = { url: string; focalPoint: 'left' | 'center' | 'right'; altKey: string; creditKey: string }

/** Loaded-state media for an opportunity id; `null` when the opportunity has
 * no approved photography (renders the intentional fallback identity
 * graphic instead). Returns i18n keys for both the accessible image
 * description and the credit — `useTx()` only re-typesets a German string
 * that ALREADY exists as a dictionary value (it is a lookup, not a live
 * translator: an ad-hoc string like `entry.motifDe` would silently stay
 * German in the `en` locale), so an accessible `alt` needs a real key like
 * everything else the caller resolves through `useT()`. */
export function opportunityMedia(opportunityId: string): OpportunityMedia | null {
  const mapped = OPPORTUNITY_MEDIA[opportunityId]
  if (!mapped) return null
  const entry = INDEX.get(mapped.assetId)
  if (!entry) return null
  const url = BY_NAME.get(entry.file)
  if (!url) return null
  return { url, focalPoint: mapped.focalPoint, altKey: 'opplist.media.photoAlt', creditKey: mapped.creditKey }
}
