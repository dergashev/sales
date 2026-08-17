// tools/gate/lib/run-steps.mjs
//
// Runs the canonical gate commands as discrete steps against an EXPLICIT
// cwd/env — never the inherited process cwd — so a mismatched checkout
// cannot be validated by accident. Stops at the first failing step
// (fail-fast) and reports exactly which step failed.

import { spawnSync } from 'node:child_process'

export const CANONICAL_STEPS = [
  { name: 'typecheck', cmd: 'npm', args: ['run', 'typecheck'] },
  { name: 'test', cmd: 'npm', args: ['test'] },
  { name: 'verify', cmd: 'npm', args: ['run', 'verify'] },
  { name: 'build', cmd: 'npm', args: ['run', 'build'] },
]

export function browserStep(expectSha) {
  return { name: 'browser', cmd: 'npm', args: ['run', 'test:browser:desktop', '--', '--expect-sha', expectSha] }
}

/**
 * @param {Array<{name:string,cmd:string,args:string[]}>} steps
 * @param {string} cwd - the EXACT candidate worktree; never omitted, never defaulted.
 * @param {NodeJS.ProcessEnv} env - explicit environment (already carries the resolved node/npm PATH).
 * @param {(cmd:string,args:string[],opts:object)=>{status:number|null,error?:Error,stdout:string,stderr:string}} [spawnFn]
 *   - injectable for tests.
 * @returns {{ ok: boolean, results: Array<{name:string, status:number|null, spawnError:string|null}> }}
 */
export function runSteps(steps, cwd, env, spawnFn = spawnSync) {
  const results = []
  for (const step of steps) {
    const result = spawnFn(step.cmd, step.args, { cwd, env, encoding: 'utf8' })
    const spawnError = result.error ? result.error.message : null
    const status = spawnError ? null : result.status
    results.push({ name: step.name, status, spawnError, stdout: result.stdout ?? '', stderr: result.stderr ?? '' })
    if (spawnError || status !== 0) {
      return { ok: false, results }
    }
  }
  return { ok: true, results }
}
