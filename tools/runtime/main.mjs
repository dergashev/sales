#!/usr/bin/env node
/**
 * tools/runtime/main.mjs — the Runtime Provenance Contract's CLI.
 *
 * Subcommands (see `npm run runtime:*` in package.json):
 *   main       resolve/rotate/start the canonical CURRENT_MAIN runtime.
 *              Detached: prints the URL and exits once the server is
 *              verified ready — never blocks the caller's terminal (unlike
 *              `dev:main`, which stays in the foreground for a human).
 *   candidate  register/start a TASK_CANDIDATE or REVIEW_CANDIDATE runtime
 *              pinned to the CALLER's own worktree HEAD — never advances to
 *              a newer main on its own.
 *   stop       gracefully stop a managed runtime, only once ownership is
 *              proven (never a broad process-wide kill).
 *   status     non-mutating diagnostic over every registered runtime. Never
 *              writes anything, never takes a lock.
 *   task-base  the "TASK BASE FRESHNESS" / "PINNED CANDIDATE RULE" preflight
 *              for a delivery lane's declared candidate.
 *   preflight  the shared "BROWSER CONSUMER PREFLIGHT" gate: is a given URL
 *              actually serving the purpose/sha a caller expects?
 *
 * Exit codes, shared with the rest of this repository's tooling: 0 PASS ·
 * 2 PROVENANCE (stale/unverifiable/mismatched runtime) · 3 LIFECYCLE
 * (git/worktree failure) · 4 TOOLING (npm/process spawn failure).
 */

import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { dirtyEntries, git, gitCommonDir, headSha, listWorktrees, samePath } from '../gate/lib/git-worktrees.mjs'
import { defaultManifestPath, readManifest } from '../gate/lib/manifest.mjs'
import { resolveCurrentMainAuthority } from './lib/release-branch.mjs'
import { planPreviewRefresh } from '../worktrees/lib/worktree-lifecycle.mjs'
import { defaultPreviewStatePath, withPreviewStateLock, writePreviewStateRaw, readPreviewState, updatePreviewState } from '../worktrees/lib/preview-state.mjs'
import { findFreePort } from '../worktrees/lib/free-port.mjs'

import { pidIsAlive } from './lib/pid.mjs'
import { ensureDependenciesLocked } from './lib/dependencies.mjs'
import { applyPreviewRefreshPlan } from './lib/checkout-mutation.mjs'
import { defaultRegistryPath, listClaims, putRuntimeClaim, removeRuntimeClaim, resolveCurrentMainClaim, runtimeId } from './lib/registry.mjs'
import { classifyRuntime } from './lib/classify.mjs'
import { planCurrentMainRotation } from './lib/rotation.mjs'
import { planTaskBasePreflight, checkBrowserProvenance } from './lib/preflight.mjs'
import { updateCandidateFields } from './lib/candidate-fields.mjs'
import { probeRuntimeEcho, waitForRuntimeReady } from './lib/probe.mjs'

const EXIT = { OK: 0, PROVENANCE: 2, LIFECYCLE: 3, TOOLING: 4 }
const CANDIDATE_PURPOSES = new Set(['TASK_CANDIDATE', 'REVIEW_CANDIDATE'])

function fail(code, message) {
  console.error(`\n[runtime] FAIL (exit ${code}): ${message}`)
  process.exit(code)
}

/** Same tiny Atomics-based blocking sleep tools/gate/lib/manifest-lock.mjs
 *  uses internally for its own lock-contention polling — duplicated here
 *  (not exported from that module, which documents the helper as private)
 *  so a graceful-stop wait can run INSIDE a synchronous `withManifestLock`
 *  critical section, where no real timer/promise can be awaited. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** SIGTERM, then poll for exit; SIGKILL after `graceMs` if it is still
 *  alive. Synchronous so it can run inside a manifest lock's callback —
 *  the architecture's "one locked transaction" requirement for rotation
 *  (prove ownership -> stop -> mutate) means the stop must complete before
 *  the lock is released, not merely be requested.
 *
 * `group: true` signals the NEGATIVE pid (targets the whole process
 * GROUP, not just the one pid) — required for `startRuntime`'s own
 * `detached: true` spawns: `npm run dev` forks a shell which forks the
 * actual dev server, and a bare SIGKILL to just the recorded (npm) pid
 * gives that process no chance to relay anything to what it spawned,
 * which measurably ORPHANED a still-listening dev server in testing.
 * `detached: true` makes that pid the leader of its OWN process group
 * (pgid === pid), so `-pid` is scoped to exactly that tree — never a
 * broader kill. Only pass `group: true` for a claim this module's own
 * `startRuntime` produced (`claim.detached === true`); a dev:main-started
 * process is NOT detached and may share a process group with an
 * unrelated caller, so it is always signaled by its single pid only. */
function stopProcessSync(pid, { graceMs = 5000, killGraceMs = 2000, pollMs = 100, group = false } = {}) {
  const target = group ? -pid : pid
  if (!pidIsAlive(pid)) return { ok: true, alreadyDead: true }
  try {
    process.kill(target, 'SIGTERM')
  } catch {
    return { ok: true, alreadyDead: true }
  }
  let deadline = Date.now() + graceMs
  while (pidIsAlive(pid) && Date.now() < deadline) sleepSync(pollMs)
  if (pidIsAlive(pid)) {
    try {
      process.kill(target, 'SIGKILL')
    } catch {
      // already gone
    }
    deadline = Date.now() + killGraceMs
    while (pidIsAlive(pid) && Date.now() < deadline) sleepSync(pollMs)
  }
  return { ok: !pidIsAlive(pid) }
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        args[key] = true
      } else {
        args[key] = next
        i++
      }
    } else {
      args._.push(a)
    }
  }
  return args
}

/** Classifies an existing claim by actually probing it live: pid liveness,
 *  then (only if alive) the HTTP echo. Never probes a claim that does not
 *  exist, and never probes echo for a pid that is already dead. */
async function classifyClaim(claim, { gitMainSha = null, expectedSha = null } = {}) {
  const pidAlive = claim ? pidIsAlive(claim.pid) : false
  const echo = claim && pidAlive && claim.url ? await probeRuntimeEcho(claim.url) : null
  return classifyRuntime({ claim, pidAlive, echo, gitMainSha, expectedSha })
}

function printRuntimeReport({ purpose, releaseBranch, expectedSha, claim, classification }) {
  console.log(`\n${purpose} RESOLUTION`)
  console.log(`  PURPOSE              : ${purpose}`)
  if (purpose === 'CURRENT_MAIN') console.log(`  RELEASE BRANCH       : ${releaseBranch ?? 'UNRESOLVED'}`)
  console.log(`  EXPECTED SHA         : ${expectedSha ?? 'UNRESOLVED'}`)
  console.log(`  ACTUAL RUNTIME SHA   : ${claim?.sha ?? 'NONE'}`)
  console.log(`  WORKTREE             : ${claim?.worktree ?? 'NONE'}`)
  console.log(`  URL                  : ${claim?.url ?? 'NONE'}`)
  console.log(`  STATUS               : ${classification.status}`)
  console.log(`  PROVENANCE VERIFIED  : ${classification.status === 'SERVING_VERIFIED'}`)
  console.log(`  REASON               : ${classification.reason}`)
}

// ── Shared start transaction (CURRENT_MAIN and candidates alike) ─────────
//
// `mutate` performs whatever checkout preparation this purpose needs INSIDE
// the caller-supplied lock section (for CURRENT_MAIN: prove-no-unregistered
// -live-owner + planPreviewRefresh; for a candidate: nothing, the caller
// already owns its own worktree) and must return the exact sha now checked
// out. Port allocation, the detached spawn, and the readiness poll always
// happen OUTSIDE any lock — the same shape dev-main.mjs already uses for
// its own foreground spawn, so a long-running server or a slow readiness
// poll never holds the manifest lock open.
async function startRuntime({ purpose, worktree, sha, registryPath, log }) {
  const nonce = randomUUID()
  const startedAt = new Date().toISOString()
  const port = await findFreePort('127.0.0.1')

  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: worktree,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      A3_RUNTIME_NONCE: nonce,
      A3_RUNTIME_PURPOSE: purpose,
      A3_RUNTIME_SHA: sha,
      A3_RUNTIME_WORKTREE: worktree,
      A3_RUNTIME_STARTED_AT: startedAt,
    },
  })
  child.unref()

  const url = `http://127.0.0.1:${port}`
  const ready = await waitForRuntimeReady(url, nonce)
  if (!ready.ok) {
    stopProcessSync(child.pid, { graceMs: 1000, killGraceMs: 1000, group: true })
    return { ok: false, code: EXIT.TOOLING, message: `Spawned "npm run dev" (pid ${child.pid}) in ${worktree} but it never answered GET /__runtime.json with our nonce within the readiness timeout.` }
  }

  // Record ONLY the port we just verified live, read back via the actual
  // HTTP echo we polled — never the pre-picked number on faith (findFreePort
  // has an inherent close-then-bind race; the successful poll above is what
  // actually proves this exact port is live and ours). `detached: true`
  // records that this pid is its own process-group leader (see
  // stopProcessSync) — a future stop/rotation of this exact claim may
  // safely target the whole group it spawned.
  const claim = { purpose, sha, worktree, pid: child.pid, port, url, nonce, startedAt, updatedAt: startedAt, detached: true }
  putRuntimeClaim(registryPath, runtimeId(purpose, worktree), claim)
  log(`[runtime] ${purpose} ready at ${url} (pid ${child.pid}, sha ${sha}).`)
  return { ok: true, claim }
}

// ── runtime:main ───────────────────────────────────────────────────────

async function cmdMain() {
  const cwd = process.cwd()
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed. Is this a git repository?')
  const repoRoot = path.dirname(commonDir)

  const authority = resolveCurrentMainAuthority(cwd)
  if (!authority.ok) return fail(EXIT.PROVENANCE, authority.reason)
  const mainSha = authority.sha

  const previewPath = path.resolve(repoRoot, process.env.A3_PREVIEW_DIR || '.preview/main')
  const registryPath = defaultRegistryPath(commonDir)
  const legacyStatePath = defaultPreviewStatePath(commonDir)

  const resolved = resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath: legacyStatePath, previewWorktreePath: previewPath })
  const classification = await classifyClaim(resolved.claim, { gitMainSha: mainSha })
  const plan = planCurrentMainRotation({ classification, claim: resolved.claim })

  if (plan.action === 'reuse') {
    printRuntimeReport({ purpose: 'CURRENT_MAIN', releaseBranch: authority.branch, expectedSha: mainSha, claim: resolved.claim, classification })
    process.exit(EXIT.OK)
    return
  }
  if (plan.action === 'blocked') {
    printRuntimeReport({ purpose: 'CURRENT_MAIN', releaseBranch: authority.branch, expectedSha: mainSha, claim: resolved.claim, classification })
    console.error(`\n[runtime:main] BLOCKED (exit ${plan.code}): ${plan.reason}`)
    process.exit(plan.code)
    return
  }

  // Tech Review round 2: `plan.action === 'start'` means classification is
  // MISSING or DEAD — i.e. the CLAIMED owner pid is not verifiably alive.
  // That is NOT the same thing as "nothing is serving this checkout" — a
  // dev:main wrapper can die (crash, OOM, a plain `kill <wrapper pid>`)
  // while its `npm run dev` grandchild survives and keeps answering at the
  // claim's own recorded url (reproduced directly: the checkout was
  // mutated underneath that still-live orphan, and this command reported
  // exit 0 / SERVING_VERIFIED). Positively verify the claim's own endpoint
  // is actually silent before ever proceeding to mutate — independent of,
  // and in addition to, the pid-based classification above. (No such check
  // is needed for 'stop-then-start': STALE/DRIFTED are EXPECTED to still
  // be serving at this point, that is exactly what is about to be stopped.)
  if (plan.action === 'start' && resolved.claim?.url) {
    const stillServing = await probeRuntimeEcho(resolved.claim.url)
    if (stillServing.ok) {
      printRuntimeReport({ purpose: 'CURRENT_MAIN', releaseBranch: authority.branch, expectedSha: mainSha, claim: resolved.claim, classification })
      console.error(
        `\n[runtime:main] BLOCKED (exit ${EXIT.PROVENANCE}): "${resolved.claim.url}" still answers a request even though this ` +
          `runtime classified ${classification.status} (its claimed owner pid is not verifiably alive). Refusing to mutate the ` +
          'checkout underneath a server that may still be live. Stop whatever is bound to that port manually and re-run.',
      )
      process.exit(EXIT.PROVENANCE)
      return
    }
  }

  // 'start' or 'stop-then-start': one locked transaction (same lock
  // dev-main.mjs uses for this exact canonical preview directory, so the
  // two commands can never interleave on it) — prove ownership (already
  // done above via classify), stop gracefully if owned-but-stale, THEN
  // mutate the checkout. Only synchronous work happens inside the lock.
  const transaction = withPreviewStateLock(legacyStatePath, () => {
    // Re-check the LEGACY live-owner guard fresh, under the lock — the
    // exact same protection dev-main.mjs applies, so an unregistered
    // process from one of the other worktrees' older tooling copies (or a
    // concurrent dev:main run) can never be mutated out from under itself
    // even if this command's own registry-based classification above
    // (necessarily taken before the lock) is now stale.
    const priorState = readPreviewState(legacyStatePath)
    if (priorState && pidIsAlive(priorState.pid) && priorState.pid !== resolved.claim?.pid) {
      return {
        ok: false,
        code: EXIT.PROVENANCE,
        message: `another process (pid ${priorState.pid}, port ${priorState.port ?? 'unknown'}) is currently serving "${previewPath}" (recorded sha ${priorState.sha}). Refusing to change the checkout under a live server not proven to be the one this rotation already classified.`,
      }
    }

    if (plan.action === 'stop-then-start') {
      const stopped = stopProcessSync(resolved.claim.pid, { group: resolved.claim.detached === true })
      if (!stopped.ok) {
        return { ok: false, code: EXIT.TOOLING, message: `Could not stop the previous CURRENT_MAIN process (pid ${resolved.claim.pid}) gracefully.` }
      }
    }

    const worktrees = listWorktrees(repoRoot)
    if (worktrees === null) return { ok: false, code: EXIT.LIFECYCLE, message: '"git worktree list --porcelain" failed.' }

    const refreshPlan = planPreviewRefresh({
      mainSha,
      worktrees,
      previewPath,
      existsFn: existsSync,
      dirtyEntriesFn: dirtyEntries,
      samePathFn: samePath,
    })
    if (refreshPlan.action === 'blocked') return { ok: false, code: EXIT.LIFECYCLE, message: refreshPlan.reason }
    if (refreshPlan.action === 'refuse-dirty') return { ok: false, code: EXIT.PROVENANCE, message: `${refreshPlan.reason} ${refreshPlan.unblockingRequirement}` }

    const applied = applyPreviewRefreshPlan({ plan: refreshPlan, previewPath, repoRoot, mainSha, log: console.log })
    if (!applied.ok) return { ok: false, code: applied.code, message: applied.message }

    const depsResult = ensureDependenciesLocked(previewPath, legacyStatePath)
    if (!depsResult.ok) return { ok: false, code: EXIT.TOOLING, message: depsResult.message }

    // Provisional legacy-state record, mirroring dev-main.mjs's own
    // "claim ownership before spawning" write, so an old-tooling worktree's
    // dev:main sees this process as the live owner immediately (before the
    // async spawn/poll below even starts).
    writePreviewStateRaw(legacyStatePath, { ...(readPreviewState(legacyStatePath) || {}), sha: applied.head, dir: previewPath, pid: process.pid, port: null, startedAt: new Date().toISOString() })

    return { ok: true, head: applied.head }
  })

  if (!transaction.ok) return fail(transaction.code, transaction.message)

  const started = await startRuntime({ purpose: 'CURRENT_MAIN', worktree: previewPath, sha: transaction.head, registryPath, log: console.log })
  if (!started.ok) return fail(started.code, started.message)

  // Legacy preview-state.json is updated too (never deleted, always kept
  // current) so the 16 other worktrees' older tooling — which only reads
  // THIS file — still sees an accurate live owner. Uses the LOCKED
  // merge-write (`updatePreviewState`), not the raw unlocked one: this
  // runs OUTSIDE the transaction's own lock (Tech Review P2 — a concurrent
  // writer's field, e.g. `installedLockHash`, must never be lost to this
  // read-modify-write racing it unguarded).
  updatePreviewState(legacyStatePath, (current) => ({ ...(current || {}), sha: transaction.head, dir: previewPath, pid: started.claim.pid, port: started.claim.port, startedAt: started.claim.startedAt }))

  printRuntimeReport({ purpose: 'CURRENT_MAIN', releaseBranch: authority.branch, expectedSha: mainSha, claim: started.claim, classification: { status: 'SERVING_VERIFIED', reason: 'Just started and verified.' } })
  process.exit(EXIT.OK)
}

// ── runtime:candidate ──────────────────────────────────────────────────

async function cmdCandidate(args) {
  const purpose = args.purpose
  if (!CANDIDATE_PURPOSES.has(purpose)) {
    return fail(EXIT.LIFECYCLE, `--purpose must be one of ${[...CANDIDATE_PURPOSES].join(', ')} (got ${purpose ?? 'none'}).`)
  }

  const cwd = process.cwd()
  const worktree = git(cwd, ['rev-parse', '--show-toplevel'])
  if (!worktree) return fail(EXIT.LIFECYCLE, '"git rev-parse --show-toplevel" failed. Is this a git repository?')
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed.')
  const registryPath = defaultRegistryPath(commonDir)

  const sha = args.sha || headSha(worktree)
  if (!sha) return fail(EXIT.LIFECYCLE, `"git rev-parse HEAD" failed in ${worktree}.`)

  const id = runtimeId(purpose, worktree)
  const existing = listClaims(registryPath).find((c) => c.id === id) ?? null
  const classification = await classifyClaim(existing, { expectedSha: sha })
  const plan = planCurrentMainRotation({ classification, claim: existing })

  if (plan.action === 'reuse') {
    printRuntimeReport({ purpose, expectedSha: sha, claim: existing, classification })
    process.exit(EXIT.OK)
    return
  }
  if (plan.action === 'blocked') {
    printRuntimeReport({ purpose, expectedSha: sha, claim: existing, classification })
    console.error(`\n[runtime:candidate] BLOCKED (exit ${plan.code}): ${plan.reason}`)
    process.exit(plan.code)
    return
  }

  if (plan.action === 'stop-then-start') {
    const stopped = stopProcessSync(existing.pid, { group: existing.detached === true })
    if (!stopped.ok) return fail(EXIT.TOOLING, `Could not stop the previous ${purpose} process (pid ${existing.pid}) gracefully.`)
  }

  const started = await startRuntime({ purpose, worktree, sha, registryPath, log: console.log })
  if (!started.ok) return fail(started.code, started.message)

  printRuntimeReport({ purpose, expectedSha: sha, claim: started.claim, classification: { status: 'SERVING_VERIFIED', reason: 'Just started and verified.' } })
  process.exit(EXIT.OK)
}

// ── runtime:stop ───────────────────────────────────────────────────────

async function cmdStop(args) {
  const purpose = args.purpose
  if (!purpose) return fail(EXIT.LIFECYCLE, '--purpose is required.')

  const cwd = process.cwd()
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed.')
  const repoRoot = path.dirname(commonDir)
  const registryPath = defaultRegistryPath(commonDir)

  const worktree = args.worktree
    ? path.resolve(args.worktree)
    : purpose === 'CURRENT_MAIN'
      ? path.resolve(repoRoot, process.env.A3_PREVIEW_DIR || '.preview/main')
      : git(cwd, ['rev-parse', '--show-toplevel'])
  if (!worktree) return fail(EXIT.LIFECYCLE, 'Could not resolve a worktree to stop (pass --worktree explicitly).')

  const id = runtimeId(purpose, worktree)
  const claim = listClaims(registryPath).find((c) => c.id === id) ?? null
  const classification = await classifyClaim(claim, { expectedSha: claim?.sha ?? null })

  if (!['SERVING_VERIFIED', 'STALE', 'DRIFTED'].includes(classification.status)) {
    console.error(`\n[runtime:stop] BLOCKED (exit ${EXIT.PROVENANCE}): ownership of "${id}" cannot be proven (status ${classification.status}: ${classification.reason}). Refusing to stop it.`)
    process.exit(EXIT.PROVENANCE)
    return
  }

  // Identity ownership (the check above) is not the same as being able to
  // fully, verifiably terminate the underlying server. A claim's recorded
  // pid may be an intermediate `npm` wrapper around a further child (true
  // for every dev:main-registered claim: foreground, no dedicated process
  // group) — signaling just that pid does not reliably stop the tree
  // underneath it (Tech Review P1: reproduced directly, the real server
  // survived and kept serving its old sha after "stopping" such a pid).
  // Only report a stop — and only ever remove the registry claim — for a
  // claim this tooling itself started detached.
  if (claim.detached !== true) {
    console.error(
      `\n[runtime:stop] BLOCKED (exit ${EXIT.PROVENANCE}): "${id}" (pid ${claim.pid}) was not started detached by this tooling ` +
        '(e.g. it is a dev:main-served process) and its underlying server process cannot be reliably, fully stopped from its ' +
        'recorded pid alone. Refusing to report a stop that cannot be made good on, and refusing to remove its registry claim ' +
        'while the real server may still be live. Stop it manually (Ctrl-C the owning dev:main, or kill its actual server process).',
    )
    process.exit(EXIT.PROVENANCE)
    return
  }

  const stopped = stopProcessSync(claim.pid, { group: true })
  if (!stopped.ok) return fail(EXIT.TOOLING, `Could not stop pid ${claim.pid} gracefully (still alive after SIGTERM and SIGKILL).`)

  removeRuntimeClaim(registryPath, id)
  console.log(`[runtime:stop] stopped ${purpose} at ${worktree} (was pid ${claim.pid}).`)
  process.exit(EXIT.OK)
}

// ── runtime:status ─────────────────────────────────────────────────────

async function cmdStatus() {
  const cwd = process.cwd()
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed.')
  const repoRoot = path.dirname(commonDir)
  const registryPath = defaultRegistryPath(commonDir)
  const legacyStatePath = defaultPreviewStatePath(commonDir)
  const authority = resolveCurrentMainAuthority(cwd)
  const mainSha = authority.ok ? authority.sha : null
  const previewPath = path.resolve(repoRoot, process.env.A3_PREVIEW_DIR || '.preview/main')

  // `status` is a non-mutating diagnostic — it never exits non-zero merely
  // because branch authority is ambiguous; it surfaces that ambiguity as
  // part of the report instead, same as any other UNRESOLVED field here.
  console.log('RUNTIME STATUS')
  console.log(`  RELEASE BRANCH        : ${authority.ok ? `${authority.branch} (via ${authority.branchSource})` : 'UNRESOLVED'}`)
  console.log(`  CURRENT RELEASE SHA   : ${mainSha ?? 'UNRESOLVED'}`)
  if (!authority.ok) console.log(`  RELEASE BRANCH REASON : ${authority.reason}`)

  const resolved = resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath: legacyStatePath, previewWorktreePath: previewPath })
  const mainClassification = await classifyClaim(resolved.claim, { gitMainSha: mainSha })

  console.log('\nCURRENT_MAIN')
  console.log(`  SHA        : ${resolved.claim?.sha ?? 'NONE'}`)
  console.log(`  WORKTREE   : ${resolved.claim?.worktree ?? previewPath}`)
  console.log(`  PID        : ${resolved.claim?.pid ?? 'NONE'}`)
  console.log(`  PORT       : ${resolved.claim?.port ?? 'NONE'}`)
  console.log(`  URL        : ${resolved.claim?.url ?? 'NONE'}`)
  console.log(`  LIVE       : ${resolved.claim ? pidIsAlive(resolved.claim.pid) : false}`)
  console.log(`  UPDATED AT : ${resolved.claim?.updatedAt ?? 'UNKNOWN'}`)
  console.log(`  PROVENANCE : ${mainClassification.status} (${mainClassification.reason})`)

  const allClaims = listClaims(registryPath)
  const candidateClaims = allClaims.filter((c) => c.purpose !== 'CURRENT_MAIN')

  console.log('\nACTIVE CANDIDATE RUNTIMES')
  if (candidateClaims.length === 0) console.log('  (none registered)')
  const staleRecords = []
  for (const c of candidateClaims) {
    const classification = await classifyClaim(c, { expectedSha: c.sha })
    console.log(`  - ${c.purpose} @ ${c.worktree}`)
    console.log(`      sha    : ${c.sha}`)
    console.log(`      url    : ${c.url}`)
    console.log(`      status : ${classification.status}`)
    if (classification.status !== 'SERVING_VERIFIED') staleRecords.push({ id: c.id, purpose: c.purpose, worktree: c.worktree, status: classification.status, reason: classification.reason })
  }
  if (mainClassification.status !== 'SERVING_VERIFIED' && resolved.claim) {
    staleRecords.unshift({ id: resolved.id, purpose: 'CURRENT_MAIN', worktree: resolved.claim.worktree, status: mainClassification.status, reason: mainClassification.reason })
  }

  console.log('\nSTALE RECORDS')
  if (staleRecords.length === 0) console.log('  (none)')
  for (const r of staleRecords) console.log(`  - ${r.purpose} @ ${r.worktree}: ${r.status} (${r.reason})`)

  process.exit(EXIT.OK)
}

// ── runtime:task-base ──────────────────────────────────────────────────

function isAncestor(cwd, ancestorSha, descendantSha) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { cwd, encoding: 'utf8' })
  if (result.error) return null
  if (result.status === 0) return true
  if (result.status === 1) return false
  return null
}

function cmdTaskBase(args) {
  const lane = args.lane
  if (!lane) return fail(EXIT.LIFECYCLE, '--lane is required.')

  const cwd = process.cwd()
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed.')
  const manifestPath = defaultManifestPath(commonDir)
  const manifest = readManifest(manifestPath)
  const entry = manifest[lane] ?? null

  const authority = resolveCurrentMainAuthority(cwd)
  if (!authority.ok) return fail(EXIT.PROVENANCE, authority.reason)
  const mainSha = authority.sha

  const worktree = args.worktree ? path.resolve(args.worktree) : entry?.worktree || cwd
  const head = headSha(worktree)
  if (!head) return fail(EXIT.LIFECYCLE, `"git rev-parse HEAD" failed in ${worktree}.`)

  const mainIsAncestorOfHead = isAncestor(worktree, mainSha, head)
  const plan = planTaskBasePreflight({ manifestEntry: entry, mainSha, headSha: head, mainIsAncestorOfHead })

  console.log('TASK BASE PREFLIGHT')
  console.log(`  LANE                 : ${lane}`)
  console.log(`  RELEASE BRANCH       : ${authority.branch} (via ${authority.branchSource})`)
  console.log(`  CURRENT MAIN SHA     : ${mainSha}`)
  console.log(`  TASK WORKSPACE HEAD  : ${head}`)

  if (plan.action === 'pinned') {
    console.log(`  TASK BASE COMMIT     : ${plan.taskBaseCommit} (PINNED at ${plan.pinnedAt ?? 'UNKNOWN'})`)
    console.log(`  RESULT               : PINNED — ${plan.reason}`)
    process.exit(EXIT.OK)
    return
  }

  if (plan.action === 'stale') {
    console.log(`  RESULT               : BLOCKED — STALE TASK BASE`)
    console.error(`\n[task:base] BLOCKED (exit ${plan.code}): ${plan.reason} ${plan.unblockingRequirement}`)
    process.exit(plan.code)
    return
  }

  if (plan.action === 'blocked') {
    return fail(plan.code, plan.reason)
  }

  // plan.action === 'pin'
  if (!entry) {
    console.error(
      `\n[task:base] BLOCKED (exit ${EXIT.PROVENANCE}): no candidate is declared for lane "${lane}" yet — run ` +
        `"node tools/gate/declare-candidate.mjs --lane ${lane}" first, then re-run task:base to pin it.`,
    )
    process.exit(EXIT.PROVENANCE)
    return
  }

  const pinnedAt = new Date().toISOString()
  try {
    updateCandidateFields(manifestPath, lane, { taskBaseCommit: plan.taskBaseCommit, pinnedAt })
  } catch (err) {
    return fail(EXIT.LIFECYCLE, err.message)
  }
  console.log(`  TASK BASE COMMIT     : ${plan.taskBaseCommit} (freshly PINNED at ${pinnedAt})`)
  console.log(`  RESULT               : PINNED — ${plan.reason}`)
  process.exit(EXIT.OK)
}

// ── runtime:preflight ──────────────────────────────────────────────────

async function cmdPreflight(args) {
  const expectedPurpose = args['expected-purpose']
  const expectedSha = args['expected-sha']
  const url = args.url
  if (!expectedPurpose || !expectedSha || !url) {
    return fail(EXIT.LIFECYCLE, 'Usage: runtime preflight --expected-purpose <PURPOSE> --expected-sha <sha> --url <url>')
  }

  const echo = await probeRuntimeEcho(url)
  const verifiedEcho = echo.ok && echo.contentType === 'application/json' && Boolean(echo.nonce)
  const status = verifiedEcho ? 'SERVING_VERIFIED' : 'UNVERIFIED'

  const result = checkBrowserProvenance({
    expectedPurpose,
    expectedSha,
    actualPurpose: verifiedEcho ? echo.purpose : null,
    actualSha: verifiedEcho ? echo.sha : null,
    status,
  })

  console.log('BROWSER CONSUMER PREFLIGHT')
  console.log(`  EXPECTED PURPOSE : ${result.expectedPurpose}`)
  console.log(`  EXPECTED SHA     : ${result.expectedSha}`)
  console.log(`  ACTUAL PURPOSE   : ${result.actualPurpose ?? 'UNRESOLVED'}`)
  console.log(`  ACTUAL SHA       : ${result.actualSha ?? 'UNRESOLVED'}`)
  console.log(`  PROVENANCE VERIFIED: ${result.verified}`)
  console.log(`  RESULT           : ${result.label} — ${result.reason}`)

  process.exit(result.verified ? EXIT.OK : EXIT.PROVENANCE)
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  switch (command) {
    case 'main':
      return cmdMain()
    case 'candidate':
      return cmdCandidate(args)
    case 'stop':
      return cmdStop(args)
    case 'status':
      return cmdStatus()
    case 'task-base':
      return cmdTaskBase(args)
    case 'preflight':
      return cmdPreflight(args)
    default:
      console.error(
        'Usage: node tools/runtime/main.mjs <main|candidate|stop|status|task-base|preflight> [options]\n' +
          '  main                                                    resolve/rotate/start CURRENT_MAIN\n' +
          '  candidate --purpose TASK_CANDIDATE|REVIEW_CANDIDATE     register/start a candidate runtime for the current worktree\n' +
          '  stop --purpose <P> [--worktree <path>]                  stop a managed runtime once ownership is proven\n' +
          '  status                                                  non-mutating diagnostic\n' +
          '  task-base --lane <lane> [--worktree <path>]             task-base freshness preflight / pin\n' +
          '  preflight --expected-purpose <P> --expected-sha <sha> --url <url>   browser consumer preflight',
      )
      process.exit(EXIT.LIFECYCLE)
  }
}

main().catch((err) => {
  console.error(`\n[runtime] LIFECYCLE FAILURE (exit ${EXIT.LIFECYCLE}): unexpected error: ${err && err.stack ? err.stack : err}`)
  process.exit(EXIT.LIFECYCLE)
})
