# R1 Design Director input pack

Prepared by: R1 Evidence Closure (task base `967c36869a1572652ee8a900723f85f244f1b605`),
2026-08-26. Consumed by: **Post-R1 Design Director Release Audit** (the next
task). This pack exists so that audit does not have to repeat the technical
measurement work already done here — see `docs/audit/design-system-governance.md`
for how this fits the eight-step Design System change process, and
`design-system/adr-r1.md` (ADR-R1-02, ADR-R1-03) for the full evidence this
pack summarises.

## Provenance

| Field | Value |
|---|---|
| `currentMainRepositoryCommit` | `967c36869a1572652ee8a900723f85f244f1b605` (`origin/master`, verified current at task start) |
| `currentMainRuntimeCommit` | `967c36869a1572652ee8a900723f85f244f1b605` (`.worktrees/r1-validation`, clean checkout, `npm run dev -- --port 5182`) |
| `runtimePurpose` | `CURRENT_MAIN` |
| Provenance verified | **YES** — `src/**` and `*.css` byte-identical between the runtime worktree and the resolved `origin/master` SHA before any measurement was taken |
| Authoritative browser | Playwright CLI (`playwright-cli`), session `r1ev` |
| Measurement method | `getComputedStyle` on live-rendered Gallery specimens/product screens, cross-checked by decoding pixel colour from element screenshots (Python/PIL) for the primary Group A pairing; WCAG 2.x relative-luminance formula applied to every measured RGB pair |

## Released token values (measured, not source-trusted)

| Token | Measured rendered value |
|---|---|
| `--color-text-display-accent-on-stage-deep` | `#FD5E00` |
| `--color-surface-stage-deep` | `#1F1F1F` |
| `--color-surface-default` | `#FFFFFF` |
| `--color-surface-canvas` | `#EDEBE4` |
| `--color-dataviz-category-1` | `#CEC2A9` |
| `--color-dataviz-category-2` | `#C08A6C` |
| `--color-dataviz-category-3` | `#4A4A48` |
| `--color-dataviz-category-4` | `#5E6E62` |
| `--color-dataviz-category-5` | `#5C6B7A` (token-resolved; not exercised by a rendered specimen this pass) |
| `--color-dataviz-category-6` | `#B8A87E` |
| `--color-status-warning` | `#946300` |
| `--color-dataviz-segment-divider` | `#FFFFFF` (confirmed rendered as a 1px `border-right` between adjacent segments) |

All values are byte-identical to their `design-system/tokens.css` declarations
at the verified SHA — no drift between declared and rendered was found.

## Measured evidence summary

Full tables with method/role/status per pairing live in `design-system/adr-r1.md`
under ADR-R1-02 and ADR-R1-03. Summary:

| ADR | Technical evidence | Notes |
|---|---|---|
| ADR-R1-02 (brand orange on stage-deep) | **EVIDENCE VERIFIED** — 5.32∶1 measured, ≥3∶1 large-text bar | Also clears 4.5∶1; no open question |
| ADR-R1-03, dataviz ramp (graphical role) | **EVIDENCE VERIFIED** — all 6 categories PASS under the WCAG 1.4.11 redundant-text exemption (mandatory divider + `aria-label`/legend confirmed rendered) | Category-5 verified by computation only, not live render — flag for re-check if a specimen ever exercises it |
| ADR-R1-03, warning colour | **EVIDENCE VERIFIED** — 5.19∶1 measured on the live glyph; carried to the two other same-token roles | White-on-warning and border-only roles use the identical CSS custom property; not independently re-rendered |
| ADR-R1-03, discovered category-2 text-role use | **EVIDENCE FAILED – DESIGN REVIEW REQUIRED** | See finding below — not part of the original handoff, discovered during this pass |

## Registry maturity

Every R1 registry entry (`r1-composed-stage`, `r1-compositionbar`,
`r1-workflowstepper`, and the rest of the R1 group in
`src/design-system/registry.tsx`) is declared `maturity: 'alpha'`. This
ticket's technical-evidence closure **does not** and **cannot** change that:
`docs/audit/adr-blocking.md` records 51 open blocking ADRs (34 from sections
1–3 + 17 from section 6a) plus 25 unimplemented component records, all
unrelated to R1, and TOKEN-005 caps every component in the system at `alpha`
until those close. Closing ADR-R1-02/03's technical evidence removes two
entries from that count's *dependency set* but does not clear the gate.

| Entry | Current maturity | Technical evidence required | Technical evidence status | Design acceptance required | Resulting maturity | Rationale |
|---|---|---|---|---|---|---|
| ADR-R1-02 (ships in `r1-composed-stage`) | alpha | YES | VERIFIED (this task) | YES (Design Director, next task) | **alpha (unchanged)** | Design acceptance still pending; TOKEN-005 also still open project-wide |
| ADR-R1-03 (ships in `r1-compositionbar`, `r1-workflowstepper`) | alpha | YES | VERIFIED (this task), except the discovered category-2 text-role finding = FAILED | YES (Design Director, next task) | **alpha (unchanged)** | Same as above, plus one open FAILED sub-finding |

No entry is promoted beyond `alpha` by this task.

## Measurement failures

**FAIL — category-2 text-role uses** (not part of the original ADR-R1-03
handoff; discovered while measuring the dataviz ramp, because the ramp's
`CompositionBar` graphical use and this pre-existing text use share the
identical token):

- **Exact pairing:** `--color-dataviz-category-2` (`#C08A6C`) as text-on-white,
  white-glyph-on-fill, and border-only, in `.a3-d.a3-save`, `.a3-q .a3-fx`,
  `.a3-plog .a3-okc`, `.a3-doc .a3-okc`, `.a3-ch.a3-done .a3-n`,
  `.a3-wf-done .a3-n`, `.a3-zone.a3-green`, `.a3-delta.a3-saving`
  (`design-system/components.css`).
- **Consuming screens:** `OfferPanel`, `OpportunityCard`, `S4Vergleich`,
  `OptionChapter`, `Sidebar`, `DocumentAnalysis` (rendered class usage found
  by source search; exact rendered DOM instance not reached in this pass's
  interactive exploration — would need a fixture with an active savings
  delta or a completed chapter/step state).
- **Measured/computed result:** 2.96∶1 (computed from the same
  `getComputedStyle`-measured `#C08A6C` value, confirmed live via the
  `CompositionBar` specimen).
- **Required bar:** 4.5∶1 (text/glyph-as-text roles), 3∶1 (border-only role)
  — fails both.
- **Runtime evidence:** `#C08A6C` measured live at SHA `967c368…`; the ratio
  is a deterministic WCAG computation from that measured value, not an
  estimate.
- **Disposition:** left untouched per this task's contract. Handed to the
  Design Director to decide whether the value, the treatment (e.g. pairing
  category-2 text with a darker/bolder companion, or moving these legacy
  selectors off the dataviz ramp entirely), or the use case changes.

No other measurement failed.

## Gallery specimen references

- `src/design-system/registry.tsx#r1-composed-stage` — "Composed: Commercial
  Stage Moment" (ADR-R1-02 + `CompositionBar` `onDark`).
- `src/design-system/registry.tsx#r1-compositionbar` — "CompositionBar (R1)",
  compact/expanded/partial variants (ADR-R1-03 dataviz ramp).
- `src/design-system/registry.tsx#r1-workflowstepper` — "WorkflowStepper
  (R1)", `attention` state (ADR-R1-03 warning colour).
- Reached via the in-product "Grundlagen" nav item (internal-only, `!client`
  gate), itself reachable only once `canBeginConfiguration` is true (at
  least one building selected and confirmed in an Opportunity Option).

## What the Design Director does NOT need to redo

- Re-measuring any PASS pairing above, including the dataviz-ramp graphical
  role and the warning colour, unless the runtime SHA moves before that
  audit starts (re-verify provenance if so).
- Re-deriving which WCAG criterion applies to which pairing — the role
  classification (text / graphical-redundant / border-only) is recorded
  above and in `adr-r1.md`.
- Rediscovering the category-2 legacy text-role finding — it is fully
  described above with exact selectors and consuming screens.

## What remains open for the Design Director

- Final visual/aesthetic (RATIFIED) acceptance for ADR-R1-02 and ADR-R1-03 —
  explicitly out of this task's scope.
- The category-2 FAIL disposition: change the value, the treatment, or the
  use case.
- Category-5's live-render gap (verified by computation only) — not a
  failure, but worth a real render check if the Director's own session
  reaches a fixture state that exercises it.
