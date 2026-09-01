# Visual Authority Manifest — Visual Recovery source of truth

**Owner:** Git Provenance & Recovery (GIT-RECOVERY-01)
**Scope:** repository provenance and durability of the Visual Recovery authority set.
**This is not a product requirements document.** It says which files define visual
target truth, where they came from, and what may never happen to them again. What
the targets *mean* for the product is owned by the VO-T1 handoff and the V2
programme reports listed below.

---

## 1. Why this file exists

The approved VO-T1 target artefacts were never present in ordinary `origin/master`
history. They existed only inside a WIP rescue commit created before the VR2-00
release, which normal branch and worktree cleanup does not protect. During VR2-03
the Frontend engineer independently rediscovered the loss and hand-restored four
PNGs into the task line — one task's worth of the same archaeology that VR2-04,
VR2-05 and VR2-06 would each have repeated.

GIT-RECOVERY-01 recovered the **complete** approved set from that historical state,
byte for byte, and made it durable in `origin/master`. The loss is now closed for the
whole programme, not for one task.

**Recovery source (single legitimate historical origin):**

| Field | Value |
|---|---|
| Source commit | `966c8333a6241ee9484654636efab441e2dbb472` |
| Source commit subject | `WIP rescue: preserve dirty main state before VR2-00 release` |
| Source ref | `refs/archive/git-01/rescue-main-dirty-20260829-1240` |
| Approval evidence | `vo-t1-targets.html` masthead: Design Director **TARGETS APPROVED**, Product Owner **TARGET DIRECTION APPROVED** |
| Runtime provenance recorded on the board | release SHA `9ae1c050e731824329ba107c6f0696a504b6ab74` |

Every `TARGET-*.png` filename resolves to **exactly one blob** across every ref,
tag, archive ref, reflog and reachable object in this repository. There is no
competing approved version and nothing was chosen between.

---

## 2. Authoritative paths

| Role | Path |
|---|---|
| Approved target directory | `artifacts/visual-outcome-audit-18e7d71/vo-t1/targets/` |
| Target approval board | `artifacts/visual-outcome-audit-18e7d71/board/vo-t1-targets.html` |
| Current-vs-Target board | `artifacts/visual-recovery-audit-v2/board/current-vs-target.html` |
| Target render source | `artifacts/visual-outcome-audit-18e7d71/vo-t1/target-source.html` |
| VO-T1 handoff (approval prose) | `artifacts/visual-outcome-audit-18e7d71/vo-t1/vo-t1-handoff.md` |
| This manifest | `artifacts/visual-recovery/VISUAL_AUTHORITY_MANIFEST.md` |

Both boards were restored to their **proven historical canonical paths**. No new
board path was invented and no duplicate target directory was created.

---

## 3. Classification — what defines target truth

| Category | Artefacts | Defines visual target truth? |
|---|---|---|
| `APPROVED_TARGET_AUTHORITY` | the 34 `TARGET-*.png` files | **Yes — only these** |
| `PROGRAMME_NAVIGATION_BOARD` | `vo-t1-targets.html`, `current-vs-target.html` | No — they *present* authority |
| `HISTORICAL_BEFORE_EVIDENCE` | `VO-T1-CURRENT-9ae1c05-*.png` (32) | No |
| `CURRENT_MAIN_EVIDENCE` | `artifacts/visual-recovery-audit-v2/current/*.png` (24) | No |
| `TASK_CANDIDATE_EVIDENCE` | `VR2-0x/candidate*/`, `qa-*`, `acceptance-*` screenshots | No — never |
| `RECOVERY_PROVENANCE` | `target-source.html`, `render-board.js`, `assets/`, this manifest | No |

### Standing rules

1. **Only `APPROVED_TARGET_AUTHORITY` defines the visual target.** A Current
   screenshot must never silently become an approved target.
2. **A task candidate screenshot is never target authority.** Passing QA on a
   candidate does not promote that candidate's pixels to the target set.
3. **No task agent may regenerate, resize, recompress, re-export or re-screenshot a
   target artefact.** The approved pixels are the authority. If a target looks
   wrong, that is a Product decision, not an implementation detail — stop and
   escalate. Reconstruction requires explicit Product authorisation.
4. **Target artefacts must survive task cleanup.** They live in `origin/master`, not
   in a task branch, a worktree, `/tmp`, or a rescue ref. Deleting any task branch or
   worktree must never remove them again.
5. **Boards must stay repository-relative.** No canonical artefact may reference an
   absolute path, `/tmp`, `.task/`, `.worktrees/`, a deleted worktree, or a
   localhost-only resource.

---

## 4. Approved target inventory — 34 files, 17 families

Families: `building`, `comparison`, `config-long`, `config-short`, `offer`, `opportunities`, `present-commercial`, `present-identity`, `present-next`, `present-options`, `present-scope`, `present-timeline`, `project`, `send-delivered`, `send-review`, `surfaces`, `workspace`

`sourceBlobSha` is the blob in `966c8333`; `restoredBlobSha` is the blob now tracked
in `origin/master`. Equality of the two **is** the byte-identity proof — Git blob
identity is content identity.

| Target file | sourceBlobSha | restoredBlobSha | byteIdentical | Status |
|---|---|---|---|---|
| `TARGET-building-1280.png` | `6c7da9297ba1` | `6c7da9297ba1` | yes | already in origin/master |
| `TARGET-building-1440.png` | `8234f84e08ab` | `8234f84e08ab` | yes | already in origin/master |
| `TARGET-comparison-1280.png` | `a5ece64bd50d` | `a5ece64bd50d` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-comparison-1440.png` | `23cc2047a950` | `23cc2047a950` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-config-long-1280.png` | `24a42afeb126` | `24a42afeb126` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-config-long-1440.png` | `a758da28657e` | `a758da28657e` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-config-short-1280.png` | `0d7ab27698b3` | `0d7ab27698b3` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-config-short-1440.png` | `17c135087104` | `17c135087104` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-offer-1280.png` | `5187720c83b9` | `5187720c83b9` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-offer-1440.png` | `2e14bfd55288` | `2e14bfd55288` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-opportunities-1280.png` | `d8f891bf5be7` | `d8f891bf5be7` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-opportunities-1440.png` | `3323c88a6e88` | `3323c88a6e88` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-commercial-1280.png` | `73b4e8e9fcc1` | `73b4e8e9fcc1` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-commercial-1440.png` | `8fbcedcc4253` | `8fbcedcc4253` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-identity-1280.png` | `dc5ad5a24246` | `dc5ad5a24246` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-identity-1440.png` | `89478847d5dc` | `89478847d5dc` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-next-1280.png` | `7c84d6057655` | `7c84d6057655` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-next-1440.png` | `6fcae2b95027` | `6fcae2b95027` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-options-1280.png` | `538751cff1f8` | `538751cff1f8` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-options-1440.png` | `5cb028ca6c25` | `5cb028ca6c25` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-scope-1280.png` | `c315e9cf2cd5` | `c315e9cf2cd5` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-scope-1440.png` | `235e2f94d9fc` | `235e2f94d9fc` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-timeline-1280.png` | `57013afa84c6` | `57013afa84c6` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-present-timeline-1440.png` | `69acbeab03da` | `69acbeab03da` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-project-1280.png` | `c91e0721b687` | `c91e0721b687` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-project-1440.png` | `3f3658dc0c41` | `3f3658dc0c41` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-send-delivered-1280.png` | `1de16410af75` | `1de16410af75` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-send-delivered-1440.png` | `7bc40e0c2c4e` | `7bc40e0c2c4e` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-send-review-1280.png` | `05357287f22b` | `05357287f22b` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-send-review-1440.png` | `01d66caad2f9` | `01d66caad2f9` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-surfaces-1280.png` | `254416d72ef0` | `254416d72ef0` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-surfaces-1440.png` | `3ff6df6cdb73` | `3ff6df6cdb73` | yes | restored by GIT-RECOVERY-01 |
| `TARGET-workspace-1280.png` | `caab5ba53515` | `caab5ba53515` | yes | already in origin/master |
| `TARGET-workspace-1440.png` | `e655bf30ba09` | `e655bf30ba09` | yes | already in origin/master |

The four `workspace` / `building` files were already restored into `origin/master` by
VR2-03's commit `28e20c401525799777b79816d2baf5f13ab60fb1`; they are listed here
because this manifest is the inventory of the whole set, and they are confirmed
byte-identical to the same historical blobs.

### Relationship between the families

The 17 families are one continuous journey through the product, not a flat list:

- **`opportunities` → `project` → `workspace` → `building` → `config-long` /
  `config-short`** — the WORK shell: portfolio entry, project card, evidence and
  conflict resolution, building scope, then configurator chapters.
- **`comparison`** — the COMPARE shell: one semantic option matrix.
- **`present-identity` → `present-scope` → `present-commercial` →
  `present-timeline` → `present-options` → `present-next`** — the PRESENT shell,
  in narrative order.
- **`offer` → `send-review` → `send-delivered`** — the commercial climax and
  delivery lifecycle.
- **`surfaces`** — a static governance specimen for the surface model.

Every family exists at both `1440 × 900` and `1280 × 800`. The 1280 frame is
**composed**, not a fit test: it is an approved composition in its own right and may
not be treated as "the 1440 target, narrower".

---

## 5. Board HTML

| File | sourceBlobSha | restoredBlobSha | byteIdentical |
|---|---|---|---|
| `artifacts/visual-outcome-audit-18e7d71/board/vo-t1-targets.html` | `9c332cc35b29` | `9c332cc35b29` | yes |
| `artifacts/visual-recovery-audit-v2/board/current-vs-target.html` | `36885f4d129d` | `36885f4d129d` | yes |

`vo-t1-targets.html` and `current-vs-target.html` are **different programme views**,
not the same board renamed and not one wrapping the other:

- **`vo-t1-targets.html`** is the *target approval* board. Two columns —
  CURRENT/BEFORE against TARGET — across all 17 families, plus the 1280 composition,
  per-family implementation-authority annotations, motion storyboards and the
  approval gate. This is where a target's intent is stated.
- **`current-vs-target.html`** is the *recovery tracking* board. Three columns —
  Before, Approved target, Current — across the 8 journeys the V2 programme is
  recovering. This is where the remaining gap is read.

Both are self-contained static HTML with repository-relative references only. Their
fonts resolve to the tracked `design-system/fonts/visuelt-*-pro.woff2`.

**Verified by rendering both boards from a clean checkout:**

- `vo-t1-targets.html` — 17 target cases, 17 specification panels, 17 CURRENT
  frames, 17 targets at 1440, 17 targets at 1280, 8 motion storyboards,
  **0 missing images**.
- `current-vs-target.html` — 8 comparison cases, 24 images, **0 missing images**,
  captions `Before` / `Approved target` / `Current` present and distinct.

---

## 6. Recovery provenance and board tooling

| File | sourceBlobSha | restoredBlobSha | byteIdentical |
|---|---|---|---|
| `artifacts/visual-outcome-audit-18e7d71/vo-t1/assets/nordfeld-hero.png` | `41d9ccf8243c` | `41d9ccf8243c` | yes |
| `artifacts/visual-outcome-audit-18e7d71/vo-t1/render-board.js` | `3c329fc9d480` | `3c329fc9d480` | yes |
| `artifacts/visual-outcome-audit-18e7d71/vo-t1/target-source.html` | `6fff0e43f82c` | `6fff0e43f82c` | yes |
| `artifacts/visual-outcome-audit-18e7d71/vo-t1/vo-t1-handoff.md` | `f9c33c066dec` | `f9c33c066dec` | yes |

`render-board.js` received the **only** content change in this recovery. The
historical script hard-coded an absolute path under the original author's home
directory, which is exactly the class of dependency this manifest forbids. It now
derives the artefact root from its own module location.

```
originalHtmlSourceBlob = (n/a — HTML boards were not modified)
pathRepairs            = 1 (artifacts/visual-outcome-audit-18e7d71/vo-t1/render-board.js: absolute machine path -> module-relative)
visualAuthorityChanged = false
targetImagePixelsChanged = false
```

No HTML board needed repair: both were already fully repository-relative.

---

## 7. Programme documentation

| File | sourceBlobSha | restoredBlobSha | byteIdentical |
|---|---|---|---|
| `artifacts/visual-recovery-audit-v2/README.md` | `c156c122f5cd` | `c156c122f5cd` | yes |
| `artifacts/visual-recovery-audit-v2/design-system-consumption.md` | `bfbe23f68833` | `bfbe23f68833` | yes |
| `artifacts/visual-recovery-audit-v2/executive-summary.md` | `f4682a442cc2` | `f4682a442cc2` | yes |
| `artifacts/visual-recovery-audit-v2/findings-report.md` | `e464e3ee545b` | `e464e3ee545b` | yes |
| `artifacts/visual-recovery-audit-v2/root-cause-and-programme.md` | `fad2a3d67b2e` | `fad2a3d67b2e` | yes |
| `artifacts/visual-recovery-audit-v2/target-status-matrix.md` | `0a92bbe5d695` | `0a92bbe5d695` | yes |

`target-status-matrix.md` is the programme's per-journey target status index.
`findings-report.md` is the report `current-vs-target.html` points readers to for
state qualification and 1280 evidence.

---

## 8. Deliberately NOT recovered

These exist in `966c8333` and remain fully recoverable from
`refs/archive/git-01/rescue-main-dirty-20260829-1240`. They were excluded because
they are neither target authority nor a board dependency, and the recovery commit
scope is limited to what makes the authority set durable:

| Excluded | Reason |
|---|---|
| `AFTER-01..25-*.png`, `MOTION-*.webm` | Earlier VO-T1 after-evidence; referenced by neither recovered board |
| `VO-T1-board-top.png`, `VO-T1-board-motion.png` (both copies) | Screenshots *of* the board; regenerable by `render-board.js` |
| `board/blink-test.html` | Separate R1–R4 diagnostic on an unrelated visual language; depends on external Google Fonts CDN |
| `VO-T1-CURRENT-opportunities-*.png`, `VO-T1-CURRENT-project-1440.png` | Unlabelled duplicates of the provenance-tagged `9ae1c05` blobs |
| `VR2-00/README.md`, `VR2-00/candidate/*` | `TASK_CANDIDATE_EVIDENCE`, superseded by `VR2-00/candidate-c/` already in master |

If a later task proves one of these is programme authority, recover it from the
archive ref above — do not re-create it.

---

## 9. Related recovery refs — do not delete

| Ref | Commit | Why it must stay |
|---|---|---|
| `refs/archive/git-01/rescue-main-dirty-20260829-1240` | `966c8333a6241ee9484654636efab441e2dbb472` | The origin of every artefact in this manifest |
| `refs/archive/git-recovery-01/vr2-03-cycle12-evidence-dangling` | `d23a66f9b6cd6e8d61c806e96b331dcf03690e2f` | Unreachable VR2-03 cycle-12 evidence commit found during this recovery and anchored so reflog expiry cannot destroy it. Not part of this recovery's scope — it is VR2-03's to reconcile. |

Removing either ref requires a separate, explicit cleanup task.
