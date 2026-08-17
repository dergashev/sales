// tools/gate/lib/run-steps.test.mjs
//
// Rework (Tech Review P1/P2 on commit 9017225a): run-steps.mjs no longer
// buffers a step's entire output into a single string via spawnSync. These
// tests specifically regress the two findings: (1) a step's own output
// must actually be observable — live on this process's stdout/stderr and
// durably in a per-step log file — not silently discarded; (2) large
// output (well beyond spawnSync's old 1MB maxBuffer default) must still
// complete as a normal pass/fail, never as a spawn/lifecycle error.

import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CANONICAL_STEPS, browserStep, runStep, runSteps } from './run-steps.mjs'

/** A fake child_process.spawn that behaves like the real thing closely
 *  enough for runStep: an EventEmitter with .stdout/.stderr PassThrough
 *  streams, emitting 'error' or ('close', code) asynchronously. */
function fakeSpawn({ stdout = [], stderr = [], exitCode = 0, spawnError = null } = {}) {
  const calls = []
  const impl = (cmd, args, opts) => {
    const child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    calls.push({ cmd, args, opts, child })

    if (spawnError) {
      process.nextTick(() => child.emit('error', spawnError))
      return child
    }

    // Real child_process semantics: 'close' fires only once BOTH stdio
    // streams have themselves ended (i.e. every consumer, including our
    // own .pipe() destinations, has been handed all the data) — never
    // before. Getting this ordering right in the fake is what makes this
    // a meaningful regression test for runStep's own end()-callback fix,
    // rather than one race papering over another.
    let stdoutEnded = false
    let stderrEnded = false
    const maybeClose = () => {
      if (stdoutEnded && stderrEnded) child.emit('close', exitCode)
    }
    child.stdout.on('end', () => {
      stdoutEnded = true
      maybeClose()
    })
    child.stderr.on('end', () => {
      stderrEnded = true
      maybeClose()
    })

    for (const chunk of stdout) child.stdout.write(chunk)
    for (const chunk of stderr) child.stderr.write(chunk)
    child.stdout.end()
    child.stderr.end()
    return child
  }
  impl.calls = calls
  return impl
}

let tmpRoot
let logDir
let stdoutSpy
let stdoutWritten

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-run-steps-'))
  logDir = path.join(tmpRoot, 'logs')
  // runStep streams to the REAL process.stdout by design (that's the P1
  // fix under test) — captured-but-suppressed here so synthetic
  // megabyte-scale fixtures don't flood this test run's own output; the
  // "reaches stdout live" assertion reads stdoutWritten instead.
  stdoutWritten = []
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdoutWritten.push(chunk.toString())
    return true
  })
})

afterEach(() => {
  stdoutSpy.mockRestore()
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('runStep — live streaming, never buffered', () => {
  it('passes the EXACT cwd/env to the spawned process — never a default/inherited cwd', async () => {
    const spawnImpl = fakeSpawn({})
    const env = { PATH: '/resolved/node/bin:/usr/bin', CUSTOM: '1' }
    await runStep(CANONICAL_STEPS[0], '/exact/candidate/worktree', env, logDir, spawnImpl)

    expect(spawnImpl.calls).toHaveLength(1)
    expect(spawnImpl.calls[0].opts.cwd).toBe('/exact/candidate/worktree')
    expect(spawnImpl.calls[0].opts.env).toBe(env)
  })

  it('Tech Review P1 regression: a step\'s output actually reaches this process\'s own stdout live, not just an exit code', async () => {
    const spawnImpl = fakeSpawn({ stdout: ['compiler error: src/foo.ts(12,5): TS2322\n'] })
    await runStep(CANONICAL_STEPS[0], '/wt', {}, logDir, spawnImpl)
    expect(stdoutWritten.join('')).toContain('TS2322')
  })

  it('Tech Review P1 regression: the SAME output is durably persisted to a per-step log file', async () => {
    const spawnImpl = fakeSpawn({ stdout: ['line one\n'], stderr: ['line two (stderr)\n'] })
    const result = await runStep(CANONICAL_STEPS[0], '/wt', {}, logDir, spawnImpl)
    expect(result.logPath).toBeTruthy()
    const logged = readFileSync(result.logPath, 'utf8')
    expect(logged).toContain('line one')
    expect(logged).toContain('line two (stderr)')
  })

  it('Tech Review P2 regression: output far beyond spawnSync\'s old 1MB maxBuffer completes as a normal result, never a spawn error', async () => {
    const bigChunk = 'x'.repeat(64 * 1024) // 64KB per chunk
    const chunks = Array.from({ length: 40 }, () => bigChunk) // ~2.5MB total, > old 1MB cap
    const spawnImpl = fakeSpawn({ stdout: chunks, exitCode: 0 })
    const result = await runStep(CANONICAL_STEPS[0], '/wt', {}, logDir, spawnImpl)

    expect(result.spawnError).toBeNull()
    expect(result.status).toBe(0) // NOT misclassified as a lifecycle/spawn failure
    const logged = readFileSync(result.logPath, 'utf8')
    expect(logged.length).toBe(chunks.join('').length) // nothing silently truncated on disk
  })

  it('outputTail keeps only a bounded tail (~8KB) of the combined output, not the full string', async () => {
    const bigChunk = 'y'.repeat(1024)
    const chunks = Array.from({ length: 20 }, (_, i) => `${bigChunk}-${i}\n`) // > 8KB total
    const spawnImpl = fakeSpawn({ stdout: chunks })
    const result = await runStep(CANONICAL_STEPS[0], '/wt', {}, logDir, spawnImpl)
    expect(result.outputTail.length).toBeLessThanOrEqual(8192)
    expect(result.outputTail).toContain('-19') // the tail, i.e. the LAST chunk, is what's kept
    expect(result.outputTail).not.toContain('-0\n') // the earliest chunk fell out of the bounded tail
  })

  it('reports a spawn error (e.g. ENOENT) distinctly from a nonzero exit status, without throwing', async () => {
    const spawnImpl = fakeSpawn({ spawnError: new Error('spawn npm ENOENT') })
    const result = await runStep(CANONICAL_STEPS[0], '/wt', {}, logDir, spawnImpl)
    expect(result.status).toBeNull()
    expect(result.spawnError).toMatch(/ENOENT/)
  })

  it('a nonzero exit status is reported with spawnError:null (a real gate failure, not an infrastructure blocker)', async () => {
    const spawnImpl = fakeSpawn({ exitCode: 2 })
    const result = await runStep(CANONICAL_STEPS[0], '/wt', {}, logDir, spawnImpl)
    expect(result.status).toBe(2)
    expect(result.spawnError).toBeNull()
  })
})

describe('runSteps — orchestration (fail-fast, cwd/env/logDir threading)', () => {
  it('passes the EXACT cwd/env/logDir to every step, in order, and never runs steps after a failure', async () => {
    const calls = []
    const runStepFn = async (step, cwd, env, dir) => {
      calls.push({ step: step.name, cwd, env, dir })
      return { name: step.name, status: step.name === 'test' ? 1 : 0, spawnError: null, logPath: null, outputTail: '' }
    }
    const env = { CUSTOM: '1' }
    const result = await runSteps(CANONICAL_STEPS, '/exact/wt', env, '/logs', runStepFn)

    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(2) // typecheck (pass) + test (fail); verify/build never invoked
    expect(calls.map((c) => c.step)).toEqual(['typecheck', 'test'])
    for (const call of calls) {
      expect(call.cwd).toBe('/exact/wt')
      expect(call.env).toBe(env)
      expect(call.dir).toBe('/logs')
    }
  })

  it('all steps passing yields ok:true with one result per step', async () => {
    const runStepFn = async (step) => ({ name: step.name, status: 0, spawnError: null, logPath: null, outputTail: '' })
    const result = await runSteps(CANONICAL_STEPS, '/wt', {}, '/logs', runStepFn)
    expect(result.ok).toBe(true)
    expect(result.results).toHaveLength(CANONICAL_STEPS.length)
  })

  it('a spawn error also stops the pipeline immediately', async () => {
    const runStepFn = async (step) => ({ name: step.name, status: null, spawnError: 'spawn npm ENOENT', logPath: null, outputTail: '' })
    const result = await runSteps(CANONICAL_STEPS, '/wt', {}, '/logs', runStepFn)
    expect(result.ok).toBe(false)
    expect(result.results).toHaveLength(1)
  })

  it('browserStep threads the expected SHA into the desktop smoke runner invocation', () => {
    const step = browserStep('deadbeef')
    expect(step.name).toBe('browser')
    expect(step.args).toEqual(['run', 'test:browser:desktop', '--', '--expect-sha', 'deadbeef'])
  })
})
