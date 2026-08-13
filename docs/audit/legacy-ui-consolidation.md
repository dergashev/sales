# Post-migration UI consolidation inventory

Task base commit: `3c745b6f551b523aeef07ca110743343cb4161d8`

This inventory records the released post-migration state used by the legacy UI
cleanup. It classifies implementation responsibility rather than judging a
component by its name or size. The approved released product rendering and
behavior are the parity baseline.

## Audit coverage

The audit followed definitions and consumers across:

- React component definitions, direct imports, exported symbols, wrappers and
  aliases;
- the application entry graph and test-only graph;
- the specimen registry, Gallery, QA Foundation screen and diagnostics;
- design-system CSS selectors, token imports, local CSS and inline geometry;
- Vite, Vitest and TypeScript aliases;
- the private package API and repository HTML artifacts.

The package is private and has no `main` or `exports` surface. There are no UI
barrel modules or re-export chains. Every production UI module is reachable
from `src/main.tsx`. The only non-test source module outside that graph is
`src/state/data-states.ts`; it is consumed by the state-declaration test and is
classified as validation infrastructure, not rendered UI.

## CANONICAL DESIGN-SYSTEM IMPLEMENTATION

| Responsibility | Source |
|---|---|
| Reusable visual values | `design-system/tokens.css` |
| Reusable component styling | `design-system/components.css` |
| Button, NumericField, ProvenanceChip and Skeleton React sources | `src/components/primitives.tsx` |
| EstimateUncertaintyBadge, including the released compact and range presentations | `src/components/EstimateUncertaintyBadge.tsx` |
| SegmentedControl, RadioCardGroup, FacadeTileGroup and Switch | `src/components/controls.tsx` |
| SectionSheet, PageHeader, links, form fields, Card, Badge, readiness, next-step and disclosure APIs | `src/components/designSystem.tsx` |
| Dialog behavior and lifecycle | `src/components/Dialog.tsx` |
| DataStateBlock and DataStateBoundary | `src/components/DataStates.tsx` |
| Semantic JS motion and reduced-motion ownership | `src/design-system/motion.ts` |
| Single React specimen declaration | `src/design-system/registry.tsx` |

These sources are canonical even though the React implementation currently
lives below `src/components`. Physical location alone is not evidence of a
product-local duplicate.

## LEGITIMATE PRODUCT-SPECIFIC COMPOSITION

The following areas compose canonical primitives with Sales Platform state,
workflow and business behavior. They are not candidates for migration into a
generic component library:

- all files in `src/screens/`;
- `App`, `Sidebar` and `OfferPanel` shell/workflow composition;
- client-output gating, print, guidance, document-analysis and prerequisite
  flows;
- opportunity notes, discount behavior, schedule presentation, undo behavior,
  provenance explanation and client notices;
- calculation, state, i18n and fixture modules.

Direct native controls inside these compositions remain where they carry
domain-specific behavior or where no complete canonical React primitive exists.
They do not expose a competing reusable package API.

## DUPLICATE / LEGACY IMPLEMENTATION REMOVED

- The separate `UncertaintyBadge` and `UncertaintyBand` implementations were
  consolidated into one typed `EstimateUncertaintyBadge` source. Its two
  presentations preserve the exact released DOM and classes at each consumer.
- The local `useReducedMotion` hook and direct Framer reduced-motion access were
  removed. JS consumers now read reduced-motion state through
  `useSemanticMotion`.
- The local delta-chip and delivery timer copies were replaced by the existing
  `ui-policy` constants.
- The duplicate `DataStateKey` union was removed; the QA declaration matrix now
  consumes the canonical `DataStateKind` type.
- The unused `HIT` Tailwind helper, `.circle` CSS helper, `ALL_SPECIMENS` alias
  and unused `@ds` resolver alias were removed.
- Opportunity search and filter controls now consume the canonical `FormField`
  and `SelectField` wrappers instead of repeating their label/control markup.
- The hand-maintained `Grundlagen` footer was removed. It duplicated capability
  status outside the registry and had already become false by listing `Dialog`
  as unbuilt after the canonical shared implementation shipped. Its retired
  translation key was removed from the generator source and generated maps.

No snapshot, test, verifier or protection was removed or weakened.

## QA FOUNDATION FINAL ROLE

QA Foundation consists of:

- `src/screens/Grundlagen.tsx`: internal diagnostics/specimen host;
- `src/components/Diagnostics.tsx`: runtime foundation checks;
- `src/design-system/Gallery.tsx`: registry renderer and test-harness chrome;
- `src/design-system/registry.tsx`: canonical component specimen consumers;
- `src/state/data-states.ts` and its test: validation declarations.

The QA screen defines no reusable rendered primitive. Gallery iterates the
single registry and specimens import the same React component sources used by
the product. The screen is production-reachable to internal users through the
explicit QA navigation item, but is omitted from the client-projection DOM.
Its diagnostics and framing are QA-only composition, not a public UI library.

## APPROVED EXCEPTION

`design-system/all3-design-system.html` remains a manual, repository-only
showcase during the D-28 transition. It is not imported by the application and
is not emitted by the configured production entry. A reproducible lexical
inventory finds nine top-level showcase chapters, 18 nested specimen blocks,
and more than 80 `.a3-*` class tokens referenced by the manual HTML but not by
TypeScript/TSX. This is materially broader than the current React registry.

Deleting that artifact or its HTML-only CSS now would remove unresolved visual
authority and examples. It therefore remains intact, non-production-reachable,
owned by the Design System area, with this follow-up: migrate each remaining
section to the canonical React registry, preserve parity evidence, then remove
the corresponding manual markup and HTML-only CSS atomically. That work must
not invent missing canonical capability.

The legacy `.a3-seg`, `.a3-toggle` and compact showcase-only APIs remain solely
because the manual showcase still consumes them. They are not available through
any React or package export and must disappear with their owning manual
sections.

## APPROVED EXCEPTION — COMPACT UNCERTAINTY PRESENTATION

The compact `EstimateUncertaintyBadge` presentation remains in S2, S5 and the
registry because replacing it with the richer range presentation would change
the released layout. The DC-3 contract describes additional scenario, method
and zone information that those consumers do not currently supply. Completing
that capability is separate Design System work, not safe legacy deletion. The
approved parity constraint therefore keeps the compact variant in the same
single canonical source; expanding its information model requires later review.

## UNKNOWN — REQUIRES REVIEW

None after the definition-and-usage inventory.

## Tokens and geometry

`src/styles/index.css` now contains only canonical design-system imports and
Tailwind layer declarations. No product-local reusable visual token is defined.
No canonical token replacement was needed.

Product-specific computed geometry remains intentionally local, including
schedule percentages, uncertainty range placement and popover viewport
coordinates. These values represent data or content-dependent layout and are
not reusable visual semantics.

## Remaining access paths

- No deprecated UI import, UI barrel, product-local primitive alias or QA
  primitive export remains in the TypeScript/Vite public surface.
- The manual showcase exception retains its own HTML/CSS access paths as listed
  above.
- Documentation aliases DC-18 and DC-36 remain contract metadata rather than
  import aliases and are outside runtime cleanup.

## Expected outcome

- Sales/client visual changes: none.
- Internal QA documentation change: the stale duplicate capability footer is
  removed and the DC-3 specimen uses its canonical contract name; component
  specimens and diagnostics otherwise retain their layout.
- Behavioral changes: none.
- Calculation or business-semantic changes: none.
