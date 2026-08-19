#!/usr/bin/env node
// tools/runtime/lib/test-fixtures/fake-vite-dev.mjs
//
// Committed onto the throwaway git repositories
// runtime-lifecycle.integration.test.mjs builds, as that fixture project's
// `npm run dev` script. Implements the EXACT SAME wire contract as the
// real tools/runtime/vite-plugin-runtime-identity.ts — GET /__runtime.json
// answers 404 without A3_RUNTIME_NONCE, application/json with it — using a
// plain node:http server instead of real Vite, so these integration tests
// exercise `runtime:main`'s own orchestration (registry, classification,
// rotation, spawn, readiness poll) quickly and without needing a full
// `npm install` of Vite inside every throwaway fixture repository.
//
// The REAL plugin's actual behavior is separately verified against a real
// `vite dev` process by the "real Vite end-to-end" test in this same file.
//
// argv (npm passes vite-style flags through after `--`, which is exactly
// how tools/runtime/main.mjs invokes it): --host <h> --port <p> --strictPort

import { createServer } from 'node:http'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = Number(args[portIdx + 1])
const hostIdx = args.indexOf('--host')
const host = hostIdx >= 0 ? args[hostIdx + 1] : '127.0.0.1'

const server = createServer((req, res) => {
  const pathname = (req.url || '').split('?')[0]
  if (pathname !== '/__runtime.json') {
    res.statusCode = 404
    res.end()
    return
  }
  const nonce = process.env.A3_RUNTIME_NONCE
  if (!nonce) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'not a managed runtime' }))
    return
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(
    JSON.stringify({
      nonce,
      purpose: process.env.A3_RUNTIME_PURPOSE ?? 'UNKNOWN',
      sha: process.env.A3_RUNTIME_SHA ?? 'UNKNOWN',
      worktree: process.env.A3_RUNTIME_WORKTREE ?? process.cwd(),
      startedAt: process.env.A3_RUNTIME_STARTED_AT ?? new Date().toISOString(),
    }),
  )
})

server.listen(port, host)
