import { beforeEach, describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import { __resetStoreForTests, useStore } from '../store'
import { sumAreaValues } from '../clientProposal'
import {
  COMPARISON_VISIBLE_COLUMN_LIMIT,
  comparisonColumns,
  comparisonGroups,
  comparisonRows,
  visibleComparisonRows,
  type ComparisonRow,
} from '../optionComparison'
import { translate } from '../../i18n'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'

/**
 * D-20 — сравнение Options существует ровно в одном экземпляре.
 *
 * До этого модуля модель сравнения жила внутри экрана `S4Vergleich`, а
 * клиентский слой строил вторую, ДРУГУЮ модель из сохранённых версий.
 * Тест держит границу: набор строк, их порядок, группы и правило
 * видимости принадлежат `optionComparison` и проверяются без рендера.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

const deps = (client: boolean) => ({
  t: (key: string, values?: Readonly<Record<string, string | number>>) =>
    translate(key, 'de', values),
  tx: (deText: string) => deText,
  client,
})

/**
 * Две Options одного проекта: первая доведена до сохранённого базиса
 * (это состояние, в котором Option вообще может попасть к клиенту),
 * вторая — свежесозданная. Ровно та пара, которую показывает `/vergleich`.
 */
function twoOptions() {
  enterOptionWorkspace('DEMO-HAPPY-01')
  completeBuildingScope()
  completeKgConfiguration()
  saveOptionBaseline()
  const first = st().activeOptionId!
  act(() => {
    const created = st().createOption()
    if (!created) throw new Error('second Option was refused')
  })
  return { first, second: st().activeOptionId! }
}

describe('comparisonColumns — одна инстанция колонок', () => {
  it('во внутреннем режиме колонкой становится каждая созданная Option', () => {
    const { first, second } = twoOptions()
    const cols = comparisonColumns(st())
    expect(cols.map((c) => c.option.id)).toEqual([first, second])
    // Каждая колонка несёт живую конфигурацию и живую проекцию.
    expect(cols.every((c) => c.cfg !== null && c.p !== null)).toBe(true)
  })

  it('в клиентской проекции остаются только Options с сохранённым базисом', () => {
    const { first } = twoOptions()
    const cols = comparisonColumns({ ...st(), mode: 'praesentation' })
    expect(cols.map((c) => c.option.id)).toEqual([first])
  })
})

describe('comparisonRows — канонический набор строк', () => {
  it('даёт один и тот же порядок строк и групп для пары Options', () => {
    twoOptions()
    const cols = comparisonColumns(st())
    const rows = comparisonRows(cols, deps(false))
    expect(rows.map((r) => r.id)).toEqual([
      'lead-rate',
      'uncertainty',
      'bauzeit',
      'completion',
      'buildings',
      'basement',
      'bgf-below',
      'kg-700',
      'energy-standard',
      'building-class',
    ])
    expect(rows.map((r) => r.label)).toEqual([
      'Leitkennzahl',
      'Schätzunsicherheit',
      'Bauzeit (ab OKBP)',
      'Fertigstellung',
      'Gebäude im Angebot',
      'Untergeschoss',
      'BGF unterirdisch (m²)',
      'KG 700',
      'Energiestandard',
      'Klassifikation nach MBO §2',
    ])
    expect(comparisonGroups(rows)).toEqual(['ERGEBNIS', 'UMFANG', 'QUALITÄT'])
    // У каждой строки — по ячейке на колонку.
    expect(rows.every((r) => r.cells.length === cols.length)).toBe(true)
  })

  it('KG 700 — внутренняя строка: есть в подготовке, нет в клиентской выдаче', () => {
    twoOptions()
    const cols = comparisonColumns(st())
    expect(comparisonRows(cols, deps(false)).map((r) => r.id)).toContain('kg-700')
    expect(comparisonRows(cols, deps(true)).map((r) => r.id)).not.toContain('kg-700')
    // Ничего, кроме этой строки, клиентский флаг этой модели не забирает.
    // Клиентская ПРЕЗЕНТАЦИЯ читает не эту функцию, а `clientComparisonRows`
    // (VR3-CP-00): она строит те же группы из объявленной клиентской
    // проекции. Здесь проверяется внутренний маршрут `/vergleich`.
    const internal = comparisonRows(cols, deps(false)).map((r) => r.id)
    const client = comparisonRows(cols, deps(true)).map((r) => r.id)
    expect(internal.filter((id) => id !== 'kg-700')).toEqual(client)
  })

  it('идентификаторы строк уникальны', () => {
    twoOptions()
    const cols = comparisonColumns(st())
    for (const client of [false, true]) {
      const ids = comparisonRows(cols, deps(client)).map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('visibleComparisonRows — «различается» вычисляется, а не объявляется', () => {
  // A result row is DECLARED (`result: true`), not recognised by its German
  // group name — the client reading translates the group, the rule must not.
  const row = (id: string, group: string, cells: string[]): ComparisonRow =>
    ({ id, label: id, group, cells, result: group === 'ERGEBNIS' })

  it('ERGEBNIS остаётся даже при одинаковых ячейках, прочее — нет', () => {
    const rows = [
      row('lead-rate', 'ERGEBNIS', ['gleich', 'gleich']),
      row('basement', 'UMFANG', ['gleich', 'gleich']),
      row('bgf-below', 'UMFANG', ['a', 'b']),
    ]
    expect(visibleComparisonRows(rows, false).map((r) => r.id)).toEqual([
      'lead-rate',
      'bgf-below',
    ])
  })

  it('showAll возвращает скрытую строку без изменения порядка', () => {
    const rows = [
      row('lead-rate', 'ERGEBNIS', ['gleich', 'gleich']),
      row('basement', 'UMFANG', ['gleich', 'gleich']),
      row('bgf-below', 'UMFANG', ['a', 'b']),
    ]
    expect(visibleComparisonRows(rows, true).map((r) => r.id)).toEqual([
      'lead-rate',
      'basement',
      'bgf-below',
    ])
  })

  it('на живой паре Options ERGEBNIS виден целиком в обоих положениях', () => {
    twoOptions()
    const rows = comparisonRows(comparisonColumns(st()), deps(false))
    const ergebnis = rows.filter((r) => r.group === 'ERGEBNIS').map((r) => r.id)
    const visible = visibleComparisonRows(rows, false).map((r) => r.id)
    expect(ergebnis.every((id) => visible.includes(id))).toBe(true)
    expect(visibleComparisonRows(rows, true).map((r) => r.id))
      .toEqual(rows.map((r) => r.id))
  })
})

describe('COMPARISON_VISIBLE_COLUMN_LIMIT', () => {
  it('называет число колонок, помещающихся без прокрутки', () => {
    // Оболочка (components.css `--cmp-visible-cols`) вмещает ровно три
    // колонки; четвёртая — первая, которой нужен скроллпорт.
    expect(COMPARISON_VISIBLE_COLUMN_LIMIT).toBe(3)
  })
})

/**
 * ACCEPTANCE REMEDIATION (ACCEPT-08) — an area is summed from the engine's
 * own values, never from what a chapter already printed.
 *
 * Three client chapters used to sum the FORMATTED per-building strings and
 * parse them back with a German-only parser. In English `17,250.00` became
 * `17.25` and `2,220.00` became `98,001.24`: a client-facing area wrong by
 * three orders of magnitude, in the locale nobody demoed. The helper below
 * is the one place the sum happens now, and it only ever sees raw values.
 *
 * The four-value cases matter on their own: the building register's totals
 * row is the consumer that only appears at four buildings or more, which no
 * fixture in this repository exercises.
 */
describe('sumAreaValues — the one place an area total is computed', () => {
  it('sums raw engine values and formats the total once, per locale', () => {
    const raw = ['6030.00', '4800.00', '6420.00']
    expect(sumAreaValues(raw, 'de')).toBe('17.250,00')
    expect(sumAreaValues(raw, 'en')).toBe('17,250.00')
  })

  it('states the same NUMBER in both locales, whatever the separators', () => {
    const raw = ['6030.00', '4800.00', '6420.00', '2220.00']
    const parse = (text: string, language: 'de' | 'en') => Number(
      language === 'de'
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, ''))
    expect(parse(sumAreaValues(raw, 'de')!, 'de'))
      .toBe(parse(sumAreaValues(raw, 'en')!, 'en'))
    expect(parse(sumAreaValues(raw, 'en')!, 'en')).toBe(19470)
  })

  it('is null when no building states the metric — never a zero', () => {
    expect(sumAreaValues([], 'de')).toBeNull()
    expect(sumAreaValues([null, null], 'en')).toBeNull()
    // A single stated value is still a total.
    expect(sumAreaValues([null, '630.00', null], 'de')).toBe('630,00')
  })

  it('ignores a value the engine could not express, rather than counting it as zero', () => {
    expect(sumAreaValues(['6030.00', 'n/a', '4800.00'], 'de')).toBe('10.830,00')
  })
})
