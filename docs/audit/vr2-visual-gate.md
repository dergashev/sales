# VR2-00 — Runtime visual gate & Foundations separation

Status: enabler for the Visual Recovery Audit V2 programme (VR2-01…VR2-09).
Owner surface: release acceptance evidence + the internal Grundlagen specimen.
See memory `visual-recovery-audit-v2`, `visual-outcome-audit-18e7d71`,
`validation-and-release-gates`.

## Why this exists

The Foundation route (Grundlagen) was visually ahead of much of the Product and
carried internal **Russian** diagnostic content, while historical DONE/PASS
states did not prove the *current product* matched the approved VO-T1 target.
Two failures followed:

1. **False adoption.** Specimen/registry/Foundation screenshots, component
   existence, and green tests were read as evidence of product adoption.
2. **Unverified provenance.** Screenshots were accepted without proving they
   came from the exact candidate runtime at both required viewports.

VR2-00 closes both: it makes a **provenance-verified product runtime** the only
acceptance source of truth, and it makes Foundations unmistakably an internal
specimen that no longer reads as a product claim.

This ticket does **not** change product composition, calculation, persistence,
routes, or internal-access policy. It changes only the acceptance/provenance
boundary and removes product-adoption ambiguity from the Grundlagen shell.

## The gate (acceptance rule)

> A VR2 ticket may not claim target adoption unless it attaches
> **provenance-verified, exact-SHA PRODUCT screenshots** of the ticket's named
> **ordinary runtime route AND a declared state**, with a **per-locale matrix**
> — each required locale (DE and EN) carrying **both** required viewports
> (1440×900 and 1280×800) — compared side-by-side with an approved **VO-T1
> board target** that actually **resolves**.

A design-system **specimen** (Grundlagen/Foundations, the Gallery, the
registry), Storybook, a unit/DOM test surface, or a deep-only / hidden
prototype route is **not** an accepted consumer and does not satisfy the gate.

The checker enforces this strictly and rejects, among others: a `state` not in
the ticket's declared `states`; a locale that is missing a required viewport
(the matrix is evaluated **per locale**, never aggregated); and a `target`
that is not one the ticket owns or that does not resolve to a real board
article (`id="target-<id>"`, rendered from the board's target data ids). The
approved board file must exist on disk.

The gate is enforced mechanically by `tools/vr2/check-evidence.mjs`
(`npm run vr2:gate -- <evidence-manifest.json>`), which is intentionally *not*
part of `npm run verify`/CI — it gates a VR2 **release acceptance**, run by the
Pre-Release Scope & Target Acceptance Auditor / Release Engineer, not every
commit.

## Runtime capture manifest

Each VR2 evidence set is a JSON manifest
(`tools/vr2/evidence-manifest.template.json` is the template). It records, for
the whole set and for every capture, the six identifying facts the release
evidence workflow must pin down:

| Field | Meaning |
| --- | --- |
| `route` | ordinary product runtime route (never a specimen) |
| `state` | the route's state / fixture condition (incl. long / incomplete) |
| `viewport` | `1440x900` and `1280x800` are both required |
| `locale` | `de` and `en` are both required |
| `reducedMotion` | boolean; a `true` capture is required where the ticket owns motion |
| `runtimeSha` | exact runtime SHA; `implementationCommit` **must equal** `candidateRuntimeCommit` |

Plus `provenance` (must be `SERVING_VERIFIED`/verified) and `target` (the VO-T1
target the capture is compared against). Every `image` path must exist on disk,
so evidence is real rather than asserted.

### Resolving the exact runtime SHA

Follow the Runtime Provenance Contract (memory `validation-and-release-gates`):

- `origin/master` is the release branch (SSH remote); local `main` drives
  `CURRENT_MAIN` via `tools/runtime`.
- For a **candidate** (pre-release, what a VR2 ticket hands to acceptance):
  `npm run gate:declare` then `npm run runtime:candidate`, and capture against
  that runtime. `candidateRuntimeCommit` is the served SHA and must equal the
  `implementationCommit` handed to QA.
- For **CURRENT_MAIN** (a released surface): `npm run runtime:main` /
  `npm run runtime:status` after the local `main` fast-forward, then capture.
- Never capture from the dirty root checkout: resolve origin/HEAD, remote
  release SHA, release-worktree SHA and live runtime SHA independently.

### Capturing

Use the canonical Playwright CLI workflow at both viewports and locales
(`playwright-cli resize 1440 900` / `1280 800`; the DE/EN toggle switches
locale). For a reduced-motion capture, run the page under
`prefers-reduced-motion: reduce`. Save images under
`artifacts/visual-recovery-audit-v2/<ticket>/candidate/` and reference them
from the evidence manifest.

## Route/state fixture manifest

`tools/vr2/route-state-manifest.json` is the authoritative map: for each of
VR2-01…VR2-09 it names the ordinary runtime route(s), the state(s) to capture
(including the long / incomplete state, not only the happy path), the ordinary
entry path, whether reduced motion is owned, and the VO-T1 target reference. It
also lists the `specimenRoutes` the gate rejects. Summary:

| Ticket | Route(s) | States | Motion |
| --- | --- | --- | --- |
| VR2-01 | opportunities | portfolio-list, portfolio-empty | — |
| VR2-02 | project-workspace | opportunity-opened | — |
| VR2-03 | building-scope | building-review, building-review-incomplete | — |
| VR2-04 | configurator | entry, scope, kg300, kg400, long | ✓ |
| VR2-05 | comparison | three-options, four-options-overflow | ✓ |
| VR2-06 | presentation | client-projection | ✓ |
| VR2-07 | offer | offer-climax | — |
| VR2-08 | send, delivered | send-review, delivered | — |
| VR2-09 | all major surfaces | long, incomplete | ✓ |

## Foundations separation

Grundlagen is an **internal QA / design-system specimen**, not a product or
client surface. As of VR2-00 its first viewport carries an unmistakable
internal-specimen banner (`grundlagen.specimen.*`) and its diagnostics render
in the product locales (`diagnostics.*`, DE source + EN) via the i18n
dictionary — no untranslated Russian, no mixed-language content in the visible
shell (`src/screens/Grundlagen.tsx`, `src/components/Diagnostics.tsx`,
`src/lib/font-check.ts`). Foundations is the `TARGET-surfaces` system specimen
only and is excluded from product-adoption claims — it is listed under
`specimenRoutes` so the gate rejects it as evidence.

## How VR2-01 uses this (worked flow)

1. Implement VR2-01 (Opportunities) and produce an exact candidate commit.
2. Serve that exact commit as a verified candidate runtime (`gate:declare` →
   `runtime:candidate`).
3. Capture the `opportunities` route (`portfolio-list`) at 1440×900 and
   1280×800, in DE and EN, from the candidate runtime.
4. Copy `tools/vr2/evidence-manifest.template.json` to
   `artifacts/visual-recovery-audit-v2/VR2-01/evidence-manifest.json`, fill the
   SHAs, provenance, target and captures.
5. Run `npm run vr2:gate -- artifacts/visual-recovery-audit-v2/VR2-01/evidence-manifest.json`.
6. Compare each capture with the VO-T1 target
   (`artifacts/visual-outcome-audit-18e7d71/board/vo-t1-targets.html`). The
   Pre-Release Scope & Target Acceptance Auditor rejects a technically correct
   candidate that is materially unlike the target.

Acceptance criterion for this enabler: the method is exercised by at least
VR2-01 before its release acceptance.
