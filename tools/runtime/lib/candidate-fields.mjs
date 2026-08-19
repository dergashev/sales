// tools/runtime/lib/candidate-fields.mjs
//
// `declareCandidate` (tools/gate/lib/manifest.mjs) replaces a lane's entire
// entry wholesale — correct for its one job (declaring a brand-new
// candidate), but wrong for this task's `taskBaseCommit`/`pinnedAt`
// pinning, which must be ADDITIVE to an entry `declareCandidate` already
// wrote, under the same lock, without racing a concurrent full
// re-declaration into losing either side's fields. This is the exact
// "wholesale replace clobbers a concurrent partial update" defect class
// already fixed once for the manifest lock itself (Tech Review P2-1); this
// module is the merge-preserving counterpart for lane-entry FIELDS.

import { readManifest, writeManifestAtomic } from '../../gate/lib/manifest.mjs'
import { withManifestLock } from '../../gate/lib/manifest-lock.mjs'

/**
 * Merges `fields` into `manifest[lane]` and persists atomically under the
 * manifest lock. Refuses (throws, writes nothing) if the lane has no
 * existing entry — task-base pinning only ever applies to an
 * already-declared candidate; there is nothing sound to merge fields onto
 * otherwise, and silently creating a bare entry would hide a real
 * "declare-candidate was never run for this lane" bug.
 *
 * @param {string} manifestPath
 * @param {string} lane
 * @param {object} fields - additive fields to merge onto the existing lane entry.
 */
export function updateCandidateFields(manifestPath, lane, fields) {
  return withManifestLock(manifestPath, () => {
    const manifest = readManifest(manifestPath)
    if (!manifest[lane]) {
      throw new Error(`No candidate is declared for lane "${lane}" — run "node tools/gate/declare-candidate.mjs --lane ${lane}" first.`)
    }
    manifest[lane] = { ...manifest[lane], ...fields }
    writeManifestAtomic(manifestPath, manifest)
    return manifest[lane]
  })
}
