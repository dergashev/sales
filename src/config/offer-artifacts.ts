/**
 * Der Angebots-Artefaktkatalog — EINE Quelle für "was kann in diesem
 * Angebot enthalten sein", geteilt von `S5Export.tsx` (wo der Verkäufer
 * die Anlagen auswählt, `offerDraft.attachments`) und der Client-Galerie
 * in `PresentationShell.tsx`'s `OfferClimax` (VR2-07).
 *
 * War vorher EINE lokale Konstante nur in `S5Export.tsx`; die Client-Galerie
 * hatte einen eigenen, literalen Drei-Item-Fallback (`offer`/`cost`/`scope`),
 * der real ausgewählte Anlagen ignorierte — die Galerie konnte also nie
 * echt leer, gemischt oder länger als drei Einträge sein (Acceptance-Fund
 * VR2-07 Zyklus 3: "no-artefact and generated/mixed list states are not
 * reachable from real data"). Extrahiert, damit beide Seiten dieselben
 * IDs/Labels verwenden — kein zweiter, driftender Katalog.
 */
export type OfferArtifactId = 'praesentation' | 'leistungen' | 'ssl' | 'baubeschreibung' | 'kg' | 'vertrag'

// ACCEPTANCE REMEDIATION (cycle 5): `default` here is UNCHANGED from the
// literal values `S5Export.tsx`'s own `ARTIFACTS` array always had before
// this catalog was extracted. Cycle 4 changed these flags (and made
// `offerDraft.attachments`'s persisted default reference them) to make the
// Offer gallery's default view match the approved target's exact three
// items — Acceptance rejected that: VR2-07 explicitly preserves existing
// persisted/default artefact-selection semantics and must not change what
// S5Export preselects or would send. These flags are cosmetic/informational
// only again (S5Export never actually reads `default` to seed a real
// selection — see `state/store.ts`'s own, separately-defined, UNCHANGED
// `offerDraft.attachments` initial value) — restored verbatim.
//
// Array ORDER (not `default`) matches the approved target's own artefact
// order (`vo-t1/target-source.html`'s `offer` template: Angebotspräsentation
// → Kostenübersicht → Leistungsumfang) purely for the Offer gallery's
// display sequence WHEN those items happen to be selected — this affects
// only rendering sequence, never what is selected/persisted/sent, so it is
// not part of the preserved default-selection invariant.
export const OFFER_ARTIFACTS: ReadonlyArray<{
  id: OfferArtifactId
  label: string
  default: boolean
}> = [
  { id: 'praesentation', label: 'Angebotspräsentation (PDF)', default: true },
  { id: 'kg', label: 'Kostenübersicht KG', default: false },
  { id: 'leistungen', label: 'Leistungen — enthalten / nicht enthalten', default: true },
  { id: 'ssl', label: 'Schnittstellenmatrix (SSL)', default: true },
  { id: 'baubeschreibung', label: 'Baubeschreibung', default: false },
  { id: 'vertrag', label: 'Vertragsvorlagen für die Rechtsabteilung', default: false },
]
