#!/usr/bin/env node
/**
 * tools/worktrees/dev-main.mjs — `npm run dev:main`
 *
 * Canonical, provenance-proving way to open the latest accepted release —
 * without guessing which worktree has it, without touching the caller's
 * own checkout, and without ever silently serving something other than
 * exactly what the AUTHORITATIVE RELEASE BRANCH currently resolves to.
 *
 * The authoritative release branch is resolved through
 * `tools/runtime/lib/release-branch.mjs` (`resolveCurrentMainAuthority`) —
 * the SAME canonical resolver `runtime:main`/`runtime:status`/
 * `runtime:task-base` use. It is NEVER assumed to be a local branch
 * literally named `main`: this repository's actual authority is
 * `origin/master` (there is no remote `main` at all), and a stale local
 * `main`/`master` divergence must never be silently served (DELIVERY-
 * INFRA-01 — the command name `dev:main` is retained for backwards
 * compatibility only; it does not imply the Git branch must be `main`).
 *
 * Lifecycle (ticket §4/§5/§7; branch resolution updated by DELIVERY-INFRA-01):
 *   1. resolve the authoritative release SHA via `resolveCurrentMainAuthority`
 *      (never a literal `git rev-parse main`, never from the invoking cwd's
 *      own branch/worktree).
 *   2. under one lock (`withPreviewStateLock`, Tech Review P2-1): read any
 *      recorded prior owner ONCE and reuse that read for two separate
 *      decisions — (a) refuse a MUTATING action (create/recreate/checkout)
 *      outright if that owner is still alive (it may be serving the
 *      directory right now; changing the checkout under it would silently
 *      invalidate what it is showing), and (b) even for a non-mutating
 *      "reuse", never overwrite that owner's pid/port with our own — a
 *      round-1 version of this fix wrote it unconditionally, which let a
 *      harmless repeat invocation silently disarm the guard for the NEXT,
 *      genuinely mutating run. Otherwise resolve/create a DETACHED preview
 *      worktree at `.preview/main` (or $A3_PREVIEW_DIR) — detached so it
 *      never competes for ownership of the `main` branch the way a branch
 *      checkout would.
 *   3. if the preview is dirty and main has moved: refuse (exit 2), never
 *      discard uncommitted work.
 *   4. install dependencies only when needed (missing node_modules, or the
 *      committed lockfile changed since the last refresh).
 *   5. re-verify PREVIEW HEAD == MAIN SHA one last time, print the
 *      provenance block, then serve `npm run dev` from that exact worktree,
 *      recording this process as the preview's live owner (pid/port) only
 *      if it did not just serve alongside an already-live owner.
 *
 * The caller's own working directory/branch is never read for git state
 * beyond resolving the repository's common .git dir, and is never written
 * to at all.
 *
 * Exit codes: 0 clean exit of the dev server · 2 provenance refusal (dirty
 * preview, or a live owner currently serving this directory) · 3 worktree/
 * git lifecycle failure · 4 npm/install failure.
 */

import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

import { dirtyEntries, gitCommonDir, listWorktrees, samePath } from '../gate/lib/git-worktrees.mjs'
import { planPreviewRefresh } from './lib/worktree-lifecycle.mjs'
import { defaultPreviewStatePath, readPreviewState, updatePreviewState, withPreviewStateLock, writePreviewStateRaw } from './lib/preview-state.mjs'
import { findFreePort } from './lib/free-port.mjs'
import { pidIsAlive } from '../runtime/lib/pid.mjs'
import { ensureDependenciesLocked } from '../runtime/lib/dependencies.mjs'
import { applyPreviewRefreshPlan } from '../runtime/lib/checkout-mutation.mjs'
import { defaultRegistryPath, putRuntimeClaim, runtimeId } from '../runtime/lib/registry.mjs'
import { resolveCurrentMainAuthority } from '../runtime/lib/release-branch.mjs'

const EXIT = { OK: 0, PROVENANCE: 2, LIFECYCLE: 3, TOOLING: 4 }

function fail(code, message) {
  console.error(`\n[dev:main] ${code === EXIT.PROVENANCE ? 'PROVENANCE REFUSAL' : code === EXIT.TOOLING ? 'TOOLING FAILURE' : 'LIFECYCLE FAILURE'} (exit ${code}): ${message}`)
  process.exit(code)
}

async function main() {
  const cwd = process.cwd()

  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed. Is this a git repository?')
  const repoRoot = path.dirname(commonDir)

  // DELIVERY-INFRA-01: resolved through the ONE canonical authoritative-
  // release resolver — never a literal `git rev-parse main`. Works
  // whether the authoritative branch is `master` (this repository today),
  // `main`, or anything else; a stale/divergent local `main` branch plays
  // no role whatsoever (Case B of the delivery-lifecycle regression suite).
  const authority = resolveCurrentMainAuthority(cwd)
  if (!authority.ok) return fail(EXIT.PROVENANCE, authority.reason)
  const mainSha = authority.sha
  console.log(`[dev:main] authoritative release branch: ${authority.branch} (via ${authority.branchSource})`)

  const previewPath = path.resolve(repoRoot, process.env.A3_PREVIEW_DIR || '.preview/main')
  const statePath = defaultPreviewStatePath(commonDir)

  // Single lock for the whole "decide -> mutate the checkout -> install ->
  // record new state" sequence (Tech Review P2-1): without it, a second
  // dev:main invocation could interleave between separate small locked
  // steps and check out a different SHA into a directory a live server is
  // still watching, silently invalidating the first run's printed
  // provenance. readPreviewState (lock-free) / writePreviewStateRaw
  // (lock-free) are the only state accessors allowed inside this callback.
  const { head: finalHead, claimedOwnership } = withPreviewStateLock(statePath, () => {
    const worktrees = listWorktrees(repoRoot)
    if (worktrees === null) return fail(EXIT.LIFECYCLE, '"git worktree list --porcelain" failed.')

    const plan = planPreviewRefresh({
      mainSha,
      worktrees,
      previewPath,
      existsFn: existsSync,
      dirtyEntriesFn: dirtyEntries,
      samePathFn: samePath,
    })

    if (plan.action === 'blocked') return fail(EXIT.LIFECYCLE, plan.reason)
    if (plan.action === 'refuse-dirty') return fail(EXIT.PROVENANCE, `${plan.reason} ${plan.unblockingRequirement}`)

    // Read ONCE, before any mutation, and reuse for both the mutating-path
    // refusal below AND the ownership-claim decision at the end (Tech
    // Review P2-1 round 2): a non-mutating "reuse" run must not overwrite a
    // still-alive prior owner's pid/port either — doing so unconditionally
    // (the round-1 fix's bug) let the recorded owner go stale the moment a
    // harmless repeat `dev:main` ran, so a LATER mutating run's liveness
    // check then passed against a soon-to-be-dead pid instead of the
    // genuinely live server, and silently swapped the checkout under it.
    const priorState = readPreviewState(statePath)
    const liveOwnerExists = Boolean(priorState && pidIsAlive(priorState.pid))

    const mutating = plan.action === 'create' || plan.action === 'recreate' || plan.action === 'checkout'
    if (mutating && liveOwnerExists) {
      return fail(
        EXIT.PROVENANCE,
        `another dev:main process (pid ${priorState.pid}, port ${priorState.port ?? 'unknown'}) is currently serving "${previewPath}" ` +
          `(recorded sha ${priorState.sha}). Refusing to change the checkout under a live server — stop it first, or run with a different A3_PREVIEW_DIR.`,
      )
    }

    // The actual git plumbing for "make the checkout equal `plan`" is
    // shared with `runtime:main` (tools/runtime/lib/checkout-mutation.mjs)
    // — the Engineering Architecture handoff's "dev:main delegates to the
    // one shared lifecycle" requirement. Same re-verification-after-
    // mutation discipline as before: never trust the action just taken.
    const applied = applyPreviewRefreshPlan({ plan, previewPath, repoRoot, mainSha, log: (msg) => console.log(msg.replace('[runtime]', '[dev:main]')) })
    if (!applied.ok) return fail(applied.code, applied.message)
    const head = applied.head

    const depsResult = ensureDependenciesLocked(previewPath, statePath)
    if (!depsResult.ok) return fail(EXIT.TOOLING, depsResult.message)

    if (liveOwnerExists) {
      // Only reachable via "reuse" — a mutating action already refused
      // above when a live owner exists. That owner's record already
      // correctly identifies the exact worktree/sha being served; serve
      // alongside it for this invocation without touching its pid/port.
      console.log(`[dev:main] a live dev:main process (pid ${priorState.pid}, port ${priorState.port ?? 'unknown'}) already owns this preview; serving alongside it without claiming ownership.`)
      return { head, claimedOwnership: false }
    }

    // Record pid now (this process is about to become the live owner);
    // port is filled in once resolved, just below, outside this lock.
    writePreviewStateRaw(statePath, {
      ...(readPreviewState(statePath) || {}),
      sha: head,
      dir: previewPath,
      pid: process.pid,
      port: null,
      startedAt: new Date().toISOString(),
    })

    return { head, claimedOwnership: true }
  })

  const dirtyNow = dirtyEntries(previewPath)
  const dirty = dirtyNow === null ? 'UNKNOWN' : dirtyNow.length > 0

  const port = await findFreePort('127.0.0.1')
  // Only stamp OUR port if we actually claimed ownership above — never
  // overwrite a still-live prior owner's record with a port we picked for
  // a second, unregistered server instance.
  if (claimedOwnership) {
    updatePreviewState(statePath, (current) => ({ ...(current || {}), port }))
  }

  // A single nonce, shared by the runtime-identity plugin's live echo and
  // (when this run claims ownership) the new CURRENT_MAIN registry claim —
  // so `runtime:status`/`runtime:main` can machine-verify a dev:main-started
  // preview exactly the same way they verify one they started themselves,
  // instead of leaving every dev:main-started runtime permanently
  // UNVERIFIED. This is the "dev:main delegates to the one shared lifecycle"
  // consolidation from the Engineering Architecture handoff: one registry,
  // one identity plugin, regardless of which command started the server.
  const nonce = randomUUID()
  const startedAt = new Date().toISOString()
  if (claimedOwnership) {
    const registryPath = defaultRegistryPath(commonDir)
    const id = runtimeId('CURRENT_MAIN', previewPath)
    putRuntimeClaim(registryPath, id, {
      purpose: 'CURRENT_MAIN',
      sha: finalHead,
      worktree: previewPath,
      pid: process.pid,
      port,
      url: `http://127.0.0.1:${port}`,
      nonce,
      startedAt,
      updatedAt: startedAt,
      // NOT spawned with `detached: true` (this server runs in the
      // foreground, `stdio: 'inherit'`) — a future `runtime:stop`/rotation
      // of this claim must signal this exact pid only, never its process
      // GROUP, which may be shared with an unrelated caller/terminal job.
      detached: false,
    })
  }

  console.log('\nLOCAL MAIN PREVIEW')
  console.log(`\nAUTHORITATIVE RELEASE BRANCH:\n${authority.branch} (via ${authority.branchSource})`)
  console.log(`\nMAIN SHA:\n${mainSha}`)
  console.log(`\nPREVIEW SHA:\n${finalHead}`)
  console.log(`\nWORKTREE:\n${previewPath}`)
  console.log(`\nDIRTY:\n${dirty}`)
  console.log(`\nURL:\nhttp://127.0.0.1:${port}`)
  console.log('')

  const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: previewPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      A3_RUNTIME_NONCE: nonce,
      A3_RUNTIME_PURPOSE: 'CURRENT_MAIN',
      A3_RUNTIME_SHA: finalHead,
      A3_RUNTIME_WORKTREE: previewPath,
      A3_RUNTIME_STARTED_AT: startedAt,
    },
  })

  server.on('error', (err) => {
    fail(EXIT.TOOLING, `could not start "npm run dev" in ${previewPath}: ${err.message}`)
  })
  server.on('exit', (code) => {
    process.exit(code ?? EXIT.OK)
  })
}

main().catch((err) => {
  console.error(`\n[dev:main] LIFECYCLE FAILURE (exit ${EXIT.LIFECYCLE}): unexpected error: ${err && err.stack ? err.stack : err}`)
  process.exit(EXIT.LIFECYCLE)
})
