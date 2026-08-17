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
import { defaultManifestPath, declareCandidate } from './lib/manifest.mjs'

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

  const entry = {
    sha,
    worktree,
    branch: branch === 'HEAD' ? null : branch,
    taskId: args.taskId || null,
    runId: args.runId || null,
    nodeId: args.nodeId || null,
    declaredBy: args.declaredBy || null,
    declaredAt: new Date().toISOString(),
  }

  declareCandidate(manifestPath, args.lane, entry)

  console.log(`Declared lane "${args.lane}" -> ${sha} at ${worktree} (${manifestPath})`)
}

main()
