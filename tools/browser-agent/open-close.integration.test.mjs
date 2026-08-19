// tools/browser-agent/open-close.integration.test.mjs
//
// ONE hermetic integration test proving the open -> sidecar -> close
// lifecycle end to end, without a real browser, a real Playwright install,
// or real network — mirroring the fake-vite-dev.mjs pattern
// tools/runtime/lib/runtime-lifecycle.integration.test.mjs already
// established for its own layer.
//
// Runtime resolution (`resolveRuntime`/`preflight`) is injected: proving
// `tools/runtime`'s OWN correctness is that module's test suite's job, and
// duplicating it here would be exactly the "duplicate Runtime Provenance
// logic" the architecture forbids. What THIS layer owns — and what this
// test actually exercises for real — is: deriving the right session name,
// really spawning the pinned CLI binary with the right argv (against
// lib/test-fixtures/fake-playwright-cli.mjs standing in for it), writing a
// correct sidecar, refusing closed before ever invoking the CLI when
// preflight fails, and removing only the one sidecar a close() call names.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runClose, runOpen } from './lib/orchestrate.mjs'
import { playwrightCliClose, playwrightCliOpen, playwrightCliVersion } from './lib/playwright-cli-bridge.mjs'
import * as sidecarStore from './lib/sidecar-store.mjs'
import { readSidecar, listSidecars } from './lib/sidecar-store.mjs'
import { sessionArtifactsDir, provenanceFilePath } from './lib/artifacts-dir.mjs'

const FIXTURE = fileURLToPath(new URL('./lib/test-fixtures/fake-playwright-cli.mjs', import.meta.url))
const SHA = 'c'.repeat(40)

let sidecarDir
let repoRoot
let logPath
let originalBin
let originalLog

beforeEach(() => {
  sidecarDir = mkdtempSync(path.join(tmpdir(), 'browser-agent-sidecars-'))
  repoRoot = mkdtempSync(path.join(tmpdir(), 'browser-agent-repo-root-'))
  logPath = path.join(mkdtempSync(path.join(tmpdir(), 'browser-agent-fake-cli-log-')), 'invocations.log')
  originalBin = process.env.A3_PLAYWRIGHT_CLI_BIN
  originalLog = process.env.A3_FAKE_PLAYWRIGHT_LOG
  process.env.A3_PLAYWRIGHT_CLI_BIN = JSON.stringify([process.execPath, FIXTURE])
  process.env.A3_FAKE_PLAYWRIGHT_LOG = logPath
})

afterEach(() => {
  rmSync(sidecarDir, { recursive: true, force: true })
  rmSync(repoRoot, { recursive: true, force: true })
  rmSync(path.dirname(logPath), { recursive: true, force: true })
  if (originalBin === undefined) delete process.env.A3_PLAYWRIGHT_CLI_BIN
  else process.env.A3_PLAYWRIGHT_CLI_BIN = originalBin
  if (originalLog === undefined) delete process.env.A3_FAKE_PLAYWRIGHT_LOG
  else process.env.A3_FAKE_PLAYWRIGHT_LOG = originalLog
  delete process.env.A3_FAKE_PLAYWRIGHT_EXIT_CODE
})

function loggedInvocations() {
  return readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

const verifiedRuntimeDeps = (url) => ({
  resolveRuntime: () => ({ ok: true, claim: { sha: SHA, url, worktree: '/repo/task-worktree' } }),
  preflight: () => ({ ok: true, code: 0 }),
})

describe('browser-agent open -> sidecar -> close lifecycle (hermetic)', () => {
  it('open: really spawns the pinned CLI with the right argv, and writes a correct sidecar', () => {
    const url = 'http://127.0.0.1:43217'
    const result = runOpen(
      { purpose: 'TASK_CANDIDATE', lane: 'engineering', expectedSha: SHA, persistent: false, sidecarDir, worktree: '/repo/task-worktree', repoRoot },
      {
        ...verifiedRuntimeDeps(url),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )

    expect(result.ok).toBe(true)
    expect(result.sessionName).toBe(`task-engineering-${SHA.slice(0, 12)}`)

    // Real argv actually sent to the (fake) pinned CLI binary: the open
    // call, then the descriptive (non-decisional) version lookup.
    const invocations = loggedInvocations()
    expect(invocations).toEqual([[`-s=${result.sessionName}`, 'open', url], ['--version']])

    const expectedOutputDir = sessionArtifactsDir(repoRoot, result.sessionName)

    // Real sidecar, really on disk.
    const sidecar = readSidecar(sidecarDir, result.sessionName)
    expect(sidecar).toMatchObject({
      sessionName: result.sessionName,
      purpose: 'TASK_CANDIDATE',
      lane: 'engineering',
      expectedSha: SHA,
      actualSha: SHA,
      worktree: '/repo/task-worktree',
      ownerWorkspace: '/repo/task-worktree', // for candidate purposes owner == runtime worktree
      url,
      status: 'OPEN',
      provenanceVerified: true,
      playwrightCliVersion: 'Version 0.0.0-fake',
      outputDir: expectedOutputDir,
    })

    // D2: a candidate-identifiable per-session artifact dir + provenance
    // sidecar, so a screenshot/snapshot/trace dropped in this exact
    // directory by the (real) CLI can never be confused with another
    // session's evidence.
    const provenance = JSON.parse(readFileSync(provenanceFilePath(expectedOutputDir), 'utf8'))
    expect(provenance).toMatchObject({
      sessionName: result.sessionName,
      purpose: 'TASK_CANDIDATE',
      expectedSha: SHA,
      actualSha: SHA,
      worktree: '/repo/task-worktree',
      url,
    })
  })

  it('two concurrent sessions at different shas get distinct, non-colliding artifact directories', () => {
    const shaA = 'a'.repeat(40)
    const shaB = 'b'.repeat(40)
    const openedA = runOpen(
      { purpose: 'REVIEW_CANDIDATE', lane: 'engineering-qa', expectedSha: shaA, sidecarDir, worktree: '/repo/wt-a', repoRoot },
      {
        resolveRuntime: () => ({ ok: true, claim: { sha: shaA, url: 'http://127.0.0.1:44001', worktree: '/repo/wt-a' } }),
        preflight: () => ({ ok: true, code: 0 }),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )
    const openedB = runOpen(
      { purpose: 'REVIEW_CANDIDATE', lane: 'engineering-qa', expectedSha: shaB, sidecarDir, worktree: '/repo/wt-b', repoRoot },
      {
        resolveRuntime: () => ({ ok: true, claim: { sha: shaB, url: 'http://127.0.0.1:44002', worktree: '/repo/wt-b' } }),
        preflight: () => ({ ok: true, code: 0 }),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:01.000Z',
      },
    )

    expect(openedA.ok).toBe(true)
    expect(openedB.ok).toBe(true)
    expect(openedA.record.outputDir).not.toBe(openedB.record.outputDir)

    const provenanceA = JSON.parse(readFileSync(provenanceFilePath(openedA.record.outputDir), 'utf8'))
    const provenanceB = JSON.parse(readFileSync(provenanceFilePath(openedB.record.outputDir), 'utf8'))
    expect(provenanceA.actualSha).toBe(shaA)
    expect(provenanceB.actualSha).toBe(shaB)
  })

  it('a failed preflight refuses closed and never invokes the pinned CLI at all', () => {
    const result = runOpen(
      { purpose: 'REVIEW_CANDIDATE', lane: 'engineering-qa', expectedSha: SHA, sidecarDir, worktree: '/repo/review-worktree' },
      {
        resolveRuntime: () => ({ ok: true, claim: { sha: SHA, url: 'http://127.0.0.1:43218', worktree: '/repo/review-worktree' } }),
        preflight: () => ({ ok: false, code: 2 }),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )

    expect(result.ok).toBe(false)
    expect(result.code).toBe(2)
    expect(() => readFileSync(logPath, 'utf8')).toThrow() // fixture was never invoked -> log file was never created
    expect(listSidecars(sidecarDir)).toEqual([])
  })

  it('close: removes exactly the closed session sidecar and leaves an unrelated one untouched', () => {
    const url = 'http://127.0.0.1:43219'
    const opened = runOpen(
      { purpose: 'TASK_CANDIDATE', lane: 'engineering', expectedSha: SHA, sidecarDir, worktree: '/repo/task-worktree' },
      {
        ...verifiedRuntimeDeps(url),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )
    expect(opened.ok).toBe(true)

    // An unrelated session's sidecar must survive the close below untouched.
    // Tech Review cycle 3: the CURRENT_MAIN fixture MUST model production's
    // real asymmetry — the caller opens from its own worktree while the
    // runtime claim always names .preview/main. Setting them equal here
    // previously hid a live defect behind a state that cannot occur.
    runOpen(
      { purpose: 'CURRENT_MAIN', expectedSha: 'd'.repeat(40), sidecarDir, worktree: '/repo/task-worktree' },
      {
        resolveRuntime: () => ({ ok: true, claim: { sha: '0'.repeat(40), url: 'http://127.0.0.1:43220', worktree: '/repo/.preview/main' } }),
        preflight: () => ({ ok: true, code: 0 }),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )

    // Closing from the SAME worktree that opened it must still work exactly as before.
    const closed = runClose(
      { sessionName: opened.sessionName, sidecarDir, worktree: '/repo/task-worktree' },
      { playwrightClose: () => playwrightCliClose({ sessionName: opened.sessionName, cwd: process.cwd() }) },
    )

    expect(closed.ok).toBe(true)
    expect(closed.sidecarFound).toBe(true)
    expect(readSidecar(sidecarDir, opened.sessionName)).toBeNull()

    const remaining = listSidecars(sidecarDir)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].purpose).toBe('CURRENT_MAIN')

    const invocations = loggedInvocations()
    expect(invocations.at(-1)).toEqual([`-s=${opened.sessionName}`, 'close'])
  })

  it('closing a session with no tracked sidecar still only touches that one name, best-effort', () => {
    const result = runClose({ sessionName: 'ghost-session', sidecarDir, worktree: '/repo/task-worktree' }, { playwrightClose: () => playwrightCliClose({ sessionName: 'ghost-session', cwd: process.cwd() }) })
    expect(result.ok).toBe(true)
    expect(result.sidecarFound).toBe(false)
  })

  it('Engineering QA P1 regression: closing from a DIFFERENT worktree than the one that opened the session refuses closed, keeps the sidecar, and never invokes the real CLI at all', () => {
    const url = 'http://127.0.0.1:43221'
    const opened = runOpen(
      { purpose: 'TASK_CANDIDATE', lane: 'engineering', expectedSha: SHA, sidecarDir, worktree: '/repo/task-worktree' },
      {
        ...verifiedRuntimeDeps(url),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )
    expect(opened.ok).toBe(true)

    // The real @playwright/cli's own session registry is scoped per-workspace, so a close
    // attempted from a different worktree than the one that opened the session would get a
    // generic "not open" exit 0 from the real CLI — indistinguishable from "already closed".
    // This must be refused BEFORE ever asking the real CLI, purely from the sidecar's own
    // recorded worktree vs. the caller's actual one.
    const closed = runClose(
      { sessionName: opened.sessionName, sidecarDir, worktree: '/repo/OTHER-worktree' },
      { playwrightClose: () => playwrightCliClose({ sessionName: opened.sessionName, cwd: process.cwd() }) },
    )

    expect(closed.ok).toBe(false)
    expect(closed.code).toBe(2)
    expect(closed.message).toMatch(/task-worktree/)
    expect(closed.message).toMatch(/OTHER-worktree/)

    // The sidecar — the only record this layer keeps — must survive untouched, and the real
    // CLI must never have been asked to close this session (only `open` + the descriptive
    // `--version` lookup from opening it above may appear in the log).
    expect(readSidecar(sidecarDir, opened.sessionName)).not.toBeNull()
    expect(loggedInvocations().some((argv) => argv.includes('close'))).toBe(false)
  })

  it('Tech Review cycle-3 regression: a CURRENT_MAIN session (runtime worktree .preview/main) IS closeable from the workspace that opened it, and NOT from a foreign one', () => {
    // Production's real shape: the caller opens from its own worktree; the
    // CURRENT_MAIN runtime claim always names .preview/main. Ownership
    // belongs to the OPENER, not to the runtime's checkout.
    const opened = runOpen(
      { purpose: 'CURRENT_MAIN', expectedSha: 'e'.repeat(40), sidecarDir, worktree: '/repo/task-worktree', repoRoot },
      {
        resolveRuntime: () => ({ ok: true, claim: { sha: 'e'.repeat(40), url: 'http://127.0.0.1:43222', worktree: '/repo/.preview/main' } }),
        preflight: () => ({ ok: true, code: 0 }),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )
    expect(opened.ok).toBe(true)

    // The two facts are recorded distinctly and must not be conflated:
    const sidecar = readSidecar(sidecarDir, opened.sessionName)
    expect(sidecar.worktree).toBe('/repo/.preview/main') // runtime provenance — unchanged meaning
    expect(sidecar.ownerWorkspace).toBe('/repo/task-worktree') // session ownership — the opener

    // A foreign workspace must refuse (and .preview/main itself IS foreign here:
    // nothing ever opened a session from inside the preview checkout).
    const foreign = runClose(
      { sessionName: opened.sessionName, sidecarDir, worktree: '/repo/.preview/main' },
      { playwrightClose: () => playwrightCliClose({ sessionName: opened.sessionName, cwd: process.cwd() }) },
    )
    expect(foreign.ok).toBe(false)
    expect(foreign.code).toBe(2)
    expect(readSidecar(sidecarDir, opened.sessionName)).not.toBeNull()

    // The workspace that actually opened it closes it fine — the exact
    // operation Tech Review proved impossible in the previous candidate.
    const owner = runClose(
      { sessionName: opened.sessionName, sidecarDir, worktree: '/repo/task-worktree' },
      { playwrightClose: () => playwrightCliClose({ sessionName: opened.sessionName, cwd: process.cwd() }) },
    )
    expect(owner.ok).toBe(true)
    expect(owner.sidecarFound).toBe(true)
    expect(readSidecar(sidecarDir, opened.sessionName)).toBeNull()
  })

  it('a pre-ownerWorkspace sidecar (written before the field existed) still closes best-effort — backward compatible by construction', () => {
    const { writeSidecar } = sidecarStore
    writeSidecar(sidecarDir, 'legacy-session', { sessionName: 'legacy-session', purpose: 'TASK_CANDIDATE', worktree: '/repo/somewhere-else', url: 'http://127.0.0.1:43223' })

    const closed = runClose(
      { sessionName: 'legacy-session', sidecarDir, worktree: '/repo/task-worktree' },
      { playwrightClose: () => playwrightCliClose({ sessionName: 'legacy-session', cwd: process.cwd() }) },
    )
    expect(closed.ok).toBe(true)
    expect(closed.sidecarFound).toBe(true)
    expect(readSidecar(sidecarDir, 'legacy-session')).toBeNull()
  })
})
