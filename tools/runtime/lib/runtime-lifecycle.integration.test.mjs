// tools/runtime/lib/runtime-lifecycle.integration.test.mjs
//
// End-to-end coverage against REAL git (hermetic throwaway repositories —
// never the actual project checkout) and a REAL child process serving the
// runtime-identity wire contract, exercising the actual `tools/runtime/
// main.mjs` CLI exactly the way a human/agent would invoke it. Mirrors
// tools/worktrees/lib/worktree-lifecycle.integration.test.mjs's style and
// technique (hermetic `git init`, a committed installable fixture package,
// spawning the real CLI as a child process, never calling its `cmd*`
// functions in-process — they call `process.exit`).
//
// Ticket scenario coverage in this file: A (clean start), B/C (main
// advances -> stale -> rotation), D (live-checkout safety against an
// unregistered legacy owner), O (status never mutates, never locks), I/J
// (task-base freshness/pinning), plus one REAL `vite dev` end-to-end proof
// of the actual plugin (not the fixture's stand-in). E (dead pid), F (port
// collision), G (dirty preview), K/L (review sha), N (multiple candidates)
// are covered as pure decision-table unit tests in classify.test.mjs /
// rotation.test.mjs / preflight.test.mjs / registry.test.mjs — re-deriving
// them here against real git would exercise the same already-proven
// primitives (planPreviewRefresh, dirtyEntries) worktree-lifecycle.test.mjs
// / worktree-lifecycle.integration.test.mjs already cover for the shared
// checkout-mutation code path this module reuses unchanged.

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultRegistryPath, putRuntimeClaim, readRegistry, runtimeId } from './registry.mjs'
import { defaultPreviewStatePath, updatePreviewState } from '../../worktrees/lib/preview-state.mjs'
import { findFreePort } from '../../worktrees/lib/free-port.mjs'
import { pidIsAlive } from './pid.mjs'
import { waitForRuntimeReady } from './probe.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MJS = path.resolve(HERE, '..', 'main.mjs')
const DECLARE_CANDIDATE_MJS = path.resolve(HERE, '..', '..', 'gate', 'declare-candidate.mjs')
const FAKE_SERVER_SRC = readFileSync(path.join(HERE, 'test-fixtures', 'fake-vite-dev.mjs'), 'utf8')
const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Registers a CURRENT_MAIN claim shaped exactly like a `dev:main`-produced
 * one — `detached: false` in the CLAIM `runtime:main`/`runtime:stop` read —
 * against a REAL running server, without going through dev-main.mjs's own
 * CLI (spawning the full `dev-main.mjs` process tree from inside this test
 * runner's own worker was empirically unreliable in this environment: it
 * reproducibly crashed the vitest worker, root-caused below).
 *
 * The fixture process ITSELF is spawned `detached: true` here purely so
 * THIS TEST'S OWN afterEach can tear it down deterministically
 * (`process.kill(-pid)`, a real process-group kill this test owns and
 * created) — that is a test-cleanup concern, orthogonal to what is under
 * test. The candidate code under test (`runtime:main`/`runtime:stop`) never
 * inspects the real OS process tree at all; it only ever trusts the claim's
 * OWN declared `detached` field (exactly the field this task's whole fix is
 * about), which is set to `false` below regardless of how the fixture
 * itself happens to be spawned. This is what actually exercises Tech
 * Review's finding.
 *
 * ROOT CAUSE of the crash from the rejected first draft (recorded for any
 * future maintainer): that draft left the fixture non-detached and instead
 * killed it in `afterEach` by looking up its pid via `lsof -ti :<port>`
 * ("kill whatever is bound to this port now"). On this machine, under the
 * sheer number of ports/processes churned across this task's own repeated
 * test runs, `lsof` occasionally returned a STALE/reused pid no longer
 * belonging to the fixture at all — killing an arbitrary, unrelated,
 * sometimes-critical process, which occasionally crashed the vitest worker
 * itself ("Worker exited unexpectedly"). Reproduced directly, bisected line
 * by line: the crash tracked exactly to the `process.kill(pid, 'SIGKILL')`
 * call fed by `lsof`'s output, not to any git/spawn/fetch step before it.
 * Never key cleanup off "whatever process currently holds this port" —
 * only ever off a pid this test itself just received directly from `spawn`.
 */
async function registerNonDetachedClaim({ registryPath, previewPath, sha, purpose = 'CURRENT_MAIN' }) {
  const port = await findFreePort('127.0.0.1')
  const nonce = `non-detached-${Math.random().toString(36).slice(2)}`
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: previewPath,
    detached: true, // test-cleanup-only; the CLAIM below still declares `detached: false`
    stdio: 'ignore',
    env: { ...process.env, A3_RUNTIME_NONCE: nonce, A3_RUNTIME_PURPOSE: purpose, A3_RUNTIME_SHA: sha },
  })
  fixturePidsToKill.push(child.pid) // afterEach group-kills this exact pid — never rediscovered via lsof/port lookup

  const url = `http://127.0.0.1:${port}`
  const ready = await waitForRuntimeReady(url, nonce)
  if (!ready.ok) throw new Error(`fixture server at ${url} never answered /__runtime.json with its own nonce within the deadline`)

  const startedAt = new Date().toISOString()
  const claim = { purpose, sha, worktree: previewPath, pid: child.pid, port, url, nonce, startedAt, updatedAt: startedAt, detached: false }
  putRuntimeClaim(registryPath, runtimeId(purpose, previewPath), claim)
  return { child, claim }
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${result.stderr}`)
  return result.stdout.trim()
}

function commit(cwd, message) {
  git(cwd, ['add', '-A'])
  git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-m', message, '--no-verify'])
  return git(cwd, ['rev-parse', 'HEAD'])
}

/** Advances the `main` REF via a throwaway worktree — mirrors
 *  worktree-lifecycle.integration.test.mjs's own helper. The root checkout
 *  sits on `some-feature-branch`, exactly like production. */
function advanceMain(repoRootDir) {
  const tmpOwner = path.join(repoRootDir, '.worktrees', 'main-advance-tmp')
  git(repoRootDir, ['worktree', 'add', '-q', tmpOwner, 'main'])
  writeFileSync(path.join(tmpOwner, `advance-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`), 'advance main\n')
  git(tmpOwner, ['add', '-A'])
  git(tmpOwner, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'advance main', '--no-verify'])
  const newSha = git(repoRootDir, ['rev-parse', 'main'])
  git(repoRootDir, ['worktree', 'remove', tmpOwner])
  return newSha
}

/** Commits a minimal, real installable project (lockfile + package.json +
 *  a `dev` script implementing the runtime-identity wire contract) onto
 *  `main`, via a throwaway worktree — same technique as
 *  worktree-lifecycle.integration.test.mjs's `commitInstallablePackageOntoMain`. */
function commitInstallableProjectOntoMain(repoRootDir) {
  const tmpOwner = path.join(repoRootDir, '.worktrees', 'add-package-tmp')
  git(repoRootDir, ['worktree', 'add', '-q', tmpOwner, 'main'])
  writeFileSync(path.join(tmpOwner, '.gitignore'), 'node_modules/\n')
  writeFileSync(path.join(tmpOwner, 'package-lock.json'), '{"name":"fixture","lockfileVersion":3}\n')
  writeFileSync(path.join(tmpOwner, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts: { dev: 'node fake-server.mjs' } }))
  writeFileSync(path.join(tmpOwner, 'fake-server.mjs'), FAKE_SERVER_SRC)
  git(tmpOwner, ['add', '-A'])
  git(tmpOwner, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'add installable fixture project', '--no-verify'])
  const sha = git(repoRootDir, ['rev-parse', 'main'])
  git(repoRootDir, ['worktree', 'remove', tmpOwner])
  return { sha }
}

let tmpRoot
let repoDir
let fixturePidsToKill

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-runtime-lifecycle-'))
  repoDir = path.join(tmpRoot, 'repo')
  fixturePidsToKill = []
  git(tmpRoot, ['init', '-q', '-b', 'main', 'repo'])
  git(repoDir, ['config', 'user.email', 'test@example.invalid'])
  git(repoDir, ['config', 'user.name', 'Test'])
  writeFileSync(path.join(repoDir, 'README.md'), 'root\n')
  commit(repoDir, 'initial commit')
  git(repoDir, ['checkout', '-q', '-b', 'some-feature-branch'])
})

afterEach(() => {
  // Kill any registered runtime this run's tests actually started —
  // detached, unref'd processes outlive the CLI that spawned them.
  //
  // CRITICAL: only claims with `detached === true` (every `runtime:main`/
  // `runtime:candidate`-started claim: its own process-group leader — see
  // main.mjs's stopProcessSync) may be group-killed (`-pid`). A claim's
  // pid for a NON-detached process may share a process group with an
  // unrelated caller — `-pid` there would be unsafe.
  try {
    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    for (const claim of Object.values(readRegistry(registryPath))) {
      try {
        process.kill(claim.detached === true ? -claim.pid : claim.pid, 'SIGKILL')
      } catch {
        // already gone
      }
    }
  } catch {
    // repo already torn down / never had a registry — nothing to clean up
  }
  // This file's P1-regression fixtures (registerNonDetachedClaim) spawn
  // their REAL process with `detached: true` purely so THIS cleanup can
  // group-kill a pid it directly received from `spawn` itself — never
  // rediscovered via a port/lsof lookup. An earlier draft killed "whatever
  // process currently holds this port" instead; on this machine, under the
  // sheer number of ports/processes this task's own repeated test runs
  // churned through, `lsof -ti :<port>` occasionally returned a STALE,
  // already-reassigned pid, and killing it occasionally took down something
  // unrelated and critical enough to crash the whole vitest worker
  // ("Worker exited unexpectedly", bisected line by line to that exact
  // call). Never key cleanup off "whatever currently holds this port" —
  // only ever off a pid this test itself actually received from `spawn`.
  for (const pid of fixturePidsToKill) {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('runtime:main — scenario A (clean start)', () => {
  it('resolves current main, starts a verified CURRENT_MAIN runtime, and the registry + live echo agree', async () => {
    const { sha } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')

    const result = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('CURRENT_MAIN RESOLUTION')
    expect(result.stdout).toContain('SERVING_VERIFIED')

    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    const entries = Object.values(readRegistry(registryPath))
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ purpose: 'CURRENT_MAIN', sha })
    expect(git(previewPath, ['rev-parse', 'HEAD'])).toBe(sha)

    const res = await fetch(new URL('/__runtime.json', entries[0].url))
    const body = await res.json()
    expect(body.nonce).toBe(entries[0].nonce)
    expect(body.sha).toBe(sha)
  })

  it('a repeat invocation with nothing changed is a no-op reuse — same pid, no restart', () => {
    commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    const first = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(first.status).toBe(0)

    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    const pidAfterFirst = Object.values(readRegistry(registryPath))[0].pid

    const second = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(second.status).toBe(0)
    const pidAfterSecond = Object.values(readRegistry(registryPath))[0].pid
    expect(pidAfterSecond).toBe(pidAfterFirst)
    expect(pidIsAlive(pidAfterFirst)).toBe(true)
  })
})

describe('runtime:main — scenario D (live checkout safety)', () => {
  it('refuses to mutate the checkout while an unregistered live process (e.g. another worktree\'s plugin-less dev:main) occupies the legacy record, and performs no mutation', () => {
    const { sha } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    git(repoDir, ['worktree', 'add', '--detach', '-q', previewPath, sha])

    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const legacyStatePath = defaultPreviewStatePath(path.resolve(repoDir, commonDir))
    mkdirSync(path.dirname(legacyStatePath), { recursive: true })
    // This test process is, by construction, alive for the entire
    // synchronous spawnSync call below — a real, non-flaky liveness signal.
    // Port 1 is never actually served by anything real (no /__runtime.json
    // echo will ever succeed against it), which is exactly what an
    // unmanaged/unverifiable-but-alive legacy owner looks like.
    writeFileSync(legacyStatePath, JSON.stringify({ sha, dir: previewPath, pid: process.pid, port: 1, startedAt: new Date().toISOString() }))

    advanceMain(repoDir)
    const result = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })

    expect(result.status).toBe(2)
    expect(result.stdout).toContain('UNVERIFIED')
    expect(result.stderr).toContain('BLOCKED')
    expect(git(previewPath, ['rev-parse', 'HEAD'])).toBe(sha) // untouched — no mutation happened
  })
})

describe('Tech Review P1 regression — a non-detached CURRENT_MAIN claim (e.g. dev:main-registered) cannot be falsely reported as stopped/rotated', () => {
  it('runtime:main refuses (exit 2) to stop-and-mutate a STALE non-detached runtime, and performs NO mutation while the real server keeps serving the old sha', async () => {
    const { sha: sha1 } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    git(repoDir, ['worktree', 'add', '--detach', '-q', previewPath, sha1])
    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))

    const { claim } = await registerNonDetachedClaim({ registryPath, previewPath, sha: sha1 })
    // Sanity: genuinely reachable before rotation is attempted.
    expect((await fetch(new URL('/__runtime.json', claim.url))).status).toBe(200)

    const sha2 = advanceMain(repoDir)

    const rotate = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(rotate.status).toBe(2)
    expect(rotate.stdout).toContain('STATUS               : STALE')
    expect(rotate.stdout).toContain('PROVENANCE VERIFIED  : false')
    expect(rotate.stderr).toMatch(/BLOCKED.*not started detached/)

    // No mutation happened: preview still at sha1, the real server (still
    // alive — we never touched it) still answers with sha1, not sha2.
    expect(git(previewPath, ['rev-parse', 'HEAD'])).toBe(sha1)
    const echo = await fetch(new URL('/__runtime.json', claim.url)).then((r) => r.json())
    expect(echo.sha).toBe(sha1)
    expect(echo.sha).not.toBe(sha2)
  }, 15_000)

  it('runtime:stop refuses (exit 2) to report a stop it cannot make good on, and does NOT remove the registry claim while the server is still live', async () => {
    const { sha } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    git(repoDir, ['worktree', 'add', '--detach', '-q', previewPath, sha])
    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))

    const { claim } = await registerNonDetachedClaim({ registryPath, previewPath, sha })

    const stop = spawnSync('node', [MAIN_MJS, 'stop', '--purpose', 'CURRENT_MAIN', '--worktree', previewPath], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(stop.status).toBe(2)
    expect(stop.stderr).toMatch(/BLOCKED.*not started detached/)

    // The claim must still be there (removing it would make a live,
    // unrecorded orphan invisible to runtime:status), and the server must
    // still genuinely be serving.
    const claimsAfter = Object.values(readRegistry(registryPath))
    expect(claimsAfter).toHaveLength(1)
    expect(claimsAfter[0].pid).toBe(claim.pid)
    expect((await fetch(new URL('/__runtime.json', claim.url))).status).toBe(200)
  }, 15_000)
})

describe('runtime:stop — process-group termination (regression: a single-pid SIGKILL orphaned the actual dev server)', () => {
  it('stopping a runtime actually frees its port — not just the recorded (npm) pid', async () => {
    const { sha } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    const start = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(start.status).toBe(0)

    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    const claim = Object.values(readRegistry(registryPath))[0]
    expect(claim.sha).toBe(sha)

    // Sanity: genuinely reachable before stopping.
    expect((await fetch(new URL('/__runtime.json', claim.url))).status).toBe(200)

    const stop = spawnSync('node', [MAIN_MJS, 'stop', '--purpose', 'CURRENT_MAIN', '--worktree', previewPath], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(stop.status).toBe(0)

    // The recorded pid must be dead...
    expect(pidIsAlive(claim.pid)).toBe(false)
    // ...AND the actual server it spawned must have gone down with it —
    // a bare single-pid SIGKILL (targeting only the intermediate `npm`
    // process) would leave this fetch succeeding against an orphaned
    // `node fake-server.mjs` still bound to the port.
    await expect(fetch(new URL('/__runtime.json', claim.url))).rejects.toThrow()
  })
})

describe('runtime:main — scenarios B/C (main advances -> stale -> rotation)', () => {
  it('a stale CURRENT_MAIN is never returned as valid, and re-running performs a full rotation: graceful stop, checkout refresh, exactly one verified singleton', async () => {
    const { sha: sha1 } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')

    const first = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(first.status).toBe(0)

    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    const firstClaim = Object.values(readRegistry(registryPath))[0]
    expect(pidIsAlive(firstClaim.pid)).toBe(true)

    const sha2 = advanceMain(repoDir)
    expect(sha2).not.toBe(sha1)

    // scenario B, checked via the same status the CLI itself would print:
    // a re-run must NOT silently treat the sha1 runtime as still current.
    const statusBeforeRotation = spawnSync('node', [MAIN_MJS, 'status'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(statusBeforeRotation.stdout).toContain('STALE')

    const second = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(second.status).toBe(0)
    expect(second.stdout).toContain('SERVING_VERIFIED')

    expect(pidIsAlive(firstClaim.pid)).toBe(false) // gracefully stopped before the checkout was mutated

    const entries = Object.values(readRegistry(registryPath))
    expect(entries).toHaveLength(1) // still a singleton — no dual authority
    expect(entries[0].sha).toBe(sha2)
    expect(entries[0].pid).not.toBe(firstClaim.pid)
    expect(git(previewPath, ['rev-parse', 'HEAD'])).toBe(sha2)

    const res = await fetch(new URL('/__runtime.json', entries[0].url))
    expect((await res.json()).sha).toBe(sha2)
  })
})

describe('runtime:main — scenario H (multiple concurrent starters, CLI-level)', () => {
  it('two concurrent `runtime:main` invocations against a clean state produce exactly one live server and one registry claim; the loser fails closed', async () => {
    const { sha } = commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))

    // Async spawn (not spawnSync) so both children run genuinely
    // concurrently and are reaped promptly — a blocked/zombie-producing
    // harness here would mask real races (see this file's dev:main tests).
    function runAsync() {
      return new Promise((resolve) => {
        let out = ''
        let err = ''
        const child = spawn('node', [MAIN_MJS, 'main'], { cwd: repoDir, env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
        child.stdout.on('data', (d) => { out += d })
        child.stderr.on('data', (d) => { err += d })
        child.on('exit', (code) => resolve({ code, out, err }))
      })
    }

    const [a, b] = await Promise.all([runAsync(), runAsync()])
    const results = [a, b]
    const winners = results.filter((r) => r.code === 0)
    const losers = results.filter((r) => r.code !== 0)
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(losers[0].code).toBe(2) // fails closed, never a partial/ambiguous state

    const claims = Object.values(readRegistry(registryPath))
    expect(claims).toHaveLength(1) // no dual authority
    expect(claims[0].sha).toBe(sha)
    expect((await fetch(new URL('/__runtime.json', claims[0].url))).status).toBe(200)
  })
})

describe('Tech Review P2 regression — the post-spawn legacy preview-state.json write is lock-safe', () => {
  it('a concurrent locked writer never loses an update to runtime:main\'s own writes on the shared legacy preview-state.json (no unlocked read-modify-write remains)', async () => {
    commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const legacyStatePath = defaultPreviewStatePath(path.resolve(repoDir, commonDir))

    // A "hammer": many small LOCKED increments (via the same production
    // `updatePreviewState` dev-main.mjs already uses correctly), spread
    // across the ENTIRE real `runtime:main` run below via async spawn (NOT
    // spawnSync, which would block this process's event loop and starve
    // the hammer entirely). If ANY of runtime:main's own read-modify-write
    // touches on this exact file are not lock-protected, an interleaved
    // increment is silently overwritten — a real, count-verifiable lost
    // update, not a timing guess about hitting one narrow window.
    let stopHammer = false
    let increments = 0
    const hammer = (async () => {
      while (!stopHammer) {
        updatePreviewState(legacyStatePath, (current) => ({ ...(current || {}), concurrentCounter: (current?.concurrentCounter || 0) + 1 }))
        increments++
        await sleep(10)
      }
    })()

    const runtimeMain = new Promise((resolve) => {
      let out = ''
      const child = spawn('node', [MAIN_MJS, 'main'], { cwd: repoDir, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
      child.stdout.on('data', (d) => { out += d })
      child.on('exit', (code) => resolve({ code, out }))
    })

    const run = await runtimeMain
    stopHammer = true
    await hammer
    expect(run.code).toBe(0)
    expect(increments).toBeGreaterThan(3) // sanity: genuine overlap happened, this isn't a no-op race

    const final = JSON.parse(readFileSync(legacyStatePath, 'utf8'))
    // Every hammer increment survived runtime:main's own concurrent writes
    // to this same file — the lost-update class Tech Review P2 flagged.
    expect(final.concurrentCounter).toBe(increments)
    expect(final.pid).toBeTypeOf('number') // runtime:main's own final fields are still merged in, not clobbered either
  })
})

describe('runtime:status — scenario O (non-mutating)', () => {
  it('never mutates the registry/worktrees and never takes the registry lock', () => {
    commitInstallableProjectOntoMain(repoDir)
    const previewPath = path.join(repoDir, '.preview', 'main')
    const start = spawnSync('node', [MAIN_MJS, 'main'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(start.status).toBe(0)

    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    const before = readFileSync(registryPath, 'utf8')
    const worktreesBefore = git(repoDir, ['worktree', 'list', '--porcelain'])

    const status = spawnSync('node', [MAIN_MJS, 'status'], { cwd: repoDir, encoding: 'utf8', env: { ...process.env, A3_PREVIEW_DIR: previewPath } })
    expect(status.status).toBe(0)
    expect(status.stdout).toContain('CURRENT LOCAL MAIN SHA')
    expect(status.stdout).toContain('SERVING_VERIFIED')

    expect(readFileSync(registryPath, 'utf8')).toBe(before) // byte-identical
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).toBe(worktreesBefore)
    expect(readdirSync(path.dirname(registryPath))).not.toContain('runtimes.json.lock')
  })
})

describe('task:base — scenarios I, J', () => {
  function declare(lane, sha) {
    const result = spawnSync('node', [DECLARE_CANDIDATE_MJS, '--lane', lane, '--sha', sha, '--worktree', repoDir], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(0)
  }

  it('scenario I: a task worktree behind current main is refused (exit 2), never silently pinned', () => {
    const headA = git(repoDir, ['rev-parse', 'HEAD'])
    advanceMain(repoDir) // main now contains work this worktree omits
    declare('engineering', headA)

    const result = spawnSync('node', [MAIN_MJS, 'task-base', '--lane', 'engineering'], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(2)
    expect(result.stdout).toContain('STALE TASK BASE')
    expect(result.stderr).toMatch(/BLOCKED.*omits already-released prerequisite work/)
  })

  it('scenario J: once pinned, main advancing further never re-triggers staleness or a rebase', () => {
    const headA = git(repoDir, ['rev-parse', 'HEAD'])
    declare('engineering', headA)

    const first = spawnSync('node', [MAIN_MJS, 'task-base', '--lane', 'engineering'], { cwd: repoDir, encoding: 'utf8' })
    expect(first.status).toBe(0)
    expect(first.stdout).toContain('freshly PINNED')

    advanceMain(repoDir)
    advanceMain(repoDir)

    const second = spawnSync('node', [MAIN_MJS, 'task-base', '--lane', 'engineering'], { cwd: repoDir, encoding: 'utf8' })
    expect(second.status).toBe(0)
    expect(second.stdout).toContain(`TASK BASE COMMIT     : ${headA}`)
    expect(second.stdout).not.toContain('freshly PINNED') // already pinned, not re-decided
  })
})

describe('the REAL Vite plugin, end-to-end (not the fixture stand-in)', () => {
  it('a genuine `vite dev` process (this project\'s own vite.config.ts) answers verified JSON with the injected identity (the no-nonce 404 case is proven against this exact code in vite-plugin-runtime-identity.test.mjs)', async () => {
    const port = await findFreePort('127.0.0.1')

    const nonce = 'integration-test-nonce'
    const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, A3_RUNTIME_NONCE: nonce, A3_RUNTIME_PURPOSE: 'CURRENT_MAIN', A3_RUNTIME_SHA: 'test-sha' },
    })

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('vite did not become ready in time')), 20_000)
        const onData = (chunk) => {
          if (/ready in|Local:/i.test(chunk.toString('utf8'))) {
            clearTimeout(timer)
            child.stdout.off('data', onData)
            resolve()
          }
        }
        child.stdout.on('data', onData)
        child.on('error', reject)
        child.on('exit', (code) => reject(new Error(`vite exited early (${code})`)))
      })

      const withNonce = await fetch(`http://127.0.0.1:${port}/__runtime.json`)
      expect(withNonce.status).toBe(200)
      expect(withNonce.headers.get('content-type')).toMatch(/application\/json/)
      const body = await withNonce.json()
      expect(body).toMatchObject({ nonce, purpose: 'CURRENT_MAIN', sha: 'test-sha' })
    } finally {
      child.kill('SIGTERM')
    }
  }, 30_000)
})
