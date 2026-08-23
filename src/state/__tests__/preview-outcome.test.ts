import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStoreForTests, useStore, type PriceChange } from '../store'

/**
 * Обещанное до клика равно случившемуся после — для КАЖДОГО денежного
 * решения.
 *
 * Прежде превью знало два вида решения, а остальные считали последствие
 * сами. Плитка охвата умножала ставку на площадь АКТИВНОГО здания, тогда
 * как включение применяется ко всем включённым: обещание `+230.000 €`
 * кончалось изменением на `+368.000 €` (сплошное ревью 26, находка 13).
 *
 * Тест перебирает виды решения, а не места на экране: место можно забыть,
 * вид — нет, потому что он объявлен типом `PriceChange`. Как только
 * появится шестой вид, список здесь перестанет быть полным, и это увидит
 * последняя проверка блока.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

/** Действие, которым решение принимается на самом деле. */
const COMMIT: Record<PriceChange['kind'], (c: never) => void> = {
  energiestandard: (c: Extract<PriceChange, { kind: 'energiestandard' }>) =>
    st().setEnergiestandard(c.value),
  untergeschoss: (c: Extract<PriceChange, { kind: 'untergeschoss' }>) =>
    st().setUntergeschoss(c.buildingId, c.value),
  coverage: (c: Extract<PriceChange, { kind: 'coverage' }>) =>
    st().setCoverage(c.group, c.value),
  risiko: (c: Extract<PriceChange, { kind: 'risiko' }>) => st().toggleRisiko(c.id),
  kg700: (c: Extract<PriceChange, { kind: 'kg700' }>) => st().setKg700Mode(c.value),
  kg300: (c: Extract<PriceChange, { kind: 'kg300' }>) =>
    st().setKg300(c.groupId, c.value),
} as never

const CASES: PriceChange[] = [
  { kind: 'energiestandard', value: 'EH_40' },
  { kind: 'untergeschoss', buildingId: 'DEMO-B-A', value: 'ab_decke' },
  { kind: 'coverage', group: 'KG_500', value: 'included' },
  { kind: 'risiko', id: 'RISK-STATIK', active: true },
  { kind: 'kg700', value: 'hoaiAho' },
  { kind: 'kg300', buildingId: 'DEMO-B-A', groupId: 'fassade', value: 'klinker' },
]

describe('обещание до клика равно результату после', () => {
  for (const change of CASES) {
    it(`${change.kind}: итог, подпись и дельта совпадают`, () => {
      const before = st().projection().result.total.exact
      const promised = st().outcomeOf(change)
      // Обещание не пишет ни состояния, ни журнала: превью — не событие.
      expect(st().projection().result.total.exact.equals(before)).toBe(true)
      const journalBefore = st().journal.length

      ;(COMMIT[change.kind] as (c: PriceChange) => void)(change)

      const after = st().projection().result
      expect(after.total.exact.toFixed(2)).toBe(promised.futureTotal.exact.toFixed(2))
      expect(after.totalLabel).toBe(promised.futureLabel)
      expect(after.total.exact.minus(before).toFixed(2))
        .toBe(promised.delta.toFixed(2))
      expect(st().journal.length).toBeGreaterThan(journalBefore)
    })
  }

  it('KG 200/500/600/800 каталог считается ОДИН раз на проект, а не по зданию (тикет "MAKE ALL KG 200-800 SELECTABLE"; former per-building coverage-rate bug, находка 13, теперь структурно невозможен — эта модель project-scoped, не building-scoped)', () => {
    // Два здания в предложении — то же условие, что вскрыло находку 13 для
    // старого building-scoped `coverageDrivers`. Новая каталожная модель
    // (`scopeCatalog.ts`) не параметризована зданием вовсе, поэтому
    // добавление второго здания не может задвоить её вклад.
    st().toggleBuildingIncluded('DEMO-B-B')
    expect(Object.values(st().included).filter(Boolean).length).toBe(2)
    st().setCoverage('KG_500', 'included')
    st().setScopeCatalogQuantity('surface_parking_spaces', '20')
    const single = st().projection().result.drivers
      .filter((d) => d.key === 'scope_kg500-04_03')
    expect(single.length).toBe(1)
    expect(single[0]!.exact.toFixed(2)).toBe('150000.00')
  })

  it('превью текущего выбора гасит призрак, а не обещает нулевое событие', () => {
    // KG_500 starts `excluded` (binary contract) — previewing the current
    // value must gate the ghost, not `unknown` (no longer a reachable state).
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'excluded' })
    expect(st().preview).toBeNull()
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'included' })
    expect(st().preview).not.toBeNull()
    st().previewOption(null)
    expect(st().preview).toBeNull()
  })

  it('перечень видов решения полон — иначе шестой останется без проверки', () => {
    const kinds = new Set(CASES.map((c) => c.kind))
    expect([...kinds].sort()).toEqual(Object.keys(COMMIT).sort())
  })
})
