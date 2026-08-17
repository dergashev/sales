#!/usr/bin/env node
/**
 * tools/worktrees/dev-main.mjs — `npm run dev:main`
 *
 * Canonical, provenance-proving way to open the latest accepted local
 * `main` — without guessing which worktree has it, without touching the
 * caller's own checkout, and without ever silently serving something
 * other than exactly what `git rev-parse main` currently resolves to.
 *
 * Lifecycle (ticket §4/§5/§7):
 *   1. resolve MAIN SHA directly from git (`git rev-parse main`), never from
 *      the invoking cwd's branch/worktree.
 *   2. resolve/create a DETACHED preview worktree at `.preview/main` (or
 *      $A3_PREVIEW_DIR) — detached so it never competes for ownership of
 *      the `main` branch the way a branch checkout would.
 *   3. if the preview is dirty and main has moved: refuse (exit 2), never
 *      discard uncommitted work.
 *   4. install dependencies only when needed (missing node_modules, or the
 *      committed lockfile changed since the last refresh).
 *   5. re-verify PREVIEW HEAD == MAIN SHA one last time, print the
 *      provenance block, then serve `npm run dev` from that exact worktree.
 *
 * The caller's own working directory/branch is never read for git state
 * beyond resolving the repository's common .git dir, and is never written
 * to at all.
 *
 * Exit codes: 0 clean exit of the dev server · 2 provenance refusal (dirty
 * preview) · 3 worktree/git lifecycle failure · 4 npm/install failure.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

import { dirtyEntries, git, gitCommonDir, headSha, listWorktrees, samePath } from '../gate/lib/git-worktrees.mjs'
import { planPreviewRefresh } from './lib/worktree-lifecycle.mjs'
import { defaultPreviewStatePath, updatePreviewState } from './lib/preview-state.mjs'
import { findFreePort } from './lib/free-port.mjs'

const EXIT = { OK: 0, PROVENANCE: 2, LIFECYCLE: 3, TOOLING: 4 }

function fail(code, message) {
  console.error(`\n[dev:main] ${code === EXIT.PROVENANCE ? 'PROVENANCE REFUSAL' : code === EXIT.TOOLING ? 'TOOLING FAILURE' : 'LIFECYCLE FAILURE'} (exit ${code}): ${message}`)
  process.exit(code)
}

function lockfileHash(dir) {
  const lockPath = path.join(dir, 'package-lock.json')
  if (!existsSync(lockPath)) return null
  return createHash('sha256').update(readFileSync(lockPath)).digest('hex')
}

async function ensureDependencies(previewDir, statePath) {
  const currentHash = lockfileHash(previewDir)
  const state = updatePreviewState(statePath, (current) => current || {})
  const needsInstall = !existsSync(path.join(previewDir, 'node_modules')) || state.installedLockHash !== currentHash

  if (!needsInstall) return

  console.log(`[dev:main] installing dependencies in ${previewDir} (npm ci)...`)
  const result = spawnSync('npm', ['ci'], { cwd: previewDir, stdio: 'inherit', env: process.env })
  if (result.error || result.status !== 0) {
    fail(EXIT.TOOLING, `"npm ci" failed in ${previewDir}. If npm is not on PATH, export PATH="$HOME/.local/bin:$PATH" (see project memory: global/conventions/validation-and-release-gates.md).`)
    return
  }
  updatePreviewState(statePath, (curr) => ({ ...(curr || {}), installedLockHash: currentHash }))
}

async function main() {
  const cwd = process.cwd()

  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, '"git rev-parse --git-common-dir" failed. Is this a git repository?')
  const repoRoot = path.dirname(commonDir)

  const mainSha = git(cwd, ['rev-parse', 'main'])
  if (!mainSha) return fail(EXIT.LIFECYCLE, '"git rev-parse main" failed. Does the local "main" branch exist?')

  const previewPath = path.resolve(repoRoot, process.env.A3_PREVIEW_DIR || '.preview/main')
  const statePath = defaultPreviewStatePath(commonDir)

  const worktrees = listWorktrees(repoRoot)
  if (worktrees === null) return fail(EXIT.LIFECYCLE, '"git worktree list --porcelain" failed.')

  const plan = planPreviewRefresh({
    mainSha,
    worktrees,
    previewPath,
    existsFn: existsSync,
    dirtyEntriesFn: dirtyEntries,
    samePathFn: samePath,
  })

  if (plan.action === 'blocked') return fail(EXIT.LIFECYCLE, plan.reason)
  if (plan.action === 'refuse-dirty') return fail(EXIT.PROVENANCE, `${plan.reason} ${plan.unblockingRequirement}`)

  if (plan.action === 'recreate') {
    // Git itself reports this registration prunable (directory/gitdir
    // gone) — never seen in dev:main's own normal lifecycle, but if the
    // preview was hand-deleted outside this tool, prune first (git-native)
    // then fall through to the same creation path as a brand-new preview.
    console.log(`[dev:main] ${plan.reason}`)
    const prune = spawnSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'inherit' })
    if (prune.status !== 0) return fail(EXIT.LIFECYCLE, `"git worktree prune" failed for ${previewPath}.`)
  }

  if (plan.action === 'create' || plan.action === 'recreate') {
    console.log(`[dev:main] creating detached preview worktree at ${previewPath} (main @ ${mainSha})...`)
    mkdirSync(path.dirname(previewPath), { recursive: true })
    const add = spawnSync('git', ['worktree', 'add', '--detach', previewPath, mainSha], { cwd: repoRoot, stdio: 'inherit' })
    if (add.status !== 0) return fail(EXIT.LIFECYCLE, `"git worktree add --detach" failed for ${previewPath}.`)
  } else if (plan.action === 'checkout') {
    console.log(`[dev:main] preview is clean at ${plan.from}; main has advanced to ${plan.sha} — refreshing.`)
    const checkout = spawnSync('git', ['checkout', '--detach', plan.sha], { cwd: previewPath, stdio: 'inherit' })
    if (checkout.status !== 0) return fail(EXIT.LIFECYCLE, `"git checkout --detach ${plan.sha}" failed in ${previewPath}.`)
  } else if (plan.action === 'reuse') {
    console.log(`[dev:main] preview already at current main (${plan.sha}); reusing.`)
  }

  // Re-verify after any mutation above — paranoia check, ticket §7: never
  // trust the action we just took, re-derive from git one more time.
  const finalHead = headSha(previewPath)
  if (finalHead !== mainSha) {
    return fail(EXIT.PROVENANCE, `PREVIEW HEAD (${finalHead}) does not equal CURRENT LOCAL MAIN (${mainSha}) after refresh. Refusing to serve a mismatched candidate.`)
  }

  const dirtyNow = dirtyEntries(previewPath)
  const dirty = dirtyNow === null ? 'UNKNOWN' : dirtyNow.length > 0

  await ensureDependencies(previewPath, statePath)

  updatePreviewState(statePath, (current) => ({ ...(current || {}), sha: finalHead, dir: previewPath, updatedAt: new Date().toISOString() }))

  const port = await findFreePort('127.0.0.1')

  console.log('\nLOCAL MAIN PREVIEW')
  console.log(`\nMAIN SHA:\n${mainSha}`)
  console.log(`\nPREVIEW SHA:\n${finalHead}`)
  console.log(`\nWORKTREE:\n${previewPath}`)
  console.log(`\nDIRTY:\n${dirty}`)
  console.log(`\nURL:\nhttp://127.0.0.1:${port}`)
  console.log('')

  const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: previewPath,
    stdio: 'inherit',
    env: process.env,
  })

  server.on('error', (err) => {
    fail(EXIT.TOOLING, `could not start "npm run dev" in ${previewPath}: ${err.message}`)
  })
  server.on('exit', (code) => {
    process.exit(code ?? EXIT.OK)
  })
}

main().catch((err) => {
  console.error(`\n[dev:main] LIFECYCLE FAILURE (exit ${EXIT.LIFECYCLE}): unexpected error: ${err && err.stack ? err.stack : err}`)
  process.exit(EXIT.LIFECYCLE)
})
