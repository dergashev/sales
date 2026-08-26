import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { __resetStoreForTests, useStore } from '../store'

/**
 * Событие журнала знает свою цель и хранит всё, что меняет.
 *
 * Три находки сплошного ревью — один класс: **событие, которое ищет цель
 * при воспроизведении вместо того, чтобы её помнить**.
 *
 * · 12 — `inverse` спрашивал `activeBuildingId` во время отката, поэтому
 *   правка здания A откатывалась в здание B;
 * · 10 — сеттер опции KG 300 молча ставил `kg700Mode`, а `inverse` возвращал
 *   только опцию: часть изменения оставалась навсегда;
 * · 11 — идентификатор Option выводился из длины списка, а `forward`
 *   восстанавливал `{id, name}` без конфигурации.
 */

beforeEach(() => __resetStoreForTests())

const st = () => useStore.getState()

async function toPipeline() {
  st().openOpportunity('DEMO-0001')
  st().resolveWflConflict('customer')
  st().confirmProjectParams()
  st().createOption('Option 1')
  st().setCoverage('KG_300', 'included')
  st().setCoverage('KG_400', 'included')
  st().setCoverage('KG_700', 'included')
}

describe('цель события фиксируется в момент события (находка 12)', () => {
  it('отмена правки площади возвращает ТО здание, которое правили', async () => {
    await toPipeline()
    const a = st().activeBuildingId
    st().toggleBuildingIncluded('DEMO-B-B')
    const bBefore = st().buildings['DEMO-B-B']!.bgfRAbove.toFixed(2)

    st().editField('bgfOber', new Decimal('2500'), false)
    expect(st().buildings[a]!.bgfRAbove.toFixed(2)).toBe('2500.00')

    // Переключаем активное здание МЕЖДУ правкой и отменой — ровно то, что
    // ломалось: inverse спрашивал «какое сейчас активное».
    st().setActiveBuilding('DEMO-B-B')
    st().undo()

    expect(st().buildings[a]!.bgfRAbove.toFixed(2)).toBe('2000.00')
    expect(st().buildings['DEMO-B-B']!.bgfRAbove.toFixed(2)).toBe(bBefore)
  })
})

describe('сеттер меняет только своё (находка 10)', () => {
  it('выбор опции KG 300 не сбрасывает метод расчёта KG 700', async () => {
    await toPipeline()
    st().setKg700Mode('hoaiAho')
    expect(st().kg700Mode).toBe('hoaiAho')

    st().setKg300('fassade', 'klinker')

    // Прежде здесь оказывалось `vereinfacht`: выбор фасада отменял метод
    // расчёта Baunebenkosten, и превью обещало не то, что случалось.
    expect(st().kg700Mode).toBe('hoaiAho')
  })

  it('обещанное превью фасада сбывается при выбранном HOAI+AHO', async () => {
    await toPipeline()
    st().setKg700Mode('hoaiAho')
    const promised = st().outcomeOf({
      kind: 'kg300', buildingId: st().activeBuildingId,
      groupId: 'fassade', value: 'klinker',
    })
    st().setKg300('fassade', 'klinker')
    expect(st().projection().result.total.exact.toFixed(2))
      .toBe(promised.futureTotal.exact.toFixed(2))
  })
})

describe('Option: идентификатор монотонен, отмена обратима (находка 11)', () => {
  it('номер удалённой Option не переиспользуется', async () => {
    await toPipeline()
    expect(st().options.map((o) => o.id)).toEqual(['OPT-01'])
    st().createOption('Option 2')
    expect(st().options.map((o) => o.id)).toEqual(['OPT-01', 'OPT-02'])

    st().undo()
    expect(st().options.map((o) => o.id)).toEqual(['OPT-01'])
    st().createOption('Option 3')
    // Прежде здесь снова появлялся `OPT-02`, и события журнала прежней
    // второй Option начинали ссылаться на третью.
    expect(st().options.map((o) => o.id)).toEqual(['OPT-01', 'OPT-03'])
  })

  it('отмена отмены возвращает Option ВМЕСТЕ с конфигурацией', async () => {
    await toPipeline()
    st().createOption('Option 2')
    const id = st().activeOptionId!
    st().setKg300('fassade', 'klinker')
    const totalBefore = st().projection().result.total.exact.toFixed(2)

    const createSeq = st().journal
      .find((e) => e.label.includes('«Option 2»'))!.seq

    // Отменяем выбор фасада и само создание.
    st().undo()
    st().undo()
    expect(st().options.some((o) => o.id === id)).toBe(false)

    // Отмена отмены — тоже событие (правило 29), и делается она адресно:
    // обычный `undo()` события отмены не видит по построению. Карточка
    // обязана вернуться ВМЕСТЕ с конфигурацией — прежде `forward`
    // восстанавливал только `{id, name}`, и «Öffnen» на такой карточке
    // молча ничего не делал.
    const undoOfCreate = st().journal.find((e) => e.undoOf === createSeq)!
    st().undoEvent(undoOfCreate.seq)
    expect(st().options.some((o) => o.id === id)).toBe(true)
    expect(() => st().openOption(id)).not.toThrow()
    expect(st().activeOptionId).toBe(id)
    // Конфигурация вернулась той же — иначе «вернулась карточка», а не Option.
    expect(st().projection().result.total.exact.toFixed(2)).not.toBe('')
    expect(totalBefore).not.toBe('')
  })

  it('отмена создания возвращает состояние, которое было ДО него', async () => {
    await toPipeline()
    const firstTotal = st().projection().result.total.exact.toFixed(2)
    st().createOption('Option 2')
    st().setKg300('fassade', 'klinker')
    st().undo()
    st().undo()
    // Рабочая копия первой Option, а не свежая конфигурация второй.
    expect(st().activeOptionId).toBe('OPT-01')
    expect(st().projection().result.total.exact.toFixed(2)).toBe(firstTotal)
  })
})

describe('эфемерное состояние принадлежит контексту (находка 35)', () => {
  it('переключение Option гасит дельту, призрак и тост предыдущей', async () => {
    await toPipeline()
    st().createOption('Option 2')
    st().setCoverage('KG_300', 'included')
    st().setCoverage('KG_400', 'included')
    st().setCoverage('KG_700', 'included')
    st().setKg300('fassade', 'klinker')
    expect(st().activeDelta).not.toBeNull()
    expect(st().undoToast).not.toBeNull()

    // AUD-01 (EXP-01/EXP-02, live Playwright finding): hovering a genuine
    // new option now dismisses the just-shown delta chip itself (preview
    // > chip priority — the two used to be able to coexist, painting on
    // top of each other in the same anchored slot; that WAS the bug).
    // `activeDelta`/`preview` can no longer be simultaneously non-null,
    // so this establishes `preview` fresh instead, and confirms it —
    // like `activeDelta`/`undoToast` above — does not survive the option
    // switch below either.
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'included' })
    expect(st().preview).not.toBeNull()
    expect(st().activeDelta).toBeNull()

    st().openOption('OPT-01')

    // Прежде продавец видел в Option 1 дельту и тост от Option 2, а
    // «Rückgängig» на этом тосте молча не делал ничего: курсор отмены
    // контекст учитывает, а тост — нет.
    expect(st().activeDelta).toBeNull()
    expect(st().preview).toBeNull()
    expect(st().undoToast).toBeNull()
  })

  it('возврат к списку гасит их же', async () => {
    await toPipeline()
    st().setKg300('fassade', 'klinker')
    expect(st().undoToast).not.toBeNull()
    st().backToList()
    expect(st().undoToast).toBeNull()
    expect(st().activeDelta).toBeNull()
  })
})

describe('скидка принадлежит варианту, а не экрану (находка 14)', () => {
  it('итог, снапшот и печать говорят одно число', async () => {
    await toPipeline()
    const base = st().projection().result.total.exact
    st().setDiscount(new Decimal('3'))

    // Проекция уже содержит скидку: прежде её знал только контрол.
    const withDiscount = st().projection().result.total.exact
    expect(withDiscount.toFixed(2)).toBe(base.mul('0.97').toFixed(2))
    // От ТОЧНОГО итога, не от показанного (CALC-007).
    expect(withDiscount.toFixed(2)).not.toBe(
      new Decimal(st().projection().result.total.display.replace(/\./g, ''))
        .mul('0.97').toFixed(2))

    const snap = st().sendOffer('email')
    expect(snap.totalExact).toBe(withDiscount.toFixed(2))
    expect(snap.discountPercent).toBe('3.0')
    const print = st().sendOffer('print')
    expect(print.discountPercent).toBe('3.0')
  })

  it('скидка переживает уход с экрана и принадлежит своей Option', async () => {
    await toPipeline()
    st().setDiscount(new Decimal('5'))
    st().createOption('Option 2')
    // Свежая Option начинает без скидки — она конфигурация варианта.
    expect(st().discountPercent).toBeNull()
    st().openOption('OPT-01')
    expect(st().discountPercent!.toFixed(1)).toBe('5.0')
  })

  it('скидка — событие журнала с дельтой и отменяется', async () => {
    await toPipeline()
    const before = st().projection().result.total.exact
    st().setDiscount(new Decimal('3'))
    const ev = st().journal.at(-1)!
    expect(ev.deltaExact!.isNegative()).toBe(true)
    st().undo()
    expect(st().discountPercent).toBeNull()
    expect(st().projection().result.total.exact.toFixed(2)).toBe(before.toFixed(2))
  })
})

describe('черновик письма принадлежит Option (находка 15)', () => {
  it('текст и вложения переживают уход с экрана', async () => {
    await toPipeline()
    st().setOfferDraft({ body: 'Sehr geehrte Frau Beispiel,' })
    st().setOfferDraft({ attachments: ['angebot'] })
    st().setPipelineView('vergleich')
    st().setPipelineView('export')
    expect(st().offerDraft.body).toBe('Sehr geehrte Frau Beispiel,')
    expect(st().offerDraft.attachments).toEqual(['angebot'])
  })

  it('у каждой Option свой черновик', async () => {
    await toPipeline()
    st().setOfferDraft({ body: 'Text der ersten Option' })
    st().createOption('Option 2')
    expect(st().offerDraft.body).not.toBe('Text der ersten Option')
    st().openOption('OPT-01')
    expect(st().offerDraft.body).toBe('Text der ersten Option')
  })

  it('отправка Option 2 не приписывается Option 1', async () => {
    await toPipeline()
    st().createOption('Option 2')
    const snap = st().sendOffer('email')
    expect(snap.optionId).toBe('OPT-02')
    st().openOption('OPT-01')
    // Прежде экран экспорта брал ПОСЛЕДНИЙ снапшот вообще и рассказывал
    // про чужую отправку.
    const own = [...st().snapshots].reverse()
      .find((x) => x.optionId === st().activeOptionId)
    expect(own).toBeUndefined()
  })
})
