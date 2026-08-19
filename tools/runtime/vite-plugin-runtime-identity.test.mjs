// tools/runtime/vite-plugin-runtime-identity.test.mjs
//
// Unit tests for the runtime-identity Vite plugin's middleware behavior,
// against a fake Connect-shaped server object (no real Vite dev server
// needed for these — the real, end-to-end "does a genuine `vite dev`
// actually serve this" proof lives in
// tools/runtime/lib/runtime-lifecycle.integration.test.mjs).
//
// "Absent from vite build output" is proven STRUCTURALLY, not by running a
// real build: Vite only ever invokes a plugin hook that the plugin object
// actually defines, and this plugin defines ONLY `name`, `configureServer`,
// `configurePreviewServer` — no `transform`/`generateBundle`/`buildStart`/
// any other build-lifecycle hook exists on it at all, so it is structurally
// incapable of touching a production bundle.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runtimeIdentityPlugin } from './vite-plugin-runtime-identity.ts'

const ENV_KEYS = ['A3_RUNTIME_NONCE', 'A3_RUNTIME_PURPOSE', 'A3_RUNTIME_SHA', 'A3_RUNTIME_WORKTREE', 'A3_RUNTIME_STARTED_AT']
let savedEnv

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

/** A minimal fake Connect-shaped server: captures the one middleware the
 *  plugin registers, and exposes a way to invoke it directly. */
function fakeServer() {
  let handler = null
  return {
    middlewares: { use: (fn) => { handler = fn } },
    invoke: (req) => {
      let statusCode = null
      const headers = {}
      let body = null
      let nextCalled = false
      const res = {
        get statusCode() { return statusCode },
        set statusCode(v) { statusCode = v },
        setHeader: (k, v) => { headers[k] = v },
        end: (b) => { body = b },
      }
      handler(req, res, () => { nextCalled = true })
      return { statusCode, headers, body, nextCalled }
    },
  }
}

describe('runtimeIdentityPlugin', () => {
  it('is structurally absent from the build pipeline: only server-hook fields exist on the plugin object', () => {
    const plugin = runtimeIdentityPlugin()
    expect(plugin.name).toBe('a3-runtime-identity')
    expect(typeof plugin.configureServer).toBe('function')
    expect(typeof plugin.configurePreviewServer).toBe('function')
    const buildHooks = ['transform', 'generateBundle', 'buildStart', 'buildEnd', 'renderChunk', 'load', 'resolveId', 'transformIndexHtml']
    for (const hook of buildHooks) expect(plugin[hook]).toBeUndefined()
  })

  it('calls next() for any path other than /__runtime.json (unmanaged requests pass through untouched)', () => {
    const server = fakeServer()
    runtimeIdentityPlugin().configureServer(server)
    const result = server.invoke({ url: '/index.html' })
    expect(result.nextCalled).toBe(true)
    expect(result.statusCode).toBeNull()
  })

  it('404s on /__runtime.json when A3_RUNTIME_NONCE is absent — the "unmanaged npm run dev never looks managed" contract', () => {
    const server = fakeServer()
    runtimeIdentityPlugin().configureServer(server)
    const result = server.invoke({ url: '/__runtime.json' })
    expect(result.statusCode).toBe(404)
    expect(result.nextCalled).toBe(false)
  })

  it('answers application/json with the injected identity when A3_RUNTIME_NONCE is present', () => {
    process.env.A3_RUNTIME_NONCE = 'nonce-123'
    process.env.A3_RUNTIME_PURPOSE = 'CURRENT_MAIN'
    process.env.A3_RUNTIME_SHA = 'deadbeef'
    process.env.A3_RUNTIME_WORKTREE = '/preview/main'
    process.env.A3_RUNTIME_STARTED_AT = '2026-01-01T00:00:00.000Z'

    const server = fakeServer()
    runtimeIdentityPlugin().configureServer(server)
    const result = server.invoke({ url: '/__runtime.json' })

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(result.body)).toEqual({
      nonce: 'nonce-123',
      purpose: 'CURRENT_MAIN',
      sha: 'deadbeef',
      worktree: '/preview/main',
      startedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('strips a query string before matching the path (cache-busting probes still hit the endpoint)', () => {
    process.env.A3_RUNTIME_NONCE = 'nonce-123'
    const server = fakeServer()
    runtimeIdentityPlugin().configureServer(server)
    const result = server.invoke({ url: '/__runtime.json?t=123' })
    expect(result.statusCode).toBe(200)
  })

  it('registers on configurePreviewServer too (vite preview, used by the build-mode smoke runner)', () => {
    process.env.A3_RUNTIME_NONCE = 'nonce-preview'
    const server = fakeServer()
    runtimeIdentityPlugin().configurePreviewServer(server)
    const result = server.invoke({ url: '/__runtime.json' })
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).nonce).toBe('nonce-preview')
  })
})
