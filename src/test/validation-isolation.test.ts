import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const WORKTREES = join(ROOT, '.worktrees')

describe('validation discovery isolation', () => {
  it('does not collect test files below .worktrees', () => {
    const worktreesExisted = existsSync(WORKTREES)
    mkdirSync(WORKTREES, { recursive: true })
    const probe = mkdtempSync(join(WORKTREES, '.validation-isolation-'))
    const canary = join(probe, 'ignored.test.ts')
    writeFileSync(canary, "throw new Error('nested worktree test was collected')\n")

    try {
      const output = execFileSync(
        process.execPath,
        [join(ROOT, 'node_modules/vitest/vitest.mjs'), 'list', '--filesOnly', '--run'],
        { cwd: ROOT, encoding: 'utf8' },
      )
      expect(output).toContain('src/test/validation-isolation.test.ts')
      expect(output).not.toContain(relative(ROOT, canary))
    } finally {
      rmSync(probe, { recursive: true, force: true })
      if (!worktreesExisted) rmdirSync(WORKTREES)
    }
  })
})
