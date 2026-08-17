// tools/worktrees/lib/worktree-lifecycle.integration.test.mjs
//
// Integration tests against REAL git — hermetic throwaway repositories
// (mkdtemp + real `git init`/`git worktree add`), never the actual project
// checkout. Reproduces, as regression coverage, the root cause the
// Engineering Implementation pass verified by hand (correcting an earlier,
// wrong hypothesis from Architecture — see worktree-lifecycle.mjs's header
// comment for the full story):
//
//   - a registered worktree whose directory was fully deleted, or whose
//     `.git` link is gone, is fixed IMMEDIATELY by a bare
//     `git worktree prune` — git reports it `prunable` and removes it.
//   - a `git worktree lock`ed worktree survives BOTH `git worktree prune`
//     (even `--expire now`) AND `git worktree remove` INDEFINITELY,
//     however long its directory has been missing. This — not a broken
//     `.git` link — is the actual mechanism behind "prune did not resolve
//     the stale registration", and the only supported recovery is
//     `git worktree unlock` followed by the normal prune/remove.
//   - `git worktree add --detach` succeeds at the SAME sha `main` is
//     already checked out at elsewhere, which is why the local-main
//     preview is detached rather than a branch checkout.
//
// Then exercises the real CLIs (release-cleanup.mjs, check.mjs) end-to-end
// against these hermetic repos, mirroring tools/gate/gate.test.mjs's style.

import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RELEASE_CLEANUP_MJS = path.resolve(HERE, '..', 'release-cleanup.mjs')
const CHECK_MJS = path.resolve(HERE, '..', 'check.mjs')

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
let repoDir

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-worktree-lifecycle-'))
  repoDir = path.join(tmpRoot, 'repo')
  git(tmpRoot, ['init', '-q', '-b', 'main', 'repo'])
  git(repoDir, ['config', 'user.email', 'test@example.invalid'])
  git(repoDir, ['config', 'user.name', 'Test'])
  writeFileSync(path.join(repoDir, 'README.md'), 'root\n')
  commit(repoDir, 'initial commit')
  // Mirror production: the root checkout sits on a feature branch, and a
  // SEPARATE worktree is the one that owns `main` — `git worktree add
  // <dir> main` fails with "already checked out" if the root itself is on
  // main, exactly like the real repository's root/release-integration split.
  git(repoDir, ['checkout', '-q', '-b', 'some-feature-branch'])
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('root cause: a lock — not a broken .git link — is what survives cleanup', () => {
  it('a fully-deleted worktree directory IS pruned by a bare "git worktree prune"', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    const registeredPath = realpathSync(wtPath)
    rmSync(wtPath, { recursive: true, force: true })

    git(repoDir, ['worktree', 'prune'])
    const list = git(repoDir, ['worktree', 'list', '--porcelain'])
    expect(list).not.toContain(registeredPath)
  })

  it('a directory whose .git link is gone is ALSO pruned by a bare "git worktree prune" (not the real bug)', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    const registeredPath = realpathSync(wtPath)
    rmSync(path.join(wtPath, '.git'), { force: true })

    git(repoDir, ['worktree', 'prune'])
    const afterPrune = git(repoDir, ['worktree', 'list', '--porcelain'])
    expect(afterPrune).not.toContain(registeredPath)
  })

  it('a LOCKED worktree survives prune (even --expire now) and refuses remove, however long its directory has been gone', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    const registeredPath = realpathSync(wtPath)
    git(repoDir, ['worktree', 'lock', wtPath, '--reason', 'release in progress'])
    rmSync(wtPath, { recursive: true, force: true })

    git(repoDir, ['worktree', 'prune', '--expire', 'now'])
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).toContain(registeredPath)

    const remove = spawnSync('git', ['worktree', 'remove', wtPath], { cwd: repoDir, encoding: 'utf8' })
    expect(remove.status).not.toBe(0)

    git(repoDir, ['worktree', 'unlock', wtPath])
    git(repoDir, ['worktree', 'prune'])
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).not.toContain(registeredPath)
  })

  it('"git worktree add --detach" succeeds even while another worktree owns the same branch', () => {
    const ownerPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', ownerPath, 'main'])

    const previewPath = path.join(repoDir, '.preview', 'main')
    const add = spawnSync('git', ['worktree', 'add', '--detach', previewPath, 'main'], { cwd: repoDir, encoding: 'utf8' })
    expect(add.status).toBe(0)

    const branchAdd = spawnSync('git', ['worktree', 'add', path.join(repoDir, '.worktrees', 'dup'), 'main'], { cwd: repoDir, encoding: 'utf8' })
    expect(branchAdd.status).not.toBe(0) // branch checkout would have collided; detached did not.
  })
})

describe('release-cleanup.mjs end-to-end', () => {
  it('is a clean no-op when nothing is registered at the target path', () => {
    const result = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration'], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('noop')
  })

  it('prunes a registered-but-missing-directory worktree and is idempotent', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    const registeredPath = realpathSync(wtPath)
    rmSync(wtPath, { recursive: true, force: true })

    const first = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration'], { cwd: repoDir, encoding: 'utf8' })
    expect(first.status).toBe(0)
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).not.toContain(registeredPath)

    const second = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration'], { cwd: repoDir, encoding: 'utf8' })
    expect(second.status).toBe(0)
    expect(second.stdout).toContain('noop')
  })

  it('removes a clean registered worktree via git-native remove, preserving its branch', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])

    const result = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration'], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(existsSync(wtPath)).toBe(false)
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).not.toContain(path.join('.worktrees', 'release-integration'))
    expect(git(repoDir, ['branch', '--list', 'main'])).toContain('main') // branch survives
  })

  it('refuses (exit 2) to remove a dirty worktree without --force', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    const registeredPath = realpathSync(wtPath)
    // Modify a tracked file without committing.
    writeFileSync(path.join(wtPath, 'README.md'), 'dirty change')

    const result = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration'], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(2)
    expect(existsSync(wtPath)).toBe(true) // untouched
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).toContain(registeredPath)
  })

  it('removes a dirty worktree when --force is given', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    writeFileSync(path.join(wtPath, 'README.md'), 'dirty change')

    const result = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration', '--force'], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(existsSync(wtPath)).toBe(false)
  })

  it('blocks (exit 2) a locked worktree by default, and only unlocks+removes it with --unlock — never touching files directly', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    git(repoDir, ['worktree', 'lock', wtPath, '--reason', 'release in progress'])
    const registeredPath = realpathSync(wtPath)
    rmSync(wtPath, { recursive: true, force: true })

    const blocked = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration'], { cwd: repoDir, encoding: 'utf8' })
    expect(blocked.status).toBe(2)
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).toContain(registeredPath) // still registered — nothing touched

    const unlocked = spawnSync('node', [RELEASE_CLEANUP_MJS, '--path', '.worktrees/release-integration', '--unlock'], { cwd: repoDir, encoding: 'utf8' })
    expect(unlocked.status).toBe(0)
    expect(git(repoDir, ['worktree', 'list', '--porcelain'])).not.toContain(registeredPath)
  })
})

describe('check.mjs end-to-end', () => {
  it('reports the current main SHA and a "never created" preview when nothing has run yet', () => {
    const result = spawnSync('node', [CHECK_MJS], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(0)
    const mainSha = git(repoDir, ['rev-parse', 'main'])
    expect(result.stdout).toContain(mainSha)
    expect(result.stdout).toContain('never created')
  })

  it('flags a registered-but-missing worktree as a stale registration, and --strict fails on it', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    rmSync(wtPath, { recursive: true, force: true })

    const plain = spawnSync('node', [CHECK_MJS], { cwd: repoDir, encoding: 'utf8' })
    expect(plain.status).toBe(0) // reports, does not fail, by default
    expect(plain.stdout).toContain('STALE REGISTRATION')

    const strict = spawnSync('node', [CHECK_MJS, '--strict'], { cwd: repoDir, encoding: 'utf8' })
    expect(strict.status).toBe(1)
  })

  it('flags a locked worktree distinctly from a plain stale registration', () => {
    const wtPath = path.join(repoDir, '.worktrees', 'release-integration')
    git(repoDir, ['worktree', 'add', '-q', wtPath, 'main'])
    git(repoDir, ['worktree', 'lock', wtPath, '--reason', 'release in progress'])

    const result = spawnSync('node', [CHECK_MJS], { cwd: repoDir, encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('locked')
    expect(result.stdout).toContain('release in progress')
  })
})
