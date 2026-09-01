# Visual Recovery Audit V2 — Findings Report

## Audited CURRENT_MAIN

| Field | Result |
|---|---|
| Repository release branch | `origin/HEAD → origin/master` |
| Repository commit | `6fcb567628f26f02cac0e74674378a79e6ac13b8` |
| Runtime commit | `6fcb567628f26f02cac0e74674378a79e6ac13b8` |
| Runtime purpose | `CURRENT_MAIN` |
| Provenance | **PASS** — managed runtime identity endpoint and browser-consumer preflight matched exactly |
| Browser method | fresh Playwright CLI sessions, 1440×900 and 1280×800 |

Historical reference was inspected directly at `artifacts/visual-outcome-audit-18e7d71/board/vo-t1-targets.html`, plus `vo-t1/vo-t1-handoff.md`. The one-shot board renderer confirmed 17 current frames, 17 target frames at each width, 17 specs, eight motion boards, and zero missing board images.

## Overall verdict

**CURRENT PRODUCT VS APPROVED TARGET: PARTIALLY ALIGNED.**

The product has acquired some real redesign capabilities: six-card opportunity density, full-width three-option comparison, a separate presentation shell, `MediaFrame` fallbacks, `WorkflowStepper`, `DateField`, and CompositionBar consumers. These are material advances over the 18e7d71 audit baseline.

It is nevertheless **materially misaligned with the approved visual outcome**. The dominant product expression is still a thin-bordered, white, rail-heavy, prose-led internal tool. Target-defining compositions—editorial identity, calm Work density, a client narrative with real media, dark commercial climax, offer/send focus, and semantic motion—are absent or only partial. Foundations remains visually ahead of real routes.

## Product surface scoreboard

Scores are comparison instruments, not quantitative proof.

| Surface | Quality 1–5 | Target fidelity | Visible change since pre-VO | Professional usability | Client/sales | Rework |
|---|---:|---:|---|---:|---:|---|
| Opportunities / entry | 3 | 55% | MODERATE | 3 | 2 | YES |
| Project identity / card | 2 | 30% | MINOR | 3 | N/A | YES |
| Workspace | 2 | 25% | MINOR | 2 | N/A | YES |
| Building & Scope | 3 | 40% | MODERATE | 3 | N/A | YES |
| Configurator | 2 | 35% | MINOR | 3 | N/A | YES |
| Options | 2 | 35% | MINOR | 3 | 2 | YES |
| Comparison | 4 | 70% | OBVIOUS | 4 | 3 | YES |
| Presentation | 2 | 35% | MODERATE | N/A | 2 | YES |
| Offer / Send | 2 | 20% | MINOR | 2 | 1 | YES |
| Delivered | 1 | 0% | NONE | N/A | 1 | YES |
| Foundations | 4 | 75% as specimen | OBVIOUS | N/A | N/A | NO, but adoption gap |
| Global Work shell | 2 | 30% | MINOR | 3 | N/A | YES |
| Empty/loading/error/incomplete | 2 | 35% | MODERATE | 2 | 1 | YES |

## Target status matrix

| Target family | Current status / fidelity | Decision | Required action |
|---|---|---|---|
| Opportunities | PARTIAL — six cards now fit; all current cards use fallback graphic, not recognition media | STILL VALID | Rebuild identity field and responsive 3→2 composition |
| Project card | MINOR — metrics and stepper exist, but first decision is below a very long continuous page | STILL VALID | Recompose project identity/evidence/workflow |
| Workspace | PARTIAL — canonical stepper is live; hierarchy, rail and decision workspace are not | STILL VALID | Rebuild Work shell and decision-first conflict composition |
| Building & Scope | PARTIAL — real fallback media and readiness exist; cards/table/rail still dominate | STILL VALID | Recompose field grid, readiness rail and selected-building stage |
| Configurator KG 300 | PARTIAL — real commercial rail and Chapter navigation; long one-column prose/control stream remains | STILL VALID | Rebuild primary/secondary decision hierarchy to target |
| Configurator KG 700 | MINOR — two-control chapter still lacks a concentrated decision stage | STILL VALID | Recompose compact decision/result row |
| Comparison | SUBSTANTIAL — full-width 3-column matrix, sticky labels, CompositionBar are live | STILL VALID | Preserve the target; complete its recommended/selected decision stage and client-safe option presentation |
| Present identity/scope | PARTIAL — separate shell is real, but fallback graphic and stacked page replace target full-bleed story | STILL VALID | Build six-section narrative with data-backed media |
| Present commercial/timeline/options/next | PARTIAL — facts are safe and visible but lack presentation composition, stage-deep climax and Option story | STILL VALID | Build individual narrative sections and client Option switching |
| Offer | MINOR — internal Export remains the dominant route, including discount and preparation controls | STILL VALID | Separate Offer moment from preparation/export controls |
| Send review / delivered | NONE — delivery fixture is non-routable (“not elaborated in prototype”); no evidence of target completion panel | STILL VALID | Build review, delivered snapshot and recovery actions |
| Surface specimen | SUBSTANTIAL in Foundations only; low adoption | STILL VALID | Treat as reference, not product completion |

**Kept: 17. Refined: 0. Superseded: 0.** The approved target is not the failure. No new visual target is needed; the existing target board is sufficiently explicit. The only clarifications needed are ticket-level runtime states and acceptance evidence.

## Five-second test

| Target-backed surface | Transformation obvious? | Current resembles target? | Better than historical? | Structural change? | Stronger identity? | Usability better? | Client/sales better? |
|---|---|---|---|---|---|---|---|
| Opportunities | YES, modestly | NO | YES | PARTIAL | NO | YES | N/A |
| Project/workspace | NO | NO | NO | NO | NO | NO | N/A |
| Building & Scope | NO | NO | YES | PARTIAL | NO | YES | N/A |
| Configurator | NO | NO | PARTIAL | PARTIAL | NO | PARTIAL | N/A |
| Comparison | YES | PARTIAL | YES | YES | PARTIAL | YES | PARTIAL |
| Presentation | NO | NO | PARTIAL | PARTIAL | NO | NO | NO |
| Offer / Send | NO | NO | NO | NO | NO | NO | NO |

## Material findings

### VR2-01
**Severity:** P1  
**Surface:** Work shell, workspace, Configurator  
**Approved target:** work has a flexible central decision plane, meaningful/collapsible rail, 2-column decision layouts and docked next action.  
**Current:** fixed left navigation plus permanent large commercial rail constrains a single long central column; KG 300 begins as a long textual/control stream.  
**Visible delta:** target’s calm editorial workbench is not present.  
**Why it matters:** the most frequent professional workflow stays slow to scan and physically long.  
**Root cause:** consumption + task-slicing + acceptance failure.  
**Disposition:** REBUILD.  
**Backlog owner:** VR2-03, VR2-04.

### VR2-02
**Severity:** P1  
**Surface:** Presentation, Offer, Send, Delivered  
**Approved target:** a distinct full-width client narrative, stage-deep commercial climax, offer artefact gallery, focused send review and delivered snapshot.  
**Current:** Presentation removes operational rails but is a long stacked projection with fallback illustration; Export is still an internal work screen with discount/artefact configuration. A “sent” opportunity route says the prototype is not elaborated.  
**Visible delta:** controls are hidden, but the client experience is not re-authored as a sales narrative.  
**Why it matters:** product cannot reliably be turned toward a client.  
**Root cause:** implementation/consumption and route/fixture mismatch.  
**Disposition:** REBUILD.  
**Backlog owner:** VR2-06, VR2-07, VR2-08.

### VR2-03
**Severity:** P1  
**Surface:** Project identity, Opportunities, Building identity  
**Approved target:** editorial project/building media, data-led identity and information-bearing fallbacks.  
**Current:** actual Product `MediaFrame` usage is fallback-only in audited opportunity, project, building and presentation states. The generic building-outline graphic repeats across the portfolio.  
**Visible delta:** identity is functional but anonymous; the target’s spatial/product recognition is missing.  
**Why it matters:** sales memory, portfolio scanning and client confidence all remain weak.  
**Root cause:** media capability existed but was not supplied/adopted as product data.  
**Disposition:** REBUILD.  
**Backlog owner:** VR2-01, VR2-02, VR2-06.

### VR2-04
**Severity:** P1  
**Surface:** Offer and Delivered  
**Approved target:** client-safe commercial finish and explicit sent snapshot.  
**Current:** verified “versendet” entry opens a read-only incomplete-prototype message.  
**Visible delta:** status claims a delivered lifecycle that the runtime cannot show.  
**Why it matters:** this is a direct trust contradiction at the end of a commercial workflow.  
**Root cause:** fixture/route problem and weak end-to-end visual acceptance.  
**Disposition:** REBUILD.  
**Backlog owner:** VR2-08.

### VR2-05
**Severity:** P2  
**Surface:** Design-system adoption  
**Approved target:** canonical surfaces, MediaFrame, WorkflowStepper, controls and motion shape real routes.  
**Current:** canonical components have meaningful consumers, but Canvas/Paper/Stage composition and R1 reference excellence remain most visible in Foundations. `StageDeep` is principally present in the new presentation offer subsections, while Work routes retain legacy white-panel composition.  
**Visible delta:** capability is real; composition adoption is incomplete.  
**Why it matters:** the catalogue looks like the intended product; the product does not.  
**Root cause:** foundation-first programme and downstream ownership not enforced at visual acceptance.  
**Disposition:** EVOLVE + ADOPT.  
**Backlog owner:** VR2-00 through VR2-08.

### VR2-06
**Severity:** P2  
**Surface:** Motion  
**Approved target:** CONTINUITY, DIRECTION, REVEAL and STATE communicate navigation, option selection, calculation, offer assembly and delivery.  
**Current:** runtime inspection observed only skeleton pulse and button spinner; browsing through mode changes and chapters produced immediate state replacement rather than detectable semantic choreography. Comparison horizontal controls use smooth scroll but no decision transition.  
**Visible delta:** semantic motion is absent/partial.  
**Why it matters:** transitions do not communicate context, order or commercial completion.  
**Root cause:** motion primitives were implemented without product-edge adoption.  
**Disposition:** ADOPT; no decorative animation.  
**Backlog owner:** VR2-05, VR2-09.

### VR2-07
**Severity:** P2  
**Surface:** Foundations / localisation / product quality  
**Approved target:** Foundations supports the product; Product-owned language stays DE/EN and client-safe.  
**Current:** `Grundlagen` visibly contains Russian diagnostic copy (“Проверка оснований”) and alpha/blocker language, while no corresponding system richness is realised on Product routes.  
**Visible delta:** Foundations is both visually ahead and internally noisy.  
**Why it matters:** the route undermines system authority and shows the programme was judged by specimens.  
**Root cause:** programme/acceptance boundary between catalogue and Product.  
**Disposition:** RETIRE internal diagnostic presentation from Product-visible Foundations and preserve only actual system documentation.  
**Backlog owner:** VR2-00.

### VR2-08
**Severity:** P2  
**Surface:** Responsive composition  
**Approved target:** separately composed 1280 versions; rail widths 190/226 and three visible compare Options.  
**Current:** comparison holds three Options at 1280, but Work routes merely shrink their same three-column shell; persistent rails still dominate and long central content remains.  
**Visible delta:** comparison is intentional; other material routes are merely shrunk.  
**Why it matters:** 1280 is a first-class professional workspace, not a minimum-fit breakpoint.  
**Root cause:** route-level targets were not accepted at both widths.  
**Disposition:** REBUILD as part of every surface ticket.  
**Backlog owner:** VR2-01 through VR2-08.

## Visual-system and product-identity conclusion

The current identity is “careful technical proposal prototype”: white background, black rules, orange accent, heavy numeric offer rail, generic line-art building fallback and repeated bordered panels. It is recognisable, but not yet premium, architectural or client-presentable.

The VO-T1 direction establishes a stronger identity: editorial project imagery, restrained warm surfaces, paper/stage hierarchy, decisive dark commercial fields, less container nesting, and a clear **Work / Compare / Present** family. Keep that direction.

## Accessibility and content-design observations

- Positive: semantic tables, labelled controls, 44px-sized primary controls, text-labelled statuses, and CompositionBar `alt` text are observable in the runtime.
- Gap: target focus hierarchy and docked actions are not visible in Work routes; overlong prose is still used as permanent guidance.
- Gap: Russian diagnostic copy on Foundations is a material localisation failure; “Muster” artefacts and internal discount/margin language remain exposed on the export path.
- Gap: meaningful visual state relies on repeated border/position rather than a stronger surface hierarchy. No colour-only P0 was observed in captured states.

## Evidence map

See `current/01` through `current/12`. Key captures: `01-opportunities`, `02-project-workspace`, `03-building-scope`, `06-configurator-kg300`, `07-comparison-3options`, `10-presentation-full`, `09-offer-send-review`, `11-foundations`, and `12-delivered-route-incomplete`.
