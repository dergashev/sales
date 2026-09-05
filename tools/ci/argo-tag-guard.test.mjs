import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GUARD = fileURLToPath(new URL('./argo-tag-guard.sh', import.meta.url))
const IMAGE = 'docker.core.funkflow.com/vibe-apps_sales-configurator'

/** The real shape of apps/sales-configurator/values.yaml in sales-configurator-argo. */
const valuesYaml = (tag) => `# Seeded by inari. CI bumps imageTag in this file; edit other fields freely.
# Values for nxs-universal-chart v1.0.25.

deployments:
  sales-configurator:
    replicas: 1
    containers:
      - name: sales-configurator
        image: ${IMAGE}
        imageTag: ${tag}
        ports:
          - name: http
            containerPort: 8080
`

function run(currentTag, newVersion, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'argo-tag-guard-'))
  const file = join(dir, 'values.yaml')
  writeFileSync(file, valuesYaml(currentTag))
  const p = spawnSync('/bin/sh', [GUARD, file, IMAGE, newVersion], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  const { status: code, stdout, stderr } = p
  const after = readFileSync(file, 'utf8')
  const tag = after.match(/imageTag:\s*(\S+)/)?.[1]
  return { code, stdout, stderr, tag, after }
}

describe('argo-tag-guard: the argo_tagging write is forward-only', () => {
  it('reproduces incident REL-RECOVERY-02 and refuses it: 1.0.57 is not rewound to 1.0.52', () => {
    // Commit 4ad8fff did exactly this on 2026-09-05T09:05:54Z and went green.
    const r = run('1.0.57', '1.0.52')
    expect(r.tag).toBe('1.0.57')
    expect(r.code).toBe(0)
    expect(r.stderr).toMatch(/REFUSED/)
  })

  it('leaves the file byte-identical when it refuses', () => {
    const r = run('1.0.57', '1.0.52')
    expect(r.after).toBe(valuesYaml('1.0.57'))
  })

  it('still performs a genuine forward release', () => {
    const r = run('1.0.57', '1.0.58')
    expect(r.tag).toBe('1.0.58')
    expect(r.stdout).toMatch(/UPDATED 1\.0\.57 -> 1\.0\.58/)
  })

  it('rewrites only the imageTag line', () => {
    const r = run('1.0.57', '1.0.58')
    expect(r.after).toBe(valuesYaml('1.0.58'))
  })

  it('is a no-op when the desired state already names this version', () => {
    const r = run('1.0.57', '1.0.57')
    expect(r.tag).toBe('1.0.57')
    expect(r.stdout).toMatch(/NOOP/)
  })

  it('orders fields numerically, not lexicographically (1.0.9 -> 1.0.10 is forward)', () => {
    // A string compare calls "1.0.10" < "1.0.9" and would refuse a real release.
    expect(run('1.0.9', '1.0.10').tag).toBe('1.0.10')
    expect(run('1.0.10', '1.0.9').tag).toBe('1.0.10')
  })

  it('compares across minor/major, not just patch', () => {
    expect(run('1.0.57', '1.1.0').tag).toBe('1.1.0')
    expect(run('1.1.0', '1.0.99').tag).toBe('1.1.0')
    expect(run('2.0.0', '1.9.9').tag).toBe('2.0.0')
  })

  it('allows a deliberate rollback through the documented escape hatch', () => {
    const r = run('1.0.57', '1.0.52', { ARGO_TAG_ALLOW_ROLLBACK: '1' })
    expect(r.tag).toBe('1.0.52')
    expect(r.stdout).toMatch(/ROLLBACK 1\.0\.57 -> 1\.0\.52/)
  })

  it('fails loudly (exit 1) when the values file has no matching image line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'argo-tag-guard-'))
    const file = join(dir, 'values.yaml')
    writeFileSync(file, 'deployments: {}\n')
    let code = 0
    try {
      execFileSync('/bin/sh', [GUARD, file, IMAGE, '1.0.58'], { stdio: 'pipe' })
    } catch (e) { code = e.status }
    expect(code).toBe(1)
  })

  it('fails loudly (exit 1) when the values file does not exist', () => {
    let code = 0
    try {
      execFileSync('/bin/sh', [GUARD, '/nonexistent/values.yaml', IMAGE, '1.0.58'], { stdio: 'pipe' })
    } catch (e) { code = e.status }
    expect(code).toBe(1)
  })
})
