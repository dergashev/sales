import { describe, expect, it } from 'vitest'
import { demoProject } from '../projectAnalysis'
import {
  DOWNSTREAM_REFS,
  EVIDENCE_GROUPS,
  evidenceCounts,
  evidenceForDownstream,
  evidenceGroupView,
  evidenceGroupViews,
  evidenceItem,
  evidenceItems,
  evidenceSource,
  isConfirmable,
  isDownstreamRef,
  isEvidenceAuthority,
  isEvidenceGroup,
  isEvidenceState,
  needsAttention,
  reconcileEvidenceCounts,
  withEvidenceConfirmations,
} from '../projectEvidence'
import { documentAnchor } from '../../assets/document-media'

/**
 * The evidence register is what Project Understanding SHOWS and what the
 * Option stage will later CITE. Both of those depend on properties no screen
 * can assert about itself: that the four groups partition the register, that
 * every count on the page is the register counted rather than a literal, and
 * that a citation resolves to a page of a document that actually exists.
 *
 * The register is also this slice's integration point. `evidenceItem` and
 * `evidenceForDownstream` have no product caller yet — KG 400 and the
 * procurement export are later tickets — and an unused resolver is exactly
 * the kind of code that silently stops working before its first consumer
 * arrives. So it is exercised here against the real fixture: the contract
 * the next ticket will build on is proved on the day it is written.
 */

const A = demoProject('DEMO-HAPPY-01')!
const B = demoProject('DEMO-COMPLEX-01')!
const PROJECTS = [A, B]

describe('the evidence register reconciles with itself', () => {
  it('is coherent on both demonstration projects', () => {
    for (const project of PROJECTS) {
      expect(reconcileEvidenceCounts(project), project.id).toEqual([])
    }
  })

  it('the four groups partition the register — every item in exactly one', () => {
    for (const project of PROJECTS) {
      const perGroup = EVIDENCE_GROUPS
        .map((group) => evidenceGroupView(project, group).total)
        .reduce((sum, n) => sum + n, 0)
      expect(perGroup, project.id).toBe(evidenceCounts(project).total)
      expect(perGroup, project.id).toBe(evidenceItems(project).length)
      for (const item of evidenceItems(project)) {
        expect(isEvidenceGroup(item.group), `${item.id} group`).toBe(true)
        expect(isEvidenceAuthority(item.authority), `${item.id} authority`).toBe(true)
        expect(isEvidenceState(item.state), `${item.id} state`).toBe(true)
        for (const ref of item.downstreamRefs) {
          expect(isDownstreamRef(ref), `${item.id} → ${ref}`).toBe(true)
        }
      }
    }
  })

  it('the authority counts partition the register, and attention does not', () => {
    for (const project of PROJECTS) {
      const c = evidenceCounts(project)
      expect(c.sourceEvidenced + c.derived + c.confirmed + c.overridden, project.id)
        .toBe(c.total)
      // A separate axis: an item that needs a human is still exactly one of
      // the four authorities, so adding it to the partition would double-count.
      expect(c.requiringAttention).toBe(
        evidenceItems(project).filter((item) => needsAttention(item.state)).length,
      )
    }
  })

  it('a group shows every item it has — nothing is withheld', () => {
    for (const view of evidenceGroupViews(B)) {
      expect(view.items.length).toBe(view.total)
      expect(view.attentionCount).toBeLessThanOrEqual(view.total)
    }
  })

  it('open items lead, and what was settled here stays right under them', () => {
    const before = evidenceGroupView(B, 'geometry')
    const open = before.items.filter((item) => isConfirmable(item))
    expect(open.length).toBeGreaterThan(1)
    // The first one is settled: it leaves the open block and lands directly
    // beneath it, not at the position its fixture order would give it.
    const settled = open[0]!
    const after = evidenceGroupView(
      withEvidenceConfirmations(B, { [settled.id]: { by: 'x', at: 'y' } }),
      'geometry',
      new Set([settled.id]),
    )
    const stillOpen = after.items.filter((item) => isConfirmable(item))
    expect(after.items.indexOf(after.items.find((i) => i.id === settled.id)!))
      .toBe(stillOpen.length)
    expect(after.items.length).toBe(before.items.length)
  })

  it('an empty group is a fact, not a gap — Freiburg has no building services', () => {
    const tga = evidenceGroupView(A, 'tga')
    expect(tga.total).toBe(0)
    expect(tga.items).toEqual([])
    // And the group still exists, so the page can say so rather than omit it.
    expect(evidenceGroupViews(A).map((v) => v.group)).toEqual([...EVIDENCE_GROUPS])
  })
})

describe('a citation resolves to a page of a document that exists', () => {
  it('every item cites a document in its own project register', () => {
    for (const project of PROJECTS) {
      for (const item of evidenceItems(project)) {
        const source = evidenceSource(project, item)
        expect(source, `${item.id} → ${item.sourceDocumentId}`).not.toBeNull()
        expect(source!.documentId).toBe(item.sourceDocumentId)
        expect(source!.page).toBe(item.sourcePage)
        expect(source!.anchorId).toBe(item.sourceAnchorId)
        expect(source!.page).toBeGreaterThan(0)
      }
    }
  })

  it('a cited anchor is a real anchor of the generated pack, on the page claimed', () => {
    // Leipzig's sources are authored PDFs with a provenance manifest, so the
    // citation is checkable end to end: the anchor id exists, and the page
    // the register prints is the page the manifest recorded. A citation that
    // opens the right file at the wrong page is the failure this catches.
    let checked = 0
    for (const item of evidenceItems(B)) {
      const anchor = documentAnchor(item.sourceDocumentId, item.sourceAnchorId)
      if (anchor === null) continue // no generated pack in this checkout
      expect(anchor.id).toBe(item.sourceAnchorId)
      expect(anchor.page, `${item.id} page`).toBe(item.sourcePage)
      expect(anchor.labelDe.length).toBeGreaterThan(0)
      expect(anchor.labelEn.length).toBeGreaterThan(0)
      checked += 1
    }
    expect(checked, 'no citation could be resolved against the manifest')
      .toBeGreaterThan(0)
  })

  it('a citation into a document the project does not hold is null, not a guess', () => {
    const orphan = { ...evidenceItems(B)[0]!, sourceDocumentId: 'LEI-DOC-99' }
    expect(evidenceSource(B, orphan)).toBeNull()
  })
})

describe('the downstream integration point later tickets consume', () => {
  it('resolves one item by its stable id, and answers null for an unknown one', () => {
    const first = evidenceItems(B)[0]!
    expect(evidenceItem(B, first.id)).toBe(first)
    expect(evidenceItem(B, 'B-EV-does-not-exist')).toBeNull()
    // Ids are stable and unique — a downstream reference is only worth
    // anything if it addresses exactly one value.
    const ids = evidenceItems(B).map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('KG 400 asks for its own requirements and gets TGA items with real sources', () => {
    const forKg400 = evidenceForDownstream(B, 'kg400')
    expect(forKg400.length).toBeGreaterThan(0)
    for (const item of forKg400) {
      expect(item.downstreamRefs).toContain('kg400')
      expect(evidenceSource(B, item), `${item.id} source`).not.toBeNull()
      expect(evidenceItem(B, item.id)).toBe(item)
    }
    // The TGA group is where a building-services requirement lives, and
    // every one of them is offered to KG 400.
    const tga = evidenceGroupView(B, 'tga')
    expect(tga.total).toBeGreaterThan(0)
    for (const item of tga.items) expect(item.downstreamRefs).toContain('kg400')
  })

  it('an empty answer is the honest «no source requirement found»', () => {
    // Absence is not a default requirement: the clean project has no
    // building-services evidence at all, and the resolver says so with an
    // empty list rather than falling back to the other project's.
    expect(evidenceForDownstream(A, 'kg400')).toEqual([])
    for (const ref of DOWNSTREAM_REFS) {
      for (const item of evidenceForDownstream(B, ref)) {
        expect(item.downstreamRefs).toContain(ref)
      }
    }
  })
})
