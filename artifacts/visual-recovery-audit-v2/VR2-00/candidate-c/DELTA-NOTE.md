# VR2-00 — Candidate C evidence & delta note (ACCEPTANCE REMEDIATION)

- **Candidate C:** `173f61ceab368d8936d5e2b85ebb3fcfaf7b10d7`
- **Previous candidate B (immutable, superseded):** `9fbf5385b02f1c8a2dd67b71f36e2f3c48add572`
- **Parent lineage:** CURRENT_MAIN `6fcb567628f26f02cac0e74674378a79e6ac13b8` (B → C linear).
- **Runtime:** `http://127.0.0.1:5185` (VR2-00 Visual Gate Candidate Dev Server), worktree HEAD == C, clean.
- **Provenance:** SERVING_VERIFIED — runtime SHA == candidate SHA == implementation SHA.

## What the Acceptance Auditor returned (remediationRequired) and what C changes

1. **Gate did not validate `capture.state`** → C validates every capture's `state`
   against the ticket's declared `spec.states`; an unknown state fails the gate.
2. **Gate aggregated viewports/locales globally** (one locale could miss a
   viewport) → C enforces a **per-locale matrix**: each required locale (de, en)
   must carry BOTH 1440×900 and 1280×800.
3. **Targets used `#fragments` that do not resolve on the board; the checker only
   required a non-empty string** → the route-state manifest now uses stable
   `target-<id>` anchors; C parses the approved board (`vo-t1-targets.html`),
   builds the set of `id="target-<id>"` articles it actually renders, and
   requires every target to (a) be one the ticket owns and (b) resolve to a real
   board article. Arbitrary / non-resolving targets fail.
   - Bonus fix: the working tree had an undefined `REPO_ROOT` reference (declared
     `BASE`) that made board/image path resolution throw; corrected.
4. **Diagnostics still exposed raw mixed-language values** ("Regionalfaktor
   inactive", "open", "material") → the three raw fixture enums are now localised
   through the i18n dictionary. Fixture data unchanged; display labels only.

## Gate scenarios verified (npm run vr2:gate)

| Scenario | Expected | Result |
|---|---|---|
| Complete per-locale matrix, valid state, resolving target | PASS | PASS (exit 0) |
| One capture with an undeclared state | FAIL | FAIL — "state … is not a declared state" |
| EN missing 1280×800 | FAIL | FAIL — "locale \"en\" is missing required viewport 1280x800" |
| Arbitrary target `#target-nonsense` | FAIL | FAIL — not a ticket target AND does not resolve to a board article |
| Specimen route `grundlagen` | FAIL | FAIL — "design-system specimen — not an accepted product consumer" |
| All 16 VR2-01..09 manifest targets | resolve | all resolve (17 board anchors) |

## Foundation shell (browser, candidate C runtime)

| Viewport | DE | EN |
|---|---|---|
| 1440×900 | `grundlagen-de-1440.png` | `grundlagen-en-1440.png` |
| 1280×800 | `grundlagen-de-1280.png` | `grundlagen-en-1280.png` |

- Banner: DE "Intern · QA-Spezimen" / "Interne QA-Oberfläche — kein Produkt";
  EN "Internal · QA specimen" / "Internal QA surface — not a product".
- Diagnostics fixture/status now localised:
  - DE: "DEMO-VI-0001 · **offen · wesentlich** · 5 Profile" · "Regionalfaktor **inaktiv**".
  - EN: "DEMO-VI-0001 · **open · material** · 5 profiles" · "Regionalfaktor **inactive**".
- **Zero Cyrillic** in the visible shell in both locales; no horizontal overflow
  at 1280×800; only console error is the pre-existing `favicon.ico` 404.

BEFORE for comparison: `../current/11-foundations-1440.png`.
Approved system specimen target: `TARGET-surfaces-1440.png` (board `#target-surfaces`).
