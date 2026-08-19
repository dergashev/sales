// tools/browser-agent/lib/skill-status.mjs
//
// Engineering Architecture D4: `browser:agent:status` gains a real
// CLI/skill readiness block, not merely "does SKILL.md exist" — the same
// byte-identical-to-bundled comparison the pinned CLI itself already runs
// on every non-`install` invocation via its own internal skillCheck.js
// (node_modules/@playwright/cli/skillCheck.js). That module is CommonJS
// internal to the CLI package, not a published API this task may import,
// so its comparison is reimplemented here against the SAME two public
// facts it uses (the bundled SKILL.md's location via
// `playwright-core/package.json`, and the two official install targets)
// — never re-deriving CLI behavior beyond that, and never a second source
// of truth for what "up to date" means.
//
// Ticket validation item B ("verify the supported agent runtime can
// discover/use it... do not validate this only by checking that files
// exist") is only half satisfied by this module: it proves the file is
// present and byte-identical, which is the CLI's own mechanical contract.
// Real agent-runtime discovery is verified separately (see the
// Implementation report), not by this status check.

import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

function normalize(text) {
  return text.replace(/\r\n/g, '\n')
}

function readIfExists(file) {
  return existsSync(file) ? normalize(readFileSync(file, 'utf8')) : null
}

/**
 * The two official `playwright-cli install --skills[=agents]` targets — same paths the CLI's own
 * skillCheck.js checks. Deliberately `cwd`-relative, NOT the shared `repoRoot` this layer's other
 * artifact/sidecar locations use: `playwright-cli install --skills` itself installs relative to
 * `process.cwd()` (confirmed from the installed CLI's own `installedSkillTargets()` in
 * skillCheck.js), so skills are per-worktree, not per-repo — the README's "every fresh
 * clone/worktree must run `browser:agent:setup` once" is exactly this. Passing `repoRoot` here
 * would silently report a freshly-installed worktree-local skill as NOT INSTALLED.
 */
export function installedSkillTargets(cwd) {
  return [
    { name: 'claude', dir: path.join(cwd, '.claude', 'skills', 'playwright-cli'), command: 'playwright-cli install --skills' },
    { name: 'agents', dir: path.join(cwd, '.agents', 'skills', 'playwright-cli'), command: 'playwright-cli install --skills=agents' },
  ]
}

/**
 * @param {string} cwd
 * @returns {{ version: string|null, targets: Array<{ name: string, dir: string, command: string, installed: boolean, upToDate: boolean|null }> }}
 *   `upToDate` is null when it cannot be determined (bundled file unresolvable, or target not installed) — never
 *   silently reported as true/false without evidence.
 */
export function checkSkillReadiness(cwd) {
  let version = null
  let bundled = null
  try {
    version = require('@playwright/cli/package.json').version
    const corePkg = require.resolve('playwright-core/package.json')
    bundled = readIfExists(path.join(path.dirname(corePkg), 'lib', 'tools', 'skills', 'playwright-cli', 'SKILL.md'))
  } catch {
    // Pinned CLI not resolvable from this cwd — version stays null, targets below report what they can.
  }

  const targets = installedSkillTargets(cwd).map((target) => {
    const installed = readIfExists(path.join(target.dir, 'SKILL.md'))
    return {
      name: target.name,
      dir: target.dir,
      command: target.command,
      installed: installed !== null,
      upToDate: installed === null || bundled === null ? null : installed === bundled,
    }
  })

  return { version, targets }
}
