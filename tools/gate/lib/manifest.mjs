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

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

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
  const tmpPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  renameSync(tmpPath, manifestPath)
}

/** Merge-updates a single lane's entry and persists the whole manifest atomically. */
export function declareCandidate(manifestPath, lane, entry) {
  const manifest = readManifest(manifestPath)
  manifest[lane] = entry
  writeManifestAtomic(manifestPath, manifest)
  return manifest
}
