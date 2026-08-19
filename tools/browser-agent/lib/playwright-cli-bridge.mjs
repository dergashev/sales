// tools/browser-agent/lib/playwright-cli-bridge.mjs
//
// The ONLY module that shells out to the pinned `@playwright/cli` binary
// itself. `A3_PLAYWRIGHT_CLI_BIN` overrides which command is invoked — same
// seam convention `tools/runtime/main.mjs` already uses for
// `A3_PREVIEW_DIR` — so tests can point this at a small real fixture
// process instead of the real CLI (open-close.integration.test.mjs)
// without any mocking of this module itself. The override is a JSON array
// of `[command, ...leadingArgs]` (never a whitespace-split string — this
// repository's own checkout path contains spaces, e.g. ".../Sales Platform
// 2.0/...", which a naive `string.split(' ')` would silently mangle), the
// same "explicit interpreter, not the executable bit" shape
// tools/runtime/lib/test-fixtures/fake-vite-dev.mjs already relies on
// (committed as a plain 100644 file, always run via `node <path>`) —
// portable regardless of how git/the OS preserved file permissions.
// Production code never sets the env var, so it always resolves the pinned
// local `playwright-cli` from node_modules/.bin (the same PATH `npm run`
// already injects for every other bare command in package.json's scripts,
// e.g. `vite`, `tsc`).

import { spawnSync } from 'node:child_process'

function resolveCommand() {
  const raw = process.env.A3_PLAYWRIGHT_CLI_BIN
  if (!raw) return { cmd: 'playwright-cli', baseArgs: [] }
  const [cmd, ...baseArgs] = JSON.parse(raw)
  return { cmd, baseArgs }
}

function run(args, opts) {
  const { cmd, baseArgs } = resolveCommand()
  const fullArgs = [...baseArgs, ...args]
  const result = spawnSync(cmd, fullArgs, { ...opts })
  return { result, describe: `${cmd} ${fullArgs.join(' ')}` }
}

export function playwrightCliOpen({ sessionName, url, persistent, cwd }) {
  const args = [`-s=${sessionName}`, 'open', url]
  if (persistent) args.push('--persistent')
  const { result, describe } = run(args, { cwd, stdio: 'inherit' })
  if (result.error) return { ok: false, code: 4, reason: `Could not spawn "${describe}": ${result.error.message}` }
  return { ok: result.status === 0, code: result.status }
}

export function playwrightCliClose({ sessionName, cwd }) {
  const { result, describe } = run([`-s=${sessionName}`, 'close'], { cwd, stdio: 'inherit' })
  if (result.error) return { ok: false, code: 4, reason: `Could not spawn "${describe}": ${result.error.message}`, spawnFailed: true }
  return { ok: result.status === 0, code: result.status, spawnFailed: false }
}

/** Descriptive metadata only — never used for a provenance/pass-fail decision. */
export function playwrightCliVersion({ cwd }) {
  const { result } = run(['--version'], { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return result.stdout.trim() || null
}
