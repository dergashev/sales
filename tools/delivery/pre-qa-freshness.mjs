// tools/delivery/pre-qa-freshness.mjs
//
// DELIVERY-INFRA-01 item 10 — PRE-QA FRESHNESS CHECK.
//
// Pure decision function: given the freshly resolved authoritative release
// commit and the candidate's own recorded base, decide whether QA may
// proceed on the current candidate as-is, or whether the authoritative
// branch advanced in a way that requires the implementation to reconcile
// FIRST. Never performs reconciliation itself (no rebase/merge) — Case E's
// explicit prohibition: "Do not silently rebase or merge semantic Product
// changes inside QA."
//
// Kept dependency-free of git/fs so the decision table is unit-testable
// against fixtures; the CLI wrapper (tools/delivery/preflight.mjs's
// `pre-qa` subcommand) supplies real git state.

/**
 * @param {object} opts
 * @param {string} opts.preQaAuthoritativeCommit - freshly resolved authoritative release SHA, resolved right now (never cached).
 * @param {string} opts.candidateCommit - the exact SHA QA is about to test.
 * @param {string} opts.candidateBase - the SHA this candidate was implemented from (its pinned taskBaseCommit).
 * @param {boolean|null} opts.authorityIsAncestorOfCandidate - `git merge-base --is-ancestor <preQaAuthoritativeCommit> <candidateCommit>` (true = the candidate's own history already contains every commit the authoritative branch has; false = it does not; null = the git call itself failed).
 */
export function checkPreQaFreshness({ preQaAuthoritativeCommit, candidateCommit, candidateBase, authorityIsAncestorOfCandidate }) {
  const base = {
    preQaAuthoritativeCommit,
    candidateCommit,
    candidateBase,
  }

  const remoteAdvanced = preQaAuthoritativeCommit !== candidateBase

  if (!remoteAdvanced) {
    return {
      ok: true,
      ...base,
      remoteAdvanced: false,
      reconciliationRequired: false,
      reason: "Authoritative release commit is unchanged since this candidate's base. QA may proceed on the current candidate.",
    }
  }

  if (authorityIsAncestorOfCandidate === null) {
    return {
      ok: false,
      code: 3,
      ...base,
      remoteAdvanced: true,
      reconciliationRequired: null,
      reason: `"git merge-base --is-ancestor ${preQaAuthoritativeCommit} ${candidateCommit}" failed. Cannot establish whether reconciliation is required — QA must not proceed on an unverifiable candidate.`,
    }
  }

  if (authorityIsAncestorOfCandidate === true) {
    // The authoritative branch moved, but the candidate's own history
    // already contains every one of those commits (e.g. the candidate was
    // rebuilt from a later base after those commits landed) — no semantic
    // reconciliation is required.
    return {
      ok: true,
      ...base,
      remoteAdvanced: true,
      reconciliationRequired: false,
      reason: "Authoritative release commit advanced, but the candidate's own history already contains every one of those commits. QA may proceed.",
    }
  }

  return {
    ok: true,
    ...base,
    remoteAdvanced: true,
    reconciliationRequired: true,
    reason:
      `Authoritative release commit advanced from ${candidateBase} to ${preQaAuthoritativeCommit} since this candidate's base, and the candidate's ` +
      'own history does not contain that work. QA must NOT proceed on this candidate as-is: return to implementation, reconcile safely (never a ' +
      'silent rebase/merge of semantic Product changes performed by QA itself), produce a NEW candidate SHA, and re-enter validation from there.',
  }
}
