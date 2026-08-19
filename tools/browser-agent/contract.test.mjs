// tools/browser-agent/contract.test.mjs
//
// D5 (Engineering Architecture): the ticket's own "REGRESSION TESTS"
// section names several invariants this layer must never silently regress
// on. The ones that are genuinely repository-artifact facts (dependency
// pin, which binary the wrapper spawns, tracked config shape, ignore
// rules) are asserted here, directly against the real files — no fixture,
// no mock, so a future edit to package.json/.gitignore/the tracked
// Playwright config trips this test immediately. Runtime-behavioral
// invariants (mismatched-sha refusal, session-name collisions, sidecar
// freshness, one-session-only cleanup) already have their own coverage in
// lib/decide.test.mjs and open-close.integration.test.mjs and are not
// duplicated here.

import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { git } from '../gate/lib/git-worktrees.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const BROWSER_AGENT_DIR = fileURLToPath(new URL('.', import.meta.url))

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relPath), 'utf8'))
}

function readText(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8')
}

describe('dependency pin — never an unpinned/mutable production path', () => {
  const pkg = readJson('package.json')

  it('@playwright/cli is pinned to an exact version — no ^, ~, "latest", or range', () => {
    const pinned = pkg.devDependencies?.['@playwright/cli']
    expect(pinned).toBeTruthy()
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('every browser:agent:* script invokes either the repository wrapper or the bare npm-injected "playwright-cli" — nothing else', () => {
    // Ticket regression list: "official Playwright CLI is silently replaced by
    // another package/wrapper" / "unpinned CLI dependency becomes the
    // production path". Positive assertion on what each script IS, not merely
    // the absence of a -g flag: every command segment (split on && ) must be
    // either `node tools/browser-agent/<entrypoint>.mjs` (the repository
    // wrapper) or a bare `playwright-cli …` invocation (npm resolves that to
    // this repo's own node_modules/.bin, never a developer-global install).
    for (const key of ['browser:agent:open', 'browser:agent:status', 'browser:agent:close', 'browser:agent:show', 'browser:agent:setup']) {
      const script = pkg.scripts[key]
      expect(script, `script ${key} must exist`).toBeTruthy()
      for (const segment of script.split('&&').map((s) => s.trim())) {
        expect(segment, `script ${key} segment "${segment}" must be the repo wrapper or the bare local playwright-cli`).toMatch(
          /^(node tools\/browser-agent\/[a-z-]+\.mjs|playwright-cli( .*)?)$/,
        )
      }
    }
  })

  it('the npm-injected "playwright-cli" binary really is @playwright/cli\'s own entrypoint (not a same-named impostor)', () => {
    const binPath = path.join(REPO_ROOT, 'node_modules', '.bin', 'playwright-cli')
    const realPath = realpathSync(binPath)
    const cliDir = path.dirname(realpathSync(path.join(REPO_ROOT, 'node_modules', '@playwright', 'cli', 'package.json')))
    expect(realPath.startsWith(cliDir + path.sep), `${realPath} must live inside ${cliDir}`).toBe(true)
  })
})

describe('official binary only — the wrapper never spawns a third-party/forked CLI', () => {
  const bridgeSource = readText('tools/browser-agent/lib/playwright-cli-bridge.mjs')

  it('the default (non-test) resolved command is the official "playwright-cli" binary', () => {
    expect(bridgeSource).toMatch(/cmd:\s*'playwright-cli'/)
  })

  it('the only escape hatch is the documented test-fixture override env var, not a second production path', () => {
    expect(bridgeSource).toMatch(/A3_PLAYWRIGHT_CLI_BIN/)
  })
})

describe('no hard-coded dev-server ports under tools/browser-agent/', () => {
  // Comments are stripped before matching so a docblock may NAME "5173" in
  // prose (decide.mjs's does, to explain the anti-pattern parseRuntimeUrl
  // exists to avoid) without either creating a false positive or forcing the
  // one module that actually holds the port logic out of the scan — the
  // coverage hole Tech Review flagged in the previous candidate. Crude
  // stripping (regex, not a JS parser) is sufficient here: a port literal
  // smuggled inside a string still survives stripping and fails the test.
  function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  }

  it('never assumes localhost:5173 or :5174 as a code literal — the URL always comes from the Runtime Provenance resolver', () => {
    for (const file of ['open.mjs', 'close.mjs', 'status.mjs', 'lib/orchestrate.mjs', 'lib/runtime-bridge.mjs', 'lib/playwright-cli-bridge.mjs', 'lib/session-name.mjs', 'lib/decide.mjs', 'lib/artifacts-dir.mjs', 'lib/skill-status.mjs', 'lib/sidecar-store.mjs', 'lib/exit-codes.mjs']) {
      const source = stripComments(readFileSync(path.join(BROWSER_AGENT_DIR, file), 'utf8'))
      expect(source, `${file} must not hard-code port 5173`).not.toMatch(/5173/)
      expect(source, `${file} must not hard-code port 5174`).not.toMatch(/5174/)
    }
  })
})

describe('tracked Playwright CLI config — isolation and viewport are explicit, not left to CLI/global defaults', () => {
  const config = readJson('.playwright/cli.config.json')

  it('isolated sessions stay the default (no accidental cross-task profile sharing)', () => {
    expect(config.browser.isolated).toBe(true)
  })

  it('viewport matches the existing authoritative desktop contract (1440x900)', () => {
    expect(config.browser.contextOptions.viewport).toEqual({ width: 1440, height: 900 })
  })

  it('a flat outputDir base is still declared (per-session subdirectories are layered on top of it at runtime, see lib/artifacts-dir.mjs)', () => {
    expect(config.outputDir).toBe('.artifacts/browser-agent')
  })
})

describe('open.mjs threads D2\'s per-session outputDir all the way through to the real CLI spawn', () => {
  // Regression for a real bug caught only by empirically running the real
  // CLI: orchestrate.mjs's runOpen computes and passes `outputDir` to
  // `deps.playwrightOpen`, but open.mjs's CLI-entrypoint wiring for that
  // dep once destructured only `{ sessionName, url, persistent }` and
  // silently dropped `outputDir` before calling playwrightCliOpen — every
  // hermetic test still passed (they inject their own `playwrightOpen` that
  // spreads all args), so only a real `npm run browser:agent:open` +
  // screenshot against a real runtime revealed it landing artifacts in the
  // flat shared directory instead of the per-session one.
  it('the playwrightOpen dependency wiring in open.mjs forwards outputDir to playwrightCliOpen', () => {
    const source = readText('tools/browser-agent/open.mjs')
    const wiringLine = source.split('\n').find((line) => line.includes('playwrightOpen:'))
    expect(wiringLine, 'expected a "playwrightOpen:" dependency wiring line in open.mjs').toBeTruthy()
    expect(wiringLine).toMatch(/outputDir/)
  })
})

describe('artifact/skill locations are git-ignored — this layer never pollutes the tracked tree', () => {
  const paths = ['.artifacts/browser-agent/some-session/provenance.json', '.artifacts/browser-agent-sessions/some-session.json', '.claude/skills/playwright-cli/SKILL.md', '.agents/skills/playwright-cli/SKILL.md']

  it.each(paths)('%s is ignored by git', (relPath) => {
    expect(git(REPO_ROOT, ['check-ignore', relPath])).not.toBeNull()
  })
})
