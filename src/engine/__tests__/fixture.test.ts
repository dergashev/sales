import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import demo from '../../fixtures/demo-0001.json'
import catalog from '../../fixtures/catalog.json'
import {
  KG300_SUBGROUPS, RISK_ITEMS, riskDriver, resolveRiskBasis, riskSurchargeExceedsCap,
  subgroupSum, type Kg200Basis, type RiskBases,
} from '../risk'
import {
  aggregateComplex, applyDiscount, calculateBuilding, deriveCompleteness,
  driversSum, kgSplit, totalLabel,
  type BuildingInput, type Catalog, type Coverage,
} from '../calculate'
import { label, present, rate, rateLabel, MONEY } from '../money'
import {
  durationDeltaDays, durationDeltaLabel, modelDuration, presentDuration,
  projectTotalEnd, wholeCalendarMonths,
} from '../schedule'

/**
 * Инварианты §9 `data-model.md` как тесты. Фикстура — единственный
 * санкционированный источник чисел; движок обязан её воспроизводить, а не
 * согласовываться с ней приблизительно.
 *
 * Тест, который проверяет движок против собственных ожиданий, доказывает
 * только внутреннюю согласованность. Здесь сравнение идёт с независимо
 * выведенной фикстурой — той же, которую четыре аудитора пересчитали вручную.
 */

const D = (s: string) => new Decimal(s)

const cat: Catalog = {
  kBase: D(catalog.kBase.value),
  fS: D(catalog.fS),
  costFactors: {
    gebaeudeklasse: Object.fromEntries(
      Object.entries(catalog.costFactors.gebaeudeklasse).map(([k, v]) => [k, D(v)]),
    ),
    energiestandard: Object.fromEntries(
      Object.entries(catalog.costFactors.energiestandard).map(([k, v]) => [k, D(v)]),
    ),
    gebaeudeform: Object.fromEntries(
      Object.entries(catalog.costFactors.gebaeudeform).map(([k, v]) => [k, D(v)]),
    ),
    untergeschoss: {
      vollausbau: D(catalog.costFactors.untergeschoss.vollausbau),
      abDecke: D(catalog.costFactors.untergeschoss.abDecke),
      tiefgarageZuschlag: D(catalog.costFactors.untergeschoss.tiefgarageZuschlag),
      vollausbauMitTiefgarage:
        D(catalog.costFactors.untergeschoss.vollausbauMitTiefgarage),
    },
  },
  kgShares: {
    kg500PercentOfBauwerk: D(catalog.kgShares.kg500PercentOfBauwerk),
    kg700EchtPercentOfBauwerk: D(catalog.kgShares.kg700EchtPercentOfBauwerk),
    vereinfacht: {
      KG_300: D(catalog.kgShares.vereinfacht.KG_300),
      KG_400: D(catalog.kgShares.vereinfacht.KG_400),
      KG_700: D(catalog.kgShares.vereinfacht.KG_700),
    },
    echt: {
      KG_300: D(catalog.kgShares.echt.KG_300),
      KG_400: D(catalog.kgShares.echt.KG_400),
    },
  },
  regionalFactor: { active: false, value: D(catalog.regionalFactor.value) },
}

const COVERAGE_FIXTURE: Coverage = {
  KG_100: 'notApplicable', KG_200: 'excluded',
  KG_300: 'included', KG_400: 'included',
  // Именно это переводит итог в промежуточный во всей фикстуре.
  KG_500: 'unknown',
  KG_600: 'notApplicable', KG_700: 'included', KG_800: 'notApplicable',
}

const hausA: BuildingInput = {
  id: 'DEMO-B-A', gebaeudeform: 'MFH',
  gebaeudeklasse: { value: 'GK_5', confirmed: false },
  energiestandard: 'EH_55',
  bgfRAbove: D('2000.00'), bgfSAbove: D('0.00'),
  bgfBelowGround: D('400.00'),
  untergeschoss: 'vollausbau', hasParking: true,
}

const hausB: BuildingInput = {
  id: 'DEMO-B-B', gebaeudeform: 'BUERO',
  gebaeudeklasse: { value: 'GK_4', confirmed: false },
  energiestandard: 'EH_55',
  bgfRAbove: D('1200.00'), bgfSAbove: D('0.00'),
  bgfBelowGround: D('0.00'),
  untergeschoss: 'kein_ug', hasParking: false,
}

const run = (id: string) => {
  const r = demo.runs.find((x) => x.calculationRunId === id)
  if (!r) throw new Error(`прогон ${id} не найден в фикстуре`)
  return r
}

describe('движок воспроизводит фикстуру', () => {
  it('Haus A · Basis · EH 55 — итог сходится до цента', () => {
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    expect(res.total.exact.toFixed(2)).toBe(run('DEMO-RUN-0007').total.exact)
  })

  it('Haus B · Büro — итог сходится', () => {
    const res = calculateBuilding(hausB, cat, COVERAGE_FIXTURE)
    expect(res.total.exact.toFixed(2)).toBe(run('DEMO-RUN-0008').total.exact)
  })

  it('вариант EH 40 — итог и дельта сходятся', () => {
    const base = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const eh40 = calculateBuilding(
      { ...hausA, energiestandard: 'EH_40' }, cat, COVERAGE_FIXTURE,
    )
    expect(eh40.total.exact.toFixed(2)).toBe(run('DEMO-RUN-0009').total.exact)
    const delta = eh40.total.exact.minus(base.total.exact)
    expect(delta.toFixed(2)).toBe(run('DEMO-RUN-0009').deltaToBase!.exact)
  })

  it('вариант EH 40-NH (QNG) — множитель 1,09 применяется (calculation-spec.md §1)', () => {
    // Ранее тип `energiestandard` не знал `EH_40_NH` при уже одобренном
    // множителе 1,09 — дефект реализации (тикет 627d3191). База: 2.000,00 ×
    // 1.545 = 3.090.000; × GK 5 (1,05) = 3.244.500; × EH 40-NH (1,09) =
    // 3.536.505; + UG vollausbau mit Tiefgarage (400,00 × 1.190) = 476.000 →
    // точно 4.012.505,00.
    const ehNh = calculateBuilding(
      { ...hausA, energiestandard: 'EH_40_NH' }, cat, COVERAGE_FIXTURE,
    )
    expect(ehNh.total.exact.toFixed(2)).toBe('4012505.00')
    const driver = ehNh.drivers.find((d) => d.key === 'energiestandard_EH_40_NH')
    expect(driver).toBeDefined()
    expect(driver!.basis).toEqual({
      kind: 'factor', appliedTo: D('3244500.00'), factor: D('1.09'),
    })
  })

  it('вариант Ohne UG — итог и дельта сходятся', () => {
    const noUg = calculateBuilding(
      { ...hausA, untergeschoss: 'kein_ug' }, cat, COVERAGE_FIXTURE,
    )
    expect(noUg.total.exact.toFixed(2)).toBe(run('DEMO-RUN-0011').total.exact)
  })

  it('комплекс — сумма зданий, ведущая метрика от НАДЗЕМНОЙ площади', () => {
    const a = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const b = calculateBuilding(hausB, cat, COVERAGE_FIXTURE)
    const g = aggregateComplex([a, b], {
      aboveGround: D('3200.00'), rs: D('3600.00'),
    })
    const fx = run('DEMO-RUN-0012')
    expect(g.total.exact.toFixed(2)).toBe(fx.total.exact)
    expect(g.leadRate.display).toBe('1.820')
    // DATA-001: знаменатель обязан совпадать с подписью.
    expect(g.leadRate.denominatorType).toBe('BGF_ABOVE_GROUND')
    expect(g.leadRate.denominator.toFixed(2)).toBe(fx.sumBgfAboveGround)
    expect(g.secondaryRate.display).toBe('1.617')
  })
})

describe('инвариант: сумма драйверов равна итогу', () => {
  it('пять драйверов Haus A складываются в итог', () => {
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    expect(driversSum(res.drivers).toFixed(2)).toBe(res.total.exact.toFixed(2))
    // База, класс, энергостандарт, подвал и надбавка за паркинг. Подвал и
    // паркинг разделены (ревью 26, находки 6 и 7); сумма не изменилась,
    // потому что 1.100 + 90 = 1.190.
    expect(res.drivers).toHaveLength(5)
  })

  it('сплит KG складывается в итог, тотал не меняется (D-07)', () => {
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const split = kgSplit(res.total.exact, cat.kgShares, 'vereinfacht')
    const sum = (Object.values(split) as (Decimal | undefined)[])
      .reduce((a: Decimal, b) => a.plus(b ?? 0), new Decimal(0))
    expect(sum.toFixed(2)).toBe(res.total.exact.toFixed(2))
    const fx = run('DEMO-RUN-0007').kgSplit!
    expect(split.KG_300.toFixed(2)).toBe(fx.KG_300.exact)
    expect(split.KG_400.toFixed(2)).toBe(fx.KG_400.exact)
    expect(split.KG_700!.toFixed(2)).toBe(fx.KG_700.exact)
  })

  it('в режиме echt KG 700 не является долей блока — иначе она проведена дважды', () => {
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const echt = kgSplit(res.total.exact, cat.kgShares, 'echt')
    expect(echt.KG_700).toBeUndefined()
    // Доли другие ровно потому, что KG 700 из блока вышла: 76,2 / 23,8.
    expect(echt.KG_300.plus(echt.KG_400).toFixed(2))
      .toBe(res.total.exact.toFixed(2))
    expect(echt.KG_300.gt(kgSplit(res.total.exact, cat.kgShares, 'vereinfacht').KG_300))
      .toBe(true)
  })
})

describe('BGF S считается по доле f_S (решение D-26)', () => {
  it('у первого сценария S = 0, поэтому контрольные величины НЕ меняются', () => {
    // Это и есть критерий правильности всей правки: если хоть одна
    // контрольная величина DEMO-0001 поехала, разделение сделано неверно.
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    expect(res.total.exact.toFixed(2)).toBe(run('DEMO-RUN-0007').total.exact)
    expect(res.drivers.some((d) => d.key === 'basis_s')).toBe(false)
  })

  it('S оплачивается по 40 % ставки R — отдельным видимым вкладом', () => {
    const withS = calculateBuilding(
      { ...hausA, bgfSAbove: D('100.00') }, cat, COVERAGE_FIXTURE,
    )
    const s = withS.drivers.find((d) => d.key === 'basis_s')!
    expect(s.basis).toMatchObject({ kind: 'rate', denominator: 'BGF_S' })
    const b = s.basis as { kind: 'rate'; quantity: Decimal; rate: Decimal }
    // 100 × 1.545 × 0,40 = 61.800; множители класса и энергостандарта
    // ложатся на сумму базы и S, поэтому сам вклад — до них.
    expect(b.rate.toFixed(2)).toBe('618.00')
    expect(s.exact.toFixed(2)).toBe('61800.00')
  })

  it('множители ложатся и на R, и на S — формула §2 целиком', () => {
    const withS = calculateBuilding(
      { ...hausA, bgfSAbove: D('100.00') }, cat, COVERAGE_FIXTURE,
    )
    const base = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const delta = withS.total.exact.minus(base.total.exact)
    // 100 × 1.545 × 0,40 × 1,05 (GK 5) × 1,03 (EH 55) = 66.836,70
    expect(delta.toFixed(2)).toBe('66836.70')
    expect(driversSum(withS.drivers).toFixed(2)).toBe(withS.total.exact.toFixed(2))
  })

  it('S дешевле R ровно во столько раз, во сколько объявлено', () => {
    const onlyR = calculateBuilding(
      { ...hausA, bgfRAbove: D('2100.00') }, cat, COVERAGE_FIXTURE,
    )
    const rPlusS = calculateBuilding(
      { ...hausA, bgfSAbove: D('100.00') }, cat, COVERAGE_FIXTURE,
    )
    const base = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const deltaR = onlyR.total.exact.minus(base.total.exact)
    const deltaS = rPlusS.total.exact.minus(base.total.exact)
    expect(deltaS.div(deltaR).toFixed(2)).toBe(cat.fS.toFixed(2))
  })
})

describe('Подвал: режим отделки и паркинг — две независимые оси', () => {
  const ug = (mode: BuildingInput['untergeschoss'], hasParking: boolean) =>
    calculateBuilding(
      { ...hausA, untergeschoss: mode, hasParking }, cat, COVERAGE_FIXTURE,
    )
  const ugPart = (mode: BuildingInput['untergeschoss'], hasParking: boolean) =>
    ug(mode, hasParking).drivers
      .filter((d) => d.scopeRefs.includes('UG'))
      .reduce((a, d) => a.plus(d.exact), new Decimal(0))

  it('четыре комбинации дают четыре РАЗНЫЕ суммы подвала', () => {
    // 400 m² UG. Прежний движок знал одну: vollausbau с паркингом.
    expect(ugPart('vollausbau', true).toFixed(2)).toBe('476000.00')
    expect(ugPart('vollausbau', false).toFixed(2)).toBe('440000.00')
    expect(ugPart('ab_decke', true).toFixed(2)).toBe('176000.00')
    expect(ugPart('ab_decke', false).toFixed(2)).toBe('140000.00')
  })

  it('`ab_decke` перестал быть нулём — подвал есть, значит стоит (правило 16)', () => {
    expect(ugPart('ab_decke', true).isZero()).toBe(false)
    // Прежний движок покрывал только `vollausbau`, и выбор `ab_decke`
    // убирал из оффера всю стоимость подвала, не добавляя ничего.
    expect(ugPart('ab_decke', true).lt(ugPart('vollausbau', true))).toBe(true)
  })

  it('`hasParking` действительно читается: разница ровно ставка × площадь', () => {
    const delta = ugPart('vollausbau', true).minus(ugPart('vollausbau', false))
    expect(delta.toFixed(2)).toBe('36000.00')
    expect(delta.toFixed(2))
      .toBe(hausA.bgfBelowGround
        .mul(cat.costFactors.untergeschoss.tiefgarageZuschlag).toFixed(2))
  })

  it('надбавка — ОТДЕЛЬНЫЙ вклад, иначе её нечем назвать и нечем снять', () => {
    const withPark = ug('vollausbau', true).drivers.map((d) => d.key)
    expect(withPark).toContain('untergeschoss_vollausbau')
    expect(withPark).toContain('tiefgarage_zuschlag')
    expect(ug('vollausbau', false).drivers.map((d) => d.key))
      .not.toContain('tiefgarage_zuschlag')
  })

  it('нет подземной площади — нет и вклада, при любом режиме', () => {
    for (const mode of ['vollausbau', 'ab_decke', 'kein_ug'] as const) {
      const r = calculateBuilding(
        { ...hausA, untergeschoss: mode, bgfBelowGround: new Decimal(0) },
        cat, COVERAGE_FIXTURE,
      )
      expect(r.drivers.some((d) => d.scopeRefs.includes('UG')), mode).toBe(false)
    }
  })

  it('сумма драйверов сходится с итогом во всех четырёх комбинациях', () => {
    for (const mode of ['vollausbau', 'ab_decke'] as const) {
      for (const hasParking of [true, false]) {
        const r = ug(mode, hasParking)
        expect(driversSum(r.drivers).toFixed(2), `${mode}/${hasParking}`)
          .toBe(r.total.exact.toFixed(2))
      }
    }
  })
})

describe('CALC-007: точное против показанного', () => {
  it('скидка берётся от ТОЧНОГО итога, не от показанного', () => {
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    const disc = applyDiscount(res.total.exact, D('3'))
    expect(disc.exact.toFixed(2)).toBe(demo.discount.result.exact)
    // От показанного получилось бы 3.703.460 — на 160 € больше.
    const wrong = D('3818000').mul('0.97')
    expect(disc.exact.equals(wrong)).toBe(false)
  })

  it('префикс ≈ появляется ровно когда показ отличается от точного', () => {
    const differs = present(D('3817835.00'), MONEY)
    expect(differs.prefix).toBe('≈')
    expect(differs.display).toBe('3.818.000')
    expect(differs.disclosure).toContain('3.817.835,00')

    // Обратный случай — тоже дефект: префикс у неизменившегося значения
    // утверждает расхождение, которого нет.
    const exactHit = present(D('476000.00'), MONEY)
    expect(exactHit.prefix).toBe('')
    expect(exactHit.disclosure).toBeNull()
  })

  it('удельные из фикстуры воспроизводятся с верным знаменателем', () => {
    for (const r of demo.rates) {
      const computed = rate(
        D(r.numerator), D(r.denominator), r.denominatorType as never,
      )
      expect(computed.display).toBe(r.display)
      expect(computed.prefix).toBe(r.prefix)
    }
  })

  it('подпись ставки всегда называет норматив знаменателя', () => {
    const r = rate(D('3817835.00'), D('1500.00'), 'WFL_WOFLV')
    expect(rateLabel(r)).toContain('WFL nach WoFlV')
    const r2 = rate(D('2005101.00'), D('960.00'), 'NUF_DIN277')
    expect(rateLabel(r2)).toContain('NUF nach DIN 277')
  })

  it('денежная подпись несёт узкий неразрывный пробел', () => {
    expect(label(present(D('3817835.00')))).toBe('≈ 3.818.000 €')
  })
})

describe('R-18 и CALC-006: подпись итога выводится, не задаётся', () => {
  it('unknown в покрытии даёт промежуточный итог', () => {
    const { completeness, reasons } = deriveCompleteness(COVERAGE_FIXTURE, [], 0)
    expect(completeness).toBe('incomplete')
    // Причина — типизированный код, не строка (дефект 13 ревью № 13).
    expect(reasons).toContainEqual({ code: 'coverageUnknown', groups: ['KG_500'] })
    expect(totalLabel(completeness, 'Grundleistung All3'))
      .toBe('Zwischensumme der kalkulierten Positionen')
  })

  it('явное «по запросу» полноту НЕ нарушает — это решение, а не пробел', () => {
    const cov: Coverage = { ...COVERAGE_FIXTURE, KG_500: 'onRequest' }
    const { completeness } = deriveCompleteness(cov, [], 0)
    expect(completeness).toBe('complete')
  })

  it('unanswered core scope is incomplete while retaining legacy arithmetic', () => {
    const resolved: Coverage = { ...COVERAGE_FIXTURE, KG_500: 'excluded' }
    const mandatoryUnknown: Coverage = {
      ...resolved,
      KG_300: 'unknown', KG_400: 'unknown', KG_700: 'unknown',
    }
    const confirmedHausA: BuildingInput = {
      ...hausA,
      gebaeudeklasse: { ...hausA.gebaeudeklasse, confirmed: true },
    }

    const includedResult = calculateBuilding(confirmedHausA, cat, resolved)
    const unknownResult = calculateBuilding(confirmedHausA, cat, mandatoryUnknown)

    expect(unknownResult.completeness).toBe('incomplete')
    expect(unknownResult.incompleteReasons)
      .toContainEqual(expect.objectContaining({ code: 'coverageUnknown' }))
    // Покрытие обязательных групп меняет только интерпретацию полноты:
    // арифметика и состав ценовых вкладов остаются идентичными.
    expect(unknownResult.total.exact.toFixed()).toBe(includedResult.total.exact.toFixed())
    expect(unknownResult.drivers.map((driver) => [driver.key, driver.exact.toFixed()]))
      .toEqual(includedResult.drivers.map((driver) => [driver.key, driver.exact.toFixed()]))
  })

  it('полный итог без названного объёма невозможен', () => {
    expect(() => totalLabel('complete', '   ')).toThrow(/Unqualified Total/)
    expect(totalLabel('complete', 'Grundleistung All3'))
      .toBe('Gesamt netto · Grundleistung All3')
  })

  it('неподтверждённый класс здания сам делает итог неполным', () => {
    const cov: Coverage = { ...COVERAGE_FIXTURE, KG_500: 'onRequest' }
    const res = calculateBuilding(hausA, cat, cov)
    expect(res.completeness).toBe('incomplete')
    expect(res.incompleteReasons).toContainEqual({ code: 'gebaeudeklasseUnconfirmed' })
  })
})

describe('D-15 и CALC-009: региональный фактор', () => {
  it('выключен по умолчанию — вклад ноль', () => {
    const res = calculateBuilding(hausA, cat, COVERAGE_FIXTURE)
    expect(res.drivers.some((d) => d.key === 'regionalfaktor')).toBe(false)
  })

  it('включённый применяется к блоку Bauwerk и даёт объявленный эффект', () => {
    const active: Catalog = {
      ...cat, regionalFactor: { active: true, value: D(catalog.regionalFactor.value) },
    }
    const res = calculateBuilding(hausA, active, COVERAGE_FIXTURE)
    const rf = res.drivers.find((d) => d.key === 'regionalfaktor')
    expect(rf).toBeDefined()
    // Фикстура объявляет «дал бы ≈ 305.000 €».
    expect(present(rf!.exact).display).toBe('305.000')
  })
})

describe('D-17: длительность и её подпись', () => {
  it('целый интервал показывается целым числом без префикса', () => {
    expect(wholeCalendarMonths('2027-01-04', '2027-04-04')).toBe(3)
    const d = presentDuration(
      { metricKey: 'project.planning', kind: 'planning',
        startDate: '2027-01-04', endDate: '2027-04-04', durationBasis: 'calendarDay' },
      null,
    )
    expect(d.display).toBe('3 Monate')
    expect(d.prefix).toBe('')
    expect(d.policy).toBe('wholeCalendarMonthsElseDays')
  })

  it('несовпадающий день месяца — половина месяца с префиксом', () => {
    expect(wholeCalendarMonths('2027-04-04', '2027-11-19')).toBeNull()
    const exact = modelDuration(D('2000.00'), D('1.00'), D('1.15'))
    expect(exact.toFixed(6)).toBe('7.283333')
    const d = presentDuration(
      { metricKey: 'building:DEMO-B-A.execution', kind: 'buildingExecution',
        startDate: '2027-04-04', endDate: '2027-11-19', durationBasis: 'calendarDay' },
      exact,
    )
    expect(d.display).toBe('7,5 Monate')
    expect(d.prefix).toBe('≈')
    expect(d.policy).toBe('halfMonthRounded')
    expect(d.completionDate).toBe('2027-11-19')
  })

  it('площадь реального проекта дала бы ДРУГУЮ ветку правила', () => {
    // 1.969,67 — площадь реального Referenzprojekt R-01. Она даёт 7,236827…,
    // что округляется до целых 7 и требует подписи без десятичной части.
    // Подстановка реального числа в синтетический расчёт ломает не подпись,
    // а ветку правила — этот тест сторожит именно её.
    const real = modelDuration(D('1969.67'), D('1.00'), D('1.15'))
    expect(real.toFixed(6)).toBe('7.236827')
    const synthetic = modelDuration(D('2000.00'), D('1.00'), D('1.15'))
    expect(real.equals(synthetic)).toBe(false)
  })

  it('итог проекта — max(конец), не сумма длительностей', () => {
    const end = projectTotalEnd([
      { metricKey: 'building:A.execution', kind: 'buildingExecution',
        startDate: '2027-04-04', endDate: '2027-11-19', durationBasis: 'calendarDay' },
      { metricKey: 'building:B.execution', kind: 'buildingExecution',
        startDate: '2027-07-04', endDate: '2028-01-04', durationBasis: 'calendarDay' },
    ])
    expect(end).toBe('2028-01-04')
    expect(wholeCalendarMonths('2027-01-04', end)).toBe(12)
  })

  it('дельта срока — в днях, потому что разность округлённых месяцев лжёт', () => {
    const days = durationDeltaDays('2027-11-19', '2027-10-04')
    expect(days).toBe(-46)
    expect(durationDeltaLabel(days)).toBe('46 Kalendertage früher')
  })
})

describe('фикстура воспроизводит блокирующий сценарий', () => {
  it('открытый блокер закрывает все пять клиентских профилей', () => {
    const issue = demo.validationIssues[0]!
    expect(issue.state).toBe('open')
    expect(issue.materiality).toBe('material')
    expect(issue.blockedOutputProfiles).toHaveLength(5)
    expect(issue.blockedOutputProfiles).toContain('clientLiveConfiguration')
  })

  it('конфликт значения не блокирует профили — площадь не цена и не срок', () => {
    const c = demo.conflicts[0]!
    expect(c.state).toBe('open')
    expect(c.materiality).toBe('warning')
    // Второй кандидат остаётся alternative, а не superseded (SOURCE-001).
    expect(c.candidates[1]!.selectionStatus).toBe('alternative')
  })

  it('оба кандидата конфликта дают воспроизводимые ставки', () => {
    const total = D(run('DEMO-RUN-0007').total.exact)
    const r1 = rate(total, D(demo.conflicts[0]!.candidates[0]!.value), 'WFL_WOFLV')
    const r2 = rate(total, D(demo.conflicts[0]!.candidates[1]!.value), 'WFL_WOFLV')
    expect(r1.display).toBe('2.545')
    expect(r2.display).toBe('2.447')
  })
})

describe('ни один итог фикстуры не называется полным', () => {
  it('все пять прогонов несут промежуточную подпись', () => {
    for (const r of demo.runs) {
      expect(r.label).toBe('Zwischensumme der kalkulierten Positionen')
      expect(r.completeness).toBe('incomplete')
    }
  })
})

describe('Третий уровень KG 300 и надбавки за риск (решение PO 07.08, D-02)', () => {
  it('сумма подгрупп равна группе — иначе разбиение врёт о самом себе', () => {
    const kg300 = new Decimal('2672484.50')
    expect(subgroupSum(kg300).toFixed(2)).toBe(kg300.toFixed(2))
    // Восемь подгрупп DIN 276, доли объявлены фикстурой и в сумме дают 1.
    expect(KG300_SUBGROUPS).toHaveLength(8)
    const shares = KG300_SUBGROUPS.reduce((a, g) => a.plus(g.share), new Decimal(0))
    expect(shares.toFixed(2)).toBe('1.00')
  })

  /**
   * Базы надбавок, как их подаёт расчёт. `kg200` объявляется отдельным
   * состоянием, а не числом: KG 200 в `K_base` не входит и существует
   * только по решению о включении группы.
   */
  const bases = (kg300: Decimal, kg200: Kg200Basis = { kind: 'notIncluded' }): RiskBases =>
    ({ kg300Exact: kg300, kg200 })

  it('надбавка считается от СВОЕЙ базы, а не от группы целиком', () => {
    const kg300 = new Decimal('1000000')
    const baugrund = RISK_ITEMS.find((r) => r.id === 'RISK-BAUGRUND')!
    const d = riskDriver(baugrund, bases(kg300))!
    // KG 320 = 11 % от KG 300; надбавка = 4 % от KG 320, а не от KG 300.
    expect(d.basis).toMatchObject({ kind: 'factor' })
    const b = d.basis as { kind: 'factor'; appliedTo: Decimal; factor: Decimal }
    expect(b.appliedTo.toFixed(2)).toBe('110000.00')
    expect(d.exact.toFixed(2)).toBe('4400.00')
    expect(d.exact.toFixed(2)).not.toBe(kg300.mul('0.04').toFixed(2))
    expect(d.scopeRefs).toEqual(['KG 320'])
  })

  it('риск с базой KG 300 берёт группу целиком — база названа в самой записи', () => {
    const kg300 = new Decimal('1000000')
    const statik = RISK_ITEMS.find((r) => r.id === 'RISK-STATIK')!
    const d = riskDriver(statik, bases(kg300))!
    const b = d.basis as { kind: 'factor'; appliedTo: Decimal; factor: Decimal }
    expect(b.appliedTo.toFixed(2)).toBe('1000000.00')
    expect(d.exact.toFixed(2)).toBe('20000.00')
  })

  /**
   * All SIX drivers of calculation-spec §1.4, and the exact numbers.
   *
   * The catalogue implemented TWO of them. The other four were not merely
   * missing: `catalog.json`'s `internalConfig.riskDrivers` already declared
   * all six and `S6Einstellungen` already PRINTED all six, so the product
   * named four risk surcharges it could not apply under any state. One of
   * them declared `KG 200`, a basis `riskDriver` could not resolve at all.
   */
  it('§1.4: все шесть драйверов существуют со своими ставками и базами', () => {
    expect(RISK_ITEMS).toHaveLength(6)
    // Порядок — порядок таблицы §1.4, не порядок дописывания.
    expect(RISK_ITEMS.map((r) => [r.id, r.base, r.rate])).toEqual([
      ['RISK-BAUGRUND', 'KG_320', '0.04'],
      ['RISK-GRUNDWASSER', 'KG_320', '0.03'],
      ['RISK-STATIK', 'KG_300', '0.02'],
      ['RISK-BAUSTELLE', 'KG_300', '0.03'],
      ['RISK-BESTAND', 'KG_200', '0.05'],
      ['RISK-DENKMAL', 'KG_300', '0.03'],
    ])
    // Каждый несёт обе локали (правило 36) и способ снятия (D-02).
    for (const r of RISK_ITEMS) {
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.labelEn.length).toBeGreaterThan(0)
      expect(r.remedy.length).toBeGreaterThan(0)
      expect(r.remedyEn.length).toBeGreaterThan(0)
    }
  })

  /**
   * Ни одна объявленная база не остаётся неразрешимой.
   *
   * Это тот самый дефект в форме инварианта: `base: 'KG_200'` возвращал
   * `undefined` и вызывающий отбрасывал драйвер молча. Теперь неизвестная
   * база — объявленное состояние `unknownBase`, и его существование
   * запрещено для КАЖДОГО элемента каталога.
   */
  it('каждая объявленная база разрешается движком — молчаливого пропуска нет', () => {
    const kg300 = new Decimal('1000000')
    for (const risk of RISK_ITEMS) {
      for (const kg200 of [
        { kind: 'notIncluded' } as const,
        { kind: 'notDetermined' } as const,
        { kind: 'amount', exact: new Decimal('500000') } as const,
      ]) {
        expect(resolveRiskBasis(risk, bases(kg300, kg200)).kind).not.toBe('unknownBase')
      }
    }
  })

  /**
   * The KG 200 basis has three answers and none of them is a silent zero.
   *
   * KG 200 is not part of `K_base`; it exists only once the group is
   * included and priced. `+5 %` of a group that is not in the offer is not
   * zero — it is out of scope; `+5 %` of a group that still owes a position
   * is not zero either — it is not determined (rule 16). Only a complete
   * KG 200 amount produces money.
   */
  it('база KG 200: три состояния, ни одно не подменяется нулём', () => {
    const kg300 = new Decimal('1000000')
    const bestand = RISK_ITEMS.find((r) => r.id === 'RISK-BESTAND')!
    expect(bestand.base).toBe('KG_200')

    const outOfScope = resolveRiskBasis(bestand, bases(kg300, { kind: 'notIncluded' }))
    expect(outOfScope).toEqual({ kind: 'outOfScope', reason: 'kg200NotIncluded' })
    expect(riskDriver(bestand, bases(kg300, { kind: 'notIncluded' }))).toBeNull()

    const unknown = resolveRiskBasis(bestand, bases(kg300, { kind: 'notDetermined' }))
    expect(unknown).toEqual({ kind: 'notDetermined', reason: 'kg200NotDetermined' })
    expect(riskDriver(bestand, bases(kg300, { kind: 'notDetermined' }))).toBeNull()

    // A real KG 200 amount: 5 % of it, on ITS OWN base — never on KG 300.
    const priced = riskDriver(
      bestand, bases(kg300, { kind: 'amount', exact: new Decimal('325000') }),
    )!
    const b = priced.basis as { kind: 'factor'; appliedTo: Decimal; factor: Decimal }
    expect(b.appliedTo.toFixed(2)).toBe('325000.00')
    expect(priced.exact.toFixed(2)).toBe('16250.00')
    expect(priced.scopeRefs).toEqual(['KG 200'])
    // And decidedly NOT 5 % of KG 300, the denominator it would have
    // borrowed had the base fallen through to the KG 300 branch.
    expect(priced.exact.toFixed(2)).not.toBe(kg300.mul('0.05').toFixed(2))
  })

  /**
   * The §1.4 cap is a WARNING threshold, not a clamp.
   *
   * The specification says the system "выдаёт предупреждение, а не молча
   * суммирует" and gives no truncation rule. Inventing one would name a
   * price no source states, so the predicate reports and never reduces.
   */
  it('§1.4: порог 12 % от Bauwerk сообщается, а не усекает', () => {
    const cap = new Decimal(catalog.internalConfig.riskCapPercentOfBauwerk)
    expect(cap.toFixed(0)).toBe('12')
    const bauwerk = new Decimal('1000000')
    expect(riskSurchargeExceedsCap(new Decimal('119999'), bauwerk, cap)).toBe(false)
    expect(riskSurchargeExceedsCap(new Decimal('120000'), bauwerk, cap)).toBe(false)
    expect(riskSurchargeExceedsCap(new Decimal('120001'), bauwerk, cap)).toBe(true)
    // Нет базы — нет и порога: 12 % от нуля не является утверждением.
    expect(riskSurchargeExceedsCap(new Decimal('1'), new Decimal(0), cap)).toBe(false)
  })

  /**
   * `catalog.json` и `derived-prototype.json` описывают ОДИН каталог.
   *
   * `S6Einstellungen` печатает первый, движок исполняет второй. Пока они
   * расходились, экран настроек называл шесть надбавок, а применить можно
   * было две — «одна сущность, два имени», класс, который `CLAUDE.md`
   * называет самым дорогим. Сверка поштучная, а не по количеству.
   */
  it('печатаемый каталог надбавок совпадает с исполняемым — поле за полем', () => {
    const printed = catalog.internalConfig.riskDrivers
    expect(printed).toHaveLength(RISK_ITEMS.length)
    for (const [i, item] of RISK_ITEMS.entries()) {
      const row = printed[i]!
      // `catalog.json` печатает код параметра в подписи, движок держит его
      // отдельным полем — сравнивается подпись без кода (DC-44).
      expect(row.label.replace(/ \(`[^`]+`\)/, '')).toBe(item.label)
      expect(row.base).toBe(item.base.replace('_', ' '))
      expect(new Decimal(row.ratePercent).div(100).toFixed(2))
        .toBe(new Decimal(item.rate).toFixed(2))
      const code = / \(`([^`]+)`\)/.exec(row.label)?.[1]
      expect(item.sourceParameter ?? undefined).toBe(code)
    }
  })
})
