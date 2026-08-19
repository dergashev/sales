// tools/browser-agent/lib/artifacts-dir.mjs
//
// Per-session Playwright CLI artifact location (Engineering Architecture
// D2). `.playwright/cli.config.json`'s tracked `outputDir` ("
// .artifacts/browser-agent") is ONE flat directory shared by every session
// — snapshots/screenshots/traces from CURRENT_MAIN@A and
// REVIEW_CANDIDATE@B would collide there and carry no git identity of
// their own. This module only adds the per-session subdirectory under that
// same tracked base; it does not own or duplicate the base location.

import path from 'node:path'

/** ".artifacts/browser-agent/<sessionName>/" — bound to the daemon via `PLAYWRIGHT_MCP_OUTPUT_DIR` at `open` time (see playwright-cli-bridge.mjs). */
export function sessionArtifactsDir(repoRoot, sessionName) {
  return path.join(repoRoot, '.artifacts', 'browser-agent', sessionName)
}

/** The provenance sidecar written INTO the session's own artifact dir, next to whatever Playwright CLI itself writes there. */
export function provenanceFilePath(sessionDir) {
  return path.join(sessionDir, 'provenance.json')
}

