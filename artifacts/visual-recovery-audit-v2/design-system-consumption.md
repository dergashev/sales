# Design System Consumption & Dead Design Audit

Product consumption means a runtime-reachable product route, not `registry.tsx`, Foundations, tests or documentation.

| Capability | Canonical implementation | Real Product consumer(s) on audited runtime | Visible result | Classification |
|---|---|---|---|---|
| Canvas | semantic token/CSS | Opportunities and general page background | white/near-white ground, but not a deliberate portfolio canvas | CANONICAL BUT MISUSED |
| Paper | `.a3-paper` | Presentation send/snapshot subsections | used narrowly; Work primary planes still rely on legacy white panels | CANONICAL BUT UNDER-ADOPTED |
| Stage | `.a3-stage` | Opportunity card / Export moments | selection emphasis exists but lacks target-recognisable decision stage | CANONICAL BUT UNDER-ADOPTED |
| Stage-deep | `.a3-stage-deep` | Presentation offer section | dark commercial field exists in source/reachable flow but Export remains dominant internal offer surface | CANONICAL BUT UNDER-ADOPTED |
| MediaFrame | `src/design-system/MediaFrame.tsx` | OpportunityList, OpportunityCard, BuildingScope, PresentationShell | only fallback line-art was seen across audit capture | CANONICAL BUT MISUSED |
| WorkflowStepper | `src/design-system/WorkflowStepper.tsx` | OpportunityCard, Sidebar | live, accessible progress navigation; not composed to target shell | CANONICAL AND EFFECTIVE (component), UNDER-ADOPTED (composition) |
| DateField | `controls.tsx` | S3 Configurator/Termine | real runtime consumer; not audited as a target-grade field composition | CANONICAL AND EFFECTIVE |
| Stepper | `controls.tsx` | none found outside registry/specimen | internal discount still uses range + numeric input | DOWNSTREAM-OWNED BUT NEVER ADOPTED |
| CompositionBar | `CompositionBar.tsx` | OpportunityCard, Comparison, PresentationShell | labelled commercial composition supports decision scanning | CANONICAL AND EFFECTIVE |
| Metric hierarchy | tokens/DS styles | OfferPanel, Comparison, Present | total reads strongly; too many supporting metrics compete in permanent rail | CANONICAL BUT MISUSED |
| CONTINUITY | `motion.ts` | OpportunityList entry helper | no observable target-grade continuity in audit journey | CANONICAL BUT UNDER-ADOPTED |
| DIRECTION | `motion.ts` | Configurator animation wrapper | chapter changes appeared immediate; no visible directional edge evidence | CANONICAL BUT UNDER-ADOPTED |
| REVEAL / STATE | `motion.ts` | dialogs, chips, checklists, popovers | local feedback exists; no commercial/recalculation/offer sequence seen | CANONICAL BUT UNDER-ADOPTED |
| `staggerList` | semantic motion API | no verified product sequence | only Foundations/implementation traces, no visible product outcome | SHOULD BE RETIRED / merged into REVEAL |
| Legacy/duplicate surface composition | legacy Tailwind panels plus component CSS | dominant Work routes | card/rail/border composition still controls product | DUPLICATED |
| Foundations registry | `registry.tsx` | Foundations route only | visually richer specimen than Product; includes alpha/diagnostic material | GOVERNANCE/REFERENCE ONLY, NOT ADOPTION |

## Dead-design record

1. Approved target **media-led recognition** has not been delivered as data or runtime content. The canonical fallback became the dominant product illustration.
2. Approved **Work/Compare/Present surface model** exists as tokens/specimens, but Work remains the legacy composition.
3. Approved **semantic motion** exists as implementation capability, but runtime evidence showed skeleton/button mechanics rather than target movement edges.
4. The Foundations route contains reference/alpha content and Russian diagnostics. It must not be presented as evidence that the Product has adopted the system.
5. A delivered lifecycle exists in opportunity status language without a routable delivered Product surface.

## Lifecycle decision

Do not create a new foundation-first migration wave. Preserve the effective capabilities above and require each direct Product task to identify its actual consumer and screenshot it. Retire `staggerList` as an independently owned capability; use limited REVEAL sequencing only where a target demands it.
