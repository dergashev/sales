# ADR package — REDESIGN R1 (efcbdaf3)

Consolidates the architecture decisions this ticket makes, each already
referenced inline at its point of use in `tokens.css`/`tools/verify.py`/the
new components. This is the single place to read them together, per the
ticket's §"GOVERNANCE & CONTRACTS" requirement and the repository's ADR
convention (`docs/audit/adr-blocking.md`).

Status legend: **RATIFIED** (implemented, contrast/behaviour evidence
attached or explicitly flagged as still required) · **PENDING EVIDENCE**
(implemented, a specific measurement is still owed before the ADR can
close per TOKEN-005's beta/stable gate) · **EVIDENCE VERIFIED (technical) —
DESIGN ACCEPTANCE PENDING** (the owed measurement has been taken against a
verified CURRENT_MAIN runtime and recorded below; this closes the
TOKEN-005 technical-evidence obligation only — it is not RATIFIED, because
RATIFIED additionally asserts final Design Director visual/aesthetic
acceptance, which is the separate Post-R1 Design Director Release Audit's
job) · **EVIDENCE FAILED – DESIGN REVIEW REQUIRED** (the measurement was
taken and recorded, and it falls short of the bar that applies to it; the
token is deliberately left unchanged here — the Design Director decides
whether the value, the treatment, or the use case changes).

*Added 2026-08-26 (R1 Evidence Closure, task base `967c36869a1572652ee8a900723f85f244f1b605`):
ADR-R1-02 and ADR-R1-03 below were promoted from PENDING EVIDENCE using
these two new terminal states. Neither promotion asserts RATIFIED.*

---

## ADR-R1-00 — Flat geometry: reviewed and preserved

**Decision:** `--radius: 0`, no shadows, no gradients remain law. Depth in
the new surface model comes from tone, contrast, scale and space only.

**Status:** RATIFIED.

**Why:** the ticket explicitly authorised challenging this rule if it
materially improved the target quality. It was reviewed, not assumed —
flat geometry is judged the single most distinctive asset the brand owns,
and the audit's expressiveness gap (DESIGN-04) is a tonal/spatial deficit,
not a geometric one. Selective radius/elevation were considered and
rejected deliberately.

**Consequence:** `.a3-composition-bar`, `MediaFrame`, `WorkflowStepper`,
`DateField`, `Stepper` — every R1 primitive — ship with zero radius/shadow.

---

## ADR-R1-01 — Canvas repointed to the material palette

**Decision:** `--color-surface-canvas` moves from All3-Grey (`#E8ECE9`,
`--primitive-color-neutral-100`) to plaster (`#EDEBE4`,
`--primitive-color-material-plaster`).

**Status:** RATIFIED. Regression-verified: full test suite (696 tests) and
`npm run build` green after the repoint; the R-01 orange-on-canvas
prohibition is preserved (canvas is never a legal surface for the brand
accent regardless of its exact shade — see rule 5).

**Why:** the material palette sat with zero consumers before this ticket
(audit: "a dormant identity asset"). E8ECE9 stays available as a raw
primitive for print/brand contexts; it is no longer the app's canvas.

---

## ADR-R1-02 — Stage-deep: the second permitted #FD5E00 exception

**Decision:** `--color-surface-stage-deep` (`#1F1F1F`,
`--primitive-color-neutral-950`, inverse text) is the system's one
expressive peak. Orange display numerals are legal there, extending rule 5
beyond `--color-surface-default`.

**Status:** EVIDENCE VERIFIED (technical) — DESIGN ACCEPTANCE PENDING.
Measured 2026-08-26 against runtime SHA `967c36869a1572652ee8a900723f85f244f1b605`
(CURRENT_MAIN, `.worktrees/r1-validation`, byte-identical to `origin/master`
for every `src/**` and `*.css` path). `tools/verify.py`'s R-01 whitelist
already includes `--color-text-display-accent-on-stage-deep`; the number
below is the first measured (not estimated) reading.

**Measured evidence:**

| Pairing | Rendered value | Background | Measurement method | Measured result | Applicable bar | Status |
|---|---|---|---|---|---|---|
| Brand orange display numeral on stage-deep | `rgb(253,94,0)` = `#FD5E00` | `rgb(31,31,31)` = `#1F1F1F` | Playwright CLI, `getComputedStyle` on the rendered 64px/700 numeral in the Gallery `r1-composed-stage` specimen ("Composed: Commercial Stage Moment"), cross-checked by decoding the pixel colour from a full-resolution element screenshot (`PIL`, both channels sampled independently) | **5.32 : 1** (WCAG relative-luminance formula from the measured RGB pair) | WCAG 1.4.3 large text, ≥3∶1 (64px/700 is far above the 18.67px-bold large-text threshold; this specific use is the R-01 rule 5 display-numeral exception, not body text) | **PASS** |

Both extraction methods agreed exactly on the rendered colours (no opacity,
filter, `mix-blend-mode` or text-shadow present on either the text or its
container — verified via `getComputedStyle` before trusting the pixel
sample). The reading also clears the stricter 4.5∶1 normal-text bar, so no
edge case remains open at any plausible reading of the numeral's role.

**Consequence:** stage-deep is reserved for genuinely important commercial
moments (composed specimen: "Commercial Stage Moment") — never a working
surface.

---

## ADR-R1-03 — Dataviz ramp and status warning ratified

**Decision:** ratifies two previously `[ADR-PENDING]` entries from the DS
remediation audit (design-system-remediation TOKEN-005):

1. `--color-dataviz-category-1..6` no longer alias brand/status colours
   (`blue-500`/`green-dark-500`/`green-bright-500`) — built from the
   architectural/material family instead (closes COLOR-004). Three new
   primitives: `#5E6E62` (deep green-grey), `#5C6B7A` (slate blue-grey),
   `#B8A87E` (warm sand).
2. `--color-status-warning` moves from `neutral-900` (no colour — a
   deliberate absence that made `.a3-tag.a3-orange` a no-op) to a deep
   amber, `#946300` (closes COLOR-006).

**Status:** EVIDENCE VERIFIED (technical) for the dataviz ramp's ratified
graphical role and for the warning colour — **EVIDENCE FAILED – DESIGN
REVIEW REQUIRED** for one discovered pre-existing text-role use of
category-2 (see finding below). DESIGN ACCEPTANCE PENDING on the passing
parts. Measured 2026-08-26 against runtime SHA
`967c36869a1572652ee8a900723f85f244f1b605` (CURRENT_MAIN,
`.worktrees/r1-validation`).

**Measured evidence — dataviz ramp (graphical role):** every category
segment in `CompositionBar` is `aria-hidden`, separated by a mandatory 1px
`--color-dataviz-segment-divider`, and has a full textual equivalent
(container `aria-label` in compact mode: confirmed rendered, e.g.
`"KG 200 · Herrichten & Erschließen ≈ 184.000 € · 6 % · …"` — using
U+202F between each number and its unit, per rule 7); a visible
legend `<li>` with the same label/value/percent in expanded mode: confirmed
rendered). Per WCAG 1.4.11 with a documented redundant-text exemption, the
applicable criterion for a hue this component only ever uses this way is
**non-text graphical object, exempted by the co-rendered textual
equivalent** — a sub-3∶1 ratio here is recorded, not failed, because the
mandatory divider plus the textual equivalent already carry the meaning
non-colour-only.

| Pairing | Rendered value | Background | Method | Measured ratio | Semantic role / bar | Status |
|---|---|---|---|---|---|---|
| `--color-dataviz-category-1` | `rgb(206,194,169)` = `#CEC2A9` | `#FFFFFF` / `#EDEBE4` | `getComputedStyle` on live `CompositionBar` segment, Gallery `r1-compositionbar`; pixel-decoded cross-check | 1.76∶1 / 1.48∶1 | Graphical, text-redundant — no normative text bar | PASS (redundancy) |
| `--color-dataviz-category-2` | `rgb(192,138,108)` = `#C08A6C` | `#FFFFFF` / `#EDEBE4` | same | 2.96∶1 / 2.48∶1 | Graphical, text-redundant — no normative text bar | PASS (redundancy) — **but see finding below: this same value also has a non-redundant text-role use elsewhere** |
| `--color-dataviz-category-3` | `rgb(74,74,72)` = `#4A4A48` | `#FFFFFF` / `#EDEBE4` | same | 8.88∶1 / 7.45∶1 | Graphical, text-redundant | PASS (also clears the 4.5∶1 text bar with margin) |
| `--color-dataviz-category-4` | `rgb(94,110,98)` = `#5E6E62` | `#FFFFFF` / `#EDEBE4` | same | 5.41∶1 / 4.53∶1 | Graphical, text-redundant | PASS (also clears the 4.5∶1 text bar) |
| `--color-dataviz-category-5` | `#5C6B7A` (token-resolved; **not exercised by any rendered specimen in this pass** — the demo fixture's `CompositionBar` instances only cycle through categories 1–4 and 6) | `#FFFFFF` / `#EDEBE4` | Computed from the token declaration only, not live-rendered | 5.47∶1 / 4.59∶1 (computed from the declared hex, cross-checked against the WCAG formula used for every other row) | Graphical, text-redundant | PASS by computation — **runtime rendering not directly observed; re-verify if a specimen ever exercises it** |
| `--color-dataviz-category-6` | `rgb(184,168,126)` = `#B8A87E` | `#FFFFFF` / `#EDEBE4` | `getComputedStyle` on live segment; pixel-decoded cross-check | 2.35∶1 / 1.97∶1 | Graphical, text-redundant — no normative text bar | PASS (redundancy) |

**Measured evidence — warning colour:**

| Pairing | Rendered value | Background | Method | Measured ratio | Role / bar | Status |
|---|---|---|---|---|---|---|
| `--color-status-warning`, glyph-as-text on white | `rgb(148,99,0)` = `#946300` | `#FFFFFF` | `getComputedStyle` on the live `.a3-wfs-marker` "!" glyph, Gallery `r1-workflowstepper` `attention` state | **5.19∶1** | Small text/glyph carrying state meaning → WCAG 1.4.3, ≥4.5∶1 | **PASS** |
| `--color-status-warning`, white text/icon on warning fill (`.a3-modal .a3-warnc`) | same custom property, not independently re-rendered this pass | `#946300` | Same measured token value (identical `var(--color-status-warning)` reference, no overriding rule found in `components.css`) | 5.19∶1 (same pairing, direction-independent) | Text/icon on colour → ≥4.5∶1 | **PASS** — carried from the same measured value; not independently re-rendered in a live `.a3-warnc` instance this pass |
| `--color-status-warning`, border-only (`.a3-tag.a3-orange`, `.a3-zone.a3-yellow`, `.a3-warn-prep`) | same | `#FFFFFF` | Same measured token value | 5.19∶1 | Non-text graphical/border → WCAG 1.4.11, ≥3∶1 | **PASS** |

**FINDING — pre-existing category-2 text-role use, discovered during this
pass (not part of the original ADR-R1-03 handoff, but the same token and
therefore in scope for this ADR's evidence):** `components.css` still
consumes `--color-dataviz-category-2` as **text on white** and as
**white-on-category-2 glyphs/backgrounds** in several selectors that
predate this repoint (`.a3-d.a3-save`, `.a3-q .a3-fx`, `.a3-plog .a3-okc`,
`.a3-doc .a3-okc`, `.a3-ch.a3-done .a3-n`, `.a3-wf-done .a3-n`), rendered by
live product screens (`OfferPanel`, `OpportunityCard`, `S4Vergleich`,
`OptionChapter`, `Sidebar`, `DocumentAnalysis`). These selectors were not
found rendered by any reachable state in this pass's exploration (would
need a specific fixture/interaction state), so the pairing below is
computed from the same live-measured `#C08A6C` value rather than observed
directly in each consuming selector — the colour itself is measured, only
the exact consuming DOM instance is not:

| Pairing | Rendered value (measured, `CompositionBar`) | Background | Method | Measured/computed ratio | Role / bar | Status |
|---|---|---|---|---|---|---|
| `--color-dataviz-category-2` as text-on-white (`.a3-d.a3-save`, `.a3-q .a3-fx`) | `#C08A6C` | `#FFFFFF` | WCAG formula computed from the `getComputedStyle`-measured value above (not independently re-rendered in the exact consuming selector) | 2.96∶1 | Text conveying a value (savings figure) → WCAG 1.4.3, ≥4.5∶1 | **FAIL** |
| `--color-dataviz-category-2` as white-glyph-on-fill (`.a3-plog/.a3-doc .a3-okc`, `.a3-ch.a3-done .a3-n`, `.a3-wf-done .a3-n`) | `#C08A6C` | same | same | 2.96∶1 | Glyph carrying done/state meaning → ≥4.5∶1 as text, ≥3∶1 minimum as graphical | **FAIL** at both applicable bars |
| `--color-dataviz-category-2` as border-only (`.a3-zone.a3-green`, `.a3-delta.a3-saving`) | `#C08A6C` | same | same | 2.96∶1 | Non-text graphical/border → ≥3∶1 | **FAIL** (marginally, 2.96 < 3.00) |

Per this task's failure-handling contract: **the token is not changed
here.** This finding, with its exact selectors and consuming screens, is
carried into the Design Director input pack — the Director decides whether
the value, the treatment, or these specific use cases change. The
`CompositionBar` graphical use of the same token (table above) is unaffected
and stays PASS.

**Consequence:** every dataviz consumer (`CompositionBar`) separates
adjacent segments with a mandatory 1px `--color-dataviz-segment-divider` —
hue is never the sole carrier (rule 8), independent of the exact ADR-R1-03
hex values.

---

## ADR-R1-04 — Metric/section typography

**Decision:** `--type-metric-section-size: 32px` / `--type-section-title-
size: 24px`, both inside the existing R-24 closed type scale
(`[12,14,16,24,32,36,48,64]`).

**Status:** RATIFIED. The audit's own starting proposal (28px) fell outside
the ratified scale; 32px is the only value inside both the audit's
26-32px visual-testing window and the scale — the intersection of the two
constraints, verified against `tools/verify.py`'s R-24 gate (zero new
violations after this choice).

---

## ADR-R1-05 — Motion vocabulary

**Decision:** four semantic verbs (continuity/direction/reveal/state)
added to `src/design-system/motion.ts`. Limited sequential reveal belongs
inside REVEAL; it is not an independent semantic verb or public API.

**Status:** RATIFIED for the vocabulary/API; choreography timing sits
inside the audit's stated ranges (`--motion-continuity: 260ms` inside
200-300ms; DIRECTION reuses `--motion-reorder` at 240ms inside 180-240ms;
REVEAL reuses `--motion-reveal`/`--stagger-row`; STATE is the existing
money channel, unchanged).

**Consequence:** `direction` and `continuityTransition` are the canonical
additions. The earlier standalone `staggerList` proposal was retired by
VO-T4; no product consumer depended on it.

---

## ADR-R1-06 — Asset provenance contract

**Decision:** see `design-system/asset-provenance.md` in full. Extends,
does not replace, the existing `design-system/assets/options/manifest.json`
mechanism with `sourceUrl`/`sourceService`/`author`/`licence`/
`intendedUse`/`retrievedAt`.

**Status:** RATIFIED as a contract for new entries. The 52 existing legacy
entries are explicitly NOT retroactively rewritten by this ticket (would
be fabricated provenance) — a named, tracked follow-up.

---

## ADR-R1-07 — Image art direction

**Decision:** see `design-system/imagery.md` in full — photography vs.
isometrics, fallback design, caption placement (below the frame, not
overlaid — a rule that started as this ticket's own bug fix and became
canonical).

**Status:** RATIFIED.

---

## Governance mechanics (not a design decision, but load-bearing)

VO-T4 reconciled the former temporary `components-r1.css` into the one
canonical `design-system/components.css` source, then removed the temporary
import and verifier exception. `DS-CLASS-EXISTS` and `GOV-TOKEN` now inspect
the single canonical source again.

See also: `docs/audit/design-system-governance.md` (the eight-step process
this ticket's canonical work follows), `design-system-ledger.md` (contract
↔ showcase ↔ product reconciliation — not updated by this ticket for the
same components.css-safety reason; a required follow-up once that file is
reconciled).
