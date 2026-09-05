/**
 * The GENERATED pipeline must call the forward-only guard.
 *
 * `update_argo_tag` writes this pipeline's `$VERSION` into the `imageTag` of
 * `apps/sales-configurator/values.yaml` in the gitops repo. It used to do that
 * without ever reading the tag already there, so re-running an old pipeline
 * rewound production's desired state, silently, with the job green. It fired:
 * argo commit `4ad8fff` moved imageTag 1.0.57 -> 1.0.52 (incident
 * REL-RECOVERY-02).
 *
 * WHY THE TEST LIVES HERE AND ASSERTS ON `.gitlab-ci.yml`.
 * A guard merged into this repository is worthless if the generated pipeline
 * does not call it. That is not a hypothesis: the guard was merged twice
 * (`2af1f55` v1.0.58, `fe616aa` v1.0.60) and reverted twice by the generator
 * (`af4c8a4`, `968a02e`), and every unit test in this repo stayed green through
 * both. So this file tests the artefact that actually runs — it extracts the
 * guard out of the pipeline, executes THAT copy, and replays the incident
 * through it.
 *
 * WHERE THE IMPLEMENTATION LIVES.
 * `.gitlab-ci.yml` is machine-generated ("# Managed by inari") and
 * overwrite-on-drift: a hand edit here is reverted within ~20 minutes. The one
 * authoritative implementation is inari's `templates/argo-tag-guard.sh`, emitted
 * inline into the pipeline it generates (`devops/tools/inari!1`). This repo
 * deliberately keeps no second copy of the guard: a local reference would have
 * to be re-synced by hand on every generator change, and an alarm that goes off
 * for stale-copy reasons stops being read.
 *
 * THIS FILE IS RED ON MASTER BY DESIGN until that MR merges and the next inari
 * tick regenerates `.gitlab-ci.yml`. The red IS the finding: the production
 * downgrade is still reachable. Do not skip it, do not delete it, and do not
 * re-apply the guard to this repo — that only feeds the revert loop.
 */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const CI = readFileSync(join(REPO, '.gitlab-ci.yml'), 'utf8')

const IMAGE = 'docker.core.funkflow.com/vibe-apps_sales-configurator'
const HEREDOC_OPEN = "<<'ARGO_TAG_GUARD_EOF'"
const HEREDOC_CLOSE = 'ARGO_TAG_GUARD_EOF'

/**
 * One top-level block, verbatim. Hand-parsed on purpose: this repo has no YAML
 * parser in node_modules and the guard must not cost it a dependency.
 */
function block(name) {
  const lines = CI.split('\n')
  const start = lines.findIndex((l) => l === `${name}:`)
  if (start === -1) return []
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] !== '' && !/^\s/.test(lines[i])) { end = i; break }
  }
  return lines.slice(start, end)
}

/** Every line the runner executes for a job, `extends:` followed. */
function effective(name) {
  const own = block(name)
  expect(own.length, `no ${name} job in .gitlab-ci.yml`).toBeGreaterThan(0)
  const parents = own
    .filter((l) => /^\s*(-\s*)?extends:/.test(l) || /^\s*-\s+\.\w/.test(l))
    .map((l) => l.replace(/^\s*(-\s*)?extends:\s*/, '').replace(/^\s*-\s+/, '').trim())
    .filter((p) => p.startsWith('.'))
  return [...parents.flatMap((p) => block(p)), ...own]
}

const indexOf = (lines, re) => lines.findIndex((l) => re.test(l))

/** The guard as the job would write it: heredoc body, dedented by its block indent. */
function embeddedGuard(lines) {
  const open = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
  expect(open, 'the job emits no argo-tag guard heredoc').toBeGreaterThan(-1)
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

/** Run the guard AS EMBEDDED IN THE PIPELINE. */
function runEmbeddedGuard(current, version, { args = [], env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'argo-ci-guard-'))
  try {
    const guard = join(dir, 'argo-tag-guard.sh')
    const values = join(dir, 'values.yaml')
    writeFileSync(guard, embeddedGuard(effective('update_argo_tag')))
    writeFileSync(values, valuesYaml(current))
    const before = readFileSync(values)
    const r = spawnSync('sh', [guard, values, IMAGE, version, ...args], {
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
    const lines = effective('update_argo_tag')
    const emit = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
    const call = indexOf(lines, /^\s*-\s+sh\b.*argo-tag-guard\.sh/)
    const add = indexOf(lines, /^\s*-\s+git add\b/)
    const commit = indexOf(lines, /^\s*-\s+git commit\b/)
    expect(emit, 'no guard emitted').toBeGreaterThan(-1)
    expect(call, 'guard is emitted but never invoked').toBeGreaterThan(emit)
    expect(add).toBeGreaterThan(call)
    expect(commit).toBeGreaterThan(add)
  })

  it('commits nothing when the guard leaves the file unchanged', () => {
    const lines = effective('update_argo_tag')
    const call = indexOf(lines, /^\s*-\s+sh\b.*argo-tag-guard\.sh/)
    const skip = lines.findIndex((l) => l.includes('git diff --quiet') && l.includes('exit 0'))
    const add = indexOf(lines, /^\s*-\s+git add\b/)
    expect(skip, 'no "nothing to commit" short-circuit').toBeGreaterThan(call)
    expect(add).toBeGreaterThan(skip)
  })

  it('no longer writes imageTag with an unguarded sed', () => {
    const lines = effective('update_argo_tag')
    const open = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
    const close = lines.findIndex((l, i) => i > open && l.trim() === HEREDOC_CLOSE)
    lines.forEach((line, i) => {
      if (open > -1 && i > open && i < close) return // the guard's own comments discuss sed
      expect(line, `unguarded imageTag write: ${line}`).not.toMatch(/sed -i\b.*imageTag/)
    })
  })

  it('still names itself as inari-managed, so drift here means the generator changed', () => {
    expect(CI.startsWith('# Managed by inari.')).toBe(true)
  })
})

describe('.gitlab-ci.yml: only a deliberate, manual job may move the tag backwards', () => {
  it('the automatic release job has no path to a backwards write', () => {
    const lines = effective('update_argo_tag')
    const open = lines.findIndex((l) => l.includes(HEREDOC_OPEN))
    const close = lines.findIndex((l, i) => i > open && l.trim() === HEREDOC_CLOSE)
    lines.forEach((line, i) => {
      if (open > -1 && i > open && i < close) return
      expect(line, `release job can authorise a rollback: ${line}`).not.toContain('--allow-rollback')
    })
  })

  it('a rollback job exists, is manual, and names the tag it restores', () => {
    const own = block('rollback_argo_tag')
    expect(own.length, 'no rollback_argo_tag job — the guard has no authorised escape hatch').toBeGreaterThan(0)
    expect(own.some((l) => /when:\s*manual/.test(l)), 'rollback job is not manual').toBe(true)
    const lines = effective('rollback_argo_tag')
    const require = indexOf(lines, /ARGO_TAG_ROLLBACK_TO.*exit 1/)
    const call = indexOf(lines, /^\s*-\s+sh\b.*argo-tag-guard\.sh/)
    expect(require, 'rollback runs without requiring a named target tag').toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(require)
    expect(lines[call]).toContain('--allow-rollback')
  })
})

describe('.gitlab-ci.yml: replaying the incident through the embedded guard', () => {
  it('4ad8fff: desired state 1.0.57, a re-run pipeline carrying 1.0.52 — file untouched', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.52')
    expect(r.status).toBe(0)
    expect(r.after.equals(r.before), 'values.yaml was rewound').toBe(true)
    expect(r.stderr).toContain('REFUSED')
  })

  it('no ambient variable can rescue that re-run', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.52', { env: { ARGO_TAG_ALLOW_ROLLBACK: '1' } })
    expect(r.after.equals(r.before), 'an environment variable authorised a downgrade').toBe(true)
    expect(r.stderr).toContain('REFUSED')
  })

  it('a real release still lands', () => {
    expect(runEmbeddedGuard('1.0.57', '1.0.58').text).toContain('imageTag: 1.0.58')
  })

  it('re-running the current release commits nothing', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.57')
    expect(r.after.equals(r.before)).toBe(true)
    expect(r.stdout).toContain('NOOP')
  })

  it('1.0.9 -> 1.0.10 is a forward move, not a lexicographic rollback', () => {
    expect(runEmbeddedGuard('1.0.9', '1.0.10').text).toContain('imageTag: 1.0.10')
  })

  it('a malformed version is refused rather than coerced to zero', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.x')
    expect(r.status).toBe(1)
    expect(r.after.equals(r.before)).toBe(true)
  })

  it('an explicitly authorised rollback is still possible', () => {
    const r = runEmbeddedGuard('1.0.57', '1.0.52', { args: ['--allow-rollback'] })
    expect(r.text).toContain('imageTag: 1.0.52')
    expect(r.stdout).toContain('ROLLBACK')
  })
})
