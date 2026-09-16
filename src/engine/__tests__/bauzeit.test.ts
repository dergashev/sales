import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  BAUZEIT_MODEL_DEFAULTS,
  allocateByBgf,
  bauzeitOnsite,
  bauzeitSharesReconcile,
  computeBauzeit,
} from '../bauzeit'
import type { BauzeitBuildingInput } from '../bauzeit'

/**
 * Der übernommene Bauzeit-Rechner, gegen sein eigenes Praxisbeispiel.
 *
 * Die Erwartungen sind KEINE Rückrechnung aus dieser Implementierung: sie
 * sind die Zahlen, die der ALL3-Bauzeit-Rechner für zwei Gebäude mit 976
 * und 1.450 m² BGF ab dem 15.08.2026 ausgibt — Bauzeiten, Kalenderdaten,
 * Planungsdauer und Fälligkeiten. Eine Portierung, die ihre Vorlage nicht
 * auf den Tag genau trifft, ist eine zweite Formel mit demselben Namen.
 */

const BUILDINGS: BauzeitBuildingInput[] = [
  {
    id: 'H1', label: 'Haus 1', bgf: 976, type: 'mfh', gk: 'gk3',
    foundationMonths: 1, contractSum: new Decimal('1464000'),
  },
  {
    id: 'H2', label: 'Haus 2', bgf: 1450, type: 'mfh', gk: 'gk4',
    foundationMonths: 1.5, contractSum: new Decimal('2175000'),
  },
]

const START = '2026-08-15'

describe('bauzeitOnsite', () => {
  it('rechnet Fläche, Typ und Gebäudeklasse in Monate', () => {
    const one = bauzeitOnsite(BUILDINGS[0]!, BAUZEIT_MODEL_DEFAULTS)
    expect(one.onsite).toBeCloseTo(4.968, 6)
    expect(one.minApplied).toBe(false)

    const two = bauzeitOnsite(BUILDINGS[1]!, BAUZEIT_MODEL_DEFAULTS)
    expect(two.gkFactor).toBe(1.05)
    expect(two.onsite).toBeCloseTo(5.88, 6)
  })

  it('hebt eine zu kurze Bauzeit auf die Mindestdauer und sagt es', () => {
    const tiny = bauzeitOnsite(
      { bgf: 100, type: 'single', gk: 'gk1' }, BAUZEIT_MODEL_DEFAULTS,
    )
    expect(tiny.onsite).toBe(BAUZEIT_MODEL_DEFAULTS.minMonths)
    expect(tiny.minApplied).toBe(true)
  })
})

describe('computeBauzeit · das Praxisbeispiel', () => {
  const result = computeBauzeit(BUILDINGS, BAUZEIT_MODEL_DEFAULTS, START)

  it('führt die Planung auf 6,5 Monate', () => {
    expect(result.planning.totalBgf).toBe(2426)
    // Unterhalb der Flächenschwelle bleibt LP4 auf der Basiszeit.
    expect(result.planning.stages.s1.duration).toBe(2.5)
    expect(result.planning.totalMonths).toBe(6.5)
  })

  it('trifft die Termine des ersten Gebäudes auf den Tag', () => {
    const one = result.buildings[0]!
    expect(one.months).toBe(5)
    expect(one.weeks).toBe(22)
    expect(one.foundationStartDate).toBe('2027-01-30')
    expect(one.startDate).toBe('2027-03-02')
    expect(one.endDate).toBe('2027-07-29')
    expect(one.acceptanceEndDate).toBe('2027-09-29')
  })

  it('startet das zweite Gebäude um den Zeitversatz später', () => {
    const two = result.buildings[1]!
    expect(two.months).toBe(6)
    expect(two.weeks).toBe(26)
    expect(two.foundationStartDate).toBe('2027-04-15')
    expect(two.startDate).toBe('2027-05-30')
    expect(two.endDate).toBe('2027-11-27')
    expect(two.acceptanceEndDate).toBe('2028-01-27')
  })

  it('nimmt als Projektdauer das späteste Ende, nie die Summe', () => {
    expect(result.projectMonthsRounded).toBe(17.5)
    expect(result.projectWeeks).toBe(76)
    expect(result.projectEndDate).toBe('2028-01-27')
    // Die Summe der Bauzeiten wäre 10,8 Monate; die Projektdauer ist mehr,
    // weil die Planung davorliegt, und weniger als eine Reihenschaltung.
    const serial = result.buildings.reduce((a, b) => a + b.onsite.onsite, 0)
    expect(result.projectMonths).toBeGreaterThan(serial)
  })

  it('legt sieben Tranchen auf ihre Meilensteine', () => {
    expect(result.payments).toHaveLength(7)
    const design = result.payments.find((p) => p.kind === 'design')!
    expect(design.date).toBe('2026-09-15')
    expect(design.amount.toFixed(0)).toBe('363900')
    const shellOne = result.payments.find((p) => p.id === 'cp-shell-H1')!
    expect(shellOne.date).toBe('2027-04-14')
    expect(shellOne.amount.toFixed(0)).toBe('585600')
    const acceptanceTwo = result.payments.find((p) => p.id === 'cp-acceptance-H2')!
    expect(acceptanceTwo.date).toBe('2028-01-27')
    expect(acceptanceTwo.amount.toFixed(0)).toBe('217500')
  })

  it('summiert den Zahlungsplan exakt auf die Vertragssumme', () => {
    expect(bauzeitSharesReconcile(BAUZEIT_MODEL_DEFAULTS.payments)).toBe(true)
    expect(result.totalContractSum.toFixed(2)).toBe('3639000.00')
    expect(result.paymentsTotal.toFixed(2)).toBe('3639000.00')
  })

  it('beginnt ohne Planungsphase mit den Fundamentarbeiten', () => {
    const noPlanning = computeBauzeit(
      BUILDINGS,
      {
        ...BAUZEIT_MODEL_DEFAULTS,
        planning: { ...BAUZEIT_MODEL_DEFAULTS.planning, enabled: false },
      },
      START,
    )
    expect(noPlanning.planning.totalMonths).toBe(0)
    expect(noPlanning.buildings[0]!.start).toBe(1)
    expect(noPlanning.payments[0]!.date).toBe(START)
  })
})

describe('allocateByBgf', () => {
  it('verteilt nach Fläche und trifft die Gesamtsumme exakt (Regel 32)', () => {
    const total = new Decimal('1000000.00')
    const split = allocateByBgf(
      [{ id: 'a', bgf: 1 }, { id: 'b', bgf: 1 }, { id: 'c', bgf: 1 }], total,
    )
    const sum = Object.values(split).reduce((a, b) => a.plus(b), new Decimal(0))
    expect(sum.toFixed(2)).toBe('1000000.00')
  })

  it('verteilt ohne Flächen gleichmäßig', () => {
    const split = allocateByBgf([{ id: 'a', bgf: 0 }, { id: 'b', bgf: 0 }], new Decimal(100))
    expect(split.a!.plus(split.b!).toFixed(2)).toBe('100.00')
  })

  it('ist ohne Gebäude leer statt null', () => {
    expect(allocateByBgf([], new Decimal(100))).toEqual({})
  })
})
