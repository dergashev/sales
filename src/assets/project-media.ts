import manifest from '../../design-system/assets/projects/manifest.json'

/**
 * VR3-01 — registered project media (`assetId` → URL + motif).
 *
 * The VR3-00 media manifest states the rule this module exists to enforce:
 * "Every implementation consumer references `assetId`; no unidentified
 * downloaded image or random URL is allowed." So the lookup key is the
 * asset id from
 * `artifacts/VR3-00-global-design-audit/07-media/media-manifest.md`, the
 * file name comes from the repository manifest next to the files, and the
 * URL comes from the bundler (`import.meta.glob`). There is no string path
 * in component code: renaming a file breaks the build, not the rendering —
 * the same reasoning as `option-images.ts`.
 *
 * `motifDe` is what the image SHOWS, in German, and it is the source of the
 * accessible description. It is a genuine user-visible product string, so
 * the caller resolves it through `useTx()` (rule 36) exactly as
 * `option-images.ts`' motif is resolved: this module stays presentation
 * data only.
 *
 * Every entry is synthetic DEMO material (`demoFixture: true`) and carries
 * the full provenance field set required by
 * `design-system/asset-provenance.md`.
 */

type Entry = {
  id: string
  file: string
  motifDe: string
  intendedUse: string
  demoFixture: boolean
}

const FILES = {
  ...(import.meta.glob(
    '../../design-system/assets/projects/*.jpg',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>),
  ...(import.meta.glob(
    '../../design-system/assets/projects/*.svg',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>),
}

const BY_NAME = new Map(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!, url]),
)

const INDEX = new Map((manifest as Entry[]).map((e) => [e.id, e]))

export type ProjectAsset = {
  /** The registered asset id — also rendered as MediaFrame's `sourceId`. */
  assetId: string
  url: string
  /** German motif description; the caller passes it through `useTx()`. */
  motifDe: string
}

/**
 * Registered asset for an `assetId`, or `null` when the id is unknown or
 * its file is missing. `null` is a real state: the caller renders
 * `MediaFrame`'s information-bearing missing state, never a silent gap.
 */
export function projectAsset(assetId: string): ProjectAsset | null {
  const entry = INDEX.get(assetId)
  if (!entry) return null
  const url = BY_NAME.get(entry.file)
  if (!url) return null
  return { assetId: entry.id, url, motifDe: entry.motifDe }
}

/** Every registered project asset id, for fixture-integrity assertions. */
export function registeredProjectAssetIds(): string[] {
  return (manifest as Entry[]).map((e) => e.id)
}
