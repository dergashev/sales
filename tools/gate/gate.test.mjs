// tools/gate/gate.test.mjs
//
// End-to-end tests: spawn the REAL `node tools/gate/gate.mjs` against
// hermetic throwaway git repositories (mkdtemp + real `git init` + real
// `git worktree add`), never the actual project checkout or its manifest
// (an explicit --manifest always points inside the temp dir).
//
// gate.sh's own runtime-resolution behavior (Scenario D) is covered
// separately in gate.sh.test.mjs, since node/npm are already on PATH
// inside the test runner itself — these tests exercise gate.mjs directly.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { declareCandidate } from './lib/manifest.mjs'

const GATE_MJS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'gate.mjs')
const DECLARE_MJS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'declare-candidate.mjs')

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${result.stderr}`)
  return result.stdout.trim()
}

function commit(cwd, message) {
  git(cwd, ['add', '-A'])
  git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-m', message, '--no-verify'])
  return git(cwd, ['rev-parse', 'HEAD'])
}

const FIXTURE_PACKAGE_JSON = JSON.stringify(
  {
    name: 'gate-fixture',
    private: true,
    scripts: {
      typecheck: 'node -e "require(\'fs\').writeFileSync(\'RAN_TYPECHECK\',\'1\')"',
      test: 'node -e "require(\'fs\').writeFileSync(\'RAN_TEST\',\'1\')"',
      verify:
        'node -e "if (require(\'fs\').existsSync(\'FAIL_VERIFY\')) { console.error(\'VERIFY FIXTURE ERROR: 3 new violations found\'); process.exit(1) } else { require(\'fs\').writeFileSync(\'RAN_VERIFY\',\'1\') }"',
      build: 'node -e "require(\'fs\').writeFileSync(\'RAN_BUILD\',\'1\')"',
      // The trailing `--` is required: without it, node parses the extra
      // `--expect-sha <sha>` argv (passed through by `npm run ... -- ...`)
      // as ITS OWN CLI flags rather than the script's process.argv, and
      // exits 9 with "bad option: --expect-sha" before the script runs.
      'test:browser:desktop': 'node -e "require(\'fs\').writeFileSync(\'RAN_BROWSER\',\'1\')" --',
    },
  },
  null,
  2,
)

let tmpRoot
let repoDir
let candidateDir
let manifestPath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-gate-e2e-'))
  repoDir = path.join(tmpRoot, 'root')
  candidateDir = path.join(tmpRoot, 'candidate')
  manifestPath = path.join(tmpRoot, 'manifest.json')

  git(tmpRoot, ['init', '-q', '-b', 'unrelated-branch', 'root'])
  git(repoDir, ['config', 'user.email', 'test@example.invalid'])
  git(repoDir, ['config', 'user.name', 'Gate Test'])
  writeFileSync(path.join(repoDir, 'package.json'), FIXTURE_PACKAGE_JSON)
  commit(repoDir, 'root: unrelated commit')
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

function addCandidateWorktree() {
  git(repoDir, ['worktree', 'add', '-b', 'feature/x', candidateDir])
  writeFileSync(path.join(candidateDir, 'feature.txt'), 'candidate change\n')
  return commit(candidateDir, 'candidate: implementation commit')
}

function runGate(args, { cwd = repoDir, env = process.env } = {}) {
  return spawnSync('node', [GATE_MJS, ...args], { cwd, encoding: 'utf8', env })
}

describe('gate.mjs end-to-end — exact-candidate machine validation gate', () => {
  it('Scenario A: candidate in an isolated worktree, invoked from the unrelated root -> candidate is validated, not root', () => {
    const candidateSha = addCandidateWorktree()
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/VALIDATION PROVENANCE/)
    expect(result.stdout).toContain(`WORKTREE         : ${candidateDir}`)
    expect(result.stdout).toContain(`ACTUAL HEAD      : ${candidateSha}`)

    // The steps actually ran against the candidate, never against root.
    expect(existsSync(path.join(candidateDir, 'RAN_TYPECHECK'))).toBe(true)
    expect(existsSync(path.join(candidateDir, 'RAN_TEST'))).toBe(true)
    expect(existsSync(path.join(candidateDir, 'RAN_VERIFY'))).toBe(true)
    expect(existsSync(path.join(candidateDir, 'RAN_BUILD'))).toBe(true)
    expect(existsSync(path.join(repoDir, 'RAN_TYPECHECK'))).toBe(false)

    // Evidence lands inside the candidate worktree, never at root.
    expect(existsSync(path.join(candidateDir, '.artifacts', 'validation'))).toBe(true)
    expect(existsSync(path.join(repoDir, '.artifacts', 'validation'))).toBe(false)
  })

  it('Scenario B: --expect-sha overriding the manifest with a WRONG sha -> fail closed (exit 2), no gate step ever runs', () => {
    const candidateSha = addCandidateWorktree()
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })

    const wrongSha = 'f'.repeat(40)
    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath, '--expect-sha', wrongSha])

    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/VALIDATION INFRASTRUCTURE BLOCKER/)
    expect(existsSync(path.join(candidateDir, 'RAN_TYPECHECK'))).toBe(false)
    expect(existsSync(path.join(candidateDir, '.artifacts'))).toBe(false)
  })

  it('Scenario E: rework moves HEAD without re-declaring -> the stale manifest entry is rejected exactly like Scenario B', () => {
    const firstSha = addCandidateWorktree()
    declareCandidate(manifestPath, 'engineering', { sha: firstSha, worktree: candidateDir })

    writeFileSync(path.join(candidateDir, 'feature.txt'), 'reworked change\n')
    commit(candidateDir, 'candidate: rework commit') // HEAD moves; manifest still says firstSha

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(result.status).toBe(2)
    expect(existsSync(path.join(candidateDir, 'RAN_TYPECHECK'))).toBe(false)
  })

  it('Scenario C: a registered candidate worktree whose directory was deleted (without git worktree remove) -> infrastructure blocker, never substitutes root', () => {
    const candidateSha = addCandidateWorktree()
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })
    rmSync(candidateDir, { recursive: true, force: true }) // gone on disk, but still "registered" in git's admin metadata

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect([2, 3]).toContain(result.status) // either classification is a fail-closed infrastructure blocker
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/VALIDATION INFRASTRUCTURE BLOCKER/)
  })

  it('an undeclared/unregistered worktree path is refused (code 2), distinct from a registered-but-deleted one', () => {
    addCandidateWorktree()
    const neverRegisteredDir = path.join(tmpRoot, 'never-a-worktree')
    declareCandidate(manifestPath, 'engineering', { sha: 'a'.repeat(40), worktree: neverRegisteredDir })

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(result.status).toBe(2)
  })

  it('no declared candidate and no --expect-sha for the lane -> fail closed (exit 2), never falls back to root', () => {
    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(result.status).toBe(2)
  })

  it('a real product/gate failure (verify fails) is reported as exit 1, distinct from an infrastructure blocker, and stops before build', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', candidateDir])
    writeFileSync(path.join(candidateDir, 'feature.txt'), 'candidate change\n')
    // FAIL_VERIFY must be COMMITTED (tracked), not left dirty: an
    // uncommitted marker would be correctly refused by the dirty-tree
    // check before ever reaching the gate-step-failure path this test
    // targets — that is a separate, already-covered scenario.
    writeFileSync(path.join(candidateDir, 'FAIL_VERIFY'), '1\n')
    const candidateSha = commit(candidateDir, 'candidate: implementation commit that fails verify')
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(result.status).toBe(1)
    expect(result.stderr).not.toMatch(/VALIDATION INFRASTRUCTURE BLOCKER/)
    expect(existsSync(path.join(candidateDir, 'RAN_TYPECHECK'))).toBe(true)
    expect(existsSync(path.join(candidateDir, 'RAN_TEST'))).toBe(true)
    expect(existsSync(path.join(candidateDir, 'RAN_VERIFY'))).toBe(false) // it failed, so it never wrote its marker
    expect(existsSync(path.join(candidateDir, 'RAN_BUILD'))).toBe(false) // fail-fast: build never ran
  })

  it('Tech Review P1/P2 regression: a failing step\'s own output reaches the gate\'s stdout AND is durably logged, not just an exit code', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', candidateDir])
    writeFileSync(path.join(candidateDir, 'feature.txt'), 'candidate change\n')
    writeFileSync(path.join(candidateDir, 'FAIL_VERIFY'), '1\n')
    const candidateSha = commit(candidateDir, 'candidate: implementation commit that fails verify')
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(result.status).toBe(1)

    // The defect Tech Review demonstrated on 9017225a: the entire gate
    // output was "[gate] FAIL (exit 1): step "typecheck" exited 2." with
    // the actual compiler/verify error nowhere to be found. Assert the
    // fixture's own diagnostic message is now actually present.
    expect(result.stdout).toContain('VERIFY FIXTURE ERROR: 3 new violations found')

    // And durably logged to disk, not just streamed transiently.
    const logsRoot = path.join(candidateDir, '.artifacts', 'validation')
    const runDirs = readdirSync(logsRoot).filter((name) => name.startsWith(candidateSha))
    const logDir = runDirs.find((name) => !name.endsWith('.json'))
    expect(logDir).toBeTruthy()
    const verifyLog = readFileSync(path.join(logsRoot, logDir, 'verify.log'), 'utf8')
    expect(verifyLog).toContain('VERIFY FIXTURE ERROR: 3 new violations found')

    // The evidence JSON references the log and carries a tail for the
    // failing step, so a reviewer reading ONLY the JSON still sees why it
    // failed, without needing to separately locate the log file.
    const evidenceFile = runDirs.find((name) => name.endsWith('.json'))
    const evidence = JSON.parse(readFileSync(path.join(logsRoot, evidenceFile), 'utf8'))
    const verifyResult = evidence.steps.find((s) => s.name === 'verify')
    expect(verifyResult.status).toBe(1)
    expect(verifyResult.logPath).toContain('verify.log')
    expect(verifyResult.outputTail).toContain('VERIFY FIXTURE ERROR: 3 new violations found')
    // Passing steps stay lean: no outputTail clutter on the common path.
    const typecheckResult = evidence.steps.find((s) => s.name === 'typecheck')
    expect(typecheckResult.outputTail).toBeUndefined()
  })

  it('a dirty candidate worktree is refused without --allow-dirty, and accepted (with dirty:true) when passed', () => {
    const candidateSha = addCandidateWorktree()
    writeFileSync(path.join(candidateDir, 'uncommitted.txt'), 'oops\n')
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })

    const blocked = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(blocked.status).toBe(2)

    const allowed = runGate(['--lane', 'engineering', '--manifest', manifestPath, '--allow-dirty'])
    expect(allowed.status).toBe(0)
    expect(allowed.stdout).toContain('DIRTY            : true')
  })

  it('--browser adds the desktop smoke step, threaded with the exact candidate SHA', () => {
    const candidateSha = addCandidateWorktree()
    declareCandidate(manifestPath, 'engineering', { sha: candidateSha, worktree: candidateDir })

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath, '--browser'])
    expect(result.status).toBe(0)
    expect(existsSync(path.join(candidateDir, 'RAN_BROWSER'))).toBe(true)
  })

  it('two worktrees at the SAME sha with no explicit --worktree is refused as ambiguous, never picked by recency/branch', () => {
    const candidateSha = addCandidateWorktree()
    const secondDir = path.join(tmpRoot, 'second')
    git(repoDir, ['worktree', 'add', secondDir, candidateSha]) // detached at the same sha

    const result = runGate(['--lane', 'engineering', '--manifest', manifestPath, '--expect-sha', candidateSha])
    expect(result.status).toBe(2)
    expect(existsSync(path.join(candidateDir, 'RAN_TYPECHECK'))).toBe(false)
    expect(existsSync(path.join(secondDir, 'RAN_TYPECHECK'))).toBe(false)
  })

  it('declare-candidate.mjs CLI writes the same manifest shape the gate reads', () => {
    const candidateSha = addCandidateWorktree()
    const cliResult = spawnSync(
      'node',
      [DECLARE_MJS, '--lane', 'engineering', '--worktree', candidateDir, '--manifest', manifestPath, '--task-id', 'ticket-123'],
      { encoding: 'utf8' },
    )
    expect(cliResult.status).toBe(0)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    expect(manifest.engineering.sha).toBe(candidateSha)
    expect(manifest.engineering.taskId).toBe('ticket-123')

    const gateResult = runGate(['--lane', 'engineering', '--manifest', manifestPath])
    expect(gateResult.status).toBe(0)
  })
})
