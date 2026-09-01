// tools/delivery/root-guard.mjs
//
// DELIVERY-INFRA-01 items 4/5 — ISOLATED WORKTREE HARD GATE / ROOT RELEASE
// CHECKOUT PROTECTION.
//
// Pure decision function: given the repository's authoritative root
// checkout path and the checkout a delivery agent is about to touch,
// decide whether that is the protected ROOT release checkout or a
// legitimate isolated worktree (task, preview, release-integration).
//
// Two call sites, two modes:
//   - 'preflight' (tools/delivery/preflight.mjs): the HARD GATE, before the
//     first Product-code modification. Blocks unconditionally when the
//     target IS the root checkout — Product implementation must not even
//     begin there, regardless of whether anything is dirty yet.
//   - 'commit' (tools/git-hooks/pre-commit-check.mjs): the retroactive
//     guard at commit time. Only blocks when the STAGED changes actually
//     include a Product-owned path — legitimate root-checkout activity
//     (read-only diagnostics, delivery-infra/doc changes, and the Release &
//     Integration Engineer's own authorised release operations) must keep
//     working from the root checkout.
//
// Kept dependency-free of real git calls (everything is injected) so the
// decision table is unit-testable against fixtures without a real repo.

const PRODUCT_PATH_PREFIXES = ['src/', 'design-system/', 'docs/product/', 'docs/audit/', 'index.html']

/** Default Product-ownership classifier — a path is Product-owned when it
 *  falls under one of the prefixes CLAUDE.md's own source-of-truth table
 *  names as product surface. Delivery-infra (`tools/`), documentation
 *  about tooling (`docs/tooling/`), and repository plumbing (`package.json`,
 *  `.agentsroom/`, etc.) are deliberately excluded — those are legitimate
 *  to touch from the root checkout (e.g. this very ticket's own docs). */
export function isProductPath(p) {
  const normalized = String(p).replace(/\\/g, '/')
  return PRODUCT_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix))
}

/**
 * @param {object} opts
 * @param {string} opts.repoRoot - the ROOT checkout's own path (git-common-dir's parent).
 * @param {string} opts.targetPath - the checkout a delivery agent is about to modify.
 * @param {(a:string,b:string)=>boolean} opts.samePathFn
 * @param {'preflight'|'commit'} [opts.mode] - see module doc above. Defaults to 'commit' (the more permissive, retroactive check).
 * @param {string[]} [opts.changedPaths] - staged/dirty file paths relative to targetPath. Only consulted in 'commit' mode.
 * @param {(p:string)=>boolean} [opts.isProductPathFn]
 */
export function checkRootCheckoutGuard({ repoRoot, targetPath, samePathFn, mode = 'commit', changedPaths = [], isProductPathFn = isProductPath }) {
  const isRootCheckout = samePathFn(repoRoot, targetPath)

  if (!isRootCheckout) {
    return { ok: true, isRootCheckout: false, reason: `"${targetPath}" is an isolated worktree, not the root release checkout. Product implementation may proceed here.` }
  }

  if (mode === 'preflight') {
    return {
      ok: false,
      code: 2,
      isRootCheckout: true,
      reason:
        `"${targetPath}" IS the authoritative root release checkout. Product implementation must not begin here — create an isolated task ` +
        'worktree from the freshly resolved authoritative release commit first (e.g. "git worktree add .worktrees/<task-id> -b task/<task-id> ' +
        '<authoritative-sha>") and run this preflight again from inside it.',
      unblockingRequirement: 'Create an isolated task worktree and re-run delivery:preflight from inside it.',
    }
  }

  // mode === 'commit': only block when the actual staged/dirty change set
  // contains a Product-owned path — root-checkout delivery-infra/doc work
  // (this ticket included) and the Release & Integration Engineer's own
  // authorised release operations must keep working.
  const productChanges = changedPaths.filter(isProductPathFn)
  if (productChanges.length === 0) {
    return { ok: true, isRootCheckout: true, reason: 'Root release checkout — no Product-file changes are staged. Non-Product activity remains permitted.' }
  }

  return {
    ok: false,
    code: 2,
    isRootCheckout: true,
    productChanges,
    reason:
      `Refusing: "${targetPath}" is the authoritative ROOT release checkout, and Product-file changes are staged there ` +
      `(${productChanges.slice(0, 5).join(', ')}${productChanges.length > 5 ? ', …' : ''}). Product implementation must happen in an isolated ` +
      'task worktree, never directly in the root checkout.',
    unblockingRequirement: 'Move this work to an isolated task worktree (git worktree add .worktrees/<task-id> ...), or unstage it if it landed here by mistake.',
  }
}
