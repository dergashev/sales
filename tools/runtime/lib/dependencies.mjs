// tools/runtime/lib/dependencies.mjs
//
// "Install only when needed" for a managed preview/runtime checkout,
// extracted from tools/worktrees/dev-main.mjs so `dev-main.mjs` and the new
// `runtime:main`/`runtime:candidate` commands share ONE implementation
// instead of two copies. Behavior is unchanged from the original inline
// version — this is a mechanical move plus one signature change: instead
// of calling `process.exit` itself (dev-main.mjs's own `fail()` prints a
// `[dev:main]`-prefixed message; the new CLI needs its own prefix), it
// returns `{ ok: true }` or `{ ok: false, message }` and lets each caller
// report the failure in its own voice while still using the SAME
// underlying install logic and the SAME exit code family (TOOLING).
//
// Deliberately synchronous (spawnSync) so it can run INSIDE a caller's own
// locked critical section — reads/writes state directly via the lock-free
// primitives (`readPreviewState`/`writePreviewStateRaw`), never via
// `updatePreviewState` (which would try to re-acquire the same lock the
// caller is already holding).

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { readPreviewState, writePreviewStateRaw } from '../../worktrees/lib/preview-state.mjs'

function lockfileHash(dir) {
  const lockPath = path.join(dir, 'package-lock.json')
  if (!existsSync(lockPath)) return null
  return createHash('sha256').update(readFileSync(lockPath)).digest('hex')
}

/**
 * @param {string} previewDir
 * @param {string} statePath
 * @returns {{ok: true} | {ok: false, message: string}}
 */
export function ensureDependenciesLocked(previewDir, statePath) {
  const currentHash = lockfileHash(previewDir)
  const state = readPreviewState(statePath) || {}
  const needsInstall = !existsSync(path.join(previewDir, 'node_modules')) || state.installedLockHash !== currentHash

  if (!needsInstall) return { ok: true }

  console.log(`[runtime] installing dependencies in ${previewDir} (npm ci)...`)
  const result = spawnSync('npm', ['ci'], { cwd: previewDir, stdio: 'inherit', env: process.env })
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      message: `"npm ci" failed in ${previewDir}. If npm is not on PATH, export PATH="$HOME/.local/bin:$PATH" (see project memory: global/conventions/validation-and-release-gates.md).`,
    }
  }
  writePreviewStateRaw(statePath, { ...(readPreviewState(statePath) || {}), installedLockHash: currentHash })
  return { ok: true }
}
