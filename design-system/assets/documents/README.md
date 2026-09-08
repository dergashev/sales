# Leipzig demonstration document pack

`leipzig/` holds twelve synthetic German construction-project PDFs (87 pages) for
the demo project `DEMO-COMPLEX-01` — "Quartier Am Güterbogen", three buildings.
They exist so Project Understanding can cite real evidence: a document, a page,
a named clause. They replace the earlier fixture situation in which 36 document
records all pointed at six schematic SVG images.

`manifest.json` is the provenance record: one entry per document with id, file,
title, `documentType`, revision, page count, `issuedAt`, origin, author, licence,
intended use, the fixture buildings it is about, its sha256, and its evidence
anchors. `anchorCount` is the pack total (74) so a test can assert it.

## DEMO material — the boundary

Every page carries the footer line
`DEMO · synthetisches Beispieldokument · keine Vergabegrundlage`.

Approved use: internal Product work, implementation, test fixtures and clearly
labelled client-demo environments. **Never** a tender, contract or valuation
basis, and never external publication without legal and brand approval. Nothing
in the pack is client material, nothing is externally licensed, and the only
organisation named is the demo fixture's invented client.

## Regenerating

    python3 tools/build_leipzig_documents.py

That script is the single source of the pack. Do not hand-edit a PDF and do not
hand-edit `manifest.json` — change the generator and re-run it. The build is
byte-stable: two consecutive runs produce identical sha256 sums, because the PDF
creation date is pinned to each document's own issue date and nothing reads the
clock or a random source.

Requirements: `fpdf2` and `pypdf` (both already present in the tooling
environment). Nothing is added to `package.json`; the pack is built out-of-band
and committed.

## Provenance rules

- `origin` is `internal synthetic` for every entry, and `demoFixture` is `true`.
- Numbers are never authored twice. Every area, unit count, workplace count,
  parking count and schedule date is read at build time from
  `src/fixtures/vr3-demo-projects.json` (`DEMO-COMPLEX-01`). Per-storey and
  per-room decompositions are declared in the generator and **asserted** to sum
  exactly to the fixture figure they decompose; a fixture change that breaks a
  decomposition fails the build.
- Where the fixture holds `null` the document says `entfällt` in words and never
  prints a zero — the site area, for example, has no confirmed value and is
  stated as such. Where the fixture holds a real `0.00` (the Kontorhaus has no
  basement) the zero is printed together with the sentence that explains it.
- The build verifies each PDF with `pypdf`: exact page count, extractable text on
  every page, the DEMO marking on every page, U+202F present as the number/unit
  separator, and U+00A0 absent.
- Evidence anchors are `<document id>-A<nn>`, numbered per document from `A01`,
  printed as a small monospaced tag in the right margin next to the clause they
  name, and recorded in the manifest with page, `labelDe` and `labelEn`.

## Typography note

Core PDF fonts only (Helvetica, Courier) — nothing is embedded, least of all the
brand font. Core fonts are Latin-1 and do not contain U+202F, so the generator
prints the narrow no-break space through code `0x7F`, remapped by an
`/Encoding /Differences` entry to the `space` glyph and by a `/ToUnicode` CMap to
U+202F. Extractors therefore read back the separator this repository requires.
No rounded corners, no gradients, no shadows: hairlines, rectangles and type.
