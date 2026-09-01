# Worktree lifecycle and the canonical local-main preview

Repository-owned tooling under `tools/worktrees/`. Solves two related
operational problems:

1. a temporary Release Integration worktree can be left registered by Git
   after its directory is gone, and normal cleanup does not always resolve
   it;
2. there was no single, provenance-proving way to answer "where can I open
   the latest accepted local `main`?" without guessing, without switching
   the caller's own checkout, and without depending on a Release worktree
   surviving.

This is delivery infrastructure only. It does not change Sales Platform
product behavior.

See `docs/tooling/delivery-lifecycle.md` for the full canonical delivery
lifecycle this tooling is one part of (task preflight, isolated-worktree
enforcement, candidate/QA/release provenance, `.agentsroom/**` protection).

## Root cause (read this before touching the cleanup logic)

The reported symptom was: a Release Integration worktree's directory
disappeared, `git worktree prune` did not resolve the stale registration,
and Git kept reporting `main` as checked out there.

A bare `git worktree prune` resolves BOTH of the following immediately, no
extra flag needed:

- a registered worktree whose directory was fully deleted;
- a registered worktree whose directory exists but whose own `.git` link is
  gone.

Neither shape is the actual bug (an earlier draft of this document assumed
the second one was — it is not; verified against real Git 2.39.3).

The actual mechanism: a worktree that was `git worktree lock`ed survives
**both** `git worktree prune` (even `--expire now`) **and**
`git worktree remove` indefinitely, however long its directory has been
missing. This is Git's own protection against removing a worktree mid-use,
not a defect. If something locks the Release Integration worktree for the
duration of a run and the workspace is later deleted without an `unlock`,
this is exactly the stuck state the incident describes. The only supported
recovery is `git worktree unlock` followed by the normal prune/remove —
never manual edits under `.git/worktrees/*`, and never raw directory
deletion.

Git also never computes a `prunable`/dirty verdict for a locked entry at
all (its porcelain record carries no `prunable` line even when the
directory is gone). `tools/worktrees/lib/worktree-lifecycle.mjs` and
`tools/worktrees/release-cleanup.mjs` account for this explicitly: an
`--unlock` run always re-lists the worktree fresh after unlocking and
re-decides the action from that fresh state — it never guesses the
post-unlock outcome from the pre-unlock snapshot.

## Commands

### `npm run dev:main`

Opens the current, exact AUTHORITATIVE RELEASE in a browser-ready dev
server, without ever touching the caller's own branch/worktree. The
command name is retained for backwards compatibility only — it does
**not** imply the Git branch must be called `main` (DELIVERY-INFRA-01; see
`docs/tooling/delivery-lifecycle.md` for the full canonical lifecycle).

1. Resolves the authoritative release branch/SHA through the ONE canonical
   resolver, `tools/runtime/lib/release-branch.mjs`
   (`resolveCurrentMainAuthority`) — never a literal `git rev-parse main`,
   and never derived from the invoking directory's own branch, from a
   worktree's name, or from "most recently used". This repository's actual
   authority is `origin/master` (there is no remote `main` at all); a
   stale/divergent local `main` or `master` branch plays no role
   whatsoever in the resolution.
2. Creates or refreshes a **detached** worktree at `.preview/main` (override
   with `A3_PREVIEW_DIR`). Detached, so it never competes for ownership of
   the `main` branch — `git worktree add --detach` succeeds even while
   another worktree (e.g. `release-integration`) owns `main` at that same
   moment.
3. If the preview is dirty and `main` has since moved: refuses (exit 2) and
   never discards the uncommitted work.
4. Installs dependencies only when needed (missing `node_modules`, or the
   committed lockfile changed since the last refresh).
5. Re-verifies `PREVIEW HEAD == MAIN SHA` one more time, prints the
   provenance block below, then serves `npm run dev` from that exact
   worktree on a free local port.

```
LOCAL MAIN PREVIEW

MAIN SHA:
<full sha>

PREVIEW SHA:
<full sha>

WORKTREE:
<path>

DIRTY:
false

URL:
http://127.0.0.1:<port>
```

If provenance cannot be established, the command fails visibly (exit 2 or
3) rather than silently serving something else.

### `npm run git:worktrees:check`

Read-only diagnostic. Reports every registered worktree (path, SHA,
branch/detached, locked/prunable/dirty state), which one (if any) owns the
authoritative release branch (resolved the same way `dev:main` resolves
it — never a literal `main`), the current authoritative release SHA, and
the local preview's last known SHA versus that authoritative SHA. Never
mutates anything. `--strict` exits 1 if any
stale/locked/dirty/stale-preview condition was found; the default exit is
always 0 — reporting a problem is this command's job, not a failure of it.

### `npm run release:worktree:cleanup`

Deterministic teardown for the temporary Release Integration worktree
(default target `.worktrees/release-integration`, override with `--path`).
Intended to run after every Release attempt — success, block, or rollback —
so a missing workspace never leaves a stale registration behind.

- registered but missing/broken → `git worktree prune` (git-native);
- dirty → refused unless `--force`;
- locked → refused (with the lock reason shown) unless `--unlock`, which
  runs `git worktree unlock` and then re-decides from a fresh listing;
- not registered at all → no-op, exit 0 (idempotent);
- never deletes a branch, never touches any other worktree, never edits
  `.git/worktrees/*` directly.

Exit codes: `0` done (including "already clean") · `2` blocked (dirty or
locked without the matching opt-in) · `3` git/lifecycle failure.

## Isolation

`.preview/` is a full copy of the product tree pinned at whatever `main`
SHA it was last refreshed to. It is excluded from every validation surface
the same way `.worktrees/` already is:

- `.gitignore` (`.preview/`);
- `vitest.config.ts` test discovery (`**/.preview/**`);
- `tools/validation_paths.py`'s `EXTERNAL_REPOSITORY_DIRS`, shared by
  `tools/verify.py` and `tools/check_indices.py`.

Both isolation canaries (`src/test/validation-isolation.test.ts`,
`tools/test_validation_isolation.py`) assert this directly.

## Permissions

`.worktrees/` and the repository root were found writable by the invoking
user in every investigation for this ticket — no ownership/permission
defect was reproduced. If a sandboxed environment genuinely cannot write
there, set `A3_PREVIEW_DIR` to a writable location instead of loosening
filesystem permissions.
