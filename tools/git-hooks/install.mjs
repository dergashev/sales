#!/usr/bin/env node
/**
 * tools/git-hooks/install.mjs — `npm run git-hooks:install`
 *
 * Installs the repository's `pre-commit` hook (DELIVERY-INFRA-01 item 8:
 * `.agentsroom/**` control-state protection, plus the item-5 commit-time
 * root-checkout backstop). Wired to the npm `prepare` lifecycle script, so
 * it runs automatically on `npm install`/`npm ci` for every fresh clone —
 * this command exists separately for an EXISTING checkout that installed
 * its dependencies before this ticket, or to re-install after a manual
 * edit under `.git/hooks/`.
 *
 * Writes into `<git-common-dir>/hooks/pre-commit` — `.git/hooks/` is one
 * directory SHARED by every linked worktree of a repository by default (it
 * is not per-worktree), so installing once from any worktree covers all of
 * them, including ones created later.
 *
 * Idempotent and non-destructive: refuses (does not overwrite) an existing
 * `pre-commit` hook that was not itself installed by this script, unless
 * `--force` is passed. Never silently clobbers a hook a human or another
 * tool put there deliberately.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const MARKER = '# installed-by: tools/git-hooks/install.mjs (DELIVERY-INFRA-01)'

function gitCommonDir(cwd) {
  const result = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return path.resolve(cwd, result.stdout.trim())
}

function hookScript(repoRoot) {
  return [
    '#!/bin/sh',
    MARKER,
    '# Do not edit by hand — re-run "npm run git-hooks:install" instead.',
    'exec node "$(git rev-parse --show-toplevel)/tools/git-hooks/pre-commit-check.mjs"',
    '',
  ].join('\n')
}

function main() {
  const force = process.argv.includes('--force')
  const cwd = process.cwd()
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) {
    // Not inside a git repository (e.g. a packaging/CI context that never
    // clones with .git present) — this is not an installable error, just
    // nothing to do. `npm run prepare` must never fail an install over this.
    console.log('[git-hooks:install] not inside a git repository — skipping pre-commit hook install.')
    process.exit(0)
    return
  }

  const hooksDir = path.join(commonDir, 'hooks')
  mkdirSync(hooksDir, { recursive: true })
  const hookPath = path.join(hooksDir, 'pre-commit')

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8')
    if (!existing.includes(MARKER) && !force) {
      console.error(
        `[git-hooks:install] refusing to overwrite an existing pre-commit hook at "${hookPath}" that this script did not install. ` +
          'Re-run with --force if you want to replace it (this discards whatever it currently does).',
      )
      process.exit(1)
      return
    }
  }

  writeFileSync(hookPath, hookScript(), 'utf8')
  chmodSync(hookPath, 0o755)
  console.log(`[git-hooks:install] installed pre-commit hook at "${hookPath}" (shared by every worktree of this repository).`)
  process.exit(0)
}

main()
