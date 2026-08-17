// tools/gate/lib/runtime.mjs
//
// Reports which node/npm/python3 the gate is actually about to use, so
// "VALIDATION PROVENANCE" is never just an unverifiable claim. The
// resolution of WHICH node runtime is used happens in gate.sh (shell,
// because it has to run before Node exists at all); this module only
// reports on the runtime the current Node process is already in.

import { spawnSync } from 'node:child_process'

function version(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: process.env })
  if (result.error || result.status !== 0) return null
  return result.stdout.trim() || result.stderr.trim() || null
}

export function resolveRuntimeReport(cwd) {
  const npmVersion = version('npm', ['--version'], cwd)
  const pythonVersion = version('python3', ['--version'], cwd)
  return {
    node: `node ${process.version} (${process.execPath})`,
    npm: npmVersion ? `npm ${npmVersion}` : null,
    npmAvailable: npmVersion !== null,
    python: pythonVersion ? pythonVersion.replace(/^Python /, 'python3 ') : null,
    pathSource: process.env.A3_GATE_PATH_SOURCE || 'unset (gate.mjs invoked without going through gate.sh)',
  }
}

/** Diagnostic only (Architecture note): surfaces whatever candidate-shaped
 *  env vars the vendor process actually injected, so a first real run can
 *  answer whether any of them could become a primary provenance channel.
 *  Never used for a pass/fail decision — declarative, not authoritative. */
export function observedVendorEnvKeys() {
  return Object.keys(process.env)
    .filter((k) => /^(A3_|AGENTSROOM_|TEAM_)/.test(k))
    .sort()
}
