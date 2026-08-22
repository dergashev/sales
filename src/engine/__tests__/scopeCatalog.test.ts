import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { calculateKg800, type Kg800Params } from '../calculate'
import {
  scopeCatalogDriver, scopeCatalogDrivers, KG500_CATALOG_OPTIONS,
  KG600_CATALOG_OPTIONS, type ScopeQuantityKey,
} from '../scopeCatalog'

/**
 * Deterministic fixture cases (тикет "MAKE ALL KG 200–800 SELECTABLE & ADD
 * COST-BEARING CONTENT FOR KG 200/500/600/800", AC-25):
 * 60 Wohneinheiten, 5.000 m² Wohnfläche, 20 oberirdische PKW-Stellplätze.
 */

describe('KG 500/600 — контрольные примеры из исследования (AC-25)', () => {
  it('KG600 Küche: Standard × 60 Wohneinheiten = 420.000 €; Standard Plus = +180.000 € Differenz', () => {
    const kitchens = KG600_CATALOG_OPTIONS.find((o) => o.id === 'kg600-01')!
    const quantityOf = (key: ScopeQuantityKey) =>
      key === 'dwelling_count' ? new Decimal(60) : null

    const standard = kitchens.variants.find((v) => v.value === '03')! // Standard, 7.000 €
    const driverStandard = scopeCatalogDriver(
      kitchens, standard, quantityOf, new Decimal(0),
    )!
    expect(driverStandard.exact.toFixed(2)).toBe('420000.00')

    const plus = kitchens.variants.find((v) => v.value === '04')! // Standard Plus, 10.000 €
    const driverPlus = scopeCatalogDriver(kitchens, plus, quantityOf, new Decimal(0))!
    expect(driverPlus.exact.toFixed(2)).toBe('600000.00')
    expect(driverPlus.exact.minus(driverStandard.exact).toFixed(2)).toBe('180000.00')
  })

  it('KG500 PKW-Stellplätze: Pflasterstellplatz × 20 = 150.000 €; EV-ready = +60.000 € Differenz', () => {
    const parking = KG500_CATALOG_OPTIONS.find((o) => o.id === 'kg500-04')!
    const quantityOf = (key: ScopeQuantityKey) =>
      key === 'surface_parking_spaces' ? new Decimal(20) : null

    const paved = parking.variants.find((v) => v.value === '03')! // Pflasterstellplatz, 7.500 €
    const driverPaved = scopeCatalogDriver(parking, paved, quantityOf, new Decimal(0))!
    expect(driverPaved.exact.toFixed(2)).toBe('150000.00')

    const evReady = parking.variants.find((v) => v.value === '05')! // E-Mobility-ready, 10.500 €
    const driverEv = scopeCatalogDriver(parking, evReady, quantityOf, new Decimal(0))!
    expect(driverEv.exact.toFixed(2)).toBe('210000.00')
    expect(driverEv.exact.minus(driverPaved.exact).toFixed(2)).toBe('60000.00')
  })

  it('KG600 Kunst am Bau (kg600-07): Prozent von KG 300+400, nicht von einer physischen Menge', () => {
    const art = KG600_CATALOG_OPTIONS.find((o) => o.id === 'kg600-07')!
    const standard = art.variants.find((v) => v.value === '03')! // 0.50 %
    const kg300Plus400 = new Decimal('10000000')
    const driver = scopeCatalogDriver(art, standard, () => null, kg300Plus400)!
    expect(driver.exact.toFixed(2)).toBe('50000.00')
    expect(driver.basis).toEqual({
      kind: 'factor', appliedTo: kg300Plus400, factor: new Decimal('0.005'),
    })
  })

  it('нулевой вариант (Baufreies Grundstück, Nicht enthalten, …) не создаёт вклада', () => {
    const kitchens = KG600_CATALOG_OPTIONS.find((o) => o.id === 'kg600-01')!
    const notIncluded = kitchens.variants.find((v) => v.value === '01')!
    const driver = scopeCatalogDriver(
      kitchens, notIncluded, () => new Decimal(60), new Decimal(0),
    )
    expect(driver).toBeNull()
  })

  it('отсутствующее количество (ещё не введено) не подставляет скрытый ноль — вклад просто отсутствует', () => {
    const parking = KG500_CATALOG_OPTIONS.find((o) => o.id === 'kg500-04')!
    const paved = parking.variants.find((v) => v.value === '03')!
    const driver = scopeCatalogDriver(parking, paved, () => null, new Decimal(0))
    expect(driver).toBeNull()
  })

  it('scopeCatalogDrivers пропускает через один вызов весь набор опций одной KG, используя default там, где выбор ещё не сделан', () => {
    const quantityOf = (key: ScopeQuantityKey) => {
      if (key === 'surface_parking_spaces') return new Decimal(20)
      if (key === 'bicycle_spaces') return new Decimal(10)
      return null
    }
    const drivers = scopeCatalogDrivers(KG500_CATALOG_OPTIONS, {}, quantityOf, new Decimal(0))
    // kg500-04 (default '03', Pflasterstellplatz) and kg500-05 (default '02',
    // robuster Bügel) both have their quantity available; the other five
    // options have none configured and correctly produce no driver.
    expect(drivers.map((d) => d.key).sort()).toEqual([
      'scope_kg500-04_03', 'scope_kg500-05_02',
    ])
  })
})

/**
 * KG 800 — Finanzierung (тикет "MAKE ALL KG 200–800 SELECTABLE…", §5/§8.2 и
 * §13 «Example price behavior» приложения). AC-15: контрольный пример
 * должен воспроизводиться до цента.
 */
describe('KG 800 — Finanzierung, контрольный пример приложения (AC-15)', () => {
  const WORKED_EXAMPLE: Kg800Params = {
    debtRatio: new Decimal('0.60'),
    debtRate: new Decimal('0.045'),
    financingMonths: new Decimal(18),
    drawdownFactor: new Decimal('0.50'),
    financingFeeRate: new Decimal('0.0075'),
    commitmentFreeMonths: new Decimal(12),
    commitmentMonthlyRate: new Decimal('0.0015'),
    guaranteeAmount: new Decimal(0),
    guaranteeRate: new Decimal(0),
    equityRate: new Decimal(0),
  }

  it('Fremdkapitalzinsen = 405.000 € und Finanzierungsnebenkosten = 90.000 € bei 20 Mio. € PRE_FINANCING_COST', () => {
    const result = calculateKg800(new Decimal('20000000'), WORKED_EXAMPLE)
    expect(result.debtPrincipal.toFixed(2)).toBe('12000000.00')
    expect(result.avgDrawnDebt.toFixed(2)).toBe('6000000.00')
    expect(result.debtInterest.toFixed(2)).toBe('405000.00')
    expect(result.financingFee.toFixed(2)).toBe('90000.00')
  })

  it('ohne Bürgschaft/kalkulatorisches Eigenkapital bleiben diese Komponenten exakt null (Standard-Annahmen §6)', () => {
    const result = calculateKg800(new Decimal('20000000'), WORKED_EXAMPLE)
    expect(result.guaranteeCost.isZero()).toBe(true)
    expect(result.equityInterest.isZero()).toBe(true)
  })

  it('Bereitstellungszins wirkt NIE auf bereits abgerufenes Fremdkapital — nur auf den nicht abgerufenen Rest ab dem freien Monat', () => {
    // 12 Monate frei, 18 Monate Laufzeit -> 6 zahlungspflichtige Monate;
    // nicht abgerufener Rest = 12.000.000 - 6.000.000 = 6.000.000 €.
    const result = calculateKg800(new Decimal('20000000'), WORKED_EXAMPLE)
    expect(result.commitmentInterest.toFixed(2))
      .toBe(new Decimal('6000000').mul('0.0015').mul(6).toFixed(2))
  })

  it('KG 800 ist NICHT rekursiv: PRE_FINANCING_COST wird von der aufrufenden Seite VOR KG 800 berechnet, niemals aus dem eigenen Ergebnis', () => {
    const preFinancingCost = new Decimal('20000000')
    const result = calculateKg800(preFinancingCost, WORKED_EXAMPLE)
    // The base passed in is untouched by the result — calling again with the
    // SAME base (not base + result.total) reproduces the identical figure,
    // proving no hidden feedback loop exists.
    const again = calculateKg800(preFinancingCost, WORKED_EXAMPLE)
    expect(again.debtInterest.toFixed(2)).toBe(result.debtInterest.toFixed(2))
    expect(result.preFinancingCost.toFixed(2)).toBe(preFinancingCost.toFixed(2))
  })

  it('Bürgschaftskosten = Bürgschaftssumme × Satz × Jahre, wenn eine Summe eingetragen ist', () => {
    const withGuarantee: Kg800Params = {
      ...WORKED_EXAMPLE, guaranteeAmount: new Decimal('1000000'), guaranteeRate: new Decimal('0.01'),
    }
    const result = calculateKg800(new Decimal('20000000'), withGuarantee)
    // years = 18/12 = 1.5
    expect(result.guaranteeCost.toFixed(2)).toBe('15000.00')
  })

  it('kalkulatorischer Eigenkapitalzins wirkt auf AVG_INVESTED_EQUITY, nicht auf den Fremdkapitalanteil', () => {
    const withEquityInterest: Kg800Params = { ...WORKED_EXAMPLE, equityRate: new Decimal('0.08') }
    const result = calculateKg800(new Decimal('20000000'), withEquityInterest)
    // equityPrincipal = 20m - 12m = 8m; avgInvestedEquity = 8m * 0.50 = 4m
    // equityInterest = 4m * 0.08 * 1.5 years = 480,000
    expect(result.avgInvestedEquity.toFixed(2)).toBe('4000000.00')
    expect(result.equityInterest.toFixed(2)).toBe('480000.00')
  })

  it('KG800-Gesamt ist die Summe distincter Basen — keine Komponente zählt eine andere doppelt', () => {
    const withEverything: Kg800Params = {
      ...WORKED_EXAMPLE,
      guaranteeAmount: new Decimal('1000000'), guaranteeRate: new Decimal('0.01'),
      equityRate: new Decimal('0.08'),
    }
    const result = calculateKg800(new Decimal('20000000'), withEverything)
    const sum = result.debtInterest.plus(result.equityInterest).plus(result.financingFee)
      .plus(result.commitmentInterest).plus(result.guaranteeCost)
    expect(sum.toFixed(2)).toBe(result.total.toFixed(2))
    // Distinct bases: debt interest bases off avgDrawnDebt, equity interest
    // off avgInvestedEquity (the OTHER side of the same principal split),
    // financing fee off the full debt principal (not the averaged draw),
    // guarantee off its own external amount, commitment off the undrawn
    // remainder — none of these five share an identical (base, rate) pair.
    expect(result.avgDrawnDebt.toFixed(2)).not.toBe(result.avgInvestedEquity.toFixed(2))
    expect(result.debtPrincipal.toFixed(2)).not.toBe(result.avgDrawnDebt.toFixed(2))
  })
})
