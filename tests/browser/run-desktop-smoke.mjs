#!/usr/bin/env node
/**
 * Canonical desktop browser smoke runner — `npm run test:browser:desktop`.
 *
 * Implements the Engineering Architecture handoff for
 * run-1786721843348-gs3s56 (node n-agent-1786467989610-pquv): a
 * repository-owned, deterministic desktop-viewport browser validation
 * mechanism for QA and Release, with exact-candidate provenance.
 *
 * LIFECYCLE (build mode, the default):
 *   1. resolve git provenance (sha / branch / worktree / dirty)
 *   2. refuse an untrustworthy candidate (wrong sha / dirty tree) — FAST,
 *      before any build or browser cost is paid
 *   3. wipe dist/, run `npm run build`
 *   4. stamp the fresh build with a provenance sidecar (sha + per-run nonce)
 *   5. serve that exact build via a dedicated `vite preview` on a
 *      runner-chosen free ephemeral port, bound to 127.0.0.1
 *   6. fetch the sidecar back from the LIVE server and verify it matches
 *      this run — never trust that the server we just spawned is actually
 *      serving what we just built without checking
 *   7. run the Playwright specs against that verified URL
 *   8. tear down only the child process this run started
 *
 * LIFECYCLE (--base-url mode, for QA/Release pointing at an existing
 * runtime): skip build/serve, but REQUIRE --expect-sha and verify the
 * sidecar the SAME way — an unverifiable existing runtime is a hard
 * failure, never a silent pass.
 *
 * Exit codes:
 *   0  PASS
 *   1  a Playwright assertion failed
 *   2  candidate provenance could not be established or did not match
 *   3  build or server lifecycle failure
 *   4  required browser tooling is missing
 */

import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST_DIR = path.join(ROOT, 'dist')
const PLAYWRIGHT_CONFIG = path.join(ROOT, 'tests', 'browser', 'playwright.config.ts')
const READY_TIMEOUT_MS = 20_000

const EXIT = { PASS: 0, ASSERTION: 1, PROVENANCE: 2, LIFECYCLE: 3, TOOLING: 4 }

function parseArgs(argv) {
  const args = { expectSha: null, baseUrl: null, allowDirty: false, width: 1440, height: 900 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--expect-sha') args.expectSha = argv[++i]
    else if (a === '--base-url') args.baseUrl = argv[++i]
    else if (a === '--allow-dirty') args.allowDirty = true
    else if (a === '--width') args.width = Number(argv[++i])
    else if (a === '--height') args.height = Number(argv[++i])
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(EXIT.PASS)
    } else {
      fail(EXIT.LIFECYCLE, `Unknown argument: ${a}`)
    }
  }
  return args
}

function printUsage() {
  console.log(
    'Usage: npm run test:browser:desktop -- ' +
    '[--expect-sha <sha>] [--base-url <url>] [--allow-dirty] [--width N] [--height N]',
  )
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts })
}

function git(args) {
  const result = run('git', args)
  if (result.status !== 0) return null
  return result.stdout.trim()
}

/** PROVENANCE block — always printed, on every exit path (pass or fail). */
function printProvenance(p) {
  console.log('\nPROVENANCE')
  console.log(`  candidate sha : ${p.candidateSha ?? 'UNRESOLVED'}`)
  console.log(`  branch        : ${p.branch ?? 'UNRESOLVED'}`)
  console.log(`  worktree      : ${p.worktreeRoot ?? 'UNRESOLVED'}`)
  console.log(`  dirty         : ${p.dirty ?? 'UNRESOLVED'}`)
  console.log(`  url           : ${p.url ?? 'N/A'}`)
  console.log(`  viewport      : ${p.viewport ?? 'N/A'}`)
  console.log(`  built at      : ${p.builtAt ?? 'N/A'}`)
}

function fail(code, message, provenance) {
  console.error(`\n[test:browser:desktop] FAIL (exit ${code}): ${message}`)
  if (provenance) printProvenance(provenance)
  process.exit(code)
}

/** Ask the OS for one free TCP port on 127.0.0.1, then release it immediately. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

/**
 * Spawn `vite preview` on the given port and resolve once it is actually
 * accepting connections — never a fixed sleep. Rejects (never resolves) on
 * a spawn/tooling failure so the caller can distinguish that from a plain
 * timeout.
 */
function startPreviewServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(new Error(`vite preview did not become ready within ${READY_TIMEOUT_MS}ms`))
    }, READY_TIMEOUT_MS)

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`vite preview exited early (code ${code}) before becoming ready`))
    })

    const onData = (chunk) => {
      const text = chunk.toString('utf8')
      process.stdout.write(`[vite preview] ${text}`)
      if (!settled && /https?:\/\/127\.0\.0\.1:\d+/.test(text)) {
        settled = true
        clearTimeout(timer)
        child.stdout.off('data', onData)
        resolve(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (chunk) => process.stderr.write(`[vite preview] ${chunk}`))
  })
}

async function fetchProvenance(url) {
  const res = await fetch(new URL('/__provenance.json', url))
  if (!res.ok) throw new Error(`GET /__provenance.json -> HTTP ${res.status}`)
  return res.json()
}

function killChild(child) {
  if (!child || child.killed) return
  try { child.kill('SIGTERM') } catch { /* already gone */ }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const viewport = `${args.width}x${args.height}`
  const provenance = { viewport }
  let previewChild = null

  process.on('exit', () => killChild(previewChild))
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { killChild(previewChild); process.exit(EXIT.LIFECYCLE) })
  }

  // ── 1. Resolve git provenance up front ──────────────────────────────
  const headSha = git(['rev-parse', 'HEAD'])
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const worktreeRoot = git(['rev-parse', '--show-toplevel'])
  const statusResult = run('git', ['status', '--porcelain'])
  if (headSha === null || statusResult.status !== 0) {
    fail(EXIT.PROVENANCE, 'Could not resolve git provenance (not a git repository, or git is unavailable).', provenance)
  }
  const dirty = statusResult.stdout.trim().length > 0
  provenance.candidateSha = headSha
  provenance.branch = branch
  provenance.worktreeRoot = worktreeRoot
  provenance.dirty = dirty

  let baseUrl
  let expectSha = args.expectSha
  let expectNonce = null

  if (args.baseUrl) {
    // ── --base-url mode: verify an existing runtime, never assume it ──
    if (!expectSha) {
      fail(EXIT.PROVENANCE, '--base-url requires --expect-sha: an existing runtime cannot be trusted without an exact candidate to check it against.', provenance)
    }
    baseUrl = args.baseUrl
    provenance.url = baseUrl
    let sidecar
    try {
      sidecar = await fetchProvenance(baseUrl)
    } catch (err) {
      fail(EXIT.PROVENANCE, `Could not read provenance from ${baseUrl}: ${err.message}. Refusing to validate an unverifiable runtime.`, provenance)
    }
    // From here on, PROVENANCE describes the SERVED candidate, not the
    // machine invoking this runner. QA/Release cite this block as evidence
    // about the runtime under test — printing the local git state here
    // (Tech Review finding P1) would silently substitute an unrelated
    // machine's branch/worktree/dirty state for the candidate's own.
    // A field the server didn't report is treated as untrustworthy, not
    // absent: this mode exists specifically to avoid assuming an
    // unverifiable runtime is fine.
    provenance.candidateSha = sidecar.candidateSha
    provenance.branch = sidecar.branch ?? 'UNKNOWN (server did not report it)'
    provenance.worktreeRoot = sidecar.worktreeRoot ?? 'UNKNOWN (server did not report it)'
    provenance.dirty = typeof sidecar.dirty === 'boolean' ? sidecar.dirty : true
    provenance.builtAt = sidecar.builtAt
    expectNonce = sidecar.nonce

    if (sidecar.candidateSha !== expectSha) {
      fail(EXIT.PROVENANCE, `Runtime at ${baseUrl} serves candidate ${sidecar.candidateSha}, expected ${expectSha}. Refusing to validate the wrong candidate.`, provenance)
    }
    if (provenance.dirty && !args.allowDirty) {
      fail(EXIT.PROVENANCE, `Runtime at ${baseUrl} was built from a dirty candidate (uncommitted changes at build time). Pass --allow-dirty to explicitly accept a non-authoritative candidate.`, provenance)
    }
  } else {
    // ── build mode ──────────────────────────────────────────────────
    if (expectSha && headSha !== expectSha) {
      fail(EXIT.PROVENANCE, `HEAD is ${headSha}, expected ${expectSha}. Refusing to build and validate the wrong candidate.`, provenance)
    }
    if (dirty && !args.allowDirty) {
      fail(EXIT.PROVENANCE, 'Working tree is dirty. Commit or stash changes, or pass --allow-dirty to explicitly mark this candidate as dirty (QA/Release must then treat it as non-authoritative).', provenance)
    }

    console.log(`[test:browser:desktop] candidate ${headSha}${dirty ? ' (dirty, --allow-dirty)' : ''} on ${branch}`)
    console.log('[test:browser:desktop] wiping dist/ and rebuilding the candidate...')
    rmSync(DIST_DIR, { recursive: true, force: true })
    const build = run('npm', ['run', 'build'], { stdio: 'inherit' })
    if (build.status !== 0) {
      fail(EXIT.LIFECYCLE, `npm run build failed (exit ${build.status}).`, provenance)
    }
    if (!existsSync(DIST_DIR)) {
      fail(EXIT.LIFECYCLE, 'npm run build reported success but dist/ does not exist.', provenance)
    }

    const nonce = randomUUID()
    const builtAt = new Date().toISOString()
    provenance.builtAt = builtAt
    // No `viewport` field here (Tech Review finding P1/3): viewport is a
    // property of THIS test run's invocation (--width/--height), not of
    // the build — a value baked in at build time would go stale the
    // moment a later run used a different viewport, and nothing reads it
    // back regardless. `provenance.viewport` (printed in the PROVENANCE
    // block) always reflects the current run's actual --width/--height.
    const sidecar = {
      candidateSha: headSha, branch, worktreeRoot, builtAt, dirty, nonce,
    }
    writeFileSync(path.join(DIST_DIR, '__provenance.json'), JSON.stringify(sidecar, null, 2))
    expectSha = headSha
    expectNonce = nonce

    const port = await findFreePort()
    console.log(`[test:browser:desktop] serving the exact built candidate on 127.0.0.1:${port}...`)
    try {
      previewChild = await startPreviewServer(port)
    } catch (err) {
      const toolingMissing = /ENOENT/.test(err.message ?? '')
      fail(
        toolingMissing ? EXIT.TOOLING : EXIT.LIFECYCLE,
        `Could not start the preview server: ${err.message}`,
        provenance,
      )
    }
    baseUrl = `http://127.0.0.1:${port}`
    provenance.url = baseUrl

    // ── Verify the live server is actually serving THIS candidate ────
    let sidecarFromServer
    try {
      sidecarFromServer = await fetchProvenance(baseUrl)
    } catch (err) {
      killChild(previewChild)
      fail(EXIT.PROVENANCE, `Could not read provenance back from the server we just started: ${err.message}. Refusing to run the browser against an unverified server.`, provenance)
    }
    if (sidecarFromServer.candidateSha !== expectSha || sidecarFromServer.nonce !== expectNonce) {
      killChild(previewChild)
      fail(EXIT.PROVENANCE, 'The live server did not echo back this run\'s exact sha+nonce (a stale or foreign process may be bound to this port). Refusing to validate.', provenance)
    }
  }

  // ── Run Playwright against the verified URL ─────────────────────────
  console.log(`[test:browser:desktop] running the desktop smoke suite at ${provenance.viewport} against ${baseUrl}...`)
  mkdirSync(path.join(ROOT, '.artifacts', 'browser-desktop'), { recursive: true })

  const playwrightArgs = ['playwright', 'test', '--config', PLAYWRIGHT_CONFIG]
  const testRun = spawnSync('npx', playwrightArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      A3_BASE_URL: baseUrl,
      A3_EXPECT_SHA: expectSha ?? '',
      A3_EXPECT_NONCE: expectNonce ?? '',
      A3_VIEWPORT_WIDTH: String(args.width),
      A3_VIEWPORT_HEIGHT: String(args.height),
    },
  })
  process.stdout.write(testRun.stdout ?? '')
  process.stderr.write(testRun.stderr ?? '')

  killChild(previewChild)

  const combinedOutput = `${testRun.stdout ?? ''}\n${testRun.stderr ?? ''}`
  if (testRun.error || /Executable doesn't exist|Looks like Playwright Test or Playwright/i.test(combinedOutput)) {
    fail(
      EXIT.TOOLING,
      'Playwright browser binaries are missing. Run: npx playwright install chromium',
      provenance,
    )
  }

  if (testRun.status !== 0) {
    console.error(`\n[test:browser:desktop] the desktop smoke suite FAILED. See report: .artifacts/browser-desktop/report.json`)
    console.error('[test:browser:desktop] on-failure trace/screenshots: .artifacts/browser-desktop/test-results/')
    printProvenance(provenance)
    process.exit(EXIT.ASSERTION)
  }

  console.log('\n[test:browser:desktop] PASS')
  printProvenance(provenance)
  process.exit(EXIT.PASS)
}

main().catch((err) => {
  fail(EXIT.LIFECYCLE, err.stack ?? String(err))
})
