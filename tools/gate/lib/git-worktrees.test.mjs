// tools/gate/lib/git-worktrees.test.mjs
//
// Integration tests against REAL git — hermetic throwaway repositories
// built with mkdtemp, never touching the real project checkout or its
// worktrees. Verifies the porcelain-parsing helpers agree with ground
// truth obtained independently via direct git calls in the test itself.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { currentBranch, dirtyEntries, gitCommonDir, headSha, listWorktrees, samePath } from './git-worktrees.mjs'

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${result.stderr}`)
  }
  return result.stdout.trim()
}

function commit(cwd, message) {
  git(cwd, ['add', '-A'])
  git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-m', message, '--no-verify'])
  return git(cwd, ['rev-parse', 'HEAD'])
}

let tmpRoot
let repoDir
let worktreeDir

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-gate-worktrees-'))
  repoDir = path.join(tmpRoot, 'root')
  worktreeDir = path.join(tmpRoot, 'candidate')

  git(tmpRoot, ['init', '-q', '-b', 'main', 'root'])
  git(repoDir, ['config', 'user.email', 'test@example.invalid'])
  git(repoDir, ['config', 'user.name', 'Gate Test'])
  writeFileSync(path.join(repoDir, 'README.md'), 'root\n')
  commit(repoDir, 'initial commit')
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('git-worktrees helpers — real git ground truth', () => {
  it('listWorktrees returns the root checkout as one registered entry', () => {
    const worktrees = listWorktrees(repoDir)
    expect(worktrees).not.toBeNull()
    expect(worktrees).toHaveLength(1)
    expect(samePath(worktrees[0].path, repoDir)).toBe(true)
    expect(worktrees[0].branch).toBe('main')
    expect(worktrees[0].detached).toBe(false)
    expect(worktrees[0].sha).toBe(headSha(repoDir))
  })

  it('a linked worktree on a different branch/commit is a SEPARATE registered entry with its own HEAD', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', worktreeDir])
    writeFileSync(path.join(worktreeDir, 'feature.txt'), 'candidate\n')
    const candidateSha = commit(worktreeDir, 'candidate commit')

    const worktrees = listWorktrees(repoDir)
    expect(worktrees).toHaveLength(2)

    const root = worktrees.find((w) => samePath(w.path, repoDir))
    const candidate = worktrees.find((w) => samePath(w.path, worktreeDir))

    expect(root.branch).toBe('main')
    expect(candidate.branch).toBe('feature/x')
    expect(candidate.sha).toBe(candidateSha)
    expect(candidate.sha).not.toBe(root.sha)
  })

  it('listWorktrees called from EITHER checkout sees the SAME set — this is why the manifest lives in the common dir', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', worktreeDir])

    const fromRoot = listWorktrees(repoDir)
    const fromWorktree = listWorktrees(worktreeDir)
    expect(fromWorktree.map((w) => w.path).sort()).toEqual(fromRoot.map((w) => w.path).sort())
  })

  it('gitCommonDir resolves to the SAME directory from the root checkout and from a linked worktree', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', worktreeDir])
    const commonFromRoot = gitCommonDir(repoDir)
    const commonFromWorktree = gitCommonDir(worktreeDir)
    expect(commonFromWorktree).toBe(commonFromRoot)
  })

  it('a detached-HEAD worktree reports branch:null, detached:true', () => {
    const sha = headSha(repoDir)
    git(repoDir, ['worktree', 'add', '--detach', worktreeDir, sha])
    const worktrees = listWorktrees(repoDir)
    const detachedEntry = worktrees.find((w) => samePath(w.path, worktreeDir))
    expect(detachedEntry.detached).toBe(true)
    expect(detachedEntry.branch).toBeNull()
  })

  it('currentBranch reports the branch name on the root and "HEAD" on a detached worktree', () => {
    expect(currentBranch(repoDir)).toBe('main')
    const sha = headSha(repoDir)
    git(repoDir, ['worktree', 'add', '--detach', worktreeDir, sha])
    expect(currentBranch(worktreeDir)).toBe('HEAD')
  })

  it('dirtyEntries is empty right after a commit, and lists an untracked file once one is added', () => {
    expect(dirtyEntries(repoDir)).toEqual([])
    writeFileSync(path.join(repoDir, 'untracked.txt'), 'x\n')
    expect(dirtyEntries(repoDir)).toContain('untracked.txt')
  })

  it('headSha / listWorktrees / dirtyEntries all return null (not throw) on a non-git directory', () => {
    const notARepo = path.join(tmpRoot, 'not-a-repo')
    mkdirSync(notARepo)
    expect(headSha(notARepo)).toBeNull()
    expect(listWorktrees(notARepo)).toBeNull()
    expect(dirtyEntries(notARepo)).toBeNull()
    expect(gitCommonDir(notARepo)).toBeNull()
  })

  it('a healthy worktree reports locked:false, prunable:false with null reasons', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', worktreeDir])
    const entry = listWorktrees(repoDir).find((w) => samePath(w.path, worktreeDir))
    expect(entry).toMatchObject({ locked: false, lockReason: null, prunable: false, prunableReason: null })
  })

  it('a "git worktree lock"ed entry reports locked:true with its reason, and survives its directory being deleted', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', worktreeDir])
    // Capture git's own (realpath'd) registration BEFORE deleting the
    // directory: samePath()/canonicalize() resolve symlinks via
    // fs.realpathSync when a path still exists, but fall back to
    // path.resolve (no symlink resolution) once it doesn't — so a raw,
    // not-yet-realpath'd `worktreeDir` would silently stop matching
    // git's already-realpath'd registration after deletion, on any
    // platform where the temp dir is itself behind a symlink (macOS:
    // /var -> /private/var).
    const registeredPath = listWorktrees(repoDir).find((w) => samePath(w.path, worktreeDir)).path
    git(repoDir, ['worktree', 'lock', worktreeDir, '--reason', 'release in progress'])
    rmSync(worktreeDir, { recursive: true, force: true })

    const entry = listWorktrees(repoDir).find((w) => w.path === registeredPath)
    expect(entry).toBeDefined()
    expect(entry.locked).toBe(true)
    expect(entry.lockReason).toBe('release in progress')

    // The actual mechanism behind "prune did not resolve the stale
    // registration": a lock survives a bare prune indefinitely, however
    // long the directory has been gone.
    git(repoDir, ['worktree', 'prune'])
    const stillThere = listWorktrees(repoDir).find((w) => w.path === registeredPath)
    expect(stillThere).toBeDefined()
  })

  it('a worktree whose directory or .git link has disappeared reports prunable:true with git\'s own reason', () => {
    git(repoDir, ['worktree', 'add', '-b', 'feature/x', worktreeDir])
    const registeredPath = listWorktrees(repoDir).find((w) => samePath(w.path, worktreeDir)).path
    rmSync(worktreeDir, { recursive: true, force: true })

    const entry = listWorktrees(repoDir).find((w) => w.path === registeredPath)
    expect(entry.prunable).toBe(true)
    expect(entry.prunableReason).toBeTruthy()
  })
})
