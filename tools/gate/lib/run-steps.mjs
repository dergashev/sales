// tools/gate/lib/run-steps.mjs
//
// Runs the canonical gate commands as discrete steps against an EXPLICIT
// cwd/env — never the inherited process cwd — so a mismatched checkout
// cannot be validated by accident. Stops at the first failing step
// (fail-fast) and reports exactly which step failed.
//
// Rework (Tech Review P1/P2 on commit 9017225a): the previous version used
// spawnSync({encoding:'utf8'}), which (a) buffers the ENTIRE step output in
// memory and NEVER prints or persists it -- a failing gate reported only
// "step X exited N", discarding the actual compiler/test/verify output a
// reviewer needs -- and (b) inherits spawnSync's default 1MB maxBuffer, so
// a large FAILING run (exactly when output balloons) hits ENOBUFS, which
// surfaces as spawnError and gets misclassified as an infrastructure
// blocker (exit 3) instead of a real product failure (exit 1).
//
// Fixed by switching to async child_process.spawn with piped stdio and
// NO in-memory accumulation of the full stream: each chunk is written
// straight through to (1) this process's own stdout/stderr, so whatever
// is watching the gate run sees real output live, and (2) a per-step log
// file under the run's log directory, which is the durable record. A
// small bounded tail (last ~8KB) is kept ONLY for a failing step, to
// carry directly in the evidence sidecar without needing to open the log
// file. Because nothing is buffered as a single in-memory string with a
// size cap, there is no maxBuffer/ENOBUFS failure mode left to hit --
// arbitrarily large output just streams through.

import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import path from 'node:path'

export const CANONICAL_STEPS = [
  { name: 'typecheck', cmd: 'npm', args: ['run', 'typecheck'] },
  { name: 'test', cmd: 'npm', args: ['test'] },
  { name: 'verify', cmd: 'npm', args: ['run', 'verify'] },
  { name: 'build', cmd: 'npm', args: ['run', 'build'] },
]

export function browserStep(expectSha) {
  return { name: 'browser', cmd: 'npm', args: ['run', 'test:browser:desktop', '--', '--expect-sha', expectSha] }
}

const OUTPUT_TAIL_BYTES = 8192

/**
 * Runs ONE step with stdout/stderr streamed live (never buffered as a
 * single string) to (a) this process's own stdout/stderr and (b) a
 * per-step log file in `logDir`. Returns a bounded tail of the combined
 * output for evidence purposes; the log FILE is the full record.
 *
 * @param {{name:string,cmd:string,args:string[]}} step
 * @param {string} cwd - the EXACT candidate worktree.
 * @param {NodeJS.ProcessEnv} env - explicit environment.
 * @param {string} logDir - directory to write `<step.name>.log` into (created if missing).
 * @param {typeof spawn} [spawnImpl] - injectable for tests (must match node:child_process's spawn signature/behavior).
 * @returns {Promise<{name:string, status:number|null, spawnError:string|null, logPath:string|null, outputTail:string}>}
 */
export function runStep(step, cwd, env, logDir, spawnImpl = spawn) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawnImpl(step.cmd, step.args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      resolve({ name: step.name, status: null, spawnError: err.message, logPath: null, outputTail: '' })
      return
    }

    let logPath = null
    let logStream = null
    try {
      mkdirSync(logDir, { recursive: true })
      logPath = path.join(logDir, `${step.name}.log`)
      logStream = createWriteStream(logPath)
      logStream.on('error', (err) => {
        // Logging is best-effort: live console output and the pass/fail
        // result must never depend on the log file succeeding.
        console.error(`[gate] warning: could not write log for step "${step.name}": ${err.message}`)
      })
    } catch (err) {
      console.error(`[gate] warning: could not create log directory for step "${step.name}": ${err.message}`)
    }

    let tail = ''
    const onChunk = (chunk) => {
      tail += chunk.toString('utf8')
      if (tail.length > OUTPUT_TAIL_BYTES) tail = tail.slice(tail.length - OUTPUT_TAIL_BYTES)
    }

    for (const [stream, sink] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      if (!stream) continue
      stream.on('data', onChunk)
      stream.pipe(sink, { end: false })
      if (logStream) stream.pipe(logStream, { end: false })
    }

    // Wait for the log stream's own 'finish' (via the end() callback) before
    // resolving: the child's stdio streams having ended only means WE have
    // been handed all the data, not that our own write to logStream has
    // been flushed to disk yet. Resolving early risks a caller reading
    // logPath immediately after and finding it truncated or empty.
    const finish = (status, spawnError) => {
      const settle = () => resolve({ name: step.name, status, spawnError, logPath, outputTail: tail })
      if (logStream) logStream.end(settle)
      else settle()
    }

    child.on('error', (err) => finish(null, err.message))
    child.on('close', (code) => finish(code, null))
  })
}

/**
 * @param {Array<{name:string,cmd:string,args:string[]}>} steps
 * @param {string} cwd - the EXACT candidate worktree; never omitted, never defaulted.
 * @param {NodeJS.ProcessEnv} env - explicit environment (already carries the resolved node/npm PATH).
 * @param {string} logDir - directory to write per-step logs into.
 * @param {typeof runStep} [runStepFn] - injectable for tests.
 * @returns {Promise<{ ok: boolean, results: Array<{name:string, status:number|null, spawnError:string|null, logPath:string|null, outputTail:string}> }>}
 */
export async function runSteps(steps, cwd, env, logDir, runStepFn = runStep) {
  const results = []
  for (const step of steps) {
    const result = await runStepFn(step, cwd, env, logDir)
    results.push(result)
    if (result.spawnError || result.status !== 0) {
      return { ok: false, results }
    }
  }
  return { ok: true, results }
}
