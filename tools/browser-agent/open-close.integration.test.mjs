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
import { readSidecar, listSidecars } from './lib/sidecar-store.mjs'

const FIXTURE = fileURLToPath(new URL('./lib/test-fixtures/fake-playwright-cli.mjs', import.meta.url))
const SHA = 'c'.repeat(40)

let sidecarDir
let logPath
let originalBin
let originalLog

beforeEach(() => {
  sidecarDir = mkdtempSync(path.join(tmpdir(), 'browser-agent-sidecars-'))
  logPath = path.join(mkdtempSync(path.join(tmpdir(), 'browser-agent-fake-cli-log-')), 'invocations.log')
  originalBin = process.env.A3_PLAYWRIGHT_CLI_BIN
  originalLog = process.env.A3_FAKE_PLAYWRIGHT_LOG
  process.env.A3_PLAYWRIGHT_CLI_BIN = JSON.stringify([process.execPath, FIXTURE])
  process.env.A3_FAKE_PLAYWRIGHT_LOG = logPath
})

afterEach(() => {
  rmSync(sidecarDir, { recursive: true, force: true })
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
      { purpose: 'TASK_CANDIDATE', lane: 'engineering', expectedSha: SHA, persistent: false, sidecarDir, worktree: '/repo/task-worktree' },
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

    // Real sidecar, really on disk.
    const sidecar = readSidecar(sidecarDir, result.sessionName)
    expect(sidecar).toMatchObject({
      sessionName: result.sessionName,
      purpose: 'TASK_CANDIDATE',
      lane: 'engineering',
      expectedSha: SHA,
      actualSha: SHA,
      worktree: '/repo/task-worktree',
      url,
      status: 'OPEN',
      provenanceVerified: true,
      playwrightCliVersion: 'Version 0.0.0-fake',
    })
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
    runOpen(
      { purpose: 'CURRENT_MAIN', expectedSha: 'd'.repeat(40), sidecarDir, worktree: '/repo/.preview/main' },
      {
        resolveRuntime: () => ({ ok: true, claim: { sha: '0'.repeat(40), url: 'http://127.0.0.1:43220', worktree: '/repo/.preview/main' } }),
        preflight: () => ({ ok: true, code: 0 }),
        playwrightOpen: (args) => playwrightCliOpen({ ...args, cwd: process.cwd() }),
        playwrightVersion: () => playwrightCliVersion({ cwd: process.cwd() }),
        now: () => '2026-08-19T00:00:00.000Z',
      },
    )

    const closed = runClose({ sessionName: opened.sessionName, sidecarDir }, { playwrightClose: () => playwrightCliClose({ sessionName: opened.sessionName, cwd: process.cwd() }) })

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
    const result = runClose({ sessionName: 'ghost-session', sidecarDir }, { playwrightClose: () => playwrightCliClose({ sessionName: 'ghost-session', cwd: process.cwd() }) })
    expect(result.ok).toBe(true)
    expect(result.sidecarFound).toBe(false)
  })
})
