#!/usr/bin/env node
// VR2-00 — Runtime visual gate.
//
// Validates a VR2 release-evidence manifest against the acceptance rules of
// docs/audit/vr2-visual-gate.md. The rule this enforces mechanically:
//
//   A VR2 ticket may NOT claim target adoption unless it attaches
//   provenance-verified, exact-SHA PRODUCT screenshots of the ticket's named
//   ordinary runtime route/state at BOTH required viewports (1440x900 and
//   1280x800), in both product locales, compared against the approved VO-T1
//   target. Foundations / a design-system specimen, Storybook, a test surface
//   or a deep-only prototype route is not an accepted consumer.
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
const REPO_ROOT = resolve(HERE, '..', '..')
const MANIFEST_PATH = resolve(HERE, 'route-state-manifest.json')

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
const REQUIRED_LOCALES = manifest.requiredLocales
const SPECIMEN = new Set(manifest.specimenRoutes.map((r) => r.toLowerCase()))

const errors = []
const notes = []

// 1. Ticket must be a known VR2 ticket with a named ordinary route.
const ticket = evidence.ticket
const spec = ticket && manifest.tickets[ticket]
if (!ticket) errors.push('missing `ticket`')
else if (!spec) errors.push(`unknown ticket "${ticket}" — not in route-state-manifest.json`)

const allowedRoutes = spec ? new Set(spec.routes.map((r) => r.toLowerCase())) : new Set()

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

// 4. A target reference is mandatory (target/current comparison gate).
if (!evidence.target) errors.push('missing `target` — target/current comparison requires the approved VO-T1 target reference')

// 5. Captures: shape, no specimens, ordinary routes only.
const captures = Array.isArray(evidence.captures) ? evidence.captures : []
if (captures.length === 0) errors.push('`captures` is empty — a specimen or claim without product runtime captures is rejected')

const seenViewports = new Set()
const seenLocales = new Set()
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
  if (c.viewport) seenViewports.add(String(c.viewport))
  if (c.locale) seenLocales.add(String(c.locale).toLowerCase())
  if (c.reducedMotion === true) reducedMotionSeen = true
  // Image must exist so the evidence is real, not asserted.
  if (c.image) {
    const abs = isAbsolute(c.image) ? c.image : resolve(REPO_ROOT, c.image)
    if (!existsSync(abs)) errors.push(`${where} image not found on disk: ${c.image}`)
  }
})

// 6. Both required viewports present.
for (const vp of REQUIRED_VIEWPORTS) {
  if (!seenViewports.has(vp)) errors.push(`no capture at required viewport ${vp}`)
}

// 7. Both product locales present.
for (const loc of REQUIRED_LOCALES) {
  if (!seenLocales.has(loc)) errors.push(`no capture in required locale "${loc}"`)
}

// 8. Reduced-motion observation where the ticket owns motion.
if (spec && spec.reducedMotionRequired && !reducedMotionSeen) {
  errors.push(`${ticket} owns motion — a reduced-motion capture (reducedMotion:true) is required`)
}

// Report.
console.log(`vr2:gate — ${ticket || '(no ticket)'} — ${captures.length} capture(s)`)
console.log(`  viewports: ${[...seenViewports].join(', ') || '(none)'}`)
console.log(`  locales:   ${[...seenLocales].join(', ') || '(none)'}`)
console.log(`  runtime:   ${cand || '(none)'}  provenance=${evidence.provenance ?? evidence.provenanceVerified}`)
notes.forEach((n) => console.log(`  note: ${n}`))

if (errors.length > 0) {
  console.error(`\nGATE FAIL — ${errors.length} problem(s):`)
  errors.forEach((e) => console.error(`  ✗ ${e}`))
  process.exit(1)
}
console.log('\nGATE PASS — exact-SHA product runtime evidence complete at both viewports.')
process.exit(0)
