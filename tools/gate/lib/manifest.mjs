// tools/gate/lib/manifest.mjs
//
// The exact-candidate manifest is the repo-owned channel that tells the
// gate WHICH commit, in WHICH worktree, each delivery lane is currently
// validating. It lives inside the git common dir (default:
// `<git-common-dir>/a3/validation-candidates.json`) — shared by every
// linked worktree of this repository, never committed, never walked by
// tools/verify.py or tools/validation_paths.py, and it survives a
// worktree being added/removed. Same "resolve from the git COMMON dir"
// pattern tests/browser already uses for reading .agentsroom state.
//
// Shape:
// {
//   "<lane>": {
//     "sha": "<full 40-char commit sha>",
//     "worktree": "<absolute path>",
//     "branch": "<branch name or null when detached>",
//     "runId": "<team run id or null>",
//     "nodeId": "<team node id or null>",
//     "taskId": "<task/ticket id or null>",
//     "declaredBy": "<agent/role string or null>",
//     "declaredAt": "<ISO 8601 timestamp>"
//   },
//   ...
// }

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { withManifestLock } from './manifest-lock.mjs'

export function defaultManifestPath(gitCommonDir) {
  return path.join(gitCommonDir, 'a3', 'validation-candidates.json')
}

/** Reads the manifest. Missing file -> `{}`. A corrupt file is a hard error (caller decides). */
export function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) return {}
  const raw = readFileSync(manifestPath, 'utf8')
  if (raw.trim().length === 0) return {}
  return JSON.parse(raw)
}

/** Atomic write: write to a sibling temp file, then rename over the target. */
export function writeManifestAtomic(manifestPath, data) {
  mkdirSync(path.dirname(manifestPath), { recursive: true })
  const tmpPath = `${manifestPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`
  try {
    writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    renameSync(tmpPath, manifestPath)
  } catch (err) {
    // Never leave our own half-written temp file behind on failure (a
    // failed write must not leak an owned artifact); never touch any
    // OTHER path, known or unknown.
    try {
      unlinkSync(tmpPath)
    } catch {
      // Nothing was written yet, or it's already gone - both fine.
    }
    throw err
  }
}

/**
 * Merge-updates a single lane's entry and persists the whole manifest
 * atomically. Concurrency-safe: the read, mutate and write happen inside
 * `withManifestLock`, so two lanes (or two rapid re-declarations of the
 * same lane) declaring at the same time can never lose one of their
 * updates to the other — see manifest-lock.mjs for the mechanism and
 * lib/manifest.test.mjs / gate.test.mjs for the regression coverage.
 *
 * Same-lane contention is resolved deterministically by serialization:
 * the last writer to acquire the lock produces the stored value for that
 * lane, as a complete, non-merged entry — never a field-level mix of two
 * concurrent declarations. Other lanes' entries are always preserved.
 *
 * Throws (writing nothing) if the lock cannot be acquired — a
 * concurrency failure must surface as a hard error, never as a silently
 * skipped declaration (fail-closed, ticket §8).
 */
export function declareCandidate(manifestPath, lane, entry) {
  return withManifestLock(manifestPath, () => {
    const manifest = readManifest(manifestPath)
    manifest[lane] = entry
    writeManifestAtomic(manifestPath, manifest)
    return manifest
  })
}
