import { beforeEach, describe, expect, it } from 'vitest'
import { activeBuilding, __resetStoreForTests, useStore } from '../store'
import { calculateBuilding } from '../../engine/calculate'
import { withRegionalFactor } from '../catalog'
const CATALOG = withRegionalFactor(false)
import { applyDiscount } from '../../engine/calculate'
import { Decimal } from 'decimal.js'

/** S4/S5: колонки сравнения и гейт отправки — против фикстуры. */

beforeEach(() => __resetStoreForTests())

describe('S4: три колонки от одного движка', () => {
  it('варианты дают фикстурные итоги, дельты — к названной базе', () => {
    const s = useStore.getState()
    const basis = calculateBuilding(activeBuilding(s), CATALOG, s.coverage)
    const ohneUg = calculateBuilding({ ...activeBuilding(s), untergeschoss: 'kein_ug' }, CATALOG, s.coverage)
    const eh40 = calculateBuilding({ ...activeBuilding(s), energiestandard: 'EH_40' }, CATALOG, s.coverage)
    expect(basis.total.exact.toFixed(2)).toBe('3817835.00')
    expect(ohneUg.total.exact.toFixed(2)).toBe('3341835.00')
    expect(eh40.total.exact.toFixed(2)).toBe('3915170.00')
    // Дельта Ohne UG — ровно 476.000, показ равен точному: префикса нет.
    const d1 = ohneUg.total.exact.minus(basis.total.exact)
    expect(d1.toFixed(2)).toBe('-476000.00')
    // Дельта EH 40 — 97.335, показ отличается: префикс обязателен.
    const d2 = eh40.total.exact.minus(basis.total.exact)
    expect(d2.toFixed(2)).toBe('97335.00')
  })
})

describe('S5: гейт отправки', () => {
  it('открытый блокер держит отправку закрытой; подтверждение открывает', () => {
    const s = useStore.getState()
    expect(activeBuilding(s).gebaeudeklasse.confirmed).toBe(false)
    s.confirmGebaeudeklasse()
    expect(activeBuilding(useStore.getState()).gebaeudeklasse.confirmed).toBe(true)
    expect(useStore.getState().journal.at(-1)!.label).toContain('MBO')
  })

  it('скидка от точного итога, раскрытие несёт точное значение', () => {
    const total = useStore.getState().projection().result.total.exact
    const d = applyDiscount(total, new Decimal('3'))
    expect(d.exact.toFixed(2)).toBe('3703299.95')
    expect(d.disclosure).toContain('3.703.299,95')
  })

  it('offer.emailed — событие журнала со снапшотом', () => {
    useStore.getState().sendOffer('email')
    expect(useStore.getState().journal.at(-1)!.kind).toBe('offer.emailed')
    expect(useStore.getState().snapshots).toHaveLength(1)
  })
})

describe('S6: Regionalfaktor — живой флаг со снапшот-семантикой', () => {
  it('включение даёт объявленный фикстурой эффект и событие с дельтой', () => {
    const before = useStore.getState().projection().result.total.exact
    useStore.getState().toggleRegionalfaktor()
    const after = useStore.getState().projection().result.total.exact
    const delta = after.minus(before)
    // Фикстура объявляет: «дал бы ≈ 305.000 € на блок Bauwerk».
    expect(delta.toFixed(2)).toBe('305426.80')
    const e = useStore.getState().journal.at(-1)!
    expect(e.label).toContain('aktiviert')
    expect(e.deltaExact!.toFixed(2)).toBe('305426.80')
  })

  it('выключение возвращает и пишет отдельное событие', () => {
    useStore.getState().toggleRegionalfaktor()
    useStore.getState().toggleRegionalfaktor()
    const s = useStore.getState()
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    expect(s.journal).toHaveLength(2)
  })
})
