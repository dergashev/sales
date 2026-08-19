// tools/runtime/lib/checkout-mutation.mjs
//
// Executes the `action` tools/worktrees/lib/worktree-lifecycle.mjs's
// `planPreviewRefresh` decided, against real git. Extracted verbatim from
// tools/worktrees/dev-main.mjs (mechanical move, not a behavior change) so
// `dev-main.mjs` and the new `runtime:main` share ONE implementation of
// "how a preview checkout actually gets mutated" instead of two — the
// Engineering Architecture handoff's explicit "dev:main delegates to the
// one shared lifecycle" requirement. Same re-verification-after-mutation
// discipline as the original: never trust the action just taken, re-derive
// HEAD from git one more time before reporting success.
//
// Returns `{ ok: true, head }` or `{ ok: false, code, message }` — callers
// translate `code` (2 PROVENANCE / 3 LIFECYCLE) into their own exit/report
// format; this module never calls `process.exit` itself so it stays
// testable as a plain function.

import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { headSha, listWorktrees, samePath } from '../../gate/lib/git-worktrees.mjs'

const CODE = { PROVENANCE: 2, LIFECYCLE: 3 }

/**
 * @param {object} opts
 * @param {{action:string, sha?:string, from?:string, reason?:string}} opts.plan - a planPreviewRefresh() result whose action is NOT 'blocked'/'refuse-dirty' (callers handle those before reaching here).
 * @param {string} opts.previewPath
 * @param {string} opts.repoRoot
 * @param {string} opts.mainSha - expected final HEAD, for the post-mutation re-verification.
 * @param {(msg:string)=>void} [opts.log]
 */
export function applyPreviewRefreshPlan({ plan, previewPath, repoRoot, mainSha, log = console.log }) {
  if (plan.action === 'recreate') {
    // Git itself reported this registration prunable (directory/gitdir
    // gone) — prune first (git-native) then fall through to the same
    // creation path as a brand-new preview.
    log(`[runtime] ${plan.reason}`)
    const prune = spawnSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'inherit' })
    if (prune.status !== 0) return { ok: false, code: CODE.LIFECYCLE, message: `"git worktree prune" failed for ${previewPath}.` }
    // prune exits 0 even when it prunes nothing (e.g. a locked entry) —
    // verify the registration is actually gone before treating "recreate"
    // as safe to proceed with "add".
    const afterPrune = listWorktrees(repoRoot)
    if (afterPrune === null) return { ok: false, code: CODE.LIFECYCLE, message: '"git worktree list --porcelain" failed after prune.' }
    const stillThere = afterPrune.some((w) => samePath(w.path, previewPath))
    if (stillThere) {
      return {
        ok: false,
        code: CODE.LIFECYCLE,
        message:
          `"git worktree prune" reported success but "${previewPath}" is still registered (commonly: it is locked). ` +
          'Run "npm run git:worktrees:check" for the lock reason; this cannot be resolved automatically.',
      }
    }
  }

  if (plan.action === 'create' || plan.action === 'recreate') {
    log(`[runtime] creating detached preview worktree at ${previewPath} (main @ ${mainSha})...`)
    mkdirSync(path.dirname(previewPath), { recursive: true })
    const add = spawnSync('git', ['worktree', 'add', '--detach', previewPath, mainSha], { cwd: repoRoot, stdio: 'inherit' })
    if (add.status !== 0) return { ok: false, code: CODE.LIFECYCLE, message: `"git worktree add --detach" failed for ${previewPath}.` }
  } else if (plan.action === 'checkout') {
    log(`[runtime] preview is clean at ${plan.from}; main has advanced to ${plan.sha} — refreshing.`)
    const checkout = spawnSync('git', ['checkout', '--detach', plan.sha], { cwd: previewPath, stdio: 'inherit' })
    if (checkout.status !== 0) return { ok: false, code: CODE.LIFECYCLE, message: `"git checkout --detach ${plan.sha}" failed in ${previewPath}.` }
  } else if (plan.action === 'reuse') {
    log(`[runtime] preview already at current main (${plan.sha}); reusing.`)
  }

  // Re-verify after any mutation above — never trust the action just taken.
  const head = headSha(previewPath)
  if (head !== mainSha) {
    return { ok: false, code: CODE.PROVENANCE, message: `PREVIEW HEAD (${head}) does not equal CURRENT LOCAL MAIN (${mainSha}) after refresh. Refusing to serve a mismatched candidate.` }
  }
  return { ok: true, head }
}
