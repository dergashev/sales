#!/usr/bin/env node
/**
 * tools/gate/gate.mjs — the exact-candidate machine validation gate.
 *
 * Implements the Engineering Architecture handoff for run-1786976809425-4k12lk
 * (node n-agent-1786467989610-pquv): the Product Delivery Router's machine
 * validation gate must execute the canonical repository gates
 * (typecheck/test/verify/build[/browser]) against the EXACT candidate
 * worktree/commit a Team node is supposed to validate — never the
 * repository root, never a stale/mismatched checkout — and must resolve
 * node/npm deterministically even when the spawning shell's PATH is
 * minimal (observed: AgentsRoom's check-gate /bin/sh omits interactively-
 * installed node/npm).
 *
 * This file is invoked exclusively through tools/gate/gate.sh, which
 * resolves the node runtime FIRST (shell, before Node exists) and then
 * execs this script with that runtime's bin directory already prepended
 * to PATH. Do not invoke gate.mjs directly from an environment whose PATH
 * has not been resolved — it will faithfully report "npm: UNRESOLVED" and
 * fail closed exactly as designed.
 *
 * LIFECYCLE
 *   1. resolve the exact candidate (lane manifest + git worktree list) —
 *      refuse before any npm cost is paid if it cannot be established
 *   2. resolve/report node, npm, python3, PATH source
 *   3. print VALIDATION PROVENANCE — always, on every exit path
 *   4. run the canonical gates as discrete steps with an EXPLICIT
 *      cwd = candidate worktree and EXPLICIT env — never inherited
 *   5. write an evidence sidecar into the candidate worktree's
 *      .artifacts/validation/ (gitignored)
 *
 * Exit codes:
 *   0  PASS
 *   1  a gate step (typecheck/test/verify/build/browser) failed
 *   2  candidate provenance could not be established or did not match
 *   3  worktree/lifecycle failure (missing dir, git failure, npm ENOENT)
 *   4  required node/npm runtime is missing
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { gitCommonDir, listWorktrees } from './lib/git-worktrees.mjs'
import { defaultManifestPath, readManifest } from './lib/manifest.mjs'
import { resolveCandidate } from './lib/resolve-candidate.mjs'
import { resolveRuntimeReport, observedVendorEnvKeys } from './lib/runtime.mjs'
import { CANONICAL_STEPS, browserStep, runSteps } from './lib/run-steps.mjs'

const EXIT = { PASS: 0, ASSERTION: 1, PROVENANCE: 2, LIFECYCLE: 3, TOOLING: 4 }

function parseArgs(argv) {
  const args = {
    lane: null,
    expectSha: null,
    worktree: null,
    allowDirty: false,
    browser: false,
    manifest: null,
    task: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lane') args.lane = argv[++i]
    else if (a === '--expect-sha') args.expectSha = argv[++i]
    else if (a === '--worktree') args.worktree = argv[++i]
    else if (a === '--allow-dirty') args.allowDirty = true
    else if (a === '--browser') args.browser = true
    else if (a === '--manifest') args.manifest = argv[++i]
    else if (a === '--task') args.task = argv[++i]
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(EXIT.PASS)
    } else {
      console.error(`Unknown argument: ${a}`)
      printUsage()
      process.exit(EXIT.LIFECYCLE)
    }
  }
  return args
}

function printUsage() {
  console.log(
    'Usage: gate.sh --lane <client-experience|engineering|calculation|...> ' +
      '[--expect-sha <sha>] [--worktree <path>] [--allow-dirty] [--browser] [--task <id>]',
  )
}

function printProvenance(p) {
  console.log('\nVALIDATION PROVENANCE')
  console.log(`  TASK             : ${p.task ?? 'UNRESOLVED'}`)
  console.log(`  LANE             : ${p.lane ?? 'UNRESOLVED'}`)
  console.log(`  EXPECTED CANDIDATE: ${p.expectedCandidate ?? 'UNRESOLVED'}`)
  console.log(`  ACTUAL HEAD      : ${p.actualHead ?? 'UNRESOLVED'}`)
  console.log(`  WORKTREE         : ${p.worktree ?? 'UNRESOLVED'}`)
  console.log(`  BRANCH           : ${p.branch ?? (p.detached ? 'DETACHED' : 'UNRESOLVED')}`)
  console.log(`  DIRTY            : ${p.dirty ?? 'UNRESOLVED'}`)
  console.log(`  NODE             : ${p.node ?? 'UNRESOLVED'}`)
  console.log(`  NPM              : ${p.npm ?? 'UNRESOLVED'}`)
  console.log(`  PYTHON           : ${p.python ?? 'UNRESOLVED'}`)
  console.log(`  PATH SOURCE      : ${p.pathSource ?? 'UNRESOLVED'}`)
  if (p.vendorEnvKeys && p.vendorEnvKeys.length > 0) {
    console.log(`  VENDOR ENV KEYS  : ${p.vendorEnvKeys.join(', ')} (diagnostic only)`)
  }
}

function fail(code, message, provenance) {
  console.error(`\n[gate] VALIDATION INFRASTRUCTURE BLOCKER (exit ${code}): ${message}`)
  if (provenance) printProvenance(provenance)
  process.exit(code)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const runtime = resolveRuntimeReport(cwd)
  const vendorEnvKeys = observedVendorEnvKeys()

  if (!args.lane) {
    fail(EXIT.PROVENANCE, 'No --lane given. Every gate invocation must declare which delivery lane it is validating.', {
      task: args.task,
      ...runtime,
      vendorEnvKeys,
    })
    return
  }

  const worktrees = listWorktrees(cwd)
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) {
    fail(EXIT.LIFECYCLE, `"git rev-parse --git-common-dir" failed from ${cwd}. Cannot locate the candidate manifest.`, {
      task: args.task,
      lane: args.lane,
      ...runtime,
      vendorEnvKeys,
    })
    return
  }

  const manifestPath = args.manifest || defaultManifestPath(commonDir)
  let manifest
  try {
    manifest = readManifest(manifestPath)
  } catch (err) {
    fail(EXIT.LIFECYCLE, `Candidate manifest at ${manifestPath} is unreadable/corrupt: ${err.message}`, {
      task: args.task,
      lane: args.lane,
      ...runtime,
      vendorEnvKeys,
    })
    return
  }

  const resolution = resolveCandidate({
    lane: args.lane,
    expectShaArg: args.expectSha,
    worktreeArg: args.worktree,
    allowDirty: args.allowDirty,
    manifestEntry: manifest[args.lane] || null,
    worktrees,
  })

  const baseProvenance = {
    task: args.task || manifest[args.lane]?.taskId || args.lane,
    lane: args.lane,
    expectedCandidate: args.expectSha || manifest[args.lane]?.sha || null,
    ...runtime,
    vendorEnvKeys,
  }

  if (!resolution.ok) {
    fail(resolution.code, resolution.reason, baseProvenance)
    return
  }

  const provenance = {
    ...baseProvenance,
    expectedCandidate: resolution.sha,
    actualHead: resolution.sha,
    worktree: resolution.worktree,
    branch: resolution.branch,
    detached: resolution.detached,
    dirty: resolution.dirty ? (resolution.advisoryDirtyOnly ? 'true (advisory-only: tsconfig.tsbuildinfo)' : 'true') : 'false',
  }

  if (!runtime.npmAvailable) {
    fail(
      EXIT.TOOLING,
      `npm could not be resolved on the runtime PATH (PATH SOURCE: ${runtime.pathSource}). ` +
        'gate.sh must resolve a node install that also provides npm.',
      provenance,
    )
    return
  }

  printProvenance(provenance)

  const steps = [...CANONICAL_STEPS]
  if (args.browser) steps.push(browserStep(resolution.sha))

  const env = { ...process.env }
  const outcome = runSteps(steps, resolution.worktree, env)

  const evidence = {
    ...provenance,
    lane: args.lane,
    ok: outcome.ok,
    steps: outcome.results.map((r) => ({ name: r.name, status: r.status, spawnError: r.spawnError })),
    nonce: randomUUID(),
    ranAt: new Date().toISOString(),
  }
  try {
    const evidenceDir = path.join(resolution.worktree, '.artifacts', 'validation')
    mkdirSync(evidenceDir, { recursive: true })
    const evidencePath = path.join(evidenceDir, `${resolution.sha}-${evidence.nonce}.json`)
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    console.log(`\nevidence written: ${evidencePath}`)
  } catch (err) {
    // Evidence persistence is best-effort; it must never mask a real
    // pass/fail result or turn a passing gate into a lifecycle failure.
    console.error(`[gate] warning: could not write evidence sidecar: ${err.message}`)
  }

  if (!outcome.ok) {
    const failedStep = outcome.results[outcome.results.length - 1]
    if (failedStep.spawnError) {
      fail(EXIT.LIFECYCLE, `Could not spawn step "${failedStep.name}": ${failedStep.spawnError}`, provenance)
      return
    }
    console.error(`\n[gate] FAIL (exit ${EXIT.ASSERTION}): step "${failedStep.name}" exited ${failedStep.status}.`)
    process.exit(EXIT.ASSERTION)
    return
  }

  console.log(`\n[gate] PASS: all ${steps.length} step(s) succeeded for lane "${args.lane}" at ${resolution.sha}.`)
  process.exit(EXIT.PASS)
}

main()
