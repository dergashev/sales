# Visual Recovery Audit V2 — Root Cause and Recovery Programme

## Ranked conclusion

### 1. Primary cause — task slicing did not preserve visible composition

The earlier programme was split around capabilities, policy and very broad delivery contracts rather than around a small number of end-to-end, runtime-visible compositions. The current source contains useful new components and a partial `PresentationShell`, but the decisive product compositions remain dominated by the pre-redesign working shell: white panels, rails, tables and fallback media. A change could therefore be technically complete without moving the visual outcome enough to pass a five-second comparison.

**Prevent recurrence:** every VR2 ticket owns one observable surface, carries its exact target image, and requires BEFORE / TARGET / CANDIDATE evidence from the released `CURRENT_MAIN` route before acceptance.

### 2. Secondary cause — canonical capabilities were not adopted where the target needed them

`MediaFrame`, `WorkflowStepper`, `CompositionBar`, surfaces and motion primitives are now present in source and several have runtime consumers. That is not the same as target realisation. Media consistently resolves to generic fallback drawings in audited product paths; Work composition remains a long single article with permanent rails; Present does not use the intended full-bleed narrative arrangement; and Offer/Send remain in operational preparation chrome.

**Prevent recurrence:** tickets name the required runtime consumer and route, not merely the component. A foundation/enabler may not close until those named consumers are visible in the browser.

### 3. Process cause — Foundations was allowed to stand in for Product progress

The Foundations route is visually more developed than much of the actual Product, while carrying internal / Russian diagnostic content. It proves possible visual language, but it is neither a client nor a professional working route. Earlier reporting appears to have given system/registry evidence disproportionate weight.

**Prevent recurrence:** Foundations is explicitly excluded from Product-adoption claims. VR2-00 makes runtime product screens, not specimens, the acceptance source of truth.

### 4. Acceptance cause — gates privileged implementation and candidate evidence over target fidelity

Current comparison shows materially different visual outcomes despite prior DONE/PASS reports. The strongest counterexample is the delivered portfolio route: it explicitly tells the user the opportunity is not implemented, while the historical target requires a completed Delivery state. A gate that tested code, component presence, or a selected fixture could pass without testing the released lifecycle.

**Prevent recurrence:** the programme has four mandatory visual checkpoints and stop conditions. The Pre-Release Scope & Target Acceptance Auditor must compare exact 1440 and 1280 browser captures against target before a ticket is released.

### 5. Technical / consumption cause — fixture and lifecycle coverage were incomplete

The completed Northfeld fixture can enter Present and preparation/export after configuration. The visible delivered card routes to an unsupported-prototype notice instead of a Delivery experience. This shows that candidate screenshots and happy-path work states did not demonstrate the real portfolio/lifecycle path.

**Prevent recurrence:** VR2-08 owns the portfolio-to-delivered route and its stable fixtures. Every client-facing ticket must prove entry from an ordinary project card, not only deep-linked or hidden prototype states.

## Programme

| Priority | Ticket | Classification | Dependencies | Blocks |
| --- | --- | --- | --- | --- |
| P2 | VR2-00 Runtime target-fidelity gate and Foundations separation | Design system enabler | — | release acceptance for all VR2 tickets |
| P1 | VR2-01 Opportunities identity and portfolio composition | Quick visible win | — | VR2-06 identity reuse |
| P1 | VR2-02 Project identity and decision-first workspace | Core product recomposition | VR2-01 media/identity contract | VR2-03, VR2-06 |
| P1 | VR2-03 Building & Scope dense workspace | Workflow / density | VR2-02 | VR2-04 |
| P1 | VR2-04 Configurator Work shell and chapter density | Core product recomposition | VR2-03 | VR2-06, VR2-09 |
| P2 | VR2-05 Comparison recommendation stage and continuity | Motion / continuity | — | VR2-06 |
| P1 | VR2-06 Presentation narrative | Client experience | VR2-01, VR2-02, VR2-04, VR2-05 | VR2-07 |
| P1 | VR2-07 Offer commercial climax and artefact gallery | Client experience | VR2-06 | VR2-08 |
| P0 | VR2-08 Send, Delivered and real lifecycle fixtures | Client experience | VR2-07 | VR2-09 |
| P3 | VR2-09 Cross-product responsive and motion cohesion | Final cohesion | VR2-01…VR2-08 | final release |

### Dependency DAG

```text
VR2-00 ──────────────────────────────────────────> acceptance for every release

VR2-01 ─> VR2-02 ─> VR2-03 ─> VR2-04 ─┐
   │             └───────────────────────┤
   └──────────────────────────────────────┤
VR2-05 ───────────────────────────────────┤
                                                v
                                              VR2-06 → VR2-07 → VR2-08 → VR2-09
```

VR2-00, VR2-01 and VR2-05 may start in parallel. VR2-02 may begin once VR2-01 establishes the shared identity/media contract; it should not wait for all enabler work. VR2-03→04 and VR2-06→07→08 are sequential because each owns the next real user journey. VR2-09 is final cohesion only; it must not be used to hide missing composition work.

## Required checkpoints

### Checkpoint A — first visible transformation

After VR2-01 and VR2-05, compare released Opportunities and Comparison at 1440 and 1280 with their targets. Stop if portfolio identity/media or decision-first comparison is not immediately apparent.

### Checkpoint B — Work-mode core

After VR2-02, VR2-03 and VR2-04, inspect a complete Northfeld work journey: workspace → scope → KG300/KG700 → comparison. Stop if the primary work pane remains a sparse one-column document with permanent competing rails.

### Checkpoint C — Client journey

After VR2-06, VR2-07 and VR2-08, inspect ordinary portfolio entry → Present → Offer → Send → Delivered. Stop if operational controls leak into client screens or Delivered is not a real stable state.

### Checkpoint D — final cohesion

After VR2-09, inspect all major surfaces in DE and EN, 1440/1280, long/incomplete states and reduced motion. Stop if typography, surfaces, media or motion are inconsistent enough to weaken product recognition.

## Stop conditions

Pause for Design Director review if a released major task does not visibly move the Product towards target; if an acceptance pass is materially unlike target; if a target is impossible or wrong against product truth; if two major tickets finish without obvious visible progress; or if `CURRENT_MAIN` provenance cannot be verified.

## Programme summary

- **Total new implementation tasks:** 10
- **P0 / P1 / P2 / P3:** 1 / 6 / 2 / 1
- **First task to run:** VR2-01 — Opportunities identity and portfolio composition.
- **Why:** it is the highest-frequency entry surface and creates an obvious, independently testable recovery signal without waiting for foundation work.
- **First visual checkpoint:** Checkpoint A, after VR2-01 and VR2-05.
- **Targets kept / refined / superseded:** 17 / 0 / 0. No target was changed merely because delivery missed it.
- **Foundation tasks:** 1 (VR2-00, acceptance and separation only).
- **Direct product-transformation tasks:** 8 (VR2-01 through VR2-08).
- **Final cohesion tasks:** 1 (VR2-09).
