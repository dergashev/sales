// tools/runtime/lib/rotation.mjs
//
// Pure decision table for "what should `runtime:main` do this run", given
// the classification classify.mjs already derived for the existing
// CURRENT_MAIN claim (or lack of one). Never touches fs/git/http/child
// processes itself — main.mjs executes the returned `action` through real
// I/O, exactly mirroring how tools/worktrees/lib/worktree-lifecycle.mjs's
// `planPreviewRefresh` separates "what to do" from "how to do it" (that
// function is reused UNCHANGED by main.mjs for the checkout-mutation step
// itself; this module only decides whether a live process must be stopped
// FIRST, and whether touching it is safe at all).
//
// CORE SAFETY RULE (ticket "CURRENT_MAIN ROTATION" steps 3-5, "PROCESS
// OWNERSHIP"): a live process may only be stopped once ownership is
// PROVEN — i.e. classify.mjs already verified its nonce/purpose echo
// matches our own claim. UNVERIFIED and FOREIGN_HOST mean exactly "cannot
// prove this", so rotation refuses outright rather than guessing — this is
// what keeps an old worktree's still-live, unmanaged (no runtime-identity
// plugin) `dev:main` process from ever being killed by this module.

export function planCurrentMainRotation({ classification }) {
  switch (classification.status) {
    case 'SERVING_VERIFIED':
      // Idempotent: already correct, nothing to do. Ticket scenario A/C
      // (repeat "clean start"/"rotation" call) must be a no-op, not a
      // needless restart.
      return { action: 'reuse', reason: classification.reason }

    case 'MISSING':
    case 'DEAD':
      // No live, verifiable owner of the CURRENT_MAIN identity exists.
      // Proceed straight to checkout + spawn — planPreviewRefresh still
      // separately checks the checkout's own dirty/lock state, and the
      // legacy preview-state.json pid check (main.mjs) still separately
      // guards against an UNREGISTERED live process serving the same
      // directory (see main.mjs's dual liveness check before mutating).
      return { action: 'start', reason: classification.reason }

    case 'STALE':
    case 'DRIFTED':
      // Ownership IS proven here (nonce + purpose already matched in
      // classify.mjs) — only the served sha disagrees with what is
      // currently required. Stop gracefully, THEN mutate the checkout.
      return { action: 'stop-then-start', reason: classification.reason }

    case 'UNVERIFIED':
    case 'FOREIGN_HOST':
      // Cannot prove ownership of whatever is currently bound to the
      // claimed pid/port (e.g. an unmanaged `vite dev`, or a live process
      // from one of the 16 other worktrees' older, plugin-less tooling
      // copy serving the very same canonical preview directory). Refusing
      // to stop OR mutate is the fail-closed contract — never a broad
      // process-wide kill, never a guess.
      return {
        action: 'blocked',
        code: 2,
        reason:
          `${classification.reason} Refusing to stop or mutate a runtime whose ownership cannot be proven. ` +
          'If you are certain no other agent/human is relying on it, stop it manually and re-run.',
      }

    default:
      return { action: 'blocked', code: 3, reason: `Unknown classification status "${classification.status}".` }
  }
}
