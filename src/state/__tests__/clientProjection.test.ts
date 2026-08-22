import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { Driver } from '../../engine/calculate'
import { projectDriversForClient } from '../clientProjection'

/**
 * QA finding (candidate ae2eb8f5bbedbcbba3edd647e5ce4d6471e136d9): KG 800's
 * financing breakdown leaked into the client-facing recap regardless of
 * `kg800ClientRevealed`, because the KG 800 chapter being absent from
 * client-facing navigation was mistaken for a driver-level privacy
 * boundary — no such boundary existed. The fix lives entirely in
 * `projectDriversForClient`; these tests pin its two required properties:
 * the itemization is gated by `kg800ClientRevealed`, and the visible total
 * (sum of whatever rows ARE shown) never silently drops or invents money.
 */

function driver(key: string, exact: number, origin: Driver['origin'] = 'decision'): Driver {
  return {
    key, exact: new Decimal(exact), label: `label:${key}`, scopeRefs: ['KG 800'],
    basis: null, origin, block: 'separatePosition',
  }
}

const sum = (drivers: readonly Driver[]) =>
  drivers.reduce((acc, d) => acc.plus(d.exact), new Decimal(0))

describe('projectDriversForClient — KG 800 private-by-default breakdown', () => {
  it('leaves drivers untouched in Vorbereitung (intern), regardless of the reveal flag', () => {
    const drivers = [driver('kg700_hoai_aho', 100), driver('kg800_debtInterest', 62_000),
      driver('kg800_financingFee', 14_000)]
    expect(projectDriversForClient(drivers, 'intern', false)).toEqual(drivers)
    expect(projectDriversForClient(drivers, 'intern', true)).toEqual(drivers)
  })

  it('collapses the three kg800_* rows into one aggregate row in Kundenansicht when not revealed', () => {
    const other = driver('kg700_hoai_aho', 378_000)
    const drivers = [other, driver('kg800_debtInterest', 62_000),
      driver('kg800_financingFee', 14_000), driver('kg800_commitmentInterest', 14_000)]

    const projected = projectDriversForClient(drivers, 'praesentation', false)

    const kg800Rows = projected.filter((d) => d.key.startsWith('kg800_'))
    expect(kg800Rows).toHaveLength(1)
    expect(kg800Rows[0]!.exact.toString()).toBe('90000')
    // Nothing named kg800_debtInterest/financingFee/commitmentInterest survives.
    expect(projected.some((d) => d.key === 'kg800_debtInterest')).toBe(false)
    // Every other driver (e.g. KG 700's own decision line) is untouched.
    expect(projected).toContainEqual(other)
    // The visible rows still sum to exactly the same total: no money is
    // silently hidden or invented by gating the itemization (rule 32).
    expect(sum(projected).toString()).toBe(sum(drivers).toString())
  })

  it('reveals the full itemized breakdown in Kundenansicht once kg800ClientRevealed is true', () => {
    const drivers = [driver('kg800_debtInterest', 62_000), driver('kg800_financingFee', 14_000)]
    const projected = projectDriversForClient(drivers, 'praesentation', true)
    expect(projected).toEqual(drivers)
  })

  it('adds no spurious aggregate row when KG 800 is excluded (no kg800_* drivers at all)', () => {
    const drivers = [driver('kg700_hoai_aho', 378_000)]
    expect(projectDriversForClient(drivers, 'praesentation', false)).toEqual(drivers)
  })
})
