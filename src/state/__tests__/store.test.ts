import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { useStore } from '../store'

/**
 * Проекция обязана воспроизводить мокап S3 из `screen-map.md` до цента.
 *
 * Мокап — не иллюстрация, а спесимен: его числа взяты из фикстуры и
 * пересчитаны аудиторами. Расхождение экрана с мокапом означает, что либо
 * экран врёт, либо мокап устарел, — и то и другое дефект.
 */

const initial = useStore.getState()
beforeEach(() => useStore.setState(initial, true))

describe('S3: проекция воспроизводит мокап', () => {
  it('три со-главных героя и вторичная строка', () => {
    const p = useStore.getState().projection()
    expect(p.result.total.prefix + p.result.total.display).toBe('≈3.818.000')
    expect(p.result.totalLabel).toBe('Zwischensumme der kalkulierten Positionen')
    expect(p.leadRate.prefix + p.leadRate.display).toBe('≈2.545')
    expect(p.leadRate.denominatorLabel).toBe('WFL nach WoFlV')
    expect(p.secondaryRateBgf.prefix + p.secondaryRateBgf.display).toBe('≈1.909')
    expect(p.duration.prefix + p.duration.display).toBe('≈7,5 Monate')
    expect(p.duration.completionDate).toBe('2027-11-19')
    expect(p.uncertaintyPp).toBe(22)
  })

  it('je Wohneinheit — точное 238.614,6875, показ ≈ 238.615', () => {
    const p = useStore.getState().projection()
    expect(p.perUnit.exact.toFixed(4)).toBe('238614.6875')
    expect(p.perUnit.prefix + p.perUnit.display).toBe('≈238.615')
    expect(p.perUnit.denominatorKind).toBe('unitCount')
  })

  it('разбиение по высоте сходится с итогом в точных значениях', () => {
    const p = useStore.getState().projection()
    const sum = p.aboveGround.exact.plus(p.belowGround.exact)
    expect(sum.toFixed(2)).toBe(p.result.total.exact.toFixed(2))
    // Подземная часть — ровно 400 × 1.190, показ равен точному: префикса нет.
    expect(p.belowGround.prefix).toBe('')
    expect(p.aboveGround.prefix).toBe('≈')
  })

  it('строки KG округляются независимо и в сумме дают НЕ итог — это норма', () => {
    const p = useStore.getState().projection()
    const exact = p.kgSplit.KG_300.plus(p.kgSplit.KG_400).plus(p.kgSplit.KG_700)
    expect(exact.toFixed(2)).toBe(p.result.total.exact.toFixed(2))
  })
})

describe('S3: журнал событий как хребет (M-4)', () => {
  it('данные не меняются без события', () => {
    const s = useStore.getState()
    expect(s.journal).toHaveLength(0)
    s.setEnergiestandard('EH_40')
    const after = useStore.getState()
    expect(after.journal).toHaveLength(1)
    expect(after.journal[0]!.label).toContain('EH 55 → EH 40')
    expect(after.journal[0]!.deltaExact!.toFixed(2)).toBe('97335.00')
  })

  it('дельта одного изменения совпадает с фикстурой', () => {
    useStore.getState().setEnergiestandard('EH_40')
    const p = useStore.getState().projection()
    expect(p.result.total.exact.toFixed(2)).toBe('3915170.00')
  })

  it('undo — обратное СОБЫТИЕ, а не откат состояния', () => {
    const s = useStore.getState()
    s.setEnergiestandard('EH_40')
    useStore.getState().undo()
    const after = useStore.getState()
    // Значение вернулось…
    expect(after.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    // …но история не потеряна: два события, а не ноль.
    expect(after.journal).toHaveLength(2)
    expect(after.journal[1]!.kind).toBe('undo')
    expect(after.journal[1]!.deltaExact!.toFixed(2)).toBe('-97335.00')
  })
})

describe('S3: интервал сужается подтверждением, не выбором опции (D-19)', () => {
  it('выбор энергостандарта интервал не меняет', () => {
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
    useStore.getState().setEnergiestandard('EH_40')
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
  })

  it('подтверждение клиентом сужает интервал', () => {
    useStore.getState().editField('wfl', new Decimal('1560.00'), true)
    expect(useStore.getState().projection().uncertaintyPp).toBe(17)
    useStore.getState().editField('bgfOber', new Decimal('2100.00'), true)
    expect(useStore.getState().projection().uncertaintyPp).toBe(13)
  })

  it('правка без подтверждения интервал не сужает', () => {
    useStore.getState().editField('wfl', new Decimal('1560.00'), false)
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
    expect(useStore.getState().fields.wfl.provenance).toBe('manuell erfasst')
  })
})

describe('S3: ворота клиентского вида', () => {
  it('неподтверждённый класс держит итог неполным', () => {
    const p = useStore.getState().projection()
    expect(p.result.completeness).toBe('incomplete')
    expect(p.result.incompleteReasons.join(' ')).toContain('Prüfung erforderlich')
  })

  it('подтверждение снимает свою причину, но KG 500 держит промежуточный итог', () => {
    useStore.getState().confirmGebaeudeklasse()
    const p = useStore.getState().projection()
    expect(p.result.incompleteReasons.join(' ')).not.toContain('Prüfung erforderlich')
    // Покрытие KG 500 неизвестно — итог остаётся промежуточным.
    expect(p.result.completeness).toBe('incomplete')
    expect(p.result.totalLabel).toBe('Zwischensumme der kalkulierten Positionen')
  })

  it('решённое покрытие KG 500 делает итог полным и названным', () => {
    useStore.getState().confirmGebaeudeklasse()
    useStore.getState().setCoverage('KG_500', 'excluded')
    const p = useStore.getState().projection()
    expect(p.result.completeness).toBe('complete')
    expect(p.result.totalLabel).toBe('Gesamt netto · Grundleistung All3')
  })
})
