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

import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installedSkillTargets, checkSkillReadiness, resolveBundledSkillFile } from './skill-status.mjs'

const require = createRequire(import.meta.url)

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

describe('resolveBundledSkillFile — Tech Review P2 regression: the baseline is the PINNED CLI\'s own bundle, never a hoisted sibling', () => {
  // The defect this pins down: resolving `playwright-core` from THIS layer's
  // own module location finds the repo-root-hoisted copy — a transitive,
  // caret-ranged dependency of `@playwright/test`, an entirely different and
  // independently-versioned package — not the pinned `@playwright/cli`'s own
  // nested copy that its internal skillCheck.js compares against. Both
  // bundles' SKILL.md files happened to be byte-identical when this was
  // caught, so any content-based assertion passes either way; only the
  // resolved PATH distinguishes the right source of truth from the wrong one.

  it('resolves SKILL.md from INSIDE @playwright/cli\'s own tree — the same resolution its internal skillCheck.js performs', () => {
    const resolved = resolveBundledSkillFile()
    const cliDir = path.dirname(require.resolve('@playwright/cli/package.json'))
    expect(resolved.path.startsWith(cliDir + path.sep)).toBe(true)

    // Byte-for-byte the same resolution the pinned CLI's own skillCheck.js
    // performs from its own location — one source of truth, not a reimplementation drifting from it.
    const cliRequire = createRequire(require.resolve('@playwright/cli/package.json'))
    const authoritative = path.join(path.dirname(cliRequire.resolve('playwright-core/package.json')), 'lib', 'tools', 'skills', 'playwright-cli', 'SKILL.md')
    expect(resolved.path).toBe(authoritative)
  })

  it('does NOT resolve the repo-root-hoisted playwright-core (the caret-ranged @playwright/test dependency) when the two differ', () => {
    const resolved = resolveBundledSkillFile()
    // The hoisted copy resolves from THIS test file's location — exactly the wrong resolution the defect used.
    const hoistedCorePkg = require.resolve('playwright-core/package.json')
    const cliDir = path.dirname(require.resolve('@playwright/cli/package.json'))
    if (hoistedCorePkg.startsWith(cliDir + path.sep)) {
      // Degenerate layout: no separate hoisted copy exists at all (npm chose not to hoist).
      // Then there is only one candidate and the structural assertion above already covers it.
      return
    }
    const hoistedPath = path.join(path.dirname(hoistedCorePkg), 'lib', 'tools', 'skills', 'playwright-cli', 'SKILL.md')
    expect(resolved.path).not.toBe(hoistedPath)
  })

  it('reports the exact pinned CLI version alongside the bundle it actually compared against — one package, one source', () => {
    const resolved = resolveBundledSkillFile()
    expect(resolved.version).toBe(require('@playwright/cli/package.json').version)
    // The bundle genuinely exists in the pinned package (content read, not just a constructed path).
    expect(resolved.content).toBeTruthy()
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
