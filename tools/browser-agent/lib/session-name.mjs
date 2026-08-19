// tools/browser-agent/lib/session-name.mjs
//
// Named-session convention (Engineering Architecture handoff item 6, ticket
// "NAMED SESSION MODEL"). Pure string functions — no fs/git/process — so the
// convention itself is unit-testable without a real repo.
//
// CURRENT_MAIN never takes a `lane`: Runtime Provenance already makes
// CURRENT_MAIN a structural singleton (one canonical `.preview/main`
// worktree, one registry key). TASK_CANDIDATE and REVIEW_CANDIDATE both
// require a `lane` — several delivery lanes can legitimately hold a
// candidate or a review session at the exact same sha at the exact same
// time (ticket scenario K "TWO TASKS", and two independent reviewers of the
// same implementationCommit), and the session name must not collide between
// them just because their sha matches.
//
// The sha suffix is what makes reuse-vs-supersession structural rather than
// a runtime check: a session name deterministically DIFFERS the moment the
// sha it targets changes (main advances, or rework produces a new
// implementationCommit), so an old candidate's sidecar file can never be
// picked up as evidence for a new one merely by matching on name.

export const PURPOSES = Object.freeze(['CURRENT_MAIN', 'TASK_CANDIDATE', 'REVIEW_CANDIDATE'])

export function isValidPurpose(purpose) {
  return PURPOSES.includes(purpose)
}

export function shortSha(sha) {
  if (typeof sha !== 'string' || sha.length < 7) throw new Error(`shortSha: expected a full git sha, got ${JSON.stringify(sha)}.`)
  return sha.slice(0, 12)
}

/** Diagnostic-safe slug: lowercase, `[a-z0-9-]` only, collapsed. Session
 *  names are read by humans in `browser:agent:status` / `playwright-cli
 *  list` output — a lane id or task id must never break that display. */
export function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * @param {object} opts
 * @param {string} opts.purpose - one of PURPOSES.
 * @param {string} opts.sha - the runtime's actual sha (from the Runtime Provenance claim, not the caller's guess).
 * @param {string} [opts.lane] - required for TASK_CANDIDATE/REVIEW_CANDIDATE; ignored for CURRENT_MAIN.
 */
export function deriveSessionName({ purpose, sha, lane }) {
  if (!isValidPurpose(purpose)) throw new Error(`deriveSessionName: purpose must be one of ${PURPOSES.join(', ')}, got ${JSON.stringify(purpose)}.`)
  const short = shortSha(sha)

  if (purpose === 'CURRENT_MAIN') return `current-main-${short}`

  if (!lane || slug(lane).length === 0) {
    throw new Error(`deriveSessionName: --lane is required for ${purpose} (distinguishes concurrent candidates/reviewers at the same sha).`)
  }
  const laneSlug = slug(lane)
  return purpose === 'TASK_CANDIDATE' ? `task-${laneSlug}-${short}` : `review-${laneSlug}-${short}`
}
