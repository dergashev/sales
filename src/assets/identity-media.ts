import manifest from '../../design-system/assets/identity/manifest.json'

/**
 * The ONE reader of `design-system/assets/identity/**` — people and
 * project-identity photography registered in that folder's provenance
 * manifest.
 *
 * Two readers of one manifest is the duplicate-primitive shape this project
 * forbids, so `opportunity-media.ts` now delegates here instead of keeping
 * its own `import.meta.glob` and its own index. The lookup key stays the
 * manifest `id`: renaming a file breaks the build, not the rendering (the
 * same reasoning as `project-media.ts` and `option-images.ts`).
 */

type Entry = {
  id: string
  file: string
  motifDe: string
  altKey?: string
  accessibleTreatment?: string
}

const FILES = {
  ...(import.meta.glob(
    '../../design-system/assets/identity/*.webp',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>),
  ...(import.meta.glob(
    '../../design-system/assets/identity/*.jpg',
    { eager: true, query: '?url', import: 'default' },
  ) as Record<string, string>),
}

const BY_NAME = new Map(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!, url]),
)

const INDEX = new Map((manifest as Entry[]).map((e) => [e.id, e]))

export type IdentityAsset = {
  assetId: string
  url: string
  /** Dictionary key for the accessible description, when the asset has one. */
  altKey: string | null
}

/**
 * The registered identity asset for an id, or `null` when the id is unknown
 * or its file is missing. `null` is a real state: the caller renders its own
 * information-bearing absence, never a silent gap.
 */
export function identityAsset(assetId: string): IdentityAsset | null {
  const entry = INDEX.get(assetId)
  if (!entry) return null
  const url = BY_NAME.get(entry.file)
  if (!url) return null
  return { assetId: entry.id, url, altKey: entry.altKey ?? null }
}

/**
 * The signed-in user's portrait.
 *
 * DECORATIVE by manifest declaration: the account trigger and the popover
 * both print the name right beside it, so an `alt` here would make a screen
 * reader say the same person twice. The identity lives in the trigger's
 * accessible name, which is where a name belongs.
 */
export const ACCOUNT_PORTRAIT_ASSET_ID = 'USER-DANIEL-WEBER'
