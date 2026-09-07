import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPONENT_REGISTRY, SPECIMEN_GROUPS } from '../registry'

const DATA_STATES = ['loading', 'empty', 'partial', 'ready', 'error', 'stale', 'permission']
const CORE = readFileSync(resolve('design-system/components-core.md'), 'utf8')
const README = readFileSync(resolve('design-system/README.md'), 'utf8')
const MOTION = readFileSync(resolve('src/design-system/motion.ts'), 'utf8')

describe('D-28 component/specimen registry', () => {
  it('declares each specimen once with complete contract and state metadata', () => {
    const ids = COMPONENT_REGISTRY.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of COMPONENT_REGISTRY) {
      expect(entry.contractId.length).toBeGreaterThan(2)
      expect(entry.requirements.length).toBeGreaterThan(0)
      expect(entry.evidence.length).toBeGreaterThan(20)
      expect(Object.keys(entry.dataStates).sort()).toEqual([...DATA_STATES].sort())
      if (entry.blockedVariants.length > 0) expect(entry.maturity).toBe('alpha')
    }

    const grouped = SPECIMEN_GROUPS.flatMap((group) => group.specimens.map((entry) => entry.id))
    expect(grouped.sort()).toEqual([...ids].sort())
  })

  it('covers the approved first hardening baseline bidirectionally against authority docs', () => {
    const requiredIds = [
      'button', 'form-field', 'select', 'layout', 'card', 'badge', 'disclosure',
      'segmented', 'switch', 'dialog', 'state-loading', 'state-ready',
      'state-empty', 'state-partial', 'state-error', 'state-stale',
      'state-permission', 'readiness', 'next-step',
    ]
    expect(requiredIds.every((id) => COMPONENT_REGISTRY.some((entry) => entry.id === id))).toBe(true)

    for (const entry of COMPONENT_REGISTRY) {
      const coreName = entry.contractId.match(/components-core · (.+)$/)?.[1]
      if (coreName && coreName !== 'Product layout primitives') {
        expect(CORE, entry.contractId).toContain(`### ${coreName}`)
      }
      const dc = entry.contractId.match(/^DC-\d+/)?.[0]
      if (dc) expect(README, entry.contractId).toContain(dc)
    }
  })

  it('keeps modal and motion behavior behind one shared implementation', () => {
    for (const consumer of [
      'ClientOutputGateDialog.tsx',
      'PrintFlow.tsx',
      'GuidedTour.tsx',
    ]) {
      const source = readFileSync(resolve('src/components', consumer), 'utf8')
      expect(source, consumer).toContain("from './Dialog'")
      expect(source, consumer).not.toContain('createPortal')
    }
    /**
     * The list above resolved against `src/components` only, so a modal
     * opened from a CANONICAL Design System module was outside the check
     * entirely — and the client-facing MediaGallery is exactly that: a
     * full-screen inspection living in `src/design-system`. The import
     * specifier differs by one path segment, which is why it is asserted
     * separately rather than folded into the loop above.
     */
    for (const consumer of ['MediaGallery.tsx']) {
      const source = readFileSync(resolve('src/design-system', consumer), 'utf8')
      expect(source, consumer).toContain("from '../components/Dialog'")
      expect(source, consumer).not.toContain('createPortal')
    }
    expect(MOTION).toContain('useFramerReducedMotion')
    for (const token of [
      '--motion-feedback', '--motion-reveal', '--motion-reorder', '--stagger-wave',
    ]) {
      expect(MOTION).toContain(token)
    }
  })
})
