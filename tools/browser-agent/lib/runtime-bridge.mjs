// tools/browser-agent/lib/runtime-bridge.mjs
//
// The ONLY module in this task that talks to the Runtime Provenance
// Contract. It never re-derives runtime identity, worktree selection,
// current-main resolution, or SHA/status classification itself (ticket
// "CORE ARCHITECTURE PRINCIPLE": "Do not duplicate Runtime Provenance logic
// inside Playwright CLI integration"). It does exactly two things:
//
//   1. Runs the existing `npm run runtime:main` / `runtime:candidate` /
//      `runtime:preflight` CLI as a child process and looks at nothing but
//      its EXIT CODE — never its stdout text, which the official Runtime
//      Provenance CLI documents as plain human-readable output with no
//      `--json` mode. This is the one containment this whole task exists to
//      preserve: a provenance-critical decision here is a number (0/2/3/4),
//      never a regex.
//   2. After a successful `main`/`candidate` run, reads the CLAIM that
//      command itself just wrote — via the SAME exported registry
//      functions `tools/runtime/main.mjs` uses internally
//      (`resolveCurrentMainClaim`, `listClaims`, `runtimeId`,
//      `defaultRegistryPath`) — to obtain the URL/sha/worktree this browser
//      session must bind to. This is a structured JSON read of the runtime
//      layer's own persisted source of truth, not stdout scraping.

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { git, gitCommonDir, headSha } from '../../gate/lib/git-worktrees.mjs'
import { defaultPreviewStatePath } from '../../worktrees/lib/preview-state.mjs'
import { defaultRegistryPath, listClaims, resolveCurrentMainClaim, runtimeId } from '../../runtime/lib/registry.mjs'
import { classifyRuntimeStep, verifyExpectedShaAgainstWorktree } from './decide.mjs'

/** Repo paths this bridge needs, resolved once from `cwd`. */
export function resolveRepoContext(cwd) {
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return null
  const repoRoot = path.dirname(commonDir)
  const worktree = git(cwd, ['rev-parse', '--show-toplevel'])
  return { cwd, commonDir, repoRoot, worktree }
}

/** CURRENT_MAIN expects local `main`; candidates expect the caller's own HEAD (or an explicit pin). */
export function resolveExpectedSha({ purpose, cwd, explicitSha }) {
  if (explicitSha) return explicitSha
  if (purpose === 'CURRENT_MAIN') return git(cwd, ['rev-parse', 'main'])
  return headSha(cwd)
}

function runNpmScript(args, { cwd }) {
  return spawnSync('npm', ['run', ...args], { cwd, stdio: 'inherit' })
}

/**
 * Starts/resolves the runtime for `purpose` by chaining the existing
 * `runtime:main` / `runtime:candidate` command, then reads the resulting
 * claim back from the registry. Never starts a server itself, never picks
 * a port itself, never writes to the registry itself.
 */
export function startOrResolveRuntime({ purpose, ctx, expectedSha }) {
  const step = purpose === 'CURRENT_MAIN' ? 'npm run runtime:main' : 'npm run runtime:candidate'

  // D1 (Engineering Architecture handoff): verify BEFORE ever spawning
  // "runtime:candidate" — an asserted --expected-sha that does not match
  // this worktree's real HEAD must fail closed here, without starting any
  // process and without ever opening a browser.
  const actualHeadSha = purpose === 'CURRENT_MAIN' ? null : headSha(ctx.cwd)
  const verified = verifyExpectedShaAgainstWorktree({ purpose, expectedSha, actualHeadSha })
  if (!verified.ok) return { ok: false, code: verified.code, reason: verified.reason }

  const result =
    purpose === 'CURRENT_MAIN'
      ? runNpmScript(['runtime:main'], { cwd: ctx.cwd })
      // Never forward the caller's --expected-sha as runtime:candidate's
      // --sha: that CLI trusts --sha verbatim without checking it against
      // the worktree (a standing gap in the released Runtime Provenance
      // layer, out of scope here). Omitting it lets runtime:candidate
      // derive the sha itself from this exact worktree's real HEAD — the
      // same value `verified` above just confirmed the caller's assertion
      // (if any) actually matches.
      : runNpmScript(['runtime:candidate', '--', '--purpose', purpose], { cwd: ctx.cwd })

  if (result.error) return { ok: false, code: 4, reason: `Could not spawn "${step}": ${result.error.message}` }
  const classified = classifyRuntimeStep({ step, exitCode: result.status })
  if (!classified.ok) return { ok: false, code: classified.code, reason: classified.reason }

  const registryPath = defaultRegistryPath(ctx.commonDir)
  if (purpose === 'CURRENT_MAIN') {
    const previewPath = path.resolve(ctx.repoRoot, process.env.A3_PREVIEW_DIR || '.preview/main')
    const resolved = resolveCurrentMainClaim({
      registryPath,
      legacyPreviewStatePath: defaultPreviewStatePath(ctx.commonDir),
      previewWorktreePath: previewPath,
    })
    if (!resolved.claim) return { ok: false, code: 2, reason: '"runtime:main" exited 0 but no CURRENT_MAIN claim is registered. Refusing to open a browser without a verified claim.' }
    return { ok: true, claim: resolved.claim }
  }

  const id = runtimeId(purpose, ctx.worktree)
  const claim = listClaims(registryPath).find((c) => c.id === id) ?? null
  if (!claim) return { ok: false, code: 2, reason: `"runtime:candidate" exited 0 but no ${purpose} claim is registered for ${ctx.worktree}. Refusing to open a browser without a verified claim.` }
  return { ok: true, claim }
}

/**
 * The shared "BROWSER CONSUMER PREFLIGHT" gate. `stdio: 'inherit'` is
 * deliberate: this process never captures preflight's stdout at all, so
 * there is nothing here that could ever be tempted into parsing it for the
 * pass/fail decision. Only the exit code is read.
 */
export function runPreflight({ expectedPurpose, expectedSha, url, cwd }) {
  const result = spawnSync('npm', ['run', 'runtime:preflight', '--', '--expected-purpose', expectedPurpose, '--expected-sha', expectedSha, '--url', url], { cwd, stdio: 'inherit' })
  if (result.error) return { ok: false, code: 4, reason: `Could not spawn "npm run runtime:preflight": ${result.error.message}` }
  return { ok: result.status === 0, code: result.status }
}
