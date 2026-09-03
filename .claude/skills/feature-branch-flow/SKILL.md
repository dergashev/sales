---
name: feature-branch-flow
description: Mandatory git workflow for this repo — every feature/fix is developed on its own branch and lands in master only through a GitLab Merge Request. ALWAYS use this skill before committing or pushing any code change, when finishing a feature, or when the user asks to "commit", "push", "ship", or "create an MR". Direct commits and pushes to master are forbidden.
---

# Feature-branch flow (no direct pushes to master)

Master is protected by process: it only moves via Merge Requests on
GitLab (`git.core.funkflow.com`). Coding agents MUST follow this flow for
every change — there are no exceptions for "small" fixes.

## The flow

1. **Start from fresh master:**
   ```sh
   git fetch origin
   git switch -c <type>/<short-slug> origin/master
   ```
   Branch types: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `ci/`.
   Slug: kebab-case, 2–5 words, e.g. `feat/kostentreiber-pdf-export`.
   If a ticket/task id exists, prefix the slug with it: `fix/vr2-08-delta-chip`.

2. **Work and commit on the branch.** Conventional commit messages, same
   style as the existing history (`feat(vr2-08): …`, `fix(ci-hotfix-01): …`).
   Before every commit: `npm run typecheck` and `npm test` must be green
   (engine tests are non-negotiable, see CLAUDE.md).

3. **Push the branch and open the MR in one step** (GitLab push options —
   no `glab` CLI needed):
   ```sh
   git push -u origin HEAD \
     -o merge_request.create \
     -o merge_request.target=master \
     -o merge_request.title="<conventional title>" \
     -o merge_request.remove_source_branch
   ```
   The push output prints the MR URL — always report it to the user.

4. **Stop there.** Do NOT merge the MR yourself, do not push follow-up
   commits to master, do not delete the branch. Review and merge are
   human decisions. Follow-up fixes go as new commits on the same branch
   (the MR updates automatically on push).

## Hard rules

- **Never** `git commit` while on `master`, and **never** `git push origin master`.
  The repo's pre-commit hook enforces this (blocks commits on master/main);
  `FEATURE_FLOW_ALLOW_MASTER=1` overrides it and is reserved for humans and
  release tooling — an agent must never set it.
  If you find yourself on master with uncommitted work, move it first:
  `git switch -c <type>/<slug>` (this carries the working tree with it).
- **Never** force-push to master. Force-push to your own feature branch is
  allowed only after a rebase you performed yourself in this session.
- Keep the branch current with `git fetch origin && git rebase origin/master`
  when master moved; resolve conflicts on the branch, never on master.
- One feature = one branch = one MR. Unrelated changes discovered along
  the way go to a separate branch/MR.
