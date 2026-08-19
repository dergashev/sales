// tools/runtime/lib/pid.mjs
//
// Same-host liveness probe, extracted from tools/worktrees/dev-main.mjs
// (verbatim logic — this is a mechanical move, not a behavior change) so
// the new runtime registry's classification (classify.mjs) and dev-main.mjs
// share ONE implementation instead of two copies of the same signal-0
// probe. Mirrors tools/gate/lib/manifest-lock.mjs's own identical same-host
// check (that module additionally handles a foreign-host owner, which does
// not apply here: every runtime this task manages is resolved and probed
// from the same host that registered it).

/** True if `pid` is currently alive on this host. Signal 0 never actually
 *  delivers — it is a pure existence probe. EPERM means the pid exists but
 *  is owned by another user (still alive, just unprobeable further). */
export function pidIsAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err.code === 'EPERM'
  }
}
