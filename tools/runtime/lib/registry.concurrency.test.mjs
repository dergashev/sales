// tools/runtime/lib/registry.concurrency.test.mjs
//
// Ticket scenario H ("MULTIPLE CURRENT_MAIN STARTERS"): two concurrent
// requests attempt CURRENT_MAIN startup/rotation -> exactly one canonical
// authoritative result, no lost registry writes, no dual authority, no
// partially written registry. Exercised with REAL, separate OS processes
// (precedent: tools/gate/lib/manifest-lock.test.mjs / manifest.test.mjs's
// own concurrency suites) — the registry reuses those exact same
// production primitives (writeManifestAtomic + withManifestLock)
// unchanged, so this test both documents and re-proves that reuse for
// runtimes.json specifically, rather than assuming it transfers.

import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultRegistryPath, listClaims, readRegistry, runtimeId } from './registry.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLAIM_WRITER = path.join(HERE, 'test-fixtures', 'claim-writer.mjs')

function runChild(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${scriptPath} ${args.join(' ')} exited ${code}`))))
  })
}

let tmpRoot
let registryPath

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a3-runtime-registry-concurrency-'))
  registryPath = defaultRegistryPath(tmpRoot)
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('registry concurrency (real child processes)', () => {
  it('N concurrent starters racing for the SAME CURRENT_MAIN id: exactly one final claim survives, never a torn/partial file, no leaked lock/tmp artifacts', async () => {
    const id = runtimeId('CURRENT_MAIN', '/preview/main')
    const N = 8
    // A 150ms in-critical-section-adjacent delay (same technique as
    // tools/gate/lib/test-fixtures/delayed-writer.mjs) widens the race so
    // every one of the N processes provably overlaps another, rather than
    // relying on OS scheduling to occasionally interleave them.
    await Promise.all(
      Array.from({ length: N }, (_, i) => runChild(CLAIM_WRITER, [registryPath, id, `sha-${i}`, '50'])),
    )

    // No dual authority: exactly one entry for this id, not N.
    const claims = listClaims(registryPath)
    expect(claims).toHaveLength(1)
    expect(claims[0].id).toBe(id)
    // "one canonical authoritative result" — deterministically SOME
    // writer's sha won; every field on that single entry is internally
    // consistent (came from one writer's call, not a mix of two).
    expect(claims[0].sha).toMatch(/^sha-\d$/)
    expect(claims[0].nonce).toBe(`nonce-${claims[0].pid}`)

    // Registry file itself is well-formed JSON (no torn write ever
    // observable), and no .lock/.tmp-* artifacts were left behind.
    expect(() => readRegistry(registryPath)).not.toThrow()
    expect(readdirSync(path.dirname(registryPath))).toEqual(['runtimes.json'])
  })

  it('N concurrent starters registering DIFFERENT ids (task/review candidates coexisting, scenario N) never lose an unrelated id\'s entry', async () => {
    const ids = Array.from({ length: 6 }, (_, i) => runtimeId(i % 2 === 0 ? 'TASK_CANDIDATE' : 'REVIEW_CANDIDATE', `/worktrees/wt-${i}`))
    await Promise.all(ids.map((id, i) => runChild(CLAIM_WRITER, [registryPath, id, `sha-${i}`, '50'])))

    const claims = listClaims(registryPath)
    expect(claims).toHaveLength(ids.length)
    expect(new Set(claims.map((c) => c.id))).toEqual(new Set(ids))
  })
})
