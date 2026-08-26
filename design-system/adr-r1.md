# ADR package — REDESIGN R1 (efcbdaf3)

Consolidates the architecture decisions this ticket makes, each already
referenced inline at its point of use in `tokens.css`/`tools/verify.py`/the
new components. This is the single place to read them together, per the
ticket's §"GOVERNANCE & CONTRACTS" requirement and the repository's ADR
convention (`docs/audit/adr-blocking.md`).

Status legend: **RATIFIED** (implemented, contrast/behaviour evidence
attached or explicitly flagged as still required) · **PENDING EVIDENCE**
(implemented, a specific measurement is still owed before the ADR can
close per TOKEN-005's beta/stable gate).

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

**Status:** PENDING EVIDENCE. Estimated contrast (#FD5E00 on #1F1F1F)
≈5.3:1, comfortably above the ≥3:1 large-text bar — but this ADR requires a
**measured**, not estimated, reading before it closes (`tools/verify.py`'s
R-01 whitelist already includes `--color-text-display-accent-on-stage-
deep`, so the mechanism is live; the number itself needs verification with
real rendering tools, not calculation).

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

**Status:** PENDING EVIDENCE. Values are chosen inside the stated design
constraints (architectural family for dataviz, "distinct from brand
orange" for warning) but a full contrast-evidence table for every new
pairing (each dataviz colour against white/plaster, warning against white)
is a required follow-up before `beta`/`stable` per TOKEN-005 — not yet
produced in this pass.

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
added to `src/design-system/motion.ts`, plus the previously-documented-but-
unimplemented `staggerList` variant (`design-system/README.md` §5 has
named `fadeRise`/`fadeOnly`/`staggerList` as the only three canonical
variants for years; only the first two existed in code before this
ticket).

**Status:** RATIFIED for the vocabulary/API; choreography timing sits
inside the audit's stated ranges (`--motion-continuity: 260ms` inside
200-300ms; DIRECTION reuses `--motion-reorder` at 240ms inside 180-240ms;
REVEAL reuses `--motion-reveal`/`--stagger-row`; STATE is the existing
money channel, unchanged).

**Consequence:** `useSemanticMotion()`'s existing return shape is
untouched (backward compatible) — `direction`, `continuityTransition`,
`staggerList` are additive fields.

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

`design-system/components-r1.css` is a **temporary second source** for the
few custom `a3-*` classes R1's new components need, forced by
`design-system/components.css` already carrying a large, unrelated
uncommitted changeset (47 files, -2567 net lines) at the time this ticket
ran — adding to that file would have folded someone else's unreviewed work
into this candidate. `tools/verify.py`'s `DS-CLASS-EXISTS` and `GOV-TOKEN`
checks were extended (not relaxed) to also read this second file. **Merge
`components-r1.css` into `components.css` and delete it** the next time
`components.css` is safely reconciled — tracked in the R1 implementation
notes, not silently left as a permanent split.

See also: `docs/audit/design-system-governance.md` (the eight-step process
this ticket's canonical work follows), `design-system-ledger.md` (contract
↔ showcase ↔ product reconciliation — not updated by this ticket for the
same components.css-safety reason; a required follow-up once that file is
reconciled).
