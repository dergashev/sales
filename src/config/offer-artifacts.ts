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

// `default: true` marks the seller's starting selection — the same three
// deliverables the approved VR2-07 target's own SOURCE markup
// (`vo-t1/target-source.html`, `offer` template) shows out of the box:
// the offer presentation, the cost overview, and the scope description.
// SSL/Baubeschreibung/Vertrag start unselected — real, add-on deliverables
// a seller opts into per project, not part of the default commercial climax.
// Order matches the approved VR2-07 target's own artefact order
// (`vo-t1/target-source.html`'s `offer` template: Angebotspräsentation →
// Kostenübersicht → Leistungsumfang) — the gallery renders this catalog's
// order directly, so this is the one place that order is decided.
export const OFFER_ARTIFACTS: ReadonlyArray<{
  id: OfferArtifactId
  label: string
  default: boolean
}> = [
  { id: 'praesentation', label: 'Angebotspräsentation (PDF)', default: true },
  { id: 'kg', label: 'Kostenübersicht KG', default: true },
  { id: 'leistungen', label: 'Leistungen — enthalten / nicht enthalten', default: true },
  { id: 'ssl', label: 'Schnittstellenmatrix (SSL)', default: false },
  { id: 'baubeschreibung', label: 'Baubeschreibung', default: false },
  { id: 'vertrag', label: 'Vertragsvorlagen für die Rechtsabteilung', default: false },
]

/** Die vom Verkäufer noch nicht angepasste Grundauswahl — dieselben drei
 * IDs, die `ARTIFACTS`' eigene `default: true`-Markierung schon immer
 * meinte (vorher liefen `offerDraft.attachments`-Default-IDs unter einem
 * anderen Namensschema und trafen keine reale Katalog-ID, wodurch S5Export's
 * eigene Checkboxen beim ersten Laden fälschlich alle leer waren). */
export const DEFAULT_OFFER_ATTACHMENTS: OfferArtifactId[] = OFFER_ARTIFACTS
  .filter((a) => a.default)
  .map((a) => a.id)
