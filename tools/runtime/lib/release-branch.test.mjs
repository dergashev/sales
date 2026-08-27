// tools/runtime/lib/release-branch.test.mjs
//
// Integration tests against REAL git — hermetic throwaway repositories built
// with mkdtemp, never touching the real project checkout. Covers the four
// required regression cases from the "Release & Pipeline Tooling Fixes"
// ticket:
//   CASE 1 — release authority points to `master` -> resolves `master`.
//   CASE 2 — a stale local `main` exists but authority points elsewhere ->
//            `main` is never silently served.
//   CASE 3 — expected vs actual SHA mismatch -> already covered by
//            classify.test.mjs's DRIFTED/STALE cases (classifyRuntime is
//            unchanged by this module; only the gitMainSha INPUT it receives
//            is now correctly resolved).
//   CASE 4 — authority unavailable/ambiguous -> explicit failure, no guess.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveCurrentMainAuthority, resolveReleaseBranch, resolveReleaseSha } from './release-branch.mjs'

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

let tmpRoot
let originDir
let cloneDir

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-release-branch-'))
  originDir = path.join(tmpRoot, 'origin.git')
  cloneDir = path.join(tmpRoot, 'clone')

  // A bare "origin" whose HEAD is `master` — mirrors the real repository's
  // actual origin (no remote `main` exists there at all).
  git(tmpRoot, ['init', '-q', '--bare', '-b', 'master', originDir])

  const seedDir = path.join(tmpRoot, 'seed')
  git(tmpRoot, ['init', '-q', '-b', 'master', seedDir])
  git(seedDir, ['config', 'user.email', 'test@example.invalid'])
  git(seedDir, ['config', 'user.name', 'Release Branch Test'])
  writeFileSync(path.join(seedDir, 'README.md'), 'root\n')
  commit(seedDir, 'initial commit on master')
  git(seedDir, ['push', originDir, 'master'])

  git(tmpRoot, ['clone', '-q', originDir, cloneDir])
  git(cloneDir, ['config', 'user.email', 'test@example.invalid'])
  git(cloneDir, ['config', 'user.name', 'Release Branch Test'])
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('resolveReleaseBranch', () => {
  it('CASE 1 — resolves the actual origin HEAD branch (master), never a hard-coded literal', () => {
    const result = resolveReleaseBranch(cloneDir, {})
    expect(result).not.toBeNull()
    expect(result.branch).toBe('master')
    expect(result.source).toMatch(/origin HEAD/)
  })

  it('CASE 2 — a stale local "main" branch existing alongside does not change resolution', () => {
    git(cloneDir, ['branch', 'main', 'HEAD'])
    // Simulate genuine staleness: master keeps moving, main does not.
    writeFileSync(path.join(cloneDir, 'later.txt'), 'later\n')
    const laterSha = commit(cloneDir, 'a later commit only on master')
    // Push via the NAMED remote (not the raw path) so git also updates this
    // clone's own refs/remotes/origin/master tracking ref locally — the raw-
    // path form used in beforeEach's seed push does not do this, but that
    // seed repo's tracking refs are never read by anything under test.
    git(cloneDir, ['push', 'origin', 'master'])

    const result = resolveReleaseBranch(cloneDir, {})
    expect(result.branch).toBe('master')

    const authority = resolveCurrentMainAuthority(cloneDir, {})
    expect(authority.ok).toBe(true)
    expect(authority.branch).toBe('master')
    expect(authority.sha).toBe(laterSha)
    // The stale local "main" branch's own sha must play NO role whatsoever.
    const staleMainSha = git(cloneDir, ['rev-parse', 'main'])
    expect(staleMainSha).not.toBe(laterSha)
  })

  it('a standalone repo with NO "origin" remote falls back to its own checked-out branch — no competing authority to diverge from (this is what keeps every hermetic single-repo test fixture in this codebase working)', () => {
    const standaloneRepo = path.join(tmpRoot, 'no-origin')
    git(tmpRoot, ['init', '-q', '-b', 'main', standaloneRepo])
    writeFileSync(path.join(standaloneRepo, 'f.txt'), 'x\n')
    git(standaloneRepo, ['config', 'user.email', 'test@example.invalid'])
    git(standaloneRepo, ['config', 'user.name', 'Release Branch Test'])
    commit(standaloneRepo, 'only commit')

    const result = resolveReleaseBranch(standaloneRepo, {})
    expect(result).not.toBeNull()
    expect(result.branch).toBe('main')
    expect(result.source).toMatch(/no "origin" remote configured/)

    const authority = resolveCurrentMainAuthority(standaloneRepo, {})
    expect(authority.ok).toBe(true)
    expect(authority.branch).toBe('main')
  })

  it('a standalone repo (no origin) with a local "main" branch resolves it even while a DIFFERENT branch is currently checked out — this is the normal CURRENT_MAIN shape: caller sits in some other worktree/branch and asks about "main" specifically', () => {
    const standaloneRepo = path.join(tmpRoot, 'no-origin-multi-branch')
    git(tmpRoot, ['init', '-q', '-b', 'main', standaloneRepo])
    writeFileSync(path.join(standaloneRepo, 'f.txt'), 'x\n')
    git(standaloneRepo, ['config', 'user.email', 'test@example.invalid'])
    git(standaloneRepo, ['config', 'user.name', 'Release Branch Test'])
    const mainSha = commit(standaloneRepo, 'only commit on main')
    git(standaloneRepo, ['checkout', '-q', '-b', 'some-feature-branch'])

    const result = resolveReleaseBranch(standaloneRepo, {})
    expect(result.branch).toBe('main')
    expect(result.source).toMatch(/local convention "main"/)

    const authority = resolveCurrentMainAuthority(standaloneRepo, {})
    expect(authority.ok).toBe(true)
    expect(authority.branch).toBe('main')
    expect(authority.sha).toBe(mainSha)
  })

  it('CASE 4a — an "origin" remote IS configured but its HEAD pointer never resolved (shallow/partial clone) -> explicit ambiguity, never a silent fall-through to the local branch', () => {
    const shallowLikeRepo = path.join(tmpRoot, 'origin-no-head')
    git(tmpRoot, ['init', '-q', '-b', 'main', shallowLikeRepo])
    writeFileSync(path.join(shallowLikeRepo, 'f.txt'), 'x\n')
    git(shallowLikeRepo, ['config', 'user.email', 'test@example.invalid'])
    git(shallowLikeRepo, ['config', 'user.name', 'Release Branch Test'])
    commit(shallowLikeRepo, 'only commit')
    // Register an "origin" remote URL WITHOUT ever populating
    // refs/remotes/origin/HEAD (no fetch, no `git remote set-head`) — this
    // is the actual shape of e.g. some shallow/CI clones, and it is the
    // genuinely ambiguous case: an authority exists but cannot be read.
    git(shallowLikeRepo, ['remote', 'add', 'origin', originDir])

    const result = resolveReleaseBranch(shallowLikeRepo, {})
    expect(result).toBeNull()

    const authority = resolveCurrentMainAuthority(shallowLikeRepo, {})
    expect(authority.ok).toBe(false)
    expect(authority.reason).toMatch(/could not determine the authoritative release branch/i)
  })

})

describe('resolveReleaseBranch — explicit override', () => {
  it('A3_RELEASE_BRANCH env override wins over origin HEAD resolution', () => {
    const result = resolveReleaseBranch(cloneDir, { A3_RELEASE_BRANCH: 'release/pinned' })
    expect(result.branch).toBe('release/pinned')
    expect(result.source).toMatch(/env override/)
  })

  it('CASE 4b — override names a branch that does not exist anywhere -> explicit failure, not a crash', () => {
    const authority = resolveCurrentMainAuthority(cloneDir, { A3_RELEASE_BRANCH: 'does-not-exist' })
    expect(authority.ok).toBe(false)
    expect(authority.reason).toMatch(/does-not-exist/)
    expect(authority.reason).toMatch(/neither/i)
  })
})

describe('resolveReleaseSha', () => {
  it('prefers the remote-tracking ref (origin/<branch>) over a same-named local branch', () => {
    // Diverge the local `master` from origin/master without pushing —
    // resolveReleaseSha must still report the origin-tracked (pushed) sha,
    // not the locally-diverged one, because that IS the release.
    writeFileSync(path.join(cloneDir, 'local-only.txt'), 'not pushed\n')
    const localOnlySha = commit(cloneDir, 'local-only commit, never pushed')

    const result = resolveReleaseSha(cloneDir, 'master')
    expect(result.ref).toBe('origin/master')
    expect(result.sha).not.toBe(localOnlySha)
  })

  it('falls back to a local branch when no remote-tracking ref exists', () => {
    const noRemoteRepo = path.join(tmpRoot, 'no-remote-tracking')
    git(tmpRoot, ['init', '-q', '-b', 'trunk', noRemoteRepo])
    git(noRemoteRepo, ['config', 'user.email', 'test@example.invalid'])
    git(noRemoteRepo, ['config', 'user.name', 'Release Branch Test'])
    writeFileSync(path.join(noRemoteRepo, 'f.txt'), 'x\n')
    const sha = commit(noRemoteRepo, 'only commit')

    const result = resolveReleaseSha(noRemoteRepo, 'trunk')
    expect(result.ref).toBe('trunk')
    expect(result.sha).toBe(sha)
  })

  it('returns null when the branch exists nowhere', () => {
    expect(resolveReleaseSha(cloneDir, 'nope-does-not-exist')).toBeNull()
  })
})

describe('resolveCurrentMainAuthority — CASE 3 note', () => {
  it('resolves branch+sha only; the expected-vs-actual runtime SHA comparison itself is classifyRuntime\'s job (see classify.test.mjs DRIFTED/STALE cases)', () => {
    const authority = resolveCurrentMainAuthority(cloneDir, {})
    expect(authority.ok).toBe(true)
    expect(typeof authority.sha).toBe('string')
    expect(authority.sha).toMatch(/^[0-9a-f]{40}$/)
  })
})
