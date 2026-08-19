#!/usr/bin/env node
/**
 * tools/browser-agent/close.mjs — `npm run browser:agent:close`.
 *
 * Closes exactly ONE named session and removes exactly its own sidecar.
 * Never `close-all`/`kill-all` (ticket "SESSION CLEANUP"): this script has
 * no code path that can even express a broad close.
 *
 * Usage: npm run browser:agent:close -- --session <name>
 * Exit codes: 0 OK (closed, or nothing to do) · 3 LIFECYCLE (bad usage) · 4 TOOLING (CLI could not be run at all).
 */

import { resolveRepoContext } from './lib/runtime-bridge.mjs'
import { playwrightCliClose } from './lib/playwright-cli-bridge.mjs'
import { defaultSidecarDir } from './lib/sidecar-store.mjs'
import { runClose } from './lib/orchestrate.mjs'
import { EXIT } from './lib/exit-codes.mjs'

function main() {
  const argv = process.argv.slice(2)
  const idx = argv.indexOf('--session')
  const sessionName = idx >= 0 ? argv[idx + 1] : undefined
  if (!sessionName) {
    console.error('Usage: npm run browser:agent:close -- --session <name>')
    process.exit(EXIT.LIFECYCLE)
  }

  const cwd = process.cwd()
  const ctx = resolveRepoContext(cwd)
  if (!ctx) {
    console.error('[browser-agent:close] FAIL (exit 3): not inside a git worktree.')
    process.exit(EXIT.LIFECYCLE)
  }

  const sidecarDir = defaultSidecarDir(ctx.repoRoot)
  const result = runClose({ sessionName, sidecarDir }, { playwrightClose: () => playwrightCliClose({ sessionName, cwd: ctx.cwd }) })

  if (!result.ok) {
    console.error(`\n[browser-agent:close] FAIL (exit ${result.code}): ${result.message}`)
    process.exit(result.code)
  }

  if (!result.sidecarFound) {
    console.log(`[browser-agent:close] "${sessionName}" had no tracked sidecar here (closed best-effort; may have been opened outside this tooling, or already closed).`)
  } else {
    console.log(`[browser-agent:close] closed "${sessionName}" and removed its sidecar. Other sessions are untouched.`)
  }
  process.exit(EXIT.OK)
}

main()
