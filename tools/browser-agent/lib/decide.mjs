// tools/browser-agent/lib/decide.mjs
//
// Pure decision functions for the Playwright CLI agent-browser layer
// (ticket "INTEGRATE PLAYWRIGHT CLI AS THE AUTHORITATIVE AGENT BROWSER
// EXECUTION LAYER"). No fs/git/child_process here — mirrors the style of
// tools/runtime/lib/classify.mjs and tools/runtime/lib/preflight.mjs: every
// branch is a function of plain data, so the full decision table is
// unit-testable without a real repo, a real runtime, or a real browser.

/**
 * Fail-closed gate on `npm run runtime:preflight`'s EXIT CODE alone.
 * The Runtime Provenance CLI (`tools/runtime/`) — the thing `preflight`
 * actually is — has no `--json` output at all; this function's ENTIRE
 * contract is "trust the exit code, never the stdout text", so a caller
 * can never accidentally regress into regex-parsing preflight's
 * human-readable report for a provenance-critical decision. (The official
 * upstream `@playwright/cli` is a separate binary that does document a
 * global `--json` flag — irrelevant here, since this function never reads
 * any CLI's stdout at all.) `exitCode` must be the literal process exit
 * code; this function never receives or looks at captured stdout/stderr.
 */
export function isPreflightVerified(exitCode) {
  return exitCode === 0
}

/**
 * Any non-zero exit from a chained `runtime:*` step (main/candidate) is a
 * refusal to proceed, full stop — no fallback URL, no reuse of a previously
 * known-good session. `step` is a label only, for the error message.
 */
export function classifyRuntimeStep({ step, exitCode }) {
  if (exitCode === 0) return { ok: true }
  return { ok: false, code: exitCode, reason: `"${step}" exited ${exitCode}. Refusing to derive a browser session from an unverified runtime.` }
}

/**
 * Engineering Architecture D1: `npm run runtime:candidate -- --sha <sha>`
 * (the already-released Runtime Provenance layer this task must not
 * duplicate or silently patch) trusts a caller-supplied `--sha` verbatim —
 * it never checks it against the worktree's actual `git rev-parse HEAD`.
 * Forwarding an agent's `--expected-sha` straight through as `--sha` would
 * therefore let a REVIEW_CANDIDATE/TASK_CANDIDATE session assert (and get
 * `provenanceVerified: true` for) a sha the worktree is not actually
 * running. This layer closes that hole on its own side of the boundary,
 * BEFORE `runtime:candidate` is ever spawned: an explicit `--expected-sha`
 * is treated purely as an assertion to verify against the real worktree
 * HEAD, never as a value handed to the runtime layer. CURRENT_MAIN is not
 * in scope here — `runtime:main` accepts no sha override at all, so it
 * cannot be tricked the same way.
 *
 * @param {object} opts
 * @param {string} opts.purpose - one of session-name.mjs's PURPOSES.
 * @param {string} [opts.expectedSha] - the caller's asserted sha, if any (absent for an unpinned candidate call).
 * @param {string|null} opts.actualHeadSha - `git rev-parse HEAD` for the worktree this call runs in, or null if it could not be resolved.
 */
export function verifyExpectedShaAgainstWorktree({ purpose, expectedSha, actualHeadSha }) {
  if (purpose === 'CURRENT_MAIN' || !expectedSha) return { ok: true }
  if (!actualHeadSha) {
    return { ok: false, code: 3, reason: '"git rev-parse HEAD" failed for this worktree. Cannot verify the asserted --expected-sha.' }
  }
  if (expectedSha !== actualHeadSha) {
    return {
      ok: false,
      code: 2,
      reason:
        `--expected-sha ${expectedSha} does not match this worktree's actual HEAD ${actualHeadSha}. Refusing to open a ${purpose} ` +
        'browser session — the code actually checked out here is not the runtime the caller expects, and this layer never trusts a ' +
        'caller-supplied sha over the worktree\'s own git state.',
    }
  }
  return { ok: true }
}

/**
 * Session-name collision handling (ticket "SESSION REUSE" / "NO PORT
 * AUTHORITY"). Because session names are sha-keyed (session-name.mjs), the
 * only way an EXISTING sidecar can share a name with the session about to
 * be opened is if `purpose`+`lane`+sha genuinely already resolved to this
 * exact identity before — in which case reuse is correct — or a defensive
 * inconsistency exists (the recorded worktree/purpose no longer matches),
 * which must refuse rather than silently overwrite.
 *
 * @param {object|null} existingSidecar - the sidecar record for this exact session name, or null.
 * @param {object} candidate - { purpose, worktree, sha }
 */
export function decideSessionAction(existingSidecar, candidate) {
  if (!existingSidecar) return { action: 'create' }

  if (existingSidecar.purpose !== candidate.purpose) {
    return { action: 'refuse', reason: `Session name is already recorded for purpose ${existingSidecar.purpose}, not ${candidate.purpose}. Refusing to reuse it.` }
  }
  if (existingSidecar.actualSha !== candidate.sha) {
    return {
      action: 'refuse',
      reason: `Session name is sha-keyed but its sidecar records sha ${existingSidecar.actualSha}, not the requested ${candidate.sha}. This should be structurally impossible; refusing rather than guessing.`,
    }
  }
  if (existingSidecar.worktree !== candidate.worktree) {
    return {
      action: 'refuse',
      reason: `Session name collision: sidecar belongs to worktree ${existingSidecar.worktree}, but this call is from ${candidate.worktree}.`,
    }
  }
  return { action: 'reuse' }
}

/**
 * Ticket "STALE CURRENT_MAIN SESSION" / "CANDIDATE CHANGE AFTER REWORK":
 * a sidecar is CURRENT only while its `actualSha` still equals whatever
 * this purpose/lane currently resolves to (current local main for
 * CURRENT_MAIN, the declared candidate manifest entry for TASK_CANDIDATE /
 * REVIEW_CANDIDATE). `currentExpectedSha === null` means "could not be
 * determined" (e.g. lane undeclared) -> UNKNOWN, never silently CURRENT.
 */
export function classifySidecarFreshness({ sidecar, currentExpectedSha }) {
  if (currentExpectedSha == null) return 'UNKNOWN'
  return sidecar.actualSha === currentExpectedSha ? 'CURRENT' : 'SUPERSEDED'
}

/**
 * `browser:agent:close` must only ever touch the ONE session it was asked
 * to close (ticket "SESSION CLEANUP": "closing one session must not
 * terminate unrelated sessions"). This is a decision-table placeholder for
 * that invariant: given every sidecar name currently on disk, the plan
 * names exactly the requested one for removal and leaves every other name
 * untouched. The actual store (sidecar-store.mjs) only ever unlinks a
 * single path it is given, so this cannot regress into a broad sweep by
 * construction — this function documents and unit-tests the contract.
 */
export function planClose({ sessionName, allSidecarNames }) {
  return {
    toRemove: [sessionName],
    untouched: allSidecarNames.filter((name) => name !== sessionName),
  }
}

/**
 * Engineering QA P1: the real `@playwright/cli`'s own session/daemon registry
 * is scoped per-workspace (the nearest ancestor directory containing
 * `.playwright/`, hashed) — a session opened from worktree A is genuinely
 * unreachable from worktree B, even at the identical sha. When asked to close
 * a session it cannot reach, the real CLI exits 0 with "Browser 'X' is not
 * open" — text-identical to "already closed". Naively trusting that exit code
 * would delete the sidecar (this layer's ONLY record of the session) while
 * the actual browser/dev-server process keeps running in its real worktree,
 * silently invisible to `browser:agent:status` from then on: a resource leak
 * that erases its own evidence. Ticket "SESSION CLEANUP": "Only clean
 * resources whose ownership can be proven" — this is verified BEFORE ever
 * invoking the real CLI, purely from the sidecar's own recorded `worktree`
 * versus the caller's actual one, no network/process call needed to refuse.
 *
 * A missing sidecar (`sidecar === null`) is NOT a mismatch: that is the
 * pre-existing, still-legitimate "opened outside this tooling, or already
 * closed" best-effort path (ticket allows closing a session this layer never
 * tracked). Likewise a sidecar with no recorded `worktree`, or a caller that
 * cannot supply its own `worktree` — never refuse on a comparison this
 * function cannot actually make; only a POSITIVELY CONFIRMED mismatch
 * refuses.
 *
 * @param {object|null} sidecar - the sidecar record for this session name, or null if untracked here.
 * @param {string|undefined} worktree - the caller's actual worktree (ctx.worktree), if known.
 */
export function verifyCloseOwnership(sidecar, worktree) {
  if (!sidecar || !sidecar.worktree || !worktree) return { ok: true }
  if (sidecar.worktree !== worktree) {
    return {
      ok: false,
      code: 2,
      reason:
        `Session was opened from worktree ${sidecar.worktree}, not this worktree (${worktree}). The real CLI cannot reach it from ` +
        'here, and its "not open" response is indistinguishable from "already closed" — refusing to report success or remove the ' +
        `sidecar. Run this close from ${sidecar.worktree} instead.`,
    }
  }
  return { ok: true }
}

/**
 * Ticket "NO PORT AUTHORITY": nothing in this layer may assume a fixed
 * port. This parses whatever URL the Runtime Provenance registry actually
 * handed back — any host, any port — and never falls back to a hardcoded
 * default when parsing fails (returns null instead, which callers must
 * treat as a hard refusal, not "assume 5173").
 */
export function parseRuntimeUrl(url) {
  try {
    const parsed = new URL(url)
    if (!parsed.port) return null
    return { host: parsed.hostname, port: Number(parsed.port), href: parsed.href }
  } catch {
    return null
  }
}
