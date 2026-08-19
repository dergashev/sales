// tools/browser-agent/lib/skill-status.test.mjs
//
// D4 regression: `playwright-cli install --skills` installs relative to
// `process.cwd()` (confirmed empirically against the real installed CLI —
// running `npm run browser:agent:setup` from this worktree put the skill
// under THIS worktree's own `.claude/skills/playwright-cli`, not the
// shared repo root `gitCommonDir` resolves to). `installedSkillTargets`
// must therefore resolve against whatever `cwd` it is given, never a
// different "repoRoot" — a mismatch there would report a freshly-installed
// worktree-local skill as NOT INSTALLED, exactly the class of bug this
// module exists to catch, not commit.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installedSkillTargets, checkSkillReadiness } from './skill-status.mjs'

let cwd

beforeEach(() => {
  cwd = mkdtempSync(path.join(tmpdir(), 'browser-agent-skill-status-'))
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

describe('installedSkillTargets — cwd-relative, matching the real CLI\'s own install location', () => {
  it('both official targets resolve under the given cwd, not some other root', () => {
    const targets = installedSkillTargets(cwd)
    expect(targets).toHaveLength(2)
    for (const target of targets) {
      expect(target.dir.startsWith(cwd)).toBe(true)
    }
    expect(targets.find((t) => t.name === 'claude').dir).toBe(path.join(cwd, '.claude', 'skills', 'playwright-cli'))
    expect(targets.find((t) => t.name === 'agents').dir).toBe(path.join(cwd, '.agents', 'skills', 'playwright-cli'))
  })
})

describe('checkSkillReadiness — evidence-based, never a silent guess', () => {
  it('a target with no SKILL.md at all is reported as not installed, upToDate unknown (null), not false', () => {
    const readiness = checkSkillReadiness(cwd)
    for (const target of readiness.targets) {
      expect(target.installed).toBe(false)
      expect(target.upToDate).toBeNull()
    }
  })

  it('a target whose SKILL.md exists relative to a DIFFERENT cwd is still reported not-installed here (proves it is not silently found via some other root)', () => {
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'browser-agent-skill-status-elsewhere-'))
    mkdirSync(path.join(elsewhere, '.claude', 'skills', 'playwright-cli'), { recursive: true })
    writeFileSync(path.join(elsewhere, '.claude', 'skills', 'playwright-cli', 'SKILL.md'), '# fake skill\n')

    const readiness = checkSkillReadiness(cwd)
    expect(readiness.targets.find((t) => t.name === 'claude').installed).toBe(false)

    rmSync(elsewhere, { recursive: true, force: true })
  })

  it('an installed-but-different-content SKILL.md is DRIFTED (upToDate: false), never silently reported up to date', () => {
    mkdirSync(path.join(cwd, '.claude', 'skills', 'playwright-cli'), { recursive: true })
    writeFileSync(path.join(cwd, '.claude', 'skills', 'playwright-cli', 'SKILL.md'), '# stale content, not the bundled one\n')

    const readiness = checkSkillReadiness(cwd)
    const claude = readiness.targets.find((t) => t.name === 'claude')
    expect(claude.installed).toBe(true)
    // upToDate is only ever `false` here when the real bundled SKILL.md was resolvable and compared
    // (this worktree HAS the pinned CLI installed as a real devDependency); if the pinned CLI itself
    // could not be resolved at all, checkSkillReadiness reports `null`, never a false "up to date".
    expect(readiness.version).toBeTruthy()
    expect(claude.upToDate).toBe(false)
  })
})
