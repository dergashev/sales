# Imagery art direction (REDESIGN R1, ADR-R1-07)

Ticket §"DEFINE IMAGE ART DIRECTION". Source: redesign audit §7-8
(`docs/audits/sales-experience-redesign-audit-20d23a1.md`). This document
defines more than a container — it is the canonical reference `MediaFrame`
consumers (R2 onward) must follow.

## Core principle

> Imagery must communicate recognition, concept, difference or
> desirability. Do not add imagery simply because a component has an image
> slot.

An image earns its space. If two variant images would look identical, the
correct answer is the compact choice control (`OptionTile` compact
variant, AUD-09), not a duplicate photo distinguished only by a checkmark
(the exact defect the audit found live, DESIGN-05).

## Two visual worlds, reconciled, never mixed inside one decision

### Photography — reality

Contemporary European timber/residential architecture. Warm daylight, low
saturation lift, consistent crop. People rare and incidental — never a
lens gimmick, never a stock-photo smile. Treatment: neutral colour grade
with a slight warm lift; an optional plaster-tone duotone is permitted for
background-only use (never over content-bearing imagery).

- Crop ratios: `pano` 16:5 (project identity), `card` 3:2 (option/building/
  project cards), `tile` 1:1 (thumbnails) — see `--size-ratio-media-*` in
  `tokens.css`. Not locked; R2 composition testing may revise them.

### Isometrics — concepts

Scope, mode, structural/KG illustrations. One established style (kept —
the audit found it likeable), one background tone (`--primitive-color-
material-plaster`), one line weight, one scale per chapter. No duplicate-
image variants distinguished only by a checkmark.

**These two worlds never appear side by side representing the same
decision** — a chapter either shows photography (a real material/finish
choice) or isometrics (a structural/scope choice), not a mix.

## Fallback — designed, never generic

When no photo exists (yet, or ever — `specimen-only`/conceptual contexts),
`MediaFrame`'s `fallback`/`empty`/`unavailable`/`error` states render a
**typed material-palette composition**: the subject's initials in Display
type over the three-tone material band (plaster → timber-light → clinker).
This must look intentional in a client meeting — never a grey rectangle,
never a broken-image icon. See `src/design-system/MediaFrame.tsx`'s
`FallbackArt`.

## Relationship to text

Caption text lives **below** the frame (`figcaption`/state-text), never
overlaid on the image as a floating scrim label — overlaid text was tried
during this ticket's own specimen authoring and visually collided with the
fallback art's centred initials at short ratios (`card`, `pano`); moving it
below the frame is now the canonical rule, not just this ticket's
workaround.

## When imagery should NOT be used

- To fill a component slot with no communicative purpose.
- Where the compact choice control already states the decision clearly and
  two images would be near-identical (AUD-09 boundary).
- As the sole carrier of a status/state distinction (rule 8 — imagery is
  never the only signal for a decision-relevant state).

## Provenance

Every externally sourced image is registered per
`design-system/asset-provenance.md` before use, product or specimen.
