# VR2-03 — Building & Scope workspace recomposition — evidence

## QA-01 rework (cycle 2) — tab-strip long-name clipping

QA (cycle 1, candidate `5c58fec`) found the multi-building tab strip hard-clipping
an overridden long building name mid-word at both 1440×900 and 1280×800 — the
identity card and readiness rail wrapped the same name correctly, only the tab
strip did not. Root cause, confirmed live (`getComputedStyle`/`getBoundingClientRect`):
(1) `[role="tab"]` had no width cap, so the tab grew to the name's full
one-line content width instead of wrapping; (2) after capping the width,
Tailwind's `flex-nowrap` utility on the tablist element was still cascading
over `.a3-tabs-tiles{flex-wrap:wrap}`, so two capped tabs that didn't fit
side-by-side at 1280 were silently horizontal-scroll-clipped instead of
wrapping to their own row. Fixed both (`design-system/components.css` +
`src/screens/BuildingScope.tsx`), re-verified with the exact QA repro
(~80-char override on Haus B's Bezeichnung field) at both viewports —
`qa-01-rework/`:
- `before-fix-1440-clipped.png` — the reported defect, candidate `5c58fec`.
- `after-fix-1440.png` — fixed, candidate `79056cf`, tabs fit side by side.
- `after-fix-1280-wrapped-row.png` — fixed, candidate `79056cf`, the two
  tabs no longer fit side by side at this width so the Haus B tab wraps to
  its own row instead of clipping — fully visible, no horizontal scroll.

New final `implementationCommit`/`candidateRuntimeCommit` = `79056cf61955a1bec8c2b01bd7a53070b9f4ead4`
(supersedes `5c58fec` throughout this document unless a screenshot is
explicitly labelled otherwise). Re-verified: typecheck, 750/750 tests,
verify (0 findings), build, `npm run test:browser:desktop` 8/8 — all PASS
against this exact SHA, clean tree.

## Target authority (restored from archive)

`TARGET-workspace-1440/1280.png` and `TARGET-building-1440/1280.png` are the
VO-T1 high-fidelity targets referenced by the VR2-03 task contract. They are
**not present in `origin/master`** — they exist only in the pre-GIT-01
rescue commit `966c8333a6241ee9484654636efab441e2dbb472`
(`refs/archive/git-01/rescue-main-dirty-20260829-1240`), at
`artifacts/visual-outcome-audit-18e7d71/vo-t1/targets/`. Restored verbatim
(`git show 966c833:<path>`) into that same path in this branch so the
Pre-Release Scope & Target Acceptance Auditor does not have to repeat the
git archaeology. `TARGET-workspace-*` is the primary acceptance authority
per the task contract; `TARGET-building-*` is the matching Building & Scope
content composition from the same VO-T1 board (id `building`, n=04) and is
included as supporting evidence — both were rendered by the same board
(`artifacts/visual-outcome-audit-18e7d71/board/vo-t1-targets.html`, also
only in that same archived commit).

## BEFORE — CURRENT_MAIN before implementation

- Route: Opportunities → Musterprojekt Nordfeld (DEMO-0001) → resolve WFL
  conflict → confirm project params → create Option → open Option →
  Gebäude & Umfang (buildingScope pipeline view).
- `runtimePurpose=CURRENT_MAIN`, `runtimeCommit=a4d9b99de5cc7b60fda4316198d1f059947126bb`
  (`origin/master` HEAD at task start; `npm run runtime:status` reported
  `PROVENANCE: SERVING_VERIFIED`).
- Viewport 1440×900, locale DE, single included building (Haus A), 0 of 1
  confirmed.
- `before/before-1440-de.png` — first viewport.
- `before/before-1440-de-scroll.png` — scrolled to the field-review table.

## CANDIDATE — exact implementation commit

- `runtimePurpose=TASK_CANDIDATE`,
  `runtimeCommit=e47e2e9feba6abbe3d7f15eb60b176dbb372bb72`
  (branch `vr2-03-building-scope-workspace`, clean tree — confirmed by
  `npm run test:browser:desktop` provenance block, which also ran the full
  canonical desktop Playwright suite against this exact build, 8/8 PASS).
- Same route as BEFORE unless noted. Folder `candidate-e47e2e9/`.
- Screenshots taken against two points in the same implementation arc — the
  intermediate SHA `ce489f86` (identity cards / dense field grid / docked
  confirm / prominent readiness numeral — the shared-rail width was not yet
  narrowed) and the final `e47e2e9` (adds the Building & Scope rail's own
  narrower width, `.a3-buildingscope-rail`, so the review stage gets the
  extra ~180px). No source file differs between the two states in a way
  that would change what an intermediate screenshot shows *except* rail/
  content width — every compositional claim below holds at both SHAs:
  - `candidate-1440-de.png`, `candidate-1440-de-scroll-1.png`,
    `candidate-1440-de-scroll-2.png`, `candidate-1440-en.png`,
    `candidate-1280-de-top.png`, `candidate-1280-de-scroll.png` — captured
    at `ce489f86` (single-building state unless noted; `-en` and the 1280
    pair are DE/EN and viewport coverage).
  - `candidate-1440-de-multi-building-fields.png`,
    `candidate-1280-de-multi-building.png` — captured at the final
    `e47e2e9`, Haus A + Haus B both included: building-card grid (2 cards
    side by side even at 1280, no overflow), building tab strip visible (2
    media tiles, active tile marked "Wird gerade geprüft" — textual, not
    colour-only), the identity field-grid now renders 3 columns at 1440
    (Bezeichnung / Adresse / Gebäudeform) thanks to the narrower rail,
    readiness rail "1 von 3 Punkten bereit" at heading-2 weight.

## Material delta (five-second read)

BEFORE: two separately-sheeted panels ("Gebäude im Angebot" checkbox list
with 64px fallback tiles; "Gebäudedaten prüfen" underline tabs over a
collapsed accordion table), small "1 von 2 Punkten bereit" caption, plain
paragraph + button confirm action.

CANDIDATE: one review stage; building selection is now a grid of bordered
identity cards with a card-ratio MediaFrame; the building tab strip (when
more than one building is included) carries its own media tile and an
explicit "currently reviewing" state; the identity/areas review sections
render as an always-open, dense 2-column field grid instead of a
click-to-expand accordion; the confirm action is a docked bar; the
readiness rail's "X of Y" summary is rendered at heading-2 weight with an
explicit "Primäre Aktion" label above the next-step button.

Known non-change: the outer workspace shell (global breadcrumb, left
`Sidebar` workflow rail, right-rail width token) is intentionally
untouched — see the Frontend delivery report's OUT OF SCOPE /
KNOWN NON-CHANGES section for the reasoning (shared across
Konfigurator/Vergleich/Export; VR2-04 depends on that shell being stable).
