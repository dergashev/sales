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
//
// IDENTITY ownership (nonce/purpose match) is NOT the same thing as
// TERMINATION capability. A claim's recorded `pid` may be an intermediate
// `npm` wrapper around a further child (`sh` -> the actual dev server) —
// true for every `dev:main`-registered claim (`detached: false`, spawned
// in the foreground, no dedicated process group). Signaling just that one
// pid does not reliably stop the tree underneath it (verified directly:
// SIGTERM then SIGKILL to the wrapper left the actual server alive,
// serving the OLD sha, port still bound — Tech Review P1). Only a claim
// this tooling itself started detached (`claim.detached === true`, its
// own dedicated process group) can be FULLY and verifiably stopped. A
// STALE/DRIFTED claim that is not `detached` is therefore treated the
// same as an unprovable one for the purposes of stopping it: rotation
// must never report a stop it cannot make good on, and must never mutate
// the checkout underneath a server it did not actually stop.

export function planCurrentMainRotation({ classification, claim }) {
  switch (classification.status) {
    case 'SERVING_VERIFIED':
      // Idempotent: already correct, nothing to do. Ticket scenario A/C
      // (repeat "clean start"/"rotation" call) must be a no-op, not a
      // needless restart.
      return { action: 'reuse', reason: classification.reason }

    case 'MISSING':
    case 'DEAD':
      // No live, verifiable OWNER of the CURRENT_MAIN identity exists —
      // but that is a claim about the recorded pid only, not about whether
      // the checkout is actually silent. A DEAD wrapper pid's own `npm run
      // dev` grandchild can survive and keep serving the claim's recorded
      // url (Tech Review round 2: reproduced directly — the checkout was
      // mutated underneath exactly such a survivor). planPreviewRefresh
      // still separately checks the checkout's own dirty/lock state, and
      // main.mjs additionally probes the claim's own url before ever
      // mutating on this path — this decision alone does not prove nothing
      // is serving.
      return { action: 'start', reason: classification.reason }

    case 'STALE':
    case 'DRIFTED':
      // Identity ownership IS proven here (nonce + purpose already matched
      // in classify.mjs) — only the served sha disagrees with what is
      // currently required. But that is not enough: only stop-and-mutate
      // when this claim is also known to be fully, verifiably stoppable.
      if (claim?.detached !== true) {
        return {
          action: 'blocked',
          code: 2,
          reason:
            `${classification.reason} This runtime's identity is verified, but it was not started detached by this tooling ` +
            '(e.g. it is a dev:main-served process) and its underlying server process cannot be reliably, fully stopped from ' +
            'its recorded pid alone. Refusing to report a stop that cannot be made good on, and refusing to mutate the ' +
            'checkout underneath a server that would remain live. Stop it manually (Ctrl-C the owning dev:main, or kill its ' +
            'actual server process) and re-run.',
        }
      }
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
