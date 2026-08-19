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
import { defaultRegistryPath, readRegistry } from './registry.mjs'
import { defaultPreviewStatePath } from '../../worktrees/lib/preview-state.mjs'
import { findFreePort } from '../../worktrees/lib/free-port.mjs'
import { pidIsAlive } from './pid.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MJS = path.resolve(HERE, '..', 'main.mjs')
const DECLARE_CANDIDATE_MJS = path.resolve(HERE, '..', '..', 'gate', 'declare-candidate.mjs')
const FAKE_SERVER_SRC = readFileSync(path.join(HERE, 'test-fixtures', 'fake-vite-dev.mjs'), 'utf8')
const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..')

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

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-runtime-lifecycle-'))
  repoDir = path.join(tmpRoot, 'repo')
  git(tmpRoot, ['init', '-q', '-b', 'main', 'repo'])
  git(repoDir, ['config', 'user.email', 'test@example.invalid'])
  git(repoDir, ['config', 'user.name', 'Test'])
  writeFileSync(path.join(repoDir, 'README.md'), 'root\n')
  commit(repoDir, 'initial commit')
  git(repoDir, ['checkout', '-q', '-b', 'some-feature-branch'])
})

afterEach(() => {
  // Kill any registered runtime this run's tests actually started —
  // detached, unref'd processes outlive the CLI that spawned them. Every
  // claim this file's tests produce comes from `startRuntime` (`detached:
  // true`, its own process-group leader — see main.mjs's stopProcessSync),
  // so the group form (-pid) is safe and necessary here: a plain SIGKILL
  // to just the recorded (npm) pid measurably orphaned the actual
  // `node fake-server.mjs` process during this file's own development.
  try {
    const commonDir = git(repoDir, ['rev-parse', '--git-common-dir'])
    const registryPath = defaultRegistryPath(path.resolve(repoDir, commonDir))
    for (const claim of Object.values(readRegistry(registryPath))) {
      try {
        process.kill(-claim.pid, 'SIGKILL')
      } catch {
        // already gone
      }
    }
  } catch {
    // repo already torn down / never had a registry — nothing to clean up
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
