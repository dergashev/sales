import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const WORKTREES = join(ROOT, '.worktrees')
const PREVIEW = join(ROOT, '.preview')
/**
 * The vitest CLI is located the way Node locates it, not at a hardcoded
 * `<ROOT>/node_modules/...`: a git worktree checkout under `.worktrees/`
 * carries no `node_modules` of its own and resolves every package through
 * the parent repository's tree, so the hardcoded path did not exist there
 * and both cases failed before the discovery under test even ran.
 */
const VITEST_CLI = join(
  dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
  'vitest.mjs',
)

function assertNestedDirIsExcluded(nestedRoot: string) {
  const dirExisted = existsSync(nestedRoot)
  mkdirSync(nestedRoot, { recursive: true })
  const probe = mkdtempSync(join(nestedRoot, '.validation-isolation-'))
  const canary = join(probe, 'ignored.test.ts')
  writeFileSync(canary, "throw new Error('nested worktree test was collected')\n")

  try {
    const output = execFileSync(
      process.execPath,
      [VITEST_CLI, 'list', '--filesOnly', '--run'],
      { cwd: ROOT, encoding: 'utf8' },
    )
    expect(output).toContain('src/test/validation-isolation.test.ts')
    expect(output).not.toContain(relative(ROOT, canary))
  } finally {
    rmSync(probe, { recursive: true, force: true })
    if (!dirExisted) rmdirSync(nestedRoot)
  }
}

describe('validation discovery isolation', () => {
  it('does not collect test files below .worktrees', () => {
    assertNestedDirIsExcluded(WORKTREES)
  })

  it('does not collect test files below .preview (the local-main preview checkout)', () => {
    assertNestedDirIsExcluded(PREVIEW)
  })
})
