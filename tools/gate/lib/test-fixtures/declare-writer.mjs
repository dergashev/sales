// tools/gate/lib/test-fixtures/declare-writer.mjs
//
// Spawned as a REAL, separate OS process by manifest.test.mjs's
// concurrency regression tests, so those tests exercise actual
// cross-process file contention rather than mocked/sequential
// in-process calls (ticket §12). Calls the exact shipped
// `declareCandidate` — no test-only branching, no shortcuts.
//
// argv: manifestPath lane sha

import { declareCandidate } from '../manifest.mjs'

const [, , manifestPath, lane, sha] = process.argv

declareCandidate(manifestPath, lane, {
  sha,
  worktree: `/wt/${lane}`,
  declaredAt: new Date().toISOString(),
})
