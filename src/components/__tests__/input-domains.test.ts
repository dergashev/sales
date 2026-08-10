import { describe, expect, it } from 'vitest'
import { parseDiscountPercent } from '../DiscountControl'
import { parseNumericInput, rejectNumericInput } from '../primitives'

/**
 * Домены ввода — два поля, один класс дефекта.
 *
 * Сплошное ревью 26 нашло в обоих одно и то же: `min`/`max` у HTML-элемента
 * ничего не валидируют, а обработчик клал в состояние всё подряд. Скидка
 * `200` давала отрицательный итог, `abc` в площади бросала `DecimalError`
 * из обработчика события и уносила экран целиком.
 *
 * Тест проверяет ФУНКЦИИ, а не разметку, потому что дефект живёт в разборе.
 * Разметка проверена отдельно там, где у неё своя ответственность —
 * объяснить отказ, не откатывая ввод молча.
 */

describe('домен скидки — 0…10 %', () => {
  it('принимает границы и половины шага', () => {
    for (const raw of ['0', '3', '3,5', '3.5', '10']) {
      expect(parseDiscountPercent(raw), raw).not.toBeNull()
    }
  })

  it('отвергает то, что давало отрицательный итог или надбавку', () => {
    // 200 % давало отрицательный итог, −5 % — надбавку под подписью «Rabatt».
    for (const raw of ['200', '10,5', '-5', '-0,5']) {
      expect(parseDiscountPercent(raw), raw).toBeNull()
    }
  })

  it('отвергает нечисловое, не бросая исключение', () => {
    for (const raw of ['abc', '', ' ', '3,5,5', '1e3', '+3']) {
      expect(() => parseDiscountPercent(raw)).not.toThrow()
      expect(parseDiscountPercent(raw), raw).toBeNull()
    }
  })
})

describe('домен числового поля', () => {
  it('немецкий формат разбирается вместе с разделителем тысяч', () => {
    expect(parseNumericInput('1.500,25')!.toFixed(2)).toBe('1500.25')
    expect(parseNumericInput('2000')!.toFixed(2)).toBe('2000.00')
  })

  it('нечисловое даёт причину, а не исключение', () => {
    expect(() => rejectNumericInput('abc')).not.toThrow()
    expect(rejectNumericInput('abc')).toBe('notANumber')
    expect(parseNumericInput('abc')).toBeNull()
  })

  it('ноль и отрицательное названы причиной, а не отброшены молча', () => {
    // Прежняя версия глотала их условием `next.gt(0)`: поле возвращалось к
    // старому значению, и пользователь не знал почему.
    expect(rejectNumericInput('0')).toBe('notPositive')
    expect(rejectNumericInput('-1')).toBe('notPositive')
  })

  it('счётная величина не принимает дробь', () => {
    // 16,5 Wohneinheiten не существует; стор делил на 16,5, поле показывало 17.
    expect(rejectNumericInput('16,5', { integer: true })).toBe('notInteger')
    expect(rejectNumericInput('16', { integer: true })).toBeNull()
    // Без флага дробь законна: площадь дробной бывает.
    expect(rejectNumericInput('16,5')).toBeNull()
  })
})
