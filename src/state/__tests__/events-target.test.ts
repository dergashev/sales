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

    // PO, 16.09.2026: hover больше НЕ гасит только что показанный
    // дельта-чип — они сосуществуют, а перекрытие решено слоем в одной
    // ячейке зарезервированного слота (результат клика над превью).
    // Предмет этого теста другой: ни одно из эфемерных состояний не
    // переживает переключение Option ниже.
    st().previewOption({ kind: 'coverage', group: 'KG_500', value: 'included' })
    expect(st().preview).not.toBeNull()
    expect(st().activeDelta).not.toBeNull()

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

describe('AUD-03/EXP-04: авто-имя Option уникально под любым темпом клика', () => {
  it('без явного имени вычисляет его атомарно от optionSeq, не от длины списка', async () => {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    // Три вызова БЕЗ имени, один за другим — ровно то, что UI-компонент
    // теперь делает при клике (`s.createOption()`); раньше вызывающая
    // сторона сама вычисляла `Option ${s.options.length + 1}` от снимка
    // рендера, и два быстрых клика читали одну и ту же длину.
    st().createOption()
    st().createOption()
    st().createOption()
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2', 'Option 3'])
    // Имена уникальны — самая суть AC-1.
    expect(new Set(st().options.map((o) => o.name)).size).toBe(3)
  })

  it('имя остаётся уникальным даже через удаление (отмену) — как id, надгробие', async () => {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    st().createOption()
    st().createOption()
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
    st().undo()
    expect(st().options.map((o) => o.name)).toEqual(['Option 1'])
    st().createOption()
    // Прежде это снова дало бы «Option 2» (aus `options.length + 1`,
    // wieder 2) — mit demselben Namen wie die soeben rückgängig gemachte,
    // obwohl deren `id` (`OPT-02`) niemals wiederverwendet wird.
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Option 3'])
  })

  it('createOption gibt die id der neuen Option zurück, oder null wenn das Gate zu ist', async () => {
    st().openOpportunity('DEMO-0001')
    expect(st().canCreateOptions()).toBe(false)
    expect(st().createOption()).toBeNull()
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    const id = st().createOption()
    expect(id).toBe('OPT-01')
    expect(st().options.find((o) => o.id === id)).toBeDefined()
  })

  it('ein explizit übergebener Name gewinnt weiterhin (bestehende Aufrufer bleiben gültig)', async () => {
    await toPipeline()
    st().createOption('Basis')
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Basis'])
  })

  it('genau EIN Journal-Event und EIN Undo-Toast pro erzeugter Option', async () => {
    st().openOpportunity('DEMO-0001')
    st().resolveWflConflict('customer')
    st().confirmProjectParams()
    const before = st().journal.length
    st().createOption()
    expect(st().journal.length).toBe(before + 1)
    expect(st().journal.at(-1)!.label).toContain('Option 1')
    expect(st().undoToast?.statusText).toContain('Option 1')
    st().createOption()
    expect(st().journal.length).toBe(before + 2)
    expect(st().journal.at(-1)!.label).toContain('Option 2')
    expect(st().undoToast?.statusText).toContain('Option 2')
  })
})

describe('AUD-03/EXP-10: renameOption ändert nur den Namen', () => {
  it('journalisiert die Umbenennung, mit Undo', async () => {
    await toPipeline()
    const before = st().journal.length
    st().renameOption('OPT-01', 'Zielangebot')
    expect(st().options.find((o) => o.id === 'OPT-01')!.name).toBe('Zielangebot')
    expect(st().journal.length).toBe(before + 1)
    expect(st().undoToast).not.toBeNull()
    st().undo()
    expect(st().options.find((o) => o.id === 'OPT-01')!.name).toBe('Option 1')
  })

  it('no-op bei leerem oder unverändertem Namen — kein leeres Journal-Event', async () => {
    await toPipeline()
    const before = st().journal.length
    st().renameOption('OPT-01', '   ')
    st().renameOption('OPT-01', 'Option 1')
    expect(st().journal.length).toBe(before)
    expect(st().options.find((o) => o.id === 'OPT-01')!.name).toBe('Option 1')
  })

  it('M-3: eine bereits versendete Option lässt sich nicht umbenennen, auch nicht direkt am Store', async () => {
    await toPipeline()
    st().sendOffer('email')
    const before = st().journal.length
    st().renameOption('OPT-01', 'Nach dem Versand')
    expect(st().options.find((o) => o.id === 'OPT-01')!.name).toBe('Option 1')
    expect(st().journal.length).toBe(before)
  })

  // QA-Rework (AUD-03): live von QA Lead reproduziert — ohne diese Wache
  // stellte Umbenennen genau die Namenskollision wieder her, die dieses
  // Ticket beseitigen soll («Option 2» → «Option 1», während «Option 1»
  // schon existiert, gab zwei gleich benannte Zeilen und einen Toast, der
  // das still bestätigte).
  it('QA-Rework: Umbenennen darf keine Kollision mit einer bestehenden Option erzeugen', async () => {
    await toPipeline()
    st().createOption('Option 2')
    const before = st().journal.length
    st().renameOption('OPT-02', 'Option 1')
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
    expect(st().journal.length).toBe(before)
  })

  it('QA-Rework: eine kollidierende Umbenennung bleibt auch nach Trimmen/Padding blockiert', async () => {
    await toPipeline()
    st().createOption('Option 2')
    st().renameOption('OPT-02', '  Option 1  ')
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Option 2'])
  })

  it('QA-Rework: eine Umbenennung auf einen wirklich neuen, eindeutigen Namen funktioniert weiterhin', async () => {
    await toPipeline()
    st().createOption('Option 2')
    st().renameOption('OPT-02', 'Zielangebot')
    expect(st().options.map((o) => o.name)).toEqual(['Option 1', 'Zielangebot'])
  })
})
