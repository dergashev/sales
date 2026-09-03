# VR3-03R · BEFORE vs AFTER vs TARGET

`taskBaseBranch=master`
`taskBaseCommit=d56342d1df652768d83b67269ffa578a43122307` (fresh `origin/master`, includes merged VR3-04)
`candidateBranch=vr3-03r-konfigurator-recovery`
`implementationCommit = candidateRuntimeCommit` (see the change manifest for the exact SHA)
`candidateRuntime=http://127.0.0.1:5198`, cwd `.worktrees/vr3-03r-konfigurator-recovery`
`runtimeProvenanceMatch=true` — the served runtime IS the candidate worktree, clean at the candidate
SHA. The `C…` captures and every measurement in §6 were taken against it.

BEFORE is the audit's pinned evidence at `71ea97f79996405244f4cd1b301003ae41a04591`
(`.worktrees/scope-boundaries-entry/artifacts/vr3-03a-review/evidence/current/`) PLUS the
re-measured behaviour of `taskBaseCommit` itself, recorded in
`evidence/before/` before any line of this candidate was written. The second set matters:
most of the audit register had already been closed by VR3-03, and a remediation that
re-fixed what was fixed would be its own kind of false report.

---

## 1 · Reconciliation of the audit register against `taskBaseCommit`

Every gap replayed at runtime on the ordinary path
(Opportunity → Projekt A → Analyse → Option → Gebäude & Umfang → Konfigurator),
with all six cost groups explicitly INCLUDED.

| Gap | Verdict at `d56342d` | Runtime evidence |
|---|---|---|
| G-01 false six-decision model | **ALREADY CORRECTED** | True `0 von 6 entschieden`, six UNDECIDED rows, nothing pre-checked, Continue gated |
| G-02 KG work precedes scope | **ALREADY CORRECTED** | Leistungsabgrenzung is Konfigurator step 1; each KG renders its own `ActionGate` until 6/6 |
| G-03 three KGs have no peer page | **ALREADY CORRECTED** | All six reached through the spine; `KgChapter` is one composition with no `switch (group)` |
| G-04 chapter-specific grammars | **ALREADY CORRECTED** | One page/group/row/detail anatomy in all six; no segmented control, no tabs, no chapter shell |
| G-05 media dominates decisions | **ALREADY CORRECTED** | `0` images in the service workspace of all six KGs |
| **G-06 cause not atomic with result** | **STILL PRESENT (P0)** | Include all six → undo the sixth: total `6.480.000 €` → `5.990.000 €`, scope `6/6` → `5/6`, and the rail still asserted `KG 700 enthalten · + 490.000 €` |
| **G-07 no calculation stale/recovery** | **STILL MISSING (P0)** | `commercialResult()` hard-coded `status: 'ready'`; zero Retry controls in the product; `savePersistedProposal` returning `false` was discarded silently |
| **G-08 1280 is squeezed** | **STILL PRESENT (P0)** | Service workspace measured **515px** at 1280×800 against the ≥520px floor; the `max-width:1439px` rule restated the 1440 grid verbatim |
| **G-09 M-06 absent** | **STILL PRESENT (P0)** | `document.getAnimations()` returned `[]` at the sixth decision. M-07 was already correct (180ms replacement, no count-up) |

---

## 2 · The four corrections, measured

### G-06 · the commercial cause is atomic with the total

Two heterogeneous mutations, one recorded trace, on the ordinary path.

| Step | Total | Rail cause |
|---|---|---|
| A · baseline | `6.180.000 €` | — |
| B · include KG 500 | `6.480.000 €` | `KG 500 enthalten · + 300.000 € · KG 500` |
| C · **undo** | `6.180.000 €` | `Rückgängig · KG 500 enthalten · − 300.000 € · KG 500` |

BEFORE, step C left B's label standing beside a total that had moved the other way — the rail
asserted the opposite of the truth. AFTER, the undo explains itself with the reversed amount.

`evidence/before/1440/03-stale-cause-after-undo.png`, `03b-rail-stale-cause.png`
`evidence/after/1440/10-rail-cause-exclude-kg500.png`, `11-rail-cause-after-undo.png`

Three further rules, each proved by test in `src/screens/__tests__/konfigurator-recovery.dom.test.tsx`:
a mutation that cannot name a cause CLEARS the old one; a mutation that moves nothing leaves the
standing explanation alone; `commercialResultVersion` increments exactly when the total moves.

### G-07 · a failed calculation keeps the last trusted total

Induced through the controlled mechanism the spec §15 requires (`window.__all3Fault.calculation(true)`,
non-production only, never a product control).

| State | Total on screen | Rail |
|---|---|---|
| trusted | `6.180.000 €` | normal |
| **calculation failed** | `6.180.000 €` — unchanged, never zero, never blank | `▲ LETZTER BELASTBARER STAND` + reason + `belastbar um 23:18` + **Erneut versuchen** |
| retry, still failing | `6.180.000 €` | `… · 1 Versuche ohne Erfolg` — a failed retry says so |
| recovered | `6.180.000 €` | stale cleared; the causal line survives, because the outage did not change what the user decided |

`evidence/after/1440/20-rail-stale-last-trusted.png`, `21-rail-stale-retry-failed.png`, `22-rail-recovered.png`

A stale result is also refused as a client baseline (`clientProjectionValidFor`) and raised as a
blocking finding in Final Validation. Persistence failure is the same state with its own reason and
its own retry, and it keeps every decision.

### G-08 · 1280 is a recomposition, not a squeeze

| | 1440 × 900 | 1280 × 800 BEFORE | 1280 × 800 AFTER |
|---|---|---|---|
| service workspace | 605px | **515px** | **787px** |
| chapter context | 248px beside | 248px beside | full width, stacked above |
| latest cause in the rail | visible | y=759, rail bottom y=800 — below the fold | y=355–456, fully visible |
| horizontal page scroll | none | none | none |

The KG stage now gives up its side column first at 1280, exactly as VR3-04's schedule and review
already do at the same breakpoint; and the rail's causal line moved above the scope composition,
which is target K's own order.

### G-09 · M-06 resolves the sixth decision

Live MutationObserver trace at the sixth decision:
`unlock ×6` (every included cost group in the journey) · `m06:P.a3-ledger-progress` (the n/6 counter) ·
`m06:TR` (the row that completed the set).

Computed style at the mark, read in the browser:

| element | animation | duration | iterations | contract |
|---|---|---|---|---|
| completing row | `a3-m06-row` | `0.12s` | 1 | ≤ 160ms |
| `6/6 entschieden` | `a3-m06-count` | `0.2s` | 1 | ≤ 220ms |
| unlocked KG step | `a3-m06-unlock` | `0.2s` | 1 | ≤ 220ms |

Focus stayed on the changed radio. The polite announcement fired. Under
`prefers-reduced-motion: reduce` all three durations read `0s` with the same marks, the same end
state, the same focus and the same announcement.

---

## 3 · Out-of-register findings, fixed here and named as such

Neither is in the VR3-03A register — the audit never reloaded the page and never blocked storage.
Both were unavoidable to the evidence this ticket demands.

1. **A reload made the recovered Konfigurator unreachable.** Restore hard-coded
   `opportunityId: PROPOSAL_PROJECT_ID` (the legacy single-demo id) while VR3-03 keys the KG
   catalogue by the fixture project. After any reload `kgCatalogue()` resolved to `null`,
   `hasKgConfiguration` went false with all six decisions still stored, and every cost group
   reported itself blocked with the self-contradicting reason *"Erst 6 von 6 Kostengruppen sind
   entschieden."* — this ticket's own defect class. The payload now carries the owning project;
   payloads written before the fix still restore under the previous id.
2. **A blocked storage backend failed silently.** `savePersistedProposal` returned `false` and the
   subscriber discarded the result. It now surfaces as an unsaved state with a retry, and every
   decision is preserved.

---

## 4 · VR3-04 regression replay — Project A

Full chain, ordinary path, against the recovered Konfigurator.

| Stage | Outcome |
|---|---|
| six KG configurations | all `✓ VOLLSTÄNDIG` |
| Schedule gate | `blockiert` until the sixth KG completed, then `ausstehend` — it opens on the predicate, not on a visit |
| Terminplan bestätigen | confirmed |
| Finale Prüfung | 7/7 sections reviewed, `Zusammensetzung ✓ STIMMT MIT DER SUMME ÜBEREIN`, no stale finding |
| Option speichern | `Option 2 ist kundenbereit.` · `Gespeichert am 03.09.2026 · 21:36` |
| total at save | **`Gesamt netto · Grundleistung All3 · 6.480.000 €`** — same value, same meaning (full total, not subtotal), same uncertainty, not STALE |
| Client Mode | `✓ KUNDENMODUS FREIGESCHALTET`, control enabled |

`evidence/after/1440/40-schedule.png`, `41-final-validation.png`,
`70-final-validation-reviewed.png`, `71-saved-client-mode-unlocked.png`

**One item I could not complete in automation and am not claiming:** switching the view radio into
Kundenansicht did not register through the driver in this session (ref, label, and coordinate clicks
all left `Vorbereitung` selected). The unlock PREDICATE is proven — the receipt states
`KUNDENMODUS FREIGESCHALTET`, the control reports `disabled: false`, and VR3-04's own
`final-validation.dom.test.tsx` case *"creates one named, versioned, immutable snapshot and unlocks
Client Mode"* passes on this candidate. QA should confirm the switch by hand.

**Project B (`DEMO-COMPLEX-01`) was not replayed in the browser** in this pass. It is covered by the
DOM suites, which run against it by default (`reachLedger(user, 'DEMO-COMPLEX-01')`), including all
eleven new VR3-03R cases. QA owns the second-fixture browser replay.

---

## 5 · Six-KG setup, as required

`KG200_ACTIVE=true · KG300_ACTIVE=true · KG400_ACTIVE=true · KG500_ACTIVE=true · KG600_ACTIVE=true · KG700_ACTIVE=true`

Each page reached individually through the workflow spine — no deep routes.

| KG | title | service groups | rows | workspace @1280 | images |
|---|---|---|---|---|---|
| 200 | Vorbereitende Maßnahmen | 1 | 4 | 787px | 0 |
| 300 | Baukonstruktion | 2 | 5 | 787px | 0 |
| 400 | Technische Anlagen | 2 | 5 | 787px | 0 |
| 500 | Außenanlagen | 1 | 5 | 787px | 0 |
| 600 | Ausstattung | 1 | 4 | 787px | 0 |
| 700 | Baunebenkosten | 2 | 7 | 787px | 0 |

Same-crop captures for the blind grammar test: `evidence/after/1440/kg{200,…,700}-1440.png`
and `evidence/after/1280/kg{200,…,700}-1280.png`.

An excluded group stays visible and intentional: KG 500 read `übersprungen` in the journey while
excluded, with its own surface stating the decision and the route back.


---

## 6 · Re-verification against the exact candidate runtime

Everything in §2 was first measured on the working tree; the project's pre-commit gate then
required the candidate to move into an isolated task worktree, so all of it was replayed against
the committed candidate on port 5198. Findings that only appeared there are recorded here, because
a remediation that hid the defects its own fix introduced would be the false-pass class this
programme exists to end.

| Check | Result on the candidate |
|---|---|
| M-06 | `unlock ×6` · `m06:P` (counter) · `m06:TR` (completing row) · focus stayed on the changed radio |
| M-06 timings | `a3-m06-row 0.12s ×1` · `a3-m06-count 0.2s ×1` · `a3-m06-unlock 0.2s ×1`; all `0s` under reduced motion |
| causality | include KG 500 → `6.180.000 €` → `6.480.000 €`, cause `KG 500 enthalten · + 300.000 €`; undo → `6.180.000 €`, cause `Rückgängig · KG 500 enthalten · − 300.000 €` |
| stale | total held at `6.080.000 €`, `▲ LETZTER BELASTBARER STAND`, `belastbar um 23:56`, Retry present |
| retry while failing | `1 Versuche ohne Erfolg` — a failed retry does not look like the first |
| recovery | `fault:false · status:ready · reason:null · attempts:0`, total unchanged |
| 1440 | workspace 605px, context beside it (`ctxTop == svcTop`), no horizontal scroll |
| 1280 | workspace **787px**, context stacked above (`ctxTop 317` / `svcTop 557`), no horizontal scroll |

### Two defects the candidate runtime exposed in this remediation's own work

Both were found by using the failure mechanism the ticket demanded, and both are fixed in the
candidate rather than reported as residue.

1. **The guarded reader crashed the app.** The trusted snapshot was store state written only by the
   journal door, so a failure arriving before the first journalled commit found nothing to fall back
   on and rethrew — a white screen, the one outcome the whole state exists to prevent. It is now a
   read-through cache of the pure selector, warmed by the app's own first render.
2. **The failure door lost its store under HMR.** Registered from `main.tsx`, which imports the
   store, the handle could end up holding an instance the React tree no longer rendered from:
   injecting a fault silently did nothing. It now lives beside the store it perturbs.

### The failure mechanism, for QA and Acceptance

```
window.__all3Fault.calculation(true)    // induce a calculation failure
window.__all3Fault.calculation(false)   // recover
window.__all3Fault.trust()              // read the verdict, rather than inferring it from pixels
```

Dev-only; `setCommercialFault` refuses to run in a production build and the handle is not
registered there. The rail must be on screen to observe the state — inject, then navigate to a
Konfigurator surface if you are not already on one.
