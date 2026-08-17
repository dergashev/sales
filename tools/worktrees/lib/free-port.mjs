// tools/worktrees/lib/free-port.mjs
//
// Minimal free-TCP-port lookup for the local-main preview server: bind an
// ephemeral listener on 127.0.0.1, read back the OS-assigned port, close it
// immediately, and hand that number to the real `npm run dev` invocation.
// There is a narrow race between the close and the real server's bind, but
// that is the same trade-off every "let the OS pick a port" tool accepts —
// this is a local developer convenience command, not a concurrency-hardened
// service allocator.

import { createServer } from 'node:net'

export function findFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, host, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}
