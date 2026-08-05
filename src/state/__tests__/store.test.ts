import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { __resetStoreForTests, useStore } from '../store'

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
