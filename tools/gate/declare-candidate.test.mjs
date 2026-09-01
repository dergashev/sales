// tools/gate/declare-candidate.test.mjs
//
// DELIVERY-INFRA-01 — found by the end-to-end delivery-lifecycle dry run:
// `gate:declare`'s wholesale entry-replace (declareCandidate's own,
// deliberately tested contract — see manifest.test.mjs) was silently
// erasing a `taskBaseCommit` pin that `runtime:task-base` /
// `delivery:preflight` had already established for the same lane, the
// moment a normal "implement -> commit -> gate:declare" rework cycle ran.
// That is exactly the silent-rebase-on-rework failure mode the PINNED
// CANDIDATE RULE (tools/runtime/lib/preflight.mjs) exists to prevent.
//
// Real hermetic git repo + a real spawned `node tools/gate/declare-candidate.mjs`
// process (not a mocked manifest) — same pattern as
// tools/runtime/lib/release-branch.test.mjs.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { defaultManifestPath, readManifest } from './lib/manifest.mjs'
import { updateCandidateFields } from '../runtime/lib/candidate-fields.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const declareScript = path.join(repoRoot, 'tools', 'gate', 'declare-candidate.mjs')

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout.trim()
}

function commit(cwd, message) {
  git(cwd, ['add', '-A'])
  git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message, '--no-verify'])
  return git(cwd, ['rev-parse', 'HEAD'])
}

function declare(cwd, args) {
  return spawnSync('node', [declareScript, ...args], { cwd, encoding: 'utf8' })
}

let tmpRoot
let repo
let commonDir
let manifestPath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-declare-candidate-'))
  repo = path.join(tmpRoot, 'repo')
  git(tmpRoot, ['init', '-q', '-b', 'master', repo])
  git(repo, ['config', 'user.email', 'test@example.invalid'])
  git(repo, ['config', 'user.name', 'Declare Candidate Test'])
  writeFileSync(path.join(repo, 'README.md'), 'x\n')
  commit(repo, 'initial commit')
  commonDir = git(repo, ['rev-parse', '--git-common-dir'])
  manifestPath = defaultManifestPath(path.resolve(repo, commonDir))
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('gate:declare preserves a pinned taskBaseCommit across a rework re-declaration', () => {
  it('a fresh declare has no taskBaseCommit yet', () => {
    const result = declare(repo, ['--lane', 'engineering'])
    expect(result.status).toBe(0)
    const manifest = readManifest(manifestPath)
    expect(manifest.engineering.taskBaseCommit).toBeUndefined()
  })

  it('re-declaring after a pin was established (rework) PRESERVES taskBaseCommit/pinnedAt', () => {
    declare(repo, ['--lane', 'engineering'])
    updateCandidateFields(manifestPath, 'engineering', { taskBaseCommit: 'a'.repeat(40), pinnedAt: '2026-01-01T00:00:00.000Z' })

    writeFileSync(path.join(repo, 'more.txt'), 'more\n')
    const newSha = commit(repo, 'rework commit')

    const result = declare(repo, ['--lane', 'engineering'])
    expect(result.status).toBe(0)

    const manifest = readManifest(manifestPath)
    expect(manifest.engineering.sha).toBe(newSha)
    expect(manifest.engineering.taskBaseCommit).toBe('a'.repeat(40))
    expect(manifest.engineering.pinnedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('declaring a DIFFERENT lane never inherits another lane\'s pin', () => {
    declare(repo, ['--lane', 'engineering'])
    updateCandidateFields(manifestPath, 'engineering', { taskBaseCommit: 'a'.repeat(40), pinnedAt: '2026-01-01T00:00:00.000Z' })

    const result = declare(repo, ['--lane', 'calculation'])
    expect(result.status).toBe(0)

    const manifest = readManifest(manifestPath)
    expect(manifest.calculation.taskBaseCommit).toBeUndefined()
    expect(manifest.engineering.taskBaseCommit).toBe('a'.repeat(40)) // untouched
  })

  it('a genuinely first-ever declare for a never-pinned lane still works exactly as before (no regression to the base case)', () => {
    const result = declare(repo, ['--lane', 'engineering', '--task-id', 'T-1'])
    expect(result.status).toBe(0)
    const manifest = readManifest(manifestPath)
    expect(manifest.engineering.taskId).toBe('T-1')
    expect('taskBaseCommit' in manifest.engineering).toBe(false)
  })
})
