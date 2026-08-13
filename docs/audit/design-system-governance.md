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

### DS-GOV-EX-03 — Opportunity search composition

- **Affected implementation / path:** native search input inside
  `src/screens/OpportunityList.tsx` (DC-34), wrapped by canonical `FormField`.
- **Reason:** filtering behavior belongs to the Opportunity workflow and no
  standalone canonical search-control React API is released.
- **Why canonical is insufficient:** the system supplies the field wrapper and
  visual semantics, not the complete product search composition.
- **Production reachability:** yes, internal preparation mode.
- **Owner:** Sales Platform Opportunities.
- **Risk:** native subcontrol behavior may diverge when a canonical search API
  eventually ships.
- **Follow-up:** evaluate and adopt that API while preserving filtering
  semantics and accessibility.
- **Removal condition:** a released canonical search control satisfies DC-34
  and the product composition has migrated.
- **Review trigger:** addition or material change of a canonical search/input
  API or of Opportunity filtering.

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
