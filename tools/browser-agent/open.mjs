#!/usr/bin/env node
/**
 * tools/browser-agent/open.mjs — `npm run browser:agent:open`.
 *
 * Opens (or reuses) a named, provenance-verified Playwright CLI browser
 * session bound to a Runtime Provenance runtime. See tools/browser-agent/
 * README.md for the full contract; lib/orchestrate.mjs holds the actual
 * handshake (resolve runtime -> preflight -> open -> sidecar).
 *
 * Usage:
 *   npm run browser:agent:open -- --purpose CURRENT_MAIN
 *   npm run browser:agent:open -- --purpose TASK_CANDIDATE --lane engineering
 *   npm run browser:agent:open -- --purpose REVIEW_CANDIDATE --lane engineering-qa [--expected-sha <sha>] [--persistent]
 *
 * Exit codes: 0 OK · 2 PROVENANCE · 3 LIFECYCLE (bad usage) · 4 TOOLING.
 */

import { resolveExpectedSha, resolveRepoContext, runPreflight, startOrResolveRuntime } from './lib/runtime-bridge.mjs'
import { playwrightCliOpen, playwrightCliVersion } from './lib/playwright-cli-bridge.mjs'
import { defaultSidecarDir } from './lib/sidecar-store.mjs'
import { isValidPurpose, PURPOSES } from './lib/session-name.mjs'
import { runOpen } from './lib/orchestrate.mjs'
import { EXIT } from './lib/exit-codes.mjs'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) args[key] = true
    else {
      args[key] = next
      i++
    }
  }
  return args
}

function usage() {
  console.error(
    'Usage: npm run browser:agent:open -- --purpose ' +
      PURPOSES.join('|') +
      ' [--lane <lane>] [--expected-sha <sha>] [--persistent]\n' +
      '  --lane is required for TASK_CANDIDATE/REVIEW_CANDIDATE (distinguishes concurrent candidates/reviewers at the same sha).',
  )
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const purpose = args.purpose
  if (!isValidPurpose(purpose)) {
    usage()
    process.exit(EXIT.LIFECYCLE)
  }

  const cwd = process.cwd()
  const ctx = resolveRepoContext(cwd)
  if (!ctx) {
    console.error('[browser-agent:open] FAIL (exit 3): not inside a git worktree.')
    process.exit(EXIT.LIFECYCLE)
  }

  const expectedSha = resolveExpectedSha({ purpose, cwd, explicitSha: args['expected-sha'] })
  if (!expectedSha) {
    console.error('[browser-agent:open] FAIL (exit 3): could not resolve the expected sha for this purpose.')
    process.exit(EXIT.LIFECYCLE)
  }

  const sidecarDir = defaultSidecarDir(ctx.repoRoot)

  const result = runOpen(
    { purpose, lane: typeof args.lane === 'string' ? args.lane : undefined, expectedSha, persistent: Boolean(args.persistent), sidecarDir, worktree: ctx.worktree, repoRoot: ctx.repoRoot },
    {
      resolveRuntime: ({ purpose: p, expectedSha: sha }) => startOrResolveRuntime({ purpose: p, ctx, expectedSha: sha }),
      preflight: ({ expectedPurpose, expectedSha: sha, url }) => runPreflight({ expectedPurpose, expectedSha: sha, url, cwd: ctx.cwd }),
      playwrightOpen: ({ sessionName, url, persistent, outputDir }) => playwrightCliOpen({ sessionName, url, persistent, outputDir, cwd: ctx.cwd }),
      playwrightVersion: () => playwrightCliVersion({ cwd: ctx.cwd }),
      now: () => new Date().toISOString(),
    },
  )

  if (!result.ok) {
    console.error(`\n[browser-agent:open] FAIL (exit ${result.code}): ${result.message}`)
    process.exit(result.code)
  }

  console.log('\nBROWSER SESSION OPEN')
  console.log(`  SESSION NAME         : ${result.sessionName}${result.reused ? ' (reused)' : ''}`)
  console.log(`  PURPOSE              : ${result.record.purpose}`)
  console.log(`  EXPECTED SHA         : ${result.record.expectedSha}`)
  console.log(`  ACTUAL SHA           : ${result.record.actualSha}`)
  console.log(`  WORKTREE             : ${result.record.worktree}`)
  console.log(`  URL                  : ${result.record.url}`)
  console.log(`  PLAYWRIGHT CLI       : ${result.record.playwrightCliVersion ?? 'UNKNOWN'}`)
  console.log(`  PROVENANCE VERIFIED  : ${result.record.provenanceVerified}`)
  console.log(`  ARTIFACT DIRECTORY   : ${result.record.outputDir ?? '(default — see .playwright/cli.config.json)'}`)
  process.exit(EXIT.OK)
}

main()
