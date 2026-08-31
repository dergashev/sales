# VR2-03 — Building & Scope workspace recomposition — evidence

## Acceptance remediation (cycle 6) — narrower readiness rail, read-first review sections, tighter tab position

Acceptance rejected `07d3c08bedae1b6e8ff34a69b7abb18c73dc3310` a 5th time,
with three more measured deltas: the right (readiness) rail stayed ~300px
at both viewports against the target's measured ~264px (1440) / ~226px
(1280); the building tabs still started at y≈438/494 against the target's
~264/270, because the visible "Gebäudedaten prüfen" `<h2>` + its sheet's
own top padding sat above them; and each review section (Identität &
Nutzung, Flächen, Geometrie & Geschosse) was still an always-editable
field grid where the target shows a read-only value summary with its own
"Abschnitt bearbeiten" entry point.

New final `implementationCommit`/`candidateRuntimeCommit` =
`d4da24dac1fa5b184054695a0e0fa405484919c3` (supersedes `07d3c08` throughout
this document unless a screenshot is explicitly labelled otherwise).
Re-verified: typecheck, 750/750 tests, verify (0 findings), build,
`npm run test:browser:desktop` 8/8 — all PASS against this exact SHA, clean
tree.

Fixes (full detail in the `a426f3d` and `d4da24d` commit messages):
- `--panel-right-width-compact` 300px→264px (1440+) / 226px (≤1439px, same
  breakpoint the left rail already uses) — matches Acceptance's measured
  values. The commercial `--panel-right-width` (OfferPanel) is untouched.
- Dropped the visible "Gebäudedaten prüfen" `<h2>` — the text becomes the
  review sheet's `aria-label` instead (same landmark/accessible name, no
  longer painted); the table's own `sr-only` caption already carried it
  independently.
- Each of the three review sections now defaults to a READ-ONLY value
  summary (new `ReadField`/`identityReadFields`/`areaReadFields`, reusing
  the exact same computed values, canonical fact labels and
  `ProvenanceChip` the edit fields already use — no invented copy or
  data), with a new "Abschnitt bearbeiten"/"Fertig" toggle per section
  that switches to the existing, unchanged edit fields. All three sections
  default OPEN (visible without a click) — only which of the two
  renderings each shows is new. The areas read view intentionally
  simplifies to the target's 4 headline figures (BGF above/below ground,
  WFL, NUF) rather than the full 9-field R/S breakdown; every field stays
  fully editable one click away.
- Tightened the residual gap above the tabs (438px → 325px at 1440, a
  113px reduction) via a scoped `.a3-buildingscope-review` padding
  override (this screen's own untitled sheet only, every other titled
  sheet keeps the standard 48px), dropping a wrapper's redundant top
  padding, and removing a border/gap the target doesn't show either. The
  residual ~60px gap is real, legitimate content (the shared PageHeader
  eyebrow/meta row + this screen's own "Gebäude verwalten" row), not
  padding — disclosed below.
- Fixed two real overflow regressions the narrower panels and the new
  read-only grid exposed (confirmed via `scrollWidth`/`clientWidth`
  measurement, not guessed): the readiness rail's own `<h2>` bled 47px
  past its box once narrowed to 226px ("Konfigurator?" as one unbreakable
  word), and `ReadField`'s value line (e.g. "Mehrfamilienhaus") had no
  ellipsis/wrap safety net the edit-mode `<select>` it replaces has.
  Both fixed with `break-words` (+ `min-w-0` on the grid child for the
  second one), the same pattern already used product-wide for long
  German compound words.

Screenshots in `acceptance-remediation-cycle6/`:
- `candidate-1440-narrow-rail-readonly-review.png` — 264px readiness rail,
  no visible review heading, tabs materially closer to the top, Identität
  & Nutzung rendered as a read-only value grid with "Abschnitt bearbeiten".
- `candidate-1440-areas-storeys-readonly-scroll.png` — Flächen (4 headline
  figures with provenance captions matching the target's field set almost
  exactly) and Geometrie & Geschosse (including a read "Untergeschoss"
  line reflecting the real `UntergeschossEditor` selection) sections.
- `candidate-1280-narrow-rail-readonly-review.png` — same composition at
  1280, 226px rail, verified overflow-free after the two fixes above.

**Known, disclosed limitations (unchanged, reaffirmed):**
1. No literal "Übersicht" nav item — `TARGET-workspace` depicts a
   WFL-conflict decision screen that resolves at the Opportunity level
   before an Option exists in the current architecture (see cycle 1's
   direct message to Acceptance, preserved in team notes).
2. The target's "Geometrie & Geschosse" mockup panel also shows "Dachform"
   (no such fact exists anywhere in the `BuildingFactKey` data model) and
   relocates "Adresse" there (the real data model scopes it to Identität,
   per `sectionForFact`) — neither is invented; the read view shows only
   real product data.
3. The residual ~55-60px gap between the intro and the building tabs
   (measured 325px vs the target's ~264px at 1440) is the shared
   PageHeader's own eyebrow/meta row plus this screen's own "Gebäude
   verwalten" disclosure row — both real, functioning UI, not empty
   padding; the target's own equivalent composition does not carry an
   identical row in the same form.

## Acceptance remediation (cycle 5) — 208/189px rail, bottom Ansicht toggle, collapsed building management

Acceptance rejected `4b6b6df5ff00471000946a8daccced8f18dbfe13` (`4b6b6df`) a
4th time, with exact measurements against `TARGET-workspace-1440/1280.png`:
rail ~280/232px vs target's measured ~208/189px; Sidebar identity block
showed only the Option name (target names the parent project underneath it
too) and put Arbeiten/Präsentieren directly under identity instead of at
the rail's bottom; the building tab strip started at ~585px vertically vs
target's ~264px, because the always-visible inclusion checklist pushed it
down — the target keeps that behind a closed "Gebäude verwalten" toggle.

New final `implementationCommit`/`candidateRuntimeCommit` =
`d662ef482a7053df2f19bd0b2a1c8008ff279f79` (supersedes `4b6b6df` throughout
this document unless a screenshot is explicitly labelled otherwise).
Re-verified: typecheck, 750/750 tests, verify (0 findings), build,
`npm run test:browser:desktop` 8/8 — all PASS against this exact SHA, clean
tree.

Fixes (full detail in the `73b6e5d` and `d662ef4` commit messages):
- `--panel-left-width` 280px→208px, narrow-breakpoint value 232px→189px
  (`design-system/tokens.css`) — matches Acceptance's measured values.
  `--panel-right-width` (520px) untouched.
- Sidebar identity block now shows the parent project name under the
  Option (same `opportunities.json` lookup `AppHeader` already uses), and
  `OutputProfileSwitch` (Arbeiten/Präsentieren) moved to the bottom of the
  rail, after the workflow list — same component/props/behaviour.
- BuildingScope headline building count now reflects the SELECTED/included
  count, not every building ever discovered in the project (falls back to
  the discovered total only in the unreachable zero-selected edge case).
- Building inclusion checkboxes collapse behind a new "Gebäude verwalten"
  toggle (`aria-expanded`/`aria-controls`), closed by default whenever a
  building is already selected, auto-open when nothing is selected yet so
  the empty state still explains itself without an extra click. Every test
  call site that interacted with a checkbox directly — including the
  canonical `tests/browser/specs/configurator-building.desktop.ts` E2E spec
  — now opens the disclosure first.
- Browser-verified regression: the narrower rail left the single unbreakable
  compound word "Variantenvergleich" ~6px too wide for its column, bleeding
  past the rail edge instead of wrapping. Fixed by giving the label its own
  `min-w-0 flex-1 break-words` span; re-verified the Konfigurator chapter
  sub-nav's longer labels (`Leistungsabgrenzung`, `Baunebenkosten KG 700`,
  …) still wrap cleanly with no overlap at both viewports.

Screenshots in `acceptance-remediation-cycle5/`:
- `candidate-1440-narrow-rail-collapsed-management.png` — 208px rail,
  project name under Option, building tab strip now starts right under the
  intro (no checklist in the way), collapsed "Gebäude verwalten".
- `candidate-1440-manage-buildings-open.png` — toggle opened, inclusion
  checkboxes visible with correct checked/unchecked + status badges.
- `candidate-1280-nav-wrap-fix.png` — 189px rail, "Variantenvergleich"
  wraps cleanly to two lines instead of clipping.
- `candidate-1440-konfigurator-chapter-nav-regression-check.png` /
  `candidate-1280-konfigurator-chapter-nav-regression-check.png` — narrower
  rail's Konfigurator chapter sub-nav (longer labels) still readable, no
  clipping or overlap at either viewport.

**Known, disclosed limitation carried over unchanged (4th time):** no
literal "Übersicht" nav item — `TARGET-workspace-*` depicts the WFL-conflict
decision screen, which in the current product resolves at the Opportunity
level, before an Option/Building & Scope exists; building it as a
Building-&-Scope-reachable nav destination would mean inventing a Product
state and routing branch (`PipelineView`, `App.tsx`, `Sidebar.tsx`) with
unknown store/test blast radius, which exceeds this cycle's bounded
engineering judgment without Product authority. This reasoning was sent to
Acceptance in cycle 1 and is preserved in the team notes; the rail
chrome/measurements this image also carries (width, identity block, bottom
Ansicht toggle) are addressed above independent of that nav item.

Separately observed but **not** addressed this cycle (not part of
Acceptance's cycle-5 rejection, flagged for visibility): `TARGET-building-*`
shows the confirmed-building state as a read-only summary (plain values +
one "Abschnitt bearbeiten" link per section, a sticky bottom confirm bar)
rather than the always-editable field grid (inputs/selects/"Angabe
übernehmen" per field) the product currently uses throughout the review
flow. Converting the review UI from an edit-first to a read-first-then-edit
model is a materially different interaction pattern touching confirmation,
undo and persistence semantics well beyond a shell/composition change — an
explicit Product decision, not a bounded implementation one.

## Acceptance remediation (cycle 4) — shell unification + target copy

Acceptance rejected `4f446b88f0a89301298e321f704389d1ee3702b0` (`4f446b8`)
a third time: legacy verbose Preparation rail (separate Option selector,
Variantenvergleich link, Ausgabe group) instead of the target's ONE
numbered workflow rail; generic "Gebäude & Umfang" heading instead of the
target's dynamic sentence; section labels not matching target's literal
copy ("Identität & Nutzung", "Geometrie & Geschosse").

New final `implementationCommit`/`candidateRuntimeCommit` =
`d5027bead63f8f1340b03fa509822a10caabcad6`. Re-verified: typecheck,
750/750 tests, verify (0 findings), build, `npm run test:browser:desktop`
8/8 (including the Vergleich comparison specs, which exercise the shared
shell this cycle touched) — all PASS, clean tree.

Fixes (full detail in the `d5027be` commit message):
- **Sidebar unified into one workflow list**: Gebäude & Umfang /
  Konfigurator / Vergleich / Angebot(Export) now render as ONE numbered
  list under "Aktuelle Option" — same exact destinations and gating as
  before (Vergleich was never blocked; Export needs the whole-option
  confirm CTA), just unified where they render instead of split across a
  numbered pair + a separate link + a separately-grouped item.
- Position-number hint is now decorative (`aria-hidden`, shows "✓" once a
  step is done) instead of being concatenated into the accessible name —
  `aria-current="page"` already tells assistive tech which step is
  current, so hiding a redundant digit is a net-neutral-to-positive a11y
  change, not a regression.
- **Dynamic target headline**: added "Zwei Gebäude. Eine klare
  Grundlage." (DE/EN, 1/2/3/many building forms) as the visually biggest
  text, matching the approved target. The actual `<h1>` keeps its exact
  existing text/role ("Gebäude & Umfang" — needed for route-focus-reset
  and two DOM tests) but is now visually demoted to a small context label.
- **Section labels renamed to match target literally**: "Identität" →
  "Identität & Nutzung", "Geschossstruktur" → "Geometrie & Geschosse" (DE
  + EN). The internal journal-event audit label (`store.ts`) is a
  deliberately separate, unchanged string — not the visible section
  header.

Screenshots in `acceptance-remediation-cycle4/`:
- `candidate-1440-unified-shell.png` / `candidate-1280-unified-shell.png`
  — the single 4-item workflow list at both viewports, dynamic headline,
  renamed field-grid section.
- `candidate-1440-confirmed-checkmark-state.png` — both buildings
  confirmed: "✓ Gebäude & Umfang" checkmark replaces the position number,
  Konfigurator/Vergleich reachable, Export's real blocked-reason text,
  orange "Konfigurator öffnen" primary action on the readiness rail.
- `candidate-1440-en-confirmed-state.png` — same state, EN locale, fully
  translated, no layout breakage.

**Known, disclosed limitation carried over, narrowed further:** the
global breadcrumb (`App.tsx`) still shows only a single-line path
("Opportunities / ProjectName / OptionName"), not a second "OPPORTUNITY
OPTION" eyebrow line, and there is still no literal "Übersicht" step —
in the current product a WFL conflict is resolved at the Opportunity
level, before an Option/Building & Scope exists, so TARGET-workspace's
Übersicht content cannot occur inside an Option (this reasoning was sent
directly to Acceptance in cycle 1 and is preserved in the team notes).
Everything else materially converges on the approved target now.

## Acceptance remediation (cycle 3) — content/composition rework

Acceptance rejected `946b9f26db63af5ef14fa2f497c902ed9213335e`: review stage
below the first viewport, card/table-heavy rather than target tabs + dense
field grid, 1280 showed narrow stacked cards instead of full-width tabs,
fallback media under-prioritised, no BuildingScope-specific motion.

New final `implementationCommit`/`candidateRuntimeCommit` =
`e8974916cd9276a6aeb436a8a1c5564de73389e1` (supersedes `946b9f2` throughout
this document unless a screenshot is explicitly labelled otherwise).
Re-verified: typecheck, 750/750 tests, verify (0 findings), build,
`npm run test:browser:desktop` 8/8 — all PASS against this exact SHA, clean
tree.

Fixes, see the commit message on `e897491` for full detail:
- Removed the separate bordered building-identity-card grid (it duplicated
  the tab strip); "Gebäude im Angebot" is now a slim inclusion-only list.
- Tab strip is `display:grid`, full content width, richer tiles (card-ratio
  media, name, type/class, status) — the ONE identity surface now, shared
  between the interactive (>1 building) and static (1 building) cases.
- Removed the first/last tab-jump buttons (obsolete once tabs wrap instead
  of scrolling; their ~126px width was forcing 1280 to a single column —
  directly the "narrow stacked cards" finding). Keyboard Home/End unaffected.
- Dropped a redundant intro line + tightened spacing so the building tab and
  first field-grid row now render inside the first 1440×900 viewport.
- `areas` review section now defaults open (more of the dense grid visible
  without an extra click).
- Added a CSS state-transition on tab selection (border/background colour)
  — respects the existing global `prefers-reduced-motion` blanket rule.

Screenshots in `acceptance-remediation-cycle3/`:
- `candidate-1440-single-building-first-viewport.png` — the field-grid's
  actual input controls (not just section headers) now render inside the
  first 1440×900 viewport.
- `candidate-1440-multi-building.png` / `candidate-1280-multi-building-full-width-tabs.png`
  — two buildings render as full-width tabs side by side at BOTH viewports
  (previously 1280 stacked them as narrow vertical cards).
- `candidate-1440-longname-regression-check.png` /
  `candidate-1280-longname-regression-check.png` — QA-01's exact ~80-char
  override still wraps cleanly in the list, tab and readiness rail after
  this structural rework (regression-checked, not just assumed).
- `candidate-1440-en.png` — EN locale, multi-building, no breakage.

**Known, disclosed limitation carried over unchanged:** the outer workspace
shell (`App.tsx` global breadcrumb, `Sidebar.tsx` left workflow rail) is
still not reworked into the target's own chrome (no second "OPPORTUNITY
OPTION" line, no "PROJEKTWORKFLOW"-style progress heading, no "Übersicht"
step). Investigated a canonical `WorkflowStepper` migration for the
top-level Sidebar nav (would visually match target's numbered/checkmarked
steps) but found it changes two things the canonical desktop Playwright
spec (`tests/browser/specs/configurator-building.desktop.ts`) asserts
verbatim — `aria-current="page"` (route semantics) would become
`aria-current="step"` (WorkflowStepper's hardcoded value, actually LESS
correct for top-level route navigation) and `aria-describedby` would point
at a differently-formatted id than the asserted `building-gate-konfigurator`
— plus the shell is shared by Konfigurator/Vergleich/Export, widening the
blast radius beyond this ticket. Judged this a separable, higher-risk piece
of work rather than something to force through unilaterally a second time
after the tab-strip rework already required real structural changes this
cycle. A literal "Übersicht" step also has no corresponding real state (see
the earlier direct message to Acceptance, preserved in the team notes): in
the current product a WFL conflict is resolved at the Opportunity level,
before an Option/Building & Scope exists, so TARGET-workspace's Übersicht
content cannot occur inside an Option.

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
