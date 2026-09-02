// tools/delivery/dockerfile-prepare-lifecycle.test.mjs
//
// CI-HOTFIX-01 REGRESSION GUARD — the production Docker dependency layer
// must be able to run every npm lifecycle script `npm ci` executes.
//
// The concrete defect: `package.json` gained a `prepare` lifecycle script
// (`node tools/git-hooks/install.mjs`, DELIVERY-INFRA-01) while the
// Dockerfile still did
//
//   COPY package.json package-lock.json ./
//   RUN npm ci
//   COPY . .
//
// so inside the image `npm ci` ran `prepare` before the repository had been
// copied and failed deterministically with
// `Cannot find module '/app/tools/git-hooks/install.mjs'` (MODULE_NOT_FOUND).
// Every master pipeline from v1.0.41 to v1.0.46 failed in build_docker and
// production stayed on 1.0.40.
//
// Two complementary checks, kept cheap (no `npm ci`, no Docker daemon):
//
//   STATIC  — parse the Dockerfile's build stage and prove every repository
//             file an install-time lifecycle script references is COPYed
//             into the image BEFORE `RUN npm ci`, and is not excluded from
//             the build context by `.dockerignore`.
//   RUNTIME — materialise exactly the files the Dockerfile copies before
//             `npm ci` into an empty directory (no `.git`, like the image)
//             and run each lifecycle script command there: it must exit 0.
//             A negative control runs the same command in the PRE-FIX layer
//             shape (manifests only) and must fail with MODULE_NOT_FOUND —
//             proving this guard actually detects the original defect.

import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

/** npm lifecycle scripts that `npm ci` / `npm install` run for the ROOT
 *  package inside the dependency layer (npm docs → "Life Cycle Scripts"). */
const INSTALL_LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare']

// ── Dockerfile parsing ─────────────────────────────────────────────────

/** Minimal Dockerfile reader: joins `\` continuations, drops comments and
 *  blank lines, returns `{ instruction, args, line }` in order. */
function parseDockerfile(text) {
  const out = []
  const lines = text.split('\n')
  let buffer = null
  let startLine = 0
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (buffer === null) {
      if (trimmed === '' || trimmed.startsWith('#')) continue
      buffer = ''
      startLine = i + 1
    } else if (trimmed.startsWith('#')) {
      continue // comment inside a continuation
    }
    if (trimmed.endsWith('\\')) {
      buffer += trimmed.slice(0, -1) + ' '
      continue
    }
    buffer += trimmed
    const match = buffer.match(/^(\S+)\s*(.*)$/s)
    if (match) out.push({ instruction: match[1].toUpperCase(), args: match[2].trim(), line: startLine })
    buffer = null
  }
  return out
}

/** Instructions of the FIRST stage only (up to the next FROM) — the
 *  dependency layer lives in the build stage. */
function buildStageOf(instructions) {
  const first = instructions.findIndex((i) => i.instruction === 'FROM')
  if (first < 0) return []
  const next = instructions.findIndex((i, idx) => idx > first && i.instruction === 'FROM')
  return instructions.slice(first, next < 0 ? undefined : next)
}

/** COPY sources (relative to the build context) that precede the first
 *  `RUN npm ci` of the build stage. `--from=` copies do not come from the
 *  build context and are ignored. */
function contextSourcesCopiedBeforeNpmCi(stage) {
  const sources = []
  let npmCi = null
  for (const instr of stage) {
    if (instr.instruction === 'RUN' && /\bnpm\s+ci\b/.test(instr.args)) {
      npmCi = instr
      break
    }
    if (instr.instruction !== 'COPY' && instr.instruction !== 'ADD') continue
    const tokens = instr.args.split(/\s+/).filter(Boolean)
    if (tokens.some((t) => t.startsWith('--from='))) continue
    const operands = tokens.filter((t) => !t.startsWith('--'))
    // last operand is the destination
    sources.push(...operands.slice(0, -1).map((s) => s.replace(/^\.\//, '')))
  }
  return { sources, npmCi }
}

function isCoveredByCopy(relFile, sources) {
  return sources.some((src) => {
    if (src === '.' || src === './' || src === '/') return true
    const norm = src.replace(/\/+$/, '')
    return relFile === norm || relFile.startsWith(`${norm}/`)
  })
}

// ── package.json lifecycle → repository files ──────────────────────────

/** Repository-relative file paths referenced by install-time lifecycle
 *  script commands (only tokens that resolve to an existing file). */
function lifecycleReferencedFiles(pkg) {
  const refs = []
  for (const name of INSTALL_LIFECYCLE_SCRIPTS) {
    const command = pkg.scripts?.[name]
    if (!command) continue
    for (const token of command.split(/\s+/)) {
      const candidate = token.replace(/^\.\//, '')
      if (!/^[\w.-]+(\/[\w.-]+)+$/.test(candidate)) continue // needs a path separator, no shell syntax
      const abs = path.join(repoRoot, candidate)
      if (existsSync(abs) && statSync(abs).isFile()) refs.push({ script: name, command, file: candidate })
    }
  }
  return refs
}

// ── .dockerignore ──────────────────────────────────────────────────────

// Conservative `.dockerignore` check: a file is excluded when a non-negated
// pattern names it, one of its parent directories, or (for double-star
// "any directory" patterns, e.g. the __pycache__ entry) its basename or a
// parent directory basename. Any other glob wildcard is treated as "does
// not match" — a false negative here surfaces in the RUNTIME check anyway.
// (Line comments on purpose: the double-star-slash sequence would close a
// block comment.)
function isDockerIgnored(relFile, patterns) {
  const segments = relFile.split('/')
  const prefixes = segments.map((_, i) => segments.slice(0, i + 1).join('/'))
  return patterns.some((p) => {
    if (p.startsWith('!')) return false
    const pattern = p.replace(/^\.\//, '').replace(/\/+$/, '')
    if (pattern.startsWith('**/')) {
      const name = pattern.slice(3)
      return !/[*?[]/.test(name) && segments.includes(name)
    }
    if (/[*?[]/.test(pattern)) return false
    return prefixes.includes(pattern)
  })
}

// ── fixtures ───────────────────────────────────────────────────────────

const dockerfile = parseDockerfile(readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8'))
const buildStage = buildStageOf(dockerfile)
const { sources: copiedBeforeNpmCi, npmCi } = contextSourcesCopiedBeforeNpmCi(buildStage)
const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const lifecycleFiles = lifecycleReferencedFiles(pkg)
const dockerignore = readFileSync(path.join(repoRoot, '.dockerignore'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

const tempDirs = []
function materialiseLayer(sources) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ci-hotfix-01-layer-'))
  tempDirs.push(dir)
  for (const src of sources) {
    const from = path.join(repoRoot, src === '.' ? '' : src)
    const to = path.join(dir, src === '.' ? '' : src)
    cpSync(from, to, {
      recursive: true,
      filter: (p) => !p.split(path.sep).some((seg) => seg === 'node_modules' || seg === '.git'),
    })
  }
  return dir
}
/** Run a lifecycle command the way npm does (through `sh`), inside `cwd`,
 *  with git discovery fenced so the temp dir can never be mistaken for a
 *  checkout (the image has no `.git` either — `.dockerignore`). */
function runLifecycle(command, cwd) {
  return spawnSync('sh', ['-c', command], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(cwd), GIT_DIR: undefined, GIT_WORK_TREE: undefined },
  })
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

// ── tests ──────────────────────────────────────────────────────────────

describe('CI-HOTFIX-01 — Docker dependency layer can run the npm install lifecycle', () => {
  it('the Dockerfile build stage installs dependencies with `RUN npm ci` (the layer this guard protects)', () => {
    expect(npmCi, 'no `RUN npm ci` found in the build stage — adjust this guard if the install mechanism changed deliberately').toBeTruthy()
  })

  it('package.json declares at least one install-time lifecycle script that references a repository file (guard is not vacuous)', () => {
    // If this ever becomes empty on purpose (prepare removed), the static
    // and runtime checks below pass trivially — this assertion makes that
    // change visible instead of silent.
    expect(lifecycleFiles.length).toBeGreaterThan(0)
  })

  for (const ref of lifecycleFiles) {
    it(`STATIC — "${ref.script}": ${ref.file} is COPYed into the image before RUN npm ci (Dockerfile:${npmCi?.line})`, () => {
      expect(
        isCoveredByCopy(ref.file, copiedBeforeNpmCi),
        `Dockerfile copies [${copiedBeforeNpmCi.join(', ')}] before "RUN npm ci", which does not include ${ref.file} ` +
          `referenced by the "${ref.script}" lifecycle script ("${ref.command}") — npm ci would fail with MODULE_NOT_FOUND inside the image.`,
      ).toBe(true)
    })

    it(`STATIC — "${ref.script}": ${ref.file} is not excluded from the build context by .dockerignore`, () => {
      expect(isDockerIgnored(ref.file, dockerignore)).toBe(false)
    })
  }

  it('RUNTIME — every install-time lifecycle command exits 0 in a context holding only what the Dockerfile copies before npm ci', () => {
    const layer = materialiseLayer(copiedBeforeNpmCi)
    expect(existsSync(path.join(layer, '.git'))).toBe(false)
    for (const script of INSTALL_LIFECYCLE_SCRIPTS) {
      const command = pkg.scripts?.[script]
      if (!command) continue
      const result = runLifecycle(command, layer)
      expect(result.status, `"${script}" ("${command}") failed in the dependency layer:\n${result.stderr}${result.stdout}`).toBe(0)
    }
  })

  it('RUNTIME negative control — the pre-fix layer shape (manifests only) still reproduces MODULE_NOT_FOUND, so this guard is alive', () => {
    const prepare = pkg.scripts?.prepare
    expect(prepare).toBeTruthy()
    const layer = materialiseLayer(['package.json', 'package-lock.json'])
    const result = runLifecycle(prepare, layer)
    expect(result.status).not.toBe(0)
    expect(`${result.stderr}${result.stdout}`).toMatch(/Cannot find module|MODULE_NOT_FOUND/)
  })
})
