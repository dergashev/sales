// tools/runtime/lib/registry.mjs
//
// The Runtime Provenance Contract's identity store: one JSON file,
// `<git-common-dir>/a3/runtimes.json`, shared by every linked worktree —
// same "one file in the never-committed a3/ directory, guarded by a lock
// file next to it" shape tools/gate/lib/manifest.mjs already established
// for the exact-candidate manifest, and tools/worktrees/lib/preview-state.mjs
// already reused for the local-main preview record. This module reuses the
// SAME atomic-write primitive (`writeManifestAtomic`) and the SAME
// concurrency-safe lock (`withManifestLock`) rather than re-implementing
// either — no new lock code exists anywhere in this task.
//
// CRITICAL DESIGN RULE (Engineering Architecture handoff): the registry
// stores CLAIMS, never STATUS. A claim is what a runtime asserted about
// itself the moment it was registered (purpose, sha, worktree, pid, port,
// url, startedAt, nonce). Every STATUS (SERVING_VERIFIED / STALE / DRIFTED
// / DEAD / UNVERIFIED / FOREIGN_HOST) is re-derived on every read from
// live git + a pid probe + an HTTP echo (see classify.mjs) — never stored.
// This is what makes "main advances -> the old CURRENT_MAIN record goes
// stale" a structural consequence of reading the registry, not a code path
// someone has to remember to run.
//
// Key shape: `runtimeId = "<PURPOSE>@<canonical worktree path>"`. Because
// CURRENT_MAIN always resolves to the one canonical `.preview/main`
// worktree, this key makes CURRENT_MAIN a singleton by construction — two
// concurrent starters race for the SAME key under the SAME lock, they
// cannot ever create two distinct "canonical" entries. TASK_CANDIDATE and
// REVIEW_CANDIDATE runtimes key off THEIR OWN worktree, so any number of
// them coexist safely side by side (ticket scenario N).

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { readManifest, writeManifestAtomic } from '../../gate/lib/manifest.mjs'
import { withManifestLock } from '../../gate/lib/manifest-lock.mjs'

export function defaultRegistryPath(gitCommonDir) {
  return path.join(gitCommonDir, 'a3', 'runtimes.json')
}

/** Mirrors tools/gate/lib/git-worktrees.mjs's private `canonicalize()`: resolve
 *  symlinks when the path exists (macOS /tmp, /var are themselves symlinks),
 *  fall back to a plain resolve for a path that does not exist yet. Kept as
 *  its own small copy rather than exported from git-worktrees.mjs — that
 *  module documents it as private, and this is the only other call site. */
function canonicalize(p) {
  try {
    return realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

/** `runtimeId = "<PURPOSE>@<canonical worktree path>"` — see module header. */
export function runtimeId(purpose, worktree) {
  return `${purpose}@${canonicalize(worktree)}`
}

/** Reads the whole registry. Missing file -> `{}` (no runtime ever registered). */
export function readRegistry(registryPath) {
  return readManifest(registryPath)
}

export function writeRegistryAtomic(registryPath, data) {
  writeManifestAtomic(registryPath, data)
}

/** Same exclusive-create + hard-link lock every other a3/ manifest already uses. */
export function withRegistryLock(registryPath, fn, opts) {
  return withManifestLock(registryPath, fn, opts)
}

/**
 * Merge-updates a single runtime's claim and persists the whole registry
 * atomically, under the lock — the same "declareCandidate" shape
 * tools/gate/lib/manifest.mjs already uses, applied to runtimes.json.
 * Concurrency-safe: two processes registering different ids (or racing to
 * register the SAME id, e.g. two CURRENT_MAIN starters) can never lose an
 * unrelated id's entry, and same-id contention resolves to "last writer
 * inside the lock wins", never a torn/partial file (ticket scenario H).
 */
export function putRuntimeClaim(registryPath, id, claim) {
  return withManifestLock(registryPath, () => {
    const registry = readRegistry(registryPath)
    registry[id] = claim
    writeRegistryAtomic(registryPath, registry)
    return registry
  })
}

/** Locked removal of one runtime's claim (used by `runtime:stop` once ownership
 *  has been proven). Removing an id that is not present is a no-op, not an error. */
export function removeRuntimeClaim(registryPath, id) {
  return withManifestLock(registryPath, () => {
    const registry = readRegistry(registryPath)
    if (id in registry) {
      delete registry[id]
      writeRegistryAtomic(registryPath, registry)
    }
    return registry
  })
}

/** All registered claims as `{ id, ...claim }` entries — for `runtime:status`. */
export function listClaims(registryPath) {
  const registry = readRegistry(registryPath)
  return Object.entries(registry).map(([id, claim]) => ({ id, ...claim }))
}

// ── Legacy preview-state.json migration (read-only, never deleted) ────────
//
// 16 other worktrees in this repository carry an older copy of the
// worktree-lifecycle tooling that only ever wrote
// `<git-common-dir>/a3/preview-state.json` and knows nothing about
// runtimes.json. Those copies' own dev:main invocations still correctly
// refuse to mutate a live-served preview by reading THAT file — deleting
// it, or simply ignoring it here, would disarm their live-owner guard.
// `runtime:status`/`classify` therefore dual-read it: if the registry has
// no CURRENT_MAIN claim yet but preview-state.json records one, synthesize
// an equivalent claim from it (read-only — this function never writes
// anything, to either file).

/** Reads legacy preview-state.json directly (same shape preview-state.mjs
 *  uses), without importing that module — this file must stay a leaf in the
 *  dependency graph relative to tools/worktrees so the two lifecycles can
 *  evolve independently; it only needs the raw JSON shape, not the lock. */
function readLegacyPreviewState(legacyPath) {
  if (!existsSync(legacyPath)) return null
  try {
    const raw = readFileSync(legacyPath, 'utf8')
    if (raw.trim().length === 0) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Returns the CURRENT_MAIN claim to classify: the registry's own claim if
 * present, otherwise a claim synthesized from the legacy preview-state.json
 * record (so an older dev:main-only worktree's live preview is still
 * recognized instead of silently reported as "never created"), otherwise
 * `null`. Never writes to either file.
 */
export function resolveCurrentMainClaim({ registryPath, legacyPreviewStatePath, previewWorktreePath }) {
  const registry = readRegistry(registryPath)
  const id = runtimeId('CURRENT_MAIN', previewWorktreePath)
  if (registry[id]) return { id, claim: registry[id], source: 'registry' }

  const legacy = readLegacyPreviewState(legacyPreviewStatePath)
  if (!legacy || !legacy.sha) return { id, claim: null, source: 'none' }

  return {
    id,
    source: 'legacy-preview-state',
    claim: {
      purpose: 'CURRENT_MAIN',
      sha: legacy.sha,
      worktree: legacy.dir ?? previewWorktreePath,
      pid: legacy.pid ?? null,
      port: legacy.port ?? null,
      url: legacy.port ? `http://127.0.0.1:${legacy.port}` : null,
      startedAt: legacy.startedAt ?? null,
      nonce: null, // legacy tooling never emitted a nonce -> classify() cannot verify it, only DEAD/ALIVE by pid.
      updatedAt: legacy.startedAt ?? null,
    },
  }
}
