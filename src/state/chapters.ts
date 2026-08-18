/**
 * Canonical Configurator (S3) chapter identity and order.
 *
 * Lives in its own module — not in `S3Konfigurator.tsx` (the presentation
 * layer that renders the chapters) and not in `store.ts` (the state layer
 * that gates pricing/building-scope on chapter identity) — so both layers
 * can depend on the SAME order without a circular import between them.
 *
 * Product contract (2026-08-18, "MAKE SCOPE BOUNDARIES THE AUTHORITATIVE
 * CONFIGURATOR ENTRY STEP"): commercial scope (Leistungsabgrenzung) is
 * established before detailed technical configuration. Previously
 * `Leistungen KG 300` opened first and `Leistungsabgrenzung` was chapter 2;
 * this is a pure reorder — chapters 3–8 keep their existing numbers.
 *
 * `SCOPE_BOUNDARIES_CHAPTER` is derived from `CHAPTERS`, not hand-copied, so
 * `store.ts`'s pricing-start trigger and the building-scope split key off
 * "enter Leistungsabgrenzung" as an IDENTITY, never off a literal chapter
 * number that could silently go stale on the next reorder.
 */
export const CHAPTERS = [
  'Leistungsabgrenzung', 'Leistungen KG 300', 'Technik KG 400',
  'Energie & Zertifikate', 'Flächen im Detail', 'Baugrund & Erschließung',
  'Baunebenkosten KG 700', 'Termine & Kommerzielles',
] as const

export const SCOPE_BOUNDARIES_CHAPTER = CHAPTERS.indexOf('Leistungsabgrenzung') + 1
