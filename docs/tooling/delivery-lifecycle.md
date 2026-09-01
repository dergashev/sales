# The canonical delivery lifecycle

Repository-owned tooling under `tools/delivery/`, `tools/runtime/`,
`tools/worktrees/`, `tools/gate/` and `tools/git-hooks/`. This document
describes the end-to-end lifecycle DELIVERY-INFRA-01 hardened: a new
Product implementation task must be able to start from a clean repository
and receive a deterministic preflight result proving repository/runtime
safety, before any Product-code edit — without depending on a delivery
agent correctly remembering worktree/branch/provenance rules by hand.

This is delivery infrastructure only. It does not change Sales Platform
product behavior, and it does not replace
`docs/tooling/worktree-lifecycle-and-local-main-preview.md` (the local
`main`-preview mechanics) or `tools/gate/`'s own exact-candidate machine
validation gate — it composes them.

## 1. Release authority resolution

**One** canonical resolver: `tools/runtime/lib/release-branch.mjs`
(`resolveCurrentMainAuthority` / `resolveReleaseBranch` /
`resolveReleaseSha`). Every lifecycle tool that needs to know "what is the
authoritative release branch/commit right now" calls into this module —
`runtime:main`, `runtime:status`, `runtime:task-base`,
`tools/delivery/preflight.mjs`, `tools/worktrees/dev-main.mjs`,
`tools/worktrees/check.mjs`, and `tools/browser-agent/*`. None of them
hard-code a literal branch name.

Resolution order:

1. `A3_RELEASE_BRANCH` env override, if set.
2. `git symbolic-ref --short refs/remotes/origin/HEAD` — origin's own
   recorded default branch, when an `origin` remote is configured. If an
   origin exists but this cannot be resolved (a shallow/partial clone),
   resolution fails EXPLICITLY rather than falling through to a guess.
3. Only when NO `origin` remote is configured at all: a local branch
   literally named `main`, then `master` (checked for real existence, not
   assumed), then the currently checked-out branch — this is the fallback
   for a genuinely standalone/hermetic repository (e.g. a test fixture),
   and it never overrides real origin-HEAD evidence when an origin exists.

In this repository today that resolves to `origin` / `master` /
whatever SHA `origin/master` currently points at — there is no remote
`main` at all, and a stale/divergent local `main` (or `master`) branch
plays no role whatsoever in the resolution. The mechanism stays correct
unchanged if the authoritative branch name ever changes.

`resolveReleaseSha` additionally prefers the remote-tracking ref
(`origin/<branch>`) over a same-named LOCAL branch, because a local branch
that has drifted from its remote-tracking counterpart is exactly the
"stale local main" failure mode this resolver exists to prevent.

## 2. Isolated task worktree

Product implementation happens inside an isolated `git worktree`, never
directly in the root release checkout:

```
git worktree add .worktrees/<task-id> -b task/<task-id> <authoritative-release-commit>
```

`<authoritative-release-commit>` comes from step 1 above, resolved fresh —
never a SHA copied out of ticket prose.

## 3. Canonical task preflight — `npm run delivery:preflight -- <task-id>`

`tools/delivery/preflight.mjs`. Run from inside the task worktree (or pass
`--worktree <path>`), before the first Product-code edit. Composes the
existing canonical mechanisms — it does not re-implement any of them:

- release authority (§1);
- the ROOT RELEASE CHECKOUT hard gate (§4) — refuses outright when run
  from the root checkout;
- the task's registration as a real `git worktree` entry;
- task-base freshness/pinning, via the SAME exact-candidate manifest and
  the SAME `planTaskBasePreflight` decision table `runtime:task-base`
  already uses (`tools/runtime/lib/preflight.mjs`,
  `tools/gate/lib/manifest.mjs`) — auto-declaring a candidate entry for a
  brand-new task id so a first-ever preflight never needs a separate
  `gate:declare` step first.

Successful output is machine-detectable:

```
DELIVERY PREFLIGHT: READY

taskId=<task-id>
authoritativeRemote=origin
authoritativeReleaseBranch=master
authoritativeReleaseCommit=<sha>
rootCheckoutPath=<path>
rootCheckoutBranch=master
rootCheckoutCommit=<sha>
rootCheckoutClean=true|false
taskWorktreePath=<path>
taskBranch=task/<task-id>
taskBaseCommit=<sha>
taskWorktreeCommit=<sha>
taskWorktreeClean=true|false
runtimeMode=TASK_CANDIDATE
runtimeCommit=<sha>
provenanceMatch=true

READY_FOR_IMPLEMENTATION=true
```

Any blocking condition prints `DELIVERY PREFLIGHT: BLOCKED` with a
`reason=` line, the fields resolved so far, and exits non-zero (`2`
provenance/freshness/root-checkout block, `3` a git/lifecycle failure) —
**no repository state is modified** on a blocked run.

## 4. Root release checkout protection

`tools/delivery/root-guard.mjs` (`checkRootCheckoutGuard`) is the shared
decision logic behind two independent enforcement points:

- **`delivery:preflight` ('preflight' mode)** — the hard gate: refuses
  unconditionally the moment this command is run from the root checkout,
  before any Product-code modification, regardless of whether anything is
  dirty yet.
- **the `pre-commit` hook ('commit' mode, §9)** — the retroactive
  backstop at commit time: only blocks when the actual staged change set
  contains a Product-owned path (`src/`, `design-system/`,
  `docs/product/`, `docs/audit/`) while sitting in the root checkout.
  Delivery-infra/doc commits from the root checkout, and the Release &
  Integration Engineer's own fast-forward integration (which does not
  create a new commit at all, so the hook never even runs), keep working.

## 5. Candidate / QA / CURRENT_MAIN runtime identities

Three distinct runtime purposes, `tools/runtime/main.mjs`
(`npm run runtime:*`):

- **`runtime:candidate --purpose TASK_CANDIDATE|REVIEW_CANDIDATE`** —
  pinned to the caller's own worktree HEAD; never silently advances to a
  newer release commit.
- **`runtime:main`** — resolves/rotates/starts `CURRENT_MAIN`, through the
  §1 resolver.
- **`runtime:preflight --expected-purpose <P> --expected-sha <sha> --url <url>`**
  — the shared "is this URL actually serving what I expect" gate every
  browser-capable consumer runs before treating a runtime's evidence as
  authoritative. A runtime is never accepted merely because it responds —
  its own `/__runtime.json` echo (purpose + sha + nonce) must match.

`runtime:status` is the non-mutating diagnostic across all of the above —
prints `SERVING_VERIFIED` / `STALE` / `DRIFTED` / `DEAD` / `UNVERIFIED` for
every registered claim, never writes anything.

Required invariant everywhere: `runtimeCommit == intendedCommit`. A
mismatch fails closed (`provenanceMatch=false` / exit `2`), never a soft
warning.

## 6. Pre-QA freshness check

`npm run delivery:preflight -- pre-qa --task-id <task-id>`
(`tools/delivery/pre-qa-freshness.mjs`, `checkPreQaFreshness`). Before QA
starts on a declared candidate, re-resolves the authoritative release
commit FRESH (never cached) and compares it against the candidate's own
pinned `taskBaseCommit`:

- unchanged → `remoteAdvanced=false`, `reconciliationRequired=false`, QA
  proceeds;
- advanced, but the candidate's own history already contains every new
  authoritative commit → `reconciliationRequired=false`, QA proceeds;
- advanced, and the candidate does not contain that work →
  `reconciliationRequired=true`. **QA must not proceed on this candidate**
  — implementation reconciles (never a silent rebase/merge performed by QA
  itself), produces a NEW candidate SHA, and the new candidate re-enters
  validation from Acceptance/QA as required.
- ancestry cannot be established at all → fails closed
  (`reconciliationRequired=null`, exit `3`).

## 7. Candidate immutability across gates

Once a candidate SHA enters Acceptance/QA, every downstream gate must
operate on that EXACT SHA:
`implementationCommit == acceptanceTargetCommit == acceptanceActualCommitAudited
== qaTargetCommit == qaActualCommitTested == releaseCandidateCommit`. Any
unexplained mismatch is `BLOCKED` — never inferred from a branch name.
`tools/gate/lib/resolve-candidate.mjs` (`resolveCandidate`) already
enforces this at the machine-validation-gate level: it refuses when a
worktree's actual HEAD does not equal the manifest's declared `sha` for
that lane, rather than silently validating whatever happens to be checked
out. If an implementation changes the candidate after Acceptance approved
an earlier SHA, that earlier approval does not carry forward — the new SHA
re-declares (`gate:declare`) and re-enters Acceptance/QA.

## 8. `.agentsroom/**` ownership boundary

`tools/delivery/agentsroom-guard.mjs` (`checkAgentsRoomGuard`), enforced by
the `pre-commit` hook (§9). Any `git commit` that stages a path under
`.agentsroom/` is refused — that directory is the AgentsRoom desktop app's
own runtime/session/routing state, written directly to disk by the app
itself, entirely outside any delivery agent's `git` workflow. A delivery
agent never legitimately needs to `git add`/`git commit` a path there.

**Deliberate, human-instructed exception**: set
`A3_ALLOW_AGENTSROOM_COMMIT=1` for that one commit. Never set by a
delivery agent unilaterally deciding its own commit qualifies.

**Documented platform boundary** (the ticket's own required disclosure —
"if technical enforcement cannot fully prevent the write due to platform
limitations, implement all enforceable repository-side protections and
document the remaining platform boundary precisely"): this is a **git
commit-time** guard. It cannot stop an editor tool from writing bytes to a
path under `.agentsroom/` before any `git add`/`git commit` happens, and it
does not run at all for a commit made with `--no-verify` or through a
client that bypasses `.git/hooks` entirely. Those two gaps are outside what
repository-level tooling can enforce; the durable backstop for them remains
the prompt-level prohibition (see the AgentsRoom etiquette file) plus the
fact that `.agentsroom/**` is regenerated by the app on its own schedule
regardless of what a stray local edit contains.

## 9. The `pre-commit` hook

`tools/git-hooks/pre-commit-check.mjs`, installed by
`tools/git-hooks/install.mjs` into `<git-common-dir>/hooks/pre-commit` —
**shared by every linked worktree of this repository** (hooks are not
per-worktree), so installing once covers all of them, including ones
created later. Wired to the npm `prepare` lifecycle script
(`package.json`), so a fresh `npm install`/`npm ci` installs it
automatically; run `npm run git-hooks:install` explicitly for an existing
checkout that installed its dependencies before this ticket, or to
reinstall after a manual edit under `.git/hooks/`.

Runs two independent guards (§4 commit-mode, §8) on every commit. Both
**fail OPEN** on a tooling error they cannot diagnose (e.g. `git diff
--cached` itself fails) — an infrastructure guard must never become a hard
blocker for every future commit over a problem it cannot explain — and
**fail CLOSED** on their own actual trigger condition.

## 10. Release integration

Unchanged from the existing Release & Integration Engineer flow — this
ticket does not weaken it. Normal integration remains fast-forward-first
(`git merge --ff-only <candidate>`); Release independently re-verifies
fresh remote SHA, exact accepted/QA-tested candidate SHA (§7), ancestry,
and release-checkout cleanliness before touching the authoritative branch,
then re-establishes `CURRENT_MAIN` through the canonical runtime tooling
(§5) and verifies its SHA equals the just-released SHA. A fast-forward
merge creates no new commit, so the `pre-commit` hook never runs for it —
Release retains its full authorised path (fetch, verify, integrate, push,
verify remote, post-release checks) unmodified.

## 11. Cleanup

`npm run release:worktree:cleanup` (temporary Release Integration
worktree) and ordinary `git worktree remove` for a finished task worktree
— see `docs/tooling/worktree-lifecycle-and-local-main-preview.md` for the
exact decision table (locked/prunable/dirty handling). Cleanup never
deletes unverified unknown state merely because a release completed: a
dirty or locked worktree is reported and refused, not force-removed,
unless the caller explicitly opts in (`--force` / `--unlock`).

## 12. Unknown dirty state

Every lifecycle tool in this document shares the same discipline
(`tools/gate/lib/git-worktrees.mjs`'s `dirtyEntries`, and every decision
table built on it): unexpected dirty/unknown state is **reported**, never
silently reset/cleaned/stashed/discarded. `git status --porcelain` failing
outright is a distinct LIFECYCLE failure from "worktree is dirty" — the
former means the checkout itself could not be inspected; the latter means
it could, and something uncommitted is there. Neither is ever resolved by
guessing.

## Known platform boundary — CASE I (saved provider session missing on rework loop)

DELIVERY-INFRA-01's own ticket names a scenario where a downstream gate
routes a task back to Frontend, AgentsRoom holds a stored provider-session
ID, and that session no longer exists. Correct handling (do not drop into
an unbound raw CLI session; do not silently resume a different session;
preserve task/worktree/candidate/handoff; either rebind a new
correctly-Team-bound session with reconstructed context, or fail explicitly
as `TEAM_RUNNER_BINDING_BLOCKED`) is **AgentsRoom desktop-app session/
provider-binding behavior**, not repository tooling — it lives entirely
outside this Product repository's `tools/` tree, in the AgentsRoom
application itself. Per this repository's own operating rules (never patch
the app's own MCP servers/runtime from inside a Product repository), this
scenario is documented here as a known, out-of-scope platform boundary
rather than "fixed" by tooling that cannot reach it. Everything this
document's own tooling CAN guarantee on its side of that boundary — exact
task/worktree/candidate identity surviving a rework loop via the manifest
in `tools/gate/lib/manifest.mjs`, never silently mutated — is already
covered by §7.
