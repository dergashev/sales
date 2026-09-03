// tools/git-hooks/pre-commit-check.integration.test.mjs
//
// DELIVERY-INFRA-01 REGRESSION CASES C and G — end-to-end, against a REAL
// hermetic throwaway git repository (mkdtemp; never touches the real
// project checkout — same pattern tools/runtime/lib/release-branch.test.mjs
// already uses). Installs the actual pre-commit hook via
// tools/git-hooks/install.mjs and drives real `git commit` invocations
// against it, so this exercises the exact code path a real commit runs,
// not just the pure decision functions (already unit-tested directly in
// tools/delivery/root-guard.test.mjs / tools/delivery/agentsroom-guard.test.mjs).

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

function git(cwd, args, env) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', ...env } })
}

let tmpRoot
let repo

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-pre-commit-hook-'))
  repo = path.join(tmpRoot, 'repo')
  git(tmpRoot, ['init', '-q', '-b', 'master', repo])
  git(repo, ['config', 'user.email', 'test@example.invalid'])
  git(repo, ['config', 'user.name', 'Pre-Commit Hook Test'])

  // Copy just the tooling the hook needs — a minimal hermetic mirror of the
  // real repository's tools/ tree, not a checkout of it.
  for (const dir of ['tools/git-hooks', 'tools/delivery', 'tools/gate/lib']) {
    mkdirSync(path.join(repo, dir), { recursive: true })
  }
  const copies = [
    ['tools/git-hooks/pre-commit-check.mjs', 'tools/git-hooks/pre-commit-check.mjs'],
    ['tools/git-hooks/install.mjs', 'tools/git-hooks/install.mjs'],
    ['tools/delivery/agentsroom-guard.mjs', 'tools/delivery/agentsroom-guard.mjs'],
    ['tools/delivery/root-guard.mjs', 'tools/delivery/root-guard.mjs'],
    ['tools/gate/lib/git-worktrees.mjs', 'tools/gate/lib/git-worktrees.mjs'],
  ]
  for (const [src, dest] of copies) {
    writeFileSync(path.join(repo, dest), readFileSync(path.join(repoRoot, src)))
  }

  const install = spawnSync('node', ['tools/git-hooks/install.mjs'], { cwd: repo, encoding: 'utf8' })
  expect(install.status).toBe(0)

  writeFileSync(path.join(repo, 'README.md'), 'root\n')
  git(repo, ['add', 'README.md'])
  const initial = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'initial commit'], { GIT_AUTHOR_DATE: '2024-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2024-01-01T00:00:00Z', FEATURE_FLOW_ALLOW_MASTER: '1' })
  expect(initial.status).toBe(0)

  // The feature-branch-flow guard blocks any commit on master/main, so the
  // path/content guards under test are exercised on a feature branch — the
  // only place agent commits legitimately happen. The guard itself has its
  // own describe block below.
  const branch = git(repo, ['switch', '-q', '-c', 'fix/hook-test'])
  expect(branch.status).toBe(0)
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('CASE G — .agentsroom/** manual mutation is blocked at commit time', () => {
  it('refuses a commit staging a path under .agentsroom/', () => {
    mkdirSync(path.join(repo, '.agentsroom', 'sessions'), { recursive: true })
    writeFileSync(path.join(repo, '.agentsroom', 'sessions', 'agent-1.json'), '{}\n')
    git(repo, ['add', '.agentsroom/sessions/agent-1.json'])

    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'sneaky agentsroom edit'])
    expect(commit.status).not.toBe(0)
    expect(commit.stderr + commit.stdout).toMatch(/AgentsRoom control-state protection/)

    const log = git(repo, ['log', '--oneline'])
    expect(log.stdout.trim().split('\n')).toHaveLength(1) // still just the initial commit
  })

  it('the human override env var allows a deliberate .agentsroom/** commit', () => {
    mkdirSync(path.join(repo, '.agentsroom', 'sessions'), { recursive: true })
    writeFileSync(path.join(repo, '.agentsroom', 'sessions', 'agent-1.json'), '{}\n')
    git(repo, ['add', '.agentsroom/sessions/agent-1.json'])

    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'deliberate agentsroom edit'], { A3_ALLOW_AGENTSROOM_COMMIT: '1' })
    expect(commit.status).toBe(0)
  })
})

describe('CASE C — root-checkout commit-time backstop', () => {
  it('refuses a commit staging a Product-owned path while in the root checkout', () => {
    mkdirSync(path.join(repo, 'src'), { recursive: true })
    writeFileSync(path.join(repo, 'src', 'App.tsx'), 'export default function App() {}\n')
    git(repo, ['add', 'src/App.tsx'])

    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'product change from root'])
    expect(commit.status).not.toBe(0)
    expect(commit.stderr + commit.stdout).toMatch(/root release checkout protection/)
  })

  it('allows a root-checkout commit that only touches delivery-infra/doc paths', () => {
    mkdirSync(path.join(repo, 'docs', 'tooling'), { recursive: true })
    writeFileSync(path.join(repo, 'docs', 'tooling', 'note.md'), 'note\n')
    git(repo, ['add', 'docs/tooling/note.md'])

    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'delivery-infra doc update'])
    expect(commit.status).toBe(0)
  })
})

describe('feature-branch-flow — direct commits on master are blocked', () => {
  it('refuses a commit while HEAD is on master', () => {
    git(repo, ['switch', '-q', 'master'])
    writeFileSync(path.join(repo, 'README.md'), 'root\nmaster edit\n')
    git(repo, ['add', 'README.md'])
    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'direct master commit'])
    expect(commit.status).not.toBe(0)
    expect(commit.stderr + commit.stdout).toMatch(/feature-branch-flow/)
  })

  it('FEATURE_FLOW_ALLOW_MASTER=1 allows a deliberate master commit (humans/release tooling)', () => {
    git(repo, ['switch', '-q', 'master'])
    writeFileSync(path.join(repo, 'README.md'), 'root\ndeliberate master edit\n')
    git(repo, ['add', 'README.md'])
    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'release commit'], { FEATURE_FLOW_ALLOW_MASTER: '1' })
    expect(commit.status).toBe(0)
  })
})

describe('unrelated commits are unaffected', () => {
  it('a commit touching neither .agentsroom/ nor a Product path succeeds normally', () => {
    writeFileSync(path.join(repo, 'README.md'), 'root\nupdated\n')
    git(repo, ['add', 'README.md'])
    const commit = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'docs update'])
    expect(commit.status).toBe(0)
  })
})
