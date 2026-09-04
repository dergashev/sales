# All3 Design System governance

This document is the operating contract for changing reusable UI in Sales
Platform 2.0. It governs the released post-cleanup architecture; it does not
authorize a new migration, visual redesign, or product behavior change.

The required dependency direction is:

```text
Sales Platform → All3 Design System
QA Foundation  → All3 Design System
```

The explicit module manifests in `tools/verify.py` are the mechanical source
of truth for the current boundary. Canonical React sources must not depend on
Sales Platform business code, state, screens, fixtures, configuration, or QA
Foundation. QA Foundation may diagnose and render canonical components; it is
not a production component library. Sales Platform may compose canonical
components into product-specific workflows.

## Automated enforcement

`npm run verify` runs four failing governance classes and their bidirectional
synthetic regression harness:

- `GOV-DS-DEP` freezes the dependencies available to every named canonical
  React module. `../i18n` and the exact `../engine/money` module are shared
  infrastructure and remain intentional dependencies; this does not permit
  other `engine` modules.
- `GOV-QA-BOUNDARY` prevents product modules from importing QA Foundation.
  The sole route-host edge is `App → Grundlagen`; internal QA edges remain in
  the named QA manifest. Canonical and QA barrel re-exports are rejected so a
  second entry point cannot emerge silently.
- `GOV-RETIRED-PATH` rejects the known removed aliases, symbols, helpers and
  capability key across authored source, Design System CSS and build/config
  files. Every failure names the supported replacement.
- `GOV-TOKEN` rejects literal colors and gradients in component/application
  CSS, literal colors in production TypeScript/TSX, and Tailwind arbitrary
  values containing bare hex, px or rem values. Token-based and structural
  arbitrary values remain valid.

`tools/selftest_governance.py` proves both sides on synthetic repositories: a
planted prohibited case must fail and its corresponding allowed case must stay
silent. Adding or changing a governance branch requires updating this harness
in the same change.

## Reusable UI change workflow

When Sales Platform needs reusable UI that appears absent from the canonical
system, complete these steps in order:

1. Inspect canonical React sources, contracts, specimens and tokens to verify
   that the capability is genuinely absent.
2. Record the product requirement, including states, accessibility needs and
   production context.
3. Propose the reusable capability to the canonical All3 Design System.
4. Review UX, visual design, accessibility, API shape and reuse potential with
   the appropriate owners.
5. Implement one canonical source rather than a product-private substitute.
6. Add or update the canonical specimen and meaningful automated tests.
7. Validate the canonical implementation through repository gates and the
   actual browser workflow.
8. Consume that canonical source from the Sales Platform composition.

An exception record is required before deviating from this sequence. Existing
legacy state, schedule pressure, or a nearby implementation is not sufficient
justification by itself.

## Exception record template

Every exception must record all of the following:

- affected component, token, import or implementation;
- exact repository path;
- reason for the deviation;
- why the canonical alternative is insufficient or absent;
- production reachability;
- owning area;
- risk;
- follow-up action;
- removal condition;
- expiry, milestone or review trigger.

The owner must review the record whenever its trigger occurs. Removing or
broadening an exception is an architectural change and must update this
register and the mechanical checks atomically.

## Current exception register

### DS-GOV-EX-01 — transitional manual showcase

- **Affected implementation / path:**
  `design-system/all3-design-system.html` and its HTML-only presentation.
- **Reason:** the static showcase still contains material visual authority and
  specimens that have not all moved atomically to the React registry.
- **Why canonical is insufficient:** the React registry does not yet represent
  every surviving showcase section with proven parity.
- **Production reachability:** none; repository-only Design System reference.
- **Owner:** All3 Design System.
- **Risk:** handwritten HTML can drift from the canonical React source and
  create apparent dual ownership.
- **Follow-up:** migrate one complete section at a time to the registry with
  parity evidence; remove only the corresponding HTML-only implementation.
- **Removal condition:** every surviving authoritative section is rendered
  from the canonical React registry and the static duplicate has no remaining
  authority.
- **Review trigger:** any change to the showcase, specimen registry, or a
  canonical component represented in both.

### DS-GOV-EX-02 — compact uncertainty presentation

- **Affected component / paths:**
  `src/components/EstimateUncertaintyBadge.tsx`, compact consumers in
  `src/screens/S2Vorbereitung.tsx`, `src/screens/S5Export.tsx`, and the QA
  specimen in `src/design-system/registry.tsx`.
- **Reason:** the released compact surface preserves the short ± interval;
  the range surface additionally renders monetary edges.
- **Why canonical is insufficient:** DC-3's future complete information model
  has not been approved and released for every compact placement. Both current
  presentations nevertheless come from the same canonical React source.
- **Production reachability:** yes in S2 and S5; the registry consumer is
  internal QA only.
- **Owner:** All3 Design System for the component; Sales Platform for placement.
- **Risk:** compact surfaces expose less interval detail than the range view.
- **Follow-up:** complete the DC-3 information model under Design System
  authority and assess compact layout parity before migrating consumers.
- **Removal condition:** an approved canonical DC-3 presentation replaces the
  compact contract without losing required product layout or information.
- **Review trigger:** approval or release of a new DC-3 information model.

### DS-GOV-EX-03 — Projects portfolio search composition

**Narrowed 2026-09-04 (Projects portfolio rebuild).** The half of this
exception that covered a *searchable list control* is CLOSED: the canonical
`Combobox` (`components-core.md` § Combobox, capability `combobox`,
registry specimen `combobox`) is released, and the register's Country, City
and Manager filters all consume it — three product fields, one canonical
implementation, no local listbox anywhere. What remains under exception is
narrower and of a different kind, recorded below.

- **Affected implementation / path:** the product-local FILTER COMPOSITION in
  `src/screens/OpportunityList.tsx` — the plain-text search field (native
  `input[type=search]` inside canonical `FormField`), the lifecycle-status
  `fieldset` of native checkboxes, and the removable active-filter chips.
- **Reason:** these are a business composition, not reusable primitives. What
  is filtered, in which groups, with which AND/OR semantics and which chips,
  belongs to the portfolio workflow; the Design System owns the field
  wrapper, the tokens and the searchable-select control the composition uses.
- **Why canonical is insufficient:** the system supplies `FormField`,
  `Combobox`, `Button` and the token set — not a generic "filter bar" whose
  groups and semantics would have to be re-specified per product surface.
- **Production reachability:** yes, internal preparation mode.
- **Owner:** Sales Platform Projects.
- **Risk:** a second product surface needing the same status-checkbox group
  would be tempted to copy it rather than promote it.
- **Follow-up:** promote the status-checkbox group to a canonical capability
  IF and WHEN a second surface needs it — not before, so the contract is
  written against two real consumers rather than one imagined one.
- **Removal condition:** a released canonical filter-group control satisfies
  the register's semantics and the composition has migrated.
- **Review trigger:** a second product surface needing a multi-select filter
  group, or a material change to portfolio filtering.

### DS-GOV-EX-04 — DiscountControl native slider

- **Affected implementation / path:** coupled native range and numeric inputs
  in `src/components/DiscountControl.tsx` (DC-25).
- **Reason:** the commercial coupling is product-specific; no standalone
  canonical Slider React source is released.
- **Why canonical is insufficient:** extracting a Slider would create a new
  Design System API and requires separate ownership/review.
- **Production reachability:** yes, internal preparation mode.
- **Owner:** Sales Platform commercial configuration.
- **Risk:** the native range subcontrol can drift from future canonical
  interaction and accessibility behavior.
- **Follow-up:** adopt a released Slider without changing discount semantics.
- **Removal condition:** a reviewed canonical Slider exists and the coupled
  composition passes calculation, interaction and browser regression gates.
- **Review trigger:** release of a canonical Slider or any DiscountControl UI
  redesign.
- **RESOLUTION REDIRECTED (REDESIGN R1, efcbdaf3):** the audit
  (DESIGN-15) and R1's UI Design handoff concluded a discrete **`Stepper`**
  — not a Slider — is the correct canonical replacement for Rabatt: a
  discount is a whole-percentage-point value, and Stepper gives it an
  accessible name/value pair plus a live-impact slot a slider's thumb
  cannot express. Canonical `Stepper` is released
  (`src/components/controls.tsx`); no canonical Slider was built (no other
  consumer justifies one — do not build ahead of a real need). **This
  exception's removal condition is now: `DiscountControl.tsx` migrates to
  the canonical `Stepper`, not a future Slider.** Migration itself is
  R2/R3/R4 scope (product-wide adoption is explicitly outside R1) — the
  exception stays open until that migration lands.

### DS-GOV-EX-05 — InternalNote native textarea

- **Affected implementation / path:** native textarea in
  `src/components/InternalNote.tsx` (DC-43).
- **Reason:** autosave, state and note semantics are product-owned; no
  standalone canonical Textarea React source is released.
- **Why canonical is insufficient:** canonical CSS semantics exist, but there
  is no reusable React control contract to consume.
- **Production reachability:** yes, internal mode only.
- **Owner:** Sales Platform notes workflow.
- **Risk:** the native subcontrol can diverge from a future canonical Textarea.
- **Follow-up:** adopt the canonical source after release while preserving
  NOTE-001…007.
- **Removal condition:** a canonical Textarea satisfies the note contract and
  the workflow has migrated with autosave/state evidence.
- **Review trigger:** release of a canonical Textarea or change to NOTE-001…007.

### DS-GOV-EX-06 — S5 delivery native controls

- **Affected implementation / path:** attachment checkboxes, read-only subject
  input and email textarea in `src/screens/S5Export.tsx` (DC-41/DC-23).
- **Reason:** these controls are embedded in the product-owned offer delivery
  and preflight workflow.
- **Why canonical is insufficient:** canonical CheckboxCard and Textarea React
  sources are not released for these subcontrols.
- **Production reachability:** yes.
- **Owner:** Sales Platform output/delivery.
- **Risk:** native subcontrols can diverge from future canonical interaction,
  validation and accessibility behavior.
- **Follow-up:** migrate subcontrols after canonical sources ship, preserving
  EMAIL/OUTPUT semantics and attachment state.
- **Removal condition:** released canonical controls cover the required states
  and the delivery workflow passes output, keyboard and browser regression.
- **Review trigger:** release of canonical CheckboxCard/Textarea sources or a
  material change to S5 delivery/preflight.

### DS-GOV-EX-07 — Opportunity readiness overview (second DC-13 instance)

**RESOLVED — VO-T4.** This historical exception is closed: `Sidebar.tsx`
and `OpportunityCard.tsx` now both consume
`src/design-system/WorkflowStepper.tsx`; the inline chapter anatomy and the
legacy `designSystem.tsx` owner were removed. The record below is retained as
audit history only. `design-system/capability-governance.json` plus
`GOV-CAPABILITY` now reject a duplicate owner or registry-only adoption.

- **Affected component / paths:** `ReadinessOverview` in
  `src/screens/OpportunityCard.tsx`; it reuses the canonical DC-13 CSS anatomy
  (`.a3-chapters` / `.a3-ch` / `.a3-n` / `.a3-done` / `.a3-cur`,
  `design-system/components.css`). The reference instance of the same anatomy is
  the inline chapter list in `src/components/Sidebar.tsx`.
- **Reason:** the Project Card needs the DC-13 stepper anatomy for the four
  readiness stages of an Opportunity. DC-13 has no canonical React source at
  all, so consuming one was not possible; only the CSS contract could be reused.
- **Why canonical is insufficient / absent:** no `WorkflowStepper` React module
  exists (`docs/audit/design-system-ledger.md`, DC-13 row: the prototype
  implementation is inline markup in `Sidebar.tsx`). Extracting the canonical
  source now would rewrite the freshly released Configurator sidebar, which is
  outside this ticket's boundary. The nearby `Sidebar.tsx` implementation is
  explicitly **not** the justification for this exception — the absence of a
  canonical source and the deliberate deferral of its extraction are.
- **Production reachability:** yes — internal preparation, Opportunity Card of
  every worked Opportunity, in both `mode-intern` and `mode-praesentation`.
- **Owner:** All3 Design System for the future canonical `WorkflowStepper`;
  Sales Platform Opportunities for the current product composition.
- **Risk:** two hand-written implementations of one anatomy can diverge. Two
  known gaps already differ from the DC-13 contract and are carried by this
  record rather than fixed in one copy only: roving tabindex / arrow keys
  (`KEY-003`, missing in **both** instances) and `LAYOUT-012` main-panel
  adjacency (this overview navigates within one page instead of owning a main
  panel). Fixing keyboard behaviour in one copy would deepen the divergence, so
  it belongs to the extraction.
- **Follow-up:** extract a canonical `WorkflowStepper` React source covering
  `STEP-001…007` and `KEY-003`, add its specimen, and migrate **both**
  consumers (`Sidebar.tsx` and `ReadinessOverview`) to it.
- **Removal condition:** the canonical `WorkflowStepper` is released and both
  consumers render it; no hand-written copy of the anatomy remains.
- **Review trigger:** release of a canonical `WorkflowStepper`, any change to
  DC-13 / `STEP-001…007`, or any further consumer of the `.a3-chapters` anatomy.
- **SUPERSEDED (REDESIGN R1, efcbdaf3):** the canonical
  `WorkflowStepper` this exception was waiting on is now released
  (`src/design-system/WorkflowStepper.tsx` — glyph + label + position
  anatomy, `upcoming/current/done/attention/blocked/skipped` states plus
  the composite done+current pairing, `aria-current="step"` closing the
  `"true"` drift, registry specimens for both `workflow` and `chapter`
  sizes). VO-T4 subsequently migrated both legitimate consumers and closed
  this exception. Roving-tabindex `KEY-003` is implemented in the canonical
  source's interactive steps (real `<button>`s, 44px hit targets).

**Data states of this instance (CLAUDE.md rule 30, seven declarations).** The
DC-13 contract enumerates all seven; this instance declares each one either as
reached or as not reachable, with the reason:

- `loading` — **not reachable.** Stage composition and stage states are derived
  synchronously from data already in the store and the fixture (`wflConflict`,
  `projectParamsConfirmed`, `options`, `demo.documents`). There is no async read
  behind the overview that could be pending.
- `empty` — **not reachable** (`notApplicableReason`, same as DC-13): the set of
  stages is defined statically by the workflow — four stages, always — so an
  Opportunity without stages does not exist.
- `partial` — **not reachable.** No stage state is computed asynchronously or
  estimated, so no stage can be marked `wird geprüft`; every stage resolves in
  the same render as the card.
- `ready` — **the only reachable state.** Each of the four stages carries a
  determined state with its own text (`STEP-002`), and exactly one stage is
  `aria-current="step"` while any stage remains open.
- `error` — **not reachable.** The overview reads validated store fields, not a
  fallible source. The failure that does exist upstream — an unworked
  Opportunity or an unknown id — is handled before the overview renders: that
  branch returns the "not elaborated in the prototype" card and never mounts
  `ReadinessOverview`.
- `stale` — **deliberately not implemented.** `STALE-001` is unimplemented
  across this product; inventing a stale marker in one screen would create a
  freshness claim the product cannot back. Not implemented here either.
- `permission` — **not reachable.** The prototype models no per-step rights: all
  four stages are internal preparation, and the profile distinction acts at
  screen level, not at stage level. No stage is ever hidden or closed by rights,
  so R-16's "show with a reason, do not delete" has no trigger here.

## Known enforcement limits

- `GOV-TOKEN` deliberately does not extend the existing generic
  `CSS-SHADOW`, `CSS-RADIUS` or `CSS-SPACING` line rules to
  `design-system/components.css`. The current file contains two legitimate
  token-based hairline dividers expressed with `box-shadow`; the generic rule
  cannot distinguish them from decoration reliably. New decorative shadows,
  radii and spacing still require review.
- `src/lib/font-check.ts` contains two exact browser-normalized color strings
  used only to diagnose the computed body background. `GOV-TOKEN` permits
  those exact sentinels at their declaration; they are not styling values.
- Named manifests and retired-path registries protect known ownership edges.
  They do not prove that every future semantic duplicate can be recognized by
  naming alone. Review remains necessary for a novel reusable implementation.
- The manual showcase remains the explicit D-28 transition exception above;
  governance does not authorize adding another static or QA-owned showcase.
