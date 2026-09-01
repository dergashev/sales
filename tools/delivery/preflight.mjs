#!/usr/bin/env node
/**
 * tools/delivery/preflight.mjs — `npm run delivery:preflight -- <task-id>`
 *
 * DELIVERY-INFRA-01 item 3 — THE canonical, single executable entry point a
 * new Product implementation task runs before its first Product-code edit.
 * Composes the EXISTING canonical mechanisms this repository already has —
 * it does not re-implement any of them:
 *
 *   - authoritative release branch/commit : tools/runtime/lib/release-branch.mjs
 *     (resolveCurrentMainAuthority — the SAME resolver runtime:main/
 *     runtime:status/runtime:task-base already use; NEVER a literal
 *     `git rev-parse main`, see DELIVERY-INFRA-01 items 1/2).
 *   - isolated task worktree / root-checkout protection : tools/delivery/
 *     root-guard.mjs (checkRootCheckoutGuard, 'preflight' mode — the HARD
 *     GATE: refuses outright when run from the root checkout, before any
 *     Product-code modification, items 4/5).
 *   - task-base freshness/pinning : tools/runtime/lib/preflight.mjs
 *     (planTaskBasePreflight) + tools/gate/lib/manifest.mjs (the SAME
 *     exact-candidate manifest gate.mjs/declare-candidate.mjs/task-base
 *     already use — this command auto-declares a candidate entry for the
 *     given task id if none exists yet, so a brand-new task never has to
 *     run declare-candidate separately first).
 *   - worktree/dirty-state facts : tools/gate/lib/git-worktrees.mjs.
 *
 * Two subcommands:
 *   node tools/delivery/preflight.mjs <task-id> [--worktree <path>]
 *     the main preflight above.
 *   node tools/delivery/preflight.mjs pre-qa --task-id <id> [--worktree <path>]
 *     DELIVERY-INFRA-01 item 10 — PRE-QA FRESHNESS CHECK: re-resolves the
 *     authoritative commit fresh (never cached) and decides whether QA may
 *     proceed on the declared candidate as-is, via
 *     tools/delivery/pre-qa-freshness.mjs (checkPreQaFreshness).
 *
 * Exit codes (shared with the rest of this repository's delivery tooling):
 *   0  READY / QA MAY PROCEED
 *   2  BLOCKED — provenance/freshness/root-checkout/dirty-state problem
 *   3  LIFECYCLE — git/worktree/manifest-lock failure
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { currentBranch, dirtyEntries, gitCommonDir, headSha, listWorktrees, samePath } from '../gate/lib/git-worktrees.mjs'
import { defaultManifestPath, declareCandidate, readManifest } from '../gate/lib/manifest.mjs'
import { updateCandidateFields } from '../runtime/lib/candidate-fields.mjs'
import { planTaskBasePreflight } from '../runtime/lib/preflight.mjs'
import { resolveCurrentMainAuthority } from '../runtime/lib/release-branch.mjs'
import { checkRootCheckoutGuard } from './root-guard.mjs'
import { checkPreQaFreshness } from './pre-qa-freshness.mjs'

const EXIT = { READY: 0, BLOCKED: 2, LIFECYCLE: 3 }

function parseArgs(argv) {
  const args = { _: [], worktree: null, taskId: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--worktree') args.worktree = argv[++i]
    else if (a === '--task-id') args.taskId = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
    else args._.push(a)
  }
  return args
}

function printUsage() {
  console.log(
    'Usage:\n' +
      '  node tools/delivery/preflight.mjs <task-id> [--worktree <path>]\n' +
      '  node tools/delivery/preflight.mjs pre-qa --task-id <task-id> [--worktree <path>]',
  )
}

/** `git merge-base --is-ancestor <ancestor> <descendant>` — same tiny helper
 *  tools/runtime/main.mjs's own task-base command uses privately; kept as
 *  its own copy rather than imported (that module documents it as
 *  file-private, and duplicating six lines of git plumbing is not a
 *  "competing mechanism" the way a second resolver would be). */
function isAncestor(cwd, ancestorSha, descendantSha) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { cwd, encoding: 'utf8' })
  if (result.error) return null
  if (result.status === 0) return true
  if (result.status === 1) return false
  return null
}

function fail(code, message) {
  console.error(`\n[delivery:preflight] BLOCKED (exit ${code}): ${message}`)
  process.exit(code)
}

// ── main preflight ─────────────────────────────────────────────────────

function cmdPreflight(args) {
  const taskId = args._[0]
  if (!taskId) {
    printUsage()
    return fail(EXIT.LIFECYCLE, 'A <task-id> is required.')
  }

  const taskWorktreePath = path.resolve(args.worktree || process.cwd())

  const commonDir = gitCommonDir(taskWorktreePath)
  if (!commonDir) return fail(EXIT.LIFECYCLE, `"git rev-parse --git-common-dir" failed from "${taskWorktreePath}". Is this a git repository?`)
  const repoRoot = path.dirname(commonDir)

  // 1) AUTHORITATIVE RELEASE BRANCH/COMMIT — resolved fresh, through the
  // one canonical resolver. Resolved against repoRoot (not the task
  // worktree) so it reflects genuine repository-wide authority regardless
  // of which worktree happens to invoke this command.
  const authority = resolveCurrentMainAuthority(repoRoot)
  if (!authority.ok) {
    console.log('DELIVERY PREFLIGHT: BLOCKED')
    console.log(`\nreason=AUTHORITATIVE_RELEASE_BRANCH_UNRESOLVED\n${authority.reason}`)
    console.log('\nNo repository state was modified.')
    process.exit(EXIT.BLOCKED)
    return
  }

  // 2) ROOT RELEASE CHECKOUT PROTECTION — the hard gate: this command must
  // not report READY when it is itself being run from the root checkout.
  const rootGuard = checkRootCheckoutGuard({ repoRoot, targetPath: taskWorktreePath, samePathFn: samePath, mode: 'preflight' })

  const rootCheckoutBranch = currentBranch(repoRoot)
  const rootCheckoutCommit = headSha(repoRoot)
  const rootCheckoutDirtyEntries = dirtyEntries(repoRoot)
  const rootCheckoutClean = rootCheckoutDirtyEntries === null ? 'UNKNOWN' : rootCheckoutDirtyEntries.length === 0

  if (!rootGuard.ok) {
    console.log('DELIVERY PREFLIGHT: BLOCKED')
    console.log(`\nreason=ROOT_CHECKOUT_IMPLEMENTATION_ATTEMPT`)
    console.log(`authoritativeRemote=origin`)
    console.log(`authoritativeReleaseBranch=${authority.branch}`)
    console.log(`authoritativeReleaseCommit=${authority.sha}`)
    console.log(`rootCheckoutPath=${repoRoot}`)
    console.log(`rootCheckoutBranch=${rootCheckoutBranch ?? 'UNRESOLVED'}`)
    console.log(`rootCheckoutCommit=${rootCheckoutCommit ?? 'UNRESOLVED'}`)
    console.log(`rootCheckoutClean=${rootCheckoutClean}`)
    console.log(`\n${rootGuard.reason}`)
    console.log('\nNo repository state was modified.')
    process.exit(EXIT.BLOCKED)
    return
  }

  // 3) ISOLATED TASK WORKTREE — must be a REGISTERED worktree (git worktree
  // add ...), never merely "some directory that happens to have a .git".
  const worktrees = listWorktrees(repoRoot)
  if (worktrees === null) return fail(EXIT.LIFECYCLE, '"git worktree list --porcelain" failed.')
  const registered = worktrees.find((w) => samePath(w.path, taskWorktreePath))
  if (!registered) {
    console.log('DELIVERY PREFLIGHT: BLOCKED')
    console.log('\nreason=TASK_WORKTREE_NOT_REGISTERED')
    console.log(`taskWorktreePath=${taskWorktreePath}`)
    console.log(
      `\n"${taskWorktreePath}" is not a path "git worktree list" returns for this repository. Create it first: ` +
        `"git worktree add .worktrees/${taskId} -b task/${taskId} ${authority.sha}".`,
    )
    console.log('\nNo repository state was modified.')
    process.exit(EXIT.BLOCKED)
    return
  }

  const taskBranch = registered.detached ? null : registered.branch
  const taskWorktreeCommit = headSha(taskWorktreePath)
  if (!taskWorktreeCommit) return fail(EXIT.LIFECYCLE, `"git rev-parse HEAD" failed in "${taskWorktreePath}".`)
  const taskWorktreeDirtyEntries = dirtyEntries(taskWorktreePath)
  const taskWorktreeClean = taskWorktreeDirtyEntries === null ? 'UNKNOWN' : taskWorktreeDirtyEntries.length === 0

  // 4) TASK-BASE FRESHNESS / PINNING — reuses the SAME exact-candidate
  // manifest and the SAME planTaskBasePreflight decision table
  // `runtime:task-base` already uses; auto-declares a candidate entry for
  // this task id if none exists yet, so a first-ever preflight for a new
  // task never needs a separate declare-candidate step.
  const manifestPath = defaultManifestPath(commonDir)
  let manifest = readManifest(manifestPath)
  let entry = manifest[taskId] ?? null
  if (!entry) {
    try {
      declareCandidate(manifestPath, taskId, {
        sha: taskWorktreeCommit,
        worktree: taskWorktreePath,
        branch: taskBranch,
        taskId,
        runId: null,
        nodeId: null,
        declaredBy: 'delivery:preflight',
        declaredAt: new Date().toISOString(),
      })
    } catch (err) {
      return fail(EXIT.LIFECYCLE, `Could not declare a candidate entry for task "${taskId}": ${err.message}`)
    }
    manifest = readManifest(manifestPath)
    entry = manifest[taskId]
  }

  const mainIsAncestorOfHead = isAncestor(taskWorktreePath, authority.sha, taskWorktreeCommit)
  const basePlan = planTaskBasePreflight({ manifestEntry: entry, mainSha: authority.sha, headSha: taskWorktreeCommit, mainIsAncestorOfHead })

  if (basePlan.action === 'blocked') return fail(EXIT.LIFECYCLE, basePlan.reason)

  if (basePlan.action === 'stale') {
    console.log('DELIVERY PREFLIGHT: BLOCKED')
    console.log('\nreason=STALE_TASK_BASE')
    console.log(`taskId=${taskId}`)
    console.log(`authoritativeReleaseBranch=${authority.branch}`)
    console.log(`authoritativeReleaseCommit=${authority.sha}`)
    console.log(`taskWorktreePath=${taskWorktreePath}`)
    console.log(`taskWorktreeCommit=${taskWorktreeCommit}`)
    console.log(`\n${basePlan.reason} ${basePlan.unblockingRequirement}`)
    console.log('\nNo repository state was modified.')
    process.exit(EXIT.BLOCKED)
    return
  }

  let taskBaseCommit = basePlan.taskBaseCommit
  if (basePlan.action === 'pin') {
    try {
      updateCandidateFields(manifestPath, taskId, { taskBaseCommit: basePlan.taskBaseCommit, pinnedAt: new Date().toISOString() })
    } catch (err) {
      return fail(EXIT.LIFECYCLE, `Could not pin taskBaseCommit for task "${taskId}": ${err.message}`)
    }
  }

  // 5) CANDIDATE RUNTIME IDENTITY — this preflight asserts the runtime
  // identity a TASK_CANDIDATE server for this exact worktree WOULD/DOES
  // serve. It does not itself start or probe a live server (that remains
  // `runtime:candidate` / `runtime:preflight`'s job — no duplicated
  // mechanism here): the runtime commit is definitionally this worktree's
  // own HEAD, so provenance trivially matches by construction. A live
  // server's actual SHA is independently, separately verified via
  // `npm run runtime:preflight` before any browser evidence is trusted.
  const runtimeMode = 'TASK_CANDIDATE'
  const runtimeCommit = taskWorktreeCommit
  const provenanceMatch = true

  console.log('DELIVERY PREFLIGHT: READY')
  console.log('')
  console.log(`taskId=${taskId}`)
  console.log(`authoritativeRemote=origin`)
  console.log(`authoritativeReleaseBranch=${authority.branch}`)
  console.log(`authoritativeReleaseCommit=${authority.sha}`)
  console.log(`rootCheckoutPath=${repoRoot}`)
  console.log(`rootCheckoutBranch=${rootCheckoutBranch ?? 'UNRESOLVED'}`)
  console.log(`rootCheckoutCommit=${rootCheckoutCommit ?? 'UNRESOLVED'}`)
  console.log(`rootCheckoutClean=${rootCheckoutClean}`)
  console.log(`taskWorktreePath=${taskWorktreePath}`)
  console.log(`taskBranch=${taskBranch ?? 'DETACHED'}`)
  console.log(`taskBaseCommit=${taskBaseCommit}`)
  console.log(`taskWorktreeCommit=${taskWorktreeCommit}`)
  console.log(`taskWorktreeClean=${taskWorktreeClean}`)
  console.log(`runtimeMode=${runtimeMode}`)
  console.log(`runtimeCommit=${runtimeCommit}`)
  console.log(`provenanceMatch=${provenanceMatch}`)
  console.log('')
  console.log('READY_FOR_IMPLEMENTATION=true')
  process.exit(EXIT.READY)
}

// ── pre-qa freshness ───────────────────────────────────────────────────

function cmdPreQa(args) {
  const taskId = args.taskId
  if (!taskId) {
    printUsage()
    return fail(EXIT.LIFECYCLE, 'pre-qa requires --task-id <task-id>.')
  }
  const cwd = path.resolve(args.worktree || process.cwd())
  const commonDir = gitCommonDir(cwd)
  if (!commonDir) return fail(EXIT.LIFECYCLE, `"git rev-parse --git-common-dir" failed from "${cwd}".`)
  const repoRoot = path.dirname(commonDir)

  const authority = resolveCurrentMainAuthority(repoRoot)
  if (!authority.ok) return fail(EXIT.BLOCKED, authority.reason)

  const manifestPath = defaultManifestPath(commonDir)
  const manifest = readManifest(manifestPath)
  const entry = manifest[taskId]
  if (!entry) return fail(EXIT.LIFECYCLE, `No candidate is declared for task "${taskId}". Run delivery:preflight (or gate:declare) first.`)
  if (!entry.taskBaseCommit) return fail(EXIT.LIFECYCLE, `Task "${taskId}" has no pinned taskBaseCommit yet. Run delivery:preflight first.`)

  const candidateWorktree = entry.worktree
  const authorityIsAncestorOfCandidate = isAncestor(candidateWorktree || repoRoot, authority.sha, entry.sha)

  const result = checkPreQaFreshness({
    preQaAuthoritativeCommit: authority.sha,
    candidateCommit: entry.sha,
    candidateBase: entry.taskBaseCommit,
    authorityIsAncestorOfCandidate,
  })

  console.log(result.ok && !result.reconciliationRequired ? 'PRE-QA FRESHNESS: QA MAY PROCEED' : result.ok ? 'PRE-QA FRESHNESS: RECONCILIATION REQUIRED' : 'PRE-QA FRESHNESS: BLOCKED')
  console.log('')
  console.log(`taskId=${taskId}`)
  console.log(`preQaAuthoritativeCommit=${result.preQaAuthoritativeCommit}`)
  console.log(`candidateCommit=${result.candidateCommit}`)
  console.log(`candidateBase=${result.candidateBase}`)
  console.log(`remoteAdvanced=${result.remoteAdvanced}`)
  console.log(`reconciliationRequired=${result.reconciliationRequired}`)
  console.log(`\n${result.reason}`)

  if (!result.ok) process.exit(EXIT.LIFECYCLE)
  process.exit(result.reconciliationRequired ? EXIT.BLOCKED : EXIT.READY)
}

function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  if (args.help) {
    printUsage()
    process.exit(EXIT.READY)
    return
  }
  if (args._[0] === 'pre-qa') {
    args._.shift()
    return cmdPreQa(args)
  }
  return cmdPreflight(args)
}

main()
