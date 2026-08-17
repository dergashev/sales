import { describe, expect, it } from 'vitest'
import { shiftScheduleMetrics } from '../schedule'

/**
 * Construction Period (тикет KG300/400/700 + Bauzeit-Reise, Tech Review
 * P2): `shiftScheduleMetrics` — единственное место, где выбранный Baubeginn
 * превращается в новые календарные даты. Тесты фиксируют ровно то, что
 * функция обещает в своём докстринге: якорь двигается, длительность
 * (разница в днях между началом и концом каждой метрики) — нет.
 */
describe('shiftScheduleMetrics', () => {
  it('без изменения якоря возвращает те же значения (delta = 0)', () => {
    const metrics = [
      { startDate: '2027-01-04', endDate: '2027-04-04' },
      { startDate: '2027-04-04', endDate: '2027-11-19' },
    ]
    const out = shiftScheduleMetrics(metrics, '2027-01-04', '2027-01-04')
    expect(out).toEqual(metrics)
  })

  it('сдвигает обе даты каждой метрики на одну и ту же дельту дней', () => {
    const metrics = [
      { startDate: '2027-01-04', endDate: '2027-04-04' },
      { startDate: '2027-04-04', endDate: '2027-11-19' },
    ]
    // 2027-03-01 на 56 дней позже 2027-01-04.
    const out = shiftScheduleMetrics(metrics, '2027-01-04', '2027-03-01')
    expect(out[0]).toEqual({ startDate: '2027-03-01', endDate: '2027-05-30' })
    expect(out[1]).toEqual({ startDate: '2027-05-30', endDate: '2028-01-14' })
    // Длительность в днях не меняется — сдвигается только якорь.
    const days = (a: string, b: string) =>
      Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
    expect(days(out[0]!.startDate, out[0]!.endDate))
      .toBe(days(metrics[0]!.startDate, metrics[0]!.endDate))
    expect(days(out[1]!.startDate, out[1]!.endDate))
      .toBe(days(metrics[1]!.startDate, metrics[1]!.endDate))
  })

  it('сдвиг назад (более ранний Baubeginn) вычитает дни корректно', () => {
    const metrics = [{ startDate: '2027-04-04', endDate: '2027-11-19' }]
    const out = shiftScheduleMetrics(metrics, '2027-04-04', '2027-01-04')
    expect(out[0]).toEqual({ startDate: '2027-01-04', endDate: '2027-08-21' })
  })

  it('корректно пересекает високосный февраль', () => {
    // 2028 — високосный год: сдвиг через 29.02 не должен потерять день.
    const metrics = [{ startDate: '2028-02-01', endDate: '2028-03-01' }]
    const out = shiftScheduleMetrics(metrics, '2028-02-01', '2028-02-15')
    // 2028-02-01 -> 2028-03-01 = 29 дней (високосный год); от 15.02 + 29 = 15.03.
    expect(out[0]).toEqual({ startDate: '2028-02-15', endDate: '2028-03-15' })
  })

  it('сохраняет прочие поля метрики нетронутыми (generic, не только ScheduleMetric)', () => {
    const metrics = [
      { metricKey: 'project.planning', kind: 'planning' as const, startDate: '2027-01-04', endDate: '2027-04-04' },
    ]
    const out = shiftScheduleMetrics(metrics, '2027-01-04', '2027-02-01')
    expect(out[0]!.metricKey).toBe('project.planning')
    expect(out[0]!.kind).toBe('planning')
  })
})
