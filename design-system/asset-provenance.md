# Asset provenance contract (REDESIGN R1, ADR-R1-06)

Ticket §"ASSET PROVENANCE": every externally sourced image must carry
sufficient provenance to verify and reproduce. This document is that
contract. It **extends**, not duplicates, the existing mechanism at
`design-system/assets/options/manifest.json` (52 entries, machine-checked
against the catalog by the `OPT-IMAGE` class in `npm run verify`) — R1 does
not create a second manifest format.

## Required fields (new entries, from this ticket onward)

| Field | Type | Required | Meaning |
|---|---|---|---|
| `group` / `value` or `id` | string | yes | Catalog key (existing `group`+`value` pattern for option tiles; a plain `id` for identity/project imagery that has no group/value axis). |
| `file` | string | yes | Filename under `design-system/assets/**`, resolved via `import.meta.glob` (`src/assets/option-images.ts`) — never a string path in component code. |
| `motifDe` | string | yes | What the image shows, in German (existing field name, kept for consistency). |
| `sourceUrl` | string | **new, required for anything not produced in-house** | Exact URL of the source asset (Unsplash/Pexels permalink, generator session, etc.). |
| `sourceService` | string | **new, required** | `unsplash` \| `pexels` \| `openai-imagegen` \| `photography-inhouse` \| other named service. |
| `author` | string | **new, required when the licence demands attribution** | Photographer/creator name. Omit only when the licence is explicitly attribution-free (record that explicitly in `licence`, not by silently leaving `author` blank). |
| `licence` | string | **new, required** | Exact licence/usage terms (e.g. `Unsplash License`, `Pexels License`, `CC0`, `in-house — All3 owns the asset`). Never left implicit. |
| `intendedUse` | string | **new, required** | Where this asset may legitimately appear (`option-tile` \| `project-identity` \| `specimen-only` \| `client-facing-export` …). A `specimen-only` asset must not be reused product-side without a fresh licence check. |
| `retrievedAt` | ISO date | **new, required** | When the asset was sourced — licences and availability drift; this is the audit anchor. |

The existing `source` free-text field (e.g. `"OpenAI ImageGen, generiert am
2026-08-07"`) remains valid for entries created before this contract and is
**not** rewritten to the new shape retroactively by this ticket — see
"Legacy entries" below.

## Sourcing rule

Unsplash, Pexels, or an equivalent permissively-licensed source only.
Never an unverified image-search result. In-house/OpenAI-generated assets
are recorded with `sourceService` naming the tool and `licence: "in-house —
All3 owns the asset"`.

## `intendedUse` boundary

An asset registered `intendedUse: "specimen-only"` (used only to
demonstrate a Design System capability, e.g. `MediaFrame`'s `loaded` state
in the registry) may not be silently promoted into product-facing use —
that requires a manifest entry update confirming the licence still covers
the new context, and, for anything client-facing, a check against
`EMAIL-001/002`/export policy (`output-model.md`), which is outside this
Design-System-only ticket's authority.

## Legacy entries — explicit, not silent

The 52 existing `design-system/assets/options/manifest.json` entries
predate this contract. This ticket does **not** retroactively invent
`licence`/`author`/`intendedUse` values for them — doing so from outside
the original sourcing decision would be fabricated provenance (forbidden:
"Do not invent provenance"). They remain governed by their existing
`source` string until whoever sourced them (or a dedicated audit pass)
confirms the new fields. Any NEW asset added after this ticket lands **must**
use the full field set above — `OPT-IMAGE`-class verification should be
extended (tracked follow-up, not done in this pass) to require the new
fields for entries whose `retrievedAt` postdates R1's landing commit.

## Existing product imagery brought into the model

The option-tile catalog (`design-system/assets/options/manifest.json`) is
already inside this provenance model in shape (the `source` field), just
not the full field set. The isometric illustration set (KG 200/300/500
tiles, mode cards — audit DESIGN-05) is **not yet** in any manifest; a
retro-registration pass for those is an explicit **KNOWN NON-BLOCKING
FOLLOW-UP** of this ticket, not silently absorbed here.

See also: `docs/audits/sales-experience-redesign-audit-20d23a1.md` §8
(image art direction), `design-system/imagery.md` (this ticket, art
direction guidance), `src/design-system/MediaFrame.tsx` (the consuming
primitive — `sourceId` prop is the manifest-key hook, never shown to a
client).
