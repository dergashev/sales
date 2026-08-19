// tools/runtime/lib/classify.mjs
//
// `classifyRuntime` is the single place STATUS is derived. The registry
// (registry.mjs) stores only what a runtime CLAIMED about itself at
// registration time; this function re-derives the truth on every call from
// three independently-supplied, injectable facts:
//
//   - `pidAlive`   : is the claimed process still running? (fn injected so
//                    tests never depend on a real OS process)
//   - `gitMainSha` : what does `git rev-parse main` say RIGHT NOW? (only
//                    relevant for CURRENT_MAIN; `null`/`undefined` for
//                    candidate purposes, whose expected sha is `expectedSha`)
//   - `echo`       : the live HTTP response actually read back from
//                    `GET /__runtime.json` on the claimed url, or `null` if
//                    the probe failed/was skipped. Verified live against a
//                    real, unmanaged `vite dev` server: it answers
//                    `/__provenance.json` (a *different* path, but the same
//                    class of request) with HTTP 200 and
//                    `Content-Type: text/html` — its SPA fallback. HTTP 200
//                    alone proves nothing; only a genuine, nonce-matching
//                    `application/json` echo counts as verification.
//
// Kept a pure function of its inputs — no fs/net/child_process here — so
// the full truth table is unit-testable without touching a real registry,
// git, or a real server (see classify.test.mjs).

export const RUNTIME_STATUS = Object.freeze({
  MISSING: 'MISSING', // no claim exists at all for this runtimeId
  DEAD: 'DEAD', // claim exists, claimed pid is not alive
  UNVERIFIED: 'UNVERIFIED', // pid alive, but /__runtime.json did not answer, or answered non-JSON / without a nonce
  FOREIGN_HOST: 'FOREIGN_HOST', // pid alive and something answers JSON, but nonce/purpose do not match our claim — a different process now owns that port/pid
  DRIFTED: 'DRIFTED', // verified JSON echo, but the SHA it reports differs from what the registry claims it serves (claim/reality mismatch)
  STALE: 'STALE', // verified, claim and echo agree with each other, but that agreed SHA is no longer the SHA this consumer needs (main advanced, or a pinned expectation moved)
  SERVING_VERIFIED: 'SERVING_VERIFIED', // verified, matches the current expectation — safe to use as authoritative
})

/**
 * @param {object} opts
 * @param {object|null} opts.claim - the registry's (or legacy-migrated) claim record, or null if none exists.
 * @param {boolean} opts.pidAlive - whether the claimed pid is currently alive (caller probes; irrelevant/false when claim is null).
 * @param {{ok:boolean, contentType?:string|null, sha?:string|null, purpose?:string|null, nonce?:string|null}|null} opts.echo -
 *   the live GET /__runtime.json result, or null if unreachable/not attempted.
 * @param {string|null} [opts.gitMainSha] - `git rev-parse main` right now. Only meaningful for purpose === 'CURRENT_MAIN'.
 * @param {string|null} [opts.expectedSha] - the pinned sha a TASK_CANDIDATE/REVIEW_CANDIDATE consumer expects (taskBaseCommit-derived or implementationCommit). Ignored for CURRENT_MAIN.
 * @returns {{ status: string, reason: string }}
 */
export function classifyRuntime({ claim, pidAlive, echo, gitMainSha = null, expectedSha = null }) {
  if (!claim) {
    return { status: RUNTIME_STATUS.MISSING, reason: 'No runtime claim is registered for this purpose/worktree.' }
  }

  if (!pidAlive) {
    return { status: RUNTIME_STATUS.DEAD, reason: `Claimed pid ${claim.pid ?? 'UNKNOWN'} is not alive.` }
  }

  if (!echo || echo.ok !== true) {
    return {
      status: RUNTIME_STATUS.UNVERIFIED,
      reason: 'GET /__runtime.json did not answer (unreachable, or the process no longer serves this url).',
    }
  }

  // The exact case verified live against an unmanaged `vite dev` process:
  // its SPA fallback answers ANY unknown path, including a provenance
  // probe, with HTTP 200 and text/html. That must classify UNVERIFIED, not
  // pass — content-type is checked before anything else in the payload.
  if (echo.contentType !== 'application/json') {
    return {
      status: RUNTIME_STATUS.UNVERIFIED,
      reason: `/__runtime.json answered with Content-Type "${echo.contentType ?? 'unknown'}", not application/json — ` +
        'this is very likely an unmanaged dev server\'s SPA fallback, not the runtime-identity plugin. HTTP 200 proves nothing on its own.',
    }
  }

  if (!echo.nonce || echo.nonce !== claim.nonce) {
    return {
      status: RUNTIME_STATUS.FOREIGN_HOST,
      reason: 'The live nonce does not match the registered claim\'s nonce — a different process now answers on this port/pid than the one this registry entry describes.',
    }
  }

  if (echo.purpose !== claim.purpose) {
    return {
      status: RUNTIME_STATUS.FOREIGN_HOST,
      reason: `Live runtime reports purpose "${echo.purpose}", registry claims "${claim.purpose}".`,
    }
  }

  if (echo.sha !== claim.sha) {
    return {
      status: RUNTIME_STATUS.DRIFTED,
      reason: `Live runtime reports sha ${echo.sha}, but the registry claims ${claim.sha}.`,
    }
  }

  if (claim.purpose === 'CURRENT_MAIN') {
    if (gitMainSha && claim.sha !== gitMainSha) {
      return {
        status: RUNTIME_STATUS.STALE,
        reason: `CURRENT_MAIN serves ${claim.sha}, but local main has advanced to ${gitMainSha}.`,
      }
    }
  } else if (expectedSha && claim.sha !== expectedSha) {
    return {
      status: RUNTIME_STATUS.STALE,
      reason: `Runtime serves ${claim.sha}, but the pinned expectation for this consumer is ${expectedSha}.`,
    }
  }

  return { status: RUNTIME_STATUS.SERVING_VERIFIED, reason: 'Verified: live echo matches the registered claim and the current expectation.' }
}
