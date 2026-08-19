#!/usr/bin/env node
/**
 * tools/browser-agent/status.mjs — `npm run browser:agent:status`.
 *
 * Non-mutating diagnostic over every sidecar this tooling has ever written
 * locally (ticket "SESSION STATUS" / "OBSERVABILITY"). Never takes a lock,
 * never starts/stops anything, never removes a sidecar — a stale/dead entry
 * is reported, not silently cleaned up (cleanup is `browser:agent:close`'s
 * job, explicitly targeted at one session).
 *
 * For runtime-level detail (servers, ports, live pids), see the
 * complementary `npm run runtime:status` — deliberately not duplicated
 * here (ticket "avoid duplicative registries").
 */

import path from 'node:path'
import { git, gitCommonDir } from '../gate/lib/git-worktrees.mjs'
import { defaultManifestPath, readManifest } from '../gate/lib/manifest.mjs'
import { listSidecars, defaultSidecarDir } from './lib/sidecar-store.mjs'
import { classifySidecarFreshness } from './lib/decide.mjs'
import { checkSkillReadiness } from './lib/skill-status.mjs'
import { EXIT } from './lib/exit-codes.mjs'

function currentExpectedSha({ sidecar, cwd, commonDir }) {
  if (sidecar.purpose === 'CURRENT_MAIN') return git(cwd, ['rev-parse', 'main'])
  if (!sidecar.lane) return null
  const manifest = readManifest(defaultManifestPath(commonDir))
  return manifest[sidecar.lane]?.sha ?? null
}

function main() {
  const cwd = process.cwd()
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) {
    console.error('[browser-agent:status] FAIL (exit 3): not inside a git worktree.')
    process.exit(EXIT.LIFECYCLE)
  }
  const repoRoot = path.dirname(commonDir)
  const sidecarDir = defaultSidecarDir(repoRoot)
  const sidecars = listSidecars(sidecarDir)

  console.log('BROWSER-AGENT SESSION STATUS')
  console.log(`  SIDECAR DIRECTORY : ${sidecarDir}`)

  const readiness = checkSkillReadiness(cwd)
  console.log('\nENVIRONMENT')
  console.log(`  PINNED @playwright/cli : ${readiness.version ?? 'UNRESOLVED (could not require it from this checkout)'}`)
  for (const target of readiness.targets) {
    const label = !target.installed ? 'NOT INSTALLED' : target.upToDate === false ? 'DRIFTED (stale vs. pinned CLI)' : target.upToDate === true ? 'up to date' : 'UNKNOWN (bundled skill unresolvable)'
    console.log(`  skill (${target.name})   : ${label} — ${target.dir}`)
    if (target.installed && target.upToDate === false) console.log(`      -> run \`npm run browser:agent:setup\` (${target.command}) to refresh it.`)
  }

  if (sidecars.length === 0) {
    console.log('  (no tracked sessions)')
    process.exit(EXIT.OK)
    return
  }

  for (const sidecar of sidecars) {
    const expectedNow = currentExpectedSha({ sidecar, cwd, commonDir })
    const freshness = classifySidecarFreshness({ sidecar, currentExpectedSha: expectedNow })
    console.log(`\n  - ${sidecar.sessionName}`)
    console.log(`      purpose   : ${sidecar.purpose ?? 'UNKNOWN'}`)
    console.log(`      lane      : ${sidecar.lane ?? '(none)'}`)
    console.log(`      sha       : ${sidecar.actualSha ?? 'UNKNOWN'}`)
    console.log(`      url       : ${sidecar.url ?? 'UNKNOWN'}`)
    console.log(`      artifacts : ${sidecar.outputDir ?? '(default)'}`)
    console.log(`      cli       : ${sidecar.playwrightCliVersion ?? 'UNKNOWN'}`)
    console.log(`      freshness : ${freshness}${freshness === 'SUPERSEDED' ? ` (current expected sha is ${expectedNow})` : ''}`)
    console.log(`      updated   : ${sidecar.updatedAt ?? 'UNKNOWN'}`)
  }

  console.log('\nFor runtime/server-level detail (ports, pids, live status), run: npm run runtime:status')
  process.exit(EXIT.OK)
}

main()
