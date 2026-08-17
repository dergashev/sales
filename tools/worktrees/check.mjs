#!/usr/bin/env node
/**
 * tools/worktrees/check.mjs — `npm run git:worktrees:check`
 *
 * Read-only diagnostic over the repository's registered worktrees, current
 * `main`, and the canonical local-main preview. Reports before any
 * mutation — it never prunes, removes, unlocks, or checks out anything.
 * Use `tools/worktrees/release-cleanup.mjs` / `tools/worktrees/dev-main.mjs`
 * to act on what this reports.
 *
 * Exit codes:
 *   0  report printed (the default — this tool does not "fail" merely
 *      because it found something to report; that is its whole purpose)
 *   1  --strict was given AND at least one stale/prunable/locked/dirty/
 *      stale-preview condition was found
 *   3  git itself could not be queried (worktree list / rev-parse main)
 */

import path from 'node:path'

import { dirtyEntries, git, gitCommonDir, listWorktrees, samePath } from '../gate/lib/git-worktrees.mjs'
import { defaultPreviewStatePath, readPreviewState } from './lib/preview-state.mjs'

const EXIT = { OK: 0, ISSUES_STRICT: 1, LIFECYCLE: 3 }

function parseArgs(argv) {
  const args = { strict: false, previewPath: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--strict') args.strict = true
    else if (a === '--preview-path') args.previewPath = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log('Usage: npm run git:worktrees:check -- [--strict] [--preview-path <dir>]')
      process.exit(EXIT.OK)
    }
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()

  const worktrees = listWorktrees(cwd)
  if (worktrees === null) {
    console.error('[worktrees:check] LIFECYCLE FAILURE: "git worktree list --porcelain" failed.')
    process.exit(EXIT.LIFECYCLE)
    return
  }

  const commonDir = gitCommonDir(cwd)
  if (!commonDir) {
    console.error('[worktrees:check] LIFECYCLE FAILURE: "git rev-parse --git-common-dir" failed.')
    process.exit(EXIT.LIFECYCLE)
    return
  }
  const repoRoot = path.dirname(commonDir)

  const mainSha = git(cwd, ['rev-parse', 'main'])

  const previewPath = path.resolve(repoRoot, args.previewPath || process.env.A3_PREVIEW_DIR || '.preview/main')
  const previewState = readPreviewState(defaultPreviewStatePath(commonDir))

  console.log('WORKTREE REPORT')
  console.log(`  REPO ROOT   : ${repoRoot}`)
  console.log(`  MAIN SHA    : ${mainSha ?? 'UNRESOLVED'}`)
  console.log('')
  console.log('REGISTERED WORKTREES')

  let issues = 0
  for (const w of worktrees) {
    const ownsMain = w.branch === 'main'
    let dirtyLabel = 'n/a'
    let stateLabel = 'present'
    if (w.locked) {
      stateLabel = `locked (${w.lockReason || 'no reason given'})`
      issues++
    } else if (w.prunable) {
      stateLabel = `prunable (${w.prunableReason || 'missing/broken worktree'})  <-- STALE REGISTRATION`
      issues++
    } else {
      const dirty = dirtyEntries(w.path)
      dirtyLabel = dirty === null ? 'UNKNOWN (git status failed)' : dirty.length > 0 ? `dirty (${dirty.length} entr${dirty.length === 1 ? 'y' : 'ies'})` : 'clean'
      if (dirty && dirty.length > 0) issues++
    }

    console.log(`  - ${w.path}`)
    console.log(`      sha      : ${w.sha ?? 'UNRESOLVED'}`)
    console.log(`      branch   : ${w.detached ? 'DETACHED' : w.branch ?? 'UNRESOLVED'}${ownsMain ? '  <- owns "main"' : ''}`)
    console.log(`      state    : ${stateLabel}`)
    console.log(`      dirty    : ${dirtyLabel}`)
  }

  console.log('')
  console.log('LOCAL MAIN PREVIEW')
  console.log(`  EXPECTED PATH : ${previewPath}`)
  if (!previewState) {
    console.log('  STATUS        : never created (run "npm run dev:main" to create it)')
  } else {
    const stillRegistered = worktrees.some((w) => samePath(w.path, previewPath))
    const staleLabel = previewState.sha !== mainSha ? '  <-- STALE (main has advanced since last preview refresh)' : ''
    console.log(`  LAST PREVIEW SHA : ${previewState.sha}${staleLabel}`)
    console.log(`  REGISTERED       : ${stillRegistered}`)
    console.log(`  LAST REFRESHED AT: ${previewState.updatedAt ?? 'UNKNOWN'}`)
    if (previewState.sha !== mainSha) issues++
  }

  console.log('')
  console.log(`SUMMARY: ${issues} issue(s) found (stale/locked registration, dirty worktree, or stale preview).`)

  if (args.strict && issues > 0) {
    process.exit(EXIT.ISSUES_STRICT)
    return
  }
  process.exit(EXIT.OK)
}

main()
