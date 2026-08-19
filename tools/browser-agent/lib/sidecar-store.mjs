// tools/browser-agent/lib/sidecar-store.mjs
//
// Per-session provenance sidecar records (ticket "BROWSER SESSION RECORD").
// One JSON file per session, under `.artifacts/browser-agent-sessions/`
// (`.artifacts/` is already repository-gitignored — see .gitignore — so no
// new ignore rule was needed for this task).
//
// Deliberately one file per session, not one shared registry: the Runtime
// Provenance registry (tools/runtime/lib/registry.mjs) needs a lock because
// many claims share ONE file; here every session already has a structurally
// unique, sha-keyed name (session-name.mjs), so two sessions never contend
// for the same path, and `writeManifestAtomic`'s existing tmp-then-rename
// primitive is sufficient to make a single sidecar's write atomic — no new
// lock code exists anywhere in this task, reusing exactly what
// tools/gate/lib/manifest.mjs already provides.
//
// `close` unlinks exactly the one path it is given and nothing else --
// "closing one session must not terminate unrelated sessions" is therefore
// true by construction, not by convention (see decide.mjs's planClose).

import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { readManifest, writeManifestAtomic } from '../../gate/lib/manifest.mjs'

export function defaultSidecarDir(repoRoot) {
  return path.join(repoRoot, '.artifacts', 'browser-agent-sessions')
}

function sidecarPath(dir, sessionName) {
  return path.join(dir, `${sessionName}.json`)
}

/** Returns the record, or `null` if this exact session has no sidecar yet. */
export function readSidecar(dir, sessionName) {
  const file = sidecarPath(dir, sessionName)
  if (!existsSync(file)) return null
  const data = readManifest(file)
  return Object.keys(data).length === 0 ? null : data
}

/** Atomic single-file write (mkdir -p + tmp-then-rename, via manifest.mjs). */
export function writeSidecar(dir, sessionName, record) {
  mkdirSync(dir, { recursive: true })
  writeManifestAtomic(sidecarPath(dir, sessionName), record)
}

/** No-op if the session was never tracked here — removal is idempotent. */
export function removeSidecar(dir, sessionName) {
  const file = sidecarPath(dir, sessionName)
  if (existsSync(file)) unlinkSync(file)
}

/** All tracked sessions, `{ sessionName, ...record }`, for `browser:agent:status`. */
export function listSidecars(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const sessionName = name.slice(0, -'.json'.length)
      const record = readManifest(path.join(dir, name))
      return { sessionName, ...record }
    })
}
