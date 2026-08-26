import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { reconcileComposition, type CompositionSegment } from '../CompositionBar'

/**
 * DATA GRAPHIC RULE fixture test (REDESIGN R1, AC-18): "the visual
 * representation must reconcile with the source values … a component
 * that represents an additive whole" — rule-32-class arithmetic proof,
 * Decimal-exact (never float), against realistic KG-composition-shaped
 * commercial values (mirrors `src/fixtures/*.json` magnitude, not float
 * approximations — CALC-007 discipline).
 */

const KG_SEGMENTS: CompositionSegment[] = [
  { id: 'kg200', label: 'KG 200 · Herrichten & Erschließen', value: new Decimal('184300.00'), categorySlot: 1 },
  { id: 'kg300', label: 'KG 300 · Baukonstruktion', value: new Decimal('2148900.50'), categorySlot: 2 },
  { id: 'kg400', label: 'KG 400 · Technische Anlagen', value: new Decimal('612050.25'), categorySlot: 3 },
  { id: 'kg500', label: 'KG 500 · Außenanlagen', value: new Decimal('96300.00'), categorySlot: 4 },
  { id: 'kg700', label: 'KG 700 · Baunebenkosten', value: new Decimal('312449.25'), categorySlot: 6 },
]

describe('reconcileComposition — DATA GRAPHIC RULE (rule 32 class)', () => {
  it('reconciles EXACTLY when segments already sum to the total (Decimal, not float)', () => {
    const total = KG_SEGMENTS.reduce((acc, s) => acc.plus(s.value), new Decimal(0))
    const result = reconcileComposition(KG_SEGMENTS, total)

    expect(result.reconciles).toBe(true)
    expect(result.remainder.toString()).toBe('0')
    // Every segment's exact value survives untouched — the bar never derives
    // a segment FROM its own rounded percentage (that would be CALC-007's
    // "производные величины считаются от точных значений" inverted).
    result.segments.forEach((s, i) => {
      expect(s.value.equals(KG_SEGMENTS[i]!.value)).toBe(true)
    })
    // Percentages sum to exactly 100 when there is no remainder.
    const percentSum = result.segments.reduce((acc, s) => acc.plus(s.percent), new Decimal(0))
    expect(percentSum.toDecimalPlaces(6).toString()).toBe('100')
  })

  it('renders an HONEST remainder — never a zero-width truth — for a partial ("Preis nicht ermittelt") composition', () => {
    // One KG (e.g. KG 600) has no calculated basis yet; total is the
    // Zwischensumme der kalkulierten Positionen PLUS the un-priced share —
    // rule 16: the bar must not silently show 100% filled.
    const priced = KG_SEGMENTS.slice(0, 3)
    const pricedSum = priced.reduce((acc, s) => acc.plus(s.value), new Decimal(0))
    const declaredTotal = pricedSum.plus('450000.00') // the un-priced KG's share

    const result = reconcileComposition(priced, declaredTotal)

    expect(result.reconciles).toBe(true)
    expect(result.remainder.equals('450000.00')).toBe(true)
    expect(result.remainder.greaterThan(0)).toBe(true)
    // Segment percentages + remainder percentage still sum to exactly 100 —
    // the graphic's total visual area always equals the declared total.
    const percentSum = result.segments
      .reduce((acc, s) => acc.plus(s.percent), new Decimal(0))
      .plus(result.remainderPercent)
    expect(percentSum.toDecimalPlaces(6).toString()).toBe('100')
  })

  it('flags a non-reconciling input rather than silently normalising it', () => {
    // Defensive case: if a caller ever passes a `total` smaller than the
    // segment sum (a caller bug, not a legitimate product state), the
    // reconciliation flag must go false — the component must never paint
    // a bar that communicates a different total than its own segments.
    const total = new Decimal('100')
    const brokenSegments: CompositionSegment[] = [
      { id: 'a', label: 'A', value: new Decimal('60'), categorySlot: 1 },
      { id: 'b', label: 'B', value: new Decimal('60'), categorySlot: 2 }, // sums to 120, > total
    ]
    const result = reconcileComposition(brokenSegments, total)
    expect(result.reconciles).toBe(false)
  })

  it('€/m² × area = total — the rule-32 unit-price control case', () => {
    const areaSqm = new Decimal('4820.5')
    const ratePerSqm = new Decimal('798.60')
    const expectedTotal = areaSqm.mul(ratePerSqm)
    const segments: CompositionSegment[] = [
      { id: 'x', label: 'X', value: expectedTotal, categorySlot: 1 },
    ]
    const result = reconcileComposition(segments, expectedTotal)
    expect(result.reconciles).toBe(true)
    expect(result.segments[0]!.percent.toDecimalPlaces(6).toString()).toBe('100')
  })
})
