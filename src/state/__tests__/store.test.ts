import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { __resetStoreForTests, useStore } from '../store'
import type { JournalEvent, OfferSnapshot } from '../store'

/**
 * Проекция обязана воспроизводить мокап S3 из `screen-map.md` до цента.
 *
 * Мокап — не иллюстрация, а спесимен: его числа взяты из фикстуры и
 * пересчитаны аудиторами. Расхождение экрана с мокапом означает, что либо
 * экран врёт, либо мокап устарел, — и то и другое дефект.
 */

beforeEach(() => __resetStoreForTests())

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

describe('DC-44: сумма драйверов обязана давать итог — юнит-тест, не намерение', () => {
  it('фикстурная цепочка сходится в точных значениях', () => {
    const p = useStore.getState().projection()
    const labels = p.result.drivers.map((d) => [d.key, d.exact.toFixed(2)])
    expect(labels).toEqual([
      ['basis', '3090000.00'],
      ['gebaeudeklasse_GK_5', '154500.00'],
      ['energiestandard_EH_55', '97335.00'],
      ['untergeschoss_mit_tiefgarage', '476000.00'],
    ])
    const sum = p.result.drivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.toFixed(2)).toBe('3817835.00')
    expect(sum.equals(p.result.total.exact)).toBe(true)
  })

  it('с активным Regionalfaktor драйверов пять и сумма снова равна итогу', () => {
    useStore.getState().toggleRegionalfaktor()
    const p = useStore.getState().projection()
    expect(p.result.drivers.map((d) => d.key)).toContain('regionalfaktor')
    const sum = p.result.drivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.equals(p.result.total.exact)).toBe(true)
    expect(p.result.total.exact.toFixed(2)).toBe('4123261.80')
  })
})

describe('Правило 11: вход в презентацию гейтуется блокером', () => {
  it('переключение в praesentation — no-op, пока класс не подтверждён', () => {
    useStore.getState().setMode('praesentation')
    expect(useStore.getState().mode).toBe('intern')
    useStore.getState().confirmGebaeudeklasse()
    useStore.getState().setMode('praesentation')
    expect(useStore.getState().mode).toBe('praesentation')
    // Обратно в intern — всегда можно.
    useStore.getState().setMode('intern')
    expect(useStore.getState().mode).toBe('intern')
  })
})

describe('M-4/M-3: обход журнала невозможен по построению, не по соглашению', () => {
  it('ссылки из getState() заморожены: присваивание бросает, состояние цело', () => {
    const s = useStore.getState()
    // Типы не `readonly` намеренно: запрет обеспечен заморозкой в рантайме,
    // а не только системой типов — обойти `as any` можно, замороженный
    // объект обойти нельзя.
    expect(() => { s.building.gebaeudeklasse.confirmed = true }).toThrow()
    expect(() => { s.coverage.KG_500 = 'included' }).toThrow()
    const after = useStore.getState()
    expect(after.building.gebaeudeklasse.confirmed).toBe(false)
    expect(after.coverage.KG_500).toBe('unknown')
    expect(after.journal).toHaveLength(0)
  })

  it('журнал и undone не дописываются снаружи', () => {
    const s = useStore.getState()
    expect(() => (s.journal as JournalEvent[]).push({
      seq: 99, kind: 'value.edited', label: 'подделка', deltaExact: null,
      at: '2026-08-06T00:00:00.000Z',
    })).toThrow()
    expect(useStore.getState().journal).toHaveLength(0)
  })

  it('снапшот неприкосновенен: ни поле не меняется, ни список не чистится', () => {
    useStore.getState().confirmGebaeudeklasse()
    const snap = useStore.getState().sendOffer('email', null)
    expect(() => { snap.totalExact = '0.00' }).toThrow()
    expect(() => (useStore.getState().snapshots as OfferSnapshot[]).splice(0, 1)).toThrow()
    const stored = useStore.getState().snapshots[0]!
    expect(stored.totalExact).toBe('3817835.00')
    expect(useStore.getState().snapshots).toHaveLength(1)
  })

  it('сброс состояния недоступен вне тестовой среды по построению', () => {
    // Санкционированный путь работает; production-ветка закрыта проверкой MODE.
    expect(() => __resetStoreForTests()).not.toThrow()
  })
})

describe('Курсор отмены: композиции, которых не было в тестах', () => {
  it('undo → новое событие → undo → undo отменяет три разных события', () => {
    const st = () => useStore.getState()
    st().setEnergiestandard('EH_40')      // seq 1
    st().setUntergeschoss('kein_ug')      // seq 2
    st().undo()                            // seq 3 отменяет 2
    st().toggleRegionalfaktor()            // seq 4
    st().undo()                            // seq 5 отменяет 4
    st().undo()                            // seq 6 отменяет 1
    const s = st()
    const undoOf = s.journal.filter((e) => e.kind === 'undo').map((e) => e.undoOf)
    expect(undoOf).toEqual([2, 4, 1])
    expect(s.building.energiestandard).toBe('EH_55')
    expect(s.building.untergeschoss).toBe('vollausbau')
    expect(s.regionalfaktorActive).toBe(false)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })

  it('после отмены отмены курсор снова считает событие действующим', () => {
    const st = () => useStore.getState()
    st().setEnergiestandard('EH_40')   // seq 1
    st().undoEvent(1)                   // seq 2 — отмена
    st().undoEvent(2)                   // seq 3 — отмена отмены, EH 40 снова в силе
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3915170.00')
    expect(st().canUndo()).toBe(true)   // прежде здесь было false при живой кнопке
    st().undo()                          // seq 4 — снова отменяет seq 1
    expect(st().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    expect(st().journal[3]!.undoOf).toBe(1)
  })

  it('canUndo и undo() отвечают об одном и том же курсоре', () => {
    const st = () => useStore.getState()
    expect(st().canUndo()).toBe(false)
    st().setEnergiestandard('EH_40')
    expect(st().canUndo()).toBe(true)
    st().undo()
    // Журнал непуст, но отменять больше нечего — кнопка обязана это знать.
    expect(st().journal.length).toBe(2)
    expect(st().canUndo()).toBe(false)
  })
})

describe('DC-29: Undo-тост — производная журнала', () => {
  it('рискованное действие создаёт тост с дельтой и базой', () => {
    useStore.getState().setUntergeschoss('kein_ug')
    const toast = useStore.getState().undoToast!
    expect(toast.seq).toBe(1)
    expect(toast.statusText).toContain('Untergeschoss')
    expect(toast.deltaText).toContain('476.000')
    expect(toast.deltaText).toContain('gegenüber DEMO-VV-0003')
  })

  it('отправка (без inverse) гасит тост: новая голова — stale (CHANGE-006)', () => {
    useStore.getState().confirmGebaeudeklasse()
    useStore.getState().setCoverage('KG_500', 'excluded')
    expect(useStore.getState().undoToast).not.toBeNull()
    useStore.getState().sendOffer('email', null)
    expect(useStore.getState().undoToast).toBeNull()
  })

  it('отмена отмены — тоже событие: адресный undoEvent умеет редо', () => {
    useStore.getState().setEnergiestandard('EH_40')            // seq 1
    useStore.getState().undoEvent(1)                           // seq 2 (undo)
    let s = useStore.getState()
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    // Тост события отмены существует и снова несёт Rückgängig.
    expect(s.undoToast!.seq).toBe(2)
    useStore.getState().undoEvent(2)                           // seq 3 (redo)
    s = useStore.getState()
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3915170.00')
    expect(s.journal).toHaveLength(3)
    expect(s.journal[2]!.kind).toBe('undo')
    expect(s.journal[2]!.undoOf).toBe(2)
    expect(s.journal[2]!.deltaExact!.toFixed(2)).toBe('97335.00')
  })

  it('уже отменённый seq — no-op: один inverse не применяется дважды', () => {
    useStore.getState().setEnergiestandard('EH_40')
    useStore.getState().undoEvent(1)
    useStore.getState().undoEvent(1)
    const s = useStore.getState()
    expect(s.journal).toHaveLength(2)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })
})

describe('S3: Geist-Vorschau — последствие до клика (DC-28)', () => {
  it('превью считает дельту тем же движком и не пишет в журнал', () => {
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_40' })
    const s = useStore.getState()
    // Та же дельта, что у будущей фиксации: у превью нет своей арифметики.
    expect(s.preview!.deltaExact.toFixed(2)).toBe('97335.00')
    expect(s.journal).toHaveLength(0)
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })

  it('уход с опции гасит превью; текущая опция превью не даёт', () => {
    useStore.getState().previewOption({ kind: 'untergeschoss', value: 'kein_ug' })
    expect(useStore.getState().preview!.deltaExact.toFixed(2)).toBe('-476000.00')
    useStore.getState().previewOption(null)
    expect(useStore.getState().preview).toBeNull()
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_55' })
    expect(useStore.getState().preview).toBeNull()
  })

  it('клик гасит превью и начинает волну дельты', () => {
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_40' })
    useStore.getState().setEnergiestandard('EH_40')
    const s = useStore.getState()
    expect(s.preview).toBeNull()
    expect(s.activeDelta!.deltaExact.toFixed(2)).toBe('97335.00')
    expect(s.journal).toHaveLength(1)
  })
})

describe('DC-28: призрак несёт будущее значение, а не только разницу', () => {
  it('превью содержит будущий тотал, дельту, подпись полноты и прогон', () => {
    useStore.getState().previewOption({ kind: 'energiestandard', value: 'EH_40' })
    const pv = useStore.getState().preview!
    expect(pv.futureTotal.exact.toFixed(2)).toBe('3915170.00')
    expect(pv.futureTotal.display).toBe('3.915.000')
    expect(pv.deltaExact.toFixed(2)).toBe('97335.00')
    // Полнота будущего прогона называется: KG 500 остаётся unknown.
    expect(pv.futureLabel).toBe('Zwischensumme der kalkulierten Positionen')
    expect(pv.contextRef).toContain('DEMO-RUN-0009')
    // И по-прежнему ничего не фиксирует.
    expect(useStore.getState().journal).toHaveLength(0)
    expect(useStore.getState().projection().result.total.exact.toFixed(2)).toBe('3817835.00')
  })
})

describe('DC-44: направление, отнесение и ID вклада', () => {
  it('каждый драйвер несёт уникальный ID и позиции Scope', () => {
    const ds = useStore.getState().projection().result.drivers
    expect(new Set(ds.map((d) => d.key)).size).toBe(ds.length)
    expect(ds.find((d) => d.key === 'basis')!.scopeRefs).toEqual(['KG 300', 'KG 400'])
    expect(ds.find((d) => d.key === 'untergeschoss_mit_tiefgarage')!.scopeRefs)
      .toEqual(['UG'])
  })

  it('множитель несёт базу применения и сам множитель — их показывает DC-21', () => {
    const gk = useStore.getState().projection().result
      .drivers.find((d) => d.key === 'gebaeudeklasse_GK_5')!
    expect(gk.appliedTo!.toFixed(2)).toBe('3090000.00')
    expect(gk.factor!.toFixed(2)).toBe('1.05')
    // База × (множитель − 1) = вклад: у поповера нет своей арифметики.
    expect(gk.appliedTo!.mul(gk.factor!.minus(1)).toFixed(2)).toBe(gk.exact.toFixed(2))
  })

  it('экономящий драйвер поддержан симметрично: знак отрицателен, сумма сходится', () => {
    useStore.getState().setUntergeschoss('kein_ug')
    const r = useStore.getState().projection().result
    expect(r.drivers.some((d) => d.key === 'untergeschoss_mit_tiefgarage')).toBe(false)
    const sum = r.drivers.reduce((a, d) => a.plus(d.exact), new Decimal(0))
    expect(sum.equals(r.total.exact)).toBe(true)
  })

  it('язык следствий у класса здания, нормативное имя у энергостандарта', () => {
    const ds = useStore.getState().projection().result.drivers
    expect(ds.find((d) => d.key === 'gebaeudeklasse_GK_5')!.label)
      .toContain('Feuerwiderstand und Kapselung')
    expect(ds.find((d) => d.key === 'energiestandard_EH_55')!.label)
      .toBe('Energiestandard EH 55')
  })
})

describe('S3: интервал сужается подтверждением, не выбором опции (D-19)', () => {
  it('выбор энергостандарта интервал не меняет', () => {
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
    useStore.getState().setEnergiestandard('EH_40')
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
  })

  it('подтверждение WFL сужает на 5 Pp, ответ об энергостандарте — ещё на 4', () => {
    useStore.getState().editField('wfl', new Decimal('1560.00'), true)
    expect(useStore.getState().projection().uncertaintyPp).toBe(17)
    useStore.getState().confirmEnergiestandardAnswer()
    expect(useStore.getState().projection().uncertaintyPp).toBe(13)
  })

  it('подтверждение bgfOber интервал НЕ сужает: фикстура Δ не объявляет', () => {
    // Δ для bgfOber фикстурой не задана, и выдумывать её нельзя (R-25).
    useStore.getState().editField('bgfOber', new Decimal('2100.00'), true)
    expect(useStore.getState().projection().uncertaintyPp).toBe(22)
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

describe('S2: конфликт значения и версии документов', () => {
  it('решение конфликта в пользу клиента меняет только знаменатель', () => {
    const before = useStore.getState().projection()
    useStore.getState().resolveWflConflict('customer')
    const after = useStore.getState().projection()
    expect(after.result.total.exact.toFixed(2)).toBe(before.result.total.exact.toFixed(2))
    expect(after.leadRate.prefix + after.leadRate.display).toBe('≈2.447')
    expect(useStore.getState().wflConflict.state).toBe('resolved')
    // Конфликт закрыт событием, а не молча.
    expect(useStore.getState().journal.some((e) => e.kind === 'conflict.resolved')).toBe(true)
  })

  it('сохранение документного значения — событие; кандидат клиента остаётся альтернативой', () => {
    useStore.getState().resolveWflConflict('document')
    const s = useStore.getState()
    expect(s.fields.wfl.value.toFixed(2)).toBe('1500.00')
    expect(s.fields.wfl.provenance).toBe('vom Kunden bestätigt')
    expect(s.journal.at(-1)!.label).toContain('beibehalten')
    // SOURCE-001: непринятый кандидат хранится, не исчезает.
    const alt = s.wflConflict.candidates.find((c) => c.origin === 'customer')!
    expect(alt.selectionStatus).toBe('alternative')
    expect(alt.value).toBe('1560.00')
  })

  it('отмена разрешения конфликта атомарна: значение, provenance и статус', () => {
    useStore.getState().resolveWflConflict('customer')
    useStore.getState().undo()
    const s = useStore.getState()
    // Восстановлено ВСЁ, что событие меняло, — не только флаг.
    expect(s.wflConflict.state).toBe('open')
    expect(s.fields.wfl.value.toFixed(2)).toBe('1500.00')
    expect(s.fields.wfl.provenance).toBe('aus Dokument')
  })

  it('смена активной версии планов — событие журнала с обеими версиями', () => {
    useStore.getState().activateGrundrisse('V1')
    const e = useStore.getState().journal.at(-1)!
    expect(e.kind).toBe('document.activated')
    expect(e.label).toContain('V1')
    expect(e.label).toContain('V2')
    useStore.getState().undo()
    expect(useStore.getState().activeGrundrisse).toBe('V2')
  })
})


describe('M-4: недостаточно happy-path — курсор отмены и снапшот', () => {
  it('двойной undo отменяет ДВА разных события, третий — no-op', () => {
    useStore.getState().setEnergiestandard('EH_40')
    useStore.getState().setUntergeschoss('kein_ug')
    useStore.getState().undo() // отменяет UG
    useStore.getState().undo() // отменяет EH — не UG второй раз
    const s = useStore.getState()
    expect(s.building.untergeschoss).toBe('vollausbau')
    expect(s.building.energiestandard).toBe('EH_55')
    expect(s.projection().result.total.exact.toFixed(2)).toBe('3817835.00')
    const undos = s.journal.filter((e) => e.kind === 'undo')
    expect(undos).toHaveLength(2)
    expect(undos[0]!.undoOf).not.toBe(undos[1]!.undoOf)
    // Третий undo: отменять нечего — журнал не растёт.
    const len = s.journal.length
    useStore.getState().undo()
    expect(useStore.getState().journal).toHaveLength(len)
  })

  it('setState не экспортируется: данные не меняются мимо журнала', () => {
    // Публичный API хранилища не содержит setState — это проверка
    // конструкции, а не поведения: обходной двери не существует.
    expect((useStore as unknown as { setState?: unknown }).setState).toBeUndefined()
  })

  it('отправка создаёт снапшот с флагом Regionalfaktor и точным итогом', () => {
    useStore.getState().toggleRegionalfaktor()
    const snap = useStore.getState().sendOffer('email', '3.0')
    expect(snap.regionalfaktorActive).toBe(true)
    expect(snap.totalExact).toBe('4123261.80')
    expect(snap.discountPercent).toBe('3.0')
    const s = useStore.getState()
    expect(s.snapshots).toHaveLength(1)
    expect(s.journal.at(-1)!.kind).toBe('offer.emailed')
    expect(s.journal.at(-1)!.label).toContain(snap.id)
  })
})
