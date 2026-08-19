// tools/runtime/vite-plugin-runtime-identity.ts
//
// Repo-owned Vite plugin implementing the Runtime Provenance Contract's
// identity endpoint: `GET /__runtime.json`, live only while a dev or
// preview server managed by this task's tooling (`runtime:main`,
// `runtime:candidate`, `dev:main`) is running.
//
// WHY A DEDICATED ENDPOINT, GATED BY AN ENV NONCE (not just "does the
// server answer"): verified live against a real, completely unmanaged
// `vite dev` — a plain `GET /__provenance.json` (a different path, same
// class of probe as the build-mode sidecar `tests/browser/run-desktop-
// smoke.mjs` already uses) answers HTTP 200 with `Content-Type: text/html`
// (Vite's SPA fallback serving `index.html`). HTTP 200 identifies nothing.
// This plugin therefore:
//   - answers ONLY when `A3_RUNTIME_NONCE` was present in THIS process's
//     own environment at startup (i.e. only when spawned by this task's
//     own tooling, which always sets it) — an unmanaged `npm run dev`
//     never looks managed, because it 404s on this path exactly like any
//     other unknown one;
//   - answers with `application/json` and echoes the nonce/sha/purpose the
//     spawning tooling injected, so a caller can tell "a real, freshly-
//     started copy of MY OWN claim" apart from a stale/foreign process that
//     happens to still occupy the same port/pid (classify.mjs treats a
//     nonce mismatch as FOREIGN_HOST, never as a pass).
//
// Registered via `configureServer` (dev) and `configurePreviewServer`
// (`vite preview`, used by tests/browser's build-mode smoke run) ONLY —
// never `transform`/`generateBundle` — so it has zero effect on `vite
// build` output; a production bundle never contains this endpoint at all.
//
// Must be TypeScript: `vite.config.ts` is inside `tsconfig.include` with
// `allowJs` off, so an untyped `.mjs` import here would silently break
// `npm run typecheck` for anyone editing vite.config.ts.

import type { Plugin, PreviewServer, ViteDevServer } from 'vite'

const RUNTIME_JSON_PATH = '/__runtime.json'

interface RuntimeIdentityPayload {
  purpose: string
  sha: string
  worktree: string
  nonce: string
  startedAt: string
}

/** Reads the identity this process was spawned with. `null` when
 *  `A3_RUNTIME_NONCE` is absent — the deliberate "unmanaged server" case. */
function readRuntimeIdentityEnv(): RuntimeIdentityPayload | null {
  const nonce = process.env.A3_RUNTIME_NONCE
  if (!nonce) return null
  return {
    nonce,
    purpose: process.env.A3_RUNTIME_PURPOSE ?? 'UNKNOWN',
    sha: process.env.A3_RUNTIME_SHA ?? 'UNKNOWN',
    worktree: process.env.A3_RUNTIME_WORKTREE ?? process.cwd(),
    startedAt: process.env.A3_RUNTIME_STARTED_AT ?? new Date().toISOString(),
  }
}

function installRuntimeIdentityMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? ''
    // Strip a query string, if any — `req.url` on Connect middleware is the
    // raw path+query, and a probe like `/__runtime.json?t=123` (cache-busting)
    // must still match.
    const pathname = url.split('?')[0]
    if (pathname !== RUNTIME_JSON_PATH) {
      next()
      return
    }

    const identity = readRuntimeIdentityEnv()
    if (!identity) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'not a managed runtime (no A3_RUNTIME_NONCE in this process\'s environment)' }))
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(identity))
  })
}

export function runtimeIdentityPlugin(): Plugin {
  return {
    name: 'a3-runtime-identity',
    configureServer(server) {
      installRuntimeIdentityMiddleware(server)
    },
    configurePreviewServer(server) {
      installRuntimeIdentityMiddleware(server)
    },
  }
}
