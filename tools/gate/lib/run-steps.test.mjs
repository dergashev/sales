// tools/gate/lib/run-steps.test.mjs

import { describe, expect, it } from 'vitest'
import { CANONICAL_STEPS, browserStep, runSteps } from './run-steps.mjs'

describe('runSteps', () => {
  it('passes the EXACT cwd/env given to every spawned step — never a default/inherited cwd', () => {
    const calls = []
    const spawnFn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts })
      return { status: 0, stdout: '', stderr: '' }
    }
    const env = { PATH: '/resolved/node/bin:/usr/bin', CUSTOM: '1' }
    runSteps(CANONICAL_STEPS, '/exact/candidate/worktree', env, spawnFn)

    expect(calls).toHaveLength(CANONICAL_STEPS.length)
    for (const call of calls) {
      expect(call.opts.cwd).toBe('/exact/candidate/worktree')
      expect(call.opts.env).toBe(env)
    }
  })

  it('stops at the first failing step (fail-fast) and never runs the remaining steps', () => {
    // The second canonical step ("test") fails; typecheck (1st) must have
    // run, verify/build (3rd/4th) must never be invoked.
    let call = 0
    const orderedSpawn = () => {
      call += 1
      return { status: call === 2 ? 1 : 0, stdout: '', stderr: '' }
    }
    const result = runSteps(CANONICAL_STEPS, '/wt', {}, orderedSpawn)
    expect(result.ok).toBe(false)
    expect(result.results).toHaveLength(2) // typecheck (pass) + test (fail); verify/build never run
    expect(result.results[0].status).toBe(0)
    expect(result.results[1].status).toBe(1)
  })

  it('reports a spawn error (e.g. ENOENT) distinctly from a nonzero exit status', () => {
    const spawnFn = () => ({ status: null, error: new Error('spawn npm ENOENT'), stdout: '', stderr: '' })
    const result = runSteps(CANONICAL_STEPS, '/wt', {}, spawnFn)
    expect(result.ok).toBe(false)
    expect(result.results[0].status).toBeNull()
    expect(result.results[0].spawnError).toMatch(/ENOENT/)
  })

  it('all steps passing yields ok:true with one result per step', () => {
    const spawnFn = () => ({ status: 0, stdout: '', stderr: '' })
    const result = runSteps(CANONICAL_STEPS, '/wt', {}, spawnFn)
    expect(result.ok).toBe(true)
    expect(result.results).toHaveLength(CANONICAL_STEPS.length)
  })

  it('browserStep threads the expected SHA into the desktop smoke runner invocation', () => {
    const step = browserStep('deadbeef')
    expect(step.name).toBe('browser')
    expect(step.args).toEqual(['run', 'test:browser:desktop', '--', '--expect-sha', 'deadbeef'])
  })
})
