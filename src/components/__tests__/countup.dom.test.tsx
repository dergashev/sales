import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useCountUp } from '../primitives'

/**
 * Счёт числа (правило 19) обязан оставаться МЕЖДУ прежним и новым значением.
 *
 * Повод найден в дампе DOM другого теста: герой показывал `≈ -1.821.397 €`
 * при итоге около четырёх миллионов. Отрицательная сумма на самом крупном
 * элементе продукта — не «артефакт анимации», а неверное число на экране
 * переговоров, пусть и на один кадр.
 *
 * Механизм неочевиден и потому воспроизводится здесь явно: `rAF` отдаёт
 * время НАЧАЛА кадра, и оно бывает раньше, чем `performance.now()`, взятое
 * в том же кадре при выполнении эффекта. Прогресс зажимался только сверху,
 * поэтому отрицательный `t` уходил в кубическую функцию сглаживания и давал
 * большой выброс вниз.
 *
 * Часы теста — свои: у `rAF` в jsdom отметка времени не связана с
 * `performance.now()`, и на таком клубке нельзя отличить исправленное
 * поведение от неработающего.
 */

let now = 0
let queue: FrameRequestCallback[] = []

beforeEach(() => {
  now = 1000
  queue = []
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb)
    return queue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => vi.unstubAllGlobals())

/** Один кадр с явной отметкой времени — в том числе «из прошлого». */
async function frame(stamp: number) {
  const due = queue
  queue = []
  await act(async () => { due.forEach((cb) => cb(stamp)) })
}

function Probe({ value }: { value: string }) {
  return <output>{useCountUp(new Decimal(value), 0)}</output>
}

describe('useCountUp: кадр не выходит за пределы перехода', () => {
  it('отметка кадра из прошлого не даёт выброса — прежде давала минус', async () => {
    const view = render(<Probe value="3817835" />)
    const read = () => view.container.querySelector('output')!.textContent ?? ''

    now = 2000
    view.rerender(<Probe value="4123261" />)
    // Кадр «раньше» момента, когда эффект взял отсчёт: ровно тот случай.
    await frame(1990)
    const n = Number(read().replace(/\./g, ''))
    expect(n, `выброс: ${read()}`).toBeGreaterThanOrEqual(3817835)
    expect(n, `выброс: ${read()}`).toBeLessThanOrEqual(4123261)
  })

  it('счёт доходит до цели и на ней останавливается', async () => {
    const view = render(<Probe value="3817835" />)
    const read = () => view.container.querySelector('output')!.textContent ?? ''
    now = 2000
    view.rerender(<Probe value="4123261" />)
    for (const stamp of [2100, 2200, 2300, 2400, 2500]) await frame(stamp)
    expect(read()).toBe('4.123.261')
  })

  it('смена цели на лету продолжает счёт с показанного, а не с прежней цели', async () => {
    const view = render(<Probe value="3817835" />)
    const read = () => view.container.querySelector('output')!.textContent ?? ''
    now = 2000
    view.rerender(<Probe value="5822936" />)
    await frame(2100)
    const mid = Number(read().replace(/\./g, ''))
    expect(mid).toBeGreaterThan(3817835)
    expect(mid).toBeLessThan(5822936)

    // Разворот на середине. Прежде старт брался от ПРЕЖНЕЙ ЦЕЛИ, и первый
    // же кадр прыгал на значение, которого на экране не было, — это подмена,
    // а правило 19 требует счёта.
    now = 2100
    view.rerender(<Probe value="3817835" />)
    await frame(2110)
    const back = Number(read().replace(/\./g, ''))
    expect(back).toBeLessThanOrEqual(mid)
    expect(back).toBeGreaterThanOrEqual(3817835)
  })
})
