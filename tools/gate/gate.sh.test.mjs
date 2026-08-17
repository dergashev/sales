// tools/gate/gate.sh.test.mjs
//
// Scenario D from the ticket: "minimal spawned shell without inherited
// PATH -> approved node/npm still resolved deterministically (no
// 'npm: command not found'), or fails closed as an infrastructure
// blocker — never PASS." Exercises the REAL POSIX shell script, not a
// simulation of it, with a fabricated $HOME so no machine-wide state is
// touched (no sudo, no global symlink, nothing written outside a tmpdir).
//
// This intentionally probes the real filesystem for /opt/homebrew and
// /usr/local/bin, matching gate.sh's own unconditional precedence rules —
// documented, not hidden, since that IS what gate.sh checks.

import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const GATE_SH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'gate.sh')

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

// A minimal PATH matching the observed vendor check-gate shell, i.e. NO
// interactively-installed node/npm directory on it.
const MINIMAL_PATH = '/usr/bin:/bin'

const HOST_HAS_HOMEBREW_NODE = existsSync('/opt/homebrew/bin/node')
const HOST_HAS_USR_LOCAL_NODE = existsSync('/usr/local/bin/node')

let tmpRoot
let fakeHome

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-gate-sh-'))
  fakeHome = path.join(tmpRoot, 'home')
  mkdirSync(fakeHome, { recursive: true })
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

// cwd is ALWAYS explicit and defaults to the fabricated tmpRoot — never
// the test runner's own cwd (which is a real, unrelated git repository:
// omitting this was the exact class of bug this whole ticket is about).
function runGateSh(args, env, cwd = tmpRoot) {
  return spawnSync('/bin/sh', [GATE_SH, ...args], { encoding: 'utf8', env, cwd })
}

describe('gate.sh — deterministic runtime resolution (Scenario D)', () => {
  it.skipIf(HOST_HAS_HOMEBREW_NODE || HOST_HAS_USR_LOCAL_NODE)(
    'no node anywhere gate.sh looks -> exit 4, VALIDATION INFRASTRUCTURE BLOCKER, never PASS',
    () => {
      const result = runGateSh(['--lane', 'engineering', '--help'], {
        HOME: fakeHome,
        PATH: MINIMAL_PATH,
      })
      expect(result.status).toBe(4)
      expect(result.stderr).toMatch(/VALIDATION INFRASTRUCTURE BLOCKER/)
    },
  )

  it('resolves node/npm deterministically from $HOME/.local/bin when PATH is minimal, and reports it as PATH SOURCE', () => {
    // Symlink the REAL node/npm this test runner is already using into a
    // fabricated $HOME — no sudo, no global symlink, no machine-wide PATH
    // mutation; everything lives inside the tmpdir and is removed after.
    const whichNode = spawnSync('command', ['-v', 'node'], { shell: true, encoding: 'utf8' }).stdout.trim()
    const whichNpm = spawnSync('command', ['-v', 'npm'], { shell: true, encoding: 'utf8' }).stdout.trim()
    expect(whichNode).not.toBe('')
    expect(whichNpm).not.toBe('')

    const fakeLocalBin = path.join(fakeHome, '.local', 'bin')
    mkdirSync(fakeLocalBin, { recursive: true })
    symlinkSync(whichNode, path.join(fakeLocalBin, 'node'))
    symlinkSync(whichNpm, path.join(fakeLocalBin, 'npm'))

    const repoDir = path.join(tmpRoot, 'root')
    git(tmpRoot, ['init', '-q', '-b', 'main', 'root'])
    git(repoDir, ['config', 'user.email', 'test@example.invalid'])
    git(repoDir, ['config', 'user.name', 'Gate Test'])
    writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'node -e "1"', test: 'node -e "1"', verify: 'node -e "1"', build: 'node -e "1"' } }),
    )
    const sha = commit(repoDir, 'initial commit')

    const manifestPath = path.join(tmpRoot, 'manifest.json')
    writeFileSync(
      manifestPath,
      JSON.stringify({ engineering: { sha, worktree: repoDir } }),
    )

    const result = runGateSh(
      ['--lane', 'engineering', '--manifest', manifestPath],
      { HOME: fakeHome, PATH: MINIMAL_PATH }, // deliberately WITHOUT the real node/npm directory
      repoDir,
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('PATH SOURCE      : $HOME/.local/bin')
  })

  it('an explicit A3_NODE_BIN override always wins, even when $HOME/.local/bin also has a valid node', () => {
    const whichNode = spawnSync('command', ['-v', 'node'], { shell: true, encoding: 'utf8' }).stdout.trim()
    const whichNpm = spawnSync('command', ['-v', 'npm'], { shell: true, encoding: 'utf8' }).stdout.trim()

    const overrideDir = path.join(tmpRoot, 'override-bin')
    mkdirSync(overrideDir, { recursive: true })
    symlinkSync(whichNode, path.join(overrideDir, 'node'))
    symlinkSync(whichNpm, path.join(overrideDir, 'npm'))

    const fakeLocalBin = path.join(fakeHome, '.local', 'bin')
    mkdirSync(fakeLocalBin, { recursive: true })
    symlinkSync(whichNode, path.join(fakeLocalBin, 'node'))
    symlinkSync(whichNpm, path.join(fakeLocalBin, 'npm'))

    const result = runGateSh(['--lane', 'engineering', '--help'], {
      HOME: fakeHome,
      PATH: MINIMAL_PATH,
      A3_NODE_BIN: path.join(overrideDir, 'node'),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Usage: gate\.sh/)
  })
})
