/**
 * The GENERATED pipeline must still call the forward-only guard.
 *
 * This is the check whose absence let incident REL-RECOVERY-02 regress.
 * `tools/ci/argo-tag-guard.sh` was written, tested and merged during the
 * incident (2af1f55, v1.0.58) — and then `af4c8a4` ("ci: bootstrap
 * .gitlab-ci.yml [inari]") overwrote `.gitlab-ci.yml`, restored the unguarded
 * `sed -i`, and orphaned the script. Ten green unit tests said nothing,
 * because none of them looked at the pipeline.
 *
 * So this file asserts against `.gitlab-ci.yml` itself: that `update_argo_tag`
 * carries the guard, that the copy it carries is byte-identical to the
 * reference here, and that replaying the `4ad8fff` downgrade through THAT copy
 * leaves the values file untouched.
 *
 * `.gitlab-ci.yml` is machine-generated ("# Managed by inari") and is
 * overwrite-on-drift: the durable fix lives in inari's own
 * `templates/gitlab-ci.yml.j2` + `templates/argo-tag-guard.sh`
 * (devops/tools/inari!1). This file is the tripwire for the day that changes.
 */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const CI = readFileSync(join(REPO, '.gitlab-ci.yml'), 'utf8')
const REFERENCE_GUARD = readFileSync(join(REPO, 'tools/ci/argo-tag-guard.sh'), 'utf8')

const IMAGE = 'docker.core.funkflow.com/vibe-apps_sales-configurator'
const HEREDOC_OPEN = "<<'ARGO_TAG_GUARD_EOF'"
const HEREDOC_CLOSE = 'ARGO_TAG_GUARD_EOF'

/** The `update_argo_tag:` job block, verbatim, without parsing the whole file. */
function jobBlock() {
  const lines = CI.split('\n')
  const start = lines.findIndex((l) => l === 'update_argo_tag:')
  expect(start, 'no update_argo_tag job in .gitlab-ci.yml').toBeGreaterThan(-1)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] !== '' && !/^\s/.test(lines[i])) { end = i; break }
  }
  return lines.slice(start, end)
}

/** The guard as the job would write it: heredoc body, dedented by the YAML block indent. */
function embeddedGuard() {
  const lines = jobBlock()
  const open = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
  expect(open, 'update_argo_tag emits no argo-tag guard heredoc').toBeGreaterThan(-1)
  const close = lines.findIndex((l, i) => i > open && l.trim() === HEREDOC_CLOSE)
  expect(close, 'unterminated argo-tag guard heredoc').toBeGreaterThan(open)
  const body = lines.slice(open + 1, close)
  const indent = body[0].length - body[0].trimStart().length
  return body.map((l) => (l.length >= indent ? l.slice(indent) : l)).join('\n') + '\n'
}

const valuesYaml = (tag) =>
  'deployments:\n' +
  '  sales-configurator:\n' +
  '    containers:\n' +
  '      - name: sales-configurator\n' +
  `        image: ${IMAGE}\n` +
  `        imageTag: ${tag}\n`

/** Run the guard AS EMBEDDED IN THE PIPELINE, not the reference copy. */
function runEmbeddedGuard(current, version, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'argo-ci-guard-'))
  try {
    const guard = join(dir, 'argo-tag-guard.sh')
    const values = join(dir, 'values.yaml')
    writeFileSync(guard, embeddedGuard())
    writeFileSync(values, valuesYaml(current))
    const before = readFileSync(values)
    const r = spawnSync('sh', [guard, values, IMAGE, version], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    })
    return {
      status: r.status,
      stdout: String(r.stdout ?? ''),
      stderr: String(r.stderr ?? ''),
      before,
      after: readFileSync(values),
      text: readFileSync(values, 'utf8'),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('.gitlab-ci.yml: the argo_tagging write is guarded in the pipeline itself', () => {
  it('carries the guard and calls it before staging the values file', () => {
    const lines = jobBlock()
    const emit = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
    const call = lines.findIndex((l) => /^\s*-\s+sh\b.*argo-tag-guard\.sh/.test(l))
    const add = lines.findIndex((l) => /^\s*-\s+git add\b/.test(l))
    const commit = lines.findIndex((l) => /^\s*-\s+git commit\b/.test(l))
    expect(emit, 'no guard emitted').toBeGreaterThan(-1)
    expect(call, 'guard is emitted but never invoked').toBeGreaterThan(emit)
    expect(add).toBeGreaterThan(call)
    expect(commit).toBeGreaterThan(add)
  })

  it('commits nothing when the guard leaves the file unchanged', () => {
    const lines = jobBlock()
    const call = lines.findIndex((l) => /^\s*-\s+sh\b.*argo-tag-guard\.sh/.test(l))
    const skip = lines.findIndex((l) => l.includes('git diff --quiet') && l.includes('exit 0'))
    const add = lines.findIndex((l) => /^\s*-\s+git add\b/.test(l))
    expect(skip, 'no "nothing to commit" short-circuit').toBeGreaterThan(call)
    expect(add).toBeGreaterThan(skip)
  })

  it('no longer writes imageTag with an unguarded sed', () => {
    const lines = jobBlock()
    const open = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
    const close = lines.findIndex((l, i) => i > open && l.trim() === HEREDOC_CLOSE)
    lines.forEach((line, i) => {
      if (i > open && i < close) return // the guard's own comments discuss sed
      expect(line, `unguarded imageTag write: ${line}`).not.toMatch(/sed -i\b.*imageTag/)
    })
  })

  it('embeds exactly the reference guard, byte for byte', () => {
    expect(embeddedGuard()).toBe(REFERENCE_GUARD)
  })

  it('still names itself as inari-managed, so drift here means the generator changed', () => {
    expect(CI.startsWith('# Managed by inari.')).toBe(true)
  })
})

describe('.gitlab-ci.yml: replaying the incident through the embedded guard', () => {
  it('4ad8fff: desired state 1.0.57, a re-run pipeline carrying 1.0.52 — file untouched', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.52')
    expect(r.status).toBe(0)
    expect(r.after.equals(r.before), 'values.yaml was rewound').toBe(true)
    expect(r.stderr).toContain('REFUSED')
  })

  it('a real release still lands', () => {
    expect(runEmbeddedGuard('1.0.57', '1.0.58').text).toContain('imageTag: 1.0.58')
  })

  it('1.0.9 -> 1.0.10 is a forward move, not a lexicographic rollback', () => {
    expect(runEmbeddedGuard('1.0.9', '1.0.10').text).toContain('imageTag: 1.0.10')
  })

  it('an authorised rollback is still possible', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.52', { ARGO_TAG_ALLOW_ROLLBACK: '1' })
    expect(r.text).toContain('imageTag: 1.0.52')
  })
})
