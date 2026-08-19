#!/usr/bin/env node
// tools/browser-agent/lib/test-fixtures/fake-playwright-cli.mjs
//
// Stands in for the real, pinned `@playwright/cli` binary in
// open-close.integration.test.mjs — same spirit as
// tools/runtime/lib/test-fixtures/fake-vite-dev.mjs standing in for `vite`:
// a small REAL process, invoked as a REAL child process via the exact same
// argv shape playwright-cli-bridge.mjs uses in production
// (`-s=<name> open <url> [--persistent]`, `-s=<name> close`, `--version`),
// so the test exercises real spawning/argv/exit-code wiring without a real
// browser, a real download, or real network.
//
// Every invocation appends its argv to `A3_FAKE_PLAYWRIGHT_LOG` (one JSON
// array per line) so the test can assert exactly what this layer sent to
// "playwright-cli" — including proving it is NEVER invoked at all when
// preflight refuses first.
//
// Set `A3_FAKE_PLAYWRIGHT_EXIT_CODE` to force a non-zero exit, for the
// "playwright-cli itself fails" path.

import { appendFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const logPath = process.env.A3_FAKE_PLAYWRIGHT_LOG
if (logPath) appendFileSync(logPath, `${JSON.stringify(argv)}\n`)

const forcedExit = process.env.A3_FAKE_PLAYWRIGHT_EXIT_CODE
if (forcedExit) process.exit(Number(forcedExit))

if (argv.includes('--version')) {
  console.log('Version 0.0.0-fake')
  process.exit(0)
}

const sub = argv.find((a) => !a.startsWith('-'))
if (sub === 'open' || sub === 'close') process.exit(0)

process.exit(1)
