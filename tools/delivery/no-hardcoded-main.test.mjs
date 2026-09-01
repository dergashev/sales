// tools/delivery/no-hardcoded-main.test.mjs
//
// DELIVERY-INFRA-01 REGRESSION CASES A/B — static guard.
//
// The concrete defect this ticket fixes (`tools/worktrees/dev-main.mjs`,
// `tools/worktrees/check.mjs`, `tools/browser-agent/status.mjs`,
// `tools/browser-agent/lib/runtime-bridge.mjs`) was every one of these
// files calling `git(cwd, ['rev-parse', 'main'])` directly instead of
// going through the one canonical resolver
// (`tools/runtime/lib/release-branch.mjs`). `resolveCurrentMainAuthority`
// itself is exhaustively covered against real git fixtures in
// `tools/runtime/lib/release-branch.test.mjs` (its own CASE 1/CASE 2/
// CASE 4). This file is the complementary, cheap, static guard: it makes
// sure NONE of this repository's lifecycle tooling silently regresses back
// to the literal hard-code, in these files or any new one added later
// under the same directories.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

// Every file previously containing the literal hard-code, per DELIVERY-INFRA-01's
// own audit (`grep -rn "'main'" tools/`). Any NEW lifecycle file that needs
// "the authoritative release SHA right now" must import
// resolveCurrentMainAuthority instead of adding another literal here.
const MUST_NOT_HARDCODE = [
  'tools/worktrees/dev-main.mjs',
  'tools/worktrees/check.mjs',
  'tools/browser-agent/status.mjs',
  'tools/browser-agent/lib/runtime-bridge.mjs',
]

// Matches the actual CODE call shape (`git(cwd, ['rev-parse', 'main'])`,
// however it is spaced/quoted) — never prose. Several of these files
// deliberately mention "git rev-parse main" inside backticked comments to
// document what NOT to do any more; a broader text-only pattern would
// false-positive on that prose, so this stays scoped to the array-literal
// call shape a real regression would reintroduce.
const LITERAL_CALL_PATTERN = /rev-parse['"]\s*,\s*['"]main['"]/

describe('DELIVERY-INFRA-01 CASE A/B — no literal "git rev-parse main" in lifecycle tooling', () => {
  for (const relPath of MUST_NOT_HARDCODE) {
    it(`${relPath} does not hard-code a literal local "main" branch`, () => {
      const content = readFileSync(path.join(repoRoot, relPath), 'utf8')
      expect(content).not.toMatch(LITERAL_CALL_PATTERN)
    })

    it(`${relPath} imports the one canonical resolver (resolveCurrentMainAuthority)`, () => {
      const content = readFileSync(path.join(repoRoot, relPath), 'utf8')
      expect(content).toMatch(/resolveCurrentMainAuthority/)
    })
  }

  it('a repository-wide search finds zero literal "git rev-parse main" call sites outside tests/fixtures', () => {
    const result = spawnSync('grep', ['-rn', "rev-parse', 'main'", path.join(repoRoot, 'tools')], { encoding: 'utf8' })
    // grep exit 1 = no matches (the desired outcome); exit 0 = matches found.
    const matches = result.status === 0 ? result.stdout.split('\n').filter(Boolean) : []
    const offenders = matches.filter((line) => !line.includes('.test.') && !/release-branch\.mjs:/.test(line))
    expect(offenders).toEqual([])
  })
})
