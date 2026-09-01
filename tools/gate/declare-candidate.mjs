#!/usr/bin/env node
/**
 * tools/gate/declare-candidate.mjs — `npm run gate:declare -- --lane <lane>`
 *
 * Run by the candidate owner INSIDE its own worktree, after committing the
 * implementation candidate, so the gate (tools/gate/gate.mjs) knows exactly
 * which SHA/worktree that lane is currently supposed to validate. Without a
 * declaration the gate refuses (fail-closed) rather than guessing.
 *
 * By default declares the current HEAD of the current working directory's
 * worktree. Override with --sha / --worktree if declaring on behalf of
 * another checkout (e.g. from an orchestration script).
 */

import { gitCommonDir, headSha, currentBranch } from './lib/git-worktrees.mjs'
import { defaultManifestPath, declareCandidate, readManifest } from './lib/manifest.mjs'

function parseArgs(argv) {
  const args = {
    lane: null,
    sha: null,
    worktree: null,
    manifest: null,
    taskId: null,
    runId: null,
    nodeId: null,
    declaredBy: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lane') args.lane = argv[++i]
    else if (a === '--sha') args.sha = argv[++i]
    else if (a === '--worktree') args.worktree = argv[++i]
    else if (a === '--manifest') args.manifest = argv[++i]
    else if (a === '--task-id') args.taskId = argv[++i]
    else if (a === '--run-id') args.runId = argv[++i]
    else if (a === '--node-id') args.nodeId = argv[++i]
    else if (a === '--declared-by') args.declaredBy = argv[++i]
    else if (a === '--help' || a === '-h') {
      printUsage()
      process.exit(0)
    } else {
      console.error(`Unknown argument: ${a}`)
      printUsage()
      process.exit(1)
    }
  }
  return args
}

function printUsage() {
  console.log(
    'Usage: node tools/gate/declare-candidate.mjs --lane <client-experience|engineering|calculation|...> ' +
      '[--sha <sha>] [--worktree <path>] [--task-id <id>] [--run-id <id>] [--node-id <id>] [--declared-by <name>]',
  )
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.lane) {
    console.error('--lane is required.')
    printUsage()
    process.exit(1)
  }

  const cwd = process.cwd()
  const worktree = args.worktree || cwd
  const sha = args.sha || headSha(worktree)
  if (!sha) {
    console.error(`Could not resolve HEAD for "${worktree}" — is it a valid git checkout?`)
    process.exit(1)
  }
  const branch = currentBranch(worktree)

  const commonDir = gitCommonDir(worktree)
  if (!commonDir) {
    console.error(`Could not resolve the git common dir for "${worktree}".`)
    process.exit(1)
  }
  const manifestPath = args.manifest || defaultManifestPath(commonDir)

  // DELIVERY-INFRA-01 (found by the end-to-end delivery-lifecycle dry run):
  // declareCandidate wholesale-REPLACES a lane's entry by design (see
  // manifest.test.mjs "re-declaring the same lane... overwrites only that
  // lane's entry with the new SHA" — a deliberate, tested contract this
  // file must not weaken). But `taskBaseCommit`/`pinnedAt`
  // (tools/runtime/lib/preflight.mjs's PINNED CANDIDATE RULE: "once
  // genuinely established, never rebased") describe the TASK/WORKTREE's
  // own lineage, not a property of one particular candidate SHA — a normal
  // rework re-declaration (this CLI's own documented use: "after
  // committing the implementation candidate") for the SAME lane must not
  // silently erase a pin `delivery:preflight`/`runtime:task-base` already
  // established for that lane, or the very next `runtime:task-base --lane
  // <lane>` call would treat it as a brand-new, unpinned task and
  // re-derive a taskBaseCommit from whatever main happens to be NOW —
  // exactly the silent-rebase-on-rework failure mode that rule exists to
  // prevent. Carried forward only for the SAME lane; declaring a different
  // lane is unaffected (each lane's pin is independent).
  const previous = readManifest(manifestPath)[args.lane]

  const entry = {
    sha,
    worktree,
    branch: branch === 'HEAD' ? null : branch,
    taskId: args.taskId || null,
    runId: args.runId || null,
    nodeId: args.nodeId || null,
    declaredBy: args.declaredBy || null,
    declaredAt: new Date().toISOString(),
    ...(previous?.taskBaseCommit ? { taskBaseCommit: previous.taskBaseCommit, pinnedAt: previous.pinnedAt ?? null } : {}),
  }

  try {
    declareCandidate(manifestPath, args.lane, entry)
  } catch (err) {
    // A lock-acquisition failure (or any other concurrency-safety error)
    // must fail closed and be visibly distinct from a normal usage error:
    // it means the declaration was NOT recorded, not that it silently
    // succeeded. Exit 3 matches gate.mjs's own LIFECYCLE code for
    // validation-infrastructure failures, not a real gate-step failure.
    console.error(`\n[gate:declare] VALIDATION INFRASTRUCTURE BLOCKER (exit 3): ${err.message}`)
    process.exit(3)
  }

  console.log(`Declared lane "${args.lane}" -> ${sha} at ${worktree} (${manifestPath})`)
}

main()
