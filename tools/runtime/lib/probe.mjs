// tools/runtime/lib/probe.mjs
//
// The one place that actually performs `GET /__runtime.json` over HTTP.
// Kept separate from classify.mjs (which stays a pure function of an
// already-fetched `echo` result) so the full classification truth table is
// unit-testable without a real network call, while this thin wrapper is
// exercised by the hermetic real-dev-server integration test.

/**
 * @param {string} url - base url, e.g. "http://127.0.0.1:63767"
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<{ok:boolean, contentType:string|null, sha?:string|null, purpose?:string|null, nonce?:string|null, worktree?:string|null, startedAt?:string|null}>}
 */
export async function probeRuntimeEcho(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 2000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(new URL('/__runtime.json', url), { signal: controller.signal })
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim() || null
    if (!res.ok) return { ok: false, contentType }
    if (contentType !== 'application/json') {
      // The exact "unmanaged dev server's SPA fallback" case: HTTP 200,
      // text/html. Do not attempt to parse it as JSON — report the
      // content-type so classify.mjs can name the reason precisely.
      return { ok: true, contentType }
    }
    const body = await res.json()
    return {
      ok: true,
      contentType,
      sha: body.sha ?? null,
      purpose: body.purpose ?? null,
      nonce: body.nonce ?? null,
      worktree: body.worktree ?? null,
      startedAt: body.startedAt ?? null,
    }
  } catch {
    return { ok: false, contentType: null }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Polls `GET /__runtime.json` until it answers with the expected nonce, or
 * `timeoutMs` elapses. Never a fixed sleep-then-hope: readiness is defined
 * as "the live server actually echoes back THIS run's own nonce", not
 * "the port accepted a TCP connection" (which a stale/foreign process could
 * also satisfy).
 *
 * @param {string} url
 * @param {string} expectedNonce
 * @param {{timeoutMs?:number, intervalMs?:number}} [opts]
 * @returns {Promise<{ok:boolean, echo:object|null}>}
 */
export async function waitForRuntimeReady(url, expectedNonce, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 20_000
  const intervalMs = opts.intervalMs ?? 150
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const echo = await probeRuntimeEcho(url, { timeoutMs: Math.min(2000, timeoutMs) })
    if (echo.ok && echo.contentType === 'application/json' && echo.nonce === expectedNonce) {
      return { ok: true, echo }
    }
    if (Date.now() >= deadline) return { ok: false, echo }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
