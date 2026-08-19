// tools/browser-agent/lib/orchestrate.mjs
//
// Core `open` / `close` orchestration, factored out of the `open.mjs` /
// `close.mjs` CLI entrypoints so it can be exercised directly by
// open-close.integration.test.mjs with the runtime-resolution step
// injected (that step's OWN correctness is tools/runtime's test suite's
// job, not this task's — duplicating it here would be exactly the
// "duplicate Runtime Provenance logic" the architecture forbids) while the
// Playwright CLI step runs for real against a small fixture binary.
//
// Handshake order, fixed by the ticket ("SESSION PROVENANCE HANDSHAKE"):
//   1. resolve/start the runtime for `purpose`                (deps.resolveRuntime)
//   2. require the shared browser-consumer preflight to pass  (deps.preflight)
//   3. only then derive the session name and open the browser (deps.playwrightOpen)
// Any failure at step 1 or 2 means step 3 never runs — no fallback URL, no
// browser opened against unverified evidence.

import { mkdirSync, writeFileSync } from 'node:fs'
import { deriveSessionName } from './session-name.mjs'
import { decideSessionAction, verifyCloseOwnership } from './decide.mjs'
import { readSidecar, removeSidecar, writeSidecar } from './sidecar-store.mjs'
import { sessionArtifactsDir, provenanceFilePath } from './artifacts-dir.mjs'
import { EXIT } from './exit-codes.mjs'

/**
 * @param {object} opts - { purpose, lane, expectedSha, persistent, cwd, sidecarDir, worktree, repoRoot }
 *   repoRoot is optional: when omitted (e.g. a caller that does not need candidate-identifiable
 *   artifacts), no per-session outputDir/provenance.json is set up — `playwrightOpen` simply
 *   receives no `outputDir` and the CLI falls back to its own tracked-config default.
 * @param {object} deps - { resolveRuntime, preflight, playwrightOpen, playwrightVersion, now }
 *   resolveRuntime({ purpose, expectedSha }) -> { ok, claim?, code?, reason? }
 *   preflight({ expectedPurpose, expectedSha, url }) -> { ok, code? }
 *   playwrightOpen({ sessionName, url, persistent, outputDir }) -> { ok, code?, reason? }
 *   playwrightVersion() -> string|null
 *   now() -> ISO timestamp string
 */
export function runOpen(opts, deps) {
  const { purpose, lane, expectedSha, persistent, sidecarDir, worktree, repoRoot } = opts

  const runtime = deps.resolveRuntime({ purpose, expectedSha })
  if (!runtime.ok) return { ok: false, code: runtime.code ?? EXIT.PROVENANCE, message: runtime.reason }

  const claim = runtime.claim
  if (!claim || !claim.url || !claim.sha) {
    return { ok: false, code: EXIT.PROVENANCE, message: 'Runtime resolved but returned no usable claim (missing url/sha). Refusing to open a browser without verified identity.' }
  }

  const preflight = deps.preflight({ expectedPurpose: purpose, expectedSha, url: claim.url })
  if (!preflight.ok) {
    return { ok: false, code: preflight.code ?? EXIT.PROVENANCE, message: `Browser consumer preflight failed (exit ${preflight.code}). Refusing to open ${claim.url} as authoritative ${purpose} evidence.` }
  }

  const sessionName = deriveSessionName({ purpose, sha: claim.sha, lane })
  const existingSidecar = readSidecar(sidecarDir, sessionName)
  const decision = decideSessionAction(existingSidecar, { purpose, worktree: claim.worktree ?? worktree, sha: claim.sha })
  if (decision.action === 'refuse') {
    return { ok: false, code: EXIT.PROVENANCE, message: decision.reason }
  }

  // D2: bind this session to its own candidate-identifiable artifact
  // directory BEFORE opening — the daemon `open` spawns only ever reads
  // PLAYWRIGHT_MCP_OUTPUT_DIR once, at creation (see playwright-cli-bridge.mjs).
  const outputDir = repoRoot ? sessionArtifactsDir(repoRoot, sessionName) : null

  const opened = deps.playwrightOpen({ sessionName, url: claim.url, persistent: Boolean(persistent), outputDir })
  if (!opened.ok) {
    return { ok: false, code: opened.code ?? EXIT.TOOLING, message: opened.reason ?? `playwright-cli exited ${opened.code} opening session "${sessionName}".` }
  }

  const now = deps.now()
  const record = {
    sessionName,
    purpose,
    lane: lane ?? null,
    expectedSha,
    actualSha: claim.sha,
    worktree: claim.worktree ?? worktree,
    url: claim.url,
    playwrightCliVersion: deps.playwrightVersion(),
    status: 'OPEN',
    provenanceVerified: true,
    persistent: Boolean(persistent),
    outputDir,
    createdAt: existingSidecar?.createdAt ?? now,
    updatedAt: now,
  }
  writeSidecar(sidecarDir, sessionName, record)

  if (outputDir) {
    // Best-effort, same spirit as the sidecar above: candidate-identifiable
    // evidence living NEXT TO whatever snapshots/screenshots/traces the CLI
    // itself writes into this exact directory, naming the same fields as
    // the sidecar so a human/agent never has to cross-reference two stores.
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(
      provenanceFilePath(outputDir),
      `${JSON.stringify({ sessionName, purpose, expectedSha, actualSha: claim.sha, worktree: claim.worktree ?? worktree, url: claim.url, createdAt: now }, null, 2)}\n`,
    )
  }

  return { ok: true, code: EXIT.OK, sessionName, record, reused: decision.action === 'reuse' }
}

/**
 * @param {object} opts - { sessionName, sidecarDir, cwd, worktree }
 *   worktree is optional: when omitted, the ownership check below cannot run and this behaves
 *   exactly as before (existing callers/tests that do not pass it are unaffected).
 * @param {object} deps - { playwrightClose }
 *   playwrightClose({ sessionName }) -> { ok, code?, reason?, spawnFailed? }
 */
export function runClose(opts, deps) {
  const { sessionName, sidecarDir, worktree } = opts
  const sidecar = readSidecar(sidecarDir, sessionName)

  // Engineering QA P1: verify ownership from the sidecar's OWN recorded
  // worktree before ever invoking the real CLI — a wrong-worktree close
  // attempt must never be allowed to masquerade as success (see
  // verifyCloseOwnership's docblock for why the CLI's own exit code cannot
  // be trusted to distinguish the two cases).
  const ownership = verifyCloseOwnership(sidecar, worktree)
  if (!ownership.ok) {
    return { ok: false, code: ownership.code, message: ownership.reason, sidecarFound: true }
  }

  const closed = deps.playwrightClose({ sessionName })
  if (closed.spawnFailed) {
    // The CLI binary itself could not be run at all — a real environment
    // failure, not "session already gone". Keep the sidecar: we cannot
    // confirm anything actually happened.
    return { ok: false, code: closed.code ?? EXIT.TOOLING, message: closed.reason, sidecarFound: Boolean(sidecar) }
  }

  // The CLI ran and reported its own result. Whether it succeeded or the
  // named session simply no longer existed, our own bookkeeping for a
  // session we were explicitly asked to close is unconditionally cleared —
  // "closing one session must not terminate unrelated sessions" (this
  // touches exactly `sessionName`'s file, see sidecar-store.mjs) and must
  // not leave a phantom OPEN record behind either.
  removeSidecar(sidecarDir, sessionName)

  return { ok: true, code: EXIT.OK, sidecarFound: Boolean(sidecar), playwrightExitCode: closed.code }
}
