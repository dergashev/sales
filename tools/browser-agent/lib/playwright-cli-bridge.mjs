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

// `NO_UPDATE_NOTIFIER=1` (D3): every non-`install` invocation of the real
// CLI otherwise fetches registry.npmjs.org to check for a newer version and
// prints an upgrade nag — a network call on a provenance-critical hot path,
// and one that contradicts this task's pinned-version policy. Applied to
// EVERY spawn from this module, not just `open`, since `close`/`--version`
// go through the same real binary. Merged under any caller-supplied `env`
// (e.g. D2's per-session PLAYWRIGHT_MCP_OUTPUT_DIR) so neither silently
// drops the other.
function run(args, opts) {
  const { cmd, baseArgs } = resolveCommand()
  const fullArgs = [...baseArgs, ...args]
  const env = { ...process.env, NO_UPDATE_NOTIFIER: '1', ...(opts.env || {}) }
  const result = spawnSync(cmd, fullArgs, { ...opts, env })
  return { result, describe: `${cmd} ${fullArgs.join(' ')}` }
}

/**
 * @param {object} opts
 * @param {string} [opts.outputDir] - D2: absolute per-session artifact dir. The official CLI reads
 *   `PLAYWRIGHT_MCP_OUTPUT_DIR` once, at daemon creation (`-s=<name> open` spawns a detached daemon
 *   process that inherits this env; later `-s=<name> screenshot|tracing-start|...` calls only ever
 *   talk to that same already-running daemon over its socket, never re-spawning or re-reading env) —
 *   so binding it here, at `open`, is sufficient for the whole session's lifetime. Confirmed by
 *   reading the installed @playwright/cli 0.1.18 / playwright-core source directly (`session.js`'s
 *   `startDaemon` passes no `env` override to `child_process.spawn`, so it inherits this process's
 *   env verbatim; `coreBundle.js`'s `configFromEnv` reads `PLAYWRIGHT_MCP_OUTPUT_DIR` once at config
 *   build time) — not merely assumed.
 */
export function playwrightCliOpen({ sessionName, url, persistent, outputDir, cwd }) {
  const args = [`-s=${sessionName}`, 'open', url]
  if (persistent) args.push('--persistent')
  const spawnOpts = { cwd, stdio: 'inherit' }
  if (outputDir) spawnOpts.env = { PLAYWRIGHT_MCP_OUTPUT_DIR: outputDir }
  const { result, describe } = run(args, spawnOpts)
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
