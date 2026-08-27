// tools/runtime/lib/release-branch.mjs
//
// Resolves the AUTHORITATIVE release branch — the branch CURRENT_MAIN,
// runtime:status and runtime:task-base must treat as "main" — instead of
// assuming a hard-coded literal branch name.
//
// BACKGROUND (Release & Pipeline Tooling Fixes ticket): the R2 redesign
// shipped on `master` (this repository's actual `origin` HEAD branch; there
// is no remote `main` at all), while a local-only `main` branch/checkout
// diverged silently. `tools/runtime/main.mjs` still resolved CURRENT_MAIN via
// a literal `git rev-parse main`, so CURRENT_MAIN kept serving the stale
// branch after a successful release, and post-release validation had to fall
// back to a manually-run `vite preview` as a substitute. This module removes
// the hard-coded literal so the SAME code works whether the authoritative
// branch is named `main`, `master`, or anything else — it is always resolved
// from repository/config authority, never assumed.
//
// Resolution order (first that answers wins). Each result reports its own
// provenance (`source`/`ref`) so a caller can print exactly why a given
// branch/sha was used — required by CURRENT_MAIN's report contract.
//
//   1. `A3_RELEASE_BRANCH` env override — explicit, deterministic, and the
//      only way to pin this in an environment where origin's HEAD pointer
//      is unavailable (a shallow/partial clone, a CI checkout that never
//      ran `git remote set-head`).
//   2. `git symbolic-ref --short refs/remotes/origin/HEAD` — origin's own
//      recorded default-branch pointer, when an `origin` remote is
//      configured at all. Resolves purely from the local `.git` directory
//      (no network call) once populated by a normal clone or by
//      `git remote set-head origin -a`.
//   3. If NO `origin` remote is configured at all, there is no repository
//      evidence about a release branch to consult at all — fall back, in
//      order, to a local branch literally named `main`, then one literally
//      named `master` (both well-known Git conventions, checked as
//      EXISTENCE facts against this exact checkout, not assumed blindly),
//      then finally the currently checked-out branch for a genuinely
//      single-branch standalone repository. This covers local-only/test
//      repositories; it never overrides real origin-HEAD evidence when an
//      origin exists (step 2 always wins in that case).
//
// If an `origin` remote IS configured but step 2 still cannot resolve its
// HEAD (e.g. a shallow clone that never ran `git remote set-head`), that IS
// the genuinely ambiguous case this ticket's Case 4 describes — callers must
// fail explicitly rather than silently falling through to step 3's local
// branch, which is exactly the "stale local main" failure mode being fixed.

import { git } from '../../gate/lib/git-worktrees.mjs'

/**
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ branch: string, source: string } | null}
 */
export function resolveReleaseBranch(cwd, env = process.env) {
  const override = env.A3_RELEASE_BRANCH
  if (override && override.trim()) {
    return { branch: override.trim(), source: 'A3_RELEASE_BRANCH env override' }
  }

  const hasOrigin = Boolean(git(cwd, ['remote', 'get-url', 'origin']))

  if (hasOrigin) {
    const originHead = git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
    if (originHead && originHead.startsWith('origin/') && originHead.length > 'origin/'.length) {
      return { branch: originHead.slice('origin/'.length), source: 'origin HEAD (refs/remotes/origin/HEAD)' }
    }
    // An origin exists but its HEAD pointer is unresolved — genuinely
    // ambiguous. Do NOT fall through to the local branch below: that is
    // exactly the divergence this module exists to catch.
    return null
  }

  // No origin at all: no repository evidence to consult about a release
  // branch. Fall back to well-known local-convention names, checked as
  // real existence facts against THIS checkout (never assumed blindly) —
  // and only as a last resort, the checked-out branch itself.
  for (const conventional of ['main', 'master']) {
    if (git(cwd, ['rev-parse', '--verify', '--quiet', conventional])) {
      return { branch: conventional, source: `local convention "${conventional}" (no "origin" remote configured; this branch exists in the checkout)` }
    }
  }

  const localHead = git(cwd, ['symbolic-ref', '--short', 'HEAD'])
  if (localHead) {
    return { branch: localHead, source: 'checked-out branch (no "origin" remote configured, and neither "main" nor "master" exists locally)' }
  }

  return null
}

/**
 * Resolves the exact SHA the release branch currently points at.
 *
 * Prefers the remote-tracking ref (`origin/<branch>`) — what is actually
 * pushed/released — over a same-named LOCAL branch, because a same-named
 * local branch that has drifted from its remote-tracking counterpart is
 * exactly the "stale local main" failure mode this module exists to avoid.
 * Falls back to a local branch only when no remote-tracking ref exists at
 * all (e.g. a repository with no fetched remote — a hermetic test repo),
 * and always reports which ref it actually used.
 *
 * @param {string} cwd
 * @param {string} branch
 * @returns {{ sha: string, ref: string } | null}
 */
export function resolveReleaseSha(cwd, branch) {
  const remoteRef = `origin/${branch}`
  const remoteSha = git(cwd, ['rev-parse', '--verify', '--quiet', remoteRef])
  if (remoteSha) return { sha: remoteSha, ref: remoteRef }

  const localSha = git(cwd, ['rev-parse', '--verify', '--quiet', branch])
  if (localSha) return { sha: localSha, ref: branch }

  return null
}

/**
 * Combined resolution used by every CURRENT_MAIN-purpose call site
 * (`runtime:main`, `runtime:status`, `runtime:task-base`). Never throws and
 * never falls back to a hard-coded branch name.
 *
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true, branch: string, branchSource: string, sha: string, ref: string } | { ok: false, reason: string }}
 */
export function resolveCurrentMainAuthority(cwd, env = process.env) {
  const resolvedBranch = resolveReleaseBranch(cwd, env)
  if (!resolvedBranch) {
    return {
      ok: false,
      reason:
        'Could not determine the authoritative release branch: A3_RELEASE_BRANCH is not set and ' +
        '"git symbolic-ref refs/remotes/origin/HEAD" did not resolve (no "origin" remote, or its HEAD ' +
        'pointer was never recorded). Run "git remote set-head origin -a" once, or set A3_RELEASE_BRANCH explicitly.',
    }
  }

  const resolvedSha = resolveReleaseSha(cwd, resolvedBranch.branch)
  if (!resolvedSha) {
    return {
      ok: false,
      reason:
        `Release branch resolved to "${resolvedBranch.branch}" (via ${resolvedBranch.source}), but neither ` +
        `"origin/${resolvedBranch.branch}" nor a local branch named "${resolvedBranch.branch}" exists in this checkout.`,
    }
  }

  return { ok: true, branch: resolvedBranch.branch, branchSource: resolvedBranch.source, sha: resolvedSha.sha, ref: resolvedSha.ref }
}
