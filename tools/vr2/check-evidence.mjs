#!/usr/bin/env node
// VR2-00 — Runtime visual gate.
//
// Validates a VR2 release-evidence manifest against the acceptance rules of
// docs/audit/vr2-visual-gate.md. The rule this enforces mechanically:
//
//   A VR2 ticket may NOT claim target adoption unless it attaches
//   provenance-verified, exact-SHA PRODUCT screenshots of the ticket's named
//   ordinary runtime route AND state at BOTH required viewports (1440x900 and
//   1280x800), IN EACH product locale (de, en), compared against a VO-T1 board
//   target article that actually resolves. Foundations / a design-system
//   specimen, Storybook, a test surface or a deep-only prototype route is not
//   an accepted consumer.
//
// This is deliberately NOT wired into `npm run verify` / CI: it gates a VR2
// *release acceptance* (run by the Pre-Release Scope & Target Acceptance
// Auditor / Release Engineer), not every commit. Run it explicitly:
//
//   node tools/vr2/check-evidence.mjs <evidence-manifest.json>
//   npm run vr2:gate -- <evidence-manifest.json>
//
// Exit code 0 = gate PASS, 1 = gate FAIL (or usage error).

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// The tool's own config sits next to the script. Evidence-referenced paths
// (the approved board, capture images) are relative to the CHECKOUT you run the
// gate in — its untracked artifacts/ live in the working tree you are gating,
// not necessarily next to this tool file (e.g. when the tool runs from a
// worktree). Resolve those against the cwd; override with VR2_REPO_ROOT.
const MANIFEST_PATH = resolve(HERE, 'route-state-manifest.json')
const REPO_ROOT = process.env.VR2_REPO_ROOT
  ? resolve(process.env.VR2_REPO_ROOT)
  : process.cwd()

const SHA_RE = /^[0-9a-f]{40}$/
const OK_PROVENANCE = new Set(['SERVING_VERIFIED', 'VERIFIED', 'PASS', 'CURRENT_MAIN_VERIFIED'])

function die(msg) {
  console.error(`vr2:gate — ${msg}`)
  process.exit(1)
}

const evidenceArg = process.argv[2]
if (!evidenceArg) {
  die('usage: node tools/vr2/check-evidence.mjs <evidence-manifest.json>')
}
const evidencePath = isAbsolute(evidenceArg) ? evidenceArg : resolve(process.cwd(), evidenceArg)
if (!existsSync(evidencePath)) die(`evidence manifest not found: ${evidencePath}`)

let manifest
let evidence
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
} catch (e) {
  die(`cannot read route/state manifest ${MANIFEST_PATH}: ${e.message}`)
}
try {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
} catch (e) {
  die(`cannot parse evidence manifest: ${e.message}`)
}

const REQUIRED_VIEWPORTS = manifest.requiredViewports
const REQUIRED_LOCALES = manifest.requiredLocales.map((l) => l.toLowerCase())
const SPECIMEN = new Set(manifest.specimenRoutes.map((r) => r.toLowerCase()))

// Resolve the approved board and the set of anchors it actually renders. The
// board generates its case articles as id="target-<id>" from the target data
// ids (id:'...'), so a reference only resolves if its anchor base id is one of
// those. This is what makes "target/current comparison" a real check rather
// than a non-empty-string check.
const boardRel = manifest.targetBoard
const boardAbs = boardRel ? resolve(REPO_ROOT, boardRel) : null
let boardAnchors = null
if (boardAbs && existsSync(boardAbs)) {
  const html = readFileSync(boardAbs, 'utf8')
  const ids = new Set()
  for (const m of html.matchAll(/id:\s*['"]([a-z0-9-]+)['"]/g)) ids.add(`target-${m[1]}`)
  boardAnchors = ids
}

const errors = []

// 1. Ticket must be a known VR2 ticket with a named ordinary route/state.
const ticket = evidence.ticket
const spec = ticket && manifest.tickets[ticket]
if (!ticket) errors.push('missing `ticket`')
else if (!spec) errors.push(`unknown ticket "${ticket}" — not in route-state-manifest.json`)

const allowedRoutes = spec ? new Set(spec.routes.map((r) => r.toLowerCase())) : new Set()
const allowedStates = spec ? new Set(spec.states) : new Set()
const allowedTargets = spec ? new Set(spec.targets || []) : new Set()

// 2. Exact-SHA provenance: implementationCommit === candidateRuntimeCommit.
const impl = evidence.implementationCommit
const cand = evidence.candidateRuntimeCommit
if (!SHA_RE.test(impl || '')) errors.push('`implementationCommit` must be a full 40-hex SHA')
if (!SHA_RE.test(cand || '')) errors.push('`candidateRuntimeCommit` must be a full 40-hex SHA')
if (SHA_RE.test(impl || '') && SHA_RE.test(cand || '') && impl !== cand) {
  errors.push(`candidateRuntimeCommit (${cand}) !== implementationCommit (${impl}) — the captured runtime is not the candidate`)
}
if (evidence.runtimeSha && evidence.runtimeSha !== cand) {
  errors.push(`runtimeSha (${evidence.runtimeSha}) !== candidateRuntimeCommit (${cand})`)
}

// 3. Runtime provenance must be verified.
if (!OK_PROVENANCE.has(String(evidence.provenance)) && evidence.provenanceVerified !== true) {
  errors.push(`provenance not verified — need provenance ∈ {${[...OK_PROVENANCE].join(', ')}} or provenanceVerified:true`)
}

// 4. Target/current comparison: every referenced target must (a) be one the
//    ticket owns and (b) resolve to a real board article.
function checkTargetRef(ref, where) {
  if (typeof ref !== 'string' || !ref.includes('#')) {
    errors.push(`${where} target "${ref}" must be "<board-file>#<anchor>"`)
    return
  }
  const [file, anchor] = ref.split('#')
  if (boardRel && !file.endsWith(boardRel.split('/').pop())) {
    errors.push(`${where} target file "${file}" is not the approved board (${boardRel})`)
  }
  const fileAbs = isAbsolute(file) ? file : resolve(REPO_ROOT, file)
  if (!existsSync(fileAbs)) errors.push(`${where} target board file not found: ${file}`)
  if (spec && !allowedTargets.has(anchor)) {
    errors.push(`${where} target "#${anchor}" is not a ${ticket} target (allowed: ${[...allowedTargets].join(', ')})`)
  }
  if (boardAnchors && !boardAnchors.has(anchor)) {
    errors.push(`${where} target "#${anchor}" does not resolve to a board article`)
  }
}
const topTargets = evidence.targets || (evidence.target ? [evidence.target] : [])
if (topTargets.length === 0) errors.push('missing `target` — target/current comparison requires the approved VO-T1 board anchor')
if (boardRel && !boardAbs) errors.push(`targetBoard "${boardRel}" is misconfigured`)
if (boardAbs && !existsSync(boardAbs)) errors.push(`approved board not found on disk: ${boardRel}`)
topTargets.forEach((t, i) => checkTargetRef(t, `target[${i}]`))

// 5. Captures: shape, no specimens, ordinary routes only, named state.
const captures = Array.isArray(evidence.captures) ? evidence.captures : []
if (captures.length === 0) errors.push('`captures` is empty — a specimen or claim without product runtime captures is rejected')

// Per-locale viewport matrix: locale -> set(viewport). Aggregating globally
// would let one locale pass while missing a required viewport.
const matrix = new Map() // locale -> Set(viewport)
let reducedMotionSeen = false

captures.forEach((c, i) => {
  const where = `captures[${i}]`
  for (const field of ['route', 'state', 'viewport', 'locale', 'image']) {
    if (c[field] === undefined || c[field] === null || c[field] === '') {
      errors.push(`${where} missing \`${field}\``)
    }
  }
  if (typeof c.reducedMotion !== 'boolean') {
    errors.push(`${where} missing boolean \`reducedMotion\``)
  }
  const route = String(c.route || '').toLowerCase()
  if (SPECIMEN.has(route)) {
    errors.push(`${where} route "${c.route}" is a design-system specimen — not an accepted product consumer`)
  } else if (spec && !allowedRoutes.has(route)) {
    errors.push(`${where} route "${c.route}" is not an ordinary runtime route of ${ticket} (allowed: ${[...allowedRoutes].join(', ')})`)
  }
  if (spec && c.state !== undefined && !allowedStates.has(c.state)) {
    errors.push(`${where} state "${c.state}" is not a declared state of ${ticket} (allowed: ${[...allowedStates].join(', ')})`)
  }
  // A per-capture target override, if present, must resolve too.
  if (c.target) checkTargetRef(c.target, where)
  if (c.viewport && c.locale) {
    const loc = String(c.locale).toLowerCase()
    if (!matrix.has(loc)) matrix.set(loc, new Set())
    matrix.get(loc).add(String(c.viewport))
  }
  if (c.reducedMotion === true) reducedMotionSeen = true
  // Image must exist so the evidence is real, not asserted.
  if (c.image) {
    const abs = isAbsolute(c.image) ? c.image : resolve(REPO_ROOT, c.image)
    if (!existsSync(abs)) errors.push(`${where} image not found on disk: ${c.image}`)
  }
})

// 6. Per-locale matrix: each required locale must carry BOTH required viewports.
for (const loc of REQUIRED_LOCALES) {
  const vps = matrix.get(loc)
  if (!vps) {
    errors.push(`no captures in required locale "${loc}"`)
    continue
  }
  for (const vp of REQUIRED_VIEWPORTS) {
    if (!vps.has(vp)) errors.push(`locale "${loc}" is missing required viewport ${vp}`)
  }
}

// 7. Reduced-motion observation where the ticket owns motion.
if (spec && spec.reducedMotionRequired && !reducedMotionSeen) {
  errors.push(`${ticket} owns motion — a reduced-motion capture (reducedMotion:true) is required`)
}

// Report.
const localeSummary = [...matrix.entries()].map(([l, v]) => `${l}:[${[...v].join(',')}]`).join(' ')
console.log(`vr2:gate — ${ticket || '(no ticket)'} — ${captures.length} capture(s)`)
console.log(`  matrix:    ${localeSummary || '(none)'}`)
console.log(`  runtime:   ${cand || '(none)'}  provenance=${evidence.provenance ?? evidence.provenanceVerified}`)
console.log(`  targets:   ${topTargets.map((t) => '#' + String(t).split('#')[1]).join(', ') || '(none)'}  board=${boardAnchors ? boardAnchors.size + ' anchors' : 'not-resolved'}`)

if (errors.length > 0) {
  console.error(`\nGATE FAIL — ${errors.length} problem(s):`)
  errors.forEach((e) => console.error(`  ✗ ${e}`))
  process.exit(1)
}
console.log('\nGATE PASS — exact-SHA product runtime evidence complete: named state, per-locale both viewports, resolving target.')
process.exit(0)
