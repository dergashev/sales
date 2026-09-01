// tools/delivery/agentsroom-guard.mjs
//
// DELIVERY-INFRA-01 item 8 — AGENTSROOM CONTROL-STATE PROTECTION.
//
// Pure decision function over a list of staged/changed paths: reject a
// commit that touches `.agentsroom/**` as an ordinary project file. This is
// the technical guard for "delivery agents must not manually create, edit,
// patch, delete or rewrite files under .agentsroom/**" — a prompt-only
// prohibition is not sufficient (ticket item 8).
//
// WHY THIS DISTINGUISHES LEGITIMATE APP STATE FROM AGENT MISUSE (ticket's
// explicit requirement): the AgentsRoom desktop app writes `.agentsroom/**`
// DIRECTLY TO DISK — sessions, routing state, notifications, transcripts —
// entirely outside any delivery agent's own git workflow. A delivery agent
// never needs to `git add`/`git commit` a path under `.agentsroom/` to
// participate in an official Team run; the app's own runtime does not go
// through this hook at all (it writes files, it does not shell out to
// `git commit`). So ANY commit that stages a `.agentsroom/**` path is, by
// construction, exactly the case the ticket describes: a delivery agent
// treating the app's own runtime state as ordinary project source. The
// override below exists only for a genuine, deliberate, human-instructed
// exception (e.g. an actual migration of the AgentsRoom plumbing itself),
// never for routine task work — and is never set by a delivery agent
// unilaterally deciding its own commit is such an exception.
//
// PLATFORM BOUNDARY (documented per the ticket's own instruction — "if
// technical enforcement cannot fully prevent the write due to platform
// limitations, implement all enforceable repository-side protections and
// document the remaining platform boundary precisely"): this hook is a
// GIT commit-time guard. It cannot stop a delivery agent's editor tool
// (Write/Edit) from writing bytes to a path under `.agentsroom/` before any
// `git add`/`git commit` happens, and it does not run at all for a session
// whose CLI harness bypasses `.git/hooks` (e.g. `git commit --no-verify`,
// or a client that writes objects without invoking hooks). Those two gaps
// are outside what repository-level tooling can enforce; the durable
// backstop remains the prompt-level prohibition plus the fact that
// `.agentsroom/**` is regenerated/overwritten by the app on its own
// schedule regardless of what a stray local edit contains.

const AGENTSROOM_PREFIX = '.agentsroom/'
export const AGENTSROOM_OVERRIDE_ENV = 'A3_ALLOW_AGENTSROOM_COMMIT'

/**
 * @param {object} opts
 * @param {string[]} opts.changedPaths - staged/changed paths, repo-root-relative, forward-slash form (as `git diff --name-only` reports them).
 * @param {NodeJS.ProcessEnv} [opts.env]
 */
export function checkAgentsRoomGuard({ changedPaths, env = process.env }) {
  const offending = changedPaths.filter((p) => String(p).replace(/\\/g, '/').startsWith(AGENTSROOM_PREFIX))

  if (offending.length === 0) {
    return { ok: true, offending: [], reason: 'No staged/changed path touches .agentsroom/**.' }
  }

  if (env[AGENTSROOM_OVERRIDE_ENV] === '1') {
    return {
      ok: true,
      offending,
      overridden: true,
      reason: `${AGENTSROOM_OVERRIDE_ENV}=1 explicitly set — allowing a deliberate, human-instructed commit touching .agentsroom/** (${offending.join(', ')}).`,
    }
  }

  return {
    ok: false,
    code: 2,
    offending,
    reason:
      `Refusing to commit ${offending.length} path(s) under ".agentsroom/" (${offending.slice(0, 5).join(', ')}${offending.length > 5 ? ', …' : ''}). ` +
      'This directory is AgentsRoom\'s own runtime/session/routing state, owned exclusively by the desktop app — never by a delivery agent\'s git ' +
      `workflow. If this is a genuinely deliberate, human-instructed exception, re-run with ${AGENTSROOM_OVERRIDE_ENV}=1.`,
  }
}
